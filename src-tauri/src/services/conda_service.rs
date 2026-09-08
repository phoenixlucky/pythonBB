use crate::domain::models::{CondaEnvironment, OperationResult};
use crate::services::process_service::{failure, resolve_program, run, run_with_env};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct CondaEnvironmentList {
    envs: Vec<String>,
    #[serde(default)]
    envs_details: HashMap<String, CondaEnvironmentMeta>,
}

#[derive(Debug, Deserialize)]
struct CondaEnvironmentMeta {
    name: Option<String>,
    active: Option<bool>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct PythonVersionCache(HashMap<String, PythonVersionCacheEntry>);

#[derive(Debug, Serialize, Deserialize)]
struct PythonVersionCacheEntry {
    versions: Vec<String>,
    updated_at: u64,
}

async fn conda_program() -> Result<String, String> {
    resolve_program(if cfg!(windows) { "conda" } else { "conda" }).await.ok_or_else(|| "未检测到 Conda，请先安装 Miniconda 或 Anaconda".into())
}

async fn run_conda(args: &[String]) -> Result<crate::services::process_service::ProcessOutput, String> {
    let program = conda_program().await?;
    let cache = writable_conda_package_cache_dir().await?;
    let cache = cache.to_string_lossy().to_string();
    Ok(run_with_env(&program, args, None, &[("CONDA_PKGS_DIRS", cache.as_str())]).await)
}

fn conda_package_cache_candidates() -> Vec<PathBuf> {
    if cfg!(windows) {
        let mut candidates = Vec::new();
        if let Some(value) = std::env::var_os("LOCALAPPDATA") { candidates.push(PathBuf::from(value).join("conda").join("pkgs")); }
        candidates.push(std::env::temp_dir().join("WJ Python Manager").join("conda-pkgs"));
        candidates
    } else {
        vec![home_dir().join(".conda").join("pkgs"), std::env::temp_dir().join("wj-python-manager").join("conda-pkgs")]
    }
}

async fn writable_conda_package_cache_dir() -> Result<PathBuf, String> {
    let mut errors = Vec::new();
    for candidate in conda_package_cache_candidates() {
        match tokio::fs::create_dir_all(&candidate).await {
            Ok(()) => return Ok(candidate),
            Err(error) => errors.push(format!("{}: {error}", candidate.display())),
        }
    }
    Err(format!("没有可写的 Conda 包缓存目录：{}", errors.join("；")))
}

fn python_executable(prefix: &Path) -> PathBuf {
    if cfg!(windows) { prefix.join("python.exe") } else { prefix.join("bin").join("python") }
}

fn export_directory() -> PathBuf {
    home_dir().join("Documents").join("WJ Python Manager").join("exports")
}

fn home_dir() -> PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

fn safe_file_name(name: &str) -> String {
    let value = name.trim().chars().map(|character| if "<>:/|?*\"".contains(character) { '_' } else { character }).collect::<String>();
    if value.is_empty() { "conda-environment".into() } else { value }
}

fn spec_name(spec: &str) -> String {
    spec.trim().trim_start_matches("- ").split(|c: char| matches!(c, '=' | '<' | '>' | '!' | '~' | '[' | ':' | ' ')).next().unwrap_or("").to_ascii_lowercase()
}

fn is_conda_only(name: &str) -> bool {
    matches!(name, "conda-anaconda-telemetry" | "conda-anaconda-tos" | "anaconda_prompt" | "anaconda_powershell_prompt")
}

pub fn default_export_file(name: &str) -> String {
    export_directory().join(format!("{}.yml", safe_file_name(name))).to_string_lossy().to_string()
}

pub fn default_export_directory() -> String {
    export_directory().to_string_lossy().to_string()
}

async fn python_version(prefix: &Path) -> String {
    let executable = python_executable(prefix);
    let Some(program) = executable.to_str() else { return "未知".into() };
    let result = run(program, &["--version".into()], None).await;
    result.stdout.lines().chain(result.stderr.lines()).next().unwrap_or("未知").trim().replace("Python ", "")
}

async fn package_count(prefix: &Path) -> usize {
    let Ok(mut entries) = tokio::fs::read_dir(prefix.join("conda-meta")).await else { return 0 };
    let mut count = 0;
    while let Ok(Some(entry)) = entries.next_entry().await {
        if entry.file_name().to_string_lossy().ends_with(".json") { count += 1; }
    }
    count
}

fn parse_environment_list(stdout: &str, stderr: &str) -> Result<CondaEnvironmentList, String> {
    let mut last_error = None;
    for output in [stdout, stderr] {
        let output = output.trim_start_matches('\u{feff}');
        for (start, _) in output.match_indices('{') {
            let mut deserializer = serde_json::Deserializer::from_str(&output[start..]);
            match CondaEnvironmentList::deserialize(&mut deserializer) {
                Ok(parsed) => return Ok(parsed),
                Err(error) => last_error = Some(error.to_string()),
            }
        }
    }

    let detail = [stderr, stdout]
        .into_iter()
        .map(str::trim)
        .find(|value| !value.is_empty());
    Err(match (last_error, detail) {
        (Some(error), _) => format!("解析 Conda 环境失败: {error}"),
        (None, Some(detail)) => format!("Conda 未返回有效环境 JSON: {detail}"),
        (None, None) => "Conda 未返回环境 JSON".into(),
    })
}

pub async fn list_prefixes() -> Result<Vec<PathBuf>, String> {
    let result = run_conda(&["env".into(), "list".into(), "--json".into()]).await?;
    if !result.ok { return Err(failure(&result, "读取 Conda 环境失败")); }
    Ok(parse_environment_list(&result.stdout, &result.stderr)?.envs.into_iter().map(PathBuf::from).collect())
}

pub async fn list() -> Result<Vec<CondaEnvironment>, String> {
    let result = run_conda(&["env".into(), "list".into(), "--json".into()]).await?;
    if !result.ok { return Err(failure(&result, "读取 Conda 环境失败")); }
    let parsed = parse_environment_list(&result.stdout, &result.stderr)?;
    let active = std::env::var("CONDA_PREFIX").unwrap_or_default();
    let CondaEnvironmentList { envs, envs_details } = parsed;
    let mut environments = Vec::with_capacity(envs.len());
    let mut seen = HashSet::new();
    for prefix in envs {
        let normalized = prefix.to_ascii_lowercase();
        if !seen.insert(normalized) { continue; }
        let path = PathBuf::from(&prefix);
        let metadata = envs_details.get(&prefix);
        let name = metadata.and_then(|item| item.name.clone()).unwrap_or_else(|| if path.parent().and_then(Path::file_name).map(|item| item.to_string_lossy().eq_ignore_ascii_case("envs")).unwrap_or(false) {
            path.file_name().map(|item| item.to_string_lossy().to_string()).unwrap_or_else(|| "base".into())
        } else { "base".into() });
        environments.push(CondaEnvironment {
            name,
            prefix: prefix.clone(),
            python: python_version(&path).await,
            package_count: package_count(&path).await,
            active: metadata.and_then(|item| item.active).unwrap_or(prefix.eq_ignore_ascii_case(&active)),
        });
    }
    environments.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(environments)
}

#[cfg(test)]
mod tests {
    use super::{parse_environment_list, parse_json_value, rewrite_clone_yaml};

    #[test]
    fn parses_json_from_stderr_when_stdout_is_empty() {
        let parsed = parse_environment_list(
            "",
            r#"{"envs":["D:\\conda"],"envs_details":{}}"#,
        ).expect("Conda JSON should be parsed from stderr");

        assert_eq!(parsed.envs, vec!["D:\\conda"]);
    }

    #[test]
    fn ignores_diagnostics_before_json() {
        let parsed = parse_environment_list(
            "plugin: warning {ignored}\n{\"envs\":[],\"envs_details\":{}}\n",
            "",
        ).expect("Conda JSON should be parsed after diagnostics");

        assert!(parsed.envs.is_empty());
    }

    #[test]
    fn reports_empty_output_without_eof_error() {
        let error = parse_environment_list("", "").expect_err("empty output should fail");

        assert_eq!(error, "Conda 未返回环境 JSON");
    }

    #[test]
    fn clone_rewrite_keeps_nested_pip_packages_and_removes_unsafe_specs() {
        let yaml = "name: base\nchannels:\n  - defaults\ndependencies:\n  - python=3.13\n  - conda-anaconda-tos=1\n  - pip:\n    - requests==2.32.0\nprefix: C:\\old";
        let rewritten = rewrite_clone_yaml(yaml, "new-env", Some("3.14"), true, true, Some("conda-forge"));
        assert!(rewritten.contains("name: new-env"));
        assert!(rewritten.contains("  - python=3.14"));
        assert!(rewritten.contains("requests==2.32.0"));
        assert!(!rewritten.contains("conda-anaconda-tos"));
        assert!(!rewritten.contains("prefix:"));
        assert!(rewritten.contains("  - conda-forge"));
    }

    #[test]
    fn version_search_accepts_diagnostic_prefix() {
        let value = parse_json_value("warning: plugin\n{\"python\":[]}", "").unwrap();
        assert!(value.get("python").is_some());
    }

    #[tokio::test]
    #[ignore = "requires network and local Conda installation; read-only integration check"]
    async fn local_python_version_search_returns_or_reports_error() {
        let result = super::search_python("3.13".into(), "conda-forge".into()).await;
        assert!(result.is_ok() || result.unwrap_err().contains("Conda"));
    }
}

pub async fn create(name: String, mode: String, source: Option<String>, target_python_version: Option<String>, clone_python: bool, clone_packages: bool, python_version_value: Option<String>, channel: Option<String>, packages: Vec<String>) -> Result<OperationResult, String> {
    if name.trim().is_empty() { return Err("环境名称不能为空".into()); }
    if name == "." || name == ".." || name.contains(['/', '\\', ':']) { return Err("环境名称不能包含路径分隔符".into()); }
    let mut args = vec!["create".into(), "-n".into(), name.clone()];
    if mode == "clone" {
        let source_name = source.filter(|value| !value.trim().is_empty()).ok_or_else(|| "请选择要克隆的源环境".to_string())?;
        let target_version = target_python_version.filter(|value| !value.trim().is_empty());
        if clone_python && clone_packages && target_version.is_none() {
            args.extend(["--clone".into(), source_name]);
        } else {
            let exported = run_conda(&["env".into(), "export".into(), "-n".into(), source_name, "--no-builds".into()]).await?;
            if !exported.ok { return Err(failure(&exported, "读取源 Conda 环境失败")); }
            let yaml = rewrite_clone_yaml(&exported.stdout, &name, target_version.as_deref(), clone_python, clone_packages, channel.as_deref());
            let temporary = std::env::temp_dir().join(format!("wj-python-clone-{}-{}.yml", std::process::id(), name));
            tokio::fs::write(&temporary, yaml).await.map_err(|error| format!("写入克隆配置失败: {error}"))?;
            let result = run_conda(&["env".into(), "create".into(), "-f".into(), temporary.to_string_lossy().to_string(), "-y".into()]).await;
            let _ = tokio::fs::remove_file(&temporary).await;
            let result = result?;
            if !result.ok { return Err(failure(&result, "克隆 Conda 环境失败")); }
            return Ok(OperationResult { ok: true, message: format!("Conda 环境 {name} 创建完成"), command: result.command, output: [result.stdout, result.stderr].into_iter().filter(|value| !value.is_empty()).collect::<Vec<_>>().join("\n") });
        }
    } else {
        if let Some(channel) = channel.filter(|value| !value.is_empty() && value != "defaults") { args.extend(["-c".into(), channel, "--override-channels".into()]); }
        if let Some(version) = python_version_value.filter(|value| !value.is_empty()) { args.push(format!("python={version}")); }
        args.extend(packages.into_iter().filter(|value| !value.trim().is_empty()));
    }
    args.push("-y".into());
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "创建 Conda 环境失败")); }
    Ok(OperationResult { ok: true, message: format!("Conda 环境 {name} 创建完成"), command: result.command, output: [result.stdout, result.stderr].into_iter().filter(|value| !value.is_empty()).collect::<Vec<_>>().join("\n") })
}

fn rewrite_clone_yaml(content: &str, name: &str, target_python: Option<&str>, clone_python: bool, clone_packages: bool, channel: Option<&str>) -> String {
    let mut result = Vec::new();
    let mut in_dependencies = false;
    let mut in_pip = false;
    let mut has_python = false;
    for line in content.lines() {
        let trimmed = line.trim();
        let indent = line.len() - line.trim_start().len();
        if trimmed.starts_with("name:") {
            result.push(format!("name: {name}"));
            continue;
        }
        if trimmed.starts_with("prefix:") { continue; }
        if trimmed == "channels:" {
            result.push("channels:".into());
            if let Some(channel) = channel.filter(|value| !value.is_empty() && *value != "defaults") {
                result.push(format!("  - {channel}"));
            } else {
                result.push("  - defaults".into());
            }
            in_dependencies = false;
            continue;
        }
        if trimmed == "dependencies:" {
            in_dependencies = true;
            in_pip = false;
            result.push("dependencies:".into());
            continue;
        }
        if in_dependencies && indent == 2 && trimmed.starts_with("- ") {
            let spec = trimmed.trim_start_matches("- ").trim();
            let package = spec_name(spec);
            in_pip = package == "pip" && spec.ends_with(':');
            if package == "python" {
                has_python = true;
                if clone_python {
                    let current = spec.split('=').nth(1).unwrap_or("");
                    let selected = target_python.unwrap_or(current);
                    result.push(if selected.is_empty() { "  - python".into() } else { format!("  - python={selected}") });
                }
            } else if clone_packages && !is_conda_only(&package) {
                result.push(line.to_string());
            }
            continue;
        }
        if in_dependencies && in_pip {
            if clone_packages && (indent > 2 || trimmed.is_empty()) { result.push(line.to_string()); }
            continue;
        }
        if in_dependencies && indent < 2 && !trimmed.is_empty() {
            in_dependencies = false;
        }
        if !in_dependencies { result.push(line.to_string()); }
    }
    if clone_python && !has_python {
        if let Some(index) = result.iter().position(|line| line.trim() == "dependencies:") { result.insert(index + 1, "  - python".into()); }
        else { result.push("dependencies:".into()); result.push("  - python".into()); }
    }
    result.join("\n")
}

pub async fn remove(name: String) -> Result<OperationResult, String> {
    if name == "base" || name.trim().is_empty() { return Err("不能删除 base 环境或空环境名".into()); }
    let args = vec!["env".into(), "remove".into(), "-n".into(), name.clone(), "-y".into()];
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "删除 Conda 环境失败")); }
    Ok(OperationResult { ok: true, message: format!("Conda 环境 {name} 已删除"), command: result.command, output: result.stdout })
}

pub async fn export(name: String, path: String) -> Result<OperationResult, String> {
    let args = vec!["env".into(), "export".into(), "-n".into(), name, "-f".into(), path];
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "导出 Conda 环境失败")); }
    Ok(OperationResult { ok: true, message: "Conda 环境导出完成".into(), command: result.command, output: result.stdout })
}

pub async fn export_all(directory: String) -> Result<OperationResult, String> {
    if directory.trim().is_empty() { return Err("缺少导出目录".into()); }
    tokio::fs::create_dir_all(&directory).await.map_err(|error| format!("创建导出目录失败: {error}"))?;
    let environments = list().await?;
    let mut logs = Vec::new();
    for environment in environments {
        let file = PathBuf::from(&directory).join(format!("{}.yml", environment.name));
        logs.push(export(environment.name, file.to_string_lossy().to_string()).await?.output);
    }
    Ok(OperationResult { ok: true, message: "全部 Conda 环境导出完成".into(), command: "conda env export (all)".into(), output: logs.join("\n\n") })
}

pub async fn import(path: String, name: Option<String>) -> Result<OperationResult, String> {
    if !Path::new(&path).is_file() { return Err("YAML 文件不存在".into()); }
    let mut args = vec!["env".into(), "create".into(), "-f".into(), path, "-y".into()];
    if let Some(name) = name.filter(|value| !value.trim().is_empty()) { args.extend(["-n".into(), name]); }
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "导入 Conda 环境失败")); }
    Ok(OperationResult { ok: true, message: "Conda 环境导入完成".into(), command: result.command, output: result.stdout })
}

fn cache_path() -> Option<PathBuf> {
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).or_else(|| std::env::var_os("HOME").map(|value| PathBuf::from(value).join(".config")))
    }?;
    Some(base.join("WJ Python Manager").join("conda-python-versions.json"))
}

async fn search_python_uncached(version: String, channel: String) -> Result<Vec<String>, String> {
    let mut args = vec!["search".into()];
    if channel != "defaults" && !channel.is_empty() { args.extend(["-c".into(), channel, "--override-channels".into()]); }
    args.extend([format!("python{}", if version.is_empty() { String::new() } else { format!("={version}") }), "--json".into()]);
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "查询 Python 版本失败")); }
    let parsed = parse_json_value(&result.stdout, &result.stderr)?;
    let mut versions: Vec<String> = parsed.get("python").and_then(|value| value.as_array()).into_iter().flatten().filter_map(|value| value.get("version").and_then(|item| item.as_str()).map(str::to_owned)).filter(|value| value.chars().all(|character| character.is_ascii_digit() || character == '.')).collect();
    versions.sort_by(|left, right| right.split('.').map(|part| part.parse::<u32>().unwrap_or(0)).cmp(left.split('.').map(|part| part.parse::<u32>().unwrap_or(0))));
    versions.dedup();
    Ok(versions)
}

fn parse_json_value(stdout: &str, stderr: &str) -> Result<serde_json::Value, String> {
    for output in [stdout, stderr] {
        let text = output.trim_start_matches('\u{feff}');
        if let Ok(value) = serde_json::from_str(text) { return Ok(value); }
        for (start, _) in text.match_indices('{') {
            if let Ok(value) = serde_json::from_str(&text[start..]) { return Ok(value); }
        }
    }
    Err("Conda 未返回有效版本 JSON".into())
}

pub async fn search_python(version: String, channel: String) -> Result<Vec<String>, String> {
    search_python_cached(version, channel, false).await
}

pub async fn refresh_python(version: String, channel: String) -> Result<Vec<String>, String> {
    search_python_cached(version, channel, true).await
}

async fn search_python_cached(version: String, channel: String, force_refresh: bool) -> Result<Vec<String>, String> {
    let key = format!("{}::{}", channel.trim(), version.trim());
    if !force_refresh {
        if let Some(path) = cache_path() {
            if let Ok(content) = tokio::fs::read_to_string(&path).await {
                if let Ok(cache) = serde_json::from_str::<PythonVersionCache>(&content) {
                    if let Some(entry) = cache.0.get(&key) {
                        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|value| value.as_secs()).unwrap_or_default();
                        if now.saturating_sub(entry.updated_at) < 3600 {
                            return Ok(entry.versions.clone());
                        }
                    }
                }
            }
        }
    }
    let versions = search_python_uncached(version, channel).await?;
    if let Some(path) = cache_path() {
        if let Some(parent) = path.parent() { let _ = tokio::fs::create_dir_all(parent).await; }
        let mut cache = tokio::fs::read_to_string(&path).await.ok().and_then(|content| serde_json::from_str::<PythonVersionCache>(&content).ok()).unwrap_or_default();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|value| value.as_secs()).unwrap_or_default();
        cache.0.insert(key, PythonVersionCacheEntry { versions: versions.clone(), updated_at: now });
        if let Ok(content) = serde_json::to_string_pretty(&cache) { let _ = tokio::fs::write(path, content).await; }
    }
    Ok(versions)
}

pub async fn upgrade_python(name: String, version: String, channel: String) -> Result<OperationResult, String> {
    if name.trim().is_empty() || version.trim().is_empty() { return Err("环境名称和目标 Python 版本不能为空".into()); }
    let existing = list().await?.into_iter().find(|e| e.name == name).ok_or("未找到目标环境")?;
    let mut args = vec!["install".into(), "-n".into(), name.clone(), format!("python={version}")];
    if channel != "defaults" && !channel.is_empty() { args.extend(["-c".into(), channel, "--override-channels".into()]); }
    args.push("-y".into());
    let mut dry_run = args.clone();
    dry_run.push("--dry-run".into());
    let check = run_conda(&dry_run).await?;
    if !check.ok { return Err(failure(&check, "升级依赖检查失败")); }
    tokio::fs::create_dir_all(export_directory()).await.map_err(|e| e.to_string())?;
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let backup = export_directory().join(format!("{}-before-upgrade-{timestamp}.yml", safe_file_name(&name)));
    export(name, backup.to_string_lossy().to_string()).await?;
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "升级 Conda 环境 Python 失败")); }
    let actual = python_version(Path::new(&existing.prefix)).await;
    let matches = actual == version || (version.split('.').count() < 3 && actual.starts_with(&format!("{version}.")));
    if !matches { return Err(format!("升级后校验失败：期望 {version}，实际 {actual}；备份位于 {}", backup.display())); }
    Ok(OperationResult { ok: true, message: "Conda 环境 Python 升级完成".into(), command: result.command, output: result.stdout })
}

pub async fn upgrade_conda() -> Result<OperationResult, String> {
    let before = run_conda(&["--version".into()]).await?;
    if !before.ok { return Err(failure(&before, "读取 Conda 版本失败")); }
    let args = vec!["install".into(), "-n".into(), "base".into(), "-c".into(), "defaults".into(), "conda".into(), "-y".into()];
    let mut dry_run = args.clone(); dry_run.push("--dry-run".into());
    let check = run_conda(&dry_run).await?;
    if !check.ok { return Err(failure(&check, "Conda 升级依赖检查失败")); }
    tokio::fs::create_dir_all(export_directory()).await.map_err(|e| e.to_string())?;
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let backup = export_directory().join(format!("base-before-conda-upgrade-{timestamp}.yml"));
    export("base".into(), backup.to_string_lossy().to_string()).await?;
    let result = run_conda(&args).await?;
    if !result.ok { return Err(failure(&result, "升级 Conda 失败")); }
    let after = run_conda(&["--version".into()]).await?;
    let output = [result.stdout, result.stderr, format!("升级前：{}", before.stdout), format!("升级后：{}", after.stdout), format!("备份：{}", backup.display())].into_iter().filter(|value| !value.is_empty()).collect::<Vec<_>>().join("\n");
    Ok(OperationResult { ok: true, message: "Conda 核心包升级完成".into(), command: result.command, output })
}

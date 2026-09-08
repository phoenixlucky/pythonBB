use crate::domain::models::{OperationResult, Overview, RuntimeInfo};
use crate::services::{conda_service, venv_service};
use crate::services::process_service::{failure, resolve_program, run};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

async fn command_output(program: &str, args: &[&str]) -> String {
    let Some(executable) = resolve_program(program).await else { return "未检测到".into() };
    let output = run(&executable, &args.iter().map(|value| (*value).to_string()).collect::<Vec<_>>(), None).await;
    if !output.ok { return "未检测到".into(); }
    let value = if output.stdout.is_empty() { output.stderr } else { output.stdout };
    value.lines().next().unwrap_or("未检测到").trim().replace("Python ", "")
}

pub async fn get_overview() -> Result<Overview, String> {
    let (python, conda, environments) = tokio::join!(
        command_output("python", &["--version"]),
        command_output("conda", &["--version"]),
        conda_service::list()
    );
    let checked_at = SystemTime::now().duration_since(UNIX_EPOCH).map(|duration| duration.as_secs()).unwrap_or_default();
    Ok(Overview {
        runtime: RuntimeInfo {
            python: if python.is_empty() { "未检测到".into() } else { python },
            conda: if conda.is_empty() { "未检测到".into() } else { conda },
            platform: std::env::consts::OS.into(),
        },
        environments: if resolve_program("conda").await.is_none() { Vec::new() } else { environments? },
        checked_at: format!("unix:{checked_at}"),
    })
}

pub async fn discover_python_versions() -> Vec<String> {
    let mut candidates = Vec::new();

    if cfg!(windows) {
        if let Some(home) = std::env::var_os("USERPROFILE") {
            let home = PathBuf::from(home);
            candidates.push(home.join("AppData").join("Local").join("Programs").join("Python"));
        }
        for root in [
            "C:\\Python39", "C:\\Python310", "C:\\Python311", "C:\\Python312", "C:\\Python313", "C:\\Python314",
            "D:\\Python39", "D:\\Python310", "D:\\Python311", "D:\\Python312", "D:\\Python313", "D:\\Python314",
            "C:\\Program Files\\Python", "C:\\Program Files (x86)\\Python",
            "D:\\Program Files\\Python", "D:\\Program Files (x86)\\Python",
        ] {
            candidates.push(PathBuf::from(root));
        }

        let where_output = run("where.exe", &["python.exe".into()], None).await;
        candidates.extend(where_output.stdout.lines().map(str::trim).filter(|path| !path.is_empty()).map(PathBuf::from));

        let launcher = resolve_program("py").await.unwrap_or_else(|| "py".into());
        let launcher_output = run(&launcher, &["-0p".into()], None).await;
        candidates.extend(parse_python_launcher_paths(&launcher_output.stdout));
    } else {
        candidates.extend([PathBuf::from("/usr/bin/python3"), PathBuf::from("/usr/local/bin/python3")]);
        if let Some(home) = std::env::var_os("HOME") {
            let home = PathBuf::from(home);
            candidates.push(home.join(".pyenv").join("versions"));
            candidates.push(home.join(".asdf").join("installs").join("python"));
        }
        if let Some(program) = resolve_program("python3").await {
            candidates.push(PathBuf::from(program));
        }
    }

    if let Ok(conda_prefixes) = conda_service::list_prefixes().await {
        candidates.extend(conda_prefixes);
    }

    let mut executables = Vec::new();
    for candidate in candidates {
        if candidate.is_file() {
            executables.push(candidate);
        } else if candidate.is_dir() {
            collect_python_executables(&candidate, &mut executables).await;
        }
    }

    let mut seen = HashSet::new();
    let mut versions = Vec::new();
    for executable in executables {
        let key = executable.to_string_lossy().to_ascii_lowercase();
        if !seen.insert(key) || is_blocked_windows_alias(&executable) {
            continue;
        }
        if let Some(version) = python_version_at(&executable).await {
            versions.push(format!("{version} ({})", executable.to_string_lossy()));
        }
    }
    versions.sort_by(|left, right| right.cmp(left));
    versions
}

pub async fn uninstall_python(path: String) -> Result<OperationResult, String> {
    let requested = PathBuf::from(path.trim());
    if !requested.is_file() {
        return Err("选中的 Python 路径不存在，无法卸载".into());
    }

    if let Ok(environments) = conda_service::list().await {
        for environment in environments {
            let prefix = PathBuf::from(&environment.prefix);
            let executable = python_executable(&prefix);
            if same_path(&requested, &executable) {
                return conda_service::remove(environment.name).await;
            }
        }
    }

    for environment in venv_service::list(None).await {
        let root = PathBuf::from(&environment.path);
        let executable = if cfg!(windows) {
            root.join("Scripts").join("python.exe")
        } else {
            root.join("bin").join("python")
        };
        if same_path(&requested, &executable) {
            return venv_service::remove(environment.path).await;
        }
    }

    Err("该 Python 属于系统安装或外部管理器，不能由本程序直接卸载；请从系统应用或原管理器中卸载".into())
}

pub async fn upgrade_python(path: String) -> Result<OperationResult, String> {
    if !cfg!(windows) {
        return Err("普通系统 Python 的一键升级当前仅支持 Windows；请使用原安装器或系统包管理器升级".into());
    }

    let requested = PathBuf::from(path.trim());
    if !requested.is_file() {
        return Err("选中的 Python 路径不存在，无法升级".into());
    }

    if let Ok(environments) = conda_service::list().await {
        for environment in environments {
            let prefix = PathBuf::from(&environment.prefix);
            if same_path(&requested, &python_executable(&prefix)) {
                return Err("这是 Conda 环境，请使用“Conda Python 升级”入口".into());
            }
        }
    }

    for environment in venv_service::list(None).await {
        let root = PathBuf::from(&environment.path);
        let executable = if cfg!(windows) {
            root.join("Scripts").join("python.exe")
        } else {
            root.join("bin").join("python")
        };
        if same_path(&requested, &executable) {
            return Err("venv 不能直接替换底层 Python；请用目标 Python 重建虚拟环境并重新安装依赖".into());
        }
    }

    let path_text = requested.to_string_lossy().to_ascii_lowercase();
    if path_text.contains("\\.pyenv\\") || path_text.contains("\\.asdf\\") {
        return Err("该 Python 由外部版本管理器维护，请使用 pyenv/asdf 升级".into());
    }

    let current = python_version_at(&requested).await.ok_or("无法读取选中的 Python 版本")?;
    let (major, minor) = parse_python_major_minor(&current).ok_or("无法识别选中的 Python 版本")?;
    let winget = resolve_program("winget").await.ok_or("未检测到 winget，请先安装 Windows App Installer")?;
    let package_id = format!("Python.Python.{major}.{minor}");
    let args = vec![
        "upgrade".into(), "--id".into(), package_id.clone(), "--exact".into(),
        "--silent".into(), "--accept-source-agreements".into(),
        "--accept-package-agreements".into(), "--disable-interactivity".into(),
    ];
    let result = run(&winget, &args, None).await;
    if !result.ok {
        return Err(failure(&result, &format!("winget 未能升级 {package_id}")));
    }

    let actual = python_version_at(&requested).await.unwrap_or_default();
    if actual == current {
        return Err(format!("未检测到 Python {current} 的可用更新（winget 包：{package_id}）"));
    }

    Ok(OperationResult {
        ok: true,
        message: format!("系统 Python 已升级：{current} → {actual}"),
        command: result.command,
        output: result.stdout,
    })
}

fn same_path(left: &Path, right: &Path) -> bool {
    let normalize = |path: &Path| {
        std::fs::canonicalize(path)
            .unwrap_or_else(|_| path.to_path_buf())
            .to_string_lossy()
            .to_ascii_lowercase()
    };
    normalize(left) == normalize(right)
}

fn python_executable(directory: &Path) -> PathBuf {
    if cfg!(windows) { directory.join("python.exe") } else { directory.join("bin").join("python3") }
}

async fn collect_python_executables(root: &Path, output: &mut Vec<PathBuf>) {
    let direct = python_executable(root);
    if direct.is_file() {
        output.push(direct);
        return;
    }

    let Ok(mut entries) = tokio::fs::read_dir(root).await else { return };
    while let Ok(Some(entry)) = entries.next_entry().await {
        if entry.file_type().await.map(|kind| kind.is_dir()).unwrap_or(false) {
            let executable = python_executable(&entry.path());
            if executable.is_file() {
                output.push(executable);
            }
        }
    }
}

fn parse_python_launcher_paths(output: &str) -> Vec<PathBuf> {
    output.lines().filter_map(|line| {
        let line = line.trim();
        let lower = line.to_ascii_lowercase();
        let end = lower.find(".exe")? + ".exe".len();
        let value = if let Some(marker) = line.find('*') {
            line[marker + 1..end].trim()
        } else {
            let drive = line.char_indices().find_map(|(index, character)| {
                (character.is_ascii_alphabetic() && line.get(index + 1..index + 3) == Some(":\\")).then_some(index)
            });
            drive.map(|index| line[index..end].trim()).unwrap_or(line[..end].trim())
        };
        Some(PathBuf::from(value.trim_matches('"')))
    }).collect()
}

fn is_blocked_windows_alias(path: &Path) -> bool {
    cfg!(windows) && path.to_string_lossy().to_ascii_lowercase().contains("\\windowsapps\\")
}

async fn python_version_at(executable: &Path) -> Option<String> {
    let program = executable.to_str()?;
    let result = run(program, &["--version".into()], None).await;
    if !result.ok { return None; }
    let value = result.stdout.lines().chain(result.stderr.lines()).next()?.trim();
    let version = value.strip_prefix("Python ").unwrap_or(value).trim();
    (!version.is_empty()).then(|| version.to_string())
}

fn parse_python_major_minor(version: &str) -> Option<(u32, u32)> {
    let mut parts = version.split('.');
    Some((parts.next()?.parse().ok()?, parts.next()?.parse().ok()?))
}

#[cfg(test)]
mod tests {
    use super::{parse_python_launcher_paths, parse_python_major_minor};

    #[tokio::test]
    #[ignore = "requires local Conda installation; read-only integration check"]
    async fn local_environment_inventory() {
        let overview = super::get_overview().await.expect("overview must load");
        assert!(!overview.environments.is_empty(), "local Conda environments must be detected");
        assert_ne!(overview.runtime.python, "未检测到");
        for environment in &overview.environments {
            assert_ne!(environment.python, "未知");
            println!("{}: {} ({})", environment.name, environment.python, environment.prefix);
        }
        assert!(!super::discover_python_versions().await.is_empty());
    }

    #[test]
    fn parses_python_launcher_paths_with_spaces() {
        let paths = parse_python_launcher_paths("-V:3.13 * C:\\Program Files\\Python313\\python.exe\n-V:3.12 C:\\Python312\\python.exe");

        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0].to_string_lossy(), "C:\\Program Files\\Python313\\python.exe");
        assert_eq!(paths[1].to_string_lossy(), "C:\\Python312\\python.exe");
    }

    #[test]
    fn parses_python_major_minor_for_winget_package() {
        assert_eq!(parse_python_major_minor("3.13.7"), Some((3, 13)));
        assert_eq!(parse_python_major_minor("Python 3.13"), None);
    }
}

use crate::domain::models::{OperationResult, VirtualEnvironment};
use crate::services::process_service::{failure, resolve_program, run};
use std::path::{Path, PathBuf};

fn home_dir() -> PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

pub fn default_directory() -> String { home_dir().join("venvs").to_string_lossy().to_string() }

fn python_executable(path: &Path) -> PathBuf { if cfg!(windows) { path.join("Scripts").join("python.exe") } else { path.join("bin").join("python") } }

async fn python_version(path: &Path) -> String {
    let executable = python_executable(path);
    let result = run(executable.to_string_lossy().as_ref(), &["--version".into()], None).await;
    result.stdout.lines().chain(result.stderr.lines()).next().unwrap_or("未知").replace("Python ", "")
}

async fn inspect(path: &Path) -> Option<VirtualEnvironment> {
    if !path.is_dir() || !python_executable(path).is_file() || !path.join("pyvenv.cfg").is_file() { return None; }
    let name = path.file_name()?.to_string_lossy().to_string();
    let manager = match tokio::fs::read_to_string(path.join(".weipython-env.json")).await {
        Ok(content) if serde_json::from_str::<serde_json::Value>(&content).ok().and_then(|value| value.get("manager").and_then(|v| v.as_str()).map(str::to_owned)).as_deref() == Some("uv") => "uv",
        _ => "venv",
    };
    Some(VirtualEnvironment { name, path: path.to_string_lossy().to_string(), manager: manager.into(), python_version: python_version(path).await })
}

pub async fn list(last_directory: Option<String>) -> Vec<VirtualEnvironment> {
    let mut roots = vec![home_dir().join("venvs"), home_dir().join("envs"), home_dir().join("Envs")];
    if let Ok(content) = tokio::fs::read_to_string(registry_path()).await {
        if let Ok(saved) = serde_json::from_str::<Vec<PathBuf>>(&content) { roots.extend(saved); }
    }
    if let Some(path) = last_directory { roots.push(PathBuf::from(path)); }
    roots.sort();
    roots.dedup();
    let mut result = Vec::new();
    for root in roots {
        if let Some(environment) = inspect(&root).await {
            result.push(environment);
            continue;
        }
        let Ok(mut entries) = tokio::fs::read_dir(root).await else { continue };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Some(environment) = inspect(&path).await { result.push(environment); }
        }
    }
    result.sort_by(|left, right| left.name.cmp(&right.name));
    result
}

pub async fn create(name: String, target_path: String, python_path: Option<String>, manager: Option<String>) -> Result<OperationResult, String> {
    if name.trim().is_empty() || target_path.trim().is_empty() { return Err("环境名称和目标目录不能为空".into()); }
    if name == "." || name == ".." || name.contains(['/', '\\', ':']) { return Err("环境名称不能包含路径分隔符".into()); }
    let root = PathBuf::from(target_path);
    tokio::fs::create_dir_all(&root).await.map_err(|error| format!("创建目标目录失败: {error}"))?;
    let path = root.join(&name);
    if path.exists() { return Err("目标目录已存在，请选择新的环境名称".into()); }
    let use_uv = manager.as_deref() == Some("uv");
    let (program, args) = if use_uv {
        let uv = resolve_program("uv").await.ok_or("未检测到 uv。请切换为“Python venv”，或先安装 uv 后再选择 uv")?;
        let mut uv_args = vec!["venv".into()];
        if let Some(python) = python_path.filter(|value| !value.trim().is_empty()) {
            uv_args.extend(["--python".into(), python]);
        }
        uv_args.push(path.to_string_lossy().to_string());
        (uv, uv_args)
    } else {
        let python = if let Some(value) = python_path.filter(|value| !value.trim().is_empty()) {
            value
        } else {
            resolve_program(if cfg!(windows) { "python" } else { "python3" }).await.ok_or("未检测到 Python，请填写可执行文件的完整路径")?
        };
        (python, vec!["-m".into(), "venv".into(), path.to_string_lossy().to_string()])
    };
    let result = run(&program, &args, None).await;
    if !result.ok { return Err(failure(&result, "创建虚拟环境失败")); }
    let metadata = format!("{{\"manager\":\"{}\"}}", if use_uv { "uv" } else { "venv" });
    if let Err(error) = tokio::fs::write(path.join(".weipython-env.json"), metadata).await {
        let _ = tokio::fs::remove_dir_all(&path).await;
        return Err(format!("写入环境元数据失败，已清理创建的环境: {error}"));
    }
    let mut roots = tokio::fs::read_to_string(registry_path()).await.ok().and_then(|v| serde_json::from_str::<Vec<PathBuf>>(&v).ok()).unwrap_or_default();
    if let Some(parent) = path.parent() { roots.push(parent.to_path_buf()); }
    roots.sort(); roots.dedup();
    let registry = registry_path();
    let temporary = registry.with_extension("json.tmp");
    let content = serde_json::to_vec(&roots).map_err(|e| e.to_string())?;
    if let Err(error) = tokio::fs::write(&temporary, content).await.and_then(|_| std::fs::rename(&temporary, &registry).map_err(std::io::Error::from)) {
        let _ = tokio::fs::remove_file(&temporary).await;
        let _ = tokio::fs::remove_dir_all(&path).await;
        return Err(format!("登记环境失败，已清理创建的环境: {error}"));
    }
    Ok(OperationResult { ok: true, message: format!("虚拟环境 {name} 创建完成"), command: result.command, output: result.stdout })
}

pub async fn export_uv(path: String, file_path: String) -> Result<OperationResult, String> {
    let environment = PathBuf::from(path.trim());
    let output = PathBuf::from(file_path.trim());
    let python = python_executable(&environment);
    if !python.is_file() { return Err("选中的 uv 环境无有效 Python 解释器".into()); }
    if output.as_os_str().is_empty() { return Err("缺少导出文件路径".into()); }
    let uv = resolve_program("uv").await.ok_or("未检测到 uv，请先安装 uv")?;
    let args = vec!["pip".into(), "freeze".into(), "--python".into(), python.to_string_lossy().to_string()];
    let result = run(&uv, &args, None).await;
    if !result.ok { return Err(failure(&result, "导出 uv 环境失败")); }
    tokio::fs::write(&output, &result.stdout).await.map_err(|error| format!("写入导出文件失败: {error}"))?;
    Ok(OperationResult { ok: true, message: "uv 环境依赖导出完成".into(), command: result.command, output: output.to_string_lossy().to_string() })
}

pub async fn import_uv(path: String, file_path: String) -> Result<OperationResult, String> {
    let environment = PathBuf::from(path.trim());
    let requirements = PathBuf::from(file_path.trim());
    let python = python_executable(&environment);
    if !python.is_file() { return Err("选中的 uv 环境无有效 Python 解释器".into()); }
    if !requirements.is_file() { return Err("依赖文件不存在".into()); }
    let uv = resolve_program("uv").await.ok_or("未检测到 uv，请先安装 uv")?;
    let args = vec![
        "pip".into(), "install".into(),
        "--python".into(), python.to_string_lossy().to_string(),
        "--requirement".into(), requirements.to_string_lossy().to_string(),
    ];
    let result = run(&uv, &args, None).await;
    if !result.ok { return Err(failure(&result, "导入 uv 环境依赖失败")); }
    Ok(OperationResult { ok: true, message: "uv 环境依赖导入完成".into(), command: result.command, output: result.stdout })
}

fn registry_path() -> PathBuf { home_dir().join(".wj-python-venv-roots.json") }

pub async fn remove(path: String) -> Result<OperationResult, String> {
    if path.trim().is_empty() { return Err("缺少虚拟环境路径".into()); }
    let target = PathBuf::from(&path);
    if !target.exists() { return Err("虚拟环境不存在".into()); }
    if !target.join("pyvenv.cfg").is_file() || !python_executable(&target).is_file() { return Err("该目录不是有效虚拟环境，拒绝删除".into()); }
    let target_key = std::fs::canonicalize(&target).unwrap_or_else(|_| target.clone()).to_string_lossy().to_ascii_lowercase();
    let registered = list(None).await.into_iter().any(|environment| {
        let environment_path = PathBuf::from(environment.path);
        std::fs::canonicalize(&environment_path).unwrap_or(environment_path).to_string_lossy().to_ascii_lowercase() == target_key
    });
    let owned_metadata = target.join(".weipython-env.json").is_file();
    if !registered && !owned_metadata { return Err("该虚拟环境未被本程序登记，拒绝删除；请先从已发现环境中选择".into()); }
    tokio::fs::remove_dir_all(&target).await.map_err(|error| format!("删除虚拟环境失败: {error}"))?;
    Ok(OperationResult { ok: true, message: "虚拟环境已删除".into(), command: "filesystem.remove_dir_all".into(), output: path })
}

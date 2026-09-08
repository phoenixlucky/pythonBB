use crate::domain::models::{OperationResult, SetupStatus};
use crate::services::conda_service;
use crate::services::package_service;
use crate::services::process_service::{failure, resolve_program, run};
use std::path::PathBuf;

const MINICONDA_URL: &str = "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe";

fn home_dir() -> PathBuf { std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from).unwrap_or_else(|| PathBuf::from(".")) }
fn default_install_path() -> String { if cfg!(windows) { "D:\\ProgramData\\miniconda3".into() } else { home_dir().join("miniconda3").to_string_lossy().to_string() } }

pub async fn status() -> SetupStatus {
    let conda_path = resolve_program("conda").await;
    let environment_count = if conda_path.is_some() { conda_service::list().await.map(|items| items.len()).unwrap_or_default() } else { 0 };
    let (conda_version, base_python_version, root_prefix) = if let Some(path) = conda_path.as_deref() {
        let conda_version = {
            let result = run(path, &["--version".into()], None).await;
            result.stdout.lines().chain(result.stderr.lines()).find(|line| !line.trim().is_empty()).map(|line| line.trim().trim_start_matches("conda ").to_string())
        };
        let root_prefix = std::path::Path::new(path).parent().and_then(|parent| parent.parent()).map(|root| root.to_string_lossy().to_string());
        let base_python_version = root_prefix.as_deref().map(|root| {
            if cfg!(windows) { std::path::PathBuf::from(root).join("python.exe") } else { std::path::PathBuf::from(root).join("bin").join("python") }
        }).filter(|python| python.is_file());
        let base_python_version = if let Some(python) = base_python_version {
            let result = run(python.to_string_lossy().as_ref(), &["--version".into()], None).await;
            result.stdout.lines().chain(result.stderr.lines()).find(|line| !line.trim().is_empty()).map(|line| line.trim().trim_start_matches("Python ").to_string())
        } else { None };
        (conda_version, base_python_version, root_prefix)
    } else { (None, None, None) };
    SetupStatus { conda_available: conda_path.is_some(), conda_path, recommended_install_path: default_install_path(), environment_count, platform_supported: cfg!(windows) && cfg!(target_arch = "x86_64"), conda_version, base_python_version, root_prefix }
}

async fn install_miniconda(path: &str) -> Result<OperationResult, String> {
    if !cfg!(windows) { return Err("Miniconda 自动安装当前仅支持 Windows x64".into()); }
    let escaped_path = path.replace('\'', "''");
    let script = format!("$ErrorActionPreference='Stop'; $installer=Join-Path $env:TEMP 'WJ-Python-Miniconda3.exe'; Invoke-WebRequest -UseBasicParsing -Uri '{MINICONDA_URL}' -OutFile $installer; $p=Start-Process -FilePath $installer -ArgumentList @('/InstallationType=JustMe','/RegisterPython=0','/AddToPath=0','/S','/D={escaped_path}') -Wait -PassThru; Remove-Item $installer -Force; if ($p.ExitCode -ne 0) {{ exit $p.ExitCode }}");
    let result = run("powershell.exe", &["-NoProfile".into(), "-ExecutionPolicy".into(), "Bypass".into(), "-Command".into(), script], None).await;
    if !result.ok { return Err(failure(&result, "Miniconda 安装失败")); }
    Ok(OperationResult { ok: true, message: "Miniconda 安装完成".into(), command: result.command, output: result.stdout })
}

pub async fn initialize(install_path: String, python_version: String, conda_packages: Vec<String>, pip_packages: Vec<String>) -> Result<OperationResult, String> {
    let mut logs = Vec::new();
    if resolve_program("conda").await.is_none() {
        logs.push(install_miniconda(&install_path).await?.output);
        let executable = PathBuf::from(&install_path).join("Scripts").join("conda.exe");
        if !executable.is_file() { return Err("安装结束但未找到 conda.exe".into()); }
        let mut settings = crate::services::storage_service::read_settings().await?;
        settings.conda_path = Some(executable.to_string_lossy().to_string());
        crate::services::storage_service::write_settings(&settings).await?;
    }
    let version = if python_version.trim().is_empty() { "3.14".to_string() } else { python_version };
    let environment_name = format!("py{}", version.chars().filter(|character| character.is_ascii_digit()).collect::<String>());
    let mut packages = vec!["ipykernel".to_string()];
    packages.extend(conda_packages.into_iter());
    let create = conda_service::create(environment_name.clone(), "python".into(), None, None, true, true, Some(version), Some("conda-forge".into()), packages).await?;
    logs.push(create.output);
    // Conda may already be installed outside the requested bootstrap path. Use
    // the prefix returned by Conda instead of guessing <install_path>\envs\name.
    let env_path = conda_service::list().await?
        .into_iter()
        .find(|environment| environment.name.eq_ignore_ascii_case(&environment_name))
        .map(|environment| environment.prefix)
        .ok_or_else(|| format!("创建完成但未找到 Conda 环境 {environment_name} 的实际路径"))?;
    for package in pip_packages.into_iter().filter(|package| !package.trim().is_empty()) {
        let result = package_service::execute(crate::domain::models::EnvironmentTarget { target_type: "conda".into(), name: Some(environment_name.clone()), path: Some(env_path.clone()), manager: None }, "install".into(), Some(package), None, None).await?;
        logs.push(result.output);
    }
    Ok(OperationResult { ok: true, message: format!("初始化完成，环境 {environment_name} 已就绪"), command: "conda + pip initialization".into(), output: logs.join("\n\n") })
}

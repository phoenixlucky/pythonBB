use crate::domain::models::OperationResult;
use crate::services::process_service::{failure, resolve_program, run, run_with_env};
use std::path::{Path, PathBuf};

fn validate_version(version: Option<String>) -> Result<Option<String>, String> {
    let Some(value) = version.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if !value.chars().all(|character| character.is_ascii_alphanumeric() || ".-_+".contains(character)) || !value.chars().next().is_some_and(|character| character.is_ascii_digit()) {
        return Err("uv 版本格式无效，例如 0.8.17".into());
    }
    Ok(Some(value))
}

pub async fn path() -> Option<String> {
    resolve_program("uv").await
}

pub async fn paths() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Some(saved) = crate::services::storage_service::read_settings().await.ok().and_then(|settings| settings.uv_path) {
        candidates.push(saved);
    }
    let lookup = if cfg!(windows) { "where.exe" } else { "which" };
    let result = run(lookup, &[if cfg!(windows) { "uv.exe".into() } else { "uv".into() }], None).await;
    candidates.extend(result.stdout.lines().map(str::trim).filter(|value| !value.is_empty()).map(str::to_owned));
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
    if let Some(root) = home {
        let executable = if cfg!(windows) { "uv.exe" } else { "uv" };
        candidates.push(root.join(".local").join("bin").join(executable).to_string_lossy().to_string());
        candidates.push(root.join(".cargo").join("bin").join(executable).to_string_lossy().to_string());
    }
    if let Some(root) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
        candidates.push(root.join("uv").join("uv.exe").to_string_lossy().to_string());
        candidates.push(root.join("bin").join("uv.exe").to_string_lossy().to_string());
    }
    let mut found = Vec::new();
    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            let value = path.to_string_lossy().to_string();
            if !found.iter().any(|item: &String| item.eq_ignore_ascii_case(&value)) { found.push(value); }
        }
    }
    found
}

pub async fn install(version: Option<String>, install_directory: Option<String>) -> Result<OperationResult, String> {
    let version = validate_version(version)?;
    let directory = install_directory.filter(|s| !s.trim().is_empty()).unwrap_or(default_directory().await);
    if !Path::new(&directory).is_absolute() { return Err("安装目录必须是绝对路径".into()); }
    let base_url = version.as_ref().map(|v| format!("https://astral.sh/uv/{v}")).unwrap_or("https://astral.sh/uv".into());

    let (program, args) = if cfg!(windows) {
        (
            "powershell.exe",
            vec![
                "-NoLogo".into(),
                "-NoProfile".into(),
                "-ExecutionPolicy".into(),
                "Bypass".into(),
                "-Command".into(),
                format!("$ErrorActionPreference='Stop'; irm '{base_url}/install.ps1' | iex"),
            ],
        )
    } else {
        (
            "sh",
            vec!["-c".into(), format!("script=$(curl -LsSf '{base_url}/install.sh') || exit; printf '%s' \"$script\" | sh")],
        )
    };
    let result = run_with_env(program, &args, None, &[("UV_INSTALL_DIR", &directory), ("UV_NO_MODIFY_PATH", "1")]).await;
    if !result.ok {
        return Err(failure(&result, "uv 安装失败，请检查网络连接或手动安装 uv"));
    }

    let installed = PathBuf::from(&directory).join(if cfg!(windows) { "uv.exe" } else { "uv" }).to_string_lossy().to_string();
    let check = run(&installed, &["--version".into()], None).await;
    if !check.ok { return Err(failure(&check, "安装后验证 uv 失败")); }
    if let Some(expected) = &version {
        if check.stdout.split_whitespace().nth(1) != Some(expected.as_str()) {
            return Err(format!("安装版本不匹配：期望 {expected}，实际 {}", check.stdout));
        }
    }
    let mut settings = crate::services::storage_service::read_settings().await?;
    settings.uv_path = Some(installed.clone());
    crate::services::storage_service::write_settings(&settings).await?;
    Ok(OperationResult {
        ok: true,
        message: format!("uv {}完成：{installed}", version.as_deref().map(|value| format!("版本 {value} 安装")).unwrap_or_else(|| "安装".into())),
        command: result.command,
        output: [result.stdout, result.stderr]
            .into_iter()
            .filter(|value| !value.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
    })
}

fn managed_uv_path(path: &str) -> bool {
    let target = PathBuf::from(path);
    let Some(parent) = target.parent() else { return false; };
    let parent = parent.to_string_lossy().to_ascii_lowercase();
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(|value| PathBuf::from(value).to_string_lossy().to_ascii_lowercase());
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(|value| PathBuf::from(value).to_string_lossy().to_ascii_lowercase());
    let home_local = home.as_ref().map(|root| PathBuf::from(root).join(".local").join("bin").to_string_lossy().to_ascii_lowercase());
    let home_cargo = home.as_ref().map(|root| PathBuf::from(root).join(".cargo").join("bin").to_string_lossy().to_ascii_lowercase());
    let app_uv = local_app_data.as_ref().map(|root| PathBuf::from(root).join("uv").to_string_lossy().to_ascii_lowercase());
    let app_bin = local_app_data.as_ref().map(|root| PathBuf::from(root).join("bin").to_string_lossy().to_ascii_lowercase());
    home_local.as_deref() == Some(parent.as_str())
        || home_cargo.as_deref() == Some(parent.as_str())
        || app_uv.as_deref() == Some(parent.as_str())
        || app_bin.as_deref() == Some(parent.as_str())
}

pub async fn version(selected: Option<String>) -> Option<String> {
    let executable = if let Some(value) = selected.filter(|value| Path::new(value).is_file()) {
        value
    } else {
        path().await?
    };
    let result = run(&executable, &["--version".into()], None).await;
    result.stdout.lines().chain(result.stderr.lines()).find(|line| !line.trim().is_empty()).map(|line| line.trim().to_string())
}

pub async fn uninstall(installed: String) -> Result<OperationResult, String> {
    let installed = installed.trim().to_string();
    if installed.is_empty() || !Path::new(&installed).is_file() { return Err("所选 uv 路径不存在".into()); }
    let mut settings = crate::services::storage_service::read_settings().await?;
    let saved = settings.uv_path.clone();
    if !managed_uv_path(&installed) && saved.as_deref() != Some(installed.as_str()) {
        return Err("检测到的 uv 不在本程序管理的用户目录中，请使用原安装方式卸载".into());
    }
    let target = Path::new(&installed);
    tokio::fs::remove_file(target).await.map_err(|error| format!("卸载 uv 失败：{error}"))?;
    if let Some(parent) = target.parent() {
        for companion in ["uvx.exe", "uvx"] {
            let file = parent.join(companion);
            if file.is_file() { let _ = tokio::fs::remove_file(file).await; }
        }
    }
    if settings.uv_path.as_deref() == Some(installed.as_str()) {
        settings.uv_path = None;
        crate::services::storage_service::write_settings(&settings).await?;
    }
    Ok(OperationResult { ok: true, message: "uv 已卸载".into(), command: format!("remove {installed}"), output: installed })
}

pub async fn default_directory() -> String {
    if let Some(existing) = path().await {
        if let Some(parent) = Path::new(&existing).parent() { return parent.to_string_lossy().to_string(); }
    }
    PathBuf::from(std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).unwrap_or_default())
        .join(".local").join("bin").to_string_lossy().to_string()
}

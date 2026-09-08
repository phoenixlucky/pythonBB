use crate::domain::models::AppSettings;
use std::path::PathBuf;

fn settings_path() -> Result<PathBuf, String> {
    let base = dirs_path().ok_or_else(|| "无法定位应用数据目录".to_string())?;
    Ok(base.join("WJ Python Manager").join("settings.json"))
}

fn legacy_settings_path() -> Result<PathBuf, String> {
    let base = dirs_path().ok_or_else(|| "无法定位应用数据目录".to_string())?;
    Ok(base.join("WeiPython").join("settings.json"))
}

fn dirs_path() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))
        })
    }
}

pub async fn read_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    match tokio::fs::read_to_string(path).await {
        Ok(content) => serde_json::from_str(&content).map_err(|error| format!("设置文件损坏: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let legacy_path = legacy_settings_path()?;
            match tokio::fs::read_to_string(legacy_path).await {
                Ok(content) => serde_json::from_str(&content).map_err(|error| format!("设置文件损坏: {error}")),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(AppSettings::default()),
                Err(error) => Err(format!("读取旧设置失败: {error}")),
            }
        }
        Err(error) => Err(format!("读取设置失败: {error}")),
    }
}

pub async fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|error| format!("创建设置目录失败: {error}"))?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|error| format!("序列化设置失败: {error}"))?;
    let temporary_path = path.with_extension("json.tmp");
    tokio::fs::write(&temporary_path, content).await.map_err(|error| format!("写入设置失败: {error}"))?;
    tokio::fs::rename(temporary_path, path).await.map_err(|error| format!("保存设置失败: {error}"))
}

use crate::domain::models::{EnvironmentTarget, OperationResult, Package};
use crate::services::process_service::{failure, run};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
struct OutdatedPackage { name: String }

fn normalize_package_spec(package: &str) -> String {
    let trimmed = package.trim();
    let lower = trimmed.to_ascii_lowercase();
    for prefix in ["wei_data_shu.", "wei-data-shu."] {
        if let Some(extra) = lower.strip_prefix(prefix) {
            let extra = match extra {
                "excel" => "excel",
                "database" => "database",
                "analysis" => "analysis",
                "excel_client" | "excel-client" => "excel-client",
                _ => return trimmed.to_string(),
            };
            return format!("wei-data-shu[{extra}]");
        }
    }
    trimmed.to_string()
}

fn python_executable(path: &Path) -> String {
    if cfg!(windows) { path.join("python.exe") } else { path.join("bin").join("python") }.to_string_lossy().to_string()
}

fn target_path(target: &EnvironmentTarget) -> Result<String, String> {
    let path = target.path.as_ref().filter(|p| !p.trim().is_empty()).ok_or("缺少目标环境路径")?;
    let root = Path::new(path);
    Ok(if cfg!(windows) && target.target_type == "venv" {
        root.join("Scripts").join("python.exe").to_string_lossy().to_string()
    } else { python_executable(root) })
}

#[cfg(test)]
mod tests {
    #[test]
    fn venv_packages_use_the_venv_interpreter() {
        let target = crate::domain::models::EnvironmentTarget { target_type: "venv".into(), path: Some("sample-env".into()), ..Default::default() };
        let path = super::target_path(&target).unwrap();
        assert!(if cfg!(windows) { path.ends_with("Scripts\\python.exe") } else { path.ends_with("bin/python") });
    }

    #[test]
    fn normalizes_wei_data_shu_extra_syntax() {
        assert_eq!(super::normalize_package_spec("wei_data_shu.database"), "wei-data-shu[database]");
        assert_eq!(super::normalize_package_spec("wei-data-shu.excel_client"), "wei-data-shu[excel-client]");
        assert_eq!(super::normalize_package_spec("numpy"), "numpy");
    }

    #[tokio::test]
    #[ignore = "requires local Python installation; read-only integration check"]
    async fn local_package_details_are_readable() {
        let target = crate::domain::models::EnvironmentTarget { target_type: "conda".into(), name: Some("base".into()), path: Some("D:\\ProgramData\\miniconda3".into()), ..Default::default() };
        let result = super::execute(target, "show".into(), Some("pip".into()), Some("https://pypi.org/simple".into()), None).await;
        assert!(result.is_ok(), "package details failed: {result:?}");
    }
}

async fn run_pip(target: &EnvironmentTarget, args: Vec<String>) -> Result<crate::services::process_service::ProcessOutput, String> {
    let python = target_path(target)?;
    let (program, mut command_args) = if target.manager.as_deref() == Some("uv") {
        (crate::services::process_service::resolve_program("uv").await.ok_or("未检测到 uv，请先安装或在设置中配置 uv 路径")?, vec!["pip".into()])
    } else {
        (python, vec!["-m".into(), "pip".into()])
    };
    command_args.extend(args);
    if target.manager.as_deref() == Some("uv") { command_args.extend(["--python".into(), target_path(target)?]); }
    let result = run(&program, &command_args, None).await;
    if !result.ok && result.stderr.contains("No module named pip") {
        return Err("目标环境未安装 pip，请先执行 python -m ensurepip 或重新创建环境".into());
    }
    Ok(result)
}

fn output(result: crate::services::process_service::ProcessOutput, message: &str) -> OperationResult {
    OperationResult { ok: result.ok, message: message.into(), command: result.command, output: [result.stdout, result.stderr].into_iter().filter(|value| !value.is_empty()).collect::<Vec<_>>().join("\n") }
}

pub async fn list(target: EnvironmentTarget) -> Result<Vec<Package>, String> {
    let result = run_pip(&target, vec!["list".into(), "--format=json".into()]).await?;
    if !result.ok { return Err(failure(&result, "读取已安装包失败")); }
    serde_json::from_str(&result.stdout).map_err(|error| format!("解析 pip 包列表失败: {error}"))
}

async fn outdated_names(target: &EnvironmentTarget, index_url: Option<&str>) -> Result<Vec<String>, String> {
    let mut args = vec!["list".into(), "--outdated".into(), "--format=json".into()];
    if let Some(index) = index_url.filter(|value| !value.trim().is_empty()) {
        args.extend(["--index-url".into(), index.to_string()]);
    }
    let result = run_pip(target, args).await?;
    if !result.ok { return Err(failure(&result, "读取可升级包失败")); }
    serde_json::from_str::<Vec<OutdatedPackage>>(&result.stdout)
        .map(|packages| packages.into_iter().map(|package| package.name).collect())
        .map_err(|error| format!("解析可升级包列表失败: {error}"))
}

pub async fn execute(target: EnvironmentTarget, action: String, package_name: Option<String>, index_url: Option<String>, requirements_path: Option<String>) -> Result<OperationResult, String> {
    if let Some(index) = index_url.as_deref().filter(|v| !v.is_empty()) {
        if !index.starts_with("https://") && !index.starts_with("http://") { return Err("下载源必须使用 http:// 或 https://".into()); }
    }
    let mut args = match action.as_str() {
        "install" => vec!["install".into()],
        "upgrade" => vec!["install".into(), "--upgrade".into()],
        "uninstall" => if target.manager.as_deref() == Some("uv") { vec!["uninstall".into()] } else { vec!["uninstall".into(), "-y".into()] },
        "show" => vec!["show".into()],
        "latest" => vec!["index".into(), "versions".into()],
        "upgrade-pip" => vec!["install".into(), "--upgrade".into(), "pip".into()],
        "upgrade-all" => vec!["install".into(), "--upgrade".into()],
        "requirements" => vec!["install".into(), "-r".into(), requirements_path.ok_or_else(|| "缺少 requirements 文件路径".to_string())?],
        _ => return Err(format!("不支持的包操作: {action}")),
    };
    if !matches!(action.as_str(), "uninstall" | "show") {
        if let Some(index) = index_url.as_deref().filter(|value| !value.trim().is_empty()) { args.extend(["--index-url".into(), index.to_string()]); }
    }
    if action == "upgrade-all" {
        let names = outdated_names(&target, index_url.as_deref()).await?;
        if names.is_empty() {
            return Ok(OperationResult { ok: true, message: "所有包均已是最新版本".into(), command: "pip list --outdated".into(), output: "没有需要升级的包".into() });
        }
        args.extend(names);
    } else if action != "upgrade-pip" && action != "requirements" {
        let package = package_name.filter(|value| !value.trim().is_empty()).ok_or_else(|| "缺少包名".to_string())?;
        args.push(if matches!(action.as_str(), "install" | "upgrade") {
            normalize_package_spec(&package)
        } else {
            package
        });
    }
    let result = run_pip(&target, args).await?;
    if !result.ok { return Err(failure(&result, "包操作失败")); }
    Ok(output(result, "包操作完成"))
}

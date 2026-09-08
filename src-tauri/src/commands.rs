use crate::domain::models::{AppSettings, CondaEnvironment, EnvironmentTarget, OperationResult, Overview, Package, SetupStatus, VirtualEnvironment};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaCreateRequest {
    pub name: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    pub source_name: Option<String>,
    pub target_python_version: Option<String>,
    #[serde(default = "default_true")]
    pub clone_python: bool,
    #[serde(default = "default_true")]
    pub clone_packages: bool,
    pub python_version: Option<String>,
    pub channel: Option<String>,
    #[serde(default)]
    pub packages: Vec<String>,
}

fn default_mode() -> String { "python".into() }
fn default_true() -> bool { true }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaExportRequest { pub name: String, pub path: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaImportRequest { pub path: String, pub name: Option<String> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CondaExportAllRequest { pub directory: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VenvCreateRequest { pub name: String, pub target_path: String, pub python_path: Option<String>, pub manager: Option<String> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageActionRequest {
    pub target: EnvironmentTarget,
    pub action: String,
    pub package_name: Option<String>,
    pub index_url: Option<String>,
    pub requirements_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupRequest {
    pub install_path: String,
    pub python_version: String,
    pub conda_packages: Vec<String>,
    pub pip_packages: Vec<String>,
}

#[tauri::command]
pub async fn get_overview() -> Result<Overview, String> { crate::services::system_service::get_overview().await }

#[tauri::command]
pub fn get_active_processes() -> Vec<crate::services::process_service::ActiveProcess> { crate::services::process_service::active_processes() }

#[tauri::command]
pub async fn discover_python_versions() -> Result<Vec<String>, String> { Ok(crate::services::system_service::discover_python_versions().await) }


#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> { crate::services::storage_service::read_settings().await }

#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), String> { crate::services::storage_service::write_settings(&settings).await }

#[tauri::command]
pub async fn get_setup_status() -> Result<SetupStatus, String> { Ok(crate::services::setup_service::status().await) }

#[tauri::command]
pub async fn initialize_environment(install_path: String, python_version: String, conda_packages: Vec<String>, pip_packages: Vec<String>) -> Result<OperationResult, String> { crate::services::setup_service::initialize(install_path, python_version, conda_packages, pip_packages).await }

#[tauri::command]
pub fn start_initialize_environment(request: SetupRequest) -> crate::services::task_service::TaskSnapshot {
    crate::services::task_service::cleanup();
    crate::services::task_service::start("initialize", "正在初始化 Python 环境", async move {
        crate::services::setup_service::initialize(request.install_path, request.python_version, request.conda_packages, request.pip_packages).await
    })
}

#[tauri::command]
pub fn get_operation_task(task_id: String) -> Result<crate::services::task_service::TaskSnapshot, String> {
    crate::services::task_service::snapshot(&task_id).ok_or_else(|| "任务不存在或已过期".into())
}

#[tauri::command]
pub async fn list_conda_environments() -> Result<Vec<CondaEnvironment>, String> { crate::services::conda_service::list().await }

#[tauri::command]
pub async fn create_conda_environment(request: CondaCreateRequest) -> Result<OperationResult, String> {
    crate::services::conda_service::create(request.name, request.mode, request.source_name, request.target_python_version, request.clone_python, request.clone_packages, request.python_version, request.channel, request.packages).await
}

#[tauri::command]
pub async fn delete_conda_environment(name: String) -> Result<OperationResult, String> { crate::services::conda_service::remove(name).await }

#[tauri::command]
pub async fn export_conda_environment(request: CondaExportRequest) -> Result<OperationResult, String> { crate::services::conda_service::export(request.name, request.path).await }

#[tauri::command]
pub fn get_default_conda_export_path(name: String) -> String { crate::services::conda_service::default_export_file(&name) }

#[tauri::command]
pub fn get_default_conda_export_directory() -> String { crate::services::conda_service::default_export_directory() }

#[tauri::command]
pub fn get_default_virtual_environment_directory() -> String { crate::services::venv_service::default_directory() }

#[tauri::command]
pub async fn get_uv_path() -> Option<String> { crate::services::uv_service::path().await }

#[tauri::command]
pub async fn get_uv_paths() -> Vec<String> { crate::services::uv_service::paths().await }

#[tauri::command]
pub fn start_install_uv(version: Option<String>, install_directory: Option<String>) -> crate::services::task_service::TaskSnapshot {
    crate::services::task_service::cleanup();
    crate::services::task_service::start("uv-install", "正在安装 uv", async {
        crate::services::uv_service::install(version, install_directory).await
    })
}

#[tauri::command]
pub async fn get_uv_version(path: Option<String>) -> Option<String> { crate::services::uv_service::version(path).await }

#[tauri::command]
pub async fn get_uv_default_directory() -> String { crate::services::uv_service::default_directory().await }

#[tauri::command]
pub fn start_uninstall_uv(path: String) -> crate::services::task_service::TaskSnapshot {
    crate::services::task_service::cleanup();
    crate::services::task_service::start("uv-uninstall", "正在卸载 uv", async {
        crate::services::uv_service::uninstall(path).await
    })
}

#[tauri::command]
pub async fn export_all_conda_environments(request: CondaExportAllRequest) -> Result<OperationResult, String> { crate::services::conda_service::export_all(request.directory).await }

#[tauri::command]
pub async fn upgrade_conda() -> Result<OperationResult, String> { crate::services::conda_service::upgrade_conda().await }

#[tauri::command]
pub fn start_upgrade_conda() -> crate::services::task_service::TaskSnapshot {
    crate::services::task_service::cleanup();
    crate::services::task_service::start("conda-upgrade", "正在升级 Conda 核心", async {
        crate::services::conda_service::upgrade_conda().await
    })
}

#[tauri::command]
pub async fn import_conda_environment(request: CondaImportRequest) -> Result<OperationResult, String> { crate::services::conda_service::import(request.path, request.name).await }

#[tauri::command]
pub async fn search_conda_python_versions(version: String, channel: String) -> Result<Vec<String>, String> { crate::services::conda_service::search_python(version, channel).await }

#[tauri::command]
pub async fn refresh_conda_python_versions(version: String, channel: String) -> Result<Vec<String>, String> { crate::services::conda_service::refresh_python(version, channel).await }

#[tauri::command]
pub async fn upgrade_conda_python(name: String, version: String, channel: String) -> Result<OperationResult, String> { crate::services::conda_service::upgrade_python(name, version, channel).await }

#[tauri::command]
pub fn start_upgrade_conda_python(name: String, version: String, channel: String) -> crate::services::task_service::TaskSnapshot {
    crate::services::task_service::cleanup();
    crate::services::task_service::start("python-upgrade", "正在升级 Conda 环境 Python", async move {
        crate::services::conda_service::upgrade_python(name, version, channel).await
    })
}

#[tauri::command]
pub async fn list_virtual_environments(last_directory: Option<String>) -> Result<Vec<VirtualEnvironment>, String> { Ok(crate::services::venv_service::list(last_directory).await) }

#[tauri::command]
pub async fn create_virtual_environment(request: VenvCreateRequest) -> Result<OperationResult, String> { crate::services::venv_service::create(request.name, request.target_path, request.python_path, request.manager).await }

#[tauri::command]
pub async fn delete_virtual_environment(path: String) -> Result<OperationResult, String> { crate::services::venv_service::remove(path).await }

#[tauri::command]
pub async fn list_packages(target: EnvironmentTarget) -> Result<Vec<Package>, String> { crate::services::package_service::list(target).await }

#[tauri::command]
pub async fn package_action(request: PackageActionRequest) -> Result<OperationResult, String> {
    crate::services::package_service::execute(request.target, request.action, request.package_name, request.index_url, request.requirements_path).await
}

#[tauri::command]
pub fn start_package_action(request: PackageActionRequest) -> crate::services::task_service::TaskSnapshot {
    crate::services::task_service::cleanup();
    crate::services::task_service::start("package", "正在执行包管理操作", async move {
        crate::services::package_service::execute(request.target, request.action, request.package_name, request.index_url, request.requirements_path).await
    })
}

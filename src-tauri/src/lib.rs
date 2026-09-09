mod commands;
mod domain;
mod services;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_overview,
            commands::get_active_processes,
            commands::discover_python_versions,
            commands::can_upgrade_system_python,
            commands::start_uninstall_python,
            commands::start_upgrade_python,
            commands::get_settings,
            commands::save_settings,
            commands::get_setup_status,
            commands::initialize_environment,
            commands::start_initialize_environment,
            commands::get_operation_task,
            commands::cancel_operation_task,
            commands::list_conda_environments,
            commands::create_conda_environment,
            commands::delete_conda_environment,
            commands::export_conda_environment,
            commands::get_default_conda_export_path,
            commands::get_default_conda_export_directory,
            commands::get_default_virtual_environment_directory,
            commands::get_uv_path,
            commands::get_uv_paths,
            commands::get_uv_python_installations,
            commands::get_uv_version,
            commands::get_uv_default_directory,
            commands::start_install_uv,
            commands::start_uninstall_uv,
            commands::start_uninstall_uv_python,
            commands::export_all_conda_environments,
            commands::upgrade_conda,
            commands::start_upgrade_conda,
            commands::import_conda_environment,
            commands::search_conda_python_versions,
            commands::refresh_conda_python_versions,
            commands::upgrade_conda_python,
            commands::start_upgrade_conda_python,
            commands::list_virtual_environments,
            commands::create_virtual_environment,
            commands::start_export_uv_environment,
            commands::start_import_uv_environment,
            commands::delete_virtual_environment,
            commands::list_packages,
            commands::package_action,
            commands::start_package_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running WJ Python管理大师");
}

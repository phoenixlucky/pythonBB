pub mod models {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct RuntimeInfo {
        pub python: String,
        pub conda: String,
        pub platform: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct CondaEnvironment {
        pub name: String,
        pub prefix: String,
        pub python: String,
        pub package_count: usize,
        pub active: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Overview {
        pub runtime: RuntimeInfo,
        pub environments: Vec<CondaEnvironment>,
        pub checked_at: String,
    }

    #[derive(Debug, Clone, Default, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct AppSettings {
        pub uv_path: Option<String>,
        pub conda_path: Option<String>,
        pub tagline: Option<String>,
        pub compact_mode: Option<bool>,
        pub wallpaper: Option<String>,
        pub primary: Option<String>,
        pub secondary: Option<String>,
        pub ink: Option<String>,
    }

    #[derive(Debug, Clone, Default, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct EnvironmentTarget {
        pub target_type: String,
        pub name: Option<String>,
        pub path: Option<String>,
        pub manager: Option<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct VirtualEnvironment {
        pub name: String,
        pub path: String,
        pub manager: String,
        pub python_version: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct UvPythonInstallation {
        pub version: String,
        pub path: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Package {
        pub name: String,
        pub version: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct OperationResult {
        pub ok: bool,
        pub message: String,
        pub command: String,
        pub output: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct SetupStatus {
        pub conda_available: bool,
        pub conda_path: Option<String>,
        pub recommended_install_path: String,
        pub environment_count: usize,
        pub platform_supported: bool,
        pub conda_version: Option<String>,
        pub base_python_version: Option<String>,
        pub root_prefix: Option<String>,
    }
}

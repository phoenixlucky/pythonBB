use crate::domain::models::{Overview, RuntimeInfo};
use crate::services::conda_service;
use crate::services::process_service::{resolve_program, run};
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

#[cfg(test)]
mod tests {
    use super::parse_python_launcher_paths;

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
}

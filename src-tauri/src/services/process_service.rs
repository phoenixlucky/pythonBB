use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use serde::Serialize;
use tokio::process::Command;
use std::process::Stdio;
use tokio::io::{AsyncRead, AsyncReadExt};

async fn capture(mut stream: impl AsyncRead + Unpin) -> std::io::Result<Vec<u8>> {
    let mut output = Vec::new();
    let mut buffer = [0u8; 4096];
    loop {
        let length = stream.read(&mut buffer).await?;
        if length == 0 { break; }
        crate::services::task_service::append_output(&String::from_utf8_lossy(&buffer[..length]));
        output.extend_from_slice(&buffer[..length]);
    }
    Ok(output)
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveProcess {
    pub pid: u32,
    pub command: String,
    pub started_at: u64,
}

static ACTIVE_PROCESSES: OnceLock<Mutex<HashMap<u32, ActiveProcess>>> = OnceLock::new();

fn active_store() -> &'static Mutex<HashMap<u32, ActiveProcess>> { ACTIVE_PROCESSES.get_or_init(|| Mutex::new(HashMap::new())) }

#[derive(Debug)]
pub struct ProcessOutput {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
    pub command: String,
}

fn quote_arg(value: &str) -> String {
    if value.is_empty() || value.chars().any(|character| character.is_whitespace() || "&|<>^".contains(character)) {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

fn command_line(program: &str, args: &[String]) -> String {
    std::iter::once(quote_arg(program)).chain(args.iter().map(|value| quote_arg(value))).collect::<Vec<_>>().join(" ")
}

fn needs_cmd(program: &str) -> bool {
    cfg!(windows) && matches!(Path::new(program).extension().and_then(|extension| extension.to_str()), Some("bat" | "cmd"))
}

pub async fn run(program: &str, args: &[String], cwd: Option<&Path>) -> ProcessOutput {
    run_with_env(program, args, cwd, &[]).await
}

pub async fn run_with_env(program: &str, args: &[String], cwd: Option<&Path>, envs: &[(&str, &str)]) -> ProcessOutput {
    let display = command_line(program, args);
    let mut command = if needs_cmd(program) {
        let mut shell = Command::new("cmd.exe");
        shell.args(["/D", "/S", "/C"]).arg(&display);
        shell
    } else {
        let mut direct = Command::new(program);
        direct.args(args);
        direct
    };
    if let Some(directory) = cwd {
        command.current_dir(directory);
    }
    for (key, value) in envs { command.env(key, value); }
    command.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => return ProcessOutput { ok: false, stdout: String::new(), stderr: error.to_string(), command: display },
    };
    let pid = child.id();
    if let Some(pid) = pid {
        let _ = active_store().lock().map(|mut processes| processes.insert(pid, ActiveProcess { pid, command: display.clone(), started_at: unix_now() }));
    }
    crate::services::task_service::append_output(&format!("\n$ {display}\n"));
    let Some(stdout) = child.stdout.take() else {
        let _ = child.kill().await;
        return ProcessOutput { ok: false, stdout: String::new(), stderr: "无法打开命令标准输出管道".into(), command: display };
    };
    let Some(stderr) = child.stderr.take() else {
        let _ = child.kill().await;
        return ProcessOutput { ok: false, stdout: String::new(), stderr: "无法打开命令错误输出管道".into(), command: display };
    };
    let seconds = if args.iter().any(|arg| arg == "--version" || arg == "-0p") || program.ends_with("where.exe") { 15 } else if args.iter().any(|arg| arg == "--json") && args.iter().any(|arg| arg == "list") { 60 } else if args.iter().any(|arg| arg == "search") { 120 } else { 3600 };
    let result = tokio::time::timeout(std::time::Duration::from_secs(seconds), async {
        let (status, stdout, stderr) = tokio::try_join!(child.wait(), capture(stdout), capture(stderr))?;
        Ok::<_, std::io::Error>(std::process::Output { status, stdout, stderr })
    }).await.unwrap_or_else(|_| Err(std::io::Error::new(std::io::ErrorKind::TimedOut, format!("命令超时（{seconds} 秒）：{display}"))));
    if result.is_err() { let _ = child.kill().await; }
    if let Some(pid) = pid { let _ = active_store().lock().map(|mut processes| processes.remove(&pid)); }
    match result {
        Ok(output) => ProcessOutput {
            ok: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            command: display,
        },
        Err(error) => ProcessOutput { ok: false, stdout: String::new(), stderr: error.to_string(), command: display },
    }
}

fn unix_now() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|duration| duration.as_secs()).unwrap_or_default() }

pub fn active_processes() -> Vec<ActiveProcess> { active_store().lock().map(|processes| processes.values().cloned().collect()).unwrap_or_default() }

pub async fn resolve_program(name: &str) -> Option<String> {
    if name.eq_ignore_ascii_case("uv") {
        if let Some(path) = crate::services::storage_service::read_settings().await.ok().and_then(|s| s.uv_path) {
            if Path::new(&path).is_file() { return Some(path); }
        }
    }
    if name.eq_ignore_ascii_case("conda") {
        if let Some(path) = crate::services::storage_service::read_settings().await.ok().and_then(|s| s.conda_path).filter(|p| !p.trim().is_empty()) {
            if Path::new(&path).is_file() { return Some(path); }
        }
    }
    if Path::new(name).is_file() {
        return Some(name.to_string());
    }
    let lookup = if cfg!(windows) { "where.exe" } else { "which" };
    let output = run(lookup, &[name.to_string()], None).await;
    if let Some(path) = output.stdout.lines().find(|line| !line.trim().is_empty() && !line.to_ascii_lowercase().contains("\\windowsapps\\")) {
        let path = PathBuf::from(path.trim());
        if name.eq_ignore_ascii_case("conda") {
            if let Some(executable) = native_conda_executable(&path) {
                return Some(executable.to_string_lossy().to_string());
            }
        }
        return Some(path.to_string_lossy().to_string());
    }
    for candidate in fallback_programs(name).await {
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    if name.eq_ignore_ascii_case("python") {
        let launcher = PathBuf::from("C:\\Windows\\py.exe");
        if launcher.is_file() {
            let output = run(launcher.to_string_lossy().as_ref(), &["-c".into(), "import sys; print(sys.executable)".into()], None).await;
            if output.ok {
                if let Some(path) = output.stdout.lines().map(str::trim).find(|path| Path::new(path).is_file() && !path.to_ascii_lowercase().contains("\\windowsapps\\")) {
                    return Some(path.to_string());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod process_tests {
    use super::*;

    #[tokio::test]
    async fn captures_both_streams_and_failure() {
        let (program, args) = if cfg!(windows) {
            ("cmd.exe", vec!["/D".into(), "/C".into(), "echo captured-out & echo captured-err 1>&2 & exit /b 7".into()])
        } else {
            ("sh", vec!["-c".into(), "echo captured-out; echo captured-err >&2; exit 7".into()])
        };
        let result = run(program, &args, None).await;
        assert!(!result.ok);
        assert!(result.stdout.contains("captured-out"));
        assert!(result.stderr.contains("captured-err"));
    }

    #[tokio::test]
    async fn missing_command_has_actionable_error() {
        let result = run("wj-nonexistent-command-752991", &[], None).await;
        assert!(!result.ok);
        assert!(!result.stderr.is_empty());
    }
}

fn native_conda_executable(path: &Path) -> Option<PathBuf> {
    if !cfg!(windows) || !path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("bat")) {
        return None;
    }
    let root = path.parent()?.parent()?;
    let executable = root.join("Scripts").join("conda.exe");
    executable.is_file().then_some(executable)
}

async fn fallback_programs(name: &str) -> Vec<PathBuf> {
    if !cfg!(windows) && !name.eq_ignore_ascii_case("uv") {
        return Vec::new();
    }
    let mut candidates = Vec::new();
    if name.eq_ignore_ascii_case("conda") {
        if let Some(value) = std::env::var_os("CONDA_EXE") { candidates.push(PathBuf::from(value)); }
        if let Some(prefix) = std::env::var_os("CONDA_PREFIX") {
            let prefix = PathBuf::from(prefix);
            candidates.push(prefix.join("Scripts").join("conda.exe"));
            candidates.push(prefix.join("condabin").join("conda.bat"));
        }
        for root in ["C:\\ProgramData", "D:\\ProgramData"] {
            for folder in ["miniconda3", "Anaconda3", "miniconda", "anaconda"] {
                candidates.push(PathBuf::from(root).join(folder).join("Scripts").join("conda.exe"));
                candidates.push(PathBuf::from(root).join(folder).join("condabin").join("conda.bat"));
            }
        }
        for variable in ["LOCALAPPDATA", "USERPROFILE"] {
            if let Some(root) = std::env::var_os(variable) {
                for folder in ["miniconda3", "Anaconda3", "miniconda", "anaconda3"] {
                    candidates.push(PathBuf::from(&root).join(folder).join("Scripts").join("conda.exe"));
                    candidates.push(PathBuf::from(&root).join(folder).join("condabin").join("conda.bat"));
                }
            }
        }
    } else if name.eq_ignore_ascii_case("python") {
        if let Some(prefix) = std::env::var_os("CONDA_PREFIX") { candidates.push(PathBuf::from(prefix).join("python.exe")); }
        for root in ["C:\\ProgramData", "D:\\ProgramData"] {
            for folder in ["miniconda3", "Anaconda3", "miniconda", "anaconda"] {
                candidates.push(PathBuf::from(root).join(folder).join("python.exe"));
            }
        }
        for root in ["C:\\Python313", "C:\\Python312", "D:\\Python313", "D:\\Python312"] {
            candidates.push(PathBuf::from(root).join("python.exe"));
        }
        if let Some(root) = std::env::var_os("LOCALAPPDATA") {
            candidates.push(PathBuf::from(root.clone()).join("Programs").join("Python").join("Python313").join("python.exe"));
            candidates.push(PathBuf::from(root).join("Programs").join("Python").join("Python312").join("python.exe"));
        }
        candidates.push(PathBuf::from("C:\\Windows\\py.exe"));
    } else if name.eq_ignore_ascii_case("uv") {
        if let Some(root) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
            let root = PathBuf::from(root);
            let executable = if cfg!(windows) { "uv.exe" } else { "uv" };
            candidates.push(root.join(".local").join("bin").join(executable));
            candidates.push(root.join(".cargo").join("bin").join(executable));
        }
        if let Some(root) = std::env::var_os("LOCALAPPDATA") {
            let root = PathBuf::from(root);
            candidates.push(root.join("uv").join("uv.exe"));
            candidates.push(root.join("bin").join("uv.exe"));
        }
    }
    candidates
}

pub fn failure(output: &ProcessOutput, fallback: &str) -> String {
    if !output.stderr.trim().is_empty() { output.stderr.clone() }
    else if !output.stdout.trim().is_empty() { output.stdout.clone() }
    else { fallback.to_string() }
}

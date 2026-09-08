use crate::domain::models::OperationResult;
use serde::Serialize;
use std::collections::HashMap;
use std::future::Future;
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSnapshot {
    pub task_id: String,
    pub task_type: String,
    pub status: String,
    pub message: String,
    pub progress: u8,
    pub output: String,
    pub command: String,
    pub started_at: u64,
    pub finished_at: Option<u64>,
}

type TaskRef = Arc<Mutex<TaskSnapshot>>;
static TASKS: OnceLock<Mutex<HashMap<String, TaskRef>>> = OnceLock::new();
static NEXT_ID: OnceLock<Mutex<u64>> = OnceLock::new();
tokio::task_local! { static CURRENT_TASK: TaskRef; }

pub fn append_output(value: &str) {
    let _ = CURRENT_TASK.try_with(|reference| {
        if let Ok(mut task) = reference.lock() {
            task.output.push_str(value);
            if task.output.len() > 500_000 {
                let mut split = task.output.len() - 400_000;
                while !task.output.is_char_boundary(split) { split += 1; }
                task.output.drain(..split);
            }
        }
    });
}

fn task_store() -> &'static Mutex<HashMap<String, TaskRef>> { TASKS.get_or_init(|| Mutex::new(HashMap::new())) }
fn next_id() -> u64 {
    let mut value = NEXT_ID.get_or_init(|| Mutex::new(0)).lock().expect("task id lock poisoned");
    *value += 1;
    *value
}
fn now() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|value| value.as_secs()).unwrap_or_default() }
fn make_id() -> String { format!("{}-{}", now(), next_id()) }

pub fn start<F>(task_type: &str, message: &str, operation: F) -> TaskSnapshot
where
    F: Future<Output = Result<OperationResult, String>> + Send + 'static,
{
    let initial = TaskSnapshot {
        task_id: make_id(),
        task_type: task_type.to_string(),
        status: "running".into(),
        message: message.into(),
        progress: 5,
        output: String::new(),
        command: String::new(),
        started_at: now(),
        finished_at: None,
    };
    let task_id = initial.task_id.clone();
    let task_ref = Arc::new(Mutex::new(initial));
    task_store().lock().expect("task store lock poisoned").insert(task_id.clone(), task_ref.clone());
    tauri::async_runtime::spawn(async move {
        let result = CURRENT_TASK.scope(task_ref.clone(), operation).await;
        let mut task = task_ref.lock().expect("task lock poisoned");
        task.finished_at = Some(now());
        match result {
            Ok(value) => {
                task.status = "completed".into();
                task.message = value.message;
                task.progress = 100;
                task.command = value.command;
                if task.output.trim().is_empty() { task.output = value.output; }
            }
            Err(error) => {
                task.status = "failed".into();
                task.message = error.clone();
                task.progress = 100;
                if task.output.trim().is_empty() { task.output = error; }
            }
        }
    });
    snapshot(&task_id).expect("new task must be available")
}

pub fn snapshot(task_id: &str) -> Option<TaskSnapshot> {
    task_store().lock().ok()?.get(task_id)?.lock().ok().map(|task| task.clone())
}

pub fn cleanup() {
    let cutoff = now().saturating_sub(3600);
    if let Ok(mut tasks) = task_store().lock() {
        tasks.retain(|_, task| task.lock().map(|value| value.finished_at.unwrap_or(u64::MAX) > cutoff).unwrap_or(false));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_from_a_synchronous_command_without_tokio_context() {
        let task = start("regression", "starting", async { Err("expected failure".into()) });
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            let current = snapshot(&task.task_id).unwrap();
            if current.status != "running" {
                assert_eq!(current.status, "failed");
                assert_eq!(current.message, "expected failure");
                break;
            }
            assert!(std::time::Instant::now() < deadline, "task did not finish");
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

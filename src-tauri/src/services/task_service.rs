use crate::domain::models::OperationResult;
use serde::Serialize;
use std::collections::HashMap;
use std::future::Future;
use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex, OnceLock};

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
struct TaskEntry {
    snapshot: TaskRef,
    cancel: Arc<AtomicBool>,
}

struct TaskContext {
    snapshot: TaskRef,
    cancel: Arc<AtomicBool>,
    task_id: String,
}

static TASKS: OnceLock<Mutex<HashMap<String, TaskEntry>>> = OnceLock::new();
static NEXT_ID: OnceLock<Mutex<u64>> = OnceLock::new();
tokio::task_local! { static CURRENT_TASK: TaskContext; }

pub fn append_output(value: &str) {
    let _ = CURRENT_TASK.try_with(|context| {
        if let Ok(mut task) = context.snapshot.lock() {
            task.output.push_str(value);
            if task.output.len() > 500_000 {
                let mut split = task.output.len() - 400_000;
                while !task.output.is_char_boundary(split) { split += 1; }
                task.output.drain(..split);
            }
        }
    });
}

pub fn current_task_id() -> Option<String> { CURRENT_TASK.try_with(|context| context.task_id.clone()).ok() }
pub fn is_cancelled() -> bool { CURRENT_TASK.try_with(|context| context.cancel.load(Ordering::Relaxed)).unwrap_or(false) }

fn task_store() -> &'static Mutex<HashMap<String, TaskEntry>> { TASKS.get_or_init(|| Mutex::new(HashMap::new())) }
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
    let cancel = Arc::new(AtomicBool::new(false));
    let task_id_for_task = task_id.clone();
    task_store().lock().expect("task store lock poisoned").insert(task_id.clone(), TaskEntry { snapshot: task_ref.clone(), cancel: cancel.clone() });
    tauri::async_runtime::spawn(async move {
        let result = CURRENT_TASK.scope(TaskContext { snapshot: task_ref.clone(), cancel: cancel.clone(), task_id: task_id_for_task }, operation).await;
        let mut task = task_ref.lock().expect("task lock poisoned");
        task.finished_at = Some(now());
        if cancel.load(Ordering::Relaxed) {
            task.status = "cancelled".into();
            task.message = "任务已取消".into();
            task.progress = 100;
            if task.output.trim().is_empty() { task.output = "任务已取消".into(); }
        } else { match result {
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
        }}
    });
    snapshot(&task_id).expect("new task must be available")
}

pub fn snapshot(task_id: &str) -> Option<TaskSnapshot> {
    task_store().lock().ok()?.get(task_id)?.snapshot.lock().ok().map(|task| task.clone())
}

pub fn cancel(task_id: &str) -> Result<(), String> {
    let cancel = {
        let tasks = task_store().lock().map_err(|_| "任务状态锁已损坏".to_string())?;
        let entry = tasks.get(task_id).ok_or_else(|| "任务不存在或已过期".to_string())?;
        if entry.snapshot.lock().map(|task| task.status != "running").unwrap_or(true) { return Ok(()); }
        entry.cancel.clone()
    };
    cancel.store(true, Ordering::Relaxed);
    crate::services::process_service::terminate_task_processes(task_id);
    if let Ok(tasks) = task_store().lock() {
        if let Some(entry) = tasks.get(task_id) {
            if let Ok(mut task) = entry.snapshot.lock() { task.message = "正在取消任务…".into(); }
        }
    }
    Ok(())
}

pub fn cleanup() {
    let cutoff = now().saturating_sub(3600);
    if let Ok(mut tasks) = task_store().lock() {
        tasks.retain(|_, entry| entry.snapshot.lock().map(|value| value.finished_at.unwrap_or(u64::MAX) > cutoff).unwrap_or(false));
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

    #[test]
    fn cancellation_marks_a_running_task_as_cancelled() {
        let task = start("regression-cancel", "starting", async {
            loop {
                if is_cancelled() { return Err("stopped".into()); }
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
            }
        });
        cancel(&task.task_id).expect("task cancellation should be accepted");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            let current = snapshot(&task.task_id).unwrap();
            if current.status != "running" {
                assert_eq!(current.status, "cancelled");
                break;
            }
            assert!(std::time::Instant::now() < deadline, "cancelled task did not finish");
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

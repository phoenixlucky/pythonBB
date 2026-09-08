import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { invokeCommand } from "@/lib/tauri";
import type { ActiveProcess, CondaEnvironment, EnvironmentTarget, OperationResult, PackageInfo, TaskSnapshot, VirtualEnvironment } from "@/types";

export const useWorkspaceStore = defineStore("workspace", () => {
  const conda = ref<CondaEnvironment[]>([]);
  const venvs = ref<VirtualEnvironment[]>([]);
  const packages = ref<PackageInfo[]>([]);
  const selectedTarget = ref<EnvironmentTarget | null>(null);
  const pythonVersions = ref<string[]>([]);
  const pending = ref(0);
  const busy = computed(() => pending.value > 0);
  const message = ref("");
  const error = ref("");
  const output = ref("");
  const activeProcesses = ref<ActiveProcess[]>([]);
  const currentTask = ref<TaskSnapshot | null>(null);
  const targets = computed<EnvironmentTarget[]>(() => [
    ...conda.value.map((item) => ({ targetType: "conda", name: item.name, path: item.prefix })),
    ...venvs.value.map((item) => ({ targetType: "venv", name: item.name, path: item.path, manager: item.manager })),
  ]);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    pending.value++;
    error.value = "";
    try { return await action(); }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
    finally { pending.value--; }
  }

  function showResult(result: OperationResult) {
    message.value = result.message;
    output.value = [result.command, result.output].filter(Boolean).join("\n\n");
  }

  async function loadConda() { const value = await run(() => invokeCommand<CondaEnvironment[]>("list_conda_environments")); if (value) conda.value = value; }
  async function loadVenvs() { const value = await run(() => invokeCommand<VirtualEnvironment[]>("list_virtual_environments")); if (value) venvs.value = value; }
  async function loadPythonVersions() { const value = await run(() => invokeCommand<string[]>("discover_python_versions")); if (value) pythonVersions.value = value; }
  async function createConda(payload: Record<string, unknown>) { const value = await run(() => invokeCommand<OperationResult>("create_conda_environment", { request: payload })); if (value) { showResult(value); await loadConda(); } }
  async function deleteConda(name: string) { const value = await run(() => invokeCommand<OperationResult>("delete_conda_environment", { name })); if (value) { showResult(value); await loadConda(); } }
  async function exportConda(payload: Record<string, unknown>) { const value = await run(() => invokeCommand<OperationResult>("export_conda_environment", { request: payload })); if (value) showResult(value); }
  async function exportAllConda(directory: string) { const value = await run(() => invokeCommand<OperationResult>("export_all_conda_environments", { request: { directory } })); if (value) showResult(value); }
  async function upgradeConda() { return runTask(() => invokeCommand<TaskSnapshot>("start_upgrade_conda")); }
  async function installUv(version = "", installDirectory = "") { return runTask(() => invokeCommand<TaskSnapshot>("start_install_uv", { version: version.trim() || null, installDirectory: installDirectory.trim() || null })); }
  async function uninstallUv(path = "") { return runTask(() => invokeCommand<TaskSnapshot>("start_uninstall_uv", { path })); }
  async function importConda(payload: Record<string, unknown>) { const value = await run(() => invokeCommand<OperationResult>("import_conda_environment", { request: payload })); if (value) { showResult(value); await loadConda(); } }
  async function createVenv(payload: Record<string, unknown>) { const value = await run(() => invokeCommand<OperationResult>("create_virtual_environment", { request: payload })); if (value) { showResult(value); await loadVenvs(); } }
  async function deleteVenv(path: string) { const value = await run(() => invokeCommand<OperationResult>("delete_virtual_environment", { path })); if (value) { showResult(value); await loadVenvs(); } }
  async function loadPackages(target: EnvironmentTarget) { selectedTarget.value = target; const value = await run(() => invokeCommand<PackageInfo[]>("list_packages", { target })); if (value) packages.value = value; }
  async function loadProcesses() { activeProcesses.value = await invokeCommand<ActiveProcess[]>("get_active_processes"); }
  const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  async function waitForTask(initial: TaskSnapshot): Promise<TaskSnapshot> {
    let task = initial;
    currentTask.value = task;
    while (task.status === "running") {
      await delay(500);
      task = await invokeCommand<TaskSnapshot>("get_operation_task", { taskId: task.taskId });
      currentTask.value = task;
      output.value = [task.command, task.output].filter(Boolean).join("\n\n");
      await loadProcesses().catch(() => undefined);
    }
    if (task.status === "completed") {
      message.value = task.message;
      error.value = "";
    } else {
      error.value = task.message || "后台任务失败";
      message.value = "";
    }
    return task;
  }
  async function runTask(start: () => Promise<TaskSnapshot>): Promise<TaskSnapshot | undefined> {
    pending.value++;
    error.value = "";
    try { return await waitForTask(await start()); }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); return undefined; }
    finally { pending.value--; }
  }
  async function startSetup(payload: Record<string, unknown>) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_initialize_environment", { request: payload })); if (task?.status === "completed") await refreshAll(); }
  async function startPythonUpgrade(name: string, version: string, channel: string) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_upgrade_conda_python", { name, version, channel })); if (task?.status === "completed") await loadConda(); }
  async function packageAction(payload: Record<string, unknown>) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_package_action", { request: payload })); if (task?.status === "completed" && selectedTarget.value) await loadPackages(selectedTarget.value); }
  function clearLog() { message.value = ""; error.value = ""; output.value = ""; currentTask.value = null; }

  async function refreshAll() { await Promise.all([loadConda(), loadVenvs(), loadPythonVersions()]); }
  return { conda, venvs, packages, selectedTarget, pythonVersions, targets, busy, message, error, output, activeProcesses, currentTask, loadConda, loadVenvs, loadPythonVersions, loadProcesses, createConda, deleteConda, exportConda, exportAllConda, upgradeConda, installUv, uninstallUv, importConda, createVenv, deleteVenv, loadPackages, packageAction, startSetup, startPythonUpgrade, clearLog, refreshAll };
});

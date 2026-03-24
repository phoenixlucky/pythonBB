import crypto from "node:crypto";
import { runCommand, runStreamingCommand } from "../utils/process.js";
import { resolvePythonExecutable, runCondaCommand } from "./environment-service.js";

const latestVersionCache = new Map();
const LATEST_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
const packageTasks = new Map();
const PACKAGE_TASK_TTL_MS = 30 * 60 * 1000;
const MAX_TASK_LOG_LENGTH = 120000;

function cleanupPackageTasks() {
  const now = Date.now();
  for (const [taskId, task] of packageTasks.entries()) {
    const finishedAtMs = task.finishedAt ? Date.parse(task.finishedAt) : NaN;
    if (Number.isFinite(finishedAtMs) && now - finishedAtMs > PACKAGE_TASK_TTL_MS) {
      packageTasks.delete(taskId);
    }
  }
}

function createPackageTaskSnapshot(task) {
  return {
    taskId: task.taskId,
    status: task.status,
    packageName: task.packageName,
    upgrade: task.upgrade,
    target: task.target,
    message: task.message,
    output: task.output,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt
  };
}

function appendTaskOutput(task, chunk, source = "stdout") {
  const normalized = String(chunk || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) {
    return;
  }

  const prefix = source === "stderr" ? "[stderr] " : "";
  task.output += normalized
    .split("\n")
    .map((line, index, lines) => {
      if (!line && index === lines.length - 1) {
        return "";
      }
      return `${prefix}${line}`;
    })
    .join("\n");

  if (task.output.length > MAX_TASK_LOG_LENGTH) {
    task.output = `[日志过长，已截断早期输出]\n${task.output.slice(-MAX_TASK_LOG_LENGTH)}`;
  }
}

export async function listPackages(target, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "list", "--format=json"], { timeoutMs: 15000 });
  if (!result.ok) {
    throw new Error(result.stderr || "获取包列表失败");
  }

  return JSON.parse(result.stdout || "[]").sort((a, b) => a.name.localeCompare(b.name));
}

export async function installPackage(target, packageName, upgrade = false, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const args = ["-m", "pip", "install"];
  if (upgrade) {
    args.push("--upgrade");
  }
  args.push(packageName);
  const result = await runCommand(pythonExecutable, args, { timeoutMs: 60000 });
  if (!result.ok) {
    throw new Error(result.stderr || "安装包失败");
  }
  return { message: `包 '${packageName}' 安装成功` };
}

export async function startInstallPackageTask(target, packageName, upgrade = false, preferredRoot = "") {
  cleanupPackageTasks();

  const normalizedName = String(packageName || "").trim();
  if (!normalizedName) {
    throw new Error("缺少包名");
  }

  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const args = ["-m", "pip", "install"];
  if (upgrade) {
    args.push("--upgrade");
  }
  args.push(normalizedName);

  const task = {
    taskId: crypto.randomUUID(),
    status: "running",
    packageName: normalizedName,
    upgrade: Boolean(upgrade),
    target,
    message: upgrade ? `正在升级包 '${normalizedName}'` : `正在安装包 '${normalizedName}'`,
    output: [
      `命令: ${pythonExecutable} ${args.join(" ")}`,
      `目标环境: ${target.type}${target.name ? ` / ${target.name}` : ""}`,
      ""
    ].join("\n"),
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  packageTasks.set(task.taskId, task);

  void (async () => {
    try {
      const result = await runStreamingCommand(pythonExecutable, args, {
        timeoutMs: 300000,
        onStdout: (text) => appendTaskOutput(task, text, "stdout"),
        onStderr: (text) => appendTaskOutput(task, text, "stderr")
      });

      task.finishedAt = new Date().toISOString();
      if (!result.ok) {
        task.status = "failed";
        task.message = result.stderr || result.stdout || "安装包失败";
        if (!task.output.includes(task.message)) {
          appendTaskOutput(task, `\n${task.message}\n`, "stderr");
        }
        return;
      }

      task.status = "completed";
      task.message = upgrade ? `包 '${normalizedName}' 升级成功` : `包 '${normalizedName}' 安装成功`;
      if (!task.output.endsWith("\n")) {
        task.output += "\n";
      }
      task.output += `${task.message}\n`;
    } catch (error) {
      task.status = "failed";
      task.message = error.message || "安装包失败";
      task.finishedAt = new Date().toISOString();
      appendTaskOutput(task, `\n${task.message}\n`, "stderr");
    }
  })();

  return createPackageTaskSnapshot(task);
}

export function getPackageTask(taskId) {
  cleanupPackageTasks();

  const task = packageTasks.get(taskId);
  if (!task) {
    throw new Error("安装任务不存在或已过期");
  }

  return createPackageTaskSnapshot(task);
}

async function listOutdatedPackages(pythonExecutable) {
  const result = await runCommand(
    pythonExecutable,
    ["-m", "pip", "list", "--outdated", "--format=json"],
    { timeoutMs: 30000 }
  );
  if (!result.ok) {
    throw new Error(result.stderr || "获取可升级包列表失败");
  }

  return JSON.parse(result.stdout || "[]");
}

export async function uninstallPackage(target, packageName, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "uninstall", packageName, "-y"], { timeoutMs: 30000 });
  if (!result.ok) {
    throw new Error(result.stderr || "卸载包失败");
  }
  return { message: `包 '${packageName}' 卸载成功` };
}

export async function showPackageInfo(target, packageName, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "show", packageName], { timeoutMs: 10000 });
  if (!result.ok) {
    throw new Error(result.stderr || "无法获取包信息");
  }
  return { content: result.stdout };
}

export async function getLatestPackageVersion(packageName) {
  const normalizedName = String(packageName || "").trim();
  if (!normalizedName) {
    throw new Error("缺少包名");
  }

  const cacheKey = normalizedName.toLowerCase();
  const cachedEntry = latestVersionCache.get(cacheKey);
  if (cachedEntry && Date.now() - cachedEntry.timestamp < LATEST_VERSION_CACHE_TTL_MS) {
    return cachedEntry.value;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(normalizedName)}/json`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 404) {
      throw new Error(`PyPI 上未找到包 '${normalizedName}'`);
    }

    if (!response.ok) {
      throw new Error(`PyPI 查询失败: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const result = {
      packageName: payload.info?.name || normalizedName,
      latestVersion: payload.info?.version || "unknown",
      summary: payload.info?.summary || "",
      homePage: payload.info?.home_page || payload.info?.project_url || "",
      packageUrl: payload.info?.package_url || `https://pypi.org/project/${encodeURIComponent(normalizedName)}/`
    };
    latestVersionCache.set(cacheKey, {
      timestamp: Date.now(),
      value: result
    });
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("查询 PyPI 超时，请稍后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function upgradePip(target, preferredRoot = "") {
  return installPackage(target, "pip", true, preferredRoot);
}

export async function upgradeAllPackages(target, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const pipOutdated = await listOutdatedPackages(pythonExecutable);
  let condaUpdated = false;

  if (target.type === "conda") {
    const condaResult = await runCondaCommand(["update", "-n", target.name, "--all", "-y"], preferredRoot);
    if (!condaResult.ok) {
      throw new Error(condaResult.stderr || condaResult.stdout || "Conda 批量升级失败");
    }
    condaUpdated = true;
  }

  const outdatedAfterConda = target.type === "conda" ? await listOutdatedPackages(pythonExecutable) : pipOutdated;
  const packageNames = outdatedAfterConda.map((pkg) => pkg.name).filter(Boolean);

  if (packageNames.length) {
    const upgradeResult = await runCommand(
      pythonExecutable,
      ["-m", "pip", "install", "--upgrade", ...packageNames],
      { timeoutMs: 300000 }
    );
    if (!upgradeResult.ok) {
      throw new Error(upgradeResult.stderr || "pip 批量升级失败");
    }
  }

  const upgradedNames = packageNames.join(", ");
  const summary = [
    `目标环境: ${target.type}${target.name ? ` / ${target.name}` : ""}`,
    `Conda 全量升级: ${condaUpdated ? "已执行" : "未执行"}`,
    `pip 可升级包数量: ${packageNames.length}`
  ];

  if (packageNames.length) {
    summary.push(`pip 已升级包: ${upgradedNames}`);
  } else {
    summary.push("pip 已升级包: 无，当前已是最新");
  }

  return {
    message: packageNames.length || condaUpdated ? "批量升级完成" : "当前环境中的包已是最新",
    summary: summary.join("\n"),
    upgradedPackages: packageNames,
    upgradedCount: packageNames.length,
    condaUpdated
  };
}

export async function installFromRequirements(target, requirementsPath, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "install", "-r", requirementsPath], { timeoutMs: 120000 });
  if (!result.ok) {
    throw new Error(result.stderr || "从 requirements 安装失败");
  }
  return { message: "从 requirements 安装成功" };
}

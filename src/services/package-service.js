import { runCommand } from "../utils/process.js";
import { resolvePythonExecutable } from "./environment-service.js";

const latestVersionCache = new Map();
const LATEST_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

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

export async function installFromRequirements(target, requirementsPath, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "install", "-r", requirementsPath], { timeoutMs: 120000 });
  if (!result.ok) {
    throw new Error(result.stderr || "从 requirements 安装失败");
  }
  return { message: "从 requirements 安装成功" };
}

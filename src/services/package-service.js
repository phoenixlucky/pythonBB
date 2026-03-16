import { runCommand } from "../utils/process.js";
import { resolvePythonExecutable } from "./environment-service.js";

export async function listPackages(target, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "list", "--format=json"]);
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
  const result = await runCommand(pythonExecutable, args);
  if (!result.ok) {
    throw new Error(result.stderr || "安装包失败");
  }
  return { message: `包 '${packageName}' 安装成功` };
}

export async function uninstallPackage(target, packageName, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "uninstall", packageName, "-y"]);
  if (!result.ok) {
    throw new Error(result.stderr || "卸载包失败");
  }
  return { message: `包 '${packageName}' 卸载成功` };
}

export async function showPackageInfo(target, packageName, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "show", packageName]);
  if (!result.ok) {
    throw new Error(result.stderr || "无法获取包信息");
  }
  return { content: result.stdout };
}

export async function upgradePip(target, preferredRoot = "") {
  return installPackage(target, "pip", true, preferredRoot);
}

export async function installFromRequirements(target, requirementsPath, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(pythonExecutable, ["-m", "pip", "install", "-r", requirementsPath]);
  if (!result.ok) {
    throw new Error(result.stderr || "从 requirements 安装失败");
  }
  return { message: "从 requirements 安装成功" };
}

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCommand } from "../utils/process.js";

const IS_WINDOWS = process.platform === "win32";

function dedupeBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isBlockedWindowsAlias(targetPath) {
  return IS_WINDOWS && targetPath.toLowerCase().includes("\\windowsapps\\");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

async function findExecutablesInPath(commandName) {
  const tool = IS_WINDOWS ? "where" : "which";
  const args = IS_WINDOWS ? [commandName] : ["-a", commandName];

  try {
    const result = await runCommand(tool, args);
    if (!result.ok) {
      return [];
    }
    return result.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function getPythonVersion(pythonPath) {
  try {
    const result = await runCommand(pythonPath, ["--version"]);
    if (!result.ok) {
      return "Unknown";
    }
    const value = (result.stdout || result.stderr).trim();
    return value.replace(/^Python\s+/i, "") || "Unknown";
  } catch {
    return "Unknown";
  }
}

function getCondaPythonExecutable(envPath) {
  return IS_WINDOWS ? path.join(envPath, "python.exe") : path.join(envPath, "bin", "python");
}

function getCondaRootFromExecutable(condaExecutable) {
  if (!condaExecutable) {
    return null;
  }
  return path.dirname(path.dirname(condaExecutable));
}

function getVenvPythonExecutable(envPath) {
  return IS_WINDOWS ? path.join(envPath, "Scripts", "python.exe") : path.join(envPath, "bin", "python");
}

function getVenvIndicators(envPath) {
  return IS_WINDOWS
    ? [
        path.join(envPath, "Scripts", "python.exe"),
        path.join(envPath, "Scripts", "activate.bat"),
        path.join(envPath, "pyvenv.cfg")
      ]
    : [
        path.join(envPath, "bin", "python"),
        path.join(envPath, "bin", "activate"),
        path.join(envPath, "pyvenv.cfg")
      ];
}

async function isBrokenCondaEnvironmentDirectory(envPath) {
  if (!envPath || !(await pathExists(envPath))) {
    return false;
  }

  const condaMetaDir = path.join(envPath, "conda-meta");
  const historyFile = path.join(condaMetaDir, "history");
  const hasCondaMeta = await pathExists(condaMetaDir);
  const hasHistory = await pathExists(historyFile);

  return !hasCondaMeta || !hasHistory;
}

export async function detectCondaExecutable(preferredRoot = "") {
  const home = os.homedir();
  const candidates = [];
  const envCandidates = [
    process.env.CONDA_EXE,
    process.env.CONDA_BAT,
    process.env.CONDA_PYTHON_EXE
  ].filter(Boolean);

  if (preferredRoot) {
    candidates.push(
      IS_WINDOWS ? path.join(preferredRoot, "Scripts", "conda.exe") : path.join(preferredRoot, "bin", "conda")
    );
  }

  if (IS_WINDOWS) {
    candidates.push(
      path.join(home, "miniconda3", "Scripts", "conda.exe"),
      path.join(home, "anaconda3", "Scripts", "conda.exe"),
      path.join(home, "AppData", "Local", "miniconda3", "Scripts", "conda.exe"),
      "C:\\ProgramData\\miniconda3\\Scripts\\conda.exe",
      "C:\\ProgramData\\anaconda3\\Scripts\\conda.exe",
      "D:\\ProgramData\\miniconda3\\Scripts\\conda.exe",
      "D:\\ProgramData\\anaconda3\\Scripts\\conda.exe"
    );
  } else {
    candidates.push(
      path.join(home, "miniconda3", "bin", "conda"),
      path.join(home, "anaconda3", "bin", "conda"),
      "/opt/miniconda3/bin/conda",
      "/opt/anaconda3/bin/conda"
    );
  }

  candidates.push(...envCandidates);
  candidates.push(...(await findExecutablesInPath("conda")));

  for (const candidate of [...new Set(candidates)]) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function runCondaCommand(args, preferredRoot = "") {
  const condaExecutable = await detectCondaExecutable(preferredRoot);
  if (!condaExecutable) {
    throw new Error("Conda not found");
  }

  if (IS_WINDOWS) {
    return runCommand(condaExecutable, args, { shell: true });
  }

  return runCommand(condaExecutable, args);
}

export async function listCondaEnvironments(preferredRoot = "") {
  const condaExecutable = await detectCondaExecutable(preferredRoot);
  if (!condaExecutable) {
    return { condaAvailable: false, condaPath: null, environments: [] };
  }

  const fallbackEnvironments = [];
  const condaRoot = getCondaRootFromExecutable(condaExecutable);
  if (condaRoot && (await pathExists(condaRoot))) {
    fallbackEnvironments.push({
      name: "base",
      path: condaRoot,
      pythonVersion: await getPythonVersion(getCondaPythonExecutable(condaRoot))
    });

    const envsDir = path.join(condaRoot, "envs");
    if (await pathExists(envsDir)) {
      try {
        const entries = await fs.readdir(envsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          const envPath = path.join(envsDir, entry.name);
          fallbackEnvironments.push({
            name: entry.name,
            path: envPath,
            pythonVersion: await getPythonVersion(getCondaPythonExecutable(envPath))
          });
        }
      } catch {
        // ignore and keep partial fallback list
      }
    }
  }

  let result;
  try {
    result = await runCondaCommand(["env", "list", "--json"], preferredRoot);
  } catch {
    return {
      condaAvailable: true,
      condaPath: condaExecutable,
      environments: dedupeBy(fallbackEnvironments, (item) => item.path.toLowerCase())
    };
  }

  if (!result.ok) {
    return {
      condaAvailable: true,
      condaPath: condaExecutable,
      environments: dedupeBy(fallbackEnvironments, (item) => item.path.toLowerCase())
    };
  }

  const data = JSON.parse(result.stdout || "{}");
  const envDetails = data.envs_details || {};
  const environments = [...fallbackEnvironments];

  for (const envPath of data.envs || []) {
    const details = envDetails[envPath] || envDetails[envPath.toLowerCase()] || {};
    environments.push({
      name: details.name || path.basename(envPath),
      path: envPath,
      pythonVersion: await getPythonVersion(getCondaPythonExecutable(envPath)),
      writable: details.writable ?? null,
      base: details.base ?? path.basename(envPath).toLowerCase() === "base"
    });
  }

  return {
    condaAvailable: true,
    condaPath: condaExecutable,
    environments: dedupeBy(
      environments.map((env) => ({
        writable: env.writable ?? null,
        base: env.base ?? env.name === "base",
        ...env
      })),
      (item) => item.path.toLowerCase()
    )
  };
}

function rewriteExportedEnvironment(content, targetName, pythonVersion) {
  const lines = content.split(/\r?\n/);
  const rewritten = [];
  let dependencyIndex = -1;
  let hasPython = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("name:")) {
      rewritten.push(`name: ${targetName}`);
      continue;
    }

    if (trimmed.startsWith("prefix:")) {
      continue;
    }

    if (trimmed === "dependencies:") {
      dependencyIndex = rewritten.length;
      rewritten.push(line);
      continue;
    }

    if (pythonVersion && trimmed.startsWith("- python=")) {
      const indent = line.slice(0, line.length - line.trimStart().length);
      rewritten.push(`${indent}- python=${pythonVersion}`);
      hasPython = true;
      continue;
    }

    rewritten.push(line);
  }

  if (pythonVersion && !hasPython) {
    const pythonLine = `  - python=${pythonVersion}`;
    if (dependencyIndex === -1) {
      rewritten.push("dependencies:");
      rewritten.push(pythonLine);
    } else {
      rewritten.splice(dependencyIndex + 1, 0, pythonLine);
    }
  }

  return `${rewritten.join("\n").trim()}\n`;
}

export async function createCondaEnvironment(payload, preferredRoot = "") {
  const condaExecutable = await detectCondaExecutable(preferredRoot);
  if (!condaExecutable) {
    throw new Error("Conda not found");
  }

  if (payload.mode === "clone") {
    const clonePython = Boolean(payload.clonePython);
    const clonePackages = Boolean(payload.clonePackages);

    if (!clonePython && !clonePackages) {
      throw new Error("请至少选择一项克隆内容");
    }

    if (clonePython && clonePackages) {
      const result = await runCondaCommand([
        "create",
        "-n",
        payload.name,
        "--clone",
        payload.sourceName,
        "-y"
      ], preferredRoot);
      if (!result.ok) {
        throw new Error(result.stderr || "完整克隆失败");
      }
      return { message: `环境 '${payload.name}' 已基于 '${payload.sourceName}' 完整克隆成功` };
    }

    const { environments } = await listCondaEnvironments(preferredRoot);
    const sourceEnv = environments.find((entry) => entry.name === payload.sourceName);
    if (!sourceEnv) {
      throw new Error(`未找到源环境 '${payload.sourceName}'`);
    }

    if (clonePython && !clonePackages) {
      if (!sourceEnv.pythonVersion || sourceEnv.pythonVersion === "Unknown") {
        throw new Error("无法获取源环境的 Python 版本");
      }
      const result = await runCondaCommand([
        "create",
        "-n",
        payload.name,
        `python=${sourceEnv.pythonVersion}`,
        "-y"
      ], preferredRoot);
      if (!result.ok) {
        throw new Error(result.stderr || "创建环境失败");
      }
      return { message: `环境 '${payload.name}' 创建成功` };
    }

    const exportArgs = ["env", "export", "-n", payload.sourceName];
    exportArgs.push(payload.explicitPackagesOnly ? "--from-history" : "--no-builds");
    const exported = await runCondaCommand(exportArgs, preferredRoot);
    if (!exported.ok) {
      throw new Error(exported.stderr || "导出环境失败");
    }

    const targetPythonVersion = payload.targetPythonVersion || sourceEnv.pythonVersion || "3.11";
    const rewritten = rewriteExportedEnvironment(exported.stdout, payload.name, targetPythonVersion);
    const tempFile = path.join(os.tmpdir(), `pythonbb-${Date.now()}-${payload.name}.yml`);

    await fs.writeFile(tempFile, rewritten, "utf8");
    try {
      const result = await runCondaCommand(["env", "create", "-f", tempFile], preferredRoot);
      if (!result.ok) {
        throw new Error(result.stderr || "按导出配置创建环境失败");
      }
      return { message: `环境 '${payload.name}' 创建成功` };
    } finally {
      await fs.rm(tempFile, { force: true });
    }
  }

  const args = ["create", "-n", payload.name, `python=${payload.pythonVersion || "3.11"}`];
  for (const pkg of payload.packages || []) {
    args.push(pkg);
  }
  args.push("-y");
  const result = await runCondaCommand(args, preferredRoot);
  if (!result.ok) {
    throw new Error(result.stderr || "创建环境失败");
  }
  return { message: `环境 '${payload.name}' 创建成功` };
}

export async function deleteCondaEnvironment(name, preferredRoot = "") {
  if (name === "base") {
    throw new Error("不能删除 base 环境");
  }

  const { environments, condaPath } = await listCondaEnvironments(preferredRoot);
  const targetEnv = environments.find((env) => env.name === name);
  const condaRoot = getCondaRootFromExecutable(condaPath);
  const fallbackPath = targetEnv?.path || (condaRoot ? path.join(condaRoot, "envs", name) : null);
  const brokenDirectory = await isBrokenCondaEnvironmentDirectory(fallbackPath);

  const result = await runCondaCommand(["env", "remove", "-n", name, "-y"], preferredRoot);
  if (!result.ok) {
    const errorText = `${result.stderr || ""}\n${result.stdout || ""}`;
    if (errorText.includes("DirectoryNotACondaEnvironmentError") || brokenDirectory) {
      if (fallbackPath && (await pathExists(fallbackPath))) {
        await fs.rm(fallbackPath, { recursive: true, force: true });
        return { message: `环境 '${name}' 的 conda 元数据已失效，已清理残留目录: ${fallbackPath}` };
      }
    }

    throw new Error(result.stderr || result.stdout || "删除环境失败");
  }
  return { message: `环境 '${name}' 删除成功` };
}

export async function discoverPythonVersions() {
  const home = os.homedir();
  const candidates = [];

  if (IS_WINDOWS) {
    candidates.push(
      path.join(home, "AppData", "Local", "Programs", "Python"),
      "C:\\Python39",
      "C:\\Python310",
      "C:\\Python311",
      "C:\\Python312",
      "C:\\Python313",
      "C:\\Python314",
      "C:\\Program Files\\Python39",
      "C:\\Program Files\\Python310",
      "C:\\Program Files\\Python311",
      "C:\\Program Files\\Python312",
      "C:\\Program Files\\Python313",
      "C:\\Program Files\\Python314"
    );
  } else {
    candidates.push(
      "/usr/bin/python3",
      "/usr/bin/python3.11",
      "/usr/bin/python3.12",
      "/usr/bin/python3.13",
      "/usr/local/bin/python3",
      path.join(home, ".pyenv", "versions"),
      path.join(home, ".asdf", "installs", "python")
    );
  }

  candidates.push(...(await findExecutablesInPath(IS_WINDOWS ? "python.exe" : "python3")));
  const versions = [];

  for (const candidate of [...new Set(candidates)]) {
    if (isBlockedWindowsAlias(candidate)) {
      continue;
    }

    if (!(await pathExists(candidate))) {
      continue;
    }

    const stat = await safeStat(candidate);
    if (!stat) {
      continue;
    }

    if (stat.isDirectory()) {
      let children = [];
      try {
        children = await fs.readdir(candidate, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const child of children) {
        if (!child.isDirectory()) {
          continue;
        }
        const executable = IS_WINDOWS
          ? path.join(candidate, child.name, "python.exe")
          : path.join(candidate, child.name, "bin", "python3");
        if (await pathExists(executable)) {
          const version = await getPythonVersion(executable);
          versions.push({ path: executable, version, label: `${version} (${executable})` });
        }
      }
      continue;
    }

    const version = await getPythonVersion(candidate);
    versions.push({ path: candidate, version, label: `${version} (${candidate})` });
  }

  return dedupeBy(versions, (item) => item.path).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: "base" })
  );
}

export async function listVirtualEnvironments(lastDirectory = os.homedir()) {
  const searchPaths = [
    path.join(os.homedir(), "venvs"),
    path.join(os.homedir(), "envs"),
    path.join(os.homedir(), "Envs"),
    lastDirectory
  ];

  if (IS_WINDOWS) {
    searchPaths.push("C:\\virtualenvs", path.join(os.homedir(), "virtualenvs"));
  }

  const environments = [];

  for (const searchPath of searchPaths) {
    if (!(await pathExists(searchPath))) {
      continue;
    }
    let entries = [];
    try {
      entries = await fs.readdir(searchPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const envPath = path.join(searchPath, entry.name);
      const indicatorHits = await Promise.all(getVenvIndicators(envPath).map((item) => pathExists(item)));
      if (!indicatorHits.some(Boolean)) {
        continue;
      }
      environments.push({
        name: entry.name,
        path: envPath,
        pythonVersion: await getPythonVersion(getVenvPythonExecutable(envPath))
      });
    }
  }

  return dedupeBy(environments, (item) => item.path);
}

export async function createVirtualEnvironment({ name, targetPath, pythonPath }) {
  const envPath = path.join(targetPath, name);
  if (await pathExists(envPath)) {
    throw new Error(`路径 ${envPath} 已存在`);
  }
  const executable = pythonPath || (IS_WINDOWS ? "python" : "python3");
  const result = await runCommand(executable, ["-m", "venv", envPath]);
  if (!result.ok) {
    throw new Error(result.stderr || "创建虚拟环境失败");
  }
  return { message: `虚拟环境 '${name}' 创建成功` };
}

export async function deleteVirtualEnvironment(targetPath) {
  if (!(await pathExists(targetPath))) {
    throw new Error(`路径 ${targetPath} 不存在`);
  }
  await fs.rm(targetPath, { recursive: true, force: true });
  return { message: "虚拟环境删除成功" };
}

export async function resolvePythonExecutable(target, preferredRoot = "") {
  if (target.type === "system") {
    const executables = await findExecutablesInPath(IS_WINDOWS ? "python.exe" : "python3");
    return executables[0] || (IS_WINDOWS ? "python" : "python3");
  }

  if (target.type === "conda") {
    const { environments } = await listCondaEnvironments(preferredRoot);
    const env = environments.find((entry) => entry.name === target.name);
    if (!env) {
      throw new Error("找不到 conda 环境");
    }
    return getCondaPythonExecutable(env.path);
  }

  if (target.type === "venv") {
    return getVenvPythonExecutable(target.path);
  }

  throw new Error("未知环境类型");
}

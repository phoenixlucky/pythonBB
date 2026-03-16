import os from "node:os";
import process from "node:process";
import { detectCondaExecutable, discoverPythonVersions, listCondaEnvironments } from "./environment-service.js";
import { runCommand } from "../utils/process.js";

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise.catch(() => fallbackValue),
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

export async function getSystemOverview(preferredRoot = "") {
  const [pythonVersions, condaInfo] = await Promise.all([
    withTimeout(discoverPythonVersions(), 1500, []),
    withTimeout(listCondaEnvironments(preferredRoot), 2000, {
      condaAvailable: false,
      condaPath: null,
      environments: []
    })
  ]);

  let pipVersion = "未找到";
  try {
    const result = await runCommand(process.platform === "win32" ? "python" : "python3", ["-m", "pip", "--version"]);
    if (result.ok) {
      pipVersion = result.stdout.trim();
    }
  } catch {
    pipVersion = "未找到";
  }

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    hostname: os.hostname(),
    homeDirectory: os.homedir(),
    currentDirectory: process.cwd(),
    pipVersion,
    condaPath: condaInfo.condaPath || (await detectCondaExecutable(preferredRoot)),
    condaAvailable: condaInfo.condaAvailable,
    condaEnvironments: condaInfo.environments,
    pythonVersions
  };
}

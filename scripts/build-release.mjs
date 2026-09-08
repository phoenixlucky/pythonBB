import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tauriCli = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tauri.cmd" : "tauri");

const result = spawnSync(tauriCli, ["build", "--bundles", "nsis"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`[ERROR] Could not start Tauri build: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const bundleDirectory = path.join(root, "src-tauri", "target", "release", "bundle", "nsis");
const installers = fs.readdirSync(bundleDirectory)
  .filter((file) => file.toLowerCase().endsWith(".exe"))
  .map((file) => ({ file, mtime: fs.statSync(path.join(bundleDirectory, file)).mtimeMs }))
  .sort((left, right) => right.mtime - left.mtime);

if (!installers.length) {
  console.error(`[ERROR] No NSIS installer found in ${bundleDirectory}`);
  process.exit(1);
}

const releaseDirectory = path.join(root, "release");
fs.mkdirSync(releaseDirectory, { recursive: true });
const installerName = `WJPythonManager-${packageJson.version}-x64-setup.exe`;
const installerPath = path.join(releaseDirectory, installerName);
fs.copyFileSync(path.join(bundleDirectory, installers[0].file), installerPath);

const applicationPath = path.join(root, "src-tauri", "target", "release", "wj-python-manager.exe");
if (!fs.existsSync(applicationPath)) {
  console.error(`[ERROR] Portable executable not found at ${applicationPath}`);
  process.exit(1);
}
const portableName = `WJPythonManager-${packageJson.version}-x64-portable.exe`;
const portablePath = path.join(releaseDirectory, portableName);
fs.copyFileSync(applicationPath, portablePath);
console.log(`[SUCCESS] Installer: ${installerPath}`);
console.log(`[SUCCESS] Portable: ${portablePath}`);

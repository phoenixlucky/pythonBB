// ============================================================
// set-version.mjs — WJ Python管理大师版本号统一管理
// 用法：
//   node scripts/set-version.mjs            → 打印当前版本号
//   node scripts/set-version.mjs 2.8.0      → 设置新版本并同步所有文件
//   node scripts/set-version.mjs --check 2.8.0  → 仅校验格式，不写入
// 注意：必须在项目根目录下运行。
// ============================================================
import fs from "node:fs";
import path from "node:path";

// 项目根 = 当前工作目录。请始终在项目根目录下运行本脚本（bat 已自动 cd 到项目根）。
const ROOT = process.cwd();
const PKG_PATH = path.join(ROOT, "package.json");
const LOCK_PATH = path.join(ROOT, "package-lock.json");
const TAURI_CONFIG_PATH = path.join(ROOT, "src-tauri", "tauri.conf.json");
const CARGO_TOML_PATH = path.join(ROOT, "src-tauri", "Cargo.toml");
const README_PATH = path.join(ROOT, "README.md");

// 版本号格式：X.Y.Z 或带预发布后缀（如 2.8.0-beta.1）
const VERSION_RE = /^\d+\.\d+\.\d+([-.][0-9A-Za-z]+)*$/;

const UTF8_BOM = "\uFEFF";

// ---------- 带 BOM 感知的读写 ----------
// 读取文本：剥离 BOM 返回 { text, hadBom }
function readTextPreservingBom(p) {
  const raw = fs.readFileSync(p, "utf8");
  return {
    hadBom: raw.startsWith(UTF8_BOM),
    text: raw.startsWith(UTF8_BOM) ? raw.slice(1) : raw,
  };
}

function writeTextPreservingBom(p, text, hadBom) {
  fs.writeFileSync(p, (hadBom ? UTF8_BOM : "") + text, "utf8");
}

function readJson(p) {
  const { text } = readTextPreservingBom(p);
  return JSON.parse(text);
}

// JSON 写入时保留原文件 BOM
function writeJson(p, obj) {
  const { hadBom } = readTextPreservingBom(p);
  writeTextPreservingBom(p, JSON.stringify(obj, null, 2) + "\n", hadBom);
}

function getCurrentVersion() {
  return readJson(PKG_PATH).version;
}

function isValidVersion(v) {
  return VERSION_RE.test(v);
}

// 把 version 同步到其他所有位置，返回被修改的文件列表
function syncVersionToFiles(version) {
  const touched = [];

  // 1. package-lock.json：顶层 version + packages[""].version
  if (fs.existsSync(LOCK_PATH)) {
    const lock = readJson(LOCK_PATH);
    let changed = false;
    if (lock.version !== version) {
      lock.version = version;
      changed = true;
    }
    if (lock.packages && lock.packages[""] && lock.packages[""].version !== version) {
      lock.packages[""].version = version;
      changed = true;
    }
    if (changed) {
      writeJson(LOCK_PATH, lock);
      touched.push("package-lock.json");
    }
  }

  // 2. src-tauri/tauri.conf.json：桌面客户端版本
  if (fs.existsSync(TAURI_CONFIG_PATH)) {
    const config = readJson(TAURI_CONFIG_PATH);
    if (config.version !== version) {
      writeJson(TAURI_CONFIG_PATH, { ...config, version });
      touched.push("src-tauri/tauri.conf.json");
    }
  }

  // 3. Cargo.toml：Rust 客户端版本
  if (fs.existsSync(CARGO_TOML_PATH)) {
    const { text, hadBom } = readTextPreservingBom(CARGO_TOML_PATH);
    const updated = text.replace(/(^version\s*=\s*")[^"]+(")/m, `$1${version}$2`);
    if (updated !== text) {
      writeTextPreservingBom(CARGO_TOML_PATH, updated, hadBom);
      touched.push("src-tauri/Cargo.toml");
    }
  }

  // 4. README.md：徽章和文档版本
  if (fs.existsSync(README_PATH)) {
    const { text, hadBom } = readTextPreservingBom(README_PATH);
    const updated = text.replace(/version-[0-9]+\.[0-9]+\.[0-9]+/g, `version-${version}`);
    if (updated !== text) {
      writeTextPreservingBom(README_PATH, updated, hadBom);
      touched.push("README.md");
    }
  }

  return touched;
}

function setVersion(version) {
  if (!isValidVersion(version)) {
    console.error(`[错误] 版本号格式不正确：${version}`);
    console.error("应为 X.Y.Z，例如 2.8.0；可选预发布后缀，例如 2.8.0-beta.1");
    process.exit(1);
  }

  const old = getCurrentVersion();
  const pkg = readJson(PKG_PATH);
  pkg.version = version;
  writeJson(PKG_PATH, pkg);

  const touched = syncVersionToFiles(version);
  console.log(`版本号 ${old} → ${version}`);
  if (touched.length) {
    console.log(`已同步：${touched.join("、")}`);
  } else {
    console.log("其他文件版本号已一致，无需同步");
  }
}

// ---- 入口 ----
const arg = process.argv[2];

if (arg === "--check") {
  const target = process.argv[3];
  if (!target) {
    console.error("[错误] --check 需要一个版本号参数");
    process.exit(1);
  }
  if (isValidVersion(target)) {
    console.log("OK");
  } else {
    console.log("INVALID");
    process.exit(1);
  }
} else if (arg && !arg.startsWith("-")) {
  setVersion(arg);
} else {
  // 无参数：打印当前版本
  console.log(getCurrentVersion());
}

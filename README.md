# 🐍 WJ Python管理大师

> 基于 Tauri 2、Rust 与 Vue 3 的纯本地桌面客户端，统一管理 Python、Conda、venv 与 pip 包操作。

![Version](https://img.shields.io/badge/version-3.0.1-2ea44f)
![Platform](https://img.shields.io/badge/platform-Windows-0078d6)
![Stack](https://img.shields.io/badge/stack-Tauri%202%20%2B%20Rust%20%2B%20Vue%203-2563eb)
![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

WJ Python管理大师是一个基于 **Tauri 2 + Rust + Vue 3** 的纯本地桌面客户端，用来统一管理 Python、Conda、venv 与 pip 包操作。

---

## ✨ 功能特性

| 领域 | 能力 |
|------|------|
| 🖥️ 概览 | 系统状态总览 |
| 🚀 初始化配置 | 首次运行向导、Miniconda 安装与升级 |
| 🧪 Conda | 环境创建 / 克隆 / 删除、YAML 导入导出、软件源切换、Python 版本查询 |
| 🐍 Python | 本机 Python 扫描、系统 Python（winget）与 Conda 环境 Python 升级 |
| 📦 venv / uv | 标准库 venv 与 uv 虚拟环境创建、删除 |
| 🧩 包管理 | 安装 / 升级 / 卸载 / 批量升级 / requirements 安装、pip/uv 源选择 |
| 📋 日志 | 统一运行日志面板、活跃进程监控 |
| 🎨 外观 | 自定义背景壁纸、首页标语与整体配色 |

### 🖥️ 概览面板

- 一键展示系统核心状态：Conda、Python 版本一览

### 🚀 初始化配置

- **首次运行向导**：检测本机 Python / Conda 安装情况，引导完成环境初始化
- **Miniconda 管理**：未安装时引导安装；已安装时先查询可用版本、经用户确认后升级
- 初始化任务全程实时输出进度与日志

### 🧪 Conda 环境管理

- 检测 Conda / Miniconda 安装与**环境列表**，展示 Python 版本、包数量等概览
- **创建环境**：按指定 Python 版本创建，或基于已有环境**克隆**
- **删除环境**：执行前预览预估动作，确认后执行
- **YAML 导入导出**：单个环境或全部环境导出为 YAML，支持一键生成默认导出路径
- **软件源切换**：官方源 / conda-forge 等渠道切换，版本查询与安装统一按当前渠道执行
- **Python 版本查询**：查询当前渠道可用版本并缓存（独立计时，可手动刷新）

### 🐍 Python 版本管理

- 扫描本机**已安装的 Python 版本**
- **系统 Python 升级**：Windows 上通过 winget 升级 Python.org 安装的同一主次版本；Conda、venv、pyenv 使用各自的管理方式
- **Conda 环境 Python 无损升级**：查询可升级的稳定版本 → 升级前 dry-run 依赖求解（无法求解的版本不允许升级）→ 备份 → 升级 → 升级后校验环境路径，全程可追踪进度

### 📦 venv 虚拟环境

- 创建虚拟环境：指定名称与目标目录；uv 模式无需预装 Python，可填写版本号（如 `3.13`）由 uv 自动下载，也可填写解释器路径
- 支持指定目录扫描已有 `.venv`，危险删除操作需要确认；长时间任务支持取消
- 创建工具可选 Python 标准库 `venv` 或 `uv`；uv 环境自动使用 `uv pip` 管理包
- 自动检测 uv 版本；未安装 uv 时保留标准库 venv 流程
- 删除虚拟环境

### 🧩 包管理

- 基础操作：**安装、升级、卸载** Python 包
- 查询：查看包详情、列出已安装包、查询最新版本
- 批量操作：**一键升级所有过期包**、单独**升级 pip**
- **requirements 文件**：从指定文件批量安装
- **pip 下载源选择**：官方 PyPI、清华大学、阿里云、中国科大镜像或自定义源，安装/升级/批量升级均通过 `--index-url` 使用所选源；自定义地址校验 http/https 协议
- 异步任务执行：安装等耗时操作后台运行，实时输出命令、进程 PID 与执行日志；长时间无输出时提示切换 pip 源

### 📋 运行日志与进程监控

- **统一运行日志面板**：所有面板的操作输出集中展示，支持一键清空
- **活跃进程监控**：任务运行期间实时显示子进程 PID、运行时长与命令，任务完成后自动停止轮询

### 🎨 外观设置

- **自定义背景壁纸**：导入本地图片作为背景（支持 png / jpeg / webp / bmp / gif / avif，≤20MB，自动压缩至最长边 2560px 并转为 webp 格式减小体积），或一键恢复默认壁纸
- **首页标语文字**：自定义首页标语（最多 60 字），可恢复默认
- **整体配色**：主色 / 辅助色 / 文字色三档颜色自由调整，可一键恢复默认配色
- **持久化**：外观配置通过 Rust storage service 持久化至本机用户配置目录，重启不丢失
- 入口：客户端侧边栏「客户端设置」面板
- 所有外观设置仅保存在本机，数据不离开本地

---

## 🚀 快速开始

### Tauri 2 + Vue 3 迁移版本

仓库当前使用 Tauri 2.11+ / Rust / Vue 3.5 / TypeScript / Vite 8：

```bash
npm install
npm run tauri:dev
```

客户端完全基于 Tauri：Vue 只通过 `invoke` 调用 Rust commands，Rust service 直接访问本机 Python、Conda、文件系统和操作系统 API，不启动 HTTP 服务，也不提供网页入口。Rust 代码按 `domain → services → commands` 分层。

| 命令 | 说明 |
|------|------|
| `npm run frontend:dev` | 仅启动 Vue 前端预览 |
| `npm run frontend:build` | 构建 Vue 前端 |
| `npm run tauri:dev` | 启动 Tauri 桌面开发版 |
| `npm run tauri:build` | 构建 Tauri 桌面安装包 |

> 只有开发和打包阶段需要 Node.js ≥ 24；发布后的 Tauri 客户端不包含也不依赖 Node.js 运行时。

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run tauri:dev` | 启动 Tauri 桌面开发版 |
| `npm run tauri:build` | 构建 Tauri 客户端安装包 |
| `npm test` | 运行测试 |

```bash
npm install
npm run tauri:dev
```

---

## 📦 打包发布

### 生成 Windows 安装包

```bash
npm run tauri:build
```

最终产物统一复制到项目根目录 `release/`，文件名使用英文，例如 `WJ-Python-Manager_3.0.0_x64-setup.exe`。

### 一键打包

Windows 下可直接运行项目根目录的 **`一键打包.bat`**，交互式更新版本并执行 Tauri 构建：

1. 显示当前版本号，可输入新版本号（`X.Y.Z` 或 `X.Y.Z-beta.1`）
2. 生成 Tauri NSIS 安装包

---

## ⚙️ 安装器配置

| 项目 | 值 |
|------|-----|
| 软件名称 | `WJ Python管理大师` |
| 软件公司 | `尉缭子科技` |
| 可执行文件 | `wj-python-manager.exe` |
| 安装器产品名 | `WJ Python Manager` |
| 安装包文件名 | `WJ Python Manager_*_x64-setup.exe` |
| 当前用户默认路径 | `%LOCALAPPDATA%\WJ Python Manager` |
| 安装方式 | English NSIS；支持 Current User / All Users 全局安装 |
| GitHub 仓库 | <https://github.com/phoenixlucky/WeiPython> |

相关配置：`package.json` · `src-tauri/tauri.conf.json` · `src-tauri/Cargo.toml`

---

## 📖 常用操作

### 🧪 创建 Conda 环境

1. 进入 `Conda` 页面
2. 输入环境名称
3. 选择按 Python 版本创建，或基于已有环境克隆
4. 查看预估执行动作
5. 点击执行

### 📦 创建虚拟环境

1. 进入 `虚拟环境` 页面
2. 输入环境名称和目标目录
3. 选择 `Python 标准库 venv` 或 `uv`
4. 可选填写 Python 路径
5. 点击创建

### 🧩 包管理

1. 进入 `包管理` 页面
2. 选择目标环境
3. 输入包名或从已安装包下拉中选择
4. 执行安装、升级、卸载、查询信息，或从指定 requirements 文件安装
5. 安装/升级前可切换 pip 下载源（官方 / 清华 / 阿里云 / 中科大 / 自定义）

---

## 📁 项目结构

```text
WJ-Python-Manager/
├── frontend/                   # Vue 3 + TypeScript + Vite 前端
├── src-tauri/                  # Rust domain / services / commands
├── scripts/set-version.mjs    # 开发期版本同步脚本
├── package.json                # Tauri 前端脚本
└── README.md
```

---

## 📄 开源协议

本项目基于 **GNU General Public License v3.0（GPL-3.0）** 开源发布。

- Copyright (C) 2026 **尉缭子科技**
- 许可证全文见 [LICENSE](LICENSE) 文件
- 官方文本：<https://www.gnu.org/licenses/gpl-3.0.html>

> 📌 GPL-3.0 为强 copyleft 协议：你可以自由使用、修改与分发，但分发**修改后的衍生作品**时，必须以相同协议开源并提供对应源代码。

---

## 📌 说明

- 当前项目主要面向 **Windows** 使用场景
- Conda 与 pip 的实际执行结果依赖本机环境权限、网络和安装状态
- 发布客户端只依赖用户本机的 Python、Conda、venv/uv 与 pip 环境
- 如需微调安装器默认目录、图标或品牌资源，可直接修改 `src-tauri/tauri.conf.json` 与 `build/` 目录中的资源

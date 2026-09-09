# WJ Python 管理大师

WJ Python 管理大师是一款面向 Windows 的本地 Python 环境管理工具。它把 Python、Conda、venv、uv 和 pip 的常用操作集中到一个桌面应用中，帮助你更直观地创建环境、管理依赖和维护本机 Python 工具链。

软件不需要账号，配置、日志和外观设置都保存在本机。

## 适合做什么

- 查看本机 Python、Conda 环境和虚拟环境
- 初始化 Miniconda，并创建第一个 Python 环境
- 创建、克隆、删除 Conda 环境
- 导入或导出 Conda YAML 环境配置
- 创建和扫描 Python `venv`、`uv` 虚拟环境
- 安装、升级、卸载 Python 包
- 从 `requirements.txt` 批量安装依赖
- 管理 uv，导入或导出 uv 环境依赖
- 查询可用 Python 版本，以及升级 Conda 环境中的 Python
- 查看任务日志和运行中的进程
- 自定义首页标语、背景和配色

## 安装与启动

### 使用已打包版本

在项目的 `release/` 目录或发布页面下载对应文件：

- `*-setup.exe`：安装版，适合日常使用
- `*-portable.exe`：便携版，无需安装

启动后，建议先打开左侧的“初始化配置”，根据向导完成 Conda 和首个 Python 环境的设置。

### 从源码运行

开发环境需要 Node.js 24 或更高版本，并需要 Rust 工具链。

```bash
npm install
npm run tauri:dev
```

运行测试：

```bash
npm test
```

## 使用说明

### 第一次使用

1. 打开“初始化配置”。
2. 点击“重新检测”，查看本机是否已有 Conda。
3. 如果没有 Conda，选择 Miniconda 安装目录和 Python 版本。
4. 按需选择常用库，点击“开始初始化”。
5. 初始化完成后，在“概览”查看环境状态。

### 管理 Conda 环境

进入“Conda 环境”：

- 按 Python 版本创建新环境，或克隆已有环境
- 查看环境路径、Python 版本和已安装包数量
- 删除不再使用的环境
- 通过 YAML 文件导入或导出环境
- 切换 `conda-forge` 或 `defaults` 软件源
- 检查并升级 Conda

删除环境前请确认环境中没有需要保留的数据。`base` 环境不能直接删除。

### 管理 Python 版本

进入“Python 版本”：

- 重新扫描本机已安装的 Python
- 在支持 `winget` 的 Windows 环境中升级系统 Python
- 查询 Conda 软件源中的 Python 版本
- 升级 Conda 环境中的 Python

不同来源安装的 Python 要使用对应的管理方式维护。系统 Python、Conda、venv 和 uv 环境不会混为一谈。

### 创建虚拟环境

进入“虚拟环境”：

1. 填写环境名称和目标目录。
2. 选择 `Python venv` 或 `uv`。
3. 可选填写 Python 路径或版本。
4. 点击“创建虚拟环境”。

也可以使用“扫描目录”识别已有的项目虚拟环境。uv 模式支持普通 uv 环境和 VS Code 常用的项目 `.venv` 模式。

### 管理 Python 包

进入“包管理”：

1. 选择目标环境。
2. 输入包名，或从已安装包列表中选择。
3. 执行安装、升级、卸载、详情查询或最新版本查询。
4. 需要批量安装时，选择 `requirements.txt` 文件。

安装和升级前可以填写 pip 源地址。操作结果、命令输出和错误信息会显示在运行日志中。

### 使用 uv

进入“uv 管理”可以：

- 检测本机已有的 uv
- 安装最新版或指定版本
- 选择安装目录
- 卸载本程序识别的用户级 uv
- 导出或导入 uv 环境的 `requirements.txt`

卸载 uv 不会删除已经创建的虚拟环境。

## 注意事项

- 当前版本主要面向 Windows。
- 创建环境、安装包和升级 Python 需要网络连接，并受本机权限影响。
- 软件会调用本机的 Python、Conda、pip、uv 和 Windows 工具，不会替你远程管理环境。
- 删除环境和卸载包属于实际修改操作，请确认目标后再执行。
- pip 源、Conda 软件源和 Python 下载地址由用户选择，网络问题通常需要检查源地址或代理设置。
- 所有设置和运行日志默认保存在本机，不上传到服务器。

## 开源协议

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。

项目地址：[github.com/phoenixlucky/WeiPython](https://github.com/phoenixlucky/WeiPython)

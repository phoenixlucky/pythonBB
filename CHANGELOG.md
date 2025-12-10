# 更新日志
## v1.1.0 - Python 3.14 支持 (2025-12-10)

### 🚀 新增功能

#### Python 3.14 完整支持
- ✅ 添加 Python 3.14.2, 3.14.1, 3.14.0 到下载列表
- ✅ Miniconda 添加 Python 3.14 支持 (Miniconda3-py314_24.9.0-0)
- ✅ Conda 环境创建支持 Python 3.14
- ✅ Windows 路径检测支持 C:\Python314
- ✅ Linux/macOS 路径检测支持 /usr/bin/python3.14

#### Python 3.13 最新版本
- ✅ 添加 Python 3.13.11, 3.13.10, 3.13.9 到下载列表
- ✅ 更新 Conda 环境创建默认版本为 3.13

### 🐛 修复问题

#### Conda 环境管理
- ✅ 修复 conda 环境检测问题，现在能正确显示所有环境
- ✅ 修复 conda 环境创建功能，实际执行创建命令
- ✅ 修复 conda 环境删除功能，实际执行删除命令
- ✅ 添加环境创建/删除的错误处理

#### 包管理功能
- ✅ 修复包信息显示，使用真实的 `pip show` 命令
- ✅ 改进包列表显示格式：`包名 (版本)`
- ✅ 修复包名解析逻辑，支持多种格式
- ✅ 增大包信息窗口尺寸 (700x500)
- ✅ 实际的包安装/卸载/升级功能

#### Python 版本检测
- ✅ 扩展检测路径，包括：
  - `C:\Program Files\Python3XX`
  - `C:\Program Files (x86)\Python3XX`
  - `PATH` 环境变量中的 Python
  - pyenv/asdf 版本管理器支持
- ✅ 添加版本去重和排序
- ✅ 改进版本检测失败的错误提示

### 🔧 技术改进

#### 模块化架构
- ✅ 分离环境管理逻辑到 `environment_manager.py`
- ✅ 分离 Miniconda 安装逻辑到 `miniconda_installer.py`
- ✅ 主程序专注 UI 逻辑，提高可维护性

#### 错误处理
- ✅ 完善的异常处理机制
- ✅ 用户友好的错误提示
- ✅ 操作失败时的详细反馈

#### 跨平台支持
- ✅ Windows、Linux、macOS 全平台支持
- ✅ 自动平台检测和路径适配
- ✅ 不同平台的可执行文件路径处理

### 📋 测试结果

```
✅ Conda 环境检测：成功检测到 7 个环境
   - miniconda3 (Python 3.13.5)
   - fenv (Python 3.13.1) 
   - py314 (Python 3.14.0) ⭐
   - pyBIyo_env (Python 3.11.13)
   - python3131 (Python 3.13.1)
   - vacuum_env (Python 3.11.13)

✅ Python 版本检测：支持 3.9-3.14 全系列
✅ 包管理功能：真实操作和详细显示
✅ UI 界面：所有标签页功能正常
```

### 🎯 用户影响

#### 对现有用户
- 所有 Conda 环境现在都能正确显示
- 包管理功能可以实际安装/卸载包
- Python 版本检测更加全面

#### 对新用户
- 支持 Python 3.14 最新版本
- 更完整的 Python 版本选择
- 更好的错误提示和用户体验

### 📁 文件变更

#### 新增文件
- `environment_manager.py` - 环境管理核心模块
- `miniconda_installer.py` - Miniconda 安装模块
- `test_conda_detection.py` - Conda 检测测试工具
- `BUG_FIXES.md` - Bug 修复说明
- `CHANGELOG.md` - 更新日志 (本文件)

#### 修改文件
- `python_manager.py` - 主程序，大量功能更新
- `requirements.txt` - 依赖说明
- `README.md` - 使用文档更新

### 🔄 版本兼容性

#### Python 版本支持
- ✅ Python 3.9.x (支持到 3.9.19)
- ✅ Python 3.10.x (支持到 3.10.15)
- ✅ Python 3.11.x (支持到 3.11.11)
- ✅ Python 3.12.x (支持到 3.12.8)
- ✅ Python 3.13.x (支持到 3.13.11) ⭐
- ✅ Python 3.14.x (支持到 3.14.2) ⭐

#### 平台支持
- ✅ Windows 10/11 (x64, x86)
- ✅ macOS (Intel, Apple Silicon)
- ✅ Linux (主流发行版)

### 🚀 已知问题和限制

#### 当前限制
1. Miniconda 下载需要网络连接
2. 某些包管理操作可能需要管理员权限
3. 虚拟环境创建需要 Python 3.7+

#### 计划修复
- [ ] 添加下载进度显示
- [ ] 支持更多 Python 版本管理工具
- [ ] 添加环境导出/导入功能
- [ ] 支持批量包操作
- [ ] 添加配置文件编辑功能

### 🎉 升级建议

1. **立即升级**：支持 Python 3.14 最新特性
2. **检查环境**：使用新的测试工具验证 conda 检测
3. **更新配置**：确保程序能找到所有 Python 版本
4. **体验新功能**：尝试改进的包管理功能

---

## v1.0.0 - 初始版本 (2025-12-10)

### 🎉 首次发布
- 基础的 Python 和 Miniconda 环境管理功能
- 图形界面操作
- 虚拟环境支持
- 包管理基础功能

---

*更新日志按时间倒序排列，最新版本在顶部*

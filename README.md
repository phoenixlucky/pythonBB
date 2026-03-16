# Python & Miniconda 环境管理器
一个基于 Node/JS Web 界面的本地环境管理工具，用于管理 Python、Conda、venv 和包操作。

## 功能特性

### 🐍 Python管理
- 扫描已安装的 Python 版本
- 查看系统 Python / pip / Node 运行时信息

### 🔧 Miniconda管理
- 创建、删除Conda环境
- 基于已有Conda环境克隆创建新环境
- 管理Conda环境列表
- 自动检测已安装的Miniconda

### 📦 虚拟环境管理
- 创建Python虚拟环境
- 删除虚拟环境
- 查看环境信息和Python版本
- 自定义安装路径

### 📚 包管理
- 在不同环境中安装、卸载Python包
- 查看已安装包的详细信息
- 从requirements.txt批量安装包
- 升级pip和单个包

## 安装和使用

### 系统要求
- Python 3.7+
- Windows/macOS/Linux操作系统

### 快速开始

1. **克隆或下载项目**
   ```bash
   # 如果是git仓库
   git clone <repository-url>
   cd pythonBB
   ```

2. **确保已安装 Node.js 22+**
   ```bash
   node -v
   ```

3. **启动 Web 界面**
   ```bash
   npm run web
   ```
   然后在浏览器打开 `http://localhost:3210`

### 程序界面

程序包含 4 个主要区域：

#### 📊 概览
- 显示系统信息和环境状态
- 查看Python版本和路径
- 检查pip和conda可用性

#### 🐍 Miniconda / Conda
- 管理Conda环境
- 创建、删除环境
- 支持基于已有环境克隆
- 支持仅克隆 Python、仅克隆库、完整克隆

#### 📦 Python
- 扫描多个 Python 版本
- 展示本机 Python 路径与版本

#### 🏗️ 虚拟环境
- 创建venv虚拟环境
- 管理现有环境
- 激活和删除环境

#### 📚 包管理
- 安装、卸载Python包
- 查看包信息
- 从requirements.txt安装

## 文件结构

```text
pythonBB/
├── package.json                 # npm 脚本入口
├── public/                      # Web 前端资源
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/                         # Node 服务端
│   ├── server.js
│   ├── services/
│   └── utils/
├── python_manager.py            # 旧版 Tkinter 实现（保留作参考）
├── environment_manager.py       # 旧版 Python 环境逻辑（保留作参考）
└── README.md
```

## 使用示例

### Web 启动
1. 在项目根目录运行 `npm run web`
2. 打开浏览器访问 `http://localhost:3210`
3. 在左侧导航切换到对应功能区

### 创建Conda环境
1. 切换到 `Conda`
2. 输入新环境名称
3. 选择“按 Python 版本创建”或“基于已有环境创建”
4. 查看“预估执行动作”摘要区
5. 点击“执行创建”

### 创建虚拟环境
1. 切换到 `虚拟环境`
2. 输入环境名称和目标目录
3. 点击“创建虚拟环境”

### 安装Python包
1. 切换到 `包管理`
2. 选择目标环境
3. 输入包名（如 `numpy`）
4. 选择安装、升级、卸载或列出

## 高级功能

### 配置文件
程序会在用户主目录创建`.python_manager_config.json`配置文件，保存：
- Miniconda安装路径
- 上次使用的目录
- 其他用户偏好设置

### 命令行集成
创建的虚拟环境可以通过命令行激活：
```bash
# Windows
path\to\venv\Scripts\activate.bat

# macOS/Linux
source path/to/venv/bin/activate
```

### 批量安装
使用requirements.txt文件批量安装包：
1. 在"包管理"标签页点击"从requirements安装"
2. 选择requirements.txt文件
3. 程序会自动安装所有列出的包

## 故障排除

### 常见问题

1. **conda命令找不到**
   - 确保Miniconda已正确安装
   - 检查安装路径是否正确

2. **虚拟环境创建失败**
   - 确保有足够的磁盘空间
   - 检查目标路径的写入权限
   - 确保Python版本兼容

3. **包安装失败**
   - 检查网络连接
   - 尝试使用国内镜像源
   - 确保包名正确

4. **程序启动失败**
   - 确保Python版本3.7+
   - 检查是否安装了所有依赖
   - 查看错误信息提示

### 国内用户建议

由于网络原因，建议配置国内镜像源：

```bash
# pip镜像源
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# conda镜像源
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge/
```

## 开发说明

### 扩展功能
可以通过修改以下文件来扩展功能：
- `python_manager.py` - 添加新的UI元素
- `environment_manager.py` - 添加环境管理功能
- `miniconda_installer.py` - 增强安装功能

### 贡献代码
欢迎提交Pull Request和Issue来改进这个项目。

## 许可证

本项目采用MIT许可证，详见LICENSE文件。

## 更新日志

### v1.0.0
- 初始版本发布
- 基本的Python和Miniconda管理功能
- 图形界面操作
- 虚拟环境支持
- 包管理功能

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交GitHub Issue
- 发送邮件至开发者邮箱

---

**注意**: 本工具仅用于学习和开发目的，在生产环境中使用前请充分测试。

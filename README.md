# Python & Miniconda 环境管理器
一个功能强大的图形界面工具，用于管理Python和Miniconda环境。

## 功能特性

### 🐍 Python管理
- 检查已安装的Python版本
- 下载和安装不同版本的Python
- 设置默认Python版本
- 系统Python信息查看

### 🔧 Miniconda管理
- 一键下载和安装Miniconda
- 创建、删除Conda环境
- 管理Conda环境列表
- 自动检测已安装的Miniconda

### 📦 虚拟环境管理
- 创建Python虚拟环境
- 激活和删除虚拟环境
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

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **运行程序**
   ```bash
   python run_manager.py
   ```
   或者直接运行：
   ```bash
   python python_manager.py
   ```

### 程序界面

程序包含5个主要标签页：

#### 📊 概览
- 显示系统信息和环境状态
- 查看Python版本和路径
- 检查pip和conda可用性

#### 🐍 Miniconda
- 下载和安装Miniconda
- 管理Conda环境
- 创建、删除环境
- 查看环境详细信息

#### 📦 Python
- 管理多个Python版本
- 下载特定版本
- 设置默认版本

#### 🏗️ 虚拟环境
- 创建venv虚拟环境
- 管理现有环境
- 激活和删除环境

#### 📚 包管理
- 安装、卸载Python包
- 查看包信息
- 从requirements.txt安装

## 文件结构

```
pythonBB/
├── python_manager.py        # 主程序文件
├── miniconda_installer.py   # Miniconda安装模块
├── environment_manager.py    # 环境管理模块
├── run_manager.py          # 启动脚本
├── requirements.txt         # 依赖列表
└── README.md              # 说明文档
```

## 使用示例

### 安装Miniconda
1. 切换到"Miniconda"标签页
2. 选择版本（如Miniconda3-latest）
3. 选择安装路径（建议：C:\\Users\\用户名\\miniconda3）
4. 点击"下载并安装"

### 创建虚拟环境
1. 切换到"虚拟环境"标签页
2. 输入环境名称（如myenv）
3. 选择Python版本
4. 选择安装路径
5. 点击"创建虚拟环境"

### 安装Python包
1. 切换到"包管理"标签页
2. 选择目标环境
3. 输入包名（如numpy）
4. 点击"安装"

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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
环境管理器模块
提供Python和Conda环境的管理功能
"""
import os
import sys
import subprocess
import json
from pathlib import Path
import shutil


class EnvironmentManager:
    """环境管理器"""
    
    def __init__(self, conda_path=None):
        self.conda_path = conda_path
        self.conda_exe = self._find_conda_executable()
    
    def _find_conda_executable(self):
        """查找conda可执行文件"""
        possible_paths = []
        
        if self.conda_path:
            conda_dir = Path(self.conda_path)
            if sys.platform == "win32":
                possible_paths.append(conda_dir / "Scripts" / "conda.exe")
            else:
                possible_paths.append(conda_dir / "bin" / "conda")
        
        # 用户目录下的常见安装位置
        home = Path.home()
        if sys.platform == "win32":
            possible_paths.extend([
                home / "miniconda3" / "Scripts" / "conda.exe",
                home / "anaconda3" / "Scripts" / "conda.exe",
                home / "AppData" / "Local" / "miniconda3" / "Scripts" / "conda.exe",
            ])
        else:
            possible_paths.extend([
                home / "miniconda3" / "bin" / "conda",
                home / "anaconda3" / "bin" / "conda",
                "/opt/miniconda3/bin/conda",
                "/opt/anaconda3/bin/conda",
            ])
        
        # 检查PATH中是否有conda
        try:
            conda_in_path = shutil.which("conda")
            if conda_in_path:
                possible_paths.append(Path(conda_in_path))
        except:
            pass
        
        # 返回第一个找到的conda
        for conda_path in possible_paths:
            if conda_path.exists():
                return str(conda_path)
        
        return None
    
    def is_conda_available(self):
        """检查conda是否可用"""
        return self.conda_exe is not None
    
    def run_conda_command(self, args, capture_output=True):
        """运行conda命令"""
        if not self.conda_exe:
            raise RuntimeError("Conda not found")
        
        cmd = [self.conda_exe] + args
        
        try:
            if capture_output:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=False
                )
                return result.returncode == 0, result.stdout, result.stderr
            else:
                result = subprocess.run(cmd, check=False)
                return result.returncode == 0, "", ""
        except Exception as e:
            return False, "", str(e)
    
    def list_conda_environments(self):
        """列出conda环境"""
        if not self.is_conda_available():
            return []
        
        success, stdout, stderr = self.run_conda_command(["env", "list", "--json"])
        
        if success:
            try:
                data = json.loads(stdout)
                envs = data.get("envs", [])
                environments = []
                
                for env_path in envs:
                    env_path = Path(env_path)
                    env_name = env_path.name
                    
                    # 获取Python版本
                    python_version = self._get_env_python_version(env_path)
                    
                    environments.append({
                        "name": env_name,
                        "path": str(env_path),
                        "python_version": python_version
                    })
                
                return environments
            except json.JSONDecodeError:
                return []
        else:
            return []
    
    def _get_env_python_version(self, env_path):
        """获取环境的Python版本"""
        env_path = Path(env_path)
        python_exe = None
        
        if sys.platform == "win32":
            python_exe = env_path / "python.exe"
        else:
            python_exe = env_path / "bin" / "python"
        
        if python_exe.exists():
            try:
                result = subprocess.run(
                    [str(python_exe), "--version"],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    return result.stdout.strip().replace("Python ", "")
            except:
                pass
        
        return "Unknown"
    
    def create_conda_environment(self, name, python_version="3.11", packages=None):
        """创建conda环境"""
        if not self.is_conda_available():
            return False, "Conda not available"
        
        cmd = ["create", "-n", name, f"python={python_version}"]
        
        if packages:
            cmd.extend(packages)
        
        cmd.append("-y")
        
        success, stdout, stderr = self.run_conda_command(cmd)
        
        if success:
            return True, f"环境 '{name}' 创建成功"
        else:
            return False, f"创建失败: {stderr}"
    
    def delete_conda_environment(self, name):
        """删除conda环境"""
        if not self.is_conda_available():
            return False, "Conda not available"
        
        if name == "base":
            return False, "不能删除base环境"
        
        success, stdout, stderr = self.run_conda_command(["env", "remove", "-n", name, "-y"])
        
        if success:
            return True, f"环境 '{name}' 删除成功"
        else:
            return False, f"删除失败: {stderr}"
    
    def install_package_conda(self, env_name, package, channel=None):
        """在conda环境中安装包"""
        if not self.is_conda_available():
            return False, "Conda not available"
        
        cmd = ["install", "-n", env_name, package, "-y"]
        
        if channel:
            cmd.extend(["-c", channel])
        
        success, stdout, stderr = self.run_conda_command(cmd)
        
        if success:
            return True, f"包 '{package}' 安装成功"
        else:
            return False, f"安装失败: {stderr}"
    
    def list_packages_conda(self, env_name):
        """列出conda环境中的包"""
        if not self.is_conda_available():
            return []
        
        success, stdout, stderr = self.run_conda_command(["list", "-n", env_name])
        
        if success:
            packages = []
            lines = stdout.strip().split('\n')[3:]  # 跳过头部
            
            for line in lines:
                if line.strip() and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        packages.append(f"{parts[0]} - {parts[1]}")
            
            return packages
        else:
            return []


class VirtualEnvironmentManager:
    """虚拟环境管理器"""
    
    def __init__(self, python_exe=None):
        self.python_exe = python_exe or sys.executable
    
    def create_venv(self, name, path, python_version=None):
        """创建虚拟环境"""
        env_path = Path(path) / name
        
        if env_path.exists():
            return False, f"路径 {env_path} 已存在"
        
        try:
            # 创建虚拟环境
            cmd = [self.python_exe, "-m", "venv", str(env_path)]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return True, f"虚拟环境 '{name}' 创建成功"
            else:
                return False, f"创建失败: {result.stderr}"
                
        except Exception as e:
            return False, f"创建出错: {e}"
    
    def delete_venv(self, path):
        """删除虚拟环境"""
        env_path = Path(path)
        
        if not env_path.exists():
            return False, f"路径 {path} 不存在"
        
        try:
            shutil.rmtree(env_path)
            return True, "虚拟环境删除成功"
        except Exception as e:
            return False, f"删除失败: {e}"
    
    def get_venv_python_version(self, env_path):
        """获取虚拟环境的Python版本"""
        env_path = Path(env_path)
        python_exe = None
        
        if sys.platform == "win32":
            python_exe = env_path / "Scripts" / "python.exe"
        else:
            python_exe = env_path / "bin" / "python"
        
        if python_exe.exists():
            try:
                result = subprocess.run(
                    [str(python_exe), "--version"],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    return result.stdout.strip().replace("Python ", "")
            except:
                pass
        
        return "Unknown"
    
    def list_venvs_in_directory(self, directory):
        """列出目录中的虚拟环境"""
        directory = Path(directory)
        venvs = []
        
        if not directory.exists():
            return venvs
        
        for item in directory.iterdir():
            if item.is_dir():
                # 检查是否有虚拟环境标志
                if self._is_venv_directory(item):
                    python_version = self.get_venv_python_version(item)
                    venvs.append({
                        "name": item.name,
                        "path": str(item),
                        "python_version": python_version
                    })
        
        return venvs
    
    def _is_venv_directory(self, path):
        """检查是否为虚拟环境目录"""
        path = Path(path)
        
        # 检查常见的虚拟环境标志文件
        indicators = []
        
        if sys.platform == "win32":
            indicators = [
                path / "Scripts" / "python.exe",
                path / "Scripts" / "activate.bat"
            ]
        else:
            indicators = [
                path / "bin" / "python",
                path / "bin" / "activate"
            ]
        
        # 检查pyvenv.cfg文件
        pyvenv_cfg = path / "pyvenv.cfg"
        
        return any(indicator.exists() for indicator in indicators) or pyvenv_cfg.exists()


class PackageManager:
    """包管理器"""
    
    def __init__(self, python_exe=None):
        self.python_exe = python_exe or sys.executable
    
    def install_package(self, package, upgrade=False):
        """安装包"""
        cmd = [self.python_exe, "-m", "pip", "install"]
        
        if upgrade:
            cmd.append("--upgrade")
        
        cmd.append(package)
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return True, f"包 '{package}' 安装成功"
            else:
                return False, f"安装失败: {result.stderr}"
        except Exception as e:
            return False, f"安装出错: {e}"
    
    def uninstall_package(self, package):
        """卸载包"""
        cmd = [self.python_exe, "-m", "pip", "uninstall", package, "-y"]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return True, f"包 '{package}' 卸载成功"
            else:
                return False, f"卸载失败: {result.stderr}"
        except Exception as e:
            return False, f"卸载出错: {e}"
    
    def list_packages(self):
        """列出已安装的包"""
        cmd = [self.python_exe, "-m", "pip", "list", "--format=json"]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                import json
                packages = json.loads(result.stdout)
                return [f"{pkg['name']} - {pkg['version']}" for pkg in packages]
            else:
                return []
        except Exception:
            return []
    
    def upgrade_pip(self):
        """升级pip"""
        return self.install_package("pip", upgrade=True)
    
    def show_package_info(self, package):
        """显示包信息"""
        cmd = [self.python_exe, "-m", "pip", "show", package]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return result.stdout
            else:
                return f"无法获取包 '{package}' 的信息"
        except Exception as e:
            return f"获取包信息出错: {e}"
    
    def install_from_requirements(self, requirements_file):
        """从requirements文件安装包"""
        if not Path(requirements_file).exists():
            return False, f"文件 {requirements_file} 不存在"
        
        cmd = [self.python_exe, "-m", "pip", "install", "-r", requirements_file]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return True, "从requirements文件安装成功"
            else:
                return False, f"安装失败: {result.stderr}"
        except Exception as e:
            return False, f"安装出错: {e}"

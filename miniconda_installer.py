#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Miniconda安装器模块
提供Miniconda的实际下载和安装功能
"""
import os
import sys
import requests
import subprocess
import tempfile
import shutil
from pathlib import Path
import zipfile
import tarfile
from urllib.parse import urljoin


class MinicondaInstaller:
    """Miniconda安装器"""
    
    BASE_URL = "https://repo.anaconda.com/miniconda/"
    
    VERSIONS = {
        "Miniconda3-latest": "Miniconda3-latest",
        "Miniconda3-py314": "Miniconda3-py314_24.9.0-0",
        "Miniconda3-py313": "Miniconda3-py313_24.7.1-0",
        "Miniconda3-py312": "Miniconda3-py312_24.7.1-0",
        "Miniconda3-py311": "Miniconda3-py311_24.7.1-0", 
        "Miniconda3-py310": "Miniconda3-py310_24.7.1-0",
        "Miniconda3-py39": "Miniconda3-py39_24.7.1-0"
    }
    
    def __init__(self, install_path, progress_callback=None):
        self.install_path = Path(install_path)
        self.progress_callback = progress_callback
        
    def get_download_url(self, version):
        """获取下载URL"""
        if version not in self.VERSIONS:
            raise ValueError(f"不支持的版本: {version}")
        
        version_name = self.VERSIONS[version]
        
        if sys.platform == "win32":
            return f"{self.BASE_URL}{version_name}-Windows-x86_64.exe"
        elif sys.platform == "darwin":
            if os.uname().machine == "arm64":
                return f"{self.BASE_URL}{version_name}-MacOSX-arm64.sh"
            else:
                return f"{self.BASE_URL}{version_name}-MacOSX-x86_64.sh"
        else:  # Linux
            return f"{self.BASE_URL}{version_name}-Linux-x86_64.sh"
    
    def download_file(self, url, destination):
        """下载文件"""
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(destination, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if self.progress_callback and total_size > 0:
                            progress = int((downloaded / total_size) * 100)
                            self.progress_callback(f"下载中... {progress}%")
            
            return True
        except Exception as e:
            if self.progress_callback:
                self.progress_callback(f"下载失败: {e}")
            return False
    
    def install_windows(self, installer_path):
        """Windows上安装Miniconda"""
        try:
            if self.progress_callback:
                self.progress_callback("正在安装Miniconda...")
            
            # 使用静默安装参数
            cmd = [
                str(installer_path),
                "/S",  # 静默安装
                f"/D={self.install_path}",  # 安装目录
                "/AddToPath=0",  # 不添加到PATH
                "/RegisterPython=0"  # 不注册Python
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                if self.progress_callback:
                    self.progress_callback("Miniconda安装成功")
                return True
            else:
                if self.progress_callback:
                    self.progress_callback(f"安装失败: {result.stderr}")
                return False
                
        except Exception as e:
            if self.progress_callback:
                self.progress_callback(f"安装出错: {e}")
            return False
    
    def install_unix(self, installer_path):
        """Unix/Linux/macOS上安装Miniconda"""
        try:
            if self.progress_callback:
                self.progress_callback("正在安装Miniconda...")
            
            # 使安装脚本可执行
            os.chmod(installer_path, 0o755)
            
            # 执行安装
            cmd = [
                str(installer_path),
                "-b",  # 批处理模式
                f"-p={self.install_path}",  # 安装路径
                "-f"  # 强制覆盖
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                if self.progress_callback:
                    self.progress_callback("Miniconda安装成功")
                return True
            else:
                if self.progress_callback:
                    self.progress_callback(f"安装失败: {result.stderr}")
                return False
                
        except Exception as e:
            if self.progress_callback:
                self.progress_callback(f"安装出错: {e}")
            return False
    
    def install(self, version):
        """安装Miniconda"""
        try:
            if self.progress_callback:
                self.progress_callback("开始安装Miniconda...")
            
            # 获取下载URL
            url = self.get_download_url(version)
            
            # 创建临时目录
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                filename = url.split('/')[-1]
                installer_path = temp_path / filename
                
                if self.progress_callback:
                    self.progress_callback(f"正在下载: {filename}")
                
                # 下载安装程序
                if not self.download_file(url, installer_path):
                    return False
                
                # 执行安装
                if sys.platform == "win32":
                    return self.install_windows(installer_path)
                else:
                    return self.install_unix(installer_path)
                    
        except Exception as e:
            if self.progress_callback:
                self.progress_callback(f"安装过程出错: {e}")
            return False
    
    def verify_installation(self):
        """验证安装"""
        conda_exe = None
        
        if sys.platform == "win32":
            conda_exe = self.install_path / "Scripts" / "conda.exe"
        else:
            conda_exe = self.install_path / "bin" / "conda"
        
        if conda_exe.exists():
            try:
                result = subprocess.run(
                    [str(conda_exe), "--version"],
                    capture_output=True,
                    text=True
                )
                return result.returncode == 0
            except:
                return False
        
        return False

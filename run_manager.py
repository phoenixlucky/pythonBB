#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python & Miniconda 环境管理器启动脚本
检查依赖并启动主程序
"""
import sys
import os
from pathlib import Path

def check_dependencies():
    """检查必要的依赖"""
    missing_deps = []
    
    # 检查requests模块
    try:
        import requests
    except ImportError:
        missing_deps.append("requests")
    
    return missing_deps

def install_dependencies(missing_deps):
    """安装缺失的依赖"""
    print("正在安装缺失的依赖...")
    
    for dep in missing_deps:
        print(f"安装 {dep}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep])
            print(f"{dep} 安装成功")
        except subprocess.CalledProcessError as e:
            print(f"安装 {dep} 失败: {e}")
            return False
    
    print("所有依赖安装完成")
    return True

def main():
    """主函数"""
    print("Python & Miniconda 环境管理器")
    print("=" * 40)
    
    # 检查Python版本
    if sys.version_info < (3, 7):
        print("错误: 需要Python 3.7或更高版本")
        print(f"当前版本: {sys.version}")
        input("按回车键退出...")
        sys.exit(1)
    
    print(f"Python版本: {sys.version}")
    
    # 检查依赖
    missing = check_dependencies()
    if missing:
        print(f"缺少依赖: {', '.join(missing)}")
        
        response = input("是否自动安装缺失的依赖? (y/n): ").lower().strip()
        if response == 'y':
            if not install_dependencies(missing):
                print("依赖安装失败，请手动安装:")
                print(f"pip install {' '.join(missing)}")
                input("按回车键退出...")
                sys.exit(1)
        else:
            print("请手动安装缺失的依赖:")
            print(f"pip install {' '.join(missing)}")
            input("按回车键退出...")
            sys.exit(1)
    
    # 启动主程序
    try:
        from python_manager import PythonManager
        
        print("启动环境管理器...")
        app = PythonManager()
        app.run()
        
    except ImportError as e:
        print(f"导入主程序失败: {e}")
        print("请确保python_manager.py在同一目录下")
        input("按回车键退出...")
        sys.exit(1)
    
    except Exception as e:
        print(f"运行时出错: {e}")
        input("按回车键退出...")
        sys.exit(1)

if __name__ == "__main__":
    main()

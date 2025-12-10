#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化版启动脚本
不依赖外部库，直接启动主程序
"""
import sys
import subprocess

def install_requests():
    """安装requests库"""
    try:
        print("正在安装requests库...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
        print("requests库安装成功")
        return True
    except subprocess.CalledProcessError:
        print("requests库安装失败")
        return False

def main():
    """主函数"""
    print("Python & Miniconda 环境管理器")
    print("=" * 40)
    
    # 检查Python版本
    if sys.version_info < (3, 7):
        print("错误: 需要Python 3.7或更高版本")
        input("按回车键退出...")
        return
    
    print(f"Python版本: {sys.version}")
    
    # 尝试导入requests，如果失败则安装
    try:
        import requests
        print("requests库已就绪")
    except ImportError:
        print("检测到缺少requests库")
        response = input("是否自动安装? (y/n): ").lower().strip()
        if response == 'y':
            if not install_requests():
                print("请手动安装: pip install requests")
                input("按回车键退出...")
                return
        else:
            print("请手动安装: pip install requests")
            input("按回车键退出...")
            return
    
    # 启动主程序
    try:
        print("启动环境管理器...")
        from python_manager import PythonManager
        app = PythonManager()
        app.run()
        
    except ImportError as e:
        print(f"导入错误: {e}")
        print("请确保所有文件都在同一目录下")
        input("按回车键退出...")
    
    except Exception as e:
        print(f"运行错误: {e}")
        input("按回车键退出...")

if __name__ == "__main__":
    main()

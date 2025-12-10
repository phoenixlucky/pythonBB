#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试Conda环境检测功能
"""
import sys
import os
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent))

try:
    from environment_manager import EnvironmentManager
    
    print("Conda环境检测测试")
    print("=" * 50)
    
    # 创建环境管理器
    env_manager = EnvironmentManager()
    
    # 检查conda是否可用
    print(f"Conda是否可用: {env_manager.is_conda_available()}")
    if env_manager.conda_exe:
        print(f"Conda路径: {env_manager.conda_exe}")
    else:
        print("未找到conda可执行文件")
        print("\n请检查:")
        print("1. Miniconda/Anaconda是否已安装")
        print("2. conda是否在PATH中")
        print("3. 在程序中配置正确的conda路径")
        sys.exit(1)
    
    print("\n正在检测Conda环境...")
    
    # 获取环境列表
    environments = env_manager.list_conda_environments()
    
    if environments:
        print(f"\n找到 {len(environments)} 个Conda环境:")
        print("-" * 50)
        
        for env in environments:
            print(f"名称: {env['name']}")
            print(f"路径: {env['path']}")
            print(f"Python版本: {env['python_version']}")
            print("-" * 30)
    else:
        print("未找到任何Conda环境")
        print("\n可能的原因:")
        print("1. 环境列表获取失败")
        print("2. conda配置有问题")
        print("3. 环境文件损坏")
    
    # 测试运行conda命令
    print("\n测试Conda命令...")
    success, stdout, stderr = env_manager.run_conda_command(["--version"])
    
    if success:
        print(f"Conda版本: {stdout.strip()}")
    else:
        print(f"Conda命令执行失败: {stderr}")
    
    print("\n环境检测完成!")

except ImportError as e:
    print(f"导入错误: {e}")
    print("请确保environment_manager.py在当前目录中")

except Exception as e:
    print(f"测试出错: {e}")
    import traceback
    traceback.print_exc()

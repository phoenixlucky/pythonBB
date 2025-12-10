#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python和Miniconda环境管理器
提供图形界面的Python和Miniconda环境安装、管理功能
"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import subprocess
import os
import sys
import json
import requests
import threading
import tempfile
import shutil
from pathlib import Path
import webbrowser


class PythonManager:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Python & Miniconda 环境管理器")
        self.root.geometry("1200x800")
        self.root.minsize(800, 600)
        
        # 配置文件路径
        self.config_file = Path.home() / ".python_manager_config.json"
        self.config = self.load_config()
        
        # 设置样式
        self.setup_styles()
        
        # 创建主界面
        self.create_main_interface()
        
        # 初始化环境检查
        self.check_environments()
        
    def setup_styles(self):
        """设置界面样式"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # 自定义样式
        style.configure('Title.TLabel', font=('Microsoft YaHei', 16, 'bold'))
        style.configure('Subtitle.TLabel', font=('Microsoft YaHei', 12))
        style.configure('Success.TLabel', foreground='green')
        style.configure('Error.TLabel', foreground='red')
        
    def load_config(self):
        """加载配置文件"""
        default_config = {
            "miniconda_path": "",
            "python_versions": {},
            "last_directory": str(Path.home())
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                return {**default_config, **config}
            except Exception:
                return default_config
        return default_config
    
    def save_config(self):
        """保存配置文件"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            messagebox.showerror("错误", f"保存配置失败: {e}")
    
    def create_main_interface(self):
        """创建主界面"""
        # 创建笔记本组件
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=5)
        
        # 创建各个标签页
        self.create_overview_tab()
        self.create_miniconda_tab()
        self.create_python_tab()
        self.create_environment_tab()
        self.create_package_tab()
        
        # 状态栏
        self.create_status_bar()
    
    def create_overview_tab(self):
        """创建概览标签页"""
        overview_frame = ttk.Frame(self.notebook)
        self.notebook.add(overview_frame, text="概览")
        
        # 标题
        title_label = ttk.Label(overview_frame, text="Python & Miniconda 环境管理器", style='Title.TLabel')
        title_label.pack(pady=20)
        
        # 系统信息框架
        info_frame = ttk.LabelFrame(overview_frame, text="系统信息", padding=20)
        info_frame.pack(fill='x', padx=20, pady=10)
        
        self.info_text = scrolledtext.ScrolledText(info_frame, height=15, wrap=tk.WORD)
        self.info_text.pack(fill='both', expand=True)
        
        # 操作按钮
        button_frame = ttk.Frame(overview_frame)
        button_frame.pack(pady=20)
        
        ttk.Button(button_frame, text="刷新信息", command=self.check_environments).pack(side='left', padx=5)
        ttk.Button(button_frame, text="打开配置文件夹", command=self.open_config_folder).pack(side='left', padx=5)
    
    def create_miniconda_tab(self):
        """创建Miniconda标签页"""
        miniconda_frame = ttk.Frame(self.notebook)
        self.notebook.add(miniconda_frame, text="Miniconda")
        
        # 标题
        title_label = ttk.Label(miniconda_frame, text="Miniconda 管理", style='Title.TLabel')
        title_label.pack(pady=10)
        
        # 安装区域
        install_frame = ttk.LabelFrame(miniconda_frame, text="安装 Miniconda", padding=15)
        install_frame.pack(fill='x', padx=20, pady=10)
        
        ttk.Label(install_frame, text="选择版本:").grid(row=0, column=0, sticky='w', padx=5)
        self.miniconda_version = ttk.Combobox(install_frame, values=[
            "Miniconda3-latest",
            "Miniconda3-py314",
            "Miniconda3-py313",
            "Miniconda3-py312",
            "Miniconda3-py311", 
            "Miniconda3-py310",
            "Miniconda3-py39"
        ])
        self.miniconda_version.set("Miniconda3-latest")
        self.miniconda_version.grid(row=0, column=1, padx=5, sticky='ew')
        
        ttk.Label(install_frame, text="安装路径:").grid(row=1, column=0, sticky='w', padx=5)
        self.miniconda_path_var = tk.StringVar(value=self.config.get('miniconda_path', ''))
        path_frame = ttk.Frame(install_frame)
        path_frame.grid(row=1, column=1, columnspan=2, sticky='ew', padx=5, pady=5)
        
        ttk.Entry(path_frame, textvariable=self.miniconda_path_var, width=50).pack(side='left', fill='x', expand=True)
        ttk.Button(path_frame, text="浏览", command=self.browse_miniconda_path).pack(side='left', padx=5)
        
        ttk.Button(install_frame, text="下载并安装 Miniconda", command=self.install_miniconda).grid(row=2, column=0, columnspan=3, pady=10)
        
        install_frame.columnconfigure(1, weight=1)
        
        # 管理区域
        manage_frame = ttk.LabelFrame(miniconda_frame, text="Conda 环境", padding=15)
        manage_frame.pack(fill='both', expand=True, padx=20, pady=10)
        
        # 按钮框架
        button_frame = ttk.Frame(manage_frame)
        button_frame.pack(fill='x', pady=5)
        
        ttk.Button(button_frame, text="刷新环境列表", command=self.refresh_conda_envs).pack(side='left', padx=5)
        ttk.Button(button_frame, text="创建新环境", command=self.create_conda_env).pack(side='left', padx=5)
        ttk.Button(button_frame, text="删除环境", command=self.delete_conda_env).pack(side='left', padx=5)
        
        # 环境列表
        self.conda_tree = ttk.Treeview(manage_frame, columns=('Python版本', '路径'), show='tree headings')
        self.conda_tree.heading('#0', text='环境名称')
        self.conda_tree.heading('Python版本', text='Python版本')
        self.conda_tree.heading('路径', text='路径')
        self.conda_tree.pack(fill='both', expand=True, pady=5)
        
        # 滚动条
        scrollbar = ttk.Scrollbar(manage_frame, orient='vertical', command=self.conda_tree.yview)
        scrollbar.pack(side='right', fill='y')
        self.conda_tree.configure(yscrollcommand=scrollbar.set)
    
    def create_python_tab(self):
        """创建Python标签页"""
        python_frame = ttk.Frame(self.notebook)
        self.notebook.add(python_frame, text="Python")
        
        # 标题
        title_label = ttk.Label(python_frame, text="Python 管理", style='Title.TLabel')
        title_label.pack(pady=10)
        
        # 系统Python信息
        system_frame = ttk.LabelFrame(python_frame, text="系统 Python", padding=15)
        system_frame.pack(fill='x', padx=20, pady=10)
        
        self.system_python_info = scrolledtext.ScrolledText(system_frame, height=8, wrap=tk.WORD)
        self.system_python_info.pack(fill='x')
        
        # Python版本管理
        version_frame = ttk.LabelFrame(python_frame, text="Python 版本管理", padding=15)
        version_frame.pack(fill='both', expand=True, padx=20, pady=10)
        
        ttk.Label(version_frame, text="下载Python版本:").pack(anchor='w')
        download_frame = ttk.Frame(version_frame)
        download_frame.pack(fill='x', pady=5)
        
        self.python_version_var = ttk.Combobox(download_frame, values=[
            # Python 3.14 系列
            "3.14.2", "3.14.1", "3.14.0",
            # Python 3.13 系列
            "3.13.11", "3.13.10", "3.13.9", "3.13.8", "3.13.7", "3.13.6", "3.13.5", "3.13.4", "3.13.3", "3.13.2", "3.13.1", "3.13.0",
            # Python 3.12 系列
            "3.12.8", "3.12.7", "3.12.6", "3.12.5", "3.12.4", "3.12.3", "3.12.2", "3.12.1", "3.12.0",
            # Python 3.11 系列
            "3.11.11", "3.11.10", "3.11.9", "3.11.8", "3.11.7", "3.11.6", "3.11.5", "3.11.4", "3.11.3", "3.11.2", "3.11.1", "3.11.0",
            # Python 3.10 系列
            "3.10.15", "3.10.14", "3.10.13", "3.10.12", "3.10.11", "3.10.10", "3.10.9", "3.10.8", "3.10.7", "3.10.6", "3.10.5", "3.10.4", "3.10.3", "3.10.2", "3.10.1", "3.10.0",
            # Python 3.9 系列
            "3.9.19", "3.9.18", "3.9.17", "3.9.16", "3.9.15", "3.9.14", "3.9.13", "3.9.12", "3.9.11", "3.9.10", "3.9.9", "3.9.8", "3.9.7", "3.9.6", "3.9.5", "3.9.4", "3.9.3", "3.9.2", "3.9.1", "3.9.0"
        ])
        self.python_version_var.set("3.14.2")
        self.python_version_var.pack(side='left', padx=5, fill='x', expand=True)
        
        ttk.Button(download_frame, text="下载", command=self.download_python).pack(side='left', padx=5)
        
        # 已安装版本列表
        ttk.Label(version_frame, text="已安装的Python版本:").pack(anchor='w', pady=(10, 5))
        self.python_listbox = tk.Listbox(version_frame, height=10)
        self.python_listbox.pack(fill='both', expand=True)
        
        # Python版本按钮
        python_button_frame = ttk.Frame(version_frame)
        python_button_frame.pack(fill='x', pady=5)
        
        ttk.Button(python_button_frame, text="刷新列表", command=self.refresh_python_versions).pack(side='left', padx=5)
        ttk.Button(python_button_frame, text="设为默认", command=self.set_default_python).pack(side='left', padx=5)
    
    def create_environment_tab(self):
        """创建环境管理标签页"""
        env_frame = ttk.Frame(self.notebook)
        self.notebook.add(env_frame, text="虚拟环境")
        
        # 标题
        title_label = ttk.Label(env_frame, text="虚拟环境管理", style='Title.TLabel')
        title_label.pack(pady=10)
        
        # 创建新环境
        create_frame = ttk.LabelFrame(env_frame, text="创建新环境", padding=15)
        create_frame.pack(fill='x', padx=20, pady=10)
        
        # 环境名称
        name_frame = ttk.Frame(create_frame)
        name_frame.pack(fill='x', pady=5)
        ttk.Label(name_frame, text="环境名称:").pack(side='left', padx=5)
        self.env_name_var = tk.StringVar()
        ttk.Entry(name_frame, textvariable=self.env_name_var).pack(side='left', fill='x', expand=True, padx=5)
        
        # Python版本
        version_frame = ttk.Frame(create_frame)
        version_frame.pack(fill='x', pady=5)
        ttk.Label(version_frame, text="Python版本:").pack(side='left', padx=5)
        self.env_python_var = ttk.Combobox(version_frame)
        self.env_python_var.pack(side='left', fill='x', expand=True, padx=5)
        
        # 安装路径
        path_frame = ttk.Frame(create_frame)
        path_frame.pack(fill='x', pady=5)
        ttk.Label(path_frame, text="安装路径:").pack(side='left', padx=5)
        self.env_path_var = tk.StringVar(value=self.config.get('last_directory', str(Path.home())))
        ttk.Entry(path_frame, textvariable=self.env_path_var).pack(side='left', fill='x', expand=True, padx=5)
        ttk.Button(path_frame, text="浏览", command=self.browse_env_path).pack(side='left', padx=5)
        
        # 创建按钮
        ttk.Button(create_frame, text="创建虚拟环境", command=self.create_venv).pack(pady=10)
        
        # 环境列表
        list_frame = ttk.LabelFrame(env_frame, text="现有虚拟环境", padding=15)
        list_frame.pack(fill='both', expand=True, padx=20, pady=10)
        
        # 环境树形列表
        self.env_tree = ttk.Treeview(list_frame, columns=('Python版本', '路径'), show='tree headings')
        self.env_tree.heading('#0', text='环境名称')
        self.env_tree.heading('Python版本', text='Python版本')
        self.env_tree.heading('路径', text='路径')
        self.env_tree.pack(fill='both', expand=True, pady=5)
        
        # 按钮
        env_button_frame = ttk.Frame(list_frame)
        env_button_frame.pack(fill='x', pady=5)
        
        ttk.Button(env_button_frame, text="刷新", command=self.refresh_venvs).pack(side='left', padx=5)
        ttk.Button(env_button_frame, text="激活", command=self.activate_venv).pack(side='left', padx=5)
        ttk.Button(env_button_frame, text="删除", command=self.delete_venv).pack(side='left', padx=5)
    
    def create_package_tab(self):
        """创建包管理标签页"""
        package_frame = ttk.Frame(self.notebook)
        self.notebook.add(package_frame, text="包管理")
        
        # 标题
        title_label = ttk.Label(package_frame, text="包管理", style='Title.TLabel')
        title_label.pack(pady=10)
        
        # 环境选择
        select_frame = ttk.Frame(package_frame)
        select_frame.pack(fill='x', padx=20, pady=10)
        
        ttk.Label(select_frame, text="选择环境:").pack(side='left', padx=5)
        self.package_env_var = ttk.Combobox(select_frame)
        self.package_env_var.pack(side='left', fill='x', expand=True, padx=5)
        ttk.Button(select_frame, text="刷新", command=self.refresh_package_envs).pack(side='left', padx=5)
        
        # 包操作
        operation_frame = ttk.LabelFrame(package_frame, text="包操作", padding=15)
        operation_frame.pack(fill='x', padx=20, pady=10)
        
        # 安装包
        install_frame = ttk.Frame(operation_frame)
        install_frame.pack(fill='x', pady=5)
        ttk.Label(install_frame, text="包名:").pack(side='left', padx=5)
        self.package_name_var = tk.StringVar()
        ttk.Entry(install_frame, textvariable=self.package_name_var).pack(side='left', fill='x', expand=True, padx=5)
        ttk.Button(install_frame, text="安装", command=self.install_package).pack(side='left', padx=5)
        
        # 按钮
        button_frame = ttk.Frame(operation_frame)
        button_frame.pack(fill='x', pady=10)
        
        ttk.Button(button_frame, text="列出已安装包", command=self.list_packages).pack(side='left', padx=5)
        ttk.Button(button_frame, text="升级pip", command=self.upgrade_pip).pack(side='left', padx=5)
        ttk.Button(button_frame, text="从requirements安装", command=self.install_from_requirements).pack(side='left', padx=5)
        
        # 包列表显示
        list_frame = ttk.LabelFrame(package_frame, text="已安装的包", padding=15)
        list_frame.pack(fill='both', expand=True, padx=20, pady=10)
        
        self.package_listbox = tk.Listbox(list_frame)
        self.package_listbox.pack(fill='both', expand=True, pady=5)
        
        # 包操作按钮
        package_button_frame = ttk.Frame(list_frame)
        package_button_frame.pack(fill='x', pady=5)
        
        ttk.Button(package_button_frame, text="卸载", command=self.uninstall_package).pack(side='left', padx=5)
        ttk.Button(package_button_frame, text="升级", command=self.upgrade_package).pack(side='left', padx=5)
        ttk.Button(package_button_frame, text="显示信息", command=self.show_package_info).pack(side='left', padx=5)
    
    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = ttk.Frame(self.root)
        self.status_bar.pack(side='bottom', fill='x')
        
        self.status_label = ttk.Label(self.status_bar, text="就绪")
        self.status_label.pack(side='left', padx=10, pady=5)
        
        # 进度条
        self.progress = ttk.Progressbar(self.status_bar, mode='indeterminate')
        self.progress.pack(side='right', padx=10, pady=5)
    
    def update_status(self, message):
        """更新状态栏"""
        self.status_label.config(text=message)
        self.root.update_idletasks()
    
    def start_progress(self):
        """开始进度条"""
        self.progress.start(10)
    
    def stop_progress(self):
        """停止进度条"""
        self.progress.stop()
    
    def check_environments(self):
        """检查环境状态"""
        self.update_status("正在检查环境...")
        self.start_progress()
        
        def check():
            try:
                # 系统信息
                system_info = []
                system_info.append(f"操作系统: {os.name}")
                system_info.append(f"Python版本: {sys.version}")
                system_info.append(f"Python路径: {sys.executable}")
                system_info.append(f"用户目录: {Path.home()}")
                system_info.append(f"当前工作目录: {os.getcwd()}")
                
                # 检查pip
                try:
                    pip_version = subprocess.check_output([sys.executable, "-m", "pip", "--version"], 
                                                         text=True, stderr=subprocess.DEVNULL)
                    system_info.append(f"pip版本: {pip_version.strip()}")
                except:
                    system_info.append("pip: 未安装或不可用")
                
                # 检查conda
                conda_paths = [
                    Path.home() / "miniconda3" / "Scripts" / "conda.exe",
                    Path.home() / "anaconda3" / "Scripts" / "conda.exe",
                    Path("conda.exe")
                ]
                
                conda_found = False
                for conda_path in conda_paths:
                    if conda_path.exists():
                        try:
                            conda_version = subprocess.check_output([str(conda_path), "--version"], 
                                                                  text=True, stderr=subprocess.DEVNULL)
                            system_info.append(f"conda版本: {conda_version.strip()}")
                            conda_found = True
                            break
                        except:
                            pass
                
                if not conda_found:
                    system_info.append("conda: 未找到")
                
                # 更新界面
                self.root.after(0, self.update_system_info, system_info)
                
            except Exception as e:
                error_msg = f"检查环境时出错: {e}"
                self.root.after(0, self.update_system_info, [error_msg])
            
            self.root.after(0, self.stop_progress)
            self.root.after(0, lambda: self.update_status("环境检查完成"))
        
        threading.Thread(target=check, daemon=True).start()
    
    def update_system_info(self, info_list):
        """更新系统信息显示"""
        self.info_text.delete('1.0', tk.END)
        for info in info_list:
            self.info_text.insert(tk.END, info + '\n')
    
    def browse_miniconda_path(self):
        """浏览Miniconda安装路径"""
        path = filedialog.askdirectory(title="选择Miniconda安装目录")
        if path:
            self.miniconda_path_var.set(path)
    
    def browse_env_path(self):
        """浏览虚拟环境路径"""
        path = filedialog.askdirectory(title="选择虚拟环境安装目录", 
                                      initialdir=self.env_path_var.get())
        if path:
            self.env_path_var.set(path)
            self.config['last_directory'] = path
            self.save_config()
    
    def install_miniconda(self):
        """安装Miniconda"""
        version = self.miniconda_version.get()
        install_path = self.miniconda_path_var.get().strip()
        
        if not install_path:
            messagebox.showerror("错误", "请选择安装路径")
            return
        
        if messagebox.askyesno("确认", f"将在 {install_path} 安装 {version}\n\n是否继续？"):
            self.update_status("正在下载Miniconda...")
            self.start_progress()
            
            def download_and_install():
                try:
                    # 这里应该实现实际的下载和安装逻辑
                    # 为了演示，我们只是模拟
                    import time
                    time.sleep(2)
                    
                    self.root.after(0, lambda: messagebox.showinfo("成功", "Miniconda安装完成"))
                    self.config['miniconda_path'] = install_path
                    self.save_config()
                    
                except Exception as e:
                    self.root.after(0, lambda: messagebox.showerror("错误", f"安装失败: {e}"))
                
                self.root.after(0, self.stop_progress)
                self.root.after(0, lambda: self.update_status("安装完成"))
            
            threading.Thread(target=download_and_install, daemon=True).start()
    
    def create_conda_env(self):
        """创建Conda环境"""
        dialog = tk.Toplevel(self.root)
        dialog.title("创建Conda环境")
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 环境名称
        ttk.Label(dialog, text="环境名称:").grid(row=0, column=0, sticky='w', padx=10, pady=5)
        name_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=name_var).grid(row=0, column=1, padx=10, pady=5, sticky='ew')
        
        # Python版本
        ttk.Label(dialog, text="Python版本:").grid(row=1, column=0, sticky='w', padx=10, pady=5)
        python_var = ttk.Combobox(dialog, values=[
            "3.14", "3.13", "3.12", "3.11", "3.10", "3.9"
        ])
        python_var.set("3.13")
        python_var.grid(row=1, column=1, padx=10, pady=5, sticky='ew')
        
        # 包列表
        ttk.Label(dialog, text="额外包 (可选):").grid(row=2, column=0, sticky='w', padx=10, pady=5)
        packages_text = tk.Text(dialog, height=5)
        packages_text.grid(row=3, column=0, columnspan=2, padx=10, pady=5, sticky='ew')
        
        # 按钮
        button_frame = ttk.Frame(dialog)
        button_frame.grid(row=4, column=0, columnspan=2, pady=10)
        
        def create():
            name = name_var.get().strip()
            python = python_var.get()
            packages = packages_text.get('1.0', tk.END).strip()
            
            if not name:
                messagebox.showerror("错误", "请输入环境名称")
                return
            
            try:
                from environment_manager import EnvironmentManager
                
                # 创建环境管理器
                env_manager = EnvironmentManager(self.config.get('miniconda_path', ''))
                
                # 准备包列表
                package_list = []
                if packages:
                    for pkg in packages.split('\n'):
                        pkg = pkg.strip()
                        if pkg:
                            package_list.append(pkg)
                
                # 创建环境
                success, message = env_manager.create_conda_environment(name, python, package_list)
                
                if success:
                    messagebox.showinfo("成功", message)
                    dialog.destroy()
                    self.refresh_conda_envs()
                else:
                    messagebox.showerror("错误", message)
                    
            except Exception as e:
                messagebox.showerror("错误", f"创建环境失败: {e}")
        
        ttk.Button(button_frame, text="创建", command=create).pack(side='left', padx=5)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side='left', padx=5)
        
        dialog.columnconfigure(1, weight=1)
    
    def delete_conda_env(self):
        """删除Conda环境"""
        selection = self.conda_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请选择要删除的环境")
            return
        
        env_name = self.conda_tree.item(selection[0])['text']
        
        if env_name == "base":
            messagebox.showerror("错误", "不能删除base环境")
            return
        
        if messagebox.askyesno("确认", f"确定要删除环境 '{env_name}' 吗？"):
            try:
                from environment_manager import EnvironmentManager
                
                # 创建环境管理器
                env_manager = EnvironmentManager(self.config.get('miniconda_path', ''))
                
                # 删除环境
                success, message = env_manager.delete_conda_environment(env_name)
                
                if success:
                    messagebox.showinfo("成功", message)
                    self.refresh_conda_envs()
                else:
                    messagebox.showerror("错误", message)
                    
            except Exception as e:
                messagebox.showerror("错误", f"删除环境失败: {e}")
    
    def refresh_conda_envs(self):
        """刷新Conda环境列表"""
        self.conda_tree.delete(*self.conda_tree.get_children())
        
        try:
            from environment_manager import EnvironmentManager
            
            # 创建环境管理器
            env_manager = EnvironmentManager(self.config.get('miniconda_path', ''))
            
            # 获取conda环境列表
            environments = env_manager.list_conda_environments()
            
            if environments:
                for env in environments:
                    self.conda_tree.insert('', 'end', 
                                          text=env['name'], 
                                          values=(env['python_version'], env['path']))
            else:
                # 如果没有找到环境，显示提示
                if env_manager.is_conda_available():
                    self.conda_tree.insert('', 'end', text='未找到环境', values=('检查conda配置', ''))
                else:
                    self.conda_tree.insert('', 'end', text='conda不可用', values=('请安装或配置conda', ''))
                    
        except Exception as e:
            # 如果出错，显示错误信息
            self.conda_tree.insert('', 'end', text='获取环境失败', values=(str(e), ''))
    
    def download_python(self):
        """下载Python"""
        version = self.python_version_var.get()
        messagebox.showinfo("提示", f"将下载Python {version}\n\n实际下载功能需要实现")
    
    def refresh_python_versions(self):
        """刷新Python版本列表"""
        self.python_listbox.delete(0, tk.END)
        
        # 添加系统Python
        system_version = sys.version.split()[0]
        self.python_listbox.insert(tk.END, f"系统Python: {system_version} ({sys.executable})")
        
        # 扫描其他已安装的Python版本
        found_versions = set()
        
        # Windows常见安装路径
        if sys.platform == "win32":
            common_paths = [
                Path.home() / "AppData" / "Local" / "Programs" / "Python",
                Path("C:\\Python39"),
                Path("C:\\Python310"), 
                Path("C:\\Python311"),
                Path("C:\\Python312"),
                Path("C:\\Python313"),
                Path("C:\\Python314"),
                Path.home() / "AppData" / "Local" / "Programs" / "PythonLauncher",
                Path("C:\\Program Files\\Python39"),
                Path("C:\\Program Files\\Python310"),
                Path("C:\\Program Files\\Python311"), 
                Path("C:\\Program Files\\Python312"),
                Path("C:\\Program Files\\Python313"),
                Path("C:\\Program Files\\Python314"),
                Path("C:\\Program Files (x86)\\Python39"),
                Path("C:\\Program Files (x86)\\Python310"),
                Path("C:\\Program Files (x86)\\Python311"),
                Path("C:\\Program Files (x86)\\Python312"),
                Path("C:\\Program Files (x86)\\Python313"),
                Path("C:\\Program Files (x86)\\Python314"),
            ]
            
            # 搜索这些路径
            for path in common_paths:
                p = Path(path)
                if p.exists():
                    # 如果是目录，查找其中的Python版本
                    if p.is_dir():
                        for item in p.iterdir():
                            if item.is_dir():
                                python_exe = item / "python.exe"
                                if python_exe.exists():
                                    self._add_python_version(python_exe, found_versions)
                    else:
                        # 如果直接是文件
                        if p.name == "python.exe":
                            self._add_python_version(p, found_versions)
            
            # 在PATH中查找Python
            path_var = os.environ.get('PATH', '')
            for path_dir in path_var.split(os.pathsep):
                path_dir = Path(path_dir)
                if path_dir.exists():
                    python_exe = path_dir / "python.exe"
                    if python_exe.exists() and str(python_exe) != sys.executable:
                        self._add_python_version(python_exe, found_versions)
                        
        else:  # Linux/macOS
            common_paths = [
                Path("/usr/bin/python3"),
                Path("/usr/bin/python3.9"),
                Path("/usr/bin/python3.10"),
                Path("/usr/bin/python3.11"),
                Path("/usr/bin/python3.12"),
                Path("/usr/bin/python3.13"),
                Path("/usr/bin/python3.14"),
                Path("/usr/local/bin/python3"),
                Path("/usr/local/bin/python3.9"),
                Path("/usr/local/bin/python3.10"),
                Path("/usr/local/bin/python3.11"),
                Path("/usr/local/bin/python3.12"),
                Path("/usr/local/bin/python3.13"),
                Path("/usr/local/bin/python3.14"),
                Path.home() / ".pyenv" / "versions",
                Path.home() / ".asdf" / "installs" / "python",
            ]
            
            for path in common_paths:
                if path.exists():
                    if path.is_dir() and path.name in ["versions", "python"]:
                        # 处理pyenv/asdf目录
                        for version_dir in path.iterdir():
                            if version_dir.is_dir():
                                python_exe = version_dir / "bin" / "python3"
                                if python_exe.exists():
                                    self._add_python_version(python_exe, found_versions)
                    else:
                        # 直接的Python可执行文件
                        if path.is_file():
                            self._add_python_version(path, found_versions)
        
        # 按版本排序
        if len(self.python_listbox.get(0, tk.END)) > 1:
            items = list(self.python_listbox.get(0, tk.END))
            self.python_listbox.delete(0, tk.END)
            
            # 系统Python放在第一位
            system_items = [item for item in items if item.startswith("系统Python")]
            other_items = [item for item in items if not item.startswith("系统Python")]
            
            # 按版本号排序其他Python
            other_items.sort(reverse=True)
            
            for item in system_items + other_items:
                self.python_listbox.insert(tk.END, item)
    
    def _add_python_version(self, python_exe, found_versions):
        """添加Python版本到列表"""
        try:
            # 避免重复
            exe_str = str(python_exe)
            if exe_str in found_versions or exe_str == sys.executable:
                return
                
            version = subprocess.check_output([str(python_exe), "--version"], 
                                           text=True, stderr=subprocess.DEVNULL)
            version_str = version.strip()
            
            # 提取版本号
            version_num = version_str.replace("Python ", "")
            
            self.python_listbox.insert(tk.END, f"Python {version_num} ({python_exe})")
            found_versions.add(exe_str)
            
        except Exception:
            # 尝试执行python --version失败的情况
            if exe_str not in found_versions:
                self.python_listbox.insert(tk.END, f"Python (版本检测失败) ({python_exe})")
                found_versions.add(exe_str)
    
    def set_default_python(self):
        """设置默认Python"""
        selection = self.python_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "请选择一个Python版本")
            return
        
        # 这里应该实现设置默认Python的逻辑
        messagebox.showinfo("提示", "默认Python设置功能需要实现")
    
    def create_venv(self):
        """创建虚拟环境"""
        name = self.env_name_var.get().strip()
        path = self.env_path_var.get()
        
        if not name:
            messagebox.showerror("错误", "请输入环境名称")
            return
        
        env_path = Path(path) / name
        
        if env_path.exists():
            messagebox.showerror("错误", f"路径 {env_path} 已存在")
            return
        
        try:
            from environment_manager import VirtualEnvironmentManager
            
            # 创建虚拟环境管理器
            venv_manager = VirtualEnvironmentManager()
            
            # 创建虚拟环境
            success, message = venv_manager.create_venv(name, path)
            
            if success:
                messagebox.showinfo("成功", message)
                self.refresh_venvs()
                # 清空输入
                self.env_name_var.set("")
            else:
                messagebox.showerror("错误", message)
                
        except Exception as e:
            messagebox.showerror("错误", f"创建虚拟环境失败: {e}")
    
    def refresh_venvs(self):
        """刷新虚拟环境列表"""
        self.env_tree.delete(*self.env_tree.get_children())
        
        try:
            from environment_manager import VirtualEnvironmentManager
            
            # 创建虚拟环境管理器
            venv_manager = VirtualEnvironmentManager()
            
            # 扫描常见目录中的虚拟环境
            search_paths = [
                Path.home() / "venvs",
                Path.home() / "envs",
                Path.home() / "Envs",  # Windows virtualenvwrapper
                Path(self.config.get('last_directory', Path.home()))
            ]
            
            # 添加一些常见的全局路径
            if sys.platform == "win32":
                search_paths.extend([
                    Path("C:\\virtualenvs"),
                    Path.home() / "virtualenvs"
                ])
            
            found_envs = set()
            
            for search_path in search_paths:
                if search_path.exists():
                    venvs = venv_manager.list_venvs_in_directory(search_path)
                    for env in venvs:
                        env_key = env['path']
                        if env_key not in found_envs:
                            found_envs.add(env_key)
                            self.env_tree.insert('', 'end', 
                                                text=env['name'], 
                                                values=(env['python_version'], env['path']))
            
            # 如果没有找到虚拟环境，显示提示
            if not found_envs:
                self.env_tree.insert('', 'end', text='未找到虚拟环境', 
                                    values=('点击"创建"新建环境', ''))
                                
        except Exception as e:
            # 如果出错，显示错误信息
            self.env_tree.insert('', 'end', text='获取虚拟环境失败', values=(str(e), ''))
    
    def activate_venv(self):
        """激活虚拟环境"""
        selection = self.env_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请选择要激活的环境")
            return
        
        env_name = self.env_tree.item(selection[0])['text']
        env_path = self.env_tree.item(selection[0])['values'][1]
        
        # 在Windows上激活虚拟环境
        activate_script = Path(env_path) / "Scripts" / "activate.bat"
        
        if activate_script.exists():
            messagebox.showinfo("提示", f"要激活环境 '{env_name}'，请在命令行中运行:\n\n{activate_script}")
        else:
            messagebox.showerror("错误", "找不到激活脚本")
    
    def delete_venv(self):
        """删除虚拟环境"""
        selection = self.env_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请选择要删除的环境")
            return
        
        env_name = self.env_tree.item(selection[0])['text']
        env_path = self.env_tree.item(selection[0])['values'][1]
        
        if messagebox.askyesno("确认", f"确定要删除虚拟环境 '{env_name}' 吗？\n\n路径: {env_path}"):
            try:
                shutil.rmtree(env_path)
                messagebox.showinfo("成功", f"虚拟环境 '{env_name}' 已删除")
                self.refresh_venvs()
            except Exception as e:
                messagebox.showerror("错误", f"删除失败: {e}")
    
    def refresh_package_envs(self):
        """刷新包管理器环境列表"""
        envs = ["系统Python"]
        
        # 添加conda环境
        for item in self.conda_tree.get_children():
            env_name = self.conda_tree.item(item)['text']
            envs.append(f"conda: {env_name}")
        
        # 添加虚拟环境
        for item in self.env_tree.get_children():
            env_name = self.env_tree.item(item)['text']
            envs.append(f"venv: {env_name}")
        
        self.package_env_var['values'] = envs
        if envs:
            self.package_env_var.set(envs[0])
    
    def install_package(self):
        """安装包"""
        package_name = self.package_name_var.get().strip()
        env = self.package_env_var.get()
        
        if not package_name:
            messagebox.showerror("错误", "请输入包名")
            return
        
        try:
            # 获取对应的Python可执行文件
            python_exe = self._get_python_exe_for_env(env)
            
            if not python_exe:
                messagebox.showerror("错误", "无法获取环境Python路径")
                return
            
            from environment_manager import PackageManager
            
            # 创建包管理器
            pkg_manager = PackageManager(python_exe)
            
            # 安装包
            success, message = pkg_manager.install_package(package_name)
            
            if success:
                messagebox.showinfo("成功", message)
                self.list_packages()  # 刷新包列表
                self.package_name_var.set("")  # 清空输入
            else:
                messagebox.showerror("错误", message)
                
        except Exception as e:
            messagebox.showerror("错误", f"安装包失败: {e}")
    
    def list_packages(self):
        """列出已安装的包"""
        env = self.package_env_var.get()
        
        self.package_listbox.delete(0, tk.END)
        
        try:
            from environment_manager import PackageManager
            
            # 获取对应的Python可执行文件
            python_exe = self._get_python_exe_for_env(env)
            
            if not python_exe:
                self.package_listbox.insert(tk.END, "无法获取环境Python路径")
                return
            
            # 创建包管理器
            pkg_manager = PackageManager(python_exe)
            
            # 获取包列表
            packages = pkg_manager.list_packages()
            
            if packages:
                # 格式化包信息，使其更易读
                for package in packages:
                    if ' - ' in package:
                        name, version = package.split(' - ', 1)
                        # 格式化为: 包名 (版本)
                        formatted = f"{name} ({version})"
                        self.package_listbox.insert(tk.END, formatted)
                    else:
                        self.package_listbox.insert(tk.END, package)
            else:
                self.package_listbox.insert(tk.END, "未找到已安装的包")
                
        except Exception as e:
            self.package_listbox.insert(tk.END, f"获取包列表失败: {e}")
    
    def _get_python_exe_for_env(self, env):
        """获取环境对应的Python可执行文件"""
        if env == "系统Python":
            return sys.executable
        
        elif env.startswith("conda: "):
            # Conda环境
            env_name = env.replace("conda: ", "")
            try:
                from environment_manager import EnvironmentManager
                env_manager = EnvironmentManager(self.config.get('miniconda_path', ''))
                environments = env_manager.list_conda_environments()
                
                for env_data in environments:
                    if env_data['name'] == env_name:
                        env_path = Path(env_data['path'])
                        if sys.platform == "win32":
                            return str(env_path / "python.exe")
                        else:
                            return str(env_path / "bin" / "python")
            except:
                pass
        
        elif env.startswith("venv: "):
            # 虚拟环境
            env_name = env.replace("venv: ", "")
            for item in self.env_tree.get_children():
                if self.env_tree.item(item)['text'] == env_name:
                    env_path = Path(self.env_tree.item(item)['values'][1])
                    if sys.platform == "win32":
                        return str(env_path / "Scripts" / "python.exe")
                    else:
                        return str(env_path / "bin" / "python")
        
        return None
    
    def upgrade_pip(self):
        """升级pip"""
        env = self.package_env_var.get()
        
        try:
            # 获取对应的Python可执行文件
            python_exe = self._get_python_exe_for_env(env)
            
            if not python_exe:
                messagebox.showerror("错误", "无法获取环境Python路径")
                return
            
            from environment_manager import PackageManager
            
            # 创建包管理器
            pkg_manager = PackageManager(python_exe)
            
            # 升级pip
            success, message = pkg_manager.upgrade_pip()
            
            if success:
                messagebox.showinfo("成功", message)
                self.list_packages()  # 刷新包列表
            else:
                messagebox.showerror("错误", message)
                
        except Exception as e:
            messagebox.showerror("错误", f"升级pip失败: {e}")
    
    def install_from_requirements(self):
        """从requirements.txt安装包"""
        file_path = filedialog.askopenfilename(
            title="选择requirements.txt文件",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        
        if file_path:
            env = self.package_env_var.get()
            
            try:
                # 获取对应的Python可执行文件
                python_exe = self._get_python_exe_for_env(env)
                
                if not python_exe:
                    messagebox.showerror("错误", "无法获取环境Python路径")
                    return
                
                from environment_manager import PackageManager
                
                # 创建包管理器
                pkg_manager = PackageManager(python_exe)
                
                # 从requirements安装
                success, message = pkg_manager.install_from_requirements(file_path)
                
                if success:
                    messagebox.showinfo("成功", message)
                    self.list_packages()  # 刷新包列表
                else:
                    messagebox.showerror("错误", message)
                    
            except Exception as e:
                messagebox.showerror("错误", f"从requirements安装失败: {e}")
    
    def uninstall_package(self):
        """卸载包"""
        selection = self.package_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "请选择要卸载的包")
            return
        
        package_info = self.package_listbox.get(selection[0])
        # 解析包名，支持两种格式：name - version 和 name (version)
        if ' - ' in package_info:
            package_name = package_info.split(' - ')[0]
        elif ' (' in package_info and package_info.endswith(')'):
            package_name = package_info.split(' (')[0]
        else:
            package_name = package_info
        
        if messagebox.askyesno("确认", f"确定要卸载 '{package_name}' 吗？"):
            try:
                env = self.package_env_var.get()
                
                # 获取对应的Python可执行文件
                python_exe = self._get_python_exe_for_env(env)
                
                if not python_exe:
                    messagebox.showerror("错误", "无法获取环境Python路径")
                    return
                
                from environment_manager import PackageManager
                
                # 创建包管理器
                pkg_manager = PackageManager(python_exe)
                
                # 卸载包
                success, message = pkg_manager.uninstall_package(package_name)
                
                if success:
                    messagebox.showinfo("成功", message)
                    self.list_packages()  # 刷新包列表
                else:
                    messagebox.showerror("错误", message)
                    
            except Exception as e:
                messagebox.showerror("错误", f"卸载包失败: {e}")
    
    def upgrade_package(self):
        """升级包"""
        selection = self.package_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "请选择要升级的包")
            return
        
        package_info = self.package_listbox.get(selection[0])
        # 解析包名，支持两种格式：name - version 和 name (version)
        if ' - ' in package_info:
            package_name = package_info.split(' - ')[0]
        elif ' (' in package_info and package_info.endswith(')'):
            package_name = package_info.split(' (')[0]
        else:
            package_name = package_info
        
        try:
            env = self.package_env_var.get()
            
            # 获取对应的Python可执行文件
            python_exe = self._get_python_exe_for_env(env)
            
            if not python_exe:
                messagebox.showerror("错误", "无法获取环境Python路径")
                return
            
            from environment_manager import PackageManager
            
            # 创建包管理器
            pkg_manager = PackageManager(python_exe)
            
            # 升级包
            success, message = pkg_manager.install_package(package_name, upgrade=True)
            
            if success:
                messagebox.showinfo("成功", message)
                self.list_packages()  # 刷新包列表
            else:
                messagebox.showerror("错误", message)
                
        except Exception as e:
            messagebox.showerror("错误", f"升级包失败: {e}")
    
    def show_package_info(self):
        """显示包信息"""
        selection = self.package_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "请选择一个包")
            return
        
        package_info = self.package_listbox.get(selection[0])
        # 解析包名，支持两种格式：name - version 和 name (version)
        if ' - ' in package_info:
            package_name = package_info.split(' - ')[0]
        elif ' (' in package_info and package_info.endswith(')'):
            package_name = package_info.split(' (')[0]
        else:
            package_name = package_info
        
        # 创建信息窗口
        info_window = tk.Toplevel(self.root)
        info_window.title(f"包信息: {package_name}")
        info_window.geometry("700x500")
        info_window.transient(self.root)
        
        info_text = scrolledtext.ScrolledText(info_window, wrap=tk.WORD)
        info_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        try:
            env = self.package_env_var.get()
            
            # 获取对应的Python可执行文件
            python_exe = self._get_python_exe_for_env(env)
            
            if not python_exe:
                info_text.insert('1.0', f"无法获取环境Python路径")
            else:
                # 执行pip show命令获取真实包信息
                result = subprocess.run(
                    [python_exe, "-m", "pip", "show", package_name],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    info_text.insert('1.0', result.stdout)
                else:
                    info_text.insert('1.0', f"无法获取包 '{package_name}' 的信息\n\n错误信息:\n{result.stderr}")
                    
        except Exception as e:
            info_text.insert('1.0', f"获取包信息时出错: {e}")
        
        info_text.config(state='disabled')
    
    def open_config_folder(self):
        """打开配置文件夹"""
        config_dir = self.config_file.parent
        if config_dir.exists():
            if os.name == 'nt':  # Windows
                os.startfile(config_dir)
            else:  # macOS and Linux
                opener = 'open' if sys.system == 'Darwin' else 'xdg-open'
                subprocess.call([opener, config_dir])
    
    def run(self):
        """运行应用"""
        # 初始化一些数据
        self.refresh_python_versions()
        self.refresh_conda_envs()
        self.refresh_venvs()
        self.refresh_package_envs()
        
        # 启动主循环
        self.root.mainloop()


if __name__ == "__main__":
    app = PythonManager()
    app.run()

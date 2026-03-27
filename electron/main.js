import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "node:path";
import { startServer } from "../src/server.js";
import { buildDefaultCondaExportDirectory, buildDefaultCondaExportFilePath } from "../src/services/environment-service.js";

let mainWindow = null;
let serverHandle = null;

const APP_NAME = "WeiPython Manager";
const APP_NAME_ZH = "尉Python 环境管理器";
const APP_AUTHOR = "Ethan Wilkins";
const APP_ID = "com.weipython.desktop";
const APP_DESCRIPTION_ZH =
  "尉 Python 环境管理器是一款基于 Node.js 与 Electron 的本地桌面工具，用于统一管理 Python、Conda 和 venv 虚拟环境。支持环境创建、克隆、删除，以及 Python 包的安装、升级和卸载，并提供安装过程可视化与日志反馈，适用于开发环境管理和日常包维护场景。";
const APP_DESCRIPTION_EN =
  "Wei Python Environment Manager is a local desktop application built with Node.js and Electron. It provides a unified interface for managing Python, Conda, and venv environments. It supports environment creation, cloning, and deletion, as well as package installation, upgrade, and removal, with real-time logs and process visualization.";
const APP_ABOUT_ZH =
  "尉 Python 环境管理器是一款面向开发者的本地工具，用于统一管理 Python 及其相关环境。通过图形界面简化环境操作流程，提高开发效率。";
const APP_ABOUT_EN =
  "Wei Python Environment Manager is a local tool designed for developers to manage Python environments efficiently through a graphical interface.";
const APP_POSITIONING_ZH =
  "一个本地优先的 Python 环境管理工具，强调多环境统一管理、操作可视化和开发效率提升。";
const APP_POSITIONING_EN =
  "A local-first Python environment manager focused on unified multi-environment control, visual operations, and developer productivity.";
const APP_RELEASE_NOTE_ZH =
  "新增包安装过程可视化弹窗，支持实时日志查看与任务跟踪，优化安装反馈体验。";
const APP_RELEASE_NOTE_EN =
  "Added visual installation process window with real-time logs and task tracking, improving feedback during package operations.";

function isAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false
  });
}

function getAboutMessage() {
  return [
    `软件名称：${APP_NAME}（${APP_NAME_ZH}）`,
    `当前版本：v${app.getVersion()}`,
    `Latest Version: v${app.getVersion()}`,
    "",
    "软件简介（中文）：",
    APP_DESCRIPTION_ZH,
    "",
    "Software Description (English):",
    APP_DESCRIPTION_EN,
    "",
    "关于页（中文）：",
    APP_ABOUT_ZH,
    "",
    "About (English):",
    APP_ABOUT_EN,
    "",
    "核心定位（中文）：",
    APP_POSITIONING_ZH,
    "",
    "Core Positioning (English):",
    APP_POSITIONING_EN,
    "",
    "版本说明（简短）：",
    APP_RELEASE_NOTE_ZH,
    "",
    "Release Note (English):",
    APP_RELEASE_NOTE_EN,
    "",
    `开发者 / Developer: ${APP_AUTHOR}`
  ].join("\n");
}

async function showAboutDialog() {
  const version = app.getVersion();
  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: `关于 ${APP_NAME}`,
    message: `${APP_NAME} / ${APP_NAME_ZH} v${version}`,
    detail: getAboutMessage(),
    buttons: ["确定"]
  });
}

async function toggleAutoLaunch(menuItem) {
  try {
    setAutoLaunchEnabled(menuItem.checked);
    buildApplicationMenu();
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: `${APP_NAME} / ${APP_NAME_ZH}`,
      message: menuItem.checked ? "已启用开机自启动" : "已关闭开机自启动",
      buttons: ["确定"]
    });
  } catch (error) {
    buildApplicationMenu();
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: `${APP_NAME} 设置失败`,
      message: error.message || "无法修改开机自启动设置",
      buttons: ["确定"]
    });
  }
}

function buildApplicationMenu() {
  const isMac = process.platform === "darwin";
  const autoLaunchEnabled = isAutoLaunchEnabled();
  const template = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              {
                label: `关于 ${APP_NAME}`,
                click: () => {
                  void showAboutDialog();
                }
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "设置",
      submenu: [
        {
          label: "开机自启动",
          type: "checkbox",
          checked: autoLaunchEnabled,
          click: (menuItem) => {
            void toggleAutoLaunch(menuItem);
          }
        }
      ]
    },
    {
      label: "关于",
      submenu: [
        {
          label: `关于 ${APP_NAME}`,
          click: () => {
            void showAboutDialog();
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createMainWindow() {
  serverHandle = await startServer({ port: 0 });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: false,
    title: `${APP_NAME} / ${APP_NAME_ZH}`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "electron", "preload.js")
    },
    show: false
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(serverHandle.url);
}

ipcMain.handle("dialog:choose-conda-export-path", async (_event, payload = {}) => {
  const requestedDefaultPath = String(payload?.defaultPath || "").trim();
  const defaultPath = requestedDefaultPath || buildDefaultCondaExportFilePath("conda-environment");

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "选择 Conda 环境导出文件",
    defaultPath,
    filters: [{ name: "YAML", extensions: ["yml", "yaml"] }]
  });

  return {
    canceled: result.canceled,
    filePath: result.filePath || ""
  };
});

ipcMain.handle("dialog:choose-conda-export-directory", async (_event, payload = {}) => {
  const requestedDefaultPath = String(payload?.defaultPath || "").trim();
  const defaultPath = requestedDefaultPath || buildDefaultCondaExportDirectory();

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择 Conda 环境批量导出目录",
    defaultPath,
    properties: ["openDirectory", "createDirectory"]
  });

  return {
    canceled: result.canceled,
    directoryPath: result.filePaths?.[0] || ""
  };
});

async function bootstrap() {
  try {
    buildApplicationMenu();
    await createMainWindow();
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: `${APP_NAME} 启动失败`,
      message: error.message || "无法启动桌面应用"
    });
    app.quit();
  }
}

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);
app.whenReady().then(bootstrap);

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await bootstrap();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverHandle?.server) {
    serverHandle.server.close();
  }
});

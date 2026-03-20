import { app, BrowserWindow, dialog, Menu } from "electron";
import { startServer } from "../src/server.js";

let mainWindow = null;
let serverHandle = null;

const APP_NAME = "尉Python环境管理器";
const APP_AUTHOR = "Ethan Wilkins";
const APP_ID = "com.weipython.desktop";
const APP_DESCRIPTION =
  "一个面向 Windows 的本地桌面工具，用于集中管理 Python、Conda、venv 与 pip 包操作。";
const APP_FEATURES = [
  "扫描系统中的 Python 版本",
  "检测 Conda / Miniconda 与环境列表",
  "创建、克隆、导入、导出、删除 Conda 环境",
  "查看并管理不同环境中的 Python 包"
];

function getAboutMessage() {
  return [
    `软件名称：${APP_NAME}`,
    `版本：${app.getVersion()}`,
    `作者：${APP_AUTHOR}`,
    "",
    "软件简介：",
    APP_DESCRIPTION,
    "",
    "主要功能：",
    ...APP_FEATURES.map((feature) => `- ${feature}`)
  ].join("\n");
}

async function showAboutDialog() {
  const version = app.getVersion();
  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: `关于 ${APP_NAME}`,
    message: `${APP_NAME} v${version}`,
    detail: getAboutMessage(),
    buttons: ["确定"]
  });
}

function buildApplicationMenu() {
  const isMac = process.platform === "darwin";
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
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
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

async function bootstrap() {
  try {
    buildApplicationMenu();
    await createMainWindow();
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: `${APP_NAME}启动失败`,
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

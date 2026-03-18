import { app, BrowserWindow, dialog } from "electron";
import { startServer } from "../src/server.js";

let mainWindow = null;
let serverHandle = null;

async function createMainWindow() {
  serverHandle = await startServer({ port: 0 });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    title: "尉Python环境管理器",
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
    await createMainWindow();
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "尉Python环境管理器启动失败",
      message: error.message || "无法启动桌面应用"
    });
    app.quit();
  }
}

app.setName("尉Python环境管理器");
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

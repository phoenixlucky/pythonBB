import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopAPI", {
  isDesktop() {
    return true;
  },
  chooseCondaExportPath(defaultPath) {
    return ipcRenderer.invoke("dialog:choose-conda-export-path", { defaultPath });
  },
  chooseCondaExportDirectory(defaultPath) {
    return ipcRenderer.invoke("dialog:choose-conda-export-directory", { defaultPath });
  }
});

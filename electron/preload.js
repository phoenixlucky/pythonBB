import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopAPI", {
  chooseCondaExportPath(defaultPath) {
    return ipcRenderer.invoke("dialog:choose-conda-export-path", { defaultPath });
  }
});

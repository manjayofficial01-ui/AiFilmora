const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aifimoraDesktop", {
  openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  // Returns the chosen full path (folder + file name), or null when cancelled.
  saveVideo: (opts) => ipcRenderer.invoke("dialog:saveVideo", opts),
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  // Project save/load + raw file write (used by Save dialog + real video export).
  saveProject: (opts) => ipcRenderer.invoke("dialog:saveProject", opts),
  openProject: () => ipcRenderer.invoke("dialog:openProject"),
  writeFile: (targetPath, dataBase64) => ipcRenderer.invoke("fs:writeFile", targetPath, dataBase64),
  platform: process.platform,
});

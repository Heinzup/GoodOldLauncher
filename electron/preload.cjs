const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("goodOldLauncher", {
  launchGame: (launchConfig) => ipcRenderer.invoke("launcher:launchGame", launchConfig),
  scanLibraries: (payload) => ipcRenderer.invoke("launcher:scanLibraries", payload)
});

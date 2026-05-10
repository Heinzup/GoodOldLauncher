const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("goodOldLauncher", {
  launchGame: (launchConfig) => ipcRenderer.invoke("launcher:launchGame", launchConfig),
  scanLibraries: (payload) => ipcRenderer.invoke("launcher:scanLibraries", payload),
  openGameFolder: (game) => ipcRenderer.invoke("launcher:openGameFolder", game),
  installGame: (game) => ipcRenderer.invoke("launcher:installGame", game),
  uninstallGame: (game) => ipcRenderer.invoke("launcher:uninstallGame", game),
  loginService: (serviceName) => ipcRenderer.invoke("launcher:loginService", serviceName),
  logoutService: (serviceName) => ipcRenderer.invoke("launcher:logoutService", serviceName),
  verifyServiceConnection: (serviceName) => ipcRenderer.invoke("launcher:verifyServiceConnection", serviceName),
  storeServiceCredential: (serviceName, credential) => ipcRenderer.invoke("launcher:storeServiceCredential", serviceName, credential),
  checkForUpdates: () => ipcRenderer.invoke("launcher:checkForUpdates"),
  installDownloadedUpdate: () => ipcRenderer.invoke("launcher:installDownloadedUpdate"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_, payload) => callback(payload);
    ipcRenderer.on("launcher:updateStatus", listener);
    return () => ipcRenderer.removeListener("launcher:updateStatus", listener);
  }
});

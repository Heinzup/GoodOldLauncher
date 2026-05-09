const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const { scanAllLibraries } = require("./services/launcherScanOrchestrator.cjs");
const { validateLaunchRequest } = require("./services/launchSecurity.cjs");
const { preflightCompatibility } = require("./services/compatibilityRuntime.cjs");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0d1a1c",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("launcher:launchGame", async (_, launchConfig) => {
  const { executablePath, args = [], workingDirectory } = launchConfig ?? {};

  const validation = validateLaunchRequest(launchConfig);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  if (validation.mode === "protocol") {
    await shell.openExternal(executablePath);
    return { ok: true };
  }

  const compatResult = preflightCompatibility(launchConfig);
  if (!compatResult.ok) {
    return { ok: false, error: compatResult.error };
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(executablePath, args, {
        cwd: workingDirectory || path.dirname(executablePath),
        detached: true,
        stdio: "ignore"
      });

      child.unref();
      resolve({ ok: true, notes: compatResult.notes || [] });
    } catch (error) {
      resolve({ ok: false, error: error.message });
    }
  });
});

ipcMain.handle("launcher:scanLibraries", async (_, payload) => {
  try {
    const scanConfig = {
      steamRoots: Array.isArray(payload?.steamRoots) ? payload.steamRoots : [],
      epicManifestRoots: Array.isArray(payload?.epicManifestRoots) ? payload.epicManifestRoots : [],
      gogRoots: Array.isArray(payload?.gogRoots) ? payload.gogRoots : [],
      eaRoots: Array.isArray(payload?.eaRoots) ? payload.eaRoots : [],
      customGameRoots: Array.isArray(payload?.customGameRoots) ? payload.customGameRoots : []
    };

    const data = scanAllLibraries(scanConfig);
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

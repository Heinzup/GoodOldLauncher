const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell, protocol } = require("electron");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");
const { scanAllLibraries } = require("./services/launcherScanOrchestrator.cjs");
const { validateLaunchRequest } = require("./services/launchSecurity.cjs");
const { preflightCompatibility } = require("./services/compatibilityRuntime.cjs");
const TokenStore = require("./services/tokenStore.cjs");
const { OAuthHandler } = require("./services/oauthHandlers.cjs");
const { verifyAuthConnection } = require("./services/authValidator.cjs");
const { autoDetectSteamUser } = require("./services/steamDetection.cjs");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const SERVICE_LOGIN_URLS = {
  Steam: "https://store.steampowered.com/login/",
  EA: "https://signin.ea.com/p/web2/login",
  "EA Play": "https://signin.ea.com/p/web2/login",
  Ubisoft: "https://account.ubisoft.com/",
  Epic: "https://www.epicgames.com/id/login",
  GOG: "https://login.gog.com/"
};

// Global map for OAuth windows waiting for callbacks
const oauthCallbacks = new Map();

/**
 * Otwórz OAuth window i czekaj na callback
 * @param {string} service - Nazwa serwisu (Steam, EA, Epic, GOG, Ubisoft)
 * @returns {Promise<{ok: boolean, userId?: string, token?: string, requiresManualInput?: boolean, error?: string}>}
 */
async function initiateOAuthFlow(service) {
  try {
    // Dla Steam - automatycznie wykryj zalogowanego użytkownika
    if (service.toLowerCase() === "steam") {
      const steamResult = await autoDetectSteamUser();
      
      if (!steamResult.ok) {
        return {
          ok: false,
          error: steamResult.error
        };
      }

      // Zwróć automatycznie wykryty SteamID
      return {
        ok: true,
        userId: steamResult.steamId,
        token: steamResult.steamId,
        accountName: steamResult.accountName,
        personaName: steamResult.personaName,
        autoDetected: true
      };
    }

    // Dla innych platform - wciąż wymaga manual input
    const result = await OAuthHandler.initiateAuthentication(service);
    
    if (!result.ok) {
      return {
        ok: false,
        requiresManualInput: true,
        error: result.error
      };
    }

    return result;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Weryfikuj i zapisz credentiale dla serwisu
 * @param {string} service - Nazwa serwisu
 * @param {string} credential - Token, SteamID, lub inna dostarczona wartość
 */
async function verifyAndStoreCredential(service, credential) {
  try {
    // Najpierw waliduj format
    const validation = OAuthHandler.validateCredentials(service, credential);
    if (!validation.ok) {
      return validation;
    }

    // Zapisz w secure storage
    TokenStore.setToken(service, credential, {
      verifiedAt: new Date().toISOString(),
      platform: service
    });

    // Weryfikuj czy połączenie rzeczywiście działa
    const verification = await verifyAuthConnection(service);
    return verification;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Obsługuj OAuth callback (electron://auth/...)
 */
function handleOAuthCallback(url) {
  try {
    const urlObj = new URL(url);
    const servicePath = urlObj.pathname.replace(/^\//, "");
    const [service] = servicePath.split("/");

    if (!service) {
      console.error("[OAuth] Brak service path:", url);
      return;
    }

    console.log(`[OAuth] Callback dla ${service}:`, url);

    // Znajdź pending callback
    let pendingCallback = null;
    for (const [callbackId, callback] of oauthCallbacks.entries()) {
      if (callback.service.toLowerCase() === service.toLowerCase()) {
        pendingCallback = callback;
        break;
      }
    }

    if (!pendingCallback) {
      console.error(`[OAuth] Brak pending callback dla ${service}`);
      return;
    }

    // Obsłuż callback - na razie nie implementujemy pełnego OAuth
    pendingCallback.resolve({ ok: true, requiresManualInput: true });
  } catch (error) {
    console.error("[OAuth] Błąd w handleOAuthCallback:", error);
  }
}

function buildInstallAction(game) {
  const source = String(game?.source || "");
  const gameId = String(game?.id || "");
  const appName = String(game?.launcherAppName || "");

  if (source === "Steam" && gameId.startsWith("steam-")) {
    const appId = gameId.slice(6);
    return `steam://install/${appId}`;
  }

  if (source === "Epic Games" && appName) {
    return `com.epicgames.launcher://apps/${appName}?action=install&silent=true`;
  }

  if (source === "GOG") {
    return "goggalaxy://openStore";
  }

  if (source === "EA") {
    return "https://www.ea.com/ea-app";
  }

  if (source === "Ubisoft") {
    return "https://ubisoftconnect.com/";
  }

  return null;
}

function buildUninstallAction(game) {
  const source = String(game?.source || "");
  const gameId = String(game?.id || "");
  const appName = String(game?.launcherAppName || "");

  if (source === "Steam" && gameId.startsWith("steam-")) {
    const appId = gameId.slice(6);
    return `steam://uninstall/${appId}`;
  }

  if (source === "Epic Games" && appName) {
    return `com.epicgames.launcher://apps/${appName}?action=uninstall`;
  }

  return "ms-settings:appsfeatures";
}

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

  let wasShown = false;
  const showWindow = () => {
    if (!wasShown && !mainWindow.isDestroyed()) {
      wasShown = true;
      mainWindow.show();
    }
  };

  mainWindow.once("ready-to-show", () => {
    showWindow();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    showWindow();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription, validatedURL) => {
    console.error("[Window] did-fail-load:", { errorCode, errorDescription, validatedURL });
    showWindow();
  });

  mainWindow.webContents.on("render-process-gone", (_, details) => {
    console.error("[Window] render-process-gone:", details);
    showWindow();
  });

  setTimeout(() => {
    showWindow();
  }, 1500);

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
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
    // Sprawdź czy mamy zapisany SteamID z integracji
    let steamUserId = null;
    try {
      const steamToken = TokenStore.getToken("Steam");
      if (steamToken?.token) {
        steamUserId = steamToken.token;
      }
    } catch {
      // brak tokenu - OK
    }
    console.log("[ScanLibraries] steamUserId z TokenStore:", steamUserId || "(brak)");

    const scanConfig = {
      steamRoots: Array.isArray(payload?.steamRoots) ? payload.steamRoots : [],
      epicManifestRoots: Array.isArray(payload?.epicManifestRoots) ? payload.epicManifestRoots : [],
      gogRoots: Array.isArray(payload?.gogRoots) ? payload.gogRoots : [],
      eaRoots: Array.isArray(payload?.eaRoots) ? payload.eaRoots : [],
      customGameRoots: Array.isArray(payload?.customGameRoots) ? payload.customGameRoots : [],
      steamUserId
    };

    const data = scanAllLibraries(scanConfig);
    console.log("[ScanLibraries] Znaleziono gier:", data.games?.length, "| diagnostics:", JSON.stringify(data.diagnostics));
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:openGameFolder", async (_, game) => {
  try {
    const installDirectory = typeof game?.installDirectory === "string" ? game.installDirectory : "";
    if (installDirectory) {
      await shell.openPath(installDirectory);
      return { ok: true };
    }

    const executablePath = typeof game?.executablePath === "string" ? game.executablePath : "";
    if (!executablePath || /^\w+:\/\//.test(executablePath)) {
      return { ok: false, error: "Folder docelowy nie jest dostępny dla tej gry." };
    }

    shell.showItemInFolder(executablePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:installGame", async (_, game) => {
  try {
    const action = buildInstallAction(game);
    if (!action) {
      return { ok: false, error: "Brak zdefiniowanej akcji instalacji dla tego źródła." };
    }

    await shell.openExternal(action);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:uninstallGame", async (_, game) => {
  try {
    const action = buildUninstallAction(game);
    await shell.openExternal(action);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:loginService", async (_, serviceName) => {
  try {
    const result = await initiateOAuthFlow(serviceName);
    
    if (!result.ok) {
      return result;
    }

    // Jeśli to auto-detected (Steam), zapisz token i zwróć sukces
    if (result.autoDetected) {
      TokenStore.setToken(serviceName, result.token, {
        verifiedAt: new Date().toISOString(),
        platform: serviceName,
        accountName: result.accountName,
        personaName: result.personaName
      });

      // Weryfikuj token
      const verification = await verifyAuthConnection(serviceName);
      
        return {
          ok: verification.ok,
          autoDetected: true,
          userId: result.userId,
          accountName: result.accountName,
          personaName: result.personaName,
          accountInfo: verification.accountInfo
        };
    }

    // Dla innych platform - wymaga manual input
    if (result.requiresManualInput) {
      return result;
    }

    // Weryfikuj token po zapisaniu
    const verification = await verifyAuthConnection(serviceName);
    
    return {
      ok: verification.ok,
      userId: result.userId,
      accountInfo: verification.accountInfo,
      error: verification.error
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:storeServiceCredential", async (_, serviceName, credential) => {
  try {
    // Weryfikuj i zapisz credentiale
    const result = await verifyAndStoreCredential(serviceName, credential);
    
    return result;
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:logoutService", async (_, serviceName) => {
  try {
    TokenStore.deleteToken(serviceName);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("launcher:verifyServiceConnection", async (_, serviceName) => {
  try {
    const result = await verifyAuthConnection(serviceName);
    return result;
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

app.whenReady().then(() => {
  // Rejestruj custom protocol handler dla OAuth callbacks
  // electron://auth/steam?...
  // electron://auth/epic?...
  // etc.
  protocol.registerStringProtocol("electron", (request, callback) => {
    try {
      const url = request.url;
      
      // Sprawdź czy to OAuth callback
      if (url.includes("://auth/")) {
        handleOAuthCallback(url);
      }
      
      callback({
        mimeType: "text/html",
        data: `<html><body>Przetwarzanie... możesz zamknąć to okno.</body></html>`
      });
    } catch (error) {
      console.error("[Protocol] Błąd:", error);
      callback({
        mimeType: "text/html",
        data: `<html><body>Błąd: ${error.message}</body></html>`
      });
    }
  });

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

const { BrowserWindow } = require("electron");
const { URL } = require("node:url");
const crypto = require("node:crypto");

/**
 * OAuth & OpenID handlers dla każdej platformy
 */

// ============ STEAM OPENID 2.0 ============
class SteamOpenID {
  static async authenticateUser() {
    // Otwórz Steam login w browser window
    // User musi się zalogować i skopiować SteamID64 ze swojego profilu
    // Po zalogowaniu, profil jest dostępny na https://steamcommunity.com/my
    return new Promise((resolve) => {
      const authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Załaduj Steam login page
      authWindow.loadURL("https://steamcommunity.com/login/");

      // Po zalogowaniu, Steam redirectuje do https://steamcommunity.com/my
      authWindow.webContents.on("did-navigate", (event, url) => {
        if (url.includes("steamcommunity.com/my")) {
          console.log("[Steam] Authenticated, asking for SteamID...");
          // User musi teraz pobrać SteamID64 ze swojego profilu
          // Możemy pokazać dialog z instrukcją
        }
      });

      authWindow.on("closed", () => {
        // Po zamknięciu user powinien wkleić SteamID w IntegrationsModal
        resolve({ ok: true, requiresManualSteamID: true });
      });
    });
  }

  static validateSteamID(steamID) {
    // SteamID64 to 17-cyfrowy numer
    if (!steamID || !/^\d{17}$/.test(String(steamID).trim())) {
      return { ok: false, error: "SteamID64 musi być 17-cyfrowym numerem" };
    }
    return { ok: true };
  }

  static parseSteamIDFromProfile(profileUrl) {
    // Spróbuj wyciągnąć SteamID z URL'a profilu
    const match = profileUrl.match(/\/profiles\/(\d{17})/);
    if (match && match[1]) {
      return { ok: true, steamID: match[1] };
    }
    return { ok: false, error: "Nie znaleziono SteamID w URL'u profilu" };
  }
}

// ============ EA OAUTH 2.0 ============
class EAOAuth {
  // Wymaga EA ClientID - dla testowania użyjemy manualnej autentykacji
  static async authenticateUser() {
    return {
      ok: false,
      error: "EA OAuth wymaga rejestracji aplikacji. Instrukcja: https://www.ea.com/news/new-ea-tech-support"
    };
  }
}

// ============ EPIC OAUTH 2.0 ============
class EpicOAuth {
  static async authenticateUser() {
    return {
      ok: false,
      error: "Epic OAuth wymaga rejestracji na Epic Developer Portal"
    };
  }
}

// ============ GOG OAUTH 2.0 ============
class GOGOAuth {
  static async authenticateUser() {
    return {
      ok: false,
      error: "GOG OAuth wymaga API ClientID/Secret"
    };
  }
}

// ============ UBISOFT OAUTH ============
class UbisoftOAuth {
  static async authenticateUser() {
    return {
      ok: false,
      error: "Ubisoft OAuth wymaga API ClientID/Secret"
    };
  }
}

/**
 * Główny OAuth handler manager
 */
class OAuthHandler {
  static async initiateAuthentication(service) {
    const service_lower = String(service || "").toLowerCase();

    switch (service_lower) {
      case "steam":
        return SteamOpenID.authenticateUser();
      case "ea":
      case "ea play":
        return EAOAuth.authenticateUser();
      case "epic":
      case "epic games":
        return EpicOAuth.authenticateUser();
      case "gog":
        return GOGOAuth.authenticateUser();
      case "ubisoft":
      case "ubisoft connect":
        return UbisoftOAuth.authenticateUser();
      default:
        return { ok: false, error: "Nieznana usługa" };
    }
  }

  static validateCredentials(service, credentials) {
    const service_lower = String(service || "").toLowerCase();

    switch (service_lower) {
      case "steam":
        return SteamOpenID.validateSteamID(credentials);
      default:
        return { ok: false, error: "Walidacja niespotrzebna" };
    }
  }
}

module.exports = {
  OAuthHandler,
  SteamOpenID,
  EAOAuth,
  EpicOAuth,
  GOGOAuth,
  UbisoftOAuth
};

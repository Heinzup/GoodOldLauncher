const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

/**
 * Steam VDF Parser - parsuje proste VDF format
 * @param {string} content - Zawartość VDF pliku
 * @returns {object} Sparsowany obiekt
 */
function parseVDF(content) {
  const result = {};
  const lines = content.split("\n");
  const stack = [result];
  let currentKey = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Ignoruj komentarze i puste linie
    if (!trimmed || trimmed.startsWith("//")) continue;

    // Otwierająca klamra
    if (trimmed === "{") {
      if (currentKey && stack[stack.length - 1]) {
        const newObj = {};
        stack[stack.length - 1][currentKey] = newObj;
        stack.push(newObj);
      }
      continue;
    }

    // Zamykająca klamra
    if (trimmed === "}") {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    // Key-value para z cudzysłowami: "key" "value"
    const match = trimmed.match(/^"([^"]+)"\s+"([^"]+)"$/);
    if (match) {
      const [, key, value] = match;
      if (stack[stack.length - 1]) {
        stack[stack.length - 1][key] = value;
      }
      continue;
    }

    // Samotny key - może być w cudzysłowach: "users" lub "76561198040952457"
    // Regex: ^"([^"]+)"$ -> łapie "anything" bez cudzysłowów wewnątrz
    const keyMatch = trimmed.match(/^"([^"]+)"$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
    }
  }

  return result;
}

/**
 * Czytaj Steam install directory z domyślnych lokalizacji
 * @returns {string|null} Ścieżka do Steam lub null
 */
function getSteamInstallPath() {
  try {
    if (process.platform === "win32") {
      // Szukaj w domyślnych lokalizacjach Windows
      const defaultPaths = [
        path.join(process.env.ProgramFiles || "C:\\Program Files", "Steam"),
        path.join(process.env.ProgramFilesX86 || "C:\\Program Files (x86)", "Steam"),
        "C:\\Games\\Steam",
        path.join(os.homedir(), "AppData", "Local", "Steam") // Portable Steam
      ];

      for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
          const loginUsersPath = path.join(p, "config", "LoginUsers.vdf");
          if (fs.existsSync(loginUsersPath)) {
            return p;
          }
        }
      }
    } else {
      // Linux/Mac
      const homeDir = os.homedir();
      const linuxPaths = [
        path.join(homeDir, ".steam/steam"),
        path.join(homeDir, ".steam/root"),
        path.join(homeDir, ".local/share/Steam"),
        path.join(homeDir, "Steam")
      ];

      for (const p of linuxPaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("[SteamDetection] Błąd szukania Steam:", error);
    return null;
  }
}

/**
 * Czytaj LoginUsers.vdf aby znaleźć zalogowanego użytkownika
 * @param {string} steamPath - Ścieżka do Steam
 * @returns {object|null} { steamId, accountName, personaName }
 */
function getCurrentSteamUser(steamPath) {
  try {
    const loginUsersPath = path.join(steamPath, "config", "LoginUsers.vdf");

    if (!fs.existsSync(loginUsersPath)) {
      return null;
    }

    const content = fs.readFileSync(loginUsersPath, "utf-8");
    const vdfData = parseVDF(content);

    // Struktura VDF LoginUsers:
    // "users"
    // {
    //   "76561198xxxxxxx"
    //   {
    //     "AccountName" "username"
    //     "MostRecent"  "1"
    //     ...
    //   }
    // }

    // Szukaj sekcji users (może być "users" lub "LoginUsers" w zależności od wersji)
    const loginUsers = vdfData.users || vdfData.LoginUsers;
    if (!loginUsers || typeof loginUsers !== "object") {
      return null;
    }

    // Szukaj użytkownika z MostRecent = "1"
    for (const [steamIdStr, userInfo] of Object.entries(loginUsers)) {
      if (typeof userInfo === "object") {
        if (userInfo.MostRecent === "1") {
          return {
            steamId: steamIdStr,
            accountName: userInfo.AccountName || "",
            personaName: userInfo.PersonaName || "",
            timestamp: userInfo.Timestamp || ""
          };
        }
      }
    }

    // Jeśli brak MostRecent, weź pierwszego
    const firstUser = Object.entries(loginUsers).find(([_, v]) => typeof v === "object");
    if (firstUser) {
      const [steamIdStr, userInfo] = firstUser;
      return {
        steamId: steamIdStr,
        accountName: userInfo.AccountName || "",
        personaName: userInfo.PersonaName || "",
        timestamp: userInfo.Timestamp || ""
      };
    }

    return null;
  } catch (error) {
    console.error("[SteamDetection] Błąd parsowania LoginUsers.vdf:", error);
    return null;
  }
}

/**
 * Główna funkcja - automatycznie wykryj zalogowanego Steam user
 * @returns {Promise<{ok: boolean, steamId?: string, accountName?: string, personaName?: string, error?: string}>}
 */
async function autoDetectSteamUser() {
  try {
    const steamPath = getSteamInstallPath();

    if (!steamPath) {
      const msg = "Steam nie jest zainstalowany na tym komputerze.";
      return {
        ok: false,
        error: msg
      };
    }

    const userInfo = getCurrentSteamUser(steamPath);

    if (!userInfo) {
      const msg = "Brak zalogowanego użytkownika Steam. Zaloguj się w aplikacji Steam.";
      return {
        ok: false,
        error: msg
      };
    }

    return {
      ok: true,
      steamId: userInfo.steamId,
      accountName: userInfo.accountName,
      personaName: userInfo.personaName
    };
  } catch (error) {
    console.error("[SteamDetection] Błąd:", error);
    return {
      ok: false,
      error: error.message || "Nieznany błąd podczas detekcji Steam"
    };
  }
}

/**
 * Weryfikuj czy Steam jest uruchomiony
 * @returns {Promise<boolean>}
 */
async function isSteamRunning() {
  try {
    if (process.platform === "win32") {
      const { spawn } = require("node:child_process");
      return new Promise((resolve) => {
        const tasklist = spawn("tasklist");
        let output = "";

        tasklist.stdout.on("data", (data) => {
          output += data.toString();
        });

        tasklist.on("close", () => {
          resolve(/steam\.exe/i.test(output));
        });
      });
    }

    return false;
  } catch {
    return false;
  }
}

module.exports = {
  autoDetectSteamUser,
  isSteamRunning,
  getSteamInstallPath,
  getCurrentSteamUser,
  parseVDF
};

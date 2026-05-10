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

      console.log("[SteamDetection] Szukam Steam na Windows...");
      for (const p of defaultPaths) {
        console.log("[SteamDetection] Sprawdzam:", p);
        if (fs.existsSync(p)) {
          console.log("[SteamDetection] ✓ Steam folder istnieje:", p);
          const loginUsersPath = path.join(p, "config", "LoginUsers.vdf");
          if (fs.existsSync(loginUsersPath)) {
            console.log("[SteamDetection] ✓ LoginUsers.vdf znaleziony!");
            return p;
          } else {
            console.log("[SteamDetection] LoginUsers.vdf nie znaleziony w", loginUsersPath);
          }
        }
      }
      console.error("[SteamDetection] Steam nie znaleziony w żadnej lokalizacji Windows");
    } else {
      // Linux/Mac
      const homeDir = os.homedir();
      const linuxPaths = [
        path.join(homeDir, ".steam/steam"),
        path.join(homeDir, ".steam/root"),
        path.join(homeDir, ".local/share/Steam"),
        path.join(homeDir, "Steam")
      ];

      console.log("[SteamDetection] Szukam Steam na Linux/Mac...");
      for (const p of linuxPaths) {
        console.log("[SteamDetection] Sprawdzam:", p);
        if (fs.existsSync(p)) {
          console.log("[SteamDetection] ✓ Steam folder istnieje:", p);
          return p;
        }
      }
      console.error("[SteamDetection] Steam nie znaleziony w żadnej lokalizacji Linux/Mac");
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

    console.log("[SteamDetection] Szukam:", loginUsersPath);

    if (!fs.existsSync(loginUsersPath)) {
      console.error("[SteamDetection] Plik nie istnieje:", loginUsersPath);
      return null;
    }

    const content = fs.readFileSync(loginUsersPath, "utf-8");
    console.log("[SteamDetection] Plik odczytany, rozmiar:", content.length, "bajtów");
    
    // Debug: Wyświetl pierwsze 500 znaków
    console.log("[SteamDetection] Zawartość (pierwsze 500 zn):\n", content.substring(0, 500));

    const vdfData = parseVDF(content);
    console.log("[SteamDetection] VDF sparsowany. Top-level keys:", Object.keys(vdfData));

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
      console.error("[SteamDetection] users/LoginUsers section nie znaleziona. Top-level keys:", Object.keys(vdfData));
      return null;
    }

    console.log("[SteamDetection] Znaleziono sekcję users. Liczba userów:", Object.keys(loginUsers).length);

    // Szukaj użytkownika z MostRecent = "1"
    for (const [steamIdStr, userInfo] of Object.entries(loginUsers)) {
      if (typeof userInfo === "object") {
        console.log("[SteamDetection] User:", steamIdStr, "- MostRecent:", userInfo.MostRecent, "- AccountName:", userInfo.AccountName);
        
        if (userInfo.MostRecent === "1") {
          console.log("[SteamDetection] ✓ Znaleziony MostRecent user!");
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
    console.log("[SteamDetection] Fallback: brak MostRecent, szukam pierwszego user'a");
    const firstUser = Object.entries(loginUsers).find(([_, v]) => typeof v === "object");
    if (firstUser) {
      const [steamIdStr, userInfo] = firstUser;
      console.log("[SteamDetection] ✓ Fallback user znaleziony:", steamIdStr);
      return {
        steamId: steamIdStr,
        accountName: userInfo.AccountName || "",
        personaName: userInfo.PersonaName || "",
        timestamp: userInfo.Timestamp || ""
      };
    }

    console.error("[SteamDetection] Brak user'ów do fallback");
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
    console.log("[SteamDetection] === POCZĄTEK DETEKCJI STEAM ===");
    
    const steamPath = getSteamInstallPath();

    if (!steamPath) {
      const msg = "Steam nie jest zainstalowany na tym komputerze.";
      console.error("[SteamDetection]", msg);
      return {
        ok: false,
        error: msg
      };
    }

    console.log("[SteamDetection] Steam folder znaleziony:", steamPath);

    const userInfo = getCurrentSteamUser(steamPath);

    if (!userInfo) {
      const msg = "Brak zalogowanego użytkownika Steam. Zaloguj się w aplikacji Steam.";
      console.error("[SteamDetection]", msg);
      return {
        ok: false,
        error: msg
      };
    }

    console.log("[SteamDetection] ✓ Znaleziony użytkownik Steam:", userInfo.accountName);
    console.log("[SteamDetection] === DETEKCJA ZAKOŃCZONA ===");

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

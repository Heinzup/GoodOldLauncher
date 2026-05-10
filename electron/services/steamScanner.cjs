const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { findCoverImage } = require("./scanUtils.cjs");

const APP_MANIFEST_PATTERN = /^appmanifest_(\d+)\.acf$/i;

/**
 * Czytaj playtime ze Steam lokalnego pliku localconfig.vdf
 * @param {string} steamPath - Ścieżka do Steam
 * @param {string} steamId64Str - SteamID64 zalogowanego użytkownika
 * @returns {Object} Mapa appId -> minuty gry
 */
function readSteamPlaytime(steamPath, steamId64Str) {
  try {
    const steamId64 = BigInt(steamId64Str);
    const accountId = String(steamId64 - 76561197960265728n);
    const localConfigPath = path.join(steamPath, "userdata", accountId, "config", "localconfig.vdf");

    if (!fs.existsSync(localConfigPath)) {
      console.log("[SteamScanner] localconfig.vdf nie znaleziony dla accountId:", accountId);
      return {};
    }

    const content = fs.readFileSync(localConfigPath, "utf-8");
    const lines = content.split("\n");

    const playtimes = {};
    let inAppsSection = false;
    let depth = 0;
    let appsDepth = -1;
    let currentAppId = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === "{") {
        depth++;
        continue;
      }

      if (trimmed === "}") {
        if (depth === appsDepth + 1) {
          currentAppId = null;
        }
        if (depth === appsDepth) {
          inAppsSection = false;
          appsDepth = -1;
        }
        depth--;
        continue;
      }

      if (trimmed === '"apps"') {
        inAppsSection = true;
        appsDepth = depth;
        continue;
      }

      if (inAppsSection && /^"\d+"$/.test(trimmed)) {
        currentAppId = trimmed.slice(1, -1);
        continue;
      }

      if (currentAppId) {
        const match = trimmed.match(/^"Playtime"\s+"(\d+)"$/i);
        if (match) {
          playtimes[currentAppId] = parseInt(match[1], 10);
        }
      }
    }

    console.log("[SteamScanner] Wczytano playtime dla", Object.keys(playtimes).length, "gier");
    return playtimes;
  } catch (error) {
    console.error("[SteamScanner] Błąd czytania playtime:", error);
    return {};
  }
}

function parseQuotedValue(raw) {
  return raw.replace(/\\\\/g, "\\");
}

function parseLibraryFolders(vdfContent) {
  const paths = [];
  const pathRegex = /"path"\s+"([^"]+)"/gi;
  let match;

  while ((match = pathRegex.exec(vdfContent)) !== null) {
    paths.push(parseQuotedValue(match[1]));
  }

  return paths;
}

function parseAppManifest(acfContent) {
  const appId = acfContent.match(/"appid"\s+"(\d+)"/i)?.[1] ?? null;
  const name = acfContent.match(/"name"\s+"([^"]+)"/i)?.[1] ?? null;
  const installDir = acfContent.match(/"installdir"\s+"([^"]+)"/i)?.[1] ?? null;

  if (!appId || !name) {
    return null;
  }

  return {
    appId,
    name,
    installDir: installDir ?? ""
  };
}

function colorFromAppId(appId) {
  const seed = Number.parseInt(appId, 10) || 0;
  const r = 40 + (seed % 120);
  const g = 60 + ((seed * 3) % 120);
  const b = 70 + ((seed * 7) % 120);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getDefaultSteamRoots() {
  const roots = [];

  if (process.platform === "win32") {
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const programFiles = process.env.ProgramFiles;

    if (programFilesX86) {
      roots.push(path.join(programFilesX86, "Steam"));
    }

    if (programFiles) {
      roots.push(path.join(programFiles, "Steam"));
    }
  }

  roots.push(path.join(os.homedir(), "AppData", "Local", "Steam"));

  return [...new Set(roots)];
}

function listLibrariesForRoot(rootPath) {
  const steamAppsPath = path.join(rootPath, "steamapps");
  const vdfPath = path.join(steamAppsPath, "libraryfolders.vdf");

  const libraries = [rootPath];

  if (!fs.existsSync(vdfPath)) {
    return libraries;
  }

  try {
    const vdfContent = fs.readFileSync(vdfPath, "utf8");
    const parsed = parseLibraryFolders(vdfContent);
    libraries.push(...parsed);
  } catch {
    return libraries;
  }

  return [...new Set(libraries)];
}

function listGamesForLibrary(libraryPath, steamRootPath) {
  const steamAppsPath = path.join(libraryPath, "steamapps");

  if (!fs.existsSync(steamAppsPath)) {
    return [];
  }

  let files;
  try {
    files = fs.readdirSync(steamAppsPath);
  } catch {
    return [];
  }

  const manifests = files.filter((fileName) => APP_MANIFEST_PATTERN.test(fileName));

  return manifests
    .map((manifestFile) => {
      const fullManifestPath = path.join(steamAppsPath, manifestFile);

      try {
        const acf = fs.readFileSync(fullManifestPath, "utf8");
        const app = parseAppManifest(acf);
        if (!app) {
          return null;
        }

        const installDirectory = app.installDir
          ? path.join(libraryPath, "steamapps", "common", app.installDir)
          : path.join(libraryPath, "steamapps", "common");

        const steamArtworkCandidates = [
          path.join(libraryPath, "steamapps", "librarycache", `${app.appId}_library_600x900.jpg`),
          path.join(libraryPath, "steamapps", "librarycache", `${app.appId}_header.jpg`),
          path.join(steamRootPath || "", "appcache", "librarycache", `${app.appId}_library_600x900.jpg`),
          path.join(steamRootPath || "", "appcache", "librarycache", `${app.appId}_header.jpg`)
        ];

        return {
          id: `steam-${app.appId}`,
          title: app.name,
          source: "Steam",
          executablePath: `steam://run/${app.appId}`,
          installDirectory,
          tags: ["Steam"],
          installed: fs.existsSync(installDirectory),
          coverColor: colorFromAppId(app.appId),
          coverImagePath: findCoverImage(installDirectory, steamArtworkCandidates)
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function scanSteamLibrary(customRootPaths = [], steamUserId = null) {
  const roots = [...new Set([...customRootPaths, ...getDefaultSteamRoots()])];

  // Wczytaj playtime jeśli znamy userId
  let playtimeMap = {};
  const steamRoot = roots.find((r) => fs.existsSync(path.join(r, "config", "LoginUsers.vdf")));
  if (steamUserId && steamRoot) {
    playtimeMap = readSteamPlaytime(steamRoot, steamUserId);
  }

  const rootToLibraries = roots.map((rootPath) => ({
    rootPath,
    libraries: listLibrariesForRoot(rootPath)
  }));
  const uniqueLibraries = [...new Set(rootToLibraries.flatMap((item) => item.libraries))];

  const gameMap = new Map();
  for (const { rootPath, libraries } of rootToLibraries) {
    for (const libraryPath of libraries) {
      const games = listGamesForLibrary(libraryPath, rootPath);
      for (const game of games) {
        if (!gameMap.has(game.id)) {
          // Dodaj playtime jeśli dostępne
          const appId = game.id.startsWith("steam-") ? game.id.slice(6) : null;
          const playtimeMinutes = appId ? (playtimeMap[appId] || 0) : 0;
          gameMap.set(game.id, {
            ...game,
            playtimeMinutes,
            playtimeHours: playtimeMinutes > 0 ? Math.round(playtimeMinutes / 60 * 10) / 10 : 0
          });
        }
      }
    }
  }

  return {
    scannedRoots: roots,
    scannedLibraries: uniqueLibraries,
    games: [...gameMap.values()]
  };
}

module.exports = {
  scanSteamLibrary
};

const path = require("node:path");
const { scanSteamLibrary } = require("./steamScanner.cjs");
const { scanEpicLibrary } = require("./epicScanner.cjs");
const { scanGogLibrary } = require("./gogScanner.cjs");
const { scanEaLibrary } = require("./eaScanner.cjs");
const { scanCustomLibrary } = require("./customScanner.cjs");

const SOURCE_PRIORITY = {
  Steam: 50,
  "Epic Games": 40,
  GOG: 35,
  EA: 30,
  Custom: 10
};

function isLocalPath(value) {
  return typeof value === "string" && /^[a-zA-Z]:[\\/]|^\\\\/.test(value);
}

function normalizeLocalPath(value) {
  if (!isLocalPath(value)) {
    return null;
  }

  return path.resolve(value).toLowerCase();
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeKey(game) {
  const executableKey = normalizeLocalPath(game.executablePath);
  if (executableKey) {
    return `exe:${executableKey}`;
  }

  const installKey = normalizeLocalPath(game.installDirectory);
  if (installKey) {
    return `dir:${installKey}`;
  }

  return `title:${normalizeTitle(game.title)}`;
}

function scoreGame(game) {
  const sourceScore = SOURCE_PRIORITY[game.source] || 0;
  const executableScore = isLocalPath(game.executablePath) ? 15 : 0;
  const coverScore = game.coverImagePath ? 5 : 0;
  return sourceScore + executableScore + coverScore;
}

function mergeGame(existingGame, incomingGame) {
  const preferred = scoreGame(incomingGame) > scoreGame(existingGame) ? incomingGame : existingGame;
  const secondary = preferred === incomingGame ? existingGame : incomingGame;

  return {
    ...secondary,
    ...preferred,
    tags: [...new Set([...(existingGame.tags || []), ...(incomingGame.tags || [])])]
  };
}

function scanAllLibraries(scanConfig = {}) {
  const steam = scanSteamLibrary(scanConfig.steamRoots || []);
  const epic = scanEpicLibrary(scanConfig.epicManifestRoots || []);
  const gog = scanGogLibrary(scanConfig.gogRoots || []);
  const ea = scanEaLibrary(scanConfig.eaRoots || []);
  const custom = scanCustomLibrary(scanConfig.customGameRoots || []);

  const allGames = [...steam.games, ...epic.games, ...gog.games, ...ea.games, ...custom.games];
  const unique = new Map();

  for (const game of allGames) {
    const key = dedupeKey(game);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, game);
      continue;
    }

    unique.set(key, mergeGame(existing, game));
  }

  return {
    games: [...unique.values()],
    diagnostics: {
      steam: { roots: steam.scannedRoots, libraries: steam.scannedLibraries, count: steam.games.length },
      epic: { roots: epic.scannedRoots, count: epic.games.length },
      gog: { roots: gog.scannedRoots, count: gog.games.length },
      ea: { roots: ea.scannedRoots, count: ea.games.length },
      custom: { roots: custom.scannedRoots, expandedRoots: custom.expandedRoots, count: custom.games.length },
      dedupedCount: allGames.length - unique.size
    }
  };
}

module.exports = {
  scanAllLibraries
};

const fs = require("node:fs");
const path = require("node:path");
const { ensureUnique, colorFromText, isDirectorySafe, listFilesSafe, findCoverImage } = require("./scanUtils.cjs");

const MAX_SCAN_DEPTH = 3;
const SYSTEM_DIRS = new Set([
  "$recycle.bin",
  "system volume information",
  "windows",
  "programdata",
  "recovery",
  "perfLogs"
]);
const GAME_HINTS = /(game|games|steam|gog|origin|ea|epic|ubisoft|battle|xbox|launcher)/i;
const IGNORE_EXE_HINTS = /(unins|crash|report|setup|updater|launcher|redistributable|vcredist)/i;

function isDriveRoot(dirPath) {
  const resolved = path.resolve(dirPath);
  return /^[a-zA-Z]:\\$/.test(resolved);
}

function pickExecutable(directoryPath) {
  const files = listFilesSafe(directoryPath);
  const candidates = files
    .filter((entry) => entry.toLowerCase().endsWith(".exe"))
    .filter((entry) => !IGNORE_EXE_HINTS.test(entry.toLowerCase()));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.length - right.length);
  return path.join(directoryPath, candidates[0]);
}

function expandCandidateRoots(rootPath) {
  if (!isDirectorySafe(rootPath)) {
    return [];
  }

  if (!isDriveRoot(rootPath)) {
    return [path.resolve(rootPath)];
  }

  const children = listFilesSafe(rootPath)
    .map((entry) => ({
      entry,
      fullPath: path.join(rootPath, entry)
    }))
    .filter((item) => isDirectorySafe(item.fullPath))
    .filter((item) => !SYSTEM_DIRS.has(item.entry.toLowerCase()))
    .filter((item) => GAME_HINTS.test(item.entry));

  return children.map((item) => path.resolve(item.fullPath));
}

function createGameFromDirectory(installDirectory) {
  const executablePath = pickExecutable(installDirectory);
  if (!executablePath || !fs.existsSync(executablePath)) {
    return null;
  }

  const title = path.basename(installDirectory);
  return {
    id: `custom-${colorFromText(executablePath).slice(1)}`,
    title,
    source: "Custom",
    executablePath,
    installDirectory,
    tags: ["Custom"],
    installed: true,
    coverColor: colorFromText(title),
    coverImagePath: findCoverImage(installDirectory)
  };
}

function scanFromRoot(rootPath, depth, visitedDirectories, gameMap) {
  if (depth > MAX_SCAN_DEPTH || visitedDirectories.has(rootPath)) {
    return;
  }

  visitedDirectories.add(rootPath);

  const game = createGameFromDirectory(rootPath);
  if (game) {
    gameMap.set(path.resolve(game.executablePath).toLowerCase(), game);
    return;
  }

  const children = listFilesSafe(rootPath)
    .map((entry) => path.join(rootPath, entry))
    .filter((entryPath) => isDirectorySafe(entryPath));

  for (const childPath of children) {
    const baseName = path.basename(childPath).toLowerCase();
    if (SYSTEM_DIRS.has(baseName)) {
      continue;
    }

    scanFromRoot(childPath, depth + 1, visitedDirectories, gameMap);
  }
}

function scanCustomLibrary(customRoots = []) {
  const roots = ensureUnique(customRoots).map((rootPath) => path.resolve(rootPath));
  const expandedRoots = ensureUnique(roots.flatMap(expandCandidateRoots));

  const visitedDirectories = new Set();
  const gameMap = new Map();

  for (const rootPath of expandedRoots) {
    scanFromRoot(rootPath, 0, visitedDirectories, gameMap);
  }

  return {
    scannedRoots: roots,
    expandedRoots,
    games: [...gameMap.values()]
  };
}

module.exports = {
  scanCustomLibrary
};

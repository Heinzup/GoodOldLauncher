const fs = require("node:fs");
const path = require("node:path");
const { ensureUnique, colorFromText, isDirectorySafe, listFilesSafe, findPrimaryExecutable, findCoverImage } = require("./scanUtils.cjs");

function getDefaultEaRoots() {
  return ensureUnique([
    "C:\\Program Files\\EA Games",
    "C:\\Program Files (x86)\\Origin Games",
    "C:\\EA Games"
  ]);
}

function scanEaRoot(rootPath) {
  if (!isDirectorySafe(rootPath)) {
    return [];
  }

  const folders = listFilesSafe(rootPath)
    .map((entry) => path.join(rootPath, entry))
    .filter((entryPath) => isDirectorySafe(entryPath));

  return folders
    .map((installDirectory) => {
      const title = path.basename(installDirectory);
      const executablePath = findPrimaryExecutable(installDirectory);
      if (!executablePath) {
        return null;
      }

      return {
        id: `ea-${title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`,
        title,
        source: "EA",
        executablePath,
        installDirectory,
        tags: ["EA"],
        installed: fs.existsSync(installDirectory),
        coverColor: colorFromText(title),
        coverImagePath: findCoverImage(installDirectory)
      };
    })
    .filter(Boolean);
}

function scanEaLibrary(customRoots = []) {
  const roots = ensureUnique([...customRoots, ...getDefaultEaRoots()]);
  const games = roots.flatMap(scanEaRoot);

  return {
    scannedRoots: roots,
    games
  };
}

module.exports = {
  scanEaLibrary
};

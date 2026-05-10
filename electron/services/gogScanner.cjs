const fs = require("node:fs");
const path = require("node:path");
const { ensureUnique, colorFromText, isDirectorySafe, listFilesSafe, findPrimaryExecutable, findCoverImage } = require("./scanUtils.cjs");

function getDefaultGogRoots() {
  return ensureUnique([
    "C:\\GOG Games",
    path.join(process.env.ProgramFiles || "C:\\Program Files", "GOG Galaxy", "Games")
  ]);
}

function scanGogRoot(rootPath) {
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
        id: `gog-${title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`,
        title,
        source: "GOG",
        executablePath,
        installDirectory,
        tags: ["GOG"],
        installed: fs.existsSync(installDirectory),
        coverColor: colorFromText(title),
        coverImagePath: findCoverImage(installDirectory, [], title)
      };
    })
    .filter(Boolean);
}

function scanGogLibrary(customRoots = []) {
  const roots = ensureUnique([...customRoots, ...getDefaultGogRoots()]);
  const games = roots.flatMap(scanGogRoot);

  return {
    scannedRoots: roots,
    games
  };
}

module.exports = {
  scanGogLibrary
};

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { ensureUnique, colorFromText, tryReadJson, listFilesSafe, findPrimaryExecutable, findCoverImage } = require("./scanUtils.cjs");

function getDefaultEpicManifestRoots() {
  const roots = [];
  const programData = process.env.ProgramData || path.join("C:", "ProgramData");
  roots.push(path.join(programData, "Epic", "EpicGamesLauncher", "Data", "Manifests"));
  roots.push(path.join(os.homedir(), "AppData", "Local", "EpicGamesLauncher", "Saved", "Manifests"));
  return ensureUnique(roots);
}

function normalizeEpicGame(manifest) {
  const appName = manifest.AppName || manifest.CatalogItemId || manifest.InstallLocation;
  const title = manifest.DisplayName || manifest.AppName || "Epic Game";
  const installDirectory = manifest.InstallLocation || "";
  const executableRelative = manifest.LaunchExecutable || "";
  const executableCandidate = executableRelative ? path.join(installDirectory, executableRelative) : findPrimaryExecutable(installDirectory);

  const protocolPath = manifest.AppName ? `com.epicgames.launcher://apps/${manifest.AppName}?action=launch&silent=true` : null;
  const coverCandidates = [manifest.DisplayImage, manifest.Thumbnail, manifest.CoverImage];

  return {
    id: `epic-${String(appName).replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    title,
    source: "Epic Games",
    executablePath: executableCandidate && fs.existsSync(executableCandidate) ? executableCandidate : protocolPath,
    installDirectory,
    tags: ["Epic"],
    installed: Boolean(installDirectory && fs.existsSync(installDirectory)),
    coverColor: colorFromText(appName),
    coverImagePath: findCoverImage(installDirectory, coverCandidates)
  };
}

function scanEpicLibrary(customManifestRoots = []) {
  const roots = ensureUnique([...customManifestRoots, ...getDefaultEpicManifestRoots()]);

  const games = [];
  for (const rootPath of roots) {
    const manifestFiles = listFilesSafe(rootPath).filter((entry) => entry.toLowerCase().endsWith(".item"));

    for (const fileName of manifestFiles) {
      const manifestPath = path.join(rootPath, fileName);
      const manifest = tryReadJson(manifestPath);
      if (!manifest) {
        continue;
      }

      const game = normalizeEpicGame(manifest);
      if (game.executablePath) {
        games.push(game);
      }
    }
  }

  const unique = new Map();
  for (const game of games) {
    if (!unique.has(game.id)) {
      unique.set(game.id, game);
    }
  }

  return {
    scannedRoots: roots,
    games: [...unique.values()]
  };
}

module.exports = {
  scanEpicLibrary
};

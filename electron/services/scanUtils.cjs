const fs = require("node:fs");
const path = require("node:path");

function ensureUnique(values) {
  return [...new Set(values.filter(Boolean))];
}

function colorFromText(seedText) {
  const text = String(seedText || "0");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  const r = 55 + (hash % 140);
  const g = 60 + ((hash >> 3) % 130);
  const b = 65 + ((hash >> 5) % 120);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function tryReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function tryReadJson(filePath) {
  const text = tryReadText(filePath);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function listFilesSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

function isDirectorySafe(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function findPrimaryExecutable(rootPath) {
  if (!isDirectorySafe(rootPath)) {
    return null;
  }

  const entries = listFilesSafe(rootPath);
  const executables = entries
    .filter((entry) => entry.toLowerCase().endsWith(".exe"))
    .filter((entry) => !entry.toLowerCase().includes("unins"))
    .filter((entry) => !entry.toLowerCase().includes("crashreport"));

  if (executables.length === 0) {
    return null;
  }

  executables.sort((left, right) => left.length - right.length);
  return path.join(rootPath, executables[0]);
}

function findCoverImage(installDirectory, extraCandidates = [], gameTitle = null) {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
  const candidates = [];

  if (isDirectorySafe(installDirectory)) {
    const commonNames = [
      "cover", "capsule", "poster", "hero", "background", "splash",
      "box", "boxart", "thumbnail", "banner", "artwork", "image",
      "header", "library_hero", "library_600x900", "grid"
    ];
    
    // Add game title as search term if provided
    if (gameTitle && typeof gameTitle === "string") {
      const titleNorm = gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (titleNorm.length > 2) {
        for (const extension of imageExtensions) {
          candidates.push(path.join(installDirectory, `${titleNorm}${extension}`));
        }
      }
    }
    
    for (const baseName of commonNames) {
      for (const extension of imageExtensions) {
        candidates.push(path.join(installDirectory, `${baseName}${extension}`));
      }
    }

    const directoryFiles = listFilesSafe(installDirectory);
    // Prioritize image files in root by size and name matching
    const imageFiles = directoryFiles
      .filter((entry) => imageExtensions.some((ext) => entry.toLowerCase().endsWith(ext)))
      .sort((a, b) => {
        // Prioritize by having keywords
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aScore = (aLower.includes("cover") ? 10 : 0) + 
                       (aLower.includes("art") ? 5 : 0) +
                       (aLower.includes("poster") ? 5 : 0);
        const bScore = (bLower.includes("cover") ? 10 : 0) +
                       (bLower.includes("art") ? 5 : 0) +
                       (bLower.includes("poster") ? 5 : 0);
        return bScore - aScore;
      });
    
    for (const entry of imageFiles) {
      candidates.push(path.join(installDirectory, entry));
    }

    // Szukaj w podfolderach artwork / images / resources
    const artSubfolders = ["artwork", "images", "resources", "media", "assets", "ui", "gfx", "art", "graphics"];
    for (const subfolder of artSubfolders) {
      const subPath = path.join(installDirectory, subfolder);
      if (isDirectorySafe(subPath)) {
        const subFiles = listFilesSafe(subPath);
        for (const entry of subFiles) {
          const lower = entry.toLowerCase();
          if (imageExtensions.some((ext) => lower.endsWith(ext))) {
            candidates.push(path.join(subPath, entry));
          }
        }
      }
    }
  }

  for (const extraPath of extraCandidates) {
    if (typeof extraPath === "string" && extraPath.trim()) {
      candidates.push(extraPath.trim());
    }
  }

  for (const candidatePath of ensureUnique(candidates)) {
    try {
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        return candidatePath;
      }
    } catch {
      continue;
    }
  }

  return null;
}

module.exports = {
  ensureUnique,
  colorFromText,
  tryReadText,
  tryReadJson,
  listFilesSafe,
  isDirectorySafe,
  findPrimaryExecutable,
  findCoverImage
};

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

function findCoverImage(installDirectory, extraCandidates = []) {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
  const candidates = [];

  if (isDirectorySafe(installDirectory)) {
    const commonNames = ["cover", "capsule", "poster", "hero", "background", "splash"];
    for (const baseName of commonNames) {
      for (const extension of imageExtensions) {
        candidates.push(path.join(installDirectory, `${baseName}${extension}`));
      }
    }

    const directoryFiles = listFilesSafe(installDirectory);
    for (const entry of directoryFiles) {
      const lower = entry.toLowerCase();
      if (imageExtensions.some((extension) => lower.endsWith(extension))) {
        candidates.push(path.join(installDirectory, entry));
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

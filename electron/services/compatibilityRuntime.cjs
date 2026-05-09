const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_FILES = {
  d3d8to9: ["d3d8.dll", "d3d9.dll"],
  dgvoodoo2: ["D3D8.dll", "D3D9.dll", "D3DImm.dll", "DDraw.dll"],
  dxvk: ["d3d9.dll", "dxgi.dll"]
};

function resolveCompatPackDir(layer) {
  return path.join(process.cwd(), "compat-packs", layer);
}

function ensureFilesInGameDir(layer, executablePath) {
  if (!layer || layer === "none") {
    return { ok: true, warnings: [] };
  }

  const required = REQUIRED_FILES[layer] || [];
  if (required.length === 0) {
    return { ok: false, error: `Unsupported compatibility layer: ${layer}` };
  }

  const gameDir = path.dirname(executablePath);
  const packDir = resolveCompatPackDir(layer);

  if (!fs.existsSync(packDir)) {
    return {
      ok: false,
      error: `Compatibility pack missing: ${packDir}`
    };
  }

  const warnings = [];
  for (const fileName of required) {
    const sourcePath = path.join(packDir, fileName);
    const targetPath = path.join(gameDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      return {
        ok: false,
        error: `Missing required compatibility file: ${sourcePath}`
      };
    }

    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
      warnings.push(`Injected compatibility file: ${fileName}`);
    }
  }

  return {
    ok: true,
    warnings
  };
}

function preflightCompatibility(launchConfig) {
  const compatibility = launchConfig?.compatibility || {};
  const executablePath = launchConfig?.executablePath || "";

  if (!executablePath || executablePath.includes("://")) {
    return { ok: true, notes: [] };
  }

  const layer = compatibility.compatLayer || "none";
  const borderlessRequested = Boolean(compatibility.enableBorderless);

  const notes = [];

  const layerResult = ensureFilesInGameDir(layer, executablePath);
  if (!layerResult.ok) {
    return layerResult;
  }

  notes.push(...(layerResult.warnings || []));
  if (borderlessRequested) {
    notes.push("Borderless requested. Runtime window hook pending in next release.");
  }

  return {
    ok: true,
    notes
  };
}

module.exports = {
  preflightCompatibility
};

const fs = require("node:fs");
const path = require("node:path");

const FPS_MIN = 10;
const FPS_MAX = 1000;
const DXVK_FPS_BLOCK_START = "# Good Old Launcher FPS limit start";
const DXVK_FPS_BLOCK_END = "# Good Old Launcher FPS limit end";
const RTSS_PROFILE_KEY = "FramerateLimit";

const REQUIRED_FILES = {
  d3d8to9: ["d3d8.dll", "d3d9.dll"],
  dgvoodoo2: ["D3D8.dll", "D3D9.dll", "D3DImm.dll", "DDraw.dll"],
  dxvk: ["d3d9.dll", "dxgi.dll"]
};

function resolveCompatPackDir(layer) {
  return path.join(process.cwd(), "compat-packs", layer);
}

function normalizeFpsLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(FPS_MIN, Math.min(parsed, FPS_MAX));
}

function removeManagedDxvkBlock(content) {
  const escapedStart = DXVK_FPS_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = DXVK_FPS_BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const managedBlockRegex = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, "g");
  return content.replace(managedBlockRegex, "").trimEnd();
}

function writeManagedDxvkBlock(configPath, blockContent) {
  let previousContent = "";
  if (fs.existsSync(configPath)) {
    previousContent = fs.readFileSync(configPath, "utf8");
  }

  const cleanedContent = removeManagedDxvkBlock(previousContent);
  const nextContent = blockContent
    ? (cleanedContent ? `${cleanedContent}\n\n${blockContent}\n` : `${blockContent}\n`)
    : (cleanedContent ? `${cleanedContent}\n` : "");

  if (nextContent) {
    fs.writeFileSync(configPath, nextContent, "utf8");
    return { ok: true };
  }

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }

  return { ok: true };
}

function applyDxvkFpsLimit(executablePath, fpsLimit) {
  if (fpsLimit !== 0 && (fpsLimit < FPS_MIN || fpsLimit > FPS_MAX)) {
    return {
      ok: false,
      error: `FPS limit must be 0 or between ${FPS_MIN} and ${FPS_MAX}.`
    };
  }

  const gameDir = path.dirname(executablePath);
  const configPath = path.join(gameDir, "dxvk.conf");

  const managedBlock = fpsLimit > 0
    ? [
      DXVK_FPS_BLOCK_START,
      `dxgi.maxFrameRate = ${fpsLimit}`,
      `d3d9.maxFrameRate = ${fpsLimit}`,
      DXVK_FPS_BLOCK_END
    ].join("\n")
    : "";

  const writeResult = writeManagedDxvkBlock(configPath, managedBlock);
  if (!writeResult.ok) {
    return writeResult;
  }

  return {
    ok: true,
    note: fpsLimit > 0
      ? `Applied DXVK FPS limit (${fpsLimit}) to ${configPath}`
      : "Removed managed DXVK FPS limiter settings."
  };
}

function resolveRtssProfilesDir() {
  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] || "", "RivaTuner Statistics Server", "Profiles"),
    path.join(process.env.ProgramFiles || "", "RivaTuner Statistics Server", "Profiles")
  ].filter(Boolean);

  for (const directory of candidates) {
    if (directory && fs.existsSync(directory)) {
      return directory;
    }
  }

  return "";
}

function setIniLikeKey(content, key, value) {
  const lines = content ? content.split(/\r?\n/) : [];
  let updated = false;
  const nextLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(";") || trimmed.startsWith("#")) {
      return true;
    }

    if (trimmed.toLowerCase().startsWith(`${key.toLowerCase()}=`)) {
      if (!updated && value !== null) {
        updated = true;
        return false;
      }
      return false;
    }

    return true;
  });

  if (value !== null) {
    nextLines.push(`${key}=${value}`);
  }

  return nextLines.filter((line, index, arr) => {
    if (line !== "") {
      return true;
    }
    return index < arr.length - 1;
  }).join("\n");
}

function applyRtssFpsLimit(executablePath, fpsLimit) {
  const profilesDir = resolveRtssProfilesDir();
  if (!profilesDir) {
    return { ok: false, error: "RTSS profiles directory not found." };
  }

  const executableName = path.basename(executablePath);
  if (!executableName) {
    return { ok: false, error: "Cannot resolve executable name for RTSS profile." };
  }

  const profilePath = path.join(profilesDir, `${executableName}.cfg`);
  const previousContent = fs.existsSync(profilePath)
    ? fs.readFileSync(profilePath, "utf8")
    : "";

  const nextContent = setIniLikeKey(previousContent, RTSS_PROFILE_KEY, fpsLimit > 0 ? String(fpsLimit) : null).trimEnd();

  if (nextContent) {
    fs.writeFileSync(profilePath, `${nextContent}\n`, "utf8");
    return {
      ok: true,
      note: fpsLimit > 0
        ? `Applied RTSS FPS limit (${fpsLimit}) to ${profilePath}`
        : `Removed RTSS FPS limit from ${profilePath}`
    };
  }

  if (fs.existsSync(profilePath)) {
    fs.unlinkSync(profilePath);
  }

  return {
    ok: true,
    note: "Removed RTSS FPS limit profile settings."
  };
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
  const fpsLimit = normalizeFpsLimit(launchConfig?.fpsLimit ?? compatibility.fpsLimit);

  if (!executablePath || executablePath.includes("://")) {
    return {
      ok: true,
      notes: fpsLimit > 0
        ? ["FPS limiter was not applied: protocol launch is not directly controllable by launcher."]
        : []
    };
  }

  const layer = compatibility.compatLayer || "none";
  const borderlessRequested = Boolean(compatibility.enableBorderless);

  const notes = [];

  const layerResult = ensureFilesInGameDir(layer, executablePath);
  if (!layerResult.ok) {
    return layerResult;
  }

  notes.push(...(layerResult.warnings || []));

  if (fpsLimit > 0) {
    const rtssResult = applyRtssFpsLimit(executablePath, fpsLimit);
    if (rtssResult.ok) {
      notes.push(rtssResult.note);
    } else {
      notes.push(`RTSS limiter unavailable: ${rtssResult.error}`);

      const dxvkResult = ensureFilesInGameDir("dxvk", executablePath);
      if (!dxvkResult.ok) {
        notes.push(`FPS limiter fallback was not applied: ${dxvkResult.error}`);
      } else {
        notes.push(...(dxvkResult.warnings || []));
        const fpsResult = applyDxvkFpsLimit(executablePath, fpsLimit);
        if (fpsResult.ok) {
          notes.push(fpsResult.note);
          if (layer !== "dxvk") {
            notes.push("FPS limiter fallback uses DXVK config. Active render wrapper may affect final result.");
          }
        } else {
          notes.push(`FPS limiter fallback was not applied: ${fpsResult.error}`);
        }
      }
    }
  } else {
    const clearRtssResult = applyRtssFpsLimit(executablePath, 0);
    if (clearRtssResult.ok) {
      notes.push(clearRtssResult.note);
    }

    const clearDxvkResult = applyDxvkFpsLimit(executablePath, 0);
    if (clearDxvkResult.ok) {
      notes.push(clearDxvkResult.note);
    }
  }

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

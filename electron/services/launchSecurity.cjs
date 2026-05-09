const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_PROTOCOLS = ["steam://", "com.epicgames.launcher://", "goggalaxy://"];
const ALLOWED_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".com", ".lnk"]);
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 2048;

function isAllowedProtocol(input) {
  return ALLOWED_PROTOCOLS.some((protocol) => input.startsWith(protocol));
}

function validateArgs(args) {
  if (!Array.isArray(args)) {
    return { ok: false, error: "Launch args must be an array." };
  }

  if (args.length > MAX_ARGS) {
    return { ok: false, error: `Too many launch args (max ${MAX_ARGS}).` };
  }

  for (const value of args) {
    if (typeof value !== "string") {
      return { ok: false, error: "Launch arg must be a string." };
    }

    if (value.length > MAX_ARG_LENGTH) {
      return { ok: false, error: `Launch arg too long (max ${MAX_ARG_LENGTH}).` };
    }
  }

  return { ok: true };
}

function validateExecutablePath(executablePath) {
  if (!executablePath || typeof executablePath !== "string") {
    return { ok: false, error: "Missing executable path." };
  }

  if (isAllowedProtocol(executablePath)) {
    return { ok: true, mode: "protocol" };
  }

  if (!path.isAbsolute(executablePath)) {
    return { ok: false, error: "Executable path must be absolute or known launcher protocol." };
  }

  const extension = path.extname(executablePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Unsupported executable extension." };
  }

  if (!fs.existsSync(executablePath)) {
    return { ok: false, error: "Executable file does not exist." };
  }

  return { ok: true, mode: "file" };
}

function validateLaunchRequest(launchConfig) {
  const { executablePath, args = [] } = launchConfig ?? {};

  const execValidation = validateExecutablePath(executablePath);
  if (!execValidation.ok) {
    return execValidation;
  }

  const argsValidation = validateArgs(args);
  if (!argsValidation.ok) {
    return argsValidation;
  }

  return { ok: true, mode: execValidation.mode };
}

module.exports = {
  validateLaunchRequest
};

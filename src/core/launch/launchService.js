import { getProfile } from "../profiles/profileStore";
import { buildCompatibilityPlan } from "./compatibilityPlan";

function parseLaunchArgs(rawArgs) {
  const matches = rawArgs.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];

  return matches
    .map((token) => token.replace(/^['"]|['"]$/g, "").trim())
    .filter(Boolean);
}

function parseFpsLimit(rawFpsLimit) {
  const parsed = Number.parseInt(rawFpsLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(10, Math.min(parsed, 1000));
}

export async function launchGame(game) {
  const profile = getProfile(game.id);

  const launchArgs = parseLaunchArgs(profile.launchArgs ?? "");
  const compatibility = buildCompatibilityPlan(profile);
  const fpsLimit = parseFpsLimit(profile.fpsLimit);

  const launchConfig = {
    executablePath: game.executablePath,
    workingDirectory: game.installDirectory,
    args: launchArgs,
    compatibility,
    fpsLimit
  };

  if (!window.goodOldLauncher?.launchGame) {
    return { ok: false, error: "Native bridge unavailable." };
  }

  const result = await window.goodOldLauncher.launchGame(launchConfig);
  return result;
}

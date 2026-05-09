import { getProfile } from "../profiles/profileStore";
import { buildCompatibilityPlan } from "./compatibilityPlan";

function parseLaunchArgs(rawArgs) {
  const matches = rawArgs.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];

  return matches
    .map((token) => token.replace(/^['"]|['"]$/g, "").trim())
    .filter(Boolean);
}

export async function launchGame(game) {
  const profile = getProfile(game.id);

  const launchArgs = parseLaunchArgs(profile.launchArgs ?? "");
  const compatibility = buildCompatibilityPlan(profile);

  const launchConfig = {
    executablePath: game.executablePath,
    workingDirectory: game.installDirectory,
    args: launchArgs,
    compatibility
  };

  if (!window.goodOldLauncher?.launchGame) {
    return { ok: false, error: "Native bridge unavailable." };
  }

  const result = await window.goodOldLauncher.launchGame(launchConfig);
  return result;
}

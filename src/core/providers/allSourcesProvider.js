import { getLauncherSettings } from "../settings/launcherSettingsStore";

export const allSourcesProvider = {
  id: "local-multi-source",
  displayName: "Steam/Epic/GOG/EA/Custom",
  async scanGames() {
    if (!window.goodOldLauncher?.scanLibraries) {
      return [];
    }

    const settings = getLauncherSettings();
    const result = await window.goodOldLauncher.scanLibraries(settings.scan);

    if (!result?.ok || !Array.isArray(result.games)) {
      return [];
    }

    return result.games;
  }
};

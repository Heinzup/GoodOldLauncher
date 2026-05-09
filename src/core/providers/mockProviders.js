import { registerProvider, resetProviders } from "./providerRegistry";
import { allSourcesProvider } from "./allSourcesProvider";
import { getLauncherSettings } from "../settings/launcherSettingsStore";

const localSamplesProvider = {
  id: "local-samples",
  displayName: "Lokalna biblioteka (demo)",
  async scanGames() {
    return [
      {
        id: "half-life-2",
        title: "Half-Life 2",
        source: "Steam",
        executablePath: "steam://run/220",
        tags: ["DX9", "FPS"],
        installed: true,
        coverColor: "#314f35"
      },
      {
        id: "heroes3",
        title: "Heroes III Complete",
        source: "GOG",
        executablePath: "C:/Games/Heroes3/Heroes3.exe",
        tags: ["DX8", "Strategy"],
        installed: false,
        coverColor: "#593637"
      },
      {
        id: "nfs-underground-2",
        title: "Need for Speed Underground 2",
        source: "EA",
        executablePath: "C:/Games/NFSU2/SPEED2.EXE",
        tags: ["DX9", "Racing"],
        installed: false,
        coverColor: "#284f59"
      }
    ];
  }
};

export function registerBuiltinProviders() {
  const settings = getLauncherSettings();
  resetProviders();
  registerProvider(allSourcesProvider);

  if (settings.enableDemoProvider) {
    registerProvider(localSamplesProvider);
  }
}

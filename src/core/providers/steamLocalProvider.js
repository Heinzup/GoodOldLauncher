export const steamLocalProvider = {
  id: "steam-local",
  displayName: "Steam (lokalny skan)",
  async scanGames() {
    if (!window.goodOldLauncher?.scanSteamLibrary) {
      return [];
    }

    const result = await window.goodOldLauncher.scanSteamLibrary({ customRoots: [] });
    if (!result?.ok || !Array.isArray(result.games)) {
      return [];
    }

    return result.games;
  }
};

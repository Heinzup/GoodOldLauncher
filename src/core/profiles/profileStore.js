const STORAGE_KEY = "good-old-launcher:profiles";

export function getProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveProfile(gameId, profile) {
  const profiles = getProfiles();
  profiles[gameId] = profile;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getProfile(gameId) {
  const profiles = getProfiles();
  return profiles[gameId] ?? {
    enableBorderless: false,
    compatLayer: "none",
    launchArgs: ""
  };
}

const STORAGE_KEY = "good-old-launcher:profiles";

function normalizeFpsLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(10, Math.min(parsed, 1000));
}

function createDefaultProfile() {
  return {
    enableBorderless: false,
    compatLayer: "none",
    launchArgs: "",
    fpsLimit: 0
  };
}

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
  profiles[gameId] = {
    ...createDefaultProfile(),
    ...(profile || {}),
    fpsLimit: normalizeFpsLimit(profile?.fpsLimit)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getProfile(gameId) {
  const profiles = getProfiles();
  const savedProfile = profiles[gameId];

  if (!savedProfile || typeof savedProfile !== "object") {
    return createDefaultProfile();
  }

  return {
    ...createDefaultProfile(),
    ...savedProfile,
    fpsLimit: normalizeFpsLimit(savedProfile.fpsLimit)
  };
}

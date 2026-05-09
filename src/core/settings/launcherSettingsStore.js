const STORAGE_KEY = "good-old-launcher:settings";

function cloneDefaultSettings() {
  return {
    scan: {
      steamRoots: [],
      epicManifestRoots: [],
      gogRoots: [],
      eaRoots: [],
      customGameRoots: []
    },
    enableDemoProvider: true
  };
}

export function getLauncherSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultSettings();
    }

    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaultSettings(),
      ...parsed,
      scan: {
        ...cloneDefaultSettings().scan,
        ...(parsed.scan || {})
      }
    };
  } catch {
    return cloneDefaultSettings();
  }
}

export function saveLauncherSettings(nextSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
}

export function addScanPath(scanKey, value) {
  const settings = getLauncherSettings();
  if (!Array.isArray(settings.scan[scanKey])) {
    settings.scan[scanKey] = [];
  }

  const normalized = String(value || "").trim();
  if (!normalized) {
    return settings;
  }

  if (!settings.scan[scanKey].includes(normalized)) {
    settings.scan[scanKey].push(normalized);
    saveLauncherSettings(settings);
  }

  return settings;
}

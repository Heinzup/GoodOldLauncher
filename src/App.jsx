import { useEffect, useMemo, useState } from "react";
import { collectLibrary } from "./core/library/libraryService";
import { registerBuiltinProviders } from "./core/providers/mockProviders";
import { launchGame } from "./core/launch/launchService";
import {
  checkForUpdates,
  installDownloadedUpdate,
  installGame,
  pickCoverImage,
  loginService,
  logoutService,
  onUpdateStatus,
  openGameFolder,
  uninstallGame,
  verifyServiceConnection,
  windowClose,
  windowIsMaximized,
  windowMinimize,
  windowToggleMaximize
} from "./core/native/nativeBridge";
import { getProfile, saveProfile } from "./core/profiles/profileStore";
import {
  addScanPath,
  removeScanPath,
  getLauncherSettings,
  saveLauncherSettings
} from "./core/settings/launcherSettingsStore";
import { SUPPORTED_LANGUAGES, getSystemLanguage, t } from "./core/i18n/languages";
import ScanSettingsModal from "./components/ScanSettingsModal";
import IntegrationsModal from "./components/IntegrationsModal";
import playIcon from "../icons/Play_Icon_1.png";
import downloadIcon from "../icons/Download_Icon_1.png";
import removeIcon from "../icons/Remove_Icon_1.png";
import installedIcon from "../icons/App_Icon_4.png";

const STORAGE_KEY_FAVORITES = "launcher_favorites";
const STORAGE_KEY_INTEGRATIONS = "launcher_integrations";
const STORAGE_KEY_CUSTOM_COVERS = "launcher_custom_covers";

function getSteamCdnUrls(appId) {
  // Return array of fallback Steam CDN URLs (best to worst)
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/capsule_231x87.jpg`
  ];
}

function getCustomCoverUrl(gameId) {
  try {
    const customCovers = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM_COVERS)) || {};
    return customCovers[gameId] || null;
  } catch {
    return null;
  }
}

function toCoverUrl(coverPath, gameId, fallbackIndex = 0) {
  // Try custom cover first
  const customCover = getCustomCoverUrl(gameId);
  if (customCover) {
    return customCover;
  }

  // Try local cover
  if (coverPath && typeof coverPath === "string") {
    if (/^[a-zA-Z]:[\\/]/.test(coverPath)) {
      const withSlashes = coverPath.replace(/\\/g, "/");
      return encodeURI(`file:///${withSlashes}`);
    }

    if (coverPath.startsWith("\\\\")) {
      return encodeURI(`file:${coverPath.replace(/\\/g, "/")}`);
    }

    return coverPath;
  }

  // Fallback to Steam CDN if Steam game
  if (gameId && gameId.startsWith("steam-")) {
    const appId = gameId.substring(6);
    const cdnUrls = getSteamCdnUrls(appId);
    return cdnUrls[fallbackIndex] || cdnUrls[cdnUrls.length - 1];
  }

  return "";
}

export default function App() {
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [language, setLanguage] = useState(() => getSystemLanguage());
  const [statusText, setStatusText] = useState(t("ready", language));
  const [profile, setProfile] = useState(getProfile(""));
  const [settings, setSettings] = useState(getLauncherSettings());
  const [coverFallbackIndex, setCoverFallbackIndex] = useState({}); // gameId -> fallbackIndex
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showInstalled, setShowInstalled] = useState(false);
  const [showNotInstalled, setShowNotInstalled] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [updateState, setUpdateState] = useState("idle"); // idle | checking | available | not-available | downloading | downloaded | error | dev-skip
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITES)) || [];
    } catch {
      return [];
    }
  });
  const [integrations, setIntegrations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_INTEGRATIONS)) || {};
    } catch {
      return {};
    }
  });
  const [oauthLoading, setOAuthLoading] = useState(null); // null | platform name
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [customCoverInput, setCustomCoverInput] = useState("");
  const [fpsLimitInput, setFpsLimitInput] = useState("0");
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  const compatOptions = [
    { value: "none", label: t("compatOptionNone", language) },
    { value: "d3d8to9", label: t("compatOptionD3D8to9", language) },
    { value: "dgvoodoo2", label: t("compatOptionDgVoodoo2", language) },
    { value: "dxvk", label: t("compatOptionDxvk", language) }
  ];

  const compatHelpByValue = {
    none: t("compatHelpNone", language),
    d3d8to9: t("compatHelpD3D8to9", language),
    dgvoodoo2: t("compatHelpDgVoodoo2", language),
    dxvk: t("compatHelpDxvk", language)
  };

  const sourceOptions = [
    { value: "all", label: t("all", language) },
    { value: "Steam", label: "Steam" },
    { value: "Epic", label: "Epic Games" },
    { value: "GOG", label: "GOG" },
    { value: "EA", label: "EA Play" },
    { value: "Custom", label: t("customGameRoots", language) }
  ];

  async function loadLibrary() {
    registerBuiltinProviders();
    const importedGames = await collectLibrary();
    setGames(importedGames);
    if (importedGames.length > 0 && !selectedGameId) {
      setSelectedGameId(importedGames[0].id);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    const unsubscribe = onUpdateStatus((payload) => {
      if (!payload || typeof payload !== "object") {
        return;
      }

      if (payload.status === "checking") {
        setUpdateState("checking");
        setIsCheckingUpdates(true);
        setStatusText(payload.message || t("checkingUpdates", language));
      }

      if (payload.status === "downloading") {
        setUpdateState("downloading");
        setIsCheckingUpdates(false);
        setStatusText(payload.message || t("updateDownloading", language));
      }

      if (payload.status === "available") {
        setUpdateState("available");
        setIsCheckingUpdates(false);
        setStatusText(payload.message || t("updateDownloading", language));
      }

      if (payload.status === "not-available") {
        setUpdateState("not-available");
        setIsCheckingUpdates(false);
        setStatusText(payload.message || t("noUpdates", language));
      }

      if (payload.status === "dev-skip") {
        setUpdateState("dev-skip");
        setIsCheckingUpdates(false);
        setStatusText(payload.message || t("updatesDisabledDev", language));
      }

      if (payload.status === "downloaded") {
        setUpdateState("downloaded");
        setIsCheckingUpdates(false);
        setStatusText(payload.message || t("updateReady", language));
      }

      if (payload.status === "error") {
        setUpdateState("error");
        setIsCheckingUpdates(false);
        setStatusText(payload.message || t("updateError", language));
      }
    });

    checkForUpdates();
    return () => unsubscribe();
  }, [language]);

  async function handleCheckForUpdates() {
    setUpdateState("checking");
    setIsCheckingUpdates(true);
    setStatusText(t("checkingUpdates", language));
    const result = await checkForUpdates();
    if (!result?.ok) {
      setUpdateState("error");
      setIsCheckingUpdates(false);
      setStatusText(result?.error || t("updateError", language));
      return;
    }

    const terminalStatuses = new Set(["not-available", "downloaded", "error", "dev-skip"]);
    if (terminalStatuses.has(result.status)) {
      setIsCheckingUpdates(false);
      setUpdateState(result.status);
      if (result.message) {
        setStatusText(result.message);
      }
    }
  }

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);

    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
    };
  }, [contextMenu]);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  const filteredGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return games.filter((game) => {
      const sourceMatch = sourceFilter === "all" || game.source === sourceFilter;
      const installedMatch =
        (!showInstalled && !showNotInstalled) ||
        (showInstalled && game.installed) ||
        (showNotInstalled && !game.installed);
      const searchMatch = query.length < 1 || (game.title || "").toLowerCase().includes(query);
      return sourceMatch && installedMatch && searchMatch;
    });
  }, [games, sourceFilter, showInstalled, showNotInstalled, searchQuery]);

  const favoriteGames = useMemo(() => {
    return games.filter((game) => favorites.includes(game.id));
  }, [games, favorites]);

  const contextGame = useMemo(() => {
    if (!contextMenu?.gameId) {
      return null;
    }
    return games.find((game) => game.id === contextMenu.gameId) || null;
  }, [games, contextMenu]);

  useEffect(() => {
    if (!selectedGame) {
      return;
    }
    const loadedProfile = getProfile(selectedGame.id);
    setProfile(loadedProfile);
    setFpsLimitInput(String(loadedProfile.fpsLimit ?? 0));
    setCustomCoverInput(getCustomCoverUrl(selectedGame.id) || "");
  }, [selectedGame]);

  function normalizeFpsInput(rawValue) {
    const trimmed = String(rawValue ?? "").trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return Math.max(10, Math.min(parsed, 1000));
  }

  function commitFpsLimit(rawValue) {
    const normalized = normalizeFpsInput(rawValue);
    const normalizedText = String(normalized);
    setFpsLimitInput(normalizedText);

    if ((profile.fpsLimit ?? 0) !== normalized) {
      updateProfile({
        ...profile,
        fpsLimit: normalized
      });
    }
  }

  useEffect(() => {
    let mounted = true;

    async function syncWindowState() {
      const result = await windowIsMaximized();
      if (mounted && result?.ok) {
        setIsWindowMaximized(Boolean(result.isMaximized));
      }
    }

    syncWindowState();
    window.addEventListener("resize", syncWindowState);

    return () => {
      mounted = false;
      window.removeEventListener("resize", syncWindowState);
    };
  }, []);

  function saveCustomCoverPath(gameId, rawPath) {
    const pathValue = (rawPath || "").trim();
    const customCovers = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM_COVERS)) || {};
    if (pathValue) {
      customCovers[gameId] = pathValue;
    } else {
      delete customCovers[gameId];
    }
    localStorage.setItem(STORAGE_KEY_CUSTOM_COVERS, JSON.stringify(customCovers));
    setCoverFallbackIndex((current) => ({
      ...current,
      [gameId]: 0
    }));
  }

  function toggleFavorite(gameId) {
    const newFavorites = favorites.includes(gameId)
      ? favorites.filter((id) => id !== gameId)
      : [...favorites, gameId];
    setFavorites(newFavorites);
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(newFavorites));
  }

  async function handleLaunch() {
    if (!selectedGame) {
      return;
    }

    await handleLaunchForGame(selectedGame);
  }

  async function handleLaunchForGame(game) {
    if (!game) {
      return;
    }

    setStatusText(`${t("launching", language)}: ${game.title}`);
    const result = await launchGame(game);
    if (!result.ok) {
      setStatusText(`${t("launchError", language)}: ${result.error}`);
      return;
    }

    if (Array.isArray(result.notes) && result.notes.length > 0) {
      setStatusText(`${t("launchedWithNotes", language)}: ${game.title}`);
      return;
    }

    setStatusText(`${t("launched", language)}: ${game.title}`);
  }

  async function handleRefreshLibrary() {
    setStatusText(t("scanning", language));
    await loadLibrary();
    setStatusText(t("libraryRefreshed", language));
  }

  function updateProfile(nextProfile) {
    if (!selectedGame) {
      return;
    }

    setProfile(nextProfile);
    saveProfile(selectedGame.id, nextProfile);
  }

  function toggleDemoProvider() {
    const nextSettings = {
      ...settings,
      enableDemoProvider: !settings.enableDemoProvider
    };
    setSettings(nextSettings);
    saveLauncherSettings(nextSettings);
  }

  function handleAddPath(pathType, pathValue) {
    const next = addScanPath(pathType, pathValue);
    setSettings(next);
  }

  function handleRemovePath(pathType, pathValue) {
    const next = removeScanPath(pathType, pathValue);
    setSettings(next);
  }

  function handleSetIntegration(platform, connected) {
    const newIntegrations = {
      ...integrations,
      [platform]: {
        ...(integrations[platform] || {}),
        connected,
        lastActionAt: new Date().toISOString()
      }
    };
    setIntegrations(newIntegrations);
    localStorage.setItem(STORAGE_KEY_INTEGRATIONS, JSON.stringify(newIntegrations));
  }

  function handleSetIntegrationField(platform, field, value) {
    const newIntegrations = {
      ...integrations,
      [platform]: {
        ...(integrations[platform] || {}),
        [field]: value
      }
    };

    setIntegrations(newIntegrations);
    localStorage.setItem(STORAGE_KEY_INTEGRATIONS, JSON.stringify(newIntegrations));
  }

  async function handleLoginService(platform) {
    try {
      setOAuthLoading(platform);
      
      const platformName = platform.toLowerCase() === "steam" 
        ? "Steam" 
        : platform;
      
      setStatusText(`${t("connecting", language) || "Łączenie"}... ${platformName}`);

      const result = await loginService(platform);
      
      if (!result.ok) {
        setStatusText(`${t("launchError", language)}: ${result.error}`);
        setOAuthLoading(null);
        return;
      }

      // Jeśli wymaga manual input (dla platform poza Steam)
      if (result.requiresManualInput) {
        setStatusText(`⏳ ${platformName}: ${t("manualCredentialHint", language)}`);
        // oauthLoading zostaje ustawiony, aby pokazać spinner w IntegrationsModal
        return;
      }

      // Logowanie powiodło się (Steam auto-detected LUB token zweryfikowany)
      handleSetIntegration(platform, true);

      // Po zalogowaniu Steam - odśwież bibliotekę by wczytać gry + playtime
      if (platform.toLowerCase() === "steam") {
        loadLibrary();
      }
      
      // Pokazz info o koncie jeśli dostępne
      const accountName = result.accountName || result.personaName;
      const message = accountName 
        ? `✓ ${platformName} - ${accountName}`
        : `✓ ${platformName}`;
      
      setStatusText(message);
      setOAuthLoading(null);
    } catch (error) {
      setStatusText(`${t("launchError", language)}: ${error.message}`);
      setOAuthLoading(null);
    }
  }

  async function handleDisconnectService(platform) {
    try {
      setStatusText(`${t("connecting", language) || "Odłączanie"}... ${platform}`);
      
      const result = await logoutService(platform);
      if (!result.ok) {
        setStatusText(`${t("launchError", language)}: ${result.error}`);
        return;
      }

      handleSetIntegration(platform, false);
      setStatusText(`✓ ${platform} ${t("disconnected", language) || "odłączony"}`);
    } catch (error) {
      setStatusText(`${t("launchError", language)}: ${error.message}`);
    }
  }

  async function handleInstallForGame(game) {
    if (!game) {
      return;
    }

    const result = await installGame(game);
    if (!result.ok) {
      setStatusText(`${t("launchError", language)}: ${result.error}`);
      return;
    }

    setGames((current) => current.map((entry) => (entry.id === game.id ? { ...entry, installed: true } : entry)));
    setStatusText(`${t("installed", language)}: ${game.title}`);
  }

  async function handleUninstallForGame(game) {
    if (!game) {
      return;
    }

    const result = await uninstallGame(game);
    if (!result.ok) {
      setStatusText(`${t("launchError", language)}: ${result.error}`);
      return;
    }

    setGames((current) => current.map((entry) => (entry.id === game.id ? { ...entry, installed: false } : entry)));
    setStatusText(`${t("notDetected", language)}: ${game.title}`);
  }

  async function handleOpenFolderForGame(game) {
    if (!game) {
      return;
    }

    const result = await openGameFolder(game);
    if (!result.ok) {
      setStatusText(`${t("launchError", language)}: ${result.error}`);
    }
  }

  function handleGameContextMenu(event, game) {
    event.preventDefault();
    setSelectedGameId(game.id);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      gameId: game.id
    });
  }

  function handleGameTileKeyDown(event, game) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedGameId(game.id);
    }
  }

  function handleContextMenuOpen(event, game) {
    handleGameContextMenu(event, game);
  }

  async function handleUpdateButtonClick() {
    if (updateState === "available" || updateState === "downloading" || updateState === "checking") {
      await handleCheckForUpdates();
      return;
    }

    if (updateState === "downloaded") {
      await installDownloadedUpdate();
      return;
    }

    await handleCheckForUpdates();
  }

  function getUpdateButtonLabel() {
    if (updateState === "available" || updateState === "downloaded") {
      return t("updateAvailable", language);
    }

    if (updateState === "not-available") {
      return t("updateUpToDate", language);
    }

    if (updateState === "dev-skip") {
      return t("updatesDisabledDev", language);
    }

    if (updateState === "error") {
      return t("updateError", language);
    }

    return t("checkUpdates", language);
  }

  function getUpdateButtonIcon() {
    if (updateState === "available" || updateState === "downloaded") {
      return "⚠";
    }

    if (updateState === "not-available") {
      return "✓";
    }

    if (updateState === "dev-skip") {
      return "D";
    }

    if (updateState === "error") {
      return "!";
    }

    if (updateState === "downloading" || updateState === "checking") {
      return "…";
    }

    return "✓";
  }

  async function handleWindowToggleMaximize() {
    const result = await windowToggleMaximize();
    if (result?.ok) {
      setIsWindowMaximized(Boolean(result.isMaximized));
    }
  }

  return (
    <div className="app-shell">
      <div className="window-titlebar">
        <div className="window-drag-region">
          <span className="window-title-text">{t("appTitle", language)}</span>
        </div>
        <div className="window-controls">
          <button
            className="window-control-button"
            onClick={() => windowMinimize()}
            aria-label={t("windowMinimize", language)}
            title={t("windowMinimize", language)}
          >
            −
          </button>
          <button
            className="window-control-button"
            onClick={handleWindowToggleMaximize}
            aria-label={isWindowMaximized ? t("windowRestore", language) : t("windowMaximize", language)}
            title={isWindowMaximized ? t("windowRestore", language) : t("windowMaximize", language)}
          >
            {isWindowMaximized ? "❐" : "□"}
          </button>
          <button
            className="window-control-button close"
            onClick={() => windowClose()}
            aria-label={t("windowClose", language)}
            title={t("windowClose", language)}
          >
            ×
          </button>
        </div>
      </div>

      <header className="topbar">
        <div className="topbar-header">
          <h1>{t("appTitle", language)}</h1>
          <p>{t("appSubtitle", language)}</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={handleRefreshLibrary}>
            {t("refreshLibrary", language)}
          </button>
          <button className="secondary-button" onClick={() => setShowSettingsModal(true)}>
            {t("settings", language)}
          </button>
          <span className="topbar-game-count">{t("gamesFound", language)}: {filteredGames.length}</span>
          <select 
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <button
            className={`update-status-button ${updateState === "available" || updateState === "downloaded" ? "warning" : updateState === "not-available" ? "success" : updateState === "error" ? "error" : updateState === "checking" || updateState === "downloading" ? "busy" : ""}`}
            onClick={handleUpdateButtonClick}
            onContextMenu={(event) => {
              event.preventDefault();
              handleCheckForUpdates();
            }}
            title={getUpdateButtonLabel()}
            aria-label={getUpdateButtonLabel()}
            disabled={isCheckingUpdates && updateState === "checking"}
          >
            <span className="update-status-icon">{getUpdateButtonIcon()}</span>
          </button>
        </div>
      </header>

      {favoriteGames.length > 0 && (
        <section className="favorites-bar">
          <div className="favorites-label">{t("favorites", language) || "Ulubione"}</div>
          <div className="favorites-list">
            {favoriteGames.map((game) => {
              const fallbackIndex = coverFallbackIndex[game.id] || 0;
              const coverUrl = toCoverUrl(game.coverImagePath, game.id, fallbackIndex);
              const isSteamGame = game.id.startsWith("steam-");
              const steamUrls = isSteamGame ? getSteamCdnUrls(game.id.substring(6)) : [];
              const isLastFallback = isSteamGame && fallbackIndex >= steamUrls.length - 1;
              const showImage = Boolean(coverUrl) && !isLastFallback;
              
              return (
                <button
                  key={game.id}
                  className={`favorite-tile ${selectedGameId === game.id ? "selected" : ""}`}
                  onClick={() => setSelectedGameId(game.id)}
                  onContextMenu={(event) => handleContextMenuOpen(event, game)}
                  data-title={game.title}
                >
                  <span className="favorite-cover">
                    {showImage ? (
                      <img
                        src={coverUrl}
                        alt={game.title}
                        loading="lazy"
                        onError={() => {
                          if (isSteamGame && fallbackIndex < steamUrls.length - 1) {
                            setCoverFallbackIndex((current) => ({
                              ...current,
                              [game.id]: fallbackIndex + 1
                            }));
                          }
                        }}
                      />
                    ) : (
                      <span style={{ backgroundColor: game.coverColor }} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <main className="content-grid">
        <section className="panel library-panel">
          <div className="library-header">
            <div className="library-title-row">
              <h2>{t("library", language)}</h2>
              <input
                className="library-search"
                type="text"
                placeholder={t("searchPlaceholder", language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                aria-label={t("searchPlaceholder", language)}
              />
            </div>
            <div className="library-filters">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={showInstalled}
                  onChange={(e) => setShowInstalled(e.target.checked)}
                />
                {t("filterInstalled", language)}
              </label>
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={showNotInstalled}
                  onChange={(e) => setShowNotInstalled(e.target.checked)}
                />
                {t("filterNotInstalled", language)}
              </label>
              <select
                className="filter-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="game-list">
            {filteredGames.map((game) => {
              const fallbackIndex = coverFallbackIndex[game.id] || 0;
              const coverUrl = toCoverUrl(game.coverImagePath, game.id, fallbackIndex);
              const isSteamGame = game.id.startsWith("steam-");
              const steamUrls = isSteamGame ? getSteamCdnUrls(game.id.substring(6)) : [];
              const isLastFallback = isSteamGame && fallbackIndex >= steamUrls.length - 1;
              const showImage = Boolean(coverUrl) && !isLastFallback;
              const isFavorite = favorites.includes(game.id);

              return (
                <div
                  key={game.id}
                  className={`game-tile ${selectedGameId === game.id ? "selected" : ""}`}
                  onClick={() => setSelectedGameId(game.id)}
                  onKeyDown={(event) => handleGameTileKeyDown(event, game)}
                  onContextMenu={(event) => handleGameContextMenu(event, game)}
                  role="button"
                  tabIndex={0}
                  aria-label={game.title || game.id}
                >
                  {isFavorite && <span className="favorite-badge">★</span>}
                  <div className="game-cover">
                    {showImage ? (
                      <img
                        className="game-cover-image"
                        src={coverUrl}
                        alt={game.title || game.id}
                        loading="lazy"
                        onError={() => {
                          if (isSteamGame && fallbackIndex < steamUrls.length - 1) {
                            setCoverFallbackIndex((current) => ({
                              ...current,
                              [game.id]: fallbackIndex + 1
                            }));
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="game-cover-fallback"
                        style={{ backgroundColor: game.coverColor || "#1a2332" }}
                      >
                        {(game.title || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="game-title">{game.title || game.id}</div>
                  <div className="game-footer">
                    <div className="game-meta">{game.source || t("unknown", language)}</div>
                    <div className="game-actions" aria-label={game.title || game.id}>
                      <button
                        type="button"
                        className="game-action-button launch"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleLaunchForGame(game);
                        }}
                        disabled={!game.installed}
                        aria-label={t("launchGame", language)}
                        title={t("launchGame", language)}
                      >
                        <img src={playIcon} alt="" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="game-action-button install"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!game.installed) {
                            handleInstallForGame(game);
                          }
                        }}
                        disabled={game.installed}
                        aria-label={game.installed ? t("installed", language) : t("install", language)}
                        title={game.installed ? t("installed", language) : t("install", language)}
                      >
                        <img src={game.installed ? installedIcon : downloadIcon} alt="" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="game-action-button uninstall"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleUninstallForGame(game);
                        }}
                        disabled={!game.installed}
                        aria-label={t("uninstall", language)}
                        title={t("uninstall", language)}
                      >
                        <img src={removeIcon} alt="" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel details-panel">
          <h2>{t("gameDetails", language)}</h2>
          {selectedGame ? (
            <>
              <div className="game-header">
                <div>
                  <div className="details-row">
                    <span>{t("title", language)}</span>
                    <strong>{selectedGame.title}</strong>
                  </div>
                  <div className="details-row">
                    <span>{t("source", language)}</span>
                    <strong>{selectedGame.source}</strong>
                  </div>
                  <div className="details-row">
                    <span>{t("status", language)}</span>
                    <strong>{selectedGame.installed ? t("installed", language) : t("notDetected", language)}</strong>
                  </div>
                  {selectedGame.playtimeHours > 0 && (
                    <div className="details-row">
                      <span>{t("playtime", language)}</span>
                      <strong>{selectedGame.playtimeHours} {t("hoursShort", language)}</strong>
                    </div>
                  )}
                </div>
                <button
                  className={`favorite-button ${favorites.includes(selectedGame.id) ? "active" : ""}`}
                  onClick={() => toggleFavorite(selectedGame.id)}
                  title={favorites.includes(selectedGame.id) ? t("removeFromFavorites", language) : t("addToFavorites", language)}
                >
                  ★
                </button>
              </div>

              <h3>{t("coverSection", language)}</h3>
              <label className="field-label" htmlFor="customCoverPath">
                {t("customCoverPath", language)}
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  id="customCoverPath"
                  type="text"
                  placeholder={t("customCoverPlaceholder", language)}
                  value={customCoverInput}
                  onChange={(event) => setCustomCoverInput(event.target.value)}
                  onBlur={(event) => {
                    saveCustomCoverPath(selectedGame.id, event.currentTarget.value);
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  className="secondary-button"
                  onClick={async () => {
                    const result = await pickCoverImage();
                    if (!result?.ok) {
                      setStatusText(result?.error || t("updateError", language));
                      return;
                    }
                    if (result.canceled || !result.path) {
                      return;
                    }
                    setCustomCoverInput(result.path);
                    saveCustomCoverPath(selectedGame.id, result.path);
                  }}
                >
                  {t("chooseFile", language)}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setCustomCoverInput("");
                    saveCustomCoverPath(selectedGame.id, "");
                  }}
                >
                  {t("reset", language)}
                </button>
              </div>

              <h3>{t("compatibilityProfile", language)}</h3>

              <label className="field-label" htmlFor="compatLayer">
                {t("compatLayer", language)}
              </label>
              <select
                id="compatLayer"
                value={profile.compatLayer}
                onChange={(event) =>
                  updateProfile({
                    ...profile,
                    compatLayer: event.target.value
                  })
                }
              >
                {compatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="compat-help-text">{compatHelpByValue[profile.compatLayer] || compatHelpByValue.none}</p>

              <label className="checkbox-row" htmlFor="enableBorderless">
                <input
                  id="enableBorderless"
                  type="checkbox"
                  checked={profile.enableBorderless}
                  onChange={(event) =>
                    updateProfile({
                      ...profile,
                      enableBorderless: event.target.checked
                    })
                  }
                />
                {t("enableBorderless", language)}
              </label>

              <label className="field-label" htmlFor="launchArgs">
                {t("launchArgs", language)}
              </label>
              <input
                id="launchArgs"
                type="text"
                value={profile.launchArgs}
                placeholder={t("launchArgsPlaceholder", language)}
                onChange={(event) =>
                  updateProfile({
                    ...profile,
                    launchArgs: event.target.value
                  })
                }
              />

              <label className="field-label" htmlFor="fpsLimit">
                {t("fpsLimit", language)}
              </label>
              <input
                id="fpsLimit"
                type="number"
                min="0"
                max="1000"
                step="1"
                value={fpsLimitInput}
                placeholder={t("fpsLimitPlaceholder", language)}
                onChange={(event) => setFpsLimitInput(event.target.value)}
                onBlur={(event) => commitFpsLimit(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitFpsLimit(event.currentTarget.value);
                    event.currentTarget.blur();
                  }
                }}
              />

              <button className="launch-button" onClick={handleLaunch}>
                {t("launchGame", language)}
              </button>
            </>
          ) : (
            <p>{t("noGameSelected", language) || "Brak gry do wyświetlenia"}</p>
          )}
        </section>
      </main>

      <ScanSettingsModal
        isOpen={showScanModal}
        language={language}
        t={t}
        onClose={() => setShowScanModal(false)}
        settings={settings}
        onAddPath={handleAddPath}
        onRemovePath={handleRemovePath}
        onToggleDemo={toggleDemoProvider}
      />

      <IntegrationsModal
        isOpen={showIntegrationsModal}
        language={language}
        t={t}
        onClose={() => setShowIntegrationsModal(false)}
        integrations={integrations}
        onLogin={handleLoginService}
        onDisconnect={handleDisconnectService}
        onSetField={handleSetIntegrationField}
        oauthLoading={oauthLoading}
      />

      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{t("settings", language)}</h2>
              <button className="modal-close" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <div className="modal-body settings-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowScanModal(true);
                }}
              >
                {t("addPath", language)}
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowIntegrationsModal(true);
                }}
              >
                {t("integrations", language)}
              </button>
              <button
                className="secondary-button"
                onClick={async () => {
                  setShowSettingsModal(false);
                  await handleCheckForUpdates();
                }}
                disabled={isCheckingUpdates}
              >
                {isCheckingUpdates ? t("checkingUpdates", language) : t("checkUpdates", language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && contextGame ? (
        <div
          className="context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              handleLaunchForGame(contextGame);
              setContextMenu(null);
            }}
          >
            {t("launchGame", language)}
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              toggleFavorite(contextGame.id);
              setContextMenu(null);
            }}
          >
            {favorites.includes(contextGame.id) ? t("removeFromFavorites", language) : t("addToFavorites", language)}
          </button>
          {contextGame.installed ? (
            <button
              className="context-menu-item danger"
              onClick={() => {
                handleUninstallForGame(contextGame);
                setContextMenu(null);
              }}
            >
              {t("uninstall", language)}
            </button>
          ) : (
            <button
              className="context-menu-item"
              onClick={() => {
                handleInstallForGame(contextGame);
                setContextMenu(null);
              }}
            >
              {t("install", language)}
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={() => {
              handleOpenFolderForGame(contextGame);
              setContextMenu(null);
            }}
          >
            {t("openGameFolder", language)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

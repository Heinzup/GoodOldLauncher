import { useEffect, useMemo, useState } from "react";
import { collectLibrary } from "./core/library/libraryService";
import { registerBuiltinProviders } from "./core/providers/mockProviders";
import { launchGame } from "./core/launch/launchService";
import { installGame, loginService, logoutService, openGameFolder, uninstallGame, verifyServiceConnection } from "./core/native/nativeBridge";
import { getProfile, saveProfile } from "./core/profiles/profileStore";
import {
  addScanPath,
  getLauncherSettings,
  saveLauncherSettings
} from "./core/settings/launcherSettingsStore";
import { SUPPORTED_LANGUAGES, getSystemLanguage, t } from "./core/i18n/languages";
import ScanSettingsModal from "./components/ScanSettingsModal";
import IntegrationsModal from "./components/IntegrationsModal";

const STORAGE_KEY_FAVORITES = "launcher_favorites";
const STORAGE_KEY_INTEGRATIONS = "launcher_integrations";

function getSteamCdnUrl(appId) {
  // Steam CDN URL for library hero image (1920x622, good for tiles)
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`;
}

function toCoverUrl(coverPath, gameId) {
  if (!coverPath || typeof coverPath !== "string") {
    // Fallback to Steam CDN if no local cover and this is a Steam game
    if (gameId && gameId.startsWith("steam-")) {
      const appId = gameId.substring(6); // Remove "steam-" prefix
      return getSteamCdnUrl(appId);
    }
    return "";
  }

  if (/^[a-zA-Z]:[\\/]/.test(coverPath)) {
    const withSlashes = coverPath.replace(/\\/g, "/");
    return encodeURI(`file:///${withSlashes}`);
  }

  if (coverPath.startsWith("\\\\")) {
    return encodeURI(`file:${coverPath.replace(/\\/g, "/")}`);
  }

  return coverPath;
}

export default function App() {
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [language, setLanguage] = useState(() => getSystemLanguage());
  const [statusText, setStatusText] = useState(t("ready", language));
  const [profile, setProfile] = useState(getProfile(""));
  const [settings, setSettings] = useState(getLauncherSettings());
  const [brokenCovers, setBrokenCovers] = useState({});
  const [sourceFilter, setSourceFilter] = useState("all");
  const [installedFilter, setInstalledFilter] = useState("all");
  const [showScanModal, setShowScanModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
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


  const compatOptions = [
    { value: "none", label: t("none", language) },
    { value: "d3d8to9", label: "d3d8to9" },
    { value: "dgvoodoo2", label: "dgVoodoo2" },
    { value: "dxvk", label: "DXVK" }
  ];

  const sourceOptions = [
    { value: "all", label: t("all", language) || "Wszystkie" },
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
    return games.filter((game) => {
      const sourceMatch = sourceFilter === "all" || game.source === sourceFilter;
      const installedMatch =
        installedFilter === "all" ||
        (installedFilter === "installed" && game.installed) ||
        (installedFilter === "notInstalled" && !game.installed);
      return sourceMatch && installedMatch;
    });
  }, [games, sourceFilter, installedFilter]);

  const favoriteGames = useMemo(() => {
    return games.filter((game) => favorites.includes(game.id)).slice(0, 8);
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
    setProfile(getProfile(selectedGame.id));
  }, [selectedGame]);

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
      setStatusText(`${t("connecting", language) || "Łączenie"}... ${platform}`);

      const result = await loginService(platform);
      
      if (!result.ok) {
        setStatusText(`${t("launchError", language)}: ${result.error}`);
        setOAuthLoading(null);
        return;
      }

      // Jeśli wymaga manual input (Steam SteamID, itd.)
      if (result.requiresManualInput) {
        setStatusText(`⏳ ${platform}: Wklej dane identyfikacyjne w oknie integracji`);
        // Nie ustawiamy connected=true, bo user musi jeszcze wprowadzić dane
        // oauthLoading zostaje ustawiony, aby pokazać spinner w IntegrationsModal
        return;
      }

      // Logowanie powiodło się, token został zapisany
      handleSetIntegration(platform, true);
      
      // Pokazz info o koncie jeśli dostępne
      const accountInfo = result.accountInfo || {};
      const message = accountInfo.username 
        ? `${platform} - ${accountInfo.username}`
        : platform;
      
      setStatusText(`✓ ${t("integrations", language) || "Integracje"}: ${message}`);
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-header">
          <h1>{t("appTitle", language)}</h1>
          <p>{t("appSubtitle", language)}</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={handleRefreshLibrary}>
            {t("refreshLibrary", language)}
          </button>
          <button className="secondary-button" onClick={() => setShowScanModal(true)}>
            {t("addPath", language) || "Dodaj lokalizację"}
          </button>
          <button className="secondary-button" onClick={() => setShowIntegrationsModal(true)}>
            {t("integrations", language) || "Integracje"}
          </button>
          <select 
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <div className="status-pill">{statusText}</div>
        </div>
      </header>

      {favoriteGames.length > 0 && (
        <section className="favorites-bar">
          <div className="favorites-label">{t("favorites", language) || "Ulubione"}</div>
          <div className="favorites-list">
            {favoriteGames.map((game) => {
              const coverUrl = toCoverUrl(game.coverImagePath, game.id);
              const showImage = Boolean(coverUrl) && !brokenCovers[game.id];
              return (
                <button
                  key={game.id}
                  className={`favorite-tile ${selectedGameId === game.id ? "selected" : ""}`}
                  onClick={() => setSelectedGameId(game.id)}
                  title={game.title}
                >
                  <span className="favorite-cover">
                    {showImage ? (
                      <img
                        src={coverUrl}
                        alt={game.title}
                        loading="lazy"
                        onError={() =>
                          setBrokenCovers((current) => ({
                            ...current,
                            [game.id]: true
                          }))
                        }
                      />
                    ) : (
                      <span style={{ backgroundColor: game.coverColor }} />
                    )}
                  </span>
                  <div className="favorite-title">{game.title}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <main className="content-grid">
        <section className="panel library-panel">
          <div className="library-header">
            <h2>{t("library", language)}</h2>
            <div className="library-filters">
              <select
                className="filter-select"
                value={installedFilter}
                onChange={(e) => setInstalledFilter(e.target.value)}
              >
                <option value="all">Wszystkie</option>
                <option value="installed">✓ Zainstalowane</option>
                <option value="notInstalled">✗ Nie zainstalowane</option>
              </select>
              <select
                className="filter-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="game-count">{filteredGames.length}</span>
            </div>
          </div>
          <div className="game-list">
            {filteredGames.map((game) => {
              const coverUrl = toCoverUrl(game.coverImagePath, game.id);
              const showImage = Boolean(coverUrl) && !brokenCovers[game.id];
              const isFavorite = favorites.includes(game.id);

              return (
                <button
                  key={game.id}
                  className={`game-tile ${selectedGameId === game.id ? "selected" : ""}`}
                  onClick={() => setSelectedGameId(game.id)}
                  onContextMenu={(event) => handleGameContextMenu(event, game)}
                >
                  {isFavorite && <span className="favorite-badge">★</span>}
                  <div className="game-cover">
                    {showImage ? (
                      <img
                        className="game-cover-image"
                        src={coverUrl}
                        alt={game.title || game.id}
                        loading="lazy"
                        onError={() =>
                          setBrokenCovers((current) => ({
                            ...current,
                            [game.id]: true
                          }))
                        }
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
                  <div className="game-meta">{game.source || "Unknown"}</div>
                </button>
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
                </div>
                <button
                  className={`favorite-button ${favorites.includes(selectedGame.id) ? "active" : ""}`}
                  onClick={() => toggleFavorite(selectedGame.id)}
                  title={favorites.includes(selectedGame.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                >
                  ★
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
            {favorites.includes(contextGame.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
          </button>
          {contextGame.installed ? (
            <button
              className="context-menu-item danger"
              onClick={() => {
                handleUninstallForGame(contextGame);
                setContextMenu(null);
              }}
            >
              Odinstaluj
            </button>
          ) : (
            <button
              className="context-menu-item"
              onClick={() => {
                handleInstallForGame(contextGame);
                setContextMenu(null);
              }}
            >
              Zainstaluj
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={() => {
              handleOpenFolderForGame(contextGame);
              setContextMenu(null);
            }}
          >
            Otwórz folder gry
          </button>
        </div>
      ) : null}
    </div>
  );
}

import { useState } from "react";
import { storeServiceCredential } from "../core/native/nativeBridge";

export default function IntegrationsModal({
  isOpen,
  language,
  t,
  onClose,
  integrations,
  onLogin,
  onDisconnect,
  onSetField,
  oauthLoading
}) {
  const [manualInputs, setManualInputs] = useState({}); // { Platform: "value" }
  const [storingCredential, setStoringCredential] = useState(null);

  if (!isOpen) return null;

  const platforms = [
    { id: "Steam", name: "Steam", icon: "🎮", color: "#1b2839", credentialHelp: "Skopiuj SteamID64 (17 cyfr) ze swojego profilu https://steamcommunity.com/my" },
    { id: "EA", name: "EA Play", icon: "🎯", color: "#111a1f", credentialHelp: "Wklej token EA API" },
    { id: "Ubisoft", name: "Ubisoft Connect", icon: "🛡️", color: "#1e2f4f", credentialHelp: "Wklej token Ubisoft API" },
    { id: "Epic", name: "Epic Games", icon: "⚔️", color: "#001a33", credentialHelp: "Wklej token Epic API" },
    { id: "GOG", name: "GOG", icon: "🕹️", color: "#2d2d2d", credentialHelp: "Wklej token GOG API" }
  ];

  async function handleSubmitCredential(platformId) {
    const credential = manualInputs[platformId];
    if (!credential || !credential.trim()) {
      alert("Wklej dane identyfikacyjne");
      return;
    }

    try {
      setStoringCredential(platformId);
      const result = await storeServiceCredential(platformId, credential);
      
      if (result.ok) {
        // Zapisz do integrations
        onSetField(platformId, "connected", true);
        onSetField(platformId, "userId", credential);
        
        // Wyczyść input
        setManualInputs(prev => ({
          ...prev,
          [platformId]: ""
        }));
      } else {
        alert(`Błąd: ${result.error}`);
      }
    } catch (error) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setStoringCredential(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("integrations", language) || "Integracje"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="integrations-list">
            {platforms.map((platform) => {
              const state = integrations[platform.id] || {};
              const isConnected = Boolean(state.connected || state === true);
              const isLoading = oauthLoading === platform.id;
              const isProcessing = storingCredential === platform.id;
              const showManualInput = isLoading || isProcessing;

              return (
              <div key={platform.id} className="integration-item">
                <div className="integration-header">
                  <span className="integration-icon">{platform.icon}</span>
                  <div className="integration-info">
                    <h3>{platform.name}</h3>
                    <p>
                      {isProcessing
                        ? "⏳ Weryfikowanie..."
                        : isLoading 
                          ? "⏳ Logowanie..." 
                          : isConnected 
                            ? "✓ Połączono" 
                            : "Kliknij aby zalogować"}
                    </p>
                  </div>
                  <div className="integration-actions">
                    {!isConnected ? (
                      <button
                        className="integration-login"
                        onClick={() => onLogin(platform.id)}
                        disabled={isLoading || isProcessing}
                      >
                        {isProcessing ? "⏳ Weryfikowanie..." : isLoading ? "⏳ Logowanie..." : "Zaloguj"}
                      </button>
                    ) : (
                      <button
                        className="integration-disconnect"
                        onClick={() => onDisconnect(platform.id)}
                        disabled={isProcessing}
                      >
                        Wyloguj
                      </button>
                    )}
                  </div>
                </div>

                {showManualInput && (
                  <div className="integration-manual-input">
                    <p className="integration-help-text">
                      {platform.credentialHelp}
                    </p>
                    <input
                      type="text"
                      placeholder="Wklej tutaj..."
                      value={manualInputs[platform.id] || ""}
                      onChange={(e) => setManualInputs(prev => ({
                        ...prev,
                        [platform.id]: e.target.value
                      }))}
                      disabled={isProcessing}
                    />
                    <button
                      className="integration-confirm"
                      onClick={() => handleSubmitCredential(platform.id)}
                      disabled={isProcessing || !manualInputs[platform.id]?.trim()}
                    >
                      {isProcessing ? "Weryfikowanie..." : "Potwierdź"}
                    </button>
                  </div>
                )}

                {isConnected && !showManualInput && (
                  <div className="integration-details">
                    <label className="field-label">
                      {platform.name} User ID
                    </label>
                    <input
                      type="text"
                      placeholder={`Np. steam_id_64 dla ${platform.name}`}
                      value={state.userId || ""}
                      onChange={(e) => onSetField(platform.id, "userId", e.target.value)}
                    />

                    <label className="field-label">API Token (opcjonalnie)</label>
                    <input
                      type="password"
                      placeholder="Twój token API..."
                      value={state.token || ""}
                      onChange={(e) => onSetField(platform.id, "token", e.target.value)}
                    />

                    <p className="integration-note">
                      🔒 Dane są przechowywane bezpiecznie. Logowanie jest wykonywane przez oficjalne strony usług.
                    </p>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <div className="add-path-section">
            <h3>O integracjach</h3>
            <p>
              Połącz swoje konta aby launcher mógł:
            </p>
            <ul>
              <li>🕐 Synchronizować czas rozgrywki</li>
              <li>🎮 Pobierać listę gier z twojego konta</li>
              <li>🌐 Aktualizować osiągnięcia</li>
              <li>📊 Śledzić statystyki</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

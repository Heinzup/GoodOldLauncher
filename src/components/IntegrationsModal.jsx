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
    { id: "Steam", name: "Steam", icon: "🎮", color: "#1b2839", credentialHelp: t("steamCredentialHelp", language) },
    { id: "EA", name: "EA Play", icon: "🎯", color: "#111a1f", credentialHelp: t("eaCredentialHelp", language) },
    { id: "Ubisoft", name: "Ubisoft Connect", icon: "🛡️", color: "#1e2f4f", credentialHelp: t("ubisoftCredentialHelp", language) },
    { id: "Epic", name: "Epic Games", icon: "⚔️", color: "#001a33", credentialHelp: t("epicCredentialHelp", language) },
    { id: "GOG", name: "GOG", icon: "🕹️", color: "#2d2d2d", credentialHelp: t("gogCredentialHelp", language) }
  ];

  async function handleSubmitCredential(platformId) {
    const credential = manualInputs[platformId];
    if (!credential || !credential.trim()) {
      alert(t("pasteCredentials", language));
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
        alert(`${t("verificationError", language)}: ${result.error}`);
      }
    } catch (error) {
      alert(`${t("verificationError", language)}: ${error.message}`);
    } finally {
      setStoringCredential(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("integrations", language)}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="integrations-list">
            {platforms.map((platform) => {
              const state = integrations[platform.id] || {};
              const isConnected = Boolean(state.connected || state === true);
              const isLoading = oauthLoading === platform.id;
              const isProcessing = storingCredential === platform.id;
              
              // Dla Steam - nie pokazuj manual input, bo auto-detection obsługuje wszystko
              // Dla innych - jeśli isLoading, to znaczy czekamy na manual input
              const shouldShowManualInput = isLoading && platform.id !== "Steam";

              return (
              <div key={platform.id} className="integration-item">
                <div className="integration-header">
                  <span className="integration-icon">{platform.icon}</span>
                  <div className="integration-info">
                    <h3>{platform.name}</h3>
                    <p>
                      {isProcessing
                        ? t("integrationVerifying", language)
                        : isLoading 
                          ? platform.id === "Steam"
                            ? t("integrationAutoDetectSteam", language)
                            : t("integrationWaitingData", language)
                          : isConnected 
                            ? t("integrationConnected", language)
                            : t("integrationClickToLogin", language)}
                    </p>
                  </div>
                  <div className="integration-actions">
                    {!isConnected ? (
                      <button
                        className="integration-login"
                        onClick={() => onLogin(platform.id)}
                        disabled={isLoading || isProcessing}
                      >
                        {isProcessing ? t("integrationVerifying", language) : isLoading ? t("loggingIn", language) : t("login", language)}
                      </button>
                    ) : (
                      <button
                        className="integration-disconnect"
                        onClick={() => onDisconnect(platform.id)}
                        disabled={isProcessing}
                      >
                        {t("logout", language)}
                      </button>
                    )}
                  </div>
                </div>

                {shouldShowManualInput && (
                  <div className="integration-manual-input">
                    <p className="integration-help-text">
                      {platform.credentialHelp}
                    </p>
                    <input
                      type="text"
                      placeholder={t("pasteHere", language)}
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
                      {isProcessing ? t("integrationVerifying", language) : t("confirm", language)}
                    </button>
                  </div>
                )}

                {isConnected && !shouldShowManualInput && (
                  <div className="integration-details">
                    <label className="field-label">
                      {platform.name} {t("userIdLabel", language)}
                    </label>
                    <input
                      type="text"
                      placeholder={`${t("userIdPlaceholder", language)} ${platform.name}`}
                      value={state.userId || ""}
                      onChange={(e) => onSetField(platform.id, "userId", e.target.value)}
                    />

                    <label className="field-label">{t("apiTokenOptional", language)}</label>
                    <input
                      type="password"
                      placeholder={t("apiTokenPlaceholder", language)}
                      value={state.token || ""}
                      onChange={(e) => onSetField(platform.id, "token", e.target.value)}
                    />

                    <p className="integration-note">
                      {t("secureStorageNote", language)}
                    </p>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <div className="add-path-section">
            <h3>{t("integrationsAbout", language)}</h3>
            <p>
              {t("integrationsAboutLead", language)}
            </p>
            <ul>
              <li>{t("integrationsSyncPlaytime", language)}</li>
              <li>{t("integrationsFetchGames", language)}</li>
              <li>{t("integrationsSyncAchievements", language)}</li>
              <li>{t("integrationsTrackStats", language)}</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            {t("close", language)}
          </button>
        </div>
      </div>
    </div>
  );
}

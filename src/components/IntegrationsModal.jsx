export default function IntegrationsModal({
  isOpen,
  language,
  t,
  onClose,
  integrations,
  onSetIntegration
}) {
  if (!isOpen) return null;

  const platforms = [
    { id: "Steam", name: "Steam", icon: "🎮", color: "#1b2839" },
    { id: "EA", name: "EA Play", icon: "🎯", color: "#111a1f" },
    { id: "Epic", name: "Epic Games", icon: "⚔️", color: "#001a33" },
    { id: "GOG", name: "GOG", icon: "🕹️", color: "#2d2d2d" }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("integrations", language) || "Integracje"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="integrations-list">
            {platforms.map((platform) => (
              <div key={platform.id} className="integration-item">
                <div className="integration-header">
                  <span className="integration-icon">{platform.icon}</span>
                  <div className="integration-info">
                    <h3>{platform.name}</h3>
                    <p>
                      {integrations[platform.id]
                        ? "Połączono"
                        : "Kliknij aby połączyć"}
                    </p>
                  </div>
                  <button
                    className={`integration-toggle ${
                      integrations[platform.id] ? "connected" : ""
                    }`}
                    onClick={() =>
                      onSetIntegration(
                        platform.id,
                        !integrations[platform.id]
                      )
                    }
                  >
                    {integrations[platform.id] ? "✓" : "+"}
                  </button>
                </div>

                {integrations[platform.id] && (
                  <div className="integration-details">
                    <label className="field-label">
                      {platform.name} User ID
                    </label>
                    <input
                      type="text"
                      placeholder={`Np. steam_id_64 dla ${platform.name}`}
                      defaultValue={
                        integrations[`${platform.id}_userId`] || ""
                      }
                      onChange={(e) => {
                        const next = {
                          ...integrations,
                          [`${platform.id}_userId`]: e.target.value
                        };
                        localStorage.setItem(
                          "launcher_integrations",
                          JSON.stringify(next)
                        );
                      }}
                    />

                    <label className="field-label">API Token (opcjonalnie)</label>
                    <input
                      type="password"
                      placeholder="Twój token API..."
                      defaultValue={
                        integrations[`${platform.id}_token`] || ""
                      }
                      onChange={(e) => {
                        const next = {
                          ...integrations,
                          [`${platform.id}_token`]: e.target.value
                        };
                        localStorage.setItem(
                          "launcher_integrations",
                          JSON.stringify(next)
                        );
                      }}
                    />

                    <p className="integration-note">
                      🔒 Dane są przechowywane lokalnie. Nie są wysyłane nigdzie.
                    </p>
                  </div>
                )}
              </div>
            ))}
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

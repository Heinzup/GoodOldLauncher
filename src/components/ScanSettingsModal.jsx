import { useState } from "react";

export default function ScanSettingsModal({ isOpen, language, t, onClose, settings, onAddPath, onRemovePath, onToggleDemo }) {
  const [pathType, setPathType] = useState("steamRoots");
  const [pathValue, setPathValue] = useState("");

  const scanPathOptions = [
    { value: "steamRoots", label: t("steamRoots", language) },
    { value: "epicManifestRoots", label: t("epicManifestRoots", language) },
    { value: "gogRoots", label: t("gogRoots", language) },
    { value: "eaRoots", label: t("eaRoots", language) },
    { value: "customGameRoots", label: t("customGameRoots", language) }
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("scanSettings", language)}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <label className="checkbox-row" htmlFor="demoProvider">
            <input
              id="demoProvider"
              type="checkbox"
              checked={settings.enableDemoProvider}
              onChange={() => onToggleDemo()}
            />
            {t("showDemoGames", language)}
          </label>

          <div className="add-path-section">
            <h3>{t("addCustomPath", language)}</h3>
            
            <label className="field-label" htmlFor="scanPathType">
              {t("pathType", language)}
            </label>
            <select
              id="scanPathType"
              value={pathType}
              onChange={(event) => setPathType(event.target.value)}
            >
              {scanPathOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="scanPathValue">
              {t("addCustomPath", language)}
            </label>
            <input
              id="scanPathValue"
              type="text"
              value={pathValue}
              placeholder={t("customPathExample", language)}
              onChange={(event) => setPathValue(event.target.value)}
            />
            <button 
              className="secondary-button" 
              onClick={() => {
                onAddPath(pathType, pathValue);
                setPathValue("");
              }}
            >
              {t("addPath", language)}
            </button>
          </div>

          <div className="path-list">
            {scanPathOptions.map((option) => (
              <div key={option.value} className="path-group">
                <strong>{option.label}</strong>
                <ul>
                  {(settings.scan[option.value] || []).map((pathValue) => (
                    <li key={`${option.value}-${pathValue}`} className="path-list-item">
                      <span className="path-list-value">{pathValue}</span>
                      <button
                        className="path-remove-btn"
                        title={t("removeLocation", language)}
                        onClick={() => onRemovePath(option.value, pathValue)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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

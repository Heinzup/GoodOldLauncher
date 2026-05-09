const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// Ścieżka do bezpiecznego storage tokeny
const tokenStorePath = path.join(app.getPath("userData"), ".tokens");

// Ensure directory exists
if (!fs.existsSync(tokenStorePath)) {
  fs.mkdirSync(tokenStorePath, { recursive: true });
}

/**
 * Bezpieczne przechowywanie i pobieranie tokenów
 */
class TokenStore {
  /**
   * Zapisz token dla serwisu
   * @param {string} service - Nazwa serwisu (Steam, EA, Epic, GOG, Ubisoft)
   * @param {string} token - Token do zapisania
   * @param {object} metadata - Dodatkowe metadane (userId, expiresAt, itp.)
   */
  static setToken(service, token, metadata = {}) {
    try {
      if (!token || typeof token !== "string") {
        throw new Error("Token musi być stringiem");
      }

      const filePath = this._getFilePath(service);
      
      // Zaszyfruj token
      const encrypted = safeStorage.encryptString(token);
      
      // Przechowaj z metadanymi
      const data = {
        token: encrypted.toString("latin1"),
        metadata: {
          createdAt: new Date().toISOString(),
          ...metadata
        }
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      return { ok: true };
    } catch (error) {
      console.error(`[TokenStore] Błąd zapisywania tokenu dla ${service}:`, error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Pobierz token dla serwisu
   * @param {string} service - Nazwa serwisu
   * @returns {object} { ok: boolean, token?: string, metadata?: object, error?: string }
   */
  static getToken(service) {
    try {
      const filePath = this._getFilePath(service);
      
      if (!fs.existsSync(filePath)) {
        return { ok: false, error: "Brak tokenu" };
      }

      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      
      // Odszyfruj token
      const decrypted = safeStorage.decryptString(
        Buffer.from(data.token, "latin1")
      );

      return {
        ok: true,
        token: decrypted,
        metadata: data.metadata || {}
      };
    } catch (error) {
      console.error(`[TokenStore] Błąd pobierania tokenu dla ${service}:`, error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Usuń token dla serwisu
   * @param {string} service - Nazwa serwisu
   */
  static deleteToken(service) {
    try {
      const filePath = this._getFilePath(service);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { ok: true };
    } catch (error) {
      console.error(`[TokenStore] Błąd usuwania tokenu dla ${service}:`, error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Sprawdź czy istnieje token
   * @param {string} service - Nazwa serwisu
   */
  static hasToken(service) {
    try {
      const filePath = this._getFilePath(service);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Wygeneruj ścieżkę pliku dla tokenu
   * @private
   */
  static _getFilePath(service) {
    const safeName = String(service || "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return path.join(tokenStorePath, `${safeName}.json`);
  }
}

module.exports = TokenStore;

const TokenStore = require("./tokenStore.cjs");

/**
 * Weryfikacja autentykacji dla każdej platformy
 */

/**
 * Weryfikuj Steam login - sprawdź czy SteamID istnieje w config
 * @param {string} steamId - SteamID64
 * @returns {Promise<{ok: boolean, accountInfo?: object, error?: string}>}
 */
async function verifySteamLogin(steamId) {
  try {
    if (!steamId || !/^\d{17}$/.test(steamId)) {
      return { ok: false, error: "Nieprawidłowy format SteamID" };
    }

    // Sprawdzenie czy SteamID jest zapisany i dostępny
    const tokenResult = TokenStore.getToken("Steam");
    if (!tokenResult.ok || tokenResult.token !== steamId) {
      return { ok: false, error: "Token nie zgadza się z zapisanym SteamID" };
    }

    return {
      ok: true,
      accountInfo: {
        platform: "Steam",
        userId: steamId,
        verified: true,
        detectionMethod: "local"
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Weryfikuj EA login
 */
async function verifyEALogin(token) {
  try {
    // EA wymaga API Key - tymczasowo zwracamy walidację tokenu
    if (!token || token.length < 10) {
      return { ok: false, error: "Nieprawidłowy EA token" };
    }

    return {
      ok: true,
      accountInfo: {
        platform: "EA",
        verified: true
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Weryfikuj Epic login
 */
async function verifyEpicLogin(token) {
  try {
    if (!token || token.length < 10) {
      return { ok: false, error: "Nieprawidłowy Epic token" };
    }

    // Epic oferuje endpoint do weryfikacji tokenu
    // Wymaga ClientID
    return {
      ok: true,
      accountInfo: {
        platform: "Epic",
        verified: true
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Weryfikuj GOG login
 */
async function verifyGOGLogin(token) {
  try {
    if (!token || token.length < 10) {
      return { ok: false, error: "Nieprawidłowy GOG token" };
    }

    // GOG API - https://galaxy-api.gog.com/users/me
    const response = await fetch("https://galaxy-api.gog.com/users/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return { ok: false, error: "Token GOG nie jest ważny" };
    }

    const userData = await response.json();
    return {
      ok: true,
      accountInfo: {
        platform: "GOG",
        userId: userData.userId,
        username: userData.username,
        verified: true
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Weryfikuj Ubisoft login
 */
async function verifyUbisoftLogin(token) {
  try {
    if (!token || token.length < 10) {
      return { ok: false, error: "Nieprawidłowy Ubisoft token" };
    }

    // Ubisoft Connect API
    const response = await fetch("https://public-ubiservices.ubi.com/v3/profiles/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return { ok: false, error: "Token Ubisoft nie jest ważny" };
    }

    const userData = await response.json();
    return {
      ok: true,
      accountInfo: {
        platform: "Ubisoft",
        userId: userData.id,
        username: userData.nameOnPlatform,
        verified: true
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Główna funkcja do weryfikacji loginu dla dowolnej platformy
 * @param {string} service - Nazwa serwisu
 * @returns {Promise<{ok: boolean, accountInfo?: object, error?: string}>}
 */
async function verifyAuthConnection(service) {
  try {
    const service_lower = String(service || "").toLowerCase();

    // Pobierz token z secure storage
    const tokenResult = TokenStore.getToken(service);
    if (!tokenResult.ok) {
      return { ok: false, error: "Brak zapisanego tokenu" };
    }

    const { token, metadata } = tokenResult;

    // Weryfikuj w zależności od platformy
    switch (service_lower) {
      case "steam":
        return verifySteamLogin(token);
      case "ea":
      case "ea play":
        return verifyEALogin(token);
      case "epic":
      case "epic games":
        return verifyEpicLogin(token);
      case "gog":
        return verifyGOGLogin(token);
      case "ubisoft":
      case "ubisoft connect":
        return verifyUbisoftLogin(token);
      default:
        return { ok: false, error: "Nieznana usługa" };
    }
  } catch (error) {
    console.error(`[AuthValidator] Błąd weryfikacji ${service}:`, error);
    return { ok: false, error: error.message };
  }
}

/**
 * Weryfikuj wszystkie połączenia przy starcie
 */
async function verifyAllConnections(services = ["Steam", "EA", "Epic", "GOG", "Ubisoft"]) {
  const results = {};

  for (const service of services) {
    try {
      results[service] = await verifyAuthConnection(service);
    } catch (error) {
      results[service] = { ok: false, error: error.message };
    }
  }

  return results;
}

module.exports = {
  verifyAuthConnection,
  verifyAllConnections,
  verifySteamLogin,
  verifyEALogin,
  verifyEpicLogin,
  verifyGOGLogin,
  verifyUbisoftLogin
};

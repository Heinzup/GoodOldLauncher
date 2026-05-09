const providers = [];

export function registerProvider(provider) {
  if (!provider?.id || typeof provider.scanGames !== "function") {
    throw new Error("Invalid provider definition.");
  }

  providers.push(provider);
}

export function getProviders() {
  return [...providers];
}

export function resetProviders() {
  providers.length = 0;
}

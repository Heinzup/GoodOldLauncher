import { getProviders } from "../providers/providerRegistry";

export async function collectLibrary() {
  const providers = getProviders();

  const scans = await Promise.all(
    providers.map(async (provider) => {
      try {
        const games = await provider.scanGames();
        return games.map((game) => ({ ...game, providerId: provider.id }));
      } catch (error) {
        return [];
      }
    })
  );

  const merged = scans.flat();
  const uniqueById = new Map();

  for (const game of merged) {
    if (!uniqueById.has(game.id)) {
      uniqueById.set(game.id, game);
    }
  }

  return [...uniqueById.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function buildCompatibilityPlan(profile) {
  const compatLayer = profile.compatLayer || "none";
  const fpsLimit = Number.isFinite(Number(profile.fpsLimit))
    ? (Number(profile.fpsLimit) > 0
      ? Math.max(10, Math.min(1000, Number(profile.fpsLimit)))
      : 0)
    : 0;

  const notes = [];
  if (compatLayer !== "none") {
    notes.push(`Requested compatibility layer: ${compatLayer}`);
  }

  if (profile.enableBorderless) {
    notes.push("Borderless requested (requires runtime hook in compatibility stage).");
  }

  if (fpsLimit > 0) {
    notes.push(`FPS limit requested: ${fpsLimit}`);
  }

  return {
    compatLayer,
    enableBorderless: Boolean(profile.enableBorderless),
    fpsLimit,
    notes
  };
}

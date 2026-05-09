export function buildCompatibilityPlan(profile) {
  const compatLayer = profile.compatLayer || "none";

  const notes = [];
  if (compatLayer !== "none") {
    notes.push(`Requested compatibility layer: ${compatLayer}`);
  }

  if (profile.enableBorderless) {
    notes.push("Borderless requested (requires runtime hook in compatibility stage).");
  }

  return {
    compatLayer,
    enableBorderless: Boolean(profile.enableBorderless),
    notes
  };
}

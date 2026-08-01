/**
 * Shared volume parsing — preserves saved 0, clamps malformed values.
 * Separated from Settings.jsx so Node tests can import without React.
 */

export const DEFAULT_VOLUME_PERCENT = 100;
export const BASE_VOLUME_MULTIPLIER = 2.5;

export function clampVolumePercent(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_VOLUME_PERCENT;
  return Math.max(0, Math.min(100, n));
}

/**
 * Parse a saved volume percent. Nullish / invalid → default 100.
 * Explicit 0 is preserved (never coerced via truthiness).
 */
export function parseVolumeSetting(raw) {
  if (raw == null || raw === "") return DEFAULT_VOLUME_PERCENT;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME_PERCENT;
  return clampVolumePercent(n);
}

export function volumePercentToGain(percent) {
  return clampVolumePercent(percent) / 100;
}

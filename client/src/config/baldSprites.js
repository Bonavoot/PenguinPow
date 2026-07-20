/**
 * Bald body variants for head-gear (toppers).
 *
 * When a player equips a topper, combat / portraits / hat composites use these
 * bodies (if present) so the baked-in top knot doesn't poke through. Overlay
 * lookup still keys off the original (haired) pose URL.
 *
 * Files live in assets/bald/ as `{stem}-bald.png`. Stems without a bald file
 * keep using the haired body.
 */

import { getEquippedHeadGearId } from "./cosmetics";

const baldModules = import.meta.glob("../assets/bald/*-bald.png", {
  eager: true,
  import: "default",
});

/** stem (e.g. "pumo-idle") → Vite URL for the bald PNG */
const BALD_BY_STEM = Object.create(null);

for (const [path, url] of Object.entries(baldModules)) {
  const file = path.split("/").pop() || "";
  const stem = file.replace(/-bald\.png$/i, "");
  if (stem) BALD_BY_STEM[stem] = url;
}

/** Every bald body URL (preload / recolor / bake warm). */
export const ALL_BALD_BODY_SRCS = Object.values(BALD_BY_STEM);

function spriteStem(src) {
  if (!src || typeof src !== "string") return null;
  const base = src.split(/[?#]/)[0].split("/").pop() || "";
  const noExt = base.replace(/\.[a-z0-9]+$/i, "");
  // Strip Vite content hash only (hex), NOT real stem words like
  // "-position" / "-thrust" / "-planting" (those are 6+ letters and used
  // to get eaten by a looser `[A-Za-z0-9_]{6,}` pattern — which is why only
  // short stems like "pumo-idle" resolved to bald in the Hat Tuner).
  return noExt
    .replace(/-[a-f0-9]{8,}$/i, "")
    .replace(/-bald$/i, "");
}

function lookupBald(stem) {
  if (!stem) return null;
  if (BALD_BY_STEM[stem]) return BALD_BY_STEM[stem];
  const lower = stem.toLowerCase();
  for (const [key, url] of Object.entries(BALD_BY_STEM)) {
    if (key.toLowerCase() === lower) return url;
  }
  return null;
}

/**
 * Bald body for a haired sprite URL, or a bare stem (e.g. "pumo-idle").
 * Returns null if no bald variant exists.
 */
export function getBaldBodySrc(srcOrStem) {
  if (!srcOrStem || typeof srcOrStem !== "string") return null;
  // Exact stem hit first (HatTuner passes stems directly).
  if (BALD_BY_STEM[srcOrStem]) return BALD_BY_STEM[srcOrStem];
  return lookupBald(spriteStem(srcOrStem));
}

/**
 * When head gear is equipped, prefer the bald body if we have one.
 * Otherwise return the original src unchanged.
 */
export function resolveBodyForHeadGear(src, gearIds) {
  if (!src || !getEquippedHeadGearId(gearIds)) return src;
  return getBaldBodySrc(src) || src;
}

/** True if this stem has a bald PNG in assets/bald/. */
export function hasBaldBody(stemOrSrc) {
  if (!stemOrSrc) return false;
  if (BALD_BY_STEM[stemOrSrc]) return true;
  return !!getBaldBodySrc(stemOrSrc);
}

/**
 * bakedSprites — runtime resolver for BUILD-TIME baked sprite PNGs.
 *
 * The bake script (scripts/bakeSprites.mjs) emits real PNG files under
 * /baked/ plus /baked/manifest.json mapping each (sprite, mawashi, body, tint)
 * to its file URL. This module loads that manifest once and resolves a STABLE
 * file URL synchronously.
 *
 * WHY THIS FIXES THE BASHO BUGS:
 *  - Bug A (opponent color stuck): the main fighter + the pumo clones both
 *    resolve through getBakedSprite() — a pure function of the CURRENT color —
 *    so there is no async cache, no local React state, and no per-bout blob to
 *    go stale in the no-remount flow. The resolved src is deterministic.
 *  - Bug B (progressive ghost frames): baked URLs are the SAME real file every
 *    bout (served from the browser's HTTP/image cache), so there are no
 *    minted-per-bout blob URLs to churn or LRU-revoke out from under a
 *    still-mounted <img>.
 *
 * FALLBACK: if a (color, body) isn't in the manifest (e.g. an arbitrary custom
 * hex), or the manifest hasn't loaded / wasn't generated, getBakedSprite()
 * returns null and callers fall back to the existing live recolor + cache path.
 * With no manifest present the behavior is exactly the pre-bake behavior.
 */

import { bakeKey, spriteIdFromUrl } from "../config/bakeSources";

// key -> "/baked/<hash>.png". Empty until the manifest loads (or forever, if no
// bake has been run — in which case every lookup misses and we fall back).
let MANIFEST = Object.create(null);
let manifestVersion = null;
let loaded = false;

/**
 * Resolves once the manifest fetch settles (success OR failure). Callers that
 * want baked URLs hot before they pin/pre-decode (e.g. preloadSprites) can
 * await this; everyone else can ignore it (lookups just miss until it loads).
 */
export const bakedReady = (async () => {
  if (typeof fetch === "undefined") {
    loaded = true;
    return;
  }
  try {
    const res = await fetch("/baked/manifest.json", { cache: "force-cache" });
    if (res && res.ok) {
      const json = await res.json();
      if (json && json.sprites) {
        MANIFEST = json.sprites;
        manifestVersion = json.version || null;
      }
    }
  } catch (_) {
    // No bake present (404) or fetch error → stay empty → pure fallback.
  } finally {
    loaded = true;
  }
})();

export function isBakedManifestLoaded() {
  return loaded;
}

export function getBakedManifestVersion() {
  return manifestVersion;
}

/** Map the boolean tint flags GameFighter uses to a manifest tint name. */
export function tintFromFlags({
  hitTintRed,
  chargeTintWhite,
  blubberTintPurple,
  armorTintPink,
} = {}) {
  if (hitTintRed) return "hit";
  if (chargeTintWhite) return "charge";
  if (blubberTintPurple) return "blubber";
  if (armorTintPink) return "armor";
  return "base";
}

/**
 * Resolve a baked file URL for a sprite, or null on miss.
 *
 * @param {string} sourceUrl - the sprite source URL GameFighter would recolor
 * @param {string} mawashiColor - target mawashi color hex / special keyword
 * @param {string|null} bodyColor - target body color hex, or null
 * @param {string} [tint="base"] - base|hit|charge|blubber|armor
 * @returns {string|null}
 */
export function getBakedSprite(sourceUrl, mawashiColor, bodyColor, tint = "base") {
  const id = spriteIdFromUrl(sourceUrl);
  if (!id) return null;
  const url = MANIFEST[bakeKey(id, mawashiColor, bodyColor, tint)];
  return url || null;
}

/**
 * Collect every baked URL that exists for a given (mawashi, body) across all
 * sprites + tints — used by preloadSprites to pre-decode + pin the stable files
 * for the current colors so the first pose transition paints warm.
 */
export function getBakedUrlsForColor(mawashiColor, bodyColor) {
  if (!loaded) return [];
  const wantM = (mawashiColor || "none").toLowerCase();
  const wantB = (bodyColor || "none").toLowerCase();
  const out = [];
  for (const key in MANIFEST) {
    // key = `${id}|${mawashi}|${body}|${tint}`
    const parts = key.split("|");
    if (parts.length !== 4) continue;
    if (parts[1] === wantM && parts[2] === wantB) out.push(MANIFEST[key]);
  }
  return out;
}

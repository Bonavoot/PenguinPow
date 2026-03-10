/**
 * Hi-Res Sprite Resolution
 *
 * Auto-discovers @2x sprite variants at build time via Vite's import.meta.glob.
 * When a @2x PNG exists alongside the original, resolveHiRes() returns
 * the higher-resolution URL instead.
 *
 * NAMING CONVENTION:
 *   Original:  pumo.png               →  @2x:  pumo@2x.png
 *   Original:  hit_spritesheet.png     →  @2x:  hit_spritesheet@2x.png
 *   Original:  ritual_part1_spritesheet.png → @2x: ritual_part1_spritesheet@2x.png
 *
 * Just drop @2x PNGs into the same folder as the originals and rebuild.
 * Everything upgrades automatically — recolorizer, rendering, the works.
 */

const hiResRaw = import.meta.glob(
  ['../assets/*@2x*.png', '../assets/spritesheets/*@2x*.png'],
  { eager: true, import: 'default' }
);

// Build lookup: base filename (without @2x) → hi-res Vite URL
// Sorted longest-first so "hit_spritesheet" matches before "hit"
const entries = Object.entries(hiResRaw)
  .map(([path, url]) => ({
    name: path.split('/').pop().replace(/@2x/g, '').replace(/\.png$/i, ''),
    url,
  }))
  .sort((a, b) => b.name.length - a.name.length);

/**
 * Given a Vite-resolved sprite URL, return the @2x URL if available.
 * Safe to call multiple times (idempotent).
 * Returns the original URL unchanged when no @2x variant exists.
 */
export function resolveHiRes(src) {
  if (!src || typeof src !== 'string' || entries.length === 0) return src;
  // Already a blob/data URL (recolored output) — nothing to resolve
  if (src.startsWith('blob:') || src.startsWith('data:')) return src;
  for (const { name, url } of entries) {
    if (src.includes(name + '-') || src.includes(name + '.')) return url;
  }
  return src;
}

export const hasHiResAssets = entries.length > 0;

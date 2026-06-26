/**
 * bakeSources — the PURE registry of recolorable sprite sources + the canonical
 * manifest-key helpers. Shared by:
 *   - scripts/bakeSprites.mjs   (reads `file` to find the PNG on disk)
 *   - utils/bakedSprites.js      (maps a runtime sprite URL -> `id`, then looks
 *                                 up the baked file in the manifest)
 *
 * No asset imports here (Node-safe). `file` is relative to client/src/assets.
 *
 * tints: the bake currently emits the BASE tint only (see BAKE_TINTS in
 * scripts/bakeSprites.mjs) — the brief hit/charge/blubber/armor flash overlays
 * stay on the runtime recolor path. TINTS below is the full vocabulary those
 * variants would use if ever re-enabled (and what tintFromFlags maps to).
 */

export const TINTS = ["base", "hit", "charge", "blubber", "armor"];
export const RITUAL_TINTS = ["base"];

/**
 * Every sprite source GameFighter actually recolors at render time
 * (`sourceToRecolor` in getSpriteRenderInfo): the animation spritesheets and
 * the static pose PNGs. `id` is the stable, hash/extension-independent key.
 */
export const BAKE_SOURCES = [
  // --- animation spritesheets ---
  { id: "pumo-waddle_spritesheet", file: "spritesheets/pumo-waddle_spritesheet.png" },
  { id: "pumo-army_spritesheet", file: "spritesheets/pumo-army_spritesheet.png" },
  { id: "hit_spritesheet", file: "spritesheets/hit_spritesheet.png" },
  { id: "bow_spritesheet", file: "spritesheets/bow_spritesheet.png" },
  { id: "blocking_spritesheet", file: "spritesheets/blocking_spritesheet.png" },
  { id: "grab-attempt_spritesheet", file: "spritesheets/grab-attempt_spritesheet.png" },
  { id: "is-being-grabbed_spritesheet", file: "spritesheets/is-being-grabbed_spritesheet.png" },
  { id: "snowball-throw_spritesheet", file: "spritesheets/snowball-throw_spritesheet.png" },
  { id: "at-the-ropes_spritesheet", file: "spritesheets/at-the-ropes_spritesheet.png" },
  { id: "crouch-strafing_spritesheet", file: "spritesheets/crouch-strafing_spritesheet.png" },
  { id: "is_perfect_parried_spritesheet", file: "spritesheets/is_perfect_parried_spritesheet.png" },
  { id: "salt_spritesheet", file: "spritesheets/salt_spritesheet.png" },

  // --- static pose sprites ---
  { id: "pumo-idle", file: "pumo-idle.png" },
  { id: "attack", file: "attack.png" },
  { id: "throwing", file: "throwing.png" },
  { id: "grabbing", file: "grabbing.png" },
  { id: "attempting-grab-throw", file: "attempting-grab-throw.png" },
  { id: "is-attempting-pull", file: "is-attempting-pull.png" },
  { id: "pumo-ready-position", file: "pumo-ready-position.png" },
  { id: "pumo-tachiai-position", file: "pumo-tachiai-position.png" },
  { id: "dodging", file: "dodging.png" },
  { id: "crouch-stance", file: "crouch-stance.png" },
  { id: "recovering", file: "recovering.png" },
  { id: "raw-parry-success", file: "raw-parry-success.png" },
  { id: "slapAttack1", file: "slapAttack1.png" },
  { id: "slapAttack2", file: "slapAttack2.png" },
  { id: "pumo-belly-laying", file: "pumo-belly-laying.png" },
  { id: "pumo-belly-laying-eyes-open", file: "pumo-belly-laying-eyes-open.png" },
  { id: "pumo-flap-1", file: "pumo-flap-1.png" },
  { id: "pumo-flap-2", file: "pumo-flap-2.png" },

  // --- ritual spritesheets (base only) ---
  { id: "ritual_part1_spritesheet", file: "ritual_part1_spritesheet.png", ritual: true },
  { id: "ritual_part2_spritesheet", file: "ritual_part2_spritesheet.png", ritual: true },
  { id: "ritual_part3_spritesheet", file: "ritual_part3_spritesheet.png", ritual: true },
  { id: "ritual_part4_spritesheet", file: "ritual_part4_spritesheet.png", ritual: true },
];

// Sprite ids longest-first so a longer id (e.g. "pumo-belly-laying-eyes-open")
// matches before a shorter prefix ("pumo-belly-laying").
const SORTED_IDS = BAKE_SOURCES.map((s) => s.id).sort(
  (a, b) => b.length - a.length
);

/**
 * Normalize a color value for keying: special-mode keywords pass through; hex
 * is lowercased; nullish body becomes "none".
 */
export function normColor(color) {
  if (!color) return "none";
  return String(color).toLowerCase();
}

/** Canonical manifest key for a (sprite, mawashi, body, tint) tuple. */
export function bakeKey(spriteId, mawashiColor, bodyColor, tint) {
  return `${spriteId}|${normColor(mawashiColor)}|${normColor(bodyColor)}|${
    tint || "base"
  }`;
}

/**
 * Derive a sprite `id` from a runtime sprite URL. Handles Vite dev URLs
 * (".../pumo-idle.png"), production hashed URLs (".../pumo-idle-a1b2c3d4.png"),
 * and @2x variants. Returns null if the URL isn't a known bakeable sprite.
 */
export function spriteIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("blob:") || url.startsWith("data:")) return null;
  // basename without query/hash fragment
  let base = url.split(/[?#]/)[0];
  base = base.substring(base.lastIndexOf("/") + 1);
  base = base.replace(/@2x/g, "").replace(/\.png$/i, "");
  for (const id of SORTED_IDS) {
    if (base === id || base.startsWith(id + "-")) return id;
  }
  return null;
}

/**
 * colorPresets — PURE color data (no asset imports), so it can be imported by
 * BOTH the browser bundle (via spriteConfig.js, which re-exports these) AND the
 * Node build-time bake script (scripts/bakeSprites.mjs). Keeping the canonical
 * palette here means the bake and the runtime can never drift on which colors
 * exist.
 */

/** The base color of the sprite assets (sprites ship blue). */
export const SPRITE_BASE_COLOR = "#4169E1";

/**
 * Color preset options for the mawashi/headband.
 * Solids are high-chroma accent identities (not muted anti-body offsets).
 */
export const COLOR_PRESETS = {
  // Floor ~L31 so black outline linework still reads on the mawashi.
  ink: { hex: "#4F4F4F", name: "Ink" },
  ivory: { hex: "#F0E4C4", name: "Ivory" },
  // Solids stay vivid, but sat is capped ~78–82 so fills don't go neon-flat
  // and crush black linework / belt shading.
  crimson: { hex: "#DA1B44", name: "Crimson" },
  amber: { hex: "#E98520", name: "Amber" },
  gold: { hex: "#E6BD37", name: "Gold" },
  jade: { hex: "#15AC7D", name: "Jade" },
  magenta: { hex: "#E52E8A", name: "Magenta" },
  violet: { hex: "#A22EE5", name: "Violet" },
  cyan: { hex: "#1BBADA", name: "Cyan" },
  wine: { hex: "#9E1A3F", name: "Wine" },

  // Special (mawashi-only patterns). Key is shinyGold so it doesn't collide
  // with the solid Gold hex above; value "gold" is the recolorer special mode.
  rainbow: { hex: "rainbow", name: "Rainbow" },
  fire: { hex: "fire", name: "Fire" },
  vaporwave: { hex: "vaporwave", name: "Vaporwave" },
  camo: { hex: "camo", name: "Camo" },
  galaxy: { hex: "galaxy", name: "Galaxy" },
  shinyGold: { hex: "gold", name: "Shiny Gold" },
};

/**
 * Body color presets — bold classic colors for the penguin body.
 * null = keep original grey (no body recoloring).
 */
export const BODY_COLOR_PRESETS = {
  default: { hex: null, name: "Default" },
  // Floor ~L29 — darker than default grey, light enough that black
  // arm/body linework doesn't disappear into the fill.
  black: { hex: "#4A4A4A", name: "Black" },
  blue: { hex: "#2656A8", name: "Blue" },
  purple: { hex: "#9932CC", name: "Purple" },
  green: { hex: "#32CD32", name: "Green" },
  aqua: { hex: "#17A8A0", name: "Aqua" },
  orange: { hex: "#E27020", name: "Orange" },
  pink: { hex: "#FFB6C1", name: "Pink" },
  yellow: { hex: "#F5C422", name: "Yellow" },
  brown: { hex: "#8B5E3C", name: "Brown" },
  silver: { hex: "#A8A8A8", name: "Silver" },
  white: { hex: "#F2F2F2", name: "White" },
  // Warm sand accent (kept as its own look, not a white substitute).
  cream: { hex: "#C6B495", name: "Cream" },
  lightBlue: { hex: "#6ABED0", name: "Light Blue" },
  red: { hex: "#CC3333", name: "Red" },
};

/** Default colors for each player. */
export const DEFAULT_COLORS = {
  player1: SPRITE_BASE_COLOR,
  player2: COLOR_PRESETS.crimson.hex,
};

export const DEFAULT_BODY_COLORS = {
  player1: null,
  player2: null,
};

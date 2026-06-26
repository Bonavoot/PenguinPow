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
 */
export const COLOR_PRESETS = {
  graphite: { hex: "#525252", name: "Graphite" },
  cobalt: { hex: "#3B5EB0", name: "Cobalt" },
  orchid: { hex: "#A85DBF", name: "Orchid" },
  emerald: { hex: "#2E9E5A", name: "Emerald" },
  teal: { hex: "#1A7A8A", name: "Teal" },
  tangerine: { hex: "#E8913A", name: "Tangerine" },
  coral: { hex: "#E87070", name: "Coral" },
  gold: { hex: "#D4A520", name: "Gold" },
  caramel: { hex: "#A07348", name: "Caramel" },
  pewter: { hex: "#6E8495", name: "Pewter" },
  powder: { hex: "#88C4D8", name: "Powder" },
  scarlet: { hex: "#D94848", name: "Scarlet" },

  // Special (mawashi-only patterns)
  rainbow: { hex: "rainbow", name: "Rainbow" },
  fire: { hex: "fire", name: "Fire" },
  vaporwave: { hex: "vaporwave", name: "Vaporwave" },
  camo: { hex: "camo", name: "Camo" },
  galaxy: { hex: "galaxy", name: "Galaxy" },
};

/**
 * Body color presets — bold classic colors for the penguin body.
 * null = keep original grey (no body recoloring).
 */
export const BODY_COLOR_PRESETS = {
  default: { hex: null, name: "Default" },
  black: { hex: "#4d4d4d", name: "Black" },
  blue: { hex: "#2656A8", name: "Blue" },
  purple: { hex: "#9932CC", name: "Purple" },
  green: { hex: "#32CD32", name: "Green" },
  aqua: { hex: "#17A8A0", name: "Aqua" },
  orange: { hex: "#E27020", name: "Orange" },
  pink: { hex: "#FFB6C1", name: "Pink" },
  yellow: { hex: "#F5C422", name: "Yellow" },
  brown: { hex: "#8B5E3C", name: "Brown" },
  silver: { hex: "#A8A8A8", name: "Silver" },
  lightBlue: { hex: "#6ABED0", name: "Light Blue" },
  red: { hex: "#CC3333", name: "Red" },
};

/** Default colors for each player. */
export const DEFAULT_COLORS = {
  player1: SPRITE_BASE_COLOR,
  player2: COLOR_PRESETS.scarlet.hex,
};

export const DEFAULT_BODY_COLORS = {
  player1: null,
  player2: null,
};

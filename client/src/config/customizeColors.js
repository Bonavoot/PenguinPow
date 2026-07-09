/**
 * customizeColors.js — Shared belt/body customization swatches.
 *
 * Single source of truth for the wardrobe color options so the full
 * CustomizePage and the compact BASHO-hub popover render the exact same
 * catalog. `hex` is what gets written to PlayerColorContext
 * (player1Color / player1BodyColor). Patterns carry a `gradient` used
 * purely for the swatch preview.
 */

import { SPRITE_BASE_COLOR } from "../utils/SpriteRecolorizer";

export const BELT_SOLIDS = [
  { name: "Default", hex: SPRITE_BASE_COLOR },
  { name: "Graphite", hex: "#525252" },
  { name: "Scarlet", hex: "#D94848" },
  { name: "Coral", hex: "#E87070" },
  { name: "Tangerine", hex: "#E8913A" },
  { name: "Gold", hex: "#D4A520" },
  { name: "Emerald", hex: "#2E9E5A" },
  { name: "Cobalt", hex: "#3B5EB0" },
  { name: "Orchid", hex: "#A85DBF" },
];

export const BELT_PATTERNS = [
  {
    name: "Rainbow",
    hex: "rainbow",
    gradient:
      "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
  },
  {
    name: "Fire",
    hex: "fire",
    gradient: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
  },
  {
    name: "Vaporwave",
    hex: "vaporwave",
    gradient: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
  },
  {
    name: "Camo",
    hex: "camo",
    gradient:
      "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
  },
  {
    name: "Galaxy",
    hex: "galaxy",
    gradient:
      "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
  },
  {
    name: "Shiny Gold",
    hex: "gold",
    gradient:
      "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
  },
];

export const BODY_COLORS = [
  {
    name: "Default",
    hex: null,
    gradient: "linear-gradient(135deg, #888 0%, #aaa 50%, #888 100%)",
  },
  { name: "Black", hex: "#4d4d4d" },
  { name: "Blue", hex: "#2656A8" },
  { name: "Purple", hex: "#9932CC" },
  { name: "Green", hex: "#32CD32" },
  { name: "Aqua", hex: "#17A8A0" },
  { name: "Orange", hex: "#E27020" },
  { name: "Pink", hex: "#FFB6C1" },
  { name: "Yellow", hex: "#F5C422" },
  { name: "Brown", hex: "#8B5E3C" },
  { name: "Silver", hex: "#A8A8A8" },
  { name: "Light Blue", hex: "#6ABED0" },
  { name: "Red", hex: "#CC3333" },
];

/** Combined belt list (solids + patterns) for lookups by hex. */
export const BELT_ALL = [...BELT_SOLIDS, ...BELT_PATTERNS];

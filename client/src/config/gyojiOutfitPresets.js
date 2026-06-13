/**
 * Curated gyoji hitatare palettes — robe + floral pattern pairs inspired by
 * real sumo referee vestments (green/gold classic, purple, navy, crimson, etc.).
 * Picked randomly per match so the background referee stays varied but never garish.
 */

export const GYOJI_OUTFIT_PRESETS = [
  {
    id: "classic",
    name: "Classic",
    robe: "#328F52",
    pattern: "#D4B84A",
  },
  {
    id: "imperial",
    name: "Imperial Purple",
    robe: "#4E3868",
    pattern: "#C9A050",
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    robe: "#2F5478",
    pattern: "#D4B050",
  },
  {
    id: "crimson",
    name: "Crimson",
    robe: "#6E3040",
    pattern: "#DDB860",
  },
  {
    id: "ink",
    name: "Ink & Gold",
    robe: "#3A4048",
    pattern: "#B89048",
  },
  {
    id: "pine",
    name: "Pine Teal",
    robe: "#245650",
    pattern: "#D9B85C",
  },
  {
    id: "wisteria",
    name: "Wisteria",
    robe: "#5A4872",
    pattern: "#CDB872",
  },
  {
    id: "twilight",
    name: "Twilight Indigo",
    robe: "#3D4570",
    pattern: "#D4AA50",
  },
];

/** Base asset colors — skip recolor when the picked preset matches the source art. */
export const GYOJI_BASE_ROBE = "#328F52";
export const GYOJI_BASE_PATTERN = "#D4B84A";

export function pickRandomGyojiOutfit() {
  const idx = Math.floor(Math.random() * GYOJI_OUTFIT_PRESETS.length);
  return GYOJI_OUTFIT_PRESETS[idx];
}

export function outfitNeedsRecolor(outfit) {
  return (
    outfit.robe.toLowerCase() !== GYOJI_BASE_ROBE.toLowerCase() ||
    outfit.pattern.toLowerCase() !== GYOJI_BASE_PATTERN.toLowerCase()
  );
}

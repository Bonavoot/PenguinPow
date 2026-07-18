/**
 * outfits.js — Cosmetics loadout helpers.
 *
 * Outfit slots live in saveStore.customization. Hair / gear IDs are reserved
 * now so the schema doesn't need another redesign when those unlock.
 *
 * Cosmetics intentionally apply to VS CPU / Custom Match / BASHO previews —
 * they are not career progression state.
 */

import { SPRITE_BASE_COLOR } from "../config/colorPresets";

export const OUTFIT_SLOT_COUNT = 3;
export const DEFAULT_OUTFIT_ID = "outfit_1";

export function makeOutfit(id, name, overrides = {}) {
  return {
    id,
    name,
    mawashiColor: overrides.mawashiColor ?? SPRITE_BASE_COLOR,
    bodyColor:
      overrides.bodyColor === undefined ? null : overrides.bodyColor,
    hairId: overrides.hairId ?? null,
    gearIds: Array.isArray(overrides.gearIds) ? [...overrides.gearIds] : [],
  };
}

/** Three distinct starter looks so lobby slots are visually separable. */
export function makeDefaultOutfits() {
  return [
    makeOutfit("outfit_1", "Outfit 1"),
    makeOutfit("outfit_2", "Outfit 2", { mawashiColor: "#D94848" }),
    makeOutfit("outfit_3", "Outfit 3", { mawashiColor: "#2E9E5A" }),
  ];
}

export function makeDefaultCustomization() {
  return {
    activeOutfitId: DEFAULT_OUTFIT_ID,
    outfits: makeDefaultOutfits(),
  };
}

function normalizeOutfit(raw, fallback, index) {
  const base =
    fallback || makeOutfit(`outfit_${index + 1}`, `Outfit ${index + 1}`);
  if (!raw || typeof raw !== "object") return { ...base };

  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : base.name;

  return makeOutfit(
    typeof raw.id === "string" ? raw.id : base.id,
    name,
    {
      mawashiColor:
        typeof raw.mawashiColor === "string" && raw.mawashiColor
          ? raw.mawashiColor
          : base.mawashiColor,
      bodyColor: raw.bodyColor === undefined ? base.bodyColor : raw.bodyColor,
      hairId: raw.hairId ?? base.hairId,
      gearIds: raw.gearIds,
    },
  );
}

/**
 * Normalize any customization blob (legacy single colors, partial outfits,
 * or full v2) into { activeOutfitId, outfits[3] }.
 */
export function normalizeCustomization(raw) {
  const defaults = makeDefaultCustomization();

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  // Legacy v1: { mawashiColor, bodyColor }
  if (!Array.isArray(raw.outfits)) {
    const outfits = makeDefaultOutfits();
    outfits[0] = makeOutfit("outfit_1", "Outfit 1", {
      mawashiColor: raw.mawashiColor || SPRITE_BASE_COLOR,
      bodyColor: raw.bodyColor ?? null,
    });
    return {
      activeOutfitId: DEFAULT_OUTFIT_ID,
      outfits,
    };
  }

  const outfits = defaults.outfits.map((fallback, i) =>
    normalizeOutfit(raw.outfits[i], fallback, i),
  );

  const activeOutfitId =
    typeof raw.activeOutfitId === "string" &&
    outfits.some((o) => o.id === raw.activeOutfitId)
      ? raw.activeOutfitId
      : outfits[0].id;

  return { activeOutfitId, outfits };
}

export function getOutfitById(customization, outfitId) {
  const c = normalizeCustomization(customization);
  return c.outfits.find((o) => o.id === outfitId) || c.outfits[0];
}

export function getActiveOutfit(customization) {
  const c = normalizeCustomization(customization);
  return getOutfitById(c, c.activeOutfitId);
}

export function withOutfitPatch(customization, outfitId, patch = {}) {
  const c = normalizeCustomization(customization);
  return {
    ...c,
    outfits: c.outfits.map((o) => {
      if (o.id !== outfitId) return o;
      const nextName =
        typeof patch.name === "string" && patch.name.trim()
          ? patch.name.trim()
          : o.name;
      return makeOutfit(o.id, nextName, {
        mawashiColor: o.mawashiColor,
        bodyColor: o.bodyColor,
        hairId: o.hairId,
        gearIds: o.gearIds,
        ...patch,
      });
    }),
  };
}

export function withActiveOutfitId(customization, outfitId) {
  const c = normalizeCustomization(customization);
  if (!c.outfits.some((o) => o.id === outfitId)) return c;
  return { ...c, activeOutfitId: outfitId };
}

export function applyOutfitToPlayer1Setters(outfit, setters) {
  if (!outfit || !setters) return;
  if (typeof setters.setPlayer1Color === "function") {
    setters.setPlayer1Color(outfit.mawashiColor || SPRITE_BASE_COLOR);
  }
  if (typeof setters.setPlayer1BodyColor === "function") {
    setters.setPlayer1BodyColor(outfit.bodyColor ?? null);
  }
}

/** True when this outfit's belt (or non-null body) matches the opponent's. */
export function outfitClashesWith(outfit, otherMawashi, otherBody) {
  if (!outfit) return false;
  const mawashi = (outfit.mawashiColor || "").toString().toLowerCase();
  const otherM = (otherMawashi || "").toString().toLowerCase();
  if (mawashi && otherM && mawashi === otherM) return true;

  if (
    outfit.bodyColor != null &&
    otherBody != null &&
    outfit.bodyColor.toString().toLowerCase() ===
      otherBody.toString().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function firstNonClashingOutfit(customization, otherMawashi, otherBody) {
  const c = normalizeCustomization(customization);
  const preferred = getOutfitById(c, c.activeOutfitId);
  if (!outfitClashesWith(preferred, otherMawashi, otherBody)) {
    return preferred;
  }
  return (
    c.outfits.find((o) => !outfitClashesWith(o, otherMawashi, otherBody)) ||
    preferred
  );
}

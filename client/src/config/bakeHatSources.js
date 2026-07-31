/**
 * bakeHatSources — Node-safe registry for build-time flattened body+topper bakes.
 *
 * Keys are stable (gear + body sprite id + colors + tint). Runtime resolves via
 * utils/bakedSprites.js getBakedHattedSprite(). No Vite asset imports here.
 *
 * Overlay files: client/src/assets/cosmetics/overlays/{prefix}-{stem}.png
 * Body files: bald/{stem}-bald.png when present, else {stem}.png / specials.
 */

import { normColor } from "./bakeSources.js";

export const HAT_GEAR_IDS = [
  "top_hat",
  "crown",
  "halo",
  "plunger",
  "ponytail",
];

/** Overlay filename prefix per gear id. */
export const HAT_GEAR_PREFIX = {
  top_hat: "hat",
  crown: "crown",
  halo: "halo",
  plunger: "plunger",
  ponytail: "ponytail",
};

/** Draw gear under the body (head occludes). */
export const HAT_UNDER_BODY = {
  top_hat: false,
  crown: false,
  halo: false,
  plunger: false,
  ponytail: true,
};

/**
 * Overlay contains mawashi-blue to retint (ponytail hair tie). Kept false until
 * catalog sets recolorWithMawashi — matches current runtime headGearRecolorsWithMawashi.
 */
export const HAT_RECOLOR_OVERLAY = {
  top_hat: false,
  crown: false,
  halo: false,
  plunger: false,
  ponytail: false,
};

/**
 * Combat / portrait poses that have topper overlays.
 * bodySpriteId: bakeSources id used for recolor + runtime spriteIdFromUrl
 *   (bald id when a bald underlay exists).
 * bodyFile: path relative to client/src/assets for the bake compositor.
 * hairedStem: stem used in overlay filenames and cosmetics tables.
 */
export const HAT_POSE_SOURCES = [
  {
    hairedStem: "pumo-idle",
    bodySpriteId: "pumo-idle-bald",
    bodyFile: "bald/pumo-idle-bald.png",
  },
  {
    hairedStem: "main-menu-pumo",
    bodySpriteId: "main-menu-pumo-bald",
    bodyFile: "bald/main-menu-pumo-bald.png",
    menuOnly: true,
  },
  {
    hairedStem: "pumo-tachiai-position",
    bodySpriteId: "pumo-tachiai-position-bald",
    bodyFile: "bald/pumo-tachiai-position-bald.png",
  },
  {
    hairedStem: "pumo-ready-position",
    bodySpriteId: "pumo-ready-position-bald",
    bodyFile: "bald/pumo-ready-position-bald.png",
  },
  {
    hairedStem: "grabbing",
    bodySpriteId: "grabbing-bald",
    bodyFile: "bald/grabbing-bald.png",
  },
  {
    hairedStem: "clinch-planting",
    bodySpriteId: "clinch-planting-bald",
    bodyFile: "bald/clinch-planting-bald.png",
  },
  // No bald underlay — composite onto haired body (matches runtime fallback).
  {
    hairedStem: "attempting-grab-throw",
    bodySpriteId: "attempting-grab-throw",
    bodyFile: "attempting-grab-throw.png",
  },
  {
    hairedStem: "is-attempting-pull",
    bodySpriteId: "is-attempting-pull",
    bodyFile: "is-attempting-pull.png",
  },
  {
    hairedStem: "slapAttack1",
    bodySpriteId: "slapAttack1",
    bodyFile: "slapAttack1.png",
  },
  {
    hairedStem: "slapAttack2",
    bodySpriteId: "slapAttack2",
    bodyFile: "slapAttack2.png",
  },
  {
    hairedStem: "slap-attack-1-blur-frame",
    bodySpriteId: "slap-attack-1-blur-frame-bald",
    bodyFile: "bald/slap-attack-1-blur-frame-bald.png",
  },
  {
    hairedStem: "slap-attack-1-hit-frame",
    bodySpriteId: "slap-attack-1-hit-frame-bald",
    bodyFile: "bald/slap-attack-1-hit-frame-bald.png",
  },
  {
    hairedStem: "slap-attack-2-blur-frame",
    bodySpriteId: "slap-attack-2-blur-frame-bald",
    bodyFile: "bald/slap-attack-2-blur-frame-bald.png",
  },
  {
    hairedStem: "slap-attack-2-hit-frame",
    bodySpriteId: "slap-attack-2-hit-frame-bald",
    bodyFile: "bald/slap-attack-2-hit-frame-bald.png",
  },
  {
    hairedStem: "palm-thrust",
    bodySpriteId: "palm-thrust-bald",
    bodyFile: "bald/palm-thrust-bald.png",
  },
  {
    hairedStem: "palm-thrust-startup",
    bodySpriteId: "palm-thrust-startup-bald",
    bodyFile: "bald/palm-thrust-startup-bald.png",
  },
  {
    hairedStem: "palm-thrust-smear",
    bodySpriteId: "palm-thrust-smear-bald",
    bodyFile: "bald/palm-thrust-smear-bald.png",
  },
  {
    hairedStem: "blocking",
    bodySpriteId: "blocking-bald",
    bodyFile: "bald/blocking-bald.png",
  },
  {
    hairedStem: "block-parry",
    bodySpriteId: "block-parry-bald",
    bodyFile: "bald/block-parry-bald.png",
  },
  {
    hairedStem: "raw-parry-success-frame-1",
    bodySpriteId: "raw-parry-success-frame-1-bald",
    bodyFile: "bald/raw-parry-success-frame-1-bald.png",
  },
  {
    hairedStem: "raw-parry-success-frame-2",
    bodySpriteId: "raw-parry-success-frame-2-bald",
    bodyFile: "bald/raw-parry-success-frame-2-bald.png",
  },
  {
    hairedStem: "raw-parry-success-frame-3",
    bodySpriteId: "raw-parry-success-frame-3-bald",
    bodyFile: "bald/raw-parry-success-frame-3-bald.png",
  },
  {
    hairedStem: "pumo-flap-1",
    bodySpriteId: "pumo-flap-1-bald",
    bodyFile: "bald/pumo-flap-1-bald.png",
  },
  {
    hairedStem: "pumo-flap-2",
    bodySpriteId: "pumo-flap-2-bald",
    bodyFile: "bald/pumo-flap-2-bald.png",
  },
  {
    hairedStem: "recovering",
    bodySpriteId: "recovering-bald",
    bodyFile: "bald/recovering-bald.png",
  },
  {
    hairedStem: "charging",
    bodySpriteId: "charging-bald",
    bodyFile: "bald/charging-bald.png",
  },
  {
    hairedStem: "attack",
    bodySpriteId: "attack-bald",
    bodyFile: "bald/attack-bald.png",
  },
  {
    hairedStem: "dodging",
    bodySpriteId: "dodging-bald",
    bodyFile: "bald/dodging-bald.png",
  },
  {
    hairedStem: "sliding",
    bodySpriteId: "sliding-bald",
    bodyFile: "bald/sliding-bald.png",
  },
];

/** Canonical manifest key for a flattened topper composite. */
export function hatBakeKey(gearId, bodySpriteId, mawashiColor, bodyColor, tint) {
  return `hat|${gearId}|${bodySpriteId}|${normColor(mawashiColor)}|${normColor(
    bodyColor,
  )}|${tint || "base"}`;
}

export function overlayFileFor(gearId, hairedStem) {
  const prefix = HAT_GEAR_PREFIX[gearId];
  if (!prefix || !hairedStem) return null;
  return `cosmetics/overlays/${prefix}-${hairedStem}.png`;
}

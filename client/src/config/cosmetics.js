/**
 * Cosmetics catalog + head-gear overlay lookup for newer pose art.
 *
 * Gear is stored on outfits as gearIds: string[] (e.g. ["top_hat"], ["crown"]).
 * Overlays are pre-baked 1:1 transparent PNGs matched to each supported body
 * sprite. Attach points live per gear in hat-tweaks.json (gears.*.poses).
 * Old poses (waddle, ritual, salt, throw, being-grabbed) are omitted on purpose.
 */

import topHatIcon from "../assets/cosmetics/top-hat.png";
import crownIcon from "../assets/cosmetics/crown.png";

import pumoIdle from "../assets/pumo-idle.png";
import pumoTachiai from "../assets/pumo-tachiai-position.png";
import pumoReady from "../assets/pumo-ready-position.png";
import grabbing from "../assets/grabbing.png";
import clinchPlanting from "../assets/clinch-planting.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import attemptingPull from "../assets/is-attempting-pull.png";
import slapAttack1 from "../assets/slapAttack1.png";
import slapAttack2 from "../assets/slapAttack2.png";
import slapAttack1Blur from "../assets/slap-attack-1-blur-frame.png";
import slapAttack1Hit from "../assets/slap-attack-1-hit-frame.png";
import slapAttack2Blur from "../assets/slap-attack-2-blur-frame.png";
import slapAttack2Hit from "../assets/slap-attack-2-hit-frame.png";
import palmThrust from "../assets/palm-thrust.png";
import palmThrustStartup from "../assets/palm-thrust-startup.png";
import palmThrustSmear from "../assets/palm-thrust-smear.png";
import blocking from "../assets/blocking.png";
import blockParry from "../assets/block-parry.png";
import rawParrySuccess from "../assets/raw-parry-success.png";
import flap1 from "../assets/pumo-flap-1.png";
import flap2 from "../assets/pumo-flap-2.png";
import recovering from "../assets/recovering.png";
import attack from "../assets/attack.png";
import dodging from "../assets/dodging.png";

import hatPumoIdle from "../assets/cosmetics/overlays/hat-pumo-idle.png";
import hatPumoTachiai from "../assets/cosmetics/overlays/hat-pumo-tachiai-position.png";
import hatPumoReady from "../assets/cosmetics/overlays/hat-pumo-ready-position.png";
import hatGrabbing from "../assets/cosmetics/overlays/hat-grabbing.png";
import hatClinchPlanting from "../assets/cosmetics/overlays/hat-clinch-planting.png";
import hatAttemptingGrabThrow from "../assets/cosmetics/overlays/hat-attempting-grab-throw.png";
import hatAttemptingPull from "../assets/cosmetics/overlays/hat-is-attempting-pull.png";
import hatSlapAttack1 from "../assets/cosmetics/overlays/hat-slapAttack1.png";
import hatSlapAttack2 from "../assets/cosmetics/overlays/hat-slapAttack2.png";
import hatSlap1Blur from "../assets/cosmetics/overlays/hat-slap-attack-1-blur-frame.png";
import hatSlap1Hit from "../assets/cosmetics/overlays/hat-slap-attack-1-hit-frame.png";
import hatSlap2Blur from "../assets/cosmetics/overlays/hat-slap-attack-2-blur-frame.png";
import hatSlap2Hit from "../assets/cosmetics/overlays/hat-slap-attack-2-hit-frame.png";
import hatPalmThrust from "../assets/cosmetics/overlays/hat-palm-thrust.png";
import hatPalmStartup from "../assets/cosmetics/overlays/hat-palm-thrust-startup.png";
import hatPalmSmear from "../assets/cosmetics/overlays/hat-palm-thrust-smear.png";
import hatBlocking from "../assets/cosmetics/overlays/hat-blocking.png";
import hatBlockParry from "../assets/cosmetics/overlays/hat-block-parry.png";
import hatRawParrySuccess from "../assets/cosmetics/overlays/hat-raw-parry-success.png";
import hatFlap1 from "../assets/cosmetics/overlays/hat-pumo-flap-1.png";
import hatFlap2 from "../assets/cosmetics/overlays/hat-pumo-flap-2.png";
import hatRecovering from "../assets/cosmetics/overlays/hat-recovering.png";
import hatAttack from "../assets/cosmetics/overlays/hat-attack.png";
import hatDodging from "../assets/cosmetics/overlays/hat-dodging.png";

import crownPumoIdle from "../assets/cosmetics/overlays/crown-pumo-idle.png";
import crownPumoTachiai from "../assets/cosmetics/overlays/crown-pumo-tachiai-position.png";
import crownPumoReady from "../assets/cosmetics/overlays/crown-pumo-ready-position.png";
import crownGrabbing from "../assets/cosmetics/overlays/crown-grabbing.png";
import crownClinchPlanting from "../assets/cosmetics/overlays/crown-clinch-planting.png";
import crownAttemptingGrabThrow from "../assets/cosmetics/overlays/crown-attempting-grab-throw.png";
import crownAttemptingPull from "../assets/cosmetics/overlays/crown-is-attempting-pull.png";
import crownSlapAttack1 from "../assets/cosmetics/overlays/crown-slapAttack1.png";
import crownSlapAttack2 from "../assets/cosmetics/overlays/crown-slapAttack2.png";
import crownSlap1Blur from "../assets/cosmetics/overlays/crown-slap-attack-1-blur-frame.png";
import crownSlap1Hit from "../assets/cosmetics/overlays/crown-slap-attack-1-hit-frame.png";
import crownSlap2Blur from "../assets/cosmetics/overlays/crown-slap-attack-2-blur-frame.png";
import crownSlap2Hit from "../assets/cosmetics/overlays/crown-slap-attack-2-hit-frame.png";
import crownPalmThrust from "../assets/cosmetics/overlays/crown-palm-thrust.png";
import crownPalmStartup from "../assets/cosmetics/overlays/crown-palm-thrust-startup.png";
import crownPalmSmear from "../assets/cosmetics/overlays/crown-palm-thrust-smear.png";
import crownBlocking from "../assets/cosmetics/overlays/crown-blocking.png";
import crownBlockParry from "../assets/cosmetics/overlays/crown-block-parry.png";
import crownRawParrySuccess from "../assets/cosmetics/overlays/crown-raw-parry-success.png";
import crownFlap1 from "../assets/cosmetics/overlays/crown-pumo-flap-1.png";
import crownFlap2 from "../assets/cosmetics/overlays/crown-pumo-flap-2.png";
import crownRecovering from "../assets/cosmetics/overlays/crown-recovering.png";
import crownAttack from "../assets/cosmetics/overlays/crown-attack.png";
import crownDodging from "../assets/cosmetics/overlays/crown-dodging.png";

export const GEAR_TOP_HAT = "top_hat";
export const GEAR_CROWN = "crown";

/**
 * Head / Topper catalog — hats, hair, and anything that sits on the
 * noggin. One exclusive slot in the wardrobe (stored as gearIds).
 */
export const GEAR_CATALOG = [
  {
    id: GEAR_TOP_HAT,
    name: "Top Hat",
    slot: "head",
    icon: topHatIcon,
    description: "Dapper stovepipe. The dohyo meets Bond Street.",
  },
  {
    id: GEAR_CROWN,
    name: "Crown",
    slot: "head",
    icon: crownIcon,
    description: "Red, gold, ermine. Yokozuna energy, zero subtlety.",
  },
];

/** UI alias — same catalog, clearer wardrobe naming. */
export const HEAD_CATALOG = GEAR_CATALOG;

const HEAD_GEAR_IDS = GEAR_CATALOG.filter((g) => g.slot === "head").map(
  (g) => g.id,
);

const BODY_SRCS = [
  pumoIdle,
  pumoTachiai,
  pumoReady,
  grabbing,
  clinchPlanting,
  attemptingGrabThrow,
  attemptingPull,
  slapAttack1,
  slapAttack2,
  slapAttack1Blur,
  slapAttack1Hit,
  slapAttack2Blur,
  slapAttack2Hit,
  palmThrust,
  palmThrustStartup,
  palmThrustSmear,
  blocking,
  blockParry,
  rawParrySuccess,
  flap1,
  flap2,
  recovering,
  attack,
  dodging,
];

const TOP_HAT_BY_STEM = {
  "pumo-idle": hatPumoIdle,
  "pumo-tachiai-position": hatPumoTachiai,
  "pumo-ready-position": hatPumoReady,
  grabbing: hatGrabbing,
  "clinch-planting": hatClinchPlanting,
  "attempting-grab-throw": hatAttemptingGrabThrow,
  "is-attempting-pull": hatAttemptingPull,
  slapAttack1: hatSlapAttack1,
  slapAttack2: hatSlapAttack2,
  "slap-attack-1-blur-frame": hatSlap1Blur,
  "slap-attack-1-hit-frame": hatSlap1Hit,
  "slap-attack-2-blur-frame": hatSlap2Blur,
  "slap-attack-2-hit-frame": hatSlap2Hit,
  "palm-thrust": hatPalmThrust,
  "palm-thrust-startup": hatPalmStartup,
  "palm-thrust-smear": hatPalmSmear,
  blocking: hatBlocking,
  "block-parry": hatBlockParry,
  "raw-parry-success": hatRawParrySuccess,
  "pumo-flap-1": hatFlap1,
  "pumo-flap-2": hatFlap2,
  recovering: hatRecovering,
  attack: hatAttack,
  dodging: hatDodging,
};

const CROWN_BY_STEM = {
  "pumo-idle": crownPumoIdle,
  "pumo-tachiai-position": crownPumoTachiai,
  "pumo-ready-position": crownPumoReady,
  grabbing: crownGrabbing,
  "clinch-planting": crownClinchPlanting,
  "attempting-grab-throw": crownAttemptingGrabThrow,
  "is-attempting-pull": crownAttemptingPull,
  slapAttack1: crownSlapAttack1,
  slapAttack2: crownSlapAttack2,
  "slap-attack-1-blur-frame": crownSlap1Blur,
  "slap-attack-1-hit-frame": crownSlap1Hit,
  "slap-attack-2-blur-frame": crownSlap2Blur,
  "slap-attack-2-hit-frame": crownSlap2Hit,
  "palm-thrust": crownPalmThrust,
  "palm-thrust-startup": crownPalmStartup,
  "palm-thrust-smear": crownPalmSmear,
  blocking: crownBlocking,
  "block-parry": crownBlockParry,
  "raw-parry-success": crownRawParrySuccess,
  "pumo-flap-1": crownFlap1,
  "pumo-flap-2": crownFlap2,
  recovering: crownRecovering,
  attack: crownAttack,
  dodging: crownDodging,
};

const OVERLAYS_BY_GEAR = {
  [GEAR_TOP_HAT]: TOP_HAT_BY_STEM,
  [GEAR_CROWN]: CROWN_BY_STEM,
};

const STEM_ORDER = Object.keys(TOP_HAT_BY_STEM);

function mapFromStemTable(stemTable) {
  const map = new Map();
  BODY_SRCS.forEach((src, i) => {
    const stem = STEM_ORDER[i];
    if (stem && stemTable[stem]) map.set(src, stemTable[stem]);
  });
  return map;
}

const OVERLAY_SRC_BY_GEAR = {
  [GEAR_TOP_HAT]: mapFromStemTable(TOP_HAT_BY_STEM),
  [GEAR_CROWN]: mapFromStemTable(CROWN_BY_STEM),
};

/** Top-hat map kept for preload / backward compat. */
export const HAT_OVERLAY_BY_SRC = OVERLAY_SRC_BY_GEAR[GEAR_TOP_HAT];

/** All head-gear overlays (for preload / warm). */
export const ALL_HEAD_OVERLAYS = [
  ...Object.values(TOP_HAT_BY_STEM),
  ...Object.values(CROWN_BY_STEM),
];

/** Stem fallback tables keyed by gear id. */
export const HAT_OVERLAY_BY_STEM = TOP_HAT_BY_STEM;

/** Idle overlay — used for lobby / hub / prematch portraits (top hat default). */
export const HAT_IDLE_OVERLAY = hatPumoIdle;

export function getIdleHatOverlay(gearId) {
  const table = OVERLAYS_BY_GEAR[gearId];
  return table?.["pumo-idle"] || null;
}

export function getGearById(id) {
  return GEAR_CATALOG.find((g) => g.id === id) || null;
}

export function outfitHasGear(outfitOrGearIds, gearId) {
  const ids = Array.isArray(outfitOrGearIds)
    ? outfitOrGearIds
    : outfitOrGearIds?.gearIds;
  return Array.isArray(ids) && ids.includes(gearId);
}

/** First equipped head-slot gear id, or null. */
export function getEquippedHeadGearId(outfitOrGearIds) {
  const ids = Array.isArray(outfitOrGearIds)
    ? outfitOrGearIds
    : outfitOrGearIds?.gearIds;
  if (!Array.isArray(ids)) return null;
  return HEAD_GEAR_IDS.find((id) => ids.includes(id)) || null;
}

export function outfitHasHeadGear(outfitOrGearIds) {
  return !!getEquippedHeadGearId(outfitOrGearIds);
}

/** @deprecated Use outfitHasHeadGear / getEquippedHeadGearId */
export function outfitHasTopHat(outfitOrGearIds) {
  return outfitHasGear(outfitOrGearIds, GEAR_TOP_HAT);
}

/** Toggle a single head-slot gear. Empty array = unequipped. */
export function withHeadGear(gearIds, gearId, equipped) {
  const next = Array.isArray(gearIds) ? gearIds.filter((id) => id !== gearId) : [];
  const headIds = new Set(HEAD_GEAR_IDS);
  const cleared = next.filter((id) => !headIds.has(id));
  if (equipped) cleared.push(gearId);
  return cleared;
}

function spriteStem(src) {
  if (!src || typeof src !== "string") return null;
  const base = src.split(/[?#]/)[0].split("/").pop() || "";
  const noExt = base.replace(/\.[a-z0-9]+$/i, "");
  return noExt.replace(/-[A-Za-z0-9_]{6,}$/, "").toLowerCase();
}

function lookupStem(table, stem) {
  if (!table || !stem) return null;
  if (table[stem]) return table[stem];
  for (const [key, overlay] of Object.entries(table)) {
    if (key.toLowerCase() === stem) return overlay;
  }
  return null;
}

/**
 * Resolve a head-gear overlay for a body sprite URL / import path.
 * @param {string} src
 * @param {string} [gearId] - defaults to top_hat for backward compat
 */
export function getHatOverlayForSprite(src, gearId = GEAR_TOP_HAT) {
  if (!src || typeof src !== "string") return null;
  const bySrc = OVERLAY_SRC_BY_GEAR[gearId];
  const table = OVERLAYS_BY_GEAR[gearId];
  if (!bySrc || !table) return null;
  if (bySrc.has(src)) return bySrc.get(src);
  return lookupStem(table, spriteStem(src));
}

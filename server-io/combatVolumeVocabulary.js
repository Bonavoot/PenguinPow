"use strict";

/**
 * Premium Combat Foundation Phase 1 — combat-volume vocabulary.
 *
 * These kinds/tags are NOT interchangeable. Live resolution still uses
 * specialized systems (tip rail, clinch, etc.). This vocabulary is for
 * diagnostic/shadow geometry and future authored volumes (Phase 3+).
 */

const COMBAT_VOLUME_KIND = Object.freeze({
  PUSH: "PUSH",
  HURT_BODY: "HURT_BODY",
  HURT_LIMB: "HURT_LIMB",
  HIT: "HIT",
  GRAB: "GRAB",
  LANDING: "LANDING",
});

/** Status tags attached to a volume or fighter snapshot — separate concepts. */
const COMBAT_VOLUME_TAG = Object.freeze({
  INTANGIBLE: "INTANGIBLE",
  INVULNERABLE: "INVULNERABLE",
  ARMOR: "ARMOR",
});

/** Stable sort order for deterministic traces / overlay layering. */
const COMBAT_VOLUME_KIND_ORDER = Object.freeze({
  [COMBAT_VOLUME_KIND.PUSH]: 10,
  [COMBAT_VOLUME_KIND.LANDING]: 20,
  [COMBAT_VOLUME_KIND.HURT_BODY]: 30,
  [COMBAT_VOLUME_KIND.HURT_LIMB]: 40,
  [COMBAT_VOLUME_KIND.GRAB]: 50,
  [COMBAT_VOLUME_KIND.HIT]: 60,
});

/** Debug overlay colors (semantics only — not production art). */
const COMBAT_VOLUME_DEBUG_COLOR = Object.freeze({
  [COMBAT_VOLUME_KIND.PUSH]: "#2196f3",
  [COMBAT_VOLUME_KIND.HURT_BODY]: "#4caf50",
  [COMBAT_VOLUME_KIND.HURT_LIMB]: "#a5d6a7",
  [COMBAT_VOLUME_KIND.HIT]: "#f44336",
  [COMBAT_VOLUME_KIND.GRAB]: "#ffeb3b",
  [COMBAT_VOLUME_KIND.LANDING]: "#00bcd4",
});

const COMBAT_PHASE = Object.freeze({
  NEUTRAL: "neutral",
  STARTUP: "startup",
  ACTIVE: "active",
  RECOVERY: "recovery",
  HITSTUN: "hitstun",
  OPEN: "open",
  AIRBORNE: "airborne",
  CLINCHED: "clinched",
  INCAPACITATED: "incapacitated",
  PASS_THROUGH: "pass_through",
});

module.exports = {
  COMBAT_VOLUME_KIND,
  COMBAT_VOLUME_TAG,
  COMBAT_VOLUME_KIND_ORDER,
  COMBAT_VOLUME_DEBUG_COLOR,
  COMBAT_PHASE,
};

"use strict";

/**
 * Unified combat presentation events.
 *
 * Phase 6 — offensive aerial contact / touchdown.
 * Phase 7 — ground strikes: slap chain, palm / Shatter Palm, charged headbutt.
 * Phase 8 — clinch / grab / throw discrete interactions.
 * Phase 9 — discrete defensive outcomes (block, projectile raw parry, Matador).
 * Phase 10 — projectile lifecycle discrete moments (snowball / PUMO Army).
 *
 * Presentation is an observational consumer of resolved gameplay.
 * It must never decide hit/parry/landing / clinch / defense authority.
 *
 * Transport: compact `combatPresentation` object attached to existing
 * socket payloads (no new Socket.IO channel).
 *
 * See OFFENSIVE_AERIAL_PRESENTATION_EVENTS_PHASE.md
 * See GROUND_STRIKE_PRESENTATION_PHASE.md
 * See CLINCH_THROW_PRESENTATION_PHASE.md
 * See DEFENSIVE_PRESENTATION_PHASE.md
 * See PROJECTILE_PRESENTATION_PHASE.md
 */

const { GROUND_LEVEL } = require("./constants");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
} = require("./offensiveAerialOutcome");
const { CONTACT_AXIS } = require("./offensiveAerialContact");

/**
 * Must match client fighterAssets.js:
 *   PLAYER_MID_Y = 376, HIT_EFFECT_Y = PLAYER_MID_Y - 10
 *   PARRY_HAND_Y = HIT_EFFECT_Y + 22
 * Ground strikes historically ignored contactY (root Y) and used these spark
 * heights — preserve that geometry (presentation-only; not gameplay Y).
 */
const GROUND_STRIKE_HIT_SPARK_Y = 366;
const GROUND_STRIKE_PARRY_SPARK_Y = 388;
/** Match client fighterAssets.js PLAYER_MID_Y for clinch bursts / tech rings. */
const CLINCH_EFFECT_MID_Y = 376;
/**
 * Authored grip / forearm / upper-waist seam height for clinch compression FX.
 * Lower than PLAYER_MID_Y (face/chest) so Jolt does not cover faces.
 * Temporary CSS Jolt fallback uses this until the authored sprite ships.
 */
const CLINCH_GRIP_CONTACT_Y = 338;

const GROUND_STRIKE_MOVE = Object.freeze({
  SLAP: "slap",
  PALM: "palm",
  SHATTER_PALM: "shatter_palm",
  CHARGED: "charged",
});

const CLINCH_INTERACTION = Object.freeze({
  GRAB_BREAK: "grab_break",
  CLINCH_JOLT: "clinch_jolt",
  CLINCH_JOLT_MUTUAL: "clinch_jolt_mutual",
  COUNTER_GRAB: "counter_grab",
  CLINCH_TECH: "clinch_tech",
  CLINCH_TUMBLE: "clinch_tumble",
  COUNTER_THROW_CALLOUT: "counter_throw_callout",
  THROW_FAIL: "throw_fail",
  PERFECT_BRACE: "perfect_brace",
  DEEP_GRIP: "deep_grip",
  KILL_THROW_LAUNCH: "kill_throw_launch",
  THROW_LAND: "throw_land",
  KILL_THROW_LAND: "kill_throw_land",
  GRAB_ARMOR_BREAK: "grab_armor_break",
  GRAB_ARMOR_ABSORB: "grab_armor_absorb",
});

const PRESENTATION_EVENT_TYPE = Object.freeze({
  OA_HIT: "OA_HIT",
  OA_PARRY: "OA_PARRY",
  OA_TOUCHDOWN: "OA_TOUCHDOWN",
  OA_WHIFF_LAND: "OA_WHIFF_LAND",
  GS_HIT: "GS_HIT",
  GS_PARRY: "GS_PARRY",
  CLINCH: "CLINCH",
  DEFENSE: "DEFENSE",
  PROJECTILE: "PROJECTILE",
});

/** Active projectile entity kinds (live gameplay only). */
const PROJECTILE_TYPE = Object.freeze({
  SNOWBALL: "snowball",
  PUMO_ARMY: "pumo_army",
});

/** Discrete lifecycle transitions — never emitted every travel tick. */
const PROJECTILE_LIFECYCLE = Object.freeze({
  HIT: "HIT",
  PARRY: "PARRY",
  PERFECT_PARRY: "PERFECT_PARRY",
  ABSORB: "ABSORB",
  DESTROY: "DESTROY",
  EXPIRE: "EXPIRE",
  BOUNDARY: "BOUNDARY",
});

const PROJECTILE_OUTCOME = Object.freeze({
  HIT: "HIT",
  PARRY: "PARRY",
  PERFECT_PARRY: "PERFECT_PARRY",
  ABSORB: "ABSORB",
  DESTROYED: "DESTROYED",
  EXPIRED: "EXPIRED",
  BOUNDARY: "BOUNDARY",
});

/** Discrete defensive outcome labels (only outcomes that exist in live gameplay). */
const DEFENSE_OUTCOME = Object.freeze({
  BLOCK: "BLOCK",
  PARRY: "PARRY",
  PERFECT_PARRY: "PERFECT_PARRY",
  MATADOR: "MATADOR",
  ABSORB: "ABSORB",
  RAW_PARRY: "RAW_PARRY",
});

const DEFENSE_TYPE = Object.freeze({
  GUARD_BLOCK: "GUARD_BLOCK",
  ATTACK_PARRY: "ATTACK_PARRY",
  PROJECTILE_PARRY: "PROJECTILE_PARRY",
  MATADOR: "MATADOR",
  GRAB_ARMOR_ABSORB: "GRAB_ARMOR_ABSORB",
});

const PRESENTATION_ANCHOR = Object.freeze({
  CONTACT: "CONTACT",
  ATTACKER_SURFACE: "ATTACKER_SURFACE",
  DEFENDER_SURFACE: "DEFENDER_SURFACE",
  ATTACKER_ROOT: "ATTACKER_ROOT",
  DEFENDER_ROOT: "DEFENDER_ROOT",
  TOUCHDOWN: "TOUCHDOWN",
  GROUND_CONTACT: "GROUND_CONTACT",
  CLINCH_SEAM: "CLINCH_SEAM",
  GRIP_CONTACT: "GRIP_CONTACT",
  /** Shared forearm / belt grip seam — Jolt compression origin. */
  CLINCH_GRIP_CONTACT: "CLINCH_GRIP_CONTACT",
  SHARED_CENTER: "SHARED_CENTER",
  THROW_RELEASE: "THROW_RELEASE",
  THROW_LANDING: "THROW_LANDING",
  RING_BOUNDARY: "RING_BOUNDARY",
});

const PRESENTATION_PROFILE = Object.freeze({
  OA_FLAP_HIT: "OA_FLAP_HIT",
  OA_FLAP_PARRY: "OA_FLAP_PARRY",
  OA_DIVE_HIT: "OA_DIVE_HIT",
  OA_DIVE_PARRY: "OA_DIVE_PARRY",
  OA_DIVE_TOUCHDOWN: "OA_DIVE_TOUCHDOWN",
  OA_SLIDE_JUMP_TOUCHDOWN: "OA_SLIDE_JUMP_TOUCHDOWN",
  OA_WHIFF_LAND: "OA_WHIFF_LAND",
  GS_SLAP_HIT: "GS_SLAP_HIT",
  GS_SLAP_PARRY: "GS_SLAP_PARRY",
  GS_PALM_HIT: "GS_PALM_HIT",
  GS_PALM_PARRY: "GS_PALM_PARRY",
  GS_SHATTER_PALM_HIT: "GS_SHATTER_PALM_HIT",
  GS_CHARGED_HIT: "GS_CHARGED_HIT",
  GS_CHARGED_PARRY: "GS_CHARGED_PARRY",
  GS_ARMOR_BREAK_HIT: "GS_ARMOR_BREAK_HIT",
  CLINCH_GRAB_BREAK: "CLINCH_GRAB_BREAK",
  CLINCH_JOLT: "CLINCH_JOLT",
  CLINCH_JOLT_MUTUAL: "CLINCH_JOLT_MUTUAL",
  CLINCH_COUNTER_GRAB: "CLINCH_COUNTER_GRAB",
  CLINCH_TECH: "CLINCH_TECH",
  CLINCH_TUMBLE: "CLINCH_TUMBLE",
  CLINCH_COUNTER_THROW_CALLOUT: "CLINCH_COUNTER_THROW_CALLOUT",
  CLINCH_THROW_FAIL: "CLINCH_THROW_FAIL",
  CLINCH_PERFECT_BRACE: "CLINCH_PERFECT_BRACE",
  CLINCH_DEEP_GRIP: "CLINCH_DEEP_GRIP",
  CLINCH_KILL_THROW_LAUNCH: "CLINCH_KILL_THROW_LAUNCH",
  CLINCH_THROW_LAND: "CLINCH_THROW_LAND",
  CLINCH_KILL_THROW_LAND: "CLINCH_KILL_THROW_LAND",
  CLINCH_GRAB_ARMOR_BREAK: "CLINCH_GRAB_ARMOR_BREAK",
  CLINCH_GRAB_ARMOR_ABSORB: "CLINCH_GRAB_ARMOR_ABSORB",
  /** Ordinary Space-hold guard chip absorb (blocking-effect.png). */
  DEF_BLOCK: "DEF_BLOCK",
  /** Snowball / pumo-clone raw parry (RawParryEffect blue ring). */
  DEF_RAW_PARRY: "DEF_RAW_PARRY",
  /** Matador grab avoidance success — HUD stamp identity + shared midpoint. */
  DEF_MATADOR: "DEF_MATADOR",
  /** Snowball player-contact impact (SnowballImpactEffect). */
  PROJ_SNOWBALL_HIT: "PROJ_SNOWBALL_HIT",
});

const ORIENTATION_RULE = Object.freeze({
  CONTACT_NORMAL: "CONTACT_NORMAL",
  APPROACH: "APPROACH",
  GROUND_UP: "GROUND_UP",
  ATTACKER_FACING: "ATTACKER_FACING",
  MOVEMENT: "MOVEMENT",
  NONE: "NONE",
});

const FALLBACK_LEVEL = Object.freeze({
  SURFACE_CONTACT: 0,
  STORED_CONTACT: 1,
  SURFACE_ANCHOR: 2,
  OUTCOME_GEOMETRIC: 3,
  ROOT_MIDPOINT: 4,
});

/** Authoritative profiles for offensive-aerial category only. */
const PROFILES = Object.freeze({
  [PRESENTATION_PROFILE.OA_FLAP_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_FLAP_HIT,
    eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    // Artistic registration only (world units). Bias toward standing chest/belly.
    localOffsetX: 0,
    localOffsetY: -18,
    mirrorFromNormalX: true,
    spriteKey: "flap",
    particleSupplement: null,
    lifetimeMs: 340,
  }),
  [PRESENTATION_PROFILE.OA_DIVE_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_DIVE_HIT,
    eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    localOffsetX: 0,
    localOffsetY: -22,
    mirrorFromNormalX: true,
    spriteKey: "flap",
    particleSupplement: null,
    lifetimeMs: 340,
  }),
  [PRESENTATION_PROFILE.OA_FLAP_PARRY]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_FLAP_PARRY,
    eventType: PRESENTATION_EVENT_TYPE.OA_PARRY,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    // Small outward push along normal so burst clears the torso (was +28px facing).
    localOffsetX: 28,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapParry",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  [PRESENTATION_PROFILE.OA_DIVE_PARRY]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_DIVE_PARRY,
    eventType: PRESENTATION_EVENT_TYPE.OA_PARRY,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    localOffsetX: 28,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapParry",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  [PRESENTATION_PROFILE.OA_DIVE_TOUCHDOWN]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_DIVE_TOUCHDOWN,
    eventType: PRESENTATION_EVENT_TYPE.OA_TOUCHDOWN,
    primaryAnchor: PRESENTATION_ANCHOR.GROUND_CONTACT,
    orientation: ORIENTATION_RULE.GROUND_UP,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "flapFastFallLand",
    lifetimeMs: 520,
  }),
  [PRESENTATION_PROFILE.OA_SLIDE_JUMP_TOUCHDOWN]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_SLIDE_JUMP_TOUCHDOWN,
    eventType: PRESENTATION_EVENT_TYPE.OA_TOUCHDOWN,
    primaryAnchor: PRESENTATION_ANCHOR.GROUND_CONTACT,
    orientation: ORIENTATION_RULE.GROUND_UP,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "throwLand",
    lifetimeMs: 500,
  }),
  [PRESENTATION_PROFILE.OA_WHIFF_LAND]: Object.freeze({
    id: PRESENTATION_PROFILE.OA_WHIFF_LAND,
    eventType: PRESENTATION_EVENT_TYPE.OA_WHIFF_LAND,
    primaryAnchor: PRESENTATION_ANCHOR.GROUND_CONTACT,
    orientation: ORIENTATION_RULE.GROUND_UP,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "throwLand",
    lifetimeMs: 500,
  }),
  // Ground strikes — sprite keys map to existing HIT_FX / SlapParry assets.
  [PRESENTATION_PROFILE.GS_SLAP_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_SLAP_HIT,
    eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.APPROACH,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slap",
    particleSupplement: null,
    lifetimeMs: 300,
  }),
  [PRESENTATION_PROFILE.GS_SLAP_PARRY]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_SLAP_PARRY,
    eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    localOffsetX: 28,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapParry",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  [PRESENTATION_PROFILE.GS_PALM_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_PALM_HIT,
    eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.APPROACH,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapBurst",
    particleSupplement: null,
    lifetimeMs: 330,
  }),
  [PRESENTATION_PROFILE.GS_PALM_PARRY]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_PALM_PARRY,
    eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    localOffsetX: 28,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapParry",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  // Shatter Palm armor-break confirm — same slapBurst art; status filter on client.
  [PRESENTATION_PROFILE.GS_SHATTER_PALM_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_SHATTER_PALM_HIT,
    eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.APPROACH,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapBurst",
    particleSupplement: null,
    lifetimeMs: 330,
  }),
  [PRESENTATION_PROFILE.GS_CHARGED_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_CHARGED_HIT,
    eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.APPROACH,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "charged",
    particleSupplement: null,
    lifetimeMs: 420,
  }),
  [PRESENTATION_PROFILE.GS_CHARGED_PARRY]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_CHARGED_PARRY,
    eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    localOffsetX: 28,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "slapParry",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  // Charged armor-break — same charged sheet; armorBreak filter on client.
  [PRESENTATION_PROFILE.GS_ARMOR_BREAK_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.GS_ARMOR_BREAK_HIT,
    eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.APPROACH,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "charged",
    particleSupplement: null,
    lifetimeMs: 420,
  }),
  // Clinch / grab / throw — existing assets only (no new FX).
  [PRESENTATION_PROFILE.CLINCH_GRAB_BREAK]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_GRAB_BREAK,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.CLINCH_SEAM,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: "grabBreak",
    particleSupplement: null,
    lifetimeMs: 300,
  }),
  [PRESENTATION_PROFILE.CLINCH_JOLT]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_JOLT,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.CLINCH_GRIP_CONTACT,
    orientation: ORIENTATION_RULE.MOVEMENT,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    // TEMPORARY CSS FALLBACK — remove when authored clinch-compression sheet ships.
    spriteKey: "clinchJoltCssFallback",
    particleSupplement: null,
    lifetimeMs: 450,
    temporaryCssFallback: true,
    gripHeightY: CLINCH_GRIP_CONTACT_Y,
  }),
  [PRESENTATION_PROFILE.CLINCH_JOLT_MUTUAL]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_JOLT_MUTUAL,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.CLINCH_GRIP_CONTACT,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    // TEMPORARY CSS FALLBACK — remove when authored clinch-compression sheet ships.
    spriteKey: "clinchJoltCssFallback",
    particleSupplement: null,
    lifetimeMs: 450,
    temporaryCssFallback: true,
    gripHeightY: CLINCH_GRIP_CONTACT_Y,
  }),
  [PRESENTATION_PROFILE.CLINCH_COUNTER_GRAB]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_COUNTER_GRAB,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.DEFENDER_SURFACE,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: "counterGrab",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  [PRESENTATION_PROFILE.CLINCH_TECH]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_TECH,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.CLINCH_SEAM,
    orientation: ORIENTATION_RULE.CONTACT_NORMAL,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: "grabTech",
    particleSupplement: null,
    lifetimeMs: 1600,
  }),
  [PRESENTATION_PROFILE.CLINCH_TUMBLE]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_TUMBLE,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.SHARED_CENTER,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: null,
    lifetimeMs: 200,
  }),
  [PRESENTATION_PROFILE.CLINCH_COUNTER_THROW_CALLOUT]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_COUNTER_THROW_CALLOUT,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.SHARED_CENTER,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: null,
    lifetimeMs: 1200,
  }),
  [PRESENTATION_PROFILE.CLINCH_THROW_FAIL]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_THROW_FAIL,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.SHARED_CENTER,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: null,
    lifetimeMs: 1200,
  }),
  [PRESENTATION_PROFILE.CLINCH_PERFECT_BRACE]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_PERFECT_BRACE,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.DEFENDER_SURFACE,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: null,
    lifetimeMs: 1200,
  }),
  [PRESENTATION_PROFILE.CLINCH_DEEP_GRIP]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_DEEP_GRIP,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.GRIP_CONTACT,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: null,
    lifetimeMs: 1200,
  }),
  [PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAUNCH]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAUNCH,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.THROW_RELEASE,
    orientation: ORIENTATION_RULE.MOVEMENT,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: true,
    spriteKey: null,
    particleSupplement: "clinchKillThrowTrail",
    lifetimeMs: 900,
  }),
  [PRESENTATION_PROFILE.CLINCH_THROW_LAND]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_THROW_LAND,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.THROW_LANDING,
    orientation: ORIENTATION_RULE.GROUND_UP,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "throwLand",
    lifetimeMs: 500,
  }),
  [PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAND]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAND,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.THROW_LANDING,
    orientation: ORIENTATION_RULE.GROUND_UP,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "clinchKillThrowLand",
    lifetimeMs: 600,
  }),
  [PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_BREAK]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_BREAK,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.ATTACKER_FACING,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "grabArmorBreak",
    lifetimeMs: 400,
  }),
  [PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_ABSORB]: Object.freeze({
    id: PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_ABSORB,
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    primaryAnchor: PRESENTATION_ANCHOR.DEFENDER_SURFACE,
    orientation: ORIENTATION_RULE.ATTACKER_FACING,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: "grabArmorAbsorb",
    lifetimeMs: 400,
  }),
  // Phase 9 — discrete defensive outcomes (existing assets only).
  [PRESENTATION_PROFILE.DEF_BLOCK]: Object.freeze({
    id: PRESENTATION_PROFILE.DEF_BLOCK,
    eventType: PRESENTATION_EVENT_TYPE.DEFENSE,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.ATTACKER_FACING,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: "blocking",
    particleSupplement: null,
    lifetimeMs: 420,
  }),
  [PRESENTATION_PROFILE.DEF_RAW_PARRY]: Object.freeze({
    id: PRESENTATION_PROFILE.DEF_RAW_PARRY,
    eventType: PRESENTATION_EVENT_TYPE.DEFENSE,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.ATTACKER_FACING,
    // Contact is authored on the incoming side of the parrier (see
    // buildDefensivePresentation PROJECTILE_PARRY). facingHint aligns CSS tilt.
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: "rawParry",
    particleSupplement: null,
    lifetimeMs: 400,
  }),
  [PRESENTATION_PROFILE.DEF_MATADOR]: Object.freeze({
    id: PRESENTATION_PROFILE.DEF_MATADOR,
    eventType: PRESENTATION_EVENT_TYPE.DEFENSE,
    primaryAnchor: PRESENTATION_ANCHOR.SHARED_CENTER,
    orientation: ORIENTATION_RULE.NONE,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: null,
    particleSupplement: null,
    lifetimeMs: 900,
    screenSpaceCallout: true,
  }),
  // Phase 10 — snowball impact. World X = projectile contact (no fixed +70
  // player-root bias). Authored Y registration matches prior chest lift.
  [PRESENTATION_PROFILE.PROJ_SNOWBALL_HIT]: Object.freeze({
    id: PRESENTATION_PROFILE.PROJ_SNOWBALL_HIT,
    eventType: PRESENTATION_EVENT_TYPE.PROJECTILE,
    primaryAnchor: PRESENTATION_ANCHOR.CONTACT,
    orientation: ORIENTATION_RULE.APPROACH,
    localOffsetX: 0,
    localOffsetY: 0,
    mirrorFromNormalX: false,
    spriteKey: "snowballImpact",
    particleSupplement: null,
    lifetimeMs: 450,
  }),
});

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function sanitizeFacing(dir, fallback = -1) {
  if (dir === 1 || dir === -1) return dir;
  return fallback;
}

function getProfile(profileId) {
  return PROFILES[profileId] || null;
}

function isDiveMove(moveType, attacker) {
  return (
    moveType === OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE ||
    !!attacker?.slideJumpDiveCommitted
  );
}

function selectHitProfile(attacker) {
  const moveType = attacker?.offensiveAerial?.moveType;
  return isDiveMove(moveType, attacker)
    ? PRESENTATION_PROFILE.OA_DIVE_HIT
    : PRESENTATION_PROFILE.OA_FLAP_HIT;
}

function selectParryProfile(attacker) {
  const moveType = attacker?.offensiveAerial?.moveType;
  return isDiveMove(moveType, attacker)
    ? PRESENTATION_PROFILE.OA_DIVE_PARRY
    : PRESENTATION_PROFILE.OA_FLAP_PARRY;
}

function selectTouchdownProfile(attacker, meta = {}) {
  if (meta.whiff || attacker?.offensiveAerial?.outcome === "WHIFF") {
    return PRESENTATION_PROFILE.OA_WHIFF_LAND;
  }
  if (attacker?.slideJumpDiveCommitted || attacker?.slideJumpFastFalling) {
    return PRESENTATION_PROFILE.OA_DIVE_TOUCHDOWN;
  }
  if (attacker?.slideJumpHasFlap || attacker?.slideJumpFlapFlightActive) {
    return PRESENTATION_PROFILE.OA_WHIFF_LAND;
  }
  return PRESENTATION_PROFILE.OA_SLIDE_JUMP_TOUCHDOWN;
}

/**
 * Resolve world anchor before artistic local offset.
 * @returns {{ x: number, y: number, fallback: number, anchorType: string }}
 */
function resolveAnchorPoint(meta = {}) {
  const {
    contactX,
    contactY,
    attackerContactX,
    attackerContactY,
    defenderContactX,
    defenderContactY,
    attackerX,
    attackerY,
    defenderX,
    defenderY,
    preferredAnchor = PRESENTATION_ANCHOR.CONTACT,
  } = meta;

  const has = (x, y) =>
    typeof x === "number" &&
    Number.isFinite(x) &&
    typeof y === "number" &&
    Number.isFinite(y);

  if (
    preferredAnchor === PRESENTATION_ANCHOR.GROUND_CONTACT ||
    preferredAnchor === PRESENTATION_ANCHOR.TOUCHDOWN ||
    preferredAnchor === PRESENTATION_ANCHOR.THROW_LANDING
  ) {
    const x = finite(contactX, finite(attackerX, 0));
    return {
      x,
      y:
        preferredAnchor === PRESENTATION_ANCHOR.THROW_LANDING
          ? finite(contactY, GROUND_LEVEL)
          : GROUND_LEVEL,
      fallback: FALLBACK_LEVEL.OUTCOME_GEOMETRIC,
      anchorType:
        preferredAnchor === PRESENTATION_ANCHOR.THROW_LANDING
          ? PRESENTATION_ANCHOR.THROW_LANDING
          : PRESENTATION_ANCHOR.GROUND_CONTACT,
    };
  }

  if (
    preferredAnchor === PRESENTATION_ANCHOR.CLINCH_SEAM ||
    preferredAnchor === PRESENTATION_ANCHOR.SHARED_CENTER ||
    preferredAnchor === PRESENTATION_ANCHOR.GRIP_CONTACT ||
    preferredAnchor === PRESENTATION_ANCHOR.CLINCH_GRIP_CONTACT
  ) {
    const defaultY =
      preferredAnchor === PRESENTATION_ANCHOR.CLINCH_GRIP_CONTACT
        ? CLINCH_GRIP_CONTACT_Y
        : CLINCH_EFFECT_MID_Y;
    if (has(contactX, contactY)) {
      return {
        x: contactX,
        // Grip anchor always uses authored grip height (ignore face/root Y).
        y:
          preferredAnchor === PRESENTATION_ANCHOR.CLINCH_GRIP_CONTACT
            ? CLINCH_GRIP_CONTACT_Y
            : contactY,
        fallback: FALLBACK_LEVEL.STORED_CONTACT,
        anchorType: preferredAnchor,
      };
    }
    if (has(attackerX, defenderX)) {
      return {
        x: (finite(attackerX, 0) + finite(defenderX, 0)) * 0.5,
        y: defaultY,
        fallback: FALLBACK_LEVEL.OUTCOME_GEOMETRIC,
        anchorType: preferredAnchor,
      };
    }
  }

  if (preferredAnchor === PRESENTATION_ANCHOR.THROW_RELEASE) {
    if (has(contactX, contactY)) {
      return {
        x: contactX,
        y: contactY,
        fallback: FALLBACK_LEVEL.STORED_CONTACT,
        anchorType: PRESENTATION_ANCHOR.THROW_RELEASE,
      };
    }
    return {
      x: finite(defenderX, finite(attackerX, 640)),
      y: finite(defenderY, GROUND_LEVEL),
      fallback: FALLBACK_LEVEL.OUTCOME_GEOMETRIC,
      anchorType: PRESENTATION_ANCHOR.THROW_RELEASE,
    };
  }

  if (has(contactX, contactY)) {
    return {
      x: contactX,
      y: contactY,
      fallback: FALLBACK_LEVEL.SURFACE_CONTACT,
      anchorType: PRESENTATION_ANCHOR.CONTACT,
    };
  }

  if (has(attackerContactX, attackerContactY)) {
    return {
      x: attackerContactX,
      y: attackerContactY,
      fallback: FALLBACK_LEVEL.SURFACE_ANCHOR,
      anchorType: PRESENTATION_ANCHOR.ATTACKER_SURFACE,
    };
  }

  if (has(defenderContactX, defenderContactY)) {
    return {
      x: defenderContactX,
      y: defenderContactY,
      fallback: FALLBACK_LEVEL.SURFACE_ANCHOR,
      anchorType: PRESENTATION_ANCHOR.DEFENDER_SURFACE,
    };
  }

  if (has(attackerX, defenderX) && (has(attackerY, defenderY) || true)) {
    const ax = finite(attackerX, 0);
    const dx = finite(defenderX, ax);
    const ay = finite(attackerY, GROUND_LEVEL + 40);
    const dy = finite(defenderY, GROUND_LEVEL);
    return {
      x: (ax + dx) * 0.5,
      y: (ay + dy) * 0.5,
      fallback: FALLBACK_LEVEL.ROOT_MIDPOINT,
      anchorType: PRESENTATION_ANCHOR.CONTACT,
    };
  }

  return {
    x: finite(attackerX, 640),
    y: finite(attackerY, GROUND_LEVEL + 40),
    fallback: FALLBACK_LEVEL.ROOT_MIDPOINT,
    anchorType: PRESENTATION_ANCHOR.ATTACKER_ROOT,
  };
}

/**
 * Apply profile local offset in world space.
 * When mirrorFromNormalX, localOffsetX is along +contactNormal X sign
 * (outward from defender toward / along reject direction).
 */
function applyLocalOffset(anchor, profile, normalX) {
  if (!profile) return { x: anchor.x, y: anchor.y };
  let ox = finite(profile.localOffsetX, 0);
  const oy = finite(profile.localOffsetY, 0);
  if (profile.mirrorFromNormalX) {
    const sign = normalX > 0 ? 1 : normalX < 0 ? -1 : 1;
    ox = Math.abs(ox) * sign;
  }
  return {
    x: finite(anchor.x + ox, anchor.x),
    y: finite(anchor.y + oy, anchor.y),
  };
}

function resolveOrientation(profile, meta = {}) {
  const rule = profile?.orientation || ORIENTATION_RULE.NONE;
  const nx = finite(meta.contactNormalX, 0);
  const ny = finite(meta.contactNormalY, 0);
  if (rule === ORIENTATION_RULE.CONTACT_NORMAL) {
    return { source: rule, nx, ny, facingHint: nx >= 0 ? -1 : 1 };
  }
  if (rule === ORIENTATION_RULE.APPROACH || rule === ORIENTATION_RULE.MOVEMENT) {
    const ax = finite(meta.approachX, finite(meta.movementX, 0));
    const ay = finite(meta.approachY, finite(meta.movementY, 0));
    return {
      source: rule,
      nx: ax,
      ny: ay,
      facingHint: ax >= 0 ? -1 : 1,
    };
  }
  if (rule === ORIENTATION_RULE.GROUND_UP) {
    return { source: rule, nx: 0, ny: 1, facingHint: sanitizeFacing(meta.attackerFacing, -1) };
  }
  if (rule === ORIENTATION_RULE.ATTACKER_FACING) {
    const f = sanitizeFacing(meta.attackerFacing, -1);
    return { source: rule, nx: f === -1 ? 1 : -1, ny: 0, facingHint: f };
  }
  return { source: ORIENTATION_RULE.NONE, nx: 0, ny: 0, facingHint: -1 };
}

function mintEventId(actionInstanceId, eventType, salt = "") {
  const base = actionInstanceId || "oa";
  return `${base}:${eventType}${salt ? `:${salt}` : ""}`;
}

/**
 * Build a compact presentation event for an aerial hit or parry.
 * Safe for network: no debug-only fields.
 */
function buildOffensiveAerialContactPresentation({
  eventType,
  attacker,
  defender,
  contact,
  approachX = 0,
  approachY = 0,
  resolvedTick = 0,
  salt = "",
} = {}) {
  const isParry = eventType === PRESENTATION_EVENT_TYPE.OA_PARRY;
  const profileId = isParry
    ? selectParryProfile(attacker)
    : selectHitProfile(attacker);
  const profile = getProfile(profileId);
  const actionInstanceId =
    attacker?.offensiveAerial?.attackInstanceId || null;

  const anchor = resolveAnchorPoint({
    contactX: contact?.contactX,
    contactY: contact?.contactY,
    attackerContactX: contact?.attackerContactX,
    attackerContactY: contact?.attackerContactY,
    defenderContactX: contact?.defenderContactX,
    defenderContactY: contact?.defenderContactY,
    attackerX: attacker?.x,
    attackerY: attacker?.y,
    defenderX: defender?.x,
    defenderY: defender?.y,
    preferredAnchor: profile?.primaryAnchor,
  });

  const nx = finite(contact?.contactNormalX, 0);
  const ny = finite(contact?.contactNormalY, 0);
  const placed = applyLocalOffset(anchor, profile, nx);
  const orientation = resolveOrientation(profile, {
    contactNormalX: nx,
    contactNormalY: ny,
    approachX,
    approachY,
    attackerFacing: attacker?.facing,
  });

  return {
    eventId: mintEventId(
      actionInstanceId,
      isParry ? PRESENTATION_EVENT_TYPE.OA_PARRY : PRESENTATION_EVENT_TYPE.OA_HIT,
      salt
    ),
    eventType: isParry
      ? PRESENTATION_EVENT_TYPE.OA_PARRY
      : PRESENTATION_EVENT_TYPE.OA_HIT,
    serverTick: resolvedTick || 0,
    actionInstanceId,
    attackerId: attacker?.id || null,
    defenderId: defender?.id || null,
    moveType:
      attacker?.offensiveAerial?.moveType ||
      (isDiveMove(null, attacker)
        ? OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE
        : OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP),
    outcome: isParry ? "PARRIED" : "HIT",
    profileId,
    anchorType: anchor.anchorType,
    x: placed.x,
    y: placed.y,
    contactNormalX: nx,
    contactNormalY: ny,
    approachX: finite(approachX, 0),
    approachY: finite(approachY, 0),
    attackerFacing: sanitizeFacing(attacker?.facing, -1),
    orientationSource: orientation.source,
    facingHint: orientation.facingHint,
    fallback: anchor.fallback,
    contactAxis: contact?.contactAxis || CONTACT_AXIS.LATERAL,
  };
}

function buildOffensiveAerialTouchdownPresentation({
  attacker,
  dive = false,
  whiff = false,
  salt = "",
} = {}) {
  const profileId = selectTouchdownProfile(attacker, { whiff, dive });
  const profile = getProfile(profileId);
  const actionInstanceId =
    attacker?.offensiveAerial?.attackInstanceId || null;
  const anchor = resolveAnchorPoint({
    attackerX: attacker?.x,
    attackerY: attacker?.y,
    preferredAnchor: PRESENTATION_ANCHOR.GROUND_CONTACT,
  });
  const placed = applyLocalOffset(anchor, profile, 0);
  return {
    eventId: mintEventId(
      actionInstanceId || attacker?.id || "sj",
      PRESENTATION_EVENT_TYPE.OA_TOUCHDOWN,
      salt || String(attacker?.slideJumpLandingTime || "land")
    ),
    eventType: PRESENTATION_EVENT_TYPE.OA_TOUCHDOWN,
    serverTick: 0,
    actionInstanceId,
    attackerId: attacker?.id || null,
    defenderId: null,
    moveType: attacker?.offensiveAerial?.moveType || null,
    outcome: whiff ? "WHIFF" : "LANDED",
    profileId,
    anchorType: PRESENTATION_ANCHOR.GROUND_CONTACT,
    x: placed.x,
    y: placed.y,
    contactNormalX: 0,
    contactNormalY: 1,
    approachX: 0,
    approachY: -1,
    attackerFacing: sanitizeFacing(attacker?.facing, -1),
    orientationSource: ORIENTATION_RULE.GROUND_UP,
    facingHint: sanitizeFacing(attacker?.facing, -1),
    fallback: anchor.fallback,
    contactAxis: null,
    particleSupplement: profile?.particleSupplement || null,
  };
}

/**
 * Classify a ground-strike move for presentation.
 * Returns null for low kick / non-migrated families (caller skips attach).
 */
function classifyGroundStrikeMove(attacker, meta = {}) {
  if (!attacker) return null;
  if (meta.isLowKick || attacker.isLowKick || attacker.attackType === "lowKick") {
    return null;
  }
  if (attacker.isPalmThrust || meta.isPalmThrust) {
    if (meta.isArmorBreak) return GROUND_STRIKE_MOVE.SHATTER_PALM;
    return GROUND_STRIKE_MOVE.PALM;
  }
  if (attacker.isSlapAttack || attacker.attackType === "slap" || meta.isSlapAttack) {
    return GROUND_STRIKE_MOVE.SLAP;
  }
  if (attacker.attackType === "charged" || meta.attackType === "charged") {
    return GROUND_STRIKE_MOVE.CHARGED;
  }
  return null;
}

/** Existing charge % → coarse tier for debug/identity only (visuals unchanged). */
function chargeTierFromPercentage(chargePercentage) {
  const p =
    typeof chargePercentage === "number" && Number.isFinite(chargePercentage)
      ? chargePercentage
      : 0;
  if (p >= 90) return "max";
  if (p >= 50) return "mid";
  return "min";
}

function selectGroundStrikeHitProfile(moveType, meta = {}) {
  if (moveType === GROUND_STRIKE_MOVE.SLAP) {
    return PRESENTATION_PROFILE.GS_SLAP_HIT;
  }
  if (moveType === GROUND_STRIKE_MOVE.SHATTER_PALM) {
    return PRESENTATION_PROFILE.GS_SHATTER_PALM_HIT;
  }
  if (moveType === GROUND_STRIKE_MOVE.PALM) {
    return PRESENTATION_PROFILE.GS_PALM_HIT;
  }
  if (moveType === GROUND_STRIKE_MOVE.CHARGED) {
    return meta.isArmorBreak
      ? PRESENTATION_PROFILE.GS_ARMOR_BREAK_HIT
      : PRESENTATION_PROFILE.GS_CHARGED_HIT;
  }
  return PRESENTATION_PROFILE.GS_SLAP_HIT;
}

function selectGroundStrikeParryProfile(moveType) {
  if (moveType === GROUND_STRIKE_MOVE.PALM || moveType === GROUND_STRIKE_MOVE.SHATTER_PALM) {
    return PRESENTATION_PROFILE.GS_PALM_PARRY;
  }
  if (moveType === GROUND_STRIKE_MOVE.CHARGED) {
    return PRESENTATION_PROFILE.GS_CHARGED_PARRY;
  }
  return PRESENTATION_PROFILE.GS_SLAP_PARRY;
}

/**
 * Presentation-only contact for ground strikes.
 * X: tip seam (getContactSeamX) when valid.
 * Y: existing HIT_EFFECT_Y / parry-hand Y (not root victim.y).
 */
function resolveGroundStrikeContactMeta({
  attacker,
  defender,
  contactX,
  isParry = false,
} = {}) {
  const sparkY = isParry
    ? GROUND_STRIKE_PARRY_SPARK_Y
    : GROUND_STRIKE_HIT_SPARK_Y;
  const towardDef =
    defender && typeof defender.x === "number" && attacker && typeof attacker.x === "number"
      ? defender.x >= attacker.x
        ? 1
        : -1
      : attacker?.facing === 1
        ? -1
        : 1;
  // Normal from defender toward attacker (parry outward push / reject).
  const nx = -towardDef;
  const ny = 0;
  const approachX = towardDef;
  const approachY = 0;

  if (typeof contactX === "number" && Number.isFinite(contactX)) {
    return {
      contactX,
      contactY: sparkY,
      contactNormalX: nx,
      contactNormalY: ny,
      approachX,
      approachY,
      fallbackHint: FALLBACK_LEVEL.SURFACE_CONTACT,
    };
  }

  // Geometric fallback: tip-ish point between roots at spark height.
  const ax = finite(attacker?.x, 640);
  const dx = finite(defender?.x, ax);
  return {
    contactX: (ax + dx) * 0.5,
    contactY: sparkY,
    contactNormalX: nx,
    contactNormalY: ny,
    approachX,
    approachY,
    fallbackHint: FALLBACK_LEVEL.OUTCOME_GEOMETRIC,
  };
}

/**
 * Build presentation for slap / palm / charged hit or attack-parry.
 * Returns null for non-migrated families (low kick, etc.).
 */
function buildGroundStrikeContactPresentation({
  eventType,
  attacker,
  defender,
  contactX = null,
  isSlapAttack = false,
  isPalmThrust = false,
  isLowKick = false,
  isArmorBreak = false,
  attackType = null,
  chargePercentage = 0,
  slapStage = null,
  hitId = "",
  parryId = "",
  resolvedTick = 0,
  salt = "",
} = {}) {
  const moveType = classifyGroundStrikeMove(attacker, {
    isSlapAttack,
    isPalmThrust,
    isLowKick,
    isArmorBreak,
    attackType,
  });
  if (!moveType) return null;

  const isParry =
    eventType === PRESENTATION_EVENT_TYPE.GS_PARRY ||
    eventType === PRESENTATION_EVENT_TYPE.OA_PARRY;
  const profileId = isParry
    ? selectGroundStrikeParryProfile(moveType)
    : selectGroundStrikeHitProfile(moveType, { isArmorBreak });
  const profile = getProfile(profileId);

  const gsContact = resolveGroundStrikeContactMeta({
    attacker,
    defender,
    contactX,
    isParry,
  });

  const actionInstanceId =
    hitId ||
    parryId ||
    `${attacker?.id || "gs"}:${moveType}:${resolvedTick || 0}`;

  const anchor = resolveAnchorPoint({
    contactX: gsContact.contactX,
    contactY: gsContact.contactY,
    attackerX: attacker?.x,
    attackerY: attacker?.y,
    defenderX: defender?.x,
    defenderY: defender?.y,
    preferredAnchor: profile?.primaryAnchor,
  });
  // Prefer surface/geometric hint from GS resolver when contact X was missing.
  const fallback =
    gsContact.fallbackHint === FALLBACK_LEVEL.OUTCOME_GEOMETRIC
      ? FALLBACK_LEVEL.OUTCOME_GEOMETRIC
      : anchor.fallback;

  const nx = gsContact.contactNormalX;
  const ny = gsContact.contactNormalY;
  const placed = applyLocalOffset(anchor, profile, nx);
  const orientation = resolveOrientation(profile, {
    contactNormalX: nx,
    contactNormalY: ny,
    approachX: gsContact.approachX,
    approachY: gsContact.approachY,
    attackerFacing: attacker?.facing,
  });

  const stage =
    slapStage != null
      ? slapStage
      : attacker?.slapAnimation === 1 || attacker?.slapAnimation === 2
        ? attacker.slapAnimation
        : null;

  return {
    eventId: mintEventId(
      actionInstanceId,
      isParry ? PRESENTATION_EVENT_TYPE.GS_PARRY : PRESENTATION_EVENT_TYPE.GS_HIT,
      salt || (isParry ? "parry" : "hit")
    ),
    eventType: isParry
      ? PRESENTATION_EVENT_TYPE.GS_PARRY
      : PRESENTATION_EVENT_TYPE.GS_HIT,
    serverTick: resolvedTick || 0,
    actionInstanceId,
    attackerId: attacker?.id || null,
    defenderId: defender?.id || null,
    moveType,
    outcome: isParry ? "PARRIED" : isArmorBreak ? "ARMOR_BREAK" : "HIT",
    profileId,
    anchorType: anchor.anchorType,
    x: placed.x,
    y: placed.y,
    contactNormalX: nx,
    contactNormalY: ny,
    approachX: gsContact.approachX,
    approachY: gsContact.approachY,
    attackerFacing: sanitizeFacing(attacker?.facing, -1),
    orientationSource: orientation.source,
    facingHint: orientation.facingHint,
    fallback,
    contactAxis: CONTACT_AXIS.LATERAL,
    slapStage: moveType === GROUND_STRIKE_MOVE.SLAP ? stage : null,
    chargeTier:
      moveType === GROUND_STRIKE_MOVE.CHARGED ||
      moveType === GROUND_STRIKE_MOVE.PALM ||
      moveType === GROUND_STRIKE_MOVE.SHATTER_PALM
        ? chargeTierFromPercentage(chargePercentage)
        : null,
  };
}

const CLINCH_PROFILE_BY_INTERACTION = Object.freeze({
  [CLINCH_INTERACTION.GRAB_BREAK]: PRESENTATION_PROFILE.CLINCH_GRAB_BREAK,
  [CLINCH_INTERACTION.CLINCH_JOLT]: PRESENTATION_PROFILE.CLINCH_JOLT,
  [CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL]: PRESENTATION_PROFILE.CLINCH_JOLT_MUTUAL,
  [CLINCH_INTERACTION.COUNTER_GRAB]: PRESENTATION_PROFILE.CLINCH_COUNTER_GRAB,
  [CLINCH_INTERACTION.CLINCH_TECH]: PRESENTATION_PROFILE.CLINCH_TECH,
  [CLINCH_INTERACTION.CLINCH_TUMBLE]: PRESENTATION_PROFILE.CLINCH_TUMBLE,
  [CLINCH_INTERACTION.COUNTER_THROW_CALLOUT]:
    PRESENTATION_PROFILE.CLINCH_COUNTER_THROW_CALLOUT,
  [CLINCH_INTERACTION.THROW_FAIL]: PRESENTATION_PROFILE.CLINCH_THROW_FAIL,
  [CLINCH_INTERACTION.PERFECT_BRACE]: PRESENTATION_PROFILE.CLINCH_PERFECT_BRACE,
  [CLINCH_INTERACTION.DEEP_GRIP]: PRESENTATION_PROFILE.CLINCH_DEEP_GRIP,
  [CLINCH_INTERACTION.KILL_THROW_LAUNCH]:
    PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAUNCH,
  [CLINCH_INTERACTION.THROW_LAND]: PRESENTATION_PROFILE.CLINCH_THROW_LAND,
  [CLINCH_INTERACTION.KILL_THROW_LAND]:
    PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAND,
  [CLINCH_INTERACTION.GRAB_ARMOR_BREAK]:
    PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_BREAK,
  [CLINCH_INTERACTION.GRAB_ARMOR_ABSORB]:
    PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_ABSORB,
});

function selectClinchProfile(interactionType) {
  return (
    CLINCH_PROFILE_BY_INTERACTION[interactionType] ||
    PRESENTATION_PROFILE.CLINCH_GRAB_BREAK
  );
}

/** Mint / reuse a clinch instance id on both fighters (presentation-only). */
function ensureClinchInstanceId(a, b, nowSim = 0) {
  if (
    a &&
    b &&
    a.clinchInstanceId &&
    a.clinchInstanceId === b.clinchInstanceId
  ) {
    return a.clinchInstanceId;
  }
  const id = `clinch:${a?.id || "a"}:${b?.id || "b"}:${nowSim || 0}`;
  if (a) a.clinchInstanceId = id;
  if (b) b.clinchInstanceId = id;
  return id;
}

function clearClinchInstanceId(...fighters) {
  for (const f of fighters) {
    if (f) f.clinchInstanceId = null;
  }
}

/**
 * Discrete clinch / grab / throw presentation event.
 * Continuous Drive/Plant/strain FX intentionally omitted (state-owned).
 */
function buildClinchPresentation({
  interactionType,
  clinchInstanceId = null,
  actionInstanceId = null,
  initiator = null,
  responder = null,
  initiatorId = null,
  responderId = null,
  outcome = "RESOLVED",
  throwType = null,
  gripState = null,
  contactX = null,
  contactY = null,
  movementX = 0,
  movementY = 0,
  salt = "",
} = {}) {
  if (!interactionType || !CLINCH_PROFILE_BY_INTERACTION[interactionType]) {
    return null;
  }
  // Failed / defended throws must never select launch/land success profiles.
  if (
    (interactionType === CLINCH_INTERACTION.THROW_FAIL ||
      interactionType === CLINCH_INTERACTION.PERFECT_BRACE) &&
    (outcome === "LAUNCH" || outcome === "LAND" || outcome === "KILL_LAND")
  ) {
    outcome = "DEFENDED";
  }

  const profileId = selectClinchProfile(interactionType);
  const profile = getProfile(profileId);
  const initId = initiatorId || initiator?.id || null;
  const respId = responderId || responder?.id || null;
  const actionId =
    actionInstanceId ||
    `${interactionType}:${initId || "x"}:${respId || "y"}`;

  const isJolt =
    interactionType === CLINCH_INTERACTION.CLINCH_JOLT ||
    interactionType === CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL;
  const midY =
    interactionType === CLINCH_INTERACTION.THROW_LAND ||
    interactionType === CLINCH_INTERACTION.KILL_THROW_LAND
      ? GROUND_LEVEL
      : interactionType === CLINCH_INTERACTION.GRAB_ARMOR_BREAK
        ? GROUND_STRIKE_HIT_SPARK_Y
        : isJolt
          ? CLINCH_GRIP_CONTACT_Y
          : CLINCH_EFFECT_MID_Y;

  // Jolt core must sit on the shared seam — never bias toward initiator root.
  let seamContactX = contactX;
  if (
    isJolt &&
    initiator &&
    responder &&
    typeof initiator.x === "number" &&
    typeof responder.x === "number"
  ) {
    seamContactX = (initiator.x + responder.x) * 0.5;
  }

  const cx =
    typeof seamContactX === "number" && Number.isFinite(seamContactX)
      ? seamContactX
      : typeof contactX === "number" && Number.isFinite(contactX)
        ? contactX
        : null;
  const cy = isJolt
    ? CLINCH_GRIP_CONTACT_Y
    : typeof contactY === "number" && Number.isFinite(contactY)
      ? contactY
      : midY;

  const anchor = resolveAnchorPoint({
    contactX: cx,
    contactY: cy,
    attackerX: initiator?.x,
    attackerY: initiator?.y,
    defenderX: responder?.x,
    defenderY: responder?.y,
    preferredAnchor: profile?.primaryAnchor,
  });

  const isMutualJolt =
    interactionType === CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL;
  const nx = isMutualJolt
    ? 0
    : typeof movementX === "number" && movementX !== 0
      ? movementX > 0
        ? 1
        : -1
      : initiator && responder && typeof initiator.x === "number"
        ? responder.x >= initiator.x
          ? 1
          : -1
        : 0;
  const placed = applyLocalOffset(anchor, profile, nx);
  const orientation = resolveOrientation(profile, {
    contactNormalX: nx,
    contactNormalY: 0,
    approachX: isMutualJolt ? 0 : movementX || nx,
    approachY: movementY,
    movementX: isMutualJolt ? 0 : movementX || nx,
    movementY,
    attackerFacing: initiator?.facing,
  });

  return {
    eventId: mintEventId(
      `${clinchInstanceId || "clinch"}:${actionId}`,
      PRESENTATION_EVENT_TYPE.CLINCH,
      salt || interactionType
    ),
    eventType: PRESENTATION_EVENT_TYPE.CLINCH,
    serverTick: 0,
    actionInstanceId: actionId,
    clinchInstanceId: clinchInstanceId || null,
    interactionType,
    initiatorId: initId,
    responderId: respId,
    attackerId: initId,
    defenderId: respId,
    moveType: interactionType,
    outcome,
    throwType,
    gripState,
    profileId,
    anchorType: anchor.anchorType,
    x: placed.x,
    y: isJolt ? CLINCH_GRIP_CONTACT_Y : placed.y,
    contactNormalX: orientation.nx,
    contactNormalY: orientation.ny,
    approachX: isMutualJolt ? 0 : finite(movementX || nx, 0),
    approachY: finite(movementY, 0),
    attackerFacing: sanitizeFacing(initiator?.facing, -1),
    orientationSource: orientation.source,
    facingHint: orientation.facingHint,
    fallback: anchor.fallback,
    contactAxis: CONTACT_AXIS.LATERAL,
    particleSupplement: profile?.particleSupplement || null,
  };
}

/**
 * Discrete defensive presentation (Phase 9).
 * Guard block / projectile raw parry / Matador — existing assets only.
 * Attack parries already use GS_/OA_ profiles; annotate those separately.
 */
function buildDefensivePresentation({
  defenseType,
  defenseInstanceId = null,
  incomingActionInstanceId = null,
  attacker = null,
  defender = null,
  attackerId = null,
  defenderId = null,
  outcome = null,
  timingGrade = null,
  attackFamily = null,
  contactX = null,
  contactY = null,
  incomingDirection = 0,
  isPerfect = false,
  salt = "",
} = {}) {
  if (!defenseType) return null;

  let profileId = null;
  let resolvedOutcome = outcome;
  if (defenseType === DEFENSE_TYPE.GUARD_BLOCK) {
    profileId = PRESENTATION_PROFILE.DEF_BLOCK;
    resolvedOutcome = DEFENSE_OUTCOME.BLOCK;
  } else if (defenseType === DEFENSE_TYPE.PROJECTILE_PARRY) {
    profileId = PRESENTATION_PROFILE.DEF_RAW_PARRY;
    resolvedOutcome = isPerfect
      ? DEFENSE_OUTCOME.PERFECT_PARRY
      : DEFENSE_OUTCOME.RAW_PARRY;
  } else if (defenseType === DEFENSE_TYPE.MATADOR) {
    profileId = PRESENTATION_PROFILE.DEF_MATADOR;
    resolvedOutcome = DEFENSE_OUTCOME.MATADOR;
  } else if (defenseType === DEFENSE_TYPE.GRAB_ARMOR_ABSORB) {
    // Reuse Phase 8 absorb profile — same pink wrap-ring particle path.
    return buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.GRAB_ARMOR_ABSORB,
      actionInstanceId: defenseInstanceId || incomingActionInstanceId,
      initiator: attacker,
      responder: defender,
      initiatorId: attackerId,
      responderId: defenderId,
      outcome: DEFENSE_OUTCOME.ABSORB,
      contactX,
      contactY,
      salt: salt || "def-absorb",
    });
  } else {
    return null;
  }

  const profile = getProfile(profileId);
  if (!profile) return null;

  const atkId = attackerId || attacker?.id || null;
  const defId = defenderId || defender?.id || null;
  const defenseId =
    defenseInstanceId ||
    `${defenseType}:${defId || "d"}:${atkId || "a"}:${salt || "0"}`;
  const grade =
    timingGrade != null
      ? timingGrade
      : isPerfect
        ? "perfect"
        : resolvedOutcome === DEFENSE_OUTCOME.BLOCK
          ? "block"
          : "regular";

  // Authored spark heights / projectile front placement.
  let cx = contactX;
  let cy = contactY;
  /** World dir from parrier toward the incoming projectile/thrower (+1 right). */
  let towardIncoming = 0;
  if (defenseType === DEFENSE_TYPE.GUARD_BLOCK) {
    cy = GROUND_STRIKE_HIT_SPARK_Y;
    if (!(typeof cx === "number" && Number.isFinite(cx))) {
      if (
        attacker &&
        defender &&
        typeof attacker.x === "number" &&
        typeof defender.x === "number"
      ) {
        cx = (attacker.x + defender.x) * 0.5;
      } else {
        cx = finite(defender?.x, 640);
      }
    }
  } else if (defenseType === DEFENSE_TYPE.PROJECTILE_PARRY) {
    // Place on the INCOMING side of the parrier (toward thrower / projectile).
    // The old `parrierX + 150 + facingNudge` always biased bursts to +X.
    const parrierX = finite(defender?.x, 640);
    const atkX = finite(attacker?.x, parrierX);
    towardIncoming =
      typeof incomingDirection === "number" && incomingDirection !== 0
        ? incomingDirection > 0
          ? 1
          : -1
        : atkX < parrierX
          ? -1
          : 1;
    const RAW_PARRY_FRONT_PX = 55;
    cx =
      typeof contactX === "number" && Number.isFinite(contactX)
        ? contactX
        : parrierX + towardIncoming * RAW_PARRY_FRONT_PX;
    cy = GROUND_STRIKE_HIT_SPARK_Y;
  } else if (defenseType === DEFENSE_TYPE.MATADOR) {
    if (
      !(typeof cx === "number" && Number.isFinite(cx)) &&
      attacker &&
      defender
    ) {
      cx = (finite(attacker.x, 0) + finite(defender.x, 0)) * 0.5;
    }
    if (!(typeof cy === "number" && Number.isFinite(cy))) {
      cy = CLINCH_EFFECT_MID_Y;
    }
  }

  const incoming =
    towardIncoming !== 0
      ? towardIncoming
      : typeof incomingDirection === "number" && incomingDirection !== 0
        ? incomingDirection > 0
          ? 1
          : -1
        : attacker && defender && typeof attacker.x === "number"
          ? defender.x >= attacker.x
            ? 1
            : -1
          : sanitizeFacing(attacker?.facing, -1) === -1
            ? 1
            : -1;

  // RawParryEffect: facing 1 = look left. Align with incoming side so CSS
  // front% / tilt put the burst in front of the parrier.
  const projectileEffectFacing =
    defenseType === DEFENSE_TYPE.PROJECTILE_PARRY
      ? incoming < 0
        ? 1
        : -1
      : sanitizeFacing(attacker?.facing, -1);

  const anchor = resolveAnchorPoint({
    contactX: cx,
    contactY: cy,
    attackerX: attacker?.x,
    attackerY: attacker?.y,
    defenderX: defender?.x,
    defenderY: defender?.y,
    preferredAnchor: profile.primaryAnchor,
  });
  const placed = applyLocalOffset(anchor, profile, incoming);
  const orientation = resolveOrientation(profile, {
    contactNormalX: incoming,
    contactNormalY: 0,
    approachX: incoming,
    approachY: 0,
    movementX: incoming,
    movementY: 0,
    attackerFacing: projectileEffectFacing,
  });

  return {
    eventId: mintEventId(
      defenseId,
      PRESENTATION_EVENT_TYPE.DEFENSE,
      salt || defenseType
    ),
    eventType: PRESENTATION_EVENT_TYPE.DEFENSE,
    serverTick: 0,
    actionInstanceId: defenseId,
    defenseInstanceId: defenseId,
    incomingActionInstanceId: incomingActionInstanceId || null,
    attackerId: atkId,
    defenderId: defId,
    defenseType,
    outcome: resolvedOutcome,
    timingGrade: grade,
    attackFamily: attackFamily || null,
    moveType: defenseType,
    profileId,
    anchorType: anchor.anchorType,
    x: placed.x,
    y:
      defenseType === DEFENSE_TYPE.GUARD_BLOCK ||
      defenseType === DEFENSE_TYPE.PROJECTILE_PARRY
        ? GROUND_STRIKE_HIT_SPARK_Y
        : placed.y,
    contactNormalX: orientation.nx,
    contactNormalY: orientation.ny,
    approachX: incoming,
    approachY: 0,
    attackerFacing: projectileEffectFacing,
    orientationSource: orientation.source,
    facingHint:
      defenseType === DEFENSE_TYPE.PROJECTILE_PARRY
        ? projectileEffectFacing
        : orientation.facingHint,
    fallback: anchor.fallback,
    contactAxis: CONTACT_AXIS.LATERAL,
    screenSpaceCallout: !!profile.screenSpaceCallout,
  };
}

/**
 * Discrete projectile lifecycle presentation (Phase 10).
 * Snowball hit is the only projectile-owned impact FX today.
 * Parry / absorb continue to use DEFENSE builders (shared assets).
 * Travel remains entity/state-owned — never call this every tick.
 */
function buildProjectilePresentation({
  projectileType,
  lifecycleStage,
  projectileInstanceId = null,
  ownerId = null,
  targetId = null,
  outcome = null,
  contactX = null,
  contactY = null,
  approachDirection = 0,
  terminalX = null,
  terminalY = null,
  attackerFacing = null,
  salt = "",
} = {}) {
  if (!projectileType || !lifecycleStage) return null;
  if (!projectileInstanceId) return null;

  let profileId = null;
  let resolvedOutcome = outcome;
  if (
    projectileType === PROJECTILE_TYPE.SNOWBALL &&
    lifecycleStage === PROJECTILE_LIFECYCLE.HIT
  ) {
    profileId = PRESENTATION_PROFILE.PROJ_SNOWBALL_HIT;
    resolvedOutcome = PROJECTILE_OUTCOME.HIT;
  } else {
    // No authored discrete FX for other stages / pumo hits — stay null.
    return null;
  }

  const profile = getProfile(profileId);
  if (!profile) return null;

  const approach =
    typeof approachDirection === "number" && approachDirection !== 0
      ? approachDirection > 0
        ? 1
        : -1
      : 1;

  // Preserve prior chest-height registration (legacy client used victim.y + 50).
  // World X pins to projectile contact — fixes always-+70 player-root bias.
  const cx =
    typeof contactX === "number" && Number.isFinite(contactX)
      ? contactX
      : typeof terminalX === "number" && Number.isFinite(terminalX)
        ? terminalX
        : 640;
  const cy =
    typeof contactY === "number" && Number.isFinite(contactY)
      ? contactY
      : typeof terminalY === "number" && Number.isFinite(terminalY)
        ? terminalY
        : GROUND_STRIKE_HIT_SPARK_Y;

  const effectFacing =
    attackerFacing === 1 || attackerFacing === -1
      ? attackerFacing
      : approach < 0
        ? 1
        : -1;

  const actionInstanceId = `${projectileInstanceId}:${lifecycleStage}`;
  const anchor = resolveAnchorPoint({
    contactX: cx,
    contactY: cy,
    preferredAnchor: profile.primaryAnchor,
  });
  const placed = applyLocalOffset(anchor, profile, approach);
  const orientation = resolveOrientation(profile, {
    contactNormalX: approach,
    contactNormalY: 0,
    approachX: approach,
    approachY: 0,
    movementX: approach,
    movementY: 0,
    attackerFacing: effectFacing,
  });

  return {
    eventId: mintEventId(
      actionInstanceId,
      PRESENTATION_EVENT_TYPE.PROJECTILE,
      salt || lifecycleStage
    ),
    eventType: PRESENTATION_EVENT_TYPE.PROJECTILE,
    serverTick: 0,
    actionInstanceId,
    projectileInstanceId,
    projectileType,
    ownerId: ownerId || null,
    targetId: targetId || null,
    lifecycleStage,
    outcome: resolvedOutcome,
    moveType: projectileType,
    profileId,
    anchorType: anchor.anchorType,
    x: placed.x,
    y: placed.y,
    contactNormalX: orientation.nx,
    contactNormalY: orientation.ny,
    approachX: approach,
    approachY: 0,
    attackerFacing: effectFacing,
    orientationSource: orientation.source,
    facingHint: effectFacing,
    fallback: anchor.fallback,
    contactAxis: CONTACT_AXIS.LATERAL,
    terminalX:
      typeof terminalX === "number" && Number.isFinite(terminalX)
        ? terminalX
        : placed.x,
    terminalY:
      typeof terminalY === "number" && Number.isFinite(terminalY)
        ? terminalY
        : placed.y,
  };
}

/** Annotate an existing GS/OA parry event with Phase 9 defense metadata. */
function annotateAttackParryDefense(event, { isPerfect = false, defenseInstanceId = null } = {}) {
  if (!event) return null;
  const perfect = !!isPerfect;
  event.defenseType = DEFENSE_TYPE.ATTACK_PARRY;
  event.defenseInstanceId =
    defenseInstanceId || event.actionInstanceId || event.eventId;
  event.incomingActionInstanceId =
    event.incomingActionInstanceId || event.actionInstanceId || null;
  event.timingGrade = perfect ? "perfect" : "regular";
  if (
    event.outcome === "PARRIED" ||
    event.outcome === DEFENSE_OUTCOME.PARRY ||
    !event.outcome
  ) {
    event.outcome = perfect
      ? DEFENSE_OUTCOME.PERFECT_PARRY
      : DEFENSE_OUTCOME.PARRY;
  }
  return event;
}

/** Attach compact presentation onto an existing socket payload. */
function attachCombatPresentation(payload, event) {
  if (!payload || !event) return payload;
  const compact = {
    eventId: event.eventId,
    eventType: event.eventType,
    actionInstanceId: event.actionInstanceId,
    profileId: event.profileId,
    moveType: event.moveType,
    outcome: event.outcome,
    anchorType: event.anchorType,
    x: event.x,
    y: event.y,
    nx: event.contactNormalX,
    ny: event.contactNormalY,
    ax: event.approachX,
    ay: event.approachY,
    facing: event.attackerFacing,
    facingHint: event.facingHint,
    orientationSource: event.orientationSource,
    fallback: event.fallback,
    contactAxis: event.contactAxis,
  };
  // Identity metadata already used by existing gameplay / presentation paths —
  // not debug-only (slap stage / charge tier select nothing new visually).
  if (event.slapStage != null) compact.slapStage = event.slapStage;
  if (event.chargeTier != null) compact.chargeTier = event.chargeTier;
  if (event.clinchInstanceId != null) {
    compact.clinchInstanceId = event.clinchInstanceId;
  }
  if (event.interactionType != null) {
    compact.interactionType = event.interactionType;
  }
  if (event.initiatorId != null) compact.initiatorId = event.initiatorId;
  if (event.responderId != null) compact.responderId = event.responderId;
  if (event.throwType != null) compact.throwType = event.throwType;
  if (event.gripState != null) compact.gripState = event.gripState;
  // Phase 9 defense identity / diagnostics.
  if (event.defenseInstanceId != null) {
    compact.defenseInstanceId = event.defenseInstanceId;
  }
  if (event.incomingActionInstanceId != null) {
    compact.incomingActionInstanceId = event.incomingActionInstanceId;
  }
  if (event.defenseType != null) compact.defenseType = event.defenseType;
  if (event.timingGrade != null) compact.timingGrade = event.timingGrade;
  if (event.attackFamily != null) compact.attackFamily = event.attackFamily;
  if (event.attackerId != null) compact.attackerId = event.attackerId;
  if (event.defenderId != null) compact.defenderId = event.defenderId;
  if (event.screenSpaceCallout != null) {
    compact.screenSpaceCallout = event.screenSpaceCallout;
  }
  // Phase 10 projectile identity / lifecycle diagnostics.
  if (event.projectileInstanceId != null) {
    compact.projectileInstanceId = event.projectileInstanceId;
  }
  if (event.projectileType != null) compact.projectileType = event.projectileType;
  if (event.lifecycleStage != null) compact.lifecycleStage = event.lifecycleStage;
  if (event.ownerId != null) compact.ownerId = event.ownerId;
  if (event.targetId != null) compact.targetId = event.targetId;
  if (event.terminalX != null) compact.terminalX = event.terminalX;
  if (event.terminalY != null) compact.terminalY = event.terminalY;
  payload.combatPresentation = compact;
  return payload;
}

module.exports = {
  PRESENTATION_EVENT_TYPE,
  PRESENTATION_ANCHOR,
  PRESENTATION_PROFILE,
  ORIENTATION_RULE,
  FALLBACK_LEVEL,
  DEFENSE_OUTCOME,
  DEFENSE_TYPE,
  PROJECTILE_TYPE,
  PROJECTILE_LIFECYCLE,
  PROJECTILE_OUTCOME,
  GROUND_STRIKE_MOVE,
  GROUND_STRIKE_HIT_SPARK_Y,
  GROUND_STRIKE_PARRY_SPARK_Y,
  CLINCH_EFFECT_MID_Y,
  CLINCH_GRIP_CONTACT_Y,
  CLINCH_INTERACTION,
  PROFILES,
  getProfile,
  selectHitProfile,
  selectParryProfile,
  selectTouchdownProfile,
  selectGroundStrikeHitProfile,
  selectGroundStrikeParryProfile,
  selectClinchProfile,
  classifyGroundStrikeMove,
  chargeTierFromPercentage,
  resolveGroundStrikeContactMeta,
  resolveAnchorPoint,
  applyLocalOffset,
  resolveOrientation,
  mintEventId,
  ensureClinchInstanceId,
  clearClinchInstanceId,
  buildOffensiveAerialContactPresentation,
  buildOffensiveAerialTouchdownPresentation,
  buildGroundStrikeContactPresentation,
  buildClinchPresentation,
  buildDefensivePresentation,
  buildProjectilePresentation,
  annotateAttackParryDefense,
  attachCombatPresentation,
  finite,
};

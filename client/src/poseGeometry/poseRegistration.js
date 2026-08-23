/**
 * Phase 11 — Character pose geometry registration (presentation-only).
 * ESM copy for Vite/browser. CJS twin: server-io/poseRegistration.js (tests).
 * Keep registrations in sync when editing.
 *
 * Feature flag: FIGHTER_POSE_GEOMETRY_V2 — manually approved; default ON.
 * Rollback: FIGHTER_POSE_GEOMETRY_V2=0
 * See CHARACTER_POSE_GEOMETRY_PHASE.md
 */

export const DESIGN_W = 1280;
export const DESIGN_H = 720;
export const DISPLAY_WIDTH_FRAC = 0.123;
/** Square fighter CSS box world size (matches 12.30% of 1280). */
export const SPRITE_WORLD_SIZE = DESIGN_W * DISPLAY_WIDTH_FRAC;
/**
 * Legacy sole convention — painted feet sit ~2.1% above the CSS box bottom.
 * Matches FIGHTER_SOLE_TRANSFORM_ORIGIN / ICE_REFLECTION_FOOT_NUDGE_PCT.
 */
export const LEGACY_SOLE_FROM_BOTTOM_PCT = 0.021;

export const MIRROR_RULE = Object.freeze({
  /** Art authored facing left; facing===1 unflipped, else scaleX(-1). */
  SCALE_X_ART_LEFT: "SCALE_X_ART_LEFT",
});

/**
 * Animation-level registration (not per-frame alpha).
 * Normalized fractions are relative to the source canvas / CSS box.
 *
 * supportFromBottomPct — grounded only; null = no Y correction (legacy).
 * visualOffsetX — canvas-local (+ toward image right); mirrored by facing.
 * grounded — default classification; runtime airborneHint overrides.
 * legacyCssOwns — existing ad-hoc CSS (e.g. kill-landing translateY) owns pose.
 */
export const POSE_REGISTRY = Object.freeze({
  // ── Neutral / grounded (sole band OK — no Y correction) ─────────────
  idle: Object.freeze({
    asset: "pumo-idle.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  ready: Object.freeze({
    asset: "pumo-ready-position.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  tachiai: Object.freeze({
    asset: "pumo-tachiai-position.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  waddle: Object.freeze({
    asset: "pumo-waddle.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  crouch: Object.freeze({
    asset: "crouch-stance.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  bow: Object.freeze({
    asset: "bow.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),

  // ── Defense ────────────────────────────────────────────────────────
  blocking: Object.freeze({
    asset: "blocking.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  block_parry: Object.freeze({
    asset: "block-parry.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  raw_parry_success: Object.freeze({
    asset: "raw-parry-success.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  raw_parry_success_f1: Object.freeze({
    asset: "raw-parry-success-frame-1.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  raw_parry_success_f2: Object.freeze({
    asset: "raw-parry-success-frame-2.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),

  // ── Strikes ────────────────────────────────────────────────────────
  slap_blur_1: Object.freeze({
    asset: "slap-attack-1-blur-frame.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  slap_hit_1: Object.freeze({
    asset: "slap-attack-1-hit-frame.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  slap_blur_2: Object.freeze({
    asset: "slap-attack-2-blur-frame.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  slap_hit_2: Object.freeze({
    asset: "slap-attack-2-hit-frame.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  // Placeholder convert art — 1254² canvas, more sole pad than the 960 set.
  // displayScale matches slap-hit body height; support plants the feet.
  belly_bump: Object.freeze({
    asset: "belly-bump.png",
    grounded: true,
    supportFromBottomPct: 0.136,
    displayScale: 1.17,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  palm_startup: Object.freeze({
    asset: "palm-thrust-startup.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  palm_smear: Object.freeze({
    asset: "palm-thrust-smear.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  palm: Object.freeze({
    asset: "palm-thrust.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  charging: Object.freeze({
    asset: "charging.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  /**
   * Charged flying headbutt (attack.png) — intentionally airborne.
   * Transparent pad / elevated feet are flight art, NOT a sole-float defect.
   * No ground-baseline correction. Legacy vertical placement preserved.
   */
  charged_attack: Object.freeze({
    asset: "attack.png",
    grounded: false,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    visualOffsetY: 0,
    pivotX: 0.5,
    pivotY: 0.45,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
    notes: "Flying headbutt — intentional separation from ground",
  }),
  recovering: Object.freeze({
    asset: "recovering.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),

  // ── Movement ───────────────────────────────────────────────────────
  sliding: Object.freeze({
    asset: "sliding.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  /** Dodge lean — typically airborne; never ground-snapped. */
  dodging: Object.freeze({
    asset: "dodging.png",
    grounded: false,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    visualOffsetY: 0,
    pivotX: 0.5,
    pivotY: 0.45,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  flap_1: Object.freeze({
    asset: "pumo-flap-1.png",
    grounded: false,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    visualOffsetY: 0,
    pivotX: 0.5,
    pivotY: 0.45,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  flap_2: Object.freeze({
    asset: "pumo-flap-2.png",
    grounded: false,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    visualOffsetY: 0,
    pivotX: 0.5,
    pivotY: 0.45,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),

  // ── Clinch / throw ─────────────────────────────────────────────────
  grabbing: Object.freeze({
    asset: "grabbing.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  clinch_planting: Object.freeze({
    asset: "clinch-planting.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  grab_attempt: Object.freeze({
    asset: "grab-attempt.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  attempting_grab_throw: Object.freeze({
    asset: "attempting-grab-throw.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  attempting_pull: Object.freeze({
    asset: "is-attempting-pull.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  throwing: Object.freeze({
    asset: "throwing.png",
    grounded: false,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    visualOffsetY: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  }),
  /** Legacy CSS translateY(10%) owns vertical registration. */
  kill_throw_landing: Object.freeze({
    asset: "cinematic-throw-kill-landing.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
    legacyCssOwns: true,
  }),

  // ── Reaction ───────────────────────────────────────────────────────
  hit: Object.freeze({
    asset: "hit.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
    missingArtRisk: "480px placeholder canvas",
  }),
  at_the_ropes: Object.freeze({
    asset: "at-the-ropes.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
    missingArtRisk: "480px placeholder + strong H bias",
  }),
  kick: Object.freeze({
    asset: "kick.png",
    grounded: true,
    supportFromBottomPct: null,
    visualOffsetX: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
    disabledGameplay: true,
  }),
});

/** Filename stem → pose key */
export const ASSET_TO_POSE = Object.freeze(
  Object.fromEntries(
    Object.entries(POSE_REGISTRY).map(([key, reg]) => [reg.asset, key])
  )
);

const DEFAULT_REG = Object.freeze({
  asset: null,
  grounded: true,
  supportFromBottomPct: null,
  visualOffsetX: 0,
  visualOffsetY: 0,
  pivotX: 0.5,
  pivotY: 0.5,
  mirrorRule: MIRROR_RULE.SCALE_X_ART_LEFT,
  fallback: true,
});

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function sanitizeFacing(facing, fallback = -1) {
  return facing === 1 || facing === -1 ? facing : fallback;
}

/** Parse pose key from a resolved sprite URL or filename. */
export function poseKeyFromSrc(src) {
  if (!src || typeof src !== "string") return "idle";
  const file = src.split("/").pop().split("?")[0];
  if (ASSET_TO_POSE[file]) return ASSET_TO_POSE[file];
  // Bald / composite URLs still contain the stem.
  for (const [asset, key] of Object.entries(ASSET_TO_POSE)) {
    if (file.includes(asset.replace(/\.png$/i, ""))) return key;
  }
  return "idle";
}

/**
 * Prefer authoritative presentation state over filename when phases share art
 * or when flight vs grounded recovery must not be confused.
 * @param {string|null|undefined} presentationState
 * @returns {string|null} pose key or null to fall through to src
 */
export function poseKeyFromPresentationState(presentationState) {
  if (!presentationState || typeof presentationState !== "string") return null;
  switch (presentationState) {
    case "charging":
    case "charge_hold":
      return "charging";
    case "charged_flight":
    case "charged_attack":
    case "flying_headbutt":
      return "charged_attack";
    case "recovering":
    case "charged_recovery":
      return "recovering";
    default:
      return POSE_REGISTRY[presentationState] ? presentationState : null;
  }
}

export function getPoseRegistration(poseKey) {
  return POSE_REGISTRY[poseKey] || DEFAULT_REG;
}

export function listPoseKeys() {
  return Object.keys(POSE_REGISTRY);
}

/**
 * Resolve presentation placement from gameplay root.
 * @param {object} opts
 * @param {string} [opts.poseKey]
 * @param {string} [opts.src] — sprite URL; used if poseKey omitted
 * @param {number} opts.gameplayX
 * @param {number} opts.gameplayY
 * @param {number} [opts.facing]
 * @param {boolean|null} [opts.airborneHint] — true/false overrides registry grounded
 * @param {boolean} [opts.v2Enabled]
 */
export function resolvePoseRender(opts = {}) {
  const v2 = !!opts.v2Enabled;
  const poseKey =
    opts.poseKey ||
    poseKeyFromPresentationState(opts.presentationState) ||
    poseKeyFromSrc(opts.src);
  const reg = getPoseRegistration(poseKey);
  const gameplayX = finite(opts.gameplayX, 640);
  const gameplayY = finite(opts.gameplayY, 286);
  const facing = sanitizeFacing(opts.facing, -1);
  // Registry airborne poses (e.g. flying headbutt) stay airborne even when
  // gameplay Y is at ground level. airborneHint===true forces airborne;
  // otherwise trust the pose registration.
  const grounded =
    opts.airborneHint === true ? false : !!reg.grounded;

  if (!v2 || reg.legacyCssOwns) {
    return {
      poseKey,
      v2: false,
      fallback: !!reg.fallback || !POSE_REGISTRY[poseKey],
      grounded,
      gameplayX,
      gameplayY,
      renderX: gameplayX,
      renderY: gameplayY,
      appliedOffsetX: 0,
      appliedOffsetY: 0,
      displayScale: 1,
      soleFromBottomPct: LEGACY_SOLE_FROM_BOTTOM_PCT,
      pivotX: finite(reg.pivotX, 0.5),
      pivotY: finite(reg.pivotY, 0.5),
      supportX: finite(reg.pivotX, 0.5),
      supportY: LEGACY_SOLE_FROM_BOTTOM_PCT,
      mirrorRule: reg.mirrorRule || MIRROR_RULE.SCALE_X_ART_LEFT,
      accessoryAnchorX: finite(reg.pivotX, 0.5),
      accessoryAnchorY: finite(reg.pivotY, 0.5),
      registration: reg,
    };
  }

  let appliedOffsetY = 0;
  let soleFromBottomPct = LEGACY_SOLE_FROM_BOTTOM_PCT;

  if (grounded && typeof reg.supportFromBottomPct === "number") {
    soleFromBottomPct = reg.supportFromBottomPct;
    // Positive pad above target → feet float → lower the CSS box.
    const boxScale = finite(reg.displayScale, 1) || 1;
    appliedOffsetY =
      -(soleFromBottomPct - LEGACY_SOLE_FROM_BOTTOM_PCT) *
      SPRITE_WORLD_SIZE *
      boxScale;
  } else if (!grounded) {
    appliedOffsetY = finite(reg.visualOffsetY, 0);
    soleFromBottomPct = LEGACY_SOLE_FROM_BOTTOM_PCT;
  }

  // visualOffsetX is canvas-local (+X = image right). Facing 1 = art native
  // (look left); facing -1 mirrors, so local +X flips in world.
  const mirrorSign = facing === 1 ? 1 : -1;
  const appliedOffsetX = finite(reg.visualOffsetX, 0) * mirrorSign;

  const renderX = gameplayX + appliedOffsetX;
  const renderY = gameplayY + appliedOffsetY;

  return {
    poseKey,
    v2: true,
    fallback: !!reg.fallback || !POSE_REGISTRY[poseKey],
    grounded,
    gameplayX,
    gameplayY,
    renderX,
    renderY,
    appliedOffsetX,
    appliedOffsetY,
    displayScale: finite(reg.displayScale, 1) || 1,
    soleFromBottomPct,
    pivotX: finite(reg.pivotX, 0.5),
    pivotY: finite(reg.pivotY, 0.5),
    supportX: finite(reg.supportX, reg.pivotX ?? 0.5),
    supportY: grounded ? soleFromBottomPct : finite(reg.pivotY, 0.5),
    mirrorRule: reg.mirrorRule || MIRROR_RULE.SCALE_X_ART_LEFT,
    accessoryAnchorX: finite(reg.accessoryAnchorX, reg.pivotX ?? 0.5),
    accessoryAnchorY: finite(reg.accessoryAnchorY, reg.pivotY ?? 0.5),
    registration: reg,
  };
}

/** World-space unwanted pop between two poses at identical gameplay coords. */
export function measurePoseTransitionPop(fromKey, toKey, facing = -1) {
  const a = resolvePoseRender({
    poseKey: fromKey,
    gameplayX: 640,
    gameplayY: 286,
    facing,
    v2Enabled: true,
  });
  const b = resolvePoseRender({
    poseKey: toKey,
    gameplayX: 640,
    gameplayY: 286,
    facing,
    v2Enabled: true,
  });
  return {
    fromKey,
    toKey,
    dx: b.renderX - a.renderX,
    dy: b.renderY - a.renderY,
    absDx: Math.abs(b.renderX - a.renderX),
    absDy: Math.abs(b.renderY - a.renderY),
  };
}

/** Bounded transition-pop diagnostic ring (debug only). */
export function createPoseTransitionDiagStore(max = 32) {
  const items = [];
  return {
    note(entry) {
      items.push({ ...entry, t: Date.now() });
      while (items.length > max) items.shift();
    },
    clear() {
      items.length = 0;
    },
    list() {
      return items.slice();
    },
    size() {
      return items.length;
    },
  };
}


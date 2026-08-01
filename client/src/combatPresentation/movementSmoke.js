/**
 * Grounded dodge / ice-slide smoke presentation ownership (Phase 8B).
 *
 * Smoke represents an accepted grounded movement transition — never raw Shift,
 * never airborne FLAP / slide-jump / S-dive / parried recoil.
 *
 * World Y for smoke is always server GROUND_LEVEL (286), never airborne player Y.
 * Orientation uses accepted movement direction, not character facing.
 */

import {
  claimPresentationEvent,
  clearPresentationEvents,
} from "./dedupe";

/** Must match server-io/constants.js GROUND_LEVEL / PlayerShadow SHADOW_GROUND_LEVEL. */
export const MOVEMENT_SMOKE_GROUND_Y = 286;

/**
 * dash-smoke-effect.png has transparent padding under the visible white plume.
 * Fixed GAME-space canvas-Y nudge (positive = downward toward the ice) applied
 * in ParticleEngine.spawnDashSmoke for raw dodge dashStart. Slide-redirect
 * keeps applySheetBaseline: false (pre-nudge registration). Does not change
 * GROUND_LEVEL or gameplay anchors.
 */
export const DASH_SMOKE_SHEET_BASELINE_Y = 10;

export const MOVEMENT_SMOKE_TRANSITION = Object.freeze({
  DODGE_START: "DODGE_START",
  SLIDE_START: "SLIDE_START",
  SLIDE_REDIRECT: "SLIDE_REDIRECT",
});

/** ParticleEngine preset names — redirect is its own tighter emitter. */
export const MOVEMENT_SMOKE_EMITTER = Object.freeze({
  [MOVEMENT_SMOKE_TRANSITION.DODGE_START]: "dashStart",
  [MOVEMENT_SMOKE_TRANSITION.SLIDE_START]: "iceSlideStart",
  [MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT]: "iceSlideRedirect",
});

/**
 * Authored SLIDE_REDIRECT visual mass vs dodge dashStart (~60%).
 * Same dash-smoke swoosh sheet; tighter scale + shorter life.
 */
export const SLIDE_REDIRECT_SMOKE_PROFILE = Object.freeze({
  emitter: "iceSlideRedirect",
  baseEmitter: "dashStart",
  sheet: "dash-smoke-effect",
  // Redirect keeps pre-baseline registration; dodge uses DASH_SMOKE_SHEET_BASELINE_Y.
  sheetBaselineY: 0,
  visualMassTarget: "0.55–0.65 of dashStart",
  scale: 0.6,
  alpha: 0.85,
  maxLife: 0.26,
  // dashStart baselines
  dashScale: 1,
  dashAlpha: 0.9,
  dashMaxLife: 0.42,
});

export function movementSmokeEmitterName(transitionType) {
  return MOVEMENT_SMOKE_EMITTER[transitionType] || null;
}

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** +1 right / -1 left from accepted travel direction (not facing). */
export function normalizeMoveDir(dir, fallback = 1) {
  if (typeof dir === "number" && dir !== 0 && Number.isFinite(dir)) {
    return dir > 0 ? 1 : -1;
  }
  return fallback > 0 ? 1 : -1;
}

/** True when iceSlideDir sign flipped while already ice-sliding (accepted redirect). */
export function isSlideRedirectDirFlip(prevFighter, nextFighter) {
  if (!prevFighter || !nextFighter) return false;
  const prevSliding =
    !!prevFighter.isIceSliding &&
    !prevFighter.isDodging &&
    !prevFighter.isSlideJumping;
  const nextSliding =
    !!nextFighter.isIceSliding &&
    !nextFighter.isDodging &&
    !nextFighter.isSlideJumping;
  if (!prevSliding || !nextSliding) return false;
  if (
    !(typeof prevFighter.iceSlideDir === "number" && prevFighter.iceSlideDir !== 0) ||
    !(typeof nextFighter.iceSlideDir === "number" && nextFighter.iceSlideDir !== 0)
  ) {
    return false;
  }
  return Math.sign(prevFighter.iceSlideDir) !== Math.sign(nextFighter.iceSlideDir);
}

/**
 * True when local/server fighter state is airborne for movement-smoke purposes.
 * Mirrors server canPlayerDash aerial gates (presentation-only).
 */
export function isAirborneForMovementSmoke(fighter) {
  if (!fighter) return true;
  if (fighter.isRopeJumping) return true;
  if (fighter.isFlapping) return true;
  if (fighter.isSlideJumping) return true;
  if (fighter.slideJumpDiveCommitted) return true;
  if (fighter.slideJumpFastFalling) return true;
  // Parried aerial recoil — vulnerable flight, still not grounded dodge.
  const reaction =
    fighter.offensiveAerial?.reactionType ||
    fighter.offensiveAerialReactionType ||
    "";
  if (
    String(reaction).toLowerCase() === "parried_recoil" ||
    String(reaction) === "PARRIED_RECOIL"
  ) {
    return true;
  }
  // Ice-slide bunny-hop reverse is a grounded redirect arc (peak ~16px).
  // Do not treat that intentional Y lift as flight — otherwise SLIDE_REDIRECT
  // smoke is blocked for nearly the entire hop window.
  if (fighter.isIceSlideReverseHopping) {
    return false;
  }
  if (
    typeof fighter.y === "number" &&
    Number.isFinite(fighter.y) &&
    fighter.y > MOVEMENT_SMOKE_GROUND_Y + 8
  ) {
    return true;
  }
  return false;
}

export function mintMovementSmokeEventId({
  fighterId,
  transitionType,
  moveDir,
  worldX,
  sequence = "",
}) {
  const dir = normalizeMoveDir(moveDir, 1);
  const x = Math.round(finite(worldX, 0));
  const seq = sequence !== "" && sequence != null ? String(sequence) : "";
  return `move-smoke:${fighterId || "f"}:${transitionType}:${dir}:${x}${
    seq ? `:${seq}` : ""
  }`;
}

/**
 * Claim once. Returns placement payload if this is the first observation,
 * otherwise null (duplicate / confirm after predict).
 */
export function claimMovementSmoke(meta = {}) {
  const {
    fighterId,
    transitionType,
    moveDir,
    worldX,
    sequence = "",
  } = meta;
  if (!transitionType) return null;
  if (
    transitionType !== MOVEMENT_SMOKE_TRANSITION.DODGE_START &&
    transitionType !== MOVEMENT_SMOKE_TRANSITION.SLIDE_START &&
    transitionType !== MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT
  ) {
    return null;
  }
  const dir = normalizeMoveDir(moveDir, 1);
  const x = finite(worldX, 0);
  const eventId = mintMovementSmokeEventId({
    fighterId,
    transitionType,
    moveDir: dir,
    worldX: x,
    sequence,
  });
  if (!claimPresentationEvent(eventId)) {
    return null;
  }
  return {
    eventId,
    transitionType,
    fighterId: fighterId || null,
    x,
    y: MOVEMENT_SMOKE_GROUND_Y,
    direction: dir,
    // Facing is ignored for orientation — kept for emitters that still accept it.
    facing: dir,
  };
}

export function clearMovementSmokeDedupe() {
  clearPresentationEvents();
}

/** Shared behind-movement registration (world X nudge unused — emitter owns bias). */
export function movementSmokeEmitArgs(placement) {
  if (!placement) return null;
  const args = {
    x: placement.x,
    y: MOVEMENT_SMOKE_GROUND_Y,
    direction: placement.direction,
    // Orientation uses movement dir — never character facing.
    facing: placement.direction,
  };
  if (placement.transitionType === MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT) {
    args.variant = "redirect";
  }
  return args;
}

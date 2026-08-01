"use strict";

/**
 * Grounded dodge / ice-slide smoke presentation rules (Phase 8B).
 * Client runtime lives in client/src/combatPresentation/movementSmoke.js —
 * keep these helpers in sync for focused tests / server-side identity.
 */

const { GROUND_LEVEL } = require("./constants");

const MOVEMENT_SMOKE_GROUND_Y = GROUND_LEVEL; // 286

/**
 * dash-smoke-effect.png transparent bottom pad — GAME-space canvas-Y downward
 * nudge. Keep in sync with client/src/combatPresentation/movementSmoke.js.
 * Applied via spawnDashSmoke for raw dodge; slide-redirect opts out.
 */
const DASH_SMOKE_SHEET_BASELINE_Y = 10;

const MOVEMENT_SMOKE_TRANSITION = Object.freeze({
  DODGE_START: "DODGE_START",
  SLIDE_START: "SLIDE_START",
  SLIDE_REDIRECT: "SLIDE_REDIRECT",
});

/** Client ParticleEngine preset names — keep in sync with movementSmoke.js. */
const MOVEMENT_SMOKE_EMITTER = Object.freeze({
  [MOVEMENT_SMOKE_TRANSITION.DODGE_START]: "dashStart",
  [MOVEMENT_SMOKE_TRANSITION.SLIDE_START]: "iceSlideStart",
  [MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT]: "iceSlideRedirect",
});

/**
 * SLIDE_REDIRECT presentation profile (~60% of dodge dashStart).
 * Runtime: client ParticleEngine.iceSlideRedirect → spawnDashSmoke scaled.
 */
const SLIDE_REDIRECT_SMOKE_PROFILE = Object.freeze({
  emitter: "iceSlideRedirect",
  baseEmitter: "dashStart",
  sheet: "dash-smoke-effect",
  sheetBaselineY: 0,
  visualMassTarget: "0.55–0.65 of dashStart",
  scale: 0.6,
  alpha: 0.85,
  maxLife: 0.26,
  dashScale: 1,
  dashAlpha: 0.9,
  dashMaxLife: 0.42,
});

function movementSmokeEmitterName(transitionType) {
  return MOVEMENT_SMOKE_EMITTER[transitionType] || null;
}

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function normalizeMoveDir(dir, fallback = 1) {
  if (typeof dir === "number" && dir !== 0 && Number.isFinite(dir)) {
    return dir > 0 ? 1 : -1;
  }
  return fallback > 0 ? 1 : -1;
}

function isAirborneForMovementSmoke(fighter) {
  if (!fighter) return true;
  if (fighter.isRopeJumping) return true;
  if (fighter.isFlapping) return true;
  if (fighter.isSlideJumping) return true;
  if (fighter.slideJumpDiveCommitted) return true;
  if (fighter.slideJumpFastFalling) return true;
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
  // Bunny-hop reverse is a grounded slide redirect arc — not flight.
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

function mintMovementSmokeEventId({
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

/** Test / server helper — bounded claim store (mirrors client dedupe). */
function createMovementSmokeClaimStore(max = 256) {
  const order = [];
  const seen = new Set();
  return {
    claim(eventId) {
      if (!eventId) return true;
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      order.push(eventId);
      while (order.length > max) {
        const old = order.shift();
        if (old) seen.delete(old);
      }
      return true;
    },
    clear() {
      seen.clear();
      order.length = 0;
    },
    size() {
      return seen.size;
    },
  };
}

function resolveMovementSmokePlacement(meta = {}, store) {
  const {
    fighterId,
    transitionType,
    moveDir,
    worldX,
    sequence = "",
    fighter = null,
  } = meta;
  if (
    transitionType !== MOVEMENT_SMOKE_TRANSITION.DODGE_START &&
    transitionType !== MOVEMENT_SMOKE_TRANSITION.SLIDE_START &&
    transitionType !== MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT
  ) {
    return null;
  }
  if (fighter && isAirborneForMovementSmoke(fighter)) return null;
  const dir = normalizeMoveDir(moveDir, 1);
  const x = finite(worldX, 0);
  const eventId = mintMovementSmokeEventId({
    fighterId,
    transitionType,
    moveDir: dir,
    worldX: x,
    sequence,
  });
  if (store && !store.claim(eventId)) return null;
  return {
    eventId,
    transitionType,
    fighterId: fighterId || null,
    x,
    y: MOVEMENT_SMOKE_GROUND_Y,
    direction: dir,
  };
}

module.exports = {
  MOVEMENT_SMOKE_GROUND_Y,
  DASH_SMOKE_SHEET_BASELINE_Y,
  MOVEMENT_SMOKE_TRANSITION,
  MOVEMENT_SMOKE_EMITTER,
  SLIDE_REDIRECT_SMOKE_PROFILE,
  normalizeMoveDir,
  isAirborneForMovementSmoke,
  mintMovementSmokeEventId,
  createMovementSmokeClaimStore,
  resolveMovementSmokePlacement,
  movementSmokeEmitterName,
};

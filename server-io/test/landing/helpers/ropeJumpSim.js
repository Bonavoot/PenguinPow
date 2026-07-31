"use strict";

/**
 * Deterministic rope-jump timeline helper (64 Hz).
 * Exercises landingResolution.stepRopeJumpActive + optional pushbox correction
 * without booting the full index.js game loop.
 */

const {
  TICK_RATE,
  GROUND_LEVEL,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_STAMINA_COST,
  ROPE_JUMP_CENTER_FRACTION,
  ROPE_JUMP_LANDING_COMMIT_T,
  HITBOX_DISTANCE_VALUE,
} = require("../../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("../../../gameUtils");
const {
  initRopeJumpLandingState,
  stepRopeJumpActive,
  clearRopeJumpLandingState,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
} = require("../../../landingResolution");
const { adjustPlayerPositions } = require("../../../gameFunctions");

const TICK_MS = 1000 / TICK_RATE;

function makeFighter(overrides = {}) {
  return {
    id: overrides.id || "p",
    x: overrides.x != null ? overrides.x : 500,
    y: overrides.y != null ? overrides.y : GROUND_LEVEL,
    facing: overrides.facing != null ? overrides.facing : -1,
    sizeMultiplier:
      overrides.sizeMultiplier != null
        ? overrides.sizeMultiplier
        : DEFAULT_PLAYER_SIZE_MULTIPLIER,
    movementVelocity: 0,
    isHit: false,
    isRawParryStun: false,
    isRawParrying: false,
    isThrowing: false,
    isBeingThrown: false,
    isSidestepping: false,
    isFlapping: false,
    flapPhase: null,
    isSlideJumping: false,
    slideJumpPhase: null,
    isAttacking: false,
    attackType: null,
    isPalmThrust: false,
    isGrabBreakSeparating: false,
    isBeingPullReversaled: false,
    isGrabBellyFlopping: false,
    isBeingGrabBellyFlopped: false,
    isGrabFrontalForceOut: false,
    isBeingGrabFrontalForceOut: false,
    isRingOutPushCutscene: false,
    isRopeJumping: false,
    ropeJumpPhase: null,
    ropeJumpStartTime: 0,
    ropeJumpStartX: 0,
    ropeJumpTargetX: 0,
    ropeJumpDirection: 0,
    ropeJumpActiveStartTime: 0,
    ropeJumpLandingTime: 0,
    ropeJumpBufferedAttackRelease: 0,
    ropeJumpRawTargetX: 0,
    ropeJumpResolvedTargetX: 0,
    ropeJumpLandingCommitted: false,
    ropeJumpLandingCommitX: 0,
    ropeJumpLandingCommitT: 0,
    ropeJumpLandingDecision: null,
    ropeJumpLandingPath: null,
    ropeJumpPreferredSide: 0,
    ropeJumpResolvedSide: 0,
    ropeJumpMinDistance: 0,
    ropeJumpCenterDistance: 0,
    ropeJumpOverlap: 0,
    ropeJumpSafetyCorrectionPx: 0,
    ropeJumpPreTouchdownX: 0,
    ropeJumpTouchdownX: 0,
    ropeJumpUsedFallback: false,
    currentAction: null,
    actionLockUntil: 0,
    stamina: 100,
    ...overrides,
  };
}

function computeRawRopeJumpTargetX(startX) {
  const mapMidpoint = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
  const targetX = startX + (mapMidpoint - startX) * ROPE_JUMP_CENTER_FRACTION;
  return Math.max(MAP_LEFT_BOUNDARY, Math.min(targetX, MAP_RIGHT_BOUNDARY));
}

/**
 * Begin a rope jump at `now` (startup phase).
 * @param {object} jumper
 * @param {{ jumpDirection: 1|-1, now?: number, useV2?: boolean, rawTargetX?: number }} opts
 */
function beginRopeJump(jumper, opts) {
  const now = opts.now != null ? opts.now : 100_000;
  const jumpDirection = opts.jumpDirection;
  const rawTargetX =
    opts.rawTargetX != null
      ? opts.rawTargetX
      : computeRawRopeJumpTargetX(jumper.x);

  jumper.movementVelocity = 0;
  jumper.isRopeJumping = true;
  jumper.ropeJumpPhase = "startup";
  jumper.ropeJumpStartTime = now;
  jumper.ropeJumpStartX = jumper.x;
  jumper.ropeJumpTargetX = rawTargetX;
  jumper.ropeJumpDirection = jumpDirection;
  jumper.ropeJumpActiveStartTime = 0;
  jumper.ropeJumpLandingTime = 0;
  jumper.ropeJumpBufferedAttackRelease = 0;
  jumper.currentAction = "ropeJump";
  jumper.actionLockUntil = now + ROPE_JUMP_STARTUP_MS;
  jumper.stamina = Math.max(0, jumper.stamina - ROPE_JUMP_STAMINA_COST);
  initRopeJumpLandingState(jumper, rawTargetX, !!opts.useV2);
  return { startTime: now, rawTargetX };
}

/**
 * Simulate rope jump from startup through landing recovery.
 * Optionally walks the opponent each active tick via opponentStep(opponent, t, now).
 *
 * @returns {object} trace metrics
 */
function simulateRopeJump(jumper, opponent, opts = {}) {
  const useV2 = !!opts.useV2;
  const startNow = opts.now != null ? opts.now : 100_000;
  const jumpDirection =
    opts.jumpDirection != null
      ? opts.jumpDirection
      : jumper.x <= MAP_LEFT_BOUNDARY + 40
        ? 1
        : -1;

  beginRopeJump(jumper, {
    jumpDirection,
    now: startNow,
    useV2,
    rawTargetX: opts.rawTargetX,
  });

  const trace = {
    useV2,
    rawTargetX: jumper.ropeJumpRawTargetX,
    samples: [],
    commit: null,
    touchdown: null,
    corrections: [],
    shakeEmits: 0,
    bufferedAttackFired: false,
  };

  let now = startNow;
  const endLimit = startNow + ROPE_JUMP_STARTUP_MS + ROPE_JUMP_ACTIVE_MS + ROPE_JUMP_LANDING_RECOVERY_MS + 100;
  let shakeEmitted = false;

  while (now <= endLimit && jumper.isRopeJumping) {
    now += TICK_MS;

    if (jumper.ropeJumpPhase === "startup") {
      if (now >= jumper.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
        jumper.ropeJumpPhase = "active";
        jumper.ropeJumpActiveStartTime = now;
      }
    } else if (jumper.ropeJumpPhase === "active") {
      if (typeof opts.opponentStep === "function" && opponent) {
        const elapsed = now - jumper.ropeJumpActiveStartTime;
        const t = Math.min(1, elapsed / ROPE_JUMP_ACTIVE_MS);
        opts.opponentStep(opponent, t, now);
      }

      const beforeX = jumper.x;
      const result = stepRopeJumpActive(jumper, opponent, now, { useV2 });

      if (result.committedThisTick) {
        trace.commit = {
          t: jumper.ropeJumpLandingCommitT,
          commitX: jumper.ropeJumpLandingCommitX,
          resolvedTargetX: jumper.ropeJumpResolvedTargetX,
          preferredSide: jumper.ropeJumpPreferredSide,
          resolvedSide: jumper.ropeJumpResolvedSide,
          decision: jumper.ropeJumpLandingDecision,
          beforeX,
        };
      }

      if (result.touchedDown) {
        jumper.actionLockUntil = now + ROPE_JUMP_LANDING_RECOVERY_MS;
        shakeEmitted = true;
        trace.shakeEmits = 1;
        trace.touchdown = {
          now,
          x: jumper.x,
          y: jumper.y,
          preTouchdownX: jumper.ropeJumpPreTouchdownX,
          opponentX: opponent ? opponent.x : null,
          overlap: jumper.ropeJumpOverlap,
          centerDistance: jumper.ropeJumpCenterDistance,
          minDistance: jumper.ropeJumpMinDistance,
          path: jumper.ropeJumpLandingPath,
        };
      }

      trace.samples.push({
        phase: "active",
        now,
        x: jumper.x,
        y: jumper.y,
        committed: !!jumper.ropeJumpLandingCommitted,
        opponentX: opponent ? opponent.x : null,
      });
    } else if (jumper.ropeJumpPhase === "landing") {
      if (opponent) {
        const beforeJ = jumper.x;
        const beforeO = opponent.x;
        adjustPlayerPositions(jumper, opponent, TICK_MS);
        const moved =
          Math.abs(jumper.x - beforeJ) + Math.abs(opponent.x - beforeO);
        if (moved > 0) {
          trace.corrections.push({
            now,
            jumperDelta: jumper.x - beforeJ,
            opponentDelta: opponent.x - beforeO,
            jumperX: jumper.x,
            opponentX: opponent.x,
            safetyCorrectionPx: jumper.ropeJumpSafetyCorrectionPx,
          });
        }
      }

      if (now >= jumper.ropeJumpLandingTime + ROPE_JUMP_LANDING_RECOVERY_MS) {
        if (jumper.ropeJumpBufferedAttackRelease) {
          jumper.ropeJumpBufferedAttackRelease = 0;
          trace.bufferedAttackFired = true;
        }
        if (opponent) {
          jumper.facing = jumper.x < opponent.x ? -1 : 1;
        }
        jumper.isRopeJumping = false;
        jumper.ropeJumpPhase = null;
        jumper.ropeJumpStartTime = 0;
        jumper.ropeJumpStartX = 0;
        jumper.ropeJumpTargetX = 0;
        jumper.ropeJumpDirection = 0;
        jumper.ropeJumpActiveStartTime = 0;
        jumper.ropeJumpLandingTime = 0;
        clearRopeJumpLandingState(jumper);
        jumper.currentAction = null;
        jumper.actionLockUntil = 0;
      }
    }
  }

  trace.totalSafetyCorrectionPx = trace.corrections.reduce(
    (s, c) => s + Math.abs(c.jumperDelta) + Math.abs(c.opponentDelta),
    0
  );
  trace.correctionTicks = trace.corrections.length;
  trace.maxSingleTickCorrection = trace.corrections.reduce(
    (m, c) => Math.max(m, Math.abs(c.jumperDelta) + Math.abs(c.opponentDelta)),
    0
  );
  trace.finalJumperX = jumper.x;
  trace.finalOpponentX = opponent ? opponent.x : null;
  trace.shakeEmitted = shakeEmitted;
  return trace;
}

module.exports = {
  TICK_MS,
  TICK_RATE,
  GROUND_LEVEL,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  HITBOX_DISTANCE_VALUE,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_STAMINA_COST,
  ROPE_JUMP_CENTER_FRACTION,
  ROPE_JUMP_LANDING_COMMIT_T,
  makeFighter,
  computeRawRopeJumpTargetX,
  beginRopeJump,
  simulateRopeJump,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
};

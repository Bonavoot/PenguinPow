"use strict";

/**
 * Deterministic rope-jump timeline helper (64 Hz).
 * Exercises landingResolution.stepRopeJumpActive + optional pushbox correction
 * without booting the full index.js game loop.
 *
 * Phase A.3.1: traces landing-settle ticks and one ordinary grounded tick
 * after rope-jump recovery clears (recovery-exit invariant).
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
  ICE_ACCELERATION,
  ICE_MAX_SPEED,
  ICE_BRAKE_FRICTION,
  ICE_STOP_THRESHOLD,
  ICE_TURN_BURST,
  ICE_COAST_FRICTION,
  ICE_INITIAL_BURST,
  speedFactor,
} = require("../../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("../../../gameUtils");
const {
  stepRopeJumpActive,
  clearRopeJumpLandingState,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
  LANDING_SETTLE_OVERLAP_EPS_PX,
} = require("../../../landingResolution");
const { startRopeJump } = require("../../../ropeJumpStart");
const { adjustPlayerPositions } = require("../../../gameFunctions");

const TICK_MS = 1000 / TICK_RATE;
const ICE_PX_PER_VEL_UNIT = TICK_MS * speedFactor;

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
    ropeJumpLandingCommitVel: 0,
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
    ropeJumpTrajectoryType: null,
    ropeJumpDecisionClass: null,
    ropeJumpFallbackReason: null,
    ropeJumpHorizVel: 0,
    ropeJumpRawExpectedVel: 0,
    ropeJumpPeakVel: 0,
    ropeJumpPeakAccel: 0,
    ropeJumpReversalDetected: false,
    ropeJumpSideIntentLocked: false,
    ropeJumpSideIntent: 0,
    ropeJumpIntentClass: null,
    ropeJumpIntentReason: null,
    ropeJumpRecommendedCommitT: 0,
    ropeJumpSideIntentOpponentX: 0,
    ropeJumpPlanningState: null,
    ropeJumpFirstRawConflictTick: 0,
    ropeJumpFirstRawConflictT: -1,
    ropeJumpSideLockTick: 0,
    ropeJumpSideLockReason: null,
    ropeJumpNoReturnDeadlineT: 0,
    ropeJumpConflictBeforeDeadline: null,
    ropeJumpEndpointCommitTick: 0,
    ropeJumpLateIntrusion: false,
    ropeJumpLateIntrusionClass: null,
    ropeJumpSafetyCorrectionTicks: 0,
    ropeJumpSettleState: null,
    ropeJumpSidePolicy: null,
    ropeJumpSettleJumperIsLeft: null,
    ropeJumpSettleInitialOverlap: 0,
    ropeJumpSettleMaxOverlap: 0,
    ropeJumpSettleAccumulatedPx: 0,
    ropeJumpSettleTicksDone: 0,
    ropeJumpSettleTicksTotal: 0,
    ropeJumpOverlapIncreased: false,
    ropeJumpBudgetException: false,
    ropeJumpBudgetExceptionClass: null,
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

function overlapOf(jumper, opponent) {
  if (!jumper || !opponent) return 0;
  const minDist = getMinimumCenterDistance(
    jumper.sizeMultiplier,
    opponent.sizeMultiplier
  );
  return Math.max(0, minDist - Math.abs(jumper.x - opponent.x));
}

function sideOrdering(jumper, opponent) {
  if (!jumper || !opponent) return 0;
  if (jumper.x < opponent.x) return -1;
  if (jumper.x > opponent.x) return 1;
  return 0;
}

/**
 * Begin a rope jump at `now` (startup phase).
 * @param {object} jumper
 * @param {{ jumpDirection: 1|-1, now?: number, useV2?: boolean, rawTargetX?: number }} opts
 */
function beginRopeJump(jumper, opts) {
  const now = opts.now != null ? opts.now : 100_000;
  const jumpDirection = opts.jumpDirection;
  const { rawTargetX } = startRopeJump(jumper, {
    now,
    jumpDirection,
    mapLeft: MAP_LEFT_BOUNDARY,
    mapRight: MAP_RIGHT_BOUNDARY,
    facing: jumper.facing,
    useV2: !!opts.useV2,
    rawTargetX: opts.rawTargetX,
  });
  return { startTime: now, rawTargetX };
}

/**
 * Production-faithful ice movement step helpers for dynamic profile tests.
 * Velocities are in ice units; conversion uses TICK_MS * speedFactor.
 */
function createIceMotionController(initialVel = 0) {
  let v = initialVel;
  return {
    get vel() {
      return v;
    },
    setVel(next) {
      v = next;
    },
    /** Hold A/D toward signed direction (±1), accelerating up to ICE_MAX_SPEED. */
    accelerate(dir) {
      const sign = dir >= 0 ? 1 : -1;
      if (Math.sign(v) === -sign && Math.abs(v) > ICE_STOP_THRESHOLD) {
        // Turning through brake first (caller should use brake/reverse profile).
        v *= ICE_BRAKE_FRICTION;
        if (Math.abs(v) < ICE_STOP_THRESHOLD) v = 0;
      } else {
        v += sign * ICE_ACCELERATION;
        if (Math.abs(v) > ICE_MAX_SPEED) v = sign * ICE_MAX_SPEED;
      }
      return v;
    },
    brake() {
      v *= ICE_BRAKE_FRICTION;
      if (Math.abs(v) < ICE_STOP_THRESHOLD) v = 0;
      return v;
    },
    coast() {
      v *= ICE_COAST_FRICTION;
      if (Math.abs(v) < ICE_STOP_THRESHOLD) v = 0;
      return v;
    },
    reverseBurst(dir) {
      const sign = dir >= 0 ? 1 : -1;
      v = sign * ICE_TURN_BURST;
      return v;
    },
    apply(opponent) {
      opponent.movementVelocity = v;
      opponent.x += v * ICE_PX_PER_VEL_UNIT;
      opponent.x = Math.max(
        MAP_LEFT_BOUNDARY,
        Math.min(MAP_RIGHT_BOUNDARY, opponent.x)
      );
    },
  };
}

/**
 * Simulate rope jump from startup through landing recovery, then one ordinary
 * grounded pushbox tick after rope-jump state clears.
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
    settleTicks: [],
    shakeEmits: 0,
    bufferedAttackFired: false,
    peakVel: 0,
    peakAccel: 0,
    reversalDetected: false,
    sideIntent: 0,
    intentClass: null,
    planningState: null,
    firstRawConflictT: -1,
    sideLockTick: 0,
    sideLockReason: null,
    noReturnDeadlineT: 0,
    conflictBeforeDeadline: null,
    endpointCommitTick: 0,
    lateIntrusion: false,
    lateIntrusionClass: null,
    sidesSeen: [],
    overlapEverIncreased: false,
    sidePolicy: null,
    settleState: null,
    settleInitialOverlap: 0,
    settleMaxOverlap: 0,
    settleAccumulatedPx: 0,
    recoveryEnd: null,
    postRecovery: null,
    budgetException: false,
    budgetExceptionClass: null,
  };

  let now = startNow;
  const endLimit =
    startNow +
    ROPE_JUMP_STARTUP_MS +
    ROPE_JUMP_ACTIVE_MS +
    ROPE_JUMP_LANDING_RECOVERY_MS +
    100;
  let shakeEmitted = false;
  let accumulatedDisplacement = 0;

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
          commitVel: jumper.ropeJumpLandingCommitVel,
          resolvedTargetX: jumper.ropeJumpResolvedTargetX,
          preferredSide: jumper.ropeJumpPreferredSide,
          resolvedSide: jumper.ropeJumpResolvedSide,
          decision: jumper.ropeJumpLandingDecision,
          decisionClass: jumper.ropeJumpDecisionClass,
          trajectoryType: jumper.ropeJumpTrajectoryType,
          fallbackReason: jumper.ropeJumpFallbackReason,
          sideIntent: jumper.ropeJumpSideIntent,
          intentClass: jumper.ropeJumpIntentClass,
          intentReason: jumper.ropeJumpIntentReason,
          recommendedCommitT: jumper.ropeJumpRecommendedCommitT,
          planningState: jumper.ropeJumpPlanningState,
          budgetException: !!jumper.ropeJumpBudgetException,
          budgetExceptionClass: jumper.ropeJumpBudgetExceptionClass,
          feasibility:
            jumper.ropeJumpLandingDecision &&
            jumper.ropeJumpLandingDecision.feasibility,
          beforeX,
        };
        trace.budgetException = !!jumper.ropeJumpBudgetException;
        trace.budgetExceptionClass = jumper.ropeJumpBudgetExceptionClass;
      }

      if (
        jumper.ropeJumpSideIntentLocked &&
        (trace.sidesSeen.length === 0 ||
          trace.sidesSeen[trace.sidesSeen.length - 1] !==
            jumper.ropeJumpSideIntent)
      ) {
        trace.sidesSeen.push(jumper.ropeJumpSideIntent);
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
          settleState: jumper.ropeJumpSettleState,
          sidePolicy: jumper.ropeJumpSidePolicy,
          sideOrdering: sideOrdering(jumper, opponent),
        };
        trace.sidePolicy = jumper.ropeJumpSidePolicy;
        trace.settleState = jumper.ropeJumpSettleState;
        trace.settleInitialOverlap = jumper.ropeJumpSettleInitialOverlap || 0;
      }

      const dx = jumper.x - beforeX;
      trace.samples.push({
        phase: "active",
        now,
        x: jumper.x,
        y: jumper.y,
        dx,
        vel: dx / (TICK_MS / 1000),
        committed: !!jumper.ropeJumpLandingCommitted,
        opponentX: opponent ? opponent.x : null,
        rawExpectedVel: jumper.ropeJumpRawExpectedVel,
        horizVel: jumper.ropeJumpHorizVel,
      });
      trace.peakVel = Math.max(trace.peakVel, jumper.ropeJumpPeakVel || 0);
      trace.peakAccel = Math.max(trace.peakAccel, jumper.ropeJumpPeakAccel || 0);
      if (jumper.ropeJumpReversalDetected) trace.reversalDetected = true;
      if (jumper.ropeJumpSideIntentLocked) {
        trace.sideIntent = jumper.ropeJumpSideIntent;
        trace.intentClass = jumper.ropeJumpIntentClass;
      }
      trace.planningState = jumper.ropeJumpPlanningState;
      trace.firstRawConflictT = jumper.ropeJumpFirstRawConflictT;
      trace.sideLockTick = jumper.ropeJumpSideLockTick;
      trace.sideLockReason = jumper.ropeJumpSideLockReason;
      trace.noReturnDeadlineT = jumper.ropeJumpNoReturnDeadlineT;
      trace.conflictBeforeDeadline = jumper.ropeJumpConflictBeforeDeadline;
      trace.endpointCommitTick = jumper.ropeJumpEndpointCommitTick;
      trace.lateIntrusion = !!jumper.ropeJumpLateIntrusion;
      trace.lateIntrusionClass = jumper.ropeJumpLateIntrusionClass;
    } else if (jumper.ropeJumpPhase === "landing") {
      if (opponent) {
        const beforeJ = jumper.x;
        const beforeO = opponent.x;
        const overlapBefore = overlapOf(jumper, opponent);
        const sideBefore = sideOrdering(jumper, opponent);
        adjustPlayerPositions(jumper, opponent, TICK_MS);
        const jumperDelta = jumper.x - beforeJ;
        const opponentDelta = opponent.x - beforeO;
        const moved = Math.abs(jumperDelta) + Math.abs(opponentDelta);
        const overlapAfter = overlapOf(jumper, opponent);
        const sideAfter = sideOrdering(jumper, opponent);
        const correctionDirection =
          jumperDelta === 0 && opponentDelta === 0
            ? 0
            : Math.sign(jumperDelta !== 0 ? jumperDelta : -opponentDelta);
        accumulatedDisplacement += moved;
        if (overlapAfter > overlapBefore + 1e-9) {
          trace.overlapEverIncreased = true;
        }
        const settleRecord = {
          now,
          phase: "landing_settle",
          overlapBefore,
          overlapAfter,
          correctionDirection,
          jumperDelta,
          opponentDelta,
          pairDisplacement: moved,
          jumperX: jumper.x,
          opponentX: opponent.x,
          sideBefore,
          sideAfter,
          accumulatedDisplacement,
          safetyCorrectionPx: jumper.ropeJumpSafetyCorrectionPx,
          settleState: jumper.ropeJumpSettleState,
          sidePolicy: jumper.ropeJumpSidePolicy,
        };
        if (moved > 0 || overlapBefore > LANDING_SETTLE_OVERLAP_EPS_PX) {
          trace.settleTicks.push(settleRecord);
        }
        if (moved > 0) {
          trace.corrections.push({
            now,
            jumperDelta,
            opponentDelta,
            jumperX: jumper.x,
            opponentX: opponent.x,
            safetyCorrectionPx: jumper.ropeJumpSafetyCorrectionPx,
            overlapBefore,
            overlapAfter,
            correctionDirection,
          });
        }
        trace.sidePolicy = jumper.ropeJumpSidePolicy;
        trace.settleState = jumper.ropeJumpSettleState;
        trace.settleMaxOverlap = Math.max(
          trace.settleMaxOverlap,
          jumper.ropeJumpSettleMaxOverlap || 0,
          overlapBefore
        );
        trace.settleAccumulatedPx = jumper.ropeJumpSettleAccumulatedPx || 0;
        if (jumper.ropeJumpOverlapIncreased) {
          trace.overlapEverIncreased = true;
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

        // Snapshot recovery-end metrics before cleanup clears settle fields.
        trace.recoveryEnd = {
          now,
          jumperX: jumper.x,
          opponentX: opponent ? opponent.x : null,
          overlap: overlapOf(jumper, opponent),
          sideOrdering: sideOrdering(jumper, opponent),
          settleState: jumper.ropeJumpSettleState,
          sidePolicy: jumper.ropeJumpSidePolicy,
          settleAccumulatedPx: jumper.ropeJumpSettleAccumulatedPx || 0,
          settleMaxOverlap: jumper.ropeJumpSettleMaxOverlap || 0,
          overlapIncreased: !!jumper.ropeJumpOverlapIncreased,
          safetyCorrectionPx: jumper.ropeJumpSafetyCorrectionPx || 0,
          safetyCorrectionTicks: jumper.ropeJumpSafetyCorrectionTicks || 0,
        };
        trace.lateIntrusion = !!jumper.ropeJumpLateIntrusion || trace.lateIntrusion;
        trace.lateIntrusionClass =
          jumper.ropeJumpLateIntrusionClass || trace.lateIntrusionClass;
        trace.budgetException =
          !!jumper.ropeJumpBudgetException || trace.budgetException;
        trace.budgetExceptionClass =
          jumper.ropeJumpBudgetExceptionClass || trace.budgetExceptionClass;
        if (jumper.ropeJumpOverlapIncreased) {
          trace.overlapEverIncreased = true;
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

  // Phase A.3.1 recovery-exit: one ordinary grounded pushbox tick after clear.
  if (opponent && opts.skipPostRecoveryTick !== true) {
    const beforeJ = jumper.x;
    const beforeO = opponent.x;
    const overlapBefore = overlapOf(jumper, opponent);
    const sideBefore = sideOrdering(jumper, opponent);
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    const jumperDelta = jumper.x - beforeJ;
    const opponentDelta = opponent.x - beforeO;
    const pairDisplacement = Math.abs(jumperDelta) + Math.abs(opponentDelta);
    const overlapAfter = overlapOf(jumper, opponent);
    if (overlapAfter > overlapBefore + 1e-9) {
      trace.overlapEverIncreased = true;
    }
    trace.postRecovery = {
      jumperDelta,
      opponentDelta,
      pairDisplacement,
      overlapBefore,
      overlapAfter,
      jumperX: jumper.x,
      opponentX: opponent.x,
      sideBefore,
      sideAfter: sideOrdering(jumper, opponent),
      withinTolerance:
        pairDisplacement <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-9,
    };
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
  ICE_ACCELERATION,
  ICE_MAX_SPEED,
  ICE_BRAKE_FRICTION,
  ICE_STOP_THRESHOLD,
  ICE_TURN_BURST,
  ICE_COAST_FRICTION,
  ICE_INITIAL_BURST,
  speedFactor,
  ICE_PX_PER_VEL_UNIT,
  makeFighter,
  computeRawRopeJumpTargetX,
  beginRopeJump,
  simulateRopeJump,
  createIceMotionController,
  overlapOf,
  sideOrdering,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
};

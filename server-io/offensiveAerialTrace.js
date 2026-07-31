"use strict";

/**
 * Development-only offensive-aerial interaction trace helpers.
 *
 * Records authoritative tick snapshots for slide-jump / FLAP / body-slam
 * characterization. Never mutates combat outcomes. Production network deltas
 * are untouched unless OFFENSIVE_AERIAL_TRACE/DEBUG is explicitly enabled.
 *
 * See OFFENSIVE_AERIAL_INTERACTION_AUDIT.md
 */

const {
  OFFENSIVE_AERIAL_TRACE,
  OFFENSIVE_AERIAL_DEBUG,
  isOffensiveAerialReactionV2Enabled,
} = require("./offensiveAerialFlags");
const { GROUND_LEVEL, HITBOX_DISTANCE_VALUE } = require("./constants");
const {
  isContactConsumed,
  snapshotOffensiveAerialDebug,
} = require("./offensiveAerialOutcome");
const { rootMidpoint } = require("./offensiveAerialContact");
const {
  isParriedRecoilActive,
  snapshotOffensiveAerialReactionDebug,
} = require("./offensiveAerialReaction");
const {
  snapshotOffensiveAerialFacingDebug,
} = require("./offensiveAerialFacing");

/** Must match collisionSystem.js local constants (exported there for tests). */
const FLAP_BODYSLAM_WIDTH_SCALE = 0.7;
const FLAP_BODYSLAM_CONTACT_HEIGHT = 100;

function bodySlamBodyWidth(attacker, defender) {
  return (
    HITBOX_DISTANCE_VALUE *
    2 *
    FLAP_BODYSLAM_WIDTH_SCALE *
    Math.max(attacker?.sizeMultiplier || 1, defender?.sizeMultiplier || 1)
  );
}

function isBodySlamWindowOpen(attacker) {
  if (!attacker?.isSlideJumping || attacker.slideJumpPhase !== "flight") {
    return false;
  }
  // Latch + outcome contactConsumed both kill the hitbox (same activation).
  if (attacker.slideJumpHitLanded || isContactConsumed(attacker)) return false;
  const descending =
    (attacker.slideJumpVelocityY ?? 0) <= 0 || !!attacker.slideJumpDiveCommitted;
  if (!descending) return false;
  if (attacker.y - GROUND_LEVEL > FLAP_BODYSLAM_CONTACT_HEIGHT) return false;
  return true;
}

function classifyAerialPhase(player) {
  if (!player) return "none";
  if (isParriedRecoilActive(player)) return "parried_recoil";
  if (
    player.offensiveAerialReactionType === "LANDING_RECOVERY" &&
    player.isSlideJumping &&
    player.slideJumpPhase === "landing"
  ) {
    return "parried_landing";
  }
  if (player.isSlideJumping) {
    if (player.slideJumpPhase === "landing") return "landing";
    if (player.slideJumpDiveCommitted) return "airborne_active_dive";
    if (isBodySlamWindowOpen(player)) return "airborne_active";
    if (player.slideJumpHitLanded) return "post_hit_travel";
    if (player.slideJumpFlapFlightActive) return "airborne_flap_inactive";
    return "airborne_inactive";
  }
  if (player.isRecovering && player.isHit === false && !player.isSlideJumping) {
    // Post-parry stagger uses isRecovering after clearAllActionStates.
    return "parried_grounded";
  }
  if (player.isHitFalling) return "hit_fall";
  return "none";
}

function classifyOutcomeHint(attacker, defender, lastContactResult) {
  if (lastContactResult) return lastContactResult;
  if (attacker?.slideJumpHitLanded) return "hit_latched";
  if (
    attacker &&
    !attacker.isSlideJumping &&
    attacker.isRecovering &&
    !attacker.isHit
  ) {
    return "parried_or_interrupted";
  }
  if (attacker?.slideJumpPhase === "landing" && !attacker.slideJumpHitLanded) {
    return "whiff_landing";
  }
  if (attacker?.slideJumpPhase === "landing" && attacker.slideJumpHitLanded) {
    return "hit_landing";
  }
  return "in_flight";
}

function sideOf(a, b) {
  if (!a || !b || typeof a.x !== "number" || typeof b.x !== "number") return 0;
  if (a.x === b.x) return 0;
  return a.x < b.x ? -1 : 1;
}

function capturePlayerAerialSlice(p) {
  if (!p) return null;
  return {
    id: p.id,
    x: p.x,
    y: p.y,
    facing: p.facing,
    velX: p.slideJumpFlapFlightActive
      ? p.flapVelocityX || 0
      : p.slideJumpVelocityX || 0,
    velY: p.slideJumpVelocityY || 0,
    movementVelocity: p.movementVelocity || 0,
    knockbackX: p.knockbackVelocity?.x || 0,
    knockbackY: p.knockbackVelocity?.y || 0,
    isSlideJumping: !!p.isSlideJumping,
    slideJumpPhase: p.slideJumpPhase || null,
    flapFlight: !!p.slideJumpFlapFlightActive,
    dive: !!p.slideJumpDiveCommitted,
    hitLanded: !!p.slideJumpHitLanded,
    flapCharges: p.flapCharges || 0,
    hasFlap: !!p.slideJumpHasFlap,
    airborne: typeof p.y === "number" ? p.y > GROUND_LEVEL : false,
    grounded: typeof p.y === "number" ? p.y <= GROUND_LEVEL : false,
    isHit: !!p.isHit,
    isAlreadyHit: !!p.isAlreadyHit,
    isRecovering: !!p.isRecovering,
    isRawParrying: !!p.isRawParrying,
    isGuarding: !!p.isGuarding,
    apActiveUntil: p.apActiveUntil || 0,
    lastHitType: p.lastHitType || null,
    actionLockUntil: p.actionLockUntil || 0,
    inputLockUntil: p.inputLockUntil || 0,
    bufferedAction: p.bufferedAction || null,
    inputBufferType: p.inputBuffer?.type || null,
    currentAction: p.currentAction || null,
    isHitFalling: !!p.isHitFalling,
    phase: classifyAerialPhase(p),
  };
}

/**
 * Build one tick snapshot. Pure; does not mutate players.
 */
function buildOffensiveAerialTickSnapshot({
  tick = 0,
  simTime = 0,
  attacker,
  defender,
  contactResult = null,
  contactPoint = null,
  pushboxCorrectionPx = 0,
  fieldsCleared = null,
  notes = null,
} = {}) {
  const hitboxActive = isBodySlamWindowOpen(attacker);
  const width = attacker && defender ? bodySlamBodyWidth(attacker, defender) : 0;
  const dx =
    attacker && defender ? Math.abs(attacker.x - defender.x) : Number.POSITIVE_INFINITY;
  const overlap = Number.isFinite(dx) && width ? Math.max(0, width - dx) : 0;
  const sideBefore = sideOf(attacker, defender);

  return {
    tick,
    simTime,
    attackerMove: attacker?.slideJumpFlapFlightActive
      ? "flap_flight"
      : attacker?.isSlideJumping
        ? "slide_jump"
        : "none",
    attackerPhase: classifyAerialPhase(attacker),
    defenderState: classifyAerialPhase(defender) === "none"
      ? defender?.isRawParrying
        ? "parrying"
        : defender?.isHit
          ? "hit"
          : defender?.isAttacking
            ? `attacking:${defender.attackType || "?"}`
            : "grounded_or_other"
      : classifyAerialPhase(defender),
    attacker: capturePlayerAerialSlice(attacker),
    defender: capturePlayerAerialSlice(defender),
    hitboxActive,
    hurtboxMode: isParriedRecoilActive(attacker)
      ? "parried_recoil_vulnerable"
      : attacker?.slideJumpDiveCommitted
        ? "dive_vulnerable"
        : attacker?.isSlideJumping && attacker.slideJumpPhase === "flight"
          ? "flight_immune"
          : attacker?.slideJumpPhase === "landing"
            ? "landing_vulnerable"
            : "n/a",
    parryActive: !!defender?.isRawParrying,
    attackLatch: !!attacker?.slideJumpHitLanded,
    contactCandidate: hitboxActive && overlap > 0,
    contactResult: contactResult || null,
    contactPoint: contactPoint || null,
    reactionV2: isOffensiveAerialReactionV2Enabled(),
    reaction: snapshotOffensiveAerialReactionDebug(attacker),
    presentation: attacker?.offensiveAerialPresentation || null,
    facingLock: snapshotOffensiveAerialFacingDebug(attacker),
    sideBefore,
    sideAfter: sideOf(attacker, defender),
    bodyOverlapPx: overlap,
    pushboxCorrectionPx,
    outcomeHint: classifyOutcomeHint(attacker, defender, contactResult),
    outcomeContract: snapshotOffensiveAerialDebug(attacker),
    previousMidpoint: attacker && defender ? rootMidpoint(attacker, defender) : null,
    fieldsCleared: fieldsCleared || null,
    notes: notes || null,
  };
}

function beginOffensiveAerialTrace(player, meta = {}) {
  if (!player) return;
  // Harnesses may always begin a local trace. Production only starts one when
  // OFFENSIVE_AERIAL_DEBUG is on (callers gate before invoking).
  player._offensiveAerialTrace = {
    startedAt: meta.simTime || 0,
    meta,
    samples: [],
  };
}

function recordOffensiveAerialTick(player, snapshot) {
  if (!player || !snapshot) return;
  // Append only when a trace session is already open (harness or debug flag).
  if (!player._offensiveAerialTrace) {
    if (!OFFENSIVE_AERIAL_DEBUG) return;
    beginOffensiveAerialTrace(player, { simTime: snapshot.simTime });
  }
  player._offensiveAerialTrace.samples.push(snapshot);
}

function flushOffensiveAerialTrace(player, reason = "complete") {
  if (!player || !player._offensiveAerialTrace) return null;
  const record = {
    reason,
    ...player._offensiveAerialTrace,
    sampleCount: player._offensiveAerialTrace.samples.length,
  };
  if (OFFENSIVE_AERIAL_TRACE) {
    console.log("[OFFENSIVE_AERIAL_TRACE]", JSON.stringify(record));
  }
  player._offensiveAerialTrace = null;
  return record;
}

function clearOffensiveAerialTrace(player) {
  if (player) player._offensiveAerialTrace = null;
}

module.exports = {
  FLAP_BODYSLAM_WIDTH_SCALE,
  FLAP_BODYSLAM_CONTACT_HEIGHT,
  bodySlamBodyWidth,
  isBodySlamWindowOpen,
  classifyAerialPhase,
  classifyOutcomeHint,
  buildOffensiveAerialTickSnapshot,
  beginOffensiveAerialTrace,
  recordOffensiveAerialTick,
  flushOffensiveAerialTrace,
  clearOffensiveAerialTrace,
  OFFENSIVE_AERIAL_TRACE,
  OFFENSIVE_AERIAL_DEBUG,
};

"use strict";

/**
 * Offensive-aerial presentation-state projection (Phase 5A).
 *
 * Derives a compact display category from authoritative gameplay fields.
 * Not a second combat state machine.
 *
 * Priority (highest first):
 * 1. INTERRUPTED_AIRBORNE
 * 2. GROUNDED_STAGGER
 * 3. TOUCHDOWN
 * 4. LANDING_RECOVERY
 * 5. PARRIED_FALL
 * 6. HIT_CONTINUATION
 * 7. DIVE_ACTIVE
 * 8. WHIFF_DESCENT
 * 9. FLIGHT_ACTIVE
 * 10. NONE
 *
 * See OFFENSIVE_AERIAL_STATE_FACING_PHASE.md
 */

const { GROUND_LEVEL } = require("./constants");
const {
  OFFENSIVE_AERIAL_REACTION,
} = require("./offensiveAerialReaction");
const { OFFENSIVE_AERIAL_OUTCOME } = require("./offensiveAerialOutcome");

const OFFENSIVE_AERIAL_PRESENTATION = Object.freeze({
  NONE: "NONE",
  FLIGHT_ACTIVE: "FLIGHT_ACTIVE",
  DIVE_ACTIVE: "DIVE_ACTIVE",
  HIT_CONTINUATION: "HIT_CONTINUATION",
  PARRIED_FALL: "PARRIED_FALL",
  WHIFF_DESCENT: "WHIFF_DESCENT",
  INTERRUPTED_AIRBORNE: "INTERRUPTED_AIRBORNE",
  TOUCHDOWN: "TOUCHDOWN",
  LANDING_RECOVERY: "LANDING_RECOVERY",
  GROUNDED_STAGGER: "GROUNDED_STAGGER",
});

function reactionTypeOf(player) {
  return (
    player?.offensiveAerialReactionType ||
    player?.offensiveAerialReaction?.reactionType ||
    null
  );
}

function outcomeOf(player) {
  return player?.offensiveAerial?.outcome || null;
}

function isAirborne(player, groundLevel) {
  if (!player) return false;
  if (player.isHitFalling) return true;
  if (player.isSlideJumping && player.slideJumpPhase === "flight") return true;
  if (player.isFlapping && player.flapPhase === "flight") return true;
  const g = groundLevel != null ? groundLevel : GROUND_LEVEL;
  return typeof player.y === "number" && player.y > g + 0.001;
}

/**
 * Pure resolver — safe for tests and client mirroring.
 */
function resolveOffensiveAerialPresentation(player, opts = {}) {
  if (!player) return OFFENSIVE_AERIAL_PRESENTATION.NONE;

  const reaction = reactionTypeOf(player);
  const outcome = outcomeOf(player);
  const groundLevel = opts.groundLevel != null ? opts.groundLevel : GROUND_LEVEL;

  // Interrupted: hitstun / hit-fall owns presentation over aerial attack poses.
  if (
    player.isHitFalling ||
    (player.isHit &&
      !player.isSlideJumping &&
      isAirborne(player, groundLevel))
  ) {
    return OFFENSIVE_AERIAL_PRESENTATION.INTERRUPTED_AIRBORNE;
  }

  // Grounded stagger after aerial consequence — never before touchdown.
  if (
    player.isRecovering &&
    !player.isSlideJumping &&
    !player.isHitFalling &&
    (outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED ||
      reaction === OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL ||
      reaction === OFFENSIVE_AERIAL_REACTION.LANDING_RECOVERY ||
      player._oaGroundedStagger)
  ) {
    return OFFENSIVE_AERIAL_PRESENTATION.GROUNDED_STAGGER;
  }

  if (player.isSlideJumping && player.slideJumpPhase === "landing") {
    if (player._oaTouchdownPresentation) {
      return OFFENSIVE_AERIAL_PRESENTATION.TOUCHDOWN;
    }
    return OFFENSIVE_AERIAL_PRESENTATION.LANDING_RECOVERY;
  }

  if (
    reaction === OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL ||
    (outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED &&
      player.isSlideJumping &&
      player.slideJumpPhase === "flight")
  ) {
    return OFFENSIVE_AERIAL_PRESENTATION.PARRIED_FALL;
  }

  if (
    (player.slideJumpHitLanded ||
      reaction === OFFENSIVE_AERIAL_REACTION.HIT_CONTINUATION ||
      outcome === OFFENSIVE_AERIAL_OUTCOME.HIT) &&
    player.isSlideJumping &&
    player.slideJumpPhase === "flight" &&
    reaction !== OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL
  ) {
    return OFFENSIVE_AERIAL_PRESENTATION.HIT_CONTINUATION;
  }

  if (
    player.isSlideJumping &&
    player.slideJumpPhase === "flight" &&
    player.slideJumpDiveCommitted &&
    !player.slideJumpHitLanded &&
    outcome !== OFFENSIVE_AERIAL_OUTCOME.PARRIED &&
    reaction !== OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL
  ) {
    return OFFENSIVE_AERIAL_PRESENTATION.DIVE_ACTIVE;
  }

  if (
    (reaction === OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT ||
      outcome === OFFENSIVE_AERIAL_OUTCOME.WHIFF) &&
    player.isSlideJumping &&
    player.slideJumpPhase === "flight"
  ) {
    return OFFENSIVE_AERIAL_PRESENTATION.WHIFF_DESCENT;
  }

  if (player.isSlideJumping && player.slideJumpPhase === "flight") {
    return OFFENSIVE_AERIAL_PRESENTATION.FLIGHT_ACTIVE;
  }

  if (player.isFlapping) {
    return player.flapDiveCommitted
      ? OFFENSIVE_AERIAL_PRESENTATION.DIVE_ACTIVE
      : OFFENSIVE_AERIAL_PRESENTATION.FLIGHT_ACTIVE;
  }

  return OFFENSIVE_AERIAL_PRESENTATION.NONE;
}

/** Sync compact wire field for client presentation ownership. */
function syncOffensiveAerialPresentation(player, opts = {}) {
  if (!player) return OFFENSIVE_AERIAL_PRESENTATION.NONE;
  const state = resolveOffensiveAerialPresentation(player, opts);
  player.offensiveAerialPresentation = state;
  return state;
}

function clearOffensiveAerialPresentation(player) {
  if (!player) return;
  player.offensiveAerialPresentation = OFFENSIVE_AERIAL_PRESENTATION.NONE;
  player._oaTouchdownPresentation = false;
  player._oaGroundedStagger = false;
}

module.exports = {
  OFFENSIVE_AERIAL_PRESENTATION,
  resolveOffensiveAerialPresentation,
  syncOffensiveAerialPresentation,
  clearOffensiveAerialPresentation,
};

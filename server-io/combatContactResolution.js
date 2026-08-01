"use strict";

/**
 * Outcome-aware physical contact resolution (Phase 13).
 *
 * Sits between existing outcome arbitration (checkCollision / grabCatchesSlap)
 * and reaction/presentation. Does NOT re-decide winners — only makes the
 * approved outcome reach a coherent contact + interruption moment.
 *
 * Behind COMBAT_CONTACT_FIDELITY_V2 (default OFF).
 *
 * See COMBAT_CONTACT_FIDELITY_PHASE.md
 */

const {
  isCombatContactFidelityV2Enabled,
} = require("./combatContactFidelityFlags");
const { getContactSeamX } = require("./strikeContact");
const { GROUND_LEVEL } = require("./constants");

/** Explicit allowlist: states that may be physically pass-through. */
const INTANGIBLE_PASS_THROUGH = Object.freeze({
  DODGE_STRIKE_IFRAMES: "DODGE_STRIKE_IFRAMES",
  SIDESTEP_IFRAMES: "SIDESTEP_IFRAMES",
  ROPE_JUMP_ACTIVE: "ROPE_JUMP_ACTIVE",
  SLIDE_JUMP_FLIGHT: "SLIDE_JUMP_FLIGHT",
  THROW_TRAVEL: "THROW_TRAVEL",
});

const IMMUNITY_CLASS = Object.freeze({
  DAMAGE: "DAMAGE",
  HITSTUN: "HITSTUN",
  GRAB: "GRAB",
  STRIKE: "STRIKE",
  PRIORITY_SUPPRESS: "PRIORITY_SUPPRESS",
  ARMOR: "ARMOR",
  ABSORB: "ABSORB",
  PARRY: "PARRY",
  DODGE_EVASION: "DODGE_EVASION",
  PHYSICAL_INTANGIBLE: "PHYSICAL_INTANGIBLE",
  PUSHBOX_SUPPRESS: "PUSHBOX_SUPPRESS",
  PRESENTATION_ONLY: "PRESENTATION_ONLY",
});

const CONTACT_OUTCOME = Object.freeze({
  HIT: "HIT",
  TRADE: "TRADE",
  CLASH: "CLASH",
  GRAB_CATCH: "GRAB_CATCH",
  PRIORITY_WIN: "PRIORITY_WIN",
  PRIORITY_LOSS: "PRIORITY_LOSS",
  PARRY: "PARRY",
  ABSORB: "ABSORB",
  WHIFF_EVADE: "WHIFF_EVADE",
});

const SETTLE_POLICY = Object.freeze({
  NONE: "NONE",
  REACTION_SEPARATE: "REACTION_SEPARATE",
  BOUNDED_CONTACT: "BOUNDED_CONTACT",
});

let _interactionSeq = 0;

function mintInteractionId(salt = "cc") {
  _interactionSeq += 1;
  return `${salt}:${_interactionSeq}:${Date.now()}`;
}

function mintActionInstanceId(player, moveType) {
  if (!player) return `${moveType}:unknown:0`;
  player._combatContactActionSeq = (player._combatContactActionSeq || 0) + 1;
  return `${moveType}:${player.id}:${player._combatContactActionSeq}`;
}

/**
 * Body presence ≠ offensive eligibility.
 * Offensive immunity / priority loss must not erase physical body by default.
 */
function classifyBodyPresence(player, opts = {}) {
  if (!player) {
    return {
      present: false,
      pushboxActive: false,
      contactable: false,
      intangibilityReason: null,
      classes: [],
    };
  }

  const classes = [];

  if (player.isBeingThrown || player.isRingOutThrowCutscene) {
    return {
      present: true,
      pushboxActive: false,
      contactable: true,
      intangibilityReason: INTANGIBLE_PASS_THROUGH.THROW_TRAVEL,
      classes: [IMMUNITY_CLASS.PHYSICAL_INTANGIBLE, IMMUNITY_CLASS.PUSHBOX_SUPPRESS],
    };
  }

  if (player.isRopeJumping && player.ropeJumpPhase === "active") {
    return {
      present: false,
      pushboxActive: false,
      contactable: false,
      intangibilityReason: INTANGIBLE_PASS_THROUGH.ROPE_JUMP_ACTIVE,
      classes: [IMMUNITY_CLASS.PHYSICAL_INTANGIBLE, IMMUNITY_CLASS.STRIKE],
    };
  }

  if (
    player.isSlideJumping &&
    player.slideJumpPhase === "flight" &&
    !player.slideJumpDiveCommitted
  ) {
    return {
      present: false,
      pushboxActive: false,
      contactable: false,
      intangibilityReason: INTANGIBLE_PASS_THROUGH.SLIDE_JUMP_FLIGHT,
      classes: [IMMUNITY_CLASS.PHYSICAL_INTANGIBLE, IMMUNITY_CLASS.STRIKE],
    };
  }

  // Charged (non-palm) lunge: pushbox yields for hit detection, body remains.
  if (
    player.isAttacking &&
    player.attackType === "charged" &&
    !player.isPalmThrust
  ) {
    classes.push(IMMUNITY_CLASS.PUSHBOX_SUPPRESS);
    return {
      present: true,
      pushboxActive: false,
      contactable: true,
      intangibilityReason: null,
      classes,
    };
  }

  if (opts.dodgeStrikeIframes) {
    return {
      present: true,
      pushboxActive: false,
      contactable: false,
      intangibilityReason: INTANGIBLE_PASS_THROUGH.DODGE_STRIKE_IFRAMES,
      classes: [IMMUNITY_CLASS.DODGE_EVASION, IMMUNITY_CLASS.STRIKE],
    };
  }

  if (opts.sidestepIframes) {
    return {
      present: true,
      pushboxActive: false,
      contactable: false,
      intangibilityReason: INTANGIBLE_PASS_THROUGH.SIDESTEP_IFRAMES,
      classes: [IMMUNITY_CLASS.DODGE_EVASION, IMMUNITY_CLASS.STRIKE],
    };
  }

  if (player.grabImmune) {
    classes.push(IMMUNITY_CLASS.GRAB);
  }

  return {
    present: true,
    pushboxActive: true,
    contactable: true,
    intangibilityReason: null,
    classes,
  };
}

function isExplicitlyIntangible(presence) {
  return !!(
    presence &&
    presence.intangibilityReason &&
    INTANGIBLE_PASS_THROUGH[presence.intangibilityReason]
  );
}

/**
 * Kill a losing attack's offensive hitbox + active pose on the resolution tick.
 * Does NOT apply hitstun (winner's processHit / grab connect still owns that).
 * Does NOT teleport. Does NOT change the arbitration winner.
 */
function consumeLosingAttackInstance(player, meta = {}) {
  if (!player) return null;
  if (!isCombatContactFidelityV2Enabled() && !meta.forceV2) return null;

  const already =
    !player.isAttacking &&
    !player.isSlapAttack &&
    !player.isPalmThrust &&
    !player.isLowKick;
  if (already && player._combatContactConsumed) {
    return player._lastCombatContactResolution || null;
  }

  const loserMove =
    meta.loserMove ||
    (player.isPalmThrust
      ? "palm"
      : player.isSlapAttack || player.attackType === "slap"
        ? "slap"
        : player.attackType === "charged"
          ? "charged"
          : player.attackType || "attack");

  const loserInstanceId =
    meta.loserActionInstanceId ||
    player._combatContactActionInstanceId ||
    mintActionInstanceId(player, loserMove);

  const winner = meta.winner || null;
  const contactX =
    meta.contactPoint != null
      ? meta.contactPoint
      : winner
        ? getContactSeamX(
            meta.winnerIsAttacker !== false ? winner : player,
            meta.winnerIsAttacker !== false ? player : winner,
            meta.strikeKind ||
              (winner.isPalmThrust
                ? "palm"
                : winner.attackType === "slap"
                  ? "slap"
                  : "charged")
          )
        : player.x;

  const resolution = {
    interactionId: meta.interactionId || mintInteractionId("cc"),
    attackerActionInstanceId: meta.winnerActionInstanceId || null,
    defenderActionInstanceId: loserInstanceId,
    interactionType: meta.interactionType || "STRIKE_PRIORITY",
    outcome: meta.outcome || CONTACT_OUTCOME.PRIORITY_LOSS,
    winnerId: winner?.id ?? meta.winnerId ?? null,
    loserId: player.id,
    winnerMove: meta.winnerMove || null,
    loserMove,
    winnerSurface: meta.winnerSurface || "attack",
    loserSurface: meta.loserSurface || "body",
    contactPoint: { x: contactX, y: player.y || GROUND_LEVEL },
    contactNormal: meta.contactNormal ?? null,
    relativeApproach: meta.relativeApproach ?? null,
    overlapDepth: meta.overlapDepth ?? null,
    bodyPresence: classifyBodyPresence(player),
    intangibilityReason: null,
    reactionType: meta.reactionType || "PENDING_WINNER_REACTION",
    interruptionReason: meta.interruptionReason || "PRIORITY_LOSS",
    settlePolicy: meta.settlePolicy || SETTLE_POLICY.REACTION_SEPARATE,
    presentationProfileId: meta.presentationProfileId || null,
    resolvedTick: meta.resolvedTick || 0,
  };

  // End offensive hitbox + attack presentation ownership immediately.
  player.isAttacking = false;
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.isLowKick = false;
  player.attackType = null;
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.slapActiveEndTime = 0;
  player.chargedActiveEndTime = 0;
  player.lowKickActiveEndTime = 0;
  player.palmThrustVisualUntil = 0;
  player.chargedAttackHit = false;
  player.isChargedHitRecoil = false;
  player.currentAction = null;
  player.actionLockUntil = 0;
  player.slapOpenHitPending = false;
  player.pendingSlapCount = 0;
  player.pendingPalmThrust = false;

  // Stop invalid residual attack travel (charged lunge / slap slide).
  // Do not wipe an already-applied hit knockback.
  if (!player.isHit && meta.stopVelocity !== false) {
    player.movementVelocity = 0;
  }

  player._combatContactConsumed = true;
  player._combatContactConsumedAt = Date.now();
  player._lastCombatContactResolution = resolution;
  player._combatContactActivePoseSurvivalTicks = 0;

  return resolution;
}

function noteWinnerContactResolution(winner, loser, meta = {}) {
  if (!isCombatContactFidelityV2Enabled() && !meta.forceV2) return null;
  if (!winner) return null;
  const contactX =
    meta.contactPoint != null
      ? meta.contactPoint
      : loser
        ? getContactSeamX(winner, loser, meta.strikeKind || "slap")
        : winner.x;
  const resolution = {
    interactionId: meta.interactionId || mintInteractionId("cc"),
    attackerActionInstanceId:
      meta.winnerActionInstanceId ||
      winner._combatContactActionInstanceId ||
      null,
    defenderActionInstanceId:
      meta.loserActionInstanceId ||
      loser?._combatContactActionInstanceId ||
      null,
    interactionType: meta.interactionType || "STRIKE_HIT",
    outcome: meta.outcome || CONTACT_OUTCOME.HIT,
    winnerId: winner.id,
    loserId: loser?.id ?? null,
    winnerMove: meta.winnerMove || winner.attackType || null,
    loserMove: meta.loserMove || null,
    winnerSurface: meta.winnerSurface || "attack",
    loserSurface: meta.loserSurface || "body",
    contactPoint: { x: contactX, y: loser?.y ?? winner.y ?? GROUND_LEVEL },
    contactNormal: meta.contactNormal ?? null,
    relativeApproach: meta.relativeApproach ?? null,
    overlapDepth:
      meta.overlapDepth != null
        ? meta.overlapDepth
        : loser
          ? Math.max(0, 100 - Math.abs(winner.x - loser.x))
          : null,
    bodyPresence: loser ? classifyBodyPresence(loser) : null,
    intangibilityReason: null,
    reactionType: meta.reactionType || "HITSTUN",
    interruptionReason: meta.interruptionReason || "HIT",
    settlePolicy: meta.settlePolicy || SETTLE_POLICY.REACTION_SEPARATE,
    presentationProfileId: meta.presentationProfileId || null,
    resolvedTick: meta.resolvedTick || 0,
  };
  winner._lastCombatContactResolution = resolution;
  if (loser) loser._lastCombatContactResolution = resolution;
  return resolution;
}

function snapshotCombatContactDebug(player) {
  const r = player?._lastCombatContactResolution;
  let slapCharged = null;
  try {
    const {
      getLastSlapChargedResolution,
    } = require("./chargedHeadbuttContact");
    const sc = getLastSlapChargedResolution();
    if (sc) {
      slapCharged = {
        outcome: sc.outcome,
        tSlap: sc.tSlap,
        tCharged: sc.tCharged,
        tSelected: sc.tSelected,
        contactX: sc.contactX,
        approach: sc.approach,
        pointBlank: sc.pointBlank,
        fallbackReason: sc.fallbackReason,
        correction: sc.correction,
        preOverlap: sc.preOverlap,
        postOverlap: sc.postOverlap,
        residualChargedVelocity: sc.residualChargedVelocity,
        losingPoseSurvivalTicks: sc.losingPoseSurvivalTicks,
      };
    }
  } catch (_) {
    slapCharged = null;
  }
  return {
    v2: isCombatContactFidelityV2Enabled(),
    consumed: !!player?._combatContactConsumed,
    activePoseSurvivalTicks: player?._combatContactActivePoseSurvivalTicks ?? 0,
    body: classifyBodyPresence(player),
    last: r
      ? {
          interactionId: r.interactionId,
          outcome: r.outcome,
          winnerId: r.winnerId,
          loserId: r.loserId,
          winnerMove: r.winnerMove,
          loserMove: r.loserMove,
          contactX: r.contactPoint?.x ?? null,
          settlePolicy: r.settlePolicy,
          interruptionReason: r.interruptionReason,
        }
      : null,
    slapCharged,
  };
}

function clearCombatContactState(player) {
  if (!player) return;
  player._combatContactConsumed = false;
  player._combatContactConsumedAt = 0;
  player._combatContactActionInstanceId = null;
  player._combatContactActivePoseSurvivalTicks = 0;
  player._lastCombatContactResolution = null;
}

module.exports = {
  INTANGIBLE_PASS_THROUGH,
  IMMUNITY_CLASS,
  CONTACT_OUTCOME,
  SETTLE_POLICY,
  mintInteractionId,
  mintActionInstanceId,
  classifyBodyPresence,
  isExplicitlyIntangible,
  consumeLosingAttackInstance,
  noteWinnerContactResolution,
  snapshotCombatContactDebug,
  clearCombatContactState,
};

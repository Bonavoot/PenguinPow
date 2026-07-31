"use strict";

/**
 * Authoritative offensive-aerial outcome contract (Phase 1–2).
 *
 * Makes existing slide-jump / FLAP / body-slam results explicit without changing
 * combat feel, timings, damage, knockback, or Rope Jump.
 *
 * See OFFENSIVE_AERIAL_OUTCOME_CONTRACT.md / OFFENSIVE_AERIAL_CLEANUP_CONTRACT.md
 */

const { OFFENSIVE_AERIAL_DEBUG } = require("./offensiveAerialFlags");

const OFFENSIVE_AERIAL_OUTCOME = Object.freeze({
  NONE: "NONE",
  HIT: "HIT",
  PARRIED: "PARRIED",
  WHIFF: "WHIFF",
  INTERRUPTED: "INTERRUPTED",
  TRADE: "TRADE",
  CLASH: "CLASH",
  ARMORED: "ARMORED",
  LANDED_WITHOUT_CONTACT: "LANDED_WITHOUT_CONTACT",
});

/** Outcomes that consume contact / end the offensive hitbox. */
const TERMINAL_CONTACT_OUTCOMES = Object.freeze([
  OFFENSIVE_AERIAL_OUTCOME.HIT,
  OFFENSIVE_AERIAL_OUTCOME.PARRIED,
  OFFENSIVE_AERIAL_OUTCOME.TRADE,
  OFFENSIVE_AERIAL_OUTCOME.CLASH,
  OFFENSIVE_AERIAL_OUTCOME.ARMORED,
]);

/** Any terminal outcome (contact or non-contact). */
const TERMINAL_OUTCOMES = Object.freeze([
  ...TERMINAL_CONTACT_OUTCOMES,
  OFFENSIVE_AERIAL_OUTCOME.WHIFF,
  OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED,
  OFFENSIVE_AERIAL_OUTCOME.LANDED_WITHOUT_CONTACT,
]);

const OFFENSIVE_AERIAL_MOVE_TYPE = Object.freeze({
  NONE: "NONE",
  /** Plain slide-jump that later armed offense (dive) or connected ambient slam. */
  SLIDE_JUMP: "SLIDE_JUMP",
  /** FLAP-armed takeoff (charges granted). */
  FLAP_SLIDE_JUMP: "FLAP_SLIDE_JUMP",
  /** S-dive body slam (may upgrade an existing activation). */
  BODY_SLAM_DIVE: "BODY_SLAM_DIVE",
});

const OFFENSIVE_AERIAL_CLEANUP_STAGE = Object.freeze({
  NONE: "NONE",
  CONTACT_CONSUMED: "CONTACT_CONSUMED",
  AIRBORNE_INTERRUPTED: "AIRBORNE_INTERRUPTED",
  TOUCHDOWN_HANDOFF: "TOUCHDOWN_HANDOFF",
  RECOVERY_COMPLETE: "RECOVERY_COMPLETE",
  FULL_RESET: "FULL_RESET",
});

const OFFENSIVE_AERIAL_MOVEMENT_OWNER = Object.freeze({
  NONE: "NONE",
  SLIDE_JUMP_FLIGHT: "SLIDE_JUMP_FLIGHT",
  FLAP_FLIGHT: "FLAP_FLIGHT",
  DIVE: "DIVE",
  POST_HIT_TRAVEL: "POST_HIT_TRAVEL",
  LANDING_RECOVERY: "LANDING_RECOVERY",
  PARRY_STAGGER: "PARRY_STAGGER",
  EXTERNAL: "EXTERNAL",
});

function emptyOutcomeRecord() {
  return {
    attackInstanceId: null,
    moveType: OFFENSIVE_AERIAL_MOVE_TYPE.NONE,
    outcome: OFFENSIVE_AERIAL_OUTCOME.NONE,
    resolved: false,
    resolvedTick: 0,
    resolvedTime: 0,
    contactConsumed: false,
    contactTargetId: null,
    contactX: null,
    contactY: null,
    contactNormalX: null,
    contactNormalY: null,
    contactAxis: null,
    geometrySource: null,
    fallbackUsed: false,
    sideBeforeContact: 0,
    sideAfterContact: 0,
    movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.NONE,
    landingHandoffReason: null,
    cleanupStage: OFFENSIVE_AERIAL_CLEANUP_STAGE.NONE,
    debugReason: null,
    offensiveArmed: false,
  };
}

function ensureSeq(player) {
  if (!player) return 0;
  if (typeof player._offensiveAerialSeq !== "number") {
    player._offensiveAerialSeq = 0;
  }
  return player._offensiveAerialSeq;
}

function nextAttackInstanceId(player) {
  ensureSeq(player);
  player._offensiveAerialSeq += 1;
  const pid = player.id != null ? String(player.id) : "p";
  return `${pid}:oa:${player._offensiveAerialSeq}`;
}

function getOffensiveAerialActivation(player) {
  return player?.offensiveAerial || null;
}

function hasActiveOffensiveAerial(player) {
  const a = getOffensiveAerialActivation(player);
  return !!(a && a.attackInstanceId);
}

function isContactConsumed(player) {
  const a = getOffensiveAerialActivation(player);
  return !!(a && a.contactConsumed) || !!player?.slideJumpHitLanded;
}

function isTerminalOutcome(outcome) {
  return TERMINAL_OUTCOMES.includes(outcome);
}

function isTerminalContactOutcome(outcome) {
  return TERMINAL_CONTACT_OUTCOMES.includes(outcome);
}

function noteIllegalTransition(player, from, to, reason) {
  if (!player) return;
  player._offensiveAerialIllegalTransitions =
    (player._offensiveAerialIllegalTransitions || 0) + 1;
  player._offensiveAerialLastIllegal = {
    from,
    to,
    reason: reason || null,
    at: Date.now(),
  };
  if (OFFENSIVE_AERIAL_DEBUG) {
    console.warn(
      "[OFFENSIVE_AERIAL_OUTCOME] illegal transition",
      player.id,
      from,
      "→",
      to,
      reason || ""
    );
  }
}

function noteStaleOwnerReject(player, reason) {
  if (!player) return;
  player._offensiveAerialStaleRejects =
    (player._offensiveAerialStaleRejects || 0) + 1;
  player._offensiveAerialLastStaleReject = {
    reason: reason || null,
    at: Date.now(),
  };
  if (OFFENSIVE_AERIAL_DEBUG) {
    console.warn(
      "[OFFENSIVE_AERIAL_OUTCOME] stale-owner reject",
      player.id,
      reason || ""
    );
  }
}

/**
 * Begin a new offensive-aerial activation. Idempotent if the same live
 * activation already exists (detector re-poll must not mint a new ID).
 *
 * @returns {object|null} activation record
 */
function beginOffensiveAerialActivation(player, opts = {}) {
  if (!player) return null;

  const existing = player.offensiveAerial;
  if (
    existing &&
    existing.attackInstanceId &&
    !opts.forceNew &&
    existing.cleanupStage !== OFFENSIVE_AERIAL_CLEANUP_STAGE.FULL_RESET &&
    existing.cleanupStage !== OFFENSIVE_AERIAL_CLEANUP_STAGE.RECOVERY_COMPLETE
  ) {
    // Upgrade move type when dive arms an existing FLAP/slide activation.
    if (
      opts.moveType === OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE &&
      existing.moveType !== OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE
    ) {
      existing.moveType = OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE;
      existing.offensiveArmed = true;
      if (opts.movementOwner) existing.movementOwner = opts.movementOwner;
    } else if (opts.movementOwner) {
      existing.movementOwner = opts.movementOwner;
    }
    return existing;
  }

  const record = emptyOutcomeRecord();
  record.attackInstanceId = nextAttackInstanceId(player);
  record.moveType = opts.moveType || OFFENSIVE_AERIAL_MOVE_TYPE.SLIDE_JUMP;
  record.outcome = OFFENSIVE_AERIAL_OUTCOME.NONE;
  record.offensiveArmed = opts.offensiveArmed !== false;
  record.movementOwner =
    opts.movementOwner || OFFENSIVE_AERIAL_MOVEMENT_OWNER.SLIDE_JUMP_FLIGHT;
  record.debugReason = opts.debugReason || "activation_begin";
  player.offensiveAerial = record;
  return record;
}

/**
 * Ensure an activation exists for contact resolution (ambient plain slam hit).
 * Does not mark offensiveArmed for touchdown WHIFF classification unless asked.
 */
function ensureOffensiveAerialActivationForContact(player, opts = {}) {
  if (!player) return null;
  if (hasActiveOffensiveAerial(player)) {
    return player.offensiveAerial;
  }
  return beginOffensiveAerialActivation(player, {
    moveType: opts.moveType || OFFENSIVE_AERIAL_MOVE_TYPE.SLIDE_JUMP,
    offensiveArmed: true,
    movementOwner:
      opts.movementOwner ||
      (player.slideJumpDiveCommitted
        ? OFFENSIVE_AERIAL_MOVEMENT_OWNER.DIVE
        : player.slideJumpFlapFlightActive
          ? OFFENSIVE_AERIAL_MOVEMENT_OWNER.FLAP_FLIGHT
          : OFFENSIVE_AERIAL_MOVEMENT_OWNER.SLIDE_JUMP_FLIGHT),
    debugReason: opts.debugReason || "ensure_for_contact",
  });
}

/**
 * Resolve a terminal outcome. First terminal wins; identical re-resolve is
 * idempotent; conflicting second terminal is rejected (no throw).
 *
 * @returns {{ ok: boolean, activation: object|null, rejected?: boolean, reason?: string }}
 */
function resolveOffensiveAerialOutcome(player, outcome, meta = {}) {
  if (!player || !outcome) {
    return { ok: false, activation: null, reason: "missing_player_or_outcome" };
  }

  let activation = player.offensiveAerial;
  if (!activation || !activation.attackInstanceId) {
    if (meta.ensureActivation) {
      activation = ensureOffensiveAerialActivationForContact(player, meta);
    } else {
      return { ok: false, activation: null, reason: "no_activation" };
    }
  }

  if (meta.expectedInstanceId != null) {
    if (activation.attackInstanceId !== meta.expectedInstanceId) {
      noteStaleOwnerReject(
        player,
        `resolve expected=${meta.expectedInstanceId} actual=${activation.attackInstanceId}`
      );
      return {
        ok: false,
        activation,
        rejected: true,
        reason: "stale_instance",
      };
    }
  }

  const current = activation.outcome || OFFENSIVE_AERIAL_OUTCOME.NONE;

  if (current === outcome && activation.resolved) {
    // Idempotent duplicate of the same terminal result.
    return { ok: true, activation, rejected: false, reason: "idempotent" };
  }

  if (
    activation.resolved &&
    isTerminalOutcome(current) &&
    current !== outcome
  ) {
    noteIllegalTransition(player, current, outcome, meta.debugReason || "conflict");
    return {
      ok: false,
      activation,
      rejected: true,
      reason: "conflict",
    };
  }

  if (current !== OFFENSIVE_AERIAL_OUTCOME.NONE && current !== outcome) {
    // Non-terminal weirdness — treat as conflict.
    if (isTerminalOutcome(current)) {
      noteIllegalTransition(player, current, outcome, meta.debugReason);
      return {
        ok: false,
        activation,
        rejected: true,
        reason: "conflict",
      };
    }
  }

  activation.outcome = outcome;
  activation.resolved = isTerminalOutcome(outcome);
  activation.resolvedTime =
    meta.resolvedTime != null ? meta.resolvedTime : activation.resolvedTime;
  activation.resolvedTick =
    meta.resolvedTick != null ? meta.resolvedTick : activation.resolvedTick;
  activation.debugReason = meta.debugReason || activation.debugReason;

  if (meta.contactTargetId != null) {
    activation.contactTargetId = meta.contactTargetId;
  }
  // Contact metadata is immutable once written for a terminal contact outcome.
  const contactAlready =
    typeof activation.contactX === "number" &&
    Number.isFinite(activation.contactX);
  if (!contactAlready) {
    if (typeof meta.contactX === "number") activation.contactX = meta.contactX;
    if (typeof meta.contactY === "number") activation.contactY = meta.contactY;
    if (typeof meta.contactNormalX === "number") {
      activation.contactNormalX = meta.contactNormalX;
    }
    if (typeof meta.contactNormalY === "number") {
      activation.contactNormalY = meta.contactNormalY;
    }
    if (meta.contactAxis != null) activation.contactAxis = meta.contactAxis;
    if (meta.geometrySource != null) {
      activation.geometrySource = meta.geometrySource;
    }
    if (meta.fallbackUsed != null) activation.fallbackUsed = !!meta.fallbackUsed;
  } else if (
    typeof meta.contactX === "number" &&
    meta.contactX !== activation.contactX
  ) {
    noteIllegalTransition(
      player,
      activation.outcome,
      outcome,
      "contact_overwrite_rejected"
    );
    player._offensiveAerialContactWriteRejects =
      (player._offensiveAerialContactWriteRejects || 0) + 1;
  }
  if (meta.sideBeforeContact != null) {
    activation.sideBeforeContact = meta.sideBeforeContact;
  }
  if (meta.sideAfterContact != null) {
    activation.sideAfterContact = meta.sideAfterContact;
  }
  if (meta.movementOwner) activation.movementOwner = meta.movementOwner;
  if (meta.landingHandoffReason != null) {
    activation.landingHandoffReason = meta.landingHandoffReason;
  }

  if (isTerminalContactOutcome(outcome) || meta.contactConsumed) {
    activation.contactConsumed = true;
    if (
      activation.cleanupStage === OFFENSIVE_AERIAL_CLEANUP_STAGE.NONE ||
      activation.cleanupStage === OFFENSIVE_AERIAL_CLEANUP_STAGE.CONTACT_CONSUMED
    ) {
      activation.cleanupStage = OFFENSIVE_AERIAL_CLEANUP_STAGE.CONTACT_CONSUMED;
    }
  }

  if (outcome === OFFENSIVE_AERIAL_OUTCOME.HIT) {
    activation.movementOwner =
      meta.movementOwner || OFFENSIVE_AERIAL_MOVEMENT_OWNER.POST_HIT_TRAVEL;
  } else if (outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED) {
    activation.movementOwner =
      meta.movementOwner || OFFENSIVE_AERIAL_MOVEMENT_OWNER.PARRY_STAGGER;
  }

  return { ok: true, activation, rejected: false };
}

function markOffensiveAerialCleanupStage(player, stage, meta = {}) {
  if (!player) return false;
  const activation = player.offensiveAerial;
  if (!activation || !activation.attackInstanceId) {
    if (stage === OFFENSIVE_AERIAL_CLEANUP_STAGE.FULL_RESET) {
      // Still clear debug counters path via reset helper.
      return true;
    }
    return false;
  }
  if (
    meta.expectedInstanceId != null &&
    activation.attackInstanceId !== meta.expectedInstanceId
  ) {
    noteStaleOwnerReject(
      player,
      `cleanup ${stage} expected=${meta.expectedInstanceId}`
    );
    return false;
  }
  activation.cleanupStage = stage;
  if (meta.debugReason) activation.debugReason = meta.debugReason;
  if (meta.landingHandoffReason != null) {
    activation.landingHandoffReason = meta.landingHandoffReason;
  }
  if (meta.movementOwner) activation.movementOwner = meta.movementOwner;
  return true;
}

function markOffensiveAerialLandingHandoff(player, reason, meta = {}) {
  return markOffensiveAerialCleanupStage(
    player,
    OFFENSIVE_AERIAL_CLEANUP_STAGE.TOUCHDOWN_HANDOFF,
    {
      ...meta,
      landingHandoffReason: reason || "touchdown",
      movementOwner:
        meta.movementOwner || OFFENSIVE_AERIAL_MOVEMENT_OWNER.LANDING_RECOVERY,
      debugReason: meta.debugReason || "touchdown_handoff",
    }
  );
}

/**
 * Touchdown terminal selection when still NONE:
 * - armed offensive activation → WHIFF
 * - no activation / unarmed movement → LANDED_WITHOUT_CONTACT (ephemeral record)
 */
function resolveOffensiveAerialTouchdownTerminal(player, meta = {}) {
  if (!player) return { ok: false, activation: null };

  const activation = player.offensiveAerial;
  if (activation && activation.resolved && isTerminalOutcome(activation.outcome)) {
    markOffensiveAerialLandingHandoff(player, meta.reason || "touchdown", meta);
    return { ok: true, activation, reason: "already_resolved" };
  }

  if (activation && activation.attackInstanceId && activation.offensiveArmed) {
    const result = resolveOffensiveAerialOutcome(
      player,
      OFFENSIVE_AERIAL_OUTCOME.WHIFF,
      {
        ...meta,
        debugReason: meta.debugReason || "touchdown_whiff",
        movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.LANDING_RECOVERY,
      }
    );
    markOffensiveAerialLandingHandoff(player, "whiff_touchdown", meta);
    return result;
  }

  // Plain non-offensive (or never-armed) landing.
  const record = beginOffensiveAerialActivation(player, {
    forceNew: true,
    moveType: OFFENSIVE_AERIAL_MOVE_TYPE.SLIDE_JUMP,
    offensiveArmed: false,
    movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.LANDING_RECOVERY,
    debugReason: "landed_without_contact",
  });
  resolveOffensiveAerialOutcome(
    player,
    OFFENSIVE_AERIAL_OUTCOME.LANDED_WITHOUT_CONTACT,
    {
      ...meta,
      debugReason: "landed_without_contact",
      movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.LANDING_RECOVERY,
    }
  );
  markOffensiveAerialLandingHandoff(player, "landed_without_contact", meta);
  return { ok: true, activation: record };
}

/**
 * Finalize after landing recovery (or parry path end). Clears activation.
 * Stale-instance safe.
 */
function finalizeOffensiveAerialActivation(player, meta = {}) {
  if (!player) return false;
  const activation = player.offensiveAerial;
  if (!activation) return true;
  if (
    meta.expectedInstanceId != null &&
    activation.attackInstanceId !== meta.expectedInstanceId
  ) {
    noteStaleOwnerReject(
      player,
      `finalize expected=${meta.expectedInstanceId}`
    );
    return false;
  }
  markOffensiveAerialCleanupStage(
    player,
    OFFENSIVE_AERIAL_CLEANUP_STAGE.RECOVERY_COMPLETE,
    { debugReason: meta.debugReason || "recovery_complete" }
  );
  player.offensiveAerial = null;
  return true;
}

/**
 * Full reset — round / disconnect / clearAll hard teardown.
 * Always clears; records INTERRUPTED only when mid-flight unresolved armed activation
 * and meta.recordInterrupted is true.
 */
function resetOffensiveAerialActivation(player, meta = {}) {
  if (!player) return;

  const activation = player.offensiveAerial;
  if (
    meta.recordInterrupted &&
    activation &&
    activation.attackInstanceId &&
    !activation.resolved &&
    activation.outcome === OFFENSIVE_AERIAL_OUTCOME.NONE &&
    activation.offensiveArmed
  ) {
    resolveOffensiveAerialOutcome(
      player,
      OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED,
      {
        resolvedTime: meta.resolvedTime,
        debugReason: meta.debugReason || "interrupted_reset",
        movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.EXTERNAL,
        contactConsumed: true,
      }
    );
    markOffensiveAerialCleanupStage(
      player,
      OFFENSIVE_AERIAL_CLEANUP_STAGE.AIRBORNE_INTERRUPTED,
      { debugReason: meta.debugReason || "airborne_interrupted" }
    );
  }

  if (player.offensiveAerial) {
    player.offensiveAerial.cleanupStage =
      OFFENSIVE_AERIAL_CLEANUP_STAGE.FULL_RESET;
  }
  player.offensiveAerial = null;
  // Keep _offensiveAerialSeq monotonic across the match (identity uniqueness).
  // Debug counters persist until explicitly cleared on room reset if desired.
  if (meta.clearDebugCounters) {
    player._offensiveAerialIllegalTransitions = 0;
    player._offensiveAerialStaleRejects = 0;
    player._offensiveAerialLastIllegal = null;
    player._offensiveAerialLastStaleReject = null;
  }
}

/**
 * Stale-owner gate for delayed cleanup of move fields.
 * Returns true if cleanup should proceed.
 */
function canCleanupOffensiveAerialInstance(player, expectedInstanceId, meta = {}) {
  if (!player) return false;
  if (expectedInstanceId == null) return true;
  const activation = player.offensiveAerial;
  if (!activation || !activation.attackInstanceId) {
    // Already cleared — idempotent no-op cleanup OK.
    return true;
  }
  if (activation.attackInstanceId !== expectedInstanceId) {
    noteStaleOwnerReject(
      player,
      meta.reason ||
        `canCleanup expected=${expectedInstanceId} actual=${activation.attackInstanceId}`
    );
    return false;
  }
  return true;
}

function snapshotOffensiveAerialDebug(player) {
  const a = player?.offensiveAerial;
  return {
    attackInstanceId: a?.attackInstanceId ?? null,
    moveType: a?.moveType ?? OFFENSIVE_AERIAL_MOVE_TYPE.NONE,
    outcome: a?.outcome ?? OFFENSIVE_AERIAL_OUTCOME.NONE,
    resolved: !!a?.resolved,
    contactConsumed: !!a?.contactConsumed || !!player?.slideJumpHitLanded,
    contactX: a?.contactX ?? null,
    contactY: a?.contactY ?? null,
    contactNormalX: a?.contactNormalX ?? null,
    contactNormalY: a?.contactNormalY ?? null,
    contactAxis: a?.contactAxis ?? null,
    geometrySource: a?.geometrySource ?? null,
    fallbackUsed: !!a?.fallbackUsed,
    resolvedTick: a?.resolvedTick ?? 0,
    resolvedTime: a?.resolvedTime ?? 0,
    cleanupStage: a?.cleanupStage ?? OFFENSIVE_AERIAL_CLEANUP_STAGE.NONE,
    movementOwner: a?.movementOwner ?? OFFENSIVE_AERIAL_MOVEMENT_OWNER.NONE,
    landingHandoffReason: a?.landingHandoffReason ?? null,
    offensiveArmed: !!a?.offensiveArmed,
    latch: !!player?.slideJumpHitLanded,
    staleRejects: player?._offensiveAerialStaleRejects || 0,
    illegalTransitions: player?._offensiveAerialIllegalTransitions || 0,
    contactWriteRejects: player?._offensiveAerialContactWriteRejects || 0,
    lastIllegal: player?._offensiveAerialLastIllegal || null,
    debugReason: a?.debugReason ?? null,
  };
}

module.exports = {
  OFFENSIVE_AERIAL_OUTCOME,
  OFFENSIVE_AERIAL_MOVE_TYPE,
  OFFENSIVE_AERIAL_CLEANUP_STAGE,
  OFFENSIVE_AERIAL_MOVEMENT_OWNER,
  TERMINAL_OUTCOMES,
  TERMINAL_CONTACT_OUTCOMES,
  emptyOutcomeRecord,
  beginOffensiveAerialActivation,
  ensureOffensiveAerialActivationForContact,
  resolveOffensiveAerialOutcome,
  markOffensiveAerialCleanupStage,
  markOffensiveAerialLandingHandoff,
  resolveOffensiveAerialTouchdownTerminal,
  finalizeOffensiveAerialActivation,
  resetOffensiveAerialActivation,
  getOffensiveAerialActivation,
  hasActiveOffensiveAerial,
  isContactConsumed,
  isTerminalOutcome,
  isTerminalContactOutcome,
  canCleanupOffensiveAerialInstance,
  snapshotOffensiveAerialDebug,
  nextAttackInstanceId,
};

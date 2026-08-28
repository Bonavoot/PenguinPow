"use strict";

/**
 * Offensive-aerial post-contact reaction + landing handoff (Phase 4).
 *
 * Gated by OFFENSIVE_AERIAL_REACTION_V2 (default ON; approved heavy_short).
 * When OFF (`=0`), callers must not invoke movement/ownership from this module —
 * legacy Phase 3 paths remain.
 *
 * See OFFENSIVE_AERIAL_POST_CONTACT_REACTIONS.md
 */

const {
  OFFENSIVE_AERIAL_DEBUG,
  isOffensiveAerialReactionV2Enabled,
  getOffensiveAerialReactionPreset,
} = require("./offensiveAerialFlags");
const {
  GROUND_LEVEL,
  AP_STAGGER_FLAP_MS,
  PERFECT_PARRY_ATTACKER_STUN_DURATION,
  FLAP_FASTFALL_GRAVITY,
} = require("./constants");
// Mirror gameUtils map edges (avoid circular require with gameUtils).
const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 935;
const { CONTACT_AXIS } = require("./offensiveAerialContact");
const {
  OFFENSIVE_AERIAL_OUTCOME,
  OFFENSIVE_AERIAL_MOVEMENT_OWNER,
  OFFENSIVE_AERIAL_CLEANUP_STAGE,
  markOffensiveAerialLandingHandoff,
} = require("./offensiveAerialOutcome");
const {
  FACING_LOCK_REASON,
  FACING_RELEASE,
  acquireOffensiveAerialFacingLock,
  handoffOffensiveAerialFacingAtTouchdown,
} = require("./offensiveAerialFacing");

const OFFENSIVE_AERIAL_REACTION = Object.freeze({
  NONE: "NONE",
  HIT_CONTINUATION: "HIT_CONTINUATION",
  PARRIED_RECOIL: "PARRIED_RECOIL",
  WHIFF_DESCENT: "WHIFF_DESCENT",
  INTERRUPTED_FALL: "INTERRUPTED_FALL",
  LANDING_APPROACH: "LANDING_APPROACH",
  LANDING_RECOVERY: "LANDING_RECOVERY",
  COMPLETE: "COMPLETE",
});

const TOUCHDOWN_REASON = Object.freeze({
  HIT_CONTINUATION_TOUCHDOWN: "HIT_CONTINUATION_TOUCHDOWN",
  PARRIED_RECOIL_TOUCHDOWN: "PARRIED_RECOIL_TOUCHDOWN",
  WHIFF_TOUCHDOWN: "WHIFF_TOUCHDOWN",
  INTERRUPTED_TOUCHDOWN: "INTERRUPTED_TOUCHDOWN",
  PLAIN_SLIDE_JUMP_TOUCHDOWN: "PLAIN_SLIDE_JUMP_TOUCHDOWN",
});

const ANIMATION_OWNER = Object.freeze({
  NONE: "NONE",
  ACTIVE_FLIGHT: "ACTIVE_FLIGHT",
  HIT_CONTINUATION: "HIT_CONTINUATION",
  PARRIED_RECOIL: "PARRIED_RECOIL",
  WHIFF_DESCENT: "WHIFF_DESCENT",
  LANDING: "LANDING",
  GROUNDED_STAGGER: "GROUNDED_STAGGER",
  EXTERNAL: "EXTERNAL",
});

/** Development presets — identical eligibility/damage; recoil feel only. */
const REACTION_PRESETS = Object.freeze({
  heavy_short: Object.freeze({
    id: "heavy_short",
    // px / tick @ 64Hz
    lateralRecoilVx: 1.55,
    lateralLiftVy: 2.2,
    downwardRejectVy: 1.1,
    downwardRecoilVx: 0.85,
    diagonalRecoilVx: 1.2,
    diagonalLiftVy: 1.4,
    gravity: FLAP_FASTFALL_GRAVITY * 1.15,
    hFriction: 0.88,
    minLandRecoveryMs: 90,
    maxExtraConsequenceMs: 250,
  }),
  heavy_medium: Object.freeze({
    id: "heavy_medium",
    lateralRecoilVx: 2.05,
    lateralLiftVy: 2.8,
    downwardRejectVy: 1.5,
    downwardRecoilVx: 1.15,
    diagonalRecoilVx: 1.55,
    diagonalLiftVy: 1.9,
    gravity: FLAP_FASTFALL_GRAVITY * 1.05,
    hFriction: 0.9,
    minLandRecoveryMs: 90,
    maxExtraConsequenceMs: 300,
  }),
  /** Comparison only — callers use legacy snap path; values unused. */
  legacy_snap: Object.freeze({
    id: "legacy_snap",
    lateralRecoilVx: 0,
    lateralLiftVy: 0,
    downwardRejectVy: 0,
    downwardRecoilVx: 0,
    diagonalRecoilVx: 0,
    diagonalLiftVy: 0,
    gravity: FLAP_FASTFALL_GRAVITY,
    hFriction: 1,
    minLandRecoveryMs: 0,
    maxExtraConsequenceMs: 0,
  }),
});

function getReactionPreset(id) {
  const key = id || getOffensiveAerialReactionPreset() || "heavy_short";
  return REACTION_PRESETS[key] || REACTION_PRESETS.heavy_short;
}

function emptyReactionRecord() {
  return {
    attackInstanceId: null,
    reactionType: OFFENSIVE_AERIAL_REACTION.NONE,
    reactionStartedTick: 0,
    reactionStartedTime: 0,
    preset: null,
    movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.NONE,
    animationOwner: ANIMATION_OWNER.NONE,
    contactAxis: null,
    contactNormalX: null,
    contactNormalY: null,
    sideAtContact: 0,
    defenderXAtContact: null,
    startX: null,
    startY: null,
    peakY: null,
    peakUpwardDisplacement: 0,
    horizontalRecoilDistance: 0,
    touchdownReason: null,
    touchdownX: null,
    touchdownY: null,
    touchdownSide: 0,
    touchdownOverlap: null,
    firstGroundedCorrection: null,
    recoveryEndsAt: null,
    controlRestoreAt: null,
    cleanupStage: OFFENSIVE_AERIAL_CLEANUP_STAGE.NONE,
    touchdownHandled: false,
    debugReason: null,
  };
}

function getOffensiveAerialReaction(player) {
  return player?.offensiveAerialReaction || null;
}

function isParriedRecoilActive(player) {
  const r = getOffensiveAerialReaction(player);
  return !!(
    r &&
    r.reactionType === OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL &&
    !r.touchdownHandled
  );
}

function isReactionMovementOwner(player) {
  return isParriedRecoilActive(player);
}

function syncReactionTypeWire(player) {
  if (!player) return;
  const r = player.offensiveAerialReaction;
  player.offensiveAerialReactionType =
    r && r.reactionType && r.reactionType !== OFFENSIVE_AERIAL_REACTION.NONE
      ? r.reactionType
      : null;
}

function noteReactionReject(player, reason) {
  if (!player) return;
  player._offensiveAerialReactionRejects =
    (player._offensiveAerialReactionRejects || 0) + 1;
  player._offensiveAerialLastReactionReject = {
    reason: reason || null,
    at: Date.now(),
  };
  if (OFFENSIVE_AERIAL_DEBUG) {
    console.warn(
      "[OFFENSIVE_AERIAL_REACTION] reject",
      player.id,
      reason || ""
    );
  }
}

/**
 * Select post-contact reaction for a terminal outcome. Idempotent for same
 * type+instance; rejects conflicting second selection.
 */
function beginOffensiveAerialReaction(player, reactionType, meta = {}) {
  if (!player || !reactionType) {
    return { ok: false, reaction: null, reason: "missing" };
  }
  if (!isOffensiveAerialReactionV2Enabled() && !meta.force) {
    return { ok: false, reaction: null, reason: "flag_off" };
  }

  const instanceId =
    meta.attackInstanceId ||
    player.offensiveAerial?.attackInstanceId ||
    null;
  const existing = player.offensiveAerialReaction;

  if (
    existing &&
    existing.attackInstanceId &&
    existing.reactionType !== OFFENSIVE_AERIAL_REACTION.NONE &&
    existing.reactionType !== OFFENSIVE_AERIAL_REACTION.COMPLETE
  ) {
    if (
      existing.attackInstanceId === instanceId &&
      existing.reactionType === reactionType
    ) {
      return { ok: true, reaction: existing, reason: "idempotent" };
    }
    if (existing.attackInstanceId !== instanceId) {
      noteReactionReject(
        player,
        `stale_reaction expected=${instanceId} actual=${existing.attackInstanceId}`
      );
      return { ok: false, reaction: existing, rejected: true, reason: "stale" };
    }
    noteReactionReject(
      player,
      `conflict ${existing.reactionType} → ${reactionType}`
    );
    return {
      ok: false,
      reaction: existing,
      rejected: true,
      reason: "conflict",
    };
  }

  const preset = getReactionPreset(meta.preset);
  const record = emptyReactionRecord();
  record.attackInstanceId = instanceId;
  record.reactionType = reactionType;
  record.reactionStartedTick = meta.resolvedTick || 0;
  record.reactionStartedTime =
    meta.resolvedTime != null ? meta.resolvedTime : 0;
  record.preset = preset.id;
  record.contactAxis =
    meta.contactAxis != null
      ? meta.contactAxis
      : player.offensiveAerial?.contactAxis || null;
  record.contactNormalX =
    typeof meta.contactNormalX === "number"
      ? meta.contactNormalX
      : player.offensiveAerial?.contactNormalX ?? null;
  record.contactNormalY =
    typeof meta.contactNormalY === "number"
      ? meta.contactNormalY
      : player.offensiveAerial?.contactNormalY ?? null;
  record.sideAtContact =
    meta.sideAtContact != null
      ? meta.sideAtContact
      : player.offensiveAerial?.sideBeforeContact || 0;
  record.defenderXAtContact =
    typeof meta.defenderXAtContact === "number" ? meta.defenderXAtContact : null;
  record.startX = player.x;
  record.startY = player.y;
  record.peakY = player.y;
  record.debugReason = meta.debugReason || "begin_reaction";
  record.cleanupStage = OFFENSIVE_AERIAL_CLEANUP_STAGE.CONTACT_CONSUMED;

  if (reactionType === OFFENSIVE_AERIAL_REACTION.HIT_CONTINUATION) {
    record.movementOwner = OFFENSIVE_AERIAL_MOVEMENT_OWNER.POST_HIT_TRAVEL;
    record.animationOwner = ANIMATION_OWNER.HIT_CONTINUATION;
  } else if (reactionType === OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL) {
    record.movementOwner = OFFENSIVE_AERIAL_MOVEMENT_OWNER.PARRY_STAGGER;
    record.animationOwner = ANIMATION_OWNER.PARRIED_RECOIL;
    record.controlRestoreAt =
      record.reactionStartedTime +
      (player.isRawParryStun
        ? Math.max(AP_STAGGER_FLAP_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION)
        : AP_STAGGER_FLAP_MS);
  } else if (reactionType === OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT) {
    record.movementOwner = OFFENSIVE_AERIAL_MOVEMENT_OWNER.SLIDE_JUMP_FLIGHT;
    record.animationOwner = ANIMATION_OWNER.WHIFF_DESCENT;
  } else if (reactionType === OFFENSIVE_AERIAL_REACTION.INTERRUPTED_FALL) {
    record.movementOwner = OFFENSIVE_AERIAL_MOVEMENT_OWNER.EXTERNAL;
    record.animationOwner = ANIMATION_OWNER.EXTERNAL;
  }

  player.offensiveAerialReaction = record;
  syncReactionTypeWire(player);
  return { ok: true, reaction: record };
}

/**
 * Compute initial recoil velocities from contact geometry + preset.
 * Normal convention: defender → attacker.
 */
function computeParryRecoilVelocities(player, opponent, contact, preset) {
  const p = preset || getReactionPreset();
  const axis =
    contact?.contactAxis ||
    player.offensiveAerial?.contactAxis ||
    CONTACT_AXIS.LATERAL;

  let side =
    contact?.attackerSideAtContact ||
    player.offensiveAerial?.sideBeforeContact ||
    0;
  if (!side && opponent && typeof opponent.x === "number") {
    side = player.x < opponent.x ? -1 : player.x > opponent.x ? 1 : 0;
  }
  if (!side) {
    const nx = contact?.contactNormalX;
    if (typeof nx === "number" && nx !== 0) side = nx > 0 ? 1 : -1;
  }
  if (!side) side = player.facing || 1;

  // Recoil away from defender: attacker on left (side=-1) recoils further left.
  const away = side < 0 ? -1 : 1;
  let vx = 0;
  let vy = player.slideJumpVelocityY || 0;

  if (axis === CONTACT_AXIS.DOWNWARD) {
    vx = away * p.downwardRecoilVx;
    // Soften plunge; small reject upward, then gravity owns.
    vy = Math.min(vy * 0.25 + p.downwardRejectVy, p.downwardRejectVy + 0.5);
  } else if (axis === CONTACT_AXIS.DOWNWARD_DIAGONAL) {
    vx = away * p.diagonalRecoilVx;
    vy = Math.min(vy * 0.35 + p.diagonalLiftVy, p.diagonalLiftVy + 0.8);
  } else if (axis === CONTACT_AXIS.DEGENERATE_FALLBACK) {
    vx = away * p.lateralRecoilVx * 0.75;
    vy = Math.max(vy, 0) * 0.2 + p.lateralLiftVy * 0.6;
  } else {
    // LATERAL
    vx = away * p.lateralRecoilVx;
    vy = Math.max(0, Math.min(vy, 0)) + p.lateralLiftVy;
  }

  if (!Number.isFinite(vx)) vx = away * p.lateralRecoilVx;
  if (!Number.isFinite(vy)) vy = p.lateralLiftVy;

  return { vx, vy, away, side, axis };
}

/**
 * Arm PARRIED_RECOIL on the attacker without grounding. Clears attack ownership
 * and flight immunity while keeping airborne slide-jump shell for integration.
 */
function armParriedRecoilFlight(flapper, opponent, contact, meta = {}) {
  const preset = getReactionPreset(meta.preset);
  const { vx, vy, side, axis } = computeParryRecoilVelocities(
    flapper,
    opponent,
    contact,
    preset
  );

  // Hitbox permanently dead; no flap/dive resume.
  flapper.slideJumpHitLanded = true;
  flapper.flapCharges = 0;
  flapper.flapVelocityX = 0;
  flapper.slideJumpFlapFlightActive = false;
  flapper.slideJumpDiveCommitted = false;
  flapper.slideJumpDiveBuffered = false;
  flapper.slideJumpDiveBufferUntil = 0;
  flapper.slideJumpDivePhase = null;
  flapper.slideJumpDivePopStartTime = 0;
  flapper.slideJumpDivePopFromHeight = 0;
  flapper.slideJumpFastFalling = false;
  flapper.wJustPressed = false;

  flapper.slideJumpVelocityX = vx;
  flapper.slideJumpVelocityY = vy;

  // Keep airborne shell.
  flapper.isSlideJumping = true;
  flapper.slideJumpPhase = "flight";
  flapper.y = Math.max(flapper.y, GROUND_LEVEL + 0.01);

  // Facing once toward defender (no flicker during recoil / root crossing).
  if (opponent && !flapper.isAtTheRopes && !flapper.atTheRopesFacingDirection) {
    flapper.facing = flapper.x < opponent.x ? -1 : 1;
  }
  acquireOffensiveAerialFacingLock(flapper, {
    supersede: true,
    ownerInstanceId: flapper.offensiveAerial?.attackInstanceId || null,
    direction: flapper.facing,
    reason: FACING_LOCK_REASON.PARRIED_RECOIL,
    releaseCondition: FACING_RELEASE.RECOVERY_COMPLETE,
    allowSteerUpdate: false,
    acquiredTick: meta.resolvedTick || 0,
  });

  const begun = beginOffensiveAerialReaction(
    flapper,
    OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL,
    {
      attackInstanceId: flapper.offensiveAerial?.attackInstanceId,
      resolvedTime: meta.resolvedTime,
      resolvedTick: meta.resolvedTick,
      contactAxis: axis,
      contactNormalX: contact?.contactNormalX,
      contactNormalY: contact?.contactNormalY,
      sideAtContact: side,
      defenderXAtContact: opponent?.x,
      preset: preset.id,
      debugReason: meta.debugReason || "parried_recoil",
    }
  );

  if (begun.reaction) {
    begun.reaction.controlRestoreAt =
      (meta.resolvedTime || 0) + AP_STAGGER_FLAP_MS;
    // Lock inputs for the full consequence window (extends at touchdown if needed).
    flapper.inputLockUntil = Math.max(
      flapper.inputLockUntil || 0,
      begun.reaction.controlRestoreAt
    );
    flapper.actionLockUntil = Math.max(
      flapper.actionLockUntil || 0,
      begun.reaction.controlRestoreAt
    );
  }

  // Do not show grounded stagger while airborne.
  flapper.isRecovering = false;
  flapper.isHit = false;
  flapper.knockbackVelocity = { x: 0, y: 0 };
  flapper.slapParryKnockbackVelocity = 0;
  flapper.movementVelocity = 0;
  flapper.cadenceChain = 0;

  return begun;
}

/**
 * Integrate one tick of PARRIED_RECOIL. Returns true if this tick owned movement.
 */
function stepParriedRecoil(player, opponent, _now) {
  if (!isOffensiveAerialReactionV2Enabled() || !isParriedRecoilActive(player)) {
    return false;
  }
  const reaction = player.offensiveAerialReaction;
  const preset = getReactionPreset(reaction.preset);

  player.slideJumpVelocityY -= preset.gravity;
  player.y += player.slideJumpVelocityY;
  player.x += player.slideJumpVelocityX;
  player.slideJumpVelocityX *= preset.hFriction;
  if (Math.abs(player.slideJumpVelocityX) < 0.05) {
    player.slideJumpVelocityX = 0;
  }

  // Boundary clamp — discard overflow; do not redirect through defender.
  if (player.x < MAP_LEFT_BOUNDARY) player.x = MAP_LEFT_BOUNDARY;
  if (player.x > MAP_RIGHT_BOUNDARY) player.x = MAP_RIGHT_BOUNDARY;

  // Anti-cross: stay on contact side of defender while airborne.
  if (
    opponent &&
    typeof opponent.x === "number" &&
    reaction.sideAtContact !== 0
  ) {
    const sep = 8;
    if (reaction.sideAtContact < 0 && player.x > opponent.x - sep) {
      player.x = opponent.x - sep;
      if (player.slideJumpVelocityX > 0) player.slideJumpVelocityX = 0;
    } else if (reaction.sideAtContact > 0 && player.x < opponent.x + sep) {
      player.x = opponent.x + sep;
      if (player.slideJumpVelocityX < 0) player.slideJumpVelocityX = 0;
    }
  }

  if (typeof reaction.peakY === "number" && player.y > reaction.peakY) {
    reaction.peakY = player.y;
    reaction.peakUpwardDisplacement = Math.max(
      0,
      reaction.peakY - (reaction.startY || GROUND_LEVEL)
    );
  }
  if (typeof reaction.startX === "number") {
    reaction.horizontalRecoilDistance = Math.abs(player.x - reaction.startX);
  }

  return true;
}

function touchdownReasonForOutcome(outcome, reactionType) {
  if (reactionType === OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL) {
    return TOUCHDOWN_REASON.PARRIED_RECOIL_TOUCHDOWN;
  }
  if (reactionType === OFFENSIVE_AERIAL_REACTION.HIT_CONTINUATION) {
    return TOUCHDOWN_REASON.HIT_CONTINUATION_TOUCHDOWN;
  }
  if (reactionType === OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT) {
    return TOUCHDOWN_REASON.WHIFF_TOUCHDOWN;
  }
  if (reactionType === OFFENSIVE_AERIAL_REACTION.INTERRUPTED_FALL) {
    return TOUCHDOWN_REASON.INTERRUPTED_TOUCHDOWN;
  }
  if (outcome === OFFENSIVE_AERIAL_OUTCOME.HIT) {
    return TOUCHDOWN_REASON.HIT_CONTINUATION_TOUCHDOWN;
  }
  if (outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED) {
    return TOUCHDOWN_REASON.PARRIED_RECOIL_TOUCHDOWN;
  }
  if (outcome === OFFENSIVE_AERIAL_OUTCOME.WHIFF) {
    return TOUCHDOWN_REASON.WHIFF_TOUCHDOWN;
  }
  if (outcome === OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED) {
    return TOUCHDOWN_REASON.INTERRUPTED_TOUCHDOWN;
  }
  if (outcome === OFFENSIVE_AERIAL_OUTCOME.LANDED_WITHOUT_CONTACT) {
    return TOUCHDOWN_REASON.PLAIN_SLIDE_JUMP_TOUCHDOWN;
  }
  return TOUCHDOWN_REASON.PLAIN_SLIDE_JUMP_TOUCHDOWN;
}

/**
 * Authoritative touchdown handoff. Idempotent (duplicate rejected).
 * For PARRIED_RECOIL: starts landing recovery / stagger with control deadline.
 */
function applyOffensiveAerialTouchdownHandoff(player, opponent, now, meta = {}) {
  if (!player) return { ok: false, reason: "missing" };

  const reaction = player.offensiveAerialReaction;
  const outcome = player.offensiveAerial?.outcome || null;

  if (reaction?.touchdownHandled) {
    player._offensiveAerialDuplicateTouchdownRejects =
      (player._offensiveAerialDuplicateTouchdownRejects || 0) + 1;
    return { ok: false, rejected: true, reason: "duplicate_touchdown" };
  }

  const reason =
    meta.reason ||
    touchdownReasonForOutcome(outcome, reaction?.reactionType);

  const side =
    opponent && typeof opponent.x === "number"
      ? player.x < opponent.x
        ? -1
        : player.x > opponent.x
          ? 1
          : 0
      : reaction?.sideAtContact || 0;

  if (isOffensiveAerialReactionV2Enabled()) {
    const existingType = reaction?.reactionType;
    const needsWhiff =
      outcome === OFFENSIVE_AERIAL_OUTCOME.WHIFF &&
      (!existingType ||
        existingType === OFFENSIVE_AERIAL_REACTION.NONE ||
        existingType === OFFENSIVE_AERIAL_REACTION.COMPLETE);
    const needsPlain =
      outcome === OFFENSIVE_AERIAL_OUTCOME.LANDED_WITHOUT_CONTACT &&
      (!existingType ||
        existingType === OFFENSIVE_AERIAL_REACTION.NONE ||
        existingType === OFFENSIVE_AERIAL_REACTION.COMPLETE);
    if (needsWhiff) {
      beginOffensiveAerialReaction(
        player,
        OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT,
        {
          attackInstanceId: player.offensiveAerial?.attackInstanceId,
          resolvedTime: now,
          debugReason: "touchdown_whiff_descent",
        }
      );
    } else if (needsPlain) {
      beginOffensiveAerialReaction(
        player,
        OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT,
        {
          attackInstanceId: player.offensiveAerial?.attackInstanceId,
          resolvedTime: now,
          debugReason: "touchdown_plain_landing",
        }
      );
    } else if (!reaction) {
      const mapped =
        outcome === OFFENSIVE_AERIAL_OUTCOME.HIT
          ? OFFENSIVE_AERIAL_REACTION.HIT_CONTINUATION
          : outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
            ? OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL
            : outcome === OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED
              ? OFFENSIVE_AERIAL_REACTION.INTERRUPTED_FALL
              : OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT;
      beginOffensiveAerialReaction(player, mapped, {
        attackInstanceId: player.offensiveAerial?.attackInstanceId,
        resolvedTime: now,
        debugReason: "touchdown_ensure_reaction",
      });
    }
  }

  const r = player.offensiveAerialReaction || emptyReactionRecord();
  if (!player.offensiveAerialReaction) {
    player.offensiveAerialReaction = r;
  }

  r.touchdownHandled = true;
  r.touchdownReason = reason;
  r.touchdownX = player.x;
  r.touchdownY = GROUND_LEVEL;
  r.touchdownSide = side;
  r.reactionType = OFFENSIVE_AERIAL_REACTION.LANDING_RECOVERY;
  r.movementOwner = OFFENSIVE_AERIAL_MOVEMENT_OWNER.LANDING_RECOVERY;
  r.animationOwner = ANIMATION_OWNER.LANDING;
  r.cleanupStage = OFFENSIVE_AERIAL_CLEANUP_STAGE.TOUCHDOWN_HANDOFF;

  // Transfer facing ownership to landing with opponent-facing (not travel face).
  handoffOffensiveAerialFacingAtTouchdown(player, opponent, {
    ownerInstanceId:
      r.attackInstanceId || player.offensiveAerial?.attackInstanceId || null,
  });

  markOffensiveAerialLandingHandoff(player, reason, {
    expectedInstanceId: r.attackInstanceId,
    debugReason: meta.debugReason || "reaction_touchdown",
    movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.LANDING_RECOVERY,
  });

  let recoveryMs = meta.recoveryMs;
  if (recoveryMs == null) {
    recoveryMs = 0;
  }

  // PARRIED: bound control restoration — never earlier than legacy stagger;
  // modest extra allowed for real fall time.
  if (
    outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED ||
    reason === TOUCHDOWN_REASON.PARRIED_RECOIL_TOUCHDOWN
  ) {
    const preset = getReactionPreset(r.preset);
    const contactTime = r.reactionStartedTime || now;
    const parryJailMs = player.isRawParryStun
      ? Math.max(AP_STAGGER_FLAP_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION)
      : AP_STAGGER_FLAP_MS;
    const legacyEnd = contactTime + parryJailMs;
    const maxEnd = legacyEnd + (preset.maxExtraConsequenceMs || 0);
    const landMinEnd = now + (preset.minLandRecoveryMs || 0);
    const controlAt = Math.min(maxEnd, Math.max(legacyEnd, landMinEnd));
    r.controlRestoreAt = controlAt;
    r.recoveryEndsAt = controlAt;
    recoveryMs = Math.max(0, controlAt - now);

    player.isRecovering = true;
    player.lastHitTime = contactTime;
    player.inputLockUntil = Math.max(player.inputLockUntil || 0, controlAt);
    player.actionLockUntil = Math.max(player.actionLockUntil || 0, controlAt);
    r.animationOwner = ANIMATION_OWNER.GROUNDED_STAGGER;

    // Schedule stagger clear at control deadline (sim-clock via timeout manager
    // is set by caller when available; store deadline for landing loop).
    player._oaParryControlRestoreAt = controlAt;
  } else {
    r.recoveryEndsAt = now + recoveryMs;
    if (r.controlRestoreAt == null) {
      r.controlRestoreAt = r.recoveryEndsAt;
    }
  }

  syncReactionTypeWire(player);
  return { ok: true, reason, recoveryMs, reaction: r };
}

function completeOffensiveAerialReaction(player, meta = {}) {
  if (!player) return false;
  const r = player.offensiveAerialReaction;
  if (!r) {
    player.offensiveAerialReactionType = null;
    return true;
  }
  if (
    meta.expectedInstanceId != null &&
    r.attackInstanceId != null &&
    r.attackInstanceId !== meta.expectedInstanceId
  ) {
    noteReactionReject(
      player,
      `complete expected=${meta.expectedInstanceId} actual=${r.attackInstanceId}`
    );
    return false;
  }
  r.reactionType = OFFENSIVE_AERIAL_REACTION.COMPLETE;
  r.cleanupStage = OFFENSIVE_AERIAL_CLEANUP_STAGE.RECOVERY_COMPLETE;
  r.movementOwner = OFFENSIVE_AERIAL_MOVEMENT_OWNER.NONE;
  r.animationOwner = ANIMATION_OWNER.NONE;
  player.offensiveAerialReaction = null;
  player.offensiveAerialReactionType = null;
  player._oaParryControlRestoreAt = 0;
  return true;
}

function resetOffensiveAerialReaction(player) {
  if (!player) return;
  player.offensiveAerialReaction = null;
  player.offensiveAerialReactionType = null;
  player._oaParryControlRestoreAt = 0;
}

function recordTouchdownSpacingMetrics(player, opponent, correctionPx) {
  const r = player?.offensiveAerialReaction;
  if (!r || !r.touchdownHandled) return;
  if (r.touchdownOverlap == null && opponent) {
    // Half-width approximation via root separation vs 110 (typical body).
    const gap = Math.abs(player.x - opponent.x);
    r.touchdownOverlap = Math.max(0, 110 - gap);
  }
  if (correctionPx != null && r.firstGroundedCorrection == null) {
    r.firstGroundedCorrection = correctionPx;
  }
}

function snapshotOffensiveAerialReactionDebug(player) {
  const r = player?.offensiveAerialReaction;
  return {
    flag: isOffensiveAerialReactionV2Enabled(),
    preset: getOffensiveAerialReactionPreset(),
    reactionType: r?.reactionType ?? player?.offensiveAerialReactionType ?? null,
    attackInstanceId: r?.attackInstanceId ?? null,
    movementOwner: r?.movementOwner ?? null,
    animationOwner: r?.animationOwner ?? null,
    contactAxis: r?.contactAxis ?? null,
    contactNormalX: r?.contactNormalX ?? null,
    contactNormalY: r?.contactNormalY ?? null,
    sideAtContact: r?.sideAtContact ?? null,
    velX: player?.slideJumpVelocityX ?? null,
    velY: player?.slideJumpVelocityY ?? null,
    peakUpwardDisplacement: r?.peakUpwardDisplacement ?? null,
    horizontalRecoilDistance: r?.horizontalRecoilDistance ?? null,
    touchdownReason: r?.touchdownReason ?? null,
    touchdownSide: r?.touchdownSide ?? null,
    touchdownOverlap: r?.touchdownOverlap ?? null,
    firstGroundedCorrection: r?.firstGroundedCorrection ?? null,
    recoveryEndsAt: r?.recoveryEndsAt ?? null,
    controlRestoreAt: r?.controlRestoreAt ?? null,
    touchdownHandled: !!r?.touchdownHandled,
    reactionRejects: player?._offensiveAerialReactionRejects || 0,
    duplicateTouchdownRejects:
      player?._offensiveAerialDuplicateTouchdownRejects || 0,
  };
}

module.exports = {
  OFFENSIVE_AERIAL_REACTION,
  TOUCHDOWN_REASON,
  ANIMATION_OWNER,
  REACTION_PRESETS,
  getReactionPreset,
  emptyReactionRecord,
  getOffensiveAerialReaction,
  isParriedRecoilActive,
  isReactionMovementOwner,
  beginOffensiveAerialReaction,
  computeParryRecoilVelocities,
  armParriedRecoilFlight,
  stepParriedRecoil,
  applyOffensiveAerialTouchdownHandoff,
  completeOffensiveAerialReaction,
  resetOffensiveAerialReaction,
  touchdownReasonForOutcome,
  recordTouchdownSpacingMetrics,
  snapshotOffensiveAerialReactionDebug,
  syncReactionTypeWire,
};

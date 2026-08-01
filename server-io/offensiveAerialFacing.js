"use strict";

/**
 * Offensive-aerial facing-lock ownership (Phase 5A).
 *
 * Instance-scoped locks prevent stale aerial cleanup from releasing a newer
 * action's facing, and freeze facing when steer updates would flicker.
 *
 * See OFFENSIVE_AERIAL_STATE_FACING_PHASE.md
 */

const { OFFENSIVE_AERIAL_DEBUG } = require("./offensiveAerialFlags");

const FACING_LOCK_OWNER = Object.freeze({
  OFFENSIVE_AERIAL: "OFFENSIVE_AERIAL",
});

const FACING_LOCK_REASON = Object.freeze({
  FLIGHT: "FLIGHT",
  DIVE: "DIVE",
  HIT_CONTINUATION: "HIT_CONTINUATION",
  PARRIED_RECOIL: "PARRIED_RECOIL",
  WHIFF_DESCENT: "WHIFF_DESCENT",
  LANDING: "LANDING",
  INTERRUPTED: "INTERRUPTED",
});

const FACING_RELEASE = Object.freeze({
  TOUCHDOWN: "TOUCHDOWN",
  RECOVERY_COMPLETE: "RECOVERY_COMPLETE",
  INTERRUPT: "INTERRUPT",
  FULL_RESET: "FULL_RESET",
  OWNER_REPLACED: "OWNER_REPLACED",
  SUPERSEDED: "SUPERSEDED",
});

function sanitizeFacing(dir, fallback = -1) {
  if (dir === 1 || dir === -1) return dir;
  if (typeof dir === "number" && dir > 0) return 1;
  if (typeof dir === "number" && dir < 0) return -1;
  return fallback === 1 || fallback === -1 ? fallback : -1;
}

function facingTowardOpponent(player, opponent) {
  if (!player) return -1;
  if (!opponent || typeof opponent.x !== "number") {
    return sanitizeFacing(player.facing, -1);
  }
  if (player.x === opponent.x) {
    return sanitizeFacing(player.facing, -1);
  }
  return player.x < opponent.x ? -1 : 1;
}

function getOffensiveAerialFacingLock(player) {
  const lock = player?.offensiveAerialFacingLock;
  if (!lock || !lock.active) return null;
  return lock;
}

function isOffensiveAerialFacingLocked(player) {
  return !!getOffensiveAerialFacingLock(player);
}

/** True when air A/D must not rewrite facing (dive / post-contact / landing). */
function aerialFacingAllowsSteer(player) {
  const lock = getOffensiveAerialFacingLock(player);
  if (!lock) return true;
  return !!lock.allowSteerUpdate;
}

function noteFacingReject(player, reason) {
  if (!player) return;
  player._oaFacingStaleRejects = (player._oaFacingStaleRejects || 0) + 1;
  player._oaFacingLastReject = { reason: reason || null, at: Date.now() };
  if (OFFENSIVE_AERIAL_DEBUG) {
    console.warn("[OA_FACING] reject", player.id, reason || "");
  }
}

/**
 * Acquire or upgrade an aerial facing lock for an attack instance.
 * Newer instance always wins; same instance may upgrade reason/direction.
 */
function acquireOffensiveAerialFacingLock(player, meta = {}) {
  if (!player) return null;

  const instanceId =
    meta.ownerInstanceId ||
    player.offensiveAerial?.attackInstanceId ||
    player.offensiveAerialReaction?.attackInstanceId ||
    null;

  const existing = player.offensiveAerialFacingLock;
  if (
    existing &&
    existing.active &&
    existing.ownerInstanceId != null &&
    instanceId != null &&
    existing.ownerInstanceId !== instanceId
  ) {
    // Newer activation supersedes.
    if (meta.force || meta.supersede) {
      existing.active = false;
      player._oaFacingLastRelease = {
        reason: FACING_RELEASE.SUPERSEDED,
        ownerInstanceId: existing.ownerInstanceId,
        at: Date.now(),
      };
    } else {
      noteFacingReject(
        player,
        `acquire stale expected=${instanceId} actual=${existing.ownerInstanceId}`
      );
      return existing;
    }
  }

  const direction = sanitizeFacing(
    meta.direction != null ? meta.direction : player.facing,
    sanitizeFacing(player.facing, -1)
  );

  const lock = {
    ownerType: FACING_LOCK_OWNER.OFFENSIVE_AERIAL,
    ownerInstanceId: instanceId,
    direction,
    reason: meta.reason || FACING_LOCK_REASON.FLIGHT,
    acquiredTick: meta.acquiredTick || 0,
    releaseCondition: meta.releaseCondition || FACING_RELEASE.RECOVERY_COMPLETE,
    allowSteerUpdate: meta.allowSteerUpdate !== false,
    active: true,
  };

  player.offensiveAerialFacingLock = lock;
  player.facing = direction;
  player._oaFacingPreviousValid = direction;
  return lock;
}

/** Update locked direction when explicitly allowed (or force). */
function updateOffensiveAerialFacingLockDirection(player, direction, meta = {}) {
  const lock = getOffensiveAerialFacingLock(player);
  if (!lock) return false;
  if (
    meta.expectedInstanceId != null &&
    lock.ownerInstanceId != null &&
    lock.ownerInstanceId !== meta.expectedInstanceId
  ) {
    noteFacingReject(player, "update_dir_stale_instance");
    return false;
  }
  if (!lock.allowSteerUpdate && !meta.force) return false;
  const dir = sanitizeFacing(direction, lock.direction);
  lock.direction = dir;
  player.facing = dir;
  player._oaFacingPreviousValid = dir;
  return true;
}

/**
 * Release lock for the expected owner. Idempotent.
 * @returns {{ ok: boolean, released: boolean, rejected?: boolean }}
 */
function releaseOffensiveAerialFacingLock(player, meta = {}) {
  if (!player) return { ok: false, released: false };
  const lock = player.offensiveAerialFacingLock;
  if (!lock || !lock.active) {
    return { ok: true, released: false };
  }
  if (
    meta.expectedInstanceId != null &&
    lock.ownerInstanceId != null &&
    lock.ownerInstanceId !== meta.expectedInstanceId
  ) {
    noteFacingReject(
      player,
      `release stale expected=${meta.expectedInstanceId} actual=${lock.ownerInstanceId}`
    );
    return { ok: false, released: false, rejected: true };
  }

  lock.active = false;
  player._oaFacingLastRelease = {
    reason: meta.reason || FACING_RELEASE.RECOVERY_COMPLETE,
    ownerInstanceId: lock.ownerInstanceId,
    at: Date.now(),
  };
  // Keep record for one tick of diagnostics; clear pointer for getLockedFacing.
  player.offensiveAerialFacingLock = null;
  return { ok: true, released: true };
}

function forceClearOffensiveAerialFacingLock(player, meta = {}) {
  if (!player) return;
  if (player.offensiveAerialFacingLock) {
    player._oaFacingLastRelease = {
      reason: meta.reason || FACING_RELEASE.FULL_RESET,
      ownerInstanceId: player.offensiveAerialFacingLock.ownerInstanceId,
      at: Date.now(),
    };
  }
  player.offensiveAerialFacingLock = null;
}

/**
 * Neutral facing after aerial lock release.
 * Order: relative X → previous valid facing → movement sign → fallback -1.
 */
function resolveNeutralFacingAfterAerial(player, opponent) {
  if (!player) return -1;
  if (opponent && typeof opponent.x === "number" && player.x !== opponent.x) {
    return facingTowardOpponent(player, opponent);
  }
  if (player._oaFacingPreviousValid === 1 || player._oaFacingPreviousValid === -1) {
    return player._oaFacingPreviousValid;
  }
  const vx =
    player.slideJumpVelocityX ||
    player.flapVelocityX ||
    player.movementVelocity ||
    0;
  if (vx > 0) return -1;
  if (vx < 0) return 1;
  return sanitizeFacing(player.facing, -1);
}

function applyNeutralFacingAfterAerial(player, opponent) {
  const dir = resolveNeutralFacingAfterAerial(player, opponent);
  player.facing = dir;
  player._oaFacingPreviousValid = dir;
  return dir;
}

/**
 * Touchdown facing handoff (Phase 5A hotfix).
 *
 * Flight / HIT / PARRIED / WHIFF owners freeze travel-facing. At first
 * grounded tick, transfer ownership to LANDING with one opponent-facing
 * resolve — matching Rope Jump's "face opponent once grounded" contract
 * without unlocking into per-tick flicker during recovery.
 */
function handoffOffensiveAerialFacingAtTouchdown(player, opponent, meta = {}) {
  if (!player) return null;
  const dir = resolveNeutralFacingAfterAerial(player, opponent);
  const instanceId =
    meta.ownerInstanceId != null
      ? meta.ownerInstanceId
      : player.offensiveAerial?.attackInstanceId ||
        player.offensiveAerialReaction?.attackInstanceId ||
        null;
  return acquireOffensiveAerialFacingLock(player, {
    supersede: true,
    ownerInstanceId: instanceId,
    direction: dir,
    reason: FACING_LOCK_REASON.LANDING,
    releaseCondition: FACING_RELEASE.RECOVERY_COMPLETE,
    allowSteerUpdate: false,
    acquiredTick: meta.acquiredTick || 0,
  });
}

function snapshotOffensiveAerialFacingDebug(player) {
  const lock = player?.offensiveAerialFacingLock;
  return {
    facing: player?.facing ?? null,
    lockActive: !!(lock && lock.active),
    ownerType: lock?.ownerType ?? null,
    ownerInstanceId: lock?.ownerInstanceId ?? null,
    direction: lock?.direction ?? null,
    reason: lock?.reason ?? null,
    acquiredTick: lock?.acquiredTick ?? null,
    releaseCondition: lock?.releaseCondition ?? null,
    allowSteerUpdate: lock?.allowSteerUpdate ?? null,
    lastRelease: player?._oaFacingLastRelease ?? null,
    staleRejects: player?._oaFacingStaleRejects || 0,
    previousValid: player?._oaFacingPreviousValid ?? null,
  };
}

module.exports = {
  FACING_LOCK_OWNER,
  FACING_LOCK_REASON,
  FACING_RELEASE,
  sanitizeFacing,
  facingTowardOpponent,
  getOffensiveAerialFacingLock,
  isOffensiveAerialFacingLocked,
  aerialFacingAllowsSteer,
  acquireOffensiveAerialFacingLock,
  updateOffensiveAerialFacingLockDirection,
  releaseOffensiveAerialFacingLock,
  forceClearOffensiveAerialFacingLock,
  resolveNeutralFacingAfterAerial,
  applyNeutralFacingAfterAerial,
  handoffOffensiveAerialFacingAtTouchdown,
  snapshotOffensiveAerialFacingDebug,
};

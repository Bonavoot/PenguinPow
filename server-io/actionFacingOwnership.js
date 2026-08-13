"use strict";

/**
 * Non-aerial action facing ownership (Phase 12).
 *
 * Generalizes the Phase 5A instance-owned aerial lock for grounded / clinch /
 * reaction systems. Soft *FacingDirection fields remain as legacy mirrors.
 *
 * Feature flag: ACTION_FACING_OWNERSHIP_V2 — default ON (manually approved).
 *   unset / npm run dev:web                    → hardened path
 *   ACTION_FACING_OWNERSHIP_V2=1|true          → hardened path
 *   ACTION_FACING_OWNERSHIP_V2=0|false         → exact legacy soft locks
 *
 * Offensive-aerial facing stays on offensiveAerialFacing.js (unchanged).
 *
 * See NON_AERIAL_STATE_FACING_PHASE.md
 */

/**
 * Parse ACTION_FACING_OWNERSHIP_V2 (approved default ON).
 *   unset / ""  → true
 *   "1"/"true"  → true
 *   "0"/"false" → false
 * Unrecognized non-empty values default to true with a development warning.
 */
function parseActionFacingOwnershipV2Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[actionFacingOwnership] unrecognized ACTION_FACING_OWNERSHIP_V2=${JSON.stringify(
      String(raw)
    )}; defaulting to V2 on`
  );
  return true;
}

function isActionFacingOwnershipV2Enabled(envValue) {
  if (envValue !== undefined) {
    return parseActionFacingOwnershipV2Flag(envValue);
  }
  if (_actionFacingV2Override != null) return _actionFacingV2Override;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.ACTION_FACING_OWNERSHIP_V2
      : undefined;
  // Re-read env so ACTION_FACING_OWNERSHIP_V2=1|0 works without restart in tests.
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseActionFacingOwnershipV2Flag(raw);
  }
  return ACTION_FACING_OWNERSHIP_V2;
}

/** Boot-time parse (tests prefer setActionFacingOwnershipV2ForTests). */
const ACTION_FACING_OWNERSHIP_V2 = parseActionFacingOwnershipV2Flag(
  process.env.ACTION_FACING_OWNERSHIP_V2
);

/** Test-only override (null = use process.env / boot parse). */
let _actionFacingV2Override = null;

function setActionFacingOwnershipV2ForTests(value) {
  _actionFacingV2Override = value == null ? null : !!value;
}

const ACTION_FACING_OWNER = Object.freeze({
  SLAP: "SLAP",
  PALM: "PALM",
  CHARGED_ATTACK: "CHARGED_ATTACK",
  CHARGE_HOLD: "CHARGE_HOLD",
  DODGE: "DODGE",
  SIDESTEP: "SIDESTEP",
  HITSTUN: "HITSTUN",
  STAGGER: "STAGGER",
  KNOCKDOWN: "KNOCKDOWN",
  ROPES: "ROPES",
  GRAB_STARTUP: "GRAB_STARTUP",
  CLINCH: "CLINCH",
  PULL: "PULL",
  THROWER: "THROWER",
  THROW_VICTIM: "THROW_VICTIM",
  RECOVERY: "RECOVERY",
});

const ACTION_FACING_REASON = Object.freeze({
  COMMIT: "COMMIT",
  CHARGE: "CHARGE",
  TRAVEL: "TRAVEL",
  IMPACT: "IMPACT",
  BOUNDARY: "BOUNDARY",
  CLINCH_INWARD: "CLINCH_INWARD",
  SIDE_SWITCH: "SIDE_SWITCH",
  THROW: "THROW",
  RECOVERY: "RECOVERY",
  INTERRUPT: "INTERRUPT",
});

const ACTION_FACING_RELEASE = Object.freeze({
  ACTION_END: "ACTION_END",
  RECOVERY_COMPLETE: "RECOVERY_COMPLETE",
  INTERRUPT: "INTERRUPT",
  FULL_RESET: "FULL_RESET",
  OWNER_REPLACED: "OWNER_REPLACED",
  SUPERSEDED: "SUPERSEDED",
  TRANSFER: "TRANSFER",
});

/**
 * Relative priority when deciding if a new owner may supersede.
 * Higher wins. Derived from existing getLockedFacing precedence.
 */
const ACTION_FACING_PRIORITY = Object.freeze({
  [ACTION_FACING_OWNER.ROPES]: 100,
  [ACTION_FACING_OWNER.THROW_VICTIM]: 95,
  [ACTION_FACING_OWNER.PULL]: 90,
  [ACTION_FACING_OWNER.HITSTUN]: 85,
  [ACTION_FACING_OWNER.STAGGER]: 85,
  [ACTION_FACING_OWNER.KNOCKDOWN]: 85,
  [ACTION_FACING_OWNER.SLAP]: 70,
  [ACTION_FACING_OWNER.PALM]: 70,
  [ACTION_FACING_OWNER.CHARGED_ATTACK]: 70,
  [ACTION_FACING_OWNER.CHARGE_HOLD]: 65,
  [ACTION_FACING_OWNER.THROWER]: 60,
  [ACTION_FACING_OWNER.CLINCH]: 55,
  [ACTION_FACING_OWNER.GRAB_STARTUP]: 50,
  [ACTION_FACING_OWNER.DODGE]: 40,
  [ACTION_FACING_OWNER.SIDESTEP]: 40,
  [ACTION_FACING_OWNER.RECOVERY]: 20,
});

function sanitizeFacing(dir, fallback = -1) {
  if (dir === 1 || dir === -1) return dir;
  if (typeof dir === "number" && dir > 0) return 1;
  if (typeof dir === "number" && dir < 0) return -1;
  return fallback === 1 || fallback === -1 ? fallback : -1;
}

function mintActionFacingInstanceId(player, ownerType) {
  if (!player) return `${ownerType}:unknown:0`;
  player._actionFacingSeq = (player._actionFacingSeq || 0) + 1;
  return `${ownerType}:${player.id}:${player._actionFacingSeq}`;
}

function getActionFacingLock(player) {
  const lock = player?.actionFacingLock;
  if (!lock || !lock.active) return null;
  return lock;
}

function isActionFacingLocked(player) {
  return !!getActionFacingLock(player);
}

function noteActionFacingReject(player, reason) {
  if (!player) return;
  player._afFacingStaleRejects = (player._afFacingStaleRejects || 0) + 1;
  player._afFacingLastReject = { reason: reason || null, at: Date.now() };
}

function syncLegacySoftFacing(player, ownerType, direction) {
  if (!player) return;
  const dir = sanitizeFacing(direction, player.facing);
  switch (ownerType) {
    case ACTION_FACING_OWNER.SLAP:
      player.slapFacingDirection = dir;
      break;
    case ACTION_FACING_OWNER.PALM:
    case ACTION_FACING_OWNER.CHARGED_ATTACK:
    case ACTION_FACING_OWNER.CHARGE_HOLD:
      player.chargingFacingDirection = dir;
      break;
    case ACTION_FACING_OWNER.ROPES:
      player.atTheRopesFacingDirection = dir;
      break;
    case ACTION_FACING_OWNER.PULL:
      player.pullFacingDirection = dir;
      break;
    case ACTION_FACING_OWNER.THROWER:
      player.throwingFacingDirection = dir;
      break;
    case ACTION_FACING_OWNER.THROW_VICTIM:
      player.beingThrownFacingDirection = dir;
      break;
    default:
      break;
  }
}

function clearLegacySoftFacing(player, ownerType) {
  if (!player) return;
  switch (ownerType) {
    case ACTION_FACING_OWNER.SLAP:
      player.slapFacingDirection = null;
      break;
    case ACTION_FACING_OWNER.PALM:
    case ACTION_FACING_OWNER.CHARGED_ATTACK:
    case ACTION_FACING_OWNER.CHARGE_HOLD:
      player.chargingFacingDirection = null;
      break;
    case ACTION_FACING_OWNER.ROPES:
      player.atTheRopesFacingDirection = null;
      break;
    case ACTION_FACING_OWNER.PULL:
      player.pullFacingDirection = null;
      break;
    case ACTION_FACING_OWNER.THROWER:
      player.throwingFacingDirection = null;
      break;
    case ACTION_FACING_OWNER.THROW_VICTIM:
      player.beingThrownFacingDirection = null;
      break;
    default:
      break;
  }
}

/**
 * Acquire or upgrade a non-aerial facing lock.
 * Newer instance wins when supersede/force; otherwise stale acquire rejects.
 */
function acquireActionFacingLock(player, meta = {}) {
  if (!player) return null;
  if (!isActionFacingOwnershipV2Enabled() && !meta.forceV2) {
    // Legacy path: only mirror soft fields when requested.
    if (meta.syncLegacy !== false && meta.ownerType && meta.direction != null) {
      syncLegacySoftFacing(player, meta.ownerType, meta.direction);
      player.facing = sanitizeFacing(meta.direction, player.facing);
    }
    return null;
  }

  const ownerType = meta.ownerType || ACTION_FACING_OWNER.RECOVERY;
  const instanceId =
    meta.ownerInstanceId || mintActionFacingInstanceId(player, ownerType);
  const priority =
    meta.priority != null
      ? meta.priority
      : ACTION_FACING_PRIORITY[ownerType] || 0;

  const existing = player.actionFacingLock;
  if (existing && existing.active && existing.ownerInstanceId != null) {
    if (existing.ownerInstanceId !== instanceId) {
      const existingPri = existing.priority || 0;
      if (meta.force || meta.supersede || priority >= existingPri) {
        existing.active = false;
        player._afFacingLastRelease = {
          reason: ACTION_FACING_RELEASE.SUPERSEDED,
          ownerInstanceId: existing.ownerInstanceId,
          ownerType: existing.ownerType,
          at: Date.now(),
        };
      } else {
        noteActionFacingReject(
          player,
          `acquire_stale expected=${instanceId} actual=${existing.ownerInstanceId}`
        );
        return existing;
      }
    }
  }

  const direction = sanitizeFacing(
    meta.direction != null ? meta.direction : player.facing,
    sanitizeFacing(player.facing, -1)
  );

  const lock = {
    ownerType,
    ownerInstanceId: instanceId,
    direction,
    reason: meta.reason || ACTION_FACING_REASON.COMMIT,
    priority,
    allowDirectionUpdate: meta.allowDirectionUpdate === true,
    acquiredTick: meta.acquiredTick || 0,
    releaseCondition: meta.releaseCondition || ACTION_FACING_RELEASE.ACTION_END,
    active: true,
  };

  player.actionFacingLock = lock;
  player.facing = direction;
  player._afFacingPreviousValid = direction;
  if (meta.syncLegacy !== false) {
    syncLegacySoftFacing(player, ownerType, direction);
  }
  return lock;
}

function updateActionFacingLockDirection(player, direction, meta = {}) {
  if (!isActionFacingOwnershipV2Enabled() && !meta.forceV2) return false;
  const lock = getActionFacingLock(player);
  if (!lock) return false;
  if (
    meta.expectedInstanceId != null &&
    lock.ownerInstanceId != null &&
    lock.ownerInstanceId !== meta.expectedInstanceId
  ) {
    noteActionFacingReject(player, "update_dir_stale_instance");
    return false;
  }
  if (!lock.allowDirectionUpdate && !meta.force) return false;
  const dir = sanitizeFacing(direction, lock.direction);
  lock.direction = dir;
  player.facing = dir;
  player._afFacingPreviousValid = dir;
  if (meta.syncLegacy !== false) {
    syncLegacySoftFacing(player, lock.ownerType, dir);
  }
  return true;
}

function releaseActionFacingLock(player, meta = {}) {
  if (!player) return { ok: false, released: false };
  if (!isActionFacingOwnershipV2Enabled() && !meta.forceV2) {
    if (meta.ownerType && meta.clearLegacy !== false) {
      clearLegacySoftFacing(player, meta.ownerType);
    }
    return { ok: true, released: false, legacy: true };
  }

  const lock = player.actionFacingLock;
  if (!lock || !lock.active) {
    if (meta.ownerType && meta.clearLegacy !== false) {
      clearLegacySoftFacing(player, meta.ownerType);
    }
    return { ok: true, released: false };
  }
  if (
    meta.expectedInstanceId != null &&
    lock.ownerInstanceId != null &&
    lock.ownerInstanceId !== meta.expectedInstanceId
  ) {
    noteActionFacingReject(
      player,
      `release_stale expected=${meta.expectedInstanceId} actual=${lock.ownerInstanceId}`
    );
    return { ok: false, released: false, rejected: true };
  }
  if (
    meta.expectedOwnerType != null &&
    lock.ownerType != null &&
    lock.ownerType !== meta.expectedOwnerType
  ) {
    noteActionFacingReject(
      player,
      `release_wrong_type expected=${meta.expectedOwnerType} actual=${lock.ownerType}`
    );
    return { ok: false, released: false, rejected: true };
  }

  const ownerType = lock.ownerType;
  lock.active = false;
  player._afFacingLastRelease = {
    reason: meta.reason || ACTION_FACING_RELEASE.ACTION_END,
    ownerInstanceId: lock.ownerInstanceId,
    ownerType,
    at: Date.now(),
  };
  player.actionFacingLock = null;
  if (meta.clearLegacy !== false) {
    clearLegacySoftFacing(player, ownerType);
  }
  return { ok: true, released: true };
}

const STRIKE_FACING_OWNERS = new Set([
  ACTION_FACING_OWNER.SLAP,
  ACTION_FACING_OWNER.PALM,
  ACTION_FACING_OWNER.CHARGED_ATTACK,
  ACTION_FACING_OWNER.CHARGE_HOLD,
]);

/**
 * Drop slap / palm / charged / charge-hold facing when that strike is over
 * (clash, parry pose-drop, absorb). Does not touch ropes / grab / throw / hitstun.
 */
function releaseStrikeFacingLock(player, meta = {}) {
  if (!player) return;
  if (isActionFacingOwnershipV2Enabled() || meta.forceV2) {
    const lock = getActionFacingLock(player);
    if (lock && STRIKE_FACING_OWNERS.has(lock.ownerType)) {
      releaseActionFacingLock(player, {
        expectedInstanceId: lock.ownerInstanceId,
        expectedOwnerType: lock.ownerType,
        reason: meta.reason || ACTION_FACING_RELEASE.INTERRUPT,
        clearLegacy: false,
        forceV2: meta.forceV2,
      });
    }
  }
  player.slapFacingDirection = null;
  player.slapFacingInstanceId = null;
  player.chargingFacingDirection = null;
  player.chargeFacingInstanceId = null;
}

function forceClearActionFacingLock(player, meta = {}) {
  if (!player) return;
  if (player.actionFacingLock) {
    player._afFacingLastRelease = {
      reason: meta.reason || ACTION_FACING_RELEASE.FULL_RESET,
      ownerInstanceId: player.actionFacingLock.ownerInstanceId,
      ownerType: player.actionFacingLock.ownerType,
      at: Date.now(),
    };
  }
  player.actionFacingLock = null;
  if (meta.clearAllLegacy) {
    player.slapFacingDirection = null;
    player.chargingFacingDirection = null;
    player.atTheRopesFacingDirection = null;
    player.pullFacingDirection = null;
    player.throwingFacingDirection = null;
    player.beingThrownFacingDirection = null;
  }
}

/**
 * Neutral facing after non-aerial ownership ends.
 * Matches existing ordinary rule: rel-X → previous valid → movement → -1.
 */
function resolveNeutralFacingAfterAction(player, opponent) {
  if (!player) return -1;
  if (opponent && typeof opponent.x === "number" && player.x !== opponent.x) {
    return player.x < opponent.x ? -1 : 1;
  }
  if (
    player._afFacingPreviousValid === 1 ||
    player._afFacingPreviousValid === -1
  ) {
    return player._afFacingPreviousValid;
  }
  const vx = player.movementVelocity || player.knockbackVelocity?.x || 0;
  if (vx > 0) return -1;
  if (vx < 0) return 1;
  return sanitizeFacing(player.facing, -1);
}

function applyNeutralFacingAfterAction(player, opponent) {
  const dir = resolveNeutralFacingAfterAction(player, opponent);
  player.facing = dir;
  player._afFacingPreviousValid = dir;
  return dir;
}

function snapshotActionFacingDebug(player) {
  const lock = player?.actionFacingLock;
  return {
    v2: isActionFacingOwnershipV2Enabled(),
    facing: player?.facing ?? null,
    lockActive: !!(lock && lock.active),
    ownerType: lock?.ownerType ?? null,
    ownerInstanceId: lock?.ownerInstanceId ?? null,
    direction: lock?.direction ?? null,
    reason: lock?.reason ?? null,
    priority: lock?.priority ?? null,
    allowDirectionUpdate: lock?.allowDirectionUpdate ?? null,
    acquiredTick: lock?.acquiredTick ?? null,
    releaseCondition: lock?.releaseCondition ?? null,
    lastRelease: player?._afFacingLastRelease ?? null,
    lastReject: player?._afFacingLastReject ?? null,
    staleRejects: player?._afFacingStaleRejects || 0,
    previousValid: player?._afFacingPreviousValid ?? null,
  };
}

module.exports = {
  ACTION_FACING_OWNERSHIP_V2,
  parseActionFacingOwnershipV2Flag,
  isActionFacingOwnershipV2Enabled,
  setActionFacingOwnershipV2ForTests,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  ACTION_FACING_RELEASE,
  ACTION_FACING_PRIORITY,
  sanitizeFacing,
  mintActionFacingInstanceId,
  getActionFacingLock,
  isActionFacingLocked,
  acquireActionFacingLock,
  updateActionFacingLockDirection,
  releaseActionFacingLock,
  releaseStrikeFacingLock,
  forceClearActionFacingLock,
  resolveNeutralFacingAfterAction,
  applyNeutralFacingAfterAction,
  snapshotActionFacingDebug,
  syncLegacySoftFacing,
  clearLegacySoftFacing,
};

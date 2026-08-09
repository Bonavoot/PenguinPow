"use strict";

/**
 * Non-aerial action lifecycle ownership (Phase 15).
 *
 * Gates delayed callbacks and interrupt cleanup so an older timeout/completion
 * cannot mutate a newer action. Does not redesign gameplay eligibility/timing.
 *
 * Behind ACTION_LIFECYCLE_OWNERSHIP_V2 (default ON; approved).
 *
 * See ACTION_LIFECYCLE_OWNERSHIP_PHASE.md
 */

const {
  isActionLifecycleOwnershipV2Enabled,
} = require("./actionLifecycleFlags");

/** Ownership domains — overlapping concerns stay separate. */
const LIFECYCLE_DOMAIN = Object.freeze({
  PRIMARY_ACTION: "PRIMARY_ACTION",
  LOCOMOTION: "LOCOMOTION",
  REACTION: "REACTION",
  CLINCH_THROW: "CLINCH_THROW",
});

const LIFECYCLE_PHASE = Object.freeze({
  STARTUP: "STARTUP",
  ACTIVE: "ACTIVE",
  RECOVERY: "RECOVERY",
  ENDLAG: "ENDLAG",
  CONSUMED: "CONSUMED",
  COMPLETE: "COMPLETE",
});

const LIFECYCLE_OWNER = Object.freeze({
  SLAP: "SLAP",
  PALM: "PALM",
  CHARGED: "CHARGED",
  CHARGE_HOLD: "CHARGE_HOLD",
  DODGE: "DODGE",
  SIDESTEP: "SIDESTEP",
  HITSTUN: "HITSTUN",
  PARRY_STAGGER: "PARRY_STAGGER",
  ROPES: "ROPES",
  GRAB_STARTUP: "GRAB_STARTUP",
  CLINCH: "CLINCH",
  THROW: "THROW",
  ENDLAG: "ENDLAG",
});

/**
 * Named timeouts that must die with interrupt/full clear under V2.
 * Legacy (flag off) keeps today's selective clear list.
 */
const LIFECYCLE_TIMEOUT_NAMES = Object.freeze([
  "slapCycle",
  "slapStartupEnd",
  "palmThrustStartupEnd",
  "palmThrustVisualEnd",
  "lowKickCycle",
  "lowKickStartupEnd",
  "chargedStartupEnd",
  "chargedEndlagReset",
  "hitStateReset",
  "chainHitGap",
  "projectileHitStateReset",
  "parryStaggerBegin",
  "parryStaggerReset",
  "parrySuccess",
  "guardCrushReset",
  "cinematicAttackerRecovery",
  "atTheRopesTimeout",
  "grabWhiffRecovery",
  "chargeCancelledClear",
  // Command grab. Replaces the old clinchThrowFailStagger / clinchJoltRecovery
  // timeouts, which belonged to the Open and jolt states the clinch subgame owned.
  "cmdDriveRelease",
  "cmdGrabClashPose",
  "cmdGrabClashSeparate",
]);

function mintLifecycleInstanceId(player, ownerType) {
  if (!player) return `${ownerType}:unknown:0`;
  player._lifecycleSeq = (player._lifecycleSeq || 0) + 1;
  return `${ownerType}:${player.id}:${player._lifecycleSeq}`;
}

function ensureLifecycleState(player) {
  if (!player) return null;
  if (!player.lifecycleOwners) {
    player.lifecycleOwners = Object.create(null);
  }
  return player.lifecycleOwners;
}

function beginLifecycleOwner(player, domain, ownerType, meta = {}) {
  if (!player) return null;
  if (!isActionLifecycleOwnershipV2Enabled() && !meta.forceV2) {
    return null;
  }
  const owners = ensureLifecycleState(player);
  const instanceId =
    meta.ownerInstanceId || mintLifecycleInstanceId(player, ownerType);
  const record = {
    ownerType,
    ownerInstanceId: instanceId,
    phase: meta.phase || LIFECYCLE_PHASE.ACTIVE,
    startedTick: meta.startedTick || 0,
    consumed: false,
    active: true,
    completionCount: 0,
    recoveryStartCount: 0,
    controlRestoreCount: 0,
  };
  owners[domain] = record;
  player._lifecycleLastTransition = {
    domain,
    ownerType,
    ownerInstanceId: instanceId,
    reason: meta.reason || "BEGIN",
    at: Date.now(),
  };
  return record;
}

function getLifecycleOwner(player, domain) {
  const rec = player?.lifecycleOwners?.[domain];
  if (!rec || !rec.active) return null;
  return rec;
}

function isExpectedLifecycleOwner(player, domain, expectedInstanceId) {
  if (!isActionLifecycleOwnershipV2Enabled()) return true;
  if (expectedInstanceId == null) return true;
  const rec = getLifecycleOwner(player, domain);
  if (!rec) return false;
  return rec.ownerInstanceId === expectedInstanceId;
}

function noteLifecycleStaleReject(player, reason) {
  if (!player) return;
  player._lifecycleStaleRejects = (player._lifecycleStaleRejects || 0) + 1;
  player._lifecycleLastReject = { reason: reason || null, at: Date.now() };
}

/**
 * Validate callback still owns the domain. Rejects stale firings.
 * Returns false when the callback must no-op.
 */
function assertLifecycleCallback(player, domain, expectedInstanceId, reason) {
  if (!isActionLifecycleOwnershipV2Enabled()) return true;
  if (!player) return false;
  // V2 callbacks must carry the instance captured at schedule time.
  if (expectedInstanceId == null) {
    noteLifecycleStaleReject(
      player,
      reason || `missing_expected_instance domain=${domain}`
    );
    return false;
  }
  const rec = getLifecycleOwner(player, domain);
  if (!rec || rec.ownerInstanceId !== expectedInstanceId) {
    noteLifecycleStaleReject(
      player,
      reason ||
        `stale_callback domain=${domain} expected=${expectedInstanceId} actual=${rec?.ownerInstanceId || "none"}`
    );
    return false;
  }
  if (rec.consumed) {
    noteLifecycleStaleReject(
      player,
      reason || `stale_callback_consumed domain=${domain} id=${expectedInstanceId}`
    );
    return false;
  }
  return true;
}

function transitionLifecyclePhase(player, domain, expectedInstanceId, phase, meta = {}) {
  if (!isActionLifecycleOwnershipV2Enabled() && !meta.forceV2) return false;
  if (!assertLifecycleCallback(player, domain, expectedInstanceId, "phase_transition")) {
    return false;
  }
  const rec = getLifecycleOwner(player, domain);
  if (!rec) return false;
  rec.phase = phase;
  player._lifecycleLastTransition = {
    domain,
    ownerType: rec.ownerType,
    ownerInstanceId: rec.ownerInstanceId,
    reason: meta.reason || `PHASE_${phase}`,
    at: Date.now(),
  };
  return true;
}

function consumeLifecycleOwner(player, domain, expectedInstanceId, meta = {}) {
  if (!isActionLifecycleOwnershipV2Enabled() && !meta.forceV2) return false;
  if (!player || expectedInstanceId == null) return false;
  const rec = player.lifecycleOwners?.[domain];
  if (!rec || rec.ownerInstanceId !== expectedInstanceId) {
    noteLifecycleStaleReject(
      player,
      meta.reason ||
        `consume_stale domain=${domain} expected=${expectedInstanceId}`
    );
    return false;
  }
  if (rec.consumed) return true; // idempotent
  rec.consumed = true;
  rec.phase = LIFECYCLE_PHASE.CONSUMED;
  rec.active = meta.keepActive === true;
  player._lifecycleLastTransition = {
    domain,
    ownerType: rec.ownerType,
    ownerInstanceId: rec.ownerInstanceId,
    reason: meta.reason || "CONSUME",
    at: Date.now(),
  };
  return true;
}

function completeLifecycleOwner(player, domain, expectedInstanceId, meta = {}) {
  if (!isActionLifecycleOwnershipV2Enabled() && !meta.forceV2) {
    return { ok: true, completed: false, legacy: true };
  }
  if (!player || expectedInstanceId == null) {
    return { ok: false, completed: false, rejected: true };
  }
  const rec = player.lifecycleOwners?.[domain];
  if (!rec || rec.ownerInstanceId !== expectedInstanceId) {
    noteLifecycleStaleReject(
      player,
      meta.reason ||
        `complete_stale domain=${domain} expected=${expectedInstanceId}`
    );
    return { ok: false, completed: false, rejected: true };
  }
  if (rec.completionCount > 0) {
    return { ok: true, completed: false, duplicate: true };
  }
  if (rec.consumed && meta.allowConsumed !== true) {
    // Consumed actions complete as a no-op handoff (already ended).
    rec.completionCount = 1;
    rec.phase = LIFECYCLE_PHASE.COMPLETE;
    rec.active = false;
    return { ok: true, completed: false, alreadyConsumed: true };
  }
  rec.completionCount = 1;
  rec.phase = LIFECYCLE_PHASE.COMPLETE;
  rec.active = false;
  player._lifecycleLastCompletion = {
    domain,
    ownerInstanceId: rec.ownerInstanceId,
    reason: meta.reason || "COMPLETE",
    at: Date.now(),
  };
  return { ok: true, completed: true };
}

function markLifecycleRecoveryStart(player, domain, expectedInstanceId) {
  if (!isActionLifecycleOwnershipV2Enabled()) return true;
  if (!assertLifecycleCallback(player, domain, expectedInstanceId, "recovery_start")) {
    return false;
  }
  const rec = getLifecycleOwner(player, domain);
  if (!rec) return false;
  if (rec.recoveryStartCount > 0) return false;
  rec.recoveryStartCount = 1;
  rec.phase = LIFECYCLE_PHASE.RECOVERY;
  return true;
}

function markLifecycleControlRestore(player, domain, expectedInstanceId) {
  if (!isActionLifecycleOwnershipV2Enabled()) return true;
  // Control restore may fire after owner completed — allow matching id even if inactive.
  const rec = player?.lifecycleOwners?.[domain];
  if (!rec || rec.ownerInstanceId !== expectedInstanceId) {
    noteLifecycleStaleReject(player, "control_restore_stale");
    return false;
  }
  if (rec.controlRestoreCount > 0) return false;
  rec.controlRestoreCount = 1;
  player._lifecycleLastControlRestore = {
    domain,
    ownerInstanceId: expectedInstanceId,
    at: Date.now(),
  };
  return true;
}

function releaseLifecycleOwner(player, domain, expectedInstanceId, meta = {}) {
  if (!isActionLifecycleOwnershipV2Enabled() && !meta.forceV2) {
    return { ok: true, released: false, legacy: true };
  }
  const rec = player?.lifecycleOwners?.[domain];
  if (!rec || !rec.active) {
    return { ok: true, released: false };
  }
  if (
    expectedInstanceId != null &&
    rec.ownerInstanceId !== expectedInstanceId
  ) {
    noteLifecycleStaleReject(
      player,
      `release_stale expected=${expectedInstanceId} actual=${rec.ownerInstanceId}`
    );
    return { ok: false, released: false, rejected: true };
  }
  rec.active = false;
  return { ok: true, released: true };
}

function forceClearLifecycleOwners(player, meta = {}) {
  if (!player) return;
  player.lifecycleOwners = Object.create(null);
  player.slapLifecycleInstanceId = null;
  player.chargedLifecycleInstanceId = null;
  player.chargedEndlagInstanceId = null;
  player.hitstunLifecycleInstanceId = null;
  player.parryStaggerLifecycleInstanceId = null;
  player.dodgeLifecycleInstanceId = null;
  player._lifecycleLastTransition = {
    reason: meta.reason || "FULL_RESET",
    at: Date.now(),
  };
}

function snapshotLifecycleDebug(player) {
  const owners = player?.lifecycleOwners || {};
  const domains = {};
  for (const d of Object.keys(LIFECYCLE_DOMAIN)) {
    const key = LIFECYCLE_DOMAIN[d];
    const rec = owners[key];
    domains[key] = rec
      ? {
          ownerType: rec.ownerType,
          ownerInstanceId: rec.ownerInstanceId,
          phase: rec.phase,
          consumed: !!rec.consumed,
          active: !!rec.active,
          completionCount: rec.completionCount || 0,
          recoveryStartCount: rec.recoveryStartCount || 0,
          controlRestoreCount: rec.controlRestoreCount || 0,
        }
      : null;
  }
  return {
    v2: isActionLifecycleOwnershipV2Enabled(),
    domains,
    lastTransition: player?._lifecycleLastTransition ?? null,
    lastCompletion: player?._lifecycleLastCompletion ?? null,
    lastControlRestore: player?._lifecycleLastControlRestore ?? null,
    lastReject: player?._lifecycleLastReject ?? null,
    staleRejects: player?._lifecycleStaleRejects || 0,
  };
}

module.exports = {
  LIFECYCLE_DOMAIN,
  LIFECYCLE_PHASE,
  LIFECYCLE_OWNER,
  LIFECYCLE_TIMEOUT_NAMES,
  mintLifecycleInstanceId,
  beginLifecycleOwner,
  getLifecycleOwner,
  isExpectedLifecycleOwner,
  assertLifecycleCallback,
  transitionLifecyclePhase,
  consumeLifecycleOwner,
  completeLifecycleOwner,
  markLifecycleRecoveryStart,
  markLifecycleControlRestore,
  releaseLifecycleOwner,
  forceClearLifecycleOwners,
  noteLifecycleStaleReject,
  snapshotLifecycleDebug,
};

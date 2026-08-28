/**
 * HARD RULE: players always face each other unless purposefully locked.
 *
 * Convention (see combatHelpers.js):
 *   facing === -1 → faces right (+X)
 *   facing ===  1 → faces left  (−X)
 *
 * Call enforcePairFacing once per tick AFTER movement / side-switch
 * integration so relative X is final for the frame. Action systems may still
 * snapshot locks (slapFacingDirection, etc.); this module re-applies them and
 * corrects everyone else.
 *
 * Phase 12: when ACTION_FACING_OWNERSHIP_V2 is on, instance-owned
 * actionFacingLock wins over soft *FacingDirection fields.
 */

const {
  getOffensiveAerialFacingLock,
} = require("./offensiveAerialFacing");
const {
  isActionFacingOwnershipV2Enabled,
  getActionFacingLock,
  updateActionFacingLockDirection,
  releaseActionFacingLock,
  ACTION_FACING_OWNER,
  ACTION_FACING_RELEASE,
} = require("./actionFacingOwnership");

/** Desired facing for `player` so they look at `opponent` from current X. */
function facingTowardOpponent(player, opponent) {
  if (!player || !opponent) return player?.facing ?? -1;
  // Exact overlap: don't force both to facing=1 (same direction). Keep current.
  if (player.x === opponent.x) return player.facing;
  return player.x < opponent.x ? -1 : 1;
}

/**
 * Snapshot live-X facing for a NEW strike commit (palm / charged release / slap).
 * Ropes stay frozen. Dodge/sidestep on the opponent must not keep stale facing —
 * the in-flight lock is what prevents a mid-swing flip, not skipping this snapshot.
 */
function commitFacingTowardOpponent(player, opponent) {
  if (!player || !opponent) return player?.facing ?? -1;
  if (player.atTheRopesFacingDirection != null) return player.facing;
  const dir = facingTowardOpponent(player, opponent);
  player.facing = dir;
  return dir;
}

/**
 * If facing must stay fixed for the current action / reaction, return that
 * value. Otherwise return null (caller should face the opponent).
 */
function getLockedFacing(player) {
  if (!player) return null;

  // Grab attempt + whiff recovery: the direction they COMMITTED, not live X.
  // Sidestepping to the other side must not turn this into a rear grab.
  if (
    player.isGrabStartup ||
    player.isGrabbingMovement ||
    player.isWhiffingGrab ||
    player.isGrabWhiffRecovery
  ) {
    if (player.grabFacingDirection === 1 || player.grabFacingDirection === -1) {
      return player.grabFacingDirection;
    }
  }

  // Phase 12 — instance-owned non-aerial lock (when flag enabled).
  if (isActionFacingOwnershipV2Enabled()) {
    const actionLock = getActionFacingLock(player);
    if (actionLock) {
      if (!actionLock.allowDirectionUpdate) {
        return actionLock.direction;
      }
      return player.facing;
    }
  }

  if (
    player.isGrabStartup ||
    player.isGrabbingMovement ||
    player.isWhiffingGrab ||
    player.isGrabWhiffRecovery
  ) {
    return player.facing;
  }

  // Cinematic / ring-out: explicit stored facing
  if (player.atTheRopesFacingDirection != null) {
    return player.atTheRopesFacingDirection;
  }

  // Throw victim: preserve facing for the throw presentation
  if (player.beingThrownFacingDirection != null) {
    return player.beingThrownFacingDirection;
  }
  if (player.isBeingThrown) {
    return player.facing;
  }

  // Pull-kill victim slides past the thrower — don't flip mid-slide
  if (player.isClinchKillPullVictim) {
    return player.facing;
  }

  // Active pull yank: explicit destination lock set at resolve, cleared when the
  // tween settles. Do NOT key this off isAttemptingPull alone — that flag also
  // covers pull startup and can outlive the knockback, which feels like a
  // "timer" blocking correct facing after the yank is done.
  if (player.pullFacingDirection != null) {
    return player.pullFacingDirection;
  }

  // Slap string commit
  if (player.slapFacingDirection != null) {
    return player.slapFacingDirection;
  }

  // Active strike (charged / palm / low kick / slap) — commit direction
  if (player.isAttacking) {
    if (player.chargingFacingDirection != null) {
      return player.chargingFacingDirection;
    }
    return player.facing;
  }

  // Charge windup: forward/back chords stay stable
  if (player.isChargingAttack && player.chargingFacingDirection != null) {
    return player.chargingFacingDirection;
  }

  // Thrower mid-throw: don't thrash while bodies swap
  if (player.isThrowing) {
    return player.facing;
  }

  // Hitstun / ring-out cutscene: keep the facing set by the hit reaction
  if (player.isHit || player.isRingOutPushCutscene) {
    return player.facing;
  }

  // Dodge hop: travel is dodgeDirection; facing stays frozen for the hop
  if (player.isDodging) {
    return player.facing;
  }

  // Sidestep arc: freeze until recovery / end re-faces via enforce
  if (player.isSidestepping) {
    return player.facing;
  }

  // Offensive-aerial instance lock (Phase 5A). Frozen locks win over auto-face;
  // steer-allowed locks still exclude auto-face but air code may update facing.
  const aerialLock = getOffensiveAerialFacingLock(player);
  if (aerialLock) {
    if (!aerialLock.allowSteerUpdate) {
      return aerialLock.direction;
    }
    return player.facing;
  }

  // Flap / slide-jump: excluded from auto-face. Air code owns facing via A/D
  // (free flight facing). Grounded opponent still auto-faces the flier.
  if (player.isFlapping || player.isSlideJumping) {
    return player.facing;
  }

  return null;
}

/** Drop pull facing locks once neither fighter is still in the yank tween. */
function clearOrphanPullFacingLocks(player1, player2) {
  const pullActive =
    !!(player1 &&
      (player1.isBeingPullReversaled || player1.isBoundaryPullSwap)) ||
    !!(player2 &&
      (player2.isBeingPullReversaled || player2.isBoundaryPullSwap));
  if (pullActive) return;
  for (const p of [player1, player2]) {
    if (!p || p.pullFacingDirection == null) continue;
    if (isActionFacingOwnershipV2Enabled()) {
      releaseActionFacingLock(p, {
        expectedInstanceId: p.pullFacingInstanceId,
        expectedOwnerType: ACTION_FACING_OWNER.PULL,
        reason: ACTION_FACING_RELEASE.ACTION_END,
        clearLegacy: false,
      });
      p.pullFacingInstanceId = null;
    }
    p.pullFacingDirection = null;
  }
}

/**
 * After a sidestep, a still-moving charged lunge can flip who is left/right
 * underneath a just-acquired action facing lock. During the short track window
 * stamped at sidestep end, retarget that lock toward the opponent from live X.
 *
 * Non-side-switch (and any case where relative sides didn't change): desired
 * facing equals the lock → no-op.
 */
function retargetPostSidestepActionFacing(player, opponent, nowSim) {
  if (!player || !opponent) return false;
  if (player.atTheRopesFacingDirection != null) return false;
  // Grab commit is a one-way run. Sidestep track is for slap/charge lunches,
  // not for turning a grab around onto someone who crossed.
  if (
    player.isGrabStartup ||
    player.isGrabbingMovement ||
    player.isWhiffingGrab ||
    player.isGrabWhiffRecovery
  ) {
    return false;
  }
  const until = player.postSidestepFacingTrackUntil || 0;
  if (!until || typeof nowSim !== "number" || nowSim >= until) return false;

  const desired = facingTowardOpponent(player, opponent);
  if (desired !== 1 && desired !== -1) return false;

  let changed = false;

  if (isActionFacingOwnershipV2Enabled()) {
    const lock = getActionFacingLock(player);
    if (
      lock &&
      lock.ownerType !== ACTION_FACING_OWNER.GRAB_STARTUP &&
      lock.direction !== desired
    ) {
      updateActionFacingLockDirection(player, desired, {
        force: true,
        syncLegacy: true,
      });
      changed = true;
    }
  }

  // Legacy soft locks (and V2 dual-write leftovers) — only nudge when present.
  if (
    player.slapFacingDirection != null &&
    player.slapFacingDirection !== desired
  ) {
    player.slapFacingDirection = desired;
    changed = true;
  }
  if (
    player.chargingFacingDirection != null &&
    player.chargingFacingDirection !== desired
  ) {
    player.chargingFacingDirection = desired;
    changed = true;
  }

  if (player.facing !== desired) {
    player.facing = desired;
    changed = true;
  }

  return changed;
}

function isChargeHoldFacing(player) {
  if (!player || player.isAttacking) return false;
  if (isActionFacingOwnershipV2Enabled()) {
    const lock = getActionFacingLock(player);
    if (lock && lock.ownerType === ACTION_FACING_OWNER.CHARGE_HOLD) return true;
  }
  return !!(player.isChargingAttack && player.chargingFacingDirection != null);
}

/**
 * Charge windup is not the lunge. After a sidestep / flap / rope-jump cross-up,
 * the holder should look at the new side; release then inherits that facing.
 * CHARGED_ATTACK (the lunge itself) stays frozen.
 */
function retargetChargeHoldFacing(player, opponent) {
  if (!player || !opponent) return false;
  if (player.atTheRopesFacingDirection != null) return false;
  if (!isChargeHoldFacing(player)) return false;

  const desired = facingTowardOpponent(player, opponent);
  if (desired !== 1 && desired !== -1) return false;

  let changed = false;
  if (isActionFacingOwnershipV2Enabled()) {
    const lock = getActionFacingLock(player);
    if (lock && lock.ownerType === ACTION_FACING_OWNER.CHARGE_HOLD && lock.direction !== desired) {
      updateActionFacingLockDirection(player, desired, {
        force: true,
        syncLegacy: true,
      });
      changed = true;
    }
  }
  if (player.chargingFacingDirection != null && player.chargingFacingDirection !== desired) {
    player.chargingFacingDirection = desired;
    changed = true;
  }
  if (player.facing !== desired) {
    player.facing = desired;
    changed = true;
  }
  return changed;
}

/**
 * Apply the hard rule to one player relative to their opponent.
 * @returns {boolean} true if facing was changed
 */
function enforcePlayerFacing(player, opponent) {
  if (!player || !opponent) return false;

  const locked = getLockedFacing(player);
  const next = locked != null ? locked : facingTowardOpponent(player, opponent);
  if (player.facing === next) return false;
  player.facing = next;
  return true;
}

/**
 * Enforce facing for both fighters. Safe to call every tick after movement.
 * When both are in hitstun, leave both alone (neither should auto-correct).
 * @param {number} [nowSim] - room sim clock; enables post-sidestep lock retarget
 */
function enforcePairFacing(player1, player2, nowSim) {
  if (!player1 || !player2) return;

  // Safety: never keep pull destination locks after the yank flags are gone.
  clearOrphanPullFacingLocks(player1, player2);

  if (player1.isHit && player2.isHit) {
    return;
  }

  // Retarget BEFORE getLockedFacing reapplies frozen action directions, so a
  // post-sidestep slap/charge lock can follow a charged lunge side-flip.
  retargetPostSidestepActionFacing(player1, player2, nowSim);
  retargetPostSidestepActionFacing(player2, player1, nowSim);
  retargetChargeHoldFacing(player1, player2);
  retargetChargeHoldFacing(player2, player1);

  enforcePlayerFacing(player1, player2);
  enforcePlayerFacing(player2, player1);
}

module.exports = {
  facingTowardOpponent,
  commitFacingTowardOpponent,
  getLockedFacing,
  clearOrphanPullFacingLocks,
  retargetPostSidestepActionFacing,
  retargetChargeHoldFacing,
  enforcePlayerFacing,
  enforcePairFacing,
};

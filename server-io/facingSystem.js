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
 */

/** Desired facing for `player` so they look at `opponent` from current X. */
function facingTowardOpponent(player, opponent) {
  if (!player || !opponent) return player?.facing ?? -1;
  return player.x < opponent.x ? -1 : 1;
}

/**
 * If facing must stay fixed for the current action / reaction, return that
 * value. Otherwise return null (caller should face the opponent).
 */
function getLockedFacing(player) {
  if (!player) return null;

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

  // Flap / slide-jump: excluded from auto-face. Air code owns facing via A/D
  // (free flight facing). Grounded opponent still auto-faces the flier.
  if (player.isFlapping || player.isSlideJumping) {
    return player.facing;
  }

  return null;
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
 */
function enforcePairFacing(player1, player2) {
  if (!player1 || !player2) return;

  if (player1.isHit && player2.isHit) {
    return;
  }

  enforcePlayerFacing(player1, player2);
  enforcePlayerFacing(player2, player1);
}

module.exports = {
  facingTowardOpponent,
  getLockedFacing,
  enforcePlayerFacing,
  enforcePairFacing,
};

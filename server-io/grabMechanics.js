const {
  GRAB_STATES,
  GROUND_LEVEL,
  GRAB_WHIFF_RECOVERY_MS,
} = require("./constants");

const {
  setPlayerTimeout,
  simNowForPlayer,
  timeoutManager,
} = require("./gameUtils");

const { facingTowardOpponent } = require("./facingSystem");

function correctFacingAfterGrabOrThrow(player, opponent) {
  if (!player || !opponent) return;
  if (player.atTheRopesFacingDirection == null) {
    player.facing = facingTowardOpponent(player, opponent);
  }
  if (opponent.atTheRopesFacingDirection == null) {
    opponent.facing = facingTowardOpponent(opponent, player);
  }
}

// A grab that never found anything. Fully vulnerable for the whole recovery —
// this window is the primary answer to a fished grab, so it is deliberately long
// (450ms, nearly twice a full slap cycle).
function executeGrabWhiff(player) {
  player.isGrabStartup = false;
  player.isGrabbingMovement = false;
  player.y = GROUND_LEVEL;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;
  player.currentAction = null;

  player.isGrabWhiffRecovery = true;
  player.isWhiffingGrab = true;

  player.lastGrabAttemptTime = 0;
  player.lastThrowAttemptTime = 0;

  // movementVelocity is the WALKING channel and must die here — you don't get to
  // keep strafing out of a blown grab. grabMovementVelocity is deliberately left
  // alone: that's the dive's own momentum, and killing it was what made a whiffed
  // grab stop dead mid-lunge. It bleeds off under friction across the recovery, so
  // the miss carries you past your opponent instead of parking you in front of them.
  player.movementVelocity = 0;
  player.isStrafing = false;

  player.actionLockUntil = simNowForPlayer(player) + GRAB_WHIFF_RECOVERY_MS;

  player.grabCooldown = true;

  setPlayerTimeout(
    player.id,
    () => {
      player.isGrabWhiffRecovery = false;
      player.isWhiffingGrab = false;
      player.grabCooldown = false;
    },
    GRAB_WHIFF_RECOVERY_MS,
    "grabWhiffRecovery"
  );

  timeoutManager.clearPlayerSpecific(player.id, "grabMovementTimeout");
}

module.exports = {
  correctFacingAfterGrabOrThrow,
  executeGrabWhiff,
};

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

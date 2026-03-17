const {
  GRAB_STATES,
  GROUND_LEVEL,
  GRAB_WHIFF_RECOVERY_MS,
  CLINCH_SEPARATION_DISTANCE,
  CLINCH_SEPARATION_TWEEN_DURATION,
  CLINCH_SEPARATION_INPUT_LOCK_MS,
  CLINCH_ATTACHED_DISTANCE,
} = require("./constants");

const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  setPlayerTimeout,
  timeoutManager,
} = require("./gameUtils");

const { cleanupGrabStates, activateBufferedInputAfterGrab } = require("./gameFunctions");

function correctFacingAfterGrabOrThrow(player, opponent) {
  if (!player || !opponent) return;
  if (player.atTheRopesFacingDirection == null) {
    player.facing = player.x < opponent.x ? -1 : 1;
  }
  if (opponent.atTheRopesFacingDirection == null) {
    opponent.facing = opponent.x < player.x ? -1 : 1;
  }
}

// Mutual grab: both players grab simultaneously → immediately enter mutual clinch (both get grips).
// No tech animation, no burst push — straight to clinch.
function executeGrabTech(player1, player2, room, io, triggerHitstop) {
  player1.isGrabStartup = false;
  player1.isGrabbingMovement = false;
  player1.isWhiffingGrab = false;
  player1.grabMovementVelocity = 0;
  player1.grabState = GRAB_STATES.INITIAL;
  player1.grabAttemptType = null;
  player1.y = GROUND_LEVEL;

  player2.isGrabStartup = false;
  player2.isGrabbingMovement = false;
  player2.isWhiffingGrab = false;
  player2.grabMovementVelocity = 0;
  player2.grabState = GRAB_STATES.INITIAL;
  player2.grabAttemptType = null;
  player2.y = GROUND_LEVEL;

  player1.movementVelocity = 0;
  player2.movementVelocity = 0;
  player1.isStrafing = false;
  player2.isStrafing = false;

  timeoutManager.clearPlayerSpecific(player1.id, "grabMovementTimeout");
  timeoutManager.clearPlayerSpecific(player2.id, "grabMovementTimeout");

  triggerHitstop(room, 60);

  // Immediately enter mutual clinch (both get grips, no burst push)
  player1.isGrabbing = true;
  player1.grabStartTime = Date.now();
  player1.grabbedOpponent = player2.id;
  player1.hasGrip = true;
  player1.inClinch = true;
  player1.clinchAction = "neutral";
  player1.isGrabPushing = false;
  player1.grabPushStartTime = 0;

  player2.isBeingGrabbed = true;
  player2.hasGrip = true;
  player2.inClinch = true;
  player2.clinchAction = "neutral";

  const dist = CLINCH_ATTACHED_DISTANCE * (player2.sizeMultiplier || 1);
  if (player1.x < player2.x) {
    player2.x = player1.x + dist;
  } else {
    player2.x = player1.x - dist;
  }

  correctFacingAfterGrabOrThrow(player1, player2);
}

// Stalemate forced separation: both players pushed apart, clinch ends.
function executeClinchSeparation(grabber, opponent, room, io) {
  cleanupGrabStates(grabber, opponent);

  grabber.isGrabSeparating = true;
  opponent.isGrabSeparating = true;

  const dir = grabber.x < opponent.x ? -1 : 1;
  grabber.movementVelocity = dir * 1.0;
  opponent.movementVelocity = -dir * 1.0;
  grabber.isStrafing = false;
  opponent.isStrafing = false;

  const lockUntil = Date.now() + CLINCH_SEPARATION_INPUT_LOCK_MS;
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, lockUntil);
  opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, lockUntil);

  correctFacingAfterGrabOrThrow(grabber, opponent);

  const cleanupSep = (p) => {
    setPlayerTimeout(p.id, () => {
      p.isGrabSeparating = false;
      activateBufferedInputAfterGrab(p, [room]);
    }, 300, "clinchSepAnim");
  };
  cleanupSep(grabber);
  cleanupSep(opponent);

  grabber.grabCooldown = true;
  opponent.grabCooldown = true;
  setPlayerTimeout(grabber.id, () => { grabber.grabCooldown = false; }, 500, "clinchSepCooldown");
  setPlayerTimeout(opponent.id, () => { opponent.grabCooldown = false; }, 500, "clinchSepCooldown");

  io.in(room.id).emit("grab_separate", {
    grabberId: grabber.id,
    opponentId: opponent.id,
    grabberX: grabber.x,
    opponentX: opponent.x,
  });
}

function executeGrabWhiff(player) {
  player.isGrabStartup = false;
  player.isGrabbingMovement = false;
  player.y = GROUND_LEVEL;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;

  player.isGrabWhiffRecovery = true;
  player.isWhiffingGrab = true;

  player.lastGrabAttemptTime = 0;
  player.lastThrowAttemptTime = 0;

  player.movementVelocity = 0;
  player.isStrafing = false;

  player.actionLockUntil = Date.now() + GRAB_WHIFF_RECOVERY_MS;

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
  executeClinchSeparation,
  executeGrabTech,
  executeGrabWhiff,
};

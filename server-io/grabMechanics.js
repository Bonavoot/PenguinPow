const {
  GRAB_STATES,
  GROUND_LEVEL,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_TWEEN_DURATION,
  GRAB_BREAK_INPUT_LOCK_MS,
  GRAB_BREAK_ACTION_LOCK_MS,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_RESIDUAL_VEL,
  GRAB_PUSH_SEPARATION_OPPONENT_VEL,
  GRAB_PUSH_SEPARATION_GRABBER_VEL,
  GRAB_PUSH_SEPARATION_INPUT_LOCK,
  GRAB_TECH_FREEZE_MS,
  GRAB_TECH_FORCED_DISTANCE,
  GRAB_TECH_TWEEN_DURATION,
  GRAB_TECH_RESIDUAL_VEL,
  GRAB_TECH_INPUT_LOCK_MS,
  GRAB_TECH_ANIM_DURATION_MS,
  GRAB_WHIFF_RECOVERY_MS,
} = require("./constants");

const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  setPlayerTimeout,
  timeoutManager,
  shouldRestartCharging,
  startCharging,
} = require("./gameUtils");

const { cleanupGrabStates } = require("./gameFunctions");

// Correct both players' facing to match their current positions after throw/grab.
// Prevents wonky dodge/attack direction when a player immediately acts after landing.
function correctFacingAfterGrabOrThrow(player, opponent) {
  if (!player || !opponent) return;
  if (player.atTheRopesFacingDirection == null) {
    player.facing = player.x < opponent.x ? -1 : 1;
  }
  if (opponent.atTheRopesFacingDirection == null) {
    opponent.facing = opponent.x < player.x ? -1 : 1;
  }
}

// Reusable function for executing a grab break when the grabbed player
// successfully inputs the correct counter-direction during a grab action window.
function executeDirectionalGrabBreak(grabber, breaker, room, io, triggerHitstop) {
  grabber.stamina = Math.max(0, grabber.stamina - GRAB_BREAK_STAMINA_COST);
  breaker.stamina = Math.max(0, breaker.stamina - GRAB_BREAK_STAMINA_COST);

  cleanupGrabStates(grabber, breaker);

  breaker.isAttemptingGrabThrow = false;
  grabber.isAttemptingGrabThrow = false;

  breaker.isRawParrySuccess = true;
  setPlayerTimeout(breaker.id, () => { breaker.isRawParrySuccess = false; }, GRAB_BREAK_TWEEN_DURATION, "grabBreakParryAnim");

  breaker.movementVelocity = 0;
  grabber.movementVelocity = 0;
  breaker.isStrafing = false;
  grabber.isStrafing = false;

  const inputLockUntil = Date.now() + GRAB_BREAK_INPUT_LOCK_MS;
  breaker.inputLockUntil = Math.max(breaker.inputLockUntil || 0, inputLockUntil);
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, inputLockUntil);
  breaker.actionLockUntil = Date.now() + GRAB_BREAK_ACTION_LOCK_MS;
  grabber.actionLockUntil = Date.now() + GRAB_BREAK_ACTION_LOCK_MS;

  io.in(room.id).emit("grab_break", {
    breakerId: breaker.id,
    grabberId: grabber.id,
    breakerX: breaker.x,
    grabberX: grabber.x,
    breakId: `grab-break-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    breakerPlayerNumber: breaker.fighter === "player 1" ? 1 : 2,
  });

  triggerHitstop(room, 60);

  const dir = breaker.x < grabber.x ? -1 : 1;
  const now = Date.now();

  let breakerTarget = breaker.x + dir * GRAB_BREAK_FORCED_DISTANCE;
  breakerTarget = Math.max(MAP_LEFT_BOUNDARY, Math.min(breakerTarget, MAP_RIGHT_BOUNDARY));
  breaker.isGrabBreakSeparating = true;
  breaker.grabBreakSepStartTime = now;
  breaker.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
  breaker.grabBreakStartX = breaker.x;
  breaker.grabBreakTargetX = breakerTarget;
  breaker.grabTechResidualVel = dir * GRAB_BREAK_RESIDUAL_VEL;

  let grabberTarget = grabber.x + (-dir) * GRAB_BREAK_FORCED_DISTANCE;
  grabberTarget = Math.max(MAP_LEFT_BOUNDARY, Math.min(grabberTarget, MAP_RIGHT_BOUNDARY));
  grabber.isGrabBreakSeparating = true;
  grabber.grabBreakSepStartTime = now;
  grabber.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
  grabber.grabBreakStartX = grabber.x;
  grabber.grabBreakTargetX = grabberTarget;
  grabber.grabTechResidualVel = (-dir) * GRAB_BREAK_RESIDUAL_VEL;

  grabber.grabCooldown = true;
  breaker.grabCooldown = true;
  setPlayerTimeout(grabber.id, () => { grabber.grabCooldown = false; }, 500, "grabBreakCooldown");
  setPlayerTimeout(breaker.id, () => { breaker.grabCooldown = false; }, 500, "grabBreakCooldown");
}

// When push velocity decays to zero or max duration reached.
// Uses VELOCITY-BASED separation — both players slide apart on ice physics.
function executeGrabSeparation(grabber, opponent, room, io) {
  const pushDirection = grabber.facing === -1 ? 1 : -1;

  cleanupGrabStates(grabber, opponent);

  grabber.isGrabSeparating = true;
  opponent.isGrabSeparating = true;

  opponent.movementVelocity = pushDirection * GRAB_PUSH_SEPARATION_OPPONENT_VEL;
  grabber.movementVelocity = pushDirection * GRAB_PUSH_SEPARATION_GRABBER_VEL;
  opponent.isStrafing = false;
  grabber.isStrafing = false;

  const inputLockUntil = Date.now() + GRAB_PUSH_SEPARATION_INPUT_LOCK;
  opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, inputLockUntil);
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, inputLockUntil);

  correctFacingAfterGrabOrThrow(grabber, opponent);

  setPlayerTimeout(
    grabber.id,
    () => { grabber.isGrabSeparating = false; },
    300,
    "grabSepAnim"
  );
  setPlayerTimeout(
    opponent.id,
    () => { opponent.isGrabSeparating = false; },
    300,
    "grabSepAnim"
  );

  grabber.grabCooldown = true;
  setPlayerTimeout(
    grabber.id,
    () => { grabber.grabCooldown = false; },
    300,
    "grabSepCooldown"
  );

  io.in(room.id).emit("grab_separate", {
    grabberId: grabber.id,
    opponentId: opponent.id,
    grabberX: grabber.x,
    opponentX: opponent.x,
  });
}

// When both players grab simultaneously (one finishes startup while other is in startup).
// Two-phase sequence: FREEZE (350ms shake) -> SEPARATION (knockback push apart).
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

  player1.isGrabTeching = true;
  player2.isGrabTeching = true;

  player1.grabTechRole = 'grabber';
  player2.grabTechRole = 'techer';

  player1.movementVelocity = 0;
  player2.movementVelocity = 0;
  player1.isStrafing = false;
  player2.isStrafing = false;

  const inputLockUntil = Date.now() + GRAB_TECH_INPUT_LOCK_MS;
  player1.inputLockUntil = Math.max(player1.inputLockUntil || 0, inputLockUntil);
  player2.inputLockUntil = Math.max(player2.inputLockUntil || 0, inputLockUntil);
  player1.actionLockUntil = Date.now() + GRAB_TECH_ANIM_DURATION_MS;
  player2.actionLockUntil = Date.now() + GRAB_TECH_ANIM_DURATION_MS;

  timeoutManager.clearPlayerSpecific(player1.id, "grabMovementTimeout");
  timeoutManager.clearPlayerSpecific(player2.id, "grabMovementTimeout");

  const centerX = (player1.x + player2.x) / 2;
  const centerY = (player1.y + player2.y) / 2;
  io.in(room.id).emit("grab_tech", {
    player1Id: player1.id,
    player2Id: player2.id,
    x: centerX,
    y: centerY,
    techId: `grab-tech-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    grabberFacing: player1.x < player2.x ? 1 : -1,
  });

  triggerHitstop(room, 60);

  setPlayerTimeout(player1.id, () => {
    player1.isGrabTeching = false;
    player2.isGrabTeching = false;
    player1.grabTechRole = null;
    player2.grabTechRole = null;

    const dir = player1.x < player2.x ? -1 : 1;
    const now = Date.now();

    let p1Target = player1.x + dir * GRAB_TECH_FORCED_DISTANCE;
    p1Target = Math.max(MAP_LEFT_BOUNDARY, Math.min(p1Target, MAP_RIGHT_BOUNDARY));
    player1.isGrabBreakSeparating = true;
    player1.grabBreakSepStartTime = now;
    player1.grabBreakSepDuration = GRAB_TECH_TWEEN_DURATION;
    player1.grabBreakStartX = player1.x;
    player1.grabBreakTargetX = p1Target;
    player1.grabTechResidualVel = dir * GRAB_TECH_RESIDUAL_VEL;

    let p2Target = player2.x + (-dir) * GRAB_TECH_FORCED_DISTANCE;
    p2Target = Math.max(MAP_LEFT_BOUNDARY, Math.min(p2Target, MAP_RIGHT_BOUNDARY));
    player2.isGrabBreakSeparating = true;
    player2.grabBreakSepStartTime = now;
    player2.grabBreakSepDuration = GRAB_TECH_TWEEN_DURATION;
    player2.grabBreakStartX = player2.x;
    player2.grabBreakTargetX = p2Target;
    player2.grabTechResidualVel = (-dir) * GRAB_TECH_RESIDUAL_VEL;
  }, GRAB_TECH_FREEZE_MS, "grabTechSeparation");

  player1.grabCooldown = true;
  player2.grabCooldown = true;
  setPlayerTimeout(player1.id, () => { player1.grabCooldown = false; }, 500, "grabTechCooldown");
  setPlayerTimeout(player2.id, () => { player2.grabCooldown = false; }, 500, "grabTechCooldown");
}

// When grab misses (opponent not in range). Big vulnerable recovery window.
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
      if (shouldRestartCharging(player)) {
        startCharging(player);
      }
    },
    GRAB_WHIFF_RECOVERY_MS,
    "grabWhiffRecovery"
  );

  timeoutManager.clearPlayerSpecific(player.id, "grabMovementTimeout");
}

module.exports = {
  correctFacingAfterGrabOrThrow,
  executeDirectionalGrabBreak,
  executeGrabSeparation,
  executeGrabTech,
  executeGrabWhiff,
};

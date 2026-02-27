const {
  THROW_RANGE, GRAB_RANGE,
  GRAB_STARTUP_DURATION_MS, SLAP_ATTACK_STARTUP_MS,
  GRAB_STATES,
} = require("./constants");

const {
  timeoutManager,
  setPlayerTimeout,
  clearAllActionStates,
  clearChargeState,
} = require("./gameUtils");

const THROW_TECH_COOLDOWN = 500;
const THROW_TECH_DURATION = 260;
const THROW_TECH_WINDOW = 200;
const TECH_FREEZE_DURATION = 200;
const TECH_KNOCKBACK_VELOCITY = 5;

function isOpponentCloseEnoughForThrow(player, opponent) {
  // Calculate throw range based on player size
  const throwRange = THROW_RANGE * (player.sizeMultiplier || 1);
  return Math.abs(player.x - opponent.x) < throwRange;
}

function isOpponentCloseEnoughForGrab(player, opponent) {
  // Calculate grab range based on player size
  const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
  return Math.abs(player.x - opponent.x) < grabRange;
}

function isOpponentInFrontOfGrabber(player, opponent) {
  // Grab should only connect with opponents who are in front of the grabber,
  // not behind them. Uses player.facing for direction check.
  // facing: 1 = facing left, -1 = facing right
  const BEHIND_TOLERANCE = 20; // Small tolerance (pixels) for near-overlap edge cases
  // Convert facing to direction: facing 1 (left) → check opponent is to left (-1)
  const facingDirection = player.facing === 1 ? -1 : 1;
  // Positive = opponent is in front, negative = opponent is behind
  const relativePos = (opponent.x - player.x) * facingDirection;
  return relativePos >= -BEHIND_TOLERANCE;
}

// First-to-active wins: grab vs slap is deterministic based on when each became active
// Returns true if grab wins (grab became active before slap)
function grabBeatsSlap(grabber, slapper) {
  if (!grabber.grabStartupStartTime || !slapper.attackStartTime) return false;
  const grabStartupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  const grabActiveTime = grabber.grabStartupStartTime + grabStartupMs;
  const slapActiveTime = slapper.attackStartTime + SLAP_ATTACK_STARTUP_MS;
  return grabActiveTime < slapActiveTime;
}

function checkForThrowTech(player, opponent) {
  const currentTime = Date.now();

  // If either player is on cooldown, no throw tech can occur
  if (player.throwTechCooldown || opponent.throwTechCooldown) {
    return false;
  }

  // If either player is already in a throw tech animation, prevent new throw techs
  if (player.isThrowTeching || opponent.isThrowTeching) {
    return false;
  }

  // Players in whiff recovery cannot tech — they are fully vulnerable
  if (player.isWhiffingGrab || player.isGrabWhiffRecovery ||
      opponent.isWhiffingGrab || opponent.isGrabWhiffRecovery) {
    return false;
  }

  // Only check for throw tech if both players have recent throw attempt times
  if (!player.lastThrowAttemptTime || !opponent.lastThrowAttemptTime) {
    return false;
  }

  // Clean up old throw attempts that are outside the tech window
  if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
    player.lastThrowAttemptTime = 0;
    return false;
  }
  if (currentTime - opponent.lastThrowAttemptTime > THROW_TECH_WINDOW) {
    opponent.lastThrowAttemptTime = 0;
    return false;
  }

  // Check only for simultaneous throws
  const bothThrew =
    player.lastThrowAttemptTime &&
    opponent.lastThrowAttemptTime &&
    Math.abs(player.lastThrowAttemptTime - opponent.lastThrowAttemptTime) <=
      THROW_TECH_WINDOW;

  return bothThrew;
}

function checkForGrabPriority(player, opponent) {
  const currentTime = Date.now();

  // Players in whiff recovery have no grab priority — they are fully vulnerable
  if (player.isWhiffingGrab || player.isGrabWhiffRecovery ||
      opponent.isWhiffingGrab || opponent.isGrabWhiffRecovery) {
    return false;
  }

  // Clean up old attempts that are outside the window
  if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
    player.lastThrowAttemptTime = 0;
  }
  if (currentTime - opponent.lastGrabAttemptTime > THROW_TECH_WINDOW) {
    opponent.lastGrabAttemptTime = 0;
  }

  // Check if opponent grabbed while this player is trying to throw
  const opponentGrabbedDuringThrow =
    player.lastThrowAttemptTime &&
    opponent.lastGrabAttemptTime &&
    Math.abs(player.lastThrowAttemptTime - opponent.lastGrabAttemptTime) <=
      THROW_TECH_WINDOW;

  return opponentGrabbedDuringThrow;
}

function resolveGrabClash(room, io) {
  if (!room.grabClashData) {
    return;
  }

  const player1 = room.players.find(
    (p) => p.id === room.grabClashData.player1Id
  );
  const player2 = room.players.find(
    (p) => p.id === room.grabClashData.player2Id
  );

  if (!player1 || !player2) {
    return;
  }

  let winner, loser;
  if (room.grabClashData.player1Inputs > room.grabClashData.player2Inputs) {
    winner = player1;
    loser = player2;
  } else if (
    room.grabClashData.player2Inputs > room.grabClashData.player1Inputs
  ) {
    winner = player2;
    loser = player1;
  } else {
    // Tie - random winner
    const randomWinner = Math.random() < 0.5;
    winner = randomWinner ? player1 : player2;
    loser = randomWinner ? player2 : player1;
  }

  // Clear clash states for both players
  player1.isGrabClashing = false;
  player1.grabClashStartTime = 0;
  player1.grabClashInputCount = 0;
  player2.isGrabClashing = false;
  player2.grabClashStartTime = 0;
  player2.grabClashInputCount = 0;

  // Clear grab attempt states for winner (transition out of "attempting" animation)
  winner.isGrabbingMovement = false;
  winner.isGrabStartup = false;
  winner.isWhiffingGrab = false;
  winner.grabMovementVelocity = 0;
  winner.movementVelocity = 0;
  winner.isStrafing = false;
  winner.grabState = GRAB_STATES.INITIAL;
  winner.grabAttemptType = null;
  winner.isRawParrySuccess = false;
  winner.isPerfectRawParrySuccess = false;

  // Set up grab for winner
  winner.isGrabbing = true;
  winner.grabStartTime = Date.now();
  winner.grabbedOpponent = loser.id;
  // Reset grab decision/action state from any previous grab
  winner.grabDecisionMade = false;
  winner.grabPushEndTime = 0;
  winner.grabPushStartTime = 0;
  winner.grabApproachSpeed = 0;
  winner.isGrabPushing = false;
  winner.isEdgePushing = false;
  winner.isGrabWalking = false;
  winner.grabActionType = null;
  winner.grabActionStartTime = 0;
  winner.grabDurationPaused = false;
  winner.grabDurationPausedAt = 0;
  winner.isAtBoundaryDuringGrab = false;
  winner.lastGrabPushStaminaDrainTime = 0;
  winner.isAttemptingPull = false;
  winner.isAttemptingGrabThrow = false;
  
  // CRITICAL: Clear ALL action states when being grabbed
  clearAllActionStates(loser);
  loser.isBeingGrabbed = true;
  loser.isBeingGrabPushed = false;
  loser.isBeingEdgePushed = false;
  loser.lastGrabPushStaminaDrainTime = 0;
  
  // If loser was at the ropes, clear that state but keep the facing direction locked
  if (loser.isAtTheRopes) {
    timeoutManager.clearPlayerSpecific(loser.id, "atTheRopesTimeout");
    loser.isAtTheRopes = false;
    loser.atTheRopesStartTime = 0;
    // Keep atTheRopesFacingDirection - this will lock their facing during the grab
  }

  // Set grab facing direction for winner
  if (winner.isChargingAttack) {
    winner.grabFacingDirection = winner.chargingFacingDirection;
  } else {
    winner.grabFacingDirection = winner.facing;
  }

  // Emit clash result before clearing data
  io.in(room.id).emit("grab_clash_end", {
    winnerId: winner.id,
    loserId: loser.id,
    winnerInputs:
      winner.id === room.grabClashData.player1Id
        ? room.grabClashData.player1Inputs
        : room.grabClashData.player2Inputs,
    loserInputs:
      loser.id === room.grabClashData.player1Id
        ? room.grabClashData.player1Inputs
        : room.grabClashData.player2Inputs,
  });

  // Clear room clash data
  delete room.grabClashData;

}

function applyThrowTech(player, opponent) {
  const knockbackDirection = player.x < opponent.x ? -1 : 1;

  // Clear all throw/grab states
  player.isThrowing = false;
  player.isGrabbing = false;
  player.isBeingThrown = false;
  player.isBeingGrabbed = false;
  player.grabbedOpponent = null;
  player.isHit = false;
  player.isAlreadyHit = false;

  opponent.isThrowing = false;
  opponent.isGrabbing = false;
  opponent.isBeingThrown = false;
  opponent.isBeingGrabbed = false;
  opponent.grabbedOpponent = null;
  opponent.isPushing = false;
  opponent.isBeingPushed = false;
  opponent.isBeingPulled = false;
  opponent.isHit = false;
  opponent.isAlreadyHit = false;

  // Clear charge attack states
  clearChargeState(player);
  clearChargeState(opponent);

  // Set up tech state
  player.isThrowTeching = true;
  opponent.isThrowTeching = true;

  // Add freeze timing properties
  player.techFreezeStartTime = Date.now();
  opponent.techFreezeStartTime = Date.now();

  // Store knockback values
  player.pendingKnockback = TECH_KNOCKBACK_VELOCITY * knockbackDirection;
  opponent.pendingKnockback = TECH_KNOCKBACK_VELOCITY * -knockbackDirection;

  // Clear attempt times
  player.lastThrowAttemptTime = 0;
  player.lastGrabAttemptTime = 0;
  opponent.lastThrowAttemptTime = 0;
  opponent.lastGrabAttemptTime = 0;

  // Reset grab cooldowns
  player.grabCooldown = false;
  opponent.grabCooldown = false;

  // Apply cooldown
  player.throwTechCooldown = true;
  opponent.throwTechCooldown = true;

  // Reset throw tech animation after duration
  setPlayerTimeout(
    player.id,
    () => {
      player.isThrowTeching = false;
      opponent.isThrowTeching = false;
    },
    THROW_TECH_DURATION
  );

  // Reset cooldown after longer duration
  setPlayerTimeout(
    player.id,
    () => {
      player.throwTechCooldown = false;
      opponent.throwTechCooldown = false;
    },
    THROW_TECH_COOLDOWN
  );
}

module.exports = {
  THROW_TECH_COOLDOWN,
  THROW_TECH_DURATION,
  THROW_TECH_WINDOW,
  TECH_FREEZE_DURATION,
  TECH_KNOCKBACK_VELOCITY,
  isOpponentCloseEnoughForThrow,
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  grabBeatsSlap,
  checkForThrowTech,
  checkForGrabPriority,
  resolveGrabClash,
  applyThrowTech,
};

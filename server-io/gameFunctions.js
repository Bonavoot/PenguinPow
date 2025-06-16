// Import required utilities
const {
  setPlayerTimeout,
  resetPlayerAttackStates,
  clearChargeState,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");

// Game constants that are used by these functions
const GROUND_LEVEL = 200;
const HITBOX_DISTANCE_VALUE = 85;
const SLAP_HITBOX_DISTANCE_VALUE = 184;

// Add new function for grab state cleanup
function cleanupGrabStates(player, opponent) {
  // Clean up grabber states
  player.isGrabbing = false;
  player.grabbedOpponent = null;
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.grabCooldown = false; // Add this to ensure cooldown is reset
  player.isBeingGrabbed = false; // Add this to ensure being grabbed state is reset
  player.isBeingPushed = false; // Add this to ensure being pushed state is reset

  // Clean up grabbed player states
  opponent.isBeingGrabbed = false;
  opponent.isBeingThrown = false;
  opponent.grabbedOpponent = null;
  opponent.throwOpponent = null;
  opponent.isHit = false;
  opponent.grabCooldown = false; // Add this to ensure cooldown is reset
  opponent.isGrabbing = false; // Add this to ensure grabbing state is reset
}

function handleWinCondition(room, loser, winner, io) {
  if (room.gameOver) return; // Prevent multiple win declarations

  room.gameOver = true;
  loser.y = GROUND_LEVEL;
  winner.wins.push("w");

  if (winner.wins.length > 3) {
    io.in(room.id).emit("match_over", {
      isMatchOver: true,
      winner: winner.fighter,
    });
    room.matchOver = true;
    winner.wins = [];
    loser.wins = [];
  } else {
    console.log(winner.wins.length);
    setTimeout(() => {
      winner.isBowing = true;
      loser.isBowing = false;
    }, 600);
  }

  // Store the current states that we want to preserve
  const loserKnockbackVelocity = { ...loser.knockbackVelocity };
  const loserMovementVelocity = loser.movementVelocity;

  // For the winner, if they're doing a slap attack, let it complete
  if (winner.isSlapAttack) {
    const remainingAttackTime = winner.attackEndTime - Date.now();
    if (remainingAttackTime > 0) {
      setTimeout(() => {
        // Reset winner's attack states after animation completes
        resetPlayerAttackStates(winner);
      }, remainingAttackTime);
    }
  } else {
    // If not doing a slap attack, reset attack states immediately
    resetPlayerAttackStates(winner);
  }

  // Reset loser's states immediately
  resetPlayerAttackStates(loser);

  // Reset all key states for both players
  room.players.forEach((p) => {
    const currentX = p.x;
    p.isStrafing = false;
    p.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
      e: false,
      f: false,
    };
    p.x = currentX;
  });

  // Keep the loser's knockback and movement velocity
  loser.knockbackVelocity = loserKnockbackVelocity;
  loser.movementVelocity = loserMovementVelocity;
  winner.knockbackVelocity = { x: 0, y: 0 };
  winner.movementVelocity = 0;

  io.in(room.id).emit("game_over", {
    isGameOver: true,
    winner: {
      id: winner.id,
      fighter: winner.fighter,
    },
    wins: winner.wins.length,
  });
  room.winnerId = winner.id;
  room.loserId = loser.id;
  if (!room.gameOverTime) {
    room.gameOverTime = Date.now();
  }

  // Wait for winner text to disappear (3 seconds) before resetting states
  setTimeout(() => {
    if (room.players) {
      room.players.forEach((p) => {
        if (p.id === loser.id) {
          p.knockbackVelocity = { x: 0, y: 0 };
          p.movementVelocity = 0;
        }
      });
    }
  }, 3000);
}

// Add this new function near the other helper functions
function executeSlapAttack(player, rooms) {
  // Find the current room and opponent
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    if (opponent) {
      // Update facing direction based on opponent's position
      player.facing = player.x < opponent.x ? -1 : 1;

      // Add forward slide during slap attack with fixed values regardless of power-ups
      const FIXED_SLAP_SLIDE_VELOCITY = 2.5; // Decreased from 3.5 to 2.5 for shorter slide
      const slideDirection = player.facing === 1 ? -1 : 1; // Slide in the direction player is facing

      // Apply fixed slide velocity and mark that we're in a slap slide
      player.movementVelocity = slideDirection * FIXED_SLAP_SLIDE_VELOCITY;
      player.isSlapSliding = true; // New flag to track slap slide state
    }
  }

  // If already attacking, only allow ONE buffered attack
  if (player.isSlapAttack && player.isAttacking) {
    // Only store one pending attack, ignore additional rapid clicks
    if (!player.hasPendingSlapAttack) {
      player.hasPendingSlapAttack = true;
    }
    // Ignore additional clicks if there's already a pending attack
    return;
  }

  // Clear charge state
  clearChargeState(player);

  // Ensure slapAnimation alternates consistently for every actual attack execution
  player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;

  const attackDuration = 300; // Total attack duration (300ms)
  const startupDuration = Math.floor(attackDuration * 0.4); // 40% of duration for startup frames (120ms)

  player.isSlapAttack = true;
  player.attackEndTime = Date.now() + attackDuration;
  player.isAttacking = true;
  player.attackStartTime = Date.now();
  player.attackType = "slap";

  // Add startup frame tracking
  player.isInStartupFrames = true;
  player.startupEndTime = Date.now() + startupDuration;

  // Set timeout to end startup frames and make attack active
  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    startupDuration
  );

  // Set a timeout to reset the attack state and handle queued slaps
  setPlayerTimeout(
    player.id,
    () => {
      player.isAttacking = false;
      player.isSlapAttack = false;
      player.attackType = null;
      player.isSlapSliding = false; // Clear the slap slide flag
      player.isInStartupFrames = false; // Ensure startup frames are cleared
      // Gradually reduce the slide velocity
      player.movementVelocity *= 0.5;

      // Check if there's a pending slap attack to execute
      if (player.hasPendingSlapAttack) {
        player.hasPendingSlapAttack = false;
        // Add a small delay before executing the next slap to allow neutral animation
        setPlayerTimeout(
          player.id,
          () => {
            // Execute the next slap if player is still valid
            if (
              !player.isDodging &&
              !player.isThrowing &&
              !player.isBeingThrown &&
              !player.isGrabbing &&
              !player.isBeingGrabbed &&
              !player.isRawParryStun &&
              !player.canMoveToReady
            ) {
              executeSlapAttack(player, rooms);
            }
          },
          100 // 100ms delay to allow victim to return to neutral between hits
        );
        return; // Early return to skip charging restart logic
      }

      // After slap attack ends, check if we should restart charging
      if (
        player.keys.mouse2 &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit &&
        !player.isRecovering &&
        !player.isRawParryStun &&
        !player.isThrowingSnowball &&
        !player.canMoveToReady
      ) {
        // Restart charging immediately
        player.isChargingAttack = true;
        player.chargeStartTime = Date.now();
        player.chargeAttackPower = 1;
        player.attackType = "charged";
      }
    },
    attackDuration
  );
}

function cleanupRoom(room) {
  // Clear any intervals
  if (room.gameLoop) {
    clearInterval(room.gameLoop);
  }

  // Reset room state
  room.players = [];
  room.readyCount = 0;
  room.rematchCount = 0;
  room.gameStart = false;
  room.hakkiyoiCount = 0;
  room.gameOver = false;
  room.matchOver = false;
  room.readyStartTime = null;
  room.gameOverTime = null;
  room.loserId = null;
}

// Add this new function near the other helper functions
function executeChargedAttack(player, chargePercentage, rooms) {
  console.log(
    `Player ${player.id} executing charged attack with ${chargePercentage}% charge`
  );

  // Prevent double execution - if player is already attacking, don't start another attack
  if (player.isAttacking && player.attackType === "charged") {
    console.log(
      `Player ${player.id} already executing charged attack, skipping duplicate execution`
    );
    return;
  }

  // Check if mouse2 is held when the attack starts
  const mouse2HeldOnStart = player.keys.mouse2;
  if (mouse2HeldOnStart) {
    console.log(
      `Player ${player.id} mouse2 is held when charged attack starts`
    );
    player.mouse2HeldDuringAttack = true;
  }

  // Clear any pending charge attack to prevent double execution
  if (player.pendingChargeAttack) {
    console.log(`Player ${player.id} clearing pending charge attack`);
    player.pendingChargeAttack = null;
    player.spacebarReleasedDuringDodge = false;
  }

  // Don't execute charged attack if player is in a throw state
  if (player.isThrowing || player.isBeingThrown) {
    console.log(
      `Player ${player.id} cannot execute charged attack - in throw state`
    );
    return;
  }

  // Store previous recovery state in case we need to restore it
  const previousRecoveryState = {
    isRecovering: player.isRecovering,
    recoveryStartTime: player.recoveryStartTime,
    recoveryDuration: player.recoveryDuration,
    recoveryDirection: player.recoveryDirection,
  };

  // Only clear recovery state after we're certain the attack will execute
  player.isRecovering = false;
  player.recoveryStartTime = 0;
  player.recoveryDuration = 0;
  player.recoveryDirection = null;

  player.isSlapAttack = false;

  // Calculate attack duration based on charge percentage
  let attackDuration;
  if (chargePercentage <= 25) {
    attackDuration = 300; // Reduced from 500 to 300 for low charge
  } else if (chargePercentage <= 75) {
    attackDuration = 500;
  } else {
    const extraDuration = ((chargePercentage - 50) / 50) * 1000;
    attackDuration = 1000 + extraDuration;
  }

  player.attackEndTime = Date.now() + attackDuration;
  player.attackType = "charged";
  player.chargeAttackPower = chargePercentage;

  // Set attack state
  player.isAttacking = true;
  player.attackStartTime = Date.now();

  // Add hit tracking
  player.chargedAttackHit = false;

  // Reset hit absorption for thick blubber power-up when executing charged attack
  if (player.activePowerUp === "thick_blubber") {
    player.hitAbsorptionUsed = false;

    // Find the current room to emit thick blubber activation
    const currentRoom = rooms.find((room) =>
      room.players.some((p) => p.id === player.id)
    );

    if (currentRoom) {
      // Import io from the main file - we'll need to pass it as a parameter
      // For now, we'll add this logic to the main file instead
    }
  }

  // Lock facing direction during attack
  player.chargingFacingDirection = player.facing;
  if (player.chargingFacingDirection !== null) {
    player.facing = player.chargingFacingDirection;
  }

  // Reset charging state but keep the charge power for knockback
  player.isChargingAttack = false;
  player.chargeStartTime = 0;

  // Note: Recovery and state cleanup is now handled by safelyEndChargedAttack
  // in the main tick function when attackEndTime is reached
}

// Add new function to calculate effective hitbox size based on facing direction
function calculateEffectiveHitboxSize(player) {
  const baseSize = HITBOX_DISTANCE_VALUE * (player.sizeMultiplier || 1);

  // Only apply asymmetric adjustments if player has size power-up
  // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
  //   // Return asymmetric hitbox for size power-up
  //   return {
  //     left: baseSize * SIZE_POWERUP_LEFT_MULTIPLIER,
  //     right: baseSize * SIZE_POWERUP_RIGHT_MULTIPLIER,
  //   };
  // }

  // For normal size, return symmetric hitbox
  return {
    left: baseSize,
    right: baseSize,
  };
}

function handleReadyPositions(room, player1, player2, io) {
  if (room.gameStart === false && room.hakkiyoiCount === 0) {
    // Only adjust player 1's ready position based on size power-up
    const player1ReadyX = 355; // Removed SIZE power-up condition
    const player2ReadyX = 690;

    // Only move players if they're allowed to move (after salt throw) AND they're not attacking
    if (
      player1.canMoveToReady &&
      !player1.isAttacking &&
      !player1.isChargingAttack
    ) {
      if (player1.x < player1ReadyX) {
        player1.x += 2; // Adjust speed as needed
        player1.isStrafing = true;
      } else {
        player1.x = player1ReadyX;
        // Only set isStrafing to false when we're setting isReady to true
        if (player2.x === player2ReadyX) {
          player1.isStrafing = false;
        }
      }
    }

    if (
      player2.canMoveToReady &&
      !player2.isAttacking &&
      !player2.isChargingAttack
    ) {
      if (player2.x > player2ReadyX) {
        player2.x -= 2; // Adjust speed as needed
        player2.isStrafing = true;
      } else {
        player2.x = player2ReadyX;
        // Only set isStrafing to false when we're setting isReady to true
        if (player1.x === player1ReadyX) {
          player2.isStrafing = false;
        }
      }
    }

    // Set ready state when players reach their positions (but not if they're attacking)
    if (
      player1.x === player1ReadyX &&
      player2.x === player2ReadyX &&
      !player1.isAttacking &&
      !player1.isChargingAttack &&
      !player2.isAttacking &&
      !player2.isChargingAttack
    ) {
      player1.isReady = true;
      player2.isReady = true;

      // Start a timer to trigger hakkiyoi after 1 second of being ready
      if (!room.readyStartTime) {
        room.readyStartTime = Date.now();
      }

      const currentTime = Date.now();
      if (currentTime - room.readyStartTime >= 1000) {
        // Clear the power-up auto-selection timer if players ready up normally
        if (room.roundStartTimer) {
          clearTimeout(room.roundStartTimer);
          room.roundStartTimer = null;
        }
        room.gameStart = true;
        room.hakkiyoiCount = 1;
        // Reset canMoveToReady for both players when game starts
        player1.canMoveToReady = false;
        player2.canMoveToReady = false;
        io.in(room.id).emit("game_start", true);
        player1.isReady = false;
        player2.isReady = false;
        room.readyStartTime = null;
      }
    }
  } else {
    // Clear ready states when game starts
    player1.isReady = false;
    player2.isReady = false;
    // Ensure canMoveToReady is false during gameplay
    player1.canMoveToReady = false;
    player2.canMoveToReady = false;
  }
}

function arePlayersColliding(player1, player2) {
  // If either player is dodging, return false immediately
  if (player1.isDodging || player2.isDodging) {
    return false;
  }

  // If either player is in recovery from a dodge + charged attack, allow collision checks
  const isRecoveringFromDodgeAttack = (player) => {
    return (
      player.isRecovering &&
      player.recoveryStartTime &&
      Date.now() - player.recoveryStartTime < player.recoveryDuration
    );
  };

  if (
    isRecoveringFromDodgeAttack(player1) ||
    isRecoveringFromDodgeAttack(player2)
  ) {
    return true;
  }

  if (
    player1.isGrabbing ||
    player2.isGrabbing ||
    player1.isBeingGrabbed ||
    player2.isBeingGrabbed
  ) {
    return false;
  }

  if (
    player1.isDodging ||
    player2.isDodging ||
    player1.isThrowing ||
    player2.isThrowing ||
    player1.isBeingThrown ||
    player2.isBeingThrown
  ) {
    return false;
  }

  // Calculate hitbox sizes based on power-up multiplier
  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  // Calculate hitbox centers
  const player1Center = player1.x;
  const player2Center = player2.x;

  const player1HitboxBounds = {
    left: player1Center - player1Hitbox.left,
    right: player1Center + player1Hitbox.right,
    top: player1.y - player1Hitbox.left,
    bottom: player1.y + player1Hitbox.left,
  };

  const player2HitboxBounds = {
    left: player2Center - player2Hitbox.left,
    right: player2Center + player2Hitbox.right,
    top: player2.y - player2Hitbox.left,
    bottom: player2.y + player2Hitbox.left,
  };

  return (
    player1HitboxBounds.left < player2HitboxBounds.right &&
    player1HitboxBounds.right > player2HitboxBounds.left &&
    player1HitboxBounds.top < player2HitboxBounds.bottom &&
    player1HitboxBounds.bottom > player2HitboxBounds.top
  );
}

function adjustPlayerPositions(player1, player2, delta) {
  // Calculate the overlap between players
  if (
    player1.isDodging ||
    player2.isDodging ||
    player1.isThrowing ||
    player2.isThrowing ||
    player1.isBeingThrown ||
    player2.isBeingThrown
  ) {
    return;
  }

  // Calculate hitbox sizes based on power-ups
  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  // Calculate the center points of each player's hitbox
  const player1Center = player1.x;
  const player2Center = player2.x;

  // Calculate the distance between centers
  const distanceBetweenCenters = Math.abs(player1Center - player2Center);

  // Calculate the minimum distance needed between centers to prevent overlap
  const minDistance = player1Hitbox.left + player2Hitbox.right;

  // Add extra distance for slap attacks to prevent collision during rapid attacks
  const extraSlapDistance = 20; // Fixed extra distance for slap attacks
  const finalMinDistance =
    (player1.isAttacking && player1.isSlapAttack) ||
    (player2.isAttacking && player2.isSlapAttack)
      ? minDistance + extraSlapDistance
      : minDistance;

  // If players are overlapping
  if (distanceBetweenCenters < finalMinDistance) {
    // Calculate how much they need to move apart
    const overlap = finalMinDistance - distanceBetweenCenters;
    const adjustment = overlap / 2;

    // Significantly reduce the smoothFactor for more resistance during collisions
    const isRecovering = player1.isRecovering || player2.isRecovering;
    const smoothFactor = isRecovering ? delta * 0.04 : delta * 0.015; // Increased from 0.02/0.005 to 0.04/0.015 for more responsive collision

    // Calculate new positions
    let newPlayer1X = player1.x;
    let newPlayer2X = player2.x;

    // Move players apart based on their relative positions
    if (player1.x < player2.x) {
      newPlayer1X -= adjustment * smoothFactor;
      newPlayer2X += adjustment * smoothFactor;
    } else {
      newPlayer1X += adjustment * smoothFactor;
      newPlayer2X -= adjustment * smoothFactor;
    }

    // Only apply movement resistance when players are moving towards each other
    if (!player1.isHit && !player1.isAlreadyHit && player1.movementVelocity) {
      // Check if player1 is moving towards player2
      const isMovingTowards =
        (player1.x < player2.x && player1.movementVelocity > 0) ||
        (player1.x > player2.x && player1.movementVelocity < 0);
      if (isMovingTowards) {
        player1.movementVelocity *= 0.85; // Add resistance to movement velocity
      }
    }
    if (!player2.isHit && !player2.isAlreadyHit && player2.movementVelocity) {
      // Check if player2 is moving towards player1
      const isMovingTowards =
        (player2.x < player1.x && player2.movementVelocity > 0) ||
        (player2.x > player1.x && player2.movementVelocity < 0);
      if (isMovingTowards) {
        player2.movementVelocity *= 0.85; // Add resistance to movement velocity
      }
    }

    // Enforce map boundaries for both players
    const leftBoundary = MAP_LEFT_BOUNDARY;
    const rightBoundary = MAP_RIGHT_BOUNDARY;

    // Only update positions if they stay within boundaries
    if (newPlayer1X >= leftBoundary && newPlayer1X <= rightBoundary) {
      player1.x = newPlayer1X;
    }
    if (newPlayer2X >= leftBoundary && newPlayer2X <= rightBoundary) {
      player2.x = newPlayer2X;
    }

    // Additional minimum separation enforcement for edge cases
    // This prevents players from getting stuck too close together
    const currentDistance = Math.abs(player1.x - player2.x);
    if (currentDistance < finalMinDistance * 0.8) {
      const emergencyAdjustment =
        (finalMinDistance * 0.8 - currentDistance) / 2;
      if (player1.x < player2.x) {
        player1.x = Math.max(leftBoundary, player1.x - emergencyAdjustment);
        player2.x = Math.min(rightBoundary, player2.x + emergencyAdjustment);
      } else {
        player1.x = Math.min(rightBoundary, player1.x + emergencyAdjustment);
        player2.x = Math.max(leftBoundary, player2.x - emergencyAdjustment);
      }
    }
  }
}

// Add helper function to safely end charged attacks with recovery check
function safelyEndChargedAttack(player, rooms) {
  console.log(
    `safelyEndChargedAttack called for player ${player.id}, attackType: ${player.attackType}, chargedAttackHit: ${player.chargedAttackHit}`
  );

  // Only handle charged attacks, let slap attacks end normally
  if (player.attackType === "charged" && !player.chargedAttackHit) {
    console.log(
      `Safely ending charged attack for player ${player.id}, checking for recovery`
    );

    // Find the current room and opponent to check if recovery is needed
    const currentRoom = rooms.find((room) =>
      room.players.some((p) => p.id === player.id)
    );

    if (currentRoom) {
      const opponent = currentRoom.players.find((p) => p.id !== player.id);

      // Set recovery for missed charged attacks (same logic as executeChargedAttack)
      if (opponent && !opponent.isHit && !player.isChargingAttack) {
        console.log(
          `Setting recovery state for player ${player.id} after missed charged attack (from safelyEndChargedAttack)`
        );
        player.isRecovering = true;
        player.recoveryStartTime = Date.now();
        player.recoveryDuration = 250;
        player.recoveryDirection = player.facing;
        // Use movement velocity for natural sliding
        player.movementVelocity = player.facing * -3;
        player.knockbackVelocity = { x: 0, y: 0 };
      } else {
        console.log(
          `Not setting recovery for player ${player.id} - opponent.isHit: ${opponent?.isHit}, isChargingAttack: ${player.isChargingAttack}`
        );
      }
    }
  }

  // Clear attack states (for both charged and slap attacks)
  if (!player.isChargingAttack) {
    console.log(
      `Clearing attack states for player ${player.id} (from safelyEndChargedAttack)`
    );
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;
    player.chargedAttackHit = false; // Reset hit tracking

    // Clear the mouse2 flag - restart logic now happens immediately when recovery ends
    player.mouse2HeldDuringAttack = false;

    // Check for buffered actions after attack ends
    if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
      const action = player.bufferedAction;
      player.bufferedAction = null;
      player.bufferExpiryTime = 0;

      // Execute the buffered action
      if (action.type === "dodge") {
        player.isDodging = true;
        player.dodgeStartTime = Date.now();
        player.dodgeEndTime = Date.now() + 400;
        player.stamina -= 50;
        player.dodgeDirection = action.direction;
        player.dodgeStartX = player.x;
        player.dodgeStartY = player.y;
      }
    }
  } else {
    console.log(
      `Not clearing attack states for player ${player.id} - player is charging`
    );
  }
}

module.exports = {
  cleanupGrabStates,
  handleWinCondition,
  executeSlapAttack,
  cleanupRoom,
  executeChargedAttack,
  calculateEffectiveHitboxSize,
  handleReadyPositions,
  arePlayersColliding,
  adjustPlayerPositions,
  safelyEndChargedAttack,
};

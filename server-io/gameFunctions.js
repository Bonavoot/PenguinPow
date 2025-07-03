// Import required utilities
const {
  setPlayerTimeout,
  resetPlayerAttackStates,
  clearChargeState,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");

// Game constants that are used by these functions
const GROUND_LEVEL = 240;
const HITBOX_DISTANCE_VALUE = 77; // Reduced by 10% to match smaller player images
const SLAP_HITBOX_DISTANCE_VALUE = 155; // Reduced range by 15% from 166 to 141 for shorter slap attack reach

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

    // Clear isAtTheRopes state when game ends
    if (p.isAtTheRopes) {
      p.isAtTheRopes = false;
      p.atTheRopesStartTime = 0;
    }

    // Clear buffered slap attack states to prevent attacks after winner is declared
    p.hasPendingSlapAttack = false;
    p.mouse1JustPressed = false;
    p.mouse1JustReleased = false;

    p.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
      e: false,
      f: false,
      mouse1: false,
      mouse2: false,
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
      // Lock facing direction at the start of the slap attack to prevent erratic behavior
      // Only set facing direction if we don't already have a locked slap facing direction
      if (!player.slapFacingDirection) {
        player.slapFacingDirection = player.x < opponent.x ? -1 : 1;
      }
      
      // Use the locked facing direction
      player.facing = player.slapFacingDirection;

      // Add forward slide during slap attack with power-up consideration
      let slapSlideVelocity = 1.7; // Base slide velocity (reduced by 30% from 2.0808 to 1.45656 for less aggressive forward movement)

      // Apply POWER power-up multiplier to slap slide distance
      if (player.activePowerUp === "power") {
        slapSlideVelocity *= player.powerUpMultiplier - 0.1; // Adjusted to achieve 20% increase (1.3 - 0.1 = 1.2x multiplier)
        console.log(
          `Player ${player.id} slap slide enhanced by POWER power-up: ${slapSlideVelocity}`
        );
      }

      const slideDirection = player.facing === 1 ? -1 : 1; // Slide in the direction player is facing

      // Apply slide velocity and mark that we're in a slap slide
      player.movementVelocity = slideDirection * slapSlideVelocity;
      player.isSlapSliding = true; // New flag to track slap slide state
    }
  }

  // If already attacking, only allow ONE buffered attack and only during the last 50% of the attack
  if (player.isSlapAttack && player.isAttacking) {
    // Calculate how far through the attack we are
    const currentTime = Date.now();
    const attackElapsed = currentTime - player.attackStartTime;
    const attackDuration = player.attackEndTime - player.attackStartTime;
    const attackProgress = attackElapsed / attackDuration;
    
    // Only allow buffering during the last 50% of the attack (50% complete or more)
    if (attackProgress >= 0.35) {
      // Only store one pending attack, ignore additional rapid clicks
      if (!player.hasPendingSlapAttack) {
        player.hasPendingSlapAttack = true;
        console.log(`Player ${player.id} buffered slap attack at ${Math.round(attackProgress * 100)}% completion`);
      }
    } else {
      console.log(`Player ${player.id} attempted to buffer slap too early (${Math.round(attackProgress * 100)}% complete, need 50%+)`);
    }
    
    // Ignore clicks if there's already a pending attack or if it's too early to buffer
    return;
  }

  // Clear charge state
  clearChargeState(player);

  // Ensure slapAnimation alternates consistently for every actual attack execution
  player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
  player.stamina -= 10;

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
      player.slapFacingDirection = null; // Clear the locked facing direction
      player.isInStartupFrames = false; // Ensure startup frames are cleared
      // Gradually reduce the slide velocity
      player.movementVelocity *= 0.5;

      // Check if there's a pending slap attack to execute
      if (player.hasPendingSlapAttack) {
        player.hasPendingSlapAttack = false;
        // Set strafing cooldown to prevent movement during the gap between attacks
        player.slapStrafeCooldown = true;
        player.slapStrafeCooldownEndTime = Date.now() + 150; // 150ms cooldown after attack ends
        
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

      // Set strafing cooldown for non-buffered attacks too
      player.slapStrafeCooldown = true;
      player.slapStrafeCooldownEndTime = Date.now() + 150; // 150ms cooldown after attack ends

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

  // Auto-correct facing direction before locking it (similar to slap attacks after throw)
  // Find the current room and opponent
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );
  
  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    
    // Only auto-correct if opponent exists and is NOT dodging
    // If opponent is dodging, we want to preserve the original facing direction
    if (opponent && !opponent.isDodging) {
      // Auto-correct facing direction to face the opponent
      const shouldFaceRight = player.x < opponent.x;
      const correctedFacing = shouldFaceRight ? -1 : 1;
      
      console.log(`Player ${player.id} auto-correcting charged attack facing: ${player.facing} -> ${correctedFacing} (opponent at x: ${opponent.x}, player at x: ${player.x}, opponent dodging: ${opponent.isDodging})`);
      
      player.facing = correctedFacing;
    } else if (opponent && opponent.isDodging) {
      console.log(`Player ${player.id} NOT auto-correcting charged attack facing - opponent is dodging (preserving direction: ${player.facing})`);
    }
  }

  // Lock facing direction during attack (after auto-correction)
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
    const player1ReadyX = 415; // Removed SIZE power-up condition
    const player2ReadyX = 665;

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
  // Reduce collision distance slightly to allow players to get closer during normal movement
  const minDistance = (player1Hitbox.left + player2Hitbox.right) * 0.85;

  // Add extra distance for slap attacks to prevent collision during rapid attacks
  const extraSlapDistance = 12; // Reduced from 20 to 12 for less forced separation during slap attacks
  const finalMinDistance =
    (player1.isAttacking && player1.isSlapAttack) ||
    (player2.isAttacking && player2.isSlapAttack)
      ? minDistance + extraSlapDistance
      : minDistance;

  // If players are overlapping
  if (distanceBetweenCenters < finalMinDistance) {
    // Calculate how much overlap there is
    const overlap = finalMinDistance - distanceBetweenCenters;

    // Check if this is a slap attack scenario (one player attacking with slap, other being hit by slap)
    const isSlapAttackScenario = 
      (player1.isAttacking && player1.attackType === "slap" && player2.isSlapKnockback) ||
      (player2.isAttacking && player2.attackType === "slap" && player1.isSlapKnockback);

    let separationSpeed, separationPerPlayer, newPlayer1X, newPlayer2X;

    if (isSlapAttackScenario) {
      // Special handling for slap attacks - gentler separation that doesn't interfere with knockback
      separationSpeed = Math.min(overlap * 0.3, 2.5); // Reduced from 4 to 2.5 for even gentler separation during slap scenarios
      
      // Identify attacker and victim
      const attacker = player1.isAttacking && player1.attackType === "slap" ? player1 : player2;
      const victim = player1.isSlapKnockback ? player1 : player2;
      
      // Prioritize victim's knockback movement - attacker does most of the separating
      if (attacker === player1) {
        // Player1 is attacking, player2 is victim - move attacker back more
        newPlayer1X = player1.x + (player1.x < player2.x ? -1 : 1) * separationSpeed * 0.8;
        newPlayer2X = player2.x + (player1.x < player2.x ? 1 : -1) * separationSpeed * 0.2;
      } else {
        // Player2 is attacking, player1 is victim - move attacker back more  
        newPlayer1X = player1.x + (player1.x < player2.x ? -1 : 1) * separationSpeed * 0.2;
        newPlayer2X = player2.x + (player1.x < player2.x ? 1 : -1) * separationSpeed * 0.8;
      }
    } else {
      // Normal separation for non-slap scenarios
      separationSpeed = Math.min(overlap * 0.7, 12); // Increased from 0.5 to 0.7 and cap from 8 to 12 pixels per frame
      
      // Calculate separation direction
      const separationDirection = player1.x < player2.x ? -1 : 1;
      
      // Apply smooth separation - each player moves by half
      separationPerPlayer = separationSpeed / 2;
      
      // Calculate new positions
      newPlayer1X = player1.x + separationDirection * separationPerPlayer;
      newPlayer2X = player2.x + -separationDirection * separationPerPlayer;
    }

    // Apply gentle resistance to movement velocity when players are pushing into each other
    // Exclude slap knockback to maintain smooth sliding during rapid slap attacks
    if (!player1.isHit && !player1.isAlreadyHit && !player1.isSlapKnockback && player1.movementVelocity) {
      const isMovingTowards =
        (player1.x < player2.x && player1.movementVelocity > 0) ||
        (player1.x > player2.x && player1.movementVelocity < 0);
      if (isMovingTowards) {
        player1.movementVelocity *= 0.95; // Reduced resistance from 0.9 to 0.95
      }
    }
    if (!player2.isHit && !player2.isAlreadyHit && !player2.isSlapKnockback && player2.movementVelocity) {
      const isMovingTowards =
        (player2.x < player1.x && player2.movementVelocity > 0) ||
        (player2.x > player1.x && player2.movementVelocity < 0);
      if (isMovingTowards) {
        player2.movementVelocity *= 0.95; // Reduced resistance from 0.9 to 0.95
      }
    }

    // Enforce map boundaries with symmetric correction
    const leftBoundary = MAP_LEFT_BOUNDARY;
    const rightBoundary = MAP_RIGHT_BOUNDARY;

    // Check if either player would go out of bounds
    const player1OutOfBounds =
      newPlayer1X < leftBoundary || newPlayer1X > rightBoundary;
    const player2OutOfBounds =
      newPlayer2X < leftBoundary || newPlayer2X > rightBoundary;

    // Special case: if both players are at the same boundary and overlapping,
    // force one player to switch sides for proper separation (like dodge through behavior)
    const bothAtSameBoundary =
      (player1.x <= leftBoundary + 5 && player2.x <= leftBoundary + 5) ||
      (player1.x >= rightBoundary - 5 && player2.x >= rightBoundary - 5);

    if (bothAtSameBoundary && distanceBetweenCenters < finalMinDistance) {
      // Smooth separation when both players are at the same boundary

      // Determine which player should switch sides based on their recent movement or facing direction
      let playerToMove = null;
      let playerToKeep = null;

      // Check if either player has recent movement velocity that suggests they just arrived
      if (
        Math.abs(player2.movementVelocity || 0) >
        Math.abs(player1.movementVelocity || 0)
      ) {
        // Player2 has more momentum, they probably just arrived (like from a dodge)
        playerToMove = player2;
        playerToKeep = player1;
      } else if (
        Math.abs(player1.movementVelocity || 0) >
        Math.abs(player2.movementVelocity || 0)
      ) {
        // Player1 has more momentum
        playerToMove = player1;
        playerToKeep = player2;
      } else {
        // Equal or no momentum, use position preference
        // If both are at right boundary, move the rightmost player to the left
        // If both are at left boundary, move the leftmost player to the right
        if (player1.x >= rightBoundary - 5 && player2.x >= rightBoundary - 5) {
          playerToMove = player1.x > player2.x ? player1 : player2;
          playerToKeep = playerToMove === player1 ? player2 : player1;
        } else {
          playerToMove = player1.x < player2.x ? player1 : player2;
          playerToKeep = playerToMove === player1 ? player2 : player1;
        }
      }

      // Keep one player at the boundary (minimal adjustment)
      const keeperTargetX = Math.max(
        leftBoundary,
        Math.min(playerToKeep.x, rightBoundary)
      );
      playerToKeep.x += (keeperTargetX - playerToKeep.x) * 0.4; // Increased from 0.2 to 0.4 for faster approach to boundary

      // Calculate minimal separation needed - just enough to resolve collision
      // We want the distance between centers to equal finalMinDistance (no extra padding)
      const currentDistance = Math.abs(playerToMove.x - playerToKeep.x);
      const neededSeparation = finalMinDistance - currentDistance;

      // Only move if we actually need separation
      if (neededSeparation > 0) {
        // Determine direction to move the player (away from the boundary)
        let direction;
        if (playerToKeep.x >= rightBoundary - 5) {
          // Keeper is at right boundary, move the other player to the left
          direction = -1;
        } else {
          // Keeper is at left boundary, move the other player to the right
          direction = 1;
        }

        // Calculate target position with minimal separation
        const targetX = playerToKeep.x + direction * finalMinDistance;
        const clampedTargetX = Math.max(
          leftBoundary,
          Math.min(targetX, rightBoundary)
        );

        // Direct position-based movement - no velocity momentum
        const distanceToTarget = clampedTargetX - playerToMove.x;
        const maxMovePerFrame = 6; // Increased from 3 to 6 pixels per frame for faster movement

        if (Math.abs(distanceToTarget) <= maxMovePerFrame) {
          // Close enough - move directly to target and stop
          playerToMove.x = clampedTargetX;
          playerToMove.movementVelocity = 0; // Clear any existing velocity
        } else {
          // Move incrementally toward target without velocity
          const moveDirection = distanceToTarget > 0 ? 1 : -1;
          playerToMove.x += moveDirection * maxMovePerFrame;
          playerToMove.movementVelocity = 0; // Clear velocity to prevent momentum
        }
      } else {
        // Already properly separated, clear any velocity
        playerToMove.movementVelocity = 0;
      }
    } else if (player1OutOfBounds || player2OutOfBounds) {
      // Normal boundary handling for non-overlapping cases
      if (player1OutOfBounds && !player2OutOfBounds) {
        // Player 1 is blocked by boundary, move player 2 by full separation distance
        player1.x = Math.max(leftBoundary, Math.min(player1.x, rightBoundary)); // Keep player1 at boundary
        const fullSeparationDirection = player2.x < player1.x ? -1 : 1;
        const newPlayer2XFull =
          player2.x + fullSeparationDirection * separationSpeed;
        if (
          newPlayer2XFull >= leftBoundary &&
          newPlayer2XFull <= rightBoundary
        ) {
          player2.x = newPlayer2XFull;
        }
      } else if (player2OutOfBounds && !player1OutOfBounds) {
        // Player 2 is blocked by boundary, move player 1 by full separation distance
        player2.x = Math.max(leftBoundary, Math.min(player2.x, rightBoundary)); // Keep player2 at boundary
        const fullSeparationDirection = player1.x < player2.x ? -1 : 1;
        const newPlayer1XFull =
          player1.x + fullSeparationDirection * separationSpeed;
        if (
          newPlayer1XFull >= leftBoundary &&
          newPlayer1XFull <= rightBoundary
        ) {
          player1.x = newPlayer1XFull;
        }
      } else {
        // Both players would go out of bounds - clamp both to boundaries
        player1.x = Math.max(
          leftBoundary,
          Math.min(newPlayer1X, rightBoundary)
        );
        player2.x = Math.max(
          leftBoundary,
          Math.min(newPlayer2X, rightBoundary)
        );
      }
    } else {
      // Both players can move normally
      player1.x = newPlayer1X;
      player2.x = newPlayer2X;
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

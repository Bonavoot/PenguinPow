// Import required utilities
const {
  setPlayerTimeout,
  resetPlayerAttackStates,
  clearChargeState,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  DOHYO_FALL_DEPTH,
  isOutsideDohyo,
} = require("./gameUtils");

// Game constants that are used by these functions
const GROUND_LEVEL = 290;
const HITBOX_DISTANCE_VALUE = Math.round(77 * 0.96);
const SLAP_HITBOX_DISTANCE_VALUE = Math.round(155 * 0.96);

// Stamina drain constants
const SLAP_ATTACK_STAMINA_COST = 3; // Small cost to not deter spamming
const CHARGED_ATTACK_STAMINA_COST = 9; // 3x slap attack cost
const DODGE_STAMINA_COST = 15; // 15% of max stamina per dodge

// Add new function for grab state cleanup
function cleanupGrabStates(player, opponent) {
  // Clean up grabber states
  player.isGrabbing = false;
  player.grabbedOpponent = null;
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.grabCooldown = false;
  player.isBeingGrabbed = false;
  player.isBeingPushed = false;
  player.lastGrabStaminaDrainTime = 0;
  player.isAttemptingGrabThrow = false;
  player.grabThrowAttemptStartTime = 0;
  // New grab action system cleanup - grabber
  player.isGrabPushing = false;
  player.isBeingGrabPushed = false;
  player.isAttemptingPull = false;
  player.isBeingPullReversaled = false;
  player.pullReversalPullerId = null;
  player.isGrabSeparating = false;
  player.isGrabBellyFlopping = false;
  player.isBeingGrabBellyFlopped = false;
  player.isGrabFrontalForceOut = false;
  player.isBeingGrabFrontalForceOut = false;
  player.grabActionStartTime = 0;
  player.grabActionType = null;
  player.lastGrabPushStaminaDrainTime = 0;
  player.isAtBoundaryDuringGrab = false;
  player.grabDurationPaused = false;
  player.grabDurationPausedAt = 0;
  player.grabPushEndTime = 0;
  player.grabPushStartTime = 0;
  player.grabApproachSpeed = 0;
  player.grabDecisionMade = false;
  player.isGrabWalking = false;
  player.isGrabWhiffRecovery = false;
  player.isGrabTeching = false;
  player.grabTechRole = null;
  player.grabTechResidualVel = 0;
  player.grabCounterAttempted = false;
  player.grabCounterInput = null;
  // Clear action lock so grab/other actions aren't blocked after grab ends
  player.actionLockUntil = 0;

  // Clean up grabbed player states
  opponent.isBeingGrabbed = false;
  opponent.isBeingThrown = false;
  opponent.grabbedOpponent = null;
  opponent.throwOpponent = null;
  opponent.isHit = false;
  opponent.grabCooldown = false;
  opponent.isGrabbing = false;
  opponent.isCounterGrabbed = false;
  opponent.isAttemptingGrabThrow = false;
  opponent.grabThrowAttemptStartTime = 0;
  // New grab action system cleanup - opponent
  opponent.isGrabPushing = false;
  opponent.isBeingGrabPushed = false;
  opponent.isAttemptingPull = false;
  opponent.isBeingPullReversaled = false;
  opponent.pullReversalPullerId = null;
  opponent.isGrabSeparating = false;
  opponent.isGrabBellyFlopping = false;
  opponent.isBeingGrabBellyFlopped = false;
  opponent.isGrabFrontalForceOut = false;
  opponent.isBeingGrabFrontalForceOut = false;
  opponent.grabActionStartTime = 0;
  opponent.grabActionType = null;
  opponent.lastGrabPushStaminaDrainTime = 0;
  opponent.isAtBoundaryDuringGrab = false;
  opponent.grabDurationPaused = false;
  opponent.grabDurationPausedAt = 0;
  opponent.grabPushEndTime = 0;
  opponent.grabPushStartTime = 0;
  opponent.grabApproachSpeed = 0;
  opponent.grabDecisionMade = false;
  opponent.isGrabWalking = false;
  opponent.isGrabWhiffRecovery = false;
  opponent.isGrabTeching = false;
  opponent.grabTechRole = null;
  opponent.grabTechResidualVel = 0;
  opponent.grabCounterAttempted = false;
  opponent.grabCounterInput = null;
  // Clear action lock so grab/other actions aren't blocked after grab ends
  opponent.actionLockUntil = 0;
}

function handleWinCondition(room, loser, winner, io) {
  if (room.gameOver) return; // Prevent multiple win declarations

  room.gameOver = true;
  
  // Determine correct Y position for the loser based on whether they fell off the dohyo
  // Check multiple conditions to catch all fall scenarios:
  // 1. isFallingOffDohyo flag is set (fall was triggered)
  // 2. X position is outside dohyo boundaries
  // 3. Y is already below normal ground level (they're mid-fall)
  const fallenGroundLevel = GROUND_LEVEL - DOHYO_FALL_DEPTH;
  const loserShouldBeAtFallenLevel = 
    loser.isFallingOffDohyo || 
    isOutsideDohyo(loser.x, loser.y) || 
    loser.y < GROUND_LEVEL; // Already below normal ground = mid-fall
  
  // Force both players to correct ground level immediately
  loser.y = loserShouldBeAtFallenLevel ? fallenGroundLevel : GROUND_LEVEL;
  winner.y = GROUND_LEVEL; // Winner should always be at normal ground level
  
  winner.wins.push("w");

  // Store the win count BEFORE potentially clearing it
  const winCount = winner.wins.length;

  // Stamina stays frozen at end-of-round values.
  // It resets to 100 when resetRoomAndPlayers() runs for the next round.

  if (winCount > 1) {
    io.in(room.id).emit("match_over", {
      isMatchOver: true,
      winner: winner.fighter,
    });
    room.matchOver = true;
    // Clear wins AFTER we've stored the count (will be used in game_over event below)
    winner.wins = [];
    loser.wins = [];
    setTimeout(() => {
      // CRITICAL: Force both players to correct ground level before bowing starts
      // Check all fall conditions to ensure correct positioning for loser
      const loserFellOffDohyo = 
        loser.isFallingOffDohyo || 
        isOutsideDohyo(loser.x, loser.y) || 
        loser.y < GROUND_LEVEL;
      const loserGroundLevel = loserFellOffDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
      
      // Force to correct ground level (handles both above and mid-fall cases)
      loser.y = loserGroundLevel;
      // Winner should always be at normal ground level for bowing
      winner.y = GROUND_LEVEL;
      
      winner.isBowing = true;
      loser.isBowing = true;
      
      // NOTE: Do NOT reset isBowing here for match over.
      // For regular rounds, isBowing stays true until resetRoomAndPlayers() clears it
      // along with the position reset. For match over, we keep bowing until the
      // match-over screen covers the view and the rematch flow resets everything.
      // Resetting it early caused players to visually "pop up" from bow to idle
      // in the gap before the match-over UI appeared.
    }, 1050);
  } else {
    setTimeout(() => {
      // CRITICAL: Force both players to correct ground level before bowing starts
      // Check all fall conditions to ensure correct positioning for loser
      const loserFellOffDohyo = 
        loser.isFallingOffDohyo || 
        isOutsideDohyo(loser.x, loser.y) || 
        loser.y < GROUND_LEVEL;
      const loserGroundLevel = loserFellOffDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
      
      // Force to correct ground level (handles both above and mid-fall cases)
      loser.y = loserGroundLevel;
      // Winner should always be at normal ground level for bowing
      winner.y = GROUND_LEVEL;
      
      winner.isBowing = true;
      loser.isBowing = true;
    }, 1050);
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

  // Reset all key states and animation-triggering states for both players
  room.players.forEach((p) => {
    const currentX = p.x;
    p.isStrafing = false;

    // Clear isAtTheRopes state when game ends
    if (p.isAtTheRopes) {
      p.isAtTheRopes = false;
      p.atTheRopesStartTime = 0;
    }

    // Clear parry states to prevent jiggle/flash animations persisting into round result
    p.isRawParrying = false;
    p.rawParryStartTime = 0;
    p.rawParryMinDurationMet = false;
    p.isRawParrySuccess = false;
    p.isPerfectRawParrySuccess = false;
    p.isRawParryStun = false;

    // Clear grab animation states that cause shake/jiggle if round ends mid-grab
    p.isGrabBreaking = false;
    p.isGrabBreakCountered = false;
    p.isGrabTeching = false;
    p.grabTechRole = null;
    p.isGrabPushing = false;
    p.isBeingGrabPushed = false;
    p.isAttemptingPull = false;
    p.isGrabSeparating = false;

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

  // Keep the loser's knockback and movement velocity for sliding effect
  loser.knockbackVelocity = loserKnockbackVelocity;
  loser.movementVelocity = loserMovementVelocity;
  winner.knockbackVelocity = { x: 0, y: 0 };
  winner.movementVelocity = 0;
  
  // CRITICAL: Force loser Y position AGAIN after all state changes
  // This ensures no intermediate code has modified Y
  const loserFellOff = loser.isFallingOffDohyo || isOutsideDohyo(loser.x, loser.y) || loser.y < GROUND_LEVEL;
  loser.y = loserFellOff ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
  
  // NOTE: Do NOT clear isHit here - the knockback physics need to continue running
  // so the player can slide past the map boundaries naturally

  io.in(room.id).emit("game_over", {
    isGameOver: true,
    winner: {
      id: winner.id,
      fighter: winner.fighter,
    },
    wins: winCount, // Use stored winCount since winner.wins may have been cleared for match_over
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
  // Cancel power slide when attacking
  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  
  // Clear parry success state when starting an attack
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  
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

      // === TWO-SPEED LUNGE SYSTEM ===
      // APPROACH (no recent hit): Normal forward slide, controlled distance.
      // CHAIN (just landed a slap): Strong lunge to close the gap from the stop-on-hit + recoil.
      // This gives the rekka "lunge back in" feel during chains without rocketing across
      // the screen on the initial approach.
      const recentlyLandedSlap = player.lastSlapHitLandedTime && 
        (Date.now() - player.lastSlapHitLandedTime < 400); // Within one attack cycle
      let slapSlideVelocity = recentlyLandedSlap ? 2.2 : 1.2; // Chain lunge vs normal approach

      // Apply POWER power-up multiplier to slap slide distance
      if (player.activePowerUp === "power") {
        slapSlideVelocity *= player.powerUpMultiplier - 0.1; // Adjusted to achieve 20% increase (1.3 - 0.1 = 1.2x multiplier)
      }

      const slideDirection = player.facing === 1 ? -1 : 1; // Slide in the direction player is facing

      // Apply slide velocity and mark that we're in a slap slide
      player.movementVelocity = slideDirection * slapSlideVelocity;
      player.isSlapSliding = true; // New flag to track slap slide state
    }
  }

  // If already attacking, don't start a new attack - buffering is handled by index.js
  if (player.isSlapAttack && player.isAttacking) {
    return;
  }

  // Clear charge state
  clearChargeState(player);

  // Ensure slapAnimation alternates consistently for every actual attack execution
  player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
  
  // Slap attacks drain a small amount of stamina
  player.stamina = Math.max(0, player.stamina - SLAP_ATTACK_STAMINA_COST);

  // === SLAP ATTACK TIMING - Rekka-style chainable attack ===
  // Each slap is deliberate with clear wind-up and impact, not rapid-fire spam.
  // Combined with 130ms hitstop, creates a "BAM... BAM... BAM" rhythm.
  const attackDuration = 270;  // Snappy cycle - rapid but deliberate

  // DESPERATION COUNTER-SLAP: If the player just recovered from hit stun,
  // their next slap has faster startup so it's more likely to create a slap parry.
  const recentlyRecoveredFromHit = player.lastHitTime && 
    (Date.now() - player.lastHitTime < 380) && // Within hit stun window + small buffer
    !player.isHit; // Must have already recovered
  const startupDuration = recentlyRecoveredFromHit ? 35 : 55; // Quick wind-up per strike

  const totalCycleDuration = attackDuration; // NO extra cooldown - chains immediately

  player.isSlapAttack = true;
  player.attackEndTime = Date.now() + attackDuration;
  player.isAttacking = true;
  player.attackStartTime = Date.now();
  player.attackType = "slap";
  player.currentAction = "slap";
  
  // Track when attack was attempted for counter hit detection
  // This is set immediately so even if hit detection happens in the same tick,
  // we can detect if the player was trying to attack
  player.attackAttemptTime = Date.now();
  
  // Single cooldown controls everything - simple and consistent
  player.attackCooldownUntil = Date.now() + totalCycleDuration;

  // Add startup frame tracking
  player.isInStartupFrames = true;
  player.startupEndTime = Date.now() + startupDuration;

  // Set timeout to end startup frames
  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    startupDuration
  );

  // Store the cycle-end callback on the player so processHit can re-set it
  // when extending the cycle for hitstop compensation
  player.slapCycleEndCallback = () => {
      player.isAttacking = false;
      player.isSlapAttack = false;
      player.attackType = null;
      player.isSlapSliding = false;
      player.slapFacingDirection = null;
      player.isInStartupFrames = false;
      // ICE PHYSICS: Slap attack ends - momentum carries into sliding!
      // Don't reduce momentum, let ice physics handle the slide
      // Player keeps sliding in the direction they were moving
      player.currentAction = null;

      // Check if there's a pending slap attack to execute immediately
      if (player.hasPendingSlapAttack) {
        player.hasPendingSlapAttack = false;
        
        // Execute the next slap immediately if player is still valid
        if (
          !player.isDodging &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isHit &&
          !player.canMoveToReady
        ) {
          // Execute next slap IMMEDIATELY - no delay
          executeSlapAttack(player, rooms);
        }
        return;
      }
      
      // After attack ends, check if we should restart charging
      // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
      if (
        player.keys.mouse1 &&
        player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200 &&
        player.wantsToRestartCharge &&
        !player.isAttacking &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit &&
        !player.isRawParryStun &&
        !player.canMoveToReady
      ) {
        player.isChargingAttack = true;
        player.chargeStartTime = Date.now();
        player.chargeAttackPower = 1;
        player.attackType = "charged";
        player.wantsToRestartCharge = false;
      }
  };

  // Set the cycle timer with a name so processHit can clear and re-set it
  // when compensating for hitstop freeze time
  setPlayerTimeout(
    player.id,
    player.slapCycleEndCallback,
    totalCycleDuration,
    "slapCycle"
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
  // Cancel power slide when attacking
  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  
  // Clear parry success state when starting an attack
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  
  // Prevent double execution - if player is already attacking, don't start another attack
  if (player.isAttacking && player.attackType === "charged") {
    return;
  }

  // Charged attacks drain stamina (3x slap attack cost)
  player.stamina = Math.max(0, player.stamina - CHARGED_ATTACK_STAMINA_COST);

  // Check if mouse1 is held when the attack starts (for charge restart after recovery)
  const mouse1HeldOnStart = player.keys.mouse1;
  if (mouse1HeldOnStart) {
    player.mouse1HeldDuringAttack = true;
  }

  // Clear any pending charge attack to prevent double execution
  if (player.pendingChargeAttack) {
    player.pendingChargeAttack = null;
    player.spacebarReleasedDuringDodge = false;
  }

  // Don't execute charged attack if player is in a throw state
  if (player.isThrowing || player.isBeingThrown) {
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
  
  // Track when attack was attempted for counter hit detection
  player.attackAttemptTime = Date.now();
  
  // === STARTUP FRAMES - Telegraph before attack becomes active ===
  const CHARGED_STARTUP_MS = 150; // Clear windup before hit is active
  player.isInStartupFrames = true;
  player.startupEndTime = Date.now() + CHARGED_STARTUP_MS;
  
  // Set timeout to end startup frames
  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    CHARGED_STARTUP_MS,
    "chargedStartupEnd"
  );
  
  // Action lock through startup for visual clarity
  player.currentAction = "charged";
  player.actionLockUntil = Date.now() + CHARGED_STARTUP_MS;

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

    // Only auto-correct if opponent exists, is NOT dodging, and hasn't just dodged through us
    // If opponent is dodging or just crossed through, preserve the original facing direction
    // so the charged attack continues in its committed direction and whiffs naturally
    if (opponent && !opponent.isDodging && !opponent.justCrossedThrough) {
      const shouldFaceRight = player.x < opponent.x;
      const correctedFacing = shouldFaceRight ? -1 : 1;

      player.facing = correctedFacing;
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
    const player1ReadyX = 543; // Removed SIZE power-up condition
    const player2ReadyX = 735;

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
        player2.isStrafing = false;
      }
    }

    // Set ready state INDEPENDENTLY for each player when they reach their position
    if (
      player1.x === player1ReadyX &&
      !player1.isAttacking &&
      !player1.isChargingAttack &&
      !player1.isReady
    ) {
      player1.isReady = true;
    }
    
    if (
      player2.x === player2ReadyX &&
      !player2.isAttacking &&
      !player2.isChargingAttack &&
      !player2.isReady
    ) {
      player2.isReady = true;
    }

    // Only start the game countdown when BOTH players are ready
    if (player1.isReady && player2.isReady) {
      // Start a timer to trigger hakkiyoi after players are ready
      if (!room.readyStartTime) {
        room.readyStartTime = Date.now();
      }

      const currentTime = Date.now();
      const elapsedTime = currentTime - room.readyStartTime;
      
      // Authentic sumo timing:
      // 0-1500ms: Wait for power-up reveal to finish
      // 700ms: Gyoji says "TE WO TSUITE!" (Put your hands down!)
      // 3200ms: HAKKIYOI (game_start)
      
      if (elapsedTime >= 700 && !room.teWoTsuiteSent) {
        room.teWoTsuiteSent = true;
        io.in(room.id).emit("gyoji_call", "TE WO TSUITE!");
      }
      
      if (elapsedTime >= 3200) {
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
        // Ensure ritual phase is ended for both players
        player1.isInRitualPhase = false;
        player2.isInRitualPhase = false;
        // Reset mouse1PressTime so pre-game holds don't instantly trigger charging
        player1.mouse1PressTime = 0;
        player2.mouse1PressTime = 0;
        io.in(room.id).emit("game_start", true);
        player1.isReady = false;
        player2.isReady = false;
        room.readyStartTime = null;
        room.teWoTsuiteSent = false;
      }
    } else {
      // Reset if players leave ready state
      room.readyStartTime = null;
      room.teWoTsuiteSent = false;
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
  // Slightly reduced to allow natural close-quarters feel without excessive visual overlap
  const minDistance = (player1Hitbox.left + player2Hitbox.right) * 0.95;

  // Allow slightly closer proximity during slap attacks for close-quarters feel
  const slapOverlapReduction = 0.90; // Allow 10% more overlap during slap attacks (was 25%)
  const finalMinDistance =
    (player1.isAttacking && player1.isSlapAttack) ||
    (player2.isAttacking && player2.isSlapAttack)
      ? minDistance * slapOverlapReduction
      : minDistance;

  // If players are overlapping
  if (distanceBetweenCenters < finalMinDistance) {
    // Calculate how much overlap there is
    const overlap = finalMinDistance - distanceBetweenCenters;

    // Check if this is a slap attack scenario for gentler separation
    const isSlapAttackScenario =
      (player1.isAttacking && player1.attackType === "slap") ||
      (player2.isAttacking && player2.attackType === "slap");

    // Check if either player just landed from a dodge (needs fast separation to resolve overlap)
    const isPostDodgeOverlap =
      player1.justLandedFromDodge || player2.justLandedFromDodge;

    // Check if either player just finished a charged attack (recovery/endlag)
    const isPostChargedAttackOverlap =
      (player1.isRecovering || player1.isInEndlag) ||
      (player2.isRecovering || player2.isInEndlag);

    // SPECIAL CASE: Perfect parry stun separation
    const player1IsStunned = player1.isRawParryStun;
    const player2IsStunned = player2.isRawParryStun;

    let separationSpeed, newPlayer1X, newPlayer2X;

    if (player1IsStunned || player2IsStunned) {
      const separationDirection = player1.x < player2.x ? -1 : 1;

      // Deep overlap = players are inside each other (e.g. dodge cancel through into perfect parry)
      // Need aggressive two-sided separation so the stunned knockback fully plays out
      const deepOverlapThreshold = finalMinDistance * 0.3;
      const isDeepOverlap = overlap > deepOverlapThreshold;

      if (isDeepOverlap) {
        // Both players push apart — fast resolution like post-dodge overlap
        separationSpeed = Math.min(overlap * 0.85, 16);
        const stunnedShare = separationSpeed * 0.35;
        const otherShare = separationSpeed - stunnedShare;

        if (player1IsStunned && !player2IsStunned) {
          newPlayer1X = player1.x + separationDirection * stunnedShare;
          newPlayer2X = player2.x + -separationDirection * otherShare;
          player2.movementVelocity = 0;
        } else if (player2IsStunned && !player1IsStunned) {
          newPlayer1X = player1.x + separationDirection * otherShare;
          newPlayer2X = player2.x + -separationDirection * stunnedShare;
          player1.movementVelocity = 0;
        } else {
          newPlayer1X = player1.x;
          newPlayer2X = player2.x;
        }
      } else {
        // Shallow overlap — stunned player is anchored, other player takes all separation
        separationSpeed = Math.min(overlap * 0.7, 16);

        if (player1IsStunned && !player2IsStunned) {
          newPlayer1X = player1.x;
          newPlayer2X = player2.x + -separationDirection * separationSpeed;
          player2.movementVelocity = 0;
        } else if (player2IsStunned && !player1IsStunned) {
          newPlayer1X = player1.x + separationDirection * separationSpeed;
          newPlayer2X = player2.x;
          player1.movementVelocity = 0;
        } else {
          newPlayer1X = player1.x;
          newPlayer2X = player2.x;
        }
      }
    } else if (isPostDodgeOverlap || isPostChargedAttackOverlap) {
      // FAST separation after dodge landing or charged attack ends
      // Resolves overlap in ~4-5 frames instead of lingering — smooth exponential ease-out
      separationSpeed = Math.min(overlap * 0.85, 16);

      // Calculate separation direction
      const separationDirection = player1.x < player2.x ? -1 : 1;

      // Apply smooth separation - each player moves by half
      const separationPerPlayer = separationSpeed / 2;

      // Calculate new positions
      newPlayer1X = player1.x + separationDirection * separationPerPlayer;
      newPlayer2X = player2.x + -separationDirection * separationPerPlayer;
    } else if (isSlapAttackScenario) {
      // Moderate separation during slap attacks — close-quarters but not overlapping
      separationSpeed = Math.min(overlap * 0.6, 10);

      // Calculate separation direction
      const separationDirection = player1.x < player2.x ? -1 : 1;

      // Apply smooth separation - each player moves by half
      const separationPerPlayer = separationSpeed / 2;

      // Calculate new positions
      newPlayer1X = player1.x + separationDirection * separationPerPlayer;
      newPlayer2X = player2.x + -separationDirection * separationPerPlayer;
    } else {
      // Normal collision — block movement without pushing the other player
      separationSpeed = Math.min(overlap * 0.7, 16);
      const separationDirection = player1.x < player2.x ? -1 : 1;

      const p1MovingToward =
        (player1.x < player2.x && player1.movementVelocity > 0) ||
        (player1.x > player2.x && player1.movementVelocity < 0);
      const p2MovingToward =
        (player2.x < player1.x && player2.movementVelocity > 0) ||
        (player2.x > player1.x && player2.movementVelocity < 0);

      if (p1MovingToward && !p2MovingToward) {
        newPlayer1X = player1.x + separationDirection * separationSpeed;
        newPlayer2X = player2.x;
        player1.movementVelocity = 0;
      } else if (p2MovingToward && !p1MovingToward) {
        newPlayer1X = player1.x;
        newPlayer2X = player2.x + -separationDirection * separationSpeed;
        player2.movementVelocity = 0;
      } else {
        const separationPerPlayer = separationSpeed / 2;
        newPlayer1X = player1.x + separationDirection * separationPerPlayer;
        newPlayer2X = player2.x + -separationDirection * separationPerPlayer;
      }
    }

    // Apply strong resistance to movement velocity when players are pushing into each other
    // Reduce resistance during slap attacks to allow smooth close-quarters movement
    // Note: Stunned players already handled above with full anchor behavior
    if (
      !player1.isHit &&
      !player1.isSlapKnockback &&
      !player1IsStunned && // Don't double-process stunned players
      player1.movementVelocity
    ) {
      const isMovingTowards =
        (player1.x < player2.x && player1.movementVelocity > 0) ||
        (player1.x > player2.x && player1.movementVelocity < 0);
      if (isMovingTowards) {
        // If opponent is stunned, apply maximum resistance (already handled above)
        // Otherwise use normal resistance
        const resistance = isSlapAttackScenario ? 0.85 : 0.5;
        player1.movementVelocity *= resistance;
      }
    }
    if (
      !player2.isHit &&
      !player2.isSlapKnockback &&
      !player2IsStunned && // Don't double-process stunned players
      player2.movementVelocity
    ) {
      const isMovingTowards =
        (player2.x < player1.x && player2.movementVelocity > 0) ||
        (player2.x > player1.x && player2.movementVelocity < 0);
      if (isMovingTowards) {
        // If opponent is stunned, apply maximum resistance (already handled above)
        // Otherwise use normal resistance
        const resistance = isSlapAttackScenario ? 0.85 : 0.5;
        player2.movementVelocity *= resistance;
      }
    }

    // Enforce map boundaries with symmetric correction
    // BUT: Don't enforce boundaries if players are being knocked back from hits
    const leftBoundary = MAP_LEFT_BOUNDARY;
    const rightBoundary = MAP_RIGHT_BOUNDARY;

    // Check if either player would go out of bounds
    const player1OutOfBounds =
      newPlayer1X < leftBoundary || newPlayer1X > rightBoundary;
    const player2OutOfBounds =
      newPlayer2X < leftBoundary || newPlayer2X > rightBoundary;

    // Don't enforce boundaries if either player is being knocked back from a hit
    const player1IsBeingKnockedBack = player1.isHit;
    const player2IsBeingKnockedBack = player2.isHit;

    // Special case: if both players are at the same boundary and overlapping,
    // force one player to switch sides for proper separation (like dodge through behavior)
    const bothAtSameBoundary =
      (player1.x <= leftBoundary + 5 && player2.x <= leftBoundary + 5) ||
      (player1.x >= rightBoundary - 5 && player2.x >= rightBoundary - 5);

    if (bothAtSameBoundary && distanceBetweenCenters < finalMinDistance) {
      // Handle boundary-respecting separation ONLY during knockback scenarios
      if (player1IsBeingKnockedBack || player2IsBeingKnockedBack) {
        // Apply separation but enforce boundaries to prevent players from going outside map
        // Note: Stunned players (isRawParryStun) should never be moved by collision
        if (!player1IsBeingKnockedBack && !player1.isRawParrying && !player1.isRawParryStun) {
          player1.x = Math.max(
            leftBoundary,
            Math.min(newPlayer1X, rightBoundary)
          );
        }
        if (!player2IsBeingKnockedBack && !player2.isRawParrying && !player2.isRawParryStun) {
          player2.x = Math.max(
            leftBoundary,
            Math.min(newPlayer2X, rightBoundary)
          );
        }
        return;
      }

      // Smooth separation when both players are at the same boundary

      // Determine which player should switch sides based on their recent movement or facing direction
      let playerToMove = null;
      let playerToKeep = null;

      // First check if either player is raw parrying - they should stay put
      if (player1.isRawParrying && !player2.isRawParrying) {
        playerToKeep = player1;
        playerToMove = player2;
      } else if (player2.isRawParrying && !player1.isRawParrying) {
        playerToKeep = player2;
        playerToMove = player1;
      } else if (player1.isRawParrying && player2.isRawParrying) {
        // Both are raw parrying - neither should move, just return
        return;
      } else {
        // Neither is raw parrying, use normal logic
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
          if (
            player1.x >= rightBoundary - 5 &&
            player2.x >= rightBoundary - 5
          ) {
            playerToMove = player1.x > player2.x ? player1 : player2;
            playerToKeep = playerToMove === player1 ? player2 : player1;
          } else {
            playerToMove = player1.x < player2.x ? player1 : player2;
            playerToKeep = playerToMove === player1 ? player2 : player1;
          }
        }
      }

      // Keep one player at the boundary (minimal adjustment)
      if (!playerToKeep.isRawParrying) {
        const keeperTargetX = Math.max(
          leftBoundary,
          Math.min(playerToKeep.x, rightBoundary)
        );
        playerToKeep.x += (keeperTargetX - playerToKeep.x) * 0.4; // Increased from 0.2 to 0.4 for faster approach to boundary
      }

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
        if (!playerToMove.isRawParrying) {
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
        }
      } else {
        // Already properly separated, clear any velocity (but only if not raw parrying)
        if (!playerToMove.isRawParrying) {
          playerToMove.movementVelocity = 0;
        }
      }
    } else if (player1OutOfBounds || player2OutOfBounds) {
      // Handle boundary-respecting separation ONLY during knockback scenarios
      if (player1IsBeingKnockedBack || player2IsBeingKnockedBack) {
        // Apply separation but enforce boundaries to prevent players from going outside map
        // Note: Stunned players (isRawParryStun) should never be moved by collision
        if (!player1IsBeingKnockedBack && !player1.isRawParrying && !player1.isRawParryStun) {
          player1.x = Math.max(
            leftBoundary,
            Math.min(newPlayer1X, rightBoundary)
          );
        }
        if (!player2IsBeingKnockedBack && !player2.isRawParrying && !player2.isRawParryStun) {
          player2.x = Math.max(
            leftBoundary,
            Math.min(newPlayer2X, rightBoundary)
          );
        }
        return;
      }

      // Normal boundary handling for non-overlapping cases
      // Note: Stunned players (isRawParryStun) should never be moved by collision
      if (player1OutOfBounds && !player2OutOfBounds) {
        // Player 1 is blocked by boundary, move player 2 by full separation distance
        if (!player1.isRawParrying && !player1.isRawParryStun) {
          player1.x = Math.max(
            leftBoundary,
            Math.min(player1.x, rightBoundary)
          ); // Keep player1 at boundary
        }
        const fullSeparationDirection = player2.x < player1.x ? -1 : 1;
        const newPlayer2XFull =
          player2.x + fullSeparationDirection * separationSpeed;
        if (
          newPlayer2XFull >= leftBoundary &&
          newPlayer2XFull <= rightBoundary &&
          !player2.isRawParrying &&
          !player2.isRawParryStun
        ) {
          player2.x = newPlayer2XFull;
        }
      } else if (player2OutOfBounds && !player1OutOfBounds) {
        // Player 2 is blocked by boundary, move player 1 by full separation distance
        if (!player2.isRawParrying && !player2.isRawParryStun) {
          player2.x = Math.max(
            leftBoundary,
            Math.min(player2.x, rightBoundary)
          ); // Keep player2 at boundary
        }
        const fullSeparationDirection = player1.x < player2.x ? -1 : 1;
        const newPlayer1XFull =
          player1.x + fullSeparationDirection * separationSpeed;
        if (
          newPlayer1XFull >= leftBoundary &&
          newPlayer1XFull <= rightBoundary &&
          !player1.isRawParrying &&
          !player1.isRawParryStun
        ) {
          player1.x = newPlayer1XFull;
        }
      } else {
        // Both players would go out of bounds - clamp both to boundaries
        if (!player1.isRawParrying && !player1.isRawParryStun) {
          player1.x = Math.max(
            leftBoundary,
            Math.min(newPlayer1X, rightBoundary)
          );
        }
        if (!player2.isRawParrying && !player2.isRawParryStun) {
          player2.x = Math.max(
            leftBoundary,
            Math.min(newPlayer2X, rightBoundary)
          );
        }
      }
    } else {
      // Both players can move normally, but check if they're raw parrying or stunned
      // Stunned players (isRawParryStun) should be anchored and not moved by collision
      if (!player1.isRawParrying && !player1.isRawParryStun) {
        player1.x = newPlayer1X;
      }
      if (!player2.isRawParrying && !player2.isRawParryStun) {
        player2.x = newPlayer2X;
      }
    }
  }
}

// Add helper function to safely end charged attacks with recovery check
function safelyEndChargedAttack(player, rooms) {
  // === ENDLAG DURATION FOR CHARGED ATTACKS ===
  const CHARGED_ENDLAG_DURATION = 300; // Recovery after charged attack ends

  // Only handle charged attacks, let slap attacks end normally
  if (player.attackType === "charged" && !player.chargedAttackHit) {
    // Find the current room and opponent to check if recovery is needed
    const currentRoom = rooms.find((room) =>
      room.players.some((p) => p.id === player.id)
    );

    if (currentRoom) {
      const opponent = currentRoom.players.find((p) => p.id !== player.id);

      // Set recovery for missed charged attacks - INCREASED duration for visual clarity
      if (opponent && !opponent.isHit && !player.isChargingAttack) {
        player.isRecovering = true;
        player.recoveryStartTime = Date.now();
        player.recoveryDuration = 400; // Was 250ms - now longer for clearer punishment
        player.recoveryDirection = player.facing;
        // Use movement velocity for natural sliding
        player.movementVelocity = player.facing * -3;
        player.knockbackVelocity = { x: 0, y: 0 };
      } else {
      }
    }
  }

  // Clear attack states (for both charged and slap attacks)
  if (!player.isChargingAttack) {
    // Save whether the attack connected before clearing the flag
    const attackConnected = player.chargedAttackHit;
    
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;
    player.chargedAttackHit = false; // Reset hit tracking
    
    // Only apply endlag for attacks that DIDN'T connect (whiffed attacks)
    // Connected attacks are already handled by processHit's recovery state
    if (!attackConnected && !player.isRecovering) {
      // === ENDLAG - Visual recovery period ===
      player.isInEndlag = true;
      player.endlagEndTime = Date.now() + CHARGED_ENDLAG_DURATION;
      player.currentAction = "endlag";
      player.actionLockUntil = Date.now() + CHARGED_ENDLAG_DURATION;
      
      // Set attack cooldown to prevent immediate spam
      player.attackCooldownUntil = Date.now() + CHARGED_ENDLAG_DURATION + 150;

      // Clear the mouse1 flag - restart logic now happens immediately when recovery ends
      player.mouse1HeldDuringAttack = false;

      // Clear endlag after duration via timeout
      setPlayerTimeout(
        player.id,
        () => {
          player.isInEndlag = false;
          player.endlagEndTime = 0;
          if (player.currentAction === "endlag" || player.currentAction === "charged") {
            player.actionLockUntil = 0;
            player.currentAction = null;
          }
          
          // Check for buffered actions after endlag ends
          if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
            const action = player.bufferedAction;
            player.bufferedAction = null;
            player.bufferExpiryTime = 0;

            // Execute the buffered action
            // CRITICAL: Block buffered dodge if player is being grabbed
            if (action.type === "dodge" && player.stamina >= DODGE_STAMINA_COST && !player.isBeingGrabbed) {
              // Clear movement momentum for static dodge distance
              player.movementVelocity = 0;
              player.isStrafing = false;
              
              player.isDodging = true;
              player.isDodgeCancelling = false;
              player.dodgeCancelStartTime = 0;
              player.dodgeCancelStartY = 0;
              player.dodgeStartTime = Date.now();
              player.dodgeEndTime = Date.now() + 450;
              player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
              player.dodgeDirection = action.direction;
              player.dodgeStartX = player.x;
              player.dodgeStartY = player.y;
            }
          }
        },
        CHARGED_ENDLAG_DURATION,
        "chargedEndlagReset"
      );
    } else {
      // Attack connected — processHit already handles recovery, just clear stale flags
      player.mouse1HeldDuringAttack = false;
    }
  } else {
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

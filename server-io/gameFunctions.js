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
  canPlayerSlap,
  canPlayerUseAction,
  canPlayerDash,
  shouldRestartCharging,
  startCharging,
} = require("./gameUtils");

const {
  GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE,
  SLAP_HITBOX_DISTANCE_VALUE,
  SLAP_ATTACK_STAMINA_COST,
  CHARGED_ATTACK_STAMINA_COST,
  DODGE_STAMINA_COST,
  DODGE_DURATION,
  DODGE_SLIDE_MOMENTUM,
  DODGE_POWERSLIDE_BOOST,
  RAW_PARRY_STAMINA_COST,
  CHARGE_FULL_POWER_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  SLAP_TOTAL_MS,
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MS,
  DODGE_STARTUP_MS,
  DODGE_RECOVERY_MS,
  GRAB_STARTUP_DURATION_MS,
  GRAB_STATES,
  INPUT_BUFFER_WINDOW_MS,
} = require("./constants");

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
  player.isEdgePushing = false;
  player.isBeingEdgePushed = false;
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
  opponent.isEdgePushing = false;
  opponent.isBeingEdgePushed = false;
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
  // Cinematic kill victims stay at ground level (no fall)
  const fallenGroundLevel = GROUND_LEVEL - DOHYO_FALL_DEPTH;
  const loserShouldBeAtFallenLevel = 
    !loser.isCinematicKillVictim && (
      loser.isFallingOffDohyo || 
      isOutsideDohyo(loser.x, loser.y) || 
      loser.y < GROUND_LEVEL
    );
  
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

    // Clear rope jump state when game ends
    if (p.isRopeJumping) {
      p.y = GROUND_LEVEL;
      p.isRopeJumping = false;
      p.ropeJumpPhase = null;
      p.ropeJumpStartTime = 0;
      p.ropeJumpStartX = 0;
      p.ropeJumpTargetX = 0;
      p.ropeJumpDirection = 0;
      p.ropeJumpActiveStartTime = 0;
      p.ropeJumpLandingTime = 0;
    }

    // Clear parry states to prevent jiggle/flash animations persisting into round result
    p.isRawParrying = false;
    p.rawParryStartTime = 0;
    p.rawParryMinDurationMet = false;
    p.isRawParrySuccess = false;
    p.isPerfectRawParrySuccess = false;
    p.isRawParryStun = false;

    // Clear ALL grab states to prevent grabs persisting into next round
    p.isGrabbing = false;
    p.isBeingGrabbed = false;
    p.grabbedOpponent = null;
    p.grabStartTime = 0;
    p.isThrowing = false;
    p.isBeingThrown = false;
    p.throwStartTime = 0;
    p.throwEndTime = 0;
    p.throwOpponent = null;
    p.throwingFacingDirection = null;
    p.beingThrownFacingDirection = null;
    p.isGrabBreaking = false;
    p.isGrabBreakCountered = false;
    p.isGrabTeching = false;
    p.grabTechRole = null;
    p.isGrabPushing = false;
    p.isBeingGrabPushed = false;
    p.isAttemptingPull = false;
    p.isGrabSeparating = false;
    p.isGrabWalking = false;
    p.isGrabbingMovement = false;
    p.isGrabStartup = false;
    p.isWhiffingGrab = false;
    p.isGrabWhiffRecovery = false;
    p.isGrabBellyFlopping = false;
    p.isBeingGrabBellyFlopped = false;
    p.isGrabFrontalForceOut = false;
    p.isBeingGrabFrontalForceOut = false;
    p.isCounterGrabbed = false;
    p.isAttemptingGrabThrow = false;
    p.grabThrowAttemptStartTime = 0;

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
        (Date.now() - player.lastSlapHitLandedTime < 450); // Within one attack cycle (wider window for longer recovery)
      let slapSlideVelocity = recentlyLandedSlap ? 1.6 : 1.0; // Chain lunge vs normal approach (nerfed from 2.2/1.2)

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

  // === SLAP ATTACK TIMING - Formal frame data ===
  // Startup (70ms) → Active (100ms) → Recovery (150ms) = 320ms total
  // Recovery creates a gap where the opponent can respond between slaps.
  const attackDuration = SLAP_STARTUP_MS + SLAP_ACTIVE_MS; // 170ms — hitbox is live from startup end to here

  // DESPERATION COUNTER-SLAP: If the player just recovered from hit stun,
  // their next slap has faster startup so it's more likely to create a slap parry.
  const recentlyRecoveredFromHit = player.lastHitTime && 
    (Date.now() - player.lastHitTime < 380) && // Within hit stun window + small buffer
    !player.isHit; // Must have already recovered
  const startupDuration = recentlyRecoveredFromHit ? 45 : SLAP_STARTUP_MS; // Quick wind-up per strike

  const totalCycleDuration = SLAP_TOTAL_MS; // Full cycle including recovery gap

  player.isSlapAttack = true;
  player.attackEndTime = Date.now() + attackDuration;
  player.slapActiveEndTime = Date.now() + SLAP_STARTUP_MS + SLAP_ACTIVE_MS; // When hitbox goes away
  player.isAttacking = true;
  player.attackStartTime = Date.now();
  player.attackType = "slap";
  player.currentAction = "slap";
  
  // Track when attack was attempted for counter hit detection
  // This is set immediately so even if hit detection happens in the same tick,
  // we can detect if the player was trying to attack
  player.attackAttemptTime = Date.now();
  
  // Single cooldown controls everything - full cycle including recovery
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
      player.slapActiveEndTime = 0;
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
      
      // After slap ends, if mouse1 still held → begin charging (TAP-style hidden charge)
      // Require a minimum hold duration to prevent spam-tapping from accidentally triggering charge.
      // A player genuinely holding through the slap cycle (270ms) easily clears this threshold,
      // while a mid-tap during spam (~60-80ms hold) does not.
      const holdDuration = player.mouse1PressTime > 0 ? Date.now() - player.mouse1PressTime : 0;
      if (
        player.keys.mouse1 &&
        holdDuration >= 150 &&
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
        if (player.chargeAttackPower > 0) {
          player.chargeStartTime = Date.now() - (player.chargeAttackPower / 100 * CHARGE_FULL_POWER_MS);
        } else if (!player.chargeStartTime) {
          player.chargeStartTime = Date.now();
          player.chargeAttackPower = 1;
        }
        player.attackType = "charged";
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
  player.isInStartupFrames = true;
  player.startupEndTime = Date.now() + CHARGED_STARTUP_MS;
  // Hitbox stays active from end of startup until the attack ends (full lunge duration).
  // CHARGED_ACTIVE_MS is no longer used as a cutoff — the lunge IS the active window.
  player.chargedActiveEndTime = player.attackEndTime;
  
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
    if (opponent && !opponent.isDodging) {
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
    // isChargingAttack is allowed — tachiai charging during walk-to-ready
    if (
      player1.canMoveToReady &&
      !player1.isAttacking
    ) {
      if (player1.x < player1ReadyX) {
        player1.x += 2;
        player1.isStrafing = true;
      } else {
        player1.x = player1ReadyX;
        if (player2.x === player2ReadyX) {
          player1.isStrafing = false;
        }
      }
    }

    if (
      player2.canMoveToReady &&
      !player2.isAttacking
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
    // isChargingAttack is allowed — tachiai charging doesn't block ready state
    if (
      player1.x === player1ReadyX &&
      !player1.isAttacking &&
      !player1.isReady
    ) {
      player1.isReady = true;
    }
    
    if (
      player2.x === player2ReadyX &&
      !player2.isAttacking &&
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
  // If either player is dodging or rope jumping, return false immediately
  if (player1.isDodging || player2.isDodging ||
      (player1.isRopeJumping && player1.ropeJumpPhase === "active") ||
      (player2.isRopeJumping && player2.ropeJumpPhase === "active")) {
    return false;
  }

  // If either player is in recovery from a dash + charged attack, allow collision checks
  const isRecoveringFromDashAttack = (player) => {
    return (
      player.isRecovering &&
      player.recoveryStartTime &&
      Date.now() - player.recoveryStartTime < player.recoveryDuration
    );
  };

  if (
    isRecoveringFromDashAttack(player1) ||
    isRecoveringFromDashAttack(player2)
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
  if (
    player1.isThrowing || player2.isThrowing ||
    player1.isBeingThrown || player2.isBeingThrown ||
    (player1.isRopeJumping && player1.ropeJumpPhase === "active") ||
    (player2.isRopeJumping && player2.ropeJumpPhase === "active")
  ) {
    return;
  }

  // Charged attacks need to reach the opponent to connect — pushbox yields to hit detection.
  // Without this, the pushbox (148px) prevents the lunge from closing distance.
  const p1ActiveCharged = player1.isAttacking && player1.attackType === "charged" && !player1.isInStartupFrames;
  const p2ActiveCharged = player2.isAttacking && player2.attackType === "charged" && !player2.isInStartupFrames;
  if (p1ActiveCharged || p2ActiveCharged) {
    return;
  }

  // Grab system tweens (pull reversal, belly flop, etc.) control position directly.
  // The pushbox must yield so side-swap mechanics work correctly.
  // Note: isGrabSeparating is NOT included — the pushbox should snap players to minDistance
  // after a grab push ends, and the separation velocity handles the rest.
  if (
    player1.isGrabBreakSeparating || player2.isGrabBreakSeparating ||
    player1.isBeingPullReversaled || player2.isBeingPullReversaled ||
    player1.isGrabBellyFlopping || player2.isGrabBellyFlopping ||
    player1.isBeingGrabBellyFlopped || player2.isBeingGrabBellyFlopped ||
    player1.isGrabFrontalForceOut || player2.isGrabFrontalForceOut ||
    player1.isBeingGrabFrontalForceOut || player2.isBeingGrabFrontalForceOut
  ) {
    return;
  }

  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  const distanceBetweenCenters = Math.abs(player1.x - player2.x);
  const minDistance = player1Hitbox.left + player2Hitbox.right;

  if (distanceBetweenCenters >= minDistance) return;

  const overlap = minDistance - distanceBetweenCenters;

  // Rope jump landing: use jump direction as tiebreaker only when centers are
  // ambiguously close (genuine crossup zone). Otherwise let positions decide.
  let p1IsLeft;
  const halfBody = minDistance * 0.5;
  if (player1.isRopeJumping && player1.ropeJumpPhase === "landing" && distanceBetweenCenters < halfBody) {
    p1IsLeft = player1.ropeJumpDirection < 0;
  } else if (player2.isRopeJumping && player2.ropeJumpPhase === "landing" && distanceBetweenCenters < halfBody) {
    p1IsLeft = player2.ropeJumpDirection > 0;
  } else {
    p1IsLeft = player1.x <= player2.x;
  }

  const p1Anchored = player1.isHit || player1.isRawParryStun || player1.isRawParrying;
  const p2Anchored = player2.isHit || player2.isRawParryStun || player2.isRawParrying;

  let p1Share, p2Share;

  if (p1Anchored && p2Anchored) {
    p1Share = 0.5;
    p2Share = 0.5;
  } else if (p1Anchored) {
    p1Share = 0;
    p2Share = 1;
  } else if (p2Anchored) {
    p1Share = 1;
    p2Share = 0;
  } else {
    const p1MovingToward = (p1IsLeft && player1.movementVelocity > 0) ||
                           (!p1IsLeft && player1.movementVelocity < 0);
    const p2MovingToward = (!p1IsLeft && player2.movementVelocity > 0) ||
                           (p1IsLeft && player2.movementVelocity < 0);

    if (p1MovingToward && !p2MovingToward) {
      p1Share = 1; p2Share = 0;
    } else if (p2MovingToward && !p1MovingToward) {
      p1Share = 0; p2Share = 1;
    } else {
      p1Share = 0.5; p2Share = 0.5;
    }
  }

  // During rope jump landing, cap the push per tick for a smooth slide instead of a snap
  const ropeJumpLanding = (player1.isRopeJumping && player1.ropeJumpPhase === "landing") ||
                          (player2.isRopeJumping && player2.ropeJumpPhase === "landing");
  const effectiveOverlap = ropeJumpLanding ? Math.min(overlap, 18) : overlap;

  if (p1IsLeft) {
    player1.x -= effectiveOverlap * p1Share;
    player2.x += effectiveOverlap * p2Share;
  } else {
    player1.x += effectiveOverlap * p1Share;
    player2.x -= effectiveOverlap * p2Share;
  }

  const leftBoundary = MAP_LEFT_BOUNDARY;
  const rightBoundary = MAP_RIGHT_BOUNDARY;

  // Boundary enforcement with remainder transfer
  if (!player1.isHit) {
    const clamped = Math.max(leftBoundary, Math.min(player1.x, rightBoundary));
    if (clamped !== player1.x) {
      const remainder = Math.abs(player1.x - clamped);
      player1.x = clamped;
      if (!player2.isHit) {
        player2.x += (p1IsLeft ? 1 : -1) * remainder;
      }
    }
  }
  if (!player2.isHit) {
    const clamped = Math.max(leftBoundary, Math.min(player2.x, rightBoundary));
    if (clamped !== player2.x) {
      const remainder = Math.abs(player2.x - clamped);
      player2.x = clamped;
      if (!player1.isHit) {
        player1.x += (p1IsLeft ? -1 : 1) * remainder;
      }
    }
  }

  // Final safety clamp
  if (!player1.isHit) {
    player1.x = Math.max(leftBoundary, Math.min(player1.x, rightBoundary));
  }
  if (!player2.isHit) {
    player2.x = Math.max(leftBoundary, Math.min(player2.x, rightBoundary));
  }

  // Kill velocity for any non-anchored player moving toward the other
  if (!p1Anchored) {
    const isToward = (player1.x < player2.x && player1.movementVelocity > 0) ||
                     (player1.x > player2.x && player1.movementVelocity < 0);
    if (isToward) player1.movementVelocity = 0;
  }
  if (!p2Anchored) {
    const isToward = (player2.x < player1.x && player2.movementVelocity > 0) ||
                     (player2.x > player1.x && player2.movementVelocity < 0);
    if (isToward) player2.movementVelocity = 0;
  }
}

// Add helper function to safely end charged attacks with recovery check
function safelyEndChargedAttack(player, rooms) {
  // === ENDLAG DURATION FOR CHARGED ATTACKS ===
  const CHARGED_ENDLAG_DURATION = 300; // Recovery after charged attack ends (matches ATTACK_ENDLAG_CHARGED_MS)

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
    player.chargedAttackHit = false;
    player.chargedActiveEndTime = 0;
    
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
            // CRITICAL: Block buffered dash if player is being grabbed
            if (action.type === "dash" && !player.isGassed && !player.isBeingGrabbed) {
              player.movementVelocity = 0;
              player.isStrafing = false;
              
              player.isDodging = true;
              player.dodgeStartTime = Date.now();
              player.dodgeEndTime = Date.now() + DODGE_DURATION;
              player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
              player.dodgeDirection = action.direction;
              player.dodgeStartX = player.x;
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

// Enables frame-1 reversals: if a player holds an input during an unactionable grab/throw state,
// that input activates on the first possible frame (like invincible reversals in fighting games).
function activateBufferedInputAfterGrab(player, rooms) {
  if (player.isAtTheRopes || player.isRopeJumping || player.isThrowLanded || player.isHit ||
      player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating ||
      player.isGrabSeparating) return;

  player.inputBuffer = null;

  // Priority 0: Buffered dash (spammed shift while grabbed/thrown)
  if (
    player.bufferedAction &&
    player.bufferedAction.type === "dash" &&
    player.bufferExpiryTime &&
    Date.now() < player.bufferExpiryTime &&
    !player.isGassed
  ) {
    const direction = player.bufferedAction.direction;
    player.bufferedAction = null;
    player.bufferExpiryTime = 0;
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.movementVelocity = 0;
    player.isStrafing = false;
    player.isPowerSliding = false;
    player.isBraking = false;
    player.isDodging = true;
    player.isDodgeStartup = true;
    player.dodgeStartTime = Date.now();
    player.dodgeStartupEndTime = Date.now() + DODGE_STARTUP_MS;
    player.dodgeEndTime = Date.now() + DODGE_DURATION;
    player.dodgeStartX = player.x;
    player.dodgeDirection = direction;
    player.currentAction = "dash";
    player.actionLockUntil = Date.now() + 100;
    player.justLandedFromDodge = false;
    player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
    clearChargeState(player, true);
    return;
  }

  // Priority 1: Raw parry (spacebar) - defensive reversal
  if (player.keys[" "] && !player.grabBreakSpaceConsumed) {
    player.isRawParrying = true;
    player.rawParryStartTime = Date.now();
    player.rawParryMinDurationMet = false;
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.stamina = Math.max(0, player.stamina - RAW_PARRY_STAMINA_COST);
    player.movementVelocity = 0;
    player.isStrafing = false;
    player.isPowerSliding = false;
    player.isCrouchStance = false;
    player.isCrouchStrafing = false;
    player.hasPendingSlapAttack = false;
    clearChargeState(player, true);
    return;
  }

  // Priority 2: Dodge (shift) - evasive option (blocked only when gassed)
  if (player.keys.shift && !player.keys.mouse2 && !player.isGassed) {
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.movementVelocity = 0;
    player.isStrafing = false;
    player.isPowerSliding = false;
    player.isBraking = false;
    player.isDodging = true;
    player.isDodgeStartup = true;
    player.dodgeStartTime = Date.now();
    player.dodgeStartupEndTime = Date.now() + DODGE_STARTUP_MS;
    player.dodgeEndTime = Date.now() + DODGE_DURATION;
    player.dodgeStartX = player.x;
    player.currentAction = "dash";
    player.actionLockUntil = Date.now() + 100;
    player.justLandedFromDodge = false;
    player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
    clearChargeState(player, true);

    if (player.keys.a) {
      player.dodgeDirection = -1;
    } else if (player.keys.d) {
      player.dodgeDirection = 1;
    } else {
      player.dodgeDirection = player.facing === -1 ? 1 : -1;
    }

    return;
  }

  // Priority 3: Mouse1 held — resume charging or fire a slap
  if (player.keys.mouse1) {
    if (player.chargeAttackPower > 0) {
      startCharging(player);
    } else {
      player.mouse1PressTime = Date.now();
      if (canPlayerSlap(player)) {
        executeSlapAttack(player, rooms);
      }
    }
    return;
  }

  // Priority 4: Grab (mouse2)
  if (player.keys.mouse2 && !player.grabCooldown) {
    player.postGrabInputBuffer = true;
    return;
  }
}

function executeInputBuffer(player, rooms) {
  if (!player.inputBuffer) return false;

  const age = Date.now() - player.inputBuffer.timestamp;
  if (age >= INPUT_BUFFER_WINDOW_MS) {
    player.inputBuffer = null;
    return false;
  }

  if (player.inputLockUntil && Date.now() < player.inputLockUntil) return false;
  if (player.actionLockUntil && Date.now() < player.actionLockUntil) return false;
  if (player.isGrabSeparating || player.isGrabBreakSeparating) return false;
  if (player.isBeingPullReversaled) return false;
  if (player.isGrabBreaking || player.isGrabBreakCountered) return false;
  if (player.isGrabBellyFlopping || player.isBeingGrabBellyFlopped) return false;
  if (player.isGrabFrontalForceOut || player.isBeingGrabFrontalForceOut) return false;
  if (player.isHit || player.isBeingThrown || player.isBeingGrabbed) return false;
  if (player.isAtTheRopes || player.isRopeJumping || player.isGrabClashing) return false;
  if (player.canMoveToReady) return false;

  const buffer = player.inputBuffer;

  switch (buffer.type) {
    case "rawParry": {
      if (!player.isRawParrying && !player.isRawParryStun &&
          !player.isAttacking && !player.isDodging &&
          !player.isRecovering && !player.isGrabbing &&
          !player.isGrabbingMovement && !player.isWhiffingGrab &&
          !player.isThrowing && !player.grabBreakSpaceConsumed) {
        player.isRawParrying = true;
        player.rawParryStartTime = Date.now();
        player.rawParryMinDurationMet = false;
        player.isRawParrySuccess = false;
        player.isPerfectRawParrySuccess = false;
        player.stamina = Math.max(0, player.stamina - RAW_PARRY_STAMINA_COST);
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isPowerSliding = false;
        player.isCrouchStance = false;
        player.isCrouchStrafing = false;
        player.hasPendingSlapAttack = false;
        clearChargeState(player, true);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "dodge": {
      if (canPlayerDash(player) && !player.isGassed) {
        player.isRawParrySuccess = false;
        player.isPerfectRawParrySuccess = false;
        clearChargeState(player, true);
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isPowerSliding = false;
        player.isBraking = false;
        player.isDodging = true;
        player.isDodgeStartup = true;
        player.dodgeStartTime = Date.now();
        player.dodgeStartupEndTime = Date.now() + DODGE_STARTUP_MS;
        player.dodgeEndTime = Date.now() + DODGE_DURATION;
        player.dodgeStartX = player.x;
        player.currentAction = "dash";
        player.actionLockUntil = Date.now() + 100;
        player.justLandedFromDodge = false;
        player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);

        if (player.keys.a) {
          player.dodgeDirection = -1;
        } else if (player.keys.d) {
          player.dodgeDirection = 1;
        } else {
          player.dodgeDirection = player.facing === -1 ? 1 : -1;
        }

        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "slap": {
      if (canPlayerSlap(player)) {
        executeSlapAttack(player, rooms);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "grab": {
      if (canPlayerUseAction(player) && !player.grabCooldown &&
          !player.isRawParrying && !player.isGrabbingMovement &&
          !player.isWhiffingGrab && !player.isGrabWhiffRecovery &&
          !player.isGrabTeching && !player.isGrabStartup) {
        player.isRawParrySuccess = false;
        player.isPerfectRawParrySuccess = false;
        clearChargeState(player, true);
        player.isGrabStartup = true;
        player.grabStartupStartTime = Date.now();
        player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
        player.currentAction = "grab_startup";
        player.actionLockUntil = Date.now() + GRAB_STARTUP_DURATION_MS;
        player.grabState = GRAB_STATES.ATTEMPTING;
        player.grabAttemptType = "grab";
        player.grabApproachSpeed = Math.abs(player.movementVelocity);
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isPowerSliding = false;
        player.inputBuffer = null;
        return true;
      }
      break;
    }
  }

  return false;
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
  activateBufferedInputAfterGrab,
  executeInputBuffer,
};

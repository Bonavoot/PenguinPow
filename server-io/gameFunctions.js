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
  canPlayerSidestep,
  getSidestepInitData,
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
  RAW_PARRY_STAMINA_COST, RAW_PARRY_COOLDOWN_MS,
  CHARGE_FULL_POWER_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  SLAP_TOTAL_MS,
  SLAP_STRING_BUFFER_WINDOW_MS,
  SLAP_STRING_END_COOLDOWN_MS,
  SLAP_STRING_HIT_TOTAL_MS,
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MS,
  DODGE_STARTUP_MS,
  DODGE_RECOVERY_MS,
  GRAB_STARTUP_DURATION_MS,
  GRAB_STATES,
  INPUT_BUFFER_WINDOW_MS,
  POWER_UP_TYPES,
  SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MAX_MS, SIDESTEP_RECOVERY_MS,
  SIDESTEP_TOTAL_MS, SIDESTEP_STAMINA_COST,
} = require("./constants");

// Hit 3 charge functions removed — charged attack is now a standalone move (S + FORWARD + MOUSE1)

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
  player.lastResistStaminaDrainTime = 0;
  // Clinch system cleanup
  player.hasGrip = false;
  player.gripAcquiredTime = 0;
  player.inClinch = false;
  player.clinchAction = null;
  player.clinchOpponent = null;
  player.clinchStalemateStart = 0;
  player.clinchStalemateLastX = 0;
  player.clinchStalemateLastBalance = 0;
  // Clinch throw/pull/lift cleanup
  player.clinchThrowRequest = null;
  player.clinchThrowRequestTime = 0;
  player.clinchThrowActive = false;
  player.clinchThrowType = null;
  player.clinchThrowStartTime = 0;
  player.clinchThrowCooldown = false;
  player.isClinchThrowing = false;
  player.isClinchClashing = false;
  player.clinchClashStartTime = 0;
  player.clinchLiftStartTime = 0;
  player.clinchLiftStartX = 0;
  player.isBeingLifted = false;
  player.clinchMouse2BufferTime = 0;
  player.isClinchLifting = false;
  player.isClinchPushing = false;
  player.isClinchPlanting = false;
  player.lastPlantStaminaDrainTime = 0;
  player.isResistingThrow = false;
  player.isResistingPull = false;
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
  opponent.lastResistStaminaDrainTime = 0;
  // Clinch system cleanup
  opponent.hasGrip = false;
  opponent.gripAcquiredTime = 0;
  opponent.inClinch = false;
  opponent.clinchAction = null;
  opponent.clinchOpponent = null;
  opponent.clinchStalemateStart = 0;
  opponent.clinchStalemateLastX = 0;
  opponent.clinchStalemateLastBalance = 0;
  // Clinch throw/pull/lift cleanup
  opponent.clinchThrowRequest = null;
  opponent.clinchThrowRequestTime = 0;
  opponent.clinchThrowActive = false;
  opponent.clinchThrowType = null;
  opponent.clinchThrowStartTime = 0;
  opponent.clinchThrowCooldown = false;
  opponent.isClinchThrowing = false;
  opponent.isClinchClashing = false;
  opponent.clinchClashStartTime = 0;
  opponent.clinchLiftStartTime = 0;
  opponent.clinchLiftStartX = 0;
  opponent.isBeingLifted = false;
  opponent.clinchMouse2BufferTime = 0;
  opponent.isClinchLifting = false;
  opponent.isClinchPushing = false;
  opponent.isClinchPlanting = false;
  opponent.lastPlantStaminaDrainTime = 0;
  opponent.isResistingThrow = false;
  opponent.isResistingPull = false;
  // Clear action lock so grab/other actions aren't blocked after grab ends
  opponent.actionLockUntil = 0;
}

function handleWinCondition(room, loser, winner, io, winType) {
  if (room.gameOver) return; // Prevent multiple win declarations

  room.gameOver = true;
  
  // Determine correct Y position for the loser based on whether they fell off the dohyo
  // Cinematic/clinch kill victims — don't touch their position
  if (!loser.isCinematicKillVictim && !loser.isClinchKillThrowVictim) {
    const fallenGroundLevel = GROUND_LEVEL - DOHYO_FALL_DEPTH;
    const loserShouldBeAtFallenLevel = 
      loser.isFallingOffDohyo || 
      isOutsideDohyo(loser.x, loser.y) || 
      loser.y < GROUND_LEVEL;
    loser.y = loserShouldBeAtFallenLevel ? fallenGroundLevel : GROUND_LEVEL;
  }
  winner.y = GROUND_LEVEL;
  
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
    setPlayerTimeout(winner.id, () => {
      winner.y = GROUND_LEVEL;
      winner.isBowing = true;
      
      const killVictimStaysDown = loser.isCinematicKillVictim || loser.isClinchKillThrowVictim || loser.isClinchKillPullVictim;
      if (killVictimStaysDown) {
        // Kill victims stay in their final pose — no bowing, no repositioning
      } else {
        const loserFellOffDohyo = 
          loser.isFallingOffDohyo || 
          isOutsideDohyo(loser.x, loser.y) || 
          loser.y < GROUND_LEVEL;
        const loserGroundLevel = loserFellOffDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
        loser.y = loserGroundLevel;
        loser.isBowing = true;
      }
    }, 1050);
  } else {
    setPlayerTimeout(winner.id, () => {
      winner.y = GROUND_LEVEL;
      winner.isBowing = true;
      
      const killVictimStaysDown = loser.isCinematicKillVictim || loser.isClinchKillThrowVictim || loser.isClinchKillPullVictim;
      if (killVictimStaysDown) {
        // Kill victims stay in their final pose — no bowing, no repositioning
      } else {
        const loserFellOffDohyo = 
          loser.isFallingOffDohyo || 
          isOutsideDohyo(loser.x, loser.y) || 
          loser.y < GROUND_LEVEL;
        const loserGroundLevel = loserFellOffDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
        loser.y = loserGroundLevel;
        loser.isBowing = true;
      }
    }, 1050);
  }

  // Store the current states that we want to preserve
  const loserKnockbackVelocity = { ...loser.knockbackVelocity };
  const loserMovementVelocity = loser.movementVelocity;

  // For the winner, if they're doing a slap attack, let it complete
  if (winner.isSlapAttack) {
    const remainingAttackTime = winner.attackEndTime - Date.now();
    if (remainingAttackTime > 0) {
      setPlayerTimeout(winner.id, () => {
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
    p.rawParryCooldownUntil = 0;
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
    p.grabState = GRAB_STATES.INITIAL;
    p.grabAttemptType = null;
    p.hasGrip = false;
    p.gripAcquiredTime = 0;
    p.inClinch = false;
    p.clinchAction = null;
    p.clinchStalemateStart = 0;
    p.clinchThrowRequest = null;
    p.clinchThrowRequestTime = 0;
    p.clinchThrowActive = false;
    p.clinchThrowType = null;
    p.clinchThrowStartTime = 0;
    p.clinchThrowCooldown = false;
    p.isClinchThrowing = false;
    p.isClinchClashing = false;
    p.clinchClashStartTime = 0;
    p.clinchLiftStartTime = 0;
    p.clinchLiftStartX = 0;
    p.isBeingLifted = false;
    p.isClinchLifting = false;
    p.isClinchPushing = false;
    p.isClinchPlanting = false;
    p.isResistingThrow = false;
    p.isResistingPull = false;

    p.pendingSlapCount = 0;
    p.pendingGrabEnder = false;
    p.slapStringPosition = 0;
    p.slapStringWindowUntil = 0;
    p.slapAnimationToggle = 0;
    p.currentSlapHitConnected = false;
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
  // Skip for cinematic/clinch kill throw victims — they're mid-arc or flying off
  if (!loser.isCinematicKillVictim && !loser.isClinchKillThrowVictim) {
    const loserFellOff = loser.isFallingOffDohyo || isOutsideDohyo(loser.x, loser.y) || loser.y < GROUND_LEVEL;
    loser.y = loserFellOff ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
  }
  
  // NOTE: Do NOT clear isHit here - the knockback physics need to continue running
  // so the player can slide past the map boundaries naturally

  io.in(room.id).emit("game_over", {
    isGameOver: true,
    winner: {
      id: winner.id,
      fighter: winner.fighter,
    },
    wins: winCount,
    winType: winType || "ringOut",
  });
  room.winnerId = winner.id;
  room.loserId = loser.id;
  if (!room.gameOverTime) {
    room.gameOverTime = Date.now();
  }

  setPlayerTimeout(loser.id, () => {
    if (room.players) {
      room.players.forEach((p) => {
        if (p.id === loser.id) {
          p.knockbackVelocity.x = 0;
          p.knockbackVelocity.y = 0;
          p.movementVelocity = 0;
        }
      });
    }
  }, 3000);
}

// Add this new function near the other helper functions
function executeSlapAttack(player, rooms) {
  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    if (opponent) {
      if (!player.slapFacingDirection) {
        player.slapFacingDirection = player.x < opponent.x ? -1 : 1;
      }
      player.facing = player.slapFacingDirection;

      const slideDirection = player.facing === 1 ? -1 : 1;
      let slapSlideVelocity = 1.0;

      if (player.activePowerUp === "power") {
        slapSlideVelocity *= player.powerUpMultiplier - 0.1;
      }

      player.movementVelocity = slideDirection * slapSlideVelocity;
      player.isSlapSliding = true;
    }
  }

  if (player.isSlapAttack && player.isAttacking) {
    return;
  }

  clearChargeState(player);

  // === STRING POSITION TRACKING ===
  // 3-hit string: hit 1 → hit 2 → hit 3 (each requires hit confirm).
  // Hits 1 & 2 are light pokes, hit 3 is the burst knockback finisher.
  const now = Date.now();
  const inStringWindow = player.slapStringWindowUntil && now <= player.slapStringWindowUntil;

  if (inStringWindow && player.slapStringPosition >= 1 && player.slapStringPosition <= 2) {
    player.slapStringPosition++;
  } else {
    player.slapStringPosition = 1;
  }

  player.slapStringWindowUntil = 0;

  // Animation is decoupled from string position — alternates every slap visually
  // slapAnimationToggle persists across strings so parries cycle naturally
  player.slapAnimationToggle = player.slapAnimationToggle === 1 ? 2 : 1;
  player.slapAnimation = player.slapAnimationToggle;

  player.currentSlapHitConnected = false;

  player.stamina = Math.max(0, player.stamina - SLAP_ATTACK_STAMINA_COST);

  // All string hits share identical frame data
  const baseStartupMs = SLAP_STARTUP_MS;
  const activeMs = SLAP_ACTIVE_MS;
  const totalCycleDuration = SLAP_STRING_HIT_TOTAL_MS;

  // DESPERATION COUNTER-SLAP: faster startup when recently hit.
  // Disabled for combo victims (hit by string hit 1) — the attacker earned the
  // frame trap through the string, so the victim shouldn't get a speed boost to escape it.
  const recentlyRecoveredFromHit = player.lastHitTime && 
    (now - player.lastHitTime < 380) && !player.isHit;
  const wasComboVictim = player.lastHitByStringPos >= 1;
  const startupDuration = (recentlyRecoveredFromHit && !wasComboVictim) ? Math.min(45, baseStartupMs) : baseStartupMs;

  const attackDuration = baseStartupMs + activeMs;

  player.isSlapAttack = true;
  player.attackEndTime = now + attackDuration;
  player.slapActiveEndTime = now + baseStartupMs + activeMs;
  player.isAttacking = true;
  player.attackStartTime = now;
  player.attackType = "slap";
  player.currentAction = "slap";
  player.attackAttemptTime = now;
  player.attackCooldownUntil = now + totalCycleDuration;

  player.isInStartupFrames = true;
  player.startupEndTime = now + startupDuration;

  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    startupDuration
  );

  const finishedPosition = player.slapStringPosition;

  player.slapCycleEndCallback = () => {
      player.isAttacking = false;
      player.isSlapAttack = false;
      player.attackType = null;
      player.isSlapSliding = false;
      player.slapFacingDirection = null;
      player.isInStartupFrames = false;
      player.slapActiveEndTime = 0;
      player.currentAction = null;

      const isPlayerValid = () => (
        !player.isDodging && !player.isThrowing && !player.isBeingThrown &&
        !player.isGrabbing && !player.isBeingGrabbed && !player.isRawParryStun &&
        !player.isRawParrying && !player.isHit && !player.canMoveToReady
      );

      // === HIT-CONFIRM STRING: only advance if the hit connected ===
      if (finishedPosition <= 2) {
        // Hits 1 & 2: can chain forward on confirm
        if (player.currentSlapHitConnected && isPlayerValid()) {
          // Check for grab ender (mouse2 buffered after hit 2)
          if (finishedPosition === 2 && player.pendingGrabEnder) {
            player.pendingSlapCount = 0;
            player.pendingGrabEnder = false;
            player.slapStringPosition = 0;
            player.slapStringWindowUntil = 0;
            // Transition into grab startup
            player.isGrabStartup = true;
            player.grabStartupStartTime = Date.now();
            player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
            player.currentAction = "grab_startup";
            player.actionLockUntil = Date.now() + GRAB_STARTUP_DURATION_MS;
            player.grabState = GRAB_STATES.ATTEMPTING;
            player.grabAttemptType = "grab";
            player.grabApproachSpeed = 0;
            return;
          }
          if (player.pendingSlapCount > 0) {
            // Next hit buffered → chain immediately
            player.pendingSlapCount--;
            player.pendingGrabEnder = false;
            player.slapStringWindowUntil = Date.now() + 100;
            executeSlapAttack(player, rooms);
            return;
          }
          // Hit connected but no buffer → open manual window
          player.slapStringWindowUntil = Date.now() + SLAP_STRING_BUFFER_WINDOW_MS;
          setPlayerTimeout(player.id, () => {
            if (player.slapStringPosition === finishedPosition && !player.isSlapAttack) {
              player.slapStringPosition = 0;
              player.slapStringWindowUntil = 0;
              player.pendingGrabEnder = false;
            }
          }, SLAP_STRING_BUFFER_WINDOW_MS, "slapStringReset");
        } else {
          // Whiffed → reset string, but if a slap was buffered start a fresh one
          player.slapStringPosition = 0;
          player.slapStringWindowUntil = 0;
          player.pendingGrabEnder = false;
          if (player.pendingSlapCount > 0 && isPlayerValid()) {
            player.pendingSlapCount--;
            executeSlapAttack(player, rooms);
            return;
          }
          player.pendingSlapCount = 0;
        }
      } else {
        // Hit 3 finished → string complete, reset
        // Discard buffered slaps + brief cooldown to eat stale mashed inputs.
        // Only blocks slaps (via canPlayerSlap cooldown); charge bypasses with ignoreCooldown.
        player.slapStringPosition = 0;
        player.slapStringWindowUntil = 0;
        player.pendingGrabEnder = false;
        player.pendingSlapCount = 0;
        player.attackCooldownUntil = Date.now() + SLAP_STRING_END_COOLDOWN_MS;
      }
  };

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
    if (opponent && !opponent.isDodging && !opponent.isSidestepping) {
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
  // If either player is dodging, sidestepping, or rope jumping, return false immediately
  if (player1.isDodging || player2.isDodging ||
      player1.isSidestepping || player2.isSidestepping ||
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
    player1.isSidestepping || player2.isSidestepping ||
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

  // Priority 0a: Buffered sidestep (S + SHIFT while grabbed/thrown)
  if (
    player.bufferedAction &&
    player.bufferedAction.type === "sidestep" &&
    player.bufferExpiryTime &&
    Date.now() < player.bufferExpiryTime &&
    !player.isGassed
  ) {
    player.bufferedAction = null;
    player.bufferExpiryTime = 0;
    const currentRoom = rooms.find(r => r.players.some(p => p.id === player.id));
    const sOpp = currentRoom && currentRoom.players.find(p => p.id !== player.id && !p.isDead);
    if (sOpp && canPlayerSidestep(player)) {
      const initData = getSidestepInitData(player.x, sOpp.x);
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      clearChargeState(player, true);
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
      player.isSidestepping = true;
      player.isSidestepStartup = true;
      player.isSidestepRecovery = false;
      player.sidestepStartTime = Date.now();
      player.sidestepStartupEndTime = Date.now() + SIDESTEP_STARTUP_MS;
      player.sidestepActiveEndTime = Date.now() + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MAX_MS;
      player.sidestepEndTime = Date.now() + SIDESTEP_TOTAL_MS;
      player.sidestepStartX = player.x;
      player.sidestepDirection = initData.direction;
      player.sidestepMaxTravel = initData.maxTravel;
      player.sidestepActiveDuration = SIDESTEP_ACTIVE_MAX_MS;
      player.currentAction = "sidestep";
      player.actionLockUntil = Date.now() + SIDESTEP_TOTAL_MS;
      player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
      return;
    }
  }

  // Priority 0b: Buffered dash (spammed shift while grabbed/thrown)
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
  if (player.keys[" "] && !player.grabBreakSpaceConsumed && Date.now() >= (player.rawParryCooldownUntil || 0)) {
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
    player.pendingSlapCount = 0;
    player.pendingGrabEnder = false;
    player.slapStringPosition = 0;
    player.slapStringWindowUntil = 0;
    clearChargeState(player, true);
    return;
  }

  // Priority 2a: Sidestep (S + SHIFT) - lateral evasion
  if (player.keys.shift && player.keys.s && !player.keys.mouse2 && !player.isGassed) {
    const currentRoom = rooms.find(r => r.players.some(p => p.id === player.id));
    const sOpp = currentRoom && currentRoom.players.find(p => p.id !== player.id && !p.isDead);
    if (sOpp && canPlayerSidestep(player)) {
      const initData = getSidestepInitData(player.x, sOpp.x);
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      clearChargeState(player, true);
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
      player.isSidestepping = true;
      player.isSidestepStartup = true;
      player.isSidestepRecovery = false;
      player.sidestepStartTime = Date.now();
      player.sidestepStartupEndTime = Date.now() + SIDESTEP_STARTUP_MS;
      player.sidestepActiveEndTime = Date.now() + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MAX_MS;
      player.sidestepEndTime = Date.now() + SIDESTEP_TOTAL_MS;
      player.sidestepStartX = player.x;
      player.sidestepDirection = initData.direction;
      player.sidestepMaxTravel = initData.maxTravel;
      player.sidestepActiveDuration = SIDESTEP_ACTIVE_MAX_MS;
      player.currentAction = "sidestep";
      player.actionLockUntil = Date.now() + SIDESTEP_TOTAL_MS;
      player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
      return;
    }
  }

  // Priority 2b: Dodge (shift) - evasive option (blocked only when gassed)
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

  // Priority 3: Mouse1 held — check for S+forward charged attack, else slap
  if (player.keys.mouse1) {
    player.mouse1PressTime = Date.now();
    const fwdKey = player.facing === -1 ? 'd' : 'a';
    if (player.keys.s && player.keys[fwdKey] && canPlayerSlap(player, { ignoreCooldown: true })) {
      player.chargeAttackPower = 0;
      player.chargeStartTime = 0;
      startCharging(player);
      player.chargingFacingDirection = player.facing;
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
    } else if (canPlayerSlap(player)) {
      executeSlapAttack(player, rooms);
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
          !player.isThrowing && !player.grabBreakSpaceConsumed &&
          Date.now() >= (player.rawParryCooldownUntil || 0)) {
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
        player.pendingSlapCount = 0;
        player.pendingGrabEnder = false;
        player.slapStringPosition = 0;
        player.slapStringWindowUntil = 0;
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
    case "sidestep": {
      if (canPlayerSidestep(player) && !player.isGassed) {
        const room = rooms.find(r => r.players.some(p => p.id === player.id));
        const sidestepOpponent = room && room.players.find(p => p.id !== player.id && !p.isDead);
        if (sidestepOpponent) {
          const initData = getSidestepInitData(player.x, sidestepOpponent.x);
          player.isRawParrySuccess = false;
          player.isPerfectRawParrySuccess = false;
          clearChargeState(player, true);
          player.movementVelocity = 0;
          player.isStrafing = false;
          player.isPowerSliding = false;
          player.isBraking = false;
          player.isCrouchStance = false;
          player.isCrouchStrafing = false;

          player.isSidestepping = true;
          player.isSidestepStartup = true;
          player.isSidestepRecovery = false;
          player.sidestepStartTime = Date.now();
          player.sidestepStartupEndTime = Date.now() + SIDESTEP_STARTUP_MS;
          player.sidestepActiveEndTime = Date.now() + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MAX_MS;
          player.sidestepEndTime = Date.now() + SIDESTEP_TOTAL_MS;
          player.sidestepStartX = player.x;
          player.sidestepDirection = initData.direction;
          player.sidestepMaxTravel = initData.maxTravel;
          player.sidestepActiveDuration = SIDESTEP_ACTIVE_MAX_MS;

          player.currentAction = "sidestep";
          player.actionLockUntil = Date.now() + SIDESTEP_TOTAL_MS;
          player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
          player.inputBuffer = null;
          return true;
        }
      }
      break;
    }
    case "chargedAttack": {
      if (canPlayerSlap(player, { ignoreCooldown: true })) {
        player.chargeAttackPower = 0;
        player.chargeStartTime = 0;
        startCharging(player);
        player.chargingFacingDirection = player.facing;
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isPowerSliding = false;
        player.isBraking = false;
        player.isRawParrySuccess = false;
        player.isPerfectRawParrySuccess = false;
        player.isCrouchStance = false;
        player.isCrouchStrafing = false;
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

const {
  GRAB_STATES, GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE, SLAP_HITBOX_DISTANCE_VALUE,
  SLAP_PARRY_WINDOW,
  DOHYO_FALL_DEPTH,
  POWER_UP_TYPES,
  PERFECT_PARRY_WINDOW, PERFECT_PARRY_KNOCKBACK,
  PERFECT_PARRY_ANIMATION_LOCK, PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_KNOCKBACK, RAW_PARRY_SLAP_KNOCKBACK,
  RAW_PARRY_STAMINA_REFUND,
  HITSTOP_SLAP_MS, HITSTOP_PARRY_MS,
  SLAP_HIT_VICTIM_STAMINA_DRAIN, CHARGED_HIT_VICTIM_STAMINA_DRAIN,
} = require("./constants");

const {
  setPlayerTimeout,
  clearAllActionStates,
  triggerHitstop,
  emitThrottledScreenShake,
  canApplyKnockback,
  setKnockbackImmunity,
  getChargedHitstop,
  timeoutManager,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
} = require("./gameUtils");

const { grabBeatsSlap } = require("./combatHelpers");

function checkCollision(player, otherPlayer, rooms, io) {
  // Reset isAlreadyHit only once per attack to allow exactly one hit per attack
  if (player.isAttacking && player.attackStartTime) {
    // Only reset if this is a different attack (different start time)
    if (
      !player.lastCheckedAttackTime ||
      player.lastCheckedAttackTime !== player.attackStartTime
    ) {
      // Reset the hit blocker for this new attack
      otherPlayer.isAlreadyHit = false;
      player.lastCheckedAttackTime = player.attackStartTime;
    }
  }

  // Check for startup frames on all attacks - disable collision during startup
  // Use isInStartupFrames flag for accurate timing (set by executeSlapAttack/executeChargedAttack)
  if (player.isAttacking && player.isInStartupFrames) {
    return; // Skip collision detection during startup frames - attack not active yet
  }
  
  // Fallback: Check startup timing if flag not set (for backward compatibility)
  if (player.isAttacking && player.attackStartTime && !player.startupEndTime) {
    const CHARGED_ATTACK_STARTUP_DELAY = 150; // Was 60ms - now clearer telegraph
    const SLAP_ATTACK_STARTUP_DELAY = 55;     // Matches executeSlapAttack startup

    const startupDelay =
      player.attackType === "slap"
        ? SLAP_ATTACK_STARTUP_DELAY
        : CHARGED_ATTACK_STARTUP_DELAY;
    const attackAge = Date.now() - player.attackStartTime;

    if (attackAge < startupDelay) {
      return; // Skip collision detection during startup frames
    }
  }

  // Existing collision check conditions
  if (
    !player.isAttacking ||
    otherPlayer.isAlreadyHit ||
    otherPlayer.isDead ||
    otherPlayer.isDodging ||
    player.isDodging ||
    player.isBeingThrown ||
    otherPlayer.isBeingThrown ||
    // Skip if either player has slap parry immunity (just had a slap parry)
    (player.slapParryImmunityUntil && Date.now() < player.slapParryImmunityUntil) ||
    (otherPlayer.slapParryImmunityUntil && Date.now() < otherPlayer.slapParryImmunityUntil)
  ) {
    return;
  }

  // Calculate hitbox distance based on attack type and size power-up
  const baseHitboxDistance =
    player.attackType === "slap"
      ? SLAP_HITBOX_DISTANCE_VALUE
      : HITBOX_DISTANCE_VALUE;

  const hitboxDistance = baseHitboxDistance * (player.sizeMultiplier || 1);

  // For slap attacks, only check horizontal distance and ensure opponent is in front
  if (player.attackType === "slap") {
    const deltaX = otherPlayer.x - player.x;
    const attackDir = player.facing === 1 ? -1 : 1;
    const opponentInFront = deltaX * attackDir >= 0;
    const horizontalDistance = Math.abs(deltaX);
    if (opponentInFront && horizontalDistance < hitboxDistance) {
      if (otherPlayer.isAttacking && otherPlayer.attackType === "slap") {
        // Check if both slaps occurred within the parry window
        const timeDifference = Math.abs(
          player.attackStartTime - otherPlayer.attackStartTime
        );
        if (timeDifference <= SLAP_PARRY_WINDOW) {
          // Find the current room
          const currentRoom = rooms.find((room) =>
            room.players.some((p) => p.id === player.id)
          );

          if (currentRoom) {
            resolveSlapParry(player, otherPlayer, currentRoom.id, io);
          }
          return;
        }
      }
      // First-to-active wins: if defender is in grab startup, timing determines winner
      if (otherPlayer.isGrabStartup && grabBeatsSlap(otherPlayer, player)) {
        return; // Grab wins — don't process slap hit, grab will connect
      }
      processHit(player, otherPlayer, rooms, io);
    }
    return;
  }

  // For charged attacks, use the circular hitbox but only hit opponents in front
  const playerHitbox = {
    left: player.x - hitboxDistance,
    right: player.x + hitboxDistance,
    top: player.y - hitboxDistance,
    bottom: player.y + hitboxDistance,
  };

  const opponentHitbox = {
    left: otherPlayer.x - hitboxDistance,
    right: otherPlayer.x + hitboxDistance,
    top: otherPlayer.y - hitboxDistance,
    bottom: otherPlayer.y + hitboxDistance,
  };

  const isCollision =
    playerHitbox.left < opponentHitbox.right &&
    playerHitbox.right > opponentHitbox.left &&
    playerHitbox.top < opponentHitbox.bottom &&
    playerHitbox.bottom > opponentHitbox.top;

  const chargedDeltaX = otherPlayer.x - player.x;
  const chargedAttackDir = player.facing === 1 ? -1 : 1;
  const chargedOpponentInFront = chargedDeltaX * chargedAttackDir >= 0;

  if (isCollision && chargedOpponentInFront) {
    if (player.isAttacking && otherPlayer.isAttacking) {
      // Check for thick blubber absorption in charge vs charge scenarios
      const playerHasThickBlubber =
        player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
        player.isAttacking &&
        player.attackType === "charged" &&
        !player.hitAbsorptionUsed;

      const otherPlayerHasThickBlubber =
        otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
        otherPlayer.isAttacking &&
        otherPlayer.attackType === "charged" &&
        !otherPlayer.hitAbsorptionUsed;

      if (playerHasThickBlubber && !otherPlayerHasThickBlubber) {
        // Player has thick blubber, they win
        processHit(player, otherPlayer, rooms, io);
      } else if (otherPlayerHasThickBlubber && !playerHasThickBlubber) {
        // Other player has thick blubber, they win
        processHit(otherPlayer, player, rooms, io);
      } else {
        // Either both have thick blubber or neither do - use random selection
        const winner = Math.random() < 0.5 ? player : otherPlayer;
        const loser = winner === player ? otherPlayer : player;
        processHit(winner, loser, rooms, io);
      }
    } else {
      processHit(player, otherPlayer, rooms, io);
    }
  }
}

function resolveSlapParry(player1, player2, roomId, io) {
  // Calculate knockback directions based on player positions
  const knockbackDirection1 = player1.x < player2.x ? -1 : 1;
  const knockbackDirection2 = -knockbackDirection1;

  // Apply parry effects to both players
  applyParryEffect(player1, knockbackDirection1);
  applyParryEffect(player2, knockbackDirection2);

  // Calculate the midpoint between the two players
  const midpointX = (player1.x + player2.x) / 2;
  const midpointY = (player1.y + player2.y) / 2;

  // Emit the parry event with just the necessary data (visual/audio effect)
  io.in(roomId).emit("slap_parry", { x: midpointX, y: midpointY });
}

function applyParryEffect(player, knockbackDirection) {
  // Don't change any player states - players continue their slap attacks as normal,
  // giving the illusion that they are slapping at the same time and stopping each other
  
  // Use smooth knockback velocity that gets processed in the game loop
  // More dramatic knockback so players visibly bounce off each other
  const SLAP_PARRY_KNOCKBACK_STRENGTH = 2.0; // Stronger bounce effect
  player.slapParryKnockbackVelocity = SLAP_PARRY_KNOCKBACK_STRENGTH * knockbackDirection;
  
  // Give brief immunity to prevent hits right after parry
  // This lasts until the current slap attack would end
  player.slapParryImmunityUntil = Date.now() + 300;
}

function processHit(player, otherPlayer, rooms, io) {
  const MIN_ATTACK_DISPLAY_TIME = 100;
  const currentTime = Date.now();
  const attackDuration = currentTime - player.attackStartTime;

  // Find the current room
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  // Use the stored attack type instead of checking isSlapAttack
  const isSlapAttack = player.attackType === "slap";

  // ============================================
  // COUNTER HIT DETECTION
  // Counter hit occurs when attacker's active frames hit opponent's startup frames
  // This rewards players for timing attacks to catch opponents during their attack startup
  // Note: This is separate from slap parry (active vs active) - that's handled in checkCollision
  // ============================================
  // Use a time-based window for more forgiving detection:
  // - The actual startup frames are short (40ms slap, 150ms charged)
  // - But we want to catch cases where the player was trying to attack
  // - This includes: startup frames + input timing buffer
  // - Also catches cases where player pressed mouse1 but got hit before attack started
  const COUNTER_HIT_WINDOW_MS = 150; // Window from attack attempt/intent where counter hit applies
  
  // Check if opponent recently started an attack (either in startup or just started)
  const timeSinceAttackAttempt = otherPlayer.attackAttemptTime 
    ? (currentTime - otherPlayer.attackAttemptTime) 
    : Infinity;
  
  // Also check if opponent just pressed mouse1 but attack hasn't started yet
  // This catches the case where you get hit right as you click to attack
  const timeSinceAttackIntent = otherPlayer.attackIntentTime
    ? (currentTime - otherPlayer.attackIntentTime)
    : Infinity;
  
  // Counter hit if:
  // 1. Opponent is attacking AND within the counter hit window, OR
  // 2. Opponent just pressed attack but hasn't started yet (hit them as they clicked), OR
  // 3. Opponent is attempting a grab (startup hop or lunge movement, but NOT whiffing/recovery)
  const counterHitFromAttacking = otherPlayer.isAttacking && timeSinceAttackAttempt <= COUNTER_HIT_WINDOW_MS;
  const counterHitFromIntent = timeSinceAttackIntent <= COUNTER_HIT_WINDOW_MS;
  const counterHitFromGrabAttempt = otherPlayer.isGrabStartup === true || otherPlayer.isGrabbingMovement === true;
  const isCounterHit = counterHitFromAttacking || counterHitFromIntent || counterHitFromGrabAttempt;

  // ============================================
  // PUNISH DETECTION
  // Punish occurs when hitting an opponent during their recovery frames
  // This rewards players for punishing whiffed attacks and grabs
  // ============================================
  const isPunish = otherPlayer.isRecovering || otherPlayer.isWhiffingGrab || otherPlayer.isGrabWhiffRecovery;

  // Store the charge power before resetting states
  const chargePercentage = player.chargeAttackPower;

  // Check for thick blubber hit absorption (only if defender is executing charged attack or grab and hasn't used absorption)
  const isDefenderGrabbing = otherPlayer.isGrabStartup || otherPlayer.isGrabbingMovement || otherPlayer.isGrabbing;
  if (
    otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
    ((otherPlayer.isAttacking && otherPlayer.attackType === "charged") || isDefenderGrabbing) &&
    !otherPlayer.hitAbsorptionUsed &&
    !otherPlayer.isRawParrying
  ) {
    // Raw parry should still work normally

    // Mark absorption as used for this charge session
    otherPlayer.hitAbsorptionUsed = true;

    // CRITICAL: End the attacker's attack to prevent multiple collisions on subsequent ticks
    // For charged attacks, put attacker in recovery state
    if (!isSlapAttack) {
      player.chargedAttackHit = true;
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
      player.chargingFacingDirection = null;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;
      
      // Track if mouse1 is held — enables charge resume after recovery without re-press
      if (player.keys.mouse1) {
        player.mouse1HeldDuringAttack = true;
        if (!player.mouse1PressTime) {
          player.mouse1PressTime = Date.now();
        }
      }
      
      // Set recovery state for the attacker
      player.isRecovering = true;
      player.recoveryStartTime = Date.now();
      player.recoveryDuration = 400;
      player.recoveryDirection = player.facing;
      player.knockbackVelocity = {
        x: player.facing * -2,
        y: 0,
      };
    }
    // For slap attacks, end the attack to prevent further collisions
    else {
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
    }

    // Emit a special effect or sound for absorption if needed
    if (currentRoom) {
      io.in(currentRoom.id).emit("thick_blubber_absorption", {
        playerId: otherPlayer.id,
        x: otherPlayer.x,
        y: otherPlayer.y,
      });
    }

    // Early return - no further hit processing for the defender
    return;
  }

  // For charged attacks, end the attack immediately on hit
  if (!isSlapAttack) {
    // Set hit tracking flag for charged attacks
    player.chargedAttackHit = true;

    // Reset all attack states first
    player.isAttacking = false;
    player.attackStartTime = 0;
    player.attackEndTime = 0;
    player.chargingFacingDirection = null;
    player.isChargingAttack = false;
    player.chargeStartTime = 0;
    player.chargeAttackPower = 0;

    // Track if mouse1 is held — enables charge resume after recovery without re-press
    if (player.keys.mouse1) {
      player.mouse1HeldDuringAttack = true;
      // Ensure press time is tracked (may already be set from re-press during animation)
      if (!player.mouse1PressTime) {
        player.mouse1PressTime = Date.now();
      }
    }

    // Set recovery state for successful hits
    player.isRecovering = true;
    player.recoveryStartTime = Date.now();
    player.recoveryDuration = 400;
    player.recoveryDirection = player.facing;
    // Initialize knockback velocity in the opposite direction of the attack
    player.knockbackVelocity = {
      x: player.facing * -2, // Static knockback amount
      y: 0,
    };
  }
  // For slap attacks: no special handling - executeSlapAttack timeout handles everything

  // Check if the other player is blocking (crouching)
  if (otherPlayer.isRawParrying) {
    // Determine if this is a slap attack being parried
    const isSlapBeingParried = player.attackType === "slap" || isSlapAttack;

    // Check if this is a perfect parry (within 100ms of parry start)
    const currentTime = Date.now();
    const parryDuration = currentTime - otherPlayer.rawParryStartTime;
    const isPerfectParry = parryDuration <= PERFECT_PARRY_WINDOW;

    // Apply appropriate knockback based on attack type
    const knockbackAmount = isSlapBeingParried
      ? RAW_PARRY_SLAP_KNOCKBACK
      : RAW_PARRY_KNOCKBACK;

    // Apply knockback to the attacking player
    // Calculate knockback direction based on relative positions to ensure attacker is always pushed away from defender
    const knockbackDirection = player.x < otherPlayer.x ? -1 : 1;
    
    // CRITICAL: Clear ALL action states before setting isHit
    clearAllActionStates(player);
    
    player.knockbackVelocity.x = knockbackAmount * knockbackDirection;
    player.knockbackVelocity.y = 0;
    player.isHit = true;
    player.isParryKnockback = true;
    player.lastHitTime = currentTime; // Track hit time for safety mechanism

    // Side-switch fix: set parried player's facing to face the parrier immediately so is_perfect_parried
    // (and parry stun) plays the correct direction from frame one. When the parrier dodged through and
    // is "inside" them, the main loop only updates the non-hit player's facing so the parried player
    // would otherwise correct later and the animation would flip. Use "face parrier" (not face knockback)
    // so it's correct both when sides switched and when they didn't.
    if (!player.isAtTheRopes && !player.atTheRopesFacingDirection) {
      player.facing = player.x < otherPlayer.x ? -1 : 1; // Face the parrier (right = -1, left = 1)
    }

    // Set parry success state for the defending player
    // Both regular and perfect parries refund the flat parry cost
    otherPlayer.stamina = Math.min(100, otherPlayer.stamina + RAW_PARRY_STAMINA_REFUND);

    if (isPerfectParry) {
      // Perfect parry: keep isRawParrying active and lock movement
      otherPlayer.isRawParrying = true;
      otherPlayer.isPerfectRawParrySuccess = true;
      otherPlayer.inputLockUntil = Math.max(otherPlayer.inputLockUntil || 0, Date.now() + PERFECT_PARRY_ANIMATION_LOCK);
    } else {
      // Regular parry: success animation
      otherPlayer.isRawParrySuccess = true;
    }

    // Emit raw parry success event for visual effect
    // Send both players' positions so client can calculate center (like grab break)
    // Determine which player number (1 or 2) performed the parry
    const parryingPlayerNumber = currentRoom ? 
      (currentRoom.players.findIndex(p => p.id === otherPlayer.id) + 1) : 1;
    const parryData = {
      attackerX: player.x,
      parrierX: otherPlayer.x,
      facing: player.facing,
      isPerfect: isPerfectParry,
      timestamp: Date.now(),
      parryId: `${otherPlayer.id}_parry_${Date.now()}`,
      playerNumber: parryingPlayerNumber, // 1 or 2
    };
    if (currentRoom) {
      io.to(currentRoom.id).emit("raw_parry_success", parryData);
    }

    // Clear parry success state after duration
    if (isPerfectParry) {
      // For perfect parry: clear the parry pose after animation lock duration
      setPlayerTimeout(
        otherPlayer.id,
        () => {
          otherPlayer.isRawParrying = false;
          otherPlayer.isPerfectRawParrySuccess = false;
        },
        PERFECT_PARRY_ANIMATION_LOCK,
        "perfectParryAnimationEnd"
      );
    } else {
      // For regular parry: clear success state after normal duration
      setPlayerTimeout(
        otherPlayer.id,
        () => {
          otherPlayer.isRawParrySuccess = false;
        },
        PARRY_SUCCESS_DURATION,
        "parrySuccess"
      );
    }

    // Longer knockback duration for clear visual - attacker stays in hit state
    // This syncs with the parrier's success pose for Street Fighter-like clarity
    const parryKnockbackDuration = 400; // Longer duration so the parry is clearly visible
    setPlayerTimeout(
      player.id,
      () => {
        player.isHit = false;
        player.isAlreadyHit = false; // Also clear to ensure player can be hit again
        player.isParryKnockback = false;

        // After knockback ends, check if we should restart charging
        if (
          player.keys.mouse1 &&
          player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200 &&
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
          player.isChargingAttack = true;
          if (player.chargeAttackPower > 0) {
            player.chargeStartTime = Date.now() - (player.chargeAttackPower / 100 * 750);
          } else {
            player.chargeStartTime = Date.now();
            player.chargeAttackPower = 1;
          }
          player.attackType = "charged";
        }
      },
      parryKnockbackDuration,
      "parryKnockbackReset" // Named timeout for easier debugging
    );
    
    // Lock attacker's inputs briefly during parry impact for visual clarity
    player.inputLockUntil = Math.max(player.inputLockUntil || 0, Date.now() + HITSTOP_PARRY_MS + 100);

    // Apply stun for perfect parries (separate from knockback)
    if (isPerfectParry) {
      // Perfect parries stun the attacker for 1.1s (fixed duration, no mash reduction)
      const baseStunDuration = PERFECT_PARRY_ATTACKER_STUN_DURATION;
      player.isRawParryStun = true;
      
      // Apply stronger knockback velocity for perfect parry (causes sliding on ice)
      const pushDirection = player.x < otherPlayer.x ? -1 : 1;

      // When overlapping (e.g. dodge cancel inside opponent), boost knockback velocity
      // to compensate for the overlap distance. This keeps the slide smooth (no teleport)
      // while ensuring the stunned player always ends up at the same final distance from
      // the parrier regardless of how deep the overlap was.
      // ~110px of displacement per 1.0 velocity unit over the 400ms knockback window
      // (derived from 64Hz tick, 0.185 speedFactor, 0.985 friction, 0.8x mvVel transfer)
      const ppDistance = Math.abs(player.x - otherPlayer.x);
      const ppMinSep = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, otherPlayer.sizeMultiplier || 1);
      const overlapAmount = Math.max(0, ppMinSep - ppDistance);
      const overlapCompensation = overlapAmount / 110;

      player.knockbackVelocity.x = (PERFECT_PARRY_KNOCKBACK + overlapCompensation) * pushDirection;
      player.knockbackVelocity.y = 0;
      
      // Track stun start time
      player.perfectParryStunStartTime = Date.now();
      
      // Clear any previous perfect parry stun timeout
      if (player.perfectParryStunBaseTimeout) {
        timeoutManager.clearPlayerSpecific(player.id, "perfectParryStunReset");
      }

      // Emit screen shake for perfect parry with higher intensity (throttled)
      if (currentRoom) {
        emitThrottledScreenShake(currentRoom, io, {
          intensity: 0.9,
          duration: 400,
        });

        // Emit perfect parry event
        io.in(currentRoom.id).emit("perfect_parry", {
          parryingPlayerId: otherPlayer.id,
          attackingPlayerId: player.id,
          stunnedPlayerX: player.x,
          stunnedPlayerY: player.y,
          stunnedPlayerFighter: player.fighter, // Add fighter info to help with positioning
          showStarStunEffect: true, // Explicit flag for the star stun effect
        });
      }

      // Reset stun after appropriate duration (separate from knockback)
      // Fixed duration stun (no mash reduction)
      setPlayerTimeout(
        player.id,
        () => {
          player.isRawParryStun = false;
          player.perfectParryStunStartTime = 0;
          player.perfectParryStunBaseTimeout = null;

          // After stun ends, check if we should restart charging
          if (
            player.keys.mouse1 &&
            player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200 &&
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
            player.isChargingAttack = true;
            if (player.chargeAttackPower > 0) {
              player.chargeStartTime = Date.now() - (player.chargeAttackPower / 100 * 750);
            } else {
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
            }
            player.attackType = "charged";
          }
        },
        baseStunDuration,
        "perfectParryStunReset" // Named timeout for easier debugging
      );
      
      // Store that we have an active stun timeout
      player.perfectParryStunBaseTimeout = true;
    } else {
      // Regular parry - emit screen shake with lower intensity (throttled)
      if (currentRoom) {
        emitThrottledScreenShake(currentRoom, io, {
          intensity: 0.5,
          duration: 200,
        });
        // Hitstop on parry
        triggerHitstop(currentRoom, HITSTOP_PARRY_MS);
      }
      // If movement ended or was interrupted without grabbing, clear telegraph
      if (
        !player.isGrabbingMovement &&
        !player.isGrabbing &&
        !player.isGrabClashing
      ) {
        player.grabState = GRAB_STATES.INITIAL;
        player.grabAttemptType = null;
      }
    }
  } else {
    // === ROCK-SOLID HIT PROCESSING ===
    // Clear any existing hit state cleanup to prevent conflicts
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "hitStateReset");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "grabMovementTimeout");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "grabClashResolution");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "atTheRopesTimeout");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "slapEndlagReset");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "chargedEndlagReset");

    // If there was room clash data involving this player, clean it up
    if (currentRoom && currentRoom.grabClashData) {
      if (
        currentRoom.grabClashData.player1Id === otherPlayer.id ||
        currentRoom.grabClashData.player2Id === otherPlayer.id
      ) {
        delete currentRoom.grabClashData;
        // Emit clash cancellation to room
        io.in(currentRoom.id).emit("grab_clash_cancelled", {
          reason: "player_hit",
          hitPlayerId: otherPlayer.id,
        });
      }
    }

    // If otherPlayer was grabbing someone, clear the grabbed player's state first
    if (otherPlayer.isGrabbing && otherPlayer.grabbedOpponent) {
      const grabbedPlayer = currentRoom.players.find(p => p.id === otherPlayer.grabbedOpponent);
      if (grabbedPlayer) {
        grabbedPlayer.isBeingGrabbed = false;
      }
    }
    
    // CRITICAL: If otherPlayer was throwing someone, clear the thrown player's state
    // This prevents isBeingThrown from getting stuck when thrower is interrupted
    if (otherPlayer.isThrowing && otherPlayer.throwOpponent) {
      const thrownPlayer = currentRoom.players.find(p => p.id === otherPlayer.throwOpponent);
      if (thrownPlayer) {
        thrownPlayer.isBeingThrown = false;
        thrownPlayer.beingThrownFacingDirection = null;
        // Set Y based on whether they're outside the dohyo
        const outsideDohyo = thrownPlayer.x <= DOHYO_LEFT_BOUNDARY || thrownPlayer.x >= DOHYO_RIGHT_BOUNDARY;
        thrownPlayer.y = outsideDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
        if (outsideDohyo) thrownPlayer.isFallingOffDohyo = true;
        thrownPlayer.knockbackVelocity = { x: 0, y: 0 };
      }
    }
    
    // CRITICAL: Clear ALL action states - ensures only ONE state at a time
    // TAP-style: clearAllActionStates now preserves charge power when mouse1 is held
    clearAllActionStates(otherPlayer);
    
    // Clear parry success states when hit
    otherPlayer.isRawParrySuccess = false;
    otherPlayer.isPerfectRawParrySuccess = false;
    
    // Clear grab clash state
    otherPlayer.isGrabClashing = false;
    otherPlayer.grabClashStartTime = 0;
    otherPlayer.grabClashInputCount = 0;

    // Always ensure a clean state transition for reliable client-side detection
    // This guarantees that each hit triggers proper sound/visual effects
    otherPlayer.isHit = false;

    // Use immediate callback to ensure proper state transition timing
    process.nextTick(() => {
      otherPlayer.isHit = true;
    });

    // Block multiple hits from this same attack
    otherPlayer.isAlreadyHit = true;

    // Increment hit counter for reliable hit sound triggering
    otherPlayer.hitCounter = (otherPlayer.hitCounter || 0) + 1;

    // Drain victim's stamina on hit (victim loses more than attacker spent)
    if (isSlapAttack) {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);
    } else {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - CHARGED_HIT_VICTIM_STAMINA_DRAIN);
    }

    // Update opponent's facing direction based on attacker's position
    // UNLESS they're at the ropes OR have locked atTheRopes facing direction
    // The atTheRopesFacingDirection should persist through hits until:
    // - They're brought back into the ring (cleared below)
    // - Or until round reset
    if (!otherPlayer.isAtTheRopes && !otherPlayer.atTheRopesFacingDirection) {
      otherPlayer.facing = player.x < otherPlayer.x ? 1 : -1;
    }

    // Calculate knockback direction
    // For both slap and charged attacks, use the attacker's facing direction to ensure consistent knockback
    // The opponent should always be knocked back in the direction the attacker is facing
    // This prevents visual confusion when a player dodges through the opponent and releases a charged attack,
    // where they might pass back through the opponent during the attack movement
    const knockbackDirection = player.facing === 1 ? -1 : 1;
    if (isSlapAttack) {
    } else {
    }

    // Calculate knockback multiplier based on charge percentage
    let finalKnockbackMultiplier;
    if (isSlapAttack) {
      finalKnockbackMultiplier = 0.38; // Tuned knockback - consecutive slaps stay in range
    } else {
      finalKnockbackMultiplier = 0.4675 + (chargePercentage / 100) * 1.122; // Reduced base power by 15% (0.55 -> 0.4675) and scaling by 15% (1.32 -> 1.122)
    }

    // Counter hit bonus: 25% extra knockback for catching opponent in startup
    if (isCounterHit) {
      finalKnockbackMultiplier *= 1.25;
    }

    // Punish bonus: 30% extra knockback for hitting opponent during recovery
    if (isPunish) {
      finalKnockbackMultiplier *= 1.30;
    }

    // Apply crouch stance damage reduction
    if (otherPlayer.isCrouchStance) {
      if (isSlapAttack) {
        // Reduce slap attack power by 10% when hitting crouched target
        finalKnockbackMultiplier *= 0.9; // 90% of original power (10% reduction)
      } else {
        // Reduce charged attack power by 10% when hitting crouched target
        finalKnockbackMultiplier *= 0.9; // 90% of original power (10% reduction)
      }
    }

    // Apply power-up effects
    if (player.activePowerUp === POWER_UP_TYPES.POWER) {
      if (isSlapAttack) {
        // Adjusted power power-up effect for slap attacks to achieve 20% increase
        finalKnockbackMultiplier *= player.powerUpMultiplier * 0.923;
      } else {
        // Full power-up effect for charged attacks
        finalKnockbackMultiplier *= player.powerUpMultiplier;
      }
    }

    if (canApplyKnockback(otherPlayer)) {
      if (isSlapAttack) {
        // For slap attacks, use consistent knockback regardless of distance
        // This ensures all slap hits feel the same whether players are touching or at distance
        // NOTE: Punchier feel comes from the increased hitstop (80ms), not from knockback values.
        // These values are tuned so slap chains always stay in range when spamming.
        const immediateKnockback =
          1.85 * knockbackDirection * finalKnockbackMultiplier;
        const slidingVelocity =
          2.0 * knockbackDirection * finalKnockbackMultiplier;

        // Apply consistent knockback without any distance-based separation boost
        otherPlayer.knockbackVelocity.x = immediateKnockback;
        otherPlayer.movementVelocity = slidingVelocity;

        // Mark this as a slap knockback for special friction handling
        otherPlayer.isSlapKnockback = true;

        // Track that the attacker just landed a slap hit - used by executeSlapAttack
        // to apply the strong chain lunge velocity on follow-up slaps
        player.lastSlapHitLandedTime = currentTime;

        // === LUNGE-HIT-SEPARATE: Kill attacker momentum on hit ===
        // Stop the attacker's forward slide dead when the slap connects.
        // This creates visible separation: victim slides back, attacker stays put.
        // The NEXT slap's lunge (1.8 velocity) closes the gap for the next hit.
        // Visual rhythm: lunge → HIT → separate → lunge → HIT → separate
        player.movementVelocity = 0;
        player.isSlapSliding = false;

        // === ATTACKER RECOIL ON SLAP HIT ===
        // Moderate backward bounce to widen the gap between hits.
        // Combined with the momentum kill above, this makes the separation clearly visible.
        // The next slap's lunge (1.8) is strong enough to close this gap.
        const attackerRecoilDirection = -knockbackDirection;
        player.slapParryKnockbackVelocity = 0.35 * attackerRecoilDirection;

        // Screen shake is handled in the hitstop section below
      } else {
        // For charged attacks, force clear any existing hit state and velocities for consistent knockback
        otherPlayer.isHit = false;
        otherPlayer.isSlapKnockback = false;
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.movementVelocity = 0;

        // For charged attacks, use a combination of immediate knockback and sliding
        const immediateKnockback =
          1.7 * knockbackDirection * finalKnockbackMultiplier;
        otherPlayer.movementVelocity =
          1.2 * knockbackDirection * finalKnockbackMultiplier;
        otherPlayer.knockbackVelocity.x = immediateKnockback;

        // Calculate attacker bounce-off based on charge percentage
        const attackerBounceDirection = -knockbackDirection;
        const attackerBounceMultiplier = 0.3 + (chargePercentage / 100) * 0.5;

        // Set movement velocity for the attacker to create bounce-off effect
        player.movementVelocity =
          2 * attackerBounceDirection * attackerBounceMultiplier;
        player.knockbackVelocity = { x: 0, y: 0 };

      }

      // Set knockback immunity
      setKnockbackImmunity(otherPlayer);

      // Emit hit effect at the hit player's position
      if (currentRoom) {
        io.in(currentRoom.id).emit("player_hit", {
          x: otherPlayer.x,
          y: otherPlayer.y,
          facing: otherPlayer.facing,
          attackType: isSlapAttack ? "slap" : "charged",
          timestamp: Date.now(), // Add unique timestamp to ensure effect triggers every time
          hitId: Math.random().toString(36).substr(2, 9), // Add unique ID for guaranteed uniqueness
          isCounterHit: isCounterHit, // Counter hit for yellow/gold effect
          isPunish: isPunish, // Punish for purple effect (hit during recovery)
        });

        // Emit counter hit banner event (separate from hit effect for side banner display)
        if (isCounterHit) {
          // Determine which player number hit the counter (for side banner positioning)
          const attackerPlayerNumber = currentRoom.players.findIndex(p => p.id === player.id) + 1;
          io.in(currentRoom.id).emit("counter_hit", {
            x: otherPlayer.x,
            y: otherPlayer.y,
            playerNumber: attackerPlayerNumber,
            counterId: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
          });
        }

        // Punish: only side text (no hit effect) when hitting opponent during recovery
        if (isPunish) {
          const attackerPlayerNumber = currentRoom.players.findIndex(p => p.id === player.id) + 1;
          io.in(currentRoom.id).emit("punish_banner", {
            grabberPlayerNumber: attackerPlayerNumber,
            counterId: `punish-hit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          });
        }
        
        // ============================================
        // SMASH-STYLE HITSTOP & SCREEN SHAKE
        // Every hit has impact - both hitstop AND screen shake
        // Slaps: snappy, punchy feel
        // Charged: heavy, powerful feel scaling with charge
        // ============================================
        if (isSlapAttack) {
          // Rekka-style hitstop - substantial freeze for each slap impact
          triggerHitstop(currentRoom, HITSTOP_SLAP_MS);

          // === HITSTOP CYCLE COMPENSATION ===
          // The hitstop freezes physics but the attack cycle setTimeout keeps ticking.
          // Without compensation, the freeze "steals" movement time from the cycle,
          // causing inconsistent distances and hit timing between chain slaps.
          // Fix: extend the attack cycle timer by the hitstop duration so the actual
          // movement/physics time is always the same regardless of when the hit connects.
          if (player.slapCycleEndCallback) {
            timeoutManager.clearPlayerSpecific(player.id, "slapCycle");
            const remaining = Math.max(0, player.attackEndTime - currentTime);
            const extendedDuration = remaining + HITSTOP_SLAP_MS;
            player.attackEndTime = currentTime + extendedDuration;
            player.attackCooldownUntil = currentTime + extendedDuration;
            setPlayerTimeout(player.id, player.slapCycleEndCallback, extendedDuration, "slapCycle");
          }

          // Meaty screen shake for slaps (throttled)
          emitThrottledScreenShake(currentRoom, io, {
            intensity: 0.8,
            duration: 180,
          });
        } else {
          // Charged attacks scale hitstop with charge power
          const hitstopDuration = getChargedHitstop(chargePercentage / 100);
          triggerHitstop(currentRoom, hitstopDuration);
          // Heavy screen shake for charged attacks - scales with power (throttled)
          emitThrottledScreenShake(currentRoom, io, {
            intensity: 0.9 + (chargePercentage / 100) * 0.4,
            duration: 220 + (chargePercentage / 100) * 180,
          });
        }
      }
    }

    otherPlayer.knockbackVelocity.y = 0;
    otherPlayer.y = GROUND_LEVEL;

    // === HIT STUN DURATION ===
    // Slaps: visible hit reaction - enough time to see the animation
    // Charged: longer stun for more impactful hits
    // Counter hits: 40% longer stun for catching opponent in startup frames
    // Punish: 50% longer stun for hitting opponent during recovery
    // Slap stun bumped to 260ms to account for 130ms hitstop eating into the timer.
    // This ensures ~130ms of VISIBLE stun after the freeze ends.
    let hitStateDuration = isSlapAttack ? 260 : 380;
    if (isCounterHit) {
      hitStateDuration = Math.round(hitStateDuration * 1.4);
    }
    if (isPunish) {
      hitStateDuration = Math.round(hitStateDuration * 1.5);
    }

    // Update the last hit time for tracking
    otherPlayer.lastHitTime = currentTime;

    // Single, deterministic cleanup
    setPlayerTimeout(
      otherPlayer.id,
      () => {
        otherPlayer.isHit = false;
        otherPlayer.isAlreadyHit = false; // Also clear to ensure player can be hit again
      },
      hitStateDuration,
      "hitStateReset" // Named timeout for cleanup
    );

    // Input lockout - slaps have moderate lock so hit animation is visible
    const victimLockMs = isSlapAttack ? 180 : hitStateDuration;
    // Attacker: brief lock for slaps creates commitment to each strike (rekka feel)
    const attackerLockMs = isSlapAttack ? 50 : 200;
    const now = Date.now();
    otherPlayer.inputLockUntil = Math.max(
      otherPlayer.inputLockUntil || 0,
      now + victimLockMs
    );
    if (attackerLockMs > 0) {
      player.inputLockUntil = Math.max(
        player.inputLockUntil || 0,
        now + attackerLockMs
      );
    }

    // Encourage clearer turn-taking: set wantsToRestartCharge only on intentional hold
    if (player.keys && player.keys.mouse1) {
      player.wantsToRestartCharge = true;
    }
  }
}

module.exports = { checkCollision, processHit, resolveSlapParry, applyParryEffect };

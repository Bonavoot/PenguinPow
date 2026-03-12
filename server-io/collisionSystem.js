const {
  GRAB_STATES, GROUND_LEVEL, TICK_RATE, speedFactor,
  HITBOX_DISTANCE_VALUE, CHARGED_HITBOX_DISTANCE_VALUE, SLAP_HITBOX_DISTANCE_VALUE,
  SLAP_PARRY_WINDOW, SLAP_PARRY_RECOVERY_MS, SLAP_PARRY_HITSTOP_MS,
  SLAP_PARRY_KNOCKBACK_STRENGTH, SLAP_PARRY_CONSECUTIVE_DECAY_MS,
  DOHYO_FALL_DEPTH,
  POWER_UP_TYPES,
  PERFECT_PARRY_WINDOW, PERFECT_PARRY_KNOCKBACK,
  PERFECT_PARRY_ANIMATION_LOCK, PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_KNOCKBACK, RAW_PARRY_SLAP_KNOCKBACK,
  RAW_PARRY_STAMINA_REFUND, RAW_PARRY_COOLDOWN_MS,
  SLAP_CHAIN_HIT_GAP_MS,
  HITSTOP_SLAP_MS, HITSTOP_SLAP_HIT3_MS, HITSTOP_PARRY_MS, HITSTOP_SLAP_PARRY_MS, HITSTOP_PERFECT_PARRY_MS, HITSTOP_CHARGED_MIN_MS, HITSTOP_CHARGED_MAX_MS,
  SLAP_HIT_VICTIM_STAMINA_DRAIN, CHARGED_HIT_VICTIM_STAMINA_DRAIN,
  CHARGE_CLASH_RECOVERY_DURATION, CHARGE_CLASH_BASE_KNOCKBACK,
  CHARGE_CLASH_MIN_KNOCKBACK, CHARGE_CLASH_ADVANTAGE_SCALE,
  CHARGE_PRIORITY_THRESHOLD, CHARGE_VS_SLAP_ATTACKER_PENALTY,
  SLAP_STRING_LIGHT_KB_VELOCITY,
  SLAP_NEUTRAL_KB_MULTIPLIER,
  SLAP_HIT3_KB_VELOCITY,
  SLAP_STRING_HIT_STUN_MS,
  SLAP_HIT3_STUN_MS,
  SLAP_ONHIT_ATTACKER_PUSH,
  CINEMATIC_KILL_MIN_MULTIPLIER,
  CHARGE_FULL_POWER_MS,
  CINEMATIC_KILL_HITSTOP_MS,
  CINEMATIC_KILL_KNOCKBACK_BOOST,
  CINEMATIC_KB_FRICTION,
  CINEMATIC_KB_DI_FRICTION,
  CINEMATIC_KB_MOVEMENT_TRANSFER,
  CINEMATIC_KB_MOVEMENT_FRICTION,
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
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
} = require("./gameUtils");

const { grabBeatsSlap } = require("./combatHelpers");

const SIM_DELTA = 1000 / TICK_RATE;

function willGuaranteeRingOut(victimX, knockbackDir, finalMultiplier) {
  let kbVel = 1.7 * knockbackDir * finalMultiplier;
  let mvVel = 1.2 * knockbackDir * finalMultiplier;
  let x = victimX;

  for (let i = 0; i < 300; i++) {
    kbVel *= CINEMATIC_KB_FRICTION;
    kbVel *= CINEMATIC_KB_DI_FRICTION;
    mvVel = kbVel * CINEMATIC_KB_MOVEMENT_TRANSFER;
    mvVel *= CINEMATIC_KB_MOVEMENT_FRICTION;

    x += SIM_DELTA * speedFactor * (kbVel + mvVel);

    if (x <= MAP_LEFT_BOUNDARY || x >= MAP_RIGHT_BOUNDARY) return true;
    if (Math.abs(kbVel) < 0.01 && Math.abs(mvVel) < 0.01) break;
  }
  return false;
}

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

  // Rope jump: full immunity during airborne (active) phase.
  // No ground attack can reach an airborne target — punish the startup or landing instead.
  if (otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "active") {
    return;
  }

  // Check for startup frames on all attacks - disable collision during startup
  // Use isInStartupFrames flag for accurate timing (set by executeSlapAttack/executeChargedAttack)
  if (player.isAttacking && player.isInStartupFrames) {
    return; // Skip collision detection during startup frames - attack not active yet
  }
  
  // Fallback: Check startup timing if flag not set (for backward compatibility)
  if (player.isAttacking && player.attackStartTime && !player.startupEndTime) {
    const CHARGED_ATTACK_STARTUP_DELAY = 150; // Matches CHARGED_STARTUP_MS
    const SLAP_ATTACK_STARTUP_DELAY = 55;     // Matches SLAP_STARTUP_MS

    const startupDelay =
      player.attackType === "slap"
        ? SLAP_ATTACK_STARTUP_DELAY
        : CHARGED_ATTACK_STARTUP_DELAY;
    const attackAge = Date.now() - player.attackStartTime;

    if (attackAge < startupDelay) {
      return; // Skip collision detection during startup frames
    }
  }

  // Skip collision if the attack's active frames have ended (in recovery phase of attack)
  if (player.attackType === "slap" && player.slapActiveEndTime && Date.now() > player.slapActiveEndTime) {
    return;
  }
  if (player.attackType === "charged" && player.chargedActiveEndTime && Date.now() > player.chargedActiveEndTime) {
    return;
  }

  // Dodge only grants i-frames vs charged attacks during ACTIVE phase (not startup/recovery)
  const now = Date.now();
  const otherInDodgeIFrames = otherPlayer.isDodging && !otherPlayer.isDodgeStartup && player.attackType === "charged";
  const playerInDodgeIFrames = player.isDodging && !player.isDodgeStartup && otherPlayer.attackType === "charged";

  // Sidestep grants i-frames vs ALL strikes during ACTIVE phase (not startup/recovery)
  const otherInSidestepIFrames = otherPlayer.isSidestepping && !otherPlayer.isSidestepStartup && !otherPlayer.isSidestepRecovery;
  const playerInSidestepIFrames = player.isSidestepping && !player.isSidestepStartup && !player.isSidestepRecovery;

  const eitherHasSlapParryImmunity =
    (player.slapParryImmunityUntil && now < player.slapParryImmunityUntil) ||
    (otherPlayer.slapParryImmunityUntil && now < otherPlayer.slapParryImmunityUntil);

  if (
    !player.isAttacking ||
    otherPlayer.isAlreadyHit ||
    otherPlayer.isDead ||
    otherInDodgeIFrames ||
    playerInDodgeIFrames ||
    otherInSidestepIFrames ||
    playerInSidestepIFrames ||
    player.isBeingThrown ||
    otherPlayer.isBeingThrown
  ) {
    return;
  }

  if (eitherHasSlapParryImmunity) {
    const bothInNonFinisherSlaps =
      player.attackType === "slap" &&
      otherPlayer.isAttacking && otherPlayer.attackType === "slap";
    if (!bothInNonFinisherSlaps) {
      return;
    }
  }

  // Calculate hitbox distance based on attack type
  // Slap: fixed reach (not scaled by body size — it's arm reach, not body width)
  // Charged: scaled by size multiplier (body-based hitbox)
  const hitboxDistance =
    player.attackType === "slap"
      ? SLAP_HITBOX_DISTANCE_VALUE
      : CHARGED_HITBOX_DISTANCE_VALUE * (player.sizeMultiplier || 1);

  // For slap attacks, only check horizontal distance and ensure opponent is in front
  if (player.attackType === "slap") {
    const deltaX = otherPlayer.x - player.x;
    const attackDir = player.facing === 1 ? -1 : 1;
    const opponentInFront = deltaX * attackDir >= 0;
    const horizontalDistance = Math.abs(deltaX);
    if (opponentInFront && horizontalDistance < hitboxDistance) {
      if (otherPlayer.isAttacking && otherPlayer.attackType === "slap") {
        // Slap parry: both slaps active within the parry window
        if (player.isSlapParryRecovering || otherPlayer.isSlapParryRecovering) return;
        const timeDifference = Math.abs(
          player.attackStartTime - otherPlayer.attackStartTime
        );
        if (timeDifference <= SLAP_PARRY_WINDOW) {
          const currentRoom = rooms.find((room) =>
            room.players.some((p) => p.id === player.id)
          );
          if (currentRoom) {
            resolveSlapParry(player, otherPlayer, currentRoom, io);
          }
          return;
        }
      }

      // Slap vs Charged: if opponent is executing a charged attack above the
      // priority threshold AND their charged hitbox reaches us, defer to the
      // charged branch (charged attack wins through with a graze penalty).
      if (
        otherPlayer.isAttacking &&
        otherPlayer.attackType === "charged" &&
        !otherPlayer.isInStartupFrames &&
        (otherPlayer.chargeAttackPower || 0) >= CHARGE_PRIORITY_THRESHOLD
      ) {
        const chargedHitboxDist = CHARGED_HITBOX_DISTANCE_VALUE * (otherPlayer.sizeMultiplier || 1);
        const dxFromCharged = player.x - otherPlayer.x;
        const chargedAtkDir = otherPlayer.facing === 1 ? -1 : 1;
        const inFrontOfCharged = dxFromCharged * chargedAtkDir >= 0;
        if (inFrontOfCharged && Math.abs(dxFromCharged) < chargedHitboxDist) {
          return; // Charged attack has priority — that branch will process the hit
        }
      }

      // First-to-active wins: if defender is in grab startup, timing determines winner
      if (otherPlayer.isGrabStartup && grabBeatsSlap(otherPlayer, player)) {
        return; // Grab wins — don't process slap hit, grab will connect
      }
      if (eitherHasSlapParryImmunity) return;
      processHit(player, otherPlayer, rooms, io);
    }
    return;
  }

  // For charged attacks, use the same directional distance check as slap
  const chargedDeltaX = otherPlayer.x - player.x;
  const chargedAttackDir = player.facing === 1 ? -1 : 1;
  const chargedOpponentInFront = chargedDeltaX * chargedAttackDir >= 0;
  const chargedHorizontalDistance = Math.abs(chargedDeltaX);

  if (chargedOpponentInFront && chargedHorizontalDistance < hitboxDistance) {
    if (player.isAttacking && otherPlayer.isAttacking) {
      if (otherPlayer.attackType === "charged") {
        // === CHARGED vs CHARGED ===
        // Check thick blubber first — one-sided blubber wins outright
        const playerHasThickBlubber =
          player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
          !player.hitAbsorptionUsed;
        const otherPlayerHasThickBlubber =
          otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
          !otherPlayer.hitAbsorptionUsed;

        if (playerHasThickBlubber && !otherPlayerHasThickBlubber) {
          processHit(player, otherPlayer, rooms, io);
        } else if (otherPlayerHasThickBlubber && !playerHasThickBlubber) {
          processHit(otherPlayer, player, rooms, io);
        } else {
          // Both or neither have thick blubber → charge clash
          const currentRoom = rooms.find((room) =>
            room.players.some((p) => p.id === player.id)
          );
          if (currentRoom) {
            resolveChargeClash(
              player, otherPlayer,
              player.chargeAttackPower || 0,
              otherPlayer.chargeAttackPower || 0,
              currentRoom, io
            );
          }
        }
      } else if (otherPlayer.attackType === "slap") {
        // === CHARGED vs SLAP ===
        const chargeLevel = player.chargeAttackPower || 0;
        if (chargeLevel >= CHARGE_PRIORITY_THRESHOLD) {
          // Charged attack has priority — hit the slap player
          processHit(player, otherPlayer, rooms, io);
          // Slap graze penalty: amplify the charged attacker's recovery knockback
          player.knockbackVelocity.x *= CHARGE_VS_SLAP_ATTACKER_PENALTY;
        }
        // Below threshold: skip — the slap branch handles it (slap wins)
      } else {
        processHit(player, otherPlayer, rooms, io);
      }
    } else {
      processHit(player, otherPlayer, rooms, io);
    }
  }
}

function resolveSlapParry(player1, player2, room, io) {
  const now = Date.now();
  const knockbackDirection1 = player1.x < player2.x ? -1 : 1;
  const knockbackDirection2 = -knockbackDirection1;

  // Track consecutive parries for escalation
  const lastParryTime = Math.max(player1.lastSlapParryTime || 0, player2.lastSlapParryTime || 0);
  const isConsecutive = (now - lastParryTime) < SLAP_PARRY_CONSECUTIVE_DECAY_MS;
  const consecutiveCount = isConsecutive
    ? Math.min((player1.slapParryConsecutiveCount || 0) + 1, 4)
    : 1;

  [player1, player2].forEach((p) => {
    p.lastSlapParryTime = now;
    p.slapParryConsecutiveCount = consecutiveCount;
  });

  const escalation = 1 + (consecutiveCount - 1) * 0.15;

  // When one player is pinned at the boundary, their knockback has nowhere to go.
  // Compensate by boosting the non-cornered player's knockback so they visually
  // separate instead of overlapping at the wall.
  const BOUNDARY_PROXIMITY = 30;
  const p1NearWall = player1.x <= MAP_LEFT_BOUNDARY + BOUNDARY_PROXIMITY ||
                     player1.x >= MAP_RIGHT_BOUNDARY - BOUNDARY_PROXIMITY;
  const p2NearWall = player2.x <= MAP_LEFT_BOUNDARY + BOUNDARY_PROXIMITY ||
                     player2.x >= MAP_RIGHT_BOUNDARY - BOUNDARY_PROXIMITY;

  let p1KbScale = escalation;
  let p2KbScale = escalation;
  if (p1NearWall && !p2NearWall) {
    p2KbScale *= 1.6;
  } else if (p2NearWall && !p1NearWall) {
    p1KbScale *= 1.6;
  }

  applyParryEffect(player1, knockbackDirection1, p1KbScale);
  applyParryEffect(player2, knockbackDirection2, p2KbScale);

  [player1, player2].forEach((p) => {
    p.isSlapSliding = false;
    p.isSlapParryRecovering = true;

    p.slapStringPosition = 0;
    p.slapStringWindowUntil = 0;
    p.pendingSlapCount = 0;

    if (p.slapCycleEndCallback) {
      timeoutManager.clearPlayerSpecific(p.id, "slapCycle");
      p.attackCooldownUntil = now + SLAP_PARRY_RECOVERY_MS;
      setPlayerTimeout(p.id, () => {
        p.isAttacking = false;
        p.isSlapAttack = false;
        p.attackType = null;
        p.isSlapSliding = false;
        p.slapFacingDirection = null;
        p.isInStartupFrames = false;
        p.slapActiveEndTime = 0;
        p.currentAction = null;
        p.slapCycleEndCallback = null;
        p.isSlapParryRecovering = false;
      }, SLAP_PARRY_RECOVERY_MS, "slapCycle");
    }
  });

  // Hitstop — brief freeze sells the clash impact
  const hitstopMs = Math.round(SLAP_PARRY_HITSTOP_MS * escalation);
  triggerHitstop(room, hitstopMs);

  // Screen shake — scales with consecutive parries
  const shakeIntensity = Math.min(0.45 + (consecutiveCount - 1) * 0.15, 0.9);
  emitThrottledScreenShake(room, io, {
    intensity: shakeIntensity * escalation,
    duration: 180 + consecutiveCount * 30,
  });

  const midpointX = (player1.x + player2.x) / 2;
  const midpointY = (player1.y + player2.y) / 2;
  io.in(room.id).emit("slap_parry", {
    x: midpointX,
    y: midpointY,
    intensity: escalation,
    consecutiveCount,
    p1x: player1.x,
    p2x: player2.x,
  });
}

function applyParryEffect(player, knockbackDirection, escalation) {
  player.slapParryKnockbackVelocity = SLAP_PARRY_KNOCKBACK_STRENGTH * knockbackDirection * escalation;

  player.slapParryImmunityUntil = Date.now() + SLAP_PARRY_RECOVERY_MS + SLAP_PARRY_WINDOW;
}

function resolveChargeClash(player1, player2, p1Charge, p2Charge, room, io) {
  const knockbackDir1 = player1.x < player2.x ? -1 : 1;
  const knockbackDir2 = -knockbackDir1;

  // Charge advantage: positive = player1 charged more, negative = player2 charged more
  const chargeDiff = p1Charge - p2Charge;
  const advantage = chargeDiff / 100; // -1 to 1

  // Higher charge = less knockback (they "won" the clash positionally)
  const p1Knockback = Math.max(
    CHARGE_CLASH_MIN_KNOCKBACK,
    CHARGE_CLASH_BASE_KNOCKBACK * (1 - advantage * CHARGE_CLASH_ADVANTAGE_SCALE)
  );
  const p2Knockback = Math.max(
    CHARGE_CLASH_MIN_KNOCKBACK,
    CHARGE_CLASH_BASE_KNOCKBACK * (1 + advantage * CHARGE_CLASH_ADVANTAGE_SCALE)
  );

  // Clear attack states for both players
  [player1, player2].forEach((p) => {
    p.isAttacking = false;
    p.isChargingAttack = false;
    p.chargeStartTime = 0;
    p.chargeAttackPower = 0;
    p.chargingFacingDirection = null;
    p.attackType = null;
    p.attackStartTime = 0;
    p.attackEndTime = 0;
    p.chargedAttackHit = false;
    p.isSlapAttack = false;
    p.isInStartupFrames = false;
    p.startupEndTime = 0;

    if (p.keys && p.keys.mouse1) {
      p.mouse1HeldDuringAttack = true;
      if (!p.mouse1PressTime) p.mouse1PressTime = Date.now();
    }
  });

  // Put both in recovery (uses the charged-recovery animation)
  player1.isRecovering = true;
  player1.recoveryStartTime = Date.now();
  player1.recoveryDuration = CHARGE_CLASH_RECOVERY_DURATION;
  player1.recoveryDirection = player1.facing;
  player1.knockbackVelocity = { x: p1Knockback * knockbackDir1, y: 0 };
  player1.movementVelocity = p1Knockback * knockbackDir1 * 0.5;
  player1.actionLockUntil = Date.now() + CHARGE_CLASH_RECOVERY_DURATION;
  player1.attackCooldownUntil = Date.now() + CHARGE_CLASH_RECOVERY_DURATION + 150;

  player2.isRecovering = true;
  player2.recoveryStartTime = Date.now();
  player2.recoveryDuration = CHARGE_CLASH_RECOVERY_DURATION;
  player2.recoveryDirection = player2.facing;
  player2.knockbackVelocity = { x: p2Knockback * knockbackDir2, y: 0 };
  player2.movementVelocity = p2Knockback * knockbackDir2 * 0.5;
  player2.actionLockUntil = Date.now() + CHARGE_CLASH_RECOVERY_DURATION;
  player2.attackCooldownUntil = Date.now() + CHARGE_CLASH_RECOVERY_DURATION + 150;

  // Hitstop + screen shake scaled to combined charge power
  const combinedCharge = (p1Charge + p2Charge) / 200; // 0-1 range
  const hitstopMs = HITSTOP_CHARGED_MIN_MS + (HITSTOP_CHARGED_MAX_MS - HITSTOP_CHARGED_MIN_MS) * combinedCharge;
  triggerHitstop(room, hitstopMs);
  emitThrottledScreenShake(room, io, {
    intensity: 0.8 + combinedCharge * 0.5,
    duration: 250 + combinedCharge * 200,
  });

  // Emit charge clash VFX event
  const midpointX = (player1.x + player2.x) / 2;
  const midpointY = (player1.y + player2.y) / 2;
  io.in(room.id).emit("charge_clash", {
    x: midpointX,
    y: midpointY,
    combinedCharge: p1Charge + p2Charge,
  });
}

// resolveSlap3Clash removed — hit 3 no longer part of slap string

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
  
  // ============================================
  // COUNTER HIT DETECTION
  // Counter hit = hitting opponent during STARTUP frames of their move
  // ============================================
  const counterHitFromAttacking = otherPlayer.isAttacking && timeSinceAttackAttempt <= COUNTER_HIT_WINDOW_MS;
  const counterHitFromIntent = timeSinceAttackIntent <= COUNTER_HIT_WINDOW_MS;
  const counterHitFromGrabAttempt = otherPlayer.isGrabStartup === true || otherPlayer.isGrabbingMovement === true;
  const counterHitFromRopeJumpStartup = otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "startup";
  const counterHitFromSidestepStartup = otherPlayer.isSidestepStartup === true;
  const counterHitFromDodgeStartup = otherPlayer.isDodgeStartup === true;
  const isCounterHit = counterHitFromAttacking || counterHitFromIntent || counterHitFromGrabAttempt
    || counterHitFromRopeJumpStartup || counterHitFromSidestepStartup || counterHitFromDodgeStartup;

  // ============================================
  // PUNISH DETECTION
  // Punish = hitting opponent during RECOVERY frames of their move
  // ============================================
  const isPunish = otherPlayer.isRecovering
    || otherPlayer.isWhiffingGrab
    || otherPlayer.isGrabWhiffRecovery
    || otherPlayer.isDodgeRecovery
    || (otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "landing")
    || otherPlayer.isSidestepRecovery;

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
      // Regular parry: neutral advantage — parrier can reposition but can't attack freely.
      // 350ms lock vs 400ms attacker isHit = 50ms advantage (not enough for guaranteed follow-up)
      otherPlayer.isRawParrySuccess = true;
      otherPlayer.rawParryMinDurationMet = true;
      otherPlayer.inputLockUntil = Math.max(otherPlayer.inputLockUntil || 0, Date.now() + 350);
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
          otherPlayer.rawParryCooldownUntil = Date.now() + RAW_PARRY_COOLDOWN_MS;
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

    // Knockback duration: 400ms of real sliding AFTER the freeze ends.
    // setTimeout is wall-clock time but hitstop pauses the simulation, so without
    // compensation the freeze eats into the slide and the attacker barely moves.
    const hitstopMs = isPerfectParry ? HITSTOP_PERFECT_PARRY_MS : HITSTOP_PARRY_MS;
    const parryKnockbackDuration = 400 + (isPerfectParry ? HITSTOP_PERFECT_PARRY_MS : 0);
    setPlayerTimeout(
      player.id,
      () => {
        player.isHit = false;
        player.isAlreadyHit = false;
        player.isParryKnockback = false;
      },
      parryKnockbackDuration,
      "parryKnockbackReset"
    );
    
    player.inputLockUntil = Math.max(player.inputLockUntil || 0, Date.now() + hitstopMs + 100);

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

        triggerHitstop(currentRoom, HITSTOP_PERFECT_PARRY_MS);

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

      // Stun duration: 700ms of real stun AFTER the freeze ends.
      // Same wall-clock vs hitstop issue as knockback — compensate so the
      // full stun window is available for follow-up attacks post-freeze.
      setPlayerTimeout(
        player.id,
        () => {
          player.isRawParryStun = false;
          player.perfectParryStunStartTime = 0;
          player.perfectParryStunBaseTimeout = null;
        },
        baseStunDuration + HITSTOP_PERFECT_PARRY_MS,
        "perfectParryStunReset"
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

    otherPlayer.isHit = true;
    otherPlayer.lastHitType = isSlapAttack ? "slap" : "charged";

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

    // Calculate knockback multiplier based on attack type and string position
    // String hits 1&2: fixed velocity (not multiplier-based). Hit 3 and solo slaps use multiplier.
    let finalKnockbackMultiplier;
    if (isSlapAttack) {
      finalKnockbackMultiplier = SLAP_NEUTRAL_KB_MULTIPLIER;
    } else {
      finalKnockbackMultiplier = 0.45 + Math.pow(chargePercentage / 100, 1.3) * 0.75;
    }

    if (isCounterHit) {
      finalKnockbackMultiplier *= 1.25;
    }

    if (isPunish) {
      finalKnockbackMultiplier *= 1.25;
    }

    if (otherPlayer.isCrouchStance) {
      finalKnockbackMultiplier *= 0.9;
    }

    if (player.activePowerUp === POWER_UP_TYPES.POWER) {
      if (isSlapAttack) {
        finalKnockbackMultiplier *= player.powerUpMultiplier * 0.923;
      } else {
        finalKnockbackMultiplier *= player.powerUpMultiplier;
      }
    }

    let isCinematicKill = false;

    if (canApplyKnockback(otherPlayer)) {
      if (isSlapAttack) {
        const stringPos = player.slapStringPosition || 0;

        otherPlayer.isSlapKnockback = true;

        if (stringPos === 1 || stringPos === 2) {
          // STRING HITS 1 & 2: cinematic combo push — both players slide forward together
          // Victim drifts via knockbackVelocity (active during isHit),
          // attacker drifts via movementVelocity (ice physics). Same speed = locked pair.
          const pushDirection = player.facing === 1 ? -1 : 1;
          otherPlayer.knockbackVelocity.x = pushDirection * SLAP_ONHIT_ATTACKER_PUSH;
          player.movementVelocity = pushDirection * SLAP_ONHIT_ATTACKER_PUSH;
          player.isSlapSliding = true;
          player.lastSlapHitLandedTime = currentTime;
          player.currentSlapHitConnected = true;

        } else if (stringPos === 3) {
          // STRING HIT 3: physics-based knockback — velocity impulse, no DI
          const pushDirection = player.facing === 1 ? -1 : 1;
          otherPlayer.isBurstKnockback = true;
          otherPlayer.burstKnockbackStartTime = currentTime;
          otherPlayer.knockbackVelocity.x = knockbackDirection * SLAP_HIT3_KB_VELOCITY;
          otherPlayer.movementVelocity = 0;
          player.movementVelocity = pushDirection * SLAP_ONHIT_ATTACKER_PUSH;
          player.isSlapSliding = true;
          player.lastSlapHitLandedTime = currentTime;
          player.currentSlapHitConnected = true;

        } else {
          // SOLO SLAP (no string) — standard physics
          otherPlayer.knockbackVelocity.x =
            2.6 * knockbackDirection * finalKnockbackMultiplier;
          otherPlayer.movementVelocity = 0;
          player.movementVelocity = 0;
          player.isSlapSliding = false;
          player.slapParryKnockbackVelocity = 0.12 * (-knockbackDirection);
          player.lastSlapHitLandedTime = currentTime;
        }

      } else {
        otherPlayer.isSlapKnockback = false;
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.movementVelocity = 0;

        isCinematicKill =
          finalKnockbackMultiplier >= CINEMATIC_KILL_MIN_MULTIPLIER &&
          willGuaranteeRingOut(otherPlayer.x, knockbackDirection, finalKnockbackMultiplier);

        if (isCinematicKill) {
          otherPlayer.isCinematicKillVictim = true;
          otherPlayer.lastHitType = "cinematicKill";
          player.isRecovering = false;
          player.isAttacking = true;
          player.attackType = "charged";
          setPlayerTimeout(player.id, () => {
            player.isAttacking = false;
            player.isRecovering = true;
            player.recoveryStartTime = Date.now();
            player.recoveryDuration = 400;
          }, CINEMATIC_KILL_HITSTOP_MS, "cinematicAttackerRecovery");
        }

        const kbBoost = isCinematicKill ? CINEMATIC_KILL_KNOCKBACK_BOOST : 1;
        otherPlayer.knockbackVelocity.x =
          2.7 * knockbackDirection * finalKnockbackMultiplier * kbBoost;
        otherPlayer.movementVelocity = 0;

        const attackerBounceDirection = -knockbackDirection;
        const attackerBounceMultiplier = 0.3 + (chargePercentage / 100) * 0.5;
        if (isCinematicKill) {
          player.movementVelocity = 0;
        } else {
          player.movementVelocity =
            2 * attackerBounceDirection * attackerBounceMultiplier;
        }
        player.knockbackVelocity = { x: 0, y: 0 };
      }

      if (!isSlapAttack) {
        const minSepDist = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, otherPlayer.sizeMultiplier || 1);
        const currentDist = Math.abs(player.x - otherPlayer.x);
        if (currentDist < minSepDist) {
          const deficit = minSepDist - currentDist;
          const pushDir = otherPlayer.x >= player.x ? 1 : -1;
          otherPlayer.x += pushDir * deficit;
        }
      }

      setKnockbackImmunity(otherPlayer);

      // Emit hit effect at the hit player's position
      if (currentRoom) {
        io.in(currentRoom.id).emit("player_hit", {
          x: otherPlayer.x,
          y: otherPlayer.y,
          facing: otherPlayer.facing,
          attackType: isSlapAttack ? "slap" : "charged",
          stringPos: isSlapAttack ? (player.slapStringPosition || 0) : 0,
          timestamp: Date.now(),
          hitId: Math.random().toString(36).substr(2, 9),
          isCounterHit: isCounterHit,
          isPunish: isPunish,
          cinematicKill: isCinematicKill || false,
          knockbackDirection: knockbackDirection,
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
          const isBurstHitLocal = (player.slapStringPosition || 0) === 3;
          const slapHitstopMs = isBurstHitLocal ? HITSTOP_SLAP_HIT3_MS : HITSTOP_SLAP_MS;
          triggerHitstop(currentRoom, slapHitstopMs);

          // === SYMMETRIC HITSTOP COMPENSATION ===
          if (player.slapCycleEndCallback) {
            timeoutManager.clearPlayerSpecific(player.id, "slapCycle");
            const remainingActive = Math.max(0, player.attackEndTime - currentTime);
            const extendedActive = remainingActive + slapHitstopMs;
            player.attackEndTime = currentTime + extendedActive;

            const remainingCycle = Math.max(0, player.attackCooldownUntil - currentTime);
            const extendedCycle = remainingCycle + slapHitstopMs;
            player.attackCooldownUntil = currentTime + extendedCycle;
            setPlayerTimeout(player.id, player.slapCycleEndCallback, extendedCycle, "slapCycle");
          }

          otherPlayer._slapHitstopExtension = slapHitstopMs;

          if (isBurstHitLocal) {
            emitThrottledScreenShake(currentRoom, io, {
              intensity: 1.2,
              duration: 300,
            });
          } else {
            emitThrottledScreenShake(currentRoom, io, {
              intensity: 0.8,
              duration: 180,
            });
          }
        } else {
          // Charged attacks scale hitstop with charge power
          const hitstopDuration = isCinematicKill
            ? CINEMATIC_KILL_HITSTOP_MS
            : getChargedHitstop(chargePercentage / 100);
          triggerHitstop(currentRoom, hitstopDuration);

          if (isCinematicKill) {
            io.in(currentRoom.id).emit("cinematic_kill", {
              attackerId: player.id,
              victimId: otherPlayer.id,
              victimX: otherPlayer.x,
              victimY: otherPlayer.y,
              attackerX: player.x,
              attackerY: player.y,
              knockbackDirection: knockbackDirection,
              hitstopMs: CINEMATIC_KILL_HITSTOP_MS,
              impactX: (player.x + otherPlayer.x) / 2,
              impactY: otherPlayer.y,
            });
          } else {
            emitThrottledScreenShake(currentRoom, io, {
              intensity: 0.9 + (chargePercentage / 100) * 0.4,
              duration: 220 + (chargePercentage / 100) * 180,
            });
          }
        }
      }
    }

    otherPlayer.knockbackVelocity.y = 0;
    otherPlayer.y = GROUND_LEVEL;

    // === HIT STUN DURATION ===
    // String hits 1 & 2: identical 260ms — hit 2's fast 195ms cycle guarantees
    //   the true combo. Slap3's 165ms startup creates the frame trap gap (~45ms).
    // Hit 3 / solo slaps: 260ms stun.
    const stringPos = isSlapAttack ? (player.slapStringPosition || 0) : 0;
    let hitStateDuration;
    if (isSlapAttack) {
      hitStateDuration = SLAP_STRING_HIT_STUN_MS;
    } else {
      hitStateDuration = 380;
    }
    if (isCinematicKill) {
      hitStateDuration = 3000;
    } else if (isCounterHit) {
      hitStateDuration = Math.round(hitStateDuration * 1.4);
    }
    if (isPunish && !isCinematicKill) {
      hitStateDuration = Math.round(hitStateDuration * 1.4);
    }

    // Symmetric hitstop: extend victim's stun by the same amount the attacker's
    // cycle was extended, so the gap between string hits is frame-perfect every time.
    const hitstopExtension = otherPlayer._slapHitstopExtension || 0;
    otherPlayer._slapHitstopExtension = 0;
    hitStateDuration += hitstopExtension;

    // Update the last hit time for tracking
    otherPlayer.lastHitTime = currentTime;
    otherPlayer.lastHitByStringPos = stringPos;

    const isBurstHit = isSlapAttack && stringPos === 3;
    const stunDuration = isBurstHit ? (SLAP_HIT3_STUN_MS + hitstopExtension) : hitStateDuration;

    setPlayerTimeout(
      otherPlayer.id,
      () => {
        if (isBurstHit) {
          if (Math.abs(otherPlayer.knockbackVelocity.x) > 0.01) {
            otherPlayer.movementVelocity = otherPlayer.knockbackVelocity.x;
          }
        } else if (Math.abs(otherPlayer.knockbackVelocity.x) > 0.01) {
          otherPlayer.movementVelocity = otherPlayer.knockbackVelocity.x;
        }
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.isHit = false;
        otherPlayer.isSlapKnockback = false;
        otherPlayer.isBurstKnockback = false;
        otherPlayer.burstKnockbackStartTime = 0;

        const isStringHit = isSlapAttack && (stringPos === 1 || stringPos === 2);
        if (isSlapAttack && SLAP_CHAIN_HIT_GAP_MS > 0 && !isStringHit) {
          setPlayerTimeout(
            otherPlayer.id,
            () => { otherPlayer.isAlreadyHit = false; },
            SLAP_CHAIN_HIT_GAP_MS,
            "chainHitGap"
          );
        } else {
          otherPlayer.isAlreadyHit = false;
        }
      },
      stunDuration,
      "hitStateReset"
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

module.exports = { checkCollision, processHit, resolveSlapParry, applyParryEffect, resolveChargeClash };

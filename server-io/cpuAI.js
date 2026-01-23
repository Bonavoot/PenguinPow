// CPU AI Module for Pumo Pumo - SUMO EXPERT
// Goal: Knock the opponent out of the dohyo (ring)

// Map boundaries - must match server constants in gameUtils.js
const MAP_LEFT_BOUNDARY = 135;
const MAP_RIGHT_BOUNDARY = 930;
const MAP_CENTER = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;

// AI Configuration - Tuned for expert sumo gameplay
const AI_CONFIG = {
  // Distance thresholds
  SLAP_RANGE: 160,         // Distance for slap attacks (close combat)
  GRAB_RANGE: 140,         // Distance for grab attempts
  MID_RANGE: 250,          // Medium distance
  CHARGED_ATTACK_RANGE: 350, // Minimum distance to consider charged attack
  
  // Edge/corner awareness
  EDGE_DANGER_ZONE: 120,   // Distance from edge considered dangerous
  CORNER_CRITICAL_ZONE: 80, // Very close to edge - escape priority!
  BACK_TO_BOUNDARY_THROW_ZONE: 200, // When back is this close to boundary, use throw for ring-out
  
  // Reaction chances (0-1)
  PARRY_CHANCE: 0.28,      // Chance to parry incoming attacks
  DODGE_CHANCE: 0.20,      // Chance to dodge instead of parry
  
  // Timing (ms)
  DECISION_COOLDOWN: 140,  // Minimum time between major decisions (faster = more aggressive)
  
  // Stamina thresholds
  GRAB_BREAK_STAMINA: 33,  // 33% of max stamina to attempt grab break
  DODGE_STAMINA_COST: 15,   // 15% of max stamina per dodge
  
  // Movement
  STRAFE_CHANGE_INTERVAL: 400, // How often to change strafe direction
  
  // Charged attack limits
  MAX_CONSECUTIVE_CHARGED: 2,  // Max charged attacks before forcing other moves
};

// AI State tracking per CPU player
const aiStates = new Map();

function getAIState(playerId) {
  if (!aiStates.has(playerId)) {
    aiStates.set(playerId, {
      lastDecisionTime: 0,
      lastStrafeChangeTime: 0,
      currentStrafeDirection: 0,
      isChargingIntentional: false,
      chargeStartTime: 0,
      targetChargeTime: 0,
      pendingParry: false,
      parryStartTime: 0,
      parryReleaseTime: 0,
      lastAttackReactionTime: 0,
      consecutiveChargedAttacks: 0, // Track charged attack usage
      lastActionType: null,
      // Key release timestamps
      mouse1ReleaseTime: 0,
      shiftReleaseTime: 0,
      eReleaseTime: 0,
      fReleaseTime: 0,
      // Power-up usage tracking
      lastPowerUpTime: 0,
      // Grab break timing
      grabStartedTime: 0,
      // Grab decision tracking - prevents stuttering
      grabDecisionMade: false,
      grabStrategy: null, // 'forward_push' or 'backward_throw'
    });
  }
  return aiStates.get(playerId);
}

function clearAIState(playerId) {
  aiStates.delete(playerId);
}

// Calculate distance between two players
function getDistance(player1, player2) {
  return Math.abs(player1.x - player2.x);
}

// Check how close to left edge
function distanceToLeftEdge(player) {
  return player.x - MAP_LEFT_BOUNDARY;
}

// Check how close to right edge
function distanceToRightEdge(player) {
  return MAP_RIGHT_BOUNDARY - player.x;
}

// Check if player is near ANY edge
function isNearEdge(player, threshold = AI_CONFIG.EDGE_DANGER_ZONE) {
  return distanceToLeftEdge(player) < threshold || distanceToRightEdge(player) < threshold;
}

// Check if player is in critical corner situation
function isInCorner(player) {
  return distanceToLeftEdge(player) < AI_CONFIG.CORNER_CRITICAL_ZONE || 
         distanceToRightEdge(player) < AI_CONFIG.CORNER_CRITICAL_ZONE;
}

// Get which side the player is cornered on (-1 = left, 1 = right, 0 = not cornered)
function getCorneredSide(player) {
  if (distanceToLeftEdge(player) < AI_CONFIG.CORNER_CRITICAL_ZONE) return -1;
  if (distanceToRightEdge(player) < AI_CONFIG.CORNER_CRITICAL_ZONE) return 1;
  return 0;
}

// Check if opponent is near edge (for ring-out opportunity)
function isOpponentNearEdge(opponent, threshold = AI_CONFIG.EDGE_DANGER_ZONE) {
  return distanceToLeftEdge(opponent) < threshold || distanceToRightEdge(opponent) < threshold;
}

// Get direction toward center from current position
function getDirectionToCenter(player) {
  return player.x < MAP_CENTER ? 1 : -1; // 1 = move right, -1 = move left
}

// Get direction toward opponent
function getDirectionToOpponent(cpu, human) {
  return cpu.x < human.x ? 1 : -1; // 1 = move right, -1 = move left
}

// Random chance check
function chance(probability) {
  return Math.random() < probability;
}

// Random number in range
function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check if CPU can act (not in a state that blocks actions)
function canAct(cpu) {
  const isOnCooldown = cpu.attackCooldownUntil && Date.now() < cpu.attackCooldownUntil;
  const isInputLocked = cpu.inputLockUntil && Date.now() < cpu.inputLockUntil;
  const isActionLocked = cpu.actionLockUntil && Date.now() < cpu.actionLockUntil;
  
  return !cpu.isHit && 
         !cpu.isBeingThrown && 
         !cpu.isThrowing && 
         !cpu.isDodging && 
         !cpu.isRecovering && 
         !cpu.isRawParryStun && 
         !cpu.isThrowTeching &&
         !cpu.canMoveToReady &&
         !cpu.isThrowingSalt &&
         !cpu.isSpawningPumoArmy &&
         !cpu.isThrowingSnowball &&
         !cpu.isAtTheRopes &&
         !cpu.isInEndlag &&
         !cpu.isGrabStartup &&
         !cpu.isWhiffingGrab &&
         !cpu.isGrabbingMovement &&
         !cpu.isBeingGrabbed &&
         !cpu.isGrabBreaking &&
         !cpu.isGrabBreakCountered &&
         !cpu.isGrabBreakSeparating &&
         !isOnCooldown &&
         !isInputLocked &&
         !isActionLocked;
}

// Check if CPU can attack
function canAttack(cpu) {
  return canAct(cpu) && 
         !cpu.isAttacking && 
         !cpu.isGrabbing && 
         !cpu.isBeingGrabbed &&
         !cpu.isRawParrying &&
         !cpu.isChargingAttack;
}

// Check if CPU can grab
function canGrab(cpu) {
  return canAct(cpu) && 
         !cpu.isAttacking && 
         !cpu.isGrabbing && 
         !cpu.isBeingGrabbed &&
         !cpu.isChargingAttack &&
         !cpu.grabCooldown;
}

// Check if CPU can dodge
function canDodge(cpu) {
  return canAct(cpu) && 
         !cpu.isAttacking &&
         !cpu.isGrabbing &&
         !cpu.isBeingGrabbed &&
         cpu.stamina >= AI_CONFIG.DODGE_STAMINA_COST &&
         !cpu.isChargingAttack;
}

// Check if CPU can parry
function canParry(cpu) {
  return canAct(cpu) && 
         !cpu.isAttacking && 
         !cpu.isGrabbing &&
         !cpu.isBeingGrabbed &&
         !cpu.isRawParrying &&
         !cpu.isChargingAttack;
}

function createEmptyKeys() {
  return {
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
}

function resetAllKeys(cpu) {
  cpu.keys = createEmptyKeys();
}

// Handle key releases based on timestamps
function handlePendingKeyReleases(cpu, aiState, currentTime) {
  if (aiState.mouse1ReleaseTime > 0 && currentTime >= aiState.mouse1ReleaseTime) {
    cpu.keys.mouse1 = false;
    aiState.mouse1ReleaseTime = 0;
  }
  if (aiState.shiftReleaseTime > 0 && currentTime >= aiState.shiftReleaseTime) {
    cpu.keys.shift = false;
    // DON'T clear A/D here - it interferes with grab walking!
    // Only clear them if we're NOT grabbing
    if (!cpu.isGrabbing) {
      cpu.keys.a = false;
      cpu.keys.d = false;
    }
    aiState.shiftReleaseTime = 0;
  }
  if (aiState.eReleaseTime > 0 && currentTime >= aiState.eReleaseTime) {
    cpu.keys.e = false;
    aiState.eReleaseTime = 0;
  }
  if (aiState.fReleaseTime > 0 && currentTime >= aiState.fReleaseTime) {
    cpu.keys.f = false;
    aiState.fReleaseTime = 0;
  }
}

// Main AI update function - called every game tick
function updateCPUAI(cpu, human, room, currentTime) {
  if (!cpu || !human || !cpu.isCPU) return;
  
  // Don't process AI during game over or before game starts
  if (room.gameOver || room.matchOver || !room.gameStart || room.hakkiyoiCount === 0) {
    resetAllKeys(cpu);
    return;
  }
  
  // Don't process AI during grab break - both players are locked
  if (cpu.isGrabBreaking || cpu.isGrabBreakCountered || cpu.isGrabBreakSeparating ||
      human.isGrabBreaking || human.isGrabBreakCountered || human.isGrabBreakSeparating) {
    resetAllKeys(cpu);
    return;
  }
  
  const aiState = getAIState(cpu.id);
  const distance = getDistance(cpu, human);
  
  // Initialize keys object if needed
  if (!cpu.keys) {
    cpu.keys = createEmptyKeys();
  }
  
  // Handle pending key releases
  handlePendingKeyReleases(cpu, aiState, currentTime);
  
  // HIGHEST PRIORITY: If currently grabbing, WALK THEM OFF THE EDGE!
  // This must be checked FIRST to ensure continuous walking!
  if (cpu.isGrabbing && cpu.grabbedOpponent) {
    // Clear grab break timer since we're the grabber
    aiState.grabStartedTime = 0;
    handleGrabDecision(cpu, human, aiState, currentTime);
    return; // Don't do anything else while grabbing - just walk!
  } else {
    // Not grabbing - reset grab decision state for next grab
    aiState.grabDecisionMade = false;
    aiState.grabStrategy = null;
  }
  
  // Priority 1: Handle being grabbed - try to break free
  if (cpu.isBeingGrabbed && !cpu.isBeingThrown) {
    handleGrabBreak(cpu, aiState, currentTime);
    return;
  } else {
    // Not being grabbed - reset the grab timer
    aiState.grabStartedTime = 0;
  }
  
  // Handle pending parry release
  if (aiState.pendingParry) {
    if (currentTime >= aiState.parryReleaseTime || !human.isAttacking) {
      cpu.keys.s = false;
      aiState.pendingParry = false;
    } else {
      cpu.keys.s = true;
      return;
    }
  }
  
  // Priority 1.5: Use power-up EARLY - especially one-time use ones like pumo_army!
  if (handlePowerUpUsage(cpu, human, aiState, currentTime, distance)) {
    return;
  }
  
  // Priority 2: ESCAPE CORNER - This is critical in sumo!
  const corneredSide = getCorneredSide(cpu);
  if (corneredSide !== 0 && canAct(cpu)) {
    if (handleCornerEscape(cpu, human, aiState, currentTime, distance, corneredSide)) {
      return;
    }
  }
  
  // Priority 3: React to opponent attacks with parry or dodge
  if (human.isAttacking && !human.isInStartupFrames && canParry(cpu)) {
    if (handleDefensiveReaction(cpu, human, aiState, currentTime, distance)) {
      return;
    }
  }
  
  // Priority 3.5: PUNISH OPPONENT PARRYING - grab them while they're stuck in parry!
  if (human.isRawParrying && !cpu.isAttacking && distance < AI_CONFIG.GRAB_RANGE && canGrab(cpu)) {
    handlePunishParry(cpu, human, aiState, currentTime);
    return;
  }
  
  // (Grab handling moved to HIGHEST priority at the top)
  
  // Priority 5: Handle charging attack (continue or release)
  if (cpu.isChargingAttack) {
    handleChargeAttack(cpu, human, aiState, currentTime, distance);
    return;
  }
  
  // Cooldown between major decisions
  if (currentTime - aiState.lastDecisionTime < AI_CONFIG.DECISION_COOLDOWN) {
    handleMovement(cpu, human, aiState, currentTime, distance);
    return;
  }
  
  // Priority 6: RING-OUT OPPORTUNITY - Opponent near edge!
  if (isOpponentNearEdge(human) && canAct(cpu)) {
    handleRingOutOpportunity(cpu, human, aiState, currentTime, distance);
    return;
  }
  
  // Priority 7: Offensive actions based on distance
  if (canAttack(cpu) || canGrab(cpu)) {
    // Close range - aggressive slap/grab combat
    if (distance < AI_CONFIG.SLAP_RANGE) {
      handleCloseRange(cpu, human, aiState, currentTime, distance);
    }
    // Mid range - approach or grab
    else if (distance < AI_CONFIG.MID_RANGE) {
      handleMidRange(cpu, human, aiState, currentTime, distance);
    }
    // Far range - mostly approach, sometimes charged attack
    else {
      handleFarRange(cpu, human, aiState, currentTime, distance);
    }
  } else {
    handleMovement(cpu, human, aiState, currentTime, distance);
  }
}

// Handle grab break attempts (spacebar mashing)
// CPU should break grabs MOST of the time, especially when near edge!
function handleGrabBreak(cpu, aiState, currentTime) {
  // DON'T reset all keys - we need _prevKeys to track the previous state for keyJustPressed
  
  // Track when we started being grabbed for delay purposes
  if (!aiState.grabStartedTime) {
    aiState.grabStartedTime = currentTime;
  }
  
  // Check how close to edge (danger level)
  const leftDist = distanceToLeftEdge(cpu);
  const rightDist = distanceToRightEdge(cpu);
  const nearestEdgeDist = Math.min(leftDist, rightDist);
  
  // Time we've been grabbed
  const timeGrabbed = currentTime - aiState.grabStartedTime;
  
  // ALWAYS try to break if we have stamina, but with timing considerations:
  // - Minimum wait time so it doesn't seem cheap (300ms base)
  // - Break FASTER if near edge (danger!)
  
  const MIN_WAIT_BASE = 300; // Base minimum wait before trying to break
  const EDGE_DANGER_THRESHOLD = 200; // If closer than this to edge, break faster!
  
  // Calculate effective wait time - shorter if near edge!
  let effectiveMinWait = MIN_WAIT_BASE;
  if (nearestEdgeDist < EDGE_DANGER_THRESHOLD) {
    // Near edge! Reduce wait time proportionally to danger
    const dangerFactor = nearestEdgeDist / EDGE_DANGER_THRESHOLD; // 0 to 1
    effectiveMinWait = MIN_WAIT_BASE * dangerFactor; // 0ms to 300ms based on proximity
  }
  
  // Have we waited long enough?
  if (timeGrabbed < effectiveMinWait) {
    // Not yet - don't try to break yet
    // Keep spacebar released so the next press counts as a "new" press
    cpu.keys[" "] = false;
    return;
  }
  
  // Mash spacebar to break! (if we have stamina)
  // We need to alternate between pressed and not pressed for keyJustPressed to work
  const GRAB_BREAK_STAMINA_COST = 33; // 33% of max stamina
  if (cpu.stamina >= GRAB_BREAK_STAMINA_COST) {
    // Alternate every ~80ms to create distinct key presses
    // This creates a "press-release-press-release" pattern
    const pressPhase = Math.floor(currentTime / 80) % 2 === 0;
    cpu.keys[" "] = pressPhase;
    
    if (pressPhase) {
      console.log(`CPU GRAB BREAK: Pressing spacebar! Edge dist: ${Math.round(nearestEdgeDist)}, stamina: ${cpu.stamina}`);
    }
  } else {
    cpu.keys[" "] = false;
    console.log(`CPU GRAB BREAK: Not enough stamina (${cpu.stamina}/${GRAB_BREAK_STAMINA_COST})`);
  }
}

// PUNISH: Grab opponent while they're stuck in parry animation
function handlePunishParry(cpu, human, aiState, currentTime) {
  resetAllKeys(cpu);
  
  // High priority grab - opponent is vulnerable while parrying!
  cpu.keys.e = true;
  aiState.eReleaseTime = currentTime + 50;
  aiState.lastDecisionTime = currentTime;
  aiState.lastActionType = "punish_grab";
  console.log("CPU: Punishing opponent's parry with grab!");
}

// Handle power-up usage (F key) - snowball or pumo army
function handlePowerUpUsage(cpu, human, aiState, currentTime, distance) {
  // Check if CPU has an active power-up that uses F key
  const hasSnowball = cpu.activePowerUp === "snowball" && !cpu.snowballCooldown && !cpu.isThrowingSnowball;
  const hasPumoArmy = cpu.activePowerUp === "pumo_army" && !cpu.pumoArmyCooldown && !cpu.isSpawningPumoArmy;
  
  console.log(`CPU Power-up check: activePowerUp=${cpu.activePowerUp}, hasSnowball=${hasSnowball}, hasPumoArmy=${hasPumoArmy}`);
  
  if (!hasSnowball && !hasPumoArmy) {
    return false;
  }
  
  // Simple blocking conditions - only block during these specific states
  if (cpu.isAttacking || cpu.isGrabbing || cpu.isBeingGrabbed || 
      cpu.isThrowing || cpu.isBeingThrown || cpu.isDodging ||
      cpu.isHit || cpu.isRawParryStun || cpu.isRecovering ||
      cpu.isThrowingSnowball || cpu.isSpawningPumoArmy) {
    console.log(`CPU Power-up blocked by state`);
    return false;
  }
  
  // Short cooldown between power-up uses
  const powerUpCooldown = hasSnowball ? 800 : 300; // Even shorter cooldown
  if (currentTime - aiState.lastPowerUpTime < powerUpCooldown) {
    return false;
  }
  
  // USE THE POWER-UP!
  if (hasSnowball) {
    console.log("CPU: PRESSING F KEY for snowball!");
    resetAllKeys(cpu);
    cpu.keys.f = true;
    aiState.fReleaseTime = currentTime + 150; // Brief press
    aiState.lastPowerUpTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "snowball";
    return true;
  }
  
  if (hasPumoArmy) {
    console.log("CPU: PRESSING F KEY for pumo army!");
    resetAllKeys(cpu);
    cpu.keys.f = true;
    aiState.fReleaseTime = currentTime + 150; // Brief press
    aiState.lastPowerUpTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "pumo_army";
    return true;
  }
  
  return false;
}

// CRITICAL: Handle escaping from corner - sumo survival!
// NEW STRATEGY: When back is against boundary, GRAB + THROW is a strong option!
// The throw sends opponent PAST us toward the boundary behind us = ring out!
function handleCornerEscape(cpu, human, aiState, currentTime, distance, corneredSide) {
  resetAllKeys(cpu);
  
  const escapeDirection = -corneredSide; // Move away from the edge
  
  // Check how close to the back boundary we are
  // corneredSide: -1 = cornered on LEFT, 1 = cornered on RIGHT
  const distToBackBoundary = corneredSide === -1 ? distanceToLeftEdge(cpu) : distanceToRightEdge(cpu);
  const veryCloseToBackBoundary = distToBackBoundary < 100; // Very close = throw is almost guaranteed ring out
  
  // If opponent is very close, we need to act
  if (distance < AI_CONFIG.SLAP_RANGE) {
    const roll = Math.random();
    
    // PRIORITY: If back is VERY close to boundary, heavily favor grab for the throw ring-out!
    // This is our best move when cornered - the throw sends them toward our back boundary
    if (veryCloseToBackBoundary && canGrab(cpu)) {
      // 65% chance to grab when back is very close to boundary (was 35%)
      if (roll < 0.65) {
        cpu.keys.e = true;
        aiState.eReleaseTime = currentTime + 50;
        aiState.lastDecisionTime = currentTime;
        aiState.lastActionType = "grab_corner_throw";
        console.log(`CPU CORNER: Grabbing for throw ring-out! Back only ${Math.round(distToBackBoundary)} from boundary!`);
        return true;
      }
    }
    
    // Option 1: Dodge toward center (30% chance - reduced since grab is better when cornered)
    if (roll < 0.30 && canDodge(cpu)) {
      cpu.keys.shift = true;
      if (escapeDirection === 1) {
        cpu.keys.d = true;
      } else {
        cpu.keys.a = true;
      }
      aiState.shiftReleaseTime = currentTime + 80;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "dodge_escape";
      return true;
    }
    // Option 2: Grab (40% chance) - throw will send opponent toward our back boundary
    else if (roll < 0.70 && canGrab(cpu)) {
      cpu.keys.e = true;
      aiState.eReleaseTime = currentTime + 50;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "grab";
      console.log(`CPU CORNER: Grabbing! Will throw toward back boundary for ring-out!`);
      return true;
    }
    // Option 3: Slap attack to push them back (30% chance)
    else if (canAttack(cpu)) {
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return true;
    }
  }
  // Opponent not too close - just move toward center
  else {
    if (escapeDirection === 1) {
      cpu.keys.d = true;
    } else {
      cpu.keys.a = true;
    }
    aiState.lastDecisionTime = currentTime;
    return true;
  }
  
  return false;
}

// Handle ring-out opportunity when opponent is near edge
// GRABS ARE THE BEST! They let you walk opponent off the edge!
function handleRingOutOpportunity(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  // PRIORITY 1: GRAB! It's the most reliable ring-out method!
  // You can walk them off the edge after grabbing!
  if (distance < AI_CONFIG.GRAB_RANGE + 30 && canGrab(cpu)) {
    cpu.keys.e = true;
    aiState.eReleaseTime = currentTime + 50;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "grab";
    console.log("CPU: GRAB for ring-out! Opponent near edge!");
    return;
  }
  
  // PRIORITY 2: If too far for grab but close enough for slap, slap them
  if (distance < AI_CONFIG.SLAP_RANGE && canAttack(cpu)) {
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap";
    return;
  }
  
  // PRIORITY 3: Approach aggressively to get in grab range!
  const dirToOpponent = getDirectionToOpponent(cpu, human);
  if (dirToOpponent === 1) {
    cpu.keys.d = true;
  } else {
    cpu.keys.a = true;
  }
  console.log("CPU: Approaching opponent near edge for grab!");
}

// Handle defensive reactions (parry or dodge)
function handleDefensiveReaction(cpu, human, aiState, currentTime, distance) {
  if (currentTime - aiState.lastAttackReactionTime < 200) {
    return false;
  }
  
  const attackRange = human.attackType === "slap" ? 180 : 280;
  if (distance > attackRange) {
    return false;
  }
  
  const roll = Math.random();
  
  if (roll < AI_CONFIG.PARRY_CHANCE && canParry(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.s = true;
    aiState.lastAttackReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.pendingParry = true;
    aiState.parryStartTime = currentTime;
    aiState.parryReleaseTime = currentTime + randomInRange(180, 350);
    return true;
  } else if (roll < AI_CONFIG.PARRY_CHANCE + AI_CONFIG.DODGE_CHANCE && canDodge(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.shift = true;
    
    // SMART DODGE: ALWAYS prioritize dodging AWAY from the nearest boundary!
    // This prevents the CPU from backing itself into a corner
    const cpuLeftDist = distanceToLeftEdge(cpu);
    const cpuRightDist = distanceToRightEdge(cpu);
    
    // Determine which edge is closer - ALWAYS dodge away from it
    const nearestEdge = cpuLeftDist < cpuRightDist ? 'left' : 'right';
    const distToNearestEdge = Math.min(cpuLeftDist, cpuRightDist);
    
    // If we're anywhere near an edge (within 250 pixels), prioritize dodging toward center
    if (distToNearestEdge < 250) {
      // Dodge AWAY from the nearest edge (toward center)
      if (nearestEdge === 'left') {
        cpu.keys.d = true; // Dodge right (away from left edge)
      } else {
        cpu.keys.a = true; // Dodge left (away from right edge)
      }
      console.log(`CPU: Smart dodge AWAY from ${nearestEdge} edge (dist: ${Math.round(distToNearestEdge)})`);
    } else {
      // Safe to dodge in any direction - prefer dodging away from opponent
      const intendedDir = cpu.x < human.x ? -1 : 1; // -1 = left, 1 = right
      if (intendedDir === -1) cpu.keys.a = true;
      else cpu.keys.d = true;
    }
    
    aiState.lastAttackReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.shiftReleaseTime = currentTime + 80;
    return true;
  }
  
  return false;
}

// Handle decision when CPU has grabbed opponent
// ==== CRITICAL MECHANICS ====
// - Opponent is ATTACHED in the FACING direction at fixed distance (~105 units)
// - facing = 1 (LEFT): opponent is to the LEFT of CPU (lower x)
// - facing = -1 (RIGHT): opponent is to the RIGHT of CPU (higher x)
// - Walking FORWARD moves both toward the FRONT boundary (opponent's side)
// - Walking BACKWARD moves both toward the BACK boundary (CPU's back side)
// - THROW (W key): Launches opponent ~220 units total, ending ~120 units BEHIND the CPU
//   - Throw distance means: if CPU's back is within 120 of boundary, throw = guaranteed ring-out
// ==== SMART STRATEGY ====
// Compare two paths to ring-out:
// 1. WALK FORWARD: Push opponent to front boundary
// 2. WALK BACKWARD + THROW: Pull opponent toward back boundary, throw when in range
// Choose whichever path is shorter!
function handleGrabDecision(cpu, human, aiState, currentTime) {
  const cpuFacingLeft = cpu.facing === 1;
  
  // Clear all keys first
  cpu.keys.a = false;
  cpu.keys.d = false;
  cpu.keys.w = false;
  cpu.keys.shift = false;
  cpu.keys.e = false;
  cpu.keys.mouse1 = false;
  cpu.keys.mouse2 = false;
  
  // === THROW MECHANICS ===
  // Throw moves opponent from ~100 units in front to ~120 units behind CPU
  // For guaranteed ring-out via throw: CPU's back must be within THROW_RING_OUT_DISTANCE of boundary
  const THROW_RING_OUT_DISTANCE = 120; // Distance from back boundary where throw guarantees ring-out
  
  // === CALCULATE DISTANCES ===
  let distToFrontBoundary;  // Opponent's distance to the boundary in front of CPU
  let distToBackBoundary;   // CPU's back distance to the boundary behind
  let walkForwardKey;       // Key to press to walk forward (toward opponent)
  let walkBackwardKey;      // Key to press to walk backward (away from opponent)
  
  if (cpuFacingLeft) {
    // Facing LEFT: opponent is on LEFT, back is toward RIGHT
    distToFrontBoundary = human.x - MAP_LEFT_BOUNDARY;  // How far opponent is from left edge
    distToBackBoundary = MAP_RIGHT_BOUNDARY - cpu.x;    // How far CPU's back is from right edge
    walkForwardKey = 'a';   // Walk left to push opponent toward left boundary
    walkBackwardKey = 'd';  // Walk right to pull opponent toward right boundary
  } else {
    // Facing RIGHT: opponent is on RIGHT, back is toward LEFT
    distToFrontBoundary = MAP_RIGHT_BOUNDARY - human.x; // How far opponent is from right edge
    distToBackBoundary = cpu.x - MAP_LEFT_BOUNDARY;     // How far CPU's back is from left edge
    walkForwardKey = 'd';   // Walk right to push opponent toward right boundary
    walkBackwardKey = 'a';  // Walk left to pull opponent toward left boundary
  }
  
  // === CALCULATE DISTANCE TO EACH RING-OUT METHOD ===
  // Method 1: Walk forward until opponent crosses boundary
  const distToWalkForwardRingOut = distToFrontBoundary;
  
  // Method 2: Walk backward until in throw range, then throw
  // We need to walk backward until: distToBackBoundary <= THROW_RING_OUT_DISTANCE
  const distToWalkBackwardForThrow = Math.max(0, distToBackBoundary - THROW_RING_OUT_DISTANCE);
  
  // === MAKE DECISION AT START OF GRAB ===
  if (!aiState.grabDecisionMade) {
    aiState.grabDecisionMade = true;
    
    // Compare the two methods - which is shorter?
    if (distToWalkBackwardForThrow < distToWalkForwardRingOut) {
      // Walking backward + throw is shorter!
      aiState.grabStrategy = 'backward_throw';
      console.log(`CPU GRAB STRATEGY: BACKWARD + THROW! Need to walk ${Math.round(distToWalkBackwardForThrow)} backward vs ${Math.round(distToWalkForwardRingOut)} forward`);
    } else {
      // Walking forward is shorter or equal
      aiState.grabStrategy = 'forward_push';
      console.log(`CPU GRAB STRATEGY: FORWARD PUSH! Need to walk ${Math.round(distToWalkForwardRingOut)} forward vs ${Math.round(distToWalkBackwardForThrow)} backward + throw`);
    }
  }
  
  // === EXECUTE THE STRATEGY ===
  
  if (aiState.grabStrategy === 'backward_throw') {
    // Strategy: Walk backward until in throw range, then throw
    
    // Check if we're now in throw range (back is close enough to boundary)
    if (distToBackBoundary <= THROW_RING_OUT_DISTANCE) {
      // IN THROW RANGE! Execute the throw for guaranteed ring-out!
      cpu.keys.w = true;
      console.log(`CPU GRAB: IN THROW RANGE! Back is ${Math.round(distToBackBoundary)} from boundary - THROWING!`);
      return;
    }
    
    // Not yet in throw range - keep walking backward
    cpu.keys[walkBackwardKey] = true;
  } else {
    // Strategy: Walk forward to push opponent off the front boundary
    cpu.keys[walkForwardKey] = true;
  }
  
  // === EMERGENCY THROW if grab is about to expire ===
  if (cpu.grabStartTime) {
    const grabElapsed = currentTime - cpu.grabStartTime;
    const GRAB_DURATION = 1500;
    if (grabElapsed > GRAB_DURATION - 200) {
      cpu.keys.w = true;
      console.log(`CPU GRAB: EMERGENCY THROW! Grab ending soon!`);
    }
  }
}

// Handle charging attack logic
function handleChargeAttack(cpu, human, aiState, currentTime, distance) {
  const chargeElapsed = currentTime - aiState.chargeStartTime;
  
  // Release if:
  // 1. Reached target charge time
  // 2. Opponent got very close (danger!)
  // 3. Opponent is dodging
  if (chargeElapsed >= aiState.targetChargeTime || 
      distance < AI_CONFIG.SLAP_RANGE - 30 ||
      human.isDodging) {
    cpu.keys.mouse2 = false;
    aiState.isChargingIntentional = false;
    aiState.consecutiveChargedAttacks++;
  } else {
    cpu.keys.mouse2 = true;
  }
}

// Close range combat - AGGRESSIVE SLAPS with strategic grabs!
function handleCloseRange(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  aiState.consecutiveChargedAttacks = 0; // Reset charged attack counter
  
  const roll = Math.random();
  
  // GRABS ARE THE BEST WAY TO WIN! Prioritize them!
  // Especially if opponent is near edge - almost guaranteed ring-out!
  if (isOpponentNearEdge(human) && canGrab(cpu)) {
    // 70% chance to grab when opponent is near edge
    if (roll < 0.70) {
      cpu.keys.e = true;
      aiState.eReleaseTime = currentTime + 50;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "grab";
      console.log("CPU: Grabbing! Opponent near edge - easy ring-out!");
      return;
    }
  }
  
  // Aggressive close range: 30% grab, 65% slap, 5% back off
  // Slaps are spammable and keep pressure on!
  if (roll < 0.30 && canGrab(cpu)) {
    // Grab attempt - walk them to the edge!
    cpu.keys.e = true;
    aiState.eReleaseTime = currentTime + 50;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "grab";
  } else if (roll < 0.95 && canAttack(cpu)) {
    // SLAP SPAM! Fast and aggressive - keep the pressure on!
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap";
  } else {
    // Very small chance to back off (only 5%)
    const dirAway = cpu.x < human.x ? -1 : 1;
    if (dirAway === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
  }
}

// Mid range - aggressive approach with slaps when in range
function handleMidRange(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  const roll = Math.random();
  
  // If on the closer end of mid-range, throw slaps! (within 200 units)
  if (distance < 200 && canAttack(cpu) && roll < 0.40) {
    // Aggressive slap to close the gap and apply pressure
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap";
    return;
  }
  
  // Mostly approach aggressively (55%)
  if (roll < 0.55) {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  // Sometimes strafe (15%)
  else if (roll < 0.70) {
    handleMovement(cpu, human, aiState, currentTime, distance);
  }
  // Occasionally start charged attack (15%) - but only if haven't spammed it
  else if (roll < 0.85 && canAttack(cpu) && aiState.consecutiveChargedAttacks < AI_CONFIG.MAX_CONSECUTIVE_CHARGED) {
    cpu.keys.mouse2 = true;
    aiState.isChargingIntentional = true;
    aiState.chargeStartTime = currentTime;
    aiState.targetChargeTime = randomInRange(350, 600);
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "charge";
  } else {
    // Approach instead (remaining 15%)
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  
  aiState.lastDecisionTime = currentTime;
}

// Far range - mostly approach, rarely charged attack
function handleFarRange(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  const roll = Math.random();
  
  // Mostly approach (75%)
  if (roll < 0.75) {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  // Sometimes charged attack (15%) - only at true range and not spamming
  else if (roll < 0.90 && 
           distance >= AI_CONFIG.CHARGED_ATTACK_RANGE && 
           canAttack(cpu) && 
           aiState.consecutiveChargedAttacks < AI_CONFIG.MAX_CONSECUTIVE_CHARGED) {
    cpu.keys.mouse2 = true;
    aiState.isChargingIntentional = true;
    aiState.chargeStartTime = currentTime;
    aiState.targetChargeTime = randomInRange(500, 900);
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "charge";
  }
  // Otherwise just approach
  else {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  
  aiState.lastDecisionTime = currentTime;
}

// Smart movement/strafing
function handleMovement(cpu, human, aiState, currentTime, distance) {
  if (cpu.isAttacking || cpu.isGrabbing || cpu.isDodging || cpu.isRawParrying) {
    return;
  }
  
  cpu.keys.a = false;
  cpu.keys.d = false;
  
  // Change strafe direction periodically
  if (currentTime - aiState.lastStrafeChangeTime > AI_CONFIG.STRAFE_CHANGE_INTERVAL) {
    aiState.lastStrafeChangeTime = currentTime;
    
    // If far, move toward opponent
    if (distance > AI_CONFIG.MID_RANGE) {
      aiState.currentStrafeDirection = getDirectionToOpponent(cpu, human);
    }
    // If near edge, move toward center
    else if (isNearEdge(cpu)) {
      aiState.currentStrafeDirection = getDirectionToCenter(cpu);
    }
    // If very close, sometimes back off
    else if (distance < AI_CONFIG.SLAP_RANGE * 0.7) {
      aiState.currentStrafeDirection = chance(0.4) ? 0 : -getDirectionToOpponent(cpu, human);
    }
    // Otherwise random strafe with bias toward opponent
    else {
      const roll = Math.random();
      if (roll < 0.45) {
        aiState.currentStrafeDirection = getDirectionToOpponent(cpu, human);
      } else if (roll < 0.70) {
        aiState.currentStrafeDirection = -getDirectionToOpponent(cpu, human);
      } else {
        aiState.currentStrafeDirection = 0;
      }
    }
  }
  
  // Apply strafe direction
  if (aiState.currentStrafeDirection === -1) {
    cpu.keys.a = true;
  } else if (aiState.currentStrafeDirection === 1) {
    cpu.keys.d = true;
  }
}

// Process CPU inputs and trigger actions
function processCPUInputs(cpu, opponent, room, gameHelpers) {
  if (!cpu || !cpu.isCPU || !cpu.keys) return;
  
  const {
    executeSlapAttack,
    executeChargedAttack,
    canPlayerCharge,
    canPlayerSlap,
    canPlayerUseAction,
    startCharging,
    clearChargeState,
    setPlayerTimeout,
    rooms,
    io, // For emitting events
  } = gameHelpers;
  
  if (!room.gameStart || room.hakkiyoiCount === 0 || room.gameOver || room.matchOver) {
    return;
  }
  
  // CRITICAL: Block all inputs during these states
  if (cpu.canMoveToReady || cpu.isSpawningPumoArmy || cpu.isGrabbingMovement) {
    return;
  }
  
  if (cpu.inputLockUntil && Date.now() < cpu.inputLockUntil) {
    return;
  }
  
  if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
    return;
  }
  
  const currentTime = Date.now();
  
  // STRICT action blocking - prevents multiple moves at once
  const shouldBlockAction = (allowThrowFromGrab = false) => {
    // Block during any active attack execution
    if (cpu.isAttacking) return true;
    // Block during throw animation
    if (cpu.isThrowing) return true;
    // Block while being thrown
    if (cpu.isBeingThrown) return true;
    // Block during dodge
    if (cpu.isDodging) return true;
    // Block during grab startup/movement/whiff
    if (cpu.isGrabStartup || cpu.isGrabbingMovement || cpu.isWhiffingGrab) return true;
    // Block while grabbing (EXCEPT for throwing, which is allowed)
    if (cpu.isGrabbing && !allowThrowFromGrab) return true;
    // Block while being grabbed
    if (cpu.isBeingGrabbed) return true;
    // Block during hit stun
    if (cpu.isHit || cpu.isRawParryStun) return true;
    // Block during recovery
    if (cpu.isRecovering) return true;
    // Block during power-up animations
    if (cpu.isThrowingSnowball || cpu.isSpawningPumoArmy) return true;
    // Block at the ropes
    if (cpu.isAtTheRopes) return true;
    // Block during endlag
    if (cpu.isInEndlag) return true;
    // Block during grab break animation and separation - BOTH players are locked
    if (cpu.isGrabBreaking || cpu.isGrabBreakCountered || cpu.isGrabBreakSeparating) return true;
    
    return false;
  };
  
  if (!cpu._prevKeys) {
    cpu._prevKeys = { ...cpu.keys };
  }
  
  const prevKeys = cpu._prevKeys;
  const keyJustPressed = (key) => cpu.keys[key] && !prevKeys[key];
  
  // === GRAB BREAK - Process BEFORE shouldBlockAction check! ===
  // This is special because it needs to work WHILE being grabbed
  const GRAB_BREAK_STAMINA_COST = 33; // 33% of max stamina (match server constant)
  if (cpu.isBeingGrabbed && 
      keyJustPressed(" ") && 
      !cpu.isGrabBreaking &&
      cpu.stamina >= GRAB_BREAK_STAMINA_COST) {
    
    // Find the grabber
    const grabber = opponent;
    if (grabber && grabber.isGrabbing && grabber.grabbedOpponent === cpu.id) {
      console.log(`🛡️ CPU GRAB BREAK! Stamina: ${cpu.stamina}, breaking from ${grabber.id}`);
      
      // Deduct stamina
      cpu.stamina = Math.max(0, cpu.stamina - GRAB_BREAK_STAMINA_COST);
      
      // Clear grab states for both - use cleanupGrabStates from gameHelpers if available
      grabber.isGrabbing = false;
      grabber.grabbedOpponent = null;
      grabber.isThrowing = false;
      grabber.throwStartTime = 0;
      grabber.throwEndTime = 0;
      grabber.throwOpponent = null;
      grabber.grabCooldown = false;
      
      cpu.isBeingGrabbed = false;
      cpu.isBeingThrown = false;
      cpu.grabbedOpponent = null;
      cpu.throwOpponent = null;
      cpu.isHit = false;
      cpu.grabCooldown = false;
      
      // Animation state - breaker shows grab break
      cpu.isGrabBreaking = true;
      cpu.grabBreakSpaceConsumed = true;
      
      // Grabber shows countered animation
      grabber.isGrabBreaking = false;
      grabber.isGrabBreakCountered = true;
      
      // Calculate separation
      const GRAB_BREAK_PUSH_VELOCITY = 1.2;
      const GRAB_BREAK_SEPARATION_MULTIPLIER = 96;
      const separationDir = cpu.x < grabber.x ? -1 : 1;
      
      // Apply separation movement - use isGrabBreakSeparating to match index.js game loop
      cpu.isGrabBreakSeparating = true;
      cpu.grabBreakSepStartTime = currentTime;
      cpu.grabBreakSepDuration = 220;
      cpu.grabBreakStartX = cpu.x;
      cpu.grabBreakTargetX = cpu.x + separationDir * GRAB_BREAK_SEPARATION_MULTIPLIER;
      
      grabber.isGrabBreakSeparating = true;
      grabber.grabBreakSepStartTime = currentTime;
      grabber.grabBreakSepDuration = 220;
      grabber.grabBreakStartX = grabber.x;
      grabber.grabBreakTargetX = grabber.x - separationDir * GRAB_BREAK_SEPARATION_MULTIPLIER * 0.5;
      
      // Clear animation states after duration
      setPlayerTimeout(cpu.id, () => {
        cpu.isGrabBreaking = false;
        cpu.grabBreakSpaceConsumed = false;
      }, 300);
      
      setPlayerTimeout(grabber.id, () => {
        grabber.isGrabBreakCountered = false;
      }, 300);
      
      // Emit grab_break event for visual effect (same as player grab break)
      if (io && room) {
        io.in(room.id).emit("grab_break", {
          breakerId: cpu.id,
          grabberId: grabber.id,
          breakerX: cpu.x,
          grabberX: grabber.x,
          breakId: `grab-break-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
      }
      
      cpu._prevKeys = { ...cpu.keys };
      return;
    }
  }
  
  // === THROW PROCESSING - Must happen BEFORE general shouldBlockAction check ===
  // Throws need to work while grabbing, but shouldBlockAction() blocks when isGrabbing
  if (cpu.keys.w && 
      cpu.isGrabbing && 
      !cpu.isBeingGrabbed &&
      !cpu.keys.e &&
      !shouldBlockAction(true) && // Allow throw from grab
      !cpu.isThrowingSalt &&
      !cpu.canMoveToReady &&
      !cpu.throwCooldown &&
      !cpu.isRawParrying &&
      !cpu.isThrowing) {
    
    cpu.lastThrowAttemptTime = currentTime;
    
    const THROW_RANGE = Math.round(166 * 1.3);
    const throwRange = THROW_RANGE * (cpu.sizeMultiplier || 1);
    
    if (Math.abs(cpu.x - opponent.x) < throwRange && 
        !opponent.isBeingThrown && 
        !opponent.isDodging) {
      
      console.log(`CPU THROW EXECUTING! isGrabbing: ${cpu.isGrabbing}, facing: ${cpu.facing}`);
      
      clearChargeState(cpu, true);
      cpu.movementVelocity = 0;
      cpu.isStrafing = false;
      
      cpu.isThrowing = true;
      cpu.throwStartTime = currentTime;
      cpu.throwEndTime = currentTime + 400;
      cpu.throwOpponent = opponent.id;
      cpu.currentAction = "throw";
      cpu.actionLockUntil = currentTime + 200;
      
      opponent.isBeingThrown = true;
      opponent.isHit = false;
      
      if (cpu.isGrabbing) {
        cpu.isGrabbing = false;
        cpu.grabbedOpponent = null;
      }
      if (opponent.isBeingGrabbed) {
        opponent.isBeingGrabbed = false;
      }
      
      cpu.throwingFacingDirection = cpu.facing;
      opponent.beingThrownFacingDirection = -cpu.facing;
      
      cpu._prevKeys = { ...cpu.keys };
      return; // Only one action per tick
    }
  }
  
  // CRITICAL: If we're in any blocking state, don't process any inputs
  if (shouldBlockAction()) {
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  // Process slap attack
  if (keyJustPressed("mouse1") && canPlayerSlap(cpu) && !shouldBlockAction()) {
    executeSlapAttack(cpu, rooms);
    cpu._prevKeys = { ...cpu.keys };
    return; // Only one action per tick
  }
  
  // Process grab
  if (keyJustPressed("e") && 
      !cpu.isAttacking && 
      !cpu.isGrabbing && 
      !cpu.isBeingGrabbed && 
      !cpu.isDodging &&
      !cpu.grabCooldown &&
      !cpu.isGrabStartup &&
      !cpu.isGrabbingMovement &&
      !cpu.isWhiffingGrab &&
      !cpu.isRawParrying &&
      !cpu.isThrowing &&
      !shouldBlockAction() &&
      canPlayerUseAction(cpu)) {
    
    cpu.lastGrabAttemptTime = currentTime;
    clearChargeState(cpu, true);
    
    cpu.isGrabStartup = true;
    cpu.grabStartupStartTime = currentTime;
    cpu.grabStartupDuration = 220;
    cpu.currentAction = "grab_startup";
    cpu.actionLockUntil = currentTime + Math.min(120, 220);
    cpu.grabState = "attempting";
    cpu.grabAttemptType = "grab";
    cpu.movementVelocity = 0;
    cpu.isStrafing = false;
    
    setPlayerTimeout(cpu.id, () => {
      if (cpu.isGrabbingMovement && !cpu.grabbedOpponent) {
        cpu.isGrabbingMovement = false;
        cpu.isWhiffingGrab = true;
        cpu.grabMovementVelocity = 0;
        cpu.grabState = "initial";
        cpu.grabAttemptType = null;
        
        cpu.grabCooldown = true;
        setPlayerTimeout(cpu.id, () => {
          cpu.grabCooldown = false;
        }, 1100);
        
        setPlayerTimeout(cpu.id, () => {
          cpu.isWhiffingGrab = false;
        }, 200);
      }
    }, 750, "grabMovementTimeout");
    
    cpu._prevKeys = { ...cpu.keys };
    return; // Only one action per tick
  }
  
  // Process dodge - now uses stamina instead of charges
  if (keyJustPressed("shift") && 
      !cpu.keys.e &&
      !shouldBlockAction() &&
      canPlayerUseAction(cpu) &&
      cpu.stamina >= AI_CONFIG.DODGE_STAMINA_COST &&
      !cpu.isDodging) {
    
    cpu.isDodging = true;
    cpu.dodgeStartTime = currentTime;
    cpu.dodgeEndTime = currentTime + 450;
    cpu.dodgeStartX = cpu.x;
    cpu.dodgeStartY = cpu.y;
    
    // Drain stamina for dodge (15% of max stamina)
    cpu.stamina = Math.max(0, cpu.stamina - AI_CONFIG.DODGE_STAMINA_COST);
    
    if (cpu.keys.a) {
      cpu.dodgeDirection = -1;
    } else if (cpu.keys.d) {
      cpu.dodgeDirection = 1;
    } else {
      cpu.dodgeDirection = cpu.facing === -1 ? 1 : -1;
    }
    
    setPlayerTimeout(cpu.id, () => {
      cpu.isDodging = false;
      cpu.dodgeDirection = null;
    }, 450);
    
    cpu._prevKeys = { ...cpu.keys };
    return; // Only one action per tick
  }
  
  // Process raw parry
  if (keyJustPressed("s") && 
      canPlayerUseAction(cpu) &&
      !cpu.isRawParrying &&
      !cpu.isChargingAttack &&
      !cpu.isAttacking &&
      !shouldBlockAction()) {
    
    cpu.isRawParrying = true;
    cpu.rawParryStartTime = currentTime;
    cpu.rawParryMinDurationMet = false;
    
    cpu._prevKeys = { ...cpu.keys };
    return; // Only one action per tick
  }
  
  // Release parry
  if (!cpu.keys.s && cpu.isRawParrying) {
    cpu.isRawParrying = false;
    cpu.rawParryStartTime = 0;
  }
  
  // Process charge attack - only if not blocked
  if (cpu.keys.mouse2 && !shouldBlockAction() && canPlayerCharge(cpu)) {
    if (!cpu.isChargingAttack) {
      startCharging(cpu);
    }
    
    const chargeDuration = currentTime - cpu.chargeStartTime;
    cpu.chargeAttackPower = Math.min((chargeDuration / 750) * 100, 100);
    cpu.chargingFacingDirection = cpu.facing;
  }
  
  // Release charged attack
  if (!cpu.keys.mouse2 && cpu.isChargingAttack && !cpu.isDodging) {
    const chargePercentage = cpu.chargeAttackPower;
    
    if (chargePercentage >= 10) {
      executeChargedAttack(cpu, chargePercentage, rooms);
    }
    
    clearChargeState(cpu);
  }
  
  // Process F key power-ups (snowball and pumo army)
  if (keyJustPressed("f") && 
      (cpu.activePowerUp === "snowball" || cpu.activePowerUp === "pumo_army") &&
      !cpu.snowballCooldown &&
      !cpu.pumoArmyCooldown &&
      !cpu.isThrowingSnowball &&
      !cpu.isSpawningPumoArmy &&
      !cpu.isAttacking &&
      !cpu.isDodging &&
      !cpu.isThrowing &&
      !cpu.isBeingThrown &&
      !cpu.isGrabbing &&
      !cpu.isBeingGrabbed &&
      !cpu.isHit &&
      !cpu.isRawParryStun &&
      !cpu.isRawParrying &&
      !cpu.canMoveToReady &&
      !cpu.isChargingAttack) {
    
    console.log(`🎯 CPU F KEY PRESSED! Power-up: ${cpu.activePowerUp}`);
    
    if (cpu.activePowerUp === "snowball") {
      console.log(`🎯 CPU throwing snowball!`);
      
      // Set throwing state
      cpu.isThrowingSnowball = true;
      cpu.currentAction = "snowball";
      cpu.actionLockUntil = currentTime + 250;
      
      // Determine snowball direction based on position relative to opponent
      let snowballDirection;
      if (opponent) {
        snowballDirection = cpu.x < opponent.x ? 2 : -2;
      } else {
        snowballDirection = cpu.facing === 1 ? -2 : 2;
      }
      
      // Create snowball projectile
      const snowball = {
        id: Math.random().toString(36).substr(2, 9),
        x: cpu.x,
        y: cpu.y + 20,
        velocityX: snowballDirection,
        hasHit: false,
        ownerId: cpu.id,
      };
      
      cpu.snowballs.push(snowball);
      cpu.snowballCooldown = true;
      
      // Reset throwing state after animation
      setPlayerTimeout(cpu.id, () => {
        cpu.isThrowingSnowball = false;
        if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
          cpu.actionLockUntil = 0;
        }
      }, 500);
      
      cpu._prevKeys = { ...cpu.keys };
      return;
    } else if (cpu.activePowerUp === "pumo_army") {
      console.log(`🎯 CPU spawning pumo army!`);
      
      // Set spawning state
      cpu.isSpawningPumoArmy = true;
      cpu.currentAction = "pumo_army";
      cpu.actionLockUntil = currentTime + 400;
      
      cpu.movementVelocity = 0;
      cpu.isStrafing = false;
      
      // Determine army direction
      const armyDirection = cpu.facing === 1 ? -1 : 1;
      
      // Spawn multiple mini clones sequentially
      const numClones = 5;
      const spawnDelay = 1000;
      const startX = armyDirection === 1 ? 0 : 1150;
      const GROUND_LEVEL = 210; // Match server constant (was incorrectly 430!)
      
      for (let i = 0; i < numClones; i++) {
        setPlayerTimeout(cpu.id, () => {
          const clone = {
            id: Math.random().toString(36).substr(2, 9),
            x: startX,
            y: GROUND_LEVEL + 5,
            velocityX: armyDirection * 1.5,
            facing: armyDirection,
            isStrafing: true,
            isSlapAttacking: true,
            slapCooldown: 0,
            lastSlapTime: 0,
            spawnTime: Date.now(),
            lifespan: 3000,
            ownerId: cpu.id,
            ownerFighter: cpu.fighter,
            hasHit: false,
            size: 0.6,
          };
          cpu.pumoArmy.push(clone);
        }, i * spawnDelay);
      }
      
      cpu.pumoArmyCooldown = true;
      
      // Reset spawning state after animation
      setPlayerTimeout(cpu.id, () => {
        cpu.isSpawningPumoArmy = false;
        if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
          cpu.actionLockUntil = 0;
        }
      }, 800);
      
      cpu._prevKeys = { ...cpu.keys };
      return;
    }
  }
  
  cpu._prevKeys = { ...cpu.keys };
}

module.exports = {
  updateCPUAI,
  processCPUInputs,
  clearAIState,
  AI_CONFIG,
};

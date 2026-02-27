// CPU AI Module for Pumo Pumo - SUMO EXPERT
// Goal: Knock the opponent out of the dohyo (ring)
// Design philosophy: Human-like decision making with strategic reads, commitment,
// and intelligent grab system usage based on positioning and stamina.

// Map boundaries - must match server constants in gameUtils.js
const MAP_LEFT_BOUNDARY = 135;
const MAP_RIGHT_BOUNDARY = 930;
const MAP_CENTER = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
const MAP_WIDTH = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;

// AI Configuration - Tuned for expert sumo gameplay
const AI_CONFIG = {
  // Distance thresholds
  SLAP_RANGE: 119,         // Scaled for camera zoom (was 160)
  GRAB_RANGE: 148,         // Scaled for camera zoom (was 200)
  GRAB_APPROACH_RANGE: 185, // Scaled for camera zoom (was 250)
  MID_RANGE: 185,          // Scaled for camera zoom (was 250)
  CHARGED_ATTACK_RANGE: 259, // Scaled for camera zoom (was 350)
  
  // Edge/corner awareness
  EDGE_DANGER_ZONE: 89,    // Scaled for camera zoom (was 120)
  CORNER_CRITICAL_ZONE: 59, // Scaled for camera zoom (was 80)
  BACK_TO_BOUNDARY_THROW_ZONE: 148, // Scaled for camera zoom (was 200)
  
  // Reaction chances (0-1) — intentionally imperfect to feel human
  PARRY_CHANCE: 0.22,      // Base chance to parry incoming attacks (lowered from 0.28)
  DODGE_CHANCE: 0.16,      // Base chance to dodge instead of parry (lowered from 0.20)
  REACTION_MISS_CHANCE: 0.25, // Chance to completely miss reacting to an attack
  
  // Timing (ms)
  DECISION_COOLDOWN: 120,  // Minimum time between major decisions
  
  // Stamina thresholds
  GRAB_BREAK_STAMINA: 10,  // Stamina cost for grab break (equal for both players)
  DODGE_STAMINA_COST: 7,   // ~7% of max stamina per dodge
  LOW_STAMINA_THRESHOLD: 25, // Opponent considered low stamina
  
  // Movement
  STRAFE_CHANGE_INTERVAL: 350, // How often to change strafe direction
  
  // Charged attack limits
  MAX_CONSECUTIVE_CHARGED: 2,  // Max charged attacks before forcing other moves
  
  // Snowball defense
  SNOWBALL_THREAT_DISTANCE: 400,
  SNOWBALL_CLOSE_RANGE: 180,
  SNOWBALL_PARRY_CHANCE: 0.50,
  SNOWBALL_PERFECT_PARRY_CHANCE: 0.35,
  SNOWBALL_REACTION_DISTANCE: 250,

  // Commitment system — AI commits to action sequences instead of single moves
  COMMIT_SLAP_BURST_MIN: 2,   // Min slaps in a burst
  COMMIT_SLAP_BURST_MAX: 5,   // Max slaps in a burst
  COMMIT_BURST_CHANCE: 0.35,  // Chance to enter slap burst mode at close range
  
  // Aggression modes — shift AI personality periodically
  AGGRESSION_SHIFT_INTERVAL: 3000, // Re-roll aggression every 3s
  
  // Grab system intelligence
  GRAB_MID_SCREEN_CHANCE: 0.25, // Chance to grab at mid range (not just close)
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
      consecutiveChargedAttacks: 0,
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
      // Grab decision tracking
      grabDecisionMade: false,
      grabStrategy: null, // 'push', 'throw', 'pull'
      grabActionDelay: 0, // Reaction delay before executing pull/throw interrupt
      // Snowball defense tracking
      lastSnowballReactionTime: 0,
      // === NEW: Commitment system ===
      commitAction: null,      // 'slap_burst', 'aggressive_push', etc.
      commitCount: 0,          // How many actions left in commitment
      commitUntil: 0,          // Timestamp when commitment expires
      // === NEW: Aggression mode ===
      aggressionMode: 'balanced', // 'aggressive', 'balanced', 'defensive'
      aggressionShiftTime: 0,    // When to re-roll aggression
      // === NEW: Read system (preemptive actions instead of pure reactions) ===
      lastReadTime: 0,
      readCooldown: 0,
      // === NEW: Movement fluidity ===
      movementIntent: null,      // 'approach', 'retreat', 'feint', 'circle'
      movementIntentUntil: 0,
      lastMovementShiftTime: 0,
      // === Grab approach intent (walk into point-blank range before grabbing) ===
      grabApproachIntent: false,
      grabApproachIntentUntil: 0,
      // === Grab break REACT (not predict): wait for grab action, then 50/50 react ===
      grabBreakReactionDecided: false,
      grabBreakReactS: false,       // true = press S when we see throw
      grabBreakReactDirection: false, // true = press direction when we see pull
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

// Get distance to the boundary BEHIND the player (based on facing)
function distanceToBehind(player) {
  // facing === 1 means facing LEFT, so BEHIND is to the RIGHT
  // facing === -1 means facing RIGHT, so BEHIND is to the LEFT
  if (player.facing === 1) {
    return distanceToRightEdge(player);
  } else {
    return distanceToLeftEdge(player);
  }
}

// Get distance to the boundary IN FRONT of the player (opponent's side)
function distanceToFront(player) {
  if (player.facing === 1) {
    return distanceToLeftEdge(player);
  } else {
    return distanceToRightEdge(player);
  }
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
  return player.x < MAP_CENTER ? 1 : -1;
}

// Get direction toward opponent
function getDirectionToOpponent(cpu, human) {
  return cpu.x < human.x ? 1 : -1;
}

// Check if CPU is at point-blank grab range (within collision distance)
function isAtGrabRange(cpu, human) {
  return Math.abs(cpu.x - human.x) <= AI_CONFIG.GRAB_RANGE;
}

// Check if the opponent is in a state where a grab can actually connect
function isOpponentGrabbable(human) {
  return !human.isDodging &&
         !human.isBeingThrown &&
         !human.isBeingGrabbed &&
         !human.isGrabWhiffRecovery &&
         !human.isGrabTeching &&
         !human.isGrabBreaking &&
         !human.isGrabBreakSeparating;
}

// Check if the opponent is actively moving away from the CPU
function isOpponentRetreating(cpu, human) {
  if (!human.movementVelocity || Math.abs(human.movementVelocity) < 0.15) return false;
  const opponentIsRight = human.x > cpu.x;
  return opponentIsRight ? human.movementVelocity > 0.15 : human.movementVelocity < -0.15;
}

// Check if CPU is facing toward the opponent (required for grab to connect)
function isFacingOpponent(cpu, human) {
  // facing: 1 = facing left, -1 = facing right
  const opponentIsRight = human.x > cpu.x;
  return (cpu.facing === -1 && opponentIsRight) || (cpu.facing === 1 && !opponentIsRight);
}

// Smart grab viability: is this a good moment to grab?
function isGoodGrabOpportunity(cpu, human, distance) {
  if (!isOpponentGrabbable(human)) return false;
  if (!isFacingOpponent(cpu, human)) return false;

  // Opponent is committed to an action (attacking, parrying, recovering) — great time to grab
  if (human.isAttacking || human.isRawParrying || human.isRecovering || human.isHit) return true;
  // Opponent is stationary or moving toward us — grab will likely connect
  if (!isOpponentRetreating(cpu, human)) return true;
  // Opponent is retreating — only grab if we're very close (startup won't let them escape)
  if (isOpponentRetreating(cpu, human) && distance <= AI_CONFIG.GRAB_RANGE * 0.7) return true;
  return false;
}

// Try to grab if at point-blank range, otherwise walk toward opponent to close the gap.
// Returns true if the AI committed to an action (grab or approach), false if not close enough to even approach.
function attemptGrabOrApproach(cpu, human, aiState, currentTime, distance) {
  if (!isOpponentGrabbable(human) || !isFacingOpponent(cpu, human)) return false;

  if (isAtGrabRange(cpu, human) && canGrab(cpu) && isGoodGrabOpportunity(cpu, human, distance)) {
    cpu.keys.mouse2 = true;
    aiState.mouse2ReleaseTime = currentTime + 50;
    aiState.lastDecisionTime = currentTime;
    return 'grabbed';
  } else if (distance < AI_CONFIG.GRAB_APPROACH_RANGE && canGrab(cpu)) {
    // Only start an approach if opponent isn't sprinting away
    if (isOpponentRetreating(cpu, human) && distance > AI_CONFIG.GRAB_RANGE) return false;
    const dir = getDirectionToOpponent(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.grabApproachIntent = true;
    aiState.grabApproachIntentUntil = currentTime + 400;
    aiState.lastDecisionTime = currentTime;
    return 'approaching';
  }
  return false;
}

// Random chance check
function chance(probability) {
  return Math.random() < probability;
}

// Random number in range
function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// === NEW: Roll aggression mode periodically ===
function updateAggressionMode(aiState, currentTime) {
  if (currentTime > aiState.aggressionShiftTime) {
    const roll = Math.random();
    if (roll < 0.35) {
      aiState.aggressionMode = 'aggressive';
    } else if (roll < 0.75) {
      aiState.aggressionMode = 'balanced';
    } else {
      aiState.aggressionMode = 'defensive';
    }
    // Vary the re-roll interval so it's not perfectly periodic
    aiState.aggressionShiftTime = currentTime + AI_CONFIG.AGGRESSION_SHIFT_INTERVAL + randomInRange(-800, 800);
  }
}

// === NEW: Get aggression multiplier for action chances ===
function getAggressionMultiplier(aiState) {
  switch (aiState.aggressionMode) {
    case 'aggressive': return { attack: 1.4, defense: 0.6, grab: 1.3 };
    case 'defensive': return { attack: 0.7, defense: 1.4, grab: 0.8 };
    default: return { attack: 1.0, defense: 1.0, grab: 1.0 };
  }
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
         !cpu.isInStartupFrames &&
         !cpu.isGrabStartup &&
         !cpu.isWhiffingGrab &&
         !cpu.isGrabWhiffRecovery &&
         !cpu.isGrabTeching &&
         !cpu.isGrabbingMovement &&
         !cpu.isBeingGrabbed &&
         !cpu.isGrabBreaking &&
         !cpu.isGrabBreakCountered &&
         !cpu.isGrabBreakSeparating &&
         !cpu.isGrabClashing &&
         !cpu.isAttacking &&
         !cpu.isGrabbing &&
         !cpu.isChargingAttack &&
         !cpu.isRawParrying &&
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
         !cpu.grabCooldown &&
         !cpu.isGrabWhiffRecovery &&
         !cpu.isGrabTeching &&
         !cpu.isGrabStartup;
}

// Check if CPU can dodge
function canDodge(cpu) {
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
         !cpu.isInStartupFrames &&
         !cpu.isGrabStartup &&
         !cpu.isWhiffingGrab &&
         !cpu.isGrabbingMovement &&
         !cpu.isBeingGrabbed &&
         !cpu.isGrabBreaking &&
         !cpu.isGrabBreakCountered &&
         !cpu.isGrabBreakSeparating &&
         !cpu.isGrabClashing &&
         !cpu.isAttacking &&
         !cpu.isGrabbing &&
         !cpu.isRawParrying &&
         !isOnCooldown &&
         !isInputLocked &&
         !isActionLocked &&
         !cpu.isGassed;
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

// Detect incoming snowballs that threaten the CPU
function getThreateningSnowballs(cpu, human) {
  if (!human.snowballs || human.snowballs.length === 0) {
    return [];
  }
  
  return human.snowballs.filter(snowball => {
    if (snowball.hasHit) return false;
    const isMovingTowardCPU = (snowball.velocityX > 0 && snowball.x < cpu.x) || 
                               (snowball.velocityX < 0 && snowball.x > cpu.x);
    if (!isMovingTowardCPU) return false;
    const distance = Math.abs(snowball.x - cpu.x);
    return distance < AI_CONFIG.SNOWBALL_THREAT_DISTANCE;
  });
}

function getClosestSnowball(cpu, human) {
  const threats = getThreateningSnowballs(cpu, human);
  if (threats.length === 0) return null;
  threats.sort((a, b) => Math.abs(a.x - cpu.x) - Math.abs(b.x - cpu.x));
  return threats[0];
}

function getSnowballTimeToImpact(cpu, snowball) {
  if (!snowball) return Infinity;
  const distance = Math.abs(snowball.x - cpu.x);
  const speed = Math.abs(snowball.velocityX);
  if (speed === 0) return Infinity;
  return (distance / speed) * 16;
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
  if (aiState.mouse2ReleaseTime > 0 && currentTime >= aiState.mouse2ReleaseTime) {
    cpu.keys.mouse2 = false;
    aiState.mouse2ReleaseTime = 0;
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
  
  // === UPDATE AGGRESSION MODE ===
  updateAggressionMode(aiState, currentTime);
  
  // HIGHEST PRIORITY: DI (Directional Influence) - Reduce knockback by holding opposite direction!
  if (cpu.isHit && cpu.knockbackVelocity && Math.abs(cpu.knockbackVelocity.x) > 0.1) {
    handleKnockbackDI(cpu, aiState, currentTime);
  }
  
  // GRAB CLASH HANDLING - CPU needs to mash inputs to win!
  if (cpu.isGrabClashing) {
    handleGrabClashMashing(cpu, aiState, currentTime);
    return;
  }
  const distance = getDistance(cpu, human);
  
  // Initialize keys object if needed
  if (!cpu.keys) {
    cpu.keys = createEmptyKeys();
  }
  
  // Handle pending key releases
  handlePendingKeyReleases(cpu, aiState, currentTime);
  
  // Cancel grab approach if situation changed (hit, grabbed, opponent dodging/retreating/ungrabable)
  if (aiState.grabApproachIntent && (
    cpu.isHit || cpu.isBeingGrabbed || cpu.isBeingThrown ||
    human.isAttacking || human.isDodging || !isOpponentGrabbable(human) ||
    !isFacingOpponent(cpu, human)
  )) {
    aiState.grabApproachIntent = false;
  }

  // GRAB APPROACH: If AI is walking in for a grab, keep going until in range or expired
  if (aiState.grabApproachIntent && currentTime < aiState.grabApproachIntentUntil && canGrab(cpu)) {
    if (isAtGrabRange(cpu, human)) {
      // Reached point-blank — only execute if it's still a good opportunity
      if (isGoodGrabOpportunity(cpu, human, Math.abs(cpu.x - human.x))) {
        resetAllKeys(cpu);
        cpu.keys.mouse2 = true;
        aiState.mouse2ReleaseTime = currentTime + 50;
        aiState.grabApproachIntent = false;
        aiState.lastDecisionTime = currentTime;
        aiState.lastActionType = "grab_approach_execute";
        return;
      } else {
        aiState.grabApproachIntent = false;
      }
    } else {
      // Keep walking toward opponent
      resetAllKeys(cpu);
      const dir = getDirectionToOpponent(cpu, human);
      if (dir === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return;
    }
  } else if (aiState.grabApproachIntent) {
    // Timer expired or can't grab — cancel approach
    aiState.grabApproachIntent = false;
  }

  // HIGHEST PRIORITY: If currently grabbing, execute grab strategy
  if (cpu.isGrabbing && cpu.grabbedOpponent) {
    aiState.grabStartedTime = 0;
    handleGrabDecision(cpu, human, aiState, currentTime);
    return;
  } else {
    aiState.grabDecisionMade = false;
    aiState.grabStrategy = null;
    aiState.grabActionDelay = 0;
  }
  
  // Priority 1: Handle being grabbed - try to break free
  if (cpu.isBeingGrabbed && !cpu.isBeingThrown) {
    handleGrabBreak(cpu, human, aiState, currentTime);
    return;
  } else {
    aiState.grabStartedTime = 0;
    aiState.grabBreakReactionDecided = false;
    aiState.grabBreakReactS = false;
    aiState.grabBreakReactDirection = false;
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
  
  // Priority 1.5: Use power-up EARLY
  if (handlePowerUpUsage(cpu, human, aiState, currentTime, distance)) {
    return;
  }
  
  // Priority 2: ESCAPE CORNER
  const corneredSide = getCorneredSide(cpu);
  if (corneredSide !== 0 && canAct(cpu)) {
    if (handleCornerEscape(cpu, human, aiState, currentTime, distance, corneredSide)) {
      return;
    }
  }
  
  // Priority 2.5: SNOWBALL DEFENSE
  if (canAct(cpu) && (canDodge(cpu) || canParry(cpu))) {
    if (handleSnowballDefense(cpu, human, aiState, currentTime, distance)) {
      return;
    }
  }
  
  // Priority 3: React to opponent attacks — BUT NOT ALWAYS (human-like)
  // Sometimes the AI just doesn't react, or makes a "read" instead
  if (human.isAttacking && !human.isInStartupFrames && canParry(cpu)) {
    // Roll a miss chance — sometimes the CPU just doesn't react (feels human)
    if (!chance(AI_CONFIG.REACTION_MISS_CHANCE)) {
      if (handleDefensiveReaction(cpu, human, aiState, currentTime, distance)) {
        return;
      }
    }
    // If we "missed" the reaction, fall through to offensive actions
    // This means sometimes the CPU gets hit because it was trying to attack instead of defend
  }
  
  // Priority 3.5: PUNISH OPPONENT PARRYING — walk in and grab if needed
  if (human.isRawParrying && !cpu.isAttacking && distance < AI_CONFIG.GRAB_APPROACH_RANGE && canGrab(cpu)) {
    resetAllKeys(cpu);
    const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
    if (result) {
      aiState.lastActionType = "punish_grab";
      return;
    }
  }
  
  // Priority 4: COMMITMENT SYSTEM — if in a burst, continue it
  if (aiState.commitAction && currentTime < aiState.commitUntil && aiState.commitCount > 0) {
    if (handleCommitment(cpu, human, aiState, currentTime, distance)) {
      return;
    }
  }
  
  // Priority 5: Handle charging attack
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
    if (distance < AI_CONFIG.SLAP_RANGE) {
      handleCloseRange(cpu, human, aiState, currentTime, distance);
    } else if (distance < AI_CONFIG.MID_RANGE) {
      handleMidRange(cpu, human, aiState, currentTime, distance);
    } else {
      handleFarRange(cpu, human, aiState, currentTime, distance);
    }
  } else {
    handleMovement(cpu, human, aiState, currentTime, distance);
  }
}

// Handle grab clash mashing
function handleGrabClashMashing(cpu, aiState, currentTime) {
  if (!aiState.grabClashLastMashTime) {
    aiState.grabClashLastMashTime = 0;
    aiState.grabClashCurrentKey = null;
  }
  
  const MASH_INTERVAL = 70;
  const mashKeys = ['w', 'a', 's', 'd', 'mouse1', 'mouse2'];
  
  if (currentTime - aiState.grabClashLastMashTime >= MASH_INTERVAL) {
    resetAllKeys(cpu);
    const keyIndex = Math.floor(Math.random() * mashKeys.length);
    const key = mashKeys[keyIndex];
    cpu.keys[key] = true;
    aiState.grabClashCurrentKey = key;
    aiState.grabClashLastMashTime = currentTime;
  }
}

// Handle grab break by REACTING to the grab action (no prediction).
// While being grabbed, CPU does not press any counter key until it sees the grab action (W throw or A/D pull).
// 500ms window: when human does W (throw) → 50% CPU presses S; when human does A/D (pull) → 50% CPU presses correct direction.
function handleGrabBreak(cpu, grabber, aiState, currentTime) {
  if (!cpu.isBeingGrabbed || cpu.grabCounterAttempted) return;

  // Pull counter key is determined by GRABBER's facing (matches server: counterKey = player.facing === -1 ? 'd' : 'a')
  const pullCounterKey = grabber.facing === -1 ? 'd' : 'a';

  // No grab action yet (grabber is just pushing) — do not input anything until we see throw or pull
  if (!grabber.isAttemptingGrabThrow && !grabber.isAttemptingPull) {
    aiState.grabBreakReactionDecided = false;
    aiState.grabBreakReactS = false;
    aiState.grabBreakReactDirection = false;
    resetAllKeys(cpu);
    return;
  }

  // We see a grab action — react once (50/50) with the correct counter
  resetAllKeys(cpu);

  if (grabber.isAttemptingGrabThrow) {
    if (!aiState.grabBreakReactionDecided) {
      aiState.grabBreakReactionDecided = true;
      aiState.grabBreakReactS = Math.random() < 0.50; // 50% press S
    }
    if (aiState.grabBreakReactS) cpu.keys.s = true;
  } else if (grabber.isAttemptingPull) {
    if (!aiState.grabBreakReactionDecided) {
      aiState.grabBreakReactionDecided = true;
      aiState.grabBreakReactDirection = Math.random() < 0.50; // 50% press direction
    }
    if (aiState.grabBreakReactDirection) cpu.keys[pullCounterKey] = true;
  }
}

// DI (Directional Influence)
function handleKnockbackDI(cpu, aiState, currentTime) {
  const knockbackDirection = cpu.knockbackVelocity.x > 0 ? 1 : -1;
  if (knockbackDirection > 0) {
    cpu.keys.a = true;
    cpu.keys.d = false;
  } else {
    cpu.keys.a = false;
    cpu.keys.d = true;
  }
  aiState.lastActionType = "knockback_di";
}

// PUNISH: Grab opponent while they're stuck in parry animation
function handlePunishParry(cpu, human, aiState, currentTime) {
  resetAllKeys(cpu);
  cpu.keys.mouse2 = true;
  aiState.mouse2ReleaseTime = currentTime + 50;
  aiState.lastDecisionTime = currentTime;
  aiState.lastActionType = "punish_grab";
}

// Handle power-up usage (F key)
function handlePowerUpUsage(cpu, human, aiState, currentTime, distance) {
  const hasSnowball = cpu.activePowerUp === "snowball" && !cpu.snowballCooldown && !cpu.isThrowingSnowball;
  const hasPumoArmy = cpu.activePowerUp === "pumo_army" && !cpu.pumoArmyCooldown && !cpu.isSpawningPumoArmy;
  
  if (!hasSnowball && !hasPumoArmy) return false;
  
  if (cpu.isAttacking || cpu.isGrabbing || cpu.isBeingGrabbed || 
      cpu.isThrowing || cpu.isBeingThrown || cpu.isDodging ||
      cpu.isHit || cpu.isRawParryStun || cpu.isRecovering ||
      cpu.isThrowingSnowball || cpu.isSpawningPumoArmy) {
    return false;
  }
  
  const powerUpCooldown = hasSnowball ? 800 : 300;
  if (currentTime - aiState.lastPowerUpTime < powerUpCooldown) return false;
  
  if (hasSnowball) {
    resetAllKeys(cpu);
    cpu.keys.f = true;
    aiState.fReleaseTime = currentTime + 150;
    aiState.lastPowerUpTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "snowball";
    return true;
  }
  
  if (hasPumoArmy) {
    resetAllKeys(cpu);
    cpu.keys.f = true;
    aiState.fReleaseTime = currentTime + 150;
    aiState.lastPowerUpTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "pumo_army";
    return true;
  }
  
  return false;
}

// CRITICAL: Handle escaping from corner
function handleCornerEscape(cpu, human, aiState, currentTime, distance, corneredSide) {
  resetAllKeys(cpu);
  
  const escapeDirection = -corneredSide;
  const distToBackBoundary = corneredSide === -1 ? distanceToLeftEdge(cpu) : distanceToRightEdge(cpu);
  const veryCloseToBackBoundary = distToBackBoundary < 100;
  
  if (distance < AI_CONFIG.SLAP_RANGE) {
    const roll = Math.random();
    const aggMult = getAggressionMultiplier(aiState);
    
    // When back is very close, heavily favor grab (throw sends them behind us = ring-out)
    if (veryCloseToBackBoundary && canGrab(cpu)) {
      if (roll < 0.65 * aggMult.grab) {
        const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
        if (result) {
          aiState.lastActionType = "grab_corner_throw";
          return true;
        }
      }
    }
    
    if (roll < 0.30 && canDodge(cpu)) {
      cpu.keys.shift = true;
      if (escapeDirection === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.shiftReleaseTime = currentTime + 80;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "dodge_escape";
      return true;
    } else if (roll < 0.55 && canGrab(cpu)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab";
        return true;
      }
    }
    if (canAttack(cpu)) {
      // Sometimes commit to a slap burst to push them back
      if (chance(0.3)) {
        startCommitment(aiState, 'slap_burst', randomInRange(2, 4), currentTime);
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return true;
    }
  } else {
    // Move toward center
    if (escapeDirection === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastDecisionTime = currentTime;
    return true;
  }
  
  return false;
}

// Handle ring-out opportunity when opponent is near edge
function handleRingOutOpportunity(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  const roll = Math.random();
  const aggMult = getAggressionMultiplier(aiState);
  
  if (distance < AI_CONFIG.SLAP_RANGE && canAttack(cpu)) {
    // Smart grab decision: if opponent low stamina, grab is almost guaranteed win via push
    const opponentLowStamina = human.stamina < AI_CONFIG.LOW_STAMINA_THRESHOLD;
    const grabChance = opponentLowStamina ? 0.60 : 0.40;
    
    if (roll < grabChance * aggMult.grab && canGrab(cpu)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab";
        return;
      }
    }
    if (roll < 0.85 * aggMult.attack) {
      // Slap burst — commit to pushing them off!
      if (chance(0.45)) {
        startCommitment(aiState, 'slap_burst', randomInRange(3, 5), currentTime);
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return;
    } else if (aiState.consecutiveChargedAttacks < AI_CONFIG.MAX_CONSECUTIVE_CHARGED) {
      cpu.keys.mouse1 = true;
      cpu.mouse1PressTime = currentTime; // Set press time for threshold detection
      aiState.isChargingIntentional = true;
      aiState.chargeStartTime = currentTime;
      aiState.targetChargeTime = randomInRange(300, 500);
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "charge";
      return;
    } else {
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return;
    }
  }
  
  // Too far — approach aggressively, sometimes dodge-in
  const dirToOpponent = getDirectionToOpponent(cpu, human);
  if (distance < AI_CONFIG.MID_RANGE + 50 && canDodge(cpu) && chance(0.20)) {
    // Dodge toward opponent to close gap fast
    cpu.keys.shift = true;
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.shiftReleaseTime = currentTime + 80;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "dodge_approach";
  } else {
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
  }
}

// Handle defensive reactions — with imperfect human-like response
function handleDefensiveReaction(cpu, human, aiState, currentTime, distance) {
  // Reaction cooldown
  if (currentTime - aiState.lastAttackReactionTime < 250) {
    return false;
  }
  
  const attackRange = human.attackType === "slap" ? 180 : 280;
  if (distance > attackRange) return false;
  
  const aggMult = getAggressionMultiplier(aiState);
  const roll = Math.random();
  
  // In aggressive mode, sometimes trade hits instead of defending
  if (aiState.aggressionMode === 'aggressive' && distance < AI_CONFIG.SLAP_RANGE && canAttack(cpu) && roll < 0.30) {
    // Trade! Attack through the opponent's attack instead of defending
    resetAllKeys(cpu);
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "trade_slap";
    return true;
  }
  
  const parryChance = AI_CONFIG.PARRY_CHANCE * aggMult.defense;
  const dodgeChance = AI_CONFIG.DODGE_CHANCE * aggMult.defense;
  
  if (roll < parryChance && canParry(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.s = true;
    aiState.lastAttackReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.pendingParry = true;
    aiState.parryStartTime = currentTime;
    aiState.parryReleaseTime = currentTime + randomInRange(180, 350);
    return true;
  } else if (roll < parryChance + dodgeChance && canDodge(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.shift = true;
    
    // Smart dodge away from boundaries
    const cpuLeftDist = distanceToLeftEdge(cpu);
    const cpuRightDist = distanceToRightEdge(cpu);
    const nearestEdge = cpuLeftDist < cpuRightDist ? 'left' : 'right';
    const distToNearestEdge = Math.min(cpuLeftDist, cpuRightDist);
    
    if (distToNearestEdge < 250) {
      if (nearestEdge === 'left') cpu.keys.d = true;
      else cpu.keys.a = true;
    } else {
      // Mix it up — sometimes dodge toward, sometimes away
      if (chance(0.6)) {
        // Dodge away from opponent
        const intendedDir = cpu.x < human.x ? -1 : 1;
        if (intendedDir === -1) cpu.keys.a = true;
        else cpu.keys.d = true;
      } else {
        // Dodge THROUGH opponent (aggressive dodge)
        const dirToOpponent = getDirectionToOpponent(cpu, human);
        if (dirToOpponent === 1) cpu.keys.d = true;
        else cpu.keys.a = true;
      }
    }
    
    aiState.lastAttackReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.shiftReleaseTime = currentTime + 80;
    return true;
  }
  
  return false;
}

// Handle snowball defense
function handleSnowballDefense(cpu, human, aiState, currentTime, distance) {
  const closestSnowball = getClosestSnowball(cpu, human);
  if (!closestSnowball) return false;
  
  const snowballDistance = Math.abs(closestSnowball.x - cpu.x);
  const isUrgent = snowballDistance < AI_CONFIG.SNOWBALL_REACTION_DISTANCE;
  if (!isUrgent) return false;
  
  if (distance < AI_CONFIG.SNOWBALL_CLOSE_RANGE) {
    if (snowballDistance > 150) return false;
  }
  
  if (aiState.lastSnowballReactionTime && currentTime - aiState.lastSnowballReactionTime < 300) {
    return false;
  }
  
  const roll = Math.random();
  const parryChance = distance > AI_CONFIG.MID_RANGE ? 
    AI_CONFIG.SNOWBALL_PARRY_CHANCE * 0.85 :
    AI_CONFIG.SNOWBALL_PARRY_CHANCE;
  
  if (roll < parryChance && canParry(cpu)) {
    resetAllKeys(cpu);
    const perfectParryRoll = Math.random();
    
    if (perfectParryRoll < AI_CONFIG.SNOWBALL_PERFECT_PARRY_CHANCE) {
      const timeToImpact = getSnowballTimeToImpact(cpu, closestSnowball);
      const perfectParryWindow = 120;
      cpu.keys.s = true;
      aiState.pendingParry = true;
      aiState.parryStartTime = currentTime;
      aiState.parryReleaseTime = currentTime + Math.max(timeToImpact - perfectParryWindow, 50);
    } else {
      cpu.keys.s = true;
      aiState.pendingParry = true;
      aiState.parryStartTime = currentTime;
      aiState.parryReleaseTime = currentTime + randomInRange(250, 400);
    }
    
    aiState.lastSnowballReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "snowball_parry";
    return true;
    
  } else if (canDodge(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.shift = true;
    
    const directionToOpponent = getDirectionToOpponent(cpu, human);
    
    if (distance > AI_CONFIG.MID_RANGE) {
      if (directionToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
    } else {
      const cpuLeftDist = distanceToLeftEdge(cpu);
      const cpuRightDist = distanceToRightEdge(cpu);
      const nearestEdge = cpuLeftDist < cpuRightDist ? 'left' : 'right';
      const distToNearestEdge = Math.min(cpuLeftDist, cpuRightDist);
      
      if (distToNearestEdge < 250) {
        if (nearestEdge === 'left') cpu.keys.d = true;
        else cpu.keys.a = true;
      } else {
        if (directionToOpponent === 1) cpu.keys.d = true;
        else cpu.keys.a = true;
      }
    }
    
    aiState.shiftReleaseTime = currentTime + 80;
    aiState.lastSnowballReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "snowball_dodge";
    return true;
  }
  
  return false;
}

// === NEW: Start a commitment (burst of actions) ===
function startCommitment(aiState, action, count, currentTime) {
  aiState.commitAction = action;
  aiState.commitCount = count;
  aiState.commitUntil = currentTime + count * 250 + 500; // Buffer time
}

// === NEW: Handle committed action sequences ===
function handleCommitment(cpu, human, aiState, currentTime, distance) {
  if (aiState.commitAction === 'slap_burst') {
    if (distance < AI_CONFIG.SLAP_RANGE + 30 && canAttack(cpu)) {
      resetAllKeys(cpu);
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "committed_slap";
      aiState.commitCount--;
      if (aiState.commitCount <= 0) {
        aiState.commitAction = null;
      }
      // Keep approaching while slapping
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    } else if (distance < AI_CONFIG.SLAP_RANGE + 80) {
      // Close enough — approach to get back in range
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    } else {
      // Too far, abandon commitment
      aiState.commitAction = null;
      aiState.commitCount = 0;
      return false;
    }
  }
  
  return false;
}

// === Handle grab decision with position-aware strategy ===
// Push sends opponent toward the boundary CPU is facing.
// Throw (W) sends opponent behind CPU. Pull (backward) switches sides.
// Key rules:
//   - If push would pin opponent at the front edge → ALWAYS push (never interrupt)
//   - Only throw/pull if CPU's back is near the boundary (escape the edge)
//   - In the middle → push (favored) or pull occasionally
function handleGrabDecision(cpu, human, aiState, currentTime) {
  const cpuFacingLeft = cpu.facing === 1;
  
  cpu.keys.a = false;
  cpu.keys.d = false;
  cpu.keys.w = false;
  cpu.keys.s = false;
  cpu.keys.shift = false;
  cpu.keys.e = false;
  cpu.keys.mouse1 = false;
  cpu.keys.mouse2 = false;
  
  if (cpu.isAttemptingGrabThrow || cpu.isAttemptingPull) {
    return;
  }
  
  if (!cpu.grabStartTime) return;
  
  if (!aiState.grabDecisionMade) {
    aiState.grabDecisionMade = true;
    
    const distBehind = distanceToBehind(cpu);
    const distFront = distanceToFront(cpu);
    
    const EDGE_PIN_THRESHOLD = 280;
    const BACK_DANGER_THRESHOLD = 250;
    
    if (distFront < EDGE_PIN_THRESHOLD) {
      // Push will pin opponent at the front edge — never interrupt, just let it ride
      aiState.grabStrategy = 'push';
    } else if (distBehind < BACK_DANGER_THRESHOLD) {
      // CPU's back is near the boundary — throw or pull to escape the edge
      let throwScore = 50 + randomInRange(0, 20);
      let pullScore = 40 + randomInRange(0, 20);
      
      if (distBehind < 150) throwScore += 15;
      
      const aggMult = getAggressionMultiplier(aiState);
      throwScore *= aggMult.grab;
      pullScore *= aggMult.grab;
      
      aiState.grabStrategy = throwScore >= pullScore ? 'throw' : 'pull';
    } else {
      // Middle of the map — push (favored) or pull as a mix-up
      let pushScore = 55 + randomInRange(0, 20);
      let pullScore = 30 + randomInRange(0, 20);
      
      const aggMult = getAggressionMultiplier(aiState);
      pushScore *= aggMult.attack;
      pullScore *= aggMult.grab;
      
      aiState.grabStrategy = pushScore >= pullScore ? 'push' : 'pull';
    }
    
    aiState.grabActionDelay = currentTime + randomInRange(200, 350);
  }
  
  if (aiState.grabStrategy === 'push') {
    return;
  }
  
  if (currentTime < (aiState.grabActionDelay || 0)) {
    return;
  }
  
  if (aiState.grabStrategy === 'throw') {
    cpu.keys.w = true;
  } else if (aiState.grabStrategy === 'pull') {
    const backwardKey = cpuFacingLeft ? 'd' : 'a';
    cpu.keys[backwardKey] = true;
  }
}

// Handle charging attack logic
function handleChargeAttack(cpu, human, aiState, currentTime, distance) {
  const chargeElapsed = currentTime - aiState.chargeStartTime;
  
  if (chargeElapsed >= aiState.targetChargeTime || 
      distance < AI_CONFIG.SLAP_RANGE - 30 ||
      human.isDodging) {
    cpu.keys.mouse1 = false;
    cpu.mouse1PressTime = 0;
    aiState.isChargingIntentional = false;
    aiState.consecutiveChargedAttacks++;
  } else {
    cpu.keys.mouse1 = true;
    if (!cpu.mouse1PressTime) cpu.mouse1PressTime = currentTime;
  }
}

// === OVERHAULED: Close range combat — commit to actions, don't always back off ===
function handleCloseRange(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  aiState.consecutiveChargedAttacks = 0;
  
  const roll = Math.random();
  const aggMult = getAggressionMultiplier(aiState);
  const opponentLow = human.stamina < AI_CONFIG.LOW_STAMINA_THRESHOLD;
  
  // GRABS when opponent is near edge — especially with low stamina
  if (isOpponentNearEdge(human) && canGrab(cpu)) {
    const grabChance = opponentLow ? 0.55 : 0.40;
    if (roll < grabChance * aggMult.grab) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab";
        return;
      }
    }
  }
  
  // MID-SCREEN GRABS — use them more often but not always (must be point-blank)
  if (roll < 0.22 * aggMult.grab && canGrab(cpu)) {
    const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
    if (result) {
      aiState.lastActionType = "grab";
      return;
    }
  }
  
  // SLAP BURST — commit to multiple slaps in a row (aggressive pressure)
  if (roll < 0.22 + AI_CONFIG.COMMIT_BURST_CHANCE * aggMult.attack && canAttack(cpu)) {
    const burstCount = randomInRange(AI_CONFIG.COMMIT_SLAP_BURST_MIN, AI_CONFIG.COMMIT_SLAP_BURST_MAX);
    startCommitment(aiState, 'slap_burst', burstCount, currentTime);
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap_burst_start";
    // Walk forward while slapping
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    return;
  }
  
  // SINGLE SLAP — still the bread and butter
  if (roll < 0.88 * aggMult.attack && canAttack(cpu)) {
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap";
    // Sometimes keep approaching while slapping (pressure)
    if (chance(0.4)) {
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
    }
    return;
  }
  
  // Occasionally back off (but less often than before)
  if (chance(0.5)) {
    // Back off
    const dirAway = cpu.x < human.x ? -1 : 1;
    if (dirAway === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
  } else {
    // Or just stand ground / slight movement
    handleMovement(cpu, human, aiState, currentTime, distance);
  }
  aiState.lastDecisionTime = currentTime;
}

// === OVERHAULED: Mid range — more grabs, more approach aggression ===
function handleMidRange(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  const roll = Math.random();
  const aggMult = getAggressionMultiplier(aiState);
  const opponentLow = human.stamina < AI_CONFIG.LOW_STAMINA_THRESHOLD;
  
  // MID-SCREEN GRABS — walk into range, then grab
  if (distance < AI_CONFIG.GRAB_APPROACH_RANGE && canGrab(cpu)) {
    const grabChance = opponentLow ? 0.35 : AI_CONFIG.GRAB_MID_SCREEN_CHANCE;
    if (roll < grabChance * aggMult.grab) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab_mid";
        return;
      }
    }
  }
  
  // If on the closer end of mid-range, throw slaps
  if (distance < 200 && canAttack(cpu) && roll < 0.45 * aggMult.attack) {
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap";
    // Keep approaching
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    return;
  }
  
  // Aggressive approach (dominant behavior)
  if (roll < 0.55) {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    // Sometimes dash in with dodge for fast approach
    if (canDodge(cpu) && chance(0.15) && aiState.aggressionMode === 'aggressive') {
      cpu.keys.shift = true;
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.shiftReleaseTime = currentTime + 80;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "dodge_approach";
      return;
    }
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  // Dynamic strafing
  else if (roll < 0.68) {
    handleMovement(cpu, human, aiState, currentTime, distance);
  }
  // Charged attack (occasionally)
  else if (roll < 0.82 && canAttack(cpu) && aiState.consecutiveChargedAttacks < AI_CONFIG.MAX_CONSECUTIVE_CHARGED) {
    cpu.keys.mouse1 = true;
    cpu.mouse1PressTime = currentTime;
    aiState.isChargingIntentional = true;
    aiState.chargeStartTime = currentTime;
    aiState.targetChargeTime = randomInRange(350, 600);
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "charge";
  } else {
    // Approach
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  
  aiState.lastDecisionTime = currentTime;
}

// Far range — approach with occasional charged attacks
function handleFarRange(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  const roll = Math.random();
  
  // Mostly approach (75%)
  if (roll < 0.75) {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    // Occasionally dash in
    if (canDodge(cpu) && chance(0.12)) {
      cpu.keys.shift = true;
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.shiftReleaseTime = currentTime + 80;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "dodge_approach";
      return;
    }
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  // Charged attack (15%)
  else if (roll < 0.90 && 
           distance >= AI_CONFIG.CHARGED_ATTACK_RANGE && 
           canAttack(cpu) && 
           aiState.consecutiveChargedAttacks < AI_CONFIG.MAX_CONSECUTIVE_CHARGED) {
    cpu.keys.mouse1 = true;
    cpu.mouse1PressTime = currentTime;
    aiState.isChargingIntentional = true;
    aiState.chargeStartTime = currentTime;
    aiState.targetChargeTime = randomInRange(500, 900);
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "charge";
  }
  // Just approach
  else {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  }
  
  aiState.lastDecisionTime = currentTime;
}

// === OVERHAULED: Smart movement — more fluid, less predictable ===
function handleMovement(cpu, human, aiState, currentTime, distance) {
  if (cpu.isAttacking || cpu.isGrabbing || cpu.isDodging || cpu.isRawParrying) {
    return;
  }
  
  cpu.keys.a = false;
  cpu.keys.d = false;
  
  // Change strafe direction periodically with some variation
  const strafeInterval = AI_CONFIG.STRAFE_CHANGE_INTERVAL + randomInRange(-100, 100);
  if (currentTime - aiState.lastStrafeChangeTime > strafeInterval) {
    aiState.lastStrafeChangeTime = currentTime;
    
    // Pick a movement intent based on situation
    const roll = Math.random();
    
    if (distance > AI_CONFIG.MID_RANGE) {
      // Far — mostly approach, sometimes feint
      if (roll < 0.65) {
        aiState.currentStrafeDirection = getDirectionToOpponent(cpu, human);
      } else if (roll < 0.80) {
        // Feint: briefly move away then approach
        aiState.currentStrafeDirection = -getDirectionToOpponent(cpu, human);
        // Short feint duration
        aiState.lastStrafeChangeTime = currentTime - strafeInterval + 150;
      } else {
        aiState.currentStrafeDirection = 0;
      }
    } else if (isNearEdge(cpu)) {
      // Near edge — move toward center
      aiState.currentStrafeDirection = getDirectionToCenter(cpu);
    } else if (distance < AI_CONFIG.SLAP_RANGE * 0.7) {
      // Very close — mix of holding ground, retreating, or circling
      if (roll < 0.25) {
        aiState.currentStrafeDirection = 0; // Hold ground
      } else if (roll < 0.50) {
        aiState.currentStrafeDirection = -getDirectionToOpponent(cpu, human); // Retreat
      } else if (roll < 0.75) {
        aiState.currentStrafeDirection = getDirectionToOpponent(cpu, human); // Pressure
      } else {
        // Circle toward center (positional play)
        aiState.currentStrafeDirection = getDirectionToCenter(cpu);
      }
    } else {
      // General mid-range movement
      if (roll < 0.40) {
        aiState.currentStrafeDirection = getDirectionToOpponent(cpu, human);
      } else if (roll < 0.60) {
        aiState.currentStrafeDirection = -getDirectionToOpponent(cpu, human);
      } else if (roll < 0.80) {
        aiState.currentStrafeDirection = getDirectionToCenter(cpu);
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
    io,
  } = gameHelpers;
  
  if (!room.gameStart || room.hakkiyoiCount === 0 || room.gameOver || room.matchOver) {
    return;
  }
  
  if (cpu.canMoveToReady || cpu.isSpawningPumoArmy || cpu.isGrabbingMovement) {
    return;
  }
  
  if (cpu.inputLockUntil && Date.now() < cpu.inputLockUntil) {
    return;
  }
  
  if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  const currentTime = Date.now();
  
  const shouldBlockAction = (allowThrowFromGrab = false) => {
    if (cpu.isAttacking) return true;
    if (cpu.isInStartupFrames) return true;
    if (cpu.isThrowing) return true;
    if (cpu.isBeingThrown) return true;
    if (cpu.isDodging) return true;
    if (cpu.isGrabStartup || cpu.isGrabbingMovement || cpu.isWhiffingGrab) return true;
    if (cpu.isGrabbing && !allowThrowFromGrab) return true;
    if (cpu.isBeingGrabbed) return true;
    if (cpu.isHit || cpu.isRawParryStun) return true;
    if (cpu.isRecovering) return true;
    if (cpu.isThrowingSnowball || cpu.isSpawningPumoArmy || cpu.isThrowingSalt) return true;
    if (cpu.isAtTheRopes) return true;
    if (cpu.isInEndlag) return true;
    if (cpu.isGrabBreaking || cpu.isGrabBreakCountered || cpu.isGrabBreakSeparating) return true;
    if (cpu.isGrabClashing) return true;
    if (cpu.isThrowTeching) return true;
    if (cpu.isRawParrying) return true;
    return false;
  };
  
  if (!cpu._prevKeys) {
    cpu._prevKeys = { ...cpu.keys };
  }
  
  const prevKeys = cpu._prevKeys;
  const keyJustPressed = (key) => cpu.keys[key] && !prevKeys[key];
  
  // COUNT INPUTS DURING GRAB CLASH
  if (cpu.isGrabClashing && room.grabClashData) {
    const mashKeys = ['w', 'a', 's', 'd', 'mouse1', 'mouse2', 'e', 'f', 'shift'];
    let inputDetected = false;
    
    for (const key of mashKeys) {
      if (cpu.keys[key] && !prevKeys[key]) {
        inputDetected = true;
        break;
      }
    }
    
    if (inputDetected) {
      cpu.grabClashInputCount++;
      
      if (cpu.id === room.grabClashData.player1Id) {
        room.grabClashData.player1Inputs++;
      } else if (cpu.id === room.grabClashData.player2Id) {
        room.grabClashData.player2Inputs++;
      }
      
      if (io) {
        io.in(room.id).emit("grab_clash_progress", {
          player1Inputs: room.grabClashData.player1Inputs,
          player2Inputs: room.grabClashData.player2Inputs,
          player1Id: room.grabClashData.player1Id,
          player2Id: room.grabClashData.player2Id,
        });
      }
    }
    
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  // === THROW PROCESSING ===
  if (cpu.keys.w && 
      cpu.isGrabbing && 
      !cpu.isBeingGrabbed &&
      !cpu.keys.mouse2 &&
      !shouldBlockAction(true) &&
      !cpu.isThrowingSalt &&
      !cpu.canMoveToReady &&
      !cpu.throwCooldown &&
      !cpu.isRawParrying &&
      !cpu.isThrowing &&
      !cpu.isAttemptingGrabThrow) {
    
    cpu.lastThrowAttemptTime = currentTime;
    cpu.isAttemptingGrabThrow = true;
    cpu.grabThrowAttemptStartTime = currentTime;
    cpu.actionLockUntil = currentTime + 500;
    
    setPlayerTimeout(cpu.id, () => {
      cpu.isAttemptingGrabThrow = false;
      
      if (cpu.isGrabBreakCountered || opponent.isGrabBreaking || opponent.isGrabBreakSeparating) {
        return;
      }
      
      if (!cpu.isGrabbing && !cpu.isThrowing) {
        return;
      }
      
      const THROW_RANGE = Math.round(166 * 1.3);
      const throwRange = THROW_RANGE * (cpu.sizeMultiplier || 1);
      
      if (Math.abs(cpu.x - opponent.x) < throwRange && 
          !opponent.isBeingThrown && 
          !opponent.isDodging) {
        
        clearChargeState(cpu, true);
        cpu.movementVelocity = 0;
        cpu.isStrafing = false;
        
        const shouldFaceRight = cpu.x < opponent.x;
        cpu.facing = shouldFaceRight ? -1 : 1;
        cpu.throwingFacingDirection = cpu.facing;
        opponent.beingThrownFacingDirection = -cpu.facing;
        
        cpu.isThrowing = true;
        cpu.throwStartTime = Date.now();
        cpu.throwEndTime = Date.now() + 400;
        cpu.throwOpponent = opponent.id;
        cpu.currentAction = "throw";
        cpu.actionLockUntil = Date.now() + 200;
        
        opponent.isBeingThrown = true;
        opponent.isHit = false;
        
        if (cpu.isGrabbing) {
          cpu.isGrabbing = false;
          cpu.grabbedOpponent = null;
        }
        if (opponent.isBeingGrabbed) {
          opponent.isBeingGrabbed = false;
        }
      }
    }, 500);
    
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  // Block if in blocking state
  if (shouldBlockAction()) {
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  // Process slap attack
  if (keyJustPressed("mouse1") && canPlayerSlap(cpu) && !shouldBlockAction()) {
    executeSlapAttack(cpu, rooms);
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  // Process grab - mouse2 during charging clears charge
  if (keyJustPressed("mouse2") && cpu.isChargingAttack) {
    clearChargeState(cpu, true);
  }
  
  // Process grab
  if (keyJustPressed("mouse2") && 
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
    
    clearChargeState(cpu, true);
    
    cpu.lastGrabAttemptTime = currentTime;
    cpu.isGrabStartup = true;
    cpu.grabStartupStartTime = currentTime;
    cpu.grabStartupDuration = 150;
    cpu.currentAction = "grab_startup";
    cpu.actionLockUntil = currentTime + 150;
    cpu.grabState = "attempting";
    cpu.grabAttemptType = "grab";
    cpu.grabApproachSpeed = Math.abs(cpu.movementVelocity);
    cpu.movementVelocity = 0;
    cpu.isStrafing = false;
    cpu.isPowerSliding = false;
    
    cpu._prevKeys = { ...cpu.keys };
    return;
  }
  
  // Process dodge
  if (keyJustPressed("shift") && 
      !cpu.keys.mouse2 &&
      !shouldBlockAction() &&
      canPlayerUseAction(cpu) &&
      !cpu.isGassed &&
      !cpu.isDodging) {
    
    cpu.movementVelocity = 0;
    cpu.isStrafing = false;
    clearChargeState(cpu, true); // Dodge cancels charging
    
    cpu.isDodging = true;
    cpu.isDodgeCancelling = false;
    cpu.dodgeCancelStartTime = 0;
    cpu.dodgeCancelStartY = 0;
    cpu.dodgeStartTime = currentTime;
    cpu.dodgeEndTime = currentTime + 450;
    cpu.dodgeStartX = cpu.x;
    cpu.dodgeStartY = cpu.y;
    
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
      cpu.isDodgeCancelling = false;
      cpu.dodgeDirection = null;
    }, 450);
    
    cpu._prevKeys = { ...cpu.keys };
    return;
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
    return;
  }
  
  // Release parry
  if (!cpu.keys.s && cpu.isRawParrying) {
    cpu.isRawParrying = false;
    cpu.rawParryStartTime = 0;
  }
  
  // Process charge attack (mouse1 held past threshold)
  if (cpu.keys.mouse1 && cpu.mouse1PressTime > 0 && (currentTime - cpu.mouse1PressTime) >= 200 && !shouldBlockAction() && canPlayerCharge(cpu) && !keyJustPressed("mouse2")) {
    if (!cpu.isChargingAttack) {
      startCharging(cpu);
    }
    
    const chargeDuration = currentTime - cpu.chargeStartTime;
    cpu.chargeAttackPower = Math.min((chargeDuration / 1000) * 100, 100);
    cpu.chargingFacingDirection = cpu.facing;
  }
  
  // Release charged attack (mouse1 released while charging)
  if (!cpu.keys.mouse1 && cpu.isChargingAttack && !cpu.isDodging) {
    const chargePercentage = cpu.chargeAttackPower;
    
    if (chargePercentage >= 10) {
      executeChargedAttack(cpu, chargePercentage, rooms);
    }
    
    clearChargeState(cpu);
  }
  
  // Process F key power-ups
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
    
    if (cpu.activePowerUp === "snowball") {
      cpu.isThrowingSnowball = true;
      cpu.currentAction = "snowball";
      cpu.actionLockUntil = currentTime + 250;
      
      let snowballDirection;
      if (opponent) {
        snowballDirection = cpu.x < opponent.x ? 2 : -2;
      } else {
        snowballDirection = cpu.facing === 1 ? -2 : 2;
      }
      
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
      
      setPlayerTimeout(cpu.id, () => {
        cpu.isThrowingSnowball = false;
        if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
          cpu.actionLockUntil = 0;
        }
      }, 500);
      
      cpu._prevKeys = { ...cpu.keys };
      return;
    } else if (cpu.activePowerUp === "pumo_army") {
      cpu.isSpawningPumoArmy = true;
      cpu.currentAction = "pumo_army";
      cpu.actionLockUntil = currentTime + 400;
      
      cpu.movementVelocity = 0;
      cpu.isStrafing = false;
      
      const armyDirection = cpu.facing === 1 ? -1 : 1;
      const numClones = 5;
      const spawnDelay = 1000;
      const startX = armyDirection === 1 ? 0 : 1150;
      const GROUND_LEVEL = 230;
      
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

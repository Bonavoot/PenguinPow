// CPU AI Module for Pumo Pumo - SUMO EXPERT
// Goal: Knock the opponent out of the dohyo (ring)
// Design philosophy: Human-like decision making with strategic reads, commitment,
// and intelligent grab system usage based on positioning and stamina.

const { ROPE_JUMP_BOUNDARY_ZONE, ROPE_JUMP_STARTUP_MS, ROPE_JUMP_STAMINA_COST,
        SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MAX_MS, SIDESTEP_TOTAL_MS,
        SIDESTEP_STAMINA_COST, SIDESTEP_INITIATION_RANGE,
        DODGE_STARTUP_MS, DODGE_DURATION, DODGE_STAMINA_COST,
        GRAB_STARTUP_DURATION_MS, GROUND_LEVEL, DOHYO_FALL_DEPTH,
        SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST,
        RAW_PARRY_STAMINA_COST, POWER_UP_TYPES,
        CLINCH_THROW_LAND_THRESHOLD, CLINCH_THROW_KILL_THRESHOLD,
        BALANCE_MAX } = require("./constants");
const { MAP_LEFT_BOUNDARY: GAME_MAP_LEFT, MAP_RIGHT_BOUNDARY: GAME_MAP_RIGHT,
        canPlayerSidestep, getSidestepInitData } = require("./gameUtils");

// Map boundaries - MUST match gameUtils.js (340 and 940)
const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 940;
const MAP_CENTER = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
const MAP_WIDTH = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;

// AI Configuration - Tuned for expert sumo gameplay
const AI_CONFIG = {
  // Distance thresholds — adjusted for new frame data hitbox ranges
  SLAP_RANGE: 125,         // Must exceed pushbox distance (~116px) so AI attacks at body contact
  GRAB_RANGE: 136,         // Scaled down 8% to match tighter pushbox
  GRAB_APPROACH_RANGE: 170, // Scaled down 8% to match tighter pushbox
  MID_RANGE: 185,          // Scaled for camera zoom (was 250)
  CHARGED_ATTACK_RANGE: 200, // Adjusted for buffed charged hitbox (~106px)
  
  // Edge/corner awareness
  EDGE_DANGER_ZONE: 89,    // Scaled for camera zoom (was 120)
  CORNER_CRITICAL_ZONE: 59, // Scaled for camera zoom (was 80)
  BACK_TO_BOUNDARY_THROW_ZONE: 136, // Scaled down 8% to match tighter pushbox
  
  // Reaction chances (0-1) — intentionally imperfect to feel human
  PARRY_CHANCE: 0.38,      // Base chance to parry incoming attacks (expert AI)
  DODGE_CHANCE: 0.16,      // Base chance to dodge instead of parry
  REACTION_MISS_CHANCE: 0.20, // Chance to completely miss reacting to an attack
  
  // Timing (ms)
  DECISION_COOLDOWN: 120,  // Minimum time between major decisions
  
  // Stamina thresholds
  GRAB_BREAK_STAMINA: 10,  // Stamina cost for grab break (equal for both players)
  DODGE_STAMINA_COST: 4,   // Matches new DODGE_STAMINA_COST constant
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

  // Human-like reaction jitter — not every reaction is frame-perfect
  REACTION_JITTER_MIN: 0,         // Best case: react same frame (good read)
  REACTION_JITTER_MAX: 55,        // Worst case: ~3-4 ticks late (missed the window)

  // Rope jump escape
  ROPE_JUMP_MIN_DISTANCE: 130,    // Don't rope jump if opponent is too close (startup is punishable)
  ROPE_JUMP_COOLDOWN: 6000,       // Don't spam rope jump
  ROPE_JUMP_CHANCE: 0.28,         // Chance to use rope jump when conditions are right


  // Sidestep — corner escape tool (s + shift)
  SIDESTEP_CORNER_CHANCE: 0.25,       // Chance to sidestep when cornered and distance is safe
  SIDESTEP_SAFE_MIN_DISTANCE: 100,    // Don't sidestep if opponent is point-blank (startup is punishable)
  SIDESTEP_SAFE_MAX_DISTANCE: 250,    // Don't sidestep if opponent is too far (won't arc past them)

  // Slap string commitment — full rekka strings instead of random isolated slaps
  STRING_FULL_CHANCE: 0.30,           // Chance to do full 3-hit string (mouse1×3)
  STRING_GRAB_CHANCE: 0.25,           // Chance to do slap-slap-grab (mouse1×2 + mouse2)
  // Remaining ~45%: single slap or legacy burst behavior

  // Slap pressure adaptation — AI gets more defensive after eating consecutive hits
  PRESSURE_HIT_THRESHOLD: 2,       // After this many consecutive hits, boost defense
  PRESSURE_PARRY_BOOST: 0.60,      // Boosted parry chance when under slap pressure
  PRESSURE_JITTER_MAX: 10,         // Near-instant reactions when pressured
  PRESSURE_MISS_CHANCE: 0.05,      // Almost never misses when focused on defense
  PRESSURE_DECAY_TIME: 2500,       // How long the defensive boost lasts after last hit (ms)

  // Clinch system intelligence
  CLINCH_GRIP_UP_DELAY_MIN: 200,       // Min delay before gripping up when grabbed
  CLINCH_GRIP_UP_DELAY_MAX: 500,       // Max delay before gripping up
  CLINCH_ACTION_INTERVAL_MIN: 600,     // Min interval between throw/pull/lift evaluations
  CLINCH_ACTION_INTERVAL_MAX: 1400,    // Max interval between evaluations
  CLINCH_KILL_ACTION_INTERVAL_MIN: 250, // Faster evaluation when opponent is in kill zone
  CLINCH_KILL_ACTION_INTERVAL_MAX: 600,
  CLINCH_THROW_REACTION_MIN: 150,      // Min reaction delay before executing a clinch action
  CLINCH_THROW_REACTION_MAX: 400,      // Max reaction delay
  CLINCH_THROW_CHANCE_KILL: 0.85,      // Chance to attempt action when opponent is in kill zone
  CLINCH_THROW_CHANCE_LAND: 0.45,      // Chance to attempt action in land zone (balance 15-50)
  CLINCH_THROW_CHANCE_FAIL: 0.12,      // Chance to attempt action in fail zone (drains balance)
  CLINCH_PUSH_PLANT_INTERVAL_MIN: 300, // Min duration before re-evaluating push/plant
  CLINCH_PUSH_PLANT_INTERVAL_MAX: 800, // Max duration
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
      // === Commitment system ===
      commitAction: null,      // 'slap_burst', 'slap_string_full', 'slap_string_grab', etc.
      commitCount: 0,          // How many actions left in commitment
      commitUntil: 0,          // Timestamp when commitment expires
      stringBuffered: false,   // Whether string inputs have been buffered on the player object
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
      // === Push resistance: dig in during grab push with a human-like delay ===
      grabResistStartTime: 0,
      // === Human-like reaction jitter — delays defensive reactions by a few frames ===
      reactionTarget: null,
      reactionDetectTime: 0,
      reactionDelay: 0,
      reactionProcessed: false,
      // === Rope jump tracking ===
      lastRopeJumpTime: 0,
      // === Slap pressure tracking — adapts defense after consecutive hits ===
      consecutiveHitsTaken: 0,
      lastHitTime: 0,
      wasHitLastCheck: false,
      // === Clinch system tracking ===
      clinchGripUpTime: 0,
      clinchLastThrowCheck: 0,
      clinchThrowPending: null,
      clinchThrowExecuteTime: 0,
      clinchPushPlantDecision: null,
      clinchPushPlantUntil: 0,
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
// Grabs beat dodge at any point — dodge is never safe from grabs
// Sidestep: grabs track through it by design, but the AI shouldn't react-grab
// on a dime. Already-in-progress grabs still track; this only blocks NEW attempts.
function isOpponentGrabbable(human) {
  return !human.isBeingThrown &&
         !human.isBeingGrabbed &&
         !human.isGrabWhiffRecovery &&
         !human.isGrabTeching &&
         !human.isGrabBreaking &&
         !human.isGrabBreakSeparating &&
         !human.isSidestepping;
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

  // Opponent is committed to an action (attacking, recovering) — great time to grab
  if (human.isAttacking || human.isRecovering || human.isHit) return true;
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
         !cpu.isSidestepping &&
         !cpu.isSidestepRecovery &&
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
  if (!cpu.keys) {
    cpu.keys = createEmptyKeys();
    return;
  }
  const k = cpu.keys;
  k.w = false;
  k.a = false;
  k.s = false;
  k.d = false;
  k[" "] = false;
  k.shift = false;
  k.e = false;
  k.f = false;
  k.mouse1 = false;
  k.mouse2 = false;
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
  
  // === TRACK CONSECUTIVE HITS — adapt defense when getting pressured ===
  if (cpu.isHit && !aiState.wasHitLastCheck) {
    aiState.consecutiveHitsTaken++;
    aiState.lastHitTime = currentTime;
    aiState.wasHitLastCheck = true;
  } else if (!cpu.isHit) {
    aiState.wasHitLastCheck = false;
  }
  if (aiState.lastHitTime && currentTime - aiState.lastHitTime > AI_CONFIG.PRESSURE_DECAY_TIME) {
    aiState.consecutiveHitsTaken = 0;
  }
  
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
  
  // Cancel grab approach if situation changed (hit, grabbed, opponent in i-frames/ungrabable)
  if (aiState.grabApproachIntent && (
    cpu.isHit || cpu.isBeingGrabbed || cpu.isBeingThrown ||
    human.isAttacking || !isOpponentGrabbable(human) ||
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

  // HIGHEST PRIORITY: Clinch behavior (mutual grab system)
  if (cpu.inClinch && (cpu.isGrabbing || cpu.isBeingGrabbed)) {
    handleClinchBehavior(cpu, human, aiState, currentTime);
    return;
  }
  // Clean up clinch state when not in clinch
  if (!cpu.inClinch && !cpu.isGrabbing && !cpu.isBeingGrabbed) {
    aiState.clinchGripUpTime = 0;
    aiState.clinchLastThrowCheck = 0;
    aiState.clinchThrowPending = null;
    aiState.clinchThrowExecuteTime = 0;
    aiState.clinchPushPlantDecision = null;
    aiState.clinchPushPlantUntil = 0;
    aiState.grabDecisionMade = false;
    aiState.grabStrategy = null;
    aiState.grabActionDelay = 0;
    aiState.grabStartedTime = 0;
  }

  // Being grabbed outside clinch (edge case) — don't act
  if (cpu.isBeingGrabbed && !cpu.isBeingThrown) {
    return;
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
  
  // Priority 2: ESCAPE CORNER — but only if opponent is actually blocking the escape route
  // If opponent is on the SAME side as the corner (further into the edge), CPU should
  // PRESS the advantage, not flee. Only flee when opponent is between CPU and center.
  const corneredSide = getCorneredSide(cpu);
  const opponentBlocksEscape = (corneredSide === -1 && human.x > cpu.x) ||
                                (corneredSide === 1 && human.x < cpu.x);
  if (corneredSide !== 0 && opponentBlocksEscape && canAct(cpu)) {
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
  
  // Priority 3: React to opponent attacks with HUMAN-LIKE TIMING
  // Under slap pressure (3+ consecutive hits), the AI "wakes up" and gets sharper defensively.
  // Otherwise, normal jitter + miss chance apply.
  if (human.isAttacking && !human.isInStartupFrames) {
    const isCommittedToOffense = aiState.commitAction && currentTime < aiState.commitUntil && aiState.commitCount > 0;
    const underPressure = aiState.consecutiveHitsTaken >= AI_CONFIG.PRESSURE_HIT_THRESHOLD;

    // Under pressure: break out of offensive commitment to defend
    if (!isCommittedToOffense || underPressure) {
      if (!aiState.reactionTarget) {
        aiState.reactionTarget = human.attackType || 'slap';
        aiState.reactionDetectTime = currentTime;
        aiState.reactionDelay = underPressure
          ? randomInRange(0, AI_CONFIG.PRESSURE_JITTER_MAX)
          : randomInRange(AI_CONFIG.REACTION_JITTER_MIN, AI_CONFIG.REACTION_JITTER_MAX);
        aiState.reactionProcessed = false;
      }

      if (!aiState.reactionProcessed && currentTime - aiState.reactionDetectTime >= aiState.reactionDelay) {
        aiState.reactionProcessed = true;
        const missChance = underPressure ? AI_CONFIG.PRESSURE_MISS_CHANCE : AI_CONFIG.REACTION_MISS_CHANCE;
        if (canParry(cpu) && !chance(missChance)) {
          if (handleDefensiveReaction(cpu, human, aiState, currentTime, distance, underPressure)) {
            aiState.consecutiveHitsTaken = 0;
            return;
          }
        }
      }
    }
  } else if (aiState.reactionTarget) {
    aiState.reactionTarget = null;
    aiState.reactionProcessed = false;
  }
  
  
  // Priority 4: COMMITMENT SYSTEM — if in a burst, continue it
  if (aiState.commitAction && currentTime < aiState.commitUntil && aiState.commitCount > 0) {
    if (handleCommitment(cpu, human, aiState, currentTime, distance)) {
      return;
    }
  }
  
  // Legacy: Handle charging attack (disabled — neutral charge removed)
  if (cpu.isChargingAttack) {
    cpu.isChargingAttack = false;
    cpu.chargeStartTime = 0;
    cpu.chargeAttackPower = 0;
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

  // No grab action yet (grabber is just pushing) — resist the push by pressing toward grabber
  if (!grabber.isAttemptingGrabThrow && !grabber.isAttemptingPull) {
    aiState.grabBreakReactionDecided = false;
    aiState.grabBreakReactS = false;
    aiState.grabBreakReactDirection = false;
    resetAllKeys(cpu);

    // Resist push after a human-like delay (150-300ms after grab starts)
    if (!aiState.grabResistStartTime) {
      aiState.grabResistStartTime = currentTime + randomInRange(150, 300);
    }
    if (currentTime >= aiState.grabResistStartTime) {
      const pushResistKey = grabber.facing === -1 ? 'a' : 'd';
      cpu.keys[pushResistKey] = true;
    }
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

// === Clinch behavior: push/plant/throw/pull/lift decisions ===
// Handles both roles: grabber (isGrabbing) and grabbed (isBeingGrabbed).
// Reads opponent balance + position to pick optimal clinch actions.
function handleClinchBehavior(cpu, opponent, aiState, currentTime) {
  resetAllKeys(cpu);

  // During active throw/pull/lift/clash/jolt animations, the system handles everything
  if (cpu.clinchThrowActive || cpu.isClinchClashing || cpu.isClinchThrowing ||
      cpu.isBeingLifted || cpu.isResistingThrow || cpu.isResistingPull ||
      cpu.isGrabSeparating ||
      cpu.isClinchJolting || cpu.isClinchJoltClashing || cpu.isBeingClinchJolted) {
    return;
  }
  if (opponent.clinchThrowActive || opponent.isClinchClashing || opponent.isClinchThrowing) {
    return;
  }

  // During burst push as grabber: let the auto-push ride (good for positioning)
  if (cpu.isGrabPushing) {
    return;
  }

  // Positional awareness (toward/away relative to opponent position, not facing)
  const towardKey = cpu.x < opponent.x ? 'd' : 'a';
  const awayKey = cpu.x < opponent.x ? 'a' : 'd';
  const cpuDistLeft = cpu.x - MAP_LEFT_BOUNDARY;
  const cpuDistRight = MAP_RIGHT_BOUNDARY - cpu.x;
  const oppDistLeft = opponent.x - MAP_LEFT_BOUNDARY;
  const oppDistRight = MAP_RIGHT_BOUNDARY - opponent.x;
  const cpuNearestEdge = Math.min(cpuDistLeft, cpuDistRight);
  const oppNearestEdge = Math.min(oppDistLeft, oppDistRight);

  // --- GRIP UP (human-like delay before gripping) ---
  if (!cpu.hasGrip && cpu.inClinch) {
    if (!aiState.clinchGripUpTime) {
      aiState.clinchGripUpTime = currentTime + randomInRange(
        AI_CONFIG.CLINCH_GRIP_UP_DELAY_MIN,
        AI_CONFIG.CLINCH_GRIP_UP_DELAY_MAX
      );
    }
    if (currentTime >= aiState.clinchGripUpTime) {
      cpu.hasGrip = true;
      cpu.clinchAction = "neutral";
      aiState.clinchGripUpTime = 0;
    }
    return;
  }

  // --- THROW / PULL / LIFT DECISION ---
  const opponentBalance = opponent.balance;
  const cpuBalance = cpu.balance;
  const cpuStamina = cpu.stamina;

  const canRequestAction = cpu.hasGrip && !cpu.clinchThrowActive &&
                           !cpu.clinchThrowCooldown && !cpu.clinchThrowRequest &&
                           !cpu.isClinchClashing;
  const canLand = opponentBalance <= CLINCH_THROW_LAND_THRESHOLD;
  const canKill = opponentBalance < CLINCH_THROW_KILL_THRESHOLD;

  // Detect when CPU is the one pinned at the boundary (closer to edge than opponent)
  const cpuBackedToEdge = cpuNearestEdge < AI_CONFIG.EDGE_DANGER_ZONE && cpuNearestEdge < oppNearestEdge;

  // --- EDGE ESCAPE URGENCY ---
  // When backed against the boundary, throw/lift to escape instead of getting pushed off
  if (cpuBackedToEdge && canRequestAction && !aiState.clinchThrowPending) {
    const staminaDesperate = cpuStamina < 15;
    const staminaCritical = cpuStamina < 35;
    const edgeCheckInterval = staminaDesperate ? 150 : staminaCritical ? 300 : 500;

    if (currentTime - (aiState.clinchLastThrowCheck || 0) > edgeCheckInterval) {
      aiState.clinchLastThrowCheck = currentTime;
      const escapeChance = staminaDesperate ? 0.90 : staminaCritical ? 0.70 : 0.40;

      if (chance(escapeChance)) {
        let action;
        if (chance(0.55)) {
          action = "lift"; // moves both players away from CPU's edge
        } else if (chance(0.6)) {
          action = "throw";
        } else {
          action = "pull";
        }
        const escapeDelay = staminaDesperate
          ? randomInRange(80, 180)
          : randomInRange(AI_CONFIG.CLINCH_THROW_REACTION_MIN, AI_CONFIG.CLINCH_THROW_REACTION_MAX);
        aiState.clinchThrowPending = action;
        aiState.clinchThrowExecuteTime = currentTime + escapeDelay;
      }
    }
  }

  // --- NORMAL THROW / PULL / LIFT DECISION (when not in edge-escape) ---
  if (!aiState.clinchLastThrowCheck) aiState.clinchLastThrowCheck = 0;
  const checkInterval = canKill
    ? randomInRange(AI_CONFIG.CLINCH_KILL_ACTION_INTERVAL_MIN, AI_CONFIG.CLINCH_KILL_ACTION_INTERVAL_MAX)
    : randomInRange(AI_CONFIG.CLINCH_ACTION_INTERVAL_MIN, AI_CONFIG.CLINCH_ACTION_INTERVAL_MAX);
  const shouldCheckThrow = currentTime - aiState.clinchLastThrowCheck > checkInterval;

  if (canRequestAction && shouldCheckThrow && !aiState.clinchThrowPending) {
    aiState.clinchLastThrowCheck = currentTime;
    const aggMult = getAggressionMultiplier(aiState);

    if (canKill && chance(AI_CONFIG.CLINCH_THROW_CHANCE_KILL * Math.min(aggMult.grab, 1.3))) {
      const liftViable = cpuNearestEdge > 100;
      let action;
      if (liftViable && chance(0.40)) {
        action = "lift";
      } else if (chance(0.55)) {
        action = "throw";
      } else {
        action = "pull";
      }
      aiState.clinchThrowPending = action;
      aiState.clinchThrowExecuteTime = currentTime + randomInRange(
        AI_CONFIG.CLINCH_THROW_REACTION_MIN,
        AI_CONFIG.CLINCH_THROW_REACTION_MAX
      );
    } else if (canLand && chance(AI_CONFIG.CLINCH_THROW_CHANCE_LAND * Math.min(aggMult.grab, 1.3))) {
      const roll = Math.random();
      let action = null;
      if (roll < 0.40) action = "throw";
      else if (roll < 0.65 && cpuNearestEdge > 80) action = "lift";
      else if (roll < 0.85) action = "pull";
      if (action) {
        aiState.clinchThrowPending = action;
        aiState.clinchThrowExecuteTime = currentTime + randomInRange(
          AI_CONFIG.CLINCH_THROW_REACTION_MIN + 50,
          AI_CONFIG.CLINCH_THROW_REACTION_MAX + 100
        );
      }
    } else if (!canLand && chance(AI_CONFIG.CLINCH_THROW_CHANCE_FAIL * Math.min(aggMult.grab, 1.3))) {
      // Failed throws now cost attacker balance — only attempt if CPU has balance to spare
      if (cpuBalance > 40) {
        const action = chance(0.6) ? "throw" : "pull";
        aiState.clinchThrowPending = action;
        aiState.clinchThrowExecuteTime = currentTime + randomInRange(
          AI_CONFIG.CLINCH_THROW_REACTION_MIN + 100,
          AI_CONFIG.CLINCH_THROW_REACTION_MAX + 200
        );
      }
    }
  }

  // Execute pending throw/pull/lift after reaction delay
  if (aiState.clinchThrowPending && currentTime >= aiState.clinchThrowExecuteTime) {
    if (canRequestAction) {
      cpu.clinchThrowRequest = aiState.clinchThrowPending;
      cpu.clinchThrowRequestTime = currentTime;
    }
    aiState.clinchThrowPending = null;
    aiState.clinchThrowExecuteTime = 0;
  }

  // --- CLINCH JOLT DECISION (Mouse1 during clinch) ---
  const canJolt = cpu.hasGrip && !cpu.isClinchJolting && !cpu.clinchJoltRecovery &&
                  !cpu.clinchJoltCooldown && !cpu.clinchThrowActive && !cpu.isClinchClashing &&
                  !cpu.clinchJoltRequest && !cpu.isResistingThrow && !cpu.isResistingPull &&
                  !cpu.isBeingLifted && cpuStamina >= 10;

  if (canJolt && !aiState.clinchJoltPending && !aiState.clinchThrowPending && !cpu.clinchThrowRequest) {
    const joltCheckInterval = 1600;
    if (!aiState.clinchLastJoltCheck) aiState.clinchLastJoltCheck = 0;
    if (currentTime - aiState.clinchLastJoltCheck > joltCheckInterval) {
      aiState.clinchLastJoltCheck = currentTime;

      const opponentPlanting = opponent.clinchAction === "plant" || opponent.isClinchPlanting;
      const opponentPushing = opponent.clinchAction === "push" || opponent.isClinchPushing;
      const opponentNeutral = !opponentPlanting && !opponentPushing;

      let joltChance = 0;
      if (opponentPlanting) {
        joltChance = 0.55;
      } else if (opponentNeutral) {
        joltChance = 0.10;
      } else if (opponentPushing) {
        joltChance = 0.0;
      }

      if (chance(joltChance)) {
        aiState.clinchJoltPending = true;
        aiState.clinchJoltExecuteTime = currentTime + randomInRange(200, 400);
      }
    }
  }

  if (aiState.clinchJoltPending && currentTime >= aiState.clinchJoltExecuteTime) {
    if (canJolt) {
      cpu.clinchJoltRequest = true;
      cpu.clinchJoltRequestTime = currentTime;
    }
    aiState.clinchJoltPending = false;
    aiState.clinchJoltExecuteTime = 0;
  }

  // --- PUSH / PLANT DECISION (set keys for getClinchAction to read) ---
  // Stay neutral when a throw/jolt is pending or just submitted (avoid push penalty on throw)
  if (aiState.clinchThrowPending || cpu.clinchThrowRequest || aiState.clinchJoltPending || cpu.clinchJoltRequest) {
    return;
  }

  // Re-evaluate push/plant at intervals to avoid jittery tick-by-tick flipping
  if (!aiState.clinchPushPlantUntil || currentTime > aiState.clinchPushPlantUntil) {
    aiState.clinchPushPlantUntil = currentTime + randomInRange(
      AI_CONFIG.CLINCH_PUSH_PLANT_INTERVAL_MIN,
      AI_CONFIG.CLINCH_PUSH_PLANT_INTERVAL_MAX
    );

    const opponentNearEdge = oppNearestEdge < AI_CONFIG.EDGE_DANGER_ZONE;
    const cpuNearEdge = cpuNearestEdge < AI_CONFIG.EDGE_DANGER_ZONE;
    const balanceAdvantage = cpuBalance - opponentBalance;

    if (cpuBackedToEdge) {
      // At the edge: push to resist being shoved off, but plant if stamina is critical
      if (cpuStamina < 15) {
        aiState.clinchPushPlantDecision = "plant";
      } else {
        aiState.clinchPushPlantDecision = "push";
      }
    } else if (opponentNearEdge && cpuBalance > 30) {
      // Opponent near edge — push harder (edge zone amplifies balance drain)
      aiState.clinchPushPlantDecision = "push";
    } else if (cpuBalance < 25 && !opponentNearEdge) {
      aiState.clinchPushPlantDecision = "plant";
    } else if (cpuStamina < 40) {
      // Plant recovers stamina now — plant more readily when stamina is moderate-low
      aiState.clinchPushPlantDecision = "plant";
    } else if (balanceAdvantage > 10) {
      aiState.clinchPushPlantDecision = "push";
    } else if (chance(0.60)) {
      aiState.clinchPushPlantDecision = "push";
    } else {
      aiState.clinchPushPlantDecision = "plant";
    }
  }

  // Apply the push/plant decision via keys
  if (aiState.clinchPushPlantDecision === "push") {
    cpu.keys[towardKey] = true;
  } else if (aiState.clinchPushPlantDecision === "plant") {
    cpu.keys.s = true;
    cpu.keys[awayKey] = true;
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

// Handle power-up usage (F key)
function handlePowerUpUsage(cpu, human, aiState, currentTime, distance) {
  const snowballThrowsRemaining = cpu.snowballThrowsRemaining ?? 3;
  const hasSnowball = cpu.activePowerUp === "snowball" && snowballThrowsRemaining > 0 && !cpu.snowballCooldown && !cpu.isThrowingSnowball;
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
      if (chance(0.5)) {
        if (!pickStringCommitment(aiState, currentTime)) {
          startCommitment(aiState, 'slap_burst', randomInRange(2, 4), currentTime);
        }
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return true;
    }
  } else {
    // Sidestep escape — arc around the opponent when cornered at safe distance
    if (distance >= AI_CONFIG.SIDESTEP_SAFE_MIN_DISTANCE &&
        distance <= AI_CONFIG.SIDESTEP_SAFE_MAX_DISTANCE &&
        canPlayerSidestep(cpu) &&
        !cpu.isGassed &&
        cpu.stamina >= SIDESTEP_STAMINA_COST + 5 &&
        chance(AI_CONFIG.SIDESTEP_CORNER_CHANCE)) {
      resetAllKeys(cpu);
      cpu.keys.s = true;
      cpu.keys.shift = true;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "sidestep_escape";
      return true;
    }

    // Rope jump escape — arc over the opponent when cornered and they're far enough away
    const nearLeftBound = cpu.x - GAME_MAP_LEFT < ROPE_JUMP_BOUNDARY_ZONE + 10;
    const nearRightBound = GAME_MAP_RIGHT - cpu.x < ROPE_JUMP_BOUNDARY_ZONE + 10;
    if ((nearLeftBound || nearRightBound) &&
        distance > AI_CONFIG.ROPE_JUMP_MIN_DISTANCE &&
        currentTime - aiState.lastRopeJumpTime > AI_CONFIG.ROPE_JUMP_COOLDOWN &&
        !cpu.isGassed &&
        chance(AI_CONFIG.ROPE_JUMP_CHANCE)) {
      resetAllKeys(cpu);
      cpu.keys.w = true;
      if (nearLeftBound) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.lastRopeJumpTime = currentTime;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "rope_jump";
      return true;
    }
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
      if (chance(0.55)) {
        if (!pickStringCommitment(aiState, currentTime)) {
          startCommitment(aiState, 'slap_burst', randomInRange(3, 5), currentTime);
        }
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return;
    } else {
      // String pressure: slap to build into hit 3 charge near the edge
      if (!pickStringCommitment(aiState, currentTime)) {
        startCommitment(aiState, 'slap_burst', randomInRange(2, 4), currentTime);
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return;
    }
  }
  
  // Mid-range: approach with attack intent (slaps while walking in, charged attacks)
  if (distance < AI_CONFIG.MID_RANGE) {
    const midRoll = Math.random();
    const dirToOpponent = getDirectionToOpponent(cpu, human);

    if (midRoll < 0.40 && canAttack(cpu)) {
      // Slap while approaching — slap hitbox (146px) reaches past pushbox
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap_approach_ringout";
      return;
    } else if (midRoll < 0.60 && canAttack(cpu)) {
      // Slap approach — close gap and start a string
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      const dirToOpponent2 = getDirectionToOpponent(cpu, human);
      if (dirToOpponent2 === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap_approach";
      return;
    } else if (midRoll < 0.80 && canGrab(cpu)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab_ringout";
        aiState.lastDecisionTime = currentTime;
        return;
      }
    }

    // Walk in carefully as fallback
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach_ringout";
    aiState.lastDecisionTime = currentTime;
    return;
  }

  // Far away — walk in, no dodge-approach (overshooting swaps who's cornered)
  const dirToOpponent = getDirectionToOpponent(cpu, human);
  if (dirToOpponent === 1) cpu.keys.d = true;
  else cpu.keys.a = true;
  aiState.lastActionType = "approach_ringout";
  aiState.lastDecisionTime = currentTime;
}

// Handle defensive reactions — dodge restricted to charged attacks only
// Dodge has NO i-frames vs slaps, so using it defensively vs slaps is a waste.
// underPressure: true when the AI has taken 3+ consecutive hits (boosted parry chance)
function handleDefensiveReaction(cpu, human, aiState, currentTime, distance, underPressure = false) {
  const reactionCooldown = underPressure ? 150 : 250;
  if (currentTime - aiState.lastAttackReactionTime < reactionCooldown) {
    return false;
  }
  
  const attackRange = human.attackType === "slap" ? 180 : 280;
  if (distance > attackRange) return false;
  
  const aggMult = getAggressionMultiplier(aiState);
  const roll = Math.random();
  
  // In aggressive mode, sometimes trade hits instead of defending
  // But NOT when under pressure — the AI has learned to stop trading into a barrage
  if (!underPressure && aiState.aggressionMode === 'aggressive' && distance < AI_CONFIG.SLAP_RANGE && canAttack(cpu) && roll < 0.30) {
    resetAllKeys(cpu);
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "trade_slap";
    return true;
  }
  
  const parryChance = underPressure
    ? AI_CONFIG.PRESSURE_PARRY_BOOST
    : AI_CONFIG.PARRY_CHANCE * aggMult.defense;
  
  if (roll < parryChance && canParry(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.s = true;
    aiState.lastAttackReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.pendingParry = true;
    aiState.parryStartTime = currentTime;
    // Shorter hold = tighter perfect parry timing + less vulnerability after
    aiState.parryReleaseTime = currentTime + (underPressure ? randomInRange(60, 120) : randomInRange(100, 220));
    return true;
  }
  
  // Dodge ONLY vs charged attacks — dodge has i-frames vs charged but NOT vs slaps
  if (human.attackType === 'charged') {
    const dodgeChance = AI_CONFIG.DODGE_CHANCE * aggMult.defense;
    if (roll < parryChance + dodgeChance && canDodge(cpu)) {
      resetAllKeys(cpu);
      cpu.keys.shift = true;
      
      const cpuLeftDist = distanceToLeftEdge(cpu);
      const cpuRightDist = distanceToRightEdge(cpu);
      const nearestEdge = cpuLeftDist < cpuRightDist ? 'left' : 'right';
      const distToNearestEdge = Math.min(cpuLeftDist, cpuRightDist);
      
      if (distToNearestEdge < 250) {
        if (nearestEdge === 'left') cpu.keys.d = true;
        else cpu.keys.a = true;
      } else {
        if (chance(0.6)) {
          const intendedDir = cpu.x < human.x ? -1 : 1;
          if (intendedDir === -1) cpu.keys.a = true;
          else cpu.keys.d = true;
        } else {
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

// Start a commitment (burst of actions or string sequence)
function startCommitment(aiState, action, count, currentTime) {
  aiState.commitAction = action;
  aiState.commitCount = count;
  aiState.stringBuffered = false;
  if (action === 'slap_string_full' || action === 'slap_string_grab') {
    aiState.commitUntil = currentTime + 2000;
  } else {
    aiState.commitUntil = currentTime + count * 250 + 500;
  }
}

// Decide which string type to commit to based on config chances
function pickStringCommitment(aiState, currentTime) {
  const roll = Math.random();
  if (roll < AI_CONFIG.STRING_FULL_CHANCE) {
    startCommitment(aiState, 'slap_string_full', 3, currentTime);
    return 'slap_string_full';
  } else if (roll < AI_CONFIG.STRING_FULL_CHANCE + AI_CONFIG.STRING_GRAB_CHANCE) {
    startCommitment(aiState, 'slap_string_grab', 2, currentTime);
    return 'slap_string_grab';
  }
  return null;
}

// Handle committed action sequences
function handleCommitment(cpu, human, aiState, currentTime, distance) {
  // === SLAP STRING: full 3-hit combo (mouse1 × 3) ===
  if (aiState.commitAction === 'slap_string_full') {
    if (!cpu.isAttacking && !aiState.stringBuffered && canAttack(cpu) && distance < AI_CONFIG.SLAP_RANGE + 30) {
      resetAllKeys(cpu);
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "string_full_start";
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    }
    if (cpu.isAttacking && cpu.attackType === "slap" && !aiState.stringBuffered) {
      cpu.pendingSlapCount = 2;
      aiState.stringBuffered = true;
      return true;
    }
    if (aiState.stringBuffered) {
      if (!cpu.isAttacking && !cpu.isInStartupFrames && !cpu.isInEndlag) {
        aiState.commitAction = null;
        aiState.commitCount = 0;
        aiState.stringBuffered = false;
        return false;
      }
      return true;
    }
    if (distance >= AI_CONFIG.SLAP_RANGE + 80) {
      aiState.commitAction = null;
      aiState.commitCount = 0;
      aiState.stringBuffered = false;
      return false;
    }
    if (distance < AI_CONFIG.SLAP_RANGE + 80) {
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    }
    return false;
  }

  // === SLAP STRING: slap-slap-grab ender (mouse1 × 2 + mouse2) ===
  if (aiState.commitAction === 'slap_string_grab') {
    if (!cpu.isAttacking && !aiState.stringBuffered && canAttack(cpu) && distance < AI_CONFIG.SLAP_RANGE + 30) {
      resetAllKeys(cpu);
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "string_grab_start";
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    }
    if (cpu.isAttacking && cpu.attackType === "slap" && !aiState.stringBuffered) {
      cpu.pendingSlapCount = 1;
      cpu.pendingGrabEnder = true;
      aiState.stringBuffered = true;
      return true;
    }
    if (aiState.stringBuffered) {
      if (!cpu.isAttacking && !cpu.isInStartupFrames && !cpu.isInEndlag &&
          !cpu.isGrabStartup && !cpu.isGrabbing && !cpu.isGrabbingMovement) {
        aiState.commitAction = null;
        aiState.commitCount = 0;
        aiState.stringBuffered = false;
        return false;
      }
      return true;
    }
    if (distance >= AI_CONFIG.SLAP_RANGE + 80) {
      aiState.commitAction = null;
      aiState.commitCount = 0;
      aiState.stringBuffered = false;
      return false;
    }
    if (distance < AI_CONFIG.SLAP_RANGE + 80) {
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    }
    return false;
  }

  // === Legacy slap burst (individual disconnected slaps) ===
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
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    } else if (distance < AI_CONFIG.SLAP_RANGE + 80) {
      const dirToOpponent = getDirectionToOpponent(cpu, human);
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return true;
    } else {
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

// handleHit3Charge removed — hit 3 no longer part of slap string

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
  
  // SLAP STRING / BURST — commit to a proper string sequence or burst pressure
  if (roll < 0.22 + AI_CONFIG.COMMIT_BURST_CHANCE * aggMult.attack && canAttack(cpu)) {
    if (!pickStringCommitment(aiState, currentTime)) {
      const burstCount = randomInRange(AI_CONFIG.COMMIT_SLAP_BURST_MIN, AI_CONFIG.COMMIT_SLAP_BURST_MAX);
      startCommitment(aiState, 'slap_burst', burstCount, currentTime);
    }
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "string_start";
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
  // Slap pressure at mid range
  else if (roll < 0.82 && canAttack(cpu)) {
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "slap_approach";
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
  // Dash approach (15%) — close the gap faster at far range
  else if (roll < 0.90 && canDodge(cpu)) {
    cpu.keys.shift = true;
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.shiftReleaseTime = currentTime + 80;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "dodge_approach";
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
    canPlayerDash,
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
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  const currentTime = Date.now();
  
  const shouldBlockAction = (allowThrowFromGrab = false) => {
    if (cpu.isAttacking) return true;
    if (cpu.isInStartupFrames) return true;
    if (cpu.isThrowing) return true;
    if (cpu.isBeingThrown) return true;
    if (cpu.isDodging) return true;
    if (cpu.isSidestepping || cpu.isSidestepRecovery) return true;
    if (cpu.isGrabStartup || cpu.isGrabbingMovement || cpu.isWhiffingGrab) return true;
    if (cpu.isGrabbing && !allowThrowFromGrab) return true;
    if (cpu.isBeingGrabbed) return true;
    if (cpu.isHit || cpu.isRawParryStun) return true;
    if (cpu.isRecovering) return true;
    if (cpu.isThrowingSnowball || cpu.isSpawningPumoArmy || cpu.isThrowingSalt) return true;
    if (cpu.isAtTheRopes) return true;
    if (cpu.isRopeJumping) return true;
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
    
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // === THROW PROCESSING (legacy, skipped during clinch — clinch uses clinchThrowRequest) ===
  if (cpu.keys.w && 
      cpu.isGrabbing && 
      !cpu.inClinch &&
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
    
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // Block if in blocking state
  if (shouldBlockAction()) {
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // Process slap attack
  if (keyJustPressed("mouse1") && canPlayerSlap(cpu) && !shouldBlockAction()) {
    executeSlapAttack(cpu, rooms);
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
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
      !cpu.isPushing &&
      !cpu.isBeingPushed &&
      !cpu.grabbedOpponent &&
      !cpu.isGrabStartup &&
      !cpu.isGrabbingMovement &&
      !cpu.isWhiffingGrab &&
      !cpu.isGrabWhiffRecovery &&
      !cpu.isGrabTeching &&
      !cpu.isRawParrying &&
      !cpu.isJumping &&
      !cpu.isThrowing &&
      !shouldBlockAction() &&
      canPlayerUseAction(cpu)) {
    
    cpu.isRawParrySuccess = false;
    cpu.isPerfectRawParrySuccess = false;
    clearChargeState(cpu, true);

    if (cpu.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER) {
      cpu.hitAbsorptionUsed = false;
    }
    
    cpu.lastGrabAttemptTime = currentTime;
    cpu.isGrabStartup = true;
    cpu.grabStartupStartTime = currentTime;
    cpu.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
    cpu.currentAction = "grab_startup";
    cpu.actionLockUntil = currentTime + GRAB_STARTUP_DURATION_MS;
    cpu.grabState = "attempting";
    cpu.grabAttemptType = "grab";
    cpu.grabApproachSpeed = Math.abs(cpu.movementVelocity);
    cpu.movementVelocity = 0;
    cpu.isStrafing = false;
    cpu.isPowerSliding = false;
    
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // Process sidestep (s + shift) — must be checked BEFORE dodge
  if (keyJustPressed("shift") && cpu.keys.s &&
      !cpu.keys.mouse2 &&
      !cpu.isBeingGrabbed &&
      !shouldBlockAction() &&
      canPlayerSidestep(cpu) &&
      !cpu.isGassed) {
    const sidestepOpponent = opponent;
    if (sidestepOpponent) {
      const initData = getSidestepInitData(cpu.x, sidestepOpponent.x);
      cpu.isRawParrySuccess = false;
      cpu.isPerfectRawParrySuccess = false;
      clearChargeState(cpu, true);
      cpu.movementVelocity = 0;
      cpu.isStrafing = false;
      cpu.isPowerSliding = false;
      cpu.isBraking = false;
      cpu.isCrouchStance = false;
      cpu.isCrouchStrafing = false;

      cpu.isSidestepping = true;
      cpu.isSidestepStartup = true;
      cpu.isSidestepRecovery = false;
      cpu.sidestepStartTime = currentTime;
      cpu.sidestepStartupEndTime = currentTime + SIDESTEP_STARTUP_MS;
      cpu.sidestepActiveEndTime = currentTime + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MAX_MS;
      cpu.sidestepEndTime = currentTime + SIDESTEP_TOTAL_MS;
      cpu.sidestepStartX = cpu.x;
      cpu.sidestepDirection = initData.direction;
      cpu.sidestepMaxTravel = initData.maxTravel;
      cpu.sidestepActiveDuration = SIDESTEP_ACTIVE_MAX_MS;

      cpu.currentAction = "sidestep";
      cpu.actionLockUntil = currentTime + SIDESTEP_TOTAL_MS;
      cpu.stamina = Math.max(0, cpu.stamina - SIDESTEP_STAMINA_COST);

      if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
      else Object.assign(cpu._prevKeys, cpu.keys);
      return;
    }
  }

  // Process dodge
  if (keyJustPressed("shift") && 
      !cpu.keys.mouse2 &&
      !cpu.isBeingGrabbed &&
      canPlayerDash(cpu) &&
      !cpu.isGassed) {
    
    cpu.isRawParrySuccess = false;
    cpu.isPerfectRawParrySuccess = false;
    clearChargeState(cpu, true);
    cpu.movementVelocity = 0;
    cpu.isStrafing = false;
    cpu.isPowerSliding = false;
    cpu.isBraking = false;
    
    cpu.isDodging = true;
    cpu.isDodgeStartup = true;
    cpu.dodgeStartTime = currentTime;
    cpu.dodgeStartupEndTime = currentTime + DODGE_STARTUP_MS;
    cpu.dodgeEndTime = currentTime + DODGE_DURATION;
    cpu.dodgeStartX = cpu.x;
    cpu.currentAction = "dash";
    cpu.actionLockUntil = currentTime + 100;
    cpu.justLandedFromDodge = false;
    
    cpu.stamina = Math.max(0, cpu.stamina - DODGE_STAMINA_COST);
    
    if (cpu.keys.a) {
      cpu.dodgeDirection = -1;
    } else if (cpu.keys.d) {
      cpu.dodgeDirection = 1;
    } else {
      cpu.dodgeDirection = cpu.facing === -1 ? 1 : -1;
    }
    
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // Process rope jump (W + forward key near game boundary)
  if (cpu.keys.w && !shouldBlockAction()) {
    const { canPlayerDash: canDash } = gameHelpers;
    if (canDash) {
      const nearLeftBound = cpu.x - GAME_MAP_LEFT < ROPE_JUMP_BOUNDARY_ZONE;
      const nearRightBound = GAME_MAP_RIGHT - cpu.x < ROPE_JUMP_BOUNDARY_ZONE;
      const forwardHeld = (nearLeftBound && cpu.keys.d) || (nearRightBound && cpu.keys.a);

      if (forwardHeld && (nearLeftBound || nearRightBound) &&
          !cpu.isRopeJumping && canDash(cpu) && !cpu.isGassed) {
        clearChargeState(cpu, true);
        cpu.movementVelocity = 0;
        cpu.isStrafing = false;
        cpu.isPowerSliding = false;
        cpu.isBraking = false;

        const jumpDir = nearLeftBound ? 1 : -1;
        const mapMidpoint = (GAME_MAP_LEFT + GAME_MAP_RIGHT) / 2;
        const targetX = cpu.x + (mapMidpoint - cpu.x) * 0.52;

        cpu.facing = nearLeftBound ? -1 : 1;
        cpu.isRopeJumping = true;
        cpu.ropeJumpPhase = "startup";
        cpu.ropeJumpStartTime = currentTime;
        cpu.ropeJumpStartX = cpu.x;
        cpu.ropeJumpTargetX = Math.max(GAME_MAP_LEFT, Math.min(targetX, GAME_MAP_RIGHT));
        cpu.ropeJumpDirection = jumpDir;
        cpu.ropeJumpActiveStartTime = 0;
        cpu.ropeJumpLandingTime = 0;
        cpu.ropeJumpBufferedAttackRelease = 0;
        cpu.currentAction = "ropeJump";
        cpu.actionLockUntil = currentTime + ROPE_JUMP_STARTUP_MS;
        cpu.stamina = Math.max(0, cpu.stamina - ROPE_JUMP_STAMINA_COST);

        if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
        else Object.assign(cpu._prevKeys, cpu.keys);
        return;
      }
    }
  }

  // Process raw parry
  if (keyJustPressed("s") && 
      !shouldBlockAction() &&
      !cpu.isRawParrying &&
      !cpu.isRawParryStun &&
      !cpu.isSidestepping &&
      !cpu.isGrabbing &&
      !cpu.isBeingGrabbed &&
      !cpu.isGrabbingMovement &&
      !cpu.isWhiffingGrab &&
      !cpu.isGrabClashing &&
      !cpu.isThrowing &&
      !cpu.isBeingThrown &&
      !cpu.isAttacking &&
      !cpu.isHit &&
      !cpu.isThrowingSnowball &&
      !cpu.isSpawningPumoArmy &&
      !cpu.canMoveToReady &&
      canPlayerUseAction(cpu)) {
    
    cpu.isRawParrySuccess = false;
    cpu.isPerfectRawParrySuccess = false;
    cpu.isRawParrying = true;
    cpu.rawParryStartTime = currentTime;
    cpu.rawParryMinDurationMet = false;
    cpu.stamina = Math.max(0, cpu.stamina - RAW_PARRY_STAMINA_COST);
    clearChargeState(cpu, true);
    cpu.movementVelocity = 0;
    cpu.isStrafing = false;
    cpu.isPowerSliding = false;
    cpu.isCrouchStance = false;
    cpu.isCrouchStrafing = false;
    cpu.pendingSlapCount = 0;
    cpu.pendingGrabEnder = false;
    cpu.slapStringPosition = 0;
    cpu.slapStringWindowUntil = 0;
    
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // Release parry
  if (!cpu.keys.s && cpu.isRawParrying) {
    cpu.isRawParrying = false;
    cpu.rawParryStartTime = 0;
  }
  
  // Neutral charged attack REMOVED — charge only exists as hit 3 string ender.
  // Clear any lingering charge state
  if (cpu.isChargingAttack) {
    clearChargeState(cpu);
  }
  
  // Process F key power-ups
  if (keyJustPressed("f") && 
      !shouldBlockAction() &&
      (cpu.activePowerUp === "snowball" || cpu.activePowerUp === "pumo_army") &&
      (cpu.activePowerUp !== "snowball" || (cpu.snowballThrowsRemaining ?? 3) > 0) &&
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
      !cpu.canMoveToReady) {
    
    if (cpu.isChargingAttack) {
      clearChargeState(cpu, true);
    }
    
    if (cpu.activePowerUp === "snowball") {
      if (cpu.snowballThrowsRemaining == null) {
        cpu.snowballThrowsRemaining = 3;
      }
      if (cpu.snowballThrowsRemaining <= 0) {
        if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
        else Object.assign(cpu._prevKeys, cpu.keys);
        return;
      }

      cpu.stamina = Math.max(0, cpu.stamina - SLAP_ATTACK_STAMINA_COST);
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
      cpu.snowballThrowsRemaining = Math.max(0, cpu.snowballThrowsRemaining - 1);
      cpu.snowballCooldown = true;
      
      setPlayerTimeout(cpu.id, () => {
        cpu.isThrowingSnowball = false;
        if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
          cpu.actionLockUntil = 0;
        }
      }, 500);
      
      if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
      else Object.assign(cpu._prevKeys, cpu.keys);
      return;
    } else if (cpu.activePowerUp === "pumo_army") {
      cpu.stamina = Math.max(0, cpu.stamina - CHARGED_ATTACK_STAMINA_COST);
      cpu.isSpawningPumoArmy = true;
      cpu.currentAction = "pumo_army";
      cpu.actionLockUntil = currentTime + 400;
      
      cpu.movementVelocity = 0;
      cpu.isStrafing = false;
      
      const armyDirection = cpu.facing === 1 ? -1 : 1;
      const startX = armyDirection === 1 ? -100 : 1200;
      const Y_SPREAD = 35;
      const V_OFFSET = 40;

      const lanes = [
        { lane: 'top',    targetY: GROUND_LEVEL + Y_SPREAD, xOffset: 0 },
        { lane: 'middle', targetY: GROUND_LEVEL + 5,        xOffset: armyDirection * V_OFFSET },
        { lane: 'bottom', targetY: GROUND_LEVEL - Y_SPREAD, xOffset: 0 },
      ];

      lanes.forEach(({ lane, targetY, xOffset }) => {
        const clone = {
          id: Math.random().toString(36).substr(2, 9),
          x: startX + xOffset,
          y: GROUND_LEVEL - DOHYO_FALL_DEPTH,
          targetY,
          velocityX: armyDirection * 1.5,
          facing: armyDirection,
          isStrafing: true,
          isSlapAttacking: true,
          slapCooldown: 0,
          lastSlapTime: 0,
          spawnTime: Date.now(),
          lifespan: 10000,
          ownerId: cpu.id,
          ownerFighter: cpu.fighter,
          hasHit: false,
          size: 0.6,
          lane,
        };
        cpu.pumoArmy.push(clone);
      });
      
      cpu.pumoArmyCooldown = true;
      
      setPlayerTimeout(cpu.id, () => {
        cpu.isSpawningPumoArmy = false;
        if (cpu.actionLockUntil && Date.now() < cpu.actionLockUntil) {
          cpu.actionLockUntil = 0;
        }
      }, 800);
      
      if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
      else Object.assign(cpu._prevKeys, cpu.keys);
      return;
    }
  }
  
  if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
  else Object.assign(cpu._prevKeys, cpu.keys);
}

module.exports = {
  updateCPUAI,
  processCPUInputs,
  clearAIState,
  AI_CONFIG,
};

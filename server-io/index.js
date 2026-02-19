const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
const e = require("express");
const {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
} = require("./playerCleanup");
const { GRAB_STATES, TICK_RATE, BROADCAST_EVERY_N_TICKS } = require("./constants");

// Import game utilities
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  TimeoutManager,
  timeoutManager,
  setPlayerTimeout,
  isPlayerInActiveState,
  isPlayerInBasicActiveState,
  canPlayerCharge,
  canPlayerUseAction,
  canPlayerDodge,
  resetPlayerAttackStates,
  clearAllActionStates,  // Critical: clears ALL states when player loses control
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  shouldRestartCharging,
  startCharging,
  canPlayerSlap,
  clearChargeState,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("./gameUtils");

// Import game functions
const {
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
} = require("./gameFunctions");

// Import CPU AI
const { updateCPUAI, processCPUInputs, clearAIState } = require("./cpuAI");

const app = express();
app.use(cors());

// Heroku specific configurations
const PORT = process.env.PORT || 3001;
app.set("port", PORT);

// Add health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error("Express error:", err);
  res.status(500).send("Something broke!");
});

const server = http.createServer(app);

// Add keep-alive settings AFTER server creation
server.keepAliveTimeout = 120000; // 2 minutes
server.headersTimeout = 120000; // 2 minutes

// Add uncaught exception handler
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally restart the server here
});

// Add unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Sanitize helper to keep stamina values stable and within [0, 100]
function clampStaminaValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

const expressSession = session({
  secret: "my-secret",
  resave: true,
  saveUninitialized: true,
});

app.use(expressSession);

io.use(
  sharedsession(expressSession, {
    autoSave: true,
  })
);

// Creates rooms to join, 10 total as of now
const rooms = Array.from({ length: 10 }, (_, i) => ({
  id: `Room ${i + 1}`,
  players: [],
  readyCount: 0,
  rematchCount: 0,
  gameStart: false,
  gameOver: false,
  matchOver: false,
  readyStartTime: null,
  roundStartTimer: null, // Add timer for automatic round start
  hakkiyoiCount: 0,
  teWoTsuiteSent: false, // Track if gyoji call was sent before HAKKIYOI
  powerUpSelectionPhase: false, // Track power-up selection phase
  opponentDisconnected: false, // Track if opponent disconnected during active game
  disconnectedDuringGame: false, // Track if disconnection happened during active gameplay
  // Brief freeze for clarity on impactful moments
  hitstopUntil: 0,
  // PERFORMANCE: Track previous state for delta updates
  previousPlayerStates: [null, null],
  // PERFORMANCE: Throttle screen shake events
  lastScreenShakeTime: 0,
}));

// ============================================
// PERFORMANCE OPTIMIZATION: Lookup Maps
// O(1) lookups instead of O(n) array.find()
// ============================================
const roomsByPlayerId = new Map(); // playerId -> room
const playerById = new Map(); // playerId -> player object

// Helper to register player in lookup maps
function registerPlayerInMaps(player, room) {
  roomsByPlayerId.set(player.id, room);
  playerById.set(player.id, player);
}

// Helper to unregister player from lookup maps
function unregisterPlayerFromMaps(playerId) {
  roomsByPlayerId.delete(playerId);
  playerById.delete(playerId);
}

// Fast room lookup by player ID - O(1) instead of O(n)
function getRoomByPlayerId(playerId) {
  return roomsByPlayerId.get(playerId);
}

// Fast player lookup by ID - O(1) instead of O(n)
function getPlayerById(playerId) {
  return playerById.get(playerId);
}

// ============================================
// PERFORMANCE: Delta State Updates
// Only send properties that changed since last tick
// ============================================
const ALWAYS_SEND_PROPS = ['x', 'y', 'facing', 'stamina', 'id', 'fighter', 'color', 'mawashiColor']; // Always include position and identity data

// Properties that change frequently during gameplay
const DELTA_TRACKED_PROPS = [
  'isAttacking', 'isSlapAttack', 'slapAnimation', 'attackType',
  'isChargingAttack', 'chargeAttackPower', 'chargeStartTime',
  'isGrabbing', 'isBeingGrabbed', 'grabbedOpponent', 'grabState', 'grabAttemptType',
  'isGrabbingMovement', 'isWhiffingGrab', 'isGrabWhiffRecovery', 'isGrabTeching', 'grabTechRole', 'isGrabClashing', 'isGrabStartup',
  'isHit', 'isDead', 'isRecovering', 'isDodging', 'dodgeDirection',
  'isRawParrying', 'isRawParryStun', 'isRawParrySuccess', 'isPerfectRawParrySuccess',
  'isThrowing', 'isBeingThrown', 'isThrowTeching', 'isBeingPulled', 'isBeingPushed',
  'isThrowingSalt', 'isReady', 'isBowing', 'isAtTheRopes',
  'isThrowingSnowball', 'isSpawningPumoArmy',
  'isCrouchStance', 'isCrouchStrafing', 'isGrabBreaking', 'isGrabBreakCountered',
  'isAttemptingGrabThrow', 'isInRitualPhase',
  // New grab action system states
  'isGrabPushing', 'isBeingGrabPushed', 'isAttemptingPull', 'isBeingPullReversaled',
  'isGrabSeparating', 'isGrabBellyFlopping', 'isBeingGrabBellyFlopped',
  'isGrabFrontalForceOut', 'isBeingGrabFrontalForceOut',
  'knockbackVelocity', 'activePowerUp', 'powerUpMultiplier',
  'snowballs', 'pumoArmy', 'snowballCooldown', 'pumoArmyCooldown',
  'isPowerSliding', 'isBraking', 'movementVelocity', 'isStrafing',
  'isJumping', 'isDiving', 'sizeMultiplier'
];

// PERFORMANCE: Pre-compute the combined props list once (avoids spread on every call)
const ALL_TRACKED_PROPS = [...ALWAYS_SEND_PROPS, ...DELTA_TRACKED_PROPS];

// PERFORMANCE: Shallow-compare two arrays of flat objects without JSON.stringify.
// Used for snowballs/pumoArmy which are small arrays (~0-5 elements) of flat objects.
// ~10-50x faster than JSON.stringify comparison for typical game state.
function shallowArrayEquals(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    // Fast path: same reference means same object
    if (itemA === itemB) continue;
    // Compare all own enumerable properties
    const keys = Object.keys(itemA);
    if (keys.length !== Object.keys(itemB).length) return false;
    for (let k = 0; k < keys.length; k++) {
      if (itemA[keys[k]] !== itemB[keys[k]]) return false;
    }
  }
  return true;
}

function computePlayerDelta(currentState, previousState) {
  if (!previousState) {
    // First update - send everything relevant
    const delta = {};
    for (let i = 0; i < ALL_TRACKED_PROPS.length; i++) {
      const prop = ALL_TRACKED_PROPS[i];
      if (currentState[prop] !== undefined) {
        delta[prop] = currentState[prop];
      }
    }
    return delta;
  }
  
  const delta = {};
  
  // Always include essential positioning
  for (let i = 0; i < ALWAYS_SEND_PROPS.length; i++) {
    delta[ALWAYS_SEND_PROPS[i]] = currentState[ALWAYS_SEND_PROPS[i]];
  }
  
  // Only include changed properties
  for (let i = 0; i < DELTA_TRACKED_PROPS.length; i++) {
    const prop = DELTA_TRACKED_PROPS[i];
    const current = currentState[prop];
    const previous = previousState[prop];
    
    // Deep compare for objects (knockbackVelocity, snowballs, pumoArmy)
    if (typeof current === 'object' && current !== null) {
      if (Array.isArray(current)) {
        // PERFORMANCE: Shallow array comparison instead of JSON.stringify
        if (!shallowArrayEquals(current, previous)) {
          delta[prop] = current;
        }
      } else {
        // For objects like knockbackVelocity
        if (!previous || current.x !== previous.x || current.y !== previous.y) {
          delta[prop] = current;
        }
      }
    } else if (current !== previous) {
      delta[prop] = current;
    }
  }
  
  return delta;
}

// PERFORMANCE: Store shallow copy of player state for comparison.
// Replaces JSON.parse(JSON.stringify()) which was the most expensive per-tick operation.
// Safe because snowballs/pumoArmy elements and knockbackVelocity are flat objects (no nesting).
function clonePlayerState(player) {
  const clone = {};
  for (let i = 0; i < ALL_TRACKED_PROPS.length; i++) {
    const prop = ALL_TRACKED_PROPS[i];
    const value = player[prop];
    if (value !== undefined) {
      if (Array.isArray(value)) {
        // Shallow clone each element (flat objects like snowballs/pumoArmy)
        clone[prop] = value.map(item => ({...item}));
      } else if (typeof value === 'object' && value !== null) {
        // Shallow clone flat objects (knockbackVelocity: {x, y})
        clone[prop] = {...value};
      } else {
        clone[prop] = value;
      }
    }
  }
  return clone;
}

// ============================================
// PERFORMANCE: Screen Shake Throttling
// Prevent multiple screen shakes from stacking
// ============================================
const SCREEN_SHAKE_MIN_INTERVAL = 100; // Minimum ms between screen shakes

function emitThrottledScreenShake(room, io, shakeData) {
  const now = Date.now();
  // Initialize lastScreenShakeTime if it doesn't exist
  if (room.lastScreenShakeTime === undefined) {
    room.lastScreenShakeTime = 0;
  }
  if (now - room.lastScreenShakeTime < SCREEN_SHAKE_MIN_INTERVAL) {
    // Skip this shake, too soon after the last one
    return;
  }
  room.lastScreenShakeTime = now;
  io.in(room.id).emit("screen_shake", shakeData);
}

let gameLoop = null;
let staminaRegenCounter = 0;
// TICK_RATE and BROADCAST_EVERY_N_TICKS from constants.js (32 Hz broadcast, client interpolates to 60fps)
let broadcastTickCounter = 0;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.185; // Scaled for camera zoom (was 0.25)
const GROUND_LEVEL = 278;
const HITBOX_DISTANCE_VALUE = Math.round(77 * 0.96); // ~74 (scaled for camera zoom)
const SLAP_HITBOX_DISTANCE_VALUE = Math.round(155 * 0.96); // ~149 (scaled for camera zoom)
const SLAP_PARRY_WINDOW = 200; // Updated to 200ms window for parry to account for longer slap animation
const SLAP_PARRY_KNOCKBACK_VELOCITY = 1.5; // Reduced knockback for parried attacks
const THROW_RANGE = Math.round(166 * 0.96); // ~159 (scaled for camera zoom)
const GRAB_RANGE = Math.round(172 * 0.96); // ~165px - command grab range (scaled for camera zoom)
const GRAB_PUSH_SPEED = 0.3; // Push movement speed
const GRAB_PUSH_DURATION = 650;

// Dohyo edge fall physics - fast heavy drop with maintained horizontal momentum
const DOHYO_FALL_SPEED = 5.93; // Scaled for camera zoom (was 8)
const DOHYO_FALL_DEPTH = 37; // Scaled for camera zoom (was 50)
const DOHYO_FALL_HORIZONTAL_RETENTION = 0.98; // Maintain horizontal momentum while falling

// Add power-up types
const POWER_UP_TYPES = {
  SPEED: "speed",
  POWER: "power",
  SNOWBALL: "snowball",
  PUMO_ARMY: "pumo_army",
  THICK_BLUBBER: "thick_blubber",
};

// Add power-up effects
const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.4, // 40% speed increase (only affects movement, not knockback)
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase (ONLY power-up that affects knockback)
  [POWER_UP_TYPES.SNOWBALL]: 1.0, // No stat multiplier, just projectile ability
  [POWER_UP_TYPES.PUMO_ARMY]: 1.0, // No stat multiplier, just spawns army
  [POWER_UP_TYPES.THICK_BLUBBER]: 1.0, // No stat multiplier, just hit absorption
};

const GRAB_DURATION = 1500; // 1.5 seconds total grab duration
const GRAB_ATTEMPT_DURATION = 1000; // 1 second for attempt animation

// Note: Using MAP_LEFT_BOUNDARY and MAP_RIGHT_BOUNDARY from gameUtils.js for ring-out boundaries

// ============================================
// ICE PHYSICS SYSTEM - Penguin Sumo on Icy Dohyo
// Snappy momentum for small arena, with committed slide mechanic
// ============================================

// Base movement - SLOWER pace for better movement plays
const ICE_ACCELERATION = 0.08;          // Slower acceleration - more deliberate movement
const ICE_MAX_SPEED = 1.3;              // Lower top speed - gives time to react
const ICE_INITIAL_BURST = 0.28;         // Smaller push-off burst

// Friction - still slippery but more controlled
const ICE_COAST_FRICTION = 0.982;       // Slightly more friction when coasting
const ICE_MOVING_FRICTION = 0.988;      // Slight friction while moving
const ICE_BRAKE_FRICTION = 0.80;        // Strong braking
const ICE_STOP_THRESHOLD = 0.025;       // Velocity threshold for full stop

// Direction changes
const ICE_TURN_BURST = 0.18;            // Burst in new direction after braking

// POWER SLIDE (C key) - commit to momentum for speed boost
const SLIDE_SPEED_BOOST = 1.42;         // 42% faster while power sliding (minor increase from 35%)
const SLIDE_MAX_SPEED = 2.1;            // Max speed during power slide
const SLIDE_FRICTION = 0.994;           // Very low friction during slide
const SLIDE_MIN_VELOCITY = 0.5;         // Minimum velocity to start power slide
const SLIDE_MAINTAIN_VELOCITY = 0.35;   // Maintain threshold
const SLIDE_BRAKE_FRICTION = 0.76;      // Can still brake during slide but slower
const SLIDE_STRAFE_TIME_REQUIRED = 100; // Must be strafing for 100ms before power slide allowed

// Dodge landing momentum for ice physics
const DODGE_SLIDE_MOMENTUM = 1.1;       // Momentum when landing from dodge
const DODGE_POWERSLIDE_BOOST = 1.95;    // Boost if holding C on dodge landing

// Edge awareness
const DOHYO_EDGE_PANIC_ZONE = 89;       // Scaled for camera zoom (was 120)
const ICE_EDGE_BRAKE_BONUS = 0.06;      // EXTRA braking power near edge
const ICE_EDGE_SLIDE_PENALTY = 0.004;   // MORE slippery near edge when not braking

// Legacy aliases for backwards compatibility
const MOVEMENT_ACCELERATION = ICE_ACCELERATION;
const MOVEMENT_DECELERATION = 0.08;
const MAX_MOVEMENT_SPEED = ICE_MAX_SPEED;
const MOVEMENT_MOMENTUM = ICE_COAST_FRICTION;
const MOVEMENT_FRICTION = 0.99;
const ICE_DRIFT_FACTOR = 0.3; // Legacy: momentum kept on direction change
const MIN_MOVEMENT_THRESHOLD = ICE_STOP_THRESHOLD;
const INITIAL_MOVEMENT_BURST = ICE_INITIAL_BURST;

// Helper: Check if player is near the edge of dohyo
function isNearDohyoEdge(playerX) {
  const leftEdgeDistance = playerX - MAP_LEFT_BOUNDARY;
  const rightEdgeDistance = MAP_RIGHT_BOUNDARY - playerX;
  return Math.min(leftEdgeDistance, rightEdgeDistance) < DOHYO_EDGE_PANIC_ZONE;
}

// Helper: Get distance to nearest edge (for intensity scaling)
function getEdgeProximity(playerX) {
  const leftEdgeDistance = playerX - MAP_LEFT_BOUNDARY;
  const rightEdgeDistance = MAP_RIGHT_BOUNDARY - playerX;
  const nearestEdge = Math.min(leftEdgeDistance, rightEdgeDistance);
  // Return 0-1 value (1 = at edge, 0 = far from edge)
  return Math.max(0, 1 - (nearestEdge / DOHYO_EDGE_PANIC_ZONE));
}

// Helper: Calculate ice friction based on player state
function getIceFriction(player, isActiveBraking, nearEdge, edgeProximity) {
  // Power sliding has its own friction rules
  if (player.isPowerSliding) {
    if (isActiveBraking) {
      // Can brake during slide but it's harder
      let friction = SLIDE_BRAKE_FRICTION;
      if (nearEdge) friction -= ICE_EDGE_BRAKE_BONUS * edgeProximity;
      return friction;
    }
    // Power slide = very low friction
    return SLIDE_FRICTION;
  }
  
  if (isActiveBraking) {
    // BRAKING: Strong friction to slow down
    let friction = ICE_BRAKE_FRICTION;
    // Near edge = even MORE braking power (dig in!)
    if (nearEdge) {
      friction -= ICE_EDGE_BRAKE_BONUS * edgeProximity;
    }
    return friction;
  } else if (player.keys.a || player.keys.d) {
    // MOVING: Moderate friction while actively moving
    return ICE_MOVING_FRICTION;
  } else {
    // COASTING: Moderate slide
    let friction = ICE_COAST_FRICTION;
    // Near edge without braking = more slippery (danger!)
    if (nearEdge) {
      friction += ICE_EDGE_SLIDE_PENALTY * edgeProximity;
    }
    return friction;
  }
}

// Dodge physics constants - smooth graceful arc with weight
const DODGE_DURATION = 450; // Longer for bigger, more dramatic arc
const DODGE_BASE_SPEED = 2.2; // Base horizontal speed during dodge
const DODGE_HOP_HEIGHT = 70; // Scaled for camera zoom (was 95)
const DODGE_LANDING_MOMENTUM = 0.35; // Momentum burst on landing
const DODGE_CANCEL_DURATION = 100; // Smooth but quick slam-down
const DODGE_CANCEL_SPEED_MULT = 0.2; // Some horizontal movement during cancel

// Grab walking tuning
const GRAB_WALK_SPEED_MULTIPLIER = 0.8; // Slightly slower than normal strafing
const GRAB_WALK_ACCEL_MULTIPLIER = 0.7; // Slightly lower acceleration than normal strafing

// Grab startup (anticipation) tuning — near-instant, no hop, no forward movement
const GRAB_STARTUP_DURATION_MS = 70; // Near-instant startup (~4 frames) — just enough for visual telegraph
const GRAB_STARTUP_HOP_HEIGHT = 0; // No hop — grab is a grounded technique
const SLAP_ATTACK_STARTUP_MS = 55; // Slap becomes active after 55ms (for grab vs slap timing)

// Grab whiff recovery — big vulnerable window if grab misses
const GRAB_WHIFF_RECOVERY_MS = 450; // Whiff recovery duration (fully vulnerable to punishment)
const GRAB_WHIFF_STUMBLE_VEL = 0.4; // Slight forward stumble velocity during whiff

// Grab tech — both players grab simultaneously, freeze then push apart
const GRAB_TECH_FREEZE_MS = 350; // Freeze duration before separation (shake/jiggle phase)
const GRAB_TECH_FORCED_DISTANCE = 44; // Scaled for camera zoom (was 60)
const GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER = 1.4; // Larger gap during pull attempt (vs 1.0 for normal grab)
const GRAB_TECH_TWEEN_DURATION = 120; // Duration of forced separation tween (ms)
const GRAB_TECH_RESIDUAL_VEL = 1.2; // Residual velocity fed into ice sliding after forced separation
const GRAB_TECH_INPUT_LOCK_MS = 600; // Total input lock (freeze + separation slide)
const GRAB_TECH_ANIM_DURATION_MS = 700; // Total tech animation duration (freeze + recovery)

// Ring-out cutscene tuning
const RINGOUT_THROW_DURATION_MS = 400; // Match normal throw timing for consistent physics

// Parry knockback - velocity based (causes sliding on ice)
const RAW_PARRY_KNOCKBACK = 0.49; // Knockback velocity for charged attack parries
const RAW_PARRY_STUN_DURATION = 1000; // 1 second stun duration
const RAW_PARRY_SLAP_KNOCKBACK = 0.5; // Lighter knockback for slap parries
const PERFECT_PARRY_KNOCKBACK = 0.65; // Slightly stronger than regular parry
const RAW_PARRY_SLAP_STUN_DURATION = 500; // Reduced stun duration for slap attack parries
const PERFECT_PARRY_WINDOW = 100; // 100ms window for perfect parries
const PERFECT_PARRY_SUCCESS_DURATION = 2000; // 2 seconds - parrier holds success pose
const PERFECT_PARRY_ATTACKER_STUN_DURATION = 1100; // 1.1 second stun duration for perfect parry
const PERFECT_PARRY_ANIMATION_LOCK = 600; // 600ms - parrier is locked in parry pose after perfect parry
// Dodge is now stamina-based, no more charge system

// At the ropes constants
const AT_THE_ROPES_DURATION = 1000; // 1 second stun duration

// Knockback immunity system constants
const KNOCKBACK_IMMUNITY_DURATION = 150; // 150ms immunity window

// Stamina regeneration tuning
const STAMINA_REGEN_INTERVAL_MS = 2500; // regen interval
const STAMINA_REGEN_AMOUNT = 8; // per tick

// Knockback immunity helper functions
function canApplyKnockback(player) {
  return !player.knockbackImmune || Date.now() >= player.knockbackImmuneEndTime;
}

function setKnockbackImmunity(player) {
  player.knockbackImmune = true;
  player.knockbackImmuneEndTime = Date.now() + KNOCKBACK_IMMUNITY_DURATION;
}

// Grab break constants
const GRAB_BREAK_STAMINA_COST = 33; // 33% of max stamina to break a grab (used for directional counter breaks)

// Stamina drain constants
const SLAP_ATTACK_STAMINA_COST = 3; // Small cost to not deter spamming
const CHARGED_ATTACK_STAMINA_COST = 9; // 3x slap attack cost
const DODGE_STAMINA_COST = 7; // ~7% of max stamina per dodge (halved from 15)
// Grab stamina drain: 10 stamina over full 1.5s duration
// Drain 1 stamina every 150ms (1500ms / 10 = 150ms per stamina point)
const GRAB_STAMINA_DRAIN_INTERVAL = 150;
const GRAB_BREAK_PUSH_VELOCITY = 1.2; // Push velocity for grab breaks
const GRAB_BREAK_FORCED_DISTANCE = 55; // Even separation distance for both players
const GRAB_BREAK_TWEEN_DURATION = 350; // Knockback slide duration
const GRAB_BREAK_RESIDUAL_VEL = 0; // No residual sliding — players stop cleanly when knockback ends
const GRAB_BREAK_INPUT_LOCK_MS = 350; // Locked during knockback tween only
const GRAB_BREAK_ACTION_LOCK_MS = 350; // Locked during knockback tween only

// ============================================
// NEW GRAB ACTION SYSTEM - Directional grab mechanics
// Push starts IMMEDIATELY on grab connect (burst-with-decay).
// Grabber can interrupt push with pull (backward) or throw (W) during push.
// ============================================
const GRAB_ACTION_WINDOW = 500; // 0.5s window for pull/throw counter attempts
const GRAB_PUSH_BURST_BASE = 2.5;          // Base burst speed when push starts
const GRAB_PUSH_MOMENTUM_TRANSFER = 0.6;   // Multiplier on approach speed added to burst (power slide grab = devastating)
const GRAB_PUSH_DECAY_RATE = 2.2;          // Exponential decay rate — higher = faster slowdown
const GRAB_PUSH_MIN_VELOCITY = 0.15;       // Push ends when speed decays below this
const GRAB_PUSH_MAX_DURATION = 1500;        // Safety cap: push can never exceed this (ms)
const GRAB_PUSH_BACKWARD_GRACE = 150;       // ms before backward input triggers pull during push (prevents accidental pull)
const GRAB_PUSH_STAMINA_DRAIN_INTERVAL = 35; // Drain 1 stamina per 35ms on pushed opponent (~28.6/sec)
const GRAB_PUSH_SEPARATION_OPPONENT_VEL = 1.2; // Velocity given to opponent when push ends
const GRAB_PUSH_SEPARATION_GRABBER_VEL = 0.4;  // Velocity given to grabber when push ends
const GRAB_PUSH_SEPARATION_INPUT_LOCK = 150;    // Brief input lock after push separation (ms)
const PULL_REVERSAL_DISTANCE = 311; // Scaled for camera zoom (was 420)
const PULL_REVERSAL_TWEEN_DURATION = 650; // ms for the pull knockback tween (fast but visible travel)
const PULL_REVERSAL_PULLED_LOCK = 700; // ms input lock for pulled player (exceeds tween, cleared early when tween ends)
const PULL_REVERSAL_PULLER_LOCK = 700; // ms input lock for puller (same as pulled — 0 frame advantage)
const PULL_BOUNDARY_MARGIN = 11; // Scaled for camera zoom (was 15)

// ============================================
// HITSTOP TUNING - Smash Bros style
// Every hit has hitstop to make impacts feel satisfying
// Scales with power - stronger hits freeze longer
// ============================================
const HITSTOP_SLAP_MS = 100;      // Rekka-style hitstop - punchy freeze for each slap impact (6 frames)
const HITSTOP_CHARGED_MIN_MS = 80;  // Minimum charged attack hitstop (5 frames)
const HITSTOP_CHARGED_MAX_MS = 150; // Maximum charged attack hitstop at full power (9 frames)
const HITSTOP_PARRY_MS = 120;     // Parry hitstop - impactful but not too long (7 frames)
const HITSTOP_GRAB_MS = 60;       // Brief hitstop when grab connects (4 frames)
const HITSTOP_THROW_MS = 100;     // Hitstop when throw lands (6 frames)

// Helper to calculate charged attack hitstop based on power (0-1)
function getChargedHitstop(chargePower) {
  // chargePower is typically 0.3 to 1.0
  const normalizedPower = Math.max(0, Math.min(1, (chargePower - 0.3) / 0.7));
  return HITSTOP_CHARGED_MIN_MS + (HITSTOP_CHARGED_MAX_MS - HITSTOP_CHARGED_MIN_MS) * normalizedPower;
}

// Parry visual timing
const PARRY_SUCCESS_DURATION = 500; // How long the parry success pose is held

// Global attack timing constants
const ATTACK_ENDLAG_SLAP_MS = 30;       // Minimal recovery for ultra-spammable slaps
const ATTACK_ENDLAG_CHARGED_MS = 280;   // Longer recovery for charged attacks
const ATTACK_COOLDOWN_MS = 50;          // Minimal cooldown for fast gameplay
const BUFFERED_ATTACK_GAP_MS = 80;      // Fast chaining

function triggerHitstop(room, durationMs) {
  const now = Date.now();
  const target = now + durationMs;
  room.hitstopUntil = Math.max(room.hitstopUntil || 0, target);
}

function isRoomInHitstop(room) {
  return room.hitstopUntil && Date.now() < room.hitstopUntil;
}

// Correct both players' facing to match their current positions (they've switched sides after throw/grab).
// Prevents wonky dodge/attack direction and opponent logic when a player immediately acts after landing.
function correctFacingAfterGrabOrThrow(player, opponent) {
  if (!player || !opponent) return;
  // Face toward the other player (convention: facing -1 = right, 1 = left; player.x < other.x => face right => -1)
  if (player.atTheRopesFacingDirection == null) {
    player.facing = player.x < opponent.x ? -1 : 1;
  }
  if (opponent.atTheRopesFacingDirection == null) {
    opponent.facing = opponent.x < player.x ? -1 : 1;
  }
}

// === DIRECTIONAL GRAB BREAK HELPER ===
// Reusable function for executing a grab break when the grabbed player
// successfully inputs the correct counter-direction during a grab action window.
// Called from both pull reversal counter and throw counter code paths.
function executeDirectionalGrabBreak(grabber, breaker, room, io) {
  // Clear grab states for both
  cleanupGrabStates(grabber, breaker);

  // Animation state
  breaker.isAttemptingGrabThrow = false;
  grabber.isAttemptingGrabThrow = false;

  // Breaker shows parry-success sprite during knockback slide
  breaker.isRawParrySuccess = true;
  setPlayerTimeout(breaker.id, () => { breaker.isRawParrySuccess = false; }, GRAB_BREAK_TWEEN_DURATION, "grabBreakParryAnim");

  // Zero velocities and lock inputs/actions during knockback
  breaker.movementVelocity = 0;
  grabber.movementVelocity = 0;
  breaker.isStrafing = false;
  grabber.isStrafing = false;

  const inputLockUntil = Date.now() + GRAB_BREAK_INPUT_LOCK_MS;
  breaker.inputLockUntil = Math.max(breaker.inputLockUntil || 0, inputLockUntil);
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, inputLockUntil);
  breaker.actionLockUntil = Date.now() + GRAB_BREAK_ACTION_LOCK_MS;
  grabber.actionLockUntil = Date.now() + GRAB_BREAK_ACTION_LOCK_MS;

  io.in(room.id).emit("grab_break", {
    breakerId: breaker.id,
    grabberId: grabber.id,
    breakerX: breaker.x,
    grabberX: grabber.x,
    breakId: `grab-break-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    breakerPlayerNumber: breaker.fighter === "player 1" ? 1 : 2,
  });

  triggerHitstop(room, 60);

  // === IMMEDIATE FORCED SEPARATION ===
  const dir = breaker.x < grabber.x ? -1 : 1;
  const now = Date.now();

  let breakerTarget = breaker.x + dir * GRAB_BREAK_FORCED_DISTANCE;
  breakerTarget = Math.max(MAP_LEFT_BOUNDARY, Math.min(breakerTarget, MAP_RIGHT_BOUNDARY));
  breaker.isGrabBreakSeparating = true;
  breaker.grabBreakSepStartTime = now;
  breaker.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
  breaker.grabBreakStartX = breaker.x;
  breaker.grabBreakTargetX = breakerTarget;
  breaker.grabTechResidualVel = dir * GRAB_BREAK_RESIDUAL_VEL;

  let grabberTarget = grabber.x + (-dir) * GRAB_BREAK_FORCED_DISTANCE;
  grabberTarget = Math.max(MAP_LEFT_BOUNDARY, Math.min(grabberTarget, MAP_RIGHT_BOUNDARY));
  grabber.isGrabBreakSeparating = true;
  grabber.grabBreakSepStartTime = now;
  grabber.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
  grabber.grabBreakStartX = grabber.x;
  grabber.grabBreakTargetX = grabberTarget;
  grabber.grabTechResidualVel = (-dir) * GRAB_BREAK_RESIDUAL_VEL;

  // Cooldown to prevent immediate re-grab (both players, matches grab tech)
  grabber.grabCooldown = true;
  breaker.grabCooldown = true;
  setPlayerTimeout(grabber.id, () => { grabber.grabCooldown = false; }, 500, "grabBreakCooldown");
  setPlayerTimeout(breaker.id, () => { breaker.grabCooldown = false; }, 500, "grabBreakCooldown");
}

// === GRAB SEPARATION HELPER ===
// When push velocity decays to zero or max duration reached.
// Uses VELOCITY-BASED separation — both players slide apart on ice physics.
// No tween; ice friction handles deceleration naturally.
function executeGrabSeparation(grabber, opponent, room, io) {
  // Capture push direction before cleanup
  const pushDirection = grabber.facing === -1 ? 1 : -1;

  // Clear grab states for both
  cleanupGrabStates(grabber, opponent);

  // Set separation state on both players (for distinct animation)
  grabber.isGrabSeparating = true;
  opponent.isGrabSeparating = true;

  // Give both players velocity — ice physics handle deceleration naturally
  // Opponent slides in push direction (away from grabber), grabber gets small forward momentum
  opponent.movementVelocity = pushDirection * GRAB_PUSH_SEPARATION_OPPONENT_VEL;
  grabber.movementVelocity = pushDirection * GRAB_PUSH_SEPARATION_GRABBER_VEL;
  opponent.isStrafing = false;
  grabber.isStrafing = false;

  // Brief input lock (shorter than old tween — ice physics create the drama now)
  const inputLockUntil = Date.now() + GRAB_PUSH_SEPARATION_INPUT_LOCK;
  opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, inputLockUntil);
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, inputLockUntil);

  // Correct facing
  correctFacingAfterGrabOrThrow(grabber, opponent);

  // Clear separation animation flag after a short duration
  setPlayerTimeout(
    grabber.id,
    () => { grabber.isGrabSeparating = false; },
    300,
    "grabSepAnim"
  );
  setPlayerTimeout(
    opponent.id,
    () => { opponent.isGrabSeparating = false; },
    300,
    "grabSepAnim"
  );

  // Short cooldown to prevent immediate re-grab
  grabber.grabCooldown = true;
  setPlayerTimeout(
    grabber.id,
    () => { grabber.grabCooldown = false; },
    300,
    "grabSepCooldown"
  );

  // Emit distinct event for client (no green flash VFX)
  io.in(room.id).emit("grab_separate", {
    grabberId: grabber.id,
    opponentId: opponent.id,
    grabberX: grabber.x,
    opponentX: opponent.x,
  });
}

// === GRAB TECH HELPER ===
// When both players grab simultaneously (one finishes startup while other is in startup).
// Two-phase sequence: FREEZE (150ms shake) → SEPARATION (knockback push apart).
// player1 = the player whose startup just completed (shows grabbing sprite)
// player2 = the opponent who was already in startup (shows parry/teching sprite)
function executeGrabTech(player1, player2, room, io) {
  // Clear startup/grab states for both
  player1.isGrabStartup = false;
  player1.isGrabbingMovement = false;
  player1.isWhiffingGrab = false;
  player1.grabMovementVelocity = 0;
  player1.grabState = GRAB_STATES.INITIAL;
  player1.grabAttemptType = null;
  player1.y = GROUND_LEVEL;

  player2.isGrabStartup = false;
  player2.isGrabbingMovement = false;
  player2.isWhiffingGrab = false;
  player2.grabMovementVelocity = 0;
  player2.grabState = GRAB_STATES.INITIAL;
  player2.grabAttemptType = null;
  player2.y = GROUND_LEVEL;

  // === PHASE 1: FREEZE (150ms) ===
  // Both players locked in place, client shakes them. TECH! effect appears now.
  player1.isGrabTeching = true;
  player2.isGrabTeching = true;

  // Assign roles for sprite differentiation on the client
  // player1 (who just completed startup) = 'grabber' sprite
  // player2 (who was already in startup) = 'techer' sprite (parry-like)
  player1.grabTechRole = 'grabber';
  player2.grabTechRole = 'techer';

  // Zero velocity during freeze — no movement, just shake
  player1.movementVelocity = 0;
  player2.movementVelocity = 0;
  player1.isStrafing = false;
  player2.isStrafing = false;

  // Full input + action lock for entire tech sequence
  const inputLockUntil = Date.now() + GRAB_TECH_INPUT_LOCK_MS;
  player1.inputLockUntil = Math.max(player1.inputLockUntil || 0, inputLockUntil);
  player2.inputLockUntil = Math.max(player2.inputLockUntil || 0, inputLockUntil);
  player1.actionLockUntil = Date.now() + GRAB_TECH_ANIM_DURATION_MS;
  player2.actionLockUntil = Date.now() + GRAB_TECH_ANIM_DURATION_MS;

  // Clear any pending grab movement timeouts
  timeoutManager.clearPlayerSpecific(player1.id, "grabMovementTimeout");
  timeoutManager.clearPlayerSpecific(player2.id, "grabMovementTimeout");

  // Emit for client VFX — blue/frost TECH! effect appears during freeze
  const centerX = (player1.x + player2.x) / 2;
  const centerY = (player1.y + player2.y) / 2;
  io.in(room.id).emit("grab_tech", {
    player1Id: player1.id,
    player2Id: player2.id,
    x: centerX,
    y: centerY,
    techId: `grab-tech-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    grabberFacing: player1.x < player2.x ? 1 : -1,
  });

  // Trigger brief hitstop for impact feel at start of freeze
  triggerHitstop(room, 60);

  // === PHASE 2: FORCED SEPARATION TWEEN (after freeze ends) ===
  setPlayerTimeout(player1.id, () => {
    // End freeze phase — clear shake animation states
    player1.isGrabTeching = false;
    player2.isGrabTeching = false;
    player1.grabTechRole = null;
    player2.grabTechRole = null;

    // Use the grab break separation tween system for forced distance
    const dir = player1.x < player2.x ? -1 : 1;
    const now = Date.now();

    // Player 1 slides away
    let p1Target = player1.x + dir * GRAB_TECH_FORCED_DISTANCE;
    p1Target = Math.max(MAP_LEFT_BOUNDARY, Math.min(p1Target, MAP_RIGHT_BOUNDARY));
    player1.isGrabBreakSeparating = true;
    player1.grabBreakSepStartTime = now;
    player1.grabBreakSepDuration = GRAB_TECH_TWEEN_DURATION;
    player1.grabBreakStartX = player1.x;
    player1.grabBreakTargetX = p1Target;
    // Store residual velocity to apply when tween ends
    player1.grabTechResidualVel = dir * GRAB_TECH_RESIDUAL_VEL;

    // Player 2 slides the opposite way
    let p2Target = player2.x + (-dir) * GRAB_TECH_FORCED_DISTANCE;
    p2Target = Math.max(MAP_LEFT_BOUNDARY, Math.min(p2Target, MAP_RIGHT_BOUNDARY));
    player2.isGrabBreakSeparating = true;
    player2.grabBreakSepStartTime = now;
    player2.grabBreakSepDuration = GRAB_TECH_TWEEN_DURATION;
    player2.grabBreakStartX = player2.x;
    player2.grabBreakTargetX = p2Target;
    player2.grabTechResidualVel = (-dir) * GRAB_TECH_RESIDUAL_VEL;
  }, GRAB_TECH_FREEZE_MS, "grabTechSeparation");

  // Short grab cooldown to prevent instant re-grab
  player1.grabCooldown = true;
  player2.grabCooldown = true;
  setPlayerTimeout(player1.id, () => { player1.grabCooldown = false; }, 500, "grabTechCooldown");
  setPlayerTimeout(player2.id, () => { player2.grabCooldown = false; }, 500, "grabTechCooldown");
}

// === GRAB WHIFF RECOVERY HELPER ===
// When grab misses (opponent not in range). Big vulnerable recovery window.
function executeGrabWhiff(player) {
  player.isGrabStartup = false;
  player.isGrabbingMovement = false;
  player.y = GROUND_LEVEL;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;

  // Enter whiff recovery — fully vulnerable
  player.isGrabWhiffRecovery = true;
  player.isWhiffingGrab = true; // Legacy flag for existing client checks

  // Clear attempt timestamps so stale values can't trigger throw techs or grab priority
  player.lastGrabAttemptTime = 0;
  player.lastThrowAttemptTime = 0;

  player.movementVelocity = 0;
  player.isStrafing = false;

  // Lock actions during whiff recovery
  player.actionLockUntil = Date.now() + GRAB_WHIFF_RECOVERY_MS;

  // Grab cooldown = recovery duration (recovery IS the punishment)
  player.grabCooldown = true;

  // Clear whiff recovery after duration
  setPlayerTimeout(
    player.id,
    () => {
      player.isGrabWhiffRecovery = false;
      player.isWhiffingGrab = false;
      player.grabCooldown = false;
      // Check if we should restart charging after grab whiff completes
      if (shouldRestartCharging(player)) {
        startCharging(player);
      }
    },
    GRAB_WHIFF_RECOVERY_MS,
    "grabWhiffRecovery"
  );

  // Clear any pending grab movement timeouts
  timeoutManager.clearPlayerSpecific(player.id, "grabMovementTimeout");
}

// === BUFFERED INPUT ACTIVATION AFTER GRAB/THROW ===
// Enables frame-1 reversals: if a player holds an input during an unactionable grab/throw state,
// that input activates on the first possible frame (like invincible reversals / EX DP in fighting games).
// Called for BOTH the grabber and the grabbed player when a grab expires or a throw lands.
function activateBufferedInputAfterGrab(player, rooms) {
  // Don't activate if player is in a state that blocks actions
  if (player.isAtTheRopes || player.isThrowLanded || player.isHit ||
      player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating) return;

  // Priority 0: Buffered dodge (spammed shift while grabbed/thrown) - execute frame 1 when freed
  if (
    player.bufferedAction &&
    player.bufferedAction.type === "dodge" &&
    player.bufferExpiryTime &&
    Date.now() < player.bufferExpiryTime &&
    player.stamina >= DODGE_STAMINA_COST
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
    player.isDodgeCancelling = false;
    player.dodgeCancelStartTime = 0;
    player.dodgeCancelStartY = 0;
    player.dodgeStartTime = Date.now();
    player.dodgeEndTime = Date.now() + DODGE_DURATION;
    player.dodgeStartX = player.x;
    player.dodgeStartY = player.y;
    player.dodgeDirection = direction;
    player.currentAction = "dodge";
    player.actionLockUntil = Date.now() + 100;
    player.justLandedFromDodge = false;
    player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
    clearChargeState(player, true);
    setPlayerTimeout(player.id, () => {
      if (player.isDodging && !player.isDodgeCancelling) {
        const landingDir = player.dodgeDirection || 0;
        if (landingDir !== 0 && Math.abs(player.movementVelocity) < 0.1) {
          if (player.keys.c || player.keys.control) {
            player.movementVelocity = landingDir * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
            player.isPowerSliding = true;
          } else {
            player.movementVelocity = landingDir * DODGE_SLIDE_MOMENTUM;
          }
          player.justLandedFromDodge = true;
        }
        player.isDodging = false;
        
        // Immediately update facing direction on dodge landing (buffered dodge fallback)
        const dodgeRoom = rooms.find(r => r.players.some(p => p.id === player.id));
        if (dodgeRoom) {
          const dodgeOpponent = dodgeRoom.players.find(p => p.id !== player.id);
          if (dodgeOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
            player.facing = player.x < dodgeOpponent.x ? -1 : 1;
          }
        }
      }
    }, DODGE_DURATION, "bufferedDodge");
    return;
  }

  // Priority 1: Raw parry (spacebar) - defensive reversal (highest priority)
  if (player.keys[" "] && !player.grabBreakSpaceConsumed) {
    player.isRawParrying = true;
    player.rawParryStartTime = Date.now();
    player.rawParryMinDurationMet = false;
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.movementVelocity = 0;
    player.isStrafing = false;
    player.isPowerSliding = false;
    player.isCrouchStance = false;
    player.isCrouchStrafing = false;
    player.hasPendingSlapAttack = false;
    clearChargeState(player, true);
    return;
  }

  // Priority 2: Dodge (shift) - evasive option
  if (player.keys.shift && !player.keys.mouse2 && player.stamina >= DODGE_STAMINA_COST) {
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.movementVelocity = 0;
    player.isStrafing = false;
    player.isPowerSliding = false;
    player.isBraking = false;
    player.isDodging = true;
    player.isDodgeCancelling = false;
    player.dodgeCancelStartTime = 0;
    player.dodgeCancelStartY = 0;
    player.dodgeStartTime = Date.now();
    player.dodgeEndTime = Date.now() + DODGE_DURATION;
    player.dodgeStartX = player.x;
    player.dodgeStartY = player.y;
    player.currentAction = "dodge";
    player.actionLockUntil = Date.now() + 100;
    player.justLandedFromDodge = false;
    player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
    clearChargeState(player, true);

    // Dodge direction: toward held key, or away from opponent by default
    if (player.keys.a) {
      player.dodgeDirection = -1;
    } else if (player.keys.d) {
      player.dodgeDirection = 1;
    } else {
      player.dodgeDirection = player.facing === -1 ? 1 : -1;
    }

    // Safety timeout - game loop tick handles dodge physics, this is a fallback
    setPlayerTimeout(player.id, () => {
      if (player.isDodging && !player.isDodgeCancelling) {
        const landingDir = player.dodgeDirection || 0;
        if (landingDir !== 0 && Math.abs(player.movementVelocity) < 0.1) {
          if (player.keys.c || player.keys.control) {
            player.movementVelocity = landingDir * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
            player.isPowerSliding = true;
          } else {
            player.movementVelocity = landingDir * DODGE_SLIDE_MOMENTUM;
          }
          player.justLandedFromDodge = true;
        }
        player.isDodging = false;
        
        // Immediately update facing direction on dodge landing (buffered dodge fallback)
        const dodgeRoom = rooms.find(r => r.players.some(p => p.id === player.id));
        if (dodgeRoom) {
          const dodgeOpponent = dodgeRoom.players.find(p => p.id !== player.id);
          if (dodgeOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
            player.facing = player.x < dodgeOpponent.x ? -1 : 1;
          }
        }
      }
    }, DODGE_DURATION, "bufferedDodge");
    return;
  }

  // Priority 3: Mouse1 held — start fresh hold timer so normal slap/charge logic applies
  // (charge after 200ms hold, slap only on quick tap release)
  // Do NOT auto-fire slap — holding mouse1 should lead to charging, not an instant slap
  if (player.keys.mouse1) {
    player.mouse1PressTime = Date.now();
    return;
  }

  // Priority 4: Grab (mouse2) - uses buffer flag since grab initiation has complex
  // nested timeouts; the input handler will process it on the next cycle
  if (player.keys.mouse2 && !player.grabCooldown) {
    player.postGrabInputBuffer = true;
    return;
  }

  // Priority 5: Charge attack (mouse1 held) - slower offensive option
  // Mouse1 hold-to-charge will be handled by the game loop threshold check
  if (player.keys.mouse1) {
    player.mouse1PressTime = player.mouse1PressTime || Date.now();
    return;
  }
}

// Lobby color options - CPU picks randomly from these (excluding player's color)
const LOBBY_COLORS = [
  "#252525", "#000080", "#9932CC", "#32CD32", "#FF1493", "#FF8C00",
  "#FFB6C1", "#FFD700", "#5D3A1A", "#A8A8A8", "#5BC0DE", "#800000",
  "rainbow", "fire", "vaporwave", "camo", "galaxy", "gold",
];

// CPU Player creation helper - accepts unique ID for concurrent game support
// CPU's mawashiColor is set when human readies (see ready_count handler)
function createCPUPlayer(uniqueId) {
  const cpuPlayerId = uniqueId || `CPU_PLAYER_${Date.now()}`;
  return {
    id: cpuPlayerId,
    isCPU: true,
    fighter: "player 2",
    color: "salmon",
    mawashiColor: "#DC143C", // Placeholder until human readies; then random color
    isJumping: false,
    isAttacking: false,
    throwCooldown: false,
    grabCooldown: false,
    isChargingAttack: false,
    chargeStartTime: 0,
    chargeMaxDuration: 2000,
    chargeAttackPower: 0,
    chargingFacingDirection: null,
    slapFacingDirection: null,
    isSlapAttack: false,
    slapAnimation: 2,
    isThrowing: false,
    isThrowingSalt: false,
    saltCooldown: false,
    snowballCooldown: false,
    lastSnowballTime: 0,
    snowballs: [],
    isThrowingSnowball: false,
    pumoArmyCooldown: false,
    pumoArmy: [],
    isSpawningPumoArmy: false,
    throwStartTime: 0,
    throwEndTime: 0,
    throwOpponent: null,
    throwingFacingDirection: null,
    beingThrownFacingDirection: null,
    isGrabbing: false,
    isGrabWalking: false,
    isGrabbingMovement: false,
    isGrabStartup: false,
    isWhiffingGrab: false,
    isGrabWhiffRecovery: false,
    isGrabTeching: false,
    grabTechRole: null, // 'grabber' or 'techer' — determines sprite during tech
    grabTechResidualVel: 0, // Residual sliding velocity after tech forced separation
    isGrabClashing: false,
    grabClashStartTime: 0,
    grabClashInputCount: 0,
    grabMovementStartTime: 0,
    grabMovementDirection: 0,
    grabMovementVelocity: 0,
    grabStartupStartTime: 0,
    grabStartupDuration: 0,
    grabStartTime: 0,
    grabbedOpponent: null,
    // New grab action system states
    isGrabPushing: false,
    isBeingGrabPushed: false,
    isAttemptingPull: false,
    isBeingPullReversaled: false,
    pullReversalPullerId: null,
    isGrabSeparating: false,
    isGrabBellyFlopping: false,
    isBeingGrabBellyFlopped: false,
    isGrabFrontalForceOut: false,
    isBeingGrabFrontalForceOut: false,
    grabActionStartTime: 0,
    grabActionType: null, // "push", "pull", "throw" (expandable for future "push_down" etc.)
    lastGrabPushStaminaDrainTime: 0,
    isAtBoundaryDuringGrab: false,
    grabDurationPaused: false, // True when an action (pull/throw) extends grab beyond duration
    grabDurationPausedAt: 0, // Timestamp when duration was paused
    grabPushEndTime: 0, // Legacy field (kept for compatibility)
    grabPushStartTime: 0, // When burst-decay push processing began (set on first tick after hitstop)
    grabApproachSpeed: 0, // Captured approach velocity at grab connect (for momentum transfer)
    grabDecisionMade: false, // Whether the grabber has started an action (always true with immediate push)
    isThrowTeching: false,
    throwTechCooldown: false,
    isSlapParrying: false,
    slapParryKnockbackVelocity: 0,
    slapParryImmunityUntil: 0,
    lastThrowAttemptTime: 0,
    lastGrabAttemptTime: 0,
    isStrafing: false,
    isBraking: false, // ICE PHYSICS: True when actively braking (holding opposite direction while sliding)
    isPowerSliding: false, // ICE PHYSICS: True when power sliding (C key held)
    strafeStartTime: 0, // ICE PHYSICS: When current strafe direction started (for power slide requirement)
    isCrouchStance: false,
    isCrouchStrafing: false,
    isRawParrying: false,
    rawParryStartTime: 0,
    rawParryMinDurationMet: false,
    isRawParryStun: false,
    perfectParryStunStartTime: 0,
    perfectParryStunBaseTimeout: null,
    isRawParrySuccess: false,
    isPerfectRawParrySuccess: false,
    isAtTheRopes: false,
    atTheRopesStartTime: 0,
    atTheRopesFacingDirection: null,
    dodgeDirection: null,
    dodgeEndTime: 0,
    isDodgeCancelling: false,
    dodgeCancelStartTime: 0,
    dodgeCancelStartY: 0,
    isReady: false,
    isHit: false,
    isAlreadyHit: false,
    isDead: false,
    isBowing: false,
    facing: -1,
    stamina: 100,
    x: 845,
    y: GROUND_LEVEL,
    knockbackVelocity: { x: 0, y: 0 },
    movementVelocity: 0,
    // Visual clarity timing states
    isInStartupFrames: false,
    startupEndTime: 0,
    isInEndlag: false,
    endlagEndTime: 0,
    attackCooldownUntil: 0,
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
      e: false,
      f: false,
      c: false,
      control: false,
      mouse1: false,
      mouse2: false,
    },
    wins: [],
    bufferedAction: null,
    bufferExpiryTime: 0,
    wantsToRestartCharge: false,
    mouse1HeldDuringAttack: false,
    mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
    mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
    knockbackImmune: false,
    knockbackImmuneEndTime: 0,
    activePowerUp: null,
    powerUpMultiplier: 1,
    selectedPowerUp: null,
    sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    hitAbsorptionUsed: false,
    hitCounter: 0,
    lastHitTime: 0,
    lastSlapHitLandedTime: 0,
    lastCheckedAttackTime: 0,
    hasPendingSlapAttack: false,
    mouse1JustPressed: false,
    mouse1JustReleased: false,
    mouse2JustPressed: false,
    mouse2JustReleased: false,
    shiftJustPressed: false,
    eJustPressed: false,
    wJustPressed: false,
    fJustPressed: false,
    spaceJustPressed: false,
    attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
    attackAttemptTime: 0, // When attack execution started (for counter hit detection)
    isOverlapping: false,
    overlapStartTime: null,
    chargeCancelled: false,
    isGrabBreaking: false,
    isGrabBreakCountered: false,
    grabBreakSpaceConsumed: false,
    postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
    isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
    isRingOutThrowCutscene: false,
    ringOutThrowDistance: 0,
    isRingOutFreezeActive: false,
    ringOutFreezeEndTime: 0,
    ringOutThrowDirection: null,
    inputLockUntil: 0,
    isFallingOffDohyo: false,
  };
}

function handlePowerUpSelection(room) {
  // Reset power-up selection state for the room
  room.powerUpSelectionPhase = true;
  room.playersSelectedPowerUps = {};
  room.playerAvailablePowerUps = {};

  const allPowerUps = Object.values(POWER_UP_TYPES);

  // Generate individual randomized lists for each player
  room.players.forEach((player) => {
    // Mark player as in ritual phase (showing ritual animation)
    player.isInRitualPhase = true;
    
    // Randomly select 3 out of 4 power-ups for this player
    const shuffled = [...allPowerUps].sort(() => Math.random() - 0.5);
    const availablePowerUps = shuffled.slice(0, 3); // Take first 3 from shuffled array

    // Store available power-ups for this player
    room.playerAvailablePowerUps[player.id] = availablePowerUps;

    // Auto-select power-up for CPU player after short delay (gives human time to see options)
    if (player.isCPU) {
      setTimeout(() => {
        // Make sure room and player still exist
        if (!room || !room.players || !room.players.includes(player)) return;
        
        const randomPowerUp =
          availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
        player.selectedPowerUp = randomPowerUp;
        room.playersSelectedPowerUps[player.id] = randomPowerUp;
        // CPU should also throw salt and transition after selection
        handleSaltThrowAndPowerUp(player, room);
      }, 2500); // 2.5 seconds after power-up selection starts
    }
  });

  // Add a small delay to ensure clients are ready to receive the event
  setTimeout(() => {
    // Double-check that room still exists and is in power-up selection phase
    if (room && room.powerUpSelectionPhase && room.players.length === 2) {
      room.players.forEach((player) => {
        // Skip sending to CPU players (they don't have real sockets)
        if (player.isCPU) return;

        const availablePowerUps = room.playerAvailablePowerUps[player.id];

        // Send individual power-up list to each player
        io.to(player.id).emit("power_up_selection_start", {
          availablePowerUps: availablePowerUps,
        });
      });

      // For CPU rooms, send selection status showing CPU already selected
      if (room.isCPURoom) {
        const selectedCount = Object.keys(room.playersSelectedPowerUps).length;
        room.players.forEach((player) => {
          if (!player.isCPU) {
            io.to(player.id).emit("power_up_selection_status", {
              selectedCount,
              totalPlayers: room.players.length,
              selections: room.playersSelectedPowerUps,
            });
          }
        });
      }
    }
  }, 100); // Small delay to ensure client is ready
}

function handleSaltThrowAndPowerUp(player, room) {
  // Player is no longer in ritual phase - they've picked and are transitioning
  player.isInRitualPhase = false;
  
  // Set initial states for automatic salt throwing
  player.isThrowingSalt = true;
  player.saltCooldown = true;
  player.canMoveToReady = false; // New flag to control movement

  // Store the power-up but DON'T reveal it yet - wait until both players have picked
  // This prevents counter-picking
  if (player.selectedPowerUp) {
    // Store the power-up internally but mark it as not yet revealed
    player.pendingPowerUp = player.selectedPowerUp;
    player.powerUpRevealed = false;
    
  } else {
  }
  
  // Check if both players have now selected - if so, reveal both power-ups
  checkAndRevealPowerUps(room);

  // Reset salt throwing state after animation
  setPlayerTimeout(
    player.id,
    () => {
      player.isThrowingSalt = false;
      player.saltCooldown = false;

      // Allow movement after salt throw is complete
      player.canMoveToReady = true;
    },
    500
  );
}

// Check if both players have selected power-ups and reveal them simultaneously
function checkAndRevealPowerUps(room) {
  // Check if all players have pending power-ups (selected but not revealed)
  const allPlayersSelected = room.players.every(p => p.pendingPowerUp && !p.powerUpRevealed);
  
  if (allPlayersSelected) {
    // Activate power-ups for all players
    room.players.forEach(player => {
      player.activePowerUp = player.pendingPowerUp;
      player.powerUpMultiplier = POWER_UP_EFFECTS[player.pendingPowerUp];
      player.powerUpRevealed = true;
      
    });
    
    // Emit simultaneous reveal event with both players' power-ups
    io.in(room.id).emit("power_ups_revealed", {
      player1: {
        playerId: room.players[0].id,
        powerUpType: room.players[0].activePowerUp,
      },
      player2: {
        playerId: room.players[1].id,
        powerUpType: room.players[1].activePowerUp,
      },
    });
  }
}

function resetRoomAndPlayers(room) {
  // Reset room state
  room.gameStart = false;
  room.gameOver = false;
  room.hakkiyoiCount = 0;
  room.gameOverTime = null;
  delete room.winnerId;
  delete room.loserId;
  // PERFORMANCE: Reset delta state tracking so next broadcast sends full state
  room.previousPlayerStates = [null, null];

  // Start the 15-second timer for automatic power-up selection
  if (room.roundStartTimer) {
    clearTimeout(room.roundStartTimer);
  }
  room.roundStartTimer = setTimeout(() => {
    // Check if we're still in power-up selection phase
    if (room.powerUpSelectionPhase && room.players.length === 2) {
      // Track which players need auto-selection (didn't select manually)
      const playersNeedingAutoSelect = [];

      // Auto-select the first available power-up for any players who haven't selected
      room.players.forEach((player) => {
        if (!player.selectedPowerUp) {
          const availablePowerUps =
            room.playerAvailablePowerUps[player.id] ||
            Object.values(POWER_UP_TYPES);
          const firstPowerUp = availablePowerUps[0];

          player.selectedPowerUp = firstPowerUp;
          room.playersSelectedPowerUps[player.id] = firstPowerUp;
          playersNeedingAutoSelect.push(player);
        }
      });

      // Check if all players now have selections (they should after auto-selection)
      const selectedCount = Object.keys(room.playersSelectedPowerUps).length;

      if (selectedCount === room.players.length) {
        // All players have selections, end selection phase
        room.powerUpSelectionPhase = false;

        // Only emit selection complete and start salt throwing for players who were auto-selected
        // Players who manually selected already received these events
        playersNeedingAutoSelect.forEach((player) => {
          // Emit that selection is complete for this player
          io.to(player.id).emit("power_up_selection_complete");
          // Start salt throwing for this player
          handleSaltThrowAndPowerUp(player, room);
        });
      }
    }
  }, 15000);

  // Clear all pending timeouts from previous round to prevent stale callbacks
  room.players.forEach((p) => timeoutManager.clearPlayer(p.id));

  // Reset each player in the room
  room.players.forEach((player) => {
    // Reset all key states to prevent stale inputs from carrying over
    player.keys = {
      w: false, a: false, s: false, d: false,
      " ": false, shift: false, e: false, f: false,
      c: false, control: false, mouse1: false, mouse2: false,
    };
    player.isJumping = false;
    player.isAttacking = false;
    player.isStrafing = false;
    player.isRawParrying = false;
    player.rawParryStartTime = 0;
    player.rawParryMinDurationMet = false;
    player.isRawParryStun = false;
    player.perfectParryStunStartTime = 0;
    player.perfectParryStunBaseTimeout = null;
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.isAtTheRopes = false;
    player.atTheRopesStartTime = 0;
    player.atTheRopesFacingDirection = null;
    player.isDodging = false;
    player.isReady = false;
    player.isHit = false;
    player.isAlreadyHit = false;
    player.isDead = false;
    player.stamina = 100;
    player.isBowing = false;
    player.x = player.fighter === "player 1" ? 325 : 795;
    player.y = GROUND_LEVEL;
    player.knockbackVelocity = { x: 0, y: 0 };
    // Reset power-up state
    player.activePowerUp = null;
    player.powerUpMultiplier = 1;
    player.selectedPowerUp = null;
    player.pendingPowerUp = null;
    player.powerUpRevealed = false;
    // Apply default size
    player.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
    // Reset snowball state
    player.snowballs = [];
    player.snowballCooldown = false;
    player.lastSnowballTime = 0;
    player.isThrowingSnowball = false;
    // Reset pumo army state
    player.pumoArmy = [];
    player.pumoArmyCooldown = false;
    player.isSpawningPumoArmy = false;
    // Reset thick blubber state
    player.hitAbsorptionUsed = false;
    // Reset hit counter for reliable hit sound triggering
    player.hitCounter = 0;
    // Reset hit timing for dynamic hit duration
    player.lastHitTime = 0;
    player.lastSlapHitLandedTime = 0;
    // Reset slap attack buffering
    player.hasPendingSlapAttack = false;
    // Reset charge and mouse1 state to prevent stale charge at round start
    player.isChargingAttack = false;
    player.chargeStartTime = 0;
    player.chargeAttackPower = 0;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.pendingChargeAttack = null;
    player.spacebarReleasedDuringDodge = false;
    player.mouse1PressTime = 0;
    player.mouse1BufferedBeforeStart = false;
    player.mouse1HeldDuringAttack = false;
    player.wantsToRestartCharge = false;
    player.mouse1JustPressed = false;
    player.mouse1JustReleased = false;
    player.mouse2JustPressed = false;
    player.mouse2JustReleased = false;
    player.attackIntentTime = 0;
    player.attackAttemptTime = 0;
    player.chargeCancelled = false;
    player.chargedAttackHit = false;
    player.slapFacingDirection = null;
    player.attackStartTime = 0;
    player.attackEndTime = 0;
    player.isInStartupFrames = false;
    player.startupEndTime = 0;
    player.isInEndlag = false;
    player.endlagEndTime = 0;
    player.attackCooldownUntil = 0;
    player.actionLockUntil = 0;
    player.currentAction = null;
    // Reset throw landed state
    player.isThrowLanded = false;
    // Reset overlap tracking
    player.isOverlapping = false;
    player.overlapStartTime = null;
    // Reset ready positioning flag
    player.canMoveToReady = false;
    // Reset grab break flags
    player.isGrabBreaking = false;
    player.isGrabBreakCountered = false;
    player.grabBreakSpaceConsumed = false;
    player.postGrabInputBuffer = false;
    // Reset grab break state
    player.isGrabBreaking = false;
    // Reset grab movement states
    player.isGrabWalking = false;
    player.isGrabbingMovement = false;
    player.isGrabStartup = false;
    player.isWhiffingGrab = false;
    player.isGrabWhiffRecovery = false;
    player.isGrabTeching = false;
    player.grabTechRole = null;
    player.grabTechResidualVel = 0;
    player.isGrabClashing = false;
    player.grabClashStartTime = 0;
    player.grabClashInputCount = 0;
    player.grabMovementStartTime = 0;
    player.grabMovementDirection = 0;
    player.grabMovementVelocity = 0;
    player.grabStartupStartTime = 0;
    player.grabStartupDuration = 0;
    // Reset new grab action system states
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
    // Reset ring-out throw cutscene flags
    player.isRingOutThrowCutscene = false;
    player.ringOutThrowDistance = 0;
    // Reset ring-out freeze flags
    player.isRingOutFreezeActive = false;
    player.ringOutFreezeEndTime = 0;
    player.ringOutThrowDirection = null;
    // Reset input lockouts
    player.inputLockUntil = 0;
    // Reset dohyo fall state
    player.isFallingOffDohyo = false;
    // Reset knockback immunity
    player.knockbackImmune = false;
    player.knockbackImmuneEndTime = 0;
  });

  // Clear player-specific power-up data
  room.playerAvailablePowerUps = {};

  // Don't start power-up selection immediately - wait for client to signal pre-match is complete
  // For subsequent rounds (not initial), start power-up selection immediately
  if (!room.isInitialRound) {
    handlePowerUpSelection(room);
  }
  // If it's the initial round, power-up selection will be triggered by 'pre_match_complete' event

  // Emit an event to inform clients that the game has been reset
  io.in(room.id).emit("game_reset", false);
}

io.on("connection", (socket) => {
  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  io.emit("rooms", rooms);

  if (!gameLoop) {
    gameLoop = setInterval(() => {
      try {
        tick(delta);
      } catch (error) {
        console.error("Error in game loop:", error);
        // Optionally clear the interval if the error is severe
        // clearInterval(gameLoop);
      }
    }, delta);
  }

  // this is for the initial game start
  socket.on("game_reset", (data) => {
    // Find the room index using the socket's roomId to ensure we're resetting the correct room
    const roomIndex = rooms.findIndex((room) => room.id === socket.roomId);
    if (roomIndex !== -1) {
      resetRoomAndPlayers(rooms[roomIndex]);
    }
  });

  function isOpponentCloseEnoughForThrow(player, opponent) {
    // Calculate throw range based on player size
    const throwRange = THROW_RANGE * (player.sizeMultiplier || 1);
    return Math.abs(player.x - opponent.x) < throwRange;
  }

  function isOpponentCloseEnoughForGrab(player, opponent) {
    // Calculate grab range based on player size
    const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
    return Math.abs(player.x - opponent.x) < grabRange;
  }

  function isOpponentInFrontOfGrabber(player, opponent) {
    // Grab should only connect with opponents who are in front of the grabber,
    // not behind them. Uses player.facing instead of grabMovementDirection
    // since grabs are now instant (no lunge movement).
    // facing: 1 = facing left, -1 = facing right
    const BEHIND_TOLERANCE = 20; // Small tolerance (pixels) for near-overlap edge cases
    // Convert facing to direction: facing 1 (left) → check opponent is to left (-1)
    const facingDirection = player.facing === 1 ? -1 : 1;
    // Positive = opponent is in front, negative = opponent is behind
    const relativePos = (opponent.x - player.x) * facingDirection;
    return relativePos >= -BEHIND_TOLERANCE;
  }

  // First-to-active wins: grab vs slap is deterministic based on when each became active
  // Returns true if grab wins (grab became active before slap)
  function grabBeatsSlap(grabber, slapper) {
    if (!grabber.grabStartupStartTime || !slapper.attackStartTime) return false;
    const grabStartupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
    const grabActiveTime = grabber.grabStartupStartTime + grabStartupMs;
    const slapActiveTime = slapper.attackStartTime + SLAP_ATTACK_STARTUP_MS;
    return grabActiveTime < slapActiveTime; // Grab became active first
  }

  const THROW_TECH_COOLDOWN = 500; // 500ms cooldown on throw techs
  const THROW_TECH_DURATION = 260; // slightly shorter animation
  const THROW_TECH_WINDOW = 200; // narrower window reduces frequent techs

  function checkForThrowTech(player, opponent) {
    const currentTime = Date.now();

    // If either player is on cooldown, no throw tech can occur
    if (player.throwTechCooldown || opponent.throwTechCooldown) {
      return false;
    }

    // If either player is already in a throw tech animation, prevent new throw techs
    if (player.isThrowTeching || opponent.isThrowTeching) {
      return false;
    }

    // Players in whiff recovery cannot tech — they are fully vulnerable
    if (player.isWhiffingGrab || player.isGrabWhiffRecovery ||
        opponent.isWhiffingGrab || opponent.isGrabWhiffRecovery) {
      return false;
    }

    // Only check for throw tech if both players have recent throw attempt times
    if (!player.lastThrowAttemptTime || !opponent.lastThrowAttemptTime) {
      return false;
    }

    // Clean up old throw attempts that are outside the tech window
    if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      player.lastThrowAttemptTime = 0;
      return false;
    }
    if (currentTime - opponent.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      opponent.lastThrowAttemptTime = 0;
      return false;
    }

    // Check only for simultaneous throws
    const bothThrew =
      player.lastThrowAttemptTime &&
      opponent.lastThrowAttemptTime &&
      Math.abs(player.lastThrowAttemptTime - opponent.lastThrowAttemptTime) <=
        THROW_TECH_WINDOW;

    return bothThrew;
  }

  function checkForGrabPriority(player, opponent) {
    const currentTime = Date.now();

    // Players in whiff recovery have no grab priority — they are fully vulnerable
    if (player.isWhiffingGrab || player.isGrabWhiffRecovery ||
        opponent.isWhiffingGrab || opponent.isGrabWhiffRecovery) {
      return false;
    }

    // Clean up old attempts that are outside the window
    if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      player.lastThrowAttemptTime = 0;
    }
    if (currentTime - opponent.lastGrabAttemptTime > THROW_TECH_WINDOW) {
      opponent.lastGrabAttemptTime = 0;
    }

    // Check if opponent grabbed while this player is trying to throw
    const opponentGrabbedDuringThrow =
      player.lastThrowAttemptTime &&
      opponent.lastGrabAttemptTime &&
      Math.abs(player.lastThrowAttemptTime - opponent.lastGrabAttemptTime) <=
        THROW_TECH_WINDOW;

    return opponentGrabbedDuringThrow;
  }

  function resolveGrabClash(room, io) {
    if (!room.grabClashData) {
      return;
    }

    const player1 = room.players.find(
      (p) => p.id === room.grabClashData.player1Id
    );
    const player2 = room.players.find(
      (p) => p.id === room.grabClashData.player2Id
    );

    if (!player1 || !player2) {
      return;
    }

    let winner, loser;
    if (room.grabClashData.player1Inputs > room.grabClashData.player2Inputs) {
      winner = player1;
      loser = player2;
    } else if (
      room.grabClashData.player2Inputs > room.grabClashData.player1Inputs
    ) {
      winner = player2;
      loser = player1;
    } else {
      // Tie - random winner
      const randomWinner = Math.random() < 0.5;
      winner = randomWinner ? player1 : player2;
      loser = randomWinner ? player2 : player1;
    }

    // Clear clash states for both players
    player1.isGrabClashing = false;
    player1.grabClashStartTime = 0;
    player1.grabClashInputCount = 0;
    player2.isGrabClashing = false;
    player2.grabClashStartTime = 0;
    player2.grabClashInputCount = 0;

    // Clear grab attempt states for winner (transition out of "attempting" animation)
    winner.isGrabbingMovement = false;
    winner.isGrabStartup = false;
    winner.isWhiffingGrab = false;
    winner.grabMovementVelocity = 0;
    winner.movementVelocity = 0;
    winner.isStrafing = false;
    winner.grabState = GRAB_STATES.INITIAL;
    winner.grabAttemptType = null;
    winner.isRawParrySuccess = false;
    winner.isPerfectRawParrySuccess = false;

    // Set up grab for winner
    winner.isGrabbing = true;
    winner.grabStartTime = Date.now();
    winner.grabbedOpponent = loser.id;
    // Reset grab decision/action state from any previous grab
    winner.grabDecisionMade = false;
    winner.grabPushEndTime = 0;
    winner.grabPushStartTime = 0;
    winner.grabApproachSpeed = 0;
    winner.isGrabPushing = false;
    winner.isGrabWalking = false;
    winner.grabActionType = null;
    winner.grabActionStartTime = 0;
    winner.grabDurationPaused = false;
    winner.grabDurationPausedAt = 0;
    winner.isAtBoundaryDuringGrab = false;
    winner.lastGrabPushStaminaDrainTime = 0;
    winner.isAttemptingPull = false;
    winner.isAttemptingGrabThrow = false;
    
    // CRITICAL: Clear ALL action states when being grabbed
    clearAllActionStates(loser);
    loser.isBeingGrabbed = true;
    loser.isBeingGrabPushed = false;
    loser.lastGrabPushStaminaDrainTime = 0;
    
    // If loser was at the ropes, clear that state but keep the facing direction locked
    if (loser.isAtTheRopes) {
      timeoutManager.clearPlayerSpecific(loser.id, "atTheRopesTimeout");
      loser.isAtTheRopes = false;
      loser.atTheRopesStartTime = 0;
      // Keep atTheRopesFacingDirection - this will lock their facing during the grab
    }

    // Set grab facing direction for winner
    if (winner.isChargingAttack) {
      winner.grabFacingDirection = winner.chargingFacingDirection;
    } else {
      winner.grabFacingDirection = winner.facing;
    }

    // Emit clash result before clearing data
    io.in(room.id).emit("grab_clash_end", {
      winnerId: winner.id,
      loserId: loser.id,
      winnerInputs:
        winner.id === room.grabClashData.player1Id
          ? room.grabClashData.player1Inputs
          : room.grabClashData.player2Inputs,
      loserInputs:
        loser.id === room.grabClashData.player1Id
          ? room.grabClashData.player1Inputs
          : room.grabClashData.player2Inputs,
    });

    // Clear room clash data
    delete room.grabClashData;

  }

  // Update applyThrowTech to clear all relevant states:
  const TECH_FREEZE_DURATION = 200; // Duration of the freeze in milliseconds
  const TECH_KNOCKBACK_VELOCITY = 5;

  function applyThrowTech(player, opponent) {
    const knockbackDirection = player.x < opponent.x ? -1 : 1;

    // Clear all throw/grab states
    player.isThrowing = false;
    player.isGrabbing = false;
    player.isBeingThrown = false;
    player.isBeingGrabbed = false;
    player.grabbedOpponent = null;
    player.isHit = false;
    player.isAlreadyHit = false;

    opponent.isThrowing = false;
    opponent.isGrabbing = false;
    opponent.isBeingThrown = false;
    opponent.isBeingGrabbed = false;
    opponent.grabbedOpponent = null;
    opponent.isPushing = false;
    opponent.isBeingPushed = false;
    opponent.isBeingPulled = false;
    opponent.isHit = false;
    opponent.isAlreadyHit = false;

    // Clear charge attack states
    clearChargeState(player);
    clearChargeState(opponent);

    // Set up tech state
    player.isThrowTeching = true;
    opponent.isThrowTeching = true;

    // Add freeze timing properties
    player.techFreezeStartTime = Date.now();
    opponent.techFreezeStartTime = Date.now();

    // Store knockback values
    player.pendingKnockback = TECH_KNOCKBACK_VELOCITY * knockbackDirection;
    opponent.pendingKnockback = TECH_KNOCKBACK_VELOCITY * -knockbackDirection;

    // Clear attempt times
    player.lastThrowAttemptTime = 0;
    player.lastGrabAttemptTime = 0;
    opponent.lastThrowAttemptTime = 0;
    opponent.lastGrabAttemptTime = 0;

    // Reset grab cooldowns
    player.grabCooldown = false;
    opponent.grabCooldown = false;

    // Apply cooldown
    player.throwTechCooldown = true;
    opponent.throwTechCooldown = true;

    // Reset throw tech animation after duration
    setPlayerTimeout(
      player.id,
      () => {
        player.isThrowTeching = false;
        opponent.isThrowTeching = false;
      },
      THROW_TECH_DURATION
    );

    // Reset cooldown after longer duration
    setPlayerTimeout(
      player.id,
      () => {
        player.throwTechCooldown = false;
        opponent.throwTechCooldown = false;
      },
      THROW_TECH_COOLDOWN
    );
  }

  function tick(delta) {
    // PERFORMANCE: Use for-loop instead of forEach to avoid closure overhead at 64Hz.
    // Also skip rooms with < 2 players via continue (no function call overhead).
    for (let _roomIdx = 0; _roomIdx < rooms.length; _roomIdx++) {
      const room = rooms[_roomIdx];
      if (room.players.length < 2) continue;

      staminaRegenCounter += delta;

      if (room.players.length === 2) {
        const [player1, player2] = room.players;
        
        // === CRITICAL: Fix orphaned grab states ===
        // If a player is isBeingGrabbed but no one is grabbing them, clear the state
        [player1, player2].forEach((player) => {
          if (player.isBeingGrabbed) {
            const otherPlayer = player === player1 ? player2 : player1;
            // Check if the other player is actually grabbing this player
            if (!otherPlayer.isGrabbing || otherPlayer.grabbedOpponent !== player.id) {
              player.isBeingGrabbed = false;
            }
          }
          // Also fix orphaned isGrabbing states
          if (player.isGrabbing && player.grabbedOpponent) {
            const otherPlayer = player === player1 ? player2 : player1;
            // Check if the grabbed player is actually in the grabbed state
            if (!otherPlayer.isBeingGrabbed) {
              player.isGrabbing = false;
              player.grabbedOpponent = null;
            }
          }
          // === CRITICAL: Fix orphaned isBeingThrown states ===
          // If a player is isBeingThrown but no one is throwing them, clear the state
          // This can happen if a pumo army clone or other attack hits the thrower mid-throw
          if (player.isBeingThrown) {
            const otherPlayer = player === player1 ? player2 : player1;
            // Check if the other player is actually throwing this player
            if (!otherPlayer.isThrowing || otherPlayer.throwOpponent !== player.id) {
              player.isBeingThrown = false;
              player.beingThrownFacingDirection = null;
              player.y = GROUND_LEVEL; // Reset to ground level
              player.knockbackVelocity = { x: 0, y: 0 };
            }
          }
          // Also fix orphaned isThrowing states
          if (player.isThrowing && player.throwOpponent) {
            const otherPlayer = player === player1 ? player2 : player1;
            // Check if the thrown player is actually in the thrown state
            if (!otherPlayer.isBeingThrown) {
              player.isThrowing = false;
              player.throwOpponent = null;
              player.throwStartTime = 0;
              player.throwEndTime = 0;
              player.throwingFacingDirection = null;
            }
          }
        });
        
        // Update CPU AI for CPU rooms
        if (room.isCPURoom) {
          const currentTime = Date.now();
          const cpuPlayer = room.players.find(p => p.isCPU);
          const humanPlayer = room.players.find(p => !p.isCPU);
          if (cpuPlayer && humanPlayer) {
            // Update AI decision making (sets keys)
            updateCPUAI(cpuPlayer, humanPlayer, room, currentTime);
            
            // Process the CPU's inputs (converts keys to actions)
            const gameHelpers = {
              executeSlapAttack,
              executeChargedAttack,
              canPlayerCharge,
              canPlayerSlap,
              canPlayerUseAction,
              startCharging,
              clearChargeState,
              isPlayerInActiveState,
              setPlayerTimeout,
              rooms,
              io, // Add io for emitting events
            };
            processCPUInputs(cpuPlayer, humanPlayer, room, gameHelpers);
          }
        }

        // Handle ready positions separately from movement
        handleReadyPositions(room, player1, player2, io);

        if (player1.isGrabbing && player1.grabbedOpponent && !player1.isHit) {
          // Only handle grab state if not pushing
          const opponent = room.players.find(
            (p) => p.id === player1.grabbedOpponent
          );
          if (opponent && !opponent.isHit) {
            // Keep opponent at fixed distance during grab
            const fixedDistance =
              Math.round(81 * 0.96) * (opponent.sizeMultiplier || 1); // Scaled +30%
            opponent.x =
              player1.facing === 1
                ? player1.x - fixedDistance
                : player1.x + fixedDistance;
            // Only update facing if opponent doesn't have locked atTheRopes facing direction
            if (!opponent.atTheRopesFacingDirection) {
              opponent.facing = -player1.facing;
            }
          }
        }

        // Check for collision and adjust positions
        // Always enable collision detection during slap attacks to prevent pass-through
        if (
          arePlayersColliding(player1, player2) &&
          // Enable collision if one player is hit (prevents pass-through from knockback)
          (player1.isHit ||
            player2.isHit ||
            // Enable collision during slap attacks to prevent pass-through
            (player1.isAttacking && player1.attackType === "slap") ||
            (player2.isAttacking && player2.attackType === "slap") ||
            // Original collision bypass conditions (only when neither player is hit and not slapping)
            (!(player1.isAttacking && player1.attackType === "charged") &&
              !(player2.isAttacking && player2.attackType === "charged") &&
              !player1.isGrabbing &&
              !player2.isGrabbing &&
              !player1.isBeingGrabbed &&
              !player2.isBeingGrabbed &&
              !player1.isThrowLanded &&
              !player2.isThrowLanded))
        ) {
          adjustPlayerPositions(player1, player2, delta);
        }

        if (
          !player1.isGrabbing &&
          !player1.isBeingGrabbed &&
          !player2.isGrabbing &&
          !player2.isBeingGrabbed &&
          !player1.isThrowing &&
          !player2.isThrowing &&
          !(player1.isHit && player2.isHit) // Only disable if BOTH are hit
        ) {
          // Preserve facing direction during attacks and throws
          // Special case: allow dodging player to update facing even when opponent is attacking
          // This allows dodge-through to work correctly during charged attacks
          if (
            (!player1.isAttacking && !player2.isAttacking && !player1.isDodging && !player2.isDodging) ||
            (player1.isDodging && player2.isAttacking) ||
            (player2.isDodging && player1.isAttacking)
          ) {
            // Only update facing for non-isHit players and those not locked by slap attacks
            // IMPORTANT: Players with atTheRopesFacingDirection set keep their locked facing direction
            if (!player1.isHit && !player2.isHit) {
              // Normal facing logic when both players are not hit
              // Don't update facing if player has locked slap facing direction OR is attacking OR has atTheRopes facing locked
              if (!player1.slapFacingDirection && !player1.isAttacking && !player1.atTheRopesFacingDirection && player1.x < player2.x) {
                player1.facing = -1; // Player 1 faces right
              } else if (
                !player1.slapFacingDirection &&
                !player1.isAttacking &&
                !player1.atTheRopesFacingDirection &&
                player1.x >= player2.x
              ) {
                player1.facing = 1; // Player 1 faces left
              }

              if (!player2.slapFacingDirection && !player2.isAttacking && !player2.atTheRopesFacingDirection && player1.x < player2.x) {
                player2.facing = 1; // Player 2 faces left
              } else if (
                !player2.slapFacingDirection &&
                !player2.isAttacking &&
                !player2.atTheRopesFacingDirection &&
                player1.x >= player2.x
              ) {
                player2.facing = -1; // Player 2 faces right
              }
            } else if (!player1.isHit && player2.isHit) {
              // Only update player1's facing when player2 is hit and player1 doesn't have locked slap facing
              if (!player1.slapFacingDirection && !player1.isAttacking && !player1.atTheRopesFacingDirection) {
                if (player1.x < player2.x) {
                  player1.facing = -1; // Player 1 faces right
                } else {
                  player1.facing = 1; // Player 1 faces left
                }
              }
            } else if (player1.isHit && !player2.isHit) {
              // Only update player2's facing when player1 is hit and player2 doesn't have locked slap facing
              if (!player2.slapFacingDirection && !player2.isAttacking && !player2.atTheRopesFacingDirection) {
                if (player1.x < player2.x) {
                  player2.facing = 1; // Player 2 faces left
                } else {
                  player2.facing = -1; // Player 2 faces right
                }
              }
            }
            // If both are hit, don't update facing at all (handled by outer condition)
          }
        }

        if (player1.isAttacking) {
          checkCollision(player1, player2);
        }
        if (player2.isAttacking) {
          checkCollision(player2, player1);
        }

        if (
          player1.isReady &&
          player2.isReady &&
          !player1.isRawParrying &&
          !player1.isRawParryStun &&
          !player1.isStrafing &&
          !player1.isJumping &&
          !player1.isAttacking &&
          !player2.isRawParrying &&
          !player2.isRawParryStun &&
          !player2.isCrouching &&
          !player2.isStrafing &&
          !player2.isJumping &&
          !player2.isAttacking
        ) {
          const currentTime = Date.now();
          if (!room.readyStartTime) {
            room.readyStartTime = currentTime;
          }

          const elapsedTime = currentTime - room.readyStartTime;
          
          // Authentic sumo timing:
          // 0-1500ms: Wait for power-up reveal to finish
          // 700ms: Gyoji says "TE WO TSUITE!" (Put your hands down!)
          // 2700ms: HAKKIYOI (game_start)
          
          if (elapsedTime >= 700 && !room.teWoTsuiteSent) {
            room.teWoTsuiteSent = true;
            io.in(room.id).emit("gyoji_call", "TE WO TSUITE!");
          }
          
          if (elapsedTime >= 2700) {
            // Clear the power-up auto-selection timer if players ready up normally
            if (room.roundStartTimer) {
              clearTimeout(room.roundStartTimer);
              room.roundStartTimer = null;
            }
            room.gameStart = true;
            io.in(room.id).emit("game_start", true);
            player1.isReady = false;
            player2.isReady = false;
            // Reset mouse1PressTime so pre-game holds don't instantly trigger charging
            // Players must hold mouse1 for a fresh 200ms from HAKKIYOI to start charging
            player1.mouse1PressTime = 0;
            player2.mouse1PressTime = 0;
            room.hakkiyoiCount = 1;
            room.readyStartTime = null;
            room.teWoTsuiteSent = false;
          }
        } else {
          room.readyStartTime = null;
          room.teWoTsuiteSent = false;
        }

        // Handle recovery state for charged attacks
        [player1, player2].forEach((player) => {
          if (player.isRecovering) {
            if (player.isDodging) {
              player.isRecovering = false;
              player.movementVelocity = 0;
            }
            const recoveryElapsed = Date.now() - player.recoveryStartTime;

            // Apply ice-like physics to recovery movement
            if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
              // Apply momentum and friction from global ice physics
              player.movementVelocity *= MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;

              // Calculate new position with sliding
              const newX =
                player.x + delta * speedFactor * player.movementVelocity;

              // Calculate effective boundary based on player size
              const sizeOffset = 0;

              // Only use map boundaries during recovery
              const leftBoundary = MAP_LEFT_BOUNDARY;
              const rightBoundary = MAP_RIGHT_BOUNDARY;

              // Only update position if within boundaries
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              } else {
                // Stop at boundary and reset velocity
                player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
                player.movementVelocity = 0;
              }
            }

            // End recovery state after duration
            if (recoveryElapsed >= player.recoveryDuration) {
              player.isRecovering = false;
              player.movementVelocity = 0;
              player.recoveryDirection = null;

              // Check if we should restart charging immediately after recovery ends
              // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
              if (player.mouse1HeldDuringAttack && player.keys.mouse1 && player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200) {
                // Restart charging immediately since player was holding mouse1 during attack
                player.isChargingAttack = true;
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
                player.attackType = "charged";
                player.mouse1HeldDuringAttack = false; // Clear the flag
              }
              // Otherwise check normal conditions for restart
              else if (
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

              // Clean up stale chargedAttackHit flag after recovery ends
              // This flag is set by processHit and never cleared by safelyEndChargedAttack
              // (since safelyEndChargedAttack doesn't run for connected attacks)
              if (player.chargedAttackHit) {
                player.chargedAttackHit = false;
              }
            }
          }
        });

        // Handle snowball updates
        [player1, player2].forEach((player) => {
          // Store initial snowball count to detect removals
          const initialSnowballCount = player.snowballs.length;

          // Update snowball positions and check for collisions
          player.snowballs = player.snowballs.filter((snowball) => {
            // Move snowball
            snowball.x += snowball.velocityX * delta * speedFactor;

            // Check if snowball is off-screen
            if (snowball.x < -50 || snowball.x > 1330) {
              return false; // Remove snowball
            }

            // Check collision with target player
            // For reflected snowballs, target is the original thrower; otherwise target is opponent
            const opponent = room.players.find((p) => p.id !== player.id);
            const targetPlayer = snowball.reflectedByPerfectParry 
              ? player  // Hit the thrower (reflected back)
              : opponent; // Hit the opponent (normal)
            
            if (
              targetPlayer &&
              !targetPlayer.isDodging &&
              !targetPlayer.isRawParrying &&
              !snowball.hasHit
            ) {
              // Adjust collision point based on facing direction to account for sprite asymmetry
              // Only adjust for player 2 side (facing = 1), player 1 side (facing = -1) is correct
              const faceOffset = targetPlayer.facing === 1 ? 9 : 0;
              const adjustedPlayerX = targetPlayer.x + faceOffset;
              
              const distance = Math.abs(snowball.x - adjustedPlayerX);
              const sizeMul = targetPlayer.sizeMultiplier || 1;
              const horizThresh = Math.round(45 * 0.96) * sizeMul;
              const vertThresh = Math.round(27 * 0.96) * sizeMul;
              if (
                distance < horizThresh &&
                Math.abs(snowball.y - targetPlayer.y) < vertThresh
              ) {
                // If either player is actually IN the grab (connected), snowball passes through
                // Grab startup (attempting) can still be hit; only connected grab states are immune
                const isTargetInConnectedGrab =
                  targetPlayer.isGrabbingMovement ||
                  targetPlayer.isGrabbing ||
                  targetPlayer.isBeingGrabbed;
                if (isTargetInConnectedGrab) {
                  return true; // Keep snowball in flight, don't register hit
                }

                // Check for thick blubber hit absorption
                const isTargetGrabbing = targetPlayer.isGrabStartup || targetPlayer.isGrabbingMovement || targetPlayer.isGrabbing;
                if (
                  targetPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
                  ((targetPlayer.isAttacking && targetPlayer.attackType === "charged") || isTargetGrabbing) &&
                  !targetPlayer.hitAbsorptionUsed
                ) {
                  // Mark absorption as used for this charge session
                  targetPlayer.hitAbsorptionUsed = true;

                  // Remove snowball but don't hit the player
                  snowball.hasHit = true;

                  // Emit absorption effect
                  io.in(room.id).emit("thick_blubber_absorption", {
                    playerId: targetPlayer.id,
                    x: targetPlayer.x,
                    y: targetPlayer.y,
                  });

                  return false; // Remove snowball after absorption
                }

                // Hit target player normally
                snowball.hasHit = true;
                
                // Emit snowball hit effect for visual clarity (facing = hit player's facing for effect offset)
                io.in(room.id).emit("snowball_hit", {
                  x: targetPlayer.x,
                  y: targetPlayer.y,
                  facing: targetPlayer.facing,
                  hitId: `snowball-hit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                });
                
                // If target was grabbing someone, clear the grabbed player's state first
                if (targetPlayer.isGrabbing && targetPlayer.grabbedOpponent) {
                  const grabbedPlayer = room.players.find(p => p.id === targetPlayer.grabbedOpponent);
                  if (grabbedPlayer) {
                    grabbedPlayer.isBeingGrabbed = false;
                  }
                }
                
                // CRITICAL: If target was throwing someone, clear the thrown player's state
                // This prevents isBeingThrown from getting stuck when thrower is interrupted
                if (targetPlayer.isThrowing && targetPlayer.throwOpponent) {
                  const thrownPlayer = room.players.find(p => p.id === targetPlayer.throwOpponent);
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
                
                // CRITICAL: Clear ALL action states before setting isHit
                clearAllActionStates(targetPlayer);
                targetPlayer.isHit = true;
                targetPlayer.isAlreadyHit = true;
                targetPlayer.lastHitTime = Date.now(); // Track hit time for safety mechanism

                // Apply knockback only if not immune
                if (canApplyKnockback(targetPlayer)) {
                  const knockbackDirection = snowball.velocityX > 0 ? 1 : -1;

                  // Clear any existing slap knockback state to ensure consistent snowball knockback
                  targetPlayer.isSlapKnockback = false;

                  targetPlayer.knockbackVelocity.x = knockbackDirection * 0.75; // Reduced by 50%
                  targetPlayer.movementVelocity = knockbackDirection * 0.65; // Reduced by 50%

                  // Set knockback immunity
                  setKnockbackImmunity(targetPlayer);
                }

                // Reset hit state after duration
                setPlayerTimeout(
                  targetPlayer.id,
                  () => {
                    targetPlayer.isHit = false;
                    targetPlayer.isAlreadyHit = false;
                  },
                  300
                );

                return false; // Remove snowball after hit
              }
            }

            // Check collision with raw parrying opponent (snowball is blocked or reflected)
            if (opponent && opponent.isRawParrying && !snowball.hasHit) {
              // Adjust collision point based on facing direction to account for sprite asymmetry
              // Only adjust for player 2 side (facing = 1), player 1 side (facing = -1) is correct
              const faceOffset = opponent.facing === 1 ? 9 : 0;
              const adjustedOpponentX = opponent.x + faceOffset;
              
              const distance = Math.abs(snowball.x - adjustedOpponentX);
              const sizeMul = opponent.sizeMultiplier || 1;
              const horizThresh = Math.round(45 * 0.96) * sizeMul;
              const vertThresh = Math.round(27 * 0.96) * sizeMul;
              if (
                distance < horizThresh &&
                Math.abs(snowball.y - opponent.y) < vertThresh
              ) {
                // Check if this is a perfect parry (within 100ms of parry start)
                const currentTime = Date.now();
                const parryDuration = currentTime - opponent.rawParryStartTime;
                const isPerfectParry = parryDuration <= PERFECT_PARRY_WINDOW;
                
                // Find the snowball thrower
                const thrower = room.players.find(p => p.id === player.id);
                
                // Check if snowball was already reflected - if so, block it instead of reflecting again
                const canReflect = isPerfectParry && !snowball.reflectedByPerfectParry;
                
                // Set parry success state for the defending player
                if (canReflect) {
                  // Perfect parry on non-reflected snowball: reflect it back!
                  opponent.isRawParrying = true;
                  opponent.isPerfectRawParrySuccess = true;
                  opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, Date.now() + PERFECT_PARRY_ANIMATION_LOCK);
                  // REFLECT THE SNOWBALL BACK - faster than original
                  snowball.hasHit = false; // Reset hit flag so it can hit the thrower
                  snowball.velocityX = -snowball.velocityX * 1.3; // Reverse direction and make it 30% faster
                  snowball.reflectedByPerfectParry = true; // Mark as reflected to prevent infinite reflection
                  // Emit screen shake for perfect parry (throttled)
                  emitThrottledScreenShake(room, io, {
                    intensity: 0.7,
                    duration: 300,
                  });
                } else {
                  // Regular parry OR already-reflected snowball: block and destroy it
                  snowball.hasHit = true;
                  if (isPerfectParry) {
                    opponent.isPerfectRawParrySuccess = true;
                    opponent.isRawParrying = true;
                    opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, Date.now() + PERFECT_PARRY_ANIMATION_LOCK);
                  } else {
                    opponent.isRawParrySuccess = true;
                  }
                }
                
                // Emit raw parry success event for visual effect and sound
                const parryingPlayerNumber = room.players.findIndex(p => p.id === opponent.id) + 1;
                io.in(room.id).emit("raw_parry_success", {
                  attackerX: thrower ? thrower.x : snowball.x,
                  parrierX: opponent.x,
                  facing: thrower ? thrower.facing : -opponent.facing,
                  isPerfect: isPerfectParry,
                  timestamp: Date.now(),
                  parryId: `${opponent.id}_snowball_parry_${Date.now()}`,
                  playerNumber: parryingPlayerNumber,
                });
                
                // Clear parry success state after duration
                if (canReflect) {
                  // For perfect parry with reflection: clear the parry pose after animation lock duration
                  setPlayerTimeout(
                    opponent.id,
                    () => {
                      opponent.isRawParrying = false;
                      opponent.isPerfectRawParrySuccess = false;
                    },
                    PERFECT_PARRY_ANIMATION_LOCK,
                    "perfectParryAnimationEnd"
                  );
                  
                  // Return true to KEEP the snowball (it's been reflected)
                  return true;
                } else if (isPerfectParry) {
                  // Perfect parry but already reflected: treat like perfect parry block
                  setPlayerTimeout(
                    opponent.id,
                    () => {
                      opponent.isRawParrying = false;
                      opponent.isPerfectRawParrySuccess = false;
                    },
                    PERFECT_PARRY_ANIMATION_LOCK,
                    "perfectParryAnimationEnd"
                  );
                  
                  // Return false to REMOVE the snowball (it was blocked)
                  return false;
                } else {
                  // For regular parry: clear success state after normal duration
                  setPlayerTimeout(
                    opponent.id,
                    () => {
                      opponent.isRawParrySuccess = false;
                    },
                    PARRY_SUCCESS_DURATION,
                    "parrySuccess"
                  );
                  
                  // Return false to REMOVE the snowball (it was blocked)
                  return false;
                }
              }
            }

            return true; // Keep snowball
          });

          // Check if snowballs were removed and reset cooldown if no snowballs remain
          if (
            initialSnowballCount > player.snowballs.length &&
            player.snowballs.length === 0
          ) {
            player.snowballCooldown = false;
          }
        });

        // Handle pumo army updates
        [player1, player2].forEach((player) => {
          const currentTime = Date.now();

          // Update pumo army positions and check for collisions
          player.pumoArmy = player.pumoArmy.filter((clone) => {
            // Check if clone has expired
            if (currentTime - clone.spawnTime >= clone.lifespan) {
              return false; // Remove expired clone
            }

            // Move clone horizontally
            clone.x += clone.velocityX * delta * speedFactor;

            // Apply dohyo height logic with buffer zone for climbing
            const CLIMB_BUFFER = 55; // Start climbing 20 pixels before dohyo boundary
            const isOutsideDohyo = clone.x < (DOHYO_LEFT_BOUNDARY - CLIMB_BUFFER +40) || clone.x > (DOHYO_RIGHT_BOUNDARY + CLIMB_BUFFER + 30);
            const climbSpeed = DOHYO_FALL_SPEED; // Use same speed for climbing/falling
            
            if (isOutsideDohyo) {
              // Clone is outside dohyo - drop down to fall depth
              const targetY = GROUND_LEVEL - DOHYO_FALL_DEPTH;
              if (clone.y > targetY) {
                // Falling down
                clone.y = Math.max(targetY, clone.y - climbSpeed);
              } else if (clone.y < targetY) {
                // Rising up (shouldn't happen, but handle it)
                clone.y = Math.min(targetY, clone.y + climbSpeed);
              }
            } else {
              // Clone is on the dohyo - climb up to ground level
              const targetY = GROUND_LEVEL + 5; // Slightly above ground for visibility
              if (clone.y < targetY) {
                // Climbing up onto dohyo
                clone.y = Math.min(targetY, clone.y + climbSpeed);
              } else if (clone.y > targetY) {
                // Descending to correct height (shouldn't happen much)
                clone.y = Math.max(targetY, clone.y - climbSpeed);
              }
            }

            // Check if clone is off-screen (extended range to allow full travel)
            if (clone.x < -150 || clone.x > 1250) {
              return false; // Remove off-screen clone
            }

            // Check collision with opponent
            const opponent = room.players.find((p) => p.id !== player.id);
            if (
              opponent &&
              !opponent.isDodging &&
              !opponent.isRawParrying &&
              !clone.hasHit
            ) {
              const distance = Math.abs(clone.x - opponent.x);
              const sizeMul = opponent.sizeMultiplier || 1;
              const horizThresh = Math.round(54 * 0.96) * sizeMul;
              const vertThresh = Math.round(36 * 0.96) * sizeMul;
              if (
                distance < horizThresh &&
                Math.abs(clone.y - opponent.y) < vertThresh
              ) {
                // Check for thick blubber hit absorption
                const isOpponentGrabbingClone = opponent.isGrabStartup || opponent.isGrabbingMovement || opponent.isGrabbing;
                if (
                  opponent.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
                  ((opponent.isAttacking && opponent.attackType === "charged") || isOpponentGrabbingClone) &&
                  !opponent.hitAbsorptionUsed
                ) {
                  // Mark absorption as used for this charge session
                  opponent.hitAbsorptionUsed = true;

                  // Remove clone but don't hit the player
                  clone.hasHit = true;

                  // Emit absorption effect
                  io.in(room.id).emit("thick_blubber_absorption", {
                    playerId: opponent.id,
                    x: opponent.x,
                    y: opponent.y,
                  });

                  return false; // Remove clone after absorption
                }

                // Hit opponent normally
                clone.hasHit = true;
                
                // If opponent was grabbing someone, clear the grabbed player's state first
                if (opponent.isGrabbing && opponent.grabbedOpponent) {
                  const grabbedPlayer = room.players.find(p => p.id === opponent.grabbedOpponent);
                  if (grabbedPlayer) {
                    grabbedPlayer.isBeingGrabbed = false;
                  }
                }
                
                // CRITICAL: If opponent was throwing someone, clear the thrown player's state
                // This prevents isBeingThrown from getting stuck when thrower is interrupted
                if (opponent.isThrowing && opponent.throwOpponent) {
                  const thrownPlayer = room.players.find(p => p.id === opponent.throwOpponent);
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
                
                // CRITICAL: Clear ALL action states before setting isHit
                clearAllActionStates(opponent);
                opponent.isHit = true;
                opponent.isAlreadyHit = true;
                opponent.lastHitTime = Date.now(); // Track hit time for safety mechanism

                // Apply knockback only if not immune (lighter than normal slap)
                if (canApplyKnockback(opponent)) {
                  const knockbackDirection = clone.velocityX > 0 ? 1 : -1;

                  // Clear any existing slap knockback state to ensure consistent pumo army knockback
                  opponent.isSlapKnockback = false;

                  opponent.knockbackVelocity.x = knockbackDirection * 0.9; // Reduced by 40% from original 1.5
                  opponent.movementVelocity = knockbackDirection * 0.9;

                  // Set knockback immunity
                  setKnockbackImmunity(opponent);
                }

                // Reset hit state after duration
                setPlayerTimeout(
                  opponent.id,
                  () => {
                    opponent.isHit = false;
                    opponent.isAlreadyHit = false;
                  },
                  200
                );

                return false; // Remove clone after hit
              }
            }

            // Check collision with raw parrying opponent (clone is blocked but destroyed)
            if (opponent && opponent.isRawParrying && !clone.hasHit) {
              const distance = Math.abs(clone.x - opponent.x);
              const sizeMul = opponent.sizeMultiplier || 1;
              const horizThresh = Math.round(54 * 0.96) * sizeMul;
              const vertThresh = Math.round(36 * 0.96) * sizeMul;
              if (
                distance < horizThresh &&
                Math.abs(clone.y - opponent.y) < vertThresh
              ) {
                // Clone is blocked - destroy it but don't apply knockback
                clone.hasHit = true;
                
                // Trigger parry success animation and sound
                opponent.isRawParrySuccess = true;
                // Emit raw parry success event for visual effect and sound
                // Send both positions so client can calculate center
                const parryingPlayerNumber = room.players.findIndex(p => p.id === opponent.id) + 1;
                const spawner = room.players.find(p => p.id === player.id);
                io.in(room.id).emit("raw_parry_success", {
                  attackerX: spawner ? spawner.x : clone.x,
                  parrierX: opponent.x,
                  facing: spawner ? spawner.facing : -opponent.facing, // Use attacker's facing for consistency with melee
                  isPerfect: false,
                  timestamp: Date.now(),
                  parryId: `${opponent.id}_pumo_parry_${Date.now()}`,
                  playerNumber: parryingPlayerNumber,
                });
                
                // Clear parry success state after duration
                setPlayerTimeout(
                  opponent.id,
                  () => {
                    opponent.isRawParrySuccess = false;
                  },
                  PARRY_SUCCESS_DURATION,
                  "parrySuccess"
                );
                
                return false; // Remove clone after being blocked
              }
            }

            return true; // Keep clone
          });

          // Note: pumoArmyCooldown is now only reset between rounds, not when clones are destroyed
          // This ensures the pumo army can only be used once per round
        });
      }

      // Players Loop
      room.players.forEach((player) => {
        // Skip most simulation while hitstop is active to create brief, readable freezes
        if (isRoomInHitstop(room)) {
          return;
        }
        if (room.gameOver && player.id === room.loserId && !player.isHit) {
          return;
        }

        // Clear knockback immunity when timer expires
        if (
          player.knockbackImmune &&
          Date.now() >= player.knockbackImmuneEndTime
        ) {
          player.knockbackImmune = false;
        }

        // Smooth grab-break separation tween overrides other movement for its duration
        if (player.isGrabBreakSeparating) {
          const now = Date.now();
          const elapsed = now - (player.grabBreakSepStartTime || now);
          const duration = player.grabBreakSepDuration || 0;
          const startX = player.grabBreakStartX ?? player.x;
          const targetX = player.grabBreakTargetX ?? player.x;
          const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
          // Ease-out cubic for smooth finish
          const eased = 1 - Math.pow(1 - t, 3);
          const newX = startX + (targetX - startX) * eased;

          // For pull reversal, clamp to a margin inside boundaries so they stop before the edge
          const isPullTween = player.isBeingPullReversaled;
          const leftBound = isPullTween ? MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN : MAP_LEFT_BOUNDARY;
          const rightBound = isPullTween ? MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN : MAP_RIGHT_BOUNDARY;
          const clampedX = Math.max(leftBound, Math.min(newX, rightBound));
          player.x = clampedX;
          // During pull reversal, simulate decaying hops (server-driven for reliability)
          // Hops start after a delay so the player slides a bit before bouncing
          if (isPullTween && t < 1) {
            const HOP_DELAY = 0.18; // Don't start hopping until 18% into the tween (~120ms)
            if (t > HOP_DELAY) {
              const HOP_COUNT = 4; // Fewer hops over the remaining time = slower per hop
              const HOP_HEIGHTS = [26, 17, 10, 4]; // Decaying hop heights in pixels
              const hopT = (t - HOP_DELAY) / (1 - HOP_DELAY); // 0-1 within the hop window
              const hopProgress = hopT * HOP_COUNT;
              const hopIndex = Math.min(Math.floor(hopProgress), HOP_COUNT - 1);
              const hopPhase = hopProgress - Math.floor(hopProgress); // 0-1 within each hop
              const maxHeight = HOP_HEIGHTS[hopIndex] || 0;
              // Sine curve for each hop arc (0 → peak → 0)
              const hopY = maxHeight * Math.sin(hopPhase * Math.PI);
              player.y = GROUND_LEVEL + hopY;
            } else {
              player.y = GROUND_LEVEL; // Still on ground during initial slide
            }
          } else {
            player.y = GROUND_LEVEL;
          }
          player.movementVelocity = 0;
          player.knockbackVelocity.x = 0;
          player.knockbackVelocity.y = 0;
          player.isStrafing = false;

          // If pulled player hits boundary margin during pull, end tween early
          const hitBoundary = isPullTween && t > 0.05 &&
            Math.abs(newX - clampedX) > 1;

          if (t >= 1 || hitBoundary) {
            // End tween — ensure player is back on the ground
            player.y = GROUND_LEVEL;
            player.isGrabBreakSeparating = false;
            player.grabBreakSepStartTime = 0;
            player.grabBreakSepDuration = 0;
            player.grabBreakStartX = undefined;
            player.grabBreakTargetX = undefined;

            // Grab tech: feed residual velocity into ice sliding after forced separation
            if (player.grabTechResidualVel) {
              player.movementVelocity = player.grabTechResidualVel;
              player.grabTechResidualVel = 0;
            }

            // Auto-clear associated visual states when tween ends
            // These are mutually exclusive states that use the same tween mechanism
            if (player.isGrabSeparating) player.isGrabSeparating = false;
            if (player.isBeingPullReversaled) {
              player.isBeingPullReversaled = false;
              // Release both players' input locks when pull tween ends
              player.inputLockUntil = 0;
              // Find and release the puller too
              let pullerRef = null;
              if (player.pullReversalPullerId) {
                const allPlayers = room.players || [];
                pullerRef = allPlayers.find(p => p.id === player.pullReversalPullerId);
                if (pullerRef) {
                  pullerRef.inputLockUntil = 0;
                }
                player.pullReversalPullerId = null;
              }
              // Activate buffered inputs for both players (0 frame advantage)
              activateBufferedInputAfterGrab(player, rooms);
              if (pullerRef) {
                activateBufferedInputAfterGrab(pullerRef, rooms);
              }
            }
            if (player.isGrabBreaking) player.isGrabBreaking = false;
            if (player.isGrabBreakCountered) player.isGrabBreakCountered = false;

            // Fall through to normal movement so residual velocity applies this tick
          } else {
            // Tween still in progress — skip remaining movement to avoid interference
            return;
          }
        }

        // Handle knockback movement with NO boundary restrictions
        if (player.isRingOutFreezeActive) {
          // Freeze player entirely during ring-out freeze
          player.movementVelocity = 0;
          player.knockbackVelocity.x = 0;
          player.knockbackVelocity.y = 0;
          // Keep facing and position; do nothing else until freeze ends
        } else if (player.isHit) {
          // SAFETY: Maximum isHit duration to prevent stuck states (1 second max)
          const MAX_HIT_DURATION = 1000;
          const hitDuration = player.lastHitTime ? Date.now() - player.lastHitTime : 0;
          if (hitDuration > MAX_HIT_DURATION) {
            player.isHit = false;
            player.isAlreadyHit = false;
            player.isSlapKnockback = false;
            player.knockbackVelocity.x = 0;
            player.movementVelocity = 0;
            // Don't return - continue normal processing
          } else {
            // Apply immediate knockback without boundary check
            player.x =
              player.x + player.knockbackVelocity.x * delta * speedFactor;

            // Check if player crossed the dohyo boundary - trigger fast heavy fall
            const isOutsideDohyo = player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY;
            
            // Check if player is past map boundaries (for reduced friction after ring-out)
            const isPastMapBoundaries = player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY;
            
            // Fast heavy drop when outside dohyo
            if (isOutsideDohyo && !player.isFallingOffDohyo) {
              player.isFallingOffDohyo = true;
            }

            // Check if this is the loser after game over (for special handling)
            const isLoserAfterGameOver = room.gameOver && player.id === room.loserId;
            
            // Fast, heavy fall physics - straight down while maintaining horizontal speed
            if (player.isFallingOffDohyo) {
              // Fast downward movement (no arc, just straight down)
              const targetY = GROUND_LEVEL - DOHYO_FALL_DEPTH;
              // If game is over, snap immediately to target Y (no gradual fall)
              if (isLoserAfterGameOver) {
                if (player.y !== targetY) {
                  player.y = targetY; // Only set if different to avoid unnecessary updates
                }
              } else if (player.y > targetY) {
                player.y = Math.max(targetY, player.y - DOHYO_FALL_SPEED);
              }
              
              // Maintain horizontal momentum with very slight friction (0.98 = minimal resistance)
              player.knockbackVelocity.x *= DOHYO_FALL_HORIZONTAL_RETENTION;
              player.movementVelocity *= DOHYO_FALL_HORIZONTAL_RETENTION;
            } else if (isLoserAfterGameOver && isPastMapBoundaries) {
              // LOSER PAST MAP BOUNDARIES BUT NOT YET PAST DOHYO:
              // Apply same minimal friction as dohyo fall (0.98) - feels smooth, not jarring
              player.knockbackVelocity.x *= DOHYO_FALL_HORIZONTAL_RETENTION;
              player.movementVelocity *= DOHYO_FALL_HORIZONTAL_RETENTION;
            } else {
              // ICE PHYSICS: Getting hit on ice = SLIDING, not resistance!
              // The ice makes knockback LONGER, not shorter
              // Use very low friction - players slide when hit
              
              // DI (Directional Influence): Holding the opposite direction reduces knockback!
              // This rewards skilled players who react quickly to hits
              const knockbackDirection = player.knockbackVelocity.x > 0 ? 1 : -1; // 1 = right, -1 = left
              const isHoldingOpposite = (knockbackDirection > 0 && player.keys.a && !player.keys.d) || 
                                        (knockbackDirection < 0 && player.keys.d && !player.keys.a);
              
              // DI friction multiplier - holding opposite direction adds significant friction
              const DI_FRICTION_BONUS = 0.96; // Extra friction when holding opposite direction
              
              if (player.isSlapKnockback) {
                player.knockbackVelocity.x *= 0.992; // Slap hits slide far on ice
                if (isHoldingOpposite) {
                  player.knockbackVelocity.x *= DI_FRICTION_BONUS; // DI reduces slap knockback
                }
              } else {
                player.knockbackVelocity.x *= 0.985; // Charged hits slide even further
                if (isHoldingOpposite) {
                  player.knockbackVelocity.x *= DI_FRICTION_BONUS; // DI reduces charged knockback
                }
              }
              
              // Transfer knockback into movement velocity for continued sliding
              // This creates the "hit and slide on ice" effect
              if (Math.abs(player.knockbackVelocity.x) > 0.1) {
                player.movementVelocity = player.knockbackVelocity.x * 0.8;
              }
            }

            // Apply ice sliding physics to movement velocity
            if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
              // ICE PHYSICS: Very low friction when hit - they're sliding on ice!
              // For loser after game over, use same minimal friction as dohyo fall
              if (isLoserAfterGameOver && isPastMapBoundaries) {
                player.movementVelocity *= DOHYO_FALL_HORIZONTAL_RETENTION;
              } else {
                player.movementVelocity *= 0.996;
              }

              // Calculate new position with sliding
              player.x = player.x + delta * speedFactor * player.movementVelocity;
            }

            // Reset hit state when both knockback and sliding are nearly complete
            // But KEEP isHit true if game is over and player is the loser (so knockback continues)
            const hitMovementThreshold = player.isSlapKnockback
              ? MIN_MOVEMENT_THRESHOLD * 0.3 // Much smaller threshold for slap attacks (longer slides)
              : MIN_MOVEMENT_THRESHOLD; // Normal threshold for charged attacks

            if (
              Math.abs(player.knockbackVelocity.x) < 0.1 &&
              Math.abs(player.movementVelocity) < hitMovementThreshold
            ) {
              player.knockbackVelocity.x = 0;
              player.movementVelocity = 0;
              
              // Only clear isHit if game is NOT over, or if player is NOT the loser
              // This keeps the loser sliding after ring-out instead of freezing
              if (!(room.gameOver && player.id === room.loserId)) {
                player.isHit = false;
                player.isAlreadyHit = false; // Also clear isAlreadyHit to ensure player can be hit again
                player.isSlapKnockback = false; // Reset slap knockback flag
              }
              
              // If player was at the ropes and is now back within ring boundaries,
              // clear the locked facing direction so they can face normally again
              if (player.atTheRopesFacingDirection !== null) {
                const isWithinBoundaries = player.x > MAP_LEFT_BOUNDARY && player.x < MAP_RIGHT_BOUNDARY;
                if (isWithinBoundaries) {
                  player.atTheRopesFacingDirection = null;
                  player.isAtTheRopes = false;
                  player.atTheRopesStartTime = 0;
                }
                // If still outside boundaries, keep the facing locked until round reset
              }
            }
          }
        }

        // Handle slap parry knockback (smooth sliding that doesn't interrupt attack state)
        if (Math.abs(player.slapParryKnockbackVelocity) > 0.01) {
          // Apply knockback movement
          const newX = player.x + player.slapParryKnockbackVelocity * delta * speedFactor;
          
          // Constrain to map boundaries with buffer (prevents triggering win condition)
          const BOUNDARY_BUFFER = 10;
          player.x = Math.max(
            MAP_LEFT_BOUNDARY + BOUNDARY_BUFFER,
            Math.min(newX, MAP_RIGHT_BOUNDARY - BOUNDARY_BUFFER)
          );
          
          // Apply friction for smooth deceleration
          player.slapParryKnockbackVelocity *= 0.92;
          
          // Clear when velocity is negligible
          if (Math.abs(player.slapParryKnockbackVelocity) < 0.01) {
            player.slapParryKnockbackVelocity = 0;
          }
        }

        // Handle grab startup — near-instant (70ms), then instant range check
        // No hop, no forward movement. Grab either connects, techs, or whiffs.
        if (player.isGrabStartup) {
          const elapsed = Date.now() - player.grabStartupStartTime;
          if (elapsed >= (player.grabStartupDuration || GRAB_STARTUP_DURATION_MS)) {
            // Startup complete — instant range check
            const opponent = room.players.find((p) => p.id !== player.id);

            if (opponent && isOpponentCloseEnoughForGrab(player, opponent) && isOpponentInFrontOfGrabber(player, opponent)) {
              // === TECH CHECK: opponent also in grab startup → both tech ===
              // Whiffing players CANNOT tech — they are fully vulnerable.
              // Also check if opponent's startup has already expired AND their grab
              // would NOT have connected (out of range or facing wrong way).
              // This prevents tick processing order from causing false techs.
              const opponentWouldWhiff = opponent.isGrabStartup &&
                (Date.now() - opponent.grabStartupStartTime) >= (opponent.grabStartupDuration || GRAB_STARTUP_DURATION_MS) &&
                !(isOpponentCloseEnoughForGrab(opponent, player) && isOpponentInFrontOfGrabber(opponent, player));
              if ((opponent.isGrabStartup || opponent.isGrabTeching) &&
                  !opponent.isWhiffingGrab && !opponent.isGrabWhiffRecovery &&
                  !opponentWouldWhiff) {
                executeGrabTech(player, opponent, room, io);
                return;
              }

              // === GRAB CHECK: opponent is in range and grabbable ===
              // First-to-active wins: when opponent is slapping, timing determines winner
              const opponentGrabbableNeutral =
                !opponent.isBeingThrown &&
                !opponent.isBeingGrabbed &&
                !player.isBeingGrabbed &&
                !player.throwTechCooldown &&
                !opponent.isDodging;
              const grabWinsVsSlap =
                opponent.isAttacking &&
                opponent.attackType === "slap" &&
                grabBeatsSlap(player, opponent);
              const canConnect =
                opponentGrabbableNeutral &&
                (!opponent.isAttacking || grabWinsVsSlap);

              if (canConnect) {
                // SUCCESSFUL GRAB — same connect logic as before
                player.isGrabStartup = false;
                player.y = GROUND_LEVEL;
                player.grabMovementVelocity = 0;
                player.movementVelocity = 0;
                player.isStrafing = false;
                player.grabState = GRAB_STATES.INITIAL;
                player.grabAttemptType = null;

                player.isGrabbing = true;
                player.grabStartTime = Date.now();
                player.grabbedOpponent = opponent.id;

                // IMMEDIATE PUSH
                player.isGrabPushing = true;
                player.isGrabWalking = true;
                player.grabActionType = "push";
                player.grabDecisionMade = true;
                player.grabPushStartTime = 0;
                player.grabPushEndTime = 0;
                opponent.isBeingGrabPushed = true;

                player.grabActionStartTime = 0;
                player.grabDurationPaused = false;
                player.grabDurationPausedAt = 0;
                player.isAtBoundaryDuringGrab = false;
                player.lastGrabPushStaminaDrainTime = 0;
                player.isAttemptingPull = false;
                player.isAttemptingGrabThrow = false;

                // COUNTER GRAB: grabbing during raw parry = locked
                const wasOpponentRawParrying = opponent.isRawParrying;
                opponent.isCounterGrabbed = wasOpponentRawParrying;

                if (wasOpponentRawParrying) {
                  const grabberPlayerNumber = room.players.indexOf(player) === 0 ? 1 : 2;
                  const centerX = (player.x + opponent.x) / 2;
                  const centerY = (player.y + opponent.y) / 2;
                  io.in(room.id).emit("counter_grab", {
                    type: "counter_grab",
                    grabberId: player.id,
                    grabbedId: opponent.id,
                    grabberX: player.x,
                    grabbedX: opponent.x,
                    x: centerX,
                    y: centerY,
                    grabberPlayerNumber,
                    counterId: `counter-grab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  });
                }

                player.isRawParrySuccess = false;
                player.isPerfectRawParrySuccess = false;

                clearAllActionStates(opponent);
                opponent.isBeingGrabbed = true;
                opponent.isBeingGrabPushed = false;
                opponent.lastGrabPushStaminaDrainTime = 0;

                triggerHitstop(room, HITSTOP_GRAB_MS);

                if (opponent.isAtTheRopes) {
                  timeoutManager.clearPlayerSpecific(opponent.id, "atTheRopesTimeout");
                  opponent.isAtTheRopes = false;
                  opponent.atTheRopesStartTime = 0;
                }

                opponent.keys.shift = false;
                opponent.keys.w = false;
                opponent.keys.a = false;
                opponent.keys.s = false;
                opponent.keys.d = false;
                opponent.keys.e = false;
                opponent.keys.f = false;
                opponent.keys.mouse1 = false;
                opponent.keys.mouse2 = false;

                if (player.isChargingAttack) {
                  player.grabFacingDirection = player.chargingFacingDirection;
                } else {
                  player.grabFacingDirection = player.facing;
                }
              } else {
                // Opponent in ungrabable state (attacking, dodging, etc.) — whiff
                executeGrabWhiff(player);
              }
            } else {
              // Out of range or no opponent — whiff
              executeGrabWhiff(player);
            }
          } else {
            // During startup — just wait (no hop, no movement)
            return;
          }
        }

        // Only apply boundary restrictions for normal player movement (walking/strafing)
        // Exclude hit, grab, throw, attack, and being grabbed states
        if (
          !player.isHit &&
          !room.gameOver &&
          !player.isRingOutFreezeActive &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isThrowTeching &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isSlapAttack &&
          !player.isAttacking && // Add this crucial check to exclude all attacks
          !player.isThrowLanded // Exclude throw landed players
        ) {
          // Calculate effective boundary based on player size with different multipliers for left and right
          const sizeOffset = 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary = MAP_LEFT_BOUNDARY;
          const rightBoundary = MAP_RIGHT_BOUNDARY;

          // Apply boundary restrictions
          if (player.keys.a || player.keys.d) {
            player.x = Math.max(
              leftBoundary,
              Math.min(player.x, rightBoundary)
            );
          }
        }

        // Add separate boundary check for grabbing state
        if (player.isGrabbing && !player.isThrowing && !player.isBeingThrown) {
          // Calculate effective boundary based on player size with different multipliers
          const sizeOffset = 0;

          // Apply different multipliers for left and right ring out boundaries
          const leftRingOutBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightRingOutBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

          player.x = Math.max(
            leftRingOutBoundary,
            Math.min(player.x, rightRingOutBoundary)
          );
        }

        // === DANGER ZONE DETECTION - Dramatic moments near ring-out ===
        const DANGER_ZONE_THRESHOLD = 50; // pixels from boundary
        const isInDangerZone =
          player.isHit &&
          !room.gameOver &&
          !player.isBeingThrown &&
          (player.x <= MAP_LEFT_BOUNDARY + DANGER_ZONE_THRESHOLD ||
            player.x >= MAP_RIGHT_BOUNDARY - DANGER_ZONE_THRESHOLD);

        // Emit danger zone event for dramatic slow-mo effect (only once per knockback)
        if (isInDangerZone && !player.dangerZoneTriggered) {
          player.dangerZoneTriggered = true;
          io.in(room.id).emit("danger_zone", {
            playerId: player.id,
            x: player.x,
            y: player.y,
            direction: player.x < (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2 ? "left" : "right",
          });
          // Emit extra screen shake for dramatic near-ring-out (throttled)
          emitThrottledScreenShake(room, io, {
            intensity: 1.0,
            duration: 400,
          });
        }

        // Reset danger zone flag when player is no longer hit
        if (!player.isHit && player.dangerZoneTriggered) {
          player.dangerZoneTriggered = false;
        }

        // Win Conditions - back to original state
        if (
          (player.isHit &&
            player.x <= MAP_LEFT_BOUNDARY &&
            !room.gameOver &&
            !player.isBeingThrown) ||
          (player.isHit &&
            player.x >= MAP_RIGHT_BOUNDARY &&
            !room.gameOver &&
            !player.isBeingThrown) ||
          (player.isBeingThrown &&
            !room.gameOver &&
            // Find the thrower to check their throwing direction
            (() => {
              const thrower = room.players.find(
                (p) => p.throwOpponent === player.id
              );
              if (!thrower) return false;

              // Only ring out if being thrown TOWARD the boundary
              return (
                (player.x <= MAP_LEFT_BOUNDARY &&
                  thrower.throwingFacingDirection === -1) ||
                (player.x >= MAP_RIGHT_BOUNDARY &&
                  thrower.throwingFacingDirection === 1)
              );
            })())
        ) {
          const winner = room.players.find((p) => p.id !== player.id);
          handleWinCondition(room, player, winner, io);
          // Don't reset knockback velocity for the loser
          player.knockbackVelocity = { ...player.knockbackVelocity };
          
          // Emit ring-out event for dramatic effect
          io.in(room.id).emit("ring_out", {
            loserId: player.id,
            winnerId: winner.id,
            direction: player.x <= MAP_LEFT_BOUNDARY ? "left" : "right",
          });
        }

        // FALLBACK WIN CONDITION: Catch edge cases where player fell off dohyo
        // but primary win conditions didn't trigger (e.g., isHit cleared during slide)
        // This prevents the game from freezing if a player crosses boundaries
        // without being in the expected state
        if (
          !room.gameOver &&
          player.isFallingOffDohyo &&
          player.y <= GROUND_LEVEL - DOHYO_FALL_DEPTH &&
          (player.x <= MAP_LEFT_BOUNDARY || player.x >= MAP_RIGHT_BOUNDARY)
        ) {
          const winner = room.players.find((p) => p.id !== player.id);
          if (winner) {
            console.log(`[FALLBACK WIN] Player ${player.id} fell off dohyo at x=${player.x}, y=${player.y}`);
            handleWinCondition(room, player, winner, io);
            player.knockbackVelocity = { ...player.knockbackVelocity };
            
            io.in(room.id).emit("ring_out", {
              loserId: player.id,
              winnerId: winner.id,
              direction: player.x <= MAP_LEFT_BOUNDARY ? "left" : "right",
            });
          }
        }

        if (
          room.gameOver &&
          Date.now() - room.gameOverTime >= 3000 &&
          !room.matchOver
        ) {
          // 5 seconds
          resetRoomAndPlayers(room);
        }

        // Stamina regen (freeze stamina once round is over)
        // Don't regen while being grabbed — victim's stamina is being drained
        if (player.stamina < 100 && !room.gameOver && !player.isBeingGrabbed) {
          if (staminaRegenCounter >= STAMINA_REGEN_INTERVAL_MS) {
            player.stamina += STAMINA_REGEN_AMOUNT;
            player.stamina = Math.min(player.stamina, 100);
          }
        }

        // if (player.isHit) return;

        if (
          !player.isRingOutFreezeActive &&
          player.isThrowing &&
          player.throwOpponent
        ) {
          const currentTime = Date.now();
          const throwDuration = currentTime - player.throwStartTime;
          const throwProgress =
            throwDuration / (player.throwEndTime - player.throwStartTime);

          const opponent = room.players.find(
            (p) => p.id === player.throwOpponent
          );
          if (opponent) {
            // Match dodge-style arc for cutscene: peak ~75 with same parabola scale used in dodge (3.2 * height * t * (1-t))
            const throwArcHeight = player.isRingOutThrowCutscene ? 75 : 450;
            let armsReachDistance = -100;

            if (!player.throwingFacingDirection) {
              player.throwingFacingDirection = player.facing;
              opponent.beingThrownFacingDirection = opponent.facing;
              // For ring-out cutscene, keep the current separation; otherwise, snap to arms reach
              if (!player.isRingOutThrowCutscene) {
                opponent.x =
                  player.x + player.throwingFacingDirection * armsReachDistance;
              }
              opponent.y = GROUND_LEVEL;
            }

            // Don't overwrite facing during ring-out cutscene (it's already set correctly for animation)
            if (!player.isRingOutThrowCutscene) {
              player.facing = player.throwingFacingDirection;
            }
            opponent.facing = opponent.beingThrownFacingDirection;

            // Calculate new position with size power-up consideration
            const sizeOffset = 0;

            // Preserve grab separation at the start of a ring-out cutscene throw
            if (player.isRingOutThrowCutscene) {
              const throwingDir = player.throwingFacingDirection || 1;
              const currentSeparation = opponent.x - player.x;
              armsReachDistance = currentSeparation * throwingDir;
            }

            // For cutscene: travel a small extra distance OUTWARD from current separation
            // This avoids pulling the opponent back into the player when the separation is already larger than the small target
            let throwDistance;
            if (player.isRingOutThrowCutscene) {
              const extraOutward = player.ringOutThrowDistance || 4; // treat as extra outward distance
              throwDistance = armsReachDistance + Math.max(extraOutward, 0);
            } else {
              throwDistance = 120;
            }

            const newX =
              player.x +
              player.throwingFacingDirection *
                (armsReachDistance +
                  (throwDistance - armsReachDistance) * throwProgress);

            // Always update position during throw - let throws complete their full arc
            opponent.x = newX;

            // Use a consistent inverted-U arc for cutscene
            if (player.isRingOutThrowCutscene) {
              const arcProgress = 4 * throwProgress * (1 - throwProgress); // perfect inverted-U from 0..1..0
              const hopHeight = arcProgress * 60; // modest peak
              opponent.y = GROUND_LEVEL + hopHeight;
            } else {
              opponent.y =
                GROUND_LEVEL +
                3.2 * throwArcHeight * throwProgress * (1 - throwProgress);
            }

            // Check if throw is complete
            if (currentTime >= player.throwEndTime) {
              // Check for win condition at the end of throw
              if (!player.isRingOutThrowCutscene) {
                if (
                  (opponent.x >= MAP_RIGHT_BOUNDARY &&
                    player.throwingFacingDirection === 1) ||
                  (opponent.x <= MAP_LEFT_BOUNDARY &&
                    player.throwingFacingDirection === -1)
                ) {
                  handleWinCondition(room, opponent, player, io);
                } else {
                  // Emit screen shake for landing after throw (throttled)
                  emitThrottledScreenShake(room, io, {
                    intensity: 0.6,
                    duration: 200,
                  });
                  // SMASH-STYLE: Hitstop when throw lands for impact
                  triggerHitstop(room, HITSTOP_THROW_MS);
                }
              }

              // Ensure landing at ground level, then reset throw-related states for both players
              player.isThrowing = false;
              player.throwOpponent = null;
              player.throwingFacingDirection = null;
              player.throwStartTime = 0;
              player.throwEndTime = 0;
              // Clear ring-out cutscene flags
              player.isRingOutThrowCutscene = false;
              player.ringOutThrowDistance = 0;

              // Check if player landed outside ring-out boundaries
              const landedOutsideBoundaries =
                opponent.x <= MAP_LEFT_BOUNDARY ||
                opponent.x >= MAP_RIGHT_BOUNDARY;

              opponent.isBeingThrown = false;
              opponent.beingThrownFacingDirection = null;
              opponent.isHit = false;
              opponent.isAlreadyHit = false; // Ensure player can be hit again after landing
              opponent.isSlapKnockback = false;
              
              // Set Y to correct ground level based on whether they landed outside the dohyo
              const landedOutsideDohyo = opponent.x <= DOHYO_LEFT_BOUNDARY || opponent.x >= DOHYO_RIGHT_BOUNDARY;
              if (landedOutsideDohyo) {
                opponent.y = GROUND_LEVEL - DOHYO_FALL_DEPTH; // Fallen ground level
                opponent.isFallingOffDohyo = true; // Mark as having fallen off
              } else {
                opponent.y = GROUND_LEVEL; // Normal ground level
              }
              
              opponent.knockbackVelocity.y = 0;
              opponent.knockbackVelocity.x = 0;
              opponent.movementVelocity = 0;

              // Only set isThrowLanded if player landed outside ring-out boundaries
              if (landedOutsideBoundaries) {
                opponent.isThrowLanded = true; // Permanent until round reset
                // Keep atTheRopesFacingDirection - player is out of ring and keeps facing locked until round reset
              } else {
                // Landed inside boundaries - clear the locked facing direction
                if (opponent.atTheRopesFacingDirection !== null) {
                  opponent.atTheRopesFacingDirection = null;
                }
              }

              // Correct facing so both players reflect their new positions (thrown player switched sides).
              // Prevents immediate dodge/actions from using stale "thrown" facing and opponent logic from breaking.
              correctFacingAfterGrabOrThrow(player, opponent);

              // BUFFERED INPUT ACTIVATION: Activate held inputs immediately for both players
              // on frame 1 after throw lands (like invincible reversals in fighting games).
              // The function checks isThrowLanded/isAtTheRopes internally, so it safely
              // skips activation for players that landed out of bounds.
              activateBufferedInputAfterGrab(player, rooms);
              activateBufferedInputAfterGrab(opponent, rooms);
            }
          }
        } else if (player.isThrowing && !player.throwOpponent) {
          const currentTime = Date.now();
          const throwDuration = currentTime - player.throwStartTime;
          const throwProgress =
            throwDuration / (player.throwEndTime - player.throwStartTime);

          if (currentTime >= player.throwEndTime) {
            player.isThrowing = false;

            // Check if we should restart charging after missed throw completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          }
        }

        // Throw tech
        if (player.isThrowTeching) {
          const currentTime = Date.now();
          const freezeElapsed = currentTime - player.techFreezeStartTime;

          if (freezeElapsed >= TECH_FREEZE_DURATION) {
            // Only apply knockback after freeze duration
            if (player.pendingKnockback !== undefined) {
              player.knockbackVelocity.x = player.pendingKnockback;
              delete player.pendingKnockback;
            }

            player.x += player.knockbackVelocity.x * delta * speedFactor;
            player.knockbackVelocity.x *= 0.9; // Apply friction

            if (Math.abs(player.knockbackVelocity.x) < 0.1) {
              player.knockbackVelocity.x = 0;
              player.isThrowTeching = false;
            }
          }
          // During freeze duration, ensure the player doesn't move
          else {
            player.knockbackVelocity.x = 0;
          }
        }
        // Dodging - Revolutionary physics: "snap up, hang, slam down" like Celeste/Hollow Knight
        // CRITICAL: Never process dodge movement if player is being grabbed
        if (player.isDodging && player.isBeingGrabbed) {
          // Safety clear - if somehow both states are true, force clear dodge
          player.isDodging = false;
          player.isDodgeCancelling = false;
          player.dodgeDirection = null;
          player.y = GROUND_LEVEL;
        }
        if (player.isDodging && !player.isBeingGrabbed) {
          // Use fixed dodge speed - no momentum-based variations
          let currentDodgeSpeed = speedFactor * DODGE_BASE_SPEED;

          // Apply speed power-up to dodge with moderate multiplier
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentDodgeSpeed *= Math.min(player.powerUpMultiplier * 0.85, 1.5);
          }

          // Check for dodge cancel (holding 's' key) - FAST SLAM DOWN
          if (player.keys.s && !player.isDodgeCancelling && player.y > GROUND_LEVEL) {
            player.isDodgeCancelling = true;
            player.dodgeCancelStartTime = Date.now();
            player.dodgeCancelStartY = player.y;
            player.dodgeCancelVelocity = 0; // For accelerating fall
          }

          // Handle dodge cancel - PUNCHY slam down with acceleration
          if (player.isDodgeCancelling) {
            const cancelProgress = Math.min(
              (Date.now() - player.dodgeCancelStartTime) / DODGE_CANCEL_DURATION,
              1
            );
            
            // Use easeInQuad for accelerating slam: t^2 (starts slow, accelerates into ground)
            // Then easeOutBack for slight bounce feel at the end
            let easedProgress;
            if (cancelProgress < 0.7) {
              // Accelerating fall (easeInQuad)
              const t = cancelProgress / 0.7;
              easedProgress = t * t * 0.85;
            } else {
              // Quick settle with slight overshoot (easeOutBack feel)
              const t = (cancelProgress - 0.7) / 0.3;
              easedProgress = 0.85 + t * 0.15 * (1 + 0.3 * (1 - t));
            }
            
            // Interpolate from cancel start Y to ground level
            player.y = player.dodgeCancelStartY - (player.dodgeCancelStartY - GROUND_LEVEL) * Math.min(easedProgress, 1);
            
            // Minimal horizontal movement during cancel - commitment to the slam
            const newX = player.x + player.dodgeDirection * delta * currentDodgeSpeed * DODGE_CANCEL_SPEED_MULT;
            
            // Calculate effective boundary based on player size
            const sizeOffset = 0;
            const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
            const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;
            
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            }
            
            // End dodge when cancel animation completes
            if (cancelProgress >= 1) {
              player.isDodging = false;
              player.isDodgeCancelling = false;
              const landingDirection = player.dodgeDirection || 0;
              player.dodgeDirection = null;
              player.y = GROUND_LEVEL;
              
              // Immediately update facing direction on dodge landing
              // This prevents wrong-way attacks when dodge-through switches sides
              const dodgeCancelOpponent = room.players.find(p => p.id !== player.id);
              if (dodgeCancelOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
                player.facing = player.x < dodgeCancelOpponent.x ? -1 : 1;
              }
              
              // ICE PHYSICS: Dodge landing = sliding on ice!
              if ((player.keys.c || player.keys.control) && room.gameStart && !room.gameOver && !room.matchOver) {
                // Holding C = STRONG power slide from dodge
                player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
                player.isPowerSliding = true;
              } else {
                // Normal landing = still slides, just less
                player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM;
              }
              
              player.isBraking = false;
              player.isStrafing = false;
              
              // Mark landing for visual effects
              player.justLandedFromDodge = true;
              player.dodgeLandTime = Date.now();
              // Emit screen shake for dodge cancel slam (gentler than before)
              emitThrottledScreenShake(room, io, {
                intensity: 1.2,
                duration: 70,
              });
            }
          } else {
            // Normal dodge movement (not cancelling)
            // Smooth sine-based arc for natural, graceful motion
            
            const elapsed = Date.now() - player.dodgeStartTime;
            const totalDuration = player.dodgeEndTime - player.dodgeStartTime;
            const dodgeProgress = Math.min(elapsed / totalDuration, 1);

            // Smooth sine arc - natural parabolic feel
            // sin(0 to PI) creates perfect 0 -> 1 -> 0 curve
            const arcProgress = Math.sin(dodgeProgress * Math.PI);
            
            // Add slight ease-out on the rise and ease-in on the fall for weight
            // This makes the penguin feel heavy at the top of the arc
            let weightedArc;
            if (dodgeProgress < 0.5) {
              // Rising: ease-out cubic for snappy start
              const riseT = dodgeProgress * 2; // 0 to 1 for first half
              const easeOut = 1 - Math.pow(1 - riseT, 2.5);
              weightedArc = easeOut * arcProgress / Math.sin(riseT * Math.PI / 2 + 0.001);
              weightedArc = Math.min(weightedArc, 1) * arcProgress;
            } else {
              // Falling: ease-in for weighted drop
              const fallT = (dodgeProgress - 0.5) * 2; // 0 to 1 for second half
              const easeIn = Math.pow(fallT, 1.8);
              weightedArc = arcProgress * (1 - easeIn * 0.15);
            }
            
            // Blend between pure sine and weighted version for smoothness
            const blendedArc = arcProgress * 0.7 + weightedArc * 0.3;
            const hopHeight = blendedArc * DODGE_HOP_HEIGHT;

            // Smooth speed curve - slightly faster at start and end, slower at apex
            const speedMultiplier = 0.92 + Math.cos(dodgeProgress * Math.PI) * 0.08;

            const adjustedSpeed = currentDodgeSpeed * speedMultiplier;

            // Calculate new position - uses fixed speed, not affected by prior momentum
            const newX = player.x + player.dodgeDirection * delta * adjustedSpeed;
            const newY = GROUND_LEVEL + hopHeight;

            // Calculate effective boundary based on player size
            const sizeOffset = 0;
            const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
            const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

            // Only update position if within boundaries
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
              player.y = newY;
            } else {
              // Still update Y position even if hitting boundary
              player.y = newY;
            }

            if (Date.now() >= player.dodgeEndTime) {
              // ICE PHYSICS: Dodge landing = sliding on ice!
              const landingDirection = player.dodgeDirection || 0;
              
              player.isDodging = false;
              player.isDodgeCancelling = false;
              player.dodgeDirection = null;
              player.y = GROUND_LEVEL;
              player.isStrafing = false;
              player.isBraking = false;
              
              // Immediately update facing direction on dodge landing
              // This prevents wrong-way attacks when dodge-through switches sides
              const dodgeLandOpponent = room.players.find(p => p.id !== player.id);
              if (dodgeLandOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
                player.facing = player.x < dodgeLandOpponent.x ? -1 : 1;
              }
              
              if ((player.keys.c || player.keys.control) && room.gameStart && !room.gameOver && !room.matchOver) {
                // Holding C/CTRL = STRONG power slide from dodge
                player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
                player.isPowerSliding = true;
              } else {
                // Normal landing = still slides, just less
                player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM;
              }
              
              // Direction keys can influence landing momentum slightly
              if (player.keys.a && !player.keys.d) {
                player.movementVelocity -= 0.2;
              } else if (player.keys.d && !player.keys.a) {
                player.movementVelocity += 0.2;
              }
              
              // Mark landing for visual effects
              player.justLandedFromDodge = true;
              player.dodgeLandTime = Date.now();
            }
          }
        }

        // Clear dodge landing flag after animation duration (200ms)
        if (player.justLandedFromDodge && player.dodgeLandTime) {
          if (Date.now() - player.dodgeLandTime > 200) {
            player.justLandedFromDodge = false;
          }
        }
        
        // POWER SLIDE FROM DODGE: If just landed and holding C/CTRL, ensure power slide is active
        // This handles the immediate frame after dodge landing
        if (player.justLandedFromDodge && (player.keys.c || player.keys.control) && Math.abs(player.movementVelocity) > SLIDE_MAINTAIN_VELOCITY && room.gameStart && !room.gameOver && !room.matchOver) {
          player.isPowerSliding = true;
        }

        // Grab Movement
        if (player.isGrabbingMovement) {
          const currentTime = Date.now();
          const opponent = room.players.find((p) => p.id !== player.id);

          // Check for grab clash - both players grabbing towards each other
          if (
            opponent &&
            opponent.isGrabbingMovement &&
            !player.isGrabClashing &&
            !opponent.isGrabClashing &&
            !player.isBeingGrabbed &&
            !opponent.isBeingGrabbed &&
            !player.isThrowing &&
            !opponent.isThrowing &&
            !player.isBeingThrown &&
            !opponent.isBeingThrown &&
            isOpponentCloseEnoughForGrab(player, opponent)
          ) {
            // Clear any existing grab movement timers
            timeoutManager.clearPlayerSpecific(
              player.id,
              "grabMovementTimeout"
            );
            timeoutManager.clearPlayerSpecific(
              opponent.id,
              "grabMovementTimeout"
            );

            // Start grab clash for both players
            player.isGrabbingMovement = false;
            player.isGrabClashing = true;
            player.grabClashStartTime = currentTime;
            player.grabClashInputCount = 0;
            player.grabMovementVelocity = 0;
            player.movementVelocity = 0;
            player.isStrafing = false;

            opponent.isGrabbingMovement = false;
            opponent.isGrabClashing = true;
            opponent.grabClashStartTime = currentTime;
            opponent.grabClashInputCount = 0;
            opponent.grabMovementVelocity = 0;
            opponent.movementVelocity = 0;
            opponent.isStrafing = false;

            // Initialize clash data for the room
            room.grabClashData = {
              player1Id: player.id,
              player2Id: opponent.id,
              startTime: currentTime,
              duration: 2000, // 2 seconds
              player1Inputs: 0,
              player2Inputs: 0,
            };

            // Emit grab clash start event
            io.in(room.id).emit("grab_clash_start", {
              player1Id: player.id,
              player2Id: opponent.id,
              duration: 2000,
              player1Position: { x: player.x, y: player.y, facing: player.facing },
              player2Position: { x: opponent.x, y: opponent.y, facing: opponent.facing },
            });

            // Set clash resolution timer
            setPlayerTimeout(
              player.id,
              () => {
                resolveGrabClash(room, io);
              },
              2000,
              "grabClashResolution"
            );

            return; // Skip normal grab movement processing
          }

          // Move forward during grab movement (after startup hop)
          let currentSpeedFactor = speedFactor;
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentSpeedFactor *= player.powerUpMultiplier;
          }

          // Calculate new position with grab movement
          const newX =
            player.x +
            player.grabMovementDirection *
              delta *
              currentSpeedFactor *
              player.grabMovementVelocity;

          // Calculate boundaries
          const sizeOffset = 0;
          const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

          // Update position within boundaries
          if (newX >= leftBoundary && newX <= rightBoundary) {
            player.x = newX;
          } else {
            // Stop at boundary
            player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
          }

          // Continuously check for grab opportunity during movement (only if opponent is not also grabbing)
          // Also require opponent to be in front of the grabber - prevents grabbing players
          // who have dodged through and are now behind the grabbing player
          if (
            opponent &&
            !opponent.isGrabbingMovement &&
            isOpponentCloseEnoughForGrab(player, opponent) &&
            isOpponentInFrontOfGrabber(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isBeingGrabbed &&
            !player.isBeingGrabbed &&
            !player.throwTechCooldown
          ) {
            // Successful grab - stop all movement and initiate grab
            // NOTE: grabApproachSpeed was already captured at grab startup (E press)

            player.isGrabbingMovement = false;
            player.grabMovementVelocity = 0;
            player.movementVelocity = 0;
            player.isStrafing = false;
            // Transition state out of attempting
            player.grabState = GRAB_STATES.INITIAL;
            player.grabAttemptType = null;

            // Start the actual grab
            player.isGrabbing = true;
            player.grabStartTime = Date.now();
            player.grabbedOpponent = opponent.id;

            // IMMEDIATE PUSH: Push starts right away (processed after hitstop)
            // No decision window — push is the default, pull/throw interrupt it
            player.isGrabPushing = true;
            player.isGrabWalking = true;
            player.grabActionType = "push";
            player.grabDecisionMade = true;
            player.grabPushStartTime = 0; // Initialized on first tick after hitstop
            player.grabPushEndTime = 0;
            opponent.isBeingGrabPushed = true;

            // Reset remaining grab action state
            player.grabActionStartTime = 0;
            player.grabDurationPaused = false;
            player.grabDurationPausedAt = 0;
            player.isAtBoundaryDuringGrab = false;
            player.lastGrabPushStaminaDrainTime = 0;
            player.isAttemptingPull = false;
            player.isAttemptingGrabThrow = false;
            
            // COUNTER GRAB: Only when grabbing opponent during their raw parry. Cannot grab break (LOCKED).
            // Grabbing during recovery does NOT count as punish - normal grab only.
            const wasOpponentRawParrying = opponent.isRawParrying;
            opponent.isCounterGrabbed = wasOpponentRawParrying; // Counter grabbed = cannot grab break

            if (wasOpponentRawParrying) {
              // Counter Grab: grabbed their raw parry - show LOCKED! effect + "Counter Grab" banner
              const grabberPlayerNumber = room.players.indexOf(player) === 0 ? 1 : 2;
              const centerX = (player.x + opponent.x) / 2;
              const centerY = (player.y + opponent.y) / 2;
              io.in(room.id).emit("counter_grab", {
                type: "counter_grab",
                grabberId: player.id,
                grabbedId: opponent.id,
                grabberX: player.x,
                grabbedX: opponent.x,
                x: centerX,
                y: centerY,
                grabberPlayerNumber,
                counterId: `counter-grab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              });
            }
            
            // Clear parry success state when starting a grab
            player.isRawParrySuccess = false;
            player.isPerfectRawParrySuccess = false;
            
            // CRITICAL: Clear ALL action states when being grabbed
            clearAllActionStates(opponent);
            opponent.isBeingGrabbed = true;
            opponent.isBeingGrabPushed = false;
            opponent.lastGrabPushStaminaDrainTime = 0;

            // SMASH-STYLE: Brief hitstop when grab connects for impact
            triggerHitstop(room, HITSTOP_GRAB_MS);
            
            // If opponent was at the ropes, clear that state but keep the facing direction locked
            if (opponent.isAtTheRopes) {
              timeoutManager.clearPlayerSpecific(opponent.id, "atTheRopesTimeout");
              opponent.isAtTheRopes = false;
              opponent.atTheRopesStartTime = 0;
              // Keep atTheRopesFacingDirection - this will lock their facing during the grab
            }
            
            // Clear all input keys except spacebar (for grab break - unless counter grabbed)
            opponent.keys.shift = false;
            opponent.keys.w = false;
            opponent.keys.a = false;
            opponent.keys.s = false;
            opponent.keys.d = false;
            opponent.keys.e = false;
            opponent.keys.f = false;
            opponent.keys.mouse1 = false;
            opponent.keys.mouse2 = false;

            // Set grab facing direction
            if (player.isChargingAttack) {
              player.grabFacingDirection = player.chargingFacingDirection;
            } else {
              player.grabFacingDirection = player.facing;
            }
          }
        }

        // Strafing
        if (
          !player.isThrowLanded && // Block all movement for throw landed players
          !player.isRawParrying && // Block all movement during raw parry
          !player.isGrabbingMovement && // Block normal movement during grab movement
          !player.isWhiffingGrab && // Block movement during grab whiff recovery
          !player.isGrabWhiffRecovery && // Block movement during grab whiff recovery (new)
          !player.isGrabTeching && // Block movement during grab tech
          !player.isGrabClashing && // Block movement during grab clashing
          ((!player.keys[" "] &&
            !(player.isAttacking && player.attackType === "charged") && // Block only during charged attack execution
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isGrabbingMovement &&
            !player.isWhiffingGrab &&
            !player.isRecovering &&
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.isRawParrying &&
            !player.isHit) ||
            (!player.keys[" "] &&
              player.isSlapAttack &&
              player.saltCooldown === false &&
              !player.isThrowTeching &&
              !player.isGrabbing &&
              !player.isBeingGrabbed &&
              !player.isRecovering &&
              !player.isThrowingSnowball &&
              !player.isSpawningPumoArmy &&
              !player.isRawParrying &&
              !player.isHit))
        ) {
          let currentSpeedFactor = speedFactor;

          // Apply speed power-up
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentSpeedFactor *= player.powerUpMultiplier;
          }
          // Reduce speed when size power-up is active
          // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
          //   currentSpeedFactor *= 0.85;
          // }

          // Initialize movement velocity if it doesn't exist
          if (!player.movementVelocity) {
            player.movementVelocity = 0;
          }

          // ============================================
          // POWER SLIDE (C key) - Commit to momentum for speed
          // Can only slide if moving fast enough, can cancel with dodge
          // ============================================
          const canPowerSlide = 
            room.gameStart && // Only during active gameplay (not during walk-up)
            !room.gameOver && // Not after round ends
            !room.matchOver && // Not after match ends
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isWhiffingGrab &&
            !player.isAttacking &&
            // NOTE: isChargingAttack is NOT blocked - can power slide while charging!
            // This allows fluid movement during charge windup
            !player.isRecovering &&
            !player.isRawParrying &&
            !player.isHit &&
            !player.isBeingGrabbed &&
            !player.isBeingThrown &&
            !player.isAtTheRopes &&
            !player.isGrabClashing &&
            !player.isGrabBreaking &&
            !player.isGrabBreakSeparating;

          if ((player.keys.c || player.keys.control) && canPowerSlide) {
            const currentSpeed = Math.abs(player.movementVelocity);
            const strafeDuration = player.strafeStartTime > 0 ? Date.now() - player.strafeStartTime : 0;
            // Can start power slide if: came from dodge landing OR strafed long enough
            const canStartSlide = player.justLandedFromDodge || strafeDuration >= SLIDE_STRAFE_TIME_REQUIRED;
            
            if (!player.isPowerSliding) {
              // STARTING a new slide - requires speed AND (dodge landing OR sustained strafe)
              if (currentSpeed >= SLIDE_MIN_VELOCITY && canStartSlide) {
                const slideDirection = player.movementVelocity > 0 ? 1 : -1;
                player.movementVelocity = currentSpeed * SLIDE_SPEED_BOOST * slideDirection;
                // Cap at slide max speed
                player.movementVelocity = Math.max(
                  Math.min(player.movementVelocity, SLIDE_MAX_SPEED),
                  -SLIDE_MAX_SPEED
                );
                player.isPowerSliding = true;
                player.isBraking = false;
                player.isStrafing = false;
              }
              // else: not enough speed or not strafing long enough - don't set isPowerSliding
            } else {
              // MAINTAINING an existing slide - use maintain threshold
              if (currentSpeed >= SLIDE_MAINTAIN_VELOCITY) {
                player.isBraking = false;
                player.isStrafing = false;
                // Already sliding, don't boost again
              } else {
                // Dropped below maintain threshold - end slide cleanly
                player.isPowerSliding = false;
              }
            }
          } else if (!player.keys.c && !player.keys.control) {
            // C/CTRL key released - exit power slide
            player.isPowerSliding = false;
          }
          // Note: if C/CTRL is held but canPowerSlide is false (e.g., still in dodge),
          // preserve isPowerSliding state - dodge landing may have set it

          // Calculate effective boundary based on player size with different multipliers
          const sizeOffset = 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

          // Handle crouch strafing (when holding s + a or d) - higher priority than normal strafing
          if (
            player.isCrouchStance &&
            player.keys.d &&
            !player.keys.a &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isGrabbingMovement &&
            !player.isWhiffingGrab &&
            !player.isAttacking &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isPerfectRawParrySuccess && // Block during perfect parry animation
            !player.isGrabBreaking && // Block during grab break animation
            !player.isGrabBreakCountered && // Block during grab break countered state
            !player.isGrabBreakSeparating && // Block during grab break separation
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.isAtTheRopes &&
            !player.isHit
          ) {
            // Velocity-based movement for crouch strafing (with minimal sliding)
            // Apply very high friction when changing directions to minimize sliding
            if (player.movementVelocity < 0) {
              player.movementVelocity *= 0.3; // Much higher friction than normal strafing
            }

            // Very slow acceleration for crouch strafing
            player.movementVelocity = Math.min(
              player.movementVelocity + MOVEMENT_ACCELERATION * 0.2, // Much slower acceleration
              MAX_MOVEMENT_SPEED * 0.3 // Much lower max speed
            );

            // Calculate new position and check boundaries (half speed for crouch)
            const crouchSpeedFactor = currentSpeedFactor * 0.5;
            const newX =
              player.x + delta * crouchSpeedFactor * player.movementVelocity;
            if (newX <= rightBoundary || player.isThrowLanded) {
              player.x = newX;
            } else {
              player.x = rightBoundary;
              player.movementVelocity = 0;
            }
            player.isCrouchStrafing = true;
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          } else if (
            player.isCrouchStance &&
            player.keys.a &&
            !player.keys.d &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isGrabbingMovement &&
            !player.isWhiffingGrab &&
            !player.isAttacking &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isPerfectRawParrySuccess && // Block during perfect parry animation
            !player.isGrabBreaking && // Block during grab break animation
            !player.isGrabBreakCountered && // Block during grab break countered state
            !player.isGrabBreakSeparating && // Block during grab break separation
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.isAtTheRopes &&
            !player.isHit
          ) {
            // Velocity-based movement for crouch strafing (with minimal sliding)
            // Apply very high friction when changing directions to minimize sliding
            if (player.movementVelocity > 0) {
              player.movementVelocity *= 0.3; // Much higher friction than normal strafing
            }

            // Very slow acceleration for crouch strafing
            player.movementVelocity = Math.max(
              player.movementVelocity - MOVEMENT_ACCELERATION * 0.2, // Much slower acceleration
              -MAX_MOVEMENT_SPEED * 0.3 // Much lower max speed
            );

            // Calculate new position and check boundaries (half speed for crouch)
            const crouchSpeedFactor = currentSpeedFactor * 0.5;
            const newX =
              player.x + delta * crouchSpeedFactor * player.movementVelocity;
            if (newX >= leftBoundary || player.isThrowLanded) {
              player.x = newX;
            } else {
              player.x = leftBoundary;
              player.movementVelocity = 0;
            }
            player.isCrouchStrafing = true;
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          } else if (
            player.keys.d &&
            !player.isCrouchStance &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isGrabbingMovement &&
            !player.isWhiffingGrab &&
            !player.isAttacking && // Block during any attack (slap or charged)
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isPerfectRawParrySuccess && // Block during perfect parry animation
            !player.isGrabBreaking && // Block during grab break animation
            !player.isGrabBreakCountered && // Block during grab break countered state
            !player.isGrabBreakSeparating && // Block during grab break separation
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.hasPendingSlapAttack && // Block strafing when buffered slap attack is pending
            !(
              player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime
            ) && // Block strafing during post-slap cooldown
            !player.isAtTheRopes && // Block strafing while at the ropes
            !player.isPowerSliding && // Power sliding uses its own physics - no strafing
            !(player.inputLockUntil && Date.now() < player.inputLockUntil) // Block during input freeze (e.g. pull reversal)
          ) {
            // ============================================
            // ICE PHYSICS: Moving RIGHT (D key)
            // Check if we're actually BRAKING (sliding left, holding right)
            // ============================================
            const wasMovingLeft = player.movementVelocity < -ICE_STOP_THRESHOLD;
            
            if (wasMovingLeft) {
              // We're sliding LEFT but holding RIGHT = BRAKING!
              const nearEdge = isNearDohyoEdge(player.x);
              const edgeProximity = getEdgeProximity(player.x);
              const friction = getIceFriction(player, true, nearEdge, edgeProximity);
              
              player.movementVelocity *= friction;
              player.isBraking = true;
              player.isStrafing = false;
              
              // If we've slowed down enough, switch to accelerating right
              if (Math.abs(player.movementVelocity) < ICE_STOP_THRESHOLD * 5) {
                player.movementVelocity = ICE_TURN_BURST;
                player.wasStrafingRight = true;
                player.wasStrafingLeft = false;
                player.isBraking = false;
              }
            } else if (player.movementVelocity <= ICE_STOP_THRESHOLD && !player.wasStrafingRight) {
              // STARTING FROM REST: Push-off burst
              player.movementVelocity = ICE_INITIAL_BURST;
              player.wasStrafingRight = true;
              player.wasStrafingLeft = false;
              player.isBraking = false;
              player.isStrafing = true;
              if (!player.strafeStartTime) player.strafeStartTime = Date.now();
            } else {
              // ACCELERATING: Already moving right, build more speed
              player.movementVelocity = Math.min(
                player.movementVelocity + ICE_ACCELERATION,
                ICE_MAX_SPEED
              );
              player.isBraking = false;
              player.isStrafing = true;
              // Start tracking strafe time if not already (e.g., coasting from dodge)
              if (!player.strafeStartTime) player.strafeStartTime = Date.now();
            }

            // Calculate new position and check boundaries
            const newX =
              player.x + delta * currentSpeedFactor * player.movementVelocity;
            if (newX <= rightBoundary || player.isThrowLanded) {
              player.x = newX;
            } else {
              player.x = rightBoundary;
              player.movementVelocity = 0;
            }
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          } else if (
            player.keys.a &&
            !player.isCrouchStance &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isGrabbingMovement &&
            !player.isWhiffingGrab &&
            !player.isAttacking &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isPerfectRawParrySuccess &&
            !player.isGrabBreaking &&
            !player.isGrabBreakCountered &&
            !player.isGrabBreakSeparating &&
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.hasPendingSlapAttack &&
            !(
              player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime
            ) &&
            !player.isAtTheRopes &&
            !player.isPowerSliding && // Power sliding uses its own physics - no strafing
            !(player.inputLockUntil && Date.now() < player.inputLockUntil) // Block during input freeze (e.g. pull reversal)
          ) {
            // ============================================
            // ICE PHYSICS: Moving LEFT (A key)
            // Check if we're actually BRAKING (sliding right, holding left)
            // ============================================
            const wasMovingRight = player.movementVelocity > ICE_STOP_THRESHOLD;
            
            if (wasMovingRight) {
              // We're sliding RIGHT but holding LEFT = BRAKING!
              const nearEdge = isNearDohyoEdge(player.x);
              const edgeProximity = getEdgeProximity(player.x);
              const friction = getIceFriction(player, true, nearEdge, edgeProximity);
              
              player.movementVelocity *= friction;
              player.isBraking = true;
              player.isStrafing = false;
              
              // If we've slowed down enough, switch to accelerating left
              if (Math.abs(player.movementVelocity) < ICE_STOP_THRESHOLD * 5) {
                player.movementVelocity = -ICE_TURN_BURST;
                player.wasStrafingLeft = true;
                player.wasStrafingRight = false;
                player.isBraking = false;
              }
            } else if (player.movementVelocity >= -ICE_STOP_THRESHOLD && !player.wasStrafingLeft) {
              // STARTING FROM REST: Push-off burst
              player.movementVelocity = -ICE_INITIAL_BURST;
              player.wasStrafingLeft = true;
              player.wasStrafingRight = false;
              player.isBraking = false;
              player.isStrafing = true;
              if (!player.strafeStartTime) player.strafeStartTime = Date.now();
            } else {
              // ACCELERATING: Already moving left, build more speed
              player.movementVelocity = Math.max(
                player.movementVelocity - ICE_ACCELERATION,
                -ICE_MAX_SPEED
              );
              player.isBraking = false;
              player.isStrafing = true;
              // Start tracking strafe time if not already (e.g., coasting from dodge)
              if (!player.strafeStartTime) player.strafeStartTime = Date.now();
            }

            // Calculate new position and check boundaries
            const newX =
              player.x + delta * currentSpeedFactor * player.movementVelocity;
            if (newX >= leftBoundary || player.isThrowLanded) {
              player.x = newX;
            } else {
              player.x = leftBoundary;
              player.movementVelocity = 0;
            }
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          } else {
            // ============================================
            // ICE PHYSICS: SLIDING / COASTING / BRAKING / POWER SLIDE
            // This runs when not actively pressing movement keys
            // OR when movement is blocked by other states
            // ============================================
            
            // Not actively strafing - reset strafe time tracking (but not during power slide)
            if (!player.isPowerSliding) {
              player.strafeStartTime = 0;
            }
            
            // Freeze movement completely during special states
            if (player.isPerfectRawParrySuccess || player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating) {
              player.movementVelocity = 0;
              player.isStrafing = false;
              player.isBraking = false;
              player.isPowerSliding = false;
              player.isCrouchStrafing = false;
              player.wasStrafingLeft = false;
              player.wasStrafingRight = false;
              player.strafeStartTime = 0;
            }
            // POWER SLIDE: C key held with velocity - committed fast slide
            else if (player.isPowerSliding && Math.abs(player.movementVelocity) > ICE_STOP_THRESHOLD) {
              // Edge awareness for braking during slide
              const nearEdge = isNearDohyoEdge(player.x);
              const edgeProximity = getEdgeProximity(player.x);
              
              // Check if trying to brake during slide
              const isMovingRight = player.movementVelocity > 0;
              const isMovingLeft = player.movementVelocity < 0;
              const isHoldingLeft = player.keys.a && !player.keys.d;
              const isHoldingRight = player.keys.d && !player.keys.a;
              const isActiveBraking = (isMovingRight && isHoldingLeft) || (isMovingLeft && isHoldingRight);
              
              // Get slide friction (can still brake during slide, just harder)
              const friction = getIceFriction(player, isActiveBraking, nearEdge, edgeProximity);
              player.movementVelocity *= friction;
              
              // Visual states
              player.isBraking = isActiveBraking;
              player.isStrafing = false;
              
              // Calculate position with slide speed
              const newX = player.x + delta * currentSpeedFactor * player.movementVelocity;
              
              // Apply position - slides can go off the edge!
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              } else if (!player.isHit && !player.isThrowLanded) {
                player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
                player.movementVelocity = 0;
                player.isPowerSliding = false; // Stop slide at boundary
              } else {
                player.x = newX;
              }
              
              // End slide if velocity drops below maintain threshold
              if (Math.abs(player.movementVelocity) < SLIDE_MAINTAIN_VELOCITY) {
                player.isPowerSliding = false;
              }
            }
            // Normal ice sliding physics if we have velocity
            else if (Math.abs(player.movementVelocity) > ICE_STOP_THRESHOLD) {
              // Determine braking state
              const isMovingRight = player.movementVelocity > 0;
              const isMovingLeft = player.movementVelocity < 0;
              const isHoldingLeft = player.keys.a && !player.keys.d;
              const isHoldingRight = player.keys.d && !player.keys.a;
              
              // BRAKING = holding opposite direction to current slide
              const isActiveBraking = (isMovingRight && isHoldingLeft) || (isMovingLeft && isHoldingRight);
              
              // Edge awareness
              const nearEdge = isNearDohyoEdge(player.x);
              const edgeProximity = getEdgeProximity(player.x);
              
              // Get appropriate friction
              const friction = getIceFriction(player, isActiveBraking, nearEdge, edgeProximity);
              
              // Apply friction to velocity
              player.movementVelocity *= friction;
              
              // Set braking state for visual feedback
              player.isBraking = isActiveBraking;
              player.isStrafing = false;

              // Calculate new position
              let newX;
              if (player.isSlapSliding) {
                const opponent = room.players.find((p) => p.id !== player.id);
                let effectiveVelocity = player.movementVelocity;
                if (opponent && arePlayersColliding(player, opponent)) {
                  effectiveVelocity *= 0.3;
                }
                newX = player.x + delta * speedFactor * effectiveVelocity;
              } else {
                newX = player.x + delta * currentSpeedFactor * player.movementVelocity;
              }

              // Apply position with boundary checks
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              } else if (!player.isHit && !player.isThrowLanded) {
                player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
                player.movementVelocity = 0;
              } else {
                player.x = newX;
              }
            } else {
              // Velocity below threshold - full stop
              player.movementVelocity = 0;
              player.isBraking = false;
              player.isPowerSliding = false;
              player.wasStrafingLeft = false;
              player.wasStrafingRight = false;
              player.strafeStartTime = 0; // Reset strafe tracking
            }
          }
          
          // ============================================
          // ICE PHYSICS: Apply sliding even when holding keys!
          // This makes it feel like you're on ice - you slide even while trying to move
          // ============================================
          if (player.isStrafing && !player.isPowerSliding && Math.abs(player.movementVelocity) > ICE_STOP_THRESHOLD) {
            // Apply moving friction even while actively moving
            player.movementVelocity *= ICE_MOVING_FRICTION;
          }

          // Update strafing state
          if (
            (!player.keys.a &&
              !player.keys.d &&
              (!player.canMoveToReady || room.gameStart)) ||
            player.isAttacking || // Clear strafing during any attack (slap or charged)
            player.hasPendingSlapAttack || // Clear strafing when buffered slap attack is pending
            (player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime) // Clear strafing during post-slap cooldown
          ) {
            player.isStrafing = false;
          }

          // Update crouch strafing state
          if (
            !player.isCrouchStance ||
            (!player.keys.a && !player.keys.d) ||
            player.keys.mouse1 ||
            player.isAttacking ||
            player.hasPendingSlapAttack ||
            (player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime) ||
            player.isHit ||
            player.isRawParrying ||
            player.isAtTheRopes
          ) {
            // Only apply extra friction if player WAS crouch strafing
            if (
              player.isCrouchStrafing &&
              !player.isHit &&
              Math.abs(player.movementVelocity) > 0
            ) {
              player.movementVelocity *= 0.5; // Extra friction to stop quickly
            }
            player.isCrouchStrafing = false;
          }

          // Force stop strafing in certain states and add missing ground level check
          if (
            (!player.keys.a &&
              !player.keys.d &&
              (!player.canMoveToReady || room.gameStart)) ||
            player.isThrowTeching ||
            player.isRecovering ||
            (player.keys.a && player.keys.d) ||
            player.isAttacking || // Clear strafing during any attack (slap or charged)
            player.hasPendingSlapAttack || // Clear strafing when buffered slap attack is pending
            (player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime) || // Clear strafing during post-slap cooldown
            player.isHit || // Add isHit to force clear strafing when parried
            player.isRawParrying || // Add isRawParrying to force clear strafing during raw parry
            player.isAtTheRopes // Block strafing while at the ropes
          ) {
            player.isStrafing = false;
            // Don't immediately stop on ice unless hit
            if (!player.isHit) {
              player.movementVelocity *= MOVEMENT_FRICTION;
            }
            // Also clear grab walking if no movement conditions are met
            if (!player.keys.a && !player.keys.d) {
              player.isGrabWalking = false;
            }
          }

          // Keep player from going below ground level
          if (player.y > GROUND_LEVEL) {
            player.y -= delta * speedFactor + 10;
            player.y = Math.max(player.y, GROUND_LEVEL);
          }
        }
        if (
          (!player.keys.a &&
            !player.keys.d &&
            (!player.canMoveToReady || room.gameStart)) ||
          player.isThrowTeching ||
          player.isRecovering ||
          player.isAttacking || // Clear strafing during any attack
          player.hasPendingSlapAttack || // Clear strafing when buffered slap attack is pending
          (player.slapStrafeCooldown &&
            Date.now() < player.slapStrafeCooldownEndTime) || // Clear strafing during post-slap cooldown
          player.isHit || // Add isHit to force clear strafing when parried
          player.isRawParrying || // Add isRawParrying to force clear strafing during raw parry
          player.isAtTheRopes // Block strafing while at the ropes
        ) {
          // Add isRecovering and isHit checks
          player.isStrafing = false;
          if (!player.keys.a && !player.keys.d) {
            player.isGrabWalking = false;
          }
        }
        if (player.keys.a && player.keys.d) {
          player.isStrafing = false;
        }
        // Force clear strafing when hit (parried or otherwise)
        if (player.isHit) {
          player.isStrafing = false;
        }

        // Crouch stance
        if (
          player.keys.s &&
          !player.isDodging &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isGrabClashing &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isRecovering &&
          !player.isAttacking &&
          !player.isHit &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isAtTheRopes
        ) {
          // Start crouch stance if not already crouching
          if (!player.isCrouchStance) {
            player.isCrouchStance = true;
            player.isCrouchStrafing = false;
            // Clear movement momentum when starting crouch stance
            player.movementVelocity = 0;
            player.isStrafing = false;
          }
          // Only set isReady to false if we're not in an attack state
          if (!player.isAttacking && !player.isChargingAttack) {
            player.isReady = false;
          }
        }

        // Handle crouch stance ending logic
        if (player.isCrouchStance) {
          // End crouch stance when s key is released
          if (!player.keys.s) {
            player.isCrouchStance = false;
            player.isCrouchStrafing = false;
          }
        }

        // raw parry
        if (
          player.keys[" "] &&
          !player.isGrabBreaking && // Block raw parry while grab break is active
          !player.isGrabBreakCountered && // Block while countered by grab break
          !player.isGrabBreakSeparating && // Block during grab break separation
          !player.grabBreakSpaceConsumed && // Block until the triggering space press is released
          !player.isDodging && // Block raw parry during dodge - don't interrupt dodge hop
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isGrabbingMovement && // Block raw parry during grab movement
          !player.isWhiffingGrab && // Block raw parry during grab whiff recovery
          !player.isGrabClashing && // Block raw parry during grab clashing
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isRecovering &&
          !player.isAttacking && // Block during any attack (slap or charged)
          !player.isHit &&
          !player.isRawParryStun &&
          !player.isAtTheRopes
        ) {
          // Start raw parry if not already parrying
          if (!player.isRawParrying) {
            // Clear parry success state when starting a new parry
            player.isRawParrySuccess = false;
            player.isPerfectRawParrySuccess = false;
            
            player.isRawParrying = true;
            player.rawParryStartTime = Date.now();
            player.rawParryMinDurationMet = false;
            // Clear any existing charge attack when starting raw parry
            clearChargeState(player, true); // true = cancelled
            // Clear movement momentum when starting raw parry to prevent dodge momentum interference
            player.movementVelocity = 0;
            player.isStrafing = false;
            // Cancel power slide when parrying
            player.isPowerSliding = false;
            // Clear crouch states when starting raw parry
            player.isCrouchStance = false;
            player.isCrouchStrafing = false;
            // Clear buffered slap attack when starting raw parry
            player.hasPendingSlapAttack = false;
          }
          // Only set isReady to false if we're not in an attack state
          if (!player.isAttacking && !player.isChargingAttack) {
            player.isReady = false;
          }
        }

        // Handle raw parry ending logic
        if (player.isRawParrying) {
          // Force clear all movement states during raw parry to ensure animation priority
          player.isStrafing = false;
          player.movementVelocity = 0;
          player.isDodging = false;
          player.isAttacking = false;
          player.isJumping = false;
          // Force clear crouch states during raw parry to prevent concurrent use
          player.isCrouchStance = false;
          player.isCrouchStrafing = false;

          const parryDuration = Date.now() - player.rawParryStartTime;

          // Check if minimum duration has been met
          if (parryDuration >= 375) {
            player.rawParryMinDurationMet = true;
          }

          // Only end parry if spacebar is released AND minimum duration is met
          // Don't end parry if in perfect parry animation lock
          if (!player.keys[" "] && player.rawParryMinDurationMet && !player.isPerfectRawParrySuccess) {
            player.isRawParrying = false;
            player.rawParryStartTime = 0;
            player.rawParryMinDurationMet = false;
            // Space released - clear grab-break consumption so future parries can occur
            player.grabBreakSpaceConsumed = false;

            // Check if we should restart charging after raw parry ends
            // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
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
              // Restart charging immediately
              player.isChargingAttack = true;
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
              player.attackType = "charged";
            }
          }
        }

        if (
          player.isAttacking &&
          player.attackType === "charged" &&
          !player.isAtTheRopes
        ) {
          // Only move in the direction the player is facing, but not if at the ropes
          const attackDirection = player.facing === 1 ? -1 : 1;
          const newX = player.x + attackDirection * delta * speedFactor * 2.5;

          // Check if this movement would put player at the ropes
          const leftCheck = newX <= MAP_LEFT_BOUNDARY && attackDirection === -1;
          const rightCheck =
            newX >= MAP_RIGHT_BOUNDARY && attackDirection === 1;

          if (
            !player.isAtTheRopes &&
            (leftCheck || rightCheck) &&
            !room.gameOver
          ) {
            // Save the facing direction from the charged attack BEFORE clearing states
            const savedFacing = player.facing;

            // CRITICAL: Clear ALL action states when hitting the ropes
            clearAllActionStates(player);
            
            // Set at the ropes state
            player.isAtTheRopes = true;
            player.atTheRopesStartTime = Date.now();
            
            // Store the facing direction from the charged attack
            // This direction should persist through hits and ring-out until round reset
            player.atTheRopesFacingDirection = savedFacing;
            player.facing = savedFacing;

            // Clear knockback (clearAllActionStates doesn't clear this)
            player.knockbackVelocity = { x: 0, y: 0 };

            // Constrain player position to boundary
            if (newX <= MAP_LEFT_BOUNDARY) {
              player.x = MAP_LEFT_BOUNDARY;
            } else if (newX >= MAP_RIGHT_BOUNDARY) {
              player.x = MAP_RIGHT_BOUNDARY;
            }

            // Set timeout to end the at-the-ropes state
            setPlayerTimeout(
              player.id,
              () => {
                player.isAtTheRopes = false;
                player.atTheRopesStartTime = 0;
                player.atTheRopesFacingDirection = null;
              },
              AT_THE_ROPES_DURATION,
              "atTheRopesTimeout" // Named timeout for cleanup
            );
          } else {
            // Only update position if it's moving in the correct direction and not hitting boundaries
            if (
              (attackDirection === 1 && newX > player.x) ||
              (attackDirection === -1 && newX < player.x)
            ) {
              // Prevent attacker from passing through opponent during charged attack
              // This ensures the attack direction and facing remain consistent
              const opponent = room.players.find(p => p.id !== player.id && !p.isDead);
              if (opponent && !opponent.isDodging) {
                const minDistance = 30; // Scaled for camera zoom (was 40)
                const playerToLeft = player.x < opponent.x;
                const playerToRight = player.x > opponent.x;
                
                // If player is to the left of opponent and moving right, don't pass through
                if (playerToLeft && attackDirection === 1) {
                  const maxX = opponent.x - minDistance;
                  player.x = Math.min(newX, maxX);
                }
                // If player is to the right of opponent and moving left, don't pass through
                else if (playerToRight && attackDirection === -1) {
                  const minX = opponent.x + minDistance;
                  player.x = Math.max(newX, minX);
                }
                else {
                  player.x = newX;
                }
              } else {
                player.x = newX;
              }
            }
          }

          if (Date.now() >= player.attackEndTime) {
            // Use helper function to safely end charged attacks
            safelyEndChargedAttack(player, rooms);
          }
        } else if (
          player.isAttacking &&
          player.attackType === "charged" &&
          player.isAtTheRopes
        ) {
          // If at the ropes, still check for attack end time but don't move
          if (Date.now() >= player.attackEndTime) {
            // Use helper function to safely end charged attacks
            safelyEndChargedAttack(player, rooms);
          }
        }
        // ============================================
        // NEW GRAB ACTION SYSTEM - Decision Window → Auto-Push / Pull / Throw
        // 1s decision window where both players hold still, then action phase
        // ============================================
        if (
          player.isGrabbing &&
          player.grabbedOpponent &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isAttemptingGrabThrow &&  // Block during throw attempt
          !player.isAttemptingPull           // Block during pull attempt
        ) {
          const opponent = room.players.find(
            (p) => p.id === player.grabbedOpponent
          );
          if (opponent) {
            // Continuous stamina drain on GRABBER while grabbing
            if (!player.lastGrabStaminaDrainTime) {
              player.lastGrabStaminaDrainTime = player.grabStartTime;
            }
            const timeSinceLastDrain = Date.now() - player.lastGrabStaminaDrainTime;
            if (timeSinceLastDrain >= GRAB_STAMINA_DRAIN_INTERVAL) {
              player.stamina = Math.max(0, player.stamina - 1);
              player.lastGrabStaminaDrainTime = Date.now();
            }

            // Boundaries
            const leftBoundary = MAP_LEFT_BOUNDARY;
            const rightBoundary = MAP_RIGHT_BOUNDARY;

            // Keep opponent attached at fixed distance
            const baseDistance = Math.round(81 * 0.96);
            const distanceMultiplier = player.isAttemptingGrabThrow ? 1.15 : 1;
            const fixedDistance = baseDistance * distanceMultiplier * (opponent.sizeMultiplier || 1);

            // === IMMEDIATE PUSH (burst-with-decay, starts right after grab connects + hitstop) ===
            // Push is the DEFAULT action. Grabber can interrupt with pull (backward) or throw (W).
            if (player.isGrabPushing) {
              // Initialize push start time on first processing tick (after hitstop)
              if (!player.grabPushStartTime) {
                player.grabPushStartTime = Date.now();
              }

              const pushElapsed = Date.now() - player.grabPushStartTime;
              const pushElapsedSec = pushElapsed / 1000;

              // Safety cap — force separation at max duration
              if (pushElapsed >= GRAB_PUSH_MAX_DURATION) {
                executeGrabSeparation(player, opponent, room, io);
                activateBufferedInputAfterGrab(player, rooms);
                activateBufferedInputAfterGrab(opponent, rooms);
                return;
              }

              // Calculate current push speed: burst with exponential decay
              // Initial speed = base burst + momentum transferred from approach velocity
              const initialPushSpeed = GRAB_PUSH_BURST_BASE + (player.grabApproachSpeed || 0) * GRAB_PUSH_MOMENTUM_TRANSFER;
              const currentPushSpeed = initialPushSpeed * Math.exp(-GRAB_PUSH_DECAY_RATE * pushElapsedSec);

              // End push when velocity decays below threshold
              // UNLESS pinned at boundary (let max duration + stamina drain handle that)
              if (currentPushSpeed < GRAB_PUSH_MIN_VELOCITY && pushElapsed > 200 && !player.isAtBoundaryDuringGrab) {
                executeGrabSeparation(player, opponent, room, io);
                activateBufferedInputAfterGrab(player, rooms);
                activateBufferedInputAfterGrab(opponent, rooms);
                return;
              }

              // === Check for PULL interrupt during push (backward input after grace period) ===
              if (pushElapsed >= GRAB_PUSH_BACKWARD_GRACE && !player.isAttemptingPull && !player.isAttemptingGrabThrow) {
                const backwardKey = player.facing === -1 ? 'a' : 'd';
                const forwardKey = player.facing === -1 ? 'd' : 'a';
                const isPressingBackward = player.keys[backwardKey] && !player.keys[forwardKey];

                if (isPressingBackward) {
                  // Interrupt push → initiate pull reversal attempt
                  player.isGrabPushing = false;
                  player.isGrabWalking = false;
                  opponent.isBeingGrabPushed = false;
                  opponent.lastGrabPushStaminaDrainTime = 0;

                  // Reset opponent's counter state — they get a fresh read for each grab action
                  opponent.grabCounterAttempted = false;
                  opponent.grabCounterInput = null;

                  player.isAttemptingPull = true;
                  player.grabActionStartTime = Date.now();
                  player.grabActionType = "pull";
                  player.grabDurationPaused = true;
                  player.grabDurationPausedAt = Date.now();
                  player.actionLockUntil = Date.now() + GRAB_ACTION_WINDOW;

                  setPlayerTimeout(
                    player.id,
                    () => {
                      player.isAttemptingPull = false;
                      player.grabDurationPaused = false;
                      player.grabActionType = null;
                      player.grabActionStartTime = 0;
                      player.grabDecisionMade = false;
                      player.grabPushEndTime = 0;

                      const pullOpponent = room.players.find((p) => p.id !== player.id);
                      if (player.isGrabBreakCountered || !pullOpponent || pullOpponent.isGrabBreaking || pullOpponent.isGrabBreakSeparating) {
                        return;
                      }
                      if (!player.isGrabbing) {
                        return;
                      }

                      // Opponent did NOT counter — execute pull reversal!
                      const pullDirection = pullOpponent.x < player.x ? 1 : -1;
                      // Don't clamp targetX — let it overshoot so the tween handler detects boundary
                      const targetX = player.x + pullDirection * PULL_REVERSAL_DISTANCE;

                      cleanupGrabStates(player, pullOpponent);
                      pullOpponent.isBeingPullReversaled = true;
                      pullOpponent.pullReversalPullerId = player.id; // Track who pulled us

                      pullOpponent.isGrabBreakSeparating = true;
                      pullOpponent.grabBreakSepStartTime = Date.now();
                      pullOpponent.grabBreakSepDuration = PULL_REVERSAL_TWEEN_DURATION;
                      pullOpponent.grabBreakStartX = pullOpponent.x;
                      pullOpponent.grabBreakTargetX = targetX;

                      pullOpponent.movementVelocity = 0;
                      player.movementVelocity = 0;
                      pullOpponent.isStrafing = false;
                      player.isStrafing = false;

                      // Lock both players equally (cleared early when tween ends or boundary hit)
                      const pulledLockUntil = Date.now() + PULL_REVERSAL_PULLED_LOCK;
                      pullOpponent.inputLockUntil = Math.max(pullOpponent.inputLockUntil || 0, pulledLockUntil);
                      const pullerLockUntil = Date.now() + PULL_REVERSAL_PULLER_LOCK;
                      player.inputLockUntil = Math.max(player.inputLockUntil || 0, pullerLockUntil);

                      correctFacingAfterGrabOrThrow(player, pullOpponent);

                      player.grabCooldown = true;
                      setPlayerTimeout(player.id, () => { player.grabCooldown = false; }, 300, "pullReversalCooldown");

                      io.in(room.id).emit("pull_reversal", {
                        grabberId: player.id,
                        opponentId: pullOpponent.id,
                        grabberX: player.x,
                        targetX: targetX,
                      });
                    },
                    GRAB_ACTION_WINDOW
                  );

                  // Skip push processing this tick (pull takes over)
                  player.movementVelocity = 0;
                  return;
                }
              }
              // W (throw) interrupt is handled in the throw input section — allowed during push now.

              // === Push direction and movement ===
              const pushDirection = player.facing === -1 ? 1 : -1;

              // Passive stamina drain on pushed opponent
              if (!opponent.lastGrabPushStaminaDrainTime) {
                opponent.lastGrabPushStaminaDrainTime = Date.now();
              }
              const timeSinceOpponentDrain = Date.now() - opponent.lastGrabPushStaminaDrainTime;
              if (timeSinceOpponentDrain >= GRAB_PUSH_STAMINA_DRAIN_INTERVAL) {
                opponent.stamina = Math.max(0, opponent.stamina - 1);
                opponent.lastGrabPushStaminaDrainTime = Date.now();
              }

              // Apply push movement with current decaying speed
              const pushDelta = pushDirection * delta * speedFactor * currentPushSpeed;
              let newX = player.x + pushDelta;

              // Calculate where opponent would be
              const pushFixedDistance = baseDistance * (opponent.sizeMultiplier || 1);
              let newOpponentX = player.facing === 1
                ? newX - pushFixedDistance
                : newX + pushFixedDistance;

              // === BOUNDARY STAMINA GATING ===
              const opponentAtLeftBoundary = newOpponentX <= leftBoundary;
              const opponentAtRightBoundary = newOpponentX >= rightBoundary;

              if ((opponentAtLeftBoundary || opponentAtRightBoundary) && !room.gameOver) {
                if (opponent.stamina <= 0) {
                  // Opponent has no stamina — ring-out sequence
                  if (player.isAtBoundaryDuringGrab) {
                    player.isGrabBellyFlopping = true;
                    opponent.isBeingGrabBellyFlopped = true;
                  } else {
                    player.isGrabFrontalForceOut = true;
                    opponent.isBeingGrabFrontalForceOut = true;
                  }

                  player.isRingOutFreezeActive = true;
                  player.ringOutFreezeEndTime = Date.now() + 200;
                  player.ringOutThrowDirection = opponentAtLeftBoundary ? -1 : 1;
                  player.pendingRingOutThrowTarget = opponent.id;

                  setPlayerTimeout(
                    player.id,
                    () => {
                      const currentRoom = rooms.find((r) => r.id === room.id);
                      if (!currentRoom) return;
                      const grabberRef = currentRoom.players.find((p) => p.id === player.id);
                      const grabbedRef = currentRoom.players.find((p) => p.id === opponent.id);
                      if (!grabberRef || !grabbedRef) return;

                      grabberRef.isRingOutFreezeActive = false;
                      grabberRef.isGrabbing = false;
                      grabberRef.grabbedOpponent = null;
                      grabberRef.isGrabFrontalForceOut = false;
                      grabberRef.isGrabBellyFlopping = false;
                      grabberRef.isGrabPushing = false;
                      grabberRef.isGrabWalking = false;
                      grabbedRef.isBeingGrabbed = false;
                      grabbedRef.isBeingGrabFrontalForceOut = false;
                      grabbedRef.isBeingGrabBellyFlopped = false;
                      grabbedRef.isBeingGrabPushed = false;

                      grabberRef.isThrowing = true;
                      grabberRef.throwStartTime = Date.now();
                      grabberRef.throwEndTime = Date.now() + RINGOUT_THROW_DURATION_MS;
                      grabberRef.throwOpponent = grabbedRef.id;

                      clearAllActionStates(grabbedRef);
                      grabbedRef.isBeingThrown = true;

                      grabberRef.throwingFacingDirection = grabberRef.ringOutThrowDirection || 1;
                      grabbedRef.beingThrownFacingDirection = grabbedRef.facing;

                      grabberRef.isRingOutThrowCutscene = true;
                      grabberRef.ringOutThrowDistance = 5;
                      grabberRef.ringOutThrowDirection = null;
                      grabberRef.pendingRingOutThrowTarget = null;
                    },
                    200,
                    "ringOutFreezeDelay"
                  );

                  handleWinCondition(room, opponent, player, io);
                  opponent.knockbackVelocity = { ...opponent.knockbackVelocity };
                } else {
                  // Opponent has stamina — PIN at boundary
                  player.isAtBoundaryDuringGrab = true;

                  if (opponentAtLeftBoundary) {
                    newOpponentX = leftBoundary;
                  } else {
                    newOpponentX = rightBoundary;
                  }

                  newX = player.facing === 1
                    ? newOpponentX + pushFixedDistance
                    : newOpponentX - pushFixedDistance;

                  player.x = newX;
                  opponent.x = newOpponentX;
                }
              } else {
                // Not at boundary — normal push movement
                player.isAtBoundaryDuringGrab = false;
                newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
                player.x = newX;

                opponent.x = player.facing === 1
                  ? player.x - pushFixedDistance
                  : player.x + pushFixedDistance;
              }

              // Update opponent facing
              if (!opponent.atTheRopesFacingDirection) {
                opponent.facing = -player.facing;
              }
            }
            // === SAFETY: Not pushing (shouldn't normally happen — push starts at grab connect) ===
            else if (!player.isGrabPushing) {
              opponent.x = player.facing === 1
                ? player.x - fixedDistance
                : player.x + fixedDistance;
              if (!opponent.atTheRopesFacingDirection) {
                opponent.facing = -player.facing;
              }
            }

            // Zero grabber movement velocity during grab
            player.movementVelocity = 0;
          }
        } else if (
          player.isAttemptingGrabThrow &&
          player.isGrabbing &&
          player.grabbedOpponent
        ) {
          // Handle throw attempt state - maintain opponent position with slightly increased separation
          const opponent = room.players.find(
            (p) => p.id === player.grabbedOpponent
          );
          if (opponent) {
            const baseDistance = Math.round(81 * 0.96);
            const fixedDistance = baseDistance * 1.15 * (opponent.sizeMultiplier || 1);
            opponent.x =
              player.facing === 1
                ? player.x - fixedDistance
                : player.x + fixedDistance;
            if (!opponent.atTheRopesFacingDirection) {
              opponent.facing = -player.facing;
            }

            // FIRST-INPUT-COMMITS counter system for throw
            // The grabbed player must commit to one directional input.
            // Correct input (S) = break. Wrong input (A or D) = locked out.
            if (!opponent.grabCounterAttempted && !opponent.isGrabBreaking && !opponent.isCounterGrabbed) {
              // Detect any directional counter input (S, A, or D)
              const pressedS = opponent.keys.s;
              const pressedA = opponent.keys.a;
              const pressedD = opponent.keys.d;
              if (pressedS || pressedA || pressedD) {
                opponent.grabCounterAttempted = true;
                // Lock in whichever key was pressed first (priority: S > A > D is arbitrary, 
                // but in practice only one should be intentional)
                opponent.grabCounterInput = pressedS ? 's' : (pressedA ? 'a' : 'd');
                
                if (opponent.grabCounterInput === 's') {
                  // Correct counter — break the throw!
                  executeDirectionalGrabBreak(player, opponent, room, io);
                  return;
                }
                // Wrong input — locked out, throw will succeed when window ends
              }
            }
          }
        } else if (
          player.isAttemptingPull &&
          player.isGrabbing &&
          player.grabbedOpponent
        ) {
          // Handle pull attempt state - maintain opponent position with increased gap
          const opponent = room.players.find(
            (p) => p.id === player.grabbedOpponent
          );
          if (opponent) {
            const baseDistance = Math.round(81 * 0.96);
            const fixedDistance = baseDistance * GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER * (opponent.sizeMultiplier || 1);
            opponent.x =
              player.facing === 1
                ? player.x - fixedDistance
                : player.x + fixedDistance;
            if (!opponent.atTheRopesFacingDirection) {
              opponent.facing = -player.facing;
            }

            // FIRST-INPUT-COMMITS counter system for pull
            // The correct counter is the direction matching the pull (opposite of grabber's backward).
            // Wrong input = locked out.
            const counterKey = player.facing === -1 ? 'd' : 'a';
            if (!opponent.grabCounterAttempted && !opponent.isGrabBreaking && !opponent.isCounterGrabbed) {
              const pressedS = opponent.keys.s;
              const pressedA = opponent.keys.a;
              const pressedD = opponent.keys.d;
              if (pressedS || pressedA || pressedD) {
                opponent.grabCounterAttempted = true;
                opponent.grabCounterInput = pressedS ? 's' : (pressedA ? 'a' : 'd');
                
                if (opponent.grabCounterInput === counterKey) {
                  // Correct counter — break the pull!
                  executeDirectionalGrabBreak(player, opponent, room, io);
                  return;
                }
                // Wrong input — locked out, pull will succeed when window ends
              }
            }
          }
        } else if (player.isGrabbing && !player.grabbedOpponent) {
          const grabDuration = Date.now() - player.grabStartTime;
          if (grabDuration >= 500) {
            player.isGrabbing = false;
            // NOTE: Charging restart is handled by continuous mouse1 check below
          }
        }

        // Apply speed power-up effect
        if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
          player.speedFactor = speedFactor * player.powerUpMultiplier;
        } else {
          player.speedFactor = speedFactor;
        }

        // Apply size power-up effect
        // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
        //   player.sizeMultiplier = player.powerUpMultiplier;
        // } else {
        player.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
        // }

        // Update charge attack power in the game loop
        if (player.isChargingAttack) {
          const chargeDuration = Date.now() - player.chargeStartTime;
          player.chargeAttackPower = Math.min(
            (chargeDuration / 750) * 100,
            100
          ); // Changed from 1200 to 750 for faster charge
        }

        // INPUT BUFFERING: Apply buffered key states when game starts
        // This allows players to hold mouse1 before hakkiyoi — but uses a fresh timestamp
        // so the 200ms charge threshold is measured from game start, not pre-game
        if (room.gameStart && player.mouse1BufferedBeforeStart) {
          player.keys.mouse1 = true;
          player.mouse1PressTime = Date.now();
          player.mouse1BufferedBeforeStart = false;
        }

        // CONTINUOUS MOUSE1 CHECK: Auto-start charging when mouse1 is held past threshold
        // canPlayerCharge() checks: !isChargingAttack AND isPlayerInActiveState() which includes
        // !isAttacking, !isRecovering, !isHit, !isGrabbing, !isDodging, etc.
        if (
          room.gameStart && // Only during active gameplay
          player.keys.mouse1 && // Mouse1 is being held
          player.mouse1PressTime > 0 && // Press time is tracked
          (Date.now() - player.mouse1PressTime) >= 200 && // Past slap threshold (200ms)
          !(player.inputLockUntil && Date.now() < player.inputLockUntil) && // Not during input freeze
          canPlayerCharge(player) // All blocking states are cleared (includes !isChargingAttack)
        ) {
          startCharging(player);
        }

        // Clear strafing cooldown when it expires
        if (
          player.slapStrafeCooldown &&
          Date.now() >= player.slapStrafeCooldownEndTime
        ) {
          player.slapStrafeCooldown = false;
          player.slapStrafeCooldownEndTime = 0;
        }

        // FINAL GUARD: sanitize stamina once per tick per player before emit
        player.stamina = clampStaminaValue(player.stamina);
      });

      // ROOM-LEVEL SAFETY: Check game reset outside player loop
      // This ensures reset is checked even if all players return early
      // (e.g., during hitstop, or if loser has isHit=false)
      if (
        room.gameOver &&
        room.gameOverTime &&
        Date.now() - room.gameOverTime >= 3000 &&
        !room.matchOver
      ) {
        resetRoomAndPlayers(room);
      }

      // PERFORMANCE: Only broadcast every N ticks to reduce network load
      // Game logic runs at 64Hz, broadcasts at 32Hz — client interpolation smooths to 60fps
      if (broadcastTickCounter % BROADCAST_EVERY_N_TICKS === 0) {
        // Initialize previousPlayerStates if it doesn't exist (for rooms created before optimization)
        if (!room.previousPlayerStates) {
          room.previousPlayerStates = [null, null];
        }
        
        // PERFORMANCE: Use delta updates - only send changed properties
        // This significantly reduces network bandwidth and client-side processing
        const player1Delta = computePlayerDelta(room.players[0], room.previousPlayerStates[0]);
        const player2Delta = computePlayerDelta(room.players[1], room.previousPlayerStates[1]);
        
        // Store current state for next comparison
        room.previousPlayerStates[0] = clonePlayerState(room.players[0]);
        room.previousPlayerStates[1] = clonePlayerState(room.players[1]);
        
        io.in(room.id).emit("fighter_action", {
          player1: player1Delta,
          player2: player2Delta,
          // Include flag so client knows this is a delta update
          isDelta: true,
        });
      }
    }
    
    // Increment broadcast counter
    broadcastTickCounter++;

    if (staminaRegenCounter >= STAMINA_REGEN_INTERVAL_MS) {
      staminaRegenCounter = 0; // Reset the counter after interval
    }
  }

  function checkCollision(player, otherPlayer) {
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

    // For slap attacks, only check horizontal distance like grab
    if (player.attackType === "slap") {
      const horizontalDistance = Math.abs(player.x - otherPlayer.x);
      if (horizontalDistance < hitboxDistance) {
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
              resolveSlapParry(player, otherPlayer, currentRoom.id);
            }
            return;
          }
        }
        // First-to-active wins: if defender is in grab startup, timing determines winner
        if (otherPlayer.isGrabStartup && grabBeatsSlap(otherPlayer, player)) {
          return; // Grab wins — don't process slap hit, grab will connect
        }
        processHit(player, otherPlayer);
      }
      return;
    }

    // For charged attacks, use the full circular hitbox
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

    if (isCollision) {
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
          processHit(player, otherPlayer);
        } else if (otherPlayerHasThickBlubber && !playerHasThickBlubber) {
          // Other player has thick blubber, they win
          processHit(otherPlayer, player);
        } else {
          // Either both have thick blubber or neither do - use random selection
          const winner = Math.random() < 0.5 ? player : otherPlayer;
          const loser = winner === player ? otherPlayer : player;
          processHit(winner, loser);
        }
      } else {
        processHit(player, otherPlayer);
      }
    }
  }

  function resolveSlapParry(player1, player2, roomId) {
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

  function processHit(player, otherPlayer) {
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
      if (isPerfectParry) {
        // Perfect parry: keep isRawParrying active and lock movement
        otherPlayer.isRawParrying = true;
        otherPlayer.isPerfectRawParrySuccess = true;
        otherPlayer.inputLockUntil = Math.max(otherPlayer.inputLockUntil || 0, Date.now() + PERFECT_PARRY_ANIMATION_LOCK);
      } else {
        // Regular parry: use parry success animation
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

          // After knockback ends, check if we should restart charging
          // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
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
            // Restart charging immediately
            player.isChargingAttack = true;
            player.chargeStartTime = Date.now();
            player.chargeAttackPower = 1;
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
        player.knockbackVelocity.x = PERFECT_PARRY_KNOCKBACK * pushDirection;
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
            // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
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
              // Restart charging immediately
              player.isChargingAttack = true;
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
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

  socket.on("get_rooms", () => {
    socket.emit("rooms", rooms);
  });

  socket.on("lobby", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);
    if (roomIndex !== -1) {
      // Send current lobby state to the requesting client
      socket.emit("lobby", rooms[roomIndex].players);
    }
  });

  // Handle mawashi color updates - broadcast to all players in room
  socket.on("update_mawashi_color", (data) => {
    const { roomId, playerId, color } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    
    if (roomIndex === -1) return;
    
    const room = rooms[roomIndex];
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    
    if (playerIndex === -1) return;
    
    // PvP: reject if color is already taken by the other player (normalize for comparison)
    const otherPlayer = room.players[1 - playerIndex];
    if (otherPlayer && !otherPlayer.isCPU) {
      const otherHex = (otherPlayer.mawashiColor || "").toString().toLowerCase();
      const newHex = (color || "").toString().toLowerCase();
      if (otherHex && newHex && otherHex === newHex) {
        return; // Don't apply duplicate color
      }
    }
    
    // Update the player's mawashi color
    room.players[playerIndex].mawashiColor = color;

    // Broadcast updated player data to all players in the room
    io.in(roomId).emit("lobby", room.players);
    io.emit("rooms", getCleanedRoomsData(rooms));

    // Also emit a specific color update event for immediate UI updates
    io.in(roomId).emit("mawashi_color_updated", {
      playerId,
      playerIndex,
      color,
    });
  });

  socket.on("join_room", (data) => {
    socket.join(data.roomId);
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);

    // Check if room is in opponent disconnected state - prevent joining
    if (
      rooms[roomIndex].opponentDisconnected ||
      rooms[roomIndex].disconnectedDuringGame
    ) {
      socket.emit("join_room_failed", {
        reason: "Room is currently unavailable",
        roomId: data.roomId,
      });
      socket.leave(data.roomId);
      return;
    }

    // If someone is joining and there's already one player, ensure clean room state
    if (rooms[roomIndex].players.length === 1) {
      cleanupRoomState(rooms[roomIndex]);
      // Also clean up the existing player's power-up related state
      const existingPlayer = rooms[roomIndex].players[0];
      existingPlayer.activePowerUp = null;
      existingPlayer.powerUpMultiplier = 1;
      existingPlayer.selectedPowerUp = null;
      existingPlayer.isThrowingSalt = false;
      existingPlayer.saltCooldown = false;
      existingPlayer.snowballCooldown = false;
      existingPlayer.pumoArmyCooldown = false;
      existingPlayer.isThrowingSnowball = false;
      existingPlayer.isSpawningPumoArmy = false;
      existingPlayer.hitAbsorptionUsed = false;
      existingPlayer.snowballs = [];
      existingPlayer.pumoArmy = [];
      // Ensure default size is applied
      existingPlayer.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
      // Don't set canMoveToReady here - it should only be set during actual salt throwing phase
    }

    if (rooms[roomIndex].players.length < 1) {
      rooms[roomIndex].players.push({
        id: data.socketId,
        fighter: "player 1",
        color: "aqua",
        mawashiColor: "#5BC0DE", // Default light blue for Player 1
        isJumping: false,
        isAttacking: false,
        throwCooldown: false,
        grabCooldown: false,
        isChargingAttack: false,
        chargeStartTime: 0,
        chargeMaxDuration: 2000,
        chargeAttackPower: 0,
        chargingFacingDirection: null,
        slapFacingDirection: null,
        isSlapAttack: false,
        slapAnimation: 2,
        isThrowing: false,
        isThrowingSalt: false,
        saltCooldown: false,
        snowballCooldown: false,
        lastSnowballTime: 0,
        snowballs: [],
        isThrowingSnowball: false,
        pumoArmyCooldown: false,
        pumoArmy: [],
        isSpawningPumoArmy: false,
        throwStartTime: 0,
        throwEndTime: 0,
        throwOpponent: null,
        throwingFacingDirection: null,
        beingThrownFacingDirection: null,
        isGrabbing: false,
        isGrabWalking: false,
        isGrabbingMovement: false,
        isGrabStartup: false,
        isWhiffingGrab: false,
        isGrabWhiffRecovery: false,
        isGrabTeching: false,
        grabTechRole: null,
        grabTechResidualVel: 0,
        isGrabClashing: false,
        grabClashStartTime: 0,
        grabClashInputCount: 0,
        grabMovementStartTime: 0,
        grabMovementDirection: 0,
        grabMovementVelocity: 0,
        grabStartupStartTime: 0,
        grabStartupDuration: 0,
        grabStartTime: 0,
        grabbedOpponent: null,
        // New grab action system states
        isGrabPushing: false,
        isBeingGrabPushed: false,
        isAttemptingPull: false,
        isBeingPullReversaled: false,
        pullReversalPullerId: null,
        isGrabSeparating: false,
        isGrabBellyFlopping: false,
        isBeingGrabBellyFlopped: false,
        isGrabFrontalForceOut: false,
        isBeingGrabFrontalForceOut: false,
        grabActionStartTime: 0,
        grabActionType: null,
        lastGrabPushStaminaDrainTime: 0,
        isAtBoundaryDuringGrab: false,
        grabDurationPaused: false,
        grabDurationPausedAt: 0,
        grabPushEndTime: 0,
        grabPushStartTime: 0,
        grabApproachSpeed: 0,
        grabDecisionMade: false,
        isThrowTeching: false,
        throwTechCooldown: false,
        isSlapParrying: false,
        slapParryKnockbackVelocity: 0,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isBraking: false,
        isPowerSliding: false,
        strafeStartTime: 0,
        isCrouchStance: false,
        isCrouchStrafing: false,
        isRawParrying: false,
        rawParryStartTime: 0,
        rawParryMinDurationMet: false,
        isRawParryStun: false,
        perfectParryStunStartTime: 0,
        perfectParryStunBaseTimeout: null,
        isRawParrySuccess: false,
        isPerfectRawParrySuccess: false,
        isAtTheRopes: false,
        atTheRopesStartTime: 0,
        atTheRopesFacingDirection: null,
        dodgeDirection: false,
        dodgeEndTime: 0,
        isDodgeCancelling: false,
        dodgeCancelStartTime: 0,
        dodgeCancelStartY: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: 1,
        stamina: 100,
        x: 220,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        // Visual clarity timing states
        isInStartupFrames: false,
        startupEndTime: 0,
        isInEndlag: false,
        endlagEndTime: 0,
        attackCooldownUntil: 0,
        keys: {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": false,
          shift: false,
          e: false,
          f: false,
          c: false,
          mouse1: false,
          mouse2: false,
        },
        wins: [],
        bufferedAction: null, // Add buffer for pending actions
        bufferExpiryTime: 0, // Add expiry time for buffered actions
        wantsToRestartCharge: false, // Add flag for charge restart detection
        mouse1HeldDuringAttack: false, // Add flag for simpler charge restart detection
        mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
        mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
        knockbackImmune: false, // Add knockback immunity flag
        knockbackImmuneEndTime: 0, // Add knockback immunity timer
        // Add missing power-up initialization
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
        hitAbsorptionUsed: false, // Add thick blubber hit absorption tracking
        hitCounter: 0, // Add counter for reliable hit sound triggering
        lastHitTime: 0, // Add timing tracking for dynamic hit duration
        lastSlapHitLandedTime: 0, // Track when attacker last landed a slap (for chain lunge)
        lastCheckedAttackTime: 0, // Add tracking for attack collision checking
        hasPendingSlapAttack: false, // Add flag for buffering one additional slap attack
        mouse1JustPressed: false, // Track if mouse1 was just pressed this frame
        mouse1JustReleased: false, // Track if mouse1 was just released this frame
        mouse2JustPressed: false, // Track if mouse2 was just pressed this frame (grab)
        mouse2JustReleased: false, // Track if mouse2 was just released this frame
        shiftJustPressed: false, // Track if shift was just pressed this frame
        eJustPressed: false, // Track if E was just pressed this frame
        wJustPressed: false, // Track if W was just pressed this frame
        fJustPressed: false, // Track if F was just pressed this frame
        spaceJustPressed: false, // Track if spacebar was just pressed this frame
        attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
        attackAttemptTime: 0, // When attack execution started (for counter hit detection)
        isOverlapping: false, // Track overlap state for smoother separation
        overlapStartTime: null, // Track when overlap began for progressive separation
        chargeCancelled: false, // Track if charge was cancelled (vs executed)
        isGrabBreaking: false,
        isGrabBreakCountered: false,
        grabBreakSpaceConsumed: false,
        postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
        isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
        // Ring-out throw cutscene flags
        isRingOutThrowCutscene: false,
        ringOutThrowDistance: 0,
        isRingOutFreezeActive: false,
        ringOutFreezeEndTime: 0,
        ringOutThrowDirection: null,
        inputLockUntil: 0,
      });
      // PERFORMANCE: Register player 1 in lookup maps
      registerPlayerInMaps(rooms[roomIndex].players[0], rooms[roomIndex]);
    } else if (rooms[roomIndex].players.length === 1) {
      rooms[roomIndex].players.push({
        id: data.socketId,
        fighter: "player 2",
        color: "salmon",
        mawashiColor: "#DC143C", // Default crimson red for Player 2
        isJumping: false,
        isAttacking: false,
        throwCooldown: false,
        grabCooldown: false,
        isChargingAttack: false,
        chargeStartTime: 0,
        chargeMaxDuration: 2000,
        chargeAttackPower: 0,
        chargingFacingDirection: null,
        slapFacingDirection: null,
        isSlapAttack: false,
        slapAnimation: 2,
        isThrowing: false,
        isThrowingSalt: false,
        saltCooldown: false,
        snowballCooldown: false,
        lastSnowballTime: 0,
        snowballs: [],
        isThrowingSnowball: false,
        pumoArmyCooldown: false,
        pumoArmy: [],
        isSpawningPumoArmy: false,
        throwStartTime: 0,
        throwEndTime: 0,
        throwOpponent: null,
        throwingFacingDirection: null,
        beingThrownFacingDirection: null,
        isGrabbing: false,
        isGrabWalking: false,
        isGrabbingMovement: false,
        isGrabStartup: false,
        isWhiffingGrab: false,
        isGrabWhiffRecovery: false,
        isGrabTeching: false,
        grabTechRole: null,
        grabTechResidualVel: 0,
        isGrabClashing: false,
        grabClashStartTime: 0,
        grabClashInputCount: 0,
        grabMovementStartTime: 0,
        grabMovementDirection: 0,
        grabMovementVelocity: 0,
        grabStartupStartTime: 0,
        grabStartupDuration: 0,
        grabStartTime: 0,
        grabbedOpponent: null,
        // New grab action system states
        isGrabPushing: false,
        isBeingGrabPushed: false,
        isAttemptingPull: false,
        isBeingPullReversaled: false,
        pullReversalPullerId: null,
        isGrabSeparating: false,
        isGrabBellyFlopping: false,
        isBeingGrabBellyFlopped: false,
        isGrabFrontalForceOut: false,
        isBeingGrabFrontalForceOut: false,
        grabActionStartTime: 0,
        grabActionType: null,
        lastGrabPushStaminaDrainTime: 0,
        isAtBoundaryDuringGrab: false,
        grabDurationPaused: false,
        grabDurationPausedAt: 0,
        grabPushEndTime: 0,
        grabPushStartTime: 0,
        grabApproachSpeed: 0,
        grabDecisionMade: false,
        isThrowTeching: false,
        throwTechCooldown: false,
        isSlapParrying: false,
        slapParryKnockbackVelocity: 0,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isBraking: false,
        isPowerSliding: false,
        strafeStartTime: 0,
        isCrouchStance: false,
        isCrouchStrafing: false,
        isRawParrying: false,
        rawParryStartTime: 0,
        rawParryMinDurationMet: false,
        isRawParryStun: false,
        perfectParryStunStartTime: 0,
        perfectParryStunBaseTimeout: null,
        isRawParrySuccess: false,
        isPerfectRawParrySuccess: false,
        isAtTheRopes: false,
        atTheRopesStartTime: 0,
        atTheRopesFacingDirection: null,
        dodgeDirection: null,
        dodgeEndTime: 0,
        isDodgeCancelling: false,
        dodgeCancelStartTime: 0,
        dodgeCancelStartY: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: -1,
        stamina: 100,
        x: 845,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        // Visual clarity timing states
        isInStartupFrames: false,
        startupEndTime: 0,
        isInEndlag: false,
        endlagEndTime: 0,
        attackCooldownUntil: 0,
        keys: {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": false,
          shift: false,
          e: false,
          f: false,
          c: false,
          mouse1: false,
          mouse2: false,
        },
        wins: [],
        bufferedAction: null, // Add buffer for pending actions
        bufferExpiryTime: 0, // Add expiry time for buffered actions
        wantsToRestartCharge: false, // Add flag for charge restart detection
        mouse1HeldDuringAttack: false, // Add flag for simpler charge restart detection
        mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
        mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
        knockbackImmune: false, // Add knockback immunity flag
        knockbackImmuneEndTime: 0, // Add knockback immunity timer
        // Add missing power-up initialization
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
        hitAbsorptionUsed: false, // Add thick blubber hit absorption tracking
        hitCounter: 0, // Add counter for reliable hit sound triggering
        lastHitTime: 0, // Add timing tracking for dynamic hit duration
        lastSlapHitLandedTime: 0, // Track when attacker last landed a slap (for chain lunge)
        lastCheckedAttackTime: 0, // Add tracking for attack collision checking
        hasPendingSlapAttack: false, // Add flag for buffering one additional slap attack
        mouse1JustPressed: false, // Track if mouse1 was just pressed this frame
        mouse1JustReleased: false, // Track if mouse1 was just released this frame
        mouse2JustPressed: false, // Track if mouse2 was just pressed this frame (grab)
        mouse2JustReleased: false, // Track if mouse2 was just released this frame
        shiftJustPressed: false, // Track if shift was just pressed this frame
        eJustPressed: false, // Track if E was just pressed this frame
        wJustPressed: false, // Track if W was just pressed this frame
        fJustPressed: false, // Track if F was just pressed this frame
        spaceJustPressed: false, // Track if spacebar was just pressed this frame
        attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
        attackAttemptTime: 0, // When attack execution started (for counter hit detection)
        isOverlapping: false, // Track overlap state for smoother separation
        overlapStartTime: null, // Track when overlap began for progressive separation
        chargeCancelled: false, // Track if charge was cancelled (vs executed)
        isGrabBreaking: false,
        isGrabBreakCountered: false,
        grabBreakSpaceConsumed: false,
        postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
        isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
        // Ring-out throw cutscene flags
        isRingOutThrowCutscene: false,
        ringOutThrowDistance: 0,
        isRingOutFreezeActive: false,
        ringOutFreezeEndTime: 0,
        ringOutThrowDirection: null,
        inputLockUntil: 0,
        // Dohyo fall physics
        isFallingOffDohyo: false,
      });
      // PERFORMANCE: Register player 2 in lookup maps
      registerPlayerInMaps(rooms[roomIndex].players[1], rooms[roomIndex]);
    }

    // If this is the second player joining and room was in disconnected state, reset it
    if (
      rooms[roomIndex].players.length === 2 &&
      rooms[roomIndex].opponentDisconnected
    ) {
      rooms[roomIndex].opponentDisconnected = false;
      rooms[roomIndex].disconnectedDuringGame = false;

      // Clear any lingering power-up selection state
      rooms[roomIndex].powerUpSelectionPhase = false;
      rooms[roomIndex].playersSelectedPowerUps = {};
      rooms[roomIndex].playerAvailablePowerUps = {};

      // Clear any remaining round start timer
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
      }

      // Clean up the room state
      cleanupRoomState(rooms[roomIndex]);
    }

    socket.roomId = data.roomId;
    io.to(data.roomId).emit("rooms", rooms);
    io.to(data.roomId).emit("lobby", rooms[roomIndex].players);
    // console.log(rooms[roomIndex].players);
  });

  // CPU Match creation handler
  socket.on("create_cpu_match", (data) => {
    // Generate a unique room ID for this CPU match
    const cpuRoomId = `cpu-${data.socketId}-${Date.now()}`;
    
    // Create a new room specifically for this CPU match
    const room = {
      id: cpuRoomId,
      players: [],
      readyCount: 0,
      rematchCount: 0,
      gameStart: false,
      gameOver: false,
      matchOver: false,
      readyStartTime: null,
      roundStartTimer: null,
      hakkiyoiCount: 0,
      teWoTsuiteSent: false, // Track if gyoji call was sent before HAKKIYOI
      isCPURoom: true, // Mark as CPU room
      playerAvailablePowerUps: {},
      playersSelectedPowerUps: {},
    };
    
    // Add the CPU room to the rooms array
    rooms.push(room);

    // Add human player as player 1
    socket.join(room.id);
    socket.roomId = room.id;

    room.players.push({
      id: data.socketId,
      fighter: "player 1",
      color: "aqua",
      mawashiColor: "#5BC0DE", // Default light blue for Player 1
      isJumping: false,
      isAttacking: false,
      throwCooldown: false,
      grabCooldown: false,
      isChargingAttack: false,
      chargeStartTime: 0,
      chargeMaxDuration: 2000,
      chargeAttackPower: 0,
      chargingFacingDirection: null,
      slapFacingDirection: null,
      isSlapAttack: false,
      slapAnimation: 2,
      isThrowing: false,
      isThrowingSalt: false,
      saltCooldown: false,
      snowballCooldown: false,
      lastSnowballTime: 0,
      snowballs: [],
      isThrowingSnowball: false,
      pumoArmyCooldown: false,
      pumoArmy: [],
      isSpawningPumoArmy: false,
      throwStartTime: 0,
      throwEndTime: 0,
      throwOpponent: null,
      throwingFacingDirection: null,
      beingThrownFacingDirection: null,
      isGrabbing: false,
      isGrabWalking: false,
      isGrabbingMovement: false,
      isGrabStartup: false,
      isWhiffingGrab: false,
      isGrabWhiffRecovery: false,
      isGrabTeching: false,
      grabTechRole: null,
      grabTechResidualVel: 0,
      isGrabClashing: false,
      grabClashStartTime: 0,
      grabClashInputCount: 0,
      grabMovementStartTime: 0,
      grabMovementDirection: 0,
      grabMovementVelocity: 0,
      grabStartupStartTime: 0,
      grabStartupDuration: 0,
      grabStartTime: 0,
      grabbedOpponent: null,
      // New grab action system states
      isGrabPushing: false,
      isBeingGrabPushed: false,
      isAttemptingPull: false,
      isBeingPullReversaled: false,
      pullReversalPullerId: null,
      isGrabSeparating: false,
      isGrabBellyFlopping: false,
      isBeingGrabBellyFlopped: false,
      isGrabFrontalForceOut: false,
      isBeingGrabFrontalForceOut: false,
      grabActionStartTime: 0,
      grabActionType: null,
      lastGrabPushStaminaDrainTime: 0,
      isAtBoundaryDuringGrab: false,
      grabDurationPaused: false,
      grabDurationPausedAt: 0,
      grabPushEndTime: 0,
      grabPushStartTime: 0,
      grabApproachSpeed: 0,
      grabDecisionMade: false,
      isThrowTeching: false,
      throwTechCooldown: false,
      isSlapParrying: false,
      lastThrowAttemptTime: 0,
      lastGrabAttemptTime: 0,
      isStrafing: false,
      isBraking: false,
      isPowerSliding: false,
      isCrouchStance: false,
      isCrouchStrafing: false,
      isRawParrying: false,
      rawParryStartTime: 0,
      rawParryMinDurationMet: false,
      isRawParryStun: false,
      perfectParryStunStartTime: 0,
      perfectParryStunBaseTimeout: null,
      isRawParrySuccess: false,
      isPerfectRawParrySuccess: false,
      isAtTheRopes: false,
      atTheRopesStartTime: 0,
      atTheRopesFacingDirection: null,
      dodgeDirection: false,
      dodgeEndTime: 0,
      isDodgeCancelling: false,
      dodgeCancelStartTime: 0,
      dodgeCancelStartY: 0,
      isReady: false,
      isHit: false,
      isAlreadyHit: false,
      isDead: false,
      isBowing: false,
      facing: 1,
      stamina: 100,
      x: 220,
      y: GROUND_LEVEL,
      knockbackVelocity: { x: 0, y: 0 },
      movementVelocity: 0,
      // Visual clarity timing states
      isInStartupFrames: false,
      startupEndTime: 0,
      isInEndlag: false,
      endlagEndTime: 0,
      attackCooldownUntil: 0,
      keys: {
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
      },
      wins: [],
      bufferedAction: null,
      bufferExpiryTime: 0,
      wantsToRestartCharge: false,
      mouse1HeldDuringAttack: false,
      mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
      mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
      knockbackImmune: false,
      knockbackImmuneEndTime: 0,
      activePowerUp: null,
      powerUpMultiplier: 1,
      selectedPowerUp: null,
      sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
      hitAbsorptionUsed: false,
      hitCounter: 0,
      lastHitTime: 0,
      lastSlapHitLandedTime: 0,
      lastCheckedAttackTime: 0,
      hasPendingSlapAttack: false,
      mouse1JustPressed: false,
      mouse1JustReleased: false,
      mouse2JustPressed: false,
      mouse2JustReleased: false,
      shiftJustPressed: false,
      eJustPressed: false,
      wJustPressed: false,
      fJustPressed: false,
      spaceJustPressed: false,
      attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
      attackAttemptTime: 0, // When attack execution started (for counter hit detection)
      isOverlapping: false,
      overlapStartTime: null,
      chargeCancelled: false,
      isGrabBreaking: false,
      isGrabBreakCountered: false,
      grabBreakSpaceConsumed: false,
      postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
      isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
      isRingOutThrowCutscene: false,
      ringOutThrowDistance: 0,
      isRingOutFreezeActive: false,
      ringOutFreezeEndTime: 0,
      ringOutThrowDirection: null,
      inputLockUntil: 0,
      // Dohyo fall physics
      isFallingOffDohyo: false,
    });

    // Add CPU player as player 2 with unique ID tied to the room
    const cpuPlayerId = `CPU_${cpuRoomId}`;
    const cpuPlayer = createCPUPlayer(cpuPlayerId);
    room.players.push(cpuPlayer);
    room.cpuPlayerId = cpuPlayerId; // Store for cleanup
    
    // PERFORMANCE: Register both players in lookup maps
    registerPlayerInMaps(room.players[0], room);
    registerPlayerInMaps(cpuPlayer, room);

    // Emit success to the client
    socket.emit("cpu_match_created", {
      roomId: room.id,
      players: room.players,
    });

    // Update lobby
    io.in(room.id).emit("lobby", room.players);
    io.emit("rooms", getCleanedRoomsData(rooms));
  });

  socket.on("ready_count", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);
    if (roomIndex === -1) return; // Room not found

    const room = rooms[roomIndex];

    // Find the player in the room
    const playerIndex = room.players.findIndex(
      (player) => player.id === data.playerId
    );

    if (playerIndex === -1) return; // Player not found in room

    if (data.isReady) {
      // Only increment if player wasn't already ready
      if (!room.players[playerIndex].isReady) {
        room.players[playerIndex].isReady = true;
        room.readyCount++;

        // If this is a CPU room and human player just readied: assign CPU a random color (not the player's), then auto-ready CPU
        if (room.isCPURoom) {
          const cpuPlayer = room.players.find((p) => p.isCPU);
          const humanPlayer = room.players[playerIndex];
          if (cpuPlayer && !cpuPlayer.isReady) {
            const playerColor = humanPlayer.mawashiColor
              || (humanPlayer.color === "aqua" ? "#00FFFF" : humanPlayer.color);
            const availableColors = LOBBY_COLORS.filter(
              (c) => c.toLowerCase() !== (playerColor || "").toLowerCase()
            );
            const chosen = availableColors.length > 0
              ? availableColors[Math.floor(Math.random() * availableColors.length)]
              : "#DC143C";
            cpuPlayer.mawashiColor = chosen;
            cpuPlayer.isReady = true;
            room.readyCount++;
          }
        }
      }
    } else {
      // Only decrement if player was ready
      if (room.players[playerIndex].isReady) {
        room.readyCount--;
        room.players[playerIndex].isReady = false;
      }

      // If this is a CPU room and human player unreadied, also unready the CPU
      if (room.isCPURoom) {
        const cpuPlayer = room.players.find((p) => p.isCPU);
        if (cpuPlayer && cpuPlayer.isReady) {
          cpuPlayer.isReady = false;
          room.readyCount--;
        }
      }
    }

    // Ensure ready count doesn't go below 0
    room.readyCount = Math.max(0, room.readyCount);

    io.in(data.roomId).emit("ready_count", room.readyCount);
    io.in(data.roomId).emit("lobby", room.players);

    if (room.readyCount > 1) {
      // Mark this as the initial round - power-up selection will wait for pre_match_complete
      room.isInitialRound = true;
      // Send players with mawashiColor so client shows correct colors on PreMatchScreen (avoids race)
      const payload = {
        roomId: data.roomId,
        players: room.players.map((p) => ({
          id: p.id,
          fighter: p.fighter,
          mawashiColor: p.mawashiColor,
          isCPU: p.isCPU,
          wins: p.wins || [],
        })),
      };
      io.in(data.roomId).emit("initial_game_start", payload);
    }
  });

  // Client signals that pre-match screen is done - now start power-up selection
  socket.on("pre_match_complete", (data) => {
    const { roomId } = data;
    const room = rooms.find((r) => r.id === roomId);
    
    if (!room) return;
    
    // Only proceed if this is still the initial round
    if (room.isInitialRound) {
      room.isInitialRound = false; // No longer initial round
      handlePowerUpSelection(room);
    }
  });

  socket.on("request_power_up_selection_state", (data) => {
    const { roomId, playerId } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) {
      return;
    }

    const room = rooms[roomIndex];
    const player = room.players.find((p) => p.id === playerId);

    if (!player) {
      return;
    }

    // If we're in power-up selection phase, send the start event
    if (room.powerUpSelectionPhase && room.playerAvailablePowerUps[playerId]) {
      const availablePowerUps = room.playerAvailablePowerUps[playerId];

      io.to(playerId).emit("power_up_selection_start", {
        availablePowerUps: availablePowerUps,
      });

      // Also send current status
      const selectedCount = Object.keys(room.playersSelectedPowerUps).length;
      io.to(playerId).emit("power_up_selection_status", {
        selectedCount,
        totalPlayers: room.players.length,
        selections: room.playersSelectedPowerUps,
      });
    } else {
    }
  });

  socket.on("power_up_selected", (data) => {
    const { roomId, playerId, powerUpType } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    const player = room.players.find((p) => p.id === playerId);

    if (!player || !room.powerUpSelectionPhase) return;

    // Store the player's power-up selection
    player.selectedPowerUp = powerUpType;
    room.playersSelectedPowerUps[playerId] = powerUpType;

    // IMMEDIATELY emit selection complete to THIS player only and start their transition
    // This allows each player to independently move to the next phase
    // Emit that selection is complete for THIS player only
    io.to(playerId).emit("power_up_selection_complete");
    
    // Start salt throwing for THIS player immediately
    handleSaltThrowAndPowerUp(player, room);

    // Check if both players have now selected
    const selectedCount = Object.keys(room.playersSelectedPowerUps).length;

    if (selectedCount === 2) {
      // Both players have selected, end selection phase and clear timer
      room.powerUpSelectionPhase = false;
      
      // Clear the auto-selection timer since both players have selected
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }

    }

    // Emit updated selection status to all players
    io.in(roomId).emit("power_up_selection_status", {
      selectedCount,
      totalPlayers: room.players.length,
      selections: room.playersSelectedPowerUps,
    });
  });

  socket.on("rematch_count", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);

    if (roomIndex === -1) return; // Room not found

    const room = rooms[roomIndex];

    if (data.acceptedRematch && data.playerId === socket.id) {
      room.rematchCount++;
      io.in(data.roomId).emit("rematch_count", room.rematchCount);

      // If this is a CPU room and human accepted rematch, auto-accept for CPU
      if (room.isCPURoom) {
        room.rematchCount++;
        io.in(data.roomId).emit("rematch_count", room.rematchCount);
      }
    } else if (!data.acceptedRematch && data.playerId === socket.id) {
      room.rematchCount--;
      io.in(data.roomId).emit("rematch_count", room.rematchCount);

      // If this is a CPU room and human declined, also decrement for CPU
      if (room.isCPURoom && room.rematchCount > 0) {
        room.rematchCount--;
        io.in(data.roomId).emit("rematch_count", room.rematchCount);
      }
    }

    if (room.rematchCount > 1) {
      room.matchOver = false;
      room.gameOver = true;
      room.rematchCount = 0;
      
      // Reset player wins for the new match
      room.players.forEach((player) => {
        player.wins = [];
      });
      
      io.in(data.roomId).emit("rematch_count", room.rematchCount);
      io.in(data.roomId).emit("rematch"); // Signal clients to reset win counts
    }
  });

  socket.on("fighter-select", (data) => {
    let roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return; // Room not found

    let playerIndex = rooms[roomIndex].players.findIndex(
      (player) => player.id === socket.id
    );

    if (playerIndex === -1) return; // Player not found

    rooms[roomIndex].players[playerIndex].fighter = data.fighter;
    // console.log(rooms[roomIndex].players[playerIndex]);

    io.in(roomId).emit("lobby", rooms[roomIndex].players); // Update all players in the room
    io.to(roomId).emit("rooms", rooms);
    // console.log(rooms[roomIndex].players);
  });

  socket.on("fighter_action", (data) => {
    let roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return; // Room not found

    let playerIndex = rooms[roomIndex].players.findIndex(
      (player) => player.id === data.id
    );

    if (playerIndex === -1) return; // Player not found

    let player = rooms[roomIndex].players[playerIndex];
    let opponent = rooms[roomIndex].players.find((p) => p.id !== player.id);

    if (
      (rooms[roomIndex].gameOver && !rooms[roomIndex].matchOver) ||
      rooms[roomIndex].matchOver
    ) {
      return; // Skip all other actions if the game is over
    }

    // Block all actions if player is moving to ready position
    if (player.canMoveToReady) {
      return;
    }

    // Block all inputs during salt throwing phase and ready positioning phase
    // This prevents inputs from power-up selection end until game start (hakkiyoi = 1)
    if (!rooms[roomIndex].gameStart || rooms[roomIndex].hakkiyoiCount === 0) {
      // INPUT BUFFERING: Buffer mouse1 state for charged attack
      // This allows players to hold mouse1 before round start and have charging
      // begin immediately when the round starts, without affecting other inputs
      if (data.keys) {
        player.mouse1BufferedBeforeStart = data.keys.mouse1 || false;
      }
      return;
    }

    // Block all inputs during pumo army spawning animation
    if (player.isSpawningPumoArmy) {
      return;
    }

    // Input lockout window: allow key state refresh but block actions
    if (player.inputLockUntil && Date.now() < player.inputLockUntil) {
      if (data.keys) {
        // Clear grabBreakSpaceConsumed if spacebar was released during input lock,
        // so raw parry isn't blocked after the lock expires
        if (!data.keys[" "] && player.keys[" "] && player.grabBreakSpaceConsumed) {
          player.grabBreakSpaceConsumed = false;
        }
        // Track mouse1 press/release timing during lock so charging can begin
        // immediately when the lock expires (inputs are READ, not acted on)
        const prevMouse1 = player.keys.mouse1;
        if (!prevMouse1 && data.keys.mouse1) {
          // mouse1 just pressed during lock — record press time
          player.mouse1PressTime = Date.now();
        } else if (prevMouse1 && !data.keys.mouse1) {
          // mouse1 released during lock — clear press time
          player.mouse1PressTime = 0;
        }
        player.keys = data.keys;
      }
      return;
    }

    // Block ALL inputs while grab movement is active
    if (player.isGrabbingMovement) {
      // Only allow key state updates for grab movement, but block all other actions
      if (data.keys) {
        player.keys = data.keys;
      }
      return;
    }

    // Debug data.keys during grab clashing
    if (player.isGrabClashing) {
    }

    // Count inputs during grab clash - HAPPENS BEFORE BLOCKING
    if (player.isGrabClashing && rooms[roomIndex].grabClashData && data.keys) {
      // Track previous keys for input detection - get from player state
      const previousKeys = { ...player.keys };

      // Update player keys FIRST so next event can detect changes
      player.keys = data.keys;

      // Count any key press (not key holds) as mashing input
      const mashKeys = [
        "w",
        "a",
        "s",
        "d",
        "mouse1",
        "mouse2",
        "e",
        "f",
        "shift",
      ];
      let inputDetected = false;
      let detectedKey = null;

      for (const key of mashKeys) {
        if (data.keys[key] && !previousKeys[key]) {
          inputDetected = true;
          detectedKey = key;
          break;
        }
      }

      if (inputDetected) {
        player.grabClashInputCount++;

        // Update room clash data
        if (player.id === rooms[roomIndex].grabClashData.player1Id) {
          rooms[roomIndex].grabClashData.player1Inputs++;
        } else if (player.id === rooms[roomIndex].grabClashData.player2Id) {
          rooms[roomIndex].grabClashData.player2Inputs++;
        }

        // Emit progress update to all players in the room
        io.in(roomId).emit("grab_clash_progress", {
          player1Inputs: rooms[roomIndex].grabClashData.player1Inputs,
          player2Inputs: rooms[roomIndex].grabClashData.player2Inputs,
          player1Id: rooms[roomIndex].grabClashData.player1Id,
          player2Id: rooms[roomIndex].grabClashData.player2Id,
        });

      }
    }

    // Block all actions (except input counting) during grab clashing
    if (player.isGrabClashing) {
      return;
    }

    // If room is in hitstop, buffer key states but block actions for both players
    if (isRoomInHitstop(rooms[roomIndex])) {
      if (data.keys) {
        player.keys = data.keys;
      }
      return;
    }

    // Helper function to check if player is in a charged attack execution state
    const isInChargedAttackExecution = () => {
      return player.isAttacking && player.attackType === "charged";
    };

    // Helper function to check if an action should be blocked
    // allowDodgeCancelRecovery: allows dodge to cancel recovery state
    // allowChargingDuringDodge: allows starting/continuing charged attack during dodge
    const shouldBlockAction = (allowDodgeCancelRecovery = false, allowChargingDuringDodge = false) => {
      // Global action lock gate to serialize actions visually/feel-wise
      if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
        return true;
      }
      // Always block during charged attack execution
      if (isInChargedAttackExecution()) {
        return true;
      }
      // Block during dodge - unless allowChargingDuringDodge is true (charging can happen during dodge)
      if (player.isDodging && !allowChargingDuringDodge) {
        return true;
      }
      // Block during grab break animation, separation, and new grab action states
      if (player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating ||
          player.isGrabSeparating || player.isBeingPullReversaled ||
          player.isGrabBellyFlopping || player.isBeingGrabBellyFlopped ||
          player.isGrabFrontalForceOut || player.isBeingGrabFrontalForceOut) {
        return true;
      }
      // Block during recovery unless it's a dodge and dodge cancel is allowed
      if (
        player.isRecovering &&
        !(allowDodgeCancelRecovery && data.keys && data.keys.shift)
      ) {
        return true;
      }
      // Block all actions when at the ropes
      if (player.isAtTheRopes) {
        return true;
      }
      return false;
    };

    if (data.keys) {
      // Track mouse1 state changes for slap/charge dual-purpose input
      const previousMouse1State = player.keys.mouse1;
      const previousMouse2State = player.keys.mouse2;
      const previousKeys = { ...player.keys };
      player.keys = data.keys;

      // Set mouse1 press flags
      player.mouse1JustPressed = !previousMouse1State && data.keys.mouse1;
      player.mouse1JustReleased = previousMouse1State && !data.keys.mouse1;
      
      // Set mouse2 press flags (mouse2 = grab now)
      player.mouse2JustPressed = !previousMouse2State && data.keys.mouse2;
      player.mouse2JustReleased = previousMouse2State && !data.keys.mouse2;
      
      // Track attack intent time when mouse1 is pressed (for counter hit detection)
      // This captures the moment the player tries to attack, even before the attack executes
      if (player.mouse1JustPressed) {
        player.attackIntentTime = Date.now();
        // Record press time for slap-vs-charge threshold detection
        player.mouse1PressTime = Date.now();
      }
      
      // Track "just pressed" state for all action keys to prevent actions from triggering
      // when keys are held through other actions (e.g., holding E during dodge then grabbing after)
      player.shiftJustPressed = !previousKeys.shift && data.keys.shift;
      player.eJustPressed = !previousKeys.e && data.keys.e;
      player.wJustPressed = !previousKeys.w && data.keys.w;
      player.fJustPressed = !previousKeys.f && data.keys.f;
      player.spaceJustPressed = !previousKeys[" "] && data.keys[" "];

      // POST-GRAB INPUT BUFFER: After a grab/throw ends, treat held keys as "just pressed"
      // for one cycle. This enables frame-1 activation of grab (mouse2) which has complex
      // initiation code with nested timeouts that must run through the normal input path.
      // Raw parry, slap, dodge, and charge are handled directly in activateBufferedInputAfterGrab().
      if (player.postGrabInputBuffer) {
        if (data.keys.mouse2 && !player.mouse2JustPressed) player.mouse2JustPressed = true;
        player.postGrabInputBuffer = false;
      }

      // Track mouse1 held during recovery from a connected charged attack
      // This catches the case where player re-presses mouse1 AFTER processHit ran
      // (e.g., mouse1 re-press event arrived after the hit was processed)
      if (player.keys.mouse1 && player.isRecovering && player.chargedAttackHit) {
        player.mouse1HeldDuringAttack = true;
        if (!player.mouse1PressTime) {
          player.mouse1PressTime = Date.now();
        }
      }

      // Debug logging for F key and snowball power-up
      if (data.keys.f) {
      }

      // ============================================
      // DIRECTIONAL GRAB BREAK SYSTEM
      // Spacebar grab break removed. Grab breaks now happen through
      // directional counter-inputs during specific grab action windows:
      // - Pull reversal (backward): counter with opposite direction
      // - Throw (W): counter with S key
      // - Forward push: cannot be broken, only slowed
      // Counter-input checks are handled in the grab action sections below.
      // ============================================
    }

    // MOUSE1 RELEASE: Slap (quick tap) or charge release (held past threshold)
    // This MUST be processed before other actions since mouse1 release is the primary attack trigger
    const MOUSE1_CHARGE_THRESHOLD_MS = 200; // Hold mouse1 longer than this to charge instead of slap
    if (player.mouse1JustReleased) {
      if (player.isChargingAttack) {
        // Mouse1 was held past threshold and charging started — release the charged attack
        if (
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isThrowingSnowball
        ) {
          if (player.isDodging) {
            // Store charge for after dodge ends
            player.pendingChargeAttack = {
              power: player.chargeAttackPower,
              startTime: player.chargeStartTime,
              type: "charged",
            };
            player.spacebarReleasedDuringDodge = true;
          } else if (!shouldBlockAction()) {
            executeChargedAttack(player, player.chargeAttackPower, rooms);
          }
        }
        // Clear charging state if mouse1 released and we're not in a valid state to execute
        if (player.isChargingAttack) {
          player.isChargingAttack = false;
          player.chargeStartTime = 0;
          player.chargeAttackPower = 0;
          player.chargingFacingDirection = null;
          player.attackType = null;
          player.mouse1HeldDuringAttack = false;
        }
      } else if (
        player.mouse1PressTime > 0 &&
        (Date.now() - player.mouse1PressTime) < MOUSE1_CHARGE_THRESHOLD_MS &&
        !shouldBlockAction()
      ) {
        // Quick tap — execute slap attack
        if (canPlayerSlap(player)) {
          executeSlapAttack(player, rooms);
        } else if (player.isAttacking && player.attackType === "slap") {
          // Already slapping — buffer the next attack
          const attackElapsed = Date.now() - player.attackStartTime;
          const attackDuration = player.attackEndTime - player.attackStartTime;
          const attackProgress = attackElapsed / attackDuration;
          if (attackProgress >= 0.20 && !player.hasPendingSlapAttack) {
            player.hasPendingSlapAttack = true;
          }
        }
      }
      player.mouse1PressTime = 0; // Reset press time on release
      player.wantsToRestartCharge = false; // Clear charge restart intent on release
      player.mouse1HeldDuringAttack = false; // Clear held-during-attack flag on release
    }

    // Handle clearing charge during charging phase with throw/grab/snowball - MUST BE FIRST
    // Use "just pressed" to prevent charge cancellation when keys are held through other states
    // Block during dodge - only charging should continue during dodge, no other actions
    if (
      ((player.wJustPressed && player.isGrabbing && !player.isBeingGrabbed) ||
        player.mouse2JustPressed ||
        player.fJustPressed) &&
      player.isChargingAttack && // Only interrupt during charging phase, not execution
      !player.isDodging // Block during dodge - charging continues but no actions can interrupt
    ) {
      // Clear charge state
      clearChargeState(player);

      // The existing input handlers will take over for W/E/F
    }

    if (
      false && // Disabled: power-ups are now selected via UI
      player.keys.f &&
      !player.saltCooldown &&
      ((player.fighter === "player 1" && player.x <= 280) ||
        (player.fighter === "player 2" && player.x >= 765)) && // Adjusted range for player 2
      rooms[roomIndex].gameStart === false &&
      !player.activePowerUp
    ) {
      player.isThrowingSalt = true;
      player.saltCooldown = true;

      // Randomly select a power-up
      const powerUpTypes = Object.values(POWER_UP_TYPES);
      const randomPowerUp =
        powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      player.activePowerUp = randomPowerUp;
      player.powerUpMultiplier = POWER_UP_EFFECTS[randomPowerUp];

      // Emit power-up event to clients
      io.in(roomId).emit("power_up_activated", {
        playerId: player.id,
        powerUpType: randomPowerUp,
      });

      setPlayerTimeout(
        player.id,
        () => {
          player.isThrowingSalt = false;
        },
        500,
        "throwingSaltReset"
      );

      setPlayerTimeout(
        player.id,
        () => {
          player.saltCooldown = false;
        },
        750,
        "saltCooldownReset"
      );
    }

    // Handle F key power-ups (snowball and pumo army) - block during charged attack execution and recovery
    // Use fJustPressed to prevent power-ups from triggering when key is held through other actions
    if (
      player.fJustPressed &&
      !shouldBlockAction() &&
      (player.activePowerUp === POWER_UP_TYPES.SNOWBALL ||
        player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) &&
      !player.snowballCooldown &&
      !player.pumoArmyCooldown &&
      !player.isThrowingSnowball &&
      !player.isSpawningPumoArmy &&
      !player.isAttacking &&
      !player.isDodging &&
      !player.isThrowing &&
      !player.isBeingThrown &&
      !player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.isHit &&
      !player.isRawParryStun &&
      !player.isRawParrying &&
      !player.canMoveToReady
    ) {
      // Clear charge attack state if player was charging
      if (player.isChargingAttack) {
        clearChargeState(player);
      }

      if (player.activePowerUp === POWER_UP_TYPES.SNOWBALL) {
        // Set throwing state
        player.isThrowingSnowball = true;
        // Lock actions during throw windup/animation window for visual clarity
        player.currentAction = "snowball";
        player.actionLockUntil = Date.now() + 250;

        // Determine snowball direction based on current position relative to opponent
        const opponent = rooms[roomIndex].players.find(
          (p) => p.id !== player.id
        );
        let snowballDirection;
        if (opponent) {
          // Throw towards the opponent based on current positions
          snowballDirection = player.x < opponent.x ? 2 : -2;
        } else {
          // Fallback to facing direction if no opponent found
          snowballDirection = player.facing === 1 ? -2 : 2;
        }

        // Create snowball projectile
        const snowball = {
          id: Math.random().toString(36).substr(2, 9),
          x: player.x,
          y: player.y + 20, // Slightly above ground
          velocityX: snowballDirection, // Direction determined by position relative to opponent
          hasHit: false,
          ownerId: player.id,
        };

        player.snowballs.push(snowball);
        player.snowballCooldown = true;

        // Reset throwing state after animation
        setPlayerTimeout(
          player.id,
          () => {
            player.isThrowingSnowball = false;
            // Clear lock if it’s still set
            if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
              player.actionLockUntil = 0;
            }

            // Check if we should restart charging after snowball throw completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          },
          500
        );
      } else if (player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) {
        // Set spawning state
        player.isSpawningPumoArmy = true;
        player.currentAction = "pumo_army";
        player.actionLockUntil = Date.now() + 400;

        // Clear any existing movement momentum to prevent sliding during animation
        player.movementVelocity = 0;
        player.isStrafing = false;

        // Determine army direction (same as player facing)
        const armyDirection = player.facing === 1 ? -1 : 1; // Army moves in direction player is facing

        // Spawn multiple mini clones sequentially
        const numClones = 5;
        const spawnDelay = 1000; // 1 second between spawns
        const startX = armyDirection === 1 ? -100 : 1200; // Start from off-screen (outside visible dohyo)

        // Spawn clones one at a time with delays
        for (let i = 0; i < numClones; i++) {
          setPlayerTimeout(
            player.id,
            () => {
              const clone = {
                id: Math.random().toString(36).substr(2, 9),
                x: startX,
                y: GROUND_LEVEL - DOHYO_FALL_DEPTH, // Start at dohyo fall depth (off the dohyo)
                velocityX: armyDirection * 1.5, // Speed of movement
                facing: armyDirection, // Face the direction they're moving (1 = right, -1 = left)
                isStrafing: true, // Use strafing animation
                isSlapAttacking: true, // Keep for combat functionality
                slapCooldown: 0,
                lastSlapTime: 0,
                spawnTime: Date.now(),
                lifespan: 10000, // 10 seconds lifespan (enough time to cross entire screen)
                ownerId: player.id,
                ownerFighter: player.fighter, // Add fighter type for image selection
                hasHit: false,
                size: 0.6, // Smaller than normal players
              };
              player.pumoArmy.push(clone);

            },
            i * spawnDelay
          );
        }

        player.pumoArmyCooldown = true;

        // Reset spawning state after animation
        setPlayerTimeout(
          player.id,
          () => {
            player.isSpawningPumoArmy = false;
            if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
              player.actionLockUntil = 0;
            }

            // Check if we should restart charging after pumo army spawn completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          },
          800
        );
      }
    }

    // Handle dodge - allow canceling recovery but block during charged attack execution
    // Dodging now costs stamina (15% of max) instead of using charges
    // Use shiftJustPressed to prevent dodge from triggering when key is held through other actions
    // NOTE: Dodge cancels charging - clearing charge state when dodge starts
    if (
      player.shiftJustPressed &&
      !player.keys.mouse2 && // Don't dodge while grabbing
      !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
      !player.isBeingGrabbed && // Block dodge when being grabbed
      !isInChargedAttackExecution() && // Block during charged attack execution
      canPlayerDodge(player) &&
      player.stamina >= DODGE_STAMINA_COST // Check if player has enough stamina to dodge
    ) {
      // Allow dodge to cancel recovery
      if (player.isRecovering) {
        // Add grace period - don't allow dodge to cancel recovery for 100ms after it starts
        // This prevents immediate dodge from canceling recovery that was just set
        const recoveryAge = Date.now() - player.recoveryStartTime;
        if (recoveryAge > 100) {
          player.isRecovering = false;
          player.movementVelocity = 0;
          player.recoveryDirection = null;
        } else {
          return; // Don't execute dodge if recovery is too fresh
        }
      }

      // Clear parry success state when starting a dodge
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;

      // Dodge cancels charging - clear charge state
      clearChargeState(player, true);

      // Clear movement momentum for static dodge distance
      // Also cancels power slide - dodge is an escape option from slide
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;

      player.isDodging = true;
      player.isDodgeCancelling = false;
      player.dodgeCancelStartTime = 0;
      player.dodgeCancelStartY = 0;
      player.dodgeStartTime = Date.now();
      player.dodgeEndTime = Date.now() + DODGE_DURATION; // Snappy dodge duration
      player.dodgeStartX = player.x;
      player.dodgeStartY = player.y;
      player.currentAction = "dodge";
      player.actionLockUntil = Date.now() + 100; // Slightly shorter lock for responsiveness
      player.justLandedFromDodge = false; // Reset landing flag

      // Drain stamina for dodge (15% of max stamina)
      player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);

      if (player.keys.a) {
        player.dodgeDirection = -1;
      } else if (player.keys.d) {
        player.dodgeDirection = 1;
      } else {
        player.dodgeDirection = player.facing === -1 ? 1 : -1;
      }

      setPlayerTimeout(
        player.id,
        () => {
          // Only clear dodge state if not already handled by tick loop
          // The tick loop handles landing momentum, this is just a safety cleanup
          if (player.isDodging && !player.isDodgeCancelling) {
            // Tick loop should have handled this - apply landing momentum if it didn't
            const landingDir = player.dodgeDirection || 0;
            if (landingDir !== 0 && Math.abs(player.movementVelocity) < 0.1) {
              // Tick didn't set momentum yet - do it here
              if (player.keys.c || player.keys.control) {
                // Holding C/CTRL = power slide from dodge
                player.movementVelocity = landingDir * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
                player.isPowerSliding = true;
              } else {
                player.movementVelocity = landingDir * DODGE_SLIDE_MOMENTUM;
              }
              player.justLandedFromDodge = true;
              player.dodgeLandTime = Date.now();
            }
            player.isDodging = false;
            player.isDodgeCancelling = false;
            player.dodgeDirection = null;
            
            // Immediately update facing direction on dodge landing (timeout fallback)
            const dodgeRoom = rooms.find(r => r.players.some(p => p.id === player.id));
            if (dodgeRoom) {
              const dodgeOpponent = dodgeRoom.players.find(p => p.id !== player.id);
              if (dodgeOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
                player.facing = player.x < dodgeOpponent.x ? -1 : 1;
              }
            }
          }
          if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
            player.actionLockUntil = 0;
          }

          // Check for buffered actions after dodge ends
          if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
            const action = player.bufferedAction;
            player.bufferedAction = null;
            player.bufferExpiryTime = 0;

            // Execute the buffered action
            // CRITICAL: Block buffered dodge if player is being grabbed
            if (action.type === "dodge" && player.stamina >= DODGE_STAMINA_COST && !player.isBeingGrabbed) {
              // Clear parry success state when starting a dodge
              player.isRawParrySuccess = false;
              player.isPerfectRawParrySuccess = false;
              
              // Dodge cancels charging
              clearChargeState(player, true);
              
              // Clear movement momentum for static dodge distance
              // Also cancels power slide - dodge is an escape option from slide
              player.movementVelocity = 0;
              player.isStrafing = false;
              player.isPowerSliding = false;
              player.isBraking = false;
              
              player.isDodging = true;
              player.isDodgeCancelling = false;
              player.dodgeCancelStartTime = 0;
              player.dodgeCancelStartY = 0;
              player.dodgeStartTime = Date.now();
              player.dodgeEndTime = Date.now() + DODGE_DURATION;
              player.dodgeDirection = action.direction;
              player.dodgeStartX = player.x;
              player.dodgeStartY = player.y;
              player.justLandedFromDodge = false;
              
              // Drain stamina for buffered dodge
              player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
            }
          }

          // Handle pending charge attack
          if (player.pendingChargeAttack && player.spacebarReleasedDuringDodge) {
            const chargePercentage = player.pendingChargeAttack.power;

            // Determine if it's a slap or charged attack
            if (player.keys.mouse1) {
              // Use the simplified slap attack system

              executeSlapAttack(player, rooms);
            } else {
              executeChargedAttack(player, chargePercentage, rooms);
            }

            // Reset charging state
            player.isChargingAttack = false;
            player.pendingChargeAttack = null;
            player.spacebarReleasedDuringDodge = false;
          }
          // Start charging immediately after dodge ends if mouse1 is held past threshold
          // This ensures no delay between dodge ending and charge starting
          // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
          else if (
            player.keys.mouse1 &&
            player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200 &&
            !player.isChargingAttack &&
            !player.isAttacking &&
            !player.isHit &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isThrowing &&
            !player.isBeingThrown &&
            !player.isGrabBreaking &&
            !player.isGrabBreakCountered &&
            !player.isRecovering &&
            !player.canMoveToReady
          ) {
            startCharging(player);
          }
        },
        DODGE_DURATION,
        "dodgeReset"
      );
    } else if (
      (player.shiftJustPressed || player.keys.shift) && // Buffer on press OR hold (catches spammers who end on held key)
      (player.isAttacking ||
        player.isThrowing ||
        player.isBeingThrown ||
        player.isGrabbing ||
        player.isBeingGrabbed) && // Allow buffering while being grabbed/thrown so spamming shift comes out frame 1 when freed
      !player.isDodging &&
      !player.isThrowingSnowball &&
      !player.isRawParrying &&
      !isInChargedAttackExecution() &&
      player.stamina >= DODGE_STAMINA_COST
    ) {
      // Buffer the dodge action
      const dodgeDirection = player.keys.a
        ? -1
        : player.keys.d
        ? 1
        : player.facing === -1
        ? 1
        : -1;
      player.bufferedAction = {
        type: "dodge",
        direction: dodgeDirection,
      };
      player.bufferExpiryTime = Date.now() + 500; // Buffer expires after 500ms
    }
    // Emit "No Stamina" feedback when player tries to dodge but doesn't have enough stamina
    else if (
      player.shiftJustPressed && // Use just pressed to match dodge behavior
      !player.keys.mouse2 && // Don't dodge while grabbing
      !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
      canPlayerDodge(player) && // Use canPlayerDodge for consistency with dodge handler
      player.stamina < DODGE_STAMINA_COST && // Not enough stamina
      (!player.lastStaminaBlockedTime || Date.now() - player.lastStaminaBlockedTime > 500) // Rate limit to prevent spam
    ) {
      player.lastStaminaBlockedTime = Date.now();
      socket.emit("stamina_blocked", { playerId: player.id, action: "dodge" });
    }

    // MOUSE1 HOLD-TO-CHARGE: Start charging when mouse1 held past threshold
    // Block if grab (mouse2) was just pressed (grab cancels charge)
    if (
      player.keys.mouse1 &&
      !player.isChargingAttack &&
      player.mouse1PressTime > 0 &&
      (Date.now() - player.mouse1PressTime) >= MOUSE1_CHARGE_THRESHOLD_MS &&
      !shouldBlockAction() &&
      canPlayerCharge(player) &&
      !player.mouse2JustPressed
    ) {
      startCharging(player);
      player.spacebarReleasedDuringDodge = false;
    }
    // For continuing a charge OR starting a charge during dodge
    // Use shouldBlockAction(false, true) to allow charging during dodge
    else if (
      player.keys.mouse1 &&
      player.mouse1PressTime > 0 &&
      (Date.now() - player.mouse1PressTime) >= MOUSE1_CHARGE_THRESHOLD_MS &&
      !shouldBlockAction(false, true) && // Allow charging during dodge
      (player.isChargingAttack || player.isDodging) &&
      !player.isHit &&
      !player.isRawParryStun &&
      !player.isRawParrying &&
      !player.mouse2JustPressed
    ) {
      // If we're dodging and not already charging, start charging
      if (player.isDodging && !player.isChargingAttack) {
        startCharging(player);
      }
      // Calculate charge power (0-100%)
      const chargeDuration = Date.now() - player.chargeStartTime;
      player.chargeAttackPower = Math.min((chargeDuration / 750) * 100, 100);

      // Lock facing direction while charging
      if (player.isThrowing || player.throwingFacingDirection !== null) {
        player.chargingFacingDirection = player.throwingFacingDirection;
      } else {
        player.chargingFacingDirection = player.facing;
      }

      if (player.chargingFacingDirection !== null) {
        player.facing = player.chargingFacingDirection;
      }
    }
    // Handle mouse1 held during active charged attack - wants to restart charge after
    if (
      player.keys.mouse1 &&
      player.isAttacking &&
      player.attackType === "charged"
    ) {
      player.wantsToRestartCharge = true;
      // Also track held-during-attack for reliable resume after recovery from connected hits
      player.mouse1HeldDuringAttack = true;
    }

    // Also check if mouse1 is being held when we're about to execute a charged attack
    if (
      player.keys.mouse1 &&
      player.pendingChargeAttack &&
      !player.isAttacking
    ) {
      player.wantsToRestartCharge = true;
    }

    // Clear charging state if mouse1 is released and charge wasn't executed
    // (charge release/slap is handled above in the mouse1JustReleased block)
    if (!player.keys.mouse1 && player.isChargingAttack) {
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;
      player.chargingFacingDirection = null;
      player.attackType = null;
      player.mouse1HeldDuringAttack = false;
    }

    // NOTE: Continuous mouse1 charge check is also handled in the game loop
    // for when player holds mouse1 without sending new fighter_action events

    function isOpponentCloseEnoughForGrab(player, opponent) {
      // Calculate grab range based on player size
      const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
      return Math.abs(player.x - opponent.x) < grabRange;
    }

    // Handle throw attacks - only during grab decision window (first 1s of grab)
    // Uses GRAB_ACTION_WINDOW (1s) and S-key counter by opponent
    if (
      player.keys.w &&
      player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.keys.mouse2 && // Don't throw while grab button held
      !shouldBlockAction() &&
      !player.isThrowingSalt &&
      !player.canMoveToReady &&
      !player.throwCooldown &&
      !player.isRawParrying &&
      !player.isJumping &&
      !player.isAttemptingGrabThrow &&  // Don't allow multiple throw attempts
      !player.isAttemptingPull           // Don't allow throw during pull
    ) {
      // Reset any lingering throw states before starting a new throw
      player.throwingFacingDirection = null;
      player.throwStartTime = 0;
      player.throwEndTime = 0;
      player.throwOpponent = null;

      player.lastThrowAttemptTime = Date.now();
      
      // Set attempting grab throw state - this triggers the animation
      player.isAttemptingGrabThrow = true;
      player.grabThrowAttemptStartTime = Date.now();
      player.grabActionType = "throw";
      player.grabActionStartTime = Date.now();
      player.grabDecisionMade = true; // Lock in the decision
      
      // Pause grab duration during throw attempt (action extends grab)
      player.grabDurationPaused = true;
      player.grabDurationPausedAt = Date.now();

      // Clear push states if transitioning from push (throw interrupts push)
      player.isGrabPushing = false;
      player.isGrabWalking = false;
      const throwOpponent = rooms[roomIndex].players.find((p) => p.id !== player.id);
      if (throwOpponent) {
        throwOpponent.isBeingGrabPushed = false;
        throwOpponent.lastGrabPushStaminaDrainTime = 0;
        // Reset opponent's counter state — they get a fresh read for each grab action
        throwOpponent.grabCounterAttempted = false;
        throwOpponent.grabCounterInput = null;
      }

      // Block all player inputs during the attempt
      player.actionLockUntil = Date.now() + GRAB_ACTION_WINDOW;

      setPlayerTimeout(
        player.id,
        () => {
          const opponent = rooms[roomIndex].players.find(
            (p) => p.id !== player.id
          );
          
          // Clear attempting state after the window
          player.isAttemptingGrabThrow = false;
          player.grabDurationPaused = false;
          player.grabActionType = null;
          player.grabActionStartTime = 0;
          player.grabDecisionMade = false;
          player.grabPushEndTime = 0;

          // CRITICAL: Check if grab break has already occurred
          if (player.isGrabBreakCountered || opponent.isGrabBreaking || opponent.isGrabBreakSeparating) {
            return;
          }

          // Also check if we're no longer in a valid grab state
          if (!player.isGrabbing && !player.isThrowing) {
            return;
          }

          // S-key counter check is done in the tick loop (throw attempt branch above).
          // If we reach here, opponent did NOT counter - execute the throw.
          if (
            isOpponentCloseEnoughForThrow(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isDodging
          ) {
            if (checkForGrabPriority(player, opponent)) {
              return;
            } else if (checkForThrowTech(player, opponent)) {
              applyThrowTech(player, opponent);
            } else if (!player.throwTechCooldown) {
              clearChargeState(player, true);

              player.movementVelocity = 0;
              player.isStrafing = false;

              const shouldFaceRight = player.x < opponent.x;
              player.facing = shouldFaceRight ? -1 : 1;
              player.throwingFacingDirection = player.facing;

              player.isThrowing = true;
              player.throwStartTime = Date.now();
              player.throwEndTime = Date.now() + 400;
              player.throwOpponent = opponent.id;
              player.currentAction = "throw";
              player.actionLockUntil = Date.now() + 200;
              
              clearAllActionStates(opponent);
              opponent.isBeingGrabbed = false;
              opponent.isBeingGrabPushed = false;
              opponent.isBeingThrown = true;
              
              triggerHitstop(rooms[roomIndex], HITSTOP_THROW_MS);

              if (player.isGrabbing) {
                player.isGrabbing = false;
                player.grabbedOpponent = null;
              }

              player.throwCooldown = true;
              setPlayerTimeout(
                player.id,
                () => {
                  player.throwCooldown = false;
                  if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
                    player.actionLockUntil = 0;
                  }
                },
                250
              );
            }
          } else {
            if (checkForGrabPriority(player, opponent)) {
              return;
            }

            clearChargeState(player, true);

            const shouldFaceRight = player.x < opponent.x;
            player.facing = shouldFaceRight ? -1 : 1;
            player.throwingFacingDirection = player.facing;

            player.isThrowing = true;
            player.throwStartTime = Date.now();
            player.throwEndTime = Date.now() + 400;
            player.currentAction = "throw";
            player.actionLockUntil = Date.now() + 200;

            player.throwCooldown = true;
            setPlayerTimeout(
              player.id,
              () => {
                player.throwCooldown = false;
                if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
                  player.actionLockUntil = 0;
                }
              },
              250
            );
          }
        },
        GRAB_ACTION_WINDOW  // 1 second window (was 500ms)
      );
    }

    // === PULL REVERSAL - Backward input during grab ===
    // NOTE: Primary pull initiation is in the push processing block (burst-decay push).
    // This input handler serves as a safety fallback for edge cases.
    if (
      player.isGrabbing &&
      player.grabbedOpponent &&
      !player.isBeingGrabbed &&
      !player.isAttemptingGrabThrow &&
      !player.isAttemptingPull &&
      !player.isGrabPushing &&          // Only fires if push somehow isn't active
      !shouldBlockAction()
    ) {
      // Determine backward key based on facing
      const backwardKey = player.facing === -1 ? 'a' : 'd';
      const forwardKey = player.facing === -1 ? 'd' : 'a';
      const isPressingBackward = player.keys[backwardKey] && !player.keys[forwardKey];

      // No grace period for backward — holding backward before grab is intentional (pull)
      if (isPressingBackward) {
        player.isAttemptingPull = true;
        player.grabActionStartTime = Date.now();
        player.grabActionType = "pull";
        player.grabDecisionMade = true; // Lock in the decision

        // Pause grab duration during pull attempt (action extends grab)
        player.grabDurationPaused = true;
        player.grabDurationPausedAt = Date.now();

        // Clear push states
        player.isGrabPushing = false;
        const pullOpponent = rooms[roomIndex].players.find((p) => p.id !== player.id);
        if (pullOpponent) {
          pullOpponent.isBeingGrabPushed = false;
          pullOpponent.lastGrabPushStaminaDrainTime = 0;
        }

        // Block grabber inputs during pull attempt
        player.actionLockUntil = Date.now() + GRAB_ACTION_WINDOW;

        setPlayerTimeout(
          player.id,
          () => {
            const opponent = rooms[roomIndex].players.find(
              (p) => p.id !== player.id
            );

            // Clear pull attempt state
            player.isAttemptingPull = false;
            player.grabDurationPaused = false;
            player.grabActionType = null;
            player.grabActionStartTime = 0;
            player.grabDecisionMade = false;
            player.grabPushEndTime = 0;

            // Check if grab break already happened
            if (player.isGrabBreakCountered || !opponent || opponent.isGrabBreaking || opponent.isGrabBreakSeparating) {
              return;
            }

            // Check if still in valid grab state
            if (!player.isGrabbing) {
              return;
            }

            // Counter check is done in the tick loop (pull attempt branch).
            // If we reach here, opponent did NOT counter - execute pull reversal!
            
            // Calculate pull reversal destination (other side of grabber)
            // Pull direction is opposite of current opponent position relative to grabber
            const pullDirection = opponent.x < player.x ? 1 : -1; // send to other side
            // Don't clamp targetX — let it overshoot so the tween handler detects boundary
            const targetX = player.x + pullDirection * PULL_REVERSAL_DISTANCE;

            // Release the grab (pull reversal ends the grab)
            cleanupGrabStates(player, opponent);

            // Set pull reversal state for animation
            opponent.isBeingPullReversaled = true;
            opponent.pullReversalPullerId = player.id; // Track who pulled us

            // Move opponent to target position via tween (longer duration for visible knockback)
            opponent.isGrabBreakSeparating = true;
            opponent.grabBreakSepStartTime = Date.now();
            opponent.grabBreakSepDuration = PULL_REVERSAL_TWEEN_DURATION;
            opponent.grabBreakStartX = opponent.x;
            opponent.grabBreakTargetX = targetX;

            // Zero out velocities
            opponent.movementVelocity = 0;
            player.movementVelocity = 0;
            opponent.isStrafing = false;
            player.isStrafing = false;

            // Lock both players equally (cleared early when tween ends or boundary hit)
            const pulledLockUntil = Date.now() + PULL_REVERSAL_PULLED_LOCK;
            opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, pulledLockUntil);
            const pullerLockUntil = Date.now() + PULL_REVERSAL_PULLER_LOCK;
            player.inputLockUntil = Math.max(player.inputLockUntil || 0, pullerLockUntil);

            // Correct facing after sides switch
            correctFacingAfterGrabOrThrow(player, opponent);

            // Note: isBeingPullReversaled is auto-cleared when the tween ends (in tick handler)

            // Grab cooldown
            player.grabCooldown = true;
            setPlayerTimeout(
              player.id,
              () => { player.grabCooldown = false; },
              300,
              "pullReversalCooldown"
            );

            // Emit for client VFX/SFX
            io.in(rooms[roomIndex].id).emit("pull_reversal", {
              grabberId: player.id,
              opponentId: opponent.id,
              grabberX: player.x,
              opponentTargetX: targetX,
            });
          },
          GRAB_ACTION_WINDOW  // 1 second window
        );
      }
    }

    // Handle grab attacks — instant grab with no forward movement
    // Use mouse2JustPressed to prevent grab from triggering when key is held through other actions
    if (
      player.mouse2JustPressed &&
      !shouldBlockAction() &&
      canPlayerUseAction(player) &&
      !player.grabCooldown &&
      !player.isPushing &&
      !player.isBeingPushed &&
      !player.grabbedOpponent &&
      !player.isRawParrying &&
      !player.isJumping &&
      !player.isGrabbingMovement &&
      !player.isWhiffingGrab &&
      !player.isGrabWhiffRecovery &&
      !player.isGrabTeching &&
      !player.isGrabStartup
    ) {
      player.lastGrabAttemptTime = Date.now();

      // Clear parry success state when starting a grab
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;

      // Clear charging attack state when starting grab
      clearChargeState(player, true); // true = cancelled by grab

      // Reset hit absorption for thick blubber power-up when starting grab (like charged attack)
      if (player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER) {
        player.hitAbsorptionUsed = false;
      }

      // Begin near-instant startup (70ms telegraph, no hop, no forward movement)
      // After startup, tick loop does instant range check → connect / whiff / tech
      player.isGrabStartup = true;
      player.grabStartupStartTime = Date.now();
      player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
      player.currentAction = "grab_startup";
      player.actionLockUntil = Date.now() + GRAB_STARTUP_DURATION_MS;
      player.grabState = GRAB_STATES.ATTEMPTING;
      player.grabAttemptType = "grab";

      // Capture approach speed BEFORE clearing momentum (for momentum-transferred push)
      player.grabApproachSpeed = Math.abs(player.movementVelocity);

      // Clear any existing movement momentum
      player.movementVelocity = 0;
      player.isStrafing = false;
      // Cancel power slide when grabbing
      player.isPowerSliding = false;

      // No movement timeout needed — startup tick block handles connect/whiff/tech instantly
    }
  });

  // TEST EVENT - Force opponent disconnection (for debugging)
  socket.on("test_force_disconnect", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      rooms[roomIndex].opponentDisconnected = true;
      rooms[roomIndex].disconnectedDuringGame = true;

      // Emit to all players in room
      io.in(roomId).emit("opponent_disconnected", {
        roomId: roomId,
        message: "Opponent disconnected (TEST)",
      });

      // Emit updated rooms
      io.emit("rooms", getCleanedRoomsData(rooms));
    }
  });

  socket.on("exit_disconnected_game", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1 && rooms[roomIndex].opponentDisconnected) {
      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
      }

      // PERFORMANCE: Unregister from lookup maps before removal
      unregisterPlayerFromMaps(socket.id);
      
      // Remove the player from the room
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      // Reset the room to its initial state since this was the last player
      rooms[roomIndex].opponentDisconnected = false;
      rooms[roomIndex].disconnectedDuringGame = false;
      rooms[roomIndex].gameStart = false;
      rooms[roomIndex].gameOver = false;
      rooms[roomIndex].matchOver = false;
      rooms[roomIndex].hakkiyoiCount = 0;
      rooms[roomIndex].readyCount = 0;
      rooms[roomIndex].rematchCount = 0;
      rooms[roomIndex].readyStartTime = null;
      rooms[roomIndex].powerUpSelectionPhase = false;
      delete rooms[roomIndex].winnerId;
      delete rooms[roomIndex].loserId;
      delete rooms[roomIndex].gameOverTime;
      delete rooms[roomIndex].playersSelectedPowerUps;
      delete rooms[roomIndex].playerAvailablePowerUps;

      // Clean up the room state
      cleanupRoomState(rooms[roomIndex]);
      // PERFORMANCE: Free cloned player state objects to prevent memory leak
      rooms[roomIndex].previousPlayerStates = [null, null];

      // Emit updated room data to all clients
      io.emit("rooms", getCleanedRoomsData(rooms));

      // Confirm exit to the player
      socket.emit("exit_game_confirmed", { roomId: roomId });

      // Leave the socket room
      socket.leave(roomId);
    }
  });

  socket.on("leave_room", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      const room = rooms[roomIndex];

      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }

      // Handle CPU room cleanup - REMOVE the room entirely when human leaves
      if (room.isCPURoom) {
        // Clear CPU player timeouts and AI state using the stored unique ID
        const cpuPlayerId = room.cpuPlayerId || "CPU_PLAYER";
        timeoutManager.clearPlayer(cpuPlayerId);
        clearAIState(cpuPlayerId);

        // Leave the socket room
        socket.leave(roomId);
        delete socket.roomId;

        // Remove the CPU room from the rooms array entirely
        rooms.splice(roomIndex, 1);

        // Emit updated room list
        io.emit("rooms", getCleanedRoomsData(rooms));
        return;
      }

      // Check if we're leaving during an active game session (not just lobby)
      // Active game session includes: power-up selection, salt throwing, ready positioning, actual gameplay, and winner declaration
      const isInGameSession =
        rooms[roomIndex].powerUpSelectionPhase ||
        rooms[roomIndex].gameStart ||
        rooms[roomIndex].gameOver ||
        rooms[roomIndex].hakkiyoiCount > 0 ||
        rooms[roomIndex].players.some(
          (p) =>
            p.isThrowingSalt ||
            (p.canMoveToReady === false &&
              (rooms[roomIndex].gameStart ||
                rooms[roomIndex].powerUpSelectionPhase))
        );

      const hadTwoPlayers = rooms[roomIndex].players.length === 2;

      // PERFORMANCE: Unregister from lookup maps before removal
      unregisterPlayerFromMaps(socket.id);
      
      // Remove the player from the room
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );
      // PERFORMANCE: Free cloned player state objects to prevent memory leak
      rooms[roomIndex].previousPlayerStates = [null, null];

      // Handle opponent disconnection during active game session
      if (
        isInGameSession &&
        hadTwoPlayers &&
        rooms[roomIndex].players.length === 1
      ) {
        rooms[roomIndex].opponentDisconnected = true;
        rooms[roomIndex].disconnectedDuringGame = true;

        // Emit opponent disconnected event to the remaining player
        const remainingPlayer = rooms[roomIndex].players[0];
        io.to(remainingPlayer.id).emit("opponent_disconnected", {
          roomId: roomId,
          message: "Opponent disconnected",
        });

        // Emit rooms data after a small delay to ensure client processes the disconnection event first
        setTimeout(() => {
          io.emit("rooms", getCleanedRoomsData(rooms));
        }, 100);
      }
      // If the remaining player from a disconnected game is leaving, reset the room
      else if (
        rooms[roomIndex].opponentDisconnected &&
        rooms[roomIndex].players.length === 0
      ) {
        rooms[roomIndex].opponentDisconnected = false;
        rooms[roomIndex].disconnectedDuringGame = false;
        rooms[roomIndex].gameStart = false;
        rooms[roomIndex].gameOver = false;
        rooms[roomIndex].matchOver = false;
        rooms[roomIndex].hakkiyoiCount = 0;
        rooms[roomIndex].readyCount = 0;
        rooms[roomIndex].rematchCount = 0;
        rooms[roomIndex].readyStartTime = null;
        rooms[roomIndex].powerUpSelectionPhase = false;
        delete rooms[roomIndex].winnerId;
        delete rooms[roomIndex].loserId;
        delete rooms[roomIndex].gameOverTime;
        delete rooms[roomIndex].playersSelectedPowerUps;
        delete rooms[roomIndex].playerAvailablePowerUps;

        // Clear any remaining round start timer
        if (rooms[roomIndex].roundStartTimer) {
          clearTimeout(rooms[roomIndex].roundStartTimer);
          rooms[roomIndex].roundStartTimer = null;
        }

        // Clean up the room state
        cleanupRoomState(rooms[roomIndex]);
      }
      // Normal lobby leave - reset ready states
      else {
        // Reset ready count and player ready states
        rooms[roomIndex].readyCount = 0;
        rooms[roomIndex].players.forEach((player) => {
          player.isReady = false;
        });

        // Clean up the room state (includes power-up selection state)
        cleanupRoomState(rooms[roomIndex]);
      }

      // If there's only one player left and not in disconnected state, reset their state completely
      if (
        rooms[roomIndex].players.length === 1 &&
        !rooms[roomIndex].opponentDisconnected
      ) {
        const p = rooms[roomIndex].players[0];
        // Reset to player 1 position and appearance
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 245;
        p.facing = 1;
        // Clean up any player-specific state
        cleanupPlayerStates(p);
      }

      // Emit updates to all clients (only if not in disconnected state)
      if (!rooms[roomIndex].opponentDisconnected) {
        io.in(roomId).emit("player_left");
        io.in(roomId).emit("ready_count", rooms[roomIndex].readyCount);
        io.to(roomId).emit("lobby", rooms[roomIndex].players);
      }

      // Only emit rooms data immediately if not in disconnected state (delayed emit handles disconnected case)
      if (!rooms[roomIndex].opponentDisconnected) {
        io.emit("rooms", getCleanedRoomsData(rooms));
      }

      // Leave the socket room
      socket.leave(roomId);
    }
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    // Clean up timeouts for the disconnecting player
    timeoutManager.clearPlayer(socket.id);

    if (rooms[roomIndex]) {
      const room = rooms[roomIndex];

      // Clear any active round start timer to prevent interference
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }

      // Handle CPU room cleanup - REMOVE the room entirely when human disconnects
      if (room.isCPURoom) {
        // Clear CPU player timeouts and AI state using the stored unique ID
        const cpuPlayerId = room.cpuPlayerId || "CPU_PLAYER";
        timeoutManager.clearPlayer(cpuPlayerId);
        clearAIState(cpuPlayerId);

        // Remove the CPU room from the rooms array entirely
        rooms.splice(roomIndex, 1);

        // Emit updated room list
        io.emit("rooms", getCleanedRoomsData(rooms));
        return;
      }

      // Check if we're disconnecting during an active game session (not just lobby)
      // Active game session includes: power-up selection, salt throwing, ready positioning, actual gameplay, and winner declaration
      const isInGameSession =
        rooms[roomIndex].powerUpSelectionPhase ||
        rooms[roomIndex].gameStart ||
        rooms[roomIndex].gameOver ||
        rooms[roomIndex].hakkiyoiCount > 0 ||
        rooms[roomIndex].players.some(
          (p) =>
            p.isThrowingSalt ||
            (p.canMoveToReady === false &&
              (rooms[roomIndex].gameStart ||
                rooms[roomIndex].powerUpSelectionPhase))
        );

      const hadTwoPlayers = rooms[roomIndex].players.length === 2;

      // Clean up player references
      const playerIndex = rooms[roomIndex].players.findIndex(
        (p) => p.id === socket.id
      );
      if (playerIndex !== -1) {
        const player = rooms[roomIndex].players[playerIndex];

        // Clean up all player references
        cleanupPlayerStates(player);

        // Clean up opponent references
        const opponent = rooms[roomIndex].players.find(
          (p) => p.id !== player.id
        );
        cleanupOpponentStates(opponent);
      }

      // PERFORMANCE: Unregister from lookup maps before removal
      unregisterPlayerFromMaps(socket.id);
      
      // Remove the player
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );
      // PERFORMANCE: Free cloned player state objects to prevent memory leak
      rooms[roomIndex].previousPlayerStates = [null, null];

      // Handle opponent disconnection during active game session
      if (
        isInGameSession &&
        hadTwoPlayers &&
        rooms[roomIndex].players.length === 1
      ) {
        rooms[roomIndex].opponentDisconnected = true;
        rooms[roomIndex].disconnectedDuringGame = true;

        // Emit opponent disconnected event to the remaining player
        const remainingPlayer = rooms[roomIndex].players[0];
        io.to(remainingPlayer.id).emit("opponent_disconnected", {
          roomId: roomId,
          message: "Opponent disconnected",
        });

        // Emit rooms data after a small delay to ensure client processes the disconnection event first
        setTimeout(() => {
          io.emit("rooms", getCleanedRoomsData(rooms));
        }, 100);
      }
      // If the remaining player from a disconnected game is leaving, reset the room
      else if (
        rooms[roomIndex].opponentDisconnected &&
        rooms[roomIndex].players.length === 0
      ) {
        rooms[roomIndex].opponentDisconnected = false;
        rooms[roomIndex].disconnectedDuringGame = false;
        rooms[roomIndex].gameStart = false;
        rooms[roomIndex].gameOver = false;
        rooms[roomIndex].matchOver = false;
        rooms[roomIndex].hakkiyoiCount = 0;
        rooms[roomIndex].readyCount = 0;
        rooms[roomIndex].rematchCount = 0;
        rooms[roomIndex].readyStartTime = null;
        rooms[roomIndex].powerUpSelectionPhase = false;
        delete rooms[roomIndex].winnerId;
        delete rooms[roomIndex].loserId;
        delete rooms[roomIndex].gameOverTime;
        delete rooms[roomIndex].playersSelectedPowerUps;
        delete rooms[roomIndex].playerAvailablePowerUps;

        // Clean up the room state
        cleanupRoomState(rooms[roomIndex]);
      }
      // Normal disconnect - clean up room state
      else {
        // Clean up the room state (includes power-up selection state)
        cleanupRoomState(rooms[roomIndex]);
      }

      // If there's only one player left and not in disconnected state, reset their state completely
      if (
        rooms[roomIndex].players.length === 1 &&
        !rooms[roomIndex].opponentDisconnected
      ) {
        const p = rooms[roomIndex].players[0];
        // Reset to player 1 position and appearance
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 245;
        p.facing = 1;
        // Clean up any player-specific state
        cleanupPlayerStates(p);
        // Reset ready count
        rooms[roomIndex].readyCount = 0;
        p.isReady = false;
      }

      // Emit updates with cleaned data (only if not in disconnected state)
      if (!rooms[roomIndex].opponentDisconnected) {
        const cleanedRoom = getCleanedRoomData(rooms[roomIndex]);
        io.in(roomId).emit("player_left");
        io.in(roomId).emit("ready_count", rooms[roomIndex].readyCount);
        io.to(roomId).emit("lobby", cleanedRoom.players);
      }

      // Only emit rooms data immediately if not in disconnected state (delayed emit handles disconnected case)
      if (!rooms[roomIndex].opponentDisconnected) {
        io.emit("rooms", getCleanedRoomsData(rooms));
      }
    }
  });
});

// Update server listen
server.listen(PORT, () => {
});

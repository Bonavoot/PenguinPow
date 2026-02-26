const GRAB_STATES = {
  INITIAL: "initial",
  ATTEMPTING: "attempting",
  SUCCESS: "success",
  COUNTERED: "countered",
  PUSHING: "pushing",
  ATTEMPTING_PULL: "attempting_pull",
  ATTEMPTING_THROW: "attempting_throw",
};

// Performance: game logic runs at TICK_RATE; broadcasts every N ticks to reduce network + client work
const TICK_RATE = 64;
const BROADCAST_EVERY_N_TICKS = 2; // 2 = 32 Hz broadcast (client interpolation smooths to 60fps)

// ============================================
// PERFORMANCE: Delta State Updates
// Only send properties that changed since last tick
// ============================================
const ALWAYS_SEND_PROPS = ['x', 'y', 'facing', 'stamina', 'id', 'fighter', 'color', 'mawashiColor', 'bodyColor'];

const DELTA_TRACKED_PROPS = [
  'isAttacking', 'isSlapAttack', 'slapAnimation', 'attackType',
  'isChargingAttack', 'chargeAttackPower', 'chargeStartTime',
  'isGrabbing', 'isBeingGrabbed', 'grabbedOpponent', 'grabState', 'grabAttemptType',
  'isGrabbingMovement', 'isWhiffingGrab', 'isGrabWhiffRecovery', 'isGrabTeching', 'grabTechRole', 'isGrabClashing', 'isGrabStartup',
  'isHit', 'isDead', 'isRecovering', 'isDodging', 'dodgeDirection', 'justLandedFromDodge',
  'isRawParrying', 'isRawParryStun', 'isRawParrySuccess', 'isPerfectRawParrySuccess',
  'isThrowing', 'isBeingThrown', 'isThrowTeching', 'isBeingPulled', 'isBeingPushed',
  'isThrowingSalt', 'isReady', 'isBowing', 'isAtTheRopes',
  'isThrowingSnowball', 'isSpawningPumoArmy',
  'isCrouchStance', 'isCrouchStrafing', 'isGrabBreaking', 'isGrabBreakCountered',
  'isAttemptingGrabThrow', 'isInRitualPhase',
  'isGrabPushing', 'isBeingGrabPushed', 'isEdgePushing', 'isBeingEdgePushed',
  'isAttemptingPull', 'isBeingPullReversaled',
  'isGrabSeparating', 'isGrabBellyFlopping', 'isBeingGrabBellyFlopped',
  'isGrabFrontalForceOut', 'isBeingGrabFrontalForceOut',
  'knockbackVelocity', 'activePowerUp', 'powerUpMultiplier',
  'snowballs', 'pumoArmy', 'snowballCooldown', 'pumoArmyCooldown',
  'isPowerSliding', 'isBraking', 'movementVelocity', 'isStrafing',
  'isJumping', 'isDiving', 'sizeMultiplier', 'isGassed'
];

// Pre-compute the combined props list once (avoids spread on every call)
const ALL_TRACKED_PROPS = [...ALWAYS_SEND_PROPS, ...DELTA_TRACKED_PROPS];

// ============================================
// PERFORMANCE: Screen Shake Throttling
// ============================================
const SCREEN_SHAKE_MIN_INTERVAL = 100; // Minimum ms between screen shakes

// ============================================
// Core Physics
// ============================================
const speedFactor = 0.185; // Scaled for camera zoom (was 0.25)
const GROUND_LEVEL = 290;
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

// ============================================
// Power-ups
// ============================================
const POWER_UP_TYPES = {
  SPEED: "speed",
  POWER: "power",
  SNOWBALL: "snowball",
  PUMO_ARMY: "pumo_army",
  THICK_BLUBBER: "thick_blubber",
};

const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.4, // 40% speed increase (only affects movement, not knockback)
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase (ONLY power-up that affects knockback)
  [POWER_UP_TYPES.SNOWBALL]: 1.0, // No stat multiplier, just projectile ability
  [POWER_UP_TYPES.PUMO_ARMY]: 1.0, // No stat multiplier, just spawns army
  [POWER_UP_TYPES.THICK_BLUBBER]: 1.0, // No stat multiplier, just hit absorption
};

const GRAB_DURATION = 1500; // 1.5 seconds total grab duration
const GRAB_ATTEMPT_DURATION = 1000; // 1 second for attempt animation

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

// ============================================
// Dodge Physics - smooth graceful arc with weight
// ============================================
const DODGE_DURATION = 450; // Longer for bigger, more dramatic arc
const DODGE_BASE_SPEED = 2.2; // Base horizontal speed during dodge
const DODGE_HOP_HEIGHT = 70; // Scaled for camera zoom (was 95)
const DODGE_LANDING_MOMENTUM = 0.35; // Momentum burst on landing
const DODGE_CANCEL_DURATION = 100; // Smooth but quick slam-down
const DODGE_CANCEL_SPEED_MULT = 0.2; // Some horizontal movement during cancel
const DODGE_CROSSED_THROUGH_GRACE = 300; // ms grace period after dodge landing while overlapping

// ============================================
// Grab Mechanics
// ============================================

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

// Grab break constants
const GRAB_BREAK_STAMINA_COST = 10; // Equal stamina cost for both players on a successful grab break
const GRAB_BREAK_PUSH_VELOCITY = 1.2; // Push velocity for grab breaks
const GRAB_BREAK_FORCED_DISTANCE = 55; // Even separation distance for both players
const GRAB_BREAK_TWEEN_DURATION = 350; // Knockback slide duration
const GRAB_BREAK_RESIDUAL_VEL = 0; // No residual sliding — players stop cleanly when knockback ends
const GRAB_BREAK_INPUT_LOCK_MS = 350; // Locked during knockback tween only
const GRAB_BREAK_ACTION_LOCK_MS = 350; // Locked during knockback tween only

// Grab stamina drain: 10 stamina over full 1.5s duration
// Drain 1 stamina every 150ms (1500ms / 10 = 150ms per stamina point)
const GRAB_STAMINA_DRAIN_INTERVAL = 150;

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
const GRAB_PUSH_STAMINA_DRAIN_INTERVAL = 70; // Drain 1 stamina per 70ms mid-ring (~14/sec)
const GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL = 17; // Drain 1 stamina per 17ms at edge (~59/sec)
const GRAB_PUSH_SEPARATION_OPPONENT_VEL = 1.2; // Velocity given to opponent when push ends
const GRAB_PUSH_SEPARATION_GRABBER_VEL = 0.4;  // Velocity given to grabber when push ends
const GRAB_PUSH_SEPARATION_INPUT_LOCK = 180;    // Input lock after push separation — matches isGrabSeparating duration (ms)
const PULL_REVERSAL_DISTANCE = 311; // Scaled for camera zoom (was 420)
const PULL_REVERSAL_TWEEN_DURATION = 650; // ms for the pull knockback tween (fast but visible travel)
const PULL_REVERSAL_PULLED_LOCK = 700; // ms input lock for pulled player (exceeds tween, cleared early when tween ends)
const PULL_REVERSAL_PULLER_LOCK = 700; // ms input lock for puller (same as pulled — 0 frame advantage)
const PULL_BOUNDARY_MARGIN = 11; // Scaled for camera zoom (was 15)

// ============================================
// Ring-out cutscene
// ============================================
const RINGOUT_THROW_DURATION_MS = 400; // Match normal throw timing for consistent physics

// ============================================
// Parry System
// ============================================
const RAW_PARRY_KNOCKBACK = 0.49; // Knockback velocity for charged attack parries
const RAW_PARRY_STUN_DURATION = 1000; // 1 second stun duration
const RAW_PARRY_SLAP_KNOCKBACK = 0.5; // Lighter knockback for slap parries
const PERFECT_PARRY_KNOCKBACK = 0.65; // Slightly stronger than regular parry
const RAW_PARRY_SLAP_STUN_DURATION = 500; // Reduced stun duration for slap attack parries
const PERFECT_PARRY_WINDOW = 100; // 100ms window for perfect parries
const PERFECT_PARRY_SUCCESS_DURATION = 2000; // 2 seconds - parrier holds success pose
const PERFECT_PARRY_ATTACKER_STUN_DURATION = 1100; // 1.1 second stun duration for perfect parry
const PERFECT_PARRY_ANIMATION_LOCK = 600; // 600ms - parrier is locked in parry pose after perfect parry
const PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK = 300; // 300ms - reduced lock for snowball perfect parries (no player stun to capitalize on)

// Raw parry commitment: minimum time locked in parry stance
const RAW_PARRY_MIN_DURATION = 375; // Whiffed parry: full commitment (punishable by grab)

// Parry visual timing
const PARRY_SUCCESS_DURATION = 500; // How long the parry success pose is held

// Raw parry stamina: flat cost on press, refunded on any successful parry
const RAW_PARRY_STAMINA_COST = 5; // Flat cost when parry is initiated
const RAW_PARRY_STAMINA_REFUND = 5; // Full refund on successful parry (regular or perfect)

// ============================================
// At the Ropes
// ============================================
const AT_THE_ROPES_DURATION = 1000; // 1 second stun duration

// ============================================
// Charge Clash (charged vs charged simultaneous collision)
// ============================================
const CHARGE_CLASH_RECOVERY_DURATION = 450; // Recovery duration after clash (slightly longer than normal charged recovery)
const CHARGE_CLASH_BASE_KNOCKBACK = 2.8; // Base knockback for the lower-charge player
const CHARGE_CLASH_MIN_KNOCKBACK = 1.4; // Minimum knockback even for the higher-charge player
const CHARGE_CLASH_ADVANTAGE_SCALE = 0.5; // How much charge difference affects knockback asymmetry

// ============================================
// Slap vs Charged Attack Priority
// ============================================
const CHARGE_PRIORITY_THRESHOLD = 30; // Charge % above which charged attack beats slap
const CHARGE_VS_SLAP_ATTACKER_PENALTY = 1.5; // Extra knockback multiplier on charged attacker when beating a slap

// ============================================
// Knockback Immunity
// ============================================
const KNOCKBACK_IMMUNITY_DURATION = 150; // 150ms immunity window

// ============================================
// Stamina System
// ============================================
const STAMINA_REGEN_INTERVAL_MS = 2500; // regen interval
const STAMINA_REGEN_AMOUNT = 8; // per tick

// Stamina costs
const SLAP_ATTACK_STAMINA_COST = 3; // Small cost to not deter spamming
const CHARGED_ATTACK_STAMINA_COST = 9; // 3x slap attack cost
const DODGE_STAMINA_COST = 7; // ~7% of max stamina per dodge

// Stamina drain on victim when hit (victim pays MORE than attacker spent)
const SLAP_HIT_VICTIM_STAMINA_DRAIN = 6; // Victim loses 6 (attacker paid 3)
const CHARGED_HIT_VICTIM_STAMINA_DRAIN = 18; // Victim loses 18 (attacker paid 9)

// Gassed state: regen freeze when stamina hits 0
const GASSED_DURATION_MS = 3000; // 3 second regen freeze penalty
const GASSED_RECOVERY_STAMINA = 30; // Stamina granted immediately when gassed ends

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

// ============================================
// Cinematic Kill — guaranteed ring-out finishing blow
// ============================================
const CINEMATIC_KILL_MIN_MULTIPLIER = 1.0;
const CINEMATIC_KILL_HITSTOP_MS = 550;
const CINEMATIC_KILL_KNOCKBACK_BOOST = 3.0;
const CINEMATIC_KB_FRICTION = 0.985;
const CINEMATIC_KB_DI_FRICTION = 0.96;
const CINEMATIC_KB_MOVEMENT_TRANSFER = 0.8;
const CINEMATIC_KB_MOVEMENT_FRICTION = 0.996;

// ============================================
// Global Attack Timing
// ============================================
const ATTACK_ENDLAG_SLAP_MS = 30;       // Minimal recovery for ultra-spammable slaps
const ATTACK_ENDLAG_CHARGED_MS = 280;   // Longer recovery for charged attacks
const ATTACK_COOLDOWN_MS = 50;          // Minimal cooldown for fast gameplay
const BUFFERED_ATTACK_GAP_MS = 80;      // Fast chaining

module.exports = {
  GRAB_STATES,
  TICK_RATE,
  BROADCAST_EVERY_N_TICKS,

  // Delta state tracking
  ALWAYS_SEND_PROPS,
  DELTA_TRACKED_PROPS,
  ALL_TRACKED_PROPS,

  // Screen shake
  SCREEN_SHAKE_MIN_INTERVAL,

  // Core physics
  speedFactor,
  GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE,
  SLAP_HITBOX_DISTANCE_VALUE,
  SLAP_PARRY_WINDOW,
  SLAP_PARRY_KNOCKBACK_VELOCITY,
  THROW_RANGE,
  GRAB_RANGE,
  GRAB_PUSH_SPEED,
  GRAB_PUSH_DURATION,
  DOHYO_FALL_SPEED,
  DOHYO_FALL_DEPTH,
  DOHYO_FALL_HORIZONTAL_RETENTION,

  // Power-ups
  POWER_UP_TYPES,
  POWER_UP_EFFECTS,

  // Grab timing
  GRAB_DURATION,
  GRAB_ATTEMPT_DURATION,

  // Ice physics
  ICE_ACCELERATION,
  ICE_MAX_SPEED,
  ICE_INITIAL_BURST,
  ICE_COAST_FRICTION,
  ICE_MOVING_FRICTION,
  ICE_BRAKE_FRICTION,
  ICE_STOP_THRESHOLD,
  ICE_TURN_BURST,
  SLIDE_SPEED_BOOST,
  SLIDE_MAX_SPEED,
  SLIDE_FRICTION,
  SLIDE_MIN_VELOCITY,
  SLIDE_MAINTAIN_VELOCITY,
  SLIDE_BRAKE_FRICTION,
  SLIDE_STRAFE_TIME_REQUIRED,
  DODGE_SLIDE_MOMENTUM,
  DODGE_POWERSLIDE_BOOST,
  DOHYO_EDGE_PANIC_ZONE,
  ICE_EDGE_BRAKE_BONUS,
  ICE_EDGE_SLIDE_PENALTY,

  // Legacy movement aliases
  MOVEMENT_ACCELERATION,
  MOVEMENT_DECELERATION,
  MAX_MOVEMENT_SPEED,
  MOVEMENT_MOMENTUM,
  MOVEMENT_FRICTION,
  ICE_DRIFT_FACTOR,
  MIN_MOVEMENT_THRESHOLD,
  INITIAL_MOVEMENT_BURST,

  // Dodge physics
  DODGE_DURATION,
  DODGE_BASE_SPEED,
  DODGE_HOP_HEIGHT,
  DODGE_LANDING_MOMENTUM,
  DODGE_CANCEL_DURATION,
  DODGE_CANCEL_SPEED_MULT,
  DODGE_CROSSED_THROUGH_GRACE,

  // Grab mechanics
  GRAB_WALK_SPEED_MULTIPLIER,
  GRAB_WALK_ACCEL_MULTIPLIER,
  GRAB_STARTUP_DURATION_MS,
  GRAB_STARTUP_HOP_HEIGHT,
  SLAP_ATTACK_STARTUP_MS,
  GRAB_WHIFF_RECOVERY_MS,
  GRAB_WHIFF_STUMBLE_VEL,
  GRAB_TECH_FREEZE_MS,
  GRAB_TECH_FORCED_DISTANCE,
  GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER,
  GRAB_TECH_TWEEN_DURATION,
  GRAB_TECH_RESIDUAL_VEL,
  GRAB_TECH_INPUT_LOCK_MS,
  GRAB_TECH_ANIM_DURATION_MS,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_PUSH_VELOCITY,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION,
  GRAB_BREAK_RESIDUAL_VEL,
  GRAB_BREAK_INPUT_LOCK_MS,
  GRAB_BREAK_ACTION_LOCK_MS,
  GRAB_STAMINA_DRAIN_INTERVAL,

  // Grab action system
  GRAB_ACTION_WINDOW,
  GRAB_PUSH_BURST_BASE,
  GRAB_PUSH_MOMENTUM_TRANSFER,
  GRAB_PUSH_DECAY_RATE,
  GRAB_PUSH_MIN_VELOCITY,
  GRAB_PUSH_MAX_DURATION,
  GRAB_PUSH_BACKWARD_GRACE,
  GRAB_PUSH_STAMINA_DRAIN_INTERVAL,
  GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL,
  GRAB_PUSH_SEPARATION_OPPONENT_VEL,
  GRAB_PUSH_SEPARATION_GRABBER_VEL,
  GRAB_PUSH_SEPARATION_INPUT_LOCK,
  PULL_REVERSAL_DISTANCE,
  PULL_REVERSAL_TWEEN_DURATION,
  PULL_REVERSAL_PULLED_LOCK,
  PULL_REVERSAL_PULLER_LOCK,
  PULL_BOUNDARY_MARGIN,

  // Ring-out
  RINGOUT_THROW_DURATION_MS,

  // Parry system
  RAW_PARRY_KNOCKBACK,
  RAW_PARRY_STUN_DURATION,
  RAW_PARRY_SLAP_KNOCKBACK,
  PERFECT_PARRY_KNOCKBACK,
  RAW_PARRY_SLAP_STUN_DURATION,
  PERFECT_PARRY_WINDOW,
  PERFECT_PARRY_SUCCESS_DURATION,
  PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PERFECT_PARRY_ANIMATION_LOCK,
  PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK,
  RAW_PARRY_MIN_DURATION,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_STAMINA_COST,
  RAW_PARRY_STAMINA_REFUND,

  // At the ropes
  AT_THE_ROPES_DURATION,

  // Charge clash
  CHARGE_CLASH_RECOVERY_DURATION,
  CHARGE_CLASH_BASE_KNOCKBACK,
  CHARGE_CLASH_MIN_KNOCKBACK,
  CHARGE_CLASH_ADVANTAGE_SCALE,

  // Slap vs charged priority
  CHARGE_PRIORITY_THRESHOLD,
  CHARGE_VS_SLAP_ATTACKER_PENALTY,

  // Knockback immunity
  KNOCKBACK_IMMUNITY_DURATION,

  // Stamina system
  STAMINA_REGEN_INTERVAL_MS,
  STAMINA_REGEN_AMOUNT,
  SLAP_ATTACK_STAMINA_COST,
  CHARGED_ATTACK_STAMINA_COST,
  DODGE_STAMINA_COST,
  SLAP_HIT_VICTIM_STAMINA_DRAIN,
  CHARGED_HIT_VICTIM_STAMINA_DRAIN,
  GASSED_DURATION_MS,
  GASSED_RECOVERY_STAMINA,

  // Hitstop
  HITSTOP_SLAP_MS,
  HITSTOP_CHARGED_MIN_MS,
  HITSTOP_CHARGED_MAX_MS,
  HITSTOP_PARRY_MS,
  HITSTOP_GRAB_MS,
  HITSTOP_THROW_MS,

  // Attack timing
  ATTACK_ENDLAG_SLAP_MS,
  ATTACK_ENDLAG_CHARGED_MS,
  ATTACK_COOLDOWN_MS,
  BUFFERED_ATTACK_GAP_MS,

  // Cinematic kill
  CINEMATIC_KILL_MIN_MULTIPLIER,
  CINEMATIC_KILL_HITSTOP_MS,
  CINEMATIC_KILL_KNOCKBACK_BOOST,
  CINEMATIC_KB_FRICTION,
  CINEMATIC_KB_DI_FRICTION,
  CINEMATIC_KB_MOVEMENT_TRANSFER,
  CINEMATIC_KB_MOVEMENT_FRICTION,
};

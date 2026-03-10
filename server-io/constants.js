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
  'isHit', 'isDead', 'isRecovering', 'isDodging', 'isDodgeStartup', 'isDodgeRecovery', 'dodgeDirection', 'justLandedFromDodge',
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
  'snowballs', 'pumoArmy', 'snowballCooldown', 'pumoArmyCooldown', 'snowballThrowsRemaining',
  'isPowerSliding', 'isBraking', 'movementVelocity', 'isStrafing',
  'isRopeJumping', 'ropeJumpPhase', 'sizeMultiplier', 'isGassed',
  'isSidestepping', 'isSidestepStartup', 'isSidestepRecovery'
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
const GROUND_LEVEL = 300;
const HITBOX_DISTANCE_VALUE = Math.round(71 * 0.96); // ~68 — PUSHBOX size (body collision, keeps players separated) [8% tighter]
const CHARGED_HITBOX_DISTANCE_VALUE = Math.round(147 * 0.96); // ~141 → just past pushbox 136 — hit fires at body contact; lunge provides range [8% tighter]
const SLAP_HITBOX_DISTANCE_VALUE = Math.round(152 * 0.96); // ~146 — must exceed pushbox (136px) so slaps connect at pushbox distance [8% tighter]
const SLAP_PARRY_WINDOW = 200; // Updated to 200ms window for parry to account for longer slap animation
const SLAP_PARRY_KNOCKBACK_VELOCITY = 1.5; // Reduced knockback for parried attacks
const SLAP_PARRY_RECOVERY_MS = 150; // Fixed recovery for both players after slap parry — guarantees +0
const THROW_RANGE = Math.round(166 * 0.96); // ~159 (scaled for camera zoom)
const GRAB_RANGE = Math.round(158 * 0.96); // ~152px - command grab range (scaled for camera zoom) [8% tighter]
const GRAB_PUSH_SPEED = 0.55; // Push movement speed (buffed from 0.3 — yorikiri should grind to the edge)
const GRAB_PUSH_DURATION = 650;

// ============================================
// FRAME DATA SYSTEM — Formal startup/active/recovery for every move
// Real fighting game structure: Startup → Active → Recovery
// Startup: committed but can't hit. Active: hitbox live. Recovery: punishable.
// ============================================
const SLAP_STARTUP_MS = 55;       // Wind-up before hitbox — snappy initiation
const SLAP_ACTIVE_MS = 100;       // Hitbox live window
const SLAP_RECOVERY_MS = 130;     // Can't act, no hitbox — opponent's response window
const SLAP_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;

// Slap String System — 3-hit rekka string: bam bam..BAM
// Hits 1&2 are IDENTICAL — same startup/active/recovery/stun. Combo through speed.
// Hit 3 startup alone creates the frame trap gap. No hitstun inflation needed.
const SLAP_STRING_BUFFER_WINDOW_MS = 300;  // How long after hit 1 cycle end the player can manually input hit 2
const SLAP_STRING_HIT2_MANUAL_WINDOW_MS = 100;  // Short window after hit 2 for delayed hit 3 — also prevents 1-2 loop from comboing

// String hits 1 & 2 — identical frame data, recovery slashed for fast chain
const SLAP_STRING_HIT1_RECOVERY_MS = 40;   // Was 130ms — massive reduction for snappy chaining
const SLAP_STRING_HIT1_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_STRING_HIT1_RECOVERY_MS; // 195ms

// String hit 2 — identical to hit 1
const SLAP_STRING_HIT2_STARTUP_MS = SLAP_STARTUP_MS;     // 55ms — same as hit 1
const SLAP_STRING_HIT2_ACTIVE_MS = SLAP_ACTIVE_MS;       // 100ms — same as hit 1
const SLAP_STRING_HIT2_RECOVERY_MS = SLAP_STRING_HIT1_RECOVERY_MS; // 40ms — same as hit 1
const SLAP_STRING_HIT2_TOTAL_MS = SLAP_STRING_HIT1_TOTAL_MS; // 195ms — same as hit 1

// String hit 3 — heavy finisher whose startup IS the frame trap gap
const SLAP_HIT3_STARTUP_MS = 165;          // Tuned so escape window ≈ 45ms (dash/parry escape, slap loses)
const SLAP_HIT3_ACTIVE_MS = 100;           // Full active window for the big hit
const SLAP_HIT3_RECOVERY_MS = 200;         // Very punishable — committed string ender
const SLAP_HIT3_TOTAL_MS = SLAP_HIT3_STARTUP_MS + SLAP_HIT3_ACTIVE_MS + SLAP_HIT3_RECOVERY_MS; // 465ms

// Cinematic String System — deterministic combo that looks identical every time.
// Hits 1&2: both players snap to fixed spacing + shared drift (no KB multiplier, no ice physics).
// Hit 3: "release" back to real physics with heavy knockback.
const SLAP_STRING_COMBO_SPACING = 140;            // Fixed px between players (~pushbox distance so they don't overlap)
const SLAP_STRING_COMBO_DRIFT_HIT1 = 1.3;         // Drift velocity after hit 1 — moderate push
const SLAP_STRING_COMBO_DRIFT_HIT2 = 1.3;         // Drift velocity after hit 2 — same as hit 1
const SLAP_STRING_COMBO_DRIFT_FRICTION = 0.95;    // Drift decay per tick (independent of game physics)
const SLAP_STRING_HIT3_KB_MULTIPLIER = 0.80;      // Hit 3 finisher — release to real physics
const SLAP_NEUTRAL_KB_MULTIPLIER = 0.42;            // Solo slap — tuned so 3-4 slaps reach boundary from neutral (was 0.475)
const SLAP_STRING_HIT3_SLIDE_VELOCITY = 2.2;      // Hit 3 forward slide — strong lunge to close gap even on delayed strings

// String stun — hits 1 & 2 both use 260ms (identical).
// Frame trap math (slap2→slap3): advantage = t_hit(55) + stun(260) - cycle(195) = 120ms.
// Escape window = S3(165) - 120 = 45ms. Opponent's slap (55ms startup) > 45ms → slap3 wins.
// Dash (40ms startup) fits in 45ms window → escapable with good timing.
const SLAP_STRING_HIT2_STUN_MS = 260;

const CHARGED_STARTUP_MS = 150;   // Clear windup (unchanged)
const CHARGED_ACTIVE_MS = 120;    // Hitbox live window

const GRAB_STARTUP_MS = 180;      // Readable telegraph (was 150)
const GRAB_ACTIVE_MS = 100;       // Grab connect window

const DODGE_STARTUP_MS = 40;      // Brief crouch/wind-up before movement (was 50)
const DODGE_ACTIVE_MS = 200;      // Actual dash movement (was 220)
const DODGE_RECOVERY_MS = 90;     // Sliding to a stop, punishable (was 120)
const DODGE_TOTAL_MS = DODGE_STARTUP_MS + DODGE_ACTIVE_MS + DODGE_RECOVERY_MS; // 330ms
const DODGE_COOLDOWN_MS = 100;    // Forced idle gap after recovery before next dash (prevents chain-dash blur)

// ============================================
// Sidestep — Henka-style lateral evasion around the dohyo
// Fixed-speed arc toward opponent's far side with dynamic tracking.
// Side switch succeeds only if the arc carries you past the opponent.
// Opponent can defeat it by dashing away (outpaces the arc).
// Immune to strikes during active phase. Grabs track through all phases.
// ============================================
const SIDESTEP_STARTUP_MS = 80;       // Vulnerable wind-up (the "read" commitment)
const SIDESTEP_ACTIVE_MIN_MS = 200;   // Floor — very short sidesteps stay readable
const SIDESTEP_ACTIVE_MAX_MS = 500;   // Ceiling — very long sidesteps don't drag
const SIDESTEP_RECOVERY_MS = 150;     // Smooth slide to final position, vulnerable
const SIDESTEP_TOTAL_MS = SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MAX_MS + SIDESTEP_RECOVERY_MS; // Max possible (730ms)
const SIDESTEP_STAMINA_COST = 8;      // Expensive — bigger reward than dodge (4) or parry (5)
const SIDESTEP_ARC_DEPTH_MIN = 35;    // Y dip at max travel distance (long sidesteps — already looks good)
const SIDESTEP_ARC_DEPTH_MAX = 55;    // Y dip at close range (short sidesteps — dramatic arc into ring space)
const SIDESTEP_GRAB_TRACK_RANGE = 400; // Generous grab range when target is sidestepping
const SIDESTEP_INITIATION_RANGE = 280; // Max distance to attempt sidestep (generous — arc physics decide success)
const SIDESTEP_ARC_SPEED = 0.70;      // Fixed px/ms during active phase (~700 px/s, deliberate arc just above dash speed)
const SIDESTEP_MAX_TRAVEL = 500;      // Safety cap — must cover distance to opponent + visual separation (~173px)

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
// Dash Physics - grounded dash with dash slap
// ============================================
const DODGE_DURATION = DODGE_STARTUP_MS + DODGE_ACTIVE_MS; // 240ms total before recovery phase
const DODGE_BASE_SPEED = 3.2; // Grounded dash speed (was 2.0 — buffed to cover ~118px, escapes grab range)
const DODGE_CANCEL_ACTION_LOCK = 80; // Brief lock after S-cancel to prevent instant pivoting

// ============================================
// Grab Mechanics
// ============================================

// Grab walking tuning
const GRAB_WALK_SPEED_MULTIPLIER = 0.8; // Slightly slower than normal strafing
const GRAB_WALK_ACCEL_MULTIPLIER = 0.7; // Slightly lower acceleration than normal strafing

// Grab startup tuning — lunge forward during startup for better grab range
const GRAB_STARTUP_DURATION_MS = GRAB_STARTUP_MS; // Uses frame data constant (180ms)
const GRAB_STARTUP_HOP_HEIGHT = 0; // No hop — grab is a grounded technique
const GRAB_LUNGE_DISTANCE = 75; // Pixels of forward movement during grab startup (buffed from 55 — grabs more threatening)
const SLAP_ATTACK_STARTUP_MS = SLAP_STARTUP_MS; // Uses frame data constant (70ms)

// Grab whiff recovery — big vulnerable window if grab misses
const GRAB_WHIFF_RECOVERY_MS = 450; // Whiff recovery duration (fully vulnerable to punishment)
const GRAB_WHIFF_STUMBLE_VEL = 0.4; // Slight forward stumble velocity during whiff

// Grab tech — both players grab simultaneously, freeze then push apart
const GRAB_TECH_FREEZE_MS = 350; // Freeze duration before separation (shake/jiggle phase)
const GRAB_TECH_FORCED_DISTANCE = 40; // Scaled for camera zoom [8% tighter]
const GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER = 1.4; // Larger gap during pull attempt (vs 1.0 for normal grab)
const GRAB_TECH_TWEEN_DURATION = 120; // Duration of forced separation tween (ms)
const GRAB_TECH_RESIDUAL_VEL = 1.2; // Residual velocity fed into ice sliding after forced separation
const GRAB_TECH_INPUT_LOCK_MS = 600; // Total input lock (freeze + separation slide)
const GRAB_TECH_ANIM_DURATION_MS = 700; // Total tech animation duration (freeze + recovery)

// Grab break constants
const GRAB_BREAK_STAMINA_COST = 10; // Equal stamina cost for both players on a successful grab break
const GRAB_BREAK_PUSH_VELOCITY = 1.2; // Push velocity for grab breaks
const GRAB_BREAK_FORCED_DISTANCE = 51; // Even separation distance for both players [8% tighter]
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
const GRAB_ACTION_WINDOW = 350; // 0.35s reaction window for pull/throw counter attempts
const GRAB_PUSH_BURST_BASE = 2.5;          // Base burst speed when push starts
const GRAB_PUSH_MOMENTUM_TRANSFER = 0.6;   // Multiplier on approach speed added to burst (power slide grab = devastating)
const GRAB_PUSH_DECAY_RATE = 1.6;          // Exponential decay rate (was 2.2 — slower decay for sustained yorikiri push)
const GRAB_PUSH_MIN_VELOCITY = 0.15;       // Push ends when speed decays below this
const GRAB_PUSH_MAX_DURATION = 1500;        // Safety cap: push can never exceed this (ms)
const GRAB_PUSH_BACKWARD_GRACE = 150;       // ms before backward input triggers pull during push (prevents accidental pull)
const GRAB_PUSH_STAMINA_DRAIN_INTERVAL = 70; // Drain 1 stamina per 70ms mid-ring (~14/sec)
const GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL = 35; // Drain 1 stamina per 35ms at edge (~29/sec)
const GRAB_PUSH_RESIST_SPEED_MULT = 0.45;  // Push speed multiplied by this when opponent resists (55% reduction)
const GRAB_PUSH_RESIST_STAMINA_DRAIN_INTERVAL = 125; // Extra drain on resisting opponent: 1 per 125ms (~8/sec additional, ~22/sec total with grab drain)
const GRAB_PUSH_SEPARATION_OPPONENT_VEL = 1.2; // Velocity given to opponent when push ends
const GRAB_PUSH_SEPARATION_GRABBER_VEL = 0.4;  // Velocity given to grabber when push ends
const GRAB_PUSH_SEPARATION_INPUT_LOCK = 180;    // Input lock after push separation — matches isGrabSeparating duration (ms)
const PULL_REVERSAL_DISTANCE = 311; // Scaled for camera zoom (was 420)
const PULL_REVERSAL_TWEEN_DURATION = 650; // ms for the pull knockback tween (fast but visible travel)
const PULL_REVERSAL_PULLED_LOCK = 700; // ms input lock for pulled player (exceeds tween, cleared early when tween ends)
const PULL_REVERSAL_PULLER_LOCK = 700; // ms input lock for puller (same as pulled — 0 frame advantage)
const PULL_BOUNDARY_MARGIN = 11; // Scaled for camera zoom (was 15)

// ============================================
// Input Buffering
// ============================================
const INPUT_BUFFER_WINDOW_MS = 200; // Buffer window: inputs within this window before lockout ends fire on frame 1

// ============================================
// Ring-out cutscene
// ============================================
const RINGOUT_THROW_DURATION_MS = 400; // Match normal throw timing for consistent physics

// ============================================
// Parry System
// ============================================
const RAW_PARRY_KNOCKBACK = 0.49; // Knockback velocity for charged attack parries
const RAW_PARRY_STUN_DURATION = 700; // Stun duration (was 1000 — guarantees slap/grab but not charged)
const RAW_PARRY_SLAP_KNOCKBACK = 0.5; // Lighter knockback for slap parries
const PERFECT_PARRY_KNOCKBACK = 0.65; // Slightly stronger than regular parry
const RAW_PARRY_SLAP_STUN_DURATION = 400; // Stun for slap parries (was 500)
const PERFECT_PARRY_WINDOW = 100; // 100ms window for perfect parries
const PERFECT_PARRY_SUCCESS_DURATION = 850; // Compressed parry — fast enough to keep pace, long enough for visual read
const PERFECT_PARRY_ATTACKER_STUN_DURATION = 700; // Stun — comfortable window for slap/grab follow-up
const PERFECT_PARRY_ANIMATION_LOCK = 150; // 150ms — brief flash moment, then parrier can act (was 250 — too slow to follow up on stunned opponent)
const PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK = 200; // Shorter than player parry lock — the reflected snowball is the reward

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
const AT_THE_ROPES_DURATION = 800; // 0.8 second stun duration (was 1000 — still guarantees punish, less helpless)

// ============================================
// Rope Jump - Escape from boundary pressure
// Arc over the opponent when cornered near the edge
// ============================================
const ROPE_JUMP_STARTUP_MS = 166;        // Punishable telegraph before jump
const ROPE_JUMP_ACTIVE_MS = 450;         // Duration of the parabolic arc
const ROPE_JUMP_LANDING_RECOVERY_MS = 183; // Landing endlag (punishable)
const ROPE_JUMP_STAMINA_COST = 4;        // Same as dodge
const ROPE_JUMP_ARC_HEIGHT = 120;        // Peak Y offset above GROUND_LEVEL
const ROPE_JUMP_SAFE_HEIGHT = 80;        // Y offset above which player can't be hit
const ROPE_JUMP_BOUNDARY_ZONE = 40;      // Tight to the rope — must be near the boundary to jump

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

// Charged attack timing
const CHARGE_FULL_POWER_MS = 1000; // Time to reach 100% charge (1 second)

// Stamina costs — every action is a real decision
const SLAP_ATTACK_STAMINA_COST = 5; // Meaningful cost (was 3 — ~20 slaps before exhaustion)
const CHARGED_ATTACK_STAMINA_COST = 12; // Heavy commitment (was 9)
const DODGE_STAMINA_COST = 4; // Deliberate escape (was 2 — ~25 dodges before exhaustion)

// Stamina drain on victim when hit (victim pays MORE than attacker spent)
const SLAP_HIT_VICTIM_STAMINA_DRAIN = 8; // Victim loses 8 (was 6)
const CHARGED_HIT_VICTIM_STAMINA_DRAIN = 22; // Victim loses 22 (was 18)

// Gassed state: regen freeze when stamina hits 0
const GASSED_DURATION_MS = 3000; // 3 second regen freeze penalty
const GASSED_RECOVERY_STAMINA = 30; // Stamina granted immediately when gassed ends

// ============================================
// HITSTOP TUNING - Smash Bros style
// Every hit has hitstop to make impacts feel satisfying
// Scales with power - stronger hits freeze longer
// ============================================
const SLAP_CHAIN_HIT_GAP_MS = 40;  // Minimum visual gap after slap hitstun before victim can be hit again
const HITSTOP_SLAP_MS = 90;       // Punchy freeze for each slap impact — meaty and satisfying
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
const ATTACK_ENDLAG_SLAP_MS = SLAP_RECOVERY_MS; // Uses frame data (150ms — creates response window)
const ATTACK_ENDLAG_CHARGED_MS = 300;   // Recovery for charged attacks (was 280)
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
  CHARGED_HITBOX_DISTANCE_VALUE,
  SLAP_HITBOX_DISTANCE_VALUE,
  SLAP_PARRY_WINDOW,
  SLAP_PARRY_KNOCKBACK_VELOCITY,
  SLAP_PARRY_RECOVERY_MS,
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

  // Frame data
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  SLAP_TOTAL_MS,
  SLAP_STRING_BUFFER_WINDOW_MS,
  SLAP_STRING_HIT2_MANUAL_WINDOW_MS,
  SLAP_STRING_HIT1_RECOVERY_MS,
  SLAP_STRING_HIT1_TOTAL_MS,
  SLAP_STRING_HIT2_STARTUP_MS,
  SLAP_STRING_HIT2_ACTIVE_MS,
  SLAP_STRING_HIT2_RECOVERY_MS,
  SLAP_STRING_HIT2_TOTAL_MS,
  SLAP_HIT3_STARTUP_MS,
  SLAP_HIT3_ACTIVE_MS,
  SLAP_HIT3_RECOVERY_MS,
  SLAP_HIT3_TOTAL_MS,
  SLAP_STRING_COMBO_SPACING,
  SLAP_STRING_COMBO_DRIFT_HIT1,
  SLAP_STRING_COMBO_DRIFT_HIT2,
  SLAP_STRING_COMBO_DRIFT_FRICTION,
  SLAP_STRING_HIT3_KB_MULTIPLIER,
  SLAP_NEUTRAL_KB_MULTIPLIER,
  SLAP_STRING_HIT3_SLIDE_VELOCITY,
  SLAP_STRING_HIT2_STUN_MS,
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MS,
  GRAB_STARTUP_MS,
  GRAB_ACTIVE_MS,
  DODGE_STARTUP_MS,
  DODGE_ACTIVE_MS,
  DODGE_RECOVERY_MS,
  DODGE_TOTAL_MS,
  DODGE_COOLDOWN_MS,

  // Sidestep
  SIDESTEP_STARTUP_MS,
  SIDESTEP_ACTIVE_MIN_MS,
  SIDESTEP_ACTIVE_MAX_MS,
  SIDESTEP_RECOVERY_MS,
  SIDESTEP_TOTAL_MS,
  SIDESTEP_STAMINA_COST,
  SIDESTEP_ARC_DEPTH_MIN,
  SIDESTEP_ARC_DEPTH_MAX,
  SIDESTEP_GRAB_TRACK_RANGE,
  SIDESTEP_INITIATION_RANGE,
  SIDESTEP_ARC_SPEED,
  SIDESTEP_MAX_TRAVEL,

  // Dodge physics
  DODGE_DURATION,
  DODGE_BASE_SPEED,
  DODGE_CANCEL_ACTION_LOCK,

  // Grab mechanics
  GRAB_WALK_SPEED_MULTIPLIER,
  GRAB_WALK_ACCEL_MULTIPLIER,
  GRAB_STARTUP_DURATION_MS,
  GRAB_STARTUP_HOP_HEIGHT,
  GRAB_LUNGE_DISTANCE,
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
  GRAB_PUSH_RESIST_SPEED_MULT,
  GRAB_PUSH_RESIST_STAMINA_DRAIN_INTERVAL,
  GRAB_PUSH_SEPARATION_OPPONENT_VEL,
  GRAB_PUSH_SEPARATION_GRABBER_VEL,
  GRAB_PUSH_SEPARATION_INPUT_LOCK,
  PULL_REVERSAL_DISTANCE,
  PULL_REVERSAL_TWEEN_DURATION,
  PULL_REVERSAL_PULLED_LOCK,
  PULL_REVERSAL_PULLER_LOCK,
  PULL_BOUNDARY_MARGIN,

  // Input Buffering
  INPUT_BUFFER_WINDOW_MS,

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

  // Rope jump
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_STAMINA_COST,
  ROPE_JUMP_ARC_HEIGHT,
  ROPE_JUMP_SAFE_HEIGHT,
  ROPE_JUMP_BOUNDARY_ZONE,

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
  CHARGE_FULL_POWER_MS,
  SLAP_ATTACK_STAMINA_COST,
  CHARGED_ATTACK_STAMINA_COST,
  DODGE_STAMINA_COST,
  SLAP_HIT_VICTIM_STAMINA_DRAIN,
  CHARGED_HIT_VICTIM_STAMINA_DRAIN,
  GASSED_DURATION_MS,
  GASSED_RECOVERY_STAMINA,

  // Hitstop
  SLAP_CHAIN_HIT_GAP_MS,
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

// CPU AI Module for Pumo Pumo - SUMO EXPERT
// Goal: Knock the opponent out of the dohyo (ring)
// Design philosophy: Human-like decision making with strategic reads, commitment,
// and intelligent grab system usage based on positioning and stamina.

const { ROPE_JUMP_BOUNDARY_ZONE,
        SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MS, SIDESTEP_TOTAL_MS,
        SIDESTEP_STAMINA_COST,
        DODGE_STAMINA_COST,
        GROUND_LEVEL, DOHYO_FALL_DEPTH,
        SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST,
        RAW_PARRY_STAMINA_COST, POWER_UP_TYPES, SLAP_KILL_RANGE,
        PALM_THRUST_STAMINA_COST,
        CLINCH_THROW_KILL_THRESHOLD,
        GRAB_BREAK_STAMINA_COST,
        CLINCH_LIGHT_DRIVE_MS,
        FLAP_CHARGE_COOLDOWN_MS, FLAP_STAMINA_COST,
        SLAP_TOTAL_MS, CADENCE_WINDOW_MS,
        CPU_CADENCE_EASY, CPU_CADENCE_NORMAL, CPU_CADENCE_HARD, CPU_CADENCE_IMPOSSIBLE,
        BALANCE_MAX, GRAB_BREAK_REACTION_LOCK_MS } = require("./constants");
const { MAP_LEFT_BOUNDARY: GAME_MAP_LEFT, MAP_RIGHT_BOUNDARY: GAME_MAP_RIGHT,
        canPlayerSidestep, getSidestepInitData, simNowForPlayer,
        logVerbInitiation, beginPlayerDodge,
        beginGrabStartup,
        canArmAttackParry, armAttackParry } = require("./gameUtils");
const { getConnectDistance, attackKindFromPlayer } = require("./strikeContact");
const { startRopeJump } = require("./ropeJumpStart");

// MASTERY OVERHAUL feature flags (Phase 1: momentum, Phase 2: posture, Phase 3: cadence).
const { MASTERY_P1_MOMENTUM, MASTERY_P2_POSTURE, MASTERY_P3_CADENCE } = require("./masteryFlags");

// Map boundaries - MUST match gameUtils.js (340 and 940)
const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 940;
const MAP_CENTER = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
const MAP_WIDTH = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;

// ── TRAINING LAB (TEMP) ──────────────────────────────────────────────────────
// When true, Easy VS CPU is a grab-only dummy with infinite posture so you can
// isolate MATADOR feel. Flip to false to restore normal Easy behavior.
// (Was slap-only for Attack Parry lab — same pattern, grab verb instead.)
const EASY_GRAB_MATADOR_DUMMY = false;

// AI Configuration - Tuned for expert sumo gameplay
const AI_CONFIG = {
  // Distance thresholds — slap fire range is derived from getConnectDistance
  // at use-time (tip ~133px @ 0.85). SLAP_RANGE is the "close pocket" band only.
  SLAP_RANGE: 140,         // ≈ tip connect + slack — close-range offense pocket
  SLAP_REACH_SLACK: 10,    // Extra px past connect for ice drift into ACTIVE
  GRAB_RANGE: 135,
  GRAB_APPROACH_RANGE: 165,
  MID_RANGE: 185,          // Scaled for camera zoom (was 250)
  CHARGED_ATTACK_RANGE: 200, // Adjusted for buffed charged hitbox (~106px)
  
  // Edge/corner awareness
  EDGE_DANGER_ZONE: 89,    // Scaled for camera zoom (was 120)
  CORNER_CRITICAL_ZONE: 59, // Scaled for camera zoom (was 80)
  BACK_TO_BOUNDARY_THROW_ZONE: 130,
  
  // Reaction chances (0-1) — intentionally imperfect to feel human
  PARRY_CHANCE: 0.38,      // Base chance to parry incoming attacks (expert AI)
  DODGE_CHANCE: 0.16,      // Base chance to dodge instead of parry
  REACTION_MISS_CHANCE: 0.20, // Chance to completely miss reacting to an attack
  
  // Timing (ms)
  DECISION_COOLDOWN: 120,  // Minimum time between major decisions
  
  // Stamina thresholds
  GRAB_BREAK_STAMINA: GRAB_BREAK_STAMINA_COST, // Matches live clinch break cost
  DODGE_STAMINA_COST: 4,   // Matches new DODGE_STAMINA_COST constant
  LOW_STAMINA_THRESHOLD: 25, // Opponent considered low stamina
  CLINCH_STAMINA_DESPERATE: 20, // Near-gas — never Plant to "recover"
  CLINCH_STAMINA_LOW: 40,       // Prefer neutral breathing / light drive over Plant
  
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

  // === PHASE 3.3/3.4: Corner economy & palm thrust ===
  // Corner escape used to roll per DECISION TICK → near-certain escape within a
  // second. Now it's ONE decision per corner entry, then a cooldown before the
  // CPU re-decides, plus a hard per-round escape budget. Budget spent → the CPU
  // fights out of the corner instead of fleeing.
  CORNER_DECISION_COOLDOWN_MS: 1500,  // Min ms between corner-answer re-rolls
  AI_CORNER_ESCAPE_BUDGET: 2,         // Sidestep/rope-jump escapes allowed per round
  // Palm thrust — the anti-mash counter-poke the CPU never used before. Shared
  // cooldown so it stays a read, not a habit. Max range is derived from
  // getConnectDistance("palm") at use-time (was a hard 180 that whiffed constantly).
  PALM_DECISION_COOLDOWN_MS: 1500,    // Min ms between palm attempts (any context)
  PALM_COUNTERPOKE_CHANCE: 0.30,      // vs a slap-spammer at poke range
  PALM_EDGE_FINISH_CHANCE: 0.50,      // opponent pinned within SLAP_KILL_RANGE of rope
  PALM_COUNTERPOKE_MIN_RANGE: 118,    // Past slap mash pocket — closer = slap/grab
  PALM_COUNTERPOKE_REACH_SLACK: 8,    // Extra px past connect for ice drift into the poke
  PALM_SLAP_SPAM_WINDOW_MS: 4000,     // Rolling window for counting opponent slaps
  PALM_SLAP_SPAM_THRESHOLD: 3,        // Slaps in window that flag a "spammer"

  // Slap pressure adaptation — AI gets more defensive after eating consecutive hits
  PRESSURE_HIT_THRESHOLD: 2,       // After this many consecutive hits, boost defense
  PRESSURE_PARRY_BOOST: 0.60,      // Boosted parry chance when under slap pressure
  PRESSURE_JITTER_MAX: 10,         // Near-instant reactions when pressured
  PRESSURE_MISS_CHANCE: 0.05,      // Almost never misses when focused on defense
  PRESSURE_DECAY_TIME: 2500,       // How long the defensive boost lasts after last hit (ms)

  // Clinch system intelligence
  CLINCH_GRIP_UP_DELAY_MIN: 200,       // Min delay before gripping up when grabbed
  CLINCH_GRIP_UP_DELAY_MAX: 500,       // Max delay before gripping up
  CLINCH_ACTION_INTERVAL_MIN: 600,     // Min interval between throw/pull evaluations
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

  // === FLAP power-up: offense (CPU piloting its own flight) ===
  FLAP_USE_CHANCE: 0.45,        // Base chance to commit a liftoff when a good engage window appears
  FLAP_COOLDOWN: 3000,          // Min ms between liftoff attempts (don't spam flights)
  FLAP_MIN_RANGE: 110,          // Too close → opponent just parries/dashes the slam; skip
  FLAP_MAX_RANGE: 380,          // Too far → flight is heavily telegraphed; skip engages
  FLAP_PUNISH_RANGE: 470,       // When opponent is whiffing/recovering, slam from farther out
  FLAP_DIVE_ALIGN: 50,          // |dx| under this = "over" the opponent → commit the dive (stop flapping)
  FLAP_DIVE_KEEP_HEIGHT: 70,    // While still closing, air-flap if below this height so we don't fall short

  // === FLAP power-up: defense (reacting to the opponent's flight) ===
  FLAP_DEF_RANGE: 150,          // Horizontal threat band of an incoming body-slam
  FLAP_DEF_REACT_HEIGHT: 130,   // Flapper height (px above ground) at which we commit a parry/dash
  FLAP_DODGE_CHANCE: 0.55,      // Chance to dash out from under a landing (primary counter)
  FLAP_PARRY_CHANCE: 0.35,      // Chance to parry the slam instead (only if parry is available)
};

// ============================================================================
// DIFFICULTY TIERS — one brain, dialed up/down (BASHO_MODE_SPEC §5.5)
// ============================================================================
//
// There is ONE expert brain (this file). Difficulty never forks logic — it dials
// the SAME chokepoints. HARD resolves to the AI_CONFIG identity (byte-identical
// troublemaker baseline). IMPOSSIBLE dials reaction quality UP. EASY / NORMAL
// dial BOTH reaction quality AND conversion competence DOWN so they feel like
// real fighters that are beatable — not experts who randomly space out, then
// wake up and scrub-kill you at the ropes.
//
// Curve intent:
//   EASY  — fighty beginner: walks in, slaps, occasional grabs. Slow defense,
//           no pressure wake-up, no palm gotchas, weak ring-out/clinch converts.
//   NORMAL — competent mid: can pressure and convert sometimes, but delayed /
//           soft under fire; gotchas muted, not deleted.
//   HARD / IMPOSSIBLE — full expert conversion brain (the troublemakers).
//
// `DIFF` is set once per tick at the top of updateCPUAI from room.cpuDifficulty
// (the loop is single-threaded and resolves one CPU at a time before executing
// its inputs, so a module-level active profile is safe). It defaults to HARD so
// any unset/legacy caller behaves exactly as before.
// Fields:
//   missChance/pressureMiss  — chance to whiff a defensive reaction
//   jitterMin/Max            — reaction delay (ms) before a defensive react fires
//   pressureJitterMin/Max    — delay while "woken up" under slap pressure
//   pressureHitThreshold     — consecutive hits before pressure wake-up
//   decisionCooldown         — ms between major decisions (lower = sharper)
//   parry/dodge/snowball/flapDefMult — multipliers on those reaction chances
//   burstChanceMult          — scales slap-burst commitment chance
//   burstCountMin/Max        — clamps committed slap-burst length
//   ringOutMult              — scales ring-out conversion aggression
//   palmEdgeMult/palmPokeMult — scales edge-finish / anti-mash palm
//   clinchKillMult/clinchLandMult — scales clinch throw convert rates
//   edgeGrabMult             — scales grab-when-opponent-near-edge rates
//   offenseGrabMult          — scales mid-screen / general grab offense
//   diChance                 — chance to hold correct knockback DI
//   grabBreakChance          — chance to input the correct grab-break
//   usePowerUps              — may use snowball/army/flap offensively
//   gripUpMult               — multiplier on clinch grip-up delay (lower = grips
//                              up faster, so it can defend/break a grab sooner)
//   clinchEscapeBoost        — multiplier on edge-escape throw/pull chance in clinch
//   clinchBreakEscape        — will spend a defensive clinch BREAK to escape a
//                              losing clinch near the edge (tech-out, avoid death)
//   perfectParry             — tightens parry hold toward the perfect-parry window
//   whiffPunish              — reliably punishes the human's recovery/whiff/endlag
const DIFFICULTY_PROFILES = {
  EASY: {
    // Soft + consistent (not coin-flip god/potato). Softness comes from slow
    // jitter and muted conversion — not from whiffing 55% then waking up.
    missChance: 0.42,
    pressureMiss: 0.50,
    jitterMin: 100,
    jitterMax: 210,
    decisionCooldown: 250,
    parryMult: 0.42,
    dodgeMult: 0.38,
    snowballParryMult: 0.42,
    flapDefMult: 0.38,
    // Anti-parry grab: almost never. CPU should mostly press INTO the stance.
    parryPunishChance: 0.02,
    parryPunishDelayMin: 280,
    parryPunishDelayMax: 420,
    usePowerUps: false,
    gripUpMult: 1,
    clinchEscapeBoost: 1,
    clinchBreakEscape: false,
    perfectParry: false,
    whiffPunish: false,
    // Conversion dials — still fighty, not cruel
    pressureJitterMin: 100,
    pressureJitterMax: 210, // no scrub-killer wake-up spike
    pressureHitThreshold: 99, // effectively never enters pressure mode
    burstChanceMult: 0.40,
    burstCountMin: 2,
    burstCountMax: 3,
    ringOutMult: 0.40,
    palmEdgeMult: 0,
    palmPokeMult: 0,
    clinchKillMult: 0.45,
    clinchLandMult: 0.70,
    edgeGrabMult: 0.40,
    offenseGrabMult: 0.55,
    diChance: 0.55,
    grabBreakChance: 0.28,
  },
  NORMAL: {
    // Competent mid — can fight and sometimes convert, but stays human under fire.
    missChance: 0.28,
    pressureMiss: 0.20,
    jitterMin: 45,
    jitterMax: 125,
    decisionCooldown: 170,
    parryMult: 0.72,
    dodgeMult: 0.70,
    snowballParryMult: 0.72,
    flapDefMult: 0.70,
    parryPunishChance: 0.08,
    parryPunishDelayMin: 200,
    parryPunishDelayMax: 320,
    usePowerUps: true,
    gripUpMult: 1,
    clinchEscapeBoost: 1,
    clinchBreakEscape: false,
    perfectParry: false,
    whiffPunish: false,
    pressureJitterMin: 35,
    pressureJitterMax: 95, // wakes up, but still delayed
    pressureHitThreshold: 3, // needs a real string, not two pokes
    burstChanceMult: 0.70,
    burstCountMin: 2,
    burstCountMax: 4,
    ringOutMult: 0.70,
    palmEdgeMult: 0.40,
    palmPokeMult: 0.35,
    clinchKillMult: 0.70,
    clinchLandMult: 0.85,
    edgeGrabMult: 0.75,
    offenseGrabMult: 0.80,
    diChance: 0.80,
    grabBreakChance: 0.40,
  },
  HARD: {
    // Identity profile — resolves to the literal AI_CONFIG baseline below.
    missChance: AI_CONFIG.REACTION_MISS_CHANCE,
    pressureMiss: AI_CONFIG.PRESSURE_MISS_CHANCE,
    jitterMin: AI_CONFIG.REACTION_JITTER_MIN,
    jitterMax: AI_CONFIG.REACTION_JITTER_MAX,
    decisionCooldown: AI_CONFIG.DECISION_COOLDOWN,
    parryMult: 1,
    dodgeMult: 1,
    snowballParryMult: 1,
    flapDefMult: 1,
    // Correct RPS exists, but must feel like a read — not a Space-press cancel.
    parryPunishChance: 0.22,
    parryPunishDelayMin: 160,
    parryPunishDelayMax: 260,
    usePowerUps: true,
    gripUpMult: 1,
    clinchEscapeBoost: 1,
    clinchBreakEscape: false,
    perfectParry: false,
    whiffPunish: false,
    pressureJitterMin: 0,
    pressureJitterMax: AI_CONFIG.PRESSURE_JITTER_MAX,
    pressureHitThreshold: AI_CONFIG.PRESSURE_HIT_THRESHOLD,
    burstChanceMult: 1,
    burstCountMin: AI_CONFIG.COMMIT_SLAP_BURST_MIN,
    burstCountMax: AI_CONFIG.COMMIT_SLAP_BURST_MAX,
    ringOutMult: 1,
    palmEdgeMult: 1,
    palmPokeMult: 1,
    clinchKillMult: 1,
    clinchLandMult: 1,
    edgeGrabMult: 1,
    offenseGrabMult: 1,
    diChance: 1,
    grabBreakChance: 0.50,
  },
  IMPOSSIBLE: {
    missChance: 0.02, // virtually never whiffs a reaction
    pressureMiss: 0,
    jitterMin: 0,
    jitterMax: 8, // frame-tight reactions (but NOT zero — avoids "robotic" feel)
    decisionCooldown: 65, // re-decides almost twice as often as HARD
    parryMult: 2.2, // raw-parries far more reliably (eff. ~0.84, clamped 0.95)
    dodgeMult: 1.9,
    snowballParryMult: 1.9,
    flapDefMult: 1.7,
    parryPunishChance: 0.40,
    parryPunishDelayMin: 130,
    parryPunishDelayMax: 200,
    usePowerUps: true,
    gripUpMult: 0.4, // grips up fast so it isn't free-thrown out of a grab
    clinchEscapeBoost: 1.6, // fights its way off the edge in clinch
    clinchBreakEscape: true, // techs out of a lethal clinch instead of dying
    perfectParry: true, // times parries into the perfect-parry punish window
    whiffPunish: true, // capitalizes on the human's recovery frames
    // Conversion stays at HARD identity — cruelty comes from reaction mastery.
    pressureJitterMin: 0,
    pressureJitterMax: AI_CONFIG.PRESSURE_JITTER_MAX,
    pressureHitThreshold: AI_CONFIG.PRESSURE_HIT_THRESHOLD,
    burstChanceMult: 1,
    burstCountMin: AI_CONFIG.COMMIT_SLAP_BURST_MIN,
    burstCountMax: AI_CONFIG.COMMIT_SLAP_BURST_MAX,
    ringOutMult: 1,
    palmEdgeMult: 1,
    palmPokeMult: 1,
    clinchKillMult: 1,
    clinchLandMult: 1,
    edgeGrabMult: 1,
    offenseGrabMult: 1,
    diChance: 1,
    grabBreakChance: 0.50,
  },
};

// Cache resolved profiles so we don't rebuild the object every tick.
const _diffCache = {};
function isEasyGrabMatadorDummy() {
  return EASY_GRAB_MATADOR_DUMMY && DIFF_KEY === "EASY";
}

function topUpEasyGrabDummy(cpu) {
  cpu.balance = BALANCE_MAX;
  cpu.stamina = 100;
  cpu.isGassed = false;
}

// Kill Phase A / manual push immediately — lab dummy must never shove the player.
function cancelEasyGrabDummyPush(cpu, human) {
  cpu.isGrabPushing = false;
  cpu.isGrabWalking = false;
  cpu.isEdgePushing = false;
  cpu.isAtBoundaryDuringGrab = false;
  cpu.grabPushStartTime = 0;
  cpu.grabApproachSpeed = 0;
  cpu.clinchAction = "neutral";
  if (human) {
    human.isBeingGrabPushed = false;
    human.isBeingEdgePushed = false;
  }
}

// If a grab connects, dump the clinch ASAP (no throw/pull/push).
function runEasyGrabDummyClinchEscape(cpu, human, aiState, currentTime) {
  topUpEasyGrabDummy(cpu);
  resetAllKeys(cpu);
  cancelEasyGrabDummyPush(cpu, human);

  // No clinch verbs — clear any pending throw/pull intent.
  cpu.clinchThrowRequest = null;
  cpu.clinchJoltRequest = false;
  aiState.clinchThrowPending = null;
  aiState.clinchThrowExecuteTime = 0;
  aiState.clinchPushPlantDecision = null;
  aiState.clinchLightDrivePulse = false;
  aiState.clinchClampHoldPlant = false;
  aiState.clinchClampPlantUntil = 0;

  // Reaction lock must expire before break/jolt is accepted.
  const gripAt = cpu.gripAcquiredTime || 0;
  if (gripAt && currentTime - gripAt < GRAB_BREAK_REACTION_LOCK_MS) {
    aiState.lastActionType = "grab_dummy_wait_break_lock";
    return;
  }

  if (
    cpu.hasGrip &&
    human &&
    human.hasGrip &&
    !cpu.clinchBreakRequest &&
    !cpu.isGrabBreaking &&
    !cpu.isGrabBreakCountered &&
    !cpu.isGrabBreakSeparating
  ) {
    cpu.clinchBreakRequest = true;
    cpu.clinchBreakRequestTime = currentTime;
    aiState.lastActionType = "grab_dummy_break";
  }
}

// Grab-only + infinite resources training dummy (Easy only, gated by flag above).
// Walks in and spam-grabs so you can lab MATADOR. No slap / parry / dodge / charge.
// On connect: never push / never clinch actions — grab-break ASAP.
function runEasyGrabMatadorDummy(cpu, human, aiState, currentTime, distance) {
  topUpEasyGrabDummy(cpu);

  // Never defend / slap / charge — offense is open-game grabs only.
  cpu.palmThrustQueued = false;
  aiState.pendingParry = false;
  aiState.parryReleaseTime = 0;
  aiState.reactionTarget = null;
  aiState.commitAction = null;
  aiState.commitCount = 0;

  // Grab connected → dump clinch immediately (no push / throw / pull).
  if (
    cpu.inClinch ||
    cpu.isGrabbing ||
    cpu.isBeingGrabbed ||
    (human && human.inClinch)
  ) {
    runEasyGrabDummyClinchEscape(cpu, human, aiState, currentTime);
    return;
  }

  // Already lunging — let the grab attempt play out.
  if (cpu.isGrabStartup || cpu.isGrabbingMovement) {
    aiState.lastActionType = "grab_dummy_lunge";
    return;
  }

  resetAllKeys(cpu);

  // In range + can grab → Mouse2 rising edge (processed later as beginGrabStartup).
  // Intentionally ignores "good opportunity" / raw-parry skips — the whole point
  // is to keep throwing grabs at the player for MATADOR reads.
  if (
    canGrab(cpu) &&
    isOpponentGrabbable(human) &&
    isFacingOpponent(cpu, human) &&
    isAtGrabRange(cpu, human)
  ) {
    cpu.keys.mouse2 = true;
    aiState.mouse2ReleaseTime = currentTime + 50;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "grab_dummy_grab";
    return;
  }

  // Out of grab range — walk in. No other verbs.
  const dir = getDirectionToOpponent(cpu, human);
  if (dir === 1) cpu.keys.d = true;
  else if (dir === -1) cpu.keys.a = true;
  aiState.lastActionType = "grab_dummy_approach";
}

function resolveDifficulty(difficulty) {
  const key =
    difficulty && DIFFICULTY_PROFILES[difficulty] ? difficulty : "HARD";
  if (!_diffCache[key]) _diffCache[key] = { ...DIFFICULTY_PROFILES[key] };
  return _diffCache[key];
}

// ── PHASE 4.4: CONTINUOUS DIFFICULTY CURVE (BASHO only) ─────────────────────
// Replace the 4-cliff tier mapping with interpolation along a ladder position
// L ∈ [0,1] (division index + banzuke number + back-third ramp, computed
// client-side). Every numeric dial lerps between the anchor profiles; the
// IMPOSSIBLE-only booleans soften to an L threshold so they arrive before the
// very top. Classic VS CPU / PvP never send an L → the discrete resolver above
// runs untouched (byte-identical firewall).
const LADDER_ANCHORS = [
  { L: 0.0,  key: "EASY" },
  { L: 0.25, key: "NORMAL" },
  { L: 0.6,  key: "HARD" },
  { L: 1.0,  key: "IMPOSSIBLE" },
];
const LADDER_NUM_DIALS = [
  "missChance", "pressureMiss", "jitterMin", "jitterMax", "decisionCooldown",
  "parryMult", "dodgeMult", "snowballParryMult", "flapDefMult", "parryPunishChance",
  "parryPunishDelayMin", "parryPunishDelayMax",
  "gripUpMult", "clinchEscapeBoost",
  // Conversion / fairness dials (EASY→HARD curve; HARD/IMPOSSIBLE identity)
  "pressureJitterMin", "pressureJitterMax", "pressureHitThreshold",
  "burstChanceMult", "burstCountMin", "burstCountMax",
  "ringOutMult", "palmEdgeMult", "palmPokeMult",
  "clinchKillMult", "clinchLandMult", "edgeGrabMult", "offenseGrabMult",
  "diChance", "grabBreakChance",
];

// Clamp a preferred slap-burst length into the active difficulty's burst window.
// HARD (2–5) + preferred (3–5) → 3–5 (identity). EASY (2–3) + preferred (3–5) → 3.
// Rounds ladder-lerped floats so randomInRange stays on integers.
function diffBurstCount(preferredMin, preferredMax) {
  const lo = Math.round(typeof DIFF.burstCountMin === "number" ? DIFF.burstCountMin : preferredMin);
  const hi = Math.round(typeof DIFF.burstCountMax === "number" ? DIFF.burstCountMax : preferredMax);
  const a = Math.min(Math.max(preferredMin, lo), hi);
  const b = Math.min(Math.max(preferredMax, lo), hi);
  return randomInRange(Math.min(a, b), Math.max(a, b));
}

function diffMult(key, fallback = 1) {
  const v = DIFF[key];
  return typeof v === "number" ? v : fallback;
}
const _ladderCache = {};
function resolveDifficultyByLadder(L) {
  const x = L < 0 ? 0 : L > 1 ? 1 : L;
  const bucket = Math.round(x * 100); // cache in 1% steps
  if (_ladderCache[bucket]) return _ladderCache[bucket];
  let lo = LADDER_ANCHORS[0];
  let hi = LADDER_ANCHORS[LADDER_ANCHORS.length - 1];
  for (let i = 0; i < LADDER_ANCHORS.length - 1; i++) {
    if (x >= LADDER_ANCHORS[i].L && x <= LADDER_ANCHORS[i + 1].L) {
      lo = LADDER_ANCHORS[i];
      hi = LADDER_ANCHORS[i + 1];
      break;
    }
  }
  const span = hi.L - lo.L;
  const t = span > 0 ? (x - lo.L) / span : 0;
  const A = DIFFICULTY_PROFILES[lo.key];
  const B = DIFFICULTY_PROFILES[hi.key];
  const out = {};
  for (const k of LADDER_NUM_DIALS) out[k] = A[k] + (B[k] - A[k]) * t;
  out.usePowerUps = x >= 0.25;
  out.clinchBreakEscape = x >= 0.8;
  out.perfectParry = x >= 0.85;
  out.whiffPunish = x >= 0.85;
  _ladderCache[bucket] = out;
  return out;
}
// Map a ladder position to the nearest tier-name for the band-keyed tables
// (top-band convergence). Midpoints between anchors: 0.125 / 0.425 / 0.80.
function ladderBandKey(L) {
  const x = L < 0 ? 0 : L > 1 ? 1 : L;
  if (x < 0.125) return "EASY";
  if (x < 0.425) return "NORMAL";
  if (x < 0.8) return "HARD";
  return "IMPOSSIBLE";
}

// Active difficulty profile for the CPU currently being processed. Defaults to
// HARD so the brain is fully functional even if a caller never sets it.
let DIFF = resolveDifficulty("HARD");
// Resolved difficulty KEY (name) for the current CPU — used by logic that varies
// by tier name rather than by profile field (e.g. top-band convergence).
let DIFF_KEY = "HARD";

// MASTERY Phase 1 (1.7): momentum entries are a HARD+ competence only — EASY /
// NORMAL keep pressing flat-footed as today (difficulty firewall: the overhaul
// raises the ceiling, not the floor).
function isHardPlusTier() {
  return DIFF_KEY === "HARD" || DIFF_KEY === "IMPOSSIBLE";
}

// MASTERY Phase 2 (2.5): "hunt broken posture". When the opponent's posture is
// broken, the CPU leans harder into the CONVERSION it's built for — a grappler
// hunts the yotsu grab, a pusher hunts the oshi edge-thrust — turning the
// striking setup into a kill. HARD+ only (same firewall as momentum entries) so
// EASY/NORMAL stay fighty without expert convert reads. Non-archetype (VS CPU)
// rikishi still get a modest general boost at HARD+. Flag off / posture intact
// ⇒ multiplier 1 (byte-identical).
function isHuntingBrokenPosture(human) {
  return (
    MASTERY_P2_POSTURE &&
    !!human &&
    human.isPostureBroken === true &&
    isHardPlusTier()
  );
}
function postureHuntGrabMult(human) {
  if (!isHuntingBrokenPosture(human)) return 1;
  return PERS_KEY === "grappler" ? 1.5 : 1.25;
}
function postureHuntPalmMult(human) {
  if (!isHuntingBrokenPosture(human)) return 1;
  return PERS_KEY === "pusher" ? 1.5 : 1.25;
}

// ── PHASE 3.3: CORNER-ANSWER MENU (spec 3.3.3) ──────────────────────────────
// Replaces "always flee". When the CPU commits a corner decision it rolls this
// menu once (per entry + cooldown). The baseline weights now live in
// CORNER_POLICY.balanced (Phase 4.2); an archetype flavors them, and a spent
// escape budget collapses the `escape` slot into `fight` (corner answers only).

// ============================================
// AI PERSONALITY ARCHETYPES (BASHO rival roster — Phase 8 follow-up)
// ============================================
// A personality is a LIGHT flavor layer applied ON TOP of the difficulty
// profile, NOT a separate brain. It only nudges two things — the aggression
// roll weights and the {attack, defense, grab} multipliers that already flow
// through every offense/defense/grab decision (getAggressionMultiplier). This
// means an archetype changes a rikishi's STYLE (a pusher slaps, a grappler
// hunts the belt, a counter waits and punishes) without making them stronger
// or unfair — difficulty still owns reaction quality.
//
// FIREWALL: read per-CPU from `cpu.aiArchetype`. Only the BASHO roster sets it;
// PvP and VS CPU players have no archetype, so they resolve to `balanced` =
// the exact legacy weights/multipliers (byte-for-byte unchanged behavior).
// Fields:
//   aggrAggressive/aggrBalanced — cumulative thresholds for the 0..1 aggression
//                                 roll (rest → defensive). balanced = 0.35/0.75
//                                 (the legacy values).
//   attackMult/defenseMult/grabMult — layered onto getAggressionMultiplier so
//                                 the rikishi leans into its preferred game.
const PERSONALITY_PROFILES = {
  balanced: {
    aggrAggressive: 0.35,
    aggrBalanced: 0.75,
    attackMult: 1,
    defenseMult: 1,
    grabMult: 1,
  },
  // Oshi-zumo: relentless forward slaps/charges, rarely reaches for the belt.
  pusher: {
    aggrAggressive: 0.5,
    aggrBalanced: 0.85,
    attackMult: 1.2,
    defenseMult: 0.95,
    grabMult: 0.55,
  },
  // Yotsu-zumo: hunts the grab and clinch; less interested in a slap battle.
  grappler: {
    aggrAggressive: 0.35,
    aggrBalanced: 0.72,
    attackMult: 0.88,
    defenseMult: 1.0,
    grabMult: 1.7,
  },
  // Patient counter-puncher: parries/dodges more, attacks off your mistakes.
  counter: {
    aggrAggressive: 0.2,
    aggrBalanced: 0.5,
    attackMult: 0.82,
    defenseMult: 1.3,
    grabMult: 0.85,
  },
  // All-out brawler / glass cannon: maximum pressure, porous defense.
  brawler: {
    aggrAggressive: 0.62,
    aggrBalanced: 0.92,
    attackMult: 1.35,
    defenseMult: 0.7,
    grabMult: 1.1,
  },
};

const _persCache = {};
function resolvePersonality(archetype) {
  const key =
    archetype && PERSONALITY_PROFILES[archetype] ? archetype : "balanced";
  if (!_persCache[key]) _persCache[key] = { ...PERSONALITY_PROFILES[key] };
  return _persCache[key];
}

// Active personality for the CPU currently being processed. Defaults to the
// neutral `balanced` profile so non-BASHO CPUs are unchanged.
let PERS = resolvePersonality("balanced");
// Resolved archetype KEY for the current CPU. "balanced" for every non-BASHO
// player (the firewall) — used to gate the Phase 4 decision-moment policies and
// memory so PvP / VS CPU stay byte-identical to the legacy behavior.
let PERS_KEY = "balanced";

// ============================================================================
// PHASE 4.2 — DECISION-MOMENT POLICIES (per-archetype, rows sum to 1.0)
// ============================================================================
// Personality stops being "just multipliers" and expresses itself where the
// player is watching: the corner and the clinch. The `balanced` row reproduces
// the baseline behavior EXACTLY, so a non-archetype CPU (PERS_KEY ===
// "balanced") is unchanged. Only BASHO rivals carry a real archetype
// (roomManagement.applyBashoOpponentProfile), so the firewall holds.
//
// Corner answer: escape / palm / parry / fight / grab. balanced === the Phase 3
// corner-menu baseline. Only counter/balanced keep escape >= 0.25 (spec 4.2).
const CORNER_POLICY = {
  balanced: { escape: 0.35, palm: 0.20, parry: 0.15, fight: 0.20, grab: 0.10 },
  pusher:   { escape: 0.10, palm: 0.30, parry: 0.10, fight: 0.40, grab: 0.10 },
  grappler: { escape: 0.15, palm: 0.10, parry: 0.10, fight: 0.20, grab: 0.45 },
  counter:  { escape: 0.25, palm: 0.25, parry: 0.40, fight: 0.05, grab: 0.05 },
  brawler:  { escape: 0.10, palm: 0.15, parry: 0.10, fight: 0.55, grab: 0.10 },
};
// Clinch style (spec 4.2, the 4th decision moment). NOT a weight row — a set of
// LEANS applied to the existing handleClinchBehavior rolls: grappler grips up
// fast and prefers pull; pusher pushes (vs plant) and jolts; counter breaks
// early; brawler is jolt-happy. `balanced` is all-neutral (mult 1 / bias 0), so a
// non-archetype CPU takes the exact legacy clinch path (byte-identical rolls).
//   gripUpMult — scales the grip-up delay (<1 = grips up sooner)
//   joltMult   — scales the clinch-jolt probability
//   pushBias   — added to the neutral push-vs-plant coin (higher = pushes more)
//   pullBias   — shifts throw-decision toward pull (higher = more pull)
//   breakEager — counter's early defensive clinch break (raises chance + lowers
//                the balance-deficit threshold that triggers it)
const CLINCH_STYLE = {
  balanced: { gripUpMult: 1.0,  joltMult: 1.0,  pushBias: 0.0,   pullBias: 0.0,  breakEager: 0.0 },
  pusher:   { gripUpMult: 1.0,  joltMult: 1.25, pushBias: 0.20,  pullBias: -0.15, breakEager: 0.0 },
  grappler: { gripUpMult: 0.7,  joltMult: 0.8,  pushBias: -0.05, pullBias: 0.30, breakEager: 0.0 },
  counter:  { gripUpMult: 1.1,  joltMult: 0.7,  pushBias: -0.12, pullBias: 0.0,  breakEager: 0.30 },
  brawler:  { gripUpMult: 0.9,  joltMult: 1.6,  pushBias: 0.10,  pullBias: 0.0,  breakEager: 0.0 },
};

// ============================================================================
// PHASE 4.3 — CURRICULUM KITS (per-division CPU toolkits, BASHO only)
// ============================================================================
// Low ranks are SPECIALISTS with narrow kits (missing verbs, not dumbed-down
// reactions); each division adds tools so the ladder teaches the game. The verb
// set is CUMULATIVE down the ladder. Resolved per-CPU from `cpu.aiDivision`
// (set by the BASHO roster). A non-BASHO CPU has no division → KIT stays null →
// `hasVerb` returns true for everything → the full legacy kit (the firewall).
const KIT_DIVISION_ORDER = [
  "jonokuchi", "jonidan", "sandanme", "makushita",
  "juryo", "maegashira", "komusubi", "sekiwake", "ozeki", "yokozuna",
];
// Verbs ADDED at each division (inherit everything below). Base = slap,
// grab, and clinch push ("hit buttons, learn the rope").
const KIT_ADDS_BY_DIVISION = {
  jonokuchi:  ["slap", "grab", "clinchPush"],
  jonidan:    ["plant", "parry"],
  sandanme:   ["palm", "clinchThrow"],
  makushita:  ["jolt", "pull", "sidestep"],
  juryo:      ["ropeJump", "powerUps"], // maegashira+ inherit this full kit
};
const DIVISION_KIT = (() => {
  const out = {};
  let acc = [];
  for (const key of KIT_DIVISION_ORDER) {
    acc = acc.concat(KIT_ADDS_BY_DIVISION[key] || []);
    out[key] = new Set(acc);
  }
  return out;
})();

// Active kit for the CPU being processed (null = full kit / non-BASHO).
let KIT = null;
// A verb is available if there's no kit gate (non-BASHO) or the kit includes it.
function hasVerb(verb) {
  return !KIT || KIT.has(verb);
}

// True at the IMPOSSIBLE band, where personality deltas converge halfway toward
// `balanced` ("complete with a lean, never flat" — spec 4.2 top-rank).
function isTopBand() {
  return DIFF_KEY === "IMPOSSIBLE";
}

// Resolve an archetype's policy row, converged 50% toward balanced at the top
// band. Non-archetype CPUs get the balanced row untouched (legacy).
function resolvePolicy(table, keys) {
  const arch = table[PERS_KEY] || table.balanced;
  if (PERS_KEY === "balanced" || !isTopBand()) return { ...arch };
  const bal = table.balanced;
  const out = {};
  for (const k of keys) out[k] = bal[k] + (arch[k] - bal[k]) * 0.5;
  return out;
}

// Weighted single draw over `keys` using `weights` (tolerates non-normalized
// rows — divides by the live total).
function weightedPick(weights, keys) {
  let total = 0;
  for (const k of keys) total += Math.max(0, weights[k] || 0);
  if (total <= 0) return keys[keys.length - 1];
  let r = Math.random() * total;
  let cum = 0;
  for (const k of keys) {
    cum += Math.max(0, weights[k] || 0);
    if (r < cum) return k;
  }
  return keys[keys.length - 1];
}

// Clamp a probability so dialed-up multipliers can't exceed a near-certainty.
const clampChance = (c) => (c > 0.95 ? 0.95 : c < 0 ? 0 : c);

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
      commitAction: null,      // 'slap_burst', etc.
      commitCount: 0,          // How many actions left in commitment
      commitUntil: 0,          // Timestamp when commitment expires
      // === NEW: Aggression mode ===
      aggressionMode: 'balanced', // 'aggressive', 'balanced', 'defensive'
      aggressionShiftTime: 0,    // When to re-roll aggression
      // === NEW: Read system (preemptive actions instead of pure reactions) ===
      lastReadTime: 0,
      readCooldown: 0,
      // === Parry-response node: rank-gated read of the HUMAN's raw parry ===
      // Rolled ONCE per stance enter (not per re-tap), then fired after a real
      // reaction delay — and only if already in grab range / not mid-string.
      parryResponseActive: false,   // true while human has been continuously in stance
      parryResponseGrab: false,     // won the roll → commit a grab-punish when the delay elapses
      parryResponseFireAt: 0,       // sim time the delayed grab-punish fires
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
      // === Post-clinch-break "thinking" delay ===
      // Grab break drops both players into a mechanically symmetric neutral
      // state. Without a CPU-side reaction delay the AI fires its next action
      // on the very tick the input lock clears, beating any human reaction
      // (~150–300ms perceive→decide→press) every time. We add a short randomized
      // delay so the clinch break feels like a genuine 50/50 reset instead of
      // a free CPU punish window.
      wasInClinchBreak: false,
      postClinchBreakReactionUntil: 0,
      // === Human-like reaction jitter — delays defensive reactions by a few frames ===
      reactionTarget: null,
      reactionDetectTime: 0,
      reactionDelay: 0,
      reactionProcessed: false,
      // === Rope jump tracking ===
      lastRopeJumpTime: 0,
      // === PHASE 3.3/3.4: corner economy & palm ===
      cornerEscapeBudget: AI_CONFIG.AI_CORNER_ESCAPE_BUDGET, // refilled each round
      lastCornerDecisionTime: 0,   // gate for CORNER_DECISION_COOLDOWN_MS
      cornerActiveLast: false,     // edge-detect fresh corner entries
      prevHakkiyoiCount: 0,        // round-transition detector (budget refill)
      lastPalmTime: 0,             // shared PALM_DECISION_COOLDOWN_MS gate
      opponentSlapTimes: [],       // rolling timestamps of the human's slaps
      lastSeenHumanAttackStart: 0, // edge-detect new human attacks for the tracker
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
      clinchLightDrivePulse: false, // true after a short Light Drive → force neutral breath
      clinchClampHoldPlant: false,  // sticky Plant while arm-clamped (offense locked)
      clinchClampPlantUntil: 0,
      // Defensive clinch-break (high-tier tech-out) interval gate
      lastClinchBreakCheck: 0,
      // === FLAP power-up tracking ===
      spaceReleaseTime: 0,       // Release timer for the Space (flap) key press
      lastFlapTime: 0,           // Last liftoff attempt (cooldown gate)
      flapDiveCommitted: false,  // Once aligned over the opponent, stop flapping and drop
      flapReactTarget: null,     // Defensive reaction bookkeeping vs an incoming flap
      flapReactDetectTime: 0,
      flapReactDelay: 0,
      flapReactProcessed: false,
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

// True when the human is airborne enough that a ground grab cannot connect.
// Matches server grab immunity (flight / rope / elevated) — CPU must not
// grab-fish jumpers / FLAP / air-hit dumps.
function isOpponentAirborne(human) {
  if (!human) return false;
  if (human.isSlideJumping && human.slideJumpPhase === "flight") return true;
  if (human.isFlapping && human.flapPhase === "flight") return true;
  if (human.isRopeJumping && human.ropeJumpPhase === "active") return true;
  if (human.isHitFalling) return true;
  if (human.isIceSlideReverseHopping) return true;
  if (typeof human.y === "number" && human.y > GROUND_LEVEL + 8) return true;
  return false;
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
         !human.isSidestepping &&
         !isOpponentAirborne(human);
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

  // A raw-parrying opponent is NOT a generic grab opportunity. Grabbing every
  // parry on sight (a parrier reads as "stationary + in range + grabbable") is
  // exactly what made the parry feel worthless — the CPU stopped whatever it was
  // doing to punish it, at every rank. Whether to grab-punish a parry is now the
  // dedicated, rank-gated parry-response node's call (handleParryResponse); this
  // generic path always declines so low ranks commit strikes INTO the parry.
  if (human.isRawParrying) return false;

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

  // Parry/guard stance is NOT a generic grab-approach target. Walking into a
  // rooted parrier was the "CPU freezes / walks into my Space" tell — the
  // dedicated handleParryResponse node is the only path allowed to grab-punish.
  if (human.isRawParrying) return false;

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
    // Personality skews HOW OFTEN the rikishi rolls into each stance (a pusher
    // is aggressive more often, a counter defensive more often). balanced =
    // 0.35/0.75 = the legacy split.
    if (roll < PERS.aggrAggressive) {
      aiState.aggressionMode = 'aggressive';
    } else if (roll < PERS.aggrBalanced) {
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
  let base;
  switch (aiState.aggressionMode) {
    case 'aggressive': base = { attack: 1.4, defense: 0.6, grab: 1.3 }; break;
    case 'defensive': base = { attack: 0.7, defense: 1.4, grab: 0.8 }; break;
    default: base = { attack: 1.0, defense: 1.0, grab: 1.0 };
  }
  // Personality leans the rikishi toward its preferred game (oshi vs yotsu vs
  // counter). balanced multiplies by 1/1/1 → identical to the legacy values.
  return {
    attack: base.attack * PERS.attackMult,
    defense: base.defense * PERS.defenseMult,
    grab: base.grab * PERS.grabMult,
  };
}

// Check if CPU can act (not in a state that blocks actions)
function canAct(cpu) {
  // All three deadlines are sim-clock (pause during hitstop)
  const isOnCooldown = cpu.attackCooldownUntil && simNowForPlayer(cpu) < cpu.attackCooldownUntil;
  const isInputLocked = cpu.inputLockUntil && simNowForPlayer(cpu) < cpu.inputLockUntil;
  const isActionLocked = cpu.actionLockUntil && simNowForPlayer(cpu) < cpu.actionLockUntil;
  
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
  const isOnCooldown = cpu.attackCooldownUntil && simNowForPlayer(cpu) < cpu.attackCooldownUntil;
  const isInputLocked = cpu.inputLockUntil && simNowForPlayer(cpu) < cpu.inputLockUntil;
  const isActionLocked = cpu.actionLockUntil && simNowForPlayer(cpu) < cpu.actionLockUntil;
  
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
  // PHASE 4.3: parry is a Jonidan+ verb — a Jonokuchi specialist can't answer yet.
  return hasVerb("parry") &&
         canAct(cpu) && 
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
    // Clear any unconsumed palm intent so it can't retag a later slap press.
    cpu.palmThrustQueued = false;
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
  if (aiState.spaceReleaseTime > 0 && currentTime >= aiState.spaceReleaseTime) {
    cpu.keys[" "] = false;
    aiState.spaceReleaseTime = 0;
  }
}

// Main AI update function - called every game tick
function updateCPUAI(cpu, human, room, currentTime) {
  if (!cpu || !human || !cpu.isCPU) return;

  const aiState = getAIState(cpu.id);

  // PHASE 3.3 — per-round corner escape budget. hakkiyoiCount drops to 0 between
  // rounds and returns to >0 at each tachiai; watch the 0→>0 edge to refill. This
  // runs BEFORE the early-return so it can observe the between-round 0 state.
  if (room.hakkiyoiCount !== aiState.prevHakkiyoiCount) {
    if (room.hakkiyoiCount > 0 && aiState.prevHakkiyoiCount === 0) {
      aiState.cornerEscapeBudget = AI_CONFIG.AI_CORNER_ESCAPE_BUDGET;
      aiState.lastCornerDecisionTime = 0;
      aiState.cornerActiveLast = false;
      aiState.opponentSlapTimes = [];
    }
    aiState.prevHakkiyoiCount = room.hakkiyoiCount;
  }

  // Don't process AI during game over or before game starts
  if (room.gameOver || room.matchOver || !room.gameStart || room.hakkiyoiCount === 0) {
    resetAllKeys(cpu);
    return;
  }

  // Resolve this CPU's difficulty tier (EASY/NORMAL/HARD/IMPOSSIBLE) once for
  // the whole decision pass. HARD === the AI_CONFIG baseline (no change).
  // PHASE 4.4: prefer the continuous ladder position when BASHO supplied one;
  // otherwise fall back to the discrete tier (classic VS CPU — byte-identical).
  const ladderL = (room && typeof room.cpuLadderPosition === "number")
    ? room.cpuLadderPosition
    : null;
  if (ladderL != null) {
    DIFF = resolveDifficultyByLadder(ladderL);
    DIFF_KEY = ladderBandKey(ladderL);
  } else {
    DIFF = resolveDifficulty(room && room.cpuDifficulty);
    DIFF_KEY = (room && room.cpuDifficulty && DIFFICULTY_PROFILES[room.cpuDifficulty])
      ? room.cpuDifficulty
      : "HARD";
  }
  // Matador lab: keep Easy dummy resources topped every tick (even on early returns).
  if (isEasyGrabMatadorDummy()) {
    topUpEasyGrabDummy(cpu);
  }
  // Resolve this CPU's personality archetype (BASHO rival roster). Non-BASHO
  // CPUs have no archetype → `balanced` → legacy behavior.
  PERS = resolvePersonality(cpu && cpu.aiArchetype);
  PERS_KEY = (cpu && cpu.aiArchetype && PERSONALITY_PROFILES[cpu.aiArchetype])
    ? cpu.aiArchetype
    : "balanced";
  // PHASE 4.3: resolve this CPU's curriculum kit from its BASHO division. No
  // division (non-BASHO, or an unknown key) → null → full kit (legacy firewall).
  KIT = (cpu && cpu.aiDivision && DIVISION_KIT[cpu.aiDivision])
    ? DIVISION_KIT[cpu.aiDivision]
    : null;

  // Don't process AI during grab break - both players are locked
  const inClinchBreak = cpu.isGrabBreaking || cpu.isGrabBreakCountered || cpu.isGrabBreakSeparating ||
      human.isGrabBreaking || human.isGrabBreakCountered || human.isGrabBreakSeparating;
  if (inClinchBreak) {
    aiState.wasInClinchBreak = true;
    resetAllKeys(cpu);
    return;
  }

  // Just exited grab break — assign a human-like reaction delay before the
  // CPU is allowed to act again. Mechanics stay symmetric (input lock is the
  // same for both players in mid-ring); this only prevents the CPU's zero-
  // reaction-time advantage on the immediate post-break neutral resume.
  if (aiState.wasInClinchBreak) {
    aiState.wasInClinchBreak = false;
    // Fast-but-not-instant reaction (~3.5–7 frames @60fps). Models a quick-
    // reflex player, faster than average human reaction (~200ms) but still
    // gives the human-side player a fighting chance on the neutral resume.
    aiState.postClinchBreakReactionUntil = currentTime + randomInRange(60, 120);
  }
  if (aiState.postClinchBreakReactionUntil && currentTime < aiState.postClinchBreakReactionUntil) {
    resetAllKeys(cpu);
    return;
  }
  
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

  // === PHASE 3.4: track the human's slap frequency (rolling window) ===
  // Observable info only — edge-detect each new human slap by its attackStartTime
  // and keep a pruned list of timestamps. Seeds the counter-poke read AND (later)
  // Phase 4's memory system.
  if (human.isAttacking && human.attackType === "slap" &&
      human.attackStartTime && human.attackStartTime !== aiState.lastSeenHumanAttackStart) {
    aiState.lastSeenHumanAttackStart = human.attackStartTime;
    aiState.opponentSlapTimes.push(currentTime);
  }
  if (aiState.opponentSlapTimes.length) {
    const spamCutoff = currentTime - AI_CONFIG.PALM_SLAP_SPAM_WINDOW_MS;
    aiState.opponentSlapTimes = aiState.opponentSlapTimes.filter(t => t >= spamCutoff);
  }

  // HIGHEST PRIORITY: DI (Directional Influence) - Reduce knockback by holding opposite direction!
  if (cpu.isHit && cpu.knockbackVelocity && Math.abs(cpu.knockbackVelocity.x) > 0.1) {
    handleKnockbackDI(cpu, aiState, currentTime);
  }
  
  const distance = getDistance(cpu, human);
  
  // Initialize keys object if needed
  if (!cpu.keys) {
    cpu.keys = createEmptyKeys();
  }
  
  // Handle pending key releases
  handlePendingKeyReleases(cpu, aiState, currentTime);

  // Matador lab: Easy = grab-only dummy (no slap/parry/dodge/charge).
  // Clinch connect → instant grab-break path inside the dummy (never push/throw).
  if (isEasyGrabMatadorDummy()) {
    runEasyGrabMatadorDummy(cpu, human, aiState, currentTime, distance);
    return;
  }

  // Playtest dummy: EASY stands still and continuously TAP-parries (no slap/move).
  // Rising-edge `s` arms AP via processCPUInputs; must fully release between taps
  // (and clear AP whiff jail) or the next edge cannot re-arm.
  if (DIFF_KEY === "EASY") {
    resetAllKeys(cpu);
    aiState.pendingParry = false;
    aiState.parryReleaseTime = 0;
    const PRESS_MS = 160; // live AP window while held
    const RELEASE_MS = 320; // > AP_WHIFF_RECOVERY_MS so the next tap can arm
    if (
      !aiState.easyParryPhase ||
      currentTime >= (aiState.easyParryPhaseUntil || 0)
    ) {
      if (aiState.easyParryPhase === "press") {
        aiState.easyParryPhase = "release";
        aiState.easyParryPhaseUntil = currentTime + RELEASE_MS;
      } else {
        aiState.easyParryPhase = "press";
        aiState.easyParryPhaseUntil = currentTime + PRESS_MS;
      }
    }
    cpu.keys.s = aiState.easyParryPhase === "press";
    aiState.lastActionType = "easy_parry_tap_dummy";
    return;
  }

  // HIGHEST PRIORITY (FLAP slide-jump): if WE are in a FLAP-armed slide-jump,
  // pilot air charges + dive. Plain slide-jumps fall through to normal logic.
  if (cpu.isSlideJumping && cpu.slideJumpHasFlap) {
    pilotFlapFlight(cpu, human, aiState, currentTime, distance);
    return;
  }
  // Reset incoming-flap reaction bookkeeping once the opponent lands.
  if (
    !(human.isSlideJumping &&
      (human.slideJumpPhase === "flight" || human.slideJumpPhase === "landing")) &&
    aiState.flapReactTarget
  ) {
    aiState.flapReactTarget = null;
    aiState.flapReactProcessed = false;
  }
  
  // Cancel grab approach if situation changed (hit, grabbed, opponent in i-frames/ungrabable,
  // or they raised a parry/guard — don't keep walking into a rooted Space stance).
  if (aiState.grabApproachIntent && (
    cpu.isHit || cpu.isBeingGrabbed || cpu.isBeingThrown ||
    human.isAttacking || human.isRawParrying || !isOpponentGrabbable(human) ||
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
    aiState.clinchLightDrivePulse = false;
    aiState.clinchClampHoldPlant = false;
    aiState.clinchClampPlantUntil = 0;
    aiState.lastClinchBreakCheck = 0;
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
  
  // Priority 1.5: Use power-up EARLY (EASY does not use power-ups offensively)
  if (DIFF.usePowerUps && handlePowerUpUsage(cpu, human, aiState, currentTime, distance)) {
    return;
  }
  
  // Priority 2: CORNER ANSWER — but only if opponent is actually blocking the escape route
  // If opponent is on the SAME side as the corner (further into the edge), CPU should
  // PRESS the advantage, not flee. Only answer when opponent is between CPU and center.
  // PHASE 3.3: this now rolls a MENU (escape/palm/parry/fight/grab) once per corner
  // entry + cooldown, spends a per-round escape budget, and FALLS THROUGH to the
  // defensive reaction pipeline when it declines to commit (no more escape tunnel).
  const corneredSide = getCorneredSide(cpu);
  if (corneredSide === 0) {
    aiState.cornerActiveLast = false; // left the corner — next entry is "fresh"
  } else {
    const opponentBlocksEscape = (corneredSide === -1 && human.x > cpu.x) ||
                                  (corneredSide === 1 && human.x < cpu.x);
    if (opponentBlocksEscape && canAct(cpu)) {
      if (handleCornerAnswer(cpu, human, aiState, currentTime, distance, corneredSide)) {
        return;
      }
      // else: on cooldown / declined — fall through so a cornered CPU can still parry.
    }
  }
  
  // Priority 2.5: SNOWBALL DEFENSE
  if (canAct(cpu) && (canDodge(cpu) || canParry(cpu))) {
    if (handleSnowballDefense(cpu, human, aiState, currentTime, distance)) {
      return;
    }
  }

  // Priority 2.6: FLAP DEFENSE — opponent is airborne; dash the landing or parry the slam
  if (handleFlapDefense(cpu, human, aiState, currentTime, distance)) {
    return;
  }

  // Priority 2.65: PARRY RESPONSE — occasional delayed grab-punish vs Space.
  // Never cancels our own string; never walks into a rooted stance. Decline →
  // keep pressing so the human's parry can actually catch something.
  if (handleParryResponse(cpu, human, aiState, currentTime, distance)) {
    return;
  }

  // Priority 2.7: WHIFF PUNISH (high-tier) — the human just whiffed / is in
  // recovery or endlag; close in and punish with a grab or slap. Only fires when
  // the human is NOT attacking, so it never competes with the defensive reaction.
  // PHASE 4.2: the `counter` archetype is defined by punishing mistakes, so it
  // unlocks whiff-punish one band early (from HARD), even if its base tier leaves
  // it off — its identity is "waits and capitalizes."
  const whiffPunishEnabled = DIFF.whiffPunish ||
    (PERS_KEY === "counter" && (DIFF_KEY === "HARD" || DIFF_KEY === "IMPOSSIBLE"));
  if (whiffPunishEnabled && handleWhiffPunish(cpu, human, aiState, currentTime, distance)) {
    return;
  }

  // Priority 2.8: PALM THRUST (PHASE 3.4) — the anti-mash counter-poke the CPU
  // never used. Edge finisher (opponent pinned at the rope) + counter-poke vs a
  // slap-spammer at poke range. Gated to neutral (opponent not mid-active-attack)
  // so it demonstrates the tool without stealing the defensive reaction.
  if (handlePalmUsage(cpu, human, aiState, currentTime, distance)) {
    return;
  }

  // Priority 3: React to opponent attacks with HUMAN-LIKE TIMING
  // Under slap pressure the AI can "wake up" — but EASY/NORMAL keep delayed /
  // soft reactions (pressureJitter + pressureMiss). HARD+ still snap sharp.
  if (human.isAttacking && !human.isInStartupFrames) {
    const isCommittedToOffense = aiState.commitAction && currentTime < aiState.commitUntil && aiState.commitCount > 0;
    const pressureThreshold = typeof DIFF.pressureHitThreshold === "number"
      ? DIFF.pressureHitThreshold
      : AI_CONFIG.PRESSURE_HIT_THRESHOLD;
    const underPressure = aiState.consecutiveHitsTaken >= pressureThreshold;

    // Under pressure: break out of offensive commitment to defend
    if (!isCommittedToOffense || underPressure) {
      if (!aiState.reactionTarget) {
        aiState.reactionTarget = human.attackType || 'slap';
        aiState.reactionDetectTime = currentTime;
        aiState.reactionDelay = underPressure
          ? randomInRange(
              typeof DIFF.pressureJitterMin === "number" ? DIFF.pressureJitterMin : 0,
              typeof DIFF.pressureJitterMax === "number" ? DIFF.pressureJitterMax : AI_CONFIG.PRESSURE_JITTER_MAX
            )
          : randomInRange(DIFF.jitterMin, DIFF.jitterMax);
        aiState.reactionProcessed = false;
      }

      if (!aiState.reactionProcessed && currentTime - aiState.reactionDetectTime >= aiState.reactionDelay) {
        aiState.reactionProcessed = true;
        const missChance = underPressure ? DIFF.pressureMiss : DIFF.missChance;
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
  if (currentTime - aiState.lastDecisionTime < DIFF.decisionCooldown) {
    handleMovement(cpu, human, aiState, currentTime, distance);
    return;
  }
  
  // Priority 5.5: FLAP OFFENSE — take flight to slam an opponent (engage or punish
  // a whiff). EASY does not use power-ups offensively.
  if (DIFF.usePowerUps && handleFlapOffense(cpu, human, aiState, currentTime, distance)) {
    return;
  }

  // Priority 6: RING-OUT OPPORTUNITY - Opponent near edge!
  if (isOpponentNearEdge(human) && canAct(cpu)) {
    handleRingOutOpportunity(cpu, human, aiState, currentTime, distance);
    return;
  }
  
  // Priority 7: Offensive actions based on distance.
  // Close pocket uses live tip-connect (not a stale footsie constant) so the
  // CPU doesn't enter "mid" still short of body contact, or slap from mid air.
  if (canAttack(cpu) || canGrab(cpu)) {
    const slapEngage = getSlapInitiateRange(cpu, human);
    if (distance <= slapEngage) {
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

  // We see a grab action — react once with the correct counter.
  // HARD+ stays 50/50; EASY/NORMAL break less often (easier to throw them).
  resetAllKeys(cpu);
  const breakChance = typeof DIFF.grabBreakChance === "number" ? DIFF.grabBreakChance : 0.50;

  if (grabber.isAttemptingGrabThrow) {
    if (!aiState.grabBreakReactionDecided) {
      aiState.grabBreakReactionDecided = true;
      aiState.grabBreakReactS = Math.random() < breakChance;
    }
    if (aiState.grabBreakReactS) cpu.keys.s = true;
  } else if (grabber.isAttemptingPull) {
    if (!aiState.grabBreakReactionDecided) {
      aiState.grabBreakReactionDecided = true;
      aiState.grabBreakReactDirection = Math.random() < breakChance;
    }
    if (aiState.grabBreakReactDirection) cpu.keys[pullCounterKey] = true;
  }
}

// === Clinch behavior: push/plant/throw/pull decisions ===
// Handles both roles: grabber (isGrabbing) and grabbed (isBeingGrabbed).
// Reads opponent balance + position to pick optimal clinch actions.
function handleClinchBehavior(cpu, opponent, aiState, currentTime) {
  resetAllKeys(cpu);

  // PHASE 4.2: per-archetype clinch leans. balanced = neutral (identity), so a
  // non-archetype CPU runs the exact legacy clinch rolls below.
  const CS = CLINCH_STYLE[PERS_KEY] || CLINCH_STYLE.balanced;

  // During own committed technique / Open / jolt, wait it out
  if (cpu.clinchThrowActive || cpu.isClinchClashing || cpu.isClinchThrowing ||
      cpu.isClinchOpen || cpu.clinchThrowFailStagger ||
      cpu.isGrabSeparating ||
      cpu.isClinchJolting || cpu.isClinchJoltClashing || cpu.isBeingClinchJolted) {
    return;
  }

  // Opponent technique startup — maybe Plant (not a perfect human read).
  // Roll once per technique with a short reaction delay so throws can land
  // when the CPU whiffs the brace or is late.
  if (opponent.clinchThrowActive || opponent.isClinchThrowing) {
    const throwStamp =
      opponent.clinchThrowStartTime || opponent.clinchThrowRequestTime || 0;
    if (aiState.clinchBraceForThrowStart !== throwStamp) {
      aiState.clinchBraceForThrowStart = throwStamp;
      // Easy ~35%, Normal ~55%, Hard ~72%, Impossible ~88%
      const braceChance = clampChance(
        0.35 +
          (DIFF_KEY === "EASY"
            ? 0
            : DIFF_KEY === "NORMAL"
              ? 0.2
              : DIFF_KEY === "HARD"
                ? 0.37
                : 0.53) +
          CS.breakEager * 0.08
      );
      aiState.clinchBraceDecision = chance(braceChance) ? "plant" : "whiff";
      aiState.clinchBraceReadyTime =
        currentTime +
        randomInRange(
          Math.max(40, DIFF.jitterMin || 0),
          Math.max(90, (DIFF.jitterMax || 80) + 60)
        );
    }

    if (
      aiState.clinchBraceDecision === "plant" &&
      currentTime >= (aiState.clinchBraceReadyTime || 0)
    ) {
      const towardKeyBrace = cpu.x < opponent.x ? "d" : "a";
      const awayKeyBrace = cpu.x < opponent.x ? "a" : "d";
      // Hard/Impossible sometimes delay the Plant press into the Perfect Brace
      // window instead of holding from reaction start.
      const animMs = opponent.clinchThrowType === "pull" ? 250 : 220;
      const throwStart = opponent.clinchThrowStartTime || currentTime;
      const perfectWindowStart = throwStart + Math.max(0, animMs - 100);
      const wantPerfect =
        (DIFF_KEY === "HARD" || DIFF_KEY === "IMPOSSIBLE") &&
        chance(DIFF_KEY === "IMPOSSIBLE" ? 0.45 : 0.22);

      if (wantPerfect && currentTime < perfectWindowStart) {
        // Wait in neutral / prior stance until the window — then tap Plant.
        return;
      }

      cpu.keys[awayKeyBrace] = true;
      cpu.keys[towardKeyBrace] = false;
      cpu.keys.s = true;
      // Rising-edge stamp for Perfect Brace (CPU path has no socket events).
      if (!cpu.clinchBraceSimTime || cpu.clinchBraceSimTime < throwStart) {
        cpu.clinchBraceSimTime = currentTime;
      }
      return;
    }
    // Whiff / still reacting — stay committed to prior stance (don't auto-plant)
    return;
  } else if (aiState.clinchBraceForThrowStart) {
    aiState.clinchBraceForThrowStart = 0;
    aiState.clinchBraceDecision = null;
    aiState.clinchBraceReadyTime = 0;
  }
  if (opponent.isClinchClashing) {
    return;
  }

  // During burst push as grabber: let the short auto-shove ride.
  // ARM CLAMP exception: convert mid-burst is allowed (victim offense locked;
  // they can still Plant-brace). Cancels Phase A the same way as human input.
  if (cpu.isGrabPushing && !opponent.isArmClamped) {
    return;
  }

  // Positional awareness (toward/away relative to opponent position, not facing)
  const towardKey = cpu.x < opponent.x ? 'd' : 'a';
  const awayKey = cpu.x < opponent.x ? 'a' : 'd';

  // ARM CLAMP: offense locked for the punish burst. Plant brace remains —
  // sticky hold so a convert throw isn't automatic vs CPU either.
  if (cpu.isArmClamped) {
    if (!aiState.clinchClampPlantUntil || currentTime > aiState.clinchClampPlantUntil) {
      aiState.clinchClampPlantUntil = currentTime + randomInRange(280, 650);
      const plantChance = clampChance(
        0.40 +
          (DIFF_KEY === "EASY"
            ? -0.15
            : DIFF_KEY === "NORMAL"
              ? 0
              : DIFF_KEY === "HARD"
                ? 0.18
                : 0.32) +
          CS.breakEager * 0.1
      );
      aiState.clinchClampHoldPlant = hasVerb("plant") && chance(plantChance);
    }
    if (aiState.clinchClampHoldPlant) {
      cpu.keys[awayKey] = true;
      cpu.keys[towardKey] = false;
      cpu.keys.s = true;
    }
    return;
  } else if (aiState.clinchClampHoldPlant || aiState.clinchClampPlantUntil) {
    aiState.clinchClampHoldPlant = false;
    aiState.clinchClampPlantUntil = 0;
  }
  const cpuDistLeft = cpu.x - MAP_LEFT_BOUNDARY;
  const cpuDistRight = MAP_RIGHT_BOUNDARY - cpu.x;
  const oppDistLeft = opponent.x - MAP_LEFT_BOUNDARY;
  const oppDistRight = MAP_RIGHT_BOUNDARY - opponent.x;
  const cpuNearestEdge = Math.min(cpuDistLeft, cpuDistRight);
  const oppNearestEdge = Math.min(oppDistLeft, oppDistRight);

  // --- THROW / PULL DECISION ---
  // Grip is automatic on clinch connect — no grip-up delay.
  const opponentBalance = opponent.balance;
  const cpuBalance = cpu.balance;
  const cpuStamina = cpu.stamina;

  // PHASE 4.3: throw/pull are gated by the clinchThrow verb (Sandanme+). A
  // lower-division CPU can only push/plant in the clinch.
  const canRequestAction = cpu.hasGrip && !cpu.clinchThrowActive &&
                           !cpu.clinchThrowRequest &&
                           !cpu.isClinchClashing &&
                           !cpu.clinchThrowFailStagger && !cpu.isClinchOpen &&
                           !cpu.clinchJoltRecovery &&
                           hasVerb("clinchThrow");
  // Clinch Flow: every undefended technique lands. Plant resists unless Deep Grip.
  const opponentPlanting = opponent.clinchAction === "plant" || opponent.isClinchPlanting;
  const canLand = !opponentPlanting || !!cpu.hasDeepGrip;
  const canKill = opponentBalance < CLINCH_THROW_KILL_THRESHOLD;

  // Detect when CPU is the one pinned at the boundary (closer to edge than opponent)
  const cpuBackedToEdge = cpuNearestEdge < AI_CONFIG.EDGE_DANGER_ZONE && cpuNearestEdge < oppNearestEdge;

  // --- DEFENSIVE CLINCH BREAK (tech out of a lethal clinch) ---
  // High-tier only. When pinned at the edge and LOSING the balance war, the CPU
  // would otherwise get shoved/thrown out with no escape (it never broke clinch
  // before). Also fires when stamina is collapsing under edge pressure — Plant
  // does NOT recover stam (it drains), and gassing at the edge enables instant
  // ring-out. Spend Break only when affordable. Gated/interval-limited so it
  // can't be spammed. Mirrors the human input gates.
  const opponentPushingNow =
    opponent.clinchAction === "push" || opponent.isClinchPushing;
  const canAffordBreak = cpuStamina >= GRAB_BREAK_STAMINA_COST + 5;
  const losingBalanceWar =
    // CS.breakEager: the counter bails earlier (threshold 8 → ~2) — "breaks early".
    opponentBalance > cpuBalance + (8 - CS.breakEager * 20);
  const breakToAvoidGas =
    cpuStamina < AI_CONFIG.CLINCH_STAMINA_LOW &&
    opponentPushingNow &&
    !losingBalanceWar; // already covered by balance branch; this is the gas read
  if (
    DIFF.clinchBreakEscape &&
    cpu.hasGrip &&
    opponent.hasGrip &&
    cpuBackedToEdge &&
    (losingBalanceWar || breakToAvoidGas) &&
    canAffordBreak &&
    !cpu.isGassed &&
    !cpu.clinchThrowActive &&
    !cpu.isClinchClashing &&
    !cpu.isClinchJolting && !cpu.isClinchJoltClashing &&
    !cpu.clinchThrowFailStagger && !cpu.isClinchOpen &&
    !cpu.clinchBreakRequest && !cpu.isGrabBreaking && !cpu.isGrabBreakCountered &&
    !cpu.isGrabBreakSeparating &&
    (!cpu.gripAcquiredTime || currentTime - cpu.gripAcquiredTime >= GRAB_BREAK_REACTION_LOCK_MS)
  ) {
    if (currentTime - (aiState.lastClinchBreakCheck || 0) > 450) {
      aiState.lastClinchBreakCheck = currentTime;
      const breakChance = breakToAvoidGas
        ? clampChance(0.55 + CS.breakEager)
        : clampChance(0.75 + CS.breakEager);
      if (chance(breakChance)) {
        cpu.clinchBreakRequest = true;
        cpu.clinchBreakRequestTime = currentTime;
        aiState.lastActionType = breakToAvoidGas
          ? "clinch_break_gas_escape"
          : "clinch_break_escape";
        return;
      }
    }
  }

  // --- EDGE ESCAPE URGENCY ---
  // When backed against the boundary, throw/pull to escape instead of getting pushed off
  if (cpuBackedToEdge && canRequestAction && !aiState.clinchThrowPending) {
    const staminaDesperate = cpuStamina < 15;
    const staminaCritical = cpuStamina < 35;
    const edgeCheckInterval = staminaDesperate ? 150 : staminaCritical ? 300 : 500;

    if (currentTime - (aiState.clinchLastThrowCheck || 0) > edgeCheckInterval) {
      aiState.clinchLastThrowCheck = currentTime;
      const escapeChance = clampChance(
        (staminaDesperate ? 0.9 : staminaCritical ? 0.7 : 0.4) *
          DIFF.clinchEscapeBoost
      );

      if (chance(escapeChance)) {
        const action = chance(0.6) ? "throw" : "pull";
        const escapeDelay = staminaDesperate
          ? randomInRange(80, 180)
          : randomInRange(AI_CONFIG.CLINCH_THROW_REACTION_MIN, AI_CONFIG.CLINCH_THROW_REACTION_MAX);
        aiState.clinchThrowPending = action;
        aiState.clinchThrowExecuteTime = currentTime + escapeDelay;
      }
    }
  }

  // --- NORMAL THROW / PULL DECISION (when not in edge-escape) ---
  if (!aiState.clinchLastThrowCheck) aiState.clinchLastThrowCheck = 0;
  const checkInterval = canKill
    ? randomInRange(AI_CONFIG.CLINCH_KILL_ACTION_INTERVAL_MIN, AI_CONFIG.CLINCH_KILL_ACTION_INTERVAL_MAX)
    : randomInRange(AI_CONFIG.CLINCH_ACTION_INTERVAL_MIN, AI_CONFIG.CLINCH_ACTION_INTERVAL_MAX);
  const shouldCheckThrow = currentTime - aiState.clinchLastThrowCheck > checkInterval;

  if (canRequestAction && shouldCheckThrow && !aiState.clinchThrowPending) {
    aiState.clinchLastThrowCheck = currentTime;
    const aggMult = getAggressionMultiplier(aiState);

    if (canKill && canLand && chance(AI_CONFIG.CLINCH_THROW_CHANCE_KILL * Math.min(aggMult.grab, 1.3) * diffMult("clinchKillMult"))) {
      // CS.pullBias: grappler favors pull over the raw throw; pusher the reverse.
      const action = chance(clampChance(0.55 - CS.pullBias)) ? "throw" : "pull";
      aiState.clinchThrowPending = action;
      aiState.clinchThrowExecuteTime = currentTime + randomInRange(
        AI_CONFIG.CLINCH_THROW_REACTION_MIN,
        AI_CONFIG.CLINCH_THROW_REACTION_MAX
      );
    } else if (canLand && chance(AI_CONFIG.CLINCH_THROW_CHANCE_LAND * Math.min(aggMult.grab, 1.3) * diffMult("clinchLandMult"))) {
      const roll = Math.random();
      let action = null;
      // CS.pullBias shrinks the throw slice for grappler (spills into pull).
      if (roll < 0.55 - CS.pullBias) action = "throw";
      else if (roll < 0.85) action = "pull";
      if (action) {
        aiState.clinchThrowPending = action;
        aiState.clinchThrowExecuteTime = currentTime + randomInRange(
          AI_CONFIG.CLINCH_THROW_REACTION_MIN + 50,
          AI_CONFIG.CLINCH_THROW_REACTION_MAX + 100
        );
      }
    } else if (!canLand && chance(AI_CONFIG.CLINCH_THROW_CHANCE_FAIL * Math.min(aggMult.grab, 1.3) * 0.35)) {
      // Opponent is planting without our Deep Grip — rare bait; usually jolt instead.
      if (cpuBalance > 40 && cpu.hasDeepGrip) {
        const action = chance(0.6) ? "throw" : "pull";
        aiState.clinchThrowPending = action;
        aiState.clinchThrowExecuteTime = currentTime + randomInRange(
          AI_CONFIG.CLINCH_THROW_REACTION_MIN + 100,
          AI_CONFIG.CLINCH_THROW_REACTION_MAX + 200
        );
      }
    } else if (
      // Low stam: spend a preemptive technique while meters still allow it,
      // instead of grinding into Plant (which drains stam further).
      canLand &&
      cpuStamina < AI_CONFIG.CLINCH_STAMINA_LOW &&
      cpuBalance > opponentBalance + 8 &&
      chance(clampChance(0.40 * Math.min(aggMult.grab, 1.3)))
    ) {
      const action = chance(clampChance(0.55 - CS.pullBias)) ? "throw" : "pull";
      aiState.clinchThrowPending = action;
      aiState.clinchThrowExecuteTime = currentTime + randomInRange(
        AI_CONFIG.CLINCH_THROW_REACTION_MIN,
        AI_CONFIG.CLINCH_THROW_REACTION_MAX
      );
    }
  }

  // Execute pending throw/pull after reaction delay
  if (aiState.clinchThrowPending && currentTime >= aiState.clinchThrowExecuteTime) {
    if (canRequestAction) {
      // PHASE 4.3: pull (Makushita+) falls back to a plain throw when the CPU's
      // kit doesn't include it yet.
      let act = aiState.clinchThrowPending;
      if (act === "pull" && !hasVerb("pull")) act = "throw";
      if (act === "lift") act = "throw"; // legacy: lift removed
      cpu.clinchThrowRequest = act;
      cpu.clinchThrowRequestTime = currentTime;
    }
    aiState.clinchThrowPending = null;
    aiState.clinchThrowExecuteTime = 0;
  }

  // --- CLINCH JOLT DECISION (Mouse1 during clinch) ---
  // PHASE 4.3: clinch jolt is a Makushita+ verb.
  const canJolt = hasVerb("jolt") &&
                  cpu.hasGrip && !cpu.isClinchJolting && !cpu.clinchJoltRecovery &&
                  !cpu.clinchThrowActive && !cpu.isClinchClashing &&
                  !cpu.clinchJoltRequest && !cpu.isResistingThrow && !cpu.isResistingPull &&
                  !cpu.clinchThrowFailStagger && !cpu.isClinchOpen && cpuStamina >= 10;

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

      // CS.joltMult: brawler is jolt-happy (1.6), counter/grappler calmer.
      if (chance(clampChance(joltChance * CS.joltMult))) {
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

  // --- PUSH / PLANT / NEUTRAL DECISION (set keys for getClinchAction to read) ---
  // Resource identity (live): Stamina walks. Balance throws. Plant buys time.
  // Plant drains stamina (more under push) and regenerates Balance — it does NOT
  // recover stamina. Neutral is the only clinch stance that breathes stam back.
  // Stay neutral when a throw/jolt is pending or just submitted (avoid push penalty on throw)
  if (aiState.clinchThrowPending || cpu.clinchThrowRequest || aiState.clinchJoltPending || cpu.clinchJoltRequest) {
    return;
  }

  // Re-evaluate push/plant/neutral at intervals to avoid jittery tick-by-tick flipping
  if (!aiState.clinchPushPlantUntil || currentTime > aiState.clinchPushPlantUntil) {
    const opponentNearEdge = oppNearestEdge < AI_CONFIG.EDGE_DANGER_ZONE;
    const balanceAdvantage = cpuBalance - opponentBalance;
    const staminaDesperate = cpuStamina < AI_CONFIG.CLINCH_STAMINA_DESPERATE;
    const staminaLow = cpuStamina < AI_CONFIG.CLINCH_STAMINA_LOW;
    const balanceCritical = cpuBalance < 25;
    // Plant is a paid brake — only spend stam when Balance preservation matters.
    const plantWorthStaminaTax =
      balanceCritical && cpuStamina > 12 && !cpu.isGassed;

    let holdMs = randomInRange(
      AI_CONFIG.CLINCH_PUSH_PLANT_INTERVAL_MIN,
      AI_CONFIG.CLINCH_PUSH_PLANT_INTERVAL_MAX
    );

    if (cpuBackedToEdge) {
      // Edge: never Plant because stam is low — gassing enables instant ring-out.
      // Resist with push, or breathe in neutral if not under a shove and meters
      // are collapsing. Plant only when Balance itself is the lethal threat.
      aiState.clinchLightDrivePulse = false;
      if (plantWorthStaminaTax && !staminaDesperate) {
        aiState.clinchPushPlantDecision = "plant";
      } else if (staminaDesperate && !opponentPushingNow) {
        aiState.clinchPushPlantDecision = "neutral";
      } else {
        aiState.clinchPushPlantDecision = "push";
      }
    } else if (opponentNearEdge && cpuBalance > 30 && !staminaDesperate) {
      // Opponent near edge — push harder (edge zone amplifies balance drain)
      aiState.clinchPushPlantDecision = "push";
      aiState.clinchLightDrivePulse = false;
    } else if (plantWorthStaminaTax && !opponentNearEdge && !staminaDesperate) {
      aiState.clinchPushPlantDecision = "plant";
      aiState.clinchLightDrivePulse = false;
    } else if (staminaLow) {
      // Low stam: breathe (neutral), poke with a short Light Drive, or last-ditch
      // Plant only if Balance is about to open a kill. Never Plant to "recover".
      if (plantWorthStaminaTax && staminaDesperate) {
        aiState.clinchPushPlantDecision = "plant";
        aiState.clinchLightDrivePulse = false;
      } else if (aiState.clinchLightDrivePulse) {
        // Forced breath after a Light Drive so hold-time can't chain into Commit.
        aiState.clinchPushPlantDecision = "neutral";
        aiState.clinchLightDrivePulse = false;
        holdMs = randomInRange(220, 420);
      } else if (
        (opponentPushingNow && cpuStamina >= AI_CONFIG.CLINCH_STAMINA_DESPERATE) ||
        (!opponentPushingNow && balanceAdvantage > 5 && chance(0.35))
      ) {
        // Light Drive pulse — release before CLINCH_LIGHT_DRIVE_MS commits it.
        aiState.clinchPushPlantDecision = "push";
        aiState.clinchLightDrivePulse = true;
        holdMs = randomInRange(140, Math.max(160, CLINCH_LIGHT_DRIVE_MS - 40));
      } else {
        aiState.clinchPushPlantDecision = "neutral";
        aiState.clinchLightDrivePulse = false;
      }
    } else if (balanceAdvantage > 10) {
      aiState.clinchPushPlantDecision = "push";
      aiState.clinchLightDrivePulse = false;
    } else if (chance(clampChance(0.60 + CS.pushBias))) {
      // CS.pushBias: pusher leans push (0.80), counter leans plant (0.48).
      aiState.clinchPushPlantDecision = "push";
      aiState.clinchLightDrivePulse = false;
    } else if (chance(0.55)) {
      aiState.clinchPushPlantDecision = "plant";
      aiState.clinchLightDrivePulse = false;
    } else {
      aiState.clinchPushPlantDecision = "neutral";
      aiState.clinchLightDrivePulse = false;
    }

    aiState.clinchPushPlantUntil = currentTime + holdMs;
  }

  // PHASE 4.3: plant is a Jonidan+ verb — a Jonokuchi CPU only knows how to push.
  if (aiState.clinchPushPlantDecision === "plant" && !hasVerb("plant")) {
    aiState.clinchPushPlantDecision =
      cpuStamina < AI_CONFIG.CLINCH_STAMINA_LOW ? "neutral" : "push";
  }

  // Apply the push/plant/neutral decision via keys (neutral = no stance keys)
  if (aiState.clinchPushPlantDecision === "push") {
    cpu.keys[towardKey] = true;
  } else if (aiState.clinchPushPlantDecision === "plant") {
    cpu.keys.s = true;
    cpu.keys[awayKey] = true;
  }

}

// DI (Directional Influence) — EASY/NORMAL sometimes freeze or DI wrong so
// knockback isn't a free expert save. HARD+ always holds the correct opposite.
function handleKnockbackDI(cpu, aiState, currentTime) {
  const diChance = diffMult("diChance", 1);
  if (!chance(diChance)) {
    // Beginner DI: half the time do nothing, half the time hold the wrong way.
    if (chance(0.5)) {
      const knockbackDirection = cpu.knockbackVelocity.x > 0 ? 1 : -1;
      if (knockbackDirection > 0) {
        cpu.keys.a = false;
        cpu.keys.d = true;
      } else {
        cpu.keys.a = true;
        cpu.keys.d = false;
      }
      aiState.lastActionType = "knockback_di_wrong";
    } else {
      aiState.lastActionType = "knockback_di_whiff";
    }
    return;
  }
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
  // PHASE 4.3: active power-up usage is a Juryo+ verb.
  if (!hasVerb("powerUps")) return false;
  const snowballThrowsRemaining = cpu.snowballThrowsRemaining ?? 5;
  const pumoSpawnsRemaining = cpu.pumoArmySpawnsRemaining ?? 3;
  const hasSnowball = cpu.activePowerUp === "snowball" && snowballThrowsRemaining > 0 && !cpu.snowballCooldown && !cpu.isThrowingSnowball;
  const hasPumoArmy = cpu.activePowerUp === "pumo_army" && pumoSpawnsRemaining > 0 && !cpu.pumoArmyCooldown && !cpu.isSpawningPumoArmy;
  
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

// ============================================================
// FLAP POWER-UP AI
// ============================================================
// FLAP arms ice-slide → W takeoffs with air charges. No Space liftoff, no
// parry swap. Three pieces:
//   • pilotFlapFlight  — during FLAP-armed slide-jump: steer, W air-flaps, S dive
//   • handleFlapOffense — dodge into ice slide, then W jump when ready
//   • handleFlapDefense — react to opponent's FLAP-armed slide-jump slam

// Pick a horizontal flee direction away from the opponent, biased toward center
// so we don't dash ourselves off the edge.
function pickFleeDir(cpu, human) {
  let dir = cpu.x < human.x ? -1 : 1; // away from the opponent
  if (dir === -1 && distanceToLeftEdge(cpu) < 120) dir = 1;
  else if (dir === 1 && distanceToRightEdge(cpu) < 120) dir = -1;
  return dir;
}

function pilotFlapFlight(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  if (!cpu.isSlideJumping || cpu.slideJumpPhase !== "flight") return;

  const horiz = cpu.x - human.x; // + => cpu is to the right of the opponent
  const absH = Math.abs(horiz);
  const aligned = absH <= AI_CONFIG.FLAP_DIVE_ALIGN;
  const heightAbove = cpu.y - GROUND_LEVEL;
  const canAirFlap =
    (cpu.flapCharges || 0) > 0 &&
    !cpu.slideJumpHitLanded &&
    !cpu.slideJumpDiveCommitted &&
    currentTime - (cpu.lastFlapChargeTime || 0) >= FLAP_CHARGE_COOLDOWN_MS;

  cpu.facing = horiz > 0 ? 1 : -1;
  if (!aligned) {
    if (horiz > 0) cpu.keys.a = true;
    else cpu.keys.d = true;
  }

  if (aligned) aiState.flapDiveCommitted = true;

  if (aiState.flapDiveCommitted) {
    cpu.keys.s = true; // body-slam dive
    return;
  }

  if (canAirFlap && !aligned && heightAbove < AI_CONFIG.FLAP_DIVE_KEEP_HEIGHT) {
    cpu.keys.w = true;
    cpu.wJustPressed = true;
    if (horiz > 0) cpu.keys.a = true;
    else cpu.keys.d = true;
  }
}

function handleFlapOffense(cpu, human, aiState, currentTime, distance) {
  if (cpu.activePowerUp !== POWER_UP_TYPES.FLAP) return false;
  if (cpu.isSlideJumping) return false;
  if (!canAct(cpu)) return false;
  if (cpu.isGassed || cpu.stamina < FLAP_STAMINA_COST + 8) return false;
  if (currentTime - (aiState.lastFlapTime || 0) < AI_CONFIG.FLAP_COOLDOWN) return false;
  if (human.isAttacking) return false;

  const horiz = Math.abs(cpu.x - human.x);
  const punishing =
    (human.isRecovering ||
      human.isInEndlag ||
      human.isWhiffingGrab ||
      human.isGrabWhiffRecovery ||
      human.isRawParryStun) &&
    horiz < AI_CONFIG.FLAP_PUNISH_RANGE;
  const engage = horiz >= AI_CONFIG.FLAP_MIN_RANGE && horiz <= AI_CONFIG.FLAP_MAX_RANGE;
  if (!punishing && !engage) return false;

  // Already ice-sliding → takeoff
  if (cpu.isIceSliding) {
    resetAllKeys(cpu);
    cpu.keys.shift = true; // stay in slide
    cpu.keys.w = true;
    cpu.wJustPressed = true;
    if (cpu.x < human.x) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastFlapTime = currentTime;
    aiState.flapDiveCommitted = false;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "flap_slide_jump";
    return true;
  }

  // Start / continue a dodge into ice slide toward the opponent
  if (!canDodge(cpu) && !cpu.isDodging) return false;

  const aggMult = getAggressionMultiplier(aiState);
  const useChance = punishing ? 0.85 : AI_CONFIG.FLAP_USE_CHANCE * aggMult.attack;
  if (!chance(useChance) && !cpu.isDodging) {
    aiState.lastFlapTime = currentTime - AI_CONFIG.FLAP_COOLDOWN + 600;
    return false;
  }

  resetAllKeys(cpu);
  cpu.keys.shift = true;
  if (cpu.x < human.x) cpu.keys.d = true;
  else cpu.keys.a = true;
  aiState.shiftReleaseTime = 0; // hold through land into ice slide
  aiState.lastFlapTime = currentTime;
  aiState.flapDiveCommitted = false;
  aiState.lastDecisionTime = currentTime;
  aiState.lastActionType = "flap_slide_setup";
  return true;
}

function handleFlapDefense(cpu, human, aiState, currentTime, distance) {
  // Air body hitbox is live for the whole flight (parryable). Hurtbox stays
  // immune until land — so: parry/dodge the body, punish landing, don't grab-fish.
  const inFlight =
    human.isSlideJumping && human.slideJumpPhase === "flight";
  const landing =
    human.isSlideJumping && human.slideJumpPhase === "landing";

  if (!inFlight && !landing) return false;
  if (cpu.isSlideJumping && cpu.slideJumpPhase === "flight") return false;
  if (!canAct(cpu)) return false;

  const horiz = Math.abs(cpu.x - human.x);
  const flapperHeight = human.y - GROUND_LEVEL;
  const descending =
    (human.slideJumpVelocityY ?? 0) <= 0 || !!human.slideJumpDiveCommitted;
  // Matches FLAP_BODYSLAM_CONTACT_HEIGHT — descending body only.
  const bodyThreat =
    inFlight &&
    descending &&
    flapperHeight <= 100 &&
    !human.slideJumpHitLanded;

  if (aiState.flapReactTarget !== (landing ? "land" : bodyThreat ? "body" : "air")) {
    aiState.flapReactTarget = landing ? "land" : bodyThreat ? "body" : "air";
    aiState.flapReactDetectTime = currentTime;
    aiState.flapReactDelay = randomInRange(DIFF.jitterMin, DIFF.jitterMax);
    aiState.flapReactProcessed = false;
  }

  // High / clearing flight — just create space (no empty-air swings).
  if (inFlight && !bodyThreat) {
    if (
      horiz < AI_CONFIG.FLAP_DEF_RANGE * 1.5 &&
      currentTime - aiState.lastDecisionTime > DIFF.decisionCooldown
    ) {
      resetAllKeys(cpu);
      const dir = pickFleeDir(cpu, human);
      if (dir === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "flap_evade";
      return true;
    }
    return false;
  }

  if (aiState.flapReactProcessed) return false;
  if (currentTime - aiState.flapReactDetectTime < aiState.flapReactDelay) return false;
  aiState.flapReactProcessed = true;

  const roll = Math.random();
  const flapDodgeChance = clampChance(AI_CONFIG.FLAP_DODGE_CHANCE * DIFF.flapDefMult);
  const flapParryChance = clampChance(AI_CONFIG.FLAP_PARRY_CHANCE * DIFF.flapDefMult);

  // Body-threat flight — parry the air hitbox; dodge as backup.
  if (bodyThreat) {
    if (
      canParry(cpu) &&
      horiz < AI_CONFIG.FLAP_DEF_RANGE &&
      roll < flapParryChance + 0.3
    ) {
      resetAllKeys(cpu);
      cpu.keys.s = true;
      aiState.pendingParry = true;
      aiState.parryStartTime = currentTime;
      aiState.parryReleaseTime = currentTime + randomInRange(120, 220);
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "flap_parry";
      return true;
    }
    if (canDodge(cpu) && roll < flapDodgeChance + flapParryChance) {
      resetAllKeys(cpu);
      cpu.keys.shift = true;
      const dir = pickFleeDir(cpu, human);
      if (dir === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.shiftReleaseTime = currentTime + 80;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "flap_dash";
      return true;
    }
    // Create space if we didn't commit a read.
    resetAllKeys(cpu);
    const dir = pickFleeDir(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "flap_evade";
    return true;
  }

  // Landing recovery — punish with slap when in tip range.
  if (
    landing &&
    canInitiateSlap(cpu, human, horiz) &&
    canAttack(cpu) &&
    roll < 0.7
  ) {
    resetAllKeys(cpu);
    cpu.keys.mouse1 = true;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "flap_land_punish";
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
      if (roll < 0.65 * aggMult.grab * diffMult("edgeGrabMult")) {
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
    } else if (roll < 0.55 * diffMult("offenseGrabMult") && canGrab(cpu)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab";
        return true;
      }
    }
    if (canAttack(cpu)) {
      if (chance(0.5 * diffMult("burstChanceMult"))) {
        startCommitment(aiState, 'slap_burst', diffBurstCount(2, 4), currentTime);
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
        hasVerb("sidestep") && // PHASE 4.3: sidestep is a Makushita+ verb
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
        hasVerb("ropeJump") && // PHASE 4.3: rope jump is a Juryo+ verb
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

// ── PHASE 3.3: CORNER-ANSWER MENU DISPATCHER ────────────────────────────────
// Rolls ONE decision per corner entry (then honors CORNER_DECISION_COOLDOWN_MS)
// from the escape/palm/parry/fight/grab menu. Escape is only offered while the
// per-round budget remains; spent → it collapses into "fight". Returns false
// (fall through to the defensive pipeline) when on cooldown or when a chosen
// answer can't execute, so a cornered CPU never tunnel-visions.
function handleCornerAnswer(cpu, human, aiState, currentTime, distance, corneredSide) {
  const freshEntry = !aiState.cornerActiveLast;
  aiState.cornerActiveLast = true;

  // Honor the cooldown except on a fresh corner entry (which always re-decides).
  if (!freshEntry &&
      aiState.lastCornerDecisionTime &&
      currentTime - aiState.lastCornerDecisionTime < AI_CONFIG.CORNER_DECISION_COOLDOWN_MS) {
    return false; // fall through — stay reactive while we "hold" the corner
  }
  aiState.lastCornerDecisionTime = currentTime;

  const hasBudget = (aiState.cornerEscapeBudget || 0) > 0;

  // PHASE 4.2: personality-flavored corner menu (converged at the top band).
  // balanced === the Phase 3 corner baseline, so non-BASHO is unchanged.
  const cornerKeys = ['escape', 'palm', 'parry', 'fight', 'grab'];
  const w = resolvePolicy(CORNER_POLICY, cornerKeys);
  let choice = weightedPick(w, cornerKeys);
  // Budget exhausted → corner answers only (escape → fight out).
  if (choice === 'escape' && !hasBudget) choice = 'fight';

  if (choice === 'escape') {
    const acted = handleCornerEscape(cpu, human, aiState, currentTime, distance, corneredSide);
    // Only a REAL escape (sidestep / rope jump) spends the budget; slaps/grabs/
    // walking that handleCornerEscape may fall back to do not.
    if (acted && (aiState.lastActionType === 'sidestep_escape' || aiState.lastActionType === 'rope_jump')) {
      aiState.cornerEscapeBudget = Math.max(0, (aiState.cornerEscapeBudget || 0) - 1);
    }
    return acted;
  }

  if (choice === 'palm') {
    if (tryPalmThrust(cpu, human, aiState, currentTime, distance, 'corner')) return true;
    return cornerFight(cpu, human, aiState, currentTime, distance);
  }

  if (choice === 'parry') {
    if (canParry(cpu)) {
      resetAllKeys(cpu);
      cpu.keys.s = true;
      aiState.pendingParry = true;
      aiState.parryReleaseTime = currentTime + randomInRange(200, 320);
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = 'corner_parry';
      return true;
    }
    return cornerFight(cpu, human, aiState, currentTime, distance);
  }

  if (choice === 'grab') {
    if (canGrab(cpu)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) { aiState.lastActionType = 'corner_grab'; return true; }
    }
    return cornerFight(cpu, human, aiState, currentTime, distance);
  }

  // fight
  return cornerFight(cpu, human, aiState, currentTime, distance);
}

// "Fight out of the corner" — slap at range, else advance into the opponent.
function cornerFight(cpu, human, aiState, currentTime, distance) {
  if (distance < AI_CONFIG.SLAP_RANGE && canAttack(cpu)) {
    if (chance(0.5 * diffMult("burstChanceMult"))) {
      startCommitment(aiState, 'slap_burst', diffBurstCount(2, 4), currentTime);
    }
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = 'corner_fight';
    return true;
  }
  // Out of slap range — step toward the opponent to contest the space.
  const dir = getDirectionToOpponent(cpu, human);
  if (dir === 1) cpu.keys.d = true;
  else cpu.keys.a = true;
  aiState.lastDecisionTime = currentTime;
  aiState.lastActionType = 'corner_advance';
  return true;
}

// ── PHASE 3.4: PALM THRUST ──────────────────────────────────────────────────
// Shared executor. Queues the back+mouse1 palm for processCPUInputs and stamps
// the shared cooldown. Faces the opponent first so the rooted thrust fires the
// right way. Gated by canAttack + stamina + gassed + the PALM_DECISION_COOLDOWN.
function tryPalmThrust(cpu, human, aiState, currentTime, distance, context) {
  if (!hasVerb("palm")) return false; // PHASE 4.3: palm is a Sandanme+ verb
  if (currentTime - aiState.lastPalmTime < AI_CONFIG.PALM_DECISION_COOLDOWN_MS) return false;
  if (!canAttack(cpu) || cpu.isGassed || cpu.stamina < PALM_THRUST_STAMINA_COST) return false;
  // Rooted — never fire outside connect reach (corner/edge menus used to).
  const maxReach =
    getConnectDistance("palm", cpu, human) + AI_CONFIG.PALM_COUNTERPOKE_REACH_SLACK;
  if (distance > maxReach) return false;

  resetAllKeys(cpu);
  cpu.facing = cpu.x < human.x ? -1 : 1; // face the opponent (palm auto-corrects too)
  cpu.keys.mouse1 = true;
  cpu.palmThrustQueued = true;           // consumed in processCPUInputs → executePalmThrust
  aiState.mouse1ReleaseTime = currentTime + 40;
  aiState.lastPalmTime = currentTime;
  aiState.lastDecisionTime = currentTime;
  aiState.lastActionType = 'palm_' + (context || 'poke');
  return true;
}

// Standalone palm priority: edge finisher (opponent pinned at the rope) and the
// anti-mash counter-poke (opponent spamming slaps at poke range). Neutral-only
// so it doesn't steal a defensive reaction to a live attack.
function handlePalmUsage(cpu, human, aiState, currentTime, distance) {
  if (!hasVerb("palm")) return false; // PHASE 4.3: palm is a Sandanme+ verb
  if (!canAttack(cpu)) return false;
  // Don't poke into a live active attack — that's the reaction pipeline's job.
  if (human.isAttacking && !human.isInStartupFrames) return false;

  // Edge finisher: opponent within SLAP_KILL_RANGE of the rope on the CPU's
  // facing side — a rooted palm shoves them out. (facing 1 = left, -1 = right.)
  const opponentFrontEdgeDist = cpu.facing === 1
    ? human.x - MAP_LEFT_BOUNDARY
    : MAP_RIGHT_BOUNDARY - human.x;
  const opponentInFront = cpu.facing === 1 ? human.x < cpu.x : human.x > cpu.x;
  // MASTERY Phase 2 (2.5): hunt broken posture with the oshi edge-thrust (pusher
  // ×1.5). Chance is clamped so the boosted value can't exceed 1.
  const edgeFinishChance = Math.min(
    1,
    AI_CONFIG.PALM_EDGE_FINISH_CHANCE * postureHuntPalmMult(human) * diffMult("palmEdgeMult")
  );
  if (opponentInFront && opponentFrontEdgeDist <= SLAP_KILL_RANGE &&
      distance < AI_CONFIG.MID_RANGE && chance(edgeFinishChance)) {
    if (tryPalmThrust(cpu, human, aiState, currentTime, distance, 'edge')) return true;
  }

  // Anti-mash counter-poke: opponent slapped >= threshold in the rolling window
  // and we're at poke range (too close = slap/grab, too far = whiff). Cap at
  // real palm connect so the CPU stops thrusting into empty air.
  const slapSpam = aiState.opponentSlapTimes.length >= AI_CONFIG.PALM_SLAP_SPAM_THRESHOLD;
  const palmReach =
    getConnectDistance("palm", cpu, human) + AI_CONFIG.PALM_COUNTERPOKE_REACH_SLACK;
  if (slapSpam &&
      distance >= AI_CONFIG.PALM_COUNTERPOKE_MIN_RANGE &&
      distance <= palmReach &&
      chance(AI_CONFIG.PALM_COUNTERPOKE_CHANCE * diffMult("palmPokeMult"))) {
    if (tryPalmThrust(cpu, human, aiState, currentTime, distance, 'poke')) return true;
  }

  return false;
}

// Handle ring-out opportunity when opponent is near edge
// High-tier punish: when the human is in a recovery/whiff/endlag state, close
// the gap and land the highest-value option in range (grab → clinch throw, else
// slap). This is the "attack smarter" lever — a strong human player always
// punishes a whiffed grab or a blocked/recovered attack; now IMPOSSIBLE does too.
// ── PARRY RESPONSE (rank-gated read of the HUMAN's raw parry) ───────────────
// Grab is the correct RPS answer to Space — but it must feel like a READ, not
// input-watching. Rules that keep the human's parry honest:
//   • one roll per stance enter (re-taps while holding do NOT re-roll)
//   • real reaction delay (130–380ms by rank) — never a ~60ms psychic cancel
//   • never interrupt our own slap burst / active attack to grab
//   • only grab if ALREADY in range when the delay matures (no walk-into-Space)
// Decline → fall through and keep pressing INTO the stance so parry pays off.
function handleParryResponse(cpu, human, aiState, currentTime, distance) {
  if (!human.isRawParrying) {
    aiState.parryResponseActive = false;
    aiState.parryResponseGrab = false;
    aiState.parryResponseFireAt = 0;
    return false;
  }

  // Finish what we started. Canceling a string the frame Space goes down is
  // exactly the "they're reading my inputs" feel.
  const committed =
    (aiState.commitAction &&
      currentTime < aiState.commitUntil &&
      aiState.commitCount > 0) ||
    cpu.isAttacking ||
    cpu.isChargingAttack ||
    cpu.isGrabStartup ||
    cpu.isInStartupFrames ||
    cpu.isInEndlag ||
    cpu.isGrabbingMovement;
  if (committed) return false;

  // One roll per continuous stance — not per re-arm / re-tap.
  if (!aiState.parryResponseActive) {
    aiState.parryResponseActive = true;
    const punishChance =
      typeof DIFF.parryPunishChance === "number" ? DIFF.parryPunishChance : 0.1;
    aiState.parryResponseGrab = chance(punishChance);
    const delayMin =
      typeof DIFF.parryPunishDelayMin === "number" ? DIFF.parryPunishDelayMin : 160;
    const delayMax =
      typeof DIFF.parryPunishDelayMax === "number" ? DIFF.parryPunishDelayMax : 260;
    aiState.parryResponseFireAt =
      currentTime + randomInRange(delayMin, Math.max(delayMin, delayMax));
  }

  if (!aiState.parryResponseGrab) return false;
  if (currentTime < aiState.parryResponseFireAt) return false;
  if (!canGrab(cpu) || !isFacingOpponent(cpu, human)) return false;

  // Already in grab range → punish. Otherwise DROP the read (don't walk into
  // a rooted parrier and freeze the offense).
  if (distance <= AI_CONFIG.GRAB_RANGE) {
    resetAllKeys(cpu);
    cpu.facing = cpu.x < human.x ? -1 : 1;
    cpu.keys.mouse2 = true;
    aiState.mouse2ReleaseTime = currentTime + 50;
    aiState.lastActionType = "parry_grab_punish";
    aiState.lastDecisionTime = currentTime;
    aiState.parryResponseGrab = false; // spent
    return true;
  }

  aiState.parryResponseGrab = false;
  return false;
}

function handleWhiffPunish(cpu, human, aiState, currentTime, distance) {
  if (!canAct(cpu)) return false;
  const punishable =
    human.isRecovering ||
    human.isInEndlag ||
    human.isWhiffingGrab ||
    human.isGrabWhiffRecovery ||
    human.isRawParryStun;
  if (!punishable) return false;

  // Out of range — sprint into punish range (don't burn the window strafing).
  if (distance > AI_CONFIG.GRAB_APPROACH_RANGE) {
    resetAllKeys(cpu);
    cpu.facing = cpu.x < human.x ? -1 : 1;
    if (getDirectionToOpponent(cpu, human) === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "whiff_chase";
    return true;
  }

  resetAllKeys(cpu);
  cpu.facing = cpu.x < human.x ? -1 : 1;
  // Grab is the highest-value punish (converts to a clinch throw); fall back to a
  // slap if a grab isn't available this frame.
  if (canGrab(cpu) && distance < AI_CONFIG.GRAB_RANGE) {
    cpu.keys.mouse2 = true;
    aiState.lastActionType = "whiff_grab_punish";
  } else if (canAttack(cpu) && canInitiateSlap(cpu, human, distance)) {
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastActionType = "whiff_slap_punish";
  } else if (canAttack(cpu) || canGrab(cpu)) {
    // In approach band but not tip-connect yet — chase, don't whiff the punish.
    if (getDirectionToOpponent(cpu, human) === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "whiff_chase";
  } else {
    return false;
  }
  aiState.lastDecisionTime = currentTime;
  return true;
}

function handleRingOutOpportunity(cpu, human, aiState, currentTime, distance) {
  resetAllKeys(cpu);
  
  const roll = Math.random();
  const aggMult = getAggressionMultiplier(aiState);
  const ringMult = diffMult("ringOutMult");
  
  if (canInitiateSlap(cpu, human, distance) && canAttack(cpu)) {
    // Smart grab decision: if opponent low stamina, grab is almost guaranteed win via push
    const opponentLowStamina = human.stamina < AI_CONFIG.LOW_STAMINA_THRESHOLD;
    const grabChance = (opponentLowStamina ? 0.60 : 0.40) * postureHuntGrabMult(human) * ringMult;
    
    if (roll < grabChance * aggMult.grab && canGrab(cpu)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab";
        return;
      }
    }
    if (roll < 0.85 * aggMult.attack * Math.max(0.55, ringMult)) {
      if (chance(0.55 * diffMult("burstChanceMult"))) {
        startCommitment(aiState, 'slap_burst', diffBurstCount(3, 5), currentTime);
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return;
    } else {
      // Burst pressure: repeated slaps to walk the opponent toward the edge
      // EASY often falls through to a single slap instead of a kill string.
      if (chance(Math.max(0.25, ringMult))) {
        startCommitment(aiState, 'slap_burst', diffBurstCount(2, 4), currentTime);
      }
      cpu.keys.mouse1 = true;
      aiState.mouse1ReleaseTime = currentTime + 40;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "slap";
      return;
    }
  }
  
  // Mid-range (outside tip-connect): walk/dash in — don't slap-whiff the finish.
  if (distance < AI_CONFIG.MID_RANGE) {
    const midRoll = Math.random();
    const dirToOpponent = getDirectionToOpponent(cpu, human);

    if (midRoll < 0.80 && canGrab(cpu) && chance(ringMult)) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab_ringout";
        aiState.lastDecisionTime = currentTime;
        return;
      }
    }

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

// How far an incoming strike can still threaten the CPU. Uses art-tip connect
// distance so we don't raw-parry into empty air (old charged bucket was 280px —
// palm is rooted ~126px, so that produced constant out-of-range whiff parries).
// Small slack covers ice drift / reaction delay; charged keeps a larger buffer
// because the lunge can still close space during ACTIVE.
function getIncomingAttackThreatRange(human, cpu) {
  const kind = attackKindFromPlayer(human);
  const connect = getConnectDistance(kind, human, cpu);
  if (kind === "palm") return connect + 14;
  if (kind === "slap") return connect + 20;
  // Charged lunge — connect alone underestimates remaining travel.
  if (kind === "charged") return Math.max(connect + 90, AI_CONFIG.CHARGED_ATTACK_RANGE);
  return connect + 20;
}

// Max distance the CPU should PRESS a slap — tip connect + ice-drift slack.
// Mid-range used to fire from ~185–200px while tip connect is ~133px, which
// looked "in range" on camera but systematically whiffed.
function getSlapInitiateRange(cpu, human) {
  return getConnectDistance("slap", cpu, human) + AI_CONFIG.SLAP_REACH_SLACK;
}

function canInitiateSlap(cpu, human, distance) {
  return distance <= getSlapInitiateRange(cpu, human);
}

// Handle defensive reactions — dodge restricted to charged attacks only
// Dodge has NO i-frames vs slaps, so using it defensively vs slaps is a waste.
// underPressure: true when the AI has taken 3+ consecutive hits (boosted parry chance)
function handleDefensiveReaction(cpu, human, aiState, currentTime, distance, underPressure = false) {
  const reactionCooldown = underPressure ? 150 : 250;
  if (currentTime - aiState.lastAttackReactionTime < reactionCooldown) {
    return false;
  }
  
  const attackRange = getIncomingAttackThreatRange(human, cpu);
  if (distance > attackRange) return false;
  
  const aggMult = getAggressionMultiplier(aiState);
  const roll = Math.random();
  
  // In aggressive mode, sometimes trade hits instead of defending
  // But NOT when under pressure — the AI has learned to stop trading into a barrage
  if (!underPressure && aiState.aggressionMode === 'aggressive' && canInitiateSlap(cpu, human, distance) && canAttack(cpu) && roll < 0.30) {
    resetAllKeys(cpu);
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "trade_slap";
    return true;
  }
  
  const parryChance = clampChance(
    (underPressure
      ? AI_CONFIG.PRESSURE_PARRY_BOOST
      : AI_CONFIG.PARRY_CHANCE * aggMult.defense) * DIFF.parryMult
  );
  
  if (roll < parryChance && canParry(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.s = true;
    aiState.lastAttackReactionTime = currentTime;
    aiState.lastDecisionTime = currentTime;
    aiState.pendingParry = true;
    aiState.parryStartTime = currentTime;
    // Shorter hold = tighter perfect parry timing + less vulnerability after.
    // perfectParry tiers hold a tight window aimed at the perfect-parry frames
    // (which grant a punish), instead of the looser "safe" hold.
    aiState.parryReleaseTime = currentTime + (DIFF.perfectParry
      ? randomInRange(55, 95)
      : underPressure ? randomInRange(60, 120) : randomInRange(100, 220));
    return true;
  }
  
  // Dodge ONLY vs charged attacks — dodge has i-frames vs charged but NOT vs slaps
  if (human.attackType === 'charged') {
    const dodgeChance = clampChance(AI_CONFIG.DODGE_CHANCE * aggMult.defense * DIFF.dodgeMult);
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
  const parryChance = clampChance(
    (distance > AI_CONFIG.MID_RANGE
      ? AI_CONFIG.SNOWBALL_PARRY_CHANCE * 0.85
      : AI_CONFIG.SNOWBALL_PARRY_CHANCE) * DIFF.snowballParryMult
  );
  
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

// Start a commitment (burst of actions)
function startCommitment(aiState, action, count, currentTime) {
  aiState.commitAction = action;
  aiState.commitCount = count;
  aiState.commitUntil = currentTime + count * 250 + 500;
}

// Handle committed action sequences
function handleCommitment(cpu, human, aiState, currentTime, distance) {
  // === Slap burst (individual presses — each one contestable) ===
  if (aiState.commitAction === 'slap_burst') {
    const slapEngage = getSlapInitiateRange(cpu, human);
    if (canInitiateSlap(cpu, human, distance) && canAttack(cpu)) {
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
    } else if (distance < slapEngage + 50) {
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
    const grabChance = (opponentLow ? 0.55 : 0.40) * postureHuntGrabMult(human) * diffMult("edgeGrabMult");
    if (roll < grabChance * aggMult.grab) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab";
        return;
      }
    }
  }
  
  // MID-SCREEN GRABS — use them more often but not always (must be point-blank)
  if (roll < 0.22 * aggMult.grab * postureHuntGrabMult(human) * diffMult("offenseGrabMult") && canGrab(cpu)) {
    const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
    if (result) {
      aiState.lastActionType = "grab";
      return;
    }
  }
  
  // SLAP BURST — commit to a flurry of individual presses (each contestable)
  if (roll < 0.22 + AI_CONFIG.COMMIT_BURST_CHANCE * aggMult.attack * diffMult("burstChanceMult") && canAttack(cpu)) {
    const burstCount = diffBurstCount(AI_CONFIG.COMMIT_SLAP_BURST_MIN, AI_CONFIG.COMMIT_SLAP_BURST_MAX);
    startCommitment(aiState, 'slap_burst', burstCount, currentTime);
    cpu.keys.mouse1 = true;
    aiState.mouse1ReleaseTime = currentTime + 40;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "burst_start";
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

  // MASTERY Phase 1 (1.7): momentum entries at HARD+. In the 160–260px footsie
  // band, a flat-footed slap now wastes the phase's whole point — so instead of
  // pressing from a standstill, the CPU first GENERATES momentum (dash-in when
  // available, else a committed walk-in) so the slap it throws next cycle
  // inherits real slide/knockback. Once it's already moving (velocity built up),
  // it falls through to the normal offense below and slaps WITH that momentum.
  // Gated to HARD+ (EASY/NORMAL press flat as today) and behind the flag ⇒
  // flag off / EASY / NORMAL are byte-identical.
  if (
    MASTERY_P1_MOMENTUM &&
    isHardPlusTier() &&
    distance >= 160 && distance <= 260 &&
    Math.abs(cpu.movementVelocity || 0) < 0.5 &&
    canAttack(cpu)
  ) {
    const dirToOpponent = getDirectionToOpponent(cpu, human);
    if (canDodge(cpu) && chance(0.5)) {
      // Dash-in: the biggest runway-free momentum generator (walk→dodge→slap).
      cpu.keys.shift = true;
      if (dirToOpponent === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      aiState.shiftReleaseTime = currentTime + 80;
      aiState.lastDecisionTime = currentTime;
      aiState.lastActionType = "momentum_dash_in";
      return;
    }
    // Walk-in: build ground speed for a momentum slap on the next cycle.
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "momentum_walk_in";
    return;
  }
  
  // MID-SCREEN GRABS — walk into range, then grab
  if (distance < AI_CONFIG.GRAB_APPROACH_RANGE && canGrab(cpu)) {
    const grabChance = (opponentLow ? 0.35 : AI_CONFIG.GRAB_MID_SCREEN_CHANCE)
      * postureHuntGrabMult(human) * diffMult("offenseGrabMult");
    if (roll < grabChance * aggMult.grab) {
      const result = attemptGrabOrApproach(cpu, human, aiState, currentTime, distance);
      if (result) {
        aiState.lastActionType = "grab_mid";
        return;
      }
    }
  }

  // Mid-range is OUTSIDE tip-connect by definition (close pocket handles
  // engage). Never slap from here — approach / dash in until connect range.
  const dirToOpponent = getDirectionToOpponent(cpu, human);
  if (canDodge(cpu) && chance(0.15) && aiState.aggressionMode === 'aggressive') {
    cpu.keys.shift = true;
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.shiftReleaseTime = currentTime + 80;
    aiState.lastDecisionTime = currentTime;
    aiState.lastActionType = "dodge_approach";
    return;
  }
  if (roll < 0.75) {
    if (dirToOpponent === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    aiState.lastActionType = "approach";
  } else {
    handleMovement(cpu, human, aiState, currentTime, distance);
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

// MASTERY Phase 3 (tsuppari cadence) — the fraction of a CPU's follow-up slaps
// timed INTO the cadence window, by difficulty tier (cross-phase CPU table:
// EASY 0 / NORMAL 25 / HARD 60 / IMPOSSIBLE 92). EASY never cadences — the
// overhaul raises the ceiling, not the floor (difficulty firewall). DIFF_KEY is
// always one of the four band names (discrete tier or BASHO ladder band).
function cpuCadenceFraction() {
  switch (DIFF_KEY) {
    case "EASY": return CPU_CADENCE_EASY;
    case "NORMAL": return CPU_CADENCE_NORMAL;
    case "IMPOSSIBLE": return CPU_CADENCE_IMPOSSIBLE;
    case "HARD":
    default: return CPU_CADENCE_HARD;
  }
}

// While the CPU is mid-slap, SCHEDULE its next M1 press. For a tier-dependent
// fraction of cycles the buffered press is timed to land near cycle end (gap ≤
// CADENCE_WINDOW_MS → enhanced follow-up, graded by endSlapCycle exactly like a
// human's); otherwise it buffers early (mash → normal). This reuses the human
// buffer path (pendingSlapCount + pendingSlapPressTime) so there is ONE cadence
// code path, judged on the sim clock. Fully gated on MASTERY_P3_CADENCE: with
// the flag off the CPU never buffers here and keeps today's fresh-press slap
// chaining, so VS CPU / BASHO are byte-identical.
function scheduleCpuCadence(cpu, human, currentTime) {
  if (!MASTERY_P3_CADENCE || !human) return;
  const aiState = getAIState(cpu.id);

  // Only during our OWN active slap.
  if (!cpu.isAttacking || cpu.attackType !== "slap") {
    aiState.cadenceCycleKey = 0;
    return;
  }

  const cycleKey = cpu.attackStartTime || 0;
  if (aiState.cadenceCycleKey !== cycleKey) {
    // First look at this slap cycle — decide once whether to continue the
    // tsuppari and, if so, whether THIS follow-up is timed into the window.
    aiState.cadenceCycleKey = cycleKey;
    aiState.cadenceBuffered = false;
    aiState.cadenceBufferAt = 0;

    const distance = Math.abs(cpu.x - human.x);
    // Keep buffering follow-ups even if they raised Space — aborting the string
    // the instant they parry was the "CPU stops when I defend" tell. Pressing
    // INTO a tap-parry is what makes the human's read pay; chip into a hold is
    // fine too. (Grab-punish is handleParryResponse's job, after delay.)
    const wantContinue =
      canInitiateSlap(cpu, human, distance) &&
      cpu.stamina > SLAP_ATTACK_STAMINA_COST &&
      !human.isDead;

    if (wantContinue) {
      const cycleEnd = cpu.attackCooldownUntil || (currentTime + SLAP_TOTAL_MS);
      if (Math.random() < cpuCadenceFraction()) {
        // In-window: land the buffered press inside the last CADENCE_WINDOW_MS,
        // with a small pad on each side so 16ms tick granularity + the +0 whiff
        // extension don't push it out of the window.
        const jitter = randomInRange(8, Math.max(9, CADENCE_WINDOW_MS - 12));
        aiState.cadenceBufferAt = cycleEnd - jitter;
      } else {
        // Mash: buffer early so the gap exceeds the window (normal slap).
        aiState.cadenceBufferAt = currentTime + randomInRange(0, 25);
      }
    }
  }

  // Release the scheduled buffer once its moment arrives (once per cycle). This
  // is the CPU's "press" — endSlapCycle fires it and grades the gap.
  if (
    aiState.cadenceBufferAt > 0 &&
    !aiState.cadenceBuffered &&
    currentTime >= aiState.cadenceBufferAt &&
    !cpu.isInStartupFrames &&
    (cpu.pendingSlapCount || 0) < 1
  ) {
    cpu.pendingSlapCount = 1;
    cpu.pendingSlapPressTime = currentTime;
    aiState.cadenceBuffered = true;
  }
}

// Process CPU inputs and trigger actions
function processCPUInputs(cpu, opponent, room, gameHelpers) {
  if (!cpu || !cpu.isCPU || !cpu.keys) return;

  // PHASE 4.3: re-resolve the kit for THIS cpu (this runs in a separate pass from
  // updateCPUAI, so the module-level KIT could otherwise be stale) — keeps the
  // verb gates below correct and non-BASHO CPUs on the full legacy kit.
  KIT = (cpu.aiDivision && DIVISION_KIT[cpu.aiDivision]) ? DIVISION_KIT[cpu.aiDivision] : null;
  
  const {
    executeSlapAttack,
    executeChargedAttack,
    executePalmThrust,
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
  
  if (cpu.inputLockUntil && simNowForPlayer(cpu) < cpu.inputLockUntil) {
    return;
  }
  
  if (cpu.actionLockUntil && simNowForPlayer(cpu) < cpu.actionLockUntil) {
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  const currentTime = simNowForPlayer(cpu);

  // MASTERY Phase 3: schedule/release the CPU's cadence-timed follow-up slap. Runs
  // BEFORE the shouldBlockAction early-return below (which fires during our own
  // active slap) so it can buffer the next press mid-cycle. No-op with the flag
  // off (byte-identical CPU behavior).
  scheduleCpuCadence(cpu, opponent, currentTime);

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
    if (cpu.isThrowTeching) return true;
    if (cpu.isRawParrying) return true;
    return false;
  };
  
  if (!cpu._prevKeys) {
    cpu._prevKeys = { ...cpu.keys };
  }

  const prevKeys = cpu._prevKeys;
  const keyJustPressed = (key) => cpu.keys[key] && !prevKeys[key];

  // NOTE: The old "mash to win" grab-clash system was removed.
  // Mutual grabs now resolve deterministically into a shared clinch via executeGrabTech.
  // The legacy W-throw path (gated on isGrabbing && !inClinch) was also removed —
  // grabs always enter the clinch now, and clinch throws use clinchThrowRequest.

  // Block if in blocking state
  if (shouldBlockAction()) {
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }

  // Propagate W rising edge for slide-jump takeoff / FLAP air charges
  // (game loop reads wJustPressed; humans get this from socketHandlers).
  if (keyJustPressed("w")) {
    cpu.wJustPressed = true;
  }

  // Process palm thrust (PHASE 3.4) — mirrors the human back+mouse1 palm. The AI
  // sets palmThrustQueued alongside mouse1; consume it BEFORE the slap branch so
  // the press becomes a rooted palm, not a slap. executePalmThrust guards
  // !isAttacking internally so it can never eat a string.
  if (keyJustPressed("mouse1") && cpu.palmThrustQueued) {
    cpu.palmThrustQueued = false;
    if (executePalmThrust && canPlayerSlap(cpu) && !shouldBlockAction()) {
      executePalmThrust(cpu, rooms);
      Object.assign(cpu._prevKeys, cpu.keys);
      return;
    }
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
    
    beginGrabStartup(cpu, room);
    
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
      cpu.sidestepActiveEndTime = currentTime + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS;
      cpu.sidestepEndTime = currentTime + SIDESTEP_TOTAL_MS;
      cpu.sidestepStartX = cpu.x;
      cpu.sidestepDirection = initData.direction;

      cpu.currentAction = "sidestep";
      cpu.actionLockUntil = currentTime + SIDESTEP_TOTAL_MS;
      cpu.stamina = Math.max(0, cpu.stamina - SIDESTEP_STAMINA_COST);

      if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
      else Object.assign(cpu._prevKeys, cpu.keys);
      return;
    }
  }

  // Process dodge — locked while gassed (same as sidestep / rope jump)
  if (keyJustPressed("shift") &&
      !cpu.keys.mouse2 &&
      !cpu.isBeingGrabbed &&
      !cpu.isGassed &&
      canPlayerDash(cpu)) {
    beginPlayerDodge(cpu, { nowSim: currentTime });

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
          hasVerb("ropeJump") && // PHASE 4.3: rope jump is a Juryo+ verb
          !cpu.isRopeJumping && canDash(cpu) && !cpu.isGassed) {
        clearChargeState(cpu, true);
        cpu.movementVelocity = 0;
        cpu.isStrafing = false;
        cpu.isPowerSliding = false;
        cpu.isBraking = false;

        const jumpDir = nearLeftBound ? 1 : -1;
        startRopeJump(cpu, {
          now: currentTime,
          jumpDirection: jumpDir,
          mapLeft: GAME_MAP_LEFT,
          mapRight: GAME_MAP_RIGHT,
          facing: nearLeftBound ? -1 : 1,
        });

        if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
        else Object.assign(cpu._prevKeys, cpu.keys);
        return;
      }
    }
  }

  // Process ATTACK PARRY — the CPU "taps" s (edge-triggered via keyJustPressed).
  // Arms one short deflect window via the shared helper; the main-loop AP state
  // machine handles the active→whiff-recovery transition (so NO manual release
  // here).
  if (keyJustPressed("s") &&
      !shouldBlockAction() &&
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
      canArmAttackParry(cpu, currentTime) &&
      canPlayerUseAction(cpu)) {
    
    armAttackParry(cpu, currentTime);
    clearChargeState(cpu, true);
    
    if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
    else Object.assign(cpu._prevKeys, cpu.keys);
    return;
  }
  
  // Neutral charged attack REMOVED from the CPU's neutral game.
  // Clear any lingering charge state
  if (cpu.isChargingAttack) {
    clearChargeState(cpu);
  }
  
  // Process F key power-ups
  if (keyJustPressed("f") && 
      !shouldBlockAction() &&
      (cpu.activePowerUp === "snowball" || cpu.activePowerUp === "pumo_army") &&
      (cpu.activePowerUp !== "snowball" || (cpu.snowballThrowsRemaining ?? 5) > 0) &&
      (cpu.activePowerUp !== "pumo_army" || (cpu.pumoArmySpawnsRemaining ?? 3) > 0) &&
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
        cpu.snowballThrowsRemaining = 5;
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
        if (cpu.actionLockUntil && simNowForPlayer(cpu) < cpu.actionLockUntil) {
          cpu.actionLockUntil = 0;
        }
      }, 500);
      
      if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
      else Object.assign(cpu._prevKeys, cpu.keys);
      return;
    } else if (cpu.activePowerUp === "pumo_army") {
      if (cpu.pumoArmySpawnsRemaining == null) {
        cpu.pumoArmySpawnsRemaining = 3;
      }
      if (cpu.pumoArmySpawnsRemaining <= 0) {
        if (!cpu._prevKeys) cpu._prevKeys = { ...cpu.keys };
        else Object.assign(cpu._prevKeys, cpu.keys);
        return;
      }

      cpu.stamina = Math.max(0, cpu.stamina - CHARGED_ATTACK_STAMINA_COST);
      cpu.pumoArmySpawnsRemaining = Math.max(0, cpu.pumoArmySpawnsRemaining - 1);
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
          spawnTime: simNowForPlayer(cpu),
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
      
      setPlayerTimeout(
        cpu.id,
        () => {
          cpu.isSpawningPumoArmy = false;
          cpu.pumoArmyCooldown = false;
          if (cpu.actionLockUntil && simNowForPlayer(cpu) < cpu.actionLockUntil) {
            cpu.actionLockUntil = 0;
          }
        },
        800,
        "pumoArmySpawnEnd"
      );
      
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

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
const ALWAYS_SEND_PROPS = ['x', 'y', 'facing', 'stamina', 'balance', 'id', 'fighter', 'color', 'mawashiColor', 'bodyColor', 'gearIds'];

const DELTA_TRACKED_PROPS = [
  'isAttacking', 'isSlapAttack', 'isPalmThrust', 'palmThrustFxId', 'isLowKick', 'slapAnimation', 'attackType',
  'isChargingAttack', 'chargeAttackPower', 'chargeStartTime',
  'isBurstKnockback',
  'isGrabbing', 'isBeingGrabbed', 'grabbedOpponent', 'grabState', 'grabAttemptType',
  'isGrabbingMovement', 'isWhiffingGrab', 'isGrabWhiffRecovery', 'isGrabTeching', 'grabTechRole', 'isGrabStartup',
  'isHit', 'lastHitType', 'isDead', 'isRecovering', 'isDodging', 'isDodgeStartup', 'isDodgeRecovery', 'dodgeDirection', 'justLandedFromDodge',
  'isRawParrying', 'isGuarding', 'isRawParryStun', 'isRawParrySuccess', 'isPerfectRawParrySuccess',
  'isApPostParryLocked',
  'isApWhiffRecovering',
  'isThrowing', 'isBeingThrown', 'isThrowTeching', 'isBeingPulled', 'isBeingPushed',
  'isThrowingSalt', 'isReady', 'isBowing', 'isAtTheRopes',
  'isThrowingSnowball', 'isSpawningPumoArmy',
  'isGrabBreaking', 'isGrabBreakCountered',
  'isAttemptingGrabThrow', 'isInRitualPhase',
  'isGrabPushing', 'isBeingGrabPushed', 'isEdgePushing', 'isBeingEdgePushed',
  'isAttemptingPull', 'isBeingPullReversaled',
  'isGrabSeparating', 'isGrabBellyFlopping', 'isBeingGrabBellyFlopped',
  'isGrabFrontalForceOut', 'isBeingGrabFrontalForceOut',
  'knockbackVelocity',
  // Parry/guard shove slide (separate from isHit knockback). Client prediction
  // must suspend while this is non-zero — it is not modeled locally.
  'slapParryKnockbackVelocity',
  'activePowerUp', 'powerUpMultiplier',
  'snowballs', 'pumoArmy', 'snowballCooldown', 'pumoArmyCooldown', 'snowballThrowsRemaining', 'pumoArmySpawnsRemaining',
  'isPowerSliding', 'isBraking', 'movementVelocity', 'isStrafing', 'effectiveMoveSpeedMult',
  'isRopeJumping', 'ropeJumpPhase', 'sizeMultiplier', 'isGassed',
  'isFlapping', 'flapPhase', 'flapCharges', 'flapWingBeatTime', 'flapFastFalling', 'flapBeatHDir',
  'isSidestepping', 'isSidestepStartup', 'isSidestepRecovery',
  'isSlapParryRecovering',
  'isHitFalling', 'isSidestepHitReturn',
  'inClinch', 'hasGrip', 'clinchAction',
  'isBeingLifted', 'isClinchThrowing', 'isClinchClashing',
  'isClinchLifting', 'isClinchPushing', 'isClinchPlanting',
  'isResistingThrow', 'isResistingPull',
  'isClinchKillThrowVictim', 'isClinchKillPullVictim',
  'isClinchJolting', 'isBeingClinchJolted', 'isClinchJoltClashing',
  'clinchJoltRecovery',
  'isArmClamped', 'clinchThrowFailStagger', 'isCounterGrabbed',
  'hasDeepGrip',
  // Push-war read for HUD: null = not mutual shove, 0 = EVEN, 1/-1 = walk lead.
  'clinchShoveLead',
  // MASTERY Phase 2 (posture coupling): the broken-posture "openable" tell.
  // Computed server-side each tick with hysteresis; forced false when the
  // MASTERY_P2_POSTURE flag is off, so with the flag off this is a stable extra
  // field on the wire (no sim/gameplay change).
  'isPostureBroken',
  // MASTERY Phase 3 (tsuppari cadence): consecutive-enhanced-slap counter. Drives
  // the escalating hand-flash VFX + rising-pitch SFX so the crowd can HEAR a good
  // player's rhythm. Only ever incremented behind MASTERY_P3_CADENCE; stays 0 with
  // the flag off (stable extra field on the wire, no sim/gameplay change).
  'cadenceChain'
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
const GROUND_LEVEL = 286;
const HITBOX_DISTANCE_VALUE = 65; // Pushbox half-width (was 68). Light belly-gap trim — 62 was still too tight.
const CHARGED_HITBOX_DISTANCE_VALUE = 135; // Just past pushbox 130 (+5)
const SLAP_HITBOX_DISTANCE_VALUE = 138; // Just past pushbox (+8)
// ── SLAP CLASH ("slap parry") — RARE, GROUND-based GAIN / LOSE / NEUTRAL ────
// Design intent: the clash is NOT the texture of close-range fighting — it's a
// rare highlight you hit on a genuinely simultaneous read. The DEFAULT outcome
// of two players mashing is one slap landing first (a clean counter-hit during
// the other's startup); only near-simultaneous presses clash.
//
// CRITICAL FAIRNESS RULE: recovery is ALWAYS symmetric — both players unlock at
// the exact same time. The clash NEVER hands one side a frame/tempo advantage,
// because a tempo lead snowballs (the loser can't out-mash it, so it feels like
// "why did he beat me when we were both spamming"). The ONLY thing a clash
// decides is GROUND (ring control — the sumo win currency), which the loser can
// always contest by re-approaching:
//   • DECISIVE  — one slap clearly started first → winner holds the center, the
//                 other is shoved back toward the rope. Ground gained / lost.
//   • NEUTRAL   — starts within ~1 frame (a true tie) → both pop back equally,
//                 nobody gains ground. Fair, never random.
// Win clashes REPEATEDLY to walk an opponent to the edge — no single clash is
// ever a free hit or a guaranteed follow-up.
const SLAP_PARRY_WINDOW = 45; // Near-simultaneous only (~2–3 frames). Was 75 —
// that made mash-vs-mash almost always clang; tighter so one slap lands clean.
const SLAP_PARRY_NEUTRAL_WINDOW_MS = 30; // Starts within ~1 tick (64Hz ≈ 15.6ms) read
// as a genuine tie → NEUTRAL (symmetric). Beyond this, someone clearly went first.
// Symmetric recovery — IDENTICAL for both players, every outcome. Both unlock
// together, so mashing-after-clash simply re-clashes (fair) instead of letting
// the winner run away with the tempo. The reward for winning is GROUND, not frames.
const SLAP_PARRY_RECOVERY_MS = 135;
const SLAP_PARRY_HITSTOP_MS = 110; // Clash freeze — keep as the CLANG beat (hitstop
// on a clean slap connect is separate: HITSTOP_SLAP_MS).
// Asymmetric knockback (decisive) — the readable tell, and the ONLY advantage a
// clash grants. Winner barely moves (holds the center); loser is shoved back
// toward the rope. Purely positional → always contestable.
const SLAP_PARRY_KNOCKBACK_WINNER = 0.8;
const SLAP_PARRY_KNOCKBACK_LOSER = 5.0; // Was 3.5 — harder shove ends the war
const SLAP_PARRY_KNOCKBACK_NEUTRAL = 2.8; // Was 2.0 — ties also create real space
const SLAP_PARRY_KB_FRICTION = 0.82; // Strong friction — quick settle after the shove
// Instant separation snap on clash resolve — expand centers to this gap BEFORE
// hitstop. Must sit CLEAR of slap reach (~138) so post-clash mash doesn't
// instantly re-clang; never pulls closer.
const SLAP_PARRY_TIP_SEPARATION = 165;

const GRAB_RANGE = 146; // Command grab range — same +16 past pushbox overhang as before

// ============================================
// FRAME DATA SYSTEM — Formal startup/active/recovery for every move
// Real fighting game structure: Startup → Active → Recovery
// Startup: committed but can't hit. Active: hitbox live. Recovery: punishable.
// ============================================
const SLAP_STARTUP_MS = 55;       // Wind-up before hitbox. Kept SHORT so slaps
                                  // read as FAST jabs (not slow taps). Client
                                  // SLAP_ANIM.SMEAR_END must equal this so hit art
                                  // never leads the active frames (see GameFighter).
const SLAP_ACTIVE_MS = 100;       // Hitbox live window
const SLAP_RECOVERY_MS = 75;      // Can't act, no hitbox. Full cycle = 230ms — the
                                  // press-to-press rhythm of repeated slaps.
const SLAP_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;

// ── SLAP REWORK: individual presses, no string/combo ────────────────────────
// Each mouse1 press is one self-contained slap. On hit BOTH players become
// actionable at the same instant (+0 by construction: the victim's hitstun is
// set to the attacker's remaining cycle at the moment of connect — see
// processHit). The reward for landing a slap is GROUND, not frames: both
// players slide toward the victim's rope, with the victim drifting slightly
// farther so repeated hits self-space out of slap reach after 2-3 connects.
// The slap1/slap2 animations still alternate, but purely cosmetically — both
// have identical properties.

// === WHIFF COOLDOWN (subtle, per press) ===
// The old "2 whiffs → committed 300ms pause + stamina surcharge" was built to
// price string spam; with slaps as individual +0 presses it's gone. Instead,
// every WHIFFED slap holds its recovery a touch longer than a landed one
// (75 → 120ms; cycle 230 → 275ms). Free to spam — but connecting keeps your
// rhythm faster than swinging at air, so accuracy still pays, and a reactive
// whiff punish gets a slightly wider window without a hard lockout. Applied at
// cycle end (never on hit), so the +0 on-hit math is untouched.
const SLAP_WHIFF_EXTRA_RECOVERY_MS = 45;

// ── BURST KNOCKBACK (palm thrust / flap body-slam delivery model) ───────────
// Physics-based knockback: velocity impulse, no DI during the forced window.
// ICE-SLIDE MODEL: a single, smooth exponential decay — the victim is shoved
// at a moderate impulse and decelerates at the SAME friction as the ice coast
// they settle into afterward (ICE_COAST_FRICTION), so the forced knockback
// reads as one continuous slide on ice.
//
// DISTANCE TUNING: total travel ≈ k·v0/(1−friction) with k = delta·speedFactor
// (~2.89 px per velocity-unit per tick). v0=3.1 @ 0.982 ≈ 494px total.
// (Formerly the slap-string hit-3 finisher constants; the slap string is gone,
// but the palm thrust and flap body-slam still deliver through this model.)
const BURST_KB_VELOCITY = 3.1;             // Reference burst impulse (flap body-slam uses this).
const BURST_STUN_MS = 200;                 // Forced (no-DI) window. After this the remaining velocity
                                           // hands off to the DI-able ice coast — seamless, since both
                                           // phases use the same friction.
const BURST_KB_FRICTION = 0.982;           // Per-tick decay during the forced window. Matched to
                                           // ICE_COAST_FRICTION so the shove and the follow-through slide
                                           // are visually one motion.

// ─── SLAP ROPE RESISTANCE ───────────────────────────────────────────────
// Real-sumo rope feel: a slap can only send the opponent OUT if the hit
// connected while they were already near the boundary (the "kill zone").
// From mid-ring, the rope catches them — the victim is stopped at the edge
// instead of being knocked through it. Evaluated PER HIT at connect time
// (using the victim's distance to the boundary in the knockback direction),
// so repeated slaps naturally walk the opponent into the zone first. There
// is NO bypass — not even on a punish. Slap rings out ONLY inside this band.
const SLAP_KILL_RANGE = 25;
// Where a rope-caught victim comes to rest, measured INWARD from the boundary.
// Keeps them a few px off the literal edge (not pixel-perfect on the rope) and
// safely short of the ring-out line so the win check never trips on a save.
const SLAP_ROPE_RESIST_BUFFER = 12;

// ── ON-HIT GROUND TRANSFER (the slap's entire reward) ───────────────────────
// On connect BOTH players slide toward the victim's rope. The victim drifts
// slightly FASTER than the attacker advances, so back-to-back slaps self-space:
// after 2-3 connects the victim exits slap reach and the attacker must walk or
// commit to something else to continue. Positional gain, zero frame gain.
const SLAP_ONHIT_ATTACKER_PUSH = 1.0;   // Attacker's forward slide on connect (matches whiff slide)
const SLAP_ONHIT_VICTIM_DRIFT = 1.15;   // Victim's drift — the self-spacing dial (> attacker push)

// ── SLAP COUNTER HIT ─────────────────────────────────────────────────────────
// A counter hit (clipping the opponent's startup) is the ONLY way a slap grants
// frame advantage: a flat bonus on top of the +0 base, plus extra shove. The
// bonus means your NEXT slap wins a mash-vs-mash clash decisively, but it does
// NOT reach combo territory — a parry (or simply moving) still answers it.
const SLAP_COUNTER_HIT_BONUS_MS = 35;   // Flat hitstun bonus — the earned tempo beat
const SLAP_COUNTER_KB_MULT = 1.25;      // Victim drift multiplier on counter (extra ground)
// Safety floor for the dynamically computed hitstun (see processHit).
const SLAP_MIN_HITSTUN_MS = 60;

const CHARGED_STARTUP_MS = 150;   // Clear windup (unchanged)
const CHARGED_ACTIVE_MS = 120;    // Hitbox live window

// ── OPEN-PALM THRUST (back + mouse1) ────────────────────────────────────────
// A rooted, single-hit "hold your ground" strike. Rides the charged
// hit-resolution path (attackType "charged" + isPalmThrust flag) as a
// fixed-power mini-charge, but takes NO forward lunge. Fast startup, weak-
// charged power, and a long whiff recovery make it the committal spacing /
// edge-finishing counterpart to the advancing slap string. Think Feng b+1:
// snappy, rewarding on a read, but you eat a punish if it whiffs.
const PALM_THRUST_STARTUP_MS = 90;         // Fast windup (~5-6 frames)
const PALM_THRUST_ACTIVE_MS = 90;          // Single clean hit window (hitbox live)
// Visual "hold": the strike pose lingers after the active frames, but this is
// REAL recovery — no hitbox, the player can't act, and they ARE punishable. It
// just renders as the attack pose (slapAttack1) instead of the recovery pose,
// so the strike reads as a committed, held-out palm.
const PALM_THRUST_HOLD_MS = 260;
// The ONLY part shown as the recovery pose for OTHER moves — palm thrust keeps
// its strike sprite for the full whiff punish window instead.
const PALM_THRUST_END_RECOVERY_MS = 60;
const PALM_THRUST_HIT_RECOVERY_MS = 200;   // Settle on a confirmed hit
// Fixed "charge %" used ONLY for the palm's priority + hitstop, NOT its
// knockback: 35 sits ABOVE CHARGE_PRIORITY_THRESHOLD (30) so the thrust beats a
// slap on a simultaneous trade, and it scales the connect hitstop. The actual
// shove is a fixed burst impulse (PALM_THRUST_KB_VELOCITY below) via the burst
// knockback model — the palm does NOT run the 0.45+charge^1.3 charged formula.
const PALM_THRUST_POWER = 35;
// Heavy single-hit knockback — now the game's big committal SHOVE (slaps only
// gain ground; the palm SENDS them). Delivered via the burst model (smooth
// ICE_COAST slide + rope clamp): the reward for a slower, rooted, punishable,
// grab-losable read. Sits under BURST_KB_VELOCITY (3.1, the flap body-slam)
// as the ground-based burst tier.
const PALM_THRUST_KB_VELOCITY = 2.4;
const PALM_THRUST_STAMINA_COST = 4;        // Slightly above slap (3) — committed poke, not a gas tax
// Rooted (no lunge), so it needs a little more raw reach than the charged
// hitbox to feel like a committed extended-arm thrust — a touch past slap.
const PALM_THRUST_HITBOX_DISTANCE_VALUE = 164; // Rooted thrust — same +34 past pushbox tip overhang as before

// ── LOW KICK / TRIP (S + mouse1, no forward) ────────────────────────────────
// Rooted anti-defense poke. Beats parry/guard and grab startup; loses to slap /
// palm / charged on trade. No ring-out. Small shove (~one slap of ground),
// posture-focused reward — a read tool, not a kill move.
// Flip to true to re-enable input + execution (code kept intact).
const LOW_KICK_ENABLED = false;
const LOW_KICK_STARTUP_MS = 95;
const LOW_KICK_ACTIVE_MS = 85;
const LOW_KICK_RECOVERY_MS = 300;       // Whiff is rooted + long → punishable
const LOW_KICK_HIT_RECOVERY_MS = 180;   // Settle on confirm
const LOW_KICK_TOTAL_MS =
  LOW_KICK_STARTUP_MS + LOW_KICK_ACTIVE_MS + LOW_KICK_RECOVERY_MS;
const LOW_KICK_STAMINA_COST = 3;
const LOW_KICK_HITBOX_DISTANCE_VALUE = 142; // Slightly past slap (138); was 178 (far too long)
const LOW_KICK_KB_VELOCITY = 1.05;      // ≈ slap victim drift, not a shove
const LOW_KICK_BALANCE_DRAIN = 12;      // Above slap (~7), under palm (20)
const LOW_KICK_BALANCE_DRAIN_VS_PARRY = 16; // Bonus for beating Space
const LOW_KICK_BALANCE_DRAIN_COUNTER = 16;

const GRAB_STARTUP_MS = 165;      // Readable telegraph. Trimmed 180→165 to let
                                  // grabs win the timing race vs slaps a bit
                                  // more often, compensating for the removal of
                                  // the default 1-hit grab-startup armor (a slap
                                  // that beats the grab now stuffs it cleanly).
                                  // Tuning knob — nudge down further if grabs
                                  // still feel too easy to poke out of.
const GRAB_ACTIVE_MS = 100;       // Grab connect window

const DODGE_STARTUP_MS = 50;      // Readable windup/anticipation before the hop (was 20)
const DODGE_ACTIVE_MS = 210;      // Actual dash movement — lengthened for readability (was 175); speed lowered to keep the same travel distance
const DODGE_RECOVERY_MS = 0;      // No recovery — cooldown prevents chain-dash (was 90)
const DODGE_TOTAL_MS = DODGE_STARTUP_MS + DODGE_ACTIVE_MS + DODGE_RECOVERY_MS; // 260ms
const DODGE_COOLDOWN_MS = 100;    // Forced idle gap after recovery before next dash (prevents chain-dash blur)

// ============================================
// Sidestep — Henka-style positional escape around the dohyo
// Fixed-speed lateral arc. Designed as a parallel to raw parry: a committed
// timing read whose payoff is a clean positional advantage instead of a stun.
//
// Identity: this is NOT a hard-read tool against strikes (raw parry already
// fills that role). Sidestep is for desperate positioning escapes — e.g.
// flipping sides when you're pinned at the boundary about to lose.
//
// Risk/reward profile:
//   Startup (40ms):  Vulnerable to ALL — strikes counter-hit, grabs track.
//                    This is the read window: bad timing here is punished hard.
//                    Tight (~2.5 frames @60fps) but slap-active is 100ms wide,
//                    giving attackers a real read window to call out the move.
//   Active  (400ms): Fully invulnerable — both strikes AND grabs whiff. The
//                    arc is a guaranteed escape if you survive startup.
//   Recovery(150ms): Vulnerable to ALL again — strikes hit as PUNISH (not
//                    counter), grabs track. Predictable sidesteps still get
//                    punished on land.
//
// Outpacing the arc: opponent can dash away faster than the sidestep travels,
// so the side-switch is not free if the opponent is alert.
// ============================================
// Sidestep is a single, fully consistent move. Travel distance, active duration,
// and arc depth are FIXED so the visual feel is identical regardless of opponent
// distance. Side-switching becomes an emergent outcome of being close enough to
// the opponent (the fixed lateral travel naturally carries you past them when
// they're inside grab range), rather than a hard branch in code.
// Speed/range tuning targets (playable map = 600px, dodge ≈ 592 px/sec):
//   TRAVEL=160 over ACTIVE=400ms → ~400 px/sec effective lateral speed.
//   That's slower than dodge AND covers ~27% of the map per move, so the
//   sidestep reads as a circling step around the dohyo's curve, not a teleport.
// 50ms startup is still 2.5x dodge startup (20ms), so dodge remains the faster
// panic button — sidestep is slower-but-bigger-reward by design.
// PHASE 3.1: 40 → 50ms so a *predicted* corner sidestep is actually clippable —
// reading an escape should pay. (The old 40 was tuned for the deleted slap-string
// slap2→grab option-select; with slaps now individual +0 presses, that constraint
// is gone.)
const SIDESTEP_STARTUP_MS = 50;       // Vulnerable wind-up — counter-hittable on read
const SIDESTEP_ACTIVE_MS = 400;       // Fixed active phase — same length every time
const SIDESTEP_RECOVERY_MS = 150;     // Smooth settle to final position, vulnerable (PUNISH on hit)
const SIDESTEP_TOTAL_MS = SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS + SIDESTEP_RECOVERY_MS; // 600ms total
const SIDESTEP_STAMINA_COST = 8;      // Expensive — bigger reward than dodge (4) or parry (5)
const SIDESTEP_TRAVEL = 160;          // Fixed lateral travel — circling step around the dohyo's curve
// PHASE 3.1: a sidestep STARTED inside the edge-panic zone (DOHYO_EDGE_PANIC_ZONE
// of a boundary) travels less — escaping the corner no longer refunds the whole
// war of position. Full-arena sidesteps keep SIDESTEP_TRAVEL.
const SIDESTEP_TRAVEL_EDGE = 110;     // Reduced travel when cornered
const SIDESTEP_ARC_DEPTH = 50;        // Fixed Y dip — moves DOWN on screen (toward camera, around the ring's near edge)
const SIDESTEP_GRAB_TRACK_RANGE = 400; // Generous grab range when target is sidestepping
const SIDESTEP_RECOVERY_OVERLAP_THRESHOLD = 80; // Only push out during recovery if literally clipping pushbox

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
  FLAP: "flap",
  SHATTER_PALM: "shatter_palm",
};

const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.4, // 40% speed increase (only affects movement, not knockback)
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase (ONLY power-up that affects knockback)
  [POWER_UP_TYPES.SNOWBALL]: 1.0, // No stat multiplier, just projectile ability
  [POWER_UP_TYPES.PUMO_ARMY]: 1.0, // No stat multiplier, just spawns army
  [POWER_UP_TYPES.THICK_BLUBBER]: 1.0, // No stat multiplier, just hit absorption
  [POWER_UP_TYPES.FLAP]: 1.0, // No stat multiplier, replaces raw parry with flight
  [POWER_UP_TYPES.SHATTER_PALM]: 1.0, // No stat multiplier — palm thrust shatters grab startup armor
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

// Hard safety rail for locomotion. Every walk/strafe/grab-lunge speed
// multiplier (PvP Happy Feet, BASHO career MOVE SPEED, and stacked Happy Feet
// draft picks) is folded into ONE authoritative `effectiveMoveSpeedMult` that
// is clamped here and broadcast to the client, so the predictor renders the
// exact same displacement (no "camera runs ahead of the sprite" desync). This
// is deliberately generous — it only exists to catch absurd future combos
// (e.g. max MOVE SPEED stat stacked with many Happy Feet picks); normal play
// is bounded by the draft curve's own ceiling (SPEED_STACK_CAP). At this value
// walk displacement is ~22px per broadcast, far under the client's ~100px
// interpolation snap. PvP's single Happy Feet (1.4) sits well under it, so
// PvP/VS CPU are unaffected.
const MAX_MOVE_SPEED_MULT = 3.0;

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
// PHASE 2 — position gate for the read-gated charged cinematic kill. A NEUTRAL
// charged hit (no counter/punish, not gassed) may only cinematic-KO when the
// victim was within THIS distance of the boundary (in the knockback direction)
// AT CONTACT — otherwise the hit is rope-clamped. Measured from the ROPE
// (MAP_*_BOUNDARY 340/935), NOT the visible fall-out edge (DOHYO 250/1030) which
// sits ~95px further out, so keep this small or a "58px" zone reads as midscreen.
// EARNED-EDGE identity: a neutral charge is a positioning/knockback tool, not a
// raw one-shot — it only KOs by power when the victim is genuinely PINNED against
// the rope (near point-blank). Everything farther out rope-clamps; reads
// (counter/punish/gassed) remain the way to KO from range. Main charged-kill dial.
const CHARGED_KILL_EDGE_ZONE = 24;
const ICE_EDGE_BRAKE_BONUS = 0.06;      // EXTRA braking power near edge
const ICE_EDGE_SLIDE_PENALTY = 0.004;   // MORE slippery near edge when not braking

// Legacy aliases for backwards compatibility. Only the ones still referenced by
// index.js survive; the unused 1:1 aliases (MOVEMENT_ACCELERATION, MAX_MOVEMENT_SPEED,
// INITIAL_MOVEMENT_BURST) were removed in the Phase 0 cleanup.
const MOVEMENT_DECELERATION = 0.08;
const MOVEMENT_MOMENTUM = ICE_COAST_FRICTION;
const MOVEMENT_FRICTION = 0.99;
const ICE_DRIFT_FACTOR = 0.3; // Legacy: momentum kept on direction change
const MIN_MOVEMENT_THRESHOLD = ICE_STOP_THRESHOLD;

// ============================================
// Dash Physics - grounded dash with dash slap
// ============================================
const DODGE_DURATION = DODGE_STARTUP_MS + DODGE_ACTIVE_MS; // 260ms total before recovery phase
const DODGE_BASE_SPEED = 2.67; // Grounded dash speed — lowered from 3.2 alongside the longer ACTIVE window so travel stays ~118px but reads slower/weightier (still ~1.4x the sidestep's speed, clearly faster than strafing)
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
const SLAP_ATTACK_STARTUP_MS = SLAP_STARTUP_MS; // Uses frame data constant (55ms — all slaps share this startup)

// Grab armor stagger — extends grab startup when armor absorbs a slap, so a
// chained slap can actually catch the grabber before they connect. Without
// this, slap chain cycle (~195ms) is too long to fit a second slap inside
// the 180ms base startup, making armored grabs effectively unbeatable by
// slaps. 100ms gives a tight-but-real "double slap breaks armor" window.
const GRAB_STARTUP_ARMOR_STAGGER_MS = 100;

// Grab whiff recovery — big vulnerable window if grab misses
const GRAB_WHIFF_RECOVERY_MS = 450; // Whiff recovery duration (fully vulnerable to punishment)

const GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER = 1.4; // Larger gap during pull attempt (vs 1.0 for normal grab)

// Grab break constants — Spacebar in clinch (both players must have grip).
// Soft-gated by stamina: usable below cost, but breaker self-gasses if under-budget.
// Halves breaker's current balance. Doesn't reposition meaningfully (boundary-clamped),
// so edge stress is preserved. Brief grab immunity prevents instant re-clinch.
const GRAB_BREAK_STAMINA_COST = 30; // Heavy commitment — break is a real escape, not a free reset
const GRAB_BREAK_FORCED_DISTANCE = 140; // Total separation distance (split between breaker + opponent — each moves half this)
const GRAB_BREAK_TWEEN_DURATION = 350; // Knockback slide duration
const GRAB_BREAK_RESIDUAL_VEL = 0; // No residual sliding — players stop cleanly when knockback ends
const GRAB_BREAK_INPUT_LOCK_MS = 350; // Breaker is locked during knockback tween — vulnerable window
const GRAB_BREAK_ACTION_LOCK_MS = 350; // Action lock matches input lock
const GRAB_BREAK_GRAB_IMMUNITY_MS = 400; // Re-grab protection on the breaker after the tween ends
// Grab stamina drain: 10 stamina over full 1.5s duration
// Drain 1 stamina every 150ms (1500ms / 10 = 150ms per stamina point)
const GRAB_STAMINA_DRAIN_INTERVAL = 150;

// ============================================
// NEW GRAB ACTION SYSTEM - Directional grab mechanics
// Push starts IMMEDIATELY on grab connect (burst-with-decay).
// Grabber can interrupt push with pull (backward) or throw (W) during push.
// ============================================
const GRAB_PUSH_BURST_BASE = 2.5;          // Base burst speed when push starts
const GRAB_PUSH_MOMENTUM_TRANSFER = 0.6;   // Multiplier on approach speed added to burst (power slide grab = devastating)
// PHASE 3.2 — "caught the henka": a grab that connects on a victim still in
// sidestep-recovery or rope-jump landing floors the Phase A approach speed to
// this, so a *read-timed* grab bursts them back cornerward hard even from a
// standing (zero-approach) catch. Reads should pay out in position.
const GRAB_CATCH_MIN_BURST_SPEED = 1.5;
const GRAB_PUSH_DECAY_RATE = 1.6;          // Exponential decay rate (was 2.2 — slower decay for sustained yorikiri push)
const GRAB_PUSH_MIN_VELOCITY = 0.15;       // Push ends when speed decays below this
const GRAB_PUSH_BACKWARD_GRACE = 150;       // ms before backward input triggers pull during push (prevents accidental pull)
const GRAB_PUSH_STAMINA_DRAIN_INTERVAL = 70; // Drain 1 stamina per 70ms mid-ring (~14/sec)
const GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL = 35; // Drain 1 stamina per 35ms at edge (~29/sec)
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
const RAW_PARRY_SLAP_KNOCKBACK = 0.5; // Lighter knockback for slap parries
const PERFECT_PARRY_KNOCKBACK = 0.65; // Slightly stronger than regular parry
const PERFECT_PARRY_WINDOW = 40; // PERFECT tier window (ms), measured as (hitTime − rawParryStartTime, lag-comp). Tight inner band of AP_ACTIVE_MS — regular owns the generous read; perfect is the rare dead-on grade. Also gates the snowball perfect-reflect.
const PERFECT_PARRY_SUCCESS_DURATION = 850; // Compressed parry — fast enough to keep pace, long enough for visual read
const PERFECT_PARRY_ATTACKER_STUN_DURATION = 700; // Stun — comfortable window for slap/grab follow-up
const PERFECT_PARRY_ANIMATION_LOCK = 370; // 250ms hitstop + 120ms real post-freeze "cool pose" before parrier can act
const PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK = 200; // Shorter than player parry lock — the reflected snowball is the reward

// Lag-compensation: max the raw-parry start time may be backdated toward the
// player's true press moment (reconstructed from the client clock offset). The
// perfect window is 100ms; 120ms covers typical input latency (net/2 + client
// throttle + server tick phase) so the window is judged against when the player
// pressed, not when the packet arrived. Clamped both ways: a press can never be
// backdated past this, and never dated into the future — so a spoofed client
// can do no better than today's (uncompensated) behavior.
const MAX_PARRY_BACKDATE_MS = 120;

// Raw parry commitment: minimum time locked in parry stance
const RAW_PARRY_MIN_DURATION = 200; // Whiffed parry: punishable but not sluggish (was 375 — felt like parry jail)
const RAW_PARRY_MAX_DURATION = 700; // Auto-end after this — forces timing, prevents infinite camping.
// Bumped 550→700 so a HELD block (now a reliable, no-stun block by design) doesn't
// auto-drop right before a telegraphed charged lunge lands. Still finite (anti-camp).
const RAW_PARRY_COOLDOWN_MS = 150; // Cooldown after a fully-released parry before you can parry again (prevents perfect-window spam). Bypassed by re-arm (see below).

// ── Legacy RAW_PARRY_REARM_* (unused by live AP) ─────────────────────────────
// Live re-time is: falling Space clears apSpaceConsumed + rising Space calls
// armAttackParry (re-stamps start/window). Stamina is charged on land (AP_STAMINA_COST),
// not per re-arm. These constants remain only so old imports don't throw.
const RAW_PARRY_REARM_STAMINA_COST = 5;
const RAW_PARRY_REARM_INTERVAL_MS = 180;

// Parry visual timing
const PARRY_SUCCESS_DURATION = 500; // How long the parry success pose is held

// Raw parry stamina: flat cost on press, refunded on any successful parry
const RAW_PARRY_STAMINA_COST = 12; // Meaningful cost — whiffed parries sting (was 5)
const RAW_PARRY_STAMINA_REFUND = 12; // Full refund on success — correct reads are free (was 5)

// Perfect parry balance reward: only granted on perfect (100ms window) parries.
// More than the 8 you'd have lost from eating the slap, so a perfect read is a net
// defensive gain. Capped well below clinch throw thresholds so it can't trivialize pressure.
const PERFECT_PARRY_BALANCE_REFUND = 12;

// ============================================
// GUARD & PARRY (Space) — one stance, three outcomes
// ============================================
// Space is a Guard & Parry stance. There is no more "Deflect Flow" (hold-to-
// auto-cover): a flurry is answered by RE-TAPPING in rhythm, one tap per slap.
//
//   • TAP (rising edge), timed as the strike connects → PARRY. Deflects a slap
//     or palm thrust (NOT grabs, NOT charged). A landed parry opens a short
//     flurry cover (AP_FLURRY_COVER_MS) so the next re-tap can answer an ASAP
//     follow-up slap — tap-every-slap is intentional. The attacker eats their
//     move's own recovery (rendered in their ATTACK pose — never hit.png), loses
//     balance, and settles a SHORT pocket shove — nullify the slap plan, keep
//     chest-to-chest so grab / slap-down / your own button stay live. Not a
//     ring-reset. Graded by how dead-on the tap was:
//        – REGULAR: small settle + balance drain, ~neutral frames.
//        – PERFECT (inner PERFECT_PARRY_WINDOW): slightly farther settle + bigger
//          balance drain + balance refund + real frame advantage (one free button).
//     If the attacker's balance is already inside the KILL band when parried, it
//     becomes the lethal slap-down (pull cinematic).
//   • HOLD → GUARD (the block floor): you survive slaps/palms as chip + a little
//     ground lost + stamina bleed — but no reward. Rooted; does NOT stop grabs or
//     charged (grab is the standard FG answer to a held block). Bleed to 0 →
//     guard-crush → gassed. A MISTIMED tap while holding just becomes a guard
//     (no cancel recovery), so you can attempt parries fearlessly into block.
//     After a LANDED parry, a continued hold does NOT auto-GUARD — release once
//     then HOLD to block again (keeps release→re-press piano taps clean).
//   • RELEASE during a live window → CANCEL (window ends). Short rooted recovery
//     (AP_WHIFF_RECOVERY_MS) so empty taps aren't free, but RE-PRESS may arm a
//     fresh window immediately (recovery does not lock out parry). This is the
//     premium FG re-time loop — not a 260ms jail for letting go.
//
// RPS: parry/guard both LOSE to GRAB (counter-grab is the anti-defense read) and
// to CHARGED (blows through). Every parry costs stamina; turtling gasses you.
// (Reuses the isRawParrying / isRawParrySuccess flags + the spacebar plumbing.)
const AP_ACTIVE_MS = 180;            // PARRY WINDOW: a tap deflects if the strike connects within this of the (lag-comp) press. Slightly longer than the old 140 so a correct prediction that isn't super-early still covers connect; Perfect stays PERFECT_PARRY_WINDOW.
// Early-active slap grace: for the first N ms of slap ACTIVE frames, open hits
// (defender not in Space stance) are deferred, while live PARRY / GUARD still
// resolve immediately. Gives a slightly-late tap time to arm during early active
// without making the jab fully reactable on startup. Slap-only.
const AP_LATE_PARRY_MS = 45;
const AP_FLOW_WINDOW_MS = 400;       // DEPRECATED (Deflect Flow removed). Kept only so existing imports resolve; unreferenced by the new state machine.
// IMPACT-pose + post-parry move/offense lock (sim-clock; frozen during hitstop,
// so this mostly plays AFTER the freeze). Same duration for regular and perfect
// — attacker stagger/advantage is THEIR jail, not an extra plant on the parrier.
// Flurry re-tap still clears/re-arms via armAttackParry (lock flag survives).
// Long enough that Frame 2 (deflect) stays readable after hitstop ends.
const AP_SUCCESS_RECOVERY_MS = 200;
// Cancel / empty-tap recovery: rooted endlag when a live window is released (or
// expires) into nothing. Tuned ≈ slap recovery — real cost, not longer than a
// slap cycle. Does NOT set inputLockUntil; a rising Space re-arms through it.
const AP_WHIFF_RECOVERY_MS = 90;
const AP_COOLDOWN_MS = 40;           // Tiny gap before GUARD may re-enter after a drop. Fresh taps (rising Space) ignore this so release→re-press is an immediate parry window.
const AP_STAMINA_COST = 3;           // Charged per parry tap — cheap (reward using it), but re-tapping a long flurry still drains you.
// KILL gate: the parried attacker's balance must be DEEPLY broken (< this) for the
// lethal slap-down. Set well UNDER the clinch kill threshold (15) and the posture
// break (35) so a parry kill is a hard-earned finish, not "slap a bit + fish it".
const AP_KILL_THRESHOLD = 8;
const AP_PERFECT_KILL_THRESHOLD = 12; // A PERFECT parry can finish a hair higher — the dead-on read is rewarded.
// Balance drained from the parried attacker. The parry is the game's dedicated
// POSTURE tool — it bites posture HARDER than a raw slap (BALANCE_SLAP_HIT_DRAIN_P2),
// so it's worth throwing on a high-posture opponent for the damage, not only the kill.
const AP_BALANCE_DRAIN = 12;          // Regular parry
const AP_PERFECT_BALANCE_DRAIN = 18;  // Perfect parry — a real posture swing
// Attacker SHOVE on a parry. Delivered via the smooth "slap-parry" slide
// (slapParryKnockbackVelocity, friction SLAP_PARRY_KB_FRICTION ≈ 0.82) so the
// attacker slides back in their ATTACK/recovery pose — NOT a hit reaction. Travel
// ≈ v · 16px at 64Hz. Tuned to KEEP the pocket (hand-fight / grab range) — parry
// is a slap nullifier + posture tool, not a ring-reset. Perfect is only a small
// step farther than regular; the real perfect reward is AP_PERFECT_ADVANTAGE_MS
// (one guaranteed button), which needs them still in slap reach.
const AP_ATTACKER_KNOCKBACK = 1.75;        // Regular ≈ 28px — settle, still slapable
const AP_PERFECT_ATTACKER_KNOCKBACK = 2.25; // Perfect ≈ 36px — clearer tell, still one-slap range
// Regular parry freeze — long enough that SUCCESS Frame 2 (deflect) is the
// pose players actually read during the clash with the slap HIT frame.
// Frame 1 is only a brief windup (~40ms client-side); the rest of this window
// must belong to Frame 2. Kept short enough that flurry exchanges still breathe.
const AP_HITSTOP_MS = 110;
// Perfect parry — longer freeze so the rare read still feels premium vs regular.
const AP_PERFECT_HITSTOP_MS = 200;
const AP_KILL_HITSTOP_MS = 550;      // Heavy finisher freeze on the lethal slap-down — matches the charged CINEMATIC_KILL_HITSTOP_MS so the zoom/darken beat lands identically.
// PERFECT-only balance refund to the PARRIER: a dead-on read is a net posture
// GAIN, not just mitigation. Sits below clinch thresholds so it can't trivialize pressure.
const AP_PERFECT_BALANCE_REFUND = 12;
// Attacker lockout after being parried, keyed to the move they committed, and
// rendered in the move's OWN recovery pose (NOT hit.png). A slap recovers
// ~with the parrier (regular = near-neutral by design — a slap is too fast to
// punish on a plain parry); palm/flap's long recovery hands the parrier a free
// hit. A PERFECT slap parry adds AP_PERFECT_ADVANTAGE_MS on top so even the fast
// slap becomes a guaranteed poke — the perfect read's frame reward.
const AP_STAGGER_SLAP_MS = 150;
const AP_STAGGER_PALM_MS = 420;
const AP_STAGGER_FLAP_MS = 500;
const AP_PERFECT_ADVANTAGE_MS = 220; // Extra attacker lockout on a PERFECT slap parry → the parrier's guaranteed poke.
// Post-parry flurry cover (tap-every-slap). After a landed parry, the next
// rising-edge re-tap may extend its live window to (parryTime + cover). Cover
// matches REAL ASAP follow-up timing, not the naive stagger alone:
//   parryStaggerBegin delay (20) + attacker stagger + slap startup + slack
// (collision re-applies stagger AFTER hitstop via parryStaggerBegin). Slack
// absorbs delayed/CPU follow-ups. grantAttackParryFlurryCover() uses the
// actual staggerMs from that parry (regular vs perfect). Neutral taps stay
// AP_ACTIVE_MS (plus slap early-active grace). Perfect grade stays
// (hit − press) ≤ PERFECT_PARRY_WINDOW.
const AP_FLURRY_STAGGER_BEGIN_MS = 20; // must match collisionSystem parryStaggerBegin delay
const AP_FLURRY_SLACK_MS = 120;        // delayed follow-up / CPU reaction pad
const AP_FLURRY_COVER_MS =
  AP_FLURRY_STAGGER_BEGIN_MS + AP_STAGGER_SLAP_MS + SLAP_STARTUP_MS + AP_FLURRY_SLACK_MS; // 345 default (regular slap)
// Belly-slide travel on a lethal AP slap-down — matches the clinch KILL-PULL feel
// (victim is dragged THROUGH the parrier and slides out the far side). Slightly
// SLOWER than the clinch pull (felt too fast) for a weightier finisher.
const AP_KILL_SLIDE_DISTANCE = 210;      // == CLINCH_KILL_PULL_DISTANCE
const AP_KILL_SLIDE_DURATION_MS = 950;   // clinch pull is 850; +100 for a weightier slide-to-stop

// ── GUARD (hold Space) — the block floor ────────────────────────────────────
// A blocked strike is chip + ground lost + stamina bled, no reward. Uses the same
// smooth slide as the parry shove (rendered without a hurt pose). Guard is ROOTED,
// does NOT stop grabs or charged, and bleeding stamina to 0 while guarding crushes
// the guard into a gassed break — turtling is self-punishing.
const GUARD_SLAP_BALANCE_CHIP = 2;    // Blocked slap posture chip (vs 7 on a clean slap)
const GUARD_PALM_BALANCE_CHIP = 6;    // Palm keeps its posture-breaker bite even into block
const GUARD_SLAP_STAMINA_DRAIN = 4;   // Blocking costs stamina — a long flurry gasses a turtle
const GUARD_PALM_STAMINA_DRAIN = 7;
const GUARD_SLAP_PUSHBACK = 2.0;      // Slide-model velocity — blocked slap nudges you back ≈ 32px (ground still bleeds)
const GUARD_PALM_PUSHBACK = 4.0;      // Palm shoves a blocker hard ≈ 64px
const GUARD_HITSTOP_MS = 45;          // Light "tink" on a block — shorter than the parry clink so blocks read as the lesser outcome
const GUARD_CRUSH_STUN_MS = 500;      // Guard broken (stamina hit 0 while blocking): a brief stun, then the gassed penalty takes over

// ── SLAP TRADE (replaces the slap clash / "slap parry") ─────────────────────
// The slap clash is gone. Two slaps now resolve by WHO CONNECTED FIRST: the
// earlier active slap lands cleanly and stuffs the later one (order-independent —
// judged on attackStartTime, not player index, so there's no P1 bias). Only a
// genuine SAME-TICK tie TRADES: both take a hit. A 1-frame gap is NOT a trade
// (the earlier slap wins, like a real fighting game), so trades are rare. On a
// trade both players are shoved well apart (SLAP_TRADE_KNOCKBACK) so they exit
// slap range and must re-approach — this breaks the +0 "sync-lock" that would
// otherwise make synced mashers trade over and over. A trade CAN still ring out
// the boundary-side player (a double ring-out is geometrically impossible).
const SLAP_TRADE_WINDOW_MS = 8;      // Same-tick only (<1 tick @64Hz). A 1-frame gap → earlier wins, no trade.
const SLAP_TRADE_KNOCKBACK = 2.8;    // Hard mutual shove on a trade — spaces both out of slap range → re-approach desyncs them.

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
// PHASE 3.1: escape refund reduction. A rope jump lands only this fraction of the
// way toward center (was an inline 0.52 in socketHandlers + the CPU input path).
// Still saves your life; no longer refunds the whole positional war.
const ROPE_JUMP_CENTER_FRACTION = 0.33;

// ============================================
// FLAP — "Flappy bird" flight power-up (replaces raw parry on Space)
// ============================================
// State machine: startup (grounded telegraph) → flight (airborne, velocity
// physics) → landing (recovery endlag). Startup is counter-hittable (see
// processHit); flight is hit-immune; landing whiff is the punish window.
// Liftoff is FREE; the player then has
// FLAP_CHARGES (3) air flaps. Each press sets the vertical velocity to a hard
// impulse (NOT additive — that's what makes it read as a flappy-bird flap),
// then FLAP_GRAVITY pulls them back down each tick. Airborne = fully hit-immune;
// while DESCENDING the flapper is an attacker (body-slam). The per-tick values
// are tuned against the fixed ~64Hz timestep (delta ≈ 15.6ms): a single impulse
// arcs to ~impulse²/(2·FLAP_GRAVITY) — liftoff (11.5) ≈ 150px, an air flap (9.5)
// ≈ 102px from the press point. FLAP_MAX_HEIGHT caps a chained climb just above
// the visible top of the screen — a modest headroom bump, not a sky-high arc.
//
// "FEEL" — soft & cute, not flappy-bird twitchy. The launch impulse and gravity
// are deliberately LOW and tuned TOGETHER: a low impulse means a gentle pop
// (no sharp snap), and low gravity means a graceful, slightly-hanging descent
// instead of a fast plummet. Because the arc is symmetric, impact speed ≈ the
// launch impulse, so lowering it softens BOTH the rise and the fall. The default
// float is intentionally easy on the eyes — the AGGRESSIVE option is the S-key
// fast-fall (FLAP_FASTFALL_GRAVITY), whose heavy dive now contrasts hard against
// this soft baseline (that's the "hard to react to when you commit" dial).
const FLAP_STARTUP_MS = 166;             // Grounded telegraph (matches rope jump; interruptible)
const FLAP_CHARGES = 3;                  // Air flaps AFTER liftoff (liftoff itself is free)
const FLAP_LIFTOFF_IMPULSE = 11.5;       // Upward velocity (px/tick) on the initial liftoff — gentle pop, peaks ~150px, clearly below the top UI
const FLAP_IMPULSE = 9.5;                // Upward velocity (px/tick) per AIR flap press — soft beat, peaks ~102px; chaining climbs toward the cap with effort
const FLAP_GRAVITY = 0.44;               // Downward accel (px/tick²) on the main fall — light & graceful (cute float), NOT a heavy plummet. S-key fast-fall is the committal option.
const FLAP_MAX_HEIGHT = 300;             // Y-offset cap above GROUND_LEVEL — slightly above the old screen-height cap
const FLAP_AIR_MOVE_SPEED = 4.6;         // Horizontal air-control speed (px/tick) via A/D — fine steering while holding
// Fast-fall: pressing S during flight COMMITS to a locked straight plummet —
// pins X to the spot overhead, drains all remaining air charges, kills upward
// momentum, and holds heavy dive gravity until touchdown (hit or whiff).
const FLAP_FASTFALL_GRAVITY = 1.5;       // Downward accel (px/tick²) while dive-locked
const FLAP_DIVE_MIN_DOWN_VELOCITY = 8;   // Minimum downward speed (px/tick) once committed
const FLAP_FASTFALL_AIR_MOVE_SPEED = 1.1; // Unused while dive-locked (X is pinned); kept for reference
// Ceiling "feel" fix: a hard velocity clamp at the cap made hitting the ceiling
// snap from rising → dead-stop → fast drop, which reads as an ugly bounce. The
// fix is a CUSHION band just below the cap: rising into it bleeds off upward
// speed (glide to a stop, no slam) and gravity is softened there (HANG at the
// peak). The instant the wrestler drops BELOW the band, full FLAP_GRAVITY takes
// over again — so the actual fall stays fast, and normal mid-air arcs (below the
// band) are totally unaffected, preserving the "perfect flight" skill ceiling.
const FLAP_CEILING_CUSHION = 42;         // Height (px) of the soft band below the cap
const FLAP_CEILING_HANG_GRAVITY = 0.25;  // Reduced gravity inside the cushion band — peak hang, not a full float (kept ~0.57× of FLAP_GRAVITY)
// Per-flap horizontal burst: a flap pressed WHILE holding A/D flings the player
// up-AND-forward (diagonal arc) instead of near-vertical. Decays via friction so
// it reads as a momentary lunge layered on top of the steering drift. No
// direction held on the press = no burst (pure vertical).
const FLAP_FLAP_H_IMPULSE = 7;           // Horizontal velocity (px/tick) added on a directional flap press
const FLAP_H_FRICTION = 0.88;            // Per-tick decay of the horizontal burst (~58px of lunge per flap)
const FLAP_CHARGE_COOLDOWN_MS = 150;     // Min interval between flaps (gives the wing-beat room to read)
const FLAP_STAMINA_COST = 12;            // Liftoff cost only (air flaps are free) — pricier than a dodge since liftoff buys an immune flight + a body-slam; still cheap enough for several flights per bar
const FLAP_LANDING_RECOVERY_MS = 250;    // WHIFF landing endlag — the punish window
// Connecting the body-slam latches the flight and syncs landing recovery to the
// victim's hitstun (BURST_STUN_MS) so the slam grants NO frame advantage.
// The flapper keeps normal flight physics until they touch down — no self
// pushback and no scripted descent on connect.
// Body-slam impulse uses the burst-knockback (no-DI) model so the "drop on
// their head" payoff reads like a real heavy hit. The move has plenty of
// counters (parry, dash the landing, walk under it), so a clean connect earns
// the game's heaviest strike knockback.
const FLAP_BODYSLAM_KB_VELOCITY = BURST_KB_VELOCITY;

// ============================================
// Hit Recovery — smooth Y return when hit at non-ground positions
// ============================================
const HIT_FALL_BASE_MS = 150;              // Min fall duration (near ground)
const HIT_FALL_HEIGHT_SCALE = 1.6;        // Extra ms per unit of height above ground
const HIT_FALL_POP_FRACTION = 0.12;       // Fraction of fall time spent on upward pop
const HIT_FALL_POP_HEIGHT_RATIO = 0.08;   // Pop height as fraction of current height above ground
const SIDESTEP_HIT_RETURN_BASE_MS = 80;   // Base duration for sidestep Y return at max dip depth
const SIDESTEP_HIT_RETURN_MIN_MS = 30;    // Floor — even a tiny dip gets a brief ease

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
const STAMINA_REGEN_INTERVAL_MS = 2000; // regen interval — bumped from 2500 to soften gas pressure
const STAMINA_REGEN_AMOUNT = 8; // per tick

// Charged attack timing
const CHARGE_FULL_POWER_MS = 1000; // Time to reach 100% charge (1 second)

// Stamina costs — every action is a real decision (lowered to slow neutral pacing)
const SLAP_ATTACK_STAMINA_COST = 3; // Baseline poke cost
const CHARGED_ATTACK_STAMINA_COST = 5; // Only a little more than slap — commitment tax is recovery/whiff, not gas
const DODGE_STAMINA_COST = 4; // Deliberate escape

// Stamina drain on victim when hit — light chips only; balance is the real hit tax.
// Slap: none. Charged: ~one slap's worth. Palm: even lighter chip.
const SLAP_HIT_VICTIM_STAMINA_DRAIN = 0;
const CHARGED_HIT_VICTIM_STAMINA_DRAIN = 3;
const PALM_THRUST_HIT_VICTIM_STAMINA_DRAIN = 2;

// ============================================
// Balance System — clinch throw/kill-throw gating
// ============================================
const BALANCE_MAX = 100;
const BALANCE_PASSIVE_REGEN_PER_SEC = 5;        // +5/sec in neutral
const BALANCE_SLAP_HIT_DRAIN = 8;               // Balance lost when hit by a slap
const BALANCE_CHARGED_HIT_DRAIN = 15;           // Balance lost when hit by a charged attack (primary hit tax; stam is a light chip)

// ============================================
// Mutual Clinch System — push/plant/throw interactions
// ============================================

// Clinch push mechanics
// Resource identity: Stamina walks. Balance throws. Plant buys time.
// Winning pressure taxes the LOSER — pusher self-cost is a light lean only.
const CLINCH_PUSH_BASE_SPEED = 1.8;             // Base push speed (scaled by force mult)
const CLINCH_PUSH_STAMINA_DRAIN_PER_SEC = 2;    // Doc rate — light lean (~2/s); see SELF interval
// Phase B push self-tax: 1 stam per 500ms ≈ 2/s (was GRAB_STAMINA_DRAIN 150ms ≈ 6.7/s).
// Phase A burst still uses GRAB_STAMINA_DRAIN_INTERVAL — connect carry stays costly.
const CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL = 500;
const CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL = 200; // -1 / 200ms on pushed neutral ≈ 5/s (was 4/s)
const CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC = 12; // Balance drain on opponent being pushed
const CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC = 4;     // Balance drain on pusher (leaning forward)
const CLINCH_PUSH_VS_PLANT_SPEED_MULT = 0.3;    // Push speed multiplied by this when opponent plants (70% reduction)

// Clinch plant — paid BRAKE: slow the walk + regen bal for a throw/break window.
// Regen 12 vs push drain 12 = net 0 mid-ring (buys time, not a free posture win).
// Edge (1.5× drain) still loses bal. Under push, plant stam upkeep is real (~4.5/s).
const CLINCH_PLANT_BALANCE_REGEN_PER_SEC = 12;
const CLINCH_PLANT_STAMINA_DRAIN_INTERVAL = 1000; // -1 / 1000ms idle plant ≈ 1/s
const CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL = 220; // -1 / 220ms under push ≈ 4.5/s (was 2/s)

// NEUTRAL = BREATHING — the only clinch stance that recovers stamina.
// Only while NOT being pushed — resting must be earned.
const CLINCH_NEUTRAL_STAMINA_REGEN_PER_SEC = 3;

// Push vs push — STAMINA decides who walks. Balance is the throw/pull game.
// Speed: saturating curve on stamina diff. Equal tanks = honest standstill.
const CLINCH_PUSH_VS_PUSH_SPEED_SCALE = 1.0;
const CLINCH_PUSH_VS_PUSH_DEADZONE = 8;         // |stam power diff| at/below → standstill
const CLINCH_PUSH_VS_PUSH_SOFT_MAX_DIFF = 50;   // |diff| that reaches the speed cap
const CLINCH_PUSH_VS_PUSH_MIN_SPEED = 0.65;     // Just past deadzone ≈ 120 px/s
const CLINCH_PUSH_VS_PUSH_MAX_SPEED = 1.45;     // Crush cap ≈ 268 px/s
// Loser of a push war bleeds both meters (scaled by advantage intensity t):
// balance → throwable; stamina → snowball the walk lead.
const CLINCH_PUSH_VS_PUSH_LOSER_BAL_DRAIN_PER_SEC = 10;
const CLINCH_PUSH_VS_PUSH_LOSER_STAM_DRAIN_PER_SEC = 7;
// Momentum ramp — an UNANSWERED push (opponent standing neutral: not pushing
// back, not planting) snowballs instead of drifting at constant speed. After
// the delay, speed climbs linearly to the max multiplier over the rise window.
// Plant and push-back both kill the ramp, so ignoring a push is what's punished.
const CLINCH_PUSH_RAMP_DELAY_MS = 500;          // Unanswered push time before the ramp starts building
const CLINCH_PUSH_RAMP_RISE_MS = 1000;          // Time from ramp start to full multiplier
const CLINCH_PUSH_RAMP_MAX_MULT = 1.6;          // Speed multiplier at full ramp
// Legacy — push-vs-push no longer mixes balance into shove power. Kept exported
// so old docs/tools don't break; unused by grabActionSystem.
const CLINCH_PUSH_STAMINA_WEIGHT = 0.2;

// Clinch gassed push penalty — only gassed players have reduced push power
const CLINCH_GASSED_PUSH_MULT = 0.2;            // 20% push power when gassed

// Continuous fatigue: push force scales with remaining stamina so attrition is a
// felt arc instead of a binary gassed cliff. Force mult lerps 1.0 (full stamina)
// down to the floor (0 stamina, not yet gassed). Gassed overrides with the hard 0.2.
const CLINCH_PUSH_STAMINA_FLOOR = 0.7;          // Push force multiplier at 0 stamina

// Gassed recovery is weaker inside the clinch — prevents the sawtooth where a
// ground-down opponent snaps back to full shove power mid-grind.
const GASSED_RECOVERY_STAMINA_IN_CLINCH = 30;   // vs 55 outside the clinch

// Edge push (at boundary)
const CLINCH_EDGE_STAMINA_DRAIN_PER_SEC = 29;   // Opponent stamina drain at edge (matches burst: 1 per 35ms ≈ 29/sec)
// Dual finish at the ropes: empty tank (stamina ≤ 0) OR continuous pin hold.
// Hold resets if the pin breaks (ease off / space created / movement stops).
const CLINCH_EDGE_PIN_HOLD_MS = 1500;

// Edge zone — amplified danger near the boundary
const CLINCH_EDGE_ZONE_THRESHOLD = 60;           // Pixels from boundary to count as "edge zone"
const CLINCH_EDGE_BALANCE_DRAIN_MULT = 1.5;      // Push balance drain multiplier in edge zone (+50%)
const CLINCH_EDGE_THROW_DRAIN_BONUS = 8;         // Extra throw initiation balance drain at edge
const CLINCH_EDGE_PULL_DRAIN_BONUS = 6;          // Extra pull initiation balance drain at edge

// Stalemate timer
const CLINCH_STALEMATE_DURATION_MS = 7000;       // 7 seconds before forced separation
const CLINCH_STALEMATE_MOVEMENT_THRESHOLD = 15;  // Minimum px position change to reset stalemate
const CLINCH_STALEMATE_BALANCE_THRESHOLD = 8;    // Minimum balance change to reset stalemate

// Clinch separation (forced stalemate break)
const CLINCH_SEPARATION_DISTANCE = 50;           // Distance to push apart on stalemate
const CLINCH_SEPARATION_TWEEN_DURATION = 300;    // Tween duration for separation
const CLINCH_SEPARATION_INPUT_LOCK_MS = 350;     // Input lock after stalemate separation

// Clinch grab attachment
const CLINCH_ATTACHED_DISTANCE = Math.round(75 * 0.96); // ~72px base distance between players in clinch

// Clinch throw system (Mouse2 + W during clinch)
const CLINCH_THROW_ANIMATION_MS = 450;           // Committed throw animation length
const CLINCH_THROW_COOLDOWN_MS = 1200;           // Cooldown after any throw/pull/lift attempt
const CLINCH_THROW_STAMINA_COST = 10;            // Stamina cost for throw/pull attempt (uniform)
const CLINCH_THROW_CLASH_WINDOW_MS = 175;        // Both throw within this → clash
const CLINCH_THROW_BALANCE_DRAIN_VS_PUSH = 20;   // Balance drain on opponent who was pushing (punishes aggression)
const CLINCH_THROW_BALANCE_DRAIN_VS_PLANT = 5;   // Balance drain on opponent who was planting (braced = hard to throw)
const CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL = 10; // Balance drain on neutral opponent
const CLINCH_THROW_FAIL_BALANCE_DRAIN = 4;       // Minimal chip on opponent when throw fails — throws are finishers, not grinders
const CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN = 12; // Attacker loses balance on failed throw — high risk, high reward
const CLINCH_THROW_FAIL_STAMINA_COST = 5;        // Extra stamina cost on failed throw (self-balance drain is the main punishment)

// Clinch pull balance drain (reduced vs throw — pull is repositioning, not balance-breaking)
const CLINCH_PULL_BALANCE_DRAIN_VS_PUSH = 14;    // 70% of throw value
const CLINCH_PULL_BALANCE_DRAIN_VS_PLANT = 4;    // 70% of throw value
const CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL = 7;  // 70% of throw value
const CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN = 6;   // Pull is safer — less self-punishment on fail

// Failed throw/pull stagger — the attacker visibly stumbles, giving the defender
// a readable moment (and making throw-baiting a teachable strategy, not silent attrition)
const CLINCH_THROW_FAIL_STAGGER_MS = 300;        // Attacker forced neutral, no clinch actions

// Counter-grab ARM CLAMP — grabbing a raw-parrying opponent clamps their arms:
// they cannot grip up during the Phase A burst carry, and the grabber's mid-burst
// throw stays untechable. When the clamp ends (burst leaves the lively band,
// max burst duration, or boundary contact), the victim is granted their grip
// automatically — punished once, positionally, then the clinch is a fair fight.
// Arm-clamp ends Phase A earlier than a normal grab so the victim isn't stuck
// in the exponential crawl with zero inputs.
const COUNTER_GRAB_BALANCE_DEBUFF = 10;          // Balance hit on counter-grab connect
const ARM_CLAMP_BURST_END_VELOCITY = 0.55;       // End burst while still shoving (vs GRAB_PUSH_MIN_VELOCITY 0.15)
const ARM_CLAMP_MAX_BURST_MS = 1000;             // Hard cap — ~1s carry; cuts the old ~1.8s crawl, not the shove

// DEEP GRIP — the clinch's earned-advantage layer. Won by out-wrestling the
// opponent inside the clinch (jolting a planter, or winning the push for a
// sustained window); lost when the opponent jolts you, when your throw fails,
// or when the clinch ends. Only one player can hold it at a time.
const DEEP_GRIP_THROW_THRESHOLD_BONUS = 10;      // Throws/pulls land at balance <= 60 (vs 50)
const DEEP_GRIP_PUSH_MULT = 1.1;                 // +10% clinch push force while held
const DEEP_GRIP_PUSH_WIN_MS = 1000;              // Continuous unanswered push time to earn it

// REACT BRACE — snapping to plant DURING an incoming throw/pull startup.
// High-skill reaction option: the stance read at throw-start still applies in
// full, but a plant input landed inside this tight window refunds part of the
// stance-gap drain (never approaching a pre-emptive plant's value). Edge-gated:
// the key must be PRESSED inside the window, holding it from before is the
// pre-read plant and already got the better deal.
const CLINCH_REACT_BRACE_WINDOW_MS = 250;        // Reaction window from throw/pull startup
const CLINCH_REACT_BRACE_REFUND_FRACTION = 0.4;  // Fraction of (stanceDrain - plantDrain) refunded
const CLINCH_REACT_BRACE_STAMINA_COST = 4;       // Stamina price — converts stamina into saved balance

// Clinch tech (clash) cost
const CLINCH_TECH_STAMINA_COST = 8;              // Both players lose stamina on tech — prevents free resets
const CLINCH_THROW_LAND_THRESHOLD = 50;          // Balance at/below which throw lands
const CLINCH_THROW_KILL_THRESHOLD = 15;          // Balance below which = KILL THROW (round over)
const CLINCH_THROW_DISTANCE = 260;               // Forward throw distance — repositioning push
const CLINCH_THROW_ARC_HEIGHT = 100;             // Low hill arc (peak ~80px) — not a big sky launch
const CLINCH_THROW_DURATION_MS = 550;            // Longer travel time for the farther distance
const CLINCH_CLASH_ANIMATION_MS = 400;           // Cosmetic clash animation duration

// Clinch pull system (Mouse2 + away during clinch)
const CLINCH_PULL_ANIMATION_MS = 450;            // Committed pull animation length
const CLINCH_PULL_DISTANCE = 280;                // How far opponent is pulled backward
const CLINCH_PULL_TWEEN_DURATION = 600;          // Tween duration for pull movement
const CLINCH_PULL_INPUT_LOCK_MS = 650;           // Input lock after pull

// Clinch lift/carry system (Mouse2 + W + toward during clinch)
const CLINCH_LIFT_TOTAL_MS = 700;                // Total lift duration (rise + move + descend)
const CLINCH_LIFT_RISE_MS = 150;                 // Time to lift opponent off ground
const CLINCH_LIFT_DESCEND_MS = 150;              // Time to set opponent down
// Kept modest so belt-grab arm overlays can stay glued to the same belt
// contact throughout the carry (client tracks this Δy on the arm layer).
const CLINCH_LIFT_Y_OFFSET = 16;                 // How high opponent is lifted (pixels)
const CLINCH_LIFT_BALANCE_COST = 12;             // Balance cost for lifter
const CLINCH_LIFT_STAMINA_COST = 15;             // Stamina cost for lifter (still the most expensive action)
const CLINCH_LIFT_TARGET_BALANCE_DRAIN = 8;      // Balance drain on target — being lifted is destabilizing

// ============================================
// Cinematic Clinch Kill — exaggerated finishers when balance < kill threshold
// ============================================

// Kill Throw (Mouse2+W): High forward arc — launched above the screen, crashes down
const CLINCH_KILL_THROW_ARC_HEIGHT = 1000;       // High launch (clears screen) without a pure vertical spike
const CLINCH_KILL_THROW_DURATION_MS = 1700;      // Overall snappy air time — keep the speed they liked
const CLINCH_KILL_THROW_HITSTOP_MS = 300;        // Dramatic freeze before the big throw
const CLINCH_KILL_THROW_DISTANCE = 300;          // Slightly more forward travel so the arc reads as a throw, not a pop-up

// Normal Throw (Mouse2+W): Small forward arc — repositioning tool
const CLINCH_THROW_BOUNDARY_MARGIN = 11;         // Stop margin from map edge (matches pull margin)
const CLINCH_THROW_MIN_SEPARATION = 60;          // Min gap between thrower and victim at boundary

// Kill Pull (Mouse2+away): dragged THROUGH the thrower and belly-SLIDES across the ice.
// The sprite is already a flat, grounded penguin, so this leans into a silly/cute slide
// rather than an airborne bounce — a tiny contact jolt, then a long friction glide to a
// stop. The win is already registered; this is purely the "pulled through, slides out" read.
const CLINCH_KILL_PULL_DISTANCE = 210;           // Total glide distance (friction ease-out)
const CLINCH_KILL_PULL_TWEEN_DURATION = 850;     // Slow, weighty slide-to-stop (cute, not a blink)
const CLINCH_KILL_PULL_INPUT_LOCK_MS = 800;      // Longer lock for dramatic finish

// Boundary Pull Swap — when puller's back is against the wall, swap positions instead
const CLINCH_PULL_SWAP_TWEEN_DURATION = 400;     // Quick swap tween (shorter than normal pull)
const CLINCH_PULL_SWAP_ARC_HEIGHT = 55;          // Hop arc height so pulled player clears the puller visually

// Kill Carry (Mouse2+toward): Bouncer march — carry to the edge, no stamina check
const CLINCH_KILL_LIFT_TOTAL_MS = 1500;          // Extended march to the edge (vs 700 normal)
const CLINCH_KILL_LIFT_RISE_MS = 200;            // Slightly longer dramatic lift

// ============================================
// Clinch Jolt System (Mouse1 during clinch)
// Heavy committal chest-shove — the anti-plant read in the push/plant triangle.
// Correct read (vs plant) = dramatic payoff. Wrong read (vs push) = severe punishment.
// Cooldown ensures each jolt is a real decision, not spam.
// ============================================
const CLINCH_JOLT_ANIMATION_MS = 250;           // Telegraphed lunge — opponent can see it and react
const CLINCH_JOLT_RECOVERY_MS = 400;            // Long recovery — real vulnerability if you're wrong
const CLINCH_JOLT_COOLDOWN_MS = 1200;           // One jolt per clinch cycle (matches throw cooldown)
const CLINCH_JOLT_STAMINA_COST = 10;            // Committal cost (matches other big clinch actions)
const CLINCH_JOLT_BALANCE_VS_PLANT = 15;        // Heavy balance damage — correct read rewarded
const CLINCH_JOLT_BALANCE_VS_NEUTRAL = 6;       // Modest — neutral isn't the intended target
const CLINCH_JOLT_BALANCE_VS_PUSH = 0;          // No damage — you lunged into their momentum
const CLINCH_JOLT_SELF_BALANCE_VS_PUSH = 8;     // SELF-DAMAGE on wrong read — jolting a pusher hurts you
const CLINCH_JOLT_PUSH_VS_PLANT = 60;           // 10% of arena — the opponent genuinely feels this
const CLINCH_JOLT_PUSH_VS_NEUTRAL = 15;         // Modest positional gain
const CLINCH_JOLT_PUSH_VS_PUSH = 0;             // No push — you walked into their force
const CLINCH_JOLT_MUTUAL_BALANCE = 6;           // Balance damage on mutual jolt (both)
const CLINCH_JOLT_CLASH_WINDOW_MS = 120;        // Mutual jolt detection window
const CLINCH_JOLT_HITSTOP_MS = 150;             // Dramatic freeze — "that hit LANDED"
const CLINCH_JOLT_MUTUAL_HITSTOP_MS = 120;      // Mutual jolt freeze
const CLINCH_JOLT_PLANT_INTERRUPT_MS = 800;     // Full second of no regen — plant is truly broken
const CLINCH_JOLT_RECOIL_MS = 300;              // Longer recoil — target visibly staggers
const CLINCH_JOLT_GASSED_MULT = 0.5;            // Damage/push multiplier when jolter is gassed
const CLINCH_JOLT_LOCKOUT_VS_PLANT = 550;       // +150ms advantage — jolter can follow up with push
const CLINCH_JOLT_LOCKOUT_VS_NEUTRAL = 400;     // Even (400ms recovery = 400ms lockout)
const CLINCH_JOLT_LOCKOUT_VS_PUSH = 0;          // NO lockout — target recovers instantly, gets free throw attempt

// Gassed state: regen freeze when stamina hits 0
// Longer duration creates a real punish window; bigger recovery prevents immediate re-gas loop
const GASSED_DURATION_MS = 5000; // 5 second penalty — was 3s, felt like a fake reset
const GASSED_RECOVERY_STAMINA = 55; // Granted on exit — enough to actually fight back, not gas in 1 trade

// ============================================
// HITSTOP TUNING - Smash Bros style
// Every hit has hitstop to make impacts feel satisfying
// Scales with power - stronger hits freeze longer
// ============================================
const SLAP_CHAIN_HIT_GAP_MS = 40;  // Minimum visual gap after slap hitstun before victim can be hit again
// Flat slap connect freeze (~8 frames at 60fps). Symmetric (sim clock pauses for
// both), so the +0 frame math is unaffected by hitstop.
const HITSTOP_SLAP_MS = 100;
// Heavy burst-hit freeze (~12 frames) — the "BOOM" for palm thrust / flap
// body-slam class impacts.
const HITSTOP_BURST_MS = 200;
const HITSTOP_CHARGED_MIN_MS = 80;  // Minimum charged attack hitstop (5 frames)
const HITSTOP_CHARGED_MAX_MS = 220; // Max charged hitstop at full power (~13 frames). Bumped from 150 — kill blows feel cinematic.
const HITSTOP_PARRY_MS = 120;     // Regular parry hitstop - impactful but not too long (7 frames)
const HITSTOP_SLAP_PARRY_MS = 45; // Slap clash freeze — shorter than hit hitstop, just enough to register
const HITSTOP_PERFECT_PARRY_MS = 250; // Perfect parry hitstop - the "time stops" moment (15 frames — long enough to digest)
const HITSTOP_GRAB_MS = 60;       // Brief hitstop when grab connects (4 frames)
const HITSTOP_THROW_MS = 100;     // Hitstop when throw lands (6 frames)

// ============================================
// Cinematic Kill — guaranteed ring-out finishing blow
// ============================================
// Charge % a charged hit must reach to be eligible for a cinematic KO. This is a
// CLEAN, LEARNABLE line: it keys off the raw charge the player held, NOT the
// finalKnockbackMultiplier (which is muddied by counter ×1.25 / punish ×1.25 /
// power-up / basho stat mods, so the "how much charge do I need" answer used to
// silently shift between ~57% and ~79% depending on context).
//   - NEUTRAL corner kill (victim pinned at the rope): demands a big commit.
//   - READ kill (counter / punish / gassed, from range): rewards you with a
//     lower bar — the read IS the earn, so less charge is required.
const CHARGED_KILL_MIN_CHARGE = 80;       // neutral, pinned-at-rope KO
const CHARGED_KILL_READ_MIN_CHARGE = 50;  // counter/punish/gassed KO from range

// ── CHARGED CINEMATIC KILL — single "kill reach" model ───────────────────────
// A charged hit rings the victim OUT only if, at contact, they are within
// `killReach` px of the ROPE (MAP_*_BOUNDARY 340/935) they're being knocked
// toward. killReach scales with the FULL power of the hit
// (finalKnockbackMultiplier — which already folds in charge %, the POWER
// power-up / Power Water, BASHO power & resistance stat mods, counter-hit, and
// punish), mapped linearly:
//   mult CHARGED_KILL_MULT_MIN (weakest charge)      → CHARGED_KILL_REACH_MIN
//   mult CHARGED_KILL_MULT_MAX (neutral 100% charge) → CHARGED_KILL_REACH_MAX
// Extra power beyond neutral-full keeps extending the reach along the same slope
// up to CHARGED_KILL_REACH_CAP — so power attributes / power-ups matter even at
// low charge, but can never turn it into a from-anywhere one-shot.
//
// PLAYABLE SPACE: the ring is 595px wide (left rope 340 → right rope 935, center
// 637). The cap guarantees a wide NO-KILL DEADZONE always survives in the
// middle: 595 − 2×CHARGED_KILL_REACH_CAP = 595 − 270 = 325px (~55% of the ring)
// where a charged hit can NEVER ring out no matter the power — it rope-clamps the
// victim at the edge instead (see collisionSystem + index.js). Whole feel = 5 dials.
const CHARGED_KILL_REACH_MIN = 20;   // px from rope at the weakest charge (must be pinned)
const CHARGED_KILL_REACH_MAX = 100;  // px from rope at a neutral 100% charge (outer third of a side)
const CHARGED_KILL_REACH_CAP = 135;  // absolute max reach — the deadzone guard
const CHARGED_KILL_MULT_MIN = 0.45;  // finalKnockbackMultiplier at 0% charge (curve floor)
const CHARGED_KILL_MULT_MAX = 1.2;   // finalKnockbackMultiplier at a neutral 100% charge

// Attacker self-recoil on a NON-lethal charged hit — the backward kick that
// SELLS the impact. Charge-scaled: recoil velocity = 2 × (BASE + charge% ×
// SCALE), so a hard charge produces a punchy front-loaded pop (the "hard, quick"
// feel), a light tap barely nudges. Cinematic kills and palm thrust hold ground
// (no recoil). These are the impact-feel dials — raise BASE for a firmer floor,
// raise SCALE to make big charges kick back harder.
const CHARGED_ATTACKER_RECOIL_BASE = 0.3;         // recoil floor (0% charge)
const CHARGED_ATTACKER_RECOIL_CHARGE_SCALE = 0.5; // extra recoil at 100% charge
// Recoil settles on its OWN fast friction (not the slow global ice coast) so the
// backward kick is a QUICK, HARD pop that stops fast — instead of a long drift
// that shoves the attacker out of pressure range (the "heavy / no advantage"
// feel). Lower = snappier / shorter slide.
const CHARGED_RECOIL_FRICTION = 0.85;
// Attacker recovery AFTER a connected charged hit. Deliberately SHORTER than the
// victim's charged hitstun (~380ms) so a landed charge is PLUS on hit — you
// recover first and can actually use the space/tempo you earned (pressure,
// reposition, threaten a follow-up). This is what makes a non-lethal charge
// USEFUL. Whiff/absorbed recovery is unchanged (still committal & punishable).
const CHARGED_HIT_RECOVERY_MS = 250;

const CINEMATIC_KILL_HITSTOP_MS = 550;
const CINEMATIC_KILL_KNOCKBACK_BOOST = 4.0;
const CINEMATIC_KB_FRICTION = 0.985;
const CINEMATIC_KB_DI_FRICTION = 0.96;
const CINEMATIC_KB_MOVEMENT_TRANSFER = 0.8;
const CINEMATIC_KB_MOVEMENT_FRICTION = 0.996;

// ============================================
// Global Attack Timing
// ============================================
const ATTACK_ENDLAG_SLAP_MS = SLAP_RECOVERY_MS; // Uses frame data (75ms recovery)
const ATTACK_ENDLAG_CHARGED_MS = 300;   // Recovery for charged attacks (was 280)
const ATTACK_COOLDOWN_MS = 50;          // Minimal cooldown for fast gameplay
const BUFFERED_ATTACK_GAP_MS = 80;      // Fast chaining

// ============================================
// Counter-hit / Punish Detection Window
// Centralized so client + server + AI all agree.
// ============================================
const COUNTER_HIT_WINDOW_MS = 150; // Time-since-attack-attempt window where a clean hit becomes a counter

// ============================================
// Charged Attack Lunge Tiers — duration of the forward lunge
// (NOT the hitbox active window; lunge IS the active window now.)
// Charge % thresholds match clearly: light → med → heavy with a scaling tail.
// ============================================
const CHARGED_TIER_LIGHT_MS = 300;        // Tap charge (≤25%): short lunge
const CHARGED_TIER_MED_MS = 500;          // Mid charge (26–75%): full standard lunge
const CHARGED_TIER_HEAVY_BASE_MS = 1000;  // Heavy charge (>75%) base lunge length
const CHARGED_TIER_HEAVY_SCALE_MS = 1000; // Linear scale factor: extra ms per (charge%-50)/50

// ============================================================================
// ============================================================================
//  MASTERY OVERHAUL — TUNING CONSTANTS
// ============================================================================
// ============================================================================
// Every value below is read ONLY on a code path gated behind the matching
// per-phase kill-switch flag in `masteryFlags.js`. With all flags OFF none of
// these are ever touched, so the sim stays byte-identical to today (global
// invariant #4). Each dial ships with its LOUD value (tune loud, playtest, then
// dial back) and its SAFE fallback in a trailing comment. All formulas collapse
// to today's floor at entry velocity 0 / full posture (invariant #2): the new
// effects are ceiling-only.

// ── Phase 1 — Momentum inheritance (MASTERY_P1_MOMENTUM) ────────────────────
// RULE: no verb ever ASSIGNS movementVelocity; verbs BLEND their impulse with
// the velocity carried into them. Only distances change — frames never move
// (invariant #1). The powerslide-capped signed entry velocity is clamped by
// `alignedEntryVelocity` in gameUtils.js.
const MOMENTUM_ENTRY_CLAMP = 2.2; // |aligned entry velocity| cap (powerslide ~2.1)

// MOMENTUM CARRY WINDOW: the crux of "dodge/slide → slap feels reliable". A
// dodge zeroes movementVelocity during its travel and only restores a DECAYING
// slide on landing, so reading raw velocity at the slap-press instant makes the
// boost depend on frame-perfect timing (and buffered presses fire on a random
// tick). Instead, a dodge landing (and an active power slide) STAMPS the earned
// momentum, and the next slap within this window inherits it directly — the
// boost is judged on "did you just dash/slide in?", not on the exact velocity
// the tick you clicked. Consumed on use (one powered entry per dodge/slide).
// Sized to comfortably cover the input-buffer window (200ms) + a tick so a
// buffered mouse1 out of a dodge always lands the inheritance.
const MOMENTUM_WINDOW_MS = 220;

// 1.2 Slap slide inheritance (executeSlapAttack):
//   slideVel = clamp(1.0 + K_SLAP_INHERIT * aligned, SLAP_SLIDE_MIN, SLAP_SLIDE_MAX)
// KNEE (informed by Phase 0 telemetry): slap presses cluster at 0.6–0.8 (walk
// speed) with ~20% at a standstill and virtually NOTHING above 1.4 — the
// 1.4–2.2 dash/powerslide band is empty, and that empty band is the headroom
// this phase exists to make valuable. With the LOUD K (0.55) and MAX (2.0) the
// slide saturates at aligned ≈ 1.82, i.e. the knee sits at the TOP of that empty
// dash band: a walk-speed entry (0.7) earns a modest ×1.39 slide while a
// dash/powerslide entry earns up to the full ×2.0. Walk stays gentle, the
// unused dash band pays out — exactly the rightward shift we want to see in the
// velocity-at-press histogram after this phase. Lower K or MAX to pull the knee
// left if walk-speed entries end up feeling too strong.
const K_SLAP_INHERIT = 0.55; // SAFE 0.35
const SLAP_SLIDE_MIN = 0.45; // fade-away slap floor: a retreating entry produces a short, safe step-in — keep > 0 so the ground-transfer identity survives
const SLAP_SLIDE_MAX = 2.0;

// 1.2 Slap on-hit ground-transfer inheritance (processHit slap branch):
//   momentumMult = 1 + K_SLAP_KB_INHERIT * slapEntryAligned
// scales BOTH the attacker push and the victim drift (each separately capped).
const K_SLAP_KB_INHERIT = 0.45; // SAFE 0.3
const SLAP_ONHIT_ATTACKER_PUSH_CAP = 1.8; // cap on attacker push after momentumMult
const SLAP_ONHIT_VICTIM_DRIFT_CAP = 2.2; // cap on victim drift (total) after momentumMult

// 1.3 Victim-side momentum (getting hit while moving) — slap / charged / flap
// body-slam. Braking before an incoming hit becomes a real, trainable defensive
// skill (upgrades the previously-invisible DI):
//   intoHit = alignedEntryVelocity(victimEntryV, knockbackDirection * -1)
//   kbScale = 1 + K_VICTIM_INTO*max(0,intoHit) - K_VICTIM_BRACE*max(0,-intoHit)
//   knockbackVelocity.x *= clamp(kbScale, VICTIM_KB_SCALE_MIN, VICTIM_KB_SCALE_MAX)
const K_VICTIM_INTO = 0.35; // SAFE 0.2
const K_VICTIM_BRACE = 0.2; // SAFE 0.12
const VICTIM_KB_SCALE_MIN = 0.7;
const VICTIM_KB_SCALE_MAX = 1.6;

// 1.4 Dodge landing inheritance (index.js dodge landing):
//   landingMomentum = clamp(DODGE_LANDING_BASE + K_DODGE_INHERIT * dodgeEntrySpeed,
//                           DODGE_LANDING_MIN, DODGE_LANDING_MAX)
// The powerslide (C held) path multiplies this same base by
// DODGE_POWERSLIDE_BOOST. Dash becomes the runway-free momentum generator:
// walk→dodge→slap chains carry real speed. Floor == today's DODGE_SLIDE_MOMENTUM.
const DODGE_LANDING_BASE = 0.9;
const K_DODGE_INHERIT = 0.6; // SAFE 0.4
const DODGE_LANDING_MIN = 1.1; // == DODGE_SLIDE_MOMENTUM (today's floor)
const DODGE_LANDING_MAX = 1.7; // SAFE cap 1.5

// 1.5 Grab burst momentum transfer retune (grabActionSystem push burst).
// Replaces GRAB_PUSH_MOMENTUM_TRANSFER (0.6) while the flag is on — the grab is
// the template inheritance mechanic; keep its feel, just make it bite harder.
const GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY = 0.75; // SAFE 0.65

// 1.6 Palm matador (optional, same flag). The palm stays ROOTED (no slide
// inheritance), but a read on a CHARGING opponent uses their own closing speed
// against them:
//   palmKb = min(PALM_THRUST_KB_VELOCITY + K_PALM_MATADOR*max(0,closingSpeed),
//                PALM_MATADOR_KB_CAP)
// The cap keeps the flap body-slam (3.1) the heaviest strike. NOTE: because the
// matador already rewards the victim's closing speed, the palm does NOT also
// take the generic 1.3 victim-into scale (that would double-count the same
// closing speed and blow past the 3.1 strike-tier cap the spec fixes here); the
// matador IS the palm's momentum treatment. At closingSpeed 0 it collapses to
// today's 2.4 (floor preserved).
const K_PALM_MATADOR = 0.5;
const PALM_MATADOR_KB_CAP = 3.1;

// ── Phase 2 — Posture coupling (MASTERY_P2_POSTURE) ─────────────────────────
// Striking becomes the SETUP layer; grabs (yotsu) and the edge (oshi) become
// the CONVERSION layers, both gated by the opponent's POSTURE (the existing
// `balance` stat — renamed in the UI only, the server field stays `balance`).
// Every value below is read ONLY on a path gated behind MASTERY_P2_POSTURE:
// with the flag OFF the posture drains fall back to today's BALANCE_* constants,
// the kill bands collapse to SLAP_KILL_RANGE / CHARGED_KILL_REACH_CAP, and
// isPostureBroken is forced false — so the sim is byte-identical (invariants
// #2 & #4). Bands may only EXPAND with earned quality, never shrink, and the
// KILLBAND_CAP / CHARGED_KILL_REACH_CAP keep the midscreen deadzone (invariant #3).

// 2.1 Broken-posture derived state. Hysteresis prevents flicker: posture BREAKS
// when balance drops below the break threshold and only RECOVERS once it climbs
// back above the (higher) recover threshold. This is the game's readable
// "openable" tell (client stagger overlay + posture-crack SFX on the break edge).
const POSTURE_BREAK_THRESHOLD = 35;      // balance < this ⇒ isPostureBroken = true
const POSTURE_RECOVER_THRESHOLD = 45;    // balance > this ⇒ isPostureBroken = false

// 2.2 Drains & regen — the hand-fight now has an arc. These SHADOW today's
// BALANCE_* constants and are substituted ONLY while the flag is on (LOUD ship
// values; SAFE fallbacks noted). Counter-hits multiply the posture drain by
// POSTURE_COUNTER_DRAIN_MULT (their frame bonus is unchanged). Perfect parry's
// existing +12 balance refund is kept as-is (it's now a posture swing for free).
const BALANCE_SLAP_HIT_DRAIN_P2 = 7;        // was 12 — a single slap chipped posture absurdly fast (a few slaps ≈ a break). 7 makes the slap a POKE that chips; posture pressure now comes from reads (AP, palm, counters), not raw mash.
const BALANCE_CHARGED_HIT_DRAIN_P2 = 18;    // today 15; SAFE 16
const BALANCE_PALM_HIT_DRAIN_P2 = 20;       // today 15 (charged); SAFE 18 — the posture-breaker identity
const BALANCE_PASSIVE_REGEN_PER_SEC_P2 = 6; // today 5;  SAFE 5 — disengaging resets the war a touch faster
const POSTURE_COUNTER_DRAIN_MULT = 1.5;     // counter-hits drain ×1.5 posture

// 2.4 Oshi conversion — momentum + posture EXPAND the edge kill band (they may
// only widen it; invariant #3). Slap/palm/flap-slam band:
//   band = SLAP_KILL_RANGE
//        + KILLBAND_MOMENTUM * min(slapEntryAligned, KILLBAND_MOMENTUM_REF)/KILLBAND_MOMENTUM_REF
//        + (victim.isPostureBroken ? KILLBAND_POSTURE : 0)
//   band = min(band, KILLBAND_CAP)
// Palm/flap carry no slapEntryAligned (rooted / airborne), so their momentum
// term is 0 and only the posture term widens their band — exactly as intended.
const KILLBAND_MOMENTUM = 25;          // SAFE 15 — extra band from a full-momentum entry
const KILLBAND_MOMENTUM_REF = 1.3;     // aligned entry velocity that saturates the momentum term
const KILLBAND_POSTURE = 30;           // SAFE 20 — extra band vs a broken-posture victim
const KILLBAND_CAP = 110;              // absolute max slap/palm/flap kill band (deadzone guard)
// Charged edge lethality vs broken posture: killReach *= this, still hard-capped
// by CHARGED_KILL_REACH_CAP (135) so the 595 − 2×135 = 325px midscreen no-kill
// deadzone survives the worst case (invariant #3).
const POSTURE_CHARGED_KILL_REACH_MULT = 1.25;

// ── Phase 3 — Tsuppari cadence (MASTERY_P3_CADENCE) ─────────────────────────
// The contact-range slap war becomes a RHYTHM skill. Reward-only: mashing keeps
// today's exact behavior (an early-buffered press is a large gap → never
// enhanced), while a press timed LATE & precise inside the cycle earns an
// enhanced slap. Every value below is read ONLY on a path gated behind
// MASTERY_P3_CADENCE; with the flag OFF isEnhancedSlap is never set, cadenceChain
// stays 0, and the slap uses SLAP_TOTAL_MS / BALANCE_SLAP_HIT_DRAIN_P2 exactly as
// today — byte-identical (invariants #2 & #4). The frame change here is the ONE
// deliberate, explicit cadence dial the invariants carve out (#1 exception): it
// SHORTENS the winner's own cycle, and because the slap's +0 is derived from the
// attacker's remaining cycle at connect (processHit), an enhanced slap stays +0
// automatically — both players simply become actionable sooner together.
//
// Netcode: the window is judged on the SIM CLOCK via the existing buffer
// timestamp (never packet arrival) — 60ms ≥ 4 ticks covers the 16ms client emit
// granularity + jitter (rollout protocol note 5).
const CADENCE_WINDOW_MS = 85;          // gap ≤ this (cycleEnd − buffered press) ⇒ enhanced.
                                       // Widened 60→85 so a human can land the rhythm without
                                       // frame-perfect input (still well short of the full cycle,
                                       // so mashing/early-buffered presses stay normal).
const SLAP_TOTAL_MS_ENHANCED = 205;    // SAFE 215 — enhanced cycle (today 230); startup/active
                                       // are untouched, only the recovery tail shortens (still +0)
const BALANCE_SLAP_HIT_DRAIN_ENHANCED = 10; // was 16 — scaled down with the base slap drain (P2 base now 7); a cadence slap still bites a bit harder than a plain one
const CADENCE_STEP_IN_MULT = 1.15;     // SAFE 1.1 — enhanced on-hit pair shift (step-in) scale
// CPU cadence competence by difficulty tier — the fraction of follow-up slaps a
// CPU times INTO the window (rollout protocol / cross-phase CPU table). EASY
// never cadences (difficulty firewall: the overhaul raises the ceiling, not the
// floor); the ladder climbs to near-mastery at IMPOSSIBLE.
const CPU_CADENCE_EASY = 0.0;
const CPU_CADENCE_NORMAL = 0.25;
const CPU_CADENCE_HARD = 0.6;
const CPU_CADENCE_IMPOSSIBLE = 0.92;

// ── Phase 4 — Analog resolutions & risk dials (MASTERY_P4_ANALOG) ───────────
// Table cliffs become continuous CURVES, and the player gets to DIAL their own
// variance on every connect. Every value below is read ONLY on a path gated
// behind MASTERY_P4_ANALOG; with the flag OFF the parry payouts, clash shove,
// charge duration, spacing bonus, follow-through shift and counter-hit window
// all collapse to today's exact constants — byte-identical (invariants #2 & #4).
// Each sub-item is independently flag-testable (they all read the ONE flag), and
// every curve keeps today's value as its floor endpoint so nothing shrinks below
// the documented behavior.

// 4.1 Parry quality curve. Inside the perfect window the payout is graded by
// HOW EARLY in the window the parry landed:
//   quality      = clamp(1 − parryDuration / PERFECT_PARRY_WINDOW, 0, 1)  // 1 = frame-perfect
//   attackerStun = lerp(PERFECT_PARRY_ATTACKER_STUN_DURATION, _MAX, quality)
//   parryShove   = lerp(PERFECT_PARRY_KNOCKBACK,              _MAX, quality)
//   postureRefund= round(lerp(PERFECT_PARRY_BALANCE_REFUND,   _MAX, quality))
// At quality 0 (a parry landing exactly at the window edge) every term equals
// today's base constant (700 / 0.65 / 12) — floor preserved. Regular
// (non-perfect) parries are untouched. Tens-of-ms grading = thousand-hour skill.
const PERFECT_PARRY_ATTACKER_STUN_MAX = 880; // base PERFECT_PARRY_ATTACKER_STUN_DURATION 700; SAFE 820
const PERFECT_PARRY_KNOCKBACK_MAX = 0.95;    // base PERFECT_PARRY_KNOCKBACK 0.65; SAFE 0.85
const PERFECT_PARRY_BALANCE_REFUND_MAX = 20; // base PERFECT_PARRY_BALANCE_REFUND 12; SAFE 18

// 4.2 Tip / deep slap spacing. One threshold (continuous enough via positioning;
// may become a true curve later if it reads well): a slap that connects at the
// TIP of its range rewards the spacing (more posture damage + a touch more
// drift); a DEEP (point-blank) slap is today's baseline. Distance measured
// attacker↔victim at connect.
const SLAP_TIP_DISTANCE = 120;      // d > this ⇒ tip; d ≤ this ⇒ deep (baseline)
const SLAP_TIP_POSTURE_MULT = 1.3;  // SAFE 1.2 — tip slap posture drain scale
const SLAP_TIP_DRIFT_MULT = 1.1;    // SAFE 1.05 — tip slap victim drift scale

// 4.3 Clash margin scaling. The decisive (non-neutral) slap-clash outcome stops
// being a fixed WINNER/LOSER pair and scales with the timing MARGIN between the
// two presses: a razor-thin win barely shoves, a clean first-move win sends:
//   t        = clamp((gap − CLASH_MARGIN_MIN_MS) / (CLASH_MARGIN_MAX_MS − CLASH_MARGIN_MIN_MS), 0, 1)
//   loserKb  = lerp(CLASH_LOSER_KB_MIN,  CLASH_LOSER_KB_MAX,  t)
//   winnerKb = lerp(CLASH_WINNER_KB_MAX, CLASH_WINNER_KB_MIN, t)  // more margin ⇒ winner holds ground harder
// Neutral (genuine tie) case is unchanged; recovery stays symmetric (fairness).
const CLASH_MARGIN_MIN_MS = 30;   // == SLAP_PARRY_NEUTRAL_WINDOW_MS (the smallest decisive gap)
const CLASH_MARGIN_MAX_MS = 45;   // == SLAP_PARRY_WINDOW — saturate within clashable gaps
const CLASH_LOSER_KB_MIN = 3.5;   // razor-thin loss shove
const CLASH_LOSER_KB_MAX = 5.8;   // clean-loss shove
const CLASH_WINNER_KB_MAX = 1.2;  // razor-thin win: winner still pops back a little
const CLASH_WINNER_KB_MIN = 0.6;  // clean win: winner holds center

// 4.4 Continuous charge. Replaces the 300/500/1000 lunge-tier buckets with a
// smooth curve that matches the old endpoints (charge 0 → 300ms, charge 100 →
// 2000ms) and keeps low-charge lunges short:
//   attackDuration = CHARGE_DURATION_BASE_MS + CHARGE_DURATION_SCALE_MS * (charge/100)^CHARGE_DURATION_EXP
// The priority threshold (30) and kill gates (50 / 80) are unchanged — those
// stay legible bets.
const CHARGE_DURATION_BASE_MS = 300;
const CHARGE_DURATION_SCALE_MS = 1700;
const CHARGE_DURATION_EXP = 1.6;

// 4.5 Risk dials (the compounding layer — most sensitive, tune last).
// FOLLOW-THROUGH: on a slap connect the attacker's HELD direction is a
// player-chosen bet. Holding TOWARD the victim commits — a bigger pair-shift
// (more ground) but +FOLLOW_THROUGH_TOWARD_RECOVERY_MS of recovery, making the
// hand slightly MINUS (the victim can answer). Holding AWAY fades — a smaller
// shift but −FOLLOW_THROUGH_AWAY_RECOVERY_MS recovery, slightly PLUS with less
// ground. A NEUTRAL hand keeps today's +0 default (shift ×1, no recovery
// change) so a flat slap is byte-identical. Recovery is adjusted on the
// ATTACKER's cycle only (the victim's hitstun is derived from the base cycle),
// which is the ONE deliberate, explicit frame dial the invariants carve out for
// Phase 4 (invariant #1 exception) — never a momentum-driven frame change.
const FOLLOW_THROUGH_TOWARD_SHIFT = 1.35;      // SAFE 1.25
const FOLLOW_THROUGH_AWAY_SHIFT = 0.8;         // SAFE 0.9
const FOLLOW_THROUGH_TOWARD_RECOVERY_MS = 25;  // attacker recovery LENGTHENED (slightly minus)
const FOLLOW_THROUGH_AWAY_RECOVERY_MS = 10;    // attacker recovery SHORTENED (slightly plus)
// CPU follow-through usage by archetype (rollout / cross-phase CPU table). A
// pusher biases follow-through (commit), a counter biases fade; IMPOSSIBLE
// presses the edge (deterministic follow-through) on a broken-posture victim
// already within CPU_FOLLOW_THROUGH_EDGE_RANGE of their rope. Non-archetype
// CPUs (PvP/VS-CPU have none) resolve to neutral → today's +0 slap.
const CPU_FOLLOW_THROUGH_PUSHER = 0.7;
const CPU_FOLLOW_THROUGH_COUNTER_FADE = 0.7;
const CPU_FOLLOW_THROUGH_EDGE_RANGE = 150;
// COUNTER-HIT HONESTY: counters now feed a ×1.5 posture drain (Phase 2), so the
// "I just intended to attack" pure-intent counter must be an earned READ, not a
// free tag. The intent-only window shrinks 150→100ms (the active-startup counter
// case keeps the full COUNTER_HIT_WINDOW_MS). Flag off ⇒ both use 150 (today).
const COUNTER_HIT_INTENT_WINDOW_MS = 100; // SAFE 120

// ── MASTERY OVERHAUL — Phase 5 (assist removal & legibility) ────────────────
// Flag: MASTERY_P5_ASSISTS. This phase removes the two positional assists that
// let a table/auto-correct do the reading FOR the player, so spacing and facing
// become skills. LOUD values ship first; SAFE fallbacks noted for the dial-back.
// With the flag off, none of these are consulted — the sim is byte-identical.
//
// 5.1 GRAB SIDESTEP-TRACKING: today a grab tracks a sidestepping opponent from
// up to SIDESTEP_GRAB_TRACK_RANGE (400) away — a full-arena "the table catches
// the henka for you" assist. Phase 5 tightens it so a POINT-BLANK read still
// catches the sidestep startup/recovery, but a spaced sidestep escapes: spacing
// becomes the answer, not the auto-track. Flag off ⇒ the 400 range is used.
const SIDESTEP_GRAB_TRACK_RANGE_P5 = 220; // SAFE 280 — LOUD tightening (today 400)
// 5.2 LEGIBILITY THRESHOLDS (client-facing tells; server computes the trigger):
// speed-state spray/lean turns on above this |movementVelocity|, and a hit is
// tagged a "momentum hit" (heavier spark + deeper SFX) once its on-hit ground
// transfer multiplier clears MOMENTUM_HIT_MULT_THRESHOLD. Both are read-only
// presentation gates — they never touch a distance or a frame.
const SPEED_STATE_VELOCITY_THRESHOLD = 0.9; // |movementVelocity| above which snow-spray + lean read
const MOMENTUM_HIT_MULT_THRESHOLD = 1.25;   // on-hit momentumMult above which the heavy-hit tell fires

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
  SLAP_PARRY_NEUTRAL_WINDOW_MS,
  SLAP_PARRY_RECOVERY_MS,
  SLAP_PARRY_HITSTOP_MS,
  SLAP_PARRY_KNOCKBACK_WINNER,
  SLAP_PARRY_KNOCKBACK_LOSER,
  SLAP_PARRY_KNOCKBACK_NEUTRAL,
  SLAP_PARRY_KB_FRICTION,
  SLAP_PARRY_TIP_SEPARATION,
  GRAB_RANGE,
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
  MAX_MOVE_SPEED_MULT,
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
  CHARGED_KILL_EDGE_ZONE,
  ICE_EDGE_BRAKE_BONUS,
  ICE_EDGE_SLIDE_PENALTY,

  // Legacy movement aliases
  MOVEMENT_DECELERATION,
  MOVEMENT_MOMENTUM,
  MOVEMENT_FRICTION,
  ICE_DRIFT_FACTOR,
  MIN_MOVEMENT_THRESHOLD,

  // Frame data
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  SLAP_TOTAL_MS,
  SLAP_WHIFF_EXTRA_RECOVERY_MS,
  BURST_KB_VELOCITY,
  BURST_STUN_MS,
  BURST_KB_FRICTION,
  SLAP_KILL_RANGE,
  SLAP_ROPE_RESIST_BUFFER,
  SLAP_ONHIT_ATTACKER_PUSH,
  SLAP_ONHIT_VICTIM_DRIFT,
  SLAP_COUNTER_HIT_BONUS_MS,
  SLAP_COUNTER_KB_MULT,
  SLAP_MIN_HITSTUN_MS,
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MS,
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  PALM_THRUST_HOLD_MS,
  PALM_THRUST_END_RECOVERY_MS,
  PALM_THRUST_HIT_RECOVERY_MS,
  PALM_THRUST_POWER,
  PALM_THRUST_KB_VELOCITY,
  PALM_THRUST_STAMINA_COST,
  PALM_THRUST_HITBOX_DISTANCE_VALUE,
  LOW_KICK_ENABLED,
  LOW_KICK_STARTUP_MS,
  LOW_KICK_ACTIVE_MS,
  LOW_KICK_RECOVERY_MS,
  LOW_KICK_HIT_RECOVERY_MS,
  LOW_KICK_TOTAL_MS,
  LOW_KICK_STAMINA_COST,
  LOW_KICK_HITBOX_DISTANCE_VALUE,
  LOW_KICK_KB_VELOCITY,
  LOW_KICK_BALANCE_DRAIN,
  LOW_KICK_BALANCE_DRAIN_VS_PARRY,
  LOW_KICK_BALANCE_DRAIN_COUNTER,
  GRAB_STARTUP_MS,
  GRAB_ACTIVE_MS,
  DODGE_STARTUP_MS,
  DODGE_ACTIVE_MS,
  DODGE_RECOVERY_MS,
  DODGE_TOTAL_MS,
  DODGE_COOLDOWN_MS,

  // Sidestep
  SIDESTEP_STARTUP_MS,
  SIDESTEP_ACTIVE_MS,
  SIDESTEP_RECOVERY_MS,
  SIDESTEP_TOTAL_MS,
  SIDESTEP_STAMINA_COST,
  SIDESTEP_TRAVEL,
  SIDESTEP_TRAVEL_EDGE,
  SIDESTEP_ARC_DEPTH,
  SIDESTEP_GRAB_TRACK_RANGE,
  SIDESTEP_RECOVERY_OVERLAP_THRESHOLD,

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
  GRAB_STARTUP_ARMOR_STAGGER_MS,
  SLAP_ATTACK_STARTUP_MS,
  GRAB_WHIFF_RECOVERY_MS,
  GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION,
  GRAB_BREAK_RESIDUAL_VEL,
  GRAB_BREAK_INPUT_LOCK_MS,
  GRAB_BREAK_ACTION_LOCK_MS,
  GRAB_BREAK_GRAB_IMMUNITY_MS,
  GRAB_STAMINA_DRAIN_INTERVAL,

  // Grab action system
  GRAB_PUSH_BURST_BASE,
  GRAB_PUSH_MOMENTUM_TRANSFER,
  GRAB_CATCH_MIN_BURST_SPEED,
  GRAB_PUSH_DECAY_RATE,
  GRAB_PUSH_MIN_VELOCITY,
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

  // Input Buffering
  INPUT_BUFFER_WINDOW_MS,

  // Ring-out
  RINGOUT_THROW_DURATION_MS,

  // Parry system
  RAW_PARRY_KNOCKBACK,
  RAW_PARRY_SLAP_KNOCKBACK,
  PERFECT_PARRY_KNOCKBACK,
  PERFECT_PARRY_WINDOW,
  PERFECT_PARRY_SUCCESS_DURATION,
  PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PERFECT_PARRY_ANIMATION_LOCK,
  PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK,
  RAW_PARRY_MIN_DURATION,
  RAW_PARRY_MAX_DURATION,
  RAW_PARRY_COOLDOWN_MS,
  RAW_PARRY_REARM_STAMINA_COST,
  RAW_PARRY_REARM_INTERVAL_MS,
  MAX_PARRY_BACKDATE_MS,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_STAMINA_COST,
  RAW_PARRY_STAMINA_REFUND,
  PERFECT_PARRY_BALANCE_REFUND,
  // Guard & Parry (AP)
  AP_ACTIVE_MS,
  AP_LATE_PARRY_MS,
  AP_FLOW_WINDOW_MS,
  AP_SUCCESS_RECOVERY_MS,
  AP_WHIFF_RECOVERY_MS,
  AP_COOLDOWN_MS,
  AP_STAMINA_COST,
  AP_KILL_THRESHOLD,
  AP_PERFECT_KILL_THRESHOLD,
  AP_BALANCE_DRAIN,
  AP_PERFECT_BALANCE_DRAIN,
  AP_ATTACKER_KNOCKBACK,
  AP_PERFECT_ATTACKER_KNOCKBACK,
  AP_HITSTOP_MS,
  AP_PERFECT_HITSTOP_MS,
  AP_KILL_HITSTOP_MS,
  AP_PERFECT_BALANCE_REFUND,
  AP_STAGGER_SLAP_MS,
  AP_STAGGER_PALM_MS,
  AP_STAGGER_FLAP_MS,
  AP_PERFECT_ADVANTAGE_MS,
  AP_FLURRY_STAGGER_BEGIN_MS,
  AP_FLURRY_SLACK_MS,
  AP_FLURRY_COVER_MS,
  AP_KILL_SLIDE_DISTANCE,
  AP_KILL_SLIDE_DURATION_MS,
  // Guard (block floor)
  GUARD_SLAP_BALANCE_CHIP,
  GUARD_PALM_BALANCE_CHIP,
  GUARD_SLAP_STAMINA_DRAIN,
  GUARD_PALM_STAMINA_DRAIN,
  GUARD_SLAP_PUSHBACK,
  GUARD_PALM_PUSHBACK,
  GUARD_HITSTOP_MS,
  GUARD_CRUSH_STUN_MS,
  SLAP_TRADE_WINDOW_MS,
  SLAP_TRADE_KNOCKBACK,

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
  ROPE_JUMP_CENTER_FRACTION,

  // Flap
  FLAP_STARTUP_MS,
  FLAP_CHARGES,
  FLAP_LIFTOFF_IMPULSE,
  FLAP_IMPULSE,
  FLAP_GRAVITY,
  FLAP_MAX_HEIGHT,
  FLAP_AIR_MOVE_SPEED,
  FLAP_FASTFALL_GRAVITY,
  FLAP_DIVE_MIN_DOWN_VELOCITY,
  FLAP_FASTFALL_AIR_MOVE_SPEED,
  FLAP_CEILING_CUSHION,
  FLAP_CEILING_HANG_GRAVITY,
  FLAP_FLAP_H_IMPULSE,
  FLAP_H_FRICTION,
  FLAP_CHARGE_COOLDOWN_MS,
  FLAP_STAMINA_COST,
  FLAP_LANDING_RECOVERY_MS,
  FLAP_BODYSLAM_KB_VELOCITY,

  // Hit recovery
  HIT_FALL_BASE_MS,
  HIT_FALL_HEIGHT_SCALE,
  HIT_FALL_POP_FRACTION,
  HIT_FALL_POP_HEIGHT_RATIO,
  SIDESTEP_HIT_RETURN_BASE_MS,
  SIDESTEP_HIT_RETURN_MIN_MS,

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
  PALM_THRUST_HIT_VICTIM_STAMINA_DRAIN,
  GASSED_DURATION_MS,
  GASSED_RECOVERY_STAMINA,

  // Balance system
  BALANCE_MAX,
  BALANCE_PASSIVE_REGEN_PER_SEC,
  BALANCE_SLAP_HIT_DRAIN,
  BALANCE_CHARGED_HIT_DRAIN,

  // Mutual clinch system
  CLINCH_PUSH_BASE_SPEED,
  CLINCH_PUSH_STAMINA_DRAIN_PER_SEC,
  CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL,
  CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC,
  CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC,
  CLINCH_PUSH_VS_PLANT_SPEED_MULT,
  CLINCH_PLANT_BALANCE_REGEN_PER_SEC,
  CLINCH_PLANT_STAMINA_DRAIN_INTERVAL,
  CLINCH_NEUTRAL_STAMINA_REGEN_PER_SEC,
  CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL,
  CLINCH_PUSH_VS_PUSH_SPEED_SCALE,
  CLINCH_PUSH_VS_PUSH_DEADZONE,
  CLINCH_PUSH_VS_PUSH_SOFT_MAX_DIFF,
  CLINCH_PUSH_VS_PUSH_MIN_SPEED,
  CLINCH_PUSH_VS_PUSH_MAX_SPEED,
  CLINCH_PUSH_VS_PUSH_LOSER_BAL_DRAIN_PER_SEC,
  CLINCH_PUSH_VS_PUSH_LOSER_STAM_DRAIN_PER_SEC,
  CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL,
  CLINCH_PUSH_STAMINA_WEIGHT,
  CLINCH_PUSH_RAMP_DELAY_MS,
  CLINCH_PUSH_RAMP_RISE_MS,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_REACT_BRACE_WINDOW_MS,
  CLINCH_REACT_BRACE_REFUND_FRACTION,
  CLINCH_REACT_BRACE_STAMINA_COST,
  CLINCH_GASSED_PUSH_MULT,
  CLINCH_PUSH_STAMINA_FLOOR,
  GASSED_RECOVERY_STAMINA_IN_CLINCH,
  CLINCH_THROW_FAIL_STAGGER_MS,
  COUNTER_GRAB_BALANCE_DEBUFF,
  ARM_CLAMP_BURST_END_VELOCITY,
  ARM_CLAMP_MAX_BURST_MS,
  DEEP_GRIP_THROW_THRESHOLD_BONUS,
  DEEP_GRIP_PUSH_MULT,
  DEEP_GRIP_PUSH_WIN_MS,
  CLINCH_EDGE_STAMINA_DRAIN_PER_SEC,
  CLINCH_EDGE_PIN_HOLD_MS,
  CLINCH_EDGE_ZONE_THRESHOLD,
  CLINCH_EDGE_BALANCE_DRAIN_MULT,
  CLINCH_EDGE_THROW_DRAIN_BONUS,
  CLINCH_EDGE_PULL_DRAIN_BONUS,
  CLINCH_STALEMATE_DURATION_MS,
  CLINCH_STALEMATE_MOVEMENT_THRESHOLD,
  CLINCH_STALEMATE_BALANCE_THRESHOLD,
  CLINCH_SEPARATION_DISTANCE,
  CLINCH_SEPARATION_TWEEN_DURATION,
  CLINCH_SEPARATION_INPUT_LOCK_MS,
  CLINCH_ATTACHED_DISTANCE,

  // Clinch throw/pull/lift
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_COOLDOWN_MS,
  CLINCH_THROW_STAMINA_COST,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_BALANCE_DRAIN_VS_PUSH,
  CLINCH_THROW_BALANCE_DRAIN_VS_PLANT,
  CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_THROW_FAIL_BALANCE_DRAIN,
  CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN,
  CLINCH_THROW_FAIL_STAMINA_COST,
  CLINCH_PULL_BALANCE_DRAIN_VS_PUSH,
  CLINCH_PULL_BALANCE_DRAIN_VS_PLANT,
  CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN,
  CLINCH_TECH_STAMINA_COST,
  CLINCH_THROW_LAND_THRESHOLD,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_DISTANCE,
  CLINCH_THROW_ARC_HEIGHT,
  CLINCH_THROW_DURATION_MS,
  CLINCH_CLASH_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_PULL_DISTANCE,
  CLINCH_PULL_TWEEN_DURATION,
  CLINCH_PULL_INPUT_LOCK_MS,
  CLINCH_LIFT_TOTAL_MS,
  CLINCH_LIFT_RISE_MS,
  CLINCH_LIFT_DESCEND_MS,
  CLINCH_LIFT_Y_OFFSET,
  CLINCH_LIFT_BALANCE_COST,
  CLINCH_LIFT_STAMINA_COST,
  CLINCH_LIFT_TARGET_BALANCE_DRAIN,

  // Cinematic clinch kills
  CLINCH_KILL_THROW_ARC_HEIGHT,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_THROW_HITSTOP_MS,
  CLINCH_KILL_THROW_DISTANCE,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_KILL_PULL_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CLINCH_PULL_SWAP_ARC_HEIGHT,
  CLINCH_KILL_LIFT_TOTAL_MS,
  CLINCH_KILL_LIFT_RISE_MS,

  // Clinch jolt system
  CLINCH_JOLT_ANIMATION_MS,
  CLINCH_JOLT_RECOVERY_MS,
  CLINCH_JOLT_COOLDOWN_MS,
  CLINCH_JOLT_STAMINA_COST,
  CLINCH_JOLT_BALANCE_VS_PLANT,
  CLINCH_JOLT_BALANCE_VS_NEUTRAL,
  CLINCH_JOLT_BALANCE_VS_PUSH,
  CLINCH_JOLT_SELF_BALANCE_VS_PUSH,
  CLINCH_JOLT_PUSH_VS_PLANT,
  CLINCH_JOLT_PUSH_VS_NEUTRAL,
  CLINCH_JOLT_PUSH_VS_PUSH,
  CLINCH_JOLT_MUTUAL_BALANCE,
  CLINCH_JOLT_CLASH_WINDOW_MS,
  CLINCH_JOLT_HITSTOP_MS,
  CLINCH_JOLT_MUTUAL_HITSTOP_MS,
  CLINCH_JOLT_PLANT_INTERRUPT_MS,
  CLINCH_JOLT_RECOIL_MS,
  CLINCH_JOLT_GASSED_MULT,
  CLINCH_JOLT_LOCKOUT_VS_PLANT,
  CLINCH_JOLT_LOCKOUT_VS_NEUTRAL,
  CLINCH_JOLT_LOCKOUT_VS_PUSH,

  // Hitstop
  SLAP_CHAIN_HIT_GAP_MS,
  HITSTOP_SLAP_MS,
  HITSTOP_BURST_MS,
  HITSTOP_CHARGED_MIN_MS,
  HITSTOP_CHARGED_MAX_MS,
  HITSTOP_PARRY_MS,
  HITSTOP_SLAP_PARRY_MS,
  HITSTOP_PERFECT_PARRY_MS,
  HITSTOP_GRAB_MS,
  HITSTOP_THROW_MS,

  // Attack timing
  ATTACK_ENDLAG_SLAP_MS,
  ATTACK_ENDLAG_CHARGED_MS,
  ATTACK_COOLDOWN_MS,
  BUFFERED_ATTACK_GAP_MS,

  COUNTER_HIT_WINDOW_MS,
  CHARGED_TIER_LIGHT_MS,
  CHARGED_TIER_MED_MS,
  CHARGED_TIER_HEAVY_BASE_MS,
  CHARGED_TIER_HEAVY_SCALE_MS,

  // ── MASTERY OVERHAUL — Phase 1 (momentum inheritance) ──
  MOMENTUM_ENTRY_CLAMP,
  MOMENTUM_WINDOW_MS,
  K_SLAP_INHERIT,
  SLAP_SLIDE_MIN,
  SLAP_SLIDE_MAX,
  K_SLAP_KB_INHERIT,
  SLAP_ONHIT_ATTACKER_PUSH_CAP,
  SLAP_ONHIT_VICTIM_DRIFT_CAP,
  K_VICTIM_INTO,
  K_VICTIM_BRACE,
  VICTIM_KB_SCALE_MIN,
  VICTIM_KB_SCALE_MAX,
  DODGE_LANDING_BASE,
  K_DODGE_INHERIT,
  DODGE_LANDING_MIN,
  DODGE_LANDING_MAX,
  GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY,
  K_PALM_MATADOR,
  PALM_MATADOR_KB_CAP,

  // ── MASTERY OVERHAUL — Phase 2 (posture coupling) ──
  POSTURE_BREAK_THRESHOLD,
  POSTURE_RECOVER_THRESHOLD,
  BALANCE_SLAP_HIT_DRAIN_P2,
  BALANCE_CHARGED_HIT_DRAIN_P2,
  BALANCE_PALM_HIT_DRAIN_P2,
  BALANCE_PASSIVE_REGEN_PER_SEC_P2,
  POSTURE_COUNTER_DRAIN_MULT,
  KILLBAND_MOMENTUM,
  KILLBAND_MOMENTUM_REF,
  KILLBAND_POSTURE,
  KILLBAND_CAP,
  POSTURE_CHARGED_KILL_REACH_MULT,

  // ── MASTERY OVERHAUL — Phase 3 (tsuppari cadence) ──
  CADENCE_WINDOW_MS,
  SLAP_TOTAL_MS_ENHANCED,
  BALANCE_SLAP_HIT_DRAIN_ENHANCED,
  CADENCE_STEP_IN_MULT,
  CPU_CADENCE_EASY,
  CPU_CADENCE_NORMAL,
  CPU_CADENCE_HARD,
  CPU_CADENCE_IMPOSSIBLE,

  // ── MASTERY OVERHAUL — Phase 4 (analog resolutions & risk dials) ──
  PERFECT_PARRY_ATTACKER_STUN_MAX,
  PERFECT_PARRY_KNOCKBACK_MAX,
  PERFECT_PARRY_BALANCE_REFUND_MAX,
  SLAP_TIP_DISTANCE,
  SLAP_TIP_POSTURE_MULT,
  SLAP_TIP_DRIFT_MULT,
  CLASH_MARGIN_MIN_MS,
  CLASH_MARGIN_MAX_MS,
  CLASH_LOSER_KB_MIN,
  CLASH_LOSER_KB_MAX,
  CLASH_WINNER_KB_MAX,
  CLASH_WINNER_KB_MIN,
  CHARGE_DURATION_BASE_MS,
  CHARGE_DURATION_SCALE_MS,
  CHARGE_DURATION_EXP,
  FOLLOW_THROUGH_TOWARD_SHIFT,
  FOLLOW_THROUGH_AWAY_SHIFT,
  FOLLOW_THROUGH_TOWARD_RECOVERY_MS,
  FOLLOW_THROUGH_AWAY_RECOVERY_MS,
  CPU_FOLLOW_THROUGH_PUSHER,
  CPU_FOLLOW_THROUGH_COUNTER_FADE,
  CPU_FOLLOW_THROUGH_EDGE_RANGE,
  COUNTER_HIT_INTENT_WINDOW_MS,

  // ── MASTERY OVERHAUL — Phase 5 (assist removal & legibility) ──
  SIDESTEP_GRAB_TRACK_RANGE_P5,
  SPEED_STATE_VELOCITY_THRESHOLD,
  MOMENTUM_HIT_MULT_THRESHOLD,

  // Cinematic kill
  CHARGED_KILL_MIN_CHARGE,
  CHARGED_KILL_READ_MIN_CHARGE,
  CHARGED_KILL_REACH_MIN,
  CHARGED_KILL_REACH_MAX,
  CHARGED_KILL_REACH_CAP,
  CHARGED_KILL_MULT_MIN,
  CHARGED_KILL_MULT_MAX,
  CHARGED_ATTACKER_RECOIL_BASE,
  CHARGED_ATTACKER_RECOIL_CHARGE_SCALE,
  CHARGED_RECOIL_FRICTION,
  CHARGED_HIT_RECOVERY_MS,
  CINEMATIC_KILL_HITSTOP_MS,
  CINEMATIC_KILL_KNOCKBACK_BOOST,
  CINEMATIC_KB_FRICTION,
  CINEMATIC_KB_DI_FRICTION,
  CINEMATIC_KB_MOVEMENT_TRANSFER,
  CINEMATIC_KB_MOVEMENT_FRICTION,
};

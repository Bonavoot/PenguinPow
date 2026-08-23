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

// Phase 5: full tracked snapshot every N room broadcasts (~2s at 32 Hz remote).
// Clients use these as gap-recovery anchors; visibility return also requests one.
const KEYFRAME_EVERY_N_BROADCASTS = 64;

// ============================================
// PERFORMANCE: Delta State Updates
// Only send properties that changed since last tick
// ============================================
const ALWAYS_SEND_PROPS = ['x', 'y', 'facing', 'stamina', 'balance', 'id', 'fighter', 'color', 'mawashiColor', 'bodyColor', 'gearIds'];

const DELTA_TRACKED_PROPS = [
  'isAttacking', 'isSlapAttack', 'isPalmThrust', 'palmThrustFxId', 'isLowKick', 'slapAnimation', 'attackType',
  // Phase 4B: true only while the palm is still HOLDING its extended strike
  // pose during recovery. Debug-overlay consumer (picks palm_recovery's authored
  // variant so the drawn box matches the box authority queried). Authority
  // re-derives this window server-side and never reads the wire value.
  'palmLimbExtended',
  'isChargingAttack', 'chargeAttackPower', 'chargeStartTime',
  // Stops client lunge trails the moment a charged hit plants.
  'chargedAttackHit',
  'isBurstKnockback',
  // Client prediction gates: actionLockUntil / attackCooldownUntil live on the
  // pausable sim clock (frozen during hitstop) so absolute times can't be
  // converted client-side. Shipped as remaining-ms countdowns sampled at
  // broadcast time (computed in index.js just before computePlayerDelta) so
  // the client can suppress action predictions the server would reject.
  'actionLockRemainingMs', 'attackCooldownRemainingMs',
  'isGrabbing', 'isBeingGrabbed', 'grabbedOpponent', 'grabState', 'grabAttemptType',
  'isWhiffingGrab', 'isGrabWhiffRecovery', 'isGrabStartup',
  'isHit', 'lastHitType', 'isDead', 'isRecovering', 'isDodging', 'isDodgeStartup', 'isDodgeRecovery', 'dodgeDirection', 'justLandedFromDodge',
  'isRawParrying', 'isGuarding', 'isRawParryStun', 'isRawParrySuccess', 'isPerfectRawParrySuccess',
  'isApPostParryLocked',
  'isApWhiffRecovering',
  // MATADOR (BACK+SPACE grab-parry): separate from AP so grabs don't CLAMP it.
  'isMatadorParrying', 'isMatadorSuccess', 'isMatadorWhiffRecovering',
  'isThrowing', 'isBeingThrown', 'isThrowTeching', 'isBeingPulled', 'isBeingPushed',
  'isThrowingSalt', 'isReady', 'isBowing', 'isGrabPushDefeat', 'isAtTheRopes',
  'isThrowingSnowball', 'isSpawningPumoArmy',
  'isGrabBreaking', 'isGrabBreakCountered', 'isGrabBreakSeparating',
  'isAttemptingGrabThrow', 'isInRitualPhase',
  'isGrabPushing', 'isBeingGrabPushed', 'isEdgePushing', 'isBeingEdgePushed',
  'isAttemptingPull', 'isBeingPullReversaled',
  'isGrabSeparating',
  // Drive release presentation: the shoved fighter plays the palm-thrust
  // animation while they slide. Pose only — never an attack (see releaseDrive).
  'isGrabSeparatePalm',
  'isGrabBellyFlopping', 'isBeingGrabBellyFlopped',
  'isGrabFrontalForceOut', 'isBeingGrabFrontalForceOut',
  'knockbackVelocity',
  // Parry/guard shove slide (separate from isHit knockback). Client prediction
  // must suspend while this is non-zero — it is not modeled locally.
  'slapParryKnockbackVelocity',
  'activePowerUp', 'powerUpMultiplier',
  'snowballs', 'pumoArmy', 'snowballCooldown', 'pumoArmyCooldown', 'snowballThrowsRemaining', 'pumoArmySpawnsRemaining',
  'isPowerSliding', 'isBraking', 'movementVelocity', 'isStrafing', 'effectiveMoveSpeedMult',
  // iceSlideDir: +1 right / -1 left — client foot FX wake (dodgeDirection is
  // cleared on the same land tick that arms isIceSliding).
  'isIceSliding', 'iceSlideDir', 'isIceSlideReverseHopping', 'isSlideJumping', 'slideJumpDiveCommitted', 'slideJumpFastFalling', 'slideJumpPhase', 'slideJumpHasFlap',
  // Increments when a slide/redirect kicks off the rope toward center — client VFX.
  'ropeKickoffFxId',
  // Phase 4: compact reaction type for client animation ownership (null when idle).
  'offensiveAerialReactionType',
  // Phase 5A: compact presentation category (NONE/FLIGHT_ACTIVE/…).
  'offensiveAerialPresentation',
  'isRopeJumping', 'ropeJumpPhase', 'sizeMultiplier', 'isGassed',
  // Aerial landing diagnostics intentionally NOT on the production delta wire.
  // See LANDING_DIAG_DELTA_PROPS + landingFlags.LANDING_DEBUG_NET.
  // Flap charges / wing-beat sync ride on slide-jump when FLAP is equipped
  // (standalone isFlapping liftoff was removed). Fields kept for cleanup/deltas.
  'isFlapping', 'flapPhase', 'flapCharges', 'flapWingBeatTime', 'flapFastFalling', 'flapBeatHDir',
  // sidestepDirection: -1/1 travel (NOT facing). Neutral 0 clears reliably on
  // the delta wire (undefined cannot). Phase 2 presentation parity.
  'isSidestepping', 'isSidestepStartup', 'isSidestepRecovery', 'sidestepDirection',
  'isSlapParryRecovering',
  'isHitFalling', 'isSidestepHitReturn',
  'inClinch', 'hasGrip', // Always true while in clinch (belt grip is the only clinch pose).
  'isClinchBeltHolding',
  // Legacy wire field — always false.
  'isClinchThrowing', 'isClinchPushing', 'isClinchPlanting',
  'isClinchKillThrowVictim', 'isClinchKillPullVictim',
  'isCounterGrabbed',
  // Clinch Flow P2 — committed drive lean (visual + counterthrow vulnerability)
  'isClinchCommittedDrive',
  // Perfect Brace flash (one-shot tell on the defender)
  // Brace attempt cycle for presentation: 'active' = weight set into the brace,
  // 'settle' = resetting and unable to attempt again, null = ready. Lets both
  // players read that a Brace was spent, which is what makes baiting one legible.
  // Committed startup length (ms) of the live technique. The client paces the
  // windup over exactly this, so the tell finishes on the impact frame instead
  // of playing a fraction of a longer authored animation.
  'clinchThrowAnimMs',
  // Push-war read for HUD: null = not mutual shove, 0 = EVEN, 1/-1 = walk lead.
  // MASTERY Phase 2 (posture coupling): the broken-posture "openable" tell.
  // Computed server-side each tick with hysteresis; forced false when the
  // MASTERY_P2_POSTURE flag is off, so with the flag off this is a stable extra
  // field on the wire (no sim/gameplay change).
  'isPostureBroken',
  // MASTERY Phase 3 (tsuppari cadence): consecutive-enhanced-slap counter. Drives
  // the escalating hand-flash VFX + rising-pitch SFX so the crowd can HEAR a good
  // player's rhythm. Only ever incremented behind MASTERY_P3_CADENCE; stays 0 with
  // the flag off (stable extra field on the wire, no sim/gameplay change).
  'cadenceChain',
  // Ice-slide slap convert — client holds the palm-out pose through the longer
  // recovery so the plant reads as a thrust, not a dropped mash string.
  'slideSlapArmed'
];

/**
 * Landing diagnostic fields — development / overlay only.
 * Registered onto the delta wire only when LANDING_DEBUG_NET is enabled
 * (see deltaState.js). Release PvP clients must not receive these every tick.
 */
const LANDING_DIAG_DELTA_PROPS = [
  'ropeJumpRawTargetX', 'ropeJumpResolvedTargetX', 'ropeJumpLandingCommitted',
  'ropeJumpLandingCommitX', 'ropeJumpLandingCommitT', 'ropeJumpLandingPath',
  'ropeJumpPreferredSide', 'ropeJumpResolvedSide', 'ropeJumpMinDistance',
  'ropeJumpCenterDistance', 'ropeJumpOverlap', 'ropeJumpSafetyCorrectionPx',
  'ropeJumpPreTouchdownX', 'ropeJumpTouchdownX', 'ropeJumpUsedFallback',
  'ropeJumpTrajectoryType', 'ropeJumpDecisionClass', 'ropeJumpFallbackReason',
  'ropeJumpHorizVel', 'ropeJumpRawExpectedVel', 'ropeJumpPeakVel',
  'ropeJumpPeakAccel', 'ropeJumpReversalDetected',
];

// Pre-compute the combined props list once (avoids spread on every call).
// Landing diag props are appended at runtime in deltaState when debug-net is on.
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
// Legacy charged/palm/slap reach numbers — live hit detection uses
// strikeContact.getConnectDistance (art tip + victim body half - skin embed).
// Kept as fallbacks for docs / any non-collision call sites during migration.
const CHARGED_HITBOX_DISTANCE_VALUE = 135; // superseded by tip-based connect
const SLAP_HITBOX_DISTANCE_VALUE = 138; // superseded by tip-based connect
// Art-derived tip extents (sprite px from canvas center, 960 canvas). Used by
// server-io/strikeContact.js. Display scale: (1280 * 0.123) / 960.
// Slap1/slap2 share the longer measured tip — anim alternation is cosmetic only.
// Asymmetric reach made slap1 retals ghost-whiff after a slap2 tip park.
const STRIKE_TIP_SLAP1_SPRITE_PX = 478;
const STRIKE_TIP_SLAP2_SPRITE_PX = 478;
const STRIKE_TIP_CHARGED_SPRITE_PX = 425;
const STRIKE_TIP_PALM_SPRITE_PX = 438;
// Near-zero dig — active-window extension separation already holds tip-meets-body.
const STRIKE_SKIN_EMBED_PX = 1;
// Palm is rooted (no lunge) and reads stingy at exact tip-meets-body. A small
// world-px overhang past the art tip makes the poke connect when the arm
// visually "just" reaches — not a new range band, just past the tip.
const STRIKE_PALM_REACH_OVERHANG_PX = 10;
// Slap clash (near-simultaneous slaps). Recovery is the same for both players.
// Decisive = earlier startup; neutral = starts within SLAP_PARRY_NEUTRAL_WINDOW_MS.
const SLAP_PARRY_WINDOW = 45; // ~2–3 frames. Was 75.
const SLAP_PARRY_NEUTRAL_WINDOW_MS = 30; // ~1 tick at 64Hz.
const SLAP_PARRY_RECOVERY_MS = 135;
// Legacy clash freeze. Unused; trades use HITSTOP_SLAP_MS. Kept for stale imports.
const SLAP_PARRY_HITSTOP_MS = 110;
const SLAP_PARRY_KNOCKBACK_WINNER = 0.8;
const SLAP_PARRY_KNOCKBACK_LOSER = 5.0; // Was 3.5
const SLAP_PARRY_KNOCKBACK_NEUTRAL = 2.8; // Was 2.0
const SLAP_PARRY_KB_FRICTION = 0.82;
// Separation snap before hitstop. 142.4 = slap connect; 175 = GRAB_RANGE.
const SLAP_PARRY_TIP_SEPARATION = 165;

// Grab connect range.
//   130    pushboxes touching (HITBOX_DISTANCE_VALUE * 2)
//   142.4  slap connects (strikeContact.getConnectDistance("slap"))
//   175    grab connects
const GRAB_RANGE = 175;

// Startup → Active → Recovery
const SLAP_STARTUP_MS = 55;       // Client SLAP_ANIM.SMEAR_END must equal this (GameFighter).
const SLAP_ACTIVE_MS = 130;
const SLAP_RECOVERY_MS = 75;
const SLAP_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;

// Extra recovery on a whiffed slap only (applied at cycle end, not on hit).
const SLAP_WHIFF_EXTRA_RECOVERY_MS = 45;

// Ice-slide slap (SHIFT sprint → Mouse1). Pocket mash is unchanged.
// Arm only while actually ice-sliding with earned speed above a walk.
// A planted Shift-hold (~ICE_SLIDE_EXIT_SPEED 0.28) must not arm.
const SLIDE_SLAP_ARM_SPEED = 1.45;
// Same startup+active as a slap; a short tail so a mashed follow-up
// comes out after the plant has opened daylight. Keep this lean — the
// paused hit sells the convert, not a long recovery pose.
const SLIDE_SLAP_EXTRA_RECOVERY_MS = 70;
const SLAP_TOTAL_MS_SLIDE = SLAP_TOTAL_MS + SLIDE_SLAP_EXTRA_RECOVERY_MS;
// Convert is +X, not +0. Just enough lock after you are free that they
// cannot sprint the hole closed during the plant. Pocket mash stays +0.
const SLIDE_SLAP_ADVANTAGE_MS = 50;
// Impact-channel freeze can balloon on a fast slide. Cap so the pause
// stays a punch, not a cinematic. MUST match momentumTransfer apply.
const SLIDE_SLAP_HITSTOP_CAP_MS = 110;
// After the freeze: a slow, fixed forward drift while they take the send.
// No dump, no decay — the chop was a lurch then a dig-in. Ends with the
// convert (endSlapCycle zeros it). Granted, not chase.
const SLIDE_SLAP_FOLLOW_VEL = 0.9;
const SLIDE_SLAP_FOLLOW_FRICTION = 1;

// Burst knockback (palm / flap body-slam). Travel ≈ k·v0/(1−friction);
// k = delta·speedFactor ≈ 2.89 px per velocity-unit per tick. v0=3.1 @ 0.982 ≈ 494px.
const BURST_KB_VELOCITY = 3.1;             // Flap body-slam impulse.
const BURST_STUN_MS = 200;                 // No-DI window, then leftover velocity → ice coast.
const BURST_KB_FRICTION = 0.982;           // Matched to ICE_COAST_FRICTION.

// Slap + palm ring-out: posture-gated on PRE-HIT balance (< CLINCH_THROW_KILL_THRESHOLD).
// The hit that crosses the threshold still clamps; the next lethal strike can KO.
// SLAP_KILL_RANGE is the remaining positional kill band for flap / projectiles.
const SLAP_KILL_RANGE = 25;
// Rest position inward from the rope after a clamp. Short of the ring-out line.
const SLAP_ROPE_RESIST_BUFFER = 12;
// "On the clamp" if the victim is within this of the boundary they're sent toward.
const SLAP_ROPE_EDGE_ZONE = 28;
const SLAP_EDGE_POSTURE_MULT = 3.6;
const PALM_EDGE_POSTURE_MULT = 1.85;
const SLAP_EDGE_HITSTOP_MS = 110;
const PALM_EDGE_HITSTOP_MS = 130;

// On-hit pair slide toward the victim's rope. Attacker is slightly faster (chase).
const SLAP_ONHIT_ATTACKER_PUSH = 1.35;
const SLAP_ONHIT_VICTIM_DRIFT = 1.0;

// Extra victim hitstun / knockback when the hit is labeled counter.
const SLAP_COUNTER_HIT_BONUS_MS = 35;
const SLAP_COUNTER_KB_MULT = 1.25;
// Floor for dynamically computed slap hitstun (see processHit).
const SLAP_MIN_HITSTUN_MS = 60;

// Strike vs live / whiffed MATADOR. Banner: EXPOSED / MATADOR BREAK.
// Internals still use GORED_* / isGored. Does not force midscreen ring-out
// (used to stack with CINEMATIC_KILL_KNOCKBACK_BOOST).
const GORED_KB_MULT = 1.35;
const GORED_HITSTUN_BONUS_MS = 130;
const GORED_CHARGED_KB_MULT = 1.35;
const GORED_HITSTOP_BONUS_MS = 45;

const CHARGED_STARTUP_MS = 150;
// Active window after startup. Charge scales MIN→MAX; lunge ends with the window.
const CHARGED_ACTIVE_MIN_MS = 200;
const CHARGED_ACTIVE_MAX_MS = 450;
const CHARGED_ACTIVE_MS = CHARGED_ACTIVE_MIN_MS; // alias = tap-charge floor

// Open-palm thrust (back + mouse1). Rooted. Uses charged hit path
// (attackType "charged" + isPalmThrust), no forward lunge.
const PALM_THRUST_STARTUP_MS = 90;
const PALM_THRUST_ACTIVE_MS = 90;
// Recovery after active; still renders slapAttack1 (not the recovery pose).
const PALM_THRUST_HOLD_MS = 260;
const PALM_THRUST_END_RECOVERY_MS = 60;
// On-hit recover after the remaining active pose. Victim hitstun + both
// input locks equal remaining pose + this window (+0, like pocket slap).
const PALM_THRUST_HIT_RECOVERY_MS = 200;
// Fixed charge % for the charged-resolution path. Palm vs slap is timing/trade.
// Connect freeze: HITSTOP_BURST_MS. Shove: PALM_THRUST_KB_VELOCITY.
const PALM_THRUST_POWER = 35;
const PALM_THRUST_KB_VELOCITY = 2.4;
const PALM_THRUST_STAMINA_COST = 4;
// Legacy fallback. Live reach is tip-based + STRIKE_PALM_REACH_OVERHANG_PX.
const PALM_THRUST_HITBOX_DISTANCE_VALUE = 164;

// Low kick / trip (S + mouse1, no forward). Disabled; code kept.
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

// Grab startup is unarmored — any live hitbox that reaches stuffs it.
const GRAB_STARTUP_MS = 85;
const GRAB_ACTIVE_MS = 110;

const DODGE_STARTUP_MS = 50;      // Readable windup/anticipation before the hop (was 20)
const DODGE_ACTIVE_MS = 85;       // Kick-off only — sit down onto the ice, then the slide owns travel
const DODGE_RECOVERY_MS = 0;      // No recovery — cooldown prevents chain-dash (was 90)
const DODGE_TOTAL_MS = DODGE_STARTUP_MS + DODGE_ACTIVE_MS + DODGE_RECOVERY_MS; // 135ms
const DODGE_COOLDOWN_MS = 100;    // Forced idle gap after recovery before next dash (prevents chain-dash blur)
// Strike-only startup invuln from dodge press. Covers most of the 50ms windup so
// a committed dodge slips a meaty; cuts off before/as active travel begins so
// late panic into live hitboxes is still hittable. Grabs ignore this entirely.
const DODGE_IFRAME_MS = 40;
// Gassed: dodge / sidestep / rope jump / flap are all hard-locked while gassed
// (denied attempts surface the "not enough stamina" cue).

// Sidestep — fixed-speed lateral arc.
// Startup: vulnerable (strikes counter-hit, grabs track).
// Active: invulnerable to strikes and grabs.
// Recovery: vulnerable (strikes = PUNISH, grabs track).
const SIDESTEP_STARTUP_MS = 50;
const SIDESTEP_ACTIVE_MS = 400;
const SIDESTEP_RECOVERY_MS = 150;
const SIDESTEP_TOTAL_MS = SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS + SIDESTEP_RECOVERY_MS; // 600ms
const SIDESTEP_STAMINA_COST = 8;
const SIDESTEP_TRAVEL = 160;
// Shorter travel if started inside DOHYO_EDGE_PANIC_ZONE.
const SIDESTEP_TRAVEL_EDGE = 110;
const SIDESTEP_ARC_DEPTH = 50;        // Fixed Y dip — moves DOWN on screen (toward camera, around the ring's near edge)
const SIDESTEP_GRAB_TRACK_RANGE = 400; // Generous grab range when target is sidestepping
const SIDESTEP_RECOVERY_OVERLAP_THRESHOLD = 80; // Only push out during recovery if literally clipping pushbox
// After sidestep ends, a still-lunging charged attack can flip relative sides
// underneath a just-started action facing lock. Track/retarget for this window
// so the lock follows the opponent if (and only if) sides actually change —
// non-side-switch sidesteps are a no-op (desired facing unchanged).
const POST_SIDESTEP_FACING_TRACK_MS = 500;

// Dohyo edge fall physics - fast heavy drop with maintained horizontal momentum
const DOHYO_FALL_SPEED = 5.93; // Scaled for camera zoom (was 8)
const DOHYO_FALL_DEPTH = 37; // Scaled for camera zoom (was 50)
// Legacy alias — live fall/off-ice drag uses OUTSIDE_DOHYO_DIRT_* below.
const DOHYO_FALL_HORIZONTAL_RETENTION = 0.84;

// ============================================
// OFF-ICE / DIRT APRON (past MAP rope → fall edge)
// On-ice slap KB decays at ~0.97/tick; once past the rope the loser is on
// dirt, not ice — markedly stickier, but still a smooth slide (not a hard stop).
// ============================================
const PAST_MAP_DIRT_KB_FRICTION = 0.88;       // Knockback on dirt apron (MAP → DOHYO)
const OUTSIDE_DOHYO_DIRT_KB_FRICTION = 0.84;  // Knockback past the fall edge
const PAST_MAP_DIRT_MOVE_FRICTION = 0.90;     // Loser coast on dirt apron
const OUTSIDE_DOHYO_DIRT_MOVE_FRICTION = 0.85; // Coast/slide past fall edge
// Kill-pull / AP-parry-kill belly-slides are position tweens (not velocity), so
// dirt is applied by compressing ice overshoot past the rope. ~0.35 keeps a
// readable dirt slide without the full ice carry; past the fall edge compresses more.
const KILL_PULL_DIRT_OVERSHOOT_SCALE = 0.35;
const KILL_PULL_DIRT_FALL_OVERSHOOT_SCALE = 0.20;

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

// Ice locomotion
const ICE_ACCELERATION = 0.08;
const ICE_MAX_SPEED = 1.3;
const ICE_INITIAL_BURST = 0.28;

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

// ============================================
// ICE SLIDE (SHIFT held through dodge land) → SLIDE JUMP (W) → BUTT SLAM (S)
// ============================================
// Entered when SHIFT is still held as a dodge ends. Tiny grounded flash before
// W is live; jump H carries ice speed (incl. speed stats). S is the slam.
const ICE_SLIDE_FRICTION = 0.996;           // Very low friction while SHIFT held in slide dir
const ICE_SLIDE_COAST_FRICTION = 0.965;     // SHIFT released but still sliding — keep state for repress reverse
const ICE_SLIDE_STEER_FRICTION = 0.88;      // Bleed when A/D steers / fights the slide
const ICE_SLIDE_OPPOSE_FRICTION = 0.82;     // Harder bleed when holding opposite of slide dir
const ICE_SLIDE_EXIT_SPEED = 0.28;          // Drop out of slide below this |velocity| (SHIFT released only)
const ICE_SLIDE_MAX_SPEED = 2.4;           // Soft cap while ice-sliding
const ICE_SLIDE_MAINTAIN = 0.02;           // Tiny sustain toward slide dir while SHIFT held
// Brake → SHIFT repress bunny-hop reverse (recovering → sliding art)
// Skill tax is opposite-dir dig + SHIFT repress — NOT ejecting the slide into a dodge.
const ICE_SLIDE_REVERSE_SPEED_MAX = 1.55;   // Soft dig gate; brake-arm also qualifies above this
const ICE_SLIDE_BRAKE_ARM_MS = 45;          // Hold opposite this long → reverse legal even if still quick
const ICE_SLIDE_REVERSE_BUFFER_MS = 150;    // SHIFT repress buffer while opposite dig catches up
const ICE_SLIDE_REVERSE_BURST = 2.15;       // Instant velocity in the new direction
const ICE_SLIDE_REVERSE_HOP_MS = 85;        // Tiny hop window (recovering pose)
const ICE_SLIDE_REVERSE_HOP_HEIGHT = 16;    // Peak Y above ground during the hop
const ICE_SLIDE_REVERSE_COOLDOWN_MS = 160;  // Anti ping-pong; still snappy
const SLIDE_JUMP_MIN_MS = 100;             // Grounded "slide flash" before W jump is live
const SLIDE_JUMP_BUFFER_MS = 120;          // W pressed during flash → fire when min elapses
const SLIDE_JUMP_LIFTOFF_IMPULSE = 14.2;   // A little more pop — peak ~150px
const SLIDE_JUMP_GRAVITY = 0.64;
// Air H floor/carry are the unbuffed kick-off jump. Floor stays so a legal
// hop still hops. Carry 1.0 (was 1.2) trims max travel ~8% after the taller arc.
const SLIDE_JUMP_H_MIN = 1.8;
const SLIDE_JUMP_H_CARRY = 1.0;
// Distance cap. Ice can still run Happy Feet; the jump does not inherit it
// 1:1. First stack (PvP / BASHO pick 1 = 1.4) stays on the unbuffed takeoff.
// Stacks past that buy a little leftover air — not another ring-cross.
const SLIDE_JUMP_H_MAX_MULT = 1.0;
const SLIDE_JUMP_H_STACK_START = POWER_UP_EFFECTS[POWER_UP_TYPES.SPEED]; // 1.4
const SLIDE_JUMP_H_STACK_FULL_MULT = 2.5; // basho HF ceiling
const SLIDE_JUMP_H_STACK_HEADROOM = 0.10; // +10% H at full leftover stacks
const SLIDE_JUMP_AIR_STEER = 1.2;          // Weak air nudge (also bleeds H slightly)
const SLIDE_JUMP_AIR_STEER_BLEED = 0.97;   // Per-tick H decay when air-steering
const SLIDE_JUMP_LANDING_RECOVERY_MS = 90; // Barely punishable — strict slap-timing window
// Land-on-body settle. Caps unstack at 18px/tick (continue-slide recovery is 0).
const SLIDE_JUMP_LAND_SETTLE_MS = 160;
// S dive enable — mid-ascent on the heavier arc (peak ~150, ascent ~22 ticks).
const SLIDE_JUMP_DIVE_MIN_AIR_MS = 140;    // ~9 ticks @ 64Hz
const SLIDE_JUMP_DIVE_MIN_HEIGHT = 88;     // mid-launch, not peak
// Early S during the lock latches; commit fires on the first enabled tick.
const SLIDE_JUMP_DIVE_BUFFER_MS = 220;     // Tap forgiveness across the lock window
// Brief slam-only i-frames after slide-jump touchdown so "landed first" isn't
// an instant free belly-plant while still in the land pose.
const SLIDE_JUMP_LAND_SLAM_IFRAME_MS = 78;  // ~5 ticks @ 64Hz
// Soft belly unstack on slam HIT — NOT a full pushbox park (that teleported
// victims ~100px+ and read as a snap). Cap the out-nudge; KB owns separation
// after hitstop. Flight pushbox-off can still stack at contact.
const FLAP_BODYSLAM_PARK_MAX_NUDGE_PX = 18;
// Soften post-hit H travel (non-dive still carries slide H through the victim).
const FLAP_BODYSLAM_POST_HIT_H_DAMP = 0.2;

// Edge awareness
const DOHYO_EDGE_PANIC_ZONE = 89;       // Scaled for camera zoom (was 120)
// Rope / tawara kick-off — on the straw. Dodge land is judged from dodgeStartX
// (the hop itself is ~34px inward and would miss this window).
const ROPE_KICKOFF_ZONE = 28;
// Neutral charged cinematic KO only if victim is within this of MAP rope
// (340/935) in the knockback direction at contact. Not the DOHYO fall edge.
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
const DODGE_DURATION = DODGE_STARTUP_MS + DODGE_ACTIVE_MS; // 135ms total before recovery phase
const DODGE_BASE_SPEED = 2.67; // Baseline px-rate unit — travel distance is FIXED (see DODGE_TRAVEL_DISTANCE)
// Same ground a redirect hop covers at burst (85ms × speedFactor × 2.15).
// Speed buffs finish this sooner — they never extend travel.
const DODGE_TRAVEL_DISTANCE = Math.round(
  ICE_SLIDE_REVERSE_HOP_MS * speedFactor * ICE_SLIDE_REVERSE_BURST
);
const DODGE_SPEED_MULT_CAP = 1.5; // Max Happy Feet / draft rate on dodge — duration shrink only
const DODGE_CANCEL_ACTION_LOCK = 80; // Unused — grounded S-during-dodge cancel removed

// ============================================
// Grab Mechanics
// ============================================

// Grab walking tuning
const GRAB_WALK_SPEED_MULTIPLIER = 0.8; // Slightly slower than normal strafing
const GRAB_WALK_ACCEL_MULTIPLIER = 0.7; // Slightly lower acceleration than normal strafing

// Grab startup tuning — lunge forward during startup for better grab range
const GRAB_STARTUP_DURATION_MS = GRAB_STARTUP_MS; // Uses frame data constant
const GRAB_STARTUP_HOP_HEIGHT = 0; // No hop — grab is a grounded technique
// Grab lunge: impulse into grabMovementVelocity, then friction.
// GRAB_LUNGE_DISTANCE is total uninterrupted travel; impulse is solved backwards.
const GRAB_LUNGE_FRICTION = 0.94;
const GRAB_LUNGE_DISTANCE = 110;
const SLAP_ATTACK_STARTUP_MS = SLAP_STARTUP_MS; // Uses frame data constant (55ms — all slaps share this startup)

// Grab whiff recovery — big vulnerable window if grab misses
const GRAB_WHIFF_RECOVERY_MS = 450; // Whiff recovery duration (fully vulnerable to punishment)

const GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER = 1.4; // Larger gap during pull attempt (vs 1.0 for normal grab)

// Grab break constants — Spacebar in clinch (both players must have grip).
// Soft-gated by stamina: usable below cost, but breaker self-gasses if under-budget.
// Stamina cost only (no posture hit). Doesn't reposition meaningfully (boundary-clamped),
// so edge stress is preserved. Brief grab immunity prevents instant re-clinch.
const GRAB_BREAK_STAMINA_COST = 30; // Heavy commitment — break is a real escape, not a free reset
const GRAB_BREAK_FORCED_DISTANCE = 140; // Total separation distance (split between breaker + opponent — each moves half this)
const GRAB_BREAK_TWEEN_DURATION = 350; // Knockback slide duration
const GRAB_BREAK_RESIDUAL_VEL = 0; // No residual sliding — players stop cleanly when knockback ends
const GRAB_BREAK_INPUT_LOCK_MS = 350; // Breaker is locked during knockback tween — vulnerable window
const GRAB_BREAK_ACTION_LOCK_MS = 350; // Action lock matches input lock
// Floor before Space / Mouse1 can request clinch break / jolt after mutual grip.
// Filters late open-game parry / slap-mash presses that would otherwise become
// instant clinch verbs (parry is meant to lose to grab; slap mash ≠ jolt intent).
// Sized under typical human RT (~200–250ms) so sharp intentional presses still
// clear it; a press during the lock is discarded — must re-press after it opens.
const GRAB_BREAK_REACTION_LOCK_MS = 150;
// Grab stamina drain: 10 stamina over full 1.5s duration
// Drain 1 stamina every 150ms (1500ms / 10 = 150ms per stamina point)
const GRAB_STAMINA_DRAIN_INTERVAL = 150;

// ============================================
// NEW GRAB ACTION SYSTEM - Directional grab mechanics
// Push starts IMMEDIATELY on grab connect (burst-with-decay).
// Grabber can interrupt push with pull (backward) or throw (W) during push.
// ============================================
// Short first-grab reward shove. Both players already have grip on connect —
// burst is uncancellable by a "grip-up" (removed); only duration/decay end it
// (or a throw/pull / break from either side).
// Standing (zero approach) duration is tuned to ≈ GRAB_BREAK_REACTION_LOCK_MS
// (150ms): ln(BASE/MIN_VEL)/DECAY ≈ 0.15s so break/jolt open as the shove dies.
const GRAB_PUSH_BURST_BASE = 1.2;          // Slight snap vs 1.0; same ~150ms standing window
const GRAB_PUSH_MOMENTUM_TRANSFER = 0.5;   // Approach → burst (dash/slide grabs bite)
// Min approach speed when grab connects on sidestep-recovery or rope-jump landing.
const GRAB_CATCH_MIN_BURST_SPEED = 1.15;
const GRAB_PUSH_DECAY_RATE = 6.1;          // Faster blink — ends with the reaction lock
const GRAB_PUSH_MIN_VELOCITY = 0.48;       // Keep BASE/MIN ≈ 2.5 → ~150ms standing end
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
const RINGOUT_THROW_DURATION_MS = 400; // Legacy throw hop (unused by FORCE OUT path)
// FORCE OUT (grabPush): continue the clinch/grab push a short distance past the
// rope during the round-result callout, then drop to idle before round reset.
// Idle clears clinch flags so the normal pushbox can un-overlap them (inputs
// stay locked via gameOver).
const RINGOUT_PUSH_DURATION_MS = 650;
const RINGOUT_PUSH_DISTANCE = 52; // px both fighters travel past the win line
const RINGOUT_PUSH_IDLE_DELAY_MS = 220; // brief hold after shove, then pumo-idle
// MUST lag idle so clients commit idle sprites before X moves — otherwise
// interpolated spacing changes under a still-visible clinch pose.
const RINGOUT_PUSH_SEPARATE_DELAY_MS = 140;
// Loser: idle first, then swap to push-defeat pose (still before ~2000ms reset).
const RINGOUT_PUSH_DEFEAT_DELAY_MS = 280;

// ============================================
// Parry System
// ============================================
const RAW_PARRY_KNOCKBACK = 0.49; // Knockback velocity for charged attack parries
const RAW_PARRY_SLAP_KNOCKBACK = 0.5; // Lighter knockback for slap parries
const PERFECT_PARRY_KNOCKBACK = 0.65; // Slightly stronger than regular parry
// Just window: last N sim ticks before contact (SF6 Perfect ≈ 2f). Graded from
// apArmSimTime (when the tap was applied), not the lag-comp'd press stamp.
const PERFECT_PARRY_JUST_TICKS = 2;
const PERFECT_PARRY_WINDOW = (PERFECT_PARRY_JUST_TICKS * 1000) / TICK_RATE; // 31.25ms @ 64Hz
const PERFECT_PARRY_SUCCESS_DURATION = 850; // Compressed parry — fast enough to keep pace, long enough for visual read
const PERFECT_PARRY_ATTACKER_STUN_DURATION = 420; // Starstun floor. Live jail is max(move stagger, this) so flap (500) never pays less than regular. Slap/palm Perfect = +220 vs the 200ms plant.
const PERFECT_PARRY_ANIMATION_LOCK = 330; // AP_PERFECT_HITSTOP_MS (210) + 120ms post-freeze cool-pose floor
const PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK = 200; // Shorter than player parry lock — the reflected snowball is the reward

// Lag-compensation backdate caps. Absolute ceiling covers high-ping one-way
// delay + client emit throttle (16ms) + tick phase. Per-connection effective
// cap is RTT-aware (see getPlayerInputBackdateCapMs) — LAN spoofing cannot
// claim the full 120ms. IMPORTANT: for single-player windows (perfect parry
// duration) more backdate only makes success harder; for RELATIVE ordering
// (clinch 60ms simul window) timestamps from two clients are compared, so
// spoofing earlier CAN help. Trusted reconstruction must clamp to receipt
// time, RTT cap, and monotonic history — never trust raw client ages alone.
const MAX_PARRY_BACKDATE_MS = 120;
const INPUT_BACKDATE_MIN_MS = 32;           // Floor: emit throttle + one tick
const INPUT_BACKDATE_RTT_SLACK_MS = 16;     // Slack beyond estimated one-way
const INPUT_CLOCK_OFFSET_MAX_DELTA_MS = 80; // Prefer server EMA if client offset jumps
const INPUT_PRESS_MONOTONIC_SLACK_MS = 8;   // Allow tiny reorder noise vs last press

// ── Legacy RAW_PARRY_MIN/MAX/COOLDOWN (unused by live AP) ───────────────────
// Live empty-tap jail is AP_WHIFF_RECOVERY_MS. These remain so old imports
// don't throw. Do not wire them back in — they fight the tap/hold SM.
const RAW_PARRY_MIN_DURATION = 200;
const RAW_PARRY_MAX_DURATION = 700;
const RAW_PARRY_COOLDOWN_MS = 150;

// ── Legacy RAW_PARRY_REARM_* (unused by live AP) ─────────────────────────────
// Live re-time is: falling Space clears apSpaceConsumed + rising Space calls
// armAttackParry (re-stamps start/window). Stamina is charged on land (AP_STAMINA_COST),
// not per re-arm. These constants remain only so old imports don't throw.
const RAW_PARRY_REARM_STAMINA_COST = 5;
const RAW_PARRY_REARM_INTERVAL_MS = 180;

// Parry visual timing
const PARRY_SUCCESS_DURATION = 500; // How long the parry success pose is held

// Raw parry stamina: flat cost on press, refunded on any successful parry
const RAW_PARRY_STAMINA_COST = 12; // Flat cost on press (was 5)
const RAW_PARRY_STAMINA_REFUND = 12; // Full refund on success (was 5)

// Perfect parry posture refund REMOVED — posture is hit-or-disengage only
// (Halo delay regen). Kept at 0 so any leftover callers are no-ops.
const PERFECT_PARRY_BALANCE_REFUND = 0;

// ============================================
// GUARD & PARRY (Space) — one stance, three outcomes
// ============================================
// Space tap = parry (slap/palm only; not grab or charged). Hold = guard.
// Empty release/expiry = whiff (AP_WHIFF_RECOVERY_MS). Reuses isRawParrying /
// isRawParrySuccess. Landed parry opens AP_FLURRY_COVER_MS for the next re-tap.
// Regular vs Perfect: already in the window = Regular (callout). Armed in the
// last PERFECT_PARRY_JUST_TICKS before contact = Perfect (just). A slightly-late
// slap tap still Regulars via open-hit grace — it cannot Perfect. Way late = hit.
// Neither grade KOs while AP_KILL_ENABLED is false (Perfect is a starstun confirm).
// Guard: chip + pushback + stamina; rooted; does not stop grab/charged.
// Stamina 0 while guarding → guard-crush → gassed. One parry per physical press.
const AP_ACTIVE_MS = 180;            // Callout window. Just grade is PERFECT_PARRY_WINDOW (2 ticks).
// First N ms of slap ACTIVE: open hits wait so a slightly-late tap can still
// Regular. Live PARRY/GUARD resolve immediately. Slap-only. A grace save
// cannot Perfect (see collisionSystem). This game has no SF6 block under a
// missed just — without this, a 16ms-late callout eats a raw jab.
const AP_OPEN_HIT_GRACE_ENABLED = true;
const AP_LATE_PARRY_MS = 45;
const SLAP_GRACE_CONFIRM_SLACK_PX = 28;
const AP_FLOW_WINDOW_MS = 400;       // DEPRECATED (Deflect Flow removed). Kept only so existing imports resolve; unreferenced by the new state machine.
// IMPACT-pose + post-parry move/offense lock (sim-clock; frozen during hitstop,
// so this mostly plays AFTER the freeze). Same duration for regular and perfect
// — attacker stagger/advantage is THEIR jail, not an extra plant on the parrier.
// Flurry re-tap still clears/re-arms via armAttackParry (lock flag survives).
// Long enough that Frame 2 (deflect) stays readable after hitstop ends.
const AP_SUCCESS_RECOVERY_MS = 200;
// Cancel / empty-tap recovery: rooted endlag when a live window is released (or
// expires) into nothing with no deflect. Long enough to read the client whiff
// pose (success-f1 hold) and eat a slap punish. LANDED parries never enter
// this — success uses AP_SUCCESS_RECOVERY_MS plant instead.
// Re-arm is blocked for the full duration (canArmAttackParry).
const AP_WHIFF_RECOVERY_MS = 300;
const AP_COOLDOWN_MS = 40;           // Tiny gap before GUARD may re-enter after a drop. Fresh taps (rising Space) ignore this so release→re-press is an immediate parry window.

// ── MATADOR (BACK + SPACE) ───────────────────────────────────────────────────
// Grab-line timed parry. Same arm/whiff feel as an AP TAP (no hold→guard path).
// Beats grabs only → instant pull (land-threshold bypassed). Wrong into a
// strike = GORED. Separate flags from isRawParrying so grabs don't CLAMP it.
const MATADOR_ACTIVE_MS = AP_ACTIVE_MS;                 // 180 — same live window as AP
const MATADOR_WHIFF_RECOVERY_MS = AP_WHIFF_RECOVERY_MS; // 300 — same empty-tap jail
const MATADOR_HITSTOP_MS = 110;                         // Confirm/steal tier — same rung as AP regular
const MATADOR_SUCCESS_LOCK_MS = AP_SUCCESS_RECOVERY_MS;  // Brief plant on the matador after pull starts
// Non-kill yank. Floor = standing grab; ceiling uses grabApproachSpeed.
// Canned lunge is not sampled. Kill uses CLINCH_KILL_PULL_DISTANCE.
const MATADOR_PULL_DISTANCE = 260;
const MATADOR_PULL_DISTANCE_MAX = 400;
const AP_STAMINA_COST = 3;           // Charged per parry tap
// Live Attack Parry never finishes the round. Perfect is a starstun confirm;
// the follow-up (grab / slap / walk-out) is the earned kill.
// The lethal slap-down (ap_pull + clinchKillPull) is still in collisionSystem
// behind this flag. Flip to true to restore Perfect-only kills when the
// attacker's balance is already under AP_PERFECT_KILL_THRESHOLD.
const AP_KILL_ENABLED = false;
// KILL gate (dormant while AP_KILL_ENABLED is false): PERFECT only.
// Regular parries never KO. Under clinch kill (15) and posture break (35).
const AP_KILL_THRESHOLD = 8; // legacy (unused) — kills use AP_PERFECT_KILL_THRESHOLD only
const AP_PERFECT_KILL_THRESHOLD = 12;
// Balance drained from the parried attacker (vs BALANCE_SLAP_HIT_DRAIN_P2 slap drain).
const AP_BALANCE_DRAIN = 7;           // Regular parry (was 12; ~40% less)
const AP_PERFECT_BALANCE_DRAIN = 11;  // Perfect parry (was 18; ~40% less)
// Attacker shove via slap-parry slide (slapParryKnockbackVelocity,
// SLAP_PARRY_KB_FRICTION ≈ 0.82). Travel ≈ v · 16px at 64Hz. ATTACK/recovery pose, not hit reaction.
const AP_ATTACKER_KNOCKBACK = 1.75;        // Regular ≈ 28px
const AP_PERFECT_ATTACKER_KNOCKBACK = 2.25; // Perfect ≈ 36px
const AP_HITSTOP_MS = 110;
const AP_PERFECT_HITSTOP_MS = 210;
const AP_KILL_HITSTOP_MS = 550;      // Matches CINEMATIC_KILL_HITSTOP_MS
// PERFECT-only balance refund to the PARRIER — removed (Halo posture regen).
// Attacker still eats AP_PERFECT_BALANCE_DRAIN. Constant kept at 0 for callers.
const AP_PERFECT_BALANCE_REFUND = 0;
// Attacker lockout after being parried, keyed to the committed move.
// Regular slap + AP_FLURRY_STAGGER_BEGIN_MS (20) = AP_SUCCESS_RECOVERY_MS (200) → +0.
// Perfect jail = max(move stagger, PERFECT_PARRY_ATTACKER_STUN_DURATION). Not the old +220 add-on.
const AP_STAGGER_SLAP_MS = 180;
const AP_STAGGER_PALM_MS = 420;
const AP_STAGGER_FLAP_MS = 500;
const AP_PERFECT_ADVANTAGE_MS = 220; // Legacy slap-only add-on. Live Perfect uses max(move stagger, 420).
// Post-parry flurry cover (tap-every-slap). After a landed parry, the next
// rising-edge re-tap may extend its live window to (parryTime + cover). Cover
// matches REAL ASAP follow-up timing, not the naive stagger alone:
//   parryStaggerBegin delay (20) + attacker stagger + slap startup + slack
// (collision re-applies stagger AFTER hitstop via parryStaggerBegin). Slack
// absorbs delayed/CPU follow-ups. grantAttackParryFlurryCover() uses the
// actual staggerMs from that parry. Regular only — Perfect is a turn, not
// another piano. Neutral taps stay AP_ACTIVE_MS. Just grade is apply-tick.
const AP_FLURRY_STAGGER_BEGIN_MS = 20; // must match collisionSystem parryStaggerBegin delay
const AP_FLURRY_SLACK_MS = 120;        // delayed follow-up / CPU reaction pad
const AP_FLURRY_COVER_MS =
  AP_FLURRY_STAGGER_BEGIN_MS + AP_STAGGER_SLAP_MS + SLAP_STARTUP_MS + AP_FLURRY_SLACK_MS; // 375 default (regular slap +0)
// Lethal AP slap-down slide — victim dragged through the parrier (matches clinch kill-pull).
const AP_KILL_SLIDE_DISTANCE = 210;      // == CLINCH_KILL_PULL_DISTANCE
const AP_KILL_SLIDE_DURATION_MS = 950;   // clinch pull is 850; +100ms

// ── GUARD (hold Space) ──────────────────────────────────────────────────────
// Blocked strike: chip + pushback + stamina drain. Same slide as parry shove (no hurt pose).
// Rooted. Does not stop grabs or charged. Stamina 0 while guarding → guard-crush → gassed.
const GUARD_SLAP_BALANCE_CHIP = 2;    // Blocked slap posture chip (vs 7 on a clean slap)
const GUARD_PALM_BALANCE_CHIP = 6;    // Blocked palm posture chip
const GUARD_SLAP_STAMINA_DRAIN = 4;
const GUARD_PALM_STAMINA_DRAIN = 7;
const GUARD_SLAP_PUSHBACK = 2.0;      // Slide-model velocity — blocked slap ≈ 32px
const GUARD_PALM_PUSHBACK = 4.0;      // Blocked palm ≈ 64px
const GUARD_HITSTOP_MS = 40;
const GUARD_ATTACKER_RECOVERY_MS = 80; // Block consumes the string; short settle so they cannot instant-cancel. Drop-guard is even / a hair plus.
const GUARD_CRUSH_STUN_MS = 500;      // Guard broken (stamina hit 0 while blocking), then gassed

// ── SLAP TRADE (replaces the slap clash / "slap parry") ─────────────────────
// Earlier active slap (attackStartTime, not player index) lands and stuffs the later one.
// Same-tick tie TRADES: both take a hit + SLAP_TRADE_KNOCKBACK. A 1-frame gap is not a trade.
// Trade can ring out the boundary-side player (double ring-out is geometrically impossible).
const SLAP_TRADE_WINDOW_MS = 8;      // Same-tick only (<1 tick @64Hz). A 1-frame gap → earlier wins, no trade.
// MOMENTUM TRANSFER rescale: knockback now decays at ICE_COAST_FRICTION (0.982)
// instead of the slap channel's 0.97, so a velocity travels ~1.67x further.
// 2.8 -> 1.675 preserves the previous ~269px mutual shove.
const SLAP_TRADE_KNOCKBACK = 1.675;  // Mutual shove on a trade

// ── PALM vs PALM (timing priority / trade) ──────────────────────────────────
// Design reference: slap winner/trade (same-tick only). Implementation is
// palm-native — does NOT share slap trade helpers, slap hit delivery, or slap
// contact queries. Palm vs palm no longer uses charge clash.
//   • Earlier active palm lands a clean palm hit; later palm is stuffed.
//   • Genuine same-tick tie TRADES: both take a palm-flavored hit with a mutual
//     spacing shove (PALM_TRADE_KNOCKBACK), not full palm burst KB.
// Charged headbutt vs charged headbutt (and palm vs headbutt) still clash.
const PALM_TRADE_WINDOW_MS = 16;     // ~1 tick @64Hz — slightly looser than slap's 8ms same-tick
                                     // window so a true dual-commit can trade through input/tick
                                     // jitter. Still rare: 2 ticks apart (~31ms) → earlier wins.
// Same 1.67x friction rescale as SLAP_TRADE_KNOCKBACK: 2.15 -> 1.29 preserves
// the previous ~207px mutual reset.
const PALM_TRADE_KNOCKBACK = 1.29;   // Mutual space reset; under a clean palm's send.

// ── PALM vs SLAP (timing priority / trade) ──────────────────────────────────
// Earlier active connect wins; near-simultaneous TRADES. Does not use CHARGE_PRIORITY_THRESHOLD.
const PALM_VS_SLAP_TRADE_WINDOW_MS = 16; // Match palm-vs-palm window (~1 tick).
// Asymmetric trade shove. Both under a clean palm send (PALM_THRUST_KB_VELOCITY 2.4).
const PALM_VS_SLAP_TRADE_KB_ON_SLAPPER = 2.35; // near palm send
const PALM_VS_SLAP_TRADE_KB_ON_PALM = 1.85;    // lighter than palm-vs-palm mutual (2.15)

// ============================================
// At the Ropes
// ============================================
const AT_THE_ROPES_DURATION = 800; // 0.8 second stun duration (was 1000)

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
// Landing fraction toward center (was inline 0.52 in socketHandlers + CPU input).
const ROPE_JUMP_CENTER_FRACTION = 0.33;
// Phase A / A.1 aerial landing commit window (fraction of active arc).
// V2 may lock as early as COMMIT_T_MIN when waiting would force a late reverse
// (near-side / boundary residual). Otherwise locks at COMMIT_T (max).
// Must be < 1 so travel to the endpoint stays continuous.
// See AERIAL_LANDING_PHASE_A1.md / landingResolution.js.
const ROPE_JUMP_LANDING_COMMIT_T = 0.58;
const ROPE_JUMP_LANDING_COMMIT_T_MIN = 0.05;

// ============================================
// FLAP — air charges on slide-jump (power-up / BASHO movement loadout)
// ============================================
// FLAP no longer replaces parry and has no standalone liftoff. When equipped,
// each ice-slide → W takeoff grants FLAP_CHARGES and costs FLAP_STAMINA_COST.
// Without spending charges: plain slide-jump physics (SLIDE_JUMP_*).
// After the first air-charge spend: full FLAP flight physics (gravity, air
// steer, ceiling cushion, H-burst friction, landing recovery) for the rest
// of that jump. Descending flight carries an offensive body hitbox (ascent
// is pushbox-only / no hit — matches pre-Honda pass-through on the way up).
// S dive is a committed plummet of the same hit. One connect per jump.
// Commitment model: passive flight is still hurtbox-immune (can't be stuffed
// by ground strikes), but the descending body hit is parryable. Landing
// recovery remains punishable.
const FLAP_STARTUP_MS = 166;             // Legacy — standalone grounded startup removed
const FLAP_CHARGES = 1;                  // Air flaps granted on FLAP-armed slide-jump takeoff
const FLAP_LIFTOFF_IMPULSE = 11.5;       // Legacy standalone liftoff (slide takeoff uses SLIDE_JUMP_LIFTOFF_IMPULSE)
const FLAP_IMPULSE = 9.5;                // Upward velocity (px/tick) per AIR flap (W)
const FLAP_GRAVITY = 0.44;               // Flight gravity once charges are in use
const FLAP_MAX_HEIGHT = 300;             // Soft ceiling above GROUND_LEVEL
const FLAP_AIR_MOVE_SPEED = 4.6;         // Horizontal air-control (px/tick) via A/D during flap flight
// Fast-fall: pressing S COMMITS to a locked straight plummet.
const FLAP_FASTFALL_GRAVITY = 1.5;       // Downward accel (px/tick²) while dive-locked
const FLAP_DIVE_MIN_DOWN_VELOCITY = 8;   // Minimum downward speed (px/tick) once committed
const FLAP_FASTFALL_AIR_MOVE_SPEED = 1.1; // Unused while dive-locked (X is pinned); kept for reference
const FLAP_CEILING_CUSHION = 42;         // Soft band below the cap
const FLAP_CEILING_HANG_GRAVITY = 0.25;  // Reduced gravity inside the cushion band
const FLAP_FLAP_H_IMPULSE = 7;           // Horizontal velocity (px/tick) on a directional air flap
const FLAP_H_FRICTION = 0.88;            // Per-tick decay of the horizontal burst
const FLAP_CHARGE_COOLDOWN_MS = 150;     // Min interval between air flaps
const FLAP_STAMINA_COST = 4;             // Takeoff tax only (air flaps free) — match dodge/rope jump
const FLAP_LANDING_RECOVERY_MS = 250;    // Whiff landing endlag once flap flight was used this jump
// Max height (px above ground) at which grounded strikes can still hit an
// airborne FLAP-armed flyer. Above this, horizontal-only hitboxes can't "floor
// hit" a high body. Tuned near the body-slam contact band so anti-airs work
// when the flapper is actually low enough to stuff.
const AIR_STRIKE_HURT_HEIGHT = 72;
// Body-slam impulse (S dive connect). Parry beats the slam.
const FLAP_BODYSLAM_KB_VELOCITY = BURST_KB_VELOCITY;

// ============================================
// Hit Recovery — grounded knockback + gravity after a launch connect
// ============================================
// Slide-jump: ascent is hittable (limb height), post-peak is immune.
// A launch connect uses authored horizontal KB + AIR_HIT_KB_BONUS_PX.
// Rise is killed; gravity drops them from current height. No pop. No dump.
const HIT_FALL_GRAVITY = SLIDE_JUMP_GRAVITY; // Same fall as the jump they left
const HIT_FALL_POP_LIGHT = 0;
const HIT_FALL_POP_MEDIUM = 0;
const HIT_FALL_POP_HEAVY = 0;
const HIT_FALL_RISE_KEEP = 0;
const HIT_FALL_MAX_POP = 0;
const HIT_FALL_CARRY_DOWN_SCALE = 1;
const HIT_FALL_COUNTER_POP_MULT = 1;
const HIT_FALL_MAX_FALL_SPEED = 16;
const AIR_HIT_KB_MULT = 1.0;              // unused — air hits add BONUS_PX, not a mult
const AIR_HIT_CARRY_X_SCALE = 0;          // Do not fold jump H into the shove
// Extra px added to authored send on an air hit. Slap ring-out gate unchanged.
const AIR_HIT_KB_BONUS_PX = 130;
// Overlap eject: leftover helper. Air hits use the bonus send, not eject.
const AIR_HIT_EJECT_MAX_PX_PER_TICK = 18; // Same cap as land settle
const AIR_HIT_EJECT_SEP_EPS = 0.5;
// Back-compat aliases (old dump names)
const HIT_FALL_DUMP_LIGHT = HIT_FALL_POP_LIGHT;
const HIT_FALL_DUMP_MEDIUM = HIT_FALL_POP_MEDIUM;
const HIT_FALL_DUMP_HEAVY = HIT_FALL_POP_HEAVY;
const HIT_FALL_COUNTER_DUMP_MULT = HIT_FALL_COUNTER_POP_MULT;
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
// Per-fighter regen: each player accumulates their own eligible time toward
// the next +AMOUNT pulse. Never a shared server-wide metronome — that made
// identical spends at identical displayed stamina resolve differently depending
// on an invisible global phase (including regen rescuing a zero before gassed).
const STAMINA_REGEN_INTERVAL_MS = 2000; // regen interval — bumped from 2500 to soften gas pressure
const STAMINA_REGEN_AMOUNT = 8; // per pulse

// Charged attack timing
const CHARGE_FULL_POWER_MS = 1000; // Time to reach 100% charge (1 second)

// Stamina costs
const SLAP_ATTACK_STAMINA_COST = 3;
const CHARGED_ATTACK_STAMINA_COST = 5;
const DODGE_STAMINA_COST = 4;

// Stamina drain on victim when hit — light chips only; balance is the real hit tax.
// Slap: none. Charged: ~one slap's worth. Palm: even lighter chip.
const SLAP_HIT_VICTIM_STAMINA_DRAIN = 0;
const CHARGED_HIT_VICTIM_STAMINA_DRAIN = 3;
const PALM_THRUST_HIT_VICTIM_STAMINA_DRAIN = 2;

// ============================================
// Balance System — clinch throw/kill-throw gating
// ============================================
const BALANCE_MAX = 100;
// Halo-style open-field posture regen: damage sticks until the fighter goes
// BALANCE_REGEN_DELAY_MS without taking ANY posture damage, then snaps back at
// BALANCE_REGEN_PER_SEC. Any new posture damage (hit, chip, clinch drain, etc.)
// stops active regen and restarts the delay. No regen while inClinch.
const BALANCE_REGEN_DELAY_MS = 1750;
const BALANCE_REGEN_PER_SEC = 35;
// Legacy drip rates (unused by the live tick — kept for reference / old docs).
const BALANCE_PASSIVE_REGEN_PER_SEC = 5;
const BALANCE_SLAP_HIT_DRAIN = 8;               // Balance lost when hit by a slap
const BALANCE_CHARGED_HIT_DRAIN = 15;           // Balance lost when hit by a charged attack (primary hit tax; stam is a light chip)

// ============================================
// Mutual Clinch System — push/plant/throw interactions
// ============================================

// Clinch push mechanics
// Winning pressure taxes the LOSER — pusher self-cost is a light lean only.
// Phase B push self-tax: 1 stam per 500ms ≈ 2/s (was GRAB_STAMINA_DRAIN 150ms ≈ 6.7/s).
// Phase A burst still uses GRAB_STAMINA_DRAIN_INTERVAL.

// Clinch plant — paid BRAKE: slow the walk + LOCK posture (no gain, no push drain).
// No regen inside clinch. Discrete punishes (jolt/throw) can still tax posture.
// Under push, plant stam upkeep is ~4.5/s.
// Legacy plant regen rate (unused — plant no longer regenerates balance).

// Neutral is the only clinch stance that recovers stamina, and only while not being pushed.

// Push vs push — stamina diff drives walk speed (saturating curve).
const CLINCH_PUSH_VS_PUSH_MAX_SPEED = 1.45;     // Crush cap ≈ 268 px/s
// Loser of a push war bleeds both meters (scaled by advantage intensity t).
// First LIGHT window of holding toward: slower, cancelable. Then committed drive.
const CLINCH_LIGHT_DRIVE_SPEED_MULT = 0.7;      // Light drive shove speed vs base
// Unanswered committed push vs neutral ramps to this.
const CLINCH_PUSH_RAMP_MAX_MULT = 1.6;          // Speed multiplier at full ramp

// Hard ceiling on any clinch shove velocity, applied at every site that turns a
// shove speed into displacement. Tuned paths sit under this:
//   one-sided push  1.8 × 1.1 (stamina+Deep Grip) × 1.6 (matured ramp) = 3.168
//   Open punish     same 3.168, reached sooner
//   push vs push    CLINCH_PUSH_VS_PUSH_MAX_SPEED = 1.45
// Bounds the Phase A grab burst, which was unbounded:
//   speed = (GRAB_PUSH_BURST_BASE + grabApproachSpeed × transfer) × clamp mult
//   grabApproachSpeed is raw approach velocity. Measured: arm-clamp slide 961 px/s,
//   ice slide 1034, matured clinch push 586; at approach 3.5 → 1304 px/s.
// Cap 4.0 ≈ 1.26× a matured clinch push.

// OPEN-PUNISH SHOVE — driving an Open opponent. Skips Light Drive; ramp starts pre-matured.
// Floor is the committed-drive baseline (1.0). Light Drive discount is 0.7; Plant brake is 0.3.
// Measured (scripts/report-open-punish-displacement.js), full stamina, dead-centre clinch,
// distance left to the tawara when Open ends:
//   1.6  (ramp max) → past the line
//   1.15            → 0.0px (on the line)
//   1.0  (this)     → 15.9px with Deep Grip, 38.7px without
// Values below 1.0 are inert — the ramp minimum is already 1.0.
const CLINCH_OPEN_PUNISH_RAMP_FLOOR = 1.0;
// Ease in/out of the punish speed rather than stepping to it (avoids a one-frame velocity snap).

// Legacy — push-vs-push no longer mixes balance into shove power. Kept exported
// so old docs/tools don't break; unused by grabActionSystem.

// Clinch gassed push penalty — only gassed players have reduced push power

// Continuous fatigue: push force scales with remaining stamina so attrition is a
// felt arc instead of a binary gassed cliff. Force mult lerps 1.0 (full stamina)
// down to the floor (0 stamina, not yet gassed). Gassed overrides with the hard 0.2.

// Gassed recovery is weaker inside the clinch — prevents the sawtooth where a
// ground-down opponent snaps back to full shove power mid-grind.
const GASSED_RECOVERY_STAMINA_IN_CLINCH = 30;   // vs 55 outside the clinch

// Edge push (at boundary)
// Edge finish while driving someone into the boundary:
//   instant — gassed / empty tank
//   timed   — accumulated pin hold (not now-minus-a-start)
// Technique startup suspends the drive without wiping accrued pin.
// Only leaving the boundary (or the pusher easing off) resets it.

// Edge zone — amplified danger near the boundary
const CLINCH_EDGE_ZONE_THRESHOLD = 60;           // Pixels from boundary to count as "edge zone"

// Stalemate timer

// Clinch separation (forced stalemate break)

// Clinch grab attachment — always belt grip spacing.
const CLINCH_ATTACHED_DISTANCE = Math.round(75 * 0.96); // ~72px

// Clinch Flow P1 — throw/pull techniques (both are throws; pull = side-switch yank).
// Clean techniques land unless held Plant resists (Deep Grip breaks Plant).
// Balance gates kill vs non-kill. Visible Open/recovery replaces hidden CDs.
// Initiation drains at COMMIT from defender stance. If Plant resists at impact,
// excess over plant-tier is refunded (incl. edge bonus).

// Clinch pull initiation drain (same matrix as throw; slightly cheaper reposition)

// OPEN — punishable vulnerability (stars). Resisted techniques / mutual tumbles.
// Resisted pacing: a rejected technique is a readable BEAT (hitstop) followed by
// real attacker disadvantage (Open). Open timers run on the sim clock, which
// freezes during hitstop, so the two ADD in wall-clock time:
//   ordinary RESISTED → 100ms freeze + 550ms Open  = 650ms
//   PERFECT BRACE     → 140ms freeze + 650ms Open  = 790ms
const CLINCH_THROW_FAIL_STAGGER_MS = 550;        // Resisted-technique Open duration
const CLINCH_PERFECT_BRACE_OPEN_MS = 650;        // Attacker Open after Perfect Brace
// Perfect Brace reaction opportunity = the ENTIRE visible technique startup
// (clinchThrowStartTime → impact). There is no narrow late-frame grade; the only
// slack is one tick past impact so a press that lands between the last startup
// tick and the resolve tick still counts.
// After authoritative Plant is active, a short latch keeps Throw/Pull brace armed
// if the defender releases early (tap instinct). Does NOT arm during Drive→Plant
// cancel — only refreshes while isActivelyPlanting. This governs PASSIVE held
// Plant only: a fresh in-window Brace is armed against the specific technique
// until impact and cannot expire on this latch.

// BRACE ATTEMPT CYCLE — same shape as AP (active window + settle, not a long lockout).
// ACTIVE must exceed the longest startup (Pull 250ms) plus impact slack.
const CLINCH_BRACE_ACTIVE_MS = 272;   // 17 ticks ≥ 250 + 16 slack
// SETTLE: no new attempt can start. Held Plant still resists a normal technique;
// Deep Grip still breaks it. Brace stamina cost is getPushForceMult.

// Counter-grab ARM CLAMP — catching raw parry with Grab:
//   • Immediate Balance damage (COUNTER_GRAB_BALANCE_DEBUFF)
//   • Stronger Phase A opening burst (ARM_CLAMP_BURST_*)
//   • Victim offense locked: no push / throw / pull / jolt / break
// Plant brace remains available. Clamp clears on: burst end (no pending/active
// throw), boundary contact, or once the grabber's filed technique is no longer pending/active.
const COUNTER_GRAB_BALANCE_DEBUFF = 10;          // Balance hit on counter-grab connect

// DEEP GRIP — breaks held Plant on throw/pull; consumed on technique commit.
// Still boosts push. Earned via jolt-vs-plant / push win.

// Mutual technique collision (no Deep Grip winner) → tumble apart, end clinch
const CLINCH_THROW_KILL_THRESHOLD = 15;          // Balance below which = KILL THROW (round over)
// Balance-scaled non-kill throw (full composure → short toss; near-kill → far).
// Distance, arc height, and duration all scale together so a high-Balance toss
// keeps a forward throw ratio instead of reading as a tall Y-hop with little travel.
const CLINCH_THROW_DISTANCE_MIN = 185;           // Clean throw at full Balance (was 140 — too hoppy)
const CLINCH_THROW_DISTANCE_MAX = 260;           // Clean throw near lethal Balance
const CLINCH_THROW_DISTANCE = 260;               // Legacy alias (= max); prefer scaled helper
const CLINCH_THROW_ARC_HEIGHT_MIN = 55;          // Weak toss peak ~44px (3.2×h×0.25)
const CLINCH_THROW_ARC_HEIGHT_MAX = 100;         // Strong toss peak ~80px
const CLINCH_THROW_ARC_HEIGHT = 100;             // Legacy alias (= max)
const CLINCH_THROW_DURATION_MIN_MS = 400;        // Snappy short toss — matches short travel
const CLINCH_THROW_DURATION_MAX_MS = 550;        // Longer air time for the far throw

// Clinch pull system (Mouse2 + away TAP during clinch)
const CLINCH_PULL_DISTANCE_MIN = 160;            // Side-switch yank at full Balance
const CLINCH_PULL_DISTANCE_MAX = 280;            // Side-switch yank near lethal
const CLINCH_PULL_DISTANCE = 280;                // Legacy alias (= max)
const CLINCH_PULL_TWEEN_DURATION = 600;          // Tween duration for pull movement
const CLINCH_PULL_INPUT_LOCK_MS = 650;           // Input lock after pull

// ============================================
// Cinematic Clinch Kill — exaggerated finishers when balance < kill threshold
// ============================================

// Kill Throw (Mouse2+W): High forward arc — launched above the screen, crashes down
const CLINCH_KILL_THROW_ARC_HEIGHT = 1000;       // High launch (clears screen) without a pure vertical spike
const CLINCH_KILL_THROW_DURATION_MS = 1700;
// Kill throws skip start/land hitstop (0). Constant kept for docs/exports.
const CLINCH_KILL_THROW_DISTANCE = 300;

// Normal Throw (Mouse2+W): Small forward arc — repositioning tool
const CLINCH_THROW_BOUNDARY_MARGIN = 11;         // Stop margin from map edge (matches pull margin)
const CLINCH_THROW_MIN_SEPARATION = 60;          // Min gap between thrower and victim at boundary

// Kill Pull (Mouse2+away): dragged through the thrower, then friction glide to a stop.
const CLINCH_KILL_PULL_DISTANCE = 210;           // Total glide distance (friction ease-out)
const CLINCH_KILL_PULL_TWEEN_DURATION = 850;
const CLINCH_KILL_PULL_INPUT_LOCK_MS = 800;

// Boundary Pull Swap — when puller's back is against the wall, swap positions instead
const CLINCH_PULL_SWAP_TWEEN_DURATION = 400;     // Quick swap tween (shorter than normal pull)
const CLINCH_PULL_SWAP_ARC_HEIGHT = 55;          // Hop arc height so pulled player clears the puller visually

// ============================================
// Clinch Jolt System (Mouse1 during clinch)
// Heavy committal chest-shove — anti-plant in the push/plant triangle.
// ============================================

// ============================================
// COMMAND GRAB
// ============================================
// M2 / M2+Back / M2+W pick Drive / Pull / Throw at press time; a connect resolves
// straight into that action. Entry frame data (GRAB_STARTUP_MS / GRAB_RANGE 175 /
// GRAB_WHIFF_RECOVERY_MS 450) is owned up there — everything here governs what
// happens AFTER connect.
const CMD_GRAB_VARIANT = { DRIVE: "drive", PULL: "pull", THROW: "throw" };

// Variant selection window. A direction press this long BEFORE the M2 edge still
// selects, and the variant stays revisable until the grab goes active — total
// ~295ms of tolerance vs the 220ms chord window it replaces. W counts held or
// tapped (no other grounded use); Back must be TAPPED, because players hold Back
// constantly while retreating and a panic-grab must not silently become a Pull.
const CMD_GRAB_VARIANT_PREBUFFER_MS = 150;

// Post-connect tell, PER VARIANT. Uninterruptible (no Brace, no post-connect Break).
// SIM-clock beats (start after connect freeze). Client tell = freeze + this, on
// clinchThrowAnimMs. Grip close is a separate beat (CMD_GRAB_CINCH_MS).
//   DRIVE  0     continuous shove
//   PULL   200   wall-clock with freeze ≈ 325ms
//   THROW  280   wall-clock with freeze ≈ 425ms
const CMD_GRAB_CONNECT_STARTUP_MS = { drive: 0, pull: 200, throw: 280 };
// Extra hold when already lethal at connect (balance < 15). Extra time is pose, not travel.
const CMD_GRAB_KILL_CONNECT_STARTUP_MS = { drive: 0, pull: 400, throw: 520 };

// Connect-gap close into settled grip. Independent of the tell.
// ~80ms at max range ≈ 1.4px/ms peak.
const CMD_GRAB_CINCH_MS = 80;

// Extra freeze on top of HITSTOP_GRAB_MS (55). Drive 0 still latches.
const CMD_GRAB_CONNECT_HITSTOP_MS = { drive: 0, pull: 70, throw: 90 };
// Launch freeze — throw only.
const CMD_THROW_LAUNCH_HITSTOP_MS = 150;
const CMD_PULL_LAUNCH_HITSTOP_MS = 0;

// Fraction of the carry over which the grip closes. Drive has no startup beat, so it happens on the move.
const CMD_DRIVE_CINCH_FRACTION = 0.35;

// GRAB_RANGE (175) vs settled grip (~61px). Gap closes over CMD_GRAB_CINCH_MS (~80ms):
// at max range grabber covers ~82px of a 114px gap (~1px/ms). This is the grabber's share.
const CMD_GRAB_CINCH_GRABBER_SHARE = 0.72;

// Paid once on connect. Whiffs already pay GRAB_WHIFF_RECOVERY_MS — no double bill.
const CMD_GRAB_STAMINA_COST = 8;

// ── DRIVE — carry toward the rope ───────────────────────────────────────────
// Server-stamped tween (start/duration/startX/targetX), not per-tick input-driven
// displacement, so the client can interpolate it instead of suspending prediction.
const CMD_DRIVE_CARRY_MS = 520;
const CMD_DRIVE_DISTANCE_MIN = 160;  // Standing / pocket floor
const CMD_DRIVE_DISTANCE_MAX = 250;  // Victim at the lethal line (~40% of the 595px ring)
const CMD_DRIVE_POSTURE_CHIP = 20;
const CMD_DRIVE_GASSED_DISTANCE_MULT = 0.35; // Gassed scales carry, not lethality
// Approach momentum (grabApproachSpeed, captured at grab startup) adds carry.
// REF ≈ ICE_SLIDE_MAX_SPEED 2.4; walk tops out near ICE_MAX_SPEED 1.3.
const CMD_DRIVE_APPROACH_REF_SPEED = 2.0;
// 250 + 45 = 295, under half the 595px ring.
const CMD_DRIVE_APPROACH_BONUS_MAX = 45;
// RETIRED as a ring-out gate. Drive KO at the rope is stamina-gated now
// (gassed / empty tank), matching slap/palm's clamp-unless-threshold pattern.
// Kept exported so old characterization tests can be rewritten against the new
// contract without a silent undefined import.
const CMD_DRIVE_EDGE_FORCE_OUT_FRACTION = 0.4;
// Stamina drain while a drive pins the victim against the tawara without a kill waiver.
// ~70/s ⇒ a half-second pin eats ~35 stam.
const CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC = 70;
// Release past GRAB_RANGE (+18px, same daylight as the old 146/164 pairing).
const CMD_DRIVE_RELEASE_SEPARATION = GRAB_RANGE + 18;
// Palms wind up in place this long; the slide starts on the shove-off palm's
// active / hit frame, not on the first startup or smear pose. MUST match
// client/src/config/combatTiming.js GRAB_SEPARATE_PALM_ANIM.SMEAR_END.
const CMD_DRIVE_RELEASE_IMPACT_MS = 80;
// Separation tween duration. Distance is pinned by CMD_DRIVE_RELEASE_SEPARATION;
// this sets speed. Paired with the "shove" / sine SEPARATION_EASE curve.
// Recovery stays 240/180. Last 30ms of the slide is settle, not travel.
const CMD_DRIVE_RELEASE_TWEEN_MS = 270;
// Victim share of the separation (was 50/50, then 86/14).
const CMD_DRIVE_RELEASE_VICTIM_SHARE = 0.7;
// Carry postures drop at this fraction of the slide (not at the end).
const CMD_DRIVE_RELEASE_POSE_DROP_FRACTION = 0.6;

// ── Pull / Throw posture chip ───────────────────────────────────────────────
const CMD_PULL_POSTURE_CHIP = 16;
const CMD_THROW_POSTURE_CHIP = 24;

// ── Recovery ────────────────────────────────────────────────────────────────
// Real `isRecovering` window (not just an action lock). Starts at
// CMD_DRIVE_RELEASE_IMPACT_MS. 240/180 against a 270ms tween → attacker ~60ms negative.
const CMD_DRIVE_ATTACKER_RECOVERY_MS = 240;
const CMD_DRIVE_DEFENDER_RECOVERY_MS = 180;
// Throw tail after travel (not stacked on the full arc).
const CMD_THROW_RECOVERY_TAIL_MS = 120;
// Command-grab Pull yank. CLINCH_PULL_TWEEN_DURATION (600) is shared with Matador.
// Kill still uses CLINCH_KILL_PULL_TWEEN_DURATION.
const CMD_PULL_TWEEN_MS = 320;
const CMD_PULL_INPUT_LOCK_MS = CMD_PULL_TWEEN_MS;
// Retired as a live deficit. Kept at 0.
const CMD_PULL_RECOVERY_TAIL_MS = 0;

// Simultaneous grab: forced into the grip, frozen, then thrown apart.
const CMD_GRAB_CLASH_HITSTOP_MS = 150;
const CMD_GRAB_CLASH_POSE_MS = 260;
const CMD_GRAB_CLASH_PUSHBACK = 96;
const CMD_GRAB_CLASH_SEPARATE_MS = 180;

// Gassed state: regen freeze when stamina hits 0
const GASSED_DURATION_MS = 5000; // 5s penalty (was 3s)
const GASSED_RECOVERY_STAMINA = 55; // Granted on exit

// ============================================
// HITSTOP TUNING
// ============================================
// Sim clock pauses for both players — frame advantage unchanged.
//   Guard 40 / Grab 55 / Slap 70 / Throw·AP·Matador 100–110
//   Jolt·Palm·Flap 140–160 / Perfect·full charge 210 / Cinematic·AP kill 550
// Charged scales 160→280 (floor at burst weight).
// ============================================
const SLAP_CHAIN_HIT_GAP_MS = 40;  // Minimum visual gap after slap hitstun before victim can be hit again
// Light-strike tier. Symmetric freeze — +0 slap frame math unaffected.
const HITSTOP_SLAP_MS = 70;
// Medium-heavy burst — palm thrust / flap body-slam. Below perfect/full-charge.
const HITSTOP_BURST_MS = 160;
// Charged floor sits at burst weight; full charge = heavy special freeze.
// (Was 100→210 — too close to slap 70ms to read as a committed headbutt.)
const HITSTOP_CHARGED_MIN_MS = 160;
const HITSTOP_CHARGED_MAX_MS = 280;
// Latch tier — brief "got you" on grab connect / tech.
const HITSTOP_GRAB_MS = 55;
// Confirm tier — throw / clinch-throw land.
const HITSTOP_THROW_MS = 100;

// ============================================
// Cinematic Kill — guaranteed ring-out finishing blow
// ============================================
// Charge % required for CINEMATIC presentation on a charged ring-out.
// Ring-out itself is separate (killReach / edge zones below) — a tap at the
// rope still kills, it just doesn't get the stylish freeze/camera/kb boost.
// Keys off raw charge held, not finalKnockbackMultiplier.
//   - NEUTRAL edge kill: demands a big commit for the stylish KO.
//   - READ kill (counter / punish / gassed / GORED): lower bar.
const CHARGED_KILL_MIN_CHARGE = 80;       // neutral cinematic floor
const CHARGED_KILL_READ_MIN_CHARGE = 50;  // counter/punish/gassed/GORED cinematic floor

// ── CHARGED RING-OUT — "kill reach" + middle deadzone ────────────────────────
// A charged hit rings the victim OUT only if, at contact, they are within
// `killReach` px of the ROPE (MAP_*_BOUNDARY 340/935) they're being knocked
// toward. killReach scales with the FULL power of the hit
// (finalKnockbackMultiplier — charge %, POWER power-up / Power Water, BASHO
// power & resistance, counter-hit), mapped linearly:
//   mult CHARGED_KILL_MULT_MIN (weakest charge)      → CHARGED_KILL_REACH_MIN
//   mult CHARGED_KILL_MULT_MAX (neutral 100% charge) → CHARGED_KILL_REACH_MAX
// Extra power beyond neutral-full keeps extending the reach along the same slope
// up to CHARGED_KILL_REACH_CAP — so power attributes / power-ups matter even at
// low charge, but can never turn it into a from-anywhere one-shot.
//
// MIDDLE DEADZONE (symmetric about center): ring is 595px wide (left 340 → right
// 935, center 637). Cap ⇒ 595 − 2×CHARGED_KILL_REACH_CAP = 325px (~55% of the
// ring) where a charged hit can NEVER ring out — rope-clamps at the edge instead
// (collisionSystem + index.js). Edge bands on both sides are equal. Cinematic is
// an optional presentation layer on top of kills that already clear this gate.
const CHARGED_KILL_REACH_MIN = 20;   // px from rope at the weakest charge (must be pinned)
const CHARGED_KILL_REACH_MAX = 100;  // px from rope at a neutral 100% charge (outer third of a side)
const CHARGED_KILL_REACH_CAP = 135;  // absolute max reach — the deadzone guard
const CHARGED_KILL_MULT_MIN = 0.45;  // finalKnockbackMultiplier at 0% charge (curve floor)
const CHARGED_KILL_MULT_MAX = 1.2;   // finalKnockbackMultiplier at a neutral 100% charge

// Legacy dials — charged hits now PLANT (Honda headbutt): no attacker bounce-back.
// Kept exported so old Tunings / imports don't break; unused by hit resolution.
const CHARGED_ATTACKER_RECOIL_BASE = 0.3;
const CHARGED_ATTACKER_RECOIL_CHARGE_SCALE = 0.5;
const CHARGED_RECOIL_FRICTION = 0.85;
// On-hit recovery AFTER hitstop (sim-clock). Victim hitstun is ~380ms; this is
// deliberately shorter so a landed charge stays PLUS. Whiff recovery is longer.
const CHARGED_HIT_RECOVERY_MS = 280;

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
// MASTERY — TUNING CONSTANTS
// ============================================================================
// Read only on paths gated by the matching flag in masteryFlags.js.
// SAFE fallbacks noted in trailing comments. Formulas collapse to the floor
// at entry velocity 0 / full posture.

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
const SLAP_SLIDE_MIN = 0.45; // fade-away slap floor: retreating entry still gets a short step-in
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
const GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY = 0.65; // Dash/slide inheritance when mastery on

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
// Gated by MASTERY_P2_POSTURE. Flag off → BALANCE_* drains, SLAP_KILL_RANGE /
// CHARGED_KILL_REACH_CAP, isPostureBroken forced false. Server field stays `balance`.

// Hysteresis: breaks below threshold, recovers above the higher recover threshold.
const POSTURE_BREAK_THRESHOLD = 35;      // balance < this ⇒ isPostureBroken = true
const POSTURE_RECOVER_THRESHOLD = 45;    // balance > this ⇒ isPostureBroken = false

// Shadow BALANCE_* while the flag is on. Counter-hits × POSTURE_COUNTER_DRAIN_MULT.
// Open-field regen: BALANCE_REGEN_DELAY_MS + BALANCE_REGEN_PER_SEC.
const BALANCE_SLAP_HIT_DRAIN_P2 = 7;        // was 12
const BALANCE_CHARGED_HIT_DRAIN_P2 = 18;    // today 15; SAFE 16
const BALANCE_PALM_HIT_DRAIN_P2 = 20;       // today 15 (charged); SAFE 18
// Legacy drip (replaced by Halo BALANCE_REGEN_PER_SEC + BALANCE_REGEN_DELAY_MS).
const BALANCE_PASSIVE_REGEN_PER_SEC_P2 = 6;
// Gassed taxes posture recovery (does not freeze it). No open-field regen while inClinch.
const BALANCE_GASSED_REGEN_MULT = 0.5;
const POSTURE_COUNTER_DRAIN_MULT = 1.5;     // counter-hits drain ×1.5 posture

// Edge kill band (slap/palm/flap-slam):
//   band = SLAP_KILL_RANGE
//        + KILLBAND_MOMENTUM * min(slapEntryAligned, KILLBAND_MOMENTUM_REF)/KILLBAND_MOMENTUM_REF
//        + (victim.isPostureBroken ? KILLBAND_POSTURE : 0)
//   band = min(band, KILLBAND_CAP)
// Palm/flap have no slapEntryAligned — momentum term is 0.
const KILLBAND_MOMENTUM = 25;          // SAFE 15 — extra band from a full-momentum entry
const KILLBAND_MOMENTUM_REF = 1.3;     // aligned entry velocity that saturates the momentum term
const KILLBAND_POSTURE = 30;           // SAFE 20 — extra band vs a broken-posture victim
const KILLBAND_CAP = 110;              // absolute max slap/palm/flap kill band (deadzone guard)
// Charged: killReach *= this, still capped by CHARGED_KILL_REACH_CAP (135)
// → 595 − 2×135 = 325px midscreen no-kill deadzone.
const POSTURE_CHARGED_KILL_REACH_MULT = 1.25;

// ── Phase 3 — Cadence (MASTERY_P3_CADENCE) ──────────────────────────────────
// Flag off → isEnhancedSlap never set, cadenceChain stays 0, slap uses
// SLAP_TOTAL_MS / BALANCE_SLAP_HIT_DRAIN_P2. Window judged on the sim clock
// via the existing buffer timestamp (never packet arrival).
const CADENCE_WINDOW_MS = 85;          // gap ≤ this (cycleEnd − buffered press) ⇒ enhanced (was 60)
const SLAP_TOTAL_MS_ENHANCED = 235;    // Normal cycle −25ms recovery tail (startup/active untouched)
const BALANCE_SLAP_HIT_DRAIN_ENHANCED = 10; // was 16; P2 base is 7
const CADENCE_STEP_IN_MULT = 1.15;     // SAFE 1.1 — enhanced on-hit pair shift (step-in) scale
// Fraction of follow-up slaps a CPU times into the window, by difficulty.
const CPU_CADENCE_EASY = 0.0;
const CPU_CADENCE_NORMAL = 0.25;
const CPU_CADENCE_HARD = 0.6;
const CPU_CADENCE_IMPOSSIBLE = 0.92;

// ── Phase 4 — Analog resolutions (MASTERY_P4_ANALOG) ────────────────────────
// Flag off → parry payouts, clash shove, charge duration, spacing bonus, and
// counter-hit window use the non-mastery constants.

// Perfect-window quality (1 = earliest in window):
//   quality      = clamp(1 − parryDuration / PERFECT_PARRY_WINDOW, 0, 1)
//   attackerStun = lerp(PERFECT_PARRY_ATTACKER_STUN_DURATION, _MAX, quality)
//   parryShove   = lerp(PERFECT_PARRY_KNOCKBACK,              _MAX, quality)
//   postureRefund= round(lerp(PERFECT_PARRY_BALANCE_REFUND,   _MAX, quality))
// Quality 0 = base 420 / 0.65 / 12. Regular (non-perfect) parries untouched.
const PERFECT_PARRY_ATTACKER_STUN_MAX = 500; // analog ceiling; live floor is 420. Must stay ≥ AP_STAGGER_FLAP_MS.
const PERFECT_PARRY_KNOCKBACK_MAX = 0.95;    // base PERFECT_PARRY_KNOCKBACK 0.65; SAFE 0.85
const PERFECT_PARRY_BALANCE_REFUND_MAX = 20; // base PERFECT_PARRY_BALANCE_REFUND 12; SAFE 18

// Slap pocket vs poke (tip) — retired. Constants kept as unused exports.
const SLAP_TIP_POCKET_SLACK_PX = 3; // still "pocket" this far past pushbox
const SLAP_TIP_POSTURE_MULT = 1.3;  // unused — feel package retired
const SLAP_TIP_HITSTOP_BONUS_MS = 20; // unused — feel package retired
const SLAP_TIP_FEEL_THRESHOLD = 0.5;
const SLAP_TIP_DRIFT_MULT = 1.0;
// Legacy aliases (old absolute band). Live tip math no longer uses them.
const SLAP_TIP_DISTANCE_MIN = 95;
const SLAP_TIP_DISTANCE_MAX = 125;
const SLAP_TIP_DISTANCE = SLAP_TIP_DISTANCE_MAX;

// Clash margin scaling:
//   t        = clamp((gap − CLASH_MARGIN_MIN_MS) / (CLASH_MARGIN_MAX_MS − CLASH_MARGIN_MIN_MS), 0, 1)
//   loserKb  = lerp(CLASH_LOSER_KB_MIN,  CLASH_LOSER_KB_MAX,  t)
//   winnerKb = lerp(CLASH_WINNER_KB_MAX, CLASH_WINNER_KB_MIN, t)
const CLASH_MARGIN_MIN_MS = 30;   // == SLAP_PARRY_NEUTRAL_WINDOW_MS (the smallest decisive gap)
const CLASH_MARGIN_MAX_MS = 45;   // == SLAP_PARRY_WINDOW — saturate within clashable gaps
const CLASH_LOSER_KB_MIN = 3.5;
const CLASH_LOSER_KB_MAX = 5.8;
const CLASH_WINNER_KB_MAX = 1.2;
const CLASH_WINNER_KB_MIN = 0.6;

// Continuous charge (replaces 300/500/1000 lunge-tier buckets):
//   attackDuration = CHARGE_DURATION_BASE_MS + CHARGE_DURATION_SCALE_MS * (charge/100)^CHARGE_DURATION_EXP
// Endpoints: charge 0 → 300ms, charge 100 → 2000ms. Priority (30) and kill gates (50 / 80) unchanged.
const CHARGE_DURATION_BASE_MS = 300;
const CHARGE_DURATION_SCALE_MS = 1700;
const CHARGE_DURATION_EXP = 1.6;

// Key-held slap follow-through removed. Slap transfer uses Phase 1 slapEntryAligned.
// Intent-only counter window 150→100ms. Active-startup counter keeps COUNTER_HIT_WINDOW_MS.
// Flag off ⇒ both use 150.
const COUNTER_HIT_INTENT_WINDOW_MS = 100; // SAFE 120

// ── Phase 5 (MASTERY_P5_ASSISTS) ────────────────────────────────────────────
// Flag off → SIDESTEP_GRAB_TRACK_RANGE (400). Presentation gates only (no distance/frame change).
const SIDESTEP_GRAB_TRACK_RANGE_P5 = 220; // SAFE 280 (today 400)
const SPEED_STATE_VELOCITY_THRESHOLD = 0.9; // |movementVelocity| above which snow-spray + lean read
const MOMENTUM_HIT_MULT_THRESHOLD = 1.25;   // on-hit momentumMult above which the heavy-hit tell fires

module.exports = {
  GRAB_STATES,
  TICK_RATE,
  BROADCAST_EVERY_N_TICKS,
  KEYFRAME_EVERY_N_BROADCASTS,

  // Delta state tracking
  ALWAYS_SEND_PROPS,
  DELTA_TRACKED_PROPS,
  LANDING_DIAG_DELTA_PROPS,
  ALL_TRACKED_PROPS,

  // Screen shake
  SCREEN_SHAKE_MIN_INTERVAL,

  // Core physics
  speedFactor,
  GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE,
  CHARGED_HITBOX_DISTANCE_VALUE,
  SLAP_HITBOX_DISTANCE_VALUE,
  STRIKE_TIP_SLAP1_SPRITE_PX,
  STRIKE_TIP_SLAP2_SPRITE_PX,
  STRIKE_TIP_CHARGED_SPRITE_PX,
  STRIKE_TIP_PALM_SPRITE_PX,
  STRIKE_SKIN_EMBED_PX,
  STRIKE_PALM_REACH_OVERHANG_PX,
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
  PAST_MAP_DIRT_KB_FRICTION,
  OUTSIDE_DOHYO_DIRT_KB_FRICTION,
  PAST_MAP_DIRT_MOVE_FRICTION,
  OUTSIDE_DOHYO_DIRT_MOVE_FRICTION,
  KILL_PULL_DIRT_OVERSHOOT_SCALE,
  KILL_PULL_DIRT_FALL_OVERSHOOT_SCALE,

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
  ICE_SLIDE_FRICTION,
  ICE_SLIDE_COAST_FRICTION,
  ICE_SLIDE_STEER_FRICTION,
  ICE_SLIDE_OPPOSE_FRICTION,
  ICE_SLIDE_EXIT_SPEED,
  ICE_SLIDE_MAX_SPEED,
  ICE_SLIDE_MAINTAIN,
  ICE_SLIDE_REVERSE_SPEED_MAX,
  ICE_SLIDE_BRAKE_ARM_MS,
  ICE_SLIDE_REVERSE_BUFFER_MS,
  ICE_SLIDE_REVERSE_BURST,
  ICE_SLIDE_REVERSE_HOP_MS,
  ICE_SLIDE_REVERSE_HOP_HEIGHT,
  ICE_SLIDE_REVERSE_COOLDOWN_MS,
  SLIDE_JUMP_MIN_MS,
  SLIDE_JUMP_BUFFER_MS,
  SLIDE_JUMP_LIFTOFF_IMPULSE,
  SLIDE_JUMP_GRAVITY,
  SLIDE_JUMP_H_MIN,
  SLIDE_JUMP_H_CARRY,
  SLIDE_JUMP_H_MAX_MULT,
  SLIDE_JUMP_H_STACK_START,
  SLIDE_JUMP_H_STACK_FULL_MULT,
  SLIDE_JUMP_H_STACK_HEADROOM,
  SLIDE_JUMP_AIR_STEER,
  SLIDE_JUMP_AIR_STEER_BLEED,
  SLIDE_JUMP_LANDING_RECOVERY_MS,
  SLIDE_JUMP_LAND_SETTLE_MS,
  SLIDE_JUMP_DIVE_MIN_AIR_MS,
  SLIDE_JUMP_DIVE_MIN_HEIGHT,
  SLIDE_JUMP_DIVE_BUFFER_MS,
  SLIDE_JUMP_LAND_SLAM_IFRAME_MS,
  FLAP_BODYSLAM_PARK_MAX_NUDGE_PX,
  FLAP_BODYSLAM_POST_HIT_H_DAMP,
  DOHYO_EDGE_PANIC_ZONE,
  ROPE_KICKOFF_ZONE,
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
  SLIDE_SLAP_ARM_SPEED,
  SLIDE_SLAP_EXTRA_RECOVERY_MS,
  SLAP_TOTAL_MS_SLIDE,
  SLIDE_SLAP_ADVANTAGE_MS,
  SLIDE_SLAP_HITSTOP_CAP_MS,
  SLIDE_SLAP_FOLLOW_VEL,
  SLIDE_SLAP_FOLLOW_FRICTION,
  BURST_KB_VELOCITY,
  BURST_STUN_MS,
  BURST_KB_FRICTION,
  SLAP_KILL_RANGE,
  SLAP_ROPE_RESIST_BUFFER,
  SLAP_ROPE_EDGE_ZONE,
  SLAP_EDGE_POSTURE_MULT,
  PALM_EDGE_POSTURE_MULT,
  SLAP_EDGE_HITSTOP_MS,
  PALM_EDGE_HITSTOP_MS,
  SLAP_ONHIT_ATTACKER_PUSH,
  SLAP_ONHIT_VICTIM_DRIFT,
  SLAP_COUNTER_HIT_BONUS_MS,
  SLAP_COUNTER_KB_MULT,
  GORED_KB_MULT,
  GORED_HITSTUN_BONUS_MS,
  GORED_CHARGED_KB_MULT,
  GORED_HITSTOP_BONUS_MS,
  SLAP_MIN_HITSTUN_MS,
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MS,
  CHARGED_ACTIVE_MIN_MS,
  CHARGED_ACTIVE_MAX_MS,
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
  DODGE_IFRAME_MS,

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
  POST_SIDESTEP_FACING_TRACK_MS,

  // Dodge physics
  DODGE_DURATION,
  DODGE_BASE_SPEED,
  DODGE_TRAVEL_DISTANCE,
  DODGE_SPEED_MULT_CAP,
  DODGE_CANCEL_ACTION_LOCK,

  // Grab mechanics
  GRAB_WALK_SPEED_MULTIPLIER,
  GRAB_WALK_ACCEL_MULTIPLIER,
  GRAB_STARTUP_DURATION_MS,
  GRAB_STARTUP_HOP_HEIGHT,
  GRAB_LUNGE_DISTANCE,
  GRAB_LUNGE_FRICTION,
  SLAP_ATTACK_STARTUP_MS,
  GRAB_WHIFF_RECOVERY_MS,
  GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION,
  GRAB_BREAK_RESIDUAL_VEL,
  GRAB_BREAK_INPUT_LOCK_MS,
  GRAB_BREAK_ACTION_LOCK_MS,
  GRAB_BREAK_REACTION_LOCK_MS,
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
  RINGOUT_PUSH_DURATION_MS,
  RINGOUT_PUSH_DISTANCE,
  RINGOUT_PUSH_IDLE_DELAY_MS,
  RINGOUT_PUSH_SEPARATE_DELAY_MS,
  RINGOUT_PUSH_DEFEAT_DELAY_MS,

  // Parry system
  RAW_PARRY_KNOCKBACK,
  RAW_PARRY_SLAP_KNOCKBACK,
  PERFECT_PARRY_KNOCKBACK,
  PERFECT_PARRY_JUST_TICKS,
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
  INPUT_BACKDATE_MIN_MS,
  INPUT_BACKDATE_RTT_SLACK_MS,
  INPUT_CLOCK_OFFSET_MAX_DELTA_MS,
  INPUT_PRESS_MONOTONIC_SLACK_MS,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_STAMINA_COST,
  RAW_PARRY_STAMINA_REFUND,
  PERFECT_PARRY_BALANCE_REFUND,
  // Guard & Parry (AP)
  AP_ACTIVE_MS,
  AP_OPEN_HIT_GRACE_ENABLED,
  AP_LATE_PARRY_MS,
  SLAP_GRACE_CONFIRM_SLACK_PX,
  AP_FLOW_WINDOW_MS,
  AP_SUCCESS_RECOVERY_MS,
  AP_WHIFF_RECOVERY_MS,
  AP_COOLDOWN_MS,
  MATADOR_ACTIVE_MS,
  MATADOR_WHIFF_RECOVERY_MS,
  MATADOR_HITSTOP_MS,
  MATADOR_SUCCESS_LOCK_MS,
  MATADOR_PULL_DISTANCE,
  MATADOR_PULL_DISTANCE_MAX,
  AP_STAMINA_COST,
  AP_KILL_ENABLED,
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
  GUARD_ATTACKER_RECOVERY_MS,
  GUARD_CRUSH_STUN_MS,
  SLAP_TRADE_WINDOW_MS,
  SLAP_TRADE_KNOCKBACK,
  PALM_TRADE_WINDOW_MS,
  PALM_TRADE_KNOCKBACK,
  PALM_VS_SLAP_TRADE_WINDOW_MS,
  PALM_VS_SLAP_TRADE_KB_ON_SLAPPER,
  PALM_VS_SLAP_TRADE_KB_ON_PALM,

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
  ROPE_JUMP_LANDING_COMMIT_T,
  ROPE_JUMP_LANDING_COMMIT_T_MIN,

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
  AIR_STRIKE_HURT_HEIGHT,
  FLAP_BODYSLAM_KB_VELOCITY,

  // Hit recovery
  HIT_FALL_GRAVITY,
  HIT_FALL_POP_LIGHT,
  HIT_FALL_POP_MEDIUM,
  HIT_FALL_POP_HEAVY,
  HIT_FALL_RISE_KEEP,
  HIT_FALL_MAX_POP,
  HIT_FALL_DUMP_LIGHT,
  HIT_FALL_DUMP_MEDIUM,
  HIT_FALL_DUMP_HEAVY,
  HIT_FALL_CARRY_DOWN_SCALE,
  HIT_FALL_COUNTER_POP_MULT,
  HIT_FALL_COUNTER_DUMP_MULT,
  HIT_FALL_MAX_FALL_SPEED,
  AIR_HIT_KB_MULT,
  AIR_HIT_CARRY_X_SCALE,
  AIR_HIT_KB_BONUS_PX,
  AIR_HIT_EJECT_MAX_PX_PER_TICK,
  AIR_HIT_EJECT_SEP_EPS,
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
  // Command grab
  CMD_GRAB_VARIANT,
  CMD_GRAB_VARIANT_PREBUFFER_MS,
  CMD_GRAB_CONNECT_STARTUP_MS,
  CMD_GRAB_KILL_CONNECT_STARTUP_MS,
  CMD_GRAB_CONNECT_HITSTOP_MS,
  CMD_GRAB_CINCH_MS,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  CMD_PULL_LAUNCH_HITSTOP_MS,
  CMD_GRAB_CINCH_GRABBER_SHARE,
  CMD_GRAB_STAMINA_COST,
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_DRIVE_GASSED_DISTANCE_MULT,
  CMD_DRIVE_APPROACH_REF_SPEED,
  CMD_DRIVE_APPROACH_BONUS_MAX,
  CMD_DRIVE_CINCH_FRACTION,
  CMD_DRIVE_EDGE_FORCE_OUT_FRACTION,
  CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC,
  CMD_DRIVE_RELEASE_SEPARATION,
  CMD_DRIVE_RELEASE_IMPACT_MS,
  CMD_DRIVE_RELEASE_TWEEN_MS,
  CMD_DRIVE_RELEASE_VICTIM_SHARE,
  CMD_DRIVE_RELEASE_POSE_DROP_FRACTION,
  CMD_PULL_POSTURE_CHIP,
  CMD_THROW_POSTURE_CHIP,
  CMD_DRIVE_ATTACKER_RECOVERY_MS,
  CMD_DRIVE_DEFENDER_RECOVERY_MS,
  CMD_THROW_RECOVERY_TAIL_MS,
  CMD_PULL_RECOVERY_TAIL_MS,
  CMD_PULL_TWEEN_MS,
  CMD_PULL_INPUT_LOCK_MS,
  CMD_GRAB_CLASH_HITSTOP_MS,
  CMD_GRAB_CLASH_POSE_MS,
  CMD_GRAB_CLASH_PUSHBACK,
  CMD_GRAB_CLASH_SEPARATE_MS,

  // Balance system
  BALANCE_MAX,
  BALANCE_REGEN_DELAY_MS,
  BALANCE_REGEN_PER_SEC,
  BALANCE_PASSIVE_REGEN_PER_SEC,
  BALANCE_SLAP_HIT_DRAIN,
  BALANCE_CHARGED_HIT_DRAIN,

  // Mutual clinch system
  CLINCH_PUSH_VS_PUSH_MAX_SPEED,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_OPEN_PUNISH_RAMP_FLOOR,
  GASSED_RECOVERY_STAMINA_IN_CLINCH,
  CLINCH_THROW_FAIL_STAGGER_MS,
  COUNTER_GRAB_BALANCE_DEBUFF,
  CLINCH_EDGE_ZONE_THRESHOLD,
  CLINCH_ATTACHED_DISTANCE,

  // Clinch throw/pull
  CLINCH_LIGHT_DRIVE_SPEED_MULT,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_BRACE_ACTIVE_MS,
  CLINCH_THROW_DISTANCE_MIN,
  CLINCH_THROW_DISTANCE_MAX,
  CLINCH_THROW_ARC_HEIGHT_MIN,
  CLINCH_THROW_ARC_HEIGHT_MAX,
  CLINCH_THROW_DURATION_MIN_MS,
  CLINCH_THROW_DURATION_MAX_MS,
  CLINCH_PULL_DISTANCE_MIN,
  CLINCH_PULL_DISTANCE_MAX,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_DISTANCE,
  CLINCH_THROW_ARC_HEIGHT,
  CLINCH_PULL_DISTANCE,
  CLINCH_PULL_TWEEN_DURATION,
  CLINCH_PULL_INPUT_LOCK_MS,

  // Cinematic clinch kills
  CLINCH_KILL_THROW_ARC_HEIGHT,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_THROW_DISTANCE,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_KILL_PULL_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CLINCH_PULL_SWAP_ARC_HEIGHT,

  // Clinch jolt system

  // Hitstop (FG impact ladder — see HITSTOP TUNING block)
  SLAP_CHAIN_HIT_GAP_MS,
  HITSTOP_SLAP_MS,
  HITSTOP_BURST_MS,
  HITSTOP_CHARGED_MIN_MS,
  HITSTOP_CHARGED_MAX_MS,
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
  BALANCE_GASSED_REGEN_MULT,
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
  SLAP_TIP_DISTANCE_MIN,
  SLAP_TIP_DISTANCE_MAX,
  SLAP_TIP_POCKET_SLACK_PX,
  SLAP_TIP_POSTURE_MULT,
  SLAP_TIP_HITSTOP_BONUS_MS,
  SLAP_TIP_FEEL_THRESHOLD,
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

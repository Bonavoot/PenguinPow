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
  'isGrabbingMovement', 'isWhiffingGrab', 'isGrabWhiffRecovery', 'isGrabTeching', 'grabTechRole', 'isGrabStartup',
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
  'isGrabSeparating', 'isGrabBellyFlopping', 'isBeingGrabBellyFlopped',
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
  'isRopeJumping', 'ropeJumpPhase', 'sizeMultiplier', 'isGassed',
  // Flap charges / wing-beat sync ride on slide-jump when FLAP is equipped
  // (standalone isFlapping liftoff was removed). Fields kept for cleanup/deltas.
  'isFlapping', 'flapPhase', 'flapCharges', 'flapWingBeatTime', 'flapFastFalling', 'flapBeatHDir',
  'isSidestepping', 'isSidestepStartup', 'isSidestepRecovery',
  'isSlapParryRecovering',
  'isHitFalling', 'isSidestepHitReturn',
  'inClinch', 'hasGrip', 'clinchAction',
  // Holding M2 (or mid throw/pull) → arms on belt; otherwise body-hold pose.
  'isClinchBeltHolding',
  // Legacy wire field — always false. M2-through-connect is valid belt hold.
  'clinchBeltRequiresM2Release',
  'isClinchThrowing', 'isClinchClashing',
  'isClinchPushing', 'isClinchPlanting',
  'isResistingThrow', 'isResistingPull',
  'isClinchKillThrowVictim', 'isClinchKillPullVictim',
  'isClinchJolting', 'isBeingClinchJolted', 'isClinchJoltClashing',
  'clinchJoltRecovery',
  'isArmClamped', 'clinchThrowFailStagger', 'isClinchOpen', 'clinchOpenHideStars', 'isCounterGrabbed',
  'hasDeepGrip',
  // Clinch Flow P2 — committed drive lean (visual + counterthrow vulnerability)
  'isClinchCommittedDrive',
  // Perfect Brace flash (one-shot tell on the defender)
  'isClinchPerfectBracing',
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
// Legacy slap-clash freeze (clash system removed — trades use HITSTOP_SLAP_MS).
// Kept exported so stale imports don't crash; not used by live hitstop paths.
const SLAP_PARRY_HITSTOP_MS = 110;
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
// Slap-catch uses full grab range. (A tighter pocket made tip-range slap
// spacing un-grabbable while slap could still stuff — feel was too weak.)
const GRAB_SLAP_CATCH_RANGE = GRAB_RANGE;

// ============================================
// FRAME DATA SYSTEM — Formal startup/active/recovery for every move
// Real fighting game structure: Startup → Active → Recovery
// Startup: committed but can't hit. Active: hitbox live. Recovery: punishable.
// ============================================
const SLAP_STARTUP_MS = 55;       // Wind-up before hitbox. Kept SHORT so slaps
                                  // read as FAST jabs (not slow taps). Client
                                  // SLAP_ANIM.SMEAR_END must equal this so hit art
                                  // never leads the active frames (see GameFighter).
const SLAP_ACTIVE_MS = 130;       // Hitbox live window — extra chase time after a
                                  // connect so the follow-up slide can re-tag
                                  // before soft-whiffing off a knife-edge gap.
const SLAP_RECOVERY_MS = 75;      // Can't act, no hitbox. Full cycle = startup+active+recovery.
const SLAP_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;

// ── SLAP REWORK: individual presses, no string/combo ────────────────────────
// Each mouse1 press is one self-contained slap. On hit BOTH players become
// actionable at the same instant (+0 by construction: the victim's hitstun is
// set to the attacker's remaining cycle at the moment of connect — see
// processHit). The reward for landing a slap is GROUND, not frames: both
// players slide toward the victim's rope together (attacker slightly faster so
// mash pressure stays glued). Slap1/slap2 alternate cosmetically only.

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
// On connect BOTH slide toward the victim's rope, but the attacker carries a
// touch more so the next slap stays in range (chase/glue). Equal speeds still
// soft-whiffed once victimKb / counters / coast desync opened a knife-edge gap
// during the follow-up's startup. Real big-spacing tools stay intentional:
// counters (SLAP_COUNTER_KB_MULT), palm, charged, grab.
const SLAP_ONHIT_ATTACKER_PUSH = 1.35;  // Chase slide — glue mash pressure after connect
const SLAP_ONHIT_VICTIM_DRIFT = 1.0;    // Pair transfer; attacker closes relative gap

// ── SLAP COUNTER HIT ─────────────────────────────────────────────────────────
// A counter hit (clipping the opponent's startup) is the ONLY way a slap grants
// frame advantage: a flat bonus on top of the +0 base, plus extra shove. The
// bonus means your NEXT slap wins a mash-vs-mash clash decisively, but it does
// NOT reach combo territory — a parry (or simply moving) still answers it.
const SLAP_COUNTER_HIT_BONUS_MS = 35;   // Flat hitstun bonus — the earned tempo beat
const SLAP_COUNTER_KB_MULT = 1.25;      // Victim drift multiplier on counter (extra ground)
// Safety floor for the dynamically computed hitstun (see processHit).
const SLAP_MIN_HITSTUN_MS = 60;

// ── EXPOSED (MATADOR punish) ─────────────────────────────────────────────────
// Hitting someone during a live / whiffed MATADOR is a special RPS punish —
// the grab-line counterpart to CLAMPED. Callout reads "EXPOSED". Harder shove
// than a counter hit, and forces ring-out eligibility (wrong hard-read must hurt).
// Internals still use GORED_* / isGored names.
const GORED_KB_MULT = 2.55;            // vs SLAP_COUNTER_KB_MULT 1.25 — must READ as a shove
const GORED_HITSTUN_BONUS_MS = 130;    // vs SLAP_COUNTER_HIT_BONUS_MS 35 — clear tempo steal
const GORED_CHARGED_KB_MULT = 1.85;    // charged/palm into matador also pays
const GORED_HITSTOP_BONUS_MS = 45;     // EXPOSED bonus — special, but stays under palm tier

const CHARGED_STARTUP_MS = 150;   // Clear windup (unchanged)
// Hitbox live window AFTER startup. Charge scales MIN→MAX; the lunge ends with
// the active window (no multi-second skating hitbox). Speed still charge-scales,
// so fuller charges cover more ground during the same threat window.
const CHARGED_ACTIVE_MIN_MS = 200;
const CHARGED_ACTIVE_MAX_MS = 450;
// Legacy alias — older call sites / docs. Equals the tap-charge floor.
const CHARGED_ACTIVE_MS = CHARGED_ACTIVE_MIN_MS;

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
// Fixed "charge %" used ONLY for the palm's trade priority, NOT its knockback
// or hitstop: 35 sits ABOVE CHARGE_PRIORITY_THRESHOLD (30) so the thrust beats a
// slap on a simultaneous trade. Connect freeze is flat HITSTOP_BURST_MS (palm/
// flap tier). The shove is a fixed burst impulse (PALM_THRUST_KB_VELOCITY) —
// the palm does NOT run the 0.45+charge^1.3 charged formula.
const PALM_THRUST_POWER = 35;
// Heavy single-hit knockback — now the game's big committal SHOVE (slaps only
// gain ground; the palm SENDS them). Delivered via the burst model (smooth
// ICE_COAST slide + rope clamp): the reward for a slower, rooted, punishable,
// grab-losable read. Sits under BURST_KB_VELOCITY (3.1, the flap body-slam)
// as the ground-based burst tier.
const PALM_THRUST_KB_VELOCITY = 2.4;
const PALM_THRUST_STAMINA_COST = 4;        // Slightly above slap (3) — committed poke, not a gas tax
// Legacy fallback — live palm reach is tip-based (STRIKE_TIP_PALM_SPRITE_PX)
// plus STRIKE_PALM_REACH_OVERHANG_PX in strikeContact.getConnectDistance.
const PALM_THRUST_HITBOX_DISTANCE_VALUE = 164;

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

const GRAB_STARTUP_MS = 145;      // Readable telegraph. Early startup is
                                  // stuffable; throw-catch begins late in
                                  // startup (see GRAB_THROW_CATCH_START_MS).
const GRAB_ACTIVE_MS = 110;       // Grab connect / slap-catch window
// When throw-catch vs slap begins (ms after grab press). Must be ≤ slap
// recovery (75ms) so a grab pressed on slap recovery can reach catch before
// the next mashed slap stuffs you — otherwise PB slap mash makes grab
// mathematically impossible (startup 145 > recovery 75). Early window
// stays hittable so meaty/react slaps still beat raw grab attempts.
const GRAB_THROW_CATCH_START_MS = 70;

const DODGE_STARTUP_MS = 50;      // Readable windup/anticipation before the hop (was 20)
const DODGE_ACTIVE_MS = 210;      // Actual dash movement — lengthened for readability (was 175); speed lowered to keep the same travel distance
const DODGE_RECOVERY_MS = 0;      // No recovery — cooldown prevents chain-dash (was 90)
const DODGE_TOTAL_MS = DODGE_STARTUP_MS + DODGE_ACTIVE_MS + DODGE_RECOVERY_MS; // 260ms
const DODGE_COOLDOWN_MS = 100;    // Forced idle gap after recovery before next dash (prevents chain-dash blur)
// Strike-only startup invuln from dodge press. Covers most of the 50ms windup so
// a committed dodge slips a meaty; cuts off before/as active travel begins so
// late panic into live hitboxes is still hittable. Grabs ignore this entirely.
const DODGE_IFRAME_MS = 40;
// Gassed: dodge / sidestep / rope jump / flap are all hard-locked while gassed
// (denied attempts surface the "not enough stamina" cue).

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

// ============================================
// ICE SLIDE (SHIFT held through dodge land) → SLIDE JUMP (W) → BUTT SLAM (S)
// ============================================
// Entered when SHIFT is still held as a dodge ends. Tiny grounded flash before
// W is live; jump range scales with slide time + exit speed. Steering bleeds
// speed (and thus jump range). S in the air reuses the flap body-slam dive.
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
const SLIDE_JUMP_LIFTOFF_IMPULSE = 13.2;   // Electric pop — clears a standing body (~peak 160px)
const SLIDE_JUMP_GRAVITY = 0.52;           // Snappier than flap float; still hangs enough to read
const SLIDE_JUMP_H_BASE = 4.4;             // Min horizontal carry (px/tick) — past opponent by default
const SLIDE_JUMP_H_BONUS = 2.2;            // Extra H from long slide (added at full scale)
const SLIDE_JUMP_H_SPEED_SCALE = 0.55;     // Extra H from |movementVelocity| at takeoff
const SLIDE_JUMP_SCALE_MS = 450;           // Slide duration after min to reach full H bonus
const SLIDE_JUMP_AIR_STEER = 1.2;          // Weak air nudge (also bleeds H slightly)
const SLIDE_JUMP_AIR_STEER_BLEED = 0.97;   // Per-tick H decay when air-steering
const SLIDE_JUMP_LANDING_RECOVERY_MS = 90; // Barely punishable — strict slap-timing window

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
const DODGE_BASE_SPEED = 2.67; // Baseline px-rate unit — travel distance is FIXED (see DODGE_TRAVEL_DISTANCE)
// Fixed hop distance at rate 1: BASE_SPEED * speedFactor * ACTIVE_MS ≈ 104px.
// Speed buffs must NOT extend this — they only finish the hop sooner (capped).
const DODGE_TRAVEL_DISTANCE = DODGE_BASE_SPEED * speedFactor * DODGE_ACTIVE_MS;
const DODGE_SPEED_MULT_CAP = 1.5; // Max Happy Feet / draft rate on dodge — duration shrink only
const DODGE_CANCEL_ACTION_LOCK = 80; // Brief lock after S-cancel to prevent instant pivoting

// ============================================
// Grab Mechanics
// ============================================

// Grab walking tuning
const GRAB_WALK_SPEED_MULTIPLIER = 0.8; // Slightly slower than normal strafing
const GRAB_WALK_ACCEL_MULTIPLIER = 0.7; // Slightly lower acceleration than normal strafing

// Grab startup tuning — lunge forward during startup for better grab range
const GRAB_STARTUP_DURATION_MS = GRAB_STARTUP_MS; // Uses frame data constant
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
// Stamina cost only (no posture hit). Doesn't reposition meaningfully (boundary-clamped),
// so edge stress is preserved. Brief grab immunity prevents instant re-clinch.
const GRAB_BREAK_STAMINA_COST = 30; // Heavy commitment — break is a real escape, not a free reset
const GRAB_BREAK_FORCED_DISTANCE = 140; // Total separation distance (split between breaker + opponent — each moves half this)
const GRAB_BREAK_TWEEN_DURATION = 350; // Knockback slide duration
const GRAB_BREAK_RESIDUAL_VEL = 0; // No residual sliding — players stop cleanly when knockback ends
const GRAB_BREAK_INPUT_LOCK_MS = 350; // Breaker is locked during knockback tween — vulnerable window
const GRAB_BREAK_ACTION_LOCK_MS = 350; // Action lock matches input lock
const GRAB_BREAK_GRAB_IMMUNITY_MS = 400; // Re-grab protection on the breaker after the tween ends
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
// PHASE 3.2 — "caught the henka": a grab that connects on a victim still in
// sidestep-recovery or rope-jump landing floors the Phase A approach speed to
// this, so a *read-timed* grab bursts them back cornerward hard even from a
// standing (zero-approach) catch. Reads should pay out in position.
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
const PERFECT_PARRY_WINDOW = 40; // PERFECT tier window (ms), measured as (hitTime − rawParryStartTime, lag-comp). Tight inner band of AP_ACTIVE_MS — regular owns the generous read; perfect is the rare dead-on grade. Also gates the snowball perfect-reflect.
const PERFECT_PARRY_SUCCESS_DURATION = 850; // Compressed parry — fast enough to keep pace, long enough for visual read
const PERFECT_PARRY_ATTACKER_STUN_DURATION = 700; // Stun — comfortable window for slap/grab follow-up
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
//     If the attacker's balance is already inside the KILL band AND the parry
//     is PERFECT, it becomes the lethal slap-down (pull cinematic). Regular
//     parries never finish the round.
//   • HOLD → GUARD (the block floor): you survive slaps/palms as chip + a little
//     ground lost + stamina bleed — but no reward. Rooted; does NOT stop grabs or
//     charged (grab is the standard FG answer to a held block). Bleed to 0 →
//     guard-crush → gassed. A MISTIMED tap while holding just becomes a guard
//     (no cancel recovery), so you can attempt parries fearlessly into block.
//     After a LANDED parry, a continued hold becomes GUARD — one timed PARRY per
//     physical press; holding never grants a second parry. Release + re-press
//     for the next timed read (flurry = tap-every-slap).
//   • RELEASE / empty expiry during a live window → WHIFF. Rooted recovery
//     (AP_WHIFF_RECOVERY_MS) so empty taps are punishable. Re-press may NOT
//     cut the jail short — only a LANDED parry skips this (success path never
//     enters whiff). Holding through the window into GUARD is NOT a whiff.
//
// RPS: parry/guard both LOSE to GRAB (counter-grab is the anti-defense read) and
// to CHARGED (blows through). Every parry costs stamina; turtling gasses you.
// (Reuses the isRawParrying / isRawParrySuccess flags + the spacebar plumbing.)
const AP_ACTIVE_MS = 180;            // PARRY WINDOW: a tap deflects if the strike connects within this of the (lag-comp) press. Slightly longer than the old 140 so a correct prediction that isn't super-early still covers connect; Perfect stays PERFECT_PARRY_WINDOW.
// Early-active slap grace: for the first N ms of slap ACTIVE frames, open hits
// (defender not in Space stance) are deferred, while live PARRY / GUARD still
// resolve immediately. Gives a slightly-late tap time to arm during early active
// without making the jab fully reactable on startup. Slap-only.
//
// Open hits that were already in range during this window set slapOpenHitPending
// and confirm once grace ends (see collisionSystem) — otherwise ice drift across
// the deferred ticks can push past tip connect and ghost-whiff a point-blank
// slap. Slack is a few ticks of coast, not sidestep distance.
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
// Non-kill yank distance — ~20% shorter than a clinch pull (CLINCH_PULL_DISTANCE 280).
// Kill still uses CLINCH_KILL_PULL_DISTANCE for the finisher read.
const MATADOR_PULL_DISTANCE = 224;
const AP_STAMINA_COST = 3;           // Charged per parry tap — cheap (reward using it), but re-tapping a long flurry still drains you.
// KILL gate: PERFECT parry only, and the attacker's balance must be DEEPLY
// broken (< this). Regular parries never KO. Set well UNDER the clinch kill
// threshold (15) and the posture break (35) so a parry kill is a hard-earned
// finish, not "slap a bit + fish it".
const AP_KILL_THRESHOLD = 8; // legacy (unused) — kills use AP_PERFECT_KILL_THRESHOLD only
const AP_PERFECT_KILL_THRESHOLD = 12;
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
// Regular AP freeze — confirm/steal tier. Long enough that SUCCESS Frame 2
// (deflect) is the pose players read during the clash; short enough flurries breathe.
const AP_HITSTOP_MS = 110;
// Perfect AP — skill/max tier. Rare dead-on read gets the longest non-kill freeze
// so the match briefly bows to the read (above palm/flap burst weight).
const AP_PERFECT_HITSTOP_MS = 210;
const AP_KILL_HITSTOP_MS = 550;      // Presentation tier — matches CINEMATIC_KILL_HITSTOP_MS
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
const GUARD_HITSTOP_MS = 40;          // Acknowledgment tier — light tink; lesser than every offensive freeze
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
const FLAP_CHARGES = 2;                  // Air flaps granted on FLAP-armed slide-jump takeoff
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
// Hit Recovery — heavy sumo dump when hit airborne
// ============================================
// Commitment model: passive flight is immune. Air hits are mostly dive-stuffs
// / rare elevated connects. Stronger H KB + faster dump; blend prior air travel
// into the shove so it isn't a straight vertical teleport.
const HIT_FALL_GRAVITY = 1.18;            // Accelerated plummet (jump 0.52 / flap 0.44)
const HIT_FALL_DUMP_LIGHT = 4.2;          // Slap / low kick — immediate down dump
const HIT_FALL_DUMP_MEDIUM = 5.6;         // Palm / snowball / pumo
const HIT_FALL_DUMP_HEAVY = 7.2;          // Charged tier
const HIT_FALL_CARRY_DOWN_SCALE = 0.85;   // Keep downward dive carry
const HIT_FALL_COUNTER_DUMP_MULT = 1.18;  // Counter / gored — slightly harder dump
const HIT_FALL_MAX_FALL_SPEED = 20;       // Terminal down speed while hit-falling
const AIR_HIT_KB_MULT = 1.4;              // Air connects shove harder than grounded
const AIR_HIT_CARRY_X_SCALE = 0.5;        // Fraction of prior air H folded into KB
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
// Clinch Flow P2 — Light vs Committed Drive.
// First LIGHT window of holding toward is poking pressure (slower, cancelable,
// not fully throw-vulnerable). After that the drive commits: stronger shove,
// snowball vs neutral, brief plant-cancel transition, jolt-into-it → Open.
const CLINCH_LIGHT_DRIVE_MS = 300;              // Toward-hold before drive commits
const CLINCH_LIGHT_DRIVE_SPEED_MULT = 0.7;      // Light drive shove speed vs base
const CLINCH_DRIVE_PLANT_CANCEL_MS = 90;         // Committed→Plant transition (not instant)
// Momentum ramp — unanswered COMMITTED push vs neutral snowballs.
const CLINCH_PUSH_RAMP_DELAY_MS = 0;            // Ramp builds as soon as drive is committed
const CLINCH_PUSH_RAMP_RISE_MS = 900;           // Time from commit to full multiplier
const CLINCH_PUSH_RAMP_MAX_MULT = 1.6;          // Speed multiplier at full ramp
const CLINCH_PUSH_LOSS_OPEN_T = 0.92;           // Push-war intensity to start Open arm
const CLINCH_PUSH_LOSS_OPEN_MS = 450;           // Sustained loss before loser goes Open
const CLINCH_PUSH_LOSS_OPEN_DURATION_MS = 280;  // Brief Open after major shove loss
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
// Edge finish while driving someone into the boundary:
//   instant — gassed / empty tank, OR Open (no grace timer)
//   timed   — continuous pin hold (grace for Break / throw / bait)
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

// Clinch grab attachment — tight when on the belt (M2), looser on body holds
// so full-length flippers have room instead of spearing through each other.
const CLINCH_ATTACHED_DISTANCE = Math.round(75 * 0.96); // ~72px — both on belt
const CLINCH_MIXED_HOLD_DISTANCE = Math.round(88 * 0.96); // ~85px — one on belt, one body
const CLINCH_BODY_HOLD_DISTANCE = Math.round(108 * 0.96); // ~104px — both body-holding
const CLINCH_ATTACH_LERP_PER_SEC = 14; // Snap-in speed when someone presses/releases M2

// Clinch Flow P1 — throw/pull techniques (both are throws; pull = side-switch yank).
// Clean techniques always land unless held Plant resists (Deep Grip breaks Plant).
// Balance only gates kill vs non-kill. Visible Open/recovery replaces hidden CDs.
const CLINCH_THROW_ANIMATION_MS = 220;           // Startup → impact (Plant checked at end)
const CLINCH_THROW_COOLDOWN_MS = 0;              // Retired — Open / recovery govern retries
const CLINCH_THROW_STAMINA_COST = 10;            // Stamina cost for throw/pull attempt (uniform)
const CLINCH_THROW_CLASH_WINDOW_MS = 60;         // True simultaneous technique window
const CLINCH_THROW_CHORD_WINDOW_MS = 220;        // Generous M2 + direction TAP chord
const CLINCH_THROW_REQUEST_PUSH_CAP_MULT = 0.25; // Soft latch while a request is pending
// Initiation drains at COMMIT from defender stance. If Plant resists at impact,
// excess over plant-tier is refunded — a successful brace keeps plant-tier posture
// pressure (incl. edge bonus), not the push/neutral tax from a late scramble.
const CLINCH_THROW_BALANCE_DRAIN_VS_PUSH = 20;   // Initiation drain vs pushing
const CLINCH_THROW_BALANCE_DRAIN_VS_PLANT = 5;   // Initiation drain vs planting
const CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL = 10; // Initiation drain vs neutral
const CLINCH_THROW_FAIL_BALANCE_DRAIN = 0;       // Resisted Plant: no defender chip (thrower pays)
const CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN = 12; // Attacker balance cost on resisted throw
const CLINCH_THROW_FAIL_STAMINA_COST = 5;        // Extra stamina on resisted throw

// Clinch pull initiation drain (same matrix as throw; slightly cheaper reposition)
const CLINCH_PULL_BALANCE_DRAIN_VS_PUSH = 14;
const CLINCH_PULL_BALANCE_DRAIN_VS_PLANT = 4;
const CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL = 7;
const CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN = 6;

// OPEN — punishable vulnerability (stars). Resisted techniques / mutual tumbles.
const CLINCH_THROW_FAIL_STAGGER_MS = 320;        // Resisted-technique Open duration
const CLINCH_PERFECT_BRACE_OPEN_MS = 400;        // Attacker Open after Perfect Brace
const CLINCH_PERFECT_BRACE_WINDOW_MS = 100;      // Final portion of startup (press must land here)
const CLINCH_PERFECT_BRACE_FLASH_MS = 220;       // Defender Perfect Brace visual flash
// After authoritative Plant is active, a short latch keeps Throw/Pull brace armed
// if the defender releases early (tap instinct). Does NOT arm during Drive→Plant
// cancel — only refreshes while isActivelyPlanting.
const CLINCH_BRACE_LATCH_MS = 150;
const CLINCH_OPEN_TUMBLE_MS = 350;               // Mutual-tumble Open after separation
const CLINCH_OPEN_JOLT_INTO_DRIVE_MS = 300;      // Jolter Open after jolt into committed Drive
const CLINCH_TUMBLE_STAMINA_COST = 5;            // Both pay on mutual tumble
const CLINCH_TUMBLE_BALANCE_DRAIN = 4;           // Both lose a little Balance on tumble

// Counter-grab ARM CLAMP — STRONG ADVANTAGE, not a free / untechable throw.
// Catching raw parry with Grab grants a highly favorable punish window:
//   • Immediate Balance damage (COUNTER_GRAB_BALANCE_DEBUFF)
//   • Stronger Phase A opening burst (ARM_CLAMP_BURST_*)
//   • Victim offense locked: no push / throw / pull / jolt / break
// Plant brace REMAINS available — a precise Plant can still deny the technique.
// Do not describe the convert throw as "free" or "untechable" in comments,
// animation copy, or teaching: the reward is advantage, not an automatic KO.
// Clamp clears on: burst end (no pending/active throw), boundary contact, or
// once the grabber's filed technique is no longer pending/active.
const COUNTER_GRAB_BALANCE_DEBUFF = 10;          // Balance hit on counter-grab connect
const ARM_CLAMP_BURST_MULT = 2.1;                // × initial burst vs regular connect
const ARM_CLAMP_BURST_DECAY_RATE = 1.9;           // Slower than regular 6.1 — real carry
const ARM_CLAMP_BURST_END_VELOCITY = 0.55;        // End while still shoving (not a crawl)
const ARM_CLAMP_MAX_BURST_MS = 950;              // Hard cap on clamp carry

// DEEP GRIP — earned advantage. Breaks held Plant on throw/pull; consumed on
// technique commit. Still boosts push. Earned via jolt-vs-plant / push win.
const DEEP_GRIP_THROW_THRESHOLD_BONUS = 0;       // Retired — no land threshold
const DEEP_GRIP_PUSH_MULT = 1.1;                 // +10% clinch push force while held
const DEEP_GRIP_PUSH_WIN_MS = 1000;              // Continuous unanswered push time to earn it

// Mutual technique collision (no Deep Grip winner) → tumble apart, end clinch
const CLINCH_TECH_STAMINA_COST = 8;              // Legacy export; tumble uses CLINCH_TUMBLE_*
const CLINCH_THROW_LAND_THRESHOLD = 0;           // Retired — every undefended technique lands
const CLINCH_THROW_KILL_THRESHOLD = 15;          // Balance below which = KILL THROW (round over)
// Balance-scaled non-kill throw distance (full composure → short toss; near-kill → far)
const CLINCH_THROW_DISTANCE_MIN = 140;           // Clean throw at full Balance
const CLINCH_THROW_DISTANCE_MAX = 260;           // Clean throw near lethal Balance
const CLINCH_THROW_DISTANCE = 260;               // Legacy alias (= max); prefer scaled helper
const CLINCH_THROW_ARC_HEIGHT = 100;             // Low hill arc (peak ~80px) — not a big sky launch
const CLINCH_THROW_DURATION_MS = 550;            // Longer travel time for the farther distance
const CLINCH_CLASH_ANIMATION_MS = 280;           // Brief flash before mutual tumble separates

// Clinch pull system (Mouse2 + away TAP during clinch)
const CLINCH_PULL_ANIMATION_MS = 250;            // Startup → impact
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
const CLINCH_KILL_THROW_DURATION_MS = 1700;      // Overall snappy air time — keep the speed they liked
// Kill throws intentionally skip start/land hitstop (0) — the arc + camera sell
// the finisher; an extra freeze read as a hitch. Constant kept for docs/exports.
const CLINCH_KILL_THROW_HITSTOP_MS = 0;
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

// ============================================
// Clinch Jolt System (Mouse1 during clinch)
// Heavy committal chest-shove — the anti-plant read in the push/plant triangle.
// Correct read (vs plant) = dramatic payoff. Wrong read (vs push) = severe punishment.
// Cooldown ensures each jolt is a real decision, not spam.
// ============================================
const CLINCH_JOLT_ANIMATION_MS = 240;           // Telegraphed startup — impact resolves AFTER this
const CLINCH_JOLT_RECOVERY_MS = 420;            // Visible recovery — punishable (no hidden CD)
const CLINCH_JOLT_COOLDOWN_MS = 0;              // Retired — recovery alone anti-spams
const CLINCH_JOLT_STAMINA_COST = 10;            // Soft cost — never blocks; floors at 0 (gassed still jolts)
const CLINCH_JOLT_BALANCE_VS_PLANT = 15;        // Heavy balance damage — correct read rewarded
const CLINCH_JOLT_BALANCE_VS_NEUTRAL = 6;       // Modest — neutral isn't the intended target
const CLINCH_JOLT_BALANCE_VS_PUSH = 0;          // No damage — you lunged into their momentum
const CLINCH_JOLT_SELF_BALANCE_VS_PUSH = 8;     // SELF-DAMAGE on wrong read — jolting a pusher hurts you
const CLINCH_JOLT_PUSH_VS_PLANT = 60;           // 10% of arena — the opponent genuinely feels this
const CLINCH_JOLT_PUSH_VS_NEUTRAL = 15;         // Modest positional gain
const CLINCH_JOLT_PUSH_VS_PUSH = 0;             // No push — you walked into their force
const CLINCH_JOLT_MUTUAL_BALANCE = 6;           // Balance damage on mutual jolt (both)
const CLINCH_JOLT_CLASH_WINDOW_MS = 120;        // Mutual if both startups begin within this window
const CLINCH_JOLT_HITSTOP_MS = 140;             // Medium-heavy — clean clinch hit landed
const CLINCH_JOLT_MUTUAL_HITSTOP_MS = 110;      // Confirm/clash tier — contested, not a clean heavy
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
// HITSTOP TUNING — Fighting-game impact ladder
// ============================================
// Freeze length = event rarity × impact class. Sim clock pauses for BOTH players,
// so frame advantage is unchanged; hitstop is wall-clock recognition + weight only.
// Sell frequent lights with shake/squash/SFX; reserve long freezes for heavy/rare.
//
// Ladder (ms @ ~60fps frames):
//   0 Acknowledgment  Guard 40          (~2f)  tink
//   1 Latch           Grab 55           (~3f)  "got you"
//   2 Light strike    Slap 70           (~4f)  primary flurry — must breathe
//   3 Confirm/steal   Throw/AP/Matador 100–110 (~6–7f)
//   4 Medium-heavy    Jolt/Palm/Flap 140–160   (~8–10f)
//   5 Skill/max       Perfect / full charge 210 (~13f)
//   6 Presentation    Cinematic / AP kill 550  (~33f)
// Charged scales 100→210 so a weak charge NEVER freezes lighter than a slap.
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
//   - READ kill (counter / punish / gassed / GORED): lower bar — the read earns it.
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
// Gassed taxes posture recovery but does not freeze it — stamina exhaustion
// shouldn't hard-lock an unrelated resource. Clinch still fully banks pressure.
const BALANCE_GASSED_REGEN_MULT = 0.5;
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
const SLAP_TOTAL_MS_ENHANCED = 235;    // Normal cycle −25ms recovery tail (startup/active untouched)
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
// charge duration, spacing bonus, and counter-hit window all collapse to
// today's exact constants — byte-identical (invariants #2 & #4).
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

// 4.2 Slap pocket vs poke (tip). Absolute px bands (95–125) were always-on:
// resting pushbox (~110 @ 0.85 size) already sat above the old "tip" gate, and
// ACTIVE extension-sep parks every connect near tip-meets-body before measurement.
// Tip quality is now RELATIVE to the real hittable window:
//   pocketEnd = pushbox floor + slack  → 1.0× posture (pressure / mash)
//   connectDist (art tip meets body) → SLAP_TIP_POSTURE_MULT (true poke)
// Distance is sampled BEFORE enforceStrikeExtensionSeparation mutates spacing.
// Feel package (hitstop / crack / spark / HUD) stays additive — pocket slaps keep
// today's satisfying baseline; only outer-band pokes get the tip juice.
// Drift stays at 1.0: tip KB re-opened the soft-whiff problem.
const SLAP_TIP_POCKET_SLACK_PX = 3; // still "pocket" this far past pushbox
const SLAP_TIP_POSTURE_MULT = 1.3;  // SAFE 1.2 — full poke posture drain scale
const SLAP_TIP_HITSTOP_BONUS_MS = 20; // spacing reward at full poke (~1f) — not a new tier
// Tip feel / HUD tell — outer half of the pocket→connect band.
const SLAP_TIP_FEEL_THRESHOLD = 0.5;
const SLAP_TIP_DRIFT_MULT = 1.0;
// Legacy aliases (old absolute band). Kept exported so stale imports don't crash;
// live tip math no longer uses them.
const SLAP_TIP_DISTANCE_MIN = 95;
const SLAP_TIP_DISTANCE_MAX = 125;
const SLAP_TIP_DISTANCE = SLAP_TIP_DISTANCE_MAX;

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

// 4.5 Risk dials — key-held slap follow-through REMOVED.
// Slap ground transfer is scaled only by ice momentum inheritance (Phase 1:
// slapEntryAligned → slapMomentumMult). Mouse1 is the commit; held A/D during
// the slap cycle is movement intent, not a second power dial.
//
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
  GRAB_SLAP_CATCH_RANGE,
  GRAB_THROW_CATCH_START_MS,
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
  SLIDE_JUMP_H_BASE,
  SLIDE_JUMP_H_BONUS,
  SLIDE_JUMP_H_SPEED_SCALE,
  SLIDE_JUMP_SCALE_MS,
  SLIDE_JUMP_AIR_STEER,
  SLIDE_JUMP_AIR_STEER_BLEED,
  SLIDE_JUMP_LANDING_RECOVERY_MS,
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
  AIR_STRIKE_HURT_HEIGHT,
  FLAP_BODYSLAM_KB_VELOCITY,

  // Hit recovery
  HIT_FALL_GRAVITY,
  HIT_FALL_DUMP_LIGHT,
  HIT_FALL_DUMP_MEDIUM,
  HIT_FALL_DUMP_HEAVY,
  HIT_FALL_CARRY_DOWN_SCALE,
  HIT_FALL_COUNTER_DUMP_MULT,
  HIT_FALL_MAX_FALL_SPEED,
  AIR_HIT_KB_MULT,
  AIR_HIT_CARRY_X_SCALE,
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
  CLINCH_GASSED_PUSH_MULT,
  CLINCH_PUSH_STAMINA_FLOOR,
  GASSED_RECOVERY_STAMINA_IN_CLINCH,
  CLINCH_THROW_FAIL_STAGGER_MS,
  COUNTER_GRAB_BALANCE_DEBUFF,
  ARM_CLAMP_BURST_MULT,
  ARM_CLAMP_BURST_DECAY_RATE,
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
  CLINCH_MIXED_HOLD_DISTANCE,
  CLINCH_BODY_HOLD_DISTANCE,
  CLINCH_ATTACH_LERP_PER_SEC,

  // Clinch throw/pull
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_COOLDOWN_MS,
  CLINCH_THROW_STAMINA_COST,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_CHORD_WINDOW_MS,
  CLINCH_THROW_REQUEST_PUSH_CAP_MULT,
  CLINCH_LIGHT_DRIVE_MS,
  CLINCH_LIGHT_DRIVE_SPEED_MULT,
  CLINCH_DRIVE_PLANT_CANCEL_MS,
  CLINCH_PUSH_LOSS_OPEN_T,
  CLINCH_PUSH_LOSS_OPEN_MS,
  CLINCH_PUSH_LOSS_OPEN_DURATION_MS,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_PERFECT_BRACE_WINDOW_MS,
  CLINCH_PERFECT_BRACE_FLASH_MS,
  CLINCH_BRACE_LATCH_MS,
  CLINCH_OPEN_TUMBLE_MS,
  CLINCH_OPEN_JOLT_INTO_DRIVE_MS,
  CLINCH_TUMBLE_STAMINA_COST,
  CLINCH_TUMBLE_BALANCE_DRAIN,
  CLINCH_THROW_DISTANCE_MIN,
  CLINCH_THROW_DISTANCE_MAX,
  CLINCH_PULL_DISTANCE_MIN,
  CLINCH_PULL_DISTANCE_MAX,
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

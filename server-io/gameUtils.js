const {
  SCREEN_SHAKE_MIN_INTERVAL,
  DOHYO_EDGE_PANIC_ZONE,
  ROPE_KICKOFF_ZONE,
  SLIDE_BRAKE_FRICTION, SLIDE_FRICTION,
  ICE_EDGE_BRAKE_BONUS, ICE_BRAKE_FRICTION,
  ICE_MOVING_FRICTION, ICE_COAST_FRICTION, ICE_EDGE_SLIDE_PENALTY,
  KNOCKBACK_IMMUNITY_DURATION,
  HITSTOP_CHARGED_MIN_MS, HITSTOP_CHARGED_MAX_MS,
  CHARGE_FULL_POWER_MS,
  DODGE_RECOVERY_MS,
  DODGE_STARTUP_MS,
  DODGE_DURATION,
  DODGE_STAMINA_COST,
  DODGE_IFRAME_MS,
  DODGE_TRAVEL_DISTANCE,
  GROUND_LEVEL,
  SIDESTEP_STARTUP_MS,
  SIDESTEP_RECOVERY_MS,
  SIDESTEP_STAMINA_COST,
  HITBOX_DISTANCE_VALUE,
  MAX_PARRY_BACKDATE_MS,
  INPUT_BACKDATE_MIN_MS,
  INPUT_BACKDATE_RTT_SLACK_MS,
  INPUT_CLOCK_OFFSET_MAX_DELTA_MS,
  INPUT_PRESS_MONOTONIC_SLACK_MS,
  FLAP_CHARGES,
  FLAP_STAMINA_COST,
  HIT_FALL_MAX_FALL_SPEED,
  AIR_HIT_KB_BONUS_PX,
  TICK_RATE,
  speedFactor,
  GASSED_DURATION_MS,
  POWER_UP_TYPES,
  MAX_MOVE_SPEED_MULT,
  MOMENTUM_ENTRY_CLAMP,
  MOMENTUM_WINDOW_MS,
  AP_ACTIVE_MS,
  PERFECT_PARRY_WINDOW,
  AP_WHIFF_RECOVERY_MS,
  AP_COOLDOWN_MS,
  MATADOR_ACTIVE_MS,
  MATADOR_WHIFF_RECOVERY_MS,
  MATADOR_SUCCESS_LOCK_MS,
  AP_FLURRY_STAGGER_BEGIN_MS,
  AP_FLURRY_SLACK_MS,
  AP_STAGGER_SLAP_MS,
  SLAP_STARTUP_MS,
  ICE_SLIDE_BRAKE_ARM_MS,
  ICE_SLIDE_REVERSE_SPEED_MAX,
  ICE_SLIDE_REVERSE_BURST,
  ICE_SLIDE_REVERSE_HOP_MS,
  ICE_SLIDE_REVERSE_COOLDOWN_MS,
  ICE_SLIDE_MAX_SPEED,
  GRAB_STATES,
  GRAB_STARTUP_DURATION_MS,
  SLIDE_JUMP_DIVE_MIN_AIR_MS,
  SLIDE_JUMP_DIVE_MIN_HEIGHT,
  SLIDE_JUMP_DIVE_BUFFER_MS,
  SLIDE_JUMP_H_MIN,
  SLIDE_JUMP_H_CARRY,
  SLIDE_JUMP_H_MAX_MULT,
  SLIDE_JUMP_H_STACK_START,
  SLIDE_JUMP_H_STACK_FULL_MULT,
  SLIDE_JUMP_H_STACK_HEADROOM,
} = require("./constants");

// Velocity-at-press telemetry sink (MASTERY Phase 0). appendVerbInit is a
// no-op unless AUDIT_LOG is enabled, so this require adds no hot-path cost.
const { appendVerbInit, AUDIT_ENABLED } = require("./inputAuditLog");

const { MASTERY_P1_MOMENTUM } = require("./masteryFlags");
const { handoffVelocity, pxToKbVelocity } = require("./momentumTransfer");
const { clearAirHitOverlapEject } = require("./airHitOverlapEject");
// Constants-only module — safe to require here without a cycle.
const { stampGrabVariant } = require("./commandGrabInput");
const { getGrabLungeImpulse } = require("./combatHelpers");
const {
  OFFENSIVE_AERIAL_OUTCOME,
  OFFENSIVE_AERIAL_CLEANUP_STAGE,
  isTerminalContactOutcome,
  resetOffensiveAerialActivation,
  finalizeOffensiveAerialActivation,
  canCleanupOffensiveAerialInstance,
  markOffensiveAerialCleanupStage,
} = require("./offensiveAerialOutcome");
const {
  isParriedRecoilActive,
  completeOffensiveAerialReaction,
  resetOffensiveAerialReaction,
  beginOffensiveAerialReaction,
  OFFENSIVE_AERIAL_REACTION,
} = require("./offensiveAerialReaction");
const {
  isOffensiveAerialReactionV2Enabled,
} = require("./offensiveAerialFlags");
const {
  forceClearOffensiveAerialFacingLock,
  releaseOffensiveAerialFacingLock,
  FACING_RELEASE,
} = require("./offensiveAerialFacing");
const {
  clearOffensiveAerialPresentation,
  syncOffensiveAerialPresentation,
} = require("./offensiveAerialPresentation");
const {
  isActionFacingOwnershipV2Enabled,
  acquireActionFacingLock,
  releaseActionFacingLock,
  forceClearActionFacingLock,
  getActionFacingLock,
  mintActionFacingInstanceId,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  ACTION_FACING_RELEASE,
} = require("./actionFacingOwnership");
const {
  clearCombatContactState,
} = require("./combatContactResolution");
const {
  isActionLifecycleOwnershipV2Enabled,
} = require("./actionLifecycleFlags");
const {
  LIFECYCLE_TIMEOUT_NAMES,
  forceClearLifecycleOwners,
} = require("./actionLifecycleOwnership");

// ============================================
// EFFECTIVE MOVEMENT SPEED (single source of truth)
// ============================================
//
// Every locomotion speed buff funnels through here so the server, the client
// movement predictor, and (implicitly) the camera all agree on one number:
//   - PvP Happy Feet         → activePowerUp === SPEED (powerUpMultiplier, 1.4)
//   - BASHO career MOVE SPEED → statMods.moveSpeed (0.91 .. 1.18)
//   - BASHO stacked Happy Feet → bashoDraft.speedMult (diminishing-returns curve)
// The product is clamped to MAX_MOVE_SPEED_MULT so displacement stays inside
// what the client can render/interpolate — this is what kills the "camera runs
// ahead of the sprite" desync. Non-BASHO players have no statMods/bashoDraft
// (undefined → 1) and PvP's 1.4 sits under the cap, so PvP/VS CPU are unchanged.
// The result is stored on `player.effectiveMoveSpeedMult` each tick and sent in
// the delta snapshot; the predictor consumes it verbatim (no formula to drift).
function getEffectiveMoveSpeedMult(player) {
  if (!player) return 1;
  let mult = 1;
  if (
    player.activePowerUp === POWER_UP_TYPES.SPEED &&
    typeof player.powerUpMultiplier === "number"
  ) {
    mult *= player.powerUpMultiplier;
  }
  mult *= player.bashoDraft?.speedMult ?? 1;
  mult *= player.statMods?.moveSpeed ?? 1;
  if (mult > MAX_MOVE_SPEED_MULT) mult = MAX_MOVE_SPEED_MULT;
  return mult;
}

// ============================================
// THICK BLUBBER hit absorption (shared by collision + projectile paths)
// ============================================
//
// PvP / VS CPU: the single-slot Thick Blubber power-up absorbs ONE hit
// (activePowerUp === THICK_BLUBBER, gated by hitAbsorptionUsed).
// BASHO (Phase 7): the draft stacks Thick Blubber into N charges tracked on
// `bashoBlubberRemaining`. These helpers unify both so the ~5 absorption sites
// stay identical; non-BASHO players have no bashoBlubberRemaining (undefined →
// 0), so their behavior is exactly as before.

function hasHitAbsorption(player) {
  if (!player) return false;
  return (
    (player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
      !player.hitAbsorptionUsed) ||
    // BASHO "Thick Blubber" grappling loadout: one absorb per grab attempt
    // (hitAbsorptionUsed is refreshed when a grab starts). Grabs-only is
    // enforced at the call sites, same as the power-up.
    (player.loadout?.thickBlubberGrabs === true && !player.hitAbsorptionUsed) ||
    (player.bashoBlubberRemaining ?? 0) > 0
  );
}

function consumeHitAbsorption(player) {
  if (!player) return;
  if ((player.bashoBlubberRemaining ?? 0) > 0) {
    player.bashoBlubberRemaining -= 1; // BASHO stacked charge
  } else {
    player.hitAbsorptionUsed = true; // single-slot power-up
  }
}

// ============================================
// MONOTONIC CLOCK HELPER
// ============================================
// Returns a monotonically-increasing millisecond timestamp via process.hrtime.bigint
// (which Node guarantees is unaffected by NTP wall-clock corrections).
//
// USE THIS FOR:  internal time deltas where any backward jump would corrupt
//                gameplay state — e.g. charge accumulators, action cooldowns,
//                hitstop windows, attack cancel timers.
//
// DO NOT USE FOR: timestamps emitted to the client as "wall clock" values
//                 (e.g. event payload `timestamp: Date.now()`). Clients use
//                 those for cross-process display ordering and need real time.
//
// MIGRATION NOTE: The clock migration is complete. The game loop scheduler
// uses performance.now(); hitstop windows use gameNow(); and ALL gameplay
// timestamps/deadlines (attack lifecycle, locks, cooldowns, grab/clinch,
// dodge/parry, throws, tweens) live on the per-room pausable sim clock
// (room.simTime via simNow/simNowForPlayer below). The only remaining
// Date.now() uses are intentionally wall-clock: emit payload timestamps/IDs,
// input audit logs, sim-clock seeding, and the screen-shake emit throttle.
const gameNow = () => Number(process.hrtime.bigint() / 1000000n);

// ============================================================
// MASTERY PHASE 1 — MOMENTUM INHERITANCE HELPER
// ============================================================
// Signed entry velocity aligned to a direction (+ = moving THAT way). `dir` is
// ±1 (e.g. a slap's slideDirection, or a knockback direction negated to mean
// "moving into the hit"). Clamped to the sane powerslide-capped sim bounds so a
// runaway velocity can never blow up a blended distance. Pure/stateless — the
// same helper backs slap slide inheritance, the on-hit ground transfer, and the
// victim-side into/brace scaling. Callers gate on MASTERY_P1_MOMENTUM; with the
// flag off this is never called, so the sim is unchanged.
function alignedEntryVelocity(v, dir) {
  const a = (v || 0) * dir;
  return Math.max(-MOMENTUM_ENTRY_CLAMP, Math.min(a, MOMENTUM_ENTRY_CLAMP));
}

// ── MOMENTUM CARRY WINDOW ────────────────────────────────────────────────
// Stamp earned momentum from a dodge landing (or active power slide) so the
// next slap inherits it independent of press tick, including buffered presses.
// Dodge zeroes movementVelocity during travel and only restores a decaying
// slide on landing. Call sites gated on MASTERY_P1_MOMENTUM.
function stampMomentumWindow(player, signedVel, nowSim) {
  player.momentumWindowVel = signedVel || 0;
  player.momentumWindowUntil = nowSim + MOMENTUM_WINDOW_MS;
}

// Returns the SIGNED velocity a momentum-inheriting verb should treat as its
// entry: whichever of the live velocity or the still-valid stamped carry has
// the larger magnitude (so mid-slide presses use the live speed, and just-after
// presses use the held carry the decaying slide dropped below). Consumes the
// window so a single dodge/slide powers exactly ONE entry — an active slide
// re-stamps every tick, so consecutive in-slide slaps still read the live speed.
function takeInheritedVelocity(player, liveVel, nowSim) {
  const live = liveVel || 0;
  if (nowSim < (player.momentumWindowUntil || 0)) {
    const carry = player.momentumWindowVel || 0;
    player.momentumWindowUntil = 0;
    player.momentumWindowVel = 0;
    return Math.abs(carry) > Math.abs(live) ? carry : live;
  }
  return live;
}

// Game constants
const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 935;

const DEFAULT_PLAYER_SIZE_MULTIPLIER = 0.85; // 15% smaller default size

// Dohyo (ring) boundaries - players fall when outside these (horizontal only)
const DOHYO_LEFT_BOUNDARY = 250;
const DOHYO_RIGHT_BOUNDARY =1030;

// Dohyo fall physics
const DOHYO_FALL_DEPTH = 37; // Scaled for camera zoom (was 50)

// ============================================================
// PAUSABLE SIMULATION CLOCK
// ============================================================
// Each room carries its own `simTime` (ms). The game loop advances it by the
// fixed tick delta every tick — EXCEPT while the room is in hitstop. That one
// rule makes every sim-clock timer and deadline pause during hitstop for free:
// no per-timer compensation, no manual extension on hit.
//
// simTime is seeded from Date.now() at first use so its magnitude is familiar
// in logs, but after seeding it only ever advances by fixed deltas — making it
// immune to NTP wall-clock corrections (unlike Date.now()).
//
// The resolver maps playerId -> room (injected from index.js, which owns the
// O(1) lookup maps) so any file can ask "what time is it for this player's
// sim?" without threading `room` through every call signature.
let simRoomResolver = null;

function setSimRoomResolver(resolver) {
  simRoomResolver = resolver;
}

function simNow(room) {
  if (!room) return Date.now();
  if (room.simTime == null) room.simTime = Date.now();
  return room.simTime;
}

function simNowForPlayer(player) {
  const room =
    player && simRoomResolver ? simRoomResolver(player.id) : null;
  return room ? simNow(room) : Date.now();
}

// ============================================================
// MASTERY PHASE 0 — VELOCITY-AT-PRESS TELEMETRY
// ============================================================
// Records one sample per attack/grab initiation:
//   { verb, movementVelocity, x, opponentDistance, simTime }
// `entryVelocity` is the SIGNED movementVelocity captured at the press moment,
// BEFORE the verb zeroes/overwrites it (callers must snapshot it first). The
// histogram of |movementVelocity| per verb (scripts/velocity-histogram.mjs)
// tells us where the Phase 1 momentum curve's knee belongs. Purely
// observational — never mutates state, and no-ops with zero cost when audit
// logging is disabled.
function logVerbInitiation(room, player, verb, entryVelocity) {
  if (!AUDIT_ENABLED) return;
  if (!room || !player) return;
  const opponent = room.players.find((p) => p.id !== player.id);
  appendVerbInit(room, {
    verb,
    movementVelocity: entryVelocity,
    x: player.x,
    opponentDistance: opponent ? Math.abs(player.x - opponent.x) : null,
    simTime: simNowForPlayer(player),
  });
}

// ============================================================
// RAW PARRY LAG-COMPENSATION
// ============================================================
// Returns the sim-clock start time to stamp on a freshly-started raw parry,
// ── Trusted lag-compensation (receipt + RTT + monotonic) ─────────────────────
// Client event timestamps are useful for feel, but two players' reconstructed
// times are compared for clinch simul / first-owner. Spoofing an EARLIER press
// can move a request into/out of the 60ms window — unlike perfect-parry duration
// where more backdate only makes success harder. Harden every press:
//   • age measured from PACKET RECEIPT (not drain-after-hitstop)
//   • backdate cap = min(global ceiling, RTT/2 + slack), floored for emit throttle
//   • never future vs receipt; monotonic vs last trusted press

// Resolve a player's estimated RTT for lag-comp clamps.
// Numeric 0 / string "0" are valid (LAN / localhost). Only missing, non-finite,
// or negative values fall back to the historical default of 60ms.
function resolvePlayerNetRttMs(player) {
  const raw = player && player.netRttMs;
  if (raw === null || raw === undefined || raw === "") return 60;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 60;
  return Math.min(400, parsed);
}

function getPlayerInputBackdateCapMs(player) {
  const rtt = resolvePlayerNetRttMs(player);
  return Math.min(
    MAX_PARRY_BACKDATE_MS,
    Math.max(INPUT_BACKDATE_MIN_MS, rtt * 0.5 + INPUT_BACKDATE_RTT_SLACK_MS)
  );
}

function updatePlayerNetEstimate(player, data) {
  if (!player || !data || data.clientSynced !== true) return;
  if (typeof data.clientRtt === "number" && Number.isFinite(data.clientRtt)) {
    const rtt = Math.max(0, Math.min(400, data.clientRtt));
    player.netRttMs =
      typeof player.netRttMs === "number"
        ? player.netRttMs * 0.8 + rtt * 0.2
        : rtt;
  }
  if (typeof data.clientOffset === "number" && Number.isFinite(data.clientOffset)) {
    if (typeof player.netClockOffsetMs !== "number") {
      player.netClockOffsetMs = data.clientOffset;
    } else {
      const delta = Math.abs(data.clientOffset - player.netClockOffsetMs);
      const alpha = delta > INPUT_CLOCK_OFFSET_MAX_DELTA_MS ? 0.35 : 0.12;
      player.netClockOffsetMs =
        player.netClockOffsetMs * (1 - alpha) + data.clientOffset * alpha;
    }
  }
}

// Clamp a reconstructed press onto the trusted envelope. Updates monotonic watermark.
function clampTrustedPressGameTime(player, pressGameTime, receiptGameNow) {
  if (!pressGameTime || !player) return 0;
  const receipt =
    typeof receiptGameNow === "number" && Number.isFinite(receiptGameNow)
      ? receiptGameNow
      : gameNow();
  const cap = getPlayerInputBackdateCapMs(player);
  let trusted = Math.min(pressGameTime, receipt);
  trusted = Math.max(trusted, receipt - cap);
  const last = player.lastTrustedPressGameTime || 0;
  if (last > 0) {
    trusted = Math.max(trusted, last - INPUT_PRESS_MONOTONIC_SLACK_MS);
  }
  trusted = Math.min(trusted, receipt);
  player.lastTrustedPressGameTime = Math.max(last, trusted);
  return trusted;
}

function lagCompensatedFromPress(player, simNowMs, pressGameTime, receiptGameNow) {
  if (!pressGameTime) return simNowMs;
  const receipt =
    typeof receiptGameNow === "number" && Number.isFinite(receiptGameNow)
      ? receiptGameNow
      : gameNow();
  const age = receipt - pressGameTime;
  if (!Number.isFinite(age) || age <= 0) return simNowMs;
  const backdate = Math.min(age, getPlayerInputBackdateCapMs(player));
  return simNowMs - backdate;
}

// backdated toward the player's TRUE press moment instead of the moment the
// input was drained on the server.
//
// Why: placing the press on the true keydown tick keeps the 180ms callout
// honest when the packet is late. Just/Perfect does NOT use this stamp — it
// grades from apArmSimTime (when the tap was applied) so RTT cannot jitter stars.
//
// Age uses PACKET RECEIPT (not drain time) so hitstop queue wait cannot inflate
// backdate. Cap is RTT-aware. Consumes the press stamp.
function lagCompensatedParryStart(player, simNowMs) {
  const pressGameTime = player.rawParryPressGameTime || 0;
  const receipt = player.rawParryPressReceiptGameNow || 0;
  player.rawParryPressGameTime = 0;
  player.rawParryPressReceiptGameNow = 0;
  return lagCompensatedFromPress(player, simNowMs, pressGameTime, receipt || undefined);
}

// Clinch Flow: bounded backdate for throw/pull request timestamps so the ~60ms
// true-simultaneous window isn't decided by ping jitter. Relative ordering IS
// competitively sensitive — trust comes from clampTrustedPressGameTime, not
// from "more backdate is safer."
function lagCompensatedClinchInputStart(player, simNowMs) {
  const pressGameTime = player.clinchTechniquePressGameTime || 0;
  const receipt = player.clinchTechniquePressReceiptGameNow || 0;
  player.clinchTechniquePressGameTime = 0;
  player.clinchTechniquePressReceiptGameNow = 0;
  return lagCompensatedFromPress(player, simNowMs, pressGameTime, receipt || undefined);
}

// Perfect Brace press — same trusted backdate as technique requests / parries.
function lagCompensatedClinchBraceStart(player, simNowMs) {
  const pressGameTime = player.clinchBracePressGameTime || 0;
  const receipt = player.clinchBracePressReceiptGameNow || 0;
  player.clinchBracePressGameTime = 0;
  player.clinchBracePressReceiptGameNow = 0;
  return lagCompensatedFromPress(player, simNowMs, pressGameTime, receipt || undefined);
}

// ── GUARD & PARRY arming ────────────────────────────────────────────────────
// True when a FRESH tap (rising space edge) may open / re-stamp a PARRY window.
// Gates:
//   • apSpaceConsumed — one window per physical press (clears on Space-up)
//   • isApWhiffRecovering — empty-tap jail is punishable; cannot re-arm through it
// Intentionally NOT gated on:
//   • apActiveUntil — a re-press RE-STAMPS timing (flurry re-time after a LAND)
//   • apCooldownUntil — that gap only delays re-entering GUARD after a drop
//   • isRawParrying / isGuarding — re-tap while guarding re-arms a read
// Callers layer their own action-state gates (grabbing, hit, etc.) on top.
function canArmAttackParry(player, _simTime) {
  return (
    !player.apSpaceConsumed &&
    !player.isApWhiffRecovering &&
    !player.isMatadorParrying &&
    !player.isMatadorWhiffRecovering
  );
}

// Facing-relative BACK chord (same as palm thrust): away held, not forward.
function wantsMatadorChord(player) {
  if (!player || !player.keys) return false;
  const forwardKey = player.facing === -1 ? "d" : "a";
  const backKey = player.facing === -1 ? "a" : "d";
  return !!(player.keys[backKey] && !player.keys[forwardKey]);
}

function canArmMatador(player, _simTime) {
  return (
    !player.apSpaceConsumed &&
    !player.isApWhiffRecovering &&
    !player.isMatadorWhiffRecovering &&
    !player.isMatadorParrying
  );
}

function cancelMatadorWindow(player, simTime) {
  player.isMatadorParrying = false;
  player.isMatadorSuccess = false;
  player.matadorStartTime = 0;
  player.matadorActiveUntil = 0;
  player.matadorSuccessUntil = 0;
  player.isMatadorWhiffRecovering = true;
  player.matadorRecoveryUntil = simTime + MATADOR_WHIFF_RECOVERY_MS;
  // Share Space latch with AP — one physical press, one commitment.
  player.apSpaceConsumed = false;
  player.spaceJustPressed = false;
  player.movementVelocity = 0;
  player.isStrafing = false;
}

function clearMatadorWindow(player) {
  player.isMatadorParrying = false;
  player.isMatadorSuccess = false;
  player.matadorStartTime = 0;
  player.matadorActiveUntil = 0;
  player.matadorSuccessUntil = 0;
  player.isMatadorWhiffRecovering = false;
  player.matadorRecoveryUntil = 0;
}

// Open a MATADOR window (BACK+SPACE tap). Tap-only — never becomes GUARD.
function armMatador(player, simTime, startTime) {
  // Cancel any live AP so the two stances can't coexist on one Space press.
  player.isRawParrying = false;
  player.isGuarding = false;
  player.rawParryStartTime = 0;
  player.apArmSimTime = 0;
  player.apActiveUntil = 0;
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;

  player.isMatadorParrying = true;
  player.isMatadorSuccess = false;
  player.matadorStartTime = startTime != null ? startTime : simTime;
  player.matadorActiveUntil = simTime + MATADOR_ACTIVE_MS;
  player.matadorSuccessUntil = 0;
  player.isMatadorWhiffRecovering = false;
  player.matadorRecoveryUntil = 0;
  player.apSpaceConsumed = true;
  player.spaceJustPressed = false;
  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isPowerSliding = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
  player.pendingSlapCount = 0;
}

// Per-tick MATADOR SM. Tap-only: release OR window expiry → whiff jail.
// No hold→guard path (unlike AP).
function updateMatadorState(player, simTime, spaceHeld) {
  if (player.isMatadorWhiffRecovering && simTime >= (player.matadorRecoveryUntil || 0)) {
    player.isMatadorWhiffRecovering = false;
    player.matadorRecoveryUntil = 0;
  }

  if (player.isMatadorSuccess) {
    if (simTime >= (player.matadorSuccessUntil || 0)) {
      player.isMatadorSuccess = false;
      player.matadorSuccessUntil = 0;
      // Drop the pull pose with the success window.
      if (player.isAttemptingPull) player.isAttemptingPull = false;
    }
    return;
  }

  if (!player.isMatadorParrying) return;

  const activeUntil = player.matadorActiveUntil || 0;
  if (activeUntil <= 0 || simTime >= activeUntil || !spaceHeld) {
    cancelMatadorWindow(player, simTime);
  }
}

// End a live parry window on release (or empty expiry): rooted whiff recovery
// so empty taps are punishable. Success path never calls this — a land clears
// the window without entering isApWhiffRecovering.
function cancelAttackParryWindow(player, simTime) {
  player.isRawParrying = false;
  player.isGuarding = false;
  player.rawParryStartTime = 0;
  player.apArmSimTime = 0;
  player.apActiveUntil = 0;
  player.apChainCount = 0;
  player.apSpaceConsumed = false;
  player.isApWhiffRecovering = true;
  player.apRecoveryUntil = simTime + AP_WHIFF_RECOVERY_MS;
  player.movementVelocity = 0;
  player.isStrafing = false;
}

// Open a PARRY window (a fresh, timed TAP). `startTime` is the (lag-compensated)
// sim time the tap is judged from — the perfect grade is (hitTime − startTime).
// Clears guard: a tap is an active read, not a hold. No stamina here — cost is
// charged PER PARRY when it lands (see processHit). If the window closes with no
// deflect, updateAttackParryState decides guard (still holding) vs cancel (released).
// After a landed parry, apFlurryUntil may extend this window so an immediate
// re-tap still covers the attacker's ASAP follow-up (tap-every-slap).
function armAttackParry(player, simTime, startTime) {
  // Clear success POSE so the next read shows attempting stance — but do NOT
  // clear isApPostParryLocked. Re-tapping for a flurry must not unlock walk/act.
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  player.isRawParrying = true;
  player.isGuarding = false; // a fresh read window, not the block floor
  player.apGuardNeedsRelease = false;
  player.rawParryStartTime = startTime != null ? startTime : simTime;
  // Apply tick — just grade reads this, not the lag-comp'd start.
  player.apArmSimTime = simTime;
  player.apActiveUntil = simTime + AP_ACTIVE_MS;
  // Flurry cover: early re-tap after a landed parry keeps the window alive long
  // enough to meet stagger + slap startup. Perfect still uses press→hit delta.
  const flurryUntil = player.apFlurryUntil || 0;
  if (flurryUntil > player.apActiveUntil) {
    player.apActiveUntil = flurryUntil;
  }
  player.apFlowUntil = 0; // Flow removed — retained field zeroed for safety
  player.isApWhiffRecovering = false;
  player.apRecoveryUntil = 0;
  player.apSpaceConsumed = true;
  // Consume the rising-edge latch. While Space is held the client often sends
  // no further packets, so leaving this true would phantom-re-arm after land.
  player.spaceJustPressed = false;
  player.rawParryMinDurationMet = false;
  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isPowerSliding = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
  player.pendingSlapCount = 0;
}

// Stamp / refresh the post-parry flurry cover deadline (sim clock).
// `staggerMs` should be the lockout applied to the attacker on this parry
// (regular slap / perfect / palm / flap) so cover outlasts their ASAP re-fire.
// Just = the tap was applied in the last PERFECT_PARRY_WINDOW ms before contact.
// Early callout (already in) is Regular. Does not use lag-comp'd rawParryStartTime.
function isAttackParryJust(parrier, hitTime) {
  if (!parrier || parrier.isGuarding) return false;
  const armedAt =
    typeof parrier.apArmSimTime === "number" && parrier.apArmSimTime > 0
      ? parrier.apArmSimTime
      : parrier.rawParryStartTime || hitTime;
  const dt = hitTime - armedAt;
  return dt >= 0 && dt <= PERFECT_PARRY_WINDOW;
}

function grantAttackParryFlurryCover(player, simTime, staggerMs) {
  const stagger =
    typeof staggerMs === "number" && staggerMs > 0 ? staggerMs : AP_STAGGER_SLAP_MS;
  player.apFlurryUntil =
    simTime +
    AP_FLURRY_STAGGER_BEGIN_MS +
    stagger +
    SLAP_STARTUP_MS +
    AP_FLURRY_SLACK_MS;
}

// DEPRECATED — always false. Space-up soft-clears the armed window in
// updateAttackParryState so you can't walk in blocking.png unable to attack.
// Flurry cover still extends the NEXT rising-edge re-arm via apFlurryUntil.
function isAttackParryFlurryLinger(_player, _simTime) {
  return false;
}

// True while move+offense are locked after a landed parry (includes success pose
// and the gap after a flurry re-tap clears the pose flags).
function isAttackParryPostLocked(player) {
  return !!(
    player &&
    (player.isApPostParryLocked ||
      player.isRawParrySuccess ||
      player.isPerfectRawParrySuccess)
  );
}

// Drop an expired/stale armed window with Space up — no cancel-recovery jail.
function clearAttackParryWindow(player) {
  player.isRawParrying = false;
  player.isGuarding = false;
  player.rawParryStartTime = 0;
  player.apArmSimTime = 0;
  player.apActiveUntil = 0;
  player.apSpaceConsumed = false;
}

// Enter GUARD (the block floor) — holding Space with no live parry window. A
// blocked strike is chip + ground lost + stamina bled (resolved in processHit),
// never a reward. Does not disturb a live parry window or a success pose.
// After a landed parry, a continued hold also lands here (same physical press
// cannot open a second timed PARRY — release + re-press for that).
function enterGuard(player) {
  if (player.isApWhiffRecovering) return; // can't guard mid-whiff-punish
  player.isRawParrying = true;
  player.isGuarding = true;
  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isPowerSliding = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
}

// Per-tick GUARD/PARRY state machine (called from the main loop for each player).
//   • Live window + Space up → CANCEL (short recovery; re-press may re-arm now).
//   • Window expires while still holding → GUARD (grab-vulnerable block floor).
//   • Dropping guard → tiny AP_COOLDOWN before guard may re-enter.
//   • Landed parry: GUARD only while still holding; tap-parry drops the floor.
// Runs AFTER collision so a same-tick release+hit still grades the live window.
function updateAttackParryState(player, simTime, spaceHeld) {
  // Safety net: primary clear is the falling-edge path in processInputPacket
  // (so a same-tick release→re-press can re-arm). This covers CPU / any path
  // that never saw a falling edge flag.
  if (!spaceHeld) {
    player.apSpaceConsumed = false;
    player.apGuardNeedsRelease = false;
  }

  // Cancel/whiff-recovery expiry (independent of stance).
  if (player.isApWhiffRecovering && simTime >= (player.apRecoveryUntil || 0)) {
    player.isApWhiffRecovering = false;
    player.apRecoveryUntil = 0;
  }

  // Landed-parry impact pose is cosmetic; success sprites win over blocking.png.
  // Continued hold after a land is GUARD — same press already spent its timed read.
  if (player.isRawParrySuccess || player.isPerfectRawParrySuccess) {
    if (spaceHeld) {
      player.isRawParrying = true;
      player.isGuarding = true;
      player.apSpaceConsumed = true;
    } else {
      player.isGuarding = false;
      player.isRawParrying = false;
    }
    return;
  }

  if (!player.isRawParrying) return;

  // GUARD (holding, no live parry window).
  if (player.isGuarding) {
    if (!spaceHeld) {
      player.isRawParrying = false;
      player.isGuarding = false;
      player.apChainCount = 0; // dropping the stance ends the parry chain
      player.apCooldownUntil = simTime + AP_COOLDOWN_MS;
    }
    return;
  }

  // In a PARRY read window.
  const activeUntil = player.apActiveUntil || 0;
  if (activeUntil <= 0) {
    // Stale isRawParrying with no window (e.g. a snowball parry that cleared).
    player.isRawParrying = false;
    player.rawParryStartTime = 0;
    player.apArmSimTime = 0;
    player.apChainCount = 0;
    return;
  }

  // Still inside the window.
  // Space up → drop the window so move+offense unlock together (no "moonwalk
  // in blocking.png"). Post-parry flurry cover: soft clear (no whiff jail)
  // so piano re-taps stay snappy; the NEXT rising edge still gets apFlurryUntil
  // extension via armAttackParry. Neutral empty taps pay full whiff recovery.
  if (simTime < activeUntil) {
    if (!spaceHeld) {
      const flurryUntil = player.apFlurryUntil || 0;
      if (flurryUntil > 0 && simTime < flurryUntil) {
        clearAttackParryWindow(player);
      } else {
        cancelAttackParryWindow(player, simTime);
      }
    }
    return;
  }

  // ── Window just closed with no deflect ──
  if (spaceHeld) {
    // Still holding → mistimed tap safely becomes GUARD (grab-vulnerable floor).
    // Not a whiff — holding into block is the safe floor, not punish recovery.
    player.isGuarding = true;
    player.apActiveUntil = 0;
  } else {
    // Space already up and nothing connected → empty whiff jail.
    // (Release mid-window already paid via cancelAttackParryWindow above;
    // this covers holding the window to expiry then letting go / soft expiry.)
    cancelAttackParryWindow(player, simTime);
  }
}

// Advance a room's sim clock by one tick. Called once per room per tick from
// the game loop. Frozen during hitstop — that's the whole point.
function advanceRoomSimTime(room, deltaMs) {
  if (room.simTime == null) room.simTime = Date.now();
  if (!isRoomInHitstop(room)) {
    room.simTime += deltaMs;
  }
}

// ============================================================
// TIMEOUT MANAGER (sim-clock scheduled)
// ============================================================
// Same public API as the old wall-clock version (set / clearPlayerSpecific /
// clearPlayer / clearAll), but timers are scheduled against the player's room
// simTime and fired from the game loop via processRoom(). Consequences:
//   - Timers automatically pause during hitstop (simTime freezes).
//   - Timers fire on tick boundaries (~15.6ms quantization), which matches the
//     simulation's actual resolution instead of pretending ms precision.
//   - Callbacks run synchronously inside the tick, not from the macrotask
//     queue, so they can never interleave mid-tick with simulation code.
// If a player has no room (lobby edge cases), falls back to a real setTimeout
// with identical bookkeeping so cancellation paths still work.
class TimeoutManager {
  constructor() {
    this.timersByPlayer = new Map(); // playerId -> Map(timerId -> timer)
    this.namedTimeouts = new Map(); // playerId -> Map(name -> timerId)
    this.nextTimerId = 1;
  }

  _resolveRoom(playerId) {
    return simRoomResolver ? simRoomResolver(playerId) : null;
  }

  set(playerId, callback, delay, name = null) {
    const timerId = this.nextTimerId++;
    const room = this._resolveRoom(playerId);
    const timer = { id: timerId, playerId, name, callback };

    if (room) {
      timer.fireAt = simNow(room) + delay;
    } else {
      // Wall-clock fallback for players not (yet) registered to a room.
      timer.nodeTimeoutId = setTimeout(() => {
        this._delete(playerId, timerId);
        callback();
      }, delay);
    }

    if (!this.timersByPlayer.has(playerId)) {
      this.timersByPlayer.set(playerId, new Map());
    }
    this.timersByPlayer.get(playerId).set(timerId, timer);

    if (name) {
      if (!this.namedTimeouts.has(playerId)) {
        this.namedTimeouts.set(playerId, new Map());
      }
      // Replace any existing timer with the same name
      const existingId = this.namedTimeouts.get(playerId).get(name);
      if (existingId != null) {
        this._delete(playerId, existingId);
      }
      this.namedTimeouts.get(playerId).set(name, timerId);
    }

    return timerId;
  }

  // Fire all due sim timers for a room's players. Called once per room per
  // tick, after advanceRoomSimTime. During hitstop simTime doesn't advance,
  // so nothing new becomes due — timers pause without special-casing.
  processRoom(room) {
    if (!room.players || room.players.length === 0) return;
    // The sim is frozen during hitstop — nothing fires, even zero-delay timers
    // set mid-freeze. They resolve on the first tick after the freeze ends.
    if (isRoomInHitstop(room)) return;
    let due = null;
    const nowSim = room.simTime;
    if (nowSim == null) return;

    for (let i = 0; i < room.players.length; i++) {
      const timers = this.timersByPlayer.get(room.players[i].id);
      if (!timers) continue;
      for (const timer of timers.values()) {
        if (timer.fireAt != null && timer.fireAt <= nowSim) {
          (due || (due = [])).push(timer);
        }
      }
    }
    if (!due) return;

    // Fire in scheduled order; ties resolve by creation order.
    due.sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
    for (const timer of due) {
      // A previously-fired callback may have cancelled this one mid-loop.
      const live = this.timersByPlayer.get(timer.playerId);
      if (!live || !live.has(timer.id)) continue;
      this._delete(timer.playerId, timer.id);
      try {
        timer.callback();
      } catch (error) {
        console.error(
          `Error in sim timer${timer.name ? ` "${timer.name}"` : ""}:`,
          error
        );
      }
    }
  }

  // Pull a pending named timer's deadline earlier by `ms` (used for the
  // attacker-favored hitstop relief on chainable slap hits).
  advanceNamed(playerId, name, ms) {
    const named = this.namedTimeouts.get(playerId);
    if (!named) return;
    const timerId = named.get(name);
    if (timerId == null) return;
    const timer = this.timersByPlayer.get(playerId)?.get(timerId);
    if (timer && timer.fireAt != null) {
      timer.fireAt -= ms;
    }
  }

  _delete(playerId, timerId) {
    const timers = this.timersByPlayer.get(playerId);
    if (timers) {
      const timer = timers.get(timerId);
      if (timer) {
        if (timer.nodeTimeoutId != null) clearTimeout(timer.nodeTimeoutId);
        if (timer.name) {
          const named = this.namedTimeouts.get(playerId);
          if (named && named.get(timer.name) === timerId) {
            named.delete(timer.name);
          }
        }
        timers.delete(timerId);
      }
      if (timers.size === 0) this.timersByPlayer.delete(playerId);
    }
  }

  remove(playerId, timerId) {
    this._delete(playerId, timerId);
  }

  removeNamed(playerId, name) {
    const named = this.namedTimeouts.get(playerId);
    if (named) named.delete(name);
  }

  clearPlayerSpecific(playerId, name) {
    const named = this.namedTimeouts.get(playerId);
    if (named) {
      const timerId = named.get(name);
      if (timerId != null) this._delete(playerId, timerId);
    }
  }

  clearPlayer(playerId) {
    const timers = this.timersByPlayer.get(playerId);
    if (timers) {
      for (const timer of timers.values()) {
        if (timer.nodeTimeoutId != null) clearTimeout(timer.nodeTimeoutId);
      }
      this.timersByPlayer.delete(playerId);
    }
    this.namedTimeouts.delete(playerId);
  }

  clearAll() {
    for (const timers of this.timersByPlayer.values()) {
      for (const timer of timers.values()) {
        if (timer.nodeTimeoutId != null) clearTimeout(timer.nodeTimeoutId);
      }
    }
    this.timersByPlayer.clear();
    this.namedTimeouts.clear();
  }
}

const timeoutManager = new TimeoutManager();

// Helper function used at every timer call site. Same signature as before,
// but now schedules on the room's pausable sim clock (see TimeoutManager).
function setPlayerTimeout(playerId, callback, delay, name = null) {
  return timeoutManager.set(playerId, callback, delay, name);
}

/** Cancel named lifecycle timeouts. V2 full-clear uses the full list. */
function clearLifecycleNamedTimeouts(player, names = LIFECYCLE_TIMEOUT_NAMES) {
  if (!player?.id) return;
  for (let i = 0; i < names.length; i++) {
    timeoutManager.clearPlayerSpecific(player.id, names[i]);
  }
}

// Helper functions to reduce code duplication
// CRITICAL: This is the SINGLE SOURCE OF TRUTH for blocking new actions
// Any state where the player is "doing something" must be included here
function isPlayerInActiveState(player) {
  return (
    !player.isAttacking &&
    !player.isRopeJumping &&
    !player.isSlideJumping &&
    !player.isDodging &&
    !player.isDodgeRecovery &&
    !player.isSidestepping &&
    !player.isSidestepRecovery &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRecovering &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isThrowingSnowball &&
    !player.canMoveToReady &&
    !player.isAtTheRopes &&
    // Additional blocking states that were missing:
    !player.isGrabStartup &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabBreaking &&
    !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating &&
    !player.isGrabSeparating &&
    !player.isThrowingSalt &&
    !player.isThrowTeching &&
    !player.isSpawningPumoArmy &&
    !player.isInStartupFrames &&
    !player.isInEndlag &&
    !player.isChargingAttack &&
    !player.isGrabClashing
  );
}

// CRITICAL: This checks ALL states where a player cannot start a NEW action
// Used by canPlayerUseAction, dodge checks, grab checks, etc.
function isPlayerInBasicActiveState(player) {
  return (
    // Core action states
    !player.isAttacking &&
    !player.isRopeJumping &&
    !player.isFlapping && // Airborne flap — only Space (flight) inputs allowed
    !player.isSlideJumping &&
    !player.isDodging &&
    !player.isDodgeRecovery &&
    !player.isSidestepping &&
    !player.isSidestepRecovery &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isApPostParryLocked && // survives flurry re-tap; blocks slap/grab/etc.
    !player.isRawParrySuccess &&
    !player.isPerfectRawParrySuccess &&
    !player.isApWhiffRecovering && // AP whiffed → committed, punishable recovery
    !player.isMatadorParrying &&
    !player.isMatadorSuccess &&
    !player.isMatadorWhiffRecovering &&
    !player.isThrowingSnowball &&
    !player.isAtTheRopes &&
    // Grab-related intermediate states
    !player.isGrabStartup &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabBreaking &&
    !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating &&
    !player.isGrabClashing &&
    !player.isGrabSeparating &&
    // Other action states
    !player.isThrowingSalt &&
    !player.isThrowTeching &&
    !player.isSpawningPumoArmy &&
    // Attack timing states (startup/endlag)
    !player.isInStartupFrames &&
    !player.isInEndlag
    // NOTE: isChargingAttack NOT checked — actions cancel charging instead of being blocked by it
    // NOTE: Power slide no longer blocks actions - attacks cancel the slide
  );
}

function canPlayerCharge(player) {
  return isPlayerInActiveState(player) && !player.isChargingAttack;
}

function canPlayerUseAction(player) {
  // Check action lock timer - this is a global gate to prevent action overlaps
  if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) {
    return false;
  }
  
  return (
    isPlayerInBasicActiveState(player) &&
    !player.isRecovering &&
    !player.canMoveToReady
  );
}

/**
 * Dodge startup strike invuln (DODGE_IFRAME_MS from dodgeStartTime).
 * Strike collision only — grabs still beat the kick-off dodge.
 */
function isInDodgeStrikeIFrames(player, nowSim) {
  if (!player || !player.isDodging) return false;
  const start = player.dodgeStartTime || 0;
  if (!start) return false;
  const t = (typeof nowSim === "number" ? nowSim : simNowForPlayer(player)) - start;
  return t >= 0 && t < DODGE_IFRAME_MS;
}

/**
 * Start a grounded dodge (full hop + ice-slide kit).
 * Locked while gassed — same as sidestep / rope jump / flap.
 * Caller must already pass situational gates (canPlayerDash, not grabbed, etc.).
 */
function beginPlayerDodge(player, options = {}) {
  if (!player || player.isGassed) return false;
  const nowSim = options.nowSim ?? simNowForPlayer(player);
  let direction = options.direction;
  if (direction !== 1 && direction !== -1) {
    if (player.keys?.a && !player.keys?.d) direction = -1;
    else if (player.keys?.d && !player.keys?.a) direction = 1;
    else direction = player.facing === -1 ? 1 : -1;
  }

  if (options.clearCharge !== false) {
    clearChargeState(player, true);
  }

  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;

  // MASTERY Phase 1: snapshot entry speed before zeroing (landing blend).
  player.dodgeEntrySpeed = Math.abs(player.movementVelocity || 0);
  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isPowerSliding = false;
  player.isBraking = false;
  clearIceSlideState(player);

  player.isDodging = true;
  player.isDodgeStartup = !options.skipStartup;
  player.dodgeStartTime = nowSim;
  player.dodgeStartupEndTime = nowSim + (options.skipStartup ? 0 : DODGE_STARTUP_MS);
  player.dodgeEndTime = nowSim + DODGE_DURATION;
  player.dodgeStartX = player.x;
  player.dodgeDirection = direction;
  // Fixed travel — speed buffs only finish this sooner, never extend it.
  player.dodgeTargetX = Math.max(
    MAP_LEFT_BOUNDARY,
    Math.min(MAP_RIGHT_BOUNDARY, player.x + direction * DODGE_TRAVEL_DISTANCE)
  );
  player.currentAction = "dash";
  player.actionLockUntil = nowSim + 100;
  player.justLandedFromDodge = false;

  // Phase 12 — freeze facing for the hop (travel remains dodgeDirection).
  if (isActionFacingOwnershipV2Enabled()) {
    const dodgeFacingId = mintActionFacingInstanceId(
      player,
      ACTION_FACING_OWNER.DODGE
    );
    player.dodgeFacingInstanceId = dodgeFacingId;
    acquireActionFacingLock(player, {
      ownerType: ACTION_FACING_OWNER.DODGE,
      ownerInstanceId: dodgeFacingId,
      direction: player.facing,
      reason: ACTION_FACING_REASON.TRAVEL,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
  }

  player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);
  return true;
}

// Special function for dash - allows dashing DURING charging (dash will cancel the charge)
function canPlayerDash(player) {
  // Check action lock timer
  if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) {
    return false;
  }

  // Dash-specific cooldown: forced idle gap after recovery so consecutive dashes read as distinct
  if (player.dodgeCooldownUntil && simNowForPlayer(player) < player.dodgeCooldownUntil) {
    return false;
  }
  
  // Check all blocking states EXCEPT isChargingAttack (dodge is allowed during charging)
  return (
    // Core action states
    !player.isAttacking &&
    !player.isRopeJumping &&
    !player.isFlapping && // Airborne flap — dash (shift) disabled during flight
    !player.isSlideJumping && // Airborne slide-jump — no dash mid-air
    !player.isDodging &&
    !player.isDodgeRecovery &&
    !player.isSidestepping &&
    !player.isSidestepRecovery &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isApPostParryLocked &&
    !player.isRawParrySuccess &&
    !player.isPerfectRawParrySuccess &&
    !player.isApWhiffRecovering && // AP whiffed → committed, punishable recovery
    !player.isMatadorParrying &&
    !player.isMatadorSuccess &&
    !player.isMatadorWhiffRecovering &&
    !player.isThrowingSnowball &&
    !player.isAtTheRopes &&
    // Grab-related intermediate states
    !player.isGrabStartup &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabBreaking &&
    !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating &&
    !player.isGrabClashing &&
    !player.isGrabSeparating &&
    // Other action states
    !player.isThrowingSalt &&
    !player.isThrowTeching &&
    !player.isSpawningPumoArmy &&
    // Attack timing states (startup/endlag)
    !player.isInStartupFrames &&
    !player.isInEndlag &&
    // NOTE: isChargingAttack is NOT checked - dash is allowed during charging (but cancels it)
    // Recovery and ready states
    !player.isRecovering &&
    !player.canMoveToReady
  );
}

function canPlayerSidestep(player) {
  if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) return false;
  if (player.dodgeCooldownUntil && simNowForPlayer(player) < player.dodgeCooldownUntil) return false;
  return canPlayerUseAction(player) && !player.isSidestepping && !player.isSidestepRecovery;
}

function resetPlayerAttackStates(player) {
  player.isAttacking = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.slapFacingDirection = null;
  player.slapFacingInstanceId = null;
  player.chargeFacingInstanceId = null;
  if (isActionFacingOwnershipV2Enabled()) {
    forceClearActionFacingLock(player, {
      reason: ACTION_FACING_RELEASE.INTERRUPT,
    });
  }
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.isLowKick = false;
  player.palmThrustVisualUntil = 0;
  timeoutManager.clearPlayerSpecific(player.id, "palmThrustVisualEnd");
  timeoutManager.clearPlayerSpecific(player.id, "lowKickCycle");
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.spacebarReleasedDuringDodge = false;
  // Reset visual clarity timing states
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.isInEndlag = false;
  player.endlagEndTime = 0;
  player.slapActiveEndTime = 0;
  player.chargedActiveEndTime = 0;
  player.attackCooldownUntil = 0;
  player.currentSlapHitConnected = false;
  player.slapOpenHitPending = false;
  player.slideSlapArmed = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
}

// === CRITICAL: Clear ALL action states when player loses control ===
// This ensures only ONE state/animation can be active at a time
// Called when: isHit, isBeingGrabbed, isBeingThrown, isRawParryStun, isAtTheRopes
function clearAllActionStates(player) {
  // Offensive-aerial outcome: preserve already-resolved HIT/PARRIED across the
  // broad clear; record INTERRUPTED when an armed activation is cancelled mid-air.
  const priorOa = player?.offensiveAerial || null;
  const preserveContactOutcome =
    priorOa &&
    priorOa.resolved &&
    isTerminalContactOutcome(priorOa.outcome);
  const shouldRecordInterrupt =
    !preserveContactOutcome &&
    priorOa &&
    priorOa.attackInstanceId &&
    !priorOa.resolved &&
    priorOa.offensiveArmed &&
    !!(player.isSlideJumping || player.isFlapping);

  // Tear down slap-string timers/buffers first so a snowball/projectile hit
  // can't leave a deferred executeSlapAttack that fires once isHit clears.
  cancelPendingSlapWork(player);

  // Clear hit states - prevents conflicting states (e.g., isHit + isBeingGrabbed)
  player.isHit = false;
  player.isAlreadyHit = false;
  player.isSlapKnockback = false;
  player.slapKnockbackCanRingOut = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
  player.isParryKnockback = false;
  player.isChargedHitRecoil = false;
  
  // Clear attack states
  player.isAttacking = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  // TAP-style: keep charge power if mouse1 is still held
  if (!(player.keys && player.keys.mouse1)) {
    player.chargeAttackPower = 0;
  }
  player.chargingFacingDirection = null;
  player.slapFacingDirection = null;
  player.slapFacingInstanceId = null;
  player.chargeFacingInstanceId = null;
  player.dodgeFacingInstanceId = null;
  player.hitstunFacingInstanceId = null;
  player.grabFacingInstanceId = null;
  player.pullFacingInstanceId = null;
  player.throwFacingInstanceId = null;
  player.throwVictimFacingInstanceId = null;
  // Ropes facing may intentionally outlive this clear (soft field preserved);
  // drop only a non-ropes V2 owner. Ropes re-acquire after clear when needed.
  // Phase 12 — non-aerial facing owner ends with the action shell (like OA).
  forceClearActionFacingLock(player, {
    reason: ACTION_FACING_RELEASE.INTERRUPT,
  });
  clearCombatContactState(player);
  // Phase 15 — under V2, cancel every named lifecycle timeout so stale
  // chargedEndlag / hitStateReset / parryStagger / slapStartup / etc. cannot
  // mutate a newer action after this interrupt clear.
  if (isActionLifecycleOwnershipV2Enabled()) {
    clearLifecycleNamedTimeouts(player);
    forceClearLifecycleOwners(player, { reason: "CLEAR_ALL_ACTION_STATES" });
  }
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.isLowKick = false;
  player.palmThrustVisualUntil = 0;
  timeoutManager.clearPlayerSpecific(player.id, "palmThrustVisualEnd");
  timeoutManager.clearPlayerSpecific(player.id, "lowKickCycle");
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.spacebarReleasedDuringDodge = false;
  player.pendingSlapCount = 0;
  player.pendingSlapPressTime = 0;
  player.pendingPalmThrust = false;
  // MASTERY Phase 3: clearing attack state ends the tsuppari string.
  player.isEnhancedSlap = false;
  player.cadenceChain = 0;
  player.isSlapSliding = false;
  player.slideSlapArmed = false;
  player.currentSlapHitConnected = false;
  player.slapOpenHitPending = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
  player.mouse1BufferedBeforeStart = false;
  player.movementKeysBufferedBeforeStart = null;
  player.chargedAttackHit = false;
  
  // Clear counter hit timing — prevents stale timestamps from causing
  // duplicate counter hits on subsequent hits in a slap string
  player.attackAttemptTime = 0;
  player.attackIntentTime = 0;

  // Clear startup/endlag states
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.isInEndlag = false;
  player.endlagEndTime = 0;
  player.slapActiveEndTime = 0;
  player.chargedActiveEndTime = 0;
  
  // Clear dodge states
  player.isDodging = false;
  player.isDodgeStartup = false;
  player.isDodgeRecovery = false;
  player.dodgeCooldownUntil = 0;
  player.dodgeStartTime = 0;
  player.dodgeEndTime = 0;
  player.dodgeDirection = null;
  player.dodgeStartX = 0;
  player.dodgeTargetX = 0;
  player.dodgeStartupEndTime = 0;
  
  // Clear sidestep states
  player.isSidestepping = false;
  player.isSidestepStartup = false;
  player.isSidestepRecovery = false;
  player.sidestepStartTime = 0;
  player.sidestepStartupEndTime = 0;
  player.sidestepActiveEndTime = 0;
  player.sidestepEndTime = 0;
  player.sidestepStartX = 0;
  player.sidestepDirection = 0;
  player.sidestepTargetX = 0;
  player.sidestepRecoveryStartX = 0;
  player.sidestepRecoveryTargetX = 0;
  player.postSidestepFacingTrackUntil = 0;
  
  // CRITICAL: Clear any buffered actions - prevents buffered dodge from executing while grabbed
  player.bufferedAction = null;
  player.bufferExpiryTime = 0;
  
  // Clear grab states (as grabber - not being grabbed)
  player.isGrabbing = false;
  player.isGrabWalking = false;
  player.isGrabbingMovement = false;
  player.isGrabStartup = false;
  player.isWhiffingGrab = false;
  player.isGrabWhiffRecovery = false;
  // Whiff recovery arms grabCooldown and clears it via the grabWhiffRecovery
  // timer. That timer is cancelled above (LIFECYCLE_TIMEOUT_NAMES) — if we
  // don't clear the flag here, mouse2 grabs stay rejected forever after a
  // hit/interrupt during whiff recovery.
  player.grabCooldown = false;
  player.grabbedOpponent = null;
  player.grabMovementStartTime = 0;
  player.grabMovementDirection = 0;
  player.grabMovementVelocity = 0;
  player.grabStartupStartTime = 0;
  player.grabStartupDuration = 0;
  player.grabStartupArmorUsed = false;
  player.grabStartTime = 0;
  player.grabState = "initial";
  player.grabAttemptType = null;
  // New grab action system states
  player.isGrabPushing = false;
  player.isBeingGrabPushed = false;
  player.isEdgePushing = false;
  player.isBeingEdgePushed = false;
  player.isAttemptingPull = false;
  player.isBeingPullReversaled = false;
  player.pullReversalPullerId = null;
  player.pullFacingDirection = null;
  player.isGrabSeparating = false;
  player.isGrabBellyFlopping = false;
  player.isBeingGrabBellyFlopped = false;
  player.isGrabFrontalForceOut = false;
  player.isBeingGrabFrontalForceOut = false;
  player.grabActionStartTime = 0;
  player.grabActionType = null;
  player.lastGrabPushStaminaDrainTime = 0;
  player.isAtBoundaryDuringGrab = false;
  player.clinchEdgePinHeldMs = 0;
  player.grabDurationPaused = false;
  player.grabDurationPausedAt = 0;
  player.grabPushEndTime = 0;
  player.grabDecisionMade = false;
  
  // Clear throw states (as thrower)
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.throwingFacingDirection = null;
  
  // Clear parry states (as parrier)
  player.isRawParrying = false;
  player.isGuarding = false;
  player.rawParryStartTime = 0;
  player.apArmSimTime = 0;
  player.rawParryPressGameTime = 0;
  player.rawParryMinDurationMet = false;
  player.isSlapParrying = false;
  player.isRawParryStun = false; // Clear stun state when hit
  player.isRawParrySuccess = false; // Clear parry success animation
  player.isPerfectRawParrySuccess = false;
  // GUARD & PARRY — clear the window + guard + chain + whiff recovery so a hit ends it.
  player.apActiveUntil = 0;
  player.apFlowUntil = 0;
  player.apChainCount = 0;
  player.apFlurryUntil = 0;
  player.isApWhiffRecovering = false;
  player.apRecoveryUntil = 0;
  player.apGuardNeedsRelease = false;
  player.apSpaceConsumed = false;
  player.isApPostParryLocked = false;
  player.apPostParryLockUntil = 0;

  // MATADOR — hit / lose-control tears down the grab-line read too.
  player.isMatadorParrying = false;
  player.isMatadorSuccess = false;
  player.matadorStartTime = 0;
  player.matadorActiveUntil = 0;
  player.matadorSuccessUntil = 0;
  player.isMatadorWhiffRecovering = false;
  player.matadorRecoveryUntil = 0;
  
  // Clear movement states
  player.isStrafing = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
  player.movementVelocity = 0;
  // MASTERY Phase 1: getting hit / losing control forfeits any queued momentum
  // carry — you can't cash a dodge-in into a slap after eating a hit.
  player.momentumWindowVel = 0;
  player.momentumWindowUntil = 0;
  // ICE PHYSICS: Clear sliding states
  player.isPowerSliding = false;
  player.isBraking = false;
  clearIceSlideState(player);
  // Do not finalize/null the outcome here — handled below for interrupt vs preserve.
  clearSlideJumpState(player, { finalizeOutcome: false });
  // Aerial facing owner ends with the action shell; hitstun / other systems
  // become the facing owner after this clear (full force — not stale-gated).
  forceClearOffensiveAerialFacingLock(player, {
    reason: FACING_RELEASE.INTERRUPT,
  });
  clearOffensiveAerialPresentation(player);
  player.strafeStartTime = 0;
  player.wasStrafingLeft = false;
  player.wasStrafingRight = false;
  
  // Clear recovery states
  player.isRecovering = false;
  player.recoveryStartTime = 0;
  player.recoveryDuration = 0;
  player.recoveryDirection = null;

  // End the at-the-ropes STUN. This is the movement/stun flag only — its clear
  // is otherwise driven by a named 800ms timeout, and any transition that cancels
  // that timeout (a hit landing on a player still at the ropes cancels it in
  // processHit) would otherwise orphan the flag TRUE forever, permanently
  // blocking the strafe gate. The facing LOCK (atTheRopesFacingDirection) is
  // deliberately left intact — it's meant to persist through hits/ring-out until
  // the player moves back inside the boundary or the round resets.
  player.isAtTheRopes = false;
  player.atTheRopesStartTime = 0;
  
  // Clear action lock
  player.currentAction = null;
  player.actionLockUntil = 0;
  
  // Clear buffered actions
  player.bufferedAction = null;
  player.bufferExpiryTime = 0;
  player.postGrabInputBuffer = false;
  
  // Clear power-up action states
  const wasSpawningPumoArmy = player.isSpawningPumoArmy;
  player.isThrowingSnowball = false;
  player.isSpawningPumoArmy = false;
  player.isThrowingSalt = false;
  if (wasSpawningPumoArmy) {
    timeoutManager.clearPlayerSpecific(player.id, "pumoArmySpawnEnd");
    player.pumoArmyCooldown = false;
  }
  
  // Clear hit recovery states (Y snap happens in the caller when appropriate)
  player.isHitFalling = false;
  player.hitFallStartTime = 0;
  player.hitFallStartY = 0;
  player.hitFallVelocityY = 0;
  clearAirHitOverlapEject(player);
  player.isSidestepHitReturn = false;
  player.sidestepHitReturnStartTime = 0;
  player.sidestepHitReturnStartY = 0;
  player.sidestepHitReturnDuration = 0;

  // Clear rope jump states (keep Y position — hit recovery systems handle the fall)
  player.isRopeJumping = false;
  player.ropeJumpPhase = null;
  player.ropeJumpStartTime = 0;
  player.ropeJumpStartX = 0;
  player.ropeJumpTargetX = 0;
  player.ropeJumpDirection = 0;
  player.ropeJumpActiveStartTime = 0;
  player.ropeJumpLandingTime = 0;
  player.ropeJumpBufferedAttackRelease = 0;
  // Aerial landing Phase A fields (inline reset — avoid circular require)
  player.ropeJumpRawTargetX = 0;
  player.ropeJumpResolvedTargetX = 0;
  player.ropeJumpLandingCommitted = false;
  player.ropeJumpLandingCommitX = 0;
  player.ropeJumpLandingCommitT = 0;
  player.ropeJumpLandingCommitVel = 0;
  player.ropeJumpLandingDecision = null;
  player.ropeJumpLandingPath = null;
  player.ropeJumpPreferredSide = 0;
  player.ropeJumpResolvedSide = 0;
  player.ropeJumpMinDistance = 0;
  player.ropeJumpCenterDistance = 0;
  player.ropeJumpOverlap = 0;
  player.ropeJumpSafetyCorrectionPx = 0;
  player.ropeJumpPreTouchdownX = 0;
  player.ropeJumpTouchdownX = 0;
  player.ropeJumpUsedFallback = false;
  player.ropeJumpTrajectoryType = null;
  player.ropeJumpDecisionClass = null;
  player.ropeJumpFallbackReason = null;
  player.ropeJumpHorizVel = 0;
  player.ropeJumpRawExpectedVel = 0;
  player.ropeJumpPeakVel = 0;
  player.ropeJumpPeakAccel = 0;
  player.ropeJumpReversalDetected = false;
  player.ropeJumpSideIntentLocked = false;
  player.ropeJumpSideIntent = 0;
  player.ropeJumpIntentClass = null;
  player.ropeJumpIntentReason = null;
  player.ropeJumpRecommendedCommitT = 0;
  player.ropeJumpSideIntentOpponentX = 0;
  player.ropeJumpPlanningState = null;
  player.ropeJumpFirstRawConflictTick = 0;
  player.ropeJumpFirstRawConflictT = -1;
  player.ropeJumpSideLockTick = 0;
  player.ropeJumpSideLockReason = null;
  player.ropeJumpNoReturnDeadlineT = 0;
  player.ropeJumpConflictBeforeDeadline = null;
  player.ropeJumpEndpointCommitTick = 0;
  player.ropeJumpLateIntrusion = false;
  player.ropeJumpLateIntrusionClass = null;
  player.ropeJumpSafetyCorrectionTicks = 0;
  player.ropeJumpSettleState = null;
  player.ropeJumpSidePolicy = null;
  player.ropeJumpSettleJumperIsLeft = null;
  player.ropeJumpSettleInitialOverlap = 0;
  player.ropeJumpSettleMaxOverlap = 0;
  player.ropeJumpSettleAccumulatedPx = 0;
  player.ropeJumpSettleTicksDone = 0;
  player.ropeJumpSettleTicksTotal = 0;
  player.ropeJumpSettleEpisodeCount = 0;
  player.ropeJumpSettleReactivated = false;
  player.ropeJumpOverlapIncreased = false;
  player.ropeJumpBudgetException = false;
  player.ropeJumpBudgetExceptionClass = null;
  player._landingTrace = null;
  player._offensiveAerialTrace = null;

  if (preserveContactOutcome) {
    player.offensiveAerial = priorOa;
    if (
      priorOa.cleanupStage === OFFENSIVE_AERIAL_CLEANUP_STAGE.NONE ||
      priorOa.cleanupStage === OFFENSIVE_AERIAL_CLEANUP_STAGE.CONTACT_CONSUMED
    ) {
      // Parry path grounds immediately; hit path continues flight until land —
      // clearAll on the attacker for HIT is unusual; keep CONTACT_CONSUMED.
      markOffensiveAerialCleanupStage(
        player,
        priorOa.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
          ? OFFENSIVE_AERIAL_CLEANUP_STAGE.AIRBORNE_INTERRUPTED
          : OFFENSIVE_AERIAL_CLEANUP_STAGE.CONTACT_CONSUMED,
        { debugReason: "clearAllActionStates_preserve" }
      );
    }
    // Legacy parry clearAll grounds; do not keep a live V2 recoil record.
    resetOffensiveAerialReaction(player);
  } else if (shouldRecordInterrupt) {
    player.offensiveAerial = priorOa;
    const interruptId = priorOa.attackInstanceId;
    resetOffensiveAerialActivation(player, {
      recordInterrupted: true,
      debugReason: "clearAllActionStates_interrupt",
    });
    resetOffensiveAerialReaction(player);
    if (isOffensiveAerialReactionV2Enabled() && interruptId) {
      beginOffensiveAerialReaction(
        player,
        OFFENSIVE_AERIAL_REACTION.INTERRUPTED_FALL,
        {
          force: true,
          attackInstanceId: interruptId,
          debugReason: "clearAll_interrupted_fall",
        }
      );
    }
  } else {
    resetOffensiveAerialActivation(player, {
      debugReason: "clearAllActionStates",
    });
    resetOffensiveAerialReaction(player);
  }

  // Clear flap states. Only reachable while grounded (startup is the only
  // interruptible flap phase — flight is hit-immune), so no airborne Y is
  // stranded here; the hit-fall systems own Y from this point.
  player.isFlapping = false;
  player.flapPhase = null;
  player.flapCharges = 0;
  player.flapVelocityY = 0;
  player.flapVelocityX = 0;
  player.flapStartTime = 0;
  player.flapWingBeatTime = 0;
  player.flapFastFalling = false;
  player.flapDiveCommitted = false;
  player.flapDiveLockX = 0;
  player.flapBeatHDir = 0;
  player.flapHitLanded = false;
  player.flapHitLandStartY = 0;
  player.flapHitLandStartX = 0;
  player.flapHitLandTargetX = 0;
  player.flapHitRecoverDuration = 0;
  player.lastFlapChargeTime = 0;
}

function clearSlideJumpState(player, opts = {}) {
  // Stale-owner: delayed recovery cleanup must not wipe a newer activation.
  if (
    opts.expectedInstanceId != null &&
    !canCleanupOffensiveAerialInstance(player, opts.expectedInstanceId, {
      reason: "clearSlideJumpState",
    })
  ) {
    return false;
  }

  player.isSlideJumping = false;
  player.slideJumpPhase = null;
  player.slideJumpVelocityY = 0;
  player.slideJumpVelocityX = 0;
  player.slideJumpDiveCommitted = false;
  player.slideJumpDiveBuffered = false;
  player.slideJumpDiveBufferUntil = 0;
  player.slideJumpFastFalling = false;
  player.slideJumpDiveLockX = 0;
  player.slideJumpHitLanded = false;
  player.slideJumpHitRecoverDuration = 0;
  player.slideJumpLandingTime = 0;
  player.slideJumpLandSlamImmuneUntil = 0;
  player.slideJumpStartTime = 0;
  player.slideJumpBufferUntil = 0;
  player.slideJumpLandSlideQueued = false;
  player.slideJumpHasFlap = false;
  player.slideJumpFlapFlightActive = false;
  // Charge / wing-beat / H-burst fields shared with FLAP flight mode.
  player.flapCharges = 0;
  player.flapWingBeatTime = 0;
  player.flapBeatHDir = 0;
  player.flapVelocityX = 0;
  player.lastFlapChargeTime = 0;

  // Recovery-complete finalizes the outcome record (idempotent).
  if (opts.finalizeOutcome !== false) {
    finalizeOffensiveAerialActivation(player, {
      expectedInstanceId: opts.expectedInstanceId,
      debugReason: opts.debugReason || "clearSlideJumpState",
    });
    completeOffensiveAerialReaction(player, {
      expectedInstanceId: opts.expectedInstanceId,
    });
  }

  // Facing lock release is instance-gated (except force paths).
  if (opts.forceFacingClear) {
    forceClearOffensiveAerialFacingLock(player, {
      reason: opts.debugReason || FACING_RELEASE.FULL_RESET,
    });
  } else {
    releaseOffensiveAerialFacingLock(player, {
      expectedInstanceId: opts.expectedInstanceId,
      reason: opts.debugReason || FACING_RELEASE.RECOVERY_COMPLETE,
    });
  }
  clearOffensiveAerialPresentation(player);
  return true;
}

function clearIceSlideState(player) {
  player.isIceSliding = false;
  player.iceSlideDir = 0;
  player.iceSlideStartTime = 0;
  player.iceSlideCarrySpeed = 0;
  player.slideJumpBufferUntil = 0;
  player.slideJumpLandSlideQueued = false;
  player.isIceSlideReverseHopping = false;
  player.iceSlideReverseHopStartTime = 0;
  player.iceSlideReverseHopUntil = 0;
  player.iceSlideReverseBufferUntil = 0;
  player.iceSlideBrakeArmStart = 0;
  // Keep reverse cooldown across a brief re-entry so repress can't chain-abuse
  // by exiting/re-entering slide mid-spam.
}

/**
 * Shared grab-attempt entry (human / buffer / CPU).
 * Clears ice slide (slap clears it via isAttacking — grab previously left it
 * live, so slide physics + sliding art "ate" the attempt). Approach speed still
 * inherits slide/dodge momentum for the post-connect burst push; the attempt
 * lunge itself stays a fixed distance so grab range doesn't scale with speed.
 */
function beginGrabStartup(player, room) {
  if (!player) return;

  const now = simNowForPlayer(player);
  const entryVel = player.movementVelocity || 0;

  // Grab-start M2 must not later complete a throw/pull chord on connect.
  player.clinchMouse2BufferTime = 0;
  player.clinchWTapTime = 0;
  player.clinchAwayTapTime = 0;

  // Slap clears ice slide the instant isAttacking latches; grab must do the
  // same explicitly — isGrabStartup was never on the ice-slide interrupt list.
  // Captured first: while sliding, W belongs to slide-jump, so a slide-grab is
  // never a Throw (see resolveGrabVariant's forbidThrow).
  const wasIceSliding = !!player.isIceSliding;
  clearIceSlideState(player);

  clearChargeState(player, true);

  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;

  // Refresh Thick Blubber absorb at the START of every grab attempt.
  player.hitAbsorptionUsed = false;
  player.lastGrabAttemptTime = now;

  player.isGrabStartup = true;
  player.grabStartupStartTime = now;
  player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
  player.grabStartupArmorUsed = false;
  player.currentAction = "grab_startup";
  player.actionLockUntil = now + GRAB_STARTUP_DURATION_MS;
  player.grabState = GRAB_STATES.ATTEMPTING;
  player.grabAttemptType = "grab";

  logVerbInitiation(room, player, "grab", entryVel);

  // Face the opponent so the lunge commits toward them (mirrors slap).
  const grabOpponent =
    room && Array.isArray(room.players)
      ? room.players.find((p) => p.id !== player.id)
      : null;
  if (grabOpponent && player.atTheRopesFacingDirection == null) {
    player.facing = player.x < grabOpponent.x ? -1 : 1;
  }

  // Shove off into the dive. This is the whole move's movement — one impulse,
  // after which friction owns the trajectory, so the grab keeps travelling through
  // its active frames and skids out through the whiff. Set after facing resolves,
  // because the direction of the dive is the direction we just committed to.
  player.grabMovementVelocity = -player.facing * getGrabLungeImpulse();

  // COMMAND GRAB: which grab this is gets decided here from the direction around
  // the M2 edge, and stays revisable until the grab goes active. Harmless with
  stampGrabVariant(player, grabOpponent, now, wasIceSliding);
  if (isActionFacingOwnershipV2Enabled()) {
    const grabId = mintActionFacingInstanceId(
      player,
      ACTION_FACING_OWNER.GRAB_STARTUP
    );
    player.grabFacingInstanceId = grabId;
    acquireActionFacingLock(player, {
      ownerType: ACTION_FACING_OWNER.GRAB_STARTUP,
      ownerInstanceId: grabId,
      direction: player.facing,
      reason: ACTION_FACING_REASON.COMMIT,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
  }

  // Inherit slide/dodge speed for clinch burst only — not for attempt range.
  let approachVel = entryVel;
  if (MASTERY_P1_MOMENTUM) {
    approachVel = takeInheritedVelocity(player, entryVel, now);
  }
  player.grabApproachSpeed = Math.abs(approachVel);

  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isBraking = false;
  player.isPowerSliding = false;
}

/** Fire ice-slide bunny-hop reverse if dig + repress conditions are met. */
function tryIceSlideReverse(player, nowSim) {
  if (
    !player ||
    !player.isIceSliding ||
    player.isSlideJumping ||
    player.isDodging ||
    player.isHit ||
    player.isIceSlideReverseHopping
  ) {
    return false;
  }
  const cooldownReady =
    !player.iceSlideReverseCooldownUntil ||
    nowSim >= player.iceSlideReverseCooldownUntil;
  if (!cooldownReady) return false;

  const slideDir =
    player.iceSlideDir || (player.movementVelocity >= 0 ? 1 : -1);
  const holdingLeft = player.keys.a && !player.keys.d;
  const holdingRight = player.keys.d && !player.keys.a;
  const holdingAgainst =
    (slideDir > 0 && holdingLeft) || (slideDir < 0 && holdingRight);
  if (!holdingAgainst) return false;

  const speed = Math.abs(player.movementVelocity || 0);
  const brakeArmed =
    player.iceSlideBrakeArmStart &&
    nowSim - player.iceSlideBrakeArmStart >= ICE_SLIDE_BRAKE_ARM_MS;
  // Opposite dig is the skill tax. Speed is a soft alternate gate for a quick dig.
  if (!brakeArmed && speed > ICE_SLIDE_REVERSE_SPEED_MAX) return false;

  const newDir = holdingLeft ? -1 : 1;
  player.iceSlideDir = newDir;
  player.movementVelocity = newDir * ICE_SLIDE_REVERSE_BURST;
  player.isBraking = false;
  player.isStrafing = false;
  // Facing stays opponent-facing (facingSystem). Slide travel is iceSlideDir.
  player.isIceSlideReverseHopping = true;
  player.iceSlideReverseHopStartTime = nowSim;
  player.iceSlideReverseHopUntil = nowSim + ICE_SLIDE_REVERSE_HOP_MS;
  player.iceSlideReverseCooldownUntil = nowSim + ICE_SLIDE_REVERSE_COOLDOWN_MS;
  player.iceSlideReverseBufferUntil = 0;
  player.iceSlideBrakeArmStart = 0;
  // Fresh slide clock so the post-reverse jump isn't starved by brake time.
  player.iceSlideStartTime = nowSim;
  applyRopeKickoff(player, newDir, nowSim);
  stampIceSlideCarrySpeed(player);
  return true;
}

/**
 * Redirect bunny-hop invuln — strikes AND grabs. Hop window only.
 * A grab that is in range during this hop whiffs immediately (punishable).
 */
function isInSlideRedirectIFrames(player, nowSim) {
  if (!player || !player.isIceSlideReverseHopping) return false;
  const until = player.iceSlideReverseHopUntil || 0;
  if (!until) return false;
  const t = typeof nowSim === "number" ? nowSim : simNowForPlayer(player);
  return t < until;
}

/** Slide / redirect off the near rope, toward center. */
function isRopeKickoffEligible(x, dir) {
  if (typeof x !== "number" || !dir) return false;
  if (dir > 0) return x - MAP_LEFT_BOUNDARY <= ROPE_KICKOFF_ZONE;
  if (dir < 0) return MAP_RIGHT_BOUNDARY - x <= ROPE_KICKOFF_ZONE;
  return false;
}

/**
 * Snap to full slide speed and stamp a client FX id.
 * Returns true when the kick-off fired.
 * `originX` is the launch point (dodge start on the straw) — land X is already
 * a hop inward and must not be the only sample.
 */
function applyRopeKickoff(player, dir, nowSim, originX) {
  if (!player) return false;
  const atRope =
    isRopeKickoffEligible(player.x, dir) ||
    isRopeKickoffEligible(originX, dir);
  if (!atRope) return false;
  const slideDir = dir > 0 ? 1 : -1;
  player.movementVelocity = slideDir * ICE_SLIDE_MAX_SPEED;
  player.iceSlideCarrySpeed = ICE_SLIDE_MAX_SPEED;
  player.ropeKickoffFxId = (player.ropeKickoffFxId || 0) + 1;
  if (nowSim != null && MASTERY_P1_MOMENTUM) {
    stampMomentumWindow(player, player.movementVelocity, nowSim);
  }
  return true;
}

function beginIceSlide(player, dir, velocity, nowSim, opts = {}) {
  const slideDir = dir > 0 ? 1 : dir < 0 ? -1 : 0;
  if (!player || !slideDir) return { ok: false, ropeKickoff: false };
  player.isIceSliding = true;
  player.iceSlideDir = slideDir;
  player.iceSlideStartTime = nowSim;
  player.slideJumpBufferUntil = 0;
  player.isBraking = false;
  player.isStrafing = false;
  if (typeof velocity === "number") {
    player.movementVelocity = velocity;
  }
  const ropeKickoff = applyRopeKickoff(
    player,
    slideDir,
    nowSim,
    opts.kickoffOriginX
  );
  if (
    opts.stampMomentum !== false &&
    !ropeKickoff &&
    MASTERY_P1_MOMENTUM
  ) {
    stampMomentumWindow(player, player.movementVelocity, nowSim);
  }
  stampIceSlideCarrySpeed(player);
  return { ok: true, ropeKickoff };
}

const ICE_SLIDE_CARRY_STAMP_EPS = 0.2;

/** Remember real slide speed so a pocket pushbox zero cannot starve W takeoff. */
function stampIceSlideCarrySpeed(player) {
  if (!player?.isIceSliding) return;
  const speed = Math.abs(player.movementVelocity || 0);
  if (speed > ICE_SLIDE_CARRY_STAMP_EPS) {
    player.iceSlideCarrySpeed = speed;
  }
}

function slideJumpTakeoffSourceSpeed(player) {
  const live = Math.abs(player?.movementVelocity || 0);
  // Live slide wins. Carry is only the pocket-zero fallback — never a peak
  // from a kick-off you were only in for a tick.
  if (live > ICE_SLIDE_CARRY_STAMP_EPS) return live;
  const carry = player?.isIceSliding
    ? Math.abs(player.iceSlideCarrySpeed || 0)
    : 0;
  return Math.max(live, carry);
}

function slideJumpUnbuffedMaxTakeoffH() {
  const icePx =
    (1000 / TICK_RATE) * speedFactor * ICE_SLIDE_MAX_SPEED;
  return SLIDE_JUMP_H_MIN + icePx * SLIDE_JUMP_H_CARRY;
}

/** Ice-slide displacement per tick, including Happy Feet / basho speed. */
function iceSlidePxPerTick(player, movementVelocity) {
  const speed = Math.abs(
    typeof movementVelocity === "number"
      ? movementVelocity
      : player?.movementVelocity || 0
  );
  return (
    (1000 / TICK_RATE) *
    speedFactor *
    getEffectiveMoveSpeedMult(player) *
    speed
  );
}

/**
 * Max air H. Unbuffed kick-off takeoff is the travel we like. First Happy
 * Feet does not buy a longer jump. Extra stacks may add a little leftover.
 */
function slideJumpTakeoffHCap(player) {
  const base = slideJumpUnbuffedMaxTakeoffH() * SLIDE_JUMP_H_MAX_MULT;
  const mult = getEffectiveMoveSpeedMult(player);
  const extra = Math.max(0, mult - SLIDE_JUMP_H_STACK_START);
  const span = Math.max(
    1e-6,
    SLIDE_JUMP_H_STACK_FULL_MULT - SLIDE_JUMP_H_STACK_START
  );
  const t = Math.min(1, extra / span);
  return base * (1 + SLIDE_JUMP_H_STACK_HEADROOM * t);
}

/** Air H (px/tick) from the slide you left. Buffed ice is capped — see cap. */
function slideJumpTakeoffHorizontalSpeed(player) {
  const source = slideJumpTakeoffSourceSpeed(player);
  const carried = iceSlidePxPerTick(player, source);
  const h = SLIDE_JUMP_H_MIN + carried * SLIDE_JUMP_H_CARRY;
  return Math.min(h, slideJumpTakeoffHCap(player));
}

/** px/tick (slide-jump / flap H) → movementVelocity, capped at slide max. */
function slideJumpHorizontalToMovementVelocity(player) {
  if (!player) return 0;
  let hPx = player.slideJumpVelocityX || 0;
  if (player.slideJumpFlapFlightActive) {
    hPx += player.flapVelocityX || 0;
  }
  const k =
    (1000 / TICK_RATE) * speedFactor * getEffectiveMoveSpeedMult(player);
  if (!(k > 0)) return 0;
  const v = hPx / k;
  return Math.max(-ICE_SLIDE_MAX_SPEED, Math.min(ICE_SLIDE_MAX_SPEED, v));
}

/**
 * No-slam, no-parry, no-connect land → keep jump H as a slide (ice slide if SHIFT).
 * Slam / hit-landed / parry still plant.
 */
function isSlideJumpContinueSlideLand(player, extras = {}) {
  if (!player) return false;
  if (extras.parryRecoil || isParriedRecoilActive(player)) return false;
  if (extras.isDiveLocked || player.slideJumpDiveCommitted) return false;
  if (player.slideJumpHitLanded) return false;
  if (player.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED) {
    return false;
  }
  return true;
}

function applySlideJumpContinueOnLandDone(player, nowSim) {
  if (!player) return { ropeKickoff: false };
  const vel = player.movementVelocity || 0;
  const queued = !!player.slideJumpLandSlideQueued;
  const holdShift = !!(player.keys && player.keys.shift);
  player.slideJumpLandSlideQueued = false;
  const dir =
    Math.sign(vel) ||
    (player.iceSlideDir > 0 ? 1 : player.iceSlideDir < 0 ? -1 : 0);
  if ((queued || holdShift) && dir) {
    return beginIceSlide(player, dir, vel, nowSim);
  }
  return { ok: true, ropeKickoff: false };
}

function clearHitFall(player) {
  player.isHitFalling = false;
  player.hitFallStartTime = 0;
  player.hitFallStartY = 0;
  player.hitFallVelocityY = 0;
  clearAirHitOverlapEject(player);
}

/**
 * True once the slide-jump has crested — descent, dive, or velY already down.
 * Launch (rising) stays open; everything after the peak is strike-immune.
 */
function isSlideJumpPastPeak(player) {
  if (!player?.isSlideJumping || player.slideJumpPhase !== "flight") {
    return false;
  }
  if (player.slideJumpDiveCommitted || player.slideJumpFastFalling) {
    return true;
  }
  return (player.slideJumpVelocityY || 0) <= 0;
}

/**
 * Slide-jump strike i-frames: post-peak only. Ascent can be stuffed.
 * Parried recoil stays vulnerable. Pass-through (pushbox / tip-sep) is
 * separate — jumping a body is not the same as being unhittable.
 */
function isSlideJumpFlightImmune(player) {
  if (isParriedRecoilActive(player)) return false;
  return isSlideJumpPastPeak(player);
}

/**
 * @deprecated Distance is the anti-follow-up (authored KB + AIR_HIT_KB_BONUS_PX).
 * Kept so old callers compile; always false.
 */
function isAirHitFallStrikeImmune() {
  return false;
}

/**
 * True once the hop is readable enough for S dive (mid-ascent, not peak).
 * Either minimum airtime OR height — normal liftoff clears height first (~6 ticks).
 */
function isSlideJumpDiveEnabled(player, now = 0) {
  if (!player?.isSlideJumping || player.slideJumpPhase !== "flight") {
    return false;
  }
  if (player.slideJumpDiveCommitted) return true;
  const age = now - (player.slideJumpStartTime || 0);
  const height = (player.y || 0) - GROUND_LEVEL;
  return (
    age >= SLIDE_JUMP_DIVE_MIN_AIR_MS || height >= SLIDE_JUMP_DIVE_MIN_HEIGHT
  );
}

/** Latch early S so the dive isn't eaten during the enable lock. */
function bufferSlideJumpDiveInput(player, now = 0) {
  if (!player?.isSlideJumping || player.slideJumpPhase !== "flight") return;
  if (player.slideJumpDiveCommitted) return;
  player.slideJumpDiveBuffered = true;
  player.slideJumpDiveBufferUntil = now + SLIDE_JUMP_DIVE_BUFFER_MS;
}

/** True if a buffered / held S should commit this tick. */
function shouldCommitSlideJumpDive(player, now = 0) {
  if (!player?.isSlideJumping || player.slideJumpPhase !== "flight") {
    return false;
  }
  if (player.slideJumpDiveCommitted) return false;
  if (player.keys?.s) {
    bufferSlideJumpDiveInput(player, now);
  }
  const bufferLive =
    !!player.slideJumpDiveBuffered &&
    (!player.slideJumpDiveBufferUntil ||
      now <= player.slideJumpDiveBufferUntil);
  if (!bufferLive) {
    player.slideJumpDiveBuffered = false;
    return false;
  }
  return isSlideJumpDiveEnabled(player, now);
}

/** Prior vertical velocity to carry into an air-hit fall (call BEFORE clearAllActionStates). */
function captureAirVerticalVelocity(player) {
  if (!player) return 0;
  if (player.isHitFalling && typeof player.hitFallVelocityY === "number") {
    return player.hitFallVelocityY;
  }
  if (player.isSlideJumping) return player.slideJumpVelocityY || 0;
  if (player.isFlapping) return player.flapVelocityY || 0;
  if (player.knockbackVelocity && typeof player.knockbackVelocity.y === "number") {
    return player.knockbackVelocity.y;
  }
  return 0;
}

/** Prior horizontal air travel in px/tick (call BEFORE clearAllActionStates). */
function captureAirHorizontalVelocity(player) {
  if (!player) return 0;
  if (player.isSlideJumping) {
    if (player.slideJumpFlapFlightActive && player.flapVelocityX) {
      return player.flapVelocityX;
    }
    return player.slideJumpVelocityX || 0;
  }
  if (player.isFlapping) return player.flapVelocityX || 0;
  return 0;
}

/**
 * Anti-air send: whatever the strike already wrote + a fixed extra shove.
 * That extra is the punishment — not a silent hurtbox, not an eject channel.
 */
function applyAirHitKnockbackBoost(player, _airCarryX = 0, attacker = null) {
  if (!player) return;
  if (!player.knockbackVelocity) {
    player.knockbackVelocity = { x: 0, y: 0 };
  }
  let dir = Math.sign(player.knockbackVelocity.x);
  if (!dir && attacker && typeof attacker.x === "number") {
    const dx = (player.x || 0) - attacker.x;
    dir = dx > 0 ? 1 : dx < 0 ? -1 : attacker.facing === 1 ? -1 : 1;
  }
  if (!dir) dir = 1;
  player.knockbackVelocity.x += dir * pxToKbVelocity(AIR_HIT_KB_BONUS_PX);
}

/**
 * Start the anti-air fall. Kill rise — no pop. Gravity drops them from
 * current height. Horizontal travel is authored KB + AIR_HIT_KB_BONUS_PX
 * (applied by the caller before this). No overlap eject.
 */
function beginAirHitFall(player, {
  now = 0,
  carryVelY = 0,
} = {}) {
  if (!player || !(player.y > GROUND_LEVEL)) return false;

  clearSidestepHitReturn(player);

  // Interrupt the jump. Keep only leftover downward speed; never invert
  // into a dump and never add an upward pop.
  let velY = carryVelY < 0 ? carryVelY : 0;
  if (velY < -HIT_FALL_MAX_FALL_SPEED) velY = -HIT_FALL_MAX_FALL_SPEED;

  player.isHitFalling = true;
  player.hitFallStartTime = now;
  player.hitFallStartY = player.y;
  player.hitFallVelocityY = velY;
  player.isRecovering = false;
  player.isJumping = false;
  syncOffensiveAerialPresentation(player);
  return true;
}

/**
 * Hitstun end. If still dumping from an air hit, keep horizontal KB alive so
 * the shove isn't cut short mid-air. Grounded hits hand off to ice coast.
 */
function endHitKnockback(player) {
  if (!player) return;
  if (player.isHitFalling && Math.abs(player.knockbackVelocity?.x || 0) > 0.01) {
    player.isHit = false;
    if (isActionFacingOwnershipV2Enabled()) {
      releaseActionFacingLock(player, {
        expectedInstanceId: player.hitstunFacingInstanceId,
        expectedOwnerType: ACTION_FACING_OWNER.HITSTUN,
        reason: ACTION_FACING_RELEASE.RECOVERY_COMPLETE,
        clearLegacy: false,
      });
      player.hitstunFacingInstanceId = null;
    }
    return;
  }
  if (Math.abs(player.knockbackVelocity?.x || 0) > 0.01) {
    // DISTANCE-PRESERVING HANDOFF. This used to assign the leftover knockback
    // velocity straight across. Because the coast channel decays ~4x slower
    // than the knockback channel it came from, that residual silently
    // travelled ~3.9x further than it had left to run — most of why a passive
    // victim ate 385px from a palm thrust while a braking one ate 107px.
    // Scaling by the friction ratio makes the glide carry exactly the distance
    // the shove still owed, so an authored number stays the number.
    player.movementVelocity = handoffVelocity(player.knockbackVelocity.x);
  }
  player.knockbackVelocity.x = 0;
  player.isHit = false;
  player.isSlapKnockback = false;
  player.slapKnockbackCanRingOut = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
  player.isChargedKnockback = false;
  player.chargedKnockbackCanRingOut = false;
  if (isActionFacingOwnershipV2Enabled()) {
    releaseActionFacingLock(player, {
      expectedInstanceId: player.hitstunFacingInstanceId,
      expectedOwnerType: ACTION_FACING_OWNER.HITSTUN,
      reason: ACTION_FACING_RELEASE.RECOVERY_COMPLETE,
      clearLegacy: false,
    });
    player.hitstunFacingInstanceId = null;
  }
}

/** Touchdown from air-hit arc — hand residual KB to ice coast. */
function finishAirHitFallLanding(player) {
  if (!player) return;
  const residual = player.knockbackVelocity?.x || 0;
  if (player.isHit && Math.abs(residual) > 0.01) {
    // Still in hitstun. X is integrated from knockbackVelocity while isHit;
    // movementVelocity is ignored. Keep the shove on the KB channel so a
    // low air connect (dodge hop / reverse hop / short W) does not freeze
    // them on touchdown until the stun timer pops.
    player.isRecovering = false;
    resetOffensiveAerialReaction(player);
    clearHitFall(player);
    syncOffensiveAerialPresentation(player);
    return;
  }
  if (Math.abs(residual) > 0.01) {
    // Same distance-preserving conversion as endHitKnockback.
    player.movementVelocity = handoffVelocity(residual);
  }
  player.knockbackVelocity.x = 0;
  player.isSlapKnockback = false;
  player.slapKnockbackCanRingOut = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
  player.isChargedKnockback = false;
  player.chargedKnockbackCanRingOut = false;
  player.isRecovering = false;
  resetOffensiveAerialReaction(player);
  clearHitFall(player);
  syncOffensiveAerialPresentation(player);
}

function clearSidestepHitReturn(player) {
  player.isSidestepHitReturn = false;
  player.sidestepHitReturnStartTime = 0;
  player.sidestepHitReturnStartY = 0;
  player.sidestepHitReturnDuration = 0;
}

function isWithinMapBoundaries(
  x,
  leftBoundary = MAP_LEFT_BOUNDARY,
  rightBoundary = MAP_RIGHT_BOUNDARY
) {
  return x >= leftBoundary && x <= rightBoundary;
}

function constrainToMapBoundaries(
  x,
  leftBoundary = MAP_LEFT_BOUNDARY,
  rightBoundary = MAP_RIGHT_BOUNDARY
) {
  return Math.max(leftBoundary, Math.min(x, rightBoundary));
}

function startCharging(player) {
  // NOTE: Charging does NOT cancel power slide - only the released attack does
  // This allows players to charge while sliding for aggressive plays
  
  player.isChargingAttack = true;
  // chargeStartTime lives on the sim clock: charge progress pauses during
  // hitstop along with everything else (read in index.js charge tick).
  const nowSim = simNowForPlayer(player);
  if (player.chargeAttackPower > 0) {
    // TAP-style resume: backdate chargeStartTime so the continuous charge formula picks up
    // from the preserved power level
    player.chargeStartTime = nowSim - (player.chargeAttackPower / 100 * CHARGE_FULL_POWER_MS);
  } else if (!player.chargeStartTime) {
    player.chargeStartTime = nowSim;
    player.chargeAttackPower = 1;
  }
  player.attackType = "charged";
}

function canPlayerSlap(player, { ignoreCooldown = false } = {}) {
  // Both deadlines live on the sim clock (pause during hitstop).
  const isOnCooldown = !ignoreCooldown && player.attackCooldownUntil && simNowForPlayer(player) < player.attackCooldownUntil;
  const isActionLocked = player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil;
  
  return (
    isPlayerInBasicActiveState(player) &&
    !player.isRopeJumping &&
    !player.isFlapping &&
    !player.flapPhase &&
    !player.isSlideJumping &&
    !player.canMoveToReady &&
    !player.isRecovering &&
    !isOnCooldown &&
    !isActionLocked
  );
}

// Clear charging state. When cancelled by another action (isCancelled=true),
// always zero charge power. Otherwise preserve power if mouse1 is still held.
function clearChargeState(player, isCancelled = false) {
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  if (isCancelled || !(player.keys && player.keys.mouse1)) {
    player.chargeAttackPower = 0;
  }
  if (isActionFacingOwnershipV2Enabled()) {
    const lock = getActionFacingLock(player);
    if (lock && lock.ownerType === ACTION_FACING_OWNER.CHARGE_HOLD) {
      releaseActionFacingLock(player, {
        expectedInstanceId: player.chargeFacingInstanceId,
        expectedOwnerType: ACTION_FACING_OWNER.CHARGE_HOLD,
        reason: isCancelled
          ? ACTION_FACING_RELEASE.INTERRUPT
          : ACTION_FACING_RELEASE.ACTION_END,
        clearLegacy: false,
      });
      player.chargeFacingInstanceId = null;
    }
  }
  player.chargingFacingDirection = null;
  player.spacebarReleasedDuringDodge = false;

  if (isCancelled) {
    player.chargeCancelled = true;
    // Managed + named so resets can cancel it, and so it pauses with the sim
    // like every other timer (was a raw setTimeout that bypassed the manager).
    setPlayerTimeout(player.id, () => {
      if (player.chargeCancelled) {
        player.chargeCancelled = false;
      }
    }, 100, "chargeCancelledClear");
  }
}

// Tear down any in-flight or deferred slap work so a flap liftoff can't leave
// timers/buffers that re-arm isSlapAttack once isFlapping drops (the root cause
// of slap-hands VFX bleeding into / after flap).
function cancelPendingSlapWork(player) {
  timeoutManager.clearPlayerSpecific(player.id, "slapCycle");
  // Phase 15 — named slap startup (legacy path leaves it unnamed / uncleared).
  if (isActionLifecycleOwnershipV2Enabled()) {
    timeoutManager.clearPlayerSpecific(player.id, "slapStartupEnd");
  }
  player.slapCycleEndCallback = null;

  player.pendingSlapCount = 0;
  player.pendingSlapPressTime = 0;
  player.pendingPalmThrust = false;
  // MASTERY Phase 3: a flap (or other teardown) ends the tsuppari string.
  player.isEnhancedSlap = false;
  player.cadenceChain = 0;
  player.currentSlapHitConnected = false;
  player.slapOpenHitPending = false;
  player.currentLowKickHitConnected = false;
  player.isSlapSliding = false;
  player.slideSlapArmed = false;
  player.slapFacingDirection = null;
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.slapActiveEndTime = 0;
  player.lowKickActiveEndTime = 0;
  timeoutManager.clearPlayerSpecific(player.id, "lowKickCycle");
  player.isLowKick = false;

  if (player.inputBuffer && (player.inputBuffer.type === "slap" || player.inputBuffer.type === "lowKick")) {
    player.inputBuffer = null;
  }
}

// ── FLAP: slide-jump air charges (no standalone liftoff / no parry swap) ──
/** FLAP power-up or BASHO movement loadout — arms slide-jump with air charges. */
function playerHasFlap(player) {
  return (
    !!player &&
    (player.activePowerUp === POWER_UP_TYPES.FLAP || !!player.loadout?.hasFlap)
  );
}

/**
 * On FLAP-armed slide-jump takeoff: pay stamina and grant a fresh charge bank.
 * Does not alter slide-jump physics. Returns false if gassed (jump still happens
 * elsewhere without charges). Air flaps themselves are free.
 */
function armSlideJumpFlapCharges(player, now) {
  if (!playerHasFlap(player) || player.isGassed) {
    player.slideJumpHasFlap = false;
    player.flapCharges = 0;
    return false;
  }
  player.stamina = Math.max(0, player.stamina - FLAP_STAMINA_COST);
  tryEnterGassed(player, now);
  player.slideJumpHasFlap = true;
  player.flapCharges = FLAP_CHARGES;
  player.lastFlapChargeTime = 0;
  player.flapWingBeatTime = 0;
  player.flapBeatHDir = 0;
  return true;
}

/** @deprecated Standalone flap liftoff removed — FLAP is slide-jump charges only. */
function beginFlapStartup(_player, _now) {
  return false;
}


// Centralized action lock helpers to prevent simultaneous actions during input mashing
function isActionLocked(player) {
  return !!player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil;
}

function beginAction(player, actionName, lockDurationMs) {
  // Guard against invalid durations
  const duration = Math.max(0, Number(lockDurationMs || 0));
  player.currentAction = actionName || null;
  if (duration > 0) {
    player.actionLockUntil = simNowForPlayer(player) + duration;
  } else {
    player.actionLockUntil = 0;
  }
}

// Check if player is outside the dohyo boundaries (horizontal only)
function isOutsideDohyo(x, y) {
  return (
    x < DOHYO_LEFT_BOUNDARY ||
    x > DOHYO_RIGHT_BOUNDARY
  );
}

function clampStaminaValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

/**
 * Enter the gassed state when stamina has reached 0.
 * Call this at the moment of drain (action cost, guard crush, etc.) and again
 * before any regen pulse so a refill can never rescue a zero-stamina tick.
 * Returns true if the fighter newly entered gassed.
 */
function tryEnterGassed(player, now) {
  if (!player || player.isGassed || player.stamina > 0) return false;
  player.isGassed = true;
  player.gassedUntil = now + GASSED_DURATION_MS;
  player.stamina = 0;
  player.staminaRegenAccum = 0;
  return true;
}

/**
 * Apply posture (balance) damage and stamp the Halo regen delay.
 * ANY positive posture loss must go through here so regen stops / the 1.75s
 * delay restarts. Returns the amount actually removed (after floor at 0).
 */
function applyBalanceDamage(player, amount, simTime) {
  if (!player || !(amount > 0)) return 0;
  const before =
    typeof player.balance === "number" ? player.balance : 0;
  const next = Math.max(0, before - amount);
  const dealt = before - next;
  if (dealt > 0) {
    player.balance = next;
    if (typeof simTime === "number") {
      player.lastPostureDamageTime = simTime;
    }
  }
  return dealt;
}

// Socket.io instance for "OUT OF STAMINA" feedback (injected from index.js).
let staminaBlockedIo = null;

function setStaminaBlockedIo(io) {
  staminaBlockedIo = io;
}

/**
 * Throttled "not enough stamina" cue for actions hard-locked while gassed.
 * Call at every intentional press / buffer consume that fails because isGassed.
 * Returns true if the event was emitted.
 */
function emitStaminaBlocked(player, action, io = null) {
  const socketIo = io || staminaBlockedIo;
  if (!player || !socketIo || player.isCPU) return false;
  const now = simNowForPlayer(player);
  if (
    player.lastStaminaBlockedTime &&
    now - player.lastStaminaBlockedTime <= 500
  ) {
    return false;
  }
  player.lastStaminaBlockedTime = now;
  socketIo.to(player.id).emit("stamina_blocked", {
    playerId: player.id,
    action: action || "action",
  });
  return true;
}

function isNearDohyoEdge(playerX) {
  const leftEdgeDistance = playerX - MAP_LEFT_BOUNDARY;
  const rightEdgeDistance = MAP_RIGHT_BOUNDARY - playerX;
  return Math.min(leftEdgeDistance, rightEdgeDistance) < DOHYO_EDGE_PANIC_ZONE;
}

function getEdgeProximity(playerX) {
  const leftEdgeDistance = playerX - MAP_LEFT_BOUNDARY;
  const rightEdgeDistance = MAP_RIGHT_BOUNDARY - playerX;
  const nearestEdge = Math.min(leftEdgeDistance, rightEdgeDistance);
  return Math.max(0, 1 - (nearestEdge / DOHYO_EDGE_PANIC_ZONE));
}

// ignoreInputs: when true (e.g. during a committed slap slide), movement keys are
// disregarded entirely so the slide coasts identically regardless of what's held.
function getIceFriction(player, isActiveBraking, nearEdge, edgeProximity, ignoreInputs = false) {
  if (player.isPowerSliding) {
    if (isActiveBraking) {
      let friction = SLIDE_BRAKE_FRICTION;
      if (nearEdge) friction -= ICE_EDGE_BRAKE_BONUS * edgeProximity;
      return friction;
    }
    return SLIDE_FRICTION;
  }
  
  if (!ignoreInputs && isActiveBraking) {
    let friction = ICE_BRAKE_FRICTION;
    if (nearEdge) {
      friction -= ICE_EDGE_BRAKE_BONUS * edgeProximity;
    }
    return friction;
  } else if (!ignoreInputs && (player.keys.a || player.keys.d)) {
    return ICE_MOVING_FRICTION;
  } else {
    let friction = ICE_COAST_FRICTION;
    if (nearEdge) {
      friction += ICE_EDGE_SLIDE_PENALTY * edgeProximity;
    }
    return friction;
  }
}

function canApplyKnockback(player) {
  return !player.knockbackImmune || simNowForPlayer(player) >= player.knockbackImmuneEndTime;
}

function setKnockbackImmunity(player) {
  player.knockbackImmune = true;
  player.knockbackImmuneEndTime = simNowForPlayer(player) + KNOCKBACK_IMMUNITY_DURATION;
}

// One authoritative sim-time deadline for the palm-thrust strike sprite. Every
// code path that extends/clears isPalmThrust should go through this so ring-out
// wins, hitstop, and on-hit recovery can't fight each other.
function schedulePalmThrustVisualEnd(player, visualUntilSimTime) {
  player.palmThrustVisualUntil = Math.max(
    player.palmThrustVisualUntil || 0,
    visualUntilSimTime
  );
  const now = simNowForPlayer(player);
  const delay = Math.max(0, player.palmThrustVisualUntil - now);
  timeoutManager.clearPlayerSpecific(player.id, "palmThrustVisualEnd");
  setPlayerTimeout(
    player.id,
    () => {
      player.isPalmThrust = false;
      player.palmThrustVisualUntil = 0;
    },
    delay,
    "palmThrustVisualEnd"
  );
}

// Charged freeze scales burst-floor → heavy special (never below palm burst).
function getChargedHitstop(chargePower) {
  const normalizedPower = Math.max(0, Math.min(1, (chargePower - 0.3) / 0.7));
  return HITSTOP_CHARGED_MIN_MS + (HITSTOP_CHARGED_MAX_MS - HITSTOP_CHARGED_MIN_MS) * normalizedPower;
}

// Hitstop is tracked on the MONOTONIC clock (gameNow), not Date.now(), so an
// NTP wall-clock correction can never stretch or swallow a freeze. It must
// also not use simTime — simTime is the thing that pauses DURING hitstop, so
// the freeze's own duration has to be measured on a clock that keeps running.
function triggerHitstop(room, durationMs) {
  const target = gameNow() + durationMs;
  room.hitstopUntil = Math.max(room.hitstopUntil || 0, target);
}

// Companion wrapper that triggers server-side hitstop AND emits a `hitstop`
// event carrying a server-clock timestamp. Clients use it (with a known clock
// offset from the time_sync handshake) to schedule their visual freeze to
// start at the SAME server-clock moment, eliminating the per-client drift
// that comes from the state stream pausing at staggered packet-arrival times.
//
// The sim model is unchanged — this is purely a display-alignment companion.
// Use `gameNow()` (monotonic) for `startsAt` so client offset math is stable
// across NTP corrections on the server host.
function triggerHitstopAndEmit(io, room, durationMs, kind = "hit") {
  triggerHitstop(room, durationMs);
  if (io && room && room.id) {
    io.in(room.id).emit("hitstop", {
      startsAt: gameNow(),
      duration: durationMs,
      kind,
    });
  }
}

function isRoomInHitstop(room) {
  return room.hitstopUntil && gameNow() < room.hitstopUntil;
}

function emitThrottledScreenShake(room, io, shakeData) {
  const now = Date.now();
  if (room.lastScreenShakeTime === undefined) {
    room.lastScreenShakeTime = 0;
  }
  // Presentation-bearing throws must not lose their land event to shake throttle.
  const force =
    !!shakeData?.force ||
    !!(shakeData && shakeData.combatPresentation);
  if (
    !force &&
    now - room.lastScreenShakeTime < SCREEN_SHAKE_MIN_INTERVAL
  ) {
    return;
  }
  room.lastScreenShakeTime = now;
  io.in(room.id).emit("screen_shake", shakeData);
}

function getSidestepInitData(playerX, opponentX) {
  const direction = playerX < opponentX ? 1 : -1;
  return { direction };
}

module.exports = {
  // Constants
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  DOHYO_FALL_DEPTH,

  // Monotonic clock helper
  gameNow,

  // Mastery Phase 1 — momentum inheritance
  alignedEntryVelocity,
  stampMomentumWindow,
  takeInheritedVelocity,

  // Thick Blubber hit absorption (single-slot power-up + BASHO stacked charges)
  hasHitAbsorption,
  consumeHitAbsorption,

  // Pausable simulation clock
  setSimRoomResolver,
  simNow,
  simNowForPlayer,
  logVerbInitiation,
  advanceRoomSimTime,
  getPlayerInputBackdateCapMs,
  resolvePlayerNetRttMs,
  updatePlayerNetEstimate,
  clampTrustedPressGameTime,
  // Exported for clinch/network regression tests (pure; no behavior change).
  lagCompensatedFromPress,
  lagCompensatedParryStart,
  lagCompensatedClinchInputStart,
  lagCompensatedClinchBraceStart,
  canArmAttackParry,
  armAttackParry,
  isAttackParryJust,
  grantAttackParryFlurryCover,
  isAttackParryFlurryLinger,
  isAttackParryPostLocked,
  cancelAttackParryWindow,
  clearAttackParryWindow,
  enterGuard,
  updateAttackParryState,
  wantsMatadorChord,
  canArmMatador,
  armMatador,
  cancelMatadorWindow,
  clearMatadorWindow,
  updateMatadorState,
  // Classes and instances
  TimeoutManager,
  timeoutManager,

  // Functions
  setPlayerTimeout,
  isPlayerInActiveState,
  isPlayerInBasicActiveState,
  canPlayerCharge,
  canPlayerUseAction,
  canPlayerDash,
  beginPlayerDodge,
  isInDodgeStrikeIFrames,
  isInSlideRedirectIFrames,
  isRopeKickoffEligible,
  applyRopeKickoff,
  beginIceSlide,
  iceSlidePxPerTick,
  stampIceSlideCarrySpeed,
  slideJumpTakeoffSourceSpeed,
  slideJumpUnbuffedMaxTakeoffH,
  slideJumpTakeoffHCap,
  slideJumpTakeoffHorizontalSpeed,
  slideJumpHorizontalToMovementVelocity,
  isSlideJumpContinueSlideLand,
  applySlideJumpContinueOnLandDone,
  canPlayerSidestep,
  resetPlayerAttackStates,
  clearAllActionStates,
  playerHasFlap,
  armSlideJumpFlapCharges,
  beginFlapStartup,
  cancelPendingSlapWork,
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  startCharging,
  canPlayerSlap,
  clearChargeState,
  isOutsideDohyo,
  clampStaminaValue,
  tryEnterGassed,
  applyBalanceDamage,
  setStaminaBlockedIo,
  emitStaminaBlocked,
  isNearDohyoEdge,
  getEdgeProximity,
  getIceFriction,
  getEffectiveMoveSpeedMult,
  canApplyKnockback,
  setKnockbackImmunity,
  schedulePalmThrustVisualEnd,
  getChargedHitstop,
  triggerHitstop,
  triggerHitstopAndEmit,
  isRoomInHitstop,
  emitThrottledScreenShake,
  getSidestepInitData,
  clearHitFall,
  clearSidestepHitReturn,
  isSlideJumpPastPeak,
  isSlideJumpFlightImmune,
  isAirHitFallStrikeImmune,
  isSlideJumpDiveEnabled,
  bufferSlideJumpDiveInput,
  shouldCommitSlideJumpDive,
  captureAirVerticalVelocity,
  captureAirHorizontalVelocity,
  applyAirHitKnockbackBoost,
  beginAirHitFall,
  endHitKnockback,
  finishAirHitFallLanding,
  clearSlideJumpState,
  clearIceSlideState,
  tryIceSlideReverse,
  beginGrabStartup,
  clearLifecycleNamedTimeouts,
};

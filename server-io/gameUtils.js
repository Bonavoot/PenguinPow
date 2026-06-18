const {
  SCREEN_SHAKE_MIN_INTERVAL,
  DOHYO_EDGE_PANIC_ZONE,
  SLIDE_BRAKE_FRICTION, SLIDE_FRICTION,
  ICE_EDGE_BRAKE_BONUS, ICE_BRAKE_FRICTION,
  ICE_MOVING_FRICTION, ICE_COAST_FRICTION, ICE_EDGE_SLIDE_PENALTY,
  KNOCKBACK_IMMUNITY_DURATION,
  HITSTOP_CHARGED_MIN_MS, HITSTOP_CHARGED_MAX_MS,
  CHARGE_FULL_POWER_MS,
  DODGE_RECOVERY_MS,
  GROUND_LEVEL,
  SIDESTEP_STARTUP_MS,
  SIDESTEP_RECOVERY_MS,
  SIDESTEP_STAMINA_COST,
  HITBOX_DISTANCE_VALUE,
  MAX_PARRY_BACKDATE_MS,
  FLAP_STARTUP_MS,
  FLAP_CHARGES,
  FLAP_STAMINA_COST,
  GASSED_DURATION_MS,
} = require("./constants");

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
// RAW PARRY LAG-COMPENSATION
// ============================================================
// Returns the sim-clock start time to stamp on a freshly-started raw parry,
// backdated toward the player's TRUE press moment instead of the moment the
// input was drained on the server.
//
// Why: the perfect-parry window (PERFECT_PARRY_WINDOW) is judged as
// `hitTime - rawParryStartTime`. If start time is the packet-arrival time, then
// network latency + the client send-throttle + the server tick phase all get
// baked into that duration — and, worse, they JITTER tick-to-tick, so an
// identically-timed press lands "perfect" one round and "regular" the next.
// That's the clunky, inconsistent feel.
//
// `rawParryPressGameTime` is the press moment expressed on the server's
// monotonic gameNow() clock (reconstructed client-side from the synced clock
// offset, set in socketHandlers when the rising space edge is seen). Its age is
// a real-world duration, so it's valid to subtract from the (pausable) sim
// clock: no hitstop occurs between a parry press and the hit it answers.
//
// Clamped to [0, MAX_PARRY_BACKDATE_MS]: never dates a press into the future,
// never backdates further than the cap. Because more backdate only makes the
// perfect window HARDER to hit, a spoofed offset can do no better than the
// uncompensated (age 0) behavior — so this is exploit-safe by construction.
// Consumes the press stamp so a stale press can't backdate a later parry.
function lagCompensatedParryStart(player, simNowMs) {
  const pressGameTime = player.rawParryPressGameTime || 0;
  player.rawParryPressGameTime = 0;
  if (!pressGameTime) return simNowMs;
  const age = gameNow() - pressGameTime;
  if (!Number.isFinite(age) || age <= 0) return simNowMs;
  const backdate = Math.min(age, MAX_PARRY_BACKDATE_MS);
  return simNowMs - backdate;
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

// Helper functions to reduce code duplication
// CRITICAL: This is the SINGLE SOURCE OF TRUTH for blocking new actions
// Any state where the player is "doing something" must be included here
function isPlayerInActiveState(player) {
  return (
    !player.isAttacking &&
    !player.isRopeJumping &&
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
  player.isSlapAttack = false;
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  // Reset visual clarity timing states
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.isInEndlag = false;
  player.endlagEndTime = 0;
  player.slapActiveEndTime = 0;
  player.chargedActiveEndTime = 0;
  player.attackCooldownUntil = 0;
  player.slapStringPosition = 0;
  player.slapStringWindowUntil = 0;
  player.slapStringCounterLatched = false;
  player.slapStringPunishLatched = false;
  player.slapWhiffCount = 0;
  player.isSlapWhiffPausing = false;
  player.currentSlapHitConnected = false;
  player.pendingGrabEnder = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
}

// === CRITICAL: Clear ALL action states when player loses control ===
// This ensures only ONE state/animation can be active at a time
// Called when: isHit, isBeingGrabbed, isBeingThrown, isRawParryStun, isAtTheRopes
function clearAllActionStates(player) {
  // Clear hit states - prevents conflicting states (e.g., isHit + isBeingGrabbed)
  player.isHit = false;
  player.isAlreadyHit = false;
  player.isSlapKnockback = false;
  player.slapKnockbackCanRingOut = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
  player.isParryKnockback = false;
  
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
  player.isSlapAttack = false;
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  player.pendingSlapCount = 0;
  player.pendingGrabEnder = false;
  player.isSlapSliding = false;
  player.slapStringPosition = 0;
  player.slapStringWindowUntil = 0;
  player.slapStringCounterLatched = false;
  player.slapStringPunishLatched = false;
  player.slapWhiffCount = 0;
  player.isSlapWhiffPausing = false;
  player.currentSlapHitConnected = false;
  player.isBurstKnockback = false;
  player.burstKnockbackStartTime = 0;
  player.mouse1HeldDuringAttack = false;
  player.mouse1BufferedBeforeStart = false;
  player.wantsToRestartCharge = false;
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
  player.grabDecisionMade = false;
  
  // Clear throw states (as thrower)
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.throwingFacingDirection = null;
  
  // Clear parry states (as parrier)
  player.isRawParrying = false;
  player.rawParryStartTime = 0;
  player.rawParryPressGameTime = 0;
  player.rawParryMinDurationMet = false;
  player.isSlapParrying = false;
  player.isRawParryStun = false; // Clear stun state when hit
  player.isRawParrySuccess = false; // Clear parry success animation
  player.isPerfectRawParrySuccess = false;
  
  // Clear movement states
  player.isStrafing = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
  player.movementVelocity = 0;
  // ICE PHYSICS: Clear sliding states
  player.isPowerSliding = false;
  player.isBraking = false;
  player.strafeStartTime = 0;
  player.wasStrafingLeft = false;
  player.wasStrafingRight = false;
  
  // Clear recovery states
  player.isRecovering = false;
  player.recoveryStartTime = 0;
  player.recoveryDuration = 0;
  player.recoveryDirection = null;
  
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

function clearHitFall(player) {
  player.isHitFalling = false;
  player.hitFallStartTime = 0;
  player.hitFallStartY = 0;
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

function shouldRestartCharging(player) {
  // Require explicit intent from the player to restart charging to reduce accidental restarts
  // Mouse1 is now the charge button (hold mouse1 past threshold)
  // IMPORTANT: Always enforce the 200ms threshold to prevent quick taps from triggering charge
  return (
    player.keys.mouse1 &&
    player.mouse1PressTime > 0 &&
    (simNowForPlayer(player) - player.mouse1PressTime) >= 200 &&
    player.wantsToRestartCharge &&
    isPlayerInActiveState(player)
  );
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
  player.wantsToRestartCharge = false;
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
  player.chargingFacingDirection = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  player.mouse1HeldDuringAttack = false;

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
  timeoutManager.clearPlayerSpecific(player.id, "slapWhiffPause");
  timeoutManager.clearPlayerSpecific(player.id, "slapStringReset");
  player.slapCycleEndCallback = null;

  player.pendingSlapCount = 0;
  player.pendingGrabEnder = false;
  player.slapStringPosition = 0;
  player.slapStringWindowUntil = 0;
  player.slapWhiffCount = 0;
  player.isSlapWhiffPausing = false;
  player.currentSlapHitConnected = false;
  player.isSlapSliding = false;
  player.slapFacingDirection = null;
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.slapActiveEndTime = 0;

  if (player.inputBuffer && player.inputBuffer.type === "slap") {
    player.inputBuffer = null;
  }
}

// ── FLAP: begin the grounded liftoff telegraph ───────────────────────────
// Shared by the immediate Space-press path (socketHandlers) and the buffered
// path (gameFunctions.executeInputBuffer) so the two can't drift. Mirrors the
// raw-parry cleanup it replaces: kills movement/charge/slap-string momentum so
// the player commits cleanly to the startup. The flight itself (the liftoff
// impulse) happens when index.js promotes startup → flight; the liftoff is
// FREE (no charge spent), leaving all FLAP_CHARGES air flaps available. Startup
// is interruptible — getting hit here cancels the whole flap.
//
// Returns false WITHOUT mutating state if the player can't afford the liftoff
// (gassed or stamina < cost) so callers can surface the "out of stamina" cue.
function beginFlapStartup(player, now) {
  // Only a fully GASSED wrestler is denied the flap (that's the one case that
  // surfaces "OUT OF STAMINA"). With even 1 stamina the flap still fires; if the
  // cost drains them past empty they simply gas out on takeoff — the global
  // stamina→gassed check in the main loop flips isGassed the moment stamina hits
  // 0, so no special-casing is needed here beyond letting the cost go negative-
  // clamped below.
  if (player.isGassed) {
    return false;
  }

  player.isFlapping = true;
  player.flapPhase = "startup";
  player.flapStartTime = now;
  player.flapCharges = FLAP_CHARGES; // air flaps available once airborne
  player.flapVelocityY = 0;
  player.flapVelocityX = 0;
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
  player.currentAction = "flap";
  player.actionLockUntil = now + FLAP_STARTUP_MS;

  // Liftoff is the ONLY stamina cost — air flaps are free. Flapping on fumes
  // (stamina below the cost) is allowed, but it drains them past empty and gasses
  // them out on takeoff. We set the gassed state EXPLICITLY here rather than
  // leaning on the global stamina→gassed check so a regen tick can't sneak in and
  // refill them above 0 first — the punishment for an empty-tank flap is guaranteed.
  const flappedOnFumes = player.stamina < FLAP_STAMINA_COST;
  player.stamina = Math.max(0, player.stamina - FLAP_STAMINA_COST);
  if (flappedOnFumes) {
    player.isGassed = true;
    player.gassedUntil = now + GASSED_DURATION_MS;
    player.stamina = 0;
  }

  clearChargeState(player, true);
  cancelPendingSlapWork(player);
  player.movementVelocity = 0;
  // Air steering uses A/D but is not ground strafe — clear so stale isStrafing
  // never leaks into the client delta stream mid-flight.
  player.isStrafing = false;
  player.isPowerSliding = false;
  player.isBraking = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  // Cancel any in-progress attack so its VFX/SFX (e.g. the slap-hands effect,
  // slap whiff sound) don't bleed into flight. Liftoff out of a slap/charge
  // must read as a clean takeoff — nothing on screen but the flap.
  player.isAttacking = false;
  player.isSlapAttack = false;
  player.isChargingAttack = false;
  player.attackType = null;
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackCooldownUntil = 0;
  return true;
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
  if (now - room.lastScreenShakeTime < SCREEN_SHAKE_MIN_INTERVAL) {
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

  // Pausable simulation clock
  setSimRoomResolver,
  simNow,
  simNowForPlayer,
  advanceRoomSimTime,
  lagCompensatedParryStart,

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
  canPlayerSidestep,
  resetPlayerAttackStates,
  clearAllActionStates,
  beginFlapStartup,
  cancelPendingSlapWork,
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  shouldRestartCharging,
  startCharging,
  canPlayerSlap,
  clearChargeState,
  isOutsideDohyo,
  clampStaminaValue,
  isNearDohyoEdge,
  getEdgeProximity,
  getIceFriction,
  canApplyKnockback,
  setKnockbackImmunity,
  getChargedHitstop,
  triggerHitstop,
  triggerHitstopAndEmit,
  isRoomInHitstop,
  emitThrottledScreenShake,
  getSidestepInitData,
  clearHitFall,
  clearSidestepHitReturn,
};

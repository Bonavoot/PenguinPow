const {
  GRAB_STATES, GROUND_LEVEL,
  POWER_UP_TYPES, POWER_UP_EFFECTS,
  HITBOX_DISTANCE_VALUE, DOHYO_FALL_DEPTH,
  DODGE_DURATION, DODGE_STAMINA_COST,
  ROPE_JUMP_STARTUP_MS, ROPE_JUMP_STAMINA_COST, ROPE_JUMP_BOUNDARY_ZONE,
  DODGE_SLIDE_MOMENTUM, DODGE_POWERSLIDE_BOOST,
  DODGE_STARTUP_MS,
  SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MS,
  SIDESTEP_TOTAL_MS, SIDESTEP_STAMINA_COST,
  SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST, RAW_PARRY_STAMINA_COST, RAW_PARRY_COOLDOWN_MS,
  CHARGE_FULL_POWER_MS,
  GRAB_STARTUP_DURATION_MS,
} = require("./constants");

const {
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  timeoutManager,
  setPlayerTimeout,
  clearChargeState,
  canPlayerSlap,
  canPlayerDash,
  canPlayerSidestep,
  getSidestepInitData,
  canPlayerCharge,
  canPlayerUseAction,
  shouldRestartCharging,
  startCharging,
  gameNow,
  simNowForPlayer,
} = require("./gameUtils");

const {
  executeSlapAttack,
  executeChargedAttack,
} = require("./gameFunctions");

const {
  LOBBY_COLORS,
  LOBBY_BODY_COLORS,
  createCPUPlayer,
  handlePowerUpSelection,
  handleSaltThrowAndPowerUp,
  resetRoomAndPlayers,
} = require("./roomManagement");

const {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
} = require("./playerCleanup");

const {
  createInitialPlayerState,
  PLAYER_1_SPAWN,
  PLAYER_2_SPAWN,
} = require("./playerFactory");

const { clearAIState } = require("./cpuAI");
const { clearImpossibleAIState } = require("./cpuAI_impossible");

// Per-match input audit log — appended after rate limit, closed on
// match-end / disconnect / reset paths below.
const { appendInput: appendAuditInput, closeLog: closeAuditLog } = require("./inputAuditLog");

// ============================================
// FIGHTER_ACTION INPUT RATE LIMIT (B7 — Phase 3)
// ============================================
// Token bucket per socket on the fighter_action channel. Caps abusive clients
// (DoS spam, attempted timing exploits) without affecting legitimate play.
//
// Tuning rationale:
//   - Capacity 30 tokens   → tolerates 30-input bursts (mouse+keyboard combos
//                            during action flurries can spike briefly).
//   - Refill 200 tokens/s  → sustained ceiling well above any reasonable client
//                            tick rate (clients send fighter_action ~60–120/s
//                            in normal play; even 240Hz mice stay well under).
//
// Drops are silent (no error reply) to avoid leaking rate-limit state to a
// would-be attacker. Bucket entries are cleaned up on disconnect.
//
// Uses gameNow() (monotonic) so token accrual is immune to NTP clock shifts —
// a backward Date.now() jump on a regular server would otherwise either
// freeze refills or grant infinite tokens depending on direction.
const RATE_LIMIT_CAPACITY = 30;
const RATE_LIMIT_REFILL_PER_SEC = 200;
const inputRateBuckets = new Map(); // socket.id -> { tokens, lastRefillNow, dropped }

// Max queued-but-unprocessed input packets per player. The tick drains the
// whole queue every 15.6ms, so this only matters during hitstop freezes or
// abuse — 40 packets is ~600ms of 64Hz client input.
const MAX_INPUT_QUEUE_PACKETS = 40;

function takeInputToken(socketId) {
  const now = gameNow();
  let bucket = inputRateBuckets.get(socketId);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefillNow: now, dropped: 0 };
    inputRateBuckets.set(socketId, bucket);
  }
  const elapsed = now - bucket.lastRefillNow;
  bucket.tokens = Math.min(
    RATE_LIMIT_CAPACITY,
    bucket.tokens + (elapsed * RATE_LIMIT_REFILL_PER_SEC) / 1000,
  );
  bucket.lastRefillNow = now;
  if (bucket.tokens < 1) {
    bucket.dropped++;
    return false;
  }
  bucket.tokens -= 1;
  return true;
}

function clearInputBucket(socketId) {
  inputRateBuckets.delete(socketId);
}

// ============================================
// FIGHTER_ACTION INPUT EDGE DETECTION (B7 — Phase 5)
// ============================================
// Client throttles socket emits to >=16ms intervals, so a press-release-press
// faster than that window collapses to whichever state the trailing emit
// captures. The middle press can vanish entirely — players press it, the
// server never sees an edge, the slap doesn't come out.
//
// Mitigation: clients additively send a per-packet `events` array of every
// key state change since the last emit (`{ k, a: "down"|"up", t }`). This
// helper walks those events stepwise from the previous snapshot to the
// current one and reports which keys had ANY rising/falling edge during
// the packet window — even if the snapshot diff alone would have missed it.
//
// Backwards-compatible: when `events` is absent or empty, the result is
// identical to the current snapshot-only diff. Server caps the events
// array at MAX_EVENTS_PER_PACKET so abuse can't expand 1 packet (1 rate
// token) into unlimited synthetic edges.
const MAX_EVENTS_PER_PACKET = 16;

function detectEdges(prevKeys, events, newKeys) {
  const rising = {};
  const falling = {};
  let working = prevKeys || {};

  if (Array.isArray(events) && events.length > 0) {
    const limit = Math.min(events.length, MAX_EVENTS_PER_PACKET);
    for (let i = 0; i < limit; i++) {
      const ev = events[i];
      if (!ev || typeof ev.k !== "string") continue;
      const isDown = ev.a === "down";
      const wasDown = !!working[ev.k];
      if (!wasDown && isDown) rising[ev.k] = true;
      if (wasDown && !isDown) falling[ev.k] = true;
      working = { ...working, [ev.k]: isDown };
    }
  }

  if (newKeys) {
    for (const k in newKeys) {
      const wasDown = !!working[k];
      const isDown = !!newKeys[k];
      if (!wasDown && isDown) rising[k] = true;
      if (wasDown && !isDown) falling[k] = true;
    }
    // Catch keys that left newKeys but were down in working (rare; safety net).
    for (const k in working) {
      if (Object.prototype.hasOwnProperty.call(newKeys, k)) continue;
      if (working[k] && !newKeys[k]) falling[k] = true;
    }
  }

  return { rising, falling };
}

// ============================================================
// PHASE 3: TICK-CONSUMED INPUT DISPATCH
// ============================================================
// ALL gameplay input execution lives here. The fighter_action socket
// handler only validates and ENQUEUES packets (player.inputQueue); the
// game tick (index.js) drains the queue at tick start — outside hitstop —
// and calls this once per packet, in arrival order. Result: actions
// execute at deterministic points in the simulation instead of whenever
// a packet happens to arrive mid-tick, and freezes can't be bypassed.
function processInputPacket(room, player, data, io, rooms) {
  if (
    (room.gameOver && !room.matchOver) ||
    room.matchOver
  ) {
    return; // Skip all other actions if the game is over
  }

  // TACHIAI CHARGING: Track mouse1 for pre-round charging before blocking other inputs.
  // This lets players hold mouse1 during walk-to-ready and ready phases to build charge.
  // Must run BEFORE the canMoveToReady and pre-round input blocks below.
  if (!room.gameStart && data.keys) {
    const previousMouse1 = player.keys ? player.keys.mouse1 : false;
    player.keys = player.keys || {};
    player.keys.mouse1 = data.keys.mouse1 || false;

    if (!previousMouse1 && data.keys.mouse1) {
      player.mouse1PressTime = simNowForPlayer(player);
    }
    if (previousMouse1 && !data.keys.mouse1) {
      player.chargeAttackPower = 0;
      player.mouse1PressTime = 0;
      if (player.isChargingAttack) {
        player.isChargingAttack = false;
        player.chargeStartTime = 0;
        player.chargingFacingDirection = null;
        player.attackType = null;
      }
    }

    player.mouse1BufferedBeforeStart = data.keys.mouse1 || false;
  }

  // Block all actions if player is moving to ready position
  if (player.canMoveToReady) {
    return;
  }

  // Block all non-mouse1 inputs during pre-round phase
  if (!room.gameStart || room.hakkiyoiCount === 0) {
    return;
  }

  // Block all inputs during pumo army spawning animation
  if (player.isSpawningPumoArmy) {
    return;
  }

  // Input lockout window: allow key state refresh but block actions
  if (player.inputLockUntil && simNowForPlayer(player) < player.inputLockUntil) {
    if (data.keys) {
      // Edge detection across the packet window (snapshot diff + replayed
      // per-event edges). Falls back to pure snapshot diff if events
      // array is absent — preserves legacy behavior bit-for-bit.
      const prevKeysSnapshot = player.keys || {};
      const { rising, falling } = detectEdges(
        prevKeysSnapshot,
        data.events,
        data.keys,
      );

      // Clear grabBreakSpaceConsumed if spacebar was released during input lock,
      // so raw parry isn't blocked after the lock expires
      if (falling[" "] && player.grabBreakSpaceConsumed) {
        player.grabBreakSpaceConsumed = false;
      }
      // Track mouse1 press/release timing during lock so charging can begin
      // immediately when the lock expires (inputs are READ, not acted on)
      if (rising.mouse1) {
        // mouse1 just pressed during lock — record press time
        player.mouse1PressTime = simNowForPlayer(player);
      } else if (falling.mouse1) {
        player.mouse1PressTime = 0;
      }
      player.keys = data.keys;

      // During slap attacks, buffer mouse1 for next hits / mouse2 for grab ender
      if (player.isAttacking && player.attackType === "slap") {
        if (rising.mouse1) {
          const maxBuffer = 3 - (player.slapStringPosition || 1);
          if (player.pendingSlapCount < maxBuffer) {
            player.pendingSlapCount++;
          }
        }
        if (rising.mouse2 && player.slapStringPosition >= 2) {
          player.pendingGrabEnder = true;
          player.pendingSlapCount = 0;
        }
      } else {
        // Non-slap states: use generic inputBuffer
        if (rising[" "]) {
          player.inputBuffer = { type: "rawParry", timestamp: simNowForPlayer(player) };
        } else if (rising.shift && data.keys.s && !data.keys.mouse2) {
          player.inputBuffer = { type: "sidestep", timestamp: simNowForPlayer(player) };
        } else if (rising.shift && !data.keys.mouse2) {
          player.inputBuffer = { type: "dodge", timestamp: simNowForPlayer(player) };
        } else if (rising.mouse1 && data.keys.s) {
          const fwdKey = player.facing === -1 ? 'd' : 'a';
          if (data.keys[fwdKey]) {
            player.inputBuffer = { type: "chargedAttack", timestamp: simNowForPlayer(player) };
          } else {
            player.inputBuffer = { type: "slap", timestamp: simNowForPlayer(player) };
          }
        } else if (rising.mouse1) {
          player.inputBuffer = { type: "slap", timestamp: simNowForPlayer(player) };
        } else if (rising.mouse2) {
          player.inputBuffer = { type: "grab", timestamp: simNowForPlayer(player) };
        }
      }
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

  // NOTE: No explicit hitstop handling here. The tick only drains the input
  // queue while the room is NOT in hitstop, so packets that arrive during a
  // freeze are held and replayed in order on the first post-freeze tick —
  // edges intact, first input wins.

  // Helper function to check if player is in a charged attack execution state
  const isInChargedAttackExecution = () => {
    return player.isAttacking && player.attackType === "charged";
  };

  // Helper function to check if an action should be blocked
  // allowDodgeCancelRecovery: allows dodge to cancel recovery state
  // allowChargingDuringDodge: allows starting/continuing charged attack during dodge
  const shouldBlockAction = (allowDodgeCancelRecovery = false, allowChargingDuringDodge = false) => {
    // Global action lock gate to serialize actions visually/feel-wise
    if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) {
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
    // Block all actions during clinch (push/plant/neutral handled by clinch system)
    if (player.inClinch) {
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
    // Edge detection across the entire packet window. When `data.events`
    // is present, walks each per-event transition AND reconciles against
    // the final snapshot, so a press-release-press faster than the client
    // emit interval (>=16ms) still surfaces as a rising edge here. When
    // `data.events` is absent, this reduces to the classic snapshot diff
    // and behavior is bit-for-bit identical to the pre-events path.
    const previousKeys = { ...player.keys };
    const { rising, falling } = detectEdges(previousKeys, data.events, data.keys);
    player.keys = data.keys;

    // Set mouse1 press flags — true if a press happened ANYWHERE in the
    // packet window, even if the trailing snapshot already shows release.
    player.mouse1JustPressed = !!rising.mouse1;
    player.mouse1JustReleased = !!falling.mouse1;

    // Set mouse2 press flags (mouse2 = grab now)
    player.mouse2JustPressed = !!rising.mouse2;
    player.mouse2JustReleased = !!falling.mouse2;

    // Track attack intent time when mouse1 is pressed (for counter hit detection)
    // This captures the moment the player tries to attack, even before the attack executes
    if (player.mouse1JustPressed) {
      // Sim clock — read by processHit's counter-hit window against sim time
      player.attackIntentTime = simNowForPlayer(player);
      // Record press time for slap-vs-charge threshold detection (sim clock,
      // so a hold through hitstop doesn't silently cross the charge threshold)
      player.mouse1PressTime = simNowForPlayer(player);
    }

    // Track "just pressed" state for all action keys to prevent actions from triggering
    // when keys are held through other actions (e.g., holding E during dodge then grabbing after)
    player.shiftJustPressed = !!rising.shift;
    player.eJustPressed = !!rising.e;
    player.wJustPressed = !!rising.w;
    player.aJustPressed = !!rising.a;
    player.dJustPressed = !!rising.d;
    player.fJustPressed = !!rising.f;
    player.spaceJustPressed = !!rising[" "];

    // POST-GRAB INPUT BUFFER: After a grab/throw ends, treat held keys as "just pressed"
    // for one cycle. This enables frame-1 activation of grab (mouse2) which has complex
    // initiation code with nested timeouts that must run through the normal input path.
    // Raw parry, slap, dodge, and charge are handled directly in activateBufferedInputAfterGrab().
    if (player.postGrabInputBuffer) {
      if (data.keys.mouse2 && !player.mouse2JustPressed) player.mouse2JustPressed = true;
      player.postGrabInputBuffer = false;
    }

    // Buffer inputs when shouldBlockAction() prevents execution.
    // The game loop processes the buffer on the first actionable frame.
    if (shouldBlockAction()) {
      if (player.spaceJustPressed) {
        player.inputBuffer = { type: "rawParry", timestamp: simNowForPlayer(player) };
      } else if (player.shiftJustPressed && data.keys.s && !data.keys.mouse2) {
        player.inputBuffer = { type: "sidestep", timestamp: simNowForPlayer(player) };
      } else if (player.shiftJustPressed && !data.keys.mouse2) {
        player.inputBuffer = { type: "dodge", timestamp: simNowForPlayer(player) };
      } else if (player.mouse1JustPressed && data.keys.s) {
        const fwdKey = player.facing === -1 ? 'd' : 'a';
        if (data.keys[fwdKey]) {
          player.inputBuffer = { type: "chargedAttack", timestamp: simNowForPlayer(player) };
        } else {
          player.inputBuffer = { type: "slap", timestamp: simNowForPlayer(player) };
        }
      } else if (player.mouse1JustPressed) {
        player.inputBuffer = { type: "slap", timestamp: simNowForPlayer(player) };
      } else if (player.mouse2JustPressed && !player.inClinch) {
        player.inputBuffer = { type: "grab", timestamp: simNowForPlayer(player) };
      }
    }

    // Track mouse1 held during recovery from a connected charged attack
    // This catches the case where player re-presses mouse1 AFTER processHit ran
    // (e.g., mouse1 re-press event arrived after the hit was processed)
    if (player.keys.mouse1 && player.isRecovering && player.chargedAttackHit) {
      player.mouse1HeldDuringAttack = true;
      if (!player.mouse1PressTime) {
        player.mouse1PressTime = simNowForPlayer(player);
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

  // SPACE PRESS: Fire raw parry immediately for zero-tick-delay responsiveness
  // Same pattern as slap — execute on the socket event instead of waiting for the game tick
  if (
    player.spaceJustPressed &&
    !shouldBlockAction() &&
    !player.isRawParrying &&
    !player.isRawParryStun &&
    !player.grabBreakSpaceConsumed &&
    simNowForPlayer(player) >= (player.rawParryCooldownUntil || 0) &&
    !player.isSidestepping &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabClashing &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isAttacking &&
    !player.isHit &&
    !player.isThrowingSnowball &&
    !player.isSpawningPumoArmy &&
    !player.canMoveToReady
  ) {
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.isRawParrying = true;
    player.rawParryStartTime = simNowForPlayer(player);
    player.rawParryMinDurationMet = false;
    player.stamina = Math.max(0, player.stamina - RAW_PARRY_STAMINA_COST);
    clearChargeState(player, true);
    player.movementVelocity = 0;
    player.isStrafing = false;
    player.isPowerSliding = false;
    player.isCrouchStance = false;
    player.isCrouchStrafing = false;
    player.pendingSlapCount = 0;
    player.pendingGrabEnder = false;
    player.slapStringPosition = 0;
    player.slapStringWindowUntil = 0;
  }

  // MOUSE1 PRESS: Check for S+FORWARD+MOUSE1 charged attack combo, else fire slap
  if (player.mouse1JustPressed && !shouldBlockAction()) {
    const forwardKey = player.facing === -1 ? 'd' : 'a';
    const wantsChargedAttack = player.keys.s && player.keys[forwardKey];

    if (wantsChargedAttack && canPlayerSlap(player, { ignoreCooldown: true })) {
      player.chargeAttackPower = 0;
      player.chargeStartTime = 0;
      startCharging(player);
      player.chargingFacingDirection = player.facing;
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
    } else if (wantsChargedAttack && player.isAttacking && player.attackType === "slap") {
      player.inputBuffer = { type: "chargedAttack", timestamp: simNowForPlayer(player) };
    } else if (canPlayerSlap(player)) {
      executeSlapAttack(player, rooms);
    } else if (player.isAttacking && player.attackType === "slap") {
      const maxBuffer = 3 - (player.slapStringPosition || 1);
      if (player.pendingSlapCount < maxBuffer) {
        player.pendingSlapCount++;
      }
    }
  }

  // MOUSE2 DURING SLAP STRING: buffer grab ender (replaces hit 3 with grab)
  if (player.mouse2JustPressed && player.isAttacking && player.attackType === "slap" &&
      player.slapStringPosition >= 2) {
    player.pendingGrabEnder = true;
    player.pendingSlapCount = 0;
  }

  // MOUSE1 RELEASE: Execute charged attack if charging, otherwise clear state
  if (player.mouse1JustReleased) {
    if (player.isRopeJumping && player.ropeJumpPhase === "landing" && player.mouse1PressTime > 0) {
      player.ropeJumpBufferedAttackRelease = simNowForPlayer(player) - player.mouse1PressTime;
    }
    if (player.isChargingAttack) {
      const chargePercentage = player.chargeAttackPower || 1;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargingFacingDirection = null;
      player.mouse1HeldDuringAttack = false;
      executeChargedAttack(player, chargePercentage, rooms);
    } else {
      if (!(player.isAttacking && player.attackType === "charged")) {
        player.chargeAttackPower = 0;
      }
    }
    player.mouse1PressTime = 0;
    player.wantsToRestartCharge = false;
    player.mouse1HeldDuringAttack = false;
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
    // Clear charge state — cancelled by another action, so zero charge power
    clearChargeState(player, true);

    // The existing input handlers will take over for W/E/F
  }


  // Handle F key power-ups (snowball and pumo army) - block during charged attack execution and recovery
  // Use fJustPressed to prevent power-ups from triggering when key is held through other actions
  if (
    player.fJustPressed &&
    !shouldBlockAction() &&
    (player.activePowerUp === POWER_UP_TYPES.SNOWBALL ||
      player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) &&
    (player.activePowerUp !== POWER_UP_TYPES.SNOWBALL ||
      (player.snowballThrowsRemaining ?? 5) > 0) &&
    (player.activePowerUp !== POWER_UP_TYPES.PUMO_ARMY ||
      (player.pumoArmySpawnsRemaining ?? 3) > 0) &&
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
      clearChargeState(player, true);
    }

    if (player.activePowerUp === POWER_UP_TYPES.SNOWBALL) {
      // Backfill for older in-progress states where this field may be missing.
      if (player.snowballThrowsRemaining == null) {
        player.snowballThrowsRemaining = 5;
      }
      if (player.snowballThrowsRemaining <= 0) {
        return;
      }

      // Snowball costs same stamina as a slap attack
      player.stamina = Math.max(0, player.stamina - SLAP_ATTACK_STAMINA_COST);
      player.snowballThrowsRemaining = Math.max(
        0,
        player.snowballThrowsRemaining - 1
      );
      // Set throwing state
      player.isThrowingSnowball = true;
      // Lock actions during throw windup/animation window for visual clarity
      player.currentAction = "snowball";
      player.actionLockUntil = simNowForPlayer(player) + 250;

      // Determine snowball direction based on current position relative to opponent
      const opponent = room.players.find(
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
          if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) {
            player.actionLockUntil = 0;
          }

          // Neutral charged attack removed — no charge to restart
        },
        500
      );
    } else if (player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) {
      if (player.pumoArmySpawnsRemaining == null) {
        player.pumoArmySpawnsRemaining = 3;
      }
      if (player.pumoArmySpawnsRemaining <= 0) {
        return;
      }

      // Pumo army costs same stamina as a charged attack
      player.stamina = Math.max(0, player.stamina - CHARGED_ATTACK_STAMINA_COST);
      player.pumoArmySpawnsRemaining = Math.max(
        0,
        player.pumoArmySpawnsRemaining - 1
      );
      // Set spawning state
      player.isSpawningPumoArmy = true;
      player.currentAction = "pumo_army";
      player.actionLockUntil = simNowForPlayer(player) + 400;

      // Clear any existing movement momentum to prevent sliding during animation
      player.movementVelocity = 0;
      player.isStrafing = false;

      // Determine army direction (same as player facing)
      const armyDirection = player.facing === 1 ? -1 : 1; // Army moves in direction player is facing

      const startX = armyDirection === 1 ? -100 : 1200;
      const Y_SPREAD = 35;
      const V_OFFSET = 40; // Middle clone leads the V-formation

      // Spawn all 3 clones at once in a V-formation across Y lanes
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
          spawnTime: simNowForPlayer(player),
          lifespan: 10000,
          ownerId: player.id,
          ownerFighter: player.fighter,
          hasHit: false,
          size: 0.6,
          lane,
        };
        player.pumoArmy.push(clone);
      });

      player.pumoArmyCooldown = true;

      // Reset spawning state after animation (named so clearAllActionStates can cancel on interrupt)
      setPlayerTimeout(
        player.id,
        () => {
          player.isSpawningPumoArmy = false;
          player.pumoArmyCooldown = false;
          if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) {
            player.actionLockUntil = 0;
          }

          // Neutral charged attack removed — no charge to restart
        },
        800,
        "pumoArmySpawnEnd"
      );
    }
  }

  // Handle sidestep (S + SHIFT) — henka-style lateral evasion that switches sides
  // Must be checked BEFORE dodge so the combo input takes priority
  if (
    player.shiftJustPressed &&
    player.keys.s &&
    !player.keys.mouse2 &&
    !player.isBeingGrabbed &&
    !isInChargedAttackExecution() &&
    canPlayerSidestep(player) &&
    !player.isGassed
  ) {
    const sidestepOpponent = room.players.find(p => p.id !== player.id && !p.isDead);
    if (sidestepOpponent) {
      if (player.isRecovering) {
        const recoveryAge = simNowForPlayer(player) - player.recoveryStartTime;
        if (recoveryAge > 100) {
          player.isRecovering = false;
          player.movementVelocity = 0;
          player.recoveryDirection = null;
        }
      }

      if (!player.isRecovering) {
      const initData = getSidestepInitData(player.x, sidestepOpponent.x);
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      clearChargeState(player, true);

      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;

      player.isSidestepping = true;
      player.isSidestepStartup = true;
      player.isSidestepRecovery = false;
      player.sidestepStartTime = simNowForPlayer(player);
      player.sidestepStartupEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS;
      player.sidestepActiveEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS;
      player.sidestepEndTime = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
      player.sidestepStartX = player.x;
      player.sidestepDirection = initData.direction;

      player.currentAction = "sidestep";
      player.actionLockUntil = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
      player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
      }
    }
  }
  // Handle dash - allow canceling recovery but block during charged attack execution
  // Dashing now costs stamina (15% of max) instead of using charges
  // Use shiftJustPressed to prevent dash from triggering when key is held through other actions
  // NOTE: Dash cancels charging - clearing charge state when dash starts
  else if (
    player.shiftJustPressed &&
    !player.keys.mouse2 && // Don't dash while grabbing
    !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
    !player.isBeingGrabbed && // Block dash when being grabbed
    !isInChargedAttackExecution() && // Block during charged attack execution
    canPlayerDash(player) &&
    !player.isGassed
  ) {
    // Allow dodge to cancel recovery
    if (player.isRecovering) {
      // Add grace period - don't allow dodge to cancel recovery for 100ms after it starts
      // This prevents immediate dodge from canceling recovery that was just set
      const recoveryAge = simNowForPlayer(player) - player.recoveryStartTime;
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
    player.isDodgeStartup = true;
    player.dodgeStartTime = simNowForPlayer(player);
    player.dodgeStartupEndTime = simNowForPlayer(player) + DODGE_STARTUP_MS;
    player.dodgeEndTime = simNowForPlayer(player) + DODGE_DURATION;
    player.dodgeStartX = player.x;
    player.currentAction = "dash";
    player.actionLockUntil = simNowForPlayer(player) + 100;
    player.justLandedFromDodge = false;

    player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);

    if (player.keys.a) {
      player.dodgeDirection = -1;
    } else if (player.keys.d) {
      player.dodgeDirection = 1;
    } else {
      player.dodgeDirection = player.facing === -1 ? 1 : -1;
    }

    // Dodge lifecycle (landing, recovery, cooldown) is handled entirely by the tick
    // loop in index.js. Pending charge attacks are executed when recovery ends.
  } else if (
    (player.shiftJustPressed || player.keys.shift) && // Buffer on press OR hold (catches spammers who end on held key)
    (player.isAttacking ||
      player.isThrowing ||
      player.isBeingThrown ||
      player.isGrabbing ||
      player.isBeingGrabbed) && // Allow buffering while being grabbed/thrown so spamming shift comes out frame 1 when freed
    !player.isDodging &&
    !player.isSidestepping &&
    !player.isThrowingSnowball &&
    !player.isRawParrying &&
    !isInChargedAttackExecution() &&
    !player.isGassed
  ) {
    if (player.keys.s) {
      player.bufferedAction = { type: "sidestep" };
    } else {
      const dodgeDirection = player.keys.a
        ? -1
        : player.keys.d
        ? 1
        : player.facing === -1
        ? 1
        : -1;
      player.bufferedAction = {
        type: "dash",
        direction: dodgeDirection,
      };
    }
    player.bufferExpiryTime = simNowForPlayer(player) + 500;
  }
  // Buffer dash during recovery/cooldown so spamming fires on frame 1 when allowed
  else if (
    player.shiftJustPressed &&
    !player.keys.mouse2 &&
    !player.isGassed &&
    !player.isDodging &&
    (player.isDodgeRecovery || (player.dodgeCooldownUntil && simNowForPlayer(player) < player.dodgeCooldownUntil))
  ) {
    player.inputBuffer = { type: "dodge", timestamp: simNowForPlayer(player) };
  }
  // Emit "No Stamina" feedback when player tries to dodge but doesn't have enough stamina
  else if (
    player.shiftJustPressed &&
    !player.keys.mouse2 &&
    !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
    canPlayerDash(player) &&
    player.isGassed &&
    (!player.lastStaminaBlockedTime || simNowForPlayer(player) - player.lastStaminaBlockedTime > 500)
  ) {
    player.lastStaminaBlockedTime = simNowForPlayer(player);
    io.to(player.id).emit("stamina_blocked", { playerId: player.id, action: "dash" });
  }

  // ── ROPE JUMP: W + forward key near map boundary ──
  // Escape over the opponent when cornered. Forward = away from nearest boundary.
  {
    const nearLeftBound = player.x - MAP_LEFT_BOUNDARY < ROPE_JUMP_BOUNDARY_ZONE;
    const nearRightBound = MAP_RIGHT_BOUNDARY - player.x < ROPE_JUMP_BOUNDARY_ZONE;
    const forwardHeld = (nearLeftBound && player.keys.d) || (nearRightBound && player.keys.a);
    const wantsRopeJump = player.keys.w && forwardHeld && (nearLeftBound || nearRightBound);

    if (
      wantsRopeJump &&
      !player.isRopeJumping &&
      canPlayerDash(player) &&
      !player.isGassed &&
      !isInChargedAttackExecution() &&
      !player.isBeingGrabbed &&
      room.gameStart &&
      !room.gameOver
    ) {
      clearChargeState(player, true);

      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;

      const jumpDir = nearLeftBound ? 1 : -1;
      const mapMidpoint = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
      const targetX = player.x + (mapMidpoint - player.x) * 0.52;

      player.facing = nearLeftBound ? -1 : 1;
      player.isRopeJumping = true;
      player.ropeJumpPhase = "startup";
      player.ropeJumpStartTime = simNowForPlayer(player);
      player.ropeJumpStartX = player.x;
      player.ropeJumpTargetX = Math.max(MAP_LEFT_BOUNDARY, Math.min(targetX, MAP_RIGHT_BOUNDARY));
      player.ropeJumpDirection = jumpDir;
      player.ropeJumpActiveStartTime = 0;
      player.ropeJumpLandingTime = 0;
      player.ropeJumpBufferedAttackRelease = 0;
      player.currentAction = "ropeJump";
      player.actionLockUntil = simNowForPlayer(player) + ROPE_JUMP_STARTUP_MS;
      player.stamina = Math.max(0, player.stamina - ROPE_JUMP_STAMINA_COST);
    }
    // "Not enough stamina" feedback when gassed
    else if (
      wantsRopeJump &&
      !player.isRopeJumping &&
      canPlayerDash(player) &&
      player.isGassed &&
      (!player.lastStaminaBlockedTime || simNowForPlayer(player) - player.lastStaminaBlockedTime > 500)
    ) {
      player.lastStaminaBlockedTime = simNowForPlayer(player);
      io.to(player.id).emit("stamina_blocked", { playerId: player.id, action: "ropeJump" });
    }
  }

  // S+FORWARD+MOUSE1 CHARGED ATTACK: Continuous check for lenient input detection.
  // Catches the case where mouse1 is already held and player adds S+forward after.
  if (
    player.keys.mouse1 &&
    player.keys.s &&
    !player.isChargingAttack &&
    !player.isAttacking &&
    !shouldBlockAction()
  ) {
    const forwardKey = player.facing === -1 ? 'd' : 'a';
    if (player.keys[forwardKey] && canPlayerSlap(player, { ignoreCooldown: true })) {
      player.chargeAttackPower = 0;
      player.chargeStartTime = 0;
      startCharging(player);
      player.chargingFacingDirection = player.facing;
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
    }
  }

  // Clear any lingering charge state when not attacking
  if (player.isChargingAttack && !player.keys.mouse1 && !player.isAttacking) {
    player.isChargingAttack = false;
    player.chargeStartTime = 0;
    player.chargeAttackPower = 0;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.mouse1HeldDuringAttack = false;
  }
  // Safety: clear stale preserved charge when mouse1 is not held
  if (!player.keys.mouse1 && !player.isChargingAttack && player.chargeAttackPower > 0 && !player.isAttacking) {
    player.chargeAttackPower = 0;
  }

  // === GRIP-UP: Opponent presses Mouse2 while being grabbed without grip → gets grip ===
  // isBeingGrabbed stays true (keeps position-lock and action blocking intact).
  // hasGrip is used CLIENT-SIDE to switch from being-grabbed to belt-grip animation.
  // The Mouse2 press that acquires grip is consumed — throw can't ride the same press.
  if (
    player.mouse2JustPressed &&
    player.isBeingGrabbed &&
    !player.hasGrip &&
    player.inClinch
  ) {
    player.hasGrip = true;
    player.clinchAction = "neutral";
    player.gripAcquiredTime = simNowForPlayer(player);
  }

  // === CLINCH JOLT: Mouse1 while in clinch with grip ===
  if (
    player.mouse1JustPressed && player.hasGrip && player.inClinch &&
    !player.isClinchJolting && !player.clinchJoltRecovery && !player.clinchJoltCooldown &&
    !player.clinchThrowActive && !player.isClinchClashing &&
    !player.isResistingThrow && !player.isResistingPull && !player.isBeingLifted &&
    !player.isClinchJoltClashing && !player.clinchJoltRequest
  ) {
    player.clinchJoltRequest = true;
    player.clinchJoltRequestTime = simNowForPlayer(player);
  }

  // === CLINCH BREAK: Spacebar while in mutual clinch (both must have grip) ===
  // Defensive escape from the clinch — costs heavy stamina, halves balance,
  // soft-gated (under-budget breakers self-gas). Phase A grabs (one-sided grip)
  // can't be broken — opponent must have gripped up first.
  if (
    player.spaceJustPressed && player.hasGrip && player.inClinch &&
    !player.isGassed &&
    !player.clinchThrowActive && !player.isClinchClashing &&
    !player.isClinchJolting && !player.isClinchJoltClashing && !player.clinchJoltRecovery &&
    !player.isResistingThrow && !player.isResistingPull && !player.isBeingLifted &&
    !player.clinchBreakRequest && !player.isGrabBreaking && !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating
  ) {
    const otherPlayer = room.players.find((p) => p.id !== player.id);
    if (otherPlayer && otherPlayer.hasGrip) {
      player.clinchBreakRequest = true;
      player.clinchBreakRequestTime = simNowForPlayer(player);
    }
  }

  // === CLINCH THROW/PULL/LIFT: Mouse2 + direction while in clinch with grip ===
  // Detects three patterns:
  //   1) Mouse2 just pressed + direction already held
  //   2) Mouse2 already held + direction just pressed (most common — player holds mouse2 during clinch)
  //   3) Mouse2 just pressed, direction arrives within 200ms buffer
  // Grip must have been acquired on a previous tick — can't throw on the same press that got you the grip.
  const gripTooRecent = player.gripAcquiredTime && (simNowForPlayer(player) - player.gripAcquiredTime < 50);
  if (
    player.keys.mouse2 && player.hasGrip && player.inClinch &&
    !gripTooRecent &&
    !player.clinchThrowActive && !player.clinchThrowCooldown && !player.isClinchClashing &&
    !player.clinchThrowRequest &&
    !player.isResistingThrow && !player.isResistingPull && !player.isBeingLifted
  ) {
    const otherPlayer = room.players.find((p) => p.id !== player.id);
    if (otherPlayer) {
      const towardKey = player.x < otherPlayer.x ? 'd' : 'a';
      const awayKey = player.x < otherPlayer.x ? 'a' : 'd';

      const m2Edge = player.mouse2JustPressed ||
        (player.clinchMouse2BufferTime && simNowForPlayer(player) - player.clinchMouse2BufferTime < 200);
      const wEdge = player.wJustPressed;
      const awayJustPressed = awayKey === 'a' ? player.aJustPressed : player.dJustPressed;
      const towardJustPressed = towardKey === 'a' ? player.aJustPressed : player.dJustPressed;

      if (player.mouse2JustPressed) {
        player.clinchMouse2BufferTime = simNowForPlayer(player);
      }

      let request = null;
      // Pattern 1 & 3: Mouse2 edge + direction held
      if (m2Edge && player.keys.w) request = "throw";
      else if (m2Edge && player.keys[awayKey]) request = "pull";
      else if (m2Edge && player.keys[towardKey]) request = "lift";
      // Pattern 2: Mouse2 held + direction just pressed
      else if (wEdge) request = "throw";
      else if (awayJustPressed) request = "pull";
      else if (towardJustPressed) request = "lift";

      if (request) {
        player.clinchThrowRequest = request;
        player.clinchThrowRequestTime = simNowForPlayer(player);
        player.clinchMouse2BufferTime = 0;
      }
    }
  }

  // NOTE: The legacy W-throw and pull-reversal grab paths were removed.
  // Every successful grab now enters the clinch (inClinch = true is set at
  // grab connect), so any branch gated on `isGrabbing && !inClinch` was
  // unreachable. Clinch throws/pulls/lifts live in grabActionSystem.js.

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
    player.lastGrabAttemptTime = simNowForPlayer(player);

    // Clear parry success state when starting a grab
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;

    // Clear charging attack state when starting grab
    clearChargeState(player, true); // true = cancelled by grab

    // Reset hit absorption for thick blubber power-up when starting grab (like charged attack)
    if (player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER) {
      player.hitAbsorptionUsed = false;
    }

    // Begin startup with forward lunge — tick loop applies lunge movement,
    // then does range check at the end → connect / whiff / tech
    player.isGrabStartup = true;
    player.grabStartupStartTime = simNowForPlayer(player);
    player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
    player.grabStartupArmorUsed = false; // Fresh slap-armor charge per grab attempt
    player.currentAction = "grab_startup";
    player.actionLockUntil = simNowForPlayer(player) + GRAB_STARTUP_DURATION_MS;
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
}

function registerSocketHandlers(socket, io, rooms, context) {
  const { registerPlayerInMaps, unregisterPlayerFromMaps } = context;

  socket.on("game_reset", (data) => {
    // Find the room index using the socket's roomId to ensure we're resetting the correct room
    const roomIndex = rooms.findIndex((room) => room.id === socket.roomId);
    if (roomIndex !== -1) {
      // Player explicitly leaving the match — close the audit log if it's
      // still open (e.g., reset before matchOver).
      closeAuditLog(rooms[roomIndex]);
      resetRoomAndPlayers(rooms[roomIndex], io);
    }
  });

  socket.on("get_rooms", () => {
    // Send the cleaned/sanitized payload, not the raw rooms structure (which
    // contains huge per-player gameplay state). The lobby UI only needs the
    // small public summary returned by getCleanedRoomsData.
    socket.emit("rooms", getCleanedRoomsData(rooms));
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

  // Handle body color updates — mirrors mawashi_color logic
  socket.on("update_body_color", (data) => {
    const { roomId, playerId, color } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    room.players[playerIndex].bodyColor = color;

    io.in(roomId).emit("lobby", room.players);
    io.emit("rooms", getCleanedRoomsData(rooms));
    io.in(roomId).emit("body_color_updated", {
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
      existingPlayer.snowballThrowsRemaining = null;
      existingPlayer.pumoArmySpawnsRemaining = null;
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
      rooms[roomIndex].players.push(
        createInitialPlayerState({ id: data.socketId, ...PLAYER_1_SPAWN })
      );
      // PERFORMANCE: Register player 1 in lookup maps
      registerPlayerInMaps(rooms[roomIndex].players[0], rooms[roomIndex]);
    } else if (rooms[roomIndex].players.length === 1) {
      rooms[roomIndex].players.push(
        createInitialPlayerState({ id: data.socketId, ...PLAYER_2_SPAWN })
      );
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
    io.to(data.roomId).emit("rooms", getCleanedRoomsData(rooms));
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
      cpuDifficulty: "HARD",
      playerAvailablePowerUps: {},
      playersSelectedPowerUps: {},
    };
    
    // Add the CPU room to the rooms array
    rooms.push(room);

    // Add human player as player 1
    socket.join(room.id);
    socket.roomId = room.id;

    room.players.push(
      createInitialPlayerState({ id: data.socketId, ...PLAYER_1_SPAWN })
    );

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

  socket.on("set_cpu_difficulty", (data) => {
    const room = rooms.find(r => r.isCPURoom && r.players.some(p => p.id === socket.id));
    if (room && data.difficulty) {
      room.cpuDifficulty = data.difficulty;
    }
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
              : "#D94848";
            cpuPlayer.mawashiColor = chosen;

            const humanBodyHex = (humanPlayer.bodyColor || "").toString().toLowerCase();
            const availableBodyColors = LOBBY_BODY_COLORS.filter(
              (c) => (c || "").toString().toLowerCase() !== humanBodyHex
            );
            cpuPlayer.bodyColor = availableBodyColors.length > 0
              ? availableBodyColors[Math.floor(Math.random() * availableBodyColors.length)]
              : null;

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
          bodyColor: p.bodyColor || null,
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
      handlePowerUpSelection(room, io);
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
    handleSaltThrowAndPowerUp(player, room, io);

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
    io.to(roomId).emit("rooms", getCleanedRoomsData(rooms));
    // console.log(rooms[roomIndex].players);
  });

  socket.on("fighter_action", (data) => {
    // B7 rate limit: drop excess inputs before doing any work. Cheap rejection
    // for malicious / runaway clients; legitimate play never depletes the bucket.
    if (!takeInputToken(socket.id)) return;

    const roomIndex = rooms.findIndex((room) => room.id === socket.roomId);
    if (roomIndex === -1) return; // Room not found

    const room = rooms[roomIndex];

    // SECURITY: bind input to the sending socket — never trust client-supplied IDs.
    // Prevents one client from forging actions on behalf of the opponent or a CPU.
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return; // Player not found
    // Reject mismatched IDs silently (stale client state or tampered payload)
    if (data && data.id && data.id !== socket.id) return;

    // Per-match input audit log — append after rate limit and ID binding so
    // dropped malicious traffic isn't logged but everything the sim acts on
    // is recorded. No-op if the log isn't open (pre-round, post-match, etc).
    appendAuditInput(room, {
      ts: gameNow(),
      socketId: socket.id,
      roomId: room.id,
      payload: data,
    });

    // ENQUEUE ONLY — execution happens at the start of the next game tick
    // (processInputPacket above). Bounded: under pathological flooding or a
    // long freeze, drop the OLDEST packets; the newest key snapshot must
    // survive so held-key state can't get stuck.
    if (!player.inputQueue) player.inputQueue = [];
    if (player.inputQueue.length >= MAX_INPUT_QUEUE_PACKETS) {
      player.inputQueue.shift();
    }
    player.inputQueue.push(data);
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
      // Match abandoned via opponent-disconnect prompt — close audit log.
      closeAuditLog(rooms[roomIndex]);
      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
      }
      if (rooms[roomIndex].powerUpNotifyTimer) {
        clearTimeout(rooms[roomIndex].powerUpNotifyTimer);
        rooms[roomIndex].powerUpNotifyTimer = null;
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

      // Per-match audit log cleanup — close stream if open. Idempotent
      // and safe whether or not the player got far enough to start a match.
      closeAuditLog(room);

      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }
      if (room.powerUpNotifyTimer) {
        clearTimeout(room.powerUpNotifyTimer);
        room.powerUpNotifyTimer = null;
      }

      // Handle CPU room cleanup - REMOVE the room entirely when human leaves
      if (room.isCPURoom) {
        // Clear CPU player timeouts and AI state using the stored unique ID
        const cpuPlayerId = room.cpuPlayerId || "CPU_PLAYER";
        timeoutManager.clearPlayer(cpuPlayerId);
        clearAIState(cpuPlayerId);
        clearImpossibleAIState(cpuPlayerId);

        // Unregister both players from lookup maps before removal
        room.players.forEach(p => unregisterPlayerFromMaps(p.id));

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
    // B7 rate-limit bucket cleanup — prevents Map growth across reconnects.
    clearInputBucket(socket.id);

    if (rooms[roomIndex]) {
      const room = rooms[roomIndex];

      // Per-match audit log cleanup — close the stream if it was open at
      // disconnect. Idempotent, safe whether or not gameStart was reached.
      closeAuditLog(room);

      // Clear any active round start timer to prevent interference
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }
      if (room.powerUpNotifyTimer) {
        clearTimeout(room.powerUpNotifyTimer);
        room.powerUpNotifyTimer = null;
      }

      // Handle CPU room cleanup - REMOVE the room entirely when human disconnects
      if (room.isCPURoom) {
        // Clear CPU player timeouts and AI state using the stored unique ID
        const cpuPlayerId = room.cpuPlayerId || "CPU_PLAYER";
        timeoutManager.clearPlayer(cpuPlayerId);
        clearAIState(cpuPlayerId);
        clearImpossibleAIState(cpuPlayerId);

        // Unregister both players from lookup maps before removal
        room.players.forEach(p => unregisterPlayerFromMaps(p.id));

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
}

module.exports = { registerSocketHandlers, processInputPacket };

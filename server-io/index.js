const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
const e = require("express");
const {
  GRAB_STATES, TICK_RATE, BROADCAST_EVERY_N_TICKS, KEYFRAME_EVERY_N_BROADCASTS,
  ALWAYS_SEND_PROPS, DELTA_TRACKED_PROPS, ALL_TRACKED_PROPS,
  speedFactor, GROUND_LEVEL, HITBOX_DISTANCE_VALUE,
  GRAB_RANGE,
  DOHYO_FALL_SPEED, DOHYO_FALL_DEPTH,
  PAST_MAP_DIRT_KB_FRICTION, OUTSIDE_DOHYO_DIRT_KB_FRICTION,
  PAST_MAP_DIRT_MOVE_FRICTION, OUTSIDE_DOHYO_DIRT_MOVE_FRICTION,
  KILL_PULL_DIRT_OVERSHOOT_SCALE, KILL_PULL_DIRT_FALL_OVERSHOOT_SCALE,
  POWER_UP_TYPES, POWER_UP_EFFECTS,
  GRAB_DURATION, GRAB_ATTEMPT_DURATION,
  ICE_ACCELERATION, ICE_MAX_SPEED, ICE_INITIAL_BURST,
  ICE_COAST_FRICTION, ICE_MOVING_FRICTION, ICE_BRAKE_FRICTION, ICE_STOP_THRESHOLD,
  ICE_TURN_BURST,
  SLIDE_SPEED_BOOST, SLIDE_MAX_SPEED, SLIDE_FRICTION, SLIDE_MIN_VELOCITY,
  SLIDE_MAINTAIN_VELOCITY, SLIDE_BRAKE_FRICTION, SLIDE_STRAFE_TIME_REQUIRED,
  DODGE_SLIDE_MOMENTUM, DODGE_POWERSLIDE_BOOST,
  ICE_SLIDE_FRICTION, ICE_SLIDE_COAST_FRICTION, ICE_SLIDE_STEER_FRICTION, ICE_SLIDE_OPPOSE_FRICTION,
  ICE_SLIDE_EXIT_SPEED, ICE_SLIDE_MAX_SPEED, ICE_SLIDE_MAINTAIN,
  ICE_SLIDE_REVERSE_HOP_MS, ICE_SLIDE_REVERSE_HOP_HEIGHT,
  SLIDE_JUMP_MIN_MS, SLIDE_JUMP_BUFFER_MS, SLIDE_JUMP_LIFTOFF_IMPULSE,
  SLIDE_JUMP_GRAVITY, SLIDE_JUMP_H_BASE, SLIDE_JUMP_H_BONUS, SLIDE_JUMP_H_SPEED_SCALE,
  SLIDE_JUMP_SCALE_MS, SLIDE_JUMP_AIR_STEER, SLIDE_JUMP_AIR_STEER_BLEED,
  SLIDE_JUMP_LANDING_RECOVERY_MS,
  SLIDE_JUMP_LAND_SLAM_IFRAME_MS,
  DODGE_LANDING_BASE, K_DODGE_INHERIT, DODGE_LANDING_MIN, DODGE_LANDING_MAX,
  DOHYO_EDGE_PANIC_ZONE, ICE_EDGE_BRAKE_BONUS, ICE_EDGE_SLIDE_PENALTY,
  MOVEMENT_DECELERATION,
  MOVEMENT_MOMENTUM, MOVEMENT_FRICTION, ICE_DRIFT_FACTOR,
  CHARGED_RECOIL_FRICTION,
  MIN_MOVEMENT_THRESHOLD,
  DODGE_DURATION, DODGE_BASE_SPEED,
  DODGE_TRAVEL_DISTANCE, DODGE_SPEED_MULT_CAP,
  DODGE_CANCEL_ACTION_LOCK,
  DODGE_STARTUP_MS, DODGE_RECOVERY_MS, DODGE_COOLDOWN_MS,
  SLAP_STARTUP_MS, SLAP_ACTIVE_MS,
  CHARGED_STARTUP_MS, CHARGED_ACTIVE_MS,
  GRAB_WALK_SPEED_MULTIPLIER, GRAB_WALK_ACCEL_MULTIPLIER,
  CHARGE_FULL_POWER_MS,
  GRAB_STARTUP_DURATION_MS, GRAB_ACTIVE_MS,
  GRAB_STARTUP_HOP_HEIGHT, GRAB_LUNGE_FRICTION, SLAP_ATTACK_STARTUP_MS,
  GRAB_WHIFF_RECOVERY_MS, GRAB_CATCH_MIN_BURST_SPEED,
  GRAB_BREAK_STAMINA_COST, GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION, GRAB_BREAK_RESIDUAL_VEL,
  GRAB_BREAK_INPUT_LOCK_MS, GRAB_BREAK_ACTION_LOCK_MS,
  RAW_PARRY_STAMINA_COST, RAW_PARRY_MIN_DURATION, RAW_PARRY_MAX_DURATION, RAW_PARRY_COOLDOWN_MS, PULL_BOUNDARY_MARGIN,
  AT_THE_ROPES_DURATION,
  ROPE_JUMP_STARTUP_MS, ROPE_JUMP_ACTIVE_MS, ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_ARC_HEIGHT,
  FLAP_IMPULSE, FLAP_GRAVITY, FLAP_MAX_HEIGHT, FLAP_AIR_MOVE_SPEED,
  FLAP_FASTFALL_GRAVITY, FLAP_DIVE_MIN_DOWN_VELOCITY,
  FLAP_CEILING_CUSHION, FLAP_CEILING_HANG_GRAVITY,
  FLAP_FLAP_H_IMPULSE, FLAP_H_FRICTION, FLAP_CHARGE_COOLDOWN_MS,
  FLAP_LANDING_RECOVERY_MS,
  HIT_FALL_GRAVITY,
  HIT_FALL_MAX_FALL_SPEED,
  KNOCKBACK_IMMUNITY_DURATION,
  STAMINA_REGEN_INTERVAL_MS, STAMINA_REGEN_AMOUNT,
  SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST, DODGE_STAMINA_COST,
  GASSED_RECOVERY_STAMINA,
  GASSED_RECOVERY_STAMINA_IN_CLINCH, COUNTER_GRAB_BALANCE_DEBUFF,
  BALANCE_MAX, BALANCE_REGEN_DELAY_MS, BALANCE_REGEN_PER_SEC,
  BALANCE_GASSED_REGEN_MULT,
  POSTURE_BREAK_THRESHOLD, POSTURE_RECOVER_THRESHOLD,
  HITSTOP_GRAB_MS, HITSTOP_THROW_MS, SLAP_PARRY_KB_FRICTION,
  BURST_KB_FRICTION,
  SLAP_ROPE_RESIST_BUFFER,
  SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MS, SIDESTEP_RECOVERY_MS,
  SIDESTEP_ARC_DEPTH, SIDESTEP_TRAVEL, SIDESTEP_TRAVEL_EDGE, SIDESTEP_GRAB_TRACK_RANGE,
  SIDESTEP_GRAB_TRACK_RANGE_P5,
  SIDESTEP_RECOVERY_OVERLAP_THRESHOLD,
  POST_SIDESTEP_FACING_TRACK_MS,
  CLINCH_KILL_THROW_ARC_HEIGHT,
  CLINCH_KILL_THROW_DISTANCE,
  CLINCH_THROW_DISTANCE,
  CLINCH_THROW_ARC_HEIGHT,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_PULL_SWAP_ARC_HEIGHT,
} = require("./constants");

// Import game utilities
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  timeoutManager,
  setPlayerTimeout,
  isPlayerInActiveState,
  canPlayerCharge,
  canPlayerUseAction,
  canPlayerDash,
  canPlayerSidestep,
  resetPlayerAttackStates,
  clearAllActionStates,
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  startCharging,
  canPlayerSlap,
  clearChargeState,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  clampStaminaValue,
  tryEnterGassed,
  isNearDohyoEdge,
  getEdgeProximity,
  getIceFriction,
  getEffectiveMoveSpeedMult,
  triggerHitstop,
  triggerHitstopAndEmit,
  isRoomInHitstop,
  gameNow,
  setSimRoomResolver,
  setStaminaBlockedIo,
  advanceRoomSimTime,
  lagCompensatedParryStart,
  canArmAttackParry,
  armAttackParry,
  wantsMatadorChord,
  canArmMatador,
  armMatador,
  enterGuard,
  updateAttackParryState,
  updateMatadorState,
  isAttackParryPostLocked,
  emitThrottledScreenShake,
  clearHitFall,
  finishAirHitFallLanding,
  clearSidestepHitReturn,
  clearIceSlideState,
  tryIceSlideReverse,
  clearSlideJumpState,
  shouldCommitSlideJumpDive,
  armSlideJumpFlapCharges,
  cancelPendingSlapWork,
  stampMomentumWindow,
  applyBalanceDamage,
} = require("./gameUtils");

const {
  BOUT_SECONDS,
  describeBout,
  resolveHantei,
  ringFromBoundaries,
  tachiaiStartAt,
} = require("./boutClock");

// Import game functions
const {
  handleWinCondition,
  handleBoutDraw,
  startBoutClock,
  executeSlapAttack,
  executeChargedAttack,
  executePalmThrust,
  calculateEffectiveHitboxSize,
  handleReadyPositions,
  arePlayersColliding,
  adjustPlayerPositions,
  safelyEndChargedAttack,
  activateBufferedInputAfterGrab,
  executeInputBuffer,
  resolveMatadorPull,
} = require("./gameFunctions");

// MASTERY OVERHAUL feature flags (Phase 1: momentum inheritance; Phase 2: posture).
const { MASTERY_P1_MOMENTUM, MASTERY_P2_POSTURE, MASTERY_P5_ASSISTS } = require("./masteryFlags");
const {
  KB_FRICTION,
  DI_FRICTION_FACTOR,
  SLAP_SLIDE_CONTACT_DAMP,
} = require("./momentumTransfer");

// Import fighter_action packet builder (Phase 5 seq/keyframe/resync)
const { buildFighterActionPacket } = require("./fighterBroadcast");

// Import grab mechanics
const {
  correctFacingAfterGrabOrThrow,
  executeGrabWhiff,
} = require("./grabMechanics");

// Import room management (only functions still used by tick)
const {
  resetRoomAndPlayers,
} = require("./roomManagement");

// Facing hard rule: always face opponent unless purposefully locked
const { enforcePairFacing } = require("./facingSystem");
const {
  isActionFacingOwnershipV2Enabled,
  acquireActionFacingLock,
  releaseActionFacingLock,
  forceClearActionFacingLock,
  mintActionFacingInstanceId,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  ACTION_FACING_RELEASE,
} = require("./actionFacingOwnership");
const {
  isActionLifecycleOwnershipV2Enabled,
} = require("./actionLifecycleFlags");
const {
  LIFECYCLE_DOMAIN,
  LIFECYCLE_OWNER,
  LIFECYCLE_PHASE,
  beginLifecycleOwner,
  assertLifecycleCallback,
  completeLifecycleOwner,
  markLifecycleControlRestore,
} = require("./actionLifecycleOwnership");

// Aerial landing Phase A — rope-jump V2 (flagged; legacy path retained)
const {
  stepRopeJumpActive,
  clearRopeJumpLandingState,
  finalizeLandingTrace,
  isRopeJumpLandingV2Enabled,
} = require("./landingResolution");

// Import combat helpers (shared between tick and socket handlers)
const {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  grabSeparationEase,
} = require("./combatHelpers");

// Import CPU AI
const { updateCPUAI, processCPUInputs } = require("./cpuAI");
// Import collision system
const {
  checkCollision,
  checkFlapBodySlam,
  resolveSlapChargedFromLunge,
} = require("./collisionSystem");
const {
  isCombatContactFidelityV2Enabled,
} = require("./combatContactFidelityFlags");
const {
  OFFENSIVE_AERIAL_DEBUG,
  isOffensiveAerialReactionV2Enabled,
} = require("./offensiveAerialFlags");
const {
  beginOffensiveAerialTrace,
  buildOffensiveAerialTickSnapshot,
  recordOffensiveAerialTick,
  flushOffensiveAerialTrace,
} = require("./offensiveAerialTrace");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
  OFFENSIVE_AERIAL_MOVEMENT_OWNER,
  OFFENSIVE_AERIAL_OUTCOME,
  beginOffensiveAerialActivation,
  resolveOffensiveAerialTouchdownTerminal,
  finalizeOffensiveAerialActivation,
} = require("./offensiveAerialOutcome");
const {
  isParriedRecoilActive,
  stepParriedRecoil,
  applyOffensiveAerialTouchdownHandoff,
  recordTouchdownSpacingMetrics,
} = require("./offensiveAerialReaction");
const {
  FACING_LOCK_REASON,
  FACING_RELEASE,
  acquireOffensiveAerialFacingLock,
  updateOffensiveAerialFacingLockDirection,
  applyNeutralFacingAfterAerial,
  handoffOffensiveAerialFacingAtTouchdown,
  aerialFacingAllowsSteer,
} = require("./offensiveAerialFacing");
const {
  syncOffensiveAerialPresentation,
} = require("./offensiveAerialPresentation");
const {
  getConnectDistance,
  attackKindFromPlayer,
  enforceStrikeExtensionSeparation,
} = require("./strikeContact");
const { refreshPalmLimbExtended } = require("./authoredSlapHurtTarget");
const {
  CLINCH_INTERACTION,
  CLINCH_EFFECT_MID_Y,
  ensureClinchInstanceId,
  buildClinchPresentation,
  attachCombatPresentation,
} = require("./combatPresentationEvent");

// Import projectile updates (snowballs + pumo army)
const { updateProjectiles } = require("./projectileUpdates");

// Command grab — owns everything after a grab connects.
const { lockGrabVariant } = require("./commandGrabInput");
const {
  beginCommandGrab,
  updateCommandGrab,
  executeCommandGrabClash,
} = require("./commandGrabSystem");

// Import per-match input audit log
const { openLog: openAuditLog } = require("./inputAuditLog");

// Import socket handler registration
const { registerSocketHandlers, processInputPacket } = require("./socketHandlers");

const { getCleanedRoomsData } = require("./playerCleanup");

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

// Wire the pausable sim clock + timeout manager to the room lookup so any
// module can resolve a player's room sim time (see gameUtils.js).
setSimRoomResolver(getRoomByPlayerId);
// Wire stamina-blocked feedback so any module can surface "OUT OF STAMINA".
setStaminaBlockedIo(io);

let gameLoop = null;
let broadcastTickCounter = 0;
const delta = 1000 / TICK_RATE;

// Embedded/local solo server (spawned by the Electron main process with
// LOCAL_TIGHT_BROADCAST=1): broadcast every sim tick instead of every 2nd.
// Bandwidth is free on loopback, and the halved broadcast quantization
// (~15.6ms vs ~31ms) tightens button→pixels/audio latency in single-player.
// Remote deployments keep the 32Hz default.
const EFFECTIVE_BROADCAST_EVERY_N_TICKS =
  process.env.LOCAL_TIGHT_BROADCAST === "1" ? 1 : BROADCAST_EVERY_N_TICKS;

// Self-correcting game loop that doesn't drift under load.
// setInterval can bunch ticks or skip them when the event loop is busy;
// this accumulator-based approach catches up smoothly.
//
// Scheduler uses performance.now() (monotonic clock) instead of Date.now() so
// the loop is immune to NTP wall-clock corrections. A backward NTP step on
// Date.now() would produce a NEGATIVE accumulator delta and freeze sim ticks
// until the wall clock caught back up; performance.now() never goes backward.
//
// Note: Math.floor(delta) gives us 15ms (60⅔Hz) instead of the exact 15.625ms
// (64Hz) target. That's intentional — the slightly-faster wakeup guarantees
// the accumulator always crosses the `delta` threshold, so we still produce
// a clean ~64 sim ticks/second on average. Going slower (e.g. Math.ceil → 16ms,
// 62.5Hz) would risk under-ticking under jitter.
function startGameLoop() {
  if (gameLoop) return;
  let lastTime = performance.now();
  let accumulator = 0;
  gameLoop = setInterval(() => {
    const now = performance.now();
    accumulator += now - lastTime;
    lastTime = now;
    // Process accumulated time in fixed steps, cap to prevent spiral of death
    const maxCatchUp = delta * 4;
    if (accumulator > maxCatchUp) accumulator = maxCatchUp;
    while (accumulator >= delta) {
      accumulator -= delta;
      try {
        tick(delta);
      } catch (error) {
        console.error("Error in game loop:", error);
      }
    }
  }, Math.floor(delta));
}

function stopGameLoop() {
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
}



function tick(delta) {
  // PERFORMANCE: Use for-loop instead of forEach to avoid closure overhead at 64Hz.
  // Also skip rooms with < 2 players via continue (no function call overhead).
  for (let _roomIdx = 0; _roomIdx < rooms.length; _roomIdx++) {
    const room = rooms[_roomIdx];

    // Advance the room's pausable sim clock (frozen during hitstop) and fire
    // any due player timers. Runs even for sub-2-player rooms so a remaining
    // player's pending timers (cooldown resets etc.) still resolve.
    advanceRoomSimTime(room, delta);
    timeoutManager.processRoom(room);

    // ALL gameplay timing in this loop reads the room's pausable sim clock.
    // During hitstop `now` does not advance, so every elapsed/deadline check
    // below freezes in lockstep with the room — no per-mechanic compensation.
    const now = room.simTime;

    // PHASE 3: Drain queued player inputs at tick start. The socket handler
    // only enqueues — ALL input dispatch happens here, at a deterministic
    // point in the simulation. Held (not drained) during hitstop so a freeze
    // can't be acted through; packets replay in order on the first
    // post-freeze tick with their press/release edges intact.
    if (!isRoomInHitstop(room)) {
      for (let _pIdx = 0; _pIdx < room.players.length; _pIdx++) {
        const inputPlayer = room.players[_pIdx];
        const queue = inputPlayer.inputQueue;
        if (!queue || queue.length === 0) continue;
        inputPlayer.inputQueue = [];
        for (let i = 0; i < queue.length; i++) {
          processInputPacket(room, inputPlayer, queue[i], io, rooms);
        }
      }
    }

    if (room.players.length < 2) continue;

    // FULL HITSTOP FREEZE: this entire two-player block (collision checks,
    // pushbox separation, facing, recovery movement, CPU AI, projectiles) is
    // skipped during hitstop, matching the per-player sim skip below. Without
    // this gate, attacks and snowballs could still connect while the fighters
    // were visually frozen. Hitstop expiry is wall-clock (isRoomInHitstop), so
    // the freeze always ends on its own; state broadcast continues below.
    if (room.players.length === 2 && !isRoomInHitstop(room)) {
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
        const currentTime = now;
        const cpuPlayer = room.players.find(p => p.isCPU);
        const humanPlayer = room.players.find(p => !p.isCPU);
        if (cpuPlayer && humanPlayer) {
          // Update AI decision making (sets keys). One expert brain handles all
          // tiers — it reads room.cpuDifficulty internally and dials its reaction
          // quality / cadence / power-up usage up or down (EASY/NORMAL/HARD/
          // IMPOSSIBLE). See DIFFICULTY_PROFILES in cpuAI.js.
          updateCPUAI(cpuPlayer, humanPlayer, room, currentTime);
          
          // Process the CPU's inputs (converts keys to actions)
          const gameHelpers = {
            executeSlapAttack,
            executeChargedAttack,
            executePalmThrust,
            canPlayerCharge,
            canPlayerSlap,
            canPlayerUseAction,
            canPlayerDash,
            startCharging,
            clearChargeState,
            isPlayerInActiveState,
            setPlayerTimeout,
            rooms,
            io,
          };
          processCPUInputs(cpuPlayer, humanPlayer, room, gameHelpers);
        }
      }

      // Handle ready positions separately from movement
      handleReadyPositions(room, player1, player2, io);

      if (
        player1.isGrabbing &&
        player1.grabbedOpponent &&
        !player1.isHit &&
        !player1.isRingOutPushCutscene
      ) {
        // Only handle grab state if not pushing
        const opponent = room.players.find(
          (p) => p.id === player1.grabbedOpponent
        );
        if (opponent && !opponent.isHit && !opponent.isRingOutPushCutscene) {
          // Keep opponent at fixed distance during grab
          const fixedDistance =
            Math.round(75 * 0.96) * (opponent.sizeMultiplier || 1);
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

      // FORCE OUT: ease the pair past the rope. Clinch attach stays locked until
      // pushbox separation is explicitly armed (after idle poses have committed).
      if (
        room.gameOver &&
        player1.isRingOutPushCutscene &&
        player2.isRingOutPushCutscene
      ) {
        const elapsed = now - (player1.ringOutPushStartTime || now);
        const duration = player1.ringOutPushDuration || 650;
        const allowSeparate =
          player1.ringOutPushAllowSeparate || player2.ringOutPushAllowSeparate;

        for (const p of [player1, player2]) {
          const startX = p.ringOutPushStartX ?? p.x;
          const targetX = p.ringOutPushTargetX ?? p.x;
          if (elapsed < duration) {
            const t = duration > 0 ? elapsed / duration : 1;
            const eased = 1 - Math.pow(1 - t, 3);
            p.x = startX + (targetX - startX) * eased;
          } else if (!p.ringOutPushSettled) {
            p.x = targetX;
            p.ringOutPushSettled = true;
          }
          p.y = GROUND_LEVEL;
          p.movementVelocity = 0;
          p.knockbackVelocity.x = 0;
          p.knockbackVelocity.y = 0;
          p.isFallingOffDohyo = false;
        }

        // Hold win-time clinch gap until separation is armed — covers the shove,
        // the post-shove clinch hold, AND the idle-but-not-yet-separated beat.
        if (!allowSeparate) {
          const grabber = player1.isGrabbing
            ? player1
            : player2.isGrabbing
              ? player2
              : player1.ringOutPushStartX <= player2.ringOutPushStartX
                ? player1
                : player2;
          const grabbed = grabber === player1 ? player2 : player1;
          const attach =
            grabber.ringOutPushAttachDistance ||
            grabbed.ringOutPushAttachDistance ||
            Math.round(75 * 0.96);
          const grabbedOnRight =
            (grabbed.ringOutPushStartX ?? grabbed.x) >=
            (grabber.ringOutPushStartX ?? grabber.x);
          grabbed.x = grabbedOnRight
            ? grabber.x + attach
            : grabber.x - attach;
        }
      }

      // Pushbox: always resolve overlap when players are colliding.
      // arePlayersColliding already returns false during dodge/grab/throw states.
      // Normally skip during game over (MAP clamps drag ring-out losers back).
      // FORCE OUT: only after idle poses AND the separate-delay — never under clinch.
      const forceOutIdlePushbox =
        room.gameOver &&
        (player1.ringOutPushAllowSeparate || player2.ringOutPushAllowSeparate) &&
        !player1.inClinch &&
        !player2.inClinch &&
        !player1.isGrabbing &&
        !player2.isGrabbing &&
        !player1.isBeingGrabbed &&
        !player2.isBeingGrabbed;
      if ((!room.gameOver || forceOutIdlePushbox) && arePlayersColliding(player1, player2)) {
        adjustPlayerPositions(player1, player2, delta);
      }

      // Slap / palm ACTIVE: expand spacing to tip-meets-body so the limb cannot
      // bury into the opponent sprite at resting pushbox distance. Charged is
      // handled by the lunge clamp. Safe during game-over (no-op if not attacking).
      // Pass simTime so slap skips the AP late-parry grace (avoids tip-range
      // parking + drift → ghost whiff before the hit is allowed to confirm).
      //
      // Snapshot pair spacing BEFORE extension-sep parks the limb at tip-meets-
      // body. Tip/pocket classification must use this — measuring after the park
      // made every slap read as a tip connect.
      if (!room.gameOver) {
        const pairDist = Math.abs(player1.x - player2.x);
        if (player1.isAttacking && player1.attackType === "slap") {
          player1.slapSpacingBeforeExtension = pairDist;
        }
        if (player2.isAttacking && player2.attackType === "slap") {
          player2.slapSpacingBeforeExtension = pairDist;
        }
        enforceStrikeExtensionSeparation(player1, player2, room.simTime);
        enforceStrikeExtensionSeparation(player2, player1, room.simTime);
      }

      // Facing is enforced once per tick AFTER movement (see enforcePairFacing
      // below). Early/mid-tick writes from attacks / grabs still snapshot locks;
      // locomotion no longer owns facing.

      // Phase 4B: publish the palm's held-out-arm window before collision so the
      // debug overlay resolves the same authored variant authority will query.
      refreshPalmLimbExtended(player1, room.simTime);
      refreshPalmLimbExtended(player2, room.simTime);

      if (player1.isAttacking) {
        checkCollision(player1, player2, rooms, io);
      }
      if (player2.isAttacking) {
        checkCollision(player2, player1, rooms, io);
      }

      // Air body hitbox: slide-jump / FLAP flight (Honda-style, not only S dive).
      // Polled every tick (it isn't a regular `isAttacking` strike).
      if (player1.isSlideJumping) {
        checkFlapBodySlam(player1, player2, rooms, io);
      }
      if (player2.isSlideJumping) {
        checkFlapBodySlam(player2, player1, rooms, io);
      }

      // Dev-only offensive-aerial tick snapshots (OFFENSIVE_AERIAL_DEBUG/TRACE).
      // No gameplay mutation; never rides the production delta wire.
      if (OFFENSIVE_AERIAL_DEBUG) {
        if (player1.isSlideJumping) {
          if (!player1._offensiveAerialTrace) {
            beginOffensiveAerialTrace(player1, {
              simTime: room.simTime,
              source: "index_early_pair",
            });
          }
          recordOffensiveAerialTick(
            player1,
            buildOffensiveAerialTickSnapshot({
              simTime: room.simTime,
              attacker: player1,
              defender: player2,
              contactResult: player1.slideJumpHitLanded
                ? "hit_latched"
                : player1.isRecovering && !player1.isSlideJumping
                  ? "parried_or_cleared"
                  : null,
            })
          );
        } else if (player1._offensiveAerialTrace) {
          flushOffensiveAerialTrace(player1, "slide_jump_ended");
        }
        if (player2.isSlideJumping) {
          if (!player2._offensiveAerialTrace) {
            beginOffensiveAerialTrace(player2, {
              simTime: room.simTime,
              source: "index_early_pair",
            });
          }
          recordOffensiveAerialTick(
            player2,
            buildOffensiveAerialTickSnapshot({
              simTime: room.simTime,
              attacker: player2,
              defender: player1,
              contactResult: player2.slideJumpHitLanded
                ? "hit_latched"
                : player2.isRecovering && !player2.isSlideJumping
                  ? "parried_or_cleared"
                  : null,
            })
          );
        } else if (player2._offensiveAerialTrace) {
          flushOffensiveAerialTrace(player2, "slide_jump_ended");
        }
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
        const currentTime = now;
        if (!room.readyStartTime) {
          // May seed slightly ahead so the bout card isn't clipped on the
          // no-salt path — see tachiaiStartAt.
          room.readyStartTime = tachiaiStartAt(currentTime, room.boutCardAtSim);
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
          // Audit log opens here (idempotent across rounds within a match).
          openAuditLog(room);
          startBoutClock(room);
          io.in(room.id).emit("game_start", true);
          io.in(room.id).emit("bout_clock", BOUT_SECONDS);
          player1.isReady = false;
          player2.isReady = false;
          // Only reset mouse1PressTime if the player wasn't already charging
          // from the pre-round tachiai. Preserve their charge seamlessly.
          if (!player1.isChargingAttack) {
            player1.mouse1PressTime = 0;
          }
          if (!player2.isChargingAttack) {
            player2.mouse1PressTime = 0;
          }
          // Same held-strafe buffer apply as handleReadyPositions (this path
          // can fire first at 2700ms).
          for (const p of [player1, player2]) {
            if (p.movementKeysBufferedBeforeStart) {
              const buf = p.movementKeysBufferedBeforeStart;
              p.keys = p.keys || {};
              if (buf.a) p.keys.a = true;
              if (buf.d) p.keys.d = true;
              p.movementKeysBufferedBeforeStart = null;
            }
            p.canMoveToReady = false;
          }
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
            player.isChargedHitRecoil = false;
          }
          const recoveryElapsed = room.simTime - player.recoveryStartTime;
          const isRecoveryGameOverLoser = room.gameOver && player.id === room.loserId;

          // Round over: the WINNER's recovery slide is killed immediately —
          // no drifting across the dohyo during the result presentation. The
          // loser keeps momentum so the knockout slide still reads naturally.
          if (room.gameOver && !isRecoveryGameOverLoser) {
            player.movementVelocity = 0;
          }

          // Apply ice-like physics to recovery movement
          if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
            // Charged on-hit recoil settles on its own FAST friction (snappy pop,
            // short slide) so the attacker holds pressure range; everything else
            // uses the slow global ice coast.
            player.movementVelocity *= player.isChargedHitRecoil
              ? CHARGED_RECOIL_FRICTION
              : MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;

            // Calculate new position with sliding
            const newX =
              player.x + delta * speedFactor * player.movementVelocity;

            // Calculate effective boundary based on player size
            const sizeOffset = 0;

            // Only use map boundaries during recovery
            const leftBoundary = MAP_LEFT_BOUNDARY;
            const rightBoundary = MAP_RIGHT_BOUNDARY;

            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            } else if (isRecoveryGameOverLoser) {
              player.x = newX;
            } else {
              player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
              player.movementVelocity = 0;
            }
          }

          // End recovery state after duration
          if (recoveryElapsed >= player.recoveryDuration) {
            player.isRecovering = false;
            player.movementVelocity = 0;
            player.recoveryDirection = null;
            player.isChargedHitRecoil = false;
            player.isPalmThrust = false;
            player.isLowKick = false;
            player.palmThrustVisualUntil = 0;

            // Clean up stale chargedAttackHit flag after recovery ends
            // This flag is set by processHit and never cleared by safelyEndChargedAttack
            // (since safelyEndChargedAttack doesn't run for connected attacks)
            if (player.chargedAttackHit) {
              player.chargedAttackHit = false;
            }
          }
        }
      });


      // Projectile updates (snowballs + pumo army)
      updateProjectiles(room, io, delta);

    }

    // Players Loop
    room.players.forEach((player) => {
      // Skip most simulation while hitstop is active to create brief, readable freezes
      if (isRoomInHitstop(room)) {
        return;
      }

      // FORCE OUT: pair block owns X (incl. clinch-attach lock). Here only pin
      // Y/velocities and honor round reset — don't overwrite spacing.
      if (player.isRingOutPushCutscene) {
        player.y = GROUND_LEVEL;
        player.movementVelocity = 0;
        player.knockbackVelocity.x = 0;
        player.knockbackVelocity.y = 0;
        if (
          room.gameOver &&
          now - room.gameOverTime >= 2000 &&
          !room.matchOver &&
          !room.bashoAwaitingReset
        ) {
          resetRoomAndPlayers(room, io);
        }
        return;
      }

      const isGameOverLoser = room.gameOver && player.id === room.loserId;
      if (isGameOverLoser && !player.isHit && !player.isCinematicKillVictim &&
          !player.isClinchKillPullVictim && !player.isClinchKillThrowVictim &&
          !player.isBeingThrown && !player.isGrabBreakSeparating &&
          Math.abs(player.movementVelocity) < ICE_STOP_THRESHOLD &&
          Math.abs(player.knockbackVelocity.x) < 0.01) {
        return;
      }

      // Round over: the winner gets NO residual slide physics — ice coast,
      // post-dodge momentum, and leftover knockback are all zeroed every tick
      // so they stand firm during the result presentation. The loser is
      // exempt: their knockout momentum carries them out naturally (and
      // decays on its own once they fall off the dohyo).
      if (room.gameOver && !isGameOverLoser) {
        player.movementVelocity = 0;
        player.knockbackVelocity.x = 0;
      }

      // Clear knockback immunity when timer expires
      if (
        player.knockbackImmune &&
        now >= player.knockbackImmuneEndTime
      ) {
        player.knockbackImmune = false;
      }

      // Clear grab immunity (post-grab-break protection) when timer expires
      if (
        player.grabImmune &&
        now >= player.grabImmuneEndTime
      ) {
        player.grabImmune = false;
      }

      // Self-heal: the shove-off pose exists only for as long as the shove does.
      // Anything that tears the tween down out of band (boundary swap fixups,
      // a round reset mid-slide) would otherwise strand the palms extended.
      if (player.isGrabSeparatePalm && !player.isGrabBreakSeparating) {
        player.isGrabSeparatePalm = false;
      }

      // Smooth grab-break separation tween overrides other movement for its duration
      if (player.isGrabBreakSeparating) {
        const elapsed = now - (player.grabBreakSepStartTime || now);
        const duration = player.grabBreakSepDuration || 0;
        const startX = player.grabBreakStartX ?? player.x;
        const targetX = player.grabBreakTargetX ?? player.x;
        const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
        const isBoundarySwap = player.isBoundaryPullSwap;
        // Default is the hit curve — quickest at contact, decelerating to a stop
        // like sliding on ice. A tween that stamped its own curve (the drive
        // release asks for "shove") keeps it; the boundary swap needs its
        // crossing at t=0.5 to line up with the arc peak.
        const eased = grabSeparationEase(
          t,
          player.grabBreakSepCurve || (isBoundarySwap ? "swap" : "hit")
        );
        let newX = startX + (targetX - startX) * eased;

        // For pull reversal, clamp to a margin inside boundaries so they stop before the edge
        // Kill-pull / AP-parry-kill victims may cross the rope, but dirt compresses
        // ice overshoot so the belly-slide doesn't keep full ice carry off-ring.
        const isPullTween = player.isBeingPullReversaled;
        const isKillPullVictim = player.isClinchKillPullVictim;
        if (isKillPullVictim) {
          const slidingRight = targetX >= startX;
          const mapEdge = slidingRight ? MAP_RIGHT_BOUNDARY : MAP_LEFT_BOUNDARY;
          const dohyoEdge = slidingRight ? DOHYO_RIGHT_BOUNDARY : DOHYO_LEFT_BOUNDARY;
          const pastMap = slidingRight ? newX > mapEdge : newX < mapEdge;
          if (pastMap) {
            const iceOvershoot = Math.abs(newX - mapEdge);
            let dirtOvershoot = iceOvershoot * KILL_PULL_DIRT_OVERSHOOT_SCALE;
            const apronWidth = Math.abs(dohyoEdge - mapEdge);
            if (dirtOvershoot > apronWidth) {
              dirtOvershoot =
                apronWidth +
                (dirtOvershoot - apronWidth) * KILL_PULL_DIRT_FALL_OVERSHOOT_SCALE;
            }
            newX = slidingRight ? mapEdge + dirtOvershoot : mapEdge - dirtOvershoot;
          }
        }
        const leftBound = isKillPullVictim
          ? -Infinity
          : isPullTween ? MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN : MAP_LEFT_BOUNDARY;
        const rightBound = isKillPullVictim
          ? Infinity
          : isPullTween ? MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN : MAP_RIGHT_BOUNDARY;
        const clampedX = Math.max(leftBound, Math.min(newX, rightBound));
        player.x = clampedX;
        if (isPullTween && t < 1) {
          if (isBoundarySwap) {
            // Single sine arc — peaks at midpoint so pulled player hops over the puller
            player.y = GROUND_LEVEL + CLINCH_PULL_SWAP_ARC_HEIGHT * Math.sin(t * Math.PI);
          } else if (isKillPullVictim) {
            // Belly-slide: the sprite is already flat on the ground, so emphasize the
            // SLIDE — just a tiny contact jolt as they hit, then hug the ice the whole
            // way. No big hops (those would lift the flat penguin into the air).
            const JOLT_END = 0.12;
            if (t < JOLT_END) {
              const jt = t / JOLT_END;
              player.y = GROUND_LEVEL + 12 * Math.sin(jt * Math.PI);
            } else {
              player.y = GROUND_LEVEL;
            }
          } else {
            // Normal pull: decaying hops after a delay so the player slides then bounces
            const HOP_DELAY = 0.18;
            if (t > HOP_DELAY) {
              const HOP_COUNT = 4;
              const HOP_HEIGHTS = [26, 17, 10, 4];
              const hopT = (t - HOP_DELAY) / (1 - HOP_DELAY);
              const hopProgress = hopT * HOP_COUNT;
              const hopIndex = Math.min(Math.floor(hopProgress), HOP_COUNT - 1);
              const hopPhase = hopProgress - Math.floor(hopProgress);
              const maxHeight = HOP_HEIGHTS[hopIndex] || 0;
              const hopY = maxHeight * Math.sin(hopPhase * Math.PI);
              player.y = GROUND_LEVEL + hopY;
            } else {
              player.y = GROUND_LEVEL;
            }
          }
        } else {
          player.y = GROUND_LEVEL;
        }
        player.movementVelocity = 0;
        player.knockbackVelocity.x = 0;
        player.knockbackVelocity.y = 0;
        player.isStrafing = false;

        // If pulled player hits boundary margin during pull, end tween early.
        // Kill-pull victims are exempt — they fly the full distance through the boundary.
        const hitBoundary = isPullTween && !isKillPullVictim && t > 0.05 &&
          Math.abs(newX - clampedX) > 1;

        if (t >= 1 || hitBoundary) {
          // End tween — ensure player is back on the ground.
          // Kill-pull victims that landed past the dohyo edge should fall off
          // instead of snapping back to ground level.
          const killPullLandedOffDohyo = isKillPullVictim &&
            (player.x <= DOHYO_LEFT_BOUNDARY || player.x >= DOHYO_RIGHT_BOUNDARY);
          if (killPullLandedOffDohyo) {
            player.y = GROUND_LEVEL - DOHYO_FALL_DEPTH;
            player.isFallingOffDohyo = true;
          } else {
            player.y = GROUND_LEVEL;
          }
          player.isGrabBreakSeparating = false;
          player.grabBreakSepStartTime = 0;
          player.grabBreakSepDuration = 0;
          player.grabBreakStartX = undefined;
          player.grabBreakTargetX = undefined;
          player.grabBreakSepCurve = null;
          // The shove-off pose lives exactly as long as the shove. Cleared here
          // rather than on a timer so it can never outlive an early-ended tween.
          player.isGrabSeparatePalm = false;

          // Grab tech: feed residual velocity into ice sliding after forced separation
          if (player.grabTechResidualVel) {
            player.movementVelocity = player.grabTechResidualVel;
            player.grabTechResidualVel = 0;
          }

          // Auto-clear associated visual states when tween ends
          // These are mutually exclusive states that use the same tween mechanism
          if (player.isGrabSeparating) player.isGrabSeparating = false;
          if (player.isBoundaryPullSwap) player.isBoundaryPullSwap = false;
          if (player.isBeingPullReversaled) {
            const wasBoundarySwap = isBoundarySwap;
            player.isBeingPullReversaled = false;
            player.isBoundaryPullSwap = false;
            player.pullFacingDirection = null;
            // Release both players' input locks when pull tween ends
            player.inputLockUntil = 0;
            // Find and release the puller too
            let pullerRef = null;
            if (player.pullReversalPullerId) {
              const allPlayers = room.players || [];
              pullerRef = allPlayers.find(p => p.id === player.pullReversalPullerId);
              if (pullerRef) {
                pullerRef.inputLockUntil = 0;
                pullerRef.isAttemptingPull = false;
                pullerRef.isBoundaryPullSwap = false;
                pullerRef.pullFacingDirection = null;
                // Boundary swap: also terminate the puller's slide tween for neutral frame advantage
                if (wasBoundarySwap && pullerRef.isGrabBreakSeparating) {
                  if (pullerRef.grabBreakTargetX !== undefined) {
                    pullerRef.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(pullerRef.grabBreakTargetX, MAP_RIGHT_BOUNDARY));
                  }
                  pullerRef.isGrabBreakSeparating = false;
                  pullerRef.grabBreakSepStartTime = 0;
                  pullerRef.grabBreakSepDuration = 0;
                  pullerRef.grabBreakStartX = undefined;
                  pullerRef.grabBreakTargetX = undefined;
                }
              }
              player.pullReversalPullerId = null;
            }
            // Kill-pull finishers: do NOT fall into normal movement (MAP clamps /
            // slapParryKnockback) or re-arm buffered actions after the slide.
            if (isKillPullVictim) {
              player.slapParryKnockbackVelocity = 0;
              player.movementVelocity = 0;
              return;
            }
            // Side-switch settle: pull facing lock cleared above. Re-correct from
            // settled X (mirrors throw land). Clear ropes facing locks in-bounds.
            if (player.x > MAP_LEFT_BOUNDARY && player.x < MAP_RIGHT_BOUNDARY) {
              player.atTheRopesFacingDirection = null;
            }
            if (
              pullerRef &&
              pullerRef.x > MAP_LEFT_BOUNDARY &&
              pullerRef.x < MAP_RIGHT_BOUNDARY
            ) {
              pullerRef.atTheRopesFacingDirection = null;
            }
            if (pullerRef) {
              correctFacingAfterGrabOrThrow(player, pullerRef);
            }
            // Activate buffered inputs for both players (0 frame advantage)
            activateBufferedInputAfterGrab(player, rooms);
            if (pullerRef) {
              activateBufferedInputAfterGrab(pullerRef, rooms);
            }
          }
          if (player.isGrabBreaking) {
            player.isGrabBreaking = false;
            activateBufferedInputAfterGrab(player, rooms);
          }
          if (player.isGrabBreakCountered) {
            player.isGrabBreakCountered = false;
            activateBufferedInputAfterGrab(player, rooms);
          }

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
      } else if (
        player.isHit ||
        (player.isHitFalling && Math.abs(player.knockbackVelocity?.x || 0) > 0.01)
      ) {
        // Air-hit dump keeps horizontal KB after stun ends (heavy sumo shove
        // must not die mid-air). Same friction / rope clamps as grounded hit.
        // Cinematic kill victims fly off with no friction, no DI, no slowdown
        if (player.isHit && player.isCinematicKillVictim) {
          player.x += player.knockbackVelocity.x * delta * speedFactor;
        } else {
          // SAFETY: Maximum isHit duration to prevent stuck states (1 second max)
          const MAX_HIT_DURATION = 1000;
          const hitDuration = player.lastHitTime ? room.simTime - player.lastHitTime : 0;
          if (player.isHit && hitDuration > MAX_HIT_DURATION) {
            player.isHit = false;
            player.isAlreadyHit = false;
            player.isSlapKnockback = false;
            player.isBurstKnockback = false;
            player.isChargedKnockback = false;
            player.burstKnockbackStartTime = 0;
            player.isParryKnockback = false;
            // Still air-dumping — keep residual KB for the fall coast.
            if (!player.isHitFalling) {
              player.knockbackVelocity.x = 0;
              player.movementVelocity = 0;
            }
            // Don't return - continue normal processing
          } else {
            // Standard knockback — knockbackVelocity drives displacement
            player.x =
              player.x + player.knockbackVelocity.x * delta * speedFactor;

            const isOutsideDohyo = player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY;
            const isPastMapBoundaries = player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY;
            
            if (isOutsideDohyo && !player.isFallingOffDohyo) {
              player.isFallingOffDohyo = true;
            }

            const isLoserAfterGameOver = room.gameOver && player.id === room.loserId;
            
            if (player.isFallingOffDohyo) {
              const targetY = GROUND_LEVEL - DOHYO_FALL_DEPTH;
              if (isLoserAfterGameOver) {
                if (player.y !== targetY) player.y = targetY;
              } else if (player.y > targetY) {
                player.y = Math.max(targetY, player.y - DOHYO_FALL_SPEED);
              }
              // Dirt past the fall edge — strong but smooth horizontal bleed
              player.knockbackVelocity.x *= OUTSIDE_DOHYO_DIRT_KB_FRICTION;
            } else if (isPastMapBoundaries) {
              // Off the ice the moment they cross the rope (don't wait for
              // gameOver — that fires later in the same tick loop).
              player.knockbackVelocity.x *= PAST_MAP_DIRT_KB_FRICTION;
            } else {
              // MOMENTUM TRANSFER — one friction for knockback and free glide.
              // The old per-move split (burst 0.982 / slap 0.97 / charged 0.96)
              // meant a shove's reach depended on WHICH MOVE threw it rather
              // than how hard it landed. Sharing ICE_COAST_FRICTION also makes
              // the hitstun-end handoff continuous: a shove flows into a glide
              // with no speed discontinuity, which is where the ice feel lives.
              //
              // DI stays a per-tick friction multiplier, universal across every
              // knockback type. Burst and charged used to lock it out; there is
              // no longer a reason to, since kill speed is governed by the
              // floor/ceiling values rather than by removing the defender's
              // control of their own slide.
              const knockbackDirection = player.knockbackVelocity.x > 0 ? 1 : -1;
              const isHoldingOpposite =
                (knockbackDirection > 0 && player.keys.a && !player.keys.d) ||
                (knockbackDirection < 0 && player.keys.d && !player.keys.a);

              player.knockbackVelocity.x *= KB_FRICTION;
              if (isHoldingOpposite) {
                player.knockbackVelocity.x *= DI_FRICTION_FACTOR;
              }
            }

            // Parry knockback cannot push past map boundaries
            if (player.isParryKnockback) {
              const PARRY_BOUNDARY_BUFFER = 10;
              const clampedX = Math.max(
                MAP_LEFT_BOUNDARY + PARRY_BOUNDARY_BUFFER,
                Math.min(player.x, MAP_RIGHT_BOUNDARY - PARRY_BOUNDARY_BUFFER)
              );
              if (clampedX !== player.x) {
                player.x = clampedX;
                player.knockbackVelocity.x = 0;
              }
            }

            // Slap/palm rope resistance: unless this hit was armed for a
            // ring-out (victim posture was already < CLINCH_THROW_KILL_THRESHOLD
            // BEFORE the hit's drain — see processHit), the rope catches
            // them at the edge instead of letting the knockback carry them
            // out. Same buffer logic as the parry clamp. Hitstun is
            // timer-based, so stopping the slide here changes only the
            // victim's resting POSITION, never the recovery timing — frame
            // advantage stays identical, keeping the exchange neutral.
            if (player.isSlapKnockback && !player.slapKnockbackCanRingOut) {
              const clampedX = Math.max(
                MAP_LEFT_BOUNDARY + SLAP_ROPE_RESIST_BUFFER,
                Math.min(player.x, MAP_RIGHT_BOUNDARY - SLAP_ROPE_RESIST_BUFFER)
              );
              if (clampedX !== player.x) {
                player.x = clampedX;
                player.knockbackVelocity.x = 0;
              }
            }

            // PHASE 2 — CHARGED ROPE RESISTANCE. A charged hit outside the edge
            // kill zone (midscreen deadzone / not enough killReach — see
            // processHit) carries the victim at full charged velocity until the
            // rope catches them — slam TO the rope (same 12px buffer), not
            // through it. Edge ring-outs (including non-cinematic taps) set
            // chargedKnockbackCanRingOut and pass through; cinematic victims
            // also fly out via the isCinematicKillVictim branch above.
            if (player.isChargedKnockback && !player.chargedKnockbackCanRingOut) {
              const clampedX = Math.max(
                MAP_LEFT_BOUNDARY + SLAP_ROPE_RESIST_BUFFER,
                Math.min(player.x, MAP_RIGHT_BOUNDARY - SLAP_ROPE_RESIST_BUFFER)
              );
              if (clampedX !== player.x) {
                player.x = clampedX;
                player.knockbackVelocity.x = 0;
              }
            }

            // Clear at-the-ropes facing lock if back within boundaries
            if (player.atTheRopesFacingDirection !== null) {
              const isWithinBoundaries = player.x > MAP_LEFT_BOUNDARY && player.x < MAP_RIGHT_BOUNDARY;
              if (isWithinBoundaries) {
                player.atTheRopesFacingDirection = null;
                player.isAtTheRopes = false;
                player.atTheRopesStartTime = 0;
              }
            }

            // Hitstun is purely timer-based — no velocity-based isHit reset.
            // The processHit timer is the ONLY thing that ends hitstun.
          }
        }
      }

      // Handle slap parry knockback (smooth sliding that doesn't interrupt attack state)
      // Kill-pull victims must never enter this path — its MAP clamp is the wall
      // that was eating AP / clinch belly-slides into the dohyo apron.
      if (
        !player.isClinchKillPullVictim &&
        Math.abs(player.slapParryKnockbackVelocity) > 0.01
      ) {
        const newX = player.x + player.slapParryKnockbackVelocity * delta * speedFactor;
        
        const BOUNDARY_BUFFER = 10;
        const clampedX = Math.max(
          MAP_LEFT_BOUNDARY + BOUNDARY_BUFFER,
          Math.min(newX, MAP_RIGHT_BOUNDARY - BOUNDARY_BUFFER)
        );

        if (clampedX !== newX) {
          // Hit boundary — bounce back slightly so the cornered player visibly reacts
          player.slapParryKnockbackVelocity *= -0.25;
        }

        player.x = clampedX;
        
        player.slapParryKnockbackVelocity *= SLAP_PARRY_KB_FRICTION;
        
        if (Math.abs(player.slapParryKnockbackVelocity) < 0.01) {
          player.slapParryKnockbackVelocity = 0;
        }
      }

      // Apply separation velocity after grab push ends (movement section blocks input during isGrabSeparating,
      // but the separation velocity still needs to be applied so players slide apart).
      if (player.isGrabSeparating && Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
        player.x += delta * speedFactor * player.movementVelocity;
        player.movementVelocity *= ICE_COAST_FRICTION;
        if (Math.abs(player.movementVelocity) < MIN_MOVEMENT_THRESHOLD) {
          player.movementVelocity = 0;
        }
        player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));
      }

      // Process buffered inputs for human players.
      // Runs every tick after state transitions so buffered actions fire on the
      // first frame the player becomes actionable (same tick-level fairness as CPU).
      // Never during round result — an input buffered while flying out (isHit
      // blocks immediate execution) must not fire after the loss is decided.
      if (!room.gameOver && !player.isCPU && player.inputBuffer) {
        executeInputBuffer(player, rooms);
      }

      // ── GRAB DIVE ───────────────────────────────────────────────────────
      // One impulse is stamped at grab start (beginGrabStartup); from here it is
      // pure friction, integrated exactly like every other moving thing on this
      // ice. Deliberately runs across the WHOLE dive — startup, active frames AND
      // whiff recovery — not just startup.
      //
      // That span is the point. The old fixed-distance version stopped the instant
      // startup ended, which turned the 110ms active window into a stationary
      // suction field (stand still, grab anyone who wanders inside GRAB_RANGE) and
      // made a whiffed grab stop dead as though it hit a wall. Carrying the
      // momentum makes the active window a moving body that catches what it runs
      // into, and makes the whiff a skid — the punish window reading as a punish.
      if (
        player.grabMovementVelocity &&
        (player.isGrabStartup ||
          player.isWhiffingGrab ||
          player.isGrabWhiffRecovery)
      ) {
        player.x = Math.max(
          MAP_LEFT_BOUNDARY,
          Math.min(
            player.x + delta * speedFactor * player.grabMovementVelocity,
            MAP_RIGHT_BOUNDARY
          )
        );
        player.grabMovementVelocity *= GRAB_LUNGE_FRICTION;
        if (Math.abs(player.grabMovementVelocity) < MIN_MOVEMENT_THRESHOLD) {
          player.grabMovementVelocity = 0;
        }
      } else if (player.grabMovementVelocity) {
        // Left every dive state — connected, got hit out of it, teched. Self-heal
        // so a stale impulse can never leak into a later action's movement.
        player.grabMovementVelocity = 0;
      }

      // Handle grab startup — dive carries it forward, then range check at the end.
      if (player.isGrabStartup) {
        const elapsed = room.simTime - player.grabStartupStartTime;
        const startupMs = player.grabStartupDuration || GRAB_STARTUP_DURATION_MS;

        if (elapsed >= startupMs) {
          // Startup over — the grab is active, so the variant stops being revisable.
          // Locking here rather than at connect is what stops a grab being held out
          // and having its variant chosen on the frame contact is seen. When already
          // in range (connect on the first active tick) these are the same instant.
          lockGrabVariant(player);
        }

        // CONNECT WINDOW: startup end through active end. Startup itself is
        // fully hittable — the grab carries no armor, so it only lands in a gap
        // between the opponent's active frames.
        if (elapsed >= startupMs) {
          const withinConnectWindow = elapsed < startupMs + GRAB_ACTIVE_MS;
          const opponent = room.players.find((p) => p.id !== player.id);

          // Grab tracks sidestep ONLY when the sidestepper is in a vulnerable,
          // CLEANLY SEPARATED state — i.e. startup, OR recovery once they are
          // no longer LITERALLY clipping the grabber (within
          // SIDESTEP_RECOVERY_OVERLAP_THRESHOLD = 80px). The active arc is
          // full i-frames, and during recovery while still clipping the grab
          // also whiffs (mirrors the strike i-frame rule in collisionSystem.js).
          // Without this, a sidestepper who landed inside the grabber would eat
          // a point-blank grab while still visually inside them — messy, not
          // skilful. Bad timing on startup, or recovery in a clean position,
          // both still get the grab.
          //
          // SUCCESS-ONLY: the recovery overlap i-frame applies only when the
          // sidestep PASSED the opponent (successful side switch). A failed
          // sidestep that ended overlapping the opponent is intentionally
          // exposed — that's the punish for bad range/timing.
          //
          // Threshold tightened from full pushbox (~116px @ 0.85 size) to 80px
          // (literal clipping) to match the strike i-frame fix — see
          // collisionSystem.js for the math on why the previous threshold ate
          // almost the entire 150ms recovery window.
          const opponentSidestepping = opponent && opponent.isSidestepping;
          const sidestepPushboxOverlap = opponentSidestepping &&
            Math.abs(player.x - opponent.x) < SIDESTEP_RECOVERY_OVERLAP_THRESHOLD;
          const opponentPassedPlayer = opponentSidestepping &&
            (opponent.x - player.x) * (opponent.sidestepDirection || 0) > 0;
          const opponentInSidestepInvuln = opponentSidestepping &&
            !opponent.isSidestepStartup &&
            (!opponent.isSidestepRecovery || (sidestepPushboxOverlap && opponentPassedPlayer));
          // MASTERY Phase 5 (5.1): tighten the grab's sidestep-tracking range so
          // spacing — not an auto-track table — answers the sidestep. A
          // point-blank read still catches the startup/recovery; a spaced
          // sidestep now escapes. Flag off ⇒ the original 400 range (unchanged).
          const sidestepGrabTrackRange = MASTERY_P5_ASSISTS
            ? SIDESTEP_GRAB_TRACK_RANGE_P5
            : SIDESTEP_GRAB_TRACK_RANGE;
          const sidestepTrackInRange = opponentSidestepping &&
            !opponentInSidestepInvuln &&
            Math.abs(player.x - opponent.x) < sidestepGrabTrackRange;
          const normalGrabInRange = opponent && !opponentSidestepping && isOpponentCloseEnoughForGrab(player, opponent) && isOpponentInFrontOfGrabber(player, opponent);

          // Ground grab only — airborne / air-hit-dump victims are ungrabbable
          // (CPU + humans). Matches cpuAI isOpponentAirborne.
          const opponentAirborneForGrab =
            (opponent.isRopeJumping && opponent.ropeJumpPhase === "active") ||
            (opponent.isFlapping && opponent.flapPhase === "flight") ||
            (opponent.isSlideJumping && opponent.slideJumpPhase === "flight") ||
            opponent.isHitFalling ||
            opponent.isIceSlideReverseHopping ||
            (typeof opponent.y === "number" && opponent.y > GROUND_LEVEL + 8);
          if (opponent && !opponentAirborneForGrab && (normalGrabInRange || sidestepTrackInRange)) {
            // === TECH CHECK: opponent also in grab startup → both tech ===
            // Whiffing players CANNOT tech — they are fully vulnerable.
            // Also check if opponent's startup has already expired AND their grab
            // would NOT have connected (out of range or facing wrong way).
            // This prevents tick processing order from causing false techs.
            const opponentWouldWhiff = opponent.isGrabStartup &&
              (room.simTime - opponent.grabStartupStartTime) >= (opponent.grabStartupDuration || GRAB_STARTUP_DURATION_MS) &&
              !(isOpponentCloseEnoughForGrab(opponent, player) && isOpponentInFrontOfGrabber(opponent, player));
            if ((opponent.isGrabStartup || opponent.isGrabTeching) &&
                !opponent.isWhiffingGrab && !opponent.isGrabWhiffRecovery &&
                !opponentWouldWhiff) {
              // A simultaneous grab is a mutual whiff, not a shared clinch entry.
              // Nobody won the initiate, so nobody gets a reset to fish for —
              // both eat the ordinary grab whiff recovery.
              executeCommandGrabClash(player, opponent, room, io);
              return;
            }

            // === GRAB CHECK: opponent is in range and grabbable ===
            // Grabs beat dodges at any point — the hard counter to dodge.
            // Grab immunity (post-clinch-break) blocks re-engagement so the
            // breaker isn't punish-grabbed the instant their input lock ends.
            const opponentGrabImmune = opponent.grabImmune && now < opponent.grabImmuneEndTime;
            const opponentGrabbableNeutral =
              !opponent.isBeingThrown &&
              !opponent.isBeingGrabbed &&
              !player.isBeingGrabbed &&
              !player.throwTechCooldown &&
              !opponentGrabImmune;
            // Any live attack blocks the connect — slap included, now that the
            // throw-catch is gone. A grab that reaches active frames while the
            // opponent is still swinging simply does not connect.
            const canConnect =
              opponentGrabbableNeutral && !opponent.isAttacking;

            if (canConnect) {
              // MATADOR: grab would have connected into a live grab-parry →
              // instant pull (no clinch). Checked before any clinch setup.
              if (opponent.isMatadorParrying) {
                resolveMatadorPull(opponent, player, room, io);
                return;
              }

              // SUCCESSFUL GRAB — same connect logic as before
              player.isGrabStartup = false;
              if (isActionFacingOwnershipV2Enabled()) {
                releaseActionFacingLock(player, {
                  expectedInstanceId: player.grabFacingInstanceId,
                  expectedOwnerType: ACTION_FACING_OWNER.GRAB_STARTUP,
                  reason: ACTION_FACING_RELEASE.TRANSFER,
                  clearLegacy: false,
                });
                player.grabFacingInstanceId = null;
              }
              player.y = GROUND_LEVEL;
              player.grabMovementVelocity = 0;
              player.movementVelocity = 0;
              player.isStrafing = false;
              player.grabState = GRAB_STATES.INITIAL;
              player.grabAttemptType = null;

              player.isGrabbing = true;
              player.grabStartTime = now;
              player.grabbedOpponent = opponent.id;

              // PHASE 3.2 — "caught the henka": a grab that connects on a victim
              // still in sidestep-recovery / rope-jump landing floors the Phase A
              // approach speed so the burst push carries them back cornerward.
              if (opponent.isSidestepRecovery ||
                  (opponent.isRopeJumping && opponent.ropeJumpPhase === "landing")) {
                player.grabApproachSpeed = Math.max(player.grabApproachSpeed || 0, GRAB_CATCH_MIN_BURST_SPEED);
              }

              // Grip on connect — both sides. This is a presentation state that
              // lasts only as long as the grab action (belt-grip read → variant →
              // resolution), not an open-ended subgame.
              player.hasGrip = true;
              player.inClinch = true;
              player.gripAcquiredTime = now;
              opponent.hasGrip = true;
              opponent.inClinch = true;
              opponent.gripAcquiredTime = now;

              // MASTERY Phase 2 (2.3): yotsu conversion. Catching a broken-posture
              // victim floors the approach speed, which now feeds the Drive carry
              // distance — the striking setup that broke posture pays off in a
              // longer drive. Deep Grip used to be granted here too; it was retired
              // with the clinch subgame it arbitrated, and posture already scales
              // every grab's travel directly.
              if (MASTERY_P2_POSTURE && opponent.isPostureBroken) {
                player.grabApproachSpeed = Math.max(
                  player.grabApproachSpeed || 0,
                  GRAB_CATCH_MIN_BURST_SPEED
                );
              }

              player.grabActionStartTime = 0;
              player.grabDurationPaused = false;
              player.grabDurationPausedAt = 0;
              player.isAtBoundaryDuringGrab = false;
              player.lastGrabPushStaminaDrainTime = 0;
              player.isAttemptingPull = false;
              player.isAttemptingGrabThrow = false;

              // COUNTER GRAB: grab landed while the opponent was raw-parrying.
              // ARM CLAMP: strong advantage — victim offense locked during the
              // Phase A burst / convert window; Plant brace remains (not a free
              // or untechable throw). Clears on burst end, boundary contact, or
              // once the grabber's filed technique is no longer pending/active.
              // Seeds a balance debuff so the punish scales with prior damage.
              const wasOpponentRawParrying = opponent.isRawParrying;
              opponent.isCounterGrabbed = wasOpponentRawParrying;

              if (wasOpponentRawParrying) {
                // ARM CLAMP used to lock the victim's clinch offense; there is no
                // post-connect offense left to lock. The counter-grab still pays
                // off, and more directly: the posture debuff feeds the
                // posture-scaled travel, so grabbing a parry carries and throws
                // further on its own.
                applyBalanceDamage(opponent, COUNTER_GRAB_BALANCE_DEBUFF, now);
                const grabberPlayerNumber = room.players.indexOf(player) === 0 ? 1 : 2;
                const centerX = (player.x + opponent.x) / 2;
                const centerY = (player.y + opponent.y) / 2;
                {
                  const counterId = `counter-grab-${now}-${Math.random().toString(36).substr(2, 9)}`;
                  const clinchId = ensureClinchInstanceId(player, opponent, now);
                  io.in(room.id).emit(
                    "counter_grab",
                    attachCombatPresentation(
                      {
                        type: "counter_grab",
                        grabberId: player.id,
                        grabbedId: opponent.id,
                        grabberX: player.x,
                        grabbedX: opponent.x,
                        x: centerX,
                        y: centerY,
                        grabberPlayerNumber,
                        counterId,
                      },
                      buildClinchPresentation({
                        interactionType: CLINCH_INTERACTION.COUNTER_GRAB,
                        clinchInstanceId: clinchId,
                        actionInstanceId: counterId,
                        initiator: player,
                        responder: opponent,
                        outcome: "COUNTER_GRAB",
                        contactX: opponent.x,
                        contactY: CLINCH_EFFECT_MID_Y,
                        salt: "counter_grab",
                      })
                    )
                  );
                }
              }

              player.isRawParrySuccess = false;
              player.isPerfectRawParrySuccess = false;

              clearAllActionStates(opponent);
              opponent.y = GROUND_LEVEL;
              opponent.isBeingGrabbed = true;
              opponent.isBeingGrabPushed = false;
              opponent.lastGrabPushStaminaDrainTime = 0;

              triggerHitstopAndEmit(io, room, HITSTOP_GRAB_MS, "grab");

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

              // Open the belt-grip read beat and commit the variant locked at the
              // end of startup. Runs last so it sees the fully-established grip
              // state (including a counter-grab).
              lockGrabVariant(player);
              beginCommandGrab(player, opponent, room, io);
            } else if (withinConnectWindow) {
              // In range but ungrabbable (charged/palm, immune, etc.) — retest.
              return;
            } else {
              // Connect window expired still ungrabbable — whiff
              executeGrabWhiff(player);
            }
          } else if (withinConnectWindow) {
            // Out of range — keep lunging/waiting; opponent may enter range.
            return;
          } else {
            // Connect window expired out of range — whiff
            executeGrabWhiff(player);
          }
        } else {
          // Startup — lunge only, fully hittable on every frame.
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
      // FORCE OUT cutscene intentionally walks past the rope — don't clamp.
      if (
        player.isGrabbing &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isRingOutPushCutscene
      ) {
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

      // Near-edge tension: extra screen shake for dramatic near-ring-out moments.
      // The old "danger_zone" event for slow-mo was removed (no slow-mo system); the
      // dangerZoneTriggered flag now solely gates this once-per-knockback shake.
      if (isInDangerZone && !player.dangerZoneTriggered) {
        player.dangerZoneTriggered = true;
        emitThrottledScreenShake(room, io, { type: "danger_zone" });
      }

      // Reset danger zone flag when player is no longer hit
      if (!player.isHit && player.dangerZoneTriggered) {
        player.dangerZoneTriggered = false;
      }

      // Win Conditions - back to original state
      // Kill throw victims are excluded — their win is triggered at landing in the throw arc block
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
          !player.isClinchKillThrowVictim &&
          // Find the thrower to check their throwing direction
          (() => {
            const thrower = room.players.find(
              (p) => p.throwOpponent === player.id
            );
            if (!thrower) return false;

            // Normal forward throws clamp inside boundary margin — not ring-outs.
            if (!thrower.isRingOutThrowCutscene && !thrower.isClinchKillThrow) {
              return false;
            }

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

        let winType;
        if (player.isBeingThrown) {
          winType = "grabThrow";
        } else if (player.isCinematicKillVictim) {
          winType = "cinematicKill";
        } else if (player.isAtTheRopes) {
          winType = "okuridashi";
        } else {
          winType = player.lastHitType || "ringOut";
        }

        handleWinCondition(room, player, winner, io, winType);
        player.knockbackVelocity = { ...player.knockbackVelocity };
        
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
          handleWinCondition(room, player, winner, io, "ringOut");
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
        now - room.gameOverTime >= 2000 &&
        !room.matchOver &&
        !room.bashoAwaitingReset
      ) {
        resetRoomAndPlayers(room, io);
      }

      // Gassed BEFORE regen: any drain this tick (inputs, collisions, guard
      // crush) that hit 0 must lock exhausted state first. A regen pulse must
      // never rescue stamina back above 0 and skip the 5s penalty.
      player.stamina = clampStaminaValue(player.stamina);
      if (player.isGassed) {
        player.stamina = 0;
      } else if (!room.gameOver) {
        tryEnterGassed(player, now);
      }

      // Per-fighter stamina regen (freeze once round is over). Accumulates only
      // while eligible so gassed / grab / clinch pause the fighter's own clock
      // instead of sharing one server-wide metronome across rooms.
      if (
        player.stamina < 100 &&
        !room.gameOver &&
        !player.isBeingGrabbed &&
        !player.isGassed &&
        !player.inClinch
      ) {
        player.staminaRegenAccum = (player.staminaRegenAccum || 0) + delta;
        if (player.staminaRegenAccum >= STAMINA_REGEN_INTERVAL_MS) {
          player.staminaRegenAccum = 0;
          // BASHO STAMINA attribute scales regen rate (1.0 for non-BASHO).
          player.stamina += STAMINA_REGEN_AMOUNT * (player.statMods?.staminaRegen ?? 1);
          player.stamina = Math.min(player.stamina, 100);
        }
      }

      // Balance regen — Halo armor style. Damage sticks until the fighter goes
      // BALANCE_REGEN_DELAY_MS without ANY posture damage, then snaps back fast.
      // A new hit during regen stops it and restarts the delay. Clinch is a
      // cash-out zone: no regen while inClinch (plant locks vs push instead).
      if (player.balance < BALANCE_MAX && !room.gameOver && !player.inClinch) {
        const lastDmg = player.lastPostureDamageTime || 0;
        const delayElapsed =
          lastDmg === 0 || room.simTime - lastDmg >= BALANCE_REGEN_DELAY_MS;
        if (delayElapsed) {
          const deltaSec = delta / 1000;
          let balanceRegen = BALANCE_REGEN_PER_SEC;
          // BASHO BALANCE attribute scales balance regen rate (1.0 for non-BASHO).
          balanceRegen *= player.statMods?.balanceRegen ?? 1;
          if (player.isGassed) balanceRegen *= BALANCE_GASSED_REGEN_MULT;
          player.balance = Math.min(
            BALANCE_MAX,
            player.balance + balanceRegen * deltaSec
          );
        }
      }

      // MASTERY Phase 2 (2.1): derive the broken-posture "openable" tell from
      // `balance` with hysteresis (breaks below POSTURE_BREAK_THRESHOLD, only
      // recovers above the higher POSTURE_RECOVER_THRESHOLD → no flicker). It
      // gates the yotsu (deep-grip on grab) and oshi (expanded kill band)
      // conversions and is broadcast for the client stagger overlay. A
      // posture_break event fires on the break edge for the crack SFX. With the
      // flag OFF the state is forced false and never read, so the sim is
      // byte-identical (invariants #2 & #4).
      if (MASTERY_P2_POSTURE) {
        if (player.isPostureBroken) {
          if (player.balance > POSTURE_RECOVER_THRESHOLD) player.isPostureBroken = false;
        } else if (player.balance < POSTURE_BREAK_THRESHOLD && !player.isDead) {
          player.isPostureBroken = true;
          if (!room.gameOver) {
            io.in(room.id).emit("posture_break", {
              playerId: player.id,
              playerNumber: room.players.indexOf(player) === 0 ? 1 : 2,
              x: player.x,
              y: player.y,
            });
          }
        }
      } else if (player.isPostureBroken) {
        // Flag toggled off at runtime — clear the stale tell.
        player.isPostureBroken = false;
      }

      // if (player.isHit) return;

      if (
        !player.isRingOutFreezeActive &&
        player.isThrowing &&
        player.throwOpponent
      ) {
        const currentTime = now;
        const throwDuration = currentTime - player.throwStartTime;
        const throwProgress = Math.max(0,
          throwDuration / (player.throwEndTime - player.throwStartTime));

        const opponent = room.players.find(
          (p) => p.id === player.throwOpponent
        );
        if (opponent) {
          const throwArcHeight = player.isRingOutThrowCutscene ? 75
            : player.isClinchKillThrow ? CLINCH_KILL_THROW_ARC_HEIGHT
            : (player.clinchThrowArcHeight > 0
              ? player.clinchThrowArcHeight
              : CLINCH_THROW_ARC_HEIGHT);
          const isNormalForwardThrow = !player.isRingOutThrowCutscene && !player.isClinchKillThrow;
          let armsReachDistance = player.isRingOutThrowCutscene ? -100 : 50;

          if (!player.throwingFacingDirection) {
            player.throwingFacingDirection = player.facing;
            opponent.beingThrownFacingDirection = opponent.facing;
            if (!player.isRingOutThrowCutscene) {
              opponent.x =
                player.x + player.throwingFacingDirection * armsReachDistance;
            }
            opponent.y = GROUND_LEVEL;
          }

          // Ring-out cutscene manages its own facing; forward throws (normal + kill) keep existing facing
          if (player.isRingOutThrowCutscene) {
            opponent.facing = opponent.beingThrownFacingDirection;
          }

          if (player.isRingOutThrowCutscene) {
            const throwingDir = player.throwingFacingDirection || 1;
            const currentSeparation = opponent.x - player.x;
            armsReachDistance = currentSeparation * throwingDir;
          }

          let throwDistance;
          if (player.isRingOutThrowCutscene) {
            const extraOutward = player.ringOutThrowDistance || 4;
            throwDistance = armsReachDistance + Math.max(extraOutward, 0);
          } else if (player.isClinchKillThrow) {
            throwDistance = CLINCH_KILL_THROW_DISTANCE;
          } else {
            // Clinch Flow P2 — Balance-scaled travel (stamped at resolve).
            throwDistance =
              player.clinchThrowArcDistance > 0
                ? player.clinchThrowArcDistance
                : CLINCH_THROW_DISTANCE;
          }

          let newX =
            player.x +
            player.throwingFacingDirection *
              (armsReachDistance +
                (throwDistance - armsReachDistance) * throwProgress);

          // Normal throws stop short of map edge; kill throws travel freely (no clamping)
          if (isNormalForwardThrow) {
            const leftBound = MAP_LEFT_BOUNDARY + CLINCH_THROW_BOUNDARY_MARGIN;
            const rightBound = MAP_RIGHT_BOUNDARY - CLINCH_THROW_BOUNDARY_MARGIN;
            newX = Math.max(leftBound, Math.min(newX, rightBound));
          }

          opponent.x = newX;

          // Y arc
          if (player.isRingOutThrowCutscene) {
            const arcProgress = 4 * throwProgress * (1 - throwProgress);
            const hopHeight = arcProgress * 60;
            opponent.y = GROUND_LEVEL + hopHeight;
          } else if (player.isClinchKillThrow) {
            // Ballistic-style arc (constant-g feel):
            //   • Near-symmetric peak — rise and fall take similar time
            //   • Quadratic on both sides — decelerate up, accelerate down
            //   • No hang plateau / cubic whip (those read as a mid-air pause
            //     then a teleport slam)
            // Horizontal X stays linear with throwProgress = constant air speed.
            const PEAK_AT = 0.48;
            const clampedProgress = Math.min(throwProgress, 1);
            if (clampedProgress < PEAK_AT) {
              const riseT = clampedProgress / PEAK_AT;
              const eased = 1 - (1 - riseT) * (1 - riseT); // ease-out quad
              opponent.y = GROUND_LEVEL + eased * throwArcHeight;
            } else {
              const fallT = (clampedProgress - PEAK_AT) / (1 - PEAK_AT);
              const eased = fallT * fallT; // ease-in quad (same |g| family as rise)
              opponent.y = GROUND_LEVEL + throwArcHeight * (1 - eased);
            }
          } else {
            opponent.y =
              GROUND_LEVEL +
              3.2 * throwArcHeight * throwProgress * (1 - throwProgress);
          }

          // Check if throw is complete
          if (currentTime >= player.throwEndTime) {
            const wasKillThrow = player.isClinchKillThrow;

            if (wasKillThrow) {
              handleWinCondition(room, opponent, player, io, "clinchKillThrow");
              opponent.isClinchKillThrowVictim = true;
              {
                const landId = `kill-land-${currentTime}-${opponent.id}`;
                const clinchId = ensureClinchInstanceId(
                  player,
                  opponent,
                  currentTime
                );
                emitThrottledScreenShake(
                  room,
                  io,
                  attachCombatPresentation(
                    { type: "kill_throw_land", victimId: opponent.id, x: opponent.x, y: opponent.y },
                    buildClinchPresentation({
                      interactionType: CLINCH_INTERACTION.KILL_THROW_LAND,
                      clinchInstanceId: clinchId,
                      actionInstanceId: landId,
                      initiator: player,
                      responder: opponent,
                      outcome: "KILL_LAND",
                      throwType: "throw",
                      contactX: opponent.x,
                      contactY: opponent.y,
                      salt: "kill_land",
                    })
                  )
                );
              }
              // No landing hitstop for kill throw: room + client hitstop freeze the
              // sim and pin interpolated Y for ~100ms, which reads as a hitch right
              // as the victim touches down. Screen shake + particles sell the impact.
              room.forceBroadcast = true;
            }

            if (!player.isRingOutThrowCutscene && !wasKillThrow) {
              if (
                (opponent.x >= MAP_RIGHT_BOUNDARY &&
                  player.throwingFacingDirection === 1) ||
                (opponent.x <= MAP_LEFT_BOUNDARY &&
                  player.throwingFacingDirection === -1)
              ) {
                handleWinCondition(room, opponent, player, io, "grabThrow");
              } else {
                {
                  const landId = `throw-land-${currentTime}-${opponent.id}`;
                  const clinchId = ensureClinchInstanceId(
                    player,
                    opponent,
                    currentTime
                  );
                  emitThrottledScreenShake(
                    room,
                    io,
                    attachCombatPresentation(
                      { type: "throw_landing", victimId: opponent.id, x: opponent.x, y: opponent.y },
                      buildClinchPresentation({
                        interactionType: CLINCH_INTERACTION.THROW_LAND,
                        clinchInstanceId: clinchId,
                        actionInstanceId: landId,
                        initiator: player,
                        responder: opponent,
                        outcome: "LAND",
                        throwType: "throw",
                        contactX: opponent.x,
                        contactY: opponent.y,
                        salt: "throw_land",
                      })
                    )
                  );
                }
                triggerHitstopAndEmit(io, room, HITSTOP_THROW_MS, "throw");
              }
            }

            player.isThrowing = false;
            player.throwOpponent = null;
            if (isActionFacingOwnershipV2Enabled()) {
              releaseActionFacingLock(player, {
                expectedInstanceId: player.throwFacingInstanceId,
                expectedOwnerType: ACTION_FACING_OWNER.THROWER,
                reason: ACTION_FACING_RELEASE.ACTION_END,
                clearLegacy: false,
              });
              player.throwFacingInstanceId = null;
              releaseActionFacingLock(opponent, {
                expectedInstanceId: opponent.throwVictimFacingInstanceId,
                expectedOwnerType: ACTION_FACING_OWNER.THROW_VICTIM,
                reason: ACTION_FACING_RELEASE.ACTION_END,
                clearLegacy: false,
              });
              opponent.throwVictimFacingInstanceId = null;
            }
            player.throwingFacingDirection = null;
            player.throwStartTime = 0;
            player.throwEndTime = 0;
            player.isRingOutThrowCutscene = false;
            player.ringOutThrowDistance = 0;
            player.isClinchKillThrow = false;

            const landedOutsideBoundaries =
              opponent.x <= MAP_LEFT_BOUNDARY ||
              opponent.x >= MAP_RIGHT_BOUNDARY;

            opponent.isBeingThrown = false;
            opponent.beingThrownFacingDirection = null;
            opponent.isHit = false;
            opponent.isAlreadyHit = false;
            opponent.isSlapKnockback = false;
            opponent.isBurstKnockback = false;
            opponent.isChargedKnockback = false;
            opponent.burstKnockbackStartTime = 0;

            // Set Y to correct ground level based on landing context
            const landedOutsideDohyo = opponent.x <= DOHYO_LEFT_BOUNDARY || opponent.x >= DOHYO_RIGHT_BOUNDARY;
            if (wasKillThrow) {
              // Flat landing art sits on the ground — no -30 offset (that was for
              // the old 90°-rotated hit placeholder).
              if (landedOutsideDohyo) {
                opponent.y = GROUND_LEVEL - DOHYO_FALL_DEPTH;
                opponent.isFallingOffDohyo = true;
              } else {
                opponent.y = GROUND_LEVEL;
              }
            } else {
              if (landedOutsideDohyo) {
                opponent.y = GROUND_LEVEL - DOHYO_FALL_DEPTH;
                opponent.isFallingOffDohyo = true;
              } else {
                opponent.y = GROUND_LEVEL;
              }
            }

            // Enforce minimum separation on landing so players don't overlap at boundary
            if (!wasKillThrow && !landedOutsideBoundaries) {
              const dir = opponent.x - player.x;
              const dist = Math.abs(dir);
              if (dist < CLINCH_THROW_MIN_SEPARATION) {
                const sign = dir >= 0 ? 1 : -1;
                const desired = player.x + sign * CLINCH_THROW_MIN_SEPARATION;
                const leftBound = MAP_LEFT_BOUNDARY + CLINCH_THROW_BOUNDARY_MARGIN;
                const rightBound = MAP_RIGHT_BOUNDARY - CLINCH_THROW_BOUNDARY_MARGIN;
                opponent.x = Math.max(leftBound, Math.min(desired, rightBound));
              }
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
        const currentTime = now;
        const throwDuration = currentTime - player.throwStartTime;
        const throwProgress =
          throwDuration / (player.throwEndTime - player.throwStartTime);

        if (currentTime >= player.throwEndTime) {
          player.isThrowing = false;
        }
      }

      // NOTE: Legacy throw-tech freeze handling was removed along with the
      // legacy W-throw input path (nothing sets isThrowTeching anymore).

      // Grounded dash dodge — slides forward on the ground, triggers dodge slap if deep enough into opponent
      if (player.isDodging && player.isBeingGrabbed) {
        player.isDodging = false;
        player.isDodgeStartup = false;
        player.dodgeDirection = null;
        if (isActionFacingOwnershipV2Enabled()) {
          releaseActionFacingLock(player, {
            expectedInstanceId: player.dodgeFacingInstanceId,
            expectedOwnerType: ACTION_FACING_OWNER.DODGE,
            reason: ACTION_FACING_RELEASE.ACTION_END,
            clearLegacy: false,
          });
          player.dodgeFacingInstanceId = null;
        }
        player.y = GROUND_LEVEL;
      }
      // S-key dodge cancel — stops the dash immediately
      if (player.isDodging && !player.isBeingGrabbed && player.keys.s) {
        player.isDodging = false;
        player.isDodgeStartup = false;
        player.dodgeDirection = null;
        if (isActionFacingOwnershipV2Enabled()) {
          releaseActionFacingLock(player, {
            expectedInstanceId: player.dodgeFacingInstanceId,
            expectedOwnerType: ACTION_FACING_OWNER.DODGE,
            reason: ACTION_FACING_RELEASE.ACTION_END,
            clearLegacy: false,
          });
          player.dodgeFacingInstanceId = null;
        }
        player.y = GROUND_LEVEL;
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isBraking = false;
        player.isPowerSliding = false;
        player.actionLockUntil = Math.max(player.actionLockUntil || 0, now + DODGE_CANCEL_ACTION_LOCK);

        const cancelOpponent = room.players.find(p => p.id !== player.id);
        if (cancelOpponent && !player.atTheRopesFacingDirection) {
          player.facing = player.x < cancelOpponent.x ? -1 : 1;
        }
      }
      if (player.isDodging && !player.isBeingGrabbed) {
        const dodgeOpponent = room.players.find(p => p.id !== player.id);

        // STARTUP PHASE: no movement yet, brief wind-up
        if (player.isDodgeStartup) {
          if (now >= player.dodgeStartupEndTime) {
            player.isDodgeStartup = false;
          }
          // No movement during startup — player is committed but stationary
        }
        // ACTIVE PHASE: fixed-distance hop. Speed buffs raise rate (capped) so
        // the hop finishes sooner — they never extend travel past dodgeTargetX.
        else {
          let dodgeRate = 1;
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            dodgeRate *= Math.min(player.powerUpMultiplier * 0.85, DODGE_SPEED_MULT_CAP);
          }
          // BASHO draft: Happy Feet speeds the hop up (same dampening), never
          // lengthens it. speedMult ≤ 1 leaves rate alone (dodge isn't slowed).
          if ((player.bashoDraft?.speedMult ?? 1) > 1) {
            dodgeRate *= Math.min(player.bashoDraft.speedMult * 0.85, DODGE_SPEED_MULT_CAP);
          }
          dodgeRate = Math.min(dodgeRate, DODGE_SPEED_MULT_CAP);

          const currentDodgeSpeed = speedFactor * DODGE_BASE_SPEED * dodgeRate;
          const dir = player.dodgeDirection || 1;
          const targetX =
            typeof player.dodgeTargetX === "number"
              ? player.dodgeTargetX
              : player.x + dir * DODGE_TRAVEL_DISTANCE;

          let newX = player.x + dir * delta * currentDodgeSpeed;
          // Never overshoot the fixed hop end.
          if (dir > 0) newX = Math.min(newX, targetX);
          else newX = Math.max(newX, targetX);
          newX = Math.max(MAP_LEFT_BOUNDARY, Math.min(newX, MAP_RIGHT_BOUNDARY));

          // Pushbox: stop at opponent's body instead of phasing through.
          // Phase-through used to be allowed during opponent's charged active
          // (paired with the dodge i-frame so the dodger slipped past the
          // lunge cleanly). With the dodge i-frame against charged removed,
          // phase-through would just produce a messy hit landing while bodies
          // overlap, so dodge now always pushbox-collides regardless of
          // opponent attack type.
          // EXCEPTION: an airborne opponent has no ground pushbox — you can dash
          // freely underneath them. Covers a flapper in flight (only their
          // descending body-slam connects) and a rope-jumper in its airborne
          // active arc (both are hit-immune while overhead).
          const dodgeOppAirborne =
            dodgeOpponent &&
            ((dodgeOpponent.isFlapping && dodgeOpponent.flapPhase === "flight") ||
              (dodgeOpponent.isRopeJumping && dodgeOpponent.ropeJumpPhase === "active") ||
              (dodgeOpponent.isSlideJumping && dodgeOpponent.slideJumpPhase === "flight"));
          if (dodgeOpponent && !dodgeOpponent.isDead && !dodgeOppAirborne) {
            const bodyWidth = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, dodgeOpponent.sizeMultiplier || 1);
            const wouldOverlap = Math.abs(newX - dodgeOpponent.x) < bodyWidth;
            if (wouldOverlap) {
              if (dir > 0 && dodgeOpponent.x > player.x) {
                newX = Math.min(newX, dodgeOpponent.x - bodyWidth);
              } else if (dir < 0 && dodgeOpponent.x < player.x) {
                newX = Math.max(newX, dodgeOpponent.x + bodyWidth);
              }
              newX = Math.max(MAP_LEFT_BOUNDARY, Math.min(newX, MAP_RIGHT_BOUNDARY));
            }
          }

          player.y = GROUND_LEVEL;
          player.x = newX;

          // Arrived at fixed end early → land now (don't idle in dodge state).
          if ((dir > 0 && player.x >= targetX - 0.01) || (dir < 0 && player.x <= targetX + 0.01)) {
            player.dodgeEndTime = Math.min(player.dodgeEndTime || now, now);
          }
        }

        // Dodge active phase expired → transition to RECOVERY PHASE
        if (now >= player.dodgeEndTime) {
          const landingDirection = player.dodgeDirection || 0;
          player.isDodging = false;
          player.isDodgeStartup = false;
          player.dodgeDirection = null;
          if (isActionFacingOwnershipV2Enabled()) {
            releaseActionFacingLock(player, {
              expectedInstanceId: player.dodgeFacingInstanceId,
              expectedOwnerType: ACTION_FACING_OWNER.DODGE,
              reason: ACTION_FACING_RELEASE.ACTION_END,
              clearLegacy: false,
            });
            player.dodgeFacingInstanceId = null;
          }
          player.y = GROUND_LEVEL;
          player.isStrafing = false;
          player.isBraking = false;

          if (dodgeOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
            player.facing = player.x < dodgeOpponent.x ? -1 : 1;
          }

          // Landing momentum on ice.
          // MASTERY Phase 1: a dodge INHERITS the speed carried into it — walk→
          // dodge→slap chains build real momentum with no runway. Base blends
          // dodgeEntrySpeed (captured at dodge start, before it zeroed) into the
          // landing slide; the powerslide (C held) path multiplies the SAME base
          // by DODGE_POWERSLIDE_BOOST, exactly as before. At entry speed 0 the
          // base is clamped to DODGE_LANDING_MIN == today's DODGE_SLIDE_MOMENTUM
          // (invariant #2). Flag off ⇒ the flat DODGE_SLIDE_MOMENTUM as today.
          const landingBase = MASTERY_P1_MOMENTUM
            ? Math.max(
                DODGE_LANDING_MIN,
                Math.min(
                  DODGE_LANDING_BASE + K_DODGE_INHERIT * (player.dodgeEntrySpeed || 0),
                  DODGE_LANDING_MAX
                )
              )
            : DODGE_SLIDE_MOMENTUM;
          // Power slide removed — dodge landing just carries the base landing momentum.
          player.movementVelocity = landingDirection * landingBase;

          if (player.keys.a && !player.keys.d) {
            player.movementVelocity -= 0.2;
          } else if (player.keys.d && !player.keys.a) {
            player.movementVelocity += 0.2;
          }

          // SHIFT held through dodge land → committed ice slide (sliding pose).
          // Tap-release SHIFT keeps today's soft ice coast.
          // (New dodges are locked while gassed; this only applies if a dodge
          // already started before the gassed state began.)
          if (player.keys.shift && landingDirection !== 0) {
            player.isIceSliding = true;
            player.iceSlideDir = landingDirection > 0 ? 1 : -1;
            player.iceSlideStartTime = now;
            player.slideJumpBufferUntil = 0;
            player.isBraking = false;
            player.isStrafing = false;
          } else {
            clearIceSlideState(player);
          }

          // MASTERY Phase 1: stamp the dodge's landing momentum into the carry
          // window so the next slap inherits it reliably (even a buffered
          // mouse1), instead of racing the landing slide's decay. Captures the
          // full landing velocity — including the C-held powerslide boost and
          // the A/D nudge above.
          if (MASTERY_P1_MOMENTUM) {
            stampMomentumWindow(player, player.movementVelocity, now);
          }

          player.justLandedFromDodge = true;
          player.dodgeLandTime = now;

          // Enter RECOVERY PHASE — punishable, can't act
          player.isDodgeRecovery = true;
          player.dodgeRecoveryEndTime = now + DODGE_RECOVERY_MS;
          player.actionLockUntil = Math.max(player.actionLockUntil || 0, now + DODGE_RECOVERY_MS);
        }
      }

      // Dodge recovery phase — clear when expired
      if (player.isDodgeRecovery && now >= player.dodgeRecoveryEndTime) {
        player.isDodgeRecovery = false;
        player.dodgeRecoveryEndTime = 0;
        player.dodgeCooldownUntil = now + DODGE_COOLDOWN_MS;
      }

      // Clear dodge landing flag after animation duration (200ms)
      if (player.justLandedFromDodge && player.dodgeLandTime) {
        if (now - player.dodgeLandTime > 200) {
          player.justLandedFromDodge = false;
        }
      }
      
      // MASTERY Phase 1: an active power slide continuously refreshes the
      // momentum carry window, so a slap fired DURING or just AFTER the slide
      // reliably inherits its speed (this is the "same with the sliding" fix —
      // no more guessing whether the boost will land). Only real slide speed
      // stamps; a slide that has decayed to a crawl carries nothing.
      if (
        MASTERY_P1_MOMENTUM &&
        player.isPowerSliding &&
        Math.abs(player.movementVelocity) > SLIDE_MAINTAIN_VELOCITY
      ) {
        stampMomentumWindow(player, player.movementVelocity, now);
      }

      // ── SIDESTEP arc physics ──
      // Fixed-speed arc with dynamic opponent tracking.
      // Active phase: move at constant speed toward opponent's far side.
      // Recovery phase: smooth ease-out slide to final landing position.
      // Side switch succeeds only if the arc carries you past the opponent.
      if (player.isSidestepping && player.isBeingGrabbed) {
        player.isSidestepping = false;
        player.isSidestepStartup = false;
        player.isSidestepRecovery = false;
        player.sidestepDirection = 0;
        player.postSidestepFacingTrackUntil = 0;
        player.y = GROUND_LEVEL;
      }
      if (player.isSidestepping && !player.isBeingGrabbed) {
        const sidestepOpponent = room.players.find(p => p.id !== player.id && !p.isDead);

        // STARTUP: no movement, vulnerable wind-up.
        // At the end of startup, lock the trajectory: fixed lateral travel,
        // fixed duration. Side-switching is an emergent outcome of being close
        // enough to the opponent that the arc carries you past them — not a
        // hard branch in code.
        if (player.isSidestepStartup) {
          if (now >= player.sidestepStartupEndTime) {
            player.isSidestepStartup = false;

            // PHASE 3.1: a sidestep STARTED inside the edge-panic zone travels
            // less — escaping the corner stops being a full positional refund.
            const startDistToEdge = Math.min(
              player.sidestepStartX - MAP_LEFT_BOUNDARY,
              MAP_RIGHT_BOUNDARY - player.sidestepStartX
            );
            const sidestepTravel = startDistToEdge < DOHYO_EDGE_PANIC_ZONE
              ? SIDESTEP_TRAVEL_EDGE
              : SIDESTEP_TRAVEL;
            const targetX = player.sidestepStartX + player.sidestepDirection * sidestepTravel;
            player.sidestepTargetX = Math.max(MAP_LEFT_BOUNDARY, Math.min(targetX, MAP_RIGHT_BOUNDARY));

            player.sidestepActiveEndTime = now + SIDESTEP_ACTIVE_MS;
            player.sidestepEndTime = player.sidestepActiveEndTime + SIDESTEP_RECOVERY_MS;
            player.actionLockUntil = player.sidestepEndTime;
          }
        }
        // ACTIVE: fixed-trajectory ease-in-out arc toward the locked target.
        // Travel distance, duration, and arc depth are all constants — every
        // sidestep looks identical regardless of where the opponent is.
        // The downward Y dip represents stepping forward around the dohyo's
        // near edge (toward the camera in 2D), NOT a leap.
        else if (!player.isSidestepRecovery) {
          const activeElapsed = now - player.sidestepStartupEndTime;
          const t = Math.min(activeElapsed / SIDESTEP_ACTIVE_MS, 1);

          const easeT = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2;

          player.x = player.sidestepStartX + (player.sidestepTargetX - player.sidestepStartX) * easeT;
          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));

          player.y = GROUND_LEVEL - SIDESTEP_ARC_DEPTH * Math.sin(Math.PI * t);
        }

        // TRANSITION: active → recovery
        // Arc delivered the player to the locked target. The recovery slide
        // pushes the sidestepper out to a clean separation distance any time
        // they landed clipping the opponent's pushbox — and only when they
        // successfully passed the opponent in the arc direction (committing
        // to the side switch).
        //
        // If the arc fell short (didn't pass the opponent), we DO NOT yank the
        // player backward to "fix" overlap. The sidestep is a committed move:
        // a short attempt that landed in the opponent is supposed to read as
        // exposed/punishable, not as a graceful self-correction. Holding
        // position here removes the previous "arc continues backward" weirdness.
        // Any residual clipping at sidestep end is resolved by adjustPlayerPositions.
        if (now >= player.sidestepActiveEndTime && !player.isSidestepStartup && !player.isSidestepRecovery) {
          player.isSidestepRecovery = true;
          player.y = GROUND_LEVEL;
          player.x = player.sidestepTargetX;

          // LANDING_SEP is bumped well past pushbox (~116px @ 0.85 size) so
          // the final settle position is clearly separated and post-recovery
          // hits land on cleanly-spaced bodies, not edge-clipping sprites.
          const LANDING_SEP = 140;
          if (sidestepOpponent) {
            const currentDist = Math.abs(player.x - sidestepOpponent.x);
            // Signed offset along the arc direction:
            //   > 0 means we passed the opponent in the direction we sidestepped
            //   ≤ 0 means we didn't make it past
            const passedOpponent = (player.x - sidestepOpponent.x) * player.sidestepDirection > 0;

            // Trigger the slide whenever bodies are pushbox-clipping (the full
            // body width, not just the tighter literal-clipping threshold).
            // Previously this used SIDESTEP_RECOVERY_OVERLAP_THRESHOLD (80px),
            // which meant a sidestep that landed at e.g. 90px past the
            // opponent — visually still inside the pushbox — would HOLD there
            // for the entire 150ms recovery, leaving attacks landing on
            // overlapping sprites the whole time. Using the full pushbox
            // width pushes ANY clipping landing out to a clean position.
            const pushboxWidth = HITBOX_DISTANCE_VALUE * 2 *
              Math.max(player.sizeMultiplier || 1, sidestepOpponent.sizeMultiplier || 1);
            // Don't push out from under an airborne opponent — they have no
            // ground pushbox, so a sidestep should settle freely beneath them
            // (flapper in flight or rope-jumper in its airborne active arc).
            const sidestepOppAirborne =
              (sidestepOpponent.isFlapping && sidestepOpponent.flapPhase === "flight") ||
              (sidestepOpponent.isRopeJumping && sidestepOpponent.ropeJumpPhase === "active") ||
              (sidestepOpponent.isSlideJumping && sidestepOpponent.slideJumpPhase === "flight");
            if (currentDist < pushboxWidth && passedOpponent && !sidestepOppAirborne) {
              const idealX = sidestepOpponent.x + player.sidestepDirection * LANDING_SEP;
              player.sidestepRecoveryTargetX = Math.max(MAP_LEFT_BOUNDARY,
                Math.min(idealX, MAP_RIGHT_BOUNDARY));
            } else {
              player.sidestepRecoveryTargetX = player.x;
            }
          } else {
            player.sidestepRecoveryTargetX = player.x;
          }

          if (sidestepOpponent && !player.atTheRopesFacingDirection) {
            player.facing = player.x < sidestepOpponent.x ? -1 : 1;
          }
        }

        // RECOVERY: ease-out settle. Quartic (1 - (1-t)^4) front-loads the
        // slide more than the previous quadratic curve, so visual clipping
        // resolves in ~22ms instead of ~59ms. The trade-off is a slightly
        // higher peak slide speed (~2900 px/sec for typical landings vs
        // ~1200 px/sec quadratic), but still well below "teleporty" — the
        // movement decelerates smoothly into the settle position. Total
        // recovery duration is unchanged so the punish window stays the same.
        if (player.isSidestepRecovery) {
          const recoveryElapsed = now - player.sidestepActiveEndTime;
          const recoveryT = Math.min(recoveryElapsed / SIDESTEP_RECOVERY_MS, 1);
          const inv = 1 - recoveryT;
          const easeOut = 1 - inv * inv * inv * inv; // quartic ease-out

          const arcLandX = player.sidestepTargetX;
          player.x = arcLandX + (player.sidestepRecoveryTargetX - arcLandX) * easeOut;
          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));

          // Track opponent during recovery settle. isSidestepping still freezes
          // facing via getLockedFacing, but we rewrite the frozen value from
          // live X — so a charged lunge crossing mid-recovery doesn't leave
          // stale facing for the first post-sidestep action. No side change ⇒
          // same facing (no-op for non-side-switch sidesteps).
          if (sidestepOpponent && !player.atTheRopesFacingDirection) {
            player.facing = player.x < sidestepOpponent.x ? -1 : 1;
          }
        }

        // END: cleanup
        if (now >= player.sidestepEndTime) {
          player.isSidestepping = false;
          player.isSidestepStartup = false;
          player.isSidestepRecovery = false;
          player.sidestepDirection = 0;
          player.y = GROUND_LEVEL;
          player.actionLockUntil = 0;

          // Clear stale attack-intent timestamps. Mouse1 presses DURING the
          // sidestep are buffer mashes, not real "I tried to attack you back"
          // intent — counterHitFromIntent uses attackIntentTime within a 150ms
          // window, so without this clear, a slap landing 1–150ms AFTER sidestep
          // ends would incorrectly classify as a counter hit (because the stale
          // buffered intent timestamp is still fresh) instead of either a clean
          // punish (during recovery, handled via isSidestepRecovery) or a normal
          // hit (just after sidestep ended). Real attack intent expressed AFTER
          // sidestep ends will set the timestamps fresh again on the next press.
          player.attackIntentTime = 0;
          player.attackAttemptTime = 0;

          if (sidestepOpponent && !player.atTheRopesFacingDirection) {
            player.facing = player.x < sidestepOpponent.x ? -1 : 1;
          }
          // Cover charged-lunge side flips under an immediate follow-up action.
          player.postSidestepFacingTrackUntil = now + POST_SIDESTEP_FACING_TRACK_MS;
        }
      }

      // ── ROPE JUMP arc physics ──
      if (player.isRopeJumping) {
        if (player.ropeJumpPhase === "startup") {
          if (now >= player.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
            player.ropeJumpPhase = "active";
            player.ropeJumpActiveStartTime = now;
          }
        } else if (player.ropeJumpPhase === "active") {
          const ropeJumpOpponent = room.players.find(p => p.id !== player.id);
          // V2: commit a valid endpoint mid-arc and travel continuously to it.
          // Legacy (flag off): fixed ropeJumpTargetX; pushbox may slide out after land.
          const landResult = stepRopeJumpActive(player, ropeJumpOpponent, now, {
            useV2: isRopeJumpLandingV2Enabled(),
          });

          // Dev-only diagnostic packet — never part of the normal PvP delta stream.
          if (landResult.debugPayload && player.socketId) {
            io.to(player.socketId).emit("landing_diag", landResult.debugPayload);
          }

          if (landResult.touchedDown) {
            player.actionLockUntil = now + ROPE_JUMP_LANDING_RECOVERY_MS;
            // Legacy relies on adjustPlayerPositions (≤18px/tick) after overlap.
            // V2 should already be clear; the 18px cap remains as safety only.
            emitThrottledScreenShake(room, io, { type: "rope_landing" });
          }
        } else if (player.ropeJumpPhase === "landing") {
          if (now >= player.ropeJumpLandingTime + ROPE_JUMP_LANDING_RECOVERY_MS) {
            finalizeLandingTrace(player, {
              safetyCorrectionPx: player.ropeJumpSafetyCorrectionPx,
            });
            player.isRopeJumping = false;
            player.ropeJumpPhase = null;
            player.ropeJumpStartTime = 0;
            player.ropeJumpStartX = 0;
            player.ropeJumpTargetX = 0;
            player.ropeJumpDirection = 0;
            player.ropeJumpActiveStartTime = 0;
            player.ropeJumpLandingTime = 0;
            clearRopeJumpLandingState(player);
            player.currentAction = null;
            player.actionLockUntil = 0;

            const ropeJumpOpponent = room.players.find(p => p.id !== player.id);
            if (ropeJumpOpponent) {
              player.facing = player.x < ropeJumpOpponent.x ? -1 : 1;
            }

            // Attack buffer: if mouse1 was released during landing recovery,
            // fire the buffered attack now (slap if quick tap, charged attack if held)
            if (player.ropeJumpBufferedAttackRelease) {
              player.ropeJumpBufferedAttackRelease = 0;
              executeSlapAttack(player, rooms);
            }
          }
        }
      }

      // ── ICE SLIDE (SHIFT-held post-dodge) + SLIDE JUMP (W) ──
      if (player.isIceSliding && !player.isDodging && !player.isSlideJumping) {
        // Interrupt: hit / grab / attack / etc. already clear via clearAllActionStates.
        // Also bail if another exclusive grounded action started.
        if (
          player.isHit ||
          player.isAttacking ||
          player.isGrabbing ||
          player.isGrabStartup ||
          player.isBeingGrabbed ||
          player.isRawParrying ||
          player.isFlapping ||
          player.isRopeJumping ||
          player.isSidestepping
        ) {
          clearIceSlideState(player);
        } else if (
          // Stay planted while SHIFT is held — slow/zero speed is for reverse dig,
          // not slide eject (eject → SHIFT repress becomes a dodge).
          !player.keys.shift &&
          Math.abs(player.movementVelocity) < ICE_SLIDE_EXIT_SPEED &&
          !player.isIceSlideReverseHopping &&
          !(
            player.iceSlideReverseBufferUntil &&
            now <= player.iceSlideReverseBufferUntil
          )
        ) {
          clearIceSlideState(player);
        } else {
          const slideDir = player.iceSlideDir || (player.movementVelocity >= 0 ? 1 : -1);
          const holdingLeft = player.keys.a && !player.keys.d;
          const holdingRight = player.keys.d && !player.keys.a;
          const holdingWithSlide =
            (slideDir > 0 && holdingRight) || (slideDir < 0 && holdingLeft);
          const holdingAgainstSlide =
            (slideDir > 0 && holdingLeft) || (slideDir < 0 && holdingRight);
          const inReverseHop =
            player.isIceSlideReverseHopping &&
            player.iceSlideReverseHopUntil &&
            now < player.iceSlideReverseHopUntil;

          // Arm reverse dig while holding opposite of slide dir.
          if (holdingAgainstSlide && !inReverseHop) {
            if (!player.iceSlideBrakeArmStart) {
              player.iceSlideBrakeArmStart = now;
            }
          } else if (!holdingAgainstSlide) {
            player.iceSlideBrakeArmStart = 0;
          }

          // Consume SHIFT repress buffer once dig qualifies (order-tolerant input).
          if (
            !inReverseHop &&
            player.iceSlideReverseBufferUntil &&
            now <= player.iceSlideReverseBufferUntil
          ) {
            tryIceSlideReverse(player, now);
          } else if (
            player.iceSlideReverseBufferUntil &&
            now > player.iceSlideReverseBufferUntil
          ) {
            player.iceSlideReverseBufferUntil = 0;
          }

          const hopLive =
            player.isIceSlideReverseHopping &&
            player.iceSlideReverseHopUntil &&
            now < player.iceSlideReverseHopUntil;

          if (hopLive) {
            // Bunny-hop reverse: keep burst velocity, ride a tiny arc.
            player.isBraking = false;
            const hopT = Math.min(
              1,
              (now - (player.iceSlideReverseHopStartTime || now)) /
                ICE_SLIDE_REVERSE_HOP_MS
            );
            player.y =
              GROUND_LEVEL + ICE_SLIDE_REVERSE_HOP_HEIGHT * 4 * hopT * (1 - hopT);
          } else {
            if (player.isIceSlideReverseHopping) {
              player.isIceSlideReverseHopping = false;
              player.iceSlideReverseHopUntil = 0;
              player.y = GROUND_LEVEL;
            }

            if (holdingAgainstSlide) {
              player.movementVelocity *= ICE_SLIDE_OPPOSE_FRICTION;
              player.isBraking = true;
            } else if (player.keys.shift && holdingWithSlide) {
              // Sustain skate in the slide direction while SHIFT held.
              player.movementVelocity *= ICE_SLIDE_FRICTION;
              player.movementVelocity += slideDir * ICE_SLIDE_MAINTAIN;
              player.isBraking = false;
            } else if (player.keys.shift) {
              // SHIFT held / planted — keep slide ownership even near zero speed.
              player.movementVelocity *= ICE_SLIDE_FRICTION;
              if (Math.abs(player.movementVelocity) > ICE_SLIDE_EXIT_SPEED) {
                player.movementVelocity += slideDir * ICE_SLIDE_MAINTAIN;
              }
              player.isBraking = false;
            } else {
              // SHIFT released: coast until speed floor ends the slide.
              player.movementVelocity *= ICE_SLIDE_COAST_FRICTION;
              player.isBraking = holdingAgainstSlide;
            }

            player.y = GROUND_LEVEL;
          }

          // Soft cap
          if (player.movementVelocity > ICE_SLIDE_MAX_SPEED) {
            player.movementVelocity = ICE_SLIDE_MAX_SPEED;
          } else if (player.movementVelocity < -ICE_SLIDE_MAX_SPEED) {
            player.movementVelocity = -ICE_SLIDE_MAX_SPEED;
          }

          player.isStrafing = false;

          const slideSpeedFactor = speedFactor * getEffectiveMoveSpeedMult(player);
          let slideX = player.x + delta * slideSpeedFactor * player.movementVelocity;
          slideX = Math.max(MAP_LEFT_BOUNDARY, Math.min(slideX, MAP_RIGHT_BOUNDARY));
          if (slideX === MAP_LEFT_BOUNDARY || slideX === MAP_RIGHT_BOUNDARY) {
            player.movementVelocity *= 0.5;
          }
          player.x = slideX;

          // W jump: live after min flash; buffer early presses.
          const slideAge = now - (player.iceSlideStartTime || now);
          const jumpReady = slideAge >= SLIDE_JUMP_MIN_MS;
          if (player.wJustPressed) {
            if (jumpReady) {
              player.slideJumpBufferUntil = now; // consume immediately below
            } else {
              player.slideJumpBufferUntil = now + SLIDE_JUMP_BUFFER_MS;
            }
          }
          const bufferLive =
            player.slideJumpBufferUntil && now <= player.slideJumpBufferUntil;
          if ((jumpReady && bufferLive) || (jumpReady && player.wJustPressed)) {
            // Launch slide-jump
            const durationBonus = Math.min(
              1,
              Math.max(0, (slideAge - SLIDE_JUMP_MIN_MS) / SLIDE_JUMP_SCALE_MS)
            );
            const takeoffSpeed = Math.abs(player.movementVelocity);
            const hSpeed =
              SLIDE_JUMP_H_BASE +
              durationBonus * SLIDE_JUMP_H_BONUS +
              takeoffSpeed * SLIDE_JUMP_H_SPEED_SCALE;
            const jumpDir =
              player.iceSlideDir || (player.movementVelocity >= 0 ? 1 : -1);

            player.isSlideJumping = true;
            player.slideJumpPhase = "flight";
            player.slideJumpStartTime = now;
            player.slideJumpVelocityY = SLIDE_JUMP_LIFTOFF_IMPULSE;
            player.slideJumpVelocityX = jumpDir * hSpeed;
            player.facing = jumpDir > 0 ? -1 : 1;
            player.slideJumpDiveCommitted = false;
            player.slideJumpDiveBuffered = false;
            player.slideJumpDiveBufferUntil = 0;
            player.slideJumpDiveLockX = 0;
            player.slideJumpHitLanded = false;
            player.slideJumpHitRecoverDuration = 0;
            player.slideJumpLandingTime = 0;
            player.slideJumpBufferUntil = 0;
            player.slideJumpFlapFlightActive = false;
            player.flapVelocityX = 0;
            player.movementVelocity = 0;
            player.isStrafing = false;
            player.isBraking = false;
            player.currentAction = "slideJump";
            player.actionLockUntil = 0;
            // FLAP arms this jump with charges; physics stay plain slide-jump
            // until a charge is spent. Fresh bank every takeoff.
            armSlideJumpFlapCharges(player, now);
            // Outcome contract: only FLAP-armed takeoffs create an offensive
            // activation. Plain slide-jump is movement-only until dive/contact.
            if (player.slideJumpHasFlap) {
              beginOffensiveAerialActivation(player, {
                forceNew: true,
                moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
                offensiveArmed: true,
                movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.SLIDE_JUMP_FLIGHT,
                debugReason: "takeoff_flap_armed",
              });
            } else {
              // Ensure no stale activation from a prior jump survives takeoff.
              finalizeOffensiveAerialActivation(player, {
                debugReason: "takeoff_plain_clear",
              });
              player.offensiveAerial = null;
            }
            acquireOffensiveAerialFacingLock(player, {
              supersede: true,
              ownerInstanceId: player.offensiveAerial?.attackInstanceId || null,
              direction: player.facing,
              reason: FACING_LOCK_REASON.FLIGHT,
              releaseCondition: FACING_RELEASE.RECOVERY_COMPLETE,
              allowSteerUpdate: true,
              acquiredTick: room.tick || 0,
            });
            clearIceSlideState(player);
            // Consume the edge so rope-jump / other W readers don't also fire.
            player.wJustPressed = false;
          }
        }
      }

      // ── SLIDE JUMP flight / landing ──
      if (player.isSlideJumping) {
        const sjOpponent = room.players.find((p) => p.id !== player.id);

        if (player.slideJumpPhase === "flight") {
          player.isStrafing = false;
          const parryRecoil = isParriedRecoilActive(player);

          if (!parryRecoil) {
            // FLAP air charges: first spend switches this jump into classic FLAP
            // flight physics for the rest of the airtime. No spend → plain slide-jump.
            if (
              player.wJustPressed &&
              player.slideJumpHasFlap &&
              (player.flapCharges || 0) > 0 &&
              !player.slideJumpHitLanded &&
              !player.slideJumpDiveCommitted &&
              now - (player.lastFlapChargeTime || 0) >= FLAP_CHARGE_COOLDOWN_MS
            ) {
              const enteringFlapFlight = !player.slideJumpFlapFlightActive;
              player.slideJumpFlapFlightActive = true;
              player.flapCharges -= 1;
              player.slideJumpVelocityY = FLAP_IMPULSE;
              // Drop slide carry on first charge — flap air control + H-burst take over.
              if (enteringFlapFlight) {
                player.slideJumpVelocityX = 0;
              }
              // Directional flap = set H burst (same as old air flaps, not additive).
              if (player.keys.d && !player.keys.a) {
                player.flapVelocityX = FLAP_FLAP_H_IMPULSE;
                if (aerialFacingAllowsSteer(player)) {
                  updateOffensiveAerialFacingLockDirection(player, -1);
                  player.facing = -1;
                }
                player.flapBeatHDir = 1;
              } else if (player.keys.a && !player.keys.d) {
                player.flapVelocityX = -FLAP_FLAP_H_IMPULSE;
                if (aerialFacingAllowsSteer(player)) {
                  updateOffensiveAerialFacingLockDirection(player, 1);
                  player.facing = 1;
                }
                player.flapBeatHDir = -1;
              } else {
                player.flapBeatHDir = 0;
              }
              player.flapWingBeatTime = now;
              player.lastFlapChargeTime = now;
              player.wJustPressed = false;
            }

            // S belly-flop — pin X, kill horizontal, heavy plummet; burns charges.
            // Early S buffers through the min-air/height lock (no eaten input).
            if (shouldCommitSlideJumpDive(player, now)) {
              player.slideJumpDiveCommitted = true;
              player.slideJumpDiveBuffered = false;
              player.slideJumpDiveBufferUntil = 0;
              player.slideJumpDiveLockX = player.x;
              player.slideJumpVelocityX = 0;
              player.flapVelocityX = 0;
              player.flapCharges = 0;
              if (player.slideJumpVelocityY > 0) player.slideJumpVelocityY = 0;
              if (player.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
                player.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
              }
              // Dive arms offense on plain jumps; upgrades FLAP activation in place.
              beginOffensiveAerialActivation(player, {
                moveType: OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE,
                offensiveArmed: true,
                movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.DIVE,
                debugReason: "dive_commit",
              });
              acquireOffensiveAerialFacingLock(player, {
                supersede: true,
                ownerInstanceId: player.offensiveAerial?.attackInstanceId || null,
                direction: player.facing,
                reason: FACING_LOCK_REASON.DIVE,
                releaseCondition: FACING_RELEASE.RECOVERY_COMPLETE,
                allowSteerUpdate: false,
                acquiredTick: room.tick || 0,
              });
            }
          }

          player.slideJumpFastFalling = !parryRecoil && player.slideJumpDiveCommitted;
          const isDiveLocked = !parryRecoil && player.slideJumpDiveCommitted;
          const flapFlight = !parryRecoil && !!player.slideJumpFlapFlightActive;

          if (parryRecoil) {
            // Phase 4: reaction-owned heavy parry recoil (flag ON only).
            stepParriedRecoil(player, sjOpponent, now);
          } else if (flapFlight) {
            // ── Classic FLAP flight integrator ──
            const ceiling = GROUND_LEVEL + FLAP_MAX_HEIGHT;
            const cushionStart = ceiling - FLAP_CEILING_CUSHION;
            const inCeilingZone = player.y > cushionStart;

            if (!isDiveLocked && inCeilingZone && player.slideJumpVelocityY > 0) {
              const into = Math.min(
                1,
                (player.y - cushionStart) / FLAP_CEILING_CUSHION
              );
              player.slideJumpVelocityY *= Math.max(0, 1 - into);
            }

            const gravity = isDiveLocked
              ? FLAP_FASTFALL_GRAVITY
              : inCeilingZone
              ? FLAP_CEILING_HANG_GRAVITY
              : FLAP_GRAVITY;
            player.slideJumpVelocityY -= gravity;
            if (isDiveLocked) {
              if (player.slideJumpVelocityY > 0) player.slideJumpVelocityY = 0;
              if (player.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
                player.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
              }
            }
            player.y += player.slideJumpVelocityY;
            if (player.y > ceiling) {
              player.y = ceiling;
              if (player.slideJumpVelocityY > 0) player.slideJumpVelocityY = 0;
            }

            if (isDiveLocked) {
              player.slideJumpVelocityX = 0;
              player.flapVelocityX = 0;
              player.x = player.slideJumpDiveLockX;
            } else {
              if (player.keys.d && !player.keys.a) {
                player.x += FLAP_AIR_MOVE_SPEED;
                if (aerialFacingAllowsSteer(player)) {
                  updateOffensiveAerialFacingLockDirection(player, -1);
                  player.facing = -1;
                }
              } else if (player.keys.a && !player.keys.d) {
                player.x -= FLAP_AIR_MOVE_SPEED;
                if (aerialFacingAllowsSteer(player)) {
                  updateOffensiveAerialFacingLockDirection(player, 1);
                  player.facing = 1;
                }
              }
              if (player.flapVelocityX !== 0) {
                player.x += player.flapVelocityX;
                player.flapVelocityX *= FLAP_H_FRICTION;
                if (Math.abs(player.flapVelocityX) < 0.1) player.flapVelocityX = 0;
              }
            }
          } else {
            // ── Plain slide-jump arc (unchanged when no charges spent) ──
            const gravity = isDiveLocked ? FLAP_FASTFALL_GRAVITY : SLIDE_JUMP_GRAVITY;
            player.slideJumpVelocityY -= gravity;
            if (isDiveLocked) {
              if (player.slideJumpVelocityY > 0) player.slideJumpVelocityY = 0;
              if (player.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
                player.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
              }
            }
            player.y += player.slideJumpVelocityY;

            if (isDiveLocked) {
              player.slideJumpVelocityX = 0;
              player.x = player.slideJumpDiveLockX;
            } else {
              player.x += player.slideJumpVelocityX;
              if (player.keys.d && !player.keys.a) {
                player.x += SLIDE_JUMP_AIR_STEER;
                player.slideJumpVelocityX *= SLIDE_JUMP_AIR_STEER_BLEED;
                if (aerialFacingAllowsSteer(player)) {
                  updateOffensiveAerialFacingLockDirection(player, -1);
                  player.facing = -1;
                }
              } else if (player.keys.a && !player.keys.d) {
                player.x -= SLIDE_JUMP_AIR_STEER;
                player.slideJumpVelocityX *= SLIDE_JUMP_AIR_STEER_BLEED;
                if (aerialFacingAllowsSteer(player)) {
                  updateOffensiveAerialFacingLockDirection(player, 1);
                  player.facing = 1;
                }
              }
            }
          }
          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));

          if (!player.slideJumpHitLanded && sjOpponent) {
            checkFlapBodySlam(player, sjOpponent, rooms, io);
          }

          if (player.y <= GROUND_LEVEL && player.slideJumpVelocityY <= 0) {
            player.y = GROUND_LEVEL;
            player.slideJumpVelocityY = 0;
            player.slideJumpVelocityX = 0;
            player.flapVelocityX = 0;
            if (isDiveLocked) {
              player.x = player.slideJumpDiveLockX;
            }
            player.slideJumpPhase = "landing";
            player.slideJumpLandingTime = now;
            // Slam-only — strikes can still punish the land. Stops dual-jump
            // "first to floor eats an instant belly plant" from reading unfair.
            player.slideJumpLandSlamImmuneUntil =
              now + SLIDE_JUMP_LAND_SLAM_IFRAME_MS;
            player._oaTouchdownPresentation = true;
            // One opponent-facing handoff at touchdown (not travel-facing carry).
            handoffOffensiveAerialFacingAtTouchdown(player, sjOpponent, {
              acquiredTick: room.tick || 0,
            });
            const whiffRecovery = flapFlight || player.slideJumpFlapFlightActive
              ? FLAP_LANDING_RECOVERY_MS
              : SLIDE_JUMP_LANDING_RECOVERY_MS;
            let recovery = player.slideJumpHitLanded
              ? player.slideJumpHitRecoverDuration
              : whiffRecovery;
            // Outcome contract: WHIFF / LANDED_WITHOUT_CONTACT / preserve HIT|PARRIED.
            resolveOffensiveAerialTouchdownTerminal(player, {
              resolvedTime: now,
              reason: player.slideJumpHitLanded
                ? "touchdown_after_hit"
                : "touchdown",
              debugReason: "slide_jump_touchdown",
            });
            if (isOffensiveAerialReactionV2Enabled()) {
              const handoff = applyOffensiveAerialTouchdownHandoff(
                player,
                sjOpponent,
                now,
                { recoveryMs: recovery, debugReason: "slide_jump_touchdown" }
              );
              if (
                handoff.ok &&
                typeof handoff.recoveryMs === "number" &&
                player.offensiveAerial?.outcome ===
                  OFFENSIVE_AERIAL_OUTCOME.PARRIED
              ) {
                recovery = handoff.recoveryMs;
                player.slideJumpHitRecoverDuration = recovery;
              }
            }
            player.actionLockUntil = now + recovery;
            emitThrottledScreenShake(room, io, { type: "rope_landing" });
          }
        } else if (player.slideJumpPhase === "landing") {
          // Mirror flap landing: clear the live dive VFX flag, but keep
          // slideJumpDiveCommitted latched so the land-smoke path can still
          // read that this touchdown was a belly-flop (cleared on exit).
          player.slideJumpFastFalling = false;
          // One-tick TOUCHDOWN presentation, then LANDING_RECOVERY.
          if (player._oaTouchdownPresentation) {
            player._oaTouchdownPresentation = false;
          }
          const whiffRecovery = player.slideJumpFlapFlightActive
            ? FLAP_LANDING_RECOVERY_MS
            : SLIDE_JUMP_LANDING_RECOVERY_MS;
          let recovery = player.slideJumpHitLanded
            ? player.slideJumpHitRecoverDuration
            : whiffRecovery;
          if (
            player._oaParryControlRestoreAt &&
            player.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
          ) {
            recovery = Math.max(
              0,
              player._oaParryControlRestoreAt - player.slideJumpLandingTime
            );
          }

          if (sjOpponent && isOffensiveAerialReactionV2Enabled()) {
            // Instrument first grounded pushbox correction (Phase 5 input).
            // Actual separation still uses generic pushbox elsewhere this tick.
            recordTouchdownSpacingMetrics(player, sjOpponent, null);
          }

          const landDone =
            player._oaParryControlRestoreAt > 0
              ? now >= player._oaParryControlRestoreAt
              : now >= player.slideJumpLandingTime + recovery;

          if (landDone) {
            player.y = GROUND_LEVEL;
            cancelPendingSlapWork(player);
            const endingInstanceId =
              player.offensiveAerial?.attackInstanceId ||
              player.offensiveAerialReaction?.attackInstanceId ||
              null;
            player.isRecovering = false;
            player.isAlreadyHit = false;
            player._oaGroundedStagger = false;
            clearSlideJumpState(player, {
              expectedInstanceId: endingInstanceId,
              debugReason: "landing_recovery_complete",
            });
            player.currentAction = null;
            player.actionLockUntil = 0;
            player.inputLockUntil = Math.min(
              player.inputLockUntil || 0,
              now
            );
            // clearSlideJumpState releases the instance-owned lock; re-face once.
            applyNeutralFacingAfterAerial(player, sjOpponent);
          }
        }
        syncOffensiveAerialPresentation(player, { groundLevel: GROUND_LEVEL });
      }

      // ── Hit Fall — heavy dump after airborne hit (pairs with full H KB) ──
      if (player.isHitFalling) {
        player.hitFallVelocityY = (player.hitFallVelocityY || 0) - HIT_FALL_GRAVITY;
        if (player.hitFallVelocityY < -HIT_FALL_MAX_FALL_SPEED) {
          player.hitFallVelocityY = -HIT_FALL_MAX_FALL_SPEED;
        }
        player.y += player.hitFallVelocityY;
        if (player.y <= GROUND_LEVEL) {
          player.y = GROUND_LEVEL;
          finishAirHitFallLanding(player);
        }
      }

      // ── Sidestep Hit Return — quick ease back to ground from dip ──
      if (player.isSidestepHitReturn) {
        const elapsed = now - player.sidestepHitReturnStartTime;
        const t = Math.min(elapsed / player.sidestepHitReturnDuration, 1);
        const easeOut = 1 - (1 - t) * (1 - t);
        player.y = player.sidestepHitReturnStartY + (GROUND_LEVEL - player.sidestepHitReturnStartY) * easeOut;

        if (t >= 1) {
          player.y = GROUND_LEVEL;
          clearSidestepHitReturn(player);
        }
      }

      // Grab Movement
      // (Legacy duplicate grab-connect path removed — isGrabbingMovement was never set.)

      // AP / MATADOR SM before movement: Space-up must drop stance this tick so we
      // never walk a frame in blocking stance (old flurry-linger moonwalk).
      const apHeldEarly = player.isCPU ? !!player.keys.s : !!player.keys[" "];
      updateAttackParryState(player, now, apHeldEarly);
      updateMatadorState(player, now, apHeldEarly);
      if (!player.keys[" "]) {
        player.grabBreakSpaceConsumed = false;
      }

      // Strafing
      // Post-parry lock: pin feet for the full lock window. Uses isApPostParryLocked
      // (survives flurry re-taps that clear success pose flags) so back-to-back
      // piano taps can't walk mid-string.
      const apPostLock = isAttackParryPostLocked(player);
      if (apPostLock) {
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isBraking = false;
        player.isPowerSliding = false;
        player.isCrouchStrafing = false;
        player.wasStrafingLeft = false;
        player.wasStrafingRight = false;
        player.strafeStartTime = 0;
      }
      if (
        !apPostLock &&
        !player.isThrowLanded && // Block all movement for throw landed players
        !player.isRawParrying && // Block movement during held/active parry stance
        !player.isMatadorParrying &&
        !player.isMatadorWhiffRecovering &&
        !player.isMatadorSuccess &&
        !player.isIceSliding && // Ice-slide owns its own X integration
        !player.isSlideJumping && // Slide-jump owns its own X/Y integration
        !player.isHitFalling && // Air-hit KB owns X until touchdown (no mid-air DI kill)
        !player.isGrabbingMovement && // Block normal movement during grab movement
        !player.isWhiffingGrab && // Block movement during grab whiff recovery
        !player.isGrabWhiffRecovery && // Block movement during grab whiff recovery (new)
        !player.isGrabTeching && // Block movement during grab tech
        !player.isGrabClashing && // Block movement during grab clashing
        !player.isGrabSeparating && // Block movement during grab push separation
        !player.isSlapParryRecovering && // Block movement during slap parry recovery for consistent knockback
        ((!player.keys[" "] &&
          !(player.isAttacking && player.attackType === "charged") && // Block only during charged attack execution
          !player.isChargingAttack && // Block movement while charging
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
          (player.isSlapAttack &&
            // NOTE: deliberately NOT gated by keys[" "] — an active slap's forced
            // slide must run regardless of inputs (holding parry must not stop it).
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
        // Single authoritative locomotion multiplier (PvP Happy Feet + BASHO
        // MOVE SPEED stat + stacked Happy Feet draft), clamped and broadcast so
        // the client predictor renders the exact same displacement. 1.0 for
        // stock PvP/VS CPU → unchanged locomotion.
        let currentSpeedFactor = speedFactor * getEffectiveMoveSpeedMult(player);
        // Reduce speed when size power-up is active
        // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
        //   currentSpeedFactor *= 0.85;
        // }

        // Initialize movement velocity if it doesn't exist
        if (!player.movementVelocity) {
          player.movementVelocity = 0;
        }

        // POWER SLIDE (C key) removed — the slide mechanic was unbound (C/Ctrl no
        // longer tracked client-side). Keep isPowerSliding permanently cleared so the
        // remaining (now-dead) guards/physics that reference it stay inert.
        player.isPowerSliding = false;

        // Calculate effective boundary based on player size with different multipliers
        const sizeOffset = 0;

        // Apply different multipliers for left and right boundaries
        const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
        const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

        // A+D cancel to NEUTRAL (no strafe input). Client movementPredictor
        // already uses exclusive holds; without !a here, D wins and you slide
        // right while a later A+D clear wipes isStrafing (no strafe anim).
        if (
          player.keys.d &&
          !player.keys.a &&
          !player.isDodging &&
          !player.isSidestepping &&
          !player.isRopeJumping &&
          !player.isFlapping &&
          !player.isIceSliding &&
          !player.isSlideJumping &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isApPostParryLocked &&
          !player.isRawParrySuccess &&
          !player.isPerfectRawParrySuccess &&
          !player.isGrabBreaking &&
          !player.isGrabBreakCountered &&
          !player.isGrabBreakSeparating &&
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.pendingSlapCount &&
          !player.isAtTheRopes && // Block strafing while at the ropes
          !player.isPowerSliding && // Power sliding uses its own physics - no strafing
          !(player.inputLockUntil && now < player.inputLockUntil) // Block during input freeze (e.g. pull reversal)
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
            if (!player.strafeStartTime) player.strafeStartTime = now;
          } else {
            // ACCELERATING: Already moving right, build more speed
            player.movementVelocity = Math.min(
              player.movementVelocity + ICE_ACCELERATION,
              ICE_MAX_SPEED
            );
            player.isBraking = false;
            player.isStrafing = true;
            // Start tracking strafe time if not already (e.g., coasting from dodge)
            if (!player.strafeStartTime) player.strafeStartTime = now;
          }

          // Calculate new position and check boundaries
          const newX =
            player.x + delta * currentSpeedFactor * player.movementVelocity;
          if (newX <= rightBoundary || player.isThrowLanded || isGameOverLoser) {
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
          !player.keys.d &&
          !player.isDodging &&
          !player.isSidestepping &&
          !player.isRopeJumping &&
          !player.isFlapping &&
          !player.isIceSliding &&
          !player.isSlideJumping &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isApPostParryLocked &&
          !player.isRawParrySuccess &&
          !player.isPerfectRawParrySuccess &&
          !player.isGrabBreaking &&
          !player.isGrabBreakCountered &&
          !player.isGrabBreakSeparating &&
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.pendingSlapCount &&
          !player.isAtTheRopes &&
          !player.isPowerSliding && // Power sliding uses its own physics - no strafing
          !(player.inputLockUntil && now < player.inputLockUntil) // Block during input freeze (e.g. pull reversal)
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
            if (!player.strafeStartTime) player.strafeStartTime = now;
          } else {
            // ACCELERATING: Already moving left, build more speed
            player.movementVelocity = Math.max(
              player.movementVelocity - ICE_ACCELERATION,
              -ICE_MAX_SPEED
            );
            player.isBraking = false;
            player.isStrafing = true;
            // Start tracking strafe time if not already (e.g., coasting from dodge)
            if (!player.strafeStartTime) player.strafeStartTime = now;
          }

          // Calculate new position and check boundaries
          const newX =
            player.x + delta * currentSpeedFactor * player.movementVelocity;
          if (newX >= leftBoundary || player.isThrowLanded || isGameOverLoser) {
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
          if (
            player.isApPostParryLocked ||
            player.isRawParrySuccess ||
            player.isPerfectRawParrySuccess ||
            player.isGrabBreaking ||
            player.isGrabBreakCountered ||
            player.isGrabBreakSeparating
          ) {
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

            if (player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY) {
              player.movementVelocity *= OUTSIDE_DOHYO_DIRT_MOVE_FRICTION;
            } else if (isGameOverLoser && (player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY)) {
              player.movementVelocity *= PAST_MAP_DIRT_MOVE_FRICTION;
            }
            
            // Visual states
            player.isBraking = isActiveBraking;
            player.isStrafing = false;
            
            // Calculate position with slide speed
            const newX = player.x + delta * currentSpeedFactor * player.movementVelocity;
            
            // Apply position - slides can go off the edge!
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            } else if (!player.isHit && !player.isThrowLanded && !isGameOverLoser) {
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
            // The slap slide is fully committed — no input may affect it. While it's
            // active, ignore movement keys for both braking and friction so the forced
            // forward slide is identical regardless of what the player holds.
            const slapSlideCommitted = player.isSlapSliding;

            // Determine braking state
            const isMovingRight = player.movementVelocity > 0;
            const isMovingLeft = player.movementVelocity < 0;
            const isHoldingLeft = player.keys.a && !player.keys.d;
            const isHoldingRight = player.keys.d && !player.keys.a;
            
            // BRAKING = holding opposite direction to current slide (disabled during slap slide)
            const isActiveBraking = !slapSlideCommitted &&
              ((isMovingRight && isHoldingLeft) || (isMovingLeft && isHoldingRight));
            
            // Edge awareness
            const nearEdge = isNearDohyoEdge(player.x);
            const edgeProximity = getEdgeProximity(player.x);
            
            // Normal ice physics: friction first, then position
            const friction = getIceFriction(player, isActiveBraking, nearEdge, edgeProximity, slapSlideCommitted);
            
            player.movementVelocity *= friction;

            if (player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY) {
              player.movementVelocity *= OUTSIDE_DOHYO_DIRT_MOVE_FRICTION;
            } else if (isGameOverLoser && (player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY)) {
              player.movementVelocity *= PAST_MAP_DIRT_MOVE_FRICTION;
            }
            
            player.isBraking = isActiveBraking;
            player.isStrafing = false;

            let newX;
            if (player.isSlapSliding) {
              const opponent = room.players.find((p) => p.id !== player.id);
              let effectiveVelocity = player.movementVelocity;
              if (opponent && arePlayersColliding(player, opponent)) {
                // Contact damp. This used to cut the slide to 30%, which is a
                // 70% brake applied EXACTLY while you are in slapping range —
                // so forward movement got suppressed during each slap and
                // released between them. Playtest read it as the movement
                // happening "in between each slap" instead of on it, with a
                // hiccup on every connect.
                //
                // Pushbox separation already prevents fighters passing through
                // each other, so this only needs to take the edge off the
                // shove, not stop it.
                effectiveVelocity *= SLAP_SLIDE_CONTACT_DAMP;
              }
              newX = player.x + delta * speedFactor * effectiveVelocity;
            } else {
              newX = player.x + delta * currentSpeedFactor * player.movementVelocity;
            }

            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            } else if (!player.isHit && !player.isThrowLanded && !isGameOverLoser) {
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

        // Game-over loser: handle dohyo fall after isHit ends (momentum carries them off the ring)
        if (isGameOverLoser && !player.isHit) {
          const isOutsideDohyo = player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY;
          if (isOutsideDohyo && !player.isFallingOffDohyo) {
            player.isFallingOffDohyo = true;
          }
          if (player.isFallingOffDohyo) {
            const targetY = GROUND_LEVEL - DOHYO_FALL_DEPTH;
            if (player.y > targetY) {
              player.y = Math.max(targetY, player.y - DOHYO_FALL_SPEED);
            }
          }
        }

        // Update strafing state
        if (
          (!player.keys.a &&
            !player.keys.d &&
            (!player.canMoveToReady || room.gameStart)) ||
          player.isAttacking || // Clear strafing during any attack (slap or charged)
          player.pendingSlapCount // Clear strafing when buffered slap attack is pending
        ) {
          player.isStrafing = false;
        }

        player.isCrouchStance = false;
        player.isCrouchStrafing = false;

        // Force stop strafing in certain states and add missing ground level check
        if (
          (!player.keys.a &&
            !player.keys.d &&
            (!player.canMoveToReady || room.gameStart)) ||
          player.isThrowTeching ||
          player.isRecovering ||
          (player.keys.a && player.keys.d) ||
          player.isAttacking || // Clear strafing during any attack (slap or charged)
          player.pendingSlapCount || // Clear strafing when buffered slap attack is pending
          player.isHit || // Add isHit to force clear strafing when parried
          player.isRawParrying ||
          player.isAtTheRopes || // Block strafing while at the ropes
          player.isRopeJumping || // Block strafing during rope jump
          player.isFlapping // Block ground strafing during flap (air control is separate)
        ) {
          player.isStrafing = false;
          // Don't immediately stop on ice unless hit or rope jumping.
          // Slap slide already coasts via getIceFriction(slapSlideCommitted) —
          // skip this extra decay so the committed step-in isn't double-killed.
          if (!player.isHit && !player.isRopeJumping && !player.isSlapSliding) {
            player.movementVelocity *= MOVEMENT_FRICTION;
          }
          // Also clear grab walking if no movement conditions are met
          if (!player.keys.a && !player.keys.d) {
            player.isGrabWalking = false;
          }
        }

        // Gravity-snap to ground for stray elevated states. Flap / slide-jump /
        // ice-slide reverse hop own their own Y — exclude them here.
        if (
          player.y > GROUND_LEVEL &&
          !player.isRopeJumping &&
          !player.isFlapping &&
          !player.isSlideJumping &&
          !player.isIceSlideReverseHopping &&
          !player.isHitFalling
        ) {
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
        player.pendingSlapCount || // Clear strafing when buffered slap attack is pending
        player.isHit || // Add isHit to force clear strafing when parried
        player.isRawParrying ||
        player.isAtTheRopes || // Block strafing while at the ropes
        player.isFlapping // Block strafing during flap (air steer is separate)
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

      // ── GUARD & PARRY (Space) ─────────────────────────────────────────────
      // Edge (a fresh tap) opens a PARRY window; HOLDING with no live window is
      // GUARD (the block floor). The primary parry arm is the edge-triggered
      // socket path; this loop path is the fallback (fires if that press was
      // dropped) AND owns GUARD entry. (The CPU drives its parry off keys.s in
      // cpuAI.js, so this human-only block leaves it alone.)
      if (
        !player.isCPU &&
        player.keys[" "] &&
        !player.isFlapping &&
        !player.isSlideJumping && // Airborne slide-jump — no parry mid-air
        !player.isGrabBreaking && // Block while grab break is active
        !player.isGrabBreakCountered && // Block while countered by grab break
        !player.isGrabBreakSeparating && // Block during grab break separation
        !player.isGrabSeparating && // Block during grab push separation
        !player.grabBreakSpaceConsumed && // Block until the triggering space press is released
        !player.isDodging && // Don't interrupt dodge hop
        !player.isSidestepping && // Block during sidestep
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isGrabStartup && // Block during grab startup (the lunge windup)
        !player.isGrabbingMovement && // Block during grab movement
        !player.isWhiffingGrab && // Block during grab whiff recovery
        !player.isGrabClashing && // Block during grab clashing
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isRecovering &&
        !player.isAttacking && // Block during any attack (slap or charged)
        !player.isHit &&
        !player.isRawParryStun &&
        !player.isAtTheRopes
      ) {
        if (player.spaceJustPressed) {
          // Fresh tap → MATADOR (BACK+SPACE) or AP (SPACE). Fallback for the
          // socket edge path. Arm clears spaceJustPressed so a held key can't re-fire.
          if (wantsMatadorChord(player) && canArmMatador(player, now)) {
            armMatador(player, now, lagCompensatedParryStart(player, now));
            clearChargeState(player, true);
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          } else if (canArmAttackParry(player, now)) {
            armAttackParry(player, now, lagCompensatedParryStart(player, now));
            clearChargeState(player, true); // true = cancelled
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          }
        } else if (
          !player.isRawParrying &&
          !player.isApWhiffRecovering &&
          !player.isMatadorParrying &&
          !player.isMatadorWhiffRecovering &&
          now >= (player.apCooldownUntil || 0)
        ) {
          // Held with no live parry window → GUARD (the block floor).
          // Also covers post-land hold if collision already left us unarmed.
          // MATADOR never enters GUARD — tap-only.
          enterGuard(player);
          clearChargeState(player, true);
          if (!player.isAttacking && !player.isChargingAttack) {
            player.isReady = false;
          }
        }
      }

      // During a HELD AP / MATADOR stance OR whiff recovery, hold animation priority
      // (clear movement/dodge/crouch). Whiff recovery is rooted endlag and
      // cannot be cut short by re-press. (SM already ran before movement.)
      const rootApStance =
        player.isApWhiffRecovering ||
        player.isApPostParryLocked ||
        player.isRawParrying ||
        player.isMatadorParrying ||
        player.isMatadorWhiffRecovering ||
        player.isMatadorSuccess;
      if (rootApStance) {
        player.isStrafing = false;
        player.movementVelocity = 0;
        player.isDodging = false;
        player.isDodgeStartup = false;
        player.isDodgeRecovery = false;
        player.isAttacking = false;
        player.isJumping = false;
        player.isCrouchStance = false;
        player.isCrouchStrafing = false;
      }

      if (
        player.isAttacking &&
        player.attackType === "charged" &&
        !player.isAtTheRopes
      ) {
        // Palm thrust is a rooted charged variant — skip the forward lunge
        // entirely, but still fall through to the attackEndTime → recovery
        // handoff below so the move ends normally.
        // On-hit pose hold: plant in place (no further lunge travel).
        // Lunge Y stays grounded — attack art already reads airborne.
        if (!player.isPalmThrust && !player.chargedAttackHit) {
        const attackDirection = player.facing === 1 ? -1 : 1;
        const chargePower = player.chargeAttackPower || 0;
        const lungeSpeed = 1.5 + (chargePower / 100) * 5.5;
        const lungeStartX = player.x;
        const newX = player.x + attackDirection * delta * speedFactor * lungeSpeed;

        // Phase 13A (V2): earliest slap↔headbutt contact inside this step —
        // advance to contact and resolve before committing the full lunge.
        let chargedContactResolved = false;
        if (isCombatContactFidelityV2Enabled() && !player.isInStartupFrames) {
          const opponent = room.players.find(
            (p) => p.id !== player.id && !p.isDead
          );
          if (
            opponent &&
            opponent.isAttacking &&
            opponent.attackType === "slap" &&
            !opponent.isInStartupFrames
          ) {
            chargedContactResolved = !!resolveSlapChargedFromLunge(
              player,
              opponent,
              rooms,
              io,
              {
                delta,
                speedFactor,
                proposedX: newX,
                simTime: room.simTime,
              }
            );
          }
        }
        player._combatPrevX = lungeStartX;
        // Contact resolution already advanced to the hit and consumed the step.
        if (!chargedContactResolved) {

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
          player.y = GROUND_LEVEL;
          
          // Set at the ropes state
          player.isAtTheRopes = true;
          player.atTheRopesStartTime = now;
          
          // Store the facing direction from the charged attack
          // This direction should persist through hits and ring-out until round reset
          player.atTheRopesFacingDirection = savedFacing;
          player.facing = savedFacing;
          if (isActionFacingOwnershipV2Enabled()) {
            const ropesId = mintActionFacingInstanceId(
              player,
              ACTION_FACING_OWNER.ROPES
            );
            player.ropesFacingInstanceId = ropesId;
            acquireActionFacingLock(player, {
              ownerType: ACTION_FACING_OWNER.ROPES,
              ownerInstanceId: ropesId,
              direction: savedFacing,
              reason: ACTION_FACING_REASON.BOUNDARY,
              allowDirectionUpdate: false,
              supersede: true,
              syncLegacy: false,
            });
          }

          // Clear knockback (clearAllActionStates doesn't clear this)
          player.knockbackVelocity = { x: 0, y: 0 };

          // Constrain player position to boundary
          if (newX <= MAP_LEFT_BOUNDARY) {
            player.x = MAP_LEFT_BOUNDARY;
          } else if (newX >= MAP_RIGHT_BOUNDARY) {
            player.x = MAP_RIGHT_BOUNDARY;
          }

          // Set timeout to end the at-the-ropes state
          let ropesLifecycleId = null;
          if (isActionLifecycleOwnershipV2Enabled()) {
            const ropesRec = beginLifecycleOwner(
              player,
              LIFECYCLE_DOMAIN.REACTION,
              LIFECYCLE_OWNER.ROPES,
              { phase: LIFECYCLE_PHASE.ACTIVE, reason: "ROPES_BEGIN" }
            );
            ropesLifecycleId = ropesRec?.ownerInstanceId || null;
          }
          setPlayerTimeout(
            player.id,
            () => {
              if (
                isActionLifecycleOwnershipV2Enabled() &&
                !assertLifecycleCallback(
                  player,
                  LIFECYCLE_DOMAIN.REACTION,
                  ropesLifecycleId,
                  "at_the_ropes_timeout"
                )
              ) {
                return;
              }
              player.isAtTheRopes = false;
              player.atTheRopesStartTime = 0;
              if (isActionFacingOwnershipV2Enabled()) {
                releaseActionFacingLock(player, {
                  expectedInstanceId: player.ropesFacingInstanceId,
                  expectedOwnerType: ACTION_FACING_OWNER.ROPES,
                  reason: ACTION_FACING_RELEASE.ACTION_END,
                  clearLegacy: false,
                });
                player.ropesFacingInstanceId = null;
              }
              player.atTheRopesFacingDirection = null;
              if (isActionLifecycleOwnershipV2Enabled()) {
                completeLifecycleOwner(
                  player,
                  LIFECYCLE_DOMAIN.REACTION,
                  ropesLifecycleId,
                  { reason: "ROPES_COMPLETE" }
                );
                markLifecycleControlRestore(
                  player,
                  LIFECYCLE_DOMAIN.REACTION,
                  ropesLifecycleId
                );
              }
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
            // This ensures the attack direction and facing remain consistent.
            // EXCEPTION: an airborne opponent has no ground pushbox — a charged
            // attack passes freely underneath them. Covers a flapper in flight
            // and a rope-jumper in its airborne active arc (both hit-immune while
            // overhead; only the flapper's descending body-slam connects).
            const opponent = room.players.find(p => p.id !== player.id && !p.isDead);
            const oppAirborne =
              opponent &&
              ((opponent.isFlapping && opponent.flapPhase === "flight") ||
                (opponent.isRopeJumping && opponent.ropeJumpPhase === "active") ||
                (opponent.isSlideJumping && opponent.slideJumpPhase === "flight"));
            if (opponent && !opponent.isDodging && !opponent.isSidestepping && !oppAirborne) {
              // Stop the lunge just inside art-tip connect range so the hit can
              // register, then processHit snaps to exact tip-meets-body for the
              // hitstop pose. No more burrowing past visual contact.
              const connectDist = getConnectDistance(
                attackKindFromPlayer(player),
                player,
                opponent
              );
              const minDistance = Math.max(connectDist - 2, 1);
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
        } // end !chargedContactResolved travel
        } // end !isPalmThrust lunge guard

        if (room.simTime >= player.attackEndTime) {
          // Use helper function to safely end charged attacks
          safelyEndChargedAttack(player, rooms);
        }
      } else if (
        player.isAttacking &&
        player.attackType === "charged" &&
        player.isAtTheRopes
      ) {
        // If at the ropes, still check for attack end time but don't move
        if (room.simTime >= player.attackEndTime) {
          safelyEndChargedAttack(player, rooms);
        }
      }

      // Post-connect grab authority.
      updateCommandGrab(player, room, io, delta, rooms);


      // Apply locomotion speed effect. One authoritative, clamped multiplier
      // (PvP Happy Feet + BASHO MOVE SPEED stat + stacked Happy Feet draft) is
      // computed here, cached on the player for reuse, and broadcast in the
      // delta snapshot so the client movement predictor renders the identical
      // displacement (no camera-ahead-of-sprite desync). 1.0 for stock players.
      const effMoveSpeedMult = getEffectiveMoveSpeedMult(player);
      player.effectiveMoveSpeedMult = effMoveSpeedMult;
      player.speedFactor = speedFactor * effMoveSpeedMult;

      // Apply size power-up effect
      // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
      //   player.sizeMultiplier = player.powerUpMultiplier;
      // } else {
      player.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
      // }

      // STRANDED-CHARGE GUARD: a charging stance with mouse1 not held can never
      // be released (the release edge already passed — e.g. a buffered charge
      // that fired after a tap, or a dropped release packet). The equivalent
      // cleanup in socketHandlers only runs when a NEW input packet arrives, so
      // a player holding a key steadily (no key edges → no packets) would stand
      // frozen in place indefinitely. Self-heal every tick instead. Ordering is
      // safe: input packets (including the release handler, which executes the
      // attack and clears isChargingAttack itself) are processed at tick start,
      // before this guard runs.
      if (player.isChargingAttack && player.keys && !player.keys.mouse1 && !player.isAttacking) {
        player.isChargingAttack = false;
        player.chargeStartTime = 0;
        player.chargeAttackPower = 0;
        player.chargingFacingDirection = null;
        player.attackType = null;
      }

      // Update charge attack power in the game loop
      // (sim clock — charge stops building during hitstop, like everything else)
      if (player.isChargingAttack) {
        const chargeDuration = room.simTime - player.chargeStartTime;
        player.chargeAttackPower = Math.min(
          (chargeDuration / CHARGE_FULL_POWER_MS) * 100,
          100
        );
      }

      // TACHIAI CHARGING: Allow charging during the walk-to-ready and ready phases
      // (after power-up pick, before hakkiyoi). Players hold mouse1 to build charge
      // for a powered tachiai at round start.
      // INPUT BUFFERING: Apply buffered mouse1 when game starts.
      if (room.gameStart && player.mouse1BufferedBeforeStart) {
        if (!player.isChargingAttack) {
          player.keys.mouse1 = true;
          player.mouse1PressTime = now;
        }
        player.mouse1BufferedBeforeStart = false;
      }

      // INPUT BUFFERING: Apply held A/D that spanned HAKKIYOI. Must run before
      // the next tick's strafe block reads keys — applying here (end of player
      // loop) still beats waiting for a client edge that may never come.
      if (room.gameStart && player.movementKeysBufferedBeforeStart) {
        const buf = player.movementKeysBufferedBeforeStart;
        player.keys = player.keys || {};
        if (buf.a) player.keys.a = true;
        if (buf.d) player.keys.d = true;
        player.movementKeysBufferedBeforeStart = null;
      }

      // CONTINUOUS MOUSE1 CHECK: Auto-start charging when mouse1 is held and player is idle
      // Neutral charged attack removed — no charge initiation from held mouse1

      // SELF-HEAL: the slap input buffers (pendingSlapCount / pendingPalmThrust)
      // are meaningful ONLY while an actual slap is in flight — they're queued
      // during a slap and consumed by endSlapCycle when that slap ends. If one
      // ever outlives its slap (e.g. a press buffered on the final slap, then
      // the player rolls straight into a palm thrust or neutral before the cycle
      // callback drained it), it silently keeps blocking strafing forever until
      // the player gets hit or feeds another input — the exact "stuck after palm
      // thrust" lock. Clearing the orphan every tick makes that lock impossible.
      if (!(player.isAttacking && player.attackType === "slap")) {
        if (player.pendingSlapCount > 0) player.pendingSlapCount = 0;
        if (player.pendingPalmThrust) player.pendingPalmThrust = false;
        if (player.pendingGrab) {
          player.pendingGrab = false;
          player.pendingGrabPressTime = 0;
        }
      }

      // SELF-HEAL: at-the-ropes is a fixed-duration stun cleared by a named
      // timeout. If that timeout is ever cancelled without resetting the flag
      // (e.g. a hit interrupting the ropes stun), the movement gate would stay
      // blocked forever. Force-expire the flag once its duration has elapsed so
      // an orphaned at-the-ropes can never permanently lock a player in place.
      if (
        player.isAtTheRopes &&
        player.atTheRopesStartTime &&
        now - player.atTheRopesStartTime >= AT_THE_ROPES_DURATION
      ) {
        player.isAtTheRopes = false;
        player.atTheRopesStartTime = 0;
      }

      // FINAL GUARD: sanitize stamina once per tick per player before emit.
      // Re-check gassed for any drains that happened AFTER the pre-regen pass
      // (clinch grind, etc.). Regen already ran earlier and will not run again
      // this tick, so this cannot be rescued by a pulse.
      player.stamina = clampStaminaValue(player.stamina);
      if (player.isGassed) {
        player.stamina = 0;
      } else if (!room.gameOver) {
        tryEnterGassed(player, now);
      }
      if (player.isGassed && now >= player.gassedUntil) {
        player.isGassed = false;
        player.gassedUntil = 0;
        player.staminaRegenAccum = 0;
        // Weaker second wind inside the clinch — a ground-down opponent
        // shouldn't snap back to full shove power mid-grind.
        player.stamina = Math.min(
          100,
          player.inClinch ? GASSED_RECOVERY_STAMINA_IN_CLINCH : GASSED_RECOVERY_STAMINA
        );
      }
    });

    // HARD RULE: after all movement / side-switches this tick, face each other
    // unless a purposeful lock is active (attack, dodge hop, ropes, throw, etc.).
    // (Player loop is outside the early hitstop pair-block, so resolve from room.)
    if (room.players.length === 2 && !isRoomInHitstop(room)) {
      enforcePairFacing(room.players[0], room.players[1], now);
    }

    // ── BOUT CARD ──
    // "DAY 7" / "ROUND 2" / "FINAL ROUND", once per bout.
    //
    // Fires at the START of the salt throw, which buys the card the full
    // 1483ms salt animation PLUS the walk to the tachiai before the Gyoji
    // calls HANDS DOWN. The first pass waited for the salt to FINISH
    // (canMoveToReady) and the card was still on screen when the bubble
    // popped. canMoveToReady and readyStartTime stay as backstops for any
    // mode that skips the ritual — and the client hides the card the
    // instant gyoji_call lands, so the two can never overlap regardless
    // of how the timings drift.
    if (
      !room.boutCardSent &&
      !room.gameStart &&
      !room.gameOver &&
      room.players.length === 2 &&
      (room.players.some((p) => p.isThrowingSalt) ||
        room.players.every((p) => p.canMoveToReady) ||
        room.readyStartTime)
    ) {
      room.boutCardSent = true;
      room.boutCardAtSim = now;
      io.in(room.id).emit(
        "bout_card",
        describeBout({
          matchMode: room.matchMode,
          bashoBout: room.bashoBout,
          bashoTotalBouts: room.bashoTotalBouts,
          winsP1: (room.players[0].wins || []).length,
          winsP2: (room.players[1].wins || []).length,
        })
      );
    }

    // ── BOUT CLOCK ──
    // Armed at HAKKI-YOI (startBoutClock). Only the integer second is sent,
    // and only when it changes, so a bout costs ~60 tiny packets total and
    // the client needs no countdown of its own to stay in step.
    if (
      room.gameStart &&
      !room.gameOver &&
      !room.matchOver &&
      room.boutEndsAtSim &&
      // A disconnect mid-bout leaves one player; the decision needs both.
      room.players.length === 2
    ) {
      const msLeft = room.boutEndsAtSim - now;
      const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));
      if (secondsLeft !== room.boutSecondsShown) {
        room.boutSecondsShown = secondsLeft;
        io.in(room.id).emit("bout_clock", secondsLeft);
      }

      if (msLeft <= 0) {
        // Resolve by fighter identity, not array order: the client reads
        // scores.player1 / scores.player2 off `penguin.fighter`, so the
        // two must not be able to disagree about who is who.
        const p1 =
          room.players.find((p) => p.fighter === "player 1") ||
          room.players[0];
        const p2 =
          room.players.find((p) => p.fighter === "player 2") ||
          room.players[1];
        const ring = ringFromBoundaries(
          MAP_LEFT_BOUNDARY,
          MAP_RIGHT_BOUNDARY
        );
        const { winner, scores } = resolveHantei(p1, p2, ring);
        if (winner) {
          const champ = winner === "player1" ? p1 : p2;
          const fallen = winner === "player1" ? p2 : p1;
          handleWinCondition(room, fallen, champ, io, "timeExpired", {
            hanteiScores: scores,
          });
        } else {
          handleBoutDraw(room, io, scores);
        }
      }
    }

    // ROOM-LEVEL SAFETY: Check game reset outside player loop
    // This ensures reset is checked even if all players return early
    // (e.g., during hitstop, or if loser has isHit=false)
    if (
      room.gameOver &&
      room.gameOverTime &&
      now - room.gameOverTime >= 2000 &&
      !room.matchOver &&
      !room.bashoAwaitingReset
    ) {
      resetRoomAndPlayers(room, io);
    }

    // PERFORMANCE: Only broadcast every N ticks to reduce network load
    // Game logic runs at 64Hz, broadcasts at 32Hz — client interpolation smooths to 60fps
    const shouldBroadcast = broadcastTickCounter % EFFECTIVE_BROADCAST_EVERY_N_TICKS === 0 || room.forceBroadcast;
    if (room.forceBroadcast) room.forceBroadcast = false;
    if (shouldBroadcast) {
      // Initialize previousPlayerStates if it doesn't exist (for rooms created before optimization)
      if (!room.previousPlayerStates) {
        room.previousPlayerStates = [null, null];
      }

      // CLIENT PREDICTION GATES: sample the sim-clock action locks as
      // remaining-ms countdowns. actionLockUntil blocks ALL actions
      // (shouldBlockAction); attackCooldownUntil blocks strikes only
      // (canPlayerSlap) — dodges/grabs stay legal during it, so the two are
      // shipped separately. The client counts each down from packet arrival
      // and refuses to predict (pose + swing sound) while one is live —
      // without this, presses the server is guaranteed to reject still
      // whoosh on the client. Capped for sanity against runaway deadlines.
      const simNowForLocks = room.simTime;
      for (let _li = 0; _li < room.players.length && _li < 2; _li++) {
        const lockPlayer = room.players[_li];
        const globalLock = lockPlayer.actionLockUntil || 0;
        const attackLock = lockPlayer.attackCooldownUntil || 0;
        lockPlayer.actionLockRemainingMs =
          globalLock > simNowForLocks
            ? Math.min(Math.ceil(globalLock - simNowForLocks), 2000)
            : 0;
        lockPlayer.attackCooldownRemainingMs =
          attackLock > simNowForLocks
            ? Math.min(Math.ceil(attackLock - simNowForLocks), 2000)
            : 0;
      }

      // PERFORMANCE: Delta updates + Phase 5 seq/simTime/periodic keyframes.
      // MASTERY Phase 5 (5.2): masteryP5 tells the client whether assist-removal
      // / legibility phase is live for client-only continuous tells.
      const { packet, previousPlayerStates } = buildFighterActionPacket(room, {
        masteryP5: MASTERY_P5_ASSISTS,
        keyframeEveryN: KEYFRAME_EVERY_N_BROADCASTS,
      });
      room.previousPlayerStates = previousPlayerStates;
      io.in(room.id).emit("fighter_action", packet);
    }
  }
  
  // Increment broadcast counter
  broadcastTickCounter++;
}


let activeConnectionCount = 0;

io.on("connection", (socket) => {
  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  activeConnectionCount++;
  startGameLoop();

  // Send the lobby snapshot ONLY to the joining socket — and use the cleaned
  // payload, not the raw rooms array (which contains huge per-player gameplay
  // state). Previously this broadcast the entire raw rooms structure to every
  // connected client on every connect, producing a serialization spike.
  socket.emit("rooms", getCleanedRoomsData(rooms));

  // Tiny clock-offset handshake: the client samples this round-trip a few
  // times on connect (and periodically) to derive `serverNow - clientNow`.
  // Used to schedule visual freezes (hitstop) at the same server-clock
  // moment on both clients regardless of ping asymmetry. `gameNow()` is
  // monotonic on the server so the offset stays stable across NTP jumps.
  socket.on("time_sync", (data, ack) => {
    if (typeof ack === "function") {
      ack({
        clientSent: data && data.clientSent,
        serverNow: gameNow(),
      });
    }
  });

  // Register all socket event handlers
  registerSocketHandlers(socket, io, rooms, {
    registerPlayerInMaps,
    unregisterPlayerFromMaps,
  });

  socket.on("disconnect", () => {
    activeConnectionCount--;
    if (activeConnectionCount <= 0) {
      activeConnectionCount = 0;
      stopGameLoop();
    }
  });
});

// Update server listen
server.listen(PORT, () => {
  // Phase 4A — one-shot startup diagnostic (dev/console only; not networked).
  try {
    const {
      logAuthoredSlapHurtboxStartupDiagnostic,
    } = require("./authoredSlapHurtboxFlags");
    logAuthoredSlapHurtboxStartupDiagnostic({ port: PORT });
  } catch (err) {
    console.warn(
      "[authoredSlapHurtbox] startup diagnostic failed:",
      err && err.message ? err.message : err
    );
  }
});

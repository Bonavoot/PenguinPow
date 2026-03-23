const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
const e = require("express");
const {
  GRAB_STATES, TICK_RATE, BROADCAST_EVERY_N_TICKS,
  ALWAYS_SEND_PROPS, DELTA_TRACKED_PROPS, ALL_TRACKED_PROPS,
  speedFactor, GROUND_LEVEL, HITBOX_DISTANCE_VALUE,
  THROW_RANGE, GRAB_RANGE, GRAB_PUSH_SPEED, GRAB_PUSH_DURATION,
  DOHYO_FALL_SPEED, DOHYO_FALL_DEPTH,
  POWER_UP_TYPES, POWER_UP_EFFECTS,
  GRAB_DURATION, GRAB_ATTEMPT_DURATION,
  ICE_ACCELERATION, ICE_MAX_SPEED, ICE_INITIAL_BURST,
  ICE_COAST_FRICTION, ICE_MOVING_FRICTION, ICE_BRAKE_FRICTION, ICE_STOP_THRESHOLD,
  ICE_TURN_BURST,
  SLIDE_SPEED_BOOST, SLIDE_MAX_SPEED, SLIDE_FRICTION, SLIDE_MIN_VELOCITY,
  SLIDE_MAINTAIN_VELOCITY, SLIDE_BRAKE_FRICTION, SLIDE_STRAFE_TIME_REQUIRED,
  DODGE_SLIDE_MOMENTUM, DODGE_POWERSLIDE_BOOST,
  DOHYO_EDGE_PANIC_ZONE, ICE_EDGE_BRAKE_BONUS, ICE_EDGE_SLIDE_PENALTY,
  MOVEMENT_ACCELERATION, MOVEMENT_DECELERATION, MAX_MOVEMENT_SPEED,
  MOVEMENT_MOMENTUM, MOVEMENT_FRICTION, ICE_DRIFT_FACTOR,
  MIN_MOVEMENT_THRESHOLD, INITIAL_MOVEMENT_BURST,
  DODGE_DURATION, DODGE_BASE_SPEED,
  DODGE_CANCEL_ACTION_LOCK,
  DODGE_STARTUP_MS, DODGE_RECOVERY_MS, DODGE_COOLDOWN_MS,
  SLAP_STARTUP_MS, SLAP_ACTIVE_MS,
  CHARGED_STARTUP_MS, CHARGED_ACTIVE_MS,
  GRAB_WALK_SPEED_MULTIPLIER, GRAB_WALK_ACCEL_MULTIPLIER,
  CHARGE_FULL_POWER_MS,
  GRAB_STARTUP_DURATION_MS, GRAB_STARTUP_HOP_HEIGHT, GRAB_LUNGE_DISTANCE, SLAP_ATTACK_STARTUP_MS,
  GRAB_WHIFF_RECOVERY_MS, GRAB_WHIFF_STUMBLE_VEL,
  GRAB_TECH_FREEZE_MS, GRAB_TECH_FORCED_DISTANCE,
  GRAB_TECH_TWEEN_DURATION, GRAB_TECH_RESIDUAL_VEL,
  GRAB_TECH_INPUT_LOCK_MS, GRAB_TECH_ANIM_DURATION_MS,
  GRAB_BREAK_STAMINA_COST, GRAB_BREAK_PUSH_VELOCITY, GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION, GRAB_BREAK_RESIDUAL_VEL,
  GRAB_BREAK_INPUT_LOCK_MS, GRAB_BREAK_ACTION_LOCK_MS,
  RAW_PARRY_STAMINA_COST, RAW_PARRY_MIN_DURATION, RAW_PARRY_MAX_DURATION, RAW_PARRY_COOLDOWN_MS, PULL_BOUNDARY_MARGIN,
  AT_THE_ROPES_DURATION,
  ROPE_JUMP_STARTUP_MS, ROPE_JUMP_ACTIVE_MS, ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_ARC_HEIGHT,
  HIT_FALL_BASE_MS,
  HIT_FALL_HEIGHT_SCALE,
  HIT_FALL_POP_FRACTION,
  HIT_FALL_POP_HEIGHT_RATIO,
  KNOCKBACK_IMMUNITY_DURATION,
  STAMINA_REGEN_INTERVAL_MS, STAMINA_REGEN_AMOUNT,
  SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST, DODGE_STAMINA_COST,
  GASSED_DURATION_MS, GASSED_RECOVERY_STAMINA,
  BALANCE_MAX, BALANCE_PASSIVE_REGEN_PER_SEC, BALANCE_CROUCH_REGEN_PER_SEC,
  HITSTOP_GRAB_MS, HITSTOP_THROW_MS, SLAP_PARRY_KB_FRICTION,
  BURST_KB_INITIAL_FRICTION, BURST_KB_LATE_FRICTION, BURST_KB_PHASE_SWITCH_MS,
  SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MIN_MS, SIDESTEP_ACTIVE_MAX_MS, SIDESTEP_RECOVERY_MS,
  SIDESTEP_ARC_DEPTH_MIN, SIDESTEP_ARC_DEPTH_MAX, SIDESTEP_GRAB_TRACK_RANGE,
  SIDESTEP_ARC_SPEED, SIDESTEP_MAX_TRAVEL,
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
  shouldRestartCharging,
  startCharging,
  canPlayerSlap,
  clearChargeState,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  clampStaminaValue,
  isNearDohyoEdge,
  getEdgeProximity,
  getIceFriction,
  triggerHitstop,
  isRoomInHitstop,
  emitThrottledScreenShake,
  clearHitFall,
  clearSidestepHitReturn,
} = require("./gameUtils");

// Import game functions
const {
  handleWinCondition,
  executeSlapAttack,
  executeChargedAttack,
  calculateEffectiveHitboxSize,
  handleReadyPositions,
  arePlayersColliding,
  adjustPlayerPositions,
  safelyEndChargedAttack,
  activateBufferedInputAfterGrab,
  executeInputBuffer,
} = require("./gameFunctions");

// Import delta state utilities
const { computePlayerDelta, clonePlayerState } = require("./deltaState");

// Import grab mechanics
const {
  correctFacingAfterGrabOrThrow,
  executeClinchSeparation,
  executeGrabTech,
  executeGrabWhiff,
} = require("./grabMechanics");

// Import room management (only functions still used by tick)
const {
  resetRoomAndPlayers,
} = require("./roomManagement");

// Import combat helpers (shared between tick and socket handlers)
const {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  grabBeatsSlap,
  resolveGrabClash,
} = require("./combatHelpers");

// Import CPU AI
const { updateCPUAI, processCPUInputs } = require("./cpuAI");
const { updateImpossibleAI } = require("./cpuAI_impossible");

// Import collision system
const { checkCollision } = require("./collisionSystem");

// Import projectile updates (snowballs + pumo army)
const { updateProjectiles } = require("./projectileUpdates");

// Import grab action system
const { updateGrabActions } = require("./grabActionSystem");

// Import socket handler registration
const { registerSocketHandlers } = require("./socketHandlers");

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

let gameLoop = null;
let staminaRegenCounter = 0;
let broadcastTickCounter = 0;
const delta = 1000 / TICK_RATE;

// Self-correcting game loop that doesn't drift under load.
// setInterval can bunch ticks or skip them when the event loop is busy;
// this accumulator-based approach catches up smoothly.
function startGameLoop() {
  if (gameLoop) return;
  let lastTime = Date.now();
  let accumulator = 0;
  gameLoop = setInterval(() => {
    const now = Date.now();
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
  const now = Date.now();
  // PERFORMANCE: Use for-loop instead of forEach to avoid closure overhead at 64Hz.
  // Also skip rooms with < 2 players via continue (no function call overhead).
  staminaRegenCounter += delta;

  for (let _roomIdx = 0; _roomIdx < rooms.length; _roomIdx++) {
    const room = rooms[_roomIdx];
    if (room.players.length < 2) continue;

    if (room.players.length === 2) {
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
          // Update AI decision making (sets keys)
          if (room.cpuDifficulty === "IMPOSSIBLE") {
            updateImpossibleAI(cpuPlayer, humanPlayer, room, currentTime);
          } else {
            updateCPUAI(cpuPlayer, humanPlayer, room, currentTime);
          }
          
          // Process the CPU's inputs (converts keys to actions)
          const gameHelpers = {
            executeSlapAttack,
            executeChargedAttack,
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

      if (player1.isGrabbing && player1.grabbedOpponent && !player1.isHit) {
        // Only handle grab state if not pushing
        const opponent = room.players.find(
          (p) => p.id === player1.grabbedOpponent
        );
        if (opponent && !opponent.isHit) {
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

      // Pushbox: always resolve overlap when players are colliding.
      // arePlayersColliding already returns false during dodge/grab/throw states.
      // Skip during game over — boundary clamping inside adjustPlayerPositions
      // would drag the loser back to the map edge after isHit expires.
      if (!room.gameOver && arePlayersColliding(player1, player2)) {
        adjustPlayerPositions(player1, player2, delta);
      }

      if (
        !player1.isGrabbing &&
        !player1.isBeingGrabbed &&
        !player2.isGrabbing &&
        !player2.isBeingGrabbed &&
        !player1.isThrowing &&
        !player2.isThrowing &&
        !(player1.isHit && player2.isHit)
      ) {
        // Preserve facing direction during attacks and throws
        // Special case: allow dodging player to update facing even when opponent is attacking
        // This allows dodge-through to work correctly during charged attacks
        if (
          (!player1.isAttacking && !player2.isAttacking && !player1.isDodging && !player2.isDodging && !player1.isSidestepping && !player2.isSidestepping) ||
          (player1.isDodging && player2.isAttacking) ||
          (player2.isDodging && player1.isAttacking)
        ) {
          // Only update facing for non-isHit players and those not locked by slap attacks
          // IMPORTANT: Players with atTheRopesFacingDirection set keep their locked facing direction
          if (!player1.isHit && !player2.isHit) {
            // Normal facing logic when both players are not hit
            // Don't update facing if player has locked slap facing direction OR is attacking OR has atTheRopes facing locked
            if (!player1.slapFacingDirection && !player1.isAttacking && !player1.atTheRopesFacingDirection && player1.x < player2.x) {
              player1.facing = -1;
            } else if (
              !player1.slapFacingDirection &&
              !player1.isAttacking &&
              !player1.atTheRopesFacingDirection &&
              player1.x >= player2.x
            ) {
              player1.facing = 1;
            }

            if (!player2.slapFacingDirection && !player2.isAttacking && !player2.atTheRopesFacingDirection && player1.x < player2.x) {
              player2.facing = 1;
            } else if (
              !player2.slapFacingDirection &&
              !player2.isAttacking &&
              !player2.atTheRopesFacingDirection &&
              player1.x >= player2.x
            ) {
              player2.facing = -1;
            }
          } else if (!player1.isHit && player2.isHit) {
            if (!player1.slapFacingDirection && !player1.isAttacking && !player1.atTheRopesFacingDirection) {
              if (player1.x < player2.x) {
                player1.facing = -1; // Player 1 faces right
              } else {
                player1.facing = 1; // Player 1 faces left
              }
            }
          } else if (player1.isHit && !player2.isHit) {
            // Only update player2's facing when player1 is hit and player2 doesn't have locked slap facing
            if (!player2.slapFacingDirection && !player2.isAttacking && !player2.atTheRopesFacingDirection) {
              if (player1.x < player2.x) {
                player2.facing = 1; // Player 2 faces left
              } else {
                player2.facing = -1; // Player 2 faces right
              }
            }
          }
          // If both are hit, don't update facing at all (handled by outer condition)
        }
      }

      if (player1.isAttacking) {
        checkCollision(player1, player2, rooms, io);
      }
      if (player2.isAttacking) {
        checkCollision(player2, player1, rooms, io);
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
          room.readyStartTime = currentTime;
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
          io.in(room.id).emit("game_start", true);
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
          }
          const recoveryElapsed = now - player.recoveryStartTime;
          const isRecoveryGameOverLoser = room.gameOver && player.id === room.loserId;

          // Apply ice-like physics to recovery movement
          if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
            // Apply momentum and friction from global ice physics
            player.movementVelocity *= MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;

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

            player.mouse1HeldDuringAttack = false;

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
      const isGameOverLoser = room.gameOver && player.id === room.loserId;
      if (isGameOverLoser && !player.isHit && !player.isCinematicKillVictim &&
          !player.isBeingThrown && !player.isGrabBreakSeparating &&
          Math.abs(player.movementVelocity) < ICE_STOP_THRESHOLD &&
          Math.abs(player.knockbackVelocity.x) < 0.01) {
        return;
      }

      // Clear knockback immunity when timer expires
      if (
        player.knockbackImmune &&
        now >= player.knockbackImmuneEndTime
      ) {
        player.knockbackImmune = false;
      }

      // Smooth grab-break separation tween overrides other movement for its duration
      if (player.isGrabBreakSeparating) {
        const elapsed = now - (player.grabBreakSepStartTime || now);
        const duration = player.grabBreakSepDuration || 0;
        const startX = player.grabBreakStartX ?? player.x;
        const targetX = player.grabBreakTargetX ?? player.x;
        const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
        const isBoundarySwap = player.isBoundaryPullSwap;
        // Boundary swap: ease-in-out so both players cross at t=0.5 (aligned with arc peak)
        const eased = isBoundarySwap
          ? (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
          : 1 - Math.pow(1 - t, 3);
        const newX = startX + (targetX - startX) * eased;

        // For pull reversal, clamp to a margin inside boundaries so they stop before the edge
        const isPullTween = player.isBeingPullReversaled;
        const leftBound = isPullTween ? MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN : MAP_LEFT_BOUNDARY;
        const rightBound = isPullTween ? MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN : MAP_RIGHT_BOUNDARY;
        const clampedX = Math.max(leftBound, Math.min(newX, rightBound));
        player.x = clampedX;
        if (isPullTween && t < 1) {
          if (isBoundarySwap) {
            // Single sine arc — peaks at midpoint so pulled player hops over the puller
            player.y = GROUND_LEVEL + CLINCH_PULL_SWAP_ARC_HEIGHT * Math.sin(t * Math.PI);
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

        // If pulled player hits boundary margin during pull, end tween early
        const hitBoundary = isPullTween && t > 0.05 &&
          Math.abs(newX - clampedX) > 1;

        if (t >= 1 || hitBoundary) {
          // End tween — ensure player is back on the ground
          player.y = GROUND_LEVEL;
          player.isGrabBreakSeparating = false;
          player.grabBreakSepStartTime = 0;
          player.grabBreakSepDuration = 0;
          player.grabBreakStartX = undefined;
          player.grabBreakTargetX = undefined;

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
            // Release both players' input locks when pull tween ends
            player.inputLockUntil = 0;
            // Find and release the puller too
            let pullerRef = null;
            if (player.pullReversalPullerId) {
              const allPlayers = room.players || [];
              pullerRef = allPlayers.find(p => p.id === player.pullReversalPullerId);
              if (pullerRef) {
                pullerRef.inputLockUntil = 0;
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
                  pullerRef.isBoundaryPullSwap = false;
                }
              }
              player.pullReversalPullerId = null;
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
      } else if (player.isHit) {
        // Cinematic kill victims fly off with no friction, no DI, no slowdown
        if (player.isCinematicKillVictim) {
          player.x += player.knockbackVelocity.x * delta * speedFactor;
        } else {
          // SAFETY: Maximum isHit duration to prevent stuck states (1 second max)
          const MAX_HIT_DURATION = 1000;
          const hitDuration = player.lastHitTime ? now - player.lastHitTime : 0;
          if (hitDuration > MAX_HIT_DURATION) {
            player.isHit = false;
            player.isAlreadyHit = false;
            player.isSlapKnockback = false;
            player.isBurstKnockback = false;
            player.burstKnockbackStartTime = 0;
            player.isParryKnockback = false;
            player.knockbackVelocity.x = 0;
            player.movementVelocity = 0;
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
              player.knockbackVelocity.x *= 0.92;
            } else if (isLoserAfterGameOver && isPastMapBoundaries) {
              player.knockbackVelocity.x *= 0.95;
            } else {
              const knockbackDirection = player.knockbackVelocity.x > 0 ? 1 : -1;
              const isHoldingOpposite = (knockbackDirection > 0 && player.keys.a && !player.keys.d) || 
                                        (knockbackDirection < 0 && player.keys.d && !player.keys.a);
              const DI_FRICTION_BONUS = 0.96;
              
              if (player.isBurstKnockback) {
                const burstAge = now - (player.burstKnockbackStartTime || 0);
                const friction = burstAge < BURST_KB_PHASE_SWITCH_MS
                  ? BURST_KB_INITIAL_FRICTION
                  : BURST_KB_LATE_FRICTION;
                player.knockbackVelocity.x *= friction;
              } else if (player.isSlapKnockback) {
                player.knockbackVelocity.x *= 0.97;
              } else {
                player.knockbackVelocity.x *= 0.96;
              }
              if (isHoldingOpposite && !player.isBurstKnockback) {
                player.knockbackVelocity.x *= DI_FRICTION_BONUS;
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
      if (Math.abs(player.slapParryKnockbackVelocity) > 0.01) {
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
      if (!player.isCPU && player.inputBuffer) {
        executeInputBuffer(player, rooms);
      }

      // Handle grab startup — lunge forward during startup, then range check at the end.
      if (player.isGrabStartup) {
        const elapsed = now - player.grabStartupStartTime;
        const startupMs = player.grabStartupDuration || GRAB_STARTUP_DURATION_MS;

        // Apply forward lunge movement each tick during startup
        if (elapsed < startupMs && GRAB_LUNGE_DISTANCE > 0) {
          const lungePerTick = GRAB_LUNGE_DISTANCE / (startupMs / delta);
          const lungeDir = -player.facing; // facing 1=left, -1=right
          const newX = player.x + lungeDir * lungePerTick;
          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(newX, MAP_RIGHT_BOUNDARY));
        }

        if (elapsed >= startupMs) {
          // Startup complete — instant range check
          const opponent = room.players.find((p) => p.id !== player.id);

          // Grabs auto-track sidestepping opponents within generous range
          const opponentSidestepping = opponent && opponent.isSidestepping;
          const sidestepTrackInRange = opponentSidestepping && Math.abs(player.x - opponent.x) < SIDESTEP_GRAB_TRACK_RANGE;
          const normalGrabInRange = opponent && !opponentSidestepping && isOpponentCloseEnoughForGrab(player, opponent) && isOpponentInFrontOfGrabber(player, opponent);

          if (opponent && !(opponent.isRopeJumping && opponent.ropeJumpPhase === "active") && (normalGrabInRange || sidestepTrackInRange)) {
            // === TECH CHECK: opponent also in grab startup → both tech ===
            // Whiffing players CANNOT tech — they are fully vulnerable.
            // Also check if opponent's startup has already expired AND their grab
            // would NOT have connected (out of range or facing wrong way).
            // This prevents tick processing order from causing false techs.
            const opponentWouldWhiff = opponent.isGrabStartup &&
              (now - opponent.grabStartupStartTime) >= (opponent.grabStartupDuration || GRAB_STARTUP_DURATION_MS) &&
              !(isOpponentCloseEnoughForGrab(opponent, player) && isOpponentInFrontOfGrabber(opponent, player));
            if ((opponent.isGrabStartup || opponent.isGrabTeching) &&
                !opponent.isWhiffingGrab && !opponent.isGrabWhiffRecovery &&
                !opponentWouldWhiff) {
              executeGrabTech(player, opponent, room, io, triggerHitstop);
              return;
            }

            // === GRAB CHECK: opponent is in range and grabbable ===
            // Grabs beat dodges at any point — the hard counter to dodge
            const opponentGrabbableNeutral =
              !opponent.isBeingThrown &&
              !opponent.isBeingGrabbed &&
              !player.isBeingGrabbed &&
              !player.throwTechCooldown;
            const grabWinsVsSlap =
              opponent.isAttacking &&
              opponent.attackType === "slap" &&
              grabBeatsSlap(player, opponent);
            const canConnect =
              opponentGrabbableNeutral &&
              (!opponent.isAttacking || grabWinsVsSlap);

            if (canConnect) {
              // SUCCESSFUL GRAB — same connect logic as before
              player.isGrabStartup = false;
              player.y = GROUND_LEVEL;
              player.grabMovementVelocity = 0;
              player.movementVelocity = 0;
              player.isStrafing = false;
              player.grabState = GRAB_STATES.INITIAL;
              player.grabAttemptType = null;

              player.isGrabbing = true;
              player.grabStartTime = now;
              player.grabbedOpponent = opponent.id;

              // One-sided clinch: grabber has grip, opponent does NOT
              player.hasGrip = true;
              player.inClinch = true;
              player.clinchAction = "push";
              opponent.hasGrip = false;
              opponent.inClinch = true;
              opponent.clinchAction = "neutral";

              // IMMEDIATE PUSH (auto-burst)
              player.isGrabPushing = true;
              player.isGrabWalking = true;
              player.grabActionType = "push";
              player.grabDecisionMade = true;
              player.grabPushStartTime = 0;
              player.grabPushEndTime = 0;
              opponent.isBeingGrabPushed = true;

              player.grabActionStartTime = 0;
              player.grabDurationPaused = false;
              player.grabDurationPausedAt = 0;
              player.isAtBoundaryDuringGrab = false;
              player.lastGrabPushStaminaDrainTime = 0;
              player.isAttemptingPull = false;
              player.isAttemptingGrabThrow = false;

              // COUNTER GRAB: grabbing during raw parry = locked
              const wasOpponentRawParrying = opponent.isRawParrying;
              opponent.isCounterGrabbed = wasOpponentRawParrying;

              if (wasOpponentRawParrying) {
                const grabberPlayerNumber = room.players.indexOf(player) === 0 ? 1 : 2;
                const centerX = (player.x + opponent.x) / 2;
                const centerY = (player.y + opponent.y) / 2;
                io.in(room.id).emit("counter_grab", {
                  type: "counter_grab",
                  grabberId: player.id,
                  grabbedId: opponent.id,
                  grabberX: player.x,
                  grabbedX: opponent.x,
                  x: centerX,
                  y: centerY,
                  grabberPlayerNumber,
                  counterId: `counter-grab-${now}-${Math.random().toString(36).substr(2, 9)}`,
                });
              }

              player.isRawParrySuccess = false;
              player.isPerfectRawParrySuccess = false;

              clearAllActionStates(opponent);
              opponent.y = GROUND_LEVEL;
              opponent.isBeingGrabbed = true;
              opponent.isBeingGrabPushed = false;
              opponent.lastGrabPushStaminaDrainTime = 0;

              triggerHitstop(room, HITSTOP_GRAB_MS);

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
            } else {
              // Opponent in ungrabable state (attacking, dodging, etc.) — whiff
              executeGrabWhiff(player);
            }
          } else {
            // Out of range or no opponent — whiff
            executeGrabWhiff(player);
          }
        } else {
          // During startup — just wait (no hop, no movement)
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
      if (player.isGrabbing && !player.isThrowing && !player.isBeingThrown) {
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

      // Emit danger zone event for dramatic slow-mo effect (only once per knockback)
      if (isInDangerZone && !player.dangerZoneTriggered) {
        player.dangerZoneTriggered = true;
        io.in(room.id).emit("danger_zone", {
          playerId: player.id,
          x: player.x,
          y: player.y,
          direction: player.x < (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2 ? "left" : "right",
        });
        // Emit extra screen shake for dramatic near-ring-out (throttled)
        emitThrottledScreenShake(room, io, {
          intensity: 1.0,
          duration: 400,
        });
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
        now - room.gameOverTime >= 3000 &&
        !room.matchOver
      ) {
        // 5 seconds
        resetRoomAndPlayers(room, io);
      }

      // Stamina regen (freeze stamina once round is over)
      // Don't regen while being grabbed, gassed, or in clinch
      if (player.stamina < 100 && !room.gameOver && !player.isBeingGrabbed && !player.isGassed && !player.inClinch) {
        if (staminaRegenCounter >= STAMINA_REGEN_INTERVAL_MS) {
          player.stamina += STAMINA_REGEN_AMOUNT;
          player.stamina = Math.min(player.stamina, 100);
        }
      }

      // Balance regen — passive +5/sec, crouch bonus +10/sec, no regen when gassed or in clinch
      if (player.balance < BALANCE_MAX && !room.gameOver && !player.isGassed && !player.inClinch) {
        const deltaSec = delta / 1000;
        let balanceRegen = BALANCE_PASSIVE_REGEN_PER_SEC;
        if (player.isCrouchStance) {
          balanceRegen += BALANCE_CROUCH_REGEN_PER_SEC;
        }
        player.balance = Math.min(BALANCE_MAX, player.balance + balanceRegen * deltaSec);
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
            : CLINCH_THROW_ARC_HEIGHT;
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
            throwDistance = CLINCH_THROW_DISTANCE;
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
            // Piecewise cinematic arc: rise → brief hang off-screen → crash down
            const RISE_END = 0.32;
            const HANG_END = 0.40;
            const KILL_LAND_OFFSET = 30;
            const clampedProgress = Math.min(throwProgress, 1);
            if (clampedProgress < RISE_END) {
              const riseT = clampedProgress / RISE_END;
              const eased = 1 - (1 - riseT) * (1 - riseT);
              opponent.y = GROUND_LEVEL + eased * throwArcHeight;
            } else if (clampedProgress < HANG_END) {
              opponent.y = GROUND_LEVEL + throwArcHeight;
            } else {
              const fallT = (clampedProgress - HANG_END) / (1 - HANG_END);
              const eased = fallT * fallT;
              opponent.y = GROUND_LEVEL + throwArcHeight * (1 - eased) - KILL_LAND_OFFSET * eased;
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
              emitThrottledScreenShake(room, io, {
                intensity: 2.5,
                duration: 500,
              });
              triggerHitstop(room, HITSTOP_THROW_MS);
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
                emitThrottledScreenShake(room, io, {
                  intensity: 0.6,
                  duration: 200,
                });
                triggerHitstop(room, HITSTOP_THROW_MS);
              }
            }

            player.isThrowing = false;
            player.throwOpponent = null;
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
            opponent.burstKnockbackStartTime = 0;

            // Set Y to correct ground level based on landing context
            const landedOutsideDohyo = opponent.x <= DOHYO_LEFT_BOUNDARY || opponent.x >= DOHYO_RIGHT_BOUNDARY;
            if (wasKillThrow) {
              // Kill throw victim is rotated 90° — offset Y so visual center sits at ground
              if (landedOutsideDohyo) {
                opponent.y = GROUND_LEVEL - DOHYO_FALL_DEPTH - 30;
                opponent.isFallingOffDohyo = true;
              } else {
                opponent.y = GROUND_LEVEL - 30;
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

      // Throw tech
      if (player.isThrowTeching) {
        const currentTime = now;
        const freezeElapsed = currentTime - player.techFreezeStartTime;

        if (freezeElapsed >= TECH_FREEZE_DURATION) {
          // Only apply knockback after freeze duration
          if (player.pendingKnockback !== undefined) {
            player.knockbackVelocity.x = player.pendingKnockback;
            delete player.pendingKnockback;
          }

          player.x += player.knockbackVelocity.x * delta * speedFactor;
          player.knockbackVelocity.x *= 0.9; // Apply friction

          if (Math.abs(player.knockbackVelocity.x) < 0.1) {
            player.knockbackVelocity.x = 0;
            player.isThrowTeching = false;
          }
        }
        // During freeze duration, ensure the player doesn't move
        else {
          player.knockbackVelocity.x = 0;
        }
      }
      // Grounded dash dodge — slides forward on the ground, triggers dodge slap if deep enough into opponent
      if (player.isDodging && player.isBeingGrabbed) {
        player.isDodging = false;
        player.isDodgeStartup = false;
        player.dodgeDirection = null;
        player.y = GROUND_LEVEL;
      }
      // S-key dodge cancel — stops the dash immediately
      if (player.isDodging && !player.isBeingGrabbed && player.keys.s) {
        player.isDodging = false;
        player.isDodgeStartup = false;
        player.dodgeDirection = null;
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
        // ACTIVE PHASE: actual dash movement
        else {
          let currentDodgeSpeed = speedFactor * DODGE_BASE_SPEED;

          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentDodgeSpeed *= Math.min(player.powerUpMultiplier * 0.85, 1.5);
          }

          let newX = player.x + player.dodgeDirection * delta * currentDodgeSpeed;
          newX = Math.max(MAP_LEFT_BOUNDARY, Math.min(newX, MAP_RIGHT_BOUNDARY));

          // Pushbox: stop at opponent's body instead of phasing through.
          if (dodgeOpponent && !dodgeOpponent.isDead) {
            const opponentAllowsPhaseThrough =
              dodgeOpponent.isAttacking && dodgeOpponent.attackType === "charged" && !dodgeOpponent.isInStartupFrames;
            if (!opponentAllowsPhaseThrough) {
              const bodyWidth = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, dodgeOpponent.sizeMultiplier || 1);
              const wouldOverlap = Math.abs(newX - dodgeOpponent.x) < bodyWidth;
              if (wouldOverlap) {
                if (player.dodgeDirection > 0 && dodgeOpponent.x > player.x) {
                  newX = Math.min(newX, dodgeOpponent.x - bodyWidth);
                } else if (player.dodgeDirection < 0 && dodgeOpponent.x < player.x) {
                  newX = Math.max(newX, dodgeOpponent.x + bodyWidth);
                }
                newX = Math.max(MAP_LEFT_BOUNDARY, Math.min(newX, MAP_RIGHT_BOUNDARY));
              }
            }
          }

          player.y = GROUND_LEVEL;
          player.x = newX;
        }

        // Dodge active phase expired → transition to RECOVERY PHASE
        if (now >= player.dodgeEndTime) {
          const landingDirection = player.dodgeDirection || 0;
          player.isDodging = false;
          player.isDodgeStartup = false;
          player.dodgeDirection = null;
          player.y = GROUND_LEVEL;
          player.isStrafing = false;
          player.isBraking = false;

          if (dodgeOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
            player.facing = player.x < dodgeOpponent.x ? -1 : 1;
          }

          // Landing momentum on ice
          if ((player.keys.c || player.keys.control) && room.gameStart && !room.gameOver && !room.matchOver) {
            player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
            player.isPowerSliding = true;
          } else {
            player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM;
          }

          if (player.keys.a && !player.keys.d) {
            player.movementVelocity -= 0.2;
          } else if (player.keys.d && !player.keys.a) {
            player.movementVelocity += 0.2;
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

        // Neutral charged attack removed — pending charge cleared, no charge restart
        if (player.pendingChargeAttack) {
          player.pendingChargeAttack = null;
          player.spacebarReleasedDuringDodge = false;
        }
      }

      // Clear dodge landing flag after animation duration (200ms)
      if (player.justLandedFromDodge && player.dodgeLandTime) {
        if (now - player.dodgeLandTime > 200) {
          player.justLandedFromDodge = false;
        }
      }
      
      // POWER SLIDE FROM DODGE: If just landed and holding C/CTRL, ensure power slide is active
      if (player.justLandedFromDodge && (player.keys.c || player.keys.control) && Math.abs(player.movementVelocity) > SLIDE_MAINTAIN_VELOCITY && room.gameStart && !room.gameOver && !room.matchOver) {
        player.isPowerSliding = true;
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
        player.y = GROUND_LEVEL;
      }
      if (player.isSidestepping && !player.isBeingGrabbed) {
        const sidestepOpponent = room.players.find(p => p.id !== player.id && !p.isDead);

        // STARTUP: no movement, vulnerable wind-up.
        // At the end of startup, lock the target so the arc is a fixed trajectory.
        if (player.isSidestepStartup) {
          if (now >= player.sidestepStartupEndTime) {
            player.isSidestepStartup = false;

            const LANDING_SEPARATION = 140;
            const SIDESTEP_SWITCH_RANGE = GRAB_RANGE * 1.4;
            const NO_SWITCH_MAX_TRAVEL = 120;

            let targetX;
            if (sidestepOpponent) {
              const initDist = Math.abs(player.sidestepStartX - sidestepOpponent.x);
              if (initDist <= SIDESTEP_SWITCH_RANGE) {
                targetX = sidestepOpponent.x + player.sidestepDirection * LANDING_SEPARATION;
              } else {
                targetX = player.sidestepStartX + player.sidestepDirection * NO_SWITCH_MAX_TRAVEL;
              }
            } else {
              targetX = player.sidestepStartX + player.sidestepDirection * NO_SWITCH_MAX_TRAVEL;
            }

            const maxBound = player.sidestepStartX + player.sidestepDirection * player.sidestepMaxTravel;
            if ((targetX - maxBound) * player.sidestepDirection > 0) {
              targetX = maxBound;
            }
            player.sidestepTargetX = Math.max(MAP_LEFT_BOUNDARY, Math.min(targetX, MAP_RIGHT_BOUNDARY));

            const travelDist = Math.abs(player.sidestepTargetX - player.sidestepStartX);
            const rawActiveMs = travelDist / SIDESTEP_ARC_SPEED;
            const activeMs = Math.max(SIDESTEP_ACTIVE_MIN_MS, Math.min(rawActiveMs, SIDESTEP_ACTIVE_MAX_MS));
            player.sidestepActiveDuration = activeMs;
            player.sidestepActiveEndTime = now + activeMs;
            player.sidestepEndTime = player.sidestepActiveEndTime + SIDESTEP_RECOVERY_MS;
            player.actionLockUntil = player.sidestepEndTime;
          }
        }
        // ACTIVE: fixed-trajectory ease-in-out arc toward the locked target.
        // Nothing the opponent does during iframes can alter this path.
        else if (!player.isSidestepRecovery) {
          const activeElapsed = now - player.sidestepStartupEndTime;
          const t = Math.min(activeElapsed / player.sidestepActiveDuration, 1);

          const easeT = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2;

          player.x = player.sidestepStartX + (player.sidestepTargetX - player.sidestepStartX) * easeT;
          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));

          const travelRatio = player.sidestepMaxTravel / SIDESTEP_MAX_TRAVEL;
          const arcDepth = SIDESTEP_ARC_DEPTH_MAX - (SIDESTEP_ARC_DEPTH_MAX - SIDESTEP_ARC_DEPTH_MIN) * travelRatio;
          player.y = GROUND_LEVEL - arcDepth * Math.sin(Math.PI * t);
        }

        // TRANSITION: active → recovery
        // Arc delivered the player to the locked target. Now compute the
        // ideal resting position based on where the opponent ACTUALLY is,
        // and let recovery smoothly slide there.
        if (now >= player.sidestepActiveEndTime && !player.isSidestepStartup && !player.isSidestepRecovery) {
          player.isSidestepRecovery = true;
          player.y = GROUND_LEVEL;
          player.x = player.sidestepTargetX;

          const LANDING_SEP = 140;
          if (sidestepOpponent) {
            const landingSide = player.x >= sidestepOpponent.x ? 1 : -1;
            const idealX = sidestepOpponent.x + landingSide * LANDING_SEP;
            const currentDist = Math.abs(player.x - sidestepOpponent.x);

            if (currentDist < LANDING_SEP) {
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

        // RECOVERY: smooth ease-out slide away from opponent if overlapping.
        if (player.isSidestepRecovery) {
          const recoveryElapsed = now - player.sidestepActiveEndTime;
          const recoveryT = Math.min(recoveryElapsed / SIDESTEP_RECOVERY_MS, 1);
          const easeOut = 1 - (1 - recoveryT) * (1 - recoveryT);

          if (sidestepOpponent) {
            const LANDING_SEP = 140;
            const landingSide = player.x >= sidestepOpponent.x ? 1 : -1;
            const idealX = sidestepOpponent.x + landingSide * LANDING_SEP;
            const currentDist = Math.abs(player.sidestepTargetX - sidestepOpponent.x);

            if (currentDist < LANDING_SEP) {
              player.sidestepRecoveryTargetX = Math.max(MAP_LEFT_BOUNDARY,
                Math.min(idealX, MAP_RIGHT_BOUNDARY));
            }
          }

          const arcLandX = player.sidestepTargetX;
          player.x = arcLandX + (player.sidestepRecoveryTargetX - arcLandX) * easeOut;
          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));
        }

        // END: cleanup
        if (now >= player.sidestepEndTime) {
          player.isSidestepping = false;
          player.isSidestepStartup = false;
          player.isSidestepRecovery = false;
          player.y = GROUND_LEVEL;
          player.actionLockUntil = 0;

          if (sidestepOpponent && !player.atTheRopesFacingDirection) {
            player.facing = player.x < sidestepOpponent.x ? -1 : 1;
          }
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
          const elapsed = now - player.ropeJumpActiveStartTime;
          const t = Math.min(1, elapsed / ROPE_JUMP_ACTIVE_MS);

          const easedT = 0.5 - 0.5 * Math.cos(Math.PI * t);

          player.x = player.ropeJumpStartX + (player.ropeJumpTargetX - player.ropeJumpStartX) * easedT;
          player.y = GROUND_LEVEL + ROPE_JUMP_ARC_HEIGHT * 4 * t * (1 - t);

          player.x = Math.max(MAP_LEFT_BOUNDARY, Math.min(player.x, MAP_RIGHT_BOUNDARY));

          if (t >= 1) {
            player.ropeJumpPhase = "landing";
            player.ropeJumpLandingTime = now;
            player.x = player.ropeJumpTargetX;
            player.y = GROUND_LEVEL;
            player.actionLockUntil = now + ROPE_JUMP_LANDING_RECOVERY_MS;

            // No one-frame position snap — adjustPlayerPositions handles the
            // overlap gradually over several ticks for a smooth visual slide.

            emitThrottledScreenShake(room, io, {
              intensity: 0.65,
              duration: 250,
            });
          }
        } else if (player.ropeJumpPhase === "landing") {
          if (now >= player.ropeJumpLandingTime + ROPE_JUMP_LANDING_RECOVERY_MS) {
            player.isRopeJumping = false;
            player.ropeJumpPhase = null;
            player.ropeJumpStartTime = 0;
            player.ropeJumpStartX = 0;
            player.ropeJumpTargetX = 0;
            player.ropeJumpDirection = 0;
            player.ropeJumpActiveStartTime = 0;
            player.ropeJumpLandingTime = 0;
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

      // ── Hit Fall — parametric arc back to ground after airborne hit ──
      if (player.isHitFalling) {
        const heightAboveGround = player.hitFallStartY - GROUND_LEVEL;
        const fallDuration = HIT_FALL_BASE_MS + heightAboveGround * HIT_FALL_HEIGHT_SCALE;
        const elapsed = now - player.hitFallStartTime;
        const t = Math.min(elapsed / fallDuration, 1);
        const popHeight = heightAboveGround * HIT_FALL_POP_HEIGHT_RATIO;

        if (t < HIT_FALL_POP_FRACTION) {
          const popT = t / HIT_FALL_POP_FRACTION;
          player.y = player.hitFallStartY + popHeight * Math.sin(Math.PI * popT * 0.5);
        } else {
          const fallT = (t - HIT_FALL_POP_FRACTION) / (1 - HIT_FALL_POP_FRACTION);
          const easeIn = fallT * fallT;
          const peakY = player.hitFallStartY + popHeight;
          player.y = peakY - (peakY - GROUND_LEVEL) * easeIn;
        }

        if (t >= 1) {
          player.y = GROUND_LEVEL;
          clearHitFall(player);
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
      if (player.isGrabbingMovement) {
        const currentTime = now;
        const opponent = room.players.find((p) => p.id !== player.id);

        // Check for grab clash - both players grabbing towards each other
        if (
          opponent &&
          opponent.isGrabbingMovement &&
          !player.isGrabClashing &&
          !opponent.isGrabClashing &&
          !player.isBeingGrabbed &&
          !opponent.isBeingGrabbed &&
          !player.isThrowing &&
          !opponent.isThrowing &&
          !player.isBeingThrown &&
          !opponent.isBeingThrown &&
          isOpponentCloseEnoughForGrab(player, opponent)
        ) {
          // Clear any existing grab movement timers
          timeoutManager.clearPlayerSpecific(
            player.id,
            "grabMovementTimeout"
          );
          timeoutManager.clearPlayerSpecific(
            opponent.id,
            "grabMovementTimeout"
          );

          // Start grab clash for both players
          player.isGrabbingMovement = false;
          player.isGrabClashing = true;
          player.grabClashStartTime = currentTime;
          player.grabClashInputCount = 0;
          player.grabMovementVelocity = 0;
          player.movementVelocity = 0;
          player.isStrafing = false;

          opponent.isGrabbingMovement = false;
          opponent.isGrabClashing = true;
          opponent.grabClashStartTime = currentTime;
          opponent.grabClashInputCount = 0;
          opponent.grabMovementVelocity = 0;
          opponent.movementVelocity = 0;
          opponent.isStrafing = false;

          // Initialize clash data for the room
          room.grabClashData = {
            player1Id: player.id,
            player2Id: opponent.id,
            startTime: currentTime,
            duration: 2000, // 2 seconds
            player1Inputs: 0,
            player2Inputs: 0,
          };

          // Emit grab clash start event
          io.in(room.id).emit("grab_clash_start", {
            player1Id: player.id,
            player2Id: opponent.id,
            duration: 2000,
            player1Position: { x: player.x, y: player.y, facing: player.facing },
            player2Position: { x: opponent.x, y: opponent.y, facing: opponent.facing },
          });

          // Set clash resolution timer
          setPlayerTimeout(
            player.id,
            () => {
              resolveGrabClash(room, io);
            },
            2000,
            "grabClashResolution"
          );

          return; // Skip normal grab movement processing
        }

        // Move forward during grab movement (after startup hop)
        let currentSpeedFactor = speedFactor;
        if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
          currentSpeedFactor *= player.powerUpMultiplier;
        }

        // Calculate new position with grab movement
        const newX =
          player.x +
          player.grabMovementDirection *
            delta *
            currentSpeedFactor *
            player.grabMovementVelocity;

        // Calculate boundaries
        const sizeOffset = 0;
        const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
        const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

        // Update position within boundaries
        if (newX >= leftBoundary && newX <= rightBoundary) {
          player.x = newX;
        } else {
          // Stop at boundary
          player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
        }

        // Continuously check for grab opportunity during movement (only if opponent is not also grabbing)
        // Also require opponent to be in front of the grabber - prevents grabbing players
        // who have dodged through and are now behind the grabbing player
        if (
          opponent &&
          !opponent.isGrabbingMovement &&
          !(opponent.isRopeJumping && opponent.ropeJumpPhase === "active") &&
          isOpponentCloseEnoughForGrab(player, opponent) &&
          isOpponentInFrontOfGrabber(player, opponent) &&
          !opponent.isBeingThrown &&
          !opponent.isAttacking &&
          !opponent.isBeingGrabbed &&
          !player.isBeingGrabbed &&
          !player.throwTechCooldown
        ) {
          // Successful grab - stop all movement and initiate grab
          // NOTE: grabApproachSpeed was already captured at grab startup (E press)

          player.isGrabbingMovement = false;
          player.grabMovementVelocity = 0;
          player.movementVelocity = 0;
          player.isStrafing = false;
          // Transition state out of attempting
          player.grabState = GRAB_STATES.INITIAL;
          player.grabAttemptType = null;

          // Start the actual grab
          player.isGrabbing = true;
          player.grabStartTime = now;
          player.grabbedOpponent = opponent.id;

          // One-sided clinch: grabber has grip, opponent does NOT
          player.hasGrip = true;
          player.inClinch = true;
          player.clinchAction = "push";
          opponent.hasGrip = false;
          opponent.inClinch = true;
          opponent.clinchAction = "neutral";

          // IMMEDIATE PUSH: Push starts right away (processed after hitstop)
          // No decision window — push is the default, pull/throw interrupt it
          player.isGrabPushing = true;
          player.isGrabWalking = true;
          player.grabActionType = "push";
          player.grabDecisionMade = true;
          player.grabPushStartTime = 0; // Initialized on first tick after hitstop
          player.grabPushEndTime = 0;
          opponent.isBeingGrabPushed = true;

          // Reset remaining grab action state
          player.grabActionStartTime = 0;
          player.grabDurationPaused = false;
          player.grabDurationPausedAt = 0;
          player.isAtBoundaryDuringGrab = false;
          player.lastGrabPushStaminaDrainTime = 0;
          player.isAttemptingPull = false;
          player.isAttemptingGrabThrow = false;
          
          // COUNTER GRAB: Only when grabbing opponent during their raw parry. Cannot grab break (LOCKED).
          // Grabbing during recovery does NOT count as punish - normal grab only.
          const wasOpponentRawParrying = opponent.isRawParrying;
          opponent.isCounterGrabbed = wasOpponentRawParrying; // Counter grabbed = cannot grab break

          if (wasOpponentRawParrying) {
            // Counter Grab: grabbed their raw parry - show LOCKED! effect + "Counter Grab" banner
            const grabberPlayerNumber = room.players.indexOf(player) === 0 ? 1 : 2;
            const centerX = (player.x + opponent.x) / 2;
            const centerY = (player.y + opponent.y) / 2;
            io.in(room.id).emit("counter_grab", {
              type: "counter_grab",
              grabberId: player.id,
              grabbedId: opponent.id,
              grabberX: player.x,
              grabbedX: opponent.x,
              x: centerX,
              y: centerY,
              grabberPlayerNumber,
              counterId: `counter-grab-${now}-${Math.random().toString(36).substr(2, 9)}`,
            });
          }
          
          // Clear parry success state when starting a grab
          player.isRawParrySuccess = false;
          player.isPerfectRawParrySuccess = false;
          
          // CRITICAL: Clear ALL action states when being grabbed
          clearAllActionStates(opponent);
          opponent.y = GROUND_LEVEL;
          opponent.isBeingGrabbed = true;
          opponent.isBeingGrabPushed = false;
          opponent.lastGrabPushStaminaDrainTime = 0;

          // SMASH-STYLE: Brief hitstop when grab connects for impact
          triggerHitstop(room, HITSTOP_GRAB_MS);
          
          // If opponent was at the ropes, clear that state but keep the facing direction locked
          if (opponent.isAtTheRopes) {
            timeoutManager.clearPlayerSpecific(opponent.id, "atTheRopesTimeout");
            opponent.isAtTheRopes = false;
            opponent.atTheRopesStartTime = 0;
            // Keep atTheRopesFacingDirection - this will lock their facing during the grab
          }
          
          // Clear all input keys except spacebar (for grab break - unless counter grabbed)
          opponent.keys.shift = false;
          opponent.keys.w = false;
          opponent.keys.a = false;
          opponent.keys.s = false;
          opponent.keys.d = false;
          opponent.keys.e = false;
          opponent.keys.f = false;
          opponent.keys.mouse1 = false;
          opponent.keys.mouse2 = false;

          // Set grab facing direction
          if (player.isChargingAttack) {
            player.grabFacingDirection = player.chargingFacingDirection;
          } else {
            player.grabFacingDirection = player.facing;
          }
        }
      }

      // Strafing
      if (
        !player.isThrowLanded && // Block all movement for throw landed players
        !player.isRawParrying && // Block all movement during raw parry
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
          (!player.keys[" "] &&
            player.isSlapAttack &&
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
        let currentSpeedFactor = speedFactor;

        // Apply speed power-up
        if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
          currentSpeedFactor *= player.powerUpMultiplier;
        }
        // Reduce speed when size power-up is active
        // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
        //   currentSpeedFactor *= 0.85;
        // }

        // Initialize movement velocity if it doesn't exist
        if (!player.movementVelocity) {
          player.movementVelocity = 0;
        }

        // ============================================
        // POWER SLIDE (C key) - Commit to momentum for speed
        // Can only slide if moving fast enough, can cancel with dodge
        // ============================================
        const canPowerSlide = 
          room.gameStart && // Only during active gameplay (not during walk-up)
          !room.gameOver && // Not after round ends
          !room.matchOver && // Not after match ends
          !player.isDodging &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isChargingAttack &&
          !player.isRecovering &&
          !player.isRawParrying &&
          !player.isHit &&
          !player.isBeingGrabbed &&
          !player.isBeingThrown &&
          !player.isAtTheRopes &&
          !player.isGrabClashing &&
          !player.isGrabBreaking &&
          !player.isGrabBreakSeparating;

        if ((player.keys.c || player.keys.control) && canPowerSlide) {
          const currentSpeed = Math.abs(player.movementVelocity);
          const strafeDuration = player.strafeStartTime > 0 ? now - player.strafeStartTime : 0;
          // Can start power slide if: came from dodge landing OR strafed long enough
          const canStartSlide = player.justLandedFromDodge || strafeDuration >= SLIDE_STRAFE_TIME_REQUIRED;
          
          if (!player.isPowerSliding) {
            // STARTING a new slide - requires speed AND (dodge landing OR sustained strafe)
            if (currentSpeed >= SLIDE_MIN_VELOCITY && canStartSlide) {
              const slideDirection = player.movementVelocity > 0 ? 1 : -1;
              player.movementVelocity = currentSpeed * SLIDE_SPEED_BOOST * slideDirection;
              // Cap at slide max speed
              player.movementVelocity = Math.max(
                Math.min(player.movementVelocity, SLIDE_MAX_SPEED),
                -SLIDE_MAX_SPEED
              );
              player.isPowerSliding = true;
              player.isBraking = false;
              player.isStrafing = false;
            }
            // else: not enough speed or not strafing long enough - don't set isPowerSliding
          } else {
            // MAINTAINING an existing slide - use maintain threshold
            if (currentSpeed >= SLIDE_MAINTAIN_VELOCITY) {
              player.isBraking = false;
              player.isStrafing = false;
              // Already sliding, don't boost again
            } else {
              // Dropped below maintain threshold - end slide cleanly
              player.isPowerSliding = false;
            }
          }
        } else if (!player.keys.c && !player.keys.control) {
          // C/CTRL key released - exit power slide
          player.isPowerSliding = false;
        }
        // Note: if C/CTRL is held but canPowerSlide is false (e.g., still in dodge),
        // preserve isPowerSliding state - dodge landing may have set it

        // Calculate effective boundary based on player size with different multipliers
        const sizeOffset = 0;

        // Apply different multipliers for left and right boundaries
        const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
        const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

        // Handle crouch strafing (when holding s + a or d) - higher priority than normal strafing
        if (
          player.isCrouchStance &&
          player.keys.d &&
          !player.keys.a &&
          !player.isDodging &&
          !player.isSidestepping &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isChargingAttack &&
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isPerfectRawParrySuccess && // Block during perfect parry animation
          !player.isGrabBreaking && // Block during grab break animation
          !player.isGrabBreakCountered && // Block during grab break countered state
          !player.isGrabBreakSeparating && // Block during grab break separation
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.isAtTheRopes &&
          !player.isHit
        ) {
          // Velocity-based movement for crouch strafing (with minimal sliding)
          // Apply very high friction when changing directions to minimize sliding
          if (player.movementVelocity < 0) {
            player.movementVelocity *= 0.3; // Much higher friction than normal strafing
          }

          // Very slow acceleration for crouch strafing
          player.movementVelocity = Math.min(
            player.movementVelocity + MOVEMENT_ACCELERATION * 0.2, // Much slower acceleration
            MAX_MOVEMENT_SPEED * 0.3 // Much lower max speed
          );

          // Calculate new position and check boundaries (half speed for crouch)
          const crouchSpeedFactor = currentSpeedFactor * 0.5;
          const newX =
            player.x + delta * crouchSpeedFactor * player.movementVelocity;
          if (newX <= rightBoundary || player.isThrowLanded || isGameOverLoser) {
            player.x = newX;
          } else {
            player.x = rightBoundary;
            player.movementVelocity = 0;
          }
          player.isCrouchStrafing = true;
          if (!player.isAttacking && !player.isChargingAttack) {
            player.isReady = false;
          }
        } else if (
          player.isCrouchStance &&
          player.keys.a &&
          !player.keys.d &&
          !player.isDodging &&
          !player.isSidestepping &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isChargingAttack &&
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isPerfectRawParrySuccess && // Block during perfect parry animation
          !player.isGrabBreaking && // Block during grab break animation
          !player.isGrabBreakCountered && // Block during grab break countered state
          !player.isGrabBreakSeparating && // Block during grab break separation
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.isAtTheRopes &&
          !player.isHit
        ) {
          // Velocity-based movement for crouch strafing (with minimal sliding)
          // Apply very high friction when changing directions to minimize sliding
          if (player.movementVelocity > 0) {
            player.movementVelocity *= 0.3; // Much higher friction than normal strafing
          }

          // Very slow acceleration for crouch strafing
          player.movementVelocity = Math.max(
            player.movementVelocity - MOVEMENT_ACCELERATION * 0.2, // Much slower acceleration
            -MAX_MOVEMENT_SPEED * 0.3 // Much lower max speed
          );

          // Calculate new position and check boundaries (half speed for crouch)
          const crouchSpeedFactor = currentSpeedFactor * 0.5;
          const newX =
            player.x + delta * crouchSpeedFactor * player.movementVelocity;
          if (newX >= leftBoundary || player.isThrowLanded || isGameOverLoser) {
            player.x = newX;
          } else {
            player.x = leftBoundary;
            player.movementVelocity = 0;
          }
          player.isCrouchStrafing = true;
          if (!player.isAttacking && !player.isChargingAttack) {
            player.isReady = false;
          }
        } else if (
          player.keys.d &&
          !player.isCrouchStance &&
          !player.isDodging &&
          !player.isSidestepping &&
          !player.isRopeJumping &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isPerfectRawParrySuccess &&
          !player.isGrabBreaking &&
          !player.isGrabBreakCountered &&
          !player.isGrabBreakSeparating &&
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.pendingSlapCount &&
          !(
            player.slapStrafeCooldown &&
            now < player.slapStrafeCooldownEndTime
          ) && // Block strafing during post-slap cooldown
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
          !player.isCrouchStance &&
          !player.isDodging &&
          !player.isSidestepping &&
          !player.isRopeJumping &&
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isPerfectRawParrySuccess &&
          !player.isGrabBreaking &&
          !player.isGrabBreakCountered &&
          !player.isGrabBreakSeparating &&
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.pendingSlapCount &&
          !(
            player.slapStrafeCooldown &&
            now < player.slapStrafeCooldownEndTime
          ) &&
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
          if (player.isPerfectRawParrySuccess || player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating) {
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
              player.movementVelocity *= 0.92;
            } else if (isGameOverLoser && (player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY)) {
              player.movementVelocity *= 0.96;
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
            // Determine braking state
            const isMovingRight = player.movementVelocity > 0;
            const isMovingLeft = player.movementVelocity < 0;
            const isHoldingLeft = player.keys.a && !player.keys.d;
            const isHoldingRight = player.keys.d && !player.keys.a;
            
            // BRAKING = holding opposite direction to current slide
            const isActiveBraking = (isMovingRight && isHoldingLeft) || (isMovingLeft && isHoldingRight);
            
            // Edge awareness
            const nearEdge = isNearDohyoEdge(player.x);
            const edgeProximity = getEdgeProximity(player.x);
            
            // Normal ice physics: friction first, then position
            const friction = getIceFriction(player, isActiveBraking, nearEdge, edgeProximity);
            
            player.movementVelocity *= friction;

            if (player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY) {
              player.movementVelocity *= 0.92;
            } else if (isGameOverLoser && (player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY)) {
              player.movementVelocity *= 0.96;
            }
            
            player.isBraking = isActiveBraking;
            player.isStrafing = false;

            let newX;
            if (player.isSlapSliding) {
              const opponent = room.players.find((p) => p.id !== player.id);
              let effectiveVelocity = player.movementVelocity;
              if (opponent && arePlayersColliding(player, opponent)) {
                effectiveVelocity *= 0.3;
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
          player.pendingSlapCount || // Clear strafing when buffered slap attack is pending
          (player.slapStrafeCooldown &&
            now < player.slapStrafeCooldownEndTime) // Clear strafing during post-slap cooldown
        ) {
          player.isStrafing = false;
        }

        // Update crouch strafing state
        if (
          !player.isCrouchStance ||
          (!player.keys.a && !player.keys.d) ||
          player.keys.mouse1 ||
          player.isAttacking ||
          player.pendingSlapCount ||
          (player.slapStrafeCooldown &&
            now < player.slapStrafeCooldownEndTime) ||
          player.isHit ||
          player.isRawParrying ||
          player.isAtTheRopes
        ) {
          // Only apply extra friction if player WAS crouch strafing
          if (
            player.isCrouchStrafing &&
            !player.isHit &&
            Math.abs(player.movementVelocity) > 0
          ) {
            player.movementVelocity *= 0.5; // Extra friction to stop quickly
          }
          player.isCrouchStrafing = false;
        }

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
          (player.slapStrafeCooldown &&
            now < player.slapStrafeCooldownEndTime) || // Clear strafing during post-slap cooldown
          player.isHit || // Add isHit to force clear strafing when parried
          player.isRawParrying || // Add isRawParrying to force clear strafing during raw parry
          player.isAtTheRopes || // Block strafing while at the ropes
          player.isRopeJumping // Block strafing during rope jump
        ) {
          player.isStrafing = false;
          // Don't immediately stop on ice unless hit or rope jumping
          if (!player.isHit && !player.isRopeJumping) {
            player.movementVelocity *= MOVEMENT_FRICTION;
          }
          // Also clear grab walking if no movement conditions are met
          if (!player.keys.a && !player.keys.d) {
            player.isGrabWalking = false;
          }
        }

        if (player.y > GROUND_LEVEL && !player.isRopeJumping && !player.isHitFalling) {
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
        (player.slapStrafeCooldown &&
          now < player.slapStrafeCooldownEndTime) || // Clear strafing during post-slap cooldown
        player.isHit || // Add isHit to force clear strafing when parried
        player.isRawParrying || // Add isRawParrying to force clear strafing during raw parry
        player.isAtTheRopes // Block strafing while at the ropes
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

      // Crouch stance
      if (
        player.keys.s &&
        !player.isDodging &&
        !player.isSidestepping &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isGrabbingMovement &&
        !player.isWhiffingGrab &&
        !player.isGrabClashing &&
        !player.isGrabSeparating &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isRecovering &&
        !player.isAttacking &&
        !player.isHit &&
        !player.isRawParryStun &&
        !player.isRawParrying &&
        !player.isAtTheRopes &&
        !player.isChargingAttack
      ) {
        // Start crouch stance if not already crouching
        if (!player.isCrouchStance) {
          player.isCrouchStance = true;
          player.isCrouchStrafing = false;
          // Clear movement momentum when starting crouch stance
          player.movementVelocity = 0;
          player.isStrafing = false;
        }
        // Only set isReady to false if we're not in an attack state
        if (!player.isAttacking && !player.isChargingAttack) {
          player.isReady = false;
        }
      }

      // Handle crouch stance ending logic
      if (player.isCrouchStance) {
        // End crouch stance when s key is released
        if (!player.keys.s) {
          player.isCrouchStance = false;
          player.isCrouchStrafing = false;
        }
      }

      // raw parry
      if (
        player.keys[" "] &&
        !player.isGrabBreaking && // Block raw parry while grab break is active
        !player.isGrabBreakCountered && // Block while countered by grab break
        !player.isGrabBreakSeparating && // Block during grab break separation
        !player.isGrabSeparating && // Block during grab push separation
        !player.grabBreakSpaceConsumed && // Block until the triggering space press is released
        now >= (player.rawParryCooldownUntil || 0) &&
        !player.isDodging && // Block raw parry during dodge - don't interrupt dodge hop
        !player.isSidestepping && // Block raw parry during sidestep
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isGrabbingMovement && // Block raw parry during grab movement
        !player.isWhiffingGrab && // Block raw parry during grab whiff recovery
        !player.isGrabClashing && // Block raw parry during grab clashing
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isRecovering &&
        !player.isAttacking && // Block during any attack (slap or charged)
        !player.isHit &&
        !player.isRawParryStun &&
        !player.isAtTheRopes
      ) {
        // Start raw parry if not already parrying
        if (!player.isRawParrying) {
          // Clear parry success state when starting a new parry
          player.isRawParrySuccess = false;
          player.isPerfectRawParrySuccess = false;
          
          player.isRawParrying = true;
          player.rawParryStartTime = now;
          player.rawParryMinDurationMet = false;
          // Flat stamina cost on parry initiation
          player.stamina = Math.max(0, player.stamina - RAW_PARRY_STAMINA_COST);
          // Clear any existing charge attack when starting raw parry
          clearChargeState(player, true); // true = cancelled
          // Clear movement momentum when starting raw parry to prevent dodge momentum interference
          player.movementVelocity = 0;
          player.isStrafing = false;
          // Cancel power slide when parrying
          player.isPowerSliding = false;
          // Clear crouch states when starting raw parry
          player.isCrouchStance = false;
          player.isCrouchStrafing = false;
          player.pendingSlapCount = 0;
          player.pendingGrabEnder = false;
          player.slapStringPosition = 0;
          player.slapStringWindowUntil = 0;
        }
        // Only set isReady to false if we're not in an attack state
        if (!player.isAttacking && !player.isChargingAttack) {
          player.isReady = false;
        }
      }

      // Handle raw parry ending logic
      if (player.isRawParrying) {
        // Force clear all movement states during raw parry to ensure animation priority
        player.isStrafing = false;
        player.movementVelocity = 0;
        player.isDodging = false;
        player.isDodgeStartup = false;
        player.isDodgeRecovery = false;
        player.isAttacking = false;
        player.isJumping = false;
        // Force clear crouch states during raw parry to prevent concurrent use
        player.isCrouchStance = false;
        player.isCrouchStrafing = false;

        const parryDuration = now - player.rawParryStartTime;

        // Check if minimum duration has been met (whiffed parries use full commitment)
        if (parryDuration >= RAW_PARRY_MIN_DURATION) {
          player.rawParryMinDurationMet = true;
        }

        // Auto-end: parry expires after max duration (forces timing, prevents camping)
        const maxDurationReached = parryDuration >= RAW_PARRY_MAX_DURATION && !player.isPerfectRawParrySuccess;

        // End parry if: (spacebar released AND min duration met) OR max duration reached
        // Don't end parry if in perfect parry animation lock
        if (maxDurationReached || (!player.keys[" "] && player.rawParryMinDurationMet && !player.isPerfectRawParrySuccess)) {
          player.isRawParrying = false;
          player.rawParryStartTime = 0;
          player.rawParryMinDurationMet = false;
          player.isRawParrySuccess = false;
          player.rawParryCooldownUntil = now + RAW_PARRY_COOLDOWN_MS;
          // Space released - clear grab-break consumption so future parries can occur
          player.grabBreakSpaceConsumed = false;
        }
      }

      if (
        player.isAttacking &&
        player.attackType === "charged" &&
        !player.isAtTheRopes
      ) {
        const attackDirection = player.facing === 1 ? -1 : 1;
        const chargePower = player.chargeAttackPower || 0;
        const lungeSpeed = 1.5 + (chargePower / 100) * 5.5;
        const newX = player.x + attackDirection * delta * speedFactor * lungeSpeed;

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

          // Clear knockback (clearAllActionStates doesn't clear this)
          player.knockbackVelocity = { x: 0, y: 0 };

          // Constrain player position to boundary
          if (newX <= MAP_LEFT_BOUNDARY) {
            player.x = MAP_LEFT_BOUNDARY;
          } else if (newX >= MAP_RIGHT_BOUNDARY) {
            player.x = MAP_RIGHT_BOUNDARY;
          }

          // Set timeout to end the at-the-ropes state
          setPlayerTimeout(
            player.id,
            () => {
              player.isAtTheRopes = false;
              player.atTheRopesStartTime = 0;
              player.atTheRopesFacingDirection = null;
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
            // This ensures the attack direction and facing remain consistent
            const opponent = room.players.find(p => p.id !== player.id && !p.isDead);
            if (opponent && !opponent.isDodging && !opponent.isSidestepping) {
              const minDistance = 30; // Scaled for camera zoom (was 40)
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

        if (now >= player.attackEndTime) {
          // Use helper function to safely end charged attacks
          safelyEndChargedAttack(player, rooms);
        }
      } else if (
        player.isAttacking &&
        player.attackType === "charged" &&
        player.isAtTheRopes
      ) {
        // If at the ropes, still check for attack end time but don't move
        if (now >= player.attackEndTime) {
          safelyEndChargedAttack(player, rooms);
        }
      }

      // Grab action system (push, pull, throw during grab)
      updateGrabActions(player, room, io, delta, rooms);


      // Apply speed power-up effect
      if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
        player.speedFactor = speedFactor * player.powerUpMultiplier;
      } else {
        player.speedFactor = speedFactor;
      }

      // Apply size power-up effect
      // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
      //   player.sizeMultiplier = player.powerUpMultiplier;
      // } else {
      player.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
      // }

      // Update charge attack power in the game loop
      if (player.isChargingAttack) {
        const chargeDuration = now - player.chargeStartTime;
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

      // CONTINUOUS MOUSE1 CHECK: Auto-start charging when mouse1 is held and player is idle
      // Neutral charged attack removed — no charge initiation from held mouse1

      // Clear strafing cooldown when it expires
      if (
        player.slapStrafeCooldown &&
        now >= player.slapStrafeCooldownEndTime
      ) {
        player.slapStrafeCooldown = false;
        player.slapStrafeCooldownEndTime = 0;
      }

      // FINAL GUARD: sanitize stamina once per tick per player before emit
      player.stamina = clampStaminaValue(player.stamina);

      // Gassed state: trigger when stamina hits 0, auto-clear after duration
      // During gassed, stamina is locked at 0 (no drain can extend it)
      if (player.isGassed) {
        player.stamina = 0;
      }
      if (player.stamina <= 0 && !player.isGassed && !room.gameOver) {
        player.isGassed = true;
        player.gassedUntil = now + GASSED_DURATION_MS;
        player.stamina = 0;
      }
      if (player.isGassed && now >= player.gassedUntil) {
        player.isGassed = false;
        player.gassedUntil = 0;
        player.stamina = Math.min(100, GASSED_RECOVERY_STAMINA);
      }
    });

    // ROOM-LEVEL SAFETY: Check game reset outside player loop
    // This ensures reset is checked even if all players return early
    // (e.g., during hitstop, or if loser has isHit=false)
    if (
      room.gameOver &&
      room.gameOverTime &&
      now - room.gameOverTime >= 3000 &&
      !room.matchOver
    ) {
      resetRoomAndPlayers(room, io);
    }

    // PERFORMANCE: Only broadcast every N ticks to reduce network load
    // Game logic runs at 64Hz, broadcasts at 32Hz — client interpolation smooths to 60fps
    const shouldBroadcast = broadcastTickCounter % BROADCAST_EVERY_N_TICKS === 0 || room.forceBroadcast;
    if (room.forceBroadcast) room.forceBroadcast = false;
    if (shouldBroadcast) {
      // Initialize previousPlayerStates if it doesn't exist (for rooms created before optimization)
      if (!room.previousPlayerStates) {
        room.previousPlayerStates = [null, null];
      }
      
      // PERFORMANCE: Use delta updates - only send changed properties
      // This significantly reduces network bandwidth and client-side processing
      const player1Delta = computePlayerDelta(room.players[0], room.previousPlayerStates[0]);
      const player2Delta = computePlayerDelta(room.players[1], room.previousPlayerStates[1]);
      
      // Store current state for next comparison
      room.previousPlayerStates[0] = clonePlayerState(room.players[0]);
      room.previousPlayerStates[1] = clonePlayerState(room.players[1]);
      
      io.in(room.id).emit("fighter_action", {
        player1: player1Delta,
        player2: player2Delta,
        // Include flag so client knows this is a delta update
        isDelta: true,
      });
    }
  }
  
  // Increment broadcast counter
  broadcastTickCounter++;

  if (staminaRegenCounter >= STAMINA_REGEN_INTERVAL_MS) {
    staminaRegenCounter = 0; // Reset the counter after interval
  }
}


let activeConnectionCount = 0;

io.on("connection", (socket) => {
  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  activeConnectionCount++;
  startGameLoop();

  io.emit("rooms", rooms);

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
});

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
  DOHYO_FALL_SPEED, DOHYO_FALL_DEPTH, DOHYO_FALL_HORIZONTAL_RETENTION,
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
  DODGE_DURATION, DODGE_BASE_SPEED, DODGE_HOP_HEIGHT, DODGE_LANDING_MOMENTUM,
  DODGE_CANCEL_DURATION, DODGE_CANCEL_SPEED_MULT, DODGE_CROSSED_THROUGH_GRACE,
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
  RAW_PARRY_STAMINA_COST, RAW_PARRY_MIN_DURATION, PULL_BOUNDARY_MARGIN,
  AT_THE_ROPES_DURATION,
  KNOCKBACK_IMMUNITY_DURATION,
  STAMINA_REGEN_INTERVAL_MS, STAMINA_REGEN_AMOUNT,
  SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST, DODGE_STAMINA_COST,
  GASSED_DURATION_MS, GASSED_RECOVERY_STAMINA,
  HITSTOP_GRAB_MS, HITSTOP_THROW_MS,
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
  canPlayerDodge,
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
} = require("./gameFunctions");

// Import delta state utilities
const { computePlayerDelta, clonePlayerState } = require("./deltaState");

// Import grab mechanics
const {
  correctFacingAfterGrabOrThrow,
  executeGrabSeparation,
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
  // PERFORMANCE: Use for-loop instead of forEach to avoid closure overhead at 64Hz.
  // Also skip rooms with < 2 players via continue (no function call overhead).
  for (let _roomIdx = 0; _roomIdx < rooms.length; _roomIdx++) {
    const room = rooms[_roomIdx];
    if (room.players.length < 2) continue;

    staminaRegenCounter += delta;

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
        const currentTime = Date.now();
        const cpuPlayer = room.players.find(p => p.isCPU);
        const humanPlayer = room.players.find(p => !p.isCPU);
        if (cpuPlayer && humanPlayer) {
          // Update AI decision making (sets keys)
          updateCPUAI(cpuPlayer, humanPlayer, room, currentTime);
          
          // Process the CPU's inputs (converts keys to actions)
          const gameHelpers = {
            executeSlapAttack,
            executeChargedAttack,
            canPlayerCharge,
            canPlayerSlap,
            canPlayerUseAction,
            startCharging,
            clearChargeState,
            isPlayerInActiveState,
            setPlayerTimeout,
            rooms,
            io, // Add io for emitting events
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
            Math.round(81 * 0.96) * (opponent.sizeMultiplier || 1); // Scaled +30%
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

      // Check for collision and adjust positions
      // Always enable collision detection during slap attacks to prevent pass-through
      if (
        arePlayersColliding(player1, player2) &&
        // Enable collision if one player is hit (prevents pass-through from knockback)
        (player1.isHit ||
          player2.isHit ||
          // Enable collision during slap attacks to prevent pass-through
          (player1.isAttacking && player1.attackType === "slap") ||
          (player2.isAttacking && player2.attackType === "slap") ||
          // Original collision bypass conditions (only when neither player is hit and not slapping)
          (!(player1.isAttacking && player1.attackType === "charged") &&
            !(player2.isAttacking && player2.attackType === "charged") &&
            !player1.isGrabbing &&
            !player2.isGrabbing &&
            !player1.isBeingGrabbed &&
            !player2.isBeingGrabbed &&
            !player1.isThrowLanded &&
            !player2.isThrowLanded))
      ) {
        adjustPlayerPositions(player1, player2, delta);
      }

      if (
        !player1.isGrabbing &&
        !player1.isBeingGrabbed &&
        !player2.isGrabbing &&
        !player2.isBeingGrabbed &&
        !player1.isThrowing &&
        !player2.isThrowing &&
        !(player1.isHit && player2.isHit) // Only disable if BOTH are hit
      ) {
        // Preserve facing direction during attacks and throws
        // Special case: allow dodging player to update facing even when opponent is attacking
        // This allows dodge-through to work correctly during charged attacks
        if (
          (!player1.isAttacking && !player2.isAttacking && !player1.isDodging && !player2.isDodging) ||
          (player1.isDodging && player2.isAttacking) ||
          (player2.isDodging && player1.isAttacking)
        ) {
          // Only update facing for non-isHit players and those not locked by slap attacks
          // IMPORTANT: Players with atTheRopesFacingDirection set keep their locked facing direction
          if (!player1.isHit && !player2.isHit) {
            // Normal facing logic when both players are not hit
            // Don't update facing if player has locked slap facing direction OR is attacking OR has atTheRopes facing locked
            // Also freeze facing for players in the crossed-through grace period (post-dodge overlap)
            if (!player1.slapFacingDirection && !player1.isAttacking && !player1.atTheRopesFacingDirection && !player1.justCrossedThrough && player1.x < player2.x) {
              player1.facing = -1; // Player 1 faces right
            } else if (
              !player1.slapFacingDirection &&
              !player1.isAttacking &&
              !player1.atTheRopesFacingDirection &&
              !player1.justCrossedThrough &&
              player1.x >= player2.x
            ) {
              player1.facing = 1; // Player 1 faces left
            }

            if (!player2.slapFacingDirection && !player2.isAttacking && !player2.atTheRopesFacingDirection && !player2.justCrossedThrough && player1.x < player2.x) {
              player2.facing = 1; // Player 2 faces left
            } else if (
              !player2.slapFacingDirection &&
              !player2.isAttacking &&
              !player2.atTheRopesFacingDirection &&
              !player2.justCrossedThrough &&
              player1.x >= player2.x
            ) {
              player2.facing = -1; // Player 2 faces right
            }
          } else if (!player1.isHit && player2.isHit) {
            // Only update player1's facing when player2 is hit and player1 doesn't have locked slap facing
            if (!player1.slapFacingDirection && !player1.isAttacking && !player1.atTheRopesFacingDirection && !player1.justCrossedThrough) {
              if (player1.x < player2.x) {
                player1.facing = -1; // Player 1 faces right
              } else {
                player1.facing = 1; // Player 1 faces left
              }
            }
          } else if (player1.isHit && !player2.isHit) {
            // Only update player2's facing when player1 is hit and player2 doesn't have locked slap facing
            if (!player2.slapFacingDirection && !player2.isAttacking && !player2.atTheRopesFacingDirection && !player2.justCrossedThrough) {
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
        const currentTime = Date.now();
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
          const recoveryElapsed = Date.now() - player.recoveryStartTime;

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

            // Only update position if within boundaries
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            } else {
              // Stop at boundary and reset velocity
              player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
              player.movementVelocity = 0;
            }
          }

          // End recovery state after duration
          if (recoveryElapsed >= player.recoveryDuration) {
            player.isRecovering = false;
            player.movementVelocity = 0;
            player.recoveryDirection = null;

            // Check if we should restart charging immediately after recovery ends
            // IMPORTANT: Always enforce 200ms threshold to prevent quick taps from triggering charge
            if (player.mouse1HeldDuringAttack && player.keys.mouse1 && player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200) {
              player.isChargingAttack = true;
              if (player.chargeAttackPower > 0) {
                player.chargeStartTime = Date.now() - (player.chargeAttackPower / 100 * CHARGE_FULL_POWER_MS);
              } else {
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
              }
              player.attackType = "charged";
              player.mouse1HeldDuringAttack = false;
            }
            // Otherwise check normal conditions for restart
            else if (
              player.keys.mouse1 &&
              player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200 &&
              !player.isAttacking &&
              !player.isJumping &&
              !player.isDodging &&
              !player.isThrowing &&
              !player.isBeingThrown &&
              !player.isGrabbing &&
              !player.isBeingGrabbed &&
              !player.isHit &&
              !player.isRawParryStun &&
              !player.isThrowingSnowball &&
              !player.canMoveToReady
            ) {
              player.isChargingAttack = true;
              if (player.chargeAttackPower > 0) {
                player.chargeStartTime = Date.now() - (player.chargeAttackPower / 100 * CHARGE_FULL_POWER_MS);
              } else {
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
              }
              player.attackType = "charged";
            }

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
      if (room.gameOver && player.id === room.loserId && !player.isHit) {
        return;
      }

      // Clear knockback immunity when timer expires
      if (
        player.knockbackImmune &&
        Date.now() >= player.knockbackImmuneEndTime
      ) {
        player.knockbackImmune = false;
      }

      // Smooth grab-break separation tween overrides other movement for its duration
      if (player.isGrabBreakSeparating) {
        const now = Date.now();
        const elapsed = now - (player.grabBreakSepStartTime || now);
        const duration = player.grabBreakSepDuration || 0;
        const startX = player.grabBreakStartX ?? player.x;
        const targetX = player.grabBreakTargetX ?? player.x;
        const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
        // Ease-out cubic for smooth finish
        const eased = 1 - Math.pow(1 - t, 3);
        const newX = startX + (targetX - startX) * eased;

        // For pull reversal, clamp to a margin inside boundaries so they stop before the edge
        const isPullTween = player.isBeingPullReversaled;
        const leftBound = isPullTween ? MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN : MAP_LEFT_BOUNDARY;
        const rightBound = isPullTween ? MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN : MAP_RIGHT_BOUNDARY;
        const clampedX = Math.max(leftBound, Math.min(newX, rightBound));
        player.x = clampedX;
        // During pull reversal, simulate decaying hops (server-driven for reliability)
        // Hops start after a delay so the player slides a bit before bouncing
        if (isPullTween && t < 1) {
          const HOP_DELAY = 0.18; // Don't start hopping until 18% into the tween (~120ms)
          if (t > HOP_DELAY) {
            const HOP_COUNT = 4; // Fewer hops over the remaining time = slower per hop
            const HOP_HEIGHTS = [26, 17, 10, 4]; // Decaying hop heights in pixels
            const hopT = (t - HOP_DELAY) / (1 - HOP_DELAY); // 0-1 within the hop window
            const hopProgress = hopT * HOP_COUNT;
            const hopIndex = Math.min(Math.floor(hopProgress), HOP_COUNT - 1);
            const hopPhase = hopProgress - Math.floor(hopProgress); // 0-1 within each hop
            const maxHeight = HOP_HEIGHTS[hopIndex] || 0;
            // Sine curve for each hop arc (0 → peak → 0)
            const hopY = maxHeight * Math.sin(hopPhase * Math.PI);
            player.y = GROUND_LEVEL + hopY;
          } else {
            player.y = GROUND_LEVEL; // Still on ground during initial slide
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
          if (player.isBeingPullReversaled) {
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
              }
              player.pullReversalPullerId = null;
            }
            // Activate buffered inputs for both players (0 frame advantage)
            activateBufferedInputAfterGrab(player, rooms);
            if (pullerRef) {
              activateBufferedInputAfterGrab(pullerRef, rooms);
            }
          }
          if (player.isGrabBreaking) player.isGrabBreaking = false;
          if (player.isGrabBreakCountered) player.isGrabBreakCountered = false;

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
        // SAFETY: Maximum isHit duration to prevent stuck states (1 second max)
        const MAX_HIT_DURATION = 1000;
        const hitDuration = player.lastHitTime ? Date.now() - player.lastHitTime : 0;
        if (hitDuration > MAX_HIT_DURATION) {
          player.isHit = false;
          player.isAlreadyHit = false;
          player.isSlapKnockback = false;
          player.isParryKnockback = false;
          player.knockbackVelocity.x = 0;
          player.movementVelocity = 0;
          // Don't return - continue normal processing
        } else {
          // Apply immediate knockback without boundary check
          player.x =
            player.x + player.knockbackVelocity.x * delta * speedFactor;

          // Check if player crossed the dohyo boundary - trigger fast heavy fall
          const isOutsideDohyo = player.x < DOHYO_LEFT_BOUNDARY || player.x > DOHYO_RIGHT_BOUNDARY;
          
          // Check if player is past map boundaries (for reduced friction after ring-out)
          const isPastMapBoundaries = player.x < MAP_LEFT_BOUNDARY || player.x > MAP_RIGHT_BOUNDARY;
          
          // Cinematic kill victims stay at ground level — no dohyo fall
          if (isOutsideDohyo && !player.isFallingOffDohyo && !player.isCinematicKillVictim) {
            player.isFallingOffDohyo = true;
          }

          // Check if this is the loser after game over (for special handling)
          const isLoserAfterGameOver = room.gameOver && player.id === room.loserId;
          
          // Fast, heavy fall physics - straight down while maintaining horizontal speed
          if (player.isFallingOffDohyo) {
            // Fast downward movement (no arc, just straight down)
            const targetY = GROUND_LEVEL - DOHYO_FALL_DEPTH;
            // If game is over, snap immediately to target Y (no gradual fall)
            if (isLoserAfterGameOver) {
              if (player.y !== targetY) {
                player.y = targetY; // Only set if different to avoid unnecessary updates
              }
            } else if (player.y > targetY) {
              player.y = Math.max(targetY, player.y - DOHYO_FALL_SPEED);
            }
            
            // Maintain horizontal momentum with very slight friction (0.98 = minimal resistance)
            player.knockbackVelocity.x *= DOHYO_FALL_HORIZONTAL_RETENTION;
            player.movementVelocity *= DOHYO_FALL_HORIZONTAL_RETENTION;
          } else if (isLoserAfterGameOver && isPastMapBoundaries) {
            // LOSER PAST MAP BOUNDARIES BUT NOT YET PAST DOHYO:
            // Apply same minimal friction as dohyo fall (0.98) - feels smooth, not jarring
            player.knockbackVelocity.x *= DOHYO_FALL_HORIZONTAL_RETENTION;
            player.movementVelocity *= DOHYO_FALL_HORIZONTAL_RETENTION;
          } else {
            // ICE PHYSICS: Getting hit on ice = SLIDING, not resistance!
            // The ice makes knockback LONGER, not shorter
            // Use very low friction - players slide when hit
            
            // DI (Directional Influence): Holding the opposite direction reduces knockback!
            // This rewards skilled players who react quickly to hits
            const knockbackDirection = player.knockbackVelocity.x > 0 ? 1 : -1; // 1 = right, -1 = left
            const isHoldingOpposite = (knockbackDirection > 0 && player.keys.a && !player.keys.d) || 
                                      (knockbackDirection < 0 && player.keys.d && !player.keys.a);
            
            // DI friction multiplier - holding opposite direction adds significant friction
            const DI_FRICTION_BONUS = 0.96; // Extra friction when holding opposite direction
            
            if (player.isSlapKnockback) {
              player.knockbackVelocity.x *= 0.992; // Slap hits slide far on ice
              if (isHoldingOpposite) {
                player.knockbackVelocity.x *= DI_FRICTION_BONUS; // DI reduces slap knockback
              }
            } else {
              player.knockbackVelocity.x *= 0.985; // Charged hits slide even further
              if (isHoldingOpposite) {
                player.knockbackVelocity.x *= DI_FRICTION_BONUS; // DI reduces charged knockback
              }
            }
            
            // Transfer knockback into movement velocity for continued sliding
            // This creates the "hit and slide on ice" effect
            if (Math.abs(player.knockbackVelocity.x) > 0.1) {
              player.movementVelocity = player.knockbackVelocity.x * 0.8;
            }
          }

          // Apply ice sliding physics to movement velocity
          if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
            // ICE PHYSICS: Very low friction when hit - they're sliding on ice!
            // For loser after game over, use same minimal friction as dohyo fall
            if (isLoserAfterGameOver && isPastMapBoundaries) {
              player.movementVelocity *= DOHYO_FALL_HORIZONTAL_RETENTION;
            } else {
              player.movementVelocity *= 0.996;
            }

            // Calculate new position with sliding
            player.x = player.x + delta * speedFactor * player.movementVelocity;
          }

          // Parry knockback cannot push past map boundaries (no ring-out from parry)
          if (player.isParryKnockback) {
            const PARRY_BOUNDARY_BUFFER = 10;
            const clampedX = Math.max(
              MAP_LEFT_BOUNDARY + PARRY_BOUNDARY_BUFFER,
              Math.min(player.x, MAP_RIGHT_BOUNDARY - PARRY_BOUNDARY_BUFFER)
            );
            if (clampedX !== player.x) {
              player.x = clampedX;
              player.knockbackVelocity.x = 0;
              player.movementVelocity = 0;
            }
          }

          // Reset hit state when both knockback and sliding are nearly complete
          // But KEEP isHit true if game is over and player is the loser (so knockback continues)
          const hitMovementThreshold = player.isSlapKnockback
            ? MIN_MOVEMENT_THRESHOLD * 0.3 // Much smaller threshold for slap attacks (longer slides)
            : MIN_MOVEMENT_THRESHOLD; // Normal threshold for charged attacks

          if (
            Math.abs(player.knockbackVelocity.x) < 0.1 &&
            Math.abs(player.movementVelocity) < hitMovementThreshold
          ) {
            player.knockbackVelocity.x = 0;
            player.movementVelocity = 0;
            
            // Only clear isHit if game is NOT over, or if player is NOT the loser
            // This keeps the loser sliding after ring-out instead of freezing
            if (!(room.gameOver && player.id === room.loserId)) {
              player.isHit = false;
              player.isAlreadyHit = false; // Also clear isAlreadyHit to ensure player can be hit again
              player.isSlapKnockback = false; // Reset slap knockback flag
              player.isParryKnockback = false;
            }
            
            // If player was at the ropes and is now back within ring boundaries,
            // clear the locked facing direction so they can face normally again
            if (player.atTheRopesFacingDirection !== null) {
              const isWithinBoundaries = player.x > MAP_LEFT_BOUNDARY && player.x < MAP_RIGHT_BOUNDARY;
              if (isWithinBoundaries) {
                player.atTheRopesFacingDirection = null;
                player.isAtTheRopes = false;
                player.atTheRopesStartTime = 0;
              }
              // If still outside boundaries, keep the facing locked until round reset
            }
          }
        }
      }

      // Handle slap parry knockback (smooth sliding that doesn't interrupt attack state)
      if (Math.abs(player.slapParryKnockbackVelocity) > 0.01) {
        // Apply knockback movement
        const newX = player.x + player.slapParryKnockbackVelocity * delta * speedFactor;
        
        // Constrain to map boundaries with buffer (prevents triggering win condition)
        const BOUNDARY_BUFFER = 10;
        player.x = Math.max(
          MAP_LEFT_BOUNDARY + BOUNDARY_BUFFER,
          Math.min(newX, MAP_RIGHT_BOUNDARY - BOUNDARY_BUFFER)
        );
        
        // Apply friction for smooth deceleration
        player.slapParryKnockbackVelocity *= 0.92;
        
        // Clear when velocity is negligible
        if (Math.abs(player.slapParryKnockbackVelocity) < 0.01) {
          player.slapParryKnockbackVelocity = 0;
        }
      }

      // Handle grab startup — lunge forward during startup, then range check at the end.
      if (player.isGrabStartup) {
        const elapsed = Date.now() - player.grabStartupStartTime;
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

          if (opponent && isOpponentCloseEnoughForGrab(player, opponent) && isOpponentInFrontOfGrabber(player, opponent)) {
            // === TECH CHECK: opponent also in grab startup → both tech ===
            // Whiffing players CANNOT tech — they are fully vulnerable.
            // Also check if opponent's startup has already expired AND their grab
            // would NOT have connected (out of range or facing wrong way).
            // This prevents tick processing order from causing false techs.
            const opponentWouldWhiff = opponent.isGrabStartup &&
              (Date.now() - opponent.grabStartupStartTime) >= (opponent.grabStartupDuration || GRAB_STARTUP_DURATION_MS) &&
              !(isOpponentCloseEnoughForGrab(opponent, player) && isOpponentInFrontOfGrabber(opponent, player));
            if ((opponent.isGrabStartup || opponent.isGrabTeching) &&
                !opponent.isWhiffingGrab && !opponent.isGrabWhiffRecovery &&
                !opponentWouldWhiff) {
              executeGrabTech(player, opponent, room, io, triggerHitstop);
              return;
            }

            // === GRAB CHECK: opponent is in range and grabbable ===
            // First-to-active wins: when opponent is slapping, timing determines winner
            const opponentGrabbableNeutral =
              !opponent.isBeingThrown &&
              !opponent.isBeingGrabbed &&
              !player.isBeingGrabbed &&
              !player.throwTechCooldown &&
              !opponent.isDodging;
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
              player.grabStartTime = Date.now();
              player.grabbedOpponent = opponent.id;

              // IMMEDIATE PUSH
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
                  counterId: `counter-grab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                });
              }

              player.isRawParrySuccess = false;
              player.isPerfectRawParrySuccess = false;

              clearAllActionStates(opponent);
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
        handleWinCondition(room, player, winner, io);
        // Don't reset knockback velocity for the loser
        player.knockbackVelocity = { ...player.knockbackVelocity };
        
        // Emit ring-out event for dramatic effect
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
          handleWinCondition(room, player, winner, io);
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
        Date.now() - room.gameOverTime >= 3000 &&
        !room.matchOver
      ) {
        // 5 seconds
        resetRoomAndPlayers(room, io);
      }

      // Stamina regen (freeze stamina once round is over)
      // Don't regen while being grabbed or gassed
      if (player.stamina < 100 && !room.gameOver && !player.isBeingGrabbed && !player.isGassed) {
        if (staminaRegenCounter >= STAMINA_REGEN_INTERVAL_MS) {
          player.stamina += STAMINA_REGEN_AMOUNT;
          player.stamina = Math.min(player.stamina, 100);
        }
      }

      // if (player.isHit) return;

      if (
        !player.isRingOutFreezeActive &&
        player.isThrowing &&
        player.throwOpponent
      ) {
        const currentTime = Date.now();
        const throwDuration = currentTime - player.throwStartTime;
        const throwProgress =
          throwDuration / (player.throwEndTime - player.throwStartTime);

        const opponent = room.players.find(
          (p) => p.id === player.throwOpponent
        );
        if (opponent) {
          // Match dodge-style arc for cutscene: peak ~75 with same parabola scale used in dodge (3.2 * height * t * (1-t))
          const throwArcHeight = player.isRingOutThrowCutscene ? 75 : 450;
          let armsReachDistance = -100;

          if (!player.throwingFacingDirection) {
            player.throwingFacingDirection = player.facing;
            opponent.beingThrownFacingDirection = opponent.facing;
            // For ring-out cutscene, keep the current separation; otherwise, snap to arms reach
            if (!player.isRingOutThrowCutscene) {
              opponent.x =
                player.x + player.throwingFacingDirection * armsReachDistance;
            }
            opponent.y = GROUND_LEVEL;
          }

          // Don't overwrite facing during ring-out cutscene (it's already set correctly for animation)
          if (!player.isRingOutThrowCutscene) {
            player.facing = player.throwingFacingDirection;
          }
          opponent.facing = opponent.beingThrownFacingDirection;

          // Calculate new position with size power-up consideration
          const sizeOffset = 0;

          // Preserve grab separation at the start of a ring-out cutscene throw
          if (player.isRingOutThrowCutscene) {
            const throwingDir = player.throwingFacingDirection || 1;
            const currentSeparation = opponent.x - player.x;
            armsReachDistance = currentSeparation * throwingDir;
          }

          // For cutscene: travel a small extra distance OUTWARD from current separation
          // This avoids pulling the opponent back into the player when the separation is already larger than the small target
          let throwDistance;
          if (player.isRingOutThrowCutscene) {
            const extraOutward = player.ringOutThrowDistance || 4; // treat as extra outward distance
            throwDistance = armsReachDistance + Math.max(extraOutward, 0);
          } else {
            throwDistance = 120;
          }

          const newX =
            player.x +
            player.throwingFacingDirection *
              (armsReachDistance +
                (throwDistance - armsReachDistance) * throwProgress);

          // Always update position during throw - let throws complete their full arc
          opponent.x = newX;

          // Use a consistent inverted-U arc for cutscene
          if (player.isRingOutThrowCutscene) {
            const arcProgress = 4 * throwProgress * (1 - throwProgress); // perfect inverted-U from 0..1..0
            const hopHeight = arcProgress * 60; // modest peak
            opponent.y = GROUND_LEVEL + hopHeight;
          } else {
            opponent.y =
              GROUND_LEVEL +
              3.2 * throwArcHeight * throwProgress * (1 - throwProgress);
          }

          // Check if throw is complete
          if (currentTime >= player.throwEndTime) {
            // Check for win condition at the end of throw
            if (!player.isRingOutThrowCutscene) {
              if (
                (opponent.x >= MAP_RIGHT_BOUNDARY &&
                  player.throwingFacingDirection === 1) ||
                (opponent.x <= MAP_LEFT_BOUNDARY &&
                  player.throwingFacingDirection === -1)
              ) {
                handleWinCondition(room, opponent, player, io);
              } else {
                // Emit screen shake for landing after throw (throttled)
                emitThrottledScreenShake(room, io, {
                  intensity: 0.6,
                  duration: 200,
                });
                // SMASH-STYLE: Hitstop when throw lands for impact
                triggerHitstop(room, HITSTOP_THROW_MS);
              }
            }

            // Ensure landing at ground level, then reset throw-related states for both players
            player.isThrowing = false;
            player.throwOpponent = null;
            player.throwingFacingDirection = null;
            player.throwStartTime = 0;
            player.throwEndTime = 0;
            // Clear ring-out cutscene flags
            player.isRingOutThrowCutscene = false;
            player.ringOutThrowDistance = 0;

            // Check if player landed outside ring-out boundaries
            const landedOutsideBoundaries =
              opponent.x <= MAP_LEFT_BOUNDARY ||
              opponent.x >= MAP_RIGHT_BOUNDARY;

            opponent.isBeingThrown = false;
            opponent.beingThrownFacingDirection = null;
            opponent.isHit = false;
            opponent.isAlreadyHit = false; // Ensure player can be hit again after landing
            opponent.isSlapKnockback = false;
            
            // Set Y to correct ground level based on whether they landed outside the dohyo
            const landedOutsideDohyo = opponent.x <= DOHYO_LEFT_BOUNDARY || opponent.x >= DOHYO_RIGHT_BOUNDARY;
            if (landedOutsideDohyo) {
              opponent.y = GROUND_LEVEL - DOHYO_FALL_DEPTH; // Fallen ground level
              opponent.isFallingOffDohyo = true; // Mark as having fallen off
            } else {
              opponent.y = GROUND_LEVEL; // Normal ground level
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
        const currentTime = Date.now();
        const throwDuration = currentTime - player.throwStartTime;
        const throwProgress =
          throwDuration / (player.throwEndTime - player.throwStartTime);

        if (currentTime >= player.throwEndTime) {
          player.isThrowing = false;

          // Check if we should restart charging after missed throw completes
          if (shouldRestartCharging(player)) {
            // Restart charging immediately
            startCharging(player);
          }
        }
      }

      // Throw tech
      if (player.isThrowTeching) {
        const currentTime = Date.now();
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
      // Dodging - Revolutionary physics: "snap up, hang, slam down" like Celeste/Hollow Knight
      // CRITICAL: Never process dodge movement if player is being grabbed
      if (player.isDodging && player.isBeingGrabbed) {
        // Safety clear - if somehow both states are true, force clear dodge
        player.isDodging = false;
        player.isDodgeCancelling = false;
        player.dodgeDirection = null;
        player.y = GROUND_LEVEL;
      }
      if (player.isDodging && !player.isBeingGrabbed) {
        // Use fixed dodge speed - no momentum-based variations
        let currentDodgeSpeed = speedFactor * DODGE_BASE_SPEED;

        // Apply speed power-up to dodge with moderate multiplier
        if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
          currentDodgeSpeed *= Math.min(player.powerUpMultiplier * 0.85, 1.5);
        }

        // Check for dodge cancel (holding 's' key) - FAST SLAM DOWN
        if (player.keys.s && !player.isDodgeCancelling && player.y > GROUND_LEVEL) {
          player.isDodgeCancelling = true;
          player.dodgeCancelStartTime = Date.now();
          player.dodgeCancelStartY = player.y;
          player.dodgeCancelVelocity = 0; // For accelerating fall
        }

        // Handle dodge cancel - PUNCHY slam down with acceleration
        if (player.isDodgeCancelling) {
          const cancelProgress = Math.min(
            (Date.now() - player.dodgeCancelStartTime) / DODGE_CANCEL_DURATION,
            1
          );
          
          // Use easeInQuad for accelerating slam: t^2 (starts slow, accelerates into ground)
          // Then easeOutBack for slight bounce feel at the end
          let easedProgress;
          if (cancelProgress < 0.7) {
            // Accelerating fall (easeInQuad)
            const t = cancelProgress / 0.7;
            easedProgress = t * t * 0.85;
          } else {
            // Quick settle with slight overshoot (easeOutBack feel)
            const t = (cancelProgress - 0.7) / 0.3;
            easedProgress = 0.85 + t * 0.15 * (1 + 0.3 * (1 - t));
          }
          
          // Interpolate from cancel start Y to ground level
          player.y = player.dodgeCancelStartY - (player.dodgeCancelStartY - GROUND_LEVEL) * Math.min(easedProgress, 1);
          
          // Minimal horizontal movement during cancel - commitment to the slam
          const newX = player.x + player.dodgeDirection * delta * currentDodgeSpeed * DODGE_CANCEL_SPEED_MULT;
          
          // Calculate effective boundary based on player size
          const sizeOffset = 0;
          const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;
          
          if (newX >= leftBoundary && newX <= rightBoundary) {
            player.x = newX;
          }
          
          // End dodge when cancel animation completes
          if (cancelProgress >= 1) {
            player.isDodging = false;
            player.isDodgeCancelling = false;
            const landingDirection = player.dodgeDirection || 0;
            player.dodgeDirection = null;
            player.y = GROUND_LEVEL;
            
            // Immediately update facing direction on dodge landing
            // This prevents wrong-way attacks when dodge-through switches sides
            const dodgeCancelOpponent = room.players.find(p => p.id !== player.id);
            if (dodgeCancelOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
              player.facing = player.x < dodgeCancelOpponent.x ? -1 : 1;
            }
            
            // Set crossed-through grace period if overlapping with opponent after dodge
            if (dodgeCancelOpponent) {
              const overlapDistance = Math.abs(player.x - dodgeCancelOpponent.x);
              const bodyHitboxSize = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, dodgeCancelOpponent.sizeMultiplier || 1);
              if (overlapDistance < bodyHitboxSize) {
                player.justCrossedThrough = true;
                player.crossedThroughTime = Date.now();
              }
            }
            
            // ICE PHYSICS: Dodge landing = sliding on ice!
            if ((player.keys.c || player.keys.control) && room.gameStart && !room.gameOver && !room.matchOver) {
              // Holding C = STRONG power slide from dodge
              player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
              player.isPowerSliding = true;
            } else {
              // Normal landing = still slides, just less
              player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM;
            }
            
            player.isBraking = false;
            player.isStrafing = false;
            
            // Mark landing for visual effects
            player.justLandedFromDodge = true;
            player.dodgeLandTime = Date.now();
            // Emit screen shake for dodge cancel slam (gentler than before)
            emitThrottledScreenShake(room, io, {
              intensity: 1.2,
              duration: 70,
            });
          }
        } else {
          // Normal dodge movement (not cancelling)
          // Smooth sine-based arc for natural, graceful motion
          
          const elapsed = Date.now() - player.dodgeStartTime;
          const totalDuration = player.dodgeEndTime - player.dodgeStartTime;
          const dodgeProgress = Math.min(elapsed / totalDuration, 1);

          // Smooth sine arc - natural parabolic feel
          // sin(0 to PI) creates perfect 0 -> 1 -> 0 curve
          const arcProgress = Math.sin(dodgeProgress * Math.PI);
          
          // Add slight ease-out on the rise and ease-in on the fall for weight
          // This makes the penguin feel heavy at the top of the arc
          let weightedArc;
          if (dodgeProgress < 0.5) {
            // Rising: ease-out cubic for snappy start
            const riseT = dodgeProgress * 2; // 0 to 1 for first half
            const easeOut = 1 - Math.pow(1 - riseT, 2.5);
            weightedArc = easeOut * arcProgress / Math.sin(riseT * Math.PI / 2 + 0.001);
            weightedArc = Math.min(weightedArc, 1) * arcProgress;
          } else {
            // Falling: ease-in for weighted drop
            const fallT = (dodgeProgress - 0.5) * 2; // 0 to 1 for second half
            const easeIn = Math.pow(fallT, 1.8);
            weightedArc = arcProgress * (1 - easeIn * 0.15);
          }
          
          // Blend between pure sine and weighted version for smoothness
          const blendedArc = arcProgress * 0.7 + weightedArc * 0.3;
          const hopHeight = blendedArc * DODGE_HOP_HEIGHT;

          // Smooth speed curve - slightly faster at start and end, slower at apex
          const speedMultiplier = 0.92 + Math.cos(dodgeProgress * Math.PI) * 0.08;

          const adjustedSpeed = currentDodgeSpeed * speedMultiplier;

          // Calculate new position - uses fixed speed, not affected by prior momentum
          const newX = player.x + player.dodgeDirection * delta * adjustedSpeed;
          const newY = GROUND_LEVEL + hopHeight;

          // Calculate effective boundary based on player size
          const sizeOffset = 0;
          const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

          // Only update position if within boundaries
          if (newX >= leftBoundary && newX <= rightBoundary) {
            player.x = newX;
            player.y = newY;
          } else {
            // Still update Y position even if hitting boundary
            player.y = newY;
          }

          if (Date.now() >= player.dodgeEndTime) {
            // ICE PHYSICS: Dodge landing = sliding on ice!
            const landingDirection = player.dodgeDirection || 0;
            
            player.isDodging = false;
            player.isDodgeCancelling = false;
            player.dodgeDirection = null;
            player.y = GROUND_LEVEL;
            player.isStrafing = false;
            player.isBraking = false;
            
            // Immediately update facing direction on dodge landing
            // This prevents wrong-way attacks when dodge-through switches sides
            const dodgeLandOpponent = room.players.find(p => p.id !== player.id);
            if (dodgeLandOpponent && !player.atTheRopesFacingDirection && !player.slapFacingDirection) {
              player.facing = player.x < dodgeLandOpponent.x ? -1 : 1;
            }
            
            // Set crossed-through grace period if overlapping with opponent after dodge
            if (dodgeLandOpponent) {
              const overlapDistance = Math.abs(player.x - dodgeLandOpponent.x);
              const bodyHitboxSize = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, dodgeLandOpponent.sizeMultiplier || 1);
              if (overlapDistance < bodyHitboxSize) {
                player.justCrossedThrough = true;
                player.crossedThroughTime = Date.now();
              }
            }
            
            if ((player.keys.c || player.keys.control) && room.gameStart && !room.gameOver && !room.matchOver) {
              // Holding C/CTRL = STRONG power slide from dodge
              player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM * DODGE_POWERSLIDE_BOOST;
              player.isPowerSliding = true;
            } else {
              // Normal landing = still slides, just less
              player.movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM;
            }
            
            // Direction keys can influence landing momentum slightly
            if (player.keys.a && !player.keys.d) {
              player.movementVelocity -= 0.2;
            } else if (player.keys.d && !player.keys.a) {
              player.movementVelocity += 0.2;
            }
            
            // Mark landing for visual effects
            player.justLandedFromDodge = true;
            player.dodgeLandTime = Date.now();
          }
        }
      }

      // Clear crossed-through grace period
      if (player.justCrossedThrough && player.crossedThroughTime) {
        if (Date.now() - player.crossedThroughTime > DODGE_CROSSED_THROUGH_GRACE) {
          player.justCrossedThrough = false;
          player.crossedThroughTime = 0;
        }
      }

      // Clear dodge landing flag after animation duration (200ms)
      if (player.justLandedFromDodge && player.dodgeLandTime) {
        if (Date.now() - player.dodgeLandTime > 200) {
          player.justLandedFromDodge = false;
        }
      }
      
      // POWER SLIDE FROM DODGE: If just landed and holding C/CTRL, ensure power slide is active
      // This handles the immediate frame after dodge landing
      if (player.justLandedFromDodge && (player.keys.c || player.keys.control) && Math.abs(player.movementVelocity) > SLIDE_MAINTAIN_VELOCITY && room.gameStart && !room.gameOver && !room.matchOver) {
        player.isPowerSliding = true;
      }

      // Grab Movement
      if (player.isGrabbingMovement) {
        const currentTime = Date.now();
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
          player.grabStartTime = Date.now();
          player.grabbedOpponent = opponent.id;

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
              counterId: `counter-grab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            });
          }
          
          // Clear parry success state when starting a grab
          player.isRawParrySuccess = false;
          player.isPerfectRawParrySuccess = false;
          
          // CRITICAL: Clear ALL action states when being grabbed
          clearAllActionStates(opponent);
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
        ((!player.keys[" "] &&
          !(player.isAttacking && player.attackType === "charged") && // Block only during charged attack execution
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
          // NOTE: isChargingAttack is NOT blocked - can power slide while charging!
          // This allows fluid movement during charge windup
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
          const strafeDuration = player.strafeStartTime > 0 ? Date.now() - player.strafeStartTime : 0;
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
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
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
          if (newX <= rightBoundary || player.isThrowLanded) {
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
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking &&
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
          if (newX >= leftBoundary || player.isThrowLanded) {
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
          !player.isThrowing &&
          !player.isGrabbing &&
          !player.isGrabbingMovement &&
          !player.isWhiffingGrab &&
          !player.isAttacking && // Block during any attack (slap or charged)
          !player.isRecovering &&
          !player.isRawParryStun &&
          !player.isRawParrying &&
          !player.isPerfectRawParrySuccess && // Block during perfect parry animation
          !player.isGrabBreaking && // Block during grab break animation
          !player.isGrabBreakCountered && // Block during grab break countered state
          !player.isGrabBreakSeparating && // Block during grab break separation
          !player.isThrowingSnowball &&
          !player.isSpawningPumoArmy &&
          !player.hasPendingSlapAttack && // Block strafing when buffered slap attack is pending
          !(
            player.slapStrafeCooldown &&
            Date.now() < player.slapStrafeCooldownEndTime
          ) && // Block strafing during post-slap cooldown
          !player.isAtTheRopes && // Block strafing while at the ropes
          !player.isPowerSliding && // Power sliding uses its own physics - no strafing
          !(player.inputLockUntil && Date.now() < player.inputLockUntil) // Block during input freeze (e.g. pull reversal)
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
            if (!player.strafeStartTime) player.strafeStartTime = Date.now();
          } else {
            // ACCELERATING: Already moving right, build more speed
            player.movementVelocity = Math.min(
              player.movementVelocity + ICE_ACCELERATION,
              ICE_MAX_SPEED
            );
            player.isBraking = false;
            player.isStrafing = true;
            // Start tracking strafe time if not already (e.g., coasting from dodge)
            if (!player.strafeStartTime) player.strafeStartTime = Date.now();
          }

          // Calculate new position and check boundaries
          const newX =
            player.x + delta * currentSpeedFactor * player.movementVelocity;
          if (newX <= rightBoundary || player.isThrowLanded) {
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
          !player.hasPendingSlapAttack &&
          !(
            player.slapStrafeCooldown &&
            Date.now() < player.slapStrafeCooldownEndTime
          ) &&
          !player.isAtTheRopes &&
          !player.isPowerSliding && // Power sliding uses its own physics - no strafing
          !(player.inputLockUntil && Date.now() < player.inputLockUntil) // Block during input freeze (e.g. pull reversal)
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
            if (!player.strafeStartTime) player.strafeStartTime = Date.now();
          } else {
            // ACCELERATING: Already moving left, build more speed
            player.movementVelocity = Math.max(
              player.movementVelocity - ICE_ACCELERATION,
              -ICE_MAX_SPEED
            );
            player.isBraking = false;
            player.isStrafing = true;
            // Start tracking strafe time if not already (e.g., coasting from dodge)
            if (!player.strafeStartTime) player.strafeStartTime = Date.now();
          }

          // Calculate new position and check boundaries
          const newX =
            player.x + delta * currentSpeedFactor * player.movementVelocity;
          if (newX >= leftBoundary || player.isThrowLanded) {
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
            
            // Visual states
            player.isBraking = isActiveBraking;
            player.isStrafing = false;
            
            // Calculate position with slide speed
            const newX = player.x + delta * currentSpeedFactor * player.movementVelocity;
            
            // Apply position - slides can go off the edge!
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            } else if (!player.isHit && !player.isThrowLanded) {
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
            
            // Get appropriate friction
            const friction = getIceFriction(player, isActiveBraking, nearEdge, edgeProximity);
            
            // Apply friction to velocity
            player.movementVelocity *= friction;
            
            // Set braking state for visual feedback
            player.isBraking = isActiveBraking;
            player.isStrafing = false;

            // Calculate new position
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

            // Apply position with boundary checks
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            } else if (!player.isHit && !player.isThrowLanded) {
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

        // Update strafing state
        if (
          (!player.keys.a &&
            !player.keys.d &&
            (!player.canMoveToReady || room.gameStart)) ||
          player.isAttacking || // Clear strafing during any attack (slap or charged)
          player.hasPendingSlapAttack || // Clear strafing when buffered slap attack is pending
          (player.slapStrafeCooldown &&
            Date.now() < player.slapStrafeCooldownEndTime) // Clear strafing during post-slap cooldown
        ) {
          player.isStrafing = false;
        }

        // Update crouch strafing state
        if (
          !player.isCrouchStance ||
          (!player.keys.a && !player.keys.d) ||
          player.keys.mouse1 ||
          player.isAttacking ||
          player.hasPendingSlapAttack ||
          (player.slapStrafeCooldown &&
            Date.now() < player.slapStrafeCooldownEndTime) ||
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
          player.hasPendingSlapAttack || // Clear strafing when buffered slap attack is pending
          (player.slapStrafeCooldown &&
            Date.now() < player.slapStrafeCooldownEndTime) || // Clear strafing during post-slap cooldown
          player.isHit || // Add isHit to force clear strafing when parried
          player.isRawParrying || // Add isRawParrying to force clear strafing during raw parry
          player.isAtTheRopes // Block strafing while at the ropes
        ) {
          player.isStrafing = false;
          // Don't immediately stop on ice unless hit
          if (!player.isHit) {
            player.movementVelocity *= MOVEMENT_FRICTION;
          }
          // Also clear grab walking if no movement conditions are met
          if (!player.keys.a && !player.keys.d) {
            player.isGrabWalking = false;
          }
        }

        // Keep player from going below ground level
        if (player.y > GROUND_LEVEL) {
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
        player.hasPendingSlapAttack || // Clear strafing when buffered slap attack is pending
        (player.slapStrafeCooldown &&
          Date.now() < player.slapStrafeCooldownEndTime) || // Clear strafing during post-slap cooldown
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
        !player.isAtTheRopes
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
        !player.isDodging && // Block raw parry during dodge - don't interrupt dodge hop
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
          player.rawParryStartTime = Date.now();
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
          // Clear buffered slap attack when starting raw parry
          player.hasPendingSlapAttack = false;
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
        player.isAttacking = false;
        player.isJumping = false;
        // Force clear crouch states during raw parry to prevent concurrent use
        player.isCrouchStance = false;
        player.isCrouchStrafing = false;

        const parryDuration = Date.now() - player.rawParryStartTime;

        // Check if minimum duration has been met (whiffed parries use full commitment)
        if (parryDuration >= RAW_PARRY_MIN_DURATION) {
          player.rawParryMinDurationMet = true;
        }

        // Only end parry if spacebar is released AND minimum duration is met
        // Don't end parry if in perfect parry animation lock
        if (!player.keys[" "] && player.rawParryMinDurationMet && !player.isPerfectRawParrySuccess) {
          player.isRawParrying = false;
          player.rawParryStartTime = 0;
          player.rawParryMinDurationMet = false;
          player.isRawParrySuccess = false;
          // Space released - clear grab-break consumption so future parries can occur
          player.grabBreakSpaceConsumed = false;

          // Check if we should restart charging after raw parry ends
          if (
            player.keys.mouse1 &&
            player.mouse1PressTime > 0 && (Date.now() - player.mouse1PressTime) >= 200 &&
            !player.isAttacking &&
            !player.isJumping &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isBeingThrown &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isHit &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isThrowingSnowball &&
            !player.canMoveToReady
          ) {
            player.isChargingAttack = true;
            if (player.chargeAttackPower > 0) {
              player.chargeStartTime = Date.now() - (player.chargeAttackPower / 100 * CHARGE_FULL_POWER_MS);
            } else {
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
            }
            player.attackType = "charged";
          }
        }
      }

      if (
        player.isAttacking &&
        player.attackType === "charged" &&
        !player.isAtTheRopes
      ) {
        // Only move in the direction the player is facing, but not if at the ropes
        const attackDirection = player.facing === 1 ? -1 : 1;
        const newX = player.x + attackDirection * delta * speedFactor * 2.5;

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
          
          // Set at the ropes state
          player.isAtTheRopes = true;
          player.atTheRopesStartTime = Date.now();
          
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
            if (opponent && !opponent.isDodging) {
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

        if (Date.now() >= player.attackEndTime) {
          // Use helper function to safely end charged attacks
          safelyEndChargedAttack(player, rooms);
        }
      } else if (
        player.isAttacking &&
        player.attackType === "charged" &&
        player.isAtTheRopes
      ) {
        // If at the ropes, still check for attack end time but don't move
        if (Date.now() >= player.attackEndTime) {
          // Use helper function to safely end charged attacks
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
        const chargeDuration = Date.now() - player.chargeStartTime;
        player.chargeAttackPower = Math.min(
          (chargeDuration / CHARGE_FULL_POWER_MS) * 100,
          100
        );
      }

      // TACHIAI CHARGING: Allow charging during the walk-to-ready and ready phases
      // (after power-up pick, before hakkiyoi). Players hold mouse1 to build charge
      // for a powered tachiai at round start.
      if (
        !room.gameStart &&
        !player.isChargingAttack &&
        player.keys && player.keys.mouse1 &&
        player.mouse1PressTime > 0 &&
        (Date.now() - player.mouse1PressTime) >= 200 &&
        !player.isThrowingSalt
      ) {
        startCharging(player);
      }

      // INPUT BUFFERING: Apply buffered mouse1 when game starts.
      // Skip if player is already charging from pre-round (tachiai charge).
      if (room.gameStart && player.mouse1BufferedBeforeStart) {
        if (!player.isChargingAttack) {
          player.keys.mouse1 = true;
          player.mouse1PressTime = Date.now();
        }
        player.mouse1BufferedBeforeStart = false;
      }

      // CONTINUOUS MOUSE1 CHECK: Auto-start charging when mouse1 is held and player is idle
      if (
        room.gameStart &&
        player.keys.mouse1 &&
        player.mouse1PressTime > 0 &&
        (Date.now() - player.mouse1PressTime) >= 150 &&
        !(player.inputLockUntil && Date.now() < player.inputLockUntil) &&
        canPlayerCharge(player)
      ) {
        startCharging(player);
      }

      // Clear strafing cooldown when it expires
      if (
        player.slapStrafeCooldown &&
        Date.now() >= player.slapStrafeCooldownEndTime
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
        player.gassedUntil = Date.now() + GASSED_DURATION_MS;
        player.stamina = 0;
      }
      if (player.isGassed && Date.now() >= player.gassedUntil) {
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
      Date.now() - room.gameOverTime >= 3000 &&
      !room.matchOver
    ) {
      resetRoomAndPlayers(room, io);
    }

    // PERFORMANCE: Only broadcast every N ticks to reduce network load
    // Game logic runs at 64Hz, broadcasts at 32Hz — client interpolation smooths to 60fps
    if (broadcastTickCounter % BROADCAST_EVERY_N_TICKS === 0) {
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


io.on("connection", (socket) => {
  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  io.emit("rooms", rooms);

  startGameLoop();

  // Register all socket event handlers
  registerSocketHandlers(socket, io, rooms, {
    registerPlayerInMaps,
    unregisterPlayerFromMaps,
  });
});

// Update server listen
server.listen(PORT, () => {
});

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
const e = require("express");
const {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
} = require("./playerCleanup");

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
}));

let index;
let gameLoop = null;
let staminaRegenCounter = 0;
const TICK_RATE = 64;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.25; // Increased from 0.22 for snappier movement
const GROUND_LEVEL = 200;
const HITBOX_DISTANCE_VALUE = 85; // Reduced from 90 by 20%
const SLAP_HITBOX_DISTANCE_VALUE = 184; // Updated to match GRAB_RANGE
const SLAP_PARRY_WINDOW = 150; // 150ms window for parry
const SLAP_PARRY_KNOCKBACK_VELOCITY = 1.5; // Reduced knockback for parried attacks
const THROW_RANGE = 184; // Reduced from 230 by 20%
const GRAB_RANGE = 184; // Reduced from 230 by 20%
const GRAB_PUSH_SPEED = 0.3; // Increased from 0.2 for more substantial movement
const GRAB_PUSH_DURATION = 650;

// Add size power-up boundary multipliers
const SIZE_POWERUP_LEFT_MULTIPLIER = 1.1; // Reduced left side by 20%
const SIZE_POWERUP_RIGHT_MULTIPLIER = 1.1; // Increased right side by 20%

// Add power-up types
const POWER_UP_TYPES = {
  SPEED: "speed",
  POWER: "power",
  SIZE: "size",
};

// Add power-up effects
const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.4, // 20% speed increase
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase
  [POWER_UP_TYPES.SIZE]: 1.15, // 15% size increase
};

const GRAB_DURATION = 1500; // 1.5 seconds total grab duration
const GRAB_ATTEMPT_DURATION = 1000; // 1 second for attempt animation

// Map boundary constants
const MAP_LEFT_BOUNDARY = 80;
const MAP_RING_OUT_LEFT = 70;

const MAP_RIGHT_BOUNDARY = 965;
const MAP_RING_OUT_RIGHT = 973;

// Add movement constants
const MOVEMENT_ACCELERATION = 0.08; // Reduced from 0.25 for more slippery feel
const MOVEMENT_DECELERATION = 0.12; // Reduced from 0.35 for longer slides
const MAX_MOVEMENT_SPEED = 1.2; // Slightly increased for better momentum
const MOVEMENT_MOMENTUM = 0.98; // Increased from 0.85 for longer slides
const MOVEMENT_FRICTION = 0.985; // Increased from 0.95 for more ice-like feel
const ICE_DRIFT_FACTOR = 0.92; // New constant for directional drift
const MIN_MOVEMENT_THRESHOLD = 0.01; // New constant for movement cutoff

const RAW_PARRY_KNOCKBACK = 4; // Fixed knockback distance for raw parries
const RAW_PARRY_STUN_DURATION = 1000; // 1 second stun duration
const DODGE_COOLDOWN = 2000; // 2 second cooldown between dodges
const MAX_DODGE_CHARGES = 2; // Maximum number of dodge charges

function resetRoomAndPlayers(room) {
  // Reset room state
  room.gameStart = false;
  room.gameOver = false;
  room.hakkiyoiCount = 0;
  room.gameOverTime = null;
  delete room.winnerId;
  delete room.loserId;

  // Start the 15-second timer for automatic round start
  if (room.roundStartTimer) {
    clearTimeout(room.roundStartTimer);
  }
  room.roundStartTimer = setTimeout(() => {
    if (!room.gameStart && room.players.length === 2) {
      room.gameStart = true;
      room.hakkiyoiCount = 1;
      io.in(room.id).emit("game_start", true);
      room.players.forEach((player) => {
        player.isReady = false;
      });
    }
  }, 15000);

  // Reset each player in the room
  room.players.forEach((player) => {
    player.isJumping = false;
    player.isAttacking = false;
    player.isStrafing = false;
    player.isRawParrying = false;
    player.isRawParryStun = false;
    player.isDodging = false;
    player.isReady = false;
    player.isHit = false;
    player.isAlreadyHit = false;
    player.isDead = false;
    player.stamina = 100;
    player.isBowing = false;
    player.x = player.fighter === "player 1" ? 230 : 815;
    player.y = GROUND_LEVEL;
    player.knockbackVelocity = { x: 0, y: 0 };
    // Reset dodge charges
    player.dodgeCharges = MAX_DODGE_CHARGES;
    player.dodgeChargeCooldowns = [0, 0];
    // Reset power-up state
    player.activePowerUp = null;
    player.powerUpMultiplier = 1;

    // Set initial states for automatic salt throwing
    player.isThrowingSalt = true;
    player.saltCooldown = true;
    player.canMoveToReady = false; // New flag to control movement

    // Randomly select a power-up
    const powerUpTypes = Object.values(POWER_UP_TYPES);
    const randomPowerUp =
      powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    player.activePowerUp = randomPowerUp;
    player.powerUpMultiplier = POWER_UP_EFFECTS[randomPowerUp];

    // Emit power-up event to clients
    io.in(room.id).emit("power_up_activated", {
      playerId: player.id,
      powerUpType: randomPowerUp,
    });

    // Reset salt throwing state after animation
    setTimeout(() => {
      player.isThrowingSalt = false;
      // Allow movement after salt throw is complete
      player.canMoveToReady = true;
    }, 500);

    // Reset salt cooldown
    setTimeout(() => {
      player.saltCooldown = false;
    }, 750);
  });

  // Emit an event to inform clients that the game has been reset
  io.in(room.id).emit("game_reset", false);
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  io.emit("rooms", rooms);

  if (!gameLoop) {
    gameLoop = setInterval(() => {
      try {
        tick(delta);
      } catch (error) {
        console.error("Error in game loop:", error);
        // Optionally clear the interval if the error is severe
        // clearInterval(gameLoop);
      }
    }, delta);
  }

  // this is for the initial game start
  socket.on("game_reset", (data) => {
    console.log("game reset index.js" + data);
    resetRoomAndPlayers(rooms[index]);
  });

  function isOpponentCloseEnoughForThrow(player, opponent) {
    // Calculate throw range based on player size
    const throwRange = THROW_RANGE * (player.sizeMultiplier || 1);
    return Math.abs(player.x - opponent.x) < throwRange;
  }

  function isOpponentCloseEnoughForGrab(player, opponent) {
    // Calculate grab range based on player size
    const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
    return Math.abs(player.x - opponent.x) < grabRange;
  }

  const THROW_TECH_COOLDOWN = 500; // 500ms cooldown on throw techs
  const THROW_TECH_DURATION = 300; // 300ms duration of throw tech animation
  const THROW_TECH_WINDOW = 300; // 300ms window for throw techs to occur

  function checkForThrowTech(player, opponent) {
    const currentTime = Date.now();

    // If either player is on cooldown, no throw tech can occur
    if (player.throwTechCooldown || opponent.throwTechCooldown) {
      return false;
    }

    // If either player is already in a throw tech animation, prevent new throw techs
    if (player.isThrowTeching || opponent.isThrowTeching) {
      return false;
    }

    // Only check for throw tech if both players have recent attempt times
    if (!opponent.lastThrowAttemptTime && !opponent.lastGrabAttemptTime) {
      return false;
    }

    // Clean up old attempts that are outside the tech window
    if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      player.lastThrowAttemptTime = 0;
    }
    if (currentTime - player.lastGrabAttemptTime > THROW_TECH_WINDOW) {
      player.lastGrabAttemptTime = 0;
    }
    if (currentTime - opponent.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      opponent.lastThrowAttemptTime = 0;
    }
    if (currentTime - opponent.lastGrabAttemptTime > THROW_TECH_WINDOW) {
      opponent.lastGrabAttemptTime = 0;
    }

    // Check all possible tech scenarios
    const bothThrew =
      player.lastThrowAttemptTime &&
      opponent.lastThrowAttemptTime &&
      Math.abs(player.lastThrowAttemptTime - opponent.lastThrowAttemptTime) <=
        THROW_TECH_WINDOW;

    const bothGrabbed =
      player.lastGrabAttemptTime &&
      opponent.lastGrabAttemptTime &&
      Math.abs(player.lastGrabAttemptTime - opponent.lastGrabAttemptTime) <=
        THROW_TECH_WINDOW;

    const throwAndGrab =
      (player.lastThrowAttemptTime &&
        opponent.lastGrabAttemptTime &&
        Math.abs(player.lastThrowAttemptTime - opponent.lastGrabAttemptTime) <=
          THROW_TECH_WINDOW) ||
      (player.lastGrabAttemptTime &&
        opponent.lastThrowAttemptTime &&
        Math.abs(player.lastGrabAttemptTime - opponent.lastThrowAttemptTime) <=
          THROW_TECH_WINDOW);

    return bothThrew || bothGrabbed || throwAndGrab;
  }

  // Update applyThrowTech to clear all relevant states:
  const TECH_FREEZE_DURATION = 200; // Duration of the freeze in milliseconds
  const TECH_KNOCKBACK_VELOCITY = 5;

  function applyThrowTech(player, opponent) {
    const knockbackDirection = player.x < opponent.x ? -1 : 1;

    // Clear all throw/grab states
    player.isThrowing = false;
    player.isGrabbing = false;
    player.isBeingThrown = false;
    player.isBeingGrabbed = false;
    player.grabbedOpponent = null;

    opponent.isThrowing = false;
    opponent.isGrabbing = false;
    opponent.isBeingThrown = false;
    opponent.isBeingGrabbed = false;
    opponent.grabbedOpponent = null;
    opponent.isPushing = false;
    opponent.isBeingPushed = false;
    opponent.isBeingPulled = false;

    // Clear charge attack states
    player.isChargingAttack = false;
    player.chargeStartTime = 0;
    player.chargeAttackPower = 0;
    player.chargingFacingDirection = null;

    opponent.isChargingAttack = false;
    opponent.chargeStartTime = 0;
    opponent.chargeAttackPower = 0;
    opponent.chargingFacingDirection = null;

    // Set up tech state
    player.isThrowTeching = true;
    opponent.isThrowTeching = true;

    // Add freeze timing properties
    player.techFreezeStartTime = Date.now();
    opponent.techFreezeStartTime = Date.now();

    // Store knockback values
    player.pendingKnockback = TECH_KNOCKBACK_VELOCITY * knockbackDirection;
    opponent.pendingKnockback = TECH_KNOCKBACK_VELOCITY * -knockbackDirection;

    // Clear attempt times
    player.lastThrowAttemptTime = 0;
    player.lastGrabAttemptTime = 0;
    opponent.lastThrowAttemptTime = 0;
    opponent.lastGrabAttemptTime = 0;

    // Reset grab cooldowns
    player.grabCooldown = false;
    opponent.grabCooldown = false;

    // Apply cooldown
    player.throwTechCooldown = true;
    opponent.throwTechCooldown = true;

    // Reset throw tech animation after duration
    setTimeout(() => {
      player.isThrowTeching = false;
      opponent.isThrowTeching = false;
    }, THROW_TECH_DURATION);

    // Reset cooldown after longer duration
    setTimeout(() => {
      player.throwTechCooldown = false;
      opponent.throwTechCooldown = false;
    }, THROW_TECH_COOLDOWN);
  }

  function tick(delta) {
    rooms.forEach((room) => {
      if (room.players.length < 2) return;

      staminaRegenCounter += delta;

      if (room.players.length === 2) {
        const [player1, player2] = room.players;

        // Handle dodge charge regeneration
        [player1, player2].forEach((player) => {
          const currentTime = Date.now();

          // Check each charge's cooldown independently
          player.dodgeChargeCooldowns.forEach((cooldownEndTime, index) => {
            if (cooldownEndTime > 0 && currentTime >= cooldownEndTime) {
              // Reset this charge's cooldown
              player.dodgeChargeCooldowns[index] = 0;
            }
          });

          // Count available charges based on cooldowns
          player.dodgeCharges = player.dodgeChargeCooldowns.filter(
            (cooldown) => cooldown === 0
          ).length;
        });

        // Handle ready positions separately from movement
        handleReadyPositions(room, player1, player2);

        if (player1.isGrabbing && player1.grabbedOpponent) {
          // Only handle grab state if not pushing
          const opponent = room.players.find(
            (p) => p.id === player1.grabbedOpponent
          );
          if (opponent) {
            // Keep opponent at fixed distance during grab
            const fixedDistance = 72 * (opponent.sizeMultiplier || 1); // Reduced from 90 by 20%
            opponent.x =
              player1.facing === 1
                ? player1.x - fixedDistance
                : player1.x + fixedDistance;
            opponent.facing = -player1.facing;
          }
        }

        // Check for collision and adjust positions
        if (
          arePlayersColliding(player1, player2) &&
          !player1.isAttacking &&
          !player2.isAttacking &&
          !player1.isGrabbing &&
          !player2.isGrabbing &&
          !player1.isBeingGrabbed &&
          !player2.isBeingGrabbed
        ) {
          adjustPlayerPositions(player1, player2, delta);
        }

        if (
          !player1.isGrabbing &&
          !player1.isBeingGrabbed &&
          !player2.isGrabbing &&
          !player2.isBeingGrabbed &&
          !player1.isThrowing &&
          !player2.isThrowing
        ) {
          // Preserve facing direction during attacks and throws
          if (
            !player1.isAttacking &&
            !player2.isAttacking &&
            !player1.isDodging &&
            !player2.isDodging
          ) {
            if (player1.x < player2.x) {
              player1.facing = -1; // Player 1 faces right
              player2.facing = 1; // Player 2 faces left
            } else {
              player1.facing = 1; // Player 1 faces left
              player2.facing = -1; // Player 2 faces right
            }
          }
        }

        if (player1.isAttacking) {
          checkCollision(player1, player2);
        }
        if (player2.isAttacking) {
          checkCollision(player2, player1);
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

          console.log(player1.isReady);
          if (currentTime - room.readyStartTime >= 1000) {
            // Clear the automatic start timer if players ready up
            if (room.roundStartTimer) {
              clearTimeout(room.roundStartTimer);
              room.roundStartTimer = null;
            }
            room.gameStart = true;
            io.in(room.id).emit("game_start", true);
            player1.isReady = false;
            player2.isReady = false;
            room.hakkiyoiCount = 1;
            room.readyStartTime = null;
          }
        } else {
          room.readyStartTime = null;
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
              const sizeOffset =
                player.activePowerUp === POWER_UP_TYPES.SIZE
                  ? HITBOX_DISTANCE_VALUE * (player.sizeMultiplier - 1)
                  : 0;

              // Only use map boundaries during recovery
              const leftBoundary =
                MAP_LEFT_BOUNDARY + sizeOffset * SIZE_POWERUP_LEFT_MULTIPLIER;
              const rightBoundary =
                MAP_RIGHT_BOUNDARY - sizeOffset * SIZE_POWERUP_RIGHT_MULTIPLIER;

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
            }
          }
        });
      }

      // Players Loop
      room.players.forEach((player) => {
        if (room.gameOver && player.id === room.loserId && !player.isHit) {
          return;
        }

        // Handle knockback movement with NO boundary restrictions
        if (player.isHit) {
          // Apply immediate knockback without boundary check
          player.x =
            player.x + player.knockbackVelocity.x * delta * speedFactor;

          // Apply friction to knockback
          player.knockbackVelocity.x *= 0.875;

          // Apply ice-like sliding physics
          if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
            // Apply momentum and friction
            player.movementVelocity *= MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;

            // Calculate new position with sliding
            player.x = player.x + delta * speedFactor * player.movementVelocity;
          }

          // Reset hit state when both knockback and sliding are nearly complete
          if (
            Math.abs(player.knockbackVelocity.x) < 0.1 &&
            Math.abs(player.movementVelocity) < MIN_MOVEMENT_THRESHOLD
          ) {
            player.knockbackVelocity.x = 0;
            player.movementVelocity = 0;
            player.isHit = false;
          }
        }

        // Only apply boundary restrictions for normal player movement (walking/strafing)
        // Exclude hit, grab, throw, and being grabbed states
        if (
          !player.isHit &&
          !room.gameOver &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isThrowTeching &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isSlapAttack
        ) {
          // Calculate effective boundary based on player size with different multipliers for left and right
          const sizeOffset =
            player.activePowerUp === POWER_UP_TYPES.SIZE
              ? HITBOX_DISTANCE_VALUE * (player.sizeMultiplier - 1)
              : 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary =
            MAP_LEFT_BOUNDARY + sizeOffset * SIZE_POWERUP_LEFT_MULTIPLIER;
          const rightBoundary =
            MAP_RIGHT_BOUNDARY - sizeOffset * SIZE_POWERUP_RIGHT_MULTIPLIER;

          // Apply boundary restrictions
          if (player.keys.a || player.keys.d || player.isAttacking) {
            player.x = Math.max(
              leftBoundary,
              Math.min(player.x, rightBoundary)
            );
          }
        }

        // Add separate boundary check for grabbing state
        if (player.isGrabbing && !player.isThrowing && !player.isBeingThrown) {
          // Calculate effective boundary based on player size with different multipliers
          const sizeOffset =
            player.activePowerUp === POWER_UP_TYPES.SIZE
              ? HITBOX_DISTANCE_VALUE * (player.sizeMultiplier - 1)
              : 0;

          // Apply different multipliers for left and right ring out boundaries
          const leftRingOutBoundary =
            MAP_RING_OUT_LEFT + sizeOffset * SIZE_POWERUP_LEFT_MULTIPLIER;
          const rightRingOutBoundary =
            MAP_RING_OUT_RIGHT - sizeOffset * SIZE_POWERUP_RIGHT_MULTIPLIER;

          player.x = Math.max(
            leftRingOutBoundary,
            Math.min(player.x, rightRingOutBoundary)
          );
        }

        // Win Conditions - back to original state
        if (
          (player.isHit && player.x <= MAP_RING_OUT_LEFT && !room.gameOver) ||
          (player.isHit && player.x >= MAP_RING_OUT_RIGHT && !room.gameOver) ||
          (player.isAttacking &&
            !player.isSlapAttack &&
            player.x <= MAP_RING_OUT_LEFT &&
            !room.gameOver &&
            player.facing === -1) ||
          (player.isAttacking &&
            !player.isSlapAttack &&
            player.x >= MAP_RING_OUT_RIGHT &&
            !room.gameOver &&
            player.facing === 1) ||
          (player.isBeingThrown &&
            !room.gameOver &&
            ((player.x <= MAP_LEFT_BOUNDARY && player.throwerX < 540) ||
              (player.x >= MAP_RIGHT_BOUNDARY && player.throwerX > 540))) ||
          // Add new condition for charged attack ring out
          (player.isAttacking &&
            !player.isSlapAttack &&
            ((player.x <= MAP_RING_OUT_LEFT && player.facing === 1) ||
              (player.x >= MAP_RING_OUT_RIGHT && player.facing === -1)) &&
            !room.gameOver)
        ) {
          const winner = room.players.find((p) => p.id !== player.id);
          handleWinCondition(room, player, winner);
          // Don't reset knockback velocity for the loser
          player.knockbackVelocity = { ...player.knockbackVelocity };
        }

        if (
          room.gameOver &&
          Date.now() - room.gameOverTime >= 3000 &&
          !room.matchOver
        ) {
          // 5 seconds
          resetRoomAndPlayers(room);
        }

        if (player.stamina < 100) {
          if (staminaRegenCounter >= 1000) {
            player.stamina += 25;
            player.stamina = Math.min(player.stamina, 100);
          }
        }

        // if (player.isHit) return;

        if (player.isThrowing && player.throwOpponent) {
          const currentTime = Date.now();
          const throwDuration = currentTime - player.throwStartTime;
          const throwProgress =
            throwDuration / (player.throwEndTime - player.throwStartTime);

          const opponent = room.players.find(
            (p) => p.id === player.throwOpponent
          );
          if (opponent) {
            const throwArcHeight = 450;
            const throwDistance = 120;
            const armsReachDistance = -100;

            if (!player.throwingFacingDirection) {
              player.throwingFacingDirection = player.facing;
              opponent.beingThrownFacingDirection = opponent.facing;
              opponent.x =
                player.x + player.throwingFacingDirection * armsReachDistance;
              opponent.y = GROUND_LEVEL;
            }

            player.facing = player.throwingFacingDirection;
            opponent.facing = opponent.beingThrownFacingDirection;

            // Calculate new position with size power-up consideration
            const sizeOffset =
              opponent.activePowerUp === POWER_UP_TYPES.SIZE
                ? HITBOX_DISTANCE_VALUE * (opponent.sizeMultiplier - 1)
                : 0;

            const newX =
              player.x +
              player.throwingFacingDirection *
                (armsReachDistance +
                  (throwDistance - armsReachDistance) * throwProgress);

            // Only update position if it's moving in the correct direction
            const isMovingForward =
              player.throwingFacingDirection === 1
                ? newX > opponent.x
                : newX < opponent.x;

            if (isMovingForward) {
              opponent.x = newX;
            }

            opponent.y =
              GROUND_LEVEL +
              3.2 * throwArcHeight * throwProgress * (1 - throwProgress);

            // Check if throw is complete
            if (currentTime >= player.throwEndTime) {
              // Check for win condition at the end of throw
              if (
                (opponent.x >= MAP_RIGHT_BOUNDARY && player.x > 540) ||
                (opponent.x <= MAP_LEFT_BOUNDARY && player.x < 540)
              ) {
                handleWinCondition(room, opponent, player);
              } else {
                // Emit screen shake for landing after throw
                io.in(room.id).emit("screen_shake", {
                  intensity: 0.6,
                  duration: 200,
                });
              }

              // Reset all throw-related states for both players
              player.isThrowing = false;
              player.throwOpponent = null;
              player.throwingFacingDirection = null;
              player.throwStartTime = 0;
              player.throwEndTime = 0;

              opponent.isBeingThrown = false;
              opponent.beingThrownFacingDirection = null;
              opponent.isHit = false;
              opponent.y = GROUND_LEVEL;
              opponent.knockbackVelocity.y = 0;
              opponent.knockbackVelocity.x = player.throwingFacingDirection * 7;
            }
          }
        } else if (player.isThrowing && !player.throwOpponent) {
          const currentTime = Date.now();
          const throwDuration = currentTime - player.throwStartTime;
          const throwProgress =
            throwDuration / (player.throwEndTime - player.throwStartTime);

          if (currentTime >= player.throwEndTime) {
            player.isThrowing = false;
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
        // Dodging
        if (player.isDodging) {
          let currentDodgeSpeed = speedFactor * 2.2; // Increased from 1.8 to 2.2 for better balance

          // Apply speed power-up to dodge with moderate multiplier
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentDodgeSpeed *= Math.min(player.powerUpMultiplier * 0.85, 1.5); // Increased multiplier and cap
          }
          // Reduce dodge speed when size power-up is active
          if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
            currentDodgeSpeed *= 0.85; // 15% speed reduction
          }

          // Calculate dodge progress (0 to 1)
          const dodgeProgress =
            (Date.now() - player.dodgeStartTime) /
            (player.dodgeEndTime - player.dodgeStartTime);

          // Calculate hop height using sine wave
          const hopHeight = Math.sin(dodgeProgress * Math.PI) * 50; // 50 pixels max height

          // Calculate new position
          const newX =
            player.x + player.dodgeDirection * delta * currentDodgeSpeed;
          const newY = GROUND_LEVEL + hopHeight;

          // Calculate effective boundary based on player size with different multipliers
          const sizeOffset =
            player.activePowerUp === POWER_UP_TYPES.SIZE
              ? HITBOX_DISTANCE_VALUE * (player.sizeMultiplier - 1)
              : 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary =
            MAP_LEFT_BOUNDARY + sizeOffset * SIZE_POWERUP_LEFT_MULTIPLIER;
          const rightBoundary =
            MAP_RIGHT_BOUNDARY - sizeOffset * SIZE_POWERUP_RIGHT_MULTIPLIER;

          // Only update position if within boundaries
          if (newX >= leftBoundary && newX <= rightBoundary) {
            player.x = newX;
            player.y = newY;
          }

          if (Date.now() >= player.dodgeEndTime) {
            // Transfer dodge momentum to movement velocity
            // Use a higher percentage of the dodge speed for more natural sliding
            const dodgeMomentum =
              currentDodgeSpeed * player.dodgeDirection * 1.2;

            // If no movement keys are pressed, apply full momentum
            if (!player.keys.a && !player.keys.d) {
              player.movementVelocity = dodgeMomentum;
            } else {
              // If movement keys are pressed, blend the momentum with current movement
              player.movementVelocity =
                (player.movementVelocity + dodgeMomentum) * 0.6;
            }

            player.isDodging = false;
            player.dodgeDirection = null;
            player.y = GROUND_LEVEL; // Reset to ground level when dodge ends
          }
        }

        // Strafing
        if (
          (!player.keys.s &&
            !player.isAttacking &&
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isRecovering &&
            !player.isHit) ||
          (!player.keys.s &&
            player.isSlapAttack &&
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isRecovering &&
            !player.isHit)
        ) {
          let currentSpeedFactor = speedFactor;

          // Apply speed power-up
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentSpeedFactor *= player.powerUpMultiplier;
          }
          // Reduce speed when size power-up is active
          if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
            currentSpeedFactor *= 0.85;
          }

          // Initialize movement velocity if it doesn't exist
          if (!player.movementVelocity) {
            player.movementVelocity = 0;
          }

          // Calculate effective boundary based on player size with different multipliers
          const sizeOffset =
            player.activePowerUp === POWER_UP_TYPES.SIZE
              ? HITBOX_DISTANCE_VALUE * (player.sizeMultiplier - 1)
              : 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary =
            MAP_LEFT_BOUNDARY + sizeOffset * SIZE_POWERUP_LEFT_MULTIPLIER;
          const rightBoundary =
            MAP_RIGHT_BOUNDARY - sizeOffset * SIZE_POWERUP_RIGHT_MULTIPLIER;

          if (
            player.keys.d &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.keys.mouse1 // Add condition to prevent strafing while slapping
          ) {
            // Apply ice drift when changing directions
            if (player.movementVelocity < 0) {
              player.movementVelocity *= ICE_DRIFT_FACTOR;
            }

            // Gradual acceleration on ice
            player.movementVelocity = Math.min(
              player.movementVelocity + MOVEMENT_ACCELERATION,
              MAX_MOVEMENT_SPEED
            );

            // Calculate new position and check boundaries
            const newX =
              player.x + delta * currentSpeedFactor * player.movementVelocity;
            if (newX <= rightBoundary) {
              player.x = newX;
            } else {
              player.x = rightBoundary;
              player.movementVelocity = 0; // Stop sliding at boundary
            }
            player.isStrafing = true;
            player.isReady = false;
          } else if (
            player.keys.a &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.keys.mouse1 // Add condition to prevent strafing while slapping
          ) {
            // Apply ice drift when changing directions
            if (player.movementVelocity > 0) {
              player.movementVelocity *= ICE_DRIFT_FACTOR;
            }

            // Gradual acceleration on ice
            player.movementVelocity = Math.max(
              player.movementVelocity - MOVEMENT_ACCELERATION,
              -MAX_MOVEMENT_SPEED
            );

            // Calculate new position and check boundaries
            const newX =
              player.x + delta * currentSpeedFactor * player.movementVelocity;
            if (newX >= leftBoundary) {
              player.x = newX;
            } else {
              player.x = leftBoundary;
              player.movementVelocity = 0; // Stop sliding at boundary
            }
            player.isStrafing = true;
            player.isReady = false;
          } else {
            // Apply ice-like deceleration
            if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
              // Apply momentum and friction
              player.movementVelocity *= MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;

              // Calculate new position and check boundaries
              let newX;
              if (player.isSlapSliding) {
                // Use fixed speed factor for slap slides
                newX = player.x + delta * speedFactor * player.movementVelocity;
              } else {
                // Use power-up affected speed factor for normal movement
                newX = player.x + delta * currentSpeedFactor * player.movementVelocity;
              }

              // Check boundaries and stop sliding if hitting them
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              } else {
                // Stop at boundary and reset velocity
                player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
                player.movementVelocity = 0;
              }
            } else {
              // Snap to zero when velocity is very small
              player.movementVelocity = 0;
            }
          }

          // Update strafing state
          if (
            !player.keys.a &&
            !player.keys.d &&
            (!player.canMoveToReady || room.gameStart) ||
            player.keys.mouse1 // Add condition to prevent strafing while slapping
          ) {
            player.isStrafing = false;
          }

          // Force stop strafing in certain states
          if (
            (!player.keys.a &&
              !player.keys.d &&
              (!player.canMoveToReady || room.gameStart)) ||
            player.isThrowTeching ||
            player.isRecovering ||
            (player.keys.a && player.keys.d) ||
            player.keys.mouse1 // Add condition to prevent strafing while slapping
          ) {
            player.isStrafing = false;
            // Don't immediately stop on ice
            player.movementVelocity *= MOVEMENT_FRICTION;
          }
        }
        if (
          (!player.keys.a &&
            !player.keys.d &&
            (!player.canMoveToReady || room.gameStart)) ||
          player.isThrowTeching ||
          player.isRecovering
        ) {
          // Add isRecovering check
          player.isStrafing = false;
        }
        if (player.keys.a && player.keys.d) {
          player.isStrafing = false;
        }
        // Keep player from going below ground level
        if (player.y > GROUND_LEVEL) {
          player.y -= delta * speedFactor + 10;
          player.y = Math.max(player.y, GROUND_LEVEL);
        }

        // raw parry
        if (
          player.keys.s &&
          player.y === GROUND_LEVEL &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isRecovering &&
          !player.isAttacking &&
          !player.isHit &&
          !player.isRawParryStun
        ) {
          player.isRawParrying = true;
          player.isReady = false;
        }

        if (!player.keys.s) {
          player.isRawParrying = false;
        }

        if (player.isAttacking && !player.isSlapAttack) {
          // Only move in the direction the player is facing
          const attackDirection = player.facing === 1 ? -1 : 1;
          const newX = player.x + attackDirection * delta * speedFactor * 2.5;

          // Only update position if it's moving in the correct direction
          if (
            (attackDirection === 1 && newX > player.x) ||
            (attackDirection === -1 && newX < player.x)
          ) {
            player.x = newX;
          }

          if (Date.now() >= player.attackEndTime) {
            player.isAttacking = false;
          }
        }
        if (player.isGrabbing && player.grabbedOpponent) {
          const opponent = room.players.find(
            (p) => p.id === player.grabbedOpponent
          );
          if (opponent) {
            const grabDuration = Date.now() - player.grabStartTime;

            // Check if grab duration exceeded
            if (grabDuration >= GRAB_DURATION) {
              // Release after 1.5 seconds
              cleanupGrabStates(player, opponent);
              return;
            }

            // Keep opponent at fixed distance during grab
            const fixedDistance = 72 * (opponent.sizeMultiplier || 1); // Reduced from 90 by 20%
            opponent.x =
              player.facing === 1
                ? player.x - fixedDistance
                : player.x + fixedDistance;
            opponent.facing = -player.facing;
          }
        } else if (player.isGrabbing && !player.grabbedOpponent) {
          const grabDuration = Date.now() - player.grabStartTime;
          if (grabDuration >= 500) {
            player.isGrabbing = false;
          }
        }

        // Apply speed power-up effect
        if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
          player.speedFactor = speedFactor * player.powerUpMultiplier;
        } else {
          player.speedFactor = speedFactor;
        }

        // Apply size power-up effect
        if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
          player.sizeMultiplier = player.powerUpMultiplier;
        } else {
          player.sizeMultiplier = 1;
        }

        // Update charge attack power in the game loop
        if (player.isChargingAttack) {
          const chargeDuration = Date.now() - player.chargeStartTime;
          player.chargeAttackPower = Math.min(
            (chargeDuration / 1000) * 100,
            100
          ); // Changed from 1200 to 1000 for faster charge
        }
      });

      io.in(room.id).emit("fighter_action", {
        player1: room.players[0],
        player2: room.players[1],
      });
    });

    if (staminaRegenCounter >= 1000) {
      staminaRegenCounter = 0; // Reset the counter after a second has passed
    }
  }

  function checkCollision(player, otherPlayer) {
    // Existing collision check conditions
    if (
      !player.isAttacking ||
      otherPlayer.isAlreadyHit ||
      otherPlayer.isDead ||
      otherPlayer.isDodging ||
      player.isDodging ||
      player.isBeingThrown ||
      otherPlayer.isBeingThrown
    ) {
      return;
    }

    // Calculate hitbox distance based on attack type and size power-up
    const baseHitboxDistance = player.isSlapAttack
      ? SLAP_HITBOX_DISTANCE_VALUE
      : HITBOX_DISTANCE_VALUE;

    const hitboxDistance = baseHitboxDistance * (player.sizeMultiplier || 1);

    // For slap attacks, only check horizontal distance like grab
    if (player.isSlapAttack) {
      const horizontalDistance = Math.abs(player.x - otherPlayer.x);
      if (horizontalDistance < hitboxDistance) {
        if (otherPlayer.isAttacking && otherPlayer.isSlapAttack) {
          // Check if both slaps occurred within the parry window
          const timeDifference = Math.abs(
            player.attackStartTime - otherPlayer.attackStartTime
          );
          if (timeDifference <= SLAP_PARRY_WINDOW) {
            // Find the current room
            const currentRoom = rooms.find((room) =>
              room.players.some((p) => p.id === player.id)
            );

            if (currentRoom) {
              resolveSlapParry(player, otherPlayer, currentRoom.id);
            }
            return;
          }
        }
        processHit(player, otherPlayer);
      }
      return;
    }

    // For charged attacks, use the full circular hitbox
    const playerHitbox = {
      left: player.x - hitboxDistance,
      right: player.x + hitboxDistance,
      top: player.y - hitboxDistance,
      bottom: player.y + hitboxDistance,
    };

    const opponentHitbox = {
      left: otherPlayer.x - hitboxDistance,
      right: otherPlayer.x + hitboxDistance,
      top: otherPlayer.y - hitboxDistance,
      bottom: otherPlayer.y + hitboxDistance,
    };

    const isCollision =
      playerHitbox.left < opponentHitbox.right &&
      playerHitbox.right > opponentHitbox.left &&
      playerHitbox.top < opponentHitbox.bottom &&
      playerHitbox.bottom > opponentHitbox.top;

    if (isCollision) {
      if (player.isAttacking && otherPlayer.isAttacking) {
        // Handle charge attack collisions with random winner selection
        const winner = Math.random() < 0.5 ? player : otherPlayer;
        const loser = winner === player ? otherPlayer : player;
        processHit(winner, loser);
      } else {
        processHit(player, otherPlayer);
      }
    }
  }

  function resolveSlapParry(player1, player2, roomId) {
    console.log("Slap Parry!");

    // Calculate knockback directions based on player positions
    const knockbackDirection1 = player1.x < player2.x ? -1 : 1;
    const knockbackDirection2 = -knockbackDirection1;

    // Apply parry effects to both players
    applyParryEffect(player1, knockbackDirection1);
    applyParryEffect(player2, knockbackDirection2);

    // Calculate the midpoint between the two players
    const midpointX = (player1.x + player2.x) / 2;
    const midpointY = (player1.y + player2.y) / 2;

    // Emit the parry event with just the necessary data
    io.in(roomId).emit("slap_parry", { x: midpointX, y: midpointY });
  }

  function applyParryEffect(player, knockbackDirection) {
    // Reset attack states
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.isHit = true;
    player.isSlapParrying = true;

    // Apply reduced knockback
    player.knockbackVelocity.x =
      SLAP_PARRY_KNOCKBACK_VELOCITY * knockbackDirection;
    player.knockbackVelocity.y = 0;

    // Set a brief recovery period
    setTimeout(() => {
      player.isHit = false;
      player.isAlreadyHit = false;
      player.isSlapParrying = false;
    }, 200);
  }

  function processHit(player, otherPlayer) {
    const MIN_ATTACK_DISPLAY_TIME = 100;
    const currentTime = Date.now();
    const attackDuration = currentTime - player.attackStartTime;

    // Find the current room
    const currentRoom = rooms.find((room) =>
      room.players.some((p) => p.id === player.id)
    );

    // Use the stored attack type instead of checking isSlapAttack
    const isSlapAttack = player.attackType === "slap";

    // Store the charge power before resetting states
    const chargePercentage = player.chargeAttackPower;

    // For charged attacks, end the attack immediately on hit
    if (!isSlapAttack) {
      // Set hit tracking flag for charged attacks
      player.chargedAttackHit = true;

      // Reset all attack states first
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
      player.chargingFacingDirection = null;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;

      // Set recovery state for successful hits
      player.isRecovering = true;
      player.recoveryStartTime = Date.now();
      player.recoveryDuration = 400;
      player.recoveryDirection = player.facing;
      // Initialize knockback velocity in the opposite direction of the attack
      player.knockbackVelocity = {
        x: player.facing * -2, // Static knockback amount
        y: 0,
      };
    } else {
      // For slap attacks, don't clear any states - let the animation complete naturally
      // This ensures consistent behavior with whiffed slaps
      const originalAttackEndTime = player.attackEndTime;
      const remainingAttackTime = originalAttackEndTime - currentTime;

      if (remainingAttackTime > 0) {
        setTimeout(() => {
          player.isAttacking = false;
          player.isSlapAttack = false;
          player.attackStartTime = 0;
          player.attackEndTime = 0;
          player.attackType = null;
        }, remainingAttackTime);
      }
    }

    // Check if the other player is blocking (crouching)
    if (otherPlayer.isRawParrying) {
      // Apply fixed knockback to the attacking player
      const knockbackDirection = player.facing === 1 ? 1 : -1;
      player.knockbackVelocity.x = RAW_PARRY_KNOCKBACK * knockbackDirection;
      player.knockbackVelocity.y = 0;
      player.isHit = true;
      player.isRawParryStun = true;

      // Clear all attack and recovery states
      player.isAttacking = false;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;
      player.chargingFacingDirection = null;
      player.isRecovering = false;
      player.recoveryStartTime = 0;
      player.recoveryDuration = 0;
      player.recoveryDirection = null;
      player.attackType = null;
      player.pendingChargeAttack = null;
      player.spacebarReleasedDuringDodge = false;

      // Emit screen shake for raw parry
      if (currentRoom) {
        io.in(currentRoom.id).emit("screen_shake", {
          intensity: 0.7,
          duration: 300,
        });
      }

      // Reset stun after duration
      setTimeout(() => {
        player.isHit = false;
        player.isRawParryStun = false;
      }, RAW_PARRY_STUN_DURATION);
    } else {
      // Apply the knockback to the defending player
      otherPlayer.isHit = true;
      otherPlayer.isJumping = false;
      otherPlayer.isAttacking = false;
      otherPlayer.isStrafing = false;

      // Update opponent's facing direction based on attacker's position
      otherPlayer.facing = player.x < otherPlayer.x ? 1 : -1;

      // Calculate knockback direction based on relative positions
      const knockbackDirection = player.x < otherPlayer.x ? 1 : -1;

      // Calculate knockback multiplier based on charge percentage
      let finalKnockbackMultiplier;
      if (isSlapAttack) {
        finalKnockbackMultiplier = 0.5; // Fixed multiplier for slaps, no charge scaling
      } else {
        // Reduced knockback scaling for charged attacks
        finalKnockbackMultiplier = 0.5 + (chargePercentage / 100) * 1.2; // Reduced from 2.0 to 1.2
      }

      // Apply power-up effects
      if (player.activePowerUp === POWER_UP_TYPES.POWER) {
        finalKnockbackMultiplier =
          finalKnockbackMultiplier * player.powerUpMultiplier;
      }
      if (otherPlayer.activePowerUp === POWER_UP_TYPES.SIZE) {
        finalKnockbackMultiplier = finalKnockbackMultiplier * 0.85;
      }

      if (isSlapAttack) {
        // Convert knockback to movement velocity for ice-like sliding
        otherPlayer.movementVelocity =
          3.5 * knockbackDirection * finalKnockbackMultiplier; // Increased from 2.5 to 3.5
        otherPlayer.knockbackVelocity.x = 0; // Clear knockback velocity since we're using movement

        // Add immediate position adjustment to prevent overlap
        const minDistance = SLAP_HITBOX_DISTANCE_VALUE * 0.8; // 80% of hitbox distance
        const currentDistance = Math.abs(player.x - otherPlayer.x);
        if (currentDistance < minDistance) {
          const adjustment =
            (minDistance - currentDistance) * knockbackDirection;
          otherPlayer.x += adjustment;
        }

        // Add screen shake for slap attacks
        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.55, // Increased from 0.4 but still less than charged attack's 0.7
            duration: 200, // Increased from 150 but still less than charged attack's 250
          });
        }
      } else {
        // For charged attacks, use a combination of immediate knockback and sliding
        const immediateKnockback =
          2 * knockbackDirection * finalKnockbackMultiplier;
        otherPlayer.movementVelocity =
          1.5 * knockbackDirection * finalKnockbackMultiplier;
        otherPlayer.knockbackVelocity.x = immediateKnockback;

        // Calculate attacker bounce-off based on charge percentage
        const attackerBounceDirection = -knockbackDirection;
        const attackerBounceMultiplier = 0.3 + (chargePercentage / 100) * 0.5;

        // Set movement velocity for the attacker to create bounce-off effect
        player.movementVelocity =
          2 * attackerBounceDirection * attackerBounceMultiplier;
        player.knockbackVelocity = { x: 0, y: 0 }; // Clear knockback velocity since we're using movement

        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.7 + (chargePercentage / 100) * 0.2,
            duration: 250 + (chargePercentage / 100) * 100,
          });
        }
      }
      otherPlayer.knockbackVelocity.y = 0;
      otherPlayer.y = GROUND_LEVEL;

      otherPlayer.isAlreadyHit = true;
      setTimeout(
        () => {
          otherPlayer.isHit = false;
          otherPlayer.isAlreadyHit = false;
        },
        isSlapAttack ? 250 : 300
      );
    }
  }

  socket.on("get_rooms", () => {
    socket.emit("rooms", rooms);
  });

  socket.on("join_room", (data) => {
    socket.join(data.roomId);
    console.log(`${data.socketId} joined ${data.roomId}`);
    index = rooms.findIndex((room) => room.id === data.roomId);
    if (rooms[index].players.length < 1) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "player 1",
        color: "aqua",
        isJumping: false,
        isAttacking: false,
        throwCooldown: false,
        grabCooldown: false,
        isChargingAttack: false,
        chargeStartTime: 0,
        chargeMaxDuration: 2000,
        chargeAttackPower: 0,
        chargingFacingDirection: null,
        isSlapAttack: false,
        slapAnimation: 2,
        isThrowing: false,
        isThrowingSalt: false,
        saltCooldown: false,
        throwStartTime: 0,
        throwEndTime: 0,
        throwOpponent: null,
        throwingFacingDirection: null,
        beingThrownFacingDirection: null,
        isGrabbing: false,
        grabStartTime: 0,
        grabbedOpponent: null,
        isThrowTeching: false,
        throwTechCooldown: false,
        isSlapParrying: false,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isRawParrying: false,
        isRawParryStun: false,
        dodgeDirection: false,
        dodgeEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: 1,
        stamina: 100,
        x: 230,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        dodgeCharges: MAX_DODGE_CHARGES,
        dodgeChargeCooldowns: [0, 0],
        keys: {
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
        },
        wins: [],
        bufferedAction: null, // Add buffer for pending actions
        bufferExpiryTime: 0, // Add expiry time for buffered actions
      });
    } else if (rooms[index].players.length === 1) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "player 2",
        color: "salmon",
        isJumping: false,
        isAttacking: false,
        throwCooldown: false,
        grabCooldown: false,
        isChargingAttack: false,
        chargeStartTime: 0,
        chargeMaxDuration: 2000,
        chargeAttackPower: 0,
        chargingFacingDirection: null,
        isSlapAttack: false,
        slapAnimation: 2,
        isThrowing: false,
        isThrowingSalt: false,
        saltCooldown: false,
        throwStartTime: 0,
        throwEndTime: 0,
        throwOpponent: null,
        throwingFacingDirection: null,
        beingThrownFacingDirection: null,
        isGrabbing: false,
        grabStartTime: 0,
        grabbedOpponent: null,
        isThrowTeching: false,
        throwTechCooldown: false,
        isSlapParrying: false,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isRawParrying: false,
        isRawParryStun: false,
        dodgeDirection: null,
        dodgeEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: -1,
        stamina: 100,
        x: 815,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        dodgeCharges: MAX_DODGE_CHARGES,
        dodgeChargeCooldowns: [0, 0],
        keys: {
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
        },
        wins: [],
        bufferedAction: null, // Add buffer for pending actions
        bufferExpiryTime: 0, // Add expiry time for buffered actions
      });
    }

    socket.roomId = data.roomId;
    io.to(data.roomId).emit("rooms", rooms);
    io.to(data.roomId).emit("lobby", rooms[index].players);
    // console.log(rooms[index].players);
  });

  socket.on("ready_count", (data) => {
    let index = rooms.findIndex((room) => room.id === data.roomId);
    console.log("ready count activated  ");
    if (data.isReady && data.playerId === socket.id) {
      rooms[index].readyCount++;
      io.in(data.roomId).emit("ready_count", rooms[index].readyCount);
      io.in(data.roomId).emit("lobby", rooms[index].players);
    } else if (!data.isReady && data.playerId === socket.id) {
      rooms[index].readyCount--;
      io.in(data.roomId).emit("ready_count", rooms[index].readyCount);
      io.in(data.roomId).emit("lobby", rooms[index].players);
    }

    if (rooms[index].readyCount > 1) {
      io.in(data.roomId).emit("initial_game_start", rooms[index]);

      console.log("Game started");
    }

    // console.log(rooms[index].readyCount);
  });

  socket.on("rematch_count", (data) => {
    let index = rooms.findIndex((room) => room.id === data.roomId);

    if (data.acceptedRematch && data.playerId === socket.id) {
      rooms[index].rematchCount++;
      io.in(data.roomId).emit("rematch_count", rooms[index].rematchCount);
    } else if (!data.acceptedRematch && data.playerId === socket.id) {
      rooms[index].rematchCount--;
      io.in(data.roomId).emit("rematch_count", rooms[index].rematchCount);
    }

    if (rooms[index].rematchCount > 1) {
      rooms[index].matchOver = false;
      rooms[index].gameOver = true;
      rooms[index].rematchCount = 0;
      io.in(data.roomId).emit("rematch_count", rooms[index].rematchCount);
    }
  });

  socket.on("fighter-select", (data) => {
    let roomId = socket.roomId;
    let index = rooms.findIndex((room) => room.id === roomId);

    let playerIndex = rooms[index].players.findIndex(
      (player) => player.id === socket.id
    );

    rooms[index].players[playerIndex].fighter = data.fighter;
    // console.log(rooms[index].players[playerIndex]);

    io.in(roomId).emit("lobby", rooms[index].players); // Update all players in the room
    io.to(roomId).emit("rooms", rooms);
    // console.log(rooms[index].players);
  });

  socket.on("fighter_action", (data) => {
    let roomId = socket.roomId;
    let index = rooms.findIndex((room) => room.id === roomId);

    let playerIndex = rooms[index].players.findIndex(
      (player) => player.id === data.id
    );
    let player = rooms[index].players[playerIndex];
    let opponent = rooms[index].players.find((p) => p.id !== player.id);

    if (
      (rooms[index].gameOver && !rooms[index].matchOver) ||
      rooms[index].matchOver
    ) {
      return; // Skip all other actions if the game is over
    }

    // Block all actions if player is throwing salt
    if (player.isThrowingSalt) {
      return;
    }

    // Block all actions if player is moving to ready position
    if (player.canMoveToReady) {
      return;
    }

    if (
      player.keys.f &&
      !player.saltCooldown &&
      ((player.fighter === "player 1" && player.x <= 280) ||
        (player.fighter === "player 2" && player.x >= 765)) && // Adjusted range for player 2
      rooms[index].gameStart === false &&
      !player.activePowerUp
    ) {
      player.isThrowingSalt = true;
      player.saltCooldown = true;

      // Randomly select a power-up
      const powerUpTypes = Object.values(POWER_UP_TYPES);
      const randomPowerUp =
        powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      player.activePowerUp = randomPowerUp;
      player.powerUpMultiplier = POWER_UP_EFFECTS[randomPowerUp];

      // Emit power-up event to clients
      io.in(roomId).emit("power_up_activated", {
        playerId: player.id,
        powerUpType: randomPowerUp,
      });

      setTimeout(() => {
        player.isThrowingSalt = false;
      }, 500);

      setTimeout(() => {
        player.saltCooldown = false;
      }, 750);
    }

    if (data.keys) {
      player.keys = data.keys;

      // console.log(data.keys);

      if (
        player.keys["shift"] &&
        !player.keys.e &&
        !player.keys.w &&
        !player.isDodging &&
        !player.isAttacking &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isRawParryStun &&
        !player.canMoveToReady && // Prevent dodge during ready position movement
        player.dodgeCharges > 0 // Check if player has dodge charges
      ) {
        console.log("Executing immediate dodge");
        player.isDodging = true;
        player.dodgeStartTime = Date.now();
        player.dodgeEndTime = Date.now() + 400;
        player.dodgeStartX = player.x;
        player.dodgeStartY = player.y;

        // Find the first available charge (from right to left)
        for (let i = player.dodgeChargeCooldowns.length - 1; i >= 0; i--) {
          if (player.dodgeChargeCooldowns[i] === 0) {
            // Use this charge
            player.dodgeCharges--;
            player.dodgeChargeCooldowns[i] = Date.now() + DODGE_COOLDOWN;
            break;
          }
        }

        if (player.keys.a) {
          player.dodgeDirection = -1;
        } else if (player.keys.d) {
          player.dodgeDirection = 1;
        } else {
          player.dodgeDirection = player.facing === -1 ? 1 : -1;
        }

        setTimeout(() => {
          player.isDodging = false;
          player.dodgeDirection = null;

          // Check for buffered actions after dodge ends
          if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
            console.log("Executing buffered action after dodge");
            const action = player.bufferedAction;
            player.bufferedAction = null;
            player.bufferExpiryTime = 0;

            // Execute the buffered action
            if (action.type === "dodge") {
              player.isDodging = true;
              player.dodgeStartTime = Date.now();
              player.dodgeEndTime = Date.now() + 400;
              player.dodgeDirection = action.direction;
              player.dodgeStartX = player.x;
              player.dodgeStartY = player.y;
            }
          }

          // Handle pending charge attack
          if (
            player.pendingChargeAttack &&
            player.spacebarReleasedDuringDodge
          ) {
            const chargePercentage = player.pendingChargeAttack.power;

            // Determine if it's a slap or charged attack
            if (player.keys.mouse1) {
              player.isSlapAttack = true;
              player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
              player.attackEndTime = Date.now() + 250;
              player.isAttacking = true;
              player.attackStartTime = Date.now();
              player.attackType = "slap";
            } else {
              executeChargedAttack(player, chargePercentage);
            }

            // Reset charging state
            player.isChargingAttack = false;
            player.pendingChargeAttack = null;
            player.spacebarReleasedDuringDodge = false;
          }
        }, 400);
      } else if (
        player.keys["shift"] &&
        (player.isAttacking ||
          player.isThrowing ||
          player.isBeingThrown ||
          player.isGrabbing ||
          player.isBeingGrabbed) && // Removed isDodging from this condition
        !player.isDodging && // Add explicit check to prevent dodge buffering during dodge
        player.dodgeCharges > 0 // Check if player has dodge charges
      ) {
        // Buffer the dodge action
        console.log("Buffering dodge action");
        const dodgeDirection = player.keys.a
          ? -1
          : player.keys.d
          ? 1
          : player.facing === -1
          ? 1
          : -1;
        player.bufferedAction = {
          type: "dodge",
          direction: dodgeDirection,
        };
        player.bufferExpiryTime = Date.now() + 500; // Buffer expires after 500ms
      }

      // Add buffer check in the attack completion logic
      if (player.isAttacking && Date.now() >= player.attackEndTime) {
        console.log("Attack completed, checking for buffered actions");
        // Only clear attack states if we're not charging
        if (!player.isChargingAttack) {
          player.isAttacking = false;
          player.isSlapAttack = false;
          player.chargingFacingDirection = null;
          player.attackType = null; // Clear attack type

          // Check for buffered actions after attack ends
          if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
            console.log("Executing buffered action after attack");
            const action = player.bufferedAction;
            player.bufferedAction = null;
            player.bufferExpiryTime = 0;

            // Clear charging state when executing buffered action
            player.isChargingAttack = false;
            player.chargeStartTime = 0;
            player.chargeAttackPower = 0;
            player.chargingFacingDirection = null;
            player.attackType = null;

            // Execute the buffered action
            if (action.type === "dodge") {
              player.isDodging = true;
              player.dodgeStartTime = Date.now();
              player.dodgeEndTime = Date.now() + 400;
              player.stamina -= 50;
              player.dodgeDirection = action.direction;
              player.dodgeStartX = player.x;
              player.dodgeStartY = player.y;
            }
          }
        }
      }

      // Start charging attack
      if (
        player.keys.mouse2 &&
        !player.isChargingAttack && // Only check these conditions when starting
        !player.isAttacking &&
        !player.isJumping &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit &&
        !player.isRecovering && // Add recovery check
        !player.isRawParryStun &&
        !player.canMoveToReady // Prevent charging during ready position movement
      ) {
        // Start charging
        player.isChargingAttack = true;
        player.chargeStartTime = Date.now();
        player.chargeAttackPower = 1;
        player.spacebarReleasedDuringDodge = false;
        player.attackType = "charged"; // Set attack type immediately when charging starts
      }
      // For continuing a charge
      else if (
        player.keys.mouse2 &&
        (player.isChargingAttack || player.isDodging) &&
        !player.isHit &&
        !player.isRecovering && // Add recovery check
        !player.isRawParryStun
      ) {
        // If we're dodging and not already charging, start charging
        if (player.isDodging && !player.isChargingAttack) {
          player.isChargingAttack = true;
          player.chargeStartTime = Date.now();
          player.chargeAttackPower = 1;
          player.attackType = "charged";
        }
        // Calculate charge power (0-100%)
        const chargeDuration = Date.now() - player.chargeStartTime;
        player.chargeAttackPower = Math.min((chargeDuration / 1000) * 100, 100);

        // Lock facing direction while charging
        if (player.isThrowing || player.throwingFacingDirection !== null) {
          player.chargingFacingDirection = player.throwingFacingDirection;
        } else {
          player.chargingFacingDirection = player.facing;
        }

        if (player.chargingFacingDirection !== null) {
          player.facing = player.chargingFacingDirection;
        }
      }
      // Release charged attack when mouse2 is released
      else if (
        !player.keys.mouse2 &&
        player.isChargingAttack &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isThrowing &&
        !player.isBeingThrown
      ) {
        // If dodging, store the charge for later
        if (player.isDodging) {
          player.pendingChargeAttack = {
            power: player.chargeAttackPower,
            startTime: player.chargeStartTime,
            type: "charged",
          };
          player.spacebarReleasedDuringDodge = true;
        } else {
          executeChargedAttack(player, player.chargeAttackPower);
        }
      }
      // Clear charging state if mouse2 is released and we're not in a valid state
      else if (!player.keys.mouse2 && player.isChargingAttack) {
        player.isChargingAttack = false;
        player.chargeStartTime = 0;
        player.chargeAttackPower = 0;
        player.chargingFacingDirection = null;
        player.attackType = null;
      }

      // Add new section to handle state transitions while holding mouse2
      if (
        player.keys.mouse2 &&
        !player.isChargingAttack &&
        !player.isAttacking &&
        !player.isHit &&
        !player.isRecovering &&
        !player.isRawParryStun &&
        !player.isBeingThrown &&
        !player.isBeingGrabbed
      ) {
        // Check if we should resume charging after a state transition
        const timeSinceLastCharge =
          Date.now() - (player.lastChargeEndTime || 0);
        if (timeSinceLastCharge < 1000) {
          // Resume charging if within 1 second of last charge
          player.isChargingAttack = true;
          player.chargeStartTime = Date.now();
          player.chargeAttackPower = Math.min(player.lastChargePower || 0, 100);
          player.attackType = "charged";
        }
      }

      // Store charge state when clearing it
      if (player.isChargingAttack && !player.keys.mouse2) {
        player.lastChargeEndTime = Date.now();
        player.lastChargePower = player.chargeAttackPower;
      }

      // Handle slap attacks with mouse1
      if (
        player.keys.mouse1 &&
        !player.isJumping &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit &&
        !player.isRawParryStun &&
        !player.canMoveToReady && // Prevent slap attacks during ready position movement
        !player.wasMouse1Pressed // Add check for previous mouse1 state
      ) {
        // Initialize slap buffer if it doesn't exist
        if (!player.slapBuffer) {
          player.slapBuffer = {
            lastSlapTime: 0,
            slapCooldown: 180,
            pendingSlaps: 0,
            bufferWindow: 200,
          };
        }

        // Always try to execute slap attack - the function will handle buffering internally
        // This allows buffering during strafing and other states
        executeSlapAttack(player);
      }

      // Store the current mouse1 state for next frame
      player.wasMouse1Pressed = player.keys.mouse1;

      function isOpponentCloseEnoughForGrab(player, opponent) {
        // Calculate grab range based on player size
        const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
        return Math.abs(player.x - opponent.x) < grabRange;
      }
      if (
        player.keys.w &&
        !player.keys.e &&
        !player.isThrowingSalt &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isDodging &&
        !player.isRawParrying &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.throwCooldown &&
        !player.isRawParryStun &&
        !player.isRecovering &&
        !player.canMoveToReady // Prevent throws during ready position movement
      ) {
        // Reset any lingering throw states before starting a new throw
        player.throwingFacingDirection = null;
        player.throwStartTime = 0;
        player.throwEndTime = 0;
        player.throwOpponent = null;

        player.lastThrowAttemptTime = Date.now();

        setTimeout(() => {
          const opponent = rooms[index].players.find((p) => p.id !== player.id);

          if (
            isOpponentCloseEnoughForThrow(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isDodging
          ) {
            if (checkForThrowTech(player, opponent)) {
              applyThrowTech(player, opponent);
            } else if (!player.throwTechCooldown) {
              player.isChargingAttack = false;
              player.chargeStartTime = 0;
              player.chargeAttackPower = 1;
              player.chargingFacingDirection = null;

              player.isThrowing = true;
              player.throwStartTime = Date.now();
              player.throwEndTime = Date.now() + 400;
              player.throwOpponent = opponent.id;
              opponent.isBeingThrown = true;
              opponent.isHit = true;

              player.throwCooldown = true;
              setTimeout(() => {
                player.throwCooldown = false;
              }, 250);
            }
          } else {
            player.isChargingAttack = false;
            player.chargeStartTime = 0;
            player.chargeAttackPower = 1;
            player.chargingFacingDirection = null;

            player.isThrowing = true;
            player.throwStartTime = Date.now();
            player.throwEndTime = Date.now() + 400;

            player.throwCooldown = true;
            setTimeout(() => {
              player.throwCooldown = false;
            }, 250);
          }
        }, 64);
      }

      // In the grabbing section, update the if condition and add cooldown:
      if (
        player.keys.e &&
        !player.isGrabbing &&
        !player.isBeingThrown &&
        !player.isBeingGrabbed &&
        !player.isDodging &&
        !player.isRawParrying &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.isThrowing &&
        !player.grabCooldown &&
        !player.isPushing &&
        !player.isBeingPushed &&
        !player.isBeingGrabbed &&
        !player.grabbedOpponent &&
        !player.isRawParryStun &&
        !player.canMoveToReady // Prevent grabs during ready position movement
      ) {
        player.lastGrabAttemptTime = Date.now();

        setTimeout(() => {
          const opponent = rooms[index].players.find((p) => p.id !== player.id);
          // Clear charging attack state regardless of grab success
          player.isChargingAttack = false;
          player.chargeStartTime = 0;
          player.chargeAttackPower = 0;
          player.chargingFacingDirection = null;

          if (
            isOpponentCloseEnoughForGrab(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isBeingGrabbed &&
            !player.isBeingGrabbed
          ) {
            if (checkForThrowTech(player, opponent)) {
              applyThrowTech(player, opponent);
            } else if (!player.throwTechCooldown) {
              player.isChargingAttack = false;
              player.chargeStartTime = 0;
              player.chargeAttackPower = 1;
              player.chargingFacingDirection = null;

              player.isGrabbing = true;
              player.grabStartTime = Date.now();
              player.grabbedOpponent = opponent.id;
              opponent.isBeingGrabbed = true;
              opponent.isHit = false; // Ensure isHit is false for initial grab

              if (player.isChargingAttack) {
                player.grabFacingDirection = player.chargingFacingDirection;
              } else {
                player.grabFacingDirection = player.facing;
              }

              player.grabCooldown = true;
              setTimeout(() => {
                player.grabCooldown = false;
              }, 1100);
            }
          } else {
            player.isGrabbing = true;
            player.grabStartTime = Date.now();

            // Only set cooldown if the grab was actually attempted
            if (isOpponentCloseEnoughForGrab(player, opponent)) {
              player.grabCooldown = true;
              setTimeout(() => {
                player.grabCooldown = false;
              }, 1100);
            }
          }
        }, 64);
      }
    }
    // console.log(player.keys);
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (rooms[roomIndex]) {
      // Clean up the room state
      cleanupRoomState(rooms[roomIndex]);

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

      // Remove the player
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      // Emit updates with cleaned data
      const cleanedRoom = getCleanedRoomData(rooms[roomIndex]);

      io.in(roomId).emit("player_left");
      io.in(roomId).emit("ready_count", 0);
      io.to(roomId).emit("lobby", cleanedRoom.players);
      io.emit("rooms", getCleanedRoomsData(rooms));
    }
    console.log(`${reason}: ${socket.id}`);
  });
});

// Update server listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// process.env.PORT ||

// Add new function for grab state cleanup
function cleanupGrabStates(player, opponent) {
  // Clean up grabber states
  player.isGrabbing = false;
  player.grabbedOpponent = null;
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.grabCooldown = false; // Add this to ensure cooldown is reset
  player.isBeingGrabbed = false; // Add this to ensure being grabbed state is reset
  player.isBeingPushed = false; // Add this to ensure being pushed state is reset

  // Clean up grabbed player states
  opponent.isBeingGrabbed = false;
  opponent.isBeingThrown = false;
  opponent.grabbedOpponent = null;
  opponent.throwOpponent = null;
  opponent.isHit = false;
  opponent.grabCooldown = false; // Add this to ensure cooldown is reset
  opponent.isGrabbing = false; // Add this to ensure grabbing state is reset
}

function handleWinCondition(room, loser, winner) {
  if (room.gameOver) return; // Prevent multiple win declarations

  room.gameOver = true;
  loser.y = GROUND_LEVEL;
  winner.wins.push("w");

  if (winner.wins.length > 3) {
    io.in(room.id).emit("match_over", {
      isMatchOver: true,
      winner: winner.fighter,
    });
    room.matchOver = true;
    winner.wins = [];
    loser.wins = [];
  } else {
    console.log(winner.wins.length);
    setTimeout(() => {
      winner.isBowing = true;
      loser.isBowing = false;
    }, 600);
  }

  // Store the current states that we want to preserve
  const loserKnockbackVelocity = { ...loser.knockbackVelocity };
  const loserMovementVelocity = loser.movementVelocity;

  // Reset all key states and attack states for both players
  room.players.forEach((p) => {
    const currentX = p.x;
    p.isStrafing = false;
    // Reset all attack-related states
    p.isAttacking = false;
    p.isChargingAttack = false;
    p.chargeStartTime = 0;
    p.chargeAttackPower = 0;
    p.chargingFacingDirection = null;
    p.isSlapAttack = false;
    p.slapAnimation = 2;
    p.attackStartTime = 0;
    p.attackEndTime = 0;
    p.pendingChargeAttack = null;
    p.spacebarReleasedDuringDodge = false;
    p.attackType = null;

    // Keep the loser's knockback and movement velocity
    if (p.id === loser.id) {
      p.knockbackVelocity = loserKnockbackVelocity;
      p.movementVelocity = loserMovementVelocity;
    } else {
      p.knockbackVelocity = { x: 0, y: 0 };
      p.movementVelocity = 0;
    }

    p.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
      e: false,
      f: false,
    };
    p.x = currentX;
  });

  io.in(room.id).emit("game_over", {
    isGameOver: true,
    winner: {
      id: winner.id,
      fighter: winner.fighter,
    },
    wins: winner.wins.length,
  });
  room.winnerId = winner.id;
  room.loserId = loser.id;
  if (!room.gameOverTime) {
    room.gameOverTime = Date.now();
  }

  // Wait for winner text to disappear (3 seconds) before resetting states
  setTimeout(() => {
    if (room.players) {
      room.players.forEach((p) => {
        if (p.id === loser.id) {
          p.knockbackVelocity = { x: 0, y: 0 };
          p.movementVelocity = 0;
        }
      });
    }
  }, 3000);
}

// Add this new function near the other helper functions
function executeSlapAttack(player) {
  // Find the current room and opponent
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    if (opponent) {
      // Update facing direction based on opponent's position
      player.facing = player.x < opponent.x ? -1 : 1;

      // Add forward slide during slap attack with fixed values regardless of power-ups
      const FIXED_SLAP_SLIDE_VELOCITY = 2.5; // Decreased from 3.5 to 2.5 for shorter slide
      const slideDirection = player.facing === 1 ? -1 : 1; // Slide in the direction player is facing
      
      // Store the current movement velocity to restore after slap
      const currentMovementVelocity = player.movementVelocity;
      
      // Apply fixed slide velocity and mark that we're in a slap slide
      player.movementVelocity = slideDirection * FIXED_SLAP_SLIDE_VELOCITY;
      player.isSlapSliding = true; // New flag to track slap slide state
    }
  }

  // Initialize slap buffer if it doesn't exist
  if (!player.slapBuffer) {
    player.slapBuffer = {
      lastSlapTime: 0,
      slapCooldown: 120, // Reduced cooldown for smoother rapid hits
      pendingSlaps: 0,
      bufferWindow: 100,
      hasBufferedSlap: false
    };
  }

  const currentTime = Date.now();
  const timeSinceLastSlap = currentTime - player.slapBuffer.lastSlapTime;

  // If we're still in cooldown, buffer the input
  if (timeSinceLastSlap < player.slapBuffer.slapCooldown) {
    // Only buffer if we don't already have a buffered slap
    if (timeSinceLastSlap < player.slapBuffer.bufferWindow && !player.slapBuffer.hasBufferedSlap) {
      player.slapBuffer.hasBufferedSlap = true;
      // Schedule the next slap to execute as soon as cooldown ends
      setTimeout(() => {
        if (player.slapBuffer.hasBufferedSlap) {
          player.slapBuffer.hasBufferedSlap = false;
          // Only execute if player is still in a valid state
          if (!player.isDodging && !player.isThrowing && !player.isBeingThrown && 
              !player.isGrabbing && !player.isBeingGrabbed && !player.isRawParryStun && 
              !player.canMoveToReady) {
            executeSlapAttack(player);
          }
        }
      }, player.slapBuffer.slapCooldown - timeSinceLastSlap);
    }
    return;
  }

  // Clear any ongoing charge attack
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;

  player.isSlapAttack = true;
  player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
  player.attackEndTime = Date.now() + 120; // Reduced animation duration for smoother rapid hits
  player.isAttacking = true;
  player.attackStartTime = Date.now();
  player.attackType = "slap";

  // Update last slap time
  player.slapBuffer.lastSlapTime = Date.now();

  // Set a timeout to reset the attack state and gradually reduce the slide
  setTimeout(() => {
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.attackType = null;
    player.isSlapSliding = false; // Clear the slap slide flag
    // Gradually reduce the slide velocity
    player.movementVelocity *= 0.5;
  }, 120); // Reduced animation duration for smoother rapid hits
}

function cleanupRoom(room) {
  // Clear any intervals
  if (room.gameLoop) {
    clearInterval(room.gameLoop);
  }

  // Reset room state
  room.players = [];
  room.readyCount = 0;
  room.rematchCount = 0;
  room.gameStart = false;
  room.hakkiyoiCount = 0;
  room.gameOver = false;
  room.matchOver = false;
  room.readyStartTime = null;
  room.gameOverTime = null;
  room.loserId = null;
}

// Add socket disconnect handler
io.on("connection", (socket) => {
  // ... existing connection code ...

  socket.on("disconnect", () => {
    // Find and cleanup the room the player was in
    const room = rooms.find((r) => r.players.some((p) => p.id === socket.id));
    if (room) {
      // Remove the player
      room.players = room.players.filter((p) => p.id !== socket.id);

      // If room is empty, cleanup
      if (room.players.length === 0) {
        cleanupRoom(room);
      }
    }
  });
});

// Add this new function near the other helper functions
function executeChargedAttack(player, chargePercentage) {
  // Don't execute charged attack if player is in a throw state
  if (player.isThrowing || player.isBeingThrown) {
    return;
  }

  // Clear any existing recovery state when starting a new attack
  player.isRecovering = false;
  player.recoveryStartTime = 0;
  player.recoveryDuration = 0;
  player.recoveryDirection = null;

  player.isSlapAttack = false;

  // Calculate attack duration based on charge percentage
  let attackDuration;
  if (chargePercentage <= 25) {
    attackDuration = 300; // Reduced from 500 to 300 for low charge
  } else if (chargePercentage <= 75) {
    attackDuration = 500;
  } else {
    const extraDuration = ((chargePercentage - 50) / 50) * 1000;
    attackDuration = 1000 + extraDuration;
  }

  player.attackEndTime = Date.now() + attackDuration;
  player.attackType = "charged";
  player.chargeAttackPower = chargePercentage;

  // Set attack state
  player.isAttacking = true;
  player.attackStartTime = Date.now();

  // Add hit tracking
  player.chargedAttackHit = false;

  // Lock facing direction during attack
  player.chargingFacingDirection = player.facing;
  if (player.chargingFacingDirection !== null) {
    player.facing = player.chargingFacingDirection;
  }

  // Reset charging state but keep the charge power for knockback
  player.isChargingAttack = false;
  player.chargeStartTime = 0;

  // Store the attack start time for recovery timing
  const attackStartTime = Date.now();

  setTimeout(() => {
    // Only set recovery if:
    // 1. We're still in a charged attack state
    // 2. Not in a throw state
    // 3. The attack was actually released (not cancelled)
    // 4. The attack duration has completed
    // 5. No hit occurred during the attack
    if (
      player.attackType === "charged" &&
      !player.isThrowing &&
      !player.isBeingThrown &&
      Date.now() - attackStartTime >= attackDuration &&
      !player.chargedAttackHit
    ) {
      const currentRoom = rooms.find((room) =>
        room.players.some((p) => p.id === player.id)
      );

      if (currentRoom) {
        const opponent = currentRoom.players.find((p) => p.id !== player.id);
        // Only set recovery for missed charged attacks
        if (opponent && !opponent.isHit && !player.isChargingAttack) {
          player.isRecovering = true;
          player.recoveryStartTime = Date.now();
          player.recoveryDuration = 250;
          player.recoveryDirection = player.facing;
          // Use movement velocity instead of knockback for more natural sliding
          player.movementVelocity = player.facing * -3; // Increased from -2 for more momentum
          player.knockbackVelocity = { x: 0, y: 0 }; // Clear knockback velocity
        }
      }
    }

    // Clear attack states
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;
    player.chargedAttackHit = false; // Reset hit tracking

    // Check for buffered actions after attack ends
    if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
      const action = player.bufferedAction;
      player.bufferedAction = null;
      player.bufferExpiryTime = 0;

      // Execute the buffered action
      if (action.type === "dodge") {
        player.isDodging = true;
        player.dodgeStartTime = Date.now();
        player.dodgeEndTime = Date.now() + 400;
        player.stamina -= 50;
        player.dodgeDirection = action.direction;
        player.dodgeStartX = player.x;
        player.dodgeStartY = player.y;
      }
    }
  }, attackDuration);
}

// Add new function to calculate effective hitbox size based on facing direction
function calculateEffectiveHitboxSize(player) {
  const baseSize = HITBOX_DISTANCE_VALUE * (player.sizeMultiplier || 1);

  // Only apply asymmetric adjustments if player has size power-up
  if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
    // Return asymmetric hitbox for size power-up
    return {
      left: baseSize * SIZE_POWERUP_LEFT_MULTIPLIER,
      right: baseSize * SIZE_POWERUP_RIGHT_MULTIPLIER,
    };
  }

  // For normal size, return symmetric hitbox
  return {
    left: baseSize,
    right: baseSize,
  };
}

function handleReadyPositions(room, player1, player2) {
  if (room.gameStart === false && room.hakkiyoiCount === 0) {
    // Only adjust player 1's ready position based on size power-up
    const player1ReadyX =
      player1.activePowerUp === POWER_UP_TYPES.SIZE ? 325 : 355;
    const player2ReadyX = 690;

    // Only move players if they're allowed to move (after salt throw)
    if (player1.canMoveToReady) {
      if (player1.x < player1ReadyX) {
        player1.x += 2; // Adjust speed as needed
        player1.isStrafing = true;
      } else {
        player1.x = player1ReadyX;
        // Only set isStrafing to false when we're setting isReady to true
        if (player2.x === player2ReadyX) {
          player1.isStrafing = false;
        }
      }
    }

    if (player2.canMoveToReady) {
      if (player2.x > player2ReadyX) {
        player2.x -= 2; // Adjust speed as needed
        player2.isStrafing = true;
      } else {
        player2.x = player2ReadyX;
        // Only set isStrafing to false when we're setting isReady to true
        if (player1.x === player1ReadyX) {
          player2.isStrafing = false;
        }
      }
    }

    // Set ready state when players reach their positions
    if (player1.x === player1ReadyX && player2.x === player2ReadyX) {
      player1.isReady = true;
      player2.isReady = true;

      // Start a timer to trigger hakkiyoi after 1 second of being ready
      if (!room.readyStartTime) {
        room.readyStartTime = Date.now();
      }

      const currentTime = Date.now();
      if (currentTime - room.readyStartTime >= 1000) {
        room.gameStart = true;
        room.hakkiyoiCount = 1;
        // Reset canMoveToReady for both players when game starts
        player1.canMoveToReady = false;
        player2.canMoveToReady = false;
        io.in(room.id).emit("game_start", true);
        player1.isReady = false;
        player2.isReady = false;
        room.readyStartTime = null;
      }
    }
  } else {
    // Clear ready states when game starts
    player1.isReady = false;
    player2.isReady = false;
    // Ensure canMoveToReady is false during gameplay
    player1.canMoveToReady = false;
    player2.canMoveToReady = false;
  }
}

function arePlayersColliding(player1, player2) {
  // If either player is dodging, return false immediately
  if (player1.isDodging || player2.isDodging) {
    return false;
  }

  // If either player is in recovery from a dodge + charged attack, allow collision checks
  const isRecoveringFromDodgeAttack = (player) => {
    return (
      player.isRecovering &&
      player.recoveryStartTime &&
      Date.now() - player.recoveryStartTime < player.recoveryDuration
    );
  };

  if (
    isRecoveringFromDodgeAttack(player1) ||
    isRecoveringFromDodgeAttack(player2)
  ) {
    return true;
  }

  if (
    player1.isGrabbing ||
    player2.isGrabbing ||
    player1.isBeingGrabbed ||
    player2.isBeingGrabbed
  ) {
    return false;
  }

  if (
    player1.isDodging ||
    player2.isDodging ||
    player1.isThrowing ||
    player2.isThrowing ||
    player1.isBeingThrown ||
    player2.isBeingThrown
  ) {
    return false;
  }

  // Calculate hitbox sizes based on power-up multiplier
  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  // Calculate hitbox centers
  const player1Center = player1.x;
  const player2Center = player2.x;

  const player1HitboxBounds = {
    left: player1Center - player1Hitbox.left,
    right: player1Center + player1Hitbox.right,
    top: player1.y - player1Hitbox.left,
    bottom: player1.y + player1Hitbox.left,
  };

  const player2HitboxBounds = {
    left: player2Center - player2Hitbox.left,
    right: player2Center + player2Hitbox.right,
    top: player2.y - player2Hitbox.left,
    bottom: player2.y + player2Hitbox.left,
  };

  return (
    player1HitboxBounds.left < player2HitboxBounds.right &&
    player1HitboxBounds.right > player2HitboxBounds.left &&
    player1HitboxBounds.top < player2HitboxBounds.bottom &&
    player1HitboxBounds.bottom > player2HitboxBounds.top
  );
}

function adjustPlayerPositions(player1, player2, delta) {
  // Calculate the overlap between players
  if (
    player1.isDodging ||
    player2.isDodging ||
    player1.isThrowing ||
    player2.isThrowing ||
    player1.isBeingThrown ||
    player2.isBeingThrown
  ) {
    return;
  }

  // Calculate hitbox sizes based on power-ups
  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  // Calculate the center points of each player's hitbox
  const player1Center = player1.x;
  const player2Center = player2.x;

  // Calculate the distance between centers
  const distanceBetweenCenters = Math.abs(player1Center - player2Center);

  // Calculate the minimum distance needed between centers to prevent overlap
  const minDistance = player1Hitbox.left + player2Hitbox.right;

  // Add extra distance for slap attacks to prevent collision during rapid attacks
  const extraSlapDistance = 20; // Fixed extra distance for slap attacks
  const finalMinDistance = (player1.isAttacking && player1.isSlapAttack) || 
                          (player2.isAttacking && player2.isSlapAttack) ? 
                          minDistance + extraSlapDistance : minDistance;

  // If players are overlapping
  if (distanceBetweenCenters < finalMinDistance) {
    // Calculate how much they need to move apart
    const overlap = finalMinDistance - distanceBetweenCenters;
    const adjustment = overlap / 2;

    // Significantly reduce the smoothFactor for more resistance during collisions
    const isRecovering = player1.isRecovering || player2.isRecovering;
    const smoothFactor = isRecovering ? delta * 0.02 : delta * 0.005; // Reduced from 0.05/0.01 to 0.02/0.005

    // Calculate new positions
    let newPlayer1X = player1.x;
    let newPlayer2X = player2.x;

    // Move players apart based on their relative positions
    if (player1.x < player2.x) {
      newPlayer1X -= adjustment * smoothFactor;
      newPlayer2X += adjustment * smoothFactor;
    } else {
      newPlayer1X += adjustment * smoothFactor;
      newPlayer2X -= adjustment * smoothFactor;
    }

    // Only apply movement resistance when players are moving towards each other
    if (!player1.isHit && !player1.isAlreadyHit && player1.movementVelocity) {
      // Check if player1 is moving towards player2
      const isMovingTowards =
        (player1.x < player2.x && player1.movementVelocity > 0) ||
        (player1.x > player2.x && player1.movementVelocity < 0);
      if (isMovingTowards) {
        player1.movementVelocity *= 0.85; // Add resistance to movement velocity
      }
    }
    if (!player2.isHit && !player2.isAlreadyHit && player2.movementVelocity) {
      // Check if player2 is moving towards player1
      const isMovingTowards =
        (player2.x < player1.x && player2.movementVelocity > 0) ||
        (player2.x > player1.x && player2.movementVelocity < 0);
      if (isMovingTowards) {
        player2.movementVelocity *= 0.85; // Add resistance to movement velocity
      }
    }

    // Enforce map boundaries for both players
    const leftBoundary = MAP_LEFT_BOUNDARY;
    const rightBoundary = MAP_RIGHT_BOUNDARY;

    // Only update positions if they stay within boundaries
    if (newPlayer1X >= leftBoundary && newPlayer1X <= rightBoundary) {
      player1.x = newPlayer1X;
    }
    if (newPlayer2X >= leftBoundary && newPlayer2X <= rightBoundary) {
      player2.x = newPlayer2X;
    }
  }
}

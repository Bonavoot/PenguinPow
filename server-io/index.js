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
}));

let index;
let gameLoop = null;
let staminaRegenCounter = 0;
const TICK_RATE = 64;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.25; // Increased from 0.22 for snappier movement
const GROUND_LEVEL = 215;
const HITBOX_DISTANCE_VALUE = 85; // Reduced from 90 by 20%
const SLAP_HITBOX_DISTANCE_VALUE = 88; // Reduced from 110 by 20%
const SLAP_PARRY_WINDOW = 150; // 150ms window for parry
const PARRY_KNOCKBACK_VELOCITY = 1.5; // Reduced knockback for parried attacks
const THROW_RANGE = 184; // Reduced from 230 by 20%
const GRAB_RANGE = 184; // Reduced from 230 by 20%
const GRAB_PUSH_SPEED = 0.3; // Increased from 0.2 for more substantial movement
const GRAB_PUSH_DURATION = 650;

// Add size power-up boundary multipliers
const SIZE_POWERUP_LEFT_MULTIPLIER = 1; // Changed from -0.7 to 1 for symmetry
const SIZE_POWERUP_RIGHT_MULTIPLIER = 1; // Changed from 2.5 to 1 for symmetry

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
const MAP_LEFT_BOUNDARY = 110;
const MAP_RIGHT_BOUNDARY = 965;
const MAP_RING_OUT_LEFT = 100;
const MAP_RING_OUT_RIGHT = 975;

// Add movement constants
const MOVEMENT_ACCELERATION = 0.25; // Increased for snappier acceleration
const MOVEMENT_DECELERATION = 0.35; // Increased for faster stops
const MAX_MOVEMENT_SPEED = 1.0; // Back to original for better control
const MOVEMENT_MOMENTUM = 0.85; // New constant for movement momentum
const MOVEMENT_FRICTION = 0.95; // Reduced friction for less floaty feel
const MOVEMENT_TURN_SPEED = 0.4; // Increased for faster direction changes

function resetRoomAndPlayers(room) {
  // Reset room state
  room.gameStart = false;
  room.gameOver = false;
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
    player.isDiving = false;
    player.isCrouching = false;
    player.isDodging = false;
    player.isReady = false;
    player.isHit = false;
    player.isAlreadyHit = false;
    player.isDead = false;
    player.stamina = 100;
    player.isBowing = false;
    player.x = player.fighter === "player 1" ? 230 : 815; // Updated to match salt throw range
    player.y = GROUND_LEVEL;
    player.knockbackVelocity = { x: 0, y: 0 };
    // Reset power-up state
    player.activePowerUp = null;
    player.powerUpMultiplier = 1;
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

        if (room.gameStart === false) {
          // Only adjust player 1's ready position based on size power-up
          const player1ReadyX =
            player1.activePowerUp === POWER_UP_TYPES.SIZE ? 325 : 355;

          if (player1.x >= player1ReadyX) {
            player1.x = player1ReadyX;
          }

          if (player2.x <= 690) {
            player2.x = 690;
          }

          if (player1.x === player1ReadyX) {
            player1.isReady = true;
          }

          if (player2.x === 690) {
            player2.isReady = true;
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

          // Calculate hitbox size based on power-up multiplier
          const player1Size =
            HITBOX_DISTANCE_VALUE * (player1.sizeMultiplier || 1);
          const player2Size =
            HITBOX_DISTANCE_VALUE * (player2.sizeMultiplier || 1);

          // Calculate hitbox centers
          const player1Center = player1.x;
          const player2Center = player2.x;

          const player1Hitbox = {
            left: player1Center - player1Size,
            right: player1Center + player1Size,
            top: player1.y - player1Size,
            bottom: player1.y + player1Size,
          };

          const player2Hitbox = {
            left: player2Center - player2Size,
            right: player2Center + player2Size,
            top: player2.y - player2Size,
            bottom: player2.y + player2Size,
          };

          return (
            player1Hitbox.left < player2Hitbox.right &&
            player1Hitbox.right > player2Hitbox.left &&
            player1Hitbox.top < player2Hitbox.bottom &&
            player1Hitbox.bottom > player2Hitbox.top
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
          const player1Size =
            HITBOX_DISTANCE_VALUE * (player1.sizeMultiplier || 1);
          const player2Size =
            HITBOX_DISTANCE_VALUE * (player2.sizeMultiplier || 1);

          // Calculate the center points of each player's hitbox
          const player1Center = player1.x;
          const player2Center = player2.x;

          // Calculate the distance between centers
          const distanceBetweenCenters = Math.abs(
            player1Center - player2Center
          );

          // Calculate the minimum distance needed between centers to prevent overlap
          const minDistance = player1Size + player2Size;

          // If players are overlapping
          if (distanceBetweenCenters < minDistance) {
            // Calculate how much they need to move apart
            const overlap = minDistance - distanceBetweenCenters;
            const adjustment = overlap / 2;

            // Increase adjustment speed during recovery states
            const isRecovering = player1.isRecovering || player2.isRecovering;
            const smoothFactor = isRecovering ? delta * 0.05 : delta * 0.01;

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

        if (player1.isAttacking) {
          checkCollision(player1, player2);
        }
        if (player2.isAttacking) {
          checkCollision(player2, player1);
        }

        if (
          player1.isReady &&
          player2.isReady &&
          !player1.isCrouching &&
          !player1.isStrafing &&
          !player1.isJumping &&
          !player1.isAttacking &&
          !player2.isCrouching &&
          !player2.isStrafing &&
          !player2.isJumping &&
          !player2.isAttacking
        ) {
          const currentTime = Date.now();
          if (!room.readyStartTime) {
            room.readyStartTime = currentTime;
          }

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
              player.knockbackVelocity = { x: 0, y: 0 };
            }
            const recoveryElapsed = Date.now() - player.recoveryStartTime;

            // Apply gravity to vertical knockback (increased gravity effect)
            player.knockbackVelocity.y -= 0.2 * delta;

            // Calculate effective boundary based on player size
            const sizeOffset =
              player.activePowerUp === POWER_UP_TYPES.SIZE
                ? HITBOX_DISTANCE_VALUE * (player.sizeMultiplier - 1)
                : 0;

            const leftBoundary =
              MAP_LEFT_BOUNDARY + sizeOffset * SIZE_POWERUP_LEFT_MULTIPLIER;
            const rightBoundary =
              MAP_RIGHT_BOUNDARY - sizeOffset * SIZE_POWERUP_RIGHT_MULTIPLIER;

            // Add slow forward movement during recovery if it's from a missed charged attack
            if (player.recoveryDirection) {
              const forwardDirection = player.recoveryDirection === 1 ? -1 : 1;
              const forwardSpeed = 0.3; // Slow forward movement speed
              const newX = player.x + forwardDirection * forwardSpeed * delta * speedFactor;
              
              // Only update position if within boundaries
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              }
            }

            // Apply horizontal knockback with boundary checks
            const newX = player.x + player.knockbackVelocity.x * delta * speedFactor;

            // Only update position if within boundaries
            if (newX >= leftBoundary && newX <= rightBoundary) {
              player.x = newX;
            }

            // Update vertical position (increased vertical movement)
            player.y += player.knockbackVelocity.y * delta * speedFactor * 2;

            // Ensure player doesn't go below ground level
            if (player.y < GROUND_LEVEL) {
              player.y = GROUND_LEVEL;
              player.knockbackVelocity.y = 0;
            }

            // Apply friction to horizontal knockback
            player.knockbackVelocity.x *= 0.95;

            // End recovery state after duration
            if (recoveryElapsed >= player.recoveryDuration) {
              player.isRecovering = false;
              player.knockbackVelocity = { x: 0, y: 0 };
              player.recoveryDirection = null; // Clear the recovery direction
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
          // Apply knockback without any boundary restrictions
          player.x += player.knockbackVelocity.x * delta * speedFactor;

          // Apply friction
          player.knockbackVelocity.x *= 0.875;

          // Reset hit state when knockback is nearly complete
          if (Math.abs(player.knockbackVelocity.x) < 0.1) {
            player.knockbackVelocity.x = 0;
            player.isHit = false;
          }
        }

        // Only apply boundary restrictions for normal player movement (walking/strafing)
        // Exclude hit, grab, throw, and being grabbed states
        if (
          !player.isHit &&
          !room.gameOver &&
          !player.isAttacking &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isThrowTeching &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isSlapAttack &&
          // Add condition to allow going out of bounds during charged attack
          !(player.isAttacking && !player.isSlapAttack)
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
          let currentDodgeSpeed = speedFactor * 2.5; // Base dodge speed

          // Apply speed power-up to dodge
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentDodgeSpeed *= player.powerUpMultiplier;
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
            !player.isHit) || // Add isHit check
          (!player.keys.s &&
            player.isSlapAttack &&
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isRecovering &&
            !player.isHit) // Add isHit check
        ) {
          let currentSpeedFactor = speedFactor;

          // Apply speed power-up
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentSpeedFactor *= player.powerUpMultiplier;
          }
          // Reduce speed when size power-up is active
          if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
            currentSpeedFactor *= 0.85; // 15% speed reduction
          }

          // Initialize movement velocity if it doesn't exist
          if (!player.movementVelocity) {
            player.movementVelocity = 0;
          }

          if (
            player.keys.d &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isRecovering
          ) {
            // Immediate direction change
            if (player.movementVelocity < 0) {
              player.movementVelocity = 0;
            }

            // Quick acceleration to max speed
            player.movementVelocity = Math.min(
              player.movementVelocity + MOVEMENT_ACCELERATION,
              MAX_MOVEMENT_SPEED
            );

            player.x += delta * currentSpeedFactor * player.movementVelocity;
            player.isStrafing = true;
            player.isReady = false;
          } else if (
            player.keys.a &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isRecovering
          ) {
            // Immediate direction change
            if (player.movementVelocity > 0) {
              player.movementVelocity = 0;
            }

            // Quick acceleration to max speed
            player.movementVelocity = Math.max(
              player.movementVelocity - MOVEMENT_ACCELERATION,
              -MAX_MOVEMENT_SPEED
            );

            player.x += delta * currentSpeedFactor * player.movementVelocity;
            player.isStrafing = true;
            player.isReady = false;
          } else {
            // Quick deceleration when no keys are pressed
            if (Math.abs(player.movementVelocity) > 0.01) {
              // Apply deceleration
              if (player.movementVelocity > 0) {
                player.movementVelocity = Math.max(
                  player.movementVelocity - MOVEMENT_DECELERATION,
                  0
                );
              } else {
                player.movementVelocity = Math.min(
                  player.movementVelocity + MOVEMENT_DECELERATION,
                  0
                );
              }

              // Apply remaining velocity
              if (!player.isRecovering) {
                player.x +=
                  delta * currentSpeedFactor * player.movementVelocity;
              }
            } else {
              // Snap to zero when velocity is very small
              player.movementVelocity = 0;
            }
          }

          // Update strafing state
          if (!player.keys.a && !player.keys.d) {
            player.isStrafing = false;
          }

          // Force stop strafing in certain states
          if (
            (!player.keys.a && !player.keys.d) ||
            player.isThrowTeching ||
            player.isRecovering ||
            (player.keys.a && player.keys.d)
          ) {
            player.isStrafing = false;
            // Immediate stop when forced
            player.movementVelocity = 0;
          }
        }
        if (
          (!player.keys.a && !player.keys.d) ||
          player.isThrowTeching ||
          player.isRecovering
        ) {
          // Add isRecovering check
          player.isStrafing = false;
        }
        if (player.keys.a && player.keys.d) {
          player.isStrafing = false;
        }
        // Diving / down or gravity
        if (
          (player.keys.s && player.y > GROUND_LEVEL) ||
          (player.y > GROUND_LEVEL && !player.isJumping)
        ) {
          player.y -= delta * speedFactor + 10;
          player.y = Math.max(player.y, GROUND_LEVEL);
          player.isDiving = player.keys.s;
        }

        if (player.y <= GROUND_LEVEL) {
          player.isDiving = false;
        }

        // Crouching
        if (
          player.keys.s &&
          player.y === GROUND_LEVEL &&
          !player.isGrabbing &&
          !player.isBeingGrabbed
        ) {
          player.isCrouching = true;
          player.isReady = false;
        }

        if (!player.keys.s) {
          player.isCrouching = false;
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

    const hitboxDistance = player.isSlapAttack
      ? SLAP_HITBOX_DISTANCE_VALUE
      : HITBOX_DISTANCE_VALUE;

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
        if (player.isSlapAttack && otherPlayer.isSlapAttack) {
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
    player.isParrying = true;

    // Apply reduced knockback
    player.knockbackVelocity.x = PARRY_KNOCKBACK_VELOCITY * knockbackDirection;
    player.knockbackVelocity.y = 0;

    // Set a brief recovery period
    setTimeout(() => {
      player.isHit = false;
      player.isAlreadyHit = false;
      player.isParrying = false;
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

    // For charged attacks, end the attack immediately on hit and set recovery
    if (!isSlapAttack) {
      // Reset all attack states first
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
      player.chargingFacingDirection = null;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;

      // Set recovery state immediately
      player.isRecovering = true;
      player.recoveryStartTime = Date.now();
      player.recoveryDuration = 400;
    } else {
      // For slap attacks, maintain the existing timing behavior
      const originalAttackEndTime = player.attackEndTime;
      const remainingAttackTime = originalAttackEndTime - currentTime;

      if (remainingAttackTime > 0) {
        setTimeout(() => {
          player.isAttacking = false;
          player.isSlapAttack = false;
          player.attackStartTime = 0;
          player.attackEndTime = 0;
          // Don't reset charging states for slap attacks
          // player.chargingFacingDirection = null;
          // player.isChargingAttack = false;
          // player.chargeStartTime = 0;
          // player.chargeAttackPower = 0;
        }, remainingAttackTime);
      }
    }

    // Check if the other player is blocking (crouching)
    if (otherPlayer.isCrouching) {
      // Apply knockback to the attacking player instead
      if (isSlapAttack) {
        const knockbackDirection = player.facing === 1 ? 1 : -1;
        player.knockbackVelocity.x =
          0.4375 * knockbackDirection * chargePercentage;
        player.knockbackVelocity.y = 0;
        player.isHit = true;

        // Emit screen shake for blocked slap
        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.3,
            duration: 200,
          });
        }
      } else {
        const knockbackDirection = player.facing === 1 ? 1 : -1;
        player.knockbackVelocity.x =
          0.1 * knockbackDirection * chargePercentage;
        player.knockbackVelocity.y = 0;
        player.isHit = true;

        // Emit screen shake for blocked charged attack
        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.5,
            duration: 300,
          });
        }
      }

      setTimeout(() => {
        player.isHit = false;
      }, 300);
    } else {
      // Apply the knockback to the defending player
      otherPlayer.isHit = true;
      otherPlayer.isJumping = false;
      otherPlayer.isAttacking = false;
      otherPlayer.isStrafing = false;
      otherPlayer.isDiving = false;

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
        otherPlayer.knockbackVelocity.x =
          6 * knockbackDirection * finalKnockbackMultiplier; // Fixed base knockback for slaps
      } else {
        // Reduced base knockback for charged attacks
        otherPlayer.knockbackVelocity.x =
          5 * knockbackDirection * finalKnockbackMultiplier; // Reduced from 7 to 5

        // Calculate attacker knockback based on charge percentage
        const attackerKnockbackDirection = -knockbackDirection;
        const attackerKnockbackMultiplier =
          0.3 + (chargePercentage / 100) * 0.5; // Reduced from 0.8 to 0.5

        player.knockbackVelocity.x =
          2 * attackerKnockbackDirection * attackerKnockbackMultiplier; // Reduced from 3 to 2
        player.knockbackVelocity.y = 3; // Reduced from 4 to 3

        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.7 + (chargePercentage / 100) * 0.2, // Reduced from 0.3 to 0.2
            duration: 250 + (chargePercentage / 100) * 100, // Reduced from 150 to 100
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
        isParrying: false,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isDiving: false,
        isCrouching: false,
        isDodging: false,
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
        isParrying: false,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isDiving: false,
        isCrouching: false,
        isDodging: false,
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
      io.in(data.roomId).emit("game_start", rooms[index]);
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

    if (rooms[index].gameOver && !rooms[index].matchOver) {
      return; // Skip all other actions if the game is over
    }

    // Block all actions if player is throwing salt
    if (player.isThrowingSalt) {
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
        !player.keys.s &&
        !player.isDodging &&
        !player.isAttacking &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        player.stamina >= 50
      ) {
        console.log("Executing immediate dodge");
        player.isDodging = true;
        player.dodgeStartTime = Date.now();
        player.dodgeEndTime = Date.now() + 400;
        player.stamina -= 50;
        player.dodgeStartX = player.x;
        player.dodgeStartY = player.y;

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
              player.stamina -= 50;
              player.dodgeDirection = action.direction;
              // Add these lines to set the dodge start position
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
        player.stamina >= 50
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
        player.isAttacking = false;
        player.isSlapAttack = false;
        player.chargingFacingDirection = null;

        // Check for buffered actions after attack ends
        if (player.bufferedAction && Date.now() < player.bufferExpiryTime) {
          console.log("Executing buffered action after attack");
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
            // Add these lines to set the dodge start position
            player.dodgeStartX = player.x;
            player.dodgeStartY = player.y;
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
        !player.isRecovering // Add recovery check
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
        !player.isRecovering // Add recovery check
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

      // Handle slap attacks with mouse1
      if (
        player.keys.mouse1 &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit
      ) {
        // Initialize slap buffer if it doesn't exist
        if (!player.slapBuffer) {
          player.slapBuffer = {
            lastSlapTime: 0,
            slapCooldown: 250,
            pendingSlaps: 0,
          };
        }

        const currentTime = Date.now();
        const timeSinceLastSlap = currentTime - player.slapBuffer.lastSlapTime;

        // If we're within the slap cooldown window, treat it as a slap attempt
        if (timeSinceLastSlap < player.slapBuffer.slapCooldown) {
          player.slapBuffer.pendingSlaps++;
          executeSlapAttack(player);
          return;
        }

        // Execute slap attack
        executeSlapAttack(player);
      }

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
        !player.isCrouching &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.throwCooldown
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
        !player.isCrouching &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.isThrowing &&
        !player.grabCooldown &&
        !player.isPushing &&
        !player.isBeingPushed &&
        !player.isBeingGrabbed && // Add this to prevent grab during grab animations
        !player.grabbedOpponent // Add this to prevent grab during grab animations
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

  if (winner.wins.length > 7) {
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
    }, 350);
  }

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

    // Only reset knockback for the winner
    if (p.id === winner.id) {
      p.knockbackVelocity = { x: 0, y: 0 };
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
}

// Add this new function near the other helper functions
function executeSlapAttack(player) {
  player.isSlapAttack = true;
  player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
  player.attackEndTime = Date.now() + 180;
  player.isAttacking = true;
  player.attackStartTime = Date.now();
  player.attackType = "slap";

  // Only update lastSlapTime if we're not already in a slap attack
  if (!player.isAttacking || !player.isSlapAttack) {
    player.slapBuffer.lastSlapTime = Date.now();
  }

  // Set a timeout to reset the attack state
  setTimeout(() => {
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.attackType = null;
  }, 180);
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

  // Lock facing direction during attack
  player.chargingFacingDirection = player.facing;
  if (player.chargingFacingDirection !== null) {
    player.facing = player.chargingFacingDirection;
  }

  // Reset charging state but keep the charge power for knockback
  player.isChargingAttack = false;
  player.chargeStartTime = 0;

  setTimeout(() => {
    const wasChargedAttack = player.attackType === "charged";
    const attackDirection = player.facing;
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;

    // Find the current room and opponent
    const currentRoom = rooms.find((room) => room.players.some((p) => p.id === player.id));
    if (currentRoom) {
      const opponent = currentRoom.players.find((p) => p.id !== player.id);
      
      // Add recovery state for missed charged attacks
      if (wasChargedAttack && opponent && !opponent.isHit) {
        player.isRecovering = true;
        player.recoveryStartTime = Date.now();
        player.recoveryDuration = 250;
        player.recoveryDirection = attackDirection;
      }
    }

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
  }, player.attackEndTime - Date.now());
}

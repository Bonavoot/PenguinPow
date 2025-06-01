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

// Import game utilities
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  TimeoutManager,
  timeoutManager,
  setPlayerTimeout,
  isPlayerInActiveState,
  isPlayerInBasicActiveState,
  canPlayerCharge,
  canPlayerUseAction,
  resetPlayerAttackStates,
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  shouldRestartCharging,
  startCharging,
  canPlayerSlap,
  clearChargeState
} = require("./gameUtils");

// Import game functions  
const {
  cleanupGrabStates,
  handleWinCondition,
  executeSlapAttack,
  cleanupRoom,
  executeChargedAttack,
  calculateEffectiveHitboxSize,
  handleReadyPositions,
  arePlayersColliding,
  adjustPlayerPositions,
  safelyEndChargedAttack
} = require("./gameFunctions");

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

// Add power-up types
const POWER_UP_TYPES = {
  SPEED: "speed",
  POWER: "power",
  SNOWBALL: "snowball",
};

// Add power-up effects
const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.4, // 20% speed increase
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase
  [POWER_UP_TYPES.SNOWBALL]: 1.0, // No stat multiplier, just projectile ability
};

const GRAB_DURATION = 1500; // 1.5 seconds total grab duration
const GRAB_ATTEMPT_DURATION = 1000; // 1 second for attempt animation

// Ring out boundary constants (map boundaries imported from gameUtils)
const MAP_RING_OUT_LEFT = 60;
const MAP_RING_OUT_RIGHT = 985;

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
const RAW_PARRY_SLAP_KNOCKBACK = 2; // Reduced knockback for slap attack parries
const RAW_PARRY_SLAP_STUN_DURATION = 500; // Reduced stun duration for slap attack parries
const PERFECT_PARRY_WINDOW = 100; // 100ms window for perfect parries
const DODGE_COOLDOWN = 2000; // 2 second cooldown between dodges
const MAX_DODGE_CHARGES = 2; // Maximum number of dodge charges


function handlePowerUpSelection(room) {
  // Reset power-up selection state for the room
  room.powerUpSelectionPhase = true;
  room.playersSelectedPowerUps = {};
  
  console.log(`Starting power-up selection for room ${room.id}`);
  
  // Emit power-up selection event to all players in the room
  io.in(room.id).emit("power_up_selection_start", {
    availablePowerUps: Object.values(POWER_UP_TYPES)
  });
}

function handleSaltThrowAndPowerUp(player, room) {
  // Set initial states for automatic salt throwing
  player.isThrowingSalt = true;
  player.saltCooldown = true;
  player.canMoveToReady = false; // New flag to control movement

  // Use selected power-up instead of random
  if (player.selectedPowerUp) {
    player.activePowerUp = player.selectedPowerUp;
    player.powerUpMultiplier = POWER_UP_EFFECTS[player.selectedPowerUp];

    // Emit power-up event to clients
    io.in(room.id).emit("power_up_activated", {
      playerId: player.id,
      powerUpType: player.selectedPowerUp,
    });
  }

  // Reset salt throwing state after animation
  setPlayerTimeout(player.id, () => {
    player.isThrowingSalt = false;
    player.saltCooldown = false;
    
    // Allow movement after salt throw is complete
    player.canMoveToReady = true;
  }, 500);
}

function resetRoomAndPlayers(room) {
  // Reset room state
  room.gameStart = false;
  room.gameOver = false;
  room.hakkiyoiCount = 0;
  room.gameOverTime = null;
  delete room.winnerId;
  delete room.loserId;

  // Start the 15-second timer for automatic power-up selection
  if (room.roundStartTimer) {
    clearTimeout(room.roundStartTimer);
  }
  room.roundStartTimer = setTimeout(() => {
    // Check if we're still in power-up selection phase
    if (room.powerUpSelectionPhase && room.players.length === 2) {
      console.log(`Timer expired, auto-selecting power-ups for room ${room.id}`);
      
      // Auto-select the first power-up (SPEED) for any players who haven't selected
      const availablePowerUps = Object.values(POWER_UP_TYPES);
      const firstPowerUp = availablePowerUps[0]; // This will be "speed"
      
      room.players.forEach((player) => {
        if (!player.selectedPowerUp) {
          console.log(`Auto-selecting ${firstPowerUp} for player ${player.id}`);
          player.selectedPowerUp = firstPowerUp;
          room.playersSelectedPowerUps[player.id] = firstPowerUp;
        }
      });
      
      // Check if all players now have selections (they should after auto-selection)
      const selectedCount = Object.keys(room.playersSelectedPowerUps).length;
      
      if (selectedCount === room.players.length) {
        // All players have selections, proceed with normal flow
        room.powerUpSelectionPhase = false;
        
        console.log(`Auto-selection complete, starting salt throwing in room ${room.id}`);
        
        // Emit that selection is complete
        io.in(room.id).emit("power_up_selection_complete");
        
        // Start salt throwing for both players
        room.players.forEach((player) => {
          handleSaltThrowAndPowerUp(player, room);
        });
      }
    }
  }, 15000);

  // Reset each player in the room
  room.players.forEach((player) => {
    player.isJumping = false;
    player.isAttacking = false;
    player.isStrafing = false;
    player.isRawParrying = false;
    player.rawParryStartTime = 0;
    player.rawParryMinDurationMet = false;
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
    player.selectedPowerUp = null;
    // Reset snowball state
    player.snowballs = [];
    player.snowballCooldown = false;
    player.lastSnowballTime = 0;
    player.isThrowingSnowball = false;
  });

  // Start power-up selection phase instead of automatic salt throwing
  handlePowerUpSelection(room);

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
    clearChargeState(player);
    clearChargeState(opponent);

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
    setPlayerTimeout(player.id, () => {
      player.isThrowTeching = false;
      opponent.isThrowTeching = false;
    }, THROW_TECH_DURATION);

    // Reset cooldown after longer duration
    setPlayerTimeout(player.id, () => {
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
        handleReadyPositions(room, player1, player2, io);

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
            // Clear the power-up auto-selection timer if players ready up normally
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
              if (player.mouse2HeldDuringAttack && player.keys.mouse2) {
                console.log(`Player ${player.id} restarting charge immediately after recovery ends (mouse2 was held during attack)`);
                // Restart charging immediately since player was holding mouse2 during attack
                player.isChargingAttack = true;
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
                player.attackType = "charged";
                player.mouse2HeldDuringAttack = false; // Clear the flag
              }
              // Otherwise check normal conditions for restart
              else if (player.keys.mouse2 && 
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
                  !player.canMoveToReady) {
                console.log(`Player ${player.id} restarting charge after recovery ends (normal conditions)`);
                // Restart charging immediately
                player.isChargingAttack = true;
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
                player.attackType = "charged";
              }
            }
          }
        });

        // Handle snowball updates
        [player1, player2].forEach((player) => {
          // Update snowball positions and check for collisions
          player.snowballs = player.snowballs.filter((snowball) => {
            // Move snowball
            snowball.x += snowball.velocityX * delta * speedFactor;
            
            // Check if snowball is off-screen
            if (snowball.x < -50 || snowball.x > 1330) {
              return false; // Remove snowball
            }
            
            // Check collision with opponent
            const opponent = room.players.find(p => p.id !== player.id);
            if (opponent && !opponent.isDodging && !snowball.hasHit) {
              const distance = Math.abs(snowball.x - opponent.x);
              if (distance < 50 && Math.abs(snowball.y - opponent.y) < 30) {
                // Hit opponent
                snowball.hasHit = true;
                opponent.isHit = true;
                opponent.isAlreadyHit = true;
                
                // Apply knockback
                const knockbackDirection = snowball.velocityX > 0 ? 1 : -1;
                opponent.knockbackVelocity.x = knockbackDirection * 3;
                opponent.movementVelocity = knockbackDirection * 2;
                
                // Reset hit state after duration
                setPlayerTimeout(opponent.id, () => {
                  opponent.isHit = false;
                  opponent.isAlreadyHit = false;
                }, 300);
                
                return false; // Remove snowball after hit
              }
            }
            
            return true; // Keep snowball
          });
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
        // Exclude hit, grab, throw, attack, and being grabbed states
        if (
          !player.isHit &&
          !room.gameOver &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isThrowTeching &&
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isSlapAttack &&
          !player.isAttacking // Add this crucial check to exclude all attacks
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
          const leftRingOutBoundary = MAP_RING_OUT_LEFT + sizeOffset;
          const rightRingOutBoundary = MAP_RING_OUT_RIGHT - sizeOffset;

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
          handleWinCondition(room, player, winner, io);
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
            const sizeOffset = 0;

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
                handleWinCondition(room, opponent, player, io);
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

              // Check if we should restart charging after throw completes
              if (shouldRestartCharging(player)) {
                // Restart charging immediately
                startCharging(player);
              }

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
        // Dodging
        if (player.isDodging) {
          let currentDodgeSpeed = speedFactor * 2.2; // Increased from 1.8 to 2.2 for better balance

          // Apply speed power-up to dodge with moderate multiplier
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentDodgeSpeed *= Math.min(player.powerUpMultiplier * 0.85, 1.5); // Increased multiplier and cap
          }
          // Reduce dodge speed when size power-up is active
          // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
          //   currentDodgeSpeed *= 0.85; // 15% speed reduction
          // }

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
          const sizeOffset = 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

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
            !player.isThrowingSnowball &&
            !player.isRawParrying &&
            !player.isHit) ||
          (!player.keys.s &&
            player.isSlapAttack &&
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed &&
            !player.isRecovering &&
            !player.isThrowingSnowball &&
            !player.isRawParrying &&
            !player.isHit)
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

          // Calculate effective boundary based on player size with different multipliers
          const sizeOffset = 0;

          // Apply different multipliers for left and right boundaries
          const leftBoundary = MAP_LEFT_BOUNDARY + sizeOffset;
          const rightBoundary = MAP_RIGHT_BOUNDARY - sizeOffset;

          if (
            player.keys.d &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isThrowingSnowball &&
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
            // Only set isReady to false if we're not in an attack state
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
          } else if (
            player.keys.a &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing &&
            !player.isRecovering &&
            !player.isRawParryStun &&
            !player.isRawParrying &&
            !player.isThrowingSnowball &&
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
            // Only set isReady to false if we're not in an attack state
            if (!player.isAttacking && !player.isChargingAttack) {
              player.isReady = false;
            }
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

          // Force stop strafing in certain states and add missing ground level check
          if (
            (!player.keys.a &&
              !player.keys.d &&
              (!player.canMoveToReady || room.gameStart)) ||
            player.isThrowTeching ||
            player.isRecovering ||
            (player.keys.a && player.keys.d) ||
            player.keys.mouse1 || // Add condition to prevent strafing while slapping
            player.isHit // Add isHit to force clear strafing when parried
          ) {
            player.isStrafing = false;
            // Don't immediately stop on ice unless hit
            if (!player.isHit) {
              player.movementVelocity *= MOVEMENT_FRICTION;
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
          player.isHit // Add isHit to force clear strafing when parried
        ) {
          // Add isRecovering and isHit checks
          player.isStrafing = false;
        }
        if (player.keys.a && player.keys.d) {
          player.isStrafing = false;
        }
        // Force clear strafing when hit (parried or otherwise)
        if (player.isHit) {
          player.isStrafing = false;
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
          // Start raw parry if not already parrying
          if (!player.isRawParrying) {
            player.isRawParrying = true;
            player.rawParryStartTime = Date.now();
            player.rawParryMinDurationMet = false;
          }
          // Only set isReady to false if we're not in an attack state
          if (!player.isAttacking && !player.isChargingAttack) {
            player.isReady = false;
          }
        }

        // Handle raw parry ending logic
        if (player.isRawParrying) {
          const parryDuration = Date.now() - player.rawParryStartTime;
          
          // Check if minimum duration has been met
          if (parryDuration >= 750) {
            player.rawParryMinDurationMet = true;
          }
          
          // Only end parry if s key is released AND minimum duration is met
          if (!player.keys.s && player.rawParryMinDurationMet) {
            player.isRawParrying = false;
            player.rawParryStartTime = 0;
            player.rawParryMinDurationMet = false;
          }
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
            // Use helper function to safely end charged attacks
            safelyEndChargedAttack(player, rooms);
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
              
              // Check if we should restart charging after grab completes
              if (player.keys.mouse2 && 
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
                  !player.canMoveToReady) {
                // Restart charging immediately
                player.isChargingAttack = true;
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
                player.attackType = "charged";
              }
              
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
            
            // Check if we should restart charging after missed grab completes
            if (player.keys.mouse2 && 
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
                !player.canMoveToReady) {
              // Restart charging immediately
              player.isChargingAttack = true;
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
              player.attackType = "charged";
            }
          }
        }

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
          player.sizeMultiplier = 1;
        // }

        // Update charge attack power in the game loop
        if (player.isChargingAttack) {
          const chargeDuration = Date.now() - player.chargeStartTime;
          player.chargeAttackPower = Math.min(
            (chargeDuration / 750) * 100,
            100
          ); // Changed from 1200 to 750 for faster charge
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
        setPlayerTimeout(player.id, () => {
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
      // Determine if this is a slap attack being parried
      const isSlapBeingParried = player.attackType === "slap" || isSlapAttack;
      
      // Check if this is a perfect parry (within 100ms of parry start)
      const currentTime = Date.now();
      const parryDuration = currentTime - otherPlayer.rawParryStartTime;
      const isPerfectParry = parryDuration <= PERFECT_PARRY_WINDOW;
      
      // Apply appropriate knockback based on attack type
      const knockbackAmount = isSlapBeingParried ? RAW_PARRY_SLAP_KNOCKBACK : RAW_PARRY_KNOCKBACK;
      
      // Apply knockback to the attacking player
      // Calculate knockback direction based on relative positions to ensure attacker is always pushed away from defender
      const knockbackDirection = player.x < otherPlayer.x ? -1 : 1;
      player.knockbackVelocity.x = knockbackAmount * knockbackDirection;
      player.knockbackVelocity.y = 0;
      player.isHit = true;
      
      // Clear all movement and action states when parried (like when getting hit)
      player.isStrafing = false;
      player.isJumping = false;
      player.isAttacking = false;

      // Clear movement velocity to ensure fixed knockback distance
      player.movementVelocity = 0;

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

      // Only apply stun for perfect parries
      if (isPerfectParry) {
        const stunDuration = isSlapBeingParried ? RAW_PARRY_SLAP_STUN_DURATION : RAW_PARRY_STUN_DURATION;
        player.isRawParryStun = true;

        // Emit screen shake for perfect parry with higher intensity
        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.9,
            duration: 400,
          });
          
          // Emit perfect parry event
          io.in(currentRoom.id).emit("perfect_parry", {
            parryingPlayerId: otherPlayer.id,
            attackingPlayerId: player.id,
            stunnedPlayerX: player.x,
            stunnedPlayerY: player.y,
            stunnedPlayerFighter: player.fighter, // Add fighter info to help with positioning
            showStarStunEffect: true // Explicit flag for the star stun effect
          });
        }

        // Reset stun after appropriate duration
        setPlayerTimeout(player.id, () => {
          player.isHit = false;
          player.isRawParryStun = false;
          
          // After stun ends, check if we should restart charging
          if (player.keys.mouse2 && 
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
              !player.canMoveToReady) {
            // Restart charging immediately
            player.isChargingAttack = true;
            player.chargeStartTime = Date.now();
            player.chargeAttackPower = 1;
            player.attackType = "charged";
          }
        }, stunDuration);
      } else {
        // Regular parry - no stun, just clear hit state quickly
        // Emit screen shake for regular parry with lower intensity
        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.5,
            duration: 200,
          });
        }

        // Clear hit state quickly for regular parries
        setPlayerTimeout(player.id, () => {
          player.isHit = false;
          
          // After knockback ends, check if we should restart charging
          if (player.keys.mouse2 && 
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
              !player.canMoveToReady) {
            // Restart charging immediately
            player.isChargingAttack = true;
            player.chargeStartTime = Date.now();
            player.chargeAttackPower = 1;
            player.attackType = "charged";
          }
        }, 300); // Short duration for regular parry recovery
      }
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
        finalKnockbackMultiplier = 0.55; // Increased from 0.5 to 0.55
      } else {
        // Reduced knockback scaling for charged attacks
        finalKnockbackMultiplier = 0.5 + (chargePercentage / 100) * 1.2; // Reduced from 2.0 to 1.2
      }

      // Apply power-up effects
      if (player.activePowerUp === POWER_UP_TYPES.POWER) {
        finalKnockbackMultiplier = finalKnockbackMultiplier * player.powerUpMultiplier;
      }
      // if (otherPlayer.activePowerUp === POWER_UP_TYPES.SIZE) {
      //   finalKnockbackMultiplier = finalKnockbackMultiplier * 0.85;
      // }

      if (isSlapAttack) {
        // Convert knockback to movement velocity for ice-like sliding
        otherPlayer.movementVelocity =
          3.85 * knockbackDirection * finalKnockbackMultiplier; // Increased from 3.5 to 3.85
        otherPlayer.knockbackVelocity.x = 0; // Clear knockback velocity since we're using movement

        // Add immediate position adjustment to prevent overlap
        const minDistance = SLAP_HITBOX_DISTANCE_VALUE * 0.8; // 80% of hitbox distance
        const currentDistance = Math.abs(player.x - otherPlayer.x);
        if (currentDistance < minDistance) {
          const adjustment =
            (minDistance - currentDistance) * knockbackDirection;
          otherPlayer.x += adjustment;
        }

        // Remove screen shake for slap attacks
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

      // Set a shorter hit state duration for slap attacks to allow for rapid hits
      const hitStateDuration = isSlapAttack ? 100 : 300;
      
      // Only set isAlreadyHit for charged attacks
      if (!isSlapAttack) {
        otherPlayer.isAlreadyHit = true;
      }

      // Clear hit state after duration
      setPlayerTimeout(otherPlayer.id, () => {
        otherPlayer.isHit = false;
        if (!isSlapAttack) {
          otherPlayer.isAlreadyHit = false;
        }
      }, hitStateDuration);
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
        snowballCooldown: false,
        lastSnowballTime: 0,
        snowballs: [],
        isThrowingSnowball: false,
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
        rawParryStartTime: 0,
        rawParryMinDurationMet: false,
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
        wantsToRestartCharge: false, // Add flag for charge restart detection
        mouse2HeldDuringAttack: false, // Add flag for simpler charge restart detection
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
        snowballCooldown: false,
        lastSnowballTime: 0,
        snowballs: [],
        isThrowingSnowball: false,
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
        rawParryStartTime: 0,
        rawParryMinDurationMet: false,
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
        wantsToRestartCharge: false, // Add flag for charge restart detection
        mouse2HeldDuringAttack: false, // Add flag for simpler charge restart detection
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
    
    // Find the player in the room
    const playerIndex = rooms[index].players.findIndex(
      (player) => player.id === data.playerId
    );

    if (playerIndex === -1) return; // Player not found in room

    if (data.isReady) {
      // Only increment if player wasn't already ready
      if (!rooms[index].players[playerIndex].isReady) {
        rooms[index].readyCount++;
        rooms[index].players[playerIndex].isReady = true;
      }
    } else {
      // Only decrement if player was ready
      if (rooms[index].players[playerIndex].isReady) {
        rooms[index].readyCount--;
        rooms[index].players[playerIndex].isReady = false;
      }
    }

    // Ensure ready count doesn't go below 0
    rooms[index].readyCount = Math.max(0, rooms[index].readyCount);

    io.in(data.roomId).emit("ready_count", rooms[index].readyCount);
    io.in(data.roomId).emit("lobby", rooms[index].players);

    if (rooms[index].readyCount > 1) {
      io.in(data.roomId).emit("initial_game_start", rooms[index]);
      console.log("Game started");
    }
  });

  socket.on("power_up_selected", (data) => {
    const { roomId, playerId, powerUpType } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    
    console.log(`Power-up selected: ${powerUpType} by player ${playerId} in room ${roomId}`);
    
    if (roomIndex === -1) return;
    
    const room = rooms[roomIndex];
    const player = room.players.find(p => p.id === playerId);
    
    if (!player || !room.powerUpSelectionPhase) return;
    
    // Store the player's power-up selection
    player.selectedPowerUp = powerUpType;
    room.playersSelectedPowerUps[playerId] = powerUpType;
    
    // Check if both players have selected their power-ups
    const selectedCount = Object.keys(room.playersSelectedPowerUps).length;
    
    console.log(`${selectedCount} out of ${room.players.length} players have selected power-ups`);
    
    if (selectedCount === 2) {
      // Both players have selected, proceed with salt throwing
      room.powerUpSelectionPhase = false;
      
      console.log(`All players selected, starting salt throwing in room ${roomId}`);
      
      // Emit that selection is complete
      io.in(roomId).emit("power_up_selection_complete");
      
      // Start salt throwing for both players
      room.players.forEach((player) => {
        handleSaltThrowAndPowerUp(player, room);
      });
    }
    
    // Emit updated selection status to all players
    io.in(roomId).emit("power_up_selection_status", {
      selectedCount,
      totalPlayers: room.players.length,
      selections: room.playersSelectedPowerUps
    });
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

    // Block all actions if player is moving to ready position
    if (player.canMoveToReady) {
      return;
    }

    // Block all inputs during salt throwing phase and ready positioning phase
    // This prevents inputs from power-up selection end until game start (hakkiyoi = 1)
    if (!rooms[index].gameStart || rooms[index].hakkiyoiCount === 0) {
      return;
    }

    if (data.keys) {
      player.keys = data.keys;
      
      // Debug logging for F key and snowball power-up
      if (data.keys.f) {
        console.log(`Player ${player.id} pressed F key. PowerUp: ${player.activePowerUp}, Cooldown: ${player.snowballCooldown}, isThrowingSnowball: ${player.isThrowingSnowball}`);
      }
    }

    // Handle clearing charge during active charged attacks - MUST BE FIRST
    if (
      player.keys.mouse1 &&
      player.isAttacking &&
      player.attackType === "charged" &&
      !player.wasMouse1Pressed
    ) {
      console.log(`Player ${player.id} interrupting charged attack with slap`);
      // Safely end the current charged attack (with recovery if needed)
      safelyEndChargedAttack(player, rooms);
      clearChargeState(player);
      
      // Execute slap attack immediately
      executeSlapAttack(player, rooms);
      return; // Exit early to prevent other input processing
    }
    
    // Handle clearing charge during active charged attacks with throw/grab/snowball - MUST BE FIRST
    if (
      (player.keys.w || player.keys.e || player.keys.f) &&
      player.isAttacking &&
      player.attackType === "charged"
    ) {
      console.log(`Player ${player.id} interrupting charged attack with W/E/F input`);
      // Safely end the current charged attack (with recovery if needed)
      safelyEndChargedAttack(player, rooms);
      clearChargeState(player);
      
      // The existing input handlers will take over for W/E/F
    }

    if (
      false && // Disabled: power-ups are now selected via UI
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

    // Handle snowball throwing
    if (
      player.keys.f &&
      player.activePowerUp === POWER_UP_TYPES.SNOWBALL &&
      !player.snowballCooldown &&
      !player.isThrowingSnowball &&
      !player.isAttacking &&
      !player.isDodging &&
      !player.isThrowing &&
      !player.isBeingThrown &&
      !player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.isHit &&
      !player.isRecovering &&
      !player.isRawParryStun &&
      !player.isRawParrying &&
      !player.canMoveToReady
    ) {
      console.log(`Player ${player.id} attempting to throw snowball`);
      const currentTime = Date.now();
      
      // Check 5 second cooldown
      if (currentTime - player.lastSnowballTime >= 5000) {
        console.log(`Player ${player.id} throwing snowball - cooldown passed`);
        
        // Clear charge attack state if player was charging
        if (player.isChargingAttack) {
          console.log(`Player ${player.id} cancelling charge attack to throw snowball`);
          clearChargeState(player);
        }
        
        // Set throwing state
        player.isThrowingSnowball = true;
        
        // Create snowball projectile
        const snowball = {
          id: Math.random().toString(36).substr(2, 9),
          x: player.x,
          y: player.y + 20, // Slightly above ground
          velocityX: player.facing === 1 ? -2 : 2, // Slow moving projectile
          hasHit: false,
          ownerId: player.id
        };
        
        player.snowballs.push(snowball);
        player.lastSnowballTime = currentTime;
        player.snowballCooldown = true;
        
        console.log(`Created snowball:`, snowball);
        
        // Reset throwing state and allow movement after 1 second
        setPlayerTimeout(player.id, () => {
          player.isThrowingSnowball = false;
          console.log(`Player ${player.id} finished throwing snowball`);
          
          // Check if we should restart charging after snowball throw completes
          if (shouldRestartCharging(player)) {
            // Restart charging immediately
            startCharging(player);
          }
        }, 500);
        
        // Reset cooldown after 5 seconds
        setPlayerTimeout(player.id, () => {
          player.snowballCooldown = false;
          console.log(`Player ${player.id} snowball cooldown reset`);
        }, 5000);
      } else {
        console.log(`Player ${player.id} snowball still on cooldown`);
      }
    }

    if (
      player.keys["shift"] &&
      !player.keys.e &&
      !player.keys.w &&
      canPlayerUseAction(player) &&
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
            executeChargedAttack(player, chargePercentage, rooms);
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
      !player.isThrowingSnowball &&
      !player.isRawParrying &&
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
      // Use helper function to safely end charged attacks
      safelyEndChargedAttack(player, rooms);
      
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

    // Start charging attack
    if (
      player.keys.mouse2 &&
      canPlayerCharge(player)
    ) {
      // Start charging
      startCharging(player);
      player.spacebarReleasedDuringDodge = false;
    }
    // For continuing a charge
    else if (
      player.keys.mouse2 &&
      (player.isChargingAttack || player.isDodging) &&
      !player.isHit &&
      !player.isRecovering && // Add recovery check
      !player.isRawParryStun &&
      !player.isThrowingSnowball
    ) {
      // If we're dodging and not already charging, start charging
      if (player.isDodging && !player.isChargingAttack) {
        startCharging(player);
      }
      // Calculate charge power (0-100%)
      const chargeDuration = Date.now() - player.chargeStartTime;
      player.chargeAttackPower = Math.min((chargeDuration / 750) * 100, 100);

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
    // Handle mouse2 held during active charged attack - check more broadly
    if (
      player.keys.mouse2 &&
      player.isAttacking &&
      player.attackType === "charged"
    ) {
      // Set flag to indicate player wants to restart charging after attack
      if (!player.wantsToRestartCharge) {
        console.log(`Player ${player.id} holding mouse2 during charged attack - setting restart flag`);
      }
      player.wantsToRestartCharge = true;
    }
    
    // Also check if mouse2 is being held when we're about to execute a charged attack
    if (
      player.keys.mouse2 &&
      player.pendingChargeAttack &&
      !player.isAttacking
    ) {
      console.log(`Player ${player.id} holding mouse2 with pending charge attack - setting restart flag`);
      player.wantsToRestartCharge = true;
    }
    // Release charged attack when mouse2 is released
    else if (
      !player.keys.mouse2 &&
      player.isChargingAttack &&
      !player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.isThrowing &&
      !player.isBeingThrown &&
      !player.isThrowingSnowball
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
        executeChargedAttack(player, player.chargeAttackPower, rooms);
      }
    }
    // Clear charging state if mouse2 is released and we're not in a valid state
    else if (!player.keys.mouse2 && player.isChargingAttack) {
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;
      player.chargingFacingDirection = null;
      player.attackType = null;
      player.mouse2HeldDuringAttack = false; // Clear flag when mouse2 is released
    }

    // Add new section to handle state transitions while holding mouse2
    if (
      player.keys.mouse2 &&
      canPlayerCharge(player) &&
      !player.isSlapAttack && // Add explicit check for slap attacks
      !player.isJumping // Add explicit check for jumping
    ) {
      // Check if we should resume charging after a state transition
      const timeSinceLastCharge =
        Date.now() - (player.lastChargeEndTime || 0);
      
      // Only auto-resume if it's been less than 500ms since last charge ended
      // This prevents the weird reset behavior
      if (timeSinceLastCharge < 500 && timeSinceLastCharge > 0) {
        // Resume charging if very recent charge history
        player.isChargingAttack = true;
        player.chargeStartTime = Date.now();
        player.chargeAttackPower = Math.min(player.lastChargePower || 0, 100);
        player.attackType = "charged";
      }
      // Remove the "else" clause that was auto-starting fresh charges
      // This was causing the unwanted charge resets
    }

    // Store charge state when clearing it
    if (player.isChargingAttack && !player.keys.mouse2) {
      player.lastChargeEndTime = Date.now();
      player.lastChargePower = player.chargeAttackPower;
    }

    // Handle slap attacks with mouse1
    if (
      player.keys.mouse1 &&
      canPlayerSlap(player) &&
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
      executeSlapAttack(player, rooms);
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
      canPlayerUseAction(player) &&
      !player.throwCooldown &&
      !player.isRawParrying &&
      !player.isJumping
    ) {
      // Reset any lingering throw states before starting a new throw
      player.throwingFacingDirection = null;
      player.throwStartTime = 0;
      player.throwEndTime = 0;
      player.throwOpponent = null;

      player.lastThrowAttemptTime = Date.now();

      setPlayerTimeout(player.id, () => {
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
            clearChargeState(player);

            player.isThrowing = true;
            player.throwStartTime = Date.now();
            player.throwEndTime = Date.now() + 400;
            player.throwOpponent = opponent.id;
            opponent.isBeingThrown = true;
            opponent.isHit = true;

            player.throwCooldown = true;
            setPlayerTimeout(player.id, () => {
              player.throwCooldown = false;
            }, 250);
          }
        } else {
          clearChargeState(player);

          player.isThrowing = true;
          player.throwStartTime = Date.now();
          player.throwEndTime = Date.now() + 400;

          player.throwCooldown = true;
          setPlayerTimeout(player.id, () => {
            player.throwCooldown = false;
          }, 250);
        }
      }, 64);
    }

    // In the grabbing section, update the if condition and add cooldown:
    if (
      player.keys.e &&
      canPlayerUseAction(player) &&
      !player.grabCooldown &&
      !player.isPushing &&
      !player.isBeingPushed &&
      !player.grabbedOpponent &&
      !player.isRawParrying &&
      !player.isJumping
    ) {
      player.lastGrabAttemptTime = Date.now();

      setPlayerTimeout(player.id, () => {
        const opponent = rooms[index].players.find((p) => p.id !== player.id);
        // Clear charging attack state regardless of grab success
        clearChargeState(player);

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
            clearChargeState(player);

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
            setPlayerTimeout(player.id, () => {
              player.grabCooldown = false;
            }, 1100);
          }
        } else {
          player.isGrabbing = true;
          player.grabStartTime = Date.now();

          // Only set cooldown if the grab was actually attempted
          if (isOpponentCloseEnoughForGrab(player, opponent)) {
            player.grabCooldown = true;
            setPlayerTimeout(player.id, () => {
              player.grabCooldown = false;
            }, 1100);
          }
        }
      }, 64);
    }
  });

  socket.on("leave_room", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Remove the player from the room
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      // Reset ready count and player ready states
      rooms[roomIndex].readyCount = 0;
      rooms[roomIndex].players.forEach(player => {
        player.isReady = false;
      });

      // Clean up the room state
      cleanupRoomState(rooms[roomIndex]);

      // Reorder remaining players to ensure they're in the correct slots
      if (rooms[roomIndex].players.length === 1) {
        // If there's only one player left, ensure they're player 1
        const p = rooms[roomIndex].players[0];
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 230;
        p.facing = 1;
      }

      // Emit updates to all clients
      io.in(roomId).emit("player_left");
      io.in(roomId).emit("ready_count", 0);
      io.to(roomId).emit("lobby", rooms[roomIndex].players);
      io.emit("rooms", getCleanedRoomsData(rooms));

      // Leave the socket room
      socket.leave(roomId);
    }
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    // Clean up timeouts for the disconnecting player
    timeoutManager.clearPlayer(socket.id);

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

      // If there's only one player left, ensure they're player 1
      if (rooms[roomIndex].players.length === 1) {
        const p = rooms[roomIndex].players[0];
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 230;
        p.facing = 1;
      }

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

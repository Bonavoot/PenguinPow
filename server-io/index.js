const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
const e = require("express");
const app = express();
app.use(cors());

const server = http.createServer(app);

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
const speedFactor = 0.3;
const GROUND_LEVEL = 145;
const HITBOX_DISTANCE_VALUE = 90;
const SLAP_HITBOX_DISTANCE_VALUE = 110;
const SLAP_PARRY_WINDOW = 150; // 150ms window for parry
const PARRY_KNOCKBACK_VELOCITY = 1.5; // Reduced knockback for parried attacks
const THROW_RANGE = 230; // Maximum distance for throw to be possible
const GRAB_RANGE = 230; // Maximum distance for grab to be possible

// Add power-up types
const POWER_UP_TYPES = {
  SPEED: "speed",
  POWER: "power",
  SIZE: "size",
};

// Add power-up effects
const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.2, // 20% speed increase
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase
  [POWER_UP_TYPES.SIZE]: 1.15, // 15% size increase
};

const GRAB_DURATION = 1500; // 1.5 seconds total grab duration
const GRAB_ATTEMPT_DURATION = 1000; // 1 second for attempt animation
const GRAB_PUSH_DISTANCE = 50; // Distance to push opponent
const GRAB_PULL_DISTANCE = 50; // Distance to pull opponent
const GRAB_PUSH_SPEED = 0.5; // Increased from 0.2 for more substantial movement
const GRAB_PULL_SPEED = 0.5; // Increased from 0.1 for faster movement
const GRAB_PUSH_DURATION = 500;
const GRAB_PULL_DURATION = 750; // Reduced from 1500ms to 750ms
const GRAB_HOP_HEIGHT = 50; // Reduced from 100 to make the hop less pronounced
const GRAB_HOP_SPEED = 0.1;

// Add new grab states
const GRAB_STATES = {
  INITIAL: "initial",
  ATTEMPTING: "attempting",
  SUCCESS: "success",
  COUNTERED: "countered",
};

// Add grab attempt types
const GRAB_ATTEMPT_TYPES = {
  THROW: "throw",
  PULL: "pull",
  PUSH: "push",
  SLAPDOWN: "slapdown",
};

// Add grab attempt to counter mapping
const GRAB_COUNTER_MAPPING = {
  [GRAB_ATTEMPT_TYPES.THROW]: "s",
  [GRAB_ATTEMPT_TYPES.PULL]: "d",
  [GRAB_ATTEMPT_TYPES.PUSH]: "a",
  [GRAB_ATTEMPT_TYPES.SLAPDOWN]: "w",
};

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
    player.x = player.fighter === "player 1" ? 50 : 950; // Updated to match salt throw range
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
      tick(delta);
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
    opponent.isThrowing = false;
    opponent.isGrabbing = false;
    opponent.isBeingThrown = false;
    opponent.isBeingGrabbed = false;

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

        // Handle pull animation
        if (player1.isBeingPulled) {
          const pullProgress =
            (Date.now() - player1.pullStartTime) / GRAB_PULL_DURATION;

          if (pullProgress < 1) {
            // Calculate hop height using reverse sine wave, ensuring it never goes below GROUND_LEVEL
            const hopProgress = pullProgress * Math.PI * 2;
            const hopHeight = Math.max(
              0,
              Math.sin(hopProgress) * player1.pullHopHeight
            );

            // Move horizontally with continuous knockback
            const newX =
              player1.x + player1.pullDirection * player1.pullSpeed * delta;

            // Check if we've hit a boundary
            const sizeOffset =
              player1.activePowerUp === POWER_UP_TYPES.SIZE
                ? HITBOX_DISTANCE_VALUE * (player1.powerUpMultiplier - 1)
                : 0;

            const leftBoundary = -40 + sizeOffset;
            const rightBoundary = 1050 - sizeOffset;

            if (newX >= leftBoundary && newX <= rightBoundary) {
              player1.x = newX;
              player1.y = GROUND_LEVEL + hopHeight;
            } else {
              // Stop the animation if we hit a boundary
              player1.isBeingPulled = false;
              player1.y = GROUND_LEVEL;
              // Reset grab states when animation ends
              const opponent = room.players.find((p) => p.id !== player1.id);
              if (opponent) {
                opponent.isGrabbing = false;
                opponent.grabbedOpponent = null;
                opponent.grabState = GRAB_STATES.INITIAL;
                opponent.grabAttemptType = null;
                opponent.grabAttemptStartTime = null;
              }
            }
          } else {
            // Animation complete
            player1.isBeingPulled = false;
            player1.y = GROUND_LEVEL;
            // Reset grab states when animation ends
            const opponent = room.players.find((p) => p.id !== player1.id);
            if (opponent) {
              opponent.isGrabbing = false;
              opponent.grabbedOpponent = null;
              opponent.grabState = GRAB_STATES.INITIAL;
              opponent.grabAttemptType = null;
              opponent.grabAttemptStartTime = null;
            }
          }
        }

        // Handle push animation
        if (
          player1.isPushing ||
          player1.isBeingPushed ||
          player2.isPushing ||
          player2.isBeingPushed
        ) {
          const pushProgress =
            (Date.now() - (player1.pushStartTime || player2.pushStartTime)) /
            GRAB_PUSH_DURATION;

          if (pushProgress < 1) {
            // Move both players together without boundary restrictions
            const pushSpeed = GRAB_PUSH_SPEED * delta;
            player1.x += (player1.pushDirection || 0) * pushSpeed;
            player2.x += (player2.pushDirection || 0) * pushSpeed;

            // Check for ring-out win condition for both players
            if (
              ((player2.x <= -60 || player2.x >= 1080) &&
                !player1.hasScoredPoint) ||
              ((player1.x <= -60 || player1.x >= 1080) &&
                !player2.hasScoredPoint)
            ) {
              const pushedOutPlayer =
                player2.x <= -60 || player2.x >= 1080 ? player2 : player1;
              const winner = pushedOutPlayer === player2 ? player1 : player2;

              winner.hasScoredPoint = true; // Set flag to prevent multiple points
              room.gameOver = true;
              winner.wins.push("w");

              if (winner.wins.length > 7) {
                io.in(room.id).emit("match_over", {
                  isMatchOver: true,
                  winner: winner.fighter,
                });
                room.matchOver = true;
                winner.wins = [];
                pushedOutPlayer.wins = [];
              } else {
                setTimeout(() => {
                  winner.isBowing = true;
                  pushedOutPlayer.isBowing = true;
                }, 350);
              }

              // Clean up all grab-related states for both players
              player1.isGrabbing = false;
              player1.isPushing = false;
              player1.grabbedOpponent = null;
              player1.grabState = GRAB_STATES.INITIAL;
              player1.grabAttemptType = null;
              player1.grabAttemptStartTime = null;

              player2.isGrabbing = false;
              player2.isPushing = false;
              player2.grabbedOpponent = null;
              player2.grabState = GRAB_STATES.INITIAL;
              player2.grabAttemptType = null;
              player2.grabAttemptStartTime = null;

              player1.isBeingGrabbed = false;
              player1.isBeingPushed = false;
              player2.isBeingGrabbed = false;
              player2.isBeingPushed = false;

              io.in(room.id).emit("game_over", {
                isGameOver: true,
                winner: {
                  id: winner.id,
                  fighter: winner.fighter,
                },
                wins: winner.wins.length,
              });
              room.winnerId = winner.id;
              room.loserId = pushedOutPlayer.id;
              room.gameOverTime = Date.now();

              // Reset all key states for both players
              room.players.forEach((p) => {
                const currentX = p.x;
                p.isStrafing = false;
                p.knockbackVelocity = { x: 0, y: 0 };
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
            }
          } else {
            // Animation complete
            player1.isPushing = false;
            player1.isGrabbing = false;
            player2.isBeingPushed = false;
            player2.isBeingGrabbed = false;

            // Reset all grab and push states for both players
            [player1, player2].forEach((player) => {
              player.isGrabbing = false;
              player.isBeingGrabbed = false;
              player.isPushing = false;
              player.isBeingPushed = false;
              player.grabbedOpponent = null;
              player.grabState = GRAB_STATES.INITIAL;
              player.grabAttemptType = null;
              player.grabAttemptStartTime = null;
              player.grabCooldown = false; // Explicitly reset cooldown
              player.pushStartTime = null;
              player.pushEndTime = null;
              player.pushDirection = null;
              player.pushSpeed = null;
              player.hasScoredPoint = false;
            });
          }
        } else if (player1.isGrabbing && player1.grabbedOpponent) {
          // Only handle grab state if not pushing
          const opponent = room.players.find(
            (p) => p.id === player1.grabbedOpponent
          );
          if (opponent) {
            // Keep opponent at fixed distance during grab
            const fixedDistance = 90 * (opponent.sizeMultiplier || 1);
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
            player1.activePowerUp === POWER_UP_TYPES.SIZE ? 250 : 275;

          if (player1.x >= player1ReadyX) {
            player1.x = player1ReadyX;
          }

          if (player2.x <= 715) {
            player2.x = 715;
          }

          if (player1.x === player1ReadyX) {
            player1.isReady = true;
          }

          if (player2.x === 715) {
            player2.isReady = true;
          }
        }

        function arePlayersColliding(player1, player2) {
          // If either player is dodging, return false immediately
          if (player1.isDodging || player2.isDodging) {
            return false;
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

          const player1Hitbox = {
            left: player1.x - player1Size,
            right: player1.x + player1Size,
            top: player1.y - player1Size,
            bottom: player1.y + player1Size,
          };

          const player2Hitbox = {
            left: player2.x - player2Size,
            right: player2.x + player2Size,
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

          const overlap =
            Math.min(player1.x + player1Size, player2.x + player2Size) -
            Math.max(player1.x - player1Size, player2.x - player2Size);

          if (overlap > 0) {
            // Calculate adjustment value (half the overlap so both players move equally)
            const adjustment = overlap / 2;
            const smoothFactor = delta * 0.01; // Adjust this value to make the movement smoother or more abrupt

            // Calculate new positions
            let newPlayer1X = player1.x;
            let newPlayer2X = player2.x;

            // Determine the direction to move each player
            if (player1.x < player2.x) {
              newPlayer1X -= adjustment * smoothFactor;
              newPlayer2X += adjustment * smoothFactor;
            } else {
              newPlayer1X += adjustment * smoothFactor;
              newPlayer2X -= adjustment * smoothFactor;
            }

            // Enforce map boundaries for both players
            const leftBoundary = -40;
            const rightBoundary = 1050;

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
      }

      // Players Loop
      room.players.forEach((player) => {
        if (room.gameOver && player.id === room.loserId) {
          return;
        }

        // Handle knockback movement with NO boundary restrictions
        if (player.isHit) {
          // Apply knockback without any boundary restrictions
          player.x += player.knockbackVelocity.x * delta * speedFactor;

          // Apply friction
          player.knockbackVelocity.x *= 0.9;

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
          !player.isBeingGrabbed
        ) {
          // Calculate effective boundary based on player size
          const sizeOffset =
            player.activePowerUp === POWER_UP_TYPES.SIZE
              ? HITBOX_DISTANCE_VALUE * (player.powerUpMultiplier - 1)
              : 0;

          // Enforce boundaries for both normal movement and strafing
          const leftBoundary = -40 + sizeOffset;
          const rightBoundary = 1050 - sizeOffset;

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
          // Calculate effective boundary based on player size
          const sizeOffset =
            player.activePowerUp === POWER_UP_TYPES.SIZE
              ? HITBOX_DISTANCE_VALUE * (player.powerUpMultiplier - 1)
              : 0;

          player.x = Math.max(
            -60 + sizeOffset,
            Math.min(player.x, 1080 - sizeOffset)
          );
        }

        // Win Conditions - back to original state
        if (
          (player.isHit && player.x <= -60 && !room.gameOver) ||
          (player.isHit && player.x >= 1080 && !room.gameOver) ||
          (player.isAttacking &&
            !player.isSlapAttack &&
            player.x <= -60 &&
            !room.gameOver &&
            player.facing === -1) || // Only allow ring out if facing left
          (player.isAttacking &&
            !player.isSlapAttack &&
            player.x >= 1080 &&
            !room.gameOver &&
            player.facing === 1) || // Only allow ring out if facing right
          (player.isBeingThrown &&
            !room.gameOver &&
            ((player.x <= -40 && player.throwerX < 540) ||
              (player.x >= 1050 && player.throwerX > 540)))
        ) {
          console.log("game over");
          room.gameOver = true;
          player.y = GROUND_LEVEL;
          const winner = room.players.find((p) => p.id !== player.id);
          winner.wins.push("w");

          if (winner.wins.length > 7) {
            io.in(room.id).emit("match_over", {
              isMatchOver: true,
              winner: winner.fighter,
            });
            room.matchOver = true;
            winner.wins = [];
            player.wins = [];
          } else {
            setTimeout(() => {
              winner.isBowing = true;
              player.isBowing = true;
            }, 350);
          }

          // Reset all key states for both players
          room.players.forEach((p) => {
            const currentX = p.x;
            p.isStrafing = false;
            p.knockbackVelocity = { x: 0, y: 0 };
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
          room.loserId = player.id;
          if (!room.gameOverTime) {
            room.gameOverTime = Date.now();
          }
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

        if (player.isHit) return;

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
            const throwDistance = 150;
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
                ? HITBOX_DISTANCE_VALUE * (opponent.powerUpMultiplier - 1)
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
                (opponent.x <= -40 && player.x < 540) ||
                (opponent.x >= 1050 && player.x > 540)
              ) {
                room.gameOver = true;
                const winner = room.players.find((p) => p.id !== opponent.id);
                winner.wins.push("w");

                if (winner.wins.length > 7) {
                  io.in(room.id).emit("match_over", {
                    isMatchOver: true,
                    winner: winner.fighter,
                  });
                  room.matchOver = true;
                  winner.wins = [];
                  opponent.wins = [];
                } else {
                  setTimeout(() => {
                    winner.isBowing = true;
                    opponent.isBowing = true;
                  }, 350);
                }

                // Reset all key states for both players
                room.players.forEach((p) => {
                  const currentX = p.x;
                  p.isStrafing = false;
                  p.knockbackVelocity = { x: 0, y: 0 };
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
                room.loserId = opponent.id;
                if (!room.gameOverTime) {
                  room.gameOverTime = Date.now();
                }
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

          player.x += player.dodgeDirection * delta * currentDodgeSpeed;

          if (Date.now() >= player.dodgeEndTime) {
            player.isDodging = false;
            player.dodgeDirection = null;
          }
        }

        // Strafing
        if (
          (!player.keys.s &&
            !player.isAttacking &&
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed) ||
          (!player.keys.s &&
            player.isSlapAttack &&
            player.saltCooldown === false &&
            !player.isThrowTeching &&
            !player.isGrabbing &&
            !player.isBeingGrabbed)
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

          if (
            player.keys.d &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing
          ) {
            player.x += delta * currentSpeedFactor;
            player.isStrafing = true;
            player.isReady = false;
          }
          if (
            player.keys.a &&
            !player.isDodging &&
            !player.isThrowing &&
            !player.isGrabbing
          ) {
            player.x -= delta * currentSpeedFactor;
            player.isStrafing = true;
            player.isReady = false;
          }
          if (!player.keys.a && !player.keys.d) {
            player.isStrafing = false;
          }
        }
        if ((!player.keys.a && !player.keys.d) || player.isThrowTeching) {
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

            // Handle grab state
            if (player.grabState === GRAB_STATES.INITIAL) {
              // Check for grab attempt inputs
              if (player.keys.w) {
                player.grabState = GRAB_STATES.ATTEMPTING;
                player.grabAttemptType = GRAB_ATTEMPT_TYPES.THROW;
                player.grabAttemptStartTime = Date.now();
              } else if (
                (player.keys.a && player.facing === -1) ||
                (player.keys.d && player.facing === 1)
              ) {
                // Dynamic pull input
                player.grabState = GRAB_STATES.ATTEMPTING;
                player.grabAttemptType = GRAB_ATTEMPT_TYPES.PULL;
                player.grabAttemptStartTime = Date.now();
              } else if (
                (player.keys.d && player.facing === -1) ||
                (player.keys.a && player.facing === 1)
              ) {
                // Dynamic push input
                player.grabState = GRAB_STATES.ATTEMPTING;
                player.grabAttemptType = GRAB_ATTEMPT_TYPES.PUSH;
                player.grabAttemptStartTime = Date.now();
              } else if (player.keys.s) {
                player.grabState = GRAB_STATES.ATTEMPTING;
                player.grabAttemptType = GRAB_ATTEMPT_TYPES.SLAPDOWN;
                player.grabAttemptStartTime = Date.now();
              }
            } else if (player.grabState === GRAB_STATES.ATTEMPTING) {
              const attemptDuration = Date.now() - player.grabAttemptStartTime;

              // Check if attempt duration exceeded
              if (attemptDuration >= GRAB_ATTEMPT_DURATION) {
                // Check if opponent countered
                const requiredCounter =
                  GRAB_COUNTER_MAPPING[player.grabAttemptType];
                if (opponent.keys[requiredCounter]) {
                  // Successful counter
                  player.grabState = GRAB_STATES.COUNTERED;
                  cleanupGrabStates(player, opponent);

                  // Apply tech animation
                  opponent.isHit = true;
                  setTimeout(() => {
                    opponent.isHit = false;
                  }, 300);
                } else {
                  // Failed counter, execute grab move
                  player.grabState = GRAB_STATES.SUCCESS;

                  switch (player.grabAttemptType) {
                    case GRAB_ATTEMPT_TYPES.THROW:
                      // Start throw animation
                      player.isThrowing = true;
                      player.throwStartTime = Date.now();
                      player.throwEndTime = Date.now() + 400;
                      player.throwOpponent = opponent.id;
                      opponent.isBeingThrown = true;
                      opponent.isHit = true;
                      break;

                    case GRAB_ATTEMPT_TYPES.PULL:
                      // Start pull animation
                      const pullDirection = player.facing;

                      // Switch facing directions
                      opponent.facing *= -1;
                      player.facing *= -1;

                      // Set up pull animation state
                      opponent.isBeingPulled = true;
                      opponent.pullStartTime = Date.now();
                      opponent.pullEndTime = Date.now() + GRAB_PULL_DURATION;
                      opponent.pullDirection = pullDirection;
                      opponent.pullSpeed = GRAB_PULL_SPEED;
                      opponent.pullHopHeight = GRAB_HOP_HEIGHT;
                      opponent.pullHopSpeed = GRAB_HOP_SPEED;

                      // Move the opponent to the other side
                      const distance = 200; // Distance to move the opponent
                      opponent.x = player.x + pullDirection * distance;

                      // Keep the grab state active during pull
                      player.isGrabbing = true;
                      opponent.isBeingGrabbed = true;
                      break;

                    case GRAB_ATTEMPT_TYPES.PUSH:
                      // Start push animation
                      const pushDirection = -player.facing;

                      // Set up push animation state for both players
                      player.isPushing = true;
                      player.isGrabbing = true;
                      opponent.isBeingPushed = true;
                      opponent.isBeingGrabbed = true;
                      player.pushStartTime = Date.now();
                      player.pushEndTime = Date.now() + GRAB_PUSH_DURATION;
                      opponent.pushStartTime = Date.now();
                      opponent.pushEndTime = Date.now() + GRAB_PUSH_DURATION;
                      player.pushDirection = pushDirection;
                      opponent.pushDirection = pushDirection;
                      player.pushSpeed = GRAB_PUSH_SPEED;
                      opponent.pushSpeed = GRAB_PUSH_SPEED;
                      player.hasScoredPoint = false; // Add flag to track if point has been scored

                      // Set initial positions
                      const fixedDistance = 90;
                      if (player.facing === 1) {
                        opponent.x = player.x - fixedDistance;
                      } else {
                        opponent.x = player.x + fixedDistance;
                      }

                      // Move both players initially
                      player.x += pushDirection * 50;
                      opponent.x += pushDirection * 50;
                      break;

                    case GRAB_ATTEMPT_TYPES.SLAPDOWN:
                      // Instant win
                      room.gameOver = true;
                      const winner = player;
                      winner.wins.push("w");

                      if (winner.wins.length > 7) {
                        io.in(room.id).emit("match_over", {
                          isMatchOver: true,
                          winner: winner.fighter,
                        });
                        room.matchOver = true;
                        winner.wins = [];
                        opponent.wins = [];
                      } else {
                        setTimeout(() => {
                          winner.isBowing = true;
                          opponent.isBowing = true;
                        }, 350);
                      }

                      // Clean up all grab-related states for both players
                      player.isGrabbing = false;
                      player.isPushing = false;
                      player.grabbedOpponent = null;
                      player.grabState = GRAB_STATES.INITIAL;
                      player.grabAttemptType = null;
                      player.grabAttemptStartTime = null;

                      opponent.isBeingGrabbed = false;
                      opponent.isBeingPushed = false;
                      opponent.grabbedOpponent = null;
                      opponent.grabState = GRAB_STATES.INITIAL;
                      opponent.grabAttemptType = null;
                      opponent.grabAttemptStartTime = null;

                      io.in(room.id).emit("game_over", {
                        isGameOver: true,
                        winner: {
                          id: winner.id,
                          fighter: winner.fighter,
                        },
                        wins: winner.wins.length,
                      });
                      room.winnerId = winner.id;
                      room.loserId = opponent.id;
                      room.gameOverTime = Date.now();

                      // Reset all key states for both players
                      room.players.forEach((p) => {
                        const currentX = p.x;
                        p.isStrafing = false;
                        p.knockbackVelocity = { x: 0, y: 0 };
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
                      break;
                  }

                  // Don't reset grab states here - let the animation complete
                  return;
                }
              }
            }

            // Keep opponent at fixed distance during grab
            const fixedDistance = 90 * (opponent.sizeMultiplier || 1);
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
            player.grabState = GRAB_STATES.INITIAL;
            player.grabAttemptType = null;
            player.grabAttemptStartTime = null;
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
            (chargeDuration / 1500) * 100,
            100
          );
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
    const MIN_ATTACK_DISPLAY_TIME = 100; // Reduced from 300ms to 100ms for faster recovery
    const currentTime = Date.now();
    const attackDuration = currentTime - player.attackStartTime;

    if (attackDuration < MIN_ATTACK_DISPLAY_TIME) {
      setTimeout(() => {
        // Reset attack states but preserve power for knockback
        player.isAttacking = false;
        player.isSlapAttack = false;
        player.attackStartTime = 0;
        player.attackEndTime = 0;
        player.chargingFacingDirection = null;
        player.isChargingAttack = false;
        player.chargeStartTime = 0;
      }, MIN_ATTACK_DISPLAY_TIME - attackDuration);
    } else {
      // Reset attack states but preserve power for knockback
      player.isAttacking = false;
      player.isSlapAttack = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
      player.chargingFacingDirection = null;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
    }

    // Check if the other player is blocking (crouching)
    if (otherPlayer.isCrouching) {
      // Apply knockback to the attacking player instead
      if (player.isSlapAttack) {
        const knockbackDirection = player.facing === 1 ? 1 : -1;
        player.knockbackVelocity.x =
          0.4375 * knockbackDirection * player.chargeAttackPower;
        player.knockbackVelocity.y = 0;
        player.isHit = true;
      } else {
        const knockbackDirection = player.facing === 1 ? 1 : -1;
        player.knockbackVelocity.x =
          0.1 * knockbackDirection * player.chargeAttackPower;
        player.knockbackVelocity.y = 0;
        player.isHit = true;
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

      const knockbackDirection = player.facing === -1 ? 1 : -1;
      const chargePercentage = player.chargeAttackPower;
      let finalKnockbackMultiplier = 0.5 + (chargePercentage / 100) * 1.1;

      // Apply power-up effects
      if (player.activePowerUp === POWER_UP_TYPES.POWER) {
        finalKnockbackMultiplier =
          finalKnockbackMultiplier * player.powerUpMultiplier;
      }
      if (otherPlayer.activePowerUp === POWER_UP_TYPES.SIZE) {
        // Reduce knockback by 30% when the player has size power-up
        finalKnockbackMultiplier = finalKnockbackMultiplier * 0.7;
      }

      if (player.isSlapAttack) {
        otherPlayer.knockbackVelocity.x =
          6.5 * knockbackDirection * finalKnockbackMultiplier;
      } else {
        otherPlayer.knockbackVelocity.x =
          5 * knockbackDirection * finalKnockbackMultiplier;
      }
      otherPlayer.knockbackVelocity.y = 0; // Remove vertical knockback
      otherPlayer.y = GROUND_LEVEL;

      otherPlayer.isAlreadyHit = true;
      setTimeout(() => {
        otherPlayer.isHit = false;
        otherPlayer.isAlreadyHit = false;
        // Only reset chargeAttackPower after knockback is applied
        player.chargeAttackPower = 0;
      }, 300);
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
        grabState: GRAB_STATES.INITIAL,
        grabAttemptType: null,
        grabAttemptStartTime: null,
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
        x: 50,
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
        },
        wins: [],
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
        grabState: GRAB_STATES.INITIAL,
        grabAttemptType: null,
        grabAttemptStartTime: null,
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
        x: 950,
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
        },
        wins: [],
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

    if (
      player.keys.f &&
      !player.saltCooldown &&
      ((player.fighter === "player 1" && player.x <= 50) ||
        (player.fighter === "player 2" && player.x >= 900)) && // Adjusted range for player 2
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
        !player.isDodging &&
        !player.isAttacking &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        player.stamina >= 50
      ) {
        player.isDodging = true;
        player.dodgeEndTime = Date.now() + 400; // Dodge lasts for 0.4 seconds
        player.stamina -= 50; // Consume some stamina for the dodge

        // Store the dodge direction based on which key was held
        if (player.keys.a) {
          player.dodgeDirection = -1;
        } else if (player.keys.d) {
          player.dodgeDirection = 1;
        } else {
          // If no direction key was held, dodge in the facing direction
          player.dodgeDirection = player.facing === -1 ? 1 : -1;
        }

        // Reset dodge state after duration
        setTimeout(() => {
          player.isDodging = false;
          player.dodgeDirection = null;

          // Only release the attack if spacebar was released during dodge
          if (
            player.pendingChargeAttack &&
            player.spacebarReleasedDuringDodge
          ) {
            const chargeDuration =
              Date.now() - player.pendingChargeAttack.startTime;
            const chargePercentage = player.pendingChargeAttack.power;

            // Determine if it's a slap or charged attack
            if (chargePercentage < 25) {
              player.isSlapAttack = true;
              player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
              player.attackEndTime = Date.now() + 100; // Reduced from 300ms to 100ms for faster slap attacks
            } else {
              player.isSlapAttack = false;
              // Calculate attack duration based on charge percentage
              let attackDuration;
              if (chargePercentage <= 25) {
                attackDuration = 500;
              } else if (chargePercentage <= 75) {
                attackDuration = 500;
              } else {
                const extraDuration = ((chargePercentage - 50) / 50) * 1000;
                attackDuration = 1000 + extraDuration;
              }
              player.attackEndTime = Date.now() + attackDuration;
            }

            // Set attack state
            player.isAttacking = true;
            player.attackStartTime = Date.now();
            player.chargeAttackPower = player.pendingChargeAttack.power;

            // Lock facing direction during attack
            player.chargingFacingDirection = player.facing;
            if (player.chargingFacingDirection !== null) {
              player.facing = player.chargingFacingDirection;
            }

            // Reset charging state
            player.isChargingAttack = false;
            player.pendingChargeAttack = null;
            player.spacebarReleasedDuringDodge = false;

            setTimeout(() => {
              player.isAttacking = false;
              player.isSlapAttack = false;
              player.chargingFacingDirection = null;
            }, player.attackEndTime - Date.now());
          } else {
            // If spacebar wasn't released during dodge, just clear the pending attack
            player.pendingChargeAttack = null;
            player.spacebarReleasedDuringDodge = false;
          }
        }, 400);
      }

      // Start charging attack
      if (
        player.keys[" "] &&
        !player.isChargingAttack && // Only check these conditions when starting
        !player.isAttacking &&
        !player.isJumping &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit
      ) {
        player.isChargingAttack = true;
        player.chargeStartTime = Date.now();
        player.chargeAttackPower = 1;
        player.spacebarReleasedDuringDodge = false;
      }
      // For continuing a charge
      else if (player.keys[" "] && player.isChargingAttack && !player.isHit) {
        // Calculate charge power (0-100%)
        const chargeDuration = Date.now() - player.chargeStartTime;
        player.chargeAttackPower = Math.min((chargeDuration / 1500) * 100, 100);

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

      // Release attack when spacebar is released
      else if (
        !player.keys[" "] &&
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
          };
          player.spacebarReleasedDuringDodge = true;
        } else {
          const chargeDuration = Date.now() - player.chargeStartTime;
          const chargePercentage = player.chargeAttackPower;

          // Determine if it's a slap or charged attack
          if (chargePercentage < 25) {
            player.isSlapAttack = true;
            player.slapAnimation = player.slapAnimation === 1 ? 2 : 1;
            player.attackEndTime = Date.now() + 100; // Reduced from 300ms to 100ms for faster slap attacks
          } else {
            player.isSlapAttack = false;
            // Calculate attack duration based on charge percentage
            let attackDuration;
            if (chargePercentage <= 25) {
              attackDuration = 500;
            } else if (chargePercentage <= 75) {
              attackDuration = 500;
            } else {
              const extraDuration = ((chargePercentage - 50) / 50) * 1000;
              attackDuration = 1000 + extraDuration;
            }
            player.attackEndTime = Date.now() + attackDuration;
          }

          // Set attack state
          player.isAttacking = true;
          player.attackStartTime = Date.now();

          // Lock facing direction during attack
          player.chargingFacingDirection = player.facing;
          if (player.chargingFacingDirection !== null) {
            player.facing = player.chargingFacingDirection;
          }

          // Reset charging state
          player.isChargingAttack = false;

          setTimeout(() => {
            player.isAttacking = false;
            player.isSlapAttack = false;
            player.chargingFacingDirection = null;
          }, player.attackEndTime - Date.now());
        }
      }

      function isOpponentCloseEnoughForGrab(player, opponent) {
        // Calculate grab range based on player size
        const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
        return Math.abs(player.x - opponent.x) < grabRange;
      }
      if (
        player.keys.w &&
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
      rooms[roomIndex].rematchCount = 0;
      rooms[roomIndex].matchOver = false;
      rooms[roomIndex].gameStart = false;
      rooms[roomIndex].gameOver = false;
      rooms[roomIndex].readyCount = 0;
      rooms[roomIndex].readyStartTime = null;
      rooms[roomIndex].roundStartTimer = null;
      rooms[roomIndex].gameOverTime = null;
      rooms[roomIndex].winnerId = null;
      rooms[roomIndex].loserId = null;

      // Clean up player references
      const playerIndex = rooms[roomIndex].players.findIndex(
        (p) => p.id === socket.id
      );
      if (playerIndex !== -1) {
        const player = rooms[roomIndex].players[playerIndex];

        // Clean up all player references
        player.grabbedOpponent = null;
        player.throwOpponent = null;
        player.grabState = GRAB_STATES.INITIAL;
        player.grabAttemptType = null;
        player.grabAttemptStartTime = null;
        player.isGrabbing = false;
        player.isBeingGrabbed = false;
        player.isThrowing = false;
        player.isBeingThrown = false;
        player.isAttacking = false;
        player.isHit = false;
        player.isAlreadyHit = false;
        player.isDodging = false;
        player.isCrouching = false;
        player.isStrafing = false;
        player.isJumping = false;
        player.isReady = false;
        player.isBowing = false;
        player.knockbackVelocity = { x: 0, y: 0 };
        player.keys = {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": false,
          shift: false,
          e: false,
          f: false,
        };

        // Clean up opponent references
        const opponent = rooms[roomIndex].players.find(
          (p) => p.id !== player.id
        );
        if (opponent) {
          opponent.isBeingGrabbed = false;
          opponent.isBeingPushed = false;
          opponent.isBeingPulled = false;
          opponent.isBeingThrown = false;
          opponent.grabbedOpponent = null;
          opponent.throwOpponent = null;
        }
      }

      // Remove the player
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      // Emit updates with cleaned data
      const cleanedRoom = {
        ...rooms[roomIndex],
        players: rooms[roomIndex].players.map((p) => ({
          ...p,
          grabbedOpponent: null,
          throwOpponent: null,
          grabState: GRAB_STATES.INITIAL,
          grabAttemptType: null,
          grabAttemptStartTime: null,
          isGrabbing: false,
          isBeingGrabbed: false,
          isThrowing: false,
          isBeingThrown: false,
          isAttacking: false,
          isHit: false,
          isAlreadyHit: false,
          isDodging: false,
          isCrouching: false,
          isStrafing: false,
          isJumping: false,
          isReady: false,
          isBowing: false,
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
          },
        })),
      };

      io.in(roomId).emit("player_left");
      io.in(roomId).emit("ready_count", 0);
      io.to(roomId).emit("lobby", cleanedRoom.players);
      io.emit(
        "rooms",
        rooms.map((r) => ({
          ...r,
          players: r.players.map((p) => ({
            ...p,
            grabbedOpponent: null,
            throwOpponent: null,
            grabState: GRAB_STATES.INITIAL,
            grabAttemptType: null,
            grabAttemptStartTime: null,
            isGrabbing: false,
            isBeingGrabbed: false,
            isThrowing: false,
            isBeingThrown: false,
            isAttacking: false,
            isHit: false,
            isAlreadyHit: false,
            isDodging: false,
            isCrouching: false,
            isStrafing: false,
            isJumping: false,
            isReady: false,
            isBowing: false,
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
            },
          })),
        }))
      );
    }
    console.log(`${reason}: ${socket.id}`);
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log("Server is online!");
});

// process.env.PORT ||

// Add new function for grab state cleanup
function cleanupGrabStates(player, opponent) {
  // Clean up grabber states
  player.isGrabbing = false;
  player.grabbedOpponent = null;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;
  player.grabAttemptStartTime = null;
  player.isPushing = false;
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.grabCooldown = false; // Add this to ensure cooldown is reset
  player.isBeingGrabbed = false; // Add this to ensure being grabbed state is reset
  player.isBeingPushed = false; // Add this to ensure being pushed state is reset

  // Clean up grabbed player states
  opponent.isBeingGrabbed = false;
  opponent.isBeingPushed = false;
  opponent.isBeingPulled = false;
  opponent.isBeingThrown = false;
  opponent.grabbedOpponent = null;
  opponent.throwOpponent = null;
  opponent.grabState = GRAB_STATES.INITIAL;
  opponent.grabAttemptType = null;
  opponent.grabAttemptStartTime = null;
  opponent.isHit = false;
  opponent.grabCooldown = false; // Add this to ensure cooldown is reset
  opponent.isGrabbing = false; // Add this to ensure grabbing state is reset
  opponent.isPushing = false; // Add this to ensure pushing state is reset
}

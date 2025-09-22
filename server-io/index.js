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
  clearChargeState,
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
  safelyEndChargedAttack,
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

// Sanitize helper to keep stamina values stable and within [0, 100]
function clampStaminaValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

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
  powerUpSelectionPhase: false, // Track power-up selection phase
  opponentDisconnected: false, // Track if opponent disconnected during active game
  disconnectedDuringGame: false, // Track if disconnection happened during active gameplay
  // Brief freeze for clarity on impactful moments
  hitstopUntil: 0,
}));

let gameLoop = null;
let staminaRegenCounter = 0;
const TICK_RATE = 64;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.25; // Increased from 0.22 for snappier movement
const GROUND_LEVEL = 210;
const HITBOX_DISTANCE_VALUE = Math.round(77 * 1.3); // 100 (scaled +30%)
const SLAP_HITBOX_DISTANCE_VALUE = Math.round(155 * 1.3); // 202 (scaled +30%)
const SLAP_PARRY_WINDOW = 200; // Updated to 200ms window for parry to account for longer slap animation
const SLAP_PARRY_KNOCKBACK_VELOCITY = 1.5; // Reduced knockback for parried attacks
const THROW_RANGE = Math.round(166 * 1.3); // 216 (scaled +30%)
const GRAB_RANGE = Math.round(126 * 1.3); // 164 (scaled +30%)
const GRAB_PUSH_SPEED = 0.3; // Increased from 0.2 for more substantial movement
const GRAB_PUSH_DURATION = 650;

// Add power-up types
const { GRAB_STATES } = require("./constants");
const POWER_UP_TYPES = {
  SPEED: "speed",
  POWER: "power",
  SNOWBALL: "snowball",
  PUMO_ARMY: "pumo_army",
  THICK_BLUBBER: "thick_blubber",
};

// Add power-up effects
const POWER_UP_EFFECTS = {
  [POWER_UP_TYPES.SPEED]: 1.4, // 40% speed increase (only affects movement, not knockback)
  [POWER_UP_TYPES.POWER]: 1.3, // 30% knockback increase (ONLY power-up that affects knockback)
  [POWER_UP_TYPES.SNOWBALL]: 1.0, // No stat multiplier, just projectile ability
  [POWER_UP_TYPES.PUMO_ARMY]: 1.0, // No stat multiplier, just spawns army
  [POWER_UP_TYPES.THICK_BLUBBER]: 1.0, // No stat multiplier, just hit absorption
};

const GRAB_DURATION = 1500; // 1.5 seconds total grab duration
const GRAB_ATTEMPT_DURATION = 1000; // 1 second for attempt animation

// Note: Using MAP_LEFT_BOUNDARY and MAP_RIGHT_BOUNDARY from gameUtils.js for ring-out boundaries

// Add movement constants
const MOVEMENT_ACCELERATION = 0.08; // Reduced from 0.25 for more slippery feel
const MOVEMENT_DECELERATION = 0.12; // Reduced from 0.35 for longer slides
const MAX_MOVEMENT_SPEED = 1.2; // Slightly increased for better momentum
const MOVEMENT_MOMENTUM = 0.98; // Increased from 0.85 for longer slides
const MOVEMENT_FRICTION = 0.985; // Increased from 0.95 for more ice-like feel
const ICE_DRIFT_FACTOR = 0.92; // New constant for directional drift
const MIN_MOVEMENT_THRESHOLD = 0.01; // New constant for movement cutoff

// Grab walking tuning
const GRAB_WALK_SPEED_MULTIPLIER = 0.8; // Slightly slower than normal strafing
const GRAB_WALK_ACCEL_MULTIPLIER = 0.7; // Slightly lower acceleration than normal strafing

// Grab startup (anticipation) tuning
const GRAB_STARTUP_DURATION_MS = 220; // slight pause before grab movement
const GRAB_STARTUP_HOP_HEIGHT = 22; // small vertical hop during startup

// Ring-out cutscene tuning
const RINGOUT_THROW_DURATION_MS = 400; // Match normal throw timing for consistent physics

const RAW_PARRY_KNOCKBACK = 1.5; // Fixed knockback distance for raw parries (reduced by 50%)
const RAW_PARRY_STUN_DURATION = 1000; // 1 second stun duration
const RAW_PARRY_SLAP_KNOCKBACK = 1.5; // Reduced knockback for slap attack parries (reduced by 50%)
const RAW_PARRY_SLAP_STUN_DURATION = 500; // Reduced stun duration for slap attack parries
const PERFECT_PARRY_WINDOW = 100; // 100ms window for perfect parries
const DODGE_COOLDOWN = 2000; // 2 second cooldown between dodges
const MAX_DODGE_CHARGES = 2; // Maximum number of dodge charges

// At the ropes constants
const AT_THE_ROPES_DURATION = 1000; // 1 second stun duration

// Knockback immunity system constants
const KNOCKBACK_IMMUNITY_DURATION = 150; // 150ms immunity window

// Stamina regeneration tuning
const STAMINA_REGEN_INTERVAL_MS = 2000; // was 1000ms
const STAMINA_REGEN_AMOUNT = 10; // was 25 per tick

// Knockback immunity helper functions
function canApplyKnockback(player) {
  return !player.knockbackImmune || Date.now() >= player.knockbackImmuneEndTime;
}

function setKnockbackImmunity(player) {
  player.knockbackImmune = true;
  player.knockbackImmuneEndTime = Date.now() + KNOCKBACK_IMMUNITY_DURATION;
}

// Grab break constants
const GRAB_BREAK_STAMINA_COST = 50; // Stamina cost to break a grab
const GRAB_BREAK_PUSH_VELOCITY = 1.2; // Reduced push velocity (~55%) for shorter shove
const GRAB_BREAK_ANIMATION_DURATION = 300; // Duration for grab break animation state
const GRAB_BREAK_SEPARATION_DURATION = 220; // Smooth separation tween duration
const GRAB_BREAK_SEPARATION_MULTIPLIER = 96; // Separation distance scale (tripled)

// Hitstop tuning
const HITSTOP_SLAP_MS = 60;
const HITSTOP_CHARGED_MS = 90;
const HITSTOP_PARRY_MS = 60;

function triggerHitstop(room, durationMs) {
  const now = Date.now();
  const target = now + durationMs;
  room.hitstopUntil = Math.max(room.hitstopUntil || 0, target);
}

function isRoomInHitstop(room) {
  return room.hitstopUntil && Date.now() < room.hitstopUntil;
}

function handlePowerUpSelection(room) {
  // Reset power-up selection state for the room
  room.powerUpSelectionPhase = true;
  room.playersSelectedPowerUps = {};
  room.playerAvailablePowerUps = {};

  console.log(`Starting power-up selection for room ${room.id}`);

  const allPowerUps = Object.values(POWER_UP_TYPES);

  // Generate individual randomized lists for each player
  room.players.forEach((player) => {
    // Randomly select 3 out of 4 power-ups for this player
    const shuffled = [...allPowerUps].sort(() => Math.random() - 0.5);
    const availablePowerUps = shuffled.slice(0, 3); // Take first 3 from shuffled array

    // Store available power-ups for this player
    room.playerAvailablePowerUps[player.id] = availablePowerUps;

    console.log(
      `Available power-ups for player ${player.id}:`,
      availablePowerUps
    );
  });

  // Add a small delay to ensure clients are ready to receive the event
  setTimeout(() => {
    // Double-check that room still exists and is in power-up selection phase
    if (room && room.powerUpSelectionPhase && room.players.length === 2) {
      console.log(
        `Sending power-up selection start events for room ${room.id}`
      );

      room.players.forEach((player) => {
        const availablePowerUps = room.playerAvailablePowerUps[player.id];

        console.log(
          `🟢 SERVER: Emitting power_up_selection_start to player ${player.id} (${player.fighter}) with power-ups:`,
          availablePowerUps
        );

        // Send individual power-up list to each player
        io.to(player.id).emit("power_up_selection_start", {
          availablePowerUps: availablePowerUps,
        });
      });
    }
  }, 100); // Small delay to ensure client is ready
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

    console.log(
      `🔥 POWER-UP ACTIVATED: Player ${player.id} activated ${player.selectedPowerUp} with multiplier ${player.powerUpMultiplier}`
    );

    // Emit power-up event to clients
    io.in(room.id).emit("power_up_activated", {
      playerId: player.id,
      powerUpType: player.selectedPowerUp,
    });
  } else {
    console.log(
      `⚠️ POWER-UP WARNING: Player ${player.id} has no selectedPowerUp`
    );
  }

  // Reset salt throwing state after animation
  setPlayerTimeout(
    player.id,
    () => {
      player.isThrowingSalt = false;
      player.saltCooldown = false;

      // Allow movement after salt throw is complete
      player.canMoveToReady = true;
    },
    500
  );
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
      console.log(
        `Timer expired, auto-selecting power-ups for room ${room.id}`
      );

      // Auto-select the first available power-up for any players who haven't selected
      room.players.forEach((player) => {
        if (!player.selectedPowerUp) {
          const availablePowerUps =
            room.playerAvailablePowerUps[player.id] ||
            Object.values(POWER_UP_TYPES);
          const firstPowerUp = availablePowerUps[0];

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

        console.log(
          `Auto-selection complete, starting salt throwing in room ${room.id}`
        );

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
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.isAtTheRopes = false;
    player.atTheRopesStartTime = 0;
    player.isDodging = false;
    player.isReady = false;
    player.isHit = false;
    player.isAlreadyHit = false;
    player.isDead = false;
    player.stamina = 100;
    player.isGassed = false;
    player.gassedEndTime = 0;
    player.isBowing = false;
    player.x = player.fighter === "player 1" ? 300 : 775;
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
    // Reset pumo army state
    player.pumoArmy = [];
    player.pumoArmyCooldown = false;
    player.isSpawningPumoArmy = false;
    // Reset thick blubber state
    player.hitAbsorptionUsed = false;
    // Reset hit counter for reliable hit sound triggering
    player.hitCounter = 0;
    // Reset hit timing for dynamic hit duration
    player.lastHitTime = 0;
    // Reset slap attack buffering
    player.hasPendingSlapAttack = false;
    // Reset throw landed state
    player.isThrowLanded = false;
    // Reset overlap tracking
    player.isOverlapping = false;
    player.overlapStartTime = null;
    // Reset ready positioning flag
    player.canMoveToReady = false;
    // Reset grab break flags
    player.isGrabBreaking = false;
    player.isGrabBreakCountered = false;
    player.grabBreakSpaceConsumed = false;
    // Reset grab break state
    player.isGrabBreaking = false;
    // Reset grab movement states
    player.isGrabWalking = false;
    player.isGrabbingMovement = false;
    player.isGrabStartup = false;
    player.isWhiffingGrab = false;
    player.isGrabClashing = false;
    player.grabClashStartTime = 0;
    player.grabClashInputCount = 0;
    player.grabMovementStartTime = 0;
    player.grabMovementDirection = 0;
    player.grabMovementVelocity = 0;
    player.grabStartupStartTime = 0;
    player.grabStartupDuration = 0;
    // Reset ring-out throw cutscene flags
    player.isRingOutThrowCutscene = false;
    player.ringOutThrowDistance = 0;
    // Reset ring-out freeze flags
    player.isRingOutFreezeActive = false;
    player.ringOutFreezeEndTime = 0;
    player.ringOutThrowDirection = null;
    // Reset input lockouts
    player.inputLockUntil = 0;
  });

  // Clear player-specific power-up data
  room.playerAvailablePowerUps = {};

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
    // Find the room index using the socket's roomId to ensure we're resetting the correct room
    const roomIndex = rooms.findIndex((room) => room.id === socket.roomId);
    if (roomIndex !== -1) {
      resetRoomAndPlayers(rooms[roomIndex]);
    }
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
  const THROW_TECH_DURATION = 260; // slightly shorter animation
  const THROW_TECH_WINDOW = 200; // narrower window reduces frequent techs

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

    // Only check for throw tech if both players have recent throw attempt times
    if (!player.lastThrowAttemptTime || !opponent.lastThrowAttemptTime) {
      return false;
    }

    // Clean up old throw attempts that are outside the tech window
    if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      player.lastThrowAttemptTime = 0;
      return false;
    }
    if (currentTime - opponent.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      opponent.lastThrowAttemptTime = 0;
      return false;
    }

    // Check only for simultaneous throws
    const bothThrew =
      player.lastThrowAttemptTime &&
      opponent.lastThrowAttemptTime &&
      Math.abs(player.lastThrowAttemptTime - opponent.lastThrowAttemptTime) <=
        THROW_TECH_WINDOW;

    return bothThrew;
  }

  function checkForGrabPriority(player, opponent) {
    const currentTime = Date.now();

    // Clean up old attempts that are outside the window
    if (currentTime - player.lastThrowAttemptTime > THROW_TECH_WINDOW) {
      player.lastThrowAttemptTime = 0;
    }
    if (currentTime - opponent.lastGrabAttemptTime > THROW_TECH_WINDOW) {
      opponent.lastGrabAttemptTime = 0;
    }

    // Check if opponent grabbed while this player is trying to throw
    const opponentGrabbedDuringThrow =
      player.lastThrowAttemptTime &&
      opponent.lastGrabAttemptTime &&
      Math.abs(player.lastThrowAttemptTime - opponent.lastGrabAttemptTime) <=
        THROW_TECH_WINDOW;

    return opponentGrabbedDuringThrow;
  }

  function resolveGrabClash(room, io) {
    if (!room.grabClashData) {
      console.log(
        `🥊 RESOLVE ERROR: No grab clash data found for room ${room.id}`
      );
      return;
    }

    const player1 = room.players.find(
      (p) => p.id === room.grabClashData.player1Id
    );
    const player2 = room.players.find(
      (p) => p.id === room.grabClashData.player2Id
    );

    if (!player1 || !player2) {
      console.log(
        `🥊 RESOLVE ERROR: Players not found - Player1: ${player1}, Player2: ${player2}`
      );
      return;
    }

    console.log(
      `🥊 RESOLVING GRAB CLASH: Player1 (${player1.id}) inputs: ${room.grabClashData.player1Inputs}, Player2 (${player2.id}) inputs: ${room.grabClashData.player2Inputs}`
    );

    let winner, loser;
    if (room.grabClashData.player1Inputs > room.grabClashData.player2Inputs) {
      winner = player1;
      loser = player2;
    } else if (
      room.grabClashData.player2Inputs > room.grabClashData.player1Inputs
    ) {
      winner = player2;
      loser = player1;
    } else {
      // Tie - random winner
      const randomWinner = Math.random() < 0.5;
      winner = randomWinner ? player1 : player2;
      loser = randomWinner ? player2 : player1;
      console.log(`Grab clash tie, random winner: ${winner.id}`);
    }

    // Clear clash states
    player1.isGrabClashing = false;
    player1.grabClashStartTime = 0;
    player1.grabClashInputCount = 0;
    player2.isGrabClashing = false;
    player2.grabClashStartTime = 0;
    player2.grabClashInputCount = 0;

    // Set up grab for winner
    winner.isGrabbing = true;
    winner.grabStartTime = Date.now();
    winner.grabbedOpponent = loser.id;
    loser.isBeingGrabbed = true;
    loser.isHit = false;

    // Clear isAtTheRopes state if loser gets grabbed during the stun
    if (loser.isAtTheRopes) {
      loser.isAtTheRopes = false;
      loser.atTheRopesStartTime = 0;
      timeoutManager.clearPlayerSpecific(loser.id, "atTheRopesTimeout");
    }

    // Set grab facing direction for winner
    if (winner.isChargingAttack) {
      winner.grabFacingDirection = winner.chargingFacingDirection;
    } else {
      winner.grabFacingDirection = winner.facing;
    }

    // Set grab cooldown for winner
    winner.grabCooldown = true;
    setPlayerTimeout(
      winner.id,
      () => {
        winner.grabCooldown = false;
      },
      1100
    );

    // Emit clash result before clearing data
    io.in(room.id).emit("grab_clash_end", {
      winnerId: winner.id,
      loserId: loser.id,
      winnerInputs:
        winner.id === room.grabClashData.player1Id
          ? room.grabClashData.player1Inputs
          : room.grabClashData.player2Inputs,
      loserInputs:
        loser.id === room.grabClashData.player1Id
          ? room.grabClashData.player1Inputs
          : room.grabClashData.player2Inputs,
    });

    // Clear room clash data
    delete room.grabClashData;

    console.log(`Grab clash resolved: Winner ${winner.id}, Loser ${loser.id}`);
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
    setPlayerTimeout(
      player.id,
      () => {
        player.isThrowTeching = false;
        opponent.isThrowTeching = false;
      },
      THROW_TECH_DURATION
    );

    // Reset cooldown after longer duration
    setPlayerTimeout(
      player.id,
      () => {
        player.throwTechCooldown = false;
        opponent.throwTechCooldown = false;
      },
      THROW_TECH_COOLDOWN
    );
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

        if (player1.isGrabbing && player1.grabbedOpponent && !player1.isHit) {
          // Only handle grab state if not pushing
          const opponent = room.players.find(
            (p) => p.id === player1.grabbedOpponent
          );
          if (opponent && !opponent.isHit) {
            // Keep opponent at fixed distance during grab
            const fixedDistance =
              Math.round(81 * 1.3) * (opponent.sizeMultiplier || 1); // Scaled +30%
            opponent.x =
              player1.facing === 1
                ? player1.x - fixedDistance
                : player1.x + fixedDistance;
            opponent.facing = -player1.facing;
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
          if (
            !player1.isAttacking &&
            !player2.isAttacking &&
            !player1.isDodging &&
            !player2.isDodging
          ) {
            // Only update facing for non-isHit players and those not locked by slap attacks
            if (!player1.isHit && !player2.isHit) {
              // Normal facing logic when both players are not hit
              // Don't update facing if player has locked slap facing direction
              if (!player1.slapFacingDirection && player1.x < player2.x) {
                player1.facing = -1; // Player 1 faces right
              } else if (
                !player1.slapFacingDirection &&
                player1.x >= player2.x
              ) {
                player1.facing = 1; // Player 1 faces left
              }

              if (!player2.slapFacingDirection && player1.x < player2.x) {
                player2.facing = 1; // Player 2 faces left
              } else if (
                !player2.slapFacingDirection &&
                player1.x >= player2.x
              ) {
                player2.facing = -1; // Player 2 faces right
              }
            } else if (!player1.isHit && player2.isHit) {
              // Only update player1's facing when player2 is hit and player1 doesn't have locked slap facing
              if (!player1.slapFacingDirection) {
                if (player1.x < player2.x) {
                  player1.facing = -1; // Player 1 faces right
                } else {
                  player1.facing = 1; // Player 1 faces left
                }
              }
            } else if (player1.isHit && !player2.isHit) {
              // Only update player2's facing when player1 is hit and player2 doesn't have locked slap facing
              if (!player2.slapFacingDirection) {
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
                console.log(
                  `Player ${player.id} restarting charge immediately after recovery ends (mouse2 was held during attack)`
                );
                // Restart charging immediately since player was holding mouse2 during attack
                player.isChargingAttack = true;
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
                player.attackType = "charged";
                player.mouse2HeldDuringAttack = false; // Clear the flag
              }
              // Otherwise check normal conditions for restart
              else if (
                player.keys.mouse2 &&
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
                console.log(
                  `Player ${player.id} restarting charge after recovery ends (normal conditions)`
                );
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
          // Store initial snowball count to detect removals
          const initialSnowballCount = player.snowballs.length;

          // Update snowball positions and check for collisions
          player.snowballs = player.snowballs.filter((snowball) => {
            // Move snowball
            snowball.x += snowball.velocityX * delta * speedFactor;

            // Check if snowball is off-screen
            if (snowball.x < -50 || snowball.x > 1330) {
              return false; // Remove snowball
            }

            // Check collision with opponent
            const opponent = room.players.find((p) => p.id !== player.id);
            if (
              opponent &&
              !opponent.isDodging &&
              !opponent.isRawParrying &&
              !snowball.hasHit
            ) {
              const distance = Math.abs(snowball.x - opponent.x);
              if (
                distance < Math.round(45 * 1.3) &&
                Math.abs(snowball.y - opponent.y) < Math.round(27 * 1.3)
              ) {
                // Check for thick blubber hit absorption
                if (
                  opponent.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
                  opponent.isAttacking &&
                  opponent.attackType === "charged" &&
                  !opponent.hitAbsorptionUsed
                ) {
                  console.log(
                    `Player ${opponent.id} absorbed snowball with Thick Blubber during charged attack`
                  );

                  // Mark absorption as used for this charge session
                  opponent.hitAbsorptionUsed = true;

                  // Remove snowball but don't hit the player
                  snowball.hasHit = true;

                  // Emit absorption effect
                  io.in(room.id).emit("thick_blubber_absorption", {
                    playerId: opponent.id,
                    x: opponent.x,
                    y: opponent.y,
                  });

                  return false; // Remove snowball after absorption
                }

                // Hit opponent normally
                snowball.hasHit = true;
                opponent.isHit = true;
                opponent.isAlreadyHit = true;

                // If opponent is executing a charged attack, end it
                if (opponent.isAttacking && opponent.attackType === "charged") {
                  console.log(
                    `Player ${opponent.id} charged attack interrupted by snowball`
                  );
                  // Use helper function to safely end charged attacks
                  safelyEndChargedAttack(opponent, rooms);
                }

                // Apply knockback only if not immune
                if (canApplyKnockback(opponent)) {
                  const knockbackDirection = snowball.velocityX > 0 ? 1 : -1;

                  // Clear any existing slap knockback state to ensure consistent snowball knockback
                  opponent.isSlapKnockback = false;

                  opponent.knockbackVelocity.x = knockbackDirection * 1.5; // Reduced from 2 to 1.5 (25% reduction)
                  opponent.movementVelocity = knockbackDirection * 1.3; // Slightly increased from 1 to 1.3

                  // Set knockback immunity
                  setKnockbackImmunity(opponent);
                }

                // Reset hit state after duration
                setPlayerTimeout(
                  opponent.id,
                  () => {
                    opponent.isHit = false;
                    opponent.isAlreadyHit = false;
                  },
                  300
                );

                return false; // Remove snowball after hit
              }
            }

            // Check collision with raw parrying opponent (snowball is blocked but destroyed)
            if (opponent && opponent.isRawParrying && !snowball.hasHit) {
              const distance = Math.abs(snowball.x - opponent.x);
              if (
                distance < Math.round(45 * 1.3) &&
                Math.abs(snowball.y - opponent.y) < Math.round(27 * 1.3)
              ) {
                // Snowball is blocked - destroy it but don't apply knockback
                snowball.hasHit = true;
                return false; // Remove snowball after being blocked
              }
            }

            return true; // Keep snowball
          });

          // Check if snowballs were removed and reset cooldown if no snowballs remain
          if (
            initialSnowballCount > player.snowballs.length &&
            player.snowballs.length === 0
          ) {
            player.snowballCooldown = false;
            console.log(
              `Player ${player.id} snowball cooldown reset - no snowballs remaining`
            );
          }
        });

        // Handle pumo army updates
        [player1, player2].forEach((player) => {
          const currentTime = Date.now();

          // Update pumo army positions and check for collisions
          player.pumoArmy = player.pumoArmy.filter((clone) => {
            // Check if clone has expired
            if (currentTime - clone.spawnTime >= clone.lifespan) {
              return false; // Remove expired clone
            }

            // Move clone
            clone.x += clone.velocityX * delta * speedFactor;

            // Check if clone is off-screen
            if (clone.x < -50 || clone.x > 1330) {
              return false; // Remove off-screen clone
            }

            // Check collision with opponent
            const opponent = room.players.find((p) => p.id !== player.id);
            if (
              opponent &&
              !opponent.isDodging &&
              !opponent.isRawParrying &&
              !clone.hasHit
            ) {
              const distance = Math.abs(clone.x - opponent.x);
              if (
                distance < Math.round(54 * 1.3) &&
                Math.abs(clone.y - opponent.y) < Math.round(36 * 1.3)
              ) {
                // Check for thick blubber hit absorption
                if (
                  opponent.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
                  opponent.isAttacking &&
                  opponent.attackType === "charged" &&
                  !opponent.hitAbsorptionUsed
                ) {
                  console.log(
                    `Player ${opponent.id} absorbed pumo clone with Thick Blubber during charged attack`
                  );

                  // Mark absorption as used for this charge session
                  opponent.hitAbsorptionUsed = true;

                  // Remove clone but don't hit the player
                  clone.hasHit = true;

                  // Emit absorption effect
                  io.in(room.id).emit("thick_blubber_absorption", {
                    playerId: opponent.id,
                    x: opponent.x,
                    y: opponent.y,
                  });

                  return false; // Remove clone after absorption
                }

                // Hit opponent normally
                clone.hasHit = true;
                opponent.isHit = true;
                opponent.isAlreadyHit = true;

                // If opponent is executing a charged attack, end it
                if (opponent.isAttacking && opponent.attackType === "charged") {
                  console.log(
                    `Player ${opponent.id} charged attack interrupted by pumo clone`
                  );
                  // Use helper function to safely end charged attacks
                  safelyEndChargedAttack(opponent, rooms);
                }

                // Apply knockback only if not immune (lighter than normal slap)
                if (canApplyKnockback(opponent)) {
                  const knockbackDirection = clone.velocityX > 0 ? 1 : -1;

                  // Clear any existing slap knockback state to ensure consistent pumo army knockback
                  opponent.isSlapKnockback = false;

                  opponent.knockbackVelocity.x = knockbackDirection * 1.5; // Reduced from 2 to 1.5 (25% reduction)
                  opponent.movementVelocity = knockbackDirection * 1.5;

                  // Set knockback immunity
                  setKnockbackImmunity(opponent);
                }

                // Reset hit state after duration
                setPlayerTimeout(
                  opponent.id,
                  () => {
                    opponent.isHit = false;
                    opponent.isAlreadyHit = false;
                  },
                  200
                );

                return false; // Remove clone after hit
              }
            }

            // Check collision with raw parrying opponent (clone is blocked but destroyed)
            if (opponent && opponent.isRawParrying && !clone.hasHit) {
              const distance = Math.abs(clone.x - opponent.x);
              if (
                distance < Math.round(54 * 1.3) &&
                Math.abs(clone.y - opponent.y) < Math.round(36 * 1.3)
              ) {
                // Clone is blocked - destroy it but don't apply knockback
                clone.hasHit = true;
                return false; // Remove clone after being blocked
              }
            }

            return true; // Keep clone
          });

          // Note: pumoArmyCooldown is now only reset between rounds, not when clones are destroyed
          // This ensures the pumo army can only be used once per round
        });
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

          // Clamp to boundaries
          const clampedX = Math.max(
            MAP_LEFT_BOUNDARY,
            Math.min(newX, MAP_RIGHT_BOUNDARY)
          );
          player.x = clampedX;
          // Lock to ground and clear velocities during tween
          player.y = GROUND_LEVEL;
          player.movementVelocity = 0;
          player.knockbackVelocity.x = 0;
          player.knockbackVelocity.y = 0;
          player.isStrafing = false;

          if (t >= 1) {
            // End tween
            player.isGrabBreakSeparating = false;
            player.grabBreakSepStartTime = 0;
            player.grabBreakSepDuration = 0;
            player.grabBreakStartX = undefined;
            player.grabBreakTargetX = undefined;
          }

          // Skip remaining movement/logic this tick to avoid interference
          return;
        }

        // Handle knockback movement with NO boundary restrictions
        if (player.isRingOutFreezeActive) {
          // Freeze player entirely during ring-out freeze
          player.movementVelocity = 0;
          player.knockbackVelocity.x = 0;
          player.knockbackVelocity.y = 0;
          // Keep facing and position; do nothing else until freeze ends
        } else if (player.isHit) {
          // Apply immediate knockback without boundary check
          player.x =
            player.x + player.knockbackVelocity.x * delta * speedFactor;

          // Apply friction to knockback
          // Use less friction for slap knockbacks to create better sliding effect
          if (player.isSlapKnockback) {
            player.knockbackVelocity.x *= 0.96; // Much less friction for slap attacks (closer to ice physics)
          } else {
            player.knockbackVelocity.x *= 0.875; // Normal friction for charged attacks
          }

          // Apply ice-like sliding physics
          if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
            // Apply different friction based on attack type
            if (player.isHit && player.isSlapKnockback) {
              // Much less friction for slap attack hits - longer distance sliding
              player.movementVelocity *= 0.994; // Reduced friction for satisfying slap slides
            } else {
              // Normal friction for charged attacks and regular movement
              player.movementVelocity *= MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;
            }

            // Calculate new position with sliding
            player.x = player.x + delta * speedFactor * player.movementVelocity;
          }

          // Reset hit state when both knockback and sliding are nearly complete
          // Use different thresholds based on attack type
          const hitMovementThreshold = player.isSlapKnockback
            ? MIN_MOVEMENT_THRESHOLD * 0.3 // Much smaller threshold for slap attacks (longer slides)
            : MIN_MOVEMENT_THRESHOLD; // Normal threshold for charged attacks

          if (
            Math.abs(player.knockbackVelocity.x) < 0.1 &&
            Math.abs(player.movementVelocity) < hitMovementThreshold
          ) {
            player.knockbackVelocity.x = 0;
            player.movementVelocity = 0;
            player.isHit = false;
            player.isSlapKnockback = false; // Reset slap knockback flag
          }
        }

        // Handle grab startup hop animation (anticipation before grab movement)
        if (player.isGrabStartup) {
          const t = Math.min(
            1,
            (Date.now() - player.grabStartupStartTime) /
              (player.grabStartupDuration || GRAB_STARTUP_DURATION_MS)
          );
          // Simple parabola hop: peak at t=0.5
          const arc = 4 * t * (1 - t);
          player.y = GROUND_LEVEL + arc * GRAB_STARTUP_HOP_HEIGHT;
          if (t >= 1) {
            // End startup, land and begin grab movement immediately
            player.isGrabStartup = false;
            player.y = GROUND_LEVEL;
            player.isGrabbingMovement = true;
            // Keep telegraphing as attempting during lunge movement
            player.grabState = GRAB_STATES.ATTEMPTING;
            player.grabAttemptType = "grab";
            player.grabMovementStartTime = Date.now();
            player.grabMovementDirection = player.facing === 1 ? -1 : 1;
            player.grabMovementVelocity = 1.4;
          } else {
            // During startup we pause other movements
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
        }

        if (
          room.gameOver &&
          Date.now() - room.gameOverTime >= 3000 &&
          !room.matchOver
        ) {
          // 5 seconds
          resetRoomAndPlayers(room);
        }

        // Handle gassed state timing
        if (player.isGassed) {
          if (Date.now() >= player.gassedEndTime) {
            player.isGassed = false;
            player.gassedEndTime = 0;
          }
        }

        // Regen only if not gassed
        if (!player.isGassed && player.stamina < 100) {
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

            player.facing = player.throwingFacingDirection;
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
                  // Emit screen shake for landing after throw
                  io.in(room.id).emit("screen_shake", {
                    intensity: 0.6,
                    duration: 200,
                  });
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

              // Check if we should restart charging after throw completes
              if (shouldRestartCharging(player)) {
                // Restart charging immediately
                startCharging(player);
              }

              // Check if player landed outside ring-out boundaries
              const landedOutsideBoundaries =
                opponent.x <= MAP_LEFT_BOUNDARY ||
                opponent.x >= MAP_RIGHT_BOUNDARY;

              opponent.isBeingThrown = false;
              opponent.beingThrownFacingDirection = null;
              opponent.isHit = false;
              opponent.y = GROUND_LEVEL; // force final Y to ground level
              opponent.knockbackVelocity.y = 0;
              opponent.knockbackVelocity.x = 0;
              opponent.movementVelocity = 0;

              // Only set isThrowLanded if player landed outside ring-out boundaries
              if (landedOutsideBoundaries) {
                opponent.isThrowLanded = true; // Permanent until round reset
              }
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
          let currentDodgeSpeed = speedFactor * 1.8; // Reduced by 25% for shorter distance

          // Apply speed power-up to dodge with moderate multiplier
          if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
            currentDodgeSpeed *= Math.min(player.powerUpMultiplier * 0.85, 1.5);
          }

          // Calculate dodge progress (0 to 1)
          const dodgeProgress =
            (Date.now() - player.dodgeStartTime) /
            (player.dodgeEndTime - player.dodgeStartTime);

          // Simple parabolic arc - starts slow, peaks in middle, lands with weight
          // Using a quadratic function for more realistic arc shape
          const arcProgress = 4 * dodgeProgress * (1 - dodgeProgress); // Parabola that peaks at 0.5
          const hopHeight = arcProgress * 75; // Reverted to original hop height

          // Add slight deceleration over time for weightier feel
          const speedMultiplier = 1.0 - dodgeProgress * 0.2; // Slow down by 20% over time
          const adjustedSpeed = currentDodgeSpeed * speedMultiplier;

          // Calculate new position
          const newX = player.x + player.dodgeDirection * delta * adjustedSpeed;
          const newY = GROUND_LEVEL + hopHeight;

          // Store previous Y position to detect landing
          const previousY = player.y;

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
            // Check if player is trying to raw parry - if so, skip momentum transfer
            if (player.keys[" "]) {
              // Player wants to raw parry after dodge - clear all momentum and states
              player.movementVelocity = 0;
              player.isStrafing = false;
            } else {
              // Transfer dodge momentum to movement velocity with more weight
              const dodgeMomentum = adjustedSpeed * player.dodgeDirection * 0.9; // Reduced from 1.2

              // If no movement keys are pressed, apply momentum with slight decay
              if (!player.keys.a && !player.keys.d) {
                player.movementVelocity = dodgeMomentum * 0.8; // Add decay for weighty landing
              } else {
                // If movement keys are pressed, blend more conservatively
                player.movementVelocity =
                  (player.movementVelocity + dodgeMomentum) * 0.6;
              }
            }

            player.isDodging = false;
            player.dodgeDirection = null;
            player.y = GROUND_LEVEL; // Reset to ground level when dodge ends
          }
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
            console.log(
              `🥊 GRAB CLASH DETECTED between players ${player.id} and ${opponent.id}`
            );

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

            console.log(`🥊 ROOM CLASH DATA INITIALIZED:`, room.grabClashData);

            // Emit grab clash start event
            console.log(`🥊 EMITTING GRAB CLASH START to room ${room.id}`);
            io.in(room.id).emit("grab_clash_start", {
              player1Id: player.id,
              player2Id: opponent.id,
              duration: 2000,
              player1Position: { x: player.x, facing: player.facing },
              player2Position: { x: opponent.x, facing: opponent.facing },
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
          if (
            opponent &&
            !opponent.isGrabbingMovement &&
            isOpponentCloseEnoughForGrab(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isBeingGrabbed &&
            !player.isBeingGrabbed &&
            !player.throwTechCooldown
          ) {
            console.log(
              `Player ${player.id} successfully grabbed opponent during movement`
            );

            // Successful grab - stop all movement and initiate grab
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
            opponent.isBeingGrabbed = true;
            opponent.isHit = false;

            // Clear isAtTheRopes state if opponent gets grabbed during the stun
            if (opponent.isAtTheRopes) {
              opponent.isAtTheRopes = false;
              opponent.atTheRopesStartTime = 0;
              timeoutManager.clearPlayerSpecific(
                opponent.id,
                "atTheRopesTimeout"
              );
            }

            // Set grab facing direction
            if (player.isChargingAttack) {
              player.grabFacingDirection = player.chargingFacingDirection;
            } else {
              player.grabFacingDirection = player.facing;
            }

            // Set grab cooldown
            player.grabCooldown = true;
            setPlayerTimeout(
              player.id,
              () => {
                player.grabCooldown = false;
              },
              1100
            );
          }
        }

        // Strafing
        if (
          !player.isThrowLanded && // Block all movement for throw landed players
          !player.isRawParrying && // Block all movement during raw parry
          !player.isGrabbingMovement && // Block normal movement during grab movement
          !player.isWhiffingGrab && // Block movement during grab whiff recovery
          !player.isGrabClashing && // Block movement during grab clashing
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
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.keys.mouse1 && // Add condition to prevent strafing while slapping
            !player.hasPendingSlapAttack && // Block strafing when buffered slap attack is pending
            !(
              player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime
            ) && // Block strafing during post-slap cooldown
            !player.isAtTheRopes // Block strafing while at the ropes
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
            if (newX <= rightBoundary || player.isThrowLanded) {
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
            !player.isThrowingSnowball &&
            !player.isSpawningPumoArmy &&
            !player.keys.mouse1 && // Add condition to prevent strafing while slapping
            !player.hasPendingSlapAttack && // Block strafing when buffered slap attack is pending
            !(
              player.slapStrafeCooldown &&
              Date.now() < player.slapStrafeCooldownEndTime
            ) && // Block strafing during post-slap cooldown
            !player.isAtTheRopes // Block strafing while at the ropes
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
            if (newX >= leftBoundary || player.isThrowLanded) {
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
                // For slap slides, check if we're colliding with opponent and reduce velocity if needed
                const opponent = room.players.find((p) => p.id !== player.id);
                let effectiveMovementVelocity = player.movementVelocity;

                if (opponent && arePlayersColliding(player, opponent)) {
                  // Reduce slap slide velocity when colliding to prevent pass-through
                  const velocityReduction = 0.3; // Reduce to 30% of original velocity
                  effectiveMovementVelocity =
                    player.movementVelocity * velocityReduction;
                  console.log(
                    `🚫 SLAP SLIDE COLLISION: Player ${
                      player.id
                    } velocity reduced from ${player.movementVelocity.toFixed(
                      2
                    )} to ${effectiveMovementVelocity.toFixed(2)}`
                  );
                }

                // Use fixed speed factor for slap slides with potentially reduced velocity
                newX =
                  player.x + delta * speedFactor * effectiveMovementVelocity;
              } else {
                // Use power-up affected speed factor for normal movement
                newX =
                  player.x +
                  delta * currentSpeedFactor * player.movementVelocity;
              }

              // Check boundaries and stop sliding if hitting them
              // EXCEPTION: Allow hit knockback to move players past boundaries temporarily
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              } else if (!player.isHit && !player.isThrowLanded) {
                // Only enforce boundaries if player is NOT currently being hit and NOT throw landed
                // This allows knockback to work properly at boundaries
                player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
                player.movementVelocity = 0;
              } else {
                // Player is being hit or throw landed - allow boundary crossing
                player.x = newX;
              }
            } else {
              // Snap to zero when velocity is very small
              player.movementVelocity = 0;
            }
          }

          // Update strafing state
          if (
            (!player.keys.a &&
              !player.keys.d &&
              (!player.canMoveToReady || room.gameStart)) ||
            player.keys.mouse1 || // Add condition to prevent strafing while slapping
            player.isAttacking || // Clear strafing during any attack
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
            player.keys.mouse1 || // Add condition to prevent strafing while slapping
            player.isAttacking || // Clear strafing during any attack
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
            player.isRawParrying = true;
            player.rawParryStartTime = Date.now();
            player.rawParryMinDurationMet = false;
            // Clear any existing charge attack when starting raw parry
            clearChargeState(player, true); // true = cancelled
            // Clear movement momentum when starting raw parry to prevent dodge momentum interference
            player.movementVelocity = 0;
            player.isStrafing = false;
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

          // Check if minimum duration has been met
          if (parryDuration >= 750) {
            player.rawParryMinDurationMet = true;
          }

          // Only end parry if spacebar is released AND minimum duration is met
          if (!player.keys[" "] && player.rawParryMinDurationMet) {
            player.isRawParrying = false;
            player.rawParryStartTime = 0;
            player.rawParryMinDurationMet = false;
            // Space released - clear grab-break consumption so future parries can occur
            player.grabBreakSpaceConsumed = false;

            // Check if we should restart charging after raw parry ends
            if (
              player.keys.mouse2 &&
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
              // Restart charging immediately
              player.isChargingAttack = true;
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
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
            console.log(
              `🔴 Player ${player.id} hitting the ropes during charged attack! x: ${player.x}, newX: ${newX}, facing: ${player.facing}, MAP_LEFT_BOUNDARY: ${MAP_LEFT_BOUNDARY}, MAP_RIGHT_BOUNDARY: ${MAP_RIGHT_BOUNDARY}`
            );

            // Set at the ropes state
            player.isAtTheRopes = true;
            player.atTheRopesStartTime = Date.now();

            // Stop the attack and prevent movement
            player.isAttacking = false;
            player.isChargingAttack = false;
            player.chargeStartTime = 0;
            player.chargeAttackPower = 0;
            player.chargingFacingDirection = null;
            player.attackType = null;
            player.attackStartTime = 0;
            player.attackEndTime = 0;

            // Clear movement and knockback
            player.movementVelocity = 0;
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
                console.log(
                  `Player ${player.id} recovered from at the ropes state`
                );
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
              player.x = newX;
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
        if (
          player.isGrabbing &&
          player.grabbedOpponent &&
          !player.isThrowing &&
          !player.isBeingThrown
        ) {
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
              if (
                player.keys.mouse2 &&
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
                // Restart charging immediately
                player.isChargingAttack = true;
                player.chargeStartTime = Date.now();
                player.chargeAttackPower = 1;
                player.attackType = "charged";
              }

              return;
            }

            // Handle grab walking: allow slight left/right strafe while grabbing when A or D is held
            let currentSpeedFactor = speedFactor * GRAB_WALK_SPEED_MULTIPLIER;
            if (player.activePowerUp === POWER_UP_TYPES.SPEED) {
              currentSpeedFactor *= player.powerUpMultiplier;
            }

            // Initialize movementVelocity if needed
            if (!player.movementVelocity) {
              player.movementVelocity = 0;
            }

            // Boundaries for grab walking
            const leftBoundary = MAP_LEFT_BOUNDARY;
            const rightBoundary = MAP_RIGHT_BOUNDARY;

            // Determine if grab walking is active
            const canGrabWalk = player.keys.a || player.keys.d;
            player.isGrabWalking = !!canGrabWalk;

            if (player.isGrabWalking) {
              // Adjust acceleration a bit lower for grab walking
              const accel = MOVEMENT_ACCELERATION * GRAB_WALK_ACCEL_MULTIPLIER;

              if (player.keys.d && !player.keys.a) {
                if (player.movementVelocity < 0) {
                  player.movementVelocity *= ICE_DRIFT_FACTOR;
                }
                player.movementVelocity = Math.min(
                  player.movementVelocity + accel,
                  MAX_MOVEMENT_SPEED * GRAB_WALK_SPEED_MULTIPLIER
                );
              } else if (player.keys.a && !player.keys.d) {
                if (player.movementVelocity > 0) {
                  player.movementVelocity *= ICE_DRIFT_FACTOR;
                }
                player.movementVelocity = Math.max(
                  player.movementVelocity - accel,
                  -MAX_MOVEMENT_SPEED * GRAB_WALK_SPEED_MULTIPLIER
                );
              } else {
                // both or none - decelerate
                if (
                  Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD
                ) {
                  player.movementVelocity *=
                    MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;
                } else {
                  player.movementVelocity = 0;
                }
              }

              // Apply movement within boundaries
              const newX =
                player.x + delta * currentSpeedFactor * player.movementVelocity;
              if (newX >= leftBoundary && newX <= rightBoundary) {
                player.x = newX;
              } else {
                player.x = newX < leftBoundary ? leftBoundary : rightBoundary;
                player.movementVelocity = 0;
              }
            } else {
              // If not actively grab walking, lightly decay any residual velocity
              if (Math.abs(player.movementVelocity) > MIN_MOVEMENT_THRESHOLD) {
                player.movementVelocity *=
                  MOVEMENT_MOMENTUM * MOVEMENT_FRICTION;
              } else {
                player.movementVelocity = 0;
              }
            }

            // Keep opponent attached at fixed distance during grab
            const fixedDistance =
              Math.round(81 * 1.3) * (opponent.sizeMultiplier || 1);
            opponent.x =
              player.facing === 1
                ? player.x - fixedDistance
                : player.x + fixedDistance;
            opponent.facing = -player.facing;

            // Ring-out check during grab walking or stationary grab hold
            if (!room.gameOver) {
              if (
                opponent.x <= MAP_LEFT_BOUNDARY ||
                opponent.x >= MAP_RIGHT_BOUNDARY
              ) {
                // Start brief freeze, then trigger a simple throw cutscene: grabber throws outward
                player.isRingOutFreezeActive = true;
                player.ringOutFreezeEndTime = Date.now() + 200; // 0.2s freeze
                player.ringOutThrowDirection =
                  opponent.x <= MAP_LEFT_BOUNDARY ? -1 : 1;
                player.pendingRingOutThrowTarget = opponent.id;

                setPlayerTimeout(
                  player.id,
                  () => {
                    // Ensure room and players still valid
                    const currentRoom = rooms.find((r) => r.id === room.id);
                    if (!currentRoom) return;
                    const grabber = currentRoom.players.find(
                      (p) => p.id === player.id
                    );
                    const grabbed = currentRoom.players.find(
                      (p) => p.id === opponent.id
                    );
                    if (!grabber || !grabbed) return;

                    grabber.isRingOutFreezeActive = false;

                    // Clear grab states now that freeze is over and throw begins
                    grabber.isGrabbing = false;
                    grabber.grabbedOpponent = null;
                    grabbed.isBeingGrabbed = false;

                    grabber.isThrowing = true;
                    grabber.throwStartTime = Date.now();
                    grabber.throwEndTime =
                      Date.now() + RINGOUT_THROW_DURATION_MS; // Slow, cinematic
                    grabber.throwOpponent = grabbed.id;
                    grabbed.isBeingThrown = true;
                    grabbed.isHit = false;

                    // Face outward based on stored direction
                    grabber.throwingFacingDirection =
                      grabber.ringOutThrowDirection || 1;
                    grabbed.beingThrownFacingDirection = grabbed.facing;

                    // Mark as ring-out throw cutscene and set a minimal distance so opponent lands just in front
                    grabber.isRingOutThrowCutscene = true;
                    grabber.ringOutThrowDistance = 4; // Extremely short distance so they land right in front
                    grabber.ringOutThrowDirection = null;
                    grabber.pendingRingOutThrowTarget = null;
                  },
                  200,
                  "ringOutFreezeDelay"
                );

                const winner = player; // grabber wins
                const loser = opponent; // grabbed player loses
                handleWinCondition(room, loser, winner, io);
                // Preserve knockback velocity state for loser (mirroring other win handling)
                loser.knockbackVelocity = { ...loser.knockbackVelocity };
              }
            }
          }
        } else if (player.isGrabbing && !player.grabbedOpponent) {
          const grabDuration = Date.now() - player.grabStartTime;
          if (grabDuration >= 500) {
            player.isGrabbing = false;

            // Check if we should restart charging after missed grab completes
            if (
              player.keys.mouse2 &&
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
      });

      io.in(room.id).emit("fighter_action", {
        player1: room.players[0],
        player2: room.players[1],
      });
    });

    if (staminaRegenCounter >= STAMINA_REGEN_INTERVAL_MS) {
      staminaRegenCounter = 0; // Reset the counter after interval
    }
  }

  function checkCollision(player, otherPlayer) {
    // Reset isAlreadyHit only once per attack to allow exactly one hit per attack
    if (player.isAttacking && player.attackStartTime) {
      // Only reset if this is a different attack (different start time)
      if (
        !player.lastCheckedAttackTime ||
        player.lastCheckedAttackTime !== player.attackStartTime
      ) {
        // Reset the hit blocker for this new attack
        otherPlayer.isAlreadyHit = false;
        player.lastCheckedAttackTime = player.attackStartTime;
      }
    }

    // Check for startup frames on all attacks - disable collision during startup
    if (player.isAttacking && player.attackStartTime) {
      const CHARGED_ATTACK_STARTUP_DELAY = 60; // 60ms startup frames for charged attacks
      const SLAP_ATTACK_STARTUP_DELAY = 60; // 60ms startup frames for slap attacks

      const startupDelay =
        player.attackType === "slap"
          ? SLAP_ATTACK_STARTUP_DELAY
          : CHARGED_ATTACK_STARTUP_DELAY;
      const attackAge = Date.now() - player.attackStartTime;

      if (attackAge < startupDelay) {
        return; // Skip collision detection during startup frames
      }
    }

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
    const baseHitboxDistance =
      player.attackType === "slap"
        ? SLAP_HITBOX_DISTANCE_VALUE
        : HITBOX_DISTANCE_VALUE;

    const hitboxDistance = baseHitboxDistance * (player.sizeMultiplier || 1);

    // For slap attacks, only check horizontal distance like grab
    if (player.attackType === "slap") {
      const horizontalDistance = Math.abs(player.x - otherPlayer.x);
      if (horizontalDistance < hitboxDistance) {
        if (otherPlayer.isAttacking && otherPlayer.attackType === "slap") {
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
        // Check for thick blubber absorption in charge vs charge scenarios
        const playerHasThickBlubber =
          player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
          player.isAttacking &&
          player.attackType === "charged" &&
          !player.hitAbsorptionUsed;

        const otherPlayerHasThickBlubber =
          otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
          otherPlayer.isAttacking &&
          otherPlayer.attackType === "charged" &&
          !otherPlayer.hitAbsorptionUsed;

        if (playerHasThickBlubber && !otherPlayerHasThickBlubber) {
          // Player has thick blubber, they win
          processHit(player, otherPlayer);
        } else if (otherPlayerHasThickBlubber && !playerHasThickBlubber) {
          // Other player has thick blubber, they win
          processHit(otherPlayer, player);
        } else {
          // Either both have thick blubber or neither do - use random selection
          const winner = Math.random() < 0.5 ? player : otherPlayer;
          const loser = winner === player ? otherPlayer : player;
          processHit(winner, loser);
        }
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

    // Apply brief hitstop and input lock for clarity
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      triggerHitstop(room, HITSTOP_PARRY_MS);
    }
    const lockUntil = Date.now() + 60;
    player1.inputLockUntil = Math.max(player1.inputLockUntil || 0, lockUntil);
    player2.inputLockUntil = Math.max(player2.inputLockUntil || 0, lockUntil);
  }

  function applyParryEffect(player, knockbackDirection) {
    // Reset attack states
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.attackType = null;
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

    // Check for thick blubber hit absorption (only if defender is executing charged attack and hasn't used absorption)
    if (
      otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
      otherPlayer.isAttacking &&
      otherPlayer.attackType === "charged" &&
      !otherPlayer.hitAbsorptionUsed &&
      !otherPlayer.isRawParrying
    ) {
      // Raw parry should still work normally

      console.log(
        `Player ${otherPlayer.id} absorbed hit with Thick Blubber during charged attack`
      );

      // Mark absorption as used for this charge session
      otherPlayer.hitAbsorptionUsed = true;

      // Don't apply any knockback or hit effects to the defender
      // The attacker's attack still continues normally (they don't get knocked back either)

      // Emit a special effect or sound for absorption if needed
      if (currentRoom) {
        io.in(currentRoom.id).emit("thick_blubber_absorption", {
          playerId: otherPlayer.id,
          x: otherPlayer.x,
          y: otherPlayer.y,
        });
      }

      // Early return - no further hit processing
      return;
    }

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
      // For slap attacks, don't create separate timeout - let executeSlapAttack handle cleanup
      // This ensures consistent behavior with whiffed slaps
      if (isSlapAttack) {
        // Don't interfere with the normal executeSlapAttack timeout
        // Just let it handle the cleanup naturally
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
      const knockbackAmount = isSlapBeingParried
        ? RAW_PARRY_SLAP_KNOCKBACK
        : RAW_PARRY_KNOCKBACK;

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

      // Set parry success states for the defending player
      if (isPerfectParry) {
        // Perfect parry success state
        otherPlayer.isPerfectRawParrySuccess = true;
        console.log(`Perfect parry success set for player ${otherPlayer.id}`);

        // Emit raw parry success event for visual effect
        const parryData = {
          x: otherPlayer.x,
          y: otherPlayer.y,
          facing: otherPlayer.facing,
          isPerfect: true,
          timestamp: Date.now(),
          parryId: `${otherPlayer.id}_parry_${Date.now()}`,
        };
        console.log(`Emitting perfect raw_parry_success:`, parryData);
        if (currentRoom) {
          io.to(currentRoom.id).emit("raw_parry_success", parryData);
        }

        // Clear perfect parry success state after duration
        setPlayerTimeout(
          otherPlayer.id,
          () => {
            console.log(
              `Clearing perfect parry success for player ${otherPlayer.id}`
            );
            otherPlayer.isPerfectRawParrySuccess = false;
          },
          400, // Duration for perfect parry success animation
          "perfectParrySuccess" // Named timeout for easier debugging
        );
      } else {
        // Regular parry success state
        otherPlayer.isRawParrySuccess = true;
        console.log(`Regular parry success set for player ${otherPlayer.id}`);

        // Emit raw parry success event for visual effect
        const parryData = {
          x: otherPlayer.x,
          y: otherPlayer.y,
          facing: otherPlayer.facing,
          isPerfect: false,
          timestamp: Date.now(),
          parryId: `${otherPlayer.id}_parry_${Date.now()}`,
        };
        console.log(`Emitting regular raw_parry_success:`, parryData);
        if (currentRoom) {
          io.to(currentRoom.id).emit("raw_parry_success", parryData);
        }

        // Clear regular parry success state after duration
        setPlayerTimeout(
          otherPlayer.id,
          () => {
            console.log(
              `Clearing regular parry success for player ${otherPlayer.id}`
            );
            otherPlayer.isRawParrySuccess = false;
          },
          300, // Duration for regular parry success animation
          "regularParrySuccess" // Named timeout for easier debugging
        );
      }

      // FIXED: Standardized knockback duration for all parries (300ms)
      // Clear hit state quickly for consistent knockback distance
      setPlayerTimeout(
        player.id,
        () => {
          player.isHit = false;

          // After knockback ends, check if we should restart charging
          if (
            player.keys.mouse2 &&
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
            // Restart charging immediately
            player.isChargingAttack = true;
            player.chargeStartTime = Date.now();
            player.chargeAttackPower = 1;
            player.attackType = "charged";
          }
        },
        300, // Consistent 300ms knockback duration for all parries
        "parryKnockbackReset" // Named timeout for easier debugging
      );

      // Apply stun for perfect parries (separate from knockback)
      if (isPerfectParry) {
        const stunDuration = isSlapBeingParried
          ? RAW_PARRY_SLAP_STUN_DURATION
          : RAW_PARRY_STUN_DURATION;
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
            showStarStunEffect: true, // Explicit flag for the star stun effect
          });
        }

        // Reset stun after appropriate duration (separate from knockback)
        setPlayerTimeout(
          player.id,
          () => {
            player.isRawParryStun = false;

            // After stun ends, check if we should restart charging
            if (
              player.keys.mouse2 &&
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
              // Restart charging immediately
              player.isChargingAttack = true;
              player.chargeStartTime = Date.now();
              player.chargeAttackPower = 1;
              player.attackType = "charged";
            }
          },
          stunDuration,
          "perfectParryStunReset" // Named timeout for easier debugging
        );
      } else {
        // Regular parry - emit screen shake with lower intensity
        if (currentRoom) {
          io.in(currentRoom.id).emit("screen_shake", {
            intensity: 0.5,
            duration: 200,
          });
          // Hitstop on parry
          triggerHitstop(currentRoom, HITSTOP_PARRY_MS);
        }
        // If movement ended or was interrupted without grabbing, clear telegraph
        if (
          !player.isGrabbingMovement &&
          !player.isGrabbing &&
          !player.isGrabClashing
        ) {
          player.grabState = GRAB_STATES.INITIAL;
          player.grabAttemptType = null;
        }
      }
    } else {
      // === ROCK-SOLID HIT PROCESSING ===
      // Clear any existing hit state cleanup to prevent conflicts
      timeoutManager.clearPlayerSpecific(otherPlayer.id, "hitStateReset");

      // Always ensure a clean state transition for reliable client-side detection
      // This guarantees that each hit triggers proper sound/visual effects
      otherPlayer.isHit = false;

      // Use immediate callback to ensure proper state transition timing
      process.nextTick(() => {
        otherPlayer.isHit = true;
      });

      // Block multiple hits from this same attack
      otherPlayer.isAlreadyHit = true;

      // Reset movement states
      otherPlayer.isJumping = false;
      otherPlayer.isAttacking = false;
      otherPlayer.isStrafing = false;

      // Clear parry success states when hit
      otherPlayer.isRawParrySuccess = false;
      otherPlayer.isPerfectRawParrySuccess = false;

      // Clear grab movement states if player was attempting to grab
      if (otherPlayer.isGrabbingMovement) {
        console.log(
          `Player ${otherPlayer.id} grab movement interrupted by hit from ${player.id}`
        );
        otherPlayer.isGrabbingMovement = false;
        otherPlayer.grabMovementStartTime = 0;
        otherPlayer.grabMovementDirection = 0;
        otherPlayer.grabMovementVelocity = 0;
        // Clear any grab movement timeouts
        timeoutManager.clearPlayerSpecific(
          otherPlayer.id,
          "grabMovementTimeout"
        );
      }

      // Clear grab whiffing state if player was whiffing
      if (otherPlayer.isWhiffingGrab) {
        console.log(
          `Player ${otherPlayer.id} grab whiff interrupted by hit from ${player.id}`
        );
        otherPlayer.isWhiffingGrab = false;
      }

      // Clear grab clashing state if player was clashing
      if (otherPlayer.isGrabClashing) {
        console.log(
          `Player ${otherPlayer.id} grab clash interrupted by hit from ${player.id}`
        );
        otherPlayer.isGrabClashing = false;
        otherPlayer.grabClashStartTime = 0;
        otherPlayer.grabClashInputCount = 0;
        // Clear any grab clash timeouts
        timeoutManager.clearPlayerSpecific(
          otherPlayer.id,
          "grabClashResolution"
        );

        // If there was room clash data involving this player, clean it up
        if (currentRoom && currentRoom.grabClashData) {
          if (
            currentRoom.grabClashData.player1Id === otherPlayer.id ||
            currentRoom.grabClashData.player2Id === otherPlayer.id
          ) {
            console.log(
              `Clearing room grab clash data due to player ${otherPlayer.id} being hit`
            );
            delete currentRoom.grabClashData;
            // Emit clash cancellation to room
            io.in(currentRoom.id).emit("grab_clash_cancelled", {
              reason: "player_hit",
              hitPlayerId: otherPlayer.id,
            });
          }
        }
      }

      // Clear isAtTheRopes state if player gets hit during the stun
      if (otherPlayer.isAtTheRopes) {
        otherPlayer.isAtTheRopes = false;
        otherPlayer.atTheRopesStartTime = 0;
        // Clear any existing timeout for the at-the-ropes state
        timeoutManager.clearPlayerSpecific(otherPlayer.id, "atTheRopesTimeout");
      }

      // Increment hit counter for reliable hit sound triggering
      otherPlayer.hitCounter = (otherPlayer.hitCounter || 0) + 1;

      // Update opponent's facing direction based on attacker's position
      otherPlayer.facing = player.x < otherPlayer.x ? 1 : -1;

      // Calculate knockback direction
      let knockbackDirection;
      if (isSlapAttack) {
        // For slap attacks, use the attacker's facing direction to ensure consistent knockback
        // The opponent should always be knocked back in the direction the attacker is facing
        knockbackDirection = player.facing === 1 ? -1 : 1;
        console.log(
          `👋 SLAP KNOCKBACK: Player ${player.id} facing ${player.facing}, knockback direction: ${knockbackDirection}`
        );
      } else {
        // For charged attacks, use relative positions (existing behavior)
        knockbackDirection = player.x < otherPlayer.x ? 1 : -1;
      }

      // Calculate knockback multiplier based on charge percentage
      let finalKnockbackMultiplier;
      if (isSlapAttack) {
        finalKnockbackMultiplier = 0.334611; // Reduced by another 10% from 0.37179 to 0.334611 (total 38% reduction from original 0.54)
      } else {
        finalKnockbackMultiplier = 0.4675 + (chargePercentage / 100) * 1.122; // Reduced base power by 15% (0.55 -> 0.4675) and scaling by 15% (1.32 -> 1.122)
        console.log(
          `💥 KNOCKBACK CALC: Player ${player.id} chargePercentage: ${chargePercentage}%, finalKnockbackMultiplier: ${finalKnockbackMultiplier}`
        );
      }

      // Apply crouch stance damage reduction
      if (otherPlayer.isCrouchStance) {
        if (isSlapAttack) {
          // Reduce slap attack power by 10% when hitting crouched target
          finalKnockbackMultiplier *= 0.9; // 90% of original power (10% reduction)
          console.log(
            `🛡️ CROUCH DEFENSE: Slap attack damage reduced by 10% against crouched player ${otherPlayer.id}`
          );
        } else {
          // Reduce charged attack power by 10% when hitting crouched target
          finalKnockbackMultiplier *= 0.9; // 90% of original power (10% reduction)
          console.log(
            `🛡️ CROUCH DEFENSE: Charged attack damage reduced by 10% against crouched player ${otherPlayer.id}`
          );
        }
      }

      // Apply power-up effects
      if (player.activePowerUp === POWER_UP_TYPES.POWER) {
        if (isSlapAttack) {
          // Adjusted power power-up effect for slap attacks to achieve 20% increase
          finalKnockbackMultiplier *= player.powerUpMultiplier * 0.923;
        } else {
          // Full power-up effect for charged attacks
          finalKnockbackMultiplier *= player.powerUpMultiplier;
        }
      }

      if (canApplyKnockback(otherPlayer)) {
        if (isSlapAttack) {
          // For slap attacks, use consistent knockback regardless of distance
          // This ensures all slap hits feel the same whether players are touching or at distance
          const immediateKnockback =
            1.85 * knockbackDirection * finalKnockbackMultiplier;
          const slidingVelocity =
            2.0 * knockbackDirection * finalKnockbackMultiplier;

          // Apply consistent knockback without any distance-based separation boost
          otherPlayer.knockbackVelocity.x = immediateKnockback;
          otherPlayer.movementVelocity = slidingVelocity;

          // Mark this as a slap knockback for special friction handling
          otherPlayer.isSlapKnockback = true;

          console.log(
            `👋 SLAP ATTACK: Player ${player.id} -> Consistent knockback applied (no separation boost), attacker facing: ${player.facing}, knockback direction: ${knockbackDirection}`
          );
        } else {
          // For charged attacks, force clear any existing hit state and velocities for consistent knockback
          otherPlayer.isHit = false;
          otherPlayer.isSlapKnockback = false;
          otherPlayer.knockbackVelocity.x = 0;
          otherPlayer.movementVelocity = 0;

          // For charged attacks, use a combination of immediate knockback and sliding
          const immediateKnockback =
            1.7 * knockbackDirection * finalKnockbackMultiplier;
          otherPlayer.movementVelocity =
            1.2 * knockbackDirection * finalKnockbackMultiplier;
          otherPlayer.knockbackVelocity.x = immediateKnockback;

          console.log(
            `🎯 FINAL KNOCKBACK VALUES: Player ${player.id} -> immediateKnockback: ${immediateKnockback}, movementVelocity: ${otherPlayer.movementVelocity}, activePowerUp: ${player.activePowerUp}`
          );

          // Calculate attacker bounce-off based on charge percentage
          const attackerBounceDirection = -knockbackDirection;
          const attackerBounceMultiplier = 0.3 + (chargePercentage / 100) * 0.5;

          // Set movement velocity for the attacker to create bounce-off effect
          player.movementVelocity =
            2 * attackerBounceDirection * attackerBounceMultiplier;
          player.knockbackVelocity = { x: 0, y: 0 };

          console.log(
            `🔄 ATTACKER BOUNCE-OFF: Player ${player.id} -> attackerBounceMultiplier: ${attackerBounceMultiplier}, movementVelocity: ${player.movementVelocity}`
          );

          if (currentRoom) {
            io.in(currentRoom.id).emit("screen_shake", {
              intensity: 0.7 + (chargePercentage / 100) * 0.2,
              duration: 250 + (chargePercentage / 100) * 100,
            });
          }
        }

        // Set knockback immunity
        setKnockbackImmunity(otherPlayer);

        // Emit hit effect at the hit player's position
        if (currentRoom) {
          io.in(currentRoom.id).emit("player_hit", {
            x: otherPlayer.x,
            y: otherPlayer.y,
            facing: otherPlayer.facing,
            attackType: isSlapAttack ? "slap" : "charged",
            timestamp: Date.now(), // Add unique timestamp to ensure effect triggers every time
            hitId: Math.random().toString(36).substr(2, 9), // Add unique ID for guaranteed uniqueness
          });
          // Trigger brief hitstop based on attack type
          triggerHitstop(
            currentRoom,
            isSlapAttack ? HITSTOP_SLAP_MS : HITSTOP_CHARGED_MS
          );
        }
      }

      otherPlayer.knockbackVelocity.y = 0;
      otherPlayer.y = GROUND_LEVEL;

      // === CONSISTENT HIT DURATION ===
      // Use fixed duration for all slap attacks to ensure consistency
      const hitStateDuration = isSlapAttack ? 250 : 300; // Fixed 250ms for slaps, 300ms for charged

      // Update the last hit time for tracking
      otherPlayer.lastHitTime = currentTime;

      // Single, deterministic cleanup
      setPlayerTimeout(
        otherPlayer.id,
        () => {
          otherPlayer.isHit = false;
          // Note: isAlreadyHit is reset by checkCollision for the next attack
        },
        hitStateDuration,
        "hitStateReset" // Named timeout for cleanup
      );

      // Short input lockouts to reduce action spam right after hits
      const lockMs = isSlapAttack ? 60 : 80;
      const now = Date.now();
      otherPlayer.inputLockUntil = Math.max(
        otherPlayer.inputLockUntil || 0,
        now + lockMs
      );
      player.inputLockUntil = Math.max(
        player.inputLockUntil || 0,
        now + lockMs
      );

      // Encourage clearer turn-taking: set wantsToRestartCharge only on intentional hold
      if (player.keys && player.keys.mouse2) {
        player.wantsToRestartCharge = true;
      }

      // Trigger gassed state if stamina is 0 after hit processing
      if (otherPlayer.stamina <= 0 && !otherPlayer.isGassed) {
        otherPlayer.stamina = 0;
        otherPlayer.isGassed = true;
        otherPlayer.gassedEndTime = Date.now() + 5000; // 5 seconds
      }
    }
  }

  socket.on("get_rooms", () => {
    socket.emit("rooms", rooms);
  });

  socket.on("lobby", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);
    if (roomIndex !== -1) {
      // Send current lobby state to the requesting client
      socket.emit("lobby", rooms[roomIndex].players);
    }
  });

  socket.on("join_room", (data) => {
    socket.join(data.roomId);
    console.log(`${data.socketId} joined ${data.roomId}`);
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);

    // Check if room is in opponent disconnected state - prevent joining
    console.log(
      `JOIN_ROOM DEBUG: Room ${data.roomId} - opponentDisconnected: ${rooms[roomIndex].opponentDisconnected}, disconnectedDuringGame: ${rooms[roomIndex].disconnectedDuringGame}, players: ${rooms[roomIndex].players.length}`
    );

    if (
      rooms[roomIndex].opponentDisconnected ||
      rooms[roomIndex].disconnectedDuringGame
    ) {
      console.log(
        `JOIN BLOCKED: ${data.socketId} attempted to join ${data.roomId} but room is in disconnected state`
      );
      socket.emit("join_room_failed", {
        reason: "Room is currently unavailable",
        roomId: data.roomId,
      });
      socket.leave(data.roomId);
      return;
    }

    // If someone is joining and there's already one player, ensure clean room state
    if (rooms[roomIndex].players.length === 1) {
      console.log(
        `Second player joining room ${data.roomId}, ensuring clean state`
      );
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
      existingPlayer.isThrowingSnowball = false;
      existingPlayer.isSpawningPumoArmy = false;
      existingPlayer.hitAbsorptionUsed = false;
      existingPlayer.snowballs = [];
      existingPlayer.pumoArmy = [];
      // Don't set canMoveToReady here - it should only be set during actual salt throwing phase
    }

    if (rooms[roomIndex].players.length < 1) {
      rooms[roomIndex].players.push({
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
        slapFacingDirection: null,
        isSlapAttack: false,
        slapAnimation: 2,
        isThrowing: false,
        isThrowingSalt: false,
        saltCooldown: false,
        snowballCooldown: false,
        lastSnowballTime: 0,
        snowballs: [],
        isThrowingSnowball: false,
        pumoArmyCooldown: false,
        pumoArmy: [],
        isSpawningPumoArmy: false,
        throwStartTime: 0,
        throwEndTime: 0,
        throwOpponent: null,
        throwingFacingDirection: null,
        beingThrownFacingDirection: null,
        isGrabbing: false,
        isGrabWalking: false,
        isGrabbingMovement: false,
        isGrabStartup: false,
        isWhiffingGrab: false,
        isGrabClashing: false,
        grabClashStartTime: 0,
        grabClashInputCount: 0,
        grabMovementStartTime: 0,
        grabMovementDirection: 0,
        grabMovementVelocity: 0,
        grabStartupStartTime: 0,
        grabStartupDuration: 0,
        grabStartTime: 0,
        grabbedOpponent: null,
        isThrowTeching: false,
        throwTechCooldown: false,
        isSlapParrying: false,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isCrouchStance: false,
        isCrouchStrafing: false,
        isRawParrying: false,
        rawParryStartTime: 0,
        rawParryMinDurationMet: false,
        isRawParryStun: false,
        isRawParrySuccess: false,
        isPerfectRawParrySuccess: false,
        isAtTheRopes: false,
        atTheRopesStartTime: 0,
        dodgeDirection: false,
        dodgeEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: 1,
        stamina: 100,
        isGassed: false,
        gassedEndTime: 0,
        x: 245,
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
        knockbackImmune: false, // Add knockback immunity flag
        knockbackImmuneEndTime: 0, // Add knockback immunity timer
        // Add missing power-up initialization
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        hitAbsorptionUsed: false, // Add thick blubber hit absorption tracking
        hitCounter: 0, // Add counter for reliable hit sound triggering
        lastHitTime: 0, // Add timing tracking for dynamic hit duration
        lastCheckedAttackTime: 0, // Add tracking for attack collision checking
        hasPendingSlapAttack: false, // Add flag for buffering one additional slap attack
        mouse1JustPressed: false, // Track if mouse1 was just pressed this frame
        mouse1JustReleased: false, // Track if mouse1 was just released this frame
        isOverlapping: false, // Track overlap state for smoother separation
        overlapStartTime: null, // Track when overlap began for progressive separation
        chargeCancelled: false, // Track if charge was cancelled (vs executed)
        isGrabBreaking: false,
        isGrabBreakCountered: false,
        grabBreakSpaceConsumed: false,
        // Ring-out throw cutscene flags
        isRingOutThrowCutscene: false,
        ringOutThrowDistance: 0,
        isRingOutFreezeActive: false,
        ringOutFreezeEndTime: 0,
        ringOutThrowDirection: null,
        inputLockUntil: 0,
      });
    } else if (rooms[roomIndex].players.length === 1) {
      rooms[roomIndex].players.push({
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
        slapFacingDirection: null,
        isSlapAttack: false,
        slapAnimation: 2,
        isThrowing: false,
        isThrowingSalt: false,
        saltCooldown: false,
        snowballCooldown: false,
        lastSnowballTime: 0,
        snowballs: [],
        isThrowingSnowball: false,
        pumoArmyCooldown: false,
        pumoArmy: [],
        isSpawningPumoArmy: false,
        throwStartTime: 0,
        throwEndTime: 0,
        throwOpponent: null,
        throwingFacingDirection: null,
        beingThrownFacingDirection: null,
        isGrabbing: false,
        isGrabWalking: false,
        isGrabbingMovement: false,
        isGrabStartup: false,
        isWhiffingGrab: false,
        isGrabClashing: false,
        grabClashStartTime: 0,
        grabClashInputCount: 0,
        grabMovementStartTime: 0,
        grabMovementDirection: 0,
        grabMovementVelocity: 0,
        grabStartupStartTime: 0,
        grabStartupDuration: 0,
        grabStartTime: 0,
        grabbedOpponent: null,
        isThrowTeching: false,
        throwTechCooldown: false,
        isSlapParrying: false,
        lastThrowAttemptTime: 0,
        lastGrabAttemptTime: 0,
        isStrafing: false,
        isCrouchStance: false,
        isCrouchStrafing: false,
        isRawParrying: false,
        rawParryStartTime: 0,
        rawParryMinDurationMet: false,
        isRawParryStun: false,
        isRawParrySuccess: false,
        isPerfectRawParrySuccess: false,
        isAtTheRopes: false,
        atTheRopesStartTime: 0,
        dodgeDirection: null,
        dodgeEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: -1,
        stamina: 100,
        isGassed: false,
        gassedEndTime: 0,
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
        knockbackImmune: false, // Add knockback immunity flag
        knockbackImmuneEndTime: 0, // Add knockback immunity timer
        // Add missing power-up initialization
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        hitAbsorptionUsed: false, // Add thick blubber hit absorption tracking
        hitCounter: 0, // Add counter for reliable hit sound triggering
        lastHitTime: 0, // Add timing tracking for dynamic hit duration
        lastCheckedAttackTime: 0, // Add tracking for attack collision checking
        hasPendingSlapAttack: false, // Add flag for buffering one additional slap attack
        mouse1JustPressed: false, // Track if mouse1 was just pressed this frame
        mouse1JustReleased: false, // Track if mouse1 was just released this frame
        isOverlapping: false, // Track overlap state for smoother separation
        overlapStartTime: null, // Track when overlap began for progressive separation
        chargeCancelled: false, // Track if charge was cancelled (vs executed)
        isGrabBreaking: false,
        isGrabBreakCountered: false,
        grabBreakSpaceConsumed: false,
        // Ring-out throw cutscene flags
        isRingOutThrowCutscene: false,
        ringOutThrowDistance: 0,
        isRingOutFreezeActive: false,
        ringOutFreezeEndTime: 0,
        ringOutThrowDirection: null,
        inputLockUntil: 0,
      });
    }

    // If this is the second player joining and room was in disconnected state, reset it
    if (
      rooms[roomIndex].players.length === 2 &&
      rooms[roomIndex].opponentDisconnected
    ) {
      console.log(
        `🔵 SERVER: Second player joined disconnected room ${data.roomId}, resetting room state`
      );
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
    io.to(data.roomId).emit("rooms", rooms);
    io.to(data.roomId).emit("lobby", rooms[roomIndex].players);
    // console.log(rooms[roomIndex].players);
  });

  socket.on("ready_count", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);
    console.log("ready count activated  ");

    if (roomIndex === -1) return; // Room not found

    // Find the player in the room
    const playerIndex = rooms[roomIndex].players.findIndex(
      (player) => player.id === data.playerId
    );

    if (playerIndex === -1) return; // Player not found in room

    if (data.isReady) {
      // Only increment if player wasn't already ready
      if (!rooms[roomIndex].players[playerIndex].isReady) {
        rooms[roomIndex].readyCount++;
        rooms[roomIndex].players[playerIndex].isReady = true;
      }
    } else {
      // Only decrement if player was ready
      if (rooms[roomIndex].players[playerIndex].isReady) {
        rooms[roomIndex].readyCount--;
        rooms[roomIndex].players[playerIndex].isReady = false;
      }
    }

    // Ensure ready count doesn't go below 0
    rooms[roomIndex].readyCount = Math.max(0, rooms[roomIndex].readyCount);

    io.in(data.roomId).emit("ready_count", rooms[roomIndex].readyCount);
    io.in(data.roomId).emit("lobby", rooms[roomIndex].players);

    if (rooms[roomIndex].readyCount > 1) {
      io.in(data.roomId).emit("initial_game_start", rooms[roomIndex]);
      console.log("Game started");
    }
  });

  socket.on("request_power_up_selection_state", (data) => {
    const { roomId, playerId } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    console.log(
      `🔵 SERVER: Power-up selection state requested by player ${playerId} in room ${roomId}`
    );

    if (roomIndex === -1) {
      console.log(`🔴 SERVER: Room ${roomId} not found for state request`);
      return;
    }

    const room = rooms[roomIndex];
    const player = room.players.find((p) => p.id === playerId);

    if (!player) {
      console.log(
        `🔴 SERVER: Player ${playerId} not found in room ${roomId} for state request`
      );
      return;
    }

    // If we're in power-up selection phase, send the start event
    if (room.powerUpSelectionPhase && room.playerAvailablePowerUps[playerId]) {
      const availablePowerUps = room.playerAvailablePowerUps[playerId];

      console.log(
        `🟢 SERVER: Resending power_up_selection_start to player ${playerId} (${player.fighter}) with power-ups:`,
        availablePowerUps
      );

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
      console.log(
        `🔴 SERVER: Room ${roomId} not in power-up selection phase or no available power-ups for player ${playerId}. powerUpSelectionPhase: ${
          room.powerUpSelectionPhase
        }, hasAvailablePowerUps: ${!!room.playerAvailablePowerUps[playerId]}`
      );
    }
  });

  socket.on("power_up_selected", (data) => {
    const { roomId, playerId, powerUpType } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    console.log(
      `Power-up selected: ${powerUpType} by player ${playerId} in room ${roomId}`
    );

    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    const player = room.players.find((p) => p.id === playerId);

    if (!player || !room.powerUpSelectionPhase) return;

    // Store the player's power-up selection
    player.selectedPowerUp = powerUpType;
    room.playersSelectedPowerUps[playerId] = powerUpType;

    // Check if both players have selected their power-ups
    const selectedCount = Object.keys(room.playersSelectedPowerUps).length;

    console.log(
      `${selectedCount} out of ${room.players.length} players have selected power-ups`
    );

    if (selectedCount === 2) {
      // Both players have selected, proceed with salt throwing
      room.powerUpSelectionPhase = false;

      console.log(
        `All players selected, starting salt throwing in room ${roomId}`
      );

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
      selections: room.playersSelectedPowerUps,
    });
  });

  socket.on("rematch_count", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);

    if (roomIndex === -1) return; // Room not found

    if (data.acceptedRematch && data.playerId === socket.id) {
      rooms[roomIndex].rematchCount++;
      io.in(data.roomId).emit("rematch_count", rooms[roomIndex].rematchCount);
    } else if (!data.acceptedRematch && data.playerId === socket.id) {
      rooms[roomIndex].rematchCount--;
      io.in(data.roomId).emit("rematch_count", rooms[roomIndex].rematchCount);
    }

    if (rooms[roomIndex].rematchCount > 1) {
      rooms[roomIndex].matchOver = false;
      rooms[roomIndex].gameOver = true;
      rooms[roomIndex].rematchCount = 0;
      io.in(data.roomId).emit("rematch_count", rooms[roomIndex].rematchCount);
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
    io.to(roomId).emit("rooms", rooms);
    // console.log(rooms[roomIndex].players);
  });

  socket.on("fighter_action", (data) => {
    let roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return; // Room not found

    let playerIndex = rooms[roomIndex].players.findIndex(
      (player) => player.id === data.id
    );

    if (playerIndex === -1) return; // Player not found

    let player = rooms[roomIndex].players[playerIndex];
    let opponent = rooms[roomIndex].players.find((p) => p.id !== player.id);

    if (
      (rooms[roomIndex].gameOver && !rooms[roomIndex].matchOver) ||
      rooms[roomIndex].matchOver
    ) {
      return; // Skip all other actions if the game is over
    }

    // Block all actions if player is moving to ready position
    if (player.canMoveToReady) {
      return;
    }

    // Block all inputs during salt throwing phase and ready positioning phase
    // This prevents inputs from power-up selection end until game start (hakkiyoi = 1)
    if (!rooms[roomIndex].gameStart || rooms[roomIndex].hakkiyoiCount === 0) {
      return;
    }

    // Block all inputs during pumo army spawning animation
    if (player.isSpawningPumoArmy) {
      return;
    }

    // Input lockout window: allow key state refresh but block actions
    if (player.inputLockUntil && Date.now() < player.inputLockUntil) {
      if (data.keys) {
        player.keys = data.keys;
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

    // Debug data.keys during grab clashing
    if (player.isGrabClashing) {
      console.log(
        `🥊 FIGHTER_ACTION DEBUG: Player ${player.id} isGrabClashing=${player.isGrabClashing}, data.keys=`,
        data.keys
      );
    }

    // Count inputs during grab clash - HAPPENS BEFORE BLOCKING
    if (player.isGrabClashing && rooms[roomIndex].grabClashData && data.keys) {
      // Track previous keys for input detection - get from player state
      const previousKeys = { ...player.keys };

      console.log(
        `🥊 GRAB CLASH DEBUG: Player ${player.id} is clashing, checking inputs...`
      );
      console.log(`🥊 CURRENT KEYS:`, data.keys);
      console.log(`🥊 PREVIOUS KEYS:`, previousKeys);

      // Update player keys FIRST so next event can detect changes
      player.keys = data.keys;

      // Count any key press (not key holds) as mashing input
      const mashKeys = [
        "w",
        "a",
        "s",
        "d",
        "mouse1",
        "mouse2",
        "e",
        "f",
        "shift",
      ];
      let inputDetected = false;
      let detectedKey = null;

      for (const key of mashKeys) {
        if (data.keys[key] && !previousKeys[key]) {
          inputDetected = true;
          detectedKey = key;
          break;
        }
      }

      console.log(`🥊 INPUT DETECTED: ${inputDetected}, KEY: ${detectedKey}`);

      if (inputDetected) {
        player.grabClashInputCount++;

        // Update room clash data
        if (player.id === rooms[roomIndex].grabClashData.player1Id) {
          rooms[roomIndex].grabClashData.player1Inputs++;
          console.log(
            `🥊 PLAYER 1 (${player.id}) INPUT COUNT: ${rooms[roomIndex].grabClashData.player1Inputs}`
          );
        } else if (player.id === rooms[roomIndex].grabClashData.player2Id) {
          rooms[roomIndex].grabClashData.player2Inputs++;
          console.log(
            `🥊 PLAYER 2 (${player.id}) INPUT COUNT: ${rooms[roomIndex].grabClashData.player2Inputs}`
          );
        }

        console.log(`🥊 EMITTING PROGRESS UPDATE TO ROOM: ${roomId}`);
        console.log(`🥊 PROGRESS DATA:`, {
          player1Inputs: rooms[roomIndex].grabClashData.player1Inputs,
          player2Inputs: rooms[roomIndex].grabClashData.player2Inputs,
          player1Id: rooms[roomIndex].grabClashData.player1Id,
          player2Id: rooms[roomIndex].grabClashData.player2Id,
        });

        // Emit progress update to all players in the room
        io.in(roomId).emit("grab_clash_progress", {
          player1Inputs: rooms[roomIndex].grabClashData.player1Inputs,
          player2Inputs: rooms[roomIndex].grabClashData.player2Inputs,
          player1Id: rooms[roomIndex].grabClashData.player1Id,
          player2Id: rooms[roomIndex].grabClashData.player2Id,
        });

        console.log(
          `Player ${player.id} mashed input during grab clash. Total inputs: ${player.grabClashInputCount}`
        );
      }
    }

    // Block all actions (except input counting) during grab clashing
    if (player.isGrabClashing) {
      console.log(
        `🥊 BLOCKING OTHER ACTIONS: Player ${player.id} is grab clashing, blocking non-input actions`
      );
      return;
    }

    // If room is in hitstop, buffer key states but block actions for both players
    if (isRoomInHitstop(rooms[roomIndex])) {
      if (data.keys) {
        player.keys = data.keys;
      }
      return;
    }

    // Helper function to check if player is in a charged attack execution state
    const isInChargedAttackExecution = () => {
      return player.isAttacking && player.attackType === "charged";
    };

    // Helper function to check if an action should be blocked
    const shouldBlockAction = (allowDodgeCancelRecovery = false) => {
      // Global action lock gate to serialize actions visually/feel-wise
      if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
        return true;
      }
      // Always block during charged attack execution
      if (isInChargedAttackExecution()) {
        return true;
      }
      // Block during grab break animation
      if (player.isGrabBreaking) {
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
      // Track mouse1 state changes to prevent repeated slap attacks while holding
      const previousMouse1State = player.keys.mouse1;
      const previousKeys = { ...player.keys };
      player.keys = data.keys;

      // Set mouse1 press flags
      player.mouse1JustPressed = !previousMouse1State && data.keys.mouse1;
      player.mouse1JustReleased = previousMouse1State && !data.keys.mouse1;

      // Debug logging for F key and snowball power-up
      if (data.keys.f) {
        console.log(
          `Player ${player.id} pressed F key. PowerUp: ${player.activePowerUp}, Cooldown: ${player.snowballCooldown}, isThrowingSnowball: ${player.isThrowingSnowball}`
        );
      }

      // If spacebar was released after a grab break, allow raw parry again
      if (
        !player.keys[" "] &&
        previousKeys[" "] &&
        player.grabBreakSpaceConsumed
      ) {
        player.grabBreakSpaceConsumed = false;
        // Also ensure grab-break animation is not lingering
        if (!player.isGrabBreaking) {
          // no-op; flag reset is enough
        }
      }

      // Grab Break: break out when being grabbed with spacebar, at stamina cost
      if (
        player.isBeingGrabbed &&
        player.keys[" "] &&
        !previousKeys[" "] &&
        !player.isGrabBreaking &&
        player.stamina >= GRAB_BREAK_STAMINA_COST
      ) {
        const room = rooms[roomIndex];
        const grabber = room.players.find(
          (p) =>
            p.id !== player.id &&
            p.isGrabbing &&
            p.grabbedOpponent === player.id
        );

        if (grabber) {
          console.log(
            `🛡️ GRAB BREAK: Player ${player.id} breaking grab from ${grabber.id}`
          );

          // Deduct stamina
          player.stamina = Math.max(
            0,
            player.stamina - GRAB_BREAK_STAMINA_COST
          );

          // Clear grab states for both
          cleanupGrabStates(grabber, player);

          // Animation state - only the breaker shows grab break
          player.isGrabBreaking = true;
          // Consume this space press so raw parry cannot start until release
          player.grabBreakSpaceConsumed = true;

          // The grabber shows a countered placeholder animation (not true hit state)
          grabber.isGrabBreaking = false;
          grabber.isGrabBreakCountered = true;
          // Auto-clear countered flag after a short duration
          setPlayerTimeout(
            grabber.id,
            () => {
              grabber.isGrabBreakCountered = false;
            },
            GRAB_BREAK_ANIMATION_DURATION,
            "grabBreakHitReset"
          );
          setPlayerTimeout(
            player.id,
            () => {
              player.isGrabBreaking = false;
            },
            GRAB_BREAK_ANIMATION_DURATION,
            "grabBreakAnim"
          );

          // Determine directions and push apart without crossing boundaries
          const leftBoundary = MAP_LEFT_BOUNDARY;
          const rightBoundary = MAP_RIGHT_BOUNDARY;
          const dir = player.x < grabber.x ? -1 : 1; // player pushes outward
          const pushDistance =
            GRAB_BREAK_PUSH_VELOCITY * GRAB_BREAK_SEPARATION_MULTIPLIER;

          const playerTargetX = Math.max(
            leftBoundary,
            Math.min(player.x + dir * pushDistance, rightBoundary)
          );
          const grabberTargetX = Math.max(
            leftBoundary,
            Math.min(grabber.x - dir * pushDistance, rightBoundary)
          );

          // Initialize smooth separation tween for both players
          const now = Date.now();
          // Breaker tween
          player.isGrabBreakSeparating = true;
          player.grabBreakSepStartTime = now;
          player.grabBreakSepDuration = GRAB_BREAK_SEPARATION_DURATION;
          player.grabBreakStartX = player.x;
          player.grabBreakTargetX = playerTargetX;
          // Grabber tween
          grabber.isGrabBreakSeparating = true;
          grabber.grabBreakSepStartTime = now;
          grabber.grabBreakSepDuration = GRAB_BREAK_SEPARATION_DURATION;
          grabber.grabBreakStartX = grabber.x;
          grabber.grabBreakTargetX = grabberTargetX;

          // Zero out velocities during tween to prevent sliding interference
          player.movementVelocity = 0;
          grabber.movementVelocity = 0;

          // Do not set isHit or knockbackVelocity, to avoid bypassing boundary checks
          player.isStrafing = false;
          grabber.isStrafing = false;

          // Short cooldown to prevent immediate re-grab
          grabber.grabCooldown = true;
          setPlayerTimeout(
            grabber.id,
            () => {
              grabber.grabCooldown = false;
            },
            600,
            "grabBreakCooldown"
          );

          // Emit for client VFX/SFX
          io.in(room.id).emit("grab_break", {
            breakerId: player.id,
            grabberId: grabber.id,
            breakerX: player.x,
            grabberX: grabber.x,
          });
        }
      }
    }

    // Handle clearing charge during charging phase with mouse1 - MUST BE FIRST
    if (
      player.mouse1JustPressed &&
      player.isChargingAttack // Only interrupt during charging phase, not execution
    ) {
      console.log(`Player ${player.id} interrupting charge with slap`);
      // Clear charge state
      clearChargeState(player);

      // Execute slap attack immediately
      executeSlapAttack(player, rooms);
      return; // Exit early to prevent other input processing
    }

    // Handle clearing charge during charging phase with throw/grab/snowball - MUST BE FIRST
    if (
      ((player.keys.w && player.isGrabbing && !player.isBeingGrabbed) ||
        player.keys.e ||
        player.keys.f) &&
      player.isChargingAttack // Only interrupt during charging phase, not execution
    ) {
      console.log(`Player ${player.id} interrupting charge with W/E/F input`);
      // Clear charge state
      clearChargeState(player);

      // The existing input handlers will take over for W/E/F
    }

    if (
      false && // Disabled: power-ups are now selected via UI
      player.keys.f &&
      !player.saltCooldown &&
      ((player.fighter === "player 1" && player.x <= 280) ||
        (player.fighter === "player 2" && player.x >= 765)) && // Adjusted range for player 2
      rooms[roomIndex].gameStart === false &&
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

    // Handle F key power-ups (snowball and pumo army) - block during charged attack execution and recovery
    if (
      player.keys.f &&
      !shouldBlockAction() &&
      (player.activePowerUp === POWER_UP_TYPES.SNOWBALL ||
        player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) &&
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
        console.log(
          `Player ${player.id} cancelling charge attack for F key power-up`
        );
        clearChargeState(player);
      }

      if (player.activePowerUp === POWER_UP_TYPES.SNOWBALL) {
        console.log(`Player ${player.id} attempting to throw snowball`);

        // Set throwing state
        player.isThrowingSnowball = true;
        // Lock actions during throw windup/animation window for visual clarity
        player.currentAction = "snowball";
        player.actionLockUntil = Date.now() + 250;

        // Determine snowball direction based on current position relative to opponent
        const opponent = rooms[roomIndex].players.find(
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

        console.log(`Created snowball:`, snowball);

        // Reset throwing state after animation
        setPlayerTimeout(
          player.id,
          () => {
            player.isThrowingSnowball = false;
            console.log(`Player ${player.id} finished throwing snowball`);
            // Clear lock if it’s still set
            if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
              player.actionLockUntil = 0;
            }

            // Check if we should restart charging after snowball throw completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          },
          500
        );
      } else if (player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) {
        console.log(`Player ${player.id} attempting to spawn pumo army`);

        // Set spawning state
        player.isSpawningPumoArmy = true;
        player.currentAction = "pumo_army";
        player.actionLockUntil = Date.now() + 400;

        // Clear any existing movement momentum to prevent sliding during animation
        player.movementVelocity = 0;
        player.isStrafing = false;

        // Determine army direction (same as player facing)
        const armyDirection = player.facing === 1 ? -1 : 1; // Army moves in direction player is facing

        // Spawn multiple mini clones sequentially
        const numClones = 5;
        const spawnDelay = 1000; // 1 second between spawns
        const startX = armyDirection === 1 ? 0 : 1150; // Start from opposite side of map

        // Spawn clones one at a time with delays
        for (let i = 0; i < numClones; i++) {
          setPlayerTimeout(
            player.id,
            () => {
              const clone = {
                id: Math.random().toString(36).substr(2, 9),
                x: startX,
                y: GROUND_LEVEL + 5,
                velocityX: armyDirection * 1.5, // Speed of movement
                facing: armyDirection, // Face the direction they're moving (1 = right, -1 = left)
                isStrafing: true, // Use strafing animation
                isSlapAttacking: true, // Keep for combat functionality
                slapCooldown: 0,
                lastSlapTime: 0,
                spawnTime: Date.now(),
                lifespan: 3000, // 3 seconds lifespan
                ownerId: player.id,
                ownerFighter: player.fighter, // Add fighter type for image selection
                hasHit: false,
                size: 0.6, // Smaller than normal players
              };
              player.pumoArmy.push(clone);

              console.log(
                `Spawned clone ${i + 1}/${numClones} for player ${player.id}`
              );
            },
            i * spawnDelay
          );
        }

        player.pumoArmyCooldown = true;

        console.log(
          `Created pumo army with ${numClones} clones for player ${player.id}`
        );

        // Reset spawning state after animation
        setPlayerTimeout(
          player.id,
          () => {
            player.isSpawningPumoArmy = false;
            console.log(`Player ${player.id} finished spawning pumo army`);
            if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
              player.actionLockUntil = 0;
            }

            // Check if we should restart charging after pumo army spawn completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          },
          800
        );
      }
    }

    // Handle dodge - allow canceling recovery but block during charged attack execution
    if (
      player.keys["shift"] &&
      !player.keys.e &&
      !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
      !isInChargedAttackExecution() && // Block during charged attack execution
      canPlayerUseAction(player) &&
      player.dodgeCharges > 0 // Check if player has dodge charges
    ) {
      console.log("Executing immediate dodge");

      // Allow dodge to cancel recovery
      if (player.isRecovering) {
        // Add grace period - don't allow dodge to cancel recovery for 100ms after it starts
        // This prevents immediate dodge from canceling recovery that was just set
        const recoveryAge = Date.now() - player.recoveryStartTime;
        console.log(
          `Dodge attempting to cancel recovery - age: ${recoveryAge}ms, grace period: 100ms`
        );
        if (recoveryAge > 100) {
          console.log("Dodge canceling recovery state");
          player.isRecovering = false;
          player.movementVelocity = 0;
          player.recoveryDirection = null;
        } else {
          console.log(
            `Dodge blocked - recovery too fresh (${recoveryAge}ms old)`
          );
          return; // Don't execute dodge if recovery is too fresh
        }
      }

      player.isDodging = true;
      player.dodgeStartTime = Date.now();
      player.dodgeEndTime = Date.now() + 450; // Increased from 400ms for more weighty feel
      player.dodgeStartX = player.x;
      player.dodgeStartY = player.y;
      player.currentAction = "dodge";
      player.actionLockUntil = Date.now() + 120; // brief lock to avoid overlap jitters

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
        if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
          player.actionLockUntil = 0;
        }

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
            player.dodgeEndTime = Date.now() + 450; // Updated to match new dodge duration
            player.dodgeDirection = action.direction;
            player.dodgeStartX = player.x;
            player.dodgeStartY = player.y;
          }
        }

        // Handle pending charge attack
        if (player.pendingChargeAttack && player.spacebarReleasedDuringDodge) {
          const chargePercentage = player.pendingChargeAttack.power;

          // Determine if it's a slap or charged attack
          if (player.keys.mouse1) {
            // Use the simplified slap attack system

            executeSlapAttack(player, rooms);
          } else {
            executeChargedAttack(player, chargePercentage, rooms);
          }

          // Reset charging state
          player.isChargingAttack = false;
          player.pendingChargeAttack = null;
          player.spacebarReleasedDuringDodge = false;
        }
      }, 450); // Updated to match new dodge duration
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
      !isInChargedAttackExecution() && // Block buffering during charged attack execution
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

    // Start charging attack - block during charged attack execution and recovery
    if (player.keys.mouse2 && !shouldBlockAction() && canPlayerCharge(player)) {
      // Start charging
      startCharging(player);
      player.spacebarReleasedDuringDodge = false;
    }
    // For continuing a charge - block during charged attack execution and recovery
    else if (
      player.keys.mouse2 &&
      !shouldBlockAction() &&
      (player.isChargingAttack || player.isDodging) &&
      !player.isHit &&
      !player.isRawParryStun &&
      !player.isRawParrying // Block continuing charge during raw parry
      // Removed !player.isThrowingSnowball to allow smooth charging during snowball animation
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
        console.log(
          `Player ${player.id} holding mouse2 during charged attack - setting restart flag`
        );
      }
      player.wantsToRestartCharge = true;
    }

    // Also check if mouse2 is being held when we're about to execute a charged attack
    if (
      player.keys.mouse2 &&
      player.pendingChargeAttack &&
      !player.isAttacking
    ) {
      console.log(
        `Player ${player.id} holding mouse2 with pending charge attack - setting restart flag`
      );
      player.wantsToRestartCharge = true;
    }
    // Release charged attack when mouse2 is released - block during charged attack execution and recovery
    else if (
      !player.keys.mouse2 &&
      player.isChargingAttack &&
      !shouldBlockAction() &&
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

    // Add new section to handle state transitions while holding mouse2 - block during charged attack execution and recovery
    if (
      player.keys.mouse2 &&
      !shouldBlockAction() &&
      canPlayerCharge(player) &&
      !player.isSlapAttack && // Add explicit check for slap attacks
      !player.isJumping // Add explicit check for jumping
    ) {
      // Check if we should resume charging after a state transition
      const timeSinceLastCharge = Date.now() - (player.lastChargeEndTime || 0);

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

    // Handle slap attacks with mouse1 - block during charged attack execution and recovery
    if (
      player.mouse1JustPressed &&
      !shouldBlockAction() &&
      canPlayerSlap(player)
    ) {
      // Simply execute slap attack - it will handle queuing internally if already attacking
      executeSlapAttack(player, rooms);
      // Short lock to prevent other actions from starting on the same frame burst
      player.currentAction = "slap";
      player.actionLockUntil = Date.now() + 80; // ~5 frames at 60fps
    }

    function isOpponentCloseEnoughForGrab(player, opponent) {
      // Calculate grab range based on player size
      const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
      return Math.abs(player.x - opponent.x) < grabRange;
    }

    // Handle throw attacks - only when currently grabbing opponent
    if (
      player.keys.w &&
      player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.keys.e &&
      !shouldBlockAction() &&
      !player.isThrowingSalt &&
      !player.canMoveToReady &&
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

      setPlayerTimeout(
        player.id,
        () => {
          const opponent = rooms[roomIndex].players.find(
            (p) => p.id !== player.id
          );

          if (
            isOpponentCloseEnoughForThrow(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isDodging
          ) {
            if (checkForGrabPriority(player, opponent)) {
              // Opponent grabbed at the same time, grab wins - cancel this throw
              console.log(`Throw cancelled: Opponent grabbed at the same time`);
              return;
            } else if (checkForThrowTech(player, opponent)) {
              applyThrowTech(player, opponent);
            } else if (!player.throwTechCooldown) {
              clearChargeState(player, true); // true = cancelled by throw

              // Clear momentum when successfully throwing an opponent
              player.movementVelocity = 0;
              player.isStrafing = false;

              player.isThrowing = true;
              player.throwStartTime = Date.now();
              player.throwEndTime = Date.now() + 400;
              player.throwOpponent = opponent.id;
              player.currentAction = "throw";
              player.actionLockUntil = Date.now() + 200;
              opponent.isBeingThrown = true;
              opponent.isHit = false;

              // Clear grab states immediately when transitioning into throw
              if (player.isGrabbing) {
                player.isGrabbing = false;
                player.grabbedOpponent = null;
              }
              if (opponent.isBeingGrabbed) {
                opponent.isBeingGrabbed = false;
              }

              // Clear isAtTheRopes state if player gets thrown during the stun
              if (opponent.isAtTheRopes) {
                opponent.isAtTheRopes = false;
                opponent.atTheRopesStartTime = 0;
                // Clear any existing timeout for the at-the-ropes state
                timeoutManager.clearPlayerSpecific(
                  opponent.id,
                  "atTheRopesTimeout"
                );
              }

              player.throwCooldown = true;
              setPlayerTimeout(
                player.id,
                () => {
                  player.throwCooldown = false;
                  if (
                    player.actionLockUntil &&
                    Date.now() < player.actionLockUntil
                  ) {
                    player.actionLockUntil = 0;
                  }
                },
                250
              );
            }
          } else {
            if (checkForGrabPriority(player, opponent)) {
              // Opponent grabbed at the same time, grab wins - cancel this throw
              console.log(
                `Missed throw cancelled: Opponent grabbed at the same time`
              );
              return;
            }

            clearChargeState(player, true); // true = cancelled by throw

            player.isThrowing = true;
            player.throwStartTime = Date.now();
            player.throwEndTime = Date.now() + 400;
            player.currentAction = "throw";
            player.actionLockUntil = Date.now() + 200;

            player.throwCooldown = true;
            setPlayerTimeout(
              player.id,
              () => {
                player.throwCooldown = false;
                if (
                  player.actionLockUntil &&
                  Date.now() < player.actionLockUntil
                ) {
                  player.actionLockUntil = 0;
                }
              },
              250
            );
          }
        },
        64
      );
    }

    // Handle grab attacks - block during charged attack execution and recovery
    if (
      player.keys.e &&
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
      !player.isGrabStartup
    ) {
      player.lastGrabAttemptTime = Date.now();

      // Clear charging attack state when starting grab
      clearChargeState(player, true); // true = cancelled by grab

      // Begin startup pause with small hop
      player.isGrabStartup = true;
      player.grabStartupStartTime = Date.now();
      player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
      player.currentAction = "grab_startup";
      player.actionLockUntil =
        Date.now() + Math.min(120, GRAB_STARTUP_DURATION_MS);
      // Immediately telegraph the grab attempt to the client sprites
      player.grabState = GRAB_STATES.ATTEMPTING;
      player.grabAttemptType = "grab";

      // Clear any existing movement momentum
      player.movementVelocity = 0;
      player.isStrafing = false;

      console.log(
        `Player ${player.id} starting grab startup (hop), facing: ${player.facing}`
      );

      // Set up the grab duration timer (750ms) relative to movement start; schedule once movement begins in tick
      setPlayerTimeout(
        player.id,
        () => {
          // If still in grab movement after 750ms, it's a whiff
          if (player.isGrabbingMovement && !player.grabbedOpponent) {
            console.log(`Player ${player.id} grab whiffed after 750ms`);

            player.isGrabbingMovement = false;
            player.isWhiffingGrab = true;
            player.grabMovementVelocity = 0;
            // Clear grab telegraph state on whiff
            player.grabState = GRAB_STATES.INITIAL;
            player.grabAttemptType = null;

            // Set grab cooldown for whiffed grab
            player.grabCooldown = true;
            setPlayerTimeout(
              player.id,
              () => {
                player.grabCooldown = false;
              },
              1100
            );

            // End whiff state after 200ms
            setPlayerTimeout(
              player.id,
              () => {
                player.isWhiffingGrab = false;
                console.log(`Player ${player.id} recovered from grab whiff`);

                // Check if we should restart charging after grab whiff completes
                if (shouldRestartCharging(player)) {
                  startCharging(player);
                }
              },
              200
            );
          }
        },
        750,
        "grabMovementTimeout"
      );
    }
  });

  // TEST EVENT - Force opponent disconnection (for debugging)
  socket.on("test_force_disconnect", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      console.log(`TESTING: Force disconnect in room ${roomId}`);
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
      console.log(
        `Player ${socket.id} exiting from disconnected game in room ${roomId}`
      );

      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
      }

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
      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
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

      console.log(
        `LEAVE_ROOM DEBUG: Room ${roomId} - gameStart: ${rooms[roomIndex].gameStart}, gameOver: ${rooms[roomIndex].gameOver}, powerUpSelectionPhase: ${rooms[roomIndex].powerUpSelectionPhase}, isInGameSession: ${isInGameSession}, hadTwoPlayers: ${hadTwoPlayers}, hakkiyoiCount: ${rooms[roomIndex].hakkiyoiCount}`
      );
      console.log(
        `LEAVE_ROOM PHASE CHECK: powerUpSelectionPhase=${
          rooms[roomIndex].powerUpSelectionPhase
        }, gameStart=${
          rooms[roomIndex].gameStart
        }, anyPlayerThrowingSalt=${rooms[roomIndex].players.some(
          (p) => p.isThrowingSalt
        )}, anyPlayerCannotMoveToReady=${rooms[roomIndex].players.some(
          (p) => p.canMoveToReady === false
        )}`
      );
      console.log(
        `LEAVE_ROOM DEBUG: Players salt throwing states:`,
        rooms[roomIndex].players.map((p) => ({
          id: p.id,
          isThrowingSalt: p.isThrowingSalt,
          canMoveToReady: p.canMoveToReady,
        }))
      );

      // Remove the player from the room
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      // Handle opponent disconnection during active game session
      if (
        isInGameSession &&
        hadTwoPlayers &&
        rooms[roomIndex].players.length === 1
      ) {
        console.log(
          `OPPONENT DISCONNECTED: Player left during active game in room ${roomId}, marking as opponent disconnected`
        );
        rooms[roomIndex].opponentDisconnected = true;
        rooms[roomIndex].disconnectedDuringGame = true;

        // Emit opponent disconnected event to the remaining player
        const remainingPlayer = rooms[roomIndex].players[0];
        console.log(
          `LEAVE_ROOM: EMITTING opponent_disconnected to player ${remainingPlayer.id} (fighter: ${remainingPlayer.fighter}) in room ${roomId}`
        );
        console.log(`LEAVE_ROOM: Disconnecting player was: ${socket.id}`);
        console.log(
          `LEAVE_ROOM: Room players after disconnect:`,
          rooms[roomIndex].players.map((p) => ({
            id: p.id,
            fighter: p.fighter,
          }))
        );
        io.to(remainingPlayer.id).emit("opponent_disconnected", {
          roomId: roomId,
          message: "Opponent disconnected",
        });

        // Emit rooms data after a small delay to ensure client processes the disconnection event first
        setTimeout(() => {
          console.log(
            `DELAYED ROOMS EMIT (LEAVE): Room ${roomId} state - opponentDisconnected: ${rooms[roomIndex].opponentDisconnected}, players: ${rooms[roomIndex].players.length}`
          );
          io.emit("rooms", getCleanedRoomsData(rooms));
        }, 100);
      }
      // If the remaining player from a disconnected game is leaving, reset the room
      else if (
        rooms[roomIndex].opponentDisconnected &&
        rooms[roomIndex].players.length === 0
      ) {
        console.log(
          `Last player leaving disconnected room ${roomId}, resetting room state`
        );
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
        console.log(
          `LEAVE_ROOM: Resetting remaining player ${p.id} to player 1. Old fighter: ${p.fighter}`
        );
        // Reset to player 1 position and appearance
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 245;
        p.facing = 1;
        // Clean up any player-specific state
        cleanupPlayerStates(p);
        console.log(
          `LEAVE_ROOM: Player reset complete. New fighter: ${p.fighter}`
        );
      }

      // Emit updates to all clients (only if not in disconnected state)
      if (!rooms[roomIndex].opponentDisconnected) {
        console.log(
          `LEAVE_ROOM: Emitting events to room ${roomId}. Players remaining: ${rooms[roomIndex].players.length}`
        );
        console.log(
          `LEAVE_ROOM: Updated players array:`,
          rooms[roomIndex].players.map((p) => ({
            id: p.id,
            fighter: p.fighter,
          }))
        );
        io.in(roomId).emit("player_left");
        io.in(roomId).emit("ready_count", rooms[roomIndex].readyCount);
        io.to(roomId).emit("lobby", rooms[roomIndex].players);
      }

      // Only emit rooms data immediately if not in disconnected state (delayed emit handles disconnected case)
      if (!rooms[roomIndex].opponentDisconnected) {
        console.log(
          `EMITTING ROOMS DATA: Room ${roomId} state - opponentDisconnected: ${rooms[roomIndex].opponentDisconnected}, players: ${rooms[roomIndex].players.length}`
        );
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

    if (rooms[roomIndex]) {
      // Clear any active round start timer to prevent interference
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
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

      console.log(
        `DISCONNECT DEBUG: Room ${roomId} - gameStart: ${rooms[roomIndex].gameStart}, gameOver: ${rooms[roomIndex].gameOver}, powerUpSelectionPhase: ${rooms[roomIndex].powerUpSelectionPhase}, isInGameSession: ${isInGameSession}, hadTwoPlayers: ${hadTwoPlayers}, hakkiyoiCount: ${rooms[roomIndex].hakkiyoiCount}`
      );
      console.log(
        `DISCONNECT PHASE CHECK: powerUpSelectionPhase=${
          rooms[roomIndex].powerUpSelectionPhase
        }, gameStart=${
          rooms[roomIndex].gameStart
        }, anyPlayerThrowingSalt=${rooms[roomIndex].players.some(
          (p) => p.isThrowingSalt
        )}, anyPlayerCannotMoveToReady=${rooms[roomIndex].players.some(
          (p) => p.canMoveToReady === false
        )}`
      );
      console.log(
        `DISCONNECT DEBUG: Players salt throwing states:`,
        rooms[roomIndex].players.map((p) => ({
          id: p.id,
          isThrowingSalt: p.isThrowingSalt,
          canMoveToReady: p.canMoveToReady,
        }))
      );

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

      // Handle opponent disconnection during active game session
      if (
        isInGameSession &&
        hadTwoPlayers &&
        rooms[roomIndex].players.length === 1
      ) {
        console.log(
          `OPPONENT DISCONNECTED: Player disconnected during active game in room ${roomId}, marking as opponent disconnected`
        );
        rooms[roomIndex].opponentDisconnected = true;
        rooms[roomIndex].disconnectedDuringGame = true;

        // Emit opponent disconnected event to the remaining player
        const remainingPlayer = rooms[roomIndex].players[0];
        console.log(
          `DISCONNECT: EMITTING opponent_disconnected to player ${remainingPlayer.id} (fighter: ${remainingPlayer.fighter}) in room ${roomId}`
        );
        console.log(`DISCONNECT: Disconnecting player was: ${socket.id}`);
        console.log(
          `DISCONNECT: Room players after disconnect:`,
          rooms[roomIndex].players.map((p) => ({
            id: p.id,
            fighter: p.fighter,
          }))
        );
        io.to(remainingPlayer.id).emit("opponent_disconnected", {
          roomId: roomId,
          message: "Opponent disconnected",
        });

        // Emit rooms data after a small delay to ensure client processes the disconnection event first
        setTimeout(() => {
          console.log(
            `DELAYED ROOMS EMIT: Room ${roomId} state - opponentDisconnected: ${rooms[roomIndex].opponentDisconnected}, players: ${rooms[roomIndex].players.length}`
          );
          io.emit("rooms", getCleanedRoomsData(rooms));
        }, 100);
      }
      // If the remaining player from a disconnected game is leaving, reset the room
      else if (
        rooms[roomIndex].opponentDisconnected &&
        rooms[roomIndex].players.length === 0
      ) {
        console.log(
          `Last player leaving disconnected room ${roomId}, resetting room state`
        );
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
        console.log(
          `DISCONNECT - EMITTING ROOMS DATA: Room ${roomId} state - opponentDisconnected: ${rooms[roomIndex].opponentDisconnected}, players: ${rooms[roomIndex].players.length}`
        );
        io.emit("rooms", getCleanedRoomsData(rooms));
      }
    }
    console.log(`${reason}: ${socket.id}`);
  });
});

// Update server listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

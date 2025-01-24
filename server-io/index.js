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
}));

let index;
let gameLoop = null;
let staminaRegenCounter = 0;
const TICK_RATE = 64;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.3;
const GROUND_LEVEL = 130;
const HITBOX_DISTANCE_VALUE = 90;

function resetRoomAndPlayers(room) {
  // Reset room state
  room.gameStart = false;
  room.gameOver = false;
  room.gameOverTime = null;
  delete room.winnerId;
  delete room.loserId;
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
    player.x = player.fighter === "player 1" ? 150 : 900; // Reset position based on facing
    player.y = GROUND_LEVEL;
    player.knockbackVelocity = { x: 0, y: 0 };
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
    const distance = Math.abs(player.x - opponent.x); // Calculate the distance between the player and the opponent
    const THROW_DISTANCE_THRESHOLD = 230; // Define the maximum distance for a throw to be possible
    return distance <= THROW_DISTANCE_THRESHOLD; // Return true if the distance is within the threshold, otherwise false
  }

  function tick(delta) {
    rooms.forEach((room) => {
      if (room.players.length < 2) return;

      staminaRegenCounter += delta;

      if (room.players.length === 2) {
        const [player1, player2] = room.players;

        // Check for collision and adjust positions
        if (
          arePlayersColliding(player1, player2) &&
          !player1.isAttacking &&
          !player2.isAttacking
        ) {
          adjustPlayerPositions(player1, player2, delta);
        }

        if (
          !player1.isGrabbing &&
          !player1.isBeingGrabbed &&
          !player2.isGrabbing &&
          !player2.isBeingGrabbed
        ) {
          if (
            player1.x < player2.x &&
            !player1.isThrowing &&
            !player2.isThrowing
          ) {
            player1.facing = -1; // Player 1 faces right
            player2.facing = 1; // Player 2 faces left
          } else if (!player1.isThrowing && !player2.isThrowing) {
            player1.facing = 1; // Player 1 faces left
            player2.facing = -1; // Player 2 faces right
          }
        }

        // Update facing direction based on relative positions
        if (player1.x < player2.x) {
          player1.facing = -1; // Player 1 faces right
          player2.facing = 1; // Player 2 faces left
        } else {
          player1.facing = 1; // Player 1 faces left
          player2.facing = -1; // Player 2 faces right
        }

        if (room.gameStart === false) {
          if (player1.x >= 275) {
            player1.x = 275;
          }

          if (player2.x <= 715) {
            player2.x = 715;
          }

          if (player1.x === 275) {
            player1.isReady = true;
          }

          if (player2.x === 715) {
            player2.isReady = true;
          }
        }

        function arePlayersColliding(player1, player2) {
          if (player1.isDodging || player2.isDodging) {
            return false;
          }
          const player1Hitbox = {
            left: player1.x - 90,
            right: player1.x + 90,
            top: player1.y - 90,
            bottom: player1.y + 90,
          };

          const player2Hitbox = {
            left: player2.x - 90,
            right: player2.x + 90,
            top: player2.y - 90,
            bottom: player2.y + 90,
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
          const overlap =
            Math.min(
              player1.x + HITBOX_DISTANCE_VALUE,
              player2.x + HITBOX_DISTANCE_VALUE
            ) -
            Math.max(
              player1.x - HITBOX_DISTANCE_VALUE,
              player2.x - HITBOX_DISTANCE_VALUE
            );

          if (overlap > 0) {
            // Calculate adjustment value (half the overlap so both players move equally)
            const adjustment = overlap / 2;
            const smoothFactor = delta * 0.01; // Adjust this value to make the movement smoother or more abrupt

            // Determine the direction to move each player and apply the smooth factor
            if (player1.x < player2.x) {
              player1.x -= adjustment * smoothFactor;
              player2.x += adjustment * smoothFactor;
            } else {
              player1.x += adjustment * smoothFactor;
              player2.x -= adjustment * smoothFactor;
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
        // map boundries

        if (!player.isHit && !room.gameOver) {
          player.x = Math.max(-50, Math.min(player.x, 1055));
        }

        // Win Conditions
        if (
          (player.isHit && player.x <= -60 && !room.gameOver) ||
          (player.isHit && player.x >= 1080 && !room.gameOver) ||
          (player.isBeingGrabbed && player.x <= -60 && !room.gameOver) ||
          (player.isBeingGrabbed && player.x >= 1080 && !room.gameOver)
        ) {
          console.log("game over");
          room.gameOver = true;
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
          }

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

        if (player.isHit) {
          player.x += player.knockbackVelocity.x * delta * speedFactor;
          player.y += player.knockbackVelocity.y * delta * speedFactor;
          player.isAttacking = false;

          player.isStrafing = false;
          // Apply some deceleration or friction
          player.knockbackVelocity.x *= 0.9; // Adjust as needed
          player.knockbackVelocity.y *= 0.8;

          // When the velocity is low enough, you can stop the knockback effect
          if (Math.abs(player.knockbackVelocity.x) < 0.1) {
            player.knockbackVelocity.x = 0;
          }
          if (Math.abs(player.knockbackVelocity.y) < 0.1) {
            player.knockbackVelocity.y = 0;
          }

          // Make sure the player doesn't float in the air
          if (player.y < GROUND_LEVEL) {
            player.y = GROUND_LEVEL;
            player.knockbackVelocity.y = 0; // Reset vertical knockback
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
            const throwArcHeight = 450; // Adjust as needed
            // Calculate opponent's position in the throw arc
            if (!player.throwingFacingDirection) {
              player.throwingFacingDirection = player.facing;
              opponent.beingThrownFacingDirection = opponent.facing;
            }
            player.facing = player.throwingFacingDirection;
            opponent.facing = opponent.beingThrownFacingDirection;
            opponent.x =
              player.x + player.throwingFacingDirection * 215 * throwProgress; // Adjust 130 to control throw distance
            opponent.y =
              GROUND_LEVEL +
              3.2 * throwArcHeight * throwProgress * (1 - throwProgress); // Parabolic trajectory

            // Check if throw is complete
            if (currentTime >= player.throwEndTime) {
              player.isThrowing = false;
              opponent.isBeingThrown = false;
              opponent.isHit = false;
              player.throwOpponent = null;
              // Handle landing of the opponent
              opponent.y = GROUND_LEVEL;
              // opponent.knockbackVelocity.x = player.facing * 5; // Adjust for knockback effect
              opponent.knockbackVelocity.y = 0;
              // player.facing = player.throwingFacingDirection;
              player.throwingFacingDirection = null;
              opponent.beingThrownFacingDirection = null;
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

        // Dodging
        if (player.isDodging) {
          // Move the player forward on the x-axis

          if (player.keys.a) {
            player.x += -1 * delta * speedFactor * 1.8;
          } else if (player.keys.d) {
            player.x += 1 * delta * speedFactor * 1.8;
          } else if (player.keys.a && player.keys.d) {
            player.x +=
              (player.facing === -1 ? 1 : -1) * delta * speedFactor * 1.8;
          } else {
            player.x +=
              (player.facing === -1 ? 1 : -1) * delta * speedFactor * 1.8;
          }

          // End dodge if the duration is over
          if (Date.now() >= player.dodgeEndTime) {
            player.isDodging = false;
          }
        }

        // Strafing
        if (
          (!player.keys.s &&
            !player.isAttacking &&
            player.saltCooldown === false) ||
          (!player.keys.s &&
            player.isSlapAttack &&
            player.saltCooldown === false)
        ) {
          if (player.keys.d) {
            player.x += delta * speedFactor;
            player.isStrafing = true;
            player.isReady = false;
          }
          if (player.keys.a) {
            player.x -= delta * speedFactor;
            player.isStrafing = true;
            player.isReady = false;
          }
          if (!player.keys.a && !player.keys.d) {
            player.isStrafing = false;
          }
        }
        if (!player.keys.a && !player.keys.d) {
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
          player.x +=
            (player.facing === 1 ? -1 : 1) * delta * speedFactor * 2.5; // Adjust speed as needed

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
            if (grabDuration >= 1000) {
              // Release after 1.5 seconds
              player.isGrabbing = false;
              opponent.isHit = false;
              player.grabbedOpponent = null;
              opponent.isBeingGrabbed = false;
              delete player.grabFacingDirection;
            } else {
              // Move the opponent with the player
              const grabSpeed = speedFactor * 0.01; // Adjust this value to make it slower than normal walking speed
              let movement = 0;
              if (player.keys.d) {
                movement = delta * grabSpeed;
              } else if (player.keys.a) {
                movement = -delta * grabSpeed;
              }

              player.x += movement;
              opponent.x += movement;

              // maintain distance between players
              const fixedDistance = 150; // Adjust this value as needed
              if (player.grabFacingDirection === 1) {
                // player facing left
                opponent.x = player.x - fixedDistance;
              } else {
                // player facing right
                opponent.x = player.x + fixedDistance;
              }

              player.facing = player.grabFacingDirection;
              opponent.facing = -player.grabFacingDirection;
            }
          }
        } else if (player.isGrabbing && !player.grabbedOpponent) {
          const grabDuration = Date.now() - player.grabStartTime;
          if (grabDuration >= 500) {
            player.isGrabbing = false;
          }
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
    // Check if the player is attacking or other player is already hit or dead
    if (
      !player.isAttacking ||
      otherPlayer.isAlreadyHit ||
      otherPlayer.isDead ||
      otherPlayer.isDodging
    ) {
      return;
    }

    const playerHitbox = {
      left: player.x - HITBOX_DISTANCE_VALUE,
      right: player.x + HITBOX_DISTANCE_VALUE,
      top: player.y - HITBOX_DISTANCE_VALUE,
      bottom: player.y + HITBOX_DISTANCE_VALUE,
    };

    const opponentHitbox = {
      left: otherPlayer.x - HITBOX_DISTANCE_VALUE,
      right: otherPlayer.x + HITBOX_DISTANCE_VALUE,
      top: otherPlayer.y - HITBOX_DISTANCE_VALUE,
      bottom: otherPlayer.y + HITBOX_DISTANCE_VALUE,
    };

    // Simplified collision check
    const isCollision =
      playerHitbox.left < opponentHitbox.right &&
      playerHitbox.right > opponentHitbox.left &&
      playerHitbox.top < opponentHitbox.bottom &&
      playerHitbox.bottom > opponentHitbox.top;

    if (isCollision) {
      console.log("hit");
      if (player.isAttacking && otherPlayer.isAttacking) {
        resolveAttackConflict(player, otherPlayer);
      } else {
        processHit(player, otherPlayer);
      }
    }
  }

  function resolveAttackConflict(player1, player2) {
    const winner = Math.random() < 0.5 ? player1 : player2;
    const loser = winner === player1 ? player2 : player1;

    processHit(winner, loser);
  }

  function processHit(player, otherPlayer) {
    const MIN_ATTACK_DISPLAY_TIME = 300;
    const currentTime = Date.now();
    const attackDuration = currentTime - player.attackStartTime;

    if (attackDuration < MIN_ATTACK_DISPLAY_TIME) {
      setTimeout(() => {
        player.isAttacking = false;
      }, MIN_ATTACK_DISPLAY_TIME - attackDuration);
    } else {
      player.isAttacking = false;
    }

    // Check if the other player is blocking (crouching)
    if (otherPlayer.isCrouching) {
      // Apply knockback to the attacking player instead
      const knockbackDirection = player.facing === 1 ? 1 : -1;
      player.knockbackVelocity.x = 5 * knockbackDirection; // Adjust the knockback magnitude as necessary
      player.isHit = true; // Optional: If you want the attacker to also show a hit reaction

      // Set a timeout to reset the hit state of the attacking player, if needed
      setTimeout(() => {
        player.isHit = false;
      }, 300); // Adjust timeout as necessary
    } else {
      // Apply the knockback to the defending player
      otherPlayer.isHit = true;
      otherPlayer.isJumping = false;
      otherPlayer.isAttacking = false;
      otherPlayer.isStrafing = false;
      otherPlayer.isDiving = false;
      const knockbackDirection = player.facing === -1 ? 1 : -1;
      otherPlayer.knockbackVelocity.x = 7 * knockbackDirection;

      otherPlayer.isAlreadyHit = true;
      setTimeout(() => {
        otherPlayer.isHit = false;
        otherPlayer.isAlreadyHit = false;
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
        isAttackCooldown: false,
        isSlapAttack: false,
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
        isStrafing: false,
        isDiving: false,
        isCrouching: false,
        isDodging: false,
        dodgeEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        facing: 1,
        stamina: 100,
        x: 150,
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
        isAttackCooldown: false,
        isSlapAttack: false,
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
        isStrafing: false,
        isDiving: false,
        isCrouching: false,
        isDodging: false,
        dodgeEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        facing: -1,
        stamina: 100,
        x: 900,
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
    console.log(rooms[index].players);
  });

  socket.on("lobby", (data) => {
    let index = rooms.findIndex((room) => room.id === data.roomId);
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

    console.log(rooms[index].readyCount);
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
    console.log(rooms[index].players[playerIndex]);

    io.in(roomId).emit("lobby", rooms[index].players); // Update all players in the room
    io.to(roomId).emit("rooms", rooms);
    console.log(rooms[index].players);
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
      player.keys.f &&
      !player.saltCooldown &&
      (player.x <= -20 || player.x >= 1025) &&
      rooms[index].gameStart === false
    ) {
      player.isThrowingSalt = true;
      player.saltCooldown = true;

      setTimeout(() => {
        player.isThrowingSalt = false;
      }, 500);

      setTimeout(() => {
        player.saltCooldown = false;
      }, 500);
    }

    if (data.keys) {
      player.keys = data.keys;

      console.log(data.keys);

      if (
        player.keys.w &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isDodging &&
        !player.isCrouching &&
        !player.isAttacking &&
        !player.isJumping
      ) {
        // Find the opponent player
        const opponentIndex = rooms[index].players.findIndex(
          (p) => p.id !== player.id
        );
        const opponent = rooms[index].players[opponentIndex];

        // Check if opponent is close enough and not already being thrown
        if (
          isOpponentCloseEnoughForThrow(player, opponent) &&
          !opponent.isBeingThrown &&
          !opponent.isAttacking
        ) {
          player.isThrowing = true;
          player.throwStartTime = Date.now();
          player.throwEndTime = Date.now() + 400;
          player.throwOpponent = opponent.id;
          opponent.isBeingThrown = true;
          opponent.isHit = true;

          // Calculate throw trajectory here or in the game loop
        } else {
          player.isThrowing = true;
          player.throwStartTime = Date.now();
          player.throwEndTime = Date.now() + 400;
        }
      }

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
        player.dodgeEndTime = Date.now() + 400; // Dodge lasts for 0.3 seconds
        player.stamina -= 50; // Consume some stamina for the dodge
        // Reset dodge state after duration
        setTimeout(() => {
          player.isDodging = false;
        }, 400);
      }
      if (
        player.keys[" "] &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.isDodging &&
        !player.isThrowing &&
        !player.isBeingThrown &&
        !player.isGrabbing &&
        !player.isBeingGrabbed &&
        !player.isHit &&
        !player.isSpaceBarPressed &&
        !player.isAttackCooldown
      ) {
        player.isAttacking = true;
        player.isSpaceBarPressed = true;
        player.isSlapAttack = false;
        player.attackStartTime = Date.now();
        player.attackEndTime = Date.now() + 300; // Attack lasts for 0.3 seconds

        // Reset the attack state after the attack duration
        setTimeout(() => {
          player.isAttacking = false;
          player.isSpaceBarPressed = false;
          player.isAttackCooldown = true;

          // Reset the cooldown state after additional 0.3 seconds
          setTimeout(() => {
            player.isAttackCooldown = false;
          }, 125);
        }, 300);
      } else if (!player.keys[" "]) {
        player.isSpaceBarPressed = false;
      }
      function isOpponentCloseEnoughForGrab(player, opponent) {
        const distance = Math.abs(player.x - opponent.x);
        const GRAB_DISTANCE_THRESHOLD = 230; // Use the same threshold as the throw
        return distance <= GRAB_DISTANCE_THRESHOLD;
      }
      if (
        player.keys.e &&
        !player.isGrabbing &&
        !player.isBeingThrown &&
        !player.isBeingGrabbed &&
        !player.isDodging &&
        !player.isCrouching &&
        !player.isAttacking &&
        !player.isJumping &&
        !player.isThrowing
      ) {
        const opponent = rooms[index].players.find((p) => p.id !== player.id);
        if (
          isOpponentCloseEnoughForGrab(player, opponent) &&
          !opponent.isBeingThrown &&
          !opponent.isAttacking &&
          !opponent.isBeingGrabbed &&
          !player.isBeingGrabbed
        ) {
          player.isGrabbing = true;
          opponent.isHit = true;
          player.grabStartTime = Date.now();
          player.grabbedOpponent = opponent.id;
          opponent.isBeingGrabbed = true;
          player.grabFacingDirection = player.facing;
        } else {
          player.isGrabbing = true;
          player.grabStartTime = Date.now();
        }
      }
    }
    console.log(player.keys);
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (rooms[roomIndex]) {
      rooms[roomIndex].rematchCount = 0;
      (rooms[roomIndex].matchOver = false),
        (rooms[roomIndex].gameStart = false);
    }

    rooms.forEach((room) => {
      room.players = room.players.filter((player) => player.id !== socket.id);
    });

    if (roomIndex !== -1) {
      rooms[roomIndex].readyCount = 0;
      io.in(roomId).emit("player_left");
      io.in(roomId).emit("ready_count", 0);

      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      io.to(roomId).emit("lobby", rooms[roomIndex].players); // Update the lobby for the clients in this room
      io.emit("rooms", rooms);
    }
    console.log(`${reason}: ${socket.id}`);
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log("Server is online!");
});

// process.env.PORT ||

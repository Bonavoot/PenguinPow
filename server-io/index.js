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
  gameStart: false,
  gameOver: false,
  readyStartTime: null,
}));

let index;
let gameLoop = null;
let staminaRegenCounter = 0;
const TICK_RATE = 90;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.3;
const GROUND_LEVEL = 100;

function resetRoomAndPlayers(room) {
  // Reset room state
  room.gameStart = false;
  room.gameOver = false;
  room.gameOverTime = null;

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

    setInterval(() => {
      rooms.forEach((room) => {
        if (room.players.length === 2) {
          automatePlayer2(room);
        }
      });
    }, 2000);
  }

  // automate cpu for testing purposes
  function automatePlayer2(room) {
    const player2 = room.players.find((p) => p.fighter === "player 2");
    if (player2 && !player2.isAttacking && player2.stamina >= 50) {
      // Simulate space bar press
      player2.keys[" "] = true;
      player2.isAttacking = true;
      player2.isSpaceBarPressed = true; // Ensure this mimics the actual key press
      player2.attackStartTime = Date.now(); // Store the attack start time
      player2.stamina -= 20; // Consume some stamina for the attack
      player2.attackEndTime = Date.now() + 150; // Attack lasts for .05 seconds

      // Reset the attack state after the attack duration
      setTimeout(() => {
        player2.isAttacking = false;
        player2.isSpaceBarPressed = false; // Space is released, ready for next attack
        player2.keys[" "] = false; // Ensure this mimics the actual key release
      }, 150); // Attack lasts for .05 seconds
    }
  }

  function tick(delta) {
    rooms.forEach((room) => {
      if (room.players.length < 2) return;

      staminaRegenCounter += delta;

      if (room.players.length === 2) {
        const [player1, player2] = room.players;
        if (room.gameStart && room.players.length === 2) {
          automatePlayer2(room);
        }
        // Check for collision and adjust positions
        if (
          arePlayersColliding(player1, player2) &&
          !player1.isAttacking &&
          !player2.isAttacking
        ) {
          adjustPlayerPositions(player1, player2, delta);
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
          if (player1.x >= 340) {
            player1.x = 340;
          }

          if (player2.x <= 755) {
            player2.x = 755;
          }

          if (player1.x === 340) {
            player1.isReady = true;
          }

          if (player2.x === 755) {
            player2.isReady = true;
          }
        }

        function arePlayersColliding(player1, player2) {
          if (player1.isDodging || player2.isDodging) {
            return false;
          }
          const player1Hitbox = {
            left: player1.x - 50,
            right: player1.x + 50,
            top: player1.y - 30,
            bottom: player1.y + 30,
          };

          const player2Hitbox = {
            left: player2.x - 50,
            right: player2.x + 50,
            top: player2.y - 30,
            bottom: player2.y + 30,
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
            Math.min(player1.x + 65, player2.x + 65) -
            Math.max(player1.x - 65, player2.x - 65);

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
            io.emit("game_start", true);
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
        // map boundries
        player.x = Math.max(-50, Math.min(player.x, 1115));

        // Win Conditions
        if (
          (player.isHit && player.x <= -50) ||
          (player.isHit && player.x >= 1115)
        ) {
          console.log("game over");
          room.gameOver = true;
          const winner = room.players.find((p) => p.id !== player.id);
          winner.wins += 1;
          io.in(room.id).emit("game_over", {
            isGameOver: true,
            winner: winner.fighter,
          });
          if (!room.gameOverTime) {
            room.gameOverTime = Date.now();
          }
        }

        if (room.gameOver && Date.now() - room.gameOverTime >= 5000) {
          // 5 seconds
          resetRoomAndPlayers(room);
        }

        if (player.stamina < 100) {
          if (staminaRegenCounter >= 1000) {
            player.stamina += 12;
            player.stamina = Math.min(player.stamina, 100);
          }
        }

        if (player.isHit) {
          player.x += player.knockbackVelocity.x * delta * speedFactor;
          player.y += player.knockbackVelocity.y * delta * speedFactor;

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

        // win condition
        // if (player.x < -50 || player.x > 1115) {
        //   console.log("game over!");
        // }

        // Dodging
        if (player.isDodging) {
          // Move the player forward on the x-axis

          if (player.keys.a) {
            player.x += -1 * delta * speedFactor * 2.5;
          } else if (player.keys.d) {
            player.x += 1 * delta * speedFactor * 2.5;
          } else if (player.keys.a && player.keys.d) {
            player.x +=
              (player.facing === -1 ? 1 : -1) * delta * speedFactor * 2.5;
          } else {
            player.x +=
              (player.facing === -1 ? 1 : -1) * delta * speedFactor * 2.5;
          }

          // End dodge if the duration is over
          if (Date.now() >= player.dodgeEndTime) {
            player.isDodging = false;
          }
        }

        // Strafing
        if (!player.keys.s) {
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
        if (player.keys.s && player.y === GROUND_LEVEL) {
          player.isCrouching = true;
          player.isReady = false;
        }

        if (!player.keys.s) {
          player.isCrouching = false;
        }

        // Jumping
        if (player.keys.w && !player.isJumping && !player.isDodging) {
          player.isJumping = true;
          player.yVelocity = 15;
          player.isReady = false;
        }

        if (player.isJumping) {
          player.isReady = false;
          player.yVelocity -= 0.9;
          player.y += player.yVelocity;
          if (player.y < GROUND_LEVEL) {
            player.y = GROUND_LEVEL;
            player.isJumping = false;
          }
        }

        if (player.isAttacking) {
          player.x +=
            (player.facing === 1 ? -1 : 1) * delta * speedFactor * 2.5; // Adjust speed as needed

          if (Date.now() >= player.attackEndTime) {
            player.isAttacking = false;
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
      left: player.x - 65,
      right: player.x + 65,
      top: player.y - 65,
      bottom: player.y + 65,
    };

    const opponentHitbox = {
      left: otherPlayer.x - 65,
      right: otherPlayer.x + 65,
      top: otherPlayer.y - 65,
      bottom: otherPlayer.y + 65,
    };

    // Simplified collision check
    const isCollision =
      playerHitbox.left < opponentHitbox.right &&
      playerHitbox.right > opponentHitbox.left &&
      playerHitbox.top < opponentHitbox.bottom &&
      playerHitbox.bottom > opponentHitbox.top;

    if (isCollision) {
      console.log("hit");
      processHit(player, otherPlayer);
    }
  }

  function processHit(player, otherPlayer) {
    const MIN_ATTACK_DISPLAY_TIME = 175;
    const currentTime = Date.now();
    const attackDuration = currentTime - player.attackStartTime;

    if (attackDuration < MIN_ATTACK_DISPLAY_TIME) {
      setTimeout(() => {
        player.isAttacking = false;
      }, MIN_ATTACK_DISPLAY_TIME - attackDuration);
    } else {
      player.isAttacking = false;
    }

    otherPlayer.isHit = true;
    otherPlayer.isJumping = false;
    otherPlayer.isAttacking = false;
    otherPlayer.isStrafing = false;
    otherPlayer.isDiving = false;

    const knockbackDirection = player.facing === -1 ? 1 : -1;
    if (otherPlayer.isCrouching) {
      otherPlayer.knockbackVelocity.x = 2 * knockbackDirection;
    } else {
      otherPlayer.knockbackVelocity.x = 6 * knockbackDirection;
    }

    otherPlayer.stamina -= 10;

    otherPlayer.isAlreadyHit = true;

    setTimeout(() => {
      otherPlayer.isHit = false;
      otherPlayer.isAlreadyHit = false;
    }, 300);
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
          f: false,
        },
        wins: 0,
      });
    } else if (rooms[index].players.length === 1) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "player 2",
        color: "salmon",
        isJumping: false,
        isAttacking: false,
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
          f: false,
        },
        wins: 0,
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

    if (data.keys) {
      player.keys = data.keys;

      console.log(data.keys);

      if (
        player.keys["shift"] &&
        !player.isDodging &&
        !player.isAttacking &&
        player.stamina >= 20
      ) {
        player.isDodging = true;
        player.dodgeEndTime = Date.now() + 300; // Dodge lasts for 0.3 seconds
        player.stamina -= 20; // Consume some stamina for the dodge
        // Reset dodge state after duration
        setTimeout(() => {
          player.isDodging = false;
        }, 300);
      }
      if (
        player.keys[" "] &&
        !player.isAttacking && // Check if the player is not already attacking
        !player.isJumping && // Check if the player is not jumping
        !player.isDodging && // Check if the player is not dodging
        player.stamina >= 20 &&
        !player.isSpaceBarPressed
      ) {
        player.isAttacking = true;
        player.isSpaceBarPressed = true;
        console.log(player.keys[" "]);
        player.attackStartTime = Date.now(); // Store the attack start time
        player.stamina -= 20; // Consume some stamina for the attack
        player.attackEndTime = Date.now() + 500; // Attack lasts for .5 seconds

        // Reset the attack state after the attack duration
        setTimeout(() => {
          player.isAttacking = false;
        }, 500); // Attack lasts for .5 seconds
      } else if (!player.keys[" "]) {
        player.isSpaceBarPressed = false; // Space is released, ready for next attack
      }
    }

    console.log(player.keys);
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (rooms[roomIndex]) {
      rooms[roomIndex].gameStart = false;
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

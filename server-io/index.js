const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
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

const rooms = [
  { id: "Room 1", players: [], readyCount: 0, gameStart: false },
  { id: "Room 2", players: [], readyCount: 0, gameStart: false },
  { id: "Room 3", players: [], readyCount: 0, gameStart: false },
  { id: "Room 4", players: [], readyCount: 0, gameStart: false },
  { id: "Room 5", players: [], readyCount: 0, gameStart: false },
  { id: "Room 6", players: [], readyCount: 0, gameStart: false },
  { id: "Room 7", players: [], readyCount: 0, gameStart: false },
  { id: "Room 8", players: [], readyCount: 0, gameStart: false },
  { id: "Room 9", players: [], readyCount: 0, gameStart: false },
  { id: "Room10", players: [], readyCount: 0, gameStart: false },
];

let index;
let gameLoop = null;
let staminaRegenCounter = 0;
const TICK_RATE = 90;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.3;
const GROUND_LEVEL = 100;

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

  function tick(delta) {
    rooms.forEach((room) => {
      if (room.players.length < 2) return;
      staminaRegenCounter += delta;

      if (room.players.length === 2) {
        const [player1, player2] = room.players;

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
            console.log(player1);
          }

          if (player2.x <= 755) {
            player2.x = 755;
          }
          //testing purposes
          if (player2.x !== 755) {
            player2.x = 755;
            player2.isCrouching = true;
          }
        }

        if (
          player1.x === 340 &&
          player2.x === 755 &&
          player1.isCrouching &&
          player2.isCrouching
        ) {
          room.gameStart = true;
          io.emit("game_start", true);
        }
      }

      room.players.forEach((player) => {
        if (player.isDead) {
          player.y = GROUND_LEVEL;
          player.stamina = 0;
          return;
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
        if (player.x < -650 || player.x > 1780) {
          console.log("game over!");
        }

        // Strafing
        if (!player.keys.s) {
          if (player.keys.d) {
            player.x += delta * speedFactor;
            player.isStrafing = true;
          }
          if (player.keys.a) {
            player.x -= delta * speedFactor;
            player.isStrafing = true;
          }
          if (!player.keys.a && !player.keys.d) {
            player.isStrafing = false;
          }
        }
        if (!player.keys.a && !player.keys.d) {
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
        }

        if (!player.keys.s) {
          player.isCrouching = false;
        }

        // Jumping
        if (player.keys.w && !player.isJumping) {
          player.isJumping = true;
          player.yVelocity = 15;
          player.stamina -= 8;
        }

        if (player.isJumping) {
          player.yVelocity -= 0.9;
          player.y += player.yVelocity;
          if (player.y < GROUND_LEVEL) {
            player.y = GROUND_LEVEL;
            player.isJumping = false;
          }
        }

        for (let i = 0; i < 2; i++) {
          const player = room.players[i];

          if (player.isDiving) {
            for (let j = 0; j < 2; j++) {
              if (i !== j) {
                const otherPlayer = room.players[j];
                checkCollision(player, otherPlayer);
              }
            }
          }
        }

        // Attacking
        // if (player.keys[" "]) {
        //   player.isAttacking = true;
        // }
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

    if (
      playerHitbox.left < opponentHitbox.right &&
      playerHitbox.right > opponentHitbox.left &&
      playerHitbox.top < opponentHitbox.bottom &&
      playerHitbox.bottom > opponentHitbox.top &&
      !otherPlayer.isAlreadyHit &&
      !otherPlayer.isDead
    ) {
      console.log("hit");
      otherPlayer.isHit = true;
      otherPlayer.isJumping = false;
      otherPlayer.isAttacking = false;
      otherPlayer.isStrafing = false;
      otherPlayer.isDiving = false;

      if (player.facing === -1) {
        otherPlayer.facing = -1;
        otherPlayer.knockbackVelocity.x = 6;
      } else {
        otherPlayer.facing = 1;
        otherPlayer.knockbackVelocity.x = -6;
      }

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
        fighter: "pumo",
        color: "blue",
        isJumping: false,
        isAttacking: false,
        isStrafing: false,
        isDiving: false,
        isCrouching: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        facing: 1,
        stamina: 100,
        x: 150,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        keys: { w: false, a: false, s: false, d: false, " ": false },
      });
    } else if (rooms[index].players.length === 1) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "pumo",
        color: "red",
        isJumping: false,
        isAttacking: false,
        isMoving: false,
        isStrafing: false,
        isDiving: false,
        isCrouching: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        facing: -1,
        stamina: 100,
        x: 900,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        keys: { w: false, a: false, s: false, d: false, " ": false },
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
    }
    console.log(player.keys);
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    rooms[roomIndex].gameStart = false;

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

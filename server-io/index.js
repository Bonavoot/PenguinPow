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
  { id: "Room 1", players: [], readyCount: 0, projectiles: [] },
  { id: "Room 2", players: [], readyCount: 0, projectiles: [] },
  { id: "Room 3", players: [], readyCount: 0, projectiles: [] },
  { id: "Room 4", players: [], readyCount: 0, projectiles: [] },
  { id: "Room 5", players: [], readyCount: 0, projectiles: [] },
];

let index;
let gameLoop = null;
let healthRegenCounter = 0;
const TICK_RATE = 90;
const delta = 1000 / TICK_RATE;
const speedFactor = 0.8;
const GROUND_LEVEL = 125;

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
      if (room.players.length < 3) return;
      healthRegenCounter += delta;

      room.players.forEach((player) => {
        if (player.isDead) {
          player.y = GROUND_LEVEL;
          player.health = 0;
          return;
        }

        if (player.health < 100) {
          if (healthRegenCounter >= 1000) {
            player.health += 1;
            player.health = Math.min(player.health, 100);
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

        if (player.x < -650 || player.x > 1780) {
          console.log("game over!");
        }

        // Strafing
        if (player.keys.d) {
          player.x += delta * speedFactor;
          player.facing = 1;
          player.isStrafing = true;
        }

        if (player.keys.a) {
          player.x -= delta * speedFactor;
          player.facing = -1;
          player.isStrafing = true;
        }

        if (!player.keys.a && !player.keys.d) {
          player.isStrafing = false;
        }

        // Diving / down or gravity
        if (player.keys.s || (player.y > GROUND_LEVEL && !player.isJumping)) {
          player.y -= delta * speedFactor + 10;
          player.y = Math.max(player.y, GROUND_LEVEL);
          player.isDiving = player.keys.s;
        }

        if (player.y <= GROUND_LEVEL) {
          player.isDiving = false;
        }

        // Jumping
        if (player.keys.w && !player.isJumping) {
          player.isJumping = true;
          player.yVelocity = 23;
        }

        if (player.isJumping) {
          player.yVelocity -= 0.8;
          player.y += player.yVelocity;
          if (player.y < GROUND_LEVEL) {
            player.y = GROUND_LEVEL;
            player.isJumping = false;
          }
        }

        for (let i = 0; i < 3; i++) {
          const player = room.players[i];

          if (player.isDiving) {
            for (let j = 0; j < 3; j++) {
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
        player3: room.players[2],
      });
    });

    if (healthRegenCounter >= 1000) {
      healthRegenCounter = 0; // Reset the counter after a second has passed
    }
  }

  function checkCollision(player, otherPlayer) {
    const playerHitbox = {
      left: player.x - 50,
      right: player.x + 50,
      top: player.y - 50,
      bottom: player.y + 50,
    };

    const opponentHitbox = {
      left: otherPlayer.x - 50,
      right: otherPlayer.x + 50,
      top: otherPlayer.y - 50,
      bottom: otherPlayer.y + 50,
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
      otherPlayer.health -= 10;
      otherPlayer.isHit = true;
      otherPlayer.isJumping = false;
      otherPlayer.isAttacking = false;
      otherPlayer.isStrafing = false;
      otherPlayer.isDiving = false;

      if (player.facing === 1) {
        otherPlayer.facing = -1;
        otherPlayer.knockbackVelocity.x = 6;
        otherPlayer.knockbackVelocity.y = 3;
      } else {
        otherPlayer.facing = 1;
        otherPlayer.knockbackVelocity.x = -6;
        otherPlayer.knockbackVelocity.y = 3;
      }

      otherPlayer.isAlreadyHit = true;
      console.log(otherPlayer.health);
      if (otherPlayer.health <= 0) {
        otherPlayer.isDead = true;
      }
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
        fighter: "daiba",
        color: "aqua",
        isJumping: false,
        isAttacking: false,
        isStrafing: false,
        isDiving: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        facing: -1,
        health: 100,
        x: 1135,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        keys: { w: false, a: false, s: false, d: false, " ": false },
      });
    } else if (rooms[index].players.length === 1) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "daiba",
        color: "orange",
        isJumping: false,
        isAttacking: false,
        isMoving: false,
        isStrafing: false,
        isDiving: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        facing: 1,
        health: 100,
        x: 15,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        keys: { w: false, a: false, s: false, d: false, " ": false },
      });
    } else if (rooms[index].players.length === 2) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "daiba",
        color: "purple",
        isJumping: false,
        isAttacking: false,
        isMoving: false,
        isStrafing: false,
        isDiving: false,
        isHit: false,
        isDead: false,
        isAlreadyHit: false,
        facing: -1,
        health: 100,
        x: 600,
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

    if (rooms[index].readyCount > 2) {
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

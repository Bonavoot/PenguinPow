const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sharedsession = require("express-socket.io-session");
const session = require("express-session");
const { deflate } = require("zlib");
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
  { id: "Room 1", players: [], readyCount: 0 },
  { id: "Room 2", players: [], readyCount: 0 },
  { id: "Room 3", players: [], readyCount: 0 },
  { id: "Room 4", players: [], readyCount: 0 },
  { id: "Room 5", players: [], readyCount: 0 },
];

const tick = (delta) => {};

let index;

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  io.emit("rooms", rooms);

  socket.on("get_rooms", () => {
    socket.emit("rooms", rooms);
  });

  socket.on("join_room", (data) => {
    socket.join(data.roomId);
    console.log(`${data.socketId} joined ${data.roomId}`);
    index = rooms.findIndex((room) => room.id === data.roomId);

    if (rooms[index].players.length > 0) {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "lil-dinkey",
        isJumping: false,
        isAttacking: false,
        isMoving: false,
        facing: -1,
        x: 1500,
        y: 100,
      });
    } else {
      rooms[index].players.push({
        id: data.socketId,
        fighter: "lil-dinkey",
        isJumping: false,
        isAttacking: false,
        isMoving: false,
        facing: 1,
        x: 200,
        y: 100,
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

    let keyPressed = data.action.toLowerCase();
    let player = rooms[index].players[playerIndex];

    console.log(data.action);

    if (keyPressed === "d") {
      player.x += 25;
      player.facing = 1;
    } else if (keyPressed === "a") {
      player.x -= 25;
      player.facing = -1;
    } else if (keyPressed === "w") {
      player.isJumping = true;
      player.yVelocity = 25;
    }

    if (player.isJumping === true) {
      player.yVelocity -= 1;
      player.y += player.yVelocity;
    }

    io.in(roomId).emit("fighter_action", rooms[index].players[playerIndex]);
    console.log(rooms[index].players[playerIndex]);
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

// let playerObj = {
//   id: data.player,
//   fighter: data.fighter,
//   isJumping: false,
//   isAttacking: false,
//   isMoving: false,
//   x: 0,
//   y: 0,
// };

// rooms[index].players[playerIndex].fighter = data.fighter;

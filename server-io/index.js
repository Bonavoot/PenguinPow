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
  { id: "Room 1", players: [] },
  { id: "Room 2", players: [] },
  { id: "Room 3", players: [] },
  { id: "Room 4", players: [] },
  { id: "Room 5", players: [] },
];

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.handshake.session.socketId = socket.id;
  socket.handshake.session.save();

  io.emit("rooms", rooms);

  socket.on("join_room", (socketId, roomId) => {
    socket.join(roomId);
    console.log(`${socketId} joined ${roomId}`);
    let index = rooms.findIndex((room) => room.id === roomId);
    rooms[index].players.push({ id: socketId, fighter: "lil-dinkey" });
    io.emit("rooms", rooms);
    io.emit("lobby", rooms[index].players);
    console.log(rooms[index].players);

    socket.on("fighter-select", (data) => {
      let playerIndex = rooms[index].players.findIndex(
        (player) => player.id === socket.id
      );
      rooms[index].players[playerIndex].fighter = data.fighter;
      io.in(roomId).emit("lobby", rooms[index].players); // Update all players in the room
    });
  });

  socket.on("lobby", () => {
    io.emit("lobby", rooms);
  });

  socket.on("disconnect", (reason) => {
    rooms.forEach((room) => {
      room.players = room.players.filter((player) => player.id !== socket.id);
    });
    io.emit("rooms", rooms);
    io.emit("lobby", rooms);
    console.log(`${reason}: ${socket.id}`);
  });
});

server.listen(3001, () => {
  console.log("Server is online!");
});

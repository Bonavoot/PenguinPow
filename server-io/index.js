const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = [
  { id: "Room 1", players: [] },
  { id: "Room 2", players: [] },
  { id: "Room 3", players: [] },
  { id: "Room 4", players: [] },
  { id: "Room 5", players: [] },
];

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  io.emit("rooms", rooms);

  socket.on("join_room", (socketId, roomId) => {
    socket.join(roomId);
    console.log(`${socketId} joined ${roomId}`);
    let index = rooms.findIndex((room) => room.id === roomId);
    rooms[index].players.push(socketId);
    io.emit("rooms", rooms);
    io.emit("lobby", rooms[index].players);
    console.log(rooms[index].players);
  });

  socket.on("lobby", () => {
    io.emit("lobby", rooms);
  });

  socket.on("disconnect", (reason) => {
    rooms.forEach((room) => {
      room.players = room.players.filter((player) => player !== socket.id);
    });
    io.emit("rooms", rooms);
    io.emit("lobby", rooms);
    console.log(`${reason}: ${socket.id}`);
  });
});

server.listen(3001, () => {
  console.log("Server is online!");
});

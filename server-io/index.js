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

let rooms = [];

function cleanUpRoom(roomId) {
  rooms = rooms.filter((room) => room.id !== roomId);
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("quickplay", () => {
    let room = rooms.find(
      (room) => room.players.length < 2 && room.inGame === false
    );

    // if room doesnt exist, create room otherwise add player to available room
    if (!room) {
      room = {
        id: Math.random().toString(36).substring(7),
        players: [socket.id],
        inGame: false,
      };
      console.log(room.id);
      rooms.push(room);
      socket.join(room.id);
      console.log(`${socket.id} joined room ${room.id}`);
    } else {
      console.log(`${socket.id} joined room ${room.id}`);
      room.players.push(socket.id);
      socket.join(room.id);
      room.inGame = true;
      console.log(room.id);
      io.sockets.in(room.id).emit("start");
      console.log("game should start");
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`${reason}: ${socket.id}`);
    const room = rooms.find((room) => room.players.includes(socket.id));
    if (room) {
      room.players = room.players.filter((id) => id !== socket.id);
      if (room.players.length === 0) {
        cleanUpRoom(room.id);
      } else if (room.inGame) {
        io.in(room.id).emit("opponent disconnected");
        room.inGame = false;
      }
    }
  });
});

server.listen(3001, () => {
  console.log("Server is online!");
});

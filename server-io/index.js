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

// Returns true if there are availiable rooms to join
function isRoomAvailable(rooms) {
  return rooms.find((room) => room.capacity < 2) != null;
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on("quickplay", () => {
    if (rooms.length === 0 || !isRoomAvailable(rooms)) {
      const room = {
        host: socket.id,
        capacity: 1,
      };
      rooms.push(room);
      socket.join(room.host);
      console.log(`${socket.id} joined room ${room.host}`);
    } else {
      const roomId = rooms.find((room) => room.capacity < 2);
      socket.join(roomId.host);
      socket.broadcast.emit("start");
      roomId.capacity += 1;
      console.log(`${socket.id} joined room ${roomId.host}`);
    }
  });
});

server.listen(3001, () => {
  console.log("Server is online!");
});

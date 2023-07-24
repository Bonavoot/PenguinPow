import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io.connect("http://localhost:3001");

const Room = ({ room, socketId, setToggle, toggle }) => {
  const join = () => {
    socket.emit("join_room", socketId, room.id);
    setToggle(!toggle);
  };

  return (
    <div>
      {room.id} {room.players.length}/2
      {room.players.length === 2 ? null : <button onClick={join}>JOIN</button>}
    </div>
  );
};

export default Room;

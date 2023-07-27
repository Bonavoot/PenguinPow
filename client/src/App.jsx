import { useEffect, useState } from "react";
import "./App.css";
import { io } from "socket.io-client";
import Play from "./components/Play";

const socket = io("http://localhost:3001");

function App() {
  const [rooms, setRooms] = useState([]);
  const [join, setJoin] = useState(false);

  useEffect(() => {
    socket.on("connect", () => {
      console.log(socket.id);
    });
    socket.on("connect_error", () => {
      setTimeout(() => socket.connect(), 5000);
    });

    socket.on("rooms", (rooms) => {
      setRooms(rooms);
    });
  }, []);

  return (
    <Play rooms={rooms} join={join} setJoin={setJoin} socketId={socket.id} />
  );
}

export default App;

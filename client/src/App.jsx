import { useEffect, useState } from "react";
import "./App.css";
import { io } from "socket.io-client";
import Play from "./components/Play";

const socket = io("http://localhost:3001");

function App() {
  const [rooms, setRooms] = useState([]);
  const [play, setPlay] = useState(false);

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

  const handlePlay = () => {
    setPlay(!play);
  };

  return (
    <div className="main-menu">
      <h1 className="logo">Penguin POW !</h1>

      {play ? (
        <Play rooms={rooms} socketId={socket.id} />
      ) : (
        <button onClick={handlePlay}>PLAY</button>
      )}
    </div>
  );
}

export default App;

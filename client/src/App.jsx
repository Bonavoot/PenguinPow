import { useEffect, useState } from "react";
import "./App.css";
import { io } from "socket.io-client";
import Play from "./components/Play";
import { SocketContext } from "./SocketContext";
import Lobby from "./pages/Lobby";

const socket = io("http://localhost:3001");

function App() {
  const [rooms, setRooms] = useState([]);
  const [play, setPlay] = useState(false);
  const [lobby, setLobby] = useState(false);

  console.log(socket);
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
    <SocketContext.Provider value={socket}>
      <div className="main-menu">
        <h1 className="logo">Penguin POW !</h1>
        {play && !lobby.isJoined ? (
          <Play rooms={rooms} setLobby={setLobby} />
        ) : (
          <button onClick={handlePlay}>PLAY</button>
        )}
        {lobby.isJoined ? <Lobby roomId={lobby.roomId} /> : null}
      </div>
    </SocketContext.Provider>
  );
}

export default App;

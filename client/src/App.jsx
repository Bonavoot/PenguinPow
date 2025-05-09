import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./SocketContext";
import MainMenu from "./components/MainMenu";
import "./App.css";

const SOCKET_URL = import.meta.env.PROD 
  ? "https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/"
  : "http://localhost:3001";

const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

function App() {
  const [rooms, setRooms] = useState([]);
  const [currentPage, setCurrentPage] = useState("mainMenu");
  const [localId, setLocalId] = useState("");
  const [connectionError, setConnectionError] = useState(false);

  const handleLogoClick = () => {
    window.location.reload(false);
  };
  
  const getRooms = () => {
    socket.emit("get_rooms");
  };

  useEffect(() => {
    socket.on("connect", () => {
      setLocalId(socket.id);
      setConnectionError(false);
      console.log("Connected to server:", SOCKET_URL);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionError(true);
      setTimeout(() => socket.connect(), 5000);
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setConnectionError(true);
    });

    socket.on("rooms", (rooms) => {
      setRooms(rooms);
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("rooms");
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, getRooms }}>
      <h1 onClick={handleLogoClick} className="logo">
        P u m o <span className="pow"> PUMO !</span>
      </h1>
      {connectionError && (
        <div style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>
          Connection error. Attempting to reconnect...
        </div>
      )}
      <MainMenu
        rooms={rooms}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        localId={localId}
      />
    </SocketContext.Provider>
  );
}

export default App;

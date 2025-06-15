import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./SocketContext";
import MainMenu from "./components/MainMenu";
import gamepadHandler from "./utils/gamepadHandler";
import "./App.css";
import "./components/SteamDeck.css";

const SOCKET_URL = import.meta.env.PROD
  ? "https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/"
  : "http://localhost:3001";

const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket", "polling"],
});

function App() {
  const [rooms, setRooms] = useState([]);
  const [currentPage, setCurrentPage] = useState("mainMenu");
  const [localId, setLocalId] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [steamDeckMode, setSteamDeckMode] = useState(false);
  const [controllerConnected, setControllerConnected] = useState(false);

  const handleLogoClick = () => {
    window.location.reload(false);
  };

  const getRooms = () => {
    socket.emit("get_rooms");
  };

  useEffect(() => {
    // Steam Deck detection and setup
    const isSteamDeck = gamepadHandler.isSteamDeck();
    setSteamDeckMode(isSteamDeck);

    // Apply Steam Deck CSS class
    if (isSteamDeck) {
      document.body.classList.add("steam-deck-mode");
    }

    // Monitor controller connection
    const checkControllerStatus = () => {
      setControllerConnected(gamepadHandler.isConnected());
    };

    const controllerCheckInterval = setInterval(checkControllerStatus, 1000);

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
      clearInterval(controllerCheckInterval);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, getRooms }}>
      <div
        className={`app-container ${steamDeckMode ? "steam-deck-mode" : ""} ${
          controllerConnected ? "controller-connected" : ""
        }`}
      >
        <h1 onClick={handleLogoClick} className="logo">
          P u m o <span className="pow"> PUMO !</span>
        </h1>
        {connectionError && (
          <div style={{ color: "red", textAlign: "center", marginTop: "20px" }}>
            Connection error. Attempting to reconnect...
          </div>
        )}
        {controllerConnected && (
          <div className="controller-connected-indicator">
            🎮 Controller Connected
          </div>
        )}
        {steamDeckMode && (
          <div className="steam-deck-controls-hint">
            A: Attack | B: Dodge | X: Grab | Y: Throw | Left Stick: Move
          </div>
        )}
        <MainMenu
          rooms={rooms}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          localId={localId}
        />
      </div>
    </SocketContext.Provider>
  );
}

export default App;

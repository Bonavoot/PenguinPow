import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./SocketContext";
import StartupScreen from "./components/StartupScreen";
import gamepadHandler from "./utils/gamepadHandler";
import { PlayerColorProvider } from "./context/PlayerColorContext";
import "./App.css";
import "./components/SteamDeck.css";

import MainMenu from "./components/MainMenu";

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
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const appContainerRef = useRef(null);

  useLayoutEffect(() => {
    const updateZoom = () => {
      if (!appContainerRef.current) return;
      const zoom = Math.min(
        window.innerWidth / 1280,
        window.innerHeight / 720
      );
      appContainerRef.current.style.setProperty("--app-zoom", String(zoom));
    };
    updateZoom();
    window.addEventListener("resize", updateZoom);
    return () => window.removeEventListener("resize", updateZoom);
  }, []);

  const handleContinueFromStartup = () => {
    setShowStartupScreen(false);
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
    let reconnectTimeout = null;

    socket.on("connect", () => {
      setLocalId(socket.id);
      setConnectionError(false);
      console.log("Connected to server:", SOCKET_URL);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionError(true);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => socket.connect(), 5000);
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
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, getRooms }}>
      <PlayerColorProvider>
        <div
          ref={appContainerRef}
          className={`app-container ${steamDeckMode ? "steam-deck-mode" : ""} ${
            controllerConnected ? "controller-connected" : ""
          }`}
        >
          {showStartupScreen ? (
            <StartupScreen
              onContinue={handleContinueFromStartup}
              connectionError={connectionError}
              steamDeckMode={steamDeckMode}
            />
          ) : (
            <>
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
                setRooms={setRooms}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                localId={localId}
                connectionError={connectionError}
              />
            </>
          )}
        </div>
      </PlayerColorProvider>
    </SocketContext.Provider>
  );
}

export default App;

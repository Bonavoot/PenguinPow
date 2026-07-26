import { useEffect, useLayoutEffect, useMemo, useCallback, useState, useRef } from "react";
import { SocketContext } from "./SocketContext";
import StartupScreen from "./components/StartupScreen";
import gamepadHandler from "./utils/gamepadHandler";
import { PlayerColorProvider } from "./context/PlayerColorContext";
import { startServerClock, stopServerClock } from "./lib/serverClock";
import { gameSocket as socket, selectGameServer } from "./lib/serverConnection";
import "./App.css";
import "./components/SteamDeck.css";

import MainMenu from "./components/MainMenu";

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

  // Solo modes (VS CPU / BASHO) route the game socket to the locally-spawned
  // server (see MainMenu handlers). Whenever the player is back at the main
  // menu or browsing online rooms, route back to the remote server so PvP
  // matchmaking works. No-op when already on the right server.
  useEffect(() => {
    if (currentPage === "mainMenu" || currentPage === "rooms") {
      selectGameServer("remote");
    }
  }, [currentPage]);

  const getRooms = useCallback(() => {
    socket.emit("get_rooms");
  }, []);

  // Memoize the context value so that consumers don't re-render every time
  // App re-renders (e.g. on every rooms/localId/connection state change).
  const socketContextValue = useMemo(
    () => ({ socket, getRooms }),
    [getRooms]
  );

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
      console.log("Connected to game server");
      // Establish server-clock offset so visual hitstop can end in sync
      // across clients with asymmetric ping. Safe to call repeatedly.
      // (Server switches re-handshake via resyncServerClock in the facade.)
      startServerClock(socket);
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
      stopServerClock();
    });

    socket.on("rooms", (rooms) => {
      setRooms(rooms);
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("rooms");
      stopServerClock();
      clearInterval(controllerCheckInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <SocketContext.Provider value={socketContextValue}>
      <PlayerColorProvider>
        <div
          ref={appContainerRef}
          className={`app-container ${steamDeckMode ? "steam-deck-mode" : ""} ${
            controllerConnected ? "controller-connected" : ""
          }`}
        >
          <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true">
            <defs>
              {/* ── Filmic scene grade ────────────────────────────────────────
                  A gentle tone S-curve that deepens blacks and rolls off
                  highlights so background planes stop reading "milky/faded".
                  The B channel is pulled a hair lower in the highlights and
                  lifted slightly in the shadows vs R/G — a subtle warm-
                  highlight / cool-shadow split-tone (the cohesive "film stock"
                  look) without a heavy color cast. Applied to background
                  planes (map/crowd) via CSS `filter: url(#scene-grade)`, NOT
                  to the players — the wrestlers stay full-contrast/saturation
                  so they pop forward against the graded environment. */}
              <filter id="scene-grade" colorInterpolationFilters="sRGB">
                <feComponentTransfer>
                  <feFuncR type="table" tableValues="0 0.07 0.19 0.38 0.58 0.76 0.90 1" />
                  <feFuncG type="table" tableValues="0 0.07 0.19 0.38 0.58 0.76 0.90 1" />
                  <feFuncB type="table" tableValues="0 0.085 0.205 0.39 0.575 0.745 0.885 1" />
                </feComponentTransfer>
              </filter>
            </defs>
          </svg>
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
                  A: Attack | B: Dash | X: Grab | Y: Throw | Left Stick: Move
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

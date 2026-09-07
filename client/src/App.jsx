import { useEffect, useLayoutEffect, useMemo, useCallback, useState, useRef } from "react";
import { SocketContext } from "./SocketContext";
import StartupScreen from "./components/StartupScreen";
import gamepadHandler from "./utils/gamepadHandler";
import { PlayerColorProvider } from "./context/PlayerColorContext";
import { startServerClock, stopServerClock } from "./lib/serverClock";
import { gameSocket as socket, selectGameServer } from "./lib/serverConnection";
import {
  acquireCursor,
  releaseCursor,
  subscribeCursorVisible,
} from "./ui/cursorGate";
import "./App.css";
import "./components/SteamDeck.css";

import MainMenu from "./components/MainMenu";

function App() {
  const [rooms, setRooms] = useState([]);
  const [currentPage, setCurrentPage] = useState("mainMenu");
  const [localId, setLocalId] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  // Set when the server rejected our protocol version: the build is stale
  // (or the server is), and online play is impossible until updated.
  const [protocolMismatch, setProtocolMismatch] = useState(null);
  const [steamDeckMode, setSteamDeckMode] = useState(false);
  const [controllerConnected, setControllerConnected] = useState(false);
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);
  const appContainerRef = useRef(null);

  // Cursor shows only while a click-needed UI reason is held (menus, DayCard,
  // power select, rematch). Prematch / fight / between-round = hidden.
  useLayoutEffect(() => subscribeCursorVisible(setCursorVisible), []);

  useLayoutEffect(() => {
    if (showStartupScreen) acquireCursor("startup");
    else releaseCursor("startup");
    return () => releaseCursor("startup");
  }, [showStartupScreen]);

  // Mirror onto body so letterbox margins match (app is 1280×720 centered).
  useLayoutEffect(() => {
    document.body.classList.toggle("cursor-custom", cursorVisible);
    document.body.classList.toggle("cursor-hidden", !cursorVisible);
    return () => {
      document.body.classList.remove("cursor-hidden", "cursor-custom");
    };
  }, [cursorVisible]);

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

  // Kill native drag-out of images/sprites (CSS covers most; this catches leftovers).
  useEffect(() => {
    const preventNativeDrag = (e) => e.preventDefault();
    document.addEventListener("dragstart", preventNativeDrag);
    return () => document.removeEventListener("dragstart", preventNativeDrag);
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

    // "connect" is synthesized by the connection facade AFTER the session
    // handshake, so socket.id here is the stable per-server playerId (it
    // survives socket.io auto-reconnects and mid-match resume).
    const handleConnect = () => {
      setLocalId(socket.id);
      setConnectionError(false);
      setProtocolMismatch(null);
      console.log("Connected to game server");
      // Establish server-clock offset so visual hitstop can end in sync
      // across clients with asymmetric ping. Safe to call repeatedly.
      // (Server switches re-handshake via resyncServerClock in the facade.)
      startServerClock(socket);
    };
    socket.on("connect", handleConnect);

    const handleProtocolMismatch = (info) => {
      setProtocolMismatch(info || { reason: "protocol_mismatch" });
    };
    socket.on("protocol_mismatch", handleProtocolMismatch);

    const handleServerShutdown = (info) => {
      console.warn("Server shutting down:", info);
      setConnectionError(true);
    };
    socket.on("server_shutdown", handleServerShutdown);

    const handleConnectError = (error) => {
      console.error("Connection error:", error);
      setConnectionError(true);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => socket.connect(), 5000);
    };
    socket.on("connect_error", handleConnectError);

    const handleDisconnect = (reason) => {
      console.log("Disconnected:", reason);
      setConnectionError(true);
      stopServerClock();
    };
    socket.on("disconnect", handleDisconnect);

    const handleRooms = (rooms) => {
      setRooms(rooms);
    };
    socket.on("rooms", handleRooms);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("protocol_mismatch", handleProtocolMismatch);
      socket.off("server_shutdown", handleServerShutdown);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("rooms", handleRooms);
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
          } ${cursorVisible ? "cursor-custom" : "cursor-hidden"}`}
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
                protocolMismatch={protocolMismatch}
              />
            </>
          )}
        </div>
      </PlayerColorProvider>
    </SocketContext.Provider>
  );
}

export default App;

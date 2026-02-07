import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
import MobileControls from "./MobileControls";
import PowerUpSelection from "./PowerUpSelection";
import PowerUpReveal from "./PowerUpReveal";
import GrabClashUI from "./GrabClashUI";
import CrowdLayer from "./CrowdLayer";
import PreMatchScreen from "./PreMatchScreen";
import gamepadHandler from "../utils/gamepadHandler";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  startMemoryMonitor,
  stopMemoryMonitor,
  setupMemoryMonitorShortcut,
} from "../utils/memoryMonitor";
import { clearDecodedImageCache } from "../utils/SpriteRecolorizer";
// import gameMusic from "../sounds/game-music.mp3";
import PropTypes from "prop-types";

// const gameMusicAudio = new Audio(gameMusic);
// gameMusicAudio.loop = true;
// gameMusicAudio.volume = 0.02;

// PERFORMANCE: Hidden element that forces the browser to download, parse, and rasterize
// the "Noto Serif JP" font at the exact size/weight used by RoundResult (22rem, weight 900).
// Without this, the first win triggers a freeze while the browser downloads the CJK font file
// (potentially several hundred KB) and rasterizes the 勝/敗 kanji at 350px+.
// This renders invisibly on mount so the font is warm before it's ever needed.
// The text-shadow matches RoundResult's MainKanji so the shadow rasterization is also cached.
const FontWarmup = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute',
      left: '-9999px',
      top: '-9999px',
      visibility: 'hidden',
      pointerEvents: 'none',
      overflow: 'hidden',
      width: '1px',
      height: '1px',
    }}
  >
    <span
      style={{
        fontFamily: '"Noto Serif JP", serif',
        fontSize: '22rem',
        fontWeight: 900,
        lineHeight: 1,
        textShadow: '4px 4px 0 #E6B800, 8px 8px 0 #CC9900, 12px 12px 0 #B38600, 0 0 40px rgba(255, 215, 0, 0.35)',
        background: 'linear-gradient(145deg, #FFFFFF 0%, #FFD700 40%, #FF8000 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      勝敗
    </span>
  </div>
);

const Game = ({ rooms, roomName, localId, setCurrentPage, isCPUMatch = false }) => {
  const { socket } = useContext(SocketContext);
  const [isPowerUpSelectionActive, setIsPowerUpSelectionActive] =
    useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectedRoomId, setDisconnectedRoomId] = useState(null);
  const [isCrowdCheering, setIsCrowdCheering] = useState(false);
  
  // Pre-match screen state
  const [showPreMatchScreen, setShowPreMatchScreen] = useState(true); // Start with overlay visible
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPreloading, setIsPreloading] = useState(true);
  const preMatchShownRef = useRef(false); // Track if we've already shown/hidden the pre-match
  
  const index = rooms.findIndex((room) => room.id === roomName);
  
  // Get player colors for sprite recoloring
  const { player1Color, player2Color, preloadSprites } = usePlayerColors();

  // Get the current room with null safety
  const currentRoom = index !== -1 ? rooms[index] : null;

  // Find current player for input blocking checks
  const currentPlayer = currentRoom?.players?.find(
    (player) => player.id === localId
  );

  // ============================================
  // GAME STATE TRACKING FOR PREDICTIONS
  // Track when game is active (after hakkiyoi) to prevent
  // predictions during power-up selection or before match starts
  // ============================================
  const isGameActiveRef = useRef(false);

  // ============================================
  // CLIENT-SIDE PREDICTION REF
  // This ref will be populated by the local player's GameFighter
  // We call it to show predicted actions immediately before server confirms
  // ============================================
  const predictionRef = useRef(null);
  
  // Helper function to apply prediction for an action
  const applyPrediction = useCallback((actionType, direction = null) => {
    if (predictionRef.current?.applyPrediction) {
      // Pass gameStarted state so predictions know if game is active
      predictionRef.current.applyPrediction({ 
        type: actionType, 
        direction,
        gameStarted: isGameActiveRef.current 
      });
    }
  }, []);
  
  // Track previous key states for edge detection (just pressed)
  const prevKeyState = useRef({
    mouse1: false,
    mouse2: false,
    shift: false,
    s: false,
    e: false,
  });

  // Memory monitor - logs to console every 30s, Ctrl+Shift+M for overlay
  useEffect(() => {
    const cleanupMonitor = startMemoryMonitor();
    const cleanupShortcut = setupMemoryMonitorShortcut();
    return () => {
      cleanupMonitor?.();
      cleanupShortcut?.();
    };
  }, []);

  // Free decoded sprite cache when leaving game (reduces memory when in menu/lobby)
  useEffect(() => {
    return () => {
      clearDecodedImageCache();
    };
  }, []);

  useEffect(() => {
    const keyState = {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
      e: false,
      f: false,
      c: false,
      control: false,
      mouse1: false,
      mouse2: false,
    };

    // Set up Steam Deck controller input
    const handleGamepadInput = (gamepadKeyState) => {
      // Block inputs during power-up selection or when throwing snowball
      if (isPowerUpSelectionActive || currentPlayer?.isThrowingSnowball) return;

      // Block all inputs except spacebar when being grabbed
      if (currentPlayer?.isBeingGrabbed) {
        // Only allow spacebar (grab break)
        const grabBreakOnly = {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": gamepadKeyState[" "] || false,
          shift: false,
          e: false,
          f: false,
          mouse1: false,
          mouse2: false,
        };
        socket.emit("fighter_action", { id: socket.id, keys: grabBreakOnly });
        return;
      }

      // CLIENT-SIDE PREDICTION for gamepad inputs
      // Check for newly pressed buttons by comparing with previous keyState
      if (gamepadKeyState.mouse1 && !keyState.mouse1) {
        applyPrediction("slap");
      }
      if (gamepadKeyState.mouse2 && !keyState.mouse2) {
        applyPrediction("charge_start");
      }
      if (!gamepadKeyState.mouse2 && keyState.mouse2) {
        applyPrediction("charge_release");
      }
      if (gamepadKeyState.shift && !keyState.shift) {
        const direction = gamepadKeyState.a ? -1 : gamepadKeyState.d ? 1 : null;
        applyPrediction("dodge", direction);
      }
      if (gamepadKeyState.s && !keyState.s) {
        applyPrediction("parry_start");
      }
      if (!gamepadKeyState.s && keyState.s) {
        applyPrediction("parry_release");
      }
      if (gamepadKeyState.e && !keyState.e) {
        applyPrediction("grab");
      }
      // ICE PHYSICS: Power slide predictions for gamepad
      if ((gamepadKeyState.c || gamepadKeyState.control) && !(keyState.c || keyState.control)) {
        applyPrediction("power_slide_start");
      }
      if (!(gamepadKeyState.c || gamepadKeyState.control) && (keyState.c || keyState.control)) {
        applyPrediction("power_slide_end");
      }

      // Update keyState for next comparison
      Object.assign(keyState, gamepadKeyState);
      
      socket.emit("fighter_action", { id: socket.id, keys: gamepadKeyState });
    };

    // Add gamepad input callback
    gamepadHandler.addInputCallback(handleGamepadInput);

    const handleKeyDown = (e) => {
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (currentPlayer?.isThrowingSnowball) return;

      // Block all inputs except spacebar when being grabbed
      if (currentPlayer?.isBeingGrabbed && e.key !== " ") {
        return;
      }

      const key = e.key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(keyState, key)) {
        // Prevent browser default behavior for game keys (especially CTRL which triggers selection)
        e.preventDefault();
        
        const wasPressed = keyState[key];
        keyState[key] = true;
        
        // CLIENT-SIDE PREDICTION: Apply predicted state immediately for certain actions
        if (!wasPressed) {
          // Dodge (shift + direction)
          if (key === "shift") {
            const direction = keyState.a ? -1 : keyState.d ? 1 : null;
            applyPrediction("dodge", direction);
          }
          // Raw parry (s key)
          else if (key === "s") {
            applyPrediction("parry_start");
          }
          // Grab (e key)
          else if (key === "e") {
            applyPrediction("grab");
          }
          // ICE PHYSICS: Power slide (c or control key)
          else if (key === "c" || key === "control") {
            applyPrediction("power_slide_start");
          }
        }
        
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleKeyUp = (e) => {
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (currentPlayer?.isThrowingSnowball) return;

      // Block all inputs except spacebar when being grabbed
      if (currentPlayer?.isBeingGrabbed && e.key !== " ") {
        return;
      }

      const key = e.key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(keyState, key)) {
        // Prevent browser default behavior for game keys
        e.preventDefault();
        
        keyState[key] = false;
        
        // CLIENT-SIDE PREDICTION: Apply predicted state for releases
        if (key === "s") {
          applyPrediction("parry_release");
        }
        // ICE PHYSICS: End power slide when c/control released
        else if (key === "c" || key === "control") {
          applyPrediction("power_slide_end");
        }
        
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleMouseDown = (e) => {
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (currentPlayer?.isThrowingSnowball) return;

      // Block all mouse inputs when being grabbed
      if (currentPlayer?.isBeingGrabbed) return;

      if (e.button === 0) {
        e.preventDefault();
        const wasPressed = keyState.mouse1;
        keyState.mouse1 = true;
        
        // CLIENT-SIDE PREDICTION: Immediately show slap attack
        if (!wasPressed) {
          applyPrediction("slap");
        }
        
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      } else if (e.button === 2) {
        e.preventDefault();
        const wasPressed = keyState.mouse2;
        keyState.mouse2 = true;
        
        // CLIENT-SIDE PREDICTION: Immediately show charge start
        if (!wasPressed) {
          applyPrediction("charge_start");
        }
        
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleMouseUp = (e) => {
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (currentPlayer?.isThrowingSnowball) return;

      // Block all mouse inputs when being grabbed
      if (currentPlayer?.isBeingGrabbed) return;

      if (e.button === 0) {
        e.preventDefault();
        keyState.mouse1 = false;
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      } else if (e.button === 2) {
        e.preventDefault();
        const wasPressed = keyState.mouse2;
        keyState.mouse2 = false;
        
        // CLIENT-SIDE PREDICTION: Immediately show charge release (attack)
        if (wasPressed) {
          applyPrediction("charge_release");
        }
        
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);

      // Remove gamepad input callback
      gamepadHandler.removeInputCallback(handleGamepadInput);
    };
  }, [isPowerUpSelectionActive, socket, currentPlayer, applyPrediction]);

  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("touchmove", preventDefault, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventDefault);
    };
  }, []);

  // Pre-match screen: Show overlay while preloading sprites
  // This shows the actual game scene (crowd, gyoji, players) behind a semi-transparent overlay
  useEffect(() => {
    // Only run once when game first loads
    if (preMatchShownRef.current) return;
    preMatchShownRef.current = true;
    
    const runPreload = async () => {
      console.log("Game: Starting pre-match screen and sprite preload...");
      
      // Simulate loading progress while actual preloading happens
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 200);
      
      try {
        // Preload all recolored sprites
        await preloadSprites(player1Color, player2Color);
        console.log("Game: Sprites preloaded successfully");
        
        // Complete the progress bar
        clearInterval(progressInterval);
        setLoadingProgress(100);
        
        // Brief pause at 100% to let players see the matchup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error("Game: Failed to preload sprites:", error);
        clearInterval(progressInterval);
        setLoadingProgress(100);
        // Wait anyway so players can see the matchup
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Hide pre-match screen
      setIsPreloading(false);
      setShowPreMatchScreen(false);
      
      // Signal server that pre-match is complete - NOW start power-up selection
      console.log("Game: Pre-match complete, signaling server to start power-up selection");
      socket.emit("pre_match_complete", { roomId: roomName });
    };
    
    runPreload();
  }, [preloadSprites, player1Color, player2Color, socket, roomName]);

  // Handle opponent disconnection - hide power-up selection UI for ALL game phases
  useEffect(() => {
    const handleOpponentDisconnected = (data) => {
      setIsPowerUpSelectionActive(false);
      setOpponentDisconnected(true);
      setDisconnectedRoomId(data.roomId);
    };

    const handleGameReset = () => {
      setOpponentDisconnected(false);
      setDisconnectedRoomId(null);
      setIsCrowdCheering(false); // Crowd goes back to idle when game resets
      isGameActiveRef.current = false; // Game is no longer active during reset
    };

    const handleGameOver = () => {
      // PERFORMANCE: Defer crowd cheering to the next animation frame.
      // The game_over event triggers heavy work (state updates, gyoji change, sound).
      // Deferring the crowd sprite swap (~200 img.src changes) prevents it from
      // piling onto the same frame and causing a freeze.
      requestAnimationFrame(() => {
        setIsCrowdCheering(true);
      });
      isGameActiveRef.current = false; // Game is no longer active after win
    };

    const handleGameStart = () => {
      isGameActiveRef.current = true; // Game is now active, predictions allowed
    };

    socket.on("opponent_disconnected", handleOpponentDisconnected);
    socket.on("game_reset", handleGameReset);
    socket.on("game_over", handleGameOver);
    socket.on("game_start", handleGameStart);

    return () => {
      socket.off("opponent_disconnected", handleOpponentDisconnected);
      socket.off("game_reset", handleGameReset);
      socket.off("game_over", handleGameOver);
      socket.off("game_start", handleGameStart);
    };
  }, [socket]);

  // Early return if room doesn't exist (e.g., after disconnect/reconnect for CPU games)
  if (!currentRoom) {
    // Redirect to main menu if room doesn't exist
    setCurrentPage("main-menu");
    return null;
  }

  return (
    <div className="game-wrapper">
      <FontWarmup />
      <div className="game-container">
        <CrowdLayer isCheering={isCrowdCheering} />
        <div className="dohyo-overlay"></div>
        <div className="ui">
          {currentRoom.players
            .filter((player) => player.id !== "disconnected_placeholder")
            .map((player, i) => {
              // Only pass predictionRef to the local player's GameFighter
              const isLocalPlayerFighter = player.id === localId;
              return (
                <GameFighter
                  localId={localId}
                  key={player.id}
                  player={player}
                  index={i}
                  roomName={roomName}
                  setCurrentPage={setCurrentPage}
                  opponentDisconnected={opponentDisconnected}
                  disconnectedRoomId={disconnectedRoomId}
                  onResetDisconnectState={() => {
                    setOpponentDisconnected(false);
                    setDisconnectedRoomId(null);
                  }}
                  isPowerUpSelectionActive={isPowerUpSelectionActive}
                  predictionRef={isLocalPlayerFighter ? predictionRef : null}
                  playerColor={i === 0 ? player1Color : player2Color}
                />
              );
            })}
        </div>
        <PowerUpSelection
          roomId={roomName}
          playerId={localId}
          onSelectionStateChange={setIsPowerUpSelectionActive}
        />
        <PowerUpReveal
          roomId={roomName}
          localId={localId}
        />
        <GrabClashUI
          socket={socket}
          player1={currentRoom.players?.[0]}
          player2={currentRoom.players?.[1]}
          localId={localId}
        />
        
        {/* Pre-match screen overlay - INSIDE game-container so it scales with 16:9 aspect ratio */}
        {showPreMatchScreen && currentRoom && (
          <PreMatchScreen
            player1Name={currentRoom.players[0]?.fighter || "Player 1"}
            player2Name={currentRoom.players[1]?.isCPU ? "CPU" : (currentRoom.players[1]?.fighter || "Player 2")}
            player1Color={currentRoom.players[0]?.mawashiColor || player1Color}
            player2Color={currentRoom.players[1]?.mawashiColor || player2Color}
            player1Record={{ wins: 0, losses: 0 }}
            player2Record={{ wins: 0, losses: 0 }}
            loadingProgress={loadingProgress}
            isLoading={isPreloading}
            isCPUMatch={isCPUMatch}
          />
        )}
      </div>
      <MobileControls
        isInputBlocked={isPowerUpSelectionActive}
        currentPlayer={currentPlayer}
      />
    </div>
  );
};

Game.propTypes = {
  rooms: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      players: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  isCPUMatch: PropTypes.bool,
};

export default Game;

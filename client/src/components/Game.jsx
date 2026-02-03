import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
import MobileControls from "./MobileControls";
import PowerUpSelection from "./PowerUpSelection";
import PowerUpReveal from "./PowerUpReveal";
import GrabClashUI from "./GrabClashUI";
import CrowdLayer from "./CrowdLayer";
import gamepadHandler from "../utils/gamepadHandler";
// import gameMusic from "../sounds/game-music.mp3";
import PropTypes from "prop-types";

// const gameMusicAudio = new Audio(gameMusic);
// gameMusicAudio.loop = true;
// gameMusicAudio.volume = 0.02;

const Game = ({ rooms, roomName, localId, setCurrentPage }) => {
  const { socket } = useContext(SocketContext);
  const [isPowerUpSelectionActive, setIsPowerUpSelectionActive] =
    useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectedRoomId, setDisconnectedRoomId] = useState(null);
  const [isCrowdCheering, setIsCrowdCheering] = useState(false);
  const index = rooms.findIndex((room) => room.id === roomName);

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

  // useEffect(() => {
  //   gameMusicAudio
  //     .play()
  //     .catch((error) => console.error("Error while playing game music", error));

  //   return () => {
  //     gameMusicAudio.pause();
  //     gameMusicAudio.currentTime = 0;
  //   };
  // }, []);

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
      setIsCrowdCheering(true); // Crowd cheers when someone wins
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
};

export default Game;

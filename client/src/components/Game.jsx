import { useContext, useEffect, useState } from "react";
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

      if (Object.prototype.hasOwnProperty.call(keyState, e.key.toLowerCase())) {
        keyState[e.key.toLowerCase()] = true;
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

      if (Object.prototype.hasOwnProperty.call(keyState, e.key.toLowerCase())) {
        keyState[e.key.toLowerCase()] = false;
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
        keyState.mouse1 = true;
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      } else if (e.button === 2) {
        e.preventDefault();
        keyState.mouse2 = true;
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
        keyState.mouse2 = false;
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
  }, [isPowerUpSelectionActive, socket, currentPlayer]);

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
      console.log(
        "🔴 GAME: Opponent disconnected, hiding power-up selection UI and setting disconnect state"
      );
      setIsPowerUpSelectionActive(false);
      setOpponentDisconnected(true);
      setDisconnectedRoomId(data.roomId);
    };

    const handleGameReset = () => {
      console.log("🔴 GAME: Game reset, clearing disconnect state");
      setOpponentDisconnected(false);
      setDisconnectedRoomId(null);
      setIsCrowdCheering(false); // Crowd goes back to idle when game resets
    };

    const handleGameOver = () => {
      console.log("🎉 GAME: Game over, crowd starts cheering!");
      setIsCrowdCheering(true); // Crowd cheers when someone wins
    };

    socket.on("opponent_disconnected", handleOpponentDisconnected);
    socket.on("game_reset", handleGameReset);
    socket.on("game_over", handleGameOver);

    return () => {
      socket.off("opponent_disconnected", handleOpponentDisconnected);
      socket.off("game_reset", handleGameReset);
      socket.off("game_over", handleGameOver);
    };
  }, [socket]);

  // Early return if room doesn't exist (e.g., after disconnect/reconnect for CPU games)
  if (!currentRoom) {
    console.log("⚠️ Game: Room not found, returning to main menu");
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

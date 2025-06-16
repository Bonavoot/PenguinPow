import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
import MobileControls from "./MobileControls";
import SnowEffect from "./SnowEffect";
import PowerUpSelection from "./PowerUpSelection";
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
  let index = rooms.findIndex((room) => room.id === roomName);

  // Find current player for input blocking checks
  const currentPlayer = rooms[index]?.players?.find(
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

      socket.emit("fighter_action", { id: socket.id, keys: gamepadKeyState });
    };

    // Add gamepad input callback
    gamepadHandler.addInputCallback(handleGamepadInput);

    const handleKeyDown = (e) => {
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (currentPlayer?.isThrowingSnowball) return;

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
    };

    socket.on("opponent_disconnected", handleOpponentDisconnected);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("opponent_disconnected", handleOpponentDisconnected);
      socket.off("game_reset", handleGameReset);
    };
  }, [socket]);

  return (
    <div className="game-wrapper">
      <div className="game-container">
        <SnowEffect />
        <div className="ui">
          {rooms[index].players
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
                />
              );
            })}
        </div>
        <PowerUpSelection
          roomId={roomName}
          playerId={localId}
          onSelectionStateChange={setIsPowerUpSelectionActive}
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

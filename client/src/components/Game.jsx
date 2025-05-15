import { useContext, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
import MobileControls from "./MobileControls";
// import gameMusic from "../sounds/game-music.mp3";

// const gameMusicAudio = new Audio(gameMusic);
// gameMusicAudio.loop = true;
// gameMusicAudio.volume = 0.02;

const Game = ({ rooms, roomName, localId }) => {
  const { socket } = useContext(SocketContext);
  let index = rooms.findIndex((room) => room.id === roomName);

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
    };

    const handleKeyDown = (e) => {
      if (keyState.hasOwnProperty(e.key.toLowerCase())) {
        keyState[e.key.toLowerCase()] = true;
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleKeyUp = (e) => {
      if (keyState.hasOwnProperty(e.key.toLowerCase())) {
        keyState[e.key.toLowerCase()] = false;
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleMouseDown = (e) => {
      if (e.button === 0) {
        e.preventDefault();
        keyState.mouse1 = true;
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        e.preventDefault();
        keyState.mouse1 = false;
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
    };
  });

  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("touchmove", preventDefault, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventDefault);
    };
  }, []);

  return (
    <div className="game-wrapper">
      <div className="game-container">
        <div className="ui">
          {rooms[index].players.map((player, i) => {
            return (
              <GameFighter
                localId={localId}
                key={player.id + i}
                player={player}
                index={i}
                roomName={roomName}
              />
            );
          })}
        </div>
      </div>
      <MobileControls />
    </div>
  );
};

export default Game;

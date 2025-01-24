import { useContext, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

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
    </div>
  );
};

export default Game;

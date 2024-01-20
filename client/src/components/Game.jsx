import { useContext, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";

const Game = ({ rooms, roomName }) => {
  const { socket } = useContext(SocketContext);
  let index = rooms.findIndex((room) => room.id === roomName);

  useEffect(() => {
    const keyState = {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
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
    <div className="game-container">
      <div className="ui">
        {rooms[index].players.map((player, i) => {
          return <GameFighter key={player.id + i} player={player} index={i} />;
        })}
      </div>
    </div>
  );
};

export default Game;

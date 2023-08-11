import { useContext, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";

const Game = ({ rooms, roomName }) => {
  const { socket } = useContext(SocketContext);
  let index = rooms.findIndex((room) => room.id === roomName);

  useEffect(() => {
    const keyState = { w: false, a: false, s: false, d: false, " ": false };

    const handleKeyDown = (e) => {
      if (keyState.hasOwnProperty(e.key)) {
        keyState[e.key] = true;
        socket.emit("fighter_action", { id: socket.id, keys: keyState });
      }
    };

    const handleKeyUp = (e) => {
      if (keyState.hasOwnProperty(e.key)) {
        keyState[e.key] = false;
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
      {rooms[index].players.map((player, i) => {
        return <GameFighter key={player.id + i} player={player} index={i} />;
      })}
    </div>
  );
};

export default Game;

/*
dont give each fighter its own personal emit and shit for inputs
keep it generic, and let React handle the animation rendering depending on the 
fighter picked
for example 
fighter {
  attack: false,
  jump: false,
  x: 0,
  y: 0,
}
this is what the server will recieve

React needs to handle the values of the animations x and y 

left: fighter.x
bottom: fighter.y

if player is moving on x axis, we need to use the walking animation 
if jumping, jumping animation y axis
attacking animation 

IDEAS: 
- MAKE THROWABLE BALL IN THE MIDDLE EVERY ROUND THAT DOES DAMAGE IF THROWN 
*/

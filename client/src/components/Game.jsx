import { useContext, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import map from "../assets/map.gif";
import GameFighter from "./GameFighter";

const Game = ({ rooms, roomName }) => {
  const { socket } = useContext(SocketContext);
  let index = rooms.findIndex((room) => room.id === roomName);
  let currentKey = null;
  let nextKey = null;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!currentKey) {
        currentKey = e.key;
        const fighterId = socket.id;
        socket.emit("fighter_action", { id: fighterId, action: e.key });
      } else if (!nextKey && e.key !== currentKey) {
        nextKey = e.key;
        const fighterId = socket.id;
        socket.emit("fighter_action", { id: fighterId, action: e.key });
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === currentKey) {
        if (nextKey) {
          currentKey = nextKey;
          nextKey = null;
        } else {
          currentKey = null;
          // Send a stop action here
          const fighterId = socket.id;
          socket.emit("fighter_action", { id: fighterId, action: "stop" });
        }
      } else if (e.key === nextKey) {
        nextKey = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  console.log(rooms[index].players[0].fighter);
  console.log(rooms);
  console.log(roomName);
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

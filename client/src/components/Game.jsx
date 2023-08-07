import { useContext, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import map from "../assets/mapZoni.jpg";
import GameFighter from "./GameFighter";

const Game = ({ rooms, roomName }) => {
  const { socket } = useContext(SocketContext);
  let index = rooms.findIndex((room) => room.id === roomName);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const fighterId = socket.id;
      socket.emit("fighter_action", { id: fighterId, action: e.key });
    };

    const handleKeyUp = (e) => {
      const fighterId = socket.id;
      socket.emit();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  console.log(rooms[index].players[0].fighter);
  console.log(rooms);
  console.log(roomName);
  return (
    <div className="game-container">
      <img
        className="map"
        style={{ height: "768px", width: "1450px" }}
        src={map}
        alt="map"
      />
      {rooms[index].players.map((player, i) => {
        return (
          <GameFighter
            key={player.id + i}
            player={player}
            fighter={player.fighter}
            index={i}
          />
        );
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

MAKE THROWABLE BALL IN THE MIDDLE EVERY ROUND THAT DOES DAMAGE IF THROWN 


*/

import { useContext } from "react";
import { SocketContext } from "../SocketContext";
import map from "../assets/mapZoni.jpg";
import GameFighter from "./GameFighter";

const Game = ({ rooms, roomName }) => {
  const { socket } = useContext(SocketContext);
  let index = rooms.findIndex((room) => room.id === roomName);

  console.log(rooms[index].players[0].fighter);
  console.log(rooms);
  console.log(roomName);
  return (
    <div className="game-container">
      <img
        className="map"
        style={{ height: "825px", width: "1650px" }}
        src={map}
        alt="map"
      />
      {rooms[index].players.map((player, i) => {
        return (
          <GameFighter key={player.id} fighter={player.fighter} index={i} />
        );
      })}
    </div>
  );
};

export default Game;

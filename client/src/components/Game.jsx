import { useContext } from "react";
import { SocketContext } from "../SocketContext";
import map from "../assets/mapZoni.jpg";

const Game = ({ rooms, roomName }) => {
  const { socket } = useContext(SocketContext);

  console.log(socket.id);
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
      {}
    </div>
  );
};

export default Game;

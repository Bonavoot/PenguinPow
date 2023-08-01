import { useContext, useEffect, useState } from "react";
import Player from "../components/Player";
import "./Lobby.css";
import FighterSelect from "../components/FighterSelect";
import { SocketContext } from "../SocketContext";

const Lobby = ({ roomName }) => {
  const [players, setPlayers] = useState([]);

  const socket = useContext(SocketContext);

  console.log(socket);

  useEffect(() => {
    socket.emit("lobby");
    socket.on("lobby", (rooms) => {
      let index = rooms.findIndex((room) => room.id === roomName);
      setPlayers(rooms[index].players);
      console.log(players);
    });
  }, []);

  return (
    <div className="lobby">
      {players.map((player, i) => {
        return <Player key={player} index={i} />;
      })}
      <FighterSelect />
      <button
        className="exit-btn"
        onClick={() => window.location.reload(false)}
      >
        EXIT
      </button>
    </div>
  );
};

export default Lobby;

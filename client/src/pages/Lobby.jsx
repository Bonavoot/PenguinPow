import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Player from "../components/Player";
import "./Lobby.css";
import standing from "../assets/standing.gif";
import FighterSelect from "../components/FighterSelect";
import { SocketContext } from "../SocketContext";

const Lobby = ({ roomId }) => {
  const [players, setPlayers] = useState([]);

  const socket = useContext(SocketContext);

  console.log(socket);

  useEffect(() => {
    socket.emit("lobby");
    socket.on("lobby", (rooms) => {
      let index = rooms.findIndex((room) => room.id === roomId);
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
    </div>
  );
};

export default Lobby;

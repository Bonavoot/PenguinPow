import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import Player from "../components/Player";
import "./Lobby.css";
import standing from "../assets/standing.gif";
import FighterSelect from "../components/FighterSelect";

const socket = io.connect("http://localhost:3001");

const Lobby = () => {
  const [players, setPlayers] = useState([]);

  let location = useLocation();

  useEffect(() => {
    socket.emit("lobby");
    socket.on("lobby", (rooms) => {
      let index = rooms.findIndex((room) => room.id === location.state.id);

      setPlayers(rooms[index].players);
      console.log(players);
    });
  }, []);

  return (
    <div className="lobby">
      {players.map((player, i) => {
        return <Player key={player} index={i} player={player} />;
      })}
      <FighterSelect />
    </div>
  );
};

export default Lobby;

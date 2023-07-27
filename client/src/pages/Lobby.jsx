import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import Player from "../components/Player";

const socket = io.connect("http://localhost:3001");

const Lobby = () => {
  const [players, setPlayers] = useState([]);

  let location = useLocation();

  console.log(location.state.id);

  useEffect(() => {
    socket.emit("lobby");
    socket.on("lobby", (rooms) => {
      let index = rooms.findIndex((room) => room.id === location.state.id);
      setPlayers(rooms[index].players);
    });
  }, []);

  return (
    <div>
      {players.map((player, i) => {
        return <Player index={i} player={player} />;
      })}
    </div>
  );
};

export default Lobby;

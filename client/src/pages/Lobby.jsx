import { useContext, useEffect, useState } from "react";
import Player from "../components/Player";
import "./Lobby.css";
import FighterSelect from "../components/FighterSelect";
import { SocketContext } from "../SocketContext";

const Lobby = () => {
  const [players, setPlayers] = useState([]);

  const socket = useContext(SocketContext);

  console.log(socket);

  useEffect(() => {
    socket.emit("lobby");
    socket.on("lobby", (playerData) => {
      setPlayers(playerData);
      console.log(playerData);
    });
  }, []);

  return (
    <div className="lobby">
      {players.map((player, i) => {
        return (
          <>
            {i > 1 ? null : (
              <Player key={player + i} index={i} fighter={player.fighter} />
            )}
          </>
        );
      })}
      <h1 className="select-penguin-txt">SELECT PENGUIN</h1>
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

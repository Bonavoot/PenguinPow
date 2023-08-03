import { useContext, useEffect, useState } from "react";
import Player from "../components/Player";
import "./Lobby.css";
import FighterSelect from "../components/FighterSelect";
import { SocketContext } from "../SocketContext";
import Ready from "../components/Ready";
import { v4 as uuidv4 } from "uuid";
import React from "react";

const Lobby = ({ rooms, roomName }) => {
  const [players, setPlayers] = useState([]);

  const { socket } = useContext(SocketContext);
  console.log(rooms);
  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      setPlayers(playerData);
      console.log(playerData);
    });

    return () => {
      socket.off("lobby");
    };
  }, []);

  return (
    <div className="lobby">
      {players.map((player, i) => {
        return (
          <React.Fragment key={uuidv4()}>
            {i > 1 ? null : <Player index={i} fighter={player.fighter} />}
          </React.Fragment>
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
      <Ready rooms={rooms} roomName={roomName} />
    </div>
  );
};

export default Lobby;

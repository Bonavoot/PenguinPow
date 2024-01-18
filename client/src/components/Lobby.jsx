import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import "./Lobby.css";
import FighterSelect from "./FighterSelect";
import { SocketContext } from "../SocketContext";
import Ready from "./Ready";
import { v4 as uuidv4 } from "uuid";
import React from "react";
import ellipses from "../assets/ellipses.gif";

const Lobby = ({ rooms, roomName, handleGame }) => {
  const [players, setPlayers] = useState([]);

  const { socket } = useContext(SocketContext);

  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      setPlayers(playerData);
    });

    return () => {
      socket.off("lobby");
    };
  }, [roomName, socket]);

  return (
    <div className="lobby">
      {players.map((player, i) => {
        return (
          <React.Fragment key={uuidv4()}>
            {i > 2 ? null : <Player index={i} fighter={player.fighter} />}
          </React.Fragment>
        );
      })}
      {players.length < 2 ? (
        <div className="waiting">
          Waiting for opponent
          <img id="ellipses" src={ellipses} alt="waiting" />
        </div>
      ) : null}
      <div className="select-penguin-container">
        <h2 className="select-penguin-txt">SELECT PENGUIN</h2>
        <FighterSelect />
      </div>

      <button
        className="exit-btn"
        onClick={() => window.location.reload(false)}
      >
        EXIT
      </button>
      <Ready rooms={rooms} roomName={roomName} handleGame={handleGame} />
    </div>
  );
};

export default Lobby;

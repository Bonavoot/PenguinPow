import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import "./Lobby.css";
import { SocketContext } from "../SocketContext";
import Ready from "./Ready";
import { v4 as uuidv4 } from "uuid";
import React from "react";

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
          <div className="loading-ellipsis">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        </div>
      ) : null}
      {/* <h1 className="kana1">横</h1>
        <h1 className="kana2">綱</h1> */}
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

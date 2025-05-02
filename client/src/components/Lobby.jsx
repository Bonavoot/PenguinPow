import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import "./Lobby.css";
import { SocketContext } from "../SocketContext";
import Ready from "./Ready";
import { v4 as uuidv4 } from "uuid";
import React from "react";
import PropTypes from "prop-types";

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
    <div className="lobby-container">
      <div className="lobby-header">
        <h1 className="lobby-title">LOBBY</h1>
        <div className="room-info">
          <span className="room-label">ROOM:</span>
          <span className="room-name">{roomName}</span>
        </div>
      </div>

      <div className="lobby-content">
        <div className="players-grid">
          {players.map((player, i) => (
            <div
              key={uuidv4()}
              className={`player-slot ${i > 2 ? "hidden" : ""}`}
            >
              {i <= 2 && (
                <div className="player-card">
                  <div className="player-info">
                    <span className="player-name">
                      {player.fighter || "Waiting..."}
                    </span>
                  </div>
                  <div className="player-avatar">
                    {player.fighter && (
                      <Player index={i} fighter={player.fighter} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {players.length < 2 && (
          <div className="waiting-container">
            <div className="waiting-message">
              <h2>WAITING FOR OPPONENT</h2>
              <div className="loading-ellipsis">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="lobby-controls">
        <button
          className="exit-btn"
          onClick={() => window.location.reload(false)}
        >
          EXIT LOUNGE
        </button>
        <Ready rooms={rooms} roomName={roomName} handleGame={handleGame} />
      </div>
    </div>
  );
};

Lobby.propTypes = {
  rooms: PropTypes.array.isRequired,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
};

export default Lobby;

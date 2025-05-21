import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import "./Lobby.css";
import { SocketContext } from "../SocketContext";
import Ready from "./Ready";
import { v4 as uuidv4 } from "uuid";
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
      <div className="lobby-background"></div>

      <div className="lobby-header">
        <div className="game-logo">
          <h1 className="lobby-title">PUMO LOBBY</h1>
          <div className="game-subtitle">RANKED MATCH</div>
        </div>
        <div className="room-info">
          <div className="room-badge">
            <span className="room-label">Room Code</span>
            <span className="room-name">{roomName}</span>
          </div>
        </div>
      </div>

      <div className="lobby-content">
        <div className="arena-container">
          <div className="arena-background"></div>
          <div className="players-arena">
            {[0, 1].map((i) => (
              <div
                key={uuidv4()}
                className={`player-slot ${
                  i === 1 ? "player-right" : "player-left"
                } ${!players[i]?.fighter ? "empty" : ""}`}
              >
                <div className="player-card">
                  <div className="player-info">
                    <div className="player-status">
                      {players[i]?.fighter ? (
                        <span className="status-indicator ready">Ready</span>
                      ) : (
                        <span className="status-indicator waiting">
                          Waiting
                        </span>
                      )}
                    </div>
                    <span className="player-name">
                      {players[i]?.fighter || "OPPONENT"}
                    </span>
                  </div>
                  <div className="player-avatar">
                    {players[i]?.fighter ? (
                      <Player index={i} fighter={players[i].fighter} />
                    ) : (
                      <div className="waiting-message">
                        <h2>Waiting for Opponent</h2>
                        <div className="loading-ellipsis">
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="versus-badge">VS</div>
        </div>
      </div>

      <div className="lobby-controls">
        <button
          className="exit-btn"
          onClick={() => window.location.reload(false)}
        >
          <span className="btn-icon">←</span>
          Exit Lobby
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

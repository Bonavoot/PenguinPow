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
          <h1 className="lobby-title">Sumo Arena</h1>
          <div className="game-subtitle">Online Sumo Fighter</div>
        </div>
        <div className="room-info">
          <div className="room-badge">
            <span className="room-label">Room Code</span>
            <span className="room-name">{roomName}</span>
          </div>
        </div>
      </div>

      <div className="lobby-content">
        <div className="versus-container">
          <div className="players-grid">
            {players.map((player, i) => (
              <div
                key={uuidv4()}
                className={`player-slot ${i > 2 ? "hidden" : ""}`}
              >
                {i <= 2 && (
                  <div className="player-card">
                    <div className="player-info">
                      <div className="player-status">
                        {player.fighter ? (
                          <span className="status-indicator ready">Ready</span>
                        ) : (
                          <span className="status-indicator waiting">
                            Waiting
                          </span>
                        )}
                      </div>
                      <span className="player-name">
                        {player.fighter || "Waiting for player..."}
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
          <div className="versus-badge">VS</div>
        </div>

        {players.length < 2 && (
          <div className="waiting-container">
            <div className="waiting-message">
              <h2>Waiting for Opponent</h2>
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

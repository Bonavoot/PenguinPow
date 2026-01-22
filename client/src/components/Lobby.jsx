import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import "./Lobby.css";
import { SocketContext } from "../SocketContext";
import Ready from "./Ready";
import { v4 as uuidv4 } from "uuid";
import PropTypes from "prop-types";
import {
  playButtonHoverSound,
  playButtonPressSound,
} from "../utils/soundUtils";

const Lobby = ({ rooms, roomName, handleGame, setCurrentPage, isCPUMatch = false }) => {
  const [players, setPlayers] = useState([]);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      console.log("Received lobby data:", playerData);
      setPlayers(playerData);
    });

    // Handle player left event - just log it since server sends updated lobby data
    socket.on("player_left", () => {
      console.log("Player left event received");
      // Don't re-request - server already sends updated lobby data
    });

    return () => {
      socket.off("lobby");
      socket.off("ready_count");
      socket.off("player_left");
      socket.off("initial_game_start");
    };
  }, [roomName, socket]);

  const handleLeaveDohyo = () => {
    playButtonPressSound();
    socket.emit("leave_room", { roomId: roomName });
    // Don't emit ready_count - server handles ready state cleanup automatically
    // Navigate immediately since we're leaving the room
    setCurrentPage("mainMenu");
  };

  return (
    <div className="lobby-container">
      <div className="lobby-background"></div>

      <div className="lobby-header">
        <div className="game-logo">
          <h1 className="lobby-title">PUMO LOBBY</h1>
          <div className="game-subtitle">GRAND TOURNAMENT - RANKED MATCH</div>
        </div>
        <div className="room-info">
          <div className="room-badge">
            <span className="room-label">Dohyo Code</span>
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
                        <span className="status-indicator ready">Prepared</span>
                      ) : (
                        <span className="status-indicator waiting">
                          Awaiting Rikishi
                        </span>
                      )}
                    </div>
                    <span className="player-name">
                      {players[i]?.isCPU ? "CPU" : (players[i]?.fighter || "OPPONENT")}
                    </span>
                  </div>
                  <div className="player-avatar">
                    {players[i]?.fighter ? (
                      <Player index={i} fighter={players[i].fighter} />
                    ) : (
                      <div className="waiting-message">
                        <h2>Waiting for Pumo</h2>
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
          <div className="versus-badge">対</div>
        </div>
      </div>

      <div className="lobby-controls">
        <button
          className="exit-btn"
          onClick={handleLeaveDohyo}
          onMouseEnter={playButtonHoverSound}
        >
          <span className="btn-icon">←</span>
          Leave Dohyo
        </button>
        <Ready rooms={rooms} roomName={roomName} handleGame={handleGame} isCPUMatch={isCPUMatch} />
      </div>
    </div>
  );
};

Lobby.propTypes = {
  rooms: PropTypes.array.isRequired,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  isCPUMatch: PropTypes.bool,
};

export default Lobby;

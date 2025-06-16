import { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";

const Ready = ({ rooms, roomName, handleGame }) => {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  // Find room and safely get player count
  const currentRoom = rooms.find((room) => room.id === roomName);
  const playerCount = currentRoom ? currentRoom.players.length : 0;

  useEffect(() => {
    socket.on("ready_count", (readyCount) => {
      console.log("ready count activated");
      setCount(readyCount);
    });

    socket.on("player_left", () => {
      setReady(false);
      setCount(0); // Reset count when a player leaves
    });

    socket.on("initial_game_start", () => {
      console.log("game start Ready.jsx");
      socket.emit("game_reset", true);
      handleGame();
    });

    return () => {
      socket.off("ready_count");
      socket.off("player_left");
      socket.off("initial_game_start");
    };
  }, [socket, handleGame]);

  const handleReady = (e) => {
    if (e.target.textContent === "READY") {
      setReady(true);
      socket.emit("ready_count", {
        playerId: socket.id,
        isReady: true,
        roomId: roomName,
      });
    } else {
      setReady(false);
      socket.emit("ready_count", {
        playerId: socket.id,
        isReady: false,
        roomId: roomName,
      });
    }
    setReady(!ready);
  };
  return (
    <div className="ready">
      {ready ? (
        <>
          <button
            onClick={(e) => {
              handleReady(e);
              playButtonPressSound();
            }}
            id="cancel-btn"
            onMouseEnter={playButtonHoverSound}
          >
            CANCEL
          </button>
          <div className="ready-count">{count} / 2</div>
        </>
      ) : (
        <>
          {playerCount > 1 ? (
            <>
              <button
                onClick={(e) => {
                  handleReady(e);
                  playButtonPressSound2();
                }}
                className="ready-btn"
                onMouseEnter={playButtonHoverSound}
              >
                READY
              </button>
              <div className="ready-count">{count} / 2</div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
};

Ready.propTypes = {
  rooms: PropTypes.array.isRequired,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
};

export default Ready;

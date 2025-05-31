import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import { playButtonHoverSound, playButtonPressSound, playButtonPressSound2 } from "../utils/soundUtils";

const Ready = ({ rooms, roomName, handleGame }) => {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  let index = rooms.findIndex((room) => room.id === roomName);

  let playerCount = rooms[index].players.length;

  useEffect(() => {
    socket.on("ready_count", (readyCount) => {
      console.log("ready count activated")
      setCount(readyCount);
    });

    socket.on("player_left", () => {
      setReady(false);
    });

    socket.on("initial_game_start", () => {
      console.log("game start Ready.jsx")
      socket.emit("game_reset", true);
      handleGame();
    });
  }, []);

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
          <button onClick={(e) => { handleReady(e); playButtonPressSound(); }} id="cancel-btn" onMouseEnter={playButtonHoverSound}>
            CANCEL
          </button>
          <div className="ready-count">{count} / 2</div>
        </>
      ) : (
        <>
          {playerCount > 1 ? (
            <>
              <button onClick={(e) => { handleReady(e); playButtonPressSound2(); }} className="ready-btn" onMouseEnter={playButtonHoverSound}>
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

export default Ready;

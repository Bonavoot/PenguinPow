import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";

const Ready = ({ rooms, roomName, handleGame }) => {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  let index = rooms.findIndex((room) => room.id === roomName);

  let playerCount = rooms[index].players.length;

  useEffect(() => {
    socket.on("ready_count", (readyCount) => {
      setCount(readyCount);
    });

    socket.on("player_left", () => {
      setReady(false);
    });

    socket.on("game_start", () => {
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
          <button onClick={handleReady} id="cancel-btn">
            CANCEL
          </button>
          <div className="ready-count">{count} / 3</div>
        </>
      ) : (
        <>
          {playerCount > 2 ? (
            <>
              <button onClick={handleReady} className="ready-btn">
                READY
              </button>
              <div className="ready-count">{count} / 3</div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
};

export default Ready;

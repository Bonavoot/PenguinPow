import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";

const Ready = ({ rooms, roomName }) => {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  let index = rooms.findIndex((room) => room.id === roomName);

  let playerCount = rooms[index].players.length;

  useEffect(() => {
    socket.on("readyCount", (readyCount) => {
      setCount(readyCount);
    });

    socket.on("player-left", () => {
      setReady(false);
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
          <button onClick={handleReady} className="ready-btn" id="cancel-btn">
            CANCEL
          </button>
          <div className="ready-count">{count} / 2</div>
        </>
      ) : (
        <>
          {playerCount > 1 ? (
            <>
              <button onClick={handleReady} className="ready-btn">
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

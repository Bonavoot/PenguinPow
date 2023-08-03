import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";

const Ready = ({ rooms, roomName }) => {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  let index = rooms.findIndex((room) => room.id === roomName);

  useEffect(() => {
    socket.on("readyCount", (readyCount) => {
      setCount(readyCount);
    });
  }, []);

  const handleReady = (e) => {
    if (e.target.textContent === "READY") {
      setReady(true);
      socket.emit("readyCount", {
        playerId: socket.id,
        isReady: true,
        roomId: roomName,
      });
    } else {
      setReady(false);
      socket.emit("readyCount", {
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
        <button
          style={{ backgroundColor: "red" }}
          onClick={handleReady}
          className="ready-btn"
        >
          CANCEL
        </button>
      ) : (
        <button onClick={handleReady} className="ready-btn">
          READY
        </button>
      )}
      <div className="ready-count">{count} / 2</div>
    </div>
  );
};

export default Ready;

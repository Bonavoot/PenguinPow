import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";

const Rematch = ({ roomName }) => {
  const [rematch, setRematch] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    socket.on("rematch_count", (rematchCount) => {
      setCount(rematchCount);
    });
  });

  const handleRematch = (e) => {
    if (e.target.textContent === "REMATCH") {
      setRematch(true);
      socket.emit("rematch_count", {
        playerId: socket.id,
        acceptedRematch: true,
        roomId: roomName,
      });
    } else {
      setRematch(false);
      socket.emit("rematch_count", {
        playerId: socket.id,
        acceptedRematch: false,
        roomId: roomName,
      });
    }
    setRematch(!rematch);
  };

  const handleExit = () => {
    setCount(0);
    window.location.reload(false);
  };

  return (
    <div className="rematch">
      {rematch ? (
        <>
          <button onClick={handleRematch} className="rematch-cancel-btn">
            CANCEL
          </button>
          <div className="ready-count">{count} / 2</div>
        </>
      ) : (
        <>
          <button onClick={handleRematch} className="rematch-ready-btn">
            REMATCH
          </button>
          <div className="ready-count">{count} / 2</div>
        </>
      )}
      <button
        className="rematch-exit-btn"
        id="rematch-exit"
        onClick={handleExit}
      >
        EXIT
      </button>
    </div>
  );
};

export default Rematch;

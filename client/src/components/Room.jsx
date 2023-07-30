import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io.connect("http://localhost:3001");

const Room = ({ room, socketId }) => {
  let navigate = useNavigate();
  const handleJoin = () => {
    socket.emit("join_room", socketId, room.id);
    navigate(`/${room.id}`, { state: { id: room.id, player: socketId } });
  };

  return (
    <div className="room">
      <h1 className="room-id">{room.id.toUpperCase()}</h1>
      <h2 className="room-count">{room.players.length} / 2</h2>
      {room.players.length === 2 ? (
        <button
          className="join-btn"
          style={{ color: "black", backgroundColor: "white", opacity: ".2" }}
        >
          FULL
        </button>
      ) : (
        <button className="join-btn" onClick={handleJoin}>
          JOIN
        </button>
      )}
    </div>
  );
};

export default Room;

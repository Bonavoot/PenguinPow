import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../SocketContext";

const Room = ({ room, setLobby }) => {
  let navigate = useNavigate();
  const socket = useContext(SocketContext);

  const handleJoin = () => {
    socket.emit("join_room", socket.id, room.id);
    setLobby({ roomId: room.id, isJoined: true });
    // navigate(`/${room.id}`, { state: { id: room.id } });
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

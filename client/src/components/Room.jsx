import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io.connect("http://localhost:3001");

const Room = ({ room, socketId, setJoin, join }) => {
  let navigate = useNavigate();
  const handleJoin = () => {
    socket.emit("join_room", socketId, room.id);
    navigate(`/${room.id}`, { state: { id: room.id, player: socketId } });
    setJoin(!join);
  };

  return (
    <div>
      {room.id} {room.players.length}/2
      {room.players.length === 3 ? null : (
        <button onClick={handleJoin}>JOIN</button>
      )}
    </div>
  );
};

export default Room;

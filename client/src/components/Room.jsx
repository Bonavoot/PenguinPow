import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../SocketContext";

const Room = ({ room, setRoomName, handleJoinRoom }) => {
  const socket = useContext(SocketContext);

  const handleJoin = () => {
    console.log(room);
    socket.emit("join_room", socket.id, room.id);
    setRoomName(room.id);
    handleJoinRoom();
  };

  return (
    <div className="room">
      <h1 className="room-id">{room.id}</h1>
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

//handleJoin
// setLobby component up here

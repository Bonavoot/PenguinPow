import { useContext, useEffect } from "react";
import Room from "./Room";
import { SocketContext } from "../SocketContext";

const Rooms = ({ rooms, setRoomName, handleJoinRoom, handleMainMenuPage }) => {
  const { getRooms } = useContext(SocketContext);

  const handleRefresh = () => {
    getRooms();
  };

  useEffect(() => {
    getRooms();
  }, []);

  return (
    <div className="rooms">
      <button className="back-btn" onClick={handleMainMenuPage}>
        BACK
      </button>
      <button className="refresh-btn" onClick={handleRefresh}>
        <span className="material-symbols-outlined">refresh</span>
      </button>
      {rooms.map((room) => {
        return (
          <Room
            key={room.id}
            room={room}
            setRoomName={setRoomName}
            handleJoinRoom={handleJoinRoom}
          />
        );
      })}
    </div>
  );
};

export default Rooms;

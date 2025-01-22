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
      <div className="rooms-button-container">
        <button
          className="back-btn"
          onClick={() => window.location.reload(false)}
        >
          BACK
        </button>
        <button className="refresh-btn" onClick={handleRefresh}>
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
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

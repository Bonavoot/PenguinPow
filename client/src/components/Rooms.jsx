import Room from "./Room";

const Rooms = ({ rooms, setRoomName, handleJoinRoom }) => {
  return (
    <div className="rooms">
      <button
        className="back-btn"
        onClick={() => window.location.reload(false)}
      >
        BACK
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

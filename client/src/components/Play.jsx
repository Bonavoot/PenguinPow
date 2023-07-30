import Room from "./Room";

const Play = ({ rooms, socketId }) => {
  return (
    <div className="rooms">
      <button
        className="back-btn"
        onClick={() => window.location.reload(false)}
      >
        BACK
      </button>
      {rooms.map((room) => {
        return <Room key={room.id} room={room} socketId={socketId} />;
      })}
    </div>
  );
};

export default Play;

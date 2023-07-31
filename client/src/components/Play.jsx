import Room from "./Room";

const Play = ({ rooms, setLobby }) => {
  return (
    <div className="rooms">
      <button
        className="back-btn"
        onClick={() => window.location.reload(false)}
      >
        BACK
      </button>
      {rooms.map((room) => {
        return <Room key={room.id} room={room} setLobby={setLobby} />;
      })}
    </div>
  );
};

export default Play;

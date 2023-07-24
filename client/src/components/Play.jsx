import Room from "./Room";

const Play = ({ rooms, toggle, setToggle, socketId }) => {
  return (
    <div className="rooms">
      {rooms.map((room) => {
        return (
          <Room
            key={room.id}
            room={room}
            socketId={socketId}
            setToggle={setToggle}
            toggle={toggle}
          />
        );
      })}
    </div>
  );
};

export default Play;

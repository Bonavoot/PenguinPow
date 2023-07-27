import { useState } from "react";
import Room from "./Room";

const Play = ({ rooms, join, setJoin, socketId }) => {
  return (
    <div className="rooms">
      {rooms.map((room) => {
        return (
          <Room
            key={room.id}
            room={room}
            socketId={socketId}
            setJoin={setJoin}
            join={join}
          />
        );
      })}
    </div>
  );
};

export default Play;

import { useEffect, useState } from "react";
import io from "socket.io-client";
import "./MainMenu.css";
import Play from "./components/Play";

const socket = io.connect("http://localhost:3001");

const MainMenu = () => {
  const [rooms, setRooms] = useState([]);
  const [toggle, setToggle] = useState(false);
  useEffect(() => {
    socket.on("rooms", (rooms) => {
      setRooms(rooms);
    });
  });

  return (
    <Play
      rooms={rooms}
      toggle={toggle}
      setToggle={setToggle}
      socketId={socket.id}
    />
  );
};

export default MainMenu;

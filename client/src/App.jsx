import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./SocketContext";
import MainMenu from "./components/MainMenu";
import "./App.css";

// Use this for HEROKU vvvvv
// "https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/"
// "http://localhost:3001"

const socket = io("http://localhost:3001");

function App() {
  const [rooms, setRooms] = useState([]);

  const getRooms = () => {
    socket.emit("get_rooms");
  };

  console.log(socket);
  useEffect(() => {
    socket.on("connect", () => {
      console.log(socket.id);
    });
    socket.on("connect_error", () => {
      setTimeout(() => socket.connect(), 5000);
    });

    socket.on("rooms", (rooms) => {
      setRooms(rooms);
    });
  }, []);

  return (
    <SocketContext.Provider value={{ socket, getRooms }}>
      <h1 className="logo">
        Penguin <span className="pow">POW !</span>
      </h1>
      <MainMenu rooms={rooms} />
    </SocketContext.Provider>
  );
}

export default App;

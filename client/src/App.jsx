import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./SocketContext";
import MainMenu from "./components/MainMenu";
import "./App.css";

// Use this for HEROKU vvvvv
// "https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/"
// "http://localhost:3001"

const socket = io("https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/");

function App() {
  const [rooms, setRooms] = useState([]);
  const [currentPage, setCurrentPage] = useState("mainMenu");

  const handleLogoClick = () => {
    window.location.reload(false);
  };
  const getRooms = () => {
    socket.emit("get_rooms");
  };

  useEffect(() => {
    socket.on("connect", () => {});
    socket.on("connect_error", () => {
      setTimeout(() => socket.connect(), 5000);
    });

    socket.on("rooms", (rooms) => {
      setRooms(rooms);
    });
  }, []);

  return (
    <SocketContext.Provider value={{ socket, getRooms }}>
      <h1 onClick={handleLogoClick} className="logo">
        P u m o <span className="pow"> PUMO !</span>
      </h1>

      <MainMenu
        rooms={rooms}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </SocketContext.Provider>
  );
}

export default App;

import Lobby from "./Lobby";
import Rooms from "./Rooms";
import { useState } from "react";

const MainMenu = ({ rooms }) => {
  const [currentPage, setCurrentPage] = useState("mainMenu");
  const [roomName, setRoomName] = useState("");

  const handleMainMenuPage = () => {
    setCurrentPage("mainMenu");
  };

  const handleDisplayRooms = () => {
    setCurrentPage("rooms");
  };

  const handleJoinRoom = () => {
    setCurrentPage("lobby");
  };

  let currentPageComponent;
  switch (currentPage) {
    case "mainMenu":
      currentPageComponent = (
        <div className="main-menu">
          <button onClick={handleDisplayRooms}>PLAY</button>
          <button>SHOP</button>
          <button>SETTINGS</button>
        </div>
      );
      break;
    case "rooms":
      currentPageComponent = (
        <Rooms
          rooms={rooms}
          handleMainMenuPage={handleMainMenuPage}
          handleJoinRoom={handleJoinRoom}
          setRoomName={setRoomName}
        />
      );
      break;
    case "lobby":
      currentPageComponent = <Lobby rooms={rooms} roomName={roomName} />;
      break;
    default:
      currentPageComponent = (
        <div>
          <h1>Error: Unknown page "{currentPage}"</h1>
          <button onClick={handleMainMenuPage}>Back to Main Menu</button>
        </div>
      );
  }

  return <div className="main-menu">{currentPageComponent}</div>;
};

export default MainMenu;

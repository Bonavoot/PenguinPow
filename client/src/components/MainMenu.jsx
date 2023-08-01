import Lobby from "../pages/Lobby";
import Rooms from "./Rooms";
import { useState } from "react";

const MainMenu = ({ rooms }) => {
  const [currentPage, setCurrentPage] = useState("mainMenu");
  const [roomName, setRoomName] = useState("");

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
          handleJoinRoom={handleJoinRoom}
          setRoomName={setRoomName}
        />
      );
      break;
    case "lobby":
      currentPageComponent = <Lobby roomName={roomName} />; //<App roomCode={roomCode} />;
      break;
    default:
      currentPageComponent = (
        <div>
          <h1>Error: Unknown page "{currentPage}"</h1>
          <button onClick={handleMainMenu}>Back to Main Menu</button>
        </div>
      );
  }

  return <div className="main-menu">{currentPageComponent}</div>;
};

export default MainMenu;

//{
//   roomsPage ? (
//     <Rooms rooms={rooms} />
//   ) : (
//     <button onClick={displayRooms}>PLAY</button>
//   );
// }

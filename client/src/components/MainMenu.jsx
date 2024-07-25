import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import { useState } from "react";

const MainMenu = ({ rooms, currentPage, setCurrentPage }) => {
  const [roomName, setRoomName] = useState("");

  const handleMainMenuPage = () => {
    setCurrentPage("mainMenu");
  };

  const handleDisplayRooms = () => {
    setCurrentPage("rooms");
  };

  const handleGame = () => {
    setCurrentPage("game");
  };

  const handleJoinRoom = () => {
    setCurrentPage("lobby");
  };

  let currentPageComponent;
  switch (currentPage) {
    case "mainMenu":
      currentPageComponent = (
        <div className="main-menu">
          <div className="main-menu-btn-container">
            <button id="play" onClick={handleDisplayRooms}>
              PLAY
            </button>
            <button id="closed">BASHO</button>
            <button id="closed">CUSTOMIZE</button>
            <button id="closed">STATS</button>
            <button id="closed">SETTINGS</button>
          </div>
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
      currentPageComponent = (
        <Lobby rooms={rooms} roomName={roomName} handleGame={handleGame} />
      );
      break;
    case "game":
      currentPageComponent = <Game rooms={rooms} roomName={roomName} />;
      break;
    case "training":
      //currentPageComponent = <Training />;
      break;
    default:
      currentPageComponent = (
        <div>
          <h1>Error: Unknown page {currentPage}</h1>
          <button onClick={handleMainMenuPage}>Back to Main Menu</button>
        </div>
      );
  }

  return <div className="main-menu">{currentPageComponent}</div>;
};

export default MainMenu;

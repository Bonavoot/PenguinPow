import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import { useState, useEffect } from "react";

const createCherryBlossoms = () => {
  const numPetals = 50;
  const petals = [];

  for (let i = 0; i < numPetals; i++) {
    const left = `${Math.random() * 100}%`;
    const animationDuration = `${Math.random() * 5 + 5}s`;
    const animationDelay = `${Math.random() * 5}s`;
    const size = `${Math.random() * 5 + 5}px`;

    petals.push(
      <div
        key={i}
        className="cherry-blossom"
        style={{
          left,
          animationDuration,
          animationDelay,
          width: size,
          height: size,
        }}
      />
    );
  }

  return petals;
};

const MainMenu = ({ rooms, currentPage, setCurrentPage }) => {
  const [roomName, setRoomName] = useState("");
  const [cherryBlossoms, setCherryBlossoms] = useState([]);

  useEffect(() => {
    setCherryBlossoms(createCherryBlossoms());
  }, []);

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

  return (
    <div>
      {cherryBlossoms}
      {currentPageComponent}
    </div>
  );
};

export default MainMenu;

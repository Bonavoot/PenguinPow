import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import Settings from "./Settings";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import sumo from "../assets/pumo-bkg.png";
import lobbyBackground from "../assets/lobby-bkg.webp";
import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import mainMenuBackground from "../assets/main-menu-bkg.png";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`;

const glowPulse = keyframes`
  0%, 100% {
    text-shadow: 0 0 10px rgba(255, 68, 68, 0.3),
                 0 0 20px rgba(255, 68, 68, 0.2);
  }
  50% {
    text-shadow: 0 0 15px rgba(255, 68, 68, 0.4),
                 0 0 30px rgba(255, 68, 68, 0.2);
  }
`;

const MainMenuContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.85),
      rgba(20, 20, 20, 0.75)
    ),
    url(${mainMenuBackground});
  background-size: cover;
  background-position: center;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5), 0 0 60px rgba(210, 180, 140, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
        circle at 70% 30%,
        rgba(210, 180, 140, 0.1) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 30% 70%,
        rgba(210, 180, 140, 0.1) 0%,
        transparent 50%
      );
    pointer-events: none;
  }
`;

const Logo = styled.h1`
  position: absolute;
  top: 5%;
  left: 5%;
  font-size: clamp(1.8rem, 4vw, 3.5rem);
  margin: 0;
  color: white;
  font-family: "Bungee", cursive;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 1s ease-out;
  z-index: 2;
  letter-spacing: 0.2em;
  background: linear-gradient(45deg, #ffffff, #f0f0f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.2));
`;

const PowText = styled.span`
  font-size: clamp(2rem, 5vw, 4rem);
  color: #ff4444;
  font-family: "Bungee Shade", cursive;
  text-shadow: 0 0 10px rgba(255, 68, 68, 0.3);
  animation: ${float} 3s ease-in-out infinite,
    ${glowPulse} 2s ease-in-out infinite;
  display: inline-block;
  margin-left: 0.2em;
  background: linear-gradient(45deg, #ff4444, #ff0000);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 8px rgba(255, 68, 68, 0.2));
  transform-origin: center;
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.05) rotate(-2deg);
  }
`;

const SumoImage = styled.img`
  position: absolute;
  right: -25%;
  bottom: -25%;
  width: clamp(500px, 80vw, 1200px);
  height: auto;
  filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
  animation: ${float} 4s ease-in-out infinite;
  z-index: 1;
  object-position: top;
  object-fit: contain;
  transform-origin: bottom right;
  max-width: 95%;
  max-height: 95vh;
`;

const ButtonContainer = styled.div`
  position: absolute;
  top: 38%;
  left: 8%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: clamp(1.6rem, 4vh, 2.4rem);
  z-index: 2;
  animation: ${fadeIn} 1s ease-out 0.5s both;
  width: clamp(180px, 22vw, 250px);
`;

const MenuButton = styled.button`
  background: ${(props) =>
    props.$isActive
      ? "linear-gradient(145deg, #FF4444, #CC0000)"
      : "linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))"};
  border: none;
  border-radius: 8px;
  padding: clamp(0.7rem, 1.5vh, 1rem) clamp(1.2rem, 2vw, 1.8rem);
  font-size: clamp(1rem, 1.8vh, 1.4rem);
  color: ${(props) => (props.$isActive ? "white" : "rgba(255, 255, 255, 0.5)")};
  font-family: "Bungee", cursive;
  cursor: ${(props) => (props.$isActive ? "pointer" : "default")};
  transition: all 0.3s ease;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    transform: ${(props) => (props.$isActive ? "translateX(10px)" : "none")};
    background: ${(props) =>
      props.$isActive
        ? "linear-gradient(145deg, #FF6666, #FF0000)"
        : "linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))"};
  }

  &:active {
    transform: ${(props) => (props.$isActive ? "translateX(5px)" : "none")};
  }
`;

const SettingsButton = styled.button`
  position: absolute;
  top: 5%;
  right: 5%;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  z-index: 2;
  padding: 0.5rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  .material-symbols-outlined {
    font-size: clamp(1.5rem, 3vw, 2.5rem);
  }

  &:hover {
    color: white;
    transform: rotate(45deg);
  }
`;

const preloadAssets = (sources) => {
  sources.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

const preGameImages = [lobbyBackground, pumo, pumo2];
preloadAssets(preGameImages);

const MainMenu = ({ rooms, currentPage, setCurrentPage, localId }) => {
  const [roomName, setRoomName] = useState("");
  const [showSettings, setShowSettings] = useState(false);

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

  const handleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  const handleClickOutside = (e) => {
    if (
      showSettings &&
      !e.target.closest(".settings-container") &&
      !e.target.closest(".settings-button")
    ) {
      setShowSettings(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings]);

  let currentPageComponent;
  switch (currentPage) {
    case "mainMenu":
      currentPageComponent = (
        <MainMenuContainer>
          <Logo>
            P u m o <PowText>PUMO!</PowText>
          </Logo>
          <SumoImage src={sumo} alt="sumo" />
          <ButtonContainer>
            <MenuButton $isActive onClick={handleDisplayRooms}>
              PLAY
            </MenuButton>
            <MenuButton>BASHO</MenuButton>
            <MenuButton>CUSTOMIZE</MenuButton>
            <MenuButton>STATS</MenuButton>
          </ButtonContainer>
          <SettingsButton className="settings-button" onClick={handleSettings}>
            <span className="material-symbols-outlined">settings</span>
          </SettingsButton>
          {showSettings && <Settings onClose={() => setShowSettings(false)} />}
        </MainMenuContainer>
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
      currentPageComponent = (
        <Game localId={localId} rooms={rooms} roomName={roomName} />
      );
      break;
    default:
      currentPageComponent = (
        <div>
          <h1>Error: Unknown page {currentPage}</h1>
          <button onClick={handleMainMenuPage}>Back to Main Menu</button>
        </div>
      );
  }

  return <div className="current-page">{currentPageComponent}</div>;
};

MainMenu.propTypes = {
  rooms: PropTypes.array.isRequired,
  currentPage: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  localId: PropTypes.string.isRequired,
};

export default MainMenu;

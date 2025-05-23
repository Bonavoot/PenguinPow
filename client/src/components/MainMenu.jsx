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
    text-shadow: 0 0 10px rgba(212, 175, 55, 0.3),
                 0 0 20px rgba(212, 175, 55, 0.2);
  }
  50% {
    text-shadow: 0 0 15px rgba(212, 175, 55, 0.4),
                 0 0 30px rgba(212, 175, 55, 0.2);
  }
`;

const woodGrain = keyframes`
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 200% 0%;
  }
`;

const MainMenuContainer = styled.div`
  display: block;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: linear-gradient(
      135deg,
      rgba(220, 180, 140, 0.95),
      rgba(180, 140, 100, 0.85)
    ),
    url(${mainMenuBackground});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  border: 2px solid #8b4513;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
        circle at 70% 30%,
        rgba(139, 69, 19, 0.1) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 30% 70%,
        rgba(139, 69, 19, 0.1) 0%,
        transparent 50%
      );
    pointer-events: none;
  }
`;

const Logo = styled.h1`
  position: absolute;
  top: 1rem;
  left: 1rem;
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  margin: 0;
  font-family: "Noto Serif JP", serif;
  font-weight: 900;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: 0.3em;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  z-index: 2;
  padding: 0.3em 0.6em;
  border: 4px solid #8b4513;
  background: linear-gradient(45deg, #a0522d, #cd853f, #a0522d, #8b4513);
  background-size: 200% 200%;
  animation: woodGrain 8s linear infinite;
  box-shadow: 4px 4px 0 #6b3410, inset 0 0 20px rgba(0, 0, 0, 0.2);
  transform: rotate(-2deg);
  text-transform: uppercase;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.05) 2px,
      rgba(0, 0, 0, 0.05) 4px
    );
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      45deg,
      transparent 0%,
      rgba(255, 255, 255, 0.15) 45%,
      rgba(255, 255, 255, 0.25) 50%,
      rgba(255, 255, 255, 0.15) 55%,
      transparent 100%
    );
    pointer-events: none;
  }
`;

const PowText = styled.span`
  font-size: 0.9em;
  color: #d4af37;
  font-weight: 900;
  position: relative;
  padding: 0 0.1em;

  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: #d4af37;
  }
`;

const SumoImage = styled.img`
  position: absolute;
  right: -15%;
  bottom: -25%;
  width: clamp(500px, 80vw, 1200px);
  height: auto;
  filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.3));
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
      ? "linear-gradient(45deg, #8b4513, #6b3410)"
      : "linear-gradient(145deg, rgba(44, 24, 16, 0.9), rgba(34, 14, 6, 0.9))"};
  border: 2px solid ${(props) => (props.$isActive ? "#d4af37" : "#8b4513")};
  border-radius: 4px;
  padding: clamp(0.7rem, 1.5vh, 1rem) clamp(1.2rem, 2vw, 1.8rem);
  font-size: clamp(1rem, 1.8vh, 1.4rem);
  color: ${(props) => (props.$isActive ? "#d4af37" : "#b4c8dc")};
  font-family: "Noto Sans JP", sans-serif;
  cursor: ${(props) => (props.$isActive ? "pointer" : "default")};
  transition: all 0.3s ease;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  width: 100%;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  letter-spacing: 1px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(212, 175, 55, 0.2),
      transparent
    );
    transition: 0.5s;
  }

  &:hover {
    transform: ${(props) => (props.$isActive ? "translateX(10px)" : "none")};
    background: ${(props) =>
      props.$isActive
        ? "linear-gradient(45deg, #6b3410, #4a2410)"
        : "linear-gradient(145deg, rgba(54, 34, 26, 0.95), rgba(44, 24, 16, 0.95))"};
    color: ${(props) => (props.$isActive ? "#fff" : "#d4af37")};
    border-color: ${(props) => (props.$isActive ? "#d4af37" : "#d4af37")};

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: ${(props) => (props.$isActive ? "translateX(5px)" : "none")};
  }
`;

const SettingsButton = styled.button`
  position: absolute;
  top: 3%;
  right: 3%;
  background: linear-gradient(
    145deg,
    rgba(139, 69, 19, 0.1),
    rgba(180, 200, 220, 0.05)
  );
  border: 2px solid rgba(139, 69, 19, 0.2);
  border-radius: 50%;
  color: #8b4513;
  cursor: pointer;
  z-index: 2;
  padding: 0.8rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);

  .material-symbols-outlined {
    font-size: clamp(1.5rem, 3vw, 2.5rem);
  }

  &:hover {
    color: #d4af37;
    transform: rotate(45deg);
    background: linear-gradient(
      145deg,
      rgba(139, 69, 19, 0.2),
      rgba(180, 200, 220, 0.1)
    );
    border-color: #d4af37;
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

  const renderMainMenu = () => (
    <MainMenuContainer>
      <Logo>
        Pumo Pumo <PowText>!</PowText>
      </Logo>
      {/* <SumoImage src={sumo} alt="sumo" /> */}
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

  // Render different pages based on currentPage
  switch (currentPage) {
    case "mainMenu":
      return (
        <div className="current-page">
          {renderMainMenu()}
          {currentPage === "rooms" && (
            <Rooms
              rooms={rooms}
              handleMainMenuPage={handleMainMenuPage}
              handleJoinRoom={handleJoinRoom}
              setRoomName={setRoomName}
            />
          )}
        </div>
      );
    case "lobby":
      return (
        <div className="current-page">
          <Lobby rooms={rooms} roomName={roomName} handleGame={handleGame} />
        </div>
      );
    case "game":
      return (
        <div className="current-page">
          <Game localId={localId} rooms={rooms} roomName={roomName} />
        </div>
      );
    default:
      return (
        <div className="current-page">
          {renderMainMenu()}
          {currentPage === "rooms" && (
            <Rooms
              rooms={rooms}
              handleMainMenuPage={handleMainMenuPage}
              handleJoinRoom={handleJoinRoom}
              setRoomName={setRoomName}
            />
          )}
        </div>
      );
  }
};

MainMenu.propTypes = {
  rooms: PropTypes.array.isRequired,
  currentPage: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  localId: PropTypes.string.isRequired,
};

export default MainMenu;

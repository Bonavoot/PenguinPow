import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import Settings from "./Settings";
import { useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { SocketContext } from "../SocketContext";
import lobbyBackground from "../assets/lobby-bkg.webp";
import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import mainMenuBackground3 from "../assets/main-menu-bkg.png";
import mainMenuBackground2 from "../assets/main-menu-bkg-2.png";
import mainMenuBackground from "../assets/main-menu-bkg-3.png";
import {
  playButtonHoverSound,
  playButtonPressSound2,
  playBackgroundMusic,
  stopBackgroundMusic,
} from "../utils/soundUtils";
import Snowfall, { SnowCap, IcicleRow, Icicle } from "./Snowfall";

// ============================================
// ANIMATIONS
// ============================================

const bannerSlideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-30px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
`;

const bannerSway = keyframes`
  0%, 100% { transform: rotate(-0.2deg); }
  50% { transform: rotate(0.2deg); }
`;

const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

const titleGlow = keyframes`
  0%, 100% { 
    text-shadow: 
      3px 3px 0 #000,
      0 0 20px rgba(212, 175, 55, 0.4),
      0 0 40px rgba(212, 175, 55, 0.2);
  }
  50% { 
    text-shadow: 
      3px 3px 0 #000,
      0 0 30px rgba(212, 175, 55, 0.6),
      0 0 60px rgba(212, 175, 55, 0.3);
  }
`;

const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-15px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
`;

const fadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const dotPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

// ============================================
// MAIN CONTAINER
// ============================================

const MainMenuContainer = styled.div`
  display: flex;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
`;

const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  opacity: ${(props) => (props.$isVisible ? 1 : 0)};
  transition: opacity 1.5s ease-in-out;
  pointer-events: none;
`;

// Subtle dark overlay with vignette - keeps images vibrant
const DarkOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    /* Left side fade for menu readability */
    linear-gradient(90deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.25) 30%, transparent 55%),
    /* Soft vignette around edges */
    radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.35) 100%);
  z-index: 1;
  pointer-events: none;
`;

// ============================================
// LEFT MENU PANEL
// ============================================

const LeftPanel = styled.div`
  position: relative;
  z-index: 10;
  width: clamp(280px, 28vw, 380px);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: clamp(30px, 4vh, 50px) clamp(24px, 3vw, 40px);
  padding-right: clamp(30px, 4vw, 50px);
  
  @media (max-width: 900px) {
    width: clamp(250px, 45vw, 320px);
    padding: clamp(20px, 3vh, 35px) clamp(16px, 2.5vw, 28px);
  }
  
  @media (max-width: 600px) {
    width: 100%;
    padding: clamp(16px, 2.5vh, 28px) clamp(16px, 4vw, 24px);
  }
`;

// ============================================
// BANNER COMPONENTS (matching in-game UI)
// ============================================

const MenuBanner = styled.div`
  position: relative;
  animation: ${bannerSlideIn} 0.5s ease-out forwards, ${bannerSway} 12s ease-in-out 0.5s infinite;
  transform-origin: top left;
  margin-bottom: auto;
`;

const HangingBar = styled.div`
  width: 105%;
  height: clamp(14px, 2vh, 22px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 5px 5px 0 0;
  margin-left: -2.5%;
  position: relative;
  border: 2px solid #8b7355;
  border-bottom: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  
  /* Hanging rings */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -8px;
    width: clamp(10px, 1.5vw, 16px);
    height: clamp(10px, 1.5vw, 16px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 12%; }
  &::after { right: 12%; }
`;

const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 3px solid #8b7355;
  border-top: none;
  border-radius: 0 0 clamp(8px, 1.2vw, 14px) clamp(8px, 1.2vw, 14px);
  padding: clamp(20px, 3vh, 32px) clamp(18px, 2.5vw, 28px) clamp(18px, 2.5vh, 28px);
  box-shadow: 
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.5),
    inset 0 2px 0 rgba(139, 115, 85, 0.1);
  position: relative;
  
  /* Fabric texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(255,255,255,0.015) 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.01) 1px,
        transparent 2px
      );
    pointer-events: none;
    border-radius: 0 0 clamp(8px, 1.2vw, 14px) clamp(8px, 1.2vw, 14px);
  }
  
  /* Gold corner decoration */
  &::after {
    content: "";
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    border: 1px solid rgba(212, 175, 55, 0.12);
    border-radius: clamp(4px, 0.8vw, 10px);
    pointer-events: none;
  }
  
  @media (max-width: 900px) {
    padding: clamp(16px, 2.5vh, 26px) clamp(14px, 2vw, 22px) clamp(14px, 2vh, 22px);
    border-width: 2px;
  }
`;

const TasselContainer = styled.div`
  position: absolute;
  bottom: -28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 15%;
  pointer-events: none;
`;

const Tassel = styled.div`
  width: clamp(6px, 1vw, 10px);
  height: clamp(22px, 3.5vh, 35px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 3px 3px;
  animation: ${tasselSway} ${props => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
  transform-origin: top center;
  
  &::after {
    content: "";
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 8px;
    background: linear-gradient(180deg, #8b7355 0%, #5c4033 100%);
    border-radius: 0 0 2px 2px;
  }
`;

// ============================================
// TITLE SECTION
// ============================================

const TitleSection = styled.div`
  text-align: center;
  margin-bottom: clamp(16px, 2.5vh, 24px);
  padding-bottom: clamp(12px, 1.8vh, 18px);
  border-bottom: 2px solid rgba(212, 175, 55, 0.25);
  position: relative;
  
  /* Decorative diamonds on border */
  &::before, &::after {
    content: "◆";
    position: absolute;
    bottom: -8px;
    font-size: clamp(8px, 1vw, 12px);
    color: #d4af37;
  }
  &::before { left: 15%; }
  &::after { right: 15%; }
`;

const GameTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.4rem, 2.8vw, 2rem);
  margin: 0 0 clamp(3px, 0.4vh, 6px) 0;
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  animation: ${titleGlow} 3s ease-in-out infinite;
  
  @media (max-width: 600px) {
    font-size: clamp(1.2rem, 4.5vw, 1.6rem);
  }
`;

const GameSubtitle = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 1vw, 0.7rem);
  color: #e8dcc8;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 #000;
  opacity: 0.8;
`;

// ============================================
// MENU BUTTONS
// ============================================

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vh, 14px);
  position: relative;
  z-index: 1;
`;

const MenuButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.3vw, 0.95rem);
  width: 100%;
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  color: ${props => props.$isActive ? '#d4af37' : '#6b5a4a'};
  border: 2px solid ${props => props.$isActive ? '#8b7355' : '#4a3a2a'};
  border-radius: clamp(4px, 0.7vw, 8px);
  padding: clamp(10px, 1.5vh, 16px) clamp(16px, 2.5vw, 26px);
  cursor: ${props => props.$isActive ? 'pointer' : 'default'};
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 -2px 4px rgba(0,0,0,0.3);
  text-shadow: 
    2px 2px 0 #000,
    ${props => props.$isActive ? '0 0 8px rgba(212, 175, 55, 0.25)' : 'none'};
  position: relative;
  text-align: left;
  opacity: 0;
  animation: ${slideIn} 0.4s ease-out forwards;
  animation-delay: ${props => 0.2 + props.$index * 0.07}s;
  
  /* Wood grain texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent 0px,
      rgba(255,255,255,0.02) 1px,
      transparent 3px
    );
    border-radius: clamp(4px, 0.7vw, 8px);
    pointer-events: none;
  }

  ${props => props.$isActive && css`
    &:hover {
      background: linear-gradient(180deg,
        #5c4530 0%,
        #4a3525 50%,
        #3d2817 100%
      );
      border-color: #d4af37;
      transform: translateX(8px);
      box-shadow: 
        0 6px 18px rgba(0,0,0,0.5),
        0 0 20px rgba(212, 175, 55, 0.2),
        inset 0 1px 0 rgba(255,255,255,0.12),
        inset 0 -2px 4px rgba(0,0,0,0.3);
      color: #f0d080;
    }

    &:active {
      transform: translateX(4px);
    }
  `}
  
  @media (max-width: 900px) {
    font-size: clamp(0.6rem, 1.8vw, 0.8rem);
    padding: clamp(9px, 1.3vh, 13px) clamp(14px, 2vw, 20px);
  }
`;

const ComingSoonBadge = styled.span`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: 0.65em;
  color: #666;
  margin-left: auto;
  padding-left: 1em;
  letter-spacing: 0.08em;
`;

// ============================================
// RIGHT CONTENT AREA
// ============================================

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  padding: clamp(24px, 3vh, 40px);
  position: relative;
  z-index: 5;
  
  @media (max-width: 600px) {
    display: none;
  }
`;

const AnnouncementCard = styled.div`
  background: linear-gradient(180deg,
    rgba(26, 10, 8, 0.92) 0%,
    rgba(21, 8, 5, 0.95) 100%
  );
  border: 2px solid rgba(139, 115, 85, 0.4);
  border-radius: clamp(8px, 1vw, 12px);
  padding: clamp(16px, 2vh, 24px) clamp(18px, 2.5vw, 28px);
  max-width: clamp(280px, 30vw, 380px);
  box-shadow: 
    0 10px 40px rgba(0,0,0,0.5),
    inset 0 0 30px rgba(0,0,0,0.4);
  opacity: 0;
  animation: ${fadeIn} 0.5s ease-out 0.6s forwards;
  
  /* Fabric texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(255,255,255,0.01) 1px,
        transparent 2px
      );
    pointer-events: none;
    border-radius: clamp(8px, 1vw, 12px);
  }
`;

const AnnouncementHeader = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1vw, 12px);
  margin-bottom: clamp(10px, 1.5vh, 16px);
  padding-bottom: clamp(8px, 1vh, 12px);
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
`;

const LiveDot = styled.span`
  width: clamp(6px, 0.8vw, 10px);
  height: clamp(6px, 0.8vw, 10px);
  background: #4ade80;
  border-radius: 50%;
  animation: ${dotPulse} 2s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
`;

const AnnouncementTitle = styled.h3`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.1vw, 0.8rem);
  color: #d4af37;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  text-shadow: 1px 1px 0 #000;
`;

const AnnouncementContent = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 400;
  font-size: clamp(0.55rem, 1vw, 0.75rem);
  color: #c8bca8;
  line-height: 1.7;
  text-shadow: 1px 1px 0 #000;
  
  p {
    margin: 0 0 clamp(6px, 1vh, 10px) 0;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  strong {
    color: #e8dcc8;
    font-weight: 600;
  }
`;

// ============================================
// SETTINGS BUTTON
// ============================================

const SettingsButton = styled.button`
  position: absolute;
  top: clamp(12px, 2vh, 20px);
  right: clamp(12px, 2vw, 20px);
  background: linear-gradient(180deg,
    rgba(26, 10, 8, 0.9) 0%,
    rgba(15, 5, 5, 0.9) 100%
  );
  border: 2px solid rgba(139, 115, 85, 0.4);
  border-radius: 50%;
  color: #8b7355;
  cursor: pointer;
  z-index: 20;
  width: clamp(40px, 4.5vw, 52px);
  height: clamp(40px, 4.5vw, 52px);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 4px 15px rgba(0,0,0,0.5),
    inset 0 0 15px rgba(0,0,0,0.4);
  
  .material-symbols-outlined {
    font-size: clamp(1.1rem, 2.2vw, 1.6rem);
    transition: transform 0.3s ease;
  }

  &:hover {
    color: #d4af37;
    border-color: rgba(212, 175, 55, 0.6);
    transform: rotate(45deg);
    box-shadow: 
      0 6px 20px rgba(0,0,0,0.6),
      0 0 12px rgba(212, 175, 55, 0.15),
      inset 0 0 15px rgba(0,0,0,0.4);
  }
`;

// ============================================
// VERSION INFO
// ============================================

const VersionInfo = styled.div`
  position: absolute;
  bottom: clamp(8px, 1.5vh, 14px);
  left: clamp(12px, 2vw, 20px);
  font-family: "Outfit", sans-serif;
  font-weight: 400;
  font-size: clamp(0.5rem, 0.75vw, 0.65rem);
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.12em;
  z-index: 10;
`;

// ============================================
// CONNECTION ERROR BANNER
// ============================================

const ConnectionErrorBanner = styled.div`
  position: absolute;
  top: clamp(12px, 2vh, 20px);
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(180deg,
    rgba(139, 0, 0, 0.95) 0%,
    rgba(100, 0, 0, 0.95) 100%
  );
  border: 2px solid rgba(255, 100, 100, 0.6);
  border-radius: clamp(6px, 1vw, 10px);
  padding: clamp(8px, 1.5vh, 14px) clamp(16px, 2.5vw, 24px);
  z-index: 30;
  box-shadow: 
    0 6px 20px rgba(0,0,0,0.6),
    0 0 15px rgba(255, 0, 0, 0.3),
    inset 0 0 20px rgba(0,0,0,0.4);
  animation: ${fadeIn} 0.4s ease-out;
  
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.9vw, 0.7rem);
  color: #ffcccc;
  letter-spacing: 0.08em;
  text-align: center;
  text-shadow: 1px 1px 0 #000;
  
  &::before {
    content: "⚠";
    margin-right: 0.5em;
    color: #ff6666;
    font-size: 1.2em;
  }
`;

// ============================================
// PRELOAD ASSETS
// ============================================

const preloadAssets = (sources) => {
  sources.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

const preGameImages = [
  lobbyBackground,
  pumo,
  pumo2,
  mainMenuBackground,
  mainMenuBackground2,
  mainMenuBackground3,
];
preloadAssets(preGameImages);

// ============================================
// MAIN COMPONENT
// ============================================

const MainMenu = ({ rooms, setRooms, currentPage, setCurrentPage, localId, connectionError }) => {
  const [roomName, setRoomName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [isCPUMatch, setIsCPUMatch] = useState(false);
  const { socket } = useContext(SocketContext);

  const backgroundImages = [
    mainMenuBackground,
    mainMenuBackground2,
    mainMenuBackground3,
  ];

  useEffect(() => {
    // Start playing background music when MainMenu mounts
    playBackgroundMusic();

    // Listen for CPU match creation success
    const handleCPUMatchCreated = (data) => {
      console.log("CPU match created:", data);
      setRoomName(data.roomId);
      setIsCPUMatch(true);
      setCurrentPage("lobby");
    };

    const handleCPUMatchFailed = (data) => {
      console.error("CPU match failed:", data.reason);
      alert("Failed to create CPU match: " + data.reason);
    };

    socket.on("cpu_match_created", handleCPUMatchCreated);
    socket.on("cpu_match_failed", handleCPUMatchFailed);

    // Cleanup function to stop music when component unmounts
    return () => {
      stopBackgroundMusic();
      socket.off("cpu_match_created", handleCPUMatchCreated);
      socket.off("cpu_match_failed", handleCPUMatchFailed);
    };
  }, [socket, setCurrentPage]);

  // Background cycling effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  // Add new effect to handle page changes
  useEffect(() => {
    if (currentPage === "game") {
      stopBackgroundMusic();
    } else if (currentPage === "mainMenu") {
      // Restart background music when returning to main menu
      playBackgroundMusic();
    }
  }, [currentPage]);

  const handleMainMenuPage = () => {
    setIsCPUMatch(false);
    setCurrentPage("mainMenu");
  };

  const handleDisplayRooms = () => {
    setCurrentPage("rooms");
  };

  const handleGame = () => {
    setCurrentPage("game");
  };

  const handleJoinRoom = () => {
    setIsCPUMatch(false);
    setCurrentPage("lobby");
  };

  const handleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  const handleVsCPU = () => {
    playButtonPressSound2();
    console.log("Starting VS CPU match...");
    socket.emit("create_cpu_match", { socketId: socket.id });
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

  const renderMainMenu = () => {
    return (
      <MainMenuContainer>
        {/* Cycling background images */}
        {backgroundImages.map((bgImage, index) => (
          <BackgroundImage
            key={index}
            src={bgImage}
            alt={`Background ${index + 1}`}
            $isVisible={index === currentBgIndex}
          />
        ))}
        <DarkOverlay />
        <Snowfall intensity={20} showFrost={true} zIndex={2} />
        
        {/* Connection Error Banner */}
        {connectionError && (
          <ConnectionErrorBanner>
            Connection error. Attempting to reconnect...
          </ConnectionErrorBanner>
        )}
        
        {/* Left Menu Panel */}
        <LeftPanel>
          <MenuBanner>
            <HangingBar>
              <SnowCap />
              <IcicleRow $bottom="-8px">
                <Icicle $w={3} $h={7} />
                <Icicle $w={2} $h={11} />
                <Icicle $w={3} $h={6} />
                <Icicle $w={2} $h={9} />
                <Icicle $w={3} $h={13} />
                <Icicle $w={2} $h={7} />
                <Icicle $w={3} $h={10} />
              </IcicleRow>
            </HangingBar>
            <BannerBody>
              <TitleSection>
                <GameTitle>Pumo Pumo !</GameTitle>
                <GameSubtitle>GRAND PUMO TOURNAMENT</GameSubtitle>
              </TitleSection>
              
              <ButtonsContainer>
                <MenuButton
                  $isActive
                  $index={0}
                  onClick={() => {
                    handleDisplayRooms();
                    playButtonPressSound2();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  Play Online
                </MenuButton>
                <MenuButton
                  $isActive
                  $index={1}
                  onClick={handleVsCPU}
                  onMouseEnter={playButtonHoverSound}
                >
                  VS CPU
                </MenuButton>
                <MenuButton
                  $index={2}
                  onMouseEnter={playButtonHoverSound}
                >
                  Basho<ComingSoonBadge>Soon</ComingSoonBadge>
                </MenuButton>
                <MenuButton
                  $index={3}
                  onMouseEnter={playButtonHoverSound}
                >
                  Customize<ComingSoonBadge>Soon</ComingSoonBadge>
                </MenuButton>
                <MenuButton
                  $index={4}
                  onMouseEnter={playButtonHoverSound}
                >
                  Stats<ComingSoonBadge>Soon</ComingSoonBadge>
                </MenuButton>
              </ButtonsContainer>
              
              <TasselContainer>
                <Tassel $delay={0} />
                <Tassel $delay={1} />
                <Tassel $delay={2} />
              </TasselContainer>
            </BannerBody>
          </MenuBanner>
        </LeftPanel>

        {/* Right Content Area */}
        <RightPanel>
          <AnnouncementCard>
            <AnnouncementHeader>
              <LiveDot />
              <AnnouncementTitle>Early Access</AnnouncementTitle>
            </AnnouncementHeader>
            <AnnouncementContent>
              <p>Welcome to <strong>Pumo Pumo!</strong></p>
              <p>Push your opponents out of the ring in this fast-paced penguin sumo battle. More features coming soon!</p>
            </AnnouncementContent>
          </AnnouncementCard>
        </RightPanel>

        <SettingsButton
          className="settings-button"
          onClick={() => {
            handleSettings();
            playButtonPressSound2();
          }}
          onMouseEnter={playButtonHoverSound}
        >
          <span className="material-symbols-outlined">settings</span>
        </SettingsButton>
        
        <VersionInfo>v0.1.0 Early Access</VersionInfo>
        
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </MainMenuContainer>
    );
  };

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
          <Lobby
            rooms={rooms}
            setRooms={setRooms}
            roomName={roomName}
            handleGame={handleGame}
            setCurrentPage={setCurrentPage}
            onLeaveDohyo={() => {
              setIsCPUMatch(false);
              setCurrentPage("mainMenu");
            }}
            isCPUMatch={isCPUMatch}
          />
        </div>
      );
    case "game":
      return (
        <div className="current-page">
          <Game
            localId={localId}
            rooms={rooms}
            roomName={roomName}
            setCurrentPage={setCurrentPage}
            isCPUMatch={isCPUMatch}
          />
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
  setRooms: PropTypes.func,
  currentPage: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  localId: PropTypes.string.isRequired,
  connectionError: PropTypes.bool,
};

export default MainMenu;

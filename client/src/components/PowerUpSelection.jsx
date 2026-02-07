import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import {
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
} from "../utils/soundUtils";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

// Banner drop animation
const bannerDrop = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-30px) scale(0.9);
  }
  60% {
    transform: translateY(5px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

// Gentle sway
const bannerSway = keyframes`
  0%, 100% { transform: rotate(-0.3deg); }
  50% { transform: rotate(0.3deg); }
`;

// Tassel sway
const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

// Card entrance
const cardSlide = keyframes`
  0% { 
    opacity: 0; 
    transform: translateY(10px);
  }
  100% { 
    opacity: 1; 
    transform: translateY(0);
  }
`;

// Selected pulse
const selectedPulse = keyframes`
  0%, 100% { 
    box-shadow: 
      0 0 0 2px var(--type-color),
      0 4px 12px rgba(0,0,0,0.4);
  }
  50% { 
    box-shadow: 
      0 0 0 3px var(--type-color),
      0 0 20px var(--type-color),
      0 4px 12px rgba(0,0,0,0.4);
  }
`;

// Timer urgency
const urgentFlash = keyframes`
  0%, 100% { color: #ff3333; }
  50% { color: #ffcc00; }
`;

// Transparent overlay
const PowerUpSelectionOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 9999;
  pointer-events: none;
`;

// Main container - centered horizontally, positioned below header
const BannerContainer = styled.div`
  margin-top: 55px;
  width: fit-content;
  max-width: min(90vw, 850px);
  pointer-events: auto;
  animation: ${bannerDrop} 0.5s ease-out forwards, ${bannerSway} 8s ease-in-out 0.5s infinite;
  transform-origin: top center;
  
  @media (max-width: 1200px) {
    margin-top: 50px;
    max-width: min(92vw, 750px);
  }
  
  @media (max-width: 900px) {
    margin-top: 45px;
    max-width: min(94vw, 650px);
  }
  
  @media (max-width: 600px) {
    margin-top: 40px;
    max-width: min(96vw, 500px);
  }
  
  @media (max-height: 700px) {
    margin-top: 40px;
  }
  
  @media (max-height: 550px) {
    margin-top: 35px;
  }
`;

// Top hanging bar (matches MatchOver)
const HangingBar = styled.div`
  width: 104%;
  height: clamp(14px, 2vh, 22px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 4px 4px 0 0;
  margin-left: -2%;
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
  &::before { left: 20%; }
  &::after { right: 20%; }
`;

// Main banner body (matches MatchOver style)
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
  padding: clamp(16px, 2.5vh, 28px) clamp(18px, 2vw, 32px) clamp(14px, 2vh, 24px);
  box-shadow: 
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.6),
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
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: clamp(4px, 0.8vw, 10px);
    pointer-events: none;
  }
  
  @media (max-width: 900px) {
    padding: clamp(12px, 2vh, 20px) clamp(12px, 1.8vw, 22px) clamp(10px, 1.5vh, 16px);
    border-width: 2px;
  }
`;

// Tassels container
const TasselContainer = styled.div`
  position: absolute;
  bottom: -25px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0 15%;
  pointer-events: none;
`;

const Tassel = styled.div`
  width: clamp(6px, 1vw, 10px);
  height: clamp(20px, 3vh, 35px);
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

// Title section with decorative border
const TitleSection = styled.div`
  text-align: center;
  margin-bottom: clamp(12px, 2vh, 20px);
  padding-bottom: clamp(10px, 1.5vh, 16px);
  border-bottom: 2px solid rgba(212, 175, 55, 0.3);
  position: relative;
  
  /* Decorative diamonds on border */
  &::before, &::after {
    content: "◆";
    position: absolute;
    bottom: -8px;
    font-size: clamp(8px, 1vw, 12px);
    color: #d4af37;
  }
  &::before { left: 25%; }
  &::after { right: 25%; }
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 2.2vw, 1.4rem);
  margin: 0;
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-shadow: 
    3px 3px 0 #000,
    0 0 20px rgba(212, 175, 55, 0.4);
  
  @media (max-width: 900px) {
    font-size: clamp(0.75rem, 3vw, 1.1rem);
  }
`;

// Cards grid
const CardsContainer = styled.div`
  display: flex;
  gap: clamp(8px, 1.5vw, 16px);
  justify-content: center;
  flex-wrap: nowrap;
  position: relative;
  z-index: 1;
  
  @media (max-width: 600px) {
    gap: clamp(5px, 1.2vw, 10px);
  }
`;

// Type color helper
const getTypeColor = (type) => {
  switch (type) {
    case "speed": return { main: "#00d2ff", dark: "#006688", light: "#66e5ff" };
    case "power": return { main: "#ff4444", dark: "#882222", light: "#ff7777" };
    case "snowball": return { main: "#74b9ff", dark: "#3366aa", light: "#a8d4ff" };
    case "pumo_army": return { main: "#ffaa44", dark: "#996622", light: "#ffcc88" };
    case "thick_blubber": return { main: "#aa77ff", dark: "#553399", light: "#cc99ff" };
    default: return { main: "#d4af37", dark: "#8b7355", light: "#f0d080" };
  }
};

// Power card - wooden plaque style (like Rematch button)
const PowerCard = styled.div`
  --type-color: ${props => getTypeColor(props.$type).main};
  
  display: flex;
  flex-direction: column;
  align-items: center;
  width: clamp(80px, 12vw, 145px);
  padding: clamp(12px, 1.6vh, 20px) clamp(8px, 1.2vw, 14px);
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border: 2px solid ${props => props.$selected ? getTypeColor(props.$type).main : '#8b7355'};
  border-radius: clamp(4px, 0.6vw, 8px);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  animation: ${cardSlide} 0.4s ease-out forwards;
  animation-delay: ${props => props.$index * 0.06}s;
  opacity: 0;
  flex-shrink: 0;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.1),
    inset 0 -2px 4px rgba(0,0,0,0.3);
  
  /* Wood grain */
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
    border-radius: clamp(4px, 0.6vw, 8px);
    pointer-events: none;
  }
  
  ${props => props.$selected && css`
    animation: ${cardSlide} 0.4s ease-out forwards, ${selectedPulse} 1.5s ease-in-out infinite;
    animation-delay: ${props.$index * 0.06}s, 0.4s;
    background: linear-gradient(180deg,
      ${getTypeColor(props.$type).dark}55 0%,
      #3d2817 50%,
      #2a1d14 100%
    );
  `}
  
  &:hover {
    transform: translateY(-4px);
    border-color: ${props => getTypeColor(props.$type).main};
    box-shadow: 
      0 8px 20px rgba(0,0,0,0.5),
      0 0 15px ${props => getTypeColor(props.$type).main}44,
      inset 0 1px 0 rgba(255,255,255,0.15);
  }
  
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 600px) {
    width: clamp(65px, 17vw, 110px);
    padding: clamp(10px, 1.4vh, 16px) clamp(6px, 1vw, 10px);
  }
`;

// Square icon with type color
const IconSquare = styled.div`
  width: clamp(35px, 5.5vw, 58px);
  height: clamp(35px, 5.5vw, 58px);
  background: linear-gradient(135deg,
    ${props => getTypeColor(props.$type).main} 0%,
    ${props => getTypeColor(props.$type).dark} 100%
  );
  border: 2px solid #000;
  border-radius: clamp(4px, 0.6vw, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(8px, 1vh, 12px);
  box-shadow: 
    inset 0 2px 4px rgba(255,255,255,0.3),
    inset 0 -2px 4px rgba(0,0,0,0.3),
    0 3px 8px rgba(0,0,0,0.4);
  
  img {
    width: 65%;
    height: 65%;
    object-fit: contain;
    filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.5));
  }
  
  @media (max-width: 600px) {
    width: clamp(34px, 8vw, 55px);
    height: clamp(34px, 8vw, 55px);
    margin-bottom: clamp(6px, 0.8vh, 10px);
  }
`;

const PowerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1.25vw, 0.95rem);
  color: ${props => props.$selected ? getTypeColor(props.$type).light : '#e8dcc8'};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.1;
  margin-bottom: clamp(3px, 0.4vh, 6px);
  text-shadow: 1px 1px 2px rgba(0,0,0,0.9);
  
  @media (max-width: 600px) {
    font-size: clamp(0.5rem, 2.2vw, 0.75rem);
  }
`;

const PowerDesc = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.48rem, 0.95vw, 0.7rem);
  color: rgba(232, 220, 200, 0.6);
  text-align: center;
  line-height: 1.15;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.7);
  
  @media (max-width: 600px) {
    font-size: clamp(0.4rem, 1.65vw, 0.58rem);
  }
`;

const PowerType = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.44rem, 0.85vw, 0.62rem);
  color: ${props => props.$isActive ? '#44ff88' : 'white'};
  text-transform: uppercase;
  margin-top: clamp(4px, 0.6vh, 8px);
  letter-spacing: 0.05em;
  text-shadow: ${props => props.$isActive ? '0 0 6px rgba(68, 255, 136, 0.4), 1px 1px 1px rgba(0,0,0,0.8)' : '1px 1px 1px rgba(0,0,0,0.7)'};
  
  @media (max-width: 600px) {
    font-size: clamp(0.38rem, 1.35vw, 0.54rem);
  }
`;

// Timer display - simple centered
const TimerDisplay = styled.div`
  display: flex;
  justify-content: center;
  align-items: baseline;
  margin-top: clamp(14px, 2vh, 22px);
  position: relative;
  z-index: 1;
  
  ${props => props.$urgent && css`
    animation: ${urgentFlash} 0.6s ease-in-out infinite;
  `}
`;

const TimerNumber = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 2vw, 1.5rem);
  color: ${props => props.$urgent ? '#ff3333' : '#d4af37'};
  text-shadow: 2px 2px 0 #000, 0 0 10px rgba(212, 175, 55, 0.3);
  letter-spacing: 0.05em;
  
  @media (max-width: 600px) {
    font-size: clamp(0.85rem, 2.5vw, 1.2rem);
  }
`;

const TimerUnit = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 1vw, 0.75rem);
  color: ${props => props.$urgent ? '#ff3333' : '#8b7355'};
  text-shadow: 1px 1px 0 #000;
  margin-left: 2px;
  
  @media (max-width: 600px) {
    font-size: clamp(0.4rem, 1.2vw, 0.6rem);
  }
`;

const PowerUpSelection = ({
  roomId,
  playerId,
  onSelectionComplete,
  onSelectionStateChange,
}) => {
  const { socket } = useContext(SocketContext);
  const [selectedPowerUp, setSelectedPowerUp] = useState(null);
  const [selectionStatus, setSelectionStatus] = useState({
    selectedCount: 0,
    totalPlayers: 2,
  });
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [availablePowerUps, setAvailablePowerUps] = useState([]);

  const powerUpInfo = useMemo(
    () => ({
      speed: {
        name: "Happy Feet",
        description: "Speed & dodge",
        icon: happyFeetIcon,
      },
      power: {
        name: "Power Water",
        description: "+20% knockback",
        icon: powerWaterIcon,
      },
      snowball: {
        name: "Snowball",
        description: "Throw with F",
        icon: snowballImage,
      },
      pumo_army: {
        name: "Pumo Army",
        description: "Summon clones",
        icon: pumoArmyIcon,
      },
      thick_blubber: {
        name: "Thick Blubber",
        description: "Block 1 hit",
        icon: thickBlubberIcon,
      },
    }),
    []
  );

  const timerNumber = useMemo(() => {
    return timeLeft > 0 ? timeLeft : "0";
  }, [timeLeft]);

  const countdownIntervalRef = useRef(null);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdownTimer = useCallback(() => {
    clearCountdownInterval();
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdownInterval]);

  useEffect(() => {
    const handlePowerUpSelectionStart = (data) => {
      setIsVisible(true);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);
      startCountdownTimer();
      if (onSelectionStateChange) {
        onSelectionStateChange(true);
      }
    };

    const handlePowerUpSelectionStatus = (data) => {
      setSelectionStatus(data);
    };

    const handlePowerUpSelectionComplete = () => {
      setIsVisible(false);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    const handleGameReset = () => {
      setIsVisible(false);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
    };

    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_status", handlePowerUpSelectionStatus);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_status", handlePowerUpSelectionStatus);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);
      socket.off("game_reset", handleGameReset);
      clearCountdownInterval();
    };
  }, [
    startCountdownTimer,
    clearCountdownInterval,
    onSelectionComplete,
    onSelectionStateChange,
    playerId,
    roomId,
    socket,
  ]);

  useEffect(() => {
    const requestPowerUpState = () => {
      socket.emit("request_power_up_selection_state", {
        roomId,
        playerId,
      });
    };

    requestPowerUpState();
    const stateRequestTimeout = setTimeout(requestPowerUpState, 500);

    return () => {
      clearTimeout(stateRequestTimeout);
    };
  }, [socket, playerId, roomId]);

  const handlePowerUpSelect = useCallback(
    (powerUpType) => {
      if (selectedPowerUp) return;
      playPowerUpSelectionPressSound();
      setSelectedPowerUp(powerUpType);
      socket.emit("power_up_selected", {
        roomId,
        playerId,
        powerUpType,
      });
    },
    [selectedPowerUp, socket, roomId, playerId]
  );

  if (!isVisible) return null;

  return (
    <PowerUpSelectionOverlay>
      <BannerContainer>
        <HangingBar />
        <BannerBody>
          <TitleSection>
            <Title>Select Power</Title>
          </TitleSection>

          <CardsContainer>
            {availablePowerUps.map((type, index) => {
              const info = powerUpInfo[type];
              if (!info) return null;

              return (
                <PowerCard
                  key={type}
                  $type={type}
                  $selected={selectedPowerUp === type}
                  $index={index}
                  onClick={() => handlePowerUpSelect(type)}
                  onMouseEnter={playPowerUpSelectionHoverSound}
                  disabled={selectedPowerUp && selectedPowerUp !== type}
                >
                  <IconSquare $type={type}>
                    <img src={info.icon} alt={info.name} />
                  </IconSquare>
                  <PowerName $type={type} $selected={selectedPowerUp === type}>
                    {info.name}
                  </PowerName>
                  <PowerDesc>{info.description}</PowerDesc>
                  <PowerType $isActive={type === "snowball" || type === "pumo_army"}>
                    {type === "snowball" || type === "pumo_army" ? "● Active" : "○ Passive"}
                  </PowerType>
                </PowerCard>
              );
            })}
          </CardsContainer>

          <TimerDisplay $urgent={timeLeft <= 5}>
            <TimerNumber $urgent={timeLeft <= 5}>{timerNumber}</TimerNumber>
            <TimerUnit $urgent={timeLeft <= 5}>s</TimerUnit>
          </TimerDisplay>
          
          <TasselContainer>
            <Tassel $delay={0} />
            <Tassel $delay={1} />
            <Tassel $delay={2} />
            <Tassel $delay={3} />
            <Tassel $delay={4} />
          </TasselContainer>
        </BannerBody>
      </BannerContainer>
    </PowerUpSelectionOverlay>
  );
};

PowerUpSelection.propTypes = {
  roomId: PropTypes.string.isRequired,
  playerId: PropTypes.string.isRequired,
  onSelectionComplete: PropTypes.func,
  onSelectionStateChange: PropTypes.func,
};

export default PowerUpSelection;

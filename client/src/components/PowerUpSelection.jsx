import { useState, useEffect, useContext } from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";

// Animation for entrance
const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
    filter: blur(10px);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    filter: blur(0);
  }
`;

// Animation for urgent timer
const urgentPulse = keyframes`
  0%, 100% { 
    color: #ff4757;
    text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,
                 0 0 10px rgba(255, 71, 87, 0.8), 0 0 20px rgba(255, 71, 87, 0.5);
  }
  50% { 
    color: #ffffff;
    text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,
                 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 255, 255, 0.5);
  }
`;

const PowerUpSelectionOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(18, 18, 19, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const PowerUpContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  border: 4px solid #000;
  border-radius: clamp(8px, 1.5vw, 16px);
  padding: clamp(20px, 3vw, 40px);
  text-align: center;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.8),
    inset 0 2px 0 rgba(255, 255, 255, 0.3);
  width: clamp(400px, 60vw, 700px);
  max-width: 95%;
  animation: ${slideIn} 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  color: #000;
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  margin: 0 0 clamp(10px, 2vw, 20px) 0;
  color: #000;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: none;
`;

const Subtitle = styled.h2`
  font-family: "Bungee", cursive;
  font-size: clamp(0.8rem, 2vw, 1.2rem);
  margin: 0 0 clamp(20px, 3vw, 30px) 0;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const PowerUpGrid = styled.div`
  display: flex;
  gap: clamp(10px, 2vw, 20px);
  justify-content: center;
  margin-bottom: clamp(20px, 3vw, 30px);
  flex-wrap: nowrap;
`;

const PowerUpCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${(props) => {
    if (props.$selected) return "linear-gradient(135deg, #ff6b6b, #ee5a52)";
    return "linear-gradient(135deg, #f8f9fa, #e9ecef)";
  }};
  border: 3px solid ${(props) => (props.$selected ? "#c92a2a" : "#000")};
  border-radius: clamp(6px, 1.5vw, 12px);
  padding: clamp(12px, 2vw, 20px);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: clamp(120px, 15vw, 180px);
  height: clamp(120px, 15vw, 180px);
  position: relative;
  flex-shrink: 0;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3),
      0 0 0 2px ${(props) => (props.$selected ? "#c92a2a" : "#495057")};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  ${(props) =>
    props.$selected &&
    `
    box-shadow: 
      0 8px 25px rgba(201, 42, 42, 0.4),
      0 0 0 3px #c92a2a,
      inset 0 2px 0 rgba(255, 255, 255, 0.2);
  `}
`;

const PowerUpIcon = styled.div`
  width: clamp(40px, 6vw, 70px);
  height: clamp(40px, 6vw, 70px);
  border-radius: 50%;
  background: ${(props) => {
    switch (props.$type) {
      case "speed":
        return "linear-gradient(135deg, #00d2ff, #3a7bd5)";
      case "power":
        return "linear-gradient(135deg, #ff6b6b, #ee5a52)";
      case "snowball":
        return "linear-gradient(135deg, #74b9ff, #0984e3)";
      case "pumo_army":
        return "linear-gradient(135deg, #fff4e6 0%, #ffcc80 30%, #ff8c00 100%)";
      default:
        return "linear-gradient(135deg, #6c757d, #495057)";
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(8px, 1.5vw, 15px);
  border: 2px solid #000;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  font-size: clamp(1.2rem, 3vw, 2rem);
  font-weight: bold;
  color: #fff;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
  }
`;

const PowerUpName = styled.h3`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.8vw, 1.1rem);
  margin: 0 0 clamp(4px, 1vw, 8px) 0;
  color: ${(props) => (props.$selected ? "#fff" : "#000")};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: ${(props) =>
    props.$selected
      ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
      : "none"};
  line-height: 1;
`;

const PowerUpDescription = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 1.2vw, 0.8rem);
  margin: 0;
  color: ${(props) => (props.$selected ? "#fff" : "#666")};
  text-align: center;
  line-height: 1.2;
  text-shadow: ${(props) =>
    props.$selected
      ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
      : "none"};
`;

const StatusContainer = styled.div`
  border-top: 2px solid #dee2e6;
  padding-top: clamp(15px, 2.5vw, 25px);
  margin-top: clamp(15px, 2.5vw, 25px);
`;

const StatusText = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.5vw, 1rem);
  margin: clamp(5px, 1vw, 8px) 0;
  color: #000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TimerText = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.8rem, 1.6vw, 1.1rem);
  margin: clamp(8px, 1.5vw, 12px) 0 0 0;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${(props) =>
    props.$urgent
      ? css`
          animation: ${urgentPulse} 1s ease-in-out infinite;
        `
      : css`
          color: #495057;
          text-shadow: none;
        `}
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

  const powerUpInfo = {
    speed: {
      name: "Speed",
      description: "Enhanced movement & dodge speed",
      icon: "⚡",
    },
    power: {
      name: "Power Water",
      description: "Increase knockback by 30%",
      icon: powerWaterIcon,
    },
    snowball: {
      name: "Snowball",
      description: "Throw snowball with F key",
      icon: snowballImage,
    },
    pumo_army: {
      name: "Pumo Army",
      description: "Spawn mini clones with F key",
      icon: pumoArmyIcon,
    },
  };

  useEffect(() => {
    let countdownInterval;

    const handlePowerUpSelectionStart = (data) => {
      setIsVisible(true);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);

      // Start countdown timer
      countdownInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Notify parent that selection is now active
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

      // Clear countdown timer
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }

      // Notify parent that selection is no longer active
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_status", handlePowerUpSelectionStatus);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);

    return () => {
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_status", handlePowerUpSelectionStatus);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);

      // Clean up countdown timer
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [onSelectionComplete, onSelectionStateChange]);

  const handlePowerUpSelect = (powerUpType) => {
    if (selectedPowerUp) return; // Prevent changing selection

    setSelectedPowerUp(powerUpType);
    socket.emit("power_up_selected", {
      roomId,
      playerId,
      powerUpType,
    });
  };

  if (!isVisible) return null;

  return (
    <PowerUpSelectionOverlay>
      <PowerUpContainer>
        <Title>Power-Up Selection</Title>
        <Subtitle>Choose your enhancement for this round</Subtitle>

        <PowerUpGrid>
          {availablePowerUps.map((type) => {
            const info = powerUpInfo[type];
            if (!info) return null;

            return (
              <PowerUpCard
                key={type}
                $selected={selectedPowerUp === type}
                onClick={() => handlePowerUpSelect(type)}
                disabled={selectedPowerUp && selectedPowerUp !== type}
              >
                <PowerUpIcon $type={type}>
                  {type === "power" ||
                  type === "snowball" ||
                  type === "pumo_army" ? (
                    <img src={info.icon} alt={info.name} />
                  ) : (
                    info.icon
                  )}
                </PowerUpIcon>
                <PowerUpName $selected={selectedPowerUp === type}>
                  {info.name}
                </PowerUpName>
                <PowerUpDescription $selected={selectedPowerUp === type}>
                  {info.description}
                </PowerUpDescription>
              </PowerUpCard>
            );
          })}
        </PowerUpGrid>

        <StatusContainer>
          <StatusText>
            {selectedPowerUp
              ? `${powerUpInfo[selectedPowerUp].name} Selected - Waiting for opponent...`
              : "Select a power-up to continue"}
          </StatusText>
          <StatusText>
            Players Ready: {selectionStatus.selectedCount}/
            {selectionStatus.totalPlayers}
          </StatusText>
          <TimerText $urgent={timeLeft <= 5}>
            {timeLeft > 0
              ? `${timeLeft} seconds remaining`
              : "Auto-selecting Speed..."}
          </TimerText>
        </StatusContainer>
      </PowerUpContainer>
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

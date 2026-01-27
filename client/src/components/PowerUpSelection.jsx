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

// Simplified animation for entrance - removed expensive blur
const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;

// Simplified urgent timer animation
const urgentPulse = keyframes`
  0%, 100% { 
    color: #ff4757;
  }
  50% { 
    color: #ffffff;
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
  z-index: 9999;
  pointer-events: all;
`;

const PowerUpContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #121213, rgba(20, 19, 19, 0.95));
  border: 2px solid #d4af37;
  border-radius: clamp(8px, 1.5vw, 16px);
  /* Smaller padding on small screens */
  padding: clamp(12px, 2.5vw, 35px);
  text-align: center;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
  /* Smaller minimum width for small screens */
  width: clamp(280px, 55vw, 650px);
  max-width: 95%;
  animation: ${slideIn} 0.3s ease-out forwards;
  color: #fff;
  overflow: hidden;
  will-change: transform, opacity;
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(1rem, 3.5vw, 2.2rem);
  margin: 0 0 clamp(8px, 1.5vw, 18px) 0;
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 2px 2px 0 #000;
  position: relative;
  z-index: 1;
`;

const Subtitle = styled.h2`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.6rem, 1.6vw, 1rem);
  margin: 0 0 clamp(12px, 2.5vw, 25px) 0;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 1px 1px 0 #000;
  position: relative;
  z-index: 1;
`;

const PowerUpGrid = styled.div`
  display: flex;
  gap: clamp(10px, 2vw, 20px);
  justify-content: center;
  margin-bottom: clamp(20px, 3vw, 30px);
  flex-wrap: nowrap;
`;

// Enhanced PowerUpCard with different themes for active vs passive power-ups
const PowerUpCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${(props) => {
    if (props.$selected) {
      return `
        linear-gradient(135deg, #969696, #8b8b8b, #808080),
        radial-gradient(circle at center, rgba(255, 255, 255, 0.3), transparent)
      `;
    }

    return `
             linear-gradient(135deg, #eeeeee, #dddddd, #cccccc),
        radial-gradient(circle at center, rgba(255, 255, 255, 0.3), transparent),
      linear-gradient(45deg, rgba(248, 248, 248, 0.8), rgba(240, 240, 240, 0.8))
    `;
  }};
  /* border: 3px solid ${(props) =>
    props.$selected ? "#d4af370" : "#d4af37"}; */
  border-radius: clamp(6px, 1.5vw, 12px);
  /* Smaller padding on small screens */
  padding: clamp(8px, 1.5vw, 18px);
  cursor: pointer;
  transition: all 0.3s ease-out;
  /* Smaller minimum size for small screens */
  width: clamp(80px, 12vw, 160px);
  height: clamp(80px, 12vw, 160px);
  position: relative;
  flex-shrink: 0;
  box-shadow: ${(props) => {
    if (props.$selected) {
      return "0 8px 25px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.8)";
    }
    return "0 6px 20px rgba(0, 0, 0, 0.1), inset 0 1px 3px rgba(255, 255, 255, 0.6)";
  }};

  &:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: ${(props) => {
      if (props.$selected) {
        return "0 12px 35px rgba(0, 0, 0, 0.2), inset 0 1px 3px rgba(255, 255, 255, 0.9)";
      }
      return "0 10px 30px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.7)";
    }};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: clamp(6px, 1.5vw, 12px);
    background: ${(props) =>
      props.$selected
        ? "linear-gradient(45deg, rgba(255, 255, 255, 0.1), transparent)"
        : "linear-gradient(45deg, rgba(255, 255, 255, 0.05), transparent)"};
    pointer-events: none;
  }
`;

// Simplified PowerUpIcon - reduced complex gradients
const PowerUpIcon = styled.div`
  /* Smaller minimum for small screens */
  width: clamp(28px, 5vw, 60px);
  height: clamp(28px, 5vw, 60px);
  border-radius: 50%;
  background: ${(props) => {
    switch (props.$type) {
      case "speed":
        return "#00d2ff";
      case "power":
        return "#ff6b6b";
      case "snowball":
        return "#74b9ff";
      case "pumo_army":
        return "#ffcc80";
      case "thick_blubber":
        return "#9c88ff";
      default:
        return "#6c757d";
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(5px, 1vw, 12px);
  border: 2px solid #000000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  font-size: clamp(0.9rem, 2.5vw, 1.8rem);
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 0 #000;

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
  }
`;

const PowerUpName = styled.h3`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.5rem, 1.4vw, 0.95rem);
  margin: 0 0 clamp(2px, 0.8vw, 6px) 0;
  color: ${(props) => {
    if (props.$selected) return "#000";

    switch (props.$type) {
      case "speed":
        return "#00d2ff";
      case "power":
        return "#ff6b6b";
      case "snowball":
        return "#74b9ff";
      case "pumo_army":
        return "#ffcc80";
      case "thick_blubber":
        return "#9c88ff";
      default:
        return "#6c757d";
    }
  }};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-shadow: ${(props) =>
    props.$selected
      ? "none"
      : "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 1px 0 0 #000, 0 -1px 0 #000"};
  line-height: 1;
`;

const PowerUpDescription = styled.p`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.35rem, 1vw, 0.7rem);
  margin: 0 0 clamp(2px, 0.8vw, 6px) 0;
  color: ${(props) => (props.$selected ? "#2a2a2a" : "#4a4a4a")};
  text-align: center;
  line-height: 1.2;
  text-shadow: ${(props) =>
    props.$selected
      ? "0 1px 0 rgba(255, 255, 255, 0.9)"
      : "0 1px 0 rgba(255, 255, 255, 0.7)"};
  font-weight: 600;
  letter-spacing: 0.02em;
`;

const PowerUpType = styled.p`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.3rem, 0.8vw, 0.6rem);
  margin: 0;
  color: ${(props) => {
    if (props.$selected) return "#000";

    // Different colors for active vs passive based on the type text
    if (props.$isActive) {
      return "rgb(136, 255, 100)"; // Much darker red for active power-ups (better readability)
    } else {
      return "#ededed"; // Keep passive white/light gray as it looked good with black stroke
    }
  }};
  text-align: center;
  line-height: 1;
  font-style: italic;
  text-transform: lowercase;
  letter-spacing: 0.08em; // Increased letter spacing for better readability
  text-shadow: ${(props) =>
    props.$selected
      ? "none"
      : "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 1px 0 0 #000, 0 -1px 0 #000, -1px 0 0 #000"};
  
  // Prevent any hover effects on the text itself
  transition: none;
  pointer-events: none;
`;

const StatusContainer = styled.div`
  border-top: 2px solid rgba(212, 175, 55, 0.4);
  /* Smaller padding/margin on small screens */
  padding-top: clamp(10px, 2vw, 20px);
  margin-top: clamp(10px, 2vw, 20px);
  position: relative;
  z-index: 1;
`;

const StatusText = styled.p`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.5rem, 1.2vw, 0.85rem);
  margin: clamp(3px, 0.8vw, 6px) 0;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 1px 1px 0 #000;
`;

// Simplified timer animation
const TimerText = styled.p`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.55rem, 1.3vw, 0.95rem);
  margin: clamp(5px, 1.2vw, 10px) 0 0 0;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${(props) =>
    props.$urgent
      ? css`
          animation: ${urgentPulse} 1s ease-in-out infinite;
        `
      : css`
          color: #d4af37;
          text-shadow: 1px 1px 0 #000;
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

  // Memoize power up info to prevent recreation on every render
  const powerUpInfo = useMemo(
    () => ({
      speed: {
        name: "Happy Feet",
        description: "Enhanced movement & dodge speed",
        icon: happyFeetIcon,
      },
      power: {
        name: "Power Water",
        description: "Increase knockback by 20%",
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
      thick_blubber: {
        name: "Thick Blubber",
        description: "Charged attack and grab absorbs 1 hit",
        icon: thickBlubberIcon,
      },
    }),
    []
  );

  // Memoize the timer status message to prevent unnecessary re-renders
  const statusMessage = useMemo(() => {
    if (selectedPowerUp) {
      return `${powerUpInfo[selectedPowerUp].name} Selected - Waiting for opponent...`;
    }
    return "Select a power-up to continue";
  }, [selectedPowerUp, powerUpInfo]);

  // Memoize timer text to prevent unnecessary re-renders
  const timerMessage = useMemo(() => {
    return timeLeft > 0
      ? `${timeLeft} seconds remaining`
      : "Auto-selecting power-up...";
  }, [timeLeft]);

  // Use ref to store countdown interval to prevent multiple intervals
  const countdownIntervalRef = useRef(null);

  // Clear any existing countdown interval
  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start countdown timer
  const startCountdownTimer = useCallback(() => {
    // Clear any existing timer first
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
      console.log(
        `🟢 PowerUpSelection: Received power_up_selection_start for player ${playerId} in room ${roomId}`,
        data
      );
      setIsVisible(true);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);

      // Start countdown timer
      startCountdownTimer();

      // Notify parent that selection is now active
      if (onSelectionStateChange) {
        onSelectionStateChange(true);
      }
    };

    const handlePowerUpSelectionStatus = (data) => {
      console.log(
        `🟡 PowerUpSelection: Received power_up_selection_status for player ${playerId}`,
        data
      );
      setSelectionStatus(data);
    };

    const handlePowerUpSelectionComplete = () => {
      console.log(
        `🔴 PowerUpSelection: Received power_up_selection_complete for player ${playerId}`
      );
      setIsVisible(false);
      setTimeLeft(15);
      setAvailablePowerUps([]);

      // Clear countdown timer
      clearCountdownInterval();

      // Notify parent that selection is no longer active
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    // Add game_reset handler to ensure clean slate
    const handleGameReset = () => {
      console.log(
        `🔵 PowerUpSelection: Received game_reset for player ${playerId}, clearing state`
      );
      setIsVisible(false);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps([]);

      // Clear countdown timer
      clearCountdownInterval();

      // Notify parent that selection is no longer active
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
    };

    // Set up socket listeners with logging
    console.log(
      `🔵 PowerUpSelection: Setting up socket listeners for player ${playerId} in room ${roomId}`
    );
    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_status", handlePowerUpSelectionStatus);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);
    socket.on("game_reset", handleGameReset);

    return () => {
      console.log(
        `🔴 PowerUpSelection: Cleaning up socket listeners for player ${playerId}`
      );
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_status", handlePowerUpSelectionStatus);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);
      socket.off("game_reset", handleGameReset);

      // Clear countdown timer
      clearCountdownInterval();
    };
  }, [
    startCountdownTimer,
    clearCountdownInterval,
    onSelectionComplete,
    onSelectionStateChange,
    playerId,
    roomId,
  ]);

  // Separate effect for requesting power-up state (to avoid re-running socket listeners)
  useEffect(() => {
    // Request current power-up selection state in case we missed the initial event
    const requestPowerUpState = () => {
      console.log(
        `🔵 PowerUpSelection: Requesting power-up selection state for player ${playerId} in room ${roomId}`
      );
      socket.emit("request_power_up_selection_state", {
        roomId,
        playerId,
      });
    };

    // Request state immediately and after a short delay
    requestPowerUpState();
    const stateRequestTimeout = setTimeout(requestPowerUpState, 500);

    return () => {
      clearTimeout(stateRequestTimeout);
    };
  }, [socket, playerId, roomId]); // Only depend on what's actually needed for the request

  // Memoize the power up select handler to prevent recreation
  const handlePowerUpSelect = useCallback(
    (powerUpType) => {
      if (selectedPowerUp) return; // Prevent changing selection

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
      <PowerUpContainer>
        <Title>Power-Up Selection</Title>
        <Subtitle>Choose your power-up for this round</Subtitle>

        <PowerUpGrid>
          {availablePowerUps.map((type) => {
            const info = powerUpInfo[type];
            if (!info) return null;

            return (
              <PowerUpCard
                key={type}
                $type={type}
                $selected={selectedPowerUp === type}
                onClick={() => handlePowerUpSelect(type)}
                onMouseEnter={playPowerUpSelectionHoverSound}
                disabled={selectedPowerUp && selectedPowerUp !== type}
              >
                <PowerUpIcon $type={type}>
                  {type === "speed" ||
                  type === "power" ||
                  type === "snowball" ||
                  type === "pumo_army" ||
                  type === "thick_blubber" ? (
                    <img src={info.icon} alt={info.name} />
                  ) : (
                    info.icon
                  )}
                </PowerUpIcon>
                <PowerUpName $type={type} $selected={selectedPowerUp === type}>
                  {info.name}
                </PowerUpName>
                <PowerUpDescription $selected={selectedPowerUp === type}>
                  {info.description}
                </PowerUpDescription>
                <PowerUpType
                  $selected={selectedPowerUp === type}
                  $isActive={type === "snowball" || type === "pumo_army"}
                >
                  {type === "snowball" || type === "pumo_army"
                    ? "(active)"
                    : "(passive)"}
                </PowerUpType>
              </PowerUpCard>
            );
          })}
        </PowerUpGrid>

        <StatusContainer>
          <StatusText>{statusMessage}</StatusText>
          <StatusText>
            Players Ready: {selectionStatus.selectedCount}/
            {selectionStatus.totalPlayers}
          </StatusText>
          <TimerText $urgent={timeLeft <= 5}>{timerMessage}</TimerText>
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

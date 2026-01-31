import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

const pulseWin = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
`;

// Simpler flash - just opacity pulse for performance
const flashRedPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const FighterUIContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  /* Better scaling for small screens */
  height: clamp(70px, 12vh, 130px);
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  padding: 0;
  z-index: 1000;
  font-family: "Bungee", cursive;
  background: linear-gradient(
    180deg,
    rgba(11, 16, 32, 0.85) 0%,
    rgba(11, 16, 32, 0.5) 70%,
    rgba(0, 0, 0, 0) 100%
  );
`;

const PlayerSection = styled.div`
  display: flex;
  flex-direction: column;
  width: 42%;
  /* Smaller padding on small screens */
  padding: clamp(4px, 1vh, 10px) clamp(8px, 1.5vw, 18px);
  gap: clamp(3px, 0.6vh, 8px);
  align-items: ${(props) => (props.$isRight ? "flex-end" : "flex-start")};
`;

const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  /* Smaller gap on small screens */
  gap: clamp(4px, 0.8vw, 10px);
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
  width: 100%;
`;

const PlayerAvatar = styled.div`
  /* Smaller minimum for small screens */
  width: clamp(24px, 4vw, 44px);
  height: clamp(24px, 4vw, 44px);
  background: linear-gradient(145deg, rgba(67, 61, 103, 0.9), rgba(11, 16, 32, 0.95));
  border: 2px solid var(--edo-gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(10px, 1.5vw, 18px);
  font-weight: bold;
  color: var(--edo-gold);
  text-shadow: 0 0 8px rgba(212, 175, 55, 0.4), 0 2px 0 rgba(0, 0, 0, 0.7);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 0 12px rgba(212, 175, 55, 0.15);
  flex-shrink: 0;
`;

const PlayerInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: ${(props) => (props.$isRight ? "flex-end" : "flex-start")};
  min-width: 0;
  flex: 1;
`;

const PlayerName = styled.div`
  /* Smaller font on small screens */
  font-size: clamp(9px, 1.6vw, 18px);
  font-weight: 900;
  color: #ffffff;
  text-shadow: 
    2px 2px 0 #000, -2px -2px 0 #000, 
    2px -2px 0 #000, -2px 2px 0 #000,
    0 0 10px rgba(255, 255, 255, 0.2);
  letter-spacing: 1px;
  text-transform: uppercase;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlayerRank = styled.div`
  /* Smaller font on small screens */
  font-size: clamp(6px, 1vw, 11px);
  font-weight: 600;
  color: var(--edo-gold);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: linear-gradient(145deg, rgba(67, 61, 103, 0.8), rgba(11, 16, 32, 0.9));
  padding: clamp(1px, 0.3vh, 2px) clamp(4px, 0.6vw, 8px);
  border-radius: 3px;
  border: 1px solid rgba(212, 175, 55, 0.4);
`;

const WinTracker = styled.div`
  display: flex;
  /* Smaller gap on small screens */
  gap: clamp(2px, 0.4vw, 5px);
  /* Mirror layout: Player 1 left-to-right, Player 2 right-to-left */
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
  margin-left: ${(props) => (props.$isRight ? "0" : "auto")};
  margin-right: ${(props) => (props.$isRight ? "auto" : "0")};
  
  /* Traditional Japanese parchment/scroll background */
  background: linear-gradient(
    135deg,
    rgba(245, 235, 215, 0.95) 0%,
    rgba(235, 220, 195, 0.95) 50%,
    rgba(230, 215, 185, 0.95) 100%
  );
  padding: clamp(4px, 0.6vw, 8px) clamp(6px, 0.8vw, 10px);
  border-radius: 6px;
  
  /* Wooden frame effect with traditional Japanese red accent */
  border: 2px solid rgba(139, 90, 43, 0.8);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px rgba(180, 120, 60, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  
  /* Subtle texture overlay for authenticity */
  position: relative;
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(139, 90, 43, 0.03) 1px,
        transparent 2px,
        transparent 4px
      ),
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(139, 90, 43, 0.03) 1px,
        transparent 2px,
        transparent 4px
      );
    pointer-events: none;
    border-radius: 4px;
  }
`;

const WinMark = styled.div`
  /* Smaller minimum for small screens */
  width: clamp(10px, 1.6vw, 20px);
  height: clamp(10px, 1.6vw, 20px);
  background: ${(props) => {
    if (props.$isEmpty) {
      return "linear-gradient(145deg, rgba(200, 180, 160, 0.3), rgba(180, 160, 140, 0.2))";
    }
    return props.$isWin
      ? "radial-gradient(60% 60% at 35% 35%, rgba(255, 255, 255, 1) 0%, #f5f5f5 60%, #e8e8e8 100%)"
      : "radial-gradient(60% 60% at 35% 35%, rgba(30, 30, 30, 1) 0%, #1a1a1a 60%, #0a0a0a 100%)";
  }};
  border: 2px solid ${(props) => {
    if (props.$isEmpty) return "rgba(139, 90, 43, 0.4)";
    return props.$isWin ? "#ffffff" : "#000000";
  }};
  border-radius: 50%;
  box-shadow: ${(props) => {
    if (props.$isEmpty) {
      return "inset 0 1px 3px rgba(0, 0, 0, 0.2)";
    }
    return props.$isWin
      ? "0 0 8px rgba(255, 255, 255, 0.9), 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)"
      : "0 0 4px rgba(0, 0, 0, 1), 0 2px 6px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(0, 0, 0, 0.7)";
  }};
  animation: ${(props) => (props.$isWin && !props.$isEmpty ? pulseWin : "none")} 2s infinite;
  position: relative;
  z-index: 1;
`;

const StaminaRow = styled.div`
  display: flex;
  align-items: center;
  /* Smaller gap on small screens */
  gap: clamp(4px, 0.8vw, 10px);
  width: 100%;
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
`;

const StaminaContainer = styled.div`
  position: relative;
  flex: 1;
  /* Smaller minimum height for small screens */
  height: clamp(14px, 2.5vh, 28px);
  background: linear-gradient(145deg, rgba(11, 16, 32, 0.95), rgba(67, 61, 103, 0.4));
  border: 2px solid rgba(212, 175, 55, 0.5);
  border-radius: 4px;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 2px 8px rgba(0, 0, 0, 0.5);
  overflow: hidden;
`;

const StaminaFill = styled.div.attrs((props) => ({
  style: {
    width: `calc(${props.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(props) => props.$isRight ? 'right: 2px;' : 'left: 2px;'}
  border-radius: 2px;
  transition: width 0.3s ease;
  z-index: 2;
  background: ${(props) => props.$lowStaminaWarning 
    ? props.$isRight 
      ? "linear-gradient(270deg, #ff6b6b 0%, #ff4444 100%)"
      : "linear-gradient(90deg, #ff6b6b 0%, #ff4444 100%)"
    : props.$isRight
      ? "linear-gradient(270deg, #fff4d6 0%, var(--edo-gold) 100%)"
      : "linear-gradient(90deg, #fff4d6 0%, var(--edo-gold) 100%)"};
  box-shadow: ${(props) => props.$lowStaminaWarning
    ? "0 0 12px rgba(255, 68, 68, 0.7)"
    : "0 0 12px rgba(212, 175, 55, 0.6)"};
  animation: ${(props) => props.$lowStaminaWarning ? css`${flashRedPulse} 0.6s ease-in-out infinite` : 'none'};

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
    border-radius: 2px 2px 0 0;
  }
`;

const StaminaLoss = styled.div.attrs((props) => ({
  style: {
    ...(props.$isRight 
      ? { right: `calc(2px + ${props.$left}%)` }
      : { left: `calc(2px + ${props.$left}%)` }
    ),
    width: `${props.$width}%`,
    opacity: props.$visible ? 1 : 0,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: ${(props) => props.$isRight
    ? "linear-gradient(270deg, var(--edo-sakura) 0%, #ff9e9e 100%)"
    : "linear-gradient(90deg, var(--edo-sakura) 0%, #ff9e9e 100%)"};
  transition: opacity 0.15s ease;
  pointer-events: none;
  z-index: 1;
  border-radius: 2px;
`;


const BottomRow = styled.div`
  display: flex;
  align-items: center;
  /* Smaller gap on small screens */
  gap: clamp(6px, 1.2vw, 14px);
  width: 100%;
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
`;

const PowerUpContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  /* Smaller minimum for small screens */
  width: clamp(20px, 3.5vw, 40px);
  height: clamp(20px, 3.5vw, 40px);
  border-radius: 6px;
  border: 2px solid;
  position: relative;
  transition: all 0.2s ease;
  
  background: ${(props) => {
    if (!props.$activePowerUp) return "linear-gradient(145deg, rgba(67, 61, 103, 0.3), rgba(11, 16, 32, 0.4))";
    if (props.$isOnCooldown) return "linear-gradient(135deg, #6b7280 0%, #4a5568 100%)";
    switch (props.$activePowerUp) {
      case "speed": return "linear-gradient(135deg, #00d2ff 0%, #0066cc 100%)";
      case "power": return "linear-gradient(135deg, var(--edo-sakura) 0%, #dc2626 100%)";
      case "snowball": return "linear-gradient(135deg, #e0f6ff 0%, #87ceeb 100%)";
      case "pumo_army": return "linear-gradient(135deg, #ffcc80 0%, #ff8c00 100%)";
      case "thick_blubber": return "linear-gradient(135deg, #9c88ff 0%, #7c4dff 100%)";
      default: return "linear-gradient(135deg, #6c757d 0%, #343a40 100%)";
    }
  }};
  
  border-color: ${(props) => {
    if (!props.$activePowerUp || props.$isOnCooldown) return "rgba(212, 175, 55, 0.4)";
    switch (props.$activePowerUp) {
      case "speed": return "#0066cc";
      case "power": return "#dc2626";
      case "snowball": return "#4682b4";
      case "pumo_army": return "#cc6600";
      case "thick_blubber": return "#5e35b1";
      default: return "var(--edo-gold)";
    }
  }};
  
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: ${(props) => (props.$activePowerUp ? 1 : 0.35)};

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
    filter: ${(props) => (props.$isOnCooldown ? "brightness(0.5) grayscale(0.3)" : "brightness(1)")};
  }
`;

const PowerUpIndicator = styled.div`
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  /* Smaller font on small screens */
  font-size: clamp(5px, 0.7vw, 8px);
  font-family: "Bungee", cursive;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
  background: rgba(0, 0, 0, 0.85);
  padding: 1px clamp(2px, 0.4vw, 4px);
  border-radius: 3px;
  letter-spacing: 0.3px;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.15);
`;

const CenterSection = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

// Infinity symbol to represent unlimited time
const InfinitySymbol = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(42px, 8vw, 85px);
  color: #ffffff;
  text-shadow: 
    -2px -2px 0 #000,
    2px -2px 0 #000,
    -2px 2px 0 #000,
    2px 2px 0 #000;
  line-height: 1;
  user-select: none;
  
  @media (max-width: 900px) {
    font-size: clamp(32px, 6.5vw, 64px);
  }
`;

// Throw break stamina threshold (33% of max)
const THROW_BREAK_STAMINA_THRESHOLD = 33;

const UiPlayerInfo = ({
  playerOneWinCount,
  playerTwoWinCount,
  roundHistory = [],
  roundId = 0,
  player1Stamina,
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1PumoArmyCooldown = false,
  player2Stamina,
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2PumoArmyCooldown = false,
}) => {

  // Clamp stamina values
  const clampStamina = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };

  const s1 = clampStamina(player1Stamina);
  const s2 = clampStamina(player2Stamina);

  // Displayed stamina with glitch guards
  const [p1DisplayStamina, setP1DisplayStamina] = useState(s1);
  const [p2DisplayStamina, setP2DisplayStamina] = useState(s2);
  const [p1LastDecreaseAt, setP1LastDecreaseAt] = useState(0);
  const [p2LastDecreaseAt, setP2LastDecreaseAt] = useState(0);
  const MAX_INCREASE_PER_UPDATE = 15;

  const [p1Loss, setP1Loss] = useState({ left: 0, width: 0, visible: false });
  const [p2Loss, setP2Loss] = useState({ left: 0, width: 0, visible: false });

  const p1LossTimeoutRef = useRef(null);
  const p2LossTimeoutRef = useRef(null);

  useEffect(() => {
    // On round change, hard reset displayed stamina to current sanitized values
    setP1DisplayStamina(s1);
    setP2DisplayStamina(s2);
    setP1Loss({ left: 0, width: 0, visible: false });
    setP2Loss({ left: 0, width: 0, visible: false });
    setP1LastDecreaseAt(0);
    setP2LastDecreaseAt(0);
  }, [roundId]);

  useEffect(() => {
    let next = s1;
    // Detect decrease
    if (next < p1DisplayStamina) {
      setP1LastDecreaseAt(Date.now());
      const lost = Math.max(0, Math.min(100, p1DisplayStamina - next));
      const width = Math.max(0, Math.min(lost, 100 - next));
      setP1Loss({ left: next, width, visible: true });
      if (p1LossTimeoutRef.current) clearTimeout(p1LossTimeoutRef.current);
      p1LossTimeoutRef.current = setTimeout(() => {
        setP1Loss((cur) => ({ ...cur, visible: false }));
      }, 500);
    } else {
      setP1Loss((cur) => (cur.visible ? { ...cur, visible: false } : cur));
    }

    // Glitch guard
    const justDecreased = Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
    if (next - p1DisplayStamina > 25 && justDecreased) {
      next = p1DisplayStamina;
    }

    if (next > p1DisplayStamina) {
      next = Math.min(next, p1DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP1DisplayStamina(next);

    return () => {
      if (p1LossTimeoutRef.current) {
        clearTimeout(p1LossTimeoutRef.current);
        p1LossTimeoutRef.current = null;
      }
    };
  }, [s1]);

  useEffect(() => {
    let next = s2;
    // Detect decrease
    if (next < p2DisplayStamina) {
      setP2LastDecreaseAt(Date.now());
      const lost = Math.max(0, Math.min(100, p2DisplayStamina - next));
      const width = Math.max(0, Math.min(lost, 100 - next));
      setP2Loss({ left: next, width, visible: true });
      if (p2LossTimeoutRef.current) clearTimeout(p2LossTimeoutRef.current);
      p2LossTimeoutRef.current = setTimeout(() => {
        setP2Loss((cur) => ({ ...cur, visible: false }));
      }, 500);
    } else {
      setP2Loss((cur) => (cur.visible ? { ...cur, visible: false } : cur));
    }

    const justDecreased = Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
    if (next - p2DisplayStamina > 25 && justDecreased) {
      next = p2DisplayStamina;
    }

    if (next > p2DisplayStamina) {
      next = Math.min(next, p2DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP2DisplayStamina(next);

    return () => {
      if (p2LossTimeoutRef.current) {
        clearTimeout(p2LossTimeoutRef.current);
        p2LossTimeoutRef.current = null;
      }
    };
  }, [s2]);

  const renderWinMarks = (playerName) => {
    const marks = [];
    const maxRounds = 5; // Best of 5
    
    // Show circles in chronological order based on round history (oldest to newest)
    for (let i = 0; i < maxRounds; i++) {
      if (i < roundHistory.length) {
        // Show actual result
        const isWin = roundHistory[i] === playerName;
        marks.push(<WinMark key={`round-${i}`} $isWin={isWin} $isEmpty={false} />);
      } else {
        // Show empty placeholder
        marks.push(<WinMark key={`empty-${i}`} $isWin={false} $isEmpty={true} />);
      }
    }
    
    return marks;
  };

  // Check if player has low stamina warning (below 33% - can't afford dodge or throw break)
  const shouldShowLowStaminaWarning = (stamina) => {
    return stamina < THROW_BREAK_STAMINA_THRESHOLD;
  };

  const getPowerUpIsOnCooldown = (powerUpType, snowballCooldown, pumoArmyCooldown) => {
    switch (powerUpType) {
      case "snowball": return snowballCooldown;
      case "pumo_army": return pumoArmyCooldown;
      default: return false;
    }
  };

  const getPowerUpIndicatorText = (powerUpType) => {
    const isUsable = powerUpType === "snowball" || powerUpType === "pumo_army";
    return isUsable ? "F" : "PASSIVE";
  };

  const getPowerUpIcon = (powerUpType) => {
    switch (powerUpType) {
      case "speed": return happyFeetIcon;
      case "power": return powerWaterIcon;
      case "snowball": return snowballImage;
      case "pumo_army": return pumoArmyIcon;
      case "thick_blubber": return thickBlubberIcon;
      default: return "";
    }
  };

  return (
    <FighterUIContainer>
      {/* Player 1 Section */}
      <PlayerSection $isRight={false}>
        <PlayerHeader $isRight={false}>
          <PlayerAvatar>力</PlayerAvatar>
          <PlayerInfo $isRight={false}>
            <PlayerName>PLAYER 1</PlayerName>
            <PlayerRank>JONOKUCHI</PlayerRank>
          </PlayerInfo>
          <WinTracker $isRight={false}>
            {renderWinMarks("player1")}
          </WinTracker>
        </PlayerHeader>

        <StaminaRow $isRight={false}>
          <StaminaContainer>
            <StaminaFill 
              $stamina={p1DisplayStamina} 
              $lowStaminaWarning={shouldShowLowStaminaWarning(p1DisplayStamina)}
              $isRight={false}
            />
            <StaminaLoss $left={p1Loss.left} $width={p1Loss.width} $visible={p1Loss.visible} $isRight={false} />
          </StaminaContainer>
        </StaminaRow>

        <BottomRow $isRight={false}>
          <PowerUpContainer
            $activePowerUp={player1ActivePowerUp}
            $isOnCooldown={getPowerUpIsOnCooldown(player1ActivePowerUp, player1SnowballCooldown, player1PumoArmyCooldown)}
          >
            {player1ActivePowerUp && (
              <>
                <img src={getPowerUpIcon(player1ActivePowerUp)} alt={player1ActivePowerUp} />
                <PowerUpIndicator>{getPowerUpIndicatorText(player1ActivePowerUp)}</PowerUpIndicator>
              </>
            )}
          </PowerUpContainer>
        </BottomRow>
      </PlayerSection>

      {/* Center Section with infinity symbol for unlimited time */}
      <CenterSection>
        <InfinitySymbol>∞</InfinitySymbol>
      </CenterSection>

      {/* Player 2 Section */}
      <PlayerSection $isRight={true}>
        <PlayerHeader $isRight={true}>
          <PlayerAvatar>闘</PlayerAvatar>
          <PlayerInfo $isRight={true}>
            <PlayerName>PLAYER 2</PlayerName>
            <PlayerRank>JONOKUCHI</PlayerRank>
          </PlayerInfo>
          <WinTracker $isRight={true}>
            {renderWinMarks("player2")}
          </WinTracker>
        </PlayerHeader>

        <StaminaRow $isRight={true}>
          <StaminaContainer>
            <StaminaFill 
              $stamina={p2DisplayStamina} 
              $lowStaminaWarning={shouldShowLowStaminaWarning(p2DisplayStamina)}
              $isRight={true}
            />
            <StaminaLoss $left={p2Loss.left} $width={p2Loss.width} $visible={p2Loss.visible} $isRight={true} />
          </StaminaContainer>
        </StaminaRow>

        <BottomRow $isRight={true}>
          <PowerUpContainer
            $activePowerUp={player2ActivePowerUp}
            $isOnCooldown={getPowerUpIsOnCooldown(player2ActivePowerUp, player2SnowballCooldown, player2PumoArmyCooldown)}
          >
            {player2ActivePowerUp && (
              <>
                <img src={getPowerUpIcon(player2ActivePowerUp)} alt={player2ActivePowerUp} />
                <PowerUpIndicator>{getPowerUpIndicatorText(player2ActivePowerUp)}</PowerUpIndicator>
              </>
            )}
          </PowerUpContainer>
        </BottomRow>
      </PlayerSection>
    </FighterUIContainer>
  );
};

UiPlayerInfo.propTypes = {
  playerOneWinCount: PropTypes.number.isRequired,
  playerTwoWinCount: PropTypes.number.isRequired,
  roundHistory: PropTypes.array,
  roundId: PropTypes.number,
  player1Stamina: PropTypes.number,
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1PumoArmyCooldown: PropTypes.bool,
  player2Stamina: PropTypes.number,
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2PumoArmyCooldown: PropTypes.bool,
};

export default UiPlayerInfo;

import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
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

const FighterUIContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: clamp(100px, 13vh, 130px);
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
  border-bottom: 2px solid rgba(212, 175, 55, 0.3);

  @media (max-width: 768px) {
    height: clamp(90px, 11vh, 110px);
  }
`;

const PlayerSection = styled.div`
  display: flex;
  flex-direction: column;
  width: 42%;
  padding: clamp(8px, 1.2vh, 12px) clamp(12px, 2vw, 20px);
  gap: clamp(6px, 0.8vh, 10px);
  align-items: ${(props) => (props.$isRight ? "flex-end" : "flex-start")};
`;

const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1vw, 12px);
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
  width: 100%;
`;

const PlayerAvatar = styled.div`
  width: clamp(36px, 4.5vw, 48px);
  height: clamp(36px, 4.5vw, 48px);
  background: linear-gradient(145deg, rgba(67, 61, 103, 0.9), rgba(11, 16, 32, 0.95));
  border: 2px solid var(--edo-gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(14px, 1.8vw, 20px);
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
  font-size: clamp(14px, 2vw, 20px);
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
  font-size: clamp(9px, 1.2vw, 12px);
  font-weight: 600;
  color: var(--edo-gold);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: linear-gradient(145deg, rgba(67, 61, 103, 0.8), rgba(11, 16, 32, 0.9));
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid rgba(212, 175, 55, 0.4);
`;

const WinTracker = styled.div`
  display: flex;
  gap: clamp(4px, 0.6vw, 6px);
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
  margin-left: ${(props) => (props.$isRight ? "0" : "auto")};
  margin-right: ${(props) => (props.$isRight ? "auto" : "0")};
`;

const WinMark = styled.div`
  width: clamp(16px, 2vw, 22px);
  height: clamp(16px, 2vw, 22px);
  background: ${(props) =>
    props.$isWin
      ? "radial-gradient(60% 60% at 35% 35%, rgba(255, 249, 219, 0.95) 0%, var(--edo-gold) 60%, #8b6914 100%)"
      : "linear-gradient(145deg, rgba(67, 61, 103, 0.6), rgba(11, 16, 32, 0.8))"};
  border: 2px solid ${(props) => (props.$isWin ? "var(--edo-gold)" : "rgba(212, 175, 55, 0.3)")};
  border-radius: 50%;
  box-shadow: ${(props) =>
    props.$isWin
      ? "0 0 12px rgba(212, 175, 55, 0.6), inset 0 -2px 4px rgba(0, 0, 0, 0.3)"
      : "inset 0 2px 4px rgba(0, 0, 0, 0.4)"};
  animation: ${(props) => (props.$isWin ? pulseWin : "none")} 2s infinite;
`;

const StaminaRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1vw, 12px);
  width: 100%;
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
`;

const StaminaContainer = styled.div`
  position: relative;
  flex: 1;
  height: clamp(22px, 3vh, 30px);
  background: linear-gradient(145deg, rgba(11, 16, 32, 0.95), rgba(67, 61, 103, 0.4));
  border: 2px solid rgba(212, 175, 55, 0.5);
  border-radius: 4px;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 2px 8px rgba(0, 0, 0, 0.5);
  overflow: hidden;
`;

const StaminaFill = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(${(props) => props.$stamina}% - 4px);
  border-radius: 2px;
  background: ${(props) =>
    props.$stamina <= 25
      ? "linear-gradient(90deg, var(--edo-sakura) 0%, #ff9e9e 100%)"
      : "linear-gradient(90deg, #fff4d6 0%, var(--edo-gold) 100%)"};
  transition: width 0.3s ease;
  box-shadow: ${(props) =>
    props.$stamina <= 25
      ? "0 0 12px rgba(255, 107, 107, 0.7)"
      : "0 0 12px rgba(212, 175, 55, 0.6)"};
  z-index: 2;

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

const StaminaLoss = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: calc(2px + ${(props) => props.$left}%);
  width: ${(props) => props.$width}%;
  background: linear-gradient(90deg, var(--edo-sakura) 0%, #ff9e9e 100%);
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  transition: opacity 0.15s ease;
  pointer-events: none;
  z-index: 1;
  border-radius: 2px;
`;

const GassedOverlay = styled.div`
  position: absolute;
  inset: 2px;
  z-index: 3;
  pointer-events: none;
  opacity: ${(props) => (props.$isGassed ? 1 : 0)};
  transition: opacity 0.2s ease;
  border-radius: 2px;
  background-size: 20px 20px;
  background-image: repeating-linear-gradient(
    45deg,
    var(--edo-gold) 0px,
    var(--edo-gold) 10px,
    rgba(0, 0, 0, 0.85) 10px,
    rgba(0, 0, 0, 0.85) 20px
  );
  animation: ${(props) => (props.$isGassed ? "cautionMove 400ms linear infinite" : "none")};

  @keyframes cautionMove {
    0% { background-position: 0 0; }
    100% { background-position: 20px 0; }
  }
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.5vw, 16px);
  width: 100%;
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
`;

const DodgeChargesContainer = styled.div`
  display: flex;
  gap: clamp(4px, 0.6vw, 6px);
`;

const DodgeCharge = styled.div`
  width: clamp(10px, 1.3vw, 14px);
  height: clamp(10px, 1.3vw, 14px);
  border-radius: 50%;
  border: 2px solid ${(props) =>
    props.$isOnCooldown
      ? "rgba(80, 80, 80, 0.6)"
      : props.$isActive
      ? "var(--edo-aqua)"
      : "rgba(60, 60, 60, 0.7)"};
  background: ${(props) =>
    props.$isOnCooldown
      ? "rgba(30, 30, 30, 0.9)"
      : props.$isActive
      ? "radial-gradient(circle at 35% 35%, #b3ffff 0%, var(--edo-aqua) 50%, #008b8b 100%)"
      : "rgba(20, 20, 20, 0.8)"};
  box-shadow: ${(props) =>
    props.$isActive && !props.$isOnCooldown
      ? "0 0 8px rgba(0, 255, 255, 0.7), inset 0 1px 2px rgba(255, 255, 255, 0.4)"
      : "inset 0 1px 3px rgba(0, 0, 0, 0.5)"};
  transition: all 0.2s ease;
`;

const PowerUpContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(32px, 4vw, 44px);
  height: clamp(32px, 4vw, 44px);
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
  font-size: clamp(7px, 0.9vw, 9px);
  font-family: "Bungee", cursive;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
  background: rgba(0, 0, 0, 0.85);
  padding: 1px 4px;
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
  gap: clamp(16px, 2.5vw, 28px);
  z-index: 1000;
`;

const UiPlayerInfo = ({
  playerOneWinCount,
  playerTwoWinCount,
  roundId = 0,
  player1Stamina,
  player1DodgeCharges = 2,
  player1DodgeChargeCooldowns = [0, 0],
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1PumoArmyCooldown = false,
  player1IsGassed = false,
  player2Stamina,
  player2DodgeCharges = 2,
  player2DodgeChargeCooldowns = [0, 0],
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2PumoArmyCooldown = false,
  player2IsGassed = false,
}) => {
  const currentTime = Date.now();

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

  const renderWinMarks = (winCount) => {
    const marks = [];
    for (let i = 0; i < 3; i++) {
      marks.push(<WinMark key={i} $isWin={i < winCount} />);
    }
    return marks;
  };

  const renderDodgeCharges = (charges, cooldowns) => {
    return [0, 1].map((chargeIndex) => {
      const cooldownEndTime = cooldowns[chargeIndex];
      const isOnCooldown = cooldownEndTime > currentTime;
      const availableChargeIndices = [0, 1].filter((i) => cooldowns[i] <= currentTime);
      const isActive = !isOnCooldown && availableChargeIndices.slice(0, charges).includes(chargeIndex);

      return (
        <DodgeCharge
          key={chargeIndex}
          $isActive={isActive}
          $isOnCooldown={isOnCooldown}
        />
      );
    });
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
            {renderWinMarks(playerOneWinCount)}
          </WinTracker>
        </PlayerHeader>

        <StaminaRow $isRight={false}>
          <StaminaContainer>
            <StaminaFill $stamina={p1DisplayStamina} />
            <StaminaLoss $left={p1Loss.left} $width={p1Loss.width} $visible={p1Loss.visible} />
            <GassedOverlay $isGassed={player1IsGassed} />
          </StaminaContainer>
        </StaminaRow>

        <BottomRow $isRight={false}>
          <DodgeChargesContainer>
            {renderDodgeCharges(player1DodgeCharges, player1DodgeChargeCooldowns)}
          </DodgeChargesContainer>
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

      {/* Center Power-Up Section - kept for reference but elements moved to player sections */}
      <CenterSection />

      {/* Player 2 Section */}
      <PlayerSection $isRight={true}>
        <PlayerHeader $isRight={true}>
          <PlayerAvatar>闘</PlayerAvatar>
          <PlayerInfo $isRight={true}>
            <PlayerName>PLAYER 2</PlayerName>
            <PlayerRank>JONOKUCHI</PlayerRank>
          </PlayerInfo>
          <WinTracker $isRight={true}>
            {renderWinMarks(playerTwoWinCount)}
          </WinTracker>
        </PlayerHeader>

        <StaminaRow $isRight={true}>
          <StaminaContainer>
            <StaminaFill $stamina={p2DisplayStamina} />
            <StaminaLoss $left={p2Loss.left} $width={p2Loss.width} $visible={p2Loss.visible} />
            <GassedOverlay $isGassed={player2IsGassed} />
          </StaminaContainer>
        </StaminaRow>

        <BottomRow $isRight={true}>
          <DodgeChargesContainer>
            {renderDodgeCharges(player2DodgeCharges, player2DodgeChargeCooldowns)}
          </DodgeChargesContainer>
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
  roundId: PropTypes.number,
  player1Stamina: PropTypes.number,
  player1DodgeCharges: PropTypes.number,
  player1DodgeChargeCooldowns: PropTypes.arrayOf(PropTypes.number),
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1PumoArmyCooldown: PropTypes.bool,
  player1IsGassed: PropTypes.bool,
  player2Stamina: PropTypes.number,
  player2DodgeCharges: PropTypes.number,
  player2DodgeChargeCooldowns: PropTypes.arrayOf(PropTypes.number),
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2PumoArmyCooldown: PropTypes.bool,
  player2IsGassed: PropTypes.bool,
};

export default UiPlayerInfo;

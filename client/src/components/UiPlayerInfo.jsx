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
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const FighterUIContainer = styled.div`
  position: absolute;
  top: -1rem;
  left: 0;
  right: 0;
  height: clamp(110px, 14vh, 150px);
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  padding: 0;
  z-index: 1000;
  font-family: "Bungee", cursive;
  background: linear-gradient(
    180deg,
    rgba(28, 28, 28, 0.8) 0%,
    rgba(18, 18, 18, 0.5) 70%,
    rgba(0, 0, 0, 0) 100%
  );

  @media (max-width: 1200px) {
    height: clamp(100px, 12vh, 130px);
  }

  @media (max-width: 768px) {
    height: clamp(90px, 10vh, 110px);
  }

  @media (max-width: 480px) {
    height: clamp(80px, 9vh, 100px);
  }
`;

const PlayerSection = styled.div`
  display: flex;
  margin-top: clamp(35px, 5vh, 45px);
  flex-direction: column;
  width: 40%;
  gap: clamp(6px, 1vh, 12px);
  align-items: ${(props) => (props.$isRight ? "flex-end" : "flex-start")};
  padding: ${(props) =>
    props.$isRight
      ? "0 clamp(10px, 2vw, 20px) 0 0"
      : "0 0 0 clamp(10px, 2vw, 20px)"};

  @media (max-width: 768px) {
    margin-top: clamp(30px, 4vh, 38px);
    gap: clamp(4px, 0.8vh, 8px);
    padding: ${(props) =>
      props.$isRight
        ? "0 clamp(6px, 1vw, 12px) 0 0"
        : "0 0 0 clamp(6px, 1vw, 12px)"};
  }

  @media (max-width: 480px) {
    margin-top: clamp(25px, 3vh, 30px);
    gap: clamp(3px, 0.6vh, 6px);
    padding: ${(props) =>
      props.$isRight
        ? "0 clamp(4px, 0.8vw, 8px) 0 0"
        : "0 0 0 clamp(4px, 0.8vw, 8px)"};
  }
`;

const StaminaRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.2vw, 15px);
  width: 100%;
  position: relative;
`;

const PlayerAvatar = styled.div`
  width: clamp(40px, 5vw, 60px);
  height: clamp(40px, 5vw, 60px);
  background: linear-gradient(
    145deg,
    rgba(28, 28, 28, 0.95),
    rgba(18, 18, 18, 0.95)
  );
  border: clamp(2px, 0.3vw, 3px) solid #8b4513;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(12px, 1.8vw, 18px);
  font-weight: bold;
  color: #d4af37;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  position: relative;
  flex-shrink: 0;
`;

const PlayerInfoTop = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  min-width: 0;
  max-width: 60%;
  position: absolute;
  top: clamp(2px, 0.5vh, 4px);
  left: clamp(8px, 1.2vw, 12px);
  z-index: 5;
  transform: ${(props) => (props.$isRight ? "scaleX(-1)" : "scaleX(1)")};
`;

const PlayerInfoBottom = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 0;
  position: absolute;
  top: clamp(32px, 5vh, 40px);
  left: clamp(8px, 1.2vw, 12px);
  z-index: 5;
  transform: ${(props) => (props.$isRight ? "scaleX(-1)" : "scaleX(1)")};
`;

const DodgeChargesPosition = styled.div`
  position: absolute;
  top: clamp(32px, 5vh, 42px);
  right: clamp(8px, 1.2vw, 12px);
  z-index: 5;
  transform: ${(props) => (props.$isRight ? "scaleX(-1)" : "scaleX(1)")};
`;

const PlayerName = styled.div`
  font-size: clamp(12px, 2vw, 20px);
  font-weight: 900;
  color: #ffffff;
  text-shadow: 2px 2px 0 #000000, -2px -2px 0 #000000, 2px -2px 0 #000000,
    -2px 2px 0 #000000;
  letter-spacing: clamp(0.5px, 0.1vw, 1px);
  text-transform: uppercase;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: -30%;
`;

const PlayerRank = styled.div`
  font-size: clamp(10px, 1.6vw, 16px);
  font-weight: 600;
  color: #d4af37;
  text-shadow: 1px 1px 2px #000000;
  text-transform: uppercase;
  letter-spacing: clamp(0.2px, 0.05vw, 0.5px);
  background: linear-gradient(
    145deg,
    rgba(28, 28, 28, 0.95),
    rgba(18, 18, 18, 0.95)
  );
  padding: clamp(2px, 0.3vw, 3px) clamp(3px, 0.6vw, 6px);
  border-radius: 3px;
  border: 1px solid #8b4513;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  line-height: 1;
  white-space: nowrap;
 
`;

const WinTracker = styled.div`
  display: flex;
  gap: clamp(2px, 0.5vw, 4px);
  align-items: center;
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
  flex-shrink: 0;
  position: absolute;
  top: clamp(2px, 0.5vh, 4px);
  right: clamp(8px, 1.2vw, 12px);
  max-width: 35%;
  z-index: 10;
  transform: ${(props) => (props.$isRight ? "none" : "scaleX(-1)")};

  @media (max-width: 768px) {
    gap: clamp(1px, 0.3vw, 2px);
    top: clamp(2px, 0.4vh, 3px);
  }

  @media (max-width: 480px) {
    gap: 1px;
    top: clamp(1px, 0.3vh, 2px);
  }
`;

const WinMark = styled.div`
  width: clamp(14px, 2.2vw, 20px);
  height: clamp(14px, 2.2vw, 20px);
  min-width: 14px;
  min-height: 14px;

  background: ${(props) =>
    props.$isWin
      ? "linear-gradient(45deg,rgb(89, 255, 95),rgb(0, 255, 13))"
      : "linear-gradient(145deg,rgba(28, 28, 28, 0.95),rgba(18, 18, 18, 0.95))"};
  border: clamp(1px, 0.2vw, 2px) solid
    ${(props) =>
      props.$isWin ? "rgba(28, 28, 28, .5)" : "rgba(255, 255, 255, 0.3)"};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -60%;
  box-shadow: ${(props) =>
    props.$isWin
      ? "0 0 8px rgba(76, 175, 80, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)"
      : "0 2px 8px rgba(0, 0, 0, 0.2)"};
  animation: ${(props) => (props.$isWin ? pulseWin : "none")} 2s infinite;
  position: relative;
  flex-shrink: 0;
  aspect-ratio: 1;
`;

const StaminaContainer = styled.div`
  position: relative;
  width: 100%;
  height: 30px;
  background: linear-gradient(
    145deg,
    rgba(40, 40, 40, 0.2),
    rgba(20, 20, 20, 0.1)
  );
  // border-radius: clamp(8px, 1.2vw, 12px);
  border: clamp(1px, 0.2vw, 2px) solid #8b4513;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  overflow: visible;
  transform: ${(props) => (props.$isRight ? "scaleX(-1)" : "scaleX(1)")};
  flex: 1;
`;

const StaminaFill = styled.div`
  position: absolute;
  height: 100%;
  width: ${(props) => props.$stamina}%;
  background: ${(props) =>
    props.$stamina <= 25
      ? "linear-gradient(90deg, #ff4d4d 0%, #ff8080 100%)"
      : "linear-gradient(90deg, #ffeb3b 0%, #ffc107 100%)"};
  // border-radius: clamp(6px, 1vw, 10px);
  transition: width 0.3s ease;
  box-shadow: ${(props) =>
    props.$stamina <= 25 ? "0 0 8px #ff4d4d" : "0 0 8px #ffeb3b"};
  z-index: 2;
`;

const StaminaLoss = styled.div`
  position: absolute;
  top: 0;
  height: 100%;
  left: ${(props) => props.$left}%;
  width: ${(props) => props.$width}%;
  background: linear-gradient(90deg, #ff4d4d 0%, #ff8080 100%);
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  transition: opacity 0.15s ease;
  pointer-events: none;
  z-index: 1;
`;

const GassedOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: ${(props) => (props.$isGassed ? 1 : 0)};
  transition: opacity 0.2s ease;
  background-size: 20px 20px;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 235, 59, 0.95) 0px,
    rgba(255, 235, 59, 0.95) 10px,
    rgba(0, 0, 0, 0.8) 10px,
    rgba(0, 0, 0, 0.8) 20px
  );
  animation: ${(props) => (props.$isGassed ? "cautionMove 450ms linear infinite" : "none")};

  @keyframes cautionMove {
    0% { background-position: 0 0; }
    100% { background-position: 20px 0; }
  }
`;

const CentralPowerUpSection = styled.div`
  position: absolute;
  top: calc(clamp(35px, 5vh, 45px) + 15px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(20px, 3vw, 40px);
  z-index: 1000;
  width: 20%;
  height: 20px;
  pointer-events: none;

  @media (max-width: 768px) {
    top: calc(clamp(30px, 4vh, 38px) + 15px);
  }

  @media (max-width: 480px) {
    top: calc(clamp(25px, 3vh, 30px) + 15px);
  }
`;

const PowerUpContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(35px, 5vw, 50px);
  height: clamp(35px, 5vw, 50px);
  border-radius: clamp(6px, 0.8vw, 8px);
  border: clamp(1px, 0.2vw, 2px) solid;
  background: ${(props) => {
    if (!props.$activePowerUp)
      return "linear-gradient(145deg, rgba(40, 40, 40, 0.2), rgba(20, 20, 20, 0.1))";
    if (props.$isOnCooldown)
      return "linear-gradient(135deg, #9ca3af 0%, #6b7280 30%, #4a5568 100%)";

    switch (props.$activePowerUp) {
      case "speed":
        return "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 30%, #0066cc 100%)";
      case "power":
        return "linear-gradient(135deg, #ff6b6b 0%, #ee5a52 30%, #dc2626 100%)";
      case "snowball":
        return "linear-gradient(135deg, #e0f6ff 0%, #87ceeb 30%, #4682b4 100%)";
      case "pumo_army":
        return "linear-gradient(135deg, #fff4e6 0%, #ffcc80 30%, #ff8c00 100%)";
      case "thick_blubber":
        return "linear-gradient(135deg, #9c88ff 0%, #7c4dff 30%, #5e35b1 100%)";
      default:
        return "linear-gradient(135deg, #6c757d 0%, #495057 30%, #343a40 100%)";
    }
  }};
  border-color: ${(props) => {
    if (!props.$activePowerUp || props.$isOnCooldown) return "#8b4513";

    switch (props.$activePowerUp) {
      case "speed":
        return "#0066cc";
      case "power":
        return "#dc2626";
      case "snowball":
        return "#1e3a8a";
      case "pumo_army":
        return "#cc6600";
      case "thick_blubber":
        return "#5e35b1";
      default:
        return "#343a40";
    }
  }};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  opacity: ${(props) => (props.$activePowerUp ? 1 : 0.3)};
  flex-shrink: 0;
  pointer-events: auto;

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
    filter: ${(props) =>
      props.$isOnCooldown ? "brightness(0.6) grayscale(0.3)" : "brightness(1)"};
    position: relative;
    top: clamp(-6px, -1vw, -10px);
  }

  span {
    font-size: clamp(14px, 2vw, 20px);
  }
`;

const PowerUpIndicator = styled.div`
  position: absolute;
  bottom: clamp(-2px, -0.3vw, -3px);
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(6px, 0.9vw, 9px);
  font-family: "Bungee", cursive;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
  background: rgba(0, 0, 0, 0.8);
  padding: clamp(1px, 0.2vw, 2px) clamp(2px, 0.4vw, 4px);
  border-radius: 3px;
  letter-spacing: clamp(0.1px, 0.03vw, 0.3px);
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const DodgeChargesContainer = styled.div`
  display: flex;
  gap: clamp(2px, 0.4vw, 4px);
  align-items: center;
  flex-shrink: 0;
`;

const DodgeCharge = styled.div`
  width: clamp(14px, 1.8vw, 18px);
  height: clamp(14px, 1.8vw, 18px);
  border-radius: 50%;
  border: clamp(1px, 0.2vw, 2px) solid
    ${(props) =>
      props.$isOnCooldown
        ? "rgba(212, 175, 55, 0.4)" // On cooldown (takes precedence)
        : props.$isActive
        ? "#d4af37" // Active and ready
        : "rgba(0, 0, 0, 0.6)"}; // Inactive (dark black border)
  background: ${(props) =>
    props.$isOnCooldown
      ? "rgba(0, 0, 0, 0.7)" // On cooldown (takes precedence)
      : props.$isActive
      ? "rgba(139, 69, 19, 0.8)" // Active and ready
      : "rgba(0, 0, 0, 0.7)"}; // Inactive (dark black background)
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: ${(props) =>
    props.$isActive && !props.$isOnCooldown
      ? "0 0 8px rgba(212, 175, 55, 0.4), inset 0 0 4px rgba(212, 175, 55, 0.2)"
      : "inset 0 1px 2px rgba(0, 0, 0, 0.3)"};

  &::before {
    content: "";
    width: clamp(4px, 0.6vw, 6px);
    height: clamp(4px, 0.6vw, 6px);
    border-radius: 50%;
    background: ${(props) =>
      props.$isOnCooldown
        ? "rgba(212, 175, 55, 0.5)" // On cooldown (takes precedence)
        : props.$isActive
        ? "#d4af37" // Active and ready
        : "rgba(0, 0, 0, 0.8)"}; // Inactive (dark black dot)
    box-shadow: ${(props) =>
      props.$isActive && !props.$isOnCooldown
        ? "0 0 4px rgba(212, 175, 55, 0.6)"
        : "none"};
    transition: all 0.2s ease;
  }
`;

const UiPlayerInfo = ({
  playerOneWinCount,
  playerTwoWinCount,
  roundId = 0,
  // Player 1 data
  player1Stamina,
  player1DodgeCharges = 2,
  player1DodgeChargeCooldowns = [0, 0],
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1PumoArmyCooldown = false,
  player1IsGassed = false,
  // Player 2 data
  player2Stamina,
  player2DodgeCharges = 2,
  player2DodgeChargeCooldowns = [0, 0],
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2PumoArmyCooldown = false,
  player2IsGassed = false,
}) => {
  const currentTime = Date.now();

  // Track previous stamina values and transient loss bars
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
  const MAX_INCREASE_PER_UPDATE = 15; // Prevent sudden large spikes visually

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
      // Hide loss on stamina increase or no change
      setP1Loss((cur) => (cur.visible ? { ...cur, visible: false } : cur));
    }

    // Glitch guard: prevent sudden huge spikes (e.g., 0 -> 100) right after a decrease
    const justDecreased = Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
    if (next - p1DisplayStamina > 25 && justDecreased) {
      // Ignore this spike; keep previous display
      next = p1DisplayStamina;
    }

    // Always cap per-update increase to a reasonable step
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
      // Hide loss on stamina increase or no change
      setP2Loss((cur) => (cur.visible ? { ...cur, visible: false } : cur));
    }

    // Glitch guard: prevent sudden huge spikes (e.g., 0 -> 100) right after a decrease
    const justDecreased = Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
    if (next - p2DisplayStamina > 25 && justDecreased) {
      next = p2DisplayStamina;
    }

    // Always cap per-update increase to a reasonable step
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

      // Get all charges that are not on cooldown
      const availableChargeIndices = [0, 1].filter(
        (i) => cooldowns[i] <= currentTime
      );

      // Mark the first N available charges as active (where N = number of available charges)
      const isActive =
        !isOnCooldown &&
        availableChargeIndices.slice(0, charges).includes(chargeIndex);

      return (
        <DodgeCharge
          key={chargeIndex}
          $isActive={isActive}
          $isOnCooldown={isOnCooldown}
        />
      );
    });
  };

  const getPowerUpIsOnCooldown = (
    powerUpType,
    snowballCooldown,
    pumoArmyCooldown
  ) => {
    switch (powerUpType) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return pumoArmyCooldown;
      default:
        return false;
    }
  };

  const getPowerUpIndicatorText = (powerUpType) => {
    const isUsable = powerUpType === "snowball" || powerUpType === "pumo_army";
    return isUsable ? "F" : "PASSIVE";
  };

  return (
    <FighterUIContainer>
      {/* Player 1 Section */}
      <PlayerSection $isRight={false}>
        <StaminaRow>
          <PlayerAvatar>力</PlayerAvatar>
          <StaminaContainer $isRight={false}>
            <StaminaFill $stamina={p1DisplayStamina} />
            <StaminaLoss
              $left={p1Loss.left}
              $width={p1Loss.width}
              $visible={p1Loss.visible}
            />
            <GassedOverlay $isGassed={player1IsGassed} />
            <WinTracker $isRight={false}>
              {renderWinMarks(playerOneWinCount)}
            </WinTracker>
            <PlayerInfoTop $isRight={false}>
              <PlayerName>PLAYER 1</PlayerName>
            </PlayerInfoTop>
            <PlayerInfoBottom $isRight={false}>
              <PlayerRank>JONOKUCHI</PlayerRank>
            </PlayerInfoBottom>
            <DodgeChargesPosition $isRight={false}>
              <DodgeChargesContainer>
                {renderDodgeCharges(
                  player1DodgeCharges,
                  player1DodgeChargeCooldowns
                )}
              </DodgeChargesContainer>
            </DodgeChargesPosition>
          </StaminaContainer>
        </StaminaRow>
      </PlayerSection>

      {/* Central Power-Up Section */}
      <CentralPowerUpSection>
        <PowerUpContainer
          $activePowerUp={player1ActivePowerUp}
          $isOnCooldown={getPowerUpIsOnCooldown(
            player1ActivePowerUp,
            player1SnowballCooldown,
            player1PumoArmyCooldown
          )}
          $isPlayer2={false}
        >
          {player1ActivePowerUp && (
            <>
              <img
                src={
                  player1ActivePowerUp === "speed"
                    ? happyFeetIcon
                    : player1ActivePowerUp === "power"
                    ? powerWaterIcon
                    : player1ActivePowerUp === "snowball"
                    ? snowballImage
                    : player1ActivePowerUp === "pumo_army"
                    ? pumoArmyIcon
                    : player1ActivePowerUp === "thick_blubber"
                    ? thickBlubberIcon
                    : ""
                }
                alt={player1ActivePowerUp}
              />
              <PowerUpIndicator>
                {getPowerUpIndicatorText(player1ActivePowerUp)}
              </PowerUpIndicator>
            </>
          )}
        </PowerUpContainer>

        <PowerUpContainer
          $activePowerUp={player2ActivePowerUp}
          $isOnCooldown={getPowerUpIsOnCooldown(
            player2ActivePowerUp,
            player2SnowballCooldown,
            player2PumoArmyCooldown
          )}
          $isPlayer2={true}
        >
          {player2ActivePowerUp && (
            <>
              <img
                src={
                  player2ActivePowerUp === "speed"
                    ? happyFeetIcon
                    : player2ActivePowerUp === "power"
                    ? powerWaterIcon
                    : player2ActivePowerUp === "snowball"
                    ? snowballImage
                    : player2ActivePowerUp === "pumo_army"
                    ? pumoArmyIcon
                    : player2ActivePowerUp === "thick_blubber"
                    ? thickBlubberIcon
                    : ""
                }
                alt={player2ActivePowerUp}
              />
              <PowerUpIndicator>
                {getPowerUpIndicatorText(player2ActivePowerUp)}
              </PowerUpIndicator>
            </>
          )}
        </PowerUpContainer>
      </CentralPowerUpSection>

      {/* Player 2 Section */}
      <PlayerSection $isRight={true}>
        <StaminaRow>
          <StaminaContainer $isRight={true}>
            <StaminaFill $stamina={p2DisplayStamina} />
            <StaminaLoss
              $left={p2Loss.left}
              $width={p2Loss.width}
              $visible={p2Loss.visible}
            />
            <GassedOverlay $isGassed={player2IsGassed} />
            <WinTracker $isRight={true}>
              {renderWinMarks(playerTwoWinCount)}
            </WinTracker>
            <PlayerInfoTop $isRight={true}>
              <PlayerName>PLAYER 2</PlayerName>
            </PlayerInfoTop>
            <PlayerInfoBottom $isRight={true}>
              <PlayerRank>JONOKUCHI</PlayerRank>
            </PlayerInfoBottom>
            <DodgeChargesPosition $isRight={true}>
              <DodgeChargesContainer>
                {renderDodgeCharges(
                  player2DodgeCharges,
                  player2DodgeChargeCooldowns
                )}
              </DodgeChargesContainer>
            </DodgeChargesPosition>
          </StaminaContainer>
          <PlayerAvatar>闘</PlayerAvatar>
        </StaminaRow>
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

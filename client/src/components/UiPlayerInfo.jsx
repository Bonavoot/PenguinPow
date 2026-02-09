import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import { SnowCap, IcicleRow, Icicle } from "./Snowfall";

// ============================================
// ANIMATIONS
// ============================================

const flashRedPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const pulseWin = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

// ============================================
// MAIN HUD CONTAINER
// ============================================

const FighterUIContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: clamp(85px, 14vh, 120px);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(6px, 1vh, 9px) clamp(8px, 1.2vw, 12px);
  z-index: 1000;

  /* Dark transparent gradient */
  background: linear-gradient(
    180deg,
    rgba(8, 12, 28, 0.88) 0%,
    rgba(8, 12, 28, 0.55) 50%,
    rgba(8, 12, 28, 0.12) 82%,
    transparent 100%
  );

  /* Thin gold/wood decorative beam across the very top */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      #5c4033 8%,
      #8b7355 25%,
      #d4af37 50%,
      #8b7355 75%,
      #5c4033 92%,
      transparent 100%
    );
    z-index: 2;
    pointer-events: none;
  }

  /* Frost / gold decorative line in gradient zone */
  &::after {
    content: "";
    position: absolute;
    bottom: 18%;
    left: 3%;
    right: 3%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(168, 212, 255, 0.12) 12%,
      rgba(212, 175, 55, 0.08) 28%,
      rgba(168, 212, 255, 0.18) 50%,
      rgba(212, 175, 55, 0.08) 72%,
      rgba(168, 212, 255, 0.12) 88%,
      transparent 100%
    );
    pointer-events: none;
  }
`;

// ============================================
// PLAYER SECTION — no card, just layout
// ============================================

const PlayerSection = styled.div`
  flex: 0 1 38%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: clamp(3px, 0.5vh, 7px);
  padding-top: clamp(2px, 0.3vh, 4px);
`;

// ============================================
// HEADER — [Avatar+PWR] [Name] [Rank]
// ============================================

const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(4px, 0.7vw, 10px);
  flex-direction: ${(props) => (props.$isRight ? "row-reverse" : "row")};
  width: 100%;
`;

/* Name + Rank stacked together */
const PlayerNameGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(1px, 0.2vh, 3px);
  align-items: ${(props) => (props.$isRight ? "flex-end" : "flex-start")};
  min-width: 0;
  flex: 1;
`;

// ============================================
// AVATAR — dual ring: ice outer, gold inner
// ============================================

const PlayerAvatar = styled.div`
  width: clamp(22px, 3.8vw, 46px);
  height: clamp(22px, 3.8vw, 46px);
  background: radial-gradient(
    circle at 40% 35%,
    rgba(20, 30, 60, 0.9),
    rgba(8, 12, 28, 0.95)
  );
  border: 2px solid rgba(168, 212, 255, 0.35);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(10px, 1.5vw, 19px);
  font-weight: bold;
  color: #d4af37;
  text-shadow: 0 0 8px rgba(212, 175, 55, 0.35), 0 2px 0 rgba(0, 0, 0, 0.7);
  box-shadow:
    0 0 0 2px rgba(212, 175, 55, 0.25),
    0 3px 10px rgba(0, 0, 0, 0.5),
    inset 0 0 8px rgba(168, 212, 255, 0.06);
  flex-shrink: 0;
`;

// ============================================
// NAME + RANK (separated across the header)
// ============================================

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 1.6vw, 19px);
  color: #f0ebe5;
  text-shadow:
    2px 2px 0 #000, -1px -1px 0 #000,
    1px -1px 0 #000, -1px 1px 0 #000,
    0 0 8px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlayerRank = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.75vw, 9px);
  color: #1a0a08;
  background: linear-gradient(135deg, #d4af37 0%, #a08050 100%);
  padding: clamp(1px, 0.25vh, 2px) clamp(4px, 0.6vw, 10px);
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 4px rgba(212, 175, 55, 0.2);
  line-height: 1.3;
`;

// ============================================
// STAMINA ROW — bar with label inside
// ============================================

const StaminaRow = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`;

const StaminaContainer = styled.div`
  position: relative;
  width: 100%;
  height: clamp(14px, 3vh, 38px);
  background: linear-gradient(
    ${(props) => (props.$isRight ? "280deg" : "100deg")},
    rgba(8, 12, 28, 0.92),
    rgba(20, 28, 55, 0.5)
  );
  border: 1px solid rgba(168, 212, 255, 0.22);
  border-radius: 3px;
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 0 4px rgba(168, 212, 255, 0.04),
    0 2px 8px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const StaminaLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(props) => (props.$isRight ? "right: clamp(5px, 0.8vw, 10px);" : "left: clamp(5px, 0.8vw, 10px);")}
  font-family: "Bungee", cursive;
  font-size: clamp(8px, 0.9vw, 11px);
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.7);
  z-index: 5;
  pointer-events: none;
  user-select: none;
`;

const StaminaFill = styled.div.attrs((props) => ({
  style: {
    width: `calc(${props.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(props) => (props.$isRight ? "right: 2px;" : "left: 2px;")}
  border-radius: 2px;
  transition: width 0.3s ease;
  z-index: 2;

  background: ${(props) =>
    props.$lowStaminaWarning
      ? props.$isRight
        ? "linear-gradient(270deg, #ff6b6b 0%, #ff4444 100%)"
        : "linear-gradient(90deg, #ff6b6b 0%, #ff4444 100%)"
      : props.$isRight
        ? "linear-gradient(270deg, #ffe888 0%, #d4af37 40%, #c49a30 100%)"
        : "linear-gradient(90deg, #c49a30 0%, #d4af37 60%, #ffe888 100%)"};

  box-shadow: ${(props) =>
    props.$lowStaminaWarning
      ? "0 0 12px rgba(255, 68, 68, 0.7)"
      : "0 0 10px rgba(212, 175, 55, 0.5), inset 0 0 4px rgba(255, 255, 255, 0.15)"};

  animation: ${(props) =>
    props.$lowStaminaWarning
      ? css`${flashRedPulse} 0.6s ease-in-out infinite`
      : "none"};

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, transparent 100%);
    border-radius: 2px 2px 0 0;
  }
`;

const StaminaLoss = styled.div.attrs((props) => ({
  style: {
    ...(props.$isRight
      ? { right: `calc(2px + ${props.$left}%)` }
      : { left: `calc(2px + ${props.$left}%)` }),
    width: `${props.$width}%`,
    opacity: props.$visible ? 1 : 0,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: ${(props) =>
    props.$isRight
      ? "linear-gradient(270deg, var(--edo-sakura) 0%, #ff9e9e 100%)"
      : "linear-gradient(90deg, var(--edo-sakura) 0%, #ff9e9e 100%)"};
  transition: opacity 0.15s ease;
  pointer-events: none;
  z-index: 1;
  border-radius: 2px;
`;

// ============================================
// POWER-UP ROW — flush with stamina bar start
// ============================================

const PowerUpRow = styled.div`
  display: flex;
  width: 100%;
  justify-content: ${(props) => (props.$isRight ? "flex-end" : "flex-start")};
`;

// ============================================
// POWER-UP — icon box
// ============================================

const PowerUpContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(18px, 2.8vw, 34px);
  height: clamp(18px, 2.8vw, 34px);
  border-radius: 5px;
  border: 2px solid;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;

  background: ${(props) => {
    if (!props.$activePowerUp)
      return "linear-gradient(145deg, rgba(15, 22, 48, 0.5), rgba(8, 12, 28, 0.6))";
    if (props.$isOnCooldown)
      return "linear-gradient(135deg, #6b7280 0%, #4a5568 100%)";
    switch (props.$activePowerUp) {
      case "speed":
        return "linear-gradient(135deg, #00d2ff 0%, #0066cc 100%)";
      case "power":
        return "linear-gradient(135deg, var(--edo-sakura) 0%, #dc2626 100%)";
      case "snowball":
        return "linear-gradient(135deg, #e0f6ff 0%, #87ceeb 100%)";
      case "pumo_army":
        return "linear-gradient(135deg, #ffcc80 0%, #ff8c00 100%)";
      case "thick_blubber":
        return "linear-gradient(135deg, #9c88ff 0%, #7c4dff 100%)";
      default:
        return "linear-gradient(135deg, #6c757d 0%, #343a40 100%)";
    }
  }};

  border-color: ${(props) => {
    if (!props.$activePowerUp || props.$isOnCooldown)
      return "rgba(168, 212, 255, 0.2)";
    switch (props.$activePowerUp) {
      case "speed": return "#0066cc";
      case "power": return "#dc2626";
      case "snowball": return "#4682b4";
      case "pumo_army": return "#cc6600";
      case "thick_blubber": return "#5e35b1";
      default: return "#d4af37";
    }
  }};

  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  opacity: ${(props) => (props.$activePowerUp ? 1 : 0.3)};

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
    filter: ${(props) =>
      props.$isOnCooldown ? "brightness(0.5) grayscale(0.3)" : "brightness(1)"};
  }
`;

const PowerUpIndicator = styled.div`
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(6px, 0.7vw, 8px);
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

// ============================================
// CENTER SCOREBOARD — wooden plaque, parchment dots
// ============================================

const CenterScoreboard = styled.div`
  position: absolute;
  top: clamp(18px, 3.8vh, 42px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;

  display: flex;
  align-items: center;
  gap: clamp(3px, 0.8vw, 14px);
  padding: clamp(4px, 0.7vh, 10px) clamp(5px, 1vw, 18px);

  /* Japanese lacquer (urushi) — deep crimson-black, traditional sumo feel */
  background: linear-gradient(
    180deg,
    #5c1a1a 0%,
    #3d0e0e 35%,
    #2a0808 65%,
    #1a0404 100%
  );
  border: 2px solid #8b6914;
  border-radius: clamp(4px, 0.7vw, 8px);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 180, 100, 0.12),
    inset 0 -2px 6px rgba(0, 0, 0, 0.5),
    inset 0 0 12px rgba(80, 15, 15, 0.3);

  /* Gold ornamental top edge */
  &::before {
    content: "";
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    height: 3px;
    background: linear-gradient(
      90deg,
      #6b4c12 0%,
      #c9a22e 15%,
      #f0d060 35%,
      #ffe87a 50%,
      #f0d060 65%,
      #c9a22e 85%,
      #6b4c12 100%
    );
    border-radius: clamp(4px, 0.7vw, 8px) clamp(4px, 0.7vw, 8px) 0 0;
    pointer-events: none;
  }

  /* Gold ornamental bottom edge */
  &::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: -1px;
    right: -1px;
    height: 3px;
    background: linear-gradient(
      90deg,
      #6b4c12 0%,
      #c9a22e 15%,
      #f0d060 35%,
      #ffe87a 50%,
      #f0d060 65%,
      #c9a22e 85%,
      #6b4c12 100%
    );
    border-radius: 0 0 clamp(4px, 0.7vw, 8px) clamp(4px, 0.7vw, 8px);
    pointer-events: none;
  }
`;

/* Score mark tray — dark lacquer inset */
const ScoreParchment = styled.div`
  display: flex;
  flex-direction: ${(props) => (props.$reverse ? "row-reverse" : "row")};
  gap: clamp(2px, 0.35vw, 4px);
  background: linear-gradient(
    145deg,
    rgba(10, 2, 2, 0.8) 0%,
    rgba(20, 5, 5, 0.6) 50%,
    rgba(10, 2, 2, 0.8) 100%
  );
  padding: clamp(2px, 0.4vw, 6px) clamp(3px, 0.5vw, 8px);
  border-radius: 3px;
  border: 1px solid rgba(139, 105, 20, 0.35);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.5),
    inset 0 0 6px rgba(0, 0, 0, 0.3);
  position: relative;
`;

/* Traditional sumo go-stones: white = win, black = loss */
const ScoreMark = styled.div`
  width: clamp(7px, 1.1vw, 15px);
  height: clamp(7px, 1.1vw, 15px);
  border-radius: 50%;
  position: relative;
  z-index: 1;

  background: ${(props) => {
    if (props.$isEmpty)
      return "linear-gradient(145deg, rgba(80, 50, 30, 0.2), rgba(60, 35, 20, 0.12))";
    return props.$isWin
      ? "radial-gradient(60% 60% at 35% 35%, #fff 0%, #f0f0f0 60%, #ddd 100%)"
      : "radial-gradient(60% 60% at 35% 35%, #444 0%, #1a1a1a 60%, #050505 100%)";
  }};

  border: ${(props) => {
    if (props.$isEmpty) return "1.5px solid rgba(139, 105, 20, 0.25)";
    return props.$isWin
      ? "1.5px solid rgba(255, 255, 255, 0.85)"
      : "2px solid rgba(255, 255, 255, 0.55)";
  }};

  box-shadow: ${(props) => {
    if (props.$isEmpty) return "inset 0 1px 2px rgba(0, 0, 0, 0.2)";
    return props.$isWin
      ? "0 0 6px rgba(255, 255, 255, 0.6), 0 0 3px rgba(212, 175, 55, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.15)"
      : "0 0 4px rgba(139, 105, 20, 0.3), 0 0 1px rgba(212, 175, 55, 0.25), inset 0 1px 3px rgba(60, 60, 60, 0.4)";
  }};

  animation: ${(props) =>
    props.$isWin && !props.$isEmpty ? pulseWin : "none"} 2s infinite;
`;

const RoundInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
`;

const RoundNumber = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(12px, 2.2vw, 36px);
  color: #d4af37;
  text-shadow:
    2px 2px 0 #000,
    0 0 10px rgba(212, 175, 55, 0.4);
  line-height: 1;
  user-select: none;
`;

const RoundLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(6px, 0.65vw, 8px);
  color: rgba(200, 170, 100, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.7);
  margin-top: 1px;
`;

// ============================================
// CONSTANTS
// ============================================

const THROW_BREAK_STAMINA_THRESHOLD = 33;

// ============================================
// COMPONENT
// ============================================

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
  const clampStamina = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };

  const s1 = clampStamina(player1Stamina);
  const s2 = clampStamina(player2Stamina);

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
    setP1DisplayStamina(s1);
    setP2DisplayStamina(s2);
    setP1Loss({ left: 0, width: 0, visible: false });
    setP2Loss({ left: 0, width: 0, visible: false });
    setP1LastDecreaseAt(0);
    setP2LastDecreaseAt(0);
  }, [roundId]);

  useEffect(() => {
    let next = s1;
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
    const justDecreased =
      Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
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
    const justDecreased =
      Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
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

  // ── Derived match state ──
  const currentRound = Math.min(roundHistory.length + 1, 3);

  /* Traditional sumo scoring: white = win, black = loss, dim = unplayed */
  const renderCenterMarks = (playerName) => {
    const marks = [];
    const maxRounds = 3;
    for (let i = 0; i < maxRounds; i++) {
      if (i < roundHistory.length) {
        const isWin = roundHistory[i] === playerName;
        marks.push(
          <ScoreMark key={`r-${i}`} $isWin={isWin} $isEmpty={false} />
        );
      } else {
        marks.push(
          <ScoreMark key={`e-${i}`} $isWin={false} $isEmpty={true} />
        );
      }
    }
    return marks;
  };

  const shouldShowLowStaminaWarning = (stamina) =>
    stamina < THROW_BREAK_STAMINA_THRESHOLD;

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
      {/* ═══ Player 1 ═══ */}
      <PlayerSection>
        <PlayerHeader $isRight={false}>
          <PlayerAvatar>力</PlayerAvatar>
          <PlayerNameGroup $isRight={false}>
            <PlayerName>PLAYER 1</PlayerName>
            <PlayerRank>JONOKUCHI</PlayerRank>
          </PlayerNameGroup>
        </PlayerHeader>

        <StaminaRow>
          <StaminaContainer $isRight={false}>
            <StaminaLabel $isRight={false}>STA</StaminaLabel>
            <StaminaFill
              $stamina={p1DisplayStamina}
              $lowStaminaWarning={shouldShowLowStaminaWarning(p1DisplayStamina)}
              $isRight={false}
            />
            <StaminaLoss
              $left={p1Loss.left}
              $width={p1Loss.width}
              $visible={p1Loss.visible}
              $isRight={false}
            />
          </StaminaContainer>
        </StaminaRow>

        <PowerUpRow $isRight={false}>
          <PowerUpContainer
            $activePowerUp={player1ActivePowerUp}
            $isOnCooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown
            )}
          >
            {player1ActivePowerUp && (
              <>
                <img
                  src={getPowerUpIcon(player1ActivePowerUp)}
                  alt={player1ActivePowerUp}
                />
                <PowerUpIndicator>
                  {getPowerUpIndicatorText(player1ActivePowerUp)}
                </PowerUpIndicator>
              </>
            )}
          </PowerUpContainer>
        </PowerUpRow>
      </PlayerSection>

      {/* ═══ Center Scoreboard ═══ */}
      <CenterScoreboard>
        <SnowCap />
        <ScoreParchment>{renderCenterMarks("player1")}</ScoreParchment>
        <RoundInfo>
          <RoundNumber>{currentRound}</RoundNumber>
          <RoundLabel>ROUND</RoundLabel>
        </RoundInfo>
        <ScoreParchment $reverse>{renderCenterMarks("player2")}</ScoreParchment>
        <IcicleRow $bottom="-10px">
          <Icicle $w={2} $h={5} />
          <Icicle $w={3} $h={8} />
          <Icicle $w={2} $h={6} />
          <Icicle $w={3} $h={10} />
          <Icicle $w={2} $h={7} />
        </IcicleRow>
      </CenterScoreboard>

      {/* ═══ Player 2 ═══ */}
      <PlayerSection>
        <PlayerHeader $isRight={true}>
          <PlayerAvatar>闘</PlayerAvatar>
          <PlayerNameGroup $isRight={true}>
            <PlayerName>PLAYER 2</PlayerName>
            <PlayerRank>JONOKUCHI</PlayerRank>
          </PlayerNameGroup>
        </PlayerHeader>

        <StaminaRow>
          <StaminaContainer $isRight={true}>
            <StaminaLabel $isRight={true}>STA</StaminaLabel>
            <StaminaFill
              $stamina={p2DisplayStamina}
              $lowStaminaWarning={shouldShowLowStaminaWarning(p2DisplayStamina)}
              $isRight={true}
            />
            <StaminaLoss
              $left={p2Loss.left}
              $width={p2Loss.width}
              $visible={p2Loss.visible}
              $isRight={true}
            />
          </StaminaContainer>
        </StaminaRow>

        <PowerUpRow $isRight={true}>
          <PowerUpContainer
            $activePowerUp={player2ActivePowerUp}
            $isOnCooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown
            )}
          >
            {player2ActivePowerUp && (
              <>
                <img
                  src={getPowerUpIcon(player2ActivePowerUp)}
                  alt={player2ActivePowerUp}
                />
                <PowerUpIndicator>
                  {getPowerUpIndicatorText(player2ActivePowerUp)}
                </PowerUpIndicator>
              </>
            )}
          </PowerUpContainer>
        </PowerUpRow>
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

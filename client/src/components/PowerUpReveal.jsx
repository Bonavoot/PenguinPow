import { useState, useEffect, useContext, useMemo, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

// ============================================
// ANIMATIONS
// ============================================

const screenFlash = keyframes`
  0% { opacity: 0; }
  10% { opacity: 0.4; }
  100% { opacity: 0; }
`;

const slamInLeft = keyframes`
  0% {
    transform: translateX(-120%) rotate(-15deg) scale(1.3);
    opacity: 0;
  }
  50% {
    transform: translateX(10%) rotate(3deg) scale(1.05);
    opacity: 1;
  }
  70% {
    transform: translateX(-3%) rotate(-1deg) scale(1);
  }
  100% {
    transform: translateX(0) rotate(0deg) scale(1);
    opacity: 1;
  }
`;

const slamInRight = keyframes`
  0% {
    transform: translateX(120%) rotate(15deg) scale(1.3);
    opacity: 0;
  }
  50% {
    transform: translateX(-10%) rotate(-3deg) scale(1.05);
    opacity: 1;
  }
  70% {
    transform: translateX(3%) rotate(1deg) scale(1);
  }
  100% {
    transform: translateX(0) rotate(0deg) scale(1);
    opacity: 1;
  }
`;

const vsAppear = keyframes`
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.3) rotate(10deg);
    opacity: 1;
  }
  80% {
    transform: scale(0.9) rotate(-5deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
`;

const glowPulse = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 10px var(--glow-color)) 
            drop-shadow(0 0 20px var(--glow-color));
  }
  50% {
    filter: drop-shadow(0 0 20px var(--glow-color)) 
            drop-shadow(0 0 40px var(--glow-color))
            drop-shadow(0 0 60px var(--glow-color));
  }
`;

const particleFloat = keyframes`
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-80px) scale(0);
    opacity: 0;
  }
`;

const slideOut = keyframes`
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-30px) scale(0.9);
    opacity: 0;
  }
`;

const playerLabelAppear = keyframes`
  0% {
    transform: translateY(-20px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

// ============================================
// STYLED COMPONENTS
// ============================================

const RevealOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 10000;
  pointer-events: none;
  
  ${props => props.$isExiting && css`
    animation: ${slideOut} 0.4s ease-in forwards;
  `}
`;

const FlashOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fff 0%, #d4af37 100%);
  animation: ${screenFlash} 0.5s ease-out forwards;
  pointer-events: none;
`;

const RevealContainer = styled.div`
  --player-card-width: clamp(74px, 11.2cqw, 132px);
  margin-top: clamp(56px, 17.2cqh, 124px);
  width: fit-content;
  max-width: 96cqw;
  display: grid;
  grid-template-columns: var(--player-card-width) auto var(--player-card-width);
  align-items: center;
  column-gap: clamp(5px, 0.9cqw, 10px);
  padding: clamp(9px, 1.35cqh, 13px) clamp(10px, 1.1cqw, 14px);
  background: linear-gradient(180deg,
    rgba(20, 10, 5, 0.9) 0%,
    rgba(45, 21, 16, 0.86) 50%,
    rgba(20, 10, 5, 0.9) 100%
  );
  border: 2px solid rgba(212, 175, 55, 0.65);
  border-radius: clamp(10px, 1.1cqw, 16px);
  box-shadow: 
    0 8px 28px rgba(0, 0, 0, 0.55),
    0 0 18px rgba(212, 175, 55, 0.2),
    inset 0 0 30px rgba(0, 0, 0, 0.36);
  position: relative;
  overflow: visible;
  
  &::before {
    content: "";
    position: absolute;
    top: 6px;
    left: 6px;
    right: 6px;
    bottom: 6px;
    border: 1px solid rgba(212, 175, 55, 0.22);
    border-radius: clamp(8px, 0.9cqw, 12px);
    pointer-events: none;
  }
  
  @media (max-width: 700px) {
    max-width: 96cqw;
    column-gap: clamp(5px, 0.85cqw, 10px);
    padding: clamp(7px, 1cqh, 10px) clamp(7px, 0.8cqw, 10px);
    border-width: 2px;
  }
`;

const getTypeColor = (type) => {
  switch (type) {
    case "speed": return { main: "#00d2ff", dark: "#006688", glow: "rgba(0, 210, 255, 0.6)" };
    case "power": return { main: "#ff4444", dark: "#882222", glow: "rgba(255, 68, 68, 0.6)" };
    case "snowball": return { main: "#74b9ff", dark: "#3366aa", glow: "rgba(116, 185, 255, 0.6)" };
    case "pumo_army": return { main: "#ffaa44", dark: "#996622", glow: "rgba(255, 170, 68, 0.6)" };
    case "thick_blubber": return { main: "#aa77ff", dark: "#553399", glow: "rgba(170, 119, 255, 0.6)" };
    default: return { main: "#d4af37", dark: "#8b7355", glow: "rgba(212, 175, 55, 0.6)" };
  }
};

const PlayerCard = styled.div`
  --glow-color: ${props => getTypeColor(props.$powerUpType).glow};
  
  display: grid;
  grid-template-rows: auto auto auto;
  justify-items: center;
  align-items: center;
  row-gap: clamp(3px, 0.45cqh, 6px);
  min-width: 0;
  width: 100%;
  animation: ${props => props.$isPlayer1 ? slamInLeft : slamInRight} 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: ${props => props.$isPlayer1 ? '0.1s' : '0.2s'};
  opacity: 0;
  position: relative;
`;

const PlayerLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1.1cqw, 0.85rem);
  color: ${props => props.$isPlayer1 ? '#00d2ff' : '#ff6b6b'};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0;
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px ${props => props.$isPlayer1 ? 'rgba(0, 210, 255, 0.5)' : 'rgba(255, 107, 107, 0.5)'};
  animation: ${playerLabelAppear} 0.4s ease-out forwards;
  animation-delay: ${props => props.$isPlayer1 ? '0.5s' : '0.6s'};
  opacity: 0;
  
  @media (max-width: 600px) {
    font-size: clamp(0.45rem, 1.8cqw, 0.7rem);
    margin-bottom: clamp(4px, 0.8cqh, 8px);
  }
`;

const IconContainer = styled.div`
  width: clamp(24px, 3.9cqw, 38px);
  height: clamp(24px, 3.9cqw, 38px);
  background: linear-gradient(135deg,
    ${props => getTypeColor(props.$powerUpType).main} 0%,
    ${props => getTypeColor(props.$powerUpType).dark} 100%
  );
  border: 2px solid #000;
  border-radius: clamp(4px, 0.6cqw, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0;
  box-shadow: 
    inset 0 2px 4px rgba(255, 255, 255, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 3px 8px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
  
  img {
    width: 65%;
    height: 65%;
    object-fit: contain;
    filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));
    position: relative;
    z-index: 1;
  }
  
  &::after {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 40%,
      rgba(255, 255, 255, 0.15) 50%,
      transparent 60%
    );
    animation: shimmer 3s ease-in-out infinite;
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%) rotate(45deg); }
    100% { transform: translateX(100%) rotate(45deg); }
  }
  
  @media (max-width: 600px) {
    width: clamp(22px, 5.4cqw, 34px);
    height: clamp(22px, 5.4cqw, 34px);
    margin-bottom: clamp(2px, 0.35cqh, 4px);
    border-width: 2px;
  }
`;

const PowerUpName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.95cqw, 0.7rem);
  color: ${props => getTypeColor(props.$powerUpType).main};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.05;
  margin-bottom: 0;
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px ${props => getTypeColor(props.$powerUpType).glow};
  white-space: nowrap;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 600px) {
    font-size: clamp(0.4rem, 1.6cqw, 0.58rem);
  }
`;

const VSContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  animation: ${vsAppear} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: 0.3s;
  opacity: 0;
`;

const VSText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.95rem, 2.4cqw, 1.6rem);
  color: #d4af37;
  padding: clamp(3px, 0.45cqh, 6px) clamp(8px, 1.1cqw, 14px);
  border-radius: 6px;
  border: 1px solid rgba(212, 175, 55, 0.35);
  background: linear-gradient(180deg, rgba(10, 14, 30, 0.55) 0%, rgba(10, 14, 30, 0.2) 100%);
  text-shadow: 
    3px 3px 0 #000,
    -2px -2px 0 #000,
    2px -2px 0 #000,
    -2px 2px 0 #000,
    0 0 20px rgba(212, 175, 55, 0.6);
  letter-spacing: 0.1em;
  
  @media (max-width: 600px) {
    font-size: clamp(0.72rem, 3.2cqw, 1.2rem);
  }
`;

const ParticleContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const Particle = styled.div`
  position: absolute;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: ${props => props.$color};
  border-radius: 50%;
  animation: ${particleFloat} ${props => props.$duration}s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  left: ${props => props.$x}px;
  top: ${props => props.$y}px;
  box-shadow: 0 0 ${props => props.$size * 2}px ${props => props.$color};
`;

// ============================================
// COMPONENT
// ============================================

const PowerUpReveal = ({ roomId, localId }) => {
  const { socket } = useContext(SocketContext);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [revealData, setRevealData] = useState(null);
  const revealTimeoutsRef = useRef([]);

  const powerUpInfo = useMemo(() => ({
    speed: { name: "Happy Feet", icon: happyFeetIcon, isActive: false },
    power: { name: "Power Water", icon: powerWaterIcon, isActive: false },
    snowball: { name: "Snowball", icon: snowballImage, isActive: true },
    pumo_army: { name: "Pumo Army", icon: pumoArmyIcon, isActive: true },
    thick_blubber: { name: "Thick Blubber", icon: thickBlubberIcon, isActive: false },
  }), []);

  // Generate particles for the reveal effect
  const particles = useMemo(() => {
    if (!revealData) return [];
    
    const colors = [
      getTypeColor(revealData.player1.powerUpType).main,
      getTypeColor(revealData.player2.powerUpType).main,
      '#d4af37',
      '#fff'
    ];
    
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 100,
      size: 3 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 0.8 + Math.random() * 0.6,
      delay: 0.4 + Math.random() * 0.3,
    }));
  }, [revealData]);

  useEffect(() => {
    const handlePowerUpsRevealed = (data) => {
      setRevealData({
        player1: data.player1,
        player2: data.player2,
      });
      setIsVisible(true);
      setIsExiting(false);

      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];

      revealTimeoutsRef.current.push(
        setTimeout(() => {
          setIsExiting(true);
        }, 2500),
        setTimeout(() => {
          setIsVisible(false);
          setRevealData(null);
        }, 2900)
      );
    };

    const handleGameReset = () => {
      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];
      setIsVisible(false);
      setIsExiting(false);
      setRevealData(null);
    };

    socket.on("power_ups_revealed", handlePowerUpsRevealed);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_ups_revealed", handlePowerUpsRevealed);
      socket.off("game_reset", handleGameReset);
      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];
    };
  }, [socket, localId]);

  if (!isVisible || !revealData) return null;

  const player1Info = powerUpInfo[revealData.player1.powerUpType];
  const player2Info = powerUpInfo[revealData.player2.powerUpType];

  // Determine if local player is P1 or P2 for label highlighting
  const isLocalP1 = revealData.player1.playerId === localId;

  return (
    <RevealOverlay $isExiting={isExiting}>
      <FlashOverlay />
      <RevealContainer>
        <ParticleContainer>
          {particles.map(p => (
            <Particle
              key={p.id}
              $x={p.x}
              $y={p.y}
              $size={p.size}
              $color={p.color}
              $duration={p.duration}
              $delay={p.delay}
            />
          ))}
        </ParticleContainer>

        {/* Player 1 Card */}
        <PlayerCard $isPlayer1={true} $powerUpType={revealData.player1.powerUpType}>
          <PlayerLabel $isPlayer1={true}>
            {isLocalP1 ? "YOU" : "P1"}
          </PlayerLabel>
          <IconContainer $powerUpType={revealData.player1.powerUpType}>
            <img src={player1Info?.icon} alt={player1Info?.name} />
          </IconContainer>
          <PowerUpName $powerUpType={revealData.player1.powerUpType}>
            {player1Info?.name}
          </PowerUpName>
        </PlayerCard>

        {/* VS Badge */}
        <VSContainer>
          <VSText>VS</VSText>
        </VSContainer>

        {/* Player 2 Card */}
        <PlayerCard $isPlayer1={false} $powerUpType={revealData.player2.powerUpType}>
          <PlayerLabel $isPlayer1={false}>
            {!isLocalP1 ? "YOU" : "P2"}
          </PlayerLabel>
          <IconContainer $powerUpType={revealData.player2.powerUpType}>
            <img src={player2Info?.icon} alt={player2Info?.name} />
          </IconContainer>
          <PowerUpName $powerUpType={revealData.player2.powerUpType}>
            {player2Info?.name}
          </PowerUpName>
        </PlayerCard>
      </RevealContainer>
    </RevealOverlay>
  );
};

PowerUpReveal.propTypes = {
  roomId: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default PowerUpReveal;

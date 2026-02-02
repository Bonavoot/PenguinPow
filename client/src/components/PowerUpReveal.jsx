import { useState, useEffect, useContext, useMemo } from "react";
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
  margin-top: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 3vw, 40px);
  padding: clamp(15px, 2.5vw, 28px);
  background: linear-gradient(180deg,
    rgba(20, 10, 5, 0.95) 0%,
    rgba(45, 21, 16, 0.95) 50%,
    rgba(20, 10, 5, 0.95) 100%
  );
  border: 4px solid #d4af37;
  border-radius: 16px;
  box-shadow: 
    0 0 40px rgba(212, 175, 55, 0.4),
    0 0 80px rgba(0, 0, 0, 0.8),
    inset 0 0 60px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: visible;
  
  &::before {
    content: "";
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    bottom: 8px;
    border: 2px solid rgba(212, 175, 55, 0.3);
    border-radius: 10px;
    pointer-events: none;
  }
  
  @media (max-width: 1200px) {
    margin-top: 100px;
  }
  
  @media (max-width: 900px) {
    margin-top: 85px;
  }
  
  @media (max-width: 700px) {
    gap: clamp(12px, 2.5vw, 24px);
    padding: clamp(10px, 2vw, 18px);
    border-width: 3px;
  }
  
  @media (max-width: 600px) {
    margin-top: 70px;
  }
  
  @media (max-height: 700px) {
    margin-top: 65px;
  }
  
  @media (max-height: 550px) {
    margin-top: 50px;
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
  
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${props => props.$isPlayer1 ? slamInLeft : slamInRight} 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: ${props => props.$isPlayer1 ? '0.1s' : '0.2s'};
  opacity: 0;
  position: relative;
`;

const PlayerLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1.1vw, 0.85rem);
  color: ${props => props.$isPlayer1 ? '#00d2ff' : '#ff6b6b'};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: clamp(6px, 1vh, 10px);
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px ${props => props.$isPlayer1 ? 'rgba(0, 210, 255, 0.5)' : 'rgba(255, 107, 107, 0.5)'};
  animation: ${playerLabelAppear} 0.4s ease-out forwards;
  animation-delay: ${props => props.$isPlayer1 ? '0.5s' : '0.6s'};
  opacity: 0;
  
  @media (max-width: 600px) {
    font-size: clamp(0.45rem, 1.8vw, 0.7rem);
    margin-bottom: clamp(4px, 0.8vh, 8px);
  }
`;

const PowerUpCard = styled.div`
  width: clamp(80px, 12vw, 145px);
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border: 3px solid ${props => getTypeColor(props.$powerUpType).main};
  border-radius: clamp(4px, 0.6vw, 8px);
  padding: clamp(12px, 1.6vh, 20px) clamp(8px, 1.2vw, 14px);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 
    0 8px 25px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -3px 6px rgba(0, 0, 0, 0.4);
  animation: ${glowPulse} 2s ease-in-out infinite;
  animation-delay: 0.8s;
  position: relative;
  
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
      rgba(255, 255, 255, 0.02) 1px,
      transparent 3px
    );
    border-radius: inherit;
    pointer-events: none;
  }
  
  @media (max-width: 600px) {
    width: clamp(65px, 17vw, 110px);
    padding: clamp(10px, 1.4vh, 16px) clamp(6px, 1vw, 10px);
    border-width: 2px;
  }
`;

const IconContainer = styled.div`
  width: clamp(35px, 5.5vw, 58px);
  height: clamp(35px, 5.5vw, 58px);
  background: linear-gradient(135deg,
    ${props => getTypeColor(props.$powerUpType).main} 0%,
    ${props => getTypeColor(props.$powerUpType).dark} 100%
  );
  border: 3px solid #000;
  border-radius: clamp(4px, 0.6vw, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(8px, 1vh, 12px);
  box-shadow: 
    inset 0 3px 6px rgba(255, 255, 255, 0.3),
    inset 0 -3px 6px rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
  
  img {
    width: 65%;
    height: 65%;
    object-fit: contain;
    filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5));
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
    width: clamp(34px, 8vw, 55px);
    height: clamp(34px, 8vw, 55px);
    margin-bottom: clamp(6px, 0.8vh, 10px);
    border-width: 2px;
  }
`;

const PowerUpName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1.25vw, 0.95rem);
  color: ${props => getTypeColor(props.$powerUpType).main};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.1;
  margin-bottom: clamp(3px, 0.4vh, 6px);
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px ${props => getTypeColor(props.$powerUpType).glow};
  white-space: nowrap;
  
  @media (max-width: 600px) {
    font-size: clamp(0.5rem, 2.2vw, 0.75rem);
  }
`;

const PowerUpType = styled.div`
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

const VSContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${vsAppear} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: 0.3s;
  opacity: 0;
`;

const VSText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: #d4af37;
  text-shadow: 
    3px 3px 0 #000,
    -2px -2px 0 #000,
    2px -2px 0 #000,
    -2px 2px 0 #000,
    0 0 20px rgba(212, 175, 55, 0.6);
  letter-spacing: 0.1em;
  
  @media (max-width: 600px) {
    font-size: clamp(0.9rem, 4vw, 1.5rem);
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
      console.log("🎉 PowerUpReveal: Received power_ups_revealed", data);
      
      setRevealData({
        player1: data.player1,
        player2: data.player2,
      });
      setIsVisible(true);
      setIsExiting(false);

      // Start exit animation after display time
      setTimeout(() => {
        setIsExiting(true);
      }, 2500);

      // Hide completely after exit animation
      setTimeout(() => {
        setIsVisible(false);
        setRevealData(null);
      }, 2900);
    };

    const handleGameReset = () => {
      setIsVisible(false);
      setIsExiting(false);
      setRevealData(null);
    };

    socket.on("power_ups_revealed", handlePowerUpsRevealed);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_ups_revealed", handlePowerUpsRevealed);
      socket.off("game_reset", handleGameReset);
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
          <PowerUpCard $powerUpType={revealData.player1.powerUpType}>
            <IconContainer $powerUpType={revealData.player1.powerUpType}>
              <img src={player1Info?.icon} alt={player1Info?.name} />
            </IconContainer>
            <PowerUpName $powerUpType={revealData.player1.powerUpType}>
              {player1Info?.name}
            </PowerUpName>
            <PowerUpType $isActive={player1Info?.isActive}>
              {player1Info?.isActive ? "● Active" : "○ Passive"}
            </PowerUpType>
          </PowerUpCard>
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
          <PowerUpCard $powerUpType={revealData.player2.powerUpType}>
            <IconContainer $powerUpType={revealData.player2.powerUpType}>
              <img src={player2Info?.icon} alt={player2Info?.name} />
            </IconContainer>
            <PowerUpName $powerUpType={revealData.player2.powerUpType}>
              {player2Info?.name}
            </PowerUpName>
            <PowerUpType $isActive={player2Info?.isActive}>
              {player2Info?.isActive ? "● Active" : "○ Passive"}
            </PowerUpType>
          </PowerUpCard>
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

import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";

// Dramatic shockwave burst animation
const shockwaveExpand = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
    border-width: 8px;
  }
  40% {
    opacity: 1;
    border-width: 4px;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
    border-width: 1px;
  }
`;

const innerFlash = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
  }
`;

const sparkBurst = keyframes`
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.3);
  }
`;

const textPop = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  20% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 1;
  }
  60% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 1;
  }
  80% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
`;


const EffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 - 4}%;
  bottom: ${props => (props.$y / 720) * 100 + 14}%;
  transform: translate(-50%, -50%);
  z-index: 150;
  pointer-events: none;
  contain: layout style;
`;

// Purple shockwave ring for punish (primary)
const ShockwaveRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(35px, 5vw, 70px);
  height: clamp(35px, 5vw, 70px);
  border-radius: 50%;
  border: 5px solid #9933ff;
  transform: translate(-50%, -50%) scale(0);
  animation: ${shockwaveExpand} 0.4s ease-out forwards;
`;

// Secondary magenta-purple ring for layered effect (accent)
const ShockwaveRingPurple = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(28px, 4.5vw, 60px);
  height: clamp(28px, 4.5vw, 60px);
  border-radius: 50%;
  border: 4px solid #cc44ff;
  transform: translate(-50%, -50%) scale(0);
  animation: ${shockwaveExpand} 0.45s ease-out 0.04s forwards;
`;

const InnerFlash = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  /* Smaller minimum for better scaling on small screens */
  width: clamp(18px, 2.5vw, 35px);
  height: clamp(18px, 2.5vw, 35px);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(153, 51, 255, 0.8) 40%, rgba(204, 68, 255, 0.6) 70%, transparent 100%);
  transform: translate(-50%, -50%) scale(0);
  animation: ${innerFlash} 0.35s ease-out forwards;
`;

const Spark = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: ${props => props.$isPurple 
    ? 'linear-gradient(45deg, #ffffff, #9933ff)' 
    : 'linear-gradient(45deg, #ffffff, #cc44ff)'};
  border-radius: 50%;
  opacity: 0;
  animation: ${sparkBurst} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  --dx: ${props => props.$dx}vw;
  --dy: ${props => props.$dy}vw;
`;

const PunishText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.7rem, 1.6vw, 1.4rem);
  color: #9933ff;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 15px rgba(153, 51, 255, 0.9),
    0 0 30px rgba(204, 68, 255, 0.7);
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${textPop} 0.6s ease-out forwards;
  animation-delay: 0.05s;
`;


const CounterGrabEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedCountersRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1600; // Longer to match side text animation

  // Generate spark particles - alternating red and purple
  const generateSparks = () => {
    const sparks = [];
    const sparkCount = 8;
    
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * 360;
      const radians = angle * (Math.PI / 180);
      const distance = 3 + Math.random() * 1.5;
      
      sparks.push({
        id: i,
        size: 4 + Math.random() * 4,
        dx: Math.cos(radians) * distance,
        dy: Math.sin(radians) * distance,
        delay: i * 0.02,
        isPurple: i % 2 === 0, // Alternate colors
      });
    }
    
    return sparks;
  };

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedCountersRef.current.has(position.counterId)) {
      return;
    }

    processedCountersRef.current.add(position.counterId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      sparks: generateSparks(),
      grabberPlayerNumber: position.grabberPlayerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedCountersRef.current.delete(position.counterId);
    }, EFFECT_DURATION);
  }, [position?.counterId, position?.x, position?.y, position?.grabberPlayerNumber]);

  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        // Player 1's text appears on the LEFT, Player 2's text appears on the RIGHT
        const isLeftSide = effect.grabberPlayerNumber === 1;
        
        return (
          <div key={effect.id}>
            <EffectContainer $x={effect.x} $y={effect.y}>
              <ShockwaveRing />
              <ShockwaveRingPurple />
              <InnerFlash />
              {effect.sparks.map((spark) => (
                <Spark
                  key={spark.id}
                  $size={spark.size}
                  $dx={spark.dx}
                  $dy={spark.dy}
                  $delay={spark.delay}
                  $isPurple={spark.isPurple}
                />
              ))}
              <PunishText>PUNISH</PunishText>
            </EffectContainer>
            {/* Sumo-themed punish announcement banner */}
            <SumoAnnouncementBanner
              text={"PUNISH"}
              type="punish"
              isLeftSide={isLeftSide}
            />
          </div>
        );
      })}
    </>
  );
};

CounterGrabEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    counterId: PropTypes.string,
    grabberPlayerNumber: PropTypes.number,
  }),
};

export default CounterGrabEffect;

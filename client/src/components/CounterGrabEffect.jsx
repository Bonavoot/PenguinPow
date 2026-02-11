import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import { HIT_EFFECT_TEXT_DURATION, HIT_EFFECT_TEXT_DELAY } from "../config/hitEffectText";

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
  25% {
    transform: translate(-50%, -50%) scale(1.65);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.8);
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

// Distinct "lock sigil" burst so counter grab reads immediately.
const lockGlyphBurst = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.25) rotate(0deg);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, -50%) scale(1.05) rotate(9deg);
    opacity: 0.95;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.55) rotate(16deg);
    opacity: 0;
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

const EFFECT_TEXT_BASELINE_OFFSET_Y = 0;
const EFFECT_CENTER_OFFSET_X = -3;


const EffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + EFFECT_CENTER_OFFSET_X}%;
  bottom: ${props => (props.$y / 720) * 100 + EFFECT_TEXT_BASELINE_OFFSET_Y}%;
  width: clamp(4.2rem, 10.5vw, 8.4rem);
  height: clamp(3.9rem, 9.8vw, 7.8rem);
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 170;
  pointer-events: none;
  contain: layout style;
  filter:
    saturate(1.12)
    brightness(1.08)
    drop-shadow(0 0 4px rgba(183, 76, 255, 0.25));
`;

/* Hit effect radius tier 1 (LARGE): counter grab, perfect parry, grab break, charged attack */
const HIT_RADIUS_LARGE = "clamp(2rem, 5vw, 4rem)";

/* Same structure as grab break: ring + glow both in one color so the ring reads clearly (green there, purple here) */
const ShockwaveRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${HIT_RADIUS_LARGE};
  height: ${HIT_RADIUS_LARGE};
  border-radius: 50%;
  border: 5px solid rgba(205, 115, 255, 0.98);
  box-shadow:
    0 0 16px rgba(187, 85, 255, 0.65),
    0 0 30px rgba(153, 51, 255, 0.38),
    0 0 44px rgba(120, 40, 220, 0.22);
  background: radial-gradient(
    circle,
    rgba(85, 20, 120, 0.26) 0%,
    rgba(130, 45, 190, 0.18) 44%,
    transparent 74%
  );
  transform: translate(-50%, -50%) scale(0);
  animation: ${shockwaveExpand} 0.4s ease-out forwards;
`;

// Stylized lock "X" sigil (same radius) to improve readability.
const LockGlyph = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${HIT_RADIUS_LARGE};
  height: ${HIT_RADIUS_LARGE};
  border-radius: 50%;
  background:
    linear-gradient(45deg, transparent 45%, rgba(255, 225, 245, 0.9) 49%, rgba(160, 70, 255, 0.95) 50%, rgba(255, 225, 245, 0.9) 51%, transparent 55%),
    linear-gradient(-45deg, transparent 45%, rgba(255, 225, 245, 0.9) 49%, rgba(160, 70, 255, 0.95) 50%, rgba(255, 225, 245, 0.9) 51%, transparent 55%);
  box-shadow:
    inset 0 0 10px rgba(255, 235, 250, 0.35),
    0 0 10px rgba(180, 70, 255, 0.55);
  transform: translate(-50%, -50%) scale(0.25);
  opacity: 0;
  animation: ${lockGlyphBurst} 0.35s ease-out forwards;
`;

/* Same gradient shape as grab break: white → color at 50% → transparent (red + purple) */
const InnerFlash = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(1.35rem, 3.2vw, 2.75rem);
  height: clamp(1.35rem, 3.2vw, 2.75rem);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 225, 238, 0.98) 18%,
    rgba(230, 75, 125, 0.96) 42%,
    rgba(171, 70, 255, 0.82) 70%,
    transparent 100%
  );
  transform: translate(-50%, -50%) scale(0);
  animation: ${innerFlash} 0.35s ease-out forwards;
`;

const Spark = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: ${props => props.$isRed 
    ? 'linear-gradient(45deg, #ffffff, #cc2244)' 
    : 'linear-gradient(45deg, #ffffff, #9933ff)'};
  border-radius: 50%;
  box-shadow:
    0 0 ${props => props.$size * 2.2}px ${props => props.$isRed ? 'rgba(204, 34, 68, 0.9)' : 'rgba(153, 51, 255, 0.92)'},
    0 0 ${props => props.$size * 3}px ${props => props.$isRed ? 'rgba(204, 34, 68, 0.34)' : 'rgba(153, 51, 255, 0.36)'};
  opacity: 0;
  animation: ${sparkBurst} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  --dx: ${props => props.$dx}vw;
  --dy: ${props => props.$dy}vw;
`;

/* Same as BreakText structure - one color + one glow (here: red/purple) */
const LockedText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.6vw, 1.4rem);
  color: #bb2255;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 15px rgba(204, 34, 68, 0.9),
    0 0 30px rgba(153, 51, 255, 0.7);
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${textPop} ${HIT_EFFECT_TEXT_DURATION}s ease-out forwards;
  animation-delay: ${HIT_EFFECT_TEXT_DELAY}s;
`;


const CounterGrabEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedCountersRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1600; // Longer to match side text animation

  // Generate spark particles - alternating red and purple for counter grab
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
        isRed: i % 2 === 0,
      });
    }
    
    return sparks;
  };

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedCountersRef.current.has(position.counterId)) {
      // Keep existing effect instance but update its live anchor position.
      setActiveEffects((prev) =>
        prev.map((effect) =>
          effect.counterId === position.counterId
            ? {
                ...effect,
                x: position.x,
                y: position.y,
                grabberPlayerNumber:
                  position.grabberPlayerNumber || effect.grabberPlayerNumber,
              }
            : effect
        )
      );
      return;
    }

    processedCountersRef.current.add(position.counterId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      counterId: position.counterId,
      x: position.x,
      y: position.y,
      sparks: generateSparks(),
      grabberPlayerNumber: position.grabberPlayerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      // Keep this counterId marked as processed so ongoing position updates
      // for the same event cannot re-trigger the effect in a loop.
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
              <LockGlyph />
              <InnerFlash />
              {effect.sparks.map((spark) => (
                <Spark
                  key={spark.id}
                  $size={spark.size}
                  $dx={spark.dx}
                  $dy={spark.dy}
                  $delay={spark.delay}
                  $isRed={spark.isRed}
                />
              ))}
              <LockedText>LOCKED!</LockedText>
            </EffectContainer>
            <SumoAnnouncementBanner
              text={"COUNTER\nGRAB"}
              type="countergrab"
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
    type: PropTypes.string,
    x: PropTypes.number,
    y: PropTypes.number,
    counterId: PropTypes.string,
    grabberPlayerNumber: PropTypes.number,
  }),
};

export default CounterGrabEffect;

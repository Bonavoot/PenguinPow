import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Faux-3D tilt (same as hit/parry) – ellipse shape
const SNOWBALL_TILT = "55deg";

// Snow burst explosion – with rotateY for 3D ellipse
const snowBurst = keyframes`
  0% {
    transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(0);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(1.5);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(2);
    opacity: 0;
  }
`;

const snowflakeScatter = keyframes`
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.3);
  }
`;

const frostRing = keyframes`
  0% {
    transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(0.3);
    opacity: 1;
    border-width: 4px;
  }
  100% {
    transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(2.5);
    opacity: 0;
    border-width: 1px;
  }
`;

const EffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + (props.$facing === 1 ? -1 : -6)}%;
  bottom: ${props => (props.$y / 720) * 100 + 15}%;
  transform: translate(-50%, -50%);
  z-index: 120;
  pointer-events: none;
  contain: layout style;
  --snowball-ring-tilt: ${SNOWBALL_TILT};
`;

const SnowBurst = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(40px, 5vw, 60px);
  height: clamp(40px, 5vw, 60px);
  background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(200, 230, 255, 0.8) 40%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(0);
  animation: ${snowBurst} 0.35s ease-out forwards;
`;

const FrostRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(50px, 6vw, 75px);
  height: clamp(50px, 6vw, 75px);
  border: 3px solid rgba(135, 206, 250, 0.9);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateY(var(--snowball-ring-tilt, 55deg)) scale(0.3);
  animation: ${frostRing} 0.4s ease-out forwards;
`;

const Snowflake = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: radial-gradient(circle, rgba(255, 255, 255, 1) 30%, rgba(200, 230, 255, 0.8) 100%);
  border-radius: 50%;
  opacity: 0;
  animation: ${snowflakeScatter} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  --dx: ${props => props.$dx}vw;
  --dy: ${props => props.$dy}vw;
`;

const SnowballImpactEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 450;

  // Generate snowflake particles - reduced count for performance
  const generateSnowflakes = () => {
    const flakes = [];
    const count = 5; // Reduced from 10
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360;
      const radians = angle * (Math.PI / 180);
      const distance = 2.5 + Math.random() * 1.5;
      
      flakes.push({
        id: i,
        size: 4 + Math.random() * 6,
        dx: Math.cos(radians) * distance,
        dy: Math.sin(radians) * distance,
        delay: i * 0.02,
      });
    }
    
    return flakes;
  };

  useEffect(() => {
    if (!position || !position.hitId) return;

    if (processedHitsRef.current.has(position.hitId)) {
      return;
    }

    processedHitsRef.current.add(position.hitId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing ?? 1,
      snowflakes: generateSnowflakes(),
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedHitsRef.current.delete(position.hitId);
    }, EFFECT_DURATION);
  }, [position?.hitId, position?.x, position?.y, position?.facing]);

  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => (
        <EffectContainer key={effect.id} $x={effect.x} $y={effect.y} $facing={effect.facing}>
          <FrostRing />
          <SnowBurst />
          {effect.snowflakes.map((flake) => (
            <Snowflake
              key={flake.id}
              $size={flake.size}
              $dx={flake.dx}
              $dy={flake.dy}
              $delay={flake.delay}
            />
          ))}
        </EffectContainer>
      ))}
    </>
  );
};

SnowballImpactEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
    hitId: PropTypes.string,
  }),
};

export default SnowballImpactEffect;

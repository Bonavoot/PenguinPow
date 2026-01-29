import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const EFFECT_DURATION = 700; // ms

// Dust burst spreading outward - like stomping on the dohyo
const dustBurst = keyframes`
  0% {
    transform: translate(-50%, 0) scaleX(0.3) scaleY(1);
    opacity: 0.9;
  }
  30% {
    transform: translate(-50%, 0) scaleX(2) scaleY(0.7);
    opacity: 0.8;
  }
  60% {
    transform: translate(-50%, 0) scaleX(3) scaleY(0.4);
    opacity: 0.5;
  }
  100% {
    transform: translate(-50%, 0) scaleX(4) scaleY(0.15);
    opacity: 0;
  }
`;

// Ring expanding
const ringExpand = keyframes`
  0% {
    transform: translate(-50%, 0) scale(0.3);
    opacity: 1;
    border-width: 3px;
  }
  40% {
    transform: translate(-50%, 0) scale(1.8);
    opacity: 0.8;
    border-width: 2px;
  }
  100% {
    transform: translate(-50%, 0) scale(3.5);
    opacity: 0;
    border-width: 1px;
  }
`;

// Particle flying outward
const dustParticle = keyframes`
  0% {
    transform: translate(-50%, 0) scale(0.8);
    opacity: 1;
  }
  40% {
    transform: translate(calc(-50% + var(--dust-x) * 0.5), calc(var(--dust-y) * 0.5)) scale(1);
    opacity: 0.9;
  }
  100% {
    transform: translate(calc(-50% + var(--dust-x)), var(--dust-y)) scale(0.4);
    opacity: 0;
  }
`;

// Impact flash
const impactFlash = keyframes`
  0% {
    transform: translate(-50%, 0) scale(0);
    opacity: 1;
  }
  25% {
    transform: translate(-50%, 0) scale(1.3);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, 0) scale(1.5);
    opacity: 0.7;
  }
  100% {
    transform: translate(-50%, 0) scale(1.8);
    opacity: 0;
  }
`;

// Ground line spreading
const lineSpread = keyframes`
  0% {
    transform: translate(-50%, 0) rotate(var(--line-angle)) scaleX(0);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, 0) rotate(var(--line-angle)) scaleX(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, 0) rotate(var(--line-angle)) scaleX(1.2);
    opacity: 0;
  }
`;

// Container positioned at player's feet
const EffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `calc(${(props.$x / 1280) * 100}% + 8%)`,
    bottom: `calc(${(props.$y / 720) * 100}% + 0.5%)`,
    pointerEvents: "none",
    zIndex: 90,
  },
}))``;

// Golden-cyan impact flash - ties both colors together
const ImpactFlash = styled.div`
  position: absolute;
  width: clamp(3.5rem, 9vw, 9rem);
  height: clamp(1.8rem, 4.5vw, 4.5rem);
  background: radial-gradient(
    ellipse 100% 100%,
    rgba(255, 255, 255, 1) 0%,
    rgba(200, 255, 255, 0.9) 25%,
    rgba(255, 230, 150, 0.7) 50%,
    rgba(255, 200, 80, 0.4) 70%,
    transparent 100%
  );
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  animation: ${impactFlash} 0.25s ease-out forwards;
`;

// Dohyo dust cloud - tan/golden
const DustCloud = styled.div`
  position: absolute;
  width: clamp(2.5rem, 6vw, 6rem);
  height: clamp(1rem, 2.5vw, 2.5rem);
  background: radial-gradient(
    ellipse 100% 80%,
    rgba(255, 235, 180, 0.85) 0%,
    rgba(230, 200, 140, 0.5) 50%,
    rgba(200, 170, 120, 0.2) 80%,
    transparent 100%
  );
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  animation: ${dustBurst} 0.55s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
`;

// Cyan shockwave ring - matches the parry hit effect
const CyanRing = styled.div`
  position: absolute;
  width: clamp(2.5rem, 6vw, 6rem);
  height: clamp(1rem, 2.5vw, 2.5rem);
  border: 2px solid rgba(0, 220, 255, 0.85);
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  animation: ${ringExpand} 0.45s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
`;

// Golden ring - for the "PERFECT" color
const GoldenRing = styled.div`
  position: absolute;
  width: clamp(3rem, 7vw, 7rem);
  height: clamp(1.2rem, 3vw, 3rem);
  border: 2px solid rgba(255, 215, 0, 0.9);
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  animation: ${ringExpand} 0.5s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
`;

// Impact line - golden with cyan core
const ImpactLine = styled.div`
  position: absolute;
  width: clamp(3rem, 7vw, 7rem);
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 220, 120, 0.8) 15%,
    rgba(150, 255, 255, 1) 50%,
    rgba(255, 220, 120, 0.8) 85%,
    transparent 100%
  );
  left: 50%;
  bottom: 0;
  transform-origin: center;
  --line-angle: ${props => props.$angle || 0}deg;
  animation: ${lineSpread} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
`;

// Sand/dust particle - warm tones
const DustParticle = styled.div`
  position: absolute;
  width: clamp(0.4rem, 0.8vw, 0.8rem);
  height: clamp(0.4rem, 0.8vw, 0.8rem);
  background: radial-gradient(
    circle,
    rgba(255, 240, 200, 1) 0%,
    rgba(230, 210, 160, 0.8) 60%,
    rgba(200, 180, 140, 0.4) 100%
  );
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  --dust-x: ${props => props.$endX || '0vw'};
  --dust-y: ${props => props.$endY || '0vw'};
  animation: ${dustParticle} 0.45s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
`;

// Cyan spark - matches parry hit effect energy
const CyanSpark = styled.div`
  position: absolute;
  width: clamp(0.3rem, 0.55vw, 0.55rem);
  height: clamp(0.3rem, 0.55vw, 0.55rem);
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(0, 255, 255, 1) 50%,
    rgba(0, 191, 255, 0.6) 100%
  );
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  --dust-x: ${props => props.$endX || '0vw'};
  --dust-y: ${props => props.$endY || '0vw'};
  animation: ${dustParticle} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
  box-shadow: 0 0 4px rgba(0, 220, 255, 0.9);
`;

// Golden spark - matches "PERFECT" text
const GoldenSpark = styled.div`
  position: absolute;
  width: clamp(0.25rem, 0.5vw, 0.5rem);
  height: clamp(0.25rem, 0.5vw, 0.5rem);
  background: radial-gradient(
    circle,
    rgba(255, 255, 220, 1) 0%,
    rgba(255, 215, 0, 1) 50%,
    rgba(255, 180, 0, 0.6) 100%
  );
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  --dust-x: ${props => props.$endX || '0vw'};
  --dust-y: ${props => props.$endY || '0vw'};
  animation: ${dustParticle} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay || 0}ms;
  box-shadow: 0 0 3px rgba(255, 215, 0, 0.8);
`;

const PerfectParryPowerEffect = ({ x, y, isPerfectParrySuccess }) => {
  const [effectInstances, setEffectInstances] = useState([]);
  const lastPerfectParryState = useRef(false);

  useEffect(() => {
    if (isPerfectParrySuccess && !lastPerfectParryState.current) {
      const newInstance = {
        x,
        y,
        key: Date.now() + Math.random(),
      };
      setEffectInstances(prev => [...prev, newInstance]);
    }
    lastPerfectParryState.current = isPerfectParrySuccess;
  }, [isPerfectParrySuccess, x, y]);

  useEffect(() => {
    if (effectInstances.length === 0) return;
    
    const timeout = setTimeout(() => {
      setEffectInstances(prev => prev.slice(1));
    }, EFFECT_DURATION);
    
    return () => clearTimeout(timeout);
  }, [effectInstances]);

  if (effectInstances.length === 0) return null;

  return (
    <>
      {effectInstances.map((effect) => (
        <EffectContainer key={effect.key} $x={effect.x} $y={effect.y}>
          {/* Central flash - blends cyan and gold */}
          <ImpactFlash />
          
          {/* Dust clouds spreading - dohyo sand */}
          <DustCloud $delay={0} />
          <DustCloud $delay={30} />
          <DustCloud $delay={60} />
          
          {/* Cyan rings - matches parry hit effect */}
          <CyanRing $delay={0} />
          <CyanRing $delay={60} />
          
          {/* Golden rings - matches "PERFECT" text */}
          <GoldenRing $delay={30} />
          <GoldenRing $delay={90} />
          
          {/* Impact lines radiating - golden edges, cyan center */}
          <ImpactLine $angle={0} $delay={0} />
          <ImpactLine $angle={25} $delay={15} />
          <ImpactLine $angle={-25} $delay={15} />
          <ImpactLine $angle={50} $delay={30} />
          <ImpactLine $angle={-50} $delay={30} />
          
          {/* Dust particles - sand kicked up */}
          <DustParticle $endX="-4vw" $endY="-0.8vw" $delay={0} />
          <DustParticle $endX="-2.5vw" $endY="-1.2vw" $delay={20} />
          <DustParticle $endX="4vw" $endY="-0.8vw" $delay={0} />
          <DustParticle $endX="2.5vw" $endY="-1.2vw" $delay={20} />
          
          {/* Cyan sparks - energy from parry */}
          <CyanSpark $endX="-3.5vw" $endY="-1.5vw" $delay={10} />
          <CyanSpark $endX="3.5vw" $endY="-1.5vw" $delay={10} />
          <CyanSpark $endX="0vw" $endY="-2vw" $delay={5} />
          
          {/* Golden sparks - "PERFECT" accent */}
          <GoldenSpark $endX="-2vw" $endY="-1.8vw" $delay={25} />
          <GoldenSpark $endX="2vw" $endY="-1.8vw" $delay={25} />
          <GoldenSpark $endX="-3vw" $endY="-1vw" $delay={35} />
          <GoldenSpark $endX="3vw" $endY="-1vw" $delay={35} />
        </EffectContainer>
      ))}
    </>
  );
};

PerfectParryPowerEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isPerfectParrySuccess: PropTypes.bool.isRequired,
};

export default PerfectParryPowerEffect;

import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const EFFECT_DURATION = 550; // ms

// Central flash - bigger, brighter, with brief hold at peak
const impactFlash = keyframes`
  0% {
    transform: translate(-50%, 0) scale(0);
    opacity: 1;
  }
  20% {
    transform: translate(-50%, 0) scale(1.3);
    opacity: 1;
  }
  45% {
    transform: translate(-50%, 0) scale(1.2);
    opacity: 0.9;
  }
  100% {
    transform: translate(-50%, 0) scale(1.5);
    opacity: 0;
  }
`;

// Primary ring expand - snappy
const ringExpandPrimary = keyframes`
  0% {
    transform: translate(-50%, 0) scale(0.2);
    opacity: 1;
    border-width: 2px;
  }
  40% {
    opacity: 0.85;
    border-width: 1.5px;
  }
  100% {
    transform: translate(-50%, 0) scale(2.6);
    opacity: 0;
    border-width: 0.5px;
  }
`;

// Secondary ring - delayed, expands further
const ringExpandSecondary = keyframes`
  0% {
    transform: translate(-50%, 0) scale(0.1);
    opacity: 0.7;
    border-width: 1.5px;
  }
  100% {
    transform: translate(-50%, 0) scale(3);
    opacity: 0;
    border-width: 0.5px;
  }
`;

// Ground sparks burst outward along ground plane
const groundSparkBurst = keyframes`
  0% {
    opacity: 1;
    transform: translate(-50%, 0) scale(0.8);
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--gx)), var(--gy)) scale(0.3);
  }
`;

// Container positioned at player's feet
const EffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `calc(${(props.$x / 1280) * 100}% + 2%)`,
    bottom: `calc(${(props.$y / 720) * 100}% + 0.5%)`,
    pointerEvents: "none",
    zIndex: 90,
  },
}))``;

// Central flash - noticeable but not oversized (yellow for perfect parry)
const ImpactFlash = styled.div`
  position: absolute;
  width: 5.25cqw;
  height: 2.66cqw;
  background: radial-gradient(
    ellipse 100% 100%,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 245, 200, 0.6) 35%,
    rgba(255, 220, 80, 0.35) 60%,
    transparent 80%
  );
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  will-change: transform, opacity;
  animation: ${impactFlash} 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
`;

// Primary shockwave ring (blue/cyan to match RawParryEffect)
const ShockwaveRingPrimary = styled.div`
  position: absolute;
  width: 4.63cqw;
  height: 1.85cqw;
  border: 2px solid rgba(0, 200, 255, 0.95);
  box-shadow: 0 0 5px rgba(0, 220, 255, 0.3);
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  will-change: transform, opacity;
  animation: ${ringExpandPrimary} 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
`;

// Secondary shockwave ring - delayed for layered depth (blue/cyan)
const ShockwaveRingSecondary = styled.div`
  position: absolute;
  width: 4.32cqw;
  height: 1.72cqw;
  border: 1.5px solid rgba(100, 220, 255, 0.8);
  border-radius: 50%;
  left: 50%;
  bottom: 0;
  will-change: transform, opacity;
  animation: ${ringExpandSecondary} 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.06s forwards;
  opacity: 0;
`;

// Ground sparks - small dots that burst outward along the ground plane (yellow)
const GroundSpark = styled.div`
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 0.21cqw;
  height: 0.21cqw;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(255, 220, 80, 0.7));
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(255, 215, 100, 0.5);
  opacity: 0;
  will-change: transform, opacity;
  animation: ${groundSparkBurst} 0.3s ease-out ${props => props.$delay || 0}s forwards;
  --gx: ${props => props.$gx};
  --gy: ${props => props.$gy};
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
          <ImpactFlash />
          {/* Ground sparks burst outward in different directions */}
          <GroundSpark $gx="-2.96cqw" $gy="-0.59cqw" $delay={0} />
          <GroundSpark $gx="2.96cqw" $gy="-0.59cqw" $delay={0.02} />
          <GroundSpark $gx="-4.44cqw" $gy="-0.22cqw" $delay={0.04} />
          <GroundSpark $gx="4.44cqw" $gy="-0.22cqw" $delay={0.03} />
          <GroundSpark $gx="-1.48cqw" $gy="-1.11cqw" $delay={0.01} />
          <GroundSpark $gx="1.48cqw" $gy="-1.11cqw" $delay={0.025} />
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

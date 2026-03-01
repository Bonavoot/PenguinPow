import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import { HIT_EFFECT_TEXT_DURATION, HIT_EFFECT_TEXT_DELAY } from "../config/hitEffectText";

// Ring contracts inward — starts large, slams to center, overshoots, settles
const ringContract = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(2.8);
    opacity: 0;
    border-width: 0.16cqw;
  }
  25% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
    border-width: 0.35cqw;
  }
  40% {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 1;
    border-width: 0.42cqw;
  }
  55% {
    transform: translate(-50%, -50%) scale(1.05);
    opacity: 0.9;
    border-width: 0.25cqw;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 0;
    border-width: 0.08cqw;
  }
`;

// Cage bars contract inward in sync with the ring
const barContract = keyframes`
  0% {
    transform: translate(-50%, -50%) rotate(var(--bar-angle)) scaleX(2.2);
    opacity: 0;
  }
  25% {
    transform: translate(-50%, -50%) rotate(var(--bar-angle)) scaleX(1);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) rotate(var(--bar-angle)) scaleX(0.88);
    opacity: 1;
  }
  55% {
    transform: translate(-50%, -50%) rotate(var(--bar-angle)) scaleX(1);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--bar-angle)) scaleX(1);
    opacity: 0;
  }
`;

// Heavy center flash at the lock-in moment
const lockFlash = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  15% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 1;
  }
  35% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(0.4);
    opacity: 0;
  }
`;

// Compression pulse — outward ripple after the cage shuts
const compressionPulse = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 0;
  }
  25% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.2);
    opacity: 0;
  }
`;

// Impact sparks scatter after the lock-in shockwave
const impactSparkBurst = keyframes`
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--spark-dx)), calc(-50% + var(--spark-dy))) scale(0.3);
  }
`;

// LOCKED! text — fast heavy slam with settle
const lockedTextSlam = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  12% {
    transform: translate(-50%, -50%) scale(1.35);
    opacity: 1;
  }
  22% {
    transform: translate(-50%, -50%) scale(0.92);
    opacity: 1;
  }
  30% {
    transform: translate(-50%, -50%) scale(1.05);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) scale(1);
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
const EFFECT_CENTER_OFFSET_X = 0;

const EffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + EFFECT_CENTER_OFFSET_X}%;
  bottom: ${props => (props.$y / 720) * 100 + EFFECT_TEXT_BASELINE_OFFSET_Y}%;
  width: 5.18cqw;
  height: 4.82cqw;
  transform: translate(-50%, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 170;
  pointer-events: none;
  contain: layout style;
  filter:
    saturate(1.15)
    brightness(1.1)
    drop-shadow(0 0 5px rgba(255, 50, 120, 0.3));
`;

const CAGE_RADIUS = "2.5cqw";

const ContractingRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${CAGE_RADIUS};
  height: ${CAGE_RADIUS};
  border-radius: 50%;
  border: 0.24cqw solid rgba(255, 60, 140, 0.95);
  box-shadow:
    0 0 0.5cqw rgba(200, 40, 120, 0.6),
    0 0 1cqw rgba(150, 40, 220, 0.3);
  transform: translate(-50%, -50%) scale(2.8);
  opacity: 0;
  animation: ${ringContract} 0.45s ease-out forwards;
`;

const LockBar = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5.0cqw;
  height: 0.18cqw;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 60, 140, 0.8) 10%,
    rgba(255, 180, 220, 1) 35%,
    rgba(255, 255, 255, 1) 50%,
    rgba(255, 180, 220, 1) 65%,
    rgba(255, 60, 140, 0.8) 90%,
    transparent 100%
  );
  transform-origin: center;
  --bar-angle: ${props => props.$angle}deg;
  transform: translate(-50%, -50%) rotate(var(--bar-angle)) scaleX(2.2);
  opacity: 0;
  animation: ${barContract} 0.45s ease-out forwards;
  box-shadow:
    0 0 0.25cqw rgba(255, 50, 120, 0.6),
    0 0 0.6cqw rgba(150, 40, 220, 0.25);
`;

const LockFlashCore = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.0cqw;
  height: 2.0cqw;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 200, 230, 1) 18%,
    rgba(255, 70, 140, 0.95) 42%,
    rgba(170, 50, 240, 0.7) 65%,
    transparent 100%
  );
  transform: translate(-50%, -50%) scale(0);
  animation: ${lockFlash} 0.35s ease-out 0.08s forwards;
`;

const CompressionPulseRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${CAGE_RADIUS};
  height: ${CAGE_RADIUS};
  border-radius: 50%;
  border: 0.16cqw solid rgba(255, 100, 170, 0.85);
  box-shadow:
    0 0 0.35cqw rgba(255, 60, 140, 0.45);
  transform: translate(-50%, -50%) scale(0.5);
  opacity: 0;
  animation: ${compressionPulse} 0.4s ease-out 0.12s forwards;
`;

const ImpactSpark = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${props => (props.$size * 0.08).toFixed(2)}cqw;
  height: ${props => (props.$size * 0.08).toFixed(2)}cqw;
  background: ${props => props.$isRed
    ? 'linear-gradient(45deg, #ffffff, #cc2244)'
    : 'linear-gradient(45deg, #ffffff, #9933ff)'};
  border-radius: 50%;
  box-shadow:
    0 0 ${props => (props.$size * 0.16).toFixed(2)}cqw ${props => props.$isRed ? 'rgba(204, 34, 68, 0.85)' : 'rgba(153, 51, 255, 0.85)'};
  opacity: 0;
  animation: ${impactSparkBurst} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  --spark-dx: ${props => props.$dx}cqw;
  --spark-dy: ${props => props.$dy}cqw;
`;

const LockedText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: 1.02cqw;
  color: #ff3370;
  -webkit-text-stroke: 2.5px #000;
  paint-order: stroke fill;
  text-shadow:
    -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000,
    0 0 14px rgba(255, 50, 110, 0.9),
    0 0 28px rgba(160, 40, 255, 0.6);
  z-index: 20;
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${lockedTextSlam} ${HIT_EFFECT_TEXT_DURATION}s ease-out forwards;
  animation-delay: ${HIT_EFFECT_TEXT_DELAY}s;
`;

const BAR_ANGLES = [0, 45, 90, 135];

const CounterGrabEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedCountersRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  const EFFECT_DURATION = 1600;

  const generateSparks = () => {
    const sparks = [];
    const sparkCount = 6;

    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * 360 + (Math.random() * 20 - 10);
      const radians = angle * (Math.PI / 180);
      const distance = 3.5 + Math.random() * 2.5;

      sparks.push({
        id: i,
        size: 4 + Math.random() * 4,
        dx: Math.cos(radians) * distance,
        dy: Math.sin(radians) * distance,
        delay: 0.12 + i * 0.018,
        isRed: i % 2 === 0,
      });
    }

    return sparks;
  };

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedCountersRef.current.has(position.counterId)) {
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

    const tid = setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
    }, EFFECT_DURATION);
    pendingTimeouts.current.push(tid);
  }, [position?.counterId, position?.x, position?.y, position?.grabberPlayerNumber]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      processedCountersRef.current.clear();
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const isLeftSide = effect.grabberPlayerNumber === 1;

        return (
          <div key={effect.id}>
            <EffectContainer $x={effect.x} $y={effect.y}>
              <ContractingRing />
              {BAR_ANGLES.map((angle) => (
                <LockBar key={angle} $angle={angle} />
              ))}
              <LockFlashCore />
              <CompressionPulseRing />
              {effect.sparks.map((spark) => (
                <ImpactSpark
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
            {document.getElementById('game-hud') && createPortal(
              <SumoAnnouncementBanner
                text={"COUNTER\nGRAB"}
                type="countergrab"
                isLeftSide={isLeftSide}
              />,
              document.getElementById('game-hud')
            )}
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

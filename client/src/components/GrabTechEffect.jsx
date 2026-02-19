import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import { HIT_EFFECT_TEXT_DURATION, HIT_EFFECT_TEXT_DELAY } from "../config/hitEffectText";

// Main ring expands with 3D tilt toward the grabber
const mainRingExpand = keyframes`
  0% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0.2);
    opacity: 1;
    border-width: clamp(3px, 0.24vw, 6px);
  }
  25% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(1.1);
    opacity: 1;
    border-width: clamp(2.5px, 0.2vw, 5px);
  }
  100% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(2.3);
    opacity: 0;
    border-width: clamp(0.5px, 0.04vw, 1px);
  }
`;

// Secondary outer ring for layered depth
const outerRingExpand = keyframes`
  0% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0.3);
    opacity: 0.9;
  }
  100% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(2.6);
    opacity: 0;
  }
`;

// Inner burst — bright flash with tilt
const innerBurstAnim = keyframes`
  0% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0);
    opacity: 1;
  }
  18% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(1.15);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(1.15);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(2.1);
    opacity: 0;
  }
`;

// Impact star — cross/lines with slight rotation for spiral feel
const impactStarAnim = keyframes`
  0% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0) rotate(0deg);
    opacity: 1;
  }
  25% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(1) rotate(12deg);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(2) rotate(22deg);
    opacity: 0;
  }
`;

// Sparks burst outward with brief stretch for motion-streak feel
const sparkExplode = keyframes`
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  20% {
    opacity: 1;
    transform: translate(calc(-50% + var(--spark-dx) * 0.3), calc(-50% + var(--spark-dy) * 0.3)) scale(1.1);
  }
  50% {
    opacity: 0.85;
    transform: translate(calc(-50% + var(--spark-dx) * 0.65), calc(-50% + var(--spark-dy) * 0.65)) scale(0.85);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--spark-dx)), calc(-50% + var(--spark-dy))) scale(0.3);
  }
`;

// TECH! text — clean snappy pop
const techTextPop = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  18% {
    transform: translate(-50%, -50%) scale(1.25);
    opacity: 1;
  }
  35% {
    transform: translate(-50%, -50%) scale(0.95);
    opacity: 1;
  }
  50% {
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
  width: clamp(3.11rem, 7.78vw, 6.22rem);
  height: clamp(2.89rem, 7.26vw, 5.78rem);
  transform: translate(-50%, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 170;
  pointer-events: none;
  contain: layout style;
`;

const RingWrapper = styled.div`
  position: relative;
  width: clamp(1.67rem, 4.19vw, 3.22rem);
  height: clamp(1.67rem, 4.19vw, 3.22rem);
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
  filter:
    brightness(1.2)
    saturate(1.3)
    contrast(1.1)
    drop-shadow(0 0 10px rgba(80, 190, 255, 0.6))
    drop-shadow(0 0 20px rgba(60, 160, 255, 0.35));
`;

const MainRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border: clamp(3.5px, 0.28vw, 7px) solid rgba(120, 215, 255, 0.98);
  border-radius: 50%;
  box-shadow: 0 0 clamp(4px, 0.3vw, 8px) rgba(80, 190, 255, 0.5);
  transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0.2);
  animation: ${mainRingExpand} 0.4s ease-out forwards;
`;

const SecondaryRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border: clamp(2px, 0.16vw, 3.5px) solid rgba(130, 225, 255, 0.85);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0.3);
  animation: ${outerRingExpand} 0.45s ease-out 0.03s forwards;
`;

const InnerBurst = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 70%;
  height: 70%;
  background: radial-gradient(circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 255, 255, 0.98) 8%,
    rgba(200, 240, 255, 0.95) 16%,
    rgba(100, 210, 255, 0.88) 28%,
    rgba(80, 190, 255, 0.55) 42%,
    rgba(60, 170, 255, 0.25) 58%,
    transparent 75%);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0);
  animation: ${innerBurstAnim} 0.32s ease-out forwards;
`;

const ImpactStar = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background:
    linear-gradient(0deg, transparent 43%, rgba(100, 220, 255, 0.55) 47%, rgba(255, 255, 255, 0.95) 50%, rgba(100, 220, 255, 0.55) 53%, transparent 57%),
    linear-gradient(90deg, transparent 43%, rgba(100, 220, 255, 0.55) 47%, rgba(255, 255, 255, 0.95) 50%, rgba(100, 220, 255, 0.55) 53%, transparent 57%),
    linear-gradient(45deg, transparent 43%, rgba(100, 220, 255, 0.45) 47%, rgba(255, 255, 255, 0.9) 50%, rgba(100, 220, 255, 0.45) 53%, transparent 57%),
    linear-gradient(-45deg, transparent 43%, rgba(100, 220, 255, 0.45) 47%, rgba(255, 255, 255, 0.9) 50%, rgba(100, 220, 255, 0.45) 53%, transparent 57%);
  transform: translate(-50%, -50%) rotateY(var(--tech-tilt)) scale(0);
  animation: ${impactStarAnim} 0.32s ease-out forwards;
  z-index: 11;
`;

const Spark = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(${props => props.$size}px, ${props => (props.$size * 0.08).toFixed(2)}vw, ${props => props.$size * 2}px);
  height: clamp(${props => props.$size}px, ${props => (props.$size * 0.08).toFixed(2)}vw, ${props => props.$size * 2}px);
  background: linear-gradient(45deg, #ffffff, #64c8ff);
  border-radius: 50%;
  box-shadow:
    0 0 clamp(4px, 0.3vw, 7px) rgba(80, 180, 255, 0.85),
    0 0 clamp(8px, 0.6vw, 14px) rgba(60, 160, 255, 0.4);
  opacity: 0;
  animation: ${sparkExplode} 0.38s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  --spark-dx: ${props => props.$dx}vw;
  --spark-dy: ${props => props.$dy}vw;
`;

const TechText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: clamp(0.52rem, 1.19vw, 1.04rem);
  color: #64c8ff;
  -webkit-text-stroke: 2.5px #000;
  paint-order: stroke fill;
  text-shadow:
    -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000,
    0 0 15px rgba(80, 180, 255, 0.9);
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${techTextPop} ${HIT_EFFECT_TEXT_DURATION}s ease-out forwards;
  animation-delay: ${HIT_EFFECT_TEXT_DELAY}s;
  z-index: 20;
`;

const GrabTechEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedTechsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1600;

  const generateSparks = () => {
    const sparks = [];
    const sparkCount = 8;

    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * 360;
      const radians = angle * (Math.PI / 180);
      const distance = 1.2 + Math.random() * 0.5;

      sparks.push({
        id: i,
        size: 3 + Math.random() * 3,
        dx: Math.cos(radians) * distance,
        dy: Math.sin(radians) * distance,
        delay: i * 0.015,
      });
    }

    return sparks;
  };

  useEffect(() => {
    if (!position || !position.techId) return;

    if (processedTechsRef.current.has(position.techId)) {
      return;
    }

    processedTechsRef.current.add(position.techId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      sparks: generateSparks(),
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedTechsRef.current.delete(position.techId);
    }, EFFECT_DURATION);
  }, [position?.techId, position?.x, position?.y, position?.facing]);

  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const techTiltSigned = effect.facing === -1 ? "55deg" : "-55deg";

        return (
          <div key={effect.id}>
            <EffectContainer $x={effect.x} $y={effect.y}>
              <RingWrapper style={{ '--tech-tilt': techTiltSigned }}>
                <MainRing />
                <SecondaryRing />
                <InnerBurst />
                <ImpactStar />
                {effect.sparks.map((spark) => (
                  <Spark
                    key={spark.id}
                    $size={spark.size}
                    $dx={spark.dx}
                    $dy={spark.dy}
                    $delay={spark.delay}
                  />
                ))}
              </RingWrapper>
              <TechText>TECH!</TechText>
            </EffectContainer>
            {document.getElementById('game-hud') && createPortal(
              <SumoAnnouncementBanner
                text={"GRAB\nTECH"}
                type="tech"
                isLeftSide={true}
              />,
              document.getElementById('game-hud')
            )}
          </div>
        );
      })}
    </>
  );
};

GrabTechEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    techId: PropTypes.string,
    facing: PropTypes.number,
  }),
};

export default GrabTechEffect;

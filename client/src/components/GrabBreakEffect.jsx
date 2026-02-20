import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import { HIT_EFFECT_TEXT_DURATION, HIT_EFFECT_TEXT_DELAY } from "../config/hitEffectText";

// Sharp central flash — violent and brief, like a point of fracture
const impactFlash = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  18% {
    transform: translate(-50%, -50%) scale(1.6);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(0.7);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) scale(0.2);
    opacity: 0;
  }
`;

// Crack lines radiate outward from center like fractures propagating
const crackGrow = keyframes`
  0% {
    transform: translate(-50%, -50%) rotate(var(--crack-angle)) scaleX(0);
    opacity: 1;
  }
  25% {
    transform: translate(-50%, -50%) rotate(var(--crack-angle)) scaleX(1);
    opacity: 1;
  }
  55% {
    transform: translate(-50%, -50%) rotate(var(--crack-angle)) scaleX(1.2);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--crack-angle)) scaleX(1.45);
    opacity: 0;
  }
`;

// Angular shards explode outward with rotation
const shardExplode = keyframes`
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--shard-dx)), calc(-50% + var(--shard-dy))) scale(0.35) rotate(var(--shard-spin));
  }
`;

// BREAK! text slams in with micro-shake on impact
const breakTextSlam = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  15% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 1;
  }
  24% {
    transform: translate(-51.5%, -48.5%) scale(1.05);
  }
  33% {
    transform: translate(-48.5%, -51.5%) scale(1.08);
  }
  42% {
    transform: translate(-50.5%, -49.5%) scale(1.02);
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
    saturate(1.12)
    brightness(1.08)
    drop-shadow(0 0 6px rgba(0, 255, 136, 0.35));
`;

const ImpactPoint = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1.83cqw;
  height: 1.83cqw;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(200, 255, 225, 0.95) 30%,
    rgba(0, 255, 136, 0.85) 58%,
    transparent 100%
  );
  transform: translate(-50%, -50%) scale(0);
  animation: ${impactFlash} 0.32s ease-out forwards;
`;

const CrackLine = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5.0cqw;
  height: 0.15cqw;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 255, 136, 0.75) 10%,
    rgba(255, 255, 255, 0.98) 35%,
    rgba(255, 255, 255, 0.98) 65%,
    rgba(0, 255, 136, 0.75) 90%,
    transparent 100%
  );
  transform-origin: center;
  --crack-angle: ${props => props.$angle}deg;
  transform: translate(-50%, -50%) rotate(var(--crack-angle)) scaleX(0);
  animation: ${crackGrow} 0.4s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  box-shadow:
    0 0 0.35cqw rgba(0, 255, 136, 0.7),
    0 0 0.8cqw rgba(0, 255, 136, 0.3);
`;

const SHARD_SHAPES = [
  "50% 0%, 8% 100%, 92% 85%",
  "15% 0%, 100% 5%, 85% 100%, 0% 80%",
  "50% 0%, 100% 55%, 65% 100%, 0% 70%",
  "25% 0%, 100% 15%, 90% 100%, 5% 85%",
  "0% 25%, 75% 0%, 100% 65%, 35% 100%",
  "40% 0%, 100% 30%, 60% 100%, 0% 70%",
  "10% 0%, 90% 10%, 100% 90%, 0% 100%",
];

const Shard = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: ${props => (props.$w * 0.08).toFixed(2)}cqw;
  height: ${props => (props.$h * 0.08).toFixed(2)}cqw;
  background: linear-gradient(${props => props.$gradAngle}deg, #ffffff, #00ff88);
  clip-path: polygon(${props => props.$shape});
  filter: drop-shadow(0 0 0.3cqw rgba(0, 255, 136, 0.8));
  opacity: 0;
  animation: ${shardExplode} 0.5s ease-out forwards;
  animation-delay: ${props => props.$delay}s;
  --shard-dx: ${props => props.$dx}cqw;
  --shard-dy: ${props => props.$dy}cqw;
  --shard-spin: ${props => props.$spin}deg;
`;

const BreakText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: 0.86cqw;
  color: #00ff88;
  -webkit-text-stroke: 2.5px #000;
  paint-order: stroke fill;
  text-shadow:
    -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000,
    0 0 15px rgba(0, 255, 136, 0.9);
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${breakTextSlam} ${HIT_EFFECT_TEXT_DURATION}s ease-out forwards;
  animation-delay: ${HIT_EFFECT_TEXT_DELAY}s;
`;

const CRACK_BASE_ANGLES = [5, 62, 118, 155, -28, -75];

const GrabBreakEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedBreaksRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1600;

  const generateShards = () => {
    const shards = [];
    const shardCount = 7;

    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * 360 + (Math.random() * 25 - 12.5);
      const radians = angle * (Math.PI / 180);
      const distance = 4.5 + Math.random() * 2.5;

      shards.push({
        id: i,
        w: 6 + Math.random() * 5,
        h: 5 + Math.random() * 5,
        dx: Math.cos(radians) * distance,
        dy: Math.sin(radians) * distance,
        spin: 90 + Math.random() * 270,
        gradAngle: Math.floor(Math.random() * 360),
        delay: i * 0.018 + Math.random() * 0.02,
        shape: SHARD_SHAPES[i % SHARD_SHAPES.length],
      });
    }

    return shards;
  };

  const generateCracks = () => {
    return CRACK_BASE_ANGLES.map((base, i) => ({
      id: i,
      angle: base + (Math.random() * 12 - 6),
      delay: i * 0.022,
    }));
  };

  useEffect(() => {
    if (!position || !position.breakId) return;

    if (processedBreaksRef.current.has(position.breakId)) {
      return;
    }

    processedBreaksRef.current.add(position.breakId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      shards: generateShards(),
      cracks: generateCracks(),
      breakerPlayerNumber: position.breakerPlayerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedBreaksRef.current.delete(position.breakId);
    }, EFFECT_DURATION);
  }, [position?.breakId, position?.x, position?.y, position?.breakerPlayerNumber]);

  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const isLeftSide = effect.breakerPlayerNumber === 1;

        return (
          <div key={effect.id}>
            <EffectContainer $x={effect.x} $y={effect.y}>
              <ImpactPoint />
              {effect.cracks.map((crack) => (
                <CrackLine
                  key={crack.id}
                  $angle={crack.angle}
                  $delay={crack.delay}
                />
              ))}
              {effect.shards.map((shard) => (
                <Shard
                  key={shard.id}
                  $w={shard.w}
                  $h={shard.h}
                  $dx={shard.dx}
                  $dy={shard.dy}
                  $spin={shard.spin}
                  $gradAngle={shard.gradAngle}
                  $delay={shard.delay}
                  $shape={shard.shape}
                />
              ))}
              <BreakText>BREAK!</BreakText>
            </EffectContainer>
            {document.getElementById('game-hud') && createPortal(
              <SumoAnnouncementBanner
                text={"GRAB\nBREAK"}
                type="break"
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

GrabBreakEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    breakId: PropTypes.string,
    breakerPlayerNumber: PropTypes.number,
  }),
};

export default GrabBreakEffect;

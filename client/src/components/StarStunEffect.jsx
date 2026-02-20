import React, { useEffect, useState, memo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// 3D orbit rotation - stars rotate around head
const orbit3D = keyframes`
  0% {
    transform: rotateX(65deg) rotateZ(0deg);
  }
  100% {
    transform: rotateX(65deg) rotateZ(360deg);
  }
`;

// Individual star twinkle
const starTwinkle = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
`;

// Keep stars upright as they orbit (counter-rotate)
const counterRotate = keyframes`
  0% {
    transform: rotateZ(0deg) rotateX(-65deg);
  }
  100% {
    transform: rotateZ(-360deg) rotateX(-65deg);
  }
`;

// Text pulse animation for emphasis
const textPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    text-shadow: 
      0 0 10px rgba(255, 215, 0, 0.8),
      0 0 20px rgba(255, 215, 0, 0.5),
      0 0 30px rgba(255, 215, 0, 0.3);
  }
  50% {
    transform: scale(1.05);
    text-shadow: 
      0 0 15px rgba(255, 215, 0, 1),
      0 0 25px rgba(255, 215, 0, 0.7),
      0 0 40px rgba(255, 215, 0, 0.4);
  }
`;

const StarStunContainer = styled.div`
  position: absolute;
  bottom: ${props => (props.$y / 720) * 100 + 20}%;
  left: ${props => (props.$x / 1280) * 100}%;
  transform: translateX(-50%);
  z-index: 1001;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  perspective: 200px;
  contain: layout style;
`;

const OrbitContainer = styled.div`
  position: relative;
  width: 4.06cqw;
  height: 4.06cqw;
  transform-style: preserve-3d;
  animation: ${orbit3D} 1.2s linear infinite;
`;

const Star = styled.div`
  position: absolute;
  font-size: 0.99cqw;
  color: #ffd700;
  -webkit-text-stroke: 1.5px #000;
  paint-order: stroke fill;
  text-shadow: 
    0 0 8px rgba(255, 215, 0, 0.9),
    0 0 16px rgba(255, 215, 0, 0.5);
  animation: ${starTwinkle} 0.5s ease-in-out infinite, ${counterRotate} 1.2s linear infinite;
  transform-style: preserve-3d;
  
  /* 4 stars evenly spaced - adjusted for 3D tilt perspective */
  /* Star 1: top */
  &:nth-child(1) {
    top: -8%;
    left: calc(50% - 0.5em);
    animation-delay: 0s, 0s;
  }
  /* Star 2: right (pulled inward to compensate for 3D tilt) */
  &:nth-child(2) {
    top: calc(50% - 0.5em);
    right: 5%;
    animation-delay: 0.125s, 0s;
  }
  /* Star 3: bottom */
  &:nth-child(3) {
    bottom: -8%;
    left: calc(50% - 0.5em);
    animation-delay: 0.25s, 0s;
  }
  /* Star 4: left (pulled inward to compensate for 3D tilt) */
  &:nth-child(4) {
    top: calc(50% - 0.5em);
    left: 5%;
    animation-delay: 0.375s, 0s;
  }
`;

const StunnedText = styled.div`
  font-family: "Bungee", cursive;
  font-size: 0.86cqw;
  color: #ffd700;
  -webkit-text-stroke: 2.5px #000;
  paint-order: stroke fill;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.9);
  white-space: nowrap;
  letter-spacing: 0.15em;
  margin-bottom: 4px;
  animation: ${textPulse} 0.8s ease-in-out infinite;
`;

const StarStunEffect = ({ x, y, isActive, facing }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (isActive && typeof x === "number" && typeof y === "number") {
      setShowEffect(true);
    } else if (!isActive) {
      setShowEffect(false);
    }
  }, [isActive, x, y]);

  if (!showEffect || typeof x !== "number" || typeof y !== "number") return null;

  return (
    <StarStunContainer $x={x} $y={y} $facing={facing}>
     
      <OrbitContainer>
        <Star>★</Star>
        <Star>★</Star>
        <Star>★</Star>
        <Star>★</Star>
      </OrbitContainer>
    </StarStunContainer>
  );
};

StarStunEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  facing: PropTypes.number.isRequired,
};

// Memoize to prevent re-renders when parent updates but props haven't changed
export default memo(StarStunEffect, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.facing === nextProps.facing
  );
}); 
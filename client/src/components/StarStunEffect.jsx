import { useEffect, useState } from "react";
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

const StarStunContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    bottom: `${(props.$y / 720) * 100 + 29}%`,
    left: `${(props.$x / 1280) * 100 + 8}%`,
    transform: "translateX(-50%)",
    zIndex: 1001,
    pointerEvents: "none",
  },
}))`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  perspective: 200px;
`;

const OrbitContainer = styled.div`
  position: relative;
  width: clamp(75px, 7vw, 105px);
  height: clamp(75px, 7vw, 105px);
  transform-style: preserve-3d;
  animation: ${orbit3D} 1.2s linear infinite;
`;

const Star = styled.div`
  position: absolute;
  font-size: clamp(18px, 1.8vw, 26px);
  color: #ffd700;
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 0 8px rgba(255, 215, 0, 0.9),
    0 0 16px rgba(255, 215, 0, 0.5);
  animation: ${starTwinkle} 0.5s ease-in-out infinite, ${counterRotate} 1.2s linear infinite;
  transform-style: preserve-3d;
  
  /* 3 stars evenly spaced at 120° intervals around the circle */
  /* Star 1: top (0°) */
  &:nth-child(1) {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    animation-delay: 0s, 0s;
  }
  /* Star 2: bottom-left (120°) */
  &:nth-child(2) {
    bottom: 13%;
    left: 7%;
    animation-delay: 0.17s, 0s;
  }
  /* Star 3: bottom-right (240°) */
  &:nth-child(3) {
    bottom: 13%;
    right: 7%;
    animation-delay: 0.33s, 0s;
  }
`;

const StunnedText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(12px, 1.2vw, 16px);
  color: #ffd700;
  text-shadow: 
    -1px -1px 0 #000, 1px -1px 0 #000, 
    -1px 1px 0 #000, 1px 1px 0 #000,
    0 0 8px rgba(255, 215, 0, 0.6);
  white-space: nowrap;
  letter-spacing: 0.1em;
  margin-bottom: 2px;
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
      <StunnedText>STUNNED</StunnedText>
      <OrbitContainer>
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

export default StarStunEffect; 
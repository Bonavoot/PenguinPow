import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const starTwinkle = keyframes`
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  50% {
    transform: scale(1.3) rotate(180deg);
    opacity: 0.7;
  }
`;

const StarStunContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    // Use same positioning as YouLabel for exact alignment
    bottom: `${(props.$y / 720) * 100 + 33}%`,
    left: `${(props.$x / 1280) * 100 + (props.$facing === 1 ? 8 : 10)}%`,
    transform: "translateX(-50%)",
    zIndex: 1001, // Above YouLabel (1000)
    pointerEvents: "none",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
}))``;

const Star = styled.div`
  font-size: clamp(20px, 1.8vw, 28px);
  color: #ffd700;
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 0 10px #ffd700;
  animation: ${starTwinkle} 0.8s ease-in-out infinite;
  
  &:nth-child(1) {
    animation-delay: 0s;
  }
  
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
`;

const StarStunEffect = ({ x, y, isActive, facing }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (isActive && typeof x === "number" && typeof y === "number") {
      setShowEffect(true);
    } else if (!isActive) {
      // Hide immediately when isActive becomes false
      setShowEffect(false);
    }
  }, [isActive, x, y]);

  if (!showEffect || typeof x !== "number" || typeof y !== "number") return null;

  return (
    <StarStunContainer $x={x} $y={y} $facing={facing}>
      <Star>★</Star>
      <Star>★</Star>
      <Star>★</Star>
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
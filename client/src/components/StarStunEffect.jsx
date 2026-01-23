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
    // Match YouLabel positioning for proper centering
    bottom: `${(props.$y / 720) * 100 + 31}%`,
    left: `${(props.$x / 1280) * 100 + 8}%`,
    transform: "translateX(-50%)",
    zIndex: 1001,
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
}))``;

const StarsRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const Star = styled.div`
  font-size: clamp(16px, 1.4vw, 22px);
  color: #ffd700;
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 0 10px rgba(255, 215, 0, 0.8);
  animation: ${starTwinkle} 0.6s ease-in-out infinite;
  
  &:nth-child(1) { animation-delay: 0s; }
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
`;

const StunnedText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(10px, 1vw, 14px);
  color: #ffd700;
  text-shadow: 
    -1px -1px 0 #000, 1px -1px 0 #000, 
    -1px 1px 0 #000, 1px 1px 0 #000;
  white-space: nowrap;
  letter-spacing: 0.1em;
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
      <StunnedText>STUNNED</StunnedText>
      <StarsRow>
        <Star>★</Star>
        <Star>★</Star>
        <Star>★</Star>
      </StarsRow>
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
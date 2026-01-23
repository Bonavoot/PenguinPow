import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Simple pulsing animation
const breathePulse = keyframes`
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
`;

const EffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    // Match YouLabel positioning for proper centering above player
    left: `${(props.$x / 1280) * 100 + 8}%`,
    bottom: `${(props.$y / 720) * 100 + 31}%`,
    transform: "translateX(-50%)",
    zIndex: 1001,
    pointerEvents: "none",
    opacity: props.$isActive ? 1 : 0,
    transition: "opacity 0.15s ease-out",
  },
}))``;

const GassedText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(12px, 1.2vw, 16px);
  color: #ff6b6b;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 8px rgba(255, 107, 107, 0.6);
  white-space: nowrap;
  letter-spacing: 0.1em;
  animation: ${breathePulse} 0.5s ease-in-out infinite;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SweatIcon = styled.span`
  font-size: clamp(10px, 1vw, 14px);
`;

const GassedEffect = ({ x, y, facing, isActive }) => {
  if (!isActive || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <EffectContainer $x={x} $y={y} $facing={facing} $isActive={isActive}>
      <GassedText>
        <SweatIcon>💦</SweatIcon>
        GASSED
        <SweatIcon>💦</SweatIcon>
      </GassedText>
    </EffectContainer>
  );
};

GassedEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
};

export default GassedEffect;

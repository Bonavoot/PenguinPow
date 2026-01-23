import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Simple pulsing animation
const dangerPulse = keyframes`
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
    // Match YouLabel positioning
    left: `${(props.$x / 1280) * 100 + 8}%`,
    bottom: `${(props.$y / 720) * 100 + 31}%`,
    transform: "translateX(-50%)",
    zIndex: 1002,
    pointerEvents: "none",
    opacity: props.$isActive ? 1 : 0,
    transition: "opacity 0.15s ease-out",
  },
}))``;

const DangerText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(12px, 1.2vw, 16px);
  color: #ff4444;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 10px rgba(255, 68, 68, 0.8);
  animation: ${dangerPulse} 0.4s ease-in-out infinite;
  white-space: nowrap;
  letter-spacing: 0.1em;
`;

const EdgeDangerEffect = ({ x, y, facing, isActive }) => {
  if (!isActive || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <EffectContainer $x={x} $y={y} $facing={facing} $isActive={isActive}>
      <DangerText>⚠ DANGER ⚠</DangerText>
    </EffectContainer>
  );
};

EdgeDangerEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
};

export default EdgeDangerEffect;

import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Dramatic pulsing and scaling for the exclamation mark
const panicPulse = keyframes`
  0%, 100% {
    transform: scale(1) rotate(-3deg);
    opacity: 1;
  }
  25% {
    transform: scale(1.15) rotate(3deg);
    opacity: 0.95;
  }
  50% {
    transform: scale(0.95) rotate(-3deg);
    opacity: 1;
  }
  75% {
    transform: scale(1.1) rotate(3deg);
    opacity: 0.95;
  }
`;

// Wobble animation for character off-balance
const wobble = keyframes`
  0%, 100% {
    transform: translateX(0) rotate(0deg);
  }
  25% {
    transform: translateX(-3px) rotate(-2deg);
  }
  50% {
    transform: translateX(3px) rotate(2deg);
  }
  75% {
    transform: translateX(-2px) rotate(-1deg);
  }
`;


const EffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + 8}%`,
    bottom: `${(props.$y / 720) * 100 + 25}%`,
    transform: "translateX(-50%)",
    zIndex: 1002,
    pointerEvents: "none",
    opacity: props.$isActive ? 1 : 0,
    transition: "opacity 0.1s ease-out",
  },
}))`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
`;

// Large exclamation mark
const ExclamationMark = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(40px, 5vw, 72px);
  font-weight: 900;
  color: #ff1a1a;
  text-shadow: 
    -3px -3px 0 #000, 3px -3px 0 #000, 
    -3px 3px 0 #000, 3px 3px 0 #000,
    0 0 20px rgba(255, 26, 26, 1),
    0 0 40px rgba(255, 26, 26, 0.5);
  animation: ${panicPulse} 0.5s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
  line-height: 0.8;
  margin-bottom: -8px;
`;


const EdgeDangerEffect = ({ x, y, facing, isActive }) => {
  if (!isActive || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <EffectContainer $x={x} $y={y} $facing={facing} $isActive={isActive}>
      <ExclamationMark>!</ExclamationMark>
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

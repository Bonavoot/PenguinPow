import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Pop-in and fade animation with slight shake
const popInFade = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
  10% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05);
  }
  15% {
    transform: translate(-52%, -50%) scale(1);
  }
  20% {
    transform: translate(-48%, -50%) scale(1);
  }
  25% {
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.98);
  }
`;

const EffectContainer = styled.div`
  position: absolute;
  top: 22%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  pointer-events: none;
  animation: ${popInFade} 0.9s ease-out forwards;
`;

const NoStaminaText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 2.2vw, 1.5rem);
  color: #ff2222;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 12px rgba(255, 34, 34, 0.8),
    0 0 24px rgba(255, 34, 34, 0.5);
  white-space: nowrap;
  letter-spacing: 0.06em;
`;

// NoStaminaEffect - shows "NOT ENOUGH STAMINA" text centered on screen
// Only visible to the local player, not their opponent
const NoStaminaEffect = ({ showEffect }) => {
  if (!showEffect) {
    return null;
  }

  return (
    <EffectContainer key={showEffect}>
      <NoStaminaText>NOT ENOUGH STAMINA</NoStaminaText>
    </EffectContainer>
  );
};

NoStaminaEffect.propTypes = {
  showEffect: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
};

export default NoStaminaEffect;

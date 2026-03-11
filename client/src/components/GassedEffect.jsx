import { createPortal } from "react-dom";
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
  top: 21%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  pointer-events: none;
  animation: ${popInFade} 0.9s ease-out forwards;
`;

const NoStaminaText = styled.div`
  font-family: "Bungee", cursive;
  font-size: 1.25cqw;
  color: #ff2222;
  -webkit-text-stroke: clamp(1px, 0.1cqw, 2px) #000;
  paint-order: stroke fill;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    clamp(2px, 0.16cqw, 4px) clamp(2px, 0.16cqw, 4px) 0 #1a0808,
    clamp(4px, 0.32cqw, 7px) clamp(4px, 0.32cqw, 7px) 0 rgba(18, 8, 8, 0.7),
    0 2px 8px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  letter-spacing: 0.06em;
`;

// NoStaminaEffect - shows "NOT ENOUGH STAMINA" text centered on screen
// Only visible to the local player, not their opponent
const NoStaminaEffect = ({ showEffect }) => {
  if (!showEffect) {
    return null;
  }

  const hudEl = document.getElementById('game-hud');
  if (!hudEl) return null;

  return createPortal(
    <EffectContainer key={showEffect}>
      <NoStaminaText>NOT ENOUGH STAMINA</NoStaminaText>
    </EffectContainer>,
    hudEl
  );
};

NoStaminaEffect.propTypes = {
  showEffect: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
};

export default NoStaminaEffect;

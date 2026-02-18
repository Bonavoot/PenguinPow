import { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const absorptionAnimation = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  20% {
    opacity: 1;
    transform: scale(1.2);
  }
  80% {
    opacity: 0.8;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
`;

const ShieldEffect = styled.div`
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(156, 136, 255, 0.8) 0%,
    rgba(124, 77, 255, 0.6) 50%,
    rgba(156, 136, 255, 0.2) 100%
  );
  border: 3px solid #9c88ff;
  box-shadow: 0 0 20px rgba(156, 136, 255, 0.6),
    inset 0 0 20px rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
  text-shadow: 0 0 10px rgba(156, 136, 255, 0.8);
  animation: ${absorptionAnimation} 0.8s ease-out forwards;
  z-index: 102;
  pointer-events: none;
  left: ${(props) => (props.x / 1280) * 100}%;
  bottom: ${(props) => ((props.y + 50) / 720) * 100}%;
  transform: translateX(-50%);
`;

const ThickBlubberEffect = ({ x, y, isActive }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShowEffect(true);

      // Hide effect after animation completes
      const timer = setTimeout(() => {
        setShowEffect(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!showEffect) return null;

  return (
    <ShieldEffect x={x} y={y}>
      🛡️
    </ShieldEffect>
  );
};

ThickBlubberEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
};

export default ThickBlubberEffect;

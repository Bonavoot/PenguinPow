import styled from "styled-components";
import PropTypes from "prop-types";
import { memo } from "react";

const RedOverlay = styled.div`
  position: absolute;
  width: 18.4%;
  height: auto;
  aspect-ratio: 1;
  left: ${(props) => (props.$x / 1280) * 100}%;
  bottom: ${(props) => (props.$y / 720) * 100}%;
  transform: ${(props) => `scaleX(${props.$facing}) translateZ(0)`};
  background: rgba(255, 0, 0, 0.4);
  z-index: 99;
  pointer-events: none;
  will-change: opacity;
  backface-visibility: hidden;
  mix-blend-mode: multiply;
  animation: thickBlubberPulse 1.5s ease-in-out infinite;

  @keyframes thickBlubberPulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }
`;

const ThickBlubberIndicator = memo(({ x, y, facing, isActive }) => {
  if (!isActive) return null;

  return <RedOverlay $x={x} $y={y} $facing={facing} />;
});

ThickBlubberIndicator.displayName = "ThickBlubberIndicator";

ThickBlubberIndicator.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
};

export default ThickBlubberIndicator;

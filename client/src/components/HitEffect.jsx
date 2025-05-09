import styled from "styled-components";
import PropTypes from "prop-types";
import hitEffect from "../assets/hit-effect.png";
import { useMemo } from "react";

const HitEffectImage = styled.img`
  position: absolute;
  width: 25%;
  height: auto;
  pointer-events: none;
  animation: hitEffectFade 0.4s ease-out forwards;
  z-index: 100;

  @keyframes hitEffectFade {
    0% {
      opacity: 1;
      transform: scale(0.9);
    }
    25% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.1);
    }
  }
`;

const HitEffect = ({ isActive, x, y, facing }) => {
  // Define three different positions for the hit effect
  const positions = useMemo(() => {
    const basePositions = [
      { x: -1, y: -13 }, // Original position
      { x: 0, y: -12 }, // Slightly higher and more centered
      { x: -3, y: -14 }, // Slightly lower and more to the side
    ];

    // Randomly select one position
    return basePositions[Math.floor(Math.random() * basePositions.length)];
  }, [isActive]); // Only recalculate when isActive changes

  if (!isActive) return null;

  // Adjust base position based on facing direction
  const baseOffsetX = facing === 1 ? positions.x - 3 : positions.x + 3; // Adjust for facing direction
  const baseOffsetY = positions.y; // Use the randomly selected y offset

  return (
    <HitEffectImage
      src={hitEffect}
      alt="Hit Effect"
      style={{
        left: `${(x / 1280) * 100 + baseOffsetX}%`,
        bottom: `${(y / 720) * 100 + baseOffsetY}%`,
        transform: `scaleX(${facing})`, // Flip the effect based on facing direction
      }}
    />
  );
};

HitEffect.propTypes = {
  isActive: PropTypes.bool.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
};

export default HitEffect;

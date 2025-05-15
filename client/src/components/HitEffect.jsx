import styled from "styled-components";
import PropTypes from "prop-types";
import hitEffect from "../assets/fire-hit-effect.gif";
import { useMemo } from "react";

const HitEffectImage = styled.img`
  position: absolute;
  width: 10%;
  height: auto;
  pointer-events: none;
  z-index: 100;
  filter: brightness(0.2) invert(1);
`;

const HitEffect = ({ isActive, x, y, facing }) => {
  // Define three different positions for the hit effect
  const positions = useMemo(() => {
    const basePositions = [
      { x: 0, y: 0 }, // Original position
      { x: 0, y: 0 }, // Slightly higher and more centered
      { x: 0, y: 0 }, // Slightly lower and more to the side
    ];

    // Randomly select one position
    return basePositions[Math.floor(Math.random() * basePositions.length)];
  }, [isActive]); // Only recalculate when isActive changes

  if (!isActive) return null;

  // Adjust base position based on facing direction
  const baseOffsetX = facing === 1 ? positions.x + 2 : positions.x + 6; // Adjust for facing direction
  const baseOffsetY = positions.y + 10; // Use the randomly selected y offset

  return (
    <HitEffectImage
      src={hitEffect}
      alt="Hit Effect"
      style={{
        left: `${(x / 1280) * 100 + baseOffsetX}%`,
        bottom: `${(y / 720) * 100 + baseOffsetY}%`,
        transform: `scaleX(${facing * -1}) rotateZ(-30deg)`, // Flip the effect based on facing direction
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

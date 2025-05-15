import styled from "styled-components";
import PropTypes from "prop-types";
import hitEffect from "../assets/fire-hit-effect.gif";

const HitEffectImage = styled.img`
  position: absolute;
  width: 10%;
  height: auto;
  pointer-events: none;
  z-index: 100;
  filter: brightness(0.1) invert(1);
`;

const HitEffect = ({ isActive, x, y, facing }) => {
  if (!isActive) return null;

  // Use fixed position offsets
  const baseOffsetX = facing === 1 ? 1 : 7; // Adjust for facing direction
  const baseOffsetY = 10; // Fixed y offset

  return (
    <HitEffectImage
      src={hitEffect}
      alt="Hit Effect"
      style={{
        left: `${(x / 1280) * 100 + baseOffsetX}%`,
        bottom: `${(y / 720) * 100 + baseOffsetY}%`,
        transform: `scaleX(${facing * -1}) rotateZ(-25deg)`, // Flip the effect based on facing direction
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

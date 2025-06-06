import styled from "styled-components";
import PropTypes from "prop-types";
import hitEffect from "../assets/fire-hit-effect.gif";

const HitEffectImage = styled.img.attrs((props) => ({
  style: {
    position: "absolute",
    width: "6%",
    height: "auto",
    pointerEvents: "none",
    zIndex: 100,
    filter:
      "brightness(.1) invert(1) drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
    left: `${(props.$x / 1280) * 100 + (props.$facing === 1 ? 1 : 11)}%`,
    bottom: `${(props.$y / 720) * 100 + 11}%`,
    transform: `scaleX(${props.$facing * 1}) rotateZ(-10deg)`,
  },
}))``;

const HitEffect = ({ isActive, x, y, facing }) => {
  if (!isActive) return null;

  return (
    <HitEffectImage
      src={hitEffect}
      alt="Hit Effect"
      $x={x}
      $y={y}
      $facing={facing}
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

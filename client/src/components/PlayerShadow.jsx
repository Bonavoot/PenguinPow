import styled from "styled-components";
import PropTypes from "prop-types";

const GROUND_LEVEL = 215; // Match the server's GROUND_LEVEL

const ShadowElement = styled.div.attrs((props) => {
  // Calculate the bottom position
  const bottomPos = props.$isDodging ? GROUND_LEVEL : props.$y;

  return {
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(bottomPos / 720) * 100}%`,
      transform: `translateX(${props.$facing === -1 ? "12%" : "9%"})`,
    },
  };
})`
  width: 15%;
  height: 4%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.4) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, bottom, left;
  z-index: 1;
`;

const PlayerShadow = ({ x, y, facing, isDodging }) => {
  return (
    <ShadowElement $x={x} $y={y} $facing={facing} $isDodging={isDodging} />
  );
};

PlayerShadow.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isDodging: PropTypes.bool,
};

export default PlayerShadow;

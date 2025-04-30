import styled from "styled-components";
import PropTypes from "prop-types";

const ShadowElement = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(((props.$isDodging ? 257 : props.$y) - 2) / 720) * 100}%`, // Stay at GROUND_LEVEL during dodge
    transform: `translateX(${props.$facing === -1 ? "12%" : "9%"}) `,
  },
}))`
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

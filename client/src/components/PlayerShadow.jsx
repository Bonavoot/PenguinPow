import styled from "styled-components";
import PropTypes from "prop-types";

const ShadowElement = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${((props.$y - 2) / 720) * 100}%`, // Slightly below player
    transform: `translateX(${props.$facing === -1 ? "9%" : "6%"}) `,
  },
}))`
  width: 20%;
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

const PlayerShadow = ({ x, y, facing }) => {
  return <ShadowElement $x={x} $y={y} $facing={facing} />;
};

PlayerShadow.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
};

export default PlayerShadow;

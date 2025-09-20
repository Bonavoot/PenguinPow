import styled from "styled-components";
import PropTypes from "prop-types";

const GROUND_LEVEL = 240; // Match the server's GROUND_LEVEL

const ShadowElement = styled.div.attrs((props) => {
  // Calculate the bottom position
  const bottomPos = props.$isDodging || props.$isGrabStartup ? GROUND_LEVEL : props.$y;

  // Use custom offsets if provided, otherwise use defaults
  const offsetLeft =
    props.$facing === -1
      ? props.$offsetLeft || "20%"
      : props.$offsetRight || "20%";

  return {
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(bottomPos / 720) * 100}%`,
      transform: `translateX(${offsetLeft})`,
    },
  };
})`
  width: ${(props) => props.$width || "10.6%"};
  height: ${(props) => props.$height || "3.65%"};
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.6) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, bottom, left;
  z-index: 1;
`;

const PlayerShadow = ({
  x,
  y,
  facing,
  isDodging,
  isGrabStartup,
  width,
  height,
  offsetLeft,
  offsetRight,
}) => {
  return (
    <ShadowElement
      $x={x}
      $y={y}
      $facing={facing}
      $isDodging={isDodging}
      $isGrabStartup={isGrabStartup}
      $width={width}
      $height={height}
      $offsetLeft={offsetLeft}
      $offsetRight={offsetRight}
    />
  );
};

PlayerShadow.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isDodging: PropTypes.bool,
  isGrabStartup: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
};

export default PlayerShadow;

import styled from "styled-components";
import PropTypes from "prop-types";

const GROUND_LEVEL = 210; // Match the server's GROUND_LEVEL

const ShadowElement = styled.div.attrs((props) => {
  // Calculate the bottom position
  const forceGround =
    props.$isDodging ||
    props.$isGrabStartup ||
    props.$isThrowing ||
    props.$isBeingThrown ||
    props.$isRingOutThrowCutscene;
  const bottomPos = forceGround ? GROUND_LEVEL : props.$y;

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
  width: ${(props) => props.$width || "11.713%"};
  height: ${(props) => props.$height || "4.04%"};
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
  isThrowing,
  isBeingThrown,
  isRingOutThrowCutscene,
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
      $isThrowing={isThrowing}
      $isBeingThrown={isBeingThrown}
      $isRingOutThrowCutscene={isRingOutThrowCutscene}
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
  isThrowing: PropTypes.bool,
  isBeingThrown: PropTypes.bool,
  isRingOutThrowCutscene: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
};

export default PlayerShadow;

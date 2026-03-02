import styled from "styled-components";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

const GROUND_LEVEL = 300; // Match the server's GROUND_LEVEL

const sharedAttrs = (props) => {
  const forceGround =
    props.$isDodging ||
    props.$isGrabStartup ||
    props.$isThrowing ||
    props.$isBeingThrown ||
    props.$isRingOutThrowCutscene ||
    props.$isRopeJumping;
  const bottomPos = forceGround ? GROUND_LEVEL : props.$y;
  const adjustedBottomPos = bottomPos;
  const offsetLeft =
    props.$facing === -1
      ? props.$offsetLeft || "-50%"
      : props.$offsetRight || "-50%";
  return {
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(adjustedBottomPos / 720) * 100 - .2}%`,
      transform: `translateX(${offsetLeft})`,
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 1,
    },
  };
};

const shadowSize = { w: "9.15%", h: "3.70%" };
const SHADOW_GRADIENT = `radial-gradient(
  ellipse at center,
  rgba(0, 0, 0, 0.86) 0%,
  rgba(0, 0, 0, 0) 70%
)`;
const ShadowLayer = styled.div.attrs((props) => sharedAttrs(props))`
  width: ${(props) => props.$width || shadowSize.w};
  height: ${(props) => props.$height || shadowSize.h};
  background: ${SHADOW_GRADIENT};
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, bottom, left;
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
  isRopeJumping,
  width,
  height,
  offsetLeft,
  offsetRight,
  isLocalPlayer,
}) => {
  return (
    <ShadowLayer
      $x={x}
      $y={y}
      $facing={facing}
      $isDodging={isDodging}
      $isGrabStartup={isGrabStartup}
      $isThrowing={isThrowing}
      $isBeingThrown={isBeingThrown}
      $isRingOutThrowCutscene={isRingOutThrowCutscene}
      $isRopeJumping={isRopeJumping}
      $width={width}
      $height={height}
      $offsetLeft={offsetLeft}
      $offsetRight={offsetRight}
      $isLocalPlayer={isLocalPlayer}
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
  isRopeJumping: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
  isLocalPlayer: PropTypes.bool,
};

export default PlayerShadow;

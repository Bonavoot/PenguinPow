import styled from "styled-components";
import PropTypes from "prop-types";
import { isOutsideDohyo, DOHYO_FALL_DEPTH } from "../constants";

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
  
  // Apply dohyo fall depth if outside boundaries
  const adjustedBottomPos = bottomPos - (isOutsideDohyo(props.$x, props.$y) ? DOHYO_FALL_DEPTH : 0);

  // Use custom offsets if provided, otherwise use defaults
  const offsetLeft =
    props.$facing === -1
      ? props.$offsetLeft || "20%"
      : props.$offsetRight || "20%";

  return {
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(adjustedBottomPos / 720) * 100}%`,
      transform: `translateX(${offsetLeft})`,
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 1,
    },
  };
})`
  width: ${(props) => props.$width || "11.713%"};
  height: ${(props) => props.$height || "4.04%"};
  background: ${(props) =>
    props.$isLocalPlayer
      ? `radial-gradient(
          ellipse at center,
          rgba(0, 0, 0, 0.6) 0%,
          rgba(50, 50, 50, 0.5) 25%,
          rgba(150, 150, 170, 0.45) 45%,
          rgba(220, 220, 240, 0.4) 60%,
          rgba(255, 255, 255, 0.5) 70%,
          rgba(255, 255, 255, 0.3) 75%,
          rgba(0, 0, 0, 0) 80%
        )`
      : `radial-gradient(
          ellipse at center,
          rgba(0, 0, 0, 0.6) 0%,
          rgba(0, 0, 0, 0) 70%
        )`};
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, bottom, left;
  box-shadow: ${(props) =>
    props.$isLocalPlayer
      ? "0 0 20px rgba(255, 255, 255, 0.7), inset 0 0 8px rgba(255, 255, 255, 0.3), 0 0 0 2px rgba(255, 255, 255, 0.6)"
      : "none"};
  animation: ${(props) =>
    props.$isLocalPlayer ? "localPlayerShadowPulse 2s ease-in-out infinite" : "none"};

  @keyframes localPlayerShadowPulse {
    0%, 100% {
      opacity: 1;
      filter: brightness(1);
    }
    50% {
      opacity: 0.85;
      filter: brightness(1.2);
    }
  }
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
  isLocalPlayer,
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
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
  isLocalPlayer: PropTypes.bool,
};

export default PlayerShadow;

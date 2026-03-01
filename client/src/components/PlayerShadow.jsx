import styled from "styled-components";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

const GROUND_LEVEL = 300; // Match the server's GROUND_LEVEL

// Ring mask so only the ring band is visible (used when background is a gradient)
const RING_MASK =
  "radial-gradient(ellipse at center, transparent 0%, transparent 57%, black 65%, black 79%, transparent 85%)";

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

const shadowSize = { w: "8.15%", h: "3.70%" };
const SHADOW_GRADIENT = `radial-gradient(
  ellipse at center,
  rgba(0, 0, 0, 0.6) 0%,
  rgba(0, 0, 0, 0) 70%
)`;

/* Shadow only – always visible; for non-local this is the only layer */
const ShadowLayer = styled.div.attrs((props) => sharedAttrs(props))`
  width: ${(props) => props.$width || shadowSize.w};
  height: ${(props) => props.$height || shadowSize.h};
  background: ${SHADOW_GRADIENT};
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, bottom, left;
`;

/* Ring only – on top of shadow for local player; mask applied only to this so shadow stays visible */
const RingLayer = styled.div.attrs((props) => sharedAttrs(props))`
  width: ${(props) => props.$width || shadowSize.w};
  height: ${(props) => props.$height || shadowSize.h};
  background: ${(props) => {
    const ring = props.$localPlayerRingStyle;
    if (ring && props.$isRingGradient) return ring;
    if (ring) {
      return `radial-gradient(
        ellipse at center,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0) 57%,
        ${ring} 65%,
        ${ring} 72%,
        ${ring} 79%,
        rgba(0, 0, 0, 0) 85%
      )`;
    }
    return `radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 57%,
      rgba(255, 255, 255, 0.9) 65%,
      rgba(255, 255, 255, 1) 72%,
      rgba(255, 255, 255, 0.9) 79%,
      rgba(0, 0, 0, 0) 85%
    )`;
  }};
  mask-image: ${(props) =>
    props.$localPlayerRingStyle && props.$isRingGradient ? RING_MASK : "none"};
  -webkit-mask-image: ${(props) =>
    props.$localPlayerRingStyle && props.$isRingGradient ? RING_MASK : "none"};
  mask-size: 100% 100%;
  mask-position: center;
  -webkit-mask-size: 100% 100%;
  -webkit-mask-position: center;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, bottom, left;
  box-shadow: ${(props) => {
    const ring = props.$localPlayerRingStyle;
    if (ring && !props.$isRingGradient) {
      return `0 0 8px ${ring}99, 0 0 14px ${ring}66`;
    }
    return "0 0 8px rgba(255, 255, 255, 0.5), 0 0 14px rgba(255, 255, 255, 0.25)";
  }};
  animation: localPlayerShadowPulse 2s ease-in-out infinite;

  @keyframes localPlayerShadowPulse {
    0%, 100% {
      opacity: 1;
      filter: brightness(1);
    }
    50% {
      opacity: 1;
      filter: brightness(1.4);
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
  isRopeJumping,
  width,
  height,
  offsetLeft,
  offsetRight,
  isLocalPlayer,
  localPlayerRingStyle,
}) => {
  const isRingGradient =
    localPlayerRingStyle && localPlayerRingStyle.includes("gradient");
  const common = {
    $x: x,
    $y: y,
    $facing: facing,
    $isDodging: isDodging,
    $isGrabStartup: isGrabStartup,
    $isThrowing: isThrowing,
    $isBeingThrown: isBeingThrown,
    $isRingOutThrowCutscene: isRingOutThrowCutscene,
    $isRopeJumping: isRopeJumping,
    $width: width,
    $height: height,
    $offsetLeft: offsetLeft,
    $offsetRight: offsetRight,
  };
  return (
    <>
      <ShadowLayer {...common} />
      {isLocalPlayer && (
        <RingLayer
          {...common}
          $localPlayerRingStyle={localPlayerRingStyle}
          $isRingGradient={isRingGradient}
        />
      )}
    </>
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
  localPlayerRingStyle: PropTypes.string,
};

export default PlayerShadow;

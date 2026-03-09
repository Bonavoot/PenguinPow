import { memo } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

const GROUND_LEVEL = 300; // Match the server's GROUND_LEVEL

const SHADOW_GRADIENT =
  "radial-gradient(ellipse at center, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0) 70%)";

const baseStyle = {
  position: "absolute",
  borderRadius: "50%",
  pointerEvents: "none",
  willChange: "transform, bottom, left",
  background: SHADOW_GRADIENT,
};

const PlayerShadow = memo(({
  x,
  y,
  facing,
  isDodging,
  isSidestepping,
  isGrabStartup,
  isThrowing,
  isBeingThrown,
  isRingOutThrowCutscene,
  isRopeJumping,
  width,
  height,
  offsetLeft,
  offsetRight,
}) => {
  const sidestepping = isSidestepping;

  const forceGround =
    !sidestepping && (
      isDodging ||
      isGrabStartup ||
      isThrowing ||
      isBeingThrown ||
      isRingOutThrowCutscene ||
      isRopeJumping
    );

  // During sidestep, track the player's actual Y (the arc dip).
  // For other forced-ground states, pin to GROUND_LEVEL.
  const bottomY = forceGround ? GROUND_LEVEL : y;

  const txOffset = facing === -1
    ? offsetLeft || "-50%"
    : offsetRight || "-50%";

  const shadowScale = sidestepping ? 1.07 : 1;

  const style = {
    ...baseStyle,
    width: width || "9.15%",
    height: height || "3.70%",
    left: `${(x / 1280) * 100}%`,
    bottom: `${(bottomY / 720) * 100 - 0.2}%`,
    transform: `translateX(${txOffset}) scale(${shadowScale})`,
    transformOrigin: "center bottom",
    zIndex: isOutsideDohyo(x, y) ? 0 : 1,
    opacity: sidestepping ? 0.5 : undefined,
  };

  return <div style={style} />;
});

PlayerShadow.displayName = "PlayerShadow";

PlayerShadow.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isDodging: PropTypes.bool,
  isSidestepping: PropTypes.bool,
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

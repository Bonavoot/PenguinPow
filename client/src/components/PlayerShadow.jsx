import { memo, forwardRef } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

// Match the server's GROUND_LEVEL. Exported so GameFighter's imperative
// position loop can mirror the ground-pinning formula exactly.
export const SHADOW_GROUND_LEVEL = 294;
const GROUND_LEVEL = SHADOW_GROUND_LEVEL;

// Two-layer ground shadow for real weight: a tight, dark CONTACT core (sells
// the point where the penguin meets the ice) sitting on a broad, soft AMBIENT
// penumbra (the diffuse occlusion that grounds the whole body). The single flat
// ellipse read as a sticker decal under the feet; this reads as cast light.
const SHADOW_GRADIENT =
  "radial-gradient(ellipse 56% 62% at 50% 50%, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.30) 42%, rgba(0,0,0,0) 70%), " +
  "radial-gradient(ellipse 96% 92% at 50% 52%, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0) 76%)";

const baseStyle = {
  position: "absolute",
  borderRadius: "50%",
  pointerEvents: "none",
  willChange: "transform, bottom, left",
  background: SHADOW_GRADIENT,
};

const PlayerShadow = memo(forwardRef(({
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
  isFlapping,
  width,
  height,
  offsetLeft,
  offsetRight,
}, ref) => {
  const sidestepping = isSidestepping;

  const forceGround =
    !sidestepping && (
      isDodging ||
      isGrabStartup ||
      isThrowing ||
      isBeingThrown ||
      isRingOutThrowCutscene ||
      isRopeJumping ||
      isFlapping
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
    width: width || "8.8%",
    height: height || "3.55%",
    left: `${(x / 1280) * 100}%`,
    bottom: `${(bottomY / 720) * 100 - 0.2}%`,
    transform: `translateX(${txOffset}) scale(${shadowScale})`,
    transformOrigin: "center bottom",
    zIndex: isOutsideDohyo(x, y) ? 0 : 1,
    opacity: sidestepping ? 0.5 : undefined,
  };

  return <div ref={ref} style={style} />;
}));

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
  isFlapping: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
  isLocalPlayer: PropTypes.bool,
};

export default PlayerShadow;

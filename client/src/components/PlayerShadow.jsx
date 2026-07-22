import { memo, forwardRef } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

// Match the server's GROUND_LEVEL. Exported so GameFighter's imperative
// position loop can mirror the ground-pinning formula exactly.
export const SHADOW_GROUND_LEVEL = 286;
const GROUND_LEVEL = SHADOW_GROUND_LEVEL;

// Soft elliptical ground shadow — cool slate tint for ice, continuous falloff.
// No hard contact puck: a dense center blob reads as a dark sticker on the
// dohyo. Peak opacity stays modest; the outer layer is just ambient occlusion.
// Exported so menu portraits (BashoHub, Lobby, PreMatch) share the same recipe.
export const SHADOW_GRADIENT =
  "radial-gradient(ellipse 72% 78% at 50% 52%, rgba(6,12,24,0.36) 0%, rgba(8,16,30,0.18) 45%, rgba(10,20,36,0.05) 70%, rgba(10,20,36,0) 88%), " +
  "radial-gradient(ellipse 100% 100% at 50% 52%, rgba(12,22,40,0.14) 0%, rgba(12,22,40,0.05) 52%, rgba(12,22,40,0) 82%)";

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
  isBeingLifted,
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
      isBeingLifted ||
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
    // Footprint kept tight to the fighter's base — a wider default spilled the
    // ellipse out past the sprite (readable as an oversized puck under/around
    // the feet). Callers can still override per-state.
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
  isBeingLifted: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
  isLocalPlayer: PropTypes.bool,
};

export default PlayerShadow;

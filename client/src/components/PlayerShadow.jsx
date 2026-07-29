import { memo, forwardRef } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

// Match the server's GROUND_LEVEL. Exported so GameFighter's imperative
// position loop can mirror the ground-pinning formula exactly.
export const SHADOW_GROUND_LEVEL = 286;
const GROUND_LEVEL = SHADOW_GROUND_LEVEL;

// Soft elliptical ground shadow — cool slate tint, continuous falloff.
// In gameplay this oval only appears past the dohyo (off-ice). On ice,
// IceReflection owns the ground read. UI / lobby portraits reuse
// SHADOW_GRADIENT directly.
export const SHADOW_GRADIENT =
  "radial-gradient(ellipse 72% 78% at 50% 52%, rgba(6,12,24,0.36) 0%, rgba(8,16,30,0.18) 45%, rgba(10,20,36,0.05) 70%, rgba(10,20,36,0) 88%), " +
  "radial-gradient(ellipse 100% 100% at 50% 52%, rgba(12,22,40,0.14) 0%, rgba(12,22,40,0.05) 52%, rgba(12,22,40,0) 82%)";

/** Treat y above ground+epsilon as airborne for bottom pinning. */
const AIRBORNE_Y_EPSILON = 4;

/**
 * Gameplay oval visibility: only when fallen off the platform (or RoundResult
 * loser). Fighters alive against the ropes keep IceReflection (edge-clipped).
 */
export function playerShadowShouldShow(x, y, { forceShow = false } = {}) {
  if (forceShow) return true;
  return isOutsideDohyo(x, y);
}

/** Pin contact to ice while airborne over it; follow y when fallen / sidestep. */
export function playerShadowBottomY(
  x,
  y,
  { isSidestepping, isDodging, isBeingThrown, isRingOutThrowCutscene, isRopeJumping, isFlapping, isGrabStartup, isThrowing } = {}
) {
  // Fully off the platform — follow real y (dirt / fall).
  if (isOutsideDohyo(x, y)) return y;
  if (isSidestepping) return y;
  const pinToIce =
    isDodging ||
    isGrabStartup ||
    isThrowing ||
    isBeingThrown ||
    isRingOutThrowCutscene ||
    isRopeJumping ||
    isFlapping ||
    y > GROUND_LEVEL + AIRBORNE_Y_EPSILON;
  return pinToIce ? GROUND_LEVEL : y;
}

/** Opacity for the gameplay oval (0 when hidden / on ice). */
export function playerShadowOpacity(x, y, { forceShow = false } = {}) {
  return playerShadowShouldShow(x, y, { forceShow }) ? 0.55 : 0;
}

const baseStyle = {
  position: "absolute",
  borderRadius: "50%",
  pointerEvents: "none",
  willChange: "transform, bottom, left, opacity",
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
  forceShow,
  width,
  height,
  offsetLeft,
  offsetRight,
}, ref) => {
  const flags = {
    isDodging,
    isSidestepping,
    isGrabStartup,
    isThrowing,
    isBeingThrown,
    isRingOutThrowCutscene,
    isRopeJumping,
    isFlapping,
  };

  const outside = isOutsideDohyo(x, y);
  const show = playerShadowShouldShow(x, y, { forceShow });
  const bottomY = playerShadowBottomY(x, y, flags);
  const opacity = playerShadowOpacity(x, y, { forceShow });

  const txOffset = facing === -1
    ? offsetLeft || "-50%"
    : offsetRight || "-50%";

  const shadowScale = isSidestepping ? 1.07 : 1;

  const style = {
    ...baseStyle,
    // Off-ice footprint; on ice this node stays hidden (IceReflection).
    width: width || "8.8%",
    height: height || "3.55%",
    left: `${(x / 1280) * 100}%`,
    bottom: `${(bottomY / 720) * 100 - 0.2}%`,
    transform: `translateX(${txOffset}) scale(${shadowScale})`,
    transformOrigin: "center bottom",
    zIndex: outside ? 0 : 1,
    opacity,
    visibility: show ? "visible" : "hidden",
    display: show ? "block" : "none",
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
  forceShow: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
  isLocalPlayer: PropTypes.bool,
};

export default PlayerShadow;

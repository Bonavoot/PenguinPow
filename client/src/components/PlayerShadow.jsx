import { memo, forwardRef } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";

// Match the server's GROUND_LEVEL. Exported so GameFighter's imperative
// position loop can mirror the ground-pinning formula exactly.
export const SHADOW_GROUND_LEVEL = 286;
const GROUND_LEVEL = SHADOW_GROUND_LEVEL;

// Three-zone ground shadow for real weight, from the inside out:
//   1. CONTACT — a tight, near-black core right where the penguin meets the ice.
//      This is the "hard contact" darkening that sells the exact touch point and
//      stops the sprite reading as floating a hair above the surface.
//   2. CORE   — the main body of the cast shadow, mid-dark, falling off.
//   3. AMBIENT— a broad, very soft penumbra (diffuse occlusion) that grounds the
//      whole mass without a hard edge.
// The previous two-layer version had a lighter core (0.66) and no dedicated
// hard-contact point, so at rest the penguins read as *placed on top of* the
// ice. Deepening the contact + widening the soft ambient plants them.
// The CONTACT core stays near-neutral black for a crisp, believable touch
// point, but the CORE and AMBIENT falloff are tinted a cold slate-blue. On ice
// the diffuse/bounced light is cool, so a pure-black penumbra reads as "sticker
// dropped on the surface"; the cool cast makes the soft shadow belong to the
// frozen arena (and quietly pairs with the cool rim light on the sprites).
// Exported so menu portraits (BashoHub, etc.) can reuse the exact same
// contact / core / ambient recipe instead of inventing a parallel oval.
export const SHADOW_GRADIENT =
  "radial-gradient(ellipse 34% 46% at 50% 53%, rgba(2,4,8,0.82) 0%, rgba(4,8,16,0.52) 40%, rgba(4,8,16,0) 72%), " +
  "radial-gradient(ellipse 62% 66% at 50% 52%, rgba(9,17,32,0.44) 0%, rgba(9,17,32,0.18) 52%, rgba(9,17,32,0) 78%), " +
  "radial-gradient(ellipse 104% 100% at 50% 52%, rgba(14,24,42,0.22) 0%, rgba(14,24,42,0.07) 56%, rgba(14,24,42,0) 82%)";

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
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
  isLocalPlayer: PropTypes.bool,
};

export default PlayerShadow;

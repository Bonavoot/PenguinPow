/**
 * Ground-plane solidity. Airborne bodies have no standing pushbox, so
 * grounded fighters must be able to walk / grab-run / dash under them.
 *
 * Constants-only — safe from gameUtils / strikeContact require cycles.
 */

const { GROUND_LEVEL } = require("./constants");

/** Same height band the grab connect path already treated as ungrabbable. */
const AIRBORNE_GROUND_COLLISION_EPS_PX = 8;

/**
 * True when this fighter must not act as a grounded X wall.
 *
 * `opts.forGrab`: dodge hops stay grabbable (grabs beat dodge). Slide-jump /
 * flap / rope-jump / hit-fall / elevated Y stay ungrabbable.
 */
function isAirborneForGroundCollision(player, opts = {}) {
  if (!player) return false;
  if (player.isSlideJumping && player.slideJumpPhase === "flight") return true;
  if (player.isFlapping && player.flapPhase === "flight") return true;
  if (player.isRopeJumping && player.ropeJumpPhase === "active") return true;
  if (player.isHitFalling) return true;
  if (opts.forGrab && player.isIceSlideReverseHopping) return true;
  // Dodge writes Y above the ice; grabs still beat that hop.
  if (opts.forGrab && player.isDodging) return false;
  if (
    typeof player.y === "number" &&
    player.y > GROUND_LEVEL + AIRBORNE_GROUND_COLLISION_EPS_PX
  ) {
    return true;
  }
  return false;
}

module.exports = {
  AIRBORNE_GROUND_COLLISION_EPS_PX,
  isAirborneForGroundCollision,
};

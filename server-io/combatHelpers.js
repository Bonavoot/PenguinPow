const {
  GRAB_RANGE,
  GRAB_STARTUP_DURATION_MS, SLAP_ATTACK_STARTUP_MS,
} = require("./constants");

function isOpponentCloseEnoughForGrab(player, opponent) {
  // Calculate grab range based on player size
  const grabRange = GRAB_RANGE * (player.sizeMultiplier || 1);
  return Math.abs(player.x - opponent.x) < grabRange;
}

function isOpponentInFrontOfGrabber(player, opponent) {
  // Grab should only connect with opponents who are in front of the grabber,
  // not behind them. Uses player.facing for direction check.
  // facing: 1 = facing left, -1 = facing right
  const BEHIND_TOLERANCE = 20; // Small tolerance (pixels) for near-overlap edge cases
  // Convert facing to direction: facing 1 (left) → check opponent is to left (-1)
  const facingDirection = player.facing === 1 ? -1 : 1;
  // Positive = opponent is in front, negative = opponent is behind
  const relativePos = (opponent.x - player.x) * facingDirection;
  return relativePos >= -BEHIND_TOLERANCE;
}

// First-to-active wins: grab vs slap is deterministic based on when each became active
// Returns true if grab wins (grab became active before slap)
function grabBeatsSlap(grabber, slapper) {
  if (!grabber.grabStartupStartTime || !slapper.attackStartTime) return false;
  const grabStartupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  const grabActiveTime = grabber.grabStartupStartTime + grabStartupMs;
  const slapActiveTime = slapper.attackStartTime + SLAP_ATTACK_STARTUP_MS;
  return grabActiveTime < slapActiveTime;
}

// NOTE: The legacy throw-tech system (checkForThrowTech / checkForGrabPriority /
// applyThrowTech) was removed with the legacy W-throw input path. Mutual grab
// attempts now resolve via executeGrabTech in grabMechanics.js, and clinch
// interactions are handled in grabActionSystem.js.

module.exports = {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  grabBeatsSlap,
};

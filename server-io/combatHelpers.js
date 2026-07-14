const {
  GRAB_RANGE,
  SLAP_ATTACK_STARTUP_MS,
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

// GRAB "SLIPS" SLAP — the anti-slap-spam read.
//
// Problem this solves: slap startup (55ms) is ~3x faster than grab startup
// (165ms), so a "first-to-active" rule (the old grabBeatsSlap) meant a grab
// could only win if it was committed ~110ms BEFORE the slap even began — which
// is structurally impossible against continuous slap pressure (there is always
// a slap going active inside your 165ms startup). Grabs therefore lost to any
// slap spam and felt unusable.
//
// New rule: a grab that is ALREADY in startup when a slap's hitbox comes out
// "slips" (evades) that slap — the slap whiffs, the grab startup survives and
// connects. This is evasion, not the old free damage-absorb armor, so it never
// eats a hit it shouldn't.
//
// Counterplay is preserved (it is NOT "grab always beats slap"):
//   • A slap that was ALREADY ACTIVE before the grab began still connects —
//     you can't grab your way out of a slap that is already landing. That is
//     the `grabStartupStartTime <= slapActiveTime` guard below.
//   • Reading the (readable, 165ms) grab and simply NOT slapping punishes the
//     grab's long whiff recovery.
//   • Charged and palm still break grab startup outright (separate branches).
//
// Returns true when the grab slips (beats) this slap.
function grabSlipsSlap(grabber, slapper) {
  if (!grabber.grabStartupStartTime || !slapper.attackStartTime) return false;
  const slapActiveTime = slapper.attackStartTime + SLAP_ATTACK_STARTUP_MS;
  // Grab began at or before the slap's hitbox came out → the slap is slipped.
  // Grab began AFTER the slap was already active → the slap connects (stuffs).
  return grabber.grabStartupStartTime <= slapActiveTime;
}

// NOTE: The legacy throw-tech system (checkForThrowTech / checkForGrabPriority /
// applyThrowTech) was removed with the legacy W-throw input path. Mutual grab
// attempts now resolve via executeGrabTech in grabMechanics.js, and clinch
// interactions are handled in grabActionSystem.js.

module.exports = {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  grabSlipsSlap,
};

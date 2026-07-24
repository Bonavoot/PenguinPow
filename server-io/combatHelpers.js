const {
  GRAB_RANGE,
  GRAB_SLAP_CATCH_RANGE,
  GRAB_STARTUP_DURATION_MS,
  GRAB_ACTIVE_MS,
  GRAB_THROW_CATCH_START_MS,
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

// COMMAND-GRAB THROW CATCH (SF-style, tuned for slap frame data)
//
// Problem with "active-only catch": grab startup (145ms) > slap recovery (75ms),
// so under point-blank slap mash there is NO safe press that reaches active
// without getting stuffed. Pure active-only priority is structurally too weak.
//
// Model:
//   • Early startup (0 → GRAB_THROW_CATCH_START_MS): fully hittable. Meaty /
//     react slaps stuff the grab. No ghost whiffs during the telegraph.
//   • Late startup + active: throw-catch. If in grab range, clinch the same
//     tick — grab takes the slap's active frame instead of the slap resolving.
//   • Charged / palm / low kick still stuff grab (separate collision branches).
function getGrabThrowCatchElapsed(grabber, now) {
  if (!grabber?.isGrabStartup || !grabber.grabStartupStartTime) return null;
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  const elapsed = now - grabber.grabStartupStartTime;
  if (elapsed < 0 || elapsed >= startupMs + GRAB_ACTIVE_MS) return null;
  return elapsed;
}

function isGrabInActiveWindow(grabber, now) {
  const elapsed = getGrabThrowCatchElapsed(grabber, now);
  if (elapsed == null) return false;
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  return elapsed >= startupMs;
}

function isGrabInThrowCatchWindow(grabber, now) {
  const elapsed = getGrabThrowCatchElapsed(grabber, now);
  if (elapsed == null) return false;
  return elapsed >= GRAB_THROW_CATCH_START_MS;
}

function isOpponentInGrabSlapCatchRange(grabber, opponent) {
  const catchRange = GRAB_SLAP_CATCH_RANGE * (grabber.sizeMultiplier || 1);
  return Math.abs(grabber.x - opponent.x) < catchRange;
}

// True when grab throw-catch frames should beat this slap.
// Caller supplies `now` on the sim clock (e.g. simNowForPlayer(grabber)).
function grabCatchesSlap(grabber, slapper, now) {
  if (!isGrabInThrowCatchWindow(grabber, now)) return false;
  if (!slapper?.isAttacking || slapper.attackType !== "slap") return false;
  if (slapper.isBeingThrown || slapper.isBeingGrabbed) return false;
  if (grabber.isBeingGrabbed || grabber.throwTechCooldown) return false;
  if (slapper.grabImmune && now < slapper.grabImmuneEndTime) return false;
  if (!isOpponentInFrontOfGrabber(grabber, slapper)) return false;
  return isOpponentInGrabSlapCatchRange(grabber, slapper);
}

// NOTE: The legacy throw-tech system (checkForThrowTech / checkForGrabPriority /
// applyThrowTech) was removed with the legacy W-throw input path. Mutual grab
// attempts now resolve via executeGrabTech in grabMechanics.js, and clinch
// interactions are handled in grabActionSystem.js.

module.exports = {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  isGrabInActiveWindow,
  isGrabInThrowCatchWindow,
  isOpponentInGrabSlapCatchRange,
  grabCatchesSlap,
};

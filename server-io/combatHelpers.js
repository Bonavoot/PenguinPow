const {
  GRAB_RANGE,
  GRAB_STARTUP_DURATION_MS,
  GRAB_ACTIVE_MS,
  GRAB_LUNGE_DISTANCE,
  GRAB_LUNGE_FRICTION,
  TICK_RATE,
  speedFactor,
} = require("./constants");

// ── Grab dive physics ───────────────────────────────────────────────────────
// The dive is an impulse bled off by friction, integrated the same way every other
// moving thing in this game is: `x += delta * speedFactor * v` then `v *= friction`.
//
// GRAB_LUNGE_DISTANCE authors the TOTAL travel of that decay, so the impulse has to
// be solved backwards from it. Summing the geometric series of per-tick travel:
//
//   total = Σ tickMs · speedFactor · v₀ · fⁿ = tickMs · speedFactor · v₀ / (1 − f)
//
// which inverts to the impulse below, and gives a closed form for how far the dive
// has travelled after n ticks. Both live here rather than inline in the sim so the
// frame-data guardrails measure the same curve the game actually runs, instead of a
// second copy that can drift away from it.
const NOMINAL_TICK_MS = 1000 / TICK_RATE;
const TRAVEL_PER_TICK_AT_UNIT_VELOCITY = NOMINAL_TICK_MS * speedFactor;

function getGrabLungeImpulse() {
  return (
    (GRAB_LUNGE_DISTANCE * (1 - GRAB_LUNGE_FRICTION)) /
    TRAVEL_PER_TICK_AT_UNIT_VELOCITY
  );
}

// Distance covered by `elapsedMs` into the dive. Used by the sim only for
// reasoning/tests — the live position comes from real per-tick integration, which
// tracks this within rounding.
function getGrabLungeTravel(elapsedMs) {
  if (!(elapsedMs > 0)) return 0;
  const ticks = elapsedMs / NOMINAL_TICK_MS;
  return GRAB_LUNGE_DISTANCE * (1 - Math.pow(GRAB_LUNGE_FRICTION, ticks));
}

// How far the dive carries while the grab can still CATCH something — startup plus
// active. Everything past this is skid during recovery, so it is threat range that
// this measures, not total travel.
function getGrabThreatTravel() {
  return getGrabLungeTravel(GRAB_STARTUP_DURATION_MS + GRAB_ACTIVE_MS);
}

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

// COMMAND-GRAB TIMELINE — no armor anywhere on it.
//
// The grab used to carry a "throw catch": from 70ms into startup it beat any
// slap in range. That was load-bearing at the old 145ms startup, because 145 is
// longer than the 130ms gap a slap masher leaves between active windows, so
// without it a point-blank grab was arithmetically impossible. It was also
// invisible — a grab at 60ms and one at 80ms looked identical and resolved
// oppositely, with the elapsed time never even reaching the client.
//
// The startup was cut instead (see GRAB_STARTUP_MS), which makes the armor
// unnecessary and the model physical:
//   • Startup: fully hittable, every frame. Any live hitbox that reaches you
//     stuffs the grab, slap included. The grab has to fit in a GAP.
//   • Active: connect window. In range → clinch.
// Nothing about the outcome depends on state you cannot see.
function getGrabTimelineElapsed(grabber, now) {
  if (!grabber?.isGrabStartup || !grabber.grabStartupStartTime) return null;
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  const elapsed = now - grabber.grabStartupStartTime;
  if (elapsed < 0 || elapsed >= startupMs + GRAB_ACTIVE_MS) return null;
  return elapsed;
}

function isGrabInActiveWindow(grabber, now) {
  const elapsed = getGrabTimelineElapsed(grabber, now);
  if (elapsed == null) return false;
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  return elapsed >= startupMs;
}

// Position curves for every separation tween in index.js (grab break, pull
// reversal, kill-pull belly slide, drive release).
//
// The number that matters for how violent a separation LOOKS is not the
// distance or the duration, it is the curve's peak speed as a multiple of its
// own average — because that peak is what the eye actually clocks:
//
//   hit    cubic ease-out    3.00x, all of it on the first frame
//   swap   cubic ease-in-out 3.00x, all of it at the midpoint
//   shove  sine ease-in-out  1.57x, spread across the whole slide
//
// The two cubics are interchangeable on peak speed and differ only in WHEN the
// spike lands — worth knowing, because moving a drive release from ease-out to
// ease-in-out changes when it looks fast without making it any slower.
const SEPARATION_EASE = {
  // A hit: every bit of speed exists at contact, then it bleeds into the ice.
  hit: (t) => 1 - Math.pow(1 - t, 3),
  // Boundary pull swap: both fighters must cross at t=0.5 to meet the arc peak.
  swap: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Drive release: nobody was struck, the loser shoves the winner off. Sine is
  // the flattest curve that still starts and stops at rest, so the shove can
  // cover a separation the anti-loop rule fixes at ~130px without any single
  // frame of it moving faster than the game's own top locomotion by much.
  shove: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
};

function grabSeparationEase(t, curve) {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return (SEPARATION_EASE[curve] || SEPARATION_EASE.hit)(clamped);
}

// NOTE: The legacy throw-tech system (checkForThrowTech / checkForGrabPriority /
// applyThrowTech) was removed with the legacy W-throw input path. Mutual grab
// attempts now resolve via executeGrabTech in grabMechanics.js, and clinch
// interactions are handled in grabActionSystem.js.

module.exports = {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
  isGrabInActiveWindow,
  getGrabLungeImpulse,
  getGrabLungeTravel,
  getGrabThreatTravel,
  grabSeparationEase,
};

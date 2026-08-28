const {
  GRAB_STARTUP_DURATION_MS,
  GRAB_ACTIVE_MS,
  GRAB_LUNGE_SPEED,
  GRAB_LUNGE_SPEED_CAP,
  GRAB_LUNGE_FRICTION,
  TICK_RATE,
  speedFactor,
} = require("./constants");
const { getMinimumCenterDistance } = require("./pushboxGeometry");

// ── Grab run physics ────────────────────────────────────────────────────────
// Stamp a run speed, then `x += delta * speedFactor * v` and `v *= friction`.
// While the grab is live, friction is a kiss (GRAB_LUNGE_FRICTION ≈ 1) so
// you keep running. Recovery swaps in GRAB_WHIFF_FRICTION — that is the
// slowdown. Travel is a consequence of speed × time, not a 110px cap.
const NOMINAL_TICK_MS = 1000 / TICK_RATE;
const TRAVEL_PER_TICK_AT_UNIT_VELOCITY = NOMINAL_TICK_MS * speedFactor;

function getGrabLungeImpulse() {
  return GRAB_LUNGE_SPEED;
}

// Standing run is the floor. Incoming slide may raise it. Cap is a
// power slide — not uncapped Happy Feet. Drive uses this same number.
function getGrabAttemptSpeed(incomingAbs = 0) {
  const incoming = Number.isFinite(incomingAbs) ? Math.abs(incomingAbs) : 0;
  return Math.min(GRAB_LUNGE_SPEED_CAP, Math.max(GRAB_LUNGE_SPEED, incoming));
}

function grabSpeedToPxPerSec(speed) {
  const v =
    Number.isFinite(speed) && speed > 0 ? speed : GRAB_LUNGE_SPEED;
  return v * TRAVEL_PER_TICK_AT_UNIT_VELOCITY * TICK_RATE;
}

// Drive opens at the attempt slide, then eases up — skating into the
// shove-off. Peak is capped at a power slide so a slide-in cannot
// blaze. Live velocity wins; stamped attempt speed is the fallback.
const DRIVE_CARRY_END_SPEED_MULT = 1.25;

function getDriveCarrySpeed(grabber) {
  const live = Math.abs(Number(grabber && grabber.grabMovementVelocity) || 0);
  const stamped = Number(grabber && grabber.grabAttemptSpeed) || 0;
  return getGrabAttemptSpeed(live > 0 ? live : stamped);
}

function resolveDriveCarryEndMult(speed) {
  const v0 = grabSpeedToPxPerSec(speed);
  const cap = grabSpeedToPxPerSec(GRAB_LUNGE_SPEED_CAP);
  if (!(v0 > 0)) return 1;
  const wanted = v0 * DRIVE_CARRY_END_SPEED_MULT;
  return Math.max(1, Math.min(wanted, cap) / v0);
}

function driveCarryAccelCoef(endMult) {
  const m = endMult > 0 ? endMult : 1;
  return 2 / (m + 1);
}

// Constant accel from v0 to min(v0*mult, ice-slide cap) over distance D.
// Same distance, longer clock when the peak is clamped.
function getDriveCarryDurationMs(distancePx, speed) {
  const d = Math.max(0, Number(distancePx) || 0);
  const v0 = grabSpeedToPxPerSec(speed);
  if (!(d > 0) || !(v0 > 0)) return 0;
  const endMult = resolveDriveCarryEndMult(speed);
  return Math.round((d * driveCarryAccelCoef(endMult) / v0) * 1000);
}

function driveCarryTravelT(t, speed) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const p = driveCarryAccelCoef(resolveDriveCarryEndMult(speed));
  return p * u + (1 - p) * u * u;
}

function getGrabLungeTravel(elapsedMs, friction = GRAB_LUNGE_FRICTION, speed = GRAB_LUNGE_SPEED) {
  if (!(elapsedMs > 0)) return 0;
  const ticks = elapsedMs / NOMINAL_TICK_MS;
  if (friction >= 1) return ticks * TRAVEL_PER_TICK_AT_UNIT_VELOCITY * speed;
  return (
    (TRAVEL_PER_TICK_AT_UNIT_VELOCITY * speed * (1 - Math.pow(friction, ticks))) /
    (1 - friction)
  );
}

function getGrabThreatTravel() {
  return getGrabLungeTravel(GRAB_STARTUP_DURATION_MS + GRAB_ACTIVE_MS);
}

// Hands-on-belly latch. Must sit INSIDE slap tip or an incoming dive
// connects in the 175-range vacuum before a tip poke can clang.
// Ice jitter uses the same 1.5px epsilon as strike confirm.
const GRAB_CONNECT_EPSILON_PX = 1.5;

function getGrabConnectDistance(grabber, defender) {
  return getMinimumCenterDistance(
    grabber?.sizeMultiplier,
    defender?.sizeMultiplier
  );
}

function isOpponentCloseEnoughForGrab(player, opponent) {
  const limit = getGrabConnectDistance(player, opponent);
  return Math.abs(player.x - opponent.x) <= limit + GRAB_CONNECT_EPSILON_PX;
}

function isOpponentInFrontOfGrabber(player, opponent) {
  // Commit facing wins. Live facing can flip when they sidestep; the
  // attempt must not start grabbing "the new front."
  // facing: 1 = facing left, -1 = facing right
  const facing =
    player.grabFacingDirection === 1 || player.grabFacingDirection === -1
      ? player.grabFacingDirection
      : player.facing;
  const BEHIND_TOLERANCE = 20;
  const facingDirection = facing === 1 ? -1 : 1;
  const relativePos = (opponent.x - player.x) * facingDirection;
  return relativePos >= -BEHIND_TOLERANCE;
}

// GRAB TIMELINE — overlap always resolves (see grabStartupArmor.js).
// Reaching / tip poke / slap already out when the grip turns on → real hit.
// Late slap after the grip is on → CATCH. Shatter Palm always stuffs.
// Latch is pushbox-touch, not GRAB_RANGE.
function getGrabTimelineElapsed(grabber, now) {
  if (!grabber?.isGrabStartup || !grabber.grabStartupStartTime) return null;
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  const elapsed = now - grabber.grabStartupStartTime;
  const activeMs = grabber.grabActiveDuration || GRAB_ACTIVE_MS;
  if (elapsed < 0 || elapsed >= startupMs + activeMs) return null;
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
  getGrabConnectDistance,
  isOpponentInFrontOfGrabber,
  isGrabInActiveWindow,
  getGrabLungeImpulse,
  getGrabAttemptSpeed,
  grabSpeedToPxPerSec,
  getDriveCarrySpeed,
  getDriveCarryDurationMs,
  driveCarryTravelT,
  resolveDriveCarryEndMult,
  DRIVE_CARRY_END_SPEED_MULT,
  getGrabLungeTravel,
  getGrabThreatTravel,
  grabSeparationEase,
};

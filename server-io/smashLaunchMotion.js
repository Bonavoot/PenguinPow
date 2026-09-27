"use strict";

/**
 * Closed-form Smash launch with air resistance, then an ice coast.
 *
 * Gravity is a separate constant. Same-height landing ⇒ y = 4H·u·(1−u),
 * peak always at mid-flight. Horizontal speed is NOT a cruise: v decays
 * exponentially (drag), so they leave fast and you feel them hit air.
 * Leftover speed at the plant becomes ice `movementVelocity` — DI-able,
 * not locked. Kill / ring-out / swap cinematics do not use this.
 */

const { speedFactor, ICE_MAX_SPEED } = require("./constants");

/** Full-power air-drag k. Higher = faster leave, more resistance in the tail. */
const THROW_DECAY_K = 2.15;
const PULL_DECAY_K = 1.68;

/**
 * Leftover launch speed → ice. Scale keeps the scoot a continuation
 * (~walk), not a second send. Cap so a no-DI coast cannot rewrite KO range.
 */
const ICE_CONTINUE_SCALE = 0.48;
const ICE_CONTINUE_CAP = ICE_MAX_SPEED * 0.55; // ~0.72

function clamp01(v) {
  return Math.max(0, Math.min(1, typeof v === "number" ? v : 0));
}

/**
 * How much of the heavy yank/toss curve to use. This is the posture
 * parameter itself — no dead zone. A gate here is what made 52 posture
 * feel identical to full and 44 posture chuck them: power 0.32 snapped
 * from "gentle" to "heavy" across about thirteen points of bar.
 */
function smashLaunchAmount(power) {
  return clamp01(power);
}

/**
 * y = v0 t − ½ g t² with v0 = 2H/T, g = 4H/T² → 4H·u·(1−u).
 * Rise and fall share the same |g|. Peak is always u = 0.5.
 */
function smashBallisticY(u, height) {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  const h = Math.max(0, height || 0);
  if (t <= 0 || t >= 1 || h <= 0) return 0;
  return h * 4 * t * (1 - t);
}

/**
 * Exponential air-drag travel, normalized so x(1) = 1.
 *   v(u) = v0 · e^{−k u}
 *   x(u) = (1 − e^{−k u}) / (1 − e^{−k})
 * k = 0 is a cruise (linear). k ≈ 2 is a hard send that still crawls
 * through the last quarter — then ice takes the leftover.
 */
function smashDecayTravel(u, k) {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const drag = typeof k === "number" && k > 1e-6 ? k : 0;
  if (drag <= 0) return t;
  const grow = 1 - Math.exp(-drag);
  if (grow <= 1e-9) return t;
  return (1 - Math.exp(-drag * t)) / grow;
}

function smashDecayKForThrow(power) {
  return THROW_DECAY_K * smashLaunchAmount(power);
}

function smashDecayKForPull(power) {
  return PULL_DECAY_K * smashLaunchAmount(power);
}

function smashThrowTravelX(u, power) {
  return smashDecayTravel(u, smashDecayKForThrow(power));
}

function smashPullTravelX(u, power) {
  return smashDecayTravel(u, smashDecayKForPull(power));
}

function smashLaunchVy(height, durationMs) {
  const T = Math.max(1, durationMs) / 1000;
  return (4 * Math.max(0, height || 0)) / T;
}

/** Initial horizontal launch speed (px/s). k = 0 → D/T cruise. */
function smashLaunchVx(distance, durationMs, k) {
  const T = Math.max(1, durationMs) / 1000;
  const dist = Math.max(0, distance || 0);
  const drag = typeof k === "number" && k > 1e-6 ? k : 0;
  if (drag <= 0) return dist / T;
  const grow = 1 - Math.exp(-drag);
  if (grow <= 1e-9) return dist / T;
  return (dist * drag) / (T * grow);
}

function smashResidualPxPerSec(distancePx, durationMs, k) {
  const dist = Math.max(0, Number(distancePx) || 0);
  const dur = Math.max(1, Number(durationMs) || 1);
  const drag = typeof k === "number" && k > 1e-4 ? k : 0;
  if (drag <= 0 || dist <= 0) return 0;
  return smashLaunchVx(dist, dur, drag) * Math.exp(-drag);
}

/**
 * Leftover launch speed as ice `movementVelocity`.
 * `x += v * delta * speedFactor` ⇒ 1 vel = 1000*speedFactor px/s.
 */
function smashResidualCoastVelocity(distancePx, durationMs, k, dir) {
  const pxPerSec = smashResidualPxPerSec(distancePx, durationMs, k);
  if (pxPerSec <= 0) return 0;
  let v = (pxPerSec / (1000 * speedFactor)) * ICE_CONTINUE_SCALE;
  v = Math.min(ICE_CONTINUE_CAP, v);
  return (dir < 0 ? -1 : 1) * v;
}

function launchIceCoastVelocity({
  distancePx,
  durationMs,
  power,
  dir,
  kind,
}) {
  const k =
    kind === "pull"
      ? smashDecayKForPull(power)
      : smashDecayKForThrow(power);
  return smashResidualCoastVelocity(distancePx, durationMs, k, dir);
}

module.exports = {
  THROW_DECAY_K,
  PULL_DECAY_K,
  ICE_CONTINUE_SCALE,
  ICE_CONTINUE_CAP,
  smashLaunchAmount,
  smashBallisticY,
  smashDecayTravel,
  smashDecayKForThrow,
  smashDecayKForPull,
  smashThrowTravelX,
  smashPullTravelX,
  smashLaunchVy,
  smashLaunchVx,
  smashResidualPxPerSec,
  smashResidualCoastVelocity,
  launchIceCoastVelocity,
};

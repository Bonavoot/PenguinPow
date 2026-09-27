"use strict";

/**
 * Command-grab THROW (W) — setup dump, not a Smash-percent yeet.
 *
 * Mid-ring: fixed-distance parabola to an authored land. You can read the
 * landing spot. Posture raises the arc and the plant. It does not move X.
 * Near the tawara: outbound hop into the straw, then a bounce hop inward.
 * The rebound shrinks as posture drops. Under the kill line there is no bounce.
 * Kill throw keeps its own cinematic in index.js.
 */

const {
  BALANCE_MAX,
  CLINCH_THROW_KILL_THRESHOLD,
  SETUP_THROW_ARC_HEIGHT,
  SETUP_THROW_ARC_HEIGHT_BROKEN,
  SETUP_THROW_DURATION_MS,
  SETUP_THROW_RICOCHET_DURATION_MS,
  SETUP_THROW_RICOCHET_BOUNCE_HEIGHT,
  SETUP_THROW_RICOCHET_HIT_AT,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  HITSTOP_THROW_MS,
} = require("./constants");
const { smashBallisticY, smashLaunchVy } = require("./smashLaunchMotion");

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function throwTossPowerFromBalance(balance) {
  const bal = Math.max(
    CLINCH_THROW_KILL_THRESHOLD,
    Math.min(BALANCE_MAX, typeof balance === "number" ? balance : BALANCE_MAX)
  );
  const span = Math.max(1, BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD);
  const t = 1 - (bal - CLINCH_THROW_KILL_THRESHOLD) / span;
  return clamp01(t);
}

function throwTossDurationMs(_balance) {
  return SETUP_THROW_DURATION_MS;
}

function throwTossArcHeight(balance) {
  const p = throwTossPowerFromBalance(balance);
  const floor = SETUP_THROW_ARC_HEIGHT;
  const ceil = SETUP_THROW_ARC_HEIGHT_BROKEN || floor;
  return Math.round(floor + (ceil - floor) * p);
}

function throwTossPeakAt(_power) {
  return 0.5;
}

function tossArcY(t, height, _power) {
  return smashBallisticY(t, height);
}

/** Ease-out dump — they leave your belt, then settle onto a readable spot. */
function setupThrowTravelX(t) {
  const u = clamp01(t);
  return 1 - (1 - u) * (1 - u);
}

function tossTravelX(t, _power) {
  return setupThrowTravelX(t);
}

function sampleSetupThrowX(progress, path) {
  const t = clamp01(progress);
  const startX = path.startX;
  const landX = path.landX;
  if (!path.ricochet) {
    return startX + (landX - startX) * setupThrowTravelX(t);
  }
  const hitAt = Number.isFinite(path.hitAt)
    ? path.hitAt
    : SETUP_THROW_RICOCHET_HIT_AT;
  const hitX = path.hitX;
  if (t <= hitAt) {
    const u = hitAt > 0 ? t / hitAt : 1;
    return startX + (hitX - startX) * setupThrowTravelX(u);
  }
  const span = Math.max(1e-6, 1 - hitAt);
  const u = (t - hitAt) / span;
  return hitX + (landX - hitX) * setupThrowTravelX(u);
}

function sampleSetupThrowY(progress, path) {
  const t = clamp01(progress);
  const height = Number.isFinite(path.height)
    ? path.height
    : SETUP_THROW_ARC_HEIGHT;
  if (!path.ricochet) {
    return smashBallisticY(t, height);
  }
  const hitAt = Number.isFinite(path.hitAt)
    ? path.hitAt
    : SETUP_THROW_RICOCHET_HIT_AT;
  const bounce = Number.isFinite(path.bounceHeight)
    ? path.bounceHeight
    : SETUP_THROW_RICOCHET_BOUNCE_HEIGHT;
  if (t <= hitAt) {
    const u = hitAt > 0 ? t / hitAt : 1;
    return smashBallisticY(u, height);
  }
  const span = Math.max(1e-6, 1 - hitAt);
  return smashBallisticY((t - hitAt) / span, bounce);
}

function throwTossLaunchHitstopMs(_power) {
  return CMD_THROW_LAUNCH_HITSTOP_MS;
}

function throwTossLandHitstopMs(_power) {
  return HITSTOP_THROW_MS;
}

function throwTossLaunchShakeScale(power) {
  const p = clamp01(typeof power === "number" ? power : 0);
  return 0.78 + p * 0.52;
}

function throwTossLandShakeScale(power) {
  const p = clamp01(typeof power === "number" ? power : 0);
  // Setup plant always thuds. Broken posture just hits harder.
  return 0.88 + p * 0.42;
}

function describeThrowToss(balance) {
  const power = throwTossPowerFromBalance(balance);
  const durationMs = throwTossDurationMs(balance);
  const arcHeight = throwTossArcHeight(balance);
  return {
    power,
    durationMs,
    arcHeight,
    peakAt: throwTossPeakAt(power),
    launchVy: smashLaunchVy(arcHeight, durationMs),
    launchHitstopMs: throwTossLaunchHitstopMs(power),
    landHitstopMs: throwTossLandHitstopMs(power),
    launchShakeScale: throwTossLaunchShakeScale(power),
    landShakeScale: throwTossLandShakeScale(power),
  };
}

function sampleTossHangFraction(power, steps = 240) {
  const h = 100;
  const p = clamp01(typeof power === "number" ? power : 0);
  let n = 0;
  for (let i = 0; i <= steps; i++) {
    if (tossArcY(i / steps, h, p) >= h * 0.85) n += 1;
  }
  return n / (steps + 1);
}

function sampleTossPeakPxPerSec(distancePx, durationMs, power, steps = 240) {
  const dist = Math.max(0, distancePx || 0);
  const dur = Math.max(1, durationMs || 1);
  const dt = dur / steps / 1000;
  let peak = 0;
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const x = tossTravelX(i / steps, power) * dist;
    const v = Math.abs(x - prev) / dt;
    if (v > peak) peak = v;
    prev = x;
  }
  return peak;
}

module.exports = {
  throwTossPowerFromBalance,
  throwTossDurationMs,
  throwTossArcHeight,
  throwTossPeakAt,
  tossArcY,
  tossTravelX,
  setupThrowTravelX,
  sampleSetupThrowX,
  sampleSetupThrowY,
  throwTossLaunchHitstopMs,
  throwTossLandHitstopMs,
  throwTossLaunchShakeScale,
  throwTossLandShakeScale,
  describeThrowToss,
  sampleTossHangFraction,
  sampleTossPeakPxPerSec,
  SETUP_THROW_DURATION_MS,
  SETUP_THROW_RICOCHET_DURATION_MS,
};

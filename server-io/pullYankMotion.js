"use strict";

/**
 * Command-grab PULL.
 *
 * Healthy: TAKE → SNAP → ICE SLIDE (mass, then the break, then friction).
 * Heavy (low posture): the same three beats on a LONGER clock — you feel
 * the belt load, then a strong yank, then air/ice resistance. The lock
 * dies with the tween; leftover speed hands off 1:1 onto ice so the slide
 * does not hitch when they can act again.
 * Kill / swap keep their own cinematics.
 */

const {
  BALANCE_MAX,
  CLINCH_THROW_KILL_THRESHOLD,
  CMD_PULL_TWEEN_MIN_MS,
  CMD_PULL_TWEEN_BROKEN_MS,
  TICK_RATE,
  speedFactor,
  ICE_MAX_SPEED,
} = require("./constants");
const {
  smashLaunchAmount,
  smashDecayTravel,
} = require("./smashLaunchMotion");

const YANK_TAKE_END = 0.16;
const YANK_SNAP_END = 0.42;
const YANK_TAKE_DIST = 0.08;
const YANK_SNAP_DIST = 0.50;

// Heavy yank keeps a real TAKE (the weight). Snap is firm but not a fling.
// Tail is exponential drag so they are still moving at unlock.
const HEAVY_TAKE_END = 0.16;
const HEAVY_SNAP_END = 0.48;
const HEAVY_TAKE_DIST = 0.07;
const HEAVY_SNAP_DIST = 0.50;
const HEAVY_TAIL_K = 2.1;

const HARD_SNAP_END = HEAVY_SNAP_END;
const HARD_HOP_DELAY = 0.50;

function clamp01(v) {
  return Math.max(0, Math.min(1, typeof v === "number" ? v : 0));
}

function pullYankPowerFromBalance(balance) {
  const bal = Math.max(
    CLINCH_THROW_KILL_THRESHOLD,
    Math.min(BALANCE_MAX, typeof balance === "number" ? balance : BALANCE_MAX)
  );
  const span = Math.max(1, BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD);
  const t = 1 - (bal - CLINCH_THROW_KILL_THRESHOLD) / span;
  return clamp01(t) * clamp01(t);
}

function pullYankDurationMs(balance) {
  const p = pullYankPowerFromBalance(balance);
  return Math.round(
    CMD_PULL_TWEEN_MIN_MS + (CMD_PULL_TWEEN_BROKEN_MS - CMD_PULL_TWEEN_MIN_MS) * p
  );
}

function yankEaseWeighted(x) {
  if (x < YANK_TAKE_END) {
    const u = x / YANK_TAKE_END;
    return YANK_TAKE_DIST * u * u * u;
  }
  if (x < YANK_SNAP_END) {
    const u = (x - YANK_TAKE_END) / (YANK_SNAP_END - YANK_TAKE_END);
    const s = u * u * (3 - 2 * u);
    return YANK_TAKE_DIST + YANK_SNAP_DIST * s;
  }
  const u = (x - YANK_SNAP_END) / (1 - YANK_SNAP_END);
  const s = 1 - (1 - u) * (1 - u);
  return (
    YANK_TAKE_DIST +
    YANK_SNAP_DIST +
    (1 - YANK_TAKE_DIST - YANK_SNAP_DIST) * s
  );
}

function yankEaseHeavy(x) {
  if (x < HEAVY_TAKE_END) {
    const u = x / HEAVY_TAKE_END;
    return HEAVY_TAKE_DIST * u * u * u;
  }
  if (x < HEAVY_SNAP_END) {
    const u = (x - HEAVY_TAKE_END) / (HEAVY_SNAP_END - HEAVY_TAKE_END);
    const s = u * u * (3 - 2 * u);
    return HEAVY_TAKE_DIST + HEAVY_SNAP_DIST * s;
  }
  const u = (x - HEAVY_SNAP_END) / (1 - HEAVY_SNAP_END);
  const start = HEAVY_TAKE_DIST + HEAVY_SNAP_DIST;
  return start + (1 - start) * smashDecayTravel(u, HEAVY_TAIL_K);
}

function yankEase(t, power) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  if (x >= 1) return 1;
  if (x <= 0) return 0;
  const a = smashLaunchAmount(power);
  if (a <= 0) return yankEaseWeighted(x);
  const heavy = yankEaseHeavy(x);
  if (a >= 1) return heavy;
  return yankEaseWeighted(x) * (1 - a) + heavy * a;
}

function yankSnapEnd(power) {
  const a = smashLaunchAmount(power);
  return YANK_SNAP_END + (HARD_SNAP_END - YANK_SNAP_END) * a;
}

function yankHopDelay(power) {
  const a = smashLaunchAmount(power);
  return YANK_SNAP_END + (HARD_HOP_DELAY - YANK_SNAP_END) * a;
}

function pullYankHopProfile(power) {
  const p = clamp01(typeof power === "number" ? power : 0);
  return {
    hopDelay: yankHopDelay(p),
    hopCount: 2,
    hopHeights: [Math.round(5 + p * 6), Math.round(2 + p * 3)],
  };
}

function pullYankShakeScale(power) {
  const p = clamp01(typeof power === "number" ? power : 0);
  return 0.72 + p * 0.58;
}

function describePullYank(balance) {
  const power = pullYankPowerFromBalance(balance);
  return {
    power,
    durationMs: pullYankDurationMs(balance),
    curve: "yank",
    hops: pullYankHopProfile(power),
    shakeScale: pullYankShakeScale(power),
  };
}

function sampleYankPeakPxPerSec(distancePx, durationMs, power, steps = 240) {
  const dist = Math.max(0, distancePx || 0);
  const dur = Math.max(1, durationMs || 1);
  const p = clamp01(typeof power === "number" ? power : 0);
  const dt = dur / steps / 1000;
  let peak = 0;
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const x = yankEase(i / steps, p) * dist;
    const v = Math.abs(x - prev) / dt;
    if (v > peak) peak = v;
    prev = x;
  }
  return peak;
}

function sampleYankSpeedAt(t, distancePx, durationMs, power) {
  const dist = Math.max(0, distancePx || 0);
  const dur = Math.max(1, durationMs || 1);
  const p = clamp01(typeof power === "number" ? power : 0);
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  const dt = 1 / 240;
  const a = yankEase(Math.max(0, x - dt), p) * dist;
  const b = yankEase(Math.min(1, x + dt), p) * dist;
  return Math.abs(b - a) / ((2 * dt * dur) / 1000);
}

/** Instantaneous yank speed at the last sim step of the tween (px/s). */
function yankEndPxPerSec(distancePx, durationMs, power) {
  const dist = Math.max(0, Number(distancePx) || 0);
  const dur = Math.max(1, Number(durationMs) || 1);
  const p = clamp01(typeof power === "number" ? power : 0);
  const du = Math.min(0.05, 1000 / TICK_RATE / dur);
  const a = yankEase(Math.max(0, 1 - du), p) * dist;
  const b = yankEase(1, p) * dist;
  return Math.abs(b - a) / ((du * dur) / 1000);
}

/**
 * 1:1 leftover → ice. Matching the last tween step is what makes unlock
 * a continuation instead of a plant-then-scoot.
 */
function yankHandoffVelocity(distancePx, durationMs, power, dir) {
  const pxPerSec = yankEndPxPerSec(distancePx, durationMs, power);
  if (pxPerSec < 24) return 0;
  let v = pxPerSec / (1000 * speedFactor);
  v = Math.min(ICE_MAX_SPEED, v);
  return (dir < 0 ? -1 : 1) * v;
}

module.exports = {
  YANK_TAKE_END,
  YANK_SNAP_END,
  YANK_TAKE_DIST,
  YANK_SNAP_DIST,
  HEAVY_TAKE_END,
  HEAVY_SNAP_END,
  HEAVY_TAKE_DIST,
  HEAVY_SNAP_DIST,
  yankEase,
  yankSnapEnd,
  yankHopDelay,
  pullYankPowerFromBalance,
  pullYankDurationMs,
  pullYankHopProfile,
  pullYankShakeScale,
  describePullYank,
  sampleYankPeakPxPerSec,
  sampleYankSpeedAt,
  yankEndPxPerSec,
  yankHandoffVelocity,
};

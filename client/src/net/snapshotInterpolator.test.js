/**
 * Jitter-buffered remote presentation.
 * Run: node --test client/src/net/snapshotInterpolator.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SnapshotInterpolator, SERVER_SNAPSHOT_INTERVAL_MS, LOCAL_INTERP_DELAY_MS } from "./snapshotInterpolator.js";

// Deterministic PRNG so the jitter pattern is reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Simulate a fighter moving at constant velocity whose 64 Hz snapshots arrive
 * with the given jitter; render at 60 fps; return per-frame rendered speeds.
 */
function simulate({ jitterMs, delayOverride = null, stallEveryMs = 0, stallMs = 0, seconds = 6, seed = 7 }) {
  const rand = rng(seed);
  const interp = new SnapshotInterpolator();
  const vx = 0.24; // px per ms (≈ full strafe speed)
  const snaps = [];
  for (let simT = 0; simT < seconds * 1000; simT += SERVER_SNAPSHOT_INTERVAL_MS) {
    let arrival = simT + 50 + (rand() * 2 - 1) * jitterMs; // 50 ms one-way + jitter
    if (stallEveryMs && stallMs) {
      const phase = simT % stallEveryMs;
      if (phase < stallMs) arrival += stallMs - phase; // held until the stall ends
    }
    // serverT is the room simTime (evenly spaced); arrival is when it lands.
    snaps.push({ arrival, serverT: 100000 + simT, x: 300 + vx * simT, y: 286 });
  }
  // TCP: ordered delivery — a later snapshot can never arrive before an earlier one.
  for (let i = 1; i < snaps.length; i++) if (snaps[i].arrival < snaps[i - 1].arrival) snaps[i].arrival = snaps[i - 1].arrival + 0.01;

  const speeds = [];
  let lastX = null;
  let appliedDelay = null;
  let si = 0;
  for (let t = 200; t < seconds * 1000; t += 16.667) {
    while (si < snaps.length && snaps[si].arrival <= t) {
      interp.push(snaps[si].arrival, snaps[si].serverT, snaps[si].x, snaps[si].y);
      si++;
    }
    const p = interp.sample(t, delayOverride);
    if (p && lastX !== null) speeds.push((p.x - lastX) / 16.667);
    if (p) { lastX = p.x; appliedDelay = p.delayMs; }
  }
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length;
  const stalls = speeds.filter((v) => Math.abs(v) < 0.02).length; // frames with no motion
  const reversals = speeds.filter((v) => v < -0.02).length; // frames moving backwards
  return { mean, std: Math.sqrt(variance), stalls, reversals, frames: speeds.length, delay: appliedDelay, adaptiveDelay: interp.delayMs, vx };
}

describe("SnapshotInterpolator", () => {
  it("renders constant-velocity motion smoothly under ±30 ms jitter (no stalls, no reversals)", () => {
    const r = simulate({ jitterMs: 30 });
    assert.ok(Math.abs(r.mean - r.vx) < 0.01, `mean speed ${r.mean} ≈ ${r.vx}`);
    assert.ok(r.std < 0.06, `speed std ${r.std} should be small`);
    assert.equal(r.reversals, 0);
    assert.ok(r.stalls / r.frames < 0.02, `stalled frames ${r.stalls}/${r.frames}`);
    assert.ok(r.delay >= 40 && r.delay <= 120, `adaptive delay ${r.delay}`);
  });

  it("the undelayed path (what the old prev→current renderer effectively did) is far rougher under the same jitter", () => {
    const buffered = simulate({ jitterMs: 30 });
    const undelayed = simulate({ jitterMs: 30, delayOverride: 0 });
    assert.ok(undelayed.std > buffered.std * 2, `undelayed std ${undelayed.std} vs buffered ${buffered.std}`);
  });

  it("local fighter path: one-snapshot fixed delay is smooth AND well ahead of the remote timeline", () => {
    const local = simulate({ jitterMs: 15, delayOverride: LOCAL_INTERP_DELAY_MS });
    const remote = simulate({ jitterMs: 15 });
    assert.ok(Math.abs(local.mean - local.vx) < 0.02, `mean speed ${local.mean} ≈ ${local.vx}`);
    assert.equal(local.reversals, 0, "never moves backwards");
    assert.ok(local.std < 0.12, `speed std ${local.std} — interpolated, not a 64 Hz step`);
    assert.ok(local.delay <= LOCAL_INTERP_DELAY_MS + 0.01, `local delay ${local.delay}`);
    assert.ok(remote.delay - local.delay >= 8, `remote ${remote.delay} vs local ${local.delay}: local is materially less delayed`);
  });

  it("a 250 ms stall freezes then resumes without overshooting backwards", () => {
    const r = simulate({ jitterMs: 5, stallEveryMs: 3000, stallMs: 250 });
    assert.equal(r.reversals, 0, "never moves backwards after the burst");
    assert.ok(Math.abs(r.mean - r.vx) < 0.02);
  });

  it("a long sample() pause (hitstop) does not invent playhead time and reverse", () => {
    const i = new SnapshotInterpolator();
    i.push(0, 1000, 800, 286);
    i.push(16, 1016, 808, 286);
    i.sample(20, LOCAL_INTERP_DELAY_MS);
    // 550 ms cinematic freeze — sample() never ran; simTime held, then one rocket tick.
    i.push(570, 1016, 808, 286);
    i.push(586, 1032, 840, 286);
    const p = i.sample(586, LOCAL_INTERP_DELAY_MS);
    assert.ok(p.x >= 808 - 1 && p.x <= 840 + 8, `x ${p.x} stays on the rocket, not an extrapolated leap`);
  });

  it("a 2-tick cinematic rocket (~64 px / 16 ms) interpolates instead of teleporting", () => {
    const i = new SnapshotInterpolator();
    i.push(0, 1000, 800, 286);
    i.push(16, 1016, 832, 286);
    i.push(32, 1032, 896, 286); // 64 px in one interval — old 50 px snap treated this as a teleport
    let sawMid = false;
    for (let t = 16; t < 80; t += 8) {
      const p = i.sample(t, LOCAL_INTERP_DELAY_MS);
      if (p && p.x > 832 && p.x < 896) sawMid = true;
    }
    assert.equal(sawMid, true, "eases across the rocket segment");
  });

  it("teleports (> 100 px) snap instead of easing", () => {
    const i = new SnapshotInterpolator();
    i.push(0, 1000, 100, 286);
    i.push(16, 1031, 108, 286);
    i.push(32, 1062, 700, 286); // round reset
    // Advance frames until the playhead crosses into the 1031→1062 bracket.
    let p = null;
    for (let t = 40; t < 400; t += 16) p = i.sample(t);
    // Once bracketing the >100px jump, it snaps to the newer sample, never eases.
    assert.ok(p.x === 700 || p.x === 108, `x ${p.x} is a sample, not an eased midpoint`);
    assert.ok(p.x < 200 || p.x === 700, "never renders an in-between position across the jump");
  });

  it("bounded extrapolation never carries a descent below the lower sample", () => {
    const i = new SnapshotInterpolator();
    i.push(0, 1000, 500, 320);
    i.push(31, 1031, 500, 286); // landing
    // drive the playhead well past the newest simTime → extrapolation branch
    let p = null;
    for (let t = 40; t < 400; t += 16) p = i.sample(t);
    assert.ok(p.y >= 286, `y ${p.y} must not dip under the landing sample`);
  });

  it("local fighter override renders the newest sample with zero delay", () => {
    const i = new SnapshotInterpolator();
    i.push(0, 1000, 100, 286);
    i.push(31, 1031, 110, 286);
    const p = i.sample(31, 0);
    assert.equal(p.x, 110);
    assert.equal(p.delayMs, 0);
  });
});

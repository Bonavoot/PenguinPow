/**
 * Tick-anchored reconciliation: the predictor compares a server snapshot with
 * the exact local step that corresponds to it (via inputSeqAck +
 * inputAckSimTime + simTime) instead of guessing with `now − rtt`.
 * Run: node --test client/src/prediction/movementPredictor.anchor.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MovementPredictor, stepMovement, PREDICTION_CONSTANTS as C } from "./movementPredictor.js";

const GROUND = C.GROUND_LEVEL;
const KEYS_D = { a: false, d: true, " ": false, mouse1: false, mouse2: false };
const KEYS_NONE = { a: false, d: false, " ": false, mouse1: false, mouse2: false };

function selfState(x, v) {
  return { x, y: GROUND, movementVelocity: v, sizeMultiplier: 0.85, effectiveMoveSpeedMult: 1 };
}

/**
 * Two-sided fixed-step model: the server runs the same stepMovement on the
 * same keys, applying the key change on its first tick after arrival
 * (one-way latency), and snapshots every 2nd tick. The client runs the real
 * MovementPredictor at 60 fps and reconciles each snapshot. Returns the
 * per-snapshot |error| the predictor computed.
 */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function run({ oneWayMs, anchored, jitterMs = 0, rttEstimateMs = null, seed = 3 }) {
  const rand = rng(seed);
  const TICK = C.TICK_MS;
  const predictor = new MovementPredictor();
  const EMIT_MS = 16.667; // client emits an input packet every frame (Game.jsx cadence)
  const pressTime = 200; // ms: player presses D
  // The client's RTT estimate is a lagging median, not the instantaneous
  // one-way×2. The fallback uses it; the anchor never does.
  const rttForFallback = rttEstimateMs == null ? oneWayMs * 2 : rttEstimateMs;
  const jitter = () => (jitterMs ? (rand() * 2 - 1) * jitterMs : 0);
  // --- client input ledger: a packet per frame carrying the current keys.
  // The change to D is on the packet sent at/after pressTime; the server
  // consumes whichever packet has arrived by each tick and echoes that seq. ---
  const sentAt = new Map(); // seq → local send time
  const packets = []; // { seq, arrival, keysAreD }
  let seq = 0;
  for (let ct = 0; ct < 3000; ct += EMIT_MS) {
    seq++;
    sentAt.set(seq, ct);
    packets.push({ seq, arrival: ct + oneWayMs + Math.max(0, jitter()), keysAreD: ct >= pressTime });
  }
  for (let i = 1; i < packets.length; i++) if (packets[i].arrival < packets[i - 1].arrival) packets[i].arrival = packets[i - 1].arrival + 0.01;
  // --- server world ---
  const server = { x: 600, v: 0, wasStrafingRight: false, wasStrafingLeft: false, isStrafing: false, isBraking: false };
  let serverKeys = KEYS_NONE;
  let simTime = 100_000; // arbitrary origin, advances by TICK per tick
  let ackSeq = null, ackSim = null;
  let pi = 0;
  const snapshots = []; // { arrival, x, v, simTime, ackSeq, ackSim }
  // Mirror index.js tick() ordering: advance simTime, drain inputs (stamp the
  // ack at the post-advance simTime), step, then broadcast reads the same
  // simTime. So a same-tick consume+broadcast gives ticksSince = 0.
  for (let tick = 0, t = 7.3; t < 3000; tick++, t += TICK) {
    simTime += TICK;
    while (pi < packets.length && packets[pi].arrival <= t) {
      const pk = packets[pi++];
      serverKeys = pk.keysAreD ? KEYS_D : KEYS_NONE;
      ackSeq = pk.seq;
      ackSim = simTime; // consumed this tick (post-advance)
    }
    stepMovement(server, serverKeys, 1);
    if (tick % 2 === 0 && ackSeq !== null) {
      snapshots.push({ arrival: t + oneWayMs + Math.max(0, jitter()), x: server.x, v: server.v, simTime, ackSeq, ackSim });
    }
  }
  for (let i = 1; i < snapshots.length; i++) if (snapshots[i].arrival < snapshots[i - 1].arrival) snapshots[i].arrival = snapshots[i - 1].arrival + 0.01;
  // --- client frames ---
  const errors = [];
  let si = 0;
  let self = selfState(600, 0);
  let keys = KEYS_NONE;
  for (let now = 0; now < 3000; now += EMIT_MS) {
    if (now >= pressTime) keys = KEYS_D;
    predictor.update(now, keys, self, null, true, self.x);
    while (si < snapshots.length && snapshots[si].arrival <= now) {
      const s = snapshots[si++];
      const snap = selfState(s.x, s.v);
      snap.inputSeqAck = s.ackSeq;
      snap.inputAckSimTime = s.ackSim;
      predictor.onServerSnapshot(
        snap,
        now,
        rttForFallback,
        anchored ? s.simTime : null,
        anchored ? (sq) => sentAt.get(sq) : null
      );
      if (predictor.active && typeof predictor.lastError === "number") errors.push(Math.abs(predictor.lastError));
      self = snap; // the accumulated authoritative state the client holds
    }
  }
  const sorted = errors.slice().sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] || 0;
  const mean = errors.reduce((s, e) => s + e, 0) / Math.max(1, errors.length);
  return { n: errors.length, p50: q(0.5), p95: q(0.95), mean, corrections: errors.filter((e) => e > 1.5).length, stats: predictor.stats };
}

describe("MovementPredictor tick anchoring", () => {
  // Realistic conditions: ±20 ms arrival jitter and a lagging RTT estimate
  // (fixed 60 ms) that does not match the actual latency.
  const rtts = [30, 50, 75, 125];
  const anchoredByRtt = rtts.map((oneWayMs) => run({ oneWayMs, anchored: true, jitterMs: 20, rttEstimateMs: 60 }));

  for (let k = 0; k < rtts.length; k++) {
    const oneWayMs = rtts[k];
    it(`RTT ${oneWayMs * 2} ms + jitter: anchored reconciliation error is small and ~sub-pixel`, () => {
      const a = anchoredByRtt[k];
      assert.ok(a.n > 20, "enough samples");
      assert.ok(
        a.stats.anchored / (a.stats.anchored + a.stats.fallback) > 0.9,
        `mostly anchored: ${JSON.stringify(a.stats)}`
      );
      // p50 ≈ 0; p95 bounded by ONE max-speed tick (~3.8 px) — the residual is
      // the inherent 60 fps vs 64 Hz sampling limit, not latency error.
      assert.ok(a.p50 < 0.6, `anchored p50 ${a.p50.toFixed(2)} px ≈ 0`);
      assert.ok(a.p95 <= 4.0, `anchored p95 ${a.p95.toFixed(2)} px ≤ one tick`);
      assert.ok(a.mean < 1.5, `anchored mean ${a.mean.toFixed(2)} px`);
    });
  }

  it("anchored error does NOT grow with latency (the whole point vs `now − rtt`)", () => {
    const means = anchoredByRtt.map((r) => r.mean);
    const lo = Math.min(...means);
    const hi = Math.max(...means);
    // 60 ms → 250 ms RTT: mean error stays flat instead of scaling with RTT.
    assert.ok(hi < lo + 1.0 && hi / Math.max(0.1, lo) < 2.5, `flat across RTT: ${means.map((m) => m.toFixed(2)).join(", ")}`);
  });

  it("anchored reconciliation is independent of the (possibly wrong) RTT estimate; the fallback is not", () => {
    // Same latency, two very different RTT estimates. Anchoring ignores the
    // estimate entirely, so its error is identical; the `now − rtt` fallback
    // moves its lookup point with the estimate, so its error changes.
    const aGood = run({ oneWayMs: 75, anchored: true, jitterMs: 20, rttEstimateMs: 150 });
    const aBad = run({ oneWayMs: 75, anchored: true, jitterMs: 20, rttEstimateMs: 400 });
    assert.equal(aGood.mean.toFixed(3), aBad.mean.toFixed(3), "anchor error unchanged by the RTT estimate");
    const fGood = run({ oneWayMs: 75, anchored: false, jitterMs: 20, rttEstimateMs: 150 });
    const fBad = run({ oneWayMs: 75, anchored: false, jitterMs: 20, rttEstimateMs: 400 });
    assert.ok(Math.abs(fGood.mean - fBad.mean) > 0.5, `fallback error moves with the estimate: ${fGood.mean.toFixed(2)} vs ${fBad.mean.toFixed(2)}`);
  });

  it("falls back to the time-based lookup when a snapshot has no ack data", () => {
    const r = run({ oneWayMs: 50, anchored: false, jitterMs: 20 });
    assert.ok(r.stats.fallback > 0);
    assert.equal(r.stats.anchored, 0);
  });
});

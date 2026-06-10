// ============================================
// MOVEMENT PREDICTION — OFFLINE TEST SUITE
// ============================================
// Verifies the client-side movement predictor WITHOUT booting the game:
//   1. Constants parity against server-io (catches server tuning drift)
//   2. Physics step unit tests (analytic expectations)
//   3. Fixed-timestep determinism under irregular frame times
//   4. End-to-end reconciliation harness: a simulated server with real
//      network delays, verifying responsiveness, smoothness, convergence,
//      and correction behavior after a server-side perturbation.
//
// Run from the client/ directory:  node scripts/test-movement-prediction.mjs

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import {
  PREDICTION_CONSTANTS as C,
  stepMovement,
  isPredictionEligible,
  MovementPredictor,
} from "../src/prediction/movementPredictor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const serverConstants = require("../../server-io/constants.js");
const serverRoot = path.join(__dirname, "..", "..", "server-io");

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function freshSim(x = 640) {
  return {
    x,
    v: 0,
    wasStrafingRight: false,
    wasStrafingLeft: false,
    isStrafing: false,
    isBraking: false,
  };
}

const NO_KEYS = { a: false, d: false, s: false };

// ============================================
// 1. CONSTANTS PARITY vs server-io
// ============================================
console.log("\n[1] Constants parity vs server-io");

const parityPairs = [
  ["SPEED_FACTOR", "speedFactor"],
  ["ICE_ACCELERATION", "ICE_ACCELERATION"],
  ["ICE_MAX_SPEED", "ICE_MAX_SPEED"],
  ["ICE_INITIAL_BURST", "ICE_INITIAL_BURST"],
  ["ICE_COAST_FRICTION", "ICE_COAST_FRICTION"],
  ["ICE_MOVING_FRICTION", "ICE_MOVING_FRICTION"],
  ["ICE_BRAKE_FRICTION", "ICE_BRAKE_FRICTION"],
  ["ICE_STOP_THRESHOLD", "ICE_STOP_THRESHOLD"],
  ["ICE_TURN_BURST", "ICE_TURN_BURST"],
  ["ICE_EDGE_BRAKE_BONUS", "ICE_EDGE_BRAKE_BONUS"],
  ["ICE_EDGE_SLIDE_PENALTY", "ICE_EDGE_SLIDE_PENALTY"],
  ["DOHYO_EDGE_PANIC_ZONE", "DOHYO_EDGE_PANIC_ZONE"],
  ["GROUND_LEVEL", "GROUND_LEVEL"],
  ["HITBOX_DISTANCE_VALUE", "HITBOX_DISTANCE_VALUE"],
];
for (const [clientKey, serverKey] of parityPairs) {
  check(
    `${clientKey} === server ${serverKey}`,
    C[clientKey] === serverConstants[serverKey],
    `client=${C[clientKey]} server=${serverConstants[serverKey]}`
  );
}
check(
  "TICK_MS matches server 1000/TICK_RATE",
  approx(C.TICK_MS, 1000 / serverConstants.TICK_RATE),
  `client=${C.TICK_MS} server=${1000 / serverConstants.TICK_RATE}`
);

// Boundaries live as module-level consts in gameUtils.js — parse the source.
const gameUtilsSrc = readFileSync(path.join(serverRoot, "gameUtils.js"), "utf8");
const boundary = (name) => {
  const m = gameUtilsSrc.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : NaN;
};
for (const name of [
  "MAP_LEFT_BOUNDARY",
  "MAP_RIGHT_BOUNDARY",
  "DOHYO_LEFT_BOUNDARY",
  "DOHYO_RIGHT_BOUNDARY",
]) {
  check(
    `${name} === server gameUtils value`,
    C[name] === boundary(name),
    `client=${C[name]} server=${boundary(name)}`
  );
}

// Crouch modifiers are inline literals in the server strafe block — make sure
// they haven't been retuned without updating the mirror.
const indexSrc = readFileSync(path.join(serverRoot, "index.js"), "utf8");
check(
  "crouch accel factor (×0.2) still present in server",
  indexSrc.includes("MOVEMENT_ACCELERATION * 0.2") &&
    C.CROUCH_ACCEL_FACTOR === 0.2
);
check(
  "crouch max speed factor (×0.3) still present in server",
  indexSrc.includes("MAX_MOVEMENT_SPEED * 0.3") &&
    C.CROUCH_MAX_SPEED_FACTOR === 0.3
);
check(
  "crouch speed factor (×0.5) still present in server",
  indexSrc.includes("currentSpeedFactor * 0.5") && C.CROUCH_SPEED_FACTOR === 0.5
);
check(
  "outside-dohyo velocity penalty (×0.92) still present in server",
  indexSrc.includes("movementVelocity *= 0.92") &&
    C.OUTSIDE_DOHYO_VELOCITY_PENALTY === 0.92
);

// ============================================
// 2. PHYSICS STEP UNIT TESTS
// ============================================
console.log("\n[2] Physics step unit tests");

{
  // Initial burst from rest: v = BURST, position advances by tick*sf*BURST,
  // THEN moving friction applies (server order: position first).
  const sim = freshSim(640);
  stepMovement(sim, { a: false, d: true, s: false });
  const expectedX = 640 + C.TICK_MS * C.SPEED_FACTOR * C.ICE_INITIAL_BURST;
  const expectedV = C.ICE_INITIAL_BURST * C.ICE_MOVING_FRICTION;
  check("push-off burst: position uses pre-friction velocity", approx(sim.x, expectedX), `x=${sim.x} expected=${expectedX}`);
  check("push-off burst: post-step moving friction applied", approx(sim.v, expectedV), `v=${sim.v} expected=${expectedV}`);
  check("push-off burst: wasStrafingRight latched", sim.wasStrafingRight === true);
}

{
  // Steady state: hold D for 400 ticks → velocity oscillates in the
  // cap/friction band [MAX*FRICTION, MAX].
  const sim = freshSim(400);
  // keep away from right boundary by teleporting back each tick (test velocity only)
  for (let i = 0; i < 400; i++) {
    stepMovement(sim, { a: false, d: true, s: false });
    sim.x = 400;
  }
  const lo = C.ICE_MAX_SPEED * C.ICE_MOVING_FRICTION - 1e-9;
  const hi = C.ICE_MAX_SPEED + 1e-9;
  check("steady-state speed in [max*friction, max]", sim.v >= lo && sim.v <= hi, `v=${sim.v}`);
}

{
  // Brake turn: moving right fast, hold A → brake friction until
  // |v| < 5*threshold, then turn burst in the new direction.
  const sim = freshSim(640);
  sim.v = 1.3;
  sim.wasStrafingRight = true;
  let sawBraking = false;
  let ticks = 0;
  while (sim.v > 0 && ticks < 100) {
    stepMovement(sim, { a: true, d: false, s: false });
    if (sim.isBraking) sawBraking = true;
    ticks++;
  }
  check("brake turn: braking state observed", sawBraking);
  check(
    "brake turn: flips to left turn burst",
    approx(sim.v, -C.ICE_TURN_BURST * C.ICE_MOVING_FRICTION, 1e-9) ||
      approx(sim.v, -C.ICE_TURN_BURST, 1e-9),
    `v=${sim.v}`
  );
  // Analytic tick count: flip happens within the same tick the multiply
  // crosses the 5×threshold line — 1.3 * 0.8^n < 0.125 → n = 11 (0.1117)
  check("brake turn: completes in expected tick count", ticks === 11, `ticks=${ticks}`);
}

{
  // Coast to stop: total distance ≈ k*v0/(1-f) (geometric series), where
  // each tick moves AFTER friction is applied (coast branch order).
  const sim = freshSim(500);
  sim.v = 0.5;
  let ticks = 0;
  while (sim.v !== 0 && ticks < 1000) {
    stepMovement(sim, NO_KEYS);
    ticks++;
  }
  const k = C.TICK_MS * C.SPEED_FACTOR;
  // exact sum: k * sum(v0*f^i for i=1..n) until v0*f^n < threshold
  let v = 0.5;
  let exact = 0;
  while (v * C.ICE_COAST_FRICTION > C.ICE_STOP_THRESHOLD) {
    v *= C.ICE_COAST_FRICTION;
    exact += k * v;
  }
  // last sub-threshold tick still moves once before zeroing next tick
  v *= C.ICE_COAST_FRICTION;
  exact += k * v;
  check("coast: stops below threshold", sim.v === 0);
  check("coast: travel distance matches analytic sum", approx(sim.x - 500, exact, 0.001), `sim=${sim.x - 500} exact=${exact}`);
}

{
  // Boundary clamps
  const simR = freshSim(C.MAP_RIGHT_BOUNDARY - 2);
  simR.v = 1.3;
  simR.wasStrafingRight = true;
  stepMovement(simR, { a: false, d: true, s: false });
  check("right boundary clamps and zeroes velocity", simR.x === C.MAP_RIGHT_BOUNDARY && simR.v === 0);

  const simL = freshSim(C.MAP_LEFT_BOUNDARY + 2);
  simL.v = -1.3;
  simL.wasStrafingLeft = true;
  stepMovement(simL, { a: true, d: false, s: false });
  check("left boundary clamps and zeroes velocity", simL.x === C.MAP_LEFT_BOUNDARY && simL.v === 0);
}

{
  // Crouch strafe: capped at 30% max speed, moves at half speed factor.
  const sim = freshSim(640);
  for (let i = 0; i < 200; i++) {
    stepMovement(sim, { a: false, d: true, s: true });
    sim.x = 640;
  }
  check(
    "crouch strafe caps at 30% max speed",
    sim.v <= C.ICE_MAX_SPEED * C.CROUCH_MAX_SPEED_FACTOR + 1e-9,
    `v=${sim.v}`
  );
  const before = freshSim(640);
  before.v = C.ICE_MAX_SPEED * C.CROUCH_MAX_SPEED_FACTOR;
  const vAfterAccel = Math.min(
    before.v + C.ICE_ACCELERATION * C.CROUCH_ACCEL_FACTOR,
    C.ICE_MAX_SPEED * C.CROUCH_MAX_SPEED_FACTOR
  );
  stepMovement(before, { a: false, d: true, s: true });
  const expected =
    640 + C.TICK_MS * (C.SPEED_FACTOR * C.CROUCH_SPEED_FACTOR) * vAfterAccel;
  check("crouch strafe uses half speed factor", approx(before.x, expected), `x=${before.x} expected=${expected}`);
}

{
  // Edge zones: braking near the edge is STRONGER (lower friction value),
  // coasting near the edge is MORE slippery (higher friction value).
  const mid = freshSim(640);
  mid.v = 1.0;
  stepMovement(mid, { a: true, d: false, s: false });
  const edge = freshSim(C.MAP_RIGHT_BOUNDARY - 10);
  edge.v = 1.0;
  stepMovement(edge, { a: true, d: false, s: false });
  check("edge brake decays velocity faster than mid-ring brake", Math.abs(edge.v) < Math.abs(mid.v), `edge=${edge.v} mid=${mid.v}`);

  const midCoast = freshSim(640);
  midCoast.v = 1.0;
  stepMovement(midCoast, NO_KEYS);
  const edgeCoast = freshSim(C.MAP_RIGHT_BOUNDARY - 10);
  edgeCoast.v = 1.0;
  stepMovement(edgeCoast, NO_KEYS);
  check("edge coast keeps more velocity than mid-ring coast", edgeCoast.v > midCoast.v, `edge=${edgeCoast.v} mid=${midCoast.v}`);
}

{
  // Speed power-up multiplies displacement but not velocity caps.
  const normal = freshSim(640);
  const boosted = freshSim(640);
  stepMovement(normal, { a: false, d: true, s: false }, 1);
  stepMovement(boosted, { a: false, d: true, s: false }, 1.4);
  check(
    "speed power-up scales displacement by multiplier",
    approx((boosted.x - 640) / (normal.x - 640), 1.4, 1e-9)
  );
  check("speed power-up does not change velocity", approx(normal.v, boosted.v));
}

// ============================================
// 3. FIXED-TIMESTEP DETERMINISM
// ============================================
console.log("\n[3] Fixed-timestep determinism under irregular frame times");

{
  const mkSelf = () => ({
    x: 640,
    y: C.GROUND_LEVEL,
    movementVelocity: 0,
    sizeMultiplier: 1,
  });
  const keys = { a: false, d: true, s: false };

  // Predictor A: clean 60fps frames. Predictor B: messy frame times.
  const pa = new MovementPredictor();
  const pb = new MovementPredictor();
  const TOTAL = 1000; // ms

  let t = 1000;
  pa.update(t, keys, mkSelf(), null, true, 640);
  let ta = t;
  while (ta < t + TOTAL) {
    ta += 1000 / 60;
    pa.update(ta, keys, mkSelf(), null, true, 640);
  }
  pa.update(t + TOTAL, keys, mkSelf(), null, true, 640);

  pb.update(t, keys, mkSelf(), null, true, 640);
  const messy = [33.4, 8.2, 16.7, 50, 12.1, 16.7, 33.4, 7.7];
  let tb = t;
  let i = 0;
  while (tb < t + TOTAL) {
    tb = Math.min(tb + messy[i++ % messy.length], t + TOTAL);
    pb.update(tb, keys, mkSelf(), null, true, 640);
  }

  check(
    "same total time → identical simulated position",
    approx(pa.sim.x, pb.sim.x, 1e-9),
    `a=${pa.sim.x} b=${pb.sim.x}`
  );
}

// ============================================
// 4. END-TO-END RECONCILIATION HARNESS
// ============================================
console.log("\n[4] End-to-end harness (simulated server + 80ms RTT)");

function runHarness({ rttMs = 80, perturbAt = null, perturbBy = 0 } = {}) {
  const ONE_WAY = rttMs / 2;
  const BROADCAST_MS = 1000 / 32;
  const FRAME_MS = 1000 / 60;

  // --- server ---
  const serverSim = freshSim(640);
  let serverKeys = { a: false, d: false, s: false };
  const keyQueue = []; // { applyAt, keys }
  const snapshotQueue = []; // { deliverAt, x, v }
  let serverClock = 0;
  let lastBroadcast = 0;

  // --- client ---
  const predictor = new MovementPredictor();
  const liveKeys = { a: false, d: false, s: false, " ": false, c: false, control: false, mouse1: false, mouse2: false };
  const self = { x: 640, y: C.GROUND_LEVEL, movementVelocity: 0, sizeMultiplier: 1 };
  const opponent = { x: 200, y: C.GROUND_LEVEL, sizeMultiplier: 1 }; // far away (outside ring, irrelevant)

  // input script (client-side timestamps)
  const script = [
    { t: 200, keys: { a: false, d: true, s: false } },
    { t: 1200, keys: { a: false, d: false, s: false } },
    { t: 1500, keys: { a: true, d: false, s: false } },
    { t: 2300, keys: { a: false, d: false, s: false } },
  ];

  const rendered = []; // { t, x }
  const serverTrace = []; // { t, x } (server clock)
  let firstMoveResponseMs = null;
  let maxVisualOffset = 0;
  let maxFrameJump = 0;
  let perturbDone = false;

  // Ice coasting from full speed takes ~3.4s to fully stop — run long enough
  // for both sims to come to rest after the final input release at t=2300.
  const END = 7000;
  let lastRenderedX = 640;

  for (let now = 0; now <= END; now += FRAME_MS) {
    // 1. apply input script → client keys (instant) + queue for server
    for (const ev of script) {
      if (ev.t > now - FRAME_MS && ev.t <= now) {
        Object.assign(liveKeys, ev.keys);
        keyQueue.push({ applyAt: now + ONE_WAY, keys: { ...ev.keys } });
      }
    }

    // 2. advance server sim to `now` in fixed ticks
    while (serverClock + C.TICK_MS <= now) {
      serverClock += C.TICK_MS;
      while (keyQueue.length && keyQueue[0].applyAt <= serverClock) {
        serverKeys = keyQueue.shift().keys;
      }
      stepMovement(serverSim, serverKeys);
      if (perturbAt !== null && !perturbDone && serverClock >= perturbAt) {
        serverSim.x += perturbBy;
        perturbDone = true;
      }
      serverTrace.push({ t: serverClock, x: serverSim.x });
      if (serverClock - lastBroadcast >= BROADCAST_MS) {
        lastBroadcast = serverClock;
        snapshotQueue.push({
          deliverAt: serverClock + ONE_WAY,
          x: serverSim.x,
          v: serverSim.v,
        });
      }
    }

    // 3. deliver snapshots to the client
    while (snapshotQueue.length && snapshotQueue[0].deliverAt <= now) {
      const snap = snapshotQueue.shift();
      self.x = snap.x;
      self.movementVelocity = snap.v;
      predictor.onServerSnapshot(self, now, rttMs);
    }

    // 4. client render frame: server-interp fallback is just self.x here
    const result = predictor.update(now, liveKeys, self, opponent, true, self.x);
    const x = result.active ? result.x : self.x + result.offsetX;
    rendered.push({ t: now, x });

    if (firstMoveResponseMs === null && Math.abs(x - 640) > 0.5) {
      firstMoveResponseMs = now - 200;
    }
    maxVisualOffset = Math.max(maxVisualOffset, Math.abs(predictor.visualOffset));
    maxFrameJump = Math.max(maxFrameJump, Math.abs(x - lastRenderedX));
    lastRenderedX = x;
  }

  return {
    predictor,
    rendered,
    serverSim,
    firstMoveResponseMs,
    maxVisualOffset,
    maxFrameJump,
    finalRendered: rendered[rendered.length - 1].x,
  };
}

{
  const r = runHarness();
  // Sub-tick interpolation ramps the push-off burst in over ~1 sim tick, so
  // visible movement starts ~3 frames after the press — same as it would
  // feel on a local server, and far ahead of the ~96ms+ network echo.
  check(
    "responds to input faster than the network RTT",
    r.firstMoveResponseMs !== null && r.firstMoveResponseMs < 67,
    `responded in ${r.firstMoveResponseMs?.toFixed(1)}ms (server echo would be ~96ms+)`
  );
  check(
    "reconciliation corrections stay small (< 15px)",
    r.maxVisualOffset < 15,
    `max correction ${r.maxVisualOffset.toFixed(2)}px`
  );
  check(
    "rendering stays smooth (max frame-to-frame jump < 8px)",
    r.maxFrameJump < 8,
    `max jump ${r.maxFrameJump.toFixed(2)}px`
  );
  check(
    "converges to server position after inputs settle",
    Math.abs(r.finalRendered - r.serverSim.x) < 1.5,
    `client=${r.finalRendered.toFixed(2)} server=${r.serverSim.x.toFixed(2)}`
  );
}

{
  // Same run at rough-connection latency.
  const r = runHarness({ rttMs: 150 });
  check(
    "150ms RTT: corrections stay bounded (< 20px)",
    r.maxVisualOffset < 20,
    `max correction ${r.maxVisualOffset.toFixed(2)}px`
  );
  check(
    "150ms RTT: rendering stays smooth (max frame jump < 8px)",
    r.maxFrameJump < 8,
    `max jump ${r.maxFrameJump.toFixed(2)}px`
  );
  check(
    "150ms RTT: converges to server position",
    Math.abs(r.finalRendered - r.serverSim.x) < 1.5,
    `client=${r.finalRendered.toFixed(2)} server=${r.serverSim.x.toFixed(2)}`
  );
}

{
  // Server-side perturbation (e.g. opponent pushback we don't simulate):
  // shove the server +50px mid-coast; client must glide there, not pop.
  const r = runHarness({ perturbAt: 2600, perturbBy: 50 });
  check(
    "perturbation: rendering never pops (max frame jump < 8px)",
    r.maxFrameJump < 8,
    `max jump ${r.maxFrameJump.toFixed(2)}px`
  );
  check(
    "perturbation: converges onto the shoved server position",
    Math.abs(r.finalRendered - r.serverSim.x) < 1.5,
    `client=${r.finalRendered.toFixed(2)} server=${r.serverSim.x.toFixed(2)}`
  );
}

// ============================================
// 5. ELIGIBILITY GATING + HANDOFF
// ============================================
console.log("\n[5] Eligibility gating and handoff blending");

{
  const keys = { a: false, d: true, s: false };
  const base = { x: 640, y: C.GROUND_LEVEL, movementVelocity: 0, sizeMultiplier: 1 };
  check("eligible in clean neutral state", isPredictionEligible(base, null, keys, true));
  check("blocked before hakkiyoi", !isPredictionEligible(base, null, keys, false));
  for (const flag of ["isHit", "isAttacking", "isChargingAttack", "isDodging", "isBeingGrabbed", "isPowerSliding", "inClinch", "isAtTheRopes"]) {
    check(`blocked while ${flag}`, !isPredictionEligible({ ...base, [flag]: true }, null, keys, true));
  }
  check(
    "blocked during knockback",
    !isPredictionEligible({ ...base, knockbackVelocity: { x: 2, y: 0 } }, null, keys, true)
  );
  check(
    "blocked while airborne",
    !isPredictionEligible({ ...base, y: C.GROUND_LEVEL - 50 }, null, keys, true)
  );
  check(
    "blocked while holding space (parry gate)",
    !isPredictionEligible(base, null, { ...keys, " ": true }, true)
  );
  check(
    "blocked while holding C (power slide gate)",
    !isPredictionEligible(base, null, { ...keys, c: true }, true)
  );
  // Pushbox proximity: blocked moving TOWARD a close opponent, fine moving away
  const opp = { x: 740, sizeMultiplier: 1 };
  check(
    "blocked strafing toward opponent inside pushbox margin",
    !isPredictionEligible(base, opp, { a: false, d: true, s: false }, true)
  );
  check(
    "allowed strafing away from close opponent",
    isPredictionEligible(base, opp, { a: true, d: false, s: false }, true)
  );
}

{
  // Handoff: active predictor gets hit mid-stride → deactivates and the
  // rendered offset bleeds out smoothly instead of popping.
  const p = new MovementPredictor();
  const keys = { a: false, d: true, s: false };
  const self = { x: 640, y: C.GROUND_LEVEL, movementVelocity: 0, sizeMultiplier: 1 };
  let t = 0;
  p.update(t, keys, self, null, true, 640);
  for (let i = 0; i < 30; i++) {
    t += 1000 / 60;
    p.update(t, keys, self, null, true, 640);
  }
  const lastActive = p.update(t, keys, self, null, true, 640);
  const renderedBefore = lastActive.x;
  check("predictor advanced ahead of stale server x", renderedBefore > 645);

  // Server says we're hit. In production the server interp position trails
  // the prediction by ~rtt/2 of travel (≈ 12px at 100ms ping) — the handoff
  // offset bridges that gap and bleeds out.
  const serverInterpX = renderedBefore - 12;
  self.isHit = true;
  t += 1000 / 60;
  const r1 = p.update(t, keys, self, null, true, serverInterpX);
  check("deactivates on blocking flag", r1.active === false);
  const firstOffset = r1.offsetX;
  // Rendered-to-rendered continuity: allow ~one frame of normal travel.
  check(
    "handoff starts from the predicted position (no pop)",
    Math.abs(serverInterpX + firstOffset - renderedBefore) < 5,
    `offset=${firstOffset.toFixed(2)} gap=${(renderedBefore - serverInterpX).toFixed(2)}`
  );
  // Render frames continue at 60fps — offset must fully bleed within 300ms.
  let r2 = r1;
  for (let i = 0; i < 18; i++) {
    t += 1000 / 60;
    r2 = p.update(t, keys, self, null, true, serverInterpX);
  }
  check("handoff offset fully decays within 300ms", r2.offsetX === 0, `offset=${r2.offsetX}`);
}

// ============================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failed:", failures.join(" | "));
  process.exit(1);
}
console.log("All movement prediction tests passed.");

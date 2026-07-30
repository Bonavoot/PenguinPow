"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  TICK_RATE,
  CLINCH_DRIVE_PLANT_CANCEL_MS,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_EDGE_PIN_HOLD_MS,
  CLINCH_STALEMATE_DURATION_MS,
} = require("../../../constants");
const {
  isActivelyPlanting,
} = require("../../../grabActionSystem");
const { createClinchScenario, DEFAULT_TICK_MS } = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

describe("Tick-rate sensitivity", () => {
  it(`production tick is ${TICK_RATE}Hz (~${DEFAULT_TICK_MS}ms)`, () => {
    assert.equal(TICK_RATE, 64);
    assert.ok(Math.abs(DEFAULT_TICK_MS - 1000 / 64) < 0.001);
  });

  for (const tickMs of [8, 16, 20, 33, DEFAULT_TICK_MS]) {
    it(`Drive→Plant cancel boundary stable at ${tickMs}ms ticks`, () => {
      const s = sc({ tickMs });
      s.setCommittedDrive(s.grabbed);
      s.stepOnce({ advance: false, deltaMs: tickMs });
      s.holdAway(s.grabbed);
      const t0 = s.now();
      s.stepOnce({ advance: true, deltaMs: tickMs });
      const activateAt = t0 + CLINCH_DRIVE_PLANT_CANCEL_MS;

      // Advance in this tick size to activateAt - 1
      while (s.now() < activateAt - 1) {
        s.holdAway(s.grabbed);
        const step = Math.min(tickMs, activateAt - 1 - s.now());
        s.advance(step, { tickMs: step });
      }
      assert.equal(
        isActivelyPlanting(s.grabbed, s.grabber, activateAt - 1),
        false
      );
      // Cross activation
      s.holdAway(s.grabbed);
      s.advance(tickMs + 2, { tickMs });
      assert.equal(
        isActivelyPlanting(s.grabbed, s.grabber, activateAt),
        true
      );
    });
  }

  it("Perfect Brace at impact still holds with delayed tick (stall then double update)", () => {
    const s = sc({ tickMs: 33 });
    const start = s.now();
    const impact = start + CLINCH_THROW_ANIMATION_MS;
    s.setActiveTechnique(s.grabber, "throw", start);
    s.setActivePlant(s.grabbed, impact - 40);
    // Artificial stall: jump close to impact in one big advanceTime, then two updates
    s.advanceTime(impact - s.now() - 1);
    s.stepOnce({ advance: false, deltaMs: 33 });
    s.advanceTime(2);
    s.stepOnce({ advance: false, deltaMs: 33 });
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
  });

  it("simul window classification unchanged across tick sizes", () => {
    for (const tickMs of [8, 16, 33]) {
      const s = sc({ tickMs });
      const t0 = s.now();
      s.setThrowRequest(s.p1, "throw", t0);
      s.setThrowRequest(s.p2, "throw", t0 + CLINCH_THROW_CLASH_WINDOW_MS);
      s.stepOnce({ advance: false, deltaMs: tickMs });
      assert.equal(s.p1.isClinchClashing, true, `tick ${tickMs}`);
      s.dispose();
      scenarios.pop();

      const s2 = sc({ tickMs });
      s2.setThrowRequest(s2.p1, "throw", t0);
      s2.setThrowRequest(s2.p2, "throw", t0 + CLINCH_THROW_CLASH_WINDOW_MS + 1);
      s2.stepOnce({ advance: false, deltaMs: tickMs });
      assert.equal(s2.p1.isClinchClashing, false, `tick ${tickMs} outside`);
      s2.dispose();
      scenarios.pop();
    }
  });

  it("slightly delayed tick still expires stalemate when elapsed >= duration", () => {
    const s = sc({ tickMs: 20 });
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    s.grabber.clinchStalemateStart =
      s.now() - CLINCH_STALEMATE_DURATION_MS;
    s.grabber.clinchStalemateLastX = s.grabber.x;
    s.grabber.clinchStalemateLastBalance = s.grabber.balance;
    s.stepOnce({ advance: false, deltaMs: 20 });
    assert.equal(s.grabber.inClinch, false);
  });

  it("edge pin hold expiry across coarse ticks", () => {
    const s = sc({ tickMs: 33 });
    s.placeVictimAtRightEdge();
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    const pinStart = s.grabbed.clinchEdgePinStart;
    assert.ok(pinStart > 0);
    while (
      s.now() < pinStart + CLINCH_EDGE_PIN_HOLD_MS &&
      !s.room.gameOver
    ) {
      s.setCommittedDrive(s.grabber);
      s.holdNeutral(s.grabbed);
      s.advance(33, { tickMs: 33 });
    }
    if (!s.room.gameOver) {
      s.setCommittedDrive(s.grabber);
      s.holdNeutral(s.grabbed);
      s.stepOnce();
    }
    assert.equal(s.room.gameOver, true);
  });
});

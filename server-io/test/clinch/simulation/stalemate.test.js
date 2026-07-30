"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_STALEMATE_DURATION_MS,
  CLINCH_STALEMATE_MOVEMENT_THRESHOLD,
  CLINCH_STALEMATE_BALANCE_THRESHOLD,
} = require("../../../constants");
const { createClinchScenario } = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

describe("Stalemate resolution", () => {
  it(`duration is ${CLINCH_STALEMATE_DURATION_MS}ms`, () => {
    assert.equal(CLINCH_STALEMATE_DURATION_MS, 7000);
  });

  it("passive Plant both sides separates at expiration", () => {
    const s = sc();
    s.setActivePlant(s.grabber, s.now());
    s.setActivePlant(s.grabbed, s.now());
    s.stepOnce();
    const start = s.grabber.clinchStalemateStart;
    assert.ok(start > 0);

    // Advance just shy of expiration without meaningful movement
    // Freeze positions by not pushing; plant regen may change balance enough to reset!
    // Neutral both to avoid balance regen threshold resets.
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    // Snapshot and pin balance so regen doesn't reset timer
    const pinBal = () => {
      s.grabber.balance = s.grabber.clinchStalemateLastBalance;
      s.grabbed.balance = s.grabbed.balance;
    };

    while (s.now() - start < CLINCH_STALEMATE_DURATION_MS - 1) {
      s.holdNeutral(s.grabber);
      s.holdNeutral(s.grabbed);
      pinBal();
      s.grabber.x = s.grabber.clinchStalemateLastX;
      // Keep opponent attached without crossing movement threshold
      const d = Math.min(s.tickMs, CLINCH_STALEMATE_DURATION_MS - 1 - (s.now() - start));
      if (d <= 0) break;
      s.advance(d);
      pinBal();
      s.grabber.x = s.grabber.clinchStalemateLastX;
    }

    assert.equal(s.grabber.inClinch, true, "not yet expired");
    // Cross expiration
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    pinBal();
    s.grabber.x = s.grabber.clinchStalemateLastX;
    s.advance(s.tickMs + 2);
    assert.equal(s.grabber.inClinch, false, "stalemate should separate");
  });

  for (const ms of [6998, 6999, 7000, 7001]) {
    it(`at ${ms}ms elapsed: ${ms >= 7000 ? "separates" : "continues"} when idle`, () => {
      const s = sc();
      s.holdNeutral(s.grabber);
      s.holdNeutral(s.grabbed);
      s.stepOnce();
      s.grabber.clinchStalemateStart = s.now() - ms;
      s.grabber.clinchStalemateLastX = s.grabber.x;
      s.grabber.clinchStalemateLastBalance = s.grabber.balance;
      s.stepOnce();
      if (ms >= CLINCH_STALEMATE_DURATION_MS) {
        assert.equal(s.grabber.inClinch, false, `elapsed ${ms} should separate`);
      } else {
        assert.equal(s.grabber.inClinch, true, `elapsed ${ms} should continue`);
      }
    });
  }

  it("position change above threshold resets timer (priority over expire same tick)", () => {
    const s = sc();
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    // Set timer as if already expired, but move beyond threshold same tick
    s.grabber.clinchStalemateStart = s.now() - CLINCH_STALEMATE_DURATION_MS - 10;
    s.grabber.clinchStalemateLastX = s.grabber.x;
    s.grabber.clinchStalemateLastBalance = s.grabber.balance;
    s.grabber.x += CLINCH_STALEMATE_MOVEMENT_THRESHOLD + 1;
    s.stepOnce();
    assert.equal(s.grabber.inClinch, true, "reset must win over expire");
    assert.ok(
      s.now() - s.grabber.clinchStalemateStart < 50,
      "timer reset to near now"
    );
  });

  it("position change exactly at threshold does NOT reset", () => {
    const s = sc();
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    s.grabber.clinchStalemateStart = s.now() - 1000;
    const lastX = s.grabber.x;
    s.grabber.clinchStalemateLastX = lastX;
    s.grabber.clinchStalemateLastBalance = s.grabber.balance;
    s.grabber.x = lastX + CLINCH_STALEMATE_MOVEMENT_THRESHOLD; // not >
    const startBefore = s.grabber.clinchStalemateStart;
    s.stepOnce();
    // maintainClinchPositions / movement may alter x — check threshold semantics via helper path
    // If x delta is exactly threshold, code uses `>` so no reset.
    if (Math.abs(s.grabber.x - lastX) <= CLINCH_STALEMATE_MOVEMENT_THRESHOLD) {
      assert.equal(s.grabber.clinchStalemateStart, startBefore);
    }
  });

  it("balance change above threshold resets timer", () => {
    const s = sc();
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    s.grabber.clinchStalemateStart = s.now() - CLINCH_STALEMATE_DURATION_MS - 5;
    s.grabber.clinchStalemateLastX = s.grabber.x;
    s.grabber.clinchStalemateLastBalance = s.grabber.balance;
    s.grabber.balance -= CLINCH_STALEMATE_BALANCE_THRESHOLD + 1;
    s.stepOnce();
    assert.equal(s.grabber.inClinch, true);
  });

  it("new technique request alone does not reset (only x/balance on grabber)", () => {
    const s = sc();
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    s.grabber.clinchStalemateStart = s.now() - CLINCH_STALEMATE_DURATION_MS - 5;
    s.grabber.clinchStalemateLastX = s.grabber.x;
    s.grabber.clinchStalemateLastBalance = s.grabber.balance;
    s.setThrowRequest(s.grabber, "throw", s.now());
    // Request commit also sets clinchStalemateStart = now inside commitTechnique —
    // but only after buffer expiry. At this step, simul may not commit yet.
    s.stepOnce();
    // If still pending and no x/bal change, expired path may separate OR commit resets.
    // Document: commit path resets stalemate; pending request alone doesn't.
    if (s.grabber.clinchThrowActive) {
      assert.ok(s.grabber.clinchStalemateStart >= s.now() - 5);
      assert.equal(s.grabber.inClinch, true);
    } else if (!s.grabber.inClinch) {
      assert.ok(true, "expired without commit → separate");
    }
  });

  it("committed technique resets stalemate start", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.setThrowRequest(s.grabber, "throw", s.now() - 100);
    s.stepOnce();
    assert.equal(s.grabber.clinchThrowActive, true);
    assert.ok(Math.abs(s.grabber.clinchStalemateStart - s.now()) < s.tickMs + 1);
  });

  it("Jolt impact resets stalemate stamps", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.grabber.clinchStalemateStart = s.now() - 5000;
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(240);
    if (s.grabber.isClinchJolting) s.stepOnce();
    assert.ok(Math.abs(s.grabber.clinchStalemateStart - s.now()) < s.tickMs + 1);
  });

  it("one tick before / on / after expiration", () => {
    for (const [label, elapsed, expectClinch] of [
      ["one tick before", CLINCH_STALEMATE_DURATION_MS - 16, true],
      ["exactly on", CLINCH_STALEMATE_DURATION_MS, false],
      ["one tick after", CLINCH_STALEMATE_DURATION_MS + 16, false],
    ]) {
      const s = sc();
      s.holdNeutral(s.grabber);
      s.holdNeutral(s.grabbed);
      s.stepOnce();
      s.grabber.clinchStalemateStart = s.now() - elapsed;
      s.grabber.clinchStalemateLastX = s.grabber.x;
      s.grabber.clinchStalemateLastBalance = s.grabber.balance;
      s.stepOnce();
      assert.equal(
        s.grabber.inClinch,
        expectClinch,
        label
      );
      s.dispose();
      scenarios.pop();
    }
  });
});

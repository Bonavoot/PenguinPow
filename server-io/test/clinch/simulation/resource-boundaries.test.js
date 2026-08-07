"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_THROW_BALANCE_DRAIN_VS_PLANT,
  CLINCH_THROW_BALANCE_DRAIN_VS_PUSH,
  CLINCH_JOLT_STAMINA_COST,
  CLINCH_JOLT_ANIMATION_MS,
  CLINCH_JOLT_BALANCE_VS_PLANT,
  GRAB_BREAK_STAMINA_COST,
  CLINCH_EDGE_THROW_DRAIN_BONUS,
  CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC,
  BALANCE_MAX,
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

describe("Resource boundary tests", () => {
  describe("kill threshold", () => {
    it(`UI/production kill threshold is Balance < ${CLINCH_THROW_KILL_THRESHOLD}`, () => {
      assert.equal(CLINCH_THROW_KILL_THRESHOLD, 15);
    });

    it("kill uses pre-initiation Balance (clinchThrowKillBalance), not post-drain", () => {
      // Balance 20: after neutral initiation drain (10) → 10, but kill checks 20 → no kill
      const s = sc({ p2Balance: 20 });
      s.holdNeutral(s.grabbed);
      s.setThrowRequest(s.grabber, "throw", s.now() - (CLINCH_THROW_CLASH_WINDOW_MS + 1));
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowActive, true);
      assert.equal(s.grabber.clinchThrowKillBalance, 20);
      assert.equal(
        s.grabbed.balance,
        20 - CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL,
        "initiation drain applied after kill snapshot"
      );
      s.advance(CLINCH_THROW_ANIMATION_MS);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      assert.equal(s.grabbed.isClinchKillThrowVictim, false);
      assert.ok(!s.io.last("clinch_kill_throw"));
    });

    it("Balance 14 at commit kills even though initiation would matter for travel", () => {
      const s = sc({ p2Balance: 14 });
      s.holdNeutral(s.grabbed);
      s.setThrowRequest(s.grabber, "throw", s.now() - 100);
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowKillBalance, 14);
      s.advance(CLINCH_THROW_ANIMATION_MS);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      assert.ok(
        s.grabbed.isClinchKillThrowVictim || s.room.gameOver || s.io.last("clinch_kill_throw")
      );
    });

    for (const bal of [0, 1, 14, 15, 16]) {
      it(`commit kill snapshot at balance=${bal}: kill=${bal < 15}`, () => {
        const s = sc({ p2Balance: bal });
        s.holdNeutral(s.grabbed);
        s.setActiveTechnique(s.grabber, "throw", s.now());
        assert.equal(s.grabber.clinchThrowKillBalance, bal);
        s.advance(CLINCH_THROW_ANIMATION_MS);
        if (s.grabber.clinchThrowActive) s.stepOnce();
        const killed = !!(
          s.grabbed.isClinchKillThrowVictim ||
          s.io.last("clinch_kill_throw")
        );
        assert.equal(killed, bal < CLINCH_THROW_KILL_THRESHOLD);
      });
    }
  });

  describe("initiation drain by stance", () => {
    it("vs plant / push / neutral apply documented drains", () => {
      for (const [stance, setup, expectDrain] of [
        ["neutral", (s) => s.holdNeutral(s.grabbed), CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL],
        ["plant", (s) => s.setActivePlant(s.grabbed, s.now()), CLINCH_THROW_BALANCE_DRAIN_VS_PLANT],
        ["push", (s) => { s.setCommittedDrive(s.grabbed); s.stepOnce(); }, CLINCH_THROW_BALANCE_DRAIN_VS_PUSH],
      ]) {
        const s = sc({ p2Balance: 80 });
        setup(s);
        const before = s.grabbed.balance;
        s.setThrowRequest(s.grabber, "throw", s.now() - 100);
        s.stepOnce();
        assert.equal(
          before - s.grabbed.balance,
          expectDrain,
          stance
        );
        s.dispose();
        scenarios.pop();
      }
    });

    it("edge adds CLINCH_EDGE_THROW_DRAIN_BONUS once at commit", () => {
      const s = sc({ p2Balance: 80 });
      s.placeVictimAtRightEdge();
      s.holdNeutral(s.grabbed);
      const before = s.grabbed.balance;
      s.setThrowRequest(s.grabber, "throw", s.now() - 100);
      s.stepOnce();
      assert.equal(
        before - s.grabbed.balance,
        CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL + CLINCH_EDGE_THROW_DRAIN_BONUS
      );
      assert.equal(
        s.grabber.clinchThrowInitiationEdgeBonus,
        CLINCH_EDGE_THROW_DRAIN_BONUS
      );
    });
  });

  describe("stamina boundaries", () => {
    it("exact zero stamina: jolt still fires", () => {
      const s = sc({ p1Stamina: 0 });
      s.holdNeutral(s.grabbed);
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      assert.equal(s.grabber.isClinchJolting, true);
      assert.equal(s.grabber.stamina, 0);
    });

    it("Break from stamina just below cost floors at 0", () => {
      const s = sc({ p2Stamina: GRAB_BREAK_STAMINA_COST - 1 });
      s.setBreakRequest(s.grabbed, s.now());
      s.stepOnce();
      assert.equal(s.grabbed.stamina, 0);
      assert.equal(s.grabbed.isGrabBreaking, true);
    });

    it("Jolt costs CLINCH_JOLT_STAMINA_COST when affordable", () => {
      const s = sc({ p1Stamina: 50 });
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      assert.equal(s.grabber.stamina, 50 - CLINCH_JOLT_STAMINA_COST);
    });
  });

  describe("Plant posture lock", () => {
    it("Plant does not regenerate balance", () => {
      const s = sc({ p1Balance: 50 });
      s.setActivePlant(s.grabber, s.now());
      s.holdNeutral(s.grabbed);
      const before = s.grabber.balance;
      s.advance(1000);
      assert.equal(s.grabber.balance, before, "plant must not gain posture");
    });

    it("Plant locks balance against continuous push drain", () => {
      const s = sc({ p1Balance: 50, p2Balance: 80 });
      s.setActivePlant(s.grabber, s.now());
      s.setCommittedDrive(s.grabbed, s.grabber);
      const before = s.grabber.balance;
      s.advance(1000);
      assert.equal(
        s.grabber.balance,
        before,
        `plant should preserve posture under push; got ${s.grabber.balance} (push drain would be ~${CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC}/s)`
      );
    });

    it("balance stays at or below BALANCE_MAX while planting", () => {
      const s = sc({ p1Balance: BALANCE_MAX - 1 });
      s.setActivePlant(s.grabber, s.now());
      s.holdNeutral(s.grabbed);
      s.advance(2000);
      assert.ok(s.grabber.balance <= BALANCE_MAX);
      assert.equal(s.grabber.balance, BALANCE_MAX - 1);
    });
  });

  describe("Jolt plant damage", () => {
    it("exact plant punish amount", () => {
      const s = sc({ p2Balance: 100 });
      s.setActivePlant(s.grabbed, s.now());
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      s.advance(CLINCH_JOLT_ANIMATION_MS);
      if (s.grabber.isClinchJolting) s.stepOnce();
      assert.equal(s.grabbed.balance, 100 - CLINCH_JOLT_BALANCE_VS_PLANT);
    });
  });
});

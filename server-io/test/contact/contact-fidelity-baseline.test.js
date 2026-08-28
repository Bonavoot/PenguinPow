"use strict";

/**
 * Phase 13 — baseline outcome preservation (real checkCollision paths).
 * Captures legacy winners before/with V2; V2 must not change arbitration.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setCombatContactFidelityV2ForTests,
} = require("../../combatContactFidelityFlags");
const {
  createContactScenario,
  armSlap,
  armCharged,
  armGrabStartup,
  placeInConnectRange,
  runBothCollisionOrders,
  snapshotOutcome,
  CHARGE_PRIORITY_THRESHOLD,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("./helpers/contactSim");
const scenarios = [];
afterEach(() => {
  setCombatContactFidelityV2ForTests(null);
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function resolvePair(s, leftArm, rightArm) {
  const now = s.room.simTime;
  leftArm(s.left, now);
  rightArm(s.right, now);
  runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
  return {
    left: snapshotOutcome(s.left, s.right),
    right: snapshotOutcome(s.right, s.left),
    leftPlayer: s.left,
    rightPlayer: s.right,
  };
}

describe("Phase 13 — baseline outcome preservation", () => {
  describe("legacy (V2 off)", () => {
    beforeEach(() => setCombatContactFidelityV2ForTests(false));

    it("Slap beats Charged below priority threshold", () => {
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      armSlap(s.left, { now });
      armCharged(s.right, { power: CHARGE_PRIORITY_THRESHOLD - 5, now });
      placeInConnectRange(s.left, s.right, "slap");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      assert.equal(s.right.isHit, true, "charged must be hit");
      assert.equal(s.left.isHit, false, "slapper must not be hit");
      assert.equal(s.right.isAttacking, false);
    });

    it("Charged beats Slap at/above priority threshold when charged reaches", () => {
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      armSlap(s.left, { now });
      armCharged(s.right, { power: CHARGE_PRIORITY_THRESHOLD + 20, now });
      placeInConnectRange(s.right, s.left, "charged");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      assert.equal(s.left.isHit, true, "slapper must be hit");
      assert.equal(s.right.isHit, false, "charged winner must not be hit");
    });

    it("Slap during grab startup — real hit, no clang", () => {
      const s = sc({ gap: 80 });
      const now = s.room.simTime;
      armSlap(s.right, { now });
      armGrabStartup(s.left, { now });
      placeInConnectRange(s.right, s.left, "slap");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      assert.equal(s.left.isHit, true, "reaching is hittable");
      assert.equal(s.left.isGrabStartup, false, "grab must die to a slap while reaching");
    });

    it("Slap vs Slap earlier start wins", () => {
      const s = sc({ gap: 90 });
      const now = s.room.simTime;
      // Both past open-hit grace and still inside the jab active window.
      armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET + 12 });
      armSlap(s.right, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
      placeInConnectRange(s.left, s.right, "slap");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      // left started earlier (attackStartTime smaller) → left wins
      assert.equal(s.right.isHit, true);
      assert.equal(s.left.isHit, false);
    });
  });

  describe("V2 preserves winners", () => {
    it("Slap-beats-Charged winner/loser matches legacy", () => {
      const run = (v2) => {
        setCombatContactFidelityV2ForTests(v2);
        const s = sc({ gap: 100 });
        const now = s.room.simTime;
        armSlap(s.left, { now });
        armCharged(s.right, { power: 10, now });
        placeInConnectRange(s.left, s.right, "slap");
        const balL = s.left.balance;
        const balR = s.right.balance;
        runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
        return {
          leftHit: s.left.isHit,
          rightHit: s.right.isHit,
          leftAtk: s.left.isAttacking,
          rightAtk: s.right.isAttacking,
          dBal: balR - s.right.balance,
          aBal: balL - s.left.balance,
        };
      };
      const legacy = run(false);
      const v2 = run(true);
      assert.equal(v2.leftHit, legacy.leftHit);
      assert.equal(v2.rightHit, legacy.rightHit);
      assert.equal(v2.dBal, legacy.dBal);
      assert.equal(v2.aBal, legacy.aBal);
    });

    it("legacy high-charge still beats slap; V2 may differ (Phase 13A physical)", () => {
      // Phase 13A intentionally re-arbitrates slap↔charged under V2 via
      // first-contact / active-start ordering. Legacy threshold path remains
      // for V2-off only.
      setCombatContactFidelityV2ForTests(false);
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      armSlap(s.left, { now });
      armCharged(s.right, { power: 80, now });
      placeInConnectRange(s.right, s.left, "charged");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      assert.equal(s.left.isHit, true);
      assert.equal(s.right.isHit, false);
    });
  });
});

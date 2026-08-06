"use strict";

/**
 * Palm vs slap: timing winner / rare same-tick trade.
 * Palm does NOT beat slap via CHARGE_PRIORITY_THRESHOLD / fake charge power.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setCombatContactFidelityV2ForTests,
} = require("../../combatContactFidelityFlags");
const {
  createContactScenario,
  armPalm,
  armSlap,
  placeInConnectRange,
  runBothCollisionOrders,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("./helpers/contactSim");
const {
  PALM_THRUST_STARTUP_MS,
  PALM_VS_SLAP_TRADE_WINDOW_MS,
  PALM_VS_SLAP_TRADE_KB_ON_SLAPPER,
  PALM_VS_SLAP_TRADE_KB_ON_PALM,
  PALM_THRUST_POWER,
  CHARGE_PRIORITY_THRESHOLD,
  PALM_THRUST_KB_VELOCITY,
} = require("../../constants");

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

function hitPayloads(io) {
  return io.find("player_hit");
}

describe("palm vs slap — timing priority / trade", () => {
  it("earlier palm wins clean; later slap is stuffed (both collision orders)", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    armPalm(s.left, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 60,
    });
    armSlap(s.right, {
      now,
      startOffset: SLAP_ACTIVE_TEST_OFFSET,
    });
    assert.ok(
      s.left.attackStartTime < s.right.attackStartTime,
      "palm must be the earlier attack"
    );
    assert.ok(
      Math.abs(s.left.attackStartTime - s.right.attackStartTime) >
        PALM_VS_SLAP_TRADE_WINDOW_MS,
      "must be outside the trade window"
    );
    assert.ok(s.left.chargeAttackPower >= CHARGE_PRIORITY_THRESHOLD);

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.right.isHit, true, "later slap should be hit by palm");
    assert.equal(s.left.isHit, false, "earlier palm should not be hit");
    assert.equal(hitPayloads(s.io).length, 1);
    const hit = hitPayloads(s.io)[0].payload;
    assert.equal(hit.isPalmThrust, true);
    assert.equal(hit.attackerId, s.left.id);
  });

  it("earlier slap wins clean; later palm is stuffed (both collision orders)", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "slap");

    // Slap started well before palm — palm's fake charge power must NOT save it.
    armSlap(s.left, {
      now,
      startOffset: SLAP_ACTIVE_TEST_OFFSET + 40,
    });
    armPalm(s.right, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 5,
      power: PALM_THRUST_POWER,
    });
    assert.ok(s.left.attackStartTime < s.right.attackStartTime);
    assert.ok(
      Math.abs(s.left.attackStartTime - s.right.attackStartTime) >
        PALM_VS_SLAP_TRADE_WINDOW_MS
    );

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.right.isHit, true, "later palm should be hit by slap");
    assert.equal(s.left.isHit, false, "earlier slap should not be hit");
    assert.equal(hitPayloads(s.io).length, 1);
    const hit = hitPayloads(s.io)[0].payload;
    assert.equal(hit.isPalmThrust, false);
    assert.equal(hit.attackType, "slap");
    assert.equal(hit.attackerId, s.left.id);
  });

  it("near-simultaneous palm vs slap trades — both hit", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    // Align attackStartTime within the palm-vs-slap trade window.
    const sharedStart = now - (PALM_THRUST_STARTUP_MS + 20);
    armPalm(s.left, {
      now,
      startOffset: now - sharedStart,
    });
    armSlap(s.right, {
      now,
      startOffset: now - sharedStart,
    });
    assert.ok(
      Math.abs(s.left.attackStartTime - s.right.attackStartTime) <=
        PALM_VS_SLAP_TRADE_WINDOW_MS
    );

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, true);
    assert.equal(hitPayloads(s.io).length, 2);
    // Asymmetric: slapper eats more than palm; both under a clean palm send.
    assert.ok(PALM_VS_SLAP_TRADE_KB_ON_SLAPPER > PALM_VS_SLAP_TRADE_KB_ON_PALM);
    assert.ok(PALM_VS_SLAP_TRADE_KB_ON_SLAPPER < PALM_THRUST_KB_VELOCITY);
    assert.ok(
      Math.abs(Math.abs(s.left.knockbackVelocity.x) - PALM_VS_SLAP_TRADE_KB_ON_PALM) <
        0.001,
      "palm thruster takes the lighter trade shove"
    );
    assert.ok(
      Math.abs(
        Math.abs(s.right.knockbackVelocity.x) - PALM_VS_SLAP_TRADE_KB_ON_SLAPPER
      ) < 0.001,
      "slap attacker takes the heavier trade shove"
    );
  });

  it("unilateral palm into tip-dead slap still lands (no fake priority needed)", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    armPalm(s.left, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 20,
      power: CHARGE_PRIORITY_THRESHOLD - 1,
    });
    // Slap tip already dead — recovery-style clocks.
    armSlap(s.right, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    s.right.slapActiveEndTime = now - 1;
    s.right.attackEndTime = now + 50;

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.right.isHit, true);
    assert.equal(s.left.isHit, false);
    assert.equal(hitPayloads(s.io).length, 1);
    assert.equal(hitPayloads(s.io)[0].payload.isPalmThrust, true);
  });
});

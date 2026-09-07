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
  createFoundationScenario,
  advanceSim,
  stepCollisionBothOrders,
  placeAtGap,
} = require("../foundation/helpers/scenarioHarness");
const {
  executeSlapAttack,
  executePalmThrust,
} = require("../../gameFunctions");
const { getConnectDistance } = require("../../strikeContact");
const { timeoutManager } = require("../../gameUtils");
const {
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  PALM_VS_SLAP_TRADE_WINDOW_MS,
  PALM_VS_SLAP_TRADE_KB_ON_SLAPPER,
  PALM_VS_SLAP_TRADE_KB_ON_PALM,
  PALM_THRUST_POWER,
  CHARGE_PRIORITY_THRESHOLD,
  PALM_THRUST_KB_VELOCITY,
  TICK_RATE,
} = require("../../constants");

const TICK_MS = 1000 / TICK_RATE;

const scenarios = [];
afterEach(() => {
  setCombatContactFidelityV2ForTests(null);
  while (scenarios.length) scenarios.pop().dispose();
  timeoutManager.clearAll();
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
      startOffset: PALM_THRUST_STARTUP_MS + Math.min(60, PALM_THRUST_ACTIVE_MS - 8),
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

    // Slap is live; palm is still in startup. A jab's active window cannot
    // overlap a medium that's already striking — stuffing the thrust means
    // hitting the windup.
    armSlap(s.left, {
      now,
      startOffset: SLAP_ACTIVE_TEST_OFFSET,
    });
    armPalm(s.right, {
      now,
      startOffset: SLAP_ACTIVE_TEST_OFFSET - PALM_VS_SLAP_TRADE_WINDOW_MS - 8,
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

    // Both still in their active windows (jab active is shorter than palm startup+20).
    const sharedOffset = PALM_THRUST_STARTUP_MS + 6;
    armPalm(s.left, {
      now,
      startOffset: sharedOffset,
    });
    armSlap(s.right, {
      now,
      startOffset: sharedOffset,
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

    const hits = hitPayloads(s.io).map((e) => e.payload);
    const slapHit = hits.find((h) => h.attackType === "slap");
    const palmHit = hits.find((h) => h.isPalmThrust === true);
    assert.ok(slapHit && palmHit, "trade must emit both a slap hit and a palm hit");
    assert.equal(slapHit.isTrade, true);
    assert.equal(palmHit.isTrade, true);
    assert.equal(slapHit.tradeFx, "mixed");
    assert.equal(palmHit.tradeFx, "mixed");
    assert.ok(slapHit.tradeId, "mixed trade must share a tradeId");
    assert.equal(slapHit.tradeId, palmHit.tradeId);
    assert.equal(slapHit.combatPresentation.profileId, "GS_SLAP_HIT");
    assert.equal(palmHit.combatPresentation.profileId, "GS_PALM_HIT");
    assert.notEqual(
      slapHit.combatPresentation.facingHint,
      palmHit.combatPresentation.facingHint,
      "each spark must face its own attacker, not both the slap"
    );
    assert.equal(slapHit.attackerId, s.right.id);
    assert.equal(palmHit.attackerId, s.left.id);
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

function scFoundation(opts) {
  const s = createFoundationScenario(opts);
  scenarios.push(s);
  const dist = getConnectDistance("palm", s.left, s.right);
  placeAtGap(s, Math.max(40, dist - 20));
  return s;
}

function stepUntilHit(s, maxTicks = 16) {
  for (let i = 0; i < maxTicks; i++) {
    advanceSim(s, TICK_MS);
    stepCollisionBothOrders(s);
    if (hitPayloads(s.io).length) return i;
  }
  return -1;
}

describe("palm vs slap — live clocks (mash into a slap)", () => {
  it("same-time press trades once palm goes active (grace + tick skip the startup CH slice)", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = scFoundation({ gap: 110 });
    executeSlapAttack(s.right, s.rooms);
    executePalmThrust(s.left, s.rooms);

    const tick = stepUntilHit(s);
    assert.ok(tick >= 0, "pair must resolve");
    const hits = hitPayloads(s.io).map((e) => e.payload);
    assert.equal(hits.length, 2, "same-press is a mixed trade, not a clean CH");
    assert.ok(hits.every((h) => h.isTrade));
    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, true);
  });

  it("palm one tick late is a slap counter-hit on palm startup — palm never connects", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = scFoundation({ gap: 110 });
    executeSlapAttack(s.right, s.rooms);
    advanceSim(s, TICK_MS);
    executePalmThrust(s.left, s.rooms);

    stepUntilHit(s);
    const hits = hitPayloads(s.io).map((e) => e.payload);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].attackType, "slap");
    assert.equal(hits[0].isCounterHit, true);
    assert.ok(!hits[0].isTrade);
    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, false);
    assert.equal(s.left.isPalmThrust, false);
  });

  it("slap two ticks late is a clean palm counter-hit — slap never connects", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = scFoundation({ gap: 110 });
    executePalmThrust(s.left, s.rooms);
    advanceSim(s, TICK_MS);
    advanceSim(s, TICK_MS);
    executeSlapAttack(s.right, s.rooms);

    stepUntilHit(s);
    const hits = hitPayloads(s.io).map((e) => e.payload);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].isPalmThrust, true);
    assert.equal(hits[0].isCounterHit, true);
    assert.equal(s.left.isHit, false);
    assert.equal(s.right.isHit, true);
  });
});

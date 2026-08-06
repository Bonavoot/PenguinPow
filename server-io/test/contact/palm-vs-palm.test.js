"use strict";

/**
 * Palm vs palm: timing winner / rare same-tick trade.
 * Design reference: slap winner/trade — palm-native resolution (not charge clash,
 * not slap trade helpers).
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setCombatContactFidelityV2ForTests,
} = require("../../combatContactFidelityFlags");
const {
  createContactScenario,
  armPalm,
  armCharged,
  placeInConnectRange,
  runBothCollisionOrders,
  snapshotOutcome,
} = require("./helpers/contactSim");
const {
  PALM_THRUST_STARTUP_MS,
  PALM_TRADE_WINDOW_MS,
  PALM_TRADE_KNOCKBACK,
  PALM_THRUST_KB_VELOCITY,
  CHARGE_CLASH_RECOVERY_DURATION,
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

function clashPayloads(io) {
  return io.find("charge_clash");
}

describe("palm vs palm — timing priority / trade", () => {
  it("earlier palm wins clean; later palm is stuffed (both collision orders)", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    // Left started clearly earlier (well outside trade window).
    armPalm(s.left, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 40,
    });
    armPalm(s.right, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 5,
    });

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const snap = snapshotOutcome(s.left, s.right);
    assert.equal(s.right.isHit, true, "later palm should be hit");
    assert.equal(s.left.isHit, false, "earlier palm should not be hit");
    assert.equal(hitPayloads(s.io).length, 1, "exactly one palm hit");
    assert.equal(clashPayloads(s.io).length, 0, "must not charge-clash");
    const hit = hitPayloads(s.io)[0].payload;
    assert.equal(hit.isPalmThrust, true);
    assert.equal(hit.attackerId, s.left.id);
    assert.equal(hit.victimId, s.right.id);
    // Clean palm delivers burst shove at/above trade KB, not clash recovery.
    assert.ok(
      Math.abs(s.right.knockbackVelocity.x) >= PALM_TRADE_KNOCKBACK - 0.01,
      "winner palm should deliver real palm-tier shove"
    );
    assert.ok(!s.left.isRecovering, "winner must not enter charge-clash recovery");
    assert.notEqual(
      s.right.recoveryDuration,
      CHARGE_CLASH_RECOVERY_DURATION
    );
    assert.ok(snap.defenderHit);
  });

  it("same-tick palms trade — both hit, no charge clash, mutual trade KB", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    const startOffset = PALM_THRUST_STARTUP_MS + 20;
    armPalm(s.left, { now, startOffset });
    armPalm(s.right, { now, startOffset });
    assert.ok(
      Math.abs(s.left.attackStartTime - s.right.attackStartTime) <=
        PALM_TRADE_WINDOW_MS
    );

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, true);
    assert.equal(hitPayloads(s.io).length, 2, "mutual palm trade hits");
    assert.equal(clashPayloads(s.io).length, 0, "must not charge-clash");
    for (const e of hitPayloads(s.io)) {
      assert.equal(e.payload.isPalmThrust, true);
    }
    assert.ok(
      Math.abs(Math.abs(s.left.knockbackVelocity.x) - PALM_TRADE_KNOCKBACK) <
        0.001
    );
    assert.ok(
      Math.abs(Math.abs(s.right.knockbackVelocity.x) - PALM_TRADE_KNOCKBACK) <
        0.001
    );
    // Trade KB is intentionally under a clean palm send.
    assert.ok(PALM_TRADE_KNOCKBACK < PALM_THRUST_KB_VELOCITY);
    assert.equal(s.left.isBurstKnockback, true);
    assert.equal(s.right.isBurstKnockback, true);
  });

  it("near-simultaneous within ~1 tick still trades", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    // 12ms apart — inside the 16ms palm trade window, outside slap's 8ms.
    const gap = 12;
    armPalm(s.left, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 20 + gap,
    });
    armPalm(s.right, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 20,
    });
    assert.ok(
      Math.abs(s.left.attackStartTime - s.right.attackStartTime) <=
        PALM_TRADE_WINDOW_MS
    );

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, true);
    assert.equal(hitPayloads(s.io).length, 2);
    assert.equal(clashPayloads(s.io).length, 0);
  });

  it("2-tick gap is NOT a trade — earlier palm wins", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");

    // Just outside the trade window (~2 ticks @64Hz).
    const gap = PALM_TRADE_WINDOW_MS + 8;
    armPalm(s.left, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 20 + gap,
    });
    armPalm(s.right, {
      now,
      startOffset: PALM_THRUST_STARTUP_MS + 20,
    });
    assert.ok(
      Math.abs(s.left.attackStartTime - s.right.attackStartTime) >
        PALM_TRADE_WINDOW_MS
    );

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.right.isHit, true);
    assert.equal(s.left.isHit, false);
    assert.equal(hitPayloads(s.io).length, 1);
    assert.equal(clashPayloads(s.io).length, 0);
  });

  it("charged headbutt vs charged headbutt still charge-clashes", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "charged");
    armCharged(s.left, { now, power: 60 });
    armCharged(s.right, { now, power: 55 });

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, false);
    assert.equal(s.right.isHit, false);
    assert.equal(hitPayloads(s.io).length, 0);
    assert.equal(clashPayloads(s.io).length, 1);
    assert.equal(s.left.isRecovering, true);
    assert.equal(s.right.isRecovering, true);
  });

  it("palm vs charged headbutt still charge-clashes (not palm trade)", () => {
    setCombatContactFidelityV2ForTests(true);
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    placeInConnectRange(s.left, s.right, "palm");
    armPalm(s.left, { now, startOffset: PALM_THRUST_STARTUP_MS + 20 });
    armCharged(s.right, { now, power: 60 });

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(hitPayloads(s.io).length, 0);
    assert.equal(clashPayloads(s.io).length, 1);
    assert.equal(s.left.isPalmThrust, false, "clash must clear palm flag");
    assert.equal(s.left.isRecovering, true);
    assert.equal(s.right.isRecovering, true);
  });
});

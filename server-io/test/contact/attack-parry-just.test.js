"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_ACTIVE_MS,
  PERFECT_PARRY_WINDOW,
  SLAP_STARTUP_MS,
} = require("../../constants");
const {
  createContactScenario,
  armSlap,
  placeInConnectRange,
  runBothCollisionOrders,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("./helpers/contactSim");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function armLiveParry(player, now, { just = true } = {}) {
  player.isRawParrying = true;
  player.isGuarding = false;
  const armedAt = just ? now : now - (PERFECT_PARRY_WINDOW + 1);
  player.rawParryStartTime = armedAt;
  player.apArmSimTime = armedAt;
  player.apActiveUntil = now + AP_ACTIVE_MS;
  player.apSpaceConsumed = true;
  player.apFlurryUntil = 0;
  return player;
}

describe("Attack parry just / callout / late", () => {
  it("just tap (armed on the hit tick) is Perfect and does not open piano", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    armLiveParry(s.right, now, { just: true });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, true);
    assert.equal(s.right.apFlurryUntil, 0, "Perfect spends the string");
  });

  it("early callout is Regular and opens piano cover", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    armLiveParry(s.right, now, { just: false });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, false);
    assert.equal(s.right.isRawParrySuccess, true);
    assert.ok(s.right.apFlurryUntil > now, "Regular may piano the next slap");
  });

  it("already-live tap during grace still Perfects", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_STARTUP_MS + 10 });
    armLiveParry(s.right, now, { just: true });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, true, "live just is not a grace save");
  });

  it("slightly-late tap during slap grace Regulars — it cannot Perfect", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_STARTUP_MS + 10 });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.slapOpenHitPending, true, "grace holds the open hit");
    assert.equal(s.io.find("raw_parry_success").length, 0);
    assert.equal(s.right.isHit, false);

    armLiveParry(s.right, now, { just: true });
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev, "late tap still parries");
    assert.equal(ev.payload.isPerfect, false, "grace save cannot Perfect");
    assert.equal(s.right.isRawParrySuccess, true);
  });
});

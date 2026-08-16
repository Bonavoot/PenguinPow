"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_ACTIVE_MS,
  AP_LATE_PARRY_MS,
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

function armLiveParry(player, now, { perfect = true } = {}) {
  player.isRawParrying = true;
  player.isGuarding = false;
  player.rawParryStartTime = perfect ? now : now - (PERFECT_PARRY_WINDOW + 1);
  player.apActiveUntil = now + AP_ACTIVE_MS;
  player.apSpaceConsumed = true;
  return player;
}

describe("Grace-held slap parry cannot Perfect", () => {
  it("open-hit grace then late tap is Regular, even if press→hit is 0ms", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_STARTUP_MS + 10 });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.slapOpenHitPending, true, "grace must hold the open hit");
    assert.equal(s.io.find("raw_parry_success").length, 0);
    assert.equal(s.left.isAttacking, true, "deferred slap stays live");

    armLiveParry(s.right, now, { perfect: true });
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev, "late tap still parries");
    assert.equal(ev.payload.isPerfect, false, "grace save cannot Perfect");
    assert.equal(s.right.isPerfectRawParrySuccess, false);
    assert.equal(s.right.isRawParrySuccess, true);
    assert.equal(s.left.slapOpenHitPending, false);
  });

  it("already-live tap during grace still Perfects", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_STARTUP_MS + 10 });
    armLiveParry(s.right, now, { perfect: true });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, true, "live window is not a grace save");
    assert.equal(s.left.slapOpenHitPending, false);
  });

  it("clean Perfect past grace is unchanged", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    assert.ok(
      SLAP_ACTIVE_TEST_OFFSET > SLAP_STARTUP_MS + AP_LATE_PARRY_MS,
      "control must sit past the grace band"
    );
    armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    armLiveParry(s.right, now, { perfect: true });
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, true);
  });
});

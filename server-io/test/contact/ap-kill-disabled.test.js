"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_ACTIVE_MS,
  AP_PERFECT_KILL_THRESHOLD,
  PERFECT_PARRY_WINDOW,
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

function armLiveParry(player, now) {
  player.isRawParrying = true;
  player.isGuarding = false;
  player.rawParryStartTime = now;
  player.apActiveUntil = now + AP_ACTIVE_MS;
  player.apSpaceConsumed = true;
  return player;
}

describe("Attack parry cannot finish the round", () => {
  it("Perfect slap at 5 posture stuns — no cinematic kill, round stays live", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    s.left.balance = Math.min(5, AP_PERFECT_KILL_THRESHOLD - 1);
    armLiveParry(s.right, now);
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev, "Perfect still lands");
    assert.equal(ev.payload.isPerfect, true);
    assert.equal(ev.payload.isKill, false);
    assert.equal(s.io.find("cinematic_kill").length, 0);
    assert.equal(s.room.gameOver, false);
    assert.equal(s.left.isClinchKillPullVictim, false);
    assert.ok(
      PERFECT_PARRY_WINDOW > 0,
      "grade window stays; only the kill door is shut"
    );
  });
});

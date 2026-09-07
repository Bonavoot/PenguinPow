"use strict";

/**
 * After a clean slap hit, same-tick mash-back does not trade — the previous
 * hitter lands a counter-hit. Neutral dual-commit still trades. Clocks stay
 * +0: a late press still loses, and the victim's slap still stuffs a grab.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { timeoutManager } = require("../../gameUtils");
const {
  createContactScenario,
  armSlap,
  armGrabStartup,
  placeInConnectRange,
  runBothCollisionOrders,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("./helpers/contactSim");
const { getSlapFollowupPressurer } = require("../../collisionSystem");
const {
  SLAP_FOLLOWUP_PRIORITY_WINDOW_MS,
  SLAP_TRADE_WINDOW_MS,
  SLAP_COUNTER_HIT_BONUS_MS,
  AP_ACTIVE_MS,
  PERFECT_PARRY_WINDOW,
} = require("../../constants");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
  timeoutManager.clearAll();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function armSameTickSlaps(s, now, startOffset = SLAP_ACTIVE_TEST_OFFSET) {
  armSlap(s.left, { now, startOffset });
  armSlap(s.right, { now, startOffset });
  s.left.attackAttemptTime = s.left.attackStartTime;
  s.right.attackAttemptTime = s.right.attackStartTime;
  placeInConnectRange(s.left, s.right, "slap");
}

function hitPayloads(io) {
  return io.find("player_hit");
}

function lastHit(io) {
  const hits = hitPayloads(io);
  return hits.length ? hits[hits.length - 1].payload : null;
}

function armLiveParry(player, now) {
  player.isRawParrying = true;
  player.isGuarding = false;
  player.rawParryStartTime = now - (PERFECT_PARRY_WINDOW + 1);
  player.apArmSimTime = player.rawParryStartTime;
  player.apActiveUntil = now + AP_ACTIVE_MS;
  player.apSpaceConsumed = true;
  player.apFlurryUntil = 0;
}

describe("getSlapFollowupPressurer", () => {
  it("returns the fresh clean-hit stamp, then expires", () => {
    const now = 200_000;
    const a = { lastSlapHitLandedTime: now - 80 };
    const b = { lastSlapHitLandedTime: 0 };
    assert.equal(getSlapFollowupPressurer(a, b, now), a);
    assert.equal(
      getSlapFollowupPressurer(
        { lastSlapHitLandedTime: now - SLAP_FOLLOWUP_PRIORITY_WINDOW_MS - 1 },
        b,
        now
      ),
      null
    );
  });

  it("most recent stamp wins; equal stamps stay neutral", () => {
    const now = 200_000;
    const a = { lastSlapHitLandedTime: now - 40 };
    const b = { lastSlapHitLandedTime: now - 10 };
    assert.equal(getSlapFollowupPressurer(a, b, now), b);
    const tied = { lastSlapHitLandedTime: now - 10 };
    assert.equal(getSlapFollowupPressurer(tied, b, now), null);
  });
});

describe("slap follow-up priority", () => {
  it("neutral same-tick slaps still trade", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    armSameTickSlaps(s, now);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true, "neutral trade hits both");
    assert.equal(s.right.isHit, true, "neutral trade hits both");
    const hits = hitPayloads(s.io);
    assert.ok(hits.length >= 2);
    assert.ok(hits.every((h) => h.payload.isTrade === true));
    assert.ok(hits.every((h) => h.payload.isCounterHit === false));
  });

  it("same-tick mash after a clean hit is a counter-hit, both collision orders", () => {
    for (const reverse of [false, true]) {
      const s = sc({ gap: 110 });
      const now = s.room.simTime;
      s.left.lastSlapHitLandedTime = now - 80;
      armSameTickSlaps(s, now);
      if (reverse) {
        runBothCollisionOrders(s.right, s.left, s.rooms, s.io);
      } else {
        runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      }

      assert.equal(s.right.isHit, true, `victim hit (reverse=${reverse})`);
      assert.equal(s.left.isHit, false, `pressurer not hit (reverse=${reverse})`);
      const hit = lastHit(s.io);
      assert.ok(hit, `expected player_hit (reverse=${reverse})`);
      assert.equal(hit.isCounterHit, true, `CH banner (reverse=${reverse})`);
      assert.equal(hit.showCounterBanner, true);
      assert.notEqual(hit.isTrade, true, `must not trade (reverse=${reverse})`);
      assert.equal(hit.attackerId, s.left.id);
      assert.equal(hit.victimId, s.right.id);
    }
  });

  it("follow-up counter-hit stays +0 (no extra stun)", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime = now - 80;
    armSameTickSlaps(s, now);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    const expectedFree = s.left.attackCooldownUntil;
    assert.equal(s.right.inputLockUntil, expectedFree);
    assert.equal(s.left.inputLockUntil, expectedFree);
    assert.ok(
      s.right.inputLockUntil - now <
        expectedFree - now + SLAP_COUNTER_HIT_BONUS_MS
    );
  });

  it("victim who slaps first still wins the gap", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime = now - 80;
    // Both must stay tip-live (active is only ~47ms). 12ms is outside the
    // 8ms trade window and still inside the confirmable active band.
    armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET - 12 });
    armSlap(s.right, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    s.left.attackAttemptTime = s.left.attackStartTime;
    s.right.attackAttemptTime = s.right.attackStartTime;
    placeInConnectRange(s.left, s.right, "slap");
    assert.ok(
      s.right.attackStartTime < s.left.attackStartTime,
      "victim started earlier"
    );
    assert.ok(
      s.left.attackStartTime - s.right.attackStartTime > SLAP_TRADE_WINDOW_MS,
      "gap must be outside the same-tick trade window"
    );

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true, "late pressurer gets hit");
    assert.equal(s.right.isHit, false, "earlier victim slap wins");
  });

  it("expired stamp: same-tick trades again", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime =
      now - SLAP_FOLLOWUP_PRIORITY_WINDOW_MS - 1;
    armSameTickSlaps(s, now);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, true);
    assert.ok(lastHit(s.io).isTrade);
  });

  it("trade clears follow-up priority so the next dual-commit trades", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime = now - 80;
    s.right.lastSlapHitLandedTime = now - 80;
    armSameTickSlaps(s, now);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, true);
    assert.equal(s.left.lastSlapHitLandedTime, 0);
    assert.equal(s.right.lastSlapHitLandedTime, 0);
  });

  it("victim slap still stuffs a grab in the gap", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime = now - 80;
    armGrabStartup(s.left, { now });
    armSlap(s.right, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    s.right.attackAttemptTime = s.right.attackStartTime;
    placeInConnectRange(s.right, s.left, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isHit, true, "grabber stuffed by victim slap");
    assert.equal(s.right.isHit, false);
    assert.equal(s.left.isGrabStartup, false);
  });

  it("parry still answers the follow-up slap", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime = now - 80;
    armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
    s.left.attackAttemptTime = s.left.attackStartTime;
    armLiveParry(s.right, now);
    placeInConnectRange(s.left, s.right, "slap");

    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.ok(s.io.last("raw_parry_success"), "parry must still resolve");
    assert.equal(s.right.isHit, false, "parrier is not hit");
    assert.equal(s.left.lastSlapHitLandedTime, 0, "parry drops the string");
  });

  it("a second same-tick mash stays a counter-hit (string continues)", () => {
    const s = sc({ gap: 110 });
    const now = s.room.simTime;
    s.left.lastSlapHitLandedTime = now - 80;
    armSameTickSlaps(s, now);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.left.lastSlapHitLandedTime, now);

    s.right.isHit = false;
    s.right.isAlreadyHit = false;
    s.left.isAlreadyHit = false;
    s.left.lastCheckedAttackTime = 0;
    s.right.lastCheckedAttackTime = 0;
    s.io.clear();
    armSameTickSlaps(s, now);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.right.isHit, true);
    assert.equal(s.left.isHit, false);
    const hit = lastHit(s.io);
    assert.equal(hit.isCounterHit, true);
    assert.notEqual(hit.isTrade, true);
  });
});

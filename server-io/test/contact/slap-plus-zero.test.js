"use strict";

/**
 * Pocket slap on-hit is +0: victim hitstun + both input locks equal the
 * attacker's remaining cycle (attackCooldownUntil). Counter-hit is a
 * callout / knockback bonus — it must not extend stun.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { timeoutManager } = require("../../gameUtils");
const {
  createContactScenario,
  armSlap,
  placeInConnectRange,
  runBothCollisionOrders,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("./helpers/contactSim");
const {
  SLAP_COUNTER_HIT_BONUS_MS,
  SLAP_MIN_HITSTUN_MS,
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

function connectSlap(opts = {}) {
  const s = sc({ gap: 110 });
  const now = s.room.simTime;
  armSlap(s.left, { now, startOffset: SLAP_ACTIVE_TEST_OFFSET });
  if (opts.victimStartup) {
    armSlap(s.right, { now, startOffset: 20 });
    s.right.isInStartupFrames = true;
    s.right.attackAttemptTime = now - 20;
  }
  placeInConnectRange(s.left, s.right, "slap");
  runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
  return { s, now };
}

function assertSlapPlusZero(s, now, label) {
  assert.equal(s.right.isHit, true, `${label}: victim must be in hitstun`);
  assert.equal(s.left.isHit, false, `${label}: slapper must not be hit`);

  const expectedFree = s.left.attackCooldownUntil;
  assert.ok(expectedFree > now, `${label}: attacker cycle must still be live`);
  const remain = expectedFree - now;
  assert.ok(
    remain >= SLAP_MIN_HITSTUN_MS,
    `${label}: remaining cycle ${remain} must clear the hitstun floor`
  );

  assert.equal(
    s.right.inputLockUntil,
    expectedFree,
    `${label}: victim lock must end with the slapper's cycle`
  );
  assert.equal(
    s.left.inputLockUntil,
    expectedFree,
    `${label}: slapper movement lock must match the victim (+0)`
  );
}

describe("pocket slap on-hit +0", () => {
  it("neutral connect: both free at remaining cycle", () => {
    const { s, now } = connectSlap();
    assertSlapPlusZero(s, now, "neutral");
  });

  it("counter-hit connect: still +0 (no silent plus)", () => {
    const { s, now } = connectSlap({ victimStartup: true });
    assertSlapPlusZero(s, now, "counter");
    const hit = s.io.find("player_hit").pop();
    assert.equal(hit.payload.isCounterHit, true, "counter callout still fires");
    assert.ok(
      s.right.inputLockUntil - now <
        s.left.attackCooldownUntil - now + SLAP_COUNTER_HIT_BONUS_MS,
      "counter must not add the old 35ms stun bonus"
    );
  });
});

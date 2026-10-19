"use strict";

/**
 * Pocket slap on-hit is a short step ahead: the attacker is free at the end
 * of their cycle, the victim holds STRIKE_HIT_ADVANTAGE_MS longer. Counter-hit
 * is a callout / knockback bonus — it must not extend stun further.
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
  STRIKE_HIT_ADVANTAGE_MS,
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

function assertSlapStepAhead(s, now, label) {
  assert.equal(s.right.isHit, true, `${label}: victim must be in hitstun`);
  assert.equal(s.left.isHit, false, `${label}: slapper must not be hit`);

  const attackerFree = s.left.attackCooldownUntil;
  assert.ok(attackerFree > now, `${label}: attacker cycle must still be live`);
  const remain = attackerFree - now;
  assert.ok(
    remain >= SLAP_MIN_HITSTUN_MS,
    `${label}: remaining cycle ${remain} must clear the hitstun floor`
  );

  assert.equal(
    s.left.inputLockUntil,
    attackerFree,
    `${label}: slapper is free at the end of the cycle`
  );
  assert.equal(
    s.right.inputLockUntil,
    attackerFree + STRIKE_HIT_ADVANTAGE_MS,
    `${label}: victim stays the step ahead`
  );
}

describe("pocket slap on-hit step ahead", () => {
  it("neutral connect: victim holds past the slapper's cycle", () => {
    const { s, now } = connectSlap();
    assertSlapStepAhead(s, now, "neutral");
  });

  it("counter-hit connect: same step ahead (no silent extra stun)", () => {
    const { s, now } = connectSlap({ victimStartup: true });
    assertSlapStepAhead(s, now, "counter");
    const hit = s.io.find("player_hit").pop();
    assert.equal(hit.payload.isCounterHit, true, "counter callout still fires");
    assert.equal(
      s.right.inputLockUntil,
      s.left.attackCooldownUntil + STRIKE_HIT_ADVANTAGE_MS,
      "counter must not add the old 35ms stun bonus"
    );
    assert.ok(SLAP_COUNTER_HIT_BONUS_MS > 0);
  });
});

"use strict";

/**
 * Palm on-hit is +0: victim hitstun + both input locks equal the palmer's
 * remaining pose (attackEndTime after the full-active floor) +
 * PALM_THRUST_HIT_RECOVERY_MS. No 380ms charged leftover lock.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { timeoutManager } = require("../../gameUtils");
const {
  createContactScenario,
  armPalm,
  placeInConnectRange,
  runBothCollisionOrders,
} = require("./helpers/contactSim");
const {
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  PALM_THRUST_HIT_RECOVERY_MS,
} = require("../../constants");

const CHARGED_LEFTOVER_LOCK_MS = 380;
const OLD_BURST_ONLY_MS = 200;

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

function connectPalm(startOffset) {
  const s = sc({ gap: 110 });
  const now = s.room.simTime;
  armPalm(s.left, { now, startOffset });
  placeInConnectRange(s.left, s.right, "palm");
  runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
  return { s, now };
}

function assertPalmPlusZero(s, now, label) {
  assert.equal(s.right.isHit, true, `${label}: victim must be in hitstun`);
  assert.equal(s.left.isHit, false, `${label}: palmer must not be hit`);

  const expectedFree =
    (s.left.attackEndTime || now) + PALM_THRUST_HIT_RECOVERY_MS;
  const victimLock = s.right.inputLockUntil - now;
  const attackerLock = s.left.inputLockUntil - now;

  assert.equal(
    s.right.inputLockUntil,
    expectedFree,
    `${label}: victim lock must end when the palmer recovers`
  );
  assert.equal(
    s.left.inputLockUntil,
    expectedFree,
    `${label}: palmer lock must match the victim (+0)`
  );
  assert.ok(
    Math.abs(victimLock - attackerLock) <= 1,
    `${label}: locks must release together (victim ${victimLock} vs palmer ${attackerLock})`
  );
  assert.ok(
    victimLock !== CHARGED_LEFTOVER_LOCK_MS,
    `${label}: must not inherit the 380ms charged lock`
  );
  assert.ok(
    victimLock !== OLD_BURST_ONLY_MS ||
      expectedFree - now === OLD_BURST_ONLY_MS,
    `${label}: must not use the old 200ms burst lock unless that is the real +0`
  );

  // isHit drops on the same beat as the lock (hitstop paused so the timer can fire).
  s.room.hitstopUntil = 0;
  s.room.simTime = expectedFree - 1;
  timeoutManager.processRoom(s.room);
  assert.equal(s.right.isHit, true, `${label}: still hit one ms before release`);

  s.room.simTime = expectedFree;
  timeoutManager.processRoom(s.room);
  assert.equal(s.right.isHit, false, `${label}: hitstun ends with the lock`);
}

describe("palm on-hit +0", () => {
  it("early-active connect: both free at remaining pose + hit recovery", () => {
    const { s, now } = connectPalm(PALM_THRUST_STARTUP_MS + 5);
    assertPalmPlusZero(s, now, "early");
    const remain = s.left.attackEndTime - now;
    assert.ok(
      remain >= PALM_THRUST_ACTIVE_MS,
      "connect must floor remaining pose to a full active window"
    );
  });

  it("late-active connect: still +0 (full-active floor, not a shorter ghost)", () => {
    const { s, now } = connectPalm(
      PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS - 5
    );
    assertPalmPlusZero(s, now, "late");
  });
});

"use strict";

/**
 * Palm on-hit: the palmer is free at remaining pose + hit recovery. The
 * victim holds STRIKE_HIT_ADVANTAGE_MS longer. No 380ms charged leftover lock.
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
  STRIKE_HIT_ADVANTAGE_MS,
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

function assertPalmStepAhead(s, now, label) {
  assert.equal(s.right.isHit, true, `${label}: victim must be in hitstun`);
  assert.equal(s.left.isHit, false, `${label}: palmer must not be hit`);

  const attackerFree =
    (s.left.attackEndTime || now) + PALM_THRUST_HIT_RECOVERY_MS;
  const victimFree = attackerFree + STRIKE_HIT_ADVANTAGE_MS;
  const victimLock = s.right.inputLockUntil - now;
  const attackerLock = s.left.inputLockUntil - now;

  assert.equal(
    s.left.inputLockUntil,
    attackerFree,
    `${label}: palmer is free at pose + hit recovery`
  );
  assert.equal(
    s.right.inputLockUntil,
    victimFree,
    `${label}: victim stays the step ahead`
  );
  assert.equal(
    victimLock - attackerLock,
    STRIKE_HIT_ADVANTAGE_MS,
    `${label}: the gap is the step ahead`
  );
  assert.ok(
    victimLock !== CHARGED_LEFTOVER_LOCK_MS,
    `${label}: must not inherit the 380ms charged lock`
  );
  assert.ok(
    attackerLock !== OLD_BURST_ONLY_MS ||
      attackerFree - now === OLD_BURST_ONLY_MS,
    `${label}: must not use the old 200ms burst lock unless that is the real recovery`
  );

  s.room.hitstopUntil = 0;
  s.room.simTime = victimFree - 1;
  timeoutManager.processRoom(s.room);
  assert.equal(s.right.isHit, true, `${label}: still hit one ms before release`);

  s.room.simTime = victimFree;
  timeoutManager.processRoom(s.room);
  assert.equal(s.right.isHit, false, `${label}: hitstun ends with the victim lock`);
}

describe("palm on-hit step ahead", () => {
  it("early-active connect: victim holds past the palmer's recovery", () => {
    const { s, now } = connectPalm(PALM_THRUST_STARTUP_MS + 5);
    assertPalmStepAhead(s, now, "early");
    const remain = s.left.attackEndTime - now;
    assert.ok(
      remain >= PALM_THRUST_ACTIVE_MS,
      "connect must floor remaining pose to a full active window"
    );
  });

  it("late-active connect: same step ahead (full-active floor, not a shorter ghost)", () => {
    const { s, now } = connectPalm(
      PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS - 5
    );
    assertPalmStepAhead(s, now, "late");
  });
});

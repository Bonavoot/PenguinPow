"use strict";

/**
 * Space answers the flying headbutt.
 * Tap deflects (Perfect is the turn). Hold braces (ground lost, no turn).
 * An open headbutt still hits. Grab is not in this path.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_ACTIVE_MS,
  PERFECT_PARRY_WINDOW,
  PERFECT_PARRY_ATTACKER_STUN_DURATION,
  AP_STAGGER_CHARGED_MS,
  GUARD_CHARGED_BALANCE_CHIP,
  GUARD_CHARGED_LOCK_MS,
  BALANCE_CHARGED_HIT_DRAIN,
} = require("../../constants");
const {
  createContactScenario,
  armCharged,
  placeInConnectRange,
  runBothCollisionOrders,
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
  player.keys[" "] = true;
  return player;
}

function armGuard(player) {
  player.isRawParrying = true;
  player.isGuarding = true;
  player.apActiveUntil = 0;
  player.stamina = 80;
  player.balance = 100;
  player.keys[" "] = true;
  return player;
}

function connectHeadbutt(s) {
  const now = s.simTime;
  armCharged(s.left, { now, power: 80 });
  placeInConnectRange(s.left, s.right, "charged");
  const balanceBefore = s.right.balance;
  runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
  return { now, balanceBefore };
}

describe("Space answers the flying headbutt", () => {
  it("a tight tap is Perfect — the charger is stunned, the defender is not hit", () => {
    const s = sc({ gap: 80 });
    armLiveParry(s.right, s.simTime, { just: true });
    const { now } = connectHeadbutt(s);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev, "headbutt meets the parry");
    assert.equal(ev.payload.isPerfect, true);
    assert.equal(s.right.isHit, false);
    assert.equal(s.right.knockbackVelocity.x, 0);
    assert.equal(s.left.isAttacking, false, "hitbox dies");
    assert.equal(s.left.movementVelocity, 0, "lunge dies");
    assert.ok(
      (s.left.inputLockUntil || 0) >= now + PERFECT_PARRY_ATTACKER_STUN_DURATION,
      "perfect is the turn"
    );
    assert.equal(s.io.find("guard_block").length, 0);
  });

  it("an early tap answers the headbutt without handing over the turn", () => {
    const s = sc({ gap: 80 });
    armLiveParry(s.right, s.simTime, { just: false });
    const { now } = connectHeadbutt(s);

    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, false);
    assert.equal(s.right.isHit, false);
    assert.equal(s.right.isPerfectRawParrySuccess, false);
    assert.ok(
      (s.left.inputLockUntil || 0) >= now + AP_STAGGER_CHARGED_MS
    );
    assert.ok(
      (s.left.inputLockUntil || 0) < now + PERFECT_PARRY_ATTACKER_STUN_DURATION,
      "regular parry is not starstun"
    );
  });

  it("holding Space braces the headbutt — chip and push, nobody gets a turn", () => {
    const s = sc({ gap: 80 });
    armGuard(s.right);
    const { now } = connectHeadbutt(s);

    const ev = s.io.last("guard_block");
    assert.ok(ev, "brace absorbs the headbutt");
    assert.equal(ev.payload.isHeadbutt, true);
    assert.equal(ev.payload.attackType, "charged");
    assert.equal(s.right.isHit, false);
    assert.equal(s.right.balance, 100 - GUARD_CHARGED_BALANCE_CHIP);
    assert.ok(
      Math.abs(s.right.slapParryKnockbackVelocity) > 0,
      "brace still gives ground"
    );
    assert.equal(s.left.isAttacking, false);
    assert.equal(s.left.movementVelocity, 0);
    assert.ok((s.left.inputLockUntil || 0) >= now + GUARD_CHARGED_LOCK_MS);
    assert.ok((s.right.inputLockUntil || 0) >= now + GUARD_CHARGED_LOCK_MS);
    assert.equal(s.io.find("raw_parry_success").length, 0);
    assert.ok(
      GUARD_CHARGED_BALANCE_CHIP < BALANCE_CHARGED_HIT_DRAIN,
      "brace costs less posture than eating the hit"
    );
  });

  it("an open headbutt still lands when Space is down", () => {
    const s = sc({ gap: 80 });
    connectHeadbutt(s);
    assert.equal(s.right.isHit, true);
    assert.equal(s.io.find("raw_parry_success").length, 0);
    assert.equal(s.io.find("guard_block").length, 0);
  });
});

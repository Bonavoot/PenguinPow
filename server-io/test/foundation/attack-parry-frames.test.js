"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_SUCCESS_RECOVERY_MS,
  AP_STAGGER_SLAP_MS,
  AP_STAGGER_PALM_MS,
  AP_STAGGER_FLAP_MS,
  AP_FLURRY_STAGGER_BEGIN_MS,
  AP_ATTACKER_KNOCKBACK,
  PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PERFECT_PARRY_STUN_REACT_MS,
  GUARD_ATTACKER_RECOVERY_MS,
  AP_KILL_ENABLED,
  AP_OPEN_HIT_GRACE_ENABLED,
  PERFECT_PARRY_JUST_TICKS,
  PERFECT_PARRY_WINDOW,
  TICK_RATE,
  SLAP_TOTAL_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_PARRY_KB_FRICTION,
  ICE_COAST_FRICTION,
  speedFactor,
  AP_LATE_PARRY_MS,
} = require("../../constants");
const { SLAP_STEP_IN_VELOCITY } = require("../../momentumTransfer");

describe("Attack parry frame contract", () => {
  it("regular slap parry is +0 after freeze (begin delay + stagger = plant)", () => {
    assert.equal(
      AP_FLURRY_STAGGER_BEGIN_MS + AP_STAGGER_SLAP_MS,
      AP_SUCCESS_RECOVERY_MS
    );
  });

  it("regular slap parry reject is recovered by the next standing slap before active ends", () => {
    const msPerTick = 1000 / TICK_RATE;
    const pxPerTick = msPerTick * speedFactor;
    const shoveTravel =
      AP_ATTACKER_KNOCKBACK * pxPerTick / (1 - SLAP_PARRY_KB_FRICTION);

    // Discrete worst case: floor ticks in startup+active (the arm tick may
    // not move). Coast friction matches committed slap slide. Tip-range
    // mash must still reconnect; a net-positive shove is what dropped slap 3.
    const approachTicks = Math.floor(
      (SLAP_STARTUP_MS + SLAP_ACTIVE_MS) / msPerTick
    );
    const f = ICE_COAST_FRICTION;
    const stepInTravel =
      SLAP_STEP_IN_VELOCITY *
      pxPerTick *
      (1 - Math.pow(f, approachTicks)) /
      (1 - f);

    assert.ok(shoveTravel > 0, "regular parry still rejects");
    assert.ok(
      shoveTravel <= stepInTravel,
      `regular reject ${shoveTravel.toFixed(1)}px must be ≤ standing slap approach ${stepInTravel.toFixed(1)}px over ${approachTicks} ticks`
    );
  });

  it("perfect starstun covers two mashed slaps after the plant, plus react pad", () => {
    const afterBeginToPlant =
      AP_SUCCESS_RECOVERY_MS - AP_FLURRY_STAGGER_BEGIN_MS;
    const twoSlapConnect = SLAP_TOTAL_MS + SLAP_STARTUP_MS;
    assert.equal(PERFECT_PARRY_STUN_REACT_MS, 85);
    assert.equal(
      PERFECT_PARRY_ATTACKER_STUN_DURATION,
      afterBeginToPlant + twoSlapConnect + PERFECT_PARRY_STUN_REACT_MS
    );
    assert.equal(
      Math.max(AP_STAGGER_SLAP_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION),
      PERFECT_PARRY_ATTACKER_STUN_DURATION
    );
    assert.equal(
      Math.max(AP_STAGGER_PALM_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION),
      PERFECT_PARRY_ATTACKER_STUN_DURATION
    );
    assert.equal(
      Math.max(AP_STAGGER_FLAP_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION),
      PERFECT_PARRY_ATTACKER_STUN_DURATION
    );
    assert.ok(
      PERFECT_PARRY_ATTACKER_STUN_DURATION > AP_SUCCESS_RECOVERY_MS,
      "perfect slap stays plus vs the shared plant"
    );
  });

  it("attack parry cannot finish the round (kill flag off, branch kept)", () => {
    assert.equal(AP_KILL_ENABLED, false);
  });

  it("just is two ticks on either side of the clap (grace matches just)", () => {
    assert.equal(PERFECT_PARRY_JUST_TICKS, 2);
    assert.equal(PERFECT_PARRY_WINDOW, (2 * 1000) / TICK_RATE);
    assert.equal(AP_LATE_PARRY_MS, PERFECT_PARRY_WINDOW);
    assert.equal(AP_OPEN_HIT_GRACE_ENABLED, true);
    assert.ok(
      AP_LATE_PARRY_MS + 15 < SLAP_ACTIVE_MS,
      "open-hit grace must leave confirmable jab active frames"
    );
  });

  it("blocked attack leftover cycle is the lock; mash buffer is still consumed", () => {
    assert.ok(GUARD_ATTACKER_RECOVERY_MS > 0);
    assert.ok(
      GUARD_ATTACKER_RECOVERY_MS < AP_SUCCESS_RECOVERY_MS,
      "block settle floor is not a parry plant"
    );
  });
});

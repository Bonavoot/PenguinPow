"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_SUCCESS_RECOVERY_MS,
  AP_STAGGER_SLAP_MS,
  AP_STAGGER_PALM_MS,
  AP_STAGGER_FLAP_MS,
  AP_FLURRY_STAGGER_BEGIN_MS,
  PERFECT_PARRY_ATTACKER_STUN_DURATION,
  GUARD_ATTACKER_RECOVERY_MS,
  AP_KILL_ENABLED,
} = require("../../constants");

describe("Attack parry frame contract", () => {
  it("regular slap parry is +0 after freeze (begin delay + stagger = plant)", () => {
    assert.equal(
      AP_FLURRY_STAGGER_BEGIN_MS + AP_STAGGER_SLAP_MS,
      AP_SUCCESS_RECOVERY_MS
    );
  });

  it("perfect starstun is a turn, not a freeze — max(move stagger, 420)", () => {
    assert.equal(PERFECT_PARRY_ATTACKER_STUN_DURATION, 420);
    assert.equal(
      Math.max(AP_STAGGER_SLAP_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION),
      420
    );
    assert.equal(
      Math.max(AP_STAGGER_PALM_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION),
      AP_STAGGER_PALM_MS
    );
    assert.equal(
      Math.max(AP_STAGGER_FLAP_MS, PERFECT_PARRY_ATTACKER_STUN_DURATION),
      AP_STAGGER_FLAP_MS
    );
    assert.ok(
      PERFECT_PARRY_ATTACKER_STUN_DURATION > AP_SUCCESS_RECOVERY_MS,
      "perfect slap stays plus vs the shared plant"
    );
  });

  it("attack parry cannot finish the round (kill flag off, branch kept)", () => {
    assert.equal(AP_KILL_ENABLED, false);
  });

  it("blocked attack gets a short settle so the string cannot continue", () => {
    assert.ok(GUARD_ATTACKER_RECOVERY_MS > 0);
    assert.ok(
      GUARD_ATTACKER_RECOVERY_MS < AP_SUCCESS_RECOVERY_MS,
      "block settle is not a parry plant"
    );
  });
});

"use strict";

/**
 * MATADOR press-and-hold — same input feel as Attack Parry, one outcome.
 * Tap (release inside the 180ms arm window) → whiff jail.
 * Hold past the window → stay isMatadorParrying forever; grab still pulls.
 * Release from the hold floor → clean drop, no jail.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  MATADOR_ACTIVE_MS,
  MATADOR_WHIFF_RECOVERY_MS,
} = require("../../constants");
const {
  armMatador,
  updateMatadorState,
  canArmMatador,
  canArmAttackParry,
  isMatadorHoldFloor,
  wantsMatadorChord,
} = require("../../gameUtils");
const {
  createInitialPlayerState,
  createInitialKeys,
} = require("../../playerFactory");

function makePlayer({ facing = 1 } = {}) {
  const player = createInitialPlayerState({
    id: "p1",
    fighter: "player 1",
    x: 500,
    facing,
    stamina: 100,
    balance: 100,
  });
  player.keys = createInitialKeys();
  return player;
}

describe("Matador press-and-hold", () => {
  it("keeps the grab-read live while Space is held past the 180ms arm window", () => {
    const p = makePlayer();
    armMatador(p, 0);
    updateMatadorState(p, 100, true);
    assert.equal(p.isMatadorParrying, true);
    assert.equal(p.isMatadorWhiffRecovering, false);

    updateMatadorState(p, MATADOR_ACTIVE_MS, true);
    assert.equal(p.isMatadorParrying, true, "expiry while held stays Matador");
    assert.equal(p.isMatadorWhiffRecovering, false);
    assert.equal(isMatadorHoldFloor(p), true);
    assert.equal(p.matadorActiveUntil, 0);

    updateMatadorState(p, 8_000, true);
    assert.equal(p.isMatadorParrying, true, "infinite hold still works");
    assert.equal(p.isMatadorWhiffRecovering, false);
    assert.equal(canArmAttackParry(p, 8_000), false, "cannot convert hold to AP");
    assert.equal(canArmMatador(p, 8_000), false, "one press, one commitment");
  });

  it("empty release inside the arm window pays whiff recovery", () => {
    const p = makePlayer();
    armMatador(p, 0);
    updateMatadorState(p, 50, false);
    assert.equal(p.isMatadorParrying, false);
    assert.equal(p.isMatadorWhiffRecovering, true);
    assert.ok(p.matadorRecoveryUntil >= 50 + MATADOR_WHIFF_RECOVERY_MS);
    assert.equal(isMatadorHoldFloor(p), false);
  });

  it("dropping the hold floor is a clean drop — no whiff jail", () => {
    const p = makePlayer();
    armMatador(p, 0);
    updateMatadorState(p, MATADOR_ACTIVE_MS, true);
    assert.equal(isMatadorHoldFloor(p), true);

    updateMatadorState(p, MATADOR_ACTIVE_MS + 16, false);
    assert.equal(p.isMatadorParrying, false);
    assert.equal(p.isMatadorWhiffRecovering, false);
    assert.equal(p.matadorRecoveryUntil, 0);
    assert.equal(p.apSpaceConsumed, false);
  });

  it("expiring the arm window with Space already up is still a whiff", () => {
    const p = makePlayer();
    armMatador(p, 0);
    // Skip mid-window ticks (as if SM missed the falling edge) and expire cold.
    updateMatadorState(p, MATADOR_ACTIVE_MS, false);
    assert.equal(p.isMatadorParrying, false);
    assert.equal(p.isMatadorWhiffRecovering, true);
  });

  it("BACK+SPACE is the arm chord (facing-relative)", () => {
    // facing 1 = looking left → forward A, back D.
    const lookingLeft = makePlayer({ facing: 1 });
    lookingLeft.keys.d = true;
    lookingLeft.keys.a = false;
    assert.equal(wantsMatadorChord(lookingLeft), true);

    lookingLeft.keys.d = false;
    lookingLeft.keys.a = true;
    assert.equal(wantsMatadorChord(lookingLeft), false);

    // facing -1 = looking right → forward D, back A.
    const lookingRight = makePlayer({ facing: -1 });
    lookingRight.keys.a = true;
    lookingRight.keys.d = false;
    assert.equal(wantsMatadorChord(lookingRight), true);
  });
});

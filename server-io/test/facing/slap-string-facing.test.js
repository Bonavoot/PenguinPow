"use strict";

/**
 * Slap-string facing after a side switch (sidestep / air / rope-jump cross-up).
 *
 * An in-flight slap must keep its committed facing. The NEXT slap in a mash
 * string — buffered follow-up or a fresh press after the cycle ends — must
 * snapshot live relative X, not the previous swing's lock.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  createFoundationScenario,
  advanceSim,
} = require("../foundation/helpers/scenarioHarness");
const { executeSlapAttack, executePalmThrust, executeChargedAttack } = require("../../gameFunctions");
const { getActionFacingLock } = require("../../actionFacingOwnership");
const { getLockedFacing, enforcePairFacing } = require("../../facingSystem");
const {
  SLAP_TOTAL_MS,
  SLAP_WHIFF_EXTRA_RECOVERY_MS,
  TICK_RATE,
} = require("../../constants");

const TICK_MS = 1000 / TICK_RATE;
const PAST_CYCLE_MS =
  SLAP_TOTAL_MS + SLAP_WHIFF_EXTRA_RECOVERY_MS + 4 * TICK_MS;

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(options) {
  const s = createFoundationScenario(options);
  scenarios.push(s);
  return s;
}

function runPastSlapCycle(s) {
  for (let elapsed = 0; elapsed < PAST_CYCLE_MS; elapsed += TICK_MS) {
    advanceSim(s, TICK_MS);
  }
}

function committedSlapDir(player) {
  const lock = getActionFacingLock(player);
  if (lock && (lock.direction === 1 || lock.direction === -1)) {
    return lock.direction;
  }
  return player.slapFacingDirection;
}

describe("slap string facing after a side switch", () => {
  it("active slap does not flip when the opponent crosses mid-swing", () => {
    const s = sc();
    const slapper = s.left;
    const opponent = s.right;
    executeSlapAttack(slapper, s.rooms);

    const committed = committedSlapDir(slapper);
    assert.equal(committed, -1, "first slap faces right toward the opponent");

    opponent.x = slapper.x - 180;
    enforcePairFacing(slapper, opponent, s.room.simTime);

    assert.equal(slapper.isAttacking, true);
    assert.equal(committedSlapDir(slapper), committed);
    assert.equal(slapper.facing, committed);
    assert.equal(getLockedFacing(slapper), committed);
  });

  it("buffered follow-up slap faces the new side after a cross-up", () => {
    const s = sc();
    const slapper = s.left;
    const opponent = s.right;
    executeSlapAttack(slapper, s.rooms);
    assert.equal(committedSlapDir(slapper), -1);

    opponent.x = slapper.x - 180;
    slapper.pendingSlapCount = 1;
    slapper.pendingSlapPressTime = s.room.simTime;
    runPastSlapCycle(s);

    assert.equal(slapper.isAttacking, true, "buffered slap must fire");
    assert.equal(slapper.attackType, "slap");
    assert.equal(
      committedSlapDir(slapper),
      1,
      "follow-up must face left toward the crossed-up opponent"
    );
    assert.equal(slapper.facing, 1);
    enforcePairFacing(slapper, opponent, s.room.simTime);
    assert.equal(slapper.facing, 1);
  });

  it("fresh slap after cycle end faces the new side (spaced tap)", () => {
    const s = sc();
    const slapper = s.left;
    const opponent = s.right;
    executeSlapAttack(slapper, s.rooms);
    runPastSlapCycle(s);
    assert.equal(slapper.isAttacking, false);

    opponent.x = slapper.x - 180;
    executeSlapAttack(slapper, s.rooms);

    assert.equal(committedSlapDir(slapper), 1);
    assert.equal(slapper.facing, 1);
  });

  it("leftover slapFacingDirection must not pin the next swing", () => {
    const s = sc();
    const slapper = s.left;
    const opponent = s.right;
    executeSlapAttack(slapper, s.rooms);
    runPastSlapCycle(s);

    slapper.slapFacingDirection = -1;
    slapper.facing = -1;
    opponent.x = slapper.x - 180;
    executeSlapAttack(slapper, s.rooms);

    assert.equal(
      committedSlapDir(slapper),
      1,
      "a new swing must ignore a stale slapFacingDirection leftover"
    );
    assert.equal(slapper.facing, 1);
  });

  it("a second executeSlapAttack during the active swing does not retarget", () => {
    const s = sc();
    const slapper = s.left;
    const opponent = s.right;
    executeSlapAttack(slapper, s.rooms);
    const committed = committedSlapDir(slapper);
    const startTime = slapper.attackStartTime;

    opponent.x = slapper.x - 180;
    executeSlapAttack(slapper, s.rooms);

    assert.equal(slapper.attackStartTime, startTime, "must not restart the cycle");
    assert.equal(committedSlapDir(slapper), committed);
    assert.equal(slapper.facing, committed);
  });
});

describe("palm / charged commit facing after a side switch", () => {
  it("palm faces live X even if the opponent is still sidestepping", () => {
    const s = sc();
    const poker = s.left;
    const opponent = s.right;
    opponent.x = poker.x - 180;
    opponent.isSidestepping = true;
    opponent.isSidestepRecovery = true;

    executePalmThrust(poker, s.rooms);

    assert.equal(poker.isPalmThrust, true);
    assert.equal(poker.facing, 1);
    assert.equal(poker.chargingFacingDirection, 1);
  });

  it("charged release faces live X even if the opponent is still sidestepping", () => {
    const s = sc();
    const charger = s.left;
    const opponent = s.right;
    opponent.x = charger.x - 180;
    opponent.isSidestepping = true;

    executeChargedAttack(charger, 50, s.rooms);

    assert.equal(charger.attackType, "charged");
    assert.equal(charger.facing, 1);
    assert.equal(charger.chargingFacingDirection, 1);
  });

  it("charged lunge does not flip after release when the opponent crosses", () => {
    const s = sc();
    const charger = s.left;
    const opponent = s.right;
    executeChargedAttack(charger, 50, s.rooms);
    assert.equal(charger.facing, -1);

    opponent.x = charger.x - 180;
    enforcePairFacing(charger, opponent, s.room.simTime);

    assert.equal(charger.facing, -1);
    assert.equal(charger.chargingFacingDirection, -1);
  });
});

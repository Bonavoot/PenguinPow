"use strict";

/**
 * Round resolution — ring-out losers are marked for the client topple, floored
 * to an exit shove that clears the rope, and excluded from the bow; dedicated
 * kill / grab finishes are left alone.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  createFoundationScenario,
} = require("../foundation/helpers/scenarioHarness");
const { handleWinCondition } = require("../../gameFunctions");
const {
  RING_OUT_EXIT_VELOCITY,
  TRAINING_RING_OUT_HOLD_MS,
  DELTA_TRACKED_PROPS,
  ALL_TRACKED_PROPS,
} = require("../../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");
const { computePlayerDelta } = require("../../deltaState");

describe("ring-out resolution (handleWinCondition)", () => {
  let scenario = null;
  afterEach(() => {
    if (scenario) scenario.dispose();
    scenario = null;
  });

  it("marks the loser for the topple in the fall direction and floors the exit shove", () => {
    scenario = createFoundationScenario({ leftX: MAP_LEFT_BOUNDARY - 2, rightX: 600 });
    const { room, io, left: loser, right: winner } = scenario;
    loser.isHit = true;
    loser.lastHitType = "slap";
    loser.knockbackVelocity = { x: -1.2, y: 0 }; // a slap's leftover shove

    handleWinCondition(room, loser, winner, io, "slap");

    assert.equal(room.gameOver, true);
    assert.equal(loser.isRingOutLoser, true);
    assert.equal(loser.ringOutDirection, -1);
    assert.ok(loser.ringOutStartTime > 0);
    assert.equal(loser.isHit, true, "struck body stays struck for the resolution");
    assert.ok(
      Math.abs(loser.knockbackVelocity.x) >= RING_OUT_EXIT_VELOCITY - 1e-9,
      `exit shove floored (${loser.knockbackVelocity.x})`
    );
    assert.equal(Math.sign(loser.knockbackVelocity.x), -1, "shove points out of the ring");
    assert.equal(winner.isRoundWinner, true);
    assert.equal(winner.knockbackVelocity.x, 0);

    const over = io.last("game_over");
    assert.ok(over, "game_over still emitted on the win tick");
    assert.equal(over.payload.winType, "slap");
  });

  it("keeps a stronger existing shove instead of clamping it down", () => {
    scenario = createFoundationScenario({ leftX: 600, rightX: MAP_RIGHT_BOUNDARY + 4 });
    const { room, io, left: winner, right: loser } = scenario;
    loser.isHit = true;
    loser.knockbackVelocity = { x: 9.5, y: 0 }; // charged send

    handleWinCondition(room, loser, winner, io, "charged");

    assert.equal(loser.isRingOutLoser, true);
    assert.equal(loser.ringOutDirection, 1);
    assert.equal(loser.knockbackVelocity.x, 9.5);
  });

  it("does not topple finishes that own their own presentation", () => {
    for (const winType of ["clinchKillThrow", "clinchKillPull", "grabPush", "grabThrow", "cinematicKill", "timeExpired"]) {
      scenario = createFoundationScenario({ leftX: MAP_LEFT_BOUNDARY - 2, rightX: 600 });
      const { room, io, left: loser, right: winner } = scenario;
      if (winType === "clinchKillThrow") loser.isClinchKillThrowVictim = true;
      if (winType === "clinchKillPull") loser.isClinchKillPullVictim = true;
      if (winType === "cinematicKill") loser.isCinematicKillVictim = true;
      const kbBefore = { x: -0.4, y: 0 };
      loser.knockbackVelocity = { ...kbBefore };

      handleWinCondition(room, loser, winner, io, winType);

      assert.equal(!!loser.isRingOutLoser, false, `${winType} must not topple`);
      assert.equal(loser.knockbackVelocity.x, kbBefore.x, `${winType} shove untouched`);
      assert.equal(winner.isRoundWinner, true);
      scenario.dispose();
      scenario = null;
    }
  });

  it("training lab: plays the same resolution, then holds before the snap-back", () => {
    scenario = createFoundationScenario({ leftX: MAP_LEFT_BOUNDARY - 2, rightX: 600 });
    const { room, io, left: loser, right: winner } = scenario;
    room.matchMode = "training";
    loser.isHit = true;
    loser.knockbackVelocity = { x: -0.8, y: 0 };

    handleWinCondition(room, loser, winner, io, "slap");

    assert.equal(room.gameOver, false, "training never enters the match game-over state");
    assert.equal(loser.isRingOutLoser, true);
    assert.equal(loser.ringOutDirection, -1);
    assert.ok(Math.abs(loser.knockbackVelocity.x) >= RING_OUT_EXIT_VELOCITY - 1e-9);
    assert.ok(room.trainingResolution, "a resolution hold is armed instead of an instant reset");
    assert.equal(room.trainingResolution.holdMs, TRAINING_RING_OUT_HOLD_MS);
    assert.equal(room.trainingResetPending, undefined, "no same-tick reset");
    assert.ok(loser.inputLockUntil > room.simTime, "downed loser cannot act during the beat");
    const ro = io.find("ring_out");
    assert.equal(ro.length, 1);
    assert.equal(ro[0].payload.direction, "left");

    // The boundary check re-fires every tick while the loser is out — no re-arm.
    handleWinCondition(room, loser, winner, io, "slap");
    assert.equal(io.find("ring_out").length, 1);
  });

  it("ships the resolution flags on the fighter wire (delta + keyframe)", () => {
    for (const prop of ["isRingOutLoser", "ringOutDirection", "isRoundWinner"]) {
      assert.ok(DELTA_TRACKED_PROPS.includes(prop), `${prop} tracked for deltas`);
      assert.ok(ALL_TRACKED_PROPS.includes(prop), `${prop} in keyframes`);
    }
    const prev = { isRingOutLoser: false, ringOutDirection: 0, x: 1, y: 2, facing: 1 };
    const cur = { ...prev, isRingOutLoser: true, ringOutDirection: -1 };
    const delta = computePlayerDelta(cur, prev);
    assert.equal(delta.isRingOutLoser, true);
    assert.equal(delta.ringOutDirection, -1);
  });
});

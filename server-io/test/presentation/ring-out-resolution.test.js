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
  GROUND_LEVEL,
  ICE_COAST_FRICTION,
  PAST_MAP_DIRT_MOVE_FRICTION,
  TICK_RATE,
  speedFactor,
  SLAP_RING_OUT_APRON_BUFFER,
} = require("../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  slapRingOutApronSpeedCap,
} = require("../../gameUtils");
const { computePlayerDelta } = require("../../deltaState");

describe("ring-out resolution (handleWinCondition)", () => {
  let scenario = null;
  afterEach(() => {
    if (scenario) scenario.dispose();
    scenario = null;
  });

  it("a slap ring-out stays in the hit reaction and keeps the slap's own shove", () => {
    scenario = createFoundationScenario({ leftX: MAP_LEFT_BOUNDARY - 2, rightX: 600 });
    const { room, io, left: loser, right: winner } = scenario;
    loser.isHit = true;
    loser.lastHitType = "slap";
    loser.isAtTheRopes = true;
    loser.lastHitTime = 12345;
    loser.knockbackVelocity = { x: -1.2, y: 0 }; // a slap's leftover shove

    handleWinCondition(room, loser, winner, io, "slap");

    assert.equal(room.gameOver, true);
    assert.equal(loser.isRingOutLoser, false, "slap does not arm the ring-out topple");
    assert.equal(loser.ringOutDirection, -1);
    assert.equal(loser.ringOutApronStop, true);
    assert.equal(loser.isAtTheRopes, false, "ropes pose must not hold them after the hit");
    assert.equal(loser.lastHitTime, 12345, "existing hitstun is left to end on its own");
    assert.equal(loser.isHit, true, "the hit already in progress is not cleared");
    assert.equal(loser.knockbackVelocity.x, -1.2, "slap shove is not floored into a fall");
    assert.equal(loser.isFallingOffDohyo, false);
    assert.equal(loser.y, GROUND_LEVEL);
    assert.equal(winner.isRoundWinner, true);
    assert.equal(winner.knockbackVelocity.x, 0);

    const over = io.last("game_over");
    assert.ok(over, "game_over still emitted on the win tick");
    assert.equal(over.payload.winType, "slap");
  });

  it("caps a hard slap so dirt coast stops short of the dohyo fall edge", () => {
    const startX = MAP_LEFT_BOUNDARY - 8;
    scenario = createFoundationScenario({ leftX: startX, rightX: 600 });
    const { room, io, left: loser, right: winner } = scenario;
    loser.isHit = true;
    loser.knockbackVelocity = { x: -12, y: 0 };

    handleWinCondition(room, loser, winner, io, "slap");

    const cap = slapRingOutApronSpeedCap(startX, -1);
    assert.ok(Math.abs(loser.knockbackVelocity.x) <= cap + 1e-9);
    assert.ok(Math.abs(loser.knockbackVelocity.x) < RING_OUT_EXIT_VELOCITY);
    assert.equal(Math.sign(loser.knockbackVelocity.x), -1);

    // Slipperiest apron channel: friction, then the step. The cap is this series.
    let x = loser.x;
    let v = loser.knockbackVelocity.x;
    const friction = ICE_COAST_FRICTION * PAST_MAP_DIRT_MOVE_FRICTION;
    const k = (1000 / TICK_RATE) * speedFactor;
    const stopX = DOHYO_LEFT_BOUNDARY + SLAP_RING_OUT_APRON_BUFFER;
    for (let i = 0; i < 400 && Math.abs(v) > 1e-4; i++) {
      x += v * k;
      v *= friction;
    }
    assert.ok(x >= stopX - 1e-6, `slide ended at ${x}, stop line is ${stopX}`);
    assert.ok(x > DOHYO_LEFT_BOUNDARY, "never reaches the fall edge");
  });

  it("still floors a weak non-slap ring-out so the loser drops off the platform", () => {
    scenario = createFoundationScenario({ leftX: MAP_LEFT_BOUNDARY - 2, rightX: 600 });
    const { room, io, left: loser, right: winner } = scenario;
    loser.isHit = true;
    loser.lastHitType = "charged";
    loser.knockbackVelocity = { x: -1.2, y: 0 };

    handleWinCondition(room, loser, winner, io, "charged");

    assert.equal(loser.ringOutApronStop, false);
    assert.equal(loser.isRingOutLoser, true);
    assert.ok(Math.abs(loser.knockbackVelocity.x) >= RING_OUT_EXIT_VELOCITY - 1e-9);
    assert.equal(Math.sign(loser.knockbackVelocity.x), -1);
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
    assert.equal(loser.isRingOutLoser, false, "training slap does not topple either");
    assert.equal(loser.ringOutDirection, -1);
    assert.equal(loser.ringOutApronStop, true);
    assert.equal(loser.knockbackVelocity.x, -0.8, "training slap uses the same apron stop");
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

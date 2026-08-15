"use strict";

/**
 * Phase 2 — cleanup ownership / lifecycle hardening tests.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { GROUND_LEVEL } = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
  clearAllActionStates,
  clearSlideJumpState,
  isSlideJumpFlightImmune,
} = require("../../gameUtils");
const {
  OFFENSIVE_AERIAL_OUTCOME,
  OFFENSIVE_AERIAL_CLEANUP_STAGE,
  OFFENSIVE_AERIAL_MOVEMENT_OWNER,
  beginOffensiveAerialActivation,
  resolveOffensiveAerialOutcome,
  markOffensiveAerialLandingHandoff,
  finalizeOffensiveAerialActivation,
  resetOffensiveAerialActivation,
  OFFENSIVE_AERIAL_MOVE_TYPE,
} = require("../../offensiveAerialOutcome");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
  beginSlideJumpFlight,
} = require("./helpers/slideJumpSim");
const { executeInputBuffer } = require("../../gameFunctions");
const { isBodySlamWindowOpen } = require("../../offensiveAerialTrace");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("offensive aerial — cleanup stages", () => {
  it("CONTACT_CONSUMED after hit keeps flight continuation (post-hit travel)", () => {
    const s = createSlideJumpScenario({
      name: "contact_consumed_continue",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 3,
      attackerY: GROUND_LEVEL + 50,
    });
    placeDescendingOverOpponent(s, { height: 50 });
    const xBefore = s.attacker.x;
    stepSlideJumpTick(s);
    assert.equal(
      s.attacker.offensiveAerial.cleanupStage,
      OFFENSIVE_AERIAL_CLEANUP_STAGE.CONTACT_CONSUMED
    );
    assert.equal(s.attacker.isSlideJumping, true);
    assert.equal(
      s.attacker.offensiveAerial.movementOwner,
      OFFENSIVE_AERIAL_MOVEMENT_OWNER.POST_HIT_TRAVEL
    );
    // Still airborne movement owner — may advance X on subsequent ticks.
    assert.ok(s.attacker.y > GROUND_LEVEL || s.attacker.slideJumpPhase === "landing");
    void xBefore;
  });

  it("PARRIED path grounds immediately (skips aerial landing phase)", () => {
    const s = createSlideJumpScenario({
      name: "parry_cleanup",
      armFlap: true,
      attackerX: 520,
      defenderX: 520,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.slideJumpPhase, null);
    assert.equal(s.attacker.isRecovering, true);
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.PARRIED
    );
  });

  it("TOUCHDOWN_HANDOFF then RECOVERY_COMPLETE clears move state", () => {
    const s = createSlideJumpScenario({
      name: "handoff_complete",
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 850,
      velY: -10,
      attackerY: GROUND_LEVEL + 15,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    assert.equal(
      s.attacker.offensiveAerial.cleanupStage,
      OFFENSIVE_AERIAL_CLEANUP_STAGE.TOUCHDOWN_HANDOFF
    );
    runUntil(s, () => !s.attacker.isSlideJumping, 40);
    assert.equal(s.attacker.offensiveAerial, null);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.attacker.flapCharges, 0);
  });

  it("FULL_RESET clears activation and debug counters when requested", () => {
    const s = createSlideJumpScenario({
      name: "full_reset",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    s.attacker._offensiveAerialIllegalTransitions = 2;
    resetOffensiveAerialActivation(s.attacker, { clearDebugCounters: true });
    assert.equal(s.attacker.offensiveAerial, null);
    assert.equal(s.attacker._offensiveAerialIllegalTransitions, 0);
  });
});

describe("offensive aerial — immunity cleanup", () => {
  it("ascent is hittable; dive (past peak) is strike-immune", () => {
    const s = createSlideJumpScenario({
      name: "immunity_flight",
      armFlap: true,
      attackerY: GROUND_LEVEL + 60,
      velY: 5,
    });
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    s.attacker.keys.s = true;
    runUntil(s, () => s.attacker.slideJumpDiveCommitted, 40);
    assert.equal(s.attacker.slideJumpDiveCommitted, true);
    assert.equal(isSlideJumpFlightImmune(s.attacker), true);
  });

  it("parry clears flight immunity (no longer slide-jumping)", () => {
    const s = createSlideJumpScenario({
      name: "immunity_parry",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    assert.equal(s.attacker.isSlideJumping, false);
  });

  it("touchdown / reset clear immunity; no leak into next move", () => {
    const s = createSlideJumpScenario({
      name: "immunity_land",
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      attackerY: GROUND_LEVEL + 10,
    });
    assert.equal(isSlideJumpFlightImmune(s.attacker), true);
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    runUntil(s, () => !s.attacker.isSlideJumping, 40);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    beginSlideJumpFlight(s.attacker, { now: s.room.simTime, armFlap: false });
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
  });

  it("interruption clears immunity", () => {
    const s = createSlideJumpScenario({
      name: "immunity_interrupt",
      armFlap: true,
      attackerY: GROUND_LEVEL + 80,
      velY: 5,
    });
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    clearAllActionStates(s.attacker);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
  });
});

describe("offensive aerial — movement + buffer preservation", () => {
  it("no-slam whiff land skips the plant lock (continue-slide)", () => {
    const s = createSlideJumpScenario({
      name: "whiff_recovery_ms",
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 10,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(s.attacker.actionLockUntil, s.attacker.slideJumpLandingTime);
  });

  it("no-slam flap-flight land skips the plant lock (continue-slide)", () => {
    const s = createSlideJumpScenario({
      name: "flap_whiff_ms",
      flapFlight: true,
      armFlap: true,
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      attackerY: GROUND_LEVEL + 10,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(s.attacker.actionLockUntil, s.attacker.slideJumpLandingTime);
  });

  it("buffered slap still blocked while slide-jumping", () => {
    const s = createSlideJumpScenario({
      name: "buffer_still_blocked",
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    s.attacker.inputBuffer = { type: "slap", timestamp: s.room.simTime };
    assert.equal(executeInputBuffer(s.attacker, [s.room]), false);
    assert.ok(s.attacker.inputBuffer);
  });

  it("touchdown prevents flight integrator continuation", () => {
    const s = createSlideJumpScenario({
      name: "no_flight_after_land",
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      attackerY: GROUND_LEVEL + 8,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    const y = s.attacker.y;
    assert.equal(s.attacker.y, GROUND_LEVEL);
    stepSlideJumpTick(s);
    assert.equal(s.attacker.y, y);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });
});

describe("offensive aerial — helper unit contracts", () => {
  it("markLandingHandoff + finalize are idempotent", () => {
    const s = createSlideJumpScenario({
      name: "handoff_idempotent",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    markOffensiveAerialLandingHandoff(s.attacker, "test");
    markOffensiveAerialLandingHandoff(s.attacker, "test2");
    assert.equal(
      s.attacker.offensiveAerial.cleanupStage,
      OFFENSIVE_AERIAL_CLEANUP_STAGE.TOUCHDOWN_HANDOFF
    );
    finalizeOffensiveAerialActivation(s.attacker);
    finalizeOffensiveAerialActivation(s.attacker);
    assert.equal(s.attacker.offensiveAerial, null);
  });

  it("INTERRUPTED can be resolved explicitly before reset", () => {
    const s = createSlideJumpScenario({
      name: "explicit_interrupt",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    const r = resolveOffensiveAerialOutcome(
      s.attacker,
      OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED,
      { contactConsumed: true, resolvedTime: 1, debugReason: "unit" }
    );
    assert.equal(r.ok, true);
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED
    );
    assert.equal(s.attacker.offensiveAerial.contactConsumed, true);
  });
});

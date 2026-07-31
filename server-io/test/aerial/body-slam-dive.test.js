"use strict";

/**
 * Characterization: S-key aerial body slam (dive commit) outcomes.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  FLAP_DIVE_MIN_DOWN_VELOCITY,
  BURST_STUN_MS,
} = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
  isSlideJumpFlightImmune,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../gameUtils");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
} = require("./helpers/slideJumpSim");
const { isBodySlamWindowOpen } = require("../../offensiveAerialTrace");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("offensive aerial — S-key body slam dive", () => {
  it("clean dive hit on grounded defender", () => {
    const s = createSlideJumpScenario({
      name: "dive_hit",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 50,
    });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    assert.equal(isBodySlamWindowOpen(s.attacker), true);
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.isHit, true);
    assert.equal(s.defender.lastHitType, "flap");
  });

  it("clean dive whiff when opponent far", () => {
    const s = createSlideJumpScenario({
      name: "dive_whiff",
      attackerX: 400,
      defenderX: 850,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
  });

  it("dive parry grounds and staggers attacker", () => {
    const s = createSlideJumpScenario({
      name: "dive_parry",
      attackerX: 520,
      defenderX: 520,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.isRecovering, true);
    assert.equal(s.defender.isHit, false);
  });

  it("dive pins X and kills horizontal velocity", () => {
    const s = createSlideJumpScenario({
      name: "dive_pin",
      attackerX: 500,
      defenderX: 700,
      velY: 6,
      hSpeed: 5,
      attackerY: GROUND_LEVEL + 80,
      attackerKeys: { s: true },
    });
    const lockX = s.attacker.x;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpDiveCommitted, true);
    assert.equal(s.attacker.slideJumpVelocityX, 0);
    assert.equal(s.attacker.x, lockX);
  });

  it("dive burns remaining flap charges", () => {
    const s = createSlideJumpScenario({
      name: "dive_burns_charges",
      armFlap: true,
      attackerY: GROUND_LEVEL + 80,
      velY: 4,
      hSpeed: 0,
      attackerKeys: { s: true },
    });
    assert.ok(s.attacker.flapCharges > 0);
    stepSlideJumpTick(s);
    assert.equal(s.attacker.flapCharges, 0);
  });

  it("edge dive hit near left boundary", () => {
    const s = createSlideJumpScenario({
      name: "dive_left_edge",
      attackerX: MAP_LEFT_BOUNDARY + 15,
      defenderX: MAP_LEFT_BOUNDARY + 25,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, {
      x: MAP_LEFT_BOUNDARY + 20,
      height: 40,
      dive: true,
    });
    assert.doesNotThrow(() => stepSlideJumpTick(s));
    assert.equal(s.attacker.slideJumpHitLanded, true);
  });

  it("edge dive hit near right boundary", () => {
    const s = createSlideJumpScenario({
      name: "dive_right_edge",
      attackerX: MAP_RIGHT_BOUNDARY - 25,
      defenderX: MAP_RIGHT_BOUNDARY - 15,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, {
      x: MAP_RIGHT_BOUNDARY - 20,
      height: 40,
      dive: true,
    });
    assert.doesNotThrow(() => stepSlideJumpTick(s));
    assert.equal(s.attacker.slideJumpHitLanded, true);
  });

  it("immediate touchdown after dive contact uses hit recover duration", () => {
    const s = createSlideJumpScenario({
      name: "dive_touchdown",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 10,
    });
    placeDescendingOverOpponent(s, {
      height: 10,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
    });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    if (s.attacker.slideJumpPhase !== "landing") {
      runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    }
    assert.equal(s.attacker.slideJumpPhase, "landing");
    assert.equal(
      s.attacker.actionLockUntil,
      s.attacker.slideJumpLandingTime + BURST_STUN_MS
    );
  });

  it("body overlap after active latch cannot re-hit", () => {
    const s = createSlideJumpScenario({
      name: "dive_no_rehit",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    s.defender.isAlreadyHit = false;
    s.defender.isHit = false;
    s.io.clear();
    stepSlideJumpTick(s);
    assert.equal(s.io.find("player_hit").length, 0);
  });

  it("hit airborne defender (non-immune) begins air-hit fall", () => {
    const s = createSlideJumpScenario({
      name: "dive_vs_air",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    // Defender airborne but not slide-jump flight immune (e.g. hit-falling / stranded).
    s.defender.y = GROUND_LEVEL + 30;
    s.defender.isSlideJumping = false;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.isHit, true);
    assert.equal(s.defender.isHitFalling, true);
  });
});

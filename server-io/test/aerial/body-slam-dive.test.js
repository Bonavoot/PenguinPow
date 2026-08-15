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
  SLIDE_JUMP_DIVE_MIN_HEIGHT,
} = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
  isSlideJumpFlightImmune,
  isSlideJumpDiveEnabled,
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

describe("offensive aerial — S dive hop lock / buffer", () => {
  it("rejects instant hop-cancel dive from low launch", () => {
    const s = createSlideJumpScenario({
      name: "dive_lock_early",
      attackerY: GROUND_LEVEL + 20,
      velY: 13.2,
      hSpeed: 4,
      attackerKeys: { s: true },
    });
    assert.equal(isSlideJumpDiveEnabled(s.attacker, s.room.simTime), false);
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpDiveCommitted, false);
    assert.equal(s.attacker.slideJumpDiveBuffered, true);
  });

  it("early S tap buffers and commits on first enabled tick", () => {
    const s = createSlideJumpScenario({
      name: "dive_buffer",
      attackerY: GROUND_LEVEL + 20,
      velY: 13.2,
      hSpeed: 0,
    });
    s.attacker.keys.s = true;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpDiveBuffered, true);
    assert.equal(s.attacker.slideJumpDiveCommitted, false);
    // Release S — buffer must still fire when enable clears.
    s.attacker.keys.s = false;
    const snap = runUntil(s, () => s.attacker.slideJumpDiveCommitted, 40);
    assert.ok(snap);
    assert.equal(s.attacker.slideJumpDiveCommitted, true);
    assert.equal(s.attacker.keys.s, false);
  });

  it("S after enable commits immediately", () => {
    const s = createSlideJumpScenario({
      name: "dive_late",
      attackerY: GROUND_LEVEL + SLIDE_JUMP_DIVE_MIN_HEIGHT + 10,
      velY: 4,
      hSpeed: 0,
    });
    assert.equal(isSlideJumpDiveEnabled(s.attacker, s.room.simTime), true);
    s.attacker.keys.s = true;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpDiveCommitted, true);
  });
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
    // Dive is past peak — receive-immune; slam offense window is still open.
    assert.equal(isSlideJumpFlightImmune(s.attacker), true);
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
      attackerY: GROUND_LEVEL + SLIDE_JUMP_DIVE_MIN_HEIGHT + 10,
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
      attackerY: GROUND_LEVEL + SLIDE_JUMP_DIVE_MIN_HEIGHT + 10,
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

  it("does not body-slam an airborne defender (grounded contact only)", () => {
    const s = createSlideJumpScenario({
      name: "dive_vs_air",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    // Stranded / hit-falling above the floor — slam must wait for ground.
    s.defender.y = GROUND_LEVEL + 30;
    s.defender.isSlideJumping = false;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
    assert.equal(s.defender.isHitFalling, false);
  });

  it("contested dual dive on floor: lower flyer connects, higher receives", () => {
    const s = createSlideJumpScenario({
      name: "dual_dive_height",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL,
    });
    placeDescendingOverOpponent(s, { height: 0, dive: true });
    // Equal Y → id tie-break; attacker id < defender id ⇒ attacker may connect.
    s.attacker.id = "a";
    s.defender.id = "b";
    s.attacker.y = GROUND_LEVEL;
    s.defender.isSlideJumping = true;
    s.defender.slideJumpPhase = "flight";
    s.defender.slideJumpDiveCommitted = true;
    s.defender.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
    s.defender.slideJumpHitLanded = false;
    s.defender.y = GROUND_LEVEL;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.isHit, true);

    // Reverse ids: attacker loses the equal-Y tie and cannot latch.
    const s2 = createSlideJumpScenario({
      name: "dual_dive_height_lose",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL,
    });
    placeDescendingOverOpponent(s2, { height: 0, dive: true });
    s2.attacker.id = "b";
    s2.defender.id = "a";
    s2.attacker.y = GROUND_LEVEL;
    s2.defender.isSlideJumping = true;
    s2.defender.slideJumpPhase = "flight";
    s2.defender.slideJumpDiveCommitted = true;
    s2.defender.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
    s2.defender.slideJumpHitLanded = false;
    s2.defender.y = GROUND_LEVEL;
    stepSlideJumpTick(s2);
    assert.equal(s2.attacker.slideJumpHitLanded, false);
    assert.equal(s2.defender.isHit, false);
  });

  it("contested dual dive mid-air: neither connects (grounded gate)", () => {
    const s = createSlideJumpScenario({
      name: "dual_dive_air",
      attackerX: 500,
      defenderX: 500,
      dive: true,
      velY: -FLAP_DIVE_MIN_DOWN_VELOCITY,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    s.defender.isSlideJumping = true;
    s.defender.slideJumpPhase = "flight";
    s.defender.slideJumpDiveCommitted = true;
    s.defender.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
    s.defender.y = GROUND_LEVEL + 50; // higher
    s.attacker.y = GROUND_LEVEL + 40;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
  });
});

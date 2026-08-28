"use strict";

/**
 * Characterization: plain slide-jump (no FLAP charges) lifecycle + contact.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  SLIDE_JUMP_LIFTOFF_IMPULSE,
  BURST_STUN_MS,
  HIT_FALL_GRAVITY,
  speedFactor,
} = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
  isSlideJumpFlightImmune,
  isSlideJumpPastPeak,
  clearAllActionStates,
  captureAirVerticalVelocity,
  captureAirHorizontalVelocity,
  beginAirHitFall,
} = require("../../gameUtils");
const {
  resolveOffensiveAerialPresentation,
  OFFENSIVE_AERIAL_PRESENTATION,
} = require("../../offensiveAerialPresentation");
const {
  createSlideJumpScenario,
  beginSlideJumpFlight,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
  runTicks,
  armDefenderParry,
} = require("./helpers/slideJumpSim");
const { arePlayersColliding } = require("../../gameFunctions");
const { isBodySlamWindowOpen } = require("../../offensiveAerialTrace");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("offensive aerial — slide-jump lifecycle", () => {
  it("takeoff fields: flight phase, liftoff impulse, no flap flight", () => {
    const s = createSlideJumpScenario({
      name: "takeoff",
      startGrounded: true,
    });
    beginSlideJumpFlight(s.attacker, {
      now: s.room.simTime,
      dir: 1,
      armFlap: false,
    });
    assert.equal(s.attacker.isSlideJumping, true);
    assert.equal(s.attacker.slideJumpPhase, "flight");
    assert.equal(s.attacker.slideJumpVelocityY, SLIDE_JUMP_LIFTOFF_IMPULSE);
    assert.equal(s.attacker.slideJumpFlapFlightActive, false);
    assert.equal(s.attacker.slideJumpHasFlap, false);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
  });

  it("flight disables grounded pushbox collision", () => {
    const s = createSlideJumpScenario({
      name: "pushbox_off",
      attackerX: 500,
      defenderX: 505,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
      hSpeed: 0,
    });
    assert.equal(arePlayersColliding(s.attacker, s.defender), false);
  });

  it("landing phase is not flight-exempt from pushbox collision", () => {
    const s = createSlideJumpScenario({
      name: "pushbox_on_land",
      attackerX: 500,
      defenderX: 850,
      velY: -12,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 10,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 30);
    assert.equal(s.attacker.slideJumpPhase, "landing");
    // Flight exemption is phase==="flight" only. Landing may already be
    // separated by the touchdown-tick pushbox; place overlap to prove the gate.
    s.defender.x = s.attacker.x + 5;
    assert.equal(arePlayersColliding(s.attacker, s.defender), true);
  });

  it("jump without offensive contact: ascent then whiff land", () => {
    const s = createSlideJumpScenario({
      name: "no_contact_arc",
      attackerX: 400,
      defenderX: 850,
      velY: SLIDE_JUMP_LIFTOFF_IMPULSE,
      hSpeed: 4,
      attackerY: GROUND_LEVEL + 1,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 120);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
    // No-slam land skips the plant — jump H becomes a slide, no 90ms lock.
    assert.equal(s.attacker.actionLockUntil, s.attacker.slideJumpLandingTime);
    assert.ok(s.attacker.movementVelocity > 0);
  });

  it("no S: descent overlap does not slam — jump can clear a statue", () => {
    const s = createSlideJumpScenario({
      name: "plain_descent_pass",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
      armFlap: false,
      flapFlight: false,
    });
    placeDescendingOverOpponent(s, { height: 40, dive: false });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
  });

  it("S dive during descent slams (plain slide-jump, no FLAP)", () => {
    const s = createSlideJumpScenario({
      name: "plain_descent_hit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
      armFlap: false,
      flapFlight: false,
      dive: true,
    });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.lastHitType, "flap"); // attackType label is "flap"
  });

  it("offensive contact during ascent is impossible without dive", () => {
    const s = createSlideJumpScenario({
      name: "ascent_no_contact",
      attackerX: 500,
      defenderX: 500,
      velY: 10,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("S dive during ascent commits a Honda pop, not an instant slam window", () => {
    const s = createSlideJumpScenario({
      name: "dive_opens",
      attackerX: 500,
      defenderX: 500,
      velY: 10,
      hSpeed: 3,
      attackerY: GROUND_LEVEL + 40,
      attackerKeys: { s: true },
    });
    // Before tick: ascent, no dive yet.
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
    stepSlideJumpTick(s);
    // Early S buffers — may not commit on the first tick from low height.
    if (!s.attacker.slideJumpDiveCommitted) {
      assert.equal(s.attacker.slideJumpDiveBuffered, true);
      runUntil(s, () => s.attacker.slideJumpDiveCommitted, 40);
    }
    assert.equal(s.attacker.slideJumpDiveCommitted, true);
    assert.equal(s.attacker.slideJumpDivePhase, "pop");
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
    assert.ok(s.attacker.slideJumpVelocityY > 0);
  });

  it("parry of plain slide-jump body contact grounds attacker", () => {
    const s = createSlideJumpScenario({
      name: "plain_parry",
      attackerX: 520,
      defenderX: 520,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.isRawParryStun, true);
  });

  it("side crossing without hit: attacker can pass through during flight", () => {
    const s = createSlideJumpScenario({
      name: "pass_through",
      attackerX: 450,
      defenderX: 560,
      jumpDir: 1,
      hSpeed: 8,
      velY: 8,
      attackerY: GROUND_LEVEL + 120,
    });
    const startSide = s.attacker.x < s.defender.x ? -1 : 1;
    runTicks(s, 25);
    const endSide = s.attacker.x < s.defender.x ? -1 : 1;
    // High arc with H speed should cross before descending into contact height.
    assert.ok(
      endSide !== startSide || s.attacker.x > s.defender.x - 5,
      "expected pass-through progress across opponent"
    );
  });

  it("state cleanup on landing recovery completion", () => {
    const s = createSlideJumpScenario({
      name: "cleanup",
      attackerX: 400,
      defenderX: 850,
      velY: -10,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 15,
    });
    runUntil(s, () => !s.attacker.isSlideJumping, 80);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.slideJumpPhase, null);
    assert.equal(s.attacker.slideJumpDiveCommitted, false);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.attacker.slideJumpFlapFlightActive, false);
    assert.equal(s.attacker.flapCharges, 0);
    assert.equal(s.attacker.currentAction, null);
  });

  it("buffered follow-up is blocked while isSlideJumping (executeInputBuffer gate)", () => {
    const { executeInputBuffer } = require("../../gameFunctions");
    const s = createSlideJumpScenario({
      name: "buffer_blocked",
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    s.attacker.inputBuffer = {
      type: "slap",
      timestamp: s.room.simTime,
    };
    const before = s.attacker.isAttacking;
    const ran = executeInputBuffer(s.attacker, [s.room]);
    assert.equal(ran, false);
    assert.equal(s.attacker.isAttacking, before);
    // Buffer should remain unconsumed while airborne slide-jumping.
    assert.ok(s.attacker.inputBuffer);
  });
});

describe("offensive aerial — FLAP charge arming", () => {
  it("armFlap takeoff grants charges and sets slideJumpHasFlap", () => {
    const s = createSlideJumpScenario({
      name: "arm_flap",
      startGrounded: true,
    });
    beginSlideJumpFlight(s.attacker, {
      now: s.room.simTime,
      armFlap: true,
    });
    assert.equal(s.attacker.slideJumpHasFlap, true);
    assert.ok(s.attacker.flapCharges > 0);
  });

  it("W air flap spend switches into flap flight physics", () => {
    const s = createSlideJumpScenario({
      name: "air_flap_spend",
      armFlap: true,
      attackerY: GROUND_LEVEL + 80,
      velY: 2,
      hSpeed: 4,
    });
    assert.equal(s.attacker.slideJumpFlapFlightActive, false);
    s.attacker.wJustPressed = true;
    const chargesBefore = s.attacker.flapCharges;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpFlapFlightActive, true);
    assert.equal(s.attacker.flapCharges, chargesBefore - 1);
    assert.equal(s.attacker.slideJumpVelocityX, 0); // carry dropped on first spend
  });
});

describe("slide-jump air-hit arc", () => {
  it("ascent is hittable; after peak is immune", () => {
    const s = createSlideJumpScenario({
      name: "peak_gate",
      startGrounded: true,
    });
    beginSlideJumpFlight(s.attacker, {
      now: s.room.simTime,
      armFlap: false,
    });
    assert.equal(isSlideJumpPastPeak(s.attacker), false);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    runUntil(s, () => s.attacker.slideJumpVelocityY <= 0, 80);
    assert.equal(s.attacker.isSlideJumping, true);
    assert.equal(s.attacker.slideJumpPhase, "flight");
    assert.equal(isSlideJumpPastPeak(s.attacker), true);
    assert.equal(isSlideJumpFlightImmune(s.attacker), true);
  });

  it("launch connect kills rise — same H KB, gravity drops them", () => {
    const s = createSlideJumpScenario({
      name: "air_hit_arc",
      attackerX: 520,
      defenderX: 530,
      attackerY: GROUND_LEVEL + 50,
      velY: 8,
      hSpeed: 6,
    });
    const y0 = s.attacker.y;
    const carryY = captureAirVerticalVelocity(s.attacker);
    const carryX = captureAirHorizontalVelocity(s.attacker);
    assert.ok(carryY > 0);
    assert.ok(carryX > 0);
    clearAllActionStates(s.attacker);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.y, y0);
    s.attacker.knockbackVelocity = { x: 3, y: 0 };
    beginAirHitFall(s.attacker, {
      now: s.room.simTime,
      carryVelY: carryY,
    });
    assert.equal(s.attacker.isHitFalling, true);
    assert.equal(s.attacker.isRecovering, false);
    assert.equal(s.attacker.y, y0);
    assert.equal(
      s.attacker.hitFallVelocityY,
      0,
      "rise is killed; no upward pop"
    );
    assert.equal(
      resolveOffensiveAerialPresentation(s.attacker),
      OFFENSIVE_AERIAL_PRESENTATION.INTERRUPTED_AIRBORNE
    );
    s.attacker.isHit = true;
    assert.equal(arePlayersColliding(s.attacker, s.defender), false);
    const ax = s.attacker.x;
    const dx = s.defender.x;
    const { adjustPlayerPositions } = require("../../gameFunctions");
    adjustPlayerPositions(s.attacker, s.defender, 15.625);
    assert.equal(s.attacker.x, ax);
    assert.equal(s.defender.x, dx);

    const x0 = s.attacker.x;
    const kb = s.attacker.knockbackVelocity.x;
    const tickMs = 1000 / 64;
    for (let i = 0; i < 8; i++) {
      s.attacker.hitFallVelocityY -= HIT_FALL_GRAVITY;
      s.attacker.y += s.attacker.hitFallVelocityY;
      s.attacker.x += kb * tickMs * speedFactor;
    }
    assert.ok(s.attacker.y > GROUND_LEVEL, "still airborne after 8 ticks");
    assert.ok(s.attacker.y < y0, "gravity brings them down; they do not go up");
    assert.ok(s.attacker.x - x0 > 20, "full horizontal KB actually travels");
  });
});

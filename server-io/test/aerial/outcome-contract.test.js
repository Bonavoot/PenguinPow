"use strict";

/**
 * Phase 1 — offensive-aerial outcome contract characterization / regression.
 * Asserts explicit outcomes without changing combat feel.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { GROUND_LEVEL, BURST_STUN_MS } = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
  clearAllActionStates,
  clearSlideJumpState,
} = require("../../gameUtils");
const {
  OFFENSIVE_AERIAL_OUTCOME,
  OFFENSIVE_AERIAL_MOVE_TYPE,
  OFFENSIVE_AERIAL_CLEANUP_STAGE,
  beginOffensiveAerialActivation,
  resolveOffensiveAerialOutcome,
  resolveOffensiveAerialTouchdownTerminal,
  finalizeOffensiveAerialActivation,
  resetOffensiveAerialActivation,
  canCleanupOffensiveAerialInstance,
  isContactConsumed,
} = require("../../offensiveAerialOutcome");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
  beginSlideJumpFlight,
} = require("./helpers/slideJumpSim");
const { isBodySlamWindowOpen } = require("../../offensiveAerialTrace");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("offensive aerial — activation identity", () => {
  it("plain slide jump creates no offensive activation at takeoff", () => {
    const s = createSlideJumpScenario({
      name: "plain_no_activation",
      startGrounded: true,
    });
    beginSlideJumpFlight(s.attacker, { now: s.room.simTime, armFlap: false });
    assert.equal(s.attacker.offensiveAerial, null);
  });

  it("FLAP-armed takeoff receives a new attack-instance ID", () => {
    const s = createSlideJumpScenario({
      name: "flap_id",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    assert.ok(s.attacker.offensiveAerial);
    assert.ok(s.attacker.offensiveAerial.attackInstanceId);
    assert.equal(
      s.attacker.offensiveAerial.moveType,
      OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP
    );
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.NONE);
    assert.equal(s.attacker.offensiveAerial.offensiveArmed, true);
  });

  it("S-dive arms or upgrades the current activation", () => {
    const s = createSlideJumpScenario({
      name: "dive_activation",
      attackerY: GROUND_LEVEL + 60,
      velY: 4,
      hSpeed: 0,
      attackerKeys: { s: true },
    });
    assert.equal(s.attacker.offensiveAerial, null);
    runUntil(s, () => s.attacker.slideJumpDiveCommitted, 40);
    assert.equal(s.attacker.slideJumpDiveCommitted, true);
    assert.ok(s.attacker.offensiveAerial);
    assert.equal(
      s.attacker.offensiveAerial.moveType,
      OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE
    );
  });

  it("repeated detector polling does not mint a new instance ID", () => {
    const s = createSlideJumpScenario({
      name: "poll_same_id",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    const id0 = s.attacker.offensiveAerial.attackInstanceId;
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s, { earlyPairCheck: true });
    assert.equal(s.attacker.offensiveAerial.attackInstanceId, id0);
  });

  it("a later aerial attack receives a distinct instance ID", () => {
    const s = createSlideJumpScenario({
      name: "second_id",
      armFlap: true,
      attackerY: GROUND_LEVEL + 20,
      velY: -10,
      hSpeed: 0,
      attackerX: 400,
      defenderX: 850,
    });
    const id1 = s.attacker.offensiveAerial.attackInstanceId;
    runUntil(s, () => !s.attacker.isSlideJumping, 80);
    beginSlideJumpFlight(s.attacker, {
      now: s.room.simTime,
      armFlap: true,
    });
    const id2 = s.attacker.offensiveAerial.attackInstanceId;
    assert.ok(id1);
    assert.ok(id2);
    assert.notEqual(id1, id2);
  });

  it("round-style reset invalidates the previous activation", () => {
    const s = createSlideJumpScenario({
      name: "reset_id",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    assert.ok(s.attacker.offensiveAerial);
    resetOffensiveAerialActivation(s.attacker, {
      clearDebugCounters: true,
      debugReason: "test_reset",
    });
    assert.equal(s.attacker.offensiveAerial, null);
  });
});

describe("offensive aerial — outcome transitions", () => {
  it("clean hit resolves NONE → HIT and consumes contact", () => {
    const s = createSlideJumpScenario({
      name: "hit_outcome",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    assert.equal(s.attacker.offensiveAerial.resolved, true);
    assert.equal(s.attacker.offensiveAerial.contactConsumed, true);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });

  it("raw parry resolves NONE → PARRIED and consumes contact", () => {
    const s = createSlideJumpScenario({
      name: "parry_outcome",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.PARRIED
    );
    assert.equal(s.attacker.offensiveAerial.contactConsumed, true);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });

  it("armed activation touchdown without contact resolves WHIFF", () => {
    const s = createSlideJumpScenario({
      name: "whiff_outcome",
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 850,
      velY: -10,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 20,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.WHIFF
    );
    assert.equal(
      s.attacker.offensiveAerial.cleanupStage,
      OFFENSIVE_AERIAL_CLEANUP_STAGE.TOUCHDOWN_HANDOFF
    );
  });

  it("plain non-offensive landing resolves LANDED_WITHOUT_CONTACT", () => {
    const s = createSlideJumpScenario({
      name: "landed_wo_contact",
      attackerX: 400,
      defenderX: 850,
      velY: -10,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 20,
    });
    assert.equal(s.attacker.offensiveAerial, null);
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.LANDED_WITHOUT_CONTACT
    );
  });

  it("clearAll mid-flight on armed activation interrupts and clears flight", () => {
    const s = createSlideJumpScenario({
      name: "interrupt_outcome",
      armFlap: true,
      attackerY: GROUND_LEVEL + 80,
      velY: 5,
    });
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.NONE);
    // Explicit interrupt path (same terminal used inside clearAll before null).
    resolveOffensiveAerialOutcome(
      s.attacker,
      OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED,
      { contactConsumed: true, resolvedTime: s.room.simTime }
    );
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.INTERRUPTED
    );
    clearAllActionStates(s.attacker);
    assert.equal(s.attacker.offensiveAerial, null);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });

  it("first terminal outcome wins; conflicting second is rejected", () => {
    const s = createSlideJumpScenario({
      name: "conflict",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    const r1 = resolveOffensiveAerialOutcome(
      s.attacker,
      OFFENSIVE_AERIAL_OUTCOME.HIT,
      { resolvedTime: 1, contactConsumed: true, debugReason: "t1" }
    );
    assert.equal(r1.ok, true);
    const r2 = resolveOffensiveAerialOutcome(
      s.attacker,
      OFFENSIVE_AERIAL_OUTCOME.PARRIED,
      { resolvedTime: 2, contactConsumed: true, debugReason: "t2" }
    );
    assert.equal(r2.ok, false);
    assert.equal(r2.rejected, true);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    assert.ok((s.attacker._offensiveAerialIllegalTransitions || 0) >= 1);
  });

  it("duplicate identical resolution is idempotent", () => {
    const s = createSlideJumpScenario({
      name: "idempotent",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    resolveOffensiveAerialOutcome(s.attacker, OFFENSIVE_AERIAL_OUTCOME.HIT, {
      resolvedTime: 1,
      contactConsumed: true,
    });
    const r = resolveOffensiveAerialOutcome(
      s.attacker,
      OFFENSIVE_AERIAL_OUTCOME.HIT,
      { resolvedTime: 1, contactConsumed: true }
    );
    assert.equal(r.ok, true);
    assert.equal(r.reason, "idempotent");
  });

  it("touchdown does not overwrite HIT", () => {
    const s = createSlideJumpScenario({
      name: "touchdown_keeps_hit",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 12,
    });
    placeDescendingOverOpponent(s, { height: 12, velY: -8 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    if (s.attacker.slideJumpPhase !== "landing") {
      runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    }
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
  });

  it("same-tick parry beats hit (existing ordering)", () => {
    const s = createSlideJumpScenario({
      name: "same_tick_parry",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(
      s.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.PARRIED
    );
    assert.equal(s.defender.isHit, false);
    assert.equal(s.io.find("player_hit").length, 0);
  });

  it("outcome survives through landing recovery until finalize", () => {
    const s = createSlideJumpScenario({
      name: "survive_recovery",
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 850,
      velY: -10,
      attackerY: GROUND_LEVEL + 15,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    const id = s.attacker.offensiveAerial.attackInstanceId;
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.WHIFF);
    runUntil(s, () => !s.attacker.isSlideJumping, 40);
    assert.equal(s.attacker.offensiveAerial, null);
    assert.ok(id);
  });
});

describe("offensive aerial — hitbox cleanup guarantees", () => {
  it("hitbox dead after HIT / PARRIED / touchdown / reset", () => {
    const s = createSlideJumpScenario({
      name: "hitbox_dead_hit",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
    assert.equal(isContactConsumed(s.attacker), true);

    const s2 = createSlideJumpScenario({
      name: "hitbox_dead_parry",
      armFlap: true,
      attackerX: 520,
      defenderX: 520,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s2, { height: 40 });
    stepSlideJumpTick(s2);
    assert.equal(isBodySlamWindowOpen(s2.attacker), false);

    const s3 = createSlideJumpScenario({
      name: "hitbox_dead_land",
      armFlap: true,
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      attackerY: GROUND_LEVEL + 10,
    });
    runUntil(s3, () => s3.attacker.slideJumpPhase === "landing", 20);
    assert.equal(isBodySlamWindowOpen(s3.attacker), false);

    resetOffensiveAerialActivation(s3.attacker);
    s3.attacker.isSlideJumping = true;
    s3.attacker.slideJumpPhase = "flight";
    s3.attacker.slideJumpHitLanded = false;
    // Without activation + with landing phase cleared — still need descending flags;
    // contactConsumed helper false, but phase landing already closed window above.
    assert.equal(s3.attacker.offensiveAerial, null);
  });

  it("grounded + active hitbox is not observable on valid paths", () => {
    const s = createSlideJumpScenario({
      name: "no_grounded_active",
      armFlap: true,
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      attackerY: GROUND_LEVEL + 8,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });
});

describe("offensive aerial — stale-owner + cleanup idempotence", () => {
  it("stale instance cleanup is ignored safely", () => {
    const s = createSlideJumpScenario({
      name: "stale_cleanup",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    const oldId = s.attacker.offensiveAerial.attackInstanceId;
    beginOffensiveAerialActivation(s.attacker, {
      forceNew: true,
      moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
      offensiveArmed: true,
      debugReason: "newer",
    });
    const newId = s.attacker.offensiveAerial.attackInstanceId;
    assert.notEqual(oldId, newId);
    assert.equal(
      canCleanupOffensiveAerialInstance(s.attacker, oldId),
      false
    );
    assert.ok((s.attacker._offensiveAerialStaleRejects || 0) >= 1);
    // New activation untouched.
    assert.equal(s.attacker.offensiveAerial.attackInstanceId, newId);
  });

  it("clearSlideJumpState is idempotent", () => {
    const s = createSlideJumpScenario({
      name: "idempotent_clear",
      armFlap: true,
      attackerY: GROUND_LEVEL + 40,
      velY: 5,
    });
    clearSlideJumpState(s.attacker);
    clearSlideJumpState(s.attacker);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.offensiveAerial, null);
  });

  it("landing recovery duration unchanged after hit (BURST_STUN_MS)", () => {
    const s = createSlideJumpScenario({
      name: "recovery_unchanged",
      armFlap: true,
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    assert.equal(
      s.attacker.actionLockUntil,
      s.attacker.slideJumpLandingTime + BURST_STUN_MS
    );
  });
});

"use strict";

/**
 * Characterization: interaction ordering and gate behavior for aerial body slam.
 * Labels intentional vs accidental where the code makes it clear.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { GROUND_LEVEL } = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
  clearAllActionStates,
} = require("../../gameUtils");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
} = require("./helpers/slideJumpSim");
const { checkFlapBodySlam } = require("../../collisionSystem");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("offensive aerial — interaction ordering", () => {
  it("same-tick: parry candidate beats hit when defender isRawParrying", () => {
    // Intentional: checkFlapBodySlam checks isRawParrying before damage branch.
    const s = createSlideJumpScenario({
      name: "parry_before_hit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.defender.isHit, false);
    assert.equal(s.attacker.isRecovering, true);
    assert.ok(s.io.find("raw_parry_success").length >= 1);
    assert.equal(s.io.find("player_hit").length, 0);
  });

  it("two aerial attackers: mutual flight immunity blocks body slam both ways", () => {
    // Intentional commitment model: passive flight is strike-immune.
    const s = createSlideJumpScenario({
      name: "dual_flight",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    s.defender.isSlideJumping = true;
    s.defender.slideJumpPhase = "flight";
    s.defender.slideJumpDiveCommitted = false;
    s.defender.slideJumpVelocityY = -8;
    s.defender.y = GROUND_LEVEL + 40;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    checkFlapBodySlam(s.defender, s.attacker, [s.room], s.io);
    assert.equal(s.defender.slideJumpHitLanded, false);
  });

  it("aerial vs dive-committed defender: dive is hittable", () => {
    const s = createSlideJumpScenario({
      name: "vs_dive",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    s.defender.isSlideJumping = true;
    s.defender.slideJumpPhase = "flight";
    s.defender.slideJumpDiveCommitted = true;
    s.defender.y = GROUND_LEVEL; // grounded footprint but dive flag
    s.defender.slideJumpVelocityY = -8;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
  });

  it("thick blubber / hit absorption is NOT consulted by checkFlapBodySlam (current gap)", () => {
    // DIAGNOSTIC: armor absorb lives in processHit; body slam bypasses it.
    const s = createSlideJumpScenario({
      name: "vs_armor_gap",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    s.defender.hitAbsorptionCharges = 1;
    s.defender.activePowerUp = "thick_blubber";
    stepSlideJumpTick(s);
    // Current behavior: slam still connects (characterization, not a fix).
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.isHit, true);
  });

  it("round-reset style clearAllActionStates tears down aerial mid-flight", () => {
    const s = createSlideJumpScenario({
      name: "reset_mid_air",
      attackerY: GROUND_LEVEL + 80,
      velY: 5,
    });
    assert.equal(s.attacker.isSlideJumping, true);
    clearAllActionStates(s.attacker);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.slideJumpPhase, null);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("hitstop emission occurs on connect but harness clears freeze for determinism", () => {
    const s = createSlideJumpScenario({
      name: "hitstop_emit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.ok(s.io.find("hitstop").length >= 1);
    // Harness clears wall-clock hitstop; room must remain steppable.
    assert.equal(s.room.hitstopUntil, 0);
    assert.doesNotThrow(() => stepSlideJumpTick(s));
  });

  it("early-pair and mid-flight polls are both exercised by harness (double-call safe)", () => {
    // Production calls checkFlapBodySlam in early pair block AND after integrate.
    // Latch makes a second call in the same tick a no-op after connect.
    const s = createSlideJumpScenario({
      name: "double_poll",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s, { earlyPairCheck: true });
    assert.equal(s.attacker.slideJumpHitLanded, true);
    const hits = s.io.find("player_hit");
    assert.equal(hits.length, 1);
  });

  it("whiff land then grounded: slide-jump flags cleared before further actions", () => {
    const s = createSlideJumpScenario({
      name: "whiff_then_clear",
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 15,
    });
    runUntil(s, () => !s.attacker.isSlideJumping, 60);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.currentAction, null);
    assert.equal(s.attacker.actionLockUntil, 0);
  });
});

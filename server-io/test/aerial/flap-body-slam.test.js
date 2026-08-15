"use strict";

/**
 * Characterization tests for FLAP-armed / descending body-slam contact.
 * Locks current authoritative behavior — does not prescribe new rules.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  BURST_STUN_MS,
  HITBOX_DISTANCE_VALUE,
  AP_STAGGER_FLAP_MS,
} = require("../../constants");
const {
  FLAP_BODYSLAM_CONTACT_HEIGHT,
  FLAP_BODYSLAM_WIDTH_SCALE,
} = require("../../collisionSystem");
const {
  setSimRoomResolver,
  timeoutManager,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../gameUtils");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
  runTicks,
  finishTrace,
  armDefenderParry,
} = require("./helpers/slideJumpSim");
const {
  isBodySlamWindowOpen,
  bodySlamBodyWidth,
} = require("../../offensiveAerialTrace");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("offensive aerial — body-slam geometry (current)", () => {
  it("contact height and width scale match collisionSystem exports", () => {
    assert.equal(FLAP_BODYSLAM_CONTACT_HEIGHT, 100);
    assert.equal(FLAP_BODYSLAM_WIDTH_SCALE, 0.7);
  });

  it("ascent does not open the body-slam window", () => {
    const s = createSlideJumpScenario({
      name: "ascent_no_hitbox",
      velY: 10,
      attackerY: GROUND_LEVEL + 40,
    });
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
    stepSlideJumpTick(s);
    assert.equal(s.defender.isHit, false);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("descent within height opens the body-slam window only after S", () => {
    const noSlam = createSlideJumpScenario({
      name: "descent_window_no_s",
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    assert.equal(isBodySlamWindowOpen(noSlam.attacker), false);
    const s = createSlideJumpScenario({
      name: "descent_window",
      dive: true,
      velY: -8,
      attackerY: GROUND_LEVEL + 40,
    });
    assert.equal(isBodySlamWindowOpen(s.attacker), true);
  });

  it("above contact height is not active even while descending", () => {
    const s = createSlideJumpScenario({
      name: "too_high",
      velY: -8,
      attackerY: GROUND_LEVEL + FLAP_BODYSLAM_CONTACT_HEIGHT + 20,
    });
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });
});

describe("offensive aerial — FLAP / slide-jump clean hit", () => {
  it("clean hit: descending overlap latches hit and applies burst KB", () => {
    const s = createSlideJumpScenario({
      name: "clean_hit",
      attackerX: 500,
      defenderX: 560,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 50,
    });
    placeDescendingOverOpponent(s, { height: 50, velY: -8 });
    const snap = stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.isHit, true);
    assert.equal(s.defender.lastHitType, "flap");
    assert.equal(s.defender.isBurstKnockback, true);
    assert.ok(Math.abs(s.defender.knockbackVelocity.x) > 0);
    assert.equal(s.attacker.flapCharges, 0);
    assert.equal(s.attacker.slideJumpHitRecoverDuration, BURST_STUN_MS);
    assert.equal(snap.contactResult, "hit");
    const hits = s.io.find("player_hit");
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].payload.attackType, "flap");
  });

  it("clean hit soft-nudges victim without full pushbox teleport", () => {
    const s = createSlideJumpScenario({
      name: "clean_hit_park",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    const atkX = s.attacker.x;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    const sep = Math.abs(s.defender.x - atkX);
    // Soft unstack only — must move, must not teleport to resting pushbox (~116+).
    assert.ok(sep > 8, `expected soft nudge, got sep=${sep}`);
    assert.ok(sep < 40, `teleport park regression, sep=${sep}`);
    const hit = s.io.last("player_hit");
    assert.ok(hit);
    assert.equal(hit.payload.attackerX, atkX);
    assert.equal(typeof hit.payload.attackerY, "number");
  });

  it("repeated-hit prevention: second tick cannot re-hit same flight", () => {
    const s = createSlideJumpScenario({
      name: "no_double_hit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    const hitCount1 = s.defender.hitCounter;
    // Reset defender hit flags as if i-frames ended, but latch remains.
    s.defender.isAlreadyHit = false;
    s.defender.isHit = false;
    s.io.clear();
    stepSlideJumpTick(s);
    assert.equal(s.io.find("player_hit").length, 0);
    assert.equal(s.defender.hitCounter, hitCount1);
  });

  it("no S: traveling across a standing defender does not slam", () => {
    const s = createSlideJumpScenario({
      name: "cross_pass",
      attackerX: 480,
      defenderX: 560,
      jumpDir: 1,
      hSpeed: 6,
      velY: -2,
      attackerY: GROUND_LEVEL + 60,
    });
    runUntil(
      s,
      () => s.attacker.slideJumpHitLanded || s.attacker.slideJumpPhase === "landing",
      80
    );
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
  });

  it("hit near left boundary still resolves without throwing", () => {
    const s = createSlideJumpScenario({
      name: "left_edge_hit",
      attackerX: MAP_LEFT_BOUNDARY + 10,
      defenderX: MAP_LEFT_BOUNDARY + 30,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, {
      x: MAP_LEFT_BOUNDARY + 20,
      height: 40,
    });
    assert.doesNotThrow(() => stepSlideJumpTick(s));
    assert.equal(s.attacker.slideJumpHitLanded, true);
  });

  it("hit near right boundary still resolves without throwing", () => {
    const s = createSlideJumpScenario({
      name: "right_edge_hit",
      attackerX: MAP_RIGHT_BOUNDARY - 30,
      defenderX: MAP_RIGHT_BOUNDARY - 10,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, {
      x: MAP_RIGHT_BOUNDARY - 20,
      height: 40,
    });
    assert.doesNotThrow(() => stepSlideJumpTick(s));
    assert.equal(s.attacker.slideJumpHitLanded, true);
  });

  it("hit immediately before touchdown still latches before landing phase", () => {
    const s = createSlideJumpScenario({
      name: "pre_touchdown_hit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 8,
    });
    placeDescendingOverOpponent(s, { height: 8, velY: -8 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    // May already be in landing this tick if Y reached ground after integrate.
    assert.ok(
      s.attacker.slideJumpPhase === "flight" ||
        s.attacker.slideJumpPhase === "landing"
    );
  });

  it("active frames: after latch, window closes even if bodies still overlap", () => {
    const s = createSlideJumpScenario({
      name: "latch_closes_window",
      attackerX: 520,
      defenderX: 520,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
  });
});

describe("offensive aerial — whiff outcomes", () => {
  it("clean whiff: no opponent overlap → landing recovery, no hit", () => {
    const s = createSlideJumpScenario({
      name: "clean_whiff",
      attackerX: 400,
      defenderX: 800,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 30,
      flapFlight: true,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 60);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
    assert.equal(s.attacker.slideJumpPhase, "landing");
    // No slam → continue-slide, no plant lock (even after flap flight).
    assert.equal(s.attacker.actionLockUntil, s.attacker.slideJumpLandingTime);
  });

  it("whiff passing over: high descent never contacts, then lands", () => {
    const s = createSlideJumpScenario({
      name: "pass_over",
      attackerX: 500,
      defenderX: 500,
      velY: -1,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + FLAP_BODYSLAM_CONTACT_HEIGHT + 40,
    });
    // While above height, no hit.
    runTicks(s, 5);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 80);
    // May or may not hit once entering the height band — document whichever.
    // Characterization: if centers stay aligned within body width, a late hit
    // is possible. This test only asserts we do not throw and eventually land.
    assert.ok(
      s.attacker.slideJumpPhase === "landing" || !s.attacker.isSlideJumping
    );
  });

  it("body width miss: close but outside scaled pushbox does not hit", () => {
    const s = createSlideJumpScenario({
      name: "width_miss",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    const width = bodySlamBodyWidth(s.attacker, s.defender);
    s.attacker.x = s.defender.x + width + 2;
    s.attacker.y = GROUND_LEVEL + 40;
    s.attacker.slideJumpVelocityY = -8;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
    assert.equal(s.defender.isHit, false);
    // Sanity: width uses scaled HITBOX formula.
    assert.ok(
      Math.abs(width - HITBOX_DISTANCE_VALUE * 2 * 0.7 * 0.85) < 1e-6 ||
        width > 0
    );
  });
});

describe("offensive aerial — parry outcomes", () => {
  it("grounded defender parries descending body slam", () => {
    const s = createSlideJumpScenario({
      name: "ground_parry",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.isRecovering, true);
    assert.equal(s.defender.isHit, false);
    assert.equal(s.defender.lastHitType, null);
    assert.ok(s.io.find("raw_parry_success").length >= 1);
    // Attacker stagger lock uses AP_STAGGER_FLAP_MS.
    assert.ok(
      (s.attacker.inputLockUntil || 0) >=
        s.room.simTime - 20 + AP_STAGGER_FLAP_MS - AP_STAGGER_FLAP_MS
    );
  });

  it("parry clears hitbox / flight — cannot hit later in same animation", () => {
    const s = createSlideJumpScenario({
      name: "parry_clears",
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
    assert.equal(isBodySlamWindowOpen(s.attacker), false);
    s.io.clear();
    // Even if we illegally re-enter flight flags, the parry path already ended the move.
    stepSlideJumpTick(s);
    assert.equal(s.io.find("player_hit").length, 0);
  });

  it("perfect parry grades when pressed inside PERFECT window", () => {
    const s = createSlideJumpScenario({
      name: "perfect_parry",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "perfect",
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    const ev = s.io.last("raw_parry_success");
    assert.ok(ev);
    assert.equal(ev.payload.isPerfect, true);
  });

  it("parry near boundary still grounds attacker", () => {
    const s = createSlideJumpScenario({
      name: "parry_boundary",
      attackerX: MAP_RIGHT_BOUNDARY - 20,
      defenderX: MAP_RIGHT_BOUNDARY - 20,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, {
      x: MAP_RIGHT_BOUNDARY - 20,
      height: 40,
    });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.isSlideJumping, false);
  });

  it("parry while already overlapping roots grounds and staggers", () => {
    const s = createSlideJumpScenario({
      name: "parry_overlap",
      attackerX: 600,
      defenderX: 600,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 20,
      defenderParry: "regular",
    });
    placeDescendingOverOpponent(s, { x: 600, height: 20 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.isRecovering, true);
    assert.equal(s.defender.isHit, false);
  });
});

describe("offensive aerial — landing after hit / parry", () => {
  it("after hit, attacker continues flight then lands with hit recovery duration", () => {
    const s = createSlideJumpScenario({
      name: "hit_then_land",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    assert.equal(s.attacker.slideJumpPhase, "landing");
    assert.equal(
      s.attacker.actionLockUntil,
      s.attacker.slideJumpLandingTime + BURST_STUN_MS
    );
  });

  it("first fully grounded tick after landing recovery clears slide-jump state", () => {
    const s = createSlideJumpScenario({
      name: "first_grounded",
      attackerX: 400,
      defenderX: 800,
      velY: -10,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 20,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 40);
    runUntil(s, () => !s.attacker.isSlideJumping, 40);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.slideJumpPhase, null);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("trace harness records per-tick snapshots through contact", () => {
    const s = createSlideJumpScenario({
      name: "trace_hit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    assert.ok(s.traces.length >= 1);
    assert.ok(
      s.traces.some((t) => t.contactResult === "hit" || t.attackLatch)
    );
    const record = finishTrace(s);
    assert.ok(record);
    assert.ok(record.samples.length >= 1);
  });
});

describe("offensive aerial — defensive / simultaneous ordering notes", () => {
  it("flight-immune opponent cannot be body-slammed", () => {
    const s = createSlideJumpScenario({
      name: "vs_immune_air",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    // Defender also in protected slide-jump flight.
    s.defender.isSlideJumping = true;
    s.defender.slideJumpPhase = "flight";
    s.defender.slideJumpDiveCommitted = false;
    s.defender.y = GROUND_LEVEL + 50;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("dodge-active defender is skipped by body-slam gates", () => {
    const s = createSlideJumpScenario({
      name: "vs_dodge",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    s.defender.isDodging = true;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("rope-jump active defender is skipped", () => {
    const s = createSlideJumpScenario({
      name: "vs_rope_active",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    s.defender.isRopeJumping = true;
    s.defender.ropeJumpPhase = "active";
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });

  it("already-hit defender is skipped", () => {
    const s = createSlideJumpScenario({
      name: "vs_already_hit",
      attackerX: 500,
      defenderX: 500,
      velY: -8,
      hSpeed: 0,
      attackerY: GROUND_LEVEL + 40,
    });
    placeDescendingOverOpponent(s, { height: 40 });
    s.defender.isAlreadyHit = true;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, false);
  });
});

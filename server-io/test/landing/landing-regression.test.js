"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  HITBOX_DISTANCE_VALUE,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_STAMINA_COST,
  ROPE_JUMP_ARC_HEIGHT,
  ROPE_JUMP_BOUNDARY_ZONE,
  ROPE_JUMP_CENTER_FRACTION,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  CHARGED_STARTUP_MS,
  LOW_KICK_HITBOX_DISTANCE_VALUE,
  GROUND_LEVEL,
} = require("../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("../../gameUtils");
const {
  calculateEffectiveHitboxSize,
  adjustPlayerPositions,
  arePlayersColliding,
} = require("../../gameFunctions");
const {
  getPushboxHalfWidth,
  isRopeJumpLandingV2Enabled,
} = require("../../landingResolution");
const { ROPE_JUMP_LANDING_V2 } = require("../../landingFlags");
const { getConnectDistance } = require("../../strikeContact");
const { makeFighter } = require("./helpers/ropeJumpSim");

describe("landing Phase A — regression guards", () => {
  it("ROPE_JUMP_LANDING_V2 defaults off (release path unchanged)", () => {
    // Env override would flip this; CI/default must be false.
    if (process.env.ROPE_JUMP_LANDING_V2) {
      assert.equal(ROPE_JUMP_LANDING_V2, true);
      assert.equal(isRopeJumpLandingV2Enabled(), true);
    } else {
      assert.equal(ROPE_JUMP_LANDING_V2, false);
      assert.equal(isRopeJumpLandingV2Enabled(), false);
    }
  });

  it("rope jump timing / cost / arc / center fraction unchanged", () => {
    assert.equal(ROPE_JUMP_STARTUP_MS, 166);
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
    assert.equal(ROPE_JUMP_STAMINA_COST, 4);
    assert.equal(ROPE_JUMP_ARC_HEIGHT, 120);
    assert.equal(ROPE_JUMP_BOUNDARY_ZONE, 40);
    assert.equal(ROPE_JUMP_CENTER_FRACTION, 0.33);
  });

  it("ground pushbox spacing formula unchanged", () => {
    const p1 = makeFighter({
      id: "a",
      x: 500,
      sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    });
    const p2 = makeFighter({
      id: "b",
      x: 510,
      sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    });
    const h1 = calculateEffectiveHitboxSize(p1);
    const h2 = calculateEffectiveHitboxSize(p2);
    assert.equal(h1.left, getPushboxHalfWidth(DEFAULT_PLAYER_SIZE_MULTIPLIER));
    assert.equal(h1.right, h1.left);
    assert.equal(h2.left, HITBOX_DISTANCE_VALUE * DEFAULT_PLAYER_SIZE_MULTIPLIER);

    assert.equal(arePlayersColliding(p1, p2), true);
    adjustPlayerPositions(p1, p2, 15.625);
    const minDist = h1.left + h2.right;
    assert.ok(Math.abs(p1.x - p2.x) >= minDist - 1e-6);
  });

  it("rope-jump active still disables pushbox collision", () => {
    const p1 = makeFighter({
      id: "a",
      x: 500,
      isRopeJumping: true,
      ropeJumpPhase: "active",
    });
    const p2 = makeFighter({ id: "b", x: 505 });
    assert.equal(arePlayersColliding(p1, p2), false);
  });

  it("slap / charged timing constants untouched", () => {
    assert.equal(SLAP_STARTUP_MS, 55);
    assert.equal(SLAP_ACTIVE_MS, 130);
    assert.equal(CHARGED_STARTUP_MS, 150);
  });

  it("strike tip connect distance still defined for slap/charged/palm", () => {
    const attacker = {
      x: 500,
      facing: -1,
      sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
      isSlapAttack: true,
      slapAnimation: 1,
      isPalmThrust: false,
      attackType: "slap",
    };
    const victim = {
      x: 600,
      sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    };
    const dist = getConnectDistance("slap", attacker, victim);
    assert.ok(typeof dist === "number" && dist > 0);
  });

  it("low kick distance constant unchanged", () => {
    assert.equal(LOW_KICK_HITBOX_DISTANCE_VALUE, 142);
  });

  it("map boundaries / ground / default size unchanged", () => {
    assert.equal(MAP_LEFT_BOUNDARY, 340);
    assert.equal(MAP_RIGHT_BOUNDARY, 935);
    assert.equal(GROUND_LEVEL, 286);
    assert.equal(DEFAULT_PLAYER_SIZE_MULTIPLIER, 0.85);
  });

  it("slide-jump / flap phase fields are not owned by landing module", () => {
    // Phase A must not set slide/flap landing state.
    const {
      stepRopeJumpActive,
      clearRopeJumpLandingState,
    } = require("../../landingResolution");
    const p = makeFighter({
      id: "j",
      x: MAP_LEFT_BOUNDARY,
      isSlideJumping: true,
      slideJumpPhase: "flight",
      isFlapping: false,
      flapPhase: null,
    });
    p.isRopeJumping = true;
    p.ropeJumpPhase = "active";
    p.ropeJumpStartTime = 0;
    p.ropeJumpActiveStartTime = 0;
    p.ropeJumpStartX = MAP_LEFT_BOUNDARY;
    p.ropeJumpTargetX = 450;
    p.ropeJumpRawTargetX = 450;
    p.ropeJumpDirection = 1;
    stepRopeJumpActive(p, makeFighter({ id: "o", x: 800 }), 500, {
      useV2: true,
    });
    assert.equal(p.isSlideJumping, true);
    assert.equal(p.slideJumpPhase, "flight");
    clearRopeJumpLandingState(p);
    assert.equal(p.isSlideJumping, true);
    assert.equal(p.slideJumpPhase, "flight");
  });

  it("landing 18px cap still applies during rope-jump landing phase", () => {
    const jumper = makeFighter({
      id: "j",
      x: 500,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: 1,
    });
    const opponent = makeFighter({ id: "o", x: 500 });
    const before = jumper.x;
    adjustPlayerPositions(jumper, opponent, 15.625);
    const moved = Math.abs(jumper.x - before) + Math.abs(opponent.x - 500);
    // Deep overlap (~110px) must be capped at 18 this tick
    assert.ok(moved <= 18 + 1e-6);
    assert.ok(moved > 0);
  });
});

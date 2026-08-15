"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  DODGE_TRAVEL_DISTANCE,
  DOHYO_EDGE_PANIC_ZONE,
  ICE_SLIDE_MAX_SPEED,
  ICE_SLIDE_REVERSE_HOP_MS,
  ICE_SLIDE_REVERSE_HOP_HEIGHT,
  ICE_SLIDE_REVERSE_BURST,
  ROPE_KICKOFF_ZONE,
  SLIDE_JUMP_LANDING_RECOVERY_MS,
  GROUND_LEVEL,
  speedFactor,
} = require("../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  isInSlideRedirectIFrames,
  isRopeKickoffEligible,
  applyRopeKickoff,
  beginIceSlide,
  slideJumpHorizontalToMovementVelocity,
  isSlideJumpContinueSlideLand,
  applySlideJumpContinueOnLandDone,
  tryIceSlideReverse,
  slideJumpTakeoffHorizontalSpeed,
  slideJumpUnbuffedMaxTakeoffH,
  slideJumpTakeoffHCap,
} = require("../../gameUtils");
const {
  createSlideJumpScenario,
  runUntil,
  stepSlideJumpTick,
} = require("../aerial/helpers/slideJumpSim");

describe("kick-off dodge + ice slide", () => {
  it("dodge travel is a short kick-off, not a third of the ring", () => {
    assert.equal(
      DODGE_TRAVEL_DISTANCE,
      Math.round(ICE_SLIDE_REVERSE_HOP_MS * speedFactor * ICE_SLIDE_REVERSE_BURST)
    );
    assert.equal(ICE_SLIDE_REVERSE_HOP_HEIGHT, 16);
    assert.equal(ICE_SLIDE_REVERSE_HOP_MS, 85);
    assert.ok(DODGE_TRAVEL_DISTANCE < 50);
    assert.ok(DODGE_TRAVEL_DISTANCE < (MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY) / 8);
  });

  it("redirect hop is strike+grab invuln for the hop window only", () => {
    const now = 1000;
    const player = {
      isIceSlideReverseHopping: true,
      iceSlideReverseHopUntil: now + ICE_SLIDE_REVERSE_HOP_MS,
    };
    assert.equal(isInSlideRedirectIFrames(player, now), true);
    assert.equal(isInSlideRedirectIFrames(player, now + ICE_SLIDE_REVERSE_HOP_MS - 1), true);
    assert.equal(isInSlideRedirectIFrames(player, now + ICE_SLIDE_REVERSE_HOP_MS), false);
    assert.equal(isInSlideRedirectIFrames({ isIceSlideReverseHopping: false }, now), false);
  });

  it("rope kick-off is only toward center from the near rope", () => {
    assert.ok(ROPE_KICKOFF_ZONE < DOHYO_EDGE_PANIC_ZONE);
    assert.ok(ROPE_KICKOFF_ZONE < DODGE_TRAVEL_DISTANCE);
    assert.equal(isRopeKickoffEligible(MAP_LEFT_BOUNDARY + 10, 1), true);
    assert.equal(isRopeKickoffEligible(MAP_LEFT_BOUNDARY + 10, -1), false);
    assert.equal(isRopeKickoffEligible(MAP_RIGHT_BOUNDARY - 10, -1), true);
    assert.equal(isRopeKickoffEligible(MAP_RIGHT_BOUNDARY - 10, 1), false);
    assert.equal(isRopeKickoffEligible(MAP_LEFT_BOUNDARY + ROPE_KICKOFF_ZONE, 1), true);
    assert.equal(isRopeKickoffEligible(MAP_LEFT_BOUNDARY + ROPE_KICKOFF_ZONE + 1, 1), false);
    assert.equal(isRopeKickoffEligible(MAP_LEFT_BOUNDARY + DODGE_TRAVEL_DISTANCE, 1), false);
    assert.equal(isRopeKickoffEligible(MAP_LEFT_BOUNDARY + DOHYO_EDGE_PANIC_ZONE, 1), false);
    assert.equal(isRopeKickoffEligible(MAP_RIGHT_BOUNDARY - DOHYO_EDGE_PANIC_ZONE, -1), false);
    assert.equal(isRopeKickoffEligible(637, 1), false);
    assert.equal(isRopeKickoffEligible(637, -1), false);
  });

  it("rope kick-off snaps to full slide speed and stamps FX", () => {
    const player = {
      x: MAP_LEFT_BOUNDARY + 20,
      movementVelocity: 1.1,
      ropeKickoffFxId: 0,
    };
    assert.equal(applyRopeKickoff(player, 1, 500), true);
    assert.equal(player.movementVelocity, ICE_SLIDE_MAX_SPEED);
    assert.equal(player.ropeKickoffFxId, 1);
    assert.equal(applyRopeKickoff(player, -1, 500), false);
  });

  it("dodge hop off the rope still counts — origin is start X, not land X", () => {
    const player = {
      x: MAP_LEFT_BOUNDARY + DODGE_TRAVEL_DISTANCE,
      dodgeStartX: MAP_LEFT_BOUNDARY,
      movementVelocity: 0.8,
      ropeKickoffFxId: 0,
      keys: {},
    };
    assert.equal(isRopeKickoffEligible(player.x, 1), false);
    assert.equal(isRopeKickoffEligible(player.dodgeStartX, 1), true);
    const result = beginIceSlide(player, 1, 0.8, 900, {
      kickoffOriginX: player.dodgeStartX,
    });
    assert.equal(result.ropeKickoff, true);
    assert.equal(player.movementVelocity, ICE_SLIDE_MAX_SPEED);
  });

  it("beginIceSlide at the rope toward center is a kick-off", () => {
    const player = {
      x: MAP_RIGHT_BOUNDARY - 15,
      movementVelocity: 0,
      ropeKickoffFxId: 0,
      keys: {},
    };
    const result = beginIceSlide(player, -1, ICE_SLIDE_REVERSE_BURST, 800);
    assert.equal(result.ok, true);
    assert.equal(result.ropeKickoff, true);
    assert.equal(player.isIceSliding, true);
    assert.equal(player.iceSlideDir, -1);
    assert.equal(player.movementVelocity, -ICE_SLIDE_MAX_SPEED);
  });

  it("redirect at the rope toward center upgrades the burst", () => {
    const player = {
      x: MAP_LEFT_BOUNDARY + 12,
      isIceSliding: true,
      iceSlideDir: -1,
      movementVelocity: -1.2,
      keys: { a: false, d: true },
      iceSlideBrakeArmStart: 1,
      isSlideJumping: false,
      isDodging: false,
      isHit: false,
      isIceSlideReverseHopping: false,
      ropeKickoffFxId: 0,
    };
    const now = 2000;
    assert.equal(tryIceSlideReverse(player, now), true);
    assert.equal(player.iceSlideDir, 1);
    assert.equal(player.movementVelocity, ICE_SLIDE_MAX_SPEED);
    assert.equal(player.ropeKickoffFxId, 1);
    assert.equal(isInSlideRedirectIFrames(player, now), true);
  });
});

describe("slide-jump land → slide", () => {
  it("converts jump H into movementVelocity units", () => {
    const player = { slideJumpVelocityX: 4.4, slideJumpFlapFlightActive: false };
    const v = slideJumpHorizontalToMovementVelocity(player);
    assert.ok(v > 1.4 && v < 1.7, `expected ~1.52, got ${v}`);
  });

  it("pocket-zeroed vel still jumps from stamped slide carry", () => {
    const starved = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 0,
      isIceSliding: true,
      iceSlideCarrySpeed: 0,
    });
    const pocket = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 0,
      isIceSliding: true,
      iceSlideCarrySpeed: 2.4,
    });
    const live = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 2.4,
      isIceSliding: true,
      iceSlideCarrySpeed: 2.4,
    });
    assert.ok(pocket > starved * 2, `pocket ${pocket} should beat starved ${starved}`);
    assert.ok(Math.abs(pocket - live) < 0.01, `carry should match live, ${pocket} vs ${live}`);
  });

  it("live slide speed wins over a stale kick-off carry peak", () => {
    const coasting = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 1.0,
      isIceSliding: true,
      iceSlideCarrySpeed: 2.4,
    });
    const slow = slideJumpTakeoffHorizontalSpeed({ movementVelocity: 1.0 });
    const fast = slideJumpTakeoffHorizontalSpeed({ movementVelocity: 2.4 });
    assert.ok(
      Math.abs(coasting - slow) < 0.05,
      `coasting should match live 1.0, got ${coasting} vs ${slow}`
    );
    assert.ok(coasting < fast * 0.7, `stale peak must not win, ${coasting} vs ${fast}`);
  });

  it("first Happy Feet does not buy a longer jump than the unbuffed kick-off", () => {
    const unbuffed = slideJumpTakeoffHorizontalSpeed({ movementVelocity: 2.4 });
    const happy = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 2.4,
      activePowerUp: "speed",
      powerUpMultiplier: 1.4,
    });
    const base = slideJumpUnbuffedMaxTakeoffH();
    assert.ok(Math.abs(unbuffed - base) < 0.01, `unbuffed kick-off is the cap, ${unbuffed} vs ${base}`);
    assert.ok(
      Math.abs(happy - unbuffed) < 0.01,
      `first HF must match unbuffed jump, ${happy} vs ${unbuffed}`
    );
  });

  it("deep Happy Feet stacks buy a little leftover air, not a ring-cross", () => {
    const unbuffed = slideJumpTakeoffHorizontalSpeed({ movementVelocity: 2.4 });
    const two = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 2.4,
      bashoDraft: { speedMult: 1.693 },
    });
    const stacked = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 2.4,
      activePowerUp: "speed",
      powerUpMultiplier: 1.4,
      bashoDraft: { speedMult: 1.8 },
    });
    const fullCap = slideJumpTakeoffHCap({
      bashoDraft: { speedMult: 2.5 },
    });
    assert.ok(two > unbuffed, `second stack should add a little, ${two} vs ${unbuffed}`);
    assert.ok(two < unbuffed * 1.05, `second stack must stay small, ${two}`);
    assert.ok(stacked > two, `deeper stacks add more, ${stacked} vs ${two}`);
    assert.ok(stacked <= fullCap + 0.01, `stacked ${stacked} under full leftover ${fullCap}`);
    assert.ok(fullCap <= unbuffed * 1.10 + 0.01, `leftover cap is +10%, ${fullCap} vs ${unbuffed}`);
  });

  it("takeoff H still carries unbuffed ice speed — slower slide jumps shorter", () => {
    const slow = slideJumpTakeoffHorizontalSpeed({ movementVelocity: 1.0 });
    const fast = slideJumpTakeoffHorizontalSpeed({ movementVelocity: 2.4 });
    const speedStat = slideJumpTakeoffHorizontalSpeed({
      movementVelocity: 2.4,
      activePowerUp: "speed",
      powerUpMultiplier: 1.4,
    });
    assert.ok(fast > slow, `fast ${fast} should beat slow ${slow}`);
    assert.ok(
      Math.abs(speedStat - fast) < 0.01,
      `first HF at max slide matches unbuffed max, ${speedStat} vs ${fast}`
    );
  });

  it("continue-slide land is only for clean no-slam touchdowns", () => {
    assert.equal(isSlideJumpContinueSlideLand({}), true);
    assert.equal(isSlideJumpContinueSlideLand({ slideJumpDiveCommitted: true }), false);
    assert.equal(isSlideJumpContinueSlideLand({ slideJumpHitLanded: true }), false);
    assert.equal(
      isSlideJumpContinueSlideLand({
        offensiveAerial: { outcome: "PARRIED" },
      }),
      false
    );
  });

  it("SHIFT on landDone enters ice slide with carried speed", () => {
    const player = {
      movementVelocity: 1.6,
      slideJumpLandSlideQueued: true,
      keys: { shift: true },
      iceSlideDir: 0,
      x: 600,
      ropeKickoffFxId: 0,
    };
    const result = applySlideJumpContinueOnLandDone(player, 3000);
    assert.equal(result.ok, true);
    assert.equal(player.isIceSliding, true);
    assert.equal(player.iceSlideDir, 1);
    assert.equal(player.movementVelocity, 1.6);
    assert.equal(player.slideJumpLandSlideQueued, false);
  });

  it("no SHIFT on landDone keeps the coast and does not ice-slide", () => {
    const player = {
      movementVelocity: 1.4,
      slideJumpLandSlideQueued: false,
      keys: { shift: false },
      iceSlideDir: 0,
    };
    applySlideJumpContinueOnLandDone(player, 3000);
    assert.equal(!!player.isIceSliding, false);
    assert.equal(player.movementVelocity, 1.4);
  });

  it("no-slam land from the harness carries H and can ice-slide", () => {
    const s = createSlideJumpScenario({
      name: "land_continue",
      attackerX: 500,
      defenderX: 850,
      velY: -12,
      hSpeed: 5,
      attackerY: GROUND_LEVEL + 10,
      attackerKeys: { shift: true },
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(s.attacker.actionLockUntil, s.attacker.slideJumpLandingTime);
    assert.ok(s.attacker.movementVelocity > 0);
    assert.equal(s.attacker.slideJumpLandSlideQueued, true);
    stepSlideJumpTick(s);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.isIceSliding, true);
    assert.ok(s.attacker.movementVelocity > 0);
  });

  it("body slam land still plants with the old recovery", () => {
    const s = createSlideJumpScenario({
      name: "slam_plant",
      attackerX: 400,
      defenderX: 850,
      velY: -12,
      hSpeed: 4,
      attackerY: GROUND_LEVEL + 10,
      attackerKeys: { s: true, shift: true },
    });
    s.attacker.slideJumpDiveCommitted = true;
    s.attacker.slideJumpDiveLockX = s.attacker.x;
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(
      s.attacker.actionLockUntil,
      s.attacker.slideJumpLandingTime + SLIDE_JUMP_LANDING_RECOVERY_MS
    );
    assert.equal(s.attacker.slideJumpLandSlideQueued, false);
  });
});

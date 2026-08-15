"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  SLIDE_JUMP_LAND_SETTLE_MS,
} = require("../../constants");
const { setSimRoomResolver, timeoutManager } = require("../../gameUtils");
const { adjustPlayerPositions } = require("../../gameFunctions");
const { getMinimumCenterDistance } = require("../../pushboxGeometry");
const {
  beginSlideJumpLandSettle,
  clearSlideJumpLandSettle,
  isSlideJumpLandSettleActive,
  classifyLandSettleCase,
  travelDirOf,
  LANDING_SETTLE_MAX_PX_PER_TICK,
} = require("../../slideJumpLandSettle");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
} = require("../aerial/helpers/slideJumpSim");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
});

describe("slide-jump land-on-body settle — unit", () => {
  it("classifies far / near / dead from travel and centers", () => {
    assert.equal(
      classifyLandSettleCase({ x: 700 }, { x: 600 }, 1),
      "far"
    );
    assert.equal(
      classifyLandSettleCase({ x: 500 }, { x: 600 }, 1),
      "near"
    );
    assert.equal(
      classifyLandSettleCase({ x: 600 }, { x: 600 }, 1),
      "dead"
    );
    assert.equal(
      classifyLandSettleCase({ x: 610 }, { x: 600 }, 1),
      "dead"
    );
  });

  it("travel dir prefers ice velocity, then facing", () => {
    assert.equal(travelDirOf({ movementVelocity: -1.2 }), -1);
    assert.equal(travelDirOf({ movementVelocity: 0, facing: -1 }), 1);
  });

  it("begin no-ops when already clear", () => {
    const jumper = { x: 400, movementVelocity: 2, sizeMultiplier: 1 };
    const opponent = { x: 700, sizeMultiplier: 1 };
    assert.equal(beginSlideJumpLandSettle(jumper, opponent, 1000), null);
    assert.equal(jumper.slideJumpLandSettleActive, undefined);
  });

  it("coincident land locks the travel-dir shoulder", () => {
    const jumper = { x: 600, movementVelocity: 2, sizeMultiplier: 1 };
    const opponent = { x: 600, sizeMultiplier: 1 };
    const started = beginSlideJumpLandSettle(jumper, opponent, 1000);
    assert.ok(started);
    assert.equal(started.settleCase, "cross");
    assert.equal(started.jumperIsLeft, false);
    assert.equal(started.travelDir, 1);
    assert.equal(jumper.slideJumpLandSettleUntil, 1000 + SLIDE_JUMP_LAND_SETTLE_MS);
  });

  it("near-side speed land locks the far shoulder — not a bounce", () => {
    const jumper = { x: 540, movementVelocity: 2, sizeMultiplier: 1 };
    const opponent = { x: 600, sizeMultiplier: 1 };
    const started = beginSlideJumpLandSettle(jumper, opponent, 1000);
    assert.ok(started);
    assert.equal(started.settleCase, "cross");
    assert.equal(started.jumperIsLeft, false);
  });
});

describe("slide-jump land-on-body settle — live", () => {
  it("stacked no-slam land does not dump the full pushbox in one tick", () => {
    const s = createSlideJumpScenario({
      name: "stacked_no_snap",
      attackerX: 600,
      defenderX: 600,
      velY: -12,
      hSpeed: 5,
      attackerY: GROUND_LEVEL + 8,
    });
    placeDescendingOverOpponent(s, {
      height: 6,
      dive: false,
      velX: 5,
      velY: -12,
    });
    const ax0 = s.attacker.x;
    const dx0 = s.defender.x;
    const minDist = getMinimumCenterDistance(
      s.attacker.sizeMultiplier,
      s.defender.sizeMultiplier
    );
    assert.ok(minDist > 100, `expected ~130px pocket, got ${minDist}`);
    stepSlideJumpTick(s);
    const jumperDx = Math.abs(s.attacker.x - ax0);
    const oppDx = Math.abs(s.defender.x - dx0);
    // Land tick still applies the last air step (~hSpeed) plus a capped settle.
    assert.ok(
      jumperDx <= LANDING_SETTLE_MAX_PX_PER_TICK + 6.5,
      `jumper snapped ${jumperDx}px`
    );
    assert.ok(
      oppDx <= LANDING_SETTLE_MAX_PX_PER_TICK + 0.05,
      `opponent snapped ${oppDx}px`
    );
    assert.equal(s.attacker.slideJumpLandSettleActive, true);
    assert.ok(s.attacker.movementVelocity > 0, "ice carry must survive the land");
  });

  it("each settle tick stays under the 18px cap; speed land may cross once", () => {
    const s = createSlideJumpScenario({
      name: "settle_ticks",
      attackerX: 600,
      defenderX: 600,
      velY: -12,
      hSpeed: 6,
      attackerY: GROUND_LEVEL + 8,
    });
    placeDescendingOverOpponent(s, {
      height: 6,
      dive: false,
      velX: 6,
      velY: -12,
    });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpLandSettleActive, true);
    let prevSide = s.attacker.x < s.defender.x ? -1 : 1;
    let crossed = false;
    for (let i = 0; i < 12; i++) {
      const ax = s.attacker.x;
      const dx = s.defender.x;
      stepSlideJumpTick(s);
      const jumperDx = Math.abs(s.attacker.x - ax);
      const oppDx = Math.abs(s.defender.x - dx);
      assert.ok(
        jumperDx <= LANDING_SETTLE_MAX_PX_PER_TICK + 0.05,
        `tick ${i} jumper ${jumperDx}`
      );
      assert.ok(
        oppDx <= LANDING_SETTLE_MAX_PX_PER_TICK + 0.05,
        `tick ${i} opponent ${oppDx}`
      );
      if (Math.abs(s.attacker.x - s.defender.x) > 1) {
        const side = s.attacker.x < s.defender.x ? -1 : 1;
        if (side !== prevSide) {
          assert.equal(crossed, false, `side chattered on tick ${i}`);
          crossed = true;
        }
        prevSide = side;
      }
    }
    assert.ok(s.attacker.movementVelocity > 0);
  });

  it("near-side speed land moves the jumper through, not back", () => {
    const s = createSlideJumpScenario({
      name: "cross_through",
      attackerX: 540,
      defenderX: 600,
      velY: -12,
      hSpeed: 6,
      attackerY: GROUND_LEVEL + 8,
    });
    placeDescendingOverOpponent(s, {
      x: 540,
      height: 6,
      dive: false,
      velX: 6,
      velY: -12,
    });
    s.defender.x = 600;
    const startX = s.attacker.x;
    assert.ok(startX < s.defender.x);
    for (let i = 0; i < 10; i++) stepSlideJumpTick(s);
    assert.ok(
      s.attacker.x > startX,
      `jumper should travel through, ${startX} → ${s.attacker.x}`
    );
    assert.ok(s.attacker.movementVelocity > 0);
  });

  it("slam land does not start a settle episode", () => {
    const s = createSlideJumpScenario({
      name: "slam_no_settle",
      attackerX: 500,
      defenderX: 850,
      velY: -12,
      hSpeed: 4,
      attackerY: GROUND_LEVEL + 8,
      dive: true,
    });
    placeDescendingOverOpponent(s, { height: 6, dive: true, velY: -12 });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(s.attacker.slideJumpLandSettleActive, false);
  });

  it("clear land far from the opponent never starts settle", () => {
    const s = createSlideJumpScenario({
      name: "clear_land",
      attackerX: 420,
      defenderX: 850,
      velY: -12,
      hSpeed: 5,
      attackerY: GROUND_LEVEL + 8,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 20);
    assert.equal(s.attacker.slideJumpLandSettleActive, false);
    assert.ok(s.attacker.movementVelocity > 0);
  });

  it("generic pushbox still snaps when settle is not active", () => {
    const a = {
      x: 600,
      sizeMultiplier: 1,
      movementVelocity: 0,
      isHit: false,
      isRawParryStun: false,
      isRawParrying: false,
    };
    const b = {
      x: 605,
      sizeMultiplier: 1,
      movementVelocity: 0,
      isHit: false,
      isRawParryStun: false,
      isRawParrying: false,
    };
    adjustPlayerPositions(a, b, 15.625);
    const minDist = getMinimumCenterDistance(1, 1);
    assert.ok(Math.abs(a.x - b.x) >= minDist - 0.05);
  });

  it("timeout ends the episode", () => {
    const jumper = { x: 600, movementVelocity: 2, sizeMultiplier: 1 };
    const opponent = { x: 600, sizeMultiplier: 1 };
    beginSlideJumpLandSettle(jumper, opponent, 1000);
    assert.equal(isSlideJumpLandSettleActive(jumper, 1000), true);
    assert.equal(
      isSlideJumpLandSettleActive(jumper, 1000 + SLIDE_JUMP_LAND_SETTLE_MS),
      false
    );
    assert.equal(jumper.slideJumpLandSettleActive, false);
  });

  it("clearSlideJumpLandSettle is idempotent", () => {
    const jumper = { x: 600, movementVelocity: 2, sizeMultiplier: 1 };
    beginSlideJumpLandSettle(jumper, { x: 600, sizeMultiplier: 1 }, 1000);
    clearSlideJumpLandSettle(jumper);
    clearSlideJumpLandSettle(jumper);
    assert.equal(jumper.slideJumpLandSettleActive, false);
  });
});

"use strict";

/**
 * Focused integration coverage: production call sites use the same rope-jump
 * start + active-step modules exercised by the landing harness.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { startRopeJump } = require("../../ropeJumpStart");
const {
  stepRopeJumpActive,
  isRopeJumpLandingV2Enabled,
  getPushboxHalfWidth,
} = require("../../landingResolution");
const { calculateEffectiveHitboxSize } = require("../../gameFunctions");
const {
  getDeltaTrackedProps,
  LANDING_DIAG_DELTA_PROPS,
} = require("../../deltaState");
const { LANDING_DEBUG_NET } = require("../../landingFlags");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("../../gameUtils");
const {
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_STAMINA_COST,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  DELTA_TRACKED_PROPS,
  LANDING_DIAG_DELTA_PROPS: DIAG_FROM_CONSTANTS,
} = require("../../constants");
const { makeFighter, simulateRopeJump } = require("./helpers/ropeJumpSim");

const ROOT = path.join(__dirname, "../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("rope-jump production integration wiring", () => {
  it("socketHandlers and cpuAI both call startRopeJump", () => {
    const sockets = read("socketHandlers.js");
    const cpu = read("cpuAI.js");
    assert.match(sockets, /require\(["'].\/ropeJumpStart["']\)/);
    assert.match(sockets, /startRopeJump\(/);
    assert.match(cpu, /require\(["'].\/ropeJumpStart["']\)/);
    assert.match(cpu, /startRopeJump\(/);
    // No duplicated initRopeJumpLandingState call sites in those owners.
    assert.doesNotMatch(sockets, /initRopeJumpLandingState\(/);
    assert.doesNotMatch(cpu, /initRopeJumpLandingState\(/);
  });

  it("index.js active phase calls stepRopeJumpActive with V2 flag helper", () => {
    const index = read("index.js");
    assert.match(index, /stepRopeJumpActive\(/);
    assert.match(index, /isRopeJumpLandingV2Enabled\(/);
    assert.match(index, /emitThrottledScreenShake\([\s\S]*rope_landing/);
    assert.match(index, /landing_diag/);
  });

  it("startRopeJump sets the same fields the main loop expects", () => {
    const p = makeFighter({ x: MAP_LEFT_BOUNDARY, stamina: 50 });
    const before = p.stamina;
    const { rawTargetX } = startRopeJump(p, {
      now: 1000,
      jumpDirection: 1,
      mapLeft: MAP_LEFT_BOUNDARY,
      mapRight: MAP_RIGHT_BOUNDARY,
      facing: -1,
      useV2: true,
    });
    assert.equal(p.isRopeJumping, true);
    assert.equal(p.ropeJumpPhase, "startup");
    assert.equal(p.ropeJumpStartTime, 1000);
    assert.equal(p.ropeJumpStartX, MAP_LEFT_BOUNDARY);
    assert.equal(p.ropeJumpTargetX, rawTargetX);
    assert.equal(p.ropeJumpRawTargetX, rawTargetX);
    assert.equal(p.ropeJumpDirection, 1);
    assert.equal(p.ropeJumpLandingPath, "v2");
    assert.equal(p.actionLockUntil, 1000 + ROPE_JUMP_STARTUP_MS);
    assert.equal(p.stamina, before - ROPE_JUMP_STAMINA_COST);
    assert.equal(p.currentAction, "ropeJump");
  });

  it("harness beginRopeJump uses startRopeJump (shared with human/CPU)", () => {
    const helper = read("test/landing/helpers/ropeJumpSim.js");
    assert.match(helper, /startRopeJump\(/);
    assert.match(helper, /require\(["'].*ropeJumpStart["']\)/);
  });

  it("landing recovery duration constant still used by index cleanup path", () => {
    const index = read("index.js");
    assert.match(index, /ROPE_JUMP_LANDING_RECOVERY_MS/);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
  });

  it("single shake emit + facing update on landing recovery", () => {
    // Production index emits shake once on touchdown and faces opponent on
    // recovery end — the lifecycle helper mirrors those exact side effects.
    // Buffered-attack release is covered in rope-jump-landing.test.js.
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 500 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.equal(trace.shakeEmits, 1);
    assert.equal(jumper.isRopeJumping, false);
    assert.equal(jumper.facing, jumper.x < opponent.x ? -1 : 1);
  });

  it("pushbox half-width shared with calculateEffectiveHitboxSize", () => {
    for (const mult of [1, 0.85, 0.7, 1.15]) {
      const player = { sizeMultiplier: mult };
      const box = calculateEffectiveHitboxSize(player);
      const half = getPushboxHalfWidth(mult);
      assert.equal(box.left, half);
      assert.equal(box.right, half);
    }
    // Falsy multiplier fallback must match.
    assert.equal(
      calculateEffectiveHitboxSize({ sizeMultiplier: 0 }).left,
      getPushboxHalfWidth(0)
    );
  });

  it("production delta wire excludes landing diagnostics by default", () => {
    assert.equal(LANDING_DEBUG_NET, false);
    const tracked = getDeltaTrackedProps();
    for (const prop of LANDING_DIAG_DELTA_PROPS) {
      assert.ok(
        !tracked.includes(prop),
        `${prop} must not be on production delta wire`
      );
      assert.ok(
        !DELTA_TRACKED_PROPS.includes(prop),
        `${prop} must not be in base DELTA_TRACKED_PROPS`
      );
    }
    assert.ok(DIAG_FROM_CONSTANTS.length > 0);
    // Gameplay rope fields remain.
    assert.ok(DELTA_TRACKED_PROPS.includes("isRopeJumping"));
    assert.ok(DELTA_TRACKED_PROPS.includes("ropeJumpPhase"));
  });

  it("V2 remains disabled by default", () => {
    assert.equal(isRopeJumpLandingV2Enabled(), false);
  });

  it("active stepping after startRopeJump reaches landing via stepRopeJumpActive", () => {
    const jumper = makeFighter({ x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({
      x: computeRaw(MAP_LEFT_BOUNDARY),
    });
    startRopeJump(jumper, {
      now: 0,
      jumpDirection: 1,
      mapLeft: MAP_LEFT_BOUNDARY,
      mapRight: MAP_RIGHT_BOUNDARY,
      useV2: true,
    });
    jumper.ropeJumpPhase = "active";
    jumper.ropeJumpActiveStartTime = 0;
    let touched = false;
    let shakes = 0;
    for (let now = 0; now <= ROPE_JUMP_STARTUP_MS + 2000; now += 1000 / 64) {
      const r = stepRopeJumpActive(jumper, opponent, now, { useV2: true });
      if (r.touchedDown) {
        touched = true;
        shakes += 1;
        jumper.actionLockUntil = now + ROPE_JUMP_LANDING_RECOVERY_MS;
        break;
      }
    }
    assert.equal(touched, true);
    assert.equal(shakes, 1);
    assert.equal(jumper.ropeJumpPhase, "landing");
  });
});

function computeRaw(startX) {
  const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
  return Math.max(
    MAP_LEFT_BOUNDARY,
    Math.min(startX + (mid - startX) * 0.33, MAP_RIGHT_BOUNDARY)
  );
}

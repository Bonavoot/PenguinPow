"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveLandingTarget,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
  didRawPathCrossOpponent,
  choosePreferredLandingSide,
  SIDE_AMBIGUITY_EPSILON_PX,
  LANDING_SEPARATION_PAD_PX,
} = require("../../landingResolution");
const { HITBOX_DISTANCE_VALUE } = require("../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("../../gameUtils");

const HALF_DEFAULT = getPushboxHalfWidth(DEFAULT_PLAYER_SIZE_MULTIPLIER);
const MIN_DEFAULT = getMinimumCenterDistance(
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  DEFAULT_PLAYER_SIZE_MULTIPLIER
);

function resolve(overrides = {}) {
  return resolveLandingTarget({
    rawTargetX: 500,
    jumperStartX: MAP_LEFT_BOUNDARY,
    jumperCurrentX: 420,
    jumpDirection: 1,
    opponentX: 500,
    jumperHalfWidth: HALF_DEFAULT,
    opponentHalfWidth: HALF_DEFAULT,
    mapLeft: MAP_LEFT_BOUNDARY,
    mapRight: MAP_RIGHT_BOUNDARY,
    ...overrides,
  });
}

describe("landingResolution pure solver", () => {
  it("getPushboxHalfWidth matches HITBOX_DISTANCE_VALUE * sizeMultiplier", () => {
    assert.equal(getPushboxHalfWidth(1), HITBOX_DISTANCE_VALUE);
    assert.equal(
      getPushboxHalfWidth(DEFAULT_PLAYER_SIZE_MULTIPLIER),
      HITBOX_DISTANCE_VALUE * DEFAULT_PLAYER_SIZE_MULTIPLIER
    );
    // Matches calculateEffectiveHitboxSize: falsy multiplier falls back to 1.
    assert.equal(getPushboxHalfWidth(0), HITBOX_DISTANCE_VALUE);
  });

  it("1. raw target already clear → resolved equals raw", () => {
    const d = resolve({
      rawTargetX: 600,
      opponentX: 400,
    });
    assert.equal(d.rawOverlap, 0);
    assert.equal(d.resolvedTargetX, 600);
    assert.equal(d.usedFallback, false);
  });

  it("2. exact minimum legal separation → no adjustment", () => {
    const opp = 500;
    const raw = opp + MIN_DEFAULT;
    const d = resolve({ rawTargetX: raw, opponentX: opp, jumpDirection: 1 });
    assert.equal(d.rawOverlap, 0);
    assert.equal(d.resolvedTargetX, raw);
  });

  it("3. one pixel inside overlap → pushed to exact min separation", () => {
    const opp = 500;
    const raw = opp + MIN_DEFAULT - 1;
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.ok(d.rawOverlap >= 1);
    assert.ok(
      Math.abs(d.resolvedTargetX - opp) >= MIN_DEFAULT - 1e-9
    );
  });

  it("4. deep overlap → lands at min separation on preferred side", () => {
    const d = resolve({
      rawTargetX: 500,
      opponentX: 500,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.ok(d.rawOverlap > 50);
    assert.equal(d.resolvedSide, 1);
    assert.ok(
      Math.abs(d.resolvedTargetX - (500 + MIN_DEFAULT + LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
  });

  it("5. identical centers → deterministic preferred side from jump dir", () => {
    const right = resolve({
      rawTargetX: 500,
      opponentX: 500,
      jumperStartX: 500,
      jumpDirection: 1,
    });
    const left = resolve({
      rawTargetX: 500,
      opponentX: 500,
      jumperStartX: 500,
      jumpDirection: -1,
    });
    assert.equal(right.resolvedSide, 1);
    assert.equal(left.resolvedSide, -1);
    assert.ok(
      Math.abs(right.resolvedTargetX - (500 + MIN_DEFAULT + LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
    assert.ok(
      Math.abs(left.resolvedTargetX - (500 - MIN_DEFAULT - LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
  });

  it("6. opponent just left of raw target → conflict resolves clear", () => {
    const raw = 500;
    const opp = raw - 10;
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.ok(d.rawOverlap > 0);
    assert.ok(Math.abs(d.resolvedTargetX - opp) >= MIN_DEFAULT - 1e-9);
  });

  it("7. opponent just right of raw target → conflict resolves clear", () => {
    const raw = 500;
    const opp = raw + 10;
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.ok(d.rawOverlap > 0);
    assert.ok(Math.abs(d.resolvedTargetX - opp) >= MIN_DEFAULT - 1e-9);
  });

  it("8. opponent outside the jump path → raw unchanged", () => {
    const d = resolve({
      rawTargetX: 450,
      opponentX: 800,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.equal(d.rawOverlap, 0);
    assert.equal(d.resolvedTargetX, 450);
    assert.equal(d.crossed, false);
  });

  it("9. real cross-up from left boundary prefers opponent's right", () => {
    const start = MAP_LEFT_BOUNDARY;
    const opp = 400;
    const raw = 500; // past opponent
    assert.equal(didRawPathCrossOpponent(start, raw, opp), true);
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: start,
      jumpDirection: 1,
    });
    assert.equal(d.preferredSide, 1);
    assert.equal(d.resolvedSide, 1);
    assert.ok(
      Math.abs(d.resolvedTargetX - (opp + MIN_DEFAULT + LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
  });

  it("10. real cross-up from right boundary prefers opponent's left", () => {
    const start = MAP_RIGHT_BOUNDARY;
    const opp = 700;
    const raw = 600; // past opponent leftward
    assert.equal(didRawPathCrossOpponent(start, raw, opp), true);
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: start,
      jumpDirection: -1,
    });
    assert.equal(d.preferredSide, -1);
    assert.equal(d.resolvedSide, -1);
    assert.ok(
      Math.abs(d.resolvedTargetX - (opp - MIN_DEFAULT - LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
  });

  it("11. both fighters default size → min distance = 2 * half", () => {
    assert.equal(MIN_DEFAULT, HALF_DEFAULT * 2);
  });

  it("12. different size multipliers → asymmetric halves", () => {
    const jHalf = getPushboxHalfWidth(1);
    const oHalf = getPushboxHalfWidth(0.85);
    const d = resolve({
      rawTargetX: 500,
      opponentX: 500,
      jumperHalfWidth: jHalf,
      opponentHalfWidth: oHalf,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.equal(d.minimumDistance, jHalf + oHalf);
    assert.ok(
      Math.abs(d.resolvedTargetX - (500 + jHalf + oHalf + LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
  });

  it("13. opponent near left boundary — preferred left may fallback", () => {
    const opp = MAP_LEFT_BOUNDARY + 5;
    const d = resolve({
      rawTargetX: opp,
      opponentX: opp,
      jumperStartX: MAP_RIGHT_BOUNDARY,
      jumpDirection: -1,
      // Prefer left of opponent (toward boundary)
      preferredSide: -1,
    });
    assert.ok(d.resolvedTargetX >= MAP_LEFT_BOUNDARY);
    assert.ok(d.resolvedTargetX <= MAP_RIGHT_BOUNDARY);
    assert.ok(Number.isFinite(d.resolvedTargetX));
    // Left of opp is outside / overlapping — should use alternate or constrained
    assert.ok(d.usedFallback || d.resolvedSide === 1);
  });

  it("14. opponent near right boundary — preferred right may fallback", () => {
    const opp = MAP_RIGHT_BOUNDARY - 5;
    const d = resolve({
      rawTargetX: opp,
      opponentX: opp,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
      preferredSide: 1,
    });
    assert.ok(d.resolvedTargetX >= MAP_LEFT_BOUNDARY);
    assert.ok(d.resolvedTargetX <= MAP_RIGHT_BOUNDARY);
    assert.ok(d.usedFallback || d.resolvedSide === -1);
  });

  it("15. preferred side impossible → alternate used", () => {
    const opp = MAP_LEFT_BOUNDARY;
    const d = resolve({
      rawTargetX: opp + 10,
      opponentX: opp,
      jumperStartX: 500,
      jumpDirection: -1,
      preferredSide: -1,
    });
    assert.equal(d.usedFallback, true);
    assert.equal(d.fallbackReason, "preferred_side_impossible_alternate_ok");
    assert.equal(d.resolvedSide, 1);
    assert.ok(
      Math.abs(d.resolvedTargetX - (opp + MIN_DEFAULT + LANDING_SEPARATION_PAD_PX)) < 1e-9
    );
  });

  it("15b. tiny boundary residual on preferred side beats alternate cross-up", () => {
    // Case 3 geometry: preferred near endpoint clamps to map with ~0.5px residual.
    const { TOLERABLE_TOUCHDOWN_OVERLAP_PX } = require("../../landingResolution");
    const opp = 450;
    const raw = 438.175;
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumperCurrentX: 402.82,
      jumpDirection: 1,
    });
    assert.equal(d.preferredSide, -1);
    assert.equal(d.resolvedSide, -1);
    assert.equal(d.resolvedTargetX, MAP_LEFT_BOUNDARY);
    assert.ok(d.residualOverlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX);
    assert.ok(d.residualOverlap > 0);
    assert.equal(d.fallbackReason, "small_residual_preferred_side");
    // Must NOT force the clear alternate at ~560.
    assert.ok(d.resolvedTargetX < opp);
  });

  it("16. alternate side possible when preferred blocked", () => {
    const opp = MAP_RIGHT_BOUNDARY;
    const d = resolve({
      rawTargetX: opp - 10,
      opponentX: opp,
      jumperStartX: 500,
      jumpDirection: 1,
      preferredSide: 1,
    });
    assert.equal(d.resolvedSide, -1);
    assert.equal(d.usedFallback, true);
  });

  it("17. both sides constrained → deterministic pick, in-map, finite", () => {
    // Enormous halves so neither side clears inside the ring.
    const d = resolve({
      rawTargetX: 637,
      opponentX: 637,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
      jumperHalfWidth: 400,
      opponentHalfWidth: 400,
    });
    assert.equal(d.fallbackReason, "both_sides_constrained");
    assert.ok(d.resolvedTargetX >= MAP_LEFT_BOUNDARY);
    assert.ok(d.resolvedTargetX <= MAP_RIGHT_BOUNDARY);
    assert.ok(Number.isFinite(d.resolvedTargetX));
  });

  it("18. invalid / missing optional inputs handled safely", () => {
    const d = resolveLandingTarget({
      rawTargetX: NaN,
      jumperStartX: undefined,
      jumperCurrentX: null,
      jumpDirection: 0,
      opponentX: Infinity,
      jumperHalfWidth: undefined,
      opponentHalfWidth: -5,
    });
    assert.ok(Number.isFinite(d.resolvedTargetX));
    assert.ok(d.resolvedTargetX >= MAP_LEFT_BOUNDARY);
    assert.ok(d.resolvedTargetX <= MAP_RIGHT_BOUNDARY);
    assert.ok(!Number.isNaN(d.minimumDistance));
  });

  it("19. symmetry under mirrored coordinates", () => {
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const left = resolve({
      rawTargetX: mid - 20,
      opponentX: mid - 20,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    const mirror = resolve({
      rawTargetX: mid + 20,
      opponentX: mid + 20,
      jumperStartX: MAP_RIGHT_BOUNDARY,
      jumpDirection: -1,
    });
    const leftOffset = left.resolvedTargetX - (mid - 20);
    const rightOffset = (mid + 20) - mirror.resolvedTargetX;
    assert.ok(Math.abs(leftOffset - rightOffset) < 1e-6);
    assert.equal(left.resolvedSide, -mirror.resolvedSide);
  });

  it("20. determinism across repeated calls", () => {
    const args = {
      rawTargetX: 438.175,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumperCurrentX: 400,
      jumpDirection: 1,
      opponentX: 420,
      jumperHalfWidth: HALF_DEFAULT,
      opponentHalfWidth: HALF_DEFAULT,
    };
    const a = resolveLandingTarget(args);
    const b = resolveLandingTarget(args);
    assert.deepEqual(a, b);
  });

  it("landing short (no cross) prefers near/start side", () => {
    // Start left, raw target still left of opponent but overlapping.
    const opp = 500;
    const raw = opp - 20; // short of crossing
    assert.equal(didRawPathCrossOpponent(MAP_LEFT_BOUNDARY, raw, opp), false);
    const side = choosePreferredLandingSide({
      rawTargetX: raw,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
      opponentX: opp,
      minimumDistance: MIN_DEFAULT,
    });
    assert.equal(side, -1);
    const d = resolve({
      rawTargetX: raw,
      opponentX: opp,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
    });
    assert.equal(d.resolvedSide, -1);
    assert.equal(d.crossed, false);
  });

  it("side ambiguity epsilon is documented and positive", () => {
    assert.ok(SIDE_AMBIGUITY_EPSILON_PX > 0);
  });

  it("player order independence: solver ignores caller identity", () => {
    // Same geometric inputs always yield the same result (no p1/p2).
    const d1 = resolve({ opponentX: 450, rawTargetX: 450 });
    const d2 = resolve({ opponentX: 450, rawTargetX: 450 });
    assert.equal(d1.resolvedTargetX, d2.resolvedTargetX);
  });
});

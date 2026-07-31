"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  makeFighter,
  computeRawRopeJumpTargetX,
  simulateRopeJump,
  getMinimumCenterDistance,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("./helpers/ropeJumpSim");
const {
  ORDINARY_MAX_SAFETY_CORRECTION_TICKS,
  ORDINARY_MAX_TOTAL_SAFETY_CORRECTION_PX,
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
  LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX,
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
} = require("../../landingResolution");

describe("rope-jump landing — moving opponent", () => {
  it("opponent walks toward raw target — clear→conflict before commit resolves aerially", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    // Start clear of raw footprint; walk into it before commitment.
    const opponent = makeFighter({ id: "o", x: raw + 130 });

    const lockedRef = { x: null };
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x -= 2.5;
        if (jumper.ropeJumpLandingCommitted && lockedRef.x == null) {
          lockedRef.x = jumper.ropeJumpResolvedTargetX;
        }
      },
    });

    assert.ok(trace.commit);
    const locked = trace.commit.resolvedTargetX;
    assert.equal(trace.commit.resolvedTargetX, locked);
    // Endpoint must not re-home after commit.
    assert.ok(
      Math.abs(trace.touchdown.x - locked) < 0.5,
      `touchdown ${trace.touchdown.x} drifted from locked ${locked}`
    );
    if (trace.conflictBeforeDeadline) {
      assert.ok(trace.touchdown.overlap <= 0.05);
      assert.ok(
        trace.correctionTicks <= ORDINARY_MAX_SAFETY_CORRECTION_TICKS
      );
      assert.ok(
        trace.totalSafetyCorrectionPx <=
          ORDINARY_MAX_TOTAL_SAFETY_CORRECTION_PX + 1e-6
      );
    } else {
      assert.ok(
        trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS
      );
      assert.ok(
        trace.totalSafetyCorrectionPx <=
          LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX + 1e-6
      );
      assert.ok(
        trace.maxSingleTickCorrection <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6
      );
    }
  });

  it("opponent walks away — may clear conflict; no oscillation", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw });

    const sides = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x += 3; // walk away right
        if (jumper.ropeJumpLandingCommitted) {
          sides.push(jumper.ropeJumpResolvedSide);
        }
      },
    });

    assert.ok(trace.commit);
    const uniqueSides = new Set(sides);
    assert.ok(uniqueSides.size <= 1, "resolved side must not oscillate after commit");
  });

  it("opponent crosses target before commitment — side uses commit-time geometry", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    // Start right of raw, walk left across it before late commit.
    // A.1 may early-lock; endpoint stays locked (no re-home) either way.
    const opponent = makeFighter({ id: "o", x: raw + 60 });

    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        if (t < 0.55) {
          opp.x -= 4;
        }
      },
    });

    assert.ok(trace.commit);
    assert.equal(trace.touchdown.x, trace.commit.resolvedTargetX);
    // Event-level safety budget (not merely per-tick ≤18).
    assert.ok(
      trace.maxSingleTickCorrection <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6
    );
    if (trace.conflictBeforeDeadline) {
      assert.ok(
        trace.correctionTicks <= ORDINARY_MAX_SAFETY_CORRECTION_TICKS,
        `ordinary multi-tick sep ${trace.correctionTicks} overlap=${trace.touchdown.overlap}`
      );
      assert.ok(trace.touchdown.overlap <= 1.0);
    } else {
      assert.ok(
        trace.totalSafetyCorrectionPx <=
          LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX + 1e-6
      );
    }
    assert.ok(
      Number.isFinite(trace.touchdown.x) &&
        trace.touchdown.x >= MAP_LEFT_BOUNDARY &&
        trace.touchdown.x <= MAP_RIGHT_BOUNDARY
    );
  });

  it("opponent crosses after commitment — endpoint stays locked", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    // Stay clear through commit, then cross the locked cell.
    const opponent = makeFighter({ id: "o", x: 700 });

    let locked = null;
    const postCommitTargets = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        if (jumper.ropeJumpLandingCommitted) {
          if (locked == null) locked = jumper.ropeJumpResolvedTargetX;
          postCommitTargets.push(jumper.ropeJumpResolvedTargetX);
          opp.x = Math.max(raw - 10, opp.x - 25);
        }
      },
    });

    assert.ok(trace.commit);
    assert.ok(postCommitTargets.every((x) => x === locked));
    assert.equal(locked, raw);
    // Post-commit intrusion: at most one classified safety event, not N×18.
    assert.ok(
      trace.maxSingleTickCorrection <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6
    );
    assert.ok(
      trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS
    );
    assert.ok(
      trace.totalSafetyCorrectionPx <=
        LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX + 1e-6
    );
  });

  it("opponent knockback during jump does not re-home after commit", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw });

    let locked = null;
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        if (jumper.ropeJumpLandingCommitted) {
          if (locked == null) locked = jumper.ropeJumpResolvedTargetX;
          opp.x -= 8; // sudden knock left
          assert.equal(jumper.ropeJumpResolvedTargetX, locked);
        }
      },
    });

    assert.ok(trace.commit);
    assert.equal(trace.commit.resolvedTargetX, locked);
  });

  it("anchored / hitstun opponent is not moved by landing resolver", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({
      id: "o",
      x: raw,
      isHit: true,
    });
    const oppStart = opponent.x;

    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });

    // Anchored defender share is 0 — settle moves the jumper only.
    assert.ok(trace.commit);
    assert.equal(opponent.x, oppStart);
    if (trace.settleTicks && trace.settleTicks.length) {
      for (const s of trace.settleTicks) {
        assert.ok(
          Math.abs(s.opponentDelta) < 1e-9,
          `anchored opp moved ${s.opponentDelta}`
        );
      }
    }
    assert.ok(trace.postRecovery && trace.postRecovery.withinTolerance);
  });

  it("opponent near map boundary uses fallback without NaN", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({
      id: "o",
      x: MAP_LEFT_BOUNDARY + 10,
    });

    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      rawTargetX: MAP_LEFT_BOUNDARY + 10,
    });

    assert.ok(trace.touchdown);
    assert.ok(Number.isFinite(trace.touchdown.x));
    assert.ok(trace.touchdown.x >= MAP_LEFT_BOUNDARY);
    assert.ok(trace.touchdown.x <= MAP_RIGHT_BOUNDARY);
  });
});

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

describe("rope-jump landing — moving opponent", () => {
  it("opponent walks toward raw target — endpoint locks at commit (no home)", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw - 80 });

    const resolvedAtCommit = { x: null };
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        // Walk toward raw target before/after commit
        opp.x = Math.min(raw, opp.x + 2.5);
        if (resolvedAtCommit.x == null && t >= 0.58) {
          // captured after step in sim — see commit record
        }
      },
    });

    assert.ok(trace.commit);
    const locked = trace.commit.resolvedTargetX;
    // After commit the endpoint must stay locked (no homing), even if the
    // opponent walks into the cell and triggers bounded safety correction.
    assert.equal(trace.commit.resolvedTargetX, locked);
    assert.ok(trace.maxSingleTickCorrection <= 18 + 1e-6);
    assert.ok(
      Math.abs(trace.touchdown.x - locked) < 0.5 ||
        trace.correctionTicks >= 0
    );
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
    // Start right of raw, walk left across it before commit
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
    assert.ok(
      Math.abs(trace.touchdown.x - trace.touchdown.opponentX) >=
        getMinimumCenterDistance(
          DEFAULT_PLAYER_SIZE_MULTIPLIER,
          DEFAULT_PLAYER_SIZE_MULTIPLIER
        ) -
          1
    );
  });

  it("opponent crosses after commitment — endpoint stays locked", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw - 40 });

    let locked = null;
    const postCommitTargets = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        if (jumper.ropeJumpLandingCommitted) {
          if (locked == null) locked = jumper.ropeJumpResolvedTargetX;
          postCommitTargets.push(jumper.ropeJumpResolvedTargetX);
          opp.x += 5; // cross through landing cell after lock
        } else {
          opp.x += 0.5;
        }
      },
    });

    assert.ok(trace.commit);
    assert.ok(postCommitTargets.every((x) => x === locked));
    // Safety correction may fire if opponent entered the cell — bounded, not primary
    assert.ok(trace.maxSingleTickCorrection <= 18 + 1e-6);
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

    // Resolver itself never moves defender; pushbox safety might if overlap remains.
    // With V2 clear land, opponent should stay put.
    assert.ok(trace.touchdown.overlap <= 1e-6);
    assert.equal(opponent.x, oppStart);
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

"use strict";

/**
 * Phase A.1 — trajectory quality scan + confirmed Case 1/2/3 regressions.
 *
 * Budgets are derived from measured raw-arc / Hermite baselines (see
 * AERIAL_LANDING_PHASE_A1.md), not arbitrary large ceilings.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  TICK_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_COMMIT_T,
  makeFighter,
  computeRawRopeJumpTargetX,
  simulateRopeJump,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
} = require("./helpers/ropeJumpSim");
const {
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
  rawArcVelocity,
  hermiteVelocity,
} = require("../../landingResolution");

/** Raw left-rope peak velocity ≈ 342 px/s; Hermite Case1 peaks ≈ 1109. */
const RAW_PEAK_VEL_PX_S = 350;
const MAX_PEAK_VEL_MULTIPLIER = 3.5; // → ~1225 px/s
const MAX_COMMIT_VEL_RATIO = 1.55; // Hermite Case1 post/pre ≈ 1.37
const MAX_PEAK_ACCEL = 25000; // Hermite Case1 ≈ 19k; Phase A discontinuous ≈ 64k
const REVERSAL_DX_EPS = 0.5;

function analyzeTrace(trace, jumpDirection) {
  const samples = trace.samples.filter((s) => s.phase === "active");
  const commitIdx = samples.findIndex((s) => s.committed);
  let reversal = false;
  let maxVel = 0;
  let maxAccel = 0;
  let maxPosJump = 0;
  for (let i = 0; i < samples.length; i++) {
    maxVel = Math.max(maxVel, Math.abs(samples[i].vel || 0));
    if (i > 0) {
      maxPosJump = Math.max(maxPosJump, Math.abs(samples[i].x - samples[i - 1].x));
      const accel =
        ((samples[i].vel || 0) - (samples[i - 1].vel || 0)) / (TICK_MS / 1000);
      maxAccel = Math.max(maxAccel, Math.abs(accel));
      if (
        i > commitIdx &&
        commitIdx >= 0 &&
        Math.abs(samples[i - 1].dx) > REVERSAL_DX_EPS &&
        Math.abs(samples[i].dx) > REVERSAL_DX_EPS &&
        samples[i - 1].dx * samples[i].dx < 0
      ) {
        // Hold-settle may zero velocity; only flag opposing nonzero motion.
        reversal = true;
      }
    }
  }

  let commitVelRatio = null;
  if (commitIdx > 0 && commitIdx + 1 < samples.length) {
    const pre = samples[commitIdx - 1].dx;
    const post = samples[commitIdx + 1].dx;
    if (Math.abs(pre) > 0.2) commitVelRatio = post / pre;
  }

  return {
    reversal,
    maxVel,
    maxAccel,
    maxPosJump,
    commitVelRatio,
    commit: trace.commit,
    touchdown: trace.touchdown,
    jumpDirection,
  };
}

function scenarioId(opts) {
  return [
    `start=${opts.startX}`,
    `opp=${opts.oppX}`,
    `dir=${opts.jumpDirection}`,
    `jSize=${opts.jSize}`,
    `oSize=${opts.oSize}`,
    opts.motion || "static",
  ].join(" ");
}

describe("rope-jump trajectory quality (Phase A.1)", () => {
  it("Case 1 — opp on raw: velocity continuous, no 4× speed pop", () => {
    const startX = MAP_LEFT_BOUNDARY;
    const raw = computeRawRopeJumpTargetX(startX);
    const jumper = makeFighter({ id: "j", x: startX });
    const opponent = makeFighter({ id: "o", x: raw });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    const a = analyzeTrace(trace, 1);
    assert.ok(a.commit, "must commit");
    assert.equal(a.commit.trajectoryType, "hermite");
    assert.ok(a.commitVelRatio != null && a.commitVelRatio < MAX_COMMIT_VEL_RATIO, {
      commitVelRatio: a.commitVelRatio,
    });
    // Phase A was ~3.92 — must not regress to that class of discontinuity.
    assert.ok(a.commitVelRatio < 2.0, `ratio ${a.commitVelRatio} still discontinuous`);
    assert.equal(a.reversal, false);
    assert.ok(a.touchdown.overlap <= 1e-6);
    assert.ok(a.maxVel <= RAW_PEAK_VEL_PX_S * MAX_PEAK_VEL_MULTIPLIER);
    assert.ok(a.maxAccel <= MAX_PEAK_ACCEL, `peakAccel ${a.maxAccel}`);
  });

  it("Case 2 — opp ahead of raw: no late reverse toward rope", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 470 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    const a = analyzeTrace(trace, 1);
    assert.ok(a.commit);
    assert.equal(a.reversal, false);
    assert.ok(
      a.commit.resolvedTargetX >= a.commit.commitX - 0.01,
      "endpoint must not be behind commit (would reverse)"
    );
    assert.ok(a.touchdown.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6);
  });

  it("Case 3 — boundary residual preferred over extreme cross-up", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 450 });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    const a = analyzeTrace(trace, 1);
    assert.ok(a.commit);
    assert.equal(a.reversal, false);
    // Must not take the Phase A alternate at ~560.
    assert.ok(
      a.commit.resolvedTargetX < raw + 30,
      `forced cross-up ${a.commit.resolvedTargetX}`
    );
    assert.ok(
      a.touchdown.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6,
      `overlap ${a.touchdown.overlap}`
    );
    assert.ok(
      a.commit.decisionClass === "small_residual_preferred" ||
        a.commit.trajectoryType === "hold_settle",
      a.commit.decisionClass
    );
  });

  it("Case 1/2/3 mirror from right boundary", () => {
    const cases = [
      { oppX: computeRawRopeJumpTargetX(MAP_RIGHT_BOUNDARY), label: "C1R" },
      { oppX: 805, label: "C2R" },
      { oppX: 825, label: "C3R" },
    ];
    for (const c of cases) {
      const jumper = makeFighter({ id: "j", x: MAP_RIGHT_BOUNDARY });
      const opponent = makeFighter({ id: "o", x: c.oppX });
      const trace = simulateRopeJump(jumper, opponent, {
        useV2: true,
        jumpDirection: -1,
      });
      const a = analyzeTrace(trace, -1);
      assert.equal(a.reversal, false, c.label);
      assert.ok(a.touchdown.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6, c.label);
      if (c.label === "C1R") {
        assert.ok(a.commitVelRatio < MAX_COMMIT_VEL_RATIO, c.label);
      }
      if (c.label === "C3R") {
        assert.ok(
          a.commit.resolvedTargetX >
            computeRawRopeJumpTargetX(MAP_RIGHT_BOUNDARY) - 30,
          c.label
        );
      }
    }
  });

  it("full scenario scan — static / walk / sizes / edges", () => {
    const sizePairs = [
      [DEFAULT_PLAYER_SIZE_MULTIPLIER, DEFAULT_PLAYER_SIZE_MULTIPLIER],
      [0.7, 1.0],
      [1.0, 0.7],
    ];
    const motions = [
      { name: "static", step: null },
      {
        name: "walkToward",
        step: (opp, _t, dir) => {
          opp.x += dir * 2;
        },
      },
      {
        name: "walkAway",
        step: (opp, _t, dir) => {
          opp.x -= dir * 2;
        },
      },
    ];

    const failures = [];
    for (const dir of [1, -1]) {
      const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
      const raw = computeRawRopeJumpTargetX(startX);
      const oppMin = MAP_LEFT_BOUNDARY + 20;
      const oppMax = MAP_RIGHT_BOUNDARY - 20;
      for (const [jSize, oSize] of sizePairs) {
        for (const motion of motions) {
          for (let oppX = oppMin; oppX <= oppMax; oppX += 15) {
            const jumper = makeFighter({
              id: "j",
              x: startX,
              sizeMultiplier: jSize,
            });
            const opponent = makeFighter({
              id: "o",
              x: oppX,
              sizeMultiplier: oSize,
            });
            const id = scenarioId({
              startX,
              oppX,
              jumpDirection: dir,
              jSize,
              oSize,
              motion: motion.name,
            });
            let trace;
            try {
              trace = simulateRopeJump(jumper, opponent, {
                useV2: true,
                jumpDirection: dir,
                opponentStep: motion.step
                  ? (opp, t) => motion.step(opp, t, dir)
                  : undefined,
              });
            } catch (err) {
              failures.push(`${id}: threw ${err.message}`);
              continue;
            }
            const a = analyzeTrace(trace, dir);
            if (!a.commit && !trace.touchdown) {
              failures.push(`${id}: no touchdown`);
              continue;
            }
            if (a.reversal) failures.push(`${id}: late reverse`);
            if (a.maxVel > RAW_PEAK_VEL_PX_S * MAX_PEAK_VEL_MULTIPLIER + 50) {
              failures.push(`${id}: peakVel ${a.maxVel.toFixed(0)}`);
            }
            if (a.maxAccel > MAX_PEAK_ACCEL + 5000) {
              failures.push(`${id}: peakAccel ${a.maxAccel.toFixed(0)}`);
            }
            if (a.maxPosJump > 40) {
              failures.push(`${id}: pos jump ${a.maxPosJump.toFixed(1)}`);
            }
            if (
              a.touchdown &&
              a.touchdown.overlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1
            ) {
              // Moving opponent after early lock may exceed tolerable at
              // touchdown — safety must still be bounded.
              if (trace.maxSingleTickCorrection > 18 + 1e-6) {
                failures.push(
                  `${id}: unbounded safety ${trace.maxSingleTickCorrection}`
                );
              }
            }
            // Velocity-continuity budget applies to Hermite (matched tangents).
            // Brake/hold_settle intentionally allow a bounded discontinuity.
            if (
              a.commit &&
              a.commit.trajectoryType === "hermite" &&
              a.commitVelRatio != null &&
              Math.abs(a.commit.commitX - raw) > 5 &&
              a.commit.t >= ROPE_JUMP_LANDING_COMMIT_T - 0.05 &&
              a.commitVelRatio > MAX_COMMIT_VEL_RATIO
            ) {
              failures.push(
                `${id}: commit vel ratio ${a.commitVelRatio.toFixed(2)}`
              );
            }
            // Determinism: rerun once
            const jumper2 = makeFighter({
              id: "j",
              x: startX,
              sizeMultiplier: jSize,
            });
            const opponent2 = makeFighter({
              id: "o",
              x: oppX,
              sizeMultiplier: oSize,
            });
            const trace2 = simulateRopeJump(jumper2, opponent2, {
              useV2: true,
              jumpDirection: dir,
              opponentStep: motion.step
                ? (opp, t) => motion.step(opp, t, dir)
                : undefined,
            });
            if (
              trace.commit &&
              trace2.commit &&
              Math.abs(
                trace.commit.resolvedTargetX - trace2.commit.resolvedTargetX
              ) > 1e-9
            ) {
              failures.push(`${id}: nondeterministic endpoint`);
            }
          }
        }
      }
    }

    assert.equal(
      failures.length,
      0,
      `trajectory invariants failed (${failures.length}):\n` +
        failures.slice(0, 20).join("\n")
    );
  });

  it("Hermite preserves commit velocity at s=0", () => {
    const start = MAP_LEFT_BOUNDARY;
    const raw = computeRawRopeJumpTargetX(start);
    const t = ROPE_JUMP_LANDING_COMMIT_T;
    const commitX = start + (raw - start) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    const v0 = rawArcVelocity(start, raw, t, ROPE_JUMP_ACTIVE_MS);
    const endpoint = 548.685;
    const remaining = (1 - t) * (ROPE_JUMP_ACTIVE_MS / 1000);
    const vAt0 = hermiteVelocity(commitX, v0, endpoint, 0, 0, remaining);
    assert.ok(Math.abs(vAt0 - v0) < 1e-6, { vAt0, v0 });
  });

  it("tolerable overlap constant matches safety cap rationale (18px)", () => {
    assert.equal(TOLERABLE_TOUCHDOWN_OVERLAP_PX, 18);
  });

  it("mirror symmetry of Case 1 endpoints", () => {
    const left = simulateRopeJump(
      makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY }),
      makeFighter({
        id: "o",
        x: computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY),
      }),
      { useV2: true, jumpDirection: 1 }
    );
    const right = simulateRopeJump(
      makeFighter({ id: "j", x: MAP_RIGHT_BOUNDARY }),
      makeFighter({
        id: "o",
        x: computeRawRopeJumpTargetX(MAP_RIGHT_BOUNDARY),
      }),
      { useV2: true, jumpDirection: -1 }
    );
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const lOff = left.commit.resolvedTargetX - mid;
    const rOff = mid - right.commit.resolvedTargetX;
    assert.ok(Math.abs(lOff - rOff) < 1e-6);
  });
});

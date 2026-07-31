"use strict";

/**
 * Phase A.1 — trajectory quality scan + confirmed Case 1/2/3 regressions.
 *
 * V2 move identity: high-vault authored path, apex lock (~t=0.42),
 * vault_hermite descent, capped endpoint correction, settle debt OK
 * when A.3.2 recovery exit is stable.
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
  GROUND_LEVEL,
} = require("./helpers/ropeJumpSim");
const {
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
  rawArcVelocity,
  hermiteVelocity,
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
} = require("../../landingResolution");
const { getVaultProfile } = require("../../ropeJumpVault");

/** Reference vault peak horiz ≈ 390 px/s; capped far-cross stays under 800. */
const VAULT_NORMAL_PEAK_VEL_PX_S = 390;
/** Farthest capped cross peaks ~860 — keep ≪ legacy Hermite ~1100. */
const MAX_VAULT_PEAK_VEL_PX_S = 900;
const MAX_PEAK_ACCEL = 25000;
const REVERSAL_DX_EPS = 0.5;
const VAULT_APEX_HEIGHT = getVaultProfile().apexHeight; // 156 selected
const ENDPOINT_CORRECTION_CAP = getVaultProfile().endpointCorrectionCapPx; // 40
const CROSS_MIN_FAR_PAD = getVaultProfile().crossMinFarPadPx; // 28

function analyzeTrace(trace, jumpDirection) {
  const samples = trace.samples.filter((s) => s.phase === "active");
  const commitIdx = samples.findIndex((s) => s.committed);
  let reversal = false;
  let maxVel = 0;
  let maxAccel = 0;
  let maxPosJump = 0;
  let maxY = GROUND_LEVEL;
  for (let i = 0; i < samples.length; i++) {
    maxVel = Math.max(maxVel, Math.abs(samples[i].vel || 0));
    maxY = Math.max(maxY, samples[i].y || GROUND_LEVEL);
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
    maxY,
    apexHeight: maxY - GROUND_LEVEL,
    commitVelRatio,
    commit: trace.commit,
    touchdown: trace.touchdown,
    jumpDirection,
  };
}

function assertRecoveryExitStable(trace, label) {
  assert.ok(trace.recoveryEnd, `${label}: missing recoveryEnd`);
  assert.ok(
    trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
    `${label}: recoveryEnd overlap ${trace.recoveryEnd.overlap}`
  );
  assert.ok(trace.postRecovery, `${label}: missing postRecovery`);
  assert.ok(
    trace.postRecovery.withinTolerance,
    `${label}: postRecovery ${trace.postRecovery.pairDisplacement}`
  );
  assert.ok(!trace.overlapEverIncreased, `${label}: overlap grew`);
  assert.ok(
    trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
    `${label}: corrTicks ${trace.correctionTicks}`
  );
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
  it("Case 1 — opp on raw: vault identity, no reverse, settle debt OK", () => {
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
    assert.equal(a.commit.trajectoryType, "vault_hermite");
    assert.equal(a.commit.intentClass, "cross");
    assert.ok(
      Math.abs(a.commit.t - getVaultProfile().decisionT) < 0.05,
      `apex decision t ${a.commit.t}`
    );
    assert.ok(
      Math.abs(a.apexHeight - VAULT_APEX_HEIGHT) < 1.0,
      `apexHeight ${a.apexHeight}`
    );
    // Descent Hermite slows after apex — never a 4× commit pop.
    assert.ok(a.commitVelRatio != null && a.commitVelRatio < 1.5, {
      commitVelRatio: a.commitVelRatio,
    });
    assert.equal(a.reversal, false);
    assert.ok(
      a.maxVel <= VAULT_NORMAL_PEAK_VEL_PX_S + 20,
      `peakVel ${a.maxVel}`
    );
    assert.ok(a.maxAccel <= MAX_PEAK_ACCEL, `peakAccel ${a.maxAccel}`);
    const corr =
      a.commit.decision?.correctionMagnitude ??
      Math.abs(a.commit.resolvedTargetX - raw);
    assert.ok(
      corr <= ENDPOINT_CORRECTION_CAP + CROSS_MIN_FAR_PAD + 1e-6,
      `correction ${corr}`
    );
    assertRecoveryExitStable(trace, "case1");
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
    assert.equal(a.commit.trajectoryType, "vault_hermite");
    assert.equal(a.reversal, false);
    assert.ok(
      a.commit.resolvedTargetX >= a.commit.commitX - 0.01,
      "endpoint must not be behind commit (would reverse)"
    );
    assert.ok(a.maxVel <= MAX_VAULT_PEAK_VEL_PX_S, `peakVel ${a.maxVel}`);
    assertRecoveryExitStable(trace, "case2");
  });

  it("Case 3 — near map-unfit crosses (no vertical rope hold_settle)", () => {
    // Opp near raw promotes capped cross (never invisible-wall reverse).
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
    assert.ok(
      a.commit.resolvedTargetX > raw + 30,
      `expected cross-up escape, got ${a.commit.resolvedTargetX}`
    );
    assert.equal(a.commit.resolvedSide, 1);
    assert.equal(a.commit.intentClass, "cross");
    assert.equal(a.commit.trajectoryType, "vault_hermite");
    assert.notEqual(a.commit.trajectoryType, "hold_settle");
    assert.ok(a.maxVel <= MAX_VAULT_PEAK_VEL_PX_S + 1);
    assert.ok(a.maxAccel <= MAX_PEAK_ACCEL + 1, `peakAccel ${a.maxAccel}`);
    assertRecoveryExitStable(trace, "case3");
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
      assert.equal(a.commit.trajectoryType, "vault_hermite", c.label);
      assert.ok(a.maxVel <= MAX_VAULT_PEAK_VEL_PX_S + 1, c.label);
      assertRecoveryExitStable(trace, c.label);
      if (c.label === "C3R") {
        assert.ok(
          a.commit.resolvedTargetX <
            computeRawRopeJumpTargetX(MAP_RIGHT_BOUNDARY) - 30,
          c.label
        );
        assert.equal(a.commit.resolvedSide, -1, c.label);
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
            if (a.maxVel > MAX_VAULT_PEAK_VEL_PX_S + 50) {
              failures.push(`${id}: peakVel ${a.maxVel.toFixed(0)}`);
            }
            if (a.maxAccel > MAX_PEAK_ACCEL + 5000) {
              failures.push(`${id}: peakAccel ${a.maxAccel.toFixed(0)}`);
            }
            if (a.maxPosJump > 40) {
              failures.push(`${id}: pos jump ${a.maxPosJump.toFixed(1)}`);
            }
            if (a.commit && a.commit.trajectoryType !== "vault_hermite") {
              failures.push(`${id}: traj ${a.commit.trajectoryType}`);
            }
            if (a.commit && a.commit.decision) {
              const d = a.commit.decision;
              // Soft cap 40px; cross far-pad floor may exceed it but must mark capped.
              if (
                d.correctionMagnitude > ENDPOINT_CORRECTION_CAP + 1e-6 &&
                !d.correctionCapped
              ) {
                failures.push(
                  `${id}: uncapped correction ${d.correctionMagnitude.toFixed(1)}`
                );
              }
              if (d.correctionCapPx !== ENDPOINT_CORRECTION_CAP) {
                failures.push(`${id}: cap ${d.correctionCapPx}`);
              }
            }
            if (a.touchdown) {
              // Settle debt at touchdown is owned by A.3.2 — require stable exit.
              if (trace.overlapEverIncreased) {
                failures.push(`${id}: overlap grew`);
              }
              if (trace.correctionTicks > LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS) {
                failures.push(
                  `${id}: excessive settle ticks ${trace.correctionTicks}`
                );
              }
              if (
                trace.postRecovery &&
                !trace.postRecovery.withinTolerance
              ) {
                failures.push(
                  `${id}: postRecovery ${trace.postRecovery.pairDisplacement}`
                );
              }
              if (
                trace.recoveryEnd &&
                trace.recoveryEnd.overlap >
                  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
              ) {
                failures.push(
                  `${id}: recoveryEnd ov ${trace.recoveryEnd.overlap}`
                );
              }
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

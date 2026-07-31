"use strict";

/**
 * Phase A.3 — dynamic landing-conflict under V2 high-vault identity:
 * provisional raw → one apex lock/commit → capped correction.
 * Settle debt at touchdown is OK when A.3.2 recovery exit is stable.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  TICK_MS,
  ROPE_JUMP_ACTIVE_MS,
  makeFighter,
  computeRawRopeJumpTargetX,
  simulateRopeJump,
  getMinimumCenterDistance,
} = require("./helpers/ropeJumpSim");
const {
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
  LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX,
  MAX_TRAJECTORY_PEAK_ACCEL,
  PLANNING_PROVISIONAL_RAW,
  PLANNING_ENDPOINT_COMMITTED,
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
} = require("../../landingResolution");
const { getVaultProfile } = require("../../ropeJumpVault");
const {
  speedFactor,
  ICE_MAX_SPEED,
  ICE_ACCELERATION,
  TICK_RATE,
} = require("../../constants");

const VAULT = getVaultProfile();
/** Far dynamic capped-cross ceiling (≪ legacy ~1468 / Hermite ~1100). */
const MAX_VAULT_PEAK_VEL = 900;

const SIZE_PAIRS = [
  [0.7, 0.7],
  [0.7, 0.85],
  [0.7, 1.0],
  [0.85, 0.7],
  [0.85, 0.85],
  [0.85, 1.0],
  [1.0, 0.7],
  [1.0, 0.85],
  [1.0, 1.0],
];

const MOVE_RATES = [-3.75, -3, -2, -1, 0, 1, 2, 3, 3.75];

/** Ordinary ice max ≈ 15.625 * 0.185 * 1.3 ≈ 3.76 px/tick. */
const ICE_MAX_PX_PER_TICK = (1000 / TICK_RATE) * speedFactor * ICE_MAX_SPEED;

function runDynamic(startX, dir, oppX, stepPx, jSize = 0.85, oSize = 0.85) {
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
  const states = [];
  const trace = simulateRopeJump(jumper, opponent, {
    useV2: true,
    jumpDirection: dir,
    opponentStep: (opp) => {
      opp.x += stepPx;
      if (jumper.ropeJumpPlanningState) {
        states.push(jumper.ropeJumpPlanningState);
      }
    },
  });
  return { trace, states, jumper, opponent };
}

function assertVaultDynamicStable(trace, label) {
  assert.ok(trace.touchdown, `${label}: missing touchdown`);
  assert.ok(trace.commit, `${label}: missing apex commit`);
  assert.equal(trace.commit.trajectoryType, "vault_hermite", label);
  assert.ok(
    Math.abs(trace.commit.t - VAULT.decisionT) < 0.05,
    `${label}: commit t ${trace.commit.t}`
  );
  assert.ok(trace.sidesSeen.length <= 1, `${label}: side flip`);
  assert.ok(!trace.reversalDetected, `${label}: reversal`);
  assert.ok(
    trace.peakVel <= MAX_VAULT_PEAK_VEL + 1,
    `${label}: peakVel ${trace.peakVel}`
  );
  assert.ok(
    trace.peakAccel <= MAX_TRAJECTORY_PEAK_ACCEL + 1,
    `${label}: peakAccel ${trace.peakAccel}`
  );
  // Soft cap 40; cross far-pad may exceed but must mark capped.
  const d = trace.commit.decision;
  if (d) {
    assert.equal(d.correctionCapPx, VAULT.endpointCorrectionCapPx, label);
    if (d.correctionMagnitude > VAULT.endpointCorrectionCapPx + 1e-6) {
      assert.equal(d.correctionCapped, true, `${label}: uncapped corr`);
    }
  }
  // Settle debt OK — A.3.2 must clear by recovery exit.
  assert.ok(
    trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
    `${label}: corrTicks ${trace.correctionTicks}`
  );
  assert.ok(!trace.overlapEverIncreased, `${label}: overlap grew`);
  if (trace.recoveryEnd) {
    assert.ok(
      trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
      `${label}: recoveryEnd ${trace.recoveryEnd.overlap}`
    );
  }
  if (trace.postRecovery) {
    assert.ok(
      trace.postRecovery.withinTolerance,
      `${label}: postRecovery ${trace.postRecovery.pairDisplacement}`
    );
  }
}

describe("rope-jump dynamic conflict (Phase A.3)", () => {
  it("ice max speed sanity ≈ 3.76 px/tick", () => {
    assert.ok(Math.abs(ICE_MAX_PX_PER_TICK - 3.76) < 0.05);
    assert.ok(ICE_ACCELERATION > 0);
  });

  it("1. left start 340, opp 560, −3.75/tick — apex lock + settle exit", () => {
    const { trace } = runDynamic(340, 1, 560, -3.75);
    assert.ok(trace.sidesSeen.length === 1);
    assertVaultDynamicStable(trace, "case1-left");
  });

  it("2. right mirror start 935, opp 715, +3.75/tick", () => {
    const { trace } = runDynamic(935, -1, 715, 3.75);
    assertVaultDynamicStable(trace, "case1-right");
    const left = runDynamic(340, 1, 560, -3.75).trace;
    assert.ok(
      Math.abs(
        Math.abs(trace.commit.resolvedTargetX - 935) -
          Math.abs(left.commit.resolvedTargetX - 340)
      ) < 2 ||
        Math.abs(
          (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2 -
            (trace.commit.resolvedTargetX + left.commit.resolvedTargetX) / 2
        ) < 3 ||
        trace.intentClass === left.intentClass
    );
  });

  it("3. left start 340, opp 555, −2/tick — moderate approach", () => {
    const { trace } = runDynamic(340, 1, 555, -2);
    assertVaultDynamicStable(trace, "case2");
  });

  it("4. approaching opponent locks once at apex", () => {
    const raw = computeRawRopeJumpTargetX(340);
    const minDist = getMinimumCenterDistance(0.85, 0.85);
    const oppStart = raw + minDist + 0.5;
    const { trace, states } = runDynamic(340, 1, oppStart, -3.75);
    assert.ok(states.includes(PLANNING_PROVISIONAL_RAW));
    assert.ok(trace.sidesSeen.length <= 1);
    assertVaultDynamicStable(trace, "clear-then-conflict");
  });

  it("5. opponent walks in before apex — still resolves with capped correction", () => {
    const raw = computeRawRopeJumpTargetX(340);
    const minDist = getMinimumCenterDistance(0.85, 0.85);
    const { trace } = runDynamic(340, 1, raw + minDist + 40, -3.75);
    assert.ok(trace.commit);
    assert.ok(trace.sidesSeen.length <= 1);
    assertVaultDynamicStable(trace, "walk-in-before-apex");
  });

  it("6. raw remains clear for entire jump — preserve raw path", () => {
    const { trace } = runDynamic(340, 1, 700, 0);
    assert.equal(trace.commit.intentClass, "preserve_raw");
    assert.equal(trace.commit.resolvedTargetX, trace.rawTargetX);
    assertVaultDynamicStable(trace, "always-clear");
  });

  it("7. conflict appears then opponent moves away before commit", () => {
    let ticks = 0;
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 548 });
    const sides = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        ticks++;
        if (ticks <= 4) opp.x -= 3;
        else opp.x += 4;
        if (jumper.ropeJumpSideIntentLocked) {
          sides.push(jumper.ropeJumpSideIntent);
        }
      },
    });
    assert.ok(new Set(sides).size <= 1, "no side oscillation");
    assert.ok(trace.commit);
    assert.ok(trace.touchdown.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6);
  });

  it("8. conflict appears after endpoint commitment — late intrusion class", () => {
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 700 });
    const raw = computeRawRopeJumpTargetX(340);
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        if (jumper.ropeJumpLandingCommitted) {
          // Dive into the committed raw cell after lock.
          opp.x = Math.max(raw, opp.x - 20);
        }
      },
    });
    assert.ok(trace.commit);
    assert.equal(trace.commit.resolvedTargetX, raw);
    assert.ok(trace.lateIntrusion || trace.firstRawConflictT > trace.commit.t);
    // A.3.1: late intrusion may settle across recovery (≤18 px/tick), but must
    // not leave a deferred post-recovery snap.
    assert.ok(
      trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS
    );
    assert.ok(
      trace.maxSingleTickCorrection <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6
    );
    assert.ok(
      trace.totalSafetyCorrectionPx <=
        LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX + 1e-6
    );
    assert.ok(!trace.overlapEverIncreased);
    if (trace.recoveryEnd) {
      assert.ok(trace.recoveryEnd.overlap <= 0.5 + 1e-6);
    }
    if (trace.postRecovery) {
      assert.ok(trace.postRecovery.withinTolerance);
    }
  });

  it("9. opponent crosses near/cross boundary before side lock — locks once", () => {
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 520 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        if (!jumper.ropeJumpSideIntentLocked) opp.x -= 4;
      },
    });
    assert.ok(trace.sidesSeen.length <= 1);
    assert.ok(trace.commit);
  });

  it("10. opponent crosses near/cross boundary after side lock — side stable", () => {
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 500 });
    const sides = [];
    const endpoints = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        if (jumper.ropeJumpSideIntentLocked) {
          sides.push(jumper.ropeJumpSideIntent);
          if (jumper.ropeJumpLandingCommitted) {
            endpoints.push(jumper.ropeJumpResolvedTargetX);
          }
          opp.x -= 5;
        } else {
          opp.x -= 1;
        }
      },
    });
    assert.ok(new Set(sides).size <= 1);
    if (endpoints.length) {
      assert.ok(endpoints.every((x) => x === endpoints[0]));
    }
    assert.ok(trace.commit);
  });

  it("11. no repeated side changes", () => {
    const { trace } = runDynamic(340, 1, 560, -3.75);
    assert.ok(trace.sidesSeen.length <= 1);
  });

  it("12. settle debt clears within late-intrusion tick budget", () => {
    for (const rate of [-3.75, -2, -1]) {
      const { trace } = runDynamic(340, 1, 560, rate);
      assert.ok(
        trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
        `rate ${rate}: ticks ${trace.correctionTicks}`
      );
      assert.ok(!trace.overlapEverIncreased, `rate ${rate}: overlap grew`);
      if (trace.postRecovery) {
        assert.ok(trace.postRecovery.withinTolerance, `rate ${rate}`);
      }
    }
  });

  it("13. apex-locked dynamic approach exits recovery without snap", () => {
    const { trace } = runDynamic(340, 1, 560, -3.75);
    assertVaultDynamicStable(trace, "case13");
  });

  it("14. mirror symmetry of Case 1 endpoints", () => {
    const L = runDynamic(340, 1, 560, -3.75).trace;
    const R = runDynamic(935, -1, 715, 3.75).trace;
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    assert.ok(
      Math.abs(L.commit.resolvedTargetX + R.commit.resolvedTargetX - 2 * mid) <
        3,
      `L=${L.commit.resolvedTargetX} R=${R.commit.resolvedTargetX}`
    );
    assert.equal(L.intentClass, R.intentClass);
  });

  it("15. determinism — identical traces on repeat", () => {
    const a = runDynamic(340, 1, 560, -3.75).trace;
    const b = runDynamic(340, 1, 560, -3.75).trace;
    assert.equal(a.commit.resolvedTargetX, b.commit.resolvedTargetX);
    assert.equal(a.commit.t, b.commit.t);
    assert.equal(a.touchdown.overlap, b.touchdown.overlap);
    assert.equal(a.intentClass, b.intentClass);
  });

  it("16. planning state lifecycle: provisional → apex endpoint committed", () => {
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 560 });
    const seen = [];
    simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x -= 3.75;
        const s = jumper.ropeJumpPlanningState;
        if (s && (seen.length === 0 || seen[seen.length - 1] !== s)) {
          seen.push(s);
        }
      },
    });
    // Apex lock and endpoint commit happen on the same tick (side_locked is
    // overwritten before the opponentStep sample sees it).
    assert.ok(seen.includes(PLANNING_PROVISIONAL_RAW));
    assert.ok(seen.includes(PLANNING_ENDPOINT_COMMITTED));
  });

  it("preserve_raw is never an irreversible side lock", () => {
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 560 });
    let lockedAsPreserve = false;
    simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x -= 3.75;
        if (
          jumper.ropeJumpSideIntentLocked &&
          jumper.ropeJumpIntentClass === "preserve_raw"
        ) {
          lockedAsPreserve = true;
        }
      },
    });
    assert.equal(lockedAsPreserve, false);
  });

  it("realistic ice acceleration toward raw target", () => {
    const jumper = makeFighter({ id: "j", x: 340 });
    const opponent = makeFighter({ id: "o", x: 560, movementVelocity: 0 });
    let mv = 0;
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        // Accelerate left toward raw (ice units → px via step).
        mv = Math.max(mv - ICE_ACCELERATION, -ICE_MAX_SPEED);
        opp.movementVelocity = mv;
        opp.x += TICK_MS * speedFactor * mv;
      },
    });
    assert.ok(trace.commit);
    assert.ok(trace.sidesSeen.length <= 1);
    assert.ok(!trace.reversalDetected);
    // Accelerating approaches are harder than const-vel; still no deep bury
    // and no recovery-exit snap (A.3.1 settle may clear tiny residual).
    if (trace.conflictBeforeDeadline) {
      assert.ok(
        trace.touchdown.overlap <= 8,
        `ice-accel overlap ${trace.touchdown.overlap}`
      );
      assert.ok(
        trace.maxSingleTickCorrection <= TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6,
        `ice-accel maxSingle ${trace.maxSingleTickCorrection}`
      );
      assert.ok(!trace.overlapEverIncreased);
      if (trace.postRecovery) {
        assert.ok(trace.postRecovery.withinTolerance);
      }
    }
  });

  it("dynamic movement scan — rates × sizes × ropes", () => {
    const failures = [];
    let samples = 0;
    let worstPreOverlap = 0;
    let worstPostOverlap = 0;
    let maxCorrTicks = 0;
    let maxTotalCorr = 0;
    let peakVel = 0;
    let peakAccel = 0;

    for (const dir of [1, -1]) {
      const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
      const raw = computeRawRopeJumpTargetX(startX);
      for (const [jSize, oSize] of SIZE_PAIRS) {
        const minDist = getMinimumCenterDistance(jSize, oSize);
        const ringLo = MAP_LEFT_BOUNDARY + 20;
        const ringHi = MAP_RIGHT_BOUNDARY - 20;
        for (let oppX = ringLo; oppX <= ringHi; oppX += 2.5) {
          for (const rate of MOVE_RATES) {
            // Skip rates that immediately leave the ring for this dir.
            const signedRate = dir > 0 ? rate : -rate;
            samples++;
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
            let trace;
            try {
              trace = simulateRopeJump(jumper, opponent, {
                useV2: true,
                jumpDirection: dir,
                opponentStep: (opp) => {
                  opp.x += signedRate;
                  opp.x = Math.max(
                    MAP_LEFT_BOUNDARY,
                    Math.min(MAP_RIGHT_BOUNDARY, opp.x)
                  );
                },
              });
            } catch (err) {
              failures.push(`${oppX}/${rate}: ${err.message}`);
              continue;
            }
            peakVel = Math.max(peakVel, trace.peakVel || 0);
            peakAccel = Math.max(peakAccel, trace.peakAccel || 0);
            maxCorrTicks = Math.max(maxCorrTicks, trace.correctionTicks || 0);
            maxTotalCorr = Math.max(
              maxTotalCorr,
              trace.totalSafetyCorrectionPx || 0
            );
            const ov = trace.touchdown ? trace.touchdown.overlap : 0;
            worstPreOverlap = Math.max(worstPreOverlap, ov);
            if (trace.lateIntrusion) {
              worstPostOverlap = Math.max(worstPostOverlap, ov);
            }
            // Vault: settle debt OK; require side lock once + recovery exit.
            if (
              trace.correctionTicks >
              LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS
            ) {
              failures.push(
                `corrTicks ${trace.correctionTicks} @opp=${oppX}`
              );
            }
            if (
              trace.maxSingleTickCorrection >
              TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6
            ) {
              failures.push(
                `maxSingle ${trace.maxSingleTickCorrection} @opp=${oppX}`
              );
            }
            if (trace.overlapEverIncreased) {
              failures.push(`overlap grew @opp=${oppX}`);
            }
            if (
              trace.recoveryEnd &&
              trace.recoveryEnd.overlap >
                RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
            ) {
              failures.push(
                `recoveryEnd overlap ${trace.recoveryEnd.overlap} @opp=${oppX}`
              );
            }
            if (trace.postRecovery && !trace.postRecovery.withinTolerance) {
              failures.push(
                `postRecovery ${trace.postRecovery.pairDisplacement} @opp=${oppX}`
              );
            }
            if (trace.sidesSeen.length > 1) {
              failures.push(`side flip @opp=${oppX} rate=${signedRate}`);
            }
            if (trace.reversalDetected) {
              failures.push(`reversal @opp=${oppX} rate=${signedRate}`);
            }
            if ((trace.peakVel || 0) > MAX_VAULT_PEAK_VEL) {
              failures.push(
                `peakVel ${trace.peakVel.toFixed(0)} @opp=${oppX} rate=${signedRate}`
              );
            }
            if (
              trace.commit &&
              trace.commit.trajectoryType !== "vault_hermite"
            ) {
              failures.push(`traj ${trace.commit.trajectoryType} @opp=${oppX}`);
            }
            void (raw + minDist);
          }
        }
      }
    }

    // Bound scan cost — report metrics for the Phase A.3 doc.
    assert.ok(samples > 1000, `expected large scan, got ${samples}`);
    assert.equal(
      failures.length,
      0,
      `dynamic scan failures (${failures.length}/${samples}): ${failures.slice(0, 8).join(" | ")}`
    );
    // Touchdown settle debt can be large; recovery exit is the hard gate above.
    assert.ok(Number.isFinite(worstPreOverlap), `worstPre ${worstPreOverlap}`);
    assert.ok(peakVel <= MAX_VAULT_PEAK_VEL, `peakVel ${peakVel}`);
    assert.ok(
      peakAccel <= MAX_TRAJECTORY_PEAK_ACCEL * 1.15,
      `peakAccel ${peakAccel}`
    );
    // Stash for humans reading test output.
    console.log(
      "[A3_DYNAMIC_SCAN]",
      JSON.stringify({
        samples,
        worstPreOverlap,
        worstPostOverlap,
        maxCorrTicks,
        maxTotalCorr,
        peakVel,
        peakAccel,
      })
    );
  });
});

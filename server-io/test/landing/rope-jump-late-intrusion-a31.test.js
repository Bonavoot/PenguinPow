"use strict";

/**
 * Phase A.3.1 — late-intrusion resolution + recovery-exit stability.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  TICK_MS,
  makeFighter,
  simulateRopeJump,
  createIceMotionController,
  overlapOf,
  getMinimumCenterDistance,
  ICE_MAX_SPEED,
  ICE_ACCELERATION,
  ICE_BRAKE_FRICTION,
  ICE_STOP_THRESHOLD,
  ICE_TURN_BURST,
  ICE_COAST_FRICTION,
  ICE_PX_PER_VEL_UNIT,
} = require("./helpers/ropeJumpSim");
const {
  adjustPlayerPositions,
} = require("../../gameFunctions");
const {
  beginLandingSettle,
  resolveLandingSeparationOrdering,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
  LANDING_SETTLE_MAX_PX_PER_TICK,
  LANDING_SETTLE_OVERLAP_EPS_PX,
  SIDE_POLICY_PRESERVE_ACTUAL,
  SIDE_POLICY_INTENT_COINCIDENT,
  SIDE_POLICY_INTENDED_SIDE_ACHIEVABLE,
  BUDGET_EXCEPTION_DYNAMIC_COMMIT,
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
  MAX_TRAJECTORY_PEAK_VEL,
} = require("../../landingResolution");

function assertRecoveryExitStable(trace, label) {
  assert.ok(trace.recoveryEnd, `${label}: missing recoveryEnd`);
  assert.ok(
    trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
    `${label}: recoveryEnd overlap ${trace.recoveryEnd.overlap}`
  );
  assert.ok(trace.postRecovery, `${label}: missing postRecovery`);
  assert.ok(
    trace.postRecovery.withinTolerance,
    `${label}: postRecovery pair ${trace.postRecovery.pairDisplacement}`
  );
  assert.ok(
    trace.postRecovery.overlapAfter <=
      RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
    `${label}: postRecovery overlap ${trace.postRecovery.overlapAfter}`
  );
  assert.equal(
    trace.postRecovery.sideBefore,
    trace.postRecovery.sideAfter,
    `${label}: side flip on post-recovery tick`
  );
  assert.ok(!trace.overlapEverIncreased, `${label}: overlap increased`);
  assert.ok(
    trace.maxSingleTickCorrection <= LANDING_SETTLE_MAX_PX_PER_TICK + 1e-6,
    `${label}: maxSingle ${trace.maxSingleTickCorrection}`
  );
  assert.ok(
    trace.correctionTicks <= LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
    `${label}: corrTicks ${trace.correctionTicks}`
  );
  for (const s of trace.settleTicks) {
    assert.ok(
      s.overlapAfter <= s.overlapBefore + 1e-9,
      `${label}: settle grew overlap ${s.overlapBefore}→${s.overlapAfter}`
    );
  }
}

describe("Phase A.3.1 late-intrusion + recovery-exit", () => {
  it("Case 1 — realistic late intrusion (340/590/−3.75, size 0.70)", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.7 });
    const opponent = makeFighter({ id: "o", x: 590, sizeMultiplier: 0.7 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x -= 3.75;
      },
    });
    assert.ok(trace.lateIntrusion, "must classify late intrusion");
    assert.ok(trace.touchdown.overlap > 40, `touch overlap ${trace.touchdown.overlap}`);
    // Before A.3.1: 1×18 then ~27 residual → 27 post-recovery snap.
    assert.ok(trace.recoveryEnd.overlap < 1);
    assert.ok(trace.postRecovery.pairDisplacement < 1);
    assertRecoveryExitStable(trace, "case1-left");
  });

  it("Case 1R — mirror from right rope", () => {
    const jumper = makeFighter({ id: "j", x: 935, sizeMultiplier: 0.7 });
    const opponent = makeFighter({ id: "o", x: 685, sizeMultiplier: 0.7 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: -1,
      opponentStep: (opp) => {
        opp.x += 3.75;
      },
    });
    assert.ok(trace.lateIntrusion);
    assertRecoveryExitStable(trace, "case1-right");
  });

  it("Case 2 — moderate late intrusion (~20–30 px touchdown overlap)", () => {
    // Preserved production sample: size 0.70, opp 564, −2 px/tick → ~23 px.
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.7 });
    const opponent = makeFighter({ id: "o", x: 564, sizeMultiplier: 0.7 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x -= 2;
      },
    });
    assert.ok(trace.lateIntrusion);
    assert.ok(
      trace.touchdown.overlap >= 20 && trace.touchdown.overlap <= 30,
      `touch overlap ${trace.touchdown.overlap}`
    );
    assertRecoveryExitStable(trace, "case2-moderate");
  });

  it("Case 3 — direction-tiebreaker stress never grows overlap", () => {
    const jumper = makeFighter({
      id: "j",
      x: 438.175,
      sizeMultiplier: 0.85,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: 1,
      ropeJumpLateIntrusion: true,
      ropeJumpLandingPath: "v2",
      ropeJumpResolvedSide: 1,
    });
    const opponent = makeFighter({ id: "o", x: 460, sizeMultiplier: 0.85 });
    const minD = getMinimumCenterDistance(0.85, 0.85);
    assert.ok(Math.abs(minD - 110.5) < 1e-9);
    const before = overlapOf(jumper, opponent);
    assert.ok(Math.abs(before - 88.675) < 0.01, `before ${before}`);
    beginLandingSettle(jumper, opponent);
    assert.equal(jumper.ropeJumpSidePolicy, SIDE_POLICY_PRESERVE_ACTUAL);
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    const after = overlapOf(jumper, opponent);
    assert.ok(after < before - 1e-6, `overlap ${before}→${after}`);
    assert.ok(after < 100, "must not grow toward ~106.7");
    assert.equal(jumper.ropeJumpOverlapIncreased, false);

    // Full event via rapid post-commit dive that recreates deep bury.
    const j2 = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const o2 = makeFighter({ id: "o", x: 700, sizeMultiplier: 0.85 });
    const full = simulateRopeJump(j2, o2, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        if (j2.ropeJumpLandingCommitted) {
          opp.x = 460;
        }
      },
    });
    assert.ok(full.lateIntrusion);
    assert.ok(!full.overlapEverIncreased);
    assertRecoveryExitStable(full, "case3-full");
  });

  it("Case 3R — tiebreaker stress mirrored", () => {
    const jumper = makeFighter({
      id: "j",
      x: 836.825,
      sizeMultiplier: 0.85,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: -1,
      ropeJumpLateIntrusion: true,
      ropeJumpLandingPath: "v2",
      ropeJumpResolvedSide: -1,
    });
    const opponent = makeFighter({ id: "o", x: 815, sizeMultiplier: 0.85 });
    const before = overlapOf(jumper, opponent);
    beginLandingSettle(jumper, opponent);
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    const after = overlapOf(jumper, opponent);
    assert.ok(after < before - 1e-6);
    assert.equal(jumper.ropeJumpSidePolicy, SIDE_POLICY_PRESERVE_ACTUAL);
  });

  it("Case 4 — exact same center uses intent and increases separation", () => {
    for (const dir of [1, -1]) {
      const jumper = makeFighter({
        id: "j",
        x: 500,
        sizeMultiplier: 0.85,
        isRopeJumping: true,
        ropeJumpPhase: "landing",
        ropeJumpDirection: dir,
        ropeJumpLateIntrusion: true,
        ropeJumpLandingPath: "v2",
      });
      const opponent = makeFighter({ id: "o", x: 500, sizeMultiplier: 0.85 });
      const ordering = resolveLandingSeparationOrdering(
        jumper,
        opponent,
        jumper
      );
      assert.equal(ordering.sidePolicy, SIDE_POLICY_INTENT_COINCIDENT);
      assert.equal(ordering.usedIntent, true);
      beginLandingSettle(jumper, opponent);
      const distBefore = Math.abs(jumper.x - opponent.x);
      adjustPlayerPositions(jumper, opponent, TICK_MS);
      const distAfter = Math.abs(jumper.x - opponent.x);
      assert.ok(distAfter > distBefore + 1e-6, `dir=${dir}`);
      assert.ok(Number.isFinite(jumper.x) && Number.isFinite(opponent.x));
      assert.equal(jumper.ropeJumpOverlapIncreased, false);
    }
    // Mirror symmetry of intent choice
    const L = makeFighter({
      id: "j",
      x: 500,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: 1,
      ropeJumpLandingPath: "v2",
    });
    const R = makeFighter({
      id: "j",
      x: 500,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: -1,
      ropeJumpLandingPath: "v2",
    });
    const oL = makeFighter({ id: "o", x: 500 });
    const oR = makeFighter({ id: "o", x: 500 });
    beginLandingSettle(L, oL);
    beginLandingSettle(R, oR);
    assert.equal(L.ropeJumpSettleJumperIsLeft, false);
    assert.equal(R.ropeJumpSettleJumperIsLeft, true);
  });

  it("Case 5 — anchored opponent: jumper settles alone, exit stable", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.7 });
    const opponent = makeFighter({
      id: "o",
      x: 590,
      sizeMultiplier: 0.7,
      isHit: true,
    });
    const oppStart = opponent.x;
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        opp.x -= 3.75;
      },
    });
    // During settle, anchored opponent share is 0 — x may still move from
    // active-phase scripted motion, but post-touchdown corrections should not.
    if (trace.settleTicks.length) {
      for (const s of trace.settleTicks) {
        assert.ok(
          Math.abs(s.opponentDelta) < 1e-9,
          `anchored opp moved ${s.opponentDelta}`
        );
      }
    }
    assert.ok(trace.lateIntrusion);
    assertRecoveryExitStable(trace, "case5");
    assert.ok(Number.isFinite(oppStart));
  });

  it("Case 6 — anchored jumper: no overlap increase", () => {
    const jumper = makeFighter({
      id: "j",
      x: 435.24,
      sizeMultiplier: 0.7,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: 1,
      ropeJumpLateIntrusion: true,
      ropeJumpLandingPath: "v2",
      isHit: true,
    });
    const opponent = makeFighter({ id: "o", x: 481.25, sizeMultiplier: 0.7 });
    beginLandingSettle(jumper, opponent);
    const before = overlapOf(jumper, opponent);
    const jBefore = jumper.x;
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    const after = overlapOf(jumper, opponent);
    assert.ok(after <= before + 1e-9);
    assert.ok(Math.abs(jumper.x - jBefore) < 1e-9, "anchored jumper moved");
  });

  it("Case 7 — both anchored: report residual honestly if unresolvable", () => {
    const jumper = makeFighter({
      id: "j",
      x: 435.24,
      sizeMultiplier: 0.7,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: 1,
      ropeJumpLateIntrusion: true,
      ropeJumpLandingPath: "v2",
      isHit: true,
    });
    const opponent = makeFighter({
      id: "o",
      x: 481.25,
      sizeMultiplier: 0.7,
      isHit: true,
    });
    beginLandingSettle(jumper, opponent);
    // Both-anchored still uses 0.5/0.5 shares in adjustPlayerPositions — they
    // can separate. Assert monotonicity and classify policy.
    const before = overlapOf(jumper, opponent);
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    const after = overlapOf(jumper, opponent);
    assert.ok(after <= before + 1e-9);
    assert.ok(
      jumper.ropeJumpSidePolicy === SIDE_POLICY_PRESERVE_ACTUAL ||
        jumper.ropeJumpSidePolicy === SIDE_POLICY_INTENDED_SIDE_ACHIEVABLE
    );
  });

  it("Case 8 — boundary constrained late intrusion, unequal sizes", () => {
    for (const dir of [1, -1]) {
      const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
      const jumper = makeFighter({
        id: "j",
        x: startX,
        sizeMultiplier: 1.0,
      });
      const oppX = dir > 0 ? startX + 80 : startX - 80;
      const opponent = makeFighter({
        id: "o",
        x: oppX,
        sizeMultiplier: 0.7,
      });
      const trace = simulateRopeJump(jumper, opponent, {
        useV2: true,
        jumpDirection: dir,
        opponentStep: (opp) => {
          if (jumper.ropeJumpLandingCommitted) {
            // Force into locked cell near the rope.
            opp.x = dir > 0 ? jumper.ropeJumpResolvedTargetX + 10 : jumper.ropeJumpResolvedTargetX - 10;
            opp.x = Math.max(
              MAP_LEFT_BOUNDARY,
              Math.min(MAP_RIGHT_BOUNDARY, opp.x)
            );
          }
        },
      });
      assert.ok(trace.commit);
      assert.ok(!trace.overlapEverIncreased, `dir=${dir}`);
      assert.ok(
        jumper.x >= MAP_LEFT_BOUNDARY - 1e-9 &&
          jumper.x <= MAP_RIGHT_BOUNDARY + 1e-9
      );
      assert.ok(
        opponent.x >= MAP_LEFT_BOUNDARY - 1e-9 &&
          opponent.x <= MAP_RIGHT_BOUNDARY + 1e-9
      );
      if (trace.lateIntrusion) {
        assert.ok(
          trace.maxSingleTickCorrection <= LANDING_SETTLE_MAX_PX_PER_TICK + 1e-6
        );
        // Boundary may leave tiny residual; post-recovery must stay bounded.
        if (trace.postRecovery) {
          assert.ok(
            trace.postRecovery.pairDisplacement <=
              TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1e-6,
            `dir=${dir} post ${trace.postRecovery.pairDisplacement}`
          );
        }
      }
    }
  });

  it("correction-direction invariant rejects overlap-growing intent", () => {
    const jumper = makeFighter({
      id: "j",
      x: 438.175,
      sizeMultiplier: 0.85,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpDirection: 1,
      ropeJumpLandingPath: "v2",
      ropeJumpResolvedSide: 1,
    });
    const opponent = makeFighter({ id: "o", x: 460, sizeMultiplier: 0.85 });
    const ord = resolveLandingSeparationOrdering(jumper, opponent, jumper);
    // Actual: jumper left. Intent wanted right — must preserve actual.
    assert.equal(ord.jumperIsLeft, true);
    assert.equal(ord.sidePolicy, SIDE_POLICY_PRESERVE_ACTUAL);
    assert.equal(ord.usedIntent, false);
  });

  it("production-faithful ice profiles — settle exit stable when late", () => {
    const profiles = [
      {
        name: "full-speed-then-brake",
        startOpp: 547,
        initVel: -ICE_MAX_SPEED,
        step: (ctrl, tick) => {
          if (tick < 15) ctrl.setVel(-ICE_MAX_SPEED);
          else ctrl.brake();
        },
      },
      {
        name: "full-speed-then-reverse",
        startOpp: 560,
        initVel: -ICE_MAX_SPEED,
        step: (ctrl, tick) => {
          if (tick < 12) ctrl.setVel(-ICE_MAX_SPEED);
          else if (tick === 12) ctrl.reverseBurst(1);
          else ctrl.accelerate(1);
        },
      },
      {
        name: "coast-through-landing",
        startOpp: 560,
        initVel: -ICE_MAX_SPEED,
        step: (ctrl) => {
          ctrl.coast();
        },
      },
      {
        name: "brief-conflict-clears",
        startOpp: 520,
        initVel: -0.4,
        step: (ctrl, tick) => {
          if (tick < 8) ctrl.accelerate(-1);
          else ctrl.accelerate(1);
        },
      },
      {
        name: "conflict-persists",
        startOpp: 560,
        initVel: -ICE_MAX_SPEED,
        step: (ctrl) => {
          ctrl.setVel(-ICE_MAX_SPEED);
        },
      },
      {
        name: "knocked-into-zone",
        startOpp: 700,
        initVel: 0,
        step: (ctrl, tick, jumper) => {
          if (jumper.ropeJumpLandingCommitted && tick > 0) {
            ctrl.setVel(-ICE_MAX_SPEED);
          }
        },
      },
      {
        name: "knocked-out-after-side-lock",
        startOpp: 560,
        initVel: -ICE_MAX_SPEED,
        step: (ctrl, tick, jumper) => {
          if (jumper.ropeJumpSideIntentLocked) {
            ctrl.setVel(ICE_MAX_SPEED);
          } else {
            ctrl.setVel(-ICE_MAX_SPEED);
          }
        },
      },
      {
        name: "move-change-before-commit",
        startOpp: 555,
        initVel: -ICE_MAX_SPEED,
        step: (ctrl, tick, jumper) => {
          if (!jumper.ropeJumpLandingCommitted && tick > 10) {
            ctrl.brake();
          } else if (!jumper.ropeJumpLandingCommitted) {
            ctrl.setVel(-ICE_MAX_SPEED);
          }
        },
      },
      {
        name: "move-change-after-commit",
        startOpp: 600,
        initVel: 0,
        step: (ctrl, tick, jumper) => {
          if (jumper.ropeJumpLandingCommitted) {
            ctrl.setVel(-ICE_MAX_SPEED);
          }
        },
      },
    ];

    assert.ok(profiles.length >= 9);
    assert.ok(ICE_ACCELERATION > 0);
    assert.ok(ICE_BRAKE_FRICTION > 0);
    assert.ok(ICE_COAST_FRICTION > 0);
    assert.ok(ICE_TURN_BURST > 0);
    assert.ok(ICE_STOP_THRESHOLD > 0);
    assert.ok(ICE_PX_PER_VEL_UNIT > 0);

    for (const dir of [1, -1]) {
      for (const profile of profiles) {
        const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
        const startOpp =
          dir > 0
            ? profile.startOpp
            : MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY - profile.startOpp;
        const jumper = makeFighter({ id: "j", x: startX, sizeMultiplier: 0.85 });
        const opponent = makeFighter({
          id: "o",
          x: startOpp,
          sizeMultiplier: 0.85,
          movementVelocity: dir > 0 ? profile.initVel : -profile.initVel,
        });
        const ctrl = createIceMotionController(
          dir > 0 ? profile.initVel : -profile.initVel
        );
        let tick = 0;
        const trace = simulateRopeJump(jumper, opponent, {
          useV2: true,
          jumpDirection: dir,
          opponentStep: (opp) => {
            tick++;
            profile.step(ctrl, tick, jumper);
            ctrl.apply(opp);
          },
        });
        const label = `${profile.name}/dir=${dir}`;
        assert.ok(trace.commit, label);
        assert.ok(!trace.overlapEverIncreased, label);
        assert.ok(trace.sidesSeen.length <= 1, label);
        if (trace.lateIntrusion) {
          assertRecoveryExitStable(trace, label);
        } else if (trace.postRecovery) {
          assert.ok(
            trace.postRecovery.withinTolerance ||
              trace.postRecovery.pairDisplacement <=
                LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6,
            `${label}: unexpected post ${trace.postRecovery.pairDisplacement}`
          );
        }
      }
    }
  });

  it("exact full-speed brake profile — budget exception classified honestly", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({
      id: "o",
      x: 547,
      sizeMultiplier: 0.85,
      movementVelocity: -ICE_MAX_SPEED,
    });
    const ctrl = createIceMotionController(-ICE_MAX_SPEED);
    let tick = 0;
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp) => {
        tick++;
        if (tick < 15) ctrl.setVel(-ICE_MAX_SPEED);
        else ctrl.brake();
        ctrl.apply(opp);
      },
    });
    assert.ok(trace.commit);
    assert.ok(Math.abs(trace.commit.resolvedTargetX - 615.09) < 1.0);
    assert.ok(trace.peakVel > MAX_TRAJECTORY_PEAK_VEL);
    assert.ok(trace.peakVel < 1600);
    // Must not silently claim withinBudget when feasibility says otherwise.
    assert.equal(trace.budgetException, true);
    assert.equal(trace.budgetExceptionClass, BUDGET_EXCEPTION_DYNAMIC_COMMIT);
    assert.equal(trace.commit.feasibility.withinBudget, false);
    assert.equal(trace.commit.feasibility.withinPlannerBudget, false);
    assert.ok(trace.touchdown.overlap <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6);
    assert.ok(!trace.reversalDetected);
    assert.ok(!trace.overlapEverIncreased);
    if (trace.postRecovery) {
      assert.ok(trace.postRecovery.withinTolerance);
    }

    // Mirror
    const jR = makeFighter({ id: "j", x: 935, sizeMultiplier: 0.85 });
    const oR = makeFighter({
      id: "o",
      x: MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY - 547,
      sizeMultiplier: 0.85,
      movementVelocity: ICE_MAX_SPEED,
    });
    const ctrlR = createIceMotionController(ICE_MAX_SPEED);
    let tickR = 0;
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const mirror = simulateRopeJump(jR, oR, {
      useV2: true,
      jumpDirection: -1,
      opponentStep: (opp) => {
        tickR++;
        if (tickR < 15) ctrlR.setVel(ICE_MAX_SPEED);
        else ctrlR.brake();
        ctrlR.apply(opp);
      },
    });
    assert.ok(mirror.budgetException);
    assert.ok(
      Math.abs(trace.commit.resolvedTargetX + mirror.commit.resolvedTargetX - 2 * mid) < 3
    );
  });

  it("recovery-exit scan — late intrusion samples leave negligible next-tick correction", () => {
    const failures = [];
    let lateSamples = 0;
    for (const dir of [1, -1]) {
      const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
      for (let oppX = 420; oppX <= 720; oppX += 5) {
        const jumper = makeFighter({ id: "j", x: startX, sizeMultiplier: 0.7 });
        const opponent = makeFighter({
          id: "o",
          x: dir > 0 ? oppX : MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY - oppX,
          sizeMultiplier: 0.7,
        });
        const rate = dir > 0 ? -3.75 : 3.75;
        const trace = simulateRopeJump(jumper, opponent, {
          useV2: true,
          jumpDirection: dir,
          opponentStep: (opp) => {
            opp.x += rate;
          },
        });
        if (!trace.lateIntrusion) continue;
        lateSamples++;
        if (trace.overlapEverIncreased) {
          failures.push(`grew @${oppX}`);
        }
        if (
          !trace.postRecovery ||
          !trace.postRecovery.withinTolerance
        ) {
          failures.push(
            `post ${trace.postRecovery && trace.postRecovery.pairDisplacement} @${oppX}`
          );
        }
        if (
          trace.recoveryEnd &&
          trace.recoveryEnd.overlap > RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
        ) {
          failures.push(`endOv ${trace.recoveryEnd.overlap} @${oppX}`);
        }
      }
    }
    assert.ok(lateSamples > 0, "expected late-intrusion samples");
    assert.equal(failures.length, 0, failures.slice(0, 8).join("; "));
  });
});

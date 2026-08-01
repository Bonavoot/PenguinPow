"use strict";

/**
 * Phase A.3.2 — recovery re-intrusion + release-tick stability.
 *
 * Sticky `recovery_safe_to_release` must not suppress newly created overlap
 * during landing recovery. Production order: pushbox → clear → movement.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  TICK_MS,
  makeFighter,
  simulateRopeJump,
  overlapOf,
  sideOrdering,
  getMinimumCenterDistance,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
  LANDING_SETTLE_OVERLAP_EPS_PX,
  SETTLE_RECOVERY_CLEAR_MONITORING,
  SETTLE_LANDING_SETTLE_ACTIVE,
  ROPE_JUMP_LANDING_RECOVERY_MS,
} = require("./helpers/ropeJumpSim");
const {
  beginLandingSettle,
  reactivateLandingSettle,
  isLandingRecoveryMonitoringState,
  LANDING_SETTLE_MAX_PX_PER_TICK,
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
} = require("../../landingResolution");
const { adjustPlayerPositions } = require("../../gameFunctions");
const {
  ROPE_JUMP_LANDING_V2,
  setRopeJumpFlightCurveV3ForTests,
} = require("../../landingFlags");

// A.3.2 fixtures assert pre-V3 base-raw free-flight endpoints.
beforeEach(() => setRopeJumpFlightCurveV3ForTests(false));
afterEach(() => setRopeJumpFlightCurveV3ForTests(null));

const ORDINARY_FULL_SPEED = 3.75;
const ORDINARY_CORR_SLACK = 0.05;

function assertNoReleaseSnap(trace, label, maxOrdinaryCorr) {
  assert.ok(trace.recoveryEnd, `${label}: missing recoveryEnd`);
  assert.ok(
    trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
    `${label}: recoveryEnd overlap ${trace.recoveryEnd.overlap}`
  );
  assert.ok(trace.cleanupTick, `${label}: missing cleanupTick`);
  assert.ok(
    trace.cleanupTick.pairDisplacement <= maxOrdinaryCorr + ORDINARY_CORR_SLACK,
    `${label}: cleanupTick disp ${trace.cleanupTick.pairDisplacement}`
  );
  assert.ok(trace.postRecovery, `${label}: missing postRecovery`);
  assert.ok(
    trace.postRecovery.withinTolerance,
    `${label}: grounded snap ${trace.postRecovery.pairDisplacement}`
  );
  assert.ok(!trace.overlapEverIncreased, `${label}: overlap increased`);
  assert.equal(
    trace.postRecovery.sideBefore,
    trace.postRecovery.sideAfter,
    `${label}: side flip on grounded tick`
  );
}

function assertOrdinaryContactBudget(trace, label, rate) {
  const maxCorr = Math.abs(rate) + ORDINARY_CORR_SLACK;
  assert.ok(
    trace.maxRecoveryOverlap <= maxCorr + 1e-6,
    `${label}: maxRecoveryOverlap ${trace.maxRecoveryOverlap} > ${maxCorr}`
  );
  assert.ok(
    trace.maxRecoveryCorrection <= maxCorr + 1e-6,
    `${label}: maxRecoveryCorrection ${trace.maxRecoveryCorrection} > ${maxCorr}`
  );
  for (const s of trace.settleTicks) {
    assert.ok(
      s.overlapAfter <= s.overlapBefore + 1e-9,
      `${label}: overlap grew ${s.overlapBefore}→${s.overlapAfter}`
    );
  }
}

describe("Phase A.3.2 recovery re-intrusion", () => {
  it("V2 is enabled by default (approved); legacy still opt-out", () => {
    if (!process.env.ROPE_JUMP_LANDING_V2) {
      assert.equal(ROPE_JUMP_LANDING_V2, true);
    }
  });

  it("Case 1 — clear touchdown, full-speed recovery intrusion (left)", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const minDist = getMinimumCenterDistance(0.85, 0.85);
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: (opp) => {
        opp.x -= ORDINARY_FULL_SPEED;
      },
    });

    assert.ok(trace.touchdown, "touchdown");
    assert.ok(
      Math.abs(trace.touchdown.x - 438.175) < 0.5,
      `land X ${trace.touchdown.x}`
    );
    assert.ok(
      Math.abs(trace.touchdown.opponentX - 560) < 1e-6,
      `opp at touch ${trace.touchdown.opponentX}`
    );
    assert.ok(
      Math.abs(trace.touchdown.centerDistance - (560 - 438.175)) < 0.5
    );
    assert.equal(trace.touchdown.minDistance, minDist);
    assert.ok(
      trace.touchdown.overlap <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6,
      `touch overlap ${trace.touchdown.overlap}`
    );
    assert.equal(trace.touchdown.settleState, SETTLE_RECOVERY_CLEAR_MONITORING);
    assert.ok(trace.touchdown.monitoring);
    assert.ok(trace.settleReactivated, "must reactivate on intrusion");
    assert.ok(trace.settleEpisodeCount >= 1);
    assertOrdinaryContactBudget(trace, "case1-left", ORDINARY_FULL_SPEED);
    assertNoReleaseSnap(trace, "case1-left", ORDINARY_FULL_SPEED);
    // Pre-fix ignored collision so opp reached ~515 with ~33px debt. After
    // A.3.2, contact is maintained each tick so opp ends farther (pushed back).
    assert.ok(
      opponent.x > 515,
      `opp should be held out of deep bury, got ${opponent.x}`
    );
  });

  it("Case 1R — full-speed recovery intrusion (right mirror)", () => {
    const jumper = makeFighter({ id: "j", x: 935, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 715, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: -1,
      landingOpponentStep: (opp) => {
        opp.x += ORDINARY_FULL_SPEED;
      },
    });
    assert.ok(
      trace.touchdown.overlap <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6
    );
    assert.equal(trace.touchdown.settleState, SETTLE_RECOVERY_CLEAR_MONITORING);
    assert.ok(trace.settleReactivated);
    assertOrdinaryContactBudget(trace, "case1-right", ORDINARY_FULL_SPEED);
    assertNoReleaseSnap(trace, "case1-right", ORDINARY_FULL_SPEED);
  });

  it("Case 2 — slower recovery intrusion (−2 px/tick)", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: (opp) => {
        opp.x -= 2;
      },
    });
    assert.equal(trace.touchdown.settleState, SETTLE_RECOVERY_CLEAR_MONITORING);
    assert.ok(trace.settleReactivated);
    assertOrdinaryContactBudget(trace, "case2", 2);
    assertNoReleaseSnap(trace, "case2", 2);
  });

  it("Case 3 — intrusion begins halfway through recovery", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: (opp, recoveryT) => {
        if (recoveryT >= 0.5) opp.x -= ORDINARY_FULL_SPEED;
      },
    });
    assert.ok(trace.settleReactivated);
    assertOrdinaryContactBudget(trace, "case3", ORDINARY_FULL_SPEED);
    assertNoReleaseSnap(trace, "case3", ORDINARY_FULL_SPEED);
    // First half of recovery ticks should stay clear.
    const early = trace.recoveryTicks.filter((r) => r.recoveryT < 0.5);
    assert.ok(early.length > 0);
    for (const r of early) {
      assert.ok(
        r.overlapAfterMove <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6,
        `early ov ${r.overlapAfterMove}`
      );
    }
  });

  it("Case 4 — intrusion on the final recovery tick", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: (opp, recoveryT) => {
        // Clearance at touchdown is ~11.3px — enter by a small amount on the
        // last pre-clear recovery step (~0.915 of the window).
        if (recoveryT >= 0.88) opp.x -= 14;
      },
    });
    assert.ok(
      trace.maxRecoveryOverlap > LANDING_SETTLE_OVERLAP_EPS_PX,
      "final-tick intrusion must create owned contact"
    );
    // Cleanup tick owns/resolves the contact (production: pushbox before clear).
    assert.ok(trace.cleanupTick);
    assert.ok(
      trace.cleanupTick.overlapAfter <=
        RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
      `cleanup left ov ${trace.cleanupTick.overlapAfter}`
    );
    assert.ok(
      trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
    );
    assert.ok(
      trace.postRecovery.pairDisplacement <=
        RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
    );
    // Recovery duration unchanged — clear within authored window.
    assert.ok(
      trace.cleanupTick.now - trace.touchdown.now >=
        ROPE_JUMP_LANDING_RECOVERY_MS - TICK_MS - 1e-6
    );
    assert.ok(
      trace.cleanupTick.now - trace.touchdown.now <=
        ROPE_JUMP_LANDING_RECOVERY_MS + TICK_MS + 1e-6
    );
  });

  it("Case 5 — settle completes, then re-intrusion", () => {
    const jumper = makeFighter({
      id: "j",
      x: 438.175,
      sizeMultiplier: 0.85,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpLandingPath: "v2",
      ropeJumpDirection: 1,
      ropeJumpLandingTime: 100000,
      ropeJumpResolvedSide: 1,
    });
    const opponent = makeFighter({ id: "o", x: 500, sizeMultiplier: 0.85 });
    // Touchdown overlap ~48.675
    beginLandingSettle(jumper, opponent);
    assert.equal(jumper.ropeJumpSettleState, SETTLE_LANDING_SETTLE_ACTIVE);
    // Drain initial settle.
    for (let i = 0; i < 20; i++) {
      adjustPlayerPositions(jumper, opponent, TICK_MS);
      if (isLandingRecoveryMonitoringState(jumper.ropeJumpSettleState)) break;
    }
    assert.ok(
      isLandingRecoveryMonitoringState(jumper.ropeJumpSettleState),
      `after settle: ${jumper.ropeJumpSettleState}`
    );
    assert.ok(overlapOf(jumper, opponent) <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6);
    const sideAfterSettle = sideOrdering(jumper, opponent);
    // Walk back into jumper.
    opponent.x = jumper.x + getMinimumCenterDistance(0.85, 0.85) - 8;
    const ov = overlapOf(jumper, opponent);
    assert.ok(ov > 1, `re-intrusion ov ${ov}`);
    const before = jumper.ropeJumpSettleState;
    const re = reactivateLandingSettle(jumper, opponent);
    assert.ok(re);
    assert.equal(jumper.ropeJumpSettleState, SETTLE_LANDING_SETTLE_ACTIVE);
    assert.ok(isLandingRecoveryMonitoringState(before));
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    assert.ok(
      overlapOf(jumper, opponent) <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6
    );
    assert.equal(sideOrdering(jumper, opponent), sideAfterSettle);
  });

  it("Case 6 — repeated enter / leave / re-enter", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const sideAtTouch = { v: null };
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: (opp, recoveryT, now, tr) => {
        if (sideAtTouch.v == null && tr.touchdown) {
          sideAtTouch.v = tr.touchdown.sideOrdering;
        }
        // Enter → leave → re-enter across recovery.
        if (recoveryT < 0.3) opp.x -= ORDINARY_FULL_SPEED;
        else if (recoveryT < 0.55) opp.x += ORDINARY_FULL_SPEED;
        else opp.x -= ORDINARY_FULL_SPEED;
      },
    });
    assert.ok(trace.settleEpisodeCount >= 1);
    assert.ok(!trace.overlapEverIncreased);
    assertOrdinaryContactBudget(trace, "case6", ORDINARY_FULL_SPEED);
    assertNoReleaseSnap(trace, "case6", ORDINARY_FULL_SPEED);
    // No oscillating side policy across settle ticks.
    const sides = trace.settleTicks.map((s) => s.sideAfter);
    for (let i = 1; i < sides.length; i++) {
      assert.equal(sides[i], sides[0], `side oscillated ${sides}`);
    }
  });

  it("Case 7 — opponent knockback into recovering jumper", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    let knocked = false;
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: (opp, recoveryT) => {
        if (!knocked && recoveryT >= 0.2) {
          // Sudden legitimate displacement into the landing footprint.
          opp.x = 438.175 + 40;
          knocked = true;
        }
      },
    });
    assert.ok(trace.settleReactivated || trace.maxRecoveryOverlap > 18);
    assert.ok(trace.maxRecoveryOverlap > 18, "deep intrusion classified");
    for (const s of trace.settleTicks) {
      assert.ok(s.overlapAfter <= s.overlapBefore + 1e-9);
      assert.ok(
        s.pairDisplacement <= LANDING_SETTLE_MAX_PX_PER_TICK + 1e-6
      );
    }
    assert.ok(
      trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
      `recoveryEnd ov ${trace.recoveryEnd.overlap}`
    );
    assert.ok(
      trace.postRecovery.pairDisplacement <=
        RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6,
      `grounded snap ${trace.postRecovery.pairDisplacement}`
    );
    assert.ok(!trace.overlapEverIncreased);
  });

  it("Case 8 — anchored opponent during recovery intrusion", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({
      id: "o",
      x: 560,
      sizeMultiplier: 0.85,
      isHit: true,
    });
    // Anchored opponent cannot walk; use synthetic displacement of jumper
    // contact via settle against fixed body — walk a ghost offset by moving
    // jumper via re-intrusion helper after clear land.
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      landingOpponentStep: () => {
        /* anchored — no voluntary move */
      },
    });
    // Force re-intrusion by teleporting anchored body (knockback-like).
    // Re-run a focused settle: clear land, then shove anchored opp in.
    const j2 = makeFighter({
      id: "j2",
      x: 438.175,
      sizeMultiplier: 0.85,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpLandingPath: "v2",
      ropeJumpDirection: 1,
      ropeJumpLandingTime: 100000,
    });
    const o2 = makeFighter({
      id: "o2",
      x: 560,
      sizeMultiplier: 0.85,
      isHit: true,
    });
    beginLandingSettle(j2, o2);
    assert.ok(isLandingRecoveryMonitoringState(j2.ropeJumpSettleState));
    o2.x = 438.175 + 80;
    reactivateLandingSettle(j2, o2);
    const ox = o2.x;
    adjustPlayerPositions(j2, o2, TICK_MS);
    // Anchored opponent should not be shoved (share 0).
    assert.equal(o2.x, ox);
    assert.ok(j2.x !== 438.175 || overlapOf(j2, o2) < 80);
    assert.ok(overlapOf(j2, o2) < overlapOf(
      { ...j2, x: 438.175 },
      { ...o2, x: ox }
    ) + 1e-6 || overlapOf(j2, o2) <= LANDING_SETTLE_MAX_PX_PER_TICK);
    assert.ok(trace.touchdown.overlap <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6);
  });

  it("Case 9 — anchored jumper during recovery intrusion", () => {
    const jumper = makeFighter({
      id: "j",
      x: 438.175,
      sizeMultiplier: 0.85,
      isRopeJumping: true,
      ropeJumpPhase: "landing",
      ropeJumpLandingPath: "v2",
      ropeJumpDirection: 1,
      ropeJumpLandingTime: 100000,
      isHit: true,
    });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    beginLandingSettle(jumper, opponent);
    assert.ok(isLandingRecoveryMonitoringState(jumper.ropeJumpSettleState));
    const jx = jumper.x;
    opponent.x = 438.175 + 90;
    reactivateLandingSettle(jumper, opponent);
    const ovBefore = overlapOf(jumper, opponent);
    adjustPlayerPositions(jumper, opponent, TICK_MS);
    assert.equal(jumper.x, jx, "anchored jumper must not move");
    assert.ok(overlapOf(jumper, opponent) <= ovBefore + 1e-9);
  });

  it("Case 10 — boundary constrained, both ropes, unequal sizes", () => {
    const cases = [
      {
        jx: 340,
        ox: 420,
        js: 1.0,
        os: 0.7,
        dir: 1,
        step: (o) => {
          o.x -= 2;
        },
      },
      {
        jx: 935,
        ox: 855,
        js: 0.7,
        os: 1.0,
        dir: -1,
        step: (o) => {
          o.x += 2;
        },
      },
    ];
    for (const c of cases) {
      const jumper = makeFighter({
        id: "j",
        x: c.jx,
        sizeMultiplier: c.js,
      });
      const opponent = makeFighter({
        id: "o",
        x: c.ox,
        sizeMultiplier: c.os,
      });
      const trace = simulateRopeJump(jumper, opponent, {
        useV2: true,
        jumpDirection: c.dir,
        landingOpponentStep: c.step,
      });
      assert.ok(trace.recoveryEnd, `boundary ${c.jx}`);
      assert.ok(
        jumper.x >= MAP_LEFT_BOUNDARY - 1e-6 &&
          jumper.x <= MAP_RIGHT_BOUNDARY + 1e-6
      );
      assert.ok(
        opponent.x >= MAP_LEFT_BOUNDARY - 1e-6 &&
          opponent.x <= MAP_RIGHT_BOUNDARY + 1e-6
      );
      assert.ok(!trace.overlapEverIncreased, `boundary ov grow ${c.jx}`);
      assert.ok(
        trace.postRecovery.pairDisplacement <=
          LANDING_SETTLE_MAX_PX_PER_TICK + 1e-6,
        `boundary grounded ${trace.postRecovery.pairDisplacement}`
      );
    }
  });

  it("production cleanup order — no deferred grounded snap", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      tickOrder: "production",
      landingOpponentStep: (opp) => {
        opp.x -= ORDINARY_FULL_SPEED;
      },
    });
    assert.equal(trace.cleanupTick.order, "production");
    assert.ok(
      trace.postRecovery.pairDisplacement <=
        RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
    );
    // Pre-A.3.2 failure mode: ~33.675 grounded snap.
    assert.ok(
      trace.postRecovery.pairDisplacement < 5,
      `regression snap ${trace.postRecovery.pairDisplacement}`
    );
    assert.ok(trace.maxRecoveryOverlap < 10);
  });

  it("movement_then_pushbox harness also releases clean", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      tickOrder: "movement_then_pushbox",
      landingOpponentStep: (opp) => {
        opp.x -= ORDINARY_FULL_SPEED;
      },
    });
    assert.equal(trace.cleanupTick.order, "movement_then_pushbox");
    assertNoReleaseSnap(trace, "alt-order", ORDINARY_FULL_SPEED);
  });
});

describe("Phase A.3.2 recovery-phase dynamic scan", () => {
  const sizes = [0.7, 0.85, 1.0];
  const rates = [-3.75, -3, -2, -1, 0, 1, 2, 3, 3.75];
  // Clear-touchdown band for all size pairs under vault identity (1.0/1.0
  // first clears ≈568). Cross-with-debt landings are covered by A.1/A.3.
  const startOpponentsLeft = [580, 600, 620, 640, 660];

  function profilesFor(rate) {
    return [
      {
        name: "const",
        step: (opp) => {
          opp.x += rate;
        },
      },
      {
        name: "accel",
        step: (opp, t) => {
          opp.x += rate * Math.min(1, t * 2);
        },
      },
      {
        name: "coast",
        step: (opp, t) => {
          opp.x += rate * (1 - t * 0.5);
        },
      },
      {
        name: "brake",
        step: (opp, t) => {
          opp.x += rate * Math.max(0, 1 - t);
        },
      },
      {
        name: "reverse",
        step: (opp, t) => {
          opp.x += t < 0.5 ? rate : -rate;
        },
      },
      {
        name: "enter_leave",
        step: (opp, t) => {
          opp.x += t < 0.55 ? rate : -rate;
        },
      },
      {
        name: "enter_leave_reenter",
        step: (opp, t) => {
          if (t < 0.3) opp.x += rate;
          else if (t < 0.55) opp.x -= rate;
          else opp.x += rate;
        },
      },
      {
        name: "final_tick",
        step: (opp, t) => {
          if (t >= 0.92) opp.x += rate;
        },
      },
    ];
  }

  it("recovery movement scan — no sticky-safe debt / no release snap", () => {
    let samples = 0;
    let worstOverlap = 0;
    let worstCorr = 0;
    let worstCleanup = 0;
    let worstGrounded = 0;
    let failures = [];

    for (const js of sizes) {
      for (const os of sizes) {
        for (const ox0 of startOpponentsLeft) {
          for (const rate of rates) {
            // Skip rates that walk away from a left-rope clear land.
            for (const profile of profilesFor(rate)) {
              const jumper = makeFighter({
                id: "j",
                x: 340,
                sizeMultiplier: js,
              });
              const opponent = makeFighter({
                id: "o",
                x: ox0,
                sizeMultiplier: os,
              });
              const trace = simulateRopeJump(jumper, opponent, {
                useV2: true,
                jumpDirection: 1,
                landingOpponentStep: profile.step,
              });
              samples += 1;
              worstOverlap = Math.max(worstOverlap, trace.maxRecoveryOverlap);
              worstCorr = Math.max(worstCorr, trace.maxRecoveryCorrection);
              worstCleanup = Math.max(
                worstCleanup,
                trace.cleanupTick ? trace.cleanupTick.pairDisplacement : 0
              );
              worstGrounded = Math.max(
                worstGrounded,
                trace.postRecovery ? trace.postRecovery.pairDisplacement : 0
              );

              const label = `L js=${js} os=${os} ox=${ox0} r=${rate} ${profile.name}`;
              if (trace.overlapEverIncreased) {
                failures.push(`${label}: overlap increased`);
              }
              if (
                !trace.postRecovery ||
                !trace.postRecovery.withinTolerance
              ) {
                failures.push(
                  `${label}: grounded ${trace.postRecovery &&
                    trace.postRecovery.pairDisplacement}`
                );
              }
              if (
                trace.recoveryEnd &&
                trace.recoveryEnd.overlap >
                  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
              ) {
                failures.push(
                  `${label}: recoveryEnd ov ${trace.recoveryEnd.overlap}`
                );
              }
              // Ordinary motion: no multi-tick debt accumulation.
              const ordinary = Math.abs(rate) <= ORDINARY_FULL_SPEED + 1e-9;
              if (
                ordinary &&
                profile.name === "const" &&
                Math.abs(rate) > 0 &&
                trace.touchdown &&
                trace.touchdown.overlap <= LANDING_SETTLE_OVERLAP_EPS_PX + 1e-6
              ) {
                const budget = Math.abs(rate) + 1.0;
                if (trace.maxRecoveryOverlap > budget) {
                  failures.push(
                    `${label}: debt ov ${trace.maxRecoveryOverlap}`
                  );
                }
              }
              if (
                trace.correctionTicks >
                LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS
              ) {
                failures.push(
                  `${label}: corrTicks ${trace.correctionTicks}`
                );
              }

              // Mirror from right rope for a subset.
              if (
                ox0 === 560 &&
                (rate === -3.75 || rate === 0 || rate === 3.75) &&
                profile.name === "const"
              ) {
                const jR = makeFighter({
                  id: "jR",
                  x: 935,
                  sizeMultiplier: js,
                });
                const oR = makeFighter({
                  id: "oR",
                  x: MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY - ox0,
                  sizeMultiplier: os,
                });
                const mirrorRate = -rate;
                const tR = simulateRopeJump(jR, oR, {
                  useV2: true,
                  jumpDirection: -1,
                  landingOpponentStep: (opp) => {
                    opp.x += mirrorRate;
                  },
                });
                samples += 1;
                if (
                  !tR.postRecovery ||
                  !tR.postRecovery.withinTolerance ||
                  tR.overlapEverIncreased
                ) {
                  failures.push(
                    `R mirror js=${js} os=${os} r=${mirrorRate}: fail`
                  );
                }
              }
            }
          }
        }
      }
    }

    // Knockback profile sample (early enough that ASAP settle can finish).
    for (const js of sizes) {
      for (const os of sizes) {
        const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: js });
        const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: os });
        let knocked = false;
        const trace = simulateRopeJump(jumper, opponent, {
          useV2: true,
          jumpDirection: 1,
          landingOpponentStep: (opp, t, _now, tr) => {
            if (!knocked && t >= 0.15) {
              const landX = tr.touchdown ? tr.touchdown.x : jumper.x;
              opp.x = landX + 40;
              knocked = true;
            }
          },
        });
        samples += 1;
        if (trace.overlapEverIncreased) {
          failures.push(`knockback js=${js} os=${os}: ov grew`);
        }
        if (
          !trace.postRecovery ||
          !trace.postRecovery.withinTolerance
        ) {
          failures.push(
            `knockback js=${js} os=${os}: grounded ${
              trace.postRecovery && trace.postRecovery.pairDisplacement
            }`
          );
        }
        if (
          trace.recoveryEnd &&
          trace.recoveryEnd.overlap >
            RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
        ) {
          failures.push(
            `knockback js=${js} os=${os}: end ov ${trace.recoveryEnd.overlap}`
          );
        }
      }
    }

    assert.ok(samples >= 1000, `sample count ${samples}`);
    assert.equal(
      failures.length,
      0,
      `scan failures (${failures.length}/${samples}): ${failures
        .slice(0, 8)
        .join(" | ")}`
    );
    // Expose scan metrics for the phase report.
    assert.ok(worstGrounded <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6);
    console.log(
      "[A3.2 recovery scan]",
      JSON.stringify({
        samples,
        worstOverlap,
        worstCorr,
        worstCleanup,
        worstGrounded,
      })
    );
  });
});

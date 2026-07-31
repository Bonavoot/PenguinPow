"use strict";

/**
 * Rope-jump high-vault move identity (V2).
 * See ROPE_JUMP_MOVE_IDENTITY_V2.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  makeFighter,
  simulateRopeJump,
  beginRopeJump,
  TICK_MS,
  GROUND_LEVEL,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
} = require("./helpers/ropeJumpSim");
const {
  stepRopeJumpActive,
  getVaultProfile,
  LEGACY_APEX_HEIGHT,
  REFERENCE_APEX_HEIGHT,
  authoredHorizProgress,
  vaultHeightFrac,
  decideApexCrossover,
  resolveCappedEndpoint,
  getRopeJumpLandingContactDistance,
  isRopeJumpStartupVulnerable,
  isRopeJumpAirborneProtected,
  isRopeJumpLandingVulnerable,
  LANDING_SETTLE_MAX_PX_PER_TICK,
} = require("../../landingResolution");
const { ROPE_JUMP_LANDING_V2 } = require("../../landingFlags");

const SELECTED = getVaultProfile("reference_contact_9");
const INTENDED = getVaultProfile("intended");
const REJECTED = getVaultProfile("rounded_rejected_floaty");

describe("rope-jump move identity — flag & presets", () => {
  it("V2 is enabled by default (approved)", () => {
    if (!process.env.ROPE_JUMP_LANDING_V2) {
      assert.equal(ROPE_JUMP_LANDING_V2, true);
    }
  });

  it("selected candidate is reference traj + settle allow 9", () => {
    assert.equal(SELECTED.name, "reference_contact_9");
    assert.equal(getVaultProfile().name, "reference_contact_9");
    assert.equal(SELECTED.apexHeight, REFERENCE_APEX_HEIGHT); // 156
    assert.equal(SELECTED.apexHeight, Math.round(LEGACY_APEX_HEIGHT * 1.3));
    assert.equal(authoredHorizProgress(SELECTED.apexT, SELECTED), 0.75);
    assert.equal(SELECTED.endpointCorrectionCapPx, 40);
    assert.equal(SELECTED.settleAllowancePx, 9);
    assert.equal(SELECTED.curveModel, "piecewise_linear_sincos");
    assert.equal(SELECTED.decisionT, 0.42);
    // intended aliases selected — not rejected rounded
    assert.equal(INTENDED.apexHeight, SELECTED.apexHeight);
    assert.equal(INTENDED.curveModel, SELECTED.curveModel);
    assert.equal(INTENDED.settleAllowancePx, 9);
  });

  it("rounded polish is rejected and not intended", () => {
    assert.equal(REJECTED.name, "rounded_rejected_floaty");
    assert.equal(REJECTED.rejected, true);
    assert.notEqual(REJECTED.curveModel, SELECTED.curveModel);
    assert.notEqual(REJECTED.apexHeight, SELECTED.apexHeight);
    const roundedAlias = getVaultProfile("rounded");
    assert.equal(roundedAlias.rejected, true);
    assert.equal(roundedAlias.apexHeight, REJECTED.apexHeight);
  });

  it("conservative / aggressive rejected A/B still exist and differ", () => {
    const c = getVaultProfile("conservative");
    const a = getVaultProfile("aggressive");
    assert.ok(c.apexHeight < SELECTED.apexHeight);
    assert.ok(a.apexHeight > SELECTED.apexHeight);
    assert.ok(c.horizFracAtApex < SELECTED.horizFracAtApex);
  });
});

describe("rope-jump move identity — vulnerability lifecycle", () => {
  function advanceToPhase(jumper, opponent, targetPhase) {
    const start = 100000;
    beginRopeJump(jumper, { jumpDirection: 1, now: start, useV2: true });
    let now = start;
    const limit = start + 2000;
    while (now < limit && jumper.isRopeJumping) {
      now += TICK_MS;
      if (jumper.ropeJumpPhase === "startup") {
        if (now >= jumper.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
          jumper.ropeJumpPhase = "active";
          jumper.ropeJumpActiveStartTime = now;
        }
      } else if (jumper.ropeJumpPhase === "active") {
        const r = stepRopeJumpActive(jumper, opponent, now, { useV2: true });
        if (r.touchedDown) {
          jumper.actionLockUntil = now + ROPE_JUMP_LANDING_RECOVERY_MS;
        }
      } else if (jumper.ropeJumpPhase === "landing") {
        if (now >= jumper.ropeJumpLandingTime + ROPE_JUMP_LANDING_RECOVERY_MS) {
          jumper.isRopeJumping = false;
          jumper.ropeJumpPhase = null;
        }
      }
      if (jumper.ropeJumpPhase === targetPhase) return now;
    }
    return now;
  }

  it("startup vulnerable; first airborne tick protected; landing vulnerable", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    beginRopeJump(jumper, { jumpDirection: 1, now: 100000, useV2: true });
    assert.equal(jumper.ropeJumpPhase, "startup");
    assert.ok(isRopeJumpStartupVulnerable(jumper));
    assert.ok(!isRopeJumpAirborneProtected(jumper));
    assert.ok(!isRopeJumpLandingVulnerable(jumper));

    // Final startup tick still vulnerable.
    jumper.ropeJumpPhase = "startup";
    assert.ok(isRopeJumpStartupVulnerable(jumper));

    advanceToPhase(jumper, opponent, "active");
    assert.ok(isRopeJumpAirborneProtected(jumper));
    assert.ok(!isRopeJumpStartupVulnerable(jumper));
    assert.ok(!isRopeJumpLandingVulnerable(jumper));

    // Mid / apex / late active remain protected.
    const mid = jumper.ropeJumpActiveStartTime + ROPE_JUMP_ACTIVE_MS * 0.5;
    stepRopeJumpActive(jumper, opponent, mid, { useV2: true });
    assert.ok(isRopeJumpAirborneProtected(jumper));

    advanceToPhase(jumper, opponent, "landing");
    assert.ok(isRopeJumpLandingVulnerable(jumper));
    assert.ok(!isRopeJumpAirborneProtected(jumper));
  });

  it("protection cleared after recovery; CPU/human share phase rules", () => {
    const human = makeFighter({ id: "h", x: 340, sizeMultiplier: 0.85 });
    const cpu = makeFighter({ id: "c", x: 340, sizeMultiplier: 0.85, isCPU: true });
    const oppH = makeFighter({ id: "o1", x: 560, sizeMultiplier: 0.85 });
    const oppC = makeFighter({ id: "o2", x: 560, sizeMultiplier: 0.85 });
    beginRopeJump(human, { jumpDirection: 1, now: 100000, useV2: true });
    beginRopeJump(cpu, { jumpDirection: 1, now: 100000, useV2: true });
    assert.equal(human.ropeJumpPhase, cpu.ropeJumpPhase);
    assert.equal(
      isRopeJumpStartupVulnerable(human),
      isRopeJumpStartupVulnerable(cpu)
    );
    advanceToPhase(human, oppH, "active");
    advanceToPhase(cpu, oppC, "active");
    assert.equal(
      isRopeJumpAirborneProtected(human),
      isRopeJumpAirborneProtected(cpu)
    );
    // After full sim, no rope-jump protection remains.
    const j = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const o = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    simulateRopeJump(j, o, { useV2: true, jumpDirection: 1 });
    assert.equal(j.isRopeJumping, false);
    assert.ok(!isRopeJumpAirborneProtected(j));
    assert.ok(!isRopeJumpLandingVulnerable(j));
  });

  it("legacy V2-off still uses phase gates identically", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    beginRopeJump(jumper, { jumpDirection: 1, now: 100000, useV2: false });
    assert.ok(isRopeJumpStartupVulnerable(jumper));
    jumper.ropeJumpPhase = "active";
    assert.ok(isRopeJumpAirborneProtected(jumper));
    jumper.ropeJumpPhase = "landing";
    assert.ok(isRopeJumpLandingVulnerable(jumper));
  });
});

describe("rope-jump move identity — arc shape", () => {
  it("apex meaningfully higher; duration unchanged; most H travel by apex", () => {
    assert.ok(SELECTED.apexHeight > LEGACY_APEX_HEIGHT * 1.25);
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    const hAtApex = authoredHorizProgress(SELECTED.apexT, SELECTED);
    assert.equal(hAtApex, 0.75);
    assert.ok(
      vaultHeightFrac(SELECTED.apexT, SELECTED.apexT, SELECTED.curveModel) >
        0.99
    );
    assert.ok(
      vaultHeightFrac(0.9, SELECTED.apexT, SELECTED.curveModel) < 0.35
    ); // steeper descent
  });

  it("clear jump: continuous, no reverse, vault_hermite, higher peak Y", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.ok(trace.commit);
    assert.equal(trace.commit.trajectoryType, "vault_hermite");
    assert.ok(Math.abs(trace.commit.t - SELECTED.decisionT) < 0.06);
    assert.ok(!trace.reversalDetected);
    const maxY = Math.max(...trace.samples.map((s) => s.y || 0));
    assert.ok(maxY >= GROUND_LEVEL + SELECTED.apexHeight - 2);
    assert.ok(maxY > GROUND_LEVEL + LEGACY_APEX_HEIGHT + 10);
    // Centerward monotonic samples (allow tiny float).
    let prev = MAP_LEFT_BOUNDARY - 1;
    for (const s of trace.samples) {
      assert.ok(s.x + 1e-6 >= prev, `non-monotonic ${prev}→${s.x}`);
      prev = s.x;
    }
    assert.ok(trace.peakVel < 800);
    assert.ok(trace.postRecovery.withinTolerance);
  });

  it("mirror symmetry left/right clear vault", () => {
    const L = simulateRopeJump(
      makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 }),
      makeFighter({ id: "o", x: 560, sizeMultiplier: 0.85 }),
      { useV2: true, jumpDirection: 1 }
    );
    const R = simulateRopeJump(
      makeFighter({ id: "j", x: 935, sizeMultiplier: 0.85 }),
      makeFighter({ id: "o", x: 715, sizeMultiplier: 0.85 }),
      { useV2: true, jumpDirection: -1 }
    );
    assert.ok(Math.abs(L.peakVel - R.peakVel) < 1);
    assert.equal(L.commit.trajectoryType, R.commit.trajectoryType);
  });
});

describe("rope-jump move identity — crossover & caps", () => {
  it("successful cross locks once; correction capped", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 438, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.equal(trace.intentClass, "cross");
    assert.ok(trace.sidesSeen.length <= 1);
    const corr =
      (trace.commit &&
        trace.commit.decision &&
        trace.commit.decision.correctionMagnitude) ||
      0;
    assert.ok(corr <= SELECTED.endpointCorrectionCapPx + 1e-6 ||
      trace.commit.decision.correctionCapped);
    assert.ok(
      Math.abs(trace.commit.resolvedTargetX - trace.rawTargetX) < 80,
      "no 100–200px magnetic add"
    );
    assert.ok(trace.peakVel < 900);
    assert.ok(trace.postRecovery.withinTolerance);
  });

  it("failed crossover does not reverse or wall-stop", () => {
    const cross = decideApexCrossover({
      jumperX: 400,
      rawTargetX: 438.175,
      jumpDirection: 1,
      opponentX: 455,
      jumperSizeMult: 0.85,
      opponentSizeMult: 0.85,
      profile: SELECTED,
    });
    // Near reachable ahead of decision → near; else promote cross.
    assert.ok(cross.intentClass === "near" || cross.intentClass === "cross");
    const capped = resolveCappedEndpoint({
      authoredEndX: 438.175,
      jumpDirection: 1,
      opponentX: 455,
      intentClass: cross.intentClass,
      side: cross.side,
      contactDist: cross.contactDist,
      mapLeft: MAP_LEFT_BOUNDARY,
      mapRight: MAP_RIGHT_BOUNDARY,
      correctionCapPx: SELECTED.endpointCorrectionCapPx,
      decisionX: 400,
      crossMinFarPadPx: SELECTED.crossMinFarPadPx,
    });
    assert.ok(capped.resolvedTargetX + 1e-6 >= 400);
  });

  it("moving opponent after lock does not re-home", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 500, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        if (t > 0.5) opp.x -= 4;
      },
    });
    assert.ok(trace.commit && trace.commit.resolvedTargetX != null);
    assert.ok(trace.sidesSeen.length <= 1);
    assert.ok(!trace.reversalDetected);
    assert.ok(trace.postRecovery.withinTolerance);
  });

  it("landing contact distance is grounded minus settle allowance", () => {
    const d = getRopeJumpLandingContactDistance(0.85, 0.85, SELECTED);
    assert.ok(d < 110.5);
    assert.ok(Math.abs(d - (110.5 - SELECTED.settleAllowancePx)) < 1e-6);
    assert.equal(d, 101.5);
  });

  it("capped correction routes debt into settle; recovery exit stable", () => {
    const jumper = makeFighter({ id: "j", x: 340, sizeMultiplier: 0.85 });
    const opponent = makeFighter({ id: "o", x: 438, sizeMultiplier: 0.85 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.ok(trace.touchdown.overlap > 1, "intentional settle debt");
    assert.ok(
      trace.touchdown.overlap < 120,
      `not absurd bury ${trace.touchdown.overlap}`
    );
    assert.ok(
      trace.maxSingleTickCorrection <= LANDING_SETTLE_MAX_PX_PER_TICK + 1e-6
    );
    assert.ok(
      trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
    );
    assert.ok(trace.postRecovery.withinTolerance);
    assert.ok(!trace.overlapEverIncreased);
  });
});

describe("rope-jump move identity — durations unchanged", () => {
  it("startup / active / recovery constants unchanged", () => {
    assert.equal(ROPE_JUMP_STARTUP_MS, 166);
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
  });
});

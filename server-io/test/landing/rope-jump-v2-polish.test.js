"use strict";

/**
 * Rope Jump V2 — rounded rejected; reference traj restored;
 * selected = reference_contact_9 (allow 9).
 *
 * See ROPE_JUMP_V2_POLISH_TUNING.md
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  makeFighter,
  simulateRopeJump,
  MAP_LEFT_BOUNDARY,
  GROUND_LEVEL,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
} = require("./helpers/ropeJumpSim");
const {
  getVaultProfile,
  REFERENCE_APEX_HEIGHT,
  LEGACY_APEX_HEIGHT,
  REFERENCE_TRAJECTORY,
  DEFAULT_PRESET_NAME,
  authoredHorizProgress,
  getRopeJumpLandingContactDistance,
  LANDING_SETTLE_MAX_PX_PER_TICK,
} = require("../../landingResolution");
const { ROPE_JUMP_LANDING_V2 } = require("../../landingFlags");

const SELECTED = getVaultProfile("reference_contact_9");
const REJECTED = getVaultProfile("rounded_rejected_floaty");

describe("rope-jump V2 selected candidate — reference_contact_9", () => {
  it("V2 defaults on; default preset is reference_contact_9", () => {
    if (!process.env.ROPE_JUMP_LANDING_V2) {
      assert.equal(ROPE_JUMP_LANDING_V2, true);
    }
    assert.equal(DEFAULT_PRESET_NAME, "reference_contact_9");
    assert.equal(getVaultProfile("reference_contact_9").name, "reference_contact_9");
  });

  it("exact reference airborne trajectory + settle allow 9", () => {
    assert.equal(SELECTED.apexHeight, 156);
    assert.equal(SELECTED.apexHeight, REFERENCE_APEX_HEIGHT);
    assert.equal(SELECTED.apexHeight, Math.round(LEGACY_APEX_HEIGHT * 1.3));
    assert.equal(SELECTED.apexT, 0.42);
    assert.equal(SELECTED.decisionT, 0.42);
    assert.equal(SELECTED.horizFracAtApex, 0.75);
    assert.equal(authoredHorizProgress(SELECTED.apexT, SELECTED), 0.75);
    assert.equal(SELECTED.curveModel, "piecewise_linear_sincos");
    assert.equal(SELECTED.endpointCorrectionCapPx, 40);
    assert.equal(SELECTED.crossMinFarPadPx, 28);
    assert.equal(SELECTED.settleAllowancePx, 9);
    assert.equal(getRopeJumpLandingContactDistance(0.85, 0.85, SELECTED), 101.5);
    assert.equal(REFERENCE_TRAJECTORY.curveModel, "piecewise_linear_sincos");
    assert.equal(REFERENCE_TRAJECTORY.apexHeight, 156);
    assert.equal(REFERENCE_TRAJECTORY.horizFracAtApex, 0.75);
  });

  it("rounded is rejected and not the selected/intended candidate", () => {
    assert.equal(REJECTED.rejected, true);
    assert.notEqual(REJECTED.curveModel, SELECTED.curveModel);
    assert.equal(getVaultProfile("intended").settleAllowancePx, 9);
    assert.equal(getVaultProfile("intended").curveModel, SELECTED.curveModel);
    assert.equal(getVaultProfile("rounded").rejected, true);
  });

  it("durations unchanged", () => {
    assert.equal(ROPE_JUMP_STARTUP_MS, 166);
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
  });

  it("sim: vault_hermite, apex 156, cap 40, recovery stable", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 438.175 });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.equal(trace.intentClass, "cross");
    assert.equal(trace.commit.trajectoryType, "vault_hermite");
    assert.ok(Math.abs(trace.commit.t - 0.42) < 0.05);
    assert.equal(trace.commit.decision?.vaultPreset, "reference_contact_9");
    assert.equal(trace.commit.decision?.apexHeight, 156);
    const maxY = Math.max(...trace.samples.map((s) => s.y || 0));
    assert.ok(Math.abs(maxY - (GROUND_LEVEL + 156)) < 1.5);
    assert.ok(
      (trace.commit.decision?.correctionMagnitude ?? 0) <= 40 + 1e-6 ||
        trace.commit.decision?.correctionCapped
    );
    assert.ok(trace.peakVel < 900);
    assert.ok(!trace.reversalDetected);
    assert.ok(
      trace.recoveryEnd.overlap <= RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
    );
    assert.ok(trace.postRecovery.withinTolerance);
    assert.ok(
      trace.maxSingleTickCorrection <= LANDING_SETTLE_MAX_PX_PER_TICK + 1e-6
    );
  });
});

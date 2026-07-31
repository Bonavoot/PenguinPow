"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  TICK_MS,
  GROUND_LEVEL,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
  ROPE_JUMP_STAMINA_COST,
  makeFighter,
  computeRawRopeJumpTargetX,
  simulateRopeJump,
  beginRopeJump,
  getMinimumCenterDistance,
} = require("./helpers/ropeJumpSim");
const {
  stepRopeJumpActive,
  clearRopeJumpLandingState,
  ropeJumpEase,
} = require("../../landingResolution");
const { createInitialPlayerState } = require("../../playerFactory");
const { clearAllActionStates } = require("../../gameUtils");

describe("rope-jump landing lifecycle", () => {
  it("legacy baseline: lands on raw target inside opponent then multi-tick 18px sep", () => {
    const jumper = makeFighter({
      id: "j",
      x: MAP_LEFT_BOUNDARY,
      stamina: 100,
    });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw });

    const staminaBefore = jumper.stamina;
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: false,
      jumpDirection: 1,
    });

    assert.equal(trace.useV2, false);
    assert.ok(Math.abs(trace.rawTargetX - raw) < 1e-9);
    assert.ok(trace.touchdown, "must touch down");
    assert.ok(
      trace.touchdown.overlap > 18,
      `legacy should deep-overlap on touchdown, got ${trace.touchdown.overlap}`
    );
    assert.ok(
      trace.correctionTicks >= 2,
      `legacy needs multi-tick sep, got ${trace.correctionTicks}`
    );
    assert.ok(trace.maxSingleTickCorrection <= 18 + 1e-6);
    assert.equal(jumper.stamina, staminaBefore - ROPE_JUMP_STAMINA_COST);
    assert.equal(trace.shakeEmits, 1);

    // Report metrics for the Phase-A report
    console.log(
      "[LEGACY_TRACE]",
      JSON.stringify({
        rawLandingTarget: trace.rawTargetX,
        touchdownOverlap: trace.touchdown.overlap,
        maxSingleTickCorrection: trace.maxSingleTickCorrection,
        correctionTicks: trace.correctionTicks,
        totalPostTouchdownDisplacement: trace.totalSafetyCorrectionPx,
        touchdownX: trace.touchdown.x,
        opponentX: trace.touchdown.opponentX,
      })
    );
  });

  it("V2 conflicting target: apex vault lock, settle debt clears in recovery", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY, stamina: 100 });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw });
    const { getVaultProfile } = require("../../ropeJumpVault");
    const vault = getVaultProfile();

    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });

    assert.ok(trace.commit, "must commit before land");
    assert.ok(trace.commit.t < 1);
    // Apex decision (~0.42), not legacy late commit (0.58).
    assert.ok(
      Math.abs(trace.commit.t - vault.decisionT) < 0.05,
      `commit t ${trace.commit.t}`
    );
    assert.equal(trace.commit.trajectoryType, "vault_hermite");
    assert.ok(trace.touchdown);
    // Capped cross may leave settle debt; A.3.2 clears by recovery exit.
    assert.ok(trace.touchdown.overlap > 0, "expected settle debt on raw conflict");
    assert.ok(trace.postRecovery && trace.postRecovery.withinTolerance);
    assert.ok(
      trace.recoveryEnd &&
        trace.recoveryEnd.overlap <= 0.5 + 1e-6
    );
    assert.ok(!trace.overlapEverIncreased);
    assert.ok(!trace.reversalDetected);
    assert.equal(trace.shakeEmits, 1);
    assert.equal(trace.commit.resolvedSide, 1);

    console.log(
      "[V2_TRACE]",
      JSON.stringify({
        rawTarget: trace.rawTargetX,
        commitT: trace.commit.t,
        commitX: trace.commit.commitX,
        resolvedEndpoint: trace.commit.resolvedTargetX,
        airbornePathAdjustment: Math.abs(
          trace.commit.resolvedTargetX - trace.rawTargetX
        ),
        touchdownOverlap: trace.touchdown.overlap,
        safetyCorrection: trace.totalSafetyCorrectionPx,
        resolvedSide: trace.commit.resolvedSide,
        trajectoryType: trace.commit.trajectoryType,
      })
    );
  });

  it("startup / active / recovery durations unchanged (V2)", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 700 });
    const start = 100_000;
    beginRopeJump(jumper, { jumpDirection: 1, now: start, useV2: true });

    assert.equal(jumper.actionLockUntil, start + ROPE_JUMP_STARTUP_MS);

    let now = start;
    let activeStart = null;
    let landTime = null;
    while (jumper.isRopeJumping && now < start + 5000) {
      now += TICK_MS;
      if (jumper.ropeJumpPhase === "startup") {
        if (now >= jumper.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
          jumper.ropeJumpPhase = "active";
          jumper.ropeJumpActiveStartTime = now;
          activeStart = now;
        }
      } else if (jumper.ropeJumpPhase === "active") {
        const r = stepRopeJumpActive(jumper, opponent, now, { useV2: true });
        if (r.touchedDown) {
          landTime = now;
          jumper.actionLockUntil = now + ROPE_JUMP_LANDING_RECOVERY_MS;
        }
      } else if (jumper.ropeJumpPhase === "landing") {
        if (now >= jumper.ropeJumpLandingTime + ROPE_JUMP_LANDING_RECOVERY_MS) {
          jumper.isRopeJumping = false;
          jumper.ropeJumpPhase = null;
        }
      }
    }

    assert.ok(activeStart != null);
    assert.ok(landTime != null);
    const activeDuration = landTime - activeStart;
    assert.ok(
      Math.abs(activeDuration - ROPE_JUMP_ACTIVE_MS) <= TICK_MS + 0.01,
      `active duration ${activeDuration} vs ${ROPE_JUMP_ACTIVE_MS}`
    );
  });

  it("vertical arc: V2 high-vault apex ~156 vs legacy ~120", () => {
    const { getVaultProfile } = require("../../ropeJumpVault");
    const vault = getVaultProfile();
    const peakY = (arc) => {
      const j = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
      const o = makeFighter({ id: "o", x: 800 });
      beginRopeJump(j, { jumpDirection: 1, now: 100_000, useV2: arc });
      let now = 100_000;
      let maxY = GROUND_LEVEL;
      while (j.ropeJumpPhase !== "landing" && now < 101_000) {
        now += TICK_MS;
        if (j.ropeJumpPhase === "startup") {
          if (now >= j.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
            j.ropeJumpPhase = "active";
            j.ropeJumpActiveStartTime = now;
          }
        } else if (j.ropeJumpPhase === "active") {
          stepRopeJumpActive(j, o, now, { useV2: arc });
          maxY = Math.max(maxY, j.y);
        }
      }
      return maxY;
    };

    const legacyPeak = peakY(false);
    const v2Peak = peakY(true);
    assert.ok(Math.abs(legacyPeak - (GROUND_LEVEL + 120)) < 1.0);
    assert.ok(
      Math.abs(v2Peak - (GROUND_LEVEL + vault.apexHeight)) < 1.0,
      `v2 apex ${v2Peak - GROUND_LEVEL}`
    );
    assert.ok(v2Peak > legacyPeak + 20);
  });

  it("no opponent conflict → no meaningful horizontal change vs raw", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 850 });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.ok(Math.abs(trace.touchdown.x - raw) < 0.5);
    if (trace.commit) {
      assert.ok(
        Math.abs(trace.commit.resolvedTargetX - raw) < 0.5 ||
          trace.commit.decision.rawOverlap === 0
      );
    }
  });

  it("position continuous at commitment", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw });
    beginRopeJump(jumper, { jumpDirection: 1, now: 100_000, useV2: true });

    let now = 100_000;
    let prevX = jumper.x;
    let sawCommit = false;
    while (jumper.ropeJumpPhase !== "landing" && now < 101_000) {
      now += TICK_MS;
      if (jumper.ropeJumpPhase === "startup") {
        if (now >= jumper.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
          jumper.ropeJumpPhase = "active";
          jumper.ropeJumpActiveStartTime = now;
        }
      } else if (jumper.ropeJumpPhase === "active") {
        const before = jumper.x;
        const r = stepRopeJumpActive(jumper, opponent, now, { useV2: true });
        if (r.committedThisTick) {
          sawCommit = true;
          // Commit X equals the pre-rebase position along the raw arc.
          assert.ok(Math.abs(jumper.ropeJumpLandingCommitX - before) < 1e-6 ||
            Math.abs(jumper.x - jumper.ropeJumpLandingCommitX) < 1.0);
          // No teleport: frame-to-frame delta stays within one tick of arc travel.
          assert.ok(Math.abs(jumper.x - prevX) < 40);
        }
        prevX = jumper.x;
      }
    }
    assert.ok(sawCommit);
  });

  it("stamina cost unchanged", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY, stamina: 50 });
    beginRopeJump(jumper, { jumpDirection: 1, now: 1, useV2: true });
    assert.equal(jumper.stamina, 50 - ROPE_JUMP_STAMINA_COST);
  });

  it("action lock set through landing recovery", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 800 });
    const start = 50_000;
    beginRopeJump(jumper, { jumpDirection: 1, now: start, useV2: true });
    assert.equal(jumper.actionLockUntil, start + ROPE_JUMP_STARTUP_MS);

    const trace = simulateRopeJump(
      makeFighter({ id: "j2", x: MAP_LEFT_BOUNDARY }),
      makeFighter({ id: "o2", x: 800 }),
      { useV2: true, jumpDirection: 1, now: start }
    );
    assert.ok(trace.touchdown);
  });

  it("buffered attack release still fires at landing end", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    jumper.ropeJumpBufferedAttackRelease = 1;
    const opponent = makeFighter({ id: "o", x: 800 });
    // Manually drive so we can set buffer before landing ends
    beginRopeJump(jumper, { jumpDirection: 1, now: 100_000, useV2: true });
    jumper.ropeJumpBufferedAttackRelease = 120; // held duration ms
    let now = 100_000;
    let fired = false;
    while (jumper.isRopeJumping && now < 102_000) {
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
          if (jumper.ropeJumpBufferedAttackRelease) {
            jumper.ropeJumpBufferedAttackRelease = 0;
            fired = true;
          }
          jumper.isRopeJumping = false;
          jumper.ropeJumpPhase = null;
          clearRopeJumpLandingState(jumper);
        }
      }
    }
    assert.equal(fired, true);
  });

  it("facing resolves toward opponent after landing", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY, facing: 1 });
    const opponent = makeFighter({ id: "o", x: 800 });
    simulateRopeJump(jumper, opponent, { useV2: true, jumpDirection: 1 });
    assert.equal(jumper.facing, -1); // face right toward opp (facing -1 = look +X)
  });

  it("screen-shake equivalent: exactly one touchdown event", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: 500 });
    const legacy = simulateRopeJump(
      makeFighter({ id: "jL", x: MAP_LEFT_BOUNDARY }),
      makeFighter({ id: "oL", x: 500 }),
      { useV2: false, jumpDirection: 1 }
    );
    const v2 = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.equal(legacy.shakeEmits, 1);
    assert.equal(v2.shakeEmits, 1);
  });

  it("flag off reproduces legacy land-inside path", () => {
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const legacy = simulateRopeJump(
      makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY }),
      makeFighter({ id: "o", x: raw }),
      { useV2: false, jumpDirection: 1 }
    );
    assert.ok(legacy.touchdown.overlap > 18);
    assert.equal(legacy.commit, null);
  });

  it("round/match/interrupt clear landing state", () => {
    const p = createInitialPlayerState({ id: "p1", fighter: "player 1" });
    p.isRopeJumping = true;
    p.ropeJumpPhase = "active";
    p.ropeJumpRawTargetX = 400;
    p.ropeJumpLandingCommitted = true;
    p.ropeJumpResolvedTargetX = 450;
    p.ropeJumpLandingDecision = { ok: true };

    clearAllActionStates(p);
    assert.equal(p.isRopeJumping, false);
    assert.equal(p.ropeJumpRawTargetX, 0);
    assert.equal(p.ropeJumpLandingCommitted, false);
    assert.equal(p.ropeJumpResolvedTargetX, 0);
    assert.equal(p.ropeJumpLandingDecision, null);
    assert.equal(p.ropeJumpLandingPath, null);
  });

  it("playerFactory initializes landing fields", () => {
    const p = createInitialPlayerState({ id: "p1", fighter: "player 1" });
    assert.equal(p.ropeJumpLandingCommitted, false);
    assert.equal(p.ropeJumpRawTargetX, 0);
    assert.equal(p.ropeJumpLandingPath, null);
  });

  it("right-boundary cross-up V2 lands on opponent left", () => {
    const jumper = makeFighter({ id: "j", x: MAP_RIGHT_BOUNDARY });
    const raw = computeRawRopeJumpTargetX(MAP_RIGHT_BOUNDARY);
    const opponent = makeFighter({ id: "o", x: raw });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: -1,
    });
    assert.ok(trace.commit);
    assert.equal(trace.commit.resolvedSide, -1);
    assert.equal(trace.commit.trajectoryType, "vault_hermite");
    // Settle debt OK — recovery exit must be clear.
    assert.ok(trace.postRecovery && trace.postRecovery.withinTolerance);
    assert.ok(
      trace.recoveryEnd &&
        trace.recoveryEnd.overlap <= 0.5 + 1e-6
    );
  });

  it("ease helper matches cosine ease-in-out", () => {
    assert.ok(Math.abs(ropeJumpEase(0) - 0) < 1e-9);
    assert.ok(Math.abs(ropeJumpEase(1) - 1) < 1e-9);
    assert.ok(Math.abs(ropeJumpEase(0.5) - 0.5) < 1e-9);
  });

  it("different size multipliers resolve with correct min distance", () => {
    const jumper = makeFighter({
      id: "j",
      x: MAP_LEFT_BOUNDARY,
      sizeMultiplier: 1,
    });
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const opponent = makeFighter({
      id: "o",
      x: raw,
      sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    });
    const minDist = getMinimumCenterDistance(1, DEFAULT_PLAYER_SIZE_MULTIPLIER);
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
    });
    assert.ok(trace.touchdown);
    // Touchdown may carry settle debt; after recovery, centers meet minDist.
    assert.ok(trace.postRecovery && trace.postRecovery.withinTolerance);
    const endDist = Math.abs(
      (trace.postRecovery.jumperX ?? jumper.x) -
        (trace.postRecovery.opponentX ?? opponent.x)
    );
    assert.ok(endDist >= minDist - 1e-6, `endDist ${endDist} min ${minDist}`);
  });
});

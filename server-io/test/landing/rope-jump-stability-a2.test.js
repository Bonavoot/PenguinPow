"use strict";

/**
 * Phase A.2 — decision stability for V2 high-vault identity:
 * fine opponent-X scans, cliff regressions, one apex side lock,
 * capped correction, peak vel under 900, apex height ~156
 * (selected: reference_contact_9).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  makeFighter,
  computeRawRopeJumpTargetX,
  simulateRopeJump,
  getMinimumCenterDistance,
  GROUND_LEVEL,
} = require("./helpers/ropeJumpSim");
const {
  resolveSideIntent,
  HOLD_SETTLE_EPS_PX,
  LANDING_SEPARATION_PAD_PX,
  MIN_CENTERWARD_ESCAPE_FLOOR_PX,
  MIN_CENTERWARD_ESCAPE_HALF_WIDTH_FRAC,
  MIN_CENTERWARD_ESCAPE_RAW_SPAN_FRAC,
  getPushboxHalfWidth,
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
  RECOVERY_EXIT_CORRECTION_TOLERANCE_PX,
} = require("../../landingResolution");
const { getVaultProfile } = require("../../ropeJumpVault");

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

/** Same-side adjacent samples may move ~1:1 with opponent (+ pad). */
const MAX_SAME_SIDE_ENDPOINT_DELTA = 2.0;
const MAX_SAME_SIDE_COMMIT_T_DELTA = 0.08;
const FINE_STEP = 0.25;
const ZOOM_STEP = 0.1;
/** Normal vault ≈390; farthest capped cross peaks ~860 — keep ≪ legacy ~1100. */
const MAX_VAULT_PEAK_VEL = 900;
const MAX_VAULT_PEAK_ACCEL = 25000;
const VAULT = getVaultProfile();

function runJump(startX, dir, oppX, jSize, oSize, opponentStep) {
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
  const trace = simulateRopeJump(jumper, opponent, {
    useV2: true,
    jumpDirection: dir,
    opponentStep,
  });
  const active = (trace.samples || []).filter((s) => s.phase === "active");
  const maxY = active.reduce(
    (m, s) => Math.max(m, s.y || GROUND_LEVEL),
    GROUND_LEVEL
  );
  return {
    oppX,
    preferredSide: trace.commit ? trace.commit.preferredSide : null,
    sideIntent: trace.commit ? trace.commit.sideIntent : trace.sideIntent,
    intentClass: trace.commit ? trace.commit.intentClass : trace.intentClass,
    commitT: trace.commit ? trace.commit.t : null,
    commitX: trace.commit ? trace.commit.commitX : null,
    endpoint: trace.commit ? trace.commit.resolvedTargetX : null,
    resolvedSide: trace.commit ? trace.commit.resolvedSide : null,
    trajectoryType: trace.commit ? trace.commit.trajectoryType : null,
    decisionClass: trace.commit ? trace.commit.decisionClass : null,
    correctionMagnitude: trace.commit?.decision?.correctionMagnitude ?? 0,
    correctionCapped: !!trace.commit?.decision?.correctionCapped,
    correctionCapPx: trace.commit?.decision?.correctionCapPx,
    apexHeight: maxY - GROUND_LEVEL,
    peakVel: trace.peakVel || 0,
    peakAccel: trace.peakAccel || 0,
    touchdownOverlap: trace.touchdown ? trace.touchdown.overlap : null,
    safetyCorrection: trace.totalSafetyCorrectionPx || 0,
    correctionTicks: trace.correctionTicks || 0,
    reversal: !!trace.reversalDetected,
    recoveryEndOverlap: trace.recoveryEnd ? trace.recoveryEnd.overlap : null,
    postRecoveryOk: trace.postRecovery
      ? !!trace.postRecovery.withinTolerance
      : true,
    overlapGrew: !!trace.overlapEverIncreased,
    startX,
    dir,
    jSize,
    oSize,
    rawTargetX: trace.rawTargetX,
  };
}

/** Opponent X where near-side escape first becomes meaningful (left/right). */
function nearEscapeBoundary(dir, jSize, oSize, startX) {
  const minDist =
    getMinimumCenterDistance(jSize, oSize) + LANDING_SEPARATION_PAD_PX;
  const jHalf = getPushboxHalfWidth(jSize);
  const raw = computeRawRopeJumpTargetX(startX);
  const rawSpan = Math.abs(raw - startX);
  const minEscape = Math.max(
    MIN_CENTERWARD_ESCAPE_FLOOR_PX,
    Math.min(
      jHalf * MIN_CENTERWARD_ESCAPE_HALF_WIDTH_FRAC,
      rawSpan * MIN_CENTERWARD_ESCAPE_RAW_SPAN_FRAC
    )
  );
  if (dir > 0) return MAP_LEFT_BOUNDARY + minEscape + minDist;
  return MAP_RIGHT_BOUNDARY - minEscape - minDist;
}

describe("Phase A.2 rope-jump decision stability", () => {
  it("Cliff 1 — 439.00 vs 439.25 same cross side, continuous endpoint", () => {
    const a = runJump(MAP_LEFT_BOUNDARY, 1, 439.0, 0.85, 0.85);
    const b = runJump(MAP_LEFT_BOUNDARY, 1, 439.25, 0.85, 0.85);
    assert.equal(a.intentClass, "cross");
    assert.equal(b.intentClass, "cross");
    assert.equal(a.resolvedSide, 1);
    assert.equal(b.resolvedSide, 1);
    assert.equal(a.trajectoryType, "vault_hermite");
    assert.ok(Math.abs(a.endpoint - b.endpoint) <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(Math.abs(a.commitT - b.commitT) <= MAX_SAME_SIDE_COMMIT_T_DELTA);
    assert.notEqual(a.trajectoryType, "hold_settle");
    assert.notEqual(b.trajectoryType, "hold_settle");
  });

  it("Cliff 2 — 516.25 vs 516.50 near/cross boundary stays continuous", () => {
    // reference_contact_9 (allow 9 → contact 101.5) flips cross→near near 516.5.
    const a = runJump(MAP_LEFT_BOUNDARY, 1, 516.25, 0.85, 0.85);
    const b = runJump(MAP_LEFT_BOUNDARY, 1, 516.5, 0.85, 0.85);
    assert.equal(a.intentClass, "cross");
    assert.equal(b.intentClass, "near");
    assert.equal(a.resolvedSide, 1);
    assert.equal(b.resolvedSide, -1);
    assert.ok(a.peakVel <= MAX_VAULT_PEAK_VEL + 1);
    assert.ok(b.peakVel <= MAX_VAULT_PEAK_VEL + 1);
    assert.ok(Math.abs(a.apexHeight - VAULT.apexHeight) < 1.0);
  });

  it("Cliff 3 — 539.50 vs 539.75 near→preserve_raw under motion budgets", () => {
    const a = runJump(MAP_LEFT_BOUNDARY, 1, 539.5, 0.85, 0.85);
    const b = runJump(MAP_LEFT_BOUNDARY, 1, 539.75, 0.85, 0.85);
    assert.equal(a.intentClass, "near");
    assert.equal(b.intentClass, "preserve_raw");
    assert.equal(a.resolvedSide, b.resolvedSide);
    assert.ok(Math.abs(a.endpoint - b.endpoint) <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(a.peakVel <= MAX_VAULT_PEAK_VEL + 1, `vel ${a.peakVel}`);
    assert.ok(b.peakVel <= MAX_VAULT_PEAK_VEL + 1, `vel ${b.peakVel}`);
    assert.ok(a.peakAccel <= MAX_VAULT_PEAK_ACCEL + 1, `acc ${a.peakAccel}`);
    assert.ok(b.peakAccel <= MAX_VAULT_PEAK_ACCEL + 1, `acc ${b.peakAccel}`);
  });

  it("Mirrored right-rope cliffs", () => {
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    // Same-side continuity pairs (not discrete intent cliffs).
    const pairs = [
      [439.0, 439.25],
      [500.0, 500.25],
      [545.0, 545.25],
    ];
    for (const [lo, hi] of pairs) {
      const rLo = mid - (lo - mid);
      const rHi = mid - (hi - mid);
      const a = runJump(MAP_RIGHT_BOUNDARY, -1, Math.max(rLo, rHi), 0.85, 0.85);
      const b = runJump(MAP_RIGHT_BOUNDARY, -1, Math.min(rLo, rHi), 0.85, 0.85);
      assert.equal(a.intentClass, b.intentClass, `intent ${lo}`);
      assert.equal(a.resolvedSide, b.resolvedSide, `side ${lo}`);
      assert.ok(
        Math.abs(a.endpoint - b.endpoint) <= MAX_SAME_SIDE_ENDPOINT_DELTA,
        `end delta ${lo}: ${a.endpoint} vs ${b.endpoint}`
      );
    }
  });

  it("no ordinary hold_settle vertical rope hop in former A.1 band", () => {
    for (let oppX = 439.25; oppX <= 452; oppX += 0.25) {
      const r = runJump(MAP_LEFT_BOUNDARY, 1, oppX, 0.85, 0.85);
      const escape = Math.abs(r.endpoint - MAP_LEFT_BOUNDARY);
      assert.ok(
        escape > 20,
        `opp=${oppX} collapsed escape end=${r.endpoint} traj=${r.trajectoryType}`
      );
      assert.notEqual(
        r.trajectoryType,
        "hold_settle",
        `opp=${oppX} hold_settle`
      );
      assert.equal(r.intentClass, "cross");
      assert.equal(r.trajectoryType, "vault_hermite");
    }
  });

  it("side intent: near-escape boundary, no rawOnCenter epsilon flip", () => {
    const jHalf = getPushboxHalfWidth(0.85);
    const minDist = jHalf * 2;
    const raw = computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY);
    const boundary = nearEscapeBoundary(1, 0.85, 0.85, MAP_LEFT_BOUNDARY);
    const below = resolveSideIntent({
      rawTargetX: raw,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
      opponentX: boundary - 0.1,
      minimumDistance: minDist,
      jumperHalfWidth: jHalf,
    });
    const above = resolveSideIntent({
      rawTargetX: raw,
      jumperStartX: MAP_LEFT_BOUNDARY,
      jumpDirection: 1,
      opponentX: boundary + 0.1,
      minimumDistance: minDist,
      jumperHalfWidth: jHalf,
    });
    assert.equal(below.intentClass, "cross");
    assert.equal(above.intentClass, "near");
    assert.equal(below.side, 1);
    assert.equal(above.side, -1);
  });

  it("opponent moving across boundary before apex lock uses apex geometry", () => {
    const boundary = nearEscapeBoundary(1, 0.85, 0.85, MAP_LEFT_BOUNDARY);
    // Start on cross side; walk during ascent — side locks once at apex.
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: boundary - 5 });
    const sides = [];
    const lockTs = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        if (t < VAULT.decisionT) opp.x = boundary - 5 + t * 50;
        if (jumper.ropeJumpSideIntentLocked) {
          sides.push(jumper.ropeJumpSideIntent);
          lockTs.push(t);
        }
      },
    });
    assert.ok(trace.commit);
    assert.equal(trace.commit.trajectoryType, "vault_hermite");
    assert.ok(
      Math.abs(trace.commit.t - VAULT.decisionT) < 0.05,
      `lock t ${trace.commit.t}`
    );
    assert.ok(sides.length > 0);
    assert.ok(sides.every((s) => s === sides[0]), "side oscillated after lock");
    assert.equal(trace.commit.resolvedSide, sides[0]);
  });

  it("opponent moving across boundary after apex lock does not flip side", () => {
    const boundary = nearEscapeBoundary(1, 0.85, 0.85, MAP_LEFT_BOUNDARY);
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: boundary + 30 });
    const sides = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        if (t > VAULT.decisionT) opp.x = boundary + 30 - (t - VAULT.decisionT) * 80;
        if (jumper.ropeJumpSideIntentLocked) {
          sides.push(jumper.ropeJumpSideIntent);
        }
      },
    });
    assert.ok(trace.commit);
    assert.ok(sides.length > 0);
    assert.ok(
      sides.every((s) => s === sides[0]),
      `side flipped during jump: ${[...new Set(sides)]}`
    );
    assert.equal(trace.commit.resolvedSide, sides[0]);
  });

  it("determinism: identical inputs → identical endpoints", () => {
    for (const oppX of [439, 450, 470, 513.5, 536.75]) {
      const a = runJump(MAP_LEFT_BOUNDARY, 1, oppX, 0.85, 0.85);
      const b = runJump(MAP_LEFT_BOUNDARY, 1, oppX, 0.85, 0.85);
      assert.equal(a.endpoint, b.endpoint);
      assert.equal(a.commitT, b.commitT);
      assert.equal(a.resolvedSide, b.resolvedSide);
    }
  });

  it("mirror symmetry of endpoints about ring center", () => {
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    for (const oppX of [439, 450, 470, 513.5, 536.75]) {
      const left = runJump(MAP_LEFT_BOUNDARY, 1, oppX, 0.85, 0.85);
      const rightOpp = mid - (oppX - mid);
      const right = runJump(MAP_RIGHT_BOUNDARY, -1, rightOpp, 0.85, 0.85);
      const lOff = left.endpoint - mid;
      const rOff = mid - right.endpoint;
      assert.ok(
        Math.abs(lOff - rOff) < 1e-6,
        `opp ${oppX}: ${lOff} vs ${rOff}`
      );
      assert.equal(left.resolvedSide, -right.resolvedSide);
    }
  });

  it("fine scan 0.25px — vault identity, continuity, no repeated flips", () => {
    const failures = [];
    let maxSameSideDelta = 0;
    let maxPeakVel = 0;
    let maxPeakAccel = 0;
    let intentionalTransitions = 0;
    let holdSettleNearRope = 0;

    for (const [jSize, oSize] of SIZE_PAIRS) {
      for (const dir of [1, -1]) {
        const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
        const raw = computeRawRopeJumpTargetX(startX);
        let prev = null;
        let flipCount = 0;
        const flipXs = [];

        for (
          let oppX = MAP_LEFT_BOUNDARY + 20;
          oppX <= MAP_RIGHT_BOUNDARY - 20;
          oppX += FINE_STEP
        ) {
          const r = runJump(startX, dir, oppX, jSize, oSize);
          maxPeakVel = Math.max(maxPeakVel, r.peakVel || 0);
          maxPeakAccel = Math.max(maxPeakAccel, r.peakAccel || 0);

          if (r.trajectoryType !== "vault_hermite" && r.trajectoryType != null) {
            failures.push(
              `traj ${r.trajectoryType} @${oppX} size ${jSize}/${oSize}`
            );
          }
          if (Math.abs(r.apexHeight - VAULT.apexHeight) > 1.5) {
            failures.push(
              `apexH ${r.apexHeight.toFixed(1)} @${oppX} size ${jSize}/${oSize}`
            );
          }
          if (
            r.correctionMagnitude > VAULT.endpointCorrectionCapPx + 1e-6 &&
            !r.correctionCapped
          ) {
            failures.push(
              `uncapped corr ${r.correctionMagnitude.toFixed(1)} @${oppX}`
            );
          }
          if (r.peakVel > MAX_VAULT_PEAK_VEL + 1) {
            failures.push(
              `peakVel ${r.peakVel.toFixed(0)} @${oppX} size ${jSize}/${oSize} dir ${dir}`
            );
          }
          if (r.peakAccel > MAX_VAULT_PEAK_ACCEL + 1) {
            failures.push(
              `peakAccel ${r.peakAccel.toFixed(0)} @${oppX} size ${jSize}/${oSize}`
            );
          }
          if (r.reversal) {
            failures.push(`reversal @${oppX} size ${jSize}/${oSize} dir ${dir}`);
          }
          // Settle debt OK — require A.3.2 exit stability, not zero touchdown overlap.
          if (r.overlapGrew) {
            failures.push(`overlap grew @${oppX} size ${jSize}/${oSize}`);
          }
          if (
            r.correctionTicks > LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS
          ) {
            failures.push(
              `corrTicks ${r.correctionTicks} @${oppX} size ${jSize}/${oSize}`
            );
          }
          if (
            r.recoveryEndOverlap != null &&
            r.recoveryEndOverlap > RECOVERY_EXIT_CORRECTION_TOLERANCE_PX + 1e-6
          ) {
            failures.push(
              `recoveryEnd ov ${r.recoveryEndOverlap.toFixed(2)} @${oppX}`
            );
          }
          if (!r.postRecoveryOk) {
            failures.push(`postRecovery @${oppX} size ${jSize}/${oSize}`);
          }

          const escape = Math.abs((r.endpoint || startX) - startX);
          if (
            r.trajectoryType === "hold_settle" &&
            escape <= HOLD_SETTLE_EPS_PX + 1
          ) {
            holdSettleNearRope++;
            failures.push(
              `ordinary hold_settle rope hop @${oppX} size ${jSize}/${oSize}`
            );
          }

          if (prev) {
            if (prev.resolvedSide !== r.resolvedSide) {
              flipCount++;
              flipXs.push([prev.oppX, r.oppX]);
              intentionalTransitions++;
              // Discrete vault intent boundaries only — zoom continuity on each side.
              for (let z = prev.oppX; z <= r.oppX + 1e-9; z += ZOOM_STEP) {
                const za = runJump(startX, dir, z, jSize, oSize);
                const zb = runJump(
                  startX,
                  dir,
                  Math.min(z + ZOOM_STEP, r.oppX),
                  jSize,
                  oSize
                );
                if (
                  za.resolvedSide === zb.resolvedSide &&
                  Math.abs(za.endpoint - zb.endpoint) >
                    MAX_SAME_SIDE_ENDPOINT_DELTA
                ) {
                  failures.push(
                    `zoom cliff ${za.endpoint}→${zb.endpoint} @${z} size ${jSize}/${oSize}`
                  );
                }
              }
            } else {
              const dEnd = Math.abs(r.endpoint - prev.endpoint);
              maxSameSideDelta = Math.max(maxSameSideDelta, dEnd);
              if (dEnd > MAX_SAME_SIDE_ENDPOINT_DELTA) {
                failures.push(
                  `endpoint cliff Δ=${dEnd.toFixed(2)} @${prev.oppX}→${r.oppX} side=${r.resolvedSide} size ${jSize}/${oSize} dir ${dir}`
                );
              }
              const dCommit = Math.abs((r.commitT || 0) - (prev.commitT || 0));
              if (dCommit > MAX_SAME_SIDE_COMMIT_T_DELTA + 0.05) {
                failures.push(
                  `commitT cliff Δ=${dCommit.toFixed(3)} @${prev.oppX}→${r.oppX} size ${jSize}/${oSize}`
                );
              }
            }
          }
          prev = r;
        }

        // Vault: cross→near→preserve_raw (and mirrors) ≈ few flips per sweep.
        if (flipCount > 8) {
          failures.push(
            `too many side flips (${flipCount}) size ${jSize}/${oSize} dir ${dir}: ${JSON.stringify(flipXs.slice(0, 8))}`
          );
        }
        void raw;
      }
    }

    assert.equal(
      failures.length,
      0,
      `A.2 fine-scan failures (${failures.length}); maxSameSideΔ=${maxSameSideDelta.toFixed(2)} maxVel=${maxPeakVel.toFixed(0)} maxAccel=${maxPeakAccel.toFixed(0)} transitions=${intentionalTransitions} holdRope=${holdSettleNearRope}\n` +
        failures.slice(0, 25).join("\n")
    );

    assert.ok(maxSameSideDelta <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(maxPeakVel <= MAX_VAULT_PEAK_VEL + 1);
    assert.ok(maxPeakAccel <= MAX_VAULT_PEAK_ACCEL + 1);
    assert.equal(holdSettleNearRope, 0);
    assert.ok(intentionalTransitions > 0, "expected map-fit transitions");
  });
});

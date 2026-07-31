"use strict";

/**
 * Phase A.2 — decision stability: fine opponent-X scans, cliff regressions,
 * side-intent lock, no ordinary hold_settle rope hops, motion budgets.
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
  getMinimumCenterDistance,
} = require("./helpers/ropeJumpSim");
const {
  resolveSideIntent,
  MAX_TRAJECTORY_PEAK_VEL,
  MAX_TRAJECTORY_PEAK_ACCEL,
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
  HOLD_SETTLE_EPS_PX,
  LANDING_SEPARATION_PAD_PX,
  MIN_CENTERWARD_ESCAPE_FLOOR_PX,
  MIN_CENTERWARD_ESCAPE_HALF_WIDTH_FRAC,
  MIN_CENTERWARD_ESCAPE_RAW_SPAN_FRAC,
  getPushboxHalfWidth,
} = require("../../landingResolution");

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
    peakVel: trace.peakVel || 0,
    peakAccel: trace.peakAccel || 0,
    touchdownOverlap: trace.touchdown ? trace.touchdown.overlap : null,
    safetyCorrection: trace.totalSafetyCorrectionPx || 0,
    correctionTicks: trace.correctionTicks || 0,
    reversal: !!trace.reversalDetected,
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
    assert.ok(Math.abs(a.endpoint - b.endpoint) <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(Math.abs(a.commitT - b.commitT) <= MAX_SAME_SIDE_COMMIT_T_DELTA);
    assert.notEqual(a.trajectoryType, "hold_settle");
    assert.notEqual(b.trajectoryType, "hold_settle");
  });

  it("Cliff 2 — 511.00 vs 511.25 stay near side, no commit-era flip", () => {
    const a = runJump(MAP_LEFT_BOUNDARY, 1, 511.0, 0.85, 0.85);
    const b = runJump(MAP_LEFT_BOUNDARY, 1, 511.25, 0.85, 0.85);
    assert.equal(a.intentClass, "near");
    assert.equal(b.intentClass, "near");
    assert.equal(a.resolvedSide, -1);
    assert.equal(b.resolvedSide, -1);
    assert.ok(Math.abs(a.endpoint - b.endpoint) <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(
      Math.abs(a.commitT - b.commitT) <= MAX_SAME_SIDE_COMMIT_T_DELTA,
      `commitT cliff ${a.commitT} vs ${b.commitT}`
    );
    assert.ok(a.peakVel <= MAX_TRAJECTORY_PEAK_VEL + 1);
    assert.ok(b.peakVel <= MAX_TRAJECTORY_PEAK_VEL + 1);
  });

  it("Cliff 3 — 514.00 vs 514.25 stay near, under motion budgets", () => {
    const a = runJump(MAP_LEFT_BOUNDARY, 1, 514.0, 0.85, 0.85);
    const b = runJump(MAP_LEFT_BOUNDARY, 1, 514.25, 0.85, 0.85);
    assert.equal(a.intentClass, "near");
    assert.equal(b.intentClass, "near");
    assert.equal(a.resolvedSide, b.resolvedSide);
    assert.ok(Math.abs(a.endpoint - b.endpoint) <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(a.peakVel <= MAX_TRAJECTORY_PEAK_VEL + 1, `vel ${a.peakVel}`);
    assert.ok(b.peakVel <= MAX_TRAJECTORY_PEAK_VEL + 1, `vel ${b.peakVel}`);
    assert.ok(a.peakAccel <= MAX_TRAJECTORY_PEAK_ACCEL + 1, `acc ${a.peakAccel}`);
    assert.ok(b.peakAccel <= MAX_TRAJECTORY_PEAK_ACCEL + 1, `acc ${b.peakAccel}`);
  });

  it("Mirrored right-rope cliffs", () => {
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const pairs = [
      [439.0, 439.25],
      [511.0, 511.25],
      [514.0, 514.25],
    ];
    for (const [lo, hi] of pairs) {
      const rLo = mid - (lo - mid);
      const rHi = mid - (hi - mid);
      // Mirror maps smaller left X to larger right X; order for adjacency:
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

  it("opponent moving across boundary before intent lock uses lock-time geometry", () => {
    const boundary = nearEscapeBoundary(1, 0.85, 0.85, MAP_LEFT_BOUNDARY);
    // Start on cross side of boundary; walk into near side during early active.
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: boundary - 5 });
    const sides = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        if (t < 0.2) opp.x = boundary - 5 + t * 50;
        if (jumper.ropeJumpSideIntentLocked) {
          sides.push(jumper.ropeJumpSideIntent);
        }
      },
    });
    assert.ok(trace.commit);
    // A.3: provisional raw / velocity sample may delay the lock until the
    // opponent has entered the near region — lock-time geometry wins, once.
    assert.equal(trace.commit.sideIntent, -1);
    assert.equal(trace.commit.resolvedSide, -1);
    assert.equal(trace.commit.intentClass, "near");
    assert.ok(sides.length > 0);
    assert.ok(sides.every((s) => s === -1), "side oscillated after lock");
  });

  it("opponent moving across boundary after intent lock does not flip side", () => {
    const boundary = nearEscapeBoundary(1, 0.85, 0.85, MAP_LEFT_BOUNDARY);
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({ id: "o", x: boundary + 30 });
    const sides = [];
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: true,
      jumpDirection: 1,
      opponentStep: (opp, t) => {
        // Walk toward rope after intent should already be locked.
        if (t > 0.1) opp.x = boundary + 30 - (t - 0.1) * 80;
        if (jumper.ropeJumpSideIntentLocked) {
          sides.push(jumper.ropeJumpSideIntent);
        }
      },
    });
    assert.ok(trace.commit);
    // A.3 may lock near or cross from predicted lock-time geometry; once
    // locked, the side must not oscillate as the opponent crosses the boundary.
    assert.ok(sides.length > 0);
    assert.ok(
      sides.every((s) => s === sides[0]),
      `side flipped during jump: ${[...new Set(sides)]}`
    );
    assert.equal(trace.commit.resolvedSide, sides[0]);
  });

  it("determinism: identical inputs → identical endpoints", () => {
    for (const oppX of [439, 450, 470, 511.25, 514]) {
      const a = runJump(MAP_LEFT_BOUNDARY, 1, oppX, 0.85, 0.85);
      const b = runJump(MAP_LEFT_BOUNDARY, 1, oppX, 0.85, 0.85);
      assert.equal(a.endpoint, b.endpoint);
      assert.equal(a.commitT, b.commitT);
      assert.equal(a.resolvedSide, b.resolvedSide);
    }
  });

  it("mirror symmetry of endpoints about ring center", () => {
    const mid = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    for (const oppX of [439, 450, 470, 511, 514]) {
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

  it("fine scan 0.25px — continuity, budgets, no repeated flips", () => {
    const failures = [];
    let maxSameSideDelta = 0;
    let maxPeakVel = 0;
    let maxPeakAccel = 0;
    let intentionalTransitions = 0;
    const transitionLocations = [];
    let holdSettleNearRope = 0;
    let safetyUsed = 0;
    let overlapSamples = 0;
    let overlapSum = 0;

    for (const [jSize, oSize] of SIZE_PAIRS) {
      for (const dir of [1, -1]) {
        const startX = dir > 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
        const raw = computeRawRopeJumpTargetX(startX);
        const escapeBoundary = nearEscapeBoundary(dir, jSize, oSize, startX);
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
          if (r.touchdownOverlap != null) {
            overlapSamples++;
            overlapSum += r.touchdownOverlap;
            if (r.touchdownOverlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX + 1) {
              failures.push(
                `overlap ${r.touchdownOverlap.toFixed(2)} @${oppX} size ${jSize}/${oSize} dir ${dir}`
              );
            }
          }
          if (r.safetyCorrection > 0) safetyUsed++;

          const escape = Math.abs((r.endpoint || startX) - startX);
          if (
            r.trajectoryType === "hold_settle" &&
            escape <= HOLD_SETTLE_EPS_PX + 1
          ) {
            holdSettleNearRope++;
            if (
              r.decisionClass !== "emergency_hold_settle" &&
              r.decisionClass !== "both_sides_constrained" &&
              r.decisionClass !== "endpoint_forward_clamped_at_commit"
            ) {
              failures.push(
                `ordinary hold_settle rope hop @${oppX} size ${jSize}/${oSize} dir ${dir} class=${r.decisionClass}`
              );
            }
          }

          if (r.peakVel > MAX_TRAJECTORY_PEAK_VEL + 1) {
            failures.push(
              `peakVel ${r.peakVel.toFixed(0)} @${oppX} [${prev && prev.oppX}->${oppX}] size ${jSize}/${oSize} dir ${dir} end=${r.endpoint} traj=${r.trajectoryType}`
            );
          }
          if (r.peakAccel > MAX_TRAJECTORY_PEAK_ACCEL + 1) {
            failures.push(
              `peakAccel ${r.peakAccel.toFixed(0)} @${oppX} size ${jSize}/${oSize} dir ${dir}`
            );
          }
          if (r.reversal) {
            failures.push(`reversal @${oppX} size ${jSize}/${oSize} dir ${dir}`);
          }

          if (prev) {
            if (prev.resolvedSide !== r.resolvedSide) {
              flipCount++;
              flipXs.push([prev.oppX, r.oppX]);
              // Intentional discrete boundaries only:
              // 1) near-escape threshold  2) raw-center crossing  3) clear↔conflict
              const nearEscapeBand =
                Math.abs(prev.oppX - escapeBoundary) <= 1.0 ||
                Math.abs(r.oppX - escapeBoundary) <= 1.0;
              const rawCrossBand =
                Math.abs(prev.oppX - raw) <= 1.0 ||
                Math.abs(r.oppX - raw) <= 1.0;
              const clearBand =
                prev.intentClass === "preserve_raw" ||
                r.intentClass === "preserve_raw";
              if (nearEscapeBand || rawCrossBand || clearBand) {
                intentionalTransitions++;
                transitionLocations.push({
                  jSize,
                  oSize,
                  dir,
                  from: prev.oppX,
                  to: r.oppX,
                  a: prev.intentClass,
                  b: r.intentClass,
                });
                for (
                  let z = prev.oppX;
                  z <= r.oppX + 1e-9;
                  z += ZOOM_STEP
                ) {
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
                failures.push(
                  `unexpected side flip ${prev.resolvedSide}→${r.resolvedSide} @${prev.oppX}→${r.oppX} size ${jSize}/${oSize} dir ${dir} (${prev.intentClass}→${r.intentClass}) escapeB=${escapeBoundary.toFixed(2)} raw=${raw.toFixed(2)}`
                );
              }
            } else {
              const dEnd = Math.abs(r.endpoint - prev.endpoint);
              maxSameSideDelta = Math.max(maxSameSideDelta, dEnd);
              if (dEnd > MAX_SAME_SIDE_ENDPOINT_DELTA) {
                failures.push(
                  `endpoint cliff Δ=${dEnd.toFixed(2)} @${prev.oppX}→${r.oppX} side=${r.resolvedSide} size ${jSize}/${oSize} dir ${dir} (${prev.endpoint.toFixed(2)}→${r.endpoint.toFixed(2)} traj ${prev.trajectoryType}→${r.trajectoryType})`
                );
              }
              const dCommit = Math.abs((r.commitT || 0) - (prev.commitT || 0));
              if (dCommit > MAX_SAME_SIDE_COMMIT_T_DELTA + 0.05) {
                failures.push(
                  `commitT cliff Δ=${dCommit.toFixed(3)} @${prev.oppX}→${r.oppX} size ${jSize}/${oSize} dir ${dir}`
                );
              }
            }
          }
          prev = r;
        }

        // preserve_raw edges + raw-cross + near-escape ≈ ≤6 expected per sweep.
        if (flipCount > 8) {
          failures.push(
            `too many side flips (${flipCount}) size ${jSize}/${oSize} dir ${dir}: ${JSON.stringify(flipXs.slice(0, 8))}`
          );
        }
      }
    }

    // Stash summary on assert message if anything fails.
    assert.equal(
      failures.length,
      0,
      `A.2 fine-scan failures (${failures.length}); maxSameSideΔ=${maxSameSideDelta.toFixed(2)} maxVel=${maxPeakVel.toFixed(0)} maxAccel=${maxPeakAccel.toFixed(0)} transitions=${intentionalTransitions} holdRope=${holdSettleNearRope}\n` +
        failures.slice(0, 25).join("\n")
    );

    // Soft invariants for the report (also asserted).
    assert.ok(maxSameSideDelta <= MAX_SAME_SIDE_ENDPOINT_DELTA);
    assert.ok(maxPeakVel <= MAX_TRAJECTORY_PEAK_VEL + 1);
    assert.ok(maxPeakAccel <= MAX_TRAJECTORY_PEAK_ACCEL + 1);
    assert.equal(holdSettleNearRope, 0);
    assert.ok(intentionalTransitions > 0, "expected map-fit transitions");
  });
});

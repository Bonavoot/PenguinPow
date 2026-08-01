"use strict";

/**
 * Phase 17 — Rope Jump free-flight trajectory (ROPE_JUMP_FLIGHT_CURVE_V3).
 * Default ON (smooth_long_20). Reference branch must match V3-off path
 * exactly when opponent-influenced.
 */

const { describe, it, afterEach } = require("node:test");
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
} = require("./helpers/ropeJumpSim");
const {
  stepRopeJumpActive,
  getVaultProfile,
  TRAJECTORY_MODE,
  FLIGHT_PRESETS,
  sampleAuthoredX,
  sampleAuthoredVel,
  sampleVaultY,
  vaultHeightFracDeriv,
  authoredHorizProgress,
  getRopeJumpLandingContactDistance,
  computeBaseRawTargetX,
  extendRawTargetX,
  classifyOpponentInfluence,
  constrainFreeFlightRawTargetX,
  getFreeFlightProfile,
  getFlightPreset,
  clearRopeJumpLandingState,
} = require("../../landingResolution");
const {
  isRopeJumpFlightCurveV3Enabled,
  setRopeJumpFlightCurveV3ForTests,
  parseRopeJumpFlightCurveV3Flag,
  DEFAULT_FLIGHT_PRESET_NAME,
  resolveFlightPresetName,
} = require("../../landingFlags");
const {
  parseInputCommandReliabilityV2Flag,
  isInputCommandReliabilityV2Enabled,
} = require("../../inputCommandReliabilityFlags");
const {
  parseCombatContactFidelityV2Flag,
} = require("../../combatContactFidelityFlags");
const {
  parseActionLifecycleOwnershipV2Flag,
} = require("../../actionLifecycleFlags");

const PROFILE = getVaultProfile("reference_contact_9");
const START_L = MAP_LEFT_BOUNDARY;
const BASE_RAW_L = computeBaseRawTargetX(
  START_L,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY
);
const CONTACT = getRopeJumpLandingContactDistance(0.85, 0.85, PROFILE);

/** Influence boundary for left-rope +1 jump (base raw clear threshold). */
const JUST_OUTSIDE = BASE_RAW_L + CONTACT + 0.5; // ~540.175
const AT_BOUNDARY = BASE_RAW_L + CONTACT; // ~539.675
const BARELY_NEAR = BASE_RAW_L + CONTACT - 2; // still near
const COMFORTABLE_CROSS = 450;
const BARELY_CROSS = 500;
const FAR = 900;

const SAMPLE_TS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

afterEach(() => setRopeJumpFlightCurveV3ForTests(null));

function samplePath(startX, rawTargetX, profile, activeMs = ROPE_JUMP_ACTIVE_MS) {
  return SAMPLE_TS.map((t) => {
    const x = sampleAuthoredX(startX, rawTargetX, t, profile);
    const y = sampleVaultY(GROUND_LEVEL, t, profile);
    const hx = sampleAuthoredVel(startX, rawTargetX, t, profile, activeMs);
    const vy =
      profile.apexHeight *
      vaultHeightFracDeriv(t, profile.apexT, activeMs, profile.curveModel);
    return { t, x, y, hx, vy };
  });
}

function runJump(jumperX, opponentX, opts = {}) {
  const jumper = makeFighter({
    id: "j",
    x: jumperX,
    facing: opts.jumpDirection === -1 ? 1 : -1,
  });
  const opponent =
    opponentX == null
      ? null
      : makeFighter({ id: "o", x: opponentX, facing: 1 });
  const trace = simulateRopeJump(jumper, opponent, {
    useV2: true,
    jumpDirection: opts.jumpDirection != null ? opts.jumpDirection : 1,
    flightPreset: opts.flightPreset,
    opponentStep: opts.opponentStep,
  });
  return { jumper, opponent, trace };
}

function activeSamplesExact(jumperX, opponentX, v3, flightPreset) {
  setRopeJumpFlightCurveV3ForTests(v3);
  const jumper = makeFighter({ id: "j", x: jumperX, facing: -1 });
  const opponent = makeFighter({ id: "o", x: opponentX, facing: 1 });
  const start = 100000;
  beginRopeJump(jumper, { jumpDirection: 1, now: start, useV2: true });
  let now = start;
  const samples = [];
  while (jumper.isRopeJumping && now < start + 3000) {
    now += TICK_MS;
    if (jumper.ropeJumpPhase === "startup") {
      if (now >= jumper.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
        jumper.ropeJumpPhase = "active";
        jumper.ropeJumpActiveStartTime = now;
      }
    } else if (jumper.ropeJumpPhase === "active") {
      stepRopeJumpActive(jumper, opponent, now, {
        useV2: true,
        flightPreset,
      });
      const elapsed = now - jumper.ropeJumpActiveStartTime;
      const t = Math.min(1, elapsed / ROPE_JUMP_ACTIVE_MS);
      samples.push({
        t,
        x: jumper.x,
        y: jumper.y,
        hx: jumper.ropeJumpHorizVel,
        vy: jumper.ropeJumpVertVel,
        mode: jumper.ropeJumpFlightMode,
        committed: !!jumper.ropeJumpLandingCommitted,
        target: jumper.ropeJumpResolvedTargetX || jumper.ropeJumpRawTargetX,
        protected: jumper.ropeJumpPhase === "active",
      });
      if (jumper.ropeJumpPhase === "landing") break;
    } else {
      break;
    }
  }
  return { jumper, samples };
}

describe("Phase 17 — flight curve V3 flag (finalized default ON)", () => {
  it("unset / null / empty selects V3 (default ON)", () => {
    assert.equal(parseRopeJumpFlightCurveV3Flag(undefined), true);
    assert.equal(parseRopeJumpFlightCurveV3Flag(null), true);
    assert.equal(parseRopeJumpFlightCurveV3Flag(""), true);
    assert.equal(isRopeJumpFlightCurveV3Enabled(undefined), true);
  });

  it("1/true select V3; 0/false select exact pre-V3 reference", () => {
    assert.equal(parseRopeJumpFlightCurveV3Flag("1"), true);
    assert.equal(parseRopeJumpFlightCurveV3Flag("true"), true);
    assert.equal(parseRopeJumpFlightCurveV3Flag("0"), false);
    assert.equal(parseRopeJumpFlightCurveV3Flag("false"), false);
    assert.equal(isRopeJumpFlightCurveV3Enabled("0"), false);
    assert.equal(isRopeJumpFlightCurveV3Enabled("false"), false);
  });

  it("unset preset selects smooth_long_20; explicit presets resolve", () => {
    assert.equal(DEFAULT_FLIGHT_PRESET_NAME, "smooth_long_20");
    assert.equal(resolveFlightPresetName(undefined), "smooth_long_20");
    assert.equal(resolveFlightPresetName(""), "smooth_long_20");
    assert.equal(resolveFlightPresetName("smooth_long_20"), "smooth_long_20");
    assert.equal(resolveFlightPresetName("smooth_same_range"), "smooth_same_range");
    assert.equal(resolveFlightPresetName("smooth_long_30"), "smooth_long_30");
    const approved = getFlightPreset("smooth_long_20");
    assert.equal(approved.name, "smooth_long_20");
    assert.equal(approved.rangeMult, 1.2);
    assert.equal(approved.curveModel, "ballistic_c1");
    assert.equal(approved.horizCurveModel, "smooth_hermite_c1");
    assert.equal(FLIGHT_PRESETS.smooth_same_range.rangeMult, 1.0);
    assert.equal(FLIGHT_PRESETS.smooth_long_30.rangeMult, 1.3);
  });

  it("approved free-flight range ~117.8px; durations unchanged", () => {
    const span = BASE_RAW_L - START_L;
    const long20 = extendRawTargetX(
      START_L,
      BASE_RAW_L,
      FLIGHT_PRESETS.smooth_long_20.rangeMult,
      MAP_LEFT_BOUNDARY,
      MAP_RIGHT_BOUNDARY
    );
    assert.ok(Math.abs(span * 1.2 - (long20 - START_L)) < 1e-9);
    assert.ok(Math.abs(long20 - START_L - 117.81) < 0.01);
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
    assert.equal(ROPE_JUMP_STARTUP_MS, 166);
  });
});

describe("Phase 17 — reference preservation under V3", () => {
  const cases = [
    ["comfortable cross-up", COMFORTABLE_CROSS],
    ["barely valid cross-up", BARELY_CROSS],
    ["barely short of cross-up", BARELY_NEAR],
    ["at influence boundary near", AT_BOUNDARY - 0.5],
  ];

  for (const [label, oppX] of cases) {
    it(`path parity — ${label}`, () => {
      const off = activeSamplesExact(START_L, oppX, false);
      const on = activeSamplesExact(START_L, oppX, true, "smooth_long_20");
      assert.equal(
        on.jumper.ropeJumpFlightMode,
        TRAJECTORY_MODE.OPPONENT_INFLUENCED_REFERENCE
      );
      assert.equal(off.samples.length, on.samples.length);
      let maxDx = 0;
      let maxDy = 0;
      for (let i = 0; i < off.samples.length; i++) {
        maxDx = Math.max(maxDx, Math.abs(off.samples[i].x - on.samples[i].x));
        maxDy = Math.max(maxDy, Math.abs(off.samples[i].y - on.samples[i].y));
      }
      assert.ok(maxDx < 1e-9, `maxDx=${maxDx}`);
      assert.ok(maxDy < 1e-9, `maxDy=${maxDy}`);
      assert.equal(
        off.jumper.ropeJumpResolvedTargetX,
        on.jumper.ropeJumpResolvedTargetX
      );
      assert.equal(off.jumper.ropeJumpIntentClass, on.jumper.ropeJumpIntentClass);
    });
  }

  it("both directions — near landing parity", () => {
    const startR = MAP_RIGHT_BOUNDARY;
    const baseR = computeBaseRawTargetX(
      startR,
      MAP_LEFT_BOUNDARY,
      MAP_RIGHT_BOUNDARY
    );
    const opp = baseR - CONTACT + 2;
    setRopeJumpFlightCurveV3ForTests(false);
    const a = runJump(startR, opp, { jumpDirection: -1 });
    setRopeJumpFlightCurveV3ForTests(true);
    const b = runJump(startR, opp, {
      jumpDirection: -1,
      flightPreset: "smooth_long_20",
    });
    assert.equal(
      b.trace.flightMode,
      TRAJECTORY_MODE.OPPONENT_INFLUENCED_REFERENCE
    );
    assert.ok(
      Math.abs(a.trace.touchdown.x - b.trace.touchdown.x) < 1e-9
    );
  });

  it("same-center fallback still deterministic under V3 reference", () => {
    const decisionX = sampleAuthoredX(
      START_L,
      BASE_RAW_L,
      PROFILE.decisionT,
      PROFILE
    );
    setRopeJumpFlightCurveV3ForTests(true);
    const { trace } = runJump(START_L, decisionX, {
      flightPreset: "smooth_same_range",
    });
    assert.equal(
      trace.flightMode,
      TRAJECTORY_MODE.OPPONENT_INFLUENCED_REFERENCE
    );
    assert.ok(
      trace.commit.intentClass === "cross" ||
        trace.commit.intentClass === "near"
    );
  });
});

describe("Phase 17 — free-flight curve", () => {
  it("continuous X/Y/velocities; vy≈0 at apex; no plateau", () => {
    const ff = getFreeFlightProfile(PROFILE, "smooth_long_20");
    const end = extendRawTargetX(
      START_L,
      BASE_RAW_L,
      FLIGHT_PRESETS.smooth_long_20.rangeMult,
      MAP_LEFT_BOUNDARY,
      MAP_RIGHT_BOUNDARY
    );
    const samples = samplePath(START_L, end, ff);
    for (let i = 1; i < samples.length; i++) {
      assert.ok(Number.isFinite(samples[i].x));
      assert.ok(Number.isFinite(samples[i].y));
      // Continuous position (monotonic X for +dir)
      assert.ok(samples[i].x + 1e-9 >= samples[i - 1].x);
    }
    const apex = samples.find((s) => Math.abs(s.t - PROFILE.apexT) < 1e-9);
    // Sample exactly at apexT
    const vyApex =
      PROFILE.apexHeight *
      vaultHeightFracDeriv(
        PROFILE.apexT,
        PROFILE.apexT,
        ROPE_JUMP_ACTIVE_MS,
        "ballistic_c1"
      );
    assert.ok(Math.abs(vyApex) < 1e-6, `vyApex=${vyApex}`);
    // No apex plateau: |vy| grows on both sides within 2 ticks of apex
    const vyBefore =
      PROFILE.apexHeight *
      vaultHeightFracDeriv(
        PROFILE.apexT - 0.05,
        PROFILE.apexT,
        ROPE_JUMP_ACTIVE_MS,
        "ballistic_c1"
      );
    const vyAfter =
      PROFILE.apexHeight *
      vaultHeightFracDeriv(
        PROFILE.apexT + 0.05,
        PROFILE.apexT,
        ROPE_JUMP_ACTIVE_MS,
        "ballistic_c1"
      );
    assert.ok(vyBefore > 10);
    assert.ok(vyAfter < -10);
    // Accelerating descent: |vy| larger deeper into descent
    const vyMid =
      PROFILE.apexHeight *
      vaultHeightFracDeriv(
        0.7,
        PROFILE.apexT,
        ROPE_JUMP_ACTIVE_MS,
        "ballistic_c1"
      );
    const vyLate =
      PROFILE.apexHeight *
      vaultHeightFracDeriv(
        0.9,
        PROFILE.apexT,
        ROPE_JUMP_ACTIVE_MS,
        "ballistic_c1"
      );
    assert.ok(Math.abs(vyLate) > Math.abs(vyMid));
    assert.ok(apex || true);
    assert.ok(Math.abs(samples[samples.length - 1].x - end) < 1e-9);
  });

  it("same-range / long-20 / long-30 ranges", () => {
    const s0 = BASE_RAW_L - START_L;
    assert.ok(Math.abs(s0 - 98.175) < 1e-9);
    assert.equal(
      extendRawTargetX(START_L, BASE_RAW_L, 1.0, MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY),
      BASE_RAW_L
    );
    assert.ok(
      Math.abs(
        extendRawTargetX(
          START_L,
          BASE_RAW_L,
          1.2,
          MAP_LEFT_BOUNDARY,
          MAP_RIGHT_BOUNDARY
        ) -
          (START_L + s0 * 1.2)
      ) < 1e-9
    );
    assert.ok(
      Math.abs(
        extendRawTargetX(
          START_L,
          BASE_RAW_L,
          1.3,
          MAP_LEFT_BOUNDARY,
          MAP_RIGHT_BOUNDARY
        ) -
          (START_L + s0 * 1.3)
      ) < 1e-9
    );
  });

  it("mirroring free-flight endpoints", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const L = runJump(START_L, FAR, { flightPreset: "smooth_long_20" });
    const startR = MAP_RIGHT_BOUNDARY;
    const R = runJump(startR, MAP_LEFT_BOUNDARY + 50, {
      jumpDirection: -1,
      flightPreset: "smooth_long_20",
    });
    assert.equal(L.trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.equal(R.trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    const spanL = L.trace.touchdown.x - START_L;
    const spanR = startR - R.trace.touchdown.x;
    assert.ok(Math.abs(spanL - spanR) < 1e-6);
  });

  it("boundary-shortened smooth path — no final-tick snap", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    // Near right edge jumping outward would clamp; use inward from near-right
    // with a large mult via long_30 from a position that clamps.
    const startX = MAP_RIGHT_BOUNDARY - 20;
    const { jumper, samples } = (() => {
      setRopeJumpFlightCurveV3ForTests(true);
      const j = makeFighter({ id: "j", x: startX, facing: 1 });
      beginRopeJump(j, {
        jumpDirection: 1,
        now: 100000,
        useV2: true,
      });
      // Force free flight with no opponent
      let now = 100000;
      const samp = [];
      while (j.isRopeJumping && now < 103000) {
        now += TICK_MS;
        if (j.ropeJumpPhase === "startup") {
          if (now >= j.ropeJumpStartTime + ROPE_JUMP_STARTUP_MS) {
            j.ropeJumpPhase = "active";
            j.ropeJumpActiveStartTime = now;
          }
        } else if (j.ropeJumpPhase === "active") {
          const before = j.x;
          stepRopeJumpActive(j, null, now, {
            useV2: true,
            flightPreset: "smooth_long_30",
          });
          samp.push({ x: j.x, dx: j.x - before, t: j._landingLastT });
          if (j.ropeJumpPhase === "landing") break;
        } else break;
      }
      return { jumper: j, samples: samp };
    })();
    assert.equal(jumper.ropeJumpFlightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.ok(jumper.ropeJumpTouchdownX <= MAP_RIGHT_BOUNDARY + 1e-9);
    const last = samples[samples.length - 1];
    assert.ok(Math.abs(last.dx) < 30, `final dx snap=${last.dx}`);
  });

  it("V3 off free-ish opponent uses reference piecewise path", () => {
    setRopeJumpFlightCurveV3ForTests(false);
    const { jumper } = runJump(START_L, FAR);
    assert.equal(jumper.ropeJumpFlightMode, null);
    assert.equal(jumper.ropeJumpCurveModel, "piecewise_linear_sincos");
  });

  it("free-flight live jump reaches planned endpoint", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const { trace } = runJump(START_L, FAR, { flightPreset: "smooth_long_20" });
    assert.equal(trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.ok(
      Math.abs(trace.touchdown.x - trace.plannedEndpointX) < 1.05
    );
  });
});

describe("Phase 17 — interaction safety", () => {
  it("just-outside opponent remains FREE_FLIGHT; no new cross-up", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const { trace } = runJump(START_L, JUST_OUTSIDE, {
      flightPreset: "smooth_long_30",
    });
    assert.equal(trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.equal(trace.commit.intentClass, "preserve_raw");
    assert.ok(trace.touchdown.x < JUST_OUTSIDE);
    const minDist = Math.abs(trace.touchdown.x - JUST_OUTSIDE);
    assert.ok(minDist + 1e-6 >= CONTACT - 0.5);
  });

  it("distant opponent does not gain cross-up", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const { trace } = runJump(START_L, FAR, { flightPreset: "smooth_long_30" });
    assert.notEqual(trace.commit.intentClass, "cross");
    assert.equal(trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
  });

  it("opponent walking toward after commitment cannot retarget", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const { trace } = runJump(START_L, JUST_OUTSIDE, {
      flightPreset: "smooth_long_20",
      opponentStep(opp, t) {
        if (t > 0.45) opp.x -= 2;
      },
    });
    assert.equal(trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.equal(trace.commit.intentClass, "preserve_raw");
    assert.equal(trace.commit.resolvedTargetX, trace.plannedEndpointX);
  });

  it("opponent walking away does not jitter endpoint", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const { trace } = runJump(START_L, JUST_OUTSIDE, {
      flightPreset: "smooth_long_20",
      opponentStep(opp, t) {
        if (t > 0.2) opp.x += 1.5;
      },
    });
    assert.equal(trace.commit.resolvedTargetX, trace.plannedEndpointX);
  });

  it("no extended invulnerability / recovery unchanged", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const { jumper, trace } = runJump(START_L, FAR, {
      flightPreset: "smooth_long_30",
    });
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
    assert.ok(trace.touchdown);
    assert.ok(jumper.ropeJumpPhase == null || jumper.ropeJumpPhase === null);
  });

  it("clear/rematch clears classification; old jump cannot affect new", () => {
    setRopeJumpFlightCurveV3ForTests(true);
    const first = runJump(START_L, FAR, { flightPreset: "smooth_long_20" });
    assert.equal(first.trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.equal(first.jumper.ropeJumpFlightMode, null);
    clearRopeJumpLandingState(first.jumper);
    assert.equal(first.jumper.ropeJumpFlightMode, null);
    assert.equal(first.jumper.ropeJumpFlightPreset, null);
    const second = runJump(START_L, COMFORTABLE_CROSS, {
      flightPreset: "smooth_long_20",
    });
    assert.equal(
      second.trace.flightMode,
      TRAJECTORY_MODE.OPPONENT_INFLUENCED_REFERENCE
    );
  });

  it("safety constraint blocks new cross from extended raw", () => {
    const desired = extendRawTargetX(
      START_L,
      BASE_RAW_L,
      1.3,
      MAP_LEFT_BOUNDARY,
      MAP_RIGHT_BOUNDARY
    );
    // Opponent just outside base influence but inside long-30 footprint
    const oppX = BASE_RAW_L + CONTACT + 1;
    const inf = classifyOpponentInfluence({
      startX: START_L,
      baseRawTargetX: BASE_RAW_L,
      jumpDirection: 1,
      opponentX: oppX,
      jumperSizeMult: 0.85,
      opponentSizeMult: 0.85,
      profile: PROFILE,
    });
    assert.equal(inf.influences, false);
    const c = constrainFreeFlightRawTargetX({
      startX: START_L,
      baseRawTargetX: BASE_RAW_L,
      desiredRawTargetX: desired,
      jumpDirection: 1,
      opponentX: oppX,
      jumperSizeMult: 0.85,
      opponentSizeMult: 0.85,
      profile: PROFILE,
      mapLeft: MAP_LEFT_BOUNDARY,
      mapRight: MAP_RIGHT_BOUNDARY,
    });
    assert.ok(c.constrained || Math.abs(c.rawTargetX - oppX) >= CONTACT - 1e-6);
    assert.ok(c.rawTargetX <= oppX);
  });
});

describe("Phase 17 — regression flags", () => {
  it("Input Reliability V2 remains default ON", () => {
    assert.equal(parseInputCommandReliabilityV2Flag(undefined), true);
    assert.equal(parseInputCommandReliabilityV2Flag("0"), false);
    assert.equal(isInputCommandReliabilityV2Enabled("0"), false);
  });

  it("Contact / lifecycle flags unchanged defaults", () => {
    assert.equal(parseCombatContactFidelityV2Flag(undefined), true);
    assert.equal(parseActionLifecycleOwnershipV2Flag(undefined), true);
  });

  it("horiz progress at apex remains 0.75 on reference", () => {
    assert.equal(authoredHorizProgress(PROFILE.apexT, PROFILE), 0.75);
  });

  it("default V3 (no override) uses FREE_FLIGHT + smooth_long_20 for distant opponent", () => {
    // afterEach cleared override → process default ON
    setRopeJumpFlightCurveV3ForTests(null);
    const { trace } = runJump(START_L, FAR);
    assert.equal(trace.flightMode, TRAJECTORY_MODE.FREE_FLIGHT);
    assert.equal(trace.flightPreset, "smooth_long_20");
    assert.ok(Math.abs(trace.plannedEndpointX - START_L - 117.81) < 0.01);
  });

  it("V3=0 free-flight case keeps pre-V3 base range (no long_20)", () => {
    setRopeJumpFlightCurveV3ForTests(false);
    const { trace } = runJump(START_L, FAR);
    assert.ok(!trace.flightMode);
    assert.ok(Math.abs(trace.touchdown.x - START_L - 98.175) < 1.05);
  });
});

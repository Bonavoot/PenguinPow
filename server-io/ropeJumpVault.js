/**
 * Rope-jump high-vault move identity (V2 path only).
 *
 * Authored vault → apex crossover decision → capped endpoint Hermite descent.
 * Landing settle remains A.3.2 ownership.
 *
 * Approved default: reference_contact_9
 *   — exact pre-polish reference airborne trajectory (156 / 75% H@apex)
 *   — settle allowance 9 → contact 101.5 (0.85/0.85)
 *
 * Rejected polish (dev comparison only): rounded_rejected_floaty
 *
 * See ROPE_JUMP_MOVE_IDENTITY_V2.md / ROPE_JUMP_V2_POLISH_TUNING.md
 */

const {
  ROPE_JUMP_ARC_HEIGHT,
  ROPE_JUMP_CENTER_FRACTION,
} = require("./constants");
const {
  getPushboxHalfWidth,
  getMinimumCenterDistance,
} = require("./pushboxGeometry");
const {
  resolveFlightPresetName,
  DEFAULT_FLIGHT_PRESET_NAME,
} = require("./landingFlags");

/** Phase 17 trajectory classification. */
const TRAJECTORY_MODE = Object.freeze({
  OPPONENT_INFLUENCED_REFERENCE: "OPPONENT_INFLUENCED_REFERENCE",
  FREE_FLIGHT: "FREE_FLIGHT",
});

/**
 * Free-flight development presets (V3 only). Do not alter reference branch.
 * rangeMult applies to the authored base span (CENTER_FRACTION path).
 */
const FLIGHT_PRESETS = Object.freeze({
  smooth_same_range: {
    name: "smooth_same_range",
    rangeMult: 1.0,
    curveModel: "ballistic_c1",
    horizCurveModel: "smooth_hermite_c1",
  },
  smooth_long_20: {
    name: "smooth_long_20",
    rangeMult: 1.2,
    curveModel: "ballistic_c1",
    horizCurveModel: "smooth_hermite_c1",
  },
  smooth_long_30: {
    name: "smooth_long_30",
    rangeMult: 1.3,
    curveModel: "ballistic_c1",
    horizCurveModel: "smooth_hermite_c1",
  },
});

const LEGACY_APEX_HEIGHT = ROPE_JUMP_ARC_HEIGHT; // 120

/** Selected high-vault apex (exact pre-polish reference). */
const REFERENCE_APEX_HEIGHT = Math.round(LEGACY_APEX_HEIGHT * 1.3); // 156

/**
 * Exact reference airborne trajectory (shared by all reference_contact_* presets).
 * Only settleAllowancePx differs between contact variants.
 */
const REFERENCE_TRAJECTORY = {
  apexHeight: REFERENCE_APEX_HEIGHT, // 156
  apexT: 0.42,
  horizFracAtApex: 0.75,
  endpointCorrectionCapPx: 40,
  crossMinFarPadPx: 28,
  decisionT: 0.42,
  curveModel: "piecewise_linear_sincos",
};

function referenceContactPreset(name, settleAllowancePx) {
  return {
    name,
    ...REFERENCE_TRAJECTORY,
    settleAllowancePx,
  };
}

/**
 * Development presets — not player-facing settings.
 *
 * - reference_contact_9 / intended: APPROVED DEFAULT (reference traj + allow 9)
 * - reference / reference_contact_12: same traj, historical allow 12
 * - reference_contact_6: same traj, tighter allow 6 (internal only)
 * - rounded_rejected_floaty: rejected polish (floaty / worse game feel)
 * - conservative / aggressive: rejected A/B experiments
 */
const VAULT_PRESETS = {
  reference_contact_9: referenceContactPreset("reference_contact_9", 9),
  reference: referenceContactPreset("reference", 12),
  reference_contact_12: referenceContactPreset("reference_contact_12", 12),
  reference_contact_6: referenceContactPreset("reference_contact_6", 6),
  /**
   * Rejected polish — lighter/floatier, more triangular in motion despite
   * better numeric H-velocity continuity. Dev comparison only.
   */
  rounded_rejected_floaty: {
    name: "rounded_rejected_floaty",
    apexHeight: Math.round(REFERENCE_APEX_HEIGHT * 0.93), // ~145
    apexT: 0.43,
    horizFracAtApex: 0.69,
    endpointCorrectionCapPx: 40,
    settleAllowancePx: 6,
    crossMinFarPadPx: 28,
    decisionT: 0.43,
    curveModel: "smooth_hermite_c1",
    rejected: true,
    rejectedReason: "floaty_triangular_gamefeel",
  },
  conservative: {
    name: "conservative",
    apexHeight: Math.round(REFERENCE_APEX_HEIGHT * 0.9), // ~140
    apexT: 0.44,
    horizFracAtApex: 0.66,
    endpointCorrectionCapPx: 40,
    settleAllowancePx: 4,
    crossMinFarPadPx: 28,
    decisionT: 0.44,
    curveModel: "smooth_hermite_c1",
    rejected: true,
  },
  aggressive: {
    name: "aggressive",
    apexHeight: Math.round(LEGACY_APEX_HEIGHT * 1.4), // 168
    apexT: 0.4,
    horizFracAtApex: 0.72,
    endpointCorrectionCapPx: 40,
    settleAllowancePx: 6,
    crossMinFarPadPx: 32,
    decisionT: 0.4,
    curveModel: "smooth_hermite_c1",
    rejected: true,
  },
};

/** Deprecated alias → rejected polish (must not be `intended`). */
VAULT_PRESETS.rounded = {
  ...VAULT_PRESETS.rounded_rejected_floaty,
  name: "rounded",
};
/** `intended` = approved default (reference traj + contact allow 9). Not rounded. */
VAULT_PRESETS.intended = {
  ...VAULT_PRESETS.reference_contact_9,
  name: "intended",
};

const DEFAULT_PRESET_NAME = "reference_contact_9";

function resolveVaultPresetName(name) {
  const raw =
    name != null && name !== ""
      ? name
      : process.env.ROPE_JUMP_VAULT_PRESET;
  if (raw == null || raw === "") {
    return DEFAULT_PRESET_NAME;
  }
  const key = String(raw).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(VAULT_PRESETS, key) && VAULT_PRESETS[key]) {
    return key;
  }
  console.warn(
    `[ropeJumpVault] unknown ROPE_JUMP_VAULT_PRESET=${JSON.stringify(
      String(raw)
    )}; falling back to ${DEFAULT_PRESET_NAME}`
  );
  return DEFAULT_PRESET_NAME;
}

function getVaultProfile(name) {
  return { ...VAULT_PRESETS[resolveVaultPresetName(name)] };
}

/** Cubic Hermite scalar: p0→p1 over [t0,t1] with endpoint derivatives v0,v1 (per unit t). */
function hermiteScalar(t0, p0, v0, t1, p1, v1, t) {
  const dt = t1 - t0;
  if (dt <= 1e-12) return p1;
  const s = Math.max(0, Math.min(1, (t - t0) / dt));
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * p0 + h10 * v0 * dt + h01 * p1 + h11 * v1 * dt;
}

function hermiteScalarDeriv(t0, p0, v0, t1, p1, v1, t) {
  const dt = t1 - t0;
  if (dt <= 1e-12) return 0;
  const s = Math.max(0, Math.min(1, (t - t0) / dt));
  const s2 = s * s;
  // d/ds of basis
  const dh00 = 6 * s2 - 6 * s;
  const dh10 = 3 * s2 - 4 * s + 1;
  const dh01 = -6 * s2 + 6 * s;
  const dh11 = 3 * s2 - 2 * s;
  const dpds = dh00 * p0 + dh10 * v0 * dt + dh01 * p1 + dh11 * v1 * dt;
  return dpds / dt;
}

/**
 * Smoothstep 0→1 (C1 at ends). Used for rounded vertical vault halves.
 */
function smoothstep(s) {
  const x = Math.max(0, Math.min(1, s));
  return x * x * (3 - 2 * x);
}

function smoothstepDeriv(s) {
  const x = Math.max(0, Math.min(1, s));
  return 6 * x * (1 - x);
}

/**
 * Authored horizontal progress along start→rawTarget.
 *
 * smooth_hermite_c1: two Hermite segments with matched apex velocity so the
 * path does not form a triangular kink. Target frac at apexT.
 *
 * piecewise_linear_sincos: legacy reference (velocity kink at apex).
 */
function horizCurveModelOf(profile) {
  return (
    profile.horizCurveModel ||
    (profile.curveModel === "ballistic_c1"
      ? "smooth_hermite_c1"
      : profile.curveModel)
  );
}

function authoredHorizProgress(t, profile) {
  const apexT = profile.apexT;
  const frac = profile.horizFracAtApex;
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const horizModel = horizCurveModelOf(profile);
  if (horizModel === "piecewise_linear_sincos") {
    if (t <= apexT) return frac * (t / apexT);
    return frac + (1 - frac) * ((t - apexT) / (1 - apexT));
  }

  const rateA = frac / Math.max(1e-6, apexT);
  const rateD = (1 - frac) / Math.max(1e-6, 1 - apexT);
  // Harmonic-ish blend — continuous, avoids either segment's extreme kink.
  const vApex = (2 * rateA * rateD) / Math.max(1e-6, rateA + rateD);
  const v0 = rateA * 0.55;
  const v1 = rateD * 0.35;

  if (t <= apexT) {
    return hermiteScalar(0, 0, v0, apexT, frac, vApex, t);
  }
  return hermiteScalar(apexT, frac, vApex, 1, 1, v1, t);
}

function authoredHorizProgressDeriv(t, profile, activeMs) {
  const invSec = 1000 / activeMs;
  const apexT = profile.apexT;
  const frac = profile.horizFracAtApex;
  if (t <= 0 || t >= 1) return 0;

  const horizModel = horizCurveModelOf(profile);
  if (horizModel === "piecewise_linear_sincos") {
    if (t <= apexT) return (frac / apexT) * invSec;
    return ((1 - frac) / (1 - apexT)) * invSec;
  }

  const rateA = frac / Math.max(1e-6, apexT);
  const rateD = (1 - frac) / Math.max(1e-6, 1 - apexT);
  const vApex = (2 * rateA * rateD) / Math.max(1e-6, rateA + rateD);
  const v0 = rateA * 0.55;
  const v1 = rateD * 0.35;

  let dpdt;
  if (t <= apexT) {
    dpdt = hermiteScalarDeriv(0, 0, v0, apexT, frac, vApex, t);
  } else {
    dpdt = hermiteScalarDeriv(apexT, frac, vApex, 1, 1, v1, t);
  }
  return dpdt * invSec;
}

/**
 * Vertical vault height fraction in [0,1].
 * Rounded model: smoothstep ascent/descent with h'=0 at apex (C1/C2 join).
 * Reference model: sin/cos (C1 at apex, sharper visual corner with H kink).
 */
function vaultHeightFrac(t, apexT, curveModel = "smooth_hermite_c1") {
  if (t <= 0 || t >= 1) return 0;
  if (curveModel === "piecewise_linear_sincos") {
    if (t <= apexT) {
      const s = t / apexT;
      return Math.sin((Math.PI / 2) * s);
    }
    const s = (t - apexT) / (1 - apexT);
    return Math.cos((Math.PI / 2) * s);
  }
  // Phase 17 free-flight: asymmetric ballistic halves with vy=0 at apex (C1).
  if (curveModel === "ballistic_c1") {
    if (t <= apexT) {
      const u = 1 - t / apexT;
      return 1 - u * u;
    }
    const u = (t - apexT) / (1 - apexT);
    return 1 - u * u;
  }
  if (t <= apexT) {
    return smoothstep(t / apexT);
  }
  return smoothstep(1 - (t - apexT) / (1 - apexT));
}

function vaultHeightFracDeriv(t, apexT, activeMs, curveModel = "smooth_hermite_c1") {
  const invSec = 1000 / activeMs;
  if (t <= 0 || t >= 1) return 0;
  if (curveModel === "piecewise_linear_sincos") {
    if (t <= apexT) {
      const s = t / apexT;
      return (
        ((Math.PI / 2) * Math.cos((Math.PI / 2) * s) * (1 / apexT)) * invSec
      );
    }
    const s = (t - apexT) / (1 - apexT);
    return (
      (-(Math.PI / 2) * Math.sin((Math.PI / 2) * s) * (1 / (1 - apexT))) *
      invSec
    );
  }
  if (curveModel === "ballistic_c1") {
    if (t <= apexT) {
      // d/dt [1 - (1 - t/a)^2] = 2(1 - t/a)/a
      return ((2 * (1 - t / apexT)) / apexT) * invSec;
    }
    const u = (t - apexT) / (1 - apexT);
    // d/dt [1 - u^2] = -2u/(1-a)
    return ((-2 * u) / (1 - apexT)) * invSec;
  }
  if (t <= apexT) {
    return (smoothstepDeriv(t / apexT) / apexT) * invSec;
  }
  const u = (t - apexT) / (1 - apexT);
  // d/dt smoothstep(1-u) = smoothstepDeriv(1-u) * (-du/dt)
  return (-smoothstepDeriv(1 - u) / (1 - apexT)) * invSec;
}

function sampleAuthoredX(startX, rawTargetX, t, profile) {
  const p = authoredHorizProgress(t, profile);
  return startX + (rawTargetX - startX) * p;
}

function sampleAuthoredVel(startX, rawTargetX, t, profile, activeMs) {
  const dpdt = authoredHorizProgressDeriv(t, profile, activeMs);
  return (rawTargetX - startX) * dpdt;
}

function sampleVaultY(groundLevel, t, profile) {
  return (
    groundLevel +
    profile.apexHeight *
      vaultHeightFrac(t, profile.apexT, profile.curveModel)
  );
}

/**
 * Classify apex continuity from discrete 64 Hz samples around apexT.
 * Development diagnostic only.
 */
function classifyApexCurve(samples, apexT, opts = {}) {
  const velKinkPxPerSec = opts.velKinkPxPerSec != null ? opts.velKinkPxPerSec : 120;
  const accelKinkPxPerSec2 =
    opts.accelKinkPxPerSec2 != null ? opts.accelKinkPxPerSec2 : 18000;
  if (!samples || samples.length < 3) {
    return { class: "apex_curve_smooth", reason: "insufficient_samples" };
  }
  // Find sample nearest apex and neighbors.
  let best = 0;
  let bestDt = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const dt = Math.abs((samples[i].t || 0) - apexT);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }
  const i0 = Math.max(0, best - 1);
  const i1 = best;
  const i2 = Math.min(samples.length - 1, best + 1);
  const a = samples[i0];
  const b = samples[i1];
  const c = samples[i2];
  const hvBefore = a.horizVel != null ? a.horizVel : a.vel;
  const hvAfter = c.horizVel != null ? c.horizVel : c.vel;
  const vvBefore = a.vertVel != null ? a.vertVel : 0;
  const vvAfter = c.vertVel != null ? c.vertVel : 0;
  const dhv = Math.abs((hvAfter || 0) - (hvBefore || 0));
  const dvv = Math.abs((vvAfter || 0) - (vvBefore || 0));
  const ahBefore = a.horizAccel != null ? a.horizAccel : 0;
  const ahAfter = c.horizAccel != null ? c.horizAccel : 0;
  const dAccel = Math.abs(ahAfter - ahBefore);

  let cls = "apex_curve_smooth";
  if (dhv > velKinkPxPerSec) cls = "apex_velocity_kink";
  else if (dAccel > accelKinkPxPerSec2) cls = "apex_acceleration_kink";

  // Triangular risk: large H vel drop + near-vertical post-apex (small |hx| vs |vy|).
  const postSpeed = Math.hypot(hvAfter || 0, vvAfter || 0);
  const postHRatio =
    postSpeed > 1e-3 ? Math.abs(hvAfter || 0) / postSpeed : 1;
  const triangular =
    dhv > velKinkPxPerSec * 0.75 && postHRatio < 0.35 && cls !== "apex_curve_smooth";

  return {
    class: triangular ? "triangular_path_risk" : cls,
    apexSampleT: b.t,
    velBefore: { h: hvBefore, v: vvBefore },
    velAfter: { h: hvAfter, v: vvAfter },
    horizVelDelta: dhv,
    vertVelDelta: dvv,
    horizAccelDelta: dAccel,
    postHRatio,
    before: { x: a.x, y: a.y, t: a.t },
    apex: { x: b.x, y: b.y, t: b.t },
    after: { x: c.x, y: c.y, t: c.t },
  };
}

/**
 * Rope-jump touchdown contact distance (smaller than full grounded rest).
 * Remaining debt is owned by A.3.2 landing settle during recovery.
 */
function getRopeJumpLandingContactDistance(
  jumperSizeMult,
  opponentSizeMult,
  profile
) {
  const grounded = getMinimumCenterDistance(jumperSizeMult, opponentSizeMult);
  const allow =
    profile && profile.settleAllowancePx != null
      ? profile.settleAllowancePx
      : getVaultProfile().settleAllowancePx;
  return Math.max(1, grounded - allow);
}

/**
 * Apex crossover decision — one stable lock.
 *
 * Visible rule at the decision sample:
 * 1. Authored raw footprint clear of contact → preserve_raw.
 * 2. Jumper center crossed opponent center in jump direction → cross/far.
 * 3. Else try near-side contact. If that contact lies behind the decision X
 *    (would reverse), promote to capped cross — never invisible-wall brake.
 */
function decideApexCrossover({
  jumperX,
  rawTargetX,
  jumpDirection,
  opponentX,
  jumperSizeMult,
  opponentSizeMult,
  profile,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const contactDist = getRopeJumpLandingContactDistance(
    jumperSizeMult,
    opponentSizeMult,
    profile
  );
  const grounded = getMinimumCenterDistance(jumperSizeMult, opponentSizeMult);
  const rawClear = Math.abs(rawTargetX - opponentX) >= contactDist - 1e-9;
  const centerCrossed = (jumperX - opponentX) * dir > 1e-6;

  if (rawClear && !centerCrossed) {
    const side =
      rawTargetX < opponentX ? -1 : rawTargetX > opponentX ? 1 : dir;
    return {
      side,
      intentClass: "preserve_raw",
      reason: "authored_raw_clear_at_apex",
      centerCrossed: false,
      contactDist,
      groundedDist: grounded,
    };
  }

  if (centerCrossed) {
    return {
      side: dir,
      intentClass: "cross",
      reason: "apex_center_crossed",
      centerCrossed: true,
      contactDist,
      groundedDist: grounded,
    };
  }

  const nearIdeal = opponentX - dir * contactDist;
  if ((nearIdeal - jumperX) * dir < -1e-6) {
    return {
      side: dir,
      intentClass: "cross",
      reason: "near_unreachable_without_reverse_promote_cross",
      centerCrossed: false,
      contactDist,
      groundedDist: grounded,
    };
  }

  return {
    side: -dir,
    intentClass: "near",
    reason: "apex_not_crossed_near_reachable",
    centerCrossed: false,
    contactDist,
    groundedDist: grounded,
  };
}

/**
 * Cap opponent-relative endpoint vs authored raw.
 * Never reverses toward the originating rope. Excess debt → landing settle.
 */
function resolveCappedEndpoint({
  authoredEndX,
  jumpDirection,
  opponentX,
  intentClass,
  side,
  contactDist,
  mapLeft,
  mapRight,
  correctionCapPx,
  decisionX,
  crossMinFarPadPx = 28,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const cap = correctionCapPx;
  const isCross = intentClass === "cross" || side === dir;
  let desiredBeforeCap;
  if (intentClass === "preserve_raw") {
    desiredBeforeCap = authoredEndX;
  } else if (isCross) {
    desiredBeforeCap = opponentX + dir * contactDist;
  } else {
    desiredBeforeCap = opponentX - dir * contactDist;
  }

  let desired = Math.max(mapLeft, Math.min(mapRight, desiredBeforeCap));
  const floorX = decisionX != null ? decisionX : authoredEndX;
  if ((desired - floorX) * dir < 0) {
    desired = floorX;
  }

  let delta = desired - authoredEndX;
  if (delta * dir < 0) {
    delta = 0;
    desired = authoredEndX;
  }

  let capped = false;
  if (Math.abs(delta) > cap + 1e-9) {
    delta = dir * cap;
    desired = authoredEndX + delta;
    capped = true;
  }

  if (isCross) {
    const farFloor = opponentX + dir * crossMinFarPadPx;
    if ((desired - farFloor) * dir < 0) {
      desired = farFloor;
      if (Math.abs(desired - authoredEndX) > cap + 1e-9) {
        capped = true;
      }
    }
  }

  if (decisionX != null && (desired - decisionX) * dir < -1e-6) {
    desired = decisionX;
  }

  desired = Math.max(mapLeft, Math.min(mapRight, desired));
  return {
    authoredEndX,
    desiredBeforeCap,
    resolvedTargetX: desired,
    correctionMagnitude: Math.abs(desired - authoredEndX),
    correctionCapPx: cap,
    correctionCapped: capped,
    predictedSettleDebt: 0,
  };
}

/**
 * Post-decision descent X: Hermite from decision pose to capped endpoint.
 */
function sampleVaultDescentX({
  commitX,
  commitVel,
  endpointX,
  commitT,
  t,
  activeMs,
}) {
  const remainingSec = Math.max(0, (1 - commitT) * (activeMs / 1000));
  const elapsedSec = Math.max(0, (t - commitT) * (activeMs / 1000));
  const s =
    remainingSec <= 1e-9 ? 1 : Math.max(0, Math.min(1, elapsedSec / remainingSec));
  const t2 = s * s;
  const t3 = t2 * s;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + s;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return (
    h00 * commitX +
    h10 * commitVel * remainingSec +
    h01 * endpointX +
    h11 * 0
  );
}

/** Explicit vulnerability / protection lifecycle (phase-authoritative). */
function isRopeJumpStartupVulnerable(player) {
  return !!(player && player.isRopeJumping && player.ropeJumpPhase === "startup");
}

function isRopeJumpAirborneProtected(player) {
  return !!(player && player.isRopeJumping && player.ropeJumpPhase === "active");
}

function isRopeJumpLandingVulnerable(player) {
  return !!(player && player.isRopeJumping && player.ropeJumpPhase === "landing");
}

function getRopeJumpVulnerabilityState(player) {
  if (!player || !player.isRopeJumping) {
    return {
      phase: null,
      startupVulnerable: false,
      airborneProtected: false,
      landingVulnerable: false,
    };
  }
  return {
    phase: player.ropeJumpPhase,
    startupVulnerable: isRopeJumpStartupVulnerable(player),
    airborneProtected: isRopeJumpAirborneProtected(player),
    landingVulnerable: isRopeJumpLandingVulnerable(player),
  };
}

/**
 * Authored base raw from CENTER_FRACTION (same as startRopeJump).
 */
function computeBaseRawTargetX(startX, mapLeft, mapRight) {
  const mapMidpoint = (mapLeft + mapRight) / 2;
  return Math.max(
    mapLeft,
    Math.min(startX + (mapMidpoint - startX) * ROPE_JUMP_CENTER_FRACTION, mapRight)
  );
}

/**
 * Extend base raw span by rangeMult, then map-clamp.
 * Boundary shortening preserves the clamped endpoint as the curve target
 * (no long-curve-then-snap).
 */
function extendRawTargetX(startX, baseRawTargetX, rangeMult, mapLeft, mapRight) {
  const mult = rangeMult != null ? rangeMult : 1;
  const extended = startX + (baseRawTargetX - startX) * mult;
  return Math.max(mapLeft, Math.min(extended, mapRight));
}

function getFlightPreset(name) {
  const key = resolveFlightPresetName(name);
  return FLIGHT_PRESETS[key] || FLIGHT_PRESETS[DEFAULT_FLIGHT_PRESET_NAME];
}

/**
 * Free-flight profile: same apex/decision/settle contract as reference,
 * ballistic vertical + smooth Hermite horizontal only.
 */
function getFreeFlightProfile(baseProfile, flightPresetName) {
  const base = baseProfile || getVaultProfile();
  const fp = getFlightPreset(flightPresetName);
  return {
    ...base,
    curveModel: fp.curveModel,
    horizCurveModel: fp.horizCurveModel,
    flightPreset: fp.name,
    rangeMult: fp.rangeMult,
  };
}

/**
 * Opponent-influence probe using the approved apex crossover predicate on the
 * **base** raw footprint (never the free-flight-extended endpoint).
 * Classification locks on first active tick — no late mode flip / no new
 * long-range cross-up from extended range alone.
 */
function classifyOpponentInfluence({
  startX,
  baseRawTargetX,
  jumpDirection,
  opponentX,
  jumperSizeMult,
  opponentSizeMult,
  profile,
}) {
  const ref = profile || getVaultProfile();
  const decisionX = sampleAuthoredX(
    startX,
    baseRawTargetX,
    ref.decisionT,
    ref
  );
  if (opponentX == null || !Number.isFinite(opponentX)) {
    return {
      influences: false,
      intentClass: "preserve_raw",
      reason: "no_opponent",
      decisionX,
      contactDist: 0,
      groundedDist: 0,
    };
  }
  const cross = decideApexCrossover({
    jumperX: decisionX,
    rawTargetX: baseRawTargetX,
    jumpDirection,
    opponentX,
    jumperSizeMult,
    opponentSizeMult,
    profile: ref,
  });
  return {
    influences: cross.intentClass !== "preserve_raw",
    intentClass: cross.intentClass,
    reason: cross.reason,
    decisionX,
    contactDist: cross.contactDist,
    groundedDist: cross.groundedDist,
  };
}

/**
 * Safe free-flight destination: may lengthen vs base raw, but must not create
 * a new cross-up or enter the approved contact footprint against a
 * non-influencing opponent.
 */
function constrainFreeFlightRawTargetX({
  startX,
  baseRawTargetX,
  desiredRawTargetX,
  jumpDirection,
  opponentX,
  jumperSizeMult,
  opponentSizeMult,
  profile,
  mapLeft,
  mapRight,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const unclamped = desiredRawTargetX;
  let desired = Math.max(mapLeft, Math.min(desiredRawTargetX, mapRight));
  const boundaryShortened = Math.abs(desired - unclamped) > 1e-6;

  if (opponentX == null || !Number.isFinite(opponentX)) {
    return {
      rawTargetX: desired,
      reason: boundaryShortened ? "boundary_shortened" : "full_selected_range",
      constrained: false,
      boundaryShortened,
    };
  }

  const contactDist = getRopeJumpLandingContactDistance(
    jumperSizeMult,
    opponentSizeMult,
    profile
  );

  // Opponent behind jump origin relative to jump direction → full range.
  if ((opponentX - startX) * dir <= 1e-9) {
    return {
      rawTargetX: desired,
      reason: boundaryShortened ? "boundary_shortened" : "opponent_behind",
      constrained: false,
      boundaryShortened,
    };
  }

  // Would the extended raw cross past the opponent center?
  const startAheadOfOpp = (startX - opponentX) * dir;
  const endPastOpp = (desired - opponentX) * dir;
  const wouldCross = startAheadOfOpp <= 1e-9 && endPastOpp > 1e-9;
  const endClear = Math.abs(desired - opponentX) >= contactDist - 1e-9;

  if (!wouldCross && endClear) {
    if ((opponentX - desired) * dir >= contactDist - 1e-9) {
      return {
        rawTargetX: desired,
        reason: boundaryShortened
          ? "boundary_shortened"
          : "opponent_beyond_destination",
        constrained: false,
        boundaryShortened,
      };
    }
    return {
      rawTargetX: desired,
      reason: boundaryShortened ? "boundary_shortened" : "authored_clear",
      constrained: false,
      boundaryShortened,
    };
  }

  // Pull back to near-side contact — never grant a new cross.
  let safe = opponentX - dir * contactDist;
  if ((safe - startX) * dir < 0) safe = startX;
  if ((safe - desired) * dir > 0) safe = desired;
  // Base raw was clear (FREE_FLIGHT classification); never land shorter than base
  // unless the safety point itself is shorter (should not happen for preserve_raw).
  if (
    (safe - baseRawTargetX) * dir < -1e-9 &&
    Math.abs(baseRawTargetX - opponentX) >= contactDist - 1e-9
  ) {
    safe = baseRawTargetX;
  }
  safe = Math.max(mapLeft, Math.min(safe, mapRight));

  return {
    rawTargetX: safe,
    reason: wouldCross
      ? "safety_near_contact_no_new_cross"
      : "safety_margin_contact",
    constrained: Math.abs(safe - desired) > 1e-9,
    boundaryShortened: boundaryShortened || safe === mapLeft || safe === mapRight,
  };
}

/**
 * Lock trajectory mode for this jump instance (first active tick).
 */
function classifyRopeJumpFlightMode(args) {
  const influence = classifyOpponentInfluence(args);
  if (influence.influences) {
    return {
      mode: TRAJECTORY_MODE.OPPONENT_INFLUENCED_REFERENCE,
      influence,
    };
  }
  return {
    mode: TRAJECTORY_MODE.FREE_FLIGHT,
    influence,
  };
}

module.exports = {
  LEGACY_APEX_HEIGHT,
  REFERENCE_APEX_HEIGHT,
  REFERENCE_TRAJECTORY,
  VAULT_PRESETS,
  DEFAULT_PRESET_NAME,
  TRAJECTORY_MODE,
  FLIGHT_PRESETS,
  resolveVaultPresetName,
  getVaultProfile,
  referenceContactPreset,
  hermiteScalar,
  hermiteScalarDeriv,
  authoredHorizProgress,
  authoredHorizProgressDeriv,
  vaultHeightFrac,
  vaultHeightFracDeriv,
  sampleAuthoredX,
  sampleAuthoredVel,
  sampleVaultY,
  classifyApexCurve,
  getRopeJumpLandingContactDistance,
  decideApexCrossover,
  resolveCappedEndpoint,
  sampleVaultDescentX,
  isRopeJumpStartupVulnerable,
  isRopeJumpAirborneProtected,
  isRopeJumpLandingVulnerable,
  getRopeJumpVulnerabilityState,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
  smoothstep,
  computeBaseRawTargetX,
  extendRawTargetX,
  getFlightPreset,
  getFreeFlightProfile,
  classifyOpponentInfluence,
  constrainFreeFlightRawTargetX,
  classifyRopeJumpFlightMode,
};

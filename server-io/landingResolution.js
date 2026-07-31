/**
 * Aerial landing resolution — Phase A / A.1 (rope jump only).
 *
 * Phase A: deterministic pushbox-clear endpoint commit (flagged).
 * Phase A.1: motion-aware post-commit trajectory, feasibility-aware endpoint
 * selection, early lock when waiting would force a late reverse, and bounded
 * residual preference over extreme cross-ups.
 *
 * Gated by ROPE_JUMP_LANDING_V2 (see landingFlags.js). Default OFF.
 */

const {
  GROUND_LEVEL,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_ARC_HEIGHT,
  ROPE_JUMP_LANDING_COMMIT_T,
  ROPE_JUMP_LANDING_COMMIT_T_MIN,
  TICK_RATE,
} = require("./constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");
const {
  getPushboxHalfWidth,
  getMinimumCenterDistance,
} = require("./pushboxGeometry");
const {
  ROPE_JUMP_LANDING_V2,
  LANDING_TRACE,
  LANDING_DEBUG_NET,
} = require("./landingFlags");

/** Centers within this world-px band are treated as ambiguous for side intent. */
const SIDE_AMBIGUITY_EPSILON_PX = 1;
/**
 * Tiny pad past exact min-separation so float rounding cannot re-enter the
 * pushbox on the touchdown frame (e.g. 110.49999999999994 < 110.5).
 */
const LANDING_SEPARATION_PAD_PX = 0.01;

/**
 * Tolerable bounded touchdown residual overlap (world px).
 *
 * Why 18: equals the existing rope-jump landing safety correction cap
 * (`adjustPlayerPositions` effectiveOverlap clamp). One 64 Hz tick of safety
 * motion (≤15.625 ms) is usually absorbed inside landing recovery / screen
 * shake and is far cheaper than a forced cross-up that more than doubles
 * horizontal travel. Deep overlaps (~half-body, ~110 px at default size) are
 * NOT tolerated — those remain the bug V2 exists to prevent.
 */
const TOLERABLE_TOUCHDOWN_OVERLAP_PX = 18;

/**
 * Max ratio of |resolved−commit| to |raw−start| before a cross-up is considered
 * an extreme path distortion. Measured: Case 3 alternate travel ≈ 1.6× the
 * full raw span; we reject cross-ups above this when a tolerable residual
 * preferred-side option exists.
 */
const MAX_CROSSUP_TRAVEL_RATIO = 1.35;

/**
 * If |endpoint − commitX| is below this, use hold_settle instead of Hermite
 * (avoids Hermite overshoot/reverse on near-zero remaining travel).
 */
const HOLD_SETTLE_EPS_PX = 0.75;

/**
 * Hold-settle may kill horizontal velocity only when |commitVel| is below this
 * (px/s). Early-lock boundary settles are ~40–110 px/s; late kills at ~330 px/s
 * are not allowed (would reintroduce a visible speed pop).
 */
const HOLD_SETTLE_MAX_COMMIT_VEL = 120;

/**
 * When Hermite would reverse into a nearby forward endpoint (can't brake with
 * matched tangents), use quadratic ease-out brake instead. Allows a bounded
 * velocity discontinuity at commit of at most this many px/s — still far
 * smaller than a forced 4× cross-up spike (~1000 px/s).
 */
const BRAKE_MAX_VEL_DISCONTINUITY = 400;

/** Sample count for Hermite monotonicity / peak estimates (deterministic). */
const HERMITE_SAMPLE_STEPS = 16;

const TICK_MS = 1000 / TICK_RATE;

/** Cosine ease-in-out used by the rope-jump horizontal arc (matches index.js). */
function ropeJumpEase(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));
}

/** d(ease)/dt for t in [0,1]. */
function ropeJumpEaseDeriv(t) {
  const tc = Math.max(0, Math.min(1, t));
  return 0.5 * Math.PI * Math.sin(Math.PI * tc);
}

function clampToMap(x, mapLeft, mapRight) {
  if (!Number.isFinite(x)) return mapLeft;
  return Math.max(mapLeft, Math.min(x, mapRight));
}

function rawArcX(startX, rawTargetX, t) {
  return startX + (rawTargetX - startX) * ropeJumpEase(t);
}

/** Horizontal velocity of the raw ease arc in world px/s. */
function rawArcVelocity(startX, rawTargetX, t, activeMs) {
  const durationSec = (activeMs != null ? activeMs : ROPE_JUMP_ACTIVE_MS) / 1000;
  if (durationSec <= 1e-9) return 0;
  return ((rawTargetX - startX) * ropeJumpEaseDeriv(t)) / durationSec;
}

/**
 * Cubic Hermite: position at normalized s∈[0,1].
 * v0/v1 are px/s; durationSec scales tangent magnitudes.
 */
function hermitePosition(p0, v0, p1, v1, s, durationSec) {
  const T = Math.max(durationSec, 1e-9);
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * p0 + h10 * (v0 * T) + h01 * p1 + h11 * (v1 * T);
}

/** Cubic Hermite velocity (px/s) at s∈[0,1]. */
function hermiteVelocity(p0, v0, p1, v1, s, durationSec) {
  const T = Math.max(durationSec, 1e-9);
  const s2 = s * s;
  const dh00 = 6 * s2 - 6 * s;
  const dh10 = 3 * s2 - 4 * s + 1;
  const dh01 = -6 * s2 + 6 * s;
  const dh11 = 3 * s2 - 2 * s;
  const dHds =
    dh00 * p0 + dh10 * (v0 * T) + dh01 * p1 + dh11 * (v1 * T);
  return dHds / T;
}

/**
 * True when the raw start→target segment crosses the opponent's center.
 * Near-equal start centers are not a cross-up by themselves.
 */
function didRawPathCrossOpponent(jumperStartX, rawTargetX, opponentX) {
  const startDelta = jumperStartX - opponentX;
  const rawDelta = rawTargetX - opponentX;
  if (Math.abs(startDelta) < SIDE_AMBIGUITY_EPSILON_PX) return false;
  return startDelta * rawDelta < 0;
}

/**
 * Preferred landing side relative to opponent:
 *   +1 = land to the opponent's right
 *   -1 = land to the opponent's left
 */
function choosePreferredLandingSide({
  rawTargetX,
  jumperStartX,
  jumpDirection,
  opponentX,
  minimumDistance,
  preferredSide: override = null,
}) {
  if (override === 1 || override === -1) return override;

  const rawOverlap = Math.max(0, minimumDistance - Math.abs(rawTargetX - opponentX));
  const crossed = didRawPathCrossOpponent(jumperStartX, rawTargetX, opponentX);
  const rawOnCenter =
    Math.abs(rawTargetX - opponentX) < SIDE_AMBIGUITY_EPSILON_PX;

  if (crossed || (rawOverlap > 0 && rawOnCenter)) {
    return jumpDirection >= 0 ? 1 : -1;
  }

  if (rawOverlap > 0) {
    if (Math.abs(jumperStartX - opponentX) < SIDE_AMBIGUITY_EPSILON_PX) {
      return jumpDirection >= 0 ? 1 : -1;
    }
    return jumperStartX < opponentX ? -1 : 1;
  }

  if (rawOnCenter) {
    return jumpDirection >= 0 ? 1 : -1;
  }
  return rawTargetX < opponentX ? -1 : 1;
}

function sideEndpoint(opponentX, side, minimumDistance) {
  return opponentX + side * (minimumDistance + LANDING_SEPARATION_PAD_PX);
}

/** Endpoint is behind commit relative to jump direction (would reverse). */
function isEndpointBehind(commitX, endpointX, jumpDirection) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  return (endpointX - commitX) * dir < -HOLD_SETTLE_EPS_PX;
}

/** Forward-clamp endpoint so it is not behind commit (dir-aware). */
function forwardClampEndpoint(commitX, endpointX, jumpDirection) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  if (dir >= 0) return Math.max(commitX, endpointX);
  return Math.min(commitX, endpointX);
}

/**
 * Evaluate Hermite path quality for commit → endpoint with terminal vel 0.
 * Deterministic discrete samples (no RNG).
 */
function evaluateHermiteFeasibility({
  commitX,
  commitVel,
  endpointX,
  remainingSec,
  jumpDirection,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const T = Math.max(remainingSec, 1e-9);
  const travel = endpointX - commitX;
  const behind = isEndpointBehind(commitX, endpointX, dir);

  let peakVel = Math.abs(commitVel);
  let peakAccel = 0;
  let minDirVel = Infinity;
  let reverse = behind;
  let prevVel = commitVel;

  for (let i = 1; i <= HERMITE_SAMPLE_STEPS; i++) {
    const s = i / HERMITE_SAMPLE_STEPS;
    const vel = hermiteVelocity(commitX, commitVel, endpointX, 0, s, T);
    peakVel = Math.max(peakVel, Math.abs(vel));
    const accel = Math.abs(vel - prevVel) / (T / HERMITE_SAMPLE_STEPS);
    peakAccel = Math.max(peakAccel, accel);
    minDirVel = Math.min(minDirVel, vel * dir);
    if (vel * dir < -1) reverse = true;
    prevVel = vel;
  }

  return {
    behind,
    reverse,
    peakVel,
    peakAccel,
    minDirVel,
    travel: Math.abs(travel),
    signedTravel: travel,
    feasible: !behind && !reverse,
  };
}

/**
 * Quadratic ease-out brake: x = p0 + (p1-p0)*(1-(1-s)²).
 * Initial velocity = 2*(p1-p0)/T. Monotonic toward endpoint. No reverse.
 */
function brakePosition(p0, p1, s) {
  const u = 1 - (1 - s) * (1 - s);
  return p0 + (p1 - p0) * u;
}

function brakeVelocity(p0, p1, s, durationSec) {
  const T = Math.max(durationSec, 1e-9);
  // d/ds [1-(1-s)²] = 2(1-s); vel = (p1-p0)*2(1-s)/T
  return ((p1 - p0) * 2 * (1 - s)) / T;
}

function evaluateBrakeFeasibility({
  commitX,
  commitVel,
  endpointX,
  remainingSec,
  jumpDirection,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const T = Math.max(remainingSec, 1e-9);
  const behind = isEndpointBehind(commitX, endpointX, dir);
  const brakeV0 = brakeVelocity(commitX, endpointX, 0, T);
  const velDisc = Math.abs(commitVel - brakeV0);
  let peakVel = Math.abs(brakeV0);
  let peakAccel = 0;
  let prevVel = brakeV0;
  let reverse = behind;
  for (let i = 1; i <= HERMITE_SAMPLE_STEPS; i++) {
    const s = i / HERMITE_SAMPLE_STEPS;
    const vel = brakeVelocity(commitX, endpointX, s, T);
    peakVel = Math.max(peakVel, Math.abs(vel));
    peakAccel = Math.max(
      peakAccel,
      Math.abs(vel - prevVel) / (T / HERMITE_SAMPLE_STEPS)
    );
    if (vel * dir < -1) reverse = true;
    prevVel = vel;
  }
  return {
    behind,
    reverse,
    peakVel,
    peakAccel,
    velDiscontinuity: velDisc,
    brakeV0,
    travel: Math.abs(endpointX - commitX),
    signedTravel: endpointX - commitX,
    feasible:
      !behind &&
      !reverse &&
      velDisc <= BRAKE_MAX_VEL_DISCONTINUITY,
  };
}

function overlapAt(x, opponentX, minimumDistance) {
  return Math.max(0, minimumDistance - Math.abs(x - opponentX));
}

/**
 * Cost / feasibility record for a candidate endpoint.
 * Lower score is better. Infinite score = rejected.
 */
function scoreCandidate(candidate, ctx) {
  const {
    commitX,
    commitVel,
    remainingSec,
    jumpDirection,
    rawTargetX,
    jumperStartX,
    preferredSide,
  } = ctx;

  const isHold = candidate.trajectoryType === "hold_settle";
  const isBrake = candidate.trajectoryType === "brake";
  let motion;
  if (isHold) {
    motion = {
      behind: false,
      reverse: false,
      peakVel: Math.abs(commitVel),
      peakAccel: 0,
      minDirVel: 0,
      travel: 0,
      signedTravel: 0,
      feasible: Math.abs(commitVel) <= HOLD_SETTLE_MAX_COMMIT_VEL,
    };
  } else if (isBrake) {
    motion = evaluateBrakeFeasibility({
      commitX,
      commitVel,
      endpointX: candidate.endpointX,
      remainingSec,
      jumpDirection,
    });
  } else {
    motion = evaluateHermiteFeasibility({
      commitX,
      commitVel,
      endpointX: candidate.endpointX,
      remainingSec,
      jumpDirection,
    });
  }

  const rawSpan = Math.max(1e-6, Math.abs(rawTargetX - jumperStartX));
  const travelFromCommit = Math.abs(candidate.endpointX - commitX);
  const travelRatio = travelFromCommit / rawSpan;
  const sideSwitch = candidate.side !== preferredSide;
  const extraBeyondRaw = Math.max(
    0,
    Math.abs(candidate.endpointX - jumperStartX) - rawSpan
  );

  let score = 0;
  const rejects = [];

  if (
    candidate.overlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX &&
    candidate.kind !== "emergency_raw"
  ) {
    rejects.push("overlap_above_tolerable");
  }

  if (isHold) {
    if (Math.abs(commitVel) > HOLD_SETTLE_MAX_COMMIT_VEL) {
      rejects.push("hold_settle_velocity_too_high");
    }
  } else if (isBrake) {
    if (!motion.feasible) {
      if (motion.behind || motion.reverse) rejects.push("direction_reversal");
      if (motion.velDiscontinuity > BRAKE_MAX_VEL_DISCONTINUITY) {
        rejects.push("brake_velocity_discontinuity");
      }
    }
  } else if (motion.reverse || motion.behind) {
    rejects.push("direction_reversal");
  }

  if (
    sideSwitch &&
    travelRatio > MAX_CROSSUP_TRAVEL_RATIO &&
    candidate.overlap <= 0
  ) {
    // Extreme cross-up: still allowed if nothing else works, but heavily penalized
    score += 500 + travelRatio * 100;
  }

  if (rejects.length && candidate.kind !== "emergency_raw") {
    return {
      ...candidate,
      motion,
      travelRatio,
      score: Infinity,
      rejects,
      feasible: false,
    };
  }

  // Soft costs — deep emergency residual must lose to tiny preferred residual.
  score += candidate.overlap * 4;
  score += travelFromCommit * 0.15;
  score += extraBeyondRaw * 0.35;
  score += sideSwitch ? 40 : 0;
  score += motion.peakVel * 0.01;
  score += motion.peakAccel * 0.00005;
  if (candidate.kind === "forward_crossup") score += 25;
  if (candidate.kind === "small_residual_preferred" || isHold) score += 5;
  if (candidate.kind === "emergency_raw") {
    score += 800 + candidate.overlap * 10;
  }

  return {
    ...candidate,
    motion,
    travelRatio,
    score,
    rejects,
    feasible: rejects.length === 0 || candidate.kind === "emergency_raw",
  };
}

function buildSideCandidate(side, kind, opponentX, minimumDistance, mapLeft, mapRight, commitX, jumpDirection) {
  const ideal = sideEndpoint(opponentX, side, minimumDistance);
  const clamped = clampToMap(ideal, mapLeft, mapRight);
  const boundaryLimited = clamped !== ideal;
  let endpointX = clamped;
  let trajectoryType = "hermite";
  let overlap = overlapAt(endpointX, opponentX, minimumDistance);

  // If clamped/ideal is behind commit, or essentially at commit, hold-settle
  // at commitX (no reverse). Tiny residual is preferable to a forced cross-up.
  if (
    isEndpointBehind(commitX, endpointX, jumpDirection) ||
    Math.abs(endpointX - commitX) <= HOLD_SETTLE_EPS_PX
  ) {
    const held = commitX;
    const heldOverlap = overlapAt(held, opponentX, minimumDistance);
    if (heldOverlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
      endpointX = held;
      overlap = heldOverlap;
      trajectoryType = "hold_settle";
      kind = "small_residual_preferred";
    } else if (isEndpointBehind(commitX, endpointX, jumpDirection)) {
      // Cannot hold (too much residual) — forward-clamp and reassess.
      endpointX = forwardClampEndpoint(commitX, endpointX, jumpDirection);
      overlap = overlapAt(endpointX, opponentX, minimumDistance);
      if (Math.abs(endpointX - commitX) <= HOLD_SETTLE_EPS_PX) {
        trajectoryType = "hold_settle";
        endpointX = commitX;
        overlap = overlapAt(endpointX, opponentX, minimumDistance);
      }
    }
  }

  if (overlap > 0 && overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    if (kind === "exact_clear_preferred" || kind === "small_residual_preferred") {
      kind = "small_residual_preferred";
    }
  }

  return {
    side,
    kind,
    endpointX,
    ideal,
    clamped,
    boundaryLimited,
    overlap,
    trajectoryType,
  };
}

/**
 * Phase A.1 endpoint planner — feasibility-aware replacement for the strict
 * "preferred clear else alternate" policy.
 */
function planLandingEndpoint({
  rawTargetX,
  jumperStartX,
  jumperCurrentX,
  jumpDirection,
  opponentX,
  jumperHalfWidth,
  opponentHalfWidth,
  mapLeft = MAP_LEFT_BOUNDARY,
  mapRight = MAP_RIGHT_BOUNDARY,
  preferredSide: preferredSideOverride = null,
  commitVel = 0,
  remainingSec = 0.2,
  rawXAtMaxCommit = null,
} = {}) {
  const safeRaw = clampToMap(
    Number.isFinite(rawTargetX) ? rawTargetX : mapLeft,
    mapLeft,
    mapRight
  );
  const safeOpp = Number.isFinite(opponentX) ? opponentX : safeRaw;
  const safeStart = Number.isFinite(jumperStartX) ? jumperStartX : safeRaw;
  const safeCurrent = Number.isFinite(jumperCurrentX) ? jumperCurrentX : safeStart;
  const dir = jumpDirection >= 0 ? 1 : -1;
  const jHalf = Number.isFinite(jumperHalfWidth)
    ? Math.max(0, jumperHalfWidth)
    : getPushboxHalfWidth(1);
  const oHalf = Number.isFinite(opponentHalfWidth)
    ? Math.max(0, opponentHalfWidth)
    : getPushboxHalfWidth(1);
  const minimumDistance = jHalf + oHalf;

  const rawOverlap = Math.max(0, minimumDistance - Math.abs(safeRaw - safeOpp));
  const preferredSide = choosePreferredLandingSide({
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
    jumpDirection: dir,
    opponentX: safeOpp,
    minimumDistance,
    preferredSide: preferredSideOverride,
  });

  const base = {
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
    jumperCurrentX: safeCurrent,
    jumpDirection: dir,
    opponentX: safeOpp,
    jumperHalfWidth: jHalf,
    opponentHalfWidth: oHalf,
    minimumDistance,
    rawOverlap,
    preferredSide,
    crossed: didRawPathCrossOpponent(safeStart, safeRaw, safeOpp),
  };

  const ctx = {
    commitX: safeCurrent,
    commitVel,
    remainingSec,
    jumpDirection: dir,
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
    preferredSide,
  };

  // No conflict — keep the intentional raw destination.
  if (rawOverlap <= 0) {
    const motion = evaluateHermiteFeasibility({
      commitX: safeCurrent,
      commitVel,
      endpointX: safeRaw,
      remainingSec,
      jumpDirection: dir,
    });
    return {
      ...base,
      resolvedTargetX: safeRaw,
      resolvedSide:
        safeRaw < safeOpp ? -1 : safeRaw > safeOpp ? 1 : preferredSide,
      boundaryLimited: false,
      usedFallback: false,
      fallbackReason: null,
      decisionClass: "exact_clear_raw",
      trajectoryType:
        Math.abs(safeRaw - safeCurrent) <= HOLD_SETTLE_EPS_PX
          ? "hold_settle"
          : "hermite",
      residualOverlap: 0,
      feasibility: motion,
      requiresEarlyCommit: false,
    };
  }

  const candidates = [];

  // Preferred side (exact or small residual / hold)
  const prefKind = "exact_clear_preferred";
  const prefCand = buildSideCandidate(
    preferredSide,
    prefKind,
    safeOpp,
    minimumDistance,
    mapLeft,
    mapRight,
    safeCurrent,
    dir
  );
  candidates.push(prefCand);
  // If Hermite cannot brake into a nearby forward preferred endpoint, offer brake.
  if (
    prefCand.trajectoryType === "hermite" &&
    !isEndpointBehind(safeCurrent, prefCand.endpointX, dir)
  ) {
    const hermiteMotion = evaluateHermiteFeasibility({
      commitX: safeCurrent,
      commitVel,
      endpointX: prefCand.endpointX,
      remainingSec,
      jumpDirection: dir,
    });
    if (hermiteMotion.reverse) {
      candidates.push({
        ...prefCand,
        kind: "small_residual_preferred",
        trajectoryType: "brake",
      });
    }
  }

  // Forward cross-up (alternate side)
  const alternateSide = /** @type {1|-1} */ (-preferredSide);
  const cross = buildSideCandidate(
    alternateSide,
    "forward_crossup",
    safeOpp,
    minimumDistance,
    mapLeft,
    mapRight,
    safeCurrent,
    dir
  );
  candidates.push(cross);

  // Raw settle emergency
  candidates.push({
    side:
      safeRaw < safeOpp ? -1 : safeRaw > safeOpp ? 1 : preferredSide,
    kind: "emergency_raw",
    endpointX: safeRaw,
    ideal: safeRaw,
    clamped: safeRaw,
    boundaryLimited: false,
    overlap: rawOverlap,
    trajectoryType:
      Math.abs(safeRaw - safeCurrent) <= HOLD_SETTLE_EPS_PX
        ? "hold_settle"
        : "hermite",
  });

  const scored = candidates.map((c) => scoreCandidate(c, ctx));
  scored.sort((a, b) => a.score - b.score);
  let best = scored[0];

  // If preferred was only rejected for reverse but has tiny residual after
  // hold-settle rebuild — already handled in buildSideCandidate.
  // If best is infinite, pick emergency_raw.
  if (!best || !Number.isFinite(best.score)) {
    best = scored.find((c) => c.kind === "emergency_raw") || scored[0];
  }

  // Prefer tolerable residual preferred over extreme cross-up even if scores close
  const prefScored = scored.find(
    (c) =>
      c.side === preferredSide &&
      c.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX &&
      c.feasible
  );
  if (
    prefScored &&
    best.kind === "forward_crossup" &&
    best.travelRatio > MAX_CROSSUP_TRAVEL_RATIO
  ) {
    best = prefScored;
  }

  let fallbackReason = null;
  let usedFallback = false;
  let decisionClass = best.kind;

  if (best.kind === "exact_clear_preferred" && best.overlap <= 0 && !best.boundaryLimited) {
    fallbackReason = null;
    decisionClass = "exact_clear_preferred";
  } else if (best.kind === "exact_clear_preferred" && best.boundaryLimited && best.overlap <= 0) {
    fallbackReason = "preferred_side_clamped";
    usedFallback = true;
    decisionClass = "exact_clear_preferred";
  } else if (
    best.kind === "small_residual_preferred" ||
    (best.side === preferredSide && best.overlap > 0 && best.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX)
  ) {
    fallbackReason = "small_residual_preferred_side";
    usedFallback = true;
    decisionClass = "small_residual_preferred";
  } else if (best.kind === "forward_crossup") {
    fallbackReason = best.boundaryLimited
      ? "alternate_side_required_by_boundary"
      : "forward_crossup_chosen";
    usedFallback = true;
    decisionClass = "forward_crossup_chosen";
  } else if (best.kind === "emergency_raw") {
    fallbackReason = "trajectory_infeasible_raw_settle";
    usedFallback = true;
    decisionClass = "trajectory_infeasible_raw_settle";
  } else if (best.overlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    fallbackReason = "both_sides_constrained";
    usedFallback = true;
    decisionClass = "both_sides_constrained";
  }

  // Early commit if waiting until nominal max would place commit behind endpoint
  const predictedMaxX =
    rawXAtMaxCommit != null
      ? rawXAtMaxCommit
      : safeCurrent;
  const requiresEarlyCommit =
    isEndpointBehind(predictedMaxX, best.endpointX, dir) ||
    (best.trajectoryType === "hold_settle" &&
      best.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX);

  return {
    ...base,
    resolvedTargetX: best.endpointX,
    resolvedSide: best.side,
    boundaryLimited: !!best.boundaryLimited,
    usedFallback,
    fallbackReason,
    decisionClass,
    trajectoryType: best.trajectoryType || "hermite",
    residualOverlap: best.overlap,
    feasibility: best.motion || null,
    requiresEarlyCommit,
    candidateScores: scored.map((c) => ({
      kind: c.kind,
      side: c.side,
      endpointX: c.endpointX,
      overlap: c.overlap,
      score: c.score,
      feasible: c.feasible,
      rejects: c.rejects,
    })),
  };
}

/**
 * Pure geometric landing endpoint solver (side + boundary + residual policy).
 * Does not move the defender. Never returns NaN / Infinity / out-of-map X.
 *
 * Motion feasibility / Hermite planning is handled by planLandingEndpoint()
 * inside the live stepper — geometry tests call this entry directly.
 */
function resolveLandingTarget({
  rawTargetX,
  jumperStartX,
  jumperCurrentX,
  jumpDirection,
  opponentX,
  jumperHalfWidth,
  opponentHalfWidth,
  mapLeft = MAP_LEFT_BOUNDARY,
  mapRight = MAP_RIGHT_BOUNDARY,
  preferredSide: preferredSideOverride = null,
} = {}) {
  const safeRaw = clampToMap(
    Number.isFinite(rawTargetX) ? rawTargetX : mapLeft,
    mapLeft,
    mapRight
  );
  const safeOpp = Number.isFinite(opponentX) ? opponentX : safeRaw;
  const safeStart = Number.isFinite(jumperStartX) ? jumperStartX : safeRaw;
  const safeCurrent = Number.isFinite(jumperCurrentX) ? jumperCurrentX : safeStart;
  const dir = jumpDirection >= 0 ? 1 : -1;
  const jHalf = Number.isFinite(jumperHalfWidth)
    ? Math.max(0, jumperHalfWidth)
    : getPushboxHalfWidth(1);
  const oHalf = Number.isFinite(opponentHalfWidth)
    ? Math.max(0, opponentHalfWidth)
    : getPushboxHalfWidth(1);
  const minimumDistance = jHalf + oHalf;

  const rawOverlap = Math.max(0, minimumDistance - Math.abs(safeRaw - safeOpp));
  const preferredSide = choosePreferredLandingSide({
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
    jumpDirection: dir,
    opponentX: safeOpp,
    minimumDistance,
    preferredSide: preferredSideOverride,
  });

  const base = {
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
    jumperCurrentX: safeCurrent,
    jumpDirection: dir,
    opponentX: safeOpp,
    jumperHalfWidth: jHalf,
    opponentHalfWidth: oHalf,
    minimumDistance,
    rawOverlap,
    preferredSide,
    crossed: didRawPathCrossOpponent(safeStart, safeRaw, safeOpp),
  };

  if (rawOverlap <= 0) {
    return {
      ...base,
      resolvedTargetX: safeRaw,
      resolvedSide:
        safeRaw < safeOpp ? -1 : safeRaw > safeOpp ? 1 : preferredSide,
      boundaryLimited: false,
      usedFallback: false,
      fallbackReason: null,
      decisionClass: "exact_clear_raw",
      residualOverlap: 0,
    };
  }

  const trySide = (side) => {
    const ideal = sideEndpoint(safeOpp, side, minimumDistance);
    const clamped = clampToMap(ideal, mapLeft, mapRight);
    const boundaryLimited = clamped !== ideal;
    const overlapAfter = Math.max(
      0,
      minimumDistance - Math.abs(clamped - safeOpp)
    );
    return { side, ideal, clamped, boundaryLimited, overlapAfter };
  };

  const preferred = trySide(preferredSide);
  // A.1: tolerate bounded residual on the preferred side instead of forcing
  // an enormous alternate-side cross-up for a sub-tick overlap (Case 3).
  if (preferred.overlapAfter <= TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    const residual = preferred.overlapAfter;
    return {
      ...base,
      resolvedTargetX: preferred.clamped,
      resolvedSide: preferredSide,
      boundaryLimited: preferred.boundaryLimited,
      usedFallback: residual > 0 || preferred.boundaryLimited,
      fallbackReason:
        residual > 0
          ? "small_residual_preferred_side"
          : preferred.boundaryLimited
            ? "preferred_side_clamped"
            : null,
      decisionClass:
        residual > 0 ? "small_residual_preferred" : "exact_clear_preferred",
      residualOverlap: residual,
    };
  }

  const alternateSide = /** @type {1|-1} */ (-preferredSide);
  const alternate = trySide(alternateSide);
  if (alternate.overlapAfter <= TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    return {
      ...base,
      resolvedTargetX: alternate.clamped,
      resolvedSide: alternateSide,
      boundaryLimited: true,
      usedFallback: true,
      fallbackReason:
        alternate.overlapAfter > 0
          ? "alternate_side_small_residual"
          : "preferred_side_impossible_alternate_ok",
      decisionClass: "forward_crossup_chosen",
      residualOverlap: alternate.overlapAfter,
    };
  }

  const pick =
    alternate.overlapAfter < preferred.overlapAfter ? alternate : preferred;

  return {
    ...base,
    resolvedTargetX: pick.clamped,
    resolvedSide: pick.side,
    boundaryLimited: true,
    usedFallback: true,
    fallbackReason: "both_sides_constrained",
    decisionClass: "both_sides_constrained",
    residualOverlap: pick.overlapAfter,
  };
}

/** Reset all Phase-A landing fields. Safe to call on any player-like object. */
function clearRopeJumpLandingState(player) {
  if (!player) return;
  player.ropeJumpRawTargetX = 0;
  player.ropeJumpResolvedTargetX = 0;
  player.ropeJumpLandingCommitted = false;
  player.ropeJumpLandingCommitX = 0;
  player.ropeJumpLandingCommitT = 0;
  player.ropeJumpLandingCommitVel = 0;
  player.ropeJumpLandingDecision = null;
  player.ropeJumpLandingPath = null;
  player.ropeJumpPreferredSide = 0;
  player.ropeJumpResolvedSide = 0;
  player.ropeJumpMinDistance = 0;
  player.ropeJumpCenterDistance = 0;
  player.ropeJumpOverlap = 0;
  player.ropeJumpSafetyCorrectionPx = 0;
  player.ropeJumpPreTouchdownX = 0;
  player.ropeJumpTouchdownX = 0;
  player.ropeJumpUsedFallback = false;
  player.ropeJumpTrajectoryType = null;
  player.ropeJumpDecisionClass = null;
  player.ropeJumpFallbackReason = null;
  player.ropeJumpHorizVel = 0;
  player.ropeJumpRawExpectedVel = 0;
  player.ropeJumpPeakVel = 0;
  player.ropeJumpPeakAccel = 0;
  player.ropeJumpReversalDetected = false;
  player._landingTrace = null;
  player._landingPrevX = null;
  player._landingPrevVel = null;
  player._landingTickIndex = 0;
}

/**
 * Initialize landing fields at rope-jump start.
 * rawTargetX should already be map-clamped.
 */
function initRopeJumpLandingState(player, rawTargetX, useV2 = ROPE_JUMP_LANDING_V2) {
  clearRopeJumpLandingState(player);
  player.ropeJumpRawTargetX = rawTargetX;
  player.ropeJumpLandingPath = useV2 ? "v2" : "legacy";
  if (LANDING_TRACE || LANDING_DEBUG_NET) {
    player._landingTrace = {
      path: player.ropeJumpLandingPath,
      samples: [],
      startX: player.ropeJumpStartX,
      rawTargetX,
      jumpDirection: player.ropeJumpDirection,
      startedAt: player.ropeJumpStartTime,
    };
  }
}

function appendLandingTraceSample(player, sample) {
  if (!player || !player._landingTrace) return;
  player._landingTrace.samples.push(sample);
}

function finalizeLandingTrace(player, extra = {}) {
  if (!player || !player._landingTrace || !LANDING_TRACE) return null;
  const record = {
    ...player._landingTrace,
    ...extra,
    decision: player.ropeJumpLandingDecision,
    touchdownX: player.ropeJumpTouchdownX,
    preTouchdownX: player.ropeJumpPreTouchdownX,
    safetyCorrectionPx: player.ropeJumpSafetyCorrectionPx,
    trajectoryType: player.ropeJumpTrajectoryType,
    decisionClass: player.ropeJumpDecisionClass,
    fallbackReason: player.ropeJumpFallbackReason,
    peakVel: player.ropeJumpPeakVel,
    peakAccel: player.ropeJumpPeakAccel,
    reversalDetected: player.ropeJumpReversalDetected,
  };
  console.log("[LANDING_TRACE]", JSON.stringify(record));
  player._landingTrace = null;
  return record;
}

/**
 * Build a debug-only diagnostic payload (not part of normal PvP deltas).
 */
function getLandingDebugPayload(player) {
  if (!player) return null;
  return {
    id: player.id,
    path: player.ropeJumpLandingPath,
    phase: player.ropeJumpPhase,
    t: player._landingLastT,
    x: player.x,
    rawTargetX: player.ropeJumpRawTargetX,
    resolvedTargetX: player.ropeJumpResolvedTargetX,
    commitX: player.ropeJumpLandingCommitX,
    commitT: player.ropeJumpLandingCommitT,
    commitVel: player.ropeJumpLandingCommitVel,
    committed: !!player.ropeJumpLandingCommitted,
    preferredSide: player.ropeJumpPreferredSide,
    resolvedSide: player.ropeJumpResolvedSide,
    minDistance: player.ropeJumpMinDistance,
    centerDistance: player.ropeJumpCenterDistance,
    overlap: player.ropeJumpOverlap,
    safetyCorrectionPx: player.ropeJumpSafetyCorrectionPx,
    preTouchdownX: player.ropeJumpPreTouchdownX,
    touchdownX: player.ropeJumpTouchdownX,
    usedFallback: player.ropeJumpUsedFallback,
    fallbackReason: player.ropeJumpFallbackReason,
    decisionClass: player.ropeJumpDecisionClass,
    trajectoryType: player.ropeJumpTrajectoryType,
    horizVel: player.ropeJumpHorizVel,
    rawExpectedVel: player.ropeJumpRawExpectedVel,
    peakVel: player.ropeJumpPeakVel,
    peakAccel: player.ropeJumpPeakAccel,
    reversalDetected: player.ropeJumpReversalDetected,
  };
}

function applyCommitDecision(player, decision, commitX, commitT, commitVel) {
  player.ropeJumpLandingCommitted = true;
  player.ropeJumpLandingCommitT = commitT;
  player.ropeJumpLandingCommitX = commitX;
  player.ropeJumpLandingCommitVel = commitVel;
  player.ropeJumpResolvedTargetX = decision.resolvedTargetX;
  player.ropeJumpTargetX = decision.resolvedTargetX;
  player.ropeJumpLandingDecision = decision;
  player.ropeJumpPreferredSide = decision.preferredSide;
  player.ropeJumpResolvedSide = decision.resolvedSide;
  player.ropeJumpUsedFallback = !!decision.usedFallback;
  player.ropeJumpMinDistance = decision.minimumDistance;
  player.ropeJumpTrajectoryType = decision.trajectoryType || "hermite";
  player.ropeJumpDecisionClass = decision.decisionClass || null;
  player.ropeJumpFallbackReason = decision.fallbackReason || null;
}

function samplePostCommitX(player, t, activeMs) {
  const commitT = player.ropeJumpLandingCommitT;
  const commitX = player.ropeJumpLandingCommitX;
  const endpoint = player.ropeJumpResolvedTargetX;
  const commitVel = player.ropeJumpLandingCommitVel || 0;
  const remainingSec = Math.max(0, (1 - commitT) * (activeMs / 1000));
  const elapsedSec = Math.max(0, (t - commitT) * (activeMs / 1000));
  const s =
    remainingSec <= 1e-9 ? 1 : Math.max(0, Math.min(1, elapsedSec / remainingSec));

  if (player.ropeJumpTrajectoryType === "hold_settle") {
    return commitX;
  }
  if (player.ropeJumpTrajectoryType === "brake") {
    return brakePosition(commitX, endpoint, s);
  }

  return hermitePosition(commitX, commitVel, endpoint, 0, s, remainingSec);
}

/**
 * Authoritative active-phase step for rope jump.
 * When useV2 is false, reproduces the legacy fixed-target arc.
 *
 * V2 (A.1): motion-aware Hermite (or hold_settle) from commit → endpoint.
 * Early lock when waiting until COMMIT_T would force a reverse.
 *
 * @returns {{ touchedDown: boolean, committedThisTick: boolean, decision: object|null }}
 */
function stepRopeJumpActive(player, opponent, now, options = {}) {
  const activeMs = options.activeMs != null ? options.activeMs : ROPE_JUMP_ACTIVE_MS;
  const commitTMax =
    options.commitT != null ? options.commitT : ROPE_JUMP_LANDING_COMMIT_T;
  const commitTMin =
    options.commitTMin != null
      ? options.commitTMin
      : ROPE_JUMP_LANDING_COMMIT_T_MIN;
  const arcHeight = options.arcHeight != null ? options.arcHeight : ROPE_JUMP_ARC_HEIGHT;
  const groundLevel = options.groundLevel != null ? options.groundLevel : GROUND_LEVEL;
  const mapLeft = options.mapLeft != null ? options.mapLeft : MAP_LEFT_BOUNDARY;
  const mapRight = options.mapRight != null ? options.mapRight : MAP_RIGHT_BOUNDARY;
  const useV2 = options.useV2 != null ? options.useV2 : ROPE_JUMP_LANDING_V2;

  const elapsed = now - player.ropeJumpActiveStartTime;
  const t = Math.min(1, elapsed / activeMs);
  const easedT = ropeJumpEase(t);

  const rawTargetX =
    Number.isFinite(player.ropeJumpRawTargetX) && player.ropeJumpRawTargetX !== 0
      ? player.ropeJumpRawTargetX
      : player.ropeJumpTargetX;
  const startX = player.ropeJumpStartX;

  let committedThisTick = false;
  let decision = null;

  const xAlongRaw = rawArcX(startX, rawTargetX, t);
  const velAlongRaw = rawArcVelocity(startX, rawTargetX, t, activeMs);
  player.ropeJumpRawExpectedVel = velAlongRaw;
  player._landingLastT = t;
  player._landingTickIndex = (player._landingTickIndex || 0) + 1;

  if (useV2 && !player.ropeJumpLandingCommitted && opponent && t >= commitTMin) {
    const remainingSec = Math.max(0, (1 - t) * (activeMs / 1000));
    const rawXAtMax = rawArcX(startX, rawTargetX, commitTMax);
    decision = planLandingEndpoint({
      rawTargetX,
      jumperStartX: startX,
      jumperCurrentX: xAlongRaw,
      jumpDirection: player.ropeJumpDirection,
      opponentX: opponent.x,
      jumperHalfWidth: getPushboxHalfWidth(player.sizeMultiplier),
      opponentHalfWidth: getPushboxHalfWidth(opponent.sizeMultiplier),
      mapLeft,
      mapRight,
      commitVel: velAlongRaw,
      remainingSec,
      rawXAtMaxCommit: rawXAtMax,
    });

    const mustLock = t >= commitTMax || decision.requiresEarlyCommit;
    if (mustLock) {
      applyCommitDecision(player, decision, xAlongRaw, t, velAlongRaw);
      committedThisTick = true;
    }
  }

  let x;
  if (useV2 && player.ropeJumpLandingCommitted) {
    x = samplePostCommitX(player, t, activeMs);
  } else {
    x = xAlongRaw;
  }

  x = clampToMap(x, mapLeft, mapRight);

  // Motion diagnostics
  const prevX =
    player._landingPrevX != null ? player._landingPrevX : player.x;
  const dx = x - prevX;
  const vel = dx / (TICK_MS / 1000);
  const prevVel = player._landingPrevVel != null ? player._landingPrevVel : vel;
  const accel = (vel - prevVel) / (TICK_MS / 1000);
  player.ropeJumpHorizVel = vel;
  player.ropeJumpPeakVel = Math.max(player.ropeJumpPeakVel || 0, Math.abs(vel));
  player.ropeJumpPeakAccel = Math.max(player.ropeJumpPeakAccel || 0, Math.abs(accel));
  if (
    player.ropeJumpLandingCommitted &&
    !committedThisTick &&
    Math.abs(prevVel) > 30 &&
    Math.abs(vel) > 30 &&
    prevVel * vel < 0
  ) {
    player.ropeJumpReversalDetected = true;
  }

  player.x = x;
  player.y = groundLevel + arcHeight * 4 * t * (1 - t);
  player._landingPrevX = x;
  player._landingPrevVel = vel;

  if (opponent) {
    const minDist = getMinimumCenterDistance(
      player.sizeMultiplier,
      opponent.sizeMultiplier
    );
    player.ropeJumpMinDistance = minDist;
    player.ropeJumpCenterDistance = Math.abs(player.x - opponent.x);
    player.ropeJumpOverlap = Math.max(0, minDist - player.ropeJumpCenterDistance);
  }

  if (
    (LANDING_TRACE || LANDING_DEBUG_NET) &&
    player._landingTrace &&
    (committedThisTick ||
      t >= 1 ||
      player._landingTrace.samples.length === 0 ||
      player._landingTrace.samples.length % 4 === 0)
  ) {
    appendLandingTraceSample(player, {
      tick: player._landingTickIndex,
      t: Number(t.toFixed(4)),
      x: player.x,
      prevX,
      dx: Number(dx.toFixed(4)),
      vel: Number(vel.toFixed(2)),
      accel: Number(accel.toFixed(2)),
      rawExpectedX: Number(xAlongRaw.toFixed(4)),
      rawExpectedVel: Number(velAlongRaw.toFixed(2)),
      commitX: player.ropeJumpLandingCommitX,
      commitVel: player.ropeJumpLandingCommitVel,
      resolvedTarget: player.ropeJumpResolvedTargetX,
      trajectoryType: player.ropeJumpTrajectoryType,
      preferredSide: player.ropeJumpPreferredSide,
      resolvedSide: player.ropeJumpResolvedSide,
      decisionClass: player.ropeJumpDecisionClass,
      fallbackReason: player.ropeJumpFallbackReason,
      overlap: player.ropeJumpOverlap,
      committed: !!player.ropeJumpLandingCommitted,
    });
  }

  if (t >= 1) {
    const landX =
      useV2 && player.ropeJumpLandingCommitted
        ? player.ropeJumpResolvedTargetX
        : player.ropeJumpTargetX;

    player.ropeJumpPreTouchdownX = player.x;
    player.ropeJumpPhase = "landing";
    player.ropeJumpLandingTime = now;
    // Hold-settle / Hermite should already be at endpoint; assign for parity
    // with legacy snap-to-target and to absorb float drift.
    const touchX = clampToMap(landX, mapLeft, mapRight);
    // Guard: never teleport more than a tiny float epsilon on touchdown.
    if (Math.abs(touchX - player.x) > 1.0) {
      // Keep continuous position; record mismatch for diagnostics.
      if (player.ropeJumpLandingDecision) {
        player.ropeJumpLandingDecision.touchdownMismatchPx = touchX - player.x;
      }
    } else {
      player.x = touchX;
    }
    player.y = groundLevel;
    player.ropeJumpTouchdownX = player.x;

    if (opponent) {
      const minDist = getMinimumCenterDistance(
        player.sizeMultiplier,
        opponent.sizeMultiplier
      );
      player.ropeJumpMinDistance = minDist;
      player.ropeJumpCenterDistance = Math.abs(player.x - opponent.x);
      player.ropeJumpOverlap = Math.max(0, minDist - player.ropeJumpCenterDistance);
    }

    return {
      touchedDown: true,
      committedThisTick,
      decision: player.ropeJumpLandingDecision,
      debugPayload: LANDING_DEBUG_NET ? getLandingDebugPayload(player) : null,
    };
  }

  return {
    touchedDown: false,
    committedThisTick,
    decision,
    debugPayload:
      LANDING_DEBUG_NET && committedThisTick
        ? getLandingDebugPayload(player)
        : null,
  };
}

function isRopeJumpLandingV2Enabled() {
  return ROPE_JUMP_LANDING_V2 === true;
}

module.exports = {
  SIDE_AMBIGUITY_EPSILON_PX,
  LANDING_SEPARATION_PAD_PX,
  TOLERABLE_TOUCHDOWN_OVERLAP_PX,
  MAX_CROSSUP_TRAVEL_RATIO,
  HOLD_SETTLE_EPS_PX,
  HOLD_SETTLE_MAX_COMMIT_VEL,
  BRAKE_MAX_VEL_DISCONTINUITY,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
  ropeJumpEase,
  ropeJumpEaseDeriv,
  rawArcX,
  rawArcVelocity,
  hermitePosition,
  hermiteVelocity,
  didRawPathCrossOpponent,
  choosePreferredLandingSide,
  resolveLandingTarget,
  planLandingEndpoint,
  evaluateHermiteFeasibility,
  clearRopeJumpLandingState,
  initRopeJumpLandingState,
  stepRopeJumpActive,
  finalizeLandingTrace,
  appendLandingTraceSample,
  getLandingDebugPayload,
  isRopeJumpLandingV2Enabled,
  clampToMap,
};

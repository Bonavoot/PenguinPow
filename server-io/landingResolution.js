/**
 * Aerial landing resolution — Phase A / A.1 / A.2 / A.3 (rope jump only).
 *
 * Phase A: deterministic pushbox-clear endpoint commit (flagged).
 * Phase A.1: motion-aware Hermite/brake trajectories + residual policy.
 * Phase A.2: separates stable side intent, continuous commit timing, and
 *            same-side endpoint refinement so subpixel opponent motion cannot
 *            flip landing side / commit era / trajectory class together.
 * Phase A.3: raw-clear is provisional (not an irreversible side lock);
 *            pre-commit dynamic conflicts replan on a locked near/cross side
 *            using touchdown-extrapolated opponent position.
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
  speedFactor: DEFAULT_SPEED_FACTOR,
  ICE_ACCELERATION,
  ICE_MAX_SPEED,
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

/**
 * Legacy Phase A constant — retained for export/compat only.
 * Phase A.2 side intent does NOT use a 1px rawOnCenter threshold.
 * Exact center coincidence uses jump direction; land-short vs cross uses
 * the map-fit / corridor rule in resolveSideIntent().
 */
const SIDE_AMBIGUITY_EPSILON_PX = 1;

/**
 * Tiny pad past exact min-separation so float rounding cannot re-enter the
 * pushbox on the touchdown frame (e.g. 110.49999999999994 < 110.5).
 */
const LANDING_SEPARATION_PAD_PX = 0.01;

/**
 * Tolerable bounded touchdown residual overlap (world px).
 * Equals the existing rope-jump landing safety correction cap.
 * Phase A.3: still the per-tick safety cap and late-intrusion event budget;
 * ordinary pre-commit conflicts must not rely on N× this value.
 */
const TOLERABLE_TOUCHDOWN_OVERLAP_PX = 18;

/**
 * Ordinary pre-commit conflicts must not use multi-tick grounded separation.
 * Genuine post-commit late intrusion may use at most one safety tick ≤18px.
 */
const ORDINARY_MAX_SAFETY_CORRECTION_TICKS = 0;
const ORDINARY_MAX_TOTAL_SAFETY_CORRECTION_PX = 0.5;
const LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS = 1;
const LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX =
  TOLERABLE_TOUCHDOWN_OVERLAP_PX;

/**
 * Max ratio of |resolved−commit| to |raw−start| used as a soft cost only
 * after side intent is locked (never chooses the opposite gameplay side).
 */
const MAX_CROSSUP_TRAVEL_RATIO = 1.35;

/**
 * Near-zero remaining travel → hold_settle (emergency / float only).
 */
const HOLD_SETTLE_EPS_PX = 0.75;

/**
 * Hold-settle may kill horizontal velocity only when |commitVel| is below this.
 * Ordinary rope escapes must not use hold_settle.
 */
const HOLD_SETTLE_MAX_COMMIT_VEL = 120;

/** Max commit velocity discontinuity for brake path (px/s). */
const BRAKE_MAX_VEL_DISCONTINUITY = 400;

/**
 * Phase A.1 / A.2 ordinary-scenario motion budgets (world units).
 * Derived from raw-arc peak (~350) × 3.5 and measured Hermite Case 1.
 */
const MAX_TRAJECTORY_PEAK_VEL = 1225;
const MAX_TRAJECTORY_PEAK_ACCEL = 25000;

/**
 * Planner uses a tighter internal budget so 64 Hz discrete dx/dt peaks
 * (and one-tick commit quantization) stay under the documented limits.
 */
const PLANNER_PEAK_VEL_BUDGET = 1050;
const PLANNER_PEAK_ACCEL_BUDGET = 20000;

/**
 * Minimum centerward travel (world px) required for a near-side landing to
 * count as a real rope-jump escape. Below this, near map-fit still collapses
 * into a near-vertical hop — A.2 crosses instead.
 *
 * Derived from: min(0.35 × jumper half-width, 0.15 × raw span), floored at 12px
 * so small size pairs still demand a visible escape. Case 2 (opp≈470, travel≈19.5)
 * clears this; rope-edge residuals (~0–2px) do not.
 */
const MIN_CENTERWARD_ESCAPE_FLOOR_PX = 12;
const MIN_CENTERWARD_ESCAPE_HALF_WIDTH_FRAC = 0.35;
const MIN_CENTERWARD_ESCAPE_RAW_SPAN_FRAC = 0.15;

/** Sample count for Hermite monotonicity / peak estimates (deterministic). */
const HERMITE_SAMPLE_STEPS = 16;

/** Discrete samples when searching budget-feasible commit times. */
const COMMIT_T_SEARCH_STEPS = 24;

/**
 * Phase A.3 planning states — ownership is explicit.
 * preserve_raw is NEVER a locked side; it is provisional_raw until raw commit
 * or until a near/cross side lock.
 */
const PLANNING_PROVISIONAL_RAW = "provisional_raw";
const PLANNING_SIDE_LOCKED = "side_locked";
const PLANNING_ENDPOINT_COMMITTED = "endpoint_committed";

/** Quantization for no-return deadline (avoids float thrash). */
const NO_RETURN_T_QUANTUM = 1 / 64;

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

/** Inverse of ropeJumpEase: e ∈ [0,1] → t ∈ [0,1]. */
function ropeJumpEaseInverse(e) {
  const x = Math.max(0, Math.min(1, e));
  return Math.acos(1 - 2 * x) / Math.PI;
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
 * Exact sign product — no subpixel "on center" epsilon.
 * Near-equal start centers are not a cross-up by themselves.
 */
function didRawPathCrossOpponent(jumperStartX, rawTargetX, opponentX) {
  const startDelta = jumperStartX - opponentX;
  const rawDelta = rawTargetX - opponentX;
  if (startDelta === 0) return false;
  return startDelta * rawDelta < 0;
}

function sideEndpoint(opponentX, side, minimumDistance) {
  return opponentX + side * (minimumDistance + LANDING_SEPARATION_PAD_PX);
}

/** Endpoint is behind commit relative to jump direction (would reverse). */
function isEndpointBehind(commitX, endpointX, jumpDirection) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  return (endpointX - commitX) * dir < -HOLD_SETTLE_EPS_PX;
}

/** Strict behind check (no hold-settle epsilon) — used for commit timing. */
function isStrictlyBehind(commitX, endpointX, jumpDirection) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  return (endpointX - commitX) * dir < 0;
}

/** Forward-clamp endpoint so it is not behind commit (dir-aware). */
function forwardClampEndpoint(commitX, endpointX, jumpDirection) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  if (dir >= 0) return Math.max(commitX, endpointX);
  return Math.min(commitX, endpointX);
}

function overlapAt(x, opponentX, minimumDistance) {
  return Math.max(0, minimumDistance - Math.abs(x - opponentX));
}

function centerwardTravel(fromX, toX, jumpDirection) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  return (toX - fromX) * dir;
}

/**
 * Originating (near) side relative to opponent from jumper start.
 * +1 = land to opponent's right; -1 = left.
 */
function originatingSide(jumperStartX, opponentX, jumpDirection) {
  if (jumperStartX < opponentX) return -1;
  if (jumperStartX > opponentX) return 1;
  return jumpDirection >= 0 ? 1 : -1;
}

/**
 * Phase A.2 — stable landing-side intent from physical corridor geometry.
 *
 * Plain-language rope-jump rule:
 * - Preserve raw when the raw landing footprint does not overlap the opponent.
 * - Cross (jump direction) when the raw segment crosses the opponent center,
 *   OR when a clear near-side footprint cannot fit on-map with meaningful
 *   centerward escape (near would collapse to a rope-edge hop).
 * - Near/originating side when raw stays on the start side AND a clear
 *   near-side landing remains on-map with centerward progress.
 *
 * Side intent does not use SIDE_AMBIGUITY_EPSILON_PX / rawOnCenter.
 */
function minCenterwardEscapePx(jumperHalfWidth, rawTargetX, jumperStartX) {
  const rawSpan = Math.abs(rawTargetX - jumperStartX);
  const half = Number.isFinite(jumperHalfWidth) ? Math.max(0, jumperHalfWidth) : 0;
  return Math.max(
    MIN_CENTERWARD_ESCAPE_FLOOR_PX,
    Math.min(
      half * MIN_CENTERWARD_ESCAPE_HALF_WIDTH_FRAC,
      rawSpan * MIN_CENTERWARD_ESCAPE_RAW_SPAN_FRAC
    )
  );
}

function resolveSideIntent({
  rawTargetX,
  jumperStartX,
  jumpDirection,
  opponentX,
  minimumDistance,
  jumperHalfWidth = null,
  mapLeft = MAP_LEFT_BOUNDARY,
  mapRight = MAP_RIGHT_BOUNDARY,
  preferredSide: override = null,
} = {}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const jHalf =
    jumperHalfWidth != null && Number.isFinite(jumperHalfWidth)
      ? Math.max(0, jumperHalfWidth)
      : minimumDistance * 0.5;
  if (override === 1 || override === -1) {
    return {
      side: override,
      intentClass: override === dir ? "cross" : "near",
      nearIdeal: sideEndpoint(opponentX, originatingSide(jumperStartX, opponentX, dir), minimumDistance),
      nearFitsOnMap: true,
      reason: "override",
    };
  }

  const rawOverlap = Math.max(
    0,
    minimumDistance - Math.abs(rawTargetX - opponentX)
  );

  if (rawOverlap <= 0) {
    const side =
      rawTargetX < opponentX ? -1 : rawTargetX > opponentX ? 1 : dir;
    return {
      side,
      intentClass: "preserve_raw",
      nearIdeal: sideEndpoint(
        opponentX,
        originatingSide(jumperStartX, opponentX, dir),
        minimumDistance
      ),
      nearFitsOnMap: true,
      reason: "raw_clear",
    };
  }

  if (didRawPathCrossOpponent(jumperStartX, rawTargetX, opponentX)) {
    return {
      side: dir,
      intentClass: "cross",
      nearIdeal: sideEndpoint(
        opponentX,
        originatingSide(jumperStartX, opponentX, dir),
        minimumDistance
      ),
      nearFitsOnMap: false,
      reason: "raw_segment_crosses_opponent_center",
    };
  }

  // Land-short geometry: raw terminates in opponent body on the start side.
  const nearSide = originatingSide(jumperStartX, opponentX, dir);
  const nearIdeal = sideEndpoint(opponentX, nearSide, minimumDistance);
  const nearFitsOnMap = nearIdeal >= mapLeft && nearIdeal <= mapRight;
  const travel = centerwardTravel(jumperStartX, nearIdeal, dir);
  const minEscape = minCenterwardEscapePx(jHalf, rawTargetX, jumperStartX);
  const meaningfulEscape = nearFitsOnMap && travel >= minEscape;

  if (meaningfulEscape) {
    return {
      side: nearSide,
      intentClass: "near",
      nearIdeal,
      nearFitsOnMap,
      minEscape,
      reason: "near_side_map_fit_centerward_escape",
    };
  }

  // Near footprint is past the originating rope, or escape travel is below the
  // meaningful threshold — crossing preserves the centerward escape.
  return {
    side: dir,
    intentClass: "cross",
    nearIdeal,
    nearFitsOnMap,
    minEscape,
    reason: "near_side_unavailable_cross_escape",
  };
}

/**
 * Preferred landing side (±1). Thin wrapper over resolveSideIntent for
 * Phase A test compatibility.
 */
function choosePreferredLandingSide(args) {
  return resolveSideIntent(args).side;
}

/** Raw landing footprint overlap with opponent pushbox (world px). */
function rawFootprintOverlap(rawTargetX, opponentX, minimumDistance) {
  return Math.max(0, minimumDistance - Math.abs(rawTargetX - opponentX));
}

/**
 * Extrapolate opponent X at a future time.
 * Steady motion: opp + vel*rem is stable across ticks.
 * When a measured acceleration is provided (ice ramp), apply a bounded
 * half-accel term capped by ICE_MAX_SPEED — never assume accel for
 * constant-velocity motion (that over-predicts and flips sides).
 */
function predictOpponentX(
  opponentX,
  oppVelPxPerSec,
  remainingSec,
  mapLeft = MAP_LEFT_BOUNDARY,
  mapRight = MAP_RIGHT_BOUNDARY,
  oppAccelPxPerSec2 = 0
) {
  const vel = Number.isFinite(oppVelPxPerSec) ? oppVelPxPerSec : 0;
  const rem = Math.max(0, remainingSec);
  const maxVelPxPerSec = ICE_MAX_SPEED * DEFAULT_SPEED_FACTOR * 1000;
  let predVel = vel;
  if (Number.isFinite(oppAccelPxPerSec2) && Math.abs(oppAccelPxPerSec2) > 1) {
    predVel = vel + oppAccelPxPerSec2 * rem;
    if (Math.abs(predVel) > maxVelPxPerSec) {
      predVel = Math.sign(predVel) * maxVelPxPerSec;
    }
  }
  const x = opponentX + 0.5 * (vel + predVel) * rem;
  return clampToMap(x, mapLeft, mapRight);
}

/**
 * Bias the planning opponent away from the locked landing side by a small
 * clearance so 64 Hz / prediction quantization cannot leave a sub-pixel bury.
 */
const DYNAMIC_SIDE_CLEARANCE_PX = 1.25;

function planningOpponentX(
  predictedOppX,
  lockedSide,
  oppVelPxPerSec,
  mapLeft,
  mapRight
) {
  if (lockedSide !== 1 && lockedSide !== -1) return predictedOppX;
  // Static opponents keep exact A.2 endpoints; moving ones get clearance bias
  // of at least one tick of travel + pad.
  if (!Number.isFinite(oppVelPxPerSec) || Math.abs(oppVelPxPerSec) < 0.5) {
    return predictedOppX;
  }
  const velPxPerTick = Math.abs(oppVelPxPerSec) * (TICK_MS / 1000);
  // ≥1 tick of travel + pad covers 64 Hz sampling and small size pairs.
  const clearance = Math.max(DYNAMIC_SIDE_CLEARANCE_PX, velPxPerTick * 2 + 2);
  return clampToMap(
    predictedOppX + lockedSide * clearance,
    mapLeft,
    mapRight
  );
}

/**
 * Update per-jump opponent velocity estimate from successive samples.
 * Optionally seeds from ice `movementVelocity` (world px/s = mv * speedFactor * 1000).
 * @returns {{ vel: number, trusted: boolean }}
 */
function updateOpponentVelocityEstimate(
  player,
  opponentX,
  opponentMovementVelocity,
  speedFactor
) {
  let vel = 0;
  let trusted = false;
  let accel = 0;
  if (
    player._landingOppPrevX != null &&
    Number.isFinite(player._landingOppPrevX)
  ) {
    vel = (opponentX - player._landingOppPrevX) / (TICK_MS / 1000);
    trusted = true;
    if (
      player._landingOppVelPxPerSec != null &&
      Number.isFinite(player._landingOppVelPxPerSec) &&
      Math.abs(player._landingOppVelPxPerSec) > 0.5
    ) {
      // Ignore 0→vel startup spikes (look like huge accel, break const-vel).
      accel =
        (vel - player._landingOppVelPxPerSec) / (TICK_MS / 1000);
    }
  } else if (
    Number.isFinite(opponentMovementVelocity) &&
    Number.isFinite(speedFactor) &&
    Math.abs(opponentMovementVelocity) > 1e-6
  ) {
    vel = opponentMovementVelocity * speedFactor * 1000;
    trusted = true;
  } else if (
    player._landingOppVelPxPerSec != null &&
    Number.isFinite(player._landingOppVelPxPerSec)
  ) {
    vel = player._landingOppVelPxPerSec;
    trusted = Math.abs(vel) > 0.5;
  }
  player._landingOppPrevX = opponentX;
  // Quantize tiny noise so deadline / prediction do not chatter.
  if (Math.abs(vel) < 0.5) vel = 0;
  if (Math.abs(accel) < 50) accel = 0; // ignore float chatter
  player._landingOppVelPxPerSec = vel;
  player._landingOppAccelPxPerSec2 = accel;
  return { vel, trusted, accel };
}

/**
 * True when a conflict at the given planning pose can still be resolved with a
 * clear (or tolerable-residual) same-side Hermite/brake path from the raw arc.
 */
function canResolveConflictAtT({
  t,
  jumperStartX,
  rawTargetX,
  jumpDirection,
  opponentX,
  minimumDistance,
  mapLeft,
  mapRight,
  activeMs,
  commitTMax,
  commitTMin,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const commitX = rawArcX(jumperStartX, rawTargetX, t);
  const commitVel = rawArcVelocity(jumperStartX, rawTargetX, t, activeMs);
  const remainingSec = Math.max(0, (1 - t) * (activeMs / 1000));
  const intent = resolveSideIntent({
    rawTargetX,
    jumperStartX,
    jumpDirection: dir,
    opponentX,
    minimumDistance,
    mapLeft,
    mapRight,
  });
  const sides = [intent.side];
  const alt = /** @type {1|-1} */ (-intent.side);
  if (alt !== intent.side) sides.push(alt);

  for (const side of sides) {
    const endpointX = clampToMap(
      sideEndpoint(opponentX, side, minimumDistance),
      mapLeft,
      mapRight
    );
    if (isStrictlyBehind(commitX, endpointX, dir)) continue;
    const overlap = overlapAt(endpointX, opponentX, minimumDistance);
    if (overlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX) continue;
    const hermite = evaluateHermiteFeasibility({
      commitX,
      commitVel,
      endpointX,
      remainingSec,
      jumpDirection: dir,
    });
    if (hermite.feasible && hermite.withinPlannerBudget) return true;
    const brake = evaluateBrakeFeasibility({
      commitX,
      commitVel,
      endpointX,
      remainingSec,
      jumpDirection: dir,
    });
    if (brake.feasible && brake.withinPlannerBudget) return true;
  }
  return false;
}

/**
 * Latest active-arc fraction where a newly appearing conflict at `opponentX`
 * can still be resolved aerially. Deterministic; quantized to NO_RETURN_T_QUANTUM.
 */
function computeNoReturnDeadlineT({
  jumperStartX,
  rawTargetX,
  jumpDirection,
  opponentX,
  minimumDistance,
  mapLeft = MAP_LEFT_BOUNDARY,
  mapRight = MAP_RIGHT_BOUNDARY,
  activeMs = ROPE_JUMP_ACTIVE_MS,
  commitTMax = ROPE_JUMP_LANDING_COMMIT_T,
  commitTMin = ROPE_JUMP_LANDING_COMMIT_T_MIN,
} = {}) {
  // Walk from late → early; first feasible from the late side is the deadline.
  let latest = commitTMin;
  for (let i = COMMIT_T_SEARCH_STEPS; i >= 0; i--) {
    const t =
      commitTMin + ((commitTMax - commitTMin) * i) / COMMIT_T_SEARCH_STEPS;
    if (
      canResolveConflictAtT({
        t,
        jumperStartX,
        rawTargetX,
        jumpDirection,
        opponentX,
        minimumDistance,
        mapLeft,
        mapRight,
        activeMs,
        commitTMax,
        commitTMin,
      })
    ) {
      latest = t;
      break;
    }
  }
  // If even commitTMin cannot resolve, deadline collapses to commitTMin
  // (anything later is late intrusion).
  const q = NO_RETURN_T_QUANTUM;
  return Math.round(latest / q) * q;
}

/**
 * Phase A.3 — select a stable near/cross side for a dynamic conflict.
 * Uses A.2 geometry on the touchdown-extrapolated opponent so an approaching
 * body does not lock a near-side cell it will immediately re-invade.
 *
 * When the A.2 preferred side's ideal endpoint is off-map or deeply residual
 * against the predicted cell, take the clear alternate (usually cross).
 */
function selectSideForDynamicConflict({
  rawTargetX,
  jumperStartX,
  jumpDirection,
  opponentX,
  predictedOpponentX,
  minimumDistance,
  jumperHalfWidth,
  mapLeft,
  mapRight,
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const planOpp = Number.isFinite(predictedOpponentX)
    ? predictedOpponentX
    : opponentX;
  const intent = resolveSideIntent({
    rawTargetX,
    jumperStartX,
    jumpDirection: dir,
    opponentX: planOpp,
    minimumDistance,
    jumperHalfWidth,
    mapLeft,
    mapRight,
  });

  // preserve_raw on the predicted cell means conflict is transient — still
  // pick a concrete side from current-conflict A.2 geometry.
  let chosen = intent;
  if (intent.intentClass === "preserve_raw") {
    chosen = resolveSideIntent({
      rawTargetX,
      jumperStartX,
      jumpDirection: dir,
      opponentX,
      minimumDistance,
      jumperHalfWidth,
      mapLeft,
      mapRight,
    });
  }

  if (chosen.intentClass === "preserve_raw") {
    const near = originatingSide(jumperStartX, planOpp, dir);
    chosen = {
      side: near,
      intentClass: "near",
      reason: "dynamic_conflict_force_near",
    };
  }

  const scoreSide = (side) => {
    const ideal = sideEndpoint(planOpp, side, minimumDistance);
    const end = clampToMap(ideal, mapLeft, mapRight);
    const ov = overlapAt(end, planOpp, minimumDistance);
    const onMap = ideal >= mapLeft && ideal <= mapRight;
    const escape = centerwardTravel(jumperStartX, end, dir);
    return { side, end, overlap: ov, onMap, escape };
  };

  const pref = scoreSide(chosen.side);
  const altSide = /** @type {1|-1} */ (-chosen.side);
  const alt = scoreSide(altSide);

  const minEscape = minCenterwardEscapePx(
    jumperHalfWidth,
    rawTargetX,
    jumperStartX
  );
  // Near endpoints behind late-commit raw X are fine — A.2 early-commits.
  // Only reject map-unfit / residual / sub-escape near (same as A.2).
  const prefOk =
    pref.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX &&
    pref.onMap &&
    pref.escape >= minEscape * 0.5;
  const altOk =
    alt.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX && alt.onMap;

  if (prefOk) {
    return {
      side: chosen.side,
      intentClass: chosen.intentClass,
      reason: `dynamic_${chosen.reason || "ok"}`,
      predictedOpponentX: planOpp,
    };
  }
  if (altOk) {
    return {
      side: altSide,
      intentClass: altSide === dir ? "cross" : "near",
      reason: "dynamic_preferred_unfit_alternate",
      predictedOpponentX: planOpp,
    };
  }
  // Both imperfect — pick lower residual overlap; prefer centerward escape.
  if (
    alt.overlap < pref.overlap - 1e-9 ||
    (Math.abs(alt.overlap - pref.overlap) <= 1e-9 && alt.escape > pref.escape)
  ) {
    return {
      side: altSide,
      intentClass: altSide === dir ? "cross" : "near",
      reason: "dynamic_both_imperfect_alternate",
      predictedOpponentX: planOpp,
    };
  }
  return {
    side: chosen.side,
    intentClass: chosen.intentClass,
    reason: `dynamic_${chosen.reason || "ok"}`,
    predictedOpponentX: planOpp,
  };
}

/**
 * Evaluate Hermite path quality for commit → endpoint with terminal vel 0.
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
    withinBudget:
      !behind &&
      !reverse &&
      peakVel <= MAX_TRAJECTORY_PEAK_VEL &&
      peakAccel <= MAX_TRAJECTORY_PEAK_ACCEL,
    withinPlannerBudget:
      !behind &&
      !reverse &&
      peakVel <= PLANNER_PEAK_VEL_BUDGET &&
      peakAccel <= PLANNER_PEAK_ACCEL_BUDGET,
  };
}

/**
 * Quadratic ease-out brake: x = p0 + (p1-p0)*(1-(1-s)²).
 */
function brakePosition(p0, p1, s) {
  const u = 1 - (1 - s) * (1 - s);
  return p0 + (p1 - p0) * u;
}

function brakeVelocity(p0, p1, s, durationSec) {
  const T = Math.max(durationSec, 1e-9);
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
    withinBudget:
      !behind &&
      !reverse &&
      velDisc <= BRAKE_MAX_VEL_DISCONTINUITY &&
      peakVel <= MAX_TRAJECTORY_PEAK_VEL &&
      peakAccel <= MAX_TRAJECTORY_PEAK_ACCEL,
    withinPlannerBudget:
      !behind &&
      !reverse &&
      velDisc <= BRAKE_MAX_VEL_DISCONTINUITY &&
      peakVel <= PLANNER_PEAK_VEL_BUDGET &&
      peakAccel <= PLANNER_PEAK_ACCEL_BUDGET,
  };
}

/**
 * Latest commit fraction where the raw arc has not yet passed `endpointX`
 * (strict, no 0.75px epsilon). Then walk earlier if needed for motion budgets.
 */
function computeRecommendedCommitT({
  jumperStartX,
  rawTargetX,
  endpointX,
  jumpDirection,
  activeMs = ROPE_JUMP_ACTIVE_MS,
  commitTMax = ROPE_JUMP_LANDING_COMMIT_T,
  commitTMin = ROPE_JUMP_LANDING_COMMIT_T_MIN,
  trajectoryType = "hermite",
}) {
  const dir = jumpDirection >= 0 ? 1 : -1;
  const span = rawTargetX - jumperStartX;

  let tLatest = commitTMax;
  if (Math.abs(span) > 1e-9) {
    const atMax = rawArcX(jumperStartX, rawTargetX, commitTMax);
    if (isStrictlyBehind(atMax, endpointX, dir)) {
      const e = (endpointX - jumperStartX) / span;
      if (e <= 0) tLatest = commitTMin;
      else if (e >= 1) tLatest = commitTMax;
      else tLatest = ropeJumpEaseInverse(e);
      tLatest = Math.max(commitTMin, Math.min(commitTMax, tLatest));
    }
  }

  // Prefer the latest commit time that still satisfies motion budgets.
  let chosen = commitTMin;
  let found = false;
  for (let i = COMMIT_T_SEARCH_STEPS; i >= 0; i--) {
    const t =
      commitTMin + ((tLatest - commitTMin) * i) / COMMIT_T_SEARCH_STEPS;
    const commitX = rawArcX(jumperStartX, rawTargetX, t);
    if (isStrictlyBehind(commitX, endpointX, dir)) continue;
    const commitVel = rawArcVelocity(jumperStartX, rawTargetX, t, activeMs);
    const remainingSec = Math.max(0, (1 - t) * (activeMs / 1000));
    const travel = Math.abs(endpointX - commitX);
    if (travel <= HOLD_SETTLE_EPS_PX) {
      if (Math.abs(commitVel) <= HOLD_SETTLE_MAX_COMMIT_VEL) {
        chosen = t;
        found = true;
        break;
      }
      continue;
    }
    let motion;
    if (trajectoryType === "brake") {
      motion = evaluateBrakeFeasibility({
        commitX,
        commitVel,
        endpointX,
        remainingSec,
        jumpDirection: dir,
      });
    } else {
      motion = evaluateHermiteFeasibility({
        commitX,
        commitVel,
        endpointX,
        remainingSec,
        jumpDirection: dir,
      });
      if (motion.reverse || !motion.withinPlannerBudget) {
        const brake = evaluateBrakeFeasibility({
          commitX,
          commitVel,
          endpointX,
          remainingSec,
          jumpDirection: dir,
        });
        if (brake.feasible && brake.withinPlannerBudget) motion = brake;
      }
    }
    if (motion.feasible && motion.withinPlannerBudget) {
      chosen = t;
      found = true;
      break;
    }
  }

  if (!found) {
    // No planner-budget time exists. Prefer the EARLIEST non-overshoot commit
    // so Hermite/brake has maximum remaining duration (A.3 far-cross dynamic
    // cases). Falling back to tLatest here recreated ~2× peak-vel spikes.
    chosen = commitTMin;
    for (let i = 0; i <= COMMIT_T_SEARCH_STEPS; i++) {
      const t =
        commitTMin + ((tLatest - commitTMin) * i) / COMMIT_T_SEARCH_STEPS;
      const commitX = rawArcX(jumperStartX, rawTargetX, t);
      if (!isStrictlyBehind(commitX, endpointX, dir)) {
        chosen = t;
        break;
      }
    }
  }
  return chosen;
}

/**
 * Build a same-side landing candidate. Does not silently switch sides.
 * hold_settle only when remaining travel is tiny AND commit vel is low
 * (emergency/float) — never as a normal response to a behind preferred point.
 */
function buildSideCandidate(
  side,
  kind,
  opponentX,
  minimumDistance,
  mapLeft,
  mapRight,
  commitX,
  jumpDirection,
  allowHoldSettle
) {
  const ideal = sideEndpoint(opponentX, side, minimumDistance);
  const clamped = clampToMap(ideal, mapLeft, mapRight);
  const boundaryLimited = clamped !== ideal;
  let endpointX = clamped;
  let trajectoryType = "hermite";
  let overlap = overlapAt(endpointX, opponentX, minimumDistance);

  if (isEndpointBehind(commitX, endpointX, jumpDirection)) {
    // Keep side; forward-clamp so we do not reverse. Caller may early-commit
    // instead via recommendedCommitT when planning from the raw arc.
    endpointX = forwardClampEndpoint(commitX, endpointX, jumpDirection);
    overlap = overlapAt(endpointX, opponentX, minimumDistance);
  }

  if (
    allowHoldSettle &&
    Math.abs(endpointX - commitX) <= HOLD_SETTLE_EPS_PX &&
    overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX
  ) {
    endpointX = commitX;
    overlap = overlapAt(endpointX, opponentX, minimumDistance);
    trajectoryType = "hold_settle";
    kind = kind === "emergency_raw" ? kind : "emergency_hold_settle";
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

function scoreSameSideCandidate(candidate, ctx) {
  const {
    commitX,
    commitVel,
    remainingSec,
    jumpDirection,
    rawTargetX,
    jumperStartX,
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
      travel: 0,
      signedTravel: 0,
      feasible: Math.abs(commitVel) <= HOLD_SETTLE_MAX_COMMIT_VEL,
      withinBudget: Math.abs(commitVel) <= HOLD_SETTLE_MAX_COMMIT_VEL,
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
  const rejects = [];
  let score = 0;

  if (
    candidate.overlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX &&
    candidate.kind !== "emergency_raw" &&
    candidate.kind !== "emergency_hold_settle"
  ) {
    rejects.push("overlap_above_tolerable");
  }
  if (isHold && Math.abs(commitVel) > HOLD_SETTLE_MAX_COMMIT_VEL) {
    rejects.push("hold_settle_velocity_too_high");
  } else if (!isHold && (motion.reverse || motion.behind)) {
    rejects.push("direction_reversal");
  } else if (
    isBrake &&
    motion.velDiscontinuity > BRAKE_MAX_VEL_DISCONTINUITY
  ) {
    rejects.push("brake_velocity_discontinuity");
  }

  if (rejects.length && !String(candidate.kind).startsWith("emergency")) {
    return {
      ...candidate,
      motion,
      travelRatio,
      score: Infinity,
      rejects,
      feasible: false,
    };
  }

  score += candidate.overlap * 4;
  score += travelFromCommit * 0.15;
  score += motion.peakVel * 0.01;
  score += motion.peakAccel * 0.00005;
  if (!motion.withinBudget) score += 50;
  if (isHold) score += 30;
  if (candidate.kind === "emergency_raw") score += 800 + candidate.overlap * 10;
  if (travelRatio > MAX_CROSSUP_TRAVEL_RATIO) score += 20;

  return {
    ...candidate,
    motion,
    travelRatio,
    score,
    rejects,
    feasible: rejects.length === 0 || String(candidate.kind).startsWith("emergency"),
  };
}

/**
 * Phase A.2 endpoint planner — refines endpoint + trajectory WITHIN a locked
 * (or freshly resolved) side. Weighted score never selects the opposite side.
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
  activeMs = ROPE_JUMP_ACTIVE_MS,
  commitTMax = ROPE_JUMP_LANDING_COMMIT_T,
  commitTMin = ROPE_JUMP_LANDING_COMMIT_T_MIN,
  sideIntentLocked = false,
  lockedSide = null,
  lockedIntentClass = null,
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

  const intent =
    sideIntentLocked && (lockedSide === 1 || lockedSide === -1)
      ? {
          side: lockedSide,
          intentClass: lockedIntentClass || "locked",
          nearIdeal: sideEndpoint(
            safeOpp,
            originatingSide(safeStart, safeOpp, dir),
            minimumDistance
          ),
          nearFitsOnMap: true,
          reason: "locked",
        }
      : resolveSideIntent({
          rawTargetX: safeRaw,
          jumperStartX: safeStart,
          jumpDirection: dir,
          opponentX: safeOpp,
          minimumDistance,
          jumperHalfWidth: jHalf,
          mapLeft,
          mapRight,
          preferredSide: preferredSideOverride,
        });

  const preferredSide = intent.side;

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
    intentClass: intent.intentClass,
    intentReason: intent.reason,
  };

  // No conflict — keep the intentional raw destination.
  // Phase A.3: once a near/cross side is locked, never fall back to raw just
  // because the opponent later left the raw footprint (rawOverlap ≤ 0).
  if (
    !sideIntentLocked &&
    (intent.intentClass === "preserve_raw" || rawOverlap <= 0)
  ) {
    const motion = evaluateHermiteFeasibility({
      commitX: safeCurrent,
      commitVel,
      endpointX: safeRaw,
      remainingSec,
      jumpDirection: dir,
    });
    const recommendedCommitT = computeRecommendedCommitT({
      jumperStartX: safeStart,
      rawTargetX: safeRaw,
      endpointX: safeRaw,
      jumpDirection: dir,
      activeMs,
      commitTMax,
      commitTMin,
      trajectoryType: "hermite",
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
      recommendedCommitT,
      requiresEarlyCommit: recommendedCommitT < commitTMax - 1e-9,
    };
  }

  const ctx = {
    commitX: safeCurrent,
    commitVel,
    remainingSec,
    jumpDirection: dir,
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
  };

  const candidates = [];
  const prefCand = buildSideCandidate(
    preferredSide,
    intent.intentClass === "cross" ? "exact_clear_cross" : "exact_clear_preferred",
    safeOpp,
    minimumDistance,
    mapLeft,
    mapRight,
    safeCurrent,
    dir,
    false // ordinary path: no hold_settle conversion
  );
  candidates.push(prefCand);

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
    if (hermiteMotion.reverse || !hermiteMotion.withinBudget) {
      candidates.push({
        ...prefCand,
        kind: "small_residual_preferred",
        trajectoryType: "brake",
      });
    }
  }

  // Emergency: settle toward raw only if still on the locked side geometrically
  // or as last-resort finite fallback (never a competing opposite-side win).
  candidates.push({
    side: preferredSide,
    kind: "emergency_raw",
    endpointX: forwardClampEndpoint(
      safeCurrent,
      clampToMap(
        preferredSide === 1
          ? Math.max(safeRaw, sideEndpoint(safeOpp, 1, minimumDistance))
          : Math.min(safeRaw, sideEndpoint(safeOpp, -1, minimumDistance)),
        mapLeft,
        mapRight
      ),
      dir
    ),
    ideal: safeRaw,
    clamped: safeRaw,
    boundaryLimited: false,
    overlap: rawOverlap,
    trajectoryType: "hermite",
  });

  // True geometry emergency hold — only when travel already ~0 at low vel.
  if (
    Math.abs(prefCand.endpointX - safeCurrent) <= HOLD_SETTLE_EPS_PX &&
    Math.abs(commitVel) <= HOLD_SETTLE_MAX_COMMIT_VEL
  ) {
    candidates.push({
      side: preferredSide,
      kind: "emergency_hold_settle",
      endpointX: safeCurrent,
      ideal: prefCand.ideal,
      clamped: safeCurrent,
      boundaryLimited: prefCand.boundaryLimited,
      overlap: overlapAt(safeCurrent, safeOpp, minimumDistance),
      trajectoryType: "hold_settle",
    });
  }

  const scored = candidates.map((c) => scoreSameSideCandidate(c, ctx));
  scored.sort((a, b) => a.score - b.score);
  let best = scored.find((c) => Number.isFinite(c.score) && c.feasible) || scored[0];

  // If current commit pose makes the side endpoint behind/infeasible, the
  // authoritative endpoint remains the ideal/clamped side target — commit
  // timing will move earlier via recommendedCommitT.
  const idealSideX = clampToMap(
    sideEndpoint(safeOpp, preferredSide, minimumDistance),
    mapLeft,
    mapRight
  );
  if (
    best &&
    (best.score === Infinity || isEndpointBehind(safeCurrent, idealSideX, dir))
  ) {
    const plannedEndpoint = idealSideX;
    const plannedOverlap = overlapAt(plannedEndpoint, safeOpp, minimumDistance);
    best = {
      side: preferredSide,
      kind:
        plannedOverlap > 0
          ? "small_residual_preferred"
          : intent.intentClass === "cross"
            ? "exact_clear_cross"
            : "exact_clear_preferred",
      endpointX: plannedEndpoint,
      ideal: sideEndpoint(safeOpp, preferredSide, minimumDistance),
      clamped: plannedEndpoint,
      boundaryLimited:
        sideEndpoint(safeOpp, preferredSide, minimumDistance) !== plannedEndpoint,
      overlap: plannedOverlap,
      trajectoryType: "hermite",
      motion: null,
      travelRatio:
        Math.abs(plannedEndpoint - safeCurrent) /
        Math.max(1e-6, Math.abs(safeRaw - safeStart)),
      score: 0,
      rejects: [],
      feasible: true,
    };
  }

  let fallbackReason = null;
  let usedFallback = false;
  let decisionClass = best.kind;

  if (
    (best.kind === "exact_clear_preferred" || best.kind === "exact_clear_cross") &&
    best.overlap <= 0 &&
    !best.boundaryLimited
  ) {
    decisionClass =
      intent.intentClass === "cross"
        ? "cross_side_clear"
        : "exact_clear_preferred";
  } else if (best.boundaryLimited && best.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    fallbackReason =
      best.overlap > 0
        ? "small_residual_preferred_side"
        : "preferred_side_clamped";
    usedFallback = true;
    decisionClass =
      best.overlap > 0 ? "small_residual_preferred" : "exact_clear_preferred";
  } else if (
    best.overlap > 0 &&
    best.overlap <= TOLERABLE_TOUCHDOWN_OVERLAP_PX
  ) {
    fallbackReason = "small_residual_preferred_side";
    usedFallback = true;
    decisionClass = "small_residual_preferred";
  } else if (best.kind === "emergency_hold_settle") {
    fallbackReason = "emergency_hold_settle";
    usedFallback = true;
    decisionClass = "emergency_hold_settle";
  } else if (best.kind === "emergency_raw") {
    fallbackReason = "trajectory_infeasible_raw_settle";
    usedFallback = true;
    decisionClass = "trajectory_infeasible_raw_settle";
  } else if (best.overlap > TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    fallbackReason = "both_sides_constrained";
    usedFallback = true;
    decisionClass = "both_sides_constrained";
  } else if (intent.intentClass === "cross") {
    decisionClass = "cross_side_clear";
    usedFallback = intent.reason === "near_side_unavailable_cross_escape";
    fallbackReason = usedFallback ? intent.reason : null;
  }

  const recommendedCommitT = computeRecommendedCommitT({
    jumperStartX: safeStart,
    rawTargetX: safeRaw,
    endpointX: best.endpointX,
    jumpDirection: dir,
    activeMs,
    commitTMax,
    commitTMin,
    trajectoryType: best.trajectoryType === "brake" ? "brake" : "hermite",
  });

  // Legacy alias: true when commit must happen before nominal max.
  const requiresEarlyCommit = recommendedCommitT < commitTMax - 1e-9;

  return {
    ...base,
    resolvedTargetX: best.endpointX,
    resolvedSide: preferredSide,
    boundaryLimited: !!best.boundaryLimited,
    usedFallback,
    fallbackReason,
    decisionClass,
    trajectoryType: best.trajectoryType || "hermite",
    residualOverlap: best.overlap,
    feasibility: best.motion || null,
    recommendedCommitT,
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
 * Phase A.2: uses resolveSideIntent; does not use rawOnCenter epsilon.
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
  const intent = resolveSideIntent({
    rawTargetX: safeRaw,
    jumperStartX: safeStart,
    jumpDirection: dir,
    opponentX: safeOpp,
    minimumDistance,
    jumperHalfWidth: jHalf,
    mapLeft,
    mapRight,
    preferredSide: preferredSideOverride,
  });
  const preferredSide = intent.side;

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
    intentClass: intent.intentClass,
    intentReason: intent.reason,
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
  if (preferred.overlapAfter <= TOLERABLE_TOUCHDOWN_OVERLAP_PX) {
    const residual = preferred.overlapAfter;
    return {
      ...base,
      resolvedTargetX: preferred.clamped,
      resolvedSide: preferredSide,
      boundaryLimited: preferred.boundaryLimited,
      usedFallback:
        residual > 0 ||
        preferred.boundaryLimited ||
        intent.reason === "near_side_unavailable_cross_escape",
      fallbackReason:
        residual > 0
          ? "small_residual_preferred_side"
          : preferred.boundaryLimited
            ? "preferred_side_clamped"
            : intent.reason === "near_side_unavailable_cross_escape"
              ? "near_side_unavailable_cross_escape"
              : null,
      decisionClass:
        residual > 0
          ? "small_residual_preferred"
          : intent.intentClass === "cross"
            ? "cross_side_clear"
            : "exact_clear_preferred",
      residualOverlap: residual,
    };
  }

  // Intent side deeply constrained (override / extreme sizes): try alternate
  // only as geometry emergency — not as a scored gameplay flip.
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
  player.ropeJumpSideIntentLocked = false;
  player.ropeJumpSideIntent = 0;
  player.ropeJumpIntentClass = null;
  player.ropeJumpIntentReason = null;
  player.ropeJumpRecommendedCommitT = 0;
  player.ropeJumpSideIntentOpponentX = 0;
  // Phase A.3 planning lifecycle
  player.ropeJumpPlanningState = null;
  player.ropeJumpFirstRawConflictTick = 0;
  player.ropeJumpFirstRawConflictT = -1;
  player.ropeJumpSideLockTick = 0;
  player.ropeJumpSideLockReason = null;
  player.ropeJumpNoReturnDeadlineT = 0;
  player.ropeJumpConflictBeforeDeadline = null;
  player.ropeJumpEndpointCommitTick = 0;
  player.ropeJumpLateIntrusion = false;
  player.ropeJumpLateIntrusionClass = null;
  player.ropeJumpSafetyCorrectionTicks = 0;
  player._landingTrace = null;
  player._landingPrevX = null;
  player._landingPrevVel = null;
  player._landingTickIndex = 0;
  player._landingOppPrevX = null;
  player._landingOppVelPxPerSec = 0;
  player._landingOppAccelPxPerSec2 = 0;
}

/**
 * Initialize landing fields at rope-jump start.
 * rawTargetX should already be map-clamped.
 */
function initRopeJumpLandingState(player, rawTargetX, useV2 = ROPE_JUMP_LANDING_V2) {
  clearRopeJumpLandingState(player);
  player.ropeJumpRawTargetX = rawTargetX;
  player.ropeJumpLandingPath = useV2 ? "v2" : "legacy";
  if (useV2) {
    player.ropeJumpPlanningState = PLANNING_PROVISIONAL_RAW;
  }
  if (LANDING_TRACE || LANDING_DEBUG_NET) {
    player._landingTrace = {
      path: player.ropeJumpLandingPath,
      samples: [],
      startX: player.ropeJumpStartX,
      rawTargetX,
      jumpDirection: player.ropeJumpDirection,
      startedAt: player.ropeJumpStartTime,
      planningState: player.ropeJumpPlanningState,
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
    sideIntent: player.ropeJumpSideIntent,
    intentClass: player.ropeJumpIntentClass,
    planningState: player.ropeJumpPlanningState,
    firstRawConflictTick: player.ropeJumpFirstRawConflictTick,
    firstRawConflictT: player.ropeJumpFirstRawConflictT,
    sideLockTick: player.ropeJumpSideLockTick,
    sideLockReason: player.ropeJumpSideLockReason,
    noReturnDeadlineT: player.ropeJumpNoReturnDeadlineT,
    conflictBeforeDeadline: player.ropeJumpConflictBeforeDeadline,
    endpointCommitTick: player.ropeJumpEndpointCommitTick,
    lateIntrusion: player.ropeJumpLateIntrusion,
    lateIntrusionClass: player.ropeJumpLateIntrusionClass,
    safetyCorrectionTicks: player.ropeJumpSafetyCorrectionTicks,
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
    sideIntent: player.ropeJumpSideIntent,
    intentClass: player.ropeJumpIntentClass,
    intentReason: player.ropeJumpIntentReason,
    recommendedCommitT: player.ropeJumpRecommendedCommitT,
    planningState: player.ropeJumpPlanningState,
    firstRawConflictTick: player.ropeJumpFirstRawConflictTick,
    firstRawConflictT: player.ropeJumpFirstRawConflictT,
    sideLockTick: player.ropeJumpSideLockTick,
    sideLockReason: player.ropeJumpSideLockReason,
    noReturnDeadlineT: player.ropeJumpNoReturnDeadlineT,
    conflictBeforeDeadline: player.ropeJumpConflictBeforeDeadline,
    endpointCommitTick: player.ropeJumpEndpointCommitTick,
    lateIntrusion: player.ropeJumpLateIntrusion,
    lateIntrusionClass: player.ropeJumpLateIntrusionClass,
    minDistance: player.ropeJumpMinDistance,
    centerDistance: player.ropeJumpCenterDistance,
    overlap: player.ropeJumpOverlap,
    safetyCorrectionPx: player.ropeJumpSafetyCorrectionPx,
    safetyCorrectionTicks: player.ropeJumpSafetyCorrectionTicks,
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
  player.ropeJumpRecommendedCommitT = decision.recommendedCommitT || commitT;
  player.ropeJumpPlanningState = PLANNING_ENDPOINT_COMMITTED;
  player.ropeJumpEndpointCommitTick = player._landingTickIndex || 0;
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
 * V2 (A.3): provisional raw-clear → lock near/cross only on conflict →
 * refine endpoint on that side (touchdown-extrapolated opp) → commit once →
 * Hermite/brake travel. No post-commit re-home.
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
  const speedFactor =
    options.speedFactor != null ? options.speedFactor : 0.185;

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

  if (useV2 && opponent && t >= commitTMin) {
    const jHalf = getPushboxHalfWidth(player.sizeMultiplier);
    const oHalf = getPushboxHalfWidth(opponent.sizeMultiplier);
    const minimumDistance = jHalf + oHalf;
    const dirSign = player.ropeJumpDirection >= 0 ? 1 : -1;
    const remainingSec = Math.max(0, (1 - t) * (activeMs / 1000));
    const rawXAtMax = rawArcX(startX, rawTargetX, commitTMax);

    if (!player.ropeJumpPlanningState) {
      player.ropeJumpPlanningState = PLANNING_PROVISIONAL_RAW;
    }

    const oppVelEst = updateOpponentVelocityEstimate(
      player,
      opponent.x,
      opponent.movementVelocity,
      speedFactor
    );
    const oppVel = oppVelEst.vel;
    const oppVelTrusted = oppVelEst.trusted;
    const oppAccel = oppVelEst.accel || 0;
    const predictedOppX = predictOpponentX(
      opponent.x,
      oppVel,
      remainingSec,
      mapLeft,
      mapRight,
      oppAccel
    );
    const rawOverlapNow = rawFootprintOverlap(
      rawTargetX,
      opponent.x,
      minimumDistance
    );

    // Dynamic no-return: while raw is still clear, the full commit window
    // remains available. Once conflict geometry exists, compute the latest t
    // at which that cell can still be resolved aerially.
    if (player.ropeJumpPlanningState === PLANNING_PROVISIONAL_RAW) {
      if (rawOverlapNow <= 0) {
        player.ropeJumpNoReturnDeadlineT = commitTMax;
      } else {
        const noReturn = computeNoReturnDeadlineT({
          jumperStartX: startX,
          rawTargetX,
          jumpDirection: dirSign,
          opponentX: predictedOppX,
          minimumDistance,
          mapLeft,
          mapRight,
          activeMs,
          commitTMax,
          commitTMin,
        });
        // Ratchet later only — never walk earlier from float noise.
        const prev = player.ropeJumpNoReturnDeadlineT || commitTMin;
        player.ropeJumpNoReturnDeadlineT = Math.max(prev, noReturn);
      }
    }

    // Record first observable raw-footprint conflict.
    if (rawOverlapNow > 0 && player.ropeJumpFirstRawConflictT < 0) {
      player.ropeJumpFirstRawConflictTick = player._landingTickIndex;
      player.ropeJumpFirstRawConflictT = t;
      player.ropeJumpConflictBeforeDeadline =
        !player.ropeJumpLandingCommitted &&
        t <= player.ropeJumpNoReturnDeadlineT + 1e-9;
    }

    // 1) Side lock — only on near/cross conflict. preserve_raw stays provisional.
    // Wait one tick for a trusted velocity sample when conflict appears early,
    // so approach direction can reject a soon-to-be-invaded near side.
    const canDelayForVelocity =
      !oppVelTrusted &&
      t + TICK_MS / activeMs < commitTMax - 1e-9 &&
      t <= player.ropeJumpNoReturnDeadlineT;
    if (
      !player.ropeJumpSideIntentLocked &&
      player.ropeJumpPlanningState === PLANNING_PROVISIONAL_RAW &&
      rawOverlapNow > 0 &&
      !canDelayForVelocity
    ) {
      const beforeDeadline =
        t <= player.ropeJumpNoReturnDeadlineT + 1e-9 &&
        !player.ropeJumpLandingCommitted;
      if (beforeDeadline) {
        const selected = selectSideForDynamicConflict({
          rawTargetX,
          jumperStartX: startX,
          jumpDirection: dirSign,
          opponentX: opponent.x,
          predictedOpponentX: predictedOppX,
          minimumDistance,
          jumperHalfWidth: jHalf,
          mapLeft,
          mapRight,
        });
        player.ropeJumpSideIntentLocked = true;
        player.ropeJumpSideIntent = selected.side;
        player.ropeJumpIntentClass = selected.intentClass;
        player.ropeJumpIntentReason = selected.reason;
        player.ropeJumpSideLockReason = selected.reason;
        player.ropeJumpPreferredSide = selected.side;
        player.ropeJumpSideIntentOpponentX = opponent.x;
        player.ropeJumpSideLockTick = player._landingTickIndex;
        player.ropeJumpPlanningState = PLANNING_SIDE_LOCKED;
        player.ropeJumpConflictBeforeDeadline = true;
      } else if (!player.ropeJumpLandingCommitted) {
        // Conflict after no-return but before commit — still try to lock a
        // side if immediately reachable; else mark late intrusion at commit.
        const selected = selectSideForDynamicConflict({
          rawTargetX,
          jumperStartX: startX,
          jumpDirection: dirSign,
          opponentX: opponent.x,
          predictedOpponentX: predictedOppX,
          minimumDistance,
          jumperHalfWidth: jHalf,
          mapLeft,
          mapRight,
        });
        const canStill = canResolveConflictAtT({
          t,
          jumperStartX: startX,
          rawTargetX,
          jumpDirection: dirSign,
          opponentX: predictedOppX,
          minimumDistance,
          mapLeft,
          mapRight,
          activeMs,
          commitTMax,
          commitTMin,
        });
        if (canStill) {
          player.ropeJumpSideIntentLocked = true;
          player.ropeJumpSideIntent = selected.side;
          player.ropeJumpIntentClass = selected.intentClass;
          player.ropeJumpIntentReason = selected.reason;
          player.ropeJumpSideLockReason = selected.reason;
          player.ropeJumpPreferredSide = selected.side;
          player.ropeJumpSideIntentOpponentX = opponent.x;
          player.ropeJumpSideLockTick = player._landingTickIndex;
          player.ropeJumpPlanningState = PLANNING_SIDE_LOCKED;
          player.ropeJumpConflictBeforeDeadline = false;
        } else {
          player.ropeJumpLateIntrusion = true;
          player.ropeJumpLateIntrusionClass =
            "conflict_after_no_return_unresolvable";
          player.ropeJumpConflictBeforeDeadline = false;
        }
      }
    }

    if (!player.ropeJumpLandingCommitted) {
      const sideLocked = !!player.ropeJumpSideIntentLocked;
      // Planning opponent: extrapolate to touchdown while side-locked so
      // steady approach yields a stable clear endpoint (not a re-invaded near).
      const planOppX = sideLocked
        ? planningOpponentX(
            predictedOppX,
            player.ropeJumpSideIntent,
            oppVel,
            mapLeft,
            mapRight
          )
        : opponent.x;

      decision = planLandingEndpoint({
        rawTargetX,
        jumperStartX: startX,
        jumperCurrentX: xAlongRaw,
        jumpDirection: dirSign,
        opponentX: planOppX,
        jumperHalfWidth: jHalf,
        opponentHalfWidth: oHalf,
        mapLeft,
        mapRight,
        commitVel: velAlongRaw,
        remainingSec,
        rawXAtMaxCommit: rawXAtMax,
        activeMs,
        commitTMax,
        commitTMin,
        sideIntentLocked: sideLocked,
        lockedSide: sideLocked ? player.ropeJumpSideIntent : null,
        lockedIntentClass: sideLocked ? player.ropeJumpIntentClass : null,
      });

      player.ropeJumpRecommendedCommitT = decision.recommendedCommitT;
      if (sideLocked) {
        player.ropeJumpPreferredSide = player.ropeJumpSideIntent;
      }

      const nextT = Math.min(1, t + TICK_MS / activeMs);
      const nextX = rawArcX(startX, rawTargetX, nextT);
      const endpoint = decision.resolvedTargetX;
      const nextWouldPass =
        !isStrictlyBehind(xAlongRaw, endpoint, dirSign) &&
        isStrictlyBehind(nextX, endpoint, dirSign);
      const mustLock =
        t >= commitTMax ||
        t + 1e-9 >= decision.recommendedCommitT ||
        nextWouldPass;

      if (mustLock) {
        // If still provisional at final commit, lock preserve_raw as the
        // committed raw path — not as a near/cross side intent.
        if (!sideLocked) {
          player.ropeJumpIntentClass = "preserve_raw";
          player.ropeJumpIntentReason = "raw_clear_through_commit";
          player.ropeJumpPreferredSide =
            rawTargetX < opponent.x
              ? -1
              : rawTargetX > opponent.x
                ? 1
                : dirSign;
          player.ropeJumpResolvedSide = player.ropeJumpPreferredSide;
        }

        const commitPlanOppX = sideLocked
          ? planningOpponentX(
              predictedOppX,
              player.ropeJumpSideIntent,
              oppVel,
              mapLeft,
              mapRight
            )
          : opponent.x;
        const commitPlan = planLandingEndpoint({
          rawTargetX,
          jumperStartX: startX,
          jumperCurrentX: xAlongRaw,
          jumpDirection: dirSign,
          opponentX: commitPlanOppX,
          jumperHalfWidth: jHalf,
          opponentHalfWidth: oHalf,
          mapLeft,
          mapRight,
          commitVel: velAlongRaw,
          remainingSec,
          rawXAtMaxCommit: rawXAtMax,
          activeMs,
          commitTMax,
          commitTMin,
          sideIntentLocked: sideLocked,
          lockedSide: sideLocked ? player.ropeJumpSideIntent : null,
          lockedIntentClass: sideLocked ? player.ropeJumpIntentClass : null,
        });

        if (sideLocked) {
          commitPlan.resolvedSide = player.ropeJumpSideIntent;
          commitPlan.preferredSide = player.ropeJumpSideIntent;
        }

        if (isStrictlyBehind(xAlongRaw, commitPlan.resolvedTargetX, dirSign)) {
          commitPlan.resolvedTargetX = xAlongRaw;
          commitPlan.trajectoryType =
            Math.abs(velAlongRaw) <= HOLD_SETTLE_MAX_COMMIT_VEL
              ? "hold_settle"
              : "brake";
          commitPlan.decisionClass = "endpoint_forward_clamped_at_commit";
          commitPlan.residualOverlap = overlapAt(
            xAlongRaw,
            opponent.x,
            minimumDistance
          );
        } else if (
          commitPlan.trajectoryType === "hermite" &&
          evaluateHermiteFeasibility({
            commitX: xAlongRaw,
            commitVel: velAlongRaw,
            endpointX: commitPlan.resolvedTargetX,
            remainingSec,
            jumpDirection: dirSign,
          }).reverse
        ) {
          commitPlan.trajectoryType = "brake";
        }

        // Post-commit conflict classification: if raw already overlapped before
        // this commit and we could not side-lock, mark late intrusion.
        if (
          !sideLocked &&
          rawOverlapNow > 0 &&
          commitPlan.decisionClass === "exact_clear_raw"
        ) {
          player.ropeJumpLateIntrusion = true;
          player.ropeJumpLateIntrusionClass =
            "raw_commit_with_unresolved_conflict";
        }

        applyCommitDecision(player, commitPlan, xAlongRaw, t, velAlongRaw);
        decision = commitPlan;
        committedThisTick = true;
      }
    } else if (player.ropeJumpLandingCommitted && !player.ropeJumpLateIntrusion) {
      // True late intrusion: first raw-footprint conflict appears only after
      // the endpoint was already committed (not approach into a planned cross).
      if (
        player.ropeJumpFirstRawConflictT >
        player.ropeJumpLandingCommitT + 1e-9
      ) {
        player.ropeJumpLateIntrusion = true;
        player.ropeJumpLateIntrusionClass = "conflict_after_endpoint_commit";
        player.ropeJumpConflictBeforeDeadline = false;
      }
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
      sideIntent: player.ropeJumpSideIntent,
      intentClass: player.ropeJumpIntentClass,
      decisionClass: player.ropeJumpDecisionClass,
      fallbackReason: player.ropeJumpFallbackReason,
      recommendedCommitT: player.ropeJumpRecommendedCommitT,
      planningState: player.ropeJumpPlanningState,
      noReturnDeadlineT: player.ropeJumpNoReturnDeadlineT,
      firstRawConflictT: player.ropeJumpFirstRawConflictT,
      lateIntrusion: !!player.ropeJumpLateIntrusion,
      lateIntrusionClass: player.ropeJumpLateIntrusionClass,
      overlap: player.ropeJumpOverlap,
      committed: !!player.ropeJumpLandingCommitted,
      easedT: Number(easedT.toFixed(4)),
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
    const touchX = clampToMap(landX, mapLeft, mapRight);
    if (Math.abs(touchX - player.x) > 1.0) {
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
  MAX_TRAJECTORY_PEAK_VEL,
  MAX_TRAJECTORY_PEAK_ACCEL,
  MIN_CENTERWARD_ESCAPE_FLOOR_PX,
  MIN_CENTERWARD_ESCAPE_HALF_WIDTH_FRAC,
  MIN_CENTERWARD_ESCAPE_RAW_SPAN_FRAC,
  ORDINARY_MAX_SAFETY_CORRECTION_TICKS,
  ORDINARY_MAX_TOTAL_SAFETY_CORRECTION_PX,
  LATE_INTRUSION_MAX_SAFETY_CORRECTION_TICKS,
  LATE_INTRUSION_MAX_TOTAL_SAFETY_CORRECTION_PX,
  PLANNING_PROVISIONAL_RAW,
  PLANNING_SIDE_LOCKED,
  PLANNING_ENDPOINT_COMMITTED,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
  ropeJumpEase,
  ropeJumpEaseDeriv,
  ropeJumpEaseInverse,
  rawArcX,
  rawArcVelocity,
  hermitePosition,
  hermiteVelocity,
  didRawPathCrossOpponent,
  choosePreferredLandingSide,
  resolveSideIntent,
  resolveLandingTarget,
  planLandingEndpoint,
  computeRecommendedCommitT,
  computeNoReturnDeadlineT,
  selectSideForDynamicConflict,
  predictOpponentX,
  rawFootprintOverlap,
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

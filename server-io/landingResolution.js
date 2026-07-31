/**
 * Aerial landing resolution — Phase A (rope jump only).
 *
 * Pure helpers for pushbox-matching separation and deterministic landing
 * endpoint selection. Live rope-jump integration is gated by
 * ROPE_JUMP_LANDING_V2 (see landingFlags.js).
 *
 * Contract: never teleport on the touchdown frame as the primary fix.
 * Commit a valid endpoint before ground contact, then travel continuously.
 */

const {
  HITBOX_DISTANCE_VALUE,
  GROUND_LEVEL,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_ARC_HEIGHT,
  ROPE_JUMP_LANDING_COMMIT_T,
} = require("./constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");
const { ROPE_JUMP_LANDING_V2, LANDING_TRACE } = require("./landingFlags");

/** Centers within this world-px band are treated as ambiguous for side intent. */
const SIDE_AMBIGUITY_EPSILON_PX = 1;
/**
 * Tiny pad past exact min-separation so float rounding cannot re-enter the
 * pushbox on the touchdown frame (e.g. 110.49999999999994 < 110.5).
 */
const LANDING_SEPARATION_PAD_PX = 0.01;

/**
 * Symmetric pushbox half-width. Must match calculateEffectiveHitboxSize().
 * @param {number} [sizeMultiplier=1]
 * @returns {number} world px
 */
function getPushboxHalfWidth(sizeMultiplier) {
  return HITBOX_DISTANCE_VALUE * (sizeMultiplier || 1);
}

/**
 * Minimum legal center-to-center distance for two grounded pushboxes.
 * @param {number} jumperSizeMult
 * @param {number} opponentSizeMult
 * @returns {number} world px
 */
function getMinimumCenterDistance(jumperSizeMult, opponentSizeMult) {
  return getPushboxHalfWidth(jumperSizeMult) + getPushboxHalfWidth(opponentSizeMult);
}

/** Cosine ease-in-out used by the rope-jump horizontal arc (matches index.js). */
function ropeJumpEase(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));
}

function clampToMap(x, mapLeft, mapRight) {
  if (!Number.isFinite(x)) return mapLeft;
  return Math.max(mapLeft, Math.min(x, mapRight));
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
 *
 * Cross-up (raw arc crosses opponent): prefer the jump-direction / centerward side.
 * Conflict without cross (land short into footprint): prefer the near/start side.
 * No conflict: side of raw target (informational only).
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
    // Escape toward center: jumpDir +1 (from left rope) → land on opponent's right.
    // Raw dead-center on the opponent also uses jump intent (not "near side").
    return jumpDirection >= 0 ? 1 : -1;
  }

  if (rawOverlap > 0) {
    // Landing short into the body — stay on the approach side.
    if (Math.abs(jumperStartX - opponentX) < SIDE_AMBIGUITY_EPSILON_PX) {
      return jumpDirection >= 0 ? 1 : -1;
    }
    return jumperStartX < opponentX ? -1 : 1;
  }

  // Clear raw target — side is whatever the raw point implies.
  if (rawOnCenter) {
    return jumpDirection >= 0 ? 1 : -1;
  }
  return rawTargetX < opponentX ? -1 : 1;
}

function sideEndpoint(opponentX, side, minimumDistance) {
  return opponentX + side * (minimumDistance + LANDING_SEPARATION_PAD_PX);
}

/**
 * Deterministic landing endpoint solver.
 * Does not move the defender. Never returns NaN / Infinity / out-of-map X.
 *
 * @returns {object} decision record
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
  const jHalf = Number.isFinite(jumperHalfWidth) ? Math.max(0, jumperHalfWidth) : getPushboxHalfWidth(1);
  const oHalf = Number.isFinite(opponentHalfWidth) ? Math.max(0, opponentHalfWidth) : getPushboxHalfWidth(1);
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

  // No conflict — keep the intentional raw destination.
  if (rawOverlap <= 0) {
    return {
      ...base,
      resolvedTargetX: safeRaw,
      resolvedSide: safeRaw < safeOpp ? -1 : safeRaw > safeOpp ? 1 : preferredSide,
      boundaryLimited: false,
      usedFallback: false,
      fallbackReason: null,
    };
  }

  const trySide = (side) => {
    const ideal = sideEndpoint(safeOpp, side, minimumDistance);
    const clamped = clampToMap(ideal, mapLeft, mapRight);
    const boundaryLimited = clamped !== ideal;
    const overlapAfter = Math.max(0, minimumDistance - Math.abs(clamped - safeOpp));
    return { side, ideal, clamped, boundaryLimited, overlapAfter };
  };

  const preferred = trySide(preferredSide);
  if (preferred.overlapAfter <= 0) {
    return {
      ...base,
      resolvedTargetX: preferred.clamped,
      resolvedSide: preferredSide,
      boundaryLimited: preferred.boundaryLimited,
      usedFallback: preferred.boundaryLimited,
      fallbackReason: preferred.boundaryLimited ? "preferred_side_clamped" : null,
    };
  }

  // Preferred side impossible (usually ring edge) — try the other side.
  const alternateSide = /** @type {1|-1} */ (-preferredSide);
  const alternate = trySide(alternateSide);
  if (alternate.overlapAfter <= 0) {
    return {
      ...base,
      resolvedTargetX: alternate.clamped,
      resolvedSide: alternateSide,
      boundaryLimited: true,
      usedFallback: true,
      fallbackReason: "preferred_side_impossible_alternate_ok",
    };
  }

  // Both sides constrained — pick the clamp with less residual overlap.
  // Tie → preferred side (deterministic, ignores player iteration order).
  const pick =
    alternate.overlapAfter < preferred.overlapAfter ? alternate : preferred;

  return {
    ...base,
    resolvedTargetX: pick.clamped,
    resolvedSide: pick.side,
    boundaryLimited: true,
    usedFallback: true,
    fallbackReason: "both_sides_constrained",
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
  player._landingTrace = null;
}

/**
 * Initialize landing fields at rope-jump start.
 * rawTargetX should already be map-clamped.
 */
function initRopeJumpLandingState(player, rawTargetX, useV2 = ROPE_JUMP_LANDING_V2) {
  clearRopeJumpLandingState(player);
  player.ropeJumpRawTargetX = rawTargetX;
  player.ropeJumpLandingPath = useV2 ? "v2" : "legacy";
  if (LANDING_TRACE) {
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
  };
  // One structured line — not a per-tick flood.
  console.log("[LANDING_TRACE]", JSON.stringify(record));
  player._landingTrace = null;
  return record;
}

/**
 * Authoritative active-phase step for rope jump.
 * When useV2 is false, reproduces the legacy fixed-target arc.
 *
 * Position-continuous at the commit point: horizontal motion rebases from
 * commitX → resolvedTargetX over the remaining ease span.
 *
 * @returns {{ touchedDown: boolean, committedThisTick: boolean, decision: object|null }}
 */
function stepRopeJumpActive(player, opponent, now, options = {}) {
  const activeMs = options.activeMs != null ? options.activeMs : ROPE_JUMP_ACTIVE_MS;
  const commitTNominal =
    options.commitT != null ? options.commitT : ROPE_JUMP_LANDING_COMMIT_T;
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

  // Pre-commit (and legacy): travel toward the raw / predetermined target.
  let xAlongRaw = startX + (rawTargetX - startX) * easedT;

  if (useV2 && !player.ropeJumpLandingCommitted && t >= commitTNominal && opponent) {
    decision = resolveLandingTarget({
      rawTargetX,
      jumperStartX: startX,
      jumperCurrentX: xAlongRaw,
      jumpDirection: player.ropeJumpDirection,
      opponentX: opponent.x,
      jumperHalfWidth: getPushboxHalfWidth(player.sizeMultiplier),
      opponentHalfWidth: getPushboxHalfWidth(opponent.sizeMultiplier),
      mapLeft,
      mapRight,
    });

    player.ropeJumpLandingCommitted = true;
    player.ropeJumpLandingCommitT = t;
    player.ropeJumpLandingCommitX = xAlongRaw;
    player.ropeJumpResolvedTargetX = decision.resolvedTargetX;
    player.ropeJumpTargetX = decision.resolvedTargetX;
    player.ropeJumpLandingDecision = decision;
    player.ropeJumpPreferredSide = decision.preferredSide;
    player.ropeJumpResolvedSide = decision.resolvedSide;
    player.ropeJumpUsedFallback = !!decision.usedFallback;
    player.ropeJumpMinDistance = decision.minimumDistance;
    committedThisTick = true;
  }

  let x;
  if (useV2 && player.ropeJumpLandingCommitted) {
    const easedCommit = ropeJumpEase(player.ropeJumpLandingCommitT);
    const denom = 1 - easedCommit;
    const u = denom <= 1e-9 ? 1 : Math.max(0, Math.min(1, (easedT - easedCommit) / denom));
    x =
      player.ropeJumpLandingCommitX +
      (player.ropeJumpResolvedTargetX - player.ropeJumpLandingCommitX) * u;
  } else {
    x = xAlongRaw;
  }

  player.x = clampToMap(x, mapLeft, mapRight);
  player.y = groundLevel + arcHeight * 4 * t * (1 - t);

  if (opponent) {
    const minDist = getMinimumCenterDistance(
      player.sizeMultiplier,
      opponent.sizeMultiplier
    );
    player.ropeJumpMinDistance = minDist;
    player.ropeJumpCenterDistance = Math.abs(player.x - opponent.x);
    player.ropeJumpOverlap = Math.max(0, minDist - player.ropeJumpCenterDistance);
  }

  if (LANDING_TRACE && player._landingTrace && (committedThisTick || t >= 1 || player._landingTrace.samples.length === 0)) {
    appendLandingTraceSample(player, {
      t: Number(t.toFixed(4)),
      x: player.x,
      y: player.y,
      committed: !!player.ropeJumpLandingCommitted,
      opponentX: opponent ? opponent.x : null,
      overlap: player.ropeJumpOverlap,
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
    player.x = clampToMap(landX, mapLeft, mapRight);
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

    return { touchedDown: true, committedThisTick, decision: player.ropeJumpLandingDecision };
  }

  return { touchedDown: false, committedThisTick, decision };
}

function isRopeJumpLandingV2Enabled() {
  return ROPE_JUMP_LANDING_V2 === true;
}

module.exports = {
  SIDE_AMBIGUITY_EPSILON_PX,
  LANDING_SEPARATION_PAD_PX,
  getPushboxHalfWidth,
  getMinimumCenterDistance,
  ropeJumpEase,
  didRawPathCrossOpponent,
  choosePreferredLandingSide,
  resolveLandingTarget,
  clearRopeJumpLandingState,
  initRopeJumpLandingState,
  stepRopeJumpActive,
  finalizeLandingTrace,
  appendLandingTraceSample,
  isRopeJumpLandingV2Enabled,
  clampToMap,
};

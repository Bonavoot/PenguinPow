"use strict";

/**
 * Phase 13A — Charged headbutt physical first-contact vs slap.
 *
 * Behind COMBAT_CONTACT_FIDELITY_V2 (default OFF). Does not retune charge
 * speed/distance/damage/KB. Replaces CHARGE_PRIORITY_THRESHOLD arbitration for
 * this pair only (palm excluded — rooted thrust keeps legacy threshold path).
 *
 * See CHARGED_HEADBUTT_CONTACT_PHASE.md
 */

const {
  STRIKE_SKIN_EMBED_PX,
  SLAP_STARTUP_MS,
  CHARGED_STARTUP_MS,
  SLAP_TRADE_WINDOW_MS,
} = require("./constants");
const {
  isCombatContactFidelityV2Enabled,
} = require("./combatContactFidelityFlags");
const {
  getStrikeTipWorld,
  getVictimBodyHalf,
  getAttackDir,
  CONTACT_SNAP_EPSILON,
} = require("./strikeContact");
const {
  consumeLosingAttackInstance,
  noteWinnerContactResolution,
  mintInteractionId,
  CONTACT_OUTCOME,
  SETTLE_POLICY,
} = require("./combatContactResolution");

/** Fraction of a tick within which two contacts count as simultaneous. */
const SAME_CONTACT_EPSILON = 0.05;

/**
 * Front-body hurt depth as a fraction of head-attack depth.
 * Must stay < 1 so the forehead leads the vulnerable frontal body — a frontal
 * slap cannot "tunnel" the head to tag body at the same root spacing.
 */
const FRONT_BODY_DEPTH_FRAC = 0.58;

/** Max root correction (px) when already overlapped — never a large teleport. */
const MAX_CONTACT_CORRECTION_PX = 14;

/** Authored surface ids (registry — not scattered magic offsets). */
const SURFACE = Object.freeze({
  HEAD_ATTACK_FRONT: "HEAD_ATTACK_FRONT",
  FRONT_BODY_HURT: "FRONT_BODY_HURT",
  BODY_HURT: "BODY_HURT",
  REAR_BODY_HURT: "REAR_BODY_HURT",
  SLAP_TIP: "SLAP_TIP",
  SLAP_BODY_HURT: "SLAP_BODY_HURT",
});

const OUTCOME = Object.freeze({
  SLAP_WIN: "SLAP_WIN",
  CHARGED_WIN: "CHARGED_WIN",
  TRADE: "TRADE",
  NONE: "NONE",
});

/** Last-resolution diagnostics (dev / tests). One slot — not a growing buffer. */
let _lastSlapChargedResolution = null;

function getChargedHeadDepth(charged) {
  return getStrikeTipWorld("charged", charged);
}

function getFrontBodyHurtDepth(charged) {
  return getChargedHeadDepth(charged) * FRONT_BODY_DEPTH_FRAC;
}

function getBodyHurtHalf(player) {
  return getVictimBodyHalf(player);
}

function getSlapTipDepth(slapper) {
  return getStrikeTipWorld("slap", slapper);
}

function getActiveStartTime(player, kind) {
  if (!player || !player.attackStartTime) return 0;
  if (player.startupEndTime) return player.startupEndTime;
  const startup = kind === "charged" ? CHARGED_STARTUP_MS : SLAP_STARTUP_MS;
  return player.attackStartTime + startup;
}

function isChargedHeadbuttActive(player) {
  return !!(
    player &&
    player.isAttacking &&
    player.attackType === "charged" &&
    !player.isPalmThrust &&
    !player.isInStartupFrames
  );
}

function isSlapStrikeActive(player) {
  return !!(
    player &&
    player.isAttacking &&
    player.attackType === "slap" &&
    !player.isInStartupFrames
  );
}

/** True when `other` stands in the frontal hemisphere of `charged`. */
function isFrontalToCharged(charged, other) {
  const dir = getAttackDir(charged);
  return (other.x - charged.x) * dir >= 0;
}

/**
 * Root-distance reach for a surface pair (facing each other on a line).
 * slap→front-body and charged-head→slap-body use different hurt depths.
 */
function frontalReachSlapToChargedBody(slapper, charged) {
  return (
    getSlapTipDepth(slapper) +
    getFrontBodyHurtDepth(charged) -
    STRIKE_SKIN_EMBED_PX
  );
}

function frontalReachChargedHeadToSlapBody(charged, slapper) {
  return (
    getChargedHeadDepth(charged) +
    getBodyHurtHalf(slapper) -
    STRIKE_SKIN_EMBED_PX
  );
}

function rearReachSlapToChargedBody(slapper, charged) {
  return (
    getSlapTipDepth(slapper) +
    getBodyHurtHalf(charged) -
    STRIKE_SKIN_EMBED_PX
  );
}

/**
 * Earliest t∈[0,1] where |dist(t)| reaches `reach` while closing (or already in).
 * dist is absolute root separation. Returns null if no contact this step.
 */
function earliestContactFraction(dist0, dist1, reach) {
  const r = reach + CONTACT_SNAP_EPSILON;
  if (!(r > 0)) return null;
  if (dist0 <= r) return 0;
  if (dist1 > r) return null;
  const denom = dist1 - dist0;
  if (Math.abs(denom) < 1e-9) return dist0 <= r ? 0 : null;
  const t = (r - dist0) / denom;
  if (t < 0 || t > 1) return null;
  return t;
}

function surfaceX(rootX, facing, depth) {
  const dir = facing === 1 ? -1 : 1;
  return rootX + dir * depth;
}

/**
 * Evaluate slap-versus-flying-headbutt for one simulation step.
 * Positions: previous roots → proposed roots (after pending charged step).
 * Order-independent: both candidates computed before committing.
 */
function evaluateSlapVersusChargedContact({
  slapper,
  charged,
  slapPrevX,
  slapCurrX,
  chargedPrevX,
  chargedCurrX,
}) {
  const empty = {
    outcome: OUTCOME.NONE,
    tSlap: null,
    tCharged: null,
    tSelected: null,
    contactX: null,
    contactNormal: null,
    slapSurface: null,
    chargedSurface: null,
    approach: isFrontalToCharged(charged, slapper) ? "frontal" : "rear",
    pointBlank: false,
    epsilon: SAME_CONTACT_EPSILON,
    fallbackReason: null,
    preOverlap: null,
    correction: 0,
  };

  if (!isSlapStrikeActive(slapper) || !isChargedHeadbuttActive(charged)) {
    return { ...empty, fallbackReason: "NOT_BOTH_ACTIVE" };
  }

  const frontal = isFrontalToCharged(charged, slapper);
  const dist0 = Math.abs(slapPrevX - chargedPrevX);
  const dist1 = Math.abs(slapCurrX - chargedCurrX);
  const preOverlap = Math.max(
    0,
    getBodyHurtHalf(slapper) + getBodyHurtHalf(charged) - dist0
  );

  let tSlap = null;
  let tCharged = null;
  let slapSurface = SURFACE.SLAP_TIP;
  let chargedHurtSurface = frontal
    ? SURFACE.FRONT_BODY_HURT
    : SURFACE.REAR_BODY_HURT;

  if (frontal) {
    tSlap = earliestContactFraction(
      dist0,
      dist1,
      frontalReachSlapToChargedBody(slapper, charged)
    );
    tCharged = earliestContactFraction(
      dist0,
      dist1,
      frontalReachChargedHeadToSlapBody(charged, slapper)
    );
  } else {
    // Rear / non-frontal: head attack cannot threaten; slap tags full body.
    tSlap = earliestContactFraction(
      dist0,
      dist1,
      rearReachSlapToChargedBody(slapper, charged)
    );
    tCharged = null;
  }

  const slapActiveAt = getActiveStartTime(slapper, "slap");
  const chargedActiveAt = getActiveStartTime(charged, "charged");

  // Point-blank / already-touching: both candidates at t=0 (or deep pre-overlap).
  const bothAtZero =
    tSlap === 0 && (tCharged === 0 || (!frontal && tSlap === 0 && tCharged == null));
  const alreadyTouching =
    dist0 <=
    Math.min(
      frontal
        ? frontalReachChargedHeadToSlapBody(charged, slapper)
        : rearReachSlapToChargedBody(slapper, charged),
      frontal
        ? frontalReachSlapToChargedBody(slapper, charged)
        : rearReachSlapToChargedBody(slapper, charged)
    ) +
      CONTACT_SNAP_EPSILON;

  let outcome = OUTCOME.NONE;
  let tSelected = null;
  let fallbackReason = null;
  let pointBlank = false;

  if (frontal && alreadyTouching && (bothAtZero || (tSlap != null && tCharged != null))) {
    pointBlank = true;
    // Action-timing order — never collision-loop / player-id order.
    const activeDiff = slapActiveAt - chargedActiveAt;
    if (Math.abs(activeDiff) <= SLAP_TRADE_WINDOW_MS) {
      outcome = OUTCOME.TRADE;
      tSelected = 0;
      fallbackReason = "POINT_BLANK_SAME_ACTIVE";
    } else if (activeDiff < 0) {
      outcome = OUTCOME.SLAP_WIN;
      tSelected = 0;
      fallbackReason = "POINT_BLANK_SLAP_ACTIVE_FIRST";
    } else {
      outcome = OUTCOME.CHARGED_WIN;
      tSelected = 0;
      fallbackReason = "POINT_BLANK_CHARGED_ACTIVE_FIRST";
    }
  } else if (!frontal && tSlap != null) {
    outcome = OUTCOME.SLAP_WIN;
    tSelected = tSlap;
  } else if (tSlap == null && tCharged == null) {
    return { ...empty, preOverlap, fallbackReason: "NO_CONTACT_THIS_STEP" };
  } else if (tSlap != null && tCharged == null) {
    outcome = OUTCOME.SLAP_WIN;
    tSelected = tSlap;
  } else if (tCharged != null && tSlap == null) {
    outcome = OUTCOME.CHARGED_WIN;
    tSelected = tCharged;
  } else if (Math.abs(tSlap - tCharged) <= SAME_CONTACT_EPSILON) {
    outcome = OUTCOME.TRADE;
    tSelected = Math.min(tSlap, tCharged);
  } else if (tSlap < tCharged) {
    outcome = OUTCOME.SLAP_WIN;
    tSelected = tSlap;
  } else {
    outcome = OUTCOME.CHARGED_WIN;
    tSelected = tCharged;
  }

  // Contact point from winning / shared surfaces at tSelected.
  const t = tSelected != null ? tSelected : 0;
  const slapX = slapPrevX + (slapCurrX - slapPrevX) * t;
  const chargedX = chargedPrevX + (chargedCurrX - chargedPrevX) * t;
  const chargedDir = getAttackDir(charged);
  const slapDir = getAttackDir(slapper);

  let contactX;
  if (outcome === OUTCOME.CHARGED_WIN) {
    contactX = surfaceX(chargedX, charged.facing, getChargedHeadDepth(charged));
    slapSurface = SURFACE.SLAP_BODY_HURT;
    chargedHurtSurface = SURFACE.HEAD_ATTACK_FRONT;
  } else if (outcome === OUTCOME.SLAP_WIN) {
    contactX = surfaceX(slapX, slapper.facing, getSlapTipDepth(slapper));
  } else {
    // Trade — midpoint of the two attack surfaces at contact time.
    const headX = surfaceX(chargedX, charged.facing, getChargedHeadDepth(charged));
    const tipX = surfaceX(slapX, slapper.facing, getSlapTipDepth(slapper));
    contactX = (headX + tipX) * 0.5;
  }

  const contactNormal = chargedX === slapX
    ? chargedDir
    : slapX < chargedX
      ? 1
      : -1;

  return {
    outcome,
    tSlap,
    tCharged,
    tSelected,
    contactX,
    contactNormal,
    slapSurface,
    chargedSurface: chargedHurtSurface,
    approach: frontal ? "frontal" : "rear",
    pointBlank,
    epsilon: SAME_CONTACT_EPSILON,
    fallbackReason,
    preOverlap,
    correction: 0,
    slapActiveAt,
    chargedActiveAt,
    dist0,
    dist1,
    slapXAtContact: slapX,
    chargedXAtContact: chargedX,
    slapDir,
    chargedDir,
  };
}

function recordSlapChargedDiagnostics(extra) {
  _lastSlapChargedResolution = {
    v2: isCombatContactFidelityV2Enabled(),
    recordedAt: Date.now(),
    ...extra,
  };
  return _lastSlapChargedResolution;
}

function getLastSlapChargedResolution() {
  return _lastSlapChargedResolution;
}

function clearLastSlapChargedResolution() {
  _lastSlapChargedResolution = null;
}

/**
 * Advance charged (and optionally slap) roots to the contact fraction.
 * Bounded correction — never a large teleport.
 */
function commitContactPositions(slapper, charged, evaluation) {
  if (!evaluation || evaluation.tSelected == null) return 0;
  const t = evaluation.tSelected;
  const targetSlap = evaluation.slapXAtContact;
  const targetCharged = evaluation.chargedXAtContact;
  let correction = 0;

  if (typeof targetCharged === "number") {
    const dx = targetCharged - charged.x;
    const capped = Math.max(-MAX_CONTACT_CORRECTION_PX, Math.min(MAX_CONTACT_CORRECTION_PX, dx));
    // When t is mid-step, preferred path is move TO contact (may exceed cap if
    // the pending step itself is large). Cap only the *extra* snap from overlap.
    if (evaluation.pointBlank || evaluation.preOverlap > 0) {
      charged.x = charged.x + capped;
      correction = Math.max(correction, Math.abs(capped));
    } else if (t < 1) {
      charged.x = targetCharged;
      correction = Math.max(correction, Math.abs(dx));
    }
  }

  // Slap is not a lunge — only nudge on point-blank overlap, bounded.
  if (
    evaluation.pointBlank &&
    typeof targetSlap === "number" &&
    Math.abs(slapper.x - targetSlap) > CONTACT_SNAP_EPSILON
  ) {
    const dx = targetSlap - slapper.x;
    const capped = Math.max(
      -MAX_CONTACT_CORRECTION_PX,
      Math.min(MAX_CONTACT_CORRECTION_PX, dx)
    );
    slapper.x += capped;
    correction = Math.max(correction, Math.abs(capped));
  }

  evaluation.correction = correction;
  return correction;
}

/**
 * Pair-level latch so P1-first / P2-first checkCollision cannot double-resolve.
 */
function pairAlreadyResolved(slapper, charged, simTime) {
  const key = [slapper.id, charged.id].sort().join("|");
  return (
    slapper._slapChargedPairKey === key &&
    slapper._slapChargedPairTick === simTime
  );
}

function markPairResolved(slapper, charged, simTime) {
  const key = [slapper.id, charged.id].sort().join("|");
  slapper._slapChargedPairKey = key;
  slapper._slapChargedPairTick = simTime;
  charged._slapChargedPairKey = key;
  charged._slapChargedPairTick = simTime;
}

/**
 * Apply physical slap-vs-charged outcome. Returns true if handled (caller
 * must not fall through to legacy threshold logic).
 *
 * `processHit` / `resolveSlapChargedTrade` injected to avoid circular requires.
 */
function resolveSlapVersusChargedPhysical(
  slapper,
  charged,
  rooms,
  io,
  {
    slapPrevX,
    slapCurrX,
    chargedPrevX,
    chargedCurrX,
    processHit,
    resolveSlapChargedTrade,
    simTime,
  }
) {
  if (!isCombatContactFidelityV2Enabled()) return false;
  if (!isSlapStrikeActive(slapper) || !isChargedHeadbuttActive(charged)) {
    return false;
  }
  if (charged.isPalmThrust) return false;
  if (pairAlreadyResolved(slapper, charged, simTime)) return true;

  const evaluation = evaluateSlapVersusChargedContact({
    slapper,
    charged,
    slapPrevX: slapPrevX != null ? slapPrevX : slapper.x,
    slapCurrX: slapCurrX != null ? slapCurrX : slapper.x,
    chargedPrevX: chargedPrevX != null ? chargedPrevX : charged.x,
    chargedCurrX: chargedCurrX != null ? chargedCurrX : charged.x,
  });

  if (evaluation.outcome === OUTCOME.NONE) {
    recordSlapChargedDiagnostics({
      outcome: OUTCOME.NONE,
      slapperId: slapper.id,
      chargedId: charged.id,
      ...evaluation,
    });
    return false;
  }

  commitContactPositions(slapper, charged, evaluation);
  markPairResolved(slapper, charged, simTime);

  const interactionId = mintInteractionId("sc");
  const postDist = Math.abs(slapper.x - charged.x);
  const postOverlap = Math.max(
    0,
    getBodyHurtHalf(slapper) + getBodyHurtHalf(charged) - postDist
  );

  const diagBase = {
    interactionId,
    slapperId: slapper.id,
    chargedId: charged.id,
    slapInstance: slapper._combatContactActionInstanceId || null,
    chargedInstance: charged._combatContactActionInstanceId || null,
    slapPhase: slapper.isInStartupFrames ? "startup" : "active",
    chargedPhase: charged.isInStartupFrames ? "startup" : "active",
    slapActiveAt: evaluation.slapActiveAt,
    chargedActiveAt: evaluation.chargedActiveAt,
    prevRoots: {
      slap: slapPrevX != null ? slapPrevX : slapper.x,
      charged: chargedPrevX != null ? chargedPrevX : charged.x,
    },
    currRoots: { slap: slapper.x, charged: charged.x },
    tSlap: evaluation.tSlap,
    tCharged: evaluation.tCharged,
    tSelected: evaluation.tSelected,
    outcome: evaluation.outcome,
    epsilon: SAME_CONTACT_EPSILON,
    contactX: evaluation.contactX,
    contactNormal: evaluation.contactNormal,
    preOverlap: evaluation.preOverlap,
    postOverlap,
    correction: evaluation.correction,
    fallbackReason: evaluation.fallbackReason,
    approach: evaluation.approach,
    pointBlank: evaluation.pointBlank,
    losingPoseSurvivalTicks: 0,
    residualChargedVelocity: null,
  };

  if (evaluation.outcome === OUTCOME.TRADE) {
    resolveSlapChargedTrade(slapper, charged, rooms, io, {
      interactionId,
      contactX: evaluation.contactX,
    });
    diagBase.residualChargedVelocity = charged.movementVelocity || 0;
    recordSlapChargedDiagnostics(diagBase);
    return true;
  }

  if (evaluation.outcome === OUTCOME.SLAP_WIN) {
    // processHit first so counter/punish still observe the live charged attack.
    processHit(slapper, charged, rooms, io);
    consumeLosingAttackInstance(charged, {
      winner: slapper,
      winnerMove: "slap",
      loserMove: "charged",
      outcome: CONTACT_OUTCOME.PRIORITY_LOSS,
      interactionType: "SLAP_VS_CHARGED",
      interruptionReason: evaluation.pointBlank
        ? "POINT_BLANK_SLAP_FIRST"
        : evaluation.approach === "rear"
          ? "SLAP_REAR_BODY"
          : "SLAP_BODY_FIRST",
      strikeKind: "slap",
      winnerIsAttacker: true,
      interactionId,
      contactPoint: evaluation.contactX,
      contactNormal: evaluation.contactNormal,
      winnerSurface: SURFACE.SLAP_TIP,
      loserSurface: evaluation.chargedSurface,
      settlePolicy: SETTLE_POLICY.BOUNDED_CONTACT,
    });
    // Belt-and-suspenders: no residual lunge after slap win.
    if (!charged.isHit) {
      /* processHit should have applied hitstun */
    }
    charged.movementVelocity = 0;
    diagBase.residualChargedVelocity = charged.movementVelocity || 0;
    diagBase.losingPoseSurvivalTicks = charged.isAttacking ? 1 : 0;
    noteWinnerContactResolution(slapper, charged, {
      winnerMove: "slap",
      loserMove: "charged",
      strikeKind: "slap",
      interactionType: "SLAP_VS_CHARGED",
      interactionId,
      contactPoint: evaluation.contactX,
      winnerSurface: SURFACE.SLAP_TIP,
      loserSurface: evaluation.chargedSurface,
    });
    recordSlapChargedDiagnostics(diagBase);
    return true;
  }

  // CHARGED_WIN — processHit first so slap is still live for read classification
  // on the charged side; then consume the losing slap instance.
  processHit(charged, slapper, rooms, io);
  consumeLosingAttackInstance(slapper, {
    winner: charged,
    winnerMove: "charged",
    loserMove: "slap",
    outcome: CONTACT_OUTCOME.PRIORITY_LOSS,
    interactionType: "SLAP_VS_CHARGED",
    interruptionReason: evaluation.pointBlank
      ? "POINT_BLANK_CHARGED_FIRST"
      : "CHARGED_HEAD_FIRST",
    strikeKind: "charged",
    winnerIsAttacker: true,
    interactionId,
    contactPoint: evaluation.contactX,
    contactNormal: evaluation.contactNormal,
    winnerSurface: SURFACE.HEAD_ATTACK_FRONT,
    loserSurface: SURFACE.SLAP_BODY_HURT,
    settlePolicy: SETTLE_POLICY.BOUNDED_CONTACT,
  });
  noteWinnerContactResolution(charged, slapper, {
    winnerMove: "charged",
    loserMove: "slap",
    strikeKind: "charged",
    interactionType: "SLAP_VS_CHARGED",
    interactionId,
    contactPoint: evaluation.contactX,
    winnerSurface: SURFACE.HEAD_ATTACK_FRONT,
    loserSurface: SURFACE.SLAP_BODY_HURT,
  });
  diagBase.losingPoseSurvivalTicks = slapper.isAttacking ? 1 : 0;
  diagBase.residualChargedVelocity = charged.movementVelocity || 0;
  recordSlapChargedDiagnostics(diagBase);
  return true;
}

/**
 * Proposed charged lunge Δx for this tick (mirrors index.js formula, no side effects).
 */
function proposedChargedLungeDelta(charged, delta, speedFactor) {
  if (!isChargedHeadbuttActive(charged) && !(
    charged &&
    charged.isAttacking &&
    charged.attackType === "charged" &&
    !charged.isPalmThrust &&
    !charged.chargedAttackHit
  )) {
    return 0;
  }
  if (charged.chargedAttackHit || charged.isPalmThrust || charged.isAtTheRopes) {
    return 0;
  }
  const attackDirection = getAttackDir(charged);
  const chargePower = charged.chargeAttackPower || 0;
  const lungeSpeed = 1.5 + (chargePower / 100) * 5.5;
  return attackDirection * delta * speedFactor * lungeSpeed;
}

/**
 * During charged lunge integration: if a live slap is present, resolve earliest
 * contact before committing the full step. Returns true if contact resolved.
 */
function tryResolveChargedLungeAgainstSlap(
  charged,
  opponent,
  rooms,
  io,
  {
    delta,
    speedFactor,
    proposedX,
    processHit,
    resolveSlapChargedTrade,
    simTime,
  }
) {
  if (!isCombatContactFidelityV2Enabled()) return false;
  if (!opponent || !isSlapStrikeActive(opponent)) return false;
  if (!charged || charged.isPalmThrust || charged.chargedAttackHit) return false;
  if (
    !(
      charged.isAttacking &&
      charged.attackType === "charged" &&
      !charged.isInStartupFrames
    )
  ) {
    return false;
  }

  const chargedPrevX = charged.x;
  const chargedCurrX = proposedX;
  const slapPrevX =
    opponent._combatPrevX != null ? opponent._combatPrevX : opponent.x;
  const slapCurrX = opponent.x;

  return resolveSlapVersusChargedPhysical(opponent, charged, rooms, io, {
    slapPrevX,
    slapCurrX,
    chargedPrevX,
    chargedCurrX,
    processHit,
    resolveSlapChargedTrade,
    simTime,
  });
}

function snapshotChargedHeadSurfaces(charged, slapper) {
  return {
    headAttackFront: getChargedHeadDepth(charged),
    frontBodyHurt: getFrontBodyHurtDepth(charged),
    bodyHurtHalf: getBodyHurtHalf(charged),
    slapTip: slapper ? getSlapTipDepth(slapper) : null,
    slapBodyHalf: slapper ? getBodyHurtHalf(slapper) : null,
    frontalReachSlap: slapper
      ? frontalReachSlapToChargedBody(slapper, charged)
      : null,
    frontalReachCharged: slapper
      ? frontalReachChargedHeadToSlapBody(charged, slapper)
      : null,
  };
}

module.exports = {
  SURFACE,
  OUTCOME,
  SAME_CONTACT_EPSILON,
  FRONT_BODY_DEPTH_FRAC,
  MAX_CONTACT_CORRECTION_PX,
  getChargedHeadDepth,
  getFrontBodyHurtDepth,
  getBodyHurtHalf,
  getSlapTipDepth,
  getActiveStartTime,
  isChargedHeadbuttActive,
  isSlapStrikeActive,
  isFrontalToCharged,
  frontalReachSlapToChargedBody,
  frontalReachChargedHeadToSlapBody,
  rearReachSlapToChargedBody,
  earliestContactFraction,
  evaluateSlapVersusChargedContact,
  resolveSlapVersusChargedPhysical,
  tryResolveChargedLungeAgainstSlap,
  proposedChargedLungeDelta,
  commitContactPositions,
  getLastSlapChargedResolution,
  clearLastSlapChargedResolution,
  recordSlapChargedDiagnostics,
  snapshotChargedHeadSurfaces,
};

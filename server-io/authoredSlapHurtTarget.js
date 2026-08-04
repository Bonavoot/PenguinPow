"use strict";

/**
 * Phase 4A — authored slap HURT_LIMB as an extra victim target surface.
 *
 * Consumes shared/combatVolumeAuthored.json via combatVolumeDefs (no second table).
 * Does NOT replace strikeContact tip-meets-body. Does NOT author hits from client
 * debug latches, renderX/Y, or pose-director hints.
 *
 * BOTH sides of the limb query are authored geometry:
 *   attacker → the canonical HIT rail of its real authoritative pose
 *              (slap_active / palm_active / charged_active)
 *   victim   → the exposed pose's HURT_LIMB, variant-resolved from slapAnimation
 * Neither is size-scaled: rendered sprite width is fixed, so reach is fixed.
 *
 * Exposure: slap_active + slap_recovery only (startup limb is authored but not
 * Phase 4A-authoritative until separately approved).
 *
 * Winning-contact policy when body + limb both eligible:
 *   1. Prefer earliest physical contact along attacker forward (smaller |tip→contact|).
 *   2. Tie → HURT_BODY over HURT_LIMB.
 *   3. Tie → lexicographic region label.
 * Edge policy: combatGeometry TOUCHING_COUNTS (inclusive).
 */

const {
  isAuthoredSlapHurtboxV1Enabled,
} = require("./authoredSlapHurtboxFlags");
const {
  COMBAT_PHASE,
  COMBAT_VOLUME_KIND,
} = require("./combatVolumeVocabulary");
const {
  resolveMirrorFacing,
  inferAuthoredPhase,
  getPoseDefinition,
  resolvePoseVariantKey,
  materializeLocalRegions,
  SUPPORT,
} = require("./combatVolumeDefs");
const {
  localRectToWorldAabb,
  aabbsOverlap,
  aabbContactApprox,
  EDGE_POLICY,
} = require("./combatGeometry");
const {
  SLAP_STARTUP_MS,
  AP_LATE_PARRY_MS,
  SLAP_GRACE_CONFIRM_SLACK_PX,
} = require("./constants");
const {
  getAttackDir,
  attackKindFromPlayer,
  getConnectDistance,
  isWithinConnectRange,
  getContactSeamX,
} = require("./strikeContact");

/**
 * Attack kind → authored pose whose canonical HIT region IS the limb probe.
 * There is no second probe table: the rail drawn in the authored catalog is the
 * rail queried at runtime.
 */
const ATTACKER_HIT_POSE = Object.freeze({
  slap: "slap_active",
  palm: "palm_active",
  palmThrust: "palm_active",
  charged: "charged_active",
});

/**
 * Server-side slap allowlist for Phase 4A authority.
 * Must stay in sync with shared/combatVolumeAuthored.json:
 *   meta.phase4aSlapAllowlist + poses.*.phase4aAuthority
 * slap_startup is intentionally excluded (limb authored for debug only).
 */
const EXPOSED_SLAP_POSES = Object.freeze({
  slap_active: true,
  slap_recovery: true,
});

function isPhase4aSlapPoseAuthorityReady(poseKey) {
  if (!poseKey || !EXPOSED_SLAP_POSES[poseKey]) return false;
  const poseDef = getPoseDefinition(poseKey);
  return !!(
    poseDef &&
    poseDef.support === SUPPORT.SUPPORTED &&
    poseDef.phase4aAuthority === true
  );
}

/**
 * Canonical: is this slap's offensive tip currently live?
 *
 * Active / recovery at slapActiveEndTime are mutually exclusive:
 *   now <  slapActiveEndTime  → tip may still be live (after startup)
 *   now >= slapActiveEndTime  → recovery has begun; tip is NOT live
 *
 * Exact equality belongs to recovery only. Do not use <= for tip liveness.
 */
function isSlapTipLive(player, now) {
  if (!player || !player.isAttacking || player.attackType !== "slap") {
    return false;
  }
  if (player.isInStartupFrames) return false;
  if (!player.slapActiveEndTime) return false;
  if (typeof now !== "number") return false;
  return now < player.slapActiveEndTime;
}

/** Last resolve result for debug/HUD/tests (DEV inspection; not networked by default). */
let _lastResolve = null;

/** Ring buffer of per-tick attack queries (flag ON only). Not networked. */
const QUERY_LOG_CAP = 64;
const _queryLog = [];
let _querySeq = 0;

/** Last committed limb/body contact from processHit stamp (tests/HUD helpers). */
let _lastCommitted = null;

function getLastAuthoredSlapHurtResolve() {
  return _lastResolve;
}

function clearLastAuthoredSlapHurtResolve() {
  _lastResolve = null;
}

function noteSlapHurtQuery(entry) {
  if (!isAuthoredSlapHurtboxV1Enabled(entry && entry.envValue)) return null;
  const row = {
    seq: ++_querySeq,
    simTime: entry.simTime != null ? entry.simTime : null,
    accepted: !!entry.accepted,
    rejectReason: entry.rejectReason || null,
    attackType: entry.attackType || null,
    attackerPhase: entry.attackerPhase || null,
    attackerId: entry.attackerId || null,
    victimId: entry.victimId || null,
    victimPhase: entry.victimPhase || null,
    victimPoseKey: entry.victimPoseKey || null,
    limbExposed: entry.limbExposed == null ? null : !!entry.limbExposed,
    tipX: entry.tipX != null ? entry.tipX : null,
    candidateRegion: entry.candidateRegion || null,
    overlap: entry.overlap == null ? null : !!entry.overlap,
    bodyEligible: entry.bodyEligible == null ? null : !!entry.bodyEligible,
    mirrorFacing: entry.mirrorFacing != null ? entry.mirrorFacing : null,
    interruptionSource: entry.interruptionSource || null,
    interruptionEventId: entry.interruptionEventId || null,
    slapVsSlapDecision: entry.slapVsSlapDecision || null,
    reciprocalContact: entry.reciprocalContact == null ? null : !!entry.reciprocalContact,
    winnerId: entry.winnerId || null,
    winnerRegion: entry.winnerRegion || null,
  };
  _queryLog.push(row);
  if (_queryLog.length > QUERY_LOG_CAP) _queryLog.shift();
  return row;
}

function getSlapHurtQueryLog() {
  return _queryLog.slice();
}

function clearSlapHurtQueryLog() {
  _queryLog.length = 0;
  _querySeq = 0;
}

function noteSlapHurtCommitted(entry) {
  _lastCommitted = {
    simTime: entry.simTime != null ? entry.simTime : null,
    region: entry.region || null,
    kind: entry.kind || null,
    victimPhase: entry.victimPhase || null,
    poseKey: entry.poseKey || null,
    variantKey: entry.variantKey != null ? entry.variantKey : null,
    limbOnly: entry.limbOnly == null ? null : !!entry.limbOnly,
    attackType: entry.attackType || null,
    isPunish: !!entry.isPunish,
    authoredSlapHurtboxV1: !!entry.authoredSlapHurtboxV1,
    consumption: entry.consumption || "consumed_once",
    parkPolicy: entry.parkPolicy || null,
    preParkAx: entry.preParkAx != null ? entry.preParkAx : null,
    preParkVx: entry.preParkVx != null ? entry.preParkVx : null,
    postParkAx: entry.postParkAx != null ? entry.postParkAx : null,
    postParkVx: entry.postParkVx != null ? entry.postParkVx : null,
    preParkDist: entry.preParkDist != null ? entry.preParkDist : null,
    postParkDist: entry.postParkDist != null ? entry.postParkDist : null,
    vfxContactX: entry.vfxContactX != null ? entry.vfxContactX : null,
  };
  return _lastCommitted;
}

function getLastSlapHurtCommitted() {
  return _lastCommitted;
}

function clearLastSlapHurtCommitted() {
  _lastCommitted = null;
}

function isSlapFamilyVictim(victim) {
  return !!(
    victim &&
    (victim.isSlapAttack ||
      (victim.isAttacking && victim.attackType === "slap") ||
      (victim.isRecovering && victim.currentAction === "slap"))
  );
}

/**
 * Authoritative slap limb exposure for Phase 4A.
 * @returns {{ exposed: boolean, poseKey: string|null, phase: string|null, reason: string }}
 */
function resolveSlapLimbExposure(victim, simTime) {
  if (!victim) {
    return { exposed: false, poseKey: null, phase: null, reason: "no_victim" };
  }
  if (!isSlapFamilyVictim(victim)) {
    return { exposed: false, poseKey: null, phase: null, reason: "not_slap_family" };
  }
  const phase = inferAuthoredPhase(victim, simTime);
  if (phase === COMBAT_PHASE.STARTUP) {
    return {
      exposed: false,
      poseKey: "slap_startup",
      phase,
      reason: "startup_not_phase4a_exposed",
    };
  }
  if (phase === COMBAT_PHASE.ACTIVE) {
    return {
      exposed: true,
      poseKey: "slap_active",
      phase,
      reason: "slap_active",
    };
  }
  if (phase === COMBAT_PHASE.RECOVERY) {
    return {
      exposed: true,
      poseKey: "slap_recovery",
      phase,
      reason: "slap_recovery",
    };
  }
  return {
    exposed: false,
    poseKey: null,
    phase,
    reason: "phase_not_exposed",
  };
}

function getVictimSlapLimbAabb(victim, simTime, out) {
  const exposure = resolveSlapLimbExposure(victim, simTime);
  if (!exposure.exposed || !isPhase4aSlapPoseAuthorityReady(exposure.poseKey)) {
    return null;
  }
  const poseDef = getPoseDefinition(exposure.poseKey);
  if (!poseDef || poseDef.support !== SUPPORT.SUPPORTED) return null;
  const size = victim.sizeMultiplier || 1;
  // Variant comes from authoritative sim state (slapAnimation), so the queried
  // volume is the one the victim is actually drawing this frame.
  const variantKey = resolvePoseVariantKey(poseDef, victim);
  const locals = materializeLocalRegions(poseDef, size, variantKey);
  let limbLocal = null;
  for (let i = 0; i < locals.length; i++) {
    if (locals[i].kind === COMBAT_VOLUME_KIND.HURT_LIMB) {
      limbLocal = locals[i];
      break;
    }
  }
  if (!limbLocal) return null;
  const mirror = resolveMirrorFacing(victim);
  return {
    aabb: localRectToWorldAabb(
      limbLocal,
      victim.x,
      victim.y,
      mirror,
      out || undefined
    ),
    mirrorFacing: mirror,
    poseKey: exposure.poseKey,
    phase: exposure.phase,
    region: limbLocal.region || limbLocal.label,
    label: limbLocal.label,
    variantKey,
    /** Outward edge along the victim's forward — honest visible arm tip. */
    reachForward: limbLocal.forward + limbLocal.halfW,
  };
}

/**
 * Max root-to-root gap at which `attackKind` can legally reach `victim`'s
 * exposed slap limb. Pure geometry (probe outer edge + limb outer edge) —
 * exported so tests and diagnostics can assert the honest range directly.
 */
function getMaxLegalLimbGap(attackKind, victim, simTime) {
  const probe = getAttackerHitRegion(
    attackKind === "palmThrust" ? "palm" : attackKind
  );
  if (!probe) return null;
  const limb = getVictimSlapLimbAabb(victim, simTime);
  if (!limb) return null;
  return probe.region.forward + probe.region.halfW + limb.reachForward;
}

function resolveAttackerActionFacing(attacker, attackKind) {
  if (
    attackKind === "slap" &&
    (attacker.slapFacingDirection === 1 || attacker.slapFacingDirection === -1)
  ) {
    return attacker.slapFacingDirection;
  }
  if (
    (attackKind === "palm" ||
      attackKind === "palmThrust" ||
      attackKind === "charged") &&
    (attacker.chargingFacingDirection === 1 ||
      attacker.chargingFacingDirection === -1)
  ) {
    return attacker.chargingFacingDirection;
  }
  return attacker.facing === 1 || attacker.facing === -1 ? attacker.facing : 1;
}

/**
 * Canonical authored HIT region for an attack kind's real authoritative pose.
 * Throws when a supported pose is missing or malformed — a silently-wrong probe
 * is how the 12-unit invisible-reach defect survived in the first place.
 */
function getAttackerHitRegion(attackKind) {
  const poseKey = ATTACKER_HIT_POSE[attackKind];
  if (!poseKey) return null;
  const poseDef = getPoseDefinition(poseKey);
  if (!poseDef || poseDef.support !== SUPPORT.SUPPORTED) {
    const e = new Error(
      `[authoredSlapHurt] ${poseKey} is not a supported authored pose — cannot derive limb probe`
    );
    e.code = "AUTHORED_HIT_POSE_UNSUPPORTED";
    throw e;
  }
  const regions = Array.isArray(poseDef.regions) ? poseDef.regions : [];
  const hit = regions.find((r) => r && r.kind === COMBAT_VOLUME_KIND.HIT);
  if (!hit) {
    const e = new Error(
      `[authoredSlapHurt] ${poseKey} has no HIT region — cannot derive limb probe`
    );
    e.code = "AUTHORED_HIT_REGION_MISSING";
    throw e;
  }
  const nums = [hit.forward, hit.up, hit.halfW, hit.halfH];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
    const e = new Error(
      `[authoredSlapHurt] ${poseKey} HIT region "${hit.label}" is malformed ` +
        `(forward/up/halfW/halfH must be finite numbers)`
    );
    e.code = "AUTHORED_HIT_REGION_MALFORMED";
    throw e;
  }
  if (!(hit.halfW > 0) || !(hit.halfH > 0)) {
    const e = new Error(
      `[authoredSlapHurt] ${poseKey} HIT region "${hit.label}" has non-positive extents`
    );
    e.code = "AUTHORED_HIT_REGION_MALFORMED";
    throw e;
  }
  return { poseKey, region: hit };
}

/**
 * Limb-query probe AABB, straight off the attacker's canonical authored HIT rail.
 *
 * Position comes from the server root, committed action-facing and the
 * authoritative action state only — never client pose hints, renderX/Y or DOM.
 * Extents are authored world units and are deliberately NOT multiplied by
 * sizeMultiplier: the rendered sprite width is fixed, so sprite reach is too.
 */
function buildAttackerTipProbeAabb(attacker, attackKind, out) {
  const hit = getAttackerHitRegion(attackKind);
  if (!hit) return null;
  const { region } = hit;
  const facing = resolveAttackerActionFacing(attacker, attackKind);
  const dir = facing === 1 ? -1 : 1;
  const cx = attacker.x + dir * region.forward;
  const cy = (typeof attacker.y === "number" ? attacker.y : 0) + region.up;
  const aabb = out || { left: 0, right: 0, top: 0, bottom: 0 };
  aabb.left = cx - region.halfW;
  aabb.right = cx + region.halfW;
  aabb.bottom = cy - region.halfH;
  aabb.top = cy + region.halfH;
  return {
    aabb,
    tipX: cx,
    tipY: cy,
    facing,
    attackDir: dir,
    hitPoseKey: hit.poseKey,
    hitLabel: region.label || null,
    /** Outward edge along attack direction — the honest max reach of the probe. */
    reachForward: region.forward + region.halfW,
  };
}

/**
 * Evaluate whether attacker's tip probe overlaps victim slap limb.
 * Does not consult legacy body connect — caller combines.
 *
 * @returns {null|{ hit: true, victimRegion, victimKind, contactX, contactY, poseKey, phase, mirrorFacing, tipX, depth }}
 */
function evaluateTipVersusSlapLimb(attacker, victim, opts = {}) {
  if (!isAuthoredSlapHurtboxV1Enabled(opts.envValue)) {
    return null;
  }
  if (!attacker || !victim) return null;
  const simTime =
    typeof opts.simTime === "number"
      ? opts.simTime
      : typeof attacker.attackStartTime === "number"
        ? attacker.attackStartTime
        : 0;
  const kind =
    opts.attackKind || attackKindFromPlayer(attacker) || attacker.attackType;
  if (kind !== "slap" && kind !== "palm" && kind !== "palmThrust" && kind !== "charged") {
    return null;
  }

  const limb = getVictimSlapLimbAabb(victim, simTime);
  if (!limb) return null;

  const tip = buildAttackerTipProbeAabb(attacker, kind === "palmThrust" ? "palm" : kind);
  if (!tip) return null;
  if (!aabbsOverlap(tip.aabb, limb.aabb)) return null;

  const contact = aabbContactApprox(tip.aabb, limb.aabb, {
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    depth: 0,
  });

  return {
    hit: true,
    victimRegion: limb.region,
    victimKind: COMBAT_VOLUME_KIND.HURT_LIMB,
    contactX: contact.x,
    contactY: contact.y,
    depth: contact.depth,
    poseKey: limb.poseKey,
    phase: limb.phase,
    mirrorFacing: limb.mirrorFacing,
    variantKey: limb.variantKey,
    tipX: tip.tipX,
    tipY: tip.tipY,
    attackKind: kind,
    hitPoseKey: tip.hitPoseKey,
    hitLabel: tip.hitLabel,
    edgePolicy: EDGE_POLICY.name,
  };
}

/**
 * Choose winning victim surface among legacy body connect + optional limb.
 * @param {{ bodyEligible: boolean, bodyContactX: number|null, bodyDist: number|null, limb: object|null, attackDir: number }} args
 */
function selectWinningVictimContact(args) {
  const candidates = [];
  if (args.bodyEligible) {
    candidates.push({
      victimRegion: "torso",
      victimKind: COMBAT_VOLUME_KIND.HURT_BODY,
      contactX: args.bodyContactX,
      dist: args.bodyDist,
      source: "legacy_tip_body",
    });
  }
  if (args.limb && args.limb.hit) {
    const along = Math.abs((args.limb.contactX || 0) - (args.limb.tipX || 0));
    candidates.push({
      victimRegion: args.limb.victimRegion || "frontArm",
      victimKind: COMBAT_VOLUME_KIND.HURT_LIMB,
      contactX: args.limb.contactX,
      contactY: args.limb.contactY,
      dist: along,
      source: "authored_slap_limb",
      poseKey: args.limb.poseKey,
      phase: args.limb.phase,
      mirrorFacing: args.limb.mirrorFacing,
      variantKey: args.limb.variantKey,
    });
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const da = typeof a.dist === "number" ? a.dist : Infinity;
    const db = typeof b.dist === "number" ? b.dist : Infinity;
    if (da !== db) return da - db;
    // Tie → body before limb
    if (a.victimKind !== b.victimKind) {
      if (a.victimKind === COMBAT_VOLUME_KIND.HURT_BODY) return -1;
      if (b.victimKind === COMBAT_VOLUME_KIND.HURT_BODY) return 1;
    }
    if (a.victimRegion < b.victimRegion) return -1;
    if (a.victimRegion > b.victimRegion) return 1;
    return 0;
  });
  return candidates[0];
}

/**
 * Full Phase 4A resolve for one attacker→victim strike check.
 * @returns {{ connect: boolean, winner: object|null, limb: object|null, mode: string }}
 */
function resolveAuthoredSlapHurtContact(attacker, victim, opts = {}) {
  const flagOn = isAuthoredSlapHurtboxV1Enabled(opts.envValue);
  const bodyEligible = !!opts.bodyEligible;
  const result = {
    connect: bodyEligible,
    winner: null,
    limb: null,
    mode: flagOn ? "authored_slap_hurtbox_v1" : "legacy",
    fallbackReason: null,
  };

  if (!flagOn) {
    if (bodyEligible) {
      result.winner = {
        victimRegion: "torso",
        victimKind: COMBAT_VOLUME_KIND.HURT_BODY,
        contactX: opts.bodyContactX,
        source: "legacy_tip_body",
      };
    }
    _lastResolve = result;
    return result;
  }

  const limb = evaluateTipVersusSlapLimb(attacker, victim, opts);
  result.limb = limb;
  const attackDir =
    opts.attackDir != null
      ? opts.attackDir
      : getAttackDir(attacker);

  const winner = selectWinningVictimContact({
    bodyEligible,
    bodyContactX: opts.bodyContactX,
    bodyDist: opts.bodyDist,
    limb,
    attackDir,
  });

  if (winner) {
    // Park policy needs body eligibility even when limb wins VFX selection.
    winner.bodyEligible = bodyEligible;
  }
  result.winner = winner;
  result.connect = !!winner;
  if (!winner && !bodyEligible) {
    result.fallbackReason = limb
      ? null
      : resolveSlapLimbExposure(victim, opts.simTime).reason;
  }
  _lastResolve = result;
  return result;
}

/**
 * Side-effect-free slap offensive contact query (body rail + Phase 4A limb).
 * Mirrors checkCollision slap eligibility without mutating fighters.
 * Attack direction matches collisionSystem slap branch (facing-based).
 *
 * @returns {{
 *   connects: boolean,
 *   bodyEligible: boolean,
 *   limbOnly: boolean,
 *   opponentInFront: boolean,
 *   winner: object|null,
 *   limb: object|null,
 *   reason: string,
 * }}
 */
function querySlapOffensiveContact(attacker, victim, simTime) {
  const empty = (reason) => ({
    connects: false,
    bodyEligible: false,
    limbOnly: false,
    opponentInFront: false,
    winner: null,
    limb: null,
    reason,
  });
  if (!attacker || !victim) return empty("no_fighters");
  if (!isSlapTipLive(attacker, simTime)) return empty("tip_not_live");

  const deltaX = victim.x - attacker.x;
  const attackDir = attacker.facing === 1 ? -1 : 1;
  const opponentInFront = deltaX * attackDir >= 0;
  const horizontalDistance = Math.abs(deltaX);
  const hitboxDistance = getConnectDistance("slap", attacker, victim);
  const slapAge = attacker.attackStartTime
    ? simTime - attacker.attackStartTime
    : 0;
  const pastOpenHitGrace = slapAge >= SLAP_STARTUP_MS + AP_LATE_PARRY_MS;
  const inRange =
    opponentInFront && isWithinConnectRange(horizontalDistance, hitboxDistance);
  const confirmDeferredOpenHit =
    !!attacker.slapOpenHitPending &&
    pastOpenHitGrace &&
    opponentInFront &&
    isWithinConnectRange(
      horizontalDistance,
      hitboxDistance + SLAP_GRACE_CONFIRM_SLACK_PX
    );
  const bodyEligible = inRange || confirmDeferredOpenHit;
  const slapHurt = resolveAuthoredSlapHurtContact(attacker, victim, {
    simTime,
    attackKind: "slap",
    bodyEligible,
    bodyContactX: getContactSeamX(attacker, victim, "slap"),
    bodyDist: horizontalDistance,
    attackDir,
  });
  const limbOnly =
    slapHurt.mode === "authored_slap_hurtbox_v1" &&
    slapHurt.connect &&
    !bodyEligible &&
    opponentInFront &&
    !!slapHurt.limb;
  const connects = !!(bodyEligible || limbOnly);
  return {
    connects,
    bodyEligible,
    limbOnly,
    opponentInFront,
    winner: connects ? slapHurt.winner : null,
    limb: slapHurt.limb,
    reason: connects
      ? limbOnly
        ? "limb_only"
        : "body"
      : !opponentInFront
        ? "not_in_front"
        : "no_contact",
  };
}

/**
 * Stamp transient contact override consumed by processHit presentation.
 */
function stampStrikeContactOverride(attacker, winner) {
  if (!attacker || !winner) {
    if (attacker) attacker._strikeContactOverride = null;
    return;
  }
  const limbSource = winner.source === "authored_slap_limb";
  const bodyEligible = !!winner.bodyEligible;
  // Limb-only for PARK: authored limb won AND torso was out of legacy connect.
  // If torso was also eligible, keep legacy tip-meets-body park even when the
  // selected VFX region is the limb (earliest tip contact).
  const limbOnlyPark = limbSource && !bodyEligible;
  // Separate meanings: VFX/region identity must not imply torso parking.
  attacker._strikeContactOverride = {
    /** VFX / spark / region identity point (authored limb intersection or seam). */
    contactX: winner.contactX,
    contactY: winner.contactY != null ? winner.contactY : null,
    victimRegion: winner.victimRegion,
    victimKind: winner.victimKind,
    source: winner.source,
    poseKey: winner.poseKey || null,
    phase: winner.phase || null,
    mirrorFacing: winner.mirrorFacing != null ? winner.mirrorFacing : null,
    /** Exact slap animation variant the victim was drawing (1 | 2 | null). */
    variantKey: winner.variantKey != null ? winner.variantKey : null,
    authoredSlapHurtboxV1: limbSource,
    bodyEligible,
    /** When true, processHit must NOT apply tip-meets-body torso park. */
    skipTorsoPark: limbOnlyPark,
    limbOnly: limbOnlyPark,
  };
}

function consumeStrikeContactOverride(attacker) {
  if (!attacker) return null;
  const v = attacker._strikeContactOverride || null;
  attacker._strikeContactOverride = null;
  return v;
}

module.exports = {
  EXPOSED_SLAP_POSES,
  isPhase4aSlapPoseAuthorityReady,
  isSlapTipLive,
  resolveSlapLimbExposure,
  getVictimSlapLimbAabb,
  getAttackerHitRegion,
  getMaxLegalLimbGap,
  buildAttackerTipProbeAabb,
  evaluateTipVersusSlapLimb,
  selectWinningVictimContact,
  resolveAuthoredSlapHurtContact,
  querySlapOffensiveContact,
  stampStrikeContactOverride,
  consumeStrikeContactOverride,
  getLastAuthoredSlapHurtResolve,
  clearLastAuthoredSlapHurtResolve,
  noteSlapHurtQuery,
  getSlapHurtQueryLog,
  clearSlapHurtQueryLog,
  noteSlapHurtCommitted,
  getLastSlapHurtCommitted,
  clearLastSlapHurtCommitted,
  ATTACKER_HIT_POSE,
};

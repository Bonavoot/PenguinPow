"use strict";

/**
 * Phase 4A/4B — authored HURT_LIMB as an extra victim target surface.
 *
 * Consumes shared/combatVolumeAuthored.json via combatVolumeDefs (no second table).
 * Does NOT replace strikeContact tip-meets-body. Does NOT author hits from client
 * debug latches, renderX/Y, or pose-director hints.
 *
 * BOTH sides of the limb query are authored geometry:
 *   attacker → the canonical HIT rail of its real authoritative pose
 *              (slap_active / palm_active / charged_active)
 *   victim   → the exposed pose's HURT_LIMB, variant-resolved from authoritative
 *              sim state (slapAnimation for slap, hold window for palm)
 * Neither is size-scaled: rendered sprite width is fixed, so reach is fixed.
 *
 * Exposure:
 *   Phase 4A — slap_active + slap_recovery
 *   Phase 4B — palm_active + palm_recovery, the latter ONLY while the palm is
 *              still holding the extended strike pose (PALM_THRUST_HOLD_MS into
 *              recovery). Startup is excluded for both moves.
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
  PALM_THRUST_HOLD_MS,
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

/**
 * Phase 4B palm allowlist. Mirrors meta.phase4bPalmAllowlist +
 * poses.*.phase4bAuthority. palm_startup is excluded for the same reason
 * slap_startup is.
 */
const EXPOSED_PALM_POSES = Object.freeze({
  palm_active: true,
  palm_recovery: true,
});

/** Every pose the authored-limb gate may target, across both phases. */
const EXPOSED_LIMB_POSES = Object.freeze({
  ...EXPOSED_SLAP_POSES,
  ...EXPOSED_PALM_POSES,
});

/**
 * Authored variant key selecting `palm_recovery`'s extended hold volume. The
 * value is `String(true)` because the authoritative source is the boolean
 * `palmLimbExtended`, which is also what the debug overlay reads off the wire —
 * one field, so overlay and authority can never resolve different geometry.
 */
const PALM_LIMB_HOLD_VARIANT = "true";

function isAuthoredLimbPoseAuthorityReady(poseKey) {
  if (!poseKey || !EXPOSED_LIMB_POSES[poseKey]) return false;
  const poseDef = getPoseDefinition(poseKey);
  if (!poseDef || poseDef.support !== SUPPORT.SUPPORTED) return false;
  return poseDef.phase4aAuthority === true || poseDef.phase4bAuthority === true;
}

/** Phase 4A-named alias — slap poses only, kept for existing callers/tests. */
function isPhase4aSlapPoseAuthorityReady(poseKey) {
  if (!poseKey || !EXPOSED_SLAP_POSES[poseKey]) return false;
  return isAuthoredLimbPoseAuthorityReady(poseKey);
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

function isPalmFamilyVictim(victim) {
  return !!(victim && victim.isPalmThrust);
}

/** "slap" | "palm" | null — which authored limb family a pose key belongs to. */
function limbFamilyForPoseKey(poseKey) {
  if (!poseKey) return null;
  if (EXPOSED_SLAP_POSES[poseKey]) return "slap";
  if (EXPOSED_PALM_POSES[poseKey]) return "palm";
  return null;
}

/**
 * Is the palm still HOLDING its extended strike pose during recovery?
 *
 * Pure, and derived only from authoritative recovery state — never from the
 * client's PALM_THRUST_ANIM clock. `recoveryDuration` is 320 on whiff
 * (HOLD 260 + END_RECOVERY 60) and 200 on a connect; both keep drawing
 * palm-thrust.png for the whole window this returns true for, and the boundary
 * lands 20ms BEFORE the client swaps back to the retracted art.
 */
function isPalmLimbHoldWindow(victim, simTime) {
  if (!victim || !victim.isRecovering) return false;
  const start = victim.recoveryStartTime;
  if (typeof start !== "number" || !(start > 0)) return false;
  if (typeof simTime !== "number" || !Number.isFinite(simTime)) return false;
  const elapsed = simTime - start;
  return elapsed >= 0 && elapsed < PALM_THRUST_HOLD_MS;
}

/**
 * Authoritative victim limb exposure (Phase 4A slap + Phase 4B palm).
 * @returns {{ exposed: boolean, poseKey: string|null, phase: string|null, variantKey: string|null, reason: string }}
 */
function resolveVictimLimbExposure(victim, simTime) {
  const miss = (poseKey, phase, reason) => ({
    exposed: false,
    poseKey,
    phase,
    variantKey: null,
    reason,
  });
  if (!victim) return miss(null, null, "no_victim");

  if (isSlapFamilyVictim(victim)) {
    const phase = inferAuthoredPhase(victim, simTime);
    if (phase === COMBAT_PHASE.STARTUP) {
      return miss("slap_startup", phase, "startup_not_phase4a_exposed");
    }
    if (phase === COMBAT_PHASE.ACTIVE) {
      return {
        exposed: true,
        poseKey: "slap_active",
        phase,
        variantKey: null,
        reason: "slap_active",
      };
    }
    if (phase === COMBAT_PHASE.RECOVERY) {
      return {
        exposed: true,
        poseKey: "slap_recovery",
        phase,
        variantKey: null,
        reason: "slap_recovery",
      };
    }
    return miss(null, phase, "phase_not_exposed");
  }

  if (isPalmFamilyVictim(victim)) {
    const phase = inferAuthoredPhase(victim, simTime);
    if (phase === COMBAT_PHASE.STARTUP) {
      return miss("palm_startup", phase, "startup_not_phase4b_exposed");
    }
    if (phase === COMBAT_PHASE.ACTIVE) {
      return {
        exposed: true,
        poseKey: "palm_active",
        phase,
        variantKey: null,
        reason: "palm_active",
      };
    }
    if (phase === COMBAT_PHASE.RECOVERY) {
      // Only the held-out portion. Once the arm settles back inside the
      // pushbox there is nothing honest left to hit, so the limb goes away
      // entirely rather than shrinking to a volume that can never win.
      if (!isPalmLimbHoldWindow(victim, simTime)) {
        return miss("palm_recovery", phase, "palm_recovery_settled");
      }
      return {
        exposed: true,
        poseKey: "palm_recovery",
        phase,
        variantKey: PALM_LIMB_HOLD_VARIANT,
        reason: "palm_recovery_hold",
      };
    }
    return miss(null, phase, "phase_not_exposed");
  }

  return miss(null, null, "not_limb_family");
}

/** Phase 4A-named alias. */
function resolveSlapLimbExposure(victim, simTime) {
  const r = resolveVictimLimbExposure(victim, simTime);
  return r.reason === "not_limb_family"
    ? { ...r, reason: "not_slap_family" }
    : r;
}

function getVictimLimbAabb(victim, simTime, out) {
  const exposure = resolveVictimLimbExposure(victim, simTime);
  if (!exposure.exposed || !isAuthoredLimbPoseAuthorityReady(exposure.poseKey)) {
    return null;
  }
  const poseDef = getPoseDefinition(exposure.poseKey);
  if (!poseDef || poseDef.support !== SUPPORT.SUPPORTED) return null;
  const size = victim.sizeMultiplier || 1;
  // Variant comes from authoritative sim state (slapAnimation for slap, the
  // resolved hold window for palm), so the queried volume is the one the victim
  // is actually drawing this frame. An unresolvable variant falls back to the
  // pose's base regions, which are always authored as the SHORTER volume.
  const variantKey =
    exposure.variantKey != null
      ? exposure.variantKey
      : resolvePoseVariantKey(poseDef, victim);
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

/** Phase 4A-named alias. */
function getVictimSlapLimbAabb(victim, simTime, out) {
  return getVictimLimbAabb(victim, simTime, out);
}

/**
 * Max root-to-root gap at which `attackKind` can legally reach `victim`'s
 * exposed limb. Pure geometry (probe outer edge + limb outer edge) —
 * exported so tests and diagnostics can assert the honest range directly.
 */
function getMaxLegalLimbGap(attackKind, victim, simTime) {
  const probe = getAttackerHitRegion(
    attackKind === "palmThrust" ? "palm" : attackKind
  );
  if (!probe) return null;
  const limb = getVictimLimbAabb(victim, simTime);
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

  const limb = getVictimLimbAabb(victim, simTime);
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
  // `bodyEligible` answers "may this hit commit?" and can be true purely from a
  // TIMING forgiveness (the slap open-hit grace re-confirms a deferred hit up to
  // SLAP_GRACE_CONFIRM_SLACK_PX past tip connect). `torsoEligible` answers the
  // different question "is the torso actually at tip-meets-body range NOW?" —
  // the only honest basis for limb-only classification and park policy.
  // Defaults to bodyEligible so callers without a grace path are unchanged.
  const torsoEligible =
    opts.torsoEligible != null ? !!opts.torsoEligible : bodyEligible;
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
    winner.torsoEligible = torsoEligible;
  }
  result.winner = winner;
  result.connect = !!winner;
  if (!winner && !bodyEligible) {
    result.fallbackReason = limb
      ? null
      : resolveVictimLimbExposure(victim, opts.simTime).reason;
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
    // Mirrors the checkCollision slap branch: the grace confirm is a commit
    // allowance, never evidence that the torso is in reach.
    torsoEligible: inRange,
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
  // Torso reach is the honest basis here, NOT commit eligibility: a slap
  // open-hit grace confirm can commit a hit while the tip is up to
  // SLAP_GRACE_CONFIRM_SLACK_PX short of the torso. Classifying that as
  // "torso-plus-limb" mislabelled genuine limb contacts (killing the struck-limb
  // hold) and parked them to tip-meets-body, i.e. suction on an arm hit.
  const torsoEligible =
    winner.torsoEligible != null ? !!winner.torsoEligible : bodyEligible;
  // Limb-only for PARK: authored limb won AND torso was out of legacy connect.
  // If the torso was genuinely in reach, keep legacy tip-meets-body park even
  // when the selected VFX region is the limb (earliest tip contact).
  const limbOnlyPark = limbSource && !torsoEligible;
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
    /** Phase 4B: "slap" | "palm" | null — lets consumers branch without parsing poseKey. */
    limbFamily: limbFamilyForPoseKey(winner.poseKey || null),
    mirrorFacing: winner.mirrorFacing != null ? winner.mirrorFacing : null,
    /** Exact authored variant the victim was drawing (slap 1|2, palm hold true, else null). */
    variantKey: winner.variantKey != null ? winner.variantKey : null,
    authoredSlapHurtboxV1: limbSource,
    bodyEligible,
    torsoEligible,
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

/**
 * Publish the palm hold window as a plain player field so the debug overlay can
 * resolve `palm_recovery`'s variant off the wire and draw exactly what authority
 * queried. Authority itself never reads this field — it re-derives the window
 * from `isPalmLimbHoldWindow`, so a dropped/stale delta cannot move a hitbox.
 *
 * Called once per tick per player, before checkCollision.
 */
function refreshPalmLimbExtended(player, simTime) {
  if (!player) return false;
  const extended = isPalmFamilyVictim(player) && isPalmLimbHoldWindow(player, simTime);
  player.palmLimbExtended = extended;
  return extended;
}

module.exports = {
  EXPOSED_SLAP_POSES,
  EXPOSED_PALM_POSES,
  EXPOSED_LIMB_POSES,
  PALM_LIMB_HOLD_VARIANT,
  isPhase4aSlapPoseAuthorityReady,
  isAuthoredLimbPoseAuthorityReady,
  isSlapTipLive,
  isPalmLimbHoldWindow,
  refreshPalmLimbExtended,
  limbFamilyForPoseKey,
  resolveSlapLimbExposure,
  resolveVictimLimbExposure,
  getVictimSlapLimbAabb,
  getVictimLimbAabb,
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

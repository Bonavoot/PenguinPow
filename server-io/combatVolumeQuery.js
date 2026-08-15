"use strict";

/**
 * Premium Combat Foundation Phase 1 — diagnostic combat-volume query.
 *
 * INERT / NON-AUTHORITATIVE:
 *   - Do NOT import this from collisionSystem, index tick, socketHandlers,
 *     grabActionSystem, or any live outcome path.
 *   - Volumes are fixture/diagnostic shadows for harness + debug overlay.
 *   - They must never deal damage, cancel actions, or move fighters.
 *
 * Phase 1 authors only a minimal slice to prove infrastructure:
 *   PUSH + HURT_BODY from live pushbox half-width
 *   Diagnostic HIT tip box during strike active
 *   Diagnostic HURT_LIMB during slap recovery / isRecovering after slap
 *   GRAB range box during grab startup
 *   LANDING footprint when grounded
 *   Tags for intangible / strike-invulnerable states
 *
 * Full per-move authored library = Phase 3.
 */

const {
  HITBOX_DISTANCE_VALUE,
  GRAB_RANGE,
  GROUND_LEVEL,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  CHARGED_STARTUP_MS,
  LOW_KICK_STARTUP_MS,
  LOW_KICK_ACTIVE_MS,
  STRIKE_TIP_SLAP1_SPRITE_PX,
  STRIKE_TIP_SLAP2_SPRITE_PX,
  STRIKE_TIP_CHARGED_SPRITE_PX,
  STRIKE_TIP_PALM_SPRITE_PX,
} = require("./constants");
const { getPushboxHalfWidth } = require("./pushboxGeometry");
const { getActionFacingLock } = require("./actionFacingOwnership");
const { isInDodgeStrikeIFrames, isInSlideRedirectIFrames } = require("./gameUtils");
const {
  COMBAT_VOLUME_KIND,
  COMBAT_VOLUME_TAG,
  COMBAT_VOLUME_KIND_ORDER,
  COMBAT_PHASE,
} = require("./combatVolumeVocabulary");
const {
  createLocalRect,
  localRectToWorldAabb,
  assertFiniteAabb,
  sortVolumeRecords,
  aabbsOverlap,
  aabbContactApprox,
} = require("./combatGeometry");

const SPRITE_PX_TO_WORLD = (1280 * 0.123) / 960;

/** Frozen diagnostic templates (no per-tick parse). */
const TMPL_BODY = createLocalRect(0, 55, HITBOX_DISTANCE_VALUE, 55);
const TMPL_LIMB_SLAP = createLocalRect(70, 70, 36, 18);
const TMPL_HIT_PALM = createLocalRect(
  STRIKE_TIP_PALM_SPRITE_PX * SPRITE_PX_TO_WORLD - 12,
  68,
  14,
  18
);
const TMPL_HIT_CHARGED = createLocalRect(
  STRIKE_TIP_CHARGED_SPRITE_PX * SPRITE_PX_TO_WORLD - 14,
  72,
  16,
  20
);
const TMPL_HIT_LOW = createLocalRect(90, 28, 16, 14);

const SOURCE_DIAGNOSTIC = "phase1_diagnostic_shadow";
const SOURCE_FALLBACK = "phase1_unsupported_fallback";

function tipWorldForAttack(player) {
  if (player.isPalmThrust) return STRIKE_TIP_PALM_SPRITE_PX * SPRITE_PX_TO_WORLD;
  if (player.attackType === "charged" && !player.isPalmThrust) {
    return STRIKE_TIP_CHARGED_SPRITE_PX * SPRITE_PX_TO_WORLD;
  }
  if (player.isLowKick) return 90;
  if (player.slapAnimation === 2) {
    return STRIKE_TIP_SLAP2_SPRITE_PX * SPRITE_PX_TO_WORLD;
  }
  return STRIKE_TIP_SLAP1_SPRITE_PX * SPRITE_PX_TO_WORLD;
}

/**
 * Committed action facing for mirroring volumes — NOT raw locomotion facing
 * when a lock / slapFacing / charge facing is present.
 */
function resolveMirrorFacing(player) {
  if (!player) return 1;
  const lock = getActionFacingLock(player);
  if (lock && (lock.direction === 1 || lock.direction === -1)) {
    return lock.direction;
  }
  if (player.isSlapAttack && (player.slapFacingDirection === 1 || player.slapFacingDirection === -1)) {
    return player.slapFacingDirection;
  }
  if (
    (player.isPalmThrust ||
      player.isChargingAttack ||
      player.attackType === "charged") &&
    (player.chargingFacingDirection === 1 || player.chargingFacingDirection === -1)
  ) {
    return player.chargingFacingDirection;
  }
  return player.facing === 1 || player.facing === -1 ? player.facing : 1;
}

function inferCombatPhase(player, simTime) {
  if (!player) return COMBAT_PHASE.NEUTRAL;
  if (player.isDead || player.isAtTheRopes) return COMBAT_PHASE.INCAPACITATED;
  if (player.isHit || player.isRawParryStun) return COMBAT_PHASE.HITSTUN;
  // COMBAT_PHASE.OPEN used to be produced here from the clinch's punishable Open
  // state. The command grab has no Open — a grab is uninterruptible from connect to
  // release — so nothing produces that phase now. The enum value is kept as
  // vocabulary; if a future move needs a "fully exposed" phase, produce it here.
  if (player.inClinch) return COMBAT_PHASE.CLINCHED;
  if (
    player.isDodging ||
    player.isSidestepping ||
    (player.isRopeJumping && player.ropeJumpPhase === "active") ||
    (player.isSlideJumping && player.slideJumpPhase === "flight")
  ) {
    if (player.isSidestepStartup || player.isDodgeStartup) {
      return COMBAT_PHASE.STARTUP;
    }
    if (player.isSidestepRecovery || player.isDodgeRecovery) {
      return COMBAT_PHASE.RECOVERY;
    }
    return COMBAT_PHASE.PASS_THROUGH;
  }
  if (
    (player.isRopeJumping && player.ropeJumpPhase === "startup") ||
    player.isGrabStartup ||
    player.isInStartupFrames
  ) {
    return COMBAT_PHASE.STARTUP;
  }
  if (player.isAttacking) {
    const now = typeof simTime === "number" ? simTime : 0;
    const start = player.attackStartTime || 0;
    const elapsed = now - start;
    if (player.isSlapAttack) {
      if (elapsed < SLAP_STARTUP_MS) return COMBAT_PHASE.STARTUP;
      if (elapsed < SLAP_STARTUP_MS + SLAP_ACTIVE_MS) return COMBAT_PHASE.ACTIVE;
      return COMBAT_PHASE.RECOVERY;
    }
    if (player.isPalmThrust) {
      if (elapsed < PALM_THRUST_STARTUP_MS) return COMBAT_PHASE.STARTUP;
      if (elapsed < PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS) {
        return COMBAT_PHASE.ACTIVE;
      }
      return COMBAT_PHASE.RECOVERY;
    }
    if (player.isLowKick) {
      if (elapsed < LOW_KICK_STARTUP_MS) return COMBAT_PHASE.STARTUP;
      if (elapsed < LOW_KICK_STARTUP_MS + LOW_KICK_ACTIVE_MS) {
        return COMBAT_PHASE.ACTIVE;
      }
      return COMBAT_PHASE.RECOVERY;
    }
    if (player.attackType === "charged") {
      if (elapsed < CHARGED_STARTUP_MS) return COMBAT_PHASE.STARTUP;
      return COMBAT_PHASE.ACTIVE;
    }
    return COMBAT_PHASE.ACTIVE;
  }
  if (player.isChargingAttack) return COMBAT_PHASE.STARTUP;
  if (player.isWhiffingGrab || player.isGrabWhiffRecovery || player.isRecovering || player.isInEndlag) {
    return COMBAT_PHASE.RECOVERY;
  }
  if (
    player.isSlideJumping ||
    player.isRopeJumping ||
    player.isFlapping ||
    (typeof player.y === "number" && player.y < GROUND_LEVEL - 1)
  ) {
    return COMBAT_PHASE.AIRBORNE;
  }
  return COMBAT_PHASE.NEUTRAL;
}

function pushVolume(out, rec) {
  assertFiniteAabb(rec.aabb, rec.label || rec.kind);
  out.push(rec);
}

function scaledBodyTemplate(halfW) {
  // Scale only width with size; height stays readable diagnostic constant.
  return createLocalRect(0, 55, halfW, 55);
}

function scaledLandingTemplate(halfW) {
  return createLocalRect(0, 4, halfW, 4);
}

function hitTemplateFor(player) {
  if (player.isPalmThrust) return TMPL_HIT_PALM;
  if (player.isLowKick) return TMPL_HIT_LOW;
  if (player.attackType === "charged" && !player.isPalmThrust) {
    return TMPL_HIT_CHARGED;
  }
  // Rebuild slap tip center from live tip length so slap1/slap2 stay honest.
  const tip = tipWorldForAttack(player);
  return createLocalRect(tip - 12, 70, 14, 16);
}

function collectTags(player, simTime) {
  const tags = [];
  if (
    player.isDodging ||
    player.isSidestepping ||
    (player.isRopeJumping && player.ropeJumpPhase === "active") ||
    (player.isSlideJumping && player.slideJumpPhase === "flight")
  ) {
    tags.push(COMBAT_VOLUME_TAG.INTANGIBLE);
  }
  if (isInDodgeStrikeIFrames(player, simTime)) {
    tags.push(COMBAT_VOLUME_TAG.INVULNERABLE);
  }
  if (isInSlideRedirectIFrames(player, simTime)) {
    if (!tags.includes(COMBAT_VOLUME_TAG.INVULNERABLE)) {
      tags.push(COMBAT_VOLUME_TAG.INVULNERABLE);
    }
  }
  // Sidestep active (+ recovery while still flagged sidestepping): live strike
  // i-frames are more nuanced (overlap threshold); Phase 1 tags the phase only.
  if (player.isSidestepping && !player.isSidestepStartup) {
    if (!tags.includes(COMBAT_VOLUME_TAG.INVULNERABLE)) {
      tags.push(COMBAT_VOLUME_TAG.INVULNERABLE);
    }
  }
  return tags;
}

/**
 * Query diagnostic volumes for one fighter at a sim instant.
 *
 * @param {object} player
 * @param {object} [opts]
 * @param {number} [opts.simTime]
 * @param {number} [opts.ownerSlot] — stable slot for ordering (0/1)
 * @param {Array} [opts.out] — reuse array (cleared)
 * @param {boolean} [opts.strictFinite=true]
 * @returns {{
 *   actionPhase: string,
 *   mirrorFacing: number,
 *   travelDirection: number|null,
 *   lifecycleInstanceId: string|null,
 *   source: string,
 *   tags: string[],
 *   volumes: Array,
 * }}
 */
function queryCombatVolumes(player, opts = {}) {
  const out = opts.out || [];
  out.length = 0;
  if (!player) {
    return {
      actionPhase: COMBAT_PHASE.NEUTRAL,
      mirrorFacing: 1,
      travelDirection: null,
      lifecycleInstanceId: null,
      source: SOURCE_FALLBACK,
      tags: [],
      volumes: out,
    };
  }

  const simTime = opts.simTime;
  const ownerSlot = opts.ownerSlot != null ? opts.ownerSlot : 0;
  const phase = inferCombatPhase(player, simTime);
  const mirrorFacing = resolveMirrorFacing(player);
  const sizeMult = player.sizeMultiplier || 1;
  const half = getPushboxHalfWidth(sizeMult);
  const rootX = player.x;
  const rootY = typeof player.y === "number" ? player.y : GROUND_LEVEL;
  const tags = collectTags(player, simTime);
  const travelDirection =
    player.isDodging && (player.dodgeDirection === 1 || player.dodgeDirection === -1)
      ? player.dodgeDirection
      : player.isSidestepping &&
          (player.sidestepDirection === 1 || player.sidestepDirection === -1)
        ? player.sidestepDirection
        : null;

  const lifecycleInstanceId =
    player.attackLifecycleId ||
    player.slapLifecycleId ||
    player.actionFacingLock?.ownerInstanceId ||
    player.dodgeFacingInstanceId ||
    null;

  const bodyTmpl = scaledBodyTemplate(half);
  const landTmpl = scaledLandingTemplate(half);

  // PUSH — always emitted (tagged intangible during pass-through).
  {
    const aabb = localRectToWorldAabb(bodyTmpl, rootX, rootY, mirrorFacing, {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    pushVolume(out, {
      kind: COMBAT_VOLUME_KIND.PUSH,
      kindOrder: COMBAT_VOLUME_KIND_ORDER.PUSH,
      label: "push",
      ownerSlot,
      ownerId: player.id || null,
      aabb,
      tags: tags.filter((t) => t === COMBAT_VOLUME_TAG.INTANGIBLE),
      source: SOURCE_DIAGNOSTIC,
      mirrorFacing,
    });
  }

  // LANDING footprint when near ground.
  if (rootY >= GROUND_LEVEL - 2) {
    const aabb = localRectToWorldAabb(landTmpl, rootX, GROUND_LEVEL, mirrorFacing, {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    pushVolume(out, {
      kind: COMBAT_VOLUME_KIND.LANDING,
      kindOrder: COMBAT_VOLUME_KIND_ORDER.LANDING,
      label: "landing",
      ownerSlot,
      ownerId: player.id || null,
      aabb,
      tags: [],
      source: SOURCE_DIAGNOSTIC,
      mirrorFacing,
    });
  }

  const passThrough = tags.includes(COMBAT_VOLUME_TAG.INTANGIBLE);

  // HURT_BODY — diagnostic body (coupled to push half today).
  if (!passThrough) {
    const aabb = localRectToWorldAabb(bodyTmpl, rootX, rootY, mirrorFacing, {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    pushVolume(out, {
      kind: COMBAT_VOLUME_KIND.HURT_BODY,
      kindOrder: COMBAT_VOLUME_KIND_ORDER.HURT_BODY,
      label: "hurt_body",
      ownerSlot,
      ownerId: player.id || null,
      aabb,
      tags: tags.filter((t) => t === COMBAT_VOLUME_TAG.INVULNERABLE || t === COMBAT_VOLUME_TAG.ARMOR),
      source: SOURCE_DIAGNOSTIC,
      mirrorFacing,
    });
  }

  // Diagnostic HURT_LIMB — slap recovery exposure proof (NOT authoritative).
  // Fixture flag `_phase1SlapRecoveryLimb` forces the limb for harness/overlay tests.
  const showSlapLimb =
    player._phase1SlapRecoveryLimb === true ||
    (player.isSlapAttack && phase === COMBAT_PHASE.RECOVERY) ||
    (player.isRecovering && player.currentAction === "slap");
  if (showSlapLimb) {
    const aabb = localRectToWorldAabb(TMPL_LIMB_SLAP, rootX, rootY, mirrorFacing, {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    pushVolume(out, {
      kind: COMBAT_VOLUME_KIND.HURT_LIMB,
      kindOrder: COMBAT_VOLUME_KIND_ORDER.HURT_LIMB,
      label: "hurt_limb_slap_diag",
      ownerSlot,
      ownerId: player.id || null,
      aabb,
      tags: [],
      source: SOURCE_DIAGNOSTIC,
      mirrorFacing,
    });
  }

  // Diagnostic HIT — active strike only.
  if (player.isAttacking && phase === COMBAT_PHASE.ACTIVE) {
    const tmpl = hitTemplateFor(player);
    const aabb = localRectToWorldAabb(tmpl, rootX, rootY, mirrorFacing, {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    pushVolume(out, {
      kind: COMBAT_VOLUME_KIND.HIT,
      kindOrder: COMBAT_VOLUME_KIND_ORDER.HIT,
      label: player.isPalmThrust
        ? "hit_palm_diag"
        : player.attackType === "charged"
          ? "hit_charged_diag"
          : player.isLowKick
            ? "hit_low_diag"
            : "hit_slap_diag",
      ownerSlot,
      ownerId: player.id || null,
      aabb,
      tags: [],
      source: SOURCE_DIAGNOSTIC,
      mirrorFacing,
    });
  }

  // GRAB acquisition box during grab startup.
  if (player.isGrabStartup) {
    const grabHalf = (GRAB_RANGE * sizeMult) * 0.5;
    const grabTmpl = createLocalRect(grabHalf, 50, grabHalf, 50);
    const aabb = localRectToWorldAabb(grabTmpl, rootX, rootY, mirrorFacing, {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    pushVolume(out, {
      kind: COMBAT_VOLUME_KIND.GRAB,
      kindOrder: COMBAT_VOLUME_KIND_ORDER.GRAB,
      label: "grab_diag",
      ownerSlot,
      ownerId: player.id || null,
      aabb,
      tags: [],
      source: SOURCE_DIAGNOSTIC,
      mirrorFacing,
    });
  }

  sortVolumeRecords(out);

  return {
    actionPhase: phase,
    mirrorFacing,
    travelDirection,
    lifecycleInstanceId,
    source: SOURCE_DIAGNOSTIC,
    tags,
    volumes: out,
    simTime: simTime != null ? simTime : null,
    rootX,
    rootY,
    sizeMultiplier: sizeMult,
  };
}

/**
 * Candidate volume contacts between two fighters (diagnostic only).
 * Deterministic order: sorted by kindOrder, labels, then depth.
 */
function queryCandidateContacts(playerA, playerB, opts = {}) {
  const slotA = opts.ownerSlotA != null ? opts.ownerSlotA : 0;
  const slotB = opts.ownerSlotB != null ? opts.ownerSlotB : 1;
  const qa = queryCombatVolumes(playerA, {
    simTime: opts.simTime,
    ownerSlot: slotA,
  });
  const qb = queryCombatVolumes(playerB, {
    simTime: opts.simTime,
    ownerSlot: slotB,
  });

  const hits = [];
  for (let i = 0; i < qa.volumes.length; i++) {
    const va = qa.volumes[i];
    if (va.kind !== COMBAT_VOLUME_KIND.HIT && va.kind !== COMBAT_VOLUME_KIND.GRAB) {
      continue;
    }
    for (let j = 0; j < qb.volumes.length; j++) {
      const vb = qb.volumes[j];
      if (
        vb.kind !== COMBAT_VOLUME_KIND.HURT_BODY &&
        vb.kind !== COMBAT_VOLUME_KIND.HURT_LIMB &&
        vb.kind !== COMBAT_VOLUME_KIND.PUSH
      ) {
        continue;
      }
      if (!aabbsOverlap(va.aabb, vb.aabb)) continue;
      const c = aabbContactApprox(va.aabb, vb.aabb, {
        x: 0,
        y: 0,
        nx: 0,
        ny: 0,
        depth: 0,
      });
      hits.push({
        attackerKind: va.kind,
        victimKind: vb.kind,
        attackerLabel: va.label,
        victimLabel: vb.label,
        attackerSlot: slotA,
        victimSlot: slotB,
        x: c.x,
        y: c.y,
        nx: c.nx,
        ny: c.ny,
        depth: c.depth,
        authoritative: false,
      });
    }
  }
  // Reverse roles
  for (let i = 0; i < qb.volumes.length; i++) {
    const va = qb.volumes[i];
    if (va.kind !== COMBAT_VOLUME_KIND.HIT && va.kind !== COMBAT_VOLUME_KIND.GRAB) {
      continue;
    }
    for (let j = 0; j < qa.volumes.length; j++) {
      const vb = qa.volumes[j];
      if (
        vb.kind !== COMBAT_VOLUME_KIND.HURT_BODY &&
        vb.kind !== COMBAT_VOLUME_KIND.HURT_LIMB &&
        vb.kind !== COMBAT_VOLUME_KIND.PUSH
      ) {
        continue;
      }
      if (!aabbsOverlap(va.aabb, vb.aabb)) continue;
      const c = aabbContactApprox(va.aabb, vb.aabb, {
        x: 0,
        y: 0,
        nx: 0,
        ny: 0,
        depth: 0,
      });
      hits.push({
        attackerKind: va.kind,
        victimKind: vb.kind,
        attackerLabel: va.label,
        victimLabel: vb.label,
        attackerSlot: slotB,
        victimSlot: slotA,
        x: c.x,
        y: c.y,
        nx: c.nx,
        ny: c.ny,
        depth: c.depth,
        authoritative: false,
      });
    }
  }

  hits.sort((a, b) => {
    if (a.attackerSlot !== b.attackerSlot) return a.attackerSlot - b.attackerSlot;
    if (a.attackerLabel < b.attackerLabel) return -1;
    if (a.attackerLabel > b.attackerLabel) return 1;
    if (a.victimLabel < b.victimLabel) return -1;
    if (a.victimLabel > b.victimLabel) return 1;
    return a.depth - b.depth;
  });

  return {
    a: qa,
    b: qb,
    candidates: hits,
  };
}

/**
 * Phase 3 — authored volume query (shadow / debug).
 * Uses shared/combatVolumeAuthored.json via combatVolumeAuthoredLoad + defs.
 * NEVER authoritative. Does not mutate player state.
 */
function queryAuthoredCombatVolumes(player, opts = {}) {
  const {
    resolveAuthoredPoseKey,
    getPoseDefinition,
    materializeLocalRegions,
    SOURCE_AUTHORED,
    SOURCE_UNSUPPORTED,
    SUPPORT,
    resolveMirrorFacing: authoredMirror,
    GROUND_LEVEL: GL,
  } = require("./combatVolumeDefs");

  const out = opts.out || [];
  out.length = 0;
  if (!player) {
    return {
      actionPhase: COMBAT_PHASE.NEUTRAL,
      mirrorFacing: 1,
      travelDirection: null,
      lifecycleInstanceId: null,
      source: SOURCE_UNSUPPORTED,
      support: SUPPORT.UNSUPPORTED,
      poseKey: null,
      classification: "UNSUPPORTED_ACTION_FALLBACK",
      tags: [],
      volumes: out,
    };
  }

  const simTime = opts.simTime;
  const ownerSlot = opts.ownerSlot != null ? opts.ownerSlot : 0;
  const resolved = resolveAuthoredPoseKey(player, simTime);
  const mirrorFacing = authoredMirror(player);
  const sizeMult = player.sizeMultiplier || 1;
  const rootX = player.x;
  const rootY = typeof player.y === "number" ? player.y : GL;
  const tags = collectTags(player, simTime);
  const travelDirection =
    player.isSidestepping &&
    (player.sidestepDirection === 1 || player.sidestepDirection === -1)
      ? player.sidestepDirection
      : player.isDodging &&
          (player.dodgeDirection === 1 || player.dodgeDirection === -1)
        ? player.dodgeDirection
        : null;

  const lifecycleInstanceId =
    player.attackLifecycleId ||
    player.slapLifecycleId ||
    player.actionFacingLock?.ownerInstanceId ||
    null;

  if (resolved.support !== SUPPORT.SUPPORTED || !resolved.poseKey) {
    return {
      actionPhase: resolved.phase,
      mirrorFacing,
      travelDirection,
      lifecycleInstanceId,
      source: SOURCE_UNSUPPORTED,
      support: SUPPORT.UNSUPPORTED,
      poseKey: null,
      classification: "UNSUPPORTED_ACTION_FALLBACK",
      reason: resolved.reason,
      tags,
      volumes: out,
    };
  }

  const poseDef = getPoseDefinition(resolved.poseKey);
  if (!poseDef) {
    return {
      actionPhase: resolved.phase,
      mirrorFacing,
      travelDirection,
      lifecycleInstanceId,
      source: SOURCE_UNSUPPORTED,
      support: SUPPORT.UNSUPPORTED,
      poseKey: resolved.poseKey,
      classification: "UNSUPPORTED_ACTION_FALLBACK",
      reason: "missing_pose_def",
      tags,
      volumes: out,
    };
  }

  const poseTags = Array.isArray(poseDef.tags) ? poseDef.tags.slice() : [];
  for (let t = 0; t < poseTags.length; t++) {
    if (!tags.includes(poseTags[t])) tags.push(poseTags[t]);
  }

  const locals = materializeLocalRegions(poseDef, sizeMult);
  const scratch = { left: 0, top: 0, right: 0, bottom: 0 };
  for (let i = 0; i < locals.length; i++) {
    const r = locals[i];
    if (r.groundedOnly && rootY < GL - 2) continue;
    const local = createLocalRect(r.forward, r.up, r.halfW, r.halfH);
    const aabb = localRectToWorldAabb(
      local,
      rootX,
      r.groundedOnly ? GL : rootY,
      mirrorFacing,
      scratch
    );
    // Copy aabb — scratch is reused.
    const aabbCopy = {
      left: aabb.left,
      top: aabb.top,
      right: aabb.right,
      bottom: aabb.bottom,
    };
    if (opts.strictFinite !== false) {
      assertFiniteAabb(aabbCopy, r.label);
    }
    out.push({
      kind: r.kind,
      kindOrder: COMBAT_VOLUME_KIND_ORDER[r.kind] || 99,
      label: r.label,
      region: r.region,
      ownerSlot,
      ownerId: player.id || null,
      aabb: aabbCopy,
      tags: tags.slice(),
      source: SOURCE_AUTHORED,
      mirrorFacing,
      dashed: !!r.dashed,
      role: r.role,
      poseKey: resolved.poseKey,
    });
  }

  sortVolumeRecords(out);

  return {
    actionPhase: resolved.phase,
    mirrorFacing,
    travelDirection,
    lifecycleInstanceId,
    source: SOURCE_AUTHORED,
    support: SUPPORT.SUPPORTED,
    poseKey: resolved.poseKey,
    classification: null,
    reason: resolved.reason,
    tags,
    volumes: out,
  };
}

/**
 * Candidate contacts using authored volumes (shadow only).
 */
function queryAuthoredCandidateContacts(playerA, playerB, opts = {}) {
  const slotA = opts.ownerSlotA != null ? opts.ownerSlotA : 0;
  const slotB = opts.ownerSlotB != null ? opts.ownerSlotB : 1;
  const qa = queryAuthoredCombatVolumes(playerA, {
    simTime: opts.simTime,
    ownerSlot: slotA,
  });
  const qb = queryAuthoredCombatVolumes(playerB, {
    simTime: opts.simTime,
    ownerSlot: slotB,
  });

  const hits = [];
  function collect(atkQ, vicQ, atkSlot, vicSlot) {
    for (let i = 0; i < atkQ.volumes.length; i++) {
      const va = atkQ.volumes[i];
      if (va.kind !== COMBAT_VOLUME_KIND.HIT) continue;
      for (let j = 0; j < vicQ.volumes.length; j++) {
        const vb = vicQ.volumes[j];
        if (
          vb.kind !== COMBAT_VOLUME_KIND.HURT_BODY &&
          vb.kind !== COMBAT_VOLUME_KIND.HURT_LIMB
        ) {
          continue;
        }
        if (!aabbsOverlap(va.aabb, vb.aabb)) continue;
        const c = aabbContactApprox(va.aabb, vb.aabb, {
          x: 0,
          y: 0,
          nx: 0,
          ny: 0,
          depth: 0,
        });
        hits.push({
          attackerKind: va.kind,
          victimKind: vb.kind,
          attackerLabel: va.label,
          victimLabel: vb.label,
          victimRegion: vb.region,
          attackerSlot: atkSlot,
          victimSlot: vicSlot,
          x: c.x,
          y: c.y,
          nx: c.nx,
          ny: c.ny,
          depth: c.depth,
          authoritative: false,
          source: "phase3_authored_candidate",
        });
      }
    }
  }
  collect(qa, qb, slotA, slotB);
  collect(qb, qa, slotB, slotA);

  hits.sort((a, b) => {
    if (a.attackerSlot !== b.attackerSlot) return a.attackerSlot - b.attackerSlot;
    if (a.victimRegion < b.victimRegion) return -1;
    if (a.victimRegion > b.victimRegion) return 1;
    if (a.attackerLabel < b.attackerLabel) return -1;
    if (a.attackerLabel > b.attackerLabel) return 1;
    if (a.victimLabel < b.victimLabel) return -1;
    if (a.victimLabel > b.victimLabel) return 1;
    return a.depth - b.depth;
  });

  return { a: qa, b: qb, candidates: hits };
}

module.exports = {
  SOURCE_DIAGNOSTIC,
  SOURCE_FALLBACK,
  resolveMirrorFacing,
  inferCombatPhase,
  queryCombatVolumes,
  queryCandidateContacts,
  queryAuthoredCombatVolumes,
  queryAuthoredCandidateContacts,
  // templates exposed for tests
  TMPL_BODY,
  TMPL_LIMB_SLAP,
  tipWorldForAttack,
};

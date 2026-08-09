"use strict";

/**
 * Phase 3 — authored combat-volume definition loader / pose resolver.
 *
 * Source of truth: shared/combatVolumeAuthored.json
 * Loaded via combatVolumeAuthoredLoad.js (CommonJS adapter).
 * INERT: never deals damage, moves fighters, or enters live collision.
 */

const {
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  CHARGED_STARTUP_MS,
  GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE,
} = require("./constants");
const { COMBAT_PHASE } = require("./combatVolumeVocabulary");
const { getActionFacingLock } = require("./actionFacingOwnership");

const AUTHORED = require("./combatVolumeAuthoredLoad");

const SOURCE_AUTHORED = "phase3_authored";
const SOURCE_UNSUPPORTED = "phase3_unsupported";

const SUPPORT = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
});

function getAuthoredCatalog() {
  return AUTHORED;
}

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

function inferAuthoredPhase(player, simTime) {
  if (!player) return COMBAT_PHASE.NEUTRAL;
  if (player.isDead || player.isAtTheRopes) return COMBAT_PHASE.INCAPACITATED;
  if (player.isHit || player.isRawParryStun) return COMBAT_PHASE.HITSTUN;
  // No OPEN producer: the command grab has no punishable post-connect Open state.
  // See the matching note in combatVolumeQuery.inferCombatPhase.
  if (player.inClinch) return COMBAT_PHASE.CLINCHED;

  if (player.isSidestepping) {
    if (player.isSidestepStartup) return COMBAT_PHASE.STARTUP;
    if (player.isSidestepRecovery) return COMBAT_PHASE.RECOVERY;
    return COMBAT_PHASE.PASS_THROUGH;
  }
  if (player.isDodging) {
    if (player.isDodgeStartup) return COMBAT_PHASE.STARTUP;
    if (player.isDodgeRecovery) return COMBAT_PHASE.RECOVERY;
    return COMBAT_PHASE.PASS_THROUGH;
  }

  if (player.isSlapAttack || (player.isAttacking && player.attackType === "slap")) {
    const elapsed = (typeof simTime === "number" ? simTime : 0) - (player.attackStartTime || 0);
    if (player.isInStartupFrames || elapsed < SLAP_STARTUP_MS) return COMBAT_PHASE.STARTUP;
    if (elapsed < SLAP_STARTUP_MS + SLAP_ACTIVE_MS) return COMBAT_PHASE.ACTIVE;
    return COMBAT_PHASE.RECOVERY;
  }

  if (player.isPalmThrust) {
    const elapsed = (typeof simTime === "number" ? simTime : 0) - (player.attackStartTime || 0);
    if (player.isInStartupFrames || elapsed < PALM_THRUST_STARTUP_MS) {
      return COMBAT_PHASE.STARTUP;
    }
    if (elapsed < PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS) {
      return COMBAT_PHASE.ACTIVE;
    }
    return COMBAT_PHASE.RECOVERY;
  }

  if (player.isChargingAttack && !player.isAttacking) {
    return COMBAT_PHASE.STARTUP;
  }

  if (player.isAttacking && player.attackType === "charged" && !player.isPalmThrust) {
    const elapsed = (typeof simTime === "number" ? simTime : 0) - (player.attackStartTime || 0);
    if (player.isInStartupFrames || elapsed < CHARGED_STARTUP_MS) {
      return COMBAT_PHASE.STARTUP;
    }
    return COMBAT_PHASE.ACTIVE;
  }

  if (
    player.isRecovering &&
    (player.currentAction === "charged" || player.attackType === "charged")
  ) {
    return COMBAT_PHASE.RECOVERY;
  }

  if (player.isRecovering && player.currentAction === "slap") {
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

/**
 * Map fighter + phase → authored pose key, or null if unsupported.
 */
function resolveAuthoredPoseKey(player, simTime) {
  if (!player) {
    return { poseKey: null, support: SUPPORT.UNSUPPORTED, phase: COMBAT_PHASE.NEUTRAL, reason: "empty" };
  }

  if (player._phase3Crouch === true || player.isCrouchStance === true) {
    if (
      !player.isAttacking &&
      !player.isSlapAttack &&
      !player.isPalmThrust &&
      !player.isSidestepping &&
      !player.isChargingAttack
    ) {
      return {
        poseKey: "crouch",
        support: SUPPORT.SUPPORTED,
        phase: COMBAT_PHASE.NEUTRAL,
        reason: "crouch",
      };
    }
  }

  if (player.isSidestepping) {
    const phase = inferAuthoredPhase(player, simTime);
    if (phase === COMBAT_PHASE.STARTUP) {
      return { poseKey: "sidestep_startup", support: SUPPORT.SUPPORTED, phase, reason: "sidestep" };
    }
    if (phase === COMBAT_PHASE.PASS_THROUGH) {
      return { poseKey: "sidestep_active", support: SUPPORT.SUPPORTED, phase, reason: "sidestep" };
    }
    if (phase === COMBAT_PHASE.RECOVERY) {
      return { poseKey: "sidestep_recovery", support: SUPPORT.SUPPORTED, phase, reason: "sidestep" };
    }
  }

  if (player.isSlapAttack || (player.isAttacking && player.attackType === "slap")) {
    const phase = inferAuthoredPhase(player, simTime);
    if (phase === COMBAT_PHASE.STARTUP) {
      return { poseKey: "slap_startup", support: SUPPORT.SUPPORTED, phase, reason: "slap" };
    }
    if (phase === COMBAT_PHASE.ACTIVE) {
      return { poseKey: "slap_active", support: SUPPORT.SUPPORTED, phase, reason: "slap" };
    }
    return { poseKey: "slap_recovery", support: SUPPORT.SUPPORTED, phase: COMBAT_PHASE.RECOVERY, reason: "slap" };
  }

  if (player.isPalmThrust) {
    const phase = inferAuthoredPhase(player, simTime);
    if (phase === COMBAT_PHASE.STARTUP) {
      return { poseKey: "palm_startup", support: SUPPORT.SUPPORTED, phase, reason: "palm" };
    }
    if (phase === COMBAT_PHASE.ACTIVE) {
      return { poseKey: "palm_active", support: SUPPORT.SUPPORTED, phase, reason: "palm" };
    }
    return { poseKey: "palm_recovery", support: SUPPORT.SUPPORTED, phase: COMBAT_PHASE.RECOVERY, reason: "palm" };
  }

  if (player.isChargingAttack && !player.isAttacking) {
    return {
      poseKey: "charged_hold",
      support: SUPPORT.SUPPORTED,
      phase: COMBAT_PHASE.STARTUP,
      reason: "charged_hold",
    };
  }

  if (player.isAttacking && player.attackType === "charged" && !player.isPalmThrust) {
    const phase = inferAuthoredPhase(player, simTime);
    if (phase === COMBAT_PHASE.STARTUP) {
      return { poseKey: "charged_hold", support: SUPPORT.SUPPORTED, phase, reason: "charged_startup" };
    }
    return { poseKey: "charged_active", support: SUPPORT.SUPPORTED, phase: COMBAT_PHASE.ACTIVE, reason: "charged" };
  }

  if (
    player.isRecovering &&
    (player.currentAction === "charged" || player.attackType === "charged")
  ) {
    return {
      poseKey: "charged_recovery",
      support: SUPPORT.SUPPORTED,
      phase: COMBAT_PHASE.RECOVERY,
      reason: "charged_recovery",
    };
  }

  const phase = inferAuthoredPhase(player, simTime);
  if (
    phase === COMBAT_PHASE.NEUTRAL ||
    (phase === COMBAT_PHASE.RECOVERY && !player.isAttacking && !player.isSlapAttack)
  ) {
    // Post-slap recovery that cleared isSlapAttack → neutral (limb retracted).
    if (
      phase === COMBAT_PHASE.NEUTRAL ||
      (!player.isSlapAttack && !player.isPalmThrust && !player.isRecovering)
    ) {
      return { poseKey: "neutral", support: SUPPORT.SUPPORTED, phase: COMBAT_PHASE.NEUTRAL, reason: "neutral" };
    }
  }

  if (phase === COMBAT_PHASE.NEUTRAL) {
    return { poseKey: "neutral", support: SUPPORT.SUPPORTED, phase, reason: "neutral" };
  }

  return {
    poseKey: null,
    support: SUPPORT.UNSUPPORTED,
    phase,
    reason: `unsupported:${phase}`,
  };
}

function getPoseDefinition(poseKey) {
  if (!poseKey) return null;
  return AUTHORED.poses[poseKey] || null;
}

function resolveHalfW(spec, sizeMultiplier) {
  if (spec === "pushHalf") {
    return HITBOX_DISTANCE_VALUE * (sizeMultiplier || 1);
  }
  return spec;
}

/**
 * Authored variant key for a pose, read from authoritative sim state only
 * (never client pose hints). Returns null when the pose has no variants.
 */
function resolvePoseVariantKey(poseDef, player) {
  if (!poseDef || !poseDef.variants || !poseDef.variantKey) return null;
  const raw = player ? player[poseDef.variantKey] : undefined;
  const key = raw == null ? null : String(raw);
  if (key && poseDef.variants[key]) return key;
  const fallback = poseDef.variantDefault == null ? null : String(poseDef.variantDefault);
  return fallback && poseDef.variants[fallback] ? fallback : null;
}

/**
 * Base regions with the named variant's `regionOverrides` merged in by label.
 * Variants may only replace an existing authored region — never add one — so a
 * variant can't smuggle in a volume the base pose does not declare.
 */
function resolveVariantRegions(poseDef, variantKey) {
  if (!poseDef || !Array.isArray(poseDef.regions)) return [];
  const variant =
    variantKey && poseDef.variants ? poseDef.variants[variantKey] : null;
  const overrides = variant && Array.isArray(variant.regionOverrides)
    ? variant.regionOverrides
    : null;
  if (!overrides || overrides.length === 0) return poseDef.regions;
  return poseDef.regions.map((r) => {
    const o = overrides.find((v) => v.label === r.label);
    return o ? { ...r, ...o } : r;
  });
}

function materializeLocalRegions(poseDef, sizeMultiplier, variantKey) {
  if (!poseDef || !Array.isArray(poseDef.regions)) return [];
  const regions = resolveVariantRegions(poseDef, variantKey || null);
  const out = [];
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    out.push({
      kind: r.kind,
      label: r.label,
      region: r.region || r.label,
      forward: r.forward,
      up: r.up,
      halfW: resolveHalfW(r.halfW, sizeMultiplier),
      halfH: r.halfH,
      groundedOnly: !!r.groundedOnly,
      dashed: !!r.dashed,
      role: r.role || null,
    });
  }
  return out;
}

module.exports = {
  AUTHORED,
  SOURCE_AUTHORED,
  SOURCE_UNSUPPORTED,
  SUPPORT,
  getAuthoredCatalog,
  resolveMirrorFacing,
  inferAuthoredPhase,
  resolveAuthoredPoseKey,
  getPoseDefinition,
  resolvePoseVariantKey,
  resolveVariantRegions,
  materializeLocalRegions,
  HITBOX_DISTANCE_VALUE,
  GROUND_LEVEL,
};

/**
 * Phase 3 — client debug consumer of shared authored combat volumes.
 *
 * Source of truth: shared/combatVolumeAuthored.json
 * Catalog must be bound before use:
 *   - Vite: import ./combatVolumeAuthoredViteBind (side-effect)
 *   - Node tests: bindAuthoredCatalog(createRequire(...)(jsonPath))
 *
 * NEVER combat authority. DEV/debug overlay only.
 *
 * Overlay roots prefer GameFighter renderX/renderY (sprite CSS box) so
 * authored volumes share the fighter's stage anchor. Shape data stays in JSON.
 */

import {
  resolveDebugVolumeRoot,
  resolveStrikeLifecycleDebug,
} from "./combatVolumeDebug.js";
import {
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
} from "../config/combatTiming.js";

const DESIGN_W = 1280;
const DESIGN_H = 720;
const GROUND_LEVEL = 286;

const COMBAT_VOLUME_KIND = Object.freeze({
  PUSH: "PUSH",
  HURT_BODY: "HURT_BODY",
  HURT_LIMB: "HURT_LIMB",
  HIT: "HIT",
  GRAB: "GRAB",
  LANDING: "LANDING",
});

const COMBAT_VOLUME_DEBUG_COLOR = Object.freeze({
  PUSH: "#2196f3",
  HURT_BODY: "#4caf50",
  HURT_LIMB: "#a5d6a7",
  HIT: "#f44336",
  GRAB: "#ffeb3b",
  LANDING: "#00bcd4",
});

/** @type {object|null} */
let authored = null;

/**
 * Bind the shared JSON catalog (Vite adapter or test inject).
 * @param {object} catalog
 */
export function bindAuthoredCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error(
      "[combatVolumeAuthoredClient] bindAuthoredCatalog requires the shared catalog object"
    );
  }
  if (catalog.version == null || !catalog.poses || typeof catalog.poses !== "object") {
    throw new Error(
      "[combatVolumeAuthoredClient] catalog missing version/poses — wrong module contract?"
    );
  }
  authored = catalog;
}

/** Test helper — clear bind so missing-bind failures stay honest. */
export function unbindAuthoredCatalogForTests() {
  authored = null;
}

export function getAuthoredCatalog() {
  if (!authored) {
    throw new Error(
      "[combatVolumeAuthoredClient] catalog not bound (import combatVolumeAuthoredViteBind in Vite, or bindAuthoredCatalog in tests)"
    );
  }
  return authored;
}

function pushHalfBase() {
  return getAuthoredCatalog().meta?.pushHalfBase || 65;
}

function resolveMirrorFacing(f) {
  if (!f) return 1;
  if (f.isSlapAttack && (f.slapFacingDirection === 1 || f.slapFacingDirection === -1)) {
    return f.slapFacingDirection;
  }
  if (
    (f.isPalmThrust || f.isChargingAttack || f.attackType === "charged") &&
    (f.chargingFacingDirection === 1 || f.chargingFacingDirection === -1)
  ) {
    return f.chargingFacingDirection;
  }
  return f.facing === 1 || f.facing === -1 ? f.facing : 1;
}

// Mirrored server slap/palm clocks (combatTiming) for local phase when hints exist.
const PALM_STARTUP_MS = PALM_THRUST_STARTUP_MS;
const PALM_ACTIVE_MS = PALM_THRUST_ACTIVE_MS;
const CHARGED_STARTUP_MS = 150;

function attackDir(facing) {
  return facing === 1 ? -1 : 1;
}

function localToWorld(forward, up, halfW, halfH, rootX, rootY, facing) {
  const dir = attackDir(facing);
  const cx = rootX + dir * forward;
  const cy = rootY + up;
  return {
    left: cx - halfW,
    right: cx + halfW,
    bottom: cy - halfH,
    top: cy + halfH,
  };
}

function resolveHalfW(spec, sizeMult) {
  if (spec === "pushHalf") return pushHalfBase() * (sizeMult || 1);
  return spec;
}

/**
 * Resolve pose key from the same lifecycle snapshot as HIT policy.
 * Explicit recovery always beats pose-director active hints.
 */
export function resolveClientAuthoredPoseKey(fighter) {
  if (!fighter) {
    return { poseKey: null, support: "unsupported", phase: "neutral" };
  }

  if (
    (fighter._phase3Crouch || fighter.isCrouchStance) &&
    !fighter.isAttacking &&
    !fighter.isSlapAttack &&
    !fighter.isPalmThrust &&
    !fighter.isSidestepping &&
    !fighter.isChargingAttack
  ) {
    return { poseKey: "crouch", support: "supported", phase: "neutral" };
  }

  if (fighter.isSidestepping) {
    if (fighter.isSidestepStartup) {
      return { poseKey: "sidestep_startup", support: "supported", phase: "startup" };
    }
    if (fighter.isSidestepRecovery) {
      return { poseKey: "sidestep_recovery", support: "supported", phase: "recovery" };
    }
    return { poseKey: "sidestep_active", support: "supported", phase: "pass_through" };
  }

  const life = resolveStrikeLifecycleDebug(fighter);
  return {
    poseKey: life.poseKey,
    support: life.support,
    phase: life.phase,
    source: life.source,
    move: life.move,
    exact: life.exact,
    identitySource: life.identitySource ?? null,
  };
}

/**
 * Region list for a pose, with any per-variant overrides applied.
 *
 * Mirrors the server's resolveVariantRegions (combatVolumeDefs.js). `slap_active`
 * authors one `frontArm` per slap animation because the two hit frames genuinely
 * draw different arm lengths — without this the overlay would draw the shorter
 * fallback box on slap-2 frames and read as if authority were under-reaching.
 * An unknown variant falls back to the base (shorter) regions, same as authority.
 */
export function resolveAuthoredPoseRegions(pose, fighter) {
  if (!pose || !Array.isArray(pose.regions)) return [];
  if (!pose.variants || !pose.variantKey) return pose.regions;
  const raw = fighter ? fighter[pose.variantKey] : undefined;
  const key = raw == null ? null : String(raw);
  const variant =
    (key && pose.variants[key]) ||
    (pose.variantDefault != null
      ? pose.variants[String(pose.variantDefault)]
      : null);
  const overrides =
    variant && Array.isArray(variant.regionOverrides)
      ? variant.regionOverrides
      : null;
  if (!overrides || overrides.length === 0) return pose.regions;
  return pose.regions.map((r) => {
    const o = overrides.find((v) => v.label === r.label);
    return o ? { ...r, ...o } : r;
  });
}

/**
 * Derive authored debug volumes for overlay. Returns [] when unsupported/uncertain.
 */
export function deriveAuthoredDebugVolumes(fighter) {
  if (!fighter || typeof fighter.x !== "number") return [];
  const catalog = getAuthoredCatalog();
  const resolved = resolveClientAuthoredPoseKey(fighter);
  if (resolved.support !== "supported" || !resolved.poseKey) {
    return [];
  }
  const pose = catalog.poses[resolved.poseKey];
  if (!pose) return [];

  const { rootX, rootY, simY } = resolveDebugVolumeRoot(fighter);
  const size =
    typeof fighter.sizeMult === "number"
      ? fighter.sizeMult
      : typeof fighter.sizeMultiplier === "number"
        ? fighter.sizeMultiplier
        : 1;
  const mirror = resolveMirrorFacing(fighter);
  const volumes = [];
  // Grounded-only regions stay on the sim ground plane (not pose visual lift).
  const groundAnchorY = GROUND_LEVEL + (rootY - simY);

  const regions = resolveAuthoredPoseRegions(pose, fighter);
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    if (r.groundedOnly && simY < GROUND_LEVEL - 2) continue;
    // Hard invariant: recovery/startup/uncertain never emit HIT, even if a
    // pose table row were mis-authored.
    if (
      r.kind === COMBAT_VOLUME_KIND.HIT &&
      resolved.phase !== "active"
    ) {
      continue;
    }
    const halfW = resolveHalfW(r.halfW, size);
    const aabb = localToWorld(
      r.forward,
      r.up,
      halfW,
      r.halfH,
      rootX,
      r.groundedOnly ? groundAnchorY : rootY,
      mirror
    );
    volumes.push({
      kind: r.kind,
      color: COMBAT_VOLUME_DEBUG_COLOR[r.kind] || "#fff",
      aabb,
      dashed: !!r.dashed || (resolved.poseKey === "sidestep_active" && r.kind === "PUSH"),
      label: r.label,
      region: r.region || r.label,
      exact: r.kind !== COMBAT_VOLUME_KIND.HIT || resolved.phase === "active",
      poseKey: resolved.poseKey,
      role: r.role || null,
      source: "phase3_authored",
      lifecycleSource: resolved.source || null,
    });
  }
  return volumes;
}

export function formatAuthoredPoseDebugLine(fighter, label) {
  const r = resolveClientAuthoredPoseKey(fighter);
  if (!r.poseKey && r.support === "unsupported") {
    return `${label} authored=UNSUPPORTED phase=${r.phase}`;
  }
  return `${label} authored=${r.poseKey} phase=${r.phase}`;
}

// Re-export timing constants for tests (documentation only — clocks live on server).
export const CLIENT_AUTHORED_CLOCKS = Object.freeze({
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  PALM_STARTUP_MS,
  PALM_ACTIVE_MS,
  CHARGED_STARTUP_MS,
  DESIGN_W,
  DESIGN_H,
});

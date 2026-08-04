/**
 * Combat fidelity debug helpers — DISABLED BY DEFAULT.
 *
 * HARD PRODUCTION GATE: import.meta.env.DEV (Vite). In production builds every
 * public entry returns false / no-ops BEFORE localStorage, geometry, arrays,
 * or debug DOM. See isCombatFidelityDebugAvailable().
 *
 * Enable in the browser console (dev only) before match load:
 *   localStorage.setItem("pumo_combat_fidelity_debug", "1")
 * Disable:
 *   localStorage.removeItem("pumo_combat_fidelity_debug")
 *
 * Phase 1 diagnostic combat volumes (derived locally — NOT on the network):
 *   localStorage.setItem("pumo_combat_volumes_debug", "1")  // default ON when fidelity debug is on
 *   localStorage.setItem("pumo_combat_volumes_debug", "0")  // force off
 *
 * Aerial landing one-jump client snapshot (optional):
 *   localStorage.setItem("pumo_landing_trace", "1")
 *   then trigger a rope jump — dumps one structured record to the console.
 *
 * Server landing diagnostics are NOT on the production PvP delta wire.
 * Enable server-side with LANDING_DEBUG_NET=1 (or LANDING_TRACE=1) so
 * diagnostic fields / `landing_diag` events reach the client for overlays.
 *
 * Does not alter gameplay, balance, or simulation authority.
 * Prefer server-authored half-widths / landing fields when present.
 *
 * See COMBAT_FIDELITY_AUDIT.md / PREMIUM_COMBAT_FOUNDATION_AUDIT.md.
 */

import { getLastPlacementDebug } from "../combatPresentation/placement";
import { getPoseGeometryDebugSnapshot } from "../poseGeometry";
import { getLastClientInputCommandResult } from "./inputCommandTrace";
import {
  deriveDebugCombatVolumes,
  formatStrikePhaseDebugLine,
  renderVolumeBoxesHtml,
  renderAnchorMarkersHtml,
  resolveDebugVolumeRoot,
  resolveMirrorFacing,
  getFighterRenderAnchor,
  clearLocalStrikePhaseHints,
  getStruckLimbHoldDebugLines,
} from "./combatVolumeDebug";
// Vite JSON→ESM bind for shared authored defs (must precede derive helpers).
import "./combatVolumeAuthoredViteBind";
import {
  deriveAuthoredDebugVolumes,
  formatAuthoredPoseDebugLine,
} from "./combatVolumeAuthoredClient";
import {
  formatSlapHurtHudLines,
  LAST_COMMITTED_FRESH_MS,
  readAuthoredSlapHurtboxHudFlag,
} from "./slapHurtDebugHud";

/**
 * Hard gate — Vite `import.meta.env.DEV`.
 * Production path must never read debug localStorage or build overlay geometry.
 * Location: client/src/debug/CombatFidelityDebug.js (this constant + every export).
 */
const IS_DEV_BUILD =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV === true;

const FLAG_KEY = "pumo_combat_fidelity_debug";
const VOLUMES_FLAG_KEY = "pumo_combat_volumes_debug";
/** Phase 3 authored shadow volumes (default OFF — opt-in). */
const SHADOW_VOLUMES_FLAG_KEY = "pumo_combat_volume_shadow";
const LANDING_TRACE_KEY = "pumo_landing_trace";
/** Optional console dump when a slide-jump / FLAP flight ends (client view). */
const AERIAL_TRACE_KEY = "pumo_offensive_aerial_trace";
const INPUT_TRACE_KEY = "pumo_input_command_trace";
/** Fallback only — must match server-io/constants.js HITBOX_DISTANCE_VALUE */
const HITBOX_HALF_FALLBACK = 65;
const DESIGN_W = 1280;
const DESIGN_H = 720;
/**
 * HUD-only throttle when combat volumes are off.
 * When volumes are ON, paint every caller frame so world geometry cannot lag
 * an earlier combat phase behind throttled diagnostic text.
 */
const HUD_MIN_INTERVAL_MS = 100;

/** Screen-space HUD (body) — readable, not camera-transformed. */
let hudEl = null;
/**
 * World-space volume/anchor layer — MUST mount under `.game-actors` so it
 * inherits the same `--cam-*` transform (+ app zoom) as the wrestlers.
 * Mounting on document.body was the Phase 3 vertical misalignment root cause.
 */
let worldEl = null;
let lastContact = null;
let landingTraceArmed = false;
let lastLandingTraceKey = null;
/** Latest server `landing_diag` payload (debug-net only). */
let lastLandingDiag = null;
let lastOverlayPaintMs = 0;
let lastHudHtml = "";
let lastWorldHtml = "";

// Cache localStorage flags — getItem every RAF (60Hz+) is measurable main-thread cost.
// Never populated in production (IS_DEV_BUILD gate).
let cachedFidelityEnabled = null;
let cachedVolumesEnabled = null;
let cachedShadowVolumesEnabled = null;
let cachedLandingTraceEnabled = null;
let cachedAerialTraceEnabled = null;
let cachedInputTraceEnabled = null;

function readFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function readVolumesFlag() {
  try {
    const v = localStorage.getItem(VOLUMES_FLAG_KEY);
    if (v === "0" || v === "false") return false;
    if (v === "1" || v === "true") return true;
    // Default ON whenever fidelity debug is on (no extra network cost).
    return true;
  } catch {
    return true;
  }
}

function refreshCachedFlags() {
  if (!IS_DEV_BUILD) {
    cachedFidelityEnabled = false;
    cachedVolumesEnabled = false;
    cachedShadowVolumesEnabled = false;
    cachedLandingTraceEnabled = false;
    cachedAerialTraceEnabled = false;
    cachedInputTraceEnabled = false;
    return;
  }
  cachedFidelityEnabled = readFlag(FLAG_KEY);
  cachedVolumesEnabled = readVolumesFlag();
  cachedShadowVolumesEnabled = readFlag(SHADOW_VOLUMES_FLAG_KEY);
  cachedLandingTraceEnabled = readFlag(LANDING_TRACE_KEY);
  cachedAerialTraceEnabled = readFlag(AERIAL_TRACE_KEY);
  cachedInputTraceEnabled = readFlag(INPUT_TRACE_KEY);
}

// DEV only: localStorage cache + cross-tab sync. Production never registers.
if (IS_DEV_BUILD && typeof window !== "undefined") {
  refreshCachedFlags();
  window.addEventListener("storage", (e) => {
    if (
      !e.key ||
      e.key === FLAG_KEY ||
      e.key === VOLUMES_FLAG_KEY ||
      e.key === SHADOW_VOLUMES_FLAG_KEY ||
      e.key === LANDING_TRACE_KEY ||
      e.key === AERIAL_TRACE_KEY ||
      e.key === INPUT_TRACE_KEY
    ) {
      refreshCachedFlags();
    }
  });
}

/** True only in Vite DEV builds — hard production gate. */
export function isCombatFidelityDebugAvailable() {
  return IS_DEV_BUILD;
}

function isCombatVolumesDebugEnabled() {
  if (!IS_DEV_BUILD) return false;
  if (!isCombatFidelityDebugEnabled()) return false;
  if (cachedVolumesEnabled == null) refreshCachedFlags();
  return !!cachedVolumesEnabled;
}

/** Phase 3 authored shadow overlay (opt-in; default OFF). */
function isCombatVolumeShadowOverlayEnabled() {
  if (!IS_DEV_BUILD) return false;
  if (!isCombatVolumesDebugEnabled()) return false;
  if (cachedShadowVolumesEnabled == null) refreshCachedFlags();
  return !!cachedShadowVolumesEnabled;
}

export function isCombatFidelityDebugEnabled() {
  if (!IS_DEV_BUILD) return false;
  if (cachedFidelityEnabled == null) refreshCachedFlags();
  return !!cachedFidelityEnabled;
}

/** Cheap gate for RAF callers — avoid building overlay payloads every frame. */
export function shouldUpdateCombatFidelityOverlay() {
  // Hard production gate first — no localStorage, no timers, no geometry.
  if (!IS_DEV_BUILD) return false;
  if (!isCombatFidelityDebugEnabled()) return false;
  if (typeof document !== "undefined" && document.hidden) return false;
  // Volumes enabled → phase-honest every gameplay frame. HUD-only → throttle.
  if (isCombatVolumesDebugEnabled()) return true;
  return performance.now() - lastOverlayPaintMs >= HUD_MIN_INTERVAL_MS;
}

function isLandingTraceEnabled() {
  if (!IS_DEV_BUILD) return false;
  if (cachedLandingTraceEnabled == null) refreshCachedFlags();
  return !!cachedLandingTraceEnabled;
}

function isOffensiveAerialTraceEnabled() {
  if (!IS_DEV_BUILD) return false;
  if (cachedAerialTraceEnabled == null) refreshCachedFlags();
  return !!cachedAerialTraceEnabled;
}

function setCachedFlag(key, enabled) {
  if (!IS_DEV_BUILD) return;
  try {
    if (enabled) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  refreshCachedFlags();
}

function classifyOffensiveAerial(fighter) {
  if (!fighter?.isSlideJumping && !fighter?.offensiveAerial) return null;
  const phase = fighter.slideJumpPhase || (fighter.offensiveAerial ? "post" : "flight");
  const contract = fighter.offensiveAerial || null;
  let outcome = contract?.outcome || "in_flight";
  if (!contract) {
    if (fighter.slideJumpHitLanded) outcome = "hit_latched";
    else if (phase === "landing") outcome = "whiff_or_post_hit_landing";
  }
  if (fighter.slideJumpDiveCommitted && outcome === "in_flight") {
    outcome = `dive:${outcome}`;
  }
  return {
    move: fighter.slideJumpFlapFlightActive
      ? "flap_flight"
      : fighter.isSlideJumping
        ? "slide_jump"
        : contract?.moveType || "none",
    phase,
    attackActive:
      !!fighter.isSlideJumping &&
      phase === "flight" &&
      !fighter.slideJumpHitLanded &&
      !contract?.contactConsumed &&
      ((fighter.slideJumpVelocityY ?? 0) <= 0 || !!fighter.slideJumpDiveCommitted),
    attackLatch: !!fighter.slideJumpHitLanded,
    dive: !!fighter.slideJumpDiveCommitted,
    flapFlight: !!fighter.slideJumpFlapFlightActive,
    flapCharges: fighter.flapCharges ?? 0,
    outcome,
    attackInstanceId: contract?.attackInstanceId || null,
    resolved: !!contract?.resolved,
    contactConsumed: !!contract?.contactConsumed,
    cleanupStage: contract?.cleanupStage || null,
    movementOwner: contract?.movementOwner || null,
    landingHandoffReason: contract?.landingHandoffReason || null,
    contactX: contract?.contactX ?? null,
    contactY: contract?.contactY ?? null,
    contactNormalX: contract?.contactNormalX ?? null,
    contactNormalY: contract?.contactNormalY ?? null,
    contactAxis: contract?.contactAxis || null,
    reactionType: fighter.offensiveAerialReactionType || null,
    recoveryLock: fighter.actionLockUntil || 0,
  };
}

export function noteCombatContactEvent(data) {
  if (!IS_DEV_BUILD || !isCombatFidelityDebugEnabled() || !data) return;
  lastContact = {
    contactX: typeof data.contactX === "number" ? data.contactX : null,
    contactY: typeof data.contactY === "number" ? data.contactY : null,
    attackerX: typeof data.attackerX === "number" ? data.attackerX : null,
    victimX: typeof data.x === "number" ? data.x : null,
    attackType: data.attackType || null,
    victimHurtRegion: data.victimHurtRegion || null,
    victimHurtKind: data.victimHurtKind || null,
    authoredSlapHurtboxV1: !!data.authoredSlapHurtboxV1,
    victimSlapPoseKey: data.victimSlapPoseKey || null,
    victimSlapPhase: data.victimSlapPhase || null,
    victimSlapMirrorFacing:
      data.victimSlapMirrorFacing === 1 || data.victimSlapMirrorFacing === -1
        ? data.victimSlapMirrorFacing
        : null,
    // Phase 4B generic limb identity — carries palm as well as slap.
    victimLimbFamily: data.victimLimbFamily || null,
    victimLimbPoseKey: data.victimLimbPoseKey || null,
    victimLimbPhase: data.victimLimbPhase || null,
    victimLimbVariant:
      data.victimLimbVariant != null ? String(data.victimLimbVariant) : null,
    victimLimbMirrorFacing:
      data.victimLimbMirrorFacing === 1 || data.victimLimbMirrorFacing === -1
        ? data.victimLimbMirrorFacing
        : null,
    limbOnlyContact: data.limbOnlyContact === true,
    isPunish: !!data.isPunish,
    isCounterHit: !!data.isCounterHit,
    // Wall-clock stamp for LAST COMMITTED age / EXPIRED labeling only.
    t: performance.now(),
    label: "LAST_COMMITTED",
  };
}

/** Ingest a server `landing_diag` packet (emitted only when LANDING_DEBUG_NET). */
export function noteLandingDiag(data) {
  if (!IS_DEV_BUILD || !data) return;
  lastLandingDiag = { ...data, t: performance.now() };
}

function teardownDebugLayers() {
  if (hudEl) {
    hudEl.remove();
    hudEl = null;
  }
  if (worldEl) {
    worldEl.remove();
    worldEl = null;
  }
  // Belt-and-suspenders: remove by id if a prior host unmount orphaned refs.
  if (typeof document !== "undefined") {
    document.getElementById("pumo-combat-fidelity-debug")?.remove();
    document.getElementById("pumo-combat-volume-world")?.remove();
  }
  lastHudHtml = "";
  lastWorldHtml = "";
  // Debug lifecycle boundary — drop strike-identity latches + director hints.
  clearLocalStrikePhaseHints();
}

function ensureHudOverlay() {
  if (!IS_DEV_BUILD || typeof document === "undefined") return null;
  if (hudEl && hudEl.isConnected) return hudEl;
  hudEl = document.createElement("div");
  hudEl.id = "pumo-combat-fidelity-debug";
  hudEl.style.cssText = [
    "position:fixed",
    "inset:0",
    "pointer-events:none",
    "z-index:99999",
    "font:11px/1.35 monospace",
    "color:#b8f5c8",
    "text-shadow:0 1px 2px #000",
  ].join(";");
  document.body.appendChild(hudEl);
  return hudEl;
}

function ensureWorldOverlay() {
  if (!IS_DEV_BUILD || typeof document === "undefined") return null;
  if (worldEl && worldEl.isConnected) return worldEl;
  const host = document.querySelector(".game-actors");
  if (!host) return null;
  worldEl = document.createElement("div");
  worldEl.id = "pumo-combat-volume-world";
  worldEl.setAttribute("data-combat-volume-world", "1");
  worldEl.style.cssText = [
    "position:absolute",
    "inset:0",
    "pointer-events:none",
    "z-index:50",
    "overflow:visible",
  ].join(";");
  host.appendChild(worldEl);
  return worldEl;
}

function halfWidthFor(fighter) {
  if (!fighter) return HITBOX_HALF_FALLBACK;
  if (typeof fighter.pushboxHalfWidth === "number") return fighter.pushboxHalfWidth;
  const mult =
    typeof fighter.sizeMult === "number"
      ? fighter.sizeMult
      : typeof fighter.sizeMultiplier === "number"
        ? fighter.sizeMultiplier
        : 1;
  return HITBOX_HALF_FALLBACK * (mult || 1);
}

function fighterBox(fighter, label, color) {
  if (!fighter || typeof fighter.x !== "number") return "";
  const half = halfWidthFor(fighter);
  const { rootX, rootY } = resolveDebugVolumeRoot(fighter);
  const leftPct = (rootX / DESIGN_W) * 100;
  const bottomPct = (rootY / DESIGN_H) * 100;
  const halfPct = (half / DESIGN_W) * 100;
  const mult = fighter.sizeMult ?? fighter.sizeMultiplier ?? 1;
  return `
    <div style="position:absolute;left:${leftPct}%;bottom:${bottomPct}%;transform:translateX(-50%);text-align:center;color:${color};pointer-events:none">
      <div style="width:2px;height:120px;margin:0 auto;background:${color};transform:translateY(-100%)"></div>
      <div style="position:absolute;left:50%;bottom:0;width:${halfPct * 2}%;height:28px;border:1px solid ${color};transform:translateX(-50%);opacity:0.85;box-sizing:border-box"></div>
      <div style="position:absolute;left:50%;bottom:130px;transform:translateX(-50%);white-space:nowrap;font:10px/1.2 monospace;text-shadow:0 1px 2px #000">${label} x=${Math.round(rootX)} y=${Math.round(rootY)}</div>
      <div style="position:absolute;left:50%;bottom:116px;transform:translateX(-50%);white-space:nowrap;opacity:0.85;font:10px/1 monospace">size=${Number(mult).toFixed(2)} half=${half.toFixed(1)}</div>
    </div>`;
}

function sideLabel(side) {
  if (side === 1) return "right(+1)";
  if (side === -1) return "left(-1)";
  return String(side ?? "—");
}

function maybeEmitLandingTrace(state) {
  if (!isLandingTraceEnabled()) return;
  const jumper =
    state?.p1?.ropeJumpPhase && state.p1.ropeJumpPhase !== null
      ? state.p1
      : state?.p2?.ropeJumpPhase && state.p2.ropeJumpPhase !== null
        ? state.p2
        : null;
  if (!jumper) {
    landingTraceArmed = false;
    return;
  }
  if (jumper.ropeJumpPhase === "active" || jumper.ropeJumpPhase === "startup") {
    landingTraceArmed = true;
  }
  if (!landingTraceArmed || jumper.ropeJumpPhase !== "landing") return;

  const key = `${jumper.ropeJumpTouchdownX}|${jumper.ropeJumpRawTargetX}|${jumper.ropeJumpLandingPath}`;
  if (key === lastLandingTraceKey) return;
  lastLandingTraceKey = key;
  landingTraceArmed = false;

  const diag =
    lastLandingDiag && performance.now() - lastLandingDiag.t < 5000
      ? lastLandingDiag
      : null;
  const record = {
    path: jumper.ropeJumpLandingPath || diag?.path || "unknown",
    phase: jumper.ropeJumpPhase,
    rawTargetX: jumper.ropeJumpRawTargetX ?? diag?.rawTargetX,
    resolvedTargetX: jumper.ropeJumpResolvedTargetX ?? diag?.resolvedTargetX,
    commitX: jumper.ropeJumpLandingCommitX ?? diag?.commitX,
    commitT: jumper.ropeJumpLandingCommitT ?? diag?.commitT,
    committed: !!jumper.ropeJumpLandingCommitted,
    preferredSide: jumper.ropeJumpPreferredSide ?? diag?.preferredSide,
    resolvedSide: jumper.ropeJumpResolvedSide ?? diag?.resolvedSide,
    minDistance: jumper.ropeJumpMinDistance ?? diag?.minDistance,
    centerDistance: jumper.ropeJumpCenterDistance ?? diag?.centerDistance,
    overlap: jumper.ropeJumpOverlap ?? diag?.overlap,
    preTouchdownX: jumper.ropeJumpPreTouchdownX ?? diag?.preTouchdownX,
    touchdownX: jumper.ropeJumpTouchdownX ?? diag?.touchdownX,
    safetyCorrectionPx:
      jumper.ropeJumpSafetyCorrectionPx ?? diag?.safetyCorrectionPx,
    usedFallback: jumper.ropeJumpUsedFallback ?? diag?.usedFallback,
    trajectoryType: jumper.ropeJumpTrajectoryType ?? diag?.trajectoryType,
    decisionClass: jumper.ropeJumpDecisionClass ?? diag?.decisionClass,
    fallbackReason: jumper.ropeJumpFallbackReason ?? diag?.fallbackReason,
    horizVel: jumper.ropeJumpHorizVel ?? diag?.horizVel,
    rawExpectedVel: jumper.ropeJumpRawExpectedVel ?? diag?.rawExpectedVel,
    peakVel: jumper.ropeJumpPeakVel ?? diag?.peakVel,
    reversalDetected: jumper.ropeJumpReversalDetected ?? diag?.reversalDetected,
    planningState: jumper.ropeJumpPlanningState ?? diag?.planningState,
    firstRawConflictT: jumper.ropeJumpFirstRawConflictT ?? diag?.firstRawConflictT,
    sideLockTick: jumper.ropeJumpSideLockTick ?? diag?.sideLockTick,
    sideLockReason: jumper.ropeJumpSideLockReason ?? diag?.sideLockReason,
    noReturnDeadlineT: jumper.ropeJumpNoReturnDeadlineT ?? diag?.noReturnDeadlineT,
    conflictBeforeDeadline:
      jumper.ropeJumpConflictBeforeDeadline ?? diag?.conflictBeforeDeadline,
    endpointCommitTick:
      jumper.ropeJumpEndpointCommitTick ?? diag?.endpointCommitTick,
    lateIntrusion: jumper.ropeJumpLateIntrusion ?? diag?.lateIntrusion,
    lateIntrusionClass:
      jumper.ropeJumpLateIntrusionClass ?? diag?.lateIntrusionClass,
    safetyCorrectionTicks:
      jumper.ropeJumpSafetyCorrectionTicks ?? diag?.safetyCorrectionTicks,
    settleState: jumper.ropeJumpSettleState ?? diag?.settleState,
    sidePolicy: jumper.ropeJumpSidePolicy ?? diag?.sidePolicy,
    settleInitialOverlap:
      jumper.ropeJumpSettleInitialOverlap ?? diag?.settleInitialOverlap,
    settleMaxOverlap: jumper.ropeJumpSettleMaxOverlap ?? diag?.settleMaxOverlap,
    settleAccumulatedPx:
      jumper.ropeJumpSettleAccumulatedPx ?? diag?.settleAccumulatedPx,
    overlapIncreased: jumper.ropeJumpOverlapIncreased ?? diag?.overlapIncreased,
    budgetException: jumper.ropeJumpBudgetException ?? diag?.budgetException,
    budgetExceptionClass:
      jumper.ropeJumpBudgetExceptionClass ?? diag?.budgetExceptionClass,
    jumperX: jumper.x,
    sizeMult: jumper.sizeMult ?? jumper.sizeMultiplier,
  };
  // One structured dump per landing — not a per-frame flood.
  console.log("[PUMO_LANDING_TRACE]", record);
}

/**
 * Call once per frame from a fighter/game render path.
 * Prefer per-fighter size multipliers and server landing diagnostic fields.
 *
 * @param {{
 *   p1?: object,
 *   p2?: object,
 *   p1x?: number, p1y?: number, p2x?: number, p2y?: number,
 *   sizeMult?: number,
 *   p1SizeMult?: number,
 *   p2SizeMult?: number,
 * }} state
 */
export function renderCombatFidelityOverlay(state) {
  // Hard production gate first — no localStorage, geometry, arrays, or DOM.
  if (!IS_DEV_BUILD) return;
  if (!isCombatFidelityDebugEnabled()) {
    if (hudEl || worldEl) {
      teardownDebugLayers();
      lastOverlayPaintMs = 0;
    }
    return;
  }
  // Never do expensive overlay work in a background tab.
  if (typeof document !== "undefined" && document.hidden) return;

  const nowMs = performance.now();
  const volumesWanted = isCombatVolumesDebugEnabled();
  // When volumes are on, never skip a snapshot for throttle reasons.
  if (!volumesWanted && nowMs - lastOverlayPaintMs < HUD_MIN_INTERVAL_MS) {
    return;
  }

  const hud = ensureHudOverlay();
  const world = ensureWorldOverlay();
  if (!hud || !state) return;

  const mergeAnchor = (fighter, slotKey) => {
    if (!fighter) return fighter;
    const a = getFighterRenderAnchor(slotKey);
    if (!a) return fighter;
    return {
      ...fighter,
      renderX: a.renderX,
      renderY: a.renderY,
      soleFromBottomPct: a.soleFromBottomPct,
      // Keep sim x/y for grounded checks; prefer live anchor sim when fresher.
      x: typeof a.simX === "number" ? a.simX : fighter.x,
      y: typeof a.simY === "number" ? a.simY : fighter.y,
    };
  };

  const p1 = mergeAnchor(
    state.p1 || {
      x: state.p1x || 0,
      y: state.p1y || 0,
      sizeMult: state.p1SizeMult ?? state.sizeMult ?? 1,
    },
    "player 1"
  );
  const p2 = mergeAnchor(
    state.p2 || {
      x: state.p2x || 0,
      y: state.p2y || 0,
      sizeMult: state.p2SizeMult ?? 1,
    },
    "player 2"
  );

  maybeEmitLandingTrace({ p1, p2 });

  const half1 = halfWidthFor(p1);
  const half2 = halfWidthFor(p2);
  const gap = Math.abs((p1.x || 0) - (p2.x || 0));
  const minDist = half1 + half2;
  const overlap = Math.max(0, minDist - gap);

  const jumper =
    p1.ropeJumpPhase ? p1 : p2.ropeJumpPhase ? p2 : null;
  const diag =
    lastLandingDiag && performance.now() - lastLandingDiag.t < 8000
      ? lastLandingDiag
      : null;
  const j = jumper
    ? {
        ...jumper,
        ropeJumpLandingPath: jumper.ropeJumpLandingPath ?? diag?.path,
        ropeJumpRawTargetX: jumper.ropeJumpRawTargetX ?? diag?.rawTargetX,
        ropeJumpResolvedTargetX:
          jumper.ropeJumpResolvedTargetX ?? diag?.resolvedTargetX,
        ropeJumpLandingCommitX: jumper.ropeJumpLandingCommitX ?? diag?.commitX,
        ropeJumpLandingCommitT: jumper.ropeJumpLandingCommitT ?? diag?.commitT,
        ropeJumpPreferredSide: jumper.ropeJumpPreferredSide ?? diag?.preferredSide,
        ropeJumpResolvedSide: jumper.ropeJumpResolvedSide ?? diag?.resolvedSide,
        ropeJumpMinDistance: jumper.ropeJumpMinDistance ?? diag?.minDistance,
        ropeJumpCenterDistance:
          jumper.ropeJumpCenterDistance ?? diag?.centerDistance,
        ropeJumpOverlap: jumper.ropeJumpOverlap ?? diag?.overlap,
        ropeJumpSafetyCorrectionPx:
          jumper.ropeJumpSafetyCorrectionPx ?? diag?.safetyCorrectionPx,
        ropeJumpPreTouchdownX:
          jumper.ropeJumpPreTouchdownX ?? diag?.preTouchdownX,
        ropeJumpTouchdownX: jumper.ropeJumpTouchdownX ?? diag?.touchdownX,
        ropeJumpUsedFallback: jumper.ropeJumpUsedFallback ?? diag?.usedFallback,
        ropeJumpTrajectoryType:
          jumper.ropeJumpTrajectoryType ?? diag?.trajectoryType,
        ropeJumpDecisionClass:
          jumper.ropeJumpDecisionClass ?? diag?.decisionClass,
        ropeJumpFallbackReason:
          jumper.ropeJumpFallbackReason ?? diag?.fallbackReason,
        ropeJumpHorizVel: jumper.ropeJumpHorizVel ?? diag?.horizVel,
        ropeJumpRawExpectedVel:
          jumper.ropeJumpRawExpectedVel ?? diag?.rawExpectedVel,
        ropeJumpPeakVel: jumper.ropeJumpPeakVel ?? diag?.peakVel,
        ropeJumpReversalDetected:
          jumper.ropeJumpReversalDetected ?? diag?.reversalDetected,
        ropeJumpPlanningState:
          jumper.ropeJumpPlanningState ?? diag?.planningState,
        ropeJumpFirstRawConflictT:
          jumper.ropeJumpFirstRawConflictT ?? diag?.firstRawConflictT,
        ropeJumpSideLockReason:
          jumper.ropeJumpSideLockReason ?? diag?.sideLockReason,
        ropeJumpNoReturnDeadlineT:
          jumper.ropeJumpNoReturnDeadlineT ?? diag?.noReturnDeadlineT,
        ropeJumpConflictBeforeDeadline:
          jumper.ropeJumpConflictBeforeDeadline ?? diag?.conflictBeforeDeadline,
        ropeJumpLateIntrusion:
          jumper.ropeJumpLateIntrusion ?? diag?.lateIntrusion,
        ropeJumpLateIntrusionClass:
          jumper.ropeJumpLateIntrusionClass ?? diag?.lateIntrusionClass,
        ropeJumpSafetyCorrectionTicks:
          jumper.ropeJumpSafetyCorrectionTicks ?? diag?.safetyCorrectionTicks,
        ropeJumpSettleState: jumper.ropeJumpSettleState ?? diag?.settleState,
        ropeJumpSidePolicy: jumper.ropeJumpSidePolicy ?? diag?.sidePolicy,
        ropeJumpSettleInitialOverlap:
          jumper.ropeJumpSettleInitialOverlap ?? diag?.settleInitialOverlap,
        ropeJumpSettleMaxOverlap:
          jumper.ropeJumpSettleMaxOverlap ?? diag?.settleMaxOverlap,
        ropeJumpSettleAccumulatedPx:
          jumper.ropeJumpSettleAccumulatedPx ?? diag?.settleAccumulatedPx,
        ropeJumpOverlapIncreased:
          jumper.ropeJumpOverlapIncreased ?? diag?.overlapIncreased,
        ropeJumpBudgetException:
          jumper.ropeJumpBudgetException ?? diag?.budgetException,
        ropeJumpBudgetExceptionClass:
          jumper.ropeJumpBudgetExceptionClass ?? diag?.budgetExceptionClass,
      }
    : null;
  const phase = j?.ropeJumpPhase;
  const startupVuln = phase === "startup";
  const airProt = phase === "active";
  const landVuln = phase === "landing";
  const landingLines = j
    ? [
        `path=${j.ropeJumpLandingPath || "—"} phase=${phase} traj=${j.ropeJumpTrajectoryType || diag?.trajectoryType || "—"} preset=${j.ropeJumpVaultPreset || diag?.vaultPreset || "—"}`,
        `vuln: start=${startupVuln} airProt=${airProt} land=${landVuln} | apexH=${fmt(j.ropeJumpVaultApexHeight ?? diag?.apexHeight)} decisionT=${fmt(j.ropeJumpCrossoverDecisionT ?? diag?.crossoverDecisionT, 3)}`,
        `curve=${j.ropeJumpCurveModel || diag?.curveModel || "—"} apexClass=${j.ropeJumpApexCurveClass || diag?.apexCurveClass || "—"} h@apex=${fmt(j.ropeJumpHorizFracAtApex ?? diag?.horizFracAtApex, 2)}`,
        `class=${j.ropeJumpDecisionClass || diag?.decisionClass || "—"} reason=${j.ropeJumpIntentReason || diag?.intentReason || j.ropeJumpSideLockReason || "—"}`,
        `plan=${j.ropeJumpPlanningState || diag?.planningState || "—"} intent=${j.ropeJumpIntentClass || diag?.intentClass || "—"} lockedSide=${sideLabel(j.ropeJumpResolvedSide ?? diag?.resolvedSide)}`,
        `raw=${fmt(j.ropeJumpRawTargetX)} authoredEnd=${fmt(j.ropeJumpAuthoredEndX ?? diag?.authoredEndX)} desired=${fmt(j.ropeJumpDesiredEndX ?? diag?.desiredEndX)} resolved=${fmt(j.ropeJumpResolvedTargetX)}`,
        `commitX=${fmt(j.ropeJumpLandingCommitX)} commitT=${fmt(j.ropeJumpLandingCommitT, 3)} committed=${!!j.ropeJumpLandingCommitted}`,
        `corr=${fmt(j.ropeJumpEndpointCorrectionPx ?? diag?.endpointCorrectionPx)} cap=${fmt(j.ropeJumpEndpointCorrectionCap ?? diag?.endpointCorrectionCap)} capped=${!!(j.ropeJumpEndpointCorrectionCapped ?? diag?.endpointCorrectionCapped)}`,
        `landContact=${fmt(j.ropeJumpLandingContactDist ?? diag?.landingContactDist)} grounded=${fmt(j.ropeJumpGroundedContactDist ?? diag?.groundedContactDist ?? j.ropeJumpMinDistance)} allow=${fmt(j.ropeJumpSettleAllowance ?? diag?.settleAllowance)}`,
        `predDebt=${fmt(j.ropeJumpPredictedSettleDebt ?? diag?.predictedSettleDebt)} actualDebt=${fmt(j.ropeJumpActualSettleDebt ?? diag?.actualSettleDebt)} settle=${j.ropeJumpSettleState || diag?.settleState || "—"}`,
        `late=${!!j.ropeJumpLateIntrusion} (${j.ropeJumpLateIntrusionClass || "—"}) budgetEx=${!!(j.ropeJumpBudgetException ?? diag?.budgetException)}`,
        `hVel=${fmt(j.ropeJumpHorizVel)} vVel=${fmt(j.ropeJumpVertVel ?? diag?.vertVel)} hAcc=${fmt(j.ropeJumpHorizAccel ?? diag?.horizAccel)} vAcc=${fmt(j.ropeJumpVertAccel ?? diag?.vertAccel)}`,
        `hPct=${fmt(j.ropeJumpHorizTravelPct ?? diag?.horizTravelPct, 1)} authoredHPct=${fmt(j.ropeJumpAuthoredHorizPct ?? diag?.authoredHorizPct, 1)} peakVel=${fmt(j.ropeJumpPeakVel)} rev=${!!j.ropeJumpReversalDetected}`,
        `y=${fmt(j.y)} preTouch=${fmt(j.ropeJumpPreTouchdownX)} touch=${fmt(j.ropeJumpTouchdownX)} overlap=${fmt(j.ropeJumpOverlap ?? overlap)}`,
      ].join("<br/>")
    : "ropeJump: idle";

  const aerialA = classifyOffensiveAerial(p1);
  const aerialB = classifyOffensiveAerial(p2);
  const aerialLines = [aerialA && { label: "P1", a: aerialA }, aerialB && { label: "P2", a: aerialB }]
    .filter(Boolean)
    .map(
      ({ label, a }) =>
        `${label} ${a.move} phase=${a.phase} active=${a.attackActive} latch=${a.attackLatch} dive=${a.dive} flap=${a.flapFlight} charges=${a.flapCharges} outcome=${a.outcome}` +
        (a.reactionType ? ` reaction=${a.reactionType}` : "") +
        (a.attackInstanceId
          ? ` id=${a.attackInstanceId} resolved=${a.resolved} consumed=${a.contactConsumed} cleanup=${a.cleanupStage || "—"} moveOwner=${a.movementOwner || "—"}`
          : "") +
        (a.contactAxis
          ? ` axis=${a.contactAxis} c=(${fmt(a.contactX)},${fmt(a.contactY)}) n=(${fmt(a.contactNormalX, 2)},${fmt(a.contactNormalY, 2)})`
          : "")
    )
    .join("<br/>") || "offensiveAerial: idle";

  const placeDbg = getLastPlacementDebug();
  const presentationLines =
    placeDbg && performance.now() - (placeDbg.t || 0) < 4000
      ? `pres id=${placeDbg.eventId || "—"} clinch=${placeDbg.clinchInstanceId || "—"} inst=${placeDbg.attackInstance || "—"} proj=${placeDbg.projectileInstanceId || "—"} ptype=${placeDbg.projectileType || "—"} life=${placeDbg.lifecycleStage || "—"} interact=${placeDbg.interactionType || placeDbg.moveType || "—"} init=${placeDbg.initiatorId || placeDbg.ownerId || "—"} resp=${placeDbg.responderId || placeDbg.targetId || "—"} profile=${placeDbg.profileId || "—"} out=${placeDbg.outcome || "—"} stage=${placeDbg.slapStage ?? "—"} charge=${placeDbg.chargeTier || "—"} anchor=${placeDbg.anchorType || "—"} world=(${fmt(placeDbg.worldX)},${fmt(placeDbg.worldY)}) term=(${fmt(placeDbg.terminalX)},${fmt(placeDbg.terminalY)}) n=(${fmt(placeDbg.nx, 2)},${fmt(placeDbg.ny, 2)}) ap=${fmt(placeDbg.approachX, 0)} face=${placeDbg.facingHint ?? "—"} fb=${placeDbg.fallback ?? "—"} ori=${placeDbg.orientationSource || "—"} dedupe=${placeDbg.deduped ? "skip" : "ok"} clean=${placeDbg.cleanupOwner || "—"}`
      : "pres: —";

  const poseDbg = getPoseGeometryDebugSnapshot();
  const poseLast = poseDbg.last;
  const poseLines = poseLast
    ? `pose v2=${poseDbg.enabled ? "ON" : "OFF"} key=${poseLast.poseKey || "—"} gnd=${poseLast.grounded ? "Y" : "N"} game=(${fmt(poseLast.gameplayX)},${fmt(poseLast.gameplayY)}) rend=(${fmt(poseLast.renderX)},${fmt(poseLast.renderY)}) off=(${fmt(poseLast.ox)},${fmt(poseLast.oy)}) sole=${poseLast.sole != null ? Number(poseLast.sole).toFixed(3) : "—"} fb=${poseLast.fallback ? "Y" : "N"} hist=${poseDbg.historySize}`
    : `pose v2=${poseDbg.enabled ? "ON" : "OFF"}: —`;

  // Facing ownership: client infers from authoritative gameplay flags + facing
  // (no debug-only network fields). Server instance IDs stay server-side.
  const facingOwnerFor = (p) => {
    if (!p) return "—";
    if (p.isAtTheRopes) return "ROPES";
    if (p.isBeingThrown) return "THROW_VICTIM";
    if (p.isThrowing || p.isClinchThrowing) return "THROWER";
    if (p.isAttemptingPull || p.isBeingPullReversaled) return "PULL";
    if (p.isHit) return "HITSTUN";
    if (p.isDodging) return "DODGE";
    if (p.isSidestepping) return "SIDESTEP";
    if (p.isAttacking && p.isSlapAttack) return "SLAP";
    if (p.isAttacking && p.isPalmThrust) return "PALM";
    if (p.isAttacking || p.isChargingAttack) return "CHARGED/HOLD";
    if (p.isGrabStartup) return "GRAB_STARTUP";
    if (p.inClinch) return "CLINCH(neutral-inward)";
    if (p.isRecovering) return "RECOVERY";
    return "NEUTRAL";
  };
  const facingLines = `face P1=${p1.facing ?? "—"} owner=${facingOwnerFor(p1)} · P2=${p2.facing ?? "—"} owner=${facingOwnerFor(p2)} (inferred; ACTION_FACING_OWNERSHIP_V2 server-side)`;

  // Contact fidelity: infer body/attack presence from authoritative flags.
  // Full interaction IDs stay server-side (no debug-only wire fields).
  const contactPresence = (p) => {
    if (!p) return "—";
    if (p.isBeingThrown) return "throw-travel";
    if (p.isRopeJumping && p.ropeJumpPhase === "active") return "intangible-rope";
    if (p.isSlideJumping && p.slideJumpPhase === "flight" && !p.slideJumpDiveCommitted) {
      return "intangible-flight";
    }
    if (p.isDodging) return "dodge";
    if (p.isSidestepping) return "sidestep";
    if (p.isAttacking && p.attackType === "charged" && !p.isPalmThrust) {
      return "body+charged(pushbox-yield)";
    }
    if (p.isAttacking) return "body+attack";
    if (p.isHit) return "body+hitstun";
    return "body";
  };
  const contactLines = `contact P1=${contactPresence(p1)} atk=${p1.isAttacking ? p1.attackType || "Y" : "—"} hit=${p1.isHit ? "Y" : "N"} · P2=${contactPresence(p2)} atk=${p2.isAttacking ? p2.attackType || "Y" : "—"} hit=${p2.isHit ? "Y" : "N"} (COMBAT_CONTACT_FIDELITY_V2 default ON)`;
  const slapHurtHud = formatSlapHurtHudLines({
    p1,
    p2,
    lastCommitted: lastContact,
    nowMs: performance.now(),
    flagHud: readAuthoredSlapHurtboxHudFlag(),
    holdLines: getStruckLimbHoldDebugLines(),
  });
  const slapHurtLines = `${slapHurtHud.flagLine}<br/><span style="color:#ffccbc">${slapHurtHud.currentLine}</span><br/><span style="color:#ffe0b2">${slapHurtHud.queryLine}</span><br/><span style="color:${
    lastContact && performance.now() - lastContact.t > LAST_COMMITTED_FRESH_MS
      ? "#90a4ae"
      : "#ffab91"
  }">${slapHurtHud.lastLine}</span><br/><span style="color:#b39ddb">${
    slapHurtHud.limbHoldLine
  }</span>`;

  // Lifecycle ownership: infer domains from authoritative gameplay flags.
  // Instance IDs / reject counts stay server-side (no debug-only wire fields).
  const lifecycleOwnerFor = (p) => {
    if (!p) return { primary: "—", loco: "—", reaction: "—", clinch: "—" };
    let primary = "—";
    if (p.isAttacking && p.isSlapAttack) primary = "SLAP";
    else if (p.isAttacking && p.isPalmThrust) primary = "PALM";
    else if (p.isAttacking || p.isChargingAttack) primary = "CHARGED/HOLD";
    else if (p.isInEndlag) primary = "ENDLAG";
    else if (p.isGrabStartup) primary = "GRAB_STARTUP";
    let loco = "—";
    if (p.isDodging) loco = "DODGE";
    else if (p.isPowerSliding || p.isIceSliding) loco = "SLIDE";
    else if (p.isSidestepping) loco = "SIDESTEP";
    let reaction = "—";
    if (p.isHit) reaction = "HITSTUN";
    else if (p.isRecovering) reaction = "RECOVERY";
    else if (p.isAtTheRopes) reaction = "ROPES";
    else if (p.isRawParryStun) reaction = "PARRY_STUN";
    let clinch = "—";
    if (p.isThrowing || p.isClinchThrowing) clinch = "THROW";
    else if (p.isBeingThrown) clinch = "THROW_VICTIM";
    else if (p.inClinch || p.isGrabbing || p.isBeingGrabbed) clinch = "CLINCH";
    return { primary, loco, reaction, clinch };
  };
  const lc1 = lifecycleOwnerFor(p1);
  const lc2 = lifecycleOwnerFor(p2);
  const lifecycleLines = `life P1 pri=${lc1.primary} loco=${lc1.loco} rx=${lc1.reaction} clinch=${lc1.clinch} · P2 pri=${lc2.primary} loco=${lc2.loco} rx=${lc2.reaction} clinch=${lc2.clinch} (ACTION_LIFECYCLE_OWNERSHIP_V2 default ON; inferred)`;

  const lastCmd = getLastClientInputCommandResult();
  const inputCmdLines =
    cachedInputTraceEnabled && lastCmd
      ? `cmd ${lastCmd.command || "—"} stage=${lastCmd.stage || "—"} dir=${lastCmd.relativeDir || "—"} reject=${lastCmd.reason || "—"}`
      : cachedInputTraceEnabled
        ? "cmd: — (pumo_input_command_trace)"
        : null;

  if (isOffensiveAerialTraceEnabled()) {
    const active = aerialA || aerialB;
    if (active && typeof console !== "undefined") {
      // Lightweight per-flight console breadcrumb when explicitly armed.
      if (!renderCombatFidelityOverlay._aerialArmed) {
        renderCombatFidelityOverlay._aerialArmed = true;
      }
    } else if (renderCombatFidelityOverlay._aerialArmed) {
      console.log("[PUMO_OFFENSIVE_AERIAL_TRACE]", { p1: aerialA, p2: aerialB, t: performance.now() });
      renderCombatFidelityOverlay._aerialArmed = false;
    }
  }

  const toPct = (x) => `${(x / DESIGN_W) * 100}%`;
  const toBottomPct = (y) => `${(y / DESIGN_H) * 100}%`;
  let targetMarks = "";
  if (j && typeof j.ropeJumpRawTargetX === "number" && j.ropeJumpRawTargetX) {
    targetMarks += `<div style="position:absolute;left:${toPct(j.ropeJumpRawTargetX)};bottom:${toBottomPct(GROUND_LEVEL_MARKER)};transform:translateX(-50%);color:#fff59d">raw▼</div>`;
  }
  if (j && typeof j.ropeJumpResolvedTargetX === "number" && j.ropeJumpResolvedTargetX) {
    targetMarks += `<div style="position:absolute;left:${toPct(j.ropeJumpResolvedTargetX)};bottom:${toBottomPct(GROUND_LEVEL_MARKER + 12)};transform:translateX(-50%);color:#69f0ae">res▼</div>`;
  }
  if (j && j.ropeJumpLandingCommitted && typeof j.ropeJumpLandingCommitX === "number") {
    targetMarks += `<div style="position:absolute;left:${toPct(j.ropeJumpLandingCommitX)};bottom:${toBottomPct(GROUND_LEVEL_MARKER + 24)};transform:translateX(-50%);color:#80cbc4">commit▼</div>`;
  }

  let contactHtml = "";
  if (lastContact && performance.now() - lastContact.t < 1200 && lastContact.contactX != null) {
    const cy =
      typeof lastContact.contactY === "number" ? lastContact.contactY : GROUND_LEVEL_MARKER + 40;
    const age = Math.round(performance.now() - lastContact.t);
    const expired = age > LAST_COMMITTED_FRESH_MS;
    contactHtml = `
      <div style="position:absolute;left:${toPct(lastContact.contactX)};bottom:${toBottomPct(cy)};transform:translateX(-50%);color:${
        expired ? "#90a4ae" : "#ff8a80"
      }">
        <div style="width:3px;height:80px;margin:0 auto;background:${
          expired ? "#90a4ae" : "#ff8a80"
        };transform:translateY(-100%);opacity:${expired ? 0.45 : 1}"></div>
        LAST COMMITTED${expired ? " EXPIRED" : ""} age=${age}ms x=${Math.round(
          lastContact.contactX
        )} ${lastContact.attackType || ""}${
          lastContact.victimHurtRegion
            ? ` region=${lastContact.victimHurtRegion}${
                lastContact.authoredSlapHurtboxV1 ? "/limbAuth" : ""
              }`
            : ""
        }${
          lastContact.victimSlapPhase
            ? ` vPhase=${lastContact.victimSlapPhase}`
            : ""
        }${
          lastContact.victimSlapMirrorFacing != null
            ? ` vFace=${lastContact.victimSlapMirrorFacing}`
            : ""
        }${lastContact.isPunish ? " PUNISH" : ""}${
          lastContact.isCounterHit ? " COUNTER" : ""
        }
      </div>`;
  }

  const volumesOn = isCombatVolumesDebugEnabled();
  const shadowOn = isCombatVolumeShadowOverlayEnabled();
  // Geometry derivation only when volumes enabled (debug-off: none).
  // Shadow ON → Phase 3 authored defs; else Phase 1 diagnostic fixtures.
  let volumeHtml = "";
  let anchorHtml = "";
  let strikePhaseLines = "";
  let anchorHudLine = "";
  if (volumesOn) {
    const vols1 = shadowOn
      ? deriveAuthoredDebugVolumes(p1)
      : deriveDebugCombatVolumes(p1);
    const vols2 = shadowOn
      ? deriveAuthoredDebugVolumes(p2)
      : deriveDebugCombatVolumes(p2);
    volumeHtml = `${renderVolumeBoxesHtml(p1, "p1", vols1)}${renderVolumeBoxesHtml(p2, "p2", vols2)}`;
    anchorHtml = `${renderAnchorMarkersHtml(p1, "p1")}${renderAnchorMarkersHtml(p2, "p2")}`;
    const a1 = resolveDebugVolumeRoot(p1);
    const a2 = resolveDebugVolumeRoot(p2);
    const m1 = resolveMirrorFacing(p1);
    const m2 = resolveMirrorFacing(p2);
    anchorHudLine = `anchors P1 sim=(${fmt(a1.simX)},${fmt(a1.simY)}) rend=(${fmt(a1.rootX)},${fmt(a1.rootY)}) footY=${fmt(a1.visualFootY)} face=${m1} · P2 sim=(${fmt(a2.simX)},${fmt(a2.simY)}) rend=(${fmt(a2.rootX)},${fmt(a2.rootY)}) footY=${fmt(a2.visualFootY)} face=${m2} · worldHost=${world ? ".game-actors" : "MISSING"}`;
    strikePhaseLines = [
      formatStrikePhaseDebugLine(p1, "P1"),
      formatStrikePhaseDebugLine(p2, "P2"),
      shadowOn ? formatAuthoredPoseDebugLine(p1, "P1") : null,
      shadowOn ? formatAuthoredPoseDebugLine(p2, "P2") : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const volumeLegend = volumesOn
    ? `<br/><span style="color:#bbb">volumes (${
        shadowOn ? "PHASE3 authored SHADOW" : "local Phase1 diag"
      }): <span style="color:#2196f3">PUSH</span> <span style="color:#4caf50">HURT</span> <span style="color:#a5d6a7">LIMB</span> <span style="color:#f44336">HIT/tip</span> <span style="color:#ffeb3b">GRAB</span> <span style="color:#00bcd4">LAND</span> — not authoritative; recovery never HIT</span>${
        strikePhaseLines
          ? `<br/><span style="color:#ff8a80">${strikePhaseLines}</span>`
          : ""
      }${
        anchorHudLine
          ? `<br/><span style="color:#f8bbd0">${anchorHudLine}</span>`
          : ""
      }${
        shadowOn
          ? ""
          : `<br/><span style="color:#888">authored shadow: localStorage pumo_combat_volume_shadow=1</span>`
      }`
    : "";

  const hudHtml = `
    <div style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,0.62);padding:8px 10px;border-radius:4px;max-width:480px">
      pumo_combat_fidelity_debug<br/>
      P1 half=${half1.toFixed(1)} (×${Number(p1.sizeMult ?? p1.sizeMultiplier ?? 1).toFixed(2)})
      · P2 half=${half2.toFixed(1)} (×${Number(p2.sizeMult ?? p2.sizeMultiplier ?? 1).toFixed(2)})<br/>
      gap=${Math.round(gap)} minDist=${minDist.toFixed(1)} overlap=${overlap.toFixed(1)}<br/>
      <span style="color:#ffe082">${landingLines}</span><br/>
      <span style="color:#80cbc4">${aerialLines}</span><br/>
      <span style="color:#ce93d8">${presentationLines}</span><br/>
      <span style="color:#a5d6a7">${poseLines}</span><br/>
      <span style="color:#fff59d">${facingLines}</span><br/>
      <span style="color:#90caf9">${contactLines}</span><br/>
      <span style="color:#ffab91">${slapHurtLines}</span><br/>
      <span style="color:#b0bec5">${lifecycleLines}</span>
      ${
        inputCmdLines
          ? `<br/><span style="color:#ffcc80">${inputCmdLines}</span>`
          : ""
      }
      ${volumeLegend}
    </div>
  `;

  const worldHtml = volumesOn
    ? `${volumeHtml}${anchorHtml}${fighterBox(p1, "P1", "#80d8ff")}${fighterBox(p2, "P2", "#ffd180")}${targetMarks}${contactHtml}`
    : `${fighterBox(p1, "P1", "#80d8ff")}${fighterBox(p2, "P2", "#ffd180")}${targetMarks}${contactHtml}`;

  // Skip identical DOM writes (still pays string build, but avoids layout thrash).
  if (hudHtml === lastHudHtml && worldHtml === lastWorldHtml) {
    lastOverlayPaintMs = nowMs;
    return;
  }
  lastHudHtml = hudHtml;
  lastWorldHtml = worldHtml;
  lastOverlayPaintMs = nowMs;
  hud.innerHTML = hudHtml;
  if (world) {
    world.innerHTML = worldHtml;
  }
}

/** Ground Y used for rope-target marks (matches server GROUND_LEVEL). */
const GROUND_LEVEL_MARKER = 286;

function fmt(n, digits = 1) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Number(n.toFixed(digits));
}

// DEV only console helpers — never attach in production builds.
if (IS_DEV_BUILD && typeof window !== "undefined") {
  window.__PUMO_COMBAT_FIDELITY = {
    enable: () => setCachedFlag(FLAG_KEY, true),
    disable: () => setCachedFlag(FLAG_KEY, false),
    enableVolumes: () => setCachedFlag(VOLUMES_FLAG_KEY, true),
    disableVolumes: () => setCachedFlag(VOLUMES_FLAG_KEY, false),
    enableShadowVolumes: () => setCachedFlag(SHADOW_VOLUMES_FLAG_KEY, true),
    disableShadowVolumes: () => setCachedFlag(SHADOW_VOLUMES_FLAG_KEY, false),
    enableLandingTrace: () => setCachedFlag(LANDING_TRACE_KEY, true),
    disableLandingTrace: () => setCachedFlag(LANDING_TRACE_KEY, false),
    enableOffensiveAerialTrace: () => setCachedFlag(AERIAL_TRACE_KEY, true),
    disableOffensiveAerialTrace: () => setCachedFlag(AERIAL_TRACE_KEY, false),
    refreshFlags: refreshCachedFlags,
    noteContact: noteCombatContactEvent,
    noteLandingDiag,
    render: renderCombatFidelityOverlay,
    isAvailable: isCombatFidelityDebugAvailable,
  };
}

/**
 * Combat fidelity debug helpers — DISABLED BY DEFAULT.
 *
 * Enable in the browser console or before match load:
 *   localStorage.setItem("pumo_combat_fidelity_debug", "1")
 * Disable:
 *   localStorage.removeItem("pumo_combat_fidelity_debug")
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
 * See COMBAT_FIDELITY_AUDIT.md / AERIAL_LANDING_PHASE_A1.md.
 */

import { getLastPlacementDebug } from "../combatPresentation/placement";
import { getPoseGeometryDebugSnapshot } from "../poseGeometry";
import { getLastClientInputCommandResult } from "./inputCommandTrace";

const FLAG_KEY = "pumo_combat_fidelity_debug";
const LANDING_TRACE_KEY = "pumo_landing_trace";
/** Optional console dump when a slide-jump / FLAP flight ends (client view). */
const AERIAL_TRACE_KEY = "pumo_offensive_aerial_trace";
const INPUT_TRACE_KEY = "pumo_input_command_trace";
/** Fallback only — must match server-io/constants.js HITBOX_DISTANCE_VALUE */
const HITBOX_HALF_FALLBACK = 65;
const DESIGN_W = 1280;
/** Cap overlay DOM rebuilds — full innerHTML every RAF was a major jank source. */
const OVERLAY_MIN_INTERVAL_MS = 100;

let overlayEl = null;
let lastContact = null;
let landingTraceArmed = false;
let lastLandingTraceKey = null;
/** Latest server `landing_diag` payload (debug-net only). */
let lastLandingDiag = null;
let lastOverlayPaintMs = 0;
let lastOverlayHtml = "";

// Cache localStorage flags — getItem every RAF (60Hz+) is measurable main-thread cost.
let cachedFidelityEnabled = null;
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

function refreshCachedFlags() {
  cachedFidelityEnabled = readFlag(FLAG_KEY);
  cachedLandingTraceEnabled = readFlag(LANDING_TRACE_KEY);
  cachedAerialTraceEnabled = readFlag(AERIAL_TRACE_KEY);
  cachedInputTraceEnabled = readFlag(INPUT_TRACE_KEY);
}

if (typeof window !== "undefined") {
  refreshCachedFlags();
  window.addEventListener("storage", (e) => {
    if (
      !e.key ||
      e.key === FLAG_KEY ||
      e.key === LANDING_TRACE_KEY ||
      e.key === AERIAL_TRACE_KEY ||
      e.key === INPUT_TRACE_KEY
    ) {
      refreshCachedFlags();
    }
  });
}

export function isCombatFidelityDebugEnabled() {
  if (cachedFidelityEnabled == null) refreshCachedFlags();
  return !!cachedFidelityEnabled;
}

/** Cheap gate for RAF callers — avoid building overlay payloads every frame. */
export function shouldUpdateCombatFidelityOverlay() {
  if (!isCombatFidelityDebugEnabled()) return false;
  if (typeof document !== "undefined" && document.hidden) return false;
  return performance.now() - lastOverlayPaintMs >= OVERLAY_MIN_INTERVAL_MS;
}

function isLandingTraceEnabled() {
  if (cachedLandingTraceEnabled == null) refreshCachedFlags();
  return !!cachedLandingTraceEnabled;
}

function isOffensiveAerialTraceEnabled() {
  if (cachedAerialTraceEnabled == null) refreshCachedFlags();
  return !!cachedAerialTraceEnabled;
}

function setCachedFlag(key, enabled) {
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
  if (!isCombatFidelityDebugEnabled() || !data) return;
  lastContact = {
    contactX: typeof data.contactX === "number" ? data.contactX : null,
    contactY: typeof data.contactY === "number" ? data.contactY : null,
    attackerX: typeof data.attackerX === "number" ? data.attackerX : null,
    victimX: typeof data.x === "number" ? data.x : null,
    attackType: data.attackType || null,
    t: performance.now(),
  };
}

/** Ingest a server `landing_diag` packet (emitted only when LANDING_DEBUG_NET). */
export function noteLandingDiag(data) {
  if (!data) return;
  lastLandingDiag = { ...data, t: performance.now() };
}

function ensureOverlay() {
  if (overlayEl || typeof document === "undefined") return overlayEl;
  overlayEl = document.createElement("div");
  overlayEl.id = "pumo-combat-fidelity-debug";
  overlayEl.style.cssText = [
    "position:fixed",
    "inset:0",
    "pointer-events:none",
    "z-index:99999",
    "font:11px/1.35 monospace",
    "color:#b8f5c8",
    "text-shadow:0 1px 2px #000",
  ].join(";");
  document.body.appendChild(overlayEl);
  return overlayEl;
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
  const toPct = (x) => `${(x / DESIGN_W) * 100}%`;
  const mult =
    fighter.sizeMult ?? fighter.sizeMultiplier ?? 1;
  return `
    <div style="position:absolute;left:${toPct(fighter.x)};bottom:18%;transform:translateX(-50%);text-align:center;color:${color}">
      <div style="width:2px;height:120px;margin:0 auto;background:${color}"></div>
      <div style="position:absolute;left:50%;top:40px;width:${(half * 2 / DESIGN_W) * 100}vw;max-width:${half * 2}px;height:28px;border:1px solid ${color};transform:translateX(-50%);opacity:0.85;box-sizing:border-box"></div>
      <div>${label} x=${Math.round(fighter.x)}</div>
      <div style="opacity:0.85">size=${Number(mult).toFixed(2)} half=${half.toFixed(1)}</div>
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
  if (!isCombatFidelityDebugEnabled()) {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
      lastOverlayHtml = "";
      lastOverlayPaintMs = 0;
    }
    return;
  }
  // Never do expensive overlay work in a background tab.
  if (typeof document !== "undefined" && document.hidden) return;

  const nowMs = performance.now();
  if (nowMs - lastOverlayPaintMs < OVERLAY_MIN_INTERVAL_MS) return;

  const el = ensureOverlay();
  if (!el || !state) return;

  const p1 = state.p1 || {
    x: state.p1x || 0,
    y: state.p1y || 0,
    sizeMult: state.p1SizeMult ?? state.sizeMult ?? 1,
  };
  const p2 = state.p2 || {
    x: state.p2x || 0,
    y: state.p2y || 0,
    sizeMult: state.p2SizeMult ?? 1,
  };

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
  let targetMarks = "";
  if (j && typeof j.ropeJumpRawTargetX === "number" && j.ropeJumpRawTargetX) {
    targetMarks += `<div style="position:absolute;left:${toPct(j.ropeJumpRawTargetX)};bottom:30%;transform:translateX(-50%);color:#fff59d">raw▼</div>`;
  }
  if (j && typeof j.ropeJumpResolvedTargetX === "number" && j.ropeJumpResolvedTargetX) {
    targetMarks += `<div style="position:absolute;left:${toPct(j.ropeJumpResolvedTargetX)};bottom:34%;transform:translateX(-50%);color:#69f0ae">res▼</div>`;
  }
  if (j && j.ropeJumpLandingCommitted && typeof j.ropeJumpLandingCommitX === "number") {
    targetMarks += `<div style="position:absolute;left:${toPct(j.ropeJumpLandingCommitX)};bottom:38%;transform:translateX(-50%);color:#80cbc4">commit▼</div>`;
  }

  let contactHtml = "";
  if (lastContact && performance.now() - lastContact.t < 1200 && lastContact.contactX != null) {
    contactHtml = `
      <div style="position:absolute;left:${toPct(lastContact.contactX)};bottom:22%;transform:translateX(-50%);color:#ff8a80">
        <div style="width:3px;height:80px;margin:0 auto;background:#ff8a80"></div>
        contactX=${Math.round(lastContact.contactX)} ${lastContact.attackType || ""}
      </div>`;
  }

  const html = `
    <div style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,0.62);padding:8px 10px;border-radius:4px;max-width:420px">
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
      <span style="color:#b0bec5">${lifecycleLines}</span>
      ${
        inputCmdLines
          ? `<br/><span style="color:#ffcc80">${inputCmdLines}</span>`
          : ""
      }
    </div>
    ${fighterBox(p1, "P1", "#80d8ff")}
    ${fighterBox(p2, "P2", "#ffd180")}
    ${targetMarks}
    ${contactHtml}
  `;
  // Skip identical DOM writes (still pays string build, but avoids layout thrash).
  if (html === lastOverlayHtml) {
    lastOverlayPaintMs = nowMs;
    return;
  }
  lastOverlayHtml = html;
  lastOverlayPaintMs = nowMs;
  el.innerHTML = html;
}

function fmt(n, digits = 1) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Number(n.toFixed(digits));
}

if (typeof window !== "undefined") {
  window.__PUMO_COMBAT_FIDELITY = {
    enable: () => setCachedFlag(FLAG_KEY, true),
    disable: () => setCachedFlag(FLAG_KEY, false),
    enableLandingTrace: () => setCachedFlag(LANDING_TRACE_KEY, true),
    disableLandingTrace: () => setCachedFlag(LANDING_TRACE_KEY, false),
    enableOffensiveAerialTrace: () => setCachedFlag(AERIAL_TRACE_KEY, true),
    disableOffensiveAerialTrace: () => setCachedFlag(AERIAL_TRACE_KEY, false),
    refreshFlags: refreshCachedFlags,
    noteContact: noteCombatContactEvent,
    noteLandingDiag,
    render: renderCombatFidelityOverlay,
  };
}

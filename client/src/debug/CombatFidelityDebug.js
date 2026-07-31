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
 * Does not alter gameplay, balance, networking, or simulation.
 * Prefer server-authored half-widths / landing fields when present.
 *
 * See COMBAT_FIDELITY_AUDIT.md / AERIAL_LANDING_PHASE_A.md.
 */

const FLAG_KEY = "pumo_combat_fidelity_debug";
const LANDING_TRACE_KEY = "pumo_landing_trace";
/** Fallback only — must match server-io/constants.js HITBOX_DISTANCE_VALUE */
const HITBOX_HALF_FALLBACK = 65;
const DESIGN_W = 1280;

let overlayEl = null;
let lastContact = null;
let landingTraceArmed = false;
let lastLandingTraceKey = null;

export function isCombatFidelityDebugEnabled() {
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function isLandingTraceEnabled() {
  try {
    return localStorage.getItem(LANDING_TRACE_KEY) === "1";
  } catch {
    return false;
  }
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

  const record = {
    path: jumper.ropeJumpLandingPath || "unknown",
    phase: jumper.ropeJumpPhase,
    rawTargetX: jumper.ropeJumpRawTargetX,
    resolvedTargetX: jumper.ropeJumpResolvedTargetX,
    commitX: jumper.ropeJumpLandingCommitX,
    commitT: jumper.ropeJumpLandingCommitT,
    committed: jumper.ropeJumpLandingCommitted,
    preferredSide: jumper.ropeJumpPreferredSide,
    resolvedSide: jumper.ropeJumpResolvedSide,
    minDistance: jumper.ropeJumpMinDistance,
    centerDistance: jumper.ropeJumpCenterDistance,
    overlap: jumper.ropeJumpOverlap,
    preTouchdownX: jumper.ropeJumpPreTouchdownX,
    touchdownX: jumper.ropeJumpTouchdownX,
    safetyCorrectionPx: jumper.ropeJumpSafetyCorrectionPx,
    usedFallback: jumper.ropeJumpUsedFallback,
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
    }
    return;
  }
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
  const landingLines = jumper
    ? [
        `path=${jumper.ropeJumpLandingPath || "—"} phase=${jumper.ropeJumpPhase}`,
        `raw=${fmt(jumper.ropeJumpRawTargetX)} resolved=${fmt(jumper.ropeJumpResolvedTargetX)}`,
        `commitX=${fmt(jumper.ropeJumpLandingCommitX)} commitT=${fmt(jumper.ropeJumpLandingCommitT, 3)} committed=${!!jumper.ropeJumpLandingCommitted}`,
        `prefSide=${sideLabel(jumper.ropeJumpPreferredSide)} resolvedSide=${sideLabel(jumper.ropeJumpResolvedSide)}`,
        `minDist=${fmt(jumper.ropeJumpMinDistance ?? minDist)} centerDist=${fmt(jumper.ropeJumpCenterDistance ?? gap)}`,
        `overlap(pred)=${fmt(jumper.ropeJumpOverlap ?? overlap)} safetyCorr=${fmt(jumper.ropeJumpSafetyCorrectionPx)}`,
        `preTouch=${fmt(jumper.ropeJumpPreTouchdownX)} touch=${fmt(jumper.ropeJumpTouchdownX)} fallback=${!!jumper.ropeJumpUsedFallback}`,
      ].join("<br/>")
    : "ropeJump: idle";

  const toPct = (x) => `${(x / DESIGN_W) * 100}%`;
  let targetMarks = "";
  if (jumper && typeof jumper.ropeJumpRawTargetX === "number" && jumper.ropeJumpRawTargetX) {
    targetMarks += `<div style="position:absolute;left:${toPct(jumper.ropeJumpRawTargetX)};bottom:30%;transform:translateX(-50%);color:#fff59d">raw▼</div>`;
  }
  if (jumper && typeof jumper.ropeJumpResolvedTargetX === "number" && jumper.ropeJumpResolvedTargetX) {
    targetMarks += `<div style="position:absolute;left:${toPct(jumper.ropeJumpResolvedTargetX)};bottom:34%;transform:translateX(-50%);color:#69f0ae">res▼</div>`;
  }
  if (jumper && jumper.ropeJumpLandingCommitted && typeof jumper.ropeJumpLandingCommitX === "number") {
    targetMarks += `<div style="position:absolute;left:${toPct(jumper.ropeJumpLandingCommitX)};bottom:38%;transform:translateX(-50%);color:#80cbc4">commit▼</div>`;
  }

  let contactHtml = "";
  if (lastContact && performance.now() - lastContact.t < 1200 && lastContact.contactX != null) {
    contactHtml = `
      <div style="position:absolute;left:${toPct(lastContact.contactX)};bottom:22%;transform:translateX(-50%);color:#ff8a80">
        <div style="width:3px;height:80px;margin:0 auto;background:#ff8a80"></div>
        contactX=${Math.round(lastContact.contactX)} ${lastContact.attackType || ""}
      </div>`;
  }

  el.innerHTML = `
    <div style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,0.62);padding:8px 10px;border-radius:4px;max-width:420px">
      pumo_combat_fidelity_debug<br/>
      P1 half=${half1.toFixed(1)} (×${Number(p1.sizeMult ?? p1.sizeMultiplier ?? 1).toFixed(2)})
      · P2 half=${half2.toFixed(1)} (×${Number(p2.sizeMult ?? p2.sizeMultiplier ?? 1).toFixed(2)})<br/>
      gap=${Math.round(gap)} minDist=${minDist.toFixed(1)} overlap=${overlap.toFixed(1)}<br/>
      <span style="color:#ffe082">${landingLines}</span>
    </div>
    ${fighterBox(p1, "P1", "#80d8ff")}
    ${fighterBox(p2, "P2", "#ffd180")}
    ${targetMarks}
    ${contactHtml}
  `;
}

function fmt(n, digits = 1) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Number(n.toFixed(digits));
}

if (typeof window !== "undefined") {
  window.__PUMO_COMBAT_FIDELITY = {
    enable: () => localStorage.setItem(FLAG_KEY, "1"),
    disable: () => localStorage.removeItem(FLAG_KEY),
    enableLandingTrace: () => localStorage.setItem(LANDING_TRACE_KEY, "1"),
    disableLandingTrace: () => localStorage.removeItem(LANDING_TRACE_KEY),
    noteContact: noteCombatContactEvent,
    render: renderCombatFidelityOverlay,
  };
}

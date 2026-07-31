/**
 * Combat fidelity debug helpers — DISABLED BY DEFAULT.
 *
 * Enable in the browser console or before match load:
 *   localStorage.setItem("pumo_combat_fidelity_debug", "1")
 * Disable:
 *   localStorage.removeItem("pumo_combat_fidelity_debug")
 *
 * Does not alter gameplay, balance, networking, or simulation.
 * Draws an overlay of root X, pushbox half-width estimate, and last contactX.
 *
 * See COMBAT_FIDELITY_AUDIT.md § Diagnostic tooling.
 */

const FLAG_KEY = "pumo_combat_fidelity_debug";
const HITBOX_HALF = 65; // must match server-io/constants.js HITBOX_DISTANCE_VALUE
const DESIGN_W = 1280;

let overlayEl = null;
let lastContact = null;

export function isCombatFidelityDebugEnabled() {
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
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
    "font:12px/1.35 monospace",
    "color:#b8f5c8",
    "text-shadow:0 1px 2px #000",
  ].join(";");
  document.body.appendChild(overlayEl);
  return overlayEl;
}

/**
 * Call once per frame from a fighter/game render path with world positions.
 * @param {{ p1x:number, p1y:number, p2x:number, p2y:number, sizeMult?:number }} state
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

  const size = state.sizeMult || 1;
  const half = HITBOX_HALF * size;
  const toPct = (x) => `${(x / DESIGN_W) * 100}%`;

  const box = (x, label, color) => `
    <div style="position:absolute;left:${toPct(x)};bottom:18%;transform:translateX(-50%);text-align:center">
      <div style="width:2px;height:120px;margin:0 auto;background:${color}"></div>
      <div style="position:absolute;left:50%;top:40px;width:${(half * 2 / DESIGN_W) * 100}vw;max-width:${half * 2}px;height:24px;border:1px solid ${color};transform:translateX(-50%);opacity:0.85"></div>
      <div>${label} x=${Math.round(x)}</div>
    </div>`;

  let contactHtml = "";
  if (lastContact && performance.now() - lastContact.t < 1200 && lastContact.contactX != null) {
    contactHtml = `
      <div style="position:absolute;left:${toPct(lastContact.contactX)};bottom:22%;transform:translateX(-50%);color:#ff8a80">
        <div style="width:3px;height:80px;margin:0 auto;background:#ff8a80"></div>
        contactX=${Math.round(lastContact.contactX)} ${lastContact.attackType || ""}
      </div>`;
  }

  el.innerHTML = `
    <div style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,0.55);padding:8px 10px;border-radius:4px;max-width:360px">
      pumo_combat_fidelity_debug<br/>
      push half=${half} (HITBOX_DISTANCE_VALUE*size)<br/>
      gap=${Math.round(Math.abs((state.p1x || 0) - (state.p2x || 0)))} center-center
    </div>
    ${box(state.p1x || 0, "P1", "#80d8ff")}
    ${box(state.p2x || 0, "P2", "#ffd180")}
    ${contactHtml}
  `;
}

if (typeof window !== "undefined") {
  window.__PUMO_COMBAT_FIDELITY = {
    enable: () => localStorage.setItem(FLAG_KEY, "1"),
    disable: () => localStorage.removeItem(FLAG_KEY),
    noteContact: noteCombatContactEvent,
    render: renderCombatFidelityOverlay,
  };
}

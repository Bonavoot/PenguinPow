/**
 * Shared combat presentation placement (Phase 6).
 *
 * World space: 1280×720, Y up from ground (matches server).
 * CSS effects: left=(x/1280)*100%, bottom=(y/720)*100%.
 * Particles: ParticleEngine converts Y via GAME_H - y.
 *
 * Fallback hierarchy (matches server combatPresentationEvent.js):
 * 0 SURFACE_CONTACT → 1 STORED → 2 SURFACE_ANCHOR → 3 OUTCOME_GEOMETRIC → 4 ROOT_MIDPOINT
 */

export const FALLBACK_LEVEL = Object.freeze({
  SURFACE_CONTACT: 0,
  STORED_CONTACT: 1,
  SURFACE_ANCHOR: 2,
  OUTCOME_GEOMETRIC: 3,
  ROOT_MIDPOINT: 4,
});

const DESIGN_W = 1280;
const DESIGN_H = 720;

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Read compact combatPresentation from a socket payload. */
export function readCombatPresentation(data) {
  const cp = data?.combatPresentation;
  if (!cp || typeof cp !== "object") return null;
  if (!cp.eventId || typeof cp.x !== "number" || typeof cp.y !== "number") {
    return null;
  }
  if (!Number.isFinite(cp.x) || !Number.isFinite(cp.y)) return null;
  return cp;
}

/**
 * World placement for sprite/CSS effects from a presentation event.
 * Invalid coords fail closed to null (caller keeps legacy path).
 */
export function worldPlacementFromPresentation(cp) {
  if (!cp) return null;
  const x = finite(cp.x, NaN);
  const y = finite(cp.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Soft arena clamp — never NaN / runaway off-map.
  const clampedX = Math.max(-200, Math.min(DESIGN_W + 200, x));
  const clampedY = Math.max(-50, Math.min(DESIGN_H + 200, y));
  return {
    x: clampedX,
    y: clampedY,
    facingHint: cp.facingHint === 1 || cp.facingHint === -1 ? cp.facingHint : cp.facing,
    orientationSource: cp.orientationSource || null,
    nx: finite(cp.nx, 0),
    ny: finite(cp.ny, 0),
    fallback: typeof cp.fallback === "number" ? cp.fallback : FALLBACK_LEVEL.ROOT_MIDPOINT,
    profileId: cp.profileId || null,
    eventId: cp.eventId,
    anchorType: cp.anchorType || null,
  };
}

export function worldToCssPercent(x, y) {
  return {
    leftPct: (finite(x, 0) / DESIGN_W) * 100,
    bottomPct: (finite(y, 0) / DESIGN_H) * 100,
  };
}

/** Last presentation placement for debug overlay (bounded, overwritten). */
let lastPlacementDebug = null;

export function notePlacementDebug(info) {
  lastPlacementDebug = info
    ? {
        ...info,
        t: typeof performance !== "undefined" ? performance.now() : 0,
      }
    : null;
}

export function getLastPlacementDebug() {
  return lastPlacementDebug;
}

export function clearPlacementDebug() {
  lastPlacementDebug = null;
}

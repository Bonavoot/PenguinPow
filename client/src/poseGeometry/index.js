/**
 * Client pose-geometry facade (Phase 11).
 * Registry is local ESM (Vite-safe). Server tests use the CJS twin.
 */

import {
  DESIGN_W,
  DESIGN_H,
  DISPLAY_WIDTH_FRAC,
  SPRITE_WORLD_SIZE,
  LEGACY_SOLE_FROM_BOTTOM_PCT,
  MIRROR_RULE,
  POSE_REGISTRY,
  poseKeyFromSrc,
  getPoseRegistration,
  listPoseKeys,
  resolvePoseRender as resolvePoseRenderCore,
  measurePoseTransitionPop,
  createPoseTransitionDiagStore,
} from "./poseRegistration.js";

/**
 * FIGHTER_POSE_GEOMETRY_V2 — manually approved; default ON.
 * Rollback: FIGHTER_POSE_GEOMETRY_V2=0 npm run dev:web
 * Vite exposes FIGHTER_* via envPrefix (see client/vite.config.js).
 *
 *   unset / ""  → true
 *   1 / true    → true
 *   0 / false   → false (exact legacy rendering)
 */
export function isPoseGeometryV2Enabled() {
  try {
    const env = import.meta.env?.FIGHTER_POSE_GEOMETRY_V2;
    if (env === false || env === "0" || env === "false") return false;
    if (env === true || env === "1" || env === "true") return true;
    if (env == null || env === "") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function resolvePoseRender(opts = {}) {
  return resolvePoseRenderCore({
    ...opts,
    v2Enabled:
      opts.v2Enabled != null ? !!opts.v2Enabled : isPoseGeometryV2Enabled(),
  });
}

/** Sole CSS transform-origin string for V2 (or legacy constant). */
export function soleTransformOriginCss(soleFromBottomPct) {
  const pct =
    typeof soleFromBottomPct === "number" && Number.isFinite(soleFromBottomPct)
      ? soleFromBottomPct
      : LEGACY_SOLE_FROM_BOTTOM_PCT;
  const pctDisplay = +(pct * 100).toFixed(3);
  return `50% calc(100% - ${pctDisplay}%)`;
}

const poseTransitionDiag = createPoseTransitionDiagStore(32);
let lastPoseDiagKey = null;

export function notePoseGeometryDebug(resolved) {
  if (!resolved) return;
  if (
    lastPoseDiagKey &&
    lastPoseDiagKey !== resolved.poseKey &&
    resolved.v2
  ) {
    const pop = measurePoseTransitionPop(lastPoseDiagKey, resolved.poseKey);
    poseTransitionDiag.note({
      type: "transition",
      from: lastPoseDiagKey,
      to: resolved.poseKey,
      dx: pop.dx,
      dy: pop.dy,
    });
  }
  lastPoseDiagKey = resolved.poseKey;
  poseTransitionDiag.note({
    type: "pose",
    poseKey: resolved.poseKey,
    v2: resolved.v2,
    grounded: resolved.grounded,
    gameplayX: resolved.gameplayX,
    gameplayY: resolved.gameplayY,
    renderX: resolved.renderX,
    renderY: resolved.renderY,
    ox: resolved.appliedOffsetX,
    oy: resolved.appliedOffsetY,
    sole: resolved.soleFromBottomPct,
    fallback: resolved.fallback,
  });
}

export function getPoseGeometryDebugSnapshot() {
  const list = poseTransitionDiag.list();
  const last = list.length ? list[list.length - 1] : null;
  return {
    enabled: isPoseGeometryV2Enabled(),
    last,
    historySize: poseTransitionDiag.size(),
    recent: list.slice(-6),
  };
}

export function clearPoseGeometryDebug() {
  poseTransitionDiag.clear();
  lastPoseDiagKey = null;
}

export {
  DESIGN_W,
  DESIGN_H,
  DISPLAY_WIDTH_FRAC,
  SPRITE_WORLD_SIZE,
  LEGACY_SOLE_FROM_BOTTOM_PCT,
  MIRROR_RULE,
  POSE_REGISTRY,
  poseKeyFromSrc,
  getPoseRegistration,
  listPoseKeys,
  measurePoseTransitionPop,
};

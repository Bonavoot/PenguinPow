/**
 * Phase 2 — sidestep presentation helpers (pure).
 *
 * Travel direction is NOT facing. Facing must never be used as a fallback.
 * Active-phase duration mirrors server SIDESTEP_ACTIVE_MS for trail apex `t`
 * only; emission lifetime is gated by authoritative phase flags.
 */

/** Must match server-io/constants.js SIDESTEP_ACTIVE_MS. */
export const SIDESTEP_ACTIVE_MS = 400;

/** Must match server-io/constants.js SIDESTEP_STARTUP_MS / RECOVERY (docs). */
export const SIDESTEP_STARTUP_MS = 50;
export const SIDESTEP_RECOVERY_MS = 150;

/**
 * Resolve lateral travel for sidestep VFX.
 * @param {{ sidestepDirection?: number|null, predictedTravelDirection?: number|null }} opts
 * @returns {1|-1|null} null when unknown — caller must not substitute facing
 */
export function resolveSidestepTravelDirection(opts = {}) {
  const auth = opts.sidestepDirection;
  if (auth === 1 || auth === -1) return auth;
  const predicted = opts.predictedTravelDirection;
  if (predicted === 1 || predicted === -1) return predicted;
  return null;
}

/** Authoritative active phase (not startup, not recovery). */
export function isSidestepActivePhase(fighter) {
  return !!(
    fighter &&
    fighter.isSidestepping &&
    !fighter.isSidestepStartup &&
    !fighter.isSidestepRecovery
  );
}

/**
 * Trail progress 0..1 from local elapsed while active flags remain true.
 * Does not extend emission past phase edges — caller stops when inactive.
 */
export function sidestepTrailProgress(elapsedMs, activeMs = SIDESTEP_ACTIVE_MS) {
  if (!(activeMs > 0) || !(elapsedMs >= 0)) return 0;
  return Math.min(elapsedMs / activeMs, 1);
}

/** True when a hardcoded 320 ms active assumption remains in source text. */
export function assertNoStaleSidestepActiveMs(sourceText) {
  if (typeof sourceText !== "string") return true;
  return !/SIDESTEP_ACTIVE_MS\s*=\s*320|Active phase length[\s\S]*320/.test(
    sourceText
  );
}

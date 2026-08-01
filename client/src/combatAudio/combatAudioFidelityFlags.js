/**
 * COMBAT_AUDIO_FIDELITY_V1 — semantic combat-audio routing / coverage.
 *
 * Finalized after player audition (charged-attack phantom palm verified fixed).
 * Default ON. Explicit rollback retained:
 *
 *   npm run dev:web                              → V1 ON
 *   COMBAT_AUDIO_FIDELITY_V1=1 npm run dev:web   → V1 ON
 *   COMBAT_AUDIO_FIDELITY_V1=0 npm run dev:web   → exact V1 rollback OFF
 *
 * Semantics:
 *   unset / null / empty → ON
 *   1 / true             → ON
 *   0 / false            → OFF
 *
 * Vite exposes COMBAT_* via envPrefix (see client/vite.config.js).
 * Presentation/audio only — does not change gameplay authority or tuning.
 */

/**
 * Canonical parser — single source of default/rollback semantics.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function parseCombatAudioFidelityV1Flag(raw) {
  if (raw === undefined || raw === null || raw === "") return true;
  if (raw === false) return false;
  if (raw === true) return true;
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  // Unrecognized → approved default ON
  return true;
}

/**
 * @param {unknown} [envValue] - when provided, parse this value only (tests).
 */
export function isCombatAudioFidelityV1Enabled(envValue) {
  if (envValue !== undefined) {
    return parseCombatAudioFidelityV1Flag(envValue);
  }
  try {
    const env = globalThis.process?.env;
    if (
      env &&
      Object.prototype.hasOwnProperty.call(env, "COMBAT_AUDIO_FIDELITY_V1")
    ) {
      return parseCombatAudioFidelityV1Flag(env.COMBAT_AUDIO_FIDELITY_V1);
    }
  } catch {
    /* ignore */
  }
  try {
    const viteEnv = import.meta.env?.COMBAT_AUDIO_FIDELITY_V1;
    if (viteEnv !== undefined) {
      return parseCombatAudioFidelityV1Flag(viteEnv);
    }
  } catch {
    /* ignore */
  }
  return true;
}

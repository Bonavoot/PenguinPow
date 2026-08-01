/**
 * COMBAT_AUDIO_FIDELITY_V1 — semantic combat-audio routing / coverage.
 *
 * Default OFF. Enable for playtest:
 *   COMBAT_AUDIO_FIDELITY_V1=1 npm run dev:web
 * Rollback:
 *   COMBAT_AUDIO_FIDELITY_V1=0 npm run dev:web
 *   (also unset / false)
 *
 * Vite exposes COMBAT_* via envPrefix (see client/vite.config.js).
 * Presentation/audio only — does not change gameplay authority or tuning.
 */

function parseFlag(raw) {
  if (raw === false || raw === "0" || raw === "false") return false;
  if (raw === true || raw === "1" || raw === "true") return true;
  if (raw == null || raw === "") return false;
  return false;
}

export function isCombatAudioFidelityV1Enabled() {
  try {
    const nodeEnv =
      typeof globalThis !== "undefined" && globalThis.process?.env
        ? globalThis.process.env.COMBAT_AUDIO_FIDELITY_V1
        : undefined;
    if (nodeEnv != null) return parseFlag(nodeEnv);
  } catch {
    /* ignore */
  }
  try {
    const env = import.meta.env?.COMBAT_AUDIO_FIDELITY_V1;
    return parseFlag(env);
  } catch {
    /* ignore */
  }
  return false;
}

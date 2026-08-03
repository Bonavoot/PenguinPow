/**
 * Authoritative cinematic-kill audio / flight-VFX variant classification.
 *
 * Three DISTINCT cinematics share the camera freeze/zoom/darken beat:
 *   demolished_charged — charged fly-out KO (launch SFX + gun + smoke trail)
 *   matador_kill       — MATADOR success belly-slide KO (camera only; no charged flight package)
 *   ap_pull            — AP slap-down kill (camera only; AP owns its own SFX)
 *
 * IMPORTANT: Matador Break (isGored — a strike beating a MATADOR attempt) is a
 * HIT CALLOUT, not a cinematic variant. A charged attack that Matador-Breaks
 * someone and ALSO scores a cinematic kill is still demolished_charged.
 */

import { CINEMATIC_VARIANT } from "./cueRegistry.js";

/**
 * @param {object} data - cinematic_kill payload
 * @returns {"demolished_charged"|"matador_kill"|"ap_pull"}
 */
export function resolveCinematicVariant(data) {
  if (!data) return CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
  const raw = data.cinematicVariant || data.variant;
  if (raw === CINEMATIC_VARIANT.DEMOLISHED_CHARGED) {
    return CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
  }
  if (raw === CINEMATIC_VARIANT.AP_PULL) {
    return CINEMATIC_VARIANT.AP_PULL;
  }
  // matador_kill is the real name; "matador_break" was a legacy misnomer that
  // conflated this with the Matador Break hit callout (isGored).
  if (
    raw === CINEMATIC_VARIANT.MATADOR_KILL ||
    raw === "matador_break"
  ) {
    return CINEMATIC_VARIANT.MATADOR_KILL;
  }
  if (data.apPullKill) return CINEMATIC_VARIANT.AP_PULL;
  // Only the MATADOR success kill path — never isGored / Matador Break.
  if (data.matadorKill) return CINEMATIC_VARIANT.MATADOR_KILL;
  return CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

/**
 * Western gunLaunchSound — only regular DEMOLISHED charged cinematic.
 */
export function shouldPlayCinematicGunCue(data) {
  return resolveCinematicVariant(data) === CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

/** Charged DEMOLISHED only — launch SFX / impact spark. Not Matador kill / AP. */
export function shouldPlayCinematicChargedLaunchPackage(data) {
  return resolveCinematicVariant(data) === CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

/** Flight smoke trail — charged DEMOLISHED only (Matador kill / AP skip). */
export function shouldPlayCinematicKillSmokeTrail(data) {
  return resolveCinematicVariant(data) === CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

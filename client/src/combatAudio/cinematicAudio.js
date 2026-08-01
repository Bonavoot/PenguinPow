/**
 * Authoritative cinematic-kill audio variant classification.
 * Prefer server `cinematicVariant`; fall back to legacy boolean fields.
 */

import { CINEMATIC_VARIANT } from "./cueRegistry.js";

/**
 * @param {object} data - cinematic_kill payload
 * @returns {"demolished_charged"|"matador_break"|"ap_pull"}
 */
export function resolveCinematicVariant(data) {
  if (!data) return CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
  const raw = data.cinematicVariant || data.variant;
  if (
    raw === CINEMATIC_VARIANT.DEMOLISHED_CHARGED ||
    raw === CINEMATIC_VARIANT.MATADOR_BREAK ||
    raw === CINEMATIC_VARIANT.AP_PULL
  ) {
    return raw;
  }
  if (data.apPullKill) return CINEMATIC_VARIANT.AP_PULL;
  if (data.matadorKill || data.isGored || data.goredKill) {
    return CINEMATIC_VARIANT.MATADOR_BREAK;
  }
  return CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

/**
 * Western gunLaunchSound — only regular DEMOLISHED charged cinematic.
 */
export function shouldPlayCinematicGunCue(data) {
  return resolveCinematicVariant(data) === CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

/** Charged DEMOLISHED only — launch SFX / impact spark. Not Matador / AP. */
export function shouldPlayCinematicChargedLaunchPackage(data) {
  return resolveCinematicVariant(data) === CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

/** Flight smoke trail — charged DEMOLISHED only (Matador / AP skip). */
export function shouldPlayCinematicKillSmokeTrail(data) {
  return resolveCinematicVariant(data) === CINEMATIC_VARIANT.DEMOLISHED_CHARGED;
}

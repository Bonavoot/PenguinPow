/**
 * Clinch throw-fail audio resolution (RESISTED / Perfect Brace).
 * Pure — tests use realistic server payloads without React/socket.
 */

import { CUE } from "./cueRegistry.js";

/**
 * @param {object} data - clinch_throw_fail payload
 * @returns {null | { cue: string, eventId: string, kind: string }}
 */
export function resolveClinchThrowFailAudio(data) {
  if (!data || typeof data !== "object") return null;

  const eventId =
    data.failId ||
    data.combatPresentation?.eventId ||
    (data.perfectBrace
      ? `perfect-brace-fallback`
      : null);

  if (data.perfectBrace) {
    if (!eventId) return null;
    return {
      cue: CUE.CLINCH_PERFECT_BRACE,
      eventId: String(eventId),
      kind: "perfect_brace",
    };
  }

  // Ordinary held-Plant RESISTED (server sets resistedByPlant + failId).
  if (data.resistedByPlant || data.failId) {
    const id = eventId || `clinch-fail-unknown`;
    return {
      cue: CUE.CLINCH_THROW_RESISTED,
      eventId: String(id),
      kind: "resisted",
    };
  }

  return null;
}

/**
 * Apply presentation claim + audio in one successful owner path.
 * Returns whether audio was requested.
 */
export function applyClinchThrowFailPresentationAndAudio({
  data,
  claimPresentationEvent,
  readCombatPresentation,
  playCombatCue,
  onPerfectBraceVisual,
  onResistedVisual,
}) {
  if (!data) return { audio: false, reason: "no_data" };

  const pres =
    typeof readCombatPresentation === "function"
      ? readCombatPresentation(data)
      : data.combatPresentation || null;

  if (pres?.eventId && typeof claimPresentationEvent === "function") {
    if (!claimPresentationEvent(pres.eventId)) {
      return { audio: false, reason: "presentation_deduped" };
    }
  }

  const resolved = resolveClinchThrowFailAudio(data);
  if (!resolved) {
    return { audio: false, reason: "unmapped_failure" };
  }

  if (resolved.kind === "perfect_brace") {
    if (typeof onPerfectBraceVisual === "function") onPerfectBraceVisual(data, pres);
  } else if (typeof onResistedVisual === "function") {
    onResistedVisual(data, pres);
  }

  // Prefer failId for audio dedupe so a prior visual-only claim cannot starve
  // audio when identity is shared — we already claimed presentation above in
  // this same successful path, then play once via failId/eventId.
  const audioEventId = data.failId || resolved.eventId;
  const result =
    typeof playCombatCue === "function"
      ? playCombatCue(resolved.cue, {
          eventId: audioEventId,
          actorId: data.targetId || data.defenderId || `p${data.playerNumber || 1}`,
          authoritative: true,
          pan: 0,
        })
      : { played: false };

  return {
    audio: !!(result && result.played),
    cue: resolved.cue,
    kind: resolved.kind,
    reason: result?.reason || (result?.played ? "played" : "not_played"),
  };
}

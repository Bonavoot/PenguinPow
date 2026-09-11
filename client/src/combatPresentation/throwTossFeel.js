/**
 * Client mirror of server-io/throwTossMotion juice knobs.
 * Motion itself is server Y; this only grades crowd / smear / land.
 */

export function clamp01(v) {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(1, n));
}

export function throwTossCrowdIntensity(power) {
  const p = clamp01(power);
  if (p >= 0.82) return "heavy";
  if (p >= 0.48) return "medium";
  return null;
}

export function throwTossSmear(power) {
  return clamp01(power) >= 0.5;
}

export function throwTossLandIntensity(power) {
  return 0.62 + clamp01(power) * 0.38;
}

/** Same gate as the strong-pull launch whoosh. Smoke + whoosh only here. */
export const STRONG_SEND_POWER = 0.55;

export function isStrongSend(power) {
  return clamp01(power) >= STRONG_SEND_POWER;
}

/** The other belt in a 1v1. */
export function opponentPlayerNumber(playerNumber) {
  return playerNumber === 1 ? 2 : 1;
}

/** Resolve P1/P2 from a fighter id. Smoke color uses the attacker/sender. */
export function playerNumberFromIds(localId, targetId, localPlayerNumber) {
  if (!targetId) return opponentPlayerNumber(localPlayerNumber);
  return targetId === localId
    ? localPlayerNumber
    : opponentPlayerNumber(localPlayerNumber);
}

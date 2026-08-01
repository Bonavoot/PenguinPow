/**
 * Event-time local-fighter selection for input command classification.
 * Prefer the live fighter_action snapshot over sanitized room/lobby summaries.
 */

import { getSharedFighterState } from "../net/fighterSnapshotBus.js";

/**
 * @param {object} opts
 * @param {string} opts.localId
 * @param {object|null|undefined} opts.roomPlayer - rooms[] summary player (fallback only)
 * @param {() => { player1?: object|null, player2?: object|null }} [opts.getSharedState]
 * @returns {{
 *   fighter: object|null,
 *   facing: 1|-1|null,
 *   facingSource: "live_snapshot"|"room_summary_fallback"|"none",
 *   roomFacing: 1|-1|null,
 *   liveFacing: 1|-1|null,
 * }}
 */
export function selectLiveLocalFighter({
  localId,
  roomPlayer = null,
  getSharedState = getSharedFighterState,
} = {}) {
  const roomFacing =
    roomPlayer?.facing === 1 || roomPlayer?.facing === -1
      ? roomPlayer.facing
      : null;

  if (!localId) {
    return {
      fighter: roomPlayer || null,
      facing: roomFacing,
      facingSource: roomFacing != null ? "room_summary_fallback" : "none",
      roomFacing,
      liveFacing: null,
    };
  }

  const shared = typeof getSharedState === "function" ? getSharedState() : null;
  const p1 = shared?.player1 || null;
  const p2 = shared?.player2 || null;
  // Never pick a snapshot whose id does not match localId (BASHO bout reuse).
  const live =
    (p1?.id === localId ? p1 : null) || (p2?.id === localId ? p2 : null);

  const liveFacing =
    live && (live.facing === 1 || live.facing === -1) ? live.facing : null;

  if (liveFacing != null) {
    return {
      fighter: live,
      facing: liveFacing,
      facingSource: "live_snapshot",
      roomFacing,
      liveFacing,
    };
  }

  if (roomFacing != null) {
    return {
      fighter: roomPlayer,
      facing: roomFacing,
      facingSource: "room_summary_fallback",
      roomFacing,
      liveFacing,
    };
  }

  return {
    fighter: live || roomPlayer || null,
    facing: null,
    facingSource: "none",
    roomFacing,
    liveFacing,
  };
}

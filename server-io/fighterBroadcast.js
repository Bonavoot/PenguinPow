/**
 * Phase 5 — build fighter_action payloads with seq / simTime / keyframes.
 * Kept separate from the tick loop so unit tests can exercise packet shape
 * without spinning the full game server.
 */
const { KEYFRAME_EVERY_N_BROADCASTS } = require("./constants");
const { computePlayerDelta, clonePlayerState } = require("./deltaState");

/**
 * @param {object} room
 * @param {object} [opts]
 * @param {boolean} [opts.forceKeyframe]
 * @param {boolean} [opts.isResync] — per-client recovery; does not advance room seq
 * @param {number|null} [opts.seq] — override seq (resync uses current room seq)
 * @param {boolean} [opts.masteryP5]
 * @returns {{ packet: object, previousPlayerStates: [object, object] }}
 */
function buildFighterActionPacket(room, opts = {}) {
  const forceKeyframe = !!opts.forceKeyframe;
  const isResync = !!opts.isResync;
  if (!room.previousPlayerStates) {
    room.previousPlayerStates = [null, null];
  }
  if (room.broadcastSeq == null) room.broadcastSeq = 0;

  let seq;
  if (typeof opts.seq === "number") {
    seq = opts.seq;
  } else if (isResync) {
    seq = room.broadcastSeq || 0;
  } else {
    room.broadcastSeq = (room.broadcastSeq || 0) + 1;
    seq = room.broadcastSeq;
  }

  const keyframeEvery =
    opts.keyframeEveryN != null
      ? opts.keyframeEveryN
      : KEYFRAME_EVERY_N_BROADCASTS;

  const needsKeyframe =
    forceKeyframe ||
    isResync ||
    !room.previousPlayerStates[0] ||
    !room.previousPlayerStates[1] ||
    (keyframeEvery > 0 && seq > 0 && seq % keyframeEvery === 0);

  const prev0 = needsKeyframe ? null : room.previousPlayerStates[0];
  const prev1 = needsKeyframe ? null : room.previousPlayerStates[1];

  const player1 = computePlayerDelta(room.players[0], prev0);
  const player2 = computePlayerDelta(room.players[1], prev1);

  const nextPrevious = [
    clonePlayerState(room.players[0]),
    clonePlayerState(room.players[1]),
  ];

  const packet = {
    player1,
    player2,
    isDelta: !needsKeyframe,
    isKeyframe: needsKeyframe,
    isResync: isResync || undefined,
    seq,
    simTime: room.simTime ?? null,
    masteryP5: !!opts.masteryP5,
  };
  if (!packet.isResync) delete packet.isResync;

  return { packet, previousPlayerStates: nextPrevious, needsKeyframe };
}

module.exports = {
  buildFighterActionPacket,
};

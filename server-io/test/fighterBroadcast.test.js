const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildFighterActionPacket } = require("../fighterBroadcast");
const { createInitialPlayerState } = require("../playerFactory");
const { KEYFRAME_EVERY_N_BROADCASTS } = require("../constants");

function makeRoom() {
  return {
    id: "test-room",
    simTime: 1_000_000,
    broadcastSeq: 0,
    previousPlayerStates: [null, null],
    players: [
      createInitialPlayerState({
        id: "p1",
        fighter: "player 1",
        x: 220,
        facing: 1,
      }),
      createInitialPlayerState({
        id: "p2",
        fighter: "player 2",
        x: 900,
        facing: -1,
      }),
    ],
  };
}

describe("fighterBroadcast Phase 5", () => {
  it("first packet is a keyframe with seq/simTime", () => {
    const room = makeRoom();
    const { packet, previousPlayerStates, needsKeyframe } =
      buildFighterActionPacket(room, { masteryP5: false });
    assert.equal(needsKeyframe, true);
    assert.equal(packet.isKeyframe, true);
    assert.equal(packet.isDelta, false);
    assert.equal(packet.seq, 1);
    assert.equal(packet.simTime, 1_000_000);
    assert.ok(packet.player1.x === 220);
    assert.ok(packet.player2.x === 900);
    assert.ok(previousPlayerStates[0]);
    assert.ok(previousPlayerStates[1]);
  });

  it("subsequent packets are deltas until keyframe interval", () => {
    const room = makeRoom();
    let { packet, previousPlayerStates } = buildFighterActionPacket(room, {
      masteryP5: true,
      keyframeEveryN: 64,
    });
    room.previousPlayerStates = previousPlayerStates;

    room.players[0].x = 230;
    ({ packet, previousPlayerStates } = buildFighterActionPacket(room, {
      masteryP5: true,
      keyframeEveryN: 64,
    }));
    room.previousPlayerStates = previousPlayerStates;

    assert.equal(packet.seq, 2);
    assert.equal(packet.isDelta, true);
    assert.equal(packet.isKeyframe, false);
    assert.equal(packet.masteryP5, true);
    assert.equal(packet.player1.x, 230);
  });

  it("emits keyframe every KEYFRAME_EVERY_N_BROADCASTS", () => {
    const room = makeRoom();
    let previousPlayerStates = [null, null];
    let packet;
    for (let i = 0; i < KEYFRAME_EVERY_N_BROADCASTS; i++) {
      room.previousPlayerStates = previousPlayerStates;
      ({ packet, previousPlayerStates } = buildFighterActionPacket(room, {
        keyframeEveryN: KEYFRAME_EVERY_N_BROADCASTS,
      }));
    }
    assert.equal(packet.seq, KEYFRAME_EVERY_N_BROADCASTS);
    assert.equal(packet.isKeyframe, true);
    assert.equal(packet.isDelta, false);
  });

  it("resync is full snapshot without advancing seq", () => {
    const room = makeRoom();
    let { previousPlayerStates } = buildFighterActionPacket(room, {});
    room.previousPlayerStates = previousPlayerStates;
    ({ previousPlayerStates } = buildFighterActionPacket(room, {}));
    room.previousPlayerStates = previousPlayerStates;
    const seqBefore = room.broadcastSeq;

    const { packet } = buildFighterActionPacket(room, {
      forceKeyframe: true,
      isResync: true,
      masteryP5: false,
    });
    assert.equal(room.broadcastSeq, seqBefore);
    assert.equal(packet.seq, seqBefore);
    assert.equal(packet.isResync, true);
    assert.equal(packet.isKeyframe, true);
    assert.equal(packet.isDelta, false);
  });
});

"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  createContactScenario,
  armSlap,
  placeInConnectRange,
  processHit,
} = require("./helpers/contactSim");
const {
  armPerfectParryStun,
  clearAllActionStates,
  timeoutManager,
  advanceRoomSimTime,
} = require("../../gameUtils");
const { PERFECT_PARRY_ATTACKER_STUN_DURATION } = require("../../constants");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) {
    const s = scenarios.pop();
    timeoutManager.clearPlayer(s.left.id);
    timeoutManager.clearPlayer(s.right.id);
    s.dispose();
  }
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function stunTimerArmed(player) {
  return !!timeoutManager.namedTimeouts.get(player.id)?.has("perfectParryStunReset");
}

describe("Perfect parry stun duration", () => {
  it("survives clearAllActionStates (hit interrupt)", () => {
    const s = sc();
    armPerfectParryStun(s.left, PERFECT_PARRY_ATTACKER_STUN_DURATION);
    assert.equal(s.left.isRawParryStun, true);
    assert.equal(stunTimerArmed(s.left), true);

    clearAllActionStates(s.left);

    assert.equal(s.left.isRawParryStun, true, "starstun must outlive the hit clear");
    assert.equal(stunTimerArmed(s.left), true, "duration timer must not be cancelled");
    assert.ok(s.left.perfectParryStunUntil > s.simTime);
  });

  it("processHit does not cancel the stun or its timer", () => {
    const s = sc({ gap: 80 });
    armPerfectParryStun(s.right, PERFECT_PARRY_ATTACKER_STUN_DURATION);
    armSlap(s.left, { now: s.simTime });
    placeInConnectRange(s.left, s.right, "slap");

    processHit(s.left, s.right, s.rooms, s.io);

    assert.equal(s.right.isRawParryStun, true);
    assert.equal(stunTimerArmed(s.right), true);
  });

  it("ends only when the duration elapses", () => {
    const s = sc();
    const duration = 180;
    armPerfectParryStun(s.left, duration);
    clearAllActionStates(s.left);

    advanceRoomSimTime(s.room, duration - 1);
    timeoutManager.processRoom(s.room);
    assert.equal(s.left.isRawParryStun, true, "still stunned before the clock pops");

    advanceRoomSimTime(s.room, 1);
    timeoutManager.processRoom(s.room);
    assert.equal(s.left.isRawParryStun, false);
    assert.equal(s.left.perfectParryStunUntil, 0);
  });

  it("command-grab connect ends starstun so clinch owns the pose", () => {
    const s = sc({ gap: 80 });
    armPerfectParryStun(s.right, PERFECT_PARRY_ATTACKER_STUN_DURATION);
    s.left.isGrabbing = true;
    s.left.grabbedOpponent = s.right.id;
    s.left.grabVariant = "drive";
    s.left.hasGrip = true;
    s.right.isBeingGrabbed = true;
    s.right.hasGrip = true;

    const { beginCommandGrab } = require("../../commandGrabSystem");
    beginCommandGrab(s.left, s.right, s.room, s.io);

    assert.equal(s.right.isRawParryStun, false);
    assert.equal(stunTimerArmed(s.right), false);
  });
});

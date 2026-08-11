"use strict";

/**
 * M1 → M2 follow-up buffer (pendingGrab).
 *
 * A slap sets neither isRecovering nor actionLockUntil, so shouldBlockAction()
 * stays false for its whole cycle and the generic inputBuffer never sees an M2
 * pressed mid-slap — while canPlayerUseAction still rejects the direct grab
 * handler because isAttacking is set. Between those two, the press had nowhere
 * to land and was silently dropped: M1→M1 chained but M1→M2 did nothing.
 *
 * pendingGrab is the mouse2 counterpart to pendingSlapCount / pendingPalmThrust,
 * drained by endSlapCycle. It guarantees the input REGISTERS, not that the grab
 * lands: slap is +0, so the grab's startup opens on the same instant the victim
 * becomes actionable and the follow-up stays fully contestable — the same
 * contract the buffered slap already ships with.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  createFoundationScenario,
  advanceSim,
} = require("../foundation/helpers/scenarioHarness");
const { executeSlapAttack } = require("../../gameFunctions");
const {
  SLAP_TOTAL_MS,
  SLAP_WHIFF_EXTRA_RECOVERY_MS,
  TICK_RATE,
} = require("../../constants");

const TICK_MS = 1000 / TICK_RATE;
// These slaps whiff (no collision is stepped), so the cycle serves its whiff
// surcharge before endSlapCycle drains the queues. Overshoot by a few ticks.
const PAST_CYCLE_MS =
  SLAP_TOTAL_MS + SLAP_WHIFF_EXTRA_RECOVERY_MS + 4 * TICK_MS;

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(options) {
  const s = createFoundationScenario(options);
  scenarios.push(s);
  return s;
}

function runPastSlapCycle(s) {
  for (let elapsed = 0; elapsed < PAST_CYCLE_MS; elapsed += TICK_MS) {
    advanceSim(s, TICK_MS);
  }
}

// Mid-slap M2, exactly as socketHandlers queues it.
function queueGrab(player, at) {
  player.pendingGrab = true;
  player.pendingGrabPressTime = at;
}

// Mid-slap M1, exactly as socketHandlers queues it.
function queueSlap(player, at) {
  player.pendingSlapCount = 1;
  player.pendingSlapPressTime = at;
}

describe("M1 → M2 follow-up buffer", () => {
  it("M2 pressed mid-slap starts the grab at cycle end", () => {
    const s = sc();
    const p = s.left;
    executeSlapAttack(p, s.rooms);
    assert.equal(p.isAttacking, true, "slap must be in flight");

    queueGrab(p, s.room.simTime);
    runPastSlapCycle(s);

    assert.equal(p.isGrabStartup, true, "queued grab must fire at cycle end");
    assert.equal(p.isAttacking, false, "slap must have ended");
    assert.equal(p.pendingGrab, false, "queue must be consumed");
    assert.equal(p.pendingGrabPressTime, 0);
  });

  it("a slap with nothing queued still ends in neutral", () => {
    const s = sc();
    const p = s.left;
    executeSlapAttack(p, s.rooms);
    runPastSlapCycle(s);

    assert.equal(p.isGrabStartup, false, "no queue must not invent a grab");
    assert.equal(p.isAttacking, false);
  });

  it("later press wins: M1 then M2 gives the grab", () => {
    const s = sc();
    const p = s.left;
    executeSlapAttack(p, s.rooms);

    queueSlap(p, s.room.simTime);
    queueGrab(p, s.room.simTime + 50);
    runPastSlapCycle(s);

    assert.equal(p.isGrabStartup, true, "the later M2 must win");
    assert.equal(p.pendingSlapCount, 0, "the losing slap must be discarded");
  });

  it("later press wins: M2 then M1 gives the slap and discards the grab", () => {
    const s = sc();
    const p = s.left;
    executeSlapAttack(p, s.rooms);

    queueGrab(p, s.room.simTime);
    queueSlap(p, s.room.simTime + 50);
    runPastSlapCycle(s);

    assert.equal(p.isGrabStartup, false, "the later M1 must win");
    assert.equal(p.isAttacking, true, "follow-up slap must be in flight");
    assert.equal(p.attackType, "slap");
    // Discarded rather than deferred — a queued action must never surface a
    // cycle late, after the player has moved on.
    assert.equal(p.pendingGrab, false);
  });

  it("a palm thrust follow-up still wins, and drops the queued grab", () => {
    const s = sc();
    const p = s.left;
    executeSlapAttack(p, s.rooms);

    p.pendingPalmThrust = true;
    queueGrab(p, s.room.simTime);
    runPastSlapCycle(s);

    assert.equal(p.isGrabStartup, false, "palm chord keeps its priority");
    assert.equal(p.pendingGrab, false);
  });

  it("grab cooldown at cycle end drops the queue instead of deferring it", () => {
    const s = sc();
    const p = s.left;
    executeSlapAttack(p, s.rooms);

    queueGrab(p, s.room.simTime);
    p.grabCooldown = true;
    runPastSlapCycle(s);

    assert.equal(p.isGrabStartup, false, "cooldown must reject the grab");
    assert.equal(p.pendingGrab, false, "and must not leave it armed");
  });
});

"use strict";

/**
 * Phase 2 — recovery is committed / uncancellable.
 * Dodge and sidestep rejected for the entire isRecovering window.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { processInputPacket } = require("../../socketHandlers");
const {
  canPlayerDash,
  canPlayerSidestep,
  beginPlayerDodge,
  simNowForPlayer,
} = require("../../gameUtils");
const {
  createFoundationScenario,
  armChargedPhase,
} = require("./helpers/scenarioHarness");
const { makeInputPacket } = require("../clinch/harness/networkQueue");
const { createInitialKeys } = require("../../playerFactory");

const live = [];
afterEach(() => {
  while (live.length) live.pop().dispose();
});

function sc() {
  const s = createFoundationScenario();
  live.push(s);
  return s;
}

function blankKeys(over = {}) {
  return { ...createInitialKeys(), ...over };
}

function armRecovery(player, now, durationMs = 280) {
  player.isRecovering = true;
  player.recoveryStartTime = now;
  player.recoveryDuration = durationMs;
  player.recoveryDirection = null;
  player.movementVelocity = 0;
  player.isDodging = false;
  player.isSidestepping = false;
  player.keys = blankKeys();
  player.inputBuffer = null;
  player.bufferedAction = null;
  player.shiftJustPressed = false;
  player.canMoveToReady = false;
  player.isGassed = false;
  player.actionLockUntil = 0;
  player.dodgeCooldownUntil = 0;
}

function pressShift(room, player, io, rooms, { s = false } = {}) {
  player.keys = blankKeys({ shift: false, s: false });
  const keys = blankKeys({ shift: true, s });
  processInputPacket(
    room,
    player,
    makeInputPacket({
      id: player.id,
      keys,
      events: [{ k: "shift", a: "down", t: 1 }],
    }),
    io,
    rooms
  );
}

describe("Phase 2 — recovery uncancellable", () => {
  it("source no longer promises a 100 ms recovery dodge/sidestep cancel", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../socketHandlers.js"),
      "utf8"
    );
    assert.equal(src.includes("recoveryAge > 100"), false);
    assert.equal(/allowDodgeCancelRecovery/.test(src), false);
    assert.equal(/Allow dodge to cancel recovery/.test(src), false);
  });

  it("canPlayerDash / canPlayerSidestep reject for entire recovery window", () => {
    const s = sc();
    const p = s.left;
    const now = s.room.simTime;
    armRecovery(p, now, 280);

    for (const age of [0, 99, 100, 101, 200, 279]) {
      s.room.simTime = now + age;
      assert.equal(canPlayerDash(p), false, `dash @${age}ms`);
      assert.equal(canPlayerSidestep(p), false, `sidestep @${age}ms`);
    }

    // Final active recovery tick (edge: still recovering while elapsed < duration)
    s.room.simTime = now + 279;
    assert.equal(p.isRecovering, true);
    assert.equal(canPlayerDash(p), false);

    // After authoritative clear + normal eligibility
    p.isRecovering = false;
    p.recoveryStartTime = 0;
    s.room.simTime = now + 280;
    assert.equal(canPlayerDash(p), true);
    assert.equal(canPlayerSidestep(p), true);
  });

  it("processInputPacket Shift rejected at 0/99/100/150ms; accepted after clear", () => {
    const s = sc();
    const p = s.left;
    const now = s.room.simTime;
    armRecovery(p, now, 280);

    for (const age of [0, 99, 100, 150]) {
      s.room.simTime = now + age;
      p.isRecovering = true;
      p.isDodging = false;
      pressShift(s.room, p, s.io, s.rooms);
      assert.equal(p.isRecovering, true, `still recovering @${age}`);
      assert.equal(p.isDodging, false, `no dodge @${age}`);
    }

    p.isRecovering = false;
    p.recoveryStartTime = 0;
    p.inputBuffer = null;
    p.keys = blankKeys();
    s.room.simTime = now + 300;
    pressShift(s.room, p, s.io, s.rooms);
    assert.equal(p.isDodging, true, "dodge after recovery clears");
  });

  it("S+Shift during recovery does not start sidestep", () => {
    const s = sc();
    const p = s.left;
    const now = s.room.simTime;
    armRecovery(p, now, 280);
    s.room.simTime = now + 150;
    pressShift(s.room, p, s.io, s.rooms, { s: true });
    assert.equal(p.isSidestepping, false);
    assert.equal(p.isRecovering, true);
  });

  it("buffered Shift is a single slot — no duplicate dodge from spam while recovering", () => {
    const s = sc();
    const p = s.left;
    const now = s.room.simTime;
    armRecovery(p, now, 280);
    s.room.simTime = now + 50;

    pressShift(s.room, p, s.io, s.rooms);
    assert.equal(p.inputBuffer?.type, "dodge");
    const firstTs = p.inputBuffer.timestamp;

    // Second press overwrites the same buffer slot (does not stack).
    p.keys = blankKeys();
    pressShift(s.room, p, s.io, s.rooms);
    assert.equal(p.inputBuffer?.type, "dodge");
    assert.ok(p.inputBuffer.timestamp >= firstTs);
    assert.equal(p.isDodging, false);

    // After recovery, one beginPlayerDodge from buffer path — not two concurrent.
    p.isRecovering = false;
    assert.equal(canPlayerDash(p), true);
    beginPlayerDodge(p, { nowSim: simNowForPlayer(p) });
    assert.equal(p.isDodging, true);
    const firstDodgeStart = p.dodgeStartTime;
    // Second begin while already dodging is gated by canPlayerDash
    assert.equal(canPlayerDash(p), false);
    assert.equal(p.dodgeStartTime, firstDodgeStart);
  });

  it("hitstun / clinch / ropes / throw / gassed / round-lock remain blocked", () => {
    const s = sc();
    const p = s.left;
    p.keys = blankKeys();
    p.canMoveToReady = false;
    p.actionLockUntil = 0;
    p.dodgeCooldownUntil = 0;
    p.isRecovering = false;

    const dashBlocked = [
      { isHit: true },
      { isAtTheRopes: true },
      { isThrowing: true },
      { isBeingThrown: true },
      { isBeingGrabbed: true },
      { isGrabbing: true },
    ];

    for (const flags of dashBlocked) {
      Object.assign(p, {
        isHit: false,
        isAtTheRopes: false,
        isThrowing: false,
        isBeingThrown: false,
        isBeingGrabbed: false,
        isGrabbing: false,
        isGassed: false,
        inClinch: false,
        isDodging: false,
        actionLockUntil: 0,
        ...flags,
      });
      assert.equal(canPlayerDash(p), false, JSON.stringify(flags));
    }

    // Clinch shell: grab/being-grabbed flags reject dash (canPlayerDash).
    Object.assign(p, {
      isHit: false,
      isAtTheRopes: false,
      isThrowing: false,
      isBeingThrown: false,
      isBeingGrabbed: true,
      isGrabbing: false,
      inClinch: true,
      hasGrip: true,
      isDodging: false,
    });
    assert.equal(canPlayerDash(p), false, "clinch/grabbed: dash rejected");
    pressShift(s.room, p, s.io, s.rooms);
    assert.equal(p.isDodging, false, "clinch/grabbed: no dodge");

    // Open (isClinchOpen): technique path stays blocked; dash eligibility often
    // coexists with action locks from clinch exit (preserve — do not retune).
    Object.assign(p, {
      inClinch: false,
      isBeingGrabbed: false,
      isGrabbing: false,
      isClinchOpen: true,
      actionLockUntil: s.room.simTime + 400,
      isDodging: false,
    });
    assert.equal(canPlayerDash(p), false, "Open window with action lock");

    // Gassed: canPlayerDash allows, socket path blocks
    Object.assign(p, {
      isClinchOpen: false,
      actionLockUntil: 0,
      isBeingGrabbed: false,
      isGrabbing: false,
      isGassed: true,
      isDodging: false,
    });
    assert.equal(canPlayerDash(p), true);
    pressShift(s.room, p, s.io, s.rooms);
    assert.equal(p.isDodging, false, "gassed: no dodge");

    // Round / action lock
    Object.assign(p, {
      isGassed: false,
      actionLockUntil: s.room.simTime + 5000,
      isDodging: false,
    });
    assert.equal(canPlayerDash(p), false);
  });

  it("armChargedPhase recovery characterization stays uncancellable", () => {
    const s = sc();
    const now = s.room.simTime;
    armChargedPhase(s.left, "recovery", now);
    assert.equal(s.left.isRecovering, true);
    assert.equal(canPlayerDash(s.left), false);
    pressShift(s.room, s.left, s.io, s.rooms);
    assert.equal(s.left.isDodging, false);
    assert.equal(s.left.isRecovering, true);
  });
});

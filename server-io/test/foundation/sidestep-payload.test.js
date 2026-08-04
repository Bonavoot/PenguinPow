"use strict";

/**
 * Phase 2 — sidestepDirection on delta/keyframe contract + lifecycle clear.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  DELTA_TRACKED_PROPS,
  SIDESTEP_ACTIVE_MS,
  SIDESTEP_STARTUP_MS,
  SIDESTEP_TOTAL_MS,
} = require("../../constants");
const { computePlayerDelta, clonePlayerState } = require("../../deltaState");
const {
  getSidestepInitData,
  clearAllActionStates,
} = require("../../gameUtils");
const {
  createFoundationScenario,
  armSidestepPhase,
  resetRematch,
} = require("./helpers/scenarioHarness");

const live = [];
afterEach(() => {
  while (live.length) live.pop().dispose();
});

function sc(opts) {
  const s = createFoundationScenario(opts);
  live.push(s);
  return s;
}

describe("Phase 2 — sidestep payload / direction lifecycle", () => {
  it("sidestepDirection is on DELTA_TRACKED_PROPS; active duration remains 400", () => {
    assert.ok(DELTA_TRACKED_PROPS.includes("sidestepDirection"));
    assert.equal(SIDESTEP_ACTIVE_MS, 400);
    assert.equal(SIDESTEP_STARTUP_MS, 50);
  });

  it("getSidestepInitData travel is independent of facing", () => {
    // left of opponent → travel +X (1)
    assert.equal(getSidestepInitData(400, 600).direction, 1);
    // right of opponent → travel −X (-1)
    assert.equal(getSidestepInitData(600, 400).direction, -1);
  });

  it("direction left/right for both slots; facing agree and oppose", () => {
    const s = sc();
    const now = s.room.simTime;

    // P1 slot travel right while facing left (agree with typical matchup)
    armSidestepPhase(s.left, "active", now, 1);
    s.left.facing = -1;
    assert.equal(s.left.sidestepDirection, 1);
    assert.notEqual(s.left.sidestepDirection, s.left.facing);

    // P2 slot travel left while facing right (oppose travel)
    armSidestepPhase(s.right, "active", now, -1);
    s.right.facing = -1; // same facing as travel
    assert.equal(s.right.sidestepDirection, -1);
    assert.equal(s.right.sidestepDirection, s.right.facing);

    // Cross-up noise: locomotion facing flips mid-active, travel stays
    s.left.facing = 1;
    assert.equal(s.left.sidestepDirection, 1);
  });

  it("ordinary delta includes changed direction; 0 clears; keyframe preserves", () => {
    const s = sc();
    const p = s.left;
    p.sidestepDirection = 0;
    const prev = clonePlayerState(p);

    p.sidestepDirection = 1;
    p.isSidestepping = true;
    p.isSidestepStartup = true;
    let delta = computePlayerDelta(p, prev);
    assert.equal(delta.sidestepDirection, 1);
    assert.equal(delta.isSidestepping, true);

    const mid = clonePlayerState(p);
    p.facing = 1; // cross-up facing change
    // direction unchanged → omitted from delta
    delta = computePlayerDelta(p, mid);
    assert.equal(Object.prototype.hasOwnProperty.call(delta, "sidestepDirection"), false);

    // Completion clear uses neutral 0 (not undefined)
    const prevActive = clonePlayerState(p);
    p.sidestepDirection = 0;
    p.isSidestepping = false;
    p.isSidestepRecovery = false;
    delta = computePlayerDelta(p, prevActive);
    assert.equal(delta.sidestepDirection, 0);

    // Keyframe / resync (!previousState) includes direction
    p.sidestepDirection = -1;
    const keyframe = computePlayerDelta(p, null);
    assert.equal(keyframe.sidestepDirection, -1);
  });

  it("startup / interruption / recovery / rematch cleanup clear direction", () => {
    const s = sc();
    const now = s.room.simTime;
    armSidestepPhase(s.left, "startup", now, 1);
    assert.equal(s.left.sidestepDirection, 1);

    armSidestepPhase(s.left, "recovery", now, 1);
    assert.equal(s.left.sidestepDirection, 1);

    // Interrupt-style cleanup (grab / action clear)
    clearAllActionStates(s.left);
    assert.equal(s.left.sidestepDirection, 0);
    assert.equal(s.left.isSidestepping, false);

    armSidestepPhase(s.left, "active", now, -1);
    assert.equal(s.left.sidestepDirection, -1);
    resetRematch(s);
    assert.equal(s.left.sidestepDirection, 0);
    assert.equal(s.right.sidestepDirection, 0);
  });

  it("stale cleanup cannot clear a newer sidestep direction", () => {
    const s = sc();
    const now = s.room.simTime;
    armSidestepPhase(s.left, "active", now, 1);
    assert.equal(s.left.sidestepDirection, 1);

    clearAllActionStates(s.left);
    assert.equal(s.left.sidestepDirection, 0);
    armSidestepPhase(s.left, "active", now + SIDESTEP_TOTAL_MS, -1);
    assert.equal(s.left.sidestepDirection, -1);
    // Clearing the peer must not wipe this player's live travel direction.
    const dirBefore = s.left.sidestepDirection;
    clearAllActionStates(s.right);
    assert.equal(s.left.sidestepDirection, dirBefore);
  });

  it("clearAllActionStates clears sidestepDirection for round/interrupt reset", () => {
    const s = sc();
    armSidestepPhase(s.left, "active", s.room.simTime, 1);
    clearAllActionStates(s.left);
    assert.equal(s.left.sidestepDirection, 0);
  });
});

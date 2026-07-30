"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_EDGE_PIN_HOLD_MS,
  CLINCH_EDGE_ZONE_THRESHOLD,
} = require("../../../constants");
const {
  createClinchScenario,
  withRoleSwap,
  MAP_RIGHT_BOUNDARY,
  MAP_LEFT_BOUNDARY,
} = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

/**
 * Drive grabber into victim at right edge with committed push.
 */
function startRightEdgePin(s) {
  s.placeVictimAtRightEdge();
  s.setCommittedDrive(s.grabber);
  s.holdNeutral(s.grabbed);
  s.stepOnce();
}

describe("Edge pin behavior", () => {
  it(`pin hold is ${CLINCH_EDGE_PIN_HOLD_MS}ms`, () => {
    assert.equal(CLINCH_EDGE_PIN_HOLD_MS, 1500);
  });

  it("healthy defender accumulates pin; ring-out after hold duration", () => {
    const s = sc();
    startRightEdgePin(s);
    assert.ok(s.grabbed.clinchEdgePinStart > 0 || s.grabber.isEdgePushing);
    // Keep driving for the hold duration
    const start = s.now();
    while (s.now() - start < CLINCH_EDGE_PIN_HOLD_MS + 50 && !s.room.gameOver) {
      s.setCommittedDrive(s.grabber);
      s.holdNeutral(s.grabbed);
      s.advance(s.tickMs);
    }
    assert.equal(s.room.gameOver, true, "pin hold should force ring-out");
  });

  it("instant ring-out when victim stamina is 0", () => {
    const s = sc({ p2Stamina: 0 });
    startRightEdgePin(s);
    assert.equal(s.room.gameOver, true);
  });

  it("instant ring-out when victim is gassed", () => {
    const s = sc();
    s.setGassed(s.grabbed);
    startRightEdgePin(s);
    assert.equal(s.room.gameOver, true);
  });

  it("instant ring-out when victim is Open", () => {
    const s = sc();
    s.setOpen(s.grabbed, s.now() + 2000);
    startRightEdgePin(s);
    assert.equal(s.room.gameOver, true);
  });

  it("pin cancels when shove stops", () => {
    const s = sc();
    startRightEdgePin(s);
    const pinStart = s.grabbed.clinchEdgePinStart;
    assert.ok(pinStart > 0);
    s.holdNeutral(s.grabber);
    s.stepOnce();
    assert.equal(s.grabbed.clinchEdgePinStart, 0);
    assert.equal(s.room.gameOver, false);
  });

  it("1 tick before hold expires: no ring-out yet", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    const pinStart = s.grabbed.clinchEdgePinStart;
    assert.ok(pinStart > 0);
    // Advance to 1ms before expiry
    const target = pinStart + CLINCH_EDGE_PIN_HOLD_MS - 1;
    while (s.now() < target && !s.room.gameOver) {
      s.setCommittedDrive(s.grabber);
      s.holdNeutral(s.grabbed);
      const step = Math.min(s.tickMs, target - s.now());
      s.advance(step);
    }
    assert.equal(s.room.gameOver, false);
    // Cross the boundary
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.advance(s.tickMs + 2);
    assert.equal(s.room.gameOver, true);
  });

  it("victim stops being Open on pin-resolution tick → hold path (not instant) if still healthy", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setOpen(s.grabbed, s.now() + 1);
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    // First tick: still Open → instant
    s.stepOnce();
    // If Open until was in the past relative to applyClinchOpen timeout — we set flag directly.
    // Clearing Open before drive:
    s.dispose();
    scenarios.pop();

    const s2 = sc();
    s2.placeVictimAtRightEdge();
    s2.setOpen(s2.grabbed, s2.now() + 5000);
    // Clear Open on the exact tick before pin check
    s2.clearOpen(s2.grabbed);
    s2.setCommittedDrive(s2.grabber);
    s2.holdNeutral(s2.grabbed);
    s2.stepOnce();
    assert.equal(s2.room.gameOver, false, "healthy non-Open starts hold, not instant");
    assert.ok(s2.grabbed.clinchEdgePinStart > 0);
  });

  it("victim stops being gassed on pin tick → no instant if stamina > 0", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setGassed(s.grabbed);
    s.clearGassed(s.grabbed);
    s.setStamina(s.grabbed, 50);
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    assert.equal(s.room.gameOver, false);
    assert.ok(s.grabbed.clinchEdgePinStart > 0);
  });

  it("regaining stamina on pin tick: 0→1 before drive avoids instant", () => {
    const s = sc({ p2Stamina: 0 });
    s.placeVictimAtRightEdge();
    s.setStamina(s.grabbed, 1);
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    assert.equal(s.room.gameOver, false);
  });

  it("Break on pin-resolution tick: Break preempts edge pin", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setCommittedDrive(s.grabber);
    s.setBreakRequest(s.grabbed, s.now());
    s.stepOnce();
    assert.equal(s.grabbed.isGrabBreaking, true);
    assert.equal(s.room.gameOver, false);
  });

  it("Planting at edge does not by itself cause instant pin", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setCommittedDrive(s.grabber);
    s.setActivePlant(s.grabbed, s.now());
    s.stepOnce();
    assert.equal(s.room.gameOver, false);
  });

  it("input-locked victim still gets pin hold / instant rules from resources", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setInputLock(s.grabbed, s.now() + 1000);
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    assert.equal(s.room.gameOver, false);
    assert.ok(s.grabbed.clinchEdgePinStart > 0);
  });

  it("role swap: left-edge pin is symmetric", () => {
    withRoleSwap({}, (s, label) => {
      // Place grabbed at an edge relative to push direction
      if (s.grabber.x < s.grabbed.x) {
        s.placeVictimAtRightEdge();
      } else {
        s.placeVictimAtLeftEdge();
      }
      s.setStamina(s.grabbed, 0);
      s.setCommittedDrive(s.grabber);
      s.holdNeutral(s.grabbed);
      s.stepOnce();
      assert.equal(s.room.gameOver, true, `${label}: zero stam instant pin`);
    });
  });

  it("edge zone threshold constant available for drain tests", () => {
    assert.ok(CLINCH_EDGE_ZONE_THRESHOLD > 0);
    const s = sc();
    s.setPosition(s.grabbed, MAP_RIGHT_BOUNDARY - CLINCH_EDGE_ZONE_THRESHOLD + 1);
    s.setPosition(s.grabber, s.grabbed.x - 72);
    assert.ok(s.grabbed.x > MAP_LEFT_BOUNDARY);
  });
});

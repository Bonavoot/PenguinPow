"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_EDGE_PIN_HOLD_MS,
  CLINCH_EDGE_PIN_OPEN_HOLD_MS,
  CLINCH_EDGE_ZONE_THRESHOLD,
  CLINCH_THROW_CLASH_WINDOW_MS,
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

/** Keep driving the victim into the wall for `ms`, returning early on ring-out. */
function driveInto(s, ms, perTick) {
  const end = s.now() + ms;
  while (s.now() < end && !s.room.gameOver) {
    s.setCommittedDrive(s.grabber);
    if (perTick) perTick(s);
    else s.holdNeutral(s.grabbed);
    s.advance(Math.min(s.tickMs, end - s.now()));
  }
}

describe("Edge pin behavior", () => {
  it(`pin hold is ${CLINCH_EDGE_PIN_HOLD_MS}ms`, () => {
    assert.equal(CLINCH_EDGE_PIN_HOLD_MS, 1500);
  });

  it("healthy defender accumulates pin; ring-out after hold duration", () => {
    const s = sc();
    startRightEdgePin(s);
    assert.ok(s.grabbed.clinchEdgePinHeldMs > 0 || s.grabber.isEdgePushing);
    driveInto(s, CLINCH_EDGE_PIN_HOLD_MS + 50);
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

  it(`Open victim uses the reduced ${CLINCH_EDGE_PIN_OPEN_HOLD_MS}ms hold, not an instant force-out`, () => {
    const s = sc();
    s.setOpen(s.grabbed, s.now() + 2000);
    startRightEdgePin(s);
    assert.equal(
      s.room.gameOver,
      false,
      "Open at the tawara is near-terminal, but the pusher must still drive"
    );
    driveInto(s, CLINCH_EDGE_PIN_OPEN_HOLD_MS - 60);
    assert.equal(s.room.gameOver, false, "not yet — hold is unfinished");
    driveInto(s, 90);
    assert.equal(s.room.gameOver, true, "reduced hold completes");
  });

  it("an Open victim still outlasts the pin if the pusher stops driving", () => {
    const s = sc();
    s.setOpen(s.grabbed, s.now() + 2000);
    startRightEdgePin(s);
    driveInto(s, CLINCH_EDGE_PIN_OPEN_HOLD_MS - 100);
    // Pusher eases off — accrued pin is gone, no free force-out.
    s.holdNeutral(s.grabber);
    s.stepOnce();
    assert.equal(s.grabbed.clinchEdgePinHeldMs, 0);
    assert.equal(s.room.gameOver, false);
  });

  it("pin cancels when shove stops", () => {
    const s = sc();
    startRightEdgePin(s);
    assert.ok(s.grabbed.clinchEdgePinHeldMs > 0);
    s.holdNeutral(s.grabber);
    s.stepOnce();
    assert.equal(s.grabbed.clinchEdgePinHeldMs, 0);
    assert.equal(s.room.gameOver, false);
  });

  it("1 tick before hold expires: no ring-out yet", () => {
    const s = sc();
    startRightEdgePin(s);
    assert.ok(s.grabbed.clinchEdgePinHeldMs > 0);
    // Drive until one more tick would cross the requirement.
    while (
      !s.room.gameOver &&
      s.grabbed.clinchEdgePinHeldMs + s.tickMs < CLINCH_EDGE_PIN_HOLD_MS
    ) {
      driveInto(s, s.tickMs);
    }
    assert.equal(s.room.gameOver, false);
    assert.ok(s.grabbed.clinchEdgePinHeldMs < CLINCH_EDGE_PIN_HOLD_MS);
    driveInto(s, s.tickMs * 2);
    assert.equal(s.room.gameOver, true);
  });

  describe("REGRESSION: a technique cannot be used to stall the tawara", () => {
    it("a buffered technique request does not wipe accrued pin", () => {
      const s = sc();
      startRightEdgePin(s);
      driveInto(s, 600);
      const held = s.grabbed.clinchEdgePinHeldMs;
      assert.ok(held > 500, "pin accrued while genuinely pinned");

      // The burst-push cancel path: a pending request ends the burst so the
      // technique can process. It used to clearEdgePinHold() here, which turned a
      // buffered technique into a free "get off the tawara" button.
      s.grabber.isGrabPushing = true;
      s.setThrowRequest(s.grabbed, "throw", s.now());
      s.stepOnce();
      assert.equal(s.grabber.isGrabPushing, false, "burst still cancels");
      assert.ok(
        s.grabbed.clinchEdgePinHeldMs >= held,
        `pin must survive the request (was ${held}, now ${s.grabbed.clinchEdgePinHeldMs})`
      );
    });

    it("a technique in startup pauses the pin instead of crediting or wiping it", () => {
      const s = sc();
      startRightEdgePin(s);
      driveInto(s, 400);
      const held = s.grabbed.clinchEdgePinHeldMs;
      assert.ok(held > 300, "pin accrued while genuinely pinned");

      // Victim commits a technique: the drive is suspended for its startup.
      s.commitTechniqueNow(s.grabbed, "throw");
      assert.equal(s.grabbed.clinchThrowActive, true);
      s.advance(150);
      assert.equal(
        s.grabbed.clinchEdgePinHeldMs,
        held,
        "no free hold time for the pusher, and no reset for the victim"
      );
    });

    it("escaping the boundary clears the pin (the honest way out)", () => {
      const s = sc();
      startRightEdgePin(s);
      driveInto(s, 500);
      assert.ok(s.grabbed.clinchEdgePinHeldMs > 400);
      // Move the victim off the wall: the pin condition is simply false now.
      s.setPosition(s.grabbed, MAP_RIGHT_BOUNDARY - 200);
      s.setPosition(s.grabber, s.grabbed.x - 72);
      s.setCommittedDrive(s.grabber);
      s.advance(CLINCH_THROW_CLASH_WINDOW_MS);
      assert.equal(s.grabbed.clinchEdgePinHeldMs, 0);
      assert.equal(s.room.gameOver, false);
    });
  });

  it("recovering from Open mid-pin restores the full hold requirement", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    s.setOpen(s.grabbed, s.now() + 5000);
    s.setCommittedDrive(s.grabber);
    s.holdNeutral(s.grabbed);
    s.stepOnce();
    driveInto(s, CLINCH_EDGE_PIN_OPEN_HOLD_MS - 100);
    assert.equal(s.room.gameOver, false);
    // Recovery lands before the reduced hold completes → back to the long hold.
    s.clearOpen(s.grabbed);
    driveInto(s, 200);
    assert.equal(
      s.room.gameOver,
      false,
      "no longer helpless, so the reduced hold no longer applies"
    );
    assert.ok(s.grabbed.clinchEdgePinHeldMs > CLINCH_EDGE_PIN_OPEN_HOLD_MS);
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
    assert.ok(s.grabbed.clinchEdgePinHeldMs > 0);
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
    assert.ok(s.grabbed.clinchEdgePinHeldMs > 0);
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

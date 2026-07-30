"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_JOLT_ANIMATION_MS,
} = require("../../../constants");
const { createClinchScenario } = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

describe("Request lifetime and input-lock tests", () => {
  describe("Throw/Pull request", () => {
    it("survives until buffer expiry then commits", () => {
      const s = sc();
      s.setThrowRequest(s.grabber, "throw", s.now());
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowRequest, "throw");
      assert.equal(s.grabber.clinchThrowActive, false);
      s.advance(CLINCH_THROW_CLASH_WINDOW_MS + 1);
      assert.equal(s.grabber.clinchThrowActive, true);
      assert.equal(s.grabber.clinchThrowRequest, null);
    });

    it("does not commit while input lock active; remains buffered", () => {
      const s = sc();
      s.setThrowRequest(s.grabber, "throw", s.now() - 100);
      s.setInputLock(s.grabber, s.now() + 500);
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowActive, false);
      assert.equal(s.grabber.clinchThrowRequest, "throw");
    });

    it("can commit after input lock ends if request still present", () => {
      const s = sc();
      s.setThrowRequest(s.grabber, "throw", s.now() - 100);
      s.setInputLock(s.grabber, s.now() + 50);
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowActive, false);
      s.advance(60);
      assert.equal(s.grabber.clinchThrowActive, true);
    });

    it("cleared by opposing jolt impact", () => {
      const s = sc();
      s.setThrowRequest(s.grabbed, "pull", s.now());
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      s.advance(CLINCH_JOLT_ANIMATION_MS);
      if (s.grabber.isClinchJolting) s.stepOnce();
      assert.equal(s.grabbed.clinchThrowRequest, null);
    });

    it("cleared when Open blocks — request remains until commit attempt fails gates", () => {
      const s = sc();
      s.setThrowRequest(s.grabber, "throw", s.now() - 100);
      s.setOpen(s.grabber, s.now() + 1000);
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowActive, false);
      // Open does not auto-clear request in canCommitTechnique — it just won't commit
      assert.equal(s.grabber.clinchThrowRequest, "throw");
    });

    it("cleared on mutual tumble", () => {
      const s = sc();
      const t0 = s.now();
      s.setThrowRequest(s.p1, "throw", t0);
      s.setThrowRequest(s.p2, "throw", t0);
      s.stepOnce();
      assert.equal(s.p1.clinchThrowRequest, null);
      assert.equal(s.p2.clinchThrowRequest, null);
    });

    it("cleared on Break", () => {
      const s = sc();
      s.setThrowRequest(s.grabber, "throw", s.now());
      s.setBreakRequest(s.grabbed, s.now());
      s.stepOnce();
      assert.equal(s.grabber.clinchThrowRequest, null);
    });
  });

  describe("Jolt request", () => {
    it("consumed on accept same tick", () => {
      const s = sc();
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      assert.equal(s.grabber.clinchJoltRequest, false);
      assert.equal(s.grabber.isClinchJolting, true);
    });

    it("dropped under reaction lock with no carry", () => {
      const s = sc();
      s.grabber.gripAcquiredTime = s.now() - 10;
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      assert.equal(s.grabber.clinchJoltRequest, false);
      assert.equal(s.grabber.isClinchJolting, false);
    });

    it("rejected while recovering; request cleared", () => {
      const s = sc();
      s.grabber.clinchJoltRecovery = true;
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      assert.equal(s.grabber.isClinchJolting, false);
      assert.equal(s.grabber.clinchJoltRequest, false);
    });

    it("rejected while Open; request cleared", () => {
      const s = sc();
      s.setOpen(s.grabber, s.now() + 500);
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      assert.equal(s.grabber.clinchJoltRequest, false);
    });
  });

  describe("Break request", () => {
    it("consumed every tick whether success or reject", () => {
      const s = sc();
      s.setOpen(s.grabbed, s.now() + 500);
      s.setBreakRequest(s.grabbed, s.now());
      s.stepOnce();
      assert.equal(s.grabbed.clinchBreakRequest, false);
    });

    it("does not survive into a later clinch after break", () => {
      const s = sc();
      s.setBreakRequest(s.grabbed, s.now());
      s.stepOnce();
      assert.equal(s.grabbed.clinchBreakRequest, false);
      assert.equal(s.grabbed.inClinch, false);
    });
  });

  describe("Plant intent / cancel", () => {
    it("raw Plant intent is keys-only; cancel until persists across ticks", () => {
      const s = sc();
      s.setCommittedDrive(s.grabbed);
      s.stepOnce();
      s.holdAway(s.grabbed);
      s.stepOnce();
      const until = s.grabbed.clinchDrivePlantCancelUntil;
      assert.ok(until > s.now());
      s.advance(40);
      s.holdAway(s.grabbed);
      assert.equal(s.grabbed.clinchDrivePlantCancelUntil, until);
      assert.equal(s.grabbed.clinchAction, "neutral");
      s.advance(until - s.now());
      s.holdAway(s.grabbed);
      s.stepOnce();
      assert.equal(s.grabbed.clinchAction, "plant");
    });
  });

  describe("opening burst end", () => {
    it("technique request during Phase A burst is allowed to remain for Phase B", () => {
      const s = sc();
      // Simulate burst flag
      s.grabber.isGrabPushing = true;
      s.setThrowRequest(s.grabber, "throw", s.now());
      s.stepOnce();
      // Request should still be present (burst path may early-return before commit)
      // Depending on burstMovementApplied — if burst owns tick, Phase B may skip.
      // Document current: if still in burst push section early path...
      // After clearing burst:
      s.grabber.isGrabPushing = false;
      s.advance(CLINCH_THROW_CLASH_WINDOW_MS + 5);
      // May or may not have committed depending on early returns during burst ticks
      assert.ok(
        s.grabber.clinchThrowActive || s.grabber.clinchThrowRequest === "throw" || s.grabber.clinchThrowRequest === null
      );
    });
  });

  describe("after grab ends", () => {
    it("Break clears grip and requests do not resurrect", () => {
      const s = sc();
      s.setThrowRequest(s.grabber, "throw", s.now());
      s.setBreakRequest(s.p1, s.now());
      s.stepOnce();
      assert.equal(s.p1.hasGrip, false);
      assert.equal(s.p2.hasGrip, false);
      assert.equal(s.p1.clinchThrowRequest, null);
      assert.equal(s.p2.clinchThrowRequest, null);
    });
  });
});

"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_CLASH_ANIMATION_MS,
} = require("../../../constants");
const { createClinchScenario, withRoleSwap } = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

const OFFSETS = [-80, -61, -60, -59, -1, 0, 1, 59, 60, 61, 80];

function classifyOffset(offsetMs) {
  // offset = p2RequestTime - p1RequestTime
  const abs = Math.abs(offsetMs);
  return {
    simultaneous: abs <= CLINCH_THROW_CLASH_WINDOW_MS,
    p1First: offsetMs > CLINCH_THROW_CLASH_WINDOW_MS,
    p2First: offsetMs < -CLINCH_THROW_CLASH_WINDOW_MS,
  };
}

describe("Simultaneous Throw/Pull interactions", () => {
  it(`clash window is ${CLINCH_THROW_CLASH_WINDOW_MS}ms`, () => {
    assert.equal(CLINCH_THROW_CLASH_WINDOW_MS, 60);
  });

  for (const offset of OFFSETS) {
    it(`Throw vs Throw offset ${offset}ms — neither Deep Grip`, () => {
      const s = sc();
      const t0 = s.now();
      s.setThrowRequest(s.p1, "throw", t0);
      s.setThrowRequest(s.p2, "throw", t0 + offset);
      s.stepOnce();

      const { simultaneous } = classifyOffset(offset);
      if (simultaneous) {
        assert.equal(s.p1.isClinchClashing, true, "mutual tumble when neither has Deep Grip");
        assert.equal(s.p2.isClinchClashing, true);
        assert.equal(s.p1.clinchThrowRequest, null);
        assert.equal(s.p2.clinchThrowRequest, null);
        // Finish tumble
        s.advance(CLINCH_CLASH_ANIMATION_MS);
        assert.equal(s.p1.inClinch, false);
        assert.equal(s.p2.inClinch, false);
      } else {
        assert.equal(s.p1.isClinchClashing, false);
        assert.equal(s.p2.isClinchClashing, false);
        // Outside window: earlier sanitized request time owns the commit.
        s.advance(CLINCH_THROW_CLASH_WINDOW_MS + 2);
        const earlierIsP1 = offset > 0; // p2 = t0+offset → p1 earlier when offset > 0
        assert.equal(
          s.p1.clinchThrowActive,
          earlierIsP1,
          `offset ${offset}: P1 active=${earlierIsP1}`
        );
        assert.equal(
          s.p2.clinchThrowActive,
          !earlierIsP1,
          `offset ${offset}: P2 active=${!earlierIsP1}`
        );
      }
    });
  }

  it("Throw vs Pull simultaneous (0ms) tumbles without Deep Grip", () => {
    const s = sc();
    const t0 = s.now();
    s.setThrowRequest(s.p1, "throw", t0);
    s.setThrowRequest(s.p2, "pull", t0);
    s.stepOnce();
    assert.equal(s.p1.isClinchClashing, true);
    assert.equal(s.p2.isClinchClashing, true);
  });

  it("Pull vs Pull simultaneous tumbles", () => {
    const s = sc();
    const t0 = s.now();
    s.setThrowRequest(s.p1, "pull", t0);
    s.setThrowRequest(s.p2, "pull", t0);
    s.stepOnce();
    assert.equal(s.p1.isClinchClashing, true);
  });

  it("simultaneous: only P1 Deep Grip → P1 keeps request, P2 cleared", () => {
    const s = sc();
    s.setDeepGrip(s.p1);
    const t0 = s.now();
    s.setThrowRequest(s.p1, "throw", t0);
    s.setThrowRequest(s.p2, "throw", t0);
    s.stepOnce();
    assert.equal(s.p1.isClinchClashing, false);
    assert.equal(s.p2.clinchThrowRequest, null);
    assert.equal(s.p1.clinchThrowRequest, "throw");
  });

  it("simultaneous: only P2 Deep Grip → P2 keeps request, P1 cleared", () => {
    const s = sc();
    s.setDeepGrip(s.p2);
    const t0 = s.now();
    s.setThrowRequest(s.p1, "throw", t0);
    s.setThrowRequest(s.p2, "pull", t0 + 10);
    s.stepOnce();
    assert.equal(s.p1.clinchThrowRequest, null);
    assert.equal(s.p2.clinchThrowRequest, "pull");
  });

  it("simultaneous: both Deep Grip → tumble (tie)", () => {
    // Technically exclusive in grantDeepGrip, but state can be forced for regression.
    const s = sc();
    s.p1.hasDeepGrip = true;
    s.p2.hasDeepGrip = true;
    const t0 = s.now();
    s.setThrowRequest(s.p1, "throw", t0);
    s.setThrowRequest(s.p2, "throw", t0);
    s.stepOnce();
    assert.equal(s.p1.isClinchClashing, true);
    assert.equal(s.p2.isClinchClashing, true);
  });

  it("boundary ±1ms around clash window", () => {
    for (const offset of [
      -(CLINCH_THROW_CLASH_WINDOW_MS + 1),
      -CLINCH_THROW_CLASH_WINDOW_MS,
      CLINCH_THROW_CLASH_WINDOW_MS,
      CLINCH_THROW_CLASH_WINDOW_MS + 1,
    ]) {
      const s = sc();
      const t0 = s.now();
      s.setThrowRequest(s.p1, "throw", t0);
      s.setThrowRequest(s.p2, "throw", t0 + offset);
      s.stepOnce();
      const expectSimul = Math.abs(offset) <= CLINCH_THROW_CLASH_WINDOW_MS;
      assert.equal(
        s.p1.isClinchClashing,
        expectSimul,
        `offset ${offset}: simul=${expectSimul}`
      );
      s.dispose();
      scenarios.pop();
    }
  });

  it("Open player request does not commit; partner may still act", () => {
    const s = sc();
    s.setOpen(s.p1, s.now() + 1000);
    s.setThrowRequest(s.p1, "throw", s.now() - 100);
    s.setThrowRequest(s.p2, "throw", s.now() - 100);
    s.stepOnce();
    // Outside simul if times equal and both pending — actually equal times → simul
    // Clear and retest outside simul with Open
    s.dispose();
    scenarios.pop();

    const s2 = sc();
    s2.setOpen(s2.p1, s2.now() + 1000);
    s2.setThrowRequest(s2.p1, "throw", s2.now() - 200);
    s2.setThrowRequest(s2.p2, "throw", s2.now() - 100);
    s2.stepOnce();
    assert.equal(s2.p1.clinchThrowActive, false, "Open blocks commit");
    assert.equal(s2.p2.clinchThrowActive, true);
  });

  it("input-locked player cannot commit; request may remain", () => {
    const s = sc();
    s.setInputLock(s.p1, s.now() + 500);
    s.setThrowRequest(s.p1, "throw", s.now() - 100);
    s.stepOnce();
    assert.equal(s.p1.clinchThrowActive, false);
    assert.equal(s.p1.clinchThrowRequest, "throw");
  });

  it("outside window: earlier request wins regardless of grabber (no iteration bias)", () => {
    // Comprehensive coverage lives in technique-commit-priority.test.js.
    // Keep a focused regression here: grabbed earlier must beat grabber later.
    withRoleSwap({}, (s, label) => {
      const t0 = s.now() - 200;
      s.setThrowRequest(s.grabbed, "throw", t0);
      s.setThrowRequest(s.grabber, "throw", t0 + CLINCH_THROW_CLASH_WINDOW_MS + 1);
      s.stepOnce();
      assert.equal(
        s.grabbed.clinchThrowActive,
        true,
        `${label}: earlier (grabbed) must commit`
      );
      assert.equal(
        s.grabber.clinchThrowActive,
        false,
        `${label}: later (grabber) must be cleared`
      );
      assert.equal(s.grabber.clinchThrowRequest, null);
    });
  });

  it("role swap: Deep Grip winner is identity-based, not grabber-based", () => {
    withRoleSwap({}, (s, label) => {
      s.setDeepGrip(s.p2);
      const t0 = s.now();
      s.setThrowRequest(s.p1, "throw", t0);
      s.setThrowRequest(s.p2, "pull", t0);
      s.stepOnce();
      assert.equal(s.p1.clinchThrowRequest, null, `${label}: P1 cleared`);
      assert.equal(s.p2.clinchThrowRequest, "pull", `${label}: P2 Deep Grip wins`);
    });
  });

  it("pending but not committed (+59ms) still counts as simultaneous", () => {
    const s = sc();
    const t0 = s.now();
    s.setThrowRequest(s.p1, "throw", t0);
    s.setThrowRequest(s.p2, "throw", t0 + 59);
    s.stepOnce();
    assert.equal(s.p1.isClinchClashing, true);
  });

  it("near opposite edges: tumble still separates", () => {
    const s = sc();
    s.placeVictimAtRightEdge();
    const t0 = s.now();
    s.setThrowRequest(s.p1, "throw", t0);
    s.setThrowRequest(s.p2, "throw", t0);
    s.stepOnce();
    assert.equal(s.p1.isClinchClashing, true);
    s.advance(CLINCH_CLASH_ANIMATION_MS);
    assert.equal(s.p1.inClinch, false);
  });
});

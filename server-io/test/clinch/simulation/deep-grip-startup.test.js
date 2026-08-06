"use strict";

/**
 * DEEP GRIP TECHNIQUE STARTUP — one committed duration, many consumers.
 *
 * The values are currently equal to the ordinary ones (a deliberate tuning
 * decision: a faster tell would push the reaction under human range once the
 * Brace cycle already handles Plant-camping). What these tests protect is the
 * PLUMBING, so that changing the constants later cannot desynchronise the
 * server's impact tick, the Brace window, and the client's animation pacing.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_DEEP_GRIP_THROW_ANIMATION_MS,
  CLINCH_DEEP_GRIP_PULL_ANIMATION_MS,
  CLINCH_BRACE_IMPACT_SLACK_MS,
} = require("../../../constants");
const {
  selectTechniqueAnimationMs,
  getTechniqueAnimationMs,
} = require("../../../grabActionSystem");
const { createClinchScenario, awayKey } = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

const CASES = [
  ["throw", CLINCH_THROW_ANIMATION_MS, CLINCH_DEEP_GRIP_THROW_ANIMATION_MS],
  ["pull", CLINCH_PULL_ANIMATION_MS, CLINCH_DEEP_GRIP_PULL_ANIMATION_MS],
];

describe("Committed startup durations", () => {
  for (const [type, normal, deep] of CASES) {
    it(`${type}: ordinary startup is ${normal}ms`, () => {
      assert.equal(selectTechniqueAnimationMs(type, false), normal);
    });

    it(`${type}: Deep Grip startup is ${deep}ms`, () => {
      assert.equal(selectTechniqueAnimationMs(type, true), deep);
    });
  }
});

describe("The duration is snapshotted at commit", () => {
  for (const [type, , deep] of CASES) {
    it(`${type}: commit stamps the Deep Grip duration onto the actor`, () => {
      const s = sc();
      s.setDeepGrip(s.grabber);
      s.holdAway(s.grabbed);
      s.commitTechniqueNow(s.grabber, type);
      assert.equal(s.grabber.clinchThrowActive, true);
      assert.equal(s.grabber.clinchThrowUsedDeepGrip, true);
      assert.equal(s.grabber.clinchThrowAnimMs, deep, "broadcast value");
      assert.equal(getTechniqueAnimationMs(s.grabber), deep, "server value");
    });

    it(`${type}: a mid-startup Deep Grip handover cannot re-length the technique`, () => {
      const s = sc();
      s.setDeepGrip(s.grabber);
      s.commitTechniqueNow(s.grabber, type);
      const committed = s.grabber.clinchThrowAnimMs;
      assert.ok(committed > 0);

      // Perfect Brace hands Deep Grip to the DEFENDER during startup. Recomputing
      // from live ownership here would change the length of a technique already
      // in the air, in both directions.
      s.grabber.hasDeepGrip = true;
      s.grabbed.hasDeepGrip = true;
      assert.equal(
        getTechniqueAnimationMs(s.grabber),
        committed,
        "the number is frozen"
      );
      s.grabber.hasDeepGrip = false;
      assert.equal(getTechniqueAnimationMs(s.grabber), committed);
    });
  }

  it("the stamp is cleared when the technique ends, never leaking forward", () => {
    const s = sc();
    s.setDeepGrip(s.grabber);
    s.commitTechniqueNow(s.grabber, "throw");
    assert.ok(s.grabber.clinchThrowAnimMs > 0);
    s.advance(CLINCH_THROW_ANIMATION_MS + 32);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.equal(s.grabber.clinchThrowAnimMs, 0, "cleared for the next exchange");
  });
});

describe("Server impact honours the committed duration", () => {
  for (const [type, , deep] of CASES) {
    it(`${type}: Deep Grip impact lands at start + ${deep}ms`, () => {
      const s = sc({ tickMs: 1 });
      s.setDeepGrip(s.grabber);
      s.commitTechniqueNow(s.grabber, type);
      const start = s.grabber.clinchThrowStartTime;
      const expectedImpact = start + deep;

      // The technique stays in startup for the whole committed duration...
      while (s.now() < expectedImpact - 2) {
        assert.equal(
          s.grabber.clinchThrowActive,
          true,
          `resolved early at ${s.now() - start}ms of ${deep}ms`
        );
        s.advance(1);
      }
      // ...and has resolved once the committed impact passes.
      s.advance(4);
      assert.equal(
        s.grabber.clinchThrowActive,
        false,
        "resolved on schedule, not late"
      );
    });
  }
});

describe("The ENTIRE visible Deep Grip startup is Braceable", () => {
  for (const [type, , deep] of CASES) {
    // Every 16ms tick of the visible tell, plus the impact-slack tail.
    for (let offset = 0; offset <= deep; offset += 16) {
      it(`${type}: a ready press ${offset}ms into the Deep Grip tell Perfect Braces`, () => {
        const s = sc();
        const away = awayKey(s.grabbed, s.grabber);
        s.setDeepGrip(s.grabber);
        s.setActiveTechnique(s.grabber, type, s.now());
        if (offset > 0) s.advance(offset);
        // Fresh activation stamp at this instant = an active read.
        s.setActivePlant(s.grabbed, s.now());
        s.advance(deep - offset + CLINCH_BRACE_IMPACT_SLACK_MS);
        if (s.grabber.clinchThrowActive) s.stepOnce();
        const fail = s.io.last("clinch_throw_fail");
        assert.ok(fail, `no resolution for offset ${offset}`);
        assert.equal(
          fail.payload.perfectBrace,
          true,
          `offset ${offset}ms of ${deep}ms must be Braceable`
        );
      });
    }

    it(`${type}: a stamp BEFORE the Deep Grip tell is still only a prediction`, () => {
      const s = sc();
      s.setDeepGrip(s.grabber);
      s.setActivePlant(s.grabbed, s.now());
      s.advance(32);
      s.setActiveTechnique(s.grabber, type, s.now());
      s.advance(deep + CLINCH_BRACE_IMPACT_SLACK_MS);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      // Deep Grip beats passive Plant, so this lands.
      assert.ok(
        !s.io.last("clinch_throw_fail"),
        "prediction does not become an active read"
      );
    });

    it(`${type}: a stamp after the slack tail is too late`, () => {
      const s = sc();
      s.setActiveTechnique(s.grabber, type, s.now());
      s.advance(deep + CLINCH_BRACE_IMPACT_SLACK_MS + 32);
      s.setActivePlant(s.grabbed, s.now());
      if (s.grabber.clinchThrowActive) s.stepOnce();
      const fail = s.io.last("clinch_throw_fail");
      if (fail) {
        assert.equal(
          !!fail.payload.perfectBrace,
          false,
          "a press past the window is not a read"
        );
      }
    });
  }
});

describe("Perfect Bracing a Deep Grip technique keeps the full reward", () => {
  for (const [type, , deep] of CASES) {
    it(`${type}: it is stopped dead and the grip changes hands`, () => {
      const s = sc();
      s.setDeepGrip(s.grabber);
      s.setActiveTechnique(s.grabber, type, s.now());
      s.advance(64);
      s.setActivePlant(s.grabbed, s.now());
      s.advance(deep);
      if (s.grabber.clinchThrowActive) s.stepOnce();

      const fail = s.io.last("clinch_throw_fail");
      assert.equal(fail.payload.perfectBrace, true);
      assert.equal(s.grabbed.isBeingThrown, false, "completely stopped");
      assert.equal(s.grabbed.hasDeepGrip, true, "defender is rewarded");
      assert.equal(s.grabber.hasDeepGrip, false, "attacker spent it");
      assert.equal(s.grabber.isClinchOpen, true, "and is punishable");
    });
  }
});

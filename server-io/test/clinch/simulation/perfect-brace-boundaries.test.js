"use strict";

/**
 * Perfect Brace boundaries under the ACTIVE-RESPONSE model.
 *
 * The reaction opportunity is the ENTIRE visible technique startup:
 *   [clinchThrowStartTime, clinchThrowStartTime + anim + CLINCH_BRACE_IMPACT_SLACK_MS]
 * There is no early/late grade — beginning, middle and last-frame reactions all
 * produce the same PERFECT BRACE. Activation strictly before the tell is a
 * prediction (passive Plant), which ordinarily RESISTS but never Perfect Braces.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_BRACE_IMPACT_SLACK_MS,
  CLINCH_BRACE_LATCH_MS,
  CLINCH_DRIVE_PLANT_CANCEL_MS,
} = require("../../../constants");
const {
  isPerfectBraceTiming,
  isFreshBraceActivation,
  getTechniqueBraceWindow,
  getClinchThrowDefense,
  getPlantActivationTime,
} = require("../../../grabActionSystem");
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

const ANIM = CLINCH_THROW_ANIMATION_MS;
const SLACK = CLINCH_BRACE_IMPACT_SLACK_MS;

describe("Perfect Brace boundary tests", () => {
  it("the authoritative window is the whole visible startup", () => {
    const actor = { id: "a", clinchThrowStartTime: 5000 };
    const win = getTechniqueBraceWindow(actor, ANIM);
    assert.deepEqual(win, {
      start: 5000,
      impact: 5000 + ANIM,
      end: 5000 + ANIM + SLACK,
    });
  });

  // Offsets relative to the technique's authoritative start.
  const offsets = [
    { name: "1ms before the tell (prediction)", fromStart: -1, expectPB: false },
    { name: "exactly at the tell", fromStart: 0, expectPB: true },
    { name: "1ms after the tell", fromStart: 1, expectPB: true },
    { name: "middle of startup", fromStart: Math.floor(ANIM / 2), expectPB: true },
    { name: "1ms before impact", fromStart: ANIM - 1, expectPB: true },
    { name: "exactly at impact", fromStart: ANIM, expectPB: true },
    { name: "1ms after impact (inside slack)", fromStart: ANIM + 1, expectPB: true },
    { name: "1ms past the slack", fromStart: ANIM + SLACK + 1, expectPB: false },
  ];

  describe("defender pressing Plant across the startup", () => {
    for (const { name, fromStart, expectPB } of offsets) {
      it(`${name} → PerfectBrace=${expectPB}`, () => {
        const s = sc();
        const start = s.now();
        const activateAt = start + fromStart;

        s.setActiveTechnique(s.grabber, "throw", start);
        s.setActivePlant(s.grabbed, activateAt);

        assert.equal(getPlantActivationTime(s.grabbed), activateAt);
        assert.equal(isPerfectBraceTiming(s.grabber, s.grabbed, ANIM), expectPB);
        assert.equal(isFreshBraceActivation(s.grabber, s.grabbed, ANIM), expectPB);

        s.advance(ANIM);
        if (s.grabber.clinchThrowActive) s.stepOnce();

        const fail = s.io.last("clinch_throw_fail");
        assert.ok(fail, "held Plant always produces at least ordinary RESISTED");
        assert.equal(!!fail.payload.perfectBrace, expectPB);
        assert.equal(fail.payload.resistedByPlant, true);
        assert.equal(s.grabbed.hasDeepGrip, expectPB);
      });
    }
  });

  it("beginning / middle / last-frame reactions are graded identically", () => {
    const results = [];
    for (const fromStart of [0, Math.floor(ANIM / 2), ANIM - 1]) {
      const s = sc();
      const start = s.now();
      s.setActiveTechnique(s.grabber, "throw", start);
      s.setActivePlant(s.grabbed, start + fromStart);
      s.advance(ANIM);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      const fail = s.io.last("clinch_throw_fail");
      results.push({
        perfectBrace: !!fail?.payload?.perfectBrace,
        deepGrip: !!s.grabbed.hasDeepGrip,
        attackerOpen: !!s.grabber.isClinchOpen,
      });
    }
    for (const r of results) {
      assert.deepEqual(r, {
        perfectBrace: true,
        deepGrip: true,
        attackerOpen: true,
      });
    }
  });

  it("cancelling Light Drive mid-startup Perfect Braces (immediate Plant)", () => {
    const s = sc();
    s.setLightDrive(s.grabbed);
    s.stepOnce();
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    // Switch to plant early in the startup — no cancel lock on Light Drive.
    const activateAt = start + 30;
    s.holdAway(s.grabbed);
    s.grabbed.clinchBraceSimTime = activateAt;
    s.grabbed.clinchDrivePlantCancelUntil = 0;
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
  });

  it("cancelling Committed Drive: PB uses cancel completion, not raw press", () => {
    const s = sc();
    s.setCommittedDrive(s.grabbed);
    s.stepOnce();
    const start = s.now();
    const impact = start + ANIM;
    // Raw press BEFORE the tell; the cancel only completes after it. The press
    // is predictive, the activation is a response — activation is what counts.
    const rawPress = start - 40;
    const activateAt = rawPress + CLINCH_DRIVE_PLANT_CANCEL_MS;
    assert.ok(rawPress < start, "raw press precedes the tell");
    assert.ok(activateAt > start && activateAt <= impact);

    s.setActiveTechnique(s.grabber, "throw", start);
    s.setDrivePlantCancel(s.grabbed, activateAt);
    s.grabbed.clinchBraceSimTime = rawPress;
    assert.equal(getPlantActivationTime(s.grabbed), activateAt);

    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
  });

  it("pre-held Plant before startup is RESISTED but NOT Perfect Brace", () => {
    const s = sc();
    s.setActivePlant(s.grabbed, s.now() - 1000);
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.resistedByPlant, true);
    assert.equal(!!fail.payload.perfectBrace, false);
    assert.equal(s.grabbed.hasDeepGrip, false, "no Deep Grip for passive Plant");
  });

  it("input immediately before the tell stays passive until a fresh Brace lands", () => {
    const s = sc();
    // Established 1ms before the technique became visible → prediction.
    const start = s.now();
    s.setActivePlant(s.grabbed, start - 1);
    s.setActiveTechnique(s.grabber, "throw", start);
    s.advance(60);
    assert.equal(!!s.grabbed.clinchBraceArmedTechnique, false);
    // Fresh Brace edge (S while still holding away) mid-startup → upgrade to PB.
    s.grabbed.keys.s = true;
    s.grabbed.clinchBraceSimTime = s.now();
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
  });

  for (const type of ["throw", "pull"]) {
    const anim = type === "pull" ? CLINCH_PULL_ANIMATION_MS : ANIM;

    it(`${type}: Perfect Brace beats attacker Deep Grip at every reaction point`, () => {
      for (const fromStart of [0, Math.floor(anim / 2), anim - 1]) {
        const s = sc();
        s.setDeepGrip(s.grabber);
        const start = s.now();
        s.setActiveTechnique(s.grabber, type, start);
        assert.equal(s.grabber.hasDeepGrip, false, "consumed on commit");
        assert.equal(s.grabber.clinchThrowUsedDeepGrip, true);
        s.setActivePlant(s.grabbed, start + fromStart);
        s.advance(anim);
        if (s.grabber.clinchThrowActive) s.stepOnce();
        const fail = s.io.last("clinch_throw_fail");
        assert.ok(fail, `expected PB at +${fromStart}ms`);
        assert.equal(fail.payload.perfectBrace, true);
        assert.equal(s.grabbed.hasDeepGrip, true);
      }
    });

    it(`${type}: passive Plant loses to Deep Grip (no PB)`, () => {
      const s = sc();
      s.setDeepGrip(s.grabber);
      s.setActivePlant(s.grabbed, s.now() - 500);
      const start = s.now();
      s.setActiveTechnique(s.grabber, type, start);
      s.advance(anim);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      const fail = s.io.last("clinch_throw_fail");
      assert.ok(!fail, "Deep Grip should break passive Plant");
      assert.ok(
        s.grabbed.isBeingThrown ||
          s.grabbed.isBeingPullReversaled ||
          !s.grabber.inClinch,
        "technique should land"
      );
    });
  }

  it("an early Brace does not expire when the generic latch is shorter than startup", () => {
    const s = sc();
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    // React 16ms in, then let go immediately. The 150ms latch dies before the
    // 220ms startup ends — the arm must carry the response to impact.
    s.advance(16);
    s.holdAway(s.grabbed);
    s.grabbed.clinchBraceSimTime = s.now();
    s.grabbed.clinchBraceLatchUntil = s.now() + CLINCH_BRACE_LATCH_MS;
    s.stepOnce();
    assert.ok(s.grabbed.clinchBraceArmedTechnique, "arm records the response");
    s.holdNeutral(s.grabbed);
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail, "released-but-valid reaction still defends");
    assert.equal(fail.payload.perfectBrace, true);
  });

  it("cancelling the Brace into a Drive before impact drops the arm", () => {
    const s = sc();
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    s.advance(16);
    s.holdAway(s.grabbed);
    s.grabbed.clinchBraceSimTime = s.now();
    s.stepOnce();
    assert.ok(s.grabbed.clinchBraceArmedTechnique);
    // Abandon the brace and drive forward instead.
    s.holdToward(s.grabbed);
    s.stepOnce();
    assert.equal(s.grabbed.clinchBraceArmedTechnique, null);
    assert.equal(s.grabbed.clinchBraceSimTime, 0, "stale stamp cannot re-arm");
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(!fail, "cancelled brace should let the technique land");
  });

  it("a Brace arm never leaks into the next technique", () => {
    const s = sc();
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    s.setActivePlant(s.grabbed, start + 20);
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.ok(s.io.last("clinch_throw_fail")?.payload?.perfectBrace);
    assert.equal(s.grabbed.clinchBraceArmedTechnique, null);
    assert.equal(s.grabbed.clinchBraceSimTime, 0);
  });

  it("defense helper and full resolve agree at the window edges", () => {
    const start = 50_000;
    const impact = start + ANIM;
    for (const activateAt of [start - 1, start, impact, impact + SLACK, impact + SLACK + 1]) {
      const actor = {
        id: "attacker",
        clinchThrowStartTime: start,
        x: 100,
        hasGrip: true,
        keys: {},
      };
      const target = {
        id: "defender",
        x: 200,
        hasGrip: true,
        clinchDrivePlantCancelUntil: 0,
        clinchBraceSimTime: activateAt,
        clinchBraceLatchUntil: 0,
        keys: { a: true, d: false, s: false },
      };
      const d = getClinchThrowDefense(actor, target, impact, ANIM);
      const inWindow = activateAt >= start && activateAt <= impact + SLACK;
      assert.equal(d.perfectBrace, inWindow, `activateAt=${activateAt}`);
    }
  });
});

"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PERFECT_BRACE_WINDOW_MS,
  CLINCH_DRIVE_PLANT_CANCEL_MS,
} = require("../../../constants");
const {
  isPerfectBraceTiming,
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
const WIN = CLINCH_PERFECT_BRACE_WINDOW_MS;

describe("Perfect Brace boundary tests", () => {
  const offsets = [
    { name: "1ms before window", deltaFromWindowStart: -1, expectPB: false },
    { name: "exactly at window start", deltaFromWindowStart: 0, expectPB: true },
    { name: "1ms inside window", deltaFromWindowStart: 1, expectPB: true },
    { name: "middle of window", deltaFromWindowStart: Math.floor(WIN / 2), expectPB: true },
    { name: "1ms before window end (impact)", deltaFromWindowStart: WIN - 1, expectPB: true },
    { name: "exactly at impact", deltaFromWindowStart: WIN, expectPB: true },
    { name: "1ms after impact (within +16 slack)", deltaFromWindowStart: WIN + 1, expectPB: true },
    { name: "17ms after impact (past +16 slack)", deltaFromWindowStart: WIN + 17, expectPB: false },
  ];

  describe("neutral defender pressing Plant into window", () => {
    for (const { name, deltaFromWindowStart, expectPB } of offsets) {
      it(`${name} → PerfectBrace=${expectPB}`, () => {
        const s = sc();
        const start = s.now();
        const impact = start + ANIM;
        const windowStart = impact - WIN;
        const activateAt = windowStart + deltaFromWindowStart;

        s.setActiveTechnique(s.grabber, "throw", start);
        s.setActivePlant(s.grabbed, activateAt);

        assert.equal(getPlantActivationTime(s.grabbed), activateAt);
        assert.equal(
          isPerfectBraceTiming(s.grabber, s.grabbed, ANIM),
          expectPB && activateAt > 0
        );

        s.advance(ANIM);
        if (s.grabber.clinchThrowActive) s.stepOnce();

        const fail = s.io.last("clinch_throw_fail");
        if (expectPB && activateAt <= impact + 16 && activateAt >= windowStart) {
          assert.ok(fail, "expected fail event");
          assert.equal(fail.payload.perfectBrace, true);
          assert.equal(s.grabbed.hasDeepGrip, true);
        } else if (activateAt <= impact && activateAt > 0) {
          // Active plant outside PB window → ordinary resist
          assert.ok(fail);
          assert.equal(!!fail.payload.perfectBrace, false);
        } else {
          // Activation after impact slack → land
          assert.ok(!fail || !fail.payload.perfectBrace);
        }
      });
    }
  });

  it("cancelling Light Drive: Plant is immediate (no cancel), PB uses activation stamp", () => {
    const s = sc();
    s.setLightDrive(s.grabbed);
    s.stepOnce();
    const start = s.now();
    const impact = start + ANIM;
    s.setActiveTechnique(s.grabber, "throw", start);
    // Switch to plant mid-startup inside PB window
    const activateAt = impact - 40;
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
    // Raw press early (outside window), cancel completes inside window
    const rawPress = impact - WIN - 50;
    const activateAt = rawPress + CLINCH_DRIVE_PLANT_CANCEL_MS;
    assert.ok(activateAt >= impact - WIN, "activation should land in PB window");
    assert.ok(rawPress < impact - WIN, "raw press outside window");

    s.setActiveTechnique(s.grabber, "throw", start);
    s.setDrivePlantCancel(s.grabbed, activateAt);
    // Raw stamp wrongly early — activation helper must prefer cancelUntil
    s.grabbed.clinchBraceSimTime = rawPress;
    assert.equal(getPlantActivationTime(s.grabbed), activateAt);

    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
  });

  it("pre-held Plant before startup is resist but NOT Perfect Brace", () => {
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
  });

  it("Perfect Brace beats attacker Deep Grip", () => {
    const s = sc();
    s.setDeepGrip(s.grabber);
    const start = s.now();
    const impact = start + ANIM;
    s.setActiveTechnique(s.grabber, "throw", start);
    // Deep grip consumed on setActiveTechnique
    assert.equal(s.grabber.hasDeepGrip, false);
    assert.equal(s.grabber.clinchThrowUsedDeepGrip, true);
    s.setActivePlant(s.grabbed, impact - 30);
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
    assert.equal(s.grabbed.hasDeepGrip, true);
  });

  it("ordinary Plant resist loses to Deep Grip (no PB)", () => {
    const s = sc();
    s.setDeepGrip(s.grabber);
    s.setActivePlant(s.grabbed, s.now() - 500);
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    s.advance(ANIM);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(!fail, "Deep Grip should break non-PB Plant");
    assert.ok(
      s.grabbed.isBeingThrown || !s.grabber.inClinch,
      "technique should land"
    );
  });

  it("defense helper and full resolve agree on PB at window edges", () => {
    const start = 50_000;
    const impact = start + ANIM;
    for (const activateAt of [impact - WIN - 1, impact - WIN, impact, impact + 16, impact + 17]) {
      const actor = { clinchThrowStartTime: start, x: 100, hasGrip: true, keys: {} };
      const target = {
        x: 200,
        hasGrip: true,
        clinchDrivePlantCancelUntil: 0,
        clinchBraceSimTime: activateAt,
        clinchBraceLatchUntil: 0,
        keys: { a: true, d: false, s: false },
      };
      // Plant via away (actor left of target → away is a)
      const d = getClinchThrowDefense(actor, target, impact, ANIM);
      const inWindow = activateAt >= impact - WIN && activateAt <= impact + 16;
      assert.equal(d.perfectBrace, inWindow && d.bracing);
    }
  });
});

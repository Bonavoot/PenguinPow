"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_DRIVE_PLANT_CANCEL_MS,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_PERFECT_BRACE_WINDOW_MS,
  CLINCH_BRACE_LATCH_MS,
} = require("../../../constants");
const {
  getClinchAction,
  getPlantIntent,
  isDrivePlantCancelPending,
  isActivelyPlanting,
  getPlantActivationTime,
  isBraceLatched,
  isPerfectBraceTiming,
  getClinchThrowDefense,
} = require("../../../grabActionSystem");

function makePair({
  defenderKeys = { d: true },
  cancelUntil = 0,
  braceSimTime = 0,
  latchUntil = 0,
  throwStart = 0,
} = {}) {
  const actor = {
    id: "attacker",
    x: 100,
    hasGrip: true,
    clinchThrowStartTime: throwStart,
    keys: { d: true },
  };
  const target = {
    id: "defender",
    x: 200,
    hasGrip: true,
    clinchDrivePlantCancelUntil: cancelUntil,
    clinchBraceSimTime: braceSimTime,
    clinchBraceLatchUntil: latchUntil,
    keys: { a: false, d: false, s: false, ...defenderKeys },
  };
  return { actor, target };
}

describe("plant authority vs raw intent", () => {
  it("constants match expected production timings", () => {
    assert.equal(CLINCH_DRIVE_PLANT_CANCEL_MS, 90);
    assert.equal(CLINCH_BRACE_LATCH_MS, 150);
    assert.equal(CLINCH_PERFECT_BRACE_WINDOW_MS, 100);
  });

  it("raw Plant intent is true while cancel is still pending", () => {
    const { actor, target } = makePair({ cancelUntil: 1000 });
    assert.equal(getPlantIntent(target, actor), true);
    assert.equal(isDrivePlantCancelPending(target, 999), true);
    assert.equal(isActivelyPlanting(target, actor, 999), false);
    assert.equal(getClinchAction(target, actor, 999), "neutral");
  });

  it("Plant becomes active exactly when cancelUntil is reached", () => {
    const activateAt = 1000;
    const { actor, target } = makePair({ cancelUntil: activateAt });
    assert.equal(isActivelyPlanting(target, actor, activateAt - 1), false);
    assert.equal(isActivelyPlanting(target, actor, activateAt), true);
    assert.equal(getClinchAction(target, actor, activateAt), "plant");
  });

  it("omitted now fail-closes mid-cancel (never treats raw intent as Plant)", () => {
    const { actor, target } = makePair({ cancelUntil: 5000 });
    assert.equal(getClinchAction(target, actor), "neutral");
    assert.equal(isActivelyPlanting(target, actor, null), false);
  });

  it("Light Drive / no cancel: Plant intent is immediately active", () => {
    const { actor, target } = makePair({ cancelUntil: 0 });
    assert.equal(isActivelyPlanting(target, actor, 100), true);
  });

  it("raw re-press during cancel does not pull activation earlier than cancelUntil", () => {
    const activateAt = 190;
    const { target } = makePair({
      cancelUntil: activateAt,
      braceSimTime: 150,
    });
    assert.equal(getPlantActivationTime(target), activateAt);
  });

  it("already Planting (no cancel) can Perfect Brace from activation stamp", () => {
    const throwStart = 1000;
    const anim = CLINCH_THROW_ANIMATION_MS;
    const impact = throwStart + anim;
    const activateAt = impact - 40;
    const { actor, target } = makePair({
      cancelUntil: 0,
      braceSimTime: activateAt,
      throwStart,
    });
    const d = getClinchThrowDefense(actor, target, impact, anim);
    assert.equal(d.activelyPlanting, true);
    assert.equal(d.bracing, true);
    assert.equal(d.perfectBrace, true);
    assert.equal(isPerfectBraceTiming(actor, target, anim), true);
  });
});

describe("Drive→Plant cancel defense at Throw/Pull impact", () => {
  for (const [label, anim] of [
    ["Throw", CLINCH_THROW_ANIMATION_MS],
    ["Pull", CLINCH_PULL_ANIMATION_MS],
  ]) {
    describe(label, () => {
      const throwStart = 1000;
      const impact = throwStart + anim;

      it(`${label}: transition finishes well before impact → defended + Perfect Brace`, () => {
        const activateAt = impact - 80;
        const { actor, target } = makePair({
          cancelUntil: activateAt,
          braceSimTime: activateAt,
          throwStart,
        });
        const d = getClinchThrowDefense(actor, target, impact, anim);
        assert.equal(d.activelyPlanting, true);
        assert.equal(d.bracing, true);
        assert.equal(d.perfectBrace, true);
      });

      it(`${label}: transition finishes exactly at impact → Plant active, Perfect Brace`, () => {
        const activateAt = impact;
        const { actor, target } = makePair({
          cancelUntil: activateAt,
          braceSimTime: activateAt,
          throwStart,
        });
        const d = getClinchThrowDefense(actor, target, impact, anim);
        assert.equal(isDrivePlantCancelPending(target, impact), false);
        assert.equal(d.activelyPlanting, true);
        assert.equal(d.bracing, true);
        assert.equal(d.perfectBrace, true);
      });

      it(`${label}: transition finishes 1ms after impact → technique not braced`, () => {
        const activateAt = impact + 1;
        const { actor, target } = makePair({
          cancelUntil: activateAt,
          braceSimTime: activateAt,
          throwStart,
        });
        const d = getClinchThrowDefense(actor, target, impact, anim);
        assert.equal(d.activelyPlanting, false);
        assert.equal(d.bracing, false);
        assert.equal(d.perfectBrace, false);
      });

      it(`${label}: raw press in PB window but cancel incomplete → no Perfect Brace`, () => {
        const rawPress = impact - 40;
        const activateAt = rawPress + CLINCH_DRIVE_PLANT_CANCEL_MS;
        assert.ok(activateAt > impact);
        const { actor, target } = makePair({
          cancelUntil: activateAt,
          braceSimTime: rawPress,
          throwStart,
        });
        assert.equal(getPlantActivationTime(target), activateAt);
        assert.equal(isPerfectBraceTiming(actor, target, anim), false);
        const d = getClinchThrowDefense(actor, target, impact, anim);
        assert.equal(d.perfectBrace, false);
        assert.equal(d.bracing, false);
      });
    });
  }
});

describe("brace latch", () => {
  it("tap Plant then release before impact → still braces via latch", () => {
    const throwStart = 1000;
    const anim = CLINCH_THROW_ANIMATION_MS;
    const impact = throwStart + anim;
    const activateAt = impact - 40;
    const { actor, target } = makePair({
      defenderKeys: {},
      cancelUntil: 0,
      braceSimTime: activateAt,
      latchUntil: activateAt + CLINCH_BRACE_LATCH_MS,
      throwStart,
    });
    assert.equal(isActivelyPlanting(target, actor, impact), false);
    assert.equal(isBraceLatched(target, impact), true);
    const d = getClinchThrowDefense(actor, target, impact, anim);
    assert.equal(d.bracing, true);
    assert.equal(d.latched, true);
    assert.equal(d.perfectBrace, true);
  });

  it("latch expired before impact → technique not braced", () => {
    const throwStart = 1000;
    const anim = CLINCH_THROW_ANIMATION_MS;
    const impact = throwStart + anim;
    const activateAt = impact - 200;
    const { actor, target } = makePair({
      defenderKeys: {},
      braceSimTime: activateAt,
      latchUntil: activateAt + CLINCH_BRACE_LATCH_MS,
      throwStart,
    });
    const d = getClinchThrowDefense(actor, target, impact, anim);
    assert.equal(d.bracing, false);
    assert.equal(d.perfectBrace, false);
  });

  it("incomplete Drive→Plant cancel with no latch does not brace", () => {
    const throwStart = 1000;
    const anim = CLINCH_THROW_ANIMATION_MS;
    const impact = throwStart + anim;
    const { actor, target } = makePair({
      defenderKeys: { d: true },
      cancelUntil: impact + 50,
      braceSimTime: impact - 40,
      throwStart,
    });
    target.clinchBraceLatchUntil = 0;
    const d = getClinchThrowDefense(actor, target, impact, anim);
    assert.equal(isActivelyPlanting(target, actor, impact), false);
    assert.equal(d.bracing, false);
    assert.equal(d.perfectBrace, false);
  });
});

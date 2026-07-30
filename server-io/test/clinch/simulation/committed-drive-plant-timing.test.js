"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_DRIVE_PLANT_CANCEL_MS,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_PERFECT_BRACE_WINDOW_MS,
} = require("../../../constants");
const {
  getClinchAction,
  isActivelyPlanting,
  isDrivePlantCancelPending,
  getPlantIntent,
  getPlantActivationTime,
  getClinchThrowDefense,
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

describe("Committed Drive → Plant timing vs technique impact", () => {
  it(`uses CLINCH_DRIVE_PLANT_CANCEL_MS=${CLINCH_DRIVE_PLANT_CANCEL_MS}`, () => {
    assert.equal(CLINCH_DRIVE_PLANT_CANCEL_MS, 90);
  });

  for (const type of ["throw", "pull"]) {
    const anim =
      type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;

    describe(type, () => {
      const offsets = [120, 100, 91, 90, 89, 50, 1, 0, -1];

      for (const plantLead of offsets) {
        const label =
          plantLead >= 0
            ? `Plant requested ${plantLead}ms before impact`
            : `Plant requested ${-plantLead}ms after impact`;

        it(`${type}: ${label}`, () => {
          const s = sc();
          // Arm cancel at t0 via real update loop
          s.setCommittedDrive(s.grabbed);
          s.stepOnce();
          s.holdAway(s.grabbed);
          const t0 = s.now();
          s.stepOnce();
          const activateAt = t0 + CLINCH_DRIVE_PLANT_CANCEL_MS;
          assert.equal(s.grabbed.clinchDrivePlantCancelUntil, activateAt);
          assert.equal(getPlantIntent(s.grabbed, s.grabber), true);

          const impact = t0 + plantLead;
          const start = impact - anim;
          const expectActive = activateAt <= impact;
          const pendingAtImpact = activateAt > impact;

          // Pure authoritative evaluation at the impact timestamp (no early resolve).
          s.holdAway(s.grabbed);
          const actorAtImpact = {
            ...s.grabber,
            clinchThrowStartTime: start,
          };
          assert.equal(
            isDrivePlantCancelPending(s.grabbed, impact),
            pendingAtImpact
          );
          assert.equal(
            isActivelyPlanting(s.grabbed, s.grabber, impact),
            expectActive,
            `activateAt=${activateAt} impact=${impact}`
          );
          assert.equal(getPlantIntent(s.grabbed, s.grabber), true);
          assert.equal(getPlantActivationTime(s.grabbed), activateAt);

          const defense = getClinchThrowDefense(
            actorAtImpact,
            s.grabbed,
            impact,
            anim
          );
          assert.equal(defense.activelyPlanting, expectActive);
          assert.equal(defense.bracing, expectActive); // no latch in this setup

          const windowStart = impact - CLINCH_PERFECT_BRACE_WINDOW_MS;
          const expectPB =
            expectActive &&
            activateAt >= windowStart &&
            activateAt <= impact + 16;
          assert.equal(defense.perfectBrace, expectPB);

          // Full resolve path when we can place impact in the future without
          // starting the technique in the past (avoids instant resolve).
          if (start >= s.now() && impact > s.now()) {
            s.setActiveTechnique(s.grabber, type, start);
            s.holdAway(s.grabbed);
            s.advance(impact - s.now());
            if (s.grabber.clinchThrowActive) s.stepOnce();
            const fail = s.io.last("clinch_throw_fail");
            if (expectActive) {
              assert.ok(fail, `${label}: expected resist/PB`);
              assert.equal(fail.payload.resistedByPlant, true);
              assert.equal(!!fail.payload.perfectBrace, expectPB);
              if (expectPB) assert.equal(s.grabbed.hasDeepGrip, true);
            } else {
              assert.ok(!fail || !fail.payload.resistedByPlant);
            }
          } else if (impact > s.now()) {
            // Technique start is historical — warp to just before impact with
            // an active technique whose remaining time is 1ms, then resolve.
            s.advanceTime(impact - s.now() - 1);
            s.setActiveTechnique(s.grabber, type, impact - anim);
            s.holdAway(s.grabbed);
            // Preserve cancel clocks (setActiveTechnique must not touch them)
            s.grabbed.clinchDrivePlantCancelUntil = activateAt;
            s.grabbed.clinchBraceSimTime = activateAt;
            s.advance(1);
            if (s.grabber.clinchThrowActive) s.stepOnce();
            const fail = s.io.last("clinch_throw_fail");
            if (expectActive) {
              assert.ok(fail, `${label}: expected resist/PB on warped resolve`);
              assert.equal(!!fail.payload.perfectBrace, expectPB);
            } else {
              assert.ok(
                !fail || !fail.payload.resistedByPlant,
                `${label}: incomplete cancel must not resist (warped resolve)`
              );
            }
          }
        });
      }

      it(`${type}: boundary around real cancel duration (±1ms from activateAt==impact)`, () => {
        const s = sc();
        s.setCommittedDrive(s.grabbed);
        s.stepOnce();
        s.holdAway(s.grabbed);
        const t0 = s.now();
        s.stepOnce();
        const activateAt = t0 + CLINCH_DRIVE_PLANT_CANCEL_MS;

        assert.equal(
          isActivelyPlanting(s.grabbed, s.grabber, activateAt - 1),
          false
        );
        assert.equal(
          isActivelyPlanting(s.grabbed, s.grabber, activateAt),
          true
        );
        assert.equal(
          isActivelyPlanting(s.grabbed, s.grabber, activateAt + 1),
          true
        );
        assert.equal(getClinchAction(s.grabbed, s.grabber, activateAt - 1), "neutral");
        assert.equal(getClinchAction(s.grabbed, s.grabber, activateAt), "plant");
      });

      it(`${type}: raw Plant intent during cancel is not authoritative defense`, () => {
        const s = sc();
        s.setCommittedDrive(s.grabbed);
        s.stepOnce();
        s.holdAway(s.grabbed);
        const t0 = s.now();
        s.stepOnce();
        const activateAt = t0 + CLINCH_DRIVE_PLANT_CANCEL_MS;
        const impact = activateAt - 1; // 1ms before Plant becomes active
        const start = impact - anim;
        s.holdAway(s.grabbed);
        assert.equal(getPlantIntent(s.grabbed, s.grabber), true);
        assert.equal(isActivelyPlanting(s.grabbed, s.grabber, impact), false);
        const d = getClinchThrowDefense(
          { ...s.grabber, clinchThrowStartTime: start },
          s.grabbed,
          impact,
          anim
        );
        assert.equal(d.bracing, false);
        assert.equal(d.perfectBrace, false);
      });
    });
  }
});

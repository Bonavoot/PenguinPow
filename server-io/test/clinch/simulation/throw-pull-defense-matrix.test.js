"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_BRACE_IMPACT_SLACK_MS,
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

/**
 * Commit a buffered technique and advance to impact, returning outcome flags.
 * Distinguishes: request → commit → impact resolution.
 */
function runTechniqueToImpact(s, actor, type, {
  requestLeadMs = CLINCH_THROW_CLASH_WINDOW_MS + 1,
} = {}) {
  const target = s.other(actor);
  const before = {
    actorBal: actor.balance,
    actorStam: actor.stamina,
    targetBal: target.balance,
    targetStam: target.stamina,
    actorDeep: !!actor.hasDeepGrip,
    targetDeep: !!target.hasDeepGrip,
    targetX: target.x,
    actorX: actor.x,
    inClinch: !!actor.inClinch && !!target.inClinch,
  };

  s.setThrowRequest(actor, type, s.now());
  // Wait out simul window so request commits (age must be > clash window).
  s.advance(requestLeadMs);
  assert.equal(
    actor.clinchThrowActive,
    true,
    "technique should have committed after buffer expiry"
  );
  assert.equal(actor.clinchThrowRequest, null, "request cleared on commit");

  const anim =
    type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
  // Advance to impact (inclusive of the impact tick).
  s.advance(anim);

  const fail = s.io.last("clinch_throw_fail");
  const killThrow = s.io.last("clinch_kill_throw");
  return {
    before,
    perfectBrace: !!(fail && fail.payload.perfectBrace),
    resisted: !!(fail && fail.payload.resistedByPlant),
    landed:
      !fail &&
      (!actor.inClinch ||
        target.isBeingThrown ||
        target.isBeingPullReversaled ||
        !!killThrow ||
        roomEnded(s)),
    kill: !!killThrow || (s.room.gameOver && !fail),
    clinchContinues: !!(actor.inClinch && target.inClinch && actor.hasGrip),
    actorOpen: !!actor.isClinchOpen || !!actor.clinchThrowFailStagger,
    actorDeep: !!actor.hasDeepGrip,
    targetDeep: !!target.hasDeepGrip,
    actorBal: actor.balance,
    targetBal: target.balance,
    actorStam: actor.stamina,
    staleRequest: actor.clinchThrowRequest,
    failPayload: fail && fail.payload,
  };
}

function roomEnded(s) {
  return !!s.room.gameOver;
}

describe("Throw/Pull defense matrix", () => {
  for (const type of ["throw", "pull"]) {
    describe(type, () => {
      it(`${type} vs neutral mid-ring lands and ends clinch`, () => {
        const s = sc();
        s.holdNeutral(s.grabbed);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, false);
        assert.equal(r.perfectBrace, false);
        assert.equal(r.landed, true);
        assert.equal(r.clinchContinues, false);
        assert.equal(r.staleRequest, null);
      });

      it(`${type} vs active Plant (no Deep Grip) is resisted; clinch continues`, () => {
        const s = sc();
        s.setActivePlant(s.grabbed, s.now() - 500);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, true);
        assert.equal(r.perfectBrace, false, "pre-held Plant is not Perfect Brace");
        assert.equal(r.landed, false);
        assert.equal(r.clinchContinues, true);
        assert.equal(r.actorOpen, true);
        assert.ok(r.actorBal < r.before.actorBal, "thrower pays fail balance");
      });

      it(`${type} vs Plant with attacker Deep Grip lands (Deep Grip breaks Plant)`, () => {
        const s = sc();
        s.setDeepGrip(s.grabber);
        s.setActivePlant(s.grabbed, s.now() - 500);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, false);
        assert.equal(r.landed, true);
        assert.equal(r.actorDeep, false, "Deep Grip consumed on commit");
        assert.equal(r.clinchContinues, false);
      });

      it(`${type} Perfect Brace awards Deep Grip to defender and Opens attacker`, () => {
        const s = sc();
        const anim =
          type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
        // Commit first so we know impact time, then set plant activation in window.
        // Easier path: set active technique with known start, plant in PB window, advance to impact.
        const start = s.now();
        s.setActiveTechnique(s.grabber, type, start);
        const impact = start + anim;
        const activateAt = impact - 40;
        s.setActivePlant(s.grabbed, activateAt);
        s.advance(anim);
        const fail = s.io.last("clinch_throw_fail");
        assert.ok(fail, "expected throw_fail");
        assert.equal(fail.payload.perfectBrace, true);
        assert.equal(s.grabbed.hasDeepGrip, true);
        assert.equal(s.grabber.hasDeepGrip, false);
        assert.ok(s.grabber.isClinchOpen || s.grabber.clinchThrowFailStagger);
        assert.equal(s.grabber.inClinch, true, "clinch continues after Perfect Brace");
      });

      it(`${type} vs Open defender lands`, () => {
        const s = sc();
        s.setOpen(s.grabbed, s.now() + 1000);
        s.holdNeutral(s.grabbed);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, false);
        assert.equal(r.landed, true);
      });

      it(`${type} vs gassed defender lands`, () => {
        const s = sc();
        s.setGassed(s.grabbed);
        s.holdNeutral(s.grabbed);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.landed, true);
        assert.equal(r.resisted, false);
      });

      it(`${type} vs Light Drive lands (Drive is not Plant)`, () => {
        const s = sc();
        s.setLightDrive(s.grabbed);
        // Stabilize light drive on a tick
        s.stepOnce();
        assert.equal(s.grabbed.isClinchCommittedDrive, false);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, false);
        assert.equal(r.landed, true);
      });

      it(`${type} vs Committed Drive lands`, () => {
        const s = sc();
        s.setCommittedDrive(s.grabbed);
        s.stepOnce();
        assert.equal(s.grabbed.isClinchCommittedDrive, true);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, false);
        assert.equal(r.landed, true);
      });

      it(`${type} with Break already buffered: Break preempts technique`, () => {
        const s = sc();
        s.setThrowRequest(s.grabber, type, s.now() - (CLINCH_THROW_CLASH_WINDOW_MS + 1));
        s.setBreakRequest(s.grabbed, s.now());
        s.stepOnce();
        assert.equal(s.grabbed.isGrabBreaking || s.grabber.isGrabBreakSeparating || !s.grabber.inClinch, true);
        assert.equal(s.grabber.clinchThrowActive, false);
      });

      it(`${type} attacker input-locked cannot commit buffered request`, () => {
        const s = sc();
        s.setThrowRequest(s.grabber, type, s.now() - (CLINCH_THROW_CLASH_WINDOW_MS + 1));
        s.setInputLock(s.grabber, s.now() + 500);
        s.stepOnce();
        assert.equal(s.grabber.clinchThrowActive, false);
        assert.equal(s.grabber.clinchThrowRequest, type, "request remains while locked");
      });

      it(`${type} kill uses pre-initiation Balance threshold (${CLINCH_THROW_KILL_THRESHOLD})`, () => {
        const s = sc({ p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1 });
        // grabber is p1, grabbed is p2 with lethal balance
        s.holdNeutral(s.grabbed);
        const killBal = s.grabbed.balance;
        assert.ok(killBal < CLINCH_THROW_KILL_THRESHOLD);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.landed, true);
        // Kill path sets gameOver via handleWinCondition for pull; throw sets isClinchKillThrowVictim
        assert.ok(
          s.room.gameOver ||
            s.grabbed.isClinchKillPullVictim ||
            s.grabbed.isClinchKillThrowVictim ||
            s.io.last("clinch_kill_throw"),
          "lethal balance should take kill path"
        );
      });

      it(`${type} at exactly kill threshold does not kill (strict <)`, () => {
        const s = sc({ p2Balance: CLINCH_THROW_KILL_THRESHOLD });
        s.holdNeutral(s.grabbed);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.landed, true);
        assert.equal(s.grabbed.isClinchKillPullVictim, false);
        assert.equal(s.grabbed.isClinchKillThrowVictim, false);
        assert.ok(!s.io.last("clinch_kill_throw"));
      });

      it(`${type} near edge still resolves Plant resist without ring-out from resist`, () => {
        const s = sc();
        s.placeVictimAtRightEdge();
        s.setActivePlant(s.grabbed, s.now() - 200);
        const r = runTechniqueToImpact(s, s.grabber, type);
        assert.equal(r.resisted, true);
        assert.equal(r.clinchContinues, true);
        assert.equal(s.room.gameOver, false);
      });
    });
  }

  it("defender Deep Grip does not by itself resist a Throw", () => {
    const s = sc();
    s.setDeepGrip(s.grabbed);
    s.holdNeutral(s.grabbed);
    const r = runTechniqueToImpact(s, s.grabber, "throw");
    assert.equal(r.landed, true);
    assert.equal(r.resisted, false);
  });

  it("the reaction window opens at the visible tell, not the buffered request", () => {
    const s = sc();
    // Request is filed a full simul window before the technique becomes visible.
    // Bracing in that hidden gap must NOT count as a response to the tell.
    const requestAt = s.now();
    s.setThrowRequest(s.grabber, "throw", requestAt);
    s.setActivePlant(s.grabbed, requestAt + 10);
    s.advance(CLINCH_THROW_CLASH_WINDOW_MS + 1);
    assert.equal(s.grabber.clinchThrowActive, true);
    assert.ok(
      s.grabber.clinchThrowStartTime > requestAt + 10,
      "tell starts after the pre-tell Plant"
    );
    s.advance(CLINCH_THROW_ANIMATION_MS);
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.resistedByPlant, true);
    assert.equal(!!fail.payload.perfectBrace, false);
    assert.equal(s.grabbed.hasDeepGrip, false);
  });

  it("a reaction one tick past impact still counts (impact slack)", () => {
    const s = sc();
    const start = s.now();
    s.setActiveTechnique(s.grabber, "throw", start);
    const impact = start + CLINCH_THROW_ANIMATION_MS;
    s.setActivePlant(s.grabbed, impact + CLINCH_BRACE_IMPACT_SLACK_MS);
    s.advance(CLINCH_THROW_ANIMATION_MS);
    const fail = s.io.last("clinch_throw_fail");
    assert.ok(fail);
    assert.equal(fail.payload.perfectBrace, true);
  });
});

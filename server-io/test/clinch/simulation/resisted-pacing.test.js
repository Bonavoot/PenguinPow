"use strict";

/**
 * Resisted-technique PACING: the impact beat, the attacker's disadvantage, and
 * the defender's turn.
 *
 * Timer semantics that these tests pin down: Open is scheduled on the SIM clock
 * (timeoutManager), and the sim clock freezes while room.hitstopUntil is in the
 * future. Hitstop and Open therefore ADD in wall-clock time rather than
 * overlapping, so the authored recovery is never silently shortened.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_FAIL_STAGGER_MS,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_THROW_RESISTED_HITSTOP_MS,
  CLINCH_PERFECT_BRACE_HITSTOP_MS,
  CLINCH_THROW_FAIL_STAMINA_COST,
  CLINCH_THROW_STAMINA_COST,
  CLINCH_JOLT_RECOVERY_MS,
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

/** Resolve a technique against a passive (pre-tell) Plant. */
function resolvePassivePlant(s, type) {
  const anim = type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
  s.setActivePlant(s.grabbed, s.now() - 400);
  s.setActiveTechnique(s.grabber, type, s.now());
  s.advance(anim);
  if (s.grabber.clinchThrowActive) s.stepOnce();
  return anim;
}

/** Resolve a technique against a fresh in-startup Brace. */
function resolvePerfectBrace(s, type) {
  const anim = type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
  const start = s.now();
  s.setActiveTechnique(s.grabber, type, start);
  s.setActivePlant(s.grabbed, start + 30);
  s.advance(anim);
  if (s.grabber.clinchThrowActive) s.stepOnce();
  return anim;
}

describe("Resisted technique pacing", () => {
  it("pacing constants match the authored values", () => {
    assert.equal(CLINCH_THROW_RESISTED_HITSTOP_MS, 100);
    assert.equal(CLINCH_THROW_FAIL_STAGGER_MS, 550);
    assert.equal(CLINCH_PERFECT_BRACE_HITSTOP_MS, 140);
    assert.equal(CLINCH_PERFECT_BRACE_OPEN_MS, 650);
    // Jolt keeps its own shorter recovery — lower reward, own failure costs.
    assert.equal(CLINCH_JOLT_RECOVERY_MS, 420);
  });

  for (const type of ["throw", "pull"]) {
    it(`${type}: ordinary RESISTED freezes ${CLINCH_THROW_RESISTED_HITSTOP_MS}ms then Opens the attacker ${CLINCH_THROW_FAIL_STAGGER_MS}ms`, () => {
      const s = sc();
      const impactAt = s.now() + (type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS);
      resolvePassivePlant(s, type);

      const fail = s.io.last("clinch_throw_fail");
      assert.ok(fail);
      assert.equal(fail.payload.resistedByPlant, true);
      assert.equal(!!fail.payload.perfectBrace, false);

      const hitstop = s.io.last("hitstop");
      assert.ok(hitstop, "ordinary RESISTED needs a readable contact beat");
      assert.equal(hitstop.payload.duration, CLINCH_THROW_RESISTED_HITSTOP_MS);
      assert.equal(hitstop.payload.kind, "clinch_throw_resisted");
      assert.ok(s.io.last("screen_shake"), "RESISTED shakes the camera");

      assert.equal(s.grabber.isClinchOpen, true);
      assert.equal(s.grabber.clinchThrowFailStagger, true, "visible recoil pose");
      assert.equal(
        s.grabber.clinchOpenUntil,
        impactAt + CLINCH_THROW_FAIL_STAGGER_MS
      );
      assert.equal(s.grabbed.hasDeepGrip, false, "no Deep Grip for passive Plant");
    });

    it(`${type}: Perfect Brace freezes ${CLINCH_PERFECT_BRACE_HITSTOP_MS}ms, Opens ${CLINCH_PERFECT_BRACE_OPEN_MS}ms and grants Deep Grip`, () => {
      const s = sc();
      const impactAt = s.now() + (type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS);
      resolvePerfectBrace(s, type);

      const fail = s.io.last("clinch_throw_fail");
      assert.ok(fail);
      assert.equal(fail.payload.perfectBrace, true);

      const hitstop = s.io.last("hitstop");
      assert.ok(hitstop);
      assert.equal(hitstop.payload.duration, CLINCH_PERFECT_BRACE_HITSTOP_MS);
      assert.equal(hitstop.payload.kind, "clinch_perfect_brace");
      assert.ok(
        CLINCH_PERFECT_BRACE_HITSTOP_MS > CLINCH_THROW_RESISTED_HITSTOP_MS,
        "Perfect Brace must read stronger than ordinary resistance"
      );

      assert.equal(s.grabber.isClinchOpen, true);
      assert.equal(
        s.grabber.clinchOpenUntil,
        impactAt + CLINCH_PERFECT_BRACE_OPEN_MS
      );
      assert.equal(s.grabbed.hasDeepGrip, true);
      assert.equal(s.grabber.hasDeepGrip, false);
      assert.equal(s.grabbed.isClinchPerfectBracing, true);
      assert.ok(s.io.last("deep_grip"));
    });
  }

  it("Open counts down on the sim clock, so hitstop does not eat the recovery", () => {
    const s = sc();
    resolvePassivePlant(s, "throw");
    const openUntil = s.grabber.clinchOpenUntil;
    // Freeze the room for the authored hitstop; sim time must not advance.
    const simBefore = s.now();
    s.room.hitstopUntil = Date.now() + CLINCH_THROW_RESISTED_HITSTOP_MS + 50;
    s.advanceTime(CLINCH_THROW_RESISTED_HITSTOP_MS);
    assert.equal(s.now(), simBefore, "sim clock is frozen during hitstop");
    assert.equal(s.grabber.clinchOpenUntil, openUntil, "Open deadline unchanged");
    assert.equal(s.grabber.isClinchOpen, true);
  });

  it("attacker Open expires exactly at the authored duration, with no extra cooldown", () => {
    const s = sc();
    resolvePassivePlant(s, "throw");
    s.advanceTime(CLINCH_THROW_FAIL_STAGGER_MS - 1);
    assert.equal(s.grabber.isClinchOpen, true, "still Open 1ms early");
    assert.equal(s.grabber.clinchThrowFailStagger, true);
    s.advanceTime(1);
    assert.equal(s.grabber.isClinchOpen, false);
    assert.equal(s.grabber.clinchThrowFailStagger, false);
    // No hidden lockout after the authored recovery: a fresh request commits.
    s.commitTechniqueNow(s.grabber, "throw");
    assert.equal(s.grabber.clinchThrowActive, true);
  });

  it("a buffered attacker technique cannot bypass Open", () => {
    const s = sc();
    const anim = CLINCH_THROW_ANIMATION_MS;
    s.setActivePlant(s.grabbed, s.now() - 400);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    // Attacker mashes a follow-up technique during their own startup.
    s.grabber.clinchThrowRequest = "pull";
    s.grabber.clinchThrowRequestTime = s.now();
    s.grabber.clinchMouse2BufferTime = s.now();
    s.grabber.clinchWTapTime = s.now();
    s.advance(anim);
    if (s.grabber.clinchThrowActive) s.stepOnce();

    assert.equal(s.grabber.isClinchOpen, true);
    assert.equal(s.grabber.clinchThrowRequest, null, "buffer voided by Open");
    assert.equal(s.grabber.clinchMouse2BufferTime, 0);
    assert.equal(s.grabber.clinchWTapTime, 0);

    // Even a request injected mid-Open is voided by the authority layer, so it
    // can never queue up and auto-fire when the recovery ends.
    s.grabber.clinchThrowRequest = "throw";
    s.grabber.clinchThrowRequestTime = s.now() - (CLINCH_THROW_CLASH_WINDOW_MS + 1);
    s.advance(CLINCH_THROW_FAIL_STAGGER_MS - 30);
    assert.equal(s.grabber.clinchThrowActive, false, "cannot commit while Open");
    assert.equal(s.grabber.clinchThrowRequest, null, "mid-Open request voided");
    s.advance(60);
    assert.equal(
      s.grabber.clinchThrowActive,
      false,
      "nothing auto-fires the instant Open ends"
    );
  });

  it("a buffered jolt cannot fire out of Open either", () => {
    const s = sc();
    s.setActivePlant(s.grabbed, s.now() - 400);
    s.setActiveTechnique(s.grabber, "throw", s.now());
    s.grabber.clinchJoltRequest = true;
    s.grabber.clinchJoltRequestTime = s.now();
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.equal(s.grabber.clinchJoltRequest, false);
    s.advance(CLINCH_THROW_FAIL_STAGGER_MS + 40);
    assert.equal(s.grabber.isClinchJolting, false);
  });

  it("the defender is not locked — they get a real punish window", () => {
    withRoleSwap({}, (s, label) => {
      resolvePassivePlant(s, "throw");
      assert.equal(s.grabbed.isClinchOpen, false, label);
      assert.equal(s.grabbed.clinchThrowFailStagger, false, label);
      assert.ok(
        !(s.grabbed.inputLockUntil > s.now()),
        `${label}: defender must not be input-locked`
      );
      assert.equal(s.grabbed.hasGrip, true, label);
      assert.equal(s.grabber.inClinch, true, `${label}: clinch resumes`);
      // Defender can immediately punish the Open attacker.
      s.commitTechniqueNow(s.grabbed, "throw");
      assert.equal(s.grabbed.clinchThrowActive, true, label);
    });
  });

  it("Perfect Brace also returns the defender to control immediately", () => {
    const s = sc();
    resolvePerfectBrace(s, "throw");
    assert.equal(s.grabbed.isClinchOpen, false);
    assert.ok(!(s.grabbed.inputLockUntil > s.now()));
    s.commitTechniqueNow(s.grabbed, "pull");
    assert.equal(s.grabbed.clinchThrowActive, true);
    assert.equal(
      s.grabbed.clinchThrowUsedDeepGrip,
      true,
      "Perfect Brace Deep Grip carries into the punish"
    );
  });

  it("resisted costs are charged once to the attacker", () => {
    const s = sc();
    const stamBefore = s.grabber.stamina;
    const balBefore = s.grabber.balance;
    // Full production path: request → commit → startup → impact.
    s.setActivePlant(s.grabbed, s.now() - 400);
    s.commitTechniqueNow(s.grabber, "throw");
    assert.equal(s.grabber.clinchThrowActive, true);
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabber.clinchThrowActive) s.stepOnce();
    assert.ok(s.io.last("clinch_throw_fail")?.payload?.resistedByPlant);

    // Commit cost + fail cost, exactly once each.
    assert.equal(
      s.grabber.stamina,
      stamBefore - CLINCH_THROW_STAMINA_COST - CLINCH_THROW_FAIL_STAMINA_COST
    );
    assert.ok(s.grabber.balance < balBefore, "attacker pays posture on the whiff");
    assert.equal(
      s.io.find("clinch_throw_fail").length,
      1,
      "one authoritative fail event"
    );
    assert.equal(s.io.find("hitstop").length, 1, "one impact beat");
  });
});

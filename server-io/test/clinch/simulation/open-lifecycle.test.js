"use strict";

/**
 * OPEN LIFECYCLE — the punish window has to be honest in both directions.
 *
 * Two properties are pinned here:
 *   1. Presentation and authority are the same clock. isClinchOpen, the
 *      fail-stagger pose, the stun-star driving state and the action lock all
 *      begin on one tick and clear on one tick. The client derives stars and the
 *      wobble pose straight from these synced flags (GameFighter's
 *      clinchVulnerable / $isClinchOpen), with no independent local timer, so
 *      server alignment IS visual alignment.
 *   2. An Open player has no gameplay actions, and nothing they mash during Open
 *      survives into the recovery tick — including a Back/S press, which must
 *      never backdate into a Perfect Brace against the punish.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_THROW_FAIL_STAGGER_MS,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
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

function animFor(type) {
  return type === "pull" ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
}

/** Attacker commits `type`; defender answers with a fresh in-startup Brace. */
function perfectBrace(s, attacker, defender, type) {
  const start = s.now();
  s.setActiveTechnique(attacker, type, start);
  s.setActivePlant(defender, start + 30, attacker);
  s.advance(animFor(type));
  if (attacker.clinchThrowActive) s.stepOnce();
}

/** Attacker commits `type` into a Plant established before the tell. */
function passivePlant(s, attacker, defender, type) {
  s.setActivePlant(defender, s.now() - 400, attacker);
  s.setActiveTechnique(attacker, type, s.now());
  s.advance(animFor(type));
  if (attacker.clinchThrowActive) s.stepOnce();
}

/** The client's star gate, mirrored exactly (GameFighter clinchVulnerable). */
function starsShowing(p) {
  return (
    !!(p.isClinchOpen || p.clinchThrowFailStagger || p.clinchJoltRecovery) &&
    !p.clinchOpenHideStars
  );
}

describe("Open lifecycle alignment", () => {
  for (const [label, resolve, duration] of [
    ["ordinary RESISTED", passivePlant, CLINCH_THROW_FAIL_STAGGER_MS],
    ["PERFECT BRACE", perfectBrace, CLINCH_PERFECT_BRACE_OPEN_MS],
  ]) {
    it(`${label}: Open, stagger, stars and the action lock all begin together`, () => {
      const s = sc();
      resolve(s, s.grabber, s.grabbed, "throw");
      assert.equal(s.grabber.isClinchOpen, true);
      assert.equal(s.grabber.clinchThrowFailStagger, true, "visible recoil");
      assert.equal(starsShowing(s.grabber), true, "stars on the same tick");
      assert.equal(s.grabber.clinchAction, "neutral", "no stance while Open");
      assert.equal(s.grabber.isClinchPushing, false);
      assert.equal(s.grabber.isClinchPlanting, false);
    });

    it(`${label}: they all clear on the same authoritative tick`, () => {
      const s = sc();
      resolve(s, s.grabber, s.grabbed, "throw");
      // One tick short of the authored recovery: still fully Open.
      s.advance(duration - s.tickMs * 2);
      assert.equal(s.grabber.isClinchOpen, true, "still recovering");
      assert.equal(s.grabber.clinchThrowFailStagger, true);
      assert.equal(starsShowing(s.grabber), true);

      s.advance(s.tickMs * 3);
      assert.equal(s.grabber.isClinchOpen, false, "recovered");
      assert.equal(
        s.grabber.clinchThrowFailStagger,
        false,
        "pose must not linger past actionability"
      );
      assert.equal(
        starsShowing(s.grabber),
        false,
        "no stars implying vulnerability after recovery"
      );
      assert.equal(s.grabber.clinchOpenUntil, 0);
    });
  }

  it("stars track Open for the entire recovery, not just its edges", () => {
    const s = sc();
    perfectBrace(s, s.grabber, s.grabbed, "throw");
    let samples = 0;
    while (s.grabber.isClinchOpen) {
      assert.equal(
        starsShowing(s.grabber),
        true,
        "stars must never blink off mid-Open"
      );
      samples += 1;
      s.advance(s.tickMs);
      if (samples > 200) break;
    }
    assert.ok(samples > 20, "sampled a real span of the recovery");
    assert.equal(starsShowing(s.grabber), false);
  });
});

describe("An Open player has no gameplay actions", () => {
  it("every clinch action is authoritatively unavailable while Open", () => {
    const s = sc();
    perfectBrace(s, s.grabber, s.grabbed, "throw");
    const openUntil = s.grabber.clinchOpenUntil;

    // Mash literally everything for most of the recovery.
    while (s.now() < openUntil - 60) {
      s.holdToward(s.grabber);
      s.setActivePlant(s.grabber, s.now());
      s.setThrowRequest(s.grabber, "throw", s.now());
      s.setJoltRequest(s.grabber, s.now());
      s.setBreakRequest(s.grabber, s.now());
      s.advance(s.tickMs);

      assert.equal(s.grabber.clinchThrowActive, false, "no technique");
      assert.equal(s.grabber.isClinchJolting, false, "no jolt");
      assert.equal(s.grabber.isGrabBreaking, false, "no break");
      assert.equal(s.grabber.clinchAction, "neutral", "no push/plant stance");
      assert.equal(s.grabber.isClinchPushing, false);
      assert.equal(s.grabber.isClinchPlanting, false);
      assert.equal(
        s.grabber.clinchBraceArmedTechnique,
        null,
        "no technique-scoped Brace arming while Open"
      );
    }
  });

  it("nothing mashed during Open fires on the recovery tick", () => {
    const s = sc();
    perfectBrace(s, s.grabber, s.grabbed, "throw");
    const openUntil = s.grabber.clinchOpenUntil;
    while (s.now() < openUntil - 40) {
      s.setThrowRequest(s.grabber, "throw", s.now());
      s.setJoltRequest(s.grabber, s.now());
      s.setBreakRequest(s.grabber, s.now());
      s.advance(s.tickMs);
    }
    // Release everything, then cross the recovery boundary.
    s.holdNeutral(s.grabber);
    s.advance(120 + CLINCH_THROW_CLASH_WINDOW_MS);
    assert.equal(s.grabber.isClinchOpen, false, "recovered");
    assert.equal(
      s.grabber.clinchThrowActive,
      false,
      "a mashed technique must not auto-fire out of Open"
    );
    assert.equal(s.grabber.isClinchJolting, false);
    assert.equal(s.grabber.isGrabBreaking, false);
    assert.equal(s.grabber.clinchThrowRequest, null);
    assert.equal(s.grabber.clinchJoltRequest, false);
  });

  it("a Plant activation stamp cannot survive Open", () => {
    const s = sc();
    perfectBrace(s, s.grabber, s.grabbed, "throw");
    assert.equal(s.grabber.isClinchOpen, true);

    // Even if a stamp somehow exists at the moment Open lands, it is voided.
    s.grabber.clinchBraceSimTime = s.now();
    s.grabber.clinchBraceLatchUntil = s.now() + 500;
    s.advance(s.tickMs * 2);
    assert.equal(
      s.grabber.clinchBraceSimTime || 0,
      0,
      "no Plant activation stamp may survive Open"
    );
    assert.equal(s.grabber.clinchBraceArmedTechnique, null);
    assert.equal(s.grabber.clinchBraceLatchUntil || 0, 0);
  });

  it("held direction resuming after Open is not a fresh Brace activation", () => {
    const s = sc();
    perfectBrace(s, s.grabber, s.grabbed, "throw");
    // The recovering player simply keeps holding away the whole time.
    const openUntil = s.grabber.clinchOpenUntil;
    while (s.now() < openUntil + 40) {
      s.holdAway(s.grabber);
      s.advance(s.tickMs);
    }
    assert.equal(s.grabber.isClinchOpen, false);
    const stampAfterRecovery = s.grabber.clinchBraceSimTime || 0;

    // The opponent's next technique must not read that hold as an active brace.
    s.io.clear();
    const start = s.now();
    s.setActiveTechnique(s.grabbed, "throw", start);
    s.advance(CLINCH_THROW_ANIMATION_MS);
    if (s.grabbed.clinchThrowActive) s.stepOnce();
    assert.ok(
      stampAfterRecovery < start,
      "any activation stamp predates the tell, so it is predictive"
    );
    const evt = s.io
      .find("clinch_throw_fail")
      .find((e) => e.payload.actorId === s.grabbed.id);
    if (evt) {
      assert.notEqual(
        evt.payload.perfectBrace,
        true,
        "resumed hold is passive Plant at best, never Perfect Brace"
      );
    }
    assert.equal(
      s.grabber.hasDeepGrip,
      false,
      "and it is never rewarded with Deep Grip"
    );
  });
});

describe("MANDATORY: immediate defender punish must land inside Open", () => {
  for (const type of ["throw", "pull"]) {
    it(`Perfect Brace → buffered ${type} punish lands while the attacker is still Open`, () => {
      const s = sc();
      // 1-2. Attacker throws, defender Perfect Braces it.
      perfectBrace(s, s.grabber, s.grabbed, "throw");
      const fail = s.io.last("clinch_throw_fail");
      assert.equal(fail.payload.perfectBrace, true, "the brace registered");
      assert.equal(s.grabbed.hasDeepGrip, true, "defender earned Deep Grip");
      assert.equal(s.grabber.isClinchOpen, true);
      const openUntil = s.grabber.clinchOpenUntil;

      // 3-4. Defender buffers the punish at the contact beat (the harness runs a
      // deterministic sim with hitstop collapsed, so this IS the first legal
      // post-hitstop tick).
      const balanceBeforePunish = s.grabber.balance;
      s.commitTechniqueNow(s.grabbed, type);
      assert.equal(
        s.grabbed.clinchThrowActive,
        true,
        "punish begins on the first legal tick — no dead frames"
      );
      const impactAt = s.grabbed.clinchThrowStartTime + animFor(type);
      assert.ok(
        impactAt < openUntil,
        `punish must impact before recovery (impact ${impactAt}, recovery ${openUntil}, margin ${openUntil - impactAt}ms)`
      );

      // 5-6. The Open attacker tries every defence during the punish startup.
      while (s.grabbed.clinchThrowActive && s.now() < impactAt + s.tickMs) {
        s.setActivePlant(s.grabber, s.now());
        s.holdAway(s.grabber);
        s.setThrowRequest(s.grabber, "throw", s.now());
        s.setJoltRequest(s.grabber, s.now());
        s.setBreakRequest(s.grabber, s.now());
        s.advance(s.tickMs);
        assert.equal(s.grabber.clinchThrowActive, false, "cannot counter");
        assert.equal(s.grabber.isClinchJolting, false, "cannot jolt");
        assert.equal(s.grabber.isGrabBreaking, false, "cannot break out");
      }

      // 7. The punish landed — no resist, no Perfect Brace, no refusal.
      const punishFail = s.io
        .find("clinch_throw_fail")
        .filter((e) => e.payload.actorId === s.grabbed.id);
      assert.equal(
        punishFail.length,
        0,
        "an Open opponent cannot resist the punish"
      );
      // A Throw dumps them (isBeingThrown); a Pull yanks them across. Both drain
      // posture on a clean landing, which is the shared proof it connected.
      assert.ok(
        s.grabber.balance < balanceBeforePunish,
        `the punish drained posture (${balanceBeforePunish} → ${s.grabber.balance})`
      );
      if (type === "throw") {
        assert.equal(
          s.grabber.isBeingThrown,
          true,
          "a landed Throw dumps the helpless attacker"
        );
      }
    });
  }

  it("role swap: the punish invariant is symmetric", () => {
    withRoleSwap({}, (s, label) => {
      const attacker = s.grabber;
      const defender = s.grabbed;
      perfectBrace(s, attacker, defender, "throw");
      assert.equal(attacker.isClinchOpen, true, `${label}: attacker Open`);
      const openUntil = attacker.clinchOpenUntil;
      s.commitTechniqueNow(defender, "throw");
      assert.equal(
        defender.clinchThrowActive,
        true,
        `${label}: punish starts immediately`
      );
      const impactAt = defender.clinchThrowStartTime + CLINCH_THROW_ANIMATION_MS;
      assert.ok(impactAt < openUntil, `${label}: punish lands inside Open`);
    });
  });

  it("ordinary RESISTED also leaves a real punish window", () => {
    const s = sc();
    passivePlant(s, s.grabber, s.grabbed, "throw");
    assert.equal(s.grabber.isClinchOpen, true);
    const openUntil = s.grabber.clinchOpenUntil;
    s.commitTechniqueNow(s.grabbed, "throw");
    assert.equal(s.grabbed.clinchThrowActive, true);
    const impactAt = s.grabbed.clinchThrowStartTime + CLINCH_THROW_ANIMATION_MS;
    assert.ok(
      impactAt < openUntil,
      `550ms Open must still fit a 220ms punish (margin ${openUntil - impactAt}ms)`
    );
  });
});

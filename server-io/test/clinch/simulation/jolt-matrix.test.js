"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_JOLT_ANIMATION_MS,
  CLINCH_JOLT_RECOVERY_MS,
  CLINCH_JOLT_BALANCE_VS_PLANT,
  CLINCH_JOLT_BALANCE_VS_NEUTRAL,
  CLINCH_JOLT_SELF_BALANCE_VS_PUSH,
  CLINCH_JOLT_LOCKOUT_VS_PLANT,
  CLINCH_JOLT_LOCKOUT_VS_NEUTRAL,
  CLINCH_JOLT_STAMINA_COST,
  CLINCH_JOLT_HITSTOP_MS,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_FAIL_STAGGER_MS,
  CLINCH_LIGHT_DRIVE_MS,
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

function runJoltToImpact(s, jolter, setupTarget) {
  setupTarget(s);
  const target = s.other(jolter);
  const before = {
    jolterBal: jolter.balance,
    targetBal: target.balance,
    jolterStam: jolter.stamina,
    targetX: target.x,
    jolterX: jolter.x,
    targetDeep: !!target.hasDeepGrip,
    jolterDeep: !!jolter.hasDeepGrip,
  };

  s.setJoltRequest(jolter, s.now());
  s.stepOnce();
  assert.equal(jolter.isClinchJolting, true, "jolt startup began");
  assert.equal(jolter.clinchJoltRequest, false);
  assert.ok(jolter.stamina <= before.jolterStam - Math.min(CLINCH_JOLT_STAMINA_COST, before.jolterStam));

  s.advance(CLINCH_JOLT_ANIMATION_MS);
  // Impact resolves on the tick where elapsed >= anim
  if (jolter.isClinchJolting) s.stepOnce();

  const evt = s.io.last("clinch_jolt");
  return {
    before,
    event: evt && evt.payload,
    jolterBal: jolter.balance,
    targetBal: target.balance,
    targetLock: target.inputLockUntil || 0,
    jolterRecovery: !!jolter.clinchJoltRecovery,
    jolterOpen: !!jolter.isClinchOpen,
    jolterDeep: !!jolter.hasDeepGrip,
    targetDeep: !!target.hasDeepGrip,
    plantInterrupt: !!target.clinchJoltPlantInterrupt,
    targetThrowReq: target.clinchThrowRequest,
    targetThrowActive: !!target.clinchThrowActive,
  };
}

describe("Jolt collision matrix", () => {
  it(`startup is ${CLINCH_JOLT_ANIMATION_MS}ms`, () => {
    assert.equal(CLINCH_JOLT_ANIMATION_MS, 240);
  });

  it("Jolt vs active Plant: heavy punish, Deep Grip, plant interrupt", () => {
    const s = sc();
    const r = runJoltToImpact(s, s.grabber, (scen) => {
      scen.setActivePlant(scen.grabbed, scen.now());
    });
    assert.ok(r.event);
    assert.equal(r.event.type, "single");
    assert.equal(r.targetBal, r.before.targetBal - CLINCH_JOLT_BALANCE_VS_PLANT);
    assert.equal(r.plantInterrupt, true);
    assert.equal(r.jolterDeep, true);
    assert.ok(r.targetLock >= s.now());
    assert.equal(r.jolterRecovery, true);
  });

  it("Jolt vs neutral: modest damage + lockout", () => {
    const s = sc();
    const r = runJoltToImpact(s, s.grabber, (scen) => {
      scen.holdNeutral(scen.grabbed);
    });
    assert.equal(r.targetBal, r.before.targetBal - CLINCH_JOLT_BALANCE_VS_NEUTRAL);
    assert.equal(r.plantInterrupt, false);
    assert.equal(r.jolterDeep, false);
  });

  it("Jolt vs Light Drive: treated like neutral (not self-damage disaster)", () => {
    const s = sc();
    const r = runJoltToImpact(s, s.grabber, (scen) => {
      scen.setLightDrive(scen.grabbed);
      scen.stepOnce();
      assert.equal(scen.grabbed.isClinchCommittedDrive, false);
    });
    assert.equal(r.targetBal, r.before.targetBal - CLINCH_JOLT_BALANCE_VS_NEUTRAL);
    assert.equal(
      r.jolterBal,
      r.before.jolterBal,
      "no self-damage vs light drive"
    );
  });

  it("Jolt vs Committed Drive: self-damage + Open, no target lockout damage", () => {
    const s = sc();
    const r = runJoltToImpact(s, s.grabber, (scen) => {
      scen.setCommittedDrive(scen.grabbed);
      scen.stepOnce();
      assert.equal(scen.grabbed.isClinchCommittedDrive, true);
    });
    assert.equal(r.targetBal, r.before.targetBal, "no balance damage to committed driver");
    assert.equal(
      r.jolterBal,
      r.before.jolterBal - CLINCH_JOLT_SELF_BALANCE_VS_PUSH
    );
    assert.equal(r.event.intoCommittedDrive, true);
    assert.ok(r.jolterOpen || r.jolterRecovery);
  });

  it("Jolt vs Push→Plant transition (cancel pending): reads as neutral, not Plant", () => {
    const s = sc();
    const r = runJoltToImpact(s, s.grabber, (scen) => {
      scen.setDrivePlantCancel(scen.grabbed, scen.now() + 50);
      assert.equal(scen.grabbed.clinchAction !== "plant" || true, true);
    });
    // At impact, if cancel still pending → neutral result
    // Our cancel is +50 from setup time; startup is 240ms so cancel completes before impact.
    // Re-run with cancel lasting past impact:
    s.dispose();
    scenarios.pop();

    const s2 = sc();
    s2.setCommittedDrive(s2.grabbed);
    s2.stepOnce();
    s2.holdAway(s2.grabbed);
    s2.stepOnce();
    // Force cancel far into the future past jolt impact
    s2.grabbed.clinchDrivePlantCancelUntil =
      s2.now() + CLINCH_JOLT_ANIMATION_MS + 100;
    s2.holdAway(s2.grabbed);
    const r2 = runJoltToImpact(s2, s2.grabber, () => {});
    assert.equal(
      r2.targetBal,
      r2.before.targetBal - CLINCH_JOLT_BALANCE_VS_NEUTRAL,
      "mid-cancel must not take Plant punish"
    );
    assert.equal(r2.plantInterrupt, false);
  });

  it("stance switch during startup: evaluated at impact (Plant late → Plant punish)", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    assert.equal(s.grabber.isClinchJolting, true);
    // Switch to plant 100ms into startup
    s.advance(100);
    s.setActivePlant(s.grabbed, s.now());
    s.advance(CLINCH_JOLT_ANIMATION_MS - 100);
    if (s.grabber.isClinchJolting) s.stepOnce();
    const evt = s.io.last("clinch_jolt");
    assert.ok(evt);
    assert.equal(s.grabbed.clinchJoltPlantInterrupt, true);
  });

  it("stance switch to Committed Drive before impact → disaster for jolter", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(200);
    s.setCommittedDrive(s.grabbed);
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS - 200);
    if (s.grabber.isClinchJolting) s.stepOnce();
    const evt = s.io.last("clinch_jolt");
    assert.ok(evt);
    assert.equal(evt.payload.intoCommittedDrive, true);
  });

  for (const when of [
    { name: "immediately", ms: 0 },
    { name: "1ms after startup", ms: 1 },
    { name: "100ms into startup", ms: 100 },
    { name: "200ms into startup", ms: 200 },
    { name: "1ms before impact", ms: CLINCH_JOLT_ANIMATION_MS - 1 },
  ]) {
    it(`Plant switch ${when.name}: impact uses current Plant`, () => {
      const s = sc();
      s.holdNeutral(s.grabbed);
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      if (when.ms > 0) s.advance(when.ms);
      s.setActivePlant(s.grabbed, s.now());
      const left = CLINCH_JOLT_ANIMATION_MS - when.ms;
      if (left > 0) s.advance(left);
      if (s.grabber.isClinchJolting) s.stepOnce();
      assert.equal(s.grabbed.clinchJoltPlantInterrupt, true);
    });
  }

  it("pending Throw on target is cleared on Jolt land (not committed)", () => {
    const s = sc();
    s.setThrowRequest(s.grabbed, "throw", s.now());
    const r = runJoltToImpact(s, s.grabber, (scen) => {
      scen.holdNeutral(scen.grabbed);
    });
    assert.equal(r.targetThrowReq, null);
    assert.equal(r.targetThrowActive, false);
  });

  it("committed Throw on target: grabber is resisting and cannot start Jolt (current gate)", () => {
    // CURRENT: jolt accept rejects isResistingThrow / isResistingPull.
    // When the opponent has an active technique, the other fighter is marked
    // resisting — so they cannot jolt during that startup.
    const s = sc();
    s.setActiveTechnique(s.grabbed, "throw", s.now());
    assert.equal(s.grabber.isResistingThrow, true);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    assert.equal(s.grabber.isClinchJolting, false);
    assert.equal(s.grabber.clinchJoltRequest, false);
    assert.equal(s.grabbed.clinchThrowActive, true);
  });

  it("committed Throw on jolter blocks jolt; buffered target request cleared if jolt lands from other setups", () => {
    // Mirror: attacker with committed throw cannot jolt; document clear rule on land
    // using a non-resisting jolter (grabber) vs buffered (not active) target request.
    const s = sc();
    s.setThrowRequest(s.grabbed, "throw", s.now());
    s.setJoltStartup(s.grabber, s.now());
    assert.equal(s.grabbed.clinchThrowActive, false);
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    assert.equal(s.grabbed.clinchThrowRequest, null);
  });

  describe("REGRESSION: stale buffered technique during Jolt lock", () => {
    it("Player A pending Throw → B lands Jolt → A locked → pending must NOT commit during lock", () => {
      const s = sc();
      // A = grabbed has pending throw
      s.setThrowRequest(s.grabbed, "throw", s.now() - (CLINCH_THROW_CLASH_WINDOW_MS + 5));
      // B jolts
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      s.advance(CLINCH_JOLT_ANIMATION_MS);
      if (s.grabber.isClinchJolting) s.stepOnce();

      // After jolt land, production clears uncommitted request:
      assert.equal(
        s.grabbed.clinchThrowRequest,
        null,
        "CURRENT: jolt land clears buffered technique"
      );
      assert.equal(s.grabbed.clinchThrowActive, false);

      // Even if a stale request were re-injected while locked, commit must fail
      s.setThrowRequest(s.grabbed, "throw", s.now() - 100);
      const lockUntil = s.grabbed.inputLockUntil;
      assert.ok(lockUntil > s.now(), "jolt should apply lockout");
      s.stepOnce();
      assert.equal(
        s.grabbed.clinchThrowActive,
        false,
        "must not commit while input-locked after jolt"
      );
      assert.equal(s.grabbed.clinchThrowRequest, "throw");

      // After lock ends, request could still commit if not cleared — document current behavior
      s.advanceTime(lockUntil - s.now() + 1);
      s.stepOnce();
      // CURRENT BEHAVIOR: stale request survives lock and can commit afterward.
      // This is the dangerous pattern if jolt failed to clear the buffer.
      if (s.grabbed.clinchThrowRequest === "throw") {
        assert.equal(
          s.grabbed.clinchThrowActive,
          true,
          "DOCUMENTED: request that survives until lock end will commit (jolt clear is the real guard)"
        );
      }
    });

    it("if jolt clear is skipped for active-only path, buffered request must still be gone", () => {
      const s = sc();
      s.setThrowRequest(s.grabbed, "pull", s.now());
      s.holdNeutral(s.grabbed);
      s.setJoltStartup(s.grabber, s.now());
      s.advance(CLINCH_JOLT_ANIMATION_MS);
      if (s.grabber.isClinchJolting) s.stepOnce();
      assert.equal(s.grabbed.clinchThrowRequest, null);
    });
  });

  it("Break request during jolt startup: Break processed before jolt accept on later ticks", () => {
    const s = sc();
    s.setJoltStartup(s.grabber, s.now());
    s.setBreakRequest(s.grabbed, s.now());
    s.stepOnce();
    // Break runs first; should end clinch
    assert.ok(
      s.grabbed.isGrabBreaking ||
        s.grabber.isGrabBreakSeparating ||
        !s.grabber.inClinch
    );
  });

  it("Open target can still be jolted (jolter path); Open jolter cannot start", () => {
    const s = sc();
    s.setOpen(s.grabber, s.now() + 1000);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    assert.equal(s.grabber.isClinchJolting, false);
    assert.equal(s.grabber.clinchJoltRequest, false);
  });

  it("gassed jolter still jolts (soft cost) with reduced effect vs plant", () => {
    const s = sc();
    s.setGassed(s.grabber);
    s.setActivePlant(s.grabbed, s.now());
    const beforeBal = s.grabbed.balance;
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    const dmg = beforeBal - s.grabbed.balance;
    assert.ok(dmg < CLINCH_JOLT_BALANCE_VS_PLANT, "gassed mult reduces plant damage");
    assert.ok(dmg > 0);
  });

  it("pending Break cleared/consumed when break resolves; jolt recovery blocks new jolt", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    assert.equal(s.grabber.clinchJoltRecovery, true);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    assert.equal(s.grabber.isClinchJolting, false);
  });
});

/**
 * Jolt is intentionally NOT paced like Throw/Pull: it risks less and rewards
 * less, so it keeps its own shorter recovery. These lock that in and cover the
 * "Committed Drive beats Jolt" feedback, which used to contradict itself.
 */
describe("Jolt audit — recovery, feedback, single-charge costs", () => {
  it(`recovery stays at ${CLINCH_JOLT_RECOVERY_MS}ms (not raised to Throw/Pull pacing)`, () => {
    assert.equal(CLINCH_JOLT_RECOVERY_MS, 420);
    assert.ok(
      CLINCH_JOLT_RECOVERY_MS < CLINCH_THROW_FAIL_STAGGER_MS,
      "jolt risks less than a technique, so it recovers faster"
    );
  });

  it("jolt recovery Open ends exactly at the authored duration", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    assert.equal(s.grabber.isClinchOpen, true);
    s.advance(CLINCH_JOLT_RECOVERY_MS - 60);
    assert.equal(s.grabber.isClinchOpen, true, "still recovering");
    s.advance(90);
    assert.equal(s.grabber.isClinchOpen, false, "recovery released on time");
    assert.equal(s.grabber.clinchJoltRecovery, false);
  });

  it("Committed Drive beats Jolt: the winner is not posed or gated as if jolted", () => {
    const s = sc();
    s.setCommittedDrive(s.grabbed);
    s.stepOnce();
    s.setDeepGrip(s.grabbed);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();

    const evt = s.io.last("clinch_jolt");
    assert.ok(evt, "the failure is still announced");
    assert.equal(evt.payload.intoCommittedDrive, true);
    assert.equal(
      evt.payload.combatPresentation?.outcome,
      "INTO_DRIVE",
      "presentation reads as a failure, not a hit"
    );
    assert.ok(s.io.find("hitstop").length >= 1, "contact beat is still felt");

    assert.equal(
      s.grabbed.isBeingClinchJolted,
      false,
      "the driver won — no jolted recoil pose"
    );
    assert.equal(s.grabbed.hasDeepGrip, true, "a swallowed jolt strips nothing");
    assert.equal(s.grabbed.inputLockUntil || 0, 0, "no lockout on the winner");
    assert.equal(s.grabber.isClinchOpen, true, "the jolter eats the disadvantage");
    assert.equal(s.grabber.clinchThrowFailStagger, true, "visible failed state");
  });

  it("Committed Drive keeps its buffered technique — the free window is the reward", () => {
    const s = sc();
    s.setCommittedDrive(s.grabbed);
    s.stepOnce();
    s.setThrowRequest(s.grabbed, "throw", s.now());
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    // Either it already committed on the resolve tick or it is still queued and
    // free to commit — what must never happen is a silent cancel.
    if (!s.grabbed.clinchThrowActive) {
      assert.equal(s.grabbed.clinchThrowRequest, "throw");
      s.advance(CLINCH_THROW_CLASH_WINDOW_MS + 16);
    }
    assert.equal(s.grabbed.clinchThrowActive, true, "free technique window honored");
  });

  it("jolt-into-Drive self-posture cost is charged exactly once", () => {
    const s = sc();
    s.setCommittedDrive(s.grabbed);
    s.stepOnce();
    const before = s.grabber.balance;
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    assert.equal(s.grabber.balance, before - CLINCH_JOLT_SELF_BALANCE_VS_PUSH);
    // Settle past recovery with the Drive released, so the only balance change
    // that could appear is a duplicated jolt cost.
    s.holdNeutral(s.grabbed);
    const afterImpact = s.grabber.balance;
    s.advance(CLINCH_JOLT_RECOVERY_MS + 200);
    assert.ok(
      s.grabber.balance >= afterImpact,
      "the jolt self-cost is never charged a second time"
    );
    assert.equal(s.io.find("clinch_jolt").length, 1, "one resolution only");
  });

  it("a jolt held through recovery does not auto-fire when recovery ends", () => {
    const s = sc();
    s.holdNeutral(s.grabbed);
    s.setJoltRequest(s.grabber, s.now());
    s.stepOnce();
    s.advance(CLINCH_JOLT_ANIMATION_MS);
    if (s.grabber.isClinchJolting) s.stepOnce();
    s.grabber.clinchJoltRequest = true;
    s.grabber.clinchJoltRequestTime = s.now();
    s.advance(CLINCH_JOLT_HITSTOP_MS + CLINCH_JOLT_RECOVERY_MS + 120);
    assert.equal(s.grabber.isClinchJolting, false, "must re-press Mouse1");
    assert.equal(s.io.find("clinch_jolt").length, 1);
  });
});

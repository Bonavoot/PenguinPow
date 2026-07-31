"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  FACING_LOCK_REASON,
  FACING_RELEASE,
  acquireOffensiveAerialFacingLock,
  releaseOffensiveAerialFacingLock,
  forceClearOffensiveAerialFacingLock,
  getOffensiveAerialFacingLock,
  updateOffensiveAerialFacingLockDirection,
  resolveNeutralFacingAfterAerial,
  applyNeutralFacingAfterAerial,
  sanitizeFacing,
} = require("../../offensiveAerialFacing");
const {
  OFFENSIVE_AERIAL_PRESENTATION,
  resolveOffensiveAerialPresentation,
  syncOffensiveAerialPresentation,
} = require("../../offensiveAerialPresentation");
const { getLockedFacing, enforcePairFacing } = require("../../facingSystem");
const { GROUND_LEVEL } = require("../../constants");
const {
  setOffensiveAerialReactionV2ForTests,
  setOffensiveAerialReactionPresetForTests,
} = require("../../offensiveAerialFlags");
const {
  createSlideJumpScenario,
  stepSlideJumpTick,
  runUntil,
  runTicks,
  placeDescendingOverOpponent,
  armDefenderParry,
} = require("./helpers/slideJumpSim");
const { clearAllActionStates } = require("../../gameUtils");
const { OFFENSIVE_AERIAL_OUTCOME } = require("../../offensiveAerialOutcome");
const { OFFENSIVE_AERIAL_REACTION } = require("../../offensiveAerialReaction");

function v2(opts = {}) {
  return createSlideJumpScenario({ ...opts, reactionV2: true });
}

describe("Phase 5A — offensive aerial facing lock + presentation", () => {
  beforeEach(() => {
    setOffensiveAerialReactionV2ForTests(true);
    setOffensiveAerialReactionPresetForTests("heavy_short");
  });

  // ── Facing locks ──────────────────────────────────────────────

  it("1. FLAP acquires FLIGHT facing owner with steer allowed", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    const lock = getOffensiveAerialFacingLock(s.attacker);
    assert.ok(lock?.active);
    assert.equal(lock.reason, FACING_LOCK_REASON.FLIGHT);
    assert.equal(lock.allowSteerUpdate, true);
    assert.equal(
      lock.ownerInstanceId,
      s.attacker.offensiveAerial.attackInstanceId
    );
    assert.equal(getLockedFacing(s.attacker), s.attacker.facing);
  });

  it("2. S-dive acquires DIVE facing owner without steer", () => {
    const s = v2({ armFlap: true, dive: true });
    const lock = getOffensiveAerialFacingLock(s.attacker);
    assert.ok(lock?.active);
    assert.equal(lock.reason, FACING_LOCK_REASON.DIVE);
    assert.equal(lock.allowSteerUpdate, false);
    assert.equal(getLockedFacing(s.attacker), lock.direction);
  });

  it("3. HIT continuation preserves direction through contact", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    const facingBefore = s.attacker.facing;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial?.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    const lock = getOffensiveAerialFacingLock(s.attacker);
    assert.ok(lock?.active);
    assert.equal(lock.reason, FACING_LOCK_REASON.HIT_CONTINUATION);
    assert.equal(lock.allowSteerUpdate, false);
    assert.equal(s.attacker.facing, facingBefore);
  });

  it("4. PARRIED fall does not flicker during root crossing", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    armDefenderParry(s.defender, s.room.simTime || 0, "regular");
    stepSlideJumpTick(s);
    assert.equal(
      s.attacker.offensiveAerial?.outcome,
      OFFENSIVE_AERIAL_OUTCOME.PARRIED
    );
    const locked = s.attacker.facing;
    assert.equal(
      getOffensiveAerialFacingLock(s.attacker)?.reason,
      FACING_LOCK_REASON.PARRIED_RECOIL
    );
    s.attacker.x = s.defender.x + 40;
    enforcePairFacing(s.attacker, s.defender);
    assert.equal(s.attacker.facing, locked);
    s.attacker.keys.a = true;
    s.attacker.keys.d = false;
    runTicks(s, 3);
    assert.equal(s.attacker.facing, locked);
  });

  it("5. WHIFF descent preserves intended direction", () => {
    const s = v2({ armFlap: true, flapFlight: true, attackerX: 400, defenderX: 700 });
    const facing = s.attacker.facing;
    acquireOffensiveAerialFacingLock(s.attacker, {
      ownerInstanceId: s.attacker.offensiveAerial.attackInstanceId,
      direction: facing,
      reason: FACING_LOCK_REASON.WHIFF_DESCENT,
      allowSteerUpdate: false,
      supersede: true,
    });
    s.attacker.x = 650;
    enforcePairFacing(s.attacker, s.defender);
    assert.equal(s.attacker.facing, facing);
  });

  it("6. Interruption releases the old aerial lock", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    assert.ok(getOffensiveAerialFacingLock(s.attacker)?.active);
    clearAllActionStates(s.attacker);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("7. Touchdown transfers ownership once to LANDING", () => {
    const s = v2({
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 700,
      attackerY: GROUND_LEVEL + 20,
      velY: -2,
    });
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 80);
    const lock = getOffensiveAerialFacingLock(s.attacker);
    assert.ok(lock?.active);
    assert.equal(lock.reason, FACING_LOCK_REASON.LANDING);
    assert.equal(lock.allowSteerUpdate, false);
  });

  it("8. Recovery completion restores neutral facing", () => {
    const s = v2({
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 700,
      attackerY: GROUND_LEVEL + 10,
      velY: -4,
    });
    runUntil(s, () => !s.attacker.isSlideJumping, 200);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
    assert.equal(s.attacker.facing, s.attacker.x < s.defender.x ? -1 : 1);
  });

  it("9. Stale owner cannot release a newer lock", () => {
    const p = v2({ armFlap: true }).attacker;
    const idA = p.offensiveAerial.attackInstanceId;
    acquireOffensiveAerialFacingLock(p, {
      supersede: true,
      ownerInstanceId: "newer:oa:99",
      direction: 1,
      reason: FACING_LOCK_REASON.FLIGHT,
      allowSteerUpdate: false,
    });
    const r = releaseOffensiveAerialFacingLock(p, {
      expectedInstanceId: idA,
      reason: "stale",
    });
    assert.equal(r.rejected, true);
    assert.ok(getOffensiveAerialFacingLock(p)?.active);
    assert.equal(getOffensiveAerialFacingLock(p).ownerInstanceId, "newer:oa:99");
  });

  it("10. Stale owner cannot overwrite a newer lock", () => {
    const p = v2({ armFlap: true }).attacker;
    acquireOffensiveAerialFacingLock(p, {
      supersede: true,
      ownerInstanceId: "newer:oa:99",
      direction: 1,
      reason: FACING_LOCK_REASON.DIVE,
      allowSteerUpdate: false,
    });
    const rejected = acquireOffensiveAerialFacingLock(p, {
      ownerInstanceId: "old:oa:1",
      direction: -1,
      reason: FACING_LOCK_REASON.FLIGHT,
      allowSteerUpdate: true,
    });
    assert.equal(rejected.ownerInstanceId, "newer:oa:99");
    assert.equal(rejected.direction, 1);
  });

  it("11. Full reset clears every lock", () => {
    const s = v2({ armFlap: true });
    forceClearOffensiveAerialFacingLock(s.attacker, {
      reason: FACING_RELEASE.FULL_RESET,
    });
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("12. Same-center fallback is deterministic", () => {
    const player = { x: 100, facing: 1, _oaFacingPreviousValid: -1 };
    const opponent = { x: 100 };
    assert.equal(resolveNeutralFacingAfterAerial(player, opponent), -1);
    assert.equal(sanitizeFacing(0, -1), -1);
    assert.equal(sanitizeFacing(NaN, 1), 1);
  });

  it("13. Both directions mirror correctly", () => {
    const left = v2({
      armFlap: true,
      jumpDir: 1,
      attackerX: 500,
      defenderX: 600,
    });
    const right = v2({
      armFlap: true,
      jumpDir: -1,
      attackerX: 600,
      defenderX: 500,
    });
    assert.equal(left.attacker.facing, -1);
    assert.equal(right.attacker.facing, 1);
  });

  it("14. Boundary cases do not invert facing under frozen lock", () => {
    const s = v2({ armFlap: true, dive: true });
    const locked = s.attacker.facing;
    s.attacker.x = 340;
    s.defender.x = 935;
    enforcePairFacing(s.attacker, s.defender);
    assert.equal(s.attacker.facing, locked);
  });

  it("15. No valid path leaves the fighter permanently locked", () => {
    const s = v2({
      armFlap: true,
      flapFlight: true,
      attackerX: 420,
      defenderX: 700,
      attackerY: GROUND_LEVEL + 15,
      velY: -3,
    });
    runUntil(s, () => !s.attacker.isSlideJumping, 240);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
    assert.ok(s.attacker.facing === 1 || s.attacker.facing === -1);
  });

  // ── Presentation states ───────────────────────────────────────

  it("16. Active FLAP resolves to FLIGHT_ACTIVE", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    assert.equal(
      resolveOffensiveAerialPresentation(s.attacker),
      OFFENSIVE_AERIAL_PRESENTATION.FLIGHT_ACTIVE
    );
  });

  it("17. Active S-dive resolves to DIVE_ACTIVE", () => {
    const s = v2({ armFlap: true, dive: true });
    assert.equal(
      resolveOffensiveAerialPresentation(s.attacker),
      OFFENSIVE_AERIAL_PRESENTATION.DIVE_ACTIVE
    );
  });

  it("18. HIT resolves to HIT_CONTINUATION", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    stepSlideJumpTick(s);
    assert.equal(
      resolveOffensiveAerialPresentation(s.attacker),
      OFFENSIVE_AERIAL_PRESENTATION.HIT_CONTINUATION
    );
  });

  it("19. PARRIED airborne reaction resolves to PARRIED_FALL", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    armDefenderParry(s.defender, s.room.simTime || 0, "regular");
    stepSlideJumpTick(s);
    assert.equal(
      resolveOffensiveAerialPresentation(s.attacker),
      OFFENSIVE_AERIAL_PRESENTATION.PARRIED_FALL
    );
  });

  it("20. WHIFF resolves to WHIFF_DESCENT", () => {
    const p = {
      isSlideJumping: true,
      slideJumpPhase: "flight",
      offensiveAerial: { outcome: OFFENSIVE_AERIAL_OUTCOME.WHIFF },
      offensiveAerialReactionType: OFFENSIVE_AERIAL_REACTION.WHIFF_DESCENT,
      y: GROUND_LEVEL + 10,
    };
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.WHIFF_DESCENT
    );
  });

  it("21. Interruption resolves to INTERRUPTED_AIRBORNE", () => {
    const p = {
      isHitFalling: true,
      y: GROUND_LEVEL + 40,
      isSlideJumping: false,
    };
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.INTERRUPTED_AIRBORNE
    );
  });

  it("22. Touchdown resolves before landing recovery", () => {
    const p = {
      isSlideJumping: true,
      slideJumpPhase: "landing",
      _oaTouchdownPresentation: true,
      y: GROUND_LEVEL,
    };
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.TOUCHDOWN
    );
    p._oaTouchdownPresentation = false;
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.LANDING_RECOVERY
    );
  });

  it("23. Landing recovery cannot show active attack", () => {
    const p = {
      isSlideJumping: true,
      slideJumpPhase: "landing",
      slideJumpDiveCommitted: true,
      slideJumpFlapFlightActive: true,
      y: GROUND_LEVEL,
    };
    const state = resolveOffensiveAerialPresentation(p);
    assert.notEqual(state, OFFENSIVE_AERIAL_PRESENTATION.FLIGHT_ACTIVE);
    assert.notEqual(state, OFFENSIVE_AERIAL_PRESENTATION.DIVE_ACTIVE);
    assert.equal(state, OFFENSIVE_AERIAL_PRESENTATION.LANDING_RECOVERY);
  });

  it("24. Grounded stagger cannot appear before touchdown", () => {
    const p = {
      isSlideJumping: true,
      slideJumpPhase: "flight",
      isRecovering: true,
      offensiveAerial: { outcome: OFFENSIVE_AERIAL_OUTCOME.PARRIED },
      offensiveAerialReactionType: OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL,
      y: GROUND_LEVEL + 30,
    };
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.PARRIED_FALL
    );
  });

  it("25. Idle cannot appear while airborne slide-jumping", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    assert.notEqual(
      resolveOffensiveAerialPresentation(s.attacker),
      OFFENSIVE_AERIAL_PRESENTATION.NONE
    );
  });

  it("26. Full reset resolves to NONE", () => {
    const p = { isSlideJumping: false, isFlapping: false, isHitFalling: false };
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.NONE
    );
    syncOffensiveAerialPresentation(p);
    assert.equal(p.offensiveAerialPresentation, OFFENSIVE_AERIAL_PRESENTATION.NONE);
  });

  // ── Lifecycle regressions ─────────────────────────────────────

  it("27. FLAP hit lifecycle clears facing + presentation", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 45, dive: true });
    stepSlideJumpTick(s);
    runUntil(s, () => !s.attacker.isSlideJumping, 200);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
    assert.equal(
      s.attacker.offensiveAerialPresentation,
      OFFENSIVE_AERIAL_PRESENTATION.NONE
    );
  });

  it("28. FLAP parry lifecycle clears facing + presentation", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    armDefenderParry(s.defender, s.room.simTime || 0, "regular");
    stepSlideJumpTick(s);
    runUntil(
      s,
      () => !s.attacker.isSlideJumping && !getOffensiveAerialFacingLock(s.attacker),
      300
    );
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("29. S-dive hit lifecycle clears cleanly", () => {
    const s = v2({ dive: true });
    placeDescendingOverOpponent(s, { height: 40, dive: true });
    stepSlideJumpTick(s);
    runUntil(s, () => !s.attacker.isSlideJumping, 200);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("30. S-dive parry lifecycle clears cleanly", () => {
    const s = v2({ dive: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    armDefenderParry(s.defender, s.room.simTime || 0, "regular");
    stepSlideJumpTick(s);
    runUntil(s, () => !s.attacker.isSlideJumping, 300);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("31. Whiff lifecycle clears cleanly", () => {
    const s = v2({
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 800,
      attackerY: GROUND_LEVEL + 20,
      velY: -3,
    });
    runUntil(s, () => !s.attacker.isSlideJumping, 200);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("32. Interrupted lifecycle clears aerial facing", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    clearAllActionStates(s.attacker);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
    assert.equal(s.attacker.isSlideJumping, false);
  });

  it("33. Plain slide-jump lifecycle remains unlockable", () => {
    const s = v2({
      attackerX: 400,
      defenderX: 700,
      attackerY: GROUND_LEVEL + 15,
      velY: -3,
    });
    assert.equal(s.attacker.offensiveAerial, null);
    assert.ok(getOffensiveAerialFacingLock(s.attacker)?.active);
    runUntil(s, () => !s.attacker.isSlideJumping, 200);
    assert.equal(getOffensiveAerialFacingLock(s.attacker), null);
  });

  it("34. Frozen HIT lock rejects steer direction updates", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    acquireOffensiveAerialFacingLock(s.attacker, {
      supersede: true,
      ownerInstanceId: s.attacker.offensiveAerial.attackInstanceId,
      direction: -1,
      reason: FACING_LOCK_REASON.HIT_CONTINUATION,
      allowSteerUpdate: false,
    });
    assert.equal(
      updateOffensiveAerialFacingLockDirection(s.attacker, 1),
      false
    );
    assert.equal(s.attacker.facing, -1);
  });

  it("35. Release is idempotent; applyNeutral is valid", () => {
    const s = v2({ armFlap: true });
    const id = s.attacker.offensiveAerial.attackInstanceId;
    assert.equal(
      releaseOffensiveAerialFacingLock(s.attacker, { expectedInstanceId: id })
        .released,
      true
    );
    assert.equal(
      releaseOffensiveAerialFacingLock(s.attacker, { expectedInstanceId: id })
        .released,
      false
    );
    applyNeutralFacingAfterAerial(s.attacker, s.defender);
    assert.ok(s.attacker.facing === 1 || s.attacker.facing === -1);
  });
});

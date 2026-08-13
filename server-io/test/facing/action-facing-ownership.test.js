"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseActionFacingOwnershipV2Flag,
  setActionFacingOwnershipV2ForTests,
  isActionFacingOwnershipV2Enabled,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  ACTION_FACING_RELEASE,
  sanitizeFacing,
  mintActionFacingInstanceId,
  acquireActionFacingLock,
  updateActionFacingLockDirection,
  releaseActionFacingLock,
  releaseStrikeFacingLock,
  forceClearActionFacingLock,
  getActionFacingLock,
  resolveNeutralFacingAfterAction,
  applyNeutralFacingAfterAction,
} = require("../../actionFacingOwnership");
const { getLockedFacing, enforcePairFacing } = require("../../facingSystem");
const { endHitKnockback, clearAllActionStates } = require("../../gameUtils");

function makePlayer(overrides = {}) {
  return {
    id: overrides.id || "p1",
    x: 400,
    facing: -1,
    slapFacingDirection: null,
    chargingFacingDirection: null,
    atTheRopesFacingDirection: null,
    pullFacingDirection: null,
    throwingFacingDirection: null,
    beingThrownFacingDirection: null,
    actionFacingLock: null,
    _actionFacingSeq: 0,
    isAttacking: false,
    isDodging: false,
    isHit: false,
    isThrowing: false,
    isBeingThrown: false,
    knockbackVelocity: { x: 0, y: 0 },
    ...overrides,
  };
}

describe("Phase 12 — ACTION_FACING_OWNERSHIP_V2 flag", () => {
  afterEach(() => setActionFacingOwnershipV2ForTests(null));

  it("defaults ON when unset", () => {
    assert.equal(parseActionFacingOwnershipV2Flag(undefined), true);
    assert.equal(parseActionFacingOwnershipV2Flag(null), true);
    assert.equal(parseActionFacingOwnershipV2Flag(""), true);
  });

  it("parses 1/true on and 0/false off", () => {
    assert.equal(parseActionFacingOwnershipV2Flag("1"), true);
    assert.equal(parseActionFacingOwnershipV2Flag("true"), true);
    assert.equal(parseActionFacingOwnershipV2Flag("TRUE"), true);
    assert.equal(parseActionFacingOwnershipV2Flag("0"), false);
    assert.equal(parseActionFacingOwnershipV2Flag("false"), false);
    assert.equal(parseActionFacingOwnershipV2Flag("FALSE"), false);
  });

  it("test override toggles isActionFacingOwnershipV2Enabled", () => {
    setActionFacingOwnershipV2ForTests(true);
    assert.equal(isActionFacingOwnershipV2Enabled(), true);
    setActionFacingOwnershipV2ForTests(false);
    assert.equal(isActionFacingOwnershipV2Enabled(), false);
  });
});

describe("Phase 12 — ownership primitives", () => {
  beforeEach(() => setActionFacingOwnershipV2ForTests(true));
  afterEach(() => setActionFacingOwnershipV2ForTests(null));

  it("acquire valid owner locks facing", () => {
    const p = makePlayer({ facing: 1 });
    const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    const lock = acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: id,
      direction: -1,
      reason: ACTION_FACING_REASON.COMMIT,
      syncLegacy: false,
    });
    assert.ok(lock?.active);
    assert.equal(lock.direction, -1);
    assert.equal(p.facing, -1);
    assert.equal(getLockedFacing(p), -1);
  });

  it("sanitizeFacing rejects invalid / zero", () => {
    assert.equal(sanitizeFacing(0, -1), -1);
    assert.equal(sanitizeFacing(undefined, 1), 1);
    assert.equal(sanitizeFacing(2, -1), 1);
    assert.equal(sanitizeFacing(-3, 1), -1);
  });

  it("expected-owner release succeeds; stale release fails", () => {
    const p = makePlayer();
    const id1 = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: id1,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const id2 = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: id2,
      direction: 1,
      supersede: true,
      syncLegacy: false,
    });
    const stale = releaseActionFacingLock(p, {
      expectedInstanceId: id1,
      expectedOwnerType: ACTION_FACING_OWNER.SLAP,
      clearLegacy: false,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.rejected, true);
    assert.ok(getActionFacingLock(p)?.active);
    assert.equal(p.facing, 1);

    const ok = releaseActionFacingLock(p, {
      expectedInstanceId: id2,
      expectedOwnerType: ACTION_FACING_OWNER.SLAP,
      clearLegacy: false,
    });
    assert.equal(ok.released, true);
    assert.equal(getActionFacingLock(p), null);
  });

  it("old owner cannot overwrite newer higher/equal-priority without supersede", () => {
    const p = makePlayer();
    const slapId = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: slapId,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const dodgeId = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.DODGE);
    const result = acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.DODGE,
      ownerInstanceId: dodgeId,
      direction: 1,
      supersede: false,
      syncLegacy: false,
    });
    assert.equal(result.ownerType, ACTION_FACING_OWNER.SLAP);
    assert.equal(p.facing, -1);
  });

  it("hitstun supersedes slap", () => {
    const p = makePlayer();
    const slapId = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: slapId,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const hitId = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.HITSTUN);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.HITSTUN,
      ownerInstanceId: hitId,
      direction: 1,
      supersede: true,
      syncLegacy: false,
    });
    assert.equal(getActionFacingLock(p).ownerType, ACTION_FACING_OWNER.HITSTUN);
    assert.equal(p.facing, 1);
    const staleSlap = releaseActionFacingLock(p, {
      expectedInstanceId: slapId,
      expectedOwnerType: ACTION_FACING_OWNER.SLAP,
      clearLegacy: false,
    });
    assert.equal(staleSlap.rejected, true);
    assert.equal(getActionFacingLock(p).ownerType, ACTION_FACING_OWNER.HITSTUN);
  });

  it("release is idempotent", () => {
    const p = makePlayer();
    const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.PALM);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.PALM,
      ownerInstanceId: id,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const r1 = releaseActionFacingLock(p, {
      expectedInstanceId: id,
      expectedOwnerType: ACTION_FACING_OWNER.PALM,
      clearLegacy: false,
    });
    const r2 = releaseActionFacingLock(p, {
      expectedInstanceId: id,
      expectedOwnerType: ACTION_FACING_OWNER.PALM,
      clearLegacy: false,
    });
    assert.equal(r1.released, true);
    assert.equal(r2.ok, true);
    assert.equal(r2.released, false);
  });

  it("full reset clears ownership", () => {
    const p = makePlayer({ slapFacingDirection: -1 });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    forceClearActionFacingLock(p, {
      reason: ACTION_FACING_RELEASE.FULL_RESET,
      clearAllLegacy: true,
    });
    assert.equal(getActionFacingLock(p), null);
    assert.equal(p.slapFacingDirection, null);
  });

  it("releaseStrikeFacingLock drops slap/palm/charge leftovers, not ropes", () => {
    const p = makePlayer({ slapFacingDirection: -1, chargingFacingDirection: 1 });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    releaseStrikeFacingLock(p, { reason: ACTION_FACING_RELEASE.INTERRUPT });
    assert.equal(getActionFacingLock(p), null);
    assert.equal(p.slapFacingDirection, null);
    assert.equal(p.chargingFacingDirection, null);

    const ropes = makePlayer({ atTheRopesFacingDirection: 1 });
    acquireActionFacingLock(ropes, {
      ownerType: ACTION_FACING_OWNER.ROPES,
      direction: 1,
      supersede: true,
      syncLegacy: false,
    });
    releaseStrikeFacingLock(ropes);
    assert.equal(getActionFacingLock(ropes).ownerType, ACTION_FACING_OWNER.ROPES);
    assert.equal(ropes.atTheRopesFacingDirection, 1);
  });

  it("same-center neutral fallback is deterministic", () => {
    const p = makePlayer({
      x: 500,
      facing: 1,
      _afFacingPreviousValid: -1,
    });
    const opp = makePlayer({ id: "p2", x: 500, facing: -1 });
    assert.equal(resolveNeutralFacingAfterAction(p, opp), -1);
    applyNeutralFacingAfterAction(p, opp);
    assert.equal(p.facing, -1);
  });

  it("both directions mirror under lock", () => {
    for (const dir of [-1, 1]) {
      const p = makePlayer({ facing: dir === -1 ? 1 : -1 });
      acquireActionFacingLock(p, {
        ownerType: ACTION_FACING_OWNER.CHARGED_ATTACK,
        direction: dir,
        supersede: true,
        syncLegacy: false,
      });
      assert.equal(getLockedFacing(p), dir);
      const opp = makePlayer({ id: "o", x: p.x + (dir === -1 ? 100 : -100) });
      enforcePairFacing(p, opp);
      assert.equal(p.facing, dir);
    }
  });

  it("direction update denied unless allowDirectionUpdate", () => {
    const p = makePlayer();
    const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.DODGE);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.DODGE,
      ownerInstanceId: id,
      direction: -1,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
    assert.equal(updateActionFacingLockDirection(p, 1, { expectedInstanceId: id }), false);
    assert.equal(p.facing, -1);
  });

  it("legacy path (V2 off) does not create actionFacingLock", () => {
    setActionFacingOwnershipV2ForTests(false);
    const p = makePlayer();
    const lock = acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      direction: 1,
      syncLegacy: true,
    });
    assert.equal(lock, null);
    assert.equal(p.actionFacingLock, null);
    assert.equal(p.slapFacingDirection, 1);
  });
});

describe("Phase 12 — lifecycle handoffs", () => {
  beforeEach(() => setActionFacingOwnershipV2ForTests(true));
  afterEach(() => setActionFacingOwnershipV2ForTests(null));

  it("slap chain stage transfer: new instance supersedes old", () => {
    const p = makePlayer();
    const a = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: a,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const b = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: b,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    assert.equal(getActionFacingLock(p).ownerInstanceId, b);
    assert.equal(
      releaseActionFacingLock(p, {
        expectedInstanceId: a,
        expectedOwnerType: ACTION_FACING_OWNER.SLAP,
        clearLegacy: false,
      }).rejected,
      true
    );
  });

  it("charged travel facing survives opponent crossing", () => {
    const p = makePlayer({ x: 400, facing: -1 });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.CHARGED_ATTACK,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const opp = makePlayer({ id: "o", x: 300 });
    p.x = 350;
    enforcePairFacing(p, opp);
    assert.equal(p.facing, -1);
  });

  it("dodge lock freezes; release restores ordinary facing", () => {
    const p = makePlayer({ x: 500, facing: -1 });
    const opp = makePlayer({ id: "o", x: 300, facing: 1 });
    const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.DODGE);
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.DODGE,
      ownerInstanceId: id,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    enforcePairFacing(p, opp);
    assert.equal(p.facing, -1);
    releaseActionFacingLock(p, {
      expectedInstanceId: id,
      expectedOwnerType: ACTION_FACING_OWNER.DODGE,
      clearLegacy: false,
    });
    enforcePairFacing(p, opp);
    assert.equal(p.facing, 1);
  });

  it("grab startup lock freezes through recovery; unlocks after recovery ends", () => {
    const { executeGrabWhiff, endGrabWhiffRecovery } = require("../../grabMechanics");
    const { timeoutManager } = require("../../gameUtils");
    const p = makePlayer({
      id: "grabber",
      x: 500,
      facing: -1,
      grabFacingInstanceId: null,
      isGrabStartup: true,
      keys: {},
    });
    const opp = makePlayer({ id: "o", x: 300, facing: 1 });
    const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.GRAB_STARTUP);
    p.grabFacingInstanceId = id;
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.GRAB_STARTUP,
      ownerInstanceId: id,
      direction: -1,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
    enforcePairFacing(p, opp);
    assert.equal(p.facing, -1, "lunge facing must not flip mid-attempt");

    executeGrabWhiff(p);
    assert.ok(getActionFacingLock(p), "lock must survive into recovery");
    assert.equal(p.grabFacingInstanceId, id);
    enforcePairFacing(p, opp);
    assert.equal(p.facing, -1, "must not turn during recovery");

    timeoutManager.clearPlayerSpecific(p.id, "grabWhiffRecovery");
    timeoutManager.clearPlayerSpecific(p.id, "grabMovementTimeout");
    endGrabWhiffRecovery(p);
    assert.equal(getActionFacingLock(p), null);
    assert.equal(p.grabFacingInstanceId, null);
    enforcePairFacing(p, opp);
    assert.equal(p.facing, 1);
  });

  it("hitstun end releases HITSTUN owner", () => {
    const p = makePlayer({ isHit: true });
    const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.HITSTUN);
    p.hitstunFacingInstanceId = id;
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.HITSTUN,
      ownerInstanceId: id,
      direction: 1,
      supersede: true,
      syncLegacy: false,
    });
    endHitKnockback(p);
    assert.equal(p.isHit, false);
    assert.equal(getActionFacingLock(p), null);
  });

  it("clearAllActionStates force-clears non-aerial lock", () => {
    const p = makePlayer({
      id: "clear-p",
      keys: {},
      offensiveAerial: null,
    });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    clearAllActionStates(p);
    assert.equal(getActionFacingLock(p), null);
  });

  it("pull side-switch owner blocks ordinary overwrite", () => {
    const p = makePlayer({ x: 600, facing: 1 });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.PULL,
      direction: 1,
      supersede: true,
      syncLegacy: false,
    });
    const opp = makePlayer({ id: "o", x: 700 });
    enforcePairFacing(p, opp);
    assert.equal(p.facing, 1);
  });

  it("throw victim owner survives root crossing", () => {
    const p = makePlayer({ x: 500, facing: -1, isBeingThrown: true });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.THROW_VICTIM,
      direction: -1,
      supersede: true,
      syncLegacy: false,
    });
    const opp = makePlayer({ id: "o", x: 400 });
    p.x = 350;
    enforcePairFacing(p, opp);
    assert.equal(p.facing, -1);
  });

  it("no valid lifecycle ends permanently locked after force clear", () => {
    const p = makePlayer({ x: 200 });
    const opp = makePlayer({ id: "o", x: 400 });
    acquireActionFacingLock(p, {
      ownerType: ACTION_FACING_OWNER.ROPES,
      direction: 1,
      supersede: true,
      syncLegacy: false,
    });
    forceClearActionFacingLock(p, { reason: ACTION_FACING_RELEASE.FULL_RESET });
    enforcePairFacing(p, opp);
    assert.equal(p.facing, -1);
  });
});

describe("Phase 12 — V2 off preserves legacy getLockedFacing soft fields", () => {
  beforeEach(() => setActionFacingOwnershipV2ForTests(false));
  afterEach(() => setActionFacingOwnershipV2ForTests(null));

  it("slapFacingDirection still locks when V2 off", () => {
    const p = makePlayer({ slapFacingDirection: 1, facing: -1 });
    assert.equal(getLockedFacing(p), 1);
  });

  it("isDodging still freezes facing when V2 off", () => {
    const p = makePlayer({ isDodging: true, facing: 1 });
    assert.equal(getLockedFacing(p), 1);
  });

  it("grab attempt/recovery still freezes facing when V2 off", () => {
    const p = makePlayer({ isWhiffingGrab: true, facing: -1 });
    assert.equal(getLockedFacing(p), -1);
  });
});

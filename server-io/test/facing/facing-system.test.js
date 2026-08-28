"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  facingTowardOpponent,
  getLockedFacing,
  enforcePlayerFacing,
  enforcePairFacing,
  retargetPostSidestepActionFacing,
  retargetChargeHoldFacing,
} = require("../../facingSystem");
const {
  setActionFacingOwnershipV2ForTests,
  mintActionFacingInstanceId,
  acquireActionFacingLock,
  getActionFacingLock,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
} = require("../../actionFacingOwnership");

function makePlayer(overrides = {}) {
  return {
    id: overrides.id || "p",
    x: 100,
    facing: -1,
    slapFacingDirection: null,
    chargingFacingDirection: null,
    atTheRopesFacingDirection: null,
    beingThrownFacingDirection: null,
    actionFacingLock: null,
    _actionFacingSeq: 0,
    postSidestepFacingTrackUntil: 0,
    isAttacking: false,
    isChargingAttack: false,
    isDodging: false,
    isSidestepping: false,
    isFlapping: false,
    isSlideJumping: false,
    isRopeJumping: false,
    isIceSliding: false,
    isHit: false,
    isThrowing: false,
    isBeingThrown: false,
    isClinchKillPullVictim: false,
    isBeingPullReversaled: false,
    isAttemptingPull: false,
    isBoundaryPullSwap: false,
    pullFacingDirection: null,
    isRingOutPushCutscene: false,
    ...overrides,
  };
}

describe("facingSystem hard rule", () => {
  it("facingTowardOpponent uses relative X ( -1 faces right, 1 faces left )", () => {
    const left = makePlayer({ x: 100 });
    const right = makePlayer({ x: 200 });
    assert.equal(facingTowardOpponent(left, right), -1);
    assert.equal(facingTowardOpponent(right, left), 1);
  });

  it("neutral players always face each other after a side switch", () => {
    // After crossing, both still look right (facing === -1) — the classic bug
    const p1 = makePlayer({ id: "p1", x: 300, facing: -1 });
    const p2 = makePlayer({ id: "p2", x: 100, facing: -1 });
    assert.equal(p1.facing, p2.facing);

    enforcePairFacing(p1, p2);

    assert.equal(p1.facing, 1); // look left toward p2
    assert.equal(p2.facing, -1); // look right toward p1
    assert.notEqual(p1.facing, p2.facing);
  });

  it("ice-slide / rope-jump are NOT locks — face opponent through side switch", () => {
    const slider = makePlayer({
      id: "slider",
      x: 250,
      facing: -1, // travel-facing stale
      isIceSliding: true,
    });
    const grounded = makePlayer({ id: "ground", x: 100, facing: -1 });

    assert.equal(getLockedFacing(slider), null);
    enforcePairFacing(slider, grounded);
    assert.equal(slider.facing, 1);
    assert.equal(grounded.facing, -1);
  });

  it("flap excludes flier from auto-face; grounded opponent still faces them", () => {
    const flier = makePlayer({
      id: "flier",
      x: 250,
      facing: -1, // free air facing — auto-face must not overwrite
      isFlapping: true,
    });
    const grounded = makePlayer({ id: "ground", x: 100, facing: 1 });

    assert.equal(getLockedFacing(flier), -1);
    assert.equal(getLockedFacing(grounded), null);
    enforcePairFacing(flier, grounded);
    assert.equal(flier.facing, -1); // untouched by auto-face
    assert.equal(grounded.facing, -1); // looks at flier
  });

  it("dodge hop freezes facing (travel is dodgeDirection)", () => {
    const dodger = makePlayer({
      id: "dodge",
      x: 250,
      facing: -1, // locked looking right even though now on the right
      isDodging: true,
    });
    const other = makePlayer({ id: "other", x: 100, facing: 1 });

    assert.equal(getLockedFacing(dodger), -1);
    enforcePairFacing(dodger, other);
    assert.equal(dodger.facing, -1); // still frozen
    assert.equal(other.facing, -1); // other faces the dodger
  });

  it("slapFacingDirection / attack / ropes / throw victim stay locked", () => {
    const cases = [
      makePlayer({ slapFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ isAttacking: true, chargingFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ atTheRopesFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ beingThrownFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ isClinchKillPullVictim: true, facing: 1, x: 300 }),
      makePlayer({ isChargingAttack: true, chargingFacingDirection: 1, facing: -1, x: 300 }),
    ];
    const opp = makePlayer({ x: 100 });

    for (const p of cases) {
      enforcePlayerFacing(p, opp);
      // All locked looking left (1) despite being on the right of opp
      assert.equal(p.facing, 1, `expected lock to hold for ${JSON.stringify(p)}`);
    }
  });

  it("when both are hit, neither facing is auto-corrected", () => {
    const p1 = makePlayer({ id: "p1", x: 300, facing: -1, isHit: true });
    const p2 = makePlayer({ id: "p2", x: 100, facing: -1, isHit: true });
    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, -1);
    assert.equal(p2.facing, -1);
  });

  it("sidestep freezes; after sidestep ends, pair re-faces", () => {
    const p1 = makePlayer({
      id: "p1",
      x: 300,
      facing: -1,
      isSidestepping: true,
    });
    const p2 = makePlayer({ id: "p2", x: 100, facing: 1 });

    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, -1);

    p1.isSidestepping = false;
    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, 1);
    assert.equal(p2.facing, -1);
  });

  it("pull yank locks both sides so mid-cross auto-face cannot thrash destination facing", () => {
    // Destination facing already set for post-pull sides (victim will land at x=50).
    const victim = makePlayer({
      id: "victim",
      x: 200, // still crossing through puller
      facing: -1,
      pullFacingDirection: -1,
      isBeingPullReversaled: true,
    });
    const puller = makePlayer({
      id: "puller",
      x: 150,
      facing: 1,
      pullFacingDirection: 1,
      isAttemptingPull: true,
    });

    enforcePairFacing(victim, puller);
    assert.equal(victim.facing, -1);
    assert.equal(puller.facing, 1);
    assert.equal(victim.pullFacingDirection, -1); // lock held while yank active

    // After settle: yank flags clear → orphan cleanup drops locks → re-face.
    victim.isBeingPullReversaled = false;
    puller.isAttemptingPull = false;
    victim.x = 50;
    enforcePairFacing(victim, puller);
    assert.equal(victim.pullFacingDirection, null);
    assert.equal(puller.pullFacingDirection, null);
    assert.equal(victim.facing, -1);
    assert.equal(puller.facing, 1);
  });

  it("isAttemptingPull alone does not keep facing locked after yank flags are gone", () => {
    // Startup pose flag left on without an active yank must not block facing.
    const p1 = makePlayer({
      id: "p1",
      x: 300,
      facing: -1,
      isAttemptingPull: true,
      pullFacingDirection: 1, // stale lock
    });
    const p2 = makePlayer({ id: "p2", x: 100, facing: -1 });
    enforcePairFacing(p1, p2);
    assert.equal(p1.pullFacingDirection, null);
    assert.equal(p1.facing, 1);
    assert.equal(p2.facing, -1);
  });

  it("exact X overlap does not force both players to face the same way", () => {
    const p1 = makePlayer({ id: "p1", x: 100, facing: -1 });
    const p2 = makePlayer({ id: "p2", x: 100, facing: 1 });
    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, -1);
    assert.equal(p2.facing, 1);
  });
});

describe("post-sidestep facing track", () => {
  afterEach(() => setActionFacingOwnershipV2ForTests(null));

  it("retargets action lock when charged lunge flips sides after sidestep", () => {
    setActionFacingOwnershipV2ForTests(true);
    const dodger = makePlayer({
      id: "dodger",
      x: 200,
      facing: -1,
      postSidestepFacingTrackUntil: 1000,
    });
    const attacker = makePlayer({ id: "atk", x: 300, facing: 1 });
    const slapId = mintActionFacingInstanceId(dodger, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(dodger, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: slapId,
      direction: -1, // committed facing right while opponent was on the right
      reason: ACTION_FACING_REASON.COMMIT,
      allowDirectionUpdate: false,
      supersede: true,
    });
    dodger.slapFacingDirection = -1;

    // Charged lunge crosses past the dodger after the slap locked facing.
    attacker.x = 100;
    enforcePairFacing(dodger, attacker, 500);

    assert.equal(getActionFacingLock(dodger).direction, 1);
    assert.equal(dodger.slapFacingDirection, 1);
    assert.equal(dodger.facing, 1);
  });

  it("non-side-switch: track window is a no-op when relative sides stay the same", () => {
    setActionFacingOwnershipV2ForTests(true);
    const dodger = makePlayer({
      id: "dodger",
      x: 200,
      facing: -1,
      postSidestepFacingTrackUntil: 1000,
    });
    const attacker = makePlayer({ id: "atk", x: 300, facing: 1 });
    const slapId = mintActionFacingInstanceId(dodger, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(dodger, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: slapId,
      direction: -1,
      reason: ACTION_FACING_REASON.COMMIT,
      allowDirectionUpdate: false,
      supersede: true,
    });
    dodger.slapFacingDirection = -1;

    // Opponent stays on the same side (failed / short sidestep case).
    attacker.x = 320;
    const changed = retargetPostSidestepActionFacing(dodger, attacker, 500);
    enforcePairFacing(dodger, attacker, 500);

    assert.equal(changed, false);
    assert.equal(getActionFacingLock(dodger).direction, -1);
    assert.equal(dodger.slapFacingDirection, -1);
    assert.equal(dodger.facing, -1);
  });

  it("track window expired: frozen slap lock is not retargeted", () => {
    setActionFacingOwnershipV2ForTests(true);
    const dodger = makePlayer({
      id: "dodger",
      x: 200,
      facing: -1,
      postSidestepFacingTrackUntil: 100,
    });
    const attacker = makePlayer({ id: "atk", x: 100, facing: 1 });
    const slapId = mintActionFacingInstanceId(dodger, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(dodger, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: slapId,
      direction: -1,
      reason: ACTION_FACING_REASON.COMMIT,
      allowDirectionUpdate: false,
      supersede: true,
    });

    enforcePairFacing(dodger, attacker, 500);
    assert.equal(getActionFacingLock(dodger).direction, -1);
    assert.equal(dodger.facing, -1);
  });

  it("does not turn a grab attempt around after a sidestep cross", () => {
    setActionFacingOwnershipV2ForTests(true);
    const grabber = makePlayer({
      id: "grabber",
      x: 400,
      facing: -1,
      isGrabStartup: true,
      grabFacingDirection: -1,
      postSidestepFacingTrackUntil: 1000,
    });
    const opp = makePlayer({ id: "opp", x: 500, facing: 1 });
    const id = mintActionFacingInstanceId(grabber, ACTION_FACING_OWNER.GRAB_STARTUP);
    grabber.grabFacingInstanceId = id;
    acquireActionFacingLock(grabber, {
      ownerType: ACTION_FACING_OWNER.GRAB_STARTUP,
      ownerInstanceId: id,
      direction: -1,
      reason: ACTION_FACING_REASON.COMMIT,
      allowDirectionUpdate: false,
      supersede: true,
    });

    opp.x = 200;
    enforcePairFacing(grabber, opp, 500);
    assert.equal(getLockedFacing(grabber), -1);
    assert.equal(grabber.facing, -1);
    assert.equal(getActionFacingLock(grabber).direction, -1);
  });
});

describe("charge hold facing", () => {
  afterEach(() => setActionFacingOwnershipV2ForTests(null));

  it("retargets toward the opponent when they cross during the hold", () => {
    setActionFacingOwnershipV2ForTests(true);
    const charger = makePlayer({
      id: "chg",
      x: 400,
      facing: -1,
      isChargingAttack: true,
      chargingFacingDirection: -1,
    });
    const opp = makePlayer({ id: "opp", x: 500, facing: 1 });
    const id = mintActionFacingInstanceId(charger, ACTION_FACING_OWNER.CHARGE_HOLD);
    acquireActionFacingLock(charger, {
      ownerType: ACTION_FACING_OWNER.CHARGE_HOLD,
      ownerInstanceId: id,
      direction: -1,
      reason: ACTION_FACING_REASON.CHARGE,
      allowDirectionUpdate: false,
      supersede: true,
    });

    opp.x = 200;
    enforcePairFacing(charger, opp);

    assert.equal(getActionFacingLock(charger).direction, 1);
    assert.equal(charger.chargingFacingDirection, 1);
    assert.equal(charger.facing, 1);
  });

  it("does not retarget a charged lunge already in flight", () => {
    setActionFacingOwnershipV2ForTests(true);
    const charger = makePlayer({
      id: "chg",
      x: 400,
      facing: -1,
      isAttacking: true,
      chargingFacingDirection: -1,
    });
    const opp = makePlayer({ id: "opp", x: 200, facing: 1 });
    acquireActionFacingLock(charger, {
      ownerType: ACTION_FACING_OWNER.CHARGED_ATTACK,
      direction: -1,
      reason: ACTION_FACING_REASON.TRAVEL,
      allowDirectionUpdate: false,
      supersede: true,
    });

    const changed = retargetChargeHoldFacing(charger, opp);
    enforcePairFacing(charger, opp);
    assert.equal(changed, false);
    assert.equal(charger.facing, -1);
  });
});

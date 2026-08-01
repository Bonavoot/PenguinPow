"use strict";

/**
 * Phase 12 correction: W+Mouse2 forward clinch throw facing under
 * ACTION_FACING_OWNERSHIP_V2 must match flag-off legacy presentation.
 *
 * Obsolete bug: V2 locked thrower sprite facing to `throwDir` (world travel
 * ±1), which is the inverse of facing convention and revived an old
 * over-the-head flip. Legacy freezes `player.facing` via `isThrowing`.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_DURATION_MS,
  CLINCH_PULL_ANIMATION_MS,
} = require("../../constants");
const { createClinchScenario } = require("../clinch/harness");
const {
  setActionFacingOwnershipV2ForTests,
  getActionFacingLock,
  ACTION_FACING_OWNER,
} = require("../../actionFacingOwnership");
const {
  getLockedFacing,
  enforcePairFacing,
  facingTowardOpponent,
} = require("../../facingSystem");

const scenarios = [];
afterEach(() => {
  setActionFacingOwnershipV2ForTests(null);
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

/** Align both fighters to current inward clinch facing (production enforce). */
function applyInwardFacing(s) {
  s.p1.facing = facingTowardOpponent(s.p1, s.p2);
  s.p2.facing = facingTowardOpponent(s.p2, s.p1);
}

function resolveForwardThrow(s, thrower) {
  applyInwardFacing(s);
  const throwerFacingBefore = thrower.facing;
  const victim = s.other(thrower);
  const victimFacingBefore = victim.facing;
  s.setActiveTechnique(thrower, "throw");
  // Startup must not flip before impact resolve.
  assert.equal(thrower.facing, throwerFacingBefore, "no flip at throw startup");
  s.advance(CLINCH_THROW_ANIMATION_MS + 5);
  s.stepOnce();
  return { thrower, victim, throwerFacingBefore, victimFacingBefore };
}

describe("Phase 12 correction — forward throw (W+Mouse2) facing", () => {
  describe("V2 on — presentation matches legacy (no travel-dir flip)", () => {
    beforeEach(() => setActionFacingOwnershipV2ForTests(true));

    it("thrower on the left preserves forward/right-facing presentation", () => {
      const s = sc();
      const thrower = s.p1; // left
      const { throwerFacingBefore, victimFacingBefore, victim } =
        resolveForwardThrow(s, thrower);

      assert.equal(throwerFacingBefore, -1, "left thrower faces +X (right)");
      assert.ok(thrower.isThrowing);
      assert.equal(thrower.facing, -1, "presentation facing preserved");
      assert.equal(getLockedFacing(thrower), -1);

      // Travel field remains world +X for forward toss — not sprite facing.
      assert.equal(thrower.throwingFacingDirection, 1);

      const lock = getActionFacingLock(thrower);
      assert.ok(lock?.active);
      assert.equal(lock.ownerType, ACTION_FACING_OWNER.THROWER);
      assert.equal(lock.direction, -1);
      assert.notEqual(
        lock.direction,
        thrower.throwingFacingDirection,
        "V2 must not treat travel sign as sprite facing"
      );

      assert.equal(victim.facing, victimFacingBefore);
      assert.equal(victim.beingThrownFacingDirection, victimFacingBefore);
    });

    it("thrower on the right mirrors correctly", () => {
      const s = sc();
      const thrower = s.p2; // right
      const { throwerFacingBefore, victimFacingBefore, victim } =
        resolveForwardThrow(s, thrower);

      assert.equal(throwerFacingBefore, 1, "right thrower faces −X (left)");
      assert.equal(thrower.facing, 1);
      assert.equal(getLockedFacing(thrower), 1);
      assert.equal(thrower.throwingFacingDirection, -1); // travel −X
      assert.equal(getActionFacingLock(thrower).direction, 1);
      assert.equal(victim.facing, victimFacingBefore);
    });

    it("no obsolete flip at release; overlap cannot flip mid-throw", () => {
      const s = sc();
      const thrower = s.p1;
      const { throwerFacingBefore, victim, victimFacingBefore } =
        resolveForwardThrow(s, thrower);

      assert.equal(thrower.facing, throwerFacingBefore);

      // Force root-order swap / overlap during travel.
      const mid = (thrower.x + victim.x) / 2;
      thrower.x = mid + 40;
      victim.x = mid - 40;
      enforcePairFacing(thrower, victim);
      assert.equal(thrower.facing, throwerFacingBefore);
      assert.equal(victim.facing, victimFacingBefore);

      thrower.x = victim.x;
      enforcePairFacing(thrower, victim);
      assert.equal(thrower.facing, throwerFacingBefore);
      assert.equal(victim.facing, victimFacingBefore);
    });

    it("landing/recovery releases ownership once; neutral facing resumes", () => {
      const s = sc();
      const thrower = s.p1;
      const { victim, throwerFacingBefore } = resolveForwardThrow(s, thrower);
      const throwerId = thrower.throwFacingInstanceId;
      const victimId = victim.throwVictimFacingInstanceId;

      s.advance(CLINCH_THROW_DURATION_MS + 20);
      // Drive throw-end path in the main loop substitute: clear throw flags as
      // index.js does when throwEndTime elapses (harness does not run index.js).
      const {
        releaseActionFacingLock,
        ACTION_FACING_RELEASE,
      } = require("../../actionFacingOwnership");
      releaseActionFacingLock(thrower, {
        expectedInstanceId: throwerId,
        expectedOwnerType: ACTION_FACING_OWNER.THROWER,
        reason: ACTION_FACING_RELEASE.ACTION_END,
        clearLegacy: false,
      });
      releaseActionFacingLock(victim, {
        expectedInstanceId: victimId,
        expectedOwnerType: ACTION_FACING_OWNER.THROW_VICTIM,
        reason: ACTION_FACING_RELEASE.ACTION_END,
        clearLegacy: false,
      });
      thrower.isThrowing = false;
      thrower.throwingFacingDirection = null;
      thrower.throwFacingInstanceId = null;
      victim.isBeingThrown = false;
      victim.beingThrownFacingDirection = null;
      victim.throwVictimFacingInstanceId = null;
      victim.isHit = false;

      assert.equal(getActionFacingLock(thrower), null);
      assert.equal(getActionFacingLock(victim), null);

      // Idempotent second release cannot affect a newer owner.
      releaseActionFacingLock(thrower, {
        expectedInstanceId: throwerId,
        expectedOwnerType: ACTION_FACING_OWNER.THROWER,
        clearLegacy: false,
      });
      const {
        acquireActionFacingLock,
        mintActionFacingInstanceId,
        ACTION_FACING_REASON,
      } = require("../../actionFacingOwnership");
      const nextId = mintActionFacingInstanceId(thrower, ACTION_FACING_OWNER.SLAP);
      acquireActionFacingLock(thrower, {
        ownerType: ACTION_FACING_OWNER.SLAP,
        ownerInstanceId: nextId,
        direction: throwerFacingBefore,
        reason: ACTION_FACING_REASON.COMMIT,
        supersede: true,
        syncLegacy: false,
      });
      const stale = releaseActionFacingLock(thrower, {
        expectedInstanceId: throwerId,
        expectedOwnerType: ACTION_FACING_OWNER.THROWER,
        clearLegacy: false,
      });
      assert.equal(stale.rejected, true);
      assert.equal(getActionFacingLock(thrower).ownerType, ACTION_FACING_OWNER.SLAP);

      // After releasing the slap stand-in, ordinary facing resumes.
      releaseActionFacingLock(thrower, {
        expectedInstanceId: nextId,
        expectedOwnerType: ACTION_FACING_OWNER.SLAP,
        clearLegacy: false,
      });
      enforcePairFacing(thrower, victim);
      assert.equal(thrower.facing, facingTowardOpponent(thrower, victim));
      assert.equal(victim.facing, facingTowardOpponent(victim, thrower));
    });

    it("pull remains on destination facing (unchanged)", () => {
      const s = sc();
      applyInwardFacing(s);
      const actor = s.p1;
      s.setActiveTechnique(actor, "pull");
      s.advance(CLINCH_PULL_ANIMATION_MS + 5);
      s.stepOnce();
      // Pull must not enter forward-throw ownership / travel-dir flip path.
      assert.equal(actor.isThrowing, false);
      assert.equal(getActionFacingLock(actor)?.ownerType, ACTION_FACING_OWNER.PULL);
      assert.notEqual(
        getActionFacingLock(actor)?.ownerType,
        ACTION_FACING_OWNER.THROWER
      );
      assert.ok(actor.pullFacingDirection === 1 || actor.pullFacingDirection === -1);
    });
  });

  describe("V2 off — legacy baseline unchanged", () => {
    beforeEach(() => setActionFacingOwnershipV2ForTests(false));

    it("left thrower keeps facing; travel field is still throwDir", () => {
      const s = sc();
      const thrower = s.p1;
      const { throwerFacingBefore, victimFacingBefore, victim } =
        resolveForwardThrow(s, thrower);

      assert.equal(thrower.facing, throwerFacingBefore);
      assert.equal(getLockedFacing(thrower), throwerFacingBefore); // isThrowing freeze
      assert.equal(thrower.throwingFacingDirection, 1);
      assert.equal(thrower.actionFacingLock, null);
      assert.equal(victim.facing, victimFacingBefore);
    });

    it("right thrower legacy mirror", () => {
      const s = sc();
      const thrower = s.p2;
      const { throwerFacingBefore } = resolveForwardThrow(s, thrower);
      assert.equal(thrower.facing, throwerFacingBefore);
      assert.equal(thrower.throwingFacingDirection, -1);
      assert.equal(getActionFacingLock(thrower), null);
    });
  });

  describe("V2 vs legacy parity", () => {
    it("thrower and victim facing match across flag for both sides", () => {
      for (const throwerIsP1 of [true, false]) {
        setActionFacingOwnershipV2ForTests(false);
        const legacy = sc();
        const legThrower = throwerIsP1 ? legacy.p1 : legacy.p2;
        const leg = resolveForwardThrow(legacy, legThrower);

        setActionFacingOwnershipV2ForTests(true);
        const v2 = sc();
        const v2Thrower = throwerIsP1 ? v2.p1 : v2.p2;
        const cur = resolveForwardThrow(v2, v2Thrower);

        assert.equal(
          cur.thrower.facing,
          leg.thrower.facing,
          `thrower facing parity (p1Thrower=${throwerIsP1})`
        );
        assert.equal(
          cur.victim.facing,
          leg.victim.facing,
          `victim facing parity (p1Thrower=${throwerIsP1})`
        );
        assert.equal(
          cur.thrower.throwingFacingDirection,
          leg.thrower.throwingFacingDirection,
          "travel sign parity"
        );
      }
    });
  });
});

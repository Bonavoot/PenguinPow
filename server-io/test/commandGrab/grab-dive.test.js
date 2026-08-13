"use strict";

/**
 * The grab dive — momentum, not a conveyor belt.
 *
 * The lunge used to be `GRAB_LUNGE_DISTANCE / (startupMs / delta)` written straight
 * into player.x every startup tick. No velocity, no friction, no mass. Three visible
 * problems fell out of that one implementation detail:
 *
 *   1. The distance felt arbitrary at every value, because no physics produced it.
 *   2. The grab stopped dead the instant startup ended, so the 110ms active window
 *      became a STATIONARY suction field — stand still, grab whoever wanders inside
 *      GRAB_RANGE — rather than a body moving through space.
 *   3. A whiff parked you exactly where the belt stopped, as though the miss had hit
 *      an invisible wall, with no skid to sell the commitment.
 *
 * It is now one impulse into grabMovementVelocity bled off by GRAB_LUNGE_FRICTION,
 * integrated the same way every other moving thing on this ice is. These tests pin
 * the properties that make that true, because all three symptoms above would come
 * straight back if the impulse solve, the friction, or the whiff teardown drifted.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  createFoundationScenario,
  advanceSim,
} = require("../foundation/helpers/scenarioHarness");
const { beginGrabStartup } = require("../../gameUtils");
const { executeGrabWhiff } = require("../../grabMechanics");
const { getActionFacingLock } = require("../../actionFacingOwnership");
const { getLockedFacing, enforcePairFacing } = require("../../facingSystem");
const {
  getGrabLungeImpulse,
  getGrabLungeTravel,
  getGrabThreatTravel,
} = require("../../combatHelpers");
const {
  GRAB_LUNGE_DISTANCE,
  GRAB_LUNGE_FRICTION,
  GRAB_STARTUP_DURATION_MS,
  GRAB_ACTIVE_MS,
  GRAB_WHIFF_RECOVERY_MS,
  ICE_SLIDE_MAX_SPEED,
  TICK_RATE,
  speedFactor,
} = require("../../constants");

const TICK_MS = 1000 / TICK_RATE;

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(options) {
  const s = createFoundationScenario(options);
  scenarios.push(s);
  return s;
}

// Replays index.js's per-tick integration exactly: move by the velocity, then bleed
// it. Deliberately a copy of the loop rather than a call into the closed form, so a
// disagreement between the two shows up as a failure instead of being hidden.
function integrateDive(v0, ms) {
  let v = v0;
  let x = 0;
  for (let t = 0; t < ms; t += TICK_MS) {
    x += TICK_MS * speedFactor * v;
    v *= GRAB_LUNGE_FRICTION;
  }
  return { x, v };
}

describe("grab dive physics", () => {
  it("the impulse solve reproduces the authored travel distance", () => {
    // GRAB_LUNGE_DISTANCE authors the TOTAL travel and the impulse is solved
    // backwards from it, so this is really a test of that inversion: if TICK_RATE,
    // speedFactor or the friction move, the solve has to keep landing on the number
    // a designer typed. Long horizon because friction decay is asymptotic.
    const { x } = integrateDive(getGrabLungeImpulse(), 4000);
    assert.ok(
      Math.abs(x - GRAB_LUNGE_DISTANCE) < 1,
      `dive should converge on GRAB_LUNGE_DISTANCE ${GRAB_LUNGE_DISTANCE}, got ${x.toFixed(1)}`
    );
  });

  it("launches at roughly a power slide, not a teleport", () => {
    // The dive has to read as a committed shove. Anchored to the fastest thing a
    // player can do on their own (ICE_SLIDE_MAX_SPEED) so it stays inside the
    // vocabulary of speeds the game already uses.
    const v0 = getGrabLungeImpulse();
    assert.ok(v0 > 1, `dive impulse ${v0.toFixed(2)} should clearly beat a walk`);
    assert.ok(
      v0 <= ICE_SLIDE_MAX_SPEED * 1.1,
      `dive impulse ${v0.toFixed(2)} should not exceed a power slide ` +
        `(${ICE_SLIDE_MAX_SPEED}) by much, or it reads as a teleport`
    );
  });

  it("is still moving through the whole active window", () => {
    // The regression that matters most. If the dive is spent by the time startup
    // ends, the active window is a stationary vacuum again and the grab stops being
    // a body you can see coming.
    const atStartupEnd = getGrabLungeTravel(GRAB_STARTUP_DURATION_MS);
    const atActiveEnd = getGrabThreatTravel();
    const travelDuringActive = atActiveEnd - atStartupEnd;

    assert.ok(
      travelDuringActive > 15,
      `the grab must cover real ground during its active frames, got ` +
        `${travelDuringActive.toFixed(1)}px`
    );
    // And the velocity must still be live at the moment the window closes, not
    // merely have coasted a little before dying inside it.
    const { v } = integrateDive(
      getGrabLungeImpulse(),
      GRAB_STARTUP_DURATION_MS + GRAB_ACTIVE_MS
    );
    assert.ok(
      Math.abs(v) > 0.3,
      `dive should still carry real speed as the active window closes, got ${v.toFixed(3)}`
    );
  });

  it("keeps skidding for most of the whiff recovery", () => {
    // The "why does it stop on a dime" fix. A blown grab has to carry you past the
    // opponent and leave you there, which is what makes 450ms of recovery a real
    // punish rather than a pause.
    const atActiveEnd = getGrabThreatTravel();
    const atRecoveryEnd = getGrabLungeTravel(
      GRAB_STARTUP_DURATION_MS + GRAB_ACTIVE_MS + GRAB_WHIFF_RECOVERY_MS
    );
    const skid = atRecoveryEnd - atActiveEnd;
    assert.ok(
      skid > 25,
      `a whiffed grab must visibly skid, got ${skid.toFixed(1)}px of travel ` +
        `across ${GRAB_WHIFF_RECOVERY_MS}ms of recovery`
    );
  });

  it("beginGrabStartup stamps the impulse toward the opponent", () => {
    const s = sc();
    const [left, right] = [s.left, s.right];
    beginGrabStartup(left, s.room);

    assert.equal(left.isGrabStartup, true);
    assert.ok(
      Math.abs(Math.abs(left.grabMovementVelocity) - getGrabLungeImpulse()) < 1e-6,
      "the dive should launch at exactly the solved impulse"
    );
    // facing 1 = left, -1 = right; travel is -facing. The grabber starts left of the
    // opponent here, so the dive must carry them rightward (positive x).
    assert.ok(right.x > left.x, "harness sanity: grabber starts on the left");
    assert.ok(
      left.grabMovementVelocity > 0,
      "the dive must travel toward the opponent, not away from them"
    );
  });

  it("a whiff keeps the dive's momentum but kills the walk", () => {
    // Two separate channels, and conflating them is what produced the dead stop:
    // movementVelocity is walking (you don't get to keep strafing out of a blown
    // grab) while grabMovementVelocity is the dive's own momentum, which has to
    // survive so the miss carries you.
    const s = sc();
    const grabber = s.left;
    beginGrabStartup(grabber, s.room);
    grabber.movementVelocity = 0.9;
    const diveVel = grabber.grabMovementVelocity;

    executeGrabWhiff(grabber);

    assert.equal(grabber.movementVelocity, 0, "walking momentum must not survive");
    assert.equal(
      grabber.grabMovementVelocity,
      diveVel,
      "the dive's momentum must survive the whiff so the skid can happen"
    );
    assert.equal(grabber.isGrabWhiffRecovery, true);
  });

  it("whiff keeps facing locked until recovery frames end", () => {
    const s = sc();
    const grabber = s.left;
    const opponent = s.right;
    beginGrabStartup(grabber, s.room);
    const committed = grabber.facing;
    assert.ok(getActionFacingLock(grabber));
    assert.equal(getLockedFacing(grabber), committed);

    // Opponent flaps past during the lunge — attempt facing must not flip yet.
    opponent.x = grabber.x - 80;
    enforcePairFacing(grabber, opponent);
    assert.equal(grabber.facing, committed);

    executeGrabWhiff(grabber);
    assert.ok(getActionFacingLock(grabber), "lock must survive into recovery");
    enforcePairFacing(grabber, opponent);
    assert.equal(grabber.facing, committed, "must not turn during recovery");

    advanceSim(s, GRAB_WHIFF_RECOVERY_MS);
    assert.equal(getActionFacingLock(grabber), null);
    assert.equal(grabber.grabFacingInstanceId, null);
    enforcePairFacing(grabber, opponent);
    assert.equal(grabber.facing, grabber.x < opponent.x ? -1 : 1);
  });
});

"use strict";

/**
 * The grab attempt is a RUN.
 *
 * Stamp a speed, keep it while the grab is live, brake only in recovery.
 * Solving friction so 110px eased out over the hot window was wrong — that
 * stopped you before recovery. These tests pin the split: still running
 * when active ends, actually slowing down only after the miss.
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
  getGrabAttemptSpeed,
  getGrabLungeTravel,
  getGrabThreatTravel,
  isGrabInActiveWindow,
  isOpponentInFrontOfGrabber,
} = require("../../combatHelpers");
const {
  GRAB_LUNGE_SPEED,
  GRAB_LUNGE_SPEED_CAP,
  GRAB_LUNGE_FRICTION,
  GRAB_WHIFF_FRICTION,
  GRAB_STARTUP_DURATION_MS,
  GRAB_ACTIVE_MS,
  GRAB_WHIFF_RECOVERY_MS,
  ICE_MAX_SPEED,
  ICE_SLIDE_MAX_SPEED,
  POWER_UP_TYPES,
  TICK_RATE,
  speedFactor,
} = require("../../constants");

const TICK_MS = 1000 / TICK_RATE;
const HOT_MS = GRAB_STARTUP_DURATION_MS + GRAB_ACTIVE_MS;

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(options) {
  const s = createFoundationScenario(options);
  scenarios.push(s);
  return s;
}

function integrate(v0, ms, friction) {
  let v = v0;
  let x = 0;
  for (let t = 0; t < ms; t += TICK_MS) {
    x += TICK_MS * speedFactor * v;
    v *= friction;
  }
  return { x, v };
}

describe("grab run physics", () => {
  it("stamps the authored run speed", () => {
    assert.equal(getGrabLungeImpulse(), GRAB_LUNGE_SPEED);
    assert.equal(getGrabAttemptSpeed(0), GRAB_LUNGE_SPEED);
    assert.equal(getGrabAttemptSpeed(1.2), GRAB_LUNGE_SPEED);
    assert.equal(getGrabAttemptSpeed(2.0), 2.0);
    assert.equal(getGrabAttemptSpeed(9), GRAB_LUNGE_SPEED_CAP);
  });

  it("is a run, not a walk and not a teleport", () => {
    const v0 = getGrabLungeImpulse();
    assert.ok(
      v0 > ICE_MAX_SPEED,
      `run speed ${v0.toFixed(2)} should beat a walk (${ICE_MAX_SPEED})`
    );
    assert.ok(
      v0 <= ICE_SLIDE_MAX_SPEED,
      `run speed ${v0.toFixed(2)} should not exceed a power slide ` +
        `(${ICE_SLIDE_MAX_SPEED})`
    );
  });

  it("is still running when the grab goes cold", () => {
    const v0 = getGrabLungeImpulse();
    const { v } = integrate(v0, HOT_MS, GRAB_LUNGE_FRICTION);
    assert.ok(
      Math.abs(v) > v0 * 0.7,
      `must still be running at active end, got ${v.toFixed(3)} from ${v0.toFixed(2)}`
    );
    const atStartupEnd = getGrabLungeTravel(GRAB_STARTUP_DURATION_MS);
    const atActiveEnd = getGrabThreatTravel();
    assert.ok(
      atActiveEnd - atStartupEnd > atStartupEnd,
      `most of the run is during active (${(atActiveEnd - atStartupEnd).toFixed(1)}px), ` +
        `not a startup burst (${atStartupEnd.toFixed(1)}px)`
    );
  });

  it("only brakes in recovery", () => {
    const v0 = getGrabLungeImpulse();
    const atActiveEnd = integrate(v0, HOT_MS, GRAB_LUNGE_FRICTION);
    const afterRecovery = integrate(
      atActiveEnd.v,
      GRAB_WHIFF_RECOVERY_MS,
      GRAB_WHIFF_FRICTION
    );
    assert.ok(
      Math.abs(afterRecovery.v) < Math.abs(atActiveEnd.v) * 0.2,
      `recovery is the slowdown — end ${afterRecovery.v.toFixed(3)} ` +
        `from ${atActiveEnd.v.toFixed(3)} at the miss`
    );
    assert.ok(
      afterRecovery.x > 15,
      `a miss still skids, got ${afterRecovery.x.toFixed(1)}px`
    );
    assert.ok(
      GRAB_LUNGE_FRICTION > GRAB_WHIFF_FRICTION,
      "run friction must be lighter than recovery brake"
    );
  });

  it("stays hot for the full 650ms active", () => {
    const s = sc();
    const grabber = s.left;
    beginGrabStartup(grabber, s.room);
    const t0 = grabber.grabStartupStartTime;
    assert.equal(isGrabInActiveWindow(grabber, t0 + 84), false);
    assert.equal(isGrabInActiveWindow(grabber, t0 + 85), true);
    assert.equal(isGrabInActiveWindow(grabber, t0 + 85 + 400), true);
    assert.equal(isGrabInActiveWindow(grabber, t0 + 85 + GRAB_ACTIVE_MS - 1), true);
    assert.equal(isGrabInActiveWindow(grabber, t0 + 85 + GRAB_ACTIVE_MS), false);
  });

  it("closed-form travel matches the tick loop", () => {
    const { x } = integrate(getGrabLungeImpulse(), HOT_MS, GRAB_LUNGE_FRICTION);
    const closed = getGrabThreatTravel();
    assert.ok(
      Math.abs(x - closed) < 8,
      `closed form ${closed.toFixed(1)} should track the loop ${x.toFixed(1)}`
    );
  });

  it("beginGrabStartup stamps the run toward the opponent", () => {
    const s = sc();
    const [left, right] = [s.left, s.right];
    beginGrabStartup(left, s.room);

    assert.equal(left.isGrabStartup, true);
    assert.equal(left.grabAttemptSpeed, GRAB_LUNGE_SPEED);
    assert.equal(left.grabApproachSpeed, GRAB_LUNGE_SPEED);
    assert.ok(
      Math.abs(Math.abs(left.grabMovementVelocity) - GRAB_LUNGE_SPEED) < 1e-6,
      "the run should launch at the standing floor"
    );
    assert.ok(right.x > left.x, "harness sanity: grabber starts on the left");
    assert.ok(
      left.grabMovementVelocity > 0,
      "the run must travel toward the opponent, not away from them"
    );
    assert.equal(left.grabFacingDirection, left.facing);
    assert.equal(left.grabMovementDirection, -left.facing);
  });

  it("beginGrabStartup clears a leftover slap pose so latch is not a jab freeze", () => {
    const s = sc();
    s.left.isSlapAttack = true;
    s.left.isAttacking = true;
    s.left.attackType = "slap";
    beginGrabStartup(s.left, s.room);
    assert.equal(s.left.isSlapAttack, false);
    assert.equal(s.left.isAttacking, false);
    assert.equal(s.left.attackType, null);
    assert.equal(s.left.isGrabStartup, true);
  });

  it("slide-in raises the run; happy feet past the cap is dumped", () => {
    const slide = sc();
    slide.left.movementVelocity = ICE_SLIDE_MAX_SPEED;
    beginGrabStartup(slide.left, slide.room);
    assert.equal(slide.left.grabAttemptSpeed, ICE_SLIDE_MAX_SPEED);
    assert.equal(slide.left.grabApproachSpeed, ICE_SLIDE_MAX_SPEED);

    const stacked = sc();
    stacked.left.movementVelocity = ICE_SLIDE_MAX_SPEED;
    stacked.left.activePowerUp = POWER_UP_TYPES.SPEED;
    stacked.left.powerUpMultiplier = 2;
    beginGrabStartup(stacked.left, stacked.room);
    assert.equal(
      stacked.left.grabAttemptSpeed,
      GRAB_LUNGE_SPEED_CAP,
      "stacks get you there — they do not write the grab"
    );
    assert.equal(stacked.left.grabApproachSpeed, GRAB_LUNGE_SPEED_CAP);
  });

  it("a whiff keeps the run's momentum but kills the walk", () => {
    const s = sc();
    const grabber = s.left;
    beginGrabStartup(grabber, s.room);
    grabber.movementVelocity = 0.9;
    const runVel = grabber.grabMovementVelocity;

    executeGrabWhiff(grabber);

    assert.equal(grabber.movementVelocity, 0, "walking momentum must not survive");
    assert.equal(
      grabber.grabMovementVelocity,
      runVel,
      "the run must survive into recovery so the brake has something to kill"
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
    assert.equal(grabber.grabFacingDirection, null);
    enforcePairFacing(grabber, opponent);
    assert.equal(grabber.facing, grabber.x < opponent.x ? -1 : 1);
  });

  it("does not grab someone who sidestepped behind the committed line", () => {
    const s = sc();
    const grabber = s.left;
    const opponent = s.right;
    beginGrabStartup(grabber, s.room);
    const committed = grabber.grabFacingDirection;
    opponent.x = grabber.x - 80;
    grabber.facing = grabber.x < opponent.x ? -1 : 1;
    assert.equal(
      isOpponentInFrontOfGrabber(grabber, opponent),
      false,
      "live facing must not make a rear body legal"
    );
    assert.equal(getLockedFacing(grabber), committed);
    enforcePairFacing(grabber, opponent);
    assert.equal(grabber.facing, committed);
    assert.equal(grabber.grabMovementDirection, -committed);
  });
});

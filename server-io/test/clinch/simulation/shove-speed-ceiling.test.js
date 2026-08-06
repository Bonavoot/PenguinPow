"use strict";

/**
 * Every clinch shove has a hard velocity ceiling.
 *
 * The Phase A grab burst was unbounded: its opening speed multiplies raw approach
 * velocity, so a counter-grab off a slide landed as a standing-start jump of
 * 16-21px per frame — a teleport rather than a shove, fast enough to outrun the
 * client's frame pacing. The ceiling sits ABOVE every tuned clinch path, so it
 * bounds that burst without altering ordinary clinch or Open-punish feel.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_MAX_SHOVE_SPEED,
  CLINCH_PUSH_BASE_SPEED,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_PUSH_VS_PUSH_MAX_SPEED,
  CLINCH_OPEN_PUNISH_RAMP_FLOOR,
  CLINCH_PUSH_STAMINA_FLOOR,
  DEEP_GRIP_PUSH_MULT,
  GRAB_PUSH_BURST_BASE,
  GRAB_PUSH_MOMENTUM_TRANSFER,
  ARM_CLAMP_BURST_MULT,
  speedFactor,
} = require("../../../constants");
const {
  createClinchScenario,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

const MID = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
const PX_PER_S = 1000 * speedFactor;
const CEILING_PXS = CLINCH_MAX_SHOVE_SPEED * PX_PER_S;

/** The fastest an ordinary one-sided push can ever be: stamina + Deep Grip + matured ramp. */
const ORDINARY_MAX =
  CLINCH_PUSH_BASE_SPEED * DEEP_GRIP_PUSH_MULT * CLINCH_PUSH_RAMP_MAX_MULT;

/**
 * Peak per-tick victim speed in px/s. Re-centres every tick so a boundary clamp
 * can never mask the real velocity.
 */
function peakSpeed(s, pusher, victim, ms, perTick) {
  let best = 0;
  const start = s.now();
  while (s.now() - start < ms && !s.room.gameOver) {
    const gap = Math.abs(pusher.x - victim.x);
    const left = pusher.x < victim.x ? pusher : victim;
    const right = left === pusher ? victim : pusher;
    left.x = MID - gap / 2;
    right.x = MID + gap / 2;
    if (perTick) perTick();
    const before = victim.x;
    s.advance(s.tickMs);
    const v = Math.abs(victim.x - before) / (s.tickMs / 1000);
    if (v > best) best = v;
  }
  return best;
}

/** Start a Phase A burst with the given approach momentum / counter-grab state. */
function startBurst(s, pusher, victim, { approach, clamped }) {
  pusher.isGrabPushing = true;
  victim.isBeingGrabPushed = true;
  pusher.grabPushStartTime = s.now();
  pusher.grabApproachSpeed = approach;
  victim.isArmClamped = !!clamped;
}

describe("Shove speed ceiling", () => {
  it("sits above every tuned clinch path, so none of them change", () => {
    // This is the load-bearing property: the cap must not be reachable by
    // ordinary push, Open punish, or a push war, or it would retune the clinch.
    assert.ok(
      ORDINARY_MAX < CLINCH_MAX_SHOVE_SPEED,
      `matured one-sided push ${ORDINARY_MAX.toFixed(3)} must stay under the ceiling ${CLINCH_MAX_SHOVE_SPEED}`
    );
    assert.ok(
      CLINCH_PUSH_VS_PUSH_MAX_SPEED < CLINCH_MAX_SHOVE_SPEED,
      "push-vs-push max is under the ceiling"
    );
    // The Open punish shares the ordinary ramp ceiling; it only arrives sooner.
    assert.ok(
      CLINCH_OPEN_PUNISH_RAMP_FLOOR <= CLINCH_PUSH_RAMP_MAX_MULT,
      "Open punish cannot exceed the ramp it pre-matures"
    );
  });

  it("an unclamped grab burst could exceed it, which is why the cap exists", () => {
    // Guards the premise rather than the fix: if the burst formula is ever
    // bounded at the source, this test should be revisited instead of silently
    // protecting nothing.
    const uncapped =
      (GRAB_PUSH_BURST_BASE + 2.1 * GRAB_PUSH_MOMENTUM_TRANSFER) *
      ARM_CLAMP_BURST_MULT;
    assert.ok(
      uncapped > CLINCH_MAX_SHOVE_SPEED,
      `a counter-grab off a slide computes ${uncapped.toFixed(2)} (${(uncapped * PX_PER_S).toFixed(0)} px/s), above the ceiling`
    );
  });

  for (const approach of [2.1, 2.4, 3.5, 12]) {
    it(`caps a counter-grab burst with approach ${approach}`, () => {
      const s = sc({ midX: MID });
      const pusher = s.grabber;
      const victim = s.grabbed;
      s.holdNeutral(pusher);
      s.holdNeutral(victim);
      s.advance(200);
      startBurst(s, pusher, victim, { approach, clamped: true });
      const peak = peakSpeed(s, pusher, victim, 400, () =>
        s.holdToward(pusher, victim)
      );
      assert.ok(
        peak <= CEILING_PXS + 2,
        `peak ${peak.toFixed(0)} px/s must not exceed the ceiling ${CEILING_PXS.toFixed(0)} px/s`
      );
    });
  }

  it("absurd approach momentum stays bounded rather than scaling", () => {
    // grabApproachSpeed is raw approach velocity with no clamp of its own, so the
    // ceiling is the only thing standing between a movement bug and a teleport.
    const peaks = [50, 5000].map((approach) => {
      const s = sc({ midX: MID });
      s.holdNeutral(s.grabber);
      s.holdNeutral(s.grabbed);
      s.advance(200);
      startBurst(s, s.grabber, s.grabbed, { approach, clamped: true });
      return peakSpeed(s, s.grabber, s.grabbed, 200, () =>
        s.holdToward(s.grabber, s.grabbed)
      );
    });
    for (const peak of peaks) {
      assert.ok(
        peak <= CEILING_PXS + 2,
        `peak ${peak.toFixed(0)} px/s must be bounded by ${CEILING_PXS.toFixed(0)} px/s`
      );
    }
    assert.ok(
      Math.abs(peaks[0] - peaks[1]) < 2,
      "past the ceiling, more momentum buys nothing"
    );
  });

  it("clamps both push directions identically", () => {
    // The two directions are separate branches; a one-sided clamp would make the
    // counter-grab punish stronger on one side of the ring.
    const run = (swapRoles) => {
      const s = sc({ midX: MID, swapRoles });
      const pusher = s.grabber;
      const victim = s.grabbed;
      s.holdNeutral(pusher);
      s.holdNeutral(victim);
      s.advance(200);
      startBurst(s, pusher, victim, { approach: 3.5, clamped: true });
      return peakSpeed(s, pusher, victim, 300, () =>
        s.holdToward(pusher, victim)
      );
    };
    const right = run(false);
    const left = run(true);
    assert.ok(
      Math.abs(right - left) < 2,
      `pushing right (${right.toFixed(0)}) and left (${left.toFixed(0)}) must clamp the same`
    );
  });

  it("leaves an ordinary matured push untouched", () => {
    const s = sc({ midX: MID });
    const pusher = s.grabber;
    const victim = s.grabbed;
    s.setStamina(pusher, 100);
    s.setDeepGrip(pusher);
    const peak = peakSpeed(s, pusher, victim, 2000, () => {
      s.setCommittedDrive(pusher);
      s.holdNeutral(victim);
    });
    assert.ok(
      peak < CEILING_PXS,
      `a matured push (${peak.toFixed(0)} px/s) must never reach the ceiling (${CEILING_PXS.toFixed(0)} px/s)`
    );
    // And it should still actually reach its own designed maximum.
    assert.ok(
      peak > ORDINARY_MAX * PX_PER_S * 0.9,
      `a matured push should approach its own max ${(ORDINARY_MAX * PX_PER_S).toFixed(0)} px/s, got ${peak.toFixed(0)}`
    );
  });

  it("caps velocity, not displacement, so it is tick-rate independent", () => {
    const travel = (tickMs) => {
      const s = sc({ midX: MID, tickMs });
      const pusher = s.grabber;
      const victim = s.grabbed;
      s.holdNeutral(pusher);
      s.holdNeutral(victim);
      s.advance(200);
      startBurst(s, pusher, victim, { approach: 6, clamped: true });
      // Held keys persist, so advance() can do the sub-stepping at the scenario's
      // own tick rate. Clamping a final partial step here would stall the loop:
      // advance() ignores anything under 0.0001ms.
      s.holdToward(pusher, victim);
      const startX = victim.x;
      s.advance(300);
      return Math.abs(victim.x - startX);
    };
    const fine = travel(1000 / 128);
    const coarse = travel(1000 / 30);
    assert.ok(
      Math.abs(fine - coarse) < 8,
      `capped travel must match across tick rates (${fine.toFixed(1)}px vs ${coarse.toFixed(1)}px)`
    );
  });
});

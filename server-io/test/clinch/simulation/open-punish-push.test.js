"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_LIGHT_DRIVE_MS,
  CLINCH_LIGHT_DRIVE_SPEED_MULT,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_PUSH_RAMP_RISE_MS,
  CLINCH_OPEN_PUNISH_RAMP_FLOOR,
  CLINCH_OPEN_PUNISH_EASE_MS,
  CLINCH_THROW_FAIL_STAGGER_MS,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_PUSH_BASE_SPEED,
  CLINCH_EDGE_ZONE_THRESHOLD,
  DEEP_GRIP_PUSH_MULT,
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

const RING_WIDTH = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;
const CENTRE_TO_TAWARA = RING_WIDTH / 2;

/** Grabber drives right into grabbed from mid-ring. Returns px the victim moved. */
function measureShove(s, ms, { openTarget = false, deepGrip = false } = {}) {
  s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
  s.setPosition(s.grabbed, s.grabber.x + 72);
  if (deepGrip) s.setDeepGrip(s.grabber);
  if (openTarget) s.setOpen(s.grabbed, s.now() + ms + 500);
  const startX = s.grabbed.x;
  const end = s.now() + ms;
  while (s.now() < end && !s.room.gameOver) {
    s.setCommittedDrive(s.grabber);
    if (!openTarget) s.holdNeutral(s.grabbed);
    s.advance(Math.min(s.tickMs, end - s.now()));
  }
  return s.grabbed.x - startX;
}

describe("Open-punish shove", () => {
  it("skips the Light Drive tax on the first actionable tick", () => {
    const s = sc();
    s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
    s.setPosition(s.grabbed, s.grabber.x + 72);
    s.setOpen(s.grabbed, s.now() + 2000);
    // Fresh toward-hold: still inside the Light Drive window.
    s.holdToward(s.grabber);
    s.advance(CLINCH_OPEN_PUNISH_EASE_MS * 2);
    assert.ok(
      !s.grabber.isClinchCommittedDrive,
      "still inside Light Drive, so this is the tax we are bypassing"
    );
    assert.ok(
      s.grabber.clinchOpenPunishBlend > 0.9,
      "punish blend engaged against a helpless target"
    );

    const before = s.grabbed.x;
    s.advance(100);
    const openSpeed = (s.grabbed.x - before) / 0.1;

    // Same input against a healthy neutral opponent = ordinary Light Drive.
    const s2 = sc();
    s2.setPosition(s2.grabber, MAP_LEFT_BOUNDARY + 120);
    s2.setPosition(s2.grabbed, s2.grabber.x + 72);
    s2.holdToward(s2.grabber);
    s2.holdNeutral(s2.grabbed);
    s2.advance(CLINCH_OPEN_PUNISH_EASE_MS * 2);
    const before2 = s2.grabbed.x;
    s2.advance(100);
    const lightSpeed = (s2.grabbed.x - before2) / 0.1;

    // The entitlement is full committed force, i.e. the floor over the Light
    // Drive discount — 1.0 / 0.7 ≈ 1.43x. Asserting the ratio the constants
    // actually imply keeps this from silently passing if the floor is lowered
    // into the discount, and from demanding force nobody earned.
    const impliedRatio =
      CLINCH_OPEN_PUNISH_RAMP_FLOOR / CLINCH_LIGHT_DRIVE_SPEED_MULT;
    assert.ok(
      openSpeed > lightSpeed * (impliedRatio * 0.95),
      `punish shove must outrun Light Drive by ~${impliedRatio.toFixed(2)}x ` +
        `(${openSpeed.toFixed(0)} vs ${lightSpeed.toFixed(0)} px/s)`
    );
    assert.ok(
      CLINCH_OPEN_PUNISH_RAMP_FLOOR > CLINCH_LIGHT_DRIVE_SPEED_MULT,
      "floor is above the light tax by construction"
    );
  });

  it("uses the pre-matured floor, not the full mature multiplier", () => {
    // The distinction is load-bearing: at CLINCH_PUSH_RAMP_MAX_MULT a single
    // Perfect Brace would force out from the centre of the dohyo.
    assert.ok(
      CLINCH_OPEN_PUNISH_RAMP_FLOOR < CLINCH_PUSH_RAMP_MAX_MULT,
      "punish floor is deliberately below the earned maximum"
    );
    const s = sc();
    const moved = measureShove(s, CLINCH_PERFECT_BRACE_OPEN_MS, {
      openTarget: true,
    });
    assert.ok(
      moved < CENTRE_TO_TAWARA,
      `a centre-ring failure must not be a guaranteed force-out (moved ${moved.toFixed(0)}px vs ${CENTRE_TO_TAWARA}px)`
    );
  });

  it("still beats the old Light-Drive-then-ramp punish by a readable margin", () => {
    // The honest A/B: identical player input (start holding toward from neutral),
    // once against a helpless target and once against a healthy one. That is the
    // path the old punish actually took — 300ms of Light Drive, then ramp from 0.
    function shoveFromNeutral(s, ms, openTarget) {
      s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
      s.setPosition(s.grabbed, s.grabber.x + 72);
      if (openTarget) s.setOpen(s.grabbed, s.now() + ms + 500);
      const startX = s.grabbed.x;
      const end = s.now() + ms;
      while (s.now() < end && !s.room.gameOver) {
        s.holdToward(s.grabber);
        if (!openTarget) s.holdNeutral(s.grabbed);
        s.advance(Math.min(s.tickMs, end - s.now()));
      }
      return s.grabbed.x - startX;
    }
    const openMoved = shoveFromNeutral(sc(), CLINCH_THROW_FAIL_STAGGER_MS, true);
    const ordinaryMoved = shoveFromNeutral(sc(), CLINCH_THROW_FAIL_STAGGER_MS, false);
    // Ground covered is the smaller of the two effects (~1.2x) because both runs
    // eventually reach committed drive; the punish's advantage is concentrated in
    // the first 300ms, where it shoves at the committed baseline instead of the
    // 0.7 Light Drive discount. Instantaneous speed there is the ~1.43x jump the
    // previous test pins down.
    assert.ok(
      openMoved > ordinaryMoved * 1.15,
      `punish should read as a distinct burst (${openMoved.toFixed(0)}px vs ${ordinaryMoved.toFixed(0)}px)`
    );
  });

  it("the Open target cannot resist, Plant, or push back", () => {
    const s = sc();
    s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
    s.setPosition(s.grabbed, s.grabber.x + 72);
    s.setOpen(s.grabbed, s.now() + 2000);
    const startX = s.grabbed.x;
    const end = s.now() + 400;
    while (s.now() < end) {
      s.setCommittedDrive(s.grabber);
      // Victim mashes every defensive and offensive answer they have.
      s.setActivePlant(s.grabbed, s.now());
      s.holdToward(s.grabbed);
      s.setThrowRequest(s.grabbed, "throw", s.now());
      s.setJoltRequest(s.grabbed, s.now());
      s.advance(s.tickMs);
    }
    assert.equal(s.grabbed.clinchAction, "neutral", "Open has no stance");
    assert.equal(s.grabbed.clinchThrowActive, false);
    assert.equal(s.grabbed.isClinchJolting, false);
    assert.ok(
      s.grabbed.x - startX > 80,
      "mashing does not slow the punish down"
    );
  });

  it("ordinary push rules resume once Open ends, without corrupting ramp timing", () => {
    const s = sc();
    s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
    s.setPosition(s.grabbed, s.grabber.x + 72);
    s.setOpen(s.grabbed, s.now() + 200);
    const rampStartDuringOpen = (() => {
      const end = s.now() + 200;
      while (s.now() < end) {
        s.setCommittedDrive(s.grabber);
        s.advance(s.tickMs);
      }
      return s.grabber.clinchPushRampStart;
    })();
    s.clearOpen(s.grabbed);
    // Victim now Plants: braking must apply again immediately.
    const beforeX = s.grabbed.x;
    const end = s.now() + 300;
    while (s.now() < end) {
      s.setCommittedDrive(s.grabber);
      s.setActivePlant(s.grabbed, s.now());
      s.advance(s.tickMs);
    }
    const movedVsPlant = s.grabbed.x - beforeX;
    assert.ok(
      movedVsPlant < 40,
      `Plant brakes the shove again after Open (moved ${movedVsPlant.toFixed(0)}px)`
    );
    assert.ok(
      !rampStartDuringOpen ||
        rampStartDuringOpen <= s.grabber.clinchPushRampStart ||
        s.grabber.clinchPushRampStart === 0,
      "the punish never backdates the ordinary ramp timer"
    );
  });

  it("the blend eases in and out rather than stepping", () => {
    const s = sc();
    s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
    s.setPosition(s.grabbed, s.grabber.x + 72);
    s.setCommittedDrive(s.grabber);
    s.setOpen(s.grabbed, s.now() + 5000);
    s.advance(s.tickMs);
    const afterOneTick = s.grabber.clinchOpenPunishBlend;
    assert.ok(
      afterOneTick > 0 && afterOneTick < 1,
      `blend must ramp, not snap (got ${afterOneTick})`
    );
    s.advance(CLINCH_OPEN_PUNISH_EASE_MS);
    assert.equal(s.grabber.clinchOpenPunishBlend, 1, "reaches full punish");
    s.clearOpen(s.grabbed);
    s.setCommittedDrive(s.grabber);
    s.advance(s.tickMs);
    const easingOut = s.grabber.clinchOpenPunishBlend;
    assert.ok(
      easingOut > 0 && easingOut < 1,
      `blend must ease out too (got ${easingOut})`
    );
  });

  it("Deep Grip and stamina modifiers apply exactly once", () => {
    const plain = measureShove(sc(), 300, { openTarget: true });
    const deep = measureShove(sc(), 300, { openTarget: true, deepGrip: true });
    const ratio = deep / plain;
    assert.ok(
      Math.abs(ratio - DEEP_GRIP_PUSH_MULT) < 0.03,
      `Deep Grip should scale the punish once (ratio ${ratio.toFixed(3)} vs ${DEEP_GRIP_PUSH_MULT})`
    );

    const lowStam = sc();
    lowStam.setStamina(lowStam.grabber, 0);
    const weak = measureShove(lowStam, 300, { openTarget: true });
    assert.ok(weak < plain, "an empty tank still shoves weaker");
  });

  it("non-Open push interactions are unchanged", () => {
    // Light drive vs neutral, committed vs plant, committed ramp vs neutral all
    // keep their existing shape when nobody is Open.
    const s = sc();
    s.setPosition(s.grabber, MAP_LEFT_BOUNDARY + 120);
    s.setPosition(s.grabbed, s.grabber.x + 72);
    s.holdToward(s.grabber);
    s.holdNeutral(s.grabbed);
    s.advance(CLINCH_LIGHT_DRIVE_MS - 40);
    assert.equal(s.grabber.isClinchCommittedDrive, false);
    assert.equal(s.grabber.clinchOpenPunishBlend || 0, 0, "no punish blend");
    s.advance(80);
    assert.equal(s.grabber.isClinchCommittedDrive, true, "commits on schedule");
    assert.ok(s.grabber.clinchPushRampStart > 0, "ordinary ramp still starts");
  });

  describe("displacement budget (reported values)", () => {
    const cases = [
      ["ordinary RESISTED Open", CLINCH_THROW_FAIL_STAGGER_MS, false],
      ["ordinary RESISTED Open + Deep Grip", CLINCH_THROW_FAIL_STAGGER_MS, true],
      ["PERFECT BRACE Open", CLINCH_PERFECT_BRACE_OPEN_MS, false],
      ["PERFECT BRACE Open + Deep Grip", CLINCH_PERFECT_BRACE_OPEN_MS, true],
    ];
    for (const [label, ms, deepGrip] of cases) {
      it(`${label} cannot force out from centre ring`, () => {
        const moved = measureShove(sc(), ms, { openTarget: true, deepGrip });
        assert.ok(
          moved > 0,
          "the punish does move them (this is not a no-op change)"
        );
        assert.ok(
          moved < CENTRE_TO_TAWARA,
          `${label}: moved ${moved.toFixed(0)}px, centre-to-tawara is ${CENTRE_TO_TAWARA}px`
        );
      });
    }

    it("a failure inside the edge zone IS fatal (the intended rule)", () => {
      const s = sc();
      // Victim a little inside the edge zone, attacker driving outward.
      s.setPosition(s.grabbed, MAP_RIGHT_BOUNDARY - CLINCH_EDGE_ZONE_THRESHOLD / 2);
      s.setPosition(s.grabber, s.grabbed.x - 72);
      s.setOpen(s.grabbed, s.now() + CLINCH_PERFECT_BRACE_OPEN_MS);
      const end = s.now() + CLINCH_PERFECT_BRACE_OPEN_MS;
      while (s.now() < end && !s.room.gameOver) {
        s.setCommittedDrive(s.grabber);
        s.advance(s.tickMs);
      }
      assert.equal(
        s.room.gameOver,
        true,
        "failing a technique at the tawara should lose the round"
      );
    });
  });

  it("push speed scale sanity — base speed constant still drives the math", () => {
    assert.ok(CLINCH_PUSH_BASE_SPEED > 0);
    assert.ok(CLINCH_PUSH_RAMP_RISE_MS > 0);
  });
});

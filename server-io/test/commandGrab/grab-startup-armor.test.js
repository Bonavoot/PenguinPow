"use strict";

/**
 * Grab vs slap. Overlap always resolves.
 *
 * Reaching / tip poke = real hit. Late slap after the grip is on = CATCH.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  createContactScenario,
  armSlap,
  armCharged,
  armPalm,
  armGrabStartup,
  placeInConnectRange,
  placeInGrabLatchRange,
  runBothCollisionOrders,
  getConnectDistance,
} = require("../contact/helpers/contactSim");
const {
  shouldStrikeStuffGrab,
  resolveStrikeVsGrab,
  GRAB_STRIKE,
  getStrikeActiveStartTime,
  getGrabActiveStartTime,
  isGrabAttemptLive,
} = require("../../grabStartupArmor");
const {
  getGrabConnectDistance,
  isOpponentCloseEnoughForGrab,
} = require("../../combatHelpers");
const {
  GRAB_STARTUP_DURATION_MS,
  GRAB_ACTIVE_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  PALM_THRUST_STARTUP_MS,
  POWER_UP_TYPES,
} = require("../../constants");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function armGrabHot(player, { now, afterActiveMs = 40 } = {}) {
  return armGrabStartup(player, {
    now,
    elapsed: GRAB_STARTUP_DURATION_MS + afterActiveMs,
  });
}

function latchPair() {
  return {
    grabber: {
      isGrabStartup: true,
      grabStartupStartTime: 0,
      grabStartupDuration: 85,
      grabActiveDuration: 650,
      x: 0,
      facing: -1,
      grabFacingDirection: -1,
      sizeMultiplier: 1,
    },
    slapper: {
      attackType: "slap",
      isSlapAttack: true,
      x: 80,
      facing: 1,
      sizeMultiplier: 1,
    },
  };
}

describe("throw vs strike clocks", () => {
  it("reaching: slap active 55 beats grab grip 85", () => {
    const grabber = {
      isGrabStartup: true,
      grabStartupStartTime: 0,
      grabStartupDuration: GRAB_STARTUP_DURATION_MS,
    };
    const slapper = {
      attackType: "slap",
      isSlapAttack: true,
      attackStartTime: 0,
      startupEndTime: SLAP_STARTUP_MS,
    };
    assert.equal(getStrikeActiveStartTime(slapper), 55);
    assert.equal(getGrabActiveStartTime(grabber), 85);
    assert.equal(shouldStrikeStuffGrab(slapper, grabber, 60), true);
  });

  it("late mash at latch range is a CATCH, not a ghost skip at any range", () => {
    const { grabber, slapper } = latchPair();
    slapper.attackStartTime = 50;
    slapper.startupEndTime = 105;
    assert.equal(resolveStrikeVsGrab(slapper, grabber, 200), GRAB_STRIKE.CATCH);
    assert.equal(shouldStrikeStuffGrab(slapper, grabber, 200), false);
  });

  it("late mash at slap-tip (outside latch) STUFFS — no ghost poke", () => {
    const { grabber, slapper } = latchPair();
    slapper.x = 200;
    slapper.attackStartTime = 50;
    slapper.startupEndTime = 105;
    assert.equal(resolveStrikeVsGrab(slapper, grabber, 200), GRAB_STRIKE.STUFF);
    assert.equal(shouldStrikeStuffGrab(slapper, grabber, 200), true);
  });

  it("slap already live when the grip turns on stuffs even at latch", () => {
    const { grabber, slapper } = latchPair();
    grabber.grabStartupStartTime = 100;
    slapper.attackStartTime = 0;
    slapper.startupEndTime = 55;
    assert.equal(shouldStrikeStuffGrab(slapper, grabber, 200), true);
  });

  it("Shatter Palm always stuffs, even if the palm is late at latch range", () => {
    const { grabber, slapper } = latchPair();
    const palmer = {
      ...slapper,
      isPalmThrust: true,
      attackType: "charged",
      attackStartTime: 80,
      startupEndTime: 170,
      activePowerUp: POWER_UP_TYPES.SHATTER_PALM,
    };
    assert.equal(shouldStrikeStuffGrab(palmer, grabber, 200), true);
  });

  it("idle grabber is not a live attempt", () => {
    assert.equal(isGrabAttemptLive({}), false);
    assert.equal(isGrabAttemptLive({ isGrabStartup: true }), true);
  });
});

describe("grab vs slap contact", () => {
  it("latch sits inside slap tip — grab must not vacuum-latch past the poke", () => {
    const s = sc({ gap: 140 });
    const slapTip = getConnectDistance("slap", s.right, s.left);
    const latch = getGrabConnectDistance(s.left, s.right);
    assert.ok(
      latch < slapTip - 8,
      `live-size latch ${latch.toFixed(1)} must be inside slap tip ${slapTip.toFixed(1)}`
    );

    const oldVacuum = 175 * (s.left.sizeMultiplier || 1);
    const probe = slapTip + 8;
    assert.ok(probe < oldVacuum, "probe is inside the old 175-range circle");
    s.left.x = 500;
    s.right.x = 500 + probe;
    s.left.facing = -1;
    s.right.facing = 1;
    assert.equal(
      isOpponentCloseEnoughForGrab(s.left, s.right),
      false,
      `active grab must not vacuum-latch at ${probe.toFixed(1)}px`
    );
  });

  it("slap during grab startup stuffs (real hit, no clang)", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armSlap(s.right, { now });
    armGrabStartup(s.left, { now });
    placeInConnectRange(s.right, s.left, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true, "reaching is hittable");
    assert.equal(s.left.isGrabStartup, false, "grab is stuffed");
  });

  it("slap-tip poke on a hot run STUFFS — active frames on the grabber connect", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armGrabHot(s.left, { now, afterActiveMs: 80 });
    armSlap(s.right, { now });
    placeInConnectRange(s.right, s.left, "slap");
    assert.equal(
      isOpponentCloseEnoughForGrab(s.left, s.right),
      false,
      "this park is the slap-tip gap outside latch — the ghost zone"
    );
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true, "overlapping slap at tip is a real hit");
    assert.equal(s.left.isGrabStartup, false, "the run is stuffed");
  });

  it("slap already live when the grip turns on stuffs even at latch", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armGrabHot(s.left, { now, afterActiveMs: 20 });
    armSlap(s.right, { now, startOffset: SLAP_STARTUP_MS + SLAP_ACTIVE_MS - 8 });
    placeInGrabLatchRange(s.left, s.right);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true, "pre-committed slap stuffs at throw range");
    assert.equal(s.left.isGrabStartup, false);
  });

  it("late slap at latch range is a CATCH — no ghost, grab stays live for latch", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armGrabHot(s.left, { now, afterActiveMs: 80 });
    armSlap(s.right, { now });
    placeInGrabLatchRange(s.left, s.right);
    assert.equal(isOpponentCloseEnoughForGrab(s.left, s.right), true);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, false, "catch is not a slap hit");
    assert.equal(s.left.isGrabStartup, true, "grab stays live so the latch can fire");
    assert.equal(s.right.isSlapAttack, false, "CATCH kills the jab pose immediately");
    assert.equal(s.right.isAttacking, false, "CATCH kills the jab hitbox immediately");
  });

  it("charged during grab startup stuffs in one hit", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armCharged(s.right, { now });
    armGrabStartup(s.left, { now });
    const tip = getConnectDistance("charged", s.right, s.left);
    const latch = getGrabConnectDistance(s.left, s.right);
    s.left.facing = -1;
    s.right.facing = 1;
    s.right.x = s.left.x + Math.min(tip - 2, latch + 8);
    assert.equal(
      isOpponentCloseEnoughForGrab(s.left, s.right),
      false,
      "charged park must sit in the tip gap, not latch"
    );
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true);
    assert.equal(s.left.isGrabStartup, false);
  });

  it("default palm during grab startup stuffs like a slap", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armPalm(s.right, { now });
    armGrabStartup(s.left, { now });
    placeInConnectRange(s.right, s.left, "palm");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true, "palm on a reaching grab is a real hit");
    assert.equal(s.left.isGrabStartup, false);
  });

  it("late palm at slap/palm tip STUFFS the hot run", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armGrabHot(s.left, { now, afterActiveMs: 80 });
    armPalm(s.right, { now, startOffset: PALM_THRUST_STARTUP_MS + 10 });
    placeInConnectRange(s.right, s.left, "palm");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true);
    assert.equal(s.left.isGrabStartup, false);
  });

  it("shatter palm power-up stuffs even when late at latch range", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armGrabHot(s.left, { now, afterActiveMs: 80 });
    armPalm(s.right, { now, startOffset: PALM_THRUST_STARTUP_MS + 10 });
    s.right.activePowerUp = POWER_UP_TYPES.SHATTER_PALM;
    placeInGrabLatchRange(s.left, s.right);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true);
    assert.equal(s.left.isGrabStartup, false);
  });

  it("basho shattering_palm loadout stuffs even when late at latch range", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armGrabHot(s.left, { now, afterActiveMs: 80 });
    armPalm(s.right, { now, startOffset: PALM_THRUST_STARTUP_MS + 10 });
    s.right.loadout = { palmBreaksGrabArmor: true };
    placeInGrabLatchRange(s.left, s.right);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true);
    assert.equal(s.left.isGrabStartup, false);
  });

  it("out of range slap does not stuff the grab", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armSlap(s.right, { now });
    armGrabStartup(s.left, { now });
    s.right.x = s.left.x + 400;
    s.left.facing = -1;
    s.right.facing = 1;
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isGrabStartup, true);
    assert.equal(s.left.isHit, false);
  });

  it("hot window is still the authored 650ms active", () => {
    assert.equal(GRAB_ACTIVE_MS, 650);
  });
});

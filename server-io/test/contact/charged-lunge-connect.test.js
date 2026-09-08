"use strict";

/**
 * Flying-headbutt connect feel:
 *  - release is live immediately (no rooted coil)
 *  - lunge never writes the attacker backward
 *  - forehead-meets-body this step → same-tick hit
 *  - on hit, attacker recoils backward on ice instead of planting
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  planChargedLungeTravel,
  proposedChargedLungeDelta,
  chargedLungeBaseSpeed,
  chargedLungeTravelSpeed,
  chargedHitRecoilVelocity,
  getChargedActiveMs,
  isChargedCoil,
  isChargedLungeTraveling,
} = require("../../chargedHeadbuttContact");
const {
  getConnectDistance,
  applyContactCorrection,
  MAX_HIT_PARK_PULL_PX,
} = require("../../strikeContact");
const {
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MIN_MS,
  CHARGED_LUNGE_BASE_SPEED,
  CHARGED_HIT_RECOIL_MIN,
  CHARGED_HIT_RECOIL_MAX,
  speedFactor,
  TICK_RATE,
} = require("../../constants");
const { executeChargedAttack, adjustPlayerPositions } = require("../../gameFunctions");
const { checkCollision } = require("../../collisionSystem");
const {
  createContactScenario,
  armCharged,
} = require("./helpers/contactSim");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

describe("charged lunge travel math", () => {
  it("compensated active speed preserves old startup+active distance", () => {
    const power = 50;
    const activeMs = 325;
    const base = chargedLungeBaseSpeed(power);
    const travel = chargedLungeTravelSpeed(power, activeMs);
    const oldDist = base * (CHARGED_STARTUP_MS + activeMs);
    const newDist = travel * activeMs;
    assert.ok(Math.abs(oldDist - newDist) < 1e-6);
    assert.ok(travel > base);
  });

  it("proposed delta is 0 only if a leftover coil flag is set", () => {
    const charged = {
      isAttacking: true,
      attackType: "charged",
      isPalmThrust: false,
      isInStartupFrames: true,
      chargedAttackHit: false,
      facing: 1,
      chargeAttackPower: 80,
      x: 500,
    };
    assert.equal(isChargedCoil(charged), true);
    assert.equal(isChargedLungeTraveling(charged), false);
    assert.equal(proposedChargedLungeDelta(charged, 1000 / TICK_RATE, speedFactor), 0);
  });

  it("base speed at 0% / 100% stays 1.5 / 7.0", () => {
    assert.equal(chargedLungeBaseSpeed(0), CHARGED_LUNGE_BASE_SPEED);
    assert.equal(chargedLungeBaseSpeed(100), CHARGED_LUNGE_BASE_SPEED + 5.5);
  });
});

describe("planChargedLungeTravel — never backward, hit on first contact", () => {
  it("does not pull the charger backward when already inside connect", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armCharged(s.left, { power: 60, now });
    const reach = getConnectDistance("charged", s.left, s.right);
    s.left.x = s.right.x - (reach - 12);
    const startX = s.left.x;
    const proposedX = startX - 20;
    const plan = planChargedLungeTravel(s.left, s.right, proposedX);
    assert.equal(plan.alreadyInside, true);
    assert.equal(plan.wouldConnect, true);
    assert.equal(plan.x, startX);
    assert.ok(plan.x <= startX + 1e-9, "never moved backward");
  });

  it("stops at forehead contact instead of tunneling past", () => {
    const s = sc({ gap: 220 });
    const now = s.room.simTime;
    armCharged(s.left, { power: 80, now });
    const reach = getConnectDistance("charged", s.left, s.right);
    s.left.x = s.right.x - (reach + 40);
    const startX = s.left.x;
    const proposedX = s.right.x - 10;
    const plan = planChargedLungeTravel(s.left, s.right, proposedX);
    assert.equal(plan.wouldConnect, true);
    assert.ok(plan.t > 0 && plan.t <= 1);
    assert.ok(plan.x > startX, "still moved forward");
    assert.ok(plan.x < proposedX, "did not take the full bury step");
    const distAtContact = Math.abs(s.right.x - plan.x);
    assert.ok(
      distAtContact <= reach + 1.6,
      `contact spacing ${distAtContact} should be ≤ reach ${reach}`
    );
  });

  it("does not connect from behind", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armCharged(s.left, { power: 60, now });
    s.right.x = s.left.x - 90;
    const startX = s.left.x;
    const plan = planChargedLungeTravel(s.left, s.right, startX + 20);
    assert.equal(plan.wouldConnect, false);
    assert.equal(plan.x, startX + 20);
  });

  it("ignores a leftover _combatPrevX from an old lunge (no mid-map vacuum)", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armCharged(s.left, { power: 80, now });
    const reach = getConnectDistance("charged", s.left, s.right);
    // Charger stands near mid-map. Victim is actually far to the right.
    s.left.x = 640;
    s.right.x = 640 + reach + 220;
    // Stale prev from a previous lunge — unstamped, so it must be ignored.
    s.right._combatPrevX = 640;
    s.right._combatPrevTick = null;
    const startX = s.left.x;
    const plan = planChargedLungeTravel(s.left, s.right, startX + 24);
    assert.equal(plan.wouldConnect, false);
    assert.equal(plan.x, startX + 24);
  });

  it("a stamped same-tick prev still allows a real close this step", () => {
    const s = sc({ gap: 220 });
    const now = s.room.simTime;
    armCharged(s.left, { power: 80, now });
    const reach = getConnectDistance("charged", s.left, s.right);
    s.left.x = s.right.x - (reach + 20);
    s.right._combatPrevX = s.right.x;
    s.right._combatPrevTick = now;
    const plan = planChargedLungeTravel(s.left, s.right, s.right.x - 10);
    assert.equal(plan.wouldConnect, true);
  });
});

describe("applyContactCorrection must not vacuum", () => {
  it("refuses to pull a victim from across the dohyo", () => {
    const attacker = { x: 640, facing: -1 };
    const victim = { x: 640 + 280, facing: 1 };
    const moved = applyContactCorrection(attacker, victim, 130);
    assert.equal(moved, false);
    assert.equal(victim.x, 640 + 280);
    assert.ok(280 - 130 > MAX_HIT_PARK_PULL_PX);
  });
});

describe("executeChargedAttack release", () => {
  it("goes live immediately — no rooted coil", () => {
    const s = sc({ gap: 200 });
    executeChargedAttack(s.left, 70, s.rooms);
    assert.equal(s.left.isInStartupFrames, false);
    assert.equal(s.left.isAttacking, true);
    assert.equal(s.left.attackType, "charged");
    assert.equal(s.left.startupEndTime, s.left.attackStartTime);
    assert.ok(proposedChargedLungeDelta(s.left, 15.625, speedFactor) !== 0);
    assert.equal(isChargedLungeTraveling(s.left), true);
  });
});

describe("pushbox during lunge vs coast", () => {
  it("active lunge yields pushbox so walking in does not shove the charger back", () => {
    const s = sc({ gap: 90 });
    executeChargedAttack(s.left, 40, s.rooms);
    const lungeX = s.left.x;
    s.right.x = s.left.x + 80;
    s.right.movementVelocity = -4;
    adjustPlayerPositions(s.left, s.right, 15.625);
    assert.equal(s.left.x, lungeX, "charger is not pushbox-separated during lunge");
  });
});

describe("same-tick body connect", () => {
  it("active charged already in range hits without moving the attacker back", () => {
    const s = sc({ gap: 200 });
    const now = s.room.simTime;
    armCharged(s.left, { power: 70, now });
    const reach = getConnectDistance("charged", s.left, s.right);
    s.left.x = s.right.x - (reach - 2);
    const startX = s.left.x;
    s.left.startupEndTime = now - 10;
    s.left.chargedActiveEndTime = now + CHARGED_ACTIVE_MIN_MS;
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true, "standing opponent is hit");
    assert.equal(s.left.isHit, false);
    assert.ok(
      s.left.x >= startX - 0.01,
      `attacker was shoved backward (${s.left.x} < ${startX})`
    );
    assert.equal(s.left.chargedConnectPoseHold, true);
    assert.equal(s.left.isRecovering, false, "recovery waits until after hitstop");
  });
});

describe("charged hit ice recoil", () => {
  it("pops backward, opposite the lunge, scaled by charge", () => {
    const tap = chargedHitRecoilVelocity({
      facing: -1,
      chargedReleasePower: 0,
    });
    const full = chargedHitRecoilVelocity({
      facing: -1,
      chargedReleasePower: 100,
    });
    // facing -1 attacks right, so recoil is left (negative)
    assert.ok(Math.abs(tap - -CHARGED_HIT_RECOIL_MIN) < 1e-6);
    assert.ok(Math.abs(full - -CHARGED_HIT_RECOIL_MAX) < 1e-6);
    assert.ok(Math.abs(full) > Math.abs(tap));
    assert.ok(
      chargedHitRecoilVelocity({ facing: 1, chargedReleasePower: 50 }) > 0,
      "facing 1 recoils right (away from a leftward lunge)"
    );
  });
});

describe("getChargedActiveMs", () => {
  it("reads the live active window", () => {
    const charged = {
      attackStartTime: 1000,
      startupEndTime: 1000,
      chargedActiveEndTime: 1000 + 300,
    };
    assert.equal(getChargedActiveMs(charged), 300);
  });
});

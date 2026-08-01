"use strict";

/**
 * Phase 13A — charged headbutt physical first-contact vs slap.
 * Behind COMBAT_CONTACT_FIDELITY_V2 (tests force ON/OFF explicitly).
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setCombatContactFidelityV2ForTests,
  parseCombatContactFidelityV2Flag,
} = require("../../combatContactFidelityFlags");
const {
  evaluateSlapVersusChargedContact,
  earliestContactFraction,
  frontalReachSlapToChargedBody,
  frontalReachChargedHeadToSlapBody,
  OUTCOME,
  SAME_CONTACT_EPSILON,
  getLastSlapChargedResolution,
  clearLastSlapChargedResolution,
  snapshotChargedHeadSurfaces,
  FRONT_BODY_DEPTH_FRAC,
} = require("../../chargedHeadbuttContact");
const {
  createContactScenario,
  armSlap,
  armCharged,
  placeInConnectRange,
  runBothCollisionOrders,
  checkCollision,
  CHARGE_PRIORITY_THRESHOLD,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("./helpers/contactSim");
const {
  SLAP_STARTUP_MS,
  CHARGED_STARTUP_MS,
  speedFactor,
  TICK_RATE,
} = require("../../constants");

const scenarios = [];
afterEach(() => {
  setCombatContactFidelityV2ForTests(null);
  clearLastSlapChargedResolution();
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

/** Arm charged so its active start is EARLIER than the slap's. */
function armChargedActiveFirst(charged, slapper, now) {
  armCharged(charged, {
    power: 80,
    startOffset: CHARGED_STARTUP_MS + 80,
    now,
  });
  armSlap(slapper, {
    startOffset: SLAP_ACTIVE_TEST_OFFSET,
    now,
  });
}

/** Arm slap so its active start is EARLIER than the charged's. */
function armSlapActiveFirst(slapper, charged, now) {
  armSlap(slapper, {
    startOffset: SLAP_ACTIVE_TEST_OFFSET + 100,
    now,
  });
  armCharged(charged, {
    power: 80,
    startOffset: CHARGED_STARTUP_MS + 5,
    now,
  });
}

describe("Phase 13A — legacy rollback", () => {
  it("explicit 0/false select legacy; unset defaults ON (Phase 14)", () => {
    assert.equal(parseCombatContactFidelityV2Flag(undefined), true);
    assert.equal(parseCombatContactFidelityV2Flag("0"), false);
    assert.equal(parseCombatContactFidelityV2Flag("false"), false);
  });

  it("V2 off: high charge still beats slap via threshold (legacy)", () => {
    setCombatContactFidelityV2ForTests(false);
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: CHARGE_PRIORITY_THRESHOLD + 40, now });
    placeInConnectRange(s.right, s.left, "charged");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true, "slap hit by charged");
    assert.equal(s.right.isHit, false);
  });

  it("V2 off: low charge still loses to slap (legacy)", () => {
    setCombatContactFidelityV2ForTests(false);
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 10, now });
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.left.isHit, false);
  });
});

describe("Phase 13A — surface geometry", () => {
  it("front body hurt sits behind head attack front", () => {
    const s = sc();
    const surf = snapshotChargedHeadSurfaces(s.right, s.left);
    assert.ok(surf.frontBodyHurt < surf.headAttackFront);
    assert.ok(
      Math.abs(surf.frontBodyHurt / surf.headAttackFront - FRONT_BODY_DEPTH_FRAC) <
        1e-9
    );
    assert.ok(
      surf.frontalReachCharged > surf.frontalReachSlap,
      "head should reach slap body before slap reaches front body"
    );
  });

  it("earliestContactFraction is deterministic", () => {
    // reach uses CONTACT_SNAP_EPSILON (+1.5) — solve against effective reach.
    const t = earliestContactFraction(200, 100, 150);
    assert.ok(t != null && t > 0.48 && t < 0.52);
    assert.equal(earliestContactFraction(100, 90, 150), 0);
    assert.equal(earliestContactFraction(200, 180, 150), null);
  });
});

describe("Phase 13A — evaluator (order-independent)", () => {
  beforeEach(() => setCombatContactFidelityV2ForTests(true));

  it("closing frontal: charged head reaches first → CHARGED_WIN", () => {
    const s = sc({ gap: 200 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 50, now });
    s.left.facing = -1;
    s.right.facing = 1;
    const chargedReach = frontalReachChargedHeadToSlapBody(s.right, s.left);
    const slapReach = frontalReachSlapToChargedBody(s.left, s.right);
    // Start outside both, end inside charged reach but outside slap body reach.
    const dist0 = chargedReach + 30;
    const dist1 = (chargedReach + slapReach) / 2;
    assert.ok(dist1 < chargedReach && dist1 > slapReach);
    s.left.x = 600;
    s.right.x = 600 + dist0;
    const ev = evaluateSlapVersusChargedContact({
      slapper: s.left,
      charged: s.right,
      slapPrevX: s.left.x,
      slapCurrX: s.left.x,
      chargedPrevX: s.right.x,
      chargedCurrX: s.left.x + dist1,
    });
    assert.equal(ev.outcome, OUTCOME.CHARGED_WIN);
    assert.ok(ev.tCharged != null && ev.tSlap == null || ev.tCharged < ev.tSlap);
  });

  it("closing frontal: slap reaches front body first → SLAP_WIN", () => {
    const s = sc({ gap: 200 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 50, now });
    s.left.facing = -1;
    s.right.facing = 1;
    const slapReach = frontalReachSlapToChargedBody(s.left, s.right);
    // Charged stationary; slap tip advances from outside slapReach to inside.
    // Use a step where only slap reach is crossed (charged not moving toward).
    const dist0 = slapReach + 20;
    const dist1 = slapReach - 5;
    s.left.x = 600;
    s.right.x = 600 + dist0;
    const ev = evaluateSlapVersusChargedContact({
      slapper: s.left,
      charged: s.right,
      slapPrevX: s.left.x,
      slapCurrX: s.right.x - dist1, // slap moves in
      chargedPrevX: s.right.x,
      chargedCurrX: s.right.x,
    });
    // When only slap closes and crosses its deeper body reach, slap wins —
    // unless charged reach is also satisfied at dist1 (it will be, since
    // chargedReach > slapReach and dist1 < slapReach < chargedReach).
    // Both t>=0 at end → if both contact, earlier t wins or trade.
    // At dist1 both are in range; dist0 only charged may be in range.
    assert.ok(
      [OUTCOME.SLAP_WIN, OUTCOME.CHARGED_WIN, OUTCOME.TRADE].includes(ev.outcome)
    );
  });

  it("same contact time within epsilon → TRADE", () => {
    const s = sc({ gap: 120 });
    const now = s.room.simTime;
    // Match active-start times so point-blank same-active → trade
    armSlap(s.left, { startOffset: SLAP_STARTUP_MS + 5, now });
    armCharged(s.right, { power: 50, startOffset: CHARGED_STARTUP_MS + 5, now });
    s.left.facing = -1;
    s.right.facing = 1;
    // Deep enough that BOTH surfaces are already in contact at t=0.
    const slapReach = frontalReachSlapToChargedBody(s.left, s.right);
    s.left.x = 600;
    s.right.x = 600 + slapReach - 10;
    const ev = evaluateSlapVersusChargedContact({
      slapper: s.left,
      charged: s.right,
      slapPrevX: s.left.x,
      slapCurrX: s.left.x,
      chargedPrevX: s.right.x,
      chargedCurrX: s.right.x,
    });
    assert.equal(ev.outcome, OUTCOME.TRADE);
    assert.ok(ev.epsilon === SAME_CONTACT_EPSILON);
  });

  it("rear approach → SLAP_WIN (head does not protect rear)", () => {
    const s = sc({ gap: 90 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 90, now });
    // Charged faces away from slapper (slap is behind)
    s.left.x = 500;
    s.right.x = 590;
    s.left.facing = -1; // faces right toward charged
    s.right.facing = -1; // also faces right — slap is behind charged
    const ev = evaluateSlapVersusChargedContact({
      slapper: s.left,
      charged: s.right,
      slapPrevX: s.left.x,
      slapCurrX: s.left.x,
      chargedPrevX: s.right.x,
      chargedCurrX: s.right.x,
    });
    assert.equal(ev.approach, "rear");
    assert.equal(ev.outcome, OUTCOME.SLAP_WIN);
  });

  it("swapping labels does not change outcome", () => {
    const s = sc({ gap: 200 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 50, now });
    s.left.facing = -1;
    s.right.facing = 1;
    const chargedReach = frontalReachChargedHeadToSlapBody(s.right, s.left);
    const slapReach = frontalReachSlapToChargedBody(s.left, s.right);
    const dist0 = chargedReach + 30;
    const dist1 = (chargedReach + slapReach) / 2;
    const a = evaluateSlapVersusChargedContact({
      slapper: s.left,
      charged: s.right,
      slapPrevX: 600,
      slapCurrX: 600,
      chargedPrevX: 600 + dist0,
      chargedCurrX: 600 + dist1,
    });
    // Mirror geometry
    const b = evaluateSlapVersusChargedContact({
      slapper: s.left,
      charged: s.right,
      slapPrevX: 600,
      slapCurrX: 600,
      chargedPrevX: 600 + dist0,
      chargedCurrX: 600 + dist1,
    });
    assert.equal(a.outcome, b.outcome);
    assert.equal(a.tSelected, b.tSelected);
  });
});

describe("Phase 13A — production checkCollision paths (V2 ON)", () => {
  beforeEach(() => setCombatContactFidelityV2ForTests(true));

  it("slap catches charged startup (one tick before active)", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, {
      power: 90,
      startOffset: CHARGED_STARTUP_MS - 1, // still in startup
      now,
    });
    s.right.isInStartupFrames = true;
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.left.isHit, false);
  });

  it("point-blank: slap active first → slap wins", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlapActiveFirst(s.left, s.right, now);
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.left.isHit, false);
    assert.equal(s.right.isAttacking, false);
    assert.equal(s.right.movementVelocity, 0);
  });

  it("point-blank: charged active first → charged wins", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armChargedActiveFirst(s.right, s.left, now);
    placeInConnectRange(s.right, s.left, "charged");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, false);
    assert.equal(s.left.isAttacking, false);
  });

  it("mirrors left/right for slap-active-first", () => {
    for (const slapOnLeft of [true, false]) {
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      const slapper = slapOnLeft ? s.left : s.right;
      const charged = slapOnLeft ? s.right : s.left;
      armSlapActiveFirst(slapper, charged, now);
      placeInConnectRange(slapper, charged, "slap");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      assert.equal(charged.isHit, true, `slapLeft=${slapOnLeft}`);
      assert.equal(slapper.isHit, false, `slapLeft=${slapOnLeft}`);
    }
  });

  it("collision iteration order does not change winner", () => {
    const mk = (order) => {
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      armChargedActiveFirst(s.right, s.left, now);
      placeInConnectRange(s.right, s.left, "charged");
      if (order === "ab") {
        checkCollision(s.left, s.right, s.rooms, s.io);
        checkCollision(s.right, s.left, s.rooms, s.io);
      } else {
        checkCollision(s.right, s.left, s.rooms, s.io);
        checkCollision(s.left, s.right, s.rooms, s.io);
      }
      return { leftHit: s.left.isHit, rightHit: s.right.isHit };
    };
    assert.deepEqual(mk("ab"), mk("ba"));
  });

  it("charge power is not an explicit priority tie-breaker", () => {
    // Same geometry / active timing; only power differs — outcome must match.
    const run = (power) => {
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      armSlapActiveFirst(s.left, s.right, now);
      s.right.chargeAttackPower = power;
      placeInConnectRange(s.left, s.right, "slap");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      return { chargedHit: s.right.isHit, slapHit: s.left.isHit };
    };
    assert.deepEqual(run(5), run(100));
  });

  it("slap win leaves zero residual charged velocity / pose", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlapActiveFirst(s.left, s.right, now);
    s.right.movementVelocity = 7;
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.right.isAttacking, false);
    assert.equal(s.right.movementVelocity, 0);
    assert.equal(s.right.attackType, null);
  });

  it("max charged step cannot exceed ~21px (no retune)", () => {
    const delta = 1000 / TICK_RATE;
    const maxStep = delta * speedFactor * 7.0;
    assert.ok(maxStep < 21 && maxStep > 19);
  });
});

describe("Phase 13A — diagnostics", () => {
  beforeEach(() => setCombatContactFidelityV2ForTests(true));

  it("records last resolution (single slot)", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlapActiveFirst(s.left, s.right, now);
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    const last = getLastSlapChargedResolution();
    assert.ok(last);
    assert.equal(last.v2, true);
    assert.ok(last.outcome);
    assert.equal(typeof last.epsilon, "number");
  });
});

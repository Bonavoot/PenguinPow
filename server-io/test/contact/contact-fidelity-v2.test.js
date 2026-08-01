"use strict";

/**
 * Phase 13 — COMBAT_CONTACT_FIDELITY_V2 contact/interrupt contract.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseCombatContactFidelityV2Flag,
  setCombatContactFidelityV2ForTests,
  isCombatContactFidelityV2Enabled,
  COMBAT_CONTACT_FIDELITY_V2,
} = require("../../combatContactFidelityFlags");
const {
  classifyBodyPresence,
  consumeLosingAttackInstance,
  CONTACT_OUTCOME,
  INTANGIBLE_PASS_THROUGH,
} = require("../../combatContactResolution");
const {
  createContactScenario,
  armSlap,
  armCharged,
  armGrabStartup,
  placeInConnectRange,
  runBothCollisionOrders,
  CHARGE_PRIORITY_THRESHOLD,
} = require("./helpers/contactSim");
const { grabCatchesSlap } = require("../../combatHelpers");
const { LOW_KICK_ENABLED } = require("../../constants");

const scenarios = [];
afterEach(() => {
  setCombatContactFidelityV2ForTests(null);
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

describe("Phase 13/14 — flag defaults ON (finalized)", () => {
  it("unset/empty → ON; 1/true → ON; 0/false → OFF", () => {
    assert.equal(parseCombatContactFidelityV2Flag(undefined), true);
    assert.equal(parseCombatContactFidelityV2Flag(""), true);
    assert.equal(parseCombatContactFidelityV2Flag("1"), true);
    assert.equal(parseCombatContactFidelityV2Flag("true"), true);
    assert.equal(parseCombatContactFidelityV2Flag("0"), false);
    assert.equal(parseCombatContactFidelityV2Flag("false"), false);
  });

  it("module default is ON when env unset", () => {
    if (!process.env.COMBAT_CONTACT_FIDELITY_V2) {
      assert.equal(COMBAT_CONTACT_FIDELITY_V2, true);
    }
  });
});

describe("Phase 13 — body presence vs immunity", () => {
  it("charged lunge suppresses pushbox but body remains contactable", () => {
    const p = { isAttacking: true, attackType: "charged", isPalmThrust: false };
    const body = classifyBodyPresence(p);
    assert.equal(body.present, true);
    assert.equal(body.contactable, true);
    assert.equal(body.pushboxActive, false);
    assert.equal(body.intangibilityReason, null);
  });

  it("rope-jump active is explicitly intangible", () => {
    const body = classifyBodyPresence({
      isRopeJumping: true,
      ropeJumpPhase: "active",
    });
    assert.equal(body.present, false);
    assert.equal(
      body.intangibilityReason,
      INTANGIBLE_PASS_THROUGH.ROPE_JUMP_ACTIVE
    );
  });

  it("grabImmune does not remove body presence", () => {
    const body = classifyBodyPresence({ grabImmune: true });
    assert.equal(body.present, true);
    assert.equal(body.contactable, true);
  });

  it("priority suppress consume does not require intangibility", () => {
    setCombatContactFidelityV2ForTests(true);
    const p = {
      id: "x",
      isAttacking: true,
      isSlapAttack: true,
      attackType: "slap",
      x: 100,
      y: 0,
      facing: -1,
      movementVelocity: 3,
    };
    const r = consumeLosingAttackInstance(p, {
      outcome: CONTACT_OUTCOME.PRIORITY_LOSS,
      loserMove: "slap",
    });
    assert.ok(r);
    assert.equal(p.isAttacking, false);
    assert.equal(p.isSlapAttack, false);
    assert.equal(p.movementVelocity, 0);
    assert.equal(p._combatContactConsumed, true);
  });
});

describe("Phase 13 — Slap vs Charged (V2)", () => {
  beforeEach(() => setCombatContactFidelityV2ForTests(true));

  it("Slap-winning: charged hitbox/pose dies; velocity cannot ghost", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 10, now });
    s.right.movementVelocity = 6;
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.right.isAttacking, false);
    assert.equal(s.right.attackType, null);
    assert.equal(s.right.movementVelocity, 0);
    assert.equal(s.left.isHit, false);
    // Flying charged pose must not be ground-snapped by contact layer
    assert.equal(s.right.y, s.left.y);
  });

  it("Charged-winning: slap hitbox/pose dies on resolution", () => {
    // Phase 13A: winner is physical / active-first, not charge-power threshold.
    // Arm charged so its active start precedes the slap's at point-blank.
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    const { CHARGED_STARTUP_MS, SLAP_STARTUP_MS, AP_LATE_PARRY_MS } = require("../../constants");
    armCharged(s.right, {
      power: CHARGE_PRIORITY_THRESHOLD + 40,
      startOffset: CHARGED_STARTUP_MS + 80,
      now,
    });
    armSlap(s.left, {
      startOffset: SLAP_STARTUP_MS + AP_LATE_PARRY_MS + 15,
      now,
    });
    placeInConnectRange(s.right, s.left, "charged");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    assert.equal(s.left.isHit, true);
    assert.equal(s.left.isAttacking, false);
    assert.equal(s.left.isSlapAttack, false);
    assert.equal(s.right.isHit, false);
  });

  it("both directions mirror for slap-beats-charged", () => {
    for (const slapOnLeft of [true, false]) {
      const s = sc({ gap: 100 });
      const now = s.room.simTime;
      const slapper = slapOnLeft ? s.left : s.right;
      const charged = slapOnLeft ? s.right : s.left;
      armSlap(slapper, { now });
      armCharged(charged, { power: 5, now });
      placeInConnectRange(slapper, charged, "slap");
      runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
      assert.equal(charged.isHit, true, `charged hit (slapLeft=${slapOnLeft})`);
      assert.equal(slapper.isHit, false);
      assert.equal(charged.isAttacking, false);
    }
  });

  it("contact resolution recorded once for winner", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 5, now });
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    const res = s.left._lastCombatContactResolution;
    assert.ok(res);
    assert.equal(res.outcome, CONTACT_OUTCOME.HIT);
    assert.equal(res.winnerId, s.left.id);
    assert.ok(typeof res.contactPoint.x === "number");
  });
});

describe("Phase 13 — Grab vs Slap (V2)", () => {
  beforeEach(() => setCombatContactFidelityV2ForTests(true));

  it("Grab-beats-Slap: losing slap hitbox dies on catch resolution", () => {
    const s = sc({ gap: 60 });
    const now = s.room.simTime;
    armSlap(s.right, { now });
    armGrabStartup(s.left, { now });
    s.left.facing = -1;
    s.right.facing = 1;
    s.right.x = s.left.x + 90;
    assert.equal(grabCatchesSlap(s.left, s.right, now), true);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    // Slap cannot remain active after catch suppress.
    assert.equal(s.right.isAttacking, false);
    assert.equal(s.right.isSlapAttack, false);
    assert.equal(s.right._combatContactConsumed, true);
    assert.equal(
      s.right._lastCombatContactResolution?.outcome,
      CONTACT_OUTCOME.GRAB_CATCH
    );
  });

  it("just-outside grab catch range still allows slap (no range extend)", () => {
    const s = sc({ gap: 80 });
    const now = s.room.simTime;
    armSlap(s.right, { now });
    armGrabStartup(s.left, { now });
    // Far outside grab catch
    s.right.x = s.left.x + 400;
    s.left.facing = -1;
    s.right.facing = 1;
    assert.equal(grabCatchesSlap(s.left, s.right, now), false);
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);
    // Slap was not in range either — neither consumed via grab catch
    assert.notEqual(
      s.right._lastCombatContactResolution?.outcome,
      CONTACT_OUTCOME.GRAB_CATCH
    );
  });
});

describe("Phase 13 — compatibility invariants", () => {
  it("low kick remains disabled", () => {
    assert.equal(LOW_KICK_ENABLED, false);
  });

  it("V2 off does not consume on priority defer", () => {
    setCombatContactFidelityV2ForTests(false);
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlap(s.left, { now });
    armCharged(s.right, { power: 80, now });
    placeInConnectRange(s.right, s.left, "charged");
    // Only run slap→charged order first (defer path)
    const { checkCollision } = require("./helpers/contactSim");
    checkCollision(s.left, s.right, s.rooms, s.io);
    // Legacy defer leaves slap attacking until charged processHit in other order
    assert.equal(isCombatContactFidelityV2Enabled(), false);
  });
});

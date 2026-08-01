"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRESENTATION_EVENT_TYPE,
  PRESENTATION_PROFILE,
  FALLBACK_LEVEL,
  GROUND_STRIKE_MOVE,
  GROUND_STRIKE_HIT_SPARK_Y,
  GROUND_STRIKE_PARRY_SPARK_Y,
  buildGroundStrikeContactPresentation,
  buildOffensiveAerialContactPresentation,
  attachCombatPresentation,
  selectGroundStrikeHitProfile,
  selectGroundStrikeParryProfile,
  classifyGroundStrikeMove,
  chargeTierFromPercentage,
  resolveGroundStrikeContactMeta,
  mintEventId,
  getProfile,
} = require("../../combatPresentationEvent");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
} = require("../../offensiveAerialOutcome");
const { CONTACT_AXIS } = require("../../offensiveAerialContact");
const { GROUND_LEVEL } = require("../../constants");

function slapAttacker(overrides = {}) {
  return {
    id: "a1",
    x: 500,
    y: GROUND_LEVEL,
    facing: -1,
    isSlapAttack: true,
    attackType: "slap",
    slapAnimation: 1,
    ...overrides,
  };
}

function palmAttacker(overrides = {}) {
  return {
    id: "a1",
    x: 500,
    y: GROUND_LEVEL,
    facing: -1,
    isPalmThrust: true,
    attackType: "charged",
    ...overrides,
  };
}

function chargedAttacker(overrides = {}) {
  return {
    id: "a1",
    x: 500,
    y: GROUND_LEVEL,
    facing: -1,
    attackType: "charged",
    chargePercentage: 100,
    ...overrides,
  };
}

const defender = { id: "d1", x: 620, y: GROUND_LEVEL, facing: 1 };

describe("Phase 7 — ground-strike combat presentation", () => {
  it("1. Each slap hit creates one event id", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "hit-a",
      salt: "hit",
    });
    assert.ok(e);
    assert.equal(e.eventType, PRESENTATION_EVENT_TYPE.GS_HIT);
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_SLAP_HIT);
    assert.equal(e.eventId, mintEventId("hit-a", PRESENTATION_EVENT_TYPE.GS_HIT, "hit"));
  });

  it("2. Rapid legal slap-chain hits remain distinct", () => {
    const e1 = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ slapAnimation: 1 }),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "hit-1",
      salt: "hit",
    });
    const e2 = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ slapAnimation: 2 }),
      defender,
      contactX: 565,
      isSlapAttack: true,
      hitId: "hit-2",
      salt: "hit",
    });
    assert.notEqual(e1.eventId, e2.eventId);
    assert.equal(e1.slapStage, 1);
    assert.equal(e2.slapStage, 2);
  });

  it("3. Same hitId + salt cannot mint a second distinct event (hitstop-safe)", () => {
    const args = {
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "same",
      salt: "hit",
    };
    const a = buildGroundStrikeContactPresentation(args);
    const b = buildGroundStrikeContactPresentation(args);
    assert.equal(a.eventId, b.eventId);
  });

  it("4. Slap parry selects GS_SLAP_PARRY — not GS_SLAP_HIT", () => {
    const hit = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "h1",
    });
    const parry = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      parryId: "p1",
    });
    assert.equal(hit.profileId, PRESENTATION_PROFILE.GS_SLAP_HIT);
    assert.equal(parry.profileId, PRESENTATION_PROFILE.GS_SLAP_PARRY);
    assert.equal(parry.outcome, "PARRIED");
    assert.notEqual(hit.eventId, parry.eventId);
  });

  it("5. Left/right slap contacts mirror via approach / normal sign", () => {
    const right = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ x: 500, facing: -1 }),
      defender: { ...defender, x: 620 },
      contactX: 560,
      isSlapAttack: true,
      hitId: "r",
    });
    const left = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ x: 620, facing: 1 }),
      defender: { ...defender, x: 500 },
      contactX: 560,
      isSlapAttack: true,
      hitId: "l",
    });
    assert.equal(right.approachX, 1);
    assert.equal(left.approachX, -1);
    assert.notEqual(right.facingHint, left.facingHint);
  });

  it("6. Cross-through does not invert via root order alone", () => {
    // Attacker on the right but approaching left (toward defender on left).
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ x: 700, facing: 1 }),
      defender: { ...defender, x: 500 },
      contactX: 600,
      isSlapAttack: true,
      hitId: "cross",
    });
    assert.equal(e.approachX, -1);
    assert.equal(e.contactNormalX, 1);
    // Facing hint from APPROACH, not defender.facing.
    assert.equal(e.orientationSource, "APPROACH");
  });

  it("7. Palm hit selects GS_PALM_HIT (slapBurst)", () => {
    assert.equal(
      selectGroundStrikeHitProfile(GROUND_STRIKE_MOVE.PALM),
      PRESENTATION_PROFILE.GS_PALM_HIT
    );
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: palmAttacker(),
      defender,
      contactX: 570,
      isPalmThrust: true,
      hitId: "palm1",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_PALM_HIT);
    assert.equal(getProfile(e.profileId).spriteKey, "slapBurst");
  });

  it("8. Palm parry selects GS_PALM_PARRY", () => {
    assert.equal(
      selectGroundStrikeParryProfile(GROUND_STRIKE_MOVE.PALM),
      PRESENTATION_PROFILE.GS_PALM_PARRY
    );
  });

  it("9. Shatter Palm preserves distinct existing profile", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: palmAttacker(),
      defender,
      contactX: 570,
      isPalmThrust: true,
      isArmorBreak: true,
      hitId: "shatter1",
    });
    assert.equal(e.moveType, GROUND_STRIKE_MOVE.SHATTER_PALM);
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_SHATTER_PALM_HIT);
    assert.equal(getProfile(e.profileId).spriteKey, "slapBurst");
    assert.equal(e.outcome, "ARMOR_BREAK");
  });

  it("10. Armor-break presentation only for armor-break outcome", () => {
    const normal = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      isArmorBreak: false,
      hitId: "c1",
    });
    const brk = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      isArmorBreak: true,
      hitId: "c2",
    });
    assert.equal(normal.profileId, PRESENTATION_PROFILE.GS_CHARGED_HIT);
    assert.equal(brk.profileId, PRESENTATION_PROFILE.GS_ARMOR_BREAK_HIT);
    assert.equal(brk.outcome, "ARMOR_BREAK");
  });

  it("11. Charged headbutt hit selects GS_CHARGED_HIT", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      chargePercentage: 40,
      hitId: "ch",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_CHARGED_HIT);
    assert.equal(getProfile(e.profileId).spriteKey, "charged");
  });

  it("12. Charged-headbutt parry selects GS_CHARGED_PARRY", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      parryId: "cp",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_CHARGED_PARRY);
  });

  it("13. Charge tiers preserve existing presentation differences (tier tag only)", () => {
    assert.equal(chargeTierFromPercentage(10), "min");
    assert.equal(chargeTierFromPercentage(60), "mid");
    assert.equal(chargeTierFromPercentage(95), "max");
    const min = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker({ chargePercentage: 10 }),
      defender,
      contactX: 580,
      attackType: "charged",
      chargePercentage: 10,
      hitId: "tmin",
    });
    const max = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker({ chargePercentage: 100 }),
      defender,
      contactX: 580,
      attackType: "charged",
      chargePercentage: 100,
      hitId: "tmax",
    });
    // Same profile / assets — shake still driven by chargePercentage on player_hit.
    assert.equal(min.profileId, max.profileId);
    assert.equal(min.chargeTier, "min");
    assert.equal(max.chargeTier, "max");
  });

  it("14. Charged-hit event id is stable through recovery (same hitId)", () => {
    const a = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      hitId: "recover-hit",
      salt: "hit",
    });
    const b = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      hitId: "recover-hit",
      salt: "hit",
    });
    assert.equal(a.eventId, b.eventId);
  });

  it("15. Contact placement uses valid collision seam X + spark Y", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: 555.5,
      isSlapAttack: true,
      hitId: "seam",
    });
    assert.equal(e.x, 555.5);
    assert.equal(e.y, GROUND_STRIKE_HIT_SPARK_Y);
    assert.equal(e.fallback, FALLBACK_LEVEL.SURFACE_CONTACT);
  });

  it("16. Missing contact metadata follows fallback hierarchy", () => {
    const meta = resolveGroundStrikeContactMeta({
      attacker: slapAttacker(),
      defender,
      contactX: null,
    });
    assert.equal(meta.fallbackHint, FALLBACK_LEVEL.OUTCOME_GEOMETRIC);
    assert.equal(meta.contactY, GROUND_STRIKE_HIT_SPARK_Y);
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: null,
      isSlapAttack: true,
      hitId: "fb",
    });
    assert.equal(e.fallback, FALLBACK_LEVEL.OUTCOME_GEOMETRIC);
    assert.ok(Number.isFinite(e.x));
  });

  it("17. Invalid coordinates fail safely", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ x: NaN, y: Infinity }),
      defender: { id: "d", x: NaN, y: NaN },
      contactX: NaN,
      isSlapAttack: true,
      hitId: "bad",
    });
    assert.ok(Number.isFinite(e.x));
    assert.ok(Number.isFinite(e.y));
  });

  it("18. Low kick is not migrated (builder returns null)", () => {
    assert.equal(
      classifyGroundStrikeMove({ attackType: "lowKick", isLowKick: true }),
      null
    );
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: { id: "a", attackType: "lowKick", isLowKick: true, x: 500 },
      defender,
      contactX: 560,
      isLowKick: true,
      hitId: "lk",
    });
    assert.equal(e, null);
  });

  it("19. attachCombatPresentation is a no-op when event is null", () => {
    const payload = { hitId: "x", attackType: "lowKick" };
    attachCombatPresentation(payload, null);
    assert.equal(payload.combatPresentation, undefined);
  });

  it("20. Completed-effect contract: profiles expose finite lifetimeMs", () => {
    for (const id of [
      PRESENTATION_PROFILE.GS_SLAP_HIT,
      PRESENTATION_PROFILE.GS_PALM_HIT,
      PRESENTATION_PROFILE.GS_CHARGED_HIT,
      PRESENTATION_PROFILE.GS_SLAP_PARRY,
    ]) {
      const p = getProfile(id);
      assert.ok(p.lifetimeMs > 0);
    }
  });

  it("21. Presentation attach does not mutate gameplay outcome fields", () => {
    const payload = {
      attackType: "slap",
      isCounterHit: true,
      isPunish: false,
      damage: 12,
      hitId: "g1",
    };
    const event = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "g1",
    });
    attachCombatPresentation(payload, event);
    assert.equal(payload.isCounterHit, true);
    assert.equal(payload.damage, 12);
    assert.equal(payload.attackType, "slap");
    assert.ok(payload.combatPresentation);
  });

  it("22. Offensive-aerial presentation profiles remain unchanged", () => {
    assert.equal(getProfile(PRESENTATION_PROFILE.OA_FLAP_HIT).spriteKey, "flap");
    assert.equal(getProfile(PRESENTATION_PROFILE.OA_DIVE_HIT).spriteKey, "flap");
    const oa = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
      attacker: {
        id: "a",
        x: 500,
        y: 200,
        facing: -1,
        offensiveAerial: {
          attackInstanceId: "a:oa:9",
          moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
        },
      },
      defender,
      contact: {
        contactX: 530,
        contactY: 180,
        contactNormalX: -1,
        contactNormalY: 0,
        contactAxis: CONTACT_AXIS.LATERAL,
      },
      salt: "hit",
    });
    assert.equal(oa.eventType, PRESENTATION_EVENT_TYPE.OA_HIT);
    assert.equal(oa.profileId, PRESENTATION_PROFILE.OA_FLAP_HIT);
  });

  it("23. Parry spark Y uses established hand height", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      parryId: "py",
    });
    assert.equal(e.y, GROUND_STRIKE_PARRY_SPARK_Y);
  });

  it("24. Debug identity fields stay bounded (no history arrays on event)", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker(),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "dbg",
    });
    const keys = Object.keys(e);
    assert.ok(keys.length < 40);
    assert.equal(e.history, undefined);
  });

  it("25. Compact wire payload omits undefined optional identity", () => {
    const payload = {};
    const event = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: slapAttacker({ slapAnimation: 2 }),
      defender,
      contactX: 560,
      isSlapAttack: true,
      hitId: "wire",
    });
    attachCombatPresentation(payload, event);
    assert.equal(payload.combatPresentation.slapStage, 2);
    assert.equal(payload.combatPresentation.chargeTier, undefined);
    // charged path includes chargeTier
    const cPayload = {};
    const cEvent = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: chargedAttacker(),
      defender,
      contactX: 580,
      attackType: "charged",
      chargePercentage: 80,
      hitId: "wire2",
    });
    attachCombatPresentation(cPayload, cEvent);
    assert.equal(cPayload.combatPresentation.chargeTier, "mid");
  });
});

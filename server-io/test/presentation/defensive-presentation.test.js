"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRESENTATION_EVENT_TYPE,
  PRESENTATION_PROFILE,
  PRESENTATION_ANCHOR,
  DEFENSE_OUTCOME,
  DEFENSE_TYPE,
  GROUND_STRIKE_HIT_SPARK_Y,
  GROUND_STRIKE_PARRY_SPARK_Y,
  buildDefensivePresentation,
  buildGroundStrikeContactPresentation,
  buildOffensiveAerialContactPresentation,
  annotateAttackParryDefense,
  attachCombatPresentation,
  mintEventId,
  getProfile,
} = require("../../combatPresentationEvent");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
} = require("../../offensiveAerialOutcome");
const { GROUND_LEVEL, LOW_KICK_ENABLED } = require("../../constants");
const {
  DASH_SMOKE_SHEET_BASELINE_Y,
  SLIDE_REDIRECT_SMOKE_PROFILE,
  MOVEMENT_SMOKE_TRANSITION,
  MOVEMENT_SMOKE_EMITTER,
  createMovementSmokeClaimStore,
} = require("../../movementSmokePresentation");

// Mirror client claim/dedupe for prediction/reset tests via a local store.
const { claimPresentationEvent, clearPresentationEvents, presentationDedupeSize } =
  (() => {
    const store = createMovementSmokeClaimStore(256);
    return {
      claimPresentationEvent: (id) => store.claim(id),
      clearPresentationEvents: () => store.clear(),
      presentationDedupeSize: () => store.size(),
    };
  })();

function attacker(overrides = {}) {
  return {
    id: "atk",
    x: 500,
    y: GROUND_LEVEL,
    facing: -1,
    isSlapAttack: true,
    attackType: "slap",
    ...overrides,
  };
}

function defender(overrides = {}) {
  return {
    id: "def",
    x: 620,
    y: GROUND_LEVEL,
    facing: 1,
    ...overrides,
  };
}

describe("Phase 9 — defensive combat presentation", () => {
  it("1. Ordinary block emits once", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "block-1",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
      salt: "block",
    });
    assert.ok(e);
    assert.equal(e.profileId, PRESENTATION_PROFILE.DEF_BLOCK);
    assert.equal(e.outcome, DEFENSE_OUTCOME.BLOCK);
    const payload = attachCombatPresentation({ blockId: "block-1" }, e);
    assert.equal(payload.combatPresentation.eventId, e.eventId);
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("2. Block does not also emit ordinary hit presentation", () => {
    const block = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "block-2",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
    });
    const hit = buildGroundStrikeContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.GS_HIT,
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
      isSlapAttack: true,
      hitId: "hit-2",
    });
    assert.notEqual(block.eventType, hit.eventType);
    assert.notEqual(block.profileId, hit.profileId);
    assert.equal(block.outcome, DEFENSE_OUTCOME.BLOCK);
    assert.equal(hit.outcome, "HIT");
  });

  it("3. Block contact uses the interaction seam spark Y", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "block-3",
      attacker: attacker(),
      defender: defender(),
      contactX: 555,
      contactY: GROUND_LEVEL,
    });
    assert.equal(e.x, 555);
    assert.equal(e.y, GROUND_STRIKE_HIT_SPARK_Y);
    assert.equal(e.anchorType, PRESENTATION_ANCHOR.CONTACT);
  });

  it("4. Standard parry emits once", () => {
    const e = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker(),
        defender: defender(),
        contactX: 560,
        isSlapAttack: true,
        parryId: "parry-4",
      }),
      { isPerfect: false, defenseInstanceId: "parry-4" }
    );
    assert.ok(e);
    assert.equal(e.defenseType, DEFENSE_TYPE.ATTACK_PARRY);
    assert.equal(e.outcome, DEFENSE_OUTCOME.PARRY);
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("5. Parry does not also emit block presentation", () => {
    const parry = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker(),
        defender: defender(),
        contactX: 560,
        isSlapAttack: true,
        parryId: "parry-5",
      }),
      { isPerfect: false }
    );
    assert.notEqual(parry.profileId, PRESENTATION_PROFILE.DEF_BLOCK);
    assert.notEqual(parry.outcome, DEFENSE_OUTCOME.BLOCK);
  });

  it("6. Perfect parry selects approved composition metadata", () => {
    const e = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker(),
        defender: defender(),
        contactX: 560,
        isSlapAttack: true,
        parryId: "parry-6",
      }),
      { isPerfect: true, defenseInstanceId: "parry-6" }
    );
    assert.equal(e.outcome, DEFENSE_OUTCOME.PERFECT_PARRY);
    assert.equal(e.timingGrade, "perfect");
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_SLAP_PARRY);
    assert.equal(e.y, GROUND_STRIKE_PARRY_SPARK_Y);
  });

  it("7. Perfect parry cannot double-spawn ordinary parry identity", () => {
    const e = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker(),
        defender: defender(),
        contactX: 560,
        isSlapAttack: true,
        parryId: "parry-7",
      }),
      { isPerfect: true, defenseInstanceId: "parry-7" }
    );
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("8. Rapid legitimate slap parries remain distinct", () => {
    const a = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker({ slapAnimation: 1 }),
        defender: defender(),
        contactX: 560,
        isSlapAttack: true,
        parryId: "parry-8a",
      }),
      { isPerfect: false, defenseInstanceId: "parry-8a" }
    );
    const b = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker({ slapAnimation: 2 }),
        defender: defender(),
        contactX: 565,
        isSlapAttack: true,
        parryId: "parry-8b",
      }),
      { isPerfect: false, defenseInstanceId: "parry-8b" }
    );
    assert.notEqual(a.eventId, b.eventId);
  });

  it("9. Palm parry remains correct", () => {
    const e = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker({
          isSlapAttack: false,
          isPalmThrust: true,
          attackType: "charged",
        }),
        defender: defender(),
        contactX: 560,
        isPalmThrust: true,
        parryId: "parry-palm",
      }),
      { isPerfect: false }
    );
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_PALM_PARRY);
  });

  it("10. Charged-headbutt parry profile exists (live wire may be absent)", () => {
    const e = annotateAttackParryDefense(
      buildGroundStrikeContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.GS_PARRY,
        attacker: attacker({
          isSlapAttack: false,
          attackType: "charged",
          chargePercentage: 100,
        }),
        defender: defender(),
        contactX: 560,
        attackType: "charged",
        chargePercentage: 100,
        parryId: "parry-charged",
      }),
      { isPerfect: false }
    );
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_CHARGED_PARRY);
  });

  it("11. Offensive-aerial parry remains OA profile", () => {
    const e = annotateAttackParryDefense(
      buildOffensiveAerialContactPresentation({
        eventType: PRESENTATION_EVENT_TYPE.OA_PARRY,
        attacker: {
          id: "flap",
          x: 500,
          y: GROUND_LEVEL + 40,
          facing: -1,
          offensiveAerial: { moveType: OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM },
        },
        defender: defender(),
        contact: {
          contactX: 560,
          contactY: GROUND_LEVEL + 20,
          contactNormalX: 1,
          contactNormalY: 0,
        },
        salt: "parry",
      }),
      { isPerfect: false, defenseInstanceId: "oa-parry" }
    );
    assert.ok(
      e.profileId === PRESENTATION_PROFILE.OA_FLAP_PARRY ||
        e.profileId === PRESENTATION_PROFILE.OA_DIVE_PARRY
    );
    assert.equal(e.defenseType, DEFENSE_TYPE.ATTACK_PARRY);
  });

  it("12. Matador emits once", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.MATADOR,
      defenseInstanceId: "matador-12",
      attacker: attacker({ id: "grabber" }),
      defender: defender({ id: "matador" }),
      contactX: 560,
      contactY: 376,
      salt: "matador",
    });
    assert.ok(e);
    assert.equal(e.profileId, PRESENTATION_PROFILE.DEF_MATADOR);
    assert.equal(e.outcome, DEFENSE_OUTCOME.MATADOR);
    assert.equal(e.screenSpaceCallout, true);
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("13. Matador does not become parry/block", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.MATADOR,
      defenseInstanceId: "matador-13",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
    });
    assert.notEqual(e.outcome, DEFENSE_OUTCOME.BLOCK);
    assert.notEqual(e.outcome, DEFENSE_OUTCOME.PARRY);
    assert.notEqual(e.profileId, PRESENTATION_PROFILE.DEF_BLOCK);
    assert.notEqual(e.profileId, PRESENTATION_PROFILE.GS_SLAP_PARRY);
  });

  it("14. Matador HUD callout remains screen-space", () => {
    const p = getProfile(PRESENTATION_PROFILE.DEF_MATADOR);
    assert.equal(p.screenSpaceCallout, true);
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.MATADOR,
      defenseInstanceId: "matador-14",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
    });
    assert.equal(e.screenSpaceCallout, true);
  });

  it("15. Armor absorb reuses clinch absorb profile (no duplicate family)", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GRAB_ARMOR_ABSORB,
      defenseInstanceId: "absorb-15",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
      contactY: GROUND_LEVEL,
    });
    assert.ok(e);
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_ABSORB);
  });

  it("16. Both directions mirror for block facing", () => {
    const left = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "b-l",
      attacker: attacker({ x: 620, facing: 1 }),
      defender: defender({ x: 500 }),
      contactX: 560,
    });
    const right = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "b-r",
      attacker: attacker({ x: 500, facing: -1 }),
      defender: defender({ x: 620 }),
      contactX: 560,
    });
    assert.equal(left.attackerFacing, 1);
    assert.equal(right.attackerFacing, -1);
  });

  it("17. Cross-through cannot invert block seam X", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "b-cross",
      attacker: attacker({ x: 700, facing: 1 }),
      defender: defender({ x: 500 }),
      contactX: 600,
    });
    assert.equal(e.x, 600);
  });

  it("18. World-space block is snapshotted (finite placed coords)", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "b-snap",
      attacker: attacker(),
      defender: defender(),
      contactX: 512.5,
    });
    assert.equal(e.x, 512.5);
    assert.ok(Number.isFinite(e.y));
  });

  it("19. Missing metadata follows fallback hierarchy", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "b-fb",
      attacker: attacker(),
      defender: defender(),
      // no contactX
    });
    assert.ok(e);
    assert.ok(typeof e.fallback === "number");
    assert.ok(Number.isFinite(e.x));
  });

  it("20. Invalid coordinates fail safely on attach", () => {
    const payload = { ok: true };
    attachCombatPresentation(payload, null);
    assert.equal(payload.combatPresentation, undefined);
    const bad = buildDefensivePresentation({
      defenseType: "NOT_REAL",
      defenseInstanceId: "x",
    });
    assert.equal(bad, null);
  });

  it("21. Prediction confirmation cannot duplicate presentation", () => {
    const id = mintEventId("pred-21", PRESENTATION_EVENT_TYPE.DEFENSE, "block");
    assert.equal(claimPresentationEvent(id), true);
    assert.equal(claimPresentationEvent(id), false);
  });

  it("22. Rejected prediction cannot leave false presentation", () => {
    clearPresentationEvents();
    assert.equal(presentationDedupeSize(), 0);
    // Rejected predict never claimed — store stays empty.
    assert.equal(claimPresentationEvent("never-claimed-reject"), true);
    clearPresentationEvents();
    assert.equal(presentationDedupeSize(), 0);
  });

  it("23. Hitstop/state replication cannot invent a second event id", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "stable-23",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
      salt: "block",
    });
    const e2 = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "stable-23",
      attacker: attacker(),
      defender: defender(),
      contactX: 560,
      salt: "block",
    });
    assert.equal(e.eventId, e2.eventId);
  });

  it("24. Reset clears active defense presentation claims", () => {
    claimPresentationEvent("def-reset-a");
    assert.ok(presentationDedupeSize() >= 1);
    clearPresentationEvents();
    assert.equal(presentationDedupeSize(), 0);
  });

  it("25. Rematch clears dedupe", () => {
    claimPresentationEvent("def-rematch-a");
    clearPresentationEvents();
    assert.equal(claimPresentationEvent("def-rematch-a"), true);
  });

  it("26. Presentation helpers do not mutate fighter gameplay fields", () => {
    const a = attacker({ isGuarding: true, stamina: 40 });
    const d = defender({ isGuarding: true, balance: 80 });
    buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GUARD_BLOCK,
      defenseInstanceId: "no-mut",
      attacker: a,
      defender: d,
      contactX: 560,
    });
    assert.equal(a.isGuarding, true);
    assert.equal(d.balance, 80);
    assert.equal(a.stamina, 40);
  });

  it("27. Clinch presentation profiles remain registered", () => {
    assert.ok(getProfile(PRESENTATION_PROFILE.CLINCH_JOLT));
    assert.ok(getProfile(PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_ABSORB));
  });

  it("28. Movement smoke emitters remain unchanged", () => {
    assert.equal(
      MOVEMENT_SMOKE_EMITTER[MOVEMENT_SMOKE_TRANSITION.DODGE_START],
      "dashStart"
    );
    assert.equal(
      MOVEMENT_SMOKE_EMITTER[MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT],
      "iceSlideRedirect"
    );
  });

  it("29. Raw dodge and slide-redirect keep separate baseline offsets", () => {
    assert.equal(DASH_SMOKE_SHEET_BASELINE_Y, 10);
    assert.equal(SLIDE_REDIRECT_SMOKE_PROFILE.sheetBaselineY, 0);
    assert.notEqual(
      DASH_SMOKE_SHEET_BASELINE_Y,
      SLIDE_REDIRECT_SMOKE_PROFILE.sheetBaselineY
    );
  });

  it("30. Rope Jump is not a defensive presentation profile", () => {
    assert.equal(getProfile("DEF_ROPE_JUMP"), null);
  });

  it("31. Low kick remains disabled and untouched", () => {
    assert.equal(LOW_KICK_ENABLED, false);
  });

  it("32. Debug / claim history remains bounded", () => {
    clearPresentationEvents();
    for (let i = 0; i < 300; i++) {
      claimPresentationEvent(`bound-${i}`);
    }
    assert.ok(presentationDedupeSize() <= 256);
  });

  it("33. Projectile raw parry uses DEF_RAW_PARRY on the incoming side", () => {
    // Thrower / projectile on the right of parrier → burst to the right of 400.
    const fromRight = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "snow-33-r",
      attacker: attacker({ x: 500, facing: -1 }),
      defender: defender({ x: 400 }),
      isPerfect: false,
      attackFamily: "snowball",
    });
    assert.equal(fromRight.profileId, PRESENTATION_PROFILE.DEF_RAW_PARRY);
    assert.equal(fromRight.outcome, DEFENSE_OUTCOME.RAW_PARRY);
    assert.equal(fromRight.y, GROUND_STRIKE_HIT_SPARK_Y);
    assert.ok(fromRight.x > 400, "effect should sit on the incoming (+X) side");
    assert.equal(fromRight.facingHint, -1);

    // Projectile on the left of parrier → burst to the left of 620.
    const fromLeft = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "snow-33-l",
      attacker: attacker({ x: 500, facing: 1 }),
      defender: defender({ x: 620 }),
      incomingDirection: -1,
      isPerfect: false,
      attackFamily: "pumo_army",
    });
    assert.ok(fromLeft.x < 620, "effect should sit on the incoming (-X) side");
    assert.equal(fromLeft.facingHint, 1);
  });
});

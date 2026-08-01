"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRESENTATION_EVENT_TYPE,
  PRESENTATION_PROFILE,
  PRESENTATION_ANCHOR,
  FALLBACK_LEVEL,
  CLINCH_INTERACTION,
  CLINCH_EFFECT_MID_Y,
  buildClinchPresentation,
  buildGroundStrikeContactPresentation,
  buildOffensiveAerialContactPresentation,
  attachCombatPresentation,
  selectClinchProfile,
  ensureClinchInstanceId,
  clearClinchInstanceId,
  mintEventId,
  getProfile,
  resolveAnchorPoint,
} = require("../../combatPresentationEvent");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
} = require("../../offensiveAerialOutcome");
const { CONTACT_AXIS } = require("../../offensiveAerialContact");
const { GROUND_LEVEL } = require("../../constants");
const { LOW_KICK_ENABLED } = require("../../constants");

function fighters() {
  return {
    a: { id: "a1", x: 500, y: GROUND_LEVEL, facing: -1, clinchInstanceId: null },
    b: { id: "b1", x: 620, y: GROUND_LEVEL, facing: 1, clinchInstanceId: null },
  };
}

describe("Phase 8 — clinch / grab / throw presentation", () => {
  it("1. Grab break emits once (stable event id)", () => {
    const { a, b } = fighters();
    const clinchId = ensureClinchInstanceId(a, b, 100);
    const e1 = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.GRAB_BREAK,
      clinchInstanceId: clinchId,
      actionInstanceId: "break-1",
      initiator: a,
      responder: b,
      contactX: 560,
      contactY: CLINCH_EFFECT_MID_Y,
      salt: "break",
    });
    const e2 = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.GRAB_BREAK,
      clinchInstanceId: clinchId,
      actionInstanceId: "break-1",
      initiator: a,
      responder: b,
      contactX: 560,
      contactY: CLINCH_EFFECT_MID_Y,
      salt: "break",
    });
    assert.ok(e1);
    assert.equal(e1.eventId, e2.eventId);
    assert.equal(e1.profileId, PRESENTATION_PROFILE.CLINCH_GRAB_BREAK);
  });

  it("2. Grab whiff has no successful contact presentation builder path", () => {
    // Whiff has no discrete clinch presentation interaction — null for unknown.
    assert.equal(
      buildClinchPresentation({ interactionType: "grab_whiff" }),
      null
    );
  });

  it("3. Clinch tech interaction selects CLINCH_TECH once per action id", () => {
    const { a, b } = fighters();
    const clinchId = ensureClinchInstanceId(a, b, 1);
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_TECH,
      clinchInstanceId: clinchId,
      actionInstanceId: "tech-1",
      initiator: a,
      responder: b,
      contactX: 560,
      salt: "tech",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_TECH);
    assert.equal(e.outcome, "RESOLVED");
  });

  it("4. Grab Counter selects CLINCH_COUNTER_GRAB", () => {
    assert.equal(
      selectClinchProfile(CLINCH_INTERACTION.COUNTER_GRAB),
      PRESENTATION_PROFILE.CLINCH_COUNTER_GRAB
    );
  });

  it("5. Drive has no continuous presentation interaction (no per-tick emit)", () => {
    assert.equal(buildClinchPresentation({ interactionType: "drive" }), null);
    assert.equal(buildClinchPresentation({ interactionType: "plant" }), null);
  });

  it("6. Plant/brace discrete path is perfect brace / throw fail only", () => {
    assert.equal(
      selectClinchProfile(CLINCH_INTERACTION.PERFECT_BRACE),
      PRESENTATION_PROFILE.CLINCH_PERFECT_BRACE
    );
    assert.equal(
      selectClinchProfile(CLINCH_INTERACTION.THROW_FAIL),
      PRESENTATION_PROFILE.CLINCH_THROW_FAIL
    );
  });

  it("7. Pull / jolt direction is preserved on movement axis", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "j1",
      initiator: a,
      responder: b,
      contactX: 560,
      movementX: 1,
      salt: "jolt",
    });
    assert.equal(e.approachX, 1);
    assert.equal(e.orientationSource, "MOVEMENT");
  });

  it("8. Simultaneous tech is one event per tech action id", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_TECH,
      clinchInstanceId: ensureClinchInstanceId(a, b, 2),
      actionInstanceId: "tech-simul",
      initiator: a,
      responder: b,
      contactX: 560,
      salt: "tech",
    });
    assert.equal(e.eventType, PRESENTATION_EVENT_TYPE.CLINCH);
    // One logical event — not a mirrored pair of profiles.
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_TECH);
  });

  it("9. Failed throw cannot select kill/launch profiles", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.THROW_FAIL,
      actionInstanceId: "fail-1",
      initiator: a,
      responder: b,
      outcome: "LAUNCH",
      contactX: 560,
      salt: "throw_fail",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_THROW_FAIL);
    assert.equal(e.outcome, "DEFENDED");
    assert.notEqual(e.profileId, PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAUNCH);
  });

  it("10. Perfect brace cannot select successful throw land", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.PERFECT_BRACE,
      actionInstanceId: "pb-1",
      initiator: b,
      responder: a,
      outcome: "LAND",
      contactX: 560,
      salt: "perfect_brace",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_PERFECT_BRACE);
    assert.equal(e.outcome, "DEFENDED");
  });

  it("11. Kill throw launch emits once", () => {
    const { a, b } = fighters();
    const e1 = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.KILL_THROW_LAUNCH,
      actionInstanceId: "launch-1",
      initiator: a,
      responder: b,
      contactX: b.x,
      movementX: 1,
      salt: "kill_launch",
    });
    const e2 = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.KILL_THROW_LAUNCH,
      actionInstanceId: "launch-1",
      initiator: a,
      responder: b,
      contactX: b.x,
      movementX: 1,
      salt: "kill_launch",
    });
    assert.equal(e1.eventId, e2.eventId);
    assert.equal(e1.profileId, PRESENTATION_PROFILE.CLINCH_KILL_THROW_LAUNCH);
  });

  it("12. Throw landing emits once", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.THROW_LAND,
      actionInstanceId: "land-1",
      initiator: a,
      responder: b,
      contactX: b.x,
      contactY: GROUND_LEVEL,
      salt: "throw_land",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_THROW_LAND);
    assert.equal(e.anchorType, PRESENTATION_ANCHOR.THROW_LANDING);
  });

  it("13. Throw release and landing have distinct ids", () => {
    const { a, b } = fighters();
    const launch = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.KILL_THROW_LAUNCH,
      actionInstanceId: "same-throw",
      initiator: a,
      responder: b,
      contactX: b.x,
      salt: "kill_launch",
    });
    const land = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.KILL_THROW_LAND,
      actionInstanceId: "same-throw",
      initiator: a,
      responder: b,
      contactX: b.x,
      contactY: GROUND_LEVEL,
      salt: "kill_land",
    });
    assert.notEqual(launch.eventId, land.eventId);
  });

  it("14. Break / Jolt use correct profiles", () => {
    assert.equal(
      selectClinchProfile(CLINCH_INTERACTION.GRAB_BREAK),
      PRESENTATION_PROFILE.CLINCH_GRAB_BREAK
    );
    assert.equal(
      selectClinchProfile(CLINCH_INTERACTION.CLINCH_JOLT),
      PRESENTATION_PROFILE.CLINCH_JOLT
    );
    assert.equal(
      selectClinchProfile(CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL),
      PRESENTATION_PROFILE.CLINCH_JOLT_MUTUAL
    );
  });

  it("15. Deep Grip metadata does not alter gameplay fields on attach", () => {
    const { a, b } = fighters();
    a.hasDeepGrip = false;
    const payload = { gripId: "g1", playerId: a.id };
    const event = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.DEEP_GRIP,
      actionInstanceId: "g1",
      initiator: a,
      responder: b,
      contactX: a.x,
      gripState: "deep",
      salt: "deep_grip",
    });
    attachCombatPresentation(payload, event);
    assert.equal(a.hasDeepGrip, false);
    assert.equal(payload.combatPresentation.gripState, "deep");
  });

  it("16. Left/right jolt mirrors movement sign", () => {
    const { a, b } = fighters();
    const right = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "jr",
      initiator: a,
      responder: b,
      contactX: 560,
      movementX: 1,
      salt: "jolt",
    });
    const left = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "jl",
      initiator: b,
      responder: a,
      contactX: 560,
      movementX: -1,
      salt: "jolt",
    });
    assert.equal(right.approachX, 1);
    assert.equal(left.approachX, -1);
  });

  it("17. Side reversal uses movement, not only root order", () => {
    const { a, b } = fighters();
    // Initiator on the right, still pushing left.
    a.x = 700;
    b.x = 500;
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "rev",
      initiator: a,
      responder: b,
      contactX: 600,
      movementX: -1,
      salt: "jolt",
    });
    assert.equal(e.approachX, -1);
  });

  it("18. World placement is snapshotted (x/y finite numbers on event)", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.GRAB_BREAK,
      actionInstanceId: "snap",
      initiator: a,
      responder: b,
      contactX: 555,
      contactY: CLINCH_EFFECT_MID_Y,
      salt: "break",
    });
    a.x = 999;
    b.x = 1111;
    assert.equal(e.x, 555);
    assert.equal(e.y, CLINCH_EFFECT_MID_Y);
  });

  it("19. Missing metadata follows fallback hierarchy", () => {
    const mid = resolveAnchorPoint({
      preferredAnchor: PRESENTATION_ANCHOR.CLINCH_SEAM,
      attackerX: 100,
      defenderX: 200,
    });
    assert.equal(mid.fallback, FALLBACK_LEVEL.OUTCOME_GEOMETRIC);
    assert.equal(mid.x, 150);
  });

  it("20. Invalid coordinates fail safely", () => {
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.GRAB_BREAK,
      actionInstanceId: "bad",
      initiator: { id: "a", x: NaN, y: Infinity, facing: 1 },
      responder: { id: "b", x: NaN, y: NaN },
      contactX: NaN,
      salt: "break",
    });
    assert.ok(Number.isFinite(e.x));
    assert.ok(Number.isFinite(e.y));
  });

  it("21. Same action id cannot mint a second distinct event (hitstop-safe)", () => {
    const id = mintEventId("clinch:a:break-1", PRESENTATION_EVENT_TYPE.CLINCH, "break");
    assert.equal(
      id,
      mintEventId("clinch:a:break-1", PRESENTATION_EVENT_TYPE.CLINCH, "break")
    );
  });

  it("22. clearClinchInstanceId clears ownership", () => {
    const { a, b } = fighters();
    ensureClinchInstanceId(a, b, 9);
    assert.ok(a.clinchInstanceId);
    clearClinchInstanceId(a, b);
    assert.equal(a.clinchInstanceId, null);
    assert.equal(b.clinchInstanceId, null);
  });

  it("23. Old clinch instance ids differ from newer ones", () => {
    const { a, b } = fighters();
    const id1 = ensureClinchInstanceId(a, b, 1);
    clearClinchInstanceId(a, b);
    const id2 = ensureClinchInstanceId(a, b, 2);
    assert.notEqual(id1, id2);
  });

  it("24. Attach is no-op without event (presentation disabled path)", () => {
    const payload = { breakId: "x" };
    attachCombatPresentation(payload, null);
    assert.equal(payload.combatPresentation, undefined);
  });

  it("25. Rematch/reset contract: fresh clinch ids after clear", () => {
    const { a, b } = fighters();
    ensureClinchInstanceId(a, b, 10);
    clearClinchInstanceId(a, b);
    const next = ensureClinchInstanceId(a, b, 11);
    assert.match(next, /^clinch:/);
  });

  it("26. Presentation attach does not mutate clinch gameplay flags", () => {
    const { a, b } = fighters();
    a.inClinch = true;
    a.isClinchPushing = true;
    const payload = { type: "mutual" };
    attachCombatPresentation(
      payload,
      buildClinchPresentation({
        interactionType: CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL,
        actionInstanceId: "m1",
        initiator: a,
        responder: b,
        contactX: 560,
        salt: "jolt_mutual",
      })
    );
    assert.equal(a.inClinch, true);
    assert.equal(a.isClinchPushing, true);
    assert.ok(payload.combatPresentation);
  });

  it("27. Offensive-aerial presentation remains unchanged", () => {
    assert.equal(getProfile(PRESENTATION_PROFILE.OA_FLAP_HIT).spriteKey, "flap");
    const oa = buildOffensiveAerialContactPresentation({
      eventType: "OA_HIT",
      attacker: {
        id: "a",
        x: 500,
        y: 200,
        facing: -1,
        offensiveAerial: {
          attackInstanceId: "a:oa:1",
          moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
        },
      },
      defender: { id: "d", x: 560, y: GROUND_LEVEL },
      contact: {
        contactX: 530,
        contactY: 180,
        contactNormalX: -1,
        contactNormalY: 0,
        contactAxis: CONTACT_AXIS.LATERAL,
      },
      salt: "hit",
    });
    assert.equal(oa.profileId, PRESENTATION_PROFILE.OA_FLAP_HIT);
  });

  it("28. Ground-strike presentation remains unchanged", () => {
    const e = buildGroundStrikeContactPresentation({
      eventType: "GS_HIT",
      attacker: {
        id: "a",
        x: 500,
        y: GROUND_LEVEL,
        facing: -1,
        isSlapAttack: true,
        attackType: "slap",
      },
      defender: { id: "d", x: 620, y: GROUND_LEVEL },
      contactX: 560,
      isSlapAttack: true,
      hitId: "s1",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.GS_SLAP_HIT);
  });

  it("29. Low kick remains disabled", () => {
    assert.equal(LOW_KICK_ENABLED, false);
  });

  it("30. Rope Jump profiles are untouched (no clinch overwrite of OA land)", () => {
    assert.equal(
      getProfile(PRESENTATION_PROFILE.OA_SLIDE_JUMP_TOUCHDOWN).particleSupplement,
      "throwLand"
    );
  });

  it("31. Debug-sized events stay bounded (no history arrays)", () => {
    const { a, b } = fighters();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.GRAB_BREAK,
      actionInstanceId: "dbg",
      initiator: a,
      responder: b,
      contactX: 560,
      salt: "break",
    });
    assert.ok(Object.keys(e).length < 45);
    assert.equal(e.history, undefined);
  });
});

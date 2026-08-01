"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRESENTATION_EVENT_TYPE,
  PRESENTATION_PROFILE,
  PRESENTATION_ANCHOR,
  FALLBACK_LEVEL,
  buildOffensiveAerialContactPresentation,
  buildOffensiveAerialTouchdownPresentation,
  attachCombatPresentation,
  resolveAnchorPoint,
  applyLocalOffset,
  selectHitProfile,
  selectParryProfile,
  mintEventId,
  getProfile,
} = require("../../combatPresentationEvent");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
  OFFENSIVE_AERIAL_OUTCOME,
} = require("../../offensiveAerialOutcome");
const { GROUND_LEVEL } = require("../../constants");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  armDefenderParry,
} = require("./helpers/slideJumpSim");
const {
  setOffensiveAerialReactionV2ForTests,
  setOffensiveAerialReactionPresetForTests,
} = require("../../offensiveAerialFlags");
const { CONTACT_AXIS } = require("../../offensiveAerialContact");

function v2(opts = {}) {
  return createSlideJumpScenario({ ...opts, reactionV2: true });
}

describe("Phase 6 — combat presentation events (offensive aerial)", () => {
  beforeEach(() => {
    setOffensiveAerialReactionV2ForTests(true);
    setOffensiveAerialReactionPresetForTests("heavy_short");
  });

  it("1. One resolved hit creates one logical presentation event id", () => {
    const attacker = {
      id: "a1",
      x: 500,
      y: 200,
      facing: -1,
      offensiveAerial: {
        attackInstanceId: "a1:oa:1",
        moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
      },
    };
    const defender = { id: "d1", x: 560, y: GROUND_LEVEL };
    const contact = {
      contactX: 530,
      contactY: 180,
      contactNormalX: -1,
      contactNormalY: 0,
      contactAxis: CONTACT_AXIS.LATERAL,
    };
    const e1 = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
      attacker,
      defender,
      contact,
      salt: "hit",
    });
    const e2 = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
      attacker,
      defender,
      contact,
      salt: "hit",
    });
    assert.equal(e1.eventId, e2.eventId);
    assert.equal(e1.eventType, PRESENTATION_EVENT_TYPE.OA_HIT);
  });

  it("2. FLAP hit selects OA_FLAP_HIT profile", () => {
    const attacker = {
      slideJumpDiveCommitted: false,
      offensiveAerial: { moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP },
    };
    assert.equal(selectHitProfile(attacker), PRESENTATION_PROFILE.OA_FLAP_HIT);
  });

  it("3. FLAP parry selects OA_FLAP_PARRY profile", () => {
    const attacker = {
      slideJumpDiveCommitted: false,
      offensiveAerial: { moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP },
    };
    assert.equal(selectParryProfile(attacker), PRESENTATION_PROFILE.OA_FLAP_PARRY);
  });

  it("4. S-dive hit selects OA_DIVE_HIT profile", () => {
    const attacker = {
      slideJumpDiveCommitted: true,
      offensiveAerial: { moveType: OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE },
    };
    assert.equal(selectHitProfile(attacker), PRESENTATION_PROFILE.OA_DIVE_HIT);
  });

  it("5. S-dive parry selects OA_DIVE_PARRY profile", () => {
    const attacker = {
      slideJumpDiveCommitted: true,
      offensiveAerial: { moveType: OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE },
    };
    assert.equal(selectParryProfile(attacker), PRESENTATION_PROFILE.OA_DIVE_PARRY);
  });

  it("6. Touchdown selects ground anchor", () => {
    const e = buildOffensiveAerialTouchdownPresentation({
      attacker: {
        id: "a",
        x: 500,
        y: GROUND_LEVEL + 1,
        facing: -1,
        slideJumpDiveCommitted: true,
        offensiveAerial: { attackInstanceId: "a:oa:2" },
      },
      dive: true,
      salt: "1",
    });
    assert.equal(e.anchorType, PRESENTATION_ANCHOR.GROUND_CONTACT);
    assert.equal(e.y, GROUND_LEVEL);
    assert.equal(e.profileId, PRESENTATION_PROFILE.OA_DIVE_TOUCHDOWN);
    assert.equal(e.particleSupplement, "flapFastFallLand");
  });

  it("7. Plain slide-jump does not emit attack-contact presentation on land", () => {
    const s = v2({ attackerX: 400, defenderX: 700 });
    assert.equal(s.attacker.offensiveAerial, null);
    const e = buildOffensiveAerialTouchdownPresentation({
      attacker: s.attacker,
      salt: "plain",
    });
    assert.notEqual(e.eventType, PRESENTATION_EVENT_TYPE.OA_HIT);
    assert.notEqual(e.profileId, PRESENTATION_PROFILE.OA_FLAP_HIT);
    assert.equal(e.profileId, PRESENTATION_PROFILE.OA_SLIDE_JUMP_TOUCHDOWN);
  });

  it("8. Contact point survives attach/projection", () => {
    const event = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
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
      contact: { contactX: 533.5, contactY: 177.25, contactNormalX: -1, contactNormalY: 0.2 },
      salt: "hit",
    });
    const payload = attachCombatPresentation({ attackType: "flap" }, event);
    assert.equal(payload.combatPresentation.x, event.x);
    assert.equal(payload.combatPresentation.y, event.y);
    assert.equal(payload.combatPresentation.eventId, event.eventId);
    assert.ok(Number.isFinite(payload.combatPresentation.x));
    assert.ok(Number.isFinite(payload.combatPresentation.y));
  });

  it("9. Contact normal drives orientation / facing hint", () => {
    const event = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
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
      contact: { contactX: 530, contactY: 180, contactNormalX: 1, contactNormalY: 0 },
      salt: "hit",
    });
    assert.equal(event.orientationSource, "CONTACT_NORMAL");
    assert.equal(event.contactNormalX, 1);
    assert.equal(event.facingHint, -1);
  });

  it("10. Left/right cases mirror local offset consistently", () => {
    const profile = getProfile(PRESENTATION_PROFILE.OA_FLAP_PARRY);
    const left = applyLocalOffset({ x: 100, y: 100 }, profile, -1);
    const right = applyLocalOffset({ x: 100, y: 100 }, profile, 1);
    assert.equal(left.x, 100 - 28);
    assert.equal(right.x, 100 + 28);
  });

  it("11. Cross-up uses contact normal, not root order alone", () => {
    // Attacker now on right of defender, but contact normal still -1 (from left impact).
    const event = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
      attacker: {
        id: "a",
        x: 620,
        y: 180,
        facing: 1,
        offensiveAerial: {
          attackInstanceId: "a:oa:1",
          moveType: OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
        },
      },
      defender: { id: "d", x: 560, y: GROUND_LEVEL },
      contact: {
        contactX: 580,
        contactY: 170,
        contactNormalX: -1,
        contactNormalY: 0,
      },
      salt: "hit",
    });
    assert.equal(event.contactNormalX, -1);
    assert.equal(event.x, 580);
    assert.equal(event.facingHint, 1);
  });

  it("12. Same-center fallback is deterministic", () => {
    const a = resolveAnchorPoint({
      attackerX: 500,
      attackerY: 200,
      defenderX: 500,
      defenderY: GROUND_LEVEL,
    });
    const b = resolveAnchorPoint({
      attackerX: 500,
      attackerY: 200,
      defenderX: 500,
      defenderY: GROUND_LEVEL,
    });
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
    assert.equal(a.fallback, FALLBACK_LEVEL.ROOT_MIDPOINT);
  });

  it("13. Missing metadata follows fallback hierarchy", () => {
    const surface = resolveAnchorPoint({
      contactX: 10,
      contactY: 20,
    });
    assert.equal(surface.fallback, FALLBACK_LEVEL.SURFACE_CONTACT);
    const surfAnchor = resolveAnchorPoint({
      attackerContactX: 11,
      attackerContactY: 21,
    });
    assert.equal(surfAnchor.fallback, FALLBACK_LEVEL.SURFACE_ANCHOR);
    const mid = resolveAnchorPoint({
      attackerX: 100,
      defenderX: 200,
      attackerY: 50,
      defenderY: 50,
    });
    assert.equal(mid.fallback, FALLBACK_LEVEL.ROOT_MIDPOINT);
    assert.equal(mid.x, 150);
  });

  it("14. Invalid coordinates fail safely (finite placement)", () => {
    const event = buildOffensiveAerialContactPresentation({
      eventType: PRESENTATION_EVENT_TYPE.OA_HIT,
      attacker: {
        id: "a",
        x: NaN,
        y: Infinity,
        facing: -1,
        offensiveAerial: { attackInstanceId: "a:oa:1" },
      },
      defender: { id: "d", x: 560, y: GROUND_LEVEL },
      contact: { contactX: NaN, contactY: NaN },
      salt: "hit",
    });
    assert.ok(Number.isFinite(event.x));
    assert.ok(Number.isFinite(event.y));
  });

  it("15. Event ids are stable for the same action salt", () => {
    assert.equal(
      mintEventId("a:oa:1", "OA_HIT", "hit"),
      mintEventId("a:oa:1", "OA_HIT", "hit")
    );
  });

  it("16. Old action instances mint distinct event ids", () => {
    assert.notEqual(
      mintEventId("a:oa:1", "OA_HIT", "hit"),
      mintEventId("a:oa:2", "OA_HIT", "hit")
    );
  });

  it("17. Hit then parry events remain distinctly ordered by type", () => {
    const hit = mintEventId("a:oa:1", "OA_HIT", "hit");
    const parry = mintEventId("a:oa:1", "OA_PARRY", "parry");
    assert.notEqual(hit, parry);
  });

  it("18–19. Live HIT / PARRY attach combatPresentation on socket payload shape", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 45, dive: true });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial?.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    const hits = s.io.find("player_hit");
    assert.ok(hits.length >= 1);
    const cp = hits[0].payload.combatPresentation;
    assert.ok(cp);
    assert.equal(cp.eventType, PRESENTATION_EVENT_TYPE.OA_HIT);
    assert.ok(cp.profileId === PRESENTATION_PROFILE.OA_DIVE_HIT || cp.profileId === PRESENTATION_PROFILE.OA_FLAP_HIT);
    assert.ok(Number.isFinite(cp.x) && Number.isFinite(cp.y));

    const s2 = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s2, { height: 45, dive: true });
    armDefenderParry(s2.defender, s2.room.simTime || 0, "regular");
    stepSlideJumpTick(s2);
    const parries = s2.io.find("raw_parry_success");
    assert.ok(parries.length >= 1);
    const pcp = parries[0].payload.combatPresentation;
    assert.ok(pcp);
    assert.equal(pcp.eventType, PRESENTATION_EVENT_TYPE.OA_PARRY);
  });

  it("20. Profiles preserve flap sprite key / dive particle identity", () => {
    assert.equal(getProfile(PRESENTATION_PROFILE.OA_FLAP_HIT).spriteKey, "flap");
    assert.equal(getProfile(PRESENTATION_PROFILE.OA_DIVE_HIT).spriteKey, "flap");
    assert.equal(
      getProfile(PRESENTATION_PROFILE.OA_DIVE_TOUCHDOWN).particleSupplement,
      "flapFastFallLand"
    );
    assert.equal(
      getProfile(PRESENTATION_PROFILE.OA_SLIDE_JUMP_TOUCHDOWN).particleSupplement,
      "throwLand"
    );
  });

  it("21. Particle supplements are single-named (spawn-once contract)", () => {
    for (const id of Object.values(PRESENTATION_PROFILE)) {
      const p = getProfile(id);
      if (p.particleSupplement != null) {
        assert.equal(typeof p.particleSupplement, "string");
      }
    }
  });

  it("25. Gameplay HIT resolution unchanged when presentation attaches", () => {
    const s = v2({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50, dive: true });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    const hit = s.io.find("player_hit")[0]?.payload;
    assert.ok(hit);
    assert.equal(hit.attackType, "flap");
    assert.ok(hit.combatPresentation);
    assert.equal(hit.combatPresentation.outcome, "HIT");
  });
});

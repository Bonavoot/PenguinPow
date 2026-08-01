"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRESENTATION_EVENT_TYPE,
  PRESENTATION_PROFILE,
  DEFENSE_OUTCOME,
  DEFENSE_TYPE,
  PROJECTILE_TYPE,
  PROJECTILE_LIFECYCLE,
  PROJECTILE_OUTCOME,
  GROUND_STRIKE_HIT_SPARK_Y,
  buildProjectilePresentation,
  buildDefensivePresentation,
  buildClinchPresentation,
  attachCombatPresentation,
  getProfile,
  CLINCH_INTERACTION,
} = require("../../combatPresentationEvent");
const { GROUND_LEVEL, LOW_KICK_ENABLED } = require("../../constants");
const {
  DASH_SMOKE_SHEET_BASELINE_Y,
  SLIDE_REDIRECT_SMOKE_PROFILE,
  createMovementSmokeClaimStore,
} = require("../../movementSmokePresentation");

const { claimPresentationEvent, clearPresentationEvents, presentationDedupeSize } =
  (() => {
    const store = createMovementSmokeClaimStore(256);
    return {
      claimPresentationEvent: (id) => store.claim(id),
      clearPresentationEvents: () => store.clear(),
      presentationDedupeSize: () => store.size(),
    };
  })();

function snowballHit(overrides = {}) {
  return buildProjectilePresentation({
    projectileType: PROJECTILE_TYPE.SNOWBALL,
    lifecycleStage: PROJECTILE_LIFECYCLE.HIT,
    projectileInstanceId: "sb-1",
    ownerId: "owner",
    targetId: "victim",
    contactX: 540,
    contactY: GROUND_LEVEL + 50,
    approachDirection: 1,
    terminalX: 540,
    terminalY: GROUND_LEVEL + 20,
    attackerFacing: 1,
    salt: "hit",
    ...overrides,
  });
}

describe("Phase 10 — projectile combat presentation", () => {
  it("1. Snowball hit emits once with stable identity", () => {
    const e = snowballHit();
    assert.ok(e);
    assert.equal(e.eventType, PRESENTATION_EVENT_TYPE.PROJECTILE);
    assert.equal(e.profileId, PRESENTATION_PROFILE.PROJ_SNOWBALL_HIT);
    assert.equal(e.lifecycleStage, PROJECTILE_LIFECYCLE.HIT);
    assert.equal(e.outcome, PROJECTILE_OUTCOME.HIT);
    assert.equal(e.projectileInstanceId, "sb-1");
    const e2 = snowballHit();
    assert.equal(e.eventId, e2.eventId);
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("2. Travel ticks do not produce discrete launch/hit events", () => {
    // No builder for travel — continuous ownership only.
    const travel = buildProjectilePresentation({
      projectileType: PROJECTILE_TYPE.SNOWBALL,
      lifecycleStage: "TRAVEL",
      projectileInstanceId: "sb-travel",
    });
    assert.equal(travel, null);
    const launch = buildProjectilePresentation({
      projectileType: PROJECTILE_TYPE.SNOWBALL,
      lifecycleStage: "LAUNCH",
      projectileInstanceId: "sb-launch",
    });
    assert.equal(launch, null);
  });

  it("3. Snowball hit pins X to projectile contact (not player root +70)", () => {
    const e = snowballHit({ contactX: 512.5, contactY: 400 });
    assert.equal(e.x, 512.5);
    assert.equal(e.y, 400);
  });

  it("4. Snowball parry does not share hit profile", () => {
    const hit = snowballHit({ projectileInstanceId: "sb-parry-hit" });
    const parry = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "sb-parry-hit:raw_parry",
      incomingActionInstanceId: "sb-parry-hit",
      attacker: { id: "o", x: 500, facing: -1 },
      defender: { id: "d", x: 620, facing: 1 },
      incomingDirection: -1,
      attackFamily: PROJECTILE_TYPE.SNOWBALL,
    });
    assert.notEqual(hit.profileId, parry.profileId);
    assert.notEqual(hit.eventType, parry.eventType);
    assert.equal(parry.outcome, DEFENSE_OUTCOME.RAW_PARRY);
  });

  it("5. Left-incoming raw parry sits on -X side", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "clone-l:raw_parry",
      attacker: { id: "a", x: 500 },
      defender: { id: "d", x: 620 },
      incomingDirection: -1,
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
    });
    assert.ok(e.x < 620);
    assert.equal(e.facingHint, 1);
  });

  it("6. Right-incoming raw parry mirrors on +X side", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "sb-r:raw_parry",
      attacker: { id: "a", x: 500 },
      defender: { id: "d", x: 400 },
      incomingDirection: 1,
      attackFamily: PROJECTILE_TYPE.SNOWBALL,
    });
    assert.ok(e.x > 400);
    assert.equal(e.facingHint, -1);
  });

  it("7. Perfect parry preserves DEF_RAW_PARRY composition", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "sb-pp:raw_parry",
      attacker: { id: "a", x: 500 },
      defender: { id: "d", x: 400 },
      incomingDirection: 1,
      isPerfect: true,
      attackFamily: PROJECTILE_TYPE.SNOWBALL,
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.DEF_RAW_PARRY);
    assert.equal(e.outcome, DEFENSE_OUTCOME.PERFECT_PARRY);
    assert.equal(e.timingGrade, "perfect");
    assert.equal(e.y, GROUND_STRIKE_HIT_SPARK_Y);
  });

  it("8. Absorb emits once with projectile instance identity", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GRAB_ARMOR_ABSORB,
      defenseInstanceId: "sb-abs:absorb",
      incomingActionInstanceId: "sb-abs",
      defender: { id: "d", x: 600, y: GROUND_LEVEL, facing: 1 },
      attacker: { id: "a", x: 500 },
      contactX: 555,
      contactY: GROUND_LEVEL + 20,
      attackFamily: PROJECTILE_TYPE.SNOWBALL,
      salt: "absorb",
    });
    assert.ok(e);
    assert.equal(e.outcome, DEFENSE_OUTCOME.ABSORB);
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_GRAB_ARMOR_ABSORB);
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("9. Absorb cannot incorrectly become ordinary hit", () => {
    const absorb = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GRAB_ARMOR_ABSORB,
      defenseInstanceId: "sb-abs2:absorb",
      incomingActionInstanceId: "sb-abs2",
      defender: { id: "d", x: 600, y: GROUND_LEVEL },
      contactX: 560,
      attackFamily: PROJECTILE_TYPE.SNOWBALL,
    });
    const hit = snowballHit({ projectileInstanceId: "sb-abs2" });
    assert.notEqual(absorb.profileId, hit.profileId);
    assert.notEqual(absorb.outcome, hit.outcome);
  });

  it("10. Destruction/terminal position is snapshotted on hit event", () => {
    const e = snowballHit({
      contactX: 700,
      terminalX: 700,
      terminalY: 340,
    });
    assert.equal(e.terminalX, 700);
    assert.equal(e.terminalY, 340);
    assert.equal(e.x, 700);
  });

  it("11. Expiration has no discrete FX (state cleanup only)", () => {
    assert.equal(
      buildProjectilePresentation({
        projectileType: PROJECTILE_TYPE.SNOWBALL,
        lifecycleStage: PROJECTILE_LIFECYCLE.EXPIRE,
        projectileInstanceId: "sb-exp",
      }),
      null
    );
  });

  it("12. Boundary has no invented discrete FX", () => {
    assert.equal(
      buildProjectilePresentation({
        projectileType: PROJECTILE_TYPE.SNOWBALL,
        lifecycleStage: PROJECTILE_LIFECYCLE.BOUNDARY,
        projectileInstanceId: "sb-bnd",
      }),
      null
    );
  });

  it("13. Destroyed projectile cannot replay the same hit eventId", () => {
    const e = snowballHit({ projectileInstanceId: "sb-once" });
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("14. PUMO Army clones have distinct stable identities", () => {
    const a = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "clone-a:raw_parry",
      incomingActionInstanceId: "clone-a",
      attacker: { x: 400 },
      defender: { x: 600 },
      incomingDirection: -1,
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
    });
    const b = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "clone-b:raw_parry",
      incomingActionInstanceId: "clone-b",
      attacker: { x: 400 },
      defender: { x: 600 },
      incomingDirection: -1,
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
    });
    assert.notEqual(a.eventId, b.eventId);
    assert.notEqual(a.defenseInstanceId, b.defenseInstanceId);
  });

  it("15. One clone cannot dedupe another", () => {
    const a = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GRAB_ARMOR_ABSORB,
      defenseInstanceId: "clone-a:absorb",
      incomingActionInstanceId: "clone-a",
      defender: { id: "d", x: 600, y: GROUND_LEVEL },
      contactX: 580,
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
      salt: "absorb",
    });
    const b = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GRAB_ARMOR_ABSORB,
      defenseInstanceId: "clone-b:absorb",
      incomingActionInstanceId: "clone-b",
      defender: { id: "d", x: 600, y: GROUND_LEVEL },
      contactX: 590,
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
      salt: "absorb",
    });
    assert.equal(claimPresentationEvent(a.eventId), true);
    assert.equal(claimPresentationEvent(b.eventId), true);
  });

  it("16. Clone hit/parry/absorb outcomes remain exclusive", () => {
    const parry = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "c1:raw_parry",
      incomingActionInstanceId: "c1",
      attacker: { x: 500 },
      defender: { x: 620 },
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
    });
    const absorb = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.GRAB_ARMOR_ABSORB,
      defenseInstanceId: "c1:absorb",
      incomingActionInstanceId: "c1",
      defender: { id: "d", x: 620, y: GROUND_LEVEL },
      contactX: 600,
      attackFamily: PROJECTILE_TYPE.PUMO_ARMY,
    });
    assert.notEqual(parry.outcome, absorb.outcome);
    assert.notEqual(parry.profileId, absorb.profileId);
    // No discrete pumo hit presentation (state-owned hit reaction only).
    assert.equal(
      buildProjectilePresentation({
        projectileType: PROJECTILE_TYPE.PUMO_ARMY,
        lifecycleStage: PROJECTILE_LIFECYCLE.HIT,
        projectileInstanceId: "c1",
      }),
      null
    );
  });

  it("17. Repeated attach/replication cannot invent a second event id", () => {
    const e = snowballHit({ projectileInstanceId: "sb-rep" });
    const p1 = attachCombatPresentation({ hitId: `${e.projectileInstanceId}:hit` }, e);
    const p2 = attachCombatPresentation({ hitId: `${e.projectileInstanceId}:hit` }, e);
    assert.equal(p1.combatPresentation.eventId, p2.combatPresentation.eventId);
  });

  it("18. Prediction confirmation cannot duplicate (claim gate)", () => {
    // No projectile outcome prediction — claim still gates retransmit.
    const e = snowballHit({ projectileInstanceId: "sb-pred" });
    assert.equal(claimPresentationEvent(e.eventId), true);
    assert.equal(claimPresentationEvent(e.eventId), false);
  });

  it("19. Rejected prediction leaves no false effect (clear restores)", () => {
    clearPresentationEvents();
    assert.equal(presentationDedupeSize(), 0);
    assert.equal(claimPresentationEvent("never-confirmed"), true);
    clearPresentationEvents();
    assert.equal(presentationDedupeSize(), 0);
  });

  it("20. Reset clears projectile presentation claims", () => {
    claimPresentationEvent(snowballHit().eventId);
    assert.ok(presentationDedupeSize() >= 1);
    clearPresentationEvents();
    assert.equal(presentationDedupeSize(), 0);
  });

  it("21. Rematch clears dedupe", () => {
    const id = snowballHit({ projectileInstanceId: "sb-rematch" }).eventId;
    claimPresentationEvent(id);
    clearPresentationEvents();
    assert.equal(claimPresentationEvent(id), true);
  });

  it("22. Owner disconnect identity remains finite (no Date.now in eventId)", () => {
    const e = snowballHit({ projectileInstanceId: "sb-dc" });
    assert.ok(!/^\d{10,}/.test(e.eventId));
    assert.ok(e.eventId.includes("sb-dc"));
  });

  it("23. Presentation attach is observational (payload fields only)", () => {
    const fighter = { id: "v", x: 600, stamina: 80, isHit: false };
    const e = snowballHit({ targetId: fighter.id });
    attachCombatPresentation({ hitId: "x" }, e);
    assert.equal(fighter.stamina, 80);
    assert.equal(fighter.isHit, false);
  });

  it("24. Defensive presentation profiles remain registered", () => {
    assert.ok(getProfile(PRESENTATION_PROFILE.DEF_BLOCK));
    assert.ok(getProfile(PRESENTATION_PROFILE.DEF_RAW_PARRY));
    assert.ok(getProfile(PRESENTATION_PROFILE.DEF_MATADOR));
  });

  it("25. Clinch presentation remains unchanged", () => {
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "j-proj-25",
      initiator: { id: "a", x: 500, y: GROUND_LEVEL, facing: -1 },
      responder: { id: "b", x: 620, y: GROUND_LEVEL, facing: 1 },
      movementX: 1,
      salt: "jolt",
    });
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_JOLT);
  });

  it("26. Movement smoke baselines remain separate", () => {
    assert.equal(DASH_SMOKE_SHEET_BASELINE_Y, 10);
    assert.equal(SLIDE_REDIRECT_SMOKE_PROFILE.sheetBaselineY, 0);
  });

  it("27. Rope Jump is not a projectile presentation profile", () => {
    assert.equal(getProfile("ROPE_JUMP"), null);
    assert.equal(getProfile("PROJ_ROPE_JUMP"), null);
  });

  it("28. Low kick remains disabled", () => {
    assert.equal(LOW_KICK_ENABLED, false);
  });

  it("29. Compact attach carries projectile lifecycle fields", () => {
    const e = snowballHit();
    const payload = attachCombatPresentation({ hitId: "h" }, e);
    const cp = payload.combatPresentation;
    assert.equal(cp.projectileInstanceId, "sb-1");
    assert.equal(cp.projectileType, PROJECTILE_TYPE.SNOWBALL);
    assert.equal(cp.lifecycleStage, PROJECTILE_LIFECYCLE.HIT);
    assert.equal(cp.ownerId, "owner");
    assert.equal(cp.targetId, "victim");
    assert.equal(cp.terminalX, 540);
  });

  it("30. Approach direction mirrors left vs right snowball hits", () => {
    const right = snowballHit({
      projectileInstanceId: "sb-dir-r",
      approachDirection: 1,
      contactX: 600,
    });
    const left = snowballHit({
      projectileInstanceId: "sb-dir-l",
      approachDirection: -1,
      contactX: 600,
    });
    assert.equal(right.approachX, 1);
    assert.equal(left.approachX, -1);
  });
});

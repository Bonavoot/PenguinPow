"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  POSE_REGISTRY,
  listPoseKeys,
  getPoseRegistration,
  poseKeyFromSrc,
  poseKeyFromPresentationState,
  resolvePoseRender,
  measurePoseTransitionPop,
  createPoseTransitionDiagStore,
  isPoseGeometryV2Enabled,
  SPRITE_WORLD_SIZE,
} = require("../../poseRegistration");
const {
  DASH_SMOKE_SHEET_BASELINE_Y,
  SLIDE_REDIRECT_SMOKE_PROFILE,
} = require("../../movementSmokePresentation");
const {
  PRESENTATION_PROFILE,
  buildDefensivePresentation,
  DEFENSE_TYPE,
  CLINCH_GRIP_CONTACT_Y,
  buildClinchPresentation,
  CLINCH_INTERACTION,
} = require("../../combatPresentationEvent");
const { LOW_KICK_ENABLED, GROUND_LEVEL } = require("../../constants");

describe("Phase 11 — pose geometry registration", () => {
  const prev = process.env.FIGHTER_POSE_GEOMETRY_V2;
  beforeEach(() => {
    delete process.env.FIGHTER_POSE_GEOMETRY_V2;
  });
  afterEach(() => {
    if (prev == null) delete process.env.FIGHTER_POSE_GEOMETRY_V2;
    else process.env.FIGHTER_POSE_GEOMETRY_V2 = prev;
  });

  it("0a. Unset flag selects V2", () => {
    assert.equal(isPoseGeometryV2Enabled(undefined), true);
    assert.equal(isPoseGeometryV2Enabled(""), true);
    assert.equal(isPoseGeometryV2Enabled(), true);
  });

  it("0b. 1 and true select V2", () => {
    assert.equal(isPoseGeometryV2Enabled("1"), true);
    assert.equal(isPoseGeometryV2Enabled("true"), true);
    assert.equal(isPoseGeometryV2Enabled(true), true);
  });

  it("0c. 0 and false select legacy", () => {
    assert.equal(isPoseGeometryV2Enabled("0"), false);
    assert.equal(isPoseGeometryV2Enabled("false"), false);
    assert.equal(isPoseGeometryV2Enabled(false), false);
  });

  it("0d. Legacy rollback keeps render equal to gameplay root", () => {
    const r = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: 512,
      gameplayY: GROUND_LEVEL + 40,
      facing: 1,
      v2Enabled: false,
    });
    assert.equal(r.v2, false);
    assert.equal(r.renderX, 512);
    assert.equal(r.renderY, GROUND_LEVEL + 40);
    assert.equal(r.appliedOffsetX, 0);
    assert.equal(r.appliedOffsetY, 0);
  });

  it("1. Every registered grounded pose resolves deterministically", () => {
    for (const key of listPoseKeys()) {
      const reg = getPoseRegistration(key);
      if (!reg.grounded) continue;
      const a = resolvePoseRender({
        poseKey: key,
        gameplayX: 500,
        gameplayY: GROUND_LEVEL,
        facing: -1,
        v2Enabled: true,
      });
      const b = resolvePoseRender({
        poseKey: key,
        gameplayX: 500,
        gameplayY: GROUND_LEVEL,
        facing: -1,
        v2Enabled: true,
      });
      assert.equal(a.renderX, b.renderX);
      assert.equal(a.renderY, b.renderY);
      assert.equal(a.grounded, true);
    }
  });

  it("2. Every registered airborne pose resolves without ground snap", () => {
    for (const key of listPoseKeys()) {
      const reg = getPoseRegistration(key);
      if (reg.grounded) continue;
      const r = resolvePoseRender({
        poseKey: key,
        gameplayX: 500,
        gameplayY: GROUND_LEVEL + 80,
        facing: 1,
        airborneHint: true,
        v2Enabled: true,
      });
      assert.equal(r.grounded, false);
      assert.equal(r.renderY, GROUND_LEVEL + 80);
      assert.equal(r.appliedOffsetY, 0);
    }
  });

  it("3. Charged flying headbutt keeps legacy Y (intentional airborne)", () => {
    const legacy = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: false,
    });
    const v2 = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    assert.equal(POSE_REGISTRY.charged_attack.grounded, false);
    assert.equal(legacy.renderY, GROUND_LEVEL);
    assert.equal(v2.renderY, GROUND_LEVEL);
    assert.equal(v2.appliedOffsetY, 0);
    assert.equal(v2.grounded, false);
  });

  it("4. Airborne flap is not ground-snapped even with high padB art", () => {
    const r = resolvePoseRender({
      poseKey: "flap_1",
      gameplayX: 640,
      gameplayY: 400,
      airborneHint: true,
      v2Enabled: true,
    });
    assert.equal(r.renderY, 400);
  });

  it("5. Mirroring preserves charged flight height (no sole correction)", () => {
    const L = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL + 20,
      facing: 1,
      v2Enabled: true,
    });
    const R = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL + 20,
      facing: -1,
      v2Enabled: true,
    });
    assert.equal(L.renderY, R.renderY);
    assert.equal(L.appliedOffsetY, 0);
    assert.equal(R.appliedOffsetY, 0);
  });

  it("6. Mirroring preserves intended pivot X when offset is zero", () => {
    const L = resolvePoseRender({
      poseKey: "idle",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      facing: 1,
      v2Enabled: true,
    });
    const R = resolvePoseRender({
      poseKey: "idle",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      facing: -1,
      v2Enabled: true,
    });
    assert.equal(L.renderX, R.renderX);
    assert.equal(L.pivotX, 0.5);
  });

  it("7. Idle↔movement transition pop is ~0 under V2", () => {
    const pop = measurePoseTransitionPop("idle", "waddle");
    assert.ok(pop.absDx < 1);
    assert.ok(pop.absDy < 1);
  });

  it("8. Idle↔crouch transition pop is ~0 under V2", () => {
    const pop = measurePoseTransitionPop("idle", "crouch");
    assert.ok(pop.absDx < 1);
    assert.ok(pop.absDy < 1);
  });

  it("9. Slap-chain transitions preserve visual root", () => {
    for (const [a, b] of [
      ["idle", "slap_blur_1"],
      ["slap_blur_1", "slap_hit_1"],
      ["slap_hit_1", "slap_blur_2"],
      ["slap_blur_2", "slap_hit_2"],
    ]) {
      const pop = measurePoseTransitionPop(a, b);
      assert.ok(pop.absDy < 1, `${a}→${b} dy=${pop.dy}`);
    }
  });

  it("10. Palm / charged recovery preserve root (no invented offsets)", () => {
    assert.ok(measurePoseTransitionPop("palm", "recovering").absDy < 1);
    // Flight→recovery vertical change is authoritative touchdown/state, not V2.
    const pop = measurePoseTransitionPop("charged_attack", "recovering");
    assert.equal(pop.absDy, 0, "registry applies 0 offset on both poses");
  });

  it("11. Dodge→slide: dodge airborne offset 0; slide grounded 0", () => {
    const dodge = resolvePoseRender({
      poseKey: "dodging",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL + 40,
      airborneHint: true,
      v2Enabled: true,
    });
    const slide = resolvePoseRender({
      poseKey: "sliding",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      airborneHint: false,
      v2Enabled: true,
    });
    assert.equal(dodge.appliedOffsetY, 0);
    assert.equal(slide.appliedOffsetY, 0);
  });

  it("12. Slide redirect does not shift fighter root", () => {
    const a = resolvePoseRender({
      poseKey: "sliding",
      gameplayX: 600,
      gameplayY: GROUND_LEVEL,
      facing: 1,
      v2Enabled: true,
    });
    const b = resolvePoseRender({
      poseKey: "sliding",
      gameplayX: 600,
      gameplayY: GROUND_LEVEL,
      facing: -1,
      v2Enabled: true,
    });
    assert.equal(a.renderX, b.renderX);
    assert.equal(a.renderY, b.renderY);
  });

  it("13. Slide→jump separates takeoff (airborne) from registration", () => {
    const air = resolvePoseRender({
      poseKey: "dodging",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL + 50,
      airborneHint: true,
      v2Enabled: true,
    });
    assert.equal(air.renderY, GROUND_LEVEL + 50);
  });

  it("14. Aerial touchdown handoff uses grounded registration once", () => {
    const air = resolvePoseRender({
      poseKey: "flap_2",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL + 20,
      airborneHint: true,
      v2Enabled: true,
    });
    const land = resolvePoseRender({
      poseKey: "recovering",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      airborneHint: false,
      v2Enabled: true,
    });
    assert.equal(air.grounded, false);
    assert.equal(land.grounded, true);
    assert.equal(land.renderY, GROUND_LEVEL);
  });

  it("15. Parried aerial landing remains grounded recovery", () => {
    const r = resolvePoseRender({
      poseKey: "recovering",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    assert.equal(r.renderY, GROUND_LEVEL);
  });

  it("16. Hitstun→recovery→neutral stay stable", () => {
    assert.ok(measurePoseTransitionPop("hit", "recovering").absDy < 1);
    assert.ok(measurePoseTransitionPop("recovering", "idle").absDy < 1);
  });

  it("17. Clinch fighters use compatible grounding (zero V2 Y)", () => {
    const g = resolvePoseRender({
      poseKey: "grabbing",
      gameplayX: 600,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    const p = resolvePoseRender({
      poseKey: "clinch_planting",
      gameplayX: 620,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    assert.equal(g.appliedOffsetY, 0);
    assert.equal(p.appliedOffsetY, 0);
  });

  it("18. Throw landing leaves legacy CSS ownership (no V2 Y)", () => {
    const r = resolvePoseRender({
      poseKey: "kill_throw_landing",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    assert.equal(r.v2, false);
    assert.equal(r.renderY, GROUND_LEVEL);
  });

  it("19. Accessory anchors follow pose pivot", () => {
    const r = resolvePoseRender({
      poseKey: "idle",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    assert.equal(r.accessoryAnchorX, r.pivotX);
    assert.equal(r.accessoryAnchorY, r.pivotY);
  });

  it("20. Accessories mirror with facing (zero local offset → same world)", () => {
    const a = resolvePoseRender({
      poseKey: "blocking",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      facing: 1,
      v2Enabled: true,
    });
    const b = resolvePoseRender({
      poseKey: "blocking",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      facing: -1,
      v2Enabled: true,
    });
    assert.equal(a.renderX, b.renderX);
  });

  it("21. Responsive scale constant is stable (SPRITE_WORLD_SIZE)", () => {
    assert.ok(Math.abs(SPRITE_WORLD_SIZE - 1280 * 0.123) < 1e-9);
  });

  it("22. Legacy mode reproduces gameplay root exactly", () => {
    for (const key of ["idle", "charged_attack", "flap_1", "dodging"]) {
      const r = resolvePoseRender({
        poseKey: key,
        gameplayX: 512,
        gameplayY: 300,
        facing: 1,
        v2Enabled: false,
      });
      assert.equal(r.renderX, 512);
      assert.equal(r.renderY, 300);
      assert.equal(r.v2, false);
    }
  });

  it("23. V2 cannot change gameplay X/Y inputs (outputs are render-only)", () => {
    const gx = 555;
    const gy = GROUND_LEVEL;
    const r = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: gx,
      gameplayY: gy,
      v2Enabled: true,
    });
    assert.equal(r.gameplayX, gx);
    assert.equal(r.gameplayY, gy);
    // Flying headbutt: render equals gameplay (no invented sole correction).
    assert.equal(r.renderY, gy);
    assert.equal(r.renderX, gx);
  });

  it("24. Registry does not encode collision / hitbox data", () => {
    for (const key of listPoseKeys()) {
      const reg = getPoseRegistration(key);
      assert.equal(reg.hurtHalfWidthWorld, undefined);
      assert.equal(reg.pushbox, undefined);
      assert.equal(reg.hitbox, undefined);
    }
  });

  it("25. V2 cannot change attack timing constants", () => {
    assert.equal(LOW_KICK_ENABLED, false);
    assert.ok(POSE_REGISTRY.charged_attack);
  });

  it("26. World-space contact effects unchanged (Jolt grip Y)", () => {
    assert.equal(CLINCH_GRIP_CONTACT_Y, 338);
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "pose-jolt",
      initiator: { id: "a", x: 500, y: GROUND_LEVEL, facing: -1 },
      responder: { id: "b", x: 620, y: GROUND_LEVEL, facing: 1 },
      movementX: 1,
      salt: "jolt",
    });
    assert.equal(e.y, CLINCH_GRIP_CONTACT_Y);
  });

  it("27. Incoming-side projectile parry unchanged", () => {
    const e = buildDefensivePresentation({
      defenseType: DEFENSE_TYPE.PROJECTILE_PARRY,
      defenseInstanceId: "pose-parry",
      attacker: { x: 500 },
      defender: { x: 400 },
      incomingDirection: 1,
      attackFamily: "snowball",
    });
    assert.ok(e.x > 400);
    assert.equal(e.profileId, PRESENTATION_PROFILE.DEF_RAW_PARRY);
  });

  it("28. Raw-dodge smoke retains offset 10", () => {
    assert.equal(DASH_SMOKE_SHEET_BASELINE_Y, 10);
  });

  it("29. Slide-redirect smoke retains offset 0", () => {
    assert.equal(SLIDE_REDIRECT_SMOKE_PROFILE.sheetBaselineY, 0);
  });

  it("30. Rope Jump is not a pose-registration gameplay path", () => {
    assert.equal(getPoseRegistration("rope_jump").fallback, true);
  });

  it("31. Low kick remains disabled", () => {
    assert.equal(LOW_KICK_ENABLED, false);
    assert.equal(POSE_REGISTRY.kick.disabledGameplay, true);
  });

  it("32. Reset clears pose-transition diagnostics", () => {
    const store = createPoseTransitionDiagStore(8);
    store.note({ type: "pose", poseKey: "idle" });
    assert.equal(store.size(), 1);
    store.clear();
    assert.equal(store.size(), 0);
  });

  it("33. Debug history remains bounded", () => {
    const store = createPoseTransitionDiagStore(8);
    for (let i = 0; i < 40; i++) store.note({ i });
    assert.ok(store.size() <= 8);
  });

  it("34. poseKeyFromSrc maps live assets", () => {
    assert.equal(poseKeyFromSrc("/assets/attack.png"), "charged_attack");
    assert.equal(
      poseKeyFromSrc("slap-attack-1-hit-frame.png"),
      "slap_hit_1"
    );
    assert.equal(poseKeyFromSrc("belly-bump.png"), "belly_bump");
  });

  it("35. Charged flight stays airborne even at gameplay ground Y", () => {
    const r = resolvePoseRender({
      poseKey: "charged_attack",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      airborneHint: false,
      v2Enabled: true,
    });
    assert.equal(r.grounded, false);
    assert.equal(r.renderY, GROUND_LEVEL);
    assert.equal(r.appliedOffsetY, 0);
  });

  it("36. Presentation state selects charge vs flight vs recovery", () => {
    assert.equal(poseKeyFromPresentationState("charging"), "charging");
    assert.equal(poseKeyFromPresentationState("charged_flight"), "charged_attack");
    assert.equal(poseKeyFromPresentationState("recovering"), "recovering");
    const flight = resolvePoseRender({
      presentationState: "charged_flight",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    const recover = resolvePoseRender({
      presentationState: "recovering",
      gameplayX: 640,
      gameplayY: GROUND_LEVEL,
      v2Enabled: true,
    });
    assert.equal(flight.grounded, false);
    assert.equal(recover.grounded, true);
    assert.equal(flight.appliedOffsetY, 0);
    assert.equal(recover.appliedOffsetY, 0);
  });

  it("37. No active grounded sole correction remains in the registry", () => {
    for (const key of listPoseKeys()) {
      const reg = getPoseRegistration(key);
      if (typeof reg.supportFromBottomPct === "number") {
        assert.fail(
          `${key} still has supportFromBottomPct — no proven sole defect remains`
        );
      }
    }
  });
});

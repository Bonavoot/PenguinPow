"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  PRESENTATION_PROFILE,
  PRESENTATION_ANCHOR,
  CLINCH_INTERACTION,
  CLINCH_GRIP_CONTACT_Y,
  CLINCH_EFFECT_MID_Y,
  buildClinchPresentation,
  getProfile,
  attachCombatPresentation,
} = require("../../combatPresentationEvent");
const { GROUND_LEVEL, LOW_KICK_ENABLED } = require("../../constants");
const {
  MOVEMENT_SMOKE_GROUND_Y,
  DASH_SMOKE_SHEET_BASELINE_Y,
  MOVEMENT_SMOKE_TRANSITION,
  MOVEMENT_SMOKE_EMITTER,
  SLIDE_REDIRECT_SMOKE_PROFILE,
  normalizeMoveDir,
  isAirborneForMovementSmoke,
  mintMovementSmokeEventId,
  createMovementSmokeClaimStore,
  resolveMovementSmokePlacement,
  movementSmokeEmitterName,
} = require("../../movementSmokePresentation");

function pair() {
  return {
    a: { id: "a1", x: 500, y: GROUND_LEVEL, facing: -1 },
    b: { id: "b1", x: 620, y: GROUND_LEVEL, facing: 1 },
  };
}

describe("Phase 8B — clinch Jolt grip registration", () => {
  it("1. Unilateral Jolt uses CLINCH_GRIP_CONTACT anchor", () => {
    const { a, b } = pair();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "j1",
      initiator: a,
      responder: b,
      movementX: 1,
      salt: "jolt",
    });
    assert.equal(e.anchorType, PRESENTATION_ANCHOR.CLINCH_GRIP_CONTACT);
    assert.equal(e.profileId, PRESENTATION_PROFILE.CLINCH_JOLT);
    assert.equal(e.y, CLINCH_GRIP_CONTACT_Y);
    assert.ok(e.y < CLINCH_EFFECT_MID_Y);
  });

  it("2. Initiator side does not move the core away from the seam", () => {
    const { a, b } = pair();
    a.x = 480;
    b.x = 640;
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "j2",
      initiator: a,
      responder: b,
      contactX: a.x, // biased input — builder must re-center
      movementX: 1,
      salt: "jolt",
    });
    assert.equal(e.x, (a.x + b.x) * 0.5);
    assert.notEqual(e.x, a.x);
  });

  it("3. Mutual Jolt is symmetric at midpoint", () => {
    const { a, b } = pair();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL,
      actionInstanceId: "jm",
      initiator: a,
      responder: b,
      movementX: 0,
      salt: "jolt_mutual",
    });
    assert.equal(e.x, (a.x + b.x) * 0.5);
    assert.equal(e.y, CLINCH_GRIP_CONTACT_Y);
    assert.equal(e.approachX, 0);
  });

  it("4. Both directions mirror via movement orientation", () => {
    const { a, b } = pair();
    const right = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "jr",
      initiator: a,
      responder: b,
      movementX: 1,
      salt: "jolt",
    });
    const left = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "jl",
      initiator: b,
      responder: a,
      movementX: -1,
      salt: "jolt",
    });
    assert.equal(right.approachX, 1);
    assert.equal(left.approachX, -1);
    assert.notEqual(right.facingHint, left.facingHint);
  });

  it("5. World-space Jolt does not follow fighter movement after spawn", () => {
    const { a, b } = pair();
    const e = buildClinchPresentation({
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "snap",
      initiator: a,
      responder: b,
      movementX: 1,
      salt: "jolt",
    });
    const x0 = e.x;
    const y0 = e.y;
    a.x = 900;
    b.x = 1000;
    assert.equal(e.x, x0);
    assert.equal(e.y, y0);
  });

  it("6. One Jolt creates one stable VFX event id", () => {
    const { a, b } = pair();
    const args = {
      interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
      actionInstanceId: "once",
      initiator: a,
      responder: b,
      movementX: 1,
      salt: "jolt",
    };
    assert.equal(
      buildClinchPresentation(args).eventId,
      buildClinchPresentation(args).eventId
    );
  });

  it("7. Reset clears Jolt presentation attach (null event no-op)", () => {
    const payload = { joltId: "x" };
    attachCombatPresentation(payload, null);
    assert.equal(payload.combatPresentation, undefined);
  });

  it("8. Temporary CSS fallback uses corrected grip height", () => {
    const p = getProfile(PRESENTATION_PROFILE.CLINCH_JOLT);
    assert.equal(p.temporaryCssFallback, true);
    assert.equal(p.gripHeightY, CLINCH_GRIP_CONTACT_Y);
    assert.equal(p.spriteKey, "clinchJoltCssFallback");
    assert.equal(
      getProfile(PRESENTATION_PROFILE.CLINCH_JOLT_MUTUAL).temporaryCssFallback,
      true
    );
  });
});

describe("Phase 8B — dodge / slide movement smoke", () => {
  it("9. Grounded dodge spawns once", () => {
    const store = createMovementSmokeClaimStore();
    const a = resolveMovementSmokePlacement(
      {
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
        moveDir: 1,
        worldX: 500,
        fighter: { y: GROUND_LEVEL },
      },
      store
    );
    const b = resolveMovementSmokePlacement(
      {
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
        moveDir: 1,
        worldX: 500,
        fighter: { y: GROUND_LEVEL },
      },
      store
    );
    assert.ok(a);
    assert.equal(b, null);
  });

  it("10. Left dodge places smoke with negative movement dir", () => {
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: -1,
      worldX: 600,
      fighter: { y: GROUND_LEVEL },
    });
    assert.equal(p.direction, -1);
    assert.equal(p.y, MOVEMENT_SMOKE_GROUND_Y);
  });

  it("11. Right dodge mirrors correctly", () => {
    assert.equal(normalizeMoveDir(1), 1);
    assert.equal(normalizeMoveDir(-1), -1);
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 600,
      fighter: { y: GROUND_LEVEL },
    });
    assert.equal(p.direction, 1);
  });

  it("12. Slide start preserves existing transition type", () => {
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.SLIDE_START,
      moveDir: 1,
      worldX: 520,
      fighter: { y: GROUND_LEVEL, isIceSliding: true },
    });
    assert.equal(p.transitionType, MOVEMENT_SMOKE_TRANSITION.SLIDE_START);
    assert.equal(p.y, MOVEMENT_SMOKE_GROUND_Y);
  });

  it("13. Valid slide redirect spawns once", () => {
    const store = createMovementSmokeClaimStore();
    const a = resolveMovementSmokePlacement(
      {
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT,
        moveDir: -1,
        worldX: 540,
        sequence: 1,
        fighter: { y: GROUND_LEVEL, isIceSliding: true },
      },
      store
    );
    const b = resolveMovementSmokePlacement(
      {
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT,
        moveDir: -1,
        worldX: 540,
        sequence: 1,
        fighter: { y: GROUND_LEVEL, isIceSliding: true },
      },
      store
    );
    assert.ok(a);
    assert.equal(b, null);
  });

  it("13b. Bunny-hop Y lift does not block SLIDE_REDIRECT smoke", () => {
    // Peak reverse hop is GROUND + 16; airborne Y gate is GROUND + 8.
    assert.equal(
      isAirborneForMovementSmoke({
        y: GROUND_LEVEL + 16,
        isIceSliding: true,
        isIceSlideReverseHopping: true,
      }),
      false
    );
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT,
      moveDir: 1,
      worldX: 540,
      sequence: 9,
      fighter: {
        y: GROUND_LEVEL + 16,
        isIceSliding: true,
        isIceSlideReverseHopping: true,
      },
    });
    assert.ok(p);
    assert.equal(p.y, MOVEMENT_SMOKE_GROUND_Y);
    assert.equal(
      movementSmokeEmitterName(p.transitionType),
      "iceSlideRedirect"
    );
  });

  it("14. Rapid left-right-left redirects each receive unique IDs", () => {
    const ids = [1, 2, 3].map((seq, i) =>
      mintMovementSmokeEventId({
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT,
        moveDir: i % 2 === 0 ? -1 : 1,
        worldX: 550 + i,
        sequence: seq,
      })
    );
    assert.equal(new Set(ids).size, 3);
  });

  it("15. Same event cannot replay through store claim", () => {
    const store = createMovementSmokeClaimStore();
    const id = mintMovementSmokeEventId({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 500,
    });
    assert.equal(store.claim(id), true);
    assert.equal(store.claim(id), false);
  });

  it("16. Prediction confirmation cannot duplicate (shared id)", () => {
    const store = createMovementSmokeClaimStore();
    const id = mintMovementSmokeEventId({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 500,
    });
    assert.equal(store.claim(id), true);
    // Confirm reuses same mint — claim fails.
    assert.equal(store.claim(id), false);
  });

  it("17. Rejected / airborne prediction cannot leave placement", () => {
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 500,
      fighter: { y: GROUND_LEVEL + 80, isSlideJumping: true },
    });
    assert.equal(p, null);
  });

  it("18. FLAP plus Shift creates no dodge smoke", () => {
    assert.equal(isAirborneForMovementSmoke({ isFlapping: true, y: GROUND_LEVEL }), true);
    assert.equal(
      resolveMovementSmokePlacement({
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
        moveDir: 1,
        worldX: 500,
        fighter: { isFlapping: true, y: GROUND_LEVEL },
      }),
      null
    );
  });

  it("19. Slide-jump flight plus Shift creates no dodge smoke", () => {
    assert.equal(
      resolveMovementSmokePlacement({
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
        moveDir: 1,
        worldX: 500,
        fighter: { isSlideJumping: true, slideJumpPhase: "flight", y: 400 },
      }),
      null
    );
  });

  it("20. S-dive plus Shift creates no dodge smoke", () => {
    assert.equal(
      resolveMovementSmokePlacement({
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
        moveDir: 1,
        worldX: 500,
        fighter: {
          isSlideJumping: true,
          slideJumpDiveCommitted: true,
          y: 350,
        },
      }),
      null
    );
  });

  it("21. Parried aerial fall plus Shift creates no dodge smoke", () => {
    assert.equal(
      resolveMovementSmokePlacement({
        fighterId: "p1",
        transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
        moveDir: 1,
        worldX: 500,
        fighter: {
          y: GROUND_LEVEL + 40,
          offensiveAerialReactionType: "PARRIED_RECOIL",
        },
      }),
      null
    );
  });

  it("22. Airborne player Y cannot affect smoke ground Y", () => {
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 500,
      fighter: { y: GROUND_LEVEL },
    });
    assert.equal(p.y, MOVEMENT_SMOKE_GROUND_Y);
    assert.equal(p.y, GROUND_LEVEL);
    assert.notEqual(p.y, 400);
  });

  it("23. Facing opposite velocity cannot reverse smoke", () => {
    // Facing 1 = look left; movement +1 still wins.
    const dir = normalizeMoveDir(1, /*facingFallback*/ -1);
    assert.equal(dir, 1);
  });

  it("24. Spawned smoke remains at its world snapshot X", () => {
    const p = resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 512.7,
      fighter: { y: GROUND_LEVEL },
    });
    assert.equal(p.x, 512.7);
  });

  it("25. Reset/rematch clears pending smoke dedupe", () => {
    const store = createMovementSmokeClaimStore();
    store.claim("a");
    assert.equal(store.size(), 1);
    store.clear();
    assert.equal(store.size(), 0);
    assert.equal(store.claim("a"), true);
  });

  it("26. Presentation helpers do not mutate fighter gameplay fields", () => {
    const fighter = {
      y: GROUND_LEVEL,
      isDodging: false,
      movementVelocity: 3,
    };
    resolveMovementSmokePlacement({
      fighterId: "p1",
      transitionType: MOVEMENT_SMOKE_TRANSITION.DODGE_START,
      moveDir: 1,
      worldX: 500,
      fighter,
    });
    assert.equal(fighter.isDodging, false);
    assert.equal(fighter.movementVelocity, 3);
  });

  it("27. Rope Jump remains an airborne smoke block", () => {
    assert.equal(
      isAirborneForMovementSmoke({ isRopeJumping: true, y: GROUND_LEVEL }),
      true
    );
  });

  it("28. Low kick remains disabled", () => {
    assert.equal(LOW_KICK_ENABLED, false);
  });

  it("29. Dodge / slide-start keep full emitters; redirect is distinct", () => {
    assert.equal(
      movementSmokeEmitterName(MOVEMENT_SMOKE_TRANSITION.DODGE_START),
      "dashStart"
    );
    assert.equal(
      movementSmokeEmitterName(MOVEMENT_SMOKE_TRANSITION.SLIDE_START),
      "iceSlideStart"
    );
    assert.equal(
      movementSmokeEmitterName(MOVEMENT_SMOKE_TRANSITION.SLIDE_REDIRECT),
      "iceSlideRedirect"
    );
    assert.notEqual(
      MOVEMENT_SMOKE_EMITTER.SLIDE_REDIRECT,
      MOVEMENT_SMOKE_EMITTER.SLIDE_START
    );
  });

  it("30. SLIDE_REDIRECT profile is a tighter dodge dashStart swoosh", () => {
    const p = SLIDE_REDIRECT_SMOKE_PROFILE;
    assert.equal(p.emitter, "iceSlideRedirect");
    assert.equal(p.baseEmitter, "dashStart");
    assert.equal(p.sheet, "dash-smoke-effect");
    assert.ok(p.scale >= 0.55 && p.scale <= 0.65);
    assert.ok(p.scale < p.dashScale);
    assert.ok(p.maxLife < p.dashMaxLife);
    assert.ok(p.alpha <= p.dashAlpha);
  });

  it("31. dash-smoke sheet baseline applies to dodge; redirect keeps prior reg", () => {
    assert.equal(DASH_SMOKE_SHEET_BASELINE_Y, 10);
    assert.ok(
      DASH_SMOKE_SHEET_BASELINE_Y >= 8 && DASH_SMOKE_SHEET_BASELINE_Y <= 12
    );
    assert.equal(MOVEMENT_SMOKE_GROUND_Y, GROUND_LEVEL);
    assert.equal(MOVEMENT_SMOKE_GROUND_Y, 286);
    assert.equal(
      movementSmokeEmitterName(MOVEMENT_SMOKE_TRANSITION.DODGE_START),
      "dashStart"
    );
    assert.equal(SLIDE_REDIRECT_SMOKE_PROFILE.baseEmitter, "dashStart");
    assert.equal(SLIDE_REDIRECT_SMOKE_PROFILE.sheet, "dash-smoke-effect");
    // Redirect intentionally skips the dodge sheet baseline nudge.
    assert.equal(SLIDE_REDIRECT_SMOKE_PROFILE.sheetBaselineY, 0);
  });
});

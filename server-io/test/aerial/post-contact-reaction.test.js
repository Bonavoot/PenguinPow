"use strict";

/**
 * Phase 4 — post-contact reaction + landing handoff.
 * Flag OFF must match Phase 3; flag ON enables PARRIED_RECOIL etc.
 */

const { describe, it, afterEach, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  AP_STAGGER_FLAP_MS,
  HITSTOP_BURST_MS,
  SLAP_HIT_VICTIM_STAMINA_DRAIN,
  BURST_STUN_MS,
} = require("../../constants");
const { pxToKbVelocity, profileFor } = require("../../momentumTransfer");
const {
  setSimRoomResolver,
  timeoutManager,
  isSlideJumpFlightImmune,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../gameUtils");
const {
  setOffensiveAerialReactionV2ForTests,
  setOffensiveAerialReactionPresetForTests,
  isOffensiveAerialReactionV2Enabled,
} = require("../../offensiveAerialFlags");
const {
  OFFENSIVE_AERIAL_OUTCOME,
} = require("../../offensiveAerialOutcome");
const {
  OFFENSIVE_AERIAL_REACTION,
  TOUCHDOWN_REASON,
  getReactionPreset,
} = require("../../offensiveAerialReaction");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  runUntil,
  armDefenderParry,
} = require("./helpers/slideJumpSim");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
  setOffensiveAerialReactionV2ForTests(null);
  setOffensiveAerialReactionPresetForTests(null);
});

describe("offensive aerial — Phase 4 flag OFF equivalence (legacy rollback)", () => {
  beforeEach(() => {
    setOffensiveAerialReactionV2ForTests(false);
  });

  it("explicit override OFF selects legacy", () => {
    assert.equal(isOffensiveAerialReactionV2Enabled(), false);
  });

  it("raw parry still grounds and staggers immediately", () => {
    const s = createSlideJumpScenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 60 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.PARRIED);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.isRecovering, true);
    assert.equal(s.attacker.offensiveAerialReaction, null);
  });

  it("HIT continuation remains slide-jump flight", () => {
    const s = createSlideJumpScenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 60 });
    stepSlideJumpTick(s);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.attacker.isSlideJumping, true);
    assert.equal(s.attacker.slideJumpPhase, "flight");
    assert.equal(s.attacker.offensiveAerialReaction, null);
  });

  it("whiff still lands with existing recovery", () => {
    const s = createSlideJumpScenario({
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 800,
    });
    s.attacker.y = GROUND_LEVEL + 40;
    s.attacker.slideJumpVelocityY = -8;
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 80);
    assert.ok(
      s.attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.WHIFF ||
        s.attacker.slideJumpPhase === "landing"
    );
  });
});


function v2Scenario(opts = {}) {
  return createSlideJumpScenario({ ...opts, reactionV2: true });
}

describe("offensive aerial — Phase 4 flag ON reactions", () => {
  beforeEach(() => {
    setOffensiveAerialReactionV2ForTests(true);
    setOffensiveAerialReactionPresetForTests("heavy_short");
  });

  it("selects V2 architecture when enabled", () => {
    assert.equal(isOffensiveAerialReactionV2Enabled(), true);
    assert.equal(getReactionPreset().id, "heavy_short");
  });

  it("LATERAL HIT selects HIT_CONTINUATION; combat numbers unchanged", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 60 });
    const stam = s.defender.stamina;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.HIT);
    assert.equal(
      s.attacker.offensiveAerialReaction.reactionType,
      OFFENSIVE_AERIAL_REACTION.HIT_CONTINUATION
    );
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.defender.stamina, stam - SLAP_HIT_VICTIM_STAMINA_DRAIN);
    // MOMENTUM TRANSFER: a slam with no carried speed resolves at the bodySlam
    // floor rather than the retired fixed FLAP_BODYSLAM_KB_VELOCITY, and
    // hitstop scales with closing speed instead of the per-move ladder.
    assert.ok(
      Math.abs(s.defender.knockbackVelocity.x) >=
        pxToKbVelocity(profileFor("bodySlam").floor) - 1e-9,
      "a clean slam sends at least its floor; dive speed and pressure add on top"
    );
    assert.ok(s.io.find("hitstop")[0].payload.duration > 0);
    assert.equal(s.attacker.isSlideJumping, true);
    assert.ok(s.attacker.y > GROUND_LEVEL);
  });

  it("HIT touchdown reason is HIT_CONTINUATION_TOUCHDOWN; contact survives", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 40 });
    stepSlideJumpTick(s);
    const cx = s.attacker.offensiveAerial.contactX;
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 120);
    assert.equal(
      s.attacker.offensiveAerialReaction?.touchdownReason,
      TOUCHDOWN_REASON.HIT_CONTINUATION_TOUCHDOWN
    );
    assert.equal(s.attacker.offensiveAerial.contactX, cx);
    assert.equal(s.attacker.slideJumpHitRecoverDuration, BURST_STUN_MS);
  });

  it("PARRIED selects PARRIED_RECOIL; stays airborne; immunity cleared", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 70 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    const y0 = s.attacker.y;
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.PARRIED);
    assert.equal(
      s.attacker.offensiveAerialReaction.reactionType,
      OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL
    );
    assert.equal(s.attacker.isSlideJumping, true);
    assert.equal(s.attacker.slideJumpPhase, "flight");
    assert.ok(s.attacker.y > GROUND_LEVEL, "must remain airborne");
    assert.equal(s.attacker.isRecovering, false);
    assert.equal(isSlideJumpFlightImmune(s.attacker), false);
    assert.equal(s.attacker.slideJumpHitLanded, true);
    assert.equal(s.attacker.flapCharges, 0);
    assert.equal(s.attacker.slideJumpDiveCommitted, false);
    assert.ok(s.attacker.y >= y0 - 1);
  });

  it("parry recoil moves away from defender and does not cross", () => {
    const s = v2Scenario({
      armFlap: true,
      flapFlight: true,
      attackerX: 500,
      defenderX: 560,
    });
    placeDescendingOverOpponent(s, { height: 70, x: s.defender.x - 45 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    const startX = s.attacker.x;
    for (let i = 0; i < 8; i++) stepSlideJumpTick(s, { earlyPairCheck: false });
    assert.ok(s.attacker.x <= startX + 0.5, "recoil leftward");
    assert.ok(s.attacker.x < s.defender.x - 4, "no cross-through");
  });

  it("gravity dominates; no long hover; lands with PARRIED_RECOIL_TOUCHDOWN", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 80 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    const t0 = s.room.simTime;
    stepSlideJumpTick(s);
    const peak = { y: s.attacker.y };
    runUntil(
      s,
      () => {
        peak.y = Math.max(peak.y, s.attacker.y);
        return s.attacker.slideJumpPhase === "landing";
      },
      120
    );
    assert.equal(
      s.attacker.offensiveAerialReaction?.touchdownReason,
      TOUCHDOWN_REASON.PARRIED_RECOIL_TOUCHDOWN
    );
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.isRecovering, true);
    const up = peak.y - (s.attacker.offensiveAerialReaction?.startY || peak.y);
    assert.ok(up < 40, `upward displacement too large: ${up}`);
    const fallMs = s.room.simTime - t0;
    assert.ok(fallMs < 900, `fall too long: ${fallMs}`);
  });

  it("control is not restored earlier than legacy stagger", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 55 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    const tContact = s.room.simTime;
    stepSlideJumpTick(s);
    const controlAt = s.attacker.offensiveAerialReaction.controlRestoreAt;
    assert.ok(controlAt >= tContact + AP_STAGGER_FLAP_MS);
    runUntil(
      s,
      () =>
        !s.attacker.isSlideJumping &&
        s.attacker.offensiveAerialReaction == null,
      200
    );
    const tDone = s.room.simTime;
    assert.ok(
      tDone - tContact >= AP_STAGGER_FLAP_MS - 20,
      `control early: ${tDone - tContact} < ${AP_STAGGER_FLAP_MS}`
    );
  });

  it("DOWNWARD dive parry uses PARRIED_RECOIL", () => {
    const s = v2Scenario({
      armFlap: true,
      flapFlight: true,
      dive: true,
    });
    placeDescendingOverOpponent(s, { height: 70 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.PARRIED);
    assert.equal(
      s.attacker.offensiveAerialReaction.reactionType,
      OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL
    );
    assert.ok(s.attacker.y > GROUND_LEVEL);
  });

  it("WHIFF touchdown selects WHIFF_DESCENT handoff; plain jump distinct", () => {
    const s = v2Scenario({
      armFlap: true,
      flapFlight: true,
      attackerX: 400,
      defenderX: 850,
    });
    s.attacker.y = GROUND_LEVEL + 30;
    s.attacker.slideJumpVelocityY = -10;
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 80);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.WHIFF);
    assert.equal(
      s.attacker.offensiveAerialReaction?.touchdownReason,
      TOUCHDOWN_REASON.WHIFF_TOUCHDOWN
    );

    const plain = v2Scenario({
      attackerX: 400,
      defenderX: 850,
    });
    plain.attacker.y = GROUND_LEVEL + 30;
    plain.attacker.slideJumpVelocityY = -10;
    runUntil(plain, () => plain.attacker.slideJumpPhase === "landing", 80);
    assert.equal(
      plain.attacker.offensiveAerial.outcome,
      OFFENSIVE_AERIAL_OUTCOME.LANDED_WITHOUT_CONTACT
    );
  });

  it("duplicate touchdown rejected; one recovery", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 50 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    runUntil(s, () => s.attacker.slideJumpPhase === "landing", 120);
    const rejectsBefore =
      s.attacker._offensiveAerialDuplicateTouchdownRejects || 0;
    const { applyOffensiveAerialTouchdownHandoff } = require("../../offensiveAerialReaction");
    const r = applyOffensiveAerialTouchdownHandoff(
      s.attacker,
      s.defender,
      s.room.simTime,
      { recoveryMs: 100 }
    );
    assert.equal(r.rejected, true);
    assert.ok(
      (s.attacker._offensiveAerialDuplicateTouchdownRejects || 0) >
        rejectsBefore
    );
  });

  it("boundary parry remains finite and inside playable region", () => {
    const s = v2Scenario({
      armFlap: true,
      flapFlight: true,
      attackerX: MAP_LEFT_BOUNDARY + 30,
      defenderX: MAP_LEFT_BOUNDARY + 90,
    });
    placeDescendingOverOpponent(s, { height: 70 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    for (let i = 0; i < 40; i++) {
      if (!s.attacker.isSlideJumping) break;
      stepSlideJumpTick(s, { earlyPairCheck: false });
      assert.ok(Number.isFinite(s.attacker.x));
      assert.ok(Number.isFinite(s.attacker.y));
      assert.ok(s.attacker.x >= MAP_LEFT_BOUNDARY - 1e-6);
      assert.ok(s.attacker.x <= MAP_RIGHT_BOUNDARY + 1e-6);
    }
  });

  it("one parry creates one raw_parry_success effect", () => {
    const s = v2Scenario({ armFlap: true, flapFlight: true });
    placeDescendingOverOpponent(s, { height: 60 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    stepSlideJumpTick(s, { earlyPairCheck: true });
    assert.equal(s.io.find("raw_parry_success").length, 1);
  });
});

describe("offensive aerial — Phase 4 quantitative recoil scan", () => {
  beforeEach(() => {
    setOffensiveAerialReactionV2ForTests(true);
    setOffensiveAerialReactionPresetForTests("heavy_short");
  });

  it("scan contact-to-control / recoil metrics", () => {
    const heights = [40, 70, 100];
    const rows = [];
    for (const height of heights) {
      const s = v2Scenario({ armFlap: true, flapFlight: true });
      placeDescendingOverOpponent(s, { height });
      armDefenderParry(s.defender, s.room.simTime, "regular");
      const t0 = s.room.simTime;
      const y0 = s.attacker.y;
      const x0 = s.attacker.x;
      stepSlideJumpTick(s);
      let peakY = s.attacker.y;
      let minX = s.attacker.x;
      runUntil(
        s,
        () => {
          peakY = Math.max(peakY, s.attacker.y);
          minX = Math.min(minX, s.attacker.x);
          return (
            !s.attacker.isSlideJumping &&
            !(s.attacker.offensiveAerialReaction?.reactionType ===
              OFFENSIVE_AERIAL_REACTION.PARRIED_RECOIL)
          );
        },
        240
      );
      const tEnd = s.room.simTime;
      rows.push({
        height,
        contactToControlMs: tEnd - t0,
        legacyMs: AP_STAGGER_FLAP_MS,
        deltaVsLegacy: tEnd - t0 - AP_STAGGER_FLAP_MS,
        maxUp: peakY - y0,
        hRecoil: Math.abs(minX - x0),
        touchdownOverlap:
          s.attacker.offensiveAerialReaction?.touchdownOverlap ?? null,
      });
    }
    const maxUp = Math.max(...rows.map((r) => r.maxUp));
    const maxH = Math.max(...rows.map((r) => r.hRecoil));
    const maxCtrl = Math.max(...rows.map((r) => r.contactToControlMs));
    const minCtrl = Math.min(...rows.map((r) => r.contactToControlMs));
    console.log(
      "[OFFENSIVE_AERIAL_REACTION_SCAN]",
      JSON.stringify({
        rows,
        maxUp,
        maxH,
        minCtrl,
        maxCtrl,
        preset: "heavy_short",
      })
    );
    assert.ok(minCtrl >= AP_STAGGER_FLAP_MS - 30);
    assert.ok(maxUp < 50);
    assert.ok(maxH < 80);
    assert.ok(maxCtrl <= AP_STAGGER_FLAP_MS + 300);
  });
});

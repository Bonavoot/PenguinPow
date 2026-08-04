"use strict";

/**
 * PHASE 4A — LIMB-ONLY HIT-EVENT IDENTITY.
 *
 * The struck-limb pose hold is a presentation consumer of the AUTHORITATIVE
 * contact stamp. This locks down the narrow identity the server exposes so the
 * client can hold the exact struck frame without guessing (and so torso contacts
 * can never accidentally qualify).
 *
 * `limbOnlyContact` must mean: the authored limb won AND the torso was out of
 * legacy connect. `victimHurtKind === HURT_LIMB` alone is NOT sufficient —
 * torso-plus-limb stamps frontArm for VFX but must keep ordinary presentation.
 */

const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  setAuthoredSlapHurtboxForTests,
} = require("../../authoredSlapHurtboxFlags");
const {
  getLastSlapHurtCommitted,
  clearLastSlapHurtCommitted,
} = require("../../authoredSlapHurtTarget");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  stepCollisionBothOrders,
  placeAtGap,
} = require("./helpers/scenarioHarness");
const {
  limbOnlyGap,
  limbReachGap,
  torsoGate,
} = require("./helpers/limbSpacing");
const { COMBAT_VOLUME_KIND } = require("../../combatVolumeVocabulary");
const {
  PALM_THRUST_POWER,
  PALM_THRUST_STARTUP_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  AP_LATE_PARRY_MS,
} = require("../../constants");

const SIZE = 0.85;

function lastHit(io) {
  const h = io.last("player_hit");
  return h ? h.payload : null;
}

function armDeepSlapActive(p, now) {
  armSlapPhase(p, "active", now);
  p.isInStartupFrames = false;
  p.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 20;
  p.slapActiveEndTime = p.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  p.attackEndTime = p.slapActiveEndTime + SLAP_RECOVERY_MS;
}

function armLivePalm(p, now) {
  armPalmPhase(p, "active", now);
  p.chargeAttackPower = PALM_THRUST_POWER;
  p.isInStartupFrames = false;
  p.attackStartTime = now - PALM_THRUST_STARTUP_MS - 20;
  p.startupEndTime = p.attackStartTime + PALM_THRUST_STARTUP_MS;
  p.chargingFacingDirection = p.facing;
}

/** Victim shows an extended ACTIVE arm with its own rail aimed away. */
function armExposedActiveLimb(victim, attacker, now, variant) {
  if (variant != null) victim.slapAnimation = variant;
  armDeepSlapActive(victim, now);
  if (variant != null) victim.slapAnimation = variant;
  const towardAttacker = attacker.x < victim.x ? 1 : -1;
  victim.slapFacingDirection = towardAttacker;
  victim.facing = -towardAttacker;
}

describe("Phase 4A — limb-only hit-event identity", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));
  afterEach(() => clearLastSlapHurtCommitted());

  it("limb-only contact stamps pose, phase, variant, facing and limbOnlyContact", () => {
    for (const variant of [1, 2]) {
      const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
      const now = s.room.simTime;
      armExposedActiveLimb(s.right, s.left, now, variant);
      armLivePalm(s.left, now);
      assert.ok(placeLimbOnlyOr(s, "palm", now), `v${variant}: band required`);
      // processHit clears the victim's slap flags, so capture the committed
      // mirror facing before the contact resolves.
      const committedMirror = s.right.slapFacingDirection;
      stepCollisionBothOrders(s);

      const p = lastHit(s.io);
      assert.ok(p, `v${variant}: must emit player_hit`);
      assert.equal(p.limbOnlyContact, true, `v${variant}`);
      assert.equal(p.victimHurtRegion, "frontArm");
      assert.equal(p.victimHurtKind, COMBAT_VOLUME_KIND.HURT_LIMB);
      assert.equal(p.victimSlapPoseKey, "slap_active");
      assert.equal(p.victimSlapPhase, "active");
      assert.equal(
        p.victimSlapVariant,
        String(variant),
        "client must not have to guess which hit frame was struck"
      );
      assert.equal(
        p.victimSlapMirrorFacing,
        committedMirror,
        "committed slap mirror facing must be reported"
      );
      assert.equal(p.authoredSlapHurtboxV1, true);
      s.dispose();
    }
  });

  it("recovery limb-only reports the recovery pose (never an active extension)", () => {
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    armDeepSlapActive(s.left, now);
    assert.ok(placeLimbOnlyOr(s, "slap", now));
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p);
    assert.equal(p.limbOnlyContact, true);
    assert.equal(p.victimSlapPoseKey, "slap_recovery");
    assert.equal(p.victimSlapPhase, "recovery");
    assert.equal(p.victimHurtRegion, "frontArm");
    s.dispose();
  });

  it("torso contact reports no limb identity and no limbOnlyContact", () => {
    const s = createFoundationScenario({ gap: 100, sizeA: SIZE, sizeB: SIZE });
    const now = s.room.simTime;
    // Neutral victim — nothing exposed, ordinary body hit.
    armLivePalm(s.left, now);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p, "torso hit must still emit");
    assert.notEqual(p.limbOnlyContact, true);
    assert.notEqual(
      p.victimHurtRegion,
      "frontArm",
      "a neutral victim must never report a limb region"
    );
    assert.equal(p.victimSlapPoseKey, null);
    s.dispose();
  });

  it("torso-PLUS-limb keeps frontArm identity but limbOnlyContact false", () => {
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const now = s.room.simTime;
    armExposedActiveLimb(s.right, s.left, now, 2);
    armLivePalm(s.left, now);
    // Inside torso connect AND inside limb reach → both eligible.
    const gate = torsoGate("palm", s.left, s.right);
    assert.ok(limbReachGap("palm", s.right, now) > gate - 1);
    placeAtGap(s, gate - 2);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p);
    assert.equal(
      p.limbOnlyContact,
      false,
      "body contact must keep ordinary hit presentation"
    );
    s.dispose();
  });

  it("the commit ledger records variant + limbOnly for diagnostics", () => {
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const now = s.room.simTime;
    armExposedActiveLimb(s.right, s.left, now, 2);
    armLivePalm(s.left, now);
    assert.ok(placeLimbOnlyOr(s, "palm", now));
    stepCollisionBothOrders(s);
    const committed = getLastSlapHurtCommitted();
    assert.ok(committed);
    assert.equal(committed.variantKey, "2");
    assert.equal(committed.limbOnly, true);
    assert.equal(committed.region, "frontArm");
    assert.equal(committed.consumption, "consumed_once");
    s.dispose();
  });

  it("flag OFF emits no Phase 4A identity fields", () => {
    setAuthoredSlapHurtboxForTests(false);
    const s = createFoundationScenario({ gap: 100, sizeA: SIZE, sizeB: SIZE });
    const now = s.room.simTime;
    armLivePalm(s.left, now);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p, "legacy torso hit still emits");
    assert.equal(p.limbOnlyContact, undefined);
    assert.equal(p.victimSlapVariant, undefined);
    assert.equal(p.authoredSlapHurtboxV1, undefined);
    setAuthoredSlapHurtboxForTests(true);
    s.dispose();
  });

  it("one contact = one damage/reaction/hitstop/presentation event", () => {
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const now = s.room.simTime;
    const hpBefore = s.right.health;
    armExposedActiveLimb(s.right, s.left, now, 1);
    armLivePalm(s.left, now);
    assert.ok(placeLimbOnlyOr(s, "palm", now));
    stepCollisionBothOrders(s);
    assert.equal(s.io.find("player_hit").length, 1, "exactly one hit event");
    assert.equal(s.right.isHit, true, "authoritative reaction is NOT delayed");
    assert.ok(s.room.hitstopUntil > 0, "hitstop armed once");
    if (typeof hpBefore === "number") {
      assert.ok(s.right.health <= hpBefore, "damage applied at most once");
    }
    // Re-running the same lifecycle must not duplicate anything.
    stepCollisionBothOrders(s);
    assert.equal(s.io.find("player_hit").length, 1, "no duplicate event");
    s.dispose();
  });
});

/** Place in the honest limb-only band; returns the gap or null when none exists. */
function placeLimbOnlyOr(s, kind, now) {
  const gap = limbOnlyGap(kind, s.left, s.right, now);
  if (gap == null) return null;
  placeAtGap(s, gap);
  return gap;
}

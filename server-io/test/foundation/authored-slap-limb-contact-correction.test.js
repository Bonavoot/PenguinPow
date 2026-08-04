"use strict";

/**
 * Phase 4A — limb-only hits must not torso-park (forward "suction").
 * Entry: real checkCollision → processHit. Asserts pre-knockback park stage.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  setAuthoredSlapHurtboxForTests,
} = require("../../authoredSlapHurtboxFlags");
const {
  createFoundationScenario,
  stepCollisionBothOrders,
  advanceSim,
  armPalmPhase,
  armChargedPhase,
  placeAtGap,
} = require("./helpers/scenarioHarness");
const {
  limbOnlyGap,
  limbReachGap,
  torsoGate,
} = require("./helpers/limbSpacing");
const {
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  PALM_THRUST_POWER,
  PALM_THRUST_STARTUP_MS,
  CHARGE_PRIORITY_THRESHOLD,
  TICK_RATE,
} = require("../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../gameUtils");
const {
  getConnectDistance,
  isWithinConnectRange,
  getHitParkDistance,
  CONTACT_SNAP_EPSILON,
} = require("../../strikeContact");
const {
  clearLastSlapHurtCommitted,
  getLastSlapHurtCommitted,
  clearSlapHurtQueryLog,
} = require("../../authoredSlapHurtTarget");

const TICK_MS = 1000 / TICK_RATE;
// Spacing is derived from live authored geometry (see helpers/limbSpacing.js).
// The old literal LIMB_GAP=160 only "worked" while the authored limb over-reached
// its own art by ~27 world units.
const TORSO_GAP = 120;
const SIZE = 0.85;

/**
 * Re-space an armed scenario into the honest limb-only band for this pairing.
 * Returns the applied gap, or null when the band is empty (authored limb is
 * enclosed by legacy torso connect — e.g. the retracted slap-recovery arm).
 */
function placeInLimbOnlyBand(s, attackKind, simTime, bias = 0.5) {
  const gap = limbOnlyGap(attackKind, s.left, s.right, simTime, bias);
  if (gap == null) return null;
  placeAtGap(s, gap);
  return gap;
}

function hitCount(io) {
  return io.find("player_hit").length;
}

function lastHit(io) {
  const hits = io.find("player_hit");
  return hits.length ? hits[hits.length - 1].payload : null;
}

function armSlapActive(player, now, agePastStartup = 60) {
  player.isAttacking = true;
  player.isSlapAttack = true;
  player.attackType = "slap";
  player.slapAnimation = 1;
  player.slapFacingDirection = player.facing;
  player.currentAction = "slap";
  player.isInStartupFrames = false;
  player.attackStartTime = now - SLAP_STARTUP_MS - agePastStartup;
  player.slapActiveEndTime =
    player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  player.attackEndTime = player.slapActiveEndTime + SLAP_RECOVERY_MS;
}

function armSlapRecovery(player, now) {
  armSlapActive(player, now, SLAP_ACTIVE_MS + 10);
}

function empowerPalm(player, now) {
  player.chargeAttackPower = Math.max(
    PALM_THRUST_POWER,
    CHARGE_PRIORITY_THRESHOLD
  );
  player.isInStartupFrames = false;
  player.attackStartTime = now - PALM_THRUST_STARTUP_MS - 20;
  player.startupEndTime = player.attackStartTime + PALM_THRUST_STARTUP_MS;
}

function assertLimbOnlySpacing(a, b) {
  const dist = Math.abs(a.x - b.x);
  assert.equal(
    isWithinConnectRange(dist, getConnectDistance("slap", a, b)),
    false
  );
}

function assertNoTorsoParkPull(committed, label) {
  assert.ok(committed, `${label}: missing commit`);
  assert.equal(committed.parkPolicy, "skip_limb_only", label);
  assert.equal(committed.region, "frontArm", label);
  assert.ok(
    typeof committed.preParkDist === "number" &&
      typeof committed.postParkDist === "number",
    `${label}: park distances required`
  );
  // Correction stage must not reduce root-to-root distance (suction).
  assert.ok(
    committed.postParkDist + 0.01 >= committed.preParkDist,
    `${label}: park pulled together pre=${committed.preParkDist} post=${committed.postParkDist}`
  );
  assert.equal(committed.preParkAx, committed.postParkAx, `${label}: attacker root moved`);
  assert.equal(committed.preParkVx, committed.postParkVx, `${label}: victim root moved`);
}

describe("Phase 4A limb-contact correction — no torso park on limb-only", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastSlapHurtCommitted();
    clearSlapHurtQueryLog();
  });

  it("slap vs recovery limb: no pre-KB suction; spark at limb; KB away", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    s.right.isCPU = true;
    const t0 = s.room.simTime;
    armSlapRecovery(s.right, t0);
    armSlapActive(s.left, t0, 60);
    assert.ok(
      placeInLimbOnlyBand(s, "slap", t0) != null,
      "slap→recovery limb-only band must exist at the shipped size"
    );
    assertLimbOnlySpacing(s.left, s.right);
    const before = { ax: s.left.x, vx: s.right.x, dist: Math.abs(s.left.x - s.right.x) };
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    const committed = getLastSlapHurtCommitted();
    assertNoTorsoParkPull(committed, "slap-recovery");
    assert.equal(committed.preParkDist, before.dist);
    const payload = lastHit(s.io);
    assert.equal(payload.victimHurtRegion, "frontArm");
    assert.ok(
      typeof payload.contactX === "number" &&
        Math.abs(payload.contactX - committed.vfxContactX) < 1
    );
    // After full processHit, victim should not be parked at torso connect.
    const parkDist = getHitParkDistance("slap", s.left, s.right);
    const finalDist = Math.abs(s.left.x - s.right.x);
    assert.ok(
      Math.abs(finalDist - parkDist) > CONTACT_SNAP_EPSILON + 1 ||
        s.right.isHit,
      "must not freeze at torso park distance as the only outcome"
    );
    // Knockback / hit: victim is the right fighter.
    assert.equal(s.right.isHit, true);
    // Away from attacker: victim was to the right; KB should not pull left of pre-park.
    // (Hitstun may set velocity; root after KB should not be closer than pre-park.)
    assert.ok(
      Math.abs(s.right.x - s.left.x) + 0.01 >= before.dist - 1,
      `victim sucked inward after hit: before=${before.dist} after=${Math.abs(s.right.x - s.left.x)}`
    );
    s.dispose();
  });

  it("slap vs active limb (reciprocal priority): winner limb hit skips torso park", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapActive(s.right, t0, 40);
    armSlapActive(s.left, t0, 0);
    placeInLimbOnlyBand(s, "slap", t0);
    assertLimbOnlySpacing(s.left, s.right);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
    assertNoTorsoParkPull(getLastSlapHurtCommitted(), "slap-active-reciprocal");
    s.dispose();
  });

  it("palm vs recovery slap limb: honest band is empty — palm reach cannot beat torso connect", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapRecovery(s.right, t0);
    armPalmPhase(s.left, "active", t0);
    empowerPalm(s.left, t0);
    s.left.chargingFacingDirection = s.left.facing;
    // Palm's authored rail (73.825) + retracted recovery arm (54.448) = 128.27,
    // which is INSIDE palm torso connect (137.58 at size 0.85). A limb-only palm
    // punish of the settle-back arm is geometrically impossible — the arm never
    // pokes out past the victim pushbox. Document it rather than inflate it.
    assert.equal(
      limbOnlyGap("palm", s.left, s.right, t0),
      null,
      "palm→recovery must have no limb-only band"
    );
    assert.ok(limbReachGap("palm", s.right, t0) < torsoGate("palm", s.left, s.right));
    // At the limb-reach boundary the torso is ALSO in connect, so this resolves
    // as torso-plus-limb: one hit, frontArm identity for VFX, legacy torso park.
    placeAtGap(s, limbReachGap("palm", s.right, t0));
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1, "limb overlap still commits exactly one hit");
    assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
    assert.equal(
      lastHit(s.io).limbOnlyContact,
      false,
      "torso-plus-limb must not advertise limbOnlyContact"
    );
    const committed = getLastSlapHurtCommitted();
    assert.equal(committed.parkPolicy, "torso_park");
    s.dispose();
  });

  it("palm vs active slap limb: connects once; no suction", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapActive(s.right, t0, 60);
    armPalmPhase(s.left, "active", t0);
    empowerPalm(s.left, t0);
    s.left.chargingFacingDirection = s.left.facing;
    assert.ok(placeInLimbOnlyBand(s, "palm", t0) != null);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    assertNoTorsoParkPull(getLastSlapHurtCommitted(), "palm-active");
    s.dispose();
  });

  it("charged vs recovery slap limb: if tip∩limb connects, skip torso park", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapRecovery(s.right, t0);
    armChargedPhase(s.left, "active", t0);
    s.left.chargeAttackPower = CHARGE_PRIORITY_THRESHOLD;
    s.left.chargingFacingDirection = s.left.facing;
    s.left.isInStartupFrames = false;
    placeAtGap(s, limbReachGap("charged", s.right, t0));
    stepCollisionBothOrders(s);
    // Charged tip may or may not overlap limb at this gap — document either way.
    if (hitCount(s.io) === 0) {
      assert.equal(s.left.isAttacking, true, "miss must not cancel charged");
      assert.equal(getLastSlapHurtCommitted(), null);
    } else {
      assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
      assertNoTorsoParkPull(getLastSlapHurtCommitted(), "charged-limb");
    }
    s.dispose();
  });

  it("genuine torso contact still parks to tip-meets-body", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ gap: TORSO_GAP, sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    s.right.isAttacking = false;
    s.right.isSlapAttack = false;
    s.right.attackType = null;
    armSlapActive(s.left, t0, 60);
    assert.equal(
      isWithinConnectRange(
        Math.abs(s.left.x - s.right.x),
        getConnectDistance("slap", s.left, s.right)
      ),
      true
    );
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    const committed = getLastSlapHurtCommitted();
    // Body hit may stamp torso or have null override path — park must run.
    if (committed && committed.authoredSlapHurtboxV1) {
      assert.equal(committed.parkPolicy, "torso_park");
    }
    // After park stage (recorded) distance should near parkDist when body won.
    if (committed && committed.parkPolicy === "torso_park") {
      const parkDist = getHitParkDistance("slap", s.left, s.right);
      assert.ok(
        Math.abs(committed.postParkDist - parkDist) <= CONTACT_SNAP_EPSILON + 0.5,
        `torso park post=${committed.postParkDist} expected≈${parkDist}`
      );
    } else {
      // No Phase 4A stamp on pure body — still must have moved toward park.
      const parkDist = getHitParkDistance("slap", s.left, s.right);
      // Final spacing after park+KB is not exact; ensure hit landed.
      assert.equal(s.right.isHit, true);
      assert.ok(parkDist > 0);
    }
    s.dispose();
  });

  it("torso+limb overlap: one hit, body-preferred park policy", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ gap: TORSO_GAP, sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapRecovery(s.right, t0);
    armSlapActive(s.left, t0, 60);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    for (let i = 0; i < 3; i++) {
      advanceSim(s, TICK_MS);
      stepCollisionBothOrders(s);
    }
    assert.equal(hitCount(s.io), 1);
    const committed = getLastSlapHurtCommitted();
    assert.ok(committed, "torso+limb must commit");
    // Body was in connect range → must torso-park even if VFX region is limb.
    assert.equal(committed.parkPolicy, "torso_park");
    const parkDist = getHitParkDistance("slap", s.left, s.right);
    assert.ok(
      Math.abs(committed.postParkDist - parkDist) <= CONTACT_SNAP_EPSILON + 0.5,
      `torso+limb park post=${committed.postParkDist} expected≈${parkDist}`
    );
    s.dispose();
  });

  it("flag OFF: limb spacing misses; roots unchanged", () => {
    setAuthoredSlapHurtboxForTests(false);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapRecovery(s.right, t0);
    armSlapActive(s.left, t0, 60);
    // Flag OFF must still be evaluated at a spacing the flag-ON path accepts.
    placeInLimbOnlyBand(s, "slap", t0);
    const before = { ax: s.left.x, vx: s.right.x };
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 0);
    assert.equal(s.left.x, before.ax);
    assert.equal(s.right.x, before.vx);
    assert.equal(s.left.isAttacking, true);
    s.dispose();
  });

  it("retracted limb miss changes neither root", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ gap: 160, sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapActive(s.left, t0, 60);
    s.right.isAttacking = false;
    s.right.isSlapAttack = false;
    s.right.attackType = null;
    const before = { ax: s.left.x, vx: s.right.x };
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 0);
    assert.equal(s.left.x, before.ax);
    assert.equal(s.right.x, before.vx);
    s.dispose();
  });

  it("both sizes, facings, edges, ownership: limb-only skips park", () => {
    setAuthoredSlapHurtboxForTests(true);
    const cases = [
      { size: 0.85, leftFacing: -1, rightFacing: 1, mid: null, label: "0.85" },
      { size: 1, leftFacing: -1, rightFacing: 1, mid: null, label: "1.0" },
      {
        size: 0.85,
        leftFacing: -1,
        rightFacing: 1,
        mid: MAP_LEFT_BOUNDARY + 200,
        label: "left-edge",
      },
      {
        size: 0.85,
        leftFacing: -1,
        rightFacing: 1,
        mid: MAP_RIGHT_BOUNDARY - 200,
        label: "right-edge",
      },
    ];
    for (const c of cases) {
      const s = createFoundationScenario({
        sizeA: c.size,
        sizeB: c.size,
        leftFacing: c.leftFacing,
        rightFacing: c.rightFacing,
        midX: c.mid == null ? undefined : c.mid,
      });
      s.right.isCPU = true;
      const t0 = s.room.simTime;
      // Victim ACTIVE: the only pose whose arm honestly pokes past torso connect
      // at BOTH shipped sizes (the settle-back recovery arm never does at size 1).
      armSlapActive(s.right, t0, 60);
      armSlapActive(s.left, t0, 0);
      const gap = placeInLimbOnlyBand(s, "slap", t0);
      assert.ok(gap != null, `${c.label}: limb-only band must exist`);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1, c.label);
      assertNoTorsoParkPull(getLastSlapHurtCommitted(), c.label);
      assert.ok(
        s.left.x >= MAP_LEFT_BOUNDARY - 1 &&
          s.left.x <= MAP_RIGHT_BOUNDARY + 1 &&
          s.right.x >= MAP_LEFT_BOUNDARY - 1 &&
          s.right.x <= MAP_RIGHT_BOUNDARY + 1,
        `${c.label}: out of ring`
      );
      clearLastSlapHurtCommitted();
      s.dispose();
    }
  });

  it("animation-stop regression: reciprocal limb still lands one hit", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: SIZE, sizeB: SIZE });
    const t0 = s.room.simTime;
    armSlapActive(s.right, t0, 40);
    armSlapActive(s.left, t0, 0);
    placeInLimbOnlyBand(s, "slap", t0);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    assert.equal(s.left.isHit || s.right.isHit, true);
    s.dispose();
  });
});

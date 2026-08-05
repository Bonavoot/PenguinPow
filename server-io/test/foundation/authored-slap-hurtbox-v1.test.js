"use strict";

/**
 * Phase 4A — AUTHORED_SLAP_HURTBOX_V1 (Phase 4C: default ON, explicit-OFF rollback).
 * Real checkCollision / processHit path; shared JSON limb geometry.
 */

const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setAuthoredSlapHurtboxForTests,
  isAuthoredSlapHurtboxV1Enabled,
  parseAuthoredSlapHurtboxFlag,
  AUTHORED_SLAP_HURTBOX_V1,
} = require("../../authoredSlapHurtboxFlags");
const {
  resolveSlapLimbExposure,
  evaluateTipVersusSlapLimb,
  resolveAuthoredSlapHurtContact,
  getLastAuthoredSlapHurtResolve,
  clearLastAuthoredSlapHurtResolve,
  selectWinningVictimContact,
  getSlapHurtQueryLog,
  clearSlapHurtQueryLog,
  getLastSlapHurtCommitted,
  clearLastSlapHurtCommitted,
  isSlapTipLive,
  querySlapOffensiveContact,
  isPhase4aSlapPoseAuthorityReady,
  EXPOSED_SLAP_POSES,
} = require("../../authoredSlapHurtTarget");
const authoredCatalog = require("../../../shared/combatVolumeAuthored.json");
const { checkCollision, evaluateHitCallouts } = require("../../collisionSystem");
const {
  getConnectDistance,
  isWithinConnectRange,
} = require("../../strikeContact");
const { COMBAT_VOLUME_KIND } = require("../../combatVolumeVocabulary");
const {
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  AP_LATE_PARRY_MS,
  CHARGE_PRIORITY_THRESHOLD,
  PALM_THRUST_POWER,
  PALM_THRUST_STARTUP_MS,
  TICK_RATE,
} = require("../../constants");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  armChargedPhase,
  stepCollisionBothOrders,
} = require("./helpers/scenarioHarness");
const {
  limbReachGap,
  limbOnlyGap,
  torsoGate,
  visibleTouchGap,
} = require("./helpers/limbSpacing");

const TICK_MS = 1000 / TICK_RATE;

function sc(opts) {
  return createFoundationScenario(opts);
}

/** Past AP late-parry grace so open slap hits confirm immediately. */
function deepenSlapActive(player, now) {
  player.isInStartupFrames = false;
  player.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 20;
  player.slapActiveEndTime =
    player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  player.attackEndTime = player.slapActiveEndTime + SLAP_RECOVERY_MS;
}

/**
 * Palm uses production power (≥ CHARGE_PRIORITY_THRESHOLD) so it can hit slap,
 * and stamps startupEndTime so the charged-startup fallback does not false-gate it.
 */
function empowerPalm(player, now) {
  player.chargeAttackPower = PALM_THRUST_POWER;
  player.isInStartupFrames = false;
  if (typeof now === "number") {
    player.attackStartTime = now - PALM_THRUST_STARTUP_MS - 20;
    player.startupEndTime = player.attackStartTime + PALM_THRUST_STARTUP_MS;
  } else if (!player.startupEndTime) {
    player.startupEndTime = (player.attackStartTime || 0) + PALM_THRUST_STARTUP_MS;
  }
}

/** Re-space to an exact root gap, preserving which fighter is on which side. */
function placeGap(s, gap) {
  const mid = (s.left.x + s.right.x) / 2;
  const leftSign = s.left.x <= s.right.x ? -1 : 1;
  s.left.x = mid + (leftSign * gap) / 2;
  s.right.x = mid - (leftSign * gap) / 2;
}

/**
 * Phase 4A spacing is DERIVED from live authored geometry, never literal. The
 * old fixtures used gap 160, which is only reachable while the authored limb
 * over-reaches its own art. `attacker` defaults to s.left, `victim` to s.right.
 */
function placeLimbContact(s, kind, simTime, opts = {}) {
  const victim = opts.victim || s.right;
  const reach = limbReachGap(kind, victim, simTime);
  if (reach == null) return null;
  // Sit just inside the outer edge so the limb overlap is unambiguous.
  const gap = reach - (opts.inset == null ? 0.25 : opts.inset);
  placeGap(s, gap);
  return gap;
}

/** Mid-band limb-ONLY spacing, or null when torso connect encloses the limb. */
function placeLimbOnly(s, kind, simTime, opts = {}) {
  const attacker = opts.attacker || s.left;
  const victim = opts.victim || s.right;
  const gap = limbOnlyGap(kind, attacker, victim, simTime, opts.bias);
  if (gap == null) return null;
  placeGap(s, gap);
  return gap;
}

/**
 * Victim holds an ACTIVE slap so the extended arm is exposed, but its own
 * offensive rail points AWAY — no reciprocal tip contest to muddy the limb
 * assertion. The arm's mirror still faces the attacker, so it stays a hittable
 * surface. (Active is the only pose with a limb-only band at BOTH shipped sizes.)
 */
function armExposedActiveLimb(victim, attacker, now) {
  armSlapPhase(victim, "active", now);
  deepenSlapActive(victim, now);
  const limbTowardAttacker = attacker.x < victim.x ? 1 : -1;
  victim.slapFacingDirection = limbTowardAttacker;
  victim.facing = -limbTowardAttacker;
}

function hitCount(io) {
  return io.find("player_hit").length;
}

function lastHit(io) {
  const hit = io.last("player_hit");
  return hit ? hit.payload : null;
}

describe("Phase 4A — slap-only readiness allowlist", () => {
  it("catalog marks only slap_active + slap_recovery for Phase 4A authority", () => {
    assert.deepEqual(authoredCatalog.meta.phase4aSlapAllowlist, [
      "slap_active",
      "slap_recovery",
    ]);
    assert.equal(authoredCatalog.poses.slap_active.phase4aAuthority, true);
    assert.equal(authoredCatalog.poses.slap_recovery.phase4aAuthority, true);
    assert.notEqual(
      authoredCatalog.poses.slap_startup.phase4aAuthority,
      true,
      "startup must not be Phase 4A authority-ready"
    );
    for (const key of Object.keys(authoredCatalog.poses)) {
      if (key === "slap_active" || key === "slap_recovery") continue;
      assert.notEqual(
        authoredCatalog.poses[key].phase4aAuthority,
        true,
        `${key} must remain legacy/shadow`
      );
    }
  });

  it("server allowlist matches catalog and rejects startup", () => {
    assert.equal(isPhase4aSlapPoseAuthorityReady("slap_active"), true);
    assert.equal(isPhase4aSlapPoseAuthorityReady("slap_recovery"), true);
    assert.equal(isPhase4aSlapPoseAuthorityReady("slap_startup"), false);
    assert.equal(isPhase4aSlapPoseAuthorityReady("palm_active"), false);
    assert.equal(isPhase4aSlapPoseAuthorityReady("charged_active"), false);
    assert.deepEqual(Object.keys(EXPOSED_SLAP_POSES).sort(), [
      "slap_active",
      "slap_recovery",
    ]);
  });
});

describe("Phase 4A — AUTHORED_SLAP_HURTBOX_V1 flag", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastAuthoredSlapHurtResolve();
  });

  // Phase 4C graduated the default: the feature is ON unless a recognized OFF
  // spelling is given. Only those four spellings are the legacy rollback.
  it("unset / empty → ON, matching an explicit ON", () => {
    assert.equal(parseAuthoredSlapHurtboxFlag(undefined), true);
    assert.equal(parseAuthoredSlapHurtboxFlag(null), true);
    assert.equal(parseAuthoredSlapHurtboxFlag(""), true);
    assert.equal(
      parseAuthoredSlapHurtboxFlag(undefined),
      parseAuthoredSlapHurtboxFlag("1"),
      "unset must be indistinguishable from explicit ON"
    );
  });

  it("every supported explicit-OFF spelling is the legacy rollback", () => {
    for (const raw of ["0", "false", "off", "no"]) {
      assert.equal(parseAuthoredSlapHurtboxFlag(raw), false, raw);
      // Project convention: case and surrounding whitespace are ignored.
      assert.equal(parseAuthoredSlapHurtboxFlag(raw.toUpperCase()), false, raw);
      assert.equal(parseAuthoredSlapHurtboxFlag(`  ${raw}  `), false, raw);
    }
  });

  it("every supported explicit-ON spelling stays ON", () => {
    for (const raw of ["1", "true", "on", "yes"]) {
      assert.equal(parseAuthoredSlapHurtboxFlag(raw), true, raw);
      assert.equal(parseAuthoredSlapHurtboxFlag(raw.toUpperCase()), true, raw);
      assert.equal(parseAuthoredSlapHurtboxFlag(` ${raw} `), true, raw);
    }
  });

  it("malformed values fall back to the shipped default, never to silent legacy", () => {
    for (const raw of ["nope", "2", "-1", "onn", "disabled"]) {
      assert.equal(parseAuthoredSlapHurtboxFlag(raw), true, raw);
    }
  });

  it("the module-level constant reflects the graduated default", () => {
    // Process env is not set in the suite, so this is the shipped default.
    assert.equal(process.env.AUTHORED_SLAP_HURTBOX_V1, undefined);
    assert.equal(AUTHORED_SLAP_HURTBOX_V1, true);
    setAuthoredSlapHurtboxForTests(null);
    assert.equal(isAuthoredSlapHurtboxV1Enabled(), true, "unset resolves ON");
  });

  it("an explicit env value still wins over the default at query time", () => {
    setAuthoredSlapHurtboxForTests(null);
    for (const raw of ["0", "false", "off", "no"]) {
      assert.equal(isAuthoredSlapHurtboxV1Enabled(raw), false, raw);
    }
    for (const raw of ["1", "true", "on", "yes"]) {
      assert.equal(isAuthoredSlapHurtboxV1Enabled(raw), true, raw);
    }
  });

  it("test override enables and disables without env", () => {
    setAuthoredSlapHurtboxForTests(false);
    assert.equal(isAuthoredSlapHurtboxV1Enabled(), false);
    setAuthoredSlapHurtboxForTests(true);
    assert.equal(isAuthoredSlapHurtboxV1Enabled(), true);
  });
});

describe("Phase 4A — exposure + geometry helpers", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastAuthoredSlapHurtResolve();
  });

  it("startup not exposed; active + recovery exposed; neutral not exposed", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.left, "startup", now);
    assert.equal(resolveSlapLimbExposure(s.left, now).exposed, false);
    armSlapPhase(s.left, "active", now);
    assert.equal(resolveSlapLimbExposure(s.left, now).poseKey, "slap_active");
    armSlapPhase(s.left, "recovery", now);
    assert.equal(resolveSlapLimbExposure(s.left, now).poseKey, "slap_recovery");
    s.left.isSlapAttack = false;
    s.left.isAttacking = false;
    s.left.attackType = null;
    s.left.currentAction = null;
    assert.equal(resolveSlapLimbExposure(s.left, now).exposed, false);
    s.dispose();
  });

  it("winning contact prefers earlier tip distance; body wins equal dist", () => {
    const w1 = selectWinningVictimContact({
      bodyEligible: true,
      bodyContactX: 600,
      bodyDist: 20,
      limb: {
        hit: true,
        contactX: 610,
        tipX: 605,
        victimRegion: "frontArm",
      },
    });
    assert.equal(w1.victimRegion, "frontArm");
    const w2 = selectWinningVictimContact({
      bodyEligible: true,
      bodyContactX: 600,
      bodyDist: 5,
      limb: {
        hit: true,
        contactX: 610,
        tipX: 600,
        victimRegion: "frontArm",
      },
    });
    assert.equal(w2.victimKind, COMBAT_VOLUME_KIND.HURT_BODY);
  });
});

describe("Phase 4A — flag OFF preserves legacy contact", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
  });

  it("flag unset: limb-range miss stays a miss", () => {
    setAuthoredSlapHurtboxForTests(false);
    const s = sc({ gap: 160, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    // Right extends slap limb; left active slap at whiff spacing.
    armSlapPhase(s.right, "recovery", now);
    armSlapPhase(s.left, "active", now);
    // Ensure left's slap started later so trade priority doesn't stuff oddly —
    // body is out of range anyway.
    s.left.attackStartTime = now - 60;
    s.right.attackStartTime = now - 200;
    const dist = Math.abs(s.right.x - s.left.x);
    const connect = getConnectDistance("slap", s.left, s.right);
    assert.equal(isWithinConnectRange(dist, connect), false);
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, false);
    assert.equal(hitCount(s.io), 0);
    s.dispose();
  });

  it("flag OFF: torso connect still works (golden size 0.85)", () => {
    setAuthoredSlapHurtboxForTests(false);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    s.right.isAttacking = false;
    s.right.isSlapAttack = false;
    s.right.attackType = null;
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, true);
    assert.equal(hitCount(s.io), 1);
    s.dispose();
  });
});

describe("Phase 4A — flag ON slap limb authority", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));
  afterEach(() => {
    clearLastAuthoredSlapHurtResolve();
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  it("limb-only during recovery: slap tip hits exposed recovery limb once", () => {
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    // Slap is the ONLY attacker whose authored rail out-reaches legacy torso
    // connect against the retracted recovery arm, and only at size 0.85.
    // Palm's rail loses to its own legacy torso overhang — see the
    // "recovery limb is enclosed by torso connect" test below.
    assert.ok(
      placeLimbOnly(s, "slap", now) != null,
      "slap→recovery limb-only band must exist at 0.85"
    );
    const dist = Math.abs(s.right.x - s.left.x);
    assert.equal(
      isWithinConnectRange(dist, getConnectDistance("slap", s.left, s.right)),
      false,
      "must be body-whiff spacing"
    );
    const limb = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "slap",
    });
    assert.ok(limb && limb.hit, "tip must overlap recovery limb");
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, true);
    assert.equal(hitCount(s.io), 1);
    const payload = lastHit(s.io);
    assert.equal(payload.victimHurtRegion, "frontArm");
    assert.equal(payload.isPunish, true);
    assert.equal(payload.limbOnlyContact, true);
    // Consumed — no second hit from the same attack lifecycle.
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(hitCount(s.io), 1);
    s.dispose();
  });

  it("recovery limb-only band: palm never, size 1 never, slap/charged only at 0.85", () => {
    // The settle-back arm (54.448) barely clears the pushbox. Documented honest
    // matrix — no pairing here may be widened to manufacture a punish window.
    const expected = {
      "1|slap": false,
      "1|palm": false,
      "1|charged": false,
      "0.85|slap": true,
      "0.85|palm": false,
      "0.85|charged": true,
    };
    for (const size of [1, 0.85]) {
      for (const kind of ["slap", "palm", "charged"]) {
        const s = sc({ sizeA: size, sizeB: size });
        const now = s.room.simTime;
        armSlapPhase(s.right, "recovery", now);
        empowerPalm(s.left, now);
        const reach = limbReachGap(kind, s.right, now);
        const gate = torsoGate(kind, s.left, s.right);
        assert.equal(
          reach > gate,
          expected[`${size}|${kind}`],
          `${kind}@${size}: reach ${reach.toFixed(3)} vs torso gate ${gate.toFixed(3)}`
        );
        s.dispose();
      }
    }
  });

  it("limb-only during active: slap tip geometry overlaps opponent active limb", () => {
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "active", now);
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    placeLimbOnly(s, "slap", now);
    const limb = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "slap",
    });
    assert.ok(limb && limb.hit);
    s.dispose();
  });

  it("startup limb not hittable (Phase 4A exposure gate)", () => {
    const s = sc({ gap: 160, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "startup", now);
    armPalmPhase(s.left, "active", now);
    empowerPalm(s.left, now);
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, false);
    assert.equal(hitCount(s.io), 0);
    s.dispose();
  });

  it("after recovery clears slap flags, limb not hittable", () => {
    const s = sc({ gap: 160, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    s.right.isSlapAttack = false;
    s.right.isAttacking = false;
    s.right.attackType = null;
    s.right.currentAction = null;
    armPalmPhase(s.left, "active", now);
    empowerPalm(s.left, now);
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, false);
    s.dispose();
  });

  it("torso + limb overlap → one hit", () => {
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "active", now);
    armPalmPhase(s.left, "active", now);
    empowerPalm(s.left, now);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    assert.equal(s.right.isHit, true);
    s.dispose();
  });

  it("region-array order independence via selectWinningVictimContact", () => {
    const a = selectWinningVictimContact({
      bodyEligible: true,
      bodyContactX: 1,
      bodyDist: 10,
      limb: { hit: true, contactX: 2, tipX: 0, victimRegion: "frontArm" },
    });
    const b = selectWinningVictimContact({
      bodyEligible: true,
      bodyContactX: 1,
      bodyDist: 10,
      limb: { hit: true, contactX: 2, tipX: 0, victimRegion: "frontArm" },
    });
    assert.deepEqual(a.victimRegion, b.victimRegion);
  });

  it("player-array order reversal: same limb hit victim", () => {
    // One scenario alive at a time — setSimRoomResolver is module-global, so a
    // second live scenario silently orphans the first one's room lookup.
    for (const swapPlayerOrder of [false, true]) {
      const s = sc({ sizeA: 0.85, sizeB: 0.85, swapPlayerOrder });
      const now = s.room.simTime;
      armExposedActiveLimb(s.right, s.left, now);
      armPalmPhase(s.left, "active", now);
      empowerPalm(s.left, now);
      placeLimbOnly(s, "palm", now);
      stepCollisionBothOrders(s);
      assert.equal(s.right.isHit, true, `swapPlayerOrder=${swapPlayerOrder}`);
      assert.equal(hitCount(s.io), 1, `swapPlayerOrder=${swapPlayerOrder}`);
      s.dispose();
    }
  });

  it("both facings: limb hit mirrors", () => {
    const s = sc({
      sizeA: 0.85,
      sizeB: 0.85,
      leftFacing: 1,
      rightFacing: -1,
    });
    // Swap sides so they still face each other with opposite facings
    const mid = (s.left.x + s.right.x) / 2;
    s.left.x = mid + 80;
    s.right.x = mid - 80;
    s.left.facing = 1;
    s.right.facing = -1;
    const now = s.room.simTime;
    armExposedActiveLimb(s.right, s.left, now);
    armPalmPhase(s.left, "active", now);
    empowerPalm(s.left, now);
    placeLimbOnly(s, "palm", now);
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, true);
    s.dispose();
  });

  it("size 1 limb-only still connects at whiff torso spacing", () => {
    const s = sc({ sizeA: 1, sizeB: 1 });
    const now = s.room.simTime;
    // Size 1 has a limb-only band only against the ACTIVE (extended) arm —
    // at size 1 the bigger pushbox swallows the retracted recovery arm entirely.
    armSlapPhase(s.right, "active", now);
    armPalmPhase(s.left, "active", now);
    empowerPalm(s.left, now);
    assert.ok(placeLimbOnly(s, "palm", now) != null);
    const dist = Math.abs(s.right.x - s.left.x);
    assert.equal(
      isWithinConnectRange(dist, getConnectDistance("palm", s.left, s.right)),
      false
    );
    const limb = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "palm",
    });
    assert.ok(limb && limb.hit, "size-1 tip must still reach limb at this gap");
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, true);
    s.dispose();
  });

  // Phase 4B authorizes the palm's HELD recovery pose, not its settled tail.
  // Once the art retracts the arm sits inside the pushbox, so authority must
  // fall back to exactly this legacy behaviour.
  it("settled palm recovery victim remains legacy (retracted arm, no limb window)", () => {
    const s = sc({ gap: 160, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armPalmPhase(s.right, "recovery_settled", now);
    armSlapPhase(s.left, "active", now);
    // Slap vs palm may have priority rules; body is out of range.
    const dist = Math.abs(s.right.x - s.left.x);
    assert.equal(
      isWithinConnectRange(dist, getConnectDistance("slap", s.left, s.right)),
      false
    );
    const limb = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "slap",
    });
    assert.equal(limb, null);
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, false);
    s.dispose();
  });

  it("charged victim remains legacy at limb spacing", () => {
    const s = sc({ gap: 160, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armChargedPhase(s.right, "active", now);
    armSlapPhase(s.left, "active", now);
    const limb = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "slap",
    });
    assert.equal(limb, null);
    s.dispose();
  });

  it("resolve mode reports authored when flag ON", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    armPalmPhase(s.left, "active", now);
    placeLimbContact(s, "palm", now);
    const r = resolveAuthoredSlapHurtContact(s.left, s.right, {
      simTime: now,
      attackKind: "palm",
      bodyEligible: false,
      bodyContactX: null,
      bodyDist: Math.abs(s.right.x - s.left.x),
    });
    assert.equal(r.mode, "authored_slap_hurtbox_v1");
    assert.equal(r.connect, true);
    assert.equal(r.winner.victimRegion, "frontArm");
    assert.ok(getLastAuthoredSlapHurtResolve());
    s.dispose();
  });

  it("P1 and P2 as limb owner both punishable", () => {
    for (const owner of ["left", "right"]) {
      const s = sc({ sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      const victim = owner === "left" ? s.left : s.right;
      const attacker = owner === "left" ? s.right : s.left;
      armSlapPhase(victim, "active", now);
      armPalmPhase(attacker, "active", now);
      empowerPalm(attacker, now);
      placeLimbOnly(s, "palm", now, { attacker, victim });
      stepCollisionBothOrders(s);
      assert.equal(victim.isHit, true, `${owner} limb owner must be hit`);
      s.dispose();
    }
  });
});

describe("Phase 4A — deterministic recovery-only limb punish", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));
  afterEach(() => {
    clearLastAuthoredSlapHurtResolve();
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  /**
   * Victim slap whiffs torso at gap 160; attacker palm tip becomes active
   * exactly when victim enters recovery. Boundary ticks around recovery exposure.
   */
  it("recovery limb: miss before attacker active, hit first/last recovery, miss after clear, PUNISH once", () => {
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const t0 = s.room.simTime;

    armSlapPhase(s.right, "recovery", t0);
    assert.equal(resolveSlapLimbExposure(s.right, t0).poseKey, "slap_recovery");
    // Spacing is the honest palm-vs-recovery-arm touch boundary. NOTE: the
    // retracted recovery arm sits inside palm's (legacy-overhang) torso connect,
    // so this is a torso-plus-limb contact — the authored limb still owns region
    // identity and the punish classification, but there is no limb-ONLY window.
    placeLimbContact(s, "palm", t0);

    // Attacker palm still in startup one tick before tip is live.
    armPalmPhase(s.left, "startup", t0);
    s.left.chargeAttackPower = PALM_THRUST_POWER;
    s.left.isInStartupFrames = true;
    s.left.attackStartTime = t0;
    s.left.startupEndTime = t0 + PALM_THRUST_STARTUP_MS;
    clearSlapHurtQueryLog();
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, false, "startup attacker must not connect");
    const startupQ = getSlapHurtQueryLog().filter(
      (q) => q.rejectReason === "startup-pending"
    );
    assert.ok(startupQ.length >= 1, "startup skip must log startup-pending");
    assert.equal(
      getSlapHurtQueryLog().some(
        (q) => q.rejectReason === "rejected/interrupted-before-active"
      ),
      false,
      "startup-pending must not be labeled interrupted-before-active"
    );

    // First recovery-exposure tick with attacker tip live.
    s.left.isInStartupFrames = false;
    s.left.attackStartTime = t0 - PALM_THRUST_STARTUP_MS - 20;
    s.left.startupEndTime = s.left.attackStartTime + PALM_THRUST_STARTUP_MS;
    s.right.isAlreadyHit = false;
    s.left.lastCheckedAttackTime = null;
    clearSlapHurtQueryLog();
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true, "first recovery tick must hit limb");
    assert.equal(hitCount(s.io), 1);
    const payload = lastHit(s.io);
    assert.equal(payload.victimHurtRegion, "frontArm");
    assert.equal(payload.victimHurtKind, COMBAT_VOLUME_KIND.HURT_LIMB);
    assert.equal(payload.victimSlapPhase, "recovery");
    assert.equal(payload.isPunish, true);
    assert.equal(payload.authoredSlapHurtboxV1, true);
    const committed = getLastSlapHurtCommitted();
    assert.ok(committed);
    assert.equal(committed.region, "frontArm");
    assert.equal(committed.victimPhase, "recovery");
    assert.equal(committed.consumption, "consumed_once");

    // Same unconsumed? Already consumed — must not double-hit.
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(hitCount(s.io), 1);

    // Fresh attack lifecycle on final recovery-exposure tick.
    // processHit clears victim slap flags + parks spacing + grants KB immunity
    // (palm VFX/emit sits behind canApplyKnockback). Restore contact spacing and
    // clear immunity so this proves the last exposed tick, not a ghost/immune.
    s.io.clear();
    armSlapPhase(s.right, "recovery", t0);
    s.right.isAlreadyHit = false;
    s.right.isHit = false;
    s.right.knockbackImmune = false;
    s.right.knockbackImmuneEndTime = 0;
    armPalmPhase(s.left, "active", t0);
    empowerPalm(s.left, t0);
    s.left.chargedAttackHit = false;
    s.left.lastCheckedAttackTime = null;
    // Re-space AFTER both fighters are armed — the probe reads committed
    // action-facing, and the first hit's contact park moved the roots.
    placeLimbContact(s, "palm", t0);
    assert.equal(resolveSlapLimbExposure(s.right, t0).exposed, true);
    assert.equal(resolveSlapLimbExposure(s.right, t0).phase, "recovery");
    assert.equal(
      evaluateTipVersusSlapLimb(s.left, s.right, {
        simTime: t0,
        attackKind: "palm",
      }).hit,
      true,
      "final tick tip must still overlap recovery limb"
    );
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true, "final recovery exposure tick must still hit");
    assert.ok(lastHit(s.io), "final tick must emit player_hit");
    assert.equal(lastHit(s.io).victimSlapPhase, "recovery");
    assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");

    // First tick after exposure ends — slap flags cleared. Back off past torso
    // connect so this proves the limb path went dead, not that the torso rail
    // happened to still reach.
    s.io.clear();
    placeGap(s, torsoGate("palm", s.left, s.right) + 5);
    s.right.isSlapAttack = false;
    s.right.isAttacking = false;
    s.right.attackType = null;
    s.right.currentAction = null;
    s.right.isAlreadyHit = false;
    s.right.isHit = false;
    s.right.knockbackImmune = false;
    s.right.knockbackImmuneEndTime = 0;
    armPalmPhase(s.left, "active", t0);
    empowerPalm(s.left, t0);
    s.left.chargedAttackHit = false;
    s.left.lastCheckedAttackTime = null;
    assert.equal(resolveSlapLimbExposure(s.right, t0).exposed, false);
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, false, "post-exposure must miss");
    assert.equal(hitCount(s.io), 0);

    s.dispose();
  });

  it("rejected startup query does not suppress later unconsumed active limb hit", () => {
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    placeLimbContact(s, "palm", now);
    armPalmPhase(s.left, "startup", now);
    s.left.chargeAttackPower = PALM_THRUST_POWER;
    s.left.isInStartupFrames = true;
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, false);
    assert.equal(s.right.isAlreadyHit, false);

    // Same attack lifecycle becomes active — must still be allowed to connect.
    s.left.isInStartupFrames = false;
    s.left.attackStartTime = now - PALM_THRUST_STARTUP_MS - 20;
    s.left.startupEndTime = s.left.attackStartTime + PALM_THRUST_STARTUP_MS;
    s.left.lastCheckedAttackTime = null;
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
    s.dispose();
  });
});

describe("Phase 4A — attacker-startup interruption diagnostics", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));
  afterEach(() => {
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  it("startup query is startup-pending; authoritative interrupt is opponent committed hit", () => {
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;

    armSlapPhase(s.right, "active", now);
    deepenSlapActive(s.right, now);

    armSlapPhase(s.left, "startup", now);
    s.left.isInStartupFrames = true;
    s.left.attackStartTime = now;
    s.left.slapActiveEndTime = now + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;

    clearSlapHurtQueryLog();
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, false);
    const pending = getSlapHurtQueryLog().find(
      (q) => q.rejectReason === "startup-pending"
    );
    assert.ok(pending, "startup skip must be startup-pending");
    assert.equal(pending.attackerPhase, "startup");
    assert.equal(
      getSlapHurtQueryLog().some(
        (q) => q.rejectReason === "rejected/interrupted-before-active"
      ),
      false,
      "must not invent interruption without event ID"
    );

    checkCollision(s.right, s.left, s.rooms, s.io);
    assert.equal(s.left.isHit, true, "startup attacker enters hitstun");
    assert.equal(s.right.isHit, false);
    const hit = lastHit(s.io);
    assert.ok(hit && hit.hitId, "authoritative interrupt requires committed hit ID");
    s.dispose();
  });
});

describe("Phase 4A — phantom cancellation: limb-only vs recovering slap", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastAuthoredSlapHurtResolve();
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  function snapshotFighter(p, now) {
    return {
      currentAction: p.currentAction,
      attackStartTime: p.attackStartTime,
      isAttacking: !!p.isAttacking,
      isSlapAttack: !!p.isSlapAttack,
      tipEligible: isSlapTipLive(p, now),
      limbExposed: resolveSlapLimbExposure(p, now).exposed,
      isAlreadyHit: !!p.isAlreadyHit,
      isHit: !!p.isHit,
      consumed: !!p._combatContactConsumed,
      interruptionReason:
        p._lastCombatContactResolution?.interruptionReason || null,
    };
  }

  function runLimbRetalVsRecovery(flagOn) {
    setAuthoredSlapHurtboxForTests(flagOn);
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;

    armSlapPhase(s.right, "recovery", now);
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    s.left.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 10;
    s.left.slapActiveEndTime =
      s.left.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    s.left.attackEndTime = s.left.slapActiveEndTime + SLAP_RECOVERY_MS;
    assert.ok(
      s.left.attackStartTime > s.right.attackStartTime,
      "left must be the later slap"
    );
    // Slap is the one attacker whose authored rail out-reaches legacy torso
    // connect against the retracted recovery arm (and only at size 0.85), so
    // this stays a genuine limb-only punish under the corrected geometry.
    const limbOnly = placeLimbOnly(s, "slap", now);
    assert.ok(limbOnly != null, "slap→recovery limb-only band must exist");
    const lx0 = s.left.x;
    const rx0 = s.right.x;
    assert.equal(
      isWithinConnectRange(
        Math.abs(s.right.x - s.left.x),
        getConnectDistance("slap", s.left, s.right)
      ),
      false,
      "torso must miss inside the limb-only band"
    );
    const limb = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "slap",
    });
    if (flagOn) {
      assert.ok(limb && limb.hit, "flag ON: tip must overlap recovery limb");
    }

    const before = {
      left: snapshotFighter(s.left, now),
      right: snapshotFighter(s.right, now),
    };
    clearSlapHurtQueryLog();
    stepCollisionBothOrders(s);
    const after = {
      left: snapshotFighter(s.left, now),
      right: snapshotFighter(s.right, now),
      hits: hitCount(s.io),
      hitPayload: lastHit(s.io),
    };

    let laterConnectHits = null;
    if (!after.right.isHit && after.left.isAttacking) {
      s.io.clear();
      s.right.isAlreadyHit = false;
      s.left.lastCheckedAttackTime = null;
      deepenSlapActive(s.left, now);
      s.left.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 10;
      s.left.slapActiveEndTime =
        s.left.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
      s.left.x = lx0;
      s.right.x = rx0;
      checkCollision(s.left, s.right, s.rooms, s.io);
      laterConnectHits = hitCount(s.io);
    }

    return {
      before,
      after,
      laterConnectHits,
      dispose: () => s.dispose(),
    };
  }

  it("flag OFF: later slap vs recovering limb-range opponent is not phantom-cancelled", () => {
    const r = runLimbRetalVsRecovery(false);
    assert.equal(r.after.hits, 0, "body miss — no committed hit");
    assert.equal(r.after.right.isHit, false);
    assert.equal(
      r.after.left.isAttacking,
      true,
      "later slap must remain live when flag OFF (no limb candidate)"
    );
    assert.equal(r.after.left.consumed, false);
    assert.equal(r.after.left.interruptionReason, null);
    r.dispose();
  });

  it("flag ON: limb candidate vs recovering slap must commit PUNISH — never phantom cancel", () => {
    const r = runLimbRetalVsRecovery(true);
    const phantomCancel =
      !r.after.left.isAttacking &&
      !r.after.right.isHit &&
      r.after.hits === 0 &&
      r.after.left.interruptionReason === "LATER_SLAP_STUFFED";
    assert.equal(
      phantomCancel,
      false,
      "PHANTOM ACTION CANCELLATION: later slap stuffed by tip-dead recovery slap"
    );
    assert.equal(r.after.hits, 1, "limb-only recovery retal must commit");
    assert.equal(r.after.right.isHit, true);
    assert.equal(r.after.hitPayload.victimHurtRegion, "frontArm");
    assert.equal(r.after.hitPayload.isPunish, true);
    assert.equal(r.after.hitPayload.victimSlapPhase, "recovery");
    r.dispose();
  });

  it("flag ON vs OFF: ON commits punish; OFF whiffs without cancelling later slap", () => {
    const off = runLimbRetalVsRecovery(false);
    const on = runLimbRetalVsRecovery(true);
    assert.equal(off.after.left.isAttacking, true);
    assert.equal(off.after.hits, 0);
    assert.equal(on.after.hits, 1);
    assert.equal(on.after.hitPayload.isPunish, true);
    off.dispose();
    on.dispose();
  });
});

describe("Phase 4A — active-end boundary (slapActiveEndTime exclusivity)", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastAuthoredSlapHurtResolve();
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  /**
   * Recording 22–24s case: victim slapActiveEndTime === now at attacker's
   * first active tick; torso out of range; limb in range when flag ON.
   */
  function armVictimAtActiveEnd(victim, now, offsetMs) {
    const end = now - offsetMs;
    victim.isAttacking = true;
    victim.isSlapAttack = true;
    victim.attackType = "slap";
    victim.slapAnimation = 1;
    victim.slapFacingDirection = victim.facing;
    victim.currentAction = "slap";
    victim.isInStartupFrames = false;
    victim.slapActiveEndTime = end;
    victim.attackStartTime = end - SLAP_STARTUP_MS - SLAP_ACTIVE_MS;
    victim.attackEndTime = end + SLAP_RECOVERY_MS;
    return victim;
  }

  function armAttackerFirstActive(attacker, now) {
    attacker.isAttacking = true;
    attacker.isSlapAttack = true;
    attacker.attackType = "slap";
    attacker.slapAnimation = 1;
    attacker.slapFacingDirection = attacker.facing;
    attacker.currentAction = "slap";
    attacker.isInStartupFrames = false;
    // First active tick: just past startup, deep enough for open-hit grace.
    attacker.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 1;
    attacker.slapActiveEndTime =
      attacker.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    attacker.attackEndTime =
      attacker.slapActiveEndTime + SLAP_RECOVERY_MS;
    return attacker;
  }

  function runBoundaryCase(opts) {
    const {
      flagOn,
      offsetMs,
      swapFacing = false,
      swapOwners = false,
      swapPlayerOrder = false,
      gap = null,
    } = opts;
    setAuthoredSlapHurtboxForTests(flagOn);
    const s = sc({
      ...(gap != null ? { gap } : {}),
      sizeA: 0.85,
      sizeB: 0.85,
      swapPlayerOrder,
      leftFacing: swapFacing ? 1 : -1,
      rightFacing: swapFacing ? -1 : 1,
    });
    const now = s.room.simTime;
    const victim = swapOwners ? s.left : s.right;
    const attacker = swapOwners ? s.right : s.left;
    armVictimAtActiveEnd(victim, now, offsetMs);
    armAttackerFirstActive(attacker, now);
    // Attacker must be the later slap vs victim's earlier cycle.
    assert.ok(attacker.attackStartTime > victim.attackStartTime);
    // Default spacing is the honest limb-only band for THIS victim pose, derived
    // after arming. Callers passing an explicit `gap` are testing torso spacing.
    if (gap == null) {
      assert.ok(
        placeLimbOnly(s, "slap", now, { attacker, victim }) != null,
        `limb-only band must exist at offsetMs=${offsetMs}`
      );
    }

    const tipLive = isSlapTipLive(victim, now);
    const exposure = resolveSlapLimbExposure(victim, now);
    const bodyInRange = isWithinConnectRange(
      Math.abs(victim.x - attacker.x),
      getConnectDistance("slap", attacker, victim)
    );
    const limb = evaluateTipVersusSlapLimb(attacker, victim, {
      simTime: now,
      attackKind: "slap",
    });

    s.io.clear();
    clearSlapHurtQueryLog();
    stepCollisionBothOrders(s);
    const hits = hitCount(s.io);
    const payload = lastHit(s.io);
    const attackerConsumed =
      !!attacker._combatContactConsumed &&
      attacker._lastCombatContactResolution?.interruptionReason ===
        "LATER_SLAP_STUFFED";

    // Following tick must not duplicate.
    let dupHits = 0;
    if (hits >= 1) {
      const before = hits;
      checkCollision(attacker, victim, s.rooms, s.io);
      dupHits = hitCount(s.io) - before;
    }

    return {
      s,
      now,
      victim,
      attacker,
      tipLive,
      exposure,
      bodyInRange,
      limb,
      hits,
      payload,
      attackerConsumed,
      attackerStillAttacking: !!attacker.isAttacking,
      dupHits,
      dispose: () => s.dispose(),
    };
  }

  it("isSlapTipLive / recovery exclusivity around slapActiveEndTime", () => {
    const s = sc({ gap: 160, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armVictimAtActiveEnd(s.right, now, 0); // end === now
    assert.equal(isSlapTipLive(s.right, now - TICK_MS), true, "tick before: tip live");
    assert.equal(
      resolveSlapLimbExposure(s.right, now - TICK_MS).phase,
      "active",
      "tick before: phase active"
    );
    assert.equal(isSlapTipLive(s.right, now), false, "equality: tip NOT live");
    assert.equal(
      resolveSlapLimbExposure(s.right, now).phase,
      "recovery",
      "equality: phase recovery only"
    );
    assert.equal(
      isSlapTipLive(s.right, now) &&
        resolveSlapLimbExposure(s.right, now).phase === "active",
      false,
      "equality must never be both tip-live and active"
    );
    assert.equal(isSlapTipLive(s.right, now + TICK_MS), false, "tick after: tip dead");
    assert.equal(
      resolveSlapLimbExposure(s.right, now + TICK_MS).phase,
      "recovery",
      "tick after: recovery"
    );
    s.dispose();
  });

  it("ON @ equality: recovery limb PUNISH once; attacker not priority-consumed", () => {
    const r = runBoundaryCase({ flagOn: true, offsetMs: 0 });
    assert.equal(r.bodyInRange, false);
    assert.equal(r.tipLive, false);
    assert.equal(r.exposure.phase, "recovery");
    assert.ok(r.limb && r.limb.hit);
    assert.equal(r.attackerConsumed, false);
    assert.equal(r.hits, 1);
    assert.equal(r.payload.victimHurtRegion, "frontArm");
    assert.equal(r.payload.victimHurtKind, COMBAT_VOLUME_KIND.HURT_LIMB);
    assert.equal(r.payload.victimSlapPhase, "recovery");
    assert.equal(r.payload.isPunish, true);
    assert.equal(r.payload.authoredSlapHurtboxV1, true);
    assert.ok(r.payload.hitId);
    assert.equal(r.dupHits, 0, "no duplicate on following tick");
    r.dispose();
  });

  it("OFF @ equality: torso miss; attacker slap remains live; not canceled", () => {
    const r = runBoundaryCase({ flagOn: false, offsetMs: 0 });
    assert.equal(r.bodyInRange, false);
    assert.equal(r.hits, 0);
    assert.equal(r.attackerConsumed, false);
    assert.equal(r.attackerStillAttacking, true);
    assert.equal(r.victim.isHit, false);
    r.dispose();
  });

  it("ON one tick before end: victim tip still live (active)", () => {
    // offsetMs = now - slapActiveEndTime; negative ⇒ end still in the future.
    const r = runBoundaryCase({ flagOn: true, offsetMs: -TICK_MS });
    assert.equal(r.tipLive, true, "tick before end: tip live");
    assert.equal(r.exposure.phase, "active", "tick before end: phase active");
    assert.equal(
      r.tipLive && r.exposure.phase === "recovery",
      false,
      "tick before must not be recovery"
    );
    r.dispose();
  });

  it("ON one tick after end: recovery limb PUNISH (tip dead)", () => {
    // offsetMs positive ⇒ slapActiveEndTime already passed.
    const r = runBoundaryCase({ flagOn: true, offsetMs: TICK_MS });
    assert.equal(r.tipLive, false);
    assert.equal(r.exposure.phase, "recovery");
    assert.equal(r.attackerConsumed, false);
    assert.equal(r.hits, 1);
    assert.equal(r.payload.isPunish, true);
    assert.equal(r.payload.victimHurtRegion, "frontArm");
    r.dispose();
  });

  it("startup opponent cannot act as live competing slap", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    // Opponent started recently — still in startup (tip dead).
    armSlapPhase(s.right, "startup", now);
    s.right.attackStartTime = now - 20;
    s.right.slapActiveEndTime =
      s.right.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    assert.equal(isSlapTipLive(s.right, now), false);
    // Attacker already deep in active (started earlier than opponent).
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    assert.ok(s.left.attackStartTime < s.right.attackStartTime);
    stepCollisionBothOrders(s);
    assert.equal(
      s.left._lastCombatContactResolution?.interruptionReason ===
        "LATER_SLAP_STUFFED",
      false,
      "startup tip-dead slap must not stuff"
    );
    assert.equal(s.right.isHit, true, "active slap must land on startup opponent");
    s.dispose();
  });

  it("both facings via ownership + player-array order at equality", () => {
    // Facing-toward-opponent is preserved; ownership swap covers mirrored side.
    const cases = [
      { swapOwners: false, swapPlayerOrder: false },
      { swapOwners: true, swapPlayerOrder: false },
      { swapOwners: false, swapPlayerOrder: true },
      { swapOwners: true, swapPlayerOrder: true },
    ];
    for (const c of cases) {
      const r = runBoundaryCase({ flagOn: true, offsetMs: 0, ...c });
      assert.equal(r.tipLive, false, JSON.stringify(c));
      assert.equal(r.attackerConsumed, false, JSON.stringify(c));
      assert.equal(r.hits, 1, JSON.stringify(c));
      assert.equal(r.payload.isPunish, true, JSON.stringify(c));
      assert.equal(r.payload.victimHurtRegion, "frontArm", JSON.stringify(c));
      r.dispose();
    }
  });

  it("torso-plus-limb overlap at close range commits once", () => {
    const r = runBoundaryCase({ flagOn: true, offsetMs: 0, gap: 120 });
    assert.equal(r.hits, 1);
    assert.equal(r.dupHits, 0);
    assert.ok(r.payload);
    // Body may win region selection when both eligible; still one commit.
    assert.ok(
      r.payload.victimHurtRegion === "frontArm" ||
        r.payload.victimHurtKind === COMBAT_VOLUME_KIND.HURT_BODY ||
        r.payload.attackType === "slap"
    );
    r.dispose();
  });

  it("genuine active slap-vs-slap priority unchanged at body range", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "active", now);
    deepenSlapActive(s.right, now);
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    // Right earlier, left later — both tip live.
    s.right.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 40;
    s.right.slapActiveEndTime =
      s.right.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    s.left.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 10;
    s.left.slapActiveEndTime =
      s.left.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    assert.equal(isSlapTipLive(s.right, now), true);
    assert.equal(isSlapTipLive(s.left, now), true);
    stepCollisionBothOrders(s);
    assert.equal(s.left.isHit, true, "earlier slap wins");
    assert.equal(s.right.isHit, false);
    s.dispose();
  });

  it("under-threshold charged loses only to tip-live slap; tip-dead slap cannot win", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;

    // Tip-live slap beats under-threshold charged.
    armSlapPhase(s.right, "active", now);
    deepenSlapActive(s.right, now);
    armChargedPhase(s.left, "active", now);
    s.left.chargeAttackPower = CHARGE_PRIORITY_THRESHOLD - 1;
    s.left.isInStartupFrames = false;
    stepCollisionBothOrders(s);
    assert.equal(
      s.left.isAttacking,
      false,
      "under-threshold charged consumed by tip-live slap"
    );
    s.dispose();

    // Tip-dead recovery slap cannot beat under-threshold charged/palm.
    const s2 = sc({ sizeA: 0.85, sizeB: 0.85 });
    const t = s2.room.simTime;
    armVictimAtActiveEnd(s2.right, t, 0);
    assert.equal(isSlapTipLive(s2.right, t), false);
    armPalmPhase(s2.left, "active", t);
    s2.left.chargeAttackPower = CHARGE_PRIORITY_THRESHOLD - 1;
    s2.left.isInStartupFrames = false;
    s2.left.attackStartTime = t - PALM_THRUST_STARTUP_MS - 20;
    s2.left.startupEndTime = s2.left.attackStartTime + PALM_THRUST_STARTUP_MS;
    placeLimbContact(s2, "palm", t);
    stepCollisionBothOrders(s2);
    assert.equal(
      s2.left._lastCombatContactResolution?.interruptionReason ===
        "SLAP_BEATS_CHARGED",
      false,
      "tip-dead slap must not win charged priority"
    );
    assert.equal(s2.right.isHit, true, "palm/charged must fall through to processHit");
    assert.equal(lastHit(s2.io).isPunish, true);
    s2.dispose();
  });
});

describe("Phase 4A — recovery-classification partition", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastAuthoredSlapHurtResolve();
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  /** Mirror evaluateHitCallouts slapInRecovery positive guards for assertions. */
  function slapInRecoveryOf(victim, now) {
    return (
      !!victim.isAttacking &&
      victim.attackType === "slap" &&
      !!victim.isSlapAttack &&
      !victim.isInStartupFrames &&
      typeof victim.slapActiveEndTime === "number" &&
      victim.slapActiveEndTime > 0 &&
      typeof now === "number" &&
      now >= victim.slapActiveEndTime
    );
  }

  function armDeepActiveAttacker(attacker, now) {
    armSlapPhase(attacker, "active", now);
    deepenSlapActive(attacker, now);
    return attacker;
  }

  it("startup: tip dead, not recovery; COUNTER not PUNISH", () => {
    setAuthoredSlapHurtboxForTests(true);
    const variants = [
      { swapOwners: false, swapPlayerOrder: false },
      { swapOwners: true, swapPlayerOrder: false },
      { swapOwners: false, swapPlayerOrder: true },
      { swapOwners: true, swapPlayerOrder: true },
    ];
    for (const v of variants) {
      const s = sc({
        gap: 120,
        sizeA: 0.85,
        sizeB: 0.85,
        swapPlayerOrder: v.swapPlayerOrder,
      });
      const now = s.room.simTime;
      const victim = v.swapOwners ? s.left : s.right;
      const attacker = v.swapOwners ? s.right : s.left;
      armSlapPhase(victim, "startup", now);
      victim.attackAttemptTime = now;
      assert.equal(isSlapTipLive(victim, now), false);
      assert.equal(slapInRecoveryOf(victim, now), false);
      const callouts = evaluateHitCallouts(victim, now);
      assert.equal(callouts.isPunish, false, JSON.stringify(v));
      assert.equal(callouts.isCounterHit, true, JSON.stringify(v));

      armDeepActiveAttacker(attacker, now);
      stepCollisionBothOrders(s);
      assert.equal(victim.isHit, true, JSON.stringify(v));
      const payload = lastHit(s.io);
      assert.equal(payload.isPunish, false, JSON.stringify(v));
      assert.equal(payload.isCounterHit, true, JSON.stringify(v));
      s.dispose();
    }
  });

  it("active before endpoint: tip live, not recovery; no false PUNISH", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "active", now);
    deepenSlapActive(s.right, now);
    s.right.attackAttemptTime = now - 200; // outside counter window → normal hit
    assert.equal(isSlapTipLive(s.right, now), true);
    assert.equal(slapInRecoveryOf(s.right, now), false);
    const callouts = evaluateHitCallouts(s.right, now);
    assert.equal(callouts.isPunish, false);
    assert.equal(callouts.isCounterHit, false);

    // Earlier left slap wins active-vs-active (priority unchanged).
    armSlapPhase(s.left, "active", now);
    deepenSlapActive(s.left, now);
    s.left.attackStartTime = s.right.attackStartTime - 30;
    s.left.slapActiveEndTime =
      s.left.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    stepCollisionBothOrders(s);
    assert.equal(s.right.isHit, true);
    assert.equal(lastHit(s.io).isPunish, false);
    s.dispose();
  });

  it("equality slapActiveEndTime: tip dead, recovery, PUNISH once, not COUNTER", () => {
    setAuthoredSlapHurtboxForTests(true);
    const variants = [
      { swapOwners: false, swapPlayerOrder: false },
      { swapOwners: true, swapPlayerOrder: true },
    ];
    for (const v of variants) {
      const s = sc({
        sizeA: 0.85,
        sizeB: 0.85,
        swapPlayerOrder: v.swapPlayerOrder,
      });
      const now = s.room.simTime;
      const victim = v.swapOwners ? s.left : s.right;
      const attacker = v.swapOwners ? s.right : s.left;
      victim.isAttacking = true;
      victim.isSlapAttack = true;
      victim.attackType = "slap";
      victim.slapFacingDirection = victim.facing;
      victim.currentAction = "slap";
      victim.isInStartupFrames = false;
      victim.slapActiveEndTime = now;
      victim.attackStartTime = now - SLAP_STARTUP_MS - SLAP_ACTIVE_MS;
      victim.attackEndTime = now + SLAP_RECOVERY_MS;
      victim.attackAttemptTime = now; // would be counter if not recovery
      assert.equal(isSlapTipLive(victim, now), false);
      assert.equal(slapInRecoveryOf(victim, now), true);
      const callouts = evaluateHitCallouts(victim, now);
      assert.equal(callouts.isPunish, true, JSON.stringify(v));
      assert.equal(callouts.isCounterHit, false, JSON.stringify(v));

      armDeepActiveAttacker(attacker, now);
      assert.ok(attacker.attackStartTime > victim.attackStartTime);
      assert.ok(
        placeLimbOnly(s, "slap", now, { attacker, victim }) != null,
        `limb-only band required ${JSON.stringify(v)}`
      );
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1, JSON.stringify(v));
      const payload = lastHit(s.io);
      assert.equal(payload.isPunish, true, JSON.stringify(v));
      assert.equal(payload.isCounterHit, false, JSON.stringify(v));
      assert.equal(payload.victimHurtRegion, "frontArm", JSON.stringify(v));
      checkCollision(attacker, victim, s.rooms, s.io);
      assert.equal(hitCount(s.io), 1, "once-only");
      s.dispose();
    }
  });

  it("after endpoint recovery: tip dead, recovery, once-only PUNISH", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    s.right.attackAttemptTime = now;
    assert.equal(isSlapTipLive(s.right, now), false);
    assert.equal(slapInRecoveryOf(s.right, now), true);
    assert.equal(evaluateHitCallouts(s.right, now).isPunish, true);
    assert.equal(evaluateHitCallouts(s.right, now).isCounterHit, false);

    armDeepActiveAttacker(s.left, now);
    assert.ok(placeLimbOnly(s, "slap", now) != null);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 1);
    assert.equal(lastHit(s.io).isPunish, true);
    assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(hitCount(s.io), 1);
    s.dispose();
  });

  it("neutral / not attacking: tip dead, not recovery", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    s.right.isAttacking = false;
    s.right.isSlapAttack = false;
    s.right.attackType = null;
    s.right.slapActiveEndTime = 0;
    assert.equal(isSlapTipLive(s.right, now), false);
    assert.equal(slapInRecoveryOf(s.right, now), false);
    assert.equal(evaluateHitCallouts(s.right, now).isPunish, false);
    s.dispose();
  });

  it("missing/invalid slapActiveEndTime never invents recovery or PUNISH", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    for (const badEnd of [0, null, undefined, NaN, -1]) {
      s.right.isAttacking = true;
      s.right.isSlapAttack = true;
      s.right.attackType = "slap";
      s.right.isInStartupFrames = false;
      s.right.slapActiveEndTime = badEnd;
      s.right.attackStartTime = now - 200;
      assert.equal(isSlapTipLive(s.right, now), false, String(badEnd));
      assert.equal(slapInRecoveryOf(s.right, now), false, String(badEnd));
      assert.equal(
        evaluateHitCallouts(s.right, now).isPunish,
        false,
        String(badEnd)
      );
    }
    s.dispose();
  });
});

describe("Phase 4A — unilateral active-limb contact (recording 13.3–13.6s)", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    clearLastAuthoredSlapHurtResolve();
    clearSlapHurtQueryLog();
    clearLastSlapHurtCommitted();
  });

  function armDeepActive(p, now, agePastGrace) {
    armSlapPhase(p, "active", now);
    p.isInStartupFrames = false;
    p.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - agePastGrace;
    p.slapActiveEndTime =
      p.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    p.attackEndTime = p.slapActiveEndTime + SLAP_RECOVERY_MS;
    p.attackAttemptTime = p.attackStartTime;
  }

  /**
   * True unilateral: later tip∩older active limb, older tip-live but not_in_front
   * (facing away) while limb mirror still faces the later attacker — authored
   * limb remains a hittable surface without reciprocal tip rail contact.
   */
  function setupUnilateralActiveLimb(opts = {}) {
    const {
      flagOn = true,
      swapOwners = false,
      swapPlayerOrder = false,
    } = opts;
    setAuthoredSlapHurtboxForTests(flagOn);
    const s = sc({ sizeA: 0.85, sizeB: 0.85, swapPlayerOrder });
    const now = s.room.simTime;
    const older = swapOwners ? s.left : s.right;
    const later = swapOwners ? s.right : s.left;

    armDeepActive(older, now, 40);
    armDeepActive(later, now, 1);
    assert.ok(later.attackStartTime > older.attackStartTime);
    assert.equal(isSlapTipLive(older, now), true);

    // Keep limb mirror toward the later fighter; flip tip facing away so the
    // older offensive rail has no in-front target (no reciprocal contact).
    const limbTowardLater = later.x < older.x ? 1 : -1;
    older.slapFacingDirection = limbTowardLater;
    older.facing = -limbTowardLater;

    // Honest limb-only spacing for slap vs the older fighter's ACTIVE arm.
    // Derived, so this fixture tracks the authored geometry instead of the old
    // literal 160 (which the corrected arm volume no longer reaches).
    assert.ok(
      placeLimbOnly(s, "slap", now, { attacker: later, victim: older }) != null,
      "slap→active limb-only band must exist"
    );

    assert.equal(
      isWithinConnectRange(
        Math.abs(older.x - later.x),
        getConnectDistance("slap", later, older)
      ),
      false,
      "torso miss"
    );
    const laterQ = querySlapOffensiveContact(later, older, now);
    const olderQ = querySlapOffensiveContact(older, later, now);
    return { s, now, older, later, laterQ, olderQ };
  }

  it("ON recording-faithful unilateral: later limb hit commits; not LATER_SLAP_STUFFED", () => {
    const { s, older, later, laterQ, olderQ } = setupUnilateralActiveLimb({
      flagOn: true,
    });
    assert.equal(laterQ.connects, true, "later tip∩older limb");
    assert.equal(laterQ.limbOnly, true);
    assert.equal(olderQ.connects, false, "older has no reciprocal contact");
    assert.equal(olderQ.reason, "not_in_front");

    clearSlapHurtQueryLog();
    stepCollisionBothOrders(s);

    assert.equal(
      later._lastCombatContactResolution?.interruptionReason ===
        "LATER_SLAP_STUFFED",
      false
    );
    assert.equal(older.isHit, true);
    assert.equal(later.isHit, false);
    assert.equal(hitCount(s.io), 1);
    const payload = lastHit(s.io);
    assert.equal(payload.victimHurtRegion, "frontArm");
    assert.equal(payload.victimSlapPhase, "active");
    assert.equal(payload.isPunish, false);
    assert.equal(payload.authoredSlapHurtboxV1, true);
    assert.equal(payload.isCounterHit, true);
    assert.ok(payload.hitId);
    const decision = getSlapHurtQueryLog().find(
      (q) =>
        q.slapVsSlapDecision === "unilateral_contact_no_reciprocal" ||
        q.slapVsSlapDecision === "unilateral_contact"
    );
    assert.ok(decision, "diagnostics must label unilateral contact");
    assert.equal(decision.reciprocalContact, false);

    checkCollision(later, older, s.rooms, s.io);
    assert.equal(hitCount(s.io), 1, "once-only");
    s.dispose();
  });

  it("OFF at same spacing: miss; later slap stays live; no cancel", () => {
    const { s, older, later } = setupUnilateralActiveLimb({ flagOn: false });
    // Flag OFF: no limb candidate; older facing away ⇒ body also misses.
    assert.equal(querySlapOffensiveContact(later, older, s.room.simTime).connects, false);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 0);
    assert.equal(older.isHit, false);
    assert.equal(later.isAttacking, true);
    assert.equal(
      later._lastCombatContactResolution?.interruptionReason ===
        "LATER_SLAP_STUFFED",
      false
    );
    s.dispose();
  });

  it("orphan-cancel path (symmetric reciprocal): stuffing later must commit earlier hit", () => {
    // Footage mechanism with facing-each-other limb-only spacing: old code
    // cleared later then earlier missed the now-neutral body. Fix commits earlier.
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armDeepActive(s.right, now, 40);
    armDeepActive(s.left, now, 1);
    // Both fighters hold an extended ACTIVE arm, so the reciprocal limb-only
    // band is symmetric — derive it instead of assuming the stale gap 160.
    assert.ok(placeLimbOnly(s, "slap", now) != null);
    assert.equal(querySlapOffensiveContact(s.left, s.right, now).connects, true);
    assert.equal(querySlapOffensiveContact(s.right, s.left, now).connects, true);
    // Later checks first (player-array order left→right).
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(hitCount(s.io), 1, "earlier hit committed in same interaction");
    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, false);
    assert.equal(lastHit(s.io).isPunish, false);
    // No orphan: a LATER_SLAP_STUFFED without a hit is forbidden.
    assert.ok(lastHit(s.io).hitId);
    s.dispose();
  });

  it("directional matrix + ownership/order", () => {
    setAuthoredSlapHurtboxForTests(true);

    // 1) Unilateral later→older limb
    {
      const r = setupUnilateralActiveLimb({ flagOn: true });
      stepCollisionBothOrders(r.s);
      assert.equal(r.older.isHit, true);
      assert.equal(r.later.isHit, false);
      r.s.dispose();
    }

    // 2) Only older contacts later (body range, later tip-live but deferred)
    {
      const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      armDeepActive(s.right, now, 40);
      armDeepActive(s.left, now, 1);
      // Deny later contact by facing later away; older still faces later.
      s.left.facing = 1;
      s.left.slapFacingDirection = 1;
      assert.equal(querySlapOffensiveContact(s.left, s.right, now).connects, false);
      assert.equal(querySlapOffensiveContact(s.right, s.left, now).connects, true);
      stepCollisionBothOrders(s);
      assert.equal(s.left.isHit, true);
      assert.equal(s.right.isHit, false);
      assert.equal(hitCount(s.io), 1);
      s.dispose();
    }

    // 3) Reciprocal outside trade → earlier wins once
    {
      const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      armDeepActive(s.right, now, 50);
      armDeepActive(s.left, now, 10);
      stepCollisionBothOrders(s);
      assert.equal(s.left.isHit, true);
      assert.equal(s.right.isHit, false);
      assert.equal(hitCount(s.io), 1);
      s.dispose();
    }

    // 4) Trade window
    {
      const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      armDeepActive(s.right, now, 20);
      armDeepActive(s.left, now, 20);
      s.left.attackStartTime = s.right.attackStartTime;
      s.left.slapActiveEndTime = s.right.slapActiveEndTime;
      stepCollisionBothOrders(s);
      assert.equal(s.left.isHit, true);
      assert.equal(s.right.isHit, true);
      assert.equal(hitCount(s.io), 2);
      s.dispose();
    }

    // 5) Neither
    {
      const s = sc({ gap: 280, sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      armDeepActive(s.right, now, 40);
      armDeepActive(s.left, now, 1);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 0);
      assert.equal(s.left.isAttacking, true);
      assert.equal(s.right.isAttacking, true);
      s.dispose();
    }

    // 6) Torso+limb once-only
    {
      const s = sc({ gap: 120, sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      armSlapPhase(s.right, "recovery", now);
      armDeepActive(s.left, now, 20);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1);
      checkCollision(s.left, s.right, s.rooms, s.io);
      assert.equal(hitCount(s.io), 1);
      s.dispose();
    }

    // Ownership / array order for unilateral
    for (const v of [
      { swapOwners: false, swapPlayerOrder: false },
      { swapOwners: true, swapPlayerOrder: false },
      { swapOwners: false, swapPlayerOrder: true },
      { swapOwners: true, swapPlayerOrder: true },
    ]) {
      const r = setupUnilateralActiveLimb({ flagOn: true, ...v });
      assert.equal(r.laterQ.connects, true, JSON.stringify(v));
      assert.equal(r.olderQ.connects, false, JSON.stringify(v));
      checkCollision(r.older, r.later, r.s.rooms, r.s.io);
      assert.equal(hitCount(r.s.io), 0, "older miss first");
      checkCollision(r.later, r.older, r.s.rooms, r.s.io);
      assert.equal(hitCount(r.s.io), 1, JSON.stringify(v));
      assert.equal(r.older.isHit, true, JSON.stringify(v));
      r.s.dispose();
    }
  });

  it("same-tick: older checks during later startup, then later active resolves without orphan cancel", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = sc({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armDeepActive(s.right, now, 40);
    // Spacing derived from the older fighter's exposed ACTIVE arm, so the later
    // fighter's startup (no limb yet, torso out of connect) is a clean miss.
    placeLimbOnly(s, "slap", now, { attacker: s.left, victim: s.right });
    armSlapPhase(s.left, "startup", now);
    s.left.attackStartTime = now;
    checkCollision(s.right, s.left, s.rooms, s.io);
    assert.equal(s.left.isHit, false, "older misses startup (no limb) at spacing");
    assert.equal(s.left.isAttacking, true);

    // Later becomes active — facing each other, this is now reciprocal.
    s.left.isInStartupFrames = false;
    s.left.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 1;
    s.left.slapActiveEndTime =
      s.left.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    s.left.lastCheckedAttackTime = null;
    const laterQ = querySlapOffensiveContact(s.left, s.right, now);
    const olderQ = querySlapOffensiveContact(s.right, s.left, now);
    assert.equal(laterQ.connects, true);
    assert.equal(olderQ.connects, true, "symmetric active limbs = reciprocal");
    checkCollision(s.left, s.right, s.rooms, s.io);
    // Reciprocal + later checking: earlier must commit (not orphan cancel).
    assert.equal(hitCount(s.io), 1);
    assert.equal(s.left.isHit, true);
    assert.ok(lastHit(s.io).hitId);
    s.dispose();
  });
});

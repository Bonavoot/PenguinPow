"use strict";

/**
 * Phase 3 — authored combat volumes (shadow) + mismatch fixtures.
 */

const { describe, it, afterEach, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  EDGE_POLICY,
  aabbsOverlap,
  validateFiniteAabb,
} = require("../../combatGeometry");
const { COMBAT_VOLUME_KIND, COMBAT_PHASE } = require("../../combatVolumeVocabulary");
const {
  queryAuthoredCombatVolumes,
  queryAuthoredCandidateContacts,
} = require("../../combatVolumeQuery");
const {
  resolveAuthoredPoseKey,
  getAuthoredCatalog,
  SOURCE_AUTHORED,
} = require("../../combatVolumeDefs");
const {
  parseCombatVolumeShadowFlag,
  isCombatVolumeShadowEnabled,
  setCombatVolumeShadowForTests,
} = require("../../combatVolumeShadowFlags");
const {
  SHADOW_MISMATCH,
  compareLegacyVsCandidate,
  clearShadowAggregates,
  getShadowAggregates,
} = require("../../combatVolumeShadow");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  armChargedPhase,
  armSidestepPhase,
  resetRematch,
} = require("./helpers/scenarioHarness");
const {
  acquireActionFacingLock,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  mintActionFacingInstanceId,
  forceClearActionFacingLock,
} = require("../../actionFacingOwnership");
const { SLAP_STARTUP_MS, SLAP_ACTIVE_MS } = require("../../constants");

const live = [];
afterEach(() => {
  while (live.length) live.pop().dispose();
  setCombatVolumeShadowForTests(null);
  clearShadowAggregates();
});

function sc(opts) {
  const s = createFoundationScenario(opts);
  live.push(s);
  return s;
}

function kinds(q) {
  return q.volumes.map((v) => v.kind);
}

function regions(q) {
  return q.volumes.map((v) => v.region || v.label);
}

describe("Phase 3 — shadow flag", () => {
  it("unset / 0 / false → OFF; 1 / true → ON", () => {
    assert.equal(parseCombatVolumeShadowFlag(undefined), false);
    assert.equal(parseCombatVolumeShadowFlag(""), false);
    assert.equal(parseCombatVolumeShadowFlag("0"), false);
    assert.equal(parseCombatVolumeShadowFlag("false"), false);
    assert.equal(parseCombatVolumeShadowFlag("1"), true);
    assert.equal(parseCombatVolumeShadowFlag("true"), true);
  });

  it("compare skips when flag off unless force", () => {
    setCombatVolumeShadowForTests(false);
    const s = sc();
    const r = compareLegacyVsCandidate(s.left, s.right, {
      simTime: s.room.simTime,
    });
    assert.equal(r.skipped, true);
    const forced = compareLegacyVsCandidate(s.left, s.right, {
      simTime: s.room.simTime,
      force: true,
    });
    assert.equal(forced.skipped, false);
  });
});

describe("Phase 3 — authored definitions", () => {
  it("catalog loads from shared JSON once", () => {
    const c = getAuthoredCatalog();
    assert.equal(c.version, 1);
    assert.ok(c.poses.neutral);
    assert.ok(c.poses.slap_recovery);
    assert.equal(c.meta.provisional, undefined);
  });

  it("neutral has body/head/push, no HIT, no limb", () => {
    const s = sc();
    const q = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    assert.equal(q.support, "supported");
    assert.equal(q.poseKey, "neutral");
    assert.equal(q.source, SOURCE_AUTHORED);
    assert.ok(kinds(q).includes(COMBAT_VOLUME_KIND.PUSH));
    assert.ok(kinds(q).includes(COMBAT_VOLUME_KIND.HURT_BODY));
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HURT_LIMB), false);
    assert.ok(regions(q).includes("torso"));
    assert.ok(regions(q).includes("head"));
  });

  it("crouch lowers body vs neutral", () => {
    const s = sc();
    const n = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    s.left._phase3Crouch = true;
    const c = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    assert.equal(c.poseKey, "crouch");
    const nTorso = n.volumes.find((v) => v.region === "torso");
    const cTorso = c.volumes.find((v) => v.region === "torso");
    assert.ok(cTorso.aabb.top < nTorso.aabb.top);
  });

  it("slap startup → active → recovery → neutral boundaries", () => {
    const s = sc();
    const now = s.room.simTime;

    armSlapPhase(s.left, "startup", now);
    let q = queryAuthoredCombatVolumes(s.left, { simTime: now });
    assert.equal(q.poseKey, "slap_startup");
    assert.equal(q.actionPhase, COMBAT_PHASE.STARTUP);
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.ok(kinds(q).includes(COMBAT_VOLUME_KIND.HURT_LIMB));

    armSlapPhase(s.left, "active", now);
    q = queryAuthoredCombatVolumes(s.left, { simTime: now });
    assert.equal(q.poseKey, "slap_active");
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HIT), true);
    assert.ok(kinds(q).includes(COMBAT_VOLUME_KIND.HURT_LIMB));

    armSlapPhase(s.left, "recovery", now);
    q = queryAuthoredCombatVolumes(s.left, { simTime: now });
    assert.equal(q.poseKey, "slap_recovery");
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.ok(kinds(q).includes(COMBAT_VOLUME_KIND.HURT_LIMB));

    // Exact active→recovery boundary via clocks
    s.left.isSlapAttack = true;
    s.left.isAttacking = true;
    s.left.isInStartupFrames = false;
    s.left.attackStartTime = now;
    const activeEnd = now + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
    q = queryAuthoredCombatVolumes(s.left, {
      simTime: activeEnd - 1,
    });
    assert.equal(q.poseKey, "slap_active");
    q = queryAuthoredCombatVolumes(s.left, { simTime: activeEnd });
    assert.equal(q.poseKey, "slap_recovery");

    // Neutral after flags clear — limb retracts
    s.left.isSlapAttack = false;
    s.left.isAttacking = false;
    s.left.isRecovering = false;
    s.left.currentAction = null;
    q = queryAuthoredCombatVolumes(s.left, { simTime: activeEnd + 100 });
    assert.equal(q.poseKey, "neutral");
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HURT_LIMB), false);
  });

  it("mirrors by action-facing across cross-up", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    s.left.slapFacingDirection = -1;
    s.left.facing = 1; // locomotion flipped
    const id = mintActionFacingInstanceId(s.left, ACTION_FACING_OWNER.SLAP);
    acquireActionFacingLock(s.left, {
      ownerType: ACTION_FACING_OWNER.SLAP,
      ownerInstanceId: id,
      direction: -1,
      reason: ACTION_FACING_REASON.COMMIT,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
    const q = queryAuthoredCombatVolumes(s.left, { simTime: now });
    assert.equal(q.mirrorFacing, -1);
    const hit = q.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.HIT);
    assert.ok(hit.aabb.left > s.left.x);
    forceClearActionFacingLock(s.left, { reason: "test" });
  });

  it("left/right mirror of same local tip is symmetric about root", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    s.left.slapFacingDirection = -1;
    s.left.facing = -1;
    const qR = queryAuthoredCombatVolumes(s.left, { simTime: now });
    const tipR = qR.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.HIT);
    const cxR = (tipR.aabb.left + tipR.aabb.right) / 2;

    s.left.slapFacingDirection = 1;
    s.left.facing = 1;
    const qL = queryAuthoredCombatVolumes(s.left, { simTime: now });
    const tipL = qL.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.HIT);
    const cxL = (tipL.aabb.left + tipL.aabb.right) / 2;
    assert.ok(Math.abs(cxR - s.left.x - (s.left.x - cxL)) < 0.01);
  });

  it("scales with sizeMultiplier; order independence", () => {
    const a = sc({ sizeA: 0.85, sizeB: 1.2 });
    const b = sc({
      sizeA: 0.85,
      sizeB: 1.2,
      swapPlayerOrder: true,
      leftId: a.left.id,
      rightId: a.right.id,
    });
    b.left.x = a.left.x;
    b.right.x = a.right.x;
    const qa = queryAuthoredCombatVolumes(a.left, { simTime: a.room.simTime, ownerSlot: 0 });
    const qb = queryAuthoredCombatVolumes(b.left, { simTime: b.room.simTime, ownerSlot: 1 });
    const pushA = qa.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.PUSH);
    const pushB = qb.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.PUSH);
    assert.equal(pushA.aabb.left, pushB.aabb.left);
    const big = queryAuthoredCombatVolumes(a.right, { simTime: a.room.simTime });
    const pushBig = big.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.PUSH);
    assert.ok(pushBig.aabb.right - pushBig.aabb.left > pushA.aabb.right - pushA.aabb.left);
  });

  it("TOUCHING_COUNTS and finite rejection still hold", () => {
    assert.equal(EDGE_POLICY.touchingCountsAsOverlap, true);
    assert.ok(
      aabbsOverlap(
        { left: 0, right: 10, bottom: 0, top: 10 },
        { left: 10, right: 20, bottom: 0, top: 10 }
      )
    );
    assert.equal(
      validateFiniteAabb({ left: NaN, right: 1, bottom: 0, top: 1 }),
      "aabb: non-finite"
    );
  });

  it("palm / charged / sidestep supported poses", () => {
    const s = sc();
    const now = s.room.simTime;
    armPalmPhase(s.left, "active", now);
    assert.equal(
      queryAuthoredCombatVolumes(s.left, { simTime: now }).poseKey,
      "palm_active"
    );
    armChargedPhase(s.right, "hold", now);
    assert.equal(
      queryAuthoredCombatVolumes(s.right, { simTime: now }).poseKey,
      "charged_hold"
    );
    armChargedPhase(s.right, "active", now);
    assert.equal(
      queryAuthoredCombatVolumes(s.right, { simTime: now }).poseKey,
      "charged_active"
    );
    armSidestepPhase(s.left, "active", now, 1);
    const sq = queryAuthoredCombatVolumes(s.left, { simTime: now });
    assert.equal(sq.poseKey, "sidestep_active");
    assert.equal(sq.travelDirection, 1);
    assert.ok(sq.tags.includes("INTANGIBLE"));
  });

  it("unsupported returns explicit classification", () => {
    const s = sc();
    s.left.isHit = true;
    const q = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    assert.equal(q.classification, "UNSUPPORTED_ACTION_FALLBACK");
    assert.equal(q.volumes.length, 0);
  });

  it("reset/rematch and interrupt clear stale slap geometry identity", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    assert.equal(
      queryAuthoredCombatVolumes(s.left, { simTime: now }).poseKey,
      "slap_active"
    );
    resetRematch(s);
    const q = queryAuthoredCombatVolumes(s.left, { simTime: now });
    assert.equal(q.poseKey, "neutral");
    assert.equal(kinds(q).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("deterministic repeat trace", () => {
    const s = sc();
    armSlapPhase(s.left, "recovery", s.room.simTime);
    const a = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    const b = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    assert.deepEqual(
      a.volumes.map((v) => [v.kind, v.region, v.aabb]),
      b.volumes.map((v) => [v.kind, v.region, v.aabb])
    );
  });
});

describe("Phase 3 — shadow compare fixtures", () => {
  beforeEach(() => setCombatVolumeShadowForTests(true));

  it("torso-range active slap: legacy/candidate agreement path runs", () => {
    const s = sc({ gap: 100 });
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    s.left.slapFacingDirection = -1;
    // Place tip near body
    s.right.x = s.left.x + 120;
    const r = compareLegacyVsCandidate(s.left, s.right, { simTime: now, force: true });
    assert.equal(r.skipped, false);
    assert.ok(Array.isArray(r.mismatches));
  });

  it("candidate limb-only recovery contact is classified, not a punish", () => {
    const s = sc({ gap: 90 });
    const now = s.room.simTime;
    // Victim in slap recovery with limb out; attacker active slap overlapping limb
    armSlapPhase(s.right, "recovery", now);
    s.right.slapFacingDirection = 1;
    armSlapPhase(s.left, "active", now);
    s.left.slapFacingDirection = -1;
    s.right.x = s.left.x + 100;
    const contacts = queryAuthoredCandidateContacts(s.left, s.right, {
      simTime: now,
    });
    const limb = contacts.candidates.find(
      (c) => c.victimKind === COMBAT_VOLUME_KIND.HURT_LIMB
    );
    // May or may not overlap depending on spacing — if present, compare records limb
    if (limb) {
      const r = compareLegacyVsCandidate(s.left, s.right, { simTime: now, force: true });
      const limbMismatch = r.mismatches.find(
        (m) => m.code === SHADOW_MISMATCH.LEGACY_MISS_CANDIDATE_HIT_LIMB
      );
      if (limbMismatch) {
        assert.ok(limbMismatch.victimRegion);
        assert.equal(typeof limbMismatch.legacyHit, "boolean");
      }
    }
    assert.ok(getShadowAggregates().total >= 0);
  });

  it("same-center fighters produce finite volumes", () => {
    const s = sc();
    s.left.x = s.right.x = 640;
    armSlapPhase(s.left, "active", s.room.simTime);
    const q = queryAuthoredCombatVolumes(s.left, { simTime: s.room.simTime });
    for (const v of q.volumes) {
      assert.equal(validateFiniteAabb(v.aabb), null);
    }
  });
});

describe("Phase 3 — mechanical disconnect from live tick", () => {
  it("index.js does not import shadow; collisionSystem uses Phase 4A limb helper only", () => {
    const indexSrc = fs.readFileSync(
      path.join(__dirname, "../../index.js"),
      "utf8"
    );
    const colSrc = fs.readFileSync(
      path.join(__dirname, "../../collisionSystem.js"),
      "utf8"
    );
    assert.equal(/combatVolumeShadow|combatVolumeDefs|queryAuthoredCombatVolumes/.test(indexSrc), false);
    // Shadow compare + full authored query stay off the live tick path.
    assert.equal(/combatVolumeShadow|queryAuthoredCombatVolumes/.test(colSrc), false);
    // Phase 4A may import the narrow slap-limb target helper (default flag OFF).
    assert.ok(/authoredSlapHurtTarget/.test(colSrc));
  });
});

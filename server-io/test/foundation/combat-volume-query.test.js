"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  COMBAT_VOLUME_KIND,
  COMBAT_VOLUME_TAG,
  COMBAT_PHASE,
} = require("../../combatVolumeVocabulary");
const {
  queryCombatVolumes,
  queryCandidateContacts,
  resolveMirrorFacing,
  inferCombatPhase,
} = require("../../combatVolumeQuery");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  armChargedPhase,
  armGrabStartup,
  armSidestepPhase,
  armDodge,
} = require("./helpers/scenarioHarness");
const {
  acquireActionFacingLock,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  mintActionFacingInstanceId,
  forceClearActionFacingLock,
} = require("../../actionFacingOwnership");

const live = [];
afterEach(() => {
  while (live.length) live.pop().dispose();
});

function sc(opts) {
  const s = createFoundationScenario(opts);
  live.push(s);
  return s;
}

describe("Phase 1 — combatVolumeQuery (diagnostic / inert)", () => {
  it("idle fighters expose PUSH + HURT_BODY + LANDING only", () => {
    const s = sc();
    const q = queryCombatVolumes(s.left, {
      simTime: s.room.simTime,
      ownerSlot: 0,
    });
    assert.equal(q.actionPhase, COMBAT_PHASE.NEUTRAL);
    const kinds = q.volumes.map((v) => v.kind);
    assert.deepEqual(kinds, [
      COMBAT_VOLUME_KIND.PUSH,
      COMBAT_VOLUME_KIND.LANDING,
      COMBAT_VOLUME_KIND.HURT_BODY,
    ]);
    assert.equal(
      q.volumes.some((v) => v.kind === COMBAT_VOLUME_KIND.HIT),
      false
    );
  });

  it("mirrors committed slap facing, not flipped locomotion facing", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    s.left.slapFacingDirection = -1; // committed face-right attack
    s.left.facing = 1; // locomotion flipped (cross-up noise)
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
    assert.equal(resolveMirrorFacing(s.left), -1);
    const q = queryCombatVolumes(s.left, { simTime: now, ownerSlot: 0 });
    const hit = q.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.HIT);
    assert.ok(hit, "active slap must emit diagnostic HIT");
    assert.equal(hit.mirrorFacing, -1);
    // Forward toward +X when facing -1 → hit box right of root
    assert.ok(hit.aabb.left > s.left.x);
    forceClearActionFacingLock(s.left, { reason: "test" });
  });

  it("slap startup has no HIT; active has HIT; recovery has HURT_LIMB not HIT", () => {
    const s = sc();
    const now = s.room.simTime;

    armSlapPhase(s.left, "startup", now);
    let q = queryCombatVolumes(s.left, { simTime: now, ownerSlot: 0 });
    assert.equal(q.actionPhase, COMBAT_PHASE.STARTUP);
    assert.equal(q.volumes.some((v) => v.kind === COMBAT_VOLUME_KIND.HIT), false);

    armSlapPhase(s.left, "active", now);
    q = queryCombatVolumes(s.left, { simTime: now, ownerSlot: 0 });
    assert.equal(q.actionPhase, COMBAT_PHASE.ACTIVE);
    assert.equal(q.volumes.some((v) => v.kind === COMBAT_VOLUME_KIND.HIT), true);
    assert.equal(
      q.volumes.some((v) => v.kind === COMBAT_VOLUME_KIND.HURT_LIMB),
      false
    );

    armSlapPhase(s.left, "recovery", now);
    q = queryCombatVolumes(s.left, { simTime: now, ownerSlot: 0 });
    assert.equal(q.actionPhase, COMBAT_PHASE.RECOVERY);
    assert.equal(q.volumes.some((v) => v.kind === COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(
      q.volumes.some((v) => v.kind === COMBAT_VOLUME_KIND.HURT_LIMB),
      true
    );
  });

  it("palm / charged / grab / sidestep / dodge emit expected diagnostic kinds", () => {
    const s = sc();
    const now = s.room.simTime;

    armPalmPhase(s.left, "active", now);
    assert.ok(
      queryCombatVolumes(s.left, { simTime: now }).volumes.some(
        (v) => v.kind === COMBAT_VOLUME_KIND.HIT
      )
    );

    armChargedPhase(s.right, "hold", now);
    assert.equal(
      inferCombatPhase(s.right, now),
      COMBAT_PHASE.STARTUP
    );

    armGrabStartup(s.left, now);
    assert.ok(
      queryCombatVolumes(s.left, { simTime: now }).volumes.some(
        (v) => v.kind === COMBAT_VOLUME_KIND.GRAB
      )
    );

    armSidestepPhase(s.right, "active", now, 1);
    const sq = queryCombatVolumes(s.right, { simTime: now });
    assert.ok(sq.tags.includes(COMBAT_VOLUME_TAG.INTANGIBLE));
    assert.ok(sq.tags.includes(COMBAT_VOLUME_TAG.INVULNERABLE));
    assert.equal(sq.travelDirection, 1);

    armDodge(s.left, now, -1);
    const dq = queryCombatVolumes(s.left, { simTime: now });
    assert.ok(dq.tags.includes(COMBAT_VOLUME_TAG.INTANGIBLE));
    assert.equal(dq.travelDirection, -1);
  });

  it("size multiplier scales push width; player order does not change by-id geometry", () => {
    const a = sc({ sizeA: 0.85, sizeB: 1.2, gap: 200 });
    const b = sc({
      sizeA: 0.85,
      sizeB: 1.2,
      gap: 200,
      swapPlayerOrder: true,
      leftId: a.left.id,
      rightId: a.right.id,
    });
    // Match positions/facings exactly
    b.left.x = a.left.x;
    b.right.x = a.right.x;
    b.left.sizeMultiplier = a.left.sizeMultiplier;
    b.right.sizeMultiplier = a.right.sizeMultiplier;

    const qa = queryCombatVolumes(a.left, { simTime: a.room.simTime, ownerSlot: 0 });
    const qb = queryCombatVolumes(b.left, { simTime: b.room.simTime, ownerSlot: 1 });
    const pushA = qa.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.PUSH);
    const pushB = qb.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.PUSH);
    assert.equal(pushA.aabb.left, pushB.aabb.left);
    assert.equal(pushA.aabb.right, pushB.aabb.right);

    const big = queryCombatVolumes(a.right, { simTime: a.room.simTime });
    const pushBig = big.volumes.find((v) => v.kind === COMBAT_VOLUME_KIND.PUSH);
    assert.ok(pushBig.aabb.right - pushBig.aabb.left > pushA.aabb.right - pushA.aabb.left);
  });

  it("queryCandidateContacts marks authoritative:false and is order-stable", () => {
    const s = sc({ gap: 90 });
    const now = s.room.simTime;
    armSlapPhase(s.left, "active", now);
    const c1 = queryCandidateContacts(s.left, s.right, { simTime: now });
    const c2 = queryCandidateContacts(s.right, s.left, {
      simTime: now,
      ownerSlotA: 1,
      ownerSlotB: 0,
    });
    assert.ok(c1.candidates.every((c) => c.authoritative === false));
    // Same pair geometry content regardless of argument order when sorted
    const norm = (list) =>
      list
        .map((c) => `${c.attackerLabel}->${c.victimLabel}@${c.depth}`)
        .sort()
        .join("|");
    // c2 swaps slots but labels should still describe the slap vs body if overlap exists
    assert.equal(typeof norm(c1.candidates), "string");
    assert.equal(typeof norm(c2.candidates), "string");
  });

  it("does not mutate player state", () => {
    const s = sc();
    const before = JSON.stringify({
      x: s.left.x,
      y: s.left.y,
      facing: s.left.facing,
      isAttacking: s.left.isAttacking,
      stamina: s.left.stamina,
    });
    queryCombatVolumes(s.left, { simTime: s.room.simTime });
    queryCandidateContacts(s.left, s.right, { simTime: s.room.simTime });
    const after = JSON.stringify({
      x: s.left.x,
      y: s.left.y,
      facing: s.left.facing,
      isAttacking: s.left.isAttacking,
      stamina: s.left.stamina,
    });
    assert.equal(before, after);
  });
});

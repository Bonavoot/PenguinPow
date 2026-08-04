"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  EDGE_POLICY,
  createLocalRect,
  createLocalCapsule,
  localRectToWorldAabb,
  localCapsuleToWorld,
  aabbsOverlap,
  aabbContactApprox,
  capsulesOverlap,
  sweptAabbOverlapX,
  facingToAttackDir,
  assertFiniteAabb,
  validateFiniteAabb,
  sortVolumeRecords,
  createAabb,
} = require("../../combatGeometry");

describe("Phase 1 — combatGeometry primitives", () => {
  it("documents TOUCHING_COUNTS edge policy", () => {
    assert.equal(EDGE_POLICY.touchingCountsAsOverlap, true);
  });

  it("mirrors local rect by action facing (facing 1 → −X forward)", () => {
    const local = createLocalRect(40, 20, 10, 15);
    const leftFace = localRectToWorldAabb(local, 500, 286, 1);
    const rightFace = localRectToWorldAabb(local, 500, 286, -1);
    assert.equal(facingToAttackDir(1), -1);
    assert.equal(facingToAttackDir(-1), 1);
    // Facing 1: forward −X → center at 460
    assert.equal(leftFace.left, 450);
    assert.equal(leftFace.right, 470);
    // Facing -1: forward +X → center at 540
    assert.equal(rightFace.left, 530);
    assert.equal(rightFace.right, 550);
    // Up offset increases world Y (head above feet); top=maxY, bottom=minY
    assert.equal(leftFace.bottom, 286 + 20 - 15);
    assert.equal(leftFace.top, 286 + 20 + 15);
  });

  it("edge-touch counts as overlap; gap does not", () => {
    // top=maxY, bottom=minY
    const a = createAabb(0, 10, 10, 0);
    const bTouch = createAabb(10, 10, 20, 0);
    const bGap = createAabb(10.0001, 10, 20, 0);
    assert.equal(aabbsOverlap(a, bTouch), true);
    assert.equal(aabbsOverlap(a, bGap), false);
  });

  it("aabbContactApprox returns finite contact on overlap", () => {
    const a = createAabb(0, 20, 20, 0);
    const b = createAabb(10, 25, 30, 5);
    const c = aabbContactApprox(a, b);
    assert.ok(Number.isFinite(c.x));
    assert.ok(Number.isFinite(c.y));
    assert.ok(c.depth > 0);
  });

  it("rejects non-finite AABB in assertFiniteAabb", () => {
    assert.equal(validateFiniteAabb({ left: NaN, top: 1, right: 1, bottom: 0 }), "aabb: non-finite");
    assert.throws(
      () => assertFiniteAabb({ left: 0, top: 0, right: Infinity, bottom: 1 }, "bad"),
      /non-finite|inverted/
    );
  });

  it("capsule overlap and swept X test", () => {
    const cap = createLocalCapsule(0, 0, 40, 0, 8);
    const w0 = localCapsuleToWorld(cap, 100, 200, -1);
    const w1 = localCapsuleToWorld(cap, 130, 200, 1);
    assert.equal(capsulesOverlap(w0, w1), true);

    const moving = createAabb(0, 10, 10, 0);
    const wall = createAabb(25, 10, 35, 0);
    assert.equal(sweptAabbOverlapX(moving, 20, wall), true);
    assert.equal(sweptAabbOverlapX(moving, 10, wall), false);
  });

  it("sortVolumeRecords is deterministic", () => {
    const records = [
      { kindOrder: 60, label: "hit", ownerSlot: 1, aabb: createAabb(1, 1, 2, 0) },
      { kindOrder: 10, label: "push", ownerSlot: 0, aabb: createAabb(0, 1, 1, 0) },
      { kindOrder: 10, label: "push", ownerSlot: 1, aabb: createAabb(0, 1, 1, 0) },
    ];
    sortVolumeRecords(records);
    assert.equal(records[0].kindOrder, 10);
    assert.equal(records[0].ownerSlot, 0);
    assert.equal(records[2].kindOrder, 60);
  });
});

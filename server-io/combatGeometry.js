"use strict";

/**
 * Premium Combat Foundation Phase 1 — deterministic geometry primitives.
 *
 * Pure functions only. NEVER consulted by live hit/push/grab resolution.
 * No DOM, assets, pixels, or wall-clock time.
 *
 * Edge policy (documented + tested):
 *   TOUCHING_COUNTS — closed intervals on both axes. A.max >= B.min and
 *   B.max >= A.min means overlap (edge-touch is contact).
 *
 * Coordinate convention (matches live sim + client CSS bottom: y/720):
 *   +X right, +Y up-screen (hops use GROUND_LEVEL + height; feet near root Y).
 *   Facing 1 = art-left = forward attack toward −X (see strikeContact.getAttackDir).
 *
 * AABB fields: left/right on X; top = maxY (head); bottom = minY (feet).
 * (CSS uses bottom=feetY/720 and height=(headY-feetY)/720.)
 */

const EDGE_POLICY = Object.freeze({
  name: "TOUCHING_COUNTS",
  touchingCountsAsOverlap: true,
});

const ATTACK_DIR_FACE_LEFT = -1; // facing === 1
const ATTACK_DIR_FACE_RIGHT = 1; // facing !== 1

/** Scratch AABBs to avoid per-call allocation when callers pass `out`. */
function createAabb(left, top, right, bottom) {
  return { left, top, right, bottom };
}

function copyAabb(src, out) {
  out.left = src.left;
  out.top = src.top;
  out.right = src.right;
  out.bottom = src.bottom;
  return out;
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Loud finite check for tests/dev. Returns null when ok, else reason string.
 */
function validateFiniteAabb(aabb, label) {
  if (!aabb) return `${label || "aabb"}: missing`;
  if (!isFiniteNumber(aabb.left) || !isFiniteNumber(aabb.top) ||
      !isFiniteNumber(aabb.right) || !isFiniteNumber(aabb.bottom)) {
    return `${label || "aabb"}: non-finite`;
  }
  // top = maxY (head), bottom = minY (feet) → top must be >= bottom.
  if (aabb.right < aabb.left || aabb.top < aabb.bottom) {
    return `${label || "aabb"}: inverted`;
  }
  return null;
}

function assertFiniteAabb(aabb, label) {
  const err = validateFiniteAabb(aabb, label);
  if (err) {
    const e = new Error(`[combatGeometry] ${err}`);
    e.code = "COMBAT_GEOMETRY_NON_FINITE";
    throw e;
  }
}

function facingToAttackDir(facing) {
  return facing === 1 ? ATTACK_DIR_FACE_LEFT : ATTACK_DIR_FACE_RIGHT;
}

/**
 * Local rect relative to fighter root.
 * @param {number} forward — center offset along facing-forward (+ = toward attack)
 * @param {number} up — center offset upward from root (+ = toward head = −world Y)
 * @param {number} halfW
 * @param {number} halfH
 */
function createLocalRect(forward, up, halfW, halfH) {
  return Object.freeze({
    shape: "rect",
    forward,
    up,
    halfW,
    halfH,
  });
}

/**
 * Local capsule (vertical or horizontal) — centerline from (f0,u0) to (f1,u1), radius r.
 */
function createLocalCapsule(forward0, up0, forward1, up1, radius) {
  return Object.freeze({
    shape: "capsule",
    forward0,
    up0,
    forward1,
    up1,
    radius,
  });
}

/**
 * Convert local rect → world AABB. Mirrors by committed action facing.
 * @param {object} local
 * @param {number} rootX
 * @param {number} rootY
 * @param {number} facing — 1 face left / else face right
 * @param {object} [out]
 */
function localRectToWorldAabb(local, rootX, rootY, facing, out) {
  const dir = facingToAttackDir(facing);
  const cx = rootX + dir * local.forward;
  // +up is toward head (+world Y). Feet near rootY; head at rootY + body.
  const cy = rootY + local.up;
  const aabb = out || createAabb(0, 0, 0, 0);
  aabb.left = cx - local.halfW;
  aabb.right = cx + local.halfW;
  aabb.bottom = cy - local.halfH; // feet / minY
  aabb.top = cy + local.halfH; // head / maxY
  return aabb;
}

/**
 * Capsule → world AABB (loose bounds). Exact capsule tests use intersectCapsules.
 */
function localCapsuleToWorldAabb(local, rootX, rootY, facing, out) {
  const dir = facingToAttackDir(facing);
  const x0 = rootX + dir * local.forward0;
  const y0 = rootY + local.up0;
  const x1 = rootX + dir * local.forward1;
  const y1 = rootY + local.up1;
  const r = local.radius;
  const aabb = out || createAabb(0, 0, 0, 0);
  aabb.left = Math.min(x0, x1) - r;
  aabb.right = Math.max(x0, x1) + r;
  aabb.bottom = Math.min(y0, y1) - r; // minY
  aabb.top = Math.max(y0, y1) + r; // maxY
  return aabb;
}

function localShapeToWorldAabb(local, rootX, rootY, facing, out) {
  if (!local) return null;
  if (local.shape === "capsule") {
    return localCapsuleToWorldAabb(local, rootX, rootY, facing, out);
  }
  return localRectToWorldAabb(local, rootX, rootY, facing, out);
}

/** Inclusive / touching-counts AABB overlap. top=maxY, bottom=minY. */
function aabbsOverlap(a, b) {
  if (!a || !b) return false;
  return a.right >= b.left && b.right >= a.left &&
    a.top >= b.bottom && b.top >= a.bottom;
}

/**
 * Approximate contact point (overlap center) and normal (from B toward A on dominant axis).
 * Writes into `out` when provided: { x, y, nx, ny, depth }.
 */
function aabbContactApprox(a, b, out) {
  const result = out || { x: 0, y: 0, nx: 0, ny: 0, depth: 0 };
  if (!aabbsOverlap(a, b)) {
    result.x = 0;
    result.y = 0;
    result.nx = 0;
    result.ny = 0;
    result.depth = 0;
    return result;
  }
  const overlapL = a.right - b.left;
  const overlapR = b.right - a.left;
  const overlapX = Math.min(overlapL, overlapR);
  const overlapDown = a.top - b.bottom;
  const overlapUp = b.top - a.bottom;
  const overlapY = Math.min(overlapDown, overlapUp);
  result.x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) * 0.5;
  result.y = (Math.max(a.bottom, b.bottom) + Math.min(a.top, b.top)) * 0.5;
  if (overlapX <= overlapY) {
    result.depth = overlapX;
    result.nx = overlapL < overlapR ? -1 : 1;
    result.ny = 0;
  } else {
    result.depth = overlapY;
    result.nx = 0;
    result.ny = overlapDown < overlapUp ? -1 : 1;
  }
  return result;
}

function distSqPointSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

/**
 * Capsule vs capsule (world space). Capsule = segment + radius.
 */
function capsulesOverlap(c0, c1) {
  // c: { x0,y0,x1,y1,r }
  const rSum = c0.r + c1.r;
  // Sample closest approach via segment-segment distance (2D).
  // For Phase 1: conservative — check endpoints + mid vs other segment.
  const samples = [
    [c0.x0, c0.y0],
    [c0.x1, c0.y1],
    [(c0.x0 + c0.x1) * 0.5, (c0.y0 + c0.y1) * 0.5],
  ];
  let minD = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = distSqPointSegment(
      samples[i][0],
      samples[i][1],
      c1.x0,
      c1.y0,
      c1.x1,
      c1.y1
    );
    if (d < minD) minD = d;
  }
  const samples1 = [
    [c1.x0, c1.y0],
    [c1.x1, c1.y1],
    [(c1.x0 + c1.x1) * 0.5, (c1.y0 + c1.y1) * 0.5],
  ];
  for (let i = 0; i < samples1.length; i++) {
    const d = distSqPointSegment(
      samples1[i][0],
      samples1[i][1],
      c0.x0,
      c0.y0,
      c0.x1,
      c0.y1
    );
    if (d < minD) minD = d;
  }
  return minD <= rSum * rSum;
}

function localCapsuleToWorld(local, rootX, rootY, facing, out) {
  const dir = facingToAttackDir(facing);
  const c = out || { x0: 0, y0: 0, x1: 0, y1: 0, r: 0 };
  c.x0 = rootX + dir * local.forward0;
  c.y0 = rootY + local.up0;
  c.x1 = rootX + dir * local.forward1;
  c.y1 = rootY + local.up1;
  c.r = local.radius;
  return c;
}

/**
 * Optional 1-axis swept AABB test on X (fast lateral motion).
 * Returns true if the moving AABB overlaps stationary at any t in [0,1].
 */
function sweptAabbOverlapX(moving, dx, stationary) {
  if (!moving || !stationary || !isFiniteNumber(dx)) return false;
  const expanded = {
    left: Math.min(moving.left, moving.left + dx),
    right: Math.max(moving.right, moving.right + dx),
    top: moving.top,
    bottom: moving.bottom,
  };
  return aabbsOverlap(expanded, stationary);
}

/**
 * Stable deterministic ordering for volume records.
 * Sort key: kindOrder, label, ownerSlot, left, top.
 */
function compareVolumeRecords(a, b) {
  const ko = (a.kindOrder || 0) - (b.kindOrder || 0);
  if (ko !== 0) return ko;
  const la = a.label || "";
  const lb = b.label || "";
  if (la < lb) return -1;
  if (la > lb) return 1;
  const sa = a.ownerSlot || 0;
  const sb = b.ownerSlot || 0;
  if (sa !== sb) return sa - sb;
  const aabbA = a.aabb;
  const aabbB = b.aabb;
  if (aabbA && aabbB) {
    if (aabbA.left !== aabbB.left) return aabbA.left - aabbB.left;
    if (aabbA.top !== aabbB.top) return aabbA.top - aabbB.top;
  }
  return 0;
}

function sortVolumeRecords(records) {
  if (!Array.isArray(records)) return records;
  records.sort(compareVolumeRecords);
  return records;
}

module.exports = {
  EDGE_POLICY,
  createAabb,
  copyAabb,
  isFiniteNumber,
  validateFiniteAabb,
  assertFiniteAabb,
  facingToAttackDir,
  createLocalRect,
  createLocalCapsule,
  localRectToWorldAabb,
  localCapsuleToWorldAabb,
  localShapeToWorldAabb,
  localCapsuleToWorld,
  aabbsOverlap,
  aabbContactApprox,
  capsulesOverlap,
  sweptAabbOverlapX,
  compareVolumeRecords,
  sortVolumeRecords,
};

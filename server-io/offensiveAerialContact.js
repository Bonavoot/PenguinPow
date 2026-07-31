"use strict";

/**
 * Offensive-aerial contact-geometry fidelity (Phase 3).
 *
 * Derives authoritative contact metadata AFTER checkFlapBodySlam has already
 * decided a valid hit/parry candidate. Does not change eligibility, damage,
 * knockback, timing, or movement.
 *
 * Convention:
 * - contactNormal points from defender toward attacker (unit vector)
 * - attackerContact* = attacker surface anchor
 * - defenderContact* = defender surface anchor
 * - contactX/Y = midpoint between those surface anchors
 *
 * Geometry source: same slam width scale as collisionSystem
 * (HITBOX_DISTANCE_VALUE * FLAP_BODYSLAM_WIDTH_SCALE * sizeMult) and the
 * FLAP_BODYSLAM_CONTACT_HEIGHT vertical band. Not tip-rail / not client sprites.
 *
 * See OFFENSIVE_AERIAL_CONTACT_FIDELITY.md
 */

const { GROUND_LEVEL, HITBOX_DISTANCE_VALUE } = require("./constants");
const { getPushboxHalfWidth } = require("./pushboxGeometry");

/** Must match collisionSystem.js slam detector. */
const FLAP_BODYSLAM_WIDTH_SCALE = 0.7;
const FLAP_BODYSLAM_CONTACT_HEIGHT = 100;

const CONTACT_AXIS = Object.freeze({
  LATERAL: "LATERAL",
  DOWNWARD: "DOWNWARD",
  DOWNWARD_DIAGONAL: "DOWNWARD_DIAGONAL",
  DEGENERATE_FALLBACK: "DEGENERATE_FALLBACK",
});

const GEOMETRY_SOURCE = Object.freeze({
  SLAM_AABB_OVERLAP: "SLAM_AABB_OVERLAP",
  SAME_CENTER_TIEBREAK: "SAME_CENTER_TIEBREAK",
  ZERO_VELOCITY_TIEBREAK: "ZERO_VELOCITY_TIEBREAK",
  ROOT_MIDPOINT_FALLBACK: "ROOT_MIDPOINT_FALLBACK",
});

const EPS = 1e-6;
const SAME_CENTER_EPS = 0.5;
const DIAGONAL_VEL_RATIO = 0.55;

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function slamHalfWidth(player) {
  return (
    HITBOX_DISTANCE_VALUE *
    FLAP_BODYSLAM_WIDTH_SCALE *
    (player?.sizeMultiplier || 1)
  );
}

function defenderBodyHalf(player) {
  // Standing body uses full pushbox half for the defender surface; slam width
  // still gates eligibility in the detector. Contact anchors read on the body.
  return getPushboxHalfWidth(player?.sizeMultiplier);
}

function attackerVelX(attacker) {
  if (!attacker) return 0;
  if (attacker.slideJumpDiveCommitted) return 0;
  if (attacker.slideJumpFlapFlightActive) {
    return finite(attacker.flapVelocityX, 0);
  }
  return finite(attacker.slideJumpVelocityX, 0);
}

function attackerVelY(attacker) {
  return finite(attacker?.slideJumpVelocityY, 0);
}

function defenderVelX(defender) {
  return finite(defender?.movementVelocity, 0);
}

function normalize(x, y) {
  const mag = Math.hypot(x, y);
  if (!(mag > EPS)) return { x: 0, y: 0, mag: 0 };
  return { x: x / mag, y: y / mag, mag };
}

function rootMidpoint(attacker, defender) {
  return {
    x: (finite(attacker.x) + finite(defender.x)) / 2,
    y: (finite(attacker.y) + finite(defender.y)) / 2,
  };
}

/**
 * Compute contact metadata for a slam hit/parry that has already been validated.
 *
 * @param {object} attacker
 * @param {object} defender
 * @param {{ previousAttackerX?: number, previousDefenderX?: number }} [opts]
 */
function computeOffensiveAerialContact(attacker, defender, opts = {}) {
  const mid = rootMidpoint(attacker, defender);
  const stats = {
    fallbackUsed: false,
    geometrySource: GEOMETRY_SOURCE.SLAM_AABB_OVERLAP,
  };

  if (!attacker || !defender) {
    stats.fallbackUsed = true;
    stats.geometrySource = GEOMETRY_SOURCE.ROOT_MIDPOINT_FALLBACK;
    return finalizeContact({
      contactX: mid.x,
      contactY: mid.y,
      contactNormalX: 0,
      contactNormalY: 1,
      contactAxis: CONTACT_AXIS.DEGENERATE_FALLBACK,
      attackerContactX: mid.x,
      attackerContactY: mid.y,
      defenderContactX: mid.x,
      defenderContactY: mid.y,
      attackerSideAtContact: 0,
      relativeVelocityX: 0,
      relativeVelocityY: 0,
      penetrationX: 0,
      penetrationY: 0,
      previousMidpointX: mid.x,
      previousMidpointY: mid.y,
      geometrySource: stats.geometrySource,
      fallbackUsed: true,
    });
  }

  const ax = finite(attacker.x);
  const ay = finite(attacker.y, GROUND_LEVEL);
  const dx = finite(defender.x);
  const dy = finite(defender.y, GROUND_LEVEL);

  const aHalf = slamHalfWidth(attacker);
  const dHalf = defenderBodyHalf(defender);

  const aLeft = ax - aHalf;
  const aRight = ax + aHalf;
  const dLeft = dx - dHalf;
  const dRight = dx + dHalf;

  // Vertical bands: feet/bottom at y; defender occupies up to contact height.
  const defBottom = Math.min(dy, GROUND_LEVEL);
  const defTop = defBottom + FLAP_BODYSLAM_CONTACT_HEIGHT;
  // Attacker belly/feet band around current feet height.
  const atkBottom = ay - 8;
  const atkTop = ay + 48;

  const overlapLeft = Math.max(aLeft, dLeft);
  const overlapRight = Math.min(aRight, dRight);
  const penetrationX = Math.max(0, overlapRight - overlapLeft);

  const overlapBottom = Math.max(atkBottom, defBottom);
  const overlapTop = Math.min(atkTop, defTop);
  const penetrationY = Math.max(0, overlapTop - overlapBottom);

  const relVx = attackerVelX(attacker) - defenderVelX(defender);
  const relVy = attackerVelY(attacker); // defender usually grounded (vy≈0)

  let side = ax === dx ? 0 : ax < dx ? -1 : 1;
  let fallbackUsed = false;
  let geometrySource = GEOMETRY_SOURCE.SLAM_AABB_OVERLAP;

  // Same-center / tiny separation: deterministic side from motion then history.
  if (Math.abs(ax - dx) <= SAME_CENTER_EPS) {
    fallbackUsed = true;
    geometrySource = GEOMETRY_SOURCE.SAME_CENTER_TIEBREAK;
    if (Math.abs(relVx) > EPS) {
      side = relVx > 0 ? -1 : 1; // approaching from left ⇒ attacker on left
    } else if (
      typeof opts.previousAttackerX === "number" &&
      typeof opts.previousDefenderX === "number" &&
      Math.abs(opts.previousAttackerX - opts.previousDefenderX) > SAME_CENTER_EPS
    ) {
      side =
        opts.previousAttackerX < opts.previousDefenderX ? -1 : 1;
    } else if (attacker.slideJumpDiveCommitted) {
      side = finite(attacker.facing, 1) === 1 ? 1 : -1;
    } else {
      side = 1; // stable default
    }
  }

  const absRelVx = Math.abs(relVx);
  const absRelVy = Math.abs(relVy);
  const dive = !!attacker.slideJumpDiveCommitted;
  const descending = relVy <= 0 || dive;

  let contactAxis = CONTACT_AXIS.LATERAL;
  if (fallbackUsed && geometrySource === GEOMETRY_SOURCE.SAME_CENTER_TIEBREAK) {
    contactAxis = dive
      ? CONTACT_AXIS.DOWNWARD
      : CONTACT_AXIS.DEGENERATE_FALLBACK;
  } else if (dive && descending) {
    if (absRelVx > EPS && absRelVx >= absRelVy * DIAGONAL_VEL_RATIO) {
      contactAxis = CONTACT_AXIS.DOWNWARD_DIAGONAL;
    } else {
      contactAxis = CONTACT_AXIS.DOWNWARD;
    }
  } else if (
    descending &&
    absRelVy > EPS &&
    absRelVy >= absRelVx * (1 / DIAGONAL_VEL_RATIO) &&
    penetrationY > 0
  ) {
    if (absRelVx > EPS && absRelVx >= absRelVy * DIAGONAL_VEL_RATIO) {
      contactAxis = CONTACT_AXIS.DOWNWARD_DIAGONAL;
    } else {
      contactAxis = CONTACT_AXIS.DOWNWARD;
    }
  } else {
    contactAxis = CONTACT_AXIS.LATERAL;
  }

  // Surface anchors
  let attackerContactX;
  let attackerContactY;
  let defenderContactX;
  let defenderContactY;

  if (
    contactAxis === CONTACT_AXIS.DOWNWARD ||
    contactAxis === CONTACT_AXIS.DOWNWARD_DIAGONAL
  ) {
    // Lower attacker surface meets upper defender region.
    const xCenter =
      penetrationX > EPS
        ? (overlapLeft + overlapRight) / 2
        : (ax + dx) / 2;
    attackerContactX = xCenter;
    defenderContactX = xCenter;
    // Prefer overlap band; clamp into body ranges.
    const yMeet =
      penetrationY > EPS
        ? (overlapBottom + overlapTop) / 2
        : Math.min(ay, defTop);
    attackerContactY = Math.max(atkBottom, Math.min(ay, yMeet + 4));
    defenderContactY = Math.min(defTop, Math.max(defBottom + 20, yMeet));
    if (contactAxis === CONTACT_AXIS.DOWNWARD_DIAGONAL && side !== 0) {
      // Bias anchors toward facing surfaces when horizontal motion matters.
      attackerContactX = side < 0 ? aRight : aLeft;
      defenderContactX = side < 0 ? dLeft : dRight;
    }
  } else if (contactAxis === CONTACT_AXIS.LATERAL) {
    if (side <= 0) {
      // Attacker on left → right face meets defender left face
      attackerContactX = aRight;
      defenderContactX = dLeft;
    } else {
      attackerContactX = aLeft;
      defenderContactX = dRight;
    }
    const yCenter =
      penetrationY > EPS
        ? (overlapBottom + overlapTop) / 2
        : (Math.min(ay, defTop) + Math.max(defBottom + 24, dy)) / 2;
    attackerContactY = yCenter;
    defenderContactY = yCenter;
  } else {
    // Degenerate
    fallbackUsed = true;
    geometrySource = GEOMETRY_SOURCE.ROOT_MIDPOINT_FALLBACK;
    attackerContactX = mid.x;
    attackerContactY = mid.y;
    defenderContactX = mid.x;
    defenderContactY = mid.y;
  }

  // Shared contact = midpoint of surface anchors
  let contactX = (attackerContactX + defenderContactX) / 2;
  let contactY = (attackerContactY + defenderContactY) / 2;

  // Normal: defender → attacker
  let nx = ax - dx;
  let ny = ay - dy;
  if (contactAxis === CONTACT_AXIS.DOWNWARD) {
    nx = 0;
    ny = 1; // attacker above
  } else if (contactAxis === CONTACT_AXIS.DOWNWARD_DIAGONAL) {
    nx = side === 0 ? 0 : side; // defender → attacker horizontally
    ny = 1;
  } else if (contactAxis === CONTACT_AXIS.LATERAL) {
    // side = sign(attacker.x - defender.x): attacker-left ⇒ -1 ⇒ normal points left.
    nx = side === 0 ? -1 : side;
    ny = 0;
  }

  let unit = normalize(nx, ny);
  if (unit.mag < EPS) {
    fallbackUsed = true;
    if (geometrySource === GEOMETRY_SOURCE.SLAM_AABB_OVERLAP) {
      geometrySource = GEOMETRY_SOURCE.ZERO_VELOCITY_TIEBREAK;
    }
    unit = normalize(side === 0 ? -1 : side, dive ? 1 : 0);
    if (unit.mag < EPS) {
      unit = { x: 0, y: 1, mag: 1 };
      contactAxis = CONTACT_AXIS.DEGENERATE_FALLBACK;
      geometrySource = GEOMETRY_SOURCE.ROOT_MIDPOINT_FALLBACK;
      contactX = mid.x;
      contactY = Math.min(ay, defTop);
      attackerContactX = mid.x;
      defenderContactX = mid.x;
      attackerContactY = contactY;
      defenderContactY = contactY;
    }
  }

  // Sanitize
  contactX = finite(contactX, mid.x);
  contactY = finite(contactY, mid.y);
  attackerContactX = finite(attackerContactX, contactX);
  attackerContactY = finite(attackerContactY, contactY);
  defenderContactX = finite(defenderContactX, contactX);
  defenderContactY = finite(defenderContactY, contactY);

  return finalizeContact({
    contactX,
    contactY,
    contactNormalX: finite(unit.x),
    contactNormalY: finite(unit.y),
    contactAxis,
    attackerContactX,
    attackerContactY,
    defenderContactX,
    defenderContactY,
    attackerSideAtContact: side,
    relativeVelocityX: finite(relVx),
    relativeVelocityY: finite(relVy),
    penetrationX: finite(penetrationX),
    penetrationY: finite(penetrationY),
    previousMidpointX: mid.x,
    previousMidpointY: mid.y,
    midpointDelta: Math.hypot(contactX - mid.x, contactY - mid.y),
    surfaceAnchorGap: Math.hypot(
      attackerContactX - defenderContactX,
      attackerContactY - defenderContactY
    ),
    geometrySource,
    fallbackUsed,
  });
}

function finalizeContact(c) {
  // Hard ban NaN/Infinity leaking to network/effects.
  for (const key of Object.keys(c)) {
    if (typeof c[key] === "number" && !Number.isFinite(c[key])) {
      c[key] = 0;
      c.fallbackUsed = true;
      c.geometrySource = GEOMETRY_SOURCE.ROOT_MIDPOINT_FALLBACK;
      c.contactAxis = CONTACT_AXIS.DEGENERATE_FALLBACK;
    }
  }
  return c;
}

/** Compact fields safe to persist on the outcome activation record. */
function toOutcomeContactFields(contact) {
  if (!contact) {
    return {
      contactX: null,
      contactY: null,
      contactNormalX: null,
      contactNormalY: null,
      contactAxis: null,
      geometrySource: null,
      fallbackUsed: false,
    };
  }
  return {
    contactX: contact.contactX,
    contactY: contact.contactY,
    contactNormalX: contact.contactNormalX,
    contactNormalY: contact.contactNormalY,
    contactAxis: contact.contactAxis,
    geometrySource: contact.geometrySource,
    fallbackUsed: !!contact.fallbackUsed,
  };
}

/** Payload fields for player_hit / raw_parry_success (backward compatible). */
function toEffectContactPayload(contact, attacker) {
  if (!contact) return {};
  return {
    contactX: contact.contactX,
    contactY: contact.contactY,
    attackerX: finite(attacker?.x, contact.attackerContactX),
    attackerContactX: contact.attackerContactX,
    attackerContactY: contact.attackerContactY,
    defenderContactX: contact.defenderContactX,
    defenderContactY: contact.defenderContactY,
    contactNormalX: contact.contactNormalX,
    contactNormalY: contact.contactNormalY,
    contactAxis: contact.contactAxis,
  };
}

module.exports = {
  CONTACT_AXIS,
  GEOMETRY_SOURCE,
  FLAP_BODYSLAM_WIDTH_SCALE,
  FLAP_BODYSLAM_CONTACT_HEIGHT,
  computeOffensiveAerialContact,
  toOutcomeContactFields,
  toEffectContactPayload,
  slamHalfWidth,
  defenderBodyHalf,
  rootMidpoint,
};

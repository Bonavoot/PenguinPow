"use strict";

/**
 * Phase 4A honest-limb spacing helper.
 *
 * Test spacings are DERIVED from live authored geometry, never hard-coded. The
 * visible-contact-range defect survived because fixtures baked in a gap (160)
 * that only worked while the limb volume over-reached its art by ~27 units.
 *
 * Vocabulary (all root-to-root, world units):
 *   limbReachGap  — largest gap where the attacker's canonical HIT rail still
 *                   overlaps the victim's authored frontArm (inclusive edge).
 *   torsoGate     — largest gap that still satisfies legacy tip-meets-body.
 *   limbOnlyGap   — a gap inside (torsoGate, limbReachGap]: authored limb only.
 *   visibleTouchGap — attacker visible art tip + victim visible arm tip. The
 *                   frame where the two silhouettes touch on screen.
 */

const {
  getAttackerHitRegion,
  getVictimSlapLimbAabb,
} = require("../../../authoredSlapHurtTarget");
const {
  getConnectDistance,
  getStrikeTipWorld,
  CONTACT_SNAP_EPSILON,
} = require("../../../strikeContact");
const {
  isAuthoredSlapHurtboxV1Enabled,
  setAuthoredSlapHurtboxForTests,
} = require("../../../authoredSlapHurtboxFlags");

/** Measured visible arm tip per victim pose / slap variant (see meta.phase4aLimbMeasurement). */
const VISIBLE_ARM_TIP = Object.freeze({
  slap_active: Object.freeze({ 1: 75.276, 2: 78.392 }),
  slap_recovery: Object.freeze({ 1: 54.448, 2: 54.448 }),
});

function normalizeKind(attackKind) {
  return attackKind === "palmThrust" ? "palm" : attackKind;
}

/** Attacker probe outer edge along attack direction (authored HIT rail). */
function attackerProbeReach(attackKind) {
  const hit = getAttackerHitRegion(normalizeKind(attackKind));
  if (!hit) return null;
  return hit.region.forward + hit.region.halfW;
}

/**
 * Victim authored frontArm outer edge for its current authoritative pose.
 * Geometry is flag-independent (the flag gates whether authority CONSULTS it),
 * so spacing can be derived while a fixture is deliberately running flag OFF.
 */
function victimLimbReach(victim, simTime) {
  const prior = isAuthoredSlapHurtboxV1Enabled();
  setAuthoredSlapHurtboxForTests(true);
  try {
    const limb = getVictimSlapLimbAabb(victim, simTime);
    return limb ? limb.reachForward : null;
  } finally {
    setAuthoredSlapHurtboxForTests(prior);
  }
}

/** Largest root gap where the limb probe still overlaps the authored frontArm. */
function limbReachGap(attackKind, victim, simTime) {
  const probe = attackerProbeReach(attackKind);
  const limb = victimLimbReach(victim, simTime);
  if (probe == null || limb == null) return null;
  return probe + limb;
}

/** Largest root gap that still satisfies legacy tip-meets-body (inclusive). */
function torsoGate(attackKind, attacker, victim) {
  return (
    getConnectDistance(normalizeKind(attackKind), attacker, victim) +
    CONTACT_SNAP_EPSILON
  );
}

/** Gap where the two visible silhouettes touch on screen. */
function visibleTouchGap(attackKind, attacker, victimPoseKey, victimVariant) {
  const tip = getStrikeTipWorld(normalizeKind(attackKind), attacker);
  const table = VISIBLE_ARM_TIP[victimPoseKey];
  if (!table) return null;
  const arm = table[String(victimVariant) === "2" ? 2 : 1];
  return tip + arm;
}

/**
 * A gap strictly inside the honest limb-only band, or null when the band is
 * empty (the authored limb is enclosed by legacy torso connect at this pairing).
 * `bias` in (0,1] picks how deep inside the band to sit; default mid-band.
 */
function limbOnlyGap(attackKind, attacker, victim, simTime, bias = 0.5) {
  const reach = limbReachGap(attackKind, victim, simTime);
  const gate = torsoGate(attackKind, attacker, victim);
  if (reach == null || !(reach > gate)) return null;
  return gate + (reach - gate) * bias;
}

/** True when the authored limb pokes past legacy torso connect at all. */
function hasLimbOnlyBand(attackKind, attacker, victim, simTime) {
  return limbOnlyGap(attackKind, attacker, victim, simTime) != null;
}

module.exports = {
  VISIBLE_ARM_TIP,
  attackerProbeReach,
  victimLimbReach,
  limbReachGap,
  torsoGate,
  visibleTouchGap,
  limbOnlyGap,
  hasLimbOnlyBand,
  CONTACT_SNAP_EPSILON,
};

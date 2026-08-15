/**
 * Vertical reach for grounded strikes vs an airborne body.
 *
 * Collision is horizontal-only. Without a limb-height test, a slap "occupies"
 * the victim's X at any Y — that's the infinite anti-air. This uses the
 * authored frontArm / HIT band on the attack pose vs the victim torso+head.
 */

const { AIR_STRIKE_HURT_HEIGHT } = require("./constants");
const {
  getPoseDefinition,
  resolvePoseVariantKey,
  resolveVariantRegions,
} = require("./combatVolumeDefs");

const ATTACK_POSE = Object.freeze({
  slap: "slap_active",
  palm: "palm_active",
  charged: "charged_active",
});

// Neutral HURT_BODY from the catalog (torso 50±36, head 108±15). Same numbers
// on every supported strike pose — feet-relative world units.
const VICTIM_BODY_UP_MIN = 14;
const VICTIM_BODY_UP_MAX = 123;

// Low kick has no authored HIT pose. Diagnostic shin band (combatVolumeQuery).
const LOW_KICK_UP_MIN = 14;
const LOW_KICK_UP_MAX = 42;

const Y_SLACK = 4;

function attackKindForLimb(player) {
  if (!player) return null;
  if (player.isLowKick || player.attackType === "lowKick") return "lowKick";
  if (player.isPalmThrust) return "palm";
  if (player.attackType === "slap") return "slap";
  if (player.attackType === "charged") return "charged";
  return null;
}

function bandFromRegion(region) {
  if (!region) return null;
  const up = region.up;
  const halfH = region.halfH;
  if (typeof up !== "number" || typeof halfH !== "number") return null;
  if (!(halfH > 0)) return null;
  return { min: up - halfH, max: up + halfH };
}

function unionBand(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) };
}

/**
 * Feet-relative [min, max] of the attack limb. FrontArm when authored,
 * else the HIT tip rail, else the legacy 72px column.
 */
function getStrikeLimbUpBand(attacker) {
  const kind = attackKindForLimb(attacker);
  if (kind === "lowKick") {
    return { min: LOW_KICK_UP_MIN, max: LOW_KICK_UP_MAX };
  }
  const poseKey = ATTACK_POSE[kind];
  if (!poseKey) {
    return { min: 0, max: AIR_STRIKE_HURT_HEIGHT };
  }
  const poseDef = getPoseDefinition(poseKey);
  if (!poseDef) {
    return { min: 0, max: AIR_STRIKE_HURT_HEIGHT };
  }
  const variantKey = resolvePoseVariantKey(poseDef, attacker);
  const regions = resolveVariantRegions(poseDef, variantKey);
  let band = null;
  for (const r of regions) {
    if (!r) continue;
    if (r.kind === "HURT_LIMB" && r.label === "frontArm") {
      band = unionBand(band, bandFromRegion(r));
    }
    if (r.kind === "HIT") {
      band = unionBand(band, bandFromRegion(r));
    }
  }
  if (band) return band;
  return { min: 0, max: AIR_STRIKE_HURT_HEIGHT };
}

function bandsOverlap(aMin, aMax, bMin, bMax) {
  return aMax + Y_SLACK > bMin && aMin < bMax + Y_SLACK;
}

/**
 * True when the attacker's limb band overlaps the victim's body in Y.
 * Grounded vs grounded always overlaps. A jumper above the limb misses.
 */
function strikeLimbReachesVictimY(attacker, victim) {
  if (!attacker || !victim) return false;
  const limb = getStrikeLimbUpBand(attacker);
  const atkY = typeof attacker.y === "number" ? attacker.y : 0;
  const vicY = typeof victim.y === "number" ? victim.y : 0;
  return bandsOverlap(
    atkY + limb.min,
    atkY + limb.max,
    vicY + VICTIM_BODY_UP_MIN,
    vicY + VICTIM_BODY_UP_MAX
  );
}

module.exports = {
  VICTIM_BODY_UP_MIN,
  VICTIM_BODY_UP_MAX,
  Y_SLACK,
  attackKindForLimb,
  getStrikeLimbUpBand,
  strikeLimbReachesVictimY,
};

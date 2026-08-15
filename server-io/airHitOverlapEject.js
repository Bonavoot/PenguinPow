/**
 * Air-hit overlap eject — parallel X that peels a stacked launch victim
 * out of the attacker's pushbox before they land.
 *
 * Not knockback. Does not hand off to ice. Authored slap/palm/charged stay
 * the hit. This only fills the hole: rate = remaining sep / fall ticks,
 * capped at the land-settle 18 px/tick. Dies at pushbox range or on land.
 *
 * Hitstop freezes sim, so the peel starts when the confirm ends.
 */

const {
  GROUND_LEVEL,
  HIT_FALL_GRAVITY,
  HIT_FALL_MAX_FALL_SPEED,
  AIR_HIT_EJECT_MAX_PX_PER_TICK,
  AIR_HIT_EJECT_SEP_EPS,
} = require("./constants");
const { getMinimumCenterDistance } = require("./pushboxGeometry");
const { getAttackDir, clampToRopeRest } = require("./strikeContact");

function clearAirHitOverlapEject(player) {
  if (!player) return;
  player.airHitEjectActive = false;
  player.airHitEjectDir = 0;
  player.airHitEjectRate = 0;
}

function ejectTargetSep(victim, attacker) {
  return getMinimumCenterDistance(
    victim?.sizeMultiplier,
    attacker?.sizeMultiplier
  );
}

/**
 * Ticks until the hit-fall integrator reaches ground. Matches index.js:
 * velY -= g, then y += velY (rise already killed).
 */
function estimateHitFallTicks(y, velY) {
  let yy = y;
  let v = velY < 0 ? velY : 0;
  if (v < -HIT_FALL_MAX_FALL_SPEED) v = -HIT_FALL_MAX_FALL_SPEED;
  if (!(yy > GROUND_LEVEL)) return 1;
  for (let n = 1; n <= 120; n++) {
    v -= HIT_FALL_GRAVITY;
    if (v < -HIT_FALL_MAX_FALL_SPEED) v = -HIT_FALL_MAX_FALL_SPEED;
    yy += v;
    if (yy <= GROUND_LEVEL) return n;
  }
  return 120;
}

function ejectDirFromOverlap(attacker, victim) {
  const dx = (victim?.x || 0) - (attacker?.x || 0);
  if (dx === 0) return getAttackDir(attacker);
  return dx > 0 ? 1 : -1;
}

/**
 * Arm the eject after beginAirHitFall has set hitFallVelocityY.
 * No-op when already at/beyond pushbox range.
 */
function beginAirHitOverlapEject(victim, attacker) {
  if (!victim || !attacker) return false;
  if (!(victim.y > GROUND_LEVEL)) return false;

  const target = ejectTargetSep(victim, attacker);
  const sep = Math.abs((victim.x || 0) - (attacker.x || 0));
  if (sep + AIR_HIT_EJECT_SEP_EPS >= target) {
    clearAirHitOverlapEject(victim);
    return false;
  }

  const need = target - sep;
  const ticks = estimateHitFallTicks(victim.y, victim.hitFallVelocityY);
  const rate = Math.min(
    need / ticks,
    AIR_HIT_EJECT_MAX_PX_PER_TICK
  );
  if (rate <= 0) {
    clearAirHitOverlapEject(victim);
    return false;
  }

  victim.airHitEjectActive = true;
  victim.airHitEjectDir = ejectDirFromOverlap(attacker, victim);
  victim.airHitEjectRate = rate;
  return true;
}

/**
 * One tick of eject. Stops at live pushbox range on the stored side.
 * Does not touch knockbackVelocity.
 * @returns {number} pixels moved this tick
 */
function applyAirHitOverlapEject(victim, attacker) {
  if (!victim?.airHitEjectActive) return 0;
  const dir = victim.airHitEjectDir || 0;
  const rate = victim.airHitEjectRate || 0;
  if (!dir || rate <= 0) {
    clearAirHitOverlapEject(victim);
    return 0;
  }
  if (!attacker) return 0;

  const target = ejectTargetSep(victim, attacker);
  const desired = attacker.x + dir * target;
  const remaining = (desired - victim.x) * dir;
  if (remaining <= AIR_HIT_EJECT_SEP_EPS) {
    clearAirHitOverlapEject(victim);
    return 0;
  }

  const step = Math.min(rate, remaining);
  victim.x = clampToRopeRest(victim.x + dir * step);
  if (remaining - step <= AIR_HIT_EJECT_SEP_EPS) {
    clearAirHitOverlapEject(victim);
  }
  return step;
}

function isAirHitEjectActive(player) {
  return !!player?.airHitEjectActive;
}

module.exports = {
  clearAirHitOverlapEject,
  estimateHitFallTicks,
  ejectTargetSep,
  ejectDirFromOverlap,
  beginAirHitOverlapEject,
  applyAirHitOverlapEject,
  isAirHitEjectActive,
};

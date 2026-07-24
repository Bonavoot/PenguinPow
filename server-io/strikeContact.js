/**
 * Strike contact rails — art-derived tip → connect distance → seam.
 *
 * Consistency rule: a hit confirms when the strike tip visually meets the
 * opponent body surface. Same formula for every strike; per-attack tip offsets
 * come from measured opaque extents on 960×960 canvases (sprites face left;
 * forward = left of canvas). Display width is 12.30% of the 1280 design width.
 *
 * Tip length is NOT scaled by sizeMultiplier (client fighter width is fixed);
 * victim body half IS (pushbox scales with size).
 */

const {
  HITBOX_DISTANCE_VALUE,
  STRIKE_TIP_SLAP1_SPRITE_PX,
  STRIKE_TIP_SLAP2_SPRITE_PX,
  STRIKE_TIP_CHARGED_SPRITE_PX,
  STRIKE_TIP_PALM_SPRITE_PX,
  STRIKE_SKIN_EMBED_PX,
  SLAP_STARTUP_MS,
  AP_LATE_PARRY_MS,
} = require("./constants");

// Fighter sprite display width / canvas size → world px per source pixel.
const SPRITE_PX_TO_WORLD = (1280 * 0.123) / 960;

const STRIKE_TIP_SPRITE_PX = {
  slap1: STRIKE_TIP_SLAP1_SPRITE_PX,
  slap2: STRIKE_TIP_SLAP2_SPRITE_PX,
  charged: STRIKE_TIP_CHARGED_SPRITE_PX,
  palm: STRIKE_TIP_PALM_SPRITE_PX,
};

// Snap when outside this band around connect distance (avoids micro-jitter).
const CONTACT_SNAP_EPSILON = 1.5;

// Park extension sep inside connect reach. Needs real margin: slap1's tip is
// shorter than slap2, and ice drift across a few ticks can eat a 2px window
// and turn a point-blank slap into a ghost whiff.
const EXTENSION_HIT_SLACK_PX = 8;

// Spark sits past the palm tip toward the opponent (world px). Slap/palm need
// more than charged — those limbs read short and a tip-anchored spark looks
// glued to the hand instead of the impact.
const SPARK_PAST_TIP_PX = {
  slap: 18,
  palm: 16,
  charged: 8,
  slap1: 18,
  slap2: 18,
};

function getVictimBodyHalf(victim) {
  return HITBOX_DISTANCE_VALUE * (victim.sizeMultiplier || 1);
}

function resolveSlapTipKey(attacker) {
  return attacker && attacker.slapAnimation === 2 ? "slap2" : "slap1";
}

function resolveTipKey(attackKind, attacker) {
  if (attackKind === "slap") return resolveSlapTipKey(attacker);
  if (attackKind === "palm" || attackKind === "palmThrust") return "palm";
  if (attackKind === "charged") return "charged";
  return "slap1";
}

function getStrikeTipWorld(attackKind, attacker) {
  const key = resolveTipKey(attackKind, attacker);
  const tipPx = STRIKE_TIP_SPRITE_PX[key] || STRIKE_TIP_SPRITE_PX.slap1;
  // Tip is art-space at the fixed fighter display width (12.30% of 1280).
  // Client sprites do NOT scale with sizeMultiplier — only the pushbox does —
  // so do not multiply tip by sizeMultiplier or connects will fire short of the limb.
  return tipPx * SPRITE_PX_TO_WORLD;
}

/**
 * Center-to-center distance at which the strike tip meets the victim body
 * (minus a tiny skin embed for impact dig).
 */
function getConnectDistance(attackKind, attacker, victim) {
  return (
    getStrikeTipWorld(attackKind, attacker) +
    getVictimBodyHalf(victim) -
    STRIKE_SKIN_EMBED_PX
  );
}

/** World attack direction for a facing value (1 = face left / -X). */
function getAttackDir(attacker) {
  return attacker.facing === 1 ? -1 : 1;
}

function towardVictimDir(attacker, victim) {
  if (victim && typeof victim.x === "number") {
    return victim.x >= attacker.x ? 1 : -1;
  }
  return getAttackDir(attacker);
}

/**
 * X of the impact spark — past the strike tip toward the opponent so it reads
 * on the body, not glued to the palm.
 */
function getContactSeamX(attacker, victim, attackKind) {
  const kind = resolveTipKey(attackKind, attacker);
  const tip = getStrikeTipWorld(attackKind, attacker);
  const toward = towardVictimDir(attacker, victim);
  const past = SPARK_PAST_TIP_PX[kind] ?? SPARK_PAST_TIP_PX.slap;
  return attacker.x + toward * (tip + past);
}

/**
 * Snap the pair to connectDist along the hit axis by moving the victim.
 * Buried overlaps push out; tip-range air gaps pull in — hitstop then freezes
 * a readable contact pose.
 */
function applyContactCorrection(attacker, victim, connectDist) {
  if (!attacker || !victim || !(connectDist > 0)) return false;
  const dx = victim.x - attacker.x;
  const current = Math.abs(dx);
  if (Math.abs(current - connectDist) <= CONTACT_SNAP_EPSILON) return false;
  // If perfectly overlapped, push victim away along attacker facing.
  const pushSign = dx === 0 ? -getAttackDir(attacker) : dx >= 0 ? 1 : -1;
  victim.x = attacker.x + pushSign * connectDist;
  return true;
}

/**
 * While a slap/palm ACTIVE pose is out, keep the opponent at tip-meets-body
 * spacing so the limb cannot bury into their sprite. Charged uses the lunge
 * clamp instead (and already feels good). Runs every tick after pushbox.
 *
 * @param {number} [nowSim] room.simTime — required to gate slap AP grace
 */
function enforceStrikeExtensionSeparation(attacker, opponent, nowSim) {
  if (!attacker || !opponent) return false;
  if (!attacker.isAttacking || attacker.isInStartupFrames) return false;
  // Palm rides attackType "charged" — include via isPalmThrust.
  const kind = attackKindFromPlayer(attacker);
  if (kind !== "slap" && kind !== "palm") return false;

  // Same pass-through exemptions as the pushbox — never horizontally pin a
  // flapping / rope-jumping / dodging / sidestepping / thrown fighter. Without
  // this, a grounded slap ACTIVE turned the tip-sep into an invisible wall the
  // flapper could not fly past.
  if (
    opponent.isDodging ||
    opponent.isSidestepping ||
    opponent.isBeingThrown ||
    opponent.isThrowing ||
    (opponent.isFlapping && opponent.flapPhase === "flight") ||
    (opponent.isRopeJumping && opponent.ropeJumpPhase === "active")
  ) {
    return false;
  }

  // Slap open hits are deferred for AP_LATE_PARRY_MS at the start of ACTIVE.
  // If we push to tip-range during that window, ice drift can carry the pair
  // past connectDist before the hit is allowed to confirm — intermittent
  // point-blank whiffs (worse on slap1's shorter tip). Hold pushbox spacing
  // until the hit can actually land; on-hit contact correction still snaps
  // the freeze frame clean.
  if (
    kind === "slap" &&
    attacker.attackStartTime &&
    typeof nowSim === "number"
  ) {
    const slapAge = nowSim - attacker.attackStartTime;
    if (slapAge < SLAP_STARTUP_MS + AP_LATE_PARRY_MS) {
      return false;
    }
  }

  const attackDir = getAttackDir(attacker);
  const delta = opponent.x - attacker.x;
  // Only when opponent is in front of the strike.
  if (delta * attackDir < 0) return false;

  const minSep = Math.max(
    getConnectDistance(kind, attacker, opponent) - EXTENSION_HIT_SLACK_PX,
    1
  );
  const current = Math.abs(delta);
  if (current >= minSep - 0.01) return false;

  const sign = delta >= 0 ? 1 : -1;
  // Move the opponent (attacker stays planted — slap/palm are not lunges).
  opponent.x = attacker.x + sign * minSep;
  return true;
}

function attackKindFromPlayer(player) {
  if (!player) return "slap";
  if (player.isPalmThrust) return "palm";
  if (player.attackType === "slap") return "slap";
  if (player.attackType === "charged") return "charged";
  if (player.attackType === "lowKick") return "slap";
  return player.attackType || "slap";
}

module.exports = {
  SPRITE_PX_TO_WORLD,
  STRIKE_TIP_SPRITE_PX,
  SPARK_PAST_TIP_PX,
  getVictimBodyHalf,
  getStrikeTipWorld,
  getConnectDistance,
  getContactSeamX,
  applyContactCorrection,
  enforceStrikeExtensionSeparation,
  attackKindFromPlayer,
  getAttackDir,
};

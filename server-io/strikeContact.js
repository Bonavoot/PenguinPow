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
  STRIKE_PALM_REACH_OVERHANG_PX,
  SLAP_STARTUP_MS,
  AP_LATE_PARRY_MS,
  SLAP_TIP_POCKET_SLACK_PX,
  SLAP_ROPE_RESIST_BUFFER,
} = require("./constants");

// Mirror gameUtils map bounds locally — requiring gameUtils here creates a
// circular dependency (gameUtils → systems → strikeContact) and MAP_* arrive
// as undefined during module init.
const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 935;

// Fighter sprite display width / canvas size → world px per source pixel.
const SPRITE_PX_TO_WORLD = (1280 * 0.123) / 960;

const STRIKE_TIP_SPRITE_PX = {
  slap1: STRIKE_TIP_SLAP1_SPRITE_PX,
  slap2: STRIKE_TIP_SLAP2_SPRITE_PX,
  charged: STRIKE_TIP_CHARGED_SPRITE_PX,
  palm: STRIKE_TIP_PALM_SPRITE_PX,
};

// Snap when outside this band around connect distance (avoids micro-jitter).
// Hit confirm uses the same epsilon so "close enough we wouldn't snap" still
// lands — tip-meets-body must never ghost-whiff from float/coast jitter.
const CONTACT_SNAP_EPSILON = 1.5;

// Air-hit: never torso-park to the fist. Pass-through jumps can be overlapping
// or on the far side — a full tip park is a 50–130px teleport into hitstop.
// Only unglue stacked sprites; knockback finishes the separation.
const AIR_HIT_UNSTACK_MAX_PX = 16;
const AIR_HIT_UNSTACK_COMFORT_PX = 36;

// Park extension sep inside connect reach. Needs real margin: ice drift across
// a few ticks can eat a 2px window and turn a point-blank slap into a ghost whiff.
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
 * (minus a tiny skin embed for impact dig). Palm gets a small overhang past
 * the art tip so the rooted poke doesn't feel short of the limb.
 */
function getConnectDistance(attackKind, attacker, victim) {
  const tipKey = resolveTipKey(attackKind, attacker);
  const overhang = tipKey === "palm" ? (STRIKE_PALM_REACH_OVERHANG_PX || 0) : 0;
  return (
    getStrikeTipWorld(attackKind, attacker) +
    getVictimBodyHalf(victim) -
    STRIKE_SKIN_EMBED_PX +
    overhang
  );
}

/**
 * Tip-meets-body (and the contact-snap deadband) confirms. Use this for strike
 * hit checks — never a strict `< connectDist`, which ghost-whiffs exact parks
 * and the ±epsilon band contact correction refuses to pull in.
 */
function isWithinConnectRange(distance, connectDist) {
  return (
    typeof distance === "number" &&
    typeof connectDist === "number" &&
    distance <= connectDist + CONTACT_SNAP_EPSILON
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

// Palm freeze parks a few px OUTSIDE tip-meets-body so the strike pose reads
// palm-on-skin, not limb-through-torso (point-blank bury). Hits still confirm
// at full connectDist; this only changes the hitstop contact pose.
const PALM_HIT_PARK_OUTSET_PX = 6;

/**
 * Freeze-frame park distance. Hits still CONFIRM at full connectDist.
 * Slap / charged park at tip-meets-body; palm parks a few px outside so the
 * rooted pose reads palm-on-skin. Live extension-sep still uses connect−slack
 * so ice/mash stay hittable.
 */
function getHitParkDistance(attackKind, attacker, victim) {
  const connect = getConnectDistance(attackKind, attacker, victim);
  if (attackKind === "palm" || attackKind === "palmThrust") {
    return connect + PALM_HIT_PARK_OUTSET_PX;
  }
  // slap / charged / default — exact tip-meets-body (≤ connect+epsilon so
  // slap re-chains don't soft-whiff the way a park outset would).
  return connect;
}

/**
 * Resting pushbox floor (center-to-center) for this pair — the "pocket" depth
 * of a slap mash. Matches adjustPlayerPositions' half-width sum.
 */
function getSlapPocketDistance(attacker, victim) {
  const a = HITBOX_DISTANCE_VALUE * ((attacker && attacker.sizeMultiplier) || 1);
  const b = HITBOX_DISTANCE_VALUE * ((victim && victim.sizeMultiplier) || 1);
  return a + b;
}

/**
 * Pocket→poke quality in [0, 1] from a pre-extension-sep spacing sample.
 * 0 = belly-to-belly pressure slap; 1 = art-tip poke at max connect.
 *
 * Unused by live combat — the pocket-vs-poke feel package was retired
 * (every connect already parks at tip-meets-body, so the bonus was invisible).
 * Kept for debug / rollback.
 */
function getSlapTipQuality(distance, attacker, victim) {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return 0;
  const pocketEnd = getSlapPocketDistance(attacker, victim) + SLAP_TIP_POCKET_SLACK_PX;
  const connect = getConnectDistance("slap", attacker, victim);
  const span = connect - pocketEnd;
  if (!(span > 1)) return 0;
  return Math.max(0, Math.min(1, (distance - pocketEnd) / span));
}

/**
 * Rope-rest clamp used by tip park / live extension-sep. Matches the slap/palm
 * rope-resistance rest in index.js so a hitstop freeze can never pin a fighter
 * past the map and then snap them inward when hitstop ends.
 */
function clampToRopeRest(x) {
  return Math.max(
    MAP_LEFT_BOUNDARY + SLAP_ROPE_RESIST_BUFFER,
    Math.min(x, MAP_RIGHT_BOUNDARY - SLAP_ROPE_RESIST_BUFFER)
  );
}

/**
 * Snap the pair to parkDist along the hit axis by moving the victim.
 * Buried overlaps push out; tip-range air gaps pull in — hitstop then freezes
 * a readable contact pose.
 *
 * At the tawara the ideal tip spacing often wants the victim PAST the map.
 * Freezing that X through hitstop then clamping after freeze is the
 * outside→snap-back bug on rope barrages. Never write past rope rest; if the
 * rope ate the park, pull the attacker in to keep tip spacing instead.
 */
function applyContactCorrection(attacker, victim, parkDist) {
  if (!attacker || !victim || !(parkDist > 0)) return false;
  const dx = victim.x - attacker.x;
  const current = Math.abs(dx);
  if (Math.abs(current - parkDist) <= CONTACT_SNAP_EPSILON) {
    // Still clamp — a prior unclamped write / coast can leave them past rest
    // inside the epsilon band.
    const clamped = clampToRopeRest(victim.x);
    if (clamped !== victim.x) {
      victim.x = clamped;
      return true;
    }
    return false;
  }
  // If perfectly overlapped, push victim away along attacker facing.
  const pushSign = dx === 0 ? -getAttackDir(attacker) : dx >= 0 ? 1 : -1;
  const idealVictimX = attacker.x + pushSign * parkDist;
  const clampedVictimX = clampToRopeRest(idealVictimX);
  victim.x = clampedVictimX;
  if (clampedVictimX !== idealVictimX) {
    // Victim couldn't take the full park — restore tip spacing from the rope
    // rest by pulling the attacker in (also rope-clamped).
    attacker.x = clampToRopeRest(victim.x - pushSign * parkDist);
  }
  return true;
}

/**
 * Air-hit spacing. Stay on the side they already occupy. Cap the nudge so
 * hitstop freezes the connect, not a warp to the strike tip.
 */
function applyAirHitContactCorrection(attacker, victim) {
  if (!attacker || !victim) return false;
  const dx = victim.x - attacker.x;
  const current = Math.abs(dx);
  if (current >= AIR_HIT_UNSTACK_COMFORT_PX) return false;
  // Dead overlap: unglue in front of the strike (16px), not a tip-park warp.
  const pushSign = dx === 0 ? getAttackDir(attacker) : dx >= 0 ? 1 : -1;
  const nudge = Math.min(
    AIR_HIT_UNSTACK_MAX_PX,
    AIR_HIT_UNSTACK_COMFORT_PX - current
  );
  if (nudge <= 0.5) return false;
  victim.x = clampToRopeRest(victim.x + pushSign * nudge);
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
  if (!attacker.isAttacking) return false;
  // Palm rides attackType "charged" — include via isPalmThrust.
  const kind = attackKindFromPlayer(attacker);
  if (kind !== "slap" && kind !== "palm") return false;
  // Slap waits for ACTIVE (startup has no limb out). Palm is rooted with a
  // long strike pose — keep tip-sep through STARTUP too so point-blank doesn't
  // bury the arm for 90ms before the hit lands.
  if (attacker.isInStartupFrames && kind !== "palm") return false;

  // Same pass-through exemptions as the pushbox — never horizontally pin a
  // flapping / slide-jumping / rope-jumping / dodging / sidestepping / thrown
  // fighter. Without this, a grounded slap ACTIVE turned the tip-sep into an
  // invisible wall the airborne fighter could not fly past.
  // Passive flight passes through grounded tip-sep. Dive-committed flyers stay
  // exempt from the horizontal pin too — hit confirm uses collision, not tip park.
  if (
    opponent.isDodging ||
    opponent.isSidestepping ||
    opponent.isBeingThrown ||
    opponent.isThrowing ||
    (opponent.isSlideJumping && opponent.slideJumpPhase === "flight") ||
    (opponent.isRopeJumping && opponent.ropeJumpPhase === "active") ||
    opponent.isHitFalling
  ) {
    return false;
  }

  // Slap open hits are deferred for AP_LATE_PARRY_MS at the start of ACTIVE.
  // If we push to tip-range during that window, ice drift can carry the pair
  // past connectDist before the hit is allowed to confirm — intermittent
  // point-blank whiffs. Hold pushbox spacing until the hit can actually land;
  // collisionSystem latches slapOpenHitPending so a deferred in-range touch
  // still confirms after grace (with slack). On-hit contact correction still
  // snaps the freeze frame clean.
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

  // LIVE sep must stay INSIDE connect reach — park outset is on-hit only.
  // Palm used connect+outset here and shoved the opponent past the hitbox
  // every startup tick (rooted poke → permanent ghost whiff at standing range).
  // Inward slack matches slap: ice drift across a few ticks won't open a gap
  // past connectDist before the hit confirms. On connect, getHitParkDistance
  // still snaps palm to tip+outset for the freeze pose.
  const connect = getConnectDistance(kind, attacker, opponent);
  const minSep = Math.max(connect - EXTENSION_HIT_SLACK_PX, 1);
  const current = Math.abs(delta);
  if (current >= minSep - 0.01) return false;

  const sign = delta >= 0 ? 1 : -1;
  // Move the opponent (attacker stays planted — slap/palm are not lunges).
  // Rope-rest clamp: live ACTIVE sep must not shove them past the map either,
  // or the next park/hitstop freezes an illegal X.
  opponent.x = clampToRopeRest(attacker.x + sign * minSep);
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
  CONTACT_SNAP_EPSILON,
  AIR_HIT_UNSTACK_MAX_PX,
  AIR_HIT_UNSTACK_COMFORT_PX,
  EXTENSION_HIT_SLACK_PX,
  getVictimBodyHalf,
  getStrikeTipWorld,
  getConnectDistance,
  getHitParkDistance,
  getSlapPocketDistance,
  getSlapTipQuality,
  isWithinConnectRange,
  getContactSeamX,
  clampToRopeRest,
  applyContactCorrection,
  applyAirHitContactCorrection,
  enforceStrikeExtensionSeparation,
  attackKindFromPlayer,
  getAttackDir,
};

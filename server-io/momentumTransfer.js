// Momentum transfer — distance (attacker velocity) and impact (closing speed).
// Authored distances are delivered px against a victim holding nothing.
// Strikes: guaranteed false (DI can shave). Grabs: guaranteed true (no DI).

const {
  TICK_RATE,
  speedFactor,
  ICE_COAST_FRICTION,
  ICE_MAX_SPEED,
  ICE_SLIDE_MAX_SPEED,
  MATADOR_PULL_DISTANCE,
  MATADOR_PULL_DISTANCE_MAX,
} = require("./constants");

// ── Units ───────────────────────────────────────────────────────────────────
// Position integrates as `x += v * delta * speedFactor` each tick, so one
// velocity unit moves `PX_PER_VELOCITY_TICK` px per tick.
const MS_PER_TICK = 1000 / TICK_RATE; // 15.625 ms @64Hz
const PX_PER_VELOCITY_TICK = MS_PER_TICK * speedFactor; // 2.8906 px

// Knockback and free movement share ICE_COAST_FRICTION so handoffVelocity is an identity.
const KB_FRICTION = ICE_COAST_FRICTION; // 0.982
const COAST_FRICTION = ICE_COAST_FRICTION; // 0.982

// Total travel of a velocity decaying geometrically: v * k / (1 - f).
const PX_PER_VELOCITY = PX_PER_VELOCITY_TICK / (1 - COAST_FRICTION); // ~160.6
const PX_PER_KB_VELOCITY = PX_PER_VELOCITY;
const PX_PER_COAST_VELOCITY = PX_PER_VELOCITY;

const kbVelocityToPx = (v) => v * PX_PER_VELOCITY;
const pxToKbVelocity = (px) => px / PX_PER_VELOCITY;
const coastVelocityToPx = (v) => v * PX_PER_VELOCITY;

/**
 * Handoff from the knockback channel to the ice glide.
 *
 * With one friction this is an identity — a velocity crossing at hitstun end
 * keeps both its speed AND the distance it still owed. Kept as a named
 * function because the legacy bug it replaces was a silent 3.9x inflation
 * (assigning knockback velocity into a 4x slower channel), and every call site
 * should keep pointing at one auditable place if the channels ever diverge.
 */
function handoffVelocity(kbVelocity) {
  return (kbVelocity || 0) * ((1 - COAST_FRICTION) / (1 - KB_FRICTION));
}

// ── DI ──────────────────────────────────────────────────────────────────────
// Per-tick friction multiplier during knockback.
const DI_FRICTION_FACTOR = 0.96;

/** True when the victim is holding away from the incoming shove. */
function isDirectionallyInfluencing(victim, awayDir) {
  if (!victim || !victim.keys) return false;
  return awayDir >= 0
    ? !!victim.keys.a && !victim.keys.d
    : !!victim.keys.d && !victim.keys.a;
}

// ── PRESSURE ESCALATION ─────────────────────────────────────────────────────
// Consecutive connects multiply the send: pow(PRESSURE_ESCALATION, step - 1).
// PRESSURE_MAX_STEP 1 = escalation off (plumbing kept).
const PRESSURE_ESCALATION = 1.2;

const PRESSURE_MAX_STEP = 1;

// Consecutive-hit credit lapses if pressure drops. Roughly two slap cycles —
// long enough that a blocked or spaced beat does not reset a real barrage,
// short enough that hits scattered across a round never stack.
const PRESSURE_RESET_MS = 620;

/** Current escalation step for a victim under sustained pressure (1-based). */
function pressureStepFor(victim, nowSim) {
  if (!victim) return 1;
  const last = victim.pressureLastHitAt || 0;
  if (!last || (nowSim || 0) - last > PRESSURE_RESET_MS) return 1;
  return Math.min(PRESSURE_MAX_STEP, Math.max(1, (victim.pressureCount || 0) + 1));
}

/** Multiplier applied to a send for being the Nth consecutive connect. */
function pressureMultiplierFor(step) {
  return Math.pow(PRESSURE_ESCALATION, Math.max(0, (step || 1) - 1));
}

/** Record a connect so the next one escalates. Call once per landed hit. */
function creditPressure(victim, nowSim, step) {
  if (!victim) return;
  victim.pressureCount = step;
  victim.pressureLastHitAt = nowSim || 0;
}

// ── The transfer curve ──────────────────────────────────────────────────────
// V_REF is the speed that buys a move's full ceiling: top ice-slide speed. It
// sits ABOVE walk speed (1.3) so ordinary movement buys a real but partial
// share and the committed slide stays the skill payoff.
//
// MOMENTUM_CURVE > 1 is load-bearing. At 1.0 a casual walk-in buys 54% of the
// range, which makes ordinary movement feel like a power move and flattens the
// skill gradient. At 1.5:
//     standing 0.00 -> 0%      walk top 1.30 -> 40%
//     slide    1.80 -> 65%     slide max 2.40 -> 100%
const V_REF = ICE_SLIDE_MAX_SPEED; // 2.4
const MOMENTUM_CURVE = 1.5;

// No chain of hits may send further than the single biggest authored hit plus a
// little headroom, so sustained pressure can finish but cannot spiral.
// Sits below the centre-to-dohyo-edge distance (390px).
const MAX_SEND_PX = 450;

// Extra share of the distance a fleeing victim still owes, granted when they
// are hit again mid-slide. 0 = pure addition.
const COMPOUND_GAIN = 0;

// Share of still-owed distance that carries into the next hit. 0 = off.
// applyTransferImpulse uses max() so a hit cannot reduce an existing slide.
const COMPOUND_RETAIN = 0;

// How hard the attacker follows their own send. >1 closes distance so mash
// pressure glues instead of soft-whiffing; the old flat 1.35-vs-1.0 constant
// pair did this too, but could not stay glued once sends started varying with
// momentum. Tracking the victim's drift keeps the gap stable at any speed.
// Always credited as granted velocity — chase is never offence.
const SLAP_CHASE_RATIO = 1.15;

// The slap's own forward step-in, applied on hit AND whiff so the move reads
// the same either way. Flat on purpose: the old formula scaled it with carried
// speed, which quietly turned the step-in into a second compounding channel.
// Always credited as granted velocity, so it can never power the next slap.
// ~31px of ground across a slap cycle — a step, not a dash.
const SLAP_STEP_IN_VELOCITY = 0.75;

// Chase speed cap — raised from ICE_MAX_SPEED (1.3) to ICE_SLIDE_MAX_SPEED (2.4).
const CHASE_SPEED_CAP = ICE_SLIDE_MAX_SPEED;

// Multiplier on a slap's forward slide while the fighters' pushboxes overlap.
// Was 0.3 — a 70% brake applied exactly while in slapping range, which
// suppressed forward motion during each slap and released it between them.
const SLAP_SLIDE_CONTACT_DAMP = 0.8;

// Hardest collision available: max slide into max walk-in. Normalises impact.
const V_IMPACT_REF = ICE_SLIDE_MAX_SPEED + ICE_MAX_SPEED; // 3.7

/** Fraction of a move's floor→ceiling range bought by `vSelf`. 0..1 */
function momentumRatio(vSelf) {
  const t = Math.max(0, Math.min(vSelf || 0, V_REF)) / V_REF;
  return Math.pow(t, MOMENTUM_CURVE);
}

/**
 * The core transfer. Everything in and out is PIXELS OF DELIVERED DISTANCE —
 * the unit a designer can hold against a 297.5px centre-to-rope ring.
 *
 * @param {number} vSelf   attacker's own earned speed toward the victim (>= 0)
 * @param {number} floorPx delivered distance at zero speed
 * @param {number} ceilPx  delivered distance at V_REF
 * @param {number} [mult]  multiplicative scaling (counter / posture / BASHO)
 * @returns {number} distance in px
 */
function transfer(vSelf, floorPx, ceilPx, mult = 1) {
  return (floorPx + (ceilPx - floorPx) * momentumRatio(vSelf)) * (mult || 1);
}

// ── Move profiles ───────────────────────────────────────────────────────────
// Authored in PIXELS ACTUALLY DELIVERED against a victim holding nothing.
// A victim who DIs takes ~65% of these. Grabs are `guaranteed` and take 100%.
//
// Anchors: centre-to-rope = 297.5px, fighter width = 110px.
const MOVE_TRANSFER = {
  // send velocity = sendPx / PX_PER_VELOCITY. 175px → ~1.09 initial.
  slap: { floor: 175, ceil: 380, guaranteed: false },

  palm: { floor: 250, ceil: 400, guaranteed: false },

  // vSelf is lunge speed (scales with charge).
  charged: { floor: 110, ceil: 460, guaranteed: false },

  bodySlam: { floor: 170, ceil: 400, guaranteed: false },

  lowKick: { floor: 60, ceil: 150, guaranteed: false },

  // Projectiles carry the thrower's momentum at RELEASE, not at impact.
  snowball: { floor: 90, ceil: 180, guaranteed: false },
  pumoClone: { floor: 90, ceil: 180, guaranteed: false },

  drive: { floor: 160, ceil: 300, guaranteed: true },

  // Belt tug / side-switch. Distance authored, not from run-in.
  pull: { floor: 110, ceil: 150, guaranteed: true },

  // Uses grabber grabApproachSpeed. Floor = standing; ceiling = slide-in.
  matador: {
    floor: MATADOR_PULL_DISTANCE,
    ceil: MATADOR_PULL_DISTANCE_MAX,
    guaranteed: true,
  },

  throw: { floor: 140, ceil: 280, guaranteed: true },
};

/** Look up a move profile, defaulting to the slap so a typo cannot crash a hit. */
function profileFor(moveKey) {
  return MOVE_TRANSFER[moveKey] || MOVE_TRANSFER.slap;
}

// ============================================================================
// GRANTED VELOCITY
// ============================================================================
// Chase/handoff velocity must not count toward vSelf (chase feeding vSelf
// diverges within ~4 hits). Granted velocity still moves you; it cannot be
// spent as offence. Victim knockback points away, so sign already excludes it.
const GRANTED_VELOCITY_MAX_AGE_MS = 900;

function creditGrantedVelocity(player, signedVel, nowSim) {
  if (!player) return;
  player.grantedVelocity = signedVel || 0;
  player.grantedVelocityAt = nowSim || 0;
}

function grantedVelocityNow(player, nowSim) {
  if (!player) return 0;
  const v0 = player.grantedVelocity || 0;
  if (!v0) return 0;
  const dt = (nowSim || 0) - (player.grantedVelocityAt || 0);
  if (!Number.isFinite(dt) || dt < 0 || dt > GRANTED_VELOCITY_MAX_AGE_MS) return 0;
  return v0 * Math.pow(COAST_FRICTION, dt / MS_PER_TICK);
}

function clearGrantedVelocity(player) {
  if (!player) return;
  player.grantedVelocity = 0;
  player.grantedVelocityAt = 0;
}

// ============================================================================
// SAMPLING
// ============================================================================

/** Total signed horizontal velocity, expressed in COAST units. */
function totalVelocity(player) {
  if (!player) return 0;
  const kb = player.knockbackVelocity?.x || 0;
  // Knockback lives in the faster-decaying channel; convert before comparing to
  // movement velocity so "speed" means one thing everywhere.
  return (player.movementVelocity || 0) + handoffVelocity(kb);
}

/**
 * The attacker's EARNED speed toward the victim. Feeds the distance channel.
 * @param {number} dirToVictim +1 if the victim is to the right
 */
function sampleSelfMomentum(attacker, dirToVictim, nowSim) {
  if (!attacker) return 0;
  const earned = totalVelocity(attacker) - grantedVelocityNow(attacker, nowSim);
  const aligned = earned * (dirToVictim >= 0 ? 1 : -1);
  return Math.max(0, Math.min(aligned, V_REF));
}

/**
 * The victim's EARNED speed toward the attacker. Kept for callers that still
 * want that sample; command-grab Pull no longer spends it (belt tug), and
 * Matador samples the grabber's grabApproachSpeed instead.
 */
function samplePullMomentum(victim, dirToAttacker, nowSim) {
  return sampleSelfMomentum(victim, dirToAttacker, nowSim);
}

/**
 * Closing speed of the pair. Feeds the impact channel only. Sampled live on the
 * connect tick from server truth — never backdated, since backdating the
 * victim's state to the attacker's press would hand the attacker a rewind
 * advantage the defender has no equivalent to.
 *
 * Deliberately does NOT subtract granted velocity: a fighter shoved into a
 * second hit really is arriving fast, and that collision really should freeze
 * harder. It cannot be farmed, because impact awards no distance.
 */
function sampleClosingSpeed(attacker, victim, dirToVictim, nowSim) {
  const dir = dirToVictim >= 0 ? 1 : -1;
  // Both measured along the same axis: positive = moving in the direction the
  // victim lies. The attacker moving that way closes the gap; the victim
  // moving that way opens it.
  const a = totalVelocity(attacker) * dir;
  const v = totalVelocity(victim) * dir;

  // Gap-closing rate (a − v), not the sum of both toward-speeds.
  // A fleeing victim subtracts; a chase (both moving the same way) is near zero.
  return Math.max(0, Math.min(a - v, V_IMPACT_REF));
}

// ============================================================================
// APPLICATION
// ============================================================================

/**
 * Apply a send to a victim, in the knockback channel.
 *
 *   fleeing victim  -> distance ADDS to what they still owe  (compounds)
 *   closing/still   -> distance REPLACES it (stopped and reversed)
 *
 * The replace branch pays for reversing an incoming fighter without needing an
 * elastic-collision model; the add branch is the tsuppari rhythm.
 *
 * @param {number} sendPx  delivered distance (>= 0)
 * @param {number} awayDir +1 / -1, direction away from the attacker
 */
function applyTransferImpulse(victim, sendPx, awayDir, nowSim) {
  const dir = awayDir >= 0 ? 1 : -1;
  const send = Math.max(0, sendPx || 0);

  // Owed distance is a ledger, not read back off velocity: slap hitstun ends
  // before the slide (`endHitKnockback` moves remainder into movementVelocity),
  // and rooting actions (palm, dodge, stance) zero movementVelocity.
  const owedPx = owedDistanceNow(victim, nowSim) * dir;
  const wasFleeing = owedPx > 0;

  // A hit must never SLOW an existing slide, so take the larger of the two.
  // With COMPOUND_RETAIN at 0 this is simply max(send, owed): each hit stands
  // on its own speed, but a weak poke cannot cancel a heavy send already in
  // flight.
  let totalPx = wasFleeing
    ? Math.max(owedPx * COMPOUND_RETAIN * (1 + COMPOUND_GAIN) + send, owedPx)
    : send;
  const capped = totalPx > MAX_SEND_PX;
  if (capped) totalPx = MAX_SEND_PX;

  creditOwedDistance(victim, totalPx * dir, nowSim);

  return {
    velocity: pxToKbVelocity(totalPx) * dir,
    sendPx: totalPx,
    compounded: wasFleeing,
    capped,
  };
}

// ── OWED-DISTANCE LEDGER ────────────────────────────────────────────────────
// How much ground a victim still has coming to them, signed by direction, with
// the timestamp it was set. Decays on the ice curve so it matches what their
// slide would have done, but survives anything they press.
const OWED_MAX_AGE_MS = 1600;

/** Signed px still owed at `nowSim`, decayed on the coast curve. */
function owedDistanceNow(victim, nowSim) {
  if (!victim) return 0;
  const px = victim.momentumOwedPx || 0;
  if (!px) return 0;
  const dt = (nowSim || 0) - (victim.momentumOwedAt || 0);
  if (!Number.isFinite(dt) || dt < 0 || dt > OWED_MAX_AGE_MS) return 0;
  return px * Math.pow(COAST_FRICTION, dt / MS_PER_TICK);
}

function creditOwedDistance(victim, signedPx, nowSim) {
  if (!victim) return;
  victim.momentumOwedPx = signedPx || 0;
  victim.momentumOwedAt = nowSim || 0;
}

function clearOwedDistance(victim) {
  if (!victim) return;
  victim.momentumOwedPx = 0;
  victim.momentumOwedAt = 0;
}

/**
 * True while a fighter is still riding out a shove. Rooting actions should
 * check this before zeroing `movementVelocity` — being shoved on ice is not
 * something you get to cancel by pressing a button.
 */
const HIT_SLIDE_KEEP_PX = 25;

function isRidingHitSlide(player, nowSim) {
  return Math.abs(owedDistanceNow(player, nowSim)) > HIT_SLIDE_KEEP_PX;
}

/**
 * Approximate distance a DI-ing victim travels from a given send, for docs and
 * tests. DI is a per-tick friction multiplier, so the exact figure depends on
 * how long the victim holds away — this is the steady-state ratio if they hold
 * for the whole slide.
 */
function diReducedPx(sendPx) {
  const ratio =
    (1 - COAST_FRICTION) / (1 - COAST_FRICTION * DI_FRICTION_FACTOR);
  return (sendPx || 0) * ratio;
}

// ============================================================================
// IMPACT CHANNEL
// ============================================================================

/** Normalised collision severity, 0..1. */
function impactScalar(vClose) {
  return Math.max(0, Math.min((vClose || 0) / V_IMPACT_REF, 1));
}

// Hitstop from closing speed (replaces fixed HITSTOP_SLAP_MS / HITSTOP_BURST_MS /
// HITSTOP_CHARGED ladder). Floor 45ms.
const HITSTOP_FLOOR_MS = 45;
const HITSTOP_CEIL_MS = 260;

// Extra freeze from send distance, capped (a prior bug fired ~199ms inside a 260ms slap cycle).
const HITSTOP_POWER_BONUS_MAX_MS = 70;

const HITSTOP_POWER_WEIGHT = {
  slap: 0.15,
  lowKick: 0.3,
  snowball: 0.3,
  pumoClone: 0.3,
  palm: 1.0,
  charged: 1.0,
  bodySlam: 1.0,
  drive: 0.6,
  pull: 0.6,
  throw: 0.6,
};

function hitstopPowerWeightFor(moveKey) {
  const w = HITSTOP_POWER_WEIGHT[moveKey];
  return Number.isFinite(w) ? w : 0.6;
}

function hitstopMsFor(vClose, weight = 1, power = 0, powerWeight = 1) {
  const base =
    HITSTOP_FLOOR_MS + (HITSTOP_CEIL_MS - HITSTOP_FLOOR_MS) * impactScalar(vClose);
  // weight scales freeze above the floor. Weight < 1 must not pull below
  // HITSTOP_FLOOR_MS (flat-footed slap was resolving to 45*0.7≈32ms).
  const weighted = base * (weight || 1);
  const powerBonus =
    HITSTOP_POWER_BONUS_MAX_MS *
    Math.max(0, Math.min(power || 0, 1)) *
    Math.max(0, powerWeight);
  return Math.round(Math.max(weighted, HITSTOP_FLOOR_MS) + powerBonus);
}

// Posture chip. Lethal line is 85 damage (BALANCE_MAX 100 → CLINCH_THROW_KILL_THRESHOLD 15)
// vs 35/s regen after a 1.75s delay.
const POSTURE_CHIP_FLOOR = 4;
const POSTURE_CHIP_CEIL = 30;

// `base` always chips; `scale` is added from closing speed.
const POSTURE_CHIP_PROFILE = {
  slap: { base: 3, scale: 7 }, // was flat 7
  palm: { base: 10, scale: 12 }, // was flat 20
  charged: { base: 10, scale: 14 }, // was flat 18
  bodySlam: { base: 10, scale: 12 },
  lowKick: { base: 4, scale: 6 },
  snowball: { base: 3, scale: 4 },
  pumoClone: { base: 3, scale: 4 },
};

/** Posture damage for a move at a given closing speed. */
function postureChipForMove(moveKey, vClose) {
  const p = POSTURE_CHIP_PROFILE[moveKey] || POSTURE_CHIP_PROFILE.slap;
  return p.base + p.scale * impactScalar(vClose);
}

function postureChipFor(vClose, weight = 1) {
  const raw =
    POSTURE_CHIP_FLOOR + (POSTURE_CHIP_CEIL - POSTURE_CHIP_FLOOR) * impactScalar(vClose);
  return Math.round(raw * (weight || 1));
}

// Per-move weight on the IMPACT channel only (not distance).
const IMPACT_WEIGHT = {
  slap: 0.7,
  palm: 1.45,
  charged: 1.35,
  bodySlam: 1.3,
  lowKick: 0.8,
  snowball: 0.7,
  pumoClone: 0.7,
  drive: 0.9,
  pull: 0.9,
  throw: 1.0,
};

function impactWeightFor(moveKey) {
  const w = IMPACT_WEIGHT[moveKey];
  return Number.isFinite(w) ? w : 1;
}

// ============================================================================
// PRESENTATION PAYLOAD
// ============================================================================
// `power` = distance channel (VFX scale). `impact` = collision channel (shake, SFX).
function buildImpactTelemetry({ sendPx, vClose, compounded, capped, guaranteed }) {
  return {
    power: Math.max(0, Math.min((sendPx || 0) / MAX_SEND_PX, 1)),
    impact: impactScalar(vClose),
    sendPx: Math.round(sendPx || 0),
    compounded: !!compounded,
    capped: !!capped,
    guaranteed: !!guaranteed,
  };
}

// ============================================================================
// FULL RESOLUTION HELPER
// ============================================================================
// Call sites remain responsible for direction, gating and state flags.
function resolveTransfer(opts) {
  const {
    attacker,
    victim,
    moveKey,
    dirToVictim,
    nowSim,
    mult = 1,
    selfOverride,
  } = opts;

  const profile = profileFor(moveKey);
  const dir = dirToVictim >= 0 ? 1 : -1;

  let vSelf;
  if (Number.isFinite(selfOverride)) {
    vSelf = Math.max(0, Math.min(selfOverride, V_REF));
  } else if (moveKey === "pull") {
    // Belt tug — distance is the posture band, not their run-in.
    vSelf = 0;
  } else {
    vSelf = sampleSelfMomentum(attacker, dir, nowSim);
  }

  const vClose = sampleClosingSpeed(attacker, victim, dir, nowSim);
  const basePx = transfer(vSelf, profile.floor, profile.ceil, mult);

  // Sustained pressure walks the send up this move's own floor→ceiling range.
  // Capped at the ceiling so escalation and momentum lead to the same peak by
  // two different routes — earn it with speed, or earn it with pressure — and
  // neither can stack past what the move is allowed to do.
  const step = pressureStepFor(victim, nowSim);
  const escalated = basePx * pressureMultiplierFor(step);
  const sendPx = Math.min(escalated, profile.ceil * (mult || 1));

  const applied = applyTransferImpulse(victim, sendPx, dir, nowSim);
  const weight = impactWeightFor(moveKey);
  creditPressure(victim, nowSim, step);

  const powerScalar = Math.max(0, Math.min(applied.sendPx / MAX_SEND_PX, 1));

  return {
    vSelf,
    vClose,
    sendPx: applied.sendPx,
    authoredPx: basePx,
    pressureStep: step,
    powerScalar,
    velocity: applied.velocity,
    compounded: applied.compounded,
    capped: applied.capped,
    guaranteed: !!profile.guaranteed,
    hitstopMs: hitstopMsFor(
      vClose,
      weight,
      powerScalar,
      hitstopPowerWeightFor(moveKey)
    ),
    postureChip: postureChipFor(vClose, weight),
    telemetry: buildImpactTelemetry({
      sendPx: applied.sendPx,
      vClose,
      compounded: applied.compounded,
      capped: applied.capped,
      guaranteed: !!profile.guaranteed,
    }),
  };
}

module.exports = {
  // units + frictions
  MS_PER_TICK,
  PX_PER_VELOCITY_TICK,
  KB_FRICTION,
  COAST_FRICTION,
  PX_PER_VELOCITY,
  PX_PER_KB_VELOCITY,
  PX_PER_COAST_VELOCITY,
  kbVelocityToPx,
  pxToKbVelocity,
  coastVelocityToPx,
  handoffVelocity,
  DI_FRICTION_FACTOR,
  diReducedPx,
  isDirectionallyInfluencing,
  PRESSURE_ESCALATION,
  PRESSURE_RESET_MS,
  pressureStepFor,
  pressureMultiplierFor,
  creditPressure,

  // curve
  V_REF,
  MOMENTUM_CURVE,
  MAX_SEND_PX,
  COMPOUND_GAIN,
  COMPOUND_RETAIN,
  PRESSURE_MAX_STEP,
  SLAP_CHASE_RATIO,
  SLAP_STEP_IN_VELOCITY,
  CHASE_SPEED_CAP,
  SLAP_SLIDE_CONTACT_DAMP,
  V_IMPACT_REF,
  momentumRatio,
  transfer,

  // profiles
  MOVE_TRANSFER,
  profileFor,

  // granted-velocity guard
  GRANTED_VELOCITY_MAX_AGE_MS,
  creditGrantedVelocity,
  grantedVelocityNow,
  clearGrantedVelocity,

  // sampling
  totalVelocity,
  sampleSelfMomentum,
  samplePullMomentum,
  sampleClosingSpeed,

  // application
  applyTransferImpulse,
  OWED_MAX_AGE_MS,
  HIT_SLIDE_KEEP_PX,
  owedDistanceNow,
  creditOwedDistance,
  clearOwedDistance,
  isRidingHitSlide,

  // impact
  impactScalar,
  HITSTOP_FLOOR_MS,
  HITSTOP_CEIL_MS,
  HITSTOP_POWER_BONUS_MAX_MS,
  POSTURE_CHIP_FLOOR,
  POSTURE_CHIP_CEIL,
  POSTURE_CHIP_PROFILE,
  postureChipForMove,
  hitstopMsFor,
  postureChipFor,
  IMPACT_WEIGHT,
  impactWeightFor,
  HITSTOP_POWER_WEIGHT,
  hitstopPowerWeightFor,

  // presentation + orchestration
  buildImpactTelemetry,
  resolveTransfer,
};

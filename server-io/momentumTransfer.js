// ============================================================================
// MOMENTUM TRANSFER — the single combat language
// ============================================================================
// See MOMENTUM_COMBAT_SPEC.md for the design rationale.
//
// THE RULE
//   Fixed values are floors. Ceilings are bought with speed.
//   How far you send them  ← YOUR velocity      (distance channel)
//   How much it hurts      ← CLOSING velocity   (impact channel)
//   Impulse ADDS to a fleeing victim's slide, so pressure compounds.
//
// WHY TWO CHANNELS
//   Physically, two masses meeting head-on cancel — a mutual charge should not
//   send anyone further than a one-sided hit. So closing speed drives hitstop
//   and posture, never distance. This is also the netcode-correct split:
//   distance depends only on the attacker's own state (backdatable to their
//   true press), while closing speed must be sampled live on server truth. The
//   channel that decides the round is latency-fair; the channel that is
//   latency-sensitive does not decide the round.
//
// ── WHY DISTANCES ARE AUTHORED IN "DELIVERED PX", NOT "SETTLE PX" ───────────
// The legacy model set a knockback velocity and let friction integrate it to
// rest. That produced a 3.6x–6x spread between a victim who held nothing and a
// victim who DI'd + braked, because:
//   1. DI multiplies knockback friction (index.js:1272), and
//   2. `endHitKnockback` hands leftover knockback straight into
//      `movementVelocity`, where ICE_BRAKE_FRICTION (0.80) devours it —
//      a velocity crossing from the 0.97 knockback channel into the 0.982
//      coast channel silently changes how far it travels.
// Measured on the legacy constants: a palm thrust travels 385px against a
// victim holding nothing and 107px against one who brakes. A slap: 149px vs
// 25px.
//
// That spread is bad in both directions. Authoring against the no-input number
// makes every value look enormous (and is what made the original audit
// overstate the problem). Authoring against the braked number makes hits
// disappear the moment anyone learns to hold back — a 35px "settle" slap lands
// as a 6px nudge, which is the "slow and boring" failure mode.
//
// So: authored numbers are what a hit ACTUALLY DELIVERS against a victim who
// does nothing, and DI is bounded to shaving ~35% rather than ~83%. It is a
// real defensive skill, not an off switch. Two mechanisms make that true:
//   • A dedicated knockback friction (KB_FRICTION) tuned so a shove lands
//     promptly instead of trickling out over a second and a half.
//   • A DISTANCE-PRESERVING handoff (see `handoffVelocity`) so the residual
//     glide carries the remaining distance instead of inflating or eating it.
//
// ── CONTESTED VS GUARANTEED ────────────────────────────────────────────────
// Strikes are CONTESTED: DI can shave them. Grabs are GUARANTEED: a carried
// fighter has no DI, so a grab delivers exactly what it says. That is the
// grab's whole reason to exist next to a cheaper, faster palm thrust — not
// more distance, but distance that cannot be argued with.
// ============================================================================

const {
  TICK_RATE,
  speedFactor,
  ICE_COAST_FRICTION,
  ICE_MAX_SPEED,
  ICE_SLIDE_MAX_SPEED,
} = require("./constants");

// ── Units ───────────────────────────────────────────────────────────────────
// Position integrates as `x += v * delta * speedFactor` each tick, so one
// velocity unit moves `PX_PER_VELOCITY_TICK` px per tick.
const MS_PER_TICK = 1000 / TICK_RATE; // 15.625 ms @64Hz
const PX_PER_VELOCITY_TICK = MS_PER_TICK * speedFactor; // 2.8906 px

// ── ONE FRICTION. THE ICE IS THE POINT. ─────────────────────────────────────
// An earlier revision gave knockback its own faster friction (0.93) so shoves
// would "land promptly", and scaled the handoff to preserve distance. It was
// wrong, and playtest caught it immediately:
//
//   • The victim decelerated hard and then DROPPED SPEED 4x at hitstun end,
//     because the handoff scaled velocity to conserve remaining distance
//     across channels. Total distance was right; the motion was a hard brake
//     followed by a creep. The ice glide simply disappeared.
//   • Only ~30% of a shove survived a 260ms slap cycle instead of ~74%, so
//     nothing carried between hits and a barrage never built.
//   • The attacker's chase, derived through the same handoff, shrank to a
//     quarter of the victim's drift, so pressure stopped moving you forward.
//
// All three were the same mistake. Knockback and free movement now share ONE
// friction, which makes the handoff an identity, keeps velocity continuous
// through hitstun end, and lets a shove flow into a long glide the way ice
// should. "Landing promptly" was never worth the ice.
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
// DI is back to a per-tick friction multiplier during knockback, which is how
// the game always played and which playtest confirmed was never the problem:
// "I never had a problem with DI-able sliding knockback, I only really had an
// issue of how fast you can kill due to overall power."
//
// An earlier revision replaced it with a flat 35% multiplier at connect and
// added a footing-loss window that blocked braking. Both were solving a
// problem the game does not have — kill speed is controlled by the floor and
// ceiling values, not by taking away the defender's slide control. Taking
// away brake authority also made the ice feel LESS controllable, which is the
// opposite of the intent.
const DI_FRICTION_FACTOR = 0.96;

/** True when the victim is holding away from the incoming shove. */
function isDirectionallyInfluencing(victim, awayDir) {
  if (!victim || !victim.keys) return false;
  return awayDir >= 0
    ? !!victim.keys.a && !victim.keys.d
    : !!victim.keys.d && !victim.keys.a;
}

// ── PRESSURE ESCALATION — slaps build their own momentum ────────────────────
// THE THING THIS EXISTS FOR. Pure additive compounding produced a flat,
// grindy curve: ground per slap ran 10, 18, 24, 28, 31, 33, 35 px and needed
// ~13 connects to cross a half-ring. Playtest called it, correctly, "100 slap
// hits to win."
//
// The ice does compound (~74% of a shove is still owed when the next slap
// lands), but linear addition converges — each hit adds the same 40px while
// decay removes a growing amount, so the curve flattens instead of building.
//
// Consecutive connects now multiply the send, walking the move up its own
// floor→ceiling range. Ground per slap becomes 17, 35, 57, 84, 118 px: five
// connects from centre to rope, each visibly heavier than the last.
//
// Why five is fair rather than cheap: slap hitstun is +0 BY CONSTRUCTION
// (COMBAT_INVARIANTS #3) — the victim is actionable the moment the attacker
// is, so a barrage is not a combo. Five connects in a row means winning five
// consecutive interactions against someone free to DI, parry, dodge or
// sidestep out at any point. That should end a round.
// Tuned DOWN from 1.45 as the floors went up. With a 110px floor a steeper
// multiplier reached ring-out on the 4th connect, which playtest explicitly
// did not want ("im afraid of making the game 3-4 slaps and you win again").
// The ramp now starts sooner because the FIRST hit is bigger, not because the
// multiplier is steeper — ground per slap runs 29, 56, 82, 111, ring-out on 5.
const PRESSURE_ESCALATION = 1.2;

// Escalation is a ONE-TIME step-up, not a ladder. Connecting a second time
// raises the send; connecting a fifth time does not raise it further.
//
// Unbounded escalation made pressure snowball, which ended rounds before the
// match had a chance to develop — playtest: "rounds end way too quick... my
// game barely allows any time for conditioning before good gameplay even
// happens." A plateau is also better for the DEFENDER: after a couple of
// connects the situation stops getting worse, so eating a hit is survivable
// and reads are still worth making. A snowball punishes one mistake with the
// round.
// 1 = escalation OFF. Same reasoning as COMPOUND_RETAIN: a hit's power should
// come from the speed behind it, not from how many hits preceded it. The
// plumbing stays wired so this is a one-number change if pressure-based
// escalation is ever wanted back.
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
//
// Zero is correct now that knockback rides the ice friction. A slap cycle
// (260ms) only decays a slide by 26%, so ~74% of the previous shove is still
// owed when the next one lands — the ice does the compounding for free, and
// flight speed climbs ~3.8x across a barrage. The earlier 0.15 was propping up
// a fast knockback friction that was destroying the carryover; stacking it on
// top of the real ice curve pushes the recurrence close to unstable.
const COMPOUND_GAIN = 0;

// Share of the still-owed distance that carries into the next hit.
//
// This, not the escalation multiplier, is what was ending rounds early —
// capping escalation alone changed a centre-to-rope barrage from 5 connects to
// 5. Full retention meant every hit stacked on the last and the sequence
// accelerated indefinitely.
//
// At 0.7 the barrage plateaus instead of snowballing: ground per slap runs
// 29, 49, 60, 65, 68, 70 and settles. Pressure still builds, and it still
// converts, but a defender who has eaten three slaps knows the fourth is not
// going to be worse — which is the stable situation conditioning needs.
// ZERO — compounding is off. Power comes from SPEED, and from nothing else.
//
// Carrying owed distance between hits meant a slap's strength depended on how
// many slaps preceded it, which is a second, competing source of power next to
// momentum. It also ended rounds before a match could develop. With this at 0
// each hit is judged purely on the speed behind it, which is the single rule
// this whole system exists to express.
//
// Note the max() in applyTransferImpulse: a hit can never REDUCE an existing
// slide, so a light slap cannot cancel a palm's send.
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

// A chase must never move you faster than you could move yourself. Without
// this, an escalating barrage flung the attacker to ~3.25 — above their own
// max slide — which both looked wrong and meant a launched victim could never
// outrun the pressure. Capping it is what ENDS a barrage naturally: once the
// victim is flying faster than you can follow, they are out of range and the
// sequence is over. That self-limit is the anti-mash mechanism.
//
// Raised from ICE_MAX_SPEED (walking, 1.3) to ICE_SLIDE_MAX_SPEED (full
// power-slide, 2.4) — still <= V_REF so "chase never outpaces a real
// movement speed" holds, but walking-speed pursuit was falling well short of
// what a momentum-boosted slap (e.g. dodge-slide into slap) actually sends:
// at vSelf ~1.7 the send already needs ~2.1 to stay glued, more than the old
// cap could ever deliver, so a solid chunk of ordinary (not even maxed)
// momentum entries were already softly whiffing their follow-up before this
// change. The escape valve survives only at the very top of the curve now
// (send velocities north of ~2.1), instead of kicking in for most
// non-flat-footed slaps.
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
  // The poke. Floor is ~1/3 of a body width: a light tick, not a shove.
  // Ceiling is 2/3 of the half-ring, so a full-commit slide slap is a real
  // positional swing without being a kill on its own.
  // ── FLOORS ARE ALSO A SPEED DIAL, NOT JUST A DISTANCE DIAL ───────────────
  // At the ice friction, distance and speed are locked together: a send's
  // initial velocity is exactly sendPx / PX_PER_VELOCITY. So a small send is
  // not just short, it is SLOW — a 65px slap starts at 0.40 against a walking
  // speed of 1.3 and averages 27px/s over 2.4s, roughly a ninth of walking
  // pace. Playtest read that as "higher friction on dirt rather than ice",
  // which is correct: you cannot make a small send look slippery.
  //
  // Floors are therefore set by the speed they need to LOOK like, not just the
  // ground they grant. Rough guide at this friction:
  //     100px -> 0.62 initial (half walking, a visible shove)
  //     170px -> 1.06 initial (near walking, a real slide)
  //     320px -> 1.99 initial (faster than walking, a launch)
  // Raised from 110/320. At 110 a flat-footed barrage needed ~11 connects to
  // walk someone from centre to the rope, which played as a grind — playtest:
  // "the pacing and weakness of the slapattacks make the game excrutiatingly
  // boring and slow." At 165 that becomes ~7, and the floor's initial speed
  // (1.03) finally sits near walking pace, so a single slap reads as a shove
  // rather than a nudge.
  //
  // Raised again 165 -> 175: every slap (including a flat-footed one) hits a
  // bit harder without touching the momentum curve or K_SLAP_KB_INHERIT — the
  // entry-speed REWARD (ceil - floor) is unchanged, only the baseline every
  // send starts from moved up. Capped here by the MOVE IDENTITY invariant
  // (palm.floor >= slap.floor * 1.4, see transfer.test.js) — 175 * 1.4 = 245,
  // comfortably under the palm's 250 floor, so the palm still reads as
  // decisively heavier per press. Floor cannot go much past ~178 without
  // also raising the palm to keep that identity intact.
  //
  // This is safer than it looks for round length: SLAP_KILL_RANGE is 25px, so
  // slaps still cannot ring anyone out except right at the rope. More power
  // means reaching the interesting part FASTER, not winning faster.
  //
  // Ceiling stays under the palm's 400 so the heavy still out-sends the light
  // at every momentum level (see the MOVE IDENTITY tests).
  slap: { floor: 175, ceil: 380, guaranteed: false },

  // Heavy, rooted, committal — and the answer to "why press this instead of
  // slapping?". Its identity is POWER NOW versus the slap's POWER OVER TIME:
  // one palm from neutral delivers what takes two or three consecutive slap
  // connects to build. At 200 it was only 1.8x a slap floor, close enough that
  // playtest found it pointless. The gap has to be obvious per press.
  palm: { floor: 250, ceil: 400, guaranteed: false },

  // Charged headbutt. Its vSelf is the lunge speed, which scales with charge —
  // so charge buys momentum which buys distance, and a full-charge release is
  // the single biggest hit in the game.
  charged: { floor: 110, ceil: 460, guaranteed: false },

  bodySlam: { floor: 170, ceil: 400, guaranteed: false },

  // Trip. Never a ring-out tool by intent.
  lowKick: { floor: 60, ceil: 150, guaranteed: false },

  // Projectiles carry the thrower's momentum at RELEASE, not at impact.
  snowball: { floor: 90, ceil: 180, guaranteed: false },
  pumoClone: { floor: 90, ceil: 180, guaranteed: false },

  // ── Grabs: GUARANTEED. A carried fighter cannot DI. ──────────────────────
  // This is the grab's identity next to a cheaper, faster palm: not more
  // distance, but distance that cannot be argued with. A palm sends 300 or 195
  // depending on whether they hold back; a maxed drive sends 300, always.
  //
  // A standing drive is worth ~1/4 of a body width, so grab spam is
  // self-punishing without needing a cooldown to stop it.
  drive: { floor: 60, ceil: 300, guaranteed: true },

  // PULL spends THEIR momentum (see samplePullMomentum). Against a stationary
  // opponent it is a side switch; against a committed charge it launches.
  pull: { floor: 80, ceil: 330, guaranteed: true },

  // THROW is the neutral option: highest floor, lowest ceiling, least
  // speed-dependent. What you take when you have not earned a momentum edge.
  throw: { floor: 140, ceil: 280, guaranteed: true },
};

/** Look up a move profile, defaulting to the slap so a typo cannot crash a hit. */
function profileFor(moveKey) {
  return MOVE_TRANSFER[moveKey] || MOVE_TRANSFER.slap;
}

// ============================================================================
// GRANTED VELOCITY — the anti-runaway guard
// ============================================================================
// PROBLEM. A slap pushes the ATTACKER forward on hit (the chase/glue push), and
// the knockback handoff feeds leftover velocity into `movementVelocity`. If
// engine-granted velocity counted toward `vSelf`, every landed hit would make
// the next hit stronger — compounding without bound and making mashing the
// dominant strategy, the exact degenerate this system exists to remove. Solving
// the fixed point with chase feeding vSelf diverges within ~4 hits.
//
// RULE. Momentum must be EARNED by moving, never GRANTED by landing a hit.
// Granted velocity still moves you; it just cannot be spent as offence.
//
// The victim side needs no guard: knockback points AWAY from the attacker and
// `vSelf` only counts velocity moving TOWARD the opponent, so sign excludes it.
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
 * The victim's EARNED speed toward the attacker. Feeds PULL's distance channel
 * — you cannot pull someone using momentum you just gave them yourself.
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

  // THE GAP-CLOSING RATE, not the sum of both speeds.
  //
  // This previously summed each fighter's toward-motion independently, which
  // meant a victim FLEEING contributed 0 rather than subtracting. During a
  // barrage the attacker chases a victim who is flying away, so closing speed
  // read as the full chase speed (~3.25) and every slap in the sequence fired
  // ~199ms of hitstop — inside a 260ms slap cycle. The game spent more time
  // frozen than moving, which is the stutter playtest reported as "weird
  // freezes instead of it all coming out smooth".
  //
  // Measuring the gap makes a chase nearly free (both moving the same way =
  // nothing is closing) while a genuine head-on collision still maxes it,
  // which is the only case that should ever freeze the screen hard.
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

  // Distance the victim still owes, tracked on its own ledger rather than read
  // back off their velocity fields.
  //
  // Two failures forced this. First, slap hitstun is +0, so it ends before the
  // slide does — `endHitKnockback` moves the remainder from knockbackVelocity
  // into movementVelocity, so reading knockbackVelocity alone saw ZERO between
  // slaps. Second, and worse: plenty of actions ZERO movementVelocity to root
  // a fighter (the palm at gameFunctions.js, dodges, stance changes). A victim
  // who is being slapped and mashes palm wipes their own slide every cycle, so
  // compounding could never accumulate against an opponent who keeps acting —
  // which is every opponent. Playtest found it against a palm-spamming CPU:
  // "most of the hits look the exact same... on whiff I CAN see it getting
  // faster, so this could solely be an on-hit problem."
  //
  // The ledger decays on the same ice curve, so it stays physically honest,
  // but nothing the victim presses can erase what they were owed.
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

// Replaces the fixed ladder (HITSTOP_SLAP_MS 70 / HITSTOP_BURST_MS 160 /
// HITSTOP_CHARGED 160-280). Hitstop stops being a property of WHICH MOVE and
// becomes a property of HOW HARD THE COLLISION WAS.
//
// The floor keeps light hits crisp rather than weak: a poke should read as a
// poke, and 45ms is a clean tick.
const HITSTOP_FLOOR_MS = 45;
const HITSTOP_CEIL_MS = 260;

// A SECOND, BOUNDED term so the escalation is felt and not just measured.
// Closing speed is near zero while chasing a fleeing victim, so every slap in
// a barrage froze for an identical ~40ms even as the sends tripled — playtest:
// "the ramp up seems invisible... all back to back hits feel somewhat similar."
// Adding a little freeze per unit of SEND makes each successive hit land
// heavier.
//
// Hard-capped well under the impact ceiling on purpose: an earlier bug fired
// ~199ms on every barrage slap inside a 260ms cycle and read as a stutter.
// This can add at most HITSTOP_POWER_BONUS_MAX_MS, so a full barrage climbs
// roughly 45 -> 110ms and still never approaches that failure.
const HITSTOP_POWER_BONUS_MAX_MS = 70;

// ── MOVE IDENTITY: who is allowed to feel heavy ─────────────────────────────
// The power bonus is per-move, because applying it evenly destroyed the slap's
// reason to exist. A 4th chained slap was freezing 119ms against a palm's
// 109ms — the LIGHT attack felt heavier than the HEAVY one, and playtest
// called it: "the slaps kinda lost their quick attack identity... the palm
// thrust almost feels worthless to press now."
//
// The bonus was originally a crutch to make the escalation legible while
// compounding was broken. Compounding works now, so the ramp reads through
// distance and slide speed (110px -> 424px, speed 0.68 -> 2.64) and the slap
// no longer needs freeze to sell it. Near-zero here keeps a jab a jab.
const HITSTOP_POWER_WEIGHT = {
  slap: 0.15, // stays crisp no matter how far the chain has built
  lowKick: 0.3,
  snowball: 0.3,
  pumoClone: 0.3,
  palm: 1.0, // the heavy is allowed to thud
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
  // weight scales how much freeze a move earns ABOVE the floor (palm should
  // thud harder than a slap at equal closing speed) — but for a weight < 1
  // move (slap 0.7, lowKick/snowball/pumoClone) it must not scale the floor
  // ITSELF below HITSTOP_FLOOR_MS, or the "a poke should read as a poke"
  // guarantee above silently breaks: a flat-footed slap (vClose≈0, the most
  // common connect in the game) was resolving to 45*0.7≈32ms — under the
  // floor it was supposed to never go below. Heavy moves (weight >= 1) are
  // unaffected: their weighted value already clears the floor on its own.
  const weighted = base * (weight || 1);
  const powerBonus =
    HITSTOP_POWER_BONUS_MAX_MS *
    Math.max(0, Math.min(power || 0, 1)) *
    Math.max(0, powerWeight);
  return Math.round(Math.max(weighted, HITSTOP_FLOOR_MS) + powerBonus);
}

// Posture chip. Today reaching the lethal line (85 damage vs 35/s regen) needs
// ~3.2s of unbroken pressure, which a 5s bout never produces — so posture never
// breaks and every posture-scaled bonus in the game is dead content. Scaling
// chip with collision severity makes three hard reads a break while twenty
// standing pokes are not.
const POSTURE_CHIP_FLOOR = 4;
const POSTURE_CHIP_CEIL = 30;

// ── PER-MOVE POSTURE PROFILE ────────────────────────────────────────────────
// `base` is what a hit always chips; `scale` is what closing speed adds on top.
// So a flat-footed poke barely disturbs balance while a hard read genuinely
// breaks it — the same distance/impact split the rest of the system uses.
//
// Calibrated DOWN from the old flat constants (slap 7, palm 20, charged 18).
// Now that compounding lands full barrages, strikes were chipping posture far
// too fast. Grabs take over as the posture breaker instead, which is both the
// sumo fiction (grip fighting is what breaks balance) and the thing that gives
// the grab a job now that posture no longer sets its distance.
//
// Budget: 85 damage from full to the lethal line (BALANCE_MAX 100 →
// CLINCH_THROW_KILL_THRESHOLD 15), against 35/sec regen after a 1.75s delay.
const POSTURE_CHIP_PROFILE = {
  slap: { base: 3, scale: 7 }, // was flat 7 — a poke should chip, not break
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

// Per-move weight on the IMPACT channel only. Distance is already
// differentiated by the floor/ceiling profile; this lets a palm feel heavier
// than a slap at equal closing speed without giving it extra ground.
const IMPACT_WEIGHT = {
  slap: 0.7, // crisp tick — a jab should never stop the screen
  palm: 1.45, // the heaviest ground thud in the game
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
// Client shake / VFX scale / SFX layering previously keyed off knockback
// magnitude. Under this model a floor hit carries little knockback, so keying
// off knockback alone would make light hits read as BROKEN rather than LIGHT.
// The client needs both channels explicitly: `power` is the distance channel
// (VFX scale), `impact` is the collision channel (shake, SFX weight). A
// slide-in on a stationary target is high power / medium impact; a mutual
// head-on is medium power / maximum impact. They must be able to look
// different.
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
  const usePull = moveKey === "pull";

  let vSelf;
  if (Number.isFinite(selfOverride)) {
    vSelf = Math.max(0, Math.min(selfOverride, V_REF));
  } else if (usePull) {
    vSelf = samplePullMomentum(victim, -dir, nowSim);
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

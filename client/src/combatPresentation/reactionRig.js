/**
 * Reaction Rig — the single owner of a fighter's BODY POSTURE while the
 * simulation is doing something to that body (struck, knocked back, stunned,
 * knocked out of the ring, driving through a belly bump).
 *
 * Why this exists
 * ---------------
 * The server is precise about reactions (isHit + knockback for N ms, hitstop,
 * stun, ring-out) but every one of those states used to be drawn with the
 * same upright, planted sprite. The only per-hit body change was a 280 ms CSS
 * squash that played during the hitstop freeze (masked by the white flash) and
 * was over before the slide even started. So a slap read as: flash → two
 * standing penguins skating apart.
 *
 * The rig closes that gap with a continuous, state-driven posture:
 *   • STRUCK     — compress while the display clock is frozen (hitstop).
 *   • REELING    — bend INTO the travel direction, proportional to the
 *                  displayed slide speed, so the body reads as "driven back"
 *                  and recovers as the ice slide dies out.
 *   • RECOVERING — spring back upright with a small overshoot (weight).
 *   • STUNNED    — slow dizzy sway for the parry-stun window.
 *   • DRIVING    — attacker follow-through after a belly-bump connect.
 *   • TOPPLING / DOWNED — ring-out: tip over past the rope and stay down.
 *
 * Two different deformations, on purpose
 * --------------------------------------
 * A body on the GROUND bends as a SHEAR (skewX about the sole): the feet stay
 * planted and level on the ice, only the upper body displaces. A rigid
 * rotation about the feet reads as a cardboard cut-out being tipped (and its
 * bottom corner pokes through the ground). A body in the AIR has no ground to
 * be planted on, so there it TILTS (rotation). The two are blended by the
 * displayed height in the last few px of a descent, so a landing goes
 * tilted-in-air → feet slap flat + squash → bent body straightens, with no
 * snap. The ring-out fall is a rigid rotation because a falling body IS one.
 *
 * Pure module: no DOM, no React. `stepReactionRig` is called once per render
 * frame and returns a pose; the caller applies it to a wrapper layer whose
 * transform-origin is the fighter's sole (see GameFighter FighterRigLayer).
 *
 * Coordinate contract: `leanDeg` / `tiltDeg` are SCREEN-space, positive =
 * the TOP of the body displaces toward +x (right). Travel direction is the
 * screen-x sign (+1 = right).
 */

export const RIG_PHASE = Object.freeze({
  IDLE: "IDLE",
  STRUCK: "STRUCK",
  REELING: "REELING",
  RECOVERING: "RECOVERING",
  STUNNED: "STUNNED",
  DRIVING: "DRIVING",
  TOPPLING: "TOPPLING",
  DOWNED: "DOWNED",
});

export const RIG_TIER = Object.freeze({
  ORDINARY: "ordinary",
  DECISIVE: "decisive",
});

/**
 * Which deformations the rig is allowed to apply. Playtest verdict on v1/v2:
 * bending flat 2D art (shear lean, stun sway, drive bend) reads as the picture
 * thinning and slanting — a downgrade — and it lingered into moments where the
 * player already had control. Those channels are OFF by default and kept only
 * as a documented, testable option; the discrete, event-shaped beats that DID
 * read (airborne tilt that levels out before touchdown, landing squash, the
 * ring-out topple) stay on.
 */
export const RIG_FEATURES = Object.freeze({
  groundBend: false, // shear lean while reeling / recovering on the ground
  struckSquash: false, // compression during the hitstop freeze
  stunSway: false, // dizzy wobble during parry stun
  bellyDrive: false, // attacker forward bend after a belly-bump connect
  airTilt: true, // tilt while carried through the air, levelled before touchdown
  landSquash: true, // compression beat on touchdown after an air hit
  topple: true, // ring-out fall
});

export const RIG_FEATURES_ALL = Object.freeze({
  groundBend: true,
  struckSquash: true,
  stunSway: true,
  bellyDrive: true,
  airTilt: true,
  landSquash: true,
  topple: true,
});

export const RIG_TUNING = Object.freeze({
  // ── Knockback bend (grounded = shear) ──
  LEAN_MAX_DEG: 15, // ordinary slap at full reference speed
  LEAN_DECISIVE_MULT: 1.35, // counter / punish / perfect-parry punish
  LEAN_SPEED_REF_PXS: 780, // displayed slide speed (map px/s) → LEAN_MAX_DEG
  LEAN_MIN_SPEED_PXS: 28, // below this the slide is "stopped" for phase logic
  LEAN_DIR_REFRESH_PXS: 90, // displayed speed that is allowed to re-decide direction
  LEAN_ATTACK_OMEGA: 26, // rad/s — how fast the bend catches a growing target
  LEAN_ATTACK_ZETA: 0.9,
  // Release lags the slide on purpose: the body stays bent a beat after the
  // ice starts to slow it, then the recovery spring brings it back with weight.
  LEAN_RELEASE_OMEGA: 9,
  LEAN_RELEASE_ZETA: 0.85,
  // ── Airborne (tilt) ──
  AIR_LEAN_DEG: 14, // carry tilt while knocked through the air
  AIR_BLEND_PX: 70, // below this displayed height the tilt levels out (or hands to shear)
  AIRBORNE_MIN_PX: 5, // displayed height that counts as "off the ground"
  // Touchdown after an air reaction: feet slap flat, body compresses.
  LAND_SQUASH_Y: 0.9,
  LAND_SQUASH_MS: 190,
  // ── Struck (hitstop) ──
  STRUCK_PRELEAN_DEG: 3.5,
  STRUCK_SQUASH_Y: 0.945,
  STRUCK_SQUASH_X: 1.045,
  STRUCK_DECISIVE_SQUASH_Y: 0.925,
  STRUCK_FALLBACK_MS: 45, // if no display hitstop is reported
  // ── Recovery spring (upright) ──
  RECOVER_OMEGA: 13, // rad/s
  RECOVER_ZETA: 0.6, // < 1 → ~9% overshoot: a weighty return, not a wobble
  RECOVER_AT_SPEED_FRACTION: 0.5, // hand to the spring once the slide halves
  SETTLE_EPS_DEG: 0.2,
  SETTLE_EPS_VEL: 3,
  // Blocked states (grabbed, thrown, airborne moves…) return to identity fast.
  BLOCKED_OMEGA: 30,
  // ── Stun sway (shear — feet stay planted, upper body wobbles) ──
  STUN_SWAY_DEG: 4.5,
  STUN_SWAY_HZ: 1.3,
  STUN_BOB_SCALE: 0.014,
  STUN_EASE_MS: 170,
  // ── Belly-bump drive (attacker follow-through) ──
  DRIVE_DEG: 9, // forward bend into the shove, easing out with the drift
  DRIVE_MS: 320,
  DRIVE_OMEGA: 18,
  // ── Ring-out topple (rigid rotation) ──
  TOPPLE_DEG: 82,
  TOPPLE_MS: 430,
  TOPPLE_BOUNCE_DEG: 7,
  TOPPLE_BOUNCE_MS: 170,
  TOPPLE_SQUASH_Y: 0.9,
  TOPPLE_SQUASH_RECOVER_MS: 190,
  // Velocity estimator smoothing (EMA time constant).
  VEL_EMA_TAU_MS: 42,
  MAX_DT_MS: 50,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sign = (v, fallback) => (v > 0 ? 1 : v < 0 ? -1 : fallback);
const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function createReactionRig() {
  return {
    phase: RIG_PHASE.IDLE,
    angle: 0, // deg, screen-space bend (split into lean/tilt at output)
    angVel: 0, // deg/s
    scaleX: 1,
    scaleY: 1,
    dir: 0, // travel direction of the current reaction (+1 right / -1 left)
    tier: RIG_TIER.ORDINARY,
    // Struck window bookkeeping
    struckStartMs: 0,
    struckUntilMs: 0,
    wasHit: false,
    peakSpeed: 0,
    // Air / landing
    wasAirborne: false,
    airBlend: 0, // 0 = all shear (grounded), 1 = all tilt (airborne)
    landSquashStartMs: 0,
    // Stun
    stunStartMs: 0,
    // Drive
    driveStartMs: 0,
    // Topple
    toppleStartMs: 0,
    toppleFromDeg: 0,
    toppleLanded: false,
    // Velocity estimator
    lastX: null,
    lastMs: 0,
    velX: 0,
    // Pose output (reused object to avoid per-frame allocation)
    pose: {
      leanDeg: 0,
      tiltDeg: 0,
      scaleX: 1,
      scaleY: 1,
      phase: RIG_PHASE.IDLE,
      events: null,
    },
  };
}

/** Arm the next reaction's tier (called from the player_hit payload). */
export function armReactionTier(rig, tier) {
  rig.tier = tier === RIG_TIER.DECISIVE ? RIG_TIER.DECISIVE : RIG_TIER.ORDINARY;
}

/**
 * Feed a displayed X position each frame; returns the smoothed velocity
 * (map px/s). Positions frozen by hitstop simply read as zero velocity.
 */
export function observeRigDisplayX(rig, x, nowMs) {
  if (typeof x !== "number" || !isFinite(x)) return rig.velX;
  if (rig.lastX === null || rig.lastMs === 0) {
    rig.lastX = x;
    rig.lastMs = nowMs;
    rig.velX = 0;
    return 0;
  }
  const dt = nowMs - rig.lastMs;
  if (dt <= 0) return rig.velX;
  const raw = ((x - rig.lastX) / dt) * 1000;
  // Teleports (round reset, portal) must not read as a shove.
  const sane = Math.abs(x - rig.lastX) > 160 ? 0 : raw;
  const a = 1 - Math.exp(-dt / RIG_TUNING.VEL_EMA_TAU_MS);
  rig.velX += (sane - rig.velX) * a;
  rig.lastX = x;
  rig.lastMs = nowMs;
  return rig.velX;
}

export function resetReactionRig(rig) {
  rig.phase = RIG_PHASE.IDLE;
  rig.angle = 0;
  rig.angVel = 0;
  rig.scaleX = 1;
  rig.scaleY = 1;
  rig.dir = 0;
  rig.tier = RIG_TIER.ORDINARY;
  rig.struckStartMs = 0;
  rig.struckUntilMs = 0;
  rig.wasHit = false;
  rig.peakSpeed = 0;
  rig.wasAirborne = false;
  rig.airBlend = 0;
  rig.landSquashStartMs = 0;
  rig.stunStartMs = 0;
  rig.driveStartMs = 0;
  rig.toppleStartMs = 0;
  rig.toppleFromDeg = 0;
  rig.toppleLanded = false;
  rig.lastX = null;
  rig.lastMs = 0;
  rig.velX = 0;
}

function springStep(rig, targetDeg, omega, zeta, dt) {
  // Semi-implicit damped spring on (angle, angVel).
  const acc =
    omega * omega * (targetDeg - rig.angle) - 2 * zeta * omega * rig.angVel;
  rig.angVel += acc * dt;
  rig.angle += rig.angVel * dt;
}

function approach(current, target, tauMs, dtMs) {
  if (tauMs <= 0) return target;
  const a = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * a;
}

function leanScale(rig) {
  return rig.tier === RIG_TIER.DECISIVE ? RIG_TUNING.LEAN_DECISIVE_MULT : 1;
}

function inReactionPhase(rig) {
  return (
    rig.phase === RIG_PHASE.STRUCK ||
    rig.phase === RIG_PHASE.REELING ||
    rig.phase === RIG_PHASE.RECOVERING
  );
}

/**
 * @param {object} rig            from createReactionRig()
 * @param {object} input
 * @param {boolean} input.isHit
 * @param {boolean} [input.isHitFalling]
 * @param {boolean} [input.isStunned]      isRawParryStun && idle-ish
 * @param {boolean} [input.blocked]        grabbed / thrown / airborne move / etc.
 * @param {number}  [input.facing]         +1 faces right, -1 faces left
 * @param {number}  [input.kbDir]          server knockback x sign hint (±1 / 0)
 * @param {boolean} [input.hitstopActive]  display hitstop currently freezing
 * @param {number}  [input.velX]           displayed slide speed (map px/s)
 * @param {number}  [input.heightPx]       displayed height above the ground plane
 * @param {number}  [input.driveDir]       ±1 while a belly-bump follow-through owns the body
 * @param {boolean} [input.ringOut]        this fighter is the ring-out loser
 * @param {number}  [input.ringOutDir]     fall direction (±1)
 * @param {number}  nowMs
 * @param {number}  dtMs
 * @returns {{leanDeg:number, tiltDeg:number, scaleX:number, scaleY:number, phase:string, events:string[]|null}}
 */
export function stepReactionRig(rig, input, nowMs, dtMs, features = RIG_FEATURES) {
  const F = features || RIG_FEATURES;
  const dtClamped = clamp(dtMs || 16.7, 1, RIG_TUNING.MAX_DT_MS);
  const dt = dtClamped / 1000;
  const T = RIG_TUNING;
  const pose = rig.pose;
  pose.events = null;

  const facing = input.facing === -1 ? -1 : 1;
  const velX = typeof input.velX === "number" ? input.velX : rig.velX;
  const speed = Math.abs(velX);
  const heightPx =
    typeof input.heightPx === "number" && isFinite(input.heightPx)
      ? Math.max(0, input.heightPx)
      : 0;
  const airborne = heightPx > T.AIRBORNE_MIN_PX;

  // Shear ↔ tilt handover follows the DISPLAYED height, whatever the phase,
  // so nothing can flip between the two deformations in a single frame.
  rig.airBlend = approach(
    rig.airBlend,
    clamp(heightPx / T.AIR_BLEND_PX, 0, 1),
    26,
    dtClamped
  );

  // Touchdown after an air reaction → feet slap flat + a compression beat.
  if (F.landSquash && rig.wasAirborne && !airborne && inReactionPhase(rig)) {
    rig.landSquashStartMs = nowMs;
    pose.events = ["air_land"];
  }
  rig.wasAirborne = airborne;

  // ── Ring-out: outranks everything (the round is over) ──
  if (input.ringOut && F.topple) {
    if (rig.phase !== RIG_PHASE.TOPPLING && rig.phase !== RIG_PHASE.DOWNED) {
      rig.phase = RIG_PHASE.TOPPLING;
      rig.toppleStartMs = nowMs;
      rig.toppleFromDeg = rig.angle;
      rig.toppleLanded = false;
      rig.dir = sign(input.ringOutDir, sign(velX, -facing));
      rig.landSquashStartMs = 0;
    }
    const target = rig.dir * T.TOPPLE_DEG;
    const t = nowMs - rig.toppleStartMs;
    if (t < T.TOPPLE_MS) {
      const k = easeInCubic(clamp(t / T.TOPPLE_MS, 0, 1));
      rig.angle = rig.toppleFromDeg + (target - rig.toppleFromDeg) * k;
      rig.scaleX = 1;
      rig.scaleY = 1;
    } else {
      const tb = t - T.TOPPLE_MS;
      if (!rig.toppleLanded) {
        rig.toppleLanded = true;
        pose.events = ["topple_land"];
      }
      if (tb < T.TOPPLE_BOUNCE_MS) {
        // Land: brief rebound back toward upright, then settle on the ground.
        const k = tb / T.TOPPLE_BOUNCE_MS;
        const bounce = Math.sin(k * Math.PI) * T.TOPPLE_BOUNCE_DEG;
        rig.angle = target - rig.dir * bounce;
      } else {
        rig.angle = target;
      }
      const sq = clamp(tb / T.TOPPLE_SQUASH_RECOVER_MS, 0, 1);
      rig.scaleY = T.TOPPLE_SQUASH_Y + (1 - T.TOPPLE_SQUASH_Y) * easeOutCubic(sq);
      rig.scaleX = 1 + (1 - rig.scaleY) * 0.6;
      rig.phase = RIG_PHASE.DOWNED;
    }
    rig.angVel = 0;
    rig.wasHit = !!input.isHit;
    return writePose(rig, pose, 1, F); // the fall is a rigid rotation
  }

  // Leaving a topple without a ring-out flag (round reset) → snap upright.
  if (rig.phase === RIG_PHASE.TOPPLING || rig.phase === RIG_PHASE.DOWNED) {
    resetReactionRig(rig);
  }

  // ── Blocked: another system owns the body (grab, throw, aerial move…) ──
  if (input.blocked) {
    rig.phase = RIG_PHASE.IDLE;
    rig.wasHit = !!input.isHit;
    rig.landSquashStartMs = 0;
    springStep(rig, 0, T.BLOCKED_OMEGA, 1, dt);
    rig.scaleX = approach(rig.scaleX, 1, 40, dtClamped);
    rig.scaleY = approach(rig.scaleY, 1, 40, dtClamped);
    settleIfTiny(rig);
    return writePose(rig, pose, rig.airBlend, F);
  }

  const hit = !!input.isHit || !!input.isHitFalling;

  // ── Hit rising edge → STRUCK ──
  if (hit && !rig.wasHit) {
    rig.phase = RIG_PHASE.STRUCK;
    rig.struckStartMs = nowMs;
    rig.struckUntilMs = nowMs + T.STRUCK_FALLBACK_MS;
    rig.peakSpeed = 0;
    rig.landSquashStartMs = 0;
    // Direction at the edge: the server's knockback sign, else away from
    // facing. The displayed velocity is NOT consulted here — at this instant it
    // is still the victim's own pre-hit motion. REELING re-decides from the
    // actual post-release travel (an air hit that ejects the body past the
    // attacker can move the opposite way to the server's sign).
    rig.dir = sign(input.kbDir, -facing);
  }
  rig.wasHit = hit;

  if (rig.phase === RIG_PHASE.STRUCK) {
    const stillFrozen =
      !!input.hitstopActive || nowMs < rig.struckUntilMs;
    if (hit && stillFrozen) {
      if (F.struckSquash) {
        const decisive = rig.tier === RIG_TIER.DECISIVE;
        const sqY = decisive ? T.STRUCK_DECISIVE_SQUASH_Y : T.STRUCK_SQUASH_Y;
        rig.scaleY = approach(rig.scaleY, sqY, 18, dtClamped);
        rig.scaleX = approach(rig.scaleX, T.STRUCK_SQUASH_X, 18, dtClamped);
      }
      // A hint of the coming bend so release does not start from dead zero.
      const prelean = F.groundBend || (F.airTilt && airborne) ? T.STRUCK_PRELEAN_DEG : 0;
      rig.angle = approach(rig.angle, rig.dir * prelean, 22, dtClamped);
      rig.angVel = 0;
      return writePose(rig, pose, rig.airBlend, F);
    }
    rig.phase = hit ? RIG_PHASE.REELING : RIG_PHASE.RECOVERING;
  }

  if (rig.phase === RIG_PHASE.REELING) {
    // Once the displayed travel is unambiguous it decides the direction.
    if (speed > T.LEAN_DIR_REFRESH_PXS) rig.dir = sign(velX, rig.dir);
    let targetDeg;
    if (airborne || input.isHitFalling) {
      // Carried through the air: a fixed tilt, top leading the travel. Without
      // a grounded bend to hand over to, the tilt levels out through the last
      // AIR_BLEND_PX of the descent so the body meets the ice upright.
      const level = F.groundBend ? 1 : clamp(heightPx / T.AIR_BLEND_PX, 0, 1);
      targetDeg = F.airTilt ? rig.dir * T.AIR_LEAN_DEG * leanScale(rig) * level : 0;
    } else if (F.groundBend) {
      const k = clamp(speed / T.LEAN_SPEED_REF_PXS, 0, 1);
      // Perceptual curve: even light shoves should visibly bend the body.
      const shaped = Math.pow(k, 0.62);
      targetDeg = rig.dir * shaped * T.LEAN_MAX_DEG * leanScale(rig);
    } else {
      targetDeg = 0;
    }
    const growing = Math.abs(targetDeg) > Math.abs(rig.angle) - 0.01;
    if (growing) {
      springStep(rig, targetDeg, T.LEAN_ATTACK_OMEGA, T.LEAN_ATTACK_ZETA, dt);
    } else {
      springStep(rig, targetDeg, T.LEAN_RELEASE_OMEGA, T.LEAN_RELEASE_ZETA, dt);
    }
    applyScaleEnvelope(rig, nowMs, dtClamped, 60);
    rig.peakSpeed = Math.max(rig.peakSpeed, speed);
    // Once control is back, the body is on the ground AND the slide has
    // clearly slowed, hand the body to the recovery spring while it is still
    // bent — that is what gives the return its weight.
    if (
      !hit &&
      !airborne &&
      (speed < T.LEAN_MIN_SPEED_PXS * 2 || speed < rig.peakSpeed * T.RECOVER_AT_SPEED_FRACTION)
    ) {
      rig.phase = RIG_PHASE.RECOVERING;
    }
    return writePose(rig, pose, rig.airBlend, F);
  }

  // ── Belly-bump drive: attacker bends INTO the shove, easing out with it ──
  if (F.bellyDrive && input.driveDir && !hit) {
    if (rig.phase !== RIG_PHASE.DRIVING) {
      rig.phase = RIG_PHASE.DRIVING;
      rig.driveStartMs = nowMs;
    }
    const t = clamp((nowMs - rig.driveStartMs) / T.DRIVE_MS, 0, 1);
    const envelope = Math.pow(1 - t, 1.4);
    const targetDeg = sign(input.driveDir, facing) * T.DRIVE_DEG * envelope;
    springStep(rig, targetDeg, T.DRIVE_OMEGA, 0.95, dt);
    rig.scaleX = approach(rig.scaleX, 1, 60, dtClamped);
    rig.scaleY = approach(rig.scaleY, 1, 60, dtClamped);
    return writePose(rig, pose, 0, F);
  }

  // ── Stun (dizzy) sway — only when nothing else is moving the body ──
  if (F.stunSway && input.isStunned && !hit) {
    if (rig.phase !== RIG_PHASE.STUNNED) {
      rig.phase = RIG_PHASE.STUNNED;
      rig.stunStartMs = nowMs;
    }
    const t = nowMs - rig.stunStartMs;
    const ease = clamp(t / T.STUN_EASE_MS, 0, 1);
    const w = 2 * Math.PI * T.STUN_SWAY_HZ * (t / 1000);
    const sway = Math.sin(w) * T.STUN_SWAY_DEG * ease;
    // Blend any residual bend into the sway instead of snapping.
    springStep(rig, sway, T.RECOVER_OMEGA, 1, dt);
    rig.scaleY = 1 - Math.abs(Math.sin(w)) * T.STUN_BOB_SCALE * ease;
    rig.scaleX = 1 + (1 - rig.scaleY) * 0.5;
    return writePose(rig, pose, 0, F);
  }

  // ── Recovering / idle: spring upright, then rest ──
  if (rig.phase === RIG_PHASE.STUNNED || rig.phase === RIG_PHASE.DRIVING) {
    rig.phase = RIG_PHASE.RECOVERING;
  }
  if (rig.phase === RIG_PHASE.RECOVERING || rig.angle !== 0 || rig.angVel !== 0) {
    if (hit) {
      // Hit flag still on but slide is dead (e.g. edge pin): hold a soft bend.
      rig.phase = RIG_PHASE.REELING;
    } else {
      rig.phase = RIG_PHASE.RECOVERING;
    }
    springStep(rig, 0, T.RECOVER_OMEGA, T.RECOVER_ZETA, dt);
  }
  applyScaleEnvelope(rig, nowMs, dtClamped, 55);
  settleIfTiny(rig);
  return writePose(rig, pose, rig.airBlend, F);
}

/**
 * Scale channel while reeling / recovering: a touchdown squash if one is
 * live, otherwise ease back to 1.
 */
function applyScaleEnvelope(rig, nowMs, dtClamped, tauMs) {
  const T = RIG_TUNING;
  if (rig.landSquashStartMs > 0) {
    const t = (nowMs - rig.landSquashStartMs) / T.LAND_SQUASH_MS;
    if (t < 1) {
      const k = easeOutCubic(clamp(t, 0, 1));
      rig.scaleY = T.LAND_SQUASH_Y + (1 - T.LAND_SQUASH_Y) * k;
      rig.scaleX = 1 + (1 - rig.scaleY) * 0.7;
      return;
    }
    rig.landSquashStartMs = 0;
  }
  rig.scaleX = approach(rig.scaleX, 1, tauMs, dtClamped);
  rig.scaleY = approach(rig.scaleY, 1, tauMs, dtClamped);
}

function settleIfTiny(rig) {
  const T = RIG_TUNING;
  if (
    rig.landSquashStartMs === 0 &&
    Math.abs(rig.angle) < T.SETTLE_EPS_DEG &&
    Math.abs(rig.angVel) < T.SETTLE_EPS_VEL &&
    Math.abs(rig.scaleX - 1) < 0.002 &&
    Math.abs(rig.scaleY - 1) < 0.002
  ) {
    rig.angle = 0;
    rig.angVel = 0;
    rig.scaleX = 1;
    rig.scaleY = 1;
    if (rig.phase === RIG_PHASE.RECOVERING) rig.phase = RIG_PHASE.IDLE;
  }
}

/** Split the bend into shear (grounded) and tilt (airborne) by `tiltShare`. */
function writePose(rig, pose, tiltShare, F = RIG_FEATURES) {
  const share = clamp(tiltShare, 0, 1);
  // `+ 0` folds -0 into 0 so identity checks and CSS strings stay clean.
  pose.tiltDeg = rig.angle * share + 0;
  // With the grounded bend disabled the non-tilt share is simply dropped: the
  // angle itself is already driven to 0 by the level-out in REELING.
  pose.leanDeg = F.groundBend ? rig.angle * (1 - share) + 0 : 0;
  pose.scaleX = rig.scaleX;
  pose.scaleY = rig.scaleY;
  pose.phase = rig.phase;
  return pose;
}

/** True when the pose is visually identity (skip DOM writes). */
export function isIdentityRigPose(pose) {
  return (
    !pose ||
    (Math.abs(pose.leanDeg) < 0.01 &&
      Math.abs(pose.tiltDeg) < 0.01 &&
      Math.abs(pose.scaleX - 1) < 0.001 &&
      Math.abs(pose.scaleY - 1) < 0.001)
  );
}

/**
 * CSS `transform` for the rig layer (origin = the fighter's sole).
 *   rotate  — airborne tilt / ring-out fall (rigid)
 *   skewX   — grounded bend; CSS skewX(+a) moves the TOP toward −x, so the
 *             screen-space lean is negated here
 *   scale   — compression
 * Returns "none" for identity so the layer creates no stacking context and the
 * sprites' own z-index contract (strike layering, grab arm) stays intact.
 */
export function rigPoseToCss(pose) {
  if (isIdentityRigPose(pose)) return "none";
  const parts = [];
  if (Math.abs(pose.tiltDeg) >= 0.01) parts.push(`rotate(${pose.tiltDeg.toFixed(2)}deg)`);
  if (Math.abs(pose.leanDeg) >= 0.01) parts.push(`skewX(${(-pose.leanDeg).toFixed(2)}deg)`);
  if (Math.abs(pose.scaleX - 1) >= 0.001 || Math.abs(pose.scaleY - 1) >= 0.001) {
    parts.push(`scale(${pose.scaleX.toFixed(3)}, ${pose.scaleY.toFixed(3)})`);
  }
  return parts.length ? parts.join(" ") : "none";
}

/**
 * Which server-side states mean "another system owns the body": the rig must
 * not bend, squash or sway on top of them.
 */
export function isRigBlockedState(p) {
  if (!p) return true;
  return !!(
    p.isBeingThrown ||
    p.isBeingGrabbed ||
    p.isGrabbing ||
    p.inClinch ||
    p.isClinchKillThrowVictim ||
    p.isClinchKillPullVictim ||
    p.isCinematicKillVictim ||
    p.lastHitType === "cinematicKill" ||
    p.isGrabPushDefeat ||
    p.isBeingGrabPushed ||
    p.isGrabPushing ||
    p.isSlideJumping ||
    p.isRopeJumping ||
    p.isFlapping ||
    p.isDodging ||
    p.isSidestepping ||
    p.isAtTheRopes ||
    p.isBowing ||
    p.isDead ||
    p.isReady ||
    p.isInRitualPhase ||
    p.isThrowing ||
    p.isRingOutThrowCutscene
  );
}

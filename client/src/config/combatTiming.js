/**
 * Mirrored combat frame timings for client pose directors.
 * MUST stay in lockstep with server-io/constants.js (SLAP_* / PALM_* / AP_LATE_PARRY_MS).
 */

export const SLAP_STARTUP_MS = 55;
export const SLAP_ACTIVE_MS = 47;
export const SLAP_RECOVERY_MS = 158;
export const SLAP_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;
/** Ice-slide convert — MUST match server-io/constants.js SLAP_TOTAL_MS_SLIDE. */
export const SLIDE_SLAP_EXTRA_RECOVERY_MS = 70;
export const SLAP_TOTAL_MS_SLIDE = SLAP_TOTAL_MS + SLIDE_SLAP_EXTRA_RECOVERY_MS;
/** MUST match server-io/constants.js SLIDE_SLAP_ARM_SPEED. */
export const SLIDE_SLAP_ARM_SPEED = 1.45;

/** Early-active slap grace — open hits deferred so a clap tap can still land.
 *  MUST match server-io/constants.js (PERFECT_PARRY_WINDOW, 2 ticks @ 64Hz). */
export const AP_LATE_PARRY_MS = (2 * 1000) / 64;

/** Empty-window AP whiff jail — MUST match server-io/constants.js. */
export const AP_WHIFF_RECOVERY_MS = 300;

/** Post-land piano cover — MUST match server-io/constants.js AP_FLURRY_COVER_MS. */
export const AP_FLURRY_COVER_REGULAR_MS = 20 + 180 + SLAP_STARTUP_MS + 120;

/**
 * Slap pose director boundaries (cumulative ms from isSlapAttack rising edge).
 * Hit pose starts with the active window (SMEAR_END) so parry hitstop freezes
 * on the strike frame — not the blur. (Holding smear through AP_LATE_PARRY_MS
 * made late parries look like they clanged the smear.)
 * Authored smear is 18→55 (WINDUP_END / SMEAR_END / HIT_POSE_START).
 * HIT_END matches the server hitbox (SLAP_ACTIVE_MS) so the extended-arm
 * sprite does not outlive the jab. Recovery pose plays during SLAP_RECOVERY_MS.
 */
export const HIT_POSE_HOLD_MS = SLAP_ACTIVE_MS;
/**
 * Belly bump (slide convert) director. The bump pose is held from the smear
 * through contact, the freeze and most of the fixed follow-through crawl;
 * the director then cuts to the planted ready stance SLIDE_SLAP_PLANT_LEAD_MS
 * BEFORE the server zeroes the crawl, and poseBeats holds that same stance
 * SLIDE_SLAP_PLANT_HOLD_MS after. The stop therefore lands in the middle of
 * an already-planted pose — a dig-in, not a glide switched off.
 * MUST match combatPresentation/poseBeats POSE_BEAT_TIMING.SLIDE_SLAP_PLANT_LEAD_MS.
 */
export const SLIDE_SLAP_PLANT_LEAD_MS = 90;
export const SLIDE_SLAP_HIT_POSE_HOLD_MS =
  SLAP_TOTAL_MS_SLIDE - SLAP_STARTUP_MS - SLIDE_SLAP_PLANT_LEAD_MS;
export const SLAP_ANIM = {
  WINDUP_END: 18,
  SMEAR_END: SLAP_STARTUP_MS,
  HIT_POSE_START: SLAP_STARTUP_MS,
  HIT_END: SLAP_STARTUP_MS + HIT_POSE_HOLD_MS,
  SLIDE_HIT_END: SLAP_STARTUP_MS + SLIDE_SLAP_HIT_POSE_HOLD_MS,
};

export const PALM_THRUST_STARTUP_MS = 90;
export const PALM_THRUST_ACTIVE_MS = 90;
export const PALM_THRUST_HOLD_MS = 380;
export const PALM_THRUST_END_RECOVERY_MS = 60;

/**
 * Palm pose director — MUST match server phases in server-io/constants.js.
 *
 *   [0, STARTUP_END)     frame 0  palm-thrust-startup  (tell, not hittable)
 *   [STARTUP_END, SMEAR_END) frame 1  palm-thrust-smear (blur, not hittable)
 *   [SMEAR_END, ACTIVE_END)  frame 2  palm-thrust       (hitbox live + hold)
 *   [ACTIVE_END, ∞)          frame 3  palm-thrust-startup (settle)
 *
 * SMEAR_END === PALM_THRUST_STARTUP_MS so the extended pose and the server
 * hitbox turn on together. Blur must never share the active window — a hit
 * frozen on the smear is the "COUNTER HIT on blur frame" bug.
 */
export const PALM_THRUST_ANIM = {
  STARTUP_END: 40,
  SMEAR_END: PALM_THRUST_STARTUP_MS,
  ACTIVE_END:
    PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS + PALM_THRUST_HOLD_MS,
};

/** Map director elapsed-ms onto the four palm poses. */
export function resolvePalmThrustFrame(elapsed, anim = PALM_THRUST_ANIM) {
  if (elapsed < anim.STARTUP_END) return 0;
  if (elapsed < anim.SMEAR_END) return 1;
  if (elapsed < anim.ACTIVE_END) return 2;
  return 3;
}

/**
 * Predicted thrusts start a local clock before palmThrustFxId arrives.
 * Restarting on that first confirm rewinds into smear while the server is
 * already active (or the hit packet is in flight). Only restart for a
 * genuinely new thrust — fxId changed after the smear window.
 */
export function shouldRestartPalmThrustClock(
  prevFxId,
  nextFxId,
  elapsed,
  anim = PALM_THRUST_ANIM
) {
  if (nextFxId === prevFxId) return false;
  if (nextFxId === "sep" || prevFxId === "sep") return true;
  if (elapsed < anim.SMEAR_END) return false;
  return true;
}

/**
 * The same four palm poses, re-paced for the command-grab Drive release, where
 * they are borrowed as presentation: the fighter who just got driven shoves the
 * winner off with both hands. Server sets `isGrabSeparatePalm` — there is no
 * palm thrust move happening, so PALM_THRUST_ANIM's timings do not apply.
 *
 * The real thrust holds the strike pose through active + PALM_THRUST_HOLD_MS
 * because a thrust is a long commitment you need to read. Borrowing that here
 * would spend the whole separation on one frame — extend, hold, cut to idle —
 * which is the static pose problem this was meant to solve. So the beats are
 * packed to fit the release: startup and smear play IN PLACE, and the slide
 * does not start until SMEAR_END (the active / hit pose). That delay is
 * server-io/constants.js CMD_DRIVE_RELEASE_IMPACT_MS — keep them equal.
 *
 * Settle still lands BEFORE the slide stops, so the fighter arrives already
 * back in stance instead of snapping out of an extended arm.
 *
 * MUST stay under CMD_DRIVE_RELEASE_IMPACT_MS + CMD_DRIVE_RELEASE_TWEEN_MS.
 */
export const GRAB_SEPARATE_PALM_ANIM = {
  STARTUP_END: 40,
  // MUST match server-io/constants.js CMD_DRIVE_RELEASE_IMPACT_MS.
  SMEAR_END: 80,
  // Palms stay extended into the slide (slide t=0 at SMEAR_END). Settle still
  // lands before the tween finishes so they arrive already back in stance.
  ACTIVE_END: 190,
};

/** Charge-hold hop / land plant / min hold — MUST match server-io/constants.js. */
export const CHARGE_HOP_MS = 200;
export const CHARGE_LAND_HOLD_MS = 150;
export const CHARGE_MIN_HOLD_MS = CHARGE_HOP_MS + CHARGE_LAND_HOLD_MS;

/** Sidestep active — MUST match server-io/constants.js SIDESTEP_ACTIVE_MS. */
export const SIDESTEP_ACTIVE_MS = 400;
export const SIDESTEP_STARTUP_MS = 50;
export const SIDESTEP_RECOVERY_MS = 150;

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
/** Palm-out through the convert cycle (matches the shorter plant). */
export const SLIDE_SLAP_HIT_POSE_HOLD_MS = SLAP_TOTAL_MS_SLIDE - SLAP_STARTUP_MS;
export const SLAP_ANIM = {
  WINDUP_END: 18,
  SMEAR_END: SLAP_STARTUP_MS,
  HIT_POSE_START: SLAP_STARTUP_MS,
  HIT_END: SLAP_STARTUP_MS + HIT_POSE_HOLD_MS,
  SLIDE_HIT_END: SLAP_TOTAL_MS_SLIDE,
};

export const PALM_THRUST_STARTUP_MS = 90;
export const PALM_THRUST_ACTIVE_MS = 90;
export const PALM_THRUST_HOLD_MS = 380;
export const PALM_THRUST_END_RECOVERY_MS = 60;

/**
 * Palm pose director — smear through startup so the strike pose lands with
 * the server hitbox (medium/heavy telegraph), then holds through active +
 * the committed pose (PALM_THRUST_HOLD_MS).
 */
export const PALM_THRUST_ANIM = {
  STARTUP_END: 40,
  SMEAR_END: PALM_THRUST_STARTUP_MS,
  ACTIVE_END:
    PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS + PALM_THRUST_HOLD_MS,
};

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

/** Sidestep active — MUST match server-io/constants.js SIDESTEP_ACTIVE_MS. */
export const SIDESTEP_ACTIVE_MS = 400;
export const SIDESTEP_STARTUP_MS = 50;
export const SIDESTEP_RECOVERY_MS = 150;

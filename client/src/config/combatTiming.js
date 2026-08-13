/**
 * Mirrored combat frame timings for client pose directors.
 * MUST stay in lockstep with server-io/constants.js (SLAP_* / PALM_* / AP_LATE_PARRY_MS).
 */

export const SLAP_STARTUP_MS = 55;
export const SLAP_ACTIVE_MS = 130;
export const SLAP_RECOVERY_MS = 75;
export const SLAP_TOTAL_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS + SLAP_RECOVERY_MS;

/** Early-active slap grace — open hits deferred so late AP can arm. */
export const AP_LATE_PARRY_MS = 45;

/** Empty-tap AP whiff jail — MUST match server-io/constants.js. */
export const AP_WHIFF_RECOVERY_MS = 300;

/**
 * Slap pose director boundaries (cumulative ms from isSlapAttack rising edge).
 * Hit pose starts with the active window (SMEAR_END) so parry hitstop freezes
 * on the strike frame — not the blur. (Holding smear through AP_LATE_PARRY_MS
 * made late parries look like they clanged the smear.)
 * Authored ~37ms smear (18→55) is production — Phase 14 compression of THIS
 * window was rejected (see SLAP_PRESENTATION_TIMING_PHASE.md): do not touch
 * WINDUP_END / SMEAR_END / HIT_POSE_START without re-reading that doc.
 *
 * HIT_END is a DIFFERENT boundary Phase 14 never touched or evaluated: how
 * long the extended-arm sprite is HELD before cutting to recovery. It used
 * to ride SLAP_ACTIVE_MS 1:1 (185ms total — the arm stayed frozen in the
 * strike pose for half the entire cycle, long after the flash/spark/hitstop
 * already sold the impact). The mechanical hitbox is untouched by this: it
 * still rides SLAP_ACTIVE_MS server-side for its full chase/re-tag window —
 * only the SPRITE now settles into recovery sooner. Experimental (per the
 * Phase 14 precedent, treat as a hypothesis to eyeball, not a proven win) —
 * tune by changing HIT_POSE_HOLD_MS directly.
 */
export const HIT_POSE_HOLD_MS = 90;
export const SLAP_ANIM = {
  WINDUP_END: 18,
  SMEAR_END: SLAP_STARTUP_MS,
  HIT_POSE_START: SLAP_STARTUP_MS,
  HIT_END: SLAP_STARTUP_MS + HIT_POSE_HOLD_MS,
};

export const PALM_THRUST_STARTUP_MS = 90;
export const PALM_THRUST_ACTIVE_MS = 90;
export const PALM_THRUST_HOLD_MS = 260;
export const PALM_THRUST_END_RECOVERY_MS = 60;

/**
 * Palm pose director — short smear lead-in, early strike pose (pre-130 package).
 * Server hitbox is PALM_THRUST_STARTUP_MS (90); paint is intentionally snappier.
 */
export const PALM_THRUST_ANIM = {
  STARTUP_END: 20,
  SMEAR_END: 40,
  ACTIVE_END: 460,
};

/**
 * The same four palm poses, re-paced for the command-grab Drive release, where
 * they are borrowed as presentation: the fighter who just got driven shoves the
 * winner off with both hands. Server sets `isGrabSeparatePalm` — there is no
 * palm thrust move happening, so PALM_THRUST_ANIM's timings do not apply.
 *
 * The real thrust holds the strike pose for 460ms because a thrust is a long
 * commitment you need to read. Borrowing that here would spend the whole
 * separation on one frame — extend, hold, cut to idle — which is the static
 * pose problem this was meant to solve. So the beats are packed to fit the
 * release: startup and smear play IN PLACE, and the slide does not start
 * until SMEAR_END (the active / hit pose). That delay is
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

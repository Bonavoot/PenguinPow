/**
 * POSE BEATS — authored, time-boxed pose holds ("on rails" transitions).
 *
 * A fighting-game reaction is a POSE held for a FIXED number of frames, then a
 * cut to the next pose. PUMO PUMO's server tells the client when a state
 * starts and ends (isHit, isSlapAttack, isApWhiffRecovering…) but several
 * transitions used to cut straight from the reaction sprite to idle:
 *
 *   • belly bump:   the attacker's bump pose → idle at the exact instant the
 *                   fixed follow-through crawl is zeroed (a glide switched off);
 *   • AP whiff:     a 50 ms flinch, then idle for the remaining ~250 ms of the
 *                   server's whiff jail (the jail was invisible).
 *
 * This module owns those in-between beats. Each beat is a sprite + a deadline,
 * armed on a state EDGE the caller detects, and drawn only where IDLE would
 * otherwise be drawn. That last rule is the whole safety contract: the moment
 * ANY other system owns the body (an attack, a parry, a dodge, a grab, a
 * strafe, a new hit…) the beat is cancelled outright — never resumed — so a
 * beat can never linger into a moment where the player already has control.
 *
 * Pure module: no DOM, no React. Every duration is a named constant here.
 */

export const POSE_BEAT = Object.freeze({
  /** Retired from the live director — recovering.png as a post-hit brace read
   *  as a second hit pose. Kept so tests can exercise the generic beat clock. */
  POST_HIT_SETTLE: "POST_HIT_SETTLE",
  /** Belly-bump attacker: follow-through crawl just stopped → planted stance. */
  SLIDE_SLAP_PLANT: "SLIDE_SLAP_PLANT",
});

export const POSE_BEAT_TIMING = Object.freeze({
  /** ~6 frames @60: long enough to read as "feet catch the ice", short enough
   *  to be gone before the +0 exchange's next slap could come out. */
  POST_HIT_SETTLE_MS: 100,
  /** Planted stance held AFTER the crawl stops (the stop lands mid-pose). */
  SLIDE_SLAP_PLANT_HOLD_MS: 80,
  /** Planted stance shown BEFORE the crawl stops (director frame 3 lead-in).
   *  combatTiming.SLAP_ANIM.SLIDE_HIT_END is derived from this. */
  SLIDE_SLAP_PLANT_LEAD_MS: 90,
});

export const createPoseBeats = () => ({
  kind: null,
  src: null,
  until: 0,
  startedAt: 0,
  /** Debug/telemetry: why the last beat ended ("expired" | "owned" | "cleared"). */
  endedBy: null,
});

/** Arm (or re-arm) a beat. A newer beat always replaces an older one. */
export function armPoseBeat(beats, kind, src, nowMs, durationMs) {
  if (!beats || !kind || !src || !(durationMs > 0)) return false;
  beats.kind = kind;
  beats.src = src;
  beats.startedAt = nowMs;
  beats.until = nowMs + durationMs;
  beats.endedBy = null;
  return true;
}

export function clearPoseBeats(beats, reason = "cleared") {
  if (!beats) return;
  if (beats.kind) beats.endedBy = reason;
  beats.kind = null;
  beats.src = null;
  beats.until = 0;
  beats.startedAt = 0;
}

export const isPoseBeatActive = (beats, nowMs) =>
  !!beats && !!beats.kind && !!beats.src && beats.until > nowMs;

/**
 * Per-render resolution. Returns the sprite to draw INSTEAD of idle, or null.
 *
 * @param {object} beats         from createPoseBeats()
 * @param {number} nowMs         performance.now()
 * @param {*}      rawSpriteSrc  what getImageSrc chose this render
 * @param {*}      idleSrc       the idle sprite
 * @param {boolean} [bodyOwned]  extra owner signal the sprite alone can't tell
 *                               (e.g. a fresh isHit whose sprite is still being
 *                               held by another director). True cancels.
 */
export function resolvePoseBeat(beats, nowMs, rawSpriteSrc, idleSrc, bodyOwned = false) {
  if (!beats || !beats.kind) return null;
  if (beats.until <= nowMs) {
    clearPoseBeats(beats, "expired");
    return null;
  }
  if (bodyOwned || rawSpriteSrc !== idleSrc) {
    // Someone else owns the body. Cancel, do not pause: a beat that resumed
    // after a slap would be exactly the "lingering into control" failure.
    clearPoseBeats(beats, "owned");
    return null;
  }
  return beats.src;
}

/** True while the rAF watcher must keep forcing renders for an active beat. */
export const poseBeatNeedsTick = (beats, nowMs, showingBeat) =>
  !!showingBeat && !!beats && beats.until > 0 && nowMs >= beats.until;

/**
 * Edge rule — POST_HIT_SETTLE.
 * Arms on the isHit falling edge of a GROUNDED strike victim who is not being
 * carried into some other resolution (air fall, ring-out, stun, grab, throw,
 * death). Trades qualify (both fighters settle symmetrically).
 */
export function shouldArmPostHitSettle({
  wasHit,
  isHit,
  isHitFalling = false,
  grounded = true,
  isRingOutLoser = false,
  isRawParryStun = false,
  isBeingGrabbed = false,
  isBeingThrown = false,
  isAtTheRopes = false,
  isDead = false,
  isReady = false,
}) {
  if (!wasHit || isHit) return false;
  if (isHitFalling || !grounded) return false;
  if (isRingOutLoser || isRawParryStun) return false;
  if (isBeingGrabbed || isBeingThrown) return false;
  if (isAtTheRopes || isDead || isReady) return false;
  return true;
}

/**
 * Edge rule — SLIDE_SLAP_PLANT.
 * Arms when a slide-armed slap cycle ends AND its bump connected. The server
 * zeroes the follow-through crawl on that same tick, so the plant pose spans
 * the stop. A whiffed bump ends like any other whiffed slap.
 */
export function shouldArmSlideSlapPlant({
  wasSlapAttack,
  isSlapAttack,
  wasSlideSlapArmed,
  bumpConnected,
}) {
  return !!wasSlapAttack && !isSlapAttack && !!wasSlideSlapArmed && !!bumpConnected;
}

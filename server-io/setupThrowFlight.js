"use strict";

/**
 * Setup-throw flight is owned by the VICTIM.
 *
 * The dump path is stamped at resolve. The thrower can chase, slap, or even
 * start a grab without pausing the airborne penguin. Grab startup used to
 * return before the thrower-owned arc tick — they froze mid-air.
 */

const { GROUND_LEVEL, SETUP_THROW_RICOCHET_HIT_AT } = require("./constants");
const { sampleSetupThrowX, sampleSetupThrowY } = require("./throwTossMotion");

function stampSetupThrowFlight(victim, plan, toss, now) {
  if (!victim || !plan || !toss) return;
  victim.throwStartTime = now;
  victim.throwEndTime = now + toss.durationMs;
  victim.throwStartX = plan.startX;
  victim.throwLandX = plan.landX;
  victim.throwHitX = plan.hitX;
  victim.throwRicochet = !!plan.ricochet;
  victim.throwBounceHeight = plan.bounceHeight;
  victim.throwRicochetHitAt = plan.hitAt;
  victim.throwRicochetHitEmitted = false;
  victim.clinchThrowArcHeight = toss.arcHeight;
  victim.throwTossPower = toss.power;
  victim.throwTossDurationMs = toss.durationMs;
}

function clearSetupThrowFlight(player) {
  if (!player) return;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwStartX = 0;
  player.throwLandX = 0;
  player.throwHitX = 0;
  player.throwRicochet = false;
  player.throwBounceHeight = 0;
  player.throwRicochetHitAt = 0;
  player.throwRicochetHitEmitted = false;
}

function isSetupThrowFlightLive(player) {
  if (!player || !player.isBeingThrown) return false;
  if (player.isClinchKillThrowVictim) return false;
  return Number.isFinite(player.throwLandX) && !!player.throwEndTime;
}

function setupThrowProgress(victim, now) {
  const start = victim.throwStartTime || 0;
  const end = victim.throwEndTime || start + 1;
  return Math.max(0, (now - start) / Math.max(1, end - start));
}

function applySetupThrowPose(victim, now) {
  const progress = setupThrowProgress(victim, now);
  const path = {
    startX: victim.throwStartX,
    landX: victim.throwLandX,
    hitX: victim.throwHitX,
    ricochet: !!victim.throwRicochet,
    hitAt: victim.throwRicochetHitAt || SETUP_THROW_RICOCHET_HIT_AT,
  };
  victim.x = sampleSetupThrowX(progress, path);
  victim.y =
    GROUND_LEVEL +
    sampleSetupThrowY(progress, {
      height: victim.clinchThrowArcHeight,
      bounceHeight: victim.throwBounceHeight,
      ricochet: !!victim.throwRicochet,
      hitAt: path.hitAt,
    });
  return {
    progress,
    landed: now >= victim.throwEndTime,
    ricochetHit:
      !!victim.throwRicochet &&
      !victim.throwRicochetHitEmitted &&
      progress >= path.hitAt,
  };
}

function stepSetupThrowFlight(victim, now) {
  if (!isSetupThrowFlightLive(victim)) {
    return { progressed: false, landed: false, ricochetHit: false, progress: 0 };
  }
  const pose = applySetupThrowPose(victim, now);
  return { progressed: true, ...pose };
}

/** Interrupt / orphan snaps must not abort a stamped dump. */
function abortLiveSetupThrowOnInterrupt(thrownPlayer) {
  return !isSetupThrowFlightLive(thrownPlayer);
}

module.exports = {
  stampSetupThrowFlight,
  clearSetupThrowFlight,
  isSetupThrowFlightLive,
  setupThrowProgress,
  applySetupThrowPose,
  stepSetupThrowFlight,
  abortLiveSetupThrowOnInterrupt,
};

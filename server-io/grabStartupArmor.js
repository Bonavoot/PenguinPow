"use strict";

/**
 * Grab vs slap / palm / charged. Overlap always resolves. Never ghost.
 *
 * Reaching (startup): you can be slapped.
 * Slap hits you before you have a grip (tip, or still reaching): real hit.
 * Grip is on (past startup, overlapping): a slap that started late is caught.
 * Slap already live when the grip turned on: real hit.
 * Shatter Palm: always a real hit.
 *
 * CATCH kills the swing pose; latch still happens on the grab loop this tick.
 */

const {
  GRAB_ACTIVE_MS,
  GRAB_STARTUP_DURATION_MS,
  PALM_THRUST_STARTUP_MS,
  SLAP_STARTUP_MS,
  CHARGED_STARTUP_MS,
  LOW_KICK_STARTUP_MS,
  POWER_UP_TYPES,
} = require("./constants");
const {
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
} = require("./combatHelpers");
const { timeoutManager } = require("./gameUtils");
const {
  releaseStrikeFacingLock,
  ACTION_FACING_RELEASE,
} = require("./actionFacingOwnership");

const GRAB_STRIKE = Object.freeze({
  STUFF: "STUFF",
  CATCH: "CATCH",
});

function playerPalmBreaksGrabArmor(player) {
  return !!(
    player &&
    (player.loadout?.palmBreaksGrabArmor ||
      player.activePowerUp === POWER_UP_TYPES.SHATTER_PALM)
  );
}

function isGrabAttemptLive(grabber) {
  return !!(
    grabber &&
    (grabber.isGrabStartup || grabber.isGrabbingMovement)
  );
}

function getGrabActiveStartTime(grabber) {
  if (!grabber || grabber.grabStartupStartTime == null) return null;
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  return grabber.grabStartupStartTime + startupMs;
}

function getGrabActiveMs(grabber) {
  return (grabber && grabber.grabActiveDuration) || GRAB_ACTIVE_MS;
}

/** Grab's throw box is live — not startup, not expired. `startTime === 0` is legal. */
function isGrabThrowActive(grabber, now) {
  if (!grabber || now == null || !Number.isFinite(now)) return false;
  if (
    grabber.grabStartupStartTime == null ||
    !Number.isFinite(grabber.grabStartupStartTime)
  ) {
    return false;
  }
  const startupMs = grabber.grabStartupDuration || GRAB_STARTUP_DURATION_MS;
  const elapsed = now - grabber.grabStartupStartTime;
  const activeMs = getGrabActiveMs(grabber);
  return elapsed >= startupMs && elapsed < startupMs + activeMs;
}

function getStrikeActiveStartTime(attacker) {
  if (!attacker) return null;
  if (
    typeof attacker.startupEndTime === "number" &&
    attacker.startupEndTime > 0
  ) {
    return attacker.startupEndTime;
  }
  const start = attacker.attackStartTime;
  if (typeof start !== "number" || !Number.isFinite(start)) return null;
  if (attacker.attackType === "slap" || attacker.isSlapAttack) {
    return start + SLAP_STARTUP_MS;
  }
  if (attacker.isPalmThrust) {
    return start + PALM_THRUST_STARTUP_MS;
  }
  if (attacker.attackType === "lowKick" || attacker.isLowKick) {
    return start + LOW_KICK_STARTUP_MS;
  }
  if (attacker.attackType === "charged") {
    return start + CHARGED_STARTUP_MS;
  }
  return start;
}

function inGrabLatchRange(grabber, victim) {
  return (
    isOpponentCloseEnoughForGrab(grabber, victim) &&
    isOpponentInFrontOfGrabber(grabber, victim)
  );
}

function grabVictimCanBeCaught(grabber, victim, now) {
  if (victim && victim.grabImmune && now < victim.grabImmuneEndTime) return false;
  if (victim && (victim.isBeingThrown || victim.isBeingGrabbed)) return false;
  if (grabber.isBeingGrabbed) return false;
  return true;
}

/**
 * The grab loop can latch this tick (throw box on + belly range).
 */
function canGrabLatchThisTick(grabber, victim, now) {
  if (!isGrabThrowActive(grabber, now)) return false;
  if (!inGrabLatchRange(grabber, victim)) return false;
  return grabVictimCanBeCaught(grabber, victim, now);
}

function resolveStrikeVsGrab(attacker, grabber, now) {
  if (!isGrabAttemptLive(grabber)) return GRAB_STRIKE.STUFF;
  if (playerPalmBreaksGrabArmor(attacker)) return GRAB_STRIKE.STUFF;
  if (!isGrabThrowActive(grabber, now)) return GRAB_STRIKE.STUFF;
  if (!canGrabLatchThisTick(grabber, attacker, now)) return GRAB_STRIKE.STUFF;

  const strikeActive = getStrikeActiveStartTime(attacker);
  const grabActive = getGrabActiveStartTime(grabber);
  if (strikeActive == null || grabActive == null) return GRAB_STRIKE.STUFF;
  if (strikeActive <= grabActive) return GRAB_STRIKE.STUFF;
  return GRAB_STRIKE.CATCH;
}

function shouldStrikeStuffGrab(attacker, grabber, now) {
  return resolveStrikeVsGrab(attacker, grabber, now) === GRAB_STRIKE.STUFF;
}

/**
 * CATCH: the grab won. Kill the swing immediately so latch freeze is the
 * grip, not slap-active art on the grabber. Does not apply hitstun — latch does.
 */
function cancelStrikeForGrabCatch(attacker) {
  if (!attacker) return;
  attacker.isAttacking = false;
  attacker.isSlapAttack = false;
  attacker.isPalmThrust = false;
  attacker.isLowKick = false;
  attacker.palmThrustVisualUntil = 0;
  attacker.attackType = null;
  attacker.attackStartTime = 0;
  attacker.attackEndTime = 0;
  attacker.slapActiveEndTime = 0;
  attacker.chargedActiveEndTime = 0;
  attacker.lowKickActiveEndTime = 0;
  attacker.isInStartupFrames = false;
  attacker.isInEndlag = false;
  attacker.currentSlapHitConnected = false;
  attacker.slapOpenHitPending = false;
  attacker.currentLowKickHitConnected = false;
  attacker.currentAction = null;
  attacker.pendingSlapCount = 0;
  attacker.pendingSlapPressTime = 0;
  attacker.pendingPalmThrust = false;
  attacker.pendingGrab = false;
  attacker.pendingGrabPressTime = 0;
  releaseStrikeFacingLock(attacker, { reason: ACTION_FACING_RELEASE.INTERRUPT });
  if (attacker.id) {
    timeoutManager.advanceNamed(attacker.id, "slapCycle", 10_000);
    timeoutManager.clearPlayerSpecific(attacker.id, "slapStartupEnd");
    timeoutManager.clearPlayerSpecific(attacker.id, "lowKickCycle");
    timeoutManager.clearPlayerSpecific(attacker.id, "palmThrustVisualEnd");
  }
}

/**
 * Thick Blubber absorb: kill the slap hitbox so it cannot keep colliding.
 */
function releaseSlapHitboxKeepBuffer(slapper) {
  if (!slapper) return;
  slapper.currentSlapHitConnected = true;
  slapper.isAttacking = false;
  slapper.attackStartTime = 0;
  slapper.attackEndTime = 0;
  slapper.slapActiveEndTime = 0;
  slapper.isInStartupFrames = false;
  slapper.isInEndlag = false;
  slapper.attackCooldownUntil = 0;
  slapper.actionLockUntil = 0;
  releaseStrikeFacingLock(slapper, { reason: ACTION_FACING_RELEASE.INTERRUPT });
  timeoutManager.advanceNamed(slapper.id, "slapCycle", 10_000);
}

module.exports = {
  GRAB_STRIKE,
  playerPalmBreaksGrabArmor,
  isGrabAttemptLive,
  isGrabThrowActive,
  getGrabActiveStartTime,
  getStrikeActiveStartTime,
  inGrabLatchRange,
  canGrabLatchThisTick,
  resolveStrikeVsGrab,
  shouldStrikeStuffGrab,
  getGrabActiveMs,
  cancelStrikeForGrabCatch,
  releaseSlapHitboxKeepBuffer,
};

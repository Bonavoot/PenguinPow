"use strict";

// Standing slap approach.
//
// The ready marks are 192px apart and a slap connects at about 133px, so a
// slap has to cover ~72px before the arm goes inactive. Every press gets
// that push, including a mash. After the arm is live the speed eases into
// an ice coast instead of stopping. The next press speeds back up from
// that coast. It does not zero the slide and it does not brake a body
// that is already moving faster than the push.

const {
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  speedFactor,
  ICE_COAST_FRICTION,
  TICK_RATE,
} = require("./constants");
const { creditGrantedVelocity, clearGrantedVelocity } = require("./momentumTransfer");

const SLAP_STEP_IN_DISTANCE = 72;
const SLAP_APPROACH_WINDOW_MS = SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
// Glide left behind after the reach. Above a walk, short of a full-ring skate.
const SLAP_COAST_VELOCITY = 1.35;
const MS_PER_TICK = 1000 / TICK_RATE;

function approachTravelPx(v0, ms) {
  const ticks = Math.max(0, Math.floor((ms || 0) / MS_PER_TICK));
  const pxPer = MS_PER_TICK * speedFactor;
  let v = v0;
  let x = 0;
  for (let i = 0; i < ticks; i++) {
    v *= ICE_COAST_FRICTION;
    x += pxPer * Math.abs(v);
  }
  return x;
}

function solveApproachVelocity() {
  const windowMs = SLAP_APPROACH_WINDOW_MS;
  let lo = 0.5;
  let hi = 8;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (approachTravelPx(mid, windowMs) >= SLAP_STEP_IN_DISTANCE) hi = mid;
    else lo = mid;
  }
  return hi;
}

const SLAP_APPROACH_VELOCITY = solveApproachVelocity();

function clearSlapStep(player, { zeroVelocity = false } = {}) {
  if (!player) return;
  player.slapStepFixed = false;
  player.slapStepBudgetPx = 0;
  player.slapStepDir = 0;
  player.slapApproachArmed = false;
  player.slapApproachUntil = 0;
  if (zeroVelocity) {
    player.movementVelocity = 0;
    clearGrantedVelocity(player);
  }
}

/**
 * Give this slap the reach push, then let settleSlapApproach ease it into a coast.
 * Returns false only when the fighter is already faster than the push, so a
 * slap never brakes a real slide.
 */
function armStandingSlapStep(player, slideDirection, carriedForward, nowSim) {
  if (!player) return false;
  if ((carriedForward || 0) >= SLAP_APPROACH_VELOCITY) {
    player.slapApproachArmed = false;
    player.slapStepFixed = false;
    return false;
  }
  const dir = slideDirection === -1 ? -1 : 1;
  player.slapApproachArmed = true;
  player.slapApproachUntil = (nowSim || 0) + SLAP_APPROACH_WINDOW_MS;
  player.slapStepFixed = false;
  player.slapStepBudgetPx = 0;
  player.movementVelocity = dir * SLAP_APPROACH_VELOCITY;
  creditGrantedVelocity(player, player.movementVelocity, nowSim);
  return true;
}

/** After the arm is live, ease the burst down into the coast. Never to zero. */
function settleSlapApproach(player, nowSim) {
  if (!player || !player.slapApproachArmed) return;
  if (player.currentSlapHitConnected) {
    player.slapApproachArmed = false;
    return;
  }
  if ((nowSim || 0) < (player.slapApproachUntil || 0)) return;
  player.slapApproachArmed = false;
  const v = player.movementVelocity || 0;
  const dir = Math.sign(v);
  if (!dir) return;
  if (Math.abs(v) > SLAP_COAST_VELOCITY) {
    player.movementVelocity = dir * SLAP_COAST_VELOCITY;
    creditGrantedVelocity(player, player.movementVelocity, nowSim);
  }
}

module.exports = {
  SLAP_STEP_IN_DISTANCE,
  SLAP_APPROACH_WINDOW_MS,
  SLAP_APPROACH_VELOCITY,
  SLAP_COAST_VELOCITY,
  approachTravelPx,
  clearSlapStep,
  armStandingSlapStep,
  settleSlapApproach,
};

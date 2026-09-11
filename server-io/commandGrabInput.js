// ============================================
// COMMAND GRAB — LATCH AIM
// ============================================
// M2 is always just a grab. After connect, a latch window opens and the
// grabber aims:
//
//   Back held or tapped   → PULL
//   W held or tapped      → THROW
//   Toward / nothing      → DRIVE (also the timeout default)
//
// Pre-press chords do not count. Stamps from before the latch are wiped at
// connect. A hold that is STILL down during the latch refreshes and counts —
// so keeping back held through the handshake still pulls.
//
// Recency decides changes of mind. W wins exact ties. A tap latches; there is
// no path back to DRIVE after W or Back has been pressed in this latch.
//
// This module is dependency-free (constants only).

const {
  CMD_GRAB_VARIANT,
} = require("./constants");

function noteGrabVariantEdges(player, nowSim, edges = {}) {
  if (!player) return;
  const keys = player.keys || {};
  if (keys.w || edges.wJustPressed) player.grabWTapTime = nowSim;
  if (keys.a || edges.aJustPressed) player.grabATapTime = nowSim;
  if (keys.d || edges.dJustPressed) player.grabDTapTime = nowSim;
}

function awayKeyFor(player, opponent) {
  if (!opponent) return null;
  return player.x < opponent.x ? "a" : "d";
}

function stampInLatch(stamp, latchStartTime) {
  if (!stamp || !Number.isFinite(latchStartTime)) return false;
  return stamp >= latchStartTime;
}

function resolveLatchVariant(player, opponent, latchStartTime) {
  if (!player) return CMD_GRAB_VARIANT.DRIVE;

  const wStamp = stampInLatch(player.grabWTapTime, latchStartTime)
    ? player.grabWTapTime
    : 0;

  const away = awayKeyFor(player, opponent);
  const backStampRaw =
    away === "a" ? player.grabATapTime : away === "d" ? player.grabDTapTime : 0;
  const backStamp = stampInLatch(backStampRaw, latchStartTime) ? backStampRaw : 0;

  if (!wStamp && !backStamp) return CMD_GRAB_VARIANT.DRIVE;
  if (!wStamp) return CMD_GRAB_VARIANT.PULL;
  if (!backStamp) return CMD_GRAB_VARIANT.THROW;
  return wStamp >= backStamp ? CMD_GRAB_VARIANT.THROW : CMD_GRAB_VARIANT.PULL;
}

// Open a clean aim window. Called at grab connect.
function beginLatchAim(player) {
  if (!player) return;
  player.grabVariantLocked = false;
  player.grabVariantThrowForbidden = false;
  player.grabVariant = CMD_GRAB_VARIANT.DRIVE;
  player.grabWTapTime = 0;
  player.grabATapTime = 0;
  player.grabDTapTime = 0;
}

function updateLatchVariant(player, opponent, latchStartTime) {
  if (!player || player.grabVariantLocked) return;
  player.grabVariant = resolveLatchVariant(player, opponent, latchStartTime);
  return player.grabVariant;
}

function lockGrabVariant(player) {
  if (!player) return;
  player.grabVariantLocked = true;
  if (!player.grabVariant) player.grabVariant = CMD_GRAB_VARIANT.DRIVE;
}

function clearGrabVariant(player) {
  if (!player) return;
  player.grabVariant = null;
  player.grabVariantLocked = false;
  player.grabVariantThrowForbidden = false;
  player.grabWTapTime = 0;
  player.grabATapTime = 0;
  player.grabDTapTime = 0;
}

// Legacy names — startup no longer selects a variant. Kept so older callers
// and tests that only need "wipe / lock" keep compiling.
const resolveGrabVariant = resolveLatchVariant;
const stampGrabVariant = beginLatchAim;
const updateGrabVariant = updateLatchVariant;

module.exports = {
  CMD_GRAB_VARIANT,
  noteGrabVariantEdges,
  awayKeyFor,
  resolveLatchVariant,
  beginLatchAim,
  updateLatchVariant,
  lockGrabVariant,
  clearGrabVariant,
  resolveGrabVariant,
  stampGrabVariant,
  updateGrabVariant,
};

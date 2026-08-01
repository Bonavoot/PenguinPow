"use strict";

/**
 * Directional command acquisition helpers (Phase 16).
 *
 * Palm chord grace: 50ms (~3 ticks @ 64Hz). Covers Mouse1 narrowly preceding
 * Back in the same human chord / adjacent emit without delaying intentional
 * neutral slaps (conversion only while slap is still in startup).
 *
 * Facing is snapshotted at Mouse1 acquisition — not re-read after pair-facing.
 */

const {
  isInputCommandReliabilityV2Enabled,
} = require("./inputCommandReliabilityFlags");

/** Minimum chord window: 3 sim ticks at TICK_RATE 64 ≈ 46.875ms → 50ms. */
const PALM_DIR_CHORD_MS = 50;
const PALM_DIR_CHORD_TICKS = 3;

const RELATIVE_DIR = Object.freeze({
  FORWARD: "forward",
  BACK: "back",
  NEUTRAL: "neutral",
  AMBIGUOUS: "ambiguous",
});

function sanitizeFacingSnap(facing) {
  if (facing === 1 || facing === -1) return facing;
  return null;
}

function facingKeys(facingSnap) {
  // facing === -1 faces right → forward is D, back is A (repo convention).
  const forwardKey = facingSnap === -1 ? "d" : "a";
  const backKey = facingSnap === -1 ? "a" : "d";
  return { forwardKey, backKey };
}

function stampDirectionTaps(player, nowSim) {
  if (!player) return;
  if (player.aJustPressed) player.dirATapTime = nowSim;
  if (player.dJustPressed) player.dirDTapTime = nowSim;
}

function tapRecent(player, key, nowSim, windowMs) {
  const t = key === "a" ? player.dirATapTime : key === "d" ? player.dirDTapTime : 0;
  return !!(t && nowSim - t < windowMs);
}

/**
 * Walk packet events to reconstruct whether back/forward were active around
 * the Mouse1 rising edge (same-packet chord ordering).
 */
function relativeDirFromPacketEvents(events, facingSnap, prevKeys) {
  if (!Array.isArray(events) || !events.length) return null;
  const { forwardKey, backKey } = facingKeys(facingSnap);
  let held = {
    a: !!prevKeys?.a,
    d: !!prevKeys?.d,
    s: !!prevKeys?.s,
    mouse1: !!prevKeys?.mouse1,
  };
  let dirAtMouse1 = null;
  let sawMouse1Rise = false;
  let backAfterMouse1 = false;
  let forwardAfterMouse1 = false;

  const limit = Math.min(events.length, 16);
  for (let i = 0; i < limit; i++) {
    const ev = events[i];
    if (!ev || typeof ev.k !== "string") continue;
    const down = ev.a === "down";
    const was = !!held[ev.k];
    if (ev.k === "mouse1" && down && !was) {
      sawMouse1Rise = true;
      const back = !!held[backKey];
      const forward = !!held[forwardKey];
      if (back && forward) dirAtMouse1 = RELATIVE_DIR.AMBIGUOUS;
      else if (back) dirAtMouse1 = RELATIVE_DIR.BACK;
      else if (forward) dirAtMouse1 = RELATIVE_DIR.FORWARD;
      else dirAtMouse1 = RELATIVE_DIR.NEUTRAL;
    }
    if (sawMouse1Rise && down && !was) {
      if (ev.k === backKey) backAfterMouse1 = true;
      if (ev.k === forwardKey) forwardAfterMouse1 = true;
    }
    held[ev.k] = down;
  }

  if (!sawMouse1Rise) return null;
  if (dirAtMouse1 === RELATIVE_DIR.BACK) return RELATIVE_DIR.BACK;
  if (dirAtMouse1 === RELATIVE_DIR.FORWARD) return RELATIVE_DIR.FORWARD;
  if (dirAtMouse1 === RELATIVE_DIR.AMBIGUOUS) return RELATIVE_DIR.AMBIGUOUS;
  // Mouse1 first in packet, direction later in same packet.
  if (backAfterMouse1 && forwardAfterMouse1) return RELATIVE_DIR.AMBIGUOUS;
  if (backAfterMouse1 && !forwardAfterMouse1) return RELATIVE_DIR.BACK;
  if (forwardAfterMouse1 && !backAfterMouse1) return RELATIVE_DIR.FORWARD;
  return dirAtMouse1;
}

/**
 * Resolve relative direction for open-game Mouse1 strike selection.
 * Legacy: held keys only at process time.
 * V2: facing snapshot + packet event order + short pre-Mouse1 tap window.
 */
function resolveStrikeRelativeDirection(player, data, opts = {}) {
  const facingSnap =
    sanitizeFacingSnap(opts.facingSnap ?? player?.facing) ??
    sanitizeFacingSnap(player?.facing);
  if (facingSnap == null) {
    return {
      relativeDir: RELATIVE_DIR.NEUTRAL,
      facingSnap: null,
      forwardKey: null,
      backKey: null,
      source: "invalid_facing",
    };
  }
  const { forwardKey, backKey } = facingKeys(facingSnap);
  const nowSim = opts.nowSim || 0;

  if (!isInputCommandReliabilityV2Enabled()) {
    const back = !!player.keys?.[backKey];
    const forward = !!player.keys?.[forwardKey];
    let relativeDir = RELATIVE_DIR.NEUTRAL;
    if (back && forward) relativeDir = RELATIVE_DIR.AMBIGUOUS;
    else if (back) relativeDir = RELATIVE_DIR.BACK;
    else if (forward) relativeDir = RELATIVE_DIR.FORWARD;
    return {
      relativeDir,
      facingSnap,
      forwardKey,
      backKey,
      source: "legacy_held",
    };
  }

  // 1) Same-packet event ordering (Mouse1 vs A/D).
  const fromEvents = relativeDirFromPacketEvents(
    data?.events,
    facingSnap,
    opts.prevKeys
  );
  if (
    fromEvents === RELATIVE_DIR.BACK ||
    fromEvents === RELATIVE_DIR.FORWARD ||
    fromEvents === RELATIVE_DIR.AMBIGUOUS
  ) {
    return {
      relativeDir: fromEvents,
      facingSnap,
      forwardKey,
      backKey,
      source: "packet_events",
    };
  }

  // 2) Held now, or direction tapped within chord window before this Mouse1.
  const backHeld = !!player.keys?.[backKey];
  const forwardHeld = !!player.keys?.[forwardKey];
  const backTap = tapRecent(player, backKey, nowSim, PALM_DIR_CHORD_MS);
  const forwardTap = tapRecent(player, forwardKey, nowSim, PALM_DIR_CHORD_MS);
  const backReady = backHeld || backTap;
  const forwardReady = forwardHeld || forwardTap;

  let relativeDir = RELATIVE_DIR.NEUTRAL;
  if (backReady && forwardReady) relativeDir = RELATIVE_DIR.AMBIGUOUS;
  else if (backReady) relativeDir = RELATIVE_DIR.BACK;
  else if (forwardReady) relativeDir = RELATIVE_DIR.FORWARD;

  return {
    relativeDir,
    facingSnap,
    forwardKey,
    backKey,
    source: "held_or_recent_tap",
  };
}

/**
 * If Mouse1 started a slap and Back arrives within the chord window during
 * startup, convert to palm (V2 only). Returns true when conversion ran.
 *
 * Caller supplies cancelPendingSlapWork to avoid circular requires.
 */
function tryConvertSlapToPalmChord(player, rooms, executePalmThrust, opts = {}) {
  if (!isInputCommandReliabilityV2Enabled()) return false;
  if (!player || typeof executePalmThrust !== "function") return false;
  if (typeof opts.cancelPendingSlapWork !== "function") return false;
  if (!player.isSlapAttack || !player.isAttacking) return false;
  if (!player.isInStartupFrames) return false;
  if (player.currentSlapHitConnected) return false;

  const nowSim = opts.nowSim || 0;
  const start = player.attackStartTime || 0;
  if (!start || nowSim - start > PALM_DIR_CHORD_MS) return false;

  const facingSnap =
    sanitizeFacingSnap(player._strikeFacingSnap) ||
    sanitizeFacingSnap(player.facing);
  if (facingSnap == null) return false;
  const { forwardKey, backKey } = facingKeys(facingSnap);
  if (!!player.keys?.[forwardKey]) return false;
  if (!player.keys?.[backKey] && !opts.backJustPressed) return false;

  // Tear down slap shell just enough for executePalmThrust's !isAttacking guard.
  opts.cancelPendingSlapWork(player);
  if (opts.timeoutManager && player.id) {
    opts.timeoutManager.clearPlayerSpecific(player.id, "slapCycle");
    opts.timeoutManager.clearPlayerSpecific(player.id, "slapStartupEnd");
  }
  player.isAttacking = false;
  player.isSlapAttack = false;
  player.attackType = null;
  player.currentAction = null;
  player.isInStartupFrames = false;
  player.slapLifecycleInstanceId = null;

  executePalmThrust(player, rooms);
  return !!(player.isPalmThrust && player.isAttacking);
}

function clearDirectionTapState(player) {
  if (!player) return;
  player.dirATapTime = 0;
  player.dirDTapTime = 0;
  player._strikeFacingSnap = null;
  player._pendingPalmChordUntil = 0;
}

module.exports = {
  PALM_DIR_CHORD_MS,
  PALM_DIR_CHORD_TICKS,
  RELATIVE_DIR,
  sanitizeFacingSnap,
  facingKeys,
  stampDirectionTaps,
  resolveStrikeRelativeDirection,
  tryConvertSlapToPalmChord,
  clearDirectionTapState,
  relativeDirFromPacketEvents,
};

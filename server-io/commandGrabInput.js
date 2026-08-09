// ============================================
// COMMAND GRAB — VARIANT SELECTION
// ============================================
// Which grab you get is decided by the direction you were pressing around the M2
// edge, and stays revisable until the grab goes active:
//
//   M2            → DRIVE  (the default — press nothing)
//   M2 + W        → THROW
//   M2 + Back     → PULL
//
// W and Back both count HELD or TAPPED. Holding the direction and pressing the
// button is the fighting-game convention, and anything stricter reads as the game
// eating your input.
//
// Back was briefly tap-only, on the theory that players hold Back while retreating
// and a panic-grab shouldn't silently become a Pull. That was wrong twice over: it
// broke the convention (holding Back + M2 gave a Drive, which just feels broken),
// and the "accident" it guarded against is actually the right outcome — if you are
// backing toward your own rope, swapping sides is exactly what you want.
//
// Forward is ignored entirely — it is the natural approach hold, so treating it as
// input would misread every walk-in grab.
//
// Recency decides changes of mind: the most recent qualifying press wins. A held
// direction refreshes its own stamp every packet, so it outranks a stale tap, and
// a tapped-and-released direction can be overridden by a later press of the other.
// W wins exact ties (the "both at once" case). There is no path back to DRIVE once
// a direction has been pressed: DRIVE is what you get by pressing nothing, and
// "I wanted a throw, then changed to a push, inside 145ms" is not worth a rule
// that could misfire.
//
// This module is deliberately dependency-free (constants only) so it can be unit
// tested without a room, a socket, or a clock.

const {
  CMD_GRAB_VARIANT,
  CMD_GRAB_VARIANT_PREBUFFER_MS,
} = require("./constants");

// Recorded every input packet, before any grab exists.
//
// A HELD direction refreshes its stamp every packet, so an ongoing hold always
// reads as the newest intent no matter how long ago it started — that is what makes
// "hold Back, press M2" work. A released direction keeps its last stamp, so a tap
// still counts for the pre-buffer window.
function noteGrabVariantEdges(player, nowSim, edges = {}) {
  if (!player) return;
  const keys = player.keys || {};
  if (keys.w || edges.wJustPressed) player.grabWTapTime = nowSim;
  if (keys.a || edges.aJustPressed) player.grabATapTime = nowSim;
  if (keys.d || edges.dJustPressed) player.grabDTapTime = nowSim;
}

// Away-from-opponent key, resolved from live positions rather than stored at tap
// time so a mid-window position swap can't leave a stale "back".
function awayKeyFor(player, opponent) {
  if (!opponent) return null;
  return player.x < opponent.x ? "a" : "d";
}

// A stamp qualifies if it landed inside the pre-buffer ahead of the grab press or
// at any point since. Anchoring to grabStartupStartTime (rather than to "now")
// keeps one predicate covering both the pre-press buffer and in-startup revision.
function stampQualifies(stamp, startupStartTime) {
  if (!stamp) return false;
  return stamp >= startupStartTime - CMD_GRAB_VARIANT_PREBUFFER_MS;
}

// Pure resolution: no mutation, so tests can assert selection independently of
// when it happens to be called.
//
// `forbidThrow` covers the one input collision that cannot be resolved by priority:
// while ice sliding, W is slide-jump. Whether M2+W produced a Throw or a slide-jump
// would otherwise depend on which packet W landed in — order-dependent, and exactly
// the kind of coin flip that reads as a misinput. A grab out of a slide is therefore
// always Drive or Pull, which is deterministic and costs little, since a
// high-momentum slide wants to become a carry anyway.
function resolveGrabVariant(player, opponent, startupStartTime, forbidThrow = false) {
  if (!player) return CMD_GRAB_VARIANT.DRIVE;

  const wStamp = stampQualifies(player.grabWTapTime, startupStartTime)
    ? player.grabWTapTime
    : 0;

  const away = awayKeyFor(player, opponent);
  const backStampRaw =
    away === "a" ? player.grabATapTime : away === "d" ? player.grabDTapTime : 0;
  const backStamp = stampQualifies(backStampRaw, startupStartTime)
    ? backStampRaw
    : 0;

  const throwAllowed = wStamp && !forbidThrow;
  if (!throwAllowed && !backStamp) return CMD_GRAB_VARIANT.DRIVE;
  if (!throwAllowed) return CMD_GRAB_VARIANT.PULL;
  // Ties go to W — that is the "both at once" case, and W is the less ambiguous
  // press of the two.
  if (wStamp >= backStamp) return CMD_GRAB_VARIANT.THROW;
  return CMD_GRAB_VARIANT.PULL;
}

// Called from beginGrabStartup. Opens the revision window. `forbidThrow` is
// latched for the whole grab so an in-startup revision cannot reintroduce the
// slide-jump collision the initial stamp just avoided.
function stampGrabVariant(player, opponent, startupStartTime, forbidThrow = false) {
  if (!player) return CMD_GRAB_VARIANT.DRIVE;
  player.grabVariantLocked = false;
  player.grabVariantThrowForbidden = !!forbidThrow;
  player.grabVariant = resolveGrabVariant(
    player,
    opponent,
    startupStartTime,
    !!forbidThrow
  );
  return player.grabVariant;
}

// Called every input packet while the grab is still in startup. Once locked this
// is inert, so a late press can never retarget a grab that is already active.
function updateGrabVariant(player, opponent) {
  if (!player || !player.isGrabStartup || player.grabVariantLocked) return;
  player.grabVariant = resolveGrabVariant(
    player,
    opponent,
    player.grabStartupStartTime || 0,
    !!player.grabVariantThrowForbidden
  );
}

// Called when startup ends (the grab goes active). Locking here rather than at
// connect is what stops a grab from being held out and having its variant picked
// on the frame contact is seen. In the common case — already in range, so connect
// lands on the first active tick — the two are the same instant.
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

module.exports = {
  CMD_GRAB_VARIANT,
  noteGrabVariantEdges,
  resolveGrabVariant,
  stampGrabVariant,
  updateGrabVariant,
  lockGrabVariant,
  clearGrabVariant,
};

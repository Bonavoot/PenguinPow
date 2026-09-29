// ============================================
// COMMAND GRAB — POST-CONNECT AUTHORITY
// ============================================
// M2 latches the belt. During the latch the grabber aims; on resolve the aimed
// verb plays. Drive / Pull / Throw stay the three sumo sentences.
//
//   connect ──(HITSTOP_GRAB_MS)──▶ LATCH (aim) ──▶ resolve
//                                    Back → PULL
//                                    W    → THROW
//                                    else → DRIVE (timeout default)
//
// Every verb waits out the full latch. Pull and Throw used to leave early,
// which skipped the grip and read as having no startup.
//
// Lethality is permission + geography, snapshotted from posture at connect:
//   THROW  low posture AND the toss would land past the tawara
//   PULL   low posture AND the yank hits the clamp behind you (the tawara
//          trip). Same clamp read as the back-to-the-wall clarity swap —
//          lethal yanks are allowed past the rope; healthy swaps. The
//          belly-slide does NOT start at resolve — they yank standing,
//          then trip once they actually cross the map line.
//   DRIVE  gassed / empty tank at the rope (unchanged)
//
// Mid-ring at 0 posture is a huge in-bounds send, not a funeral.
//
// Throw is a fixed setup dump. Posture juices the plant and still gates the
// cinematic kill. Drive/Pull keep posture as their distance function.

const {
  CMD_GRAB_VARIANT,
  CMD_GRAB_LATCH_MS,
  CMD_GRAB_CONNECT_HITSTOP_MS,
  CMD_GRAB_CINCH_MS,
  HITSTOP_GRAB_MS,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_TOGETHER_MS,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  CMD_PULL_LAUNCH_HITSTOP_MS,
  CMD_GRAB_CINCH_GRABBER_SHARE,
  CMD_GRAB_STAMINA_COST,
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
  CMD_DRIVE_TRAVEL_CAP,
  CMD_PULL_DISTANCE_MIN,
  CMD_PULL_DISTANCE_MAX,
  CMD_PULL_KILL_CLAMP_ROOM_PX,
  SETUP_THROW_TRAVEL_PX,
  SETUP_THROW_DURATION_MS,
  SETUP_THROW_RICOCHET_DURATION_MS,
  SETUP_THROW_RICOCHET_REBOUND_PX,
  SETUP_THROW_RICOCHET_REBOUND_MIN_PX,
  SETUP_THROW_RICOCHET_BOUNCE_HEIGHT,
  SETUP_THROW_CHASE_SLIDE_PX,
  ICE_SLIDE_MAX_SPEED,
  speedFactor,
  SETUP_THROW_RICOCHET_HIT_AT,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_DRIVE_GASSED_DISTANCE_MULT,
  CMD_DRIVE_APPROACH_REF_SPEED,
  CMD_DRIVE_APPROACH_BONUS_MAX,
  CMD_DRIVE_CINCH_FRACTION,
  CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC,
  CMD_DRIVE_RELEASE_SEPARATION,
  CMD_DRIVE_RELEASE_IMPACT_MS,
  CMD_DRIVE_RELEASE_TWEEN_MS,
  CMD_DRIVE_RELEASE_VICTIM_SHARE,
  CMD_DRIVE_RELEASE_POSE_DROP_FRACTION,
  CMD_PULL_POSTURE_CHIP,
  CMD_THROW_POSTURE_CHIP,
  CMD_DRIVE_ATTACKER_RECOVERY_MS,
  CMD_DRIVE_DEFENDER_RECOVERY_MS,
  CMD_GRAB_CLASH_HITSTOP_MS,
  CMD_GRAB_CLASH_POSE_MS,
  CMD_GRAB_CLASH_PUSHBACK,
  CMD_GRAB_CLASH_SEPARATE_MS,
  CLINCH_ATTACHED_DISTANCE,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_THROW_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  PULL_BOUNDARY_MARGIN,
  BALANCE_MAX,
  GROUND_LEVEL,
  GRAB_WHIFF_RECOVERY_MS,
  GRAB_STATES,
} = require("./constants");

const {
  setPlayerTimeout,
  simNow,
  clearAllActionStates,
  triggerHitstopAndEmit,
  emitThrottledScreenShake,
  applyBalanceDamage,
  tryEnterGassed,
  timeoutManager,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  endPerfectParryStun,
  clearSetupThrowFlags,
  getEffectiveMoveSpeedMult,
  emitStaminaBlocked,
  beginAtTheRopes,
} = require("./gameUtils");

const {
  correctFacingAfterGrabOrThrow,
  endGrabWhiffRecovery,
  releaseGrabStartupFacingLock,
} = require("./grabMechanics");
const { cleanupGrabStates, handleWinCondition } = require("./gameFunctions");
const { triggerRingOut } = require("./ringOutPush");
const {
  clearGrabVariant,
  beginLatchAim,
  noteGrabVariantEdges,
  updateLatchVariant,
  lockGrabVariant,
} = require("./commandGrabInput");
const {
  isActionFacingOwnershipV2Enabled,
  acquireActionFacingLock,
  mintActionFacingInstanceId,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
} = require("./actionFacingOwnership");
const {
  CLINCH_INTERACTION,
  CLINCH_EFFECT_MID_Y,
  ensureClinchInstanceId,
  buildClinchPresentation,
  attachCombatPresentation,
} = require("./combatPresentationEvent");

const MomentumTransfer = require("./momentumTransfer");
const {
  getDriveCarrySpeed,
  getDriveCarryDurationMs,
  driveCarryTravelT,
} = require("./combatHelpers");
const {
  describePullYank,
} = require("./pullYankMotion");
const { describeThrowToss } = require("./throwTossMotion");
const { stampSetupThrowFlight } = require("./setupThrowFlight");

// How much of the victim's counter-charge is subtracted from a DRIVE. Driving
// into someone charging back at you is driving into their force; it should
// barely move them, which is what makes PULL the correct answer there.
const DRIVE_COUNTER_CHARGE = 0.6;

// Safety rails only. Live duration is D·p/v0 (accel from attempt speed).
const DRIVE_CARRY_MIN_MS = 180;
const DRIVE_CARRY_MAX_MS = 1100;

const CMD_PHASE = {
  LATCH: "latch",
  STARTUP: "latch", // alias — older tests/docs said "startup"
  CARRY: "carry",
};

// 0 at full posture, 1 at the lethal line. Linear on purpose: a squared ease
// plus a second motion gate made the middle of the bar feel like full health
// and the next few points feel like a different move.
function grabPostureT(balance) {
  const bal = Math.max(
    CLINCH_THROW_KILL_THRESHOLD,
    Math.min(BALANCE_MAX, typeof balance === "number" ? balance : BALANCE_MAX)
  );
  const span = Math.max(1, BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD);
  const t = 1 - (bal - CLINCH_THROW_KILL_THRESHOLD) / span;
  return Math.max(0, Math.min(1, t));
}

function grabPostureEase(balance) {
  return grabPostureT(balance);
}

function grabPostureLerp(balance, minValue, maxValue) {
  return minValue + (maxValue - minValue) * grabPostureEase(balance);
}

function postureScaled(balance, minValue, maxValue) {
  return Math.round(grabPostureLerp(balance, minValue, maxValue));
}

function postureLerp(balance, minValue, maxValue) {
  return grabPostureLerp(balance, minValue, maxValue);
}

function isPostureLethal(balance) {
  return (
    (typeof balance === "number" ? balance : BALANCE_MAX) <
    CLINCH_THROW_KILL_THRESHOLD
  );
}

function approachBonus(approachSpeed, bonusMax) {
  const ref = CMD_DRIVE_APPROACH_REF_SPEED || 1;
  const ratio = Math.max(0, Math.min(1, (approachSpeed || 0) / ref));
  return (bonusMax || 0) * ratio;
}

function driveTravelPx(balance, approachSpeed, counterCharge, gassed) {
  const base = grabPostureLerp(balance, CMD_DRIVE_DISTANCE_MIN, CMD_DRIVE_DISTANCE_MAX);
  const bonus = approachBonus(approachSpeed, CMD_DRIVE_APPROACH_BONUS_MAX);
  const countered = Math.max(0, bonus - DRIVE_COUNTER_CHARGE * (counterCharge || 0));
  let distance = base + countered;
  if (gassed) distance *= CMD_DRIVE_GASSED_DISTANCE_MULT;
  return Math.round(Math.min(distance, CMD_DRIVE_TRAVEL_CAP));
}

function throwTravelPx(_balance, _approachSpeed) {
  return SETUP_THROW_TRAVEL_PX;
}

function throwMarginBounds() {
  return {
    left: MAP_LEFT_BOUNDARY + CLINCH_THROW_BOUNDARY_MARGIN,
    right: MAP_RIGHT_BOUNDARY - CLINCH_THROW_BOUNDARY_MARGIN,
  };
}

function throwReboundPx(balance) {
  return Math.round(
    grabPostureLerp(
      balance,
      SETUP_THROW_RICOCHET_REBOUND_PX,
      SETUP_THROW_RICOCHET_REBOUND_MIN_PX
    )
  );
}

// Slide starts late enough that THIS fighter's speed arrives on the plant.
// The constant SETUP_THROW_CHASE_LOCK_MS is the 1.0x case. Happy Feet stacks
// used to cover the pocket early and belly-bump the landing.
function chaseLockMsFor(moveMult, flightMs) {
  const mult = Math.max(1, moveMult || 1);
  const pxPerSec = 1000 * speedFactor * ICE_SLIDE_MAX_SPEED * mult;
  const slideMs = (SETUP_THROW_CHASE_SLIDE_PX / Math.max(1, pxPerSec)) * 1000;
  const flight = Number.isFinite(flightMs) ? flightMs : 0;
  return Math.max(0, Math.round(flight - slideMs));
}

function planSetupThrow(grabber, victim, travelPx, balance = BALANCE_MAX) {
  const dir = throwDirFor(grabber, victim);
  const originX = grabber.x;
  const startX = victim.x;
  const travel = Number.isFinite(travelPx) ? travelPx : SETUP_THROW_TRAVEL_PX;
  const intendedLand = originX + dir * travel;
  const { left, right } = throwMarginBounds();
  const wouldClamp = dir > 0 ? intendedLand > right : intendedLand < left;
  if (!wouldClamp) {
    return {
      ricochet: false,
      originX,
      startX,
      landX: intendedLand,
      hitX: intendedLand,
      hitAt: SETUP_THROW_RICOCHET_HIT_AT,
      bounceHeight: 0,
      durationMs: SETUP_THROW_DURATION_MS,
    };
  }
  const hitX = dir > 0 ? right : left;
  const inward = dir > 0 ? -1 : 1;
  const reboundPx = throwReboundPx(balance);
  let landX = hitX + inward * reboundPx;
  if (Math.abs(landX - originX) < CLINCH_THROW_MIN_SEPARATION) {
    const side = landX >= originX ? 1 : -1;
    landX = originX + side * CLINCH_THROW_MIN_SEPARATION;
  }
  landX = Math.max(left, Math.min(landX, right));
  return {
    ricochet: true,
    originX,
    startX,
    landX,
    hitX,
    hitAt: SETUP_THROW_RICOCHET_HIT_AT,
    bounceHeight: Math.round(
      SETUP_THROW_RICOCHET_BOUNCE_HEIGHT *
        (reboundPx / SETUP_THROW_RICOCHET_REBOUND_PX)
    ),
    durationMs: SETUP_THROW_RICOCHET_DURATION_MS,
  };
}

function pullTravelPx(balance) {
  return Math.round(
    grabPostureLerp(balance, CMD_PULL_DISTANCE_MIN, CMD_PULL_DISTANCE_MAX)
  );
}

function throwDirFor(grabber, victim) {
  return grabber.x < victim.x ? 1 : -1;
}

function pullDirFor(grabber, victim) {
  return victim.x < grabber.x ? 1 : -1;
}

function predictedThrowLandX(grabber, victim, distance) {
  return grabber.x + throwDirFor(grabber, victim) * distance;
}

function killThrowLandsOffDohyo(grabber, victim) {
  const landX = predictedThrowLandX(grabber, victim, CLINCH_KILL_THROW_DISTANCE);
  return landX <= DOHYO_LEFT_BOUNDARY || landX >= DOHYO_RIGHT_BOUNDARY;
}

function predictedPullTargetX(grabber, victim, pullDist) {
  return grabber.x + pullDirFor(grabber, victim) * pullDist;
}

function throwWouldExit(grabber, victim, distance) {
  const dir = throwDirFor(grabber, victim);
  const landX = predictedThrowLandX(grabber, victim, distance);
  return dir > 0 ? landX > MAP_RIGHT_BOUNDARY : landX < MAP_LEFT_BOUNDARY;
}

// One clamp read for kill AND the back-to-the-wall swap. The yank always
// sends the victim toward the grabber's back. If that destination hits the
// pull margin (or there isn't room for a side-switch), they have "reached
// the clamp." `atX` lets the kill check use the connect plant so the latch
// cinch cannot walk the grabber off the rope and steal the finish.
function getPullBoundaryRead(grabber, victim, pullDist, atX) {
  const dir = pullDirFor(grabber, victim);
  const grabberX = Number.isFinite(atX) ? atX : grabber.x;
  const rawTargetX = grabberX + dir * pullDist;
  const leftBound = MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN;
  const rightBound = MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN;
  const clampedTargetX = Math.max(leftBound, Math.min(rawTargetX, rightBound));
  const distPastActor =
    dir === -1 ? grabberX - clampedTargetX : clampedTargetX - grabberX;
  const hitsClamp = dir > 0 ? rawTargetX >= rightBound : rawTargetX <= leftBound;
  const noRoomForSideSwitch = distPastActor < CLINCH_THROW_MIN_SEPARATION;
  const reachesKillClamp = distPastActor < CMD_PULL_KILL_CLAMP_ROOM_PX;
  return {
    dir,
    grabberX,
    rawTargetX,
    clampedTargetX,
    distPastActor,
    hitsClamp,
    noRoomForSideSwitch,
    reachesKillClamp,
  };
}

function pullWouldExit(grabber, victim, pullDist) {
  return getPullBoundaryRead(grabber, victim, pullDist).hitsClamp;
}

function shouldKillThrow(grabber, victim, distance, balance) {
  return isPostureLethal(balance) && throwWouldExit(grabber, victim, distance);
}

function pullReadIsRopeTrip(read) {
  return read.hitsClamp && read.reachesKillClamp;
}

function pullTripTargetX(grabber, victim, pullDist) {
  const dir = pullDirFor(grabber, victim);
  const raw = grabber.x + dir * pullDist;
  const edge = dir < 0 ? MAP_LEFT_BOUNDARY : MAP_RIGHT_BOUNDARY;
  // Must actually clear the straw — hitting the pull margin is not enough.
  const minPast = edge + dir * 48;
  return dir < 0 ? Math.min(raw, minPast) : Math.max(raw, minPast);
}

function pullHasCrossedMap(player) {
  if (!player) return false;
  const start = player.grabBreakStartX ?? player.x;
  const target = player.grabBreakTargetX ?? player.x;
  const dir = target >= start ? 1 : -1;
  return dir > 0 ? player.x >= MAP_RIGHT_BOUNDARY : player.x <= MAP_LEFT_BOUNDARY;
}

function armPullTrip(victim, grabber, room, io) {
  if (!victim || !grabber || !room) return;
  victim.pendingPullTrip = false;
  victim.isClinchKillPullVictim = true;
  handleWinCondition(room, victim, grabber, io, "clinchKillPull");
  // Win cleanup drops puller pose / tell length. The tween must keep running
  // so the belly-slide finishes past the rope.
  victim.isClinchKillPullVictim = true;
  victim.pendingPullTrip = false;
  victim.isBeingPullReversaled = true;
  victim.pullReversalPullerId = grabber.id;
  victim.isGrabBreakSeparating = true;
  grabber.isAttemptingPull = true;
  stampGrabTellDuration(grabber, CMD_GRAB_VARIANT.PULL, true);
}

function maybeArmPullTrip(victim, room, io, { force = false } = {}) {
  if (!victim || !victim.pendingPullTrip || victim.isClinchKillPullVictim) {
    return false;
  }
  if (!force && !pullHasCrossedMap(victim)) return false;
  const grabber = (room && room.players || []).find(
    (p) => p.id === victim.pullReversalPullerId
  );
  if (!grabber) return false;
  armPullTrip(victim, grabber, room, io);
  return true;
}

function shouldKillPull(grabber, victim, pullDist, balance) {
  if (!isPostureLethal(balance)) return false;
  const live = getPullBoundaryRead(grabber, victim, pullDist);
  const planted = Number.isFinite(grabber.cmdGrabCinchFromX)
    ? getPullBoundaryRead(grabber, victim, pullDist, grabber.cmdGrabCinchFromX)
    : live;
  // Lethal + the yank actually slams the clamp while your back is on that
  // rope. Connect OR live: the latch cinch walks you toward the victim
  // (off your own tawara) and used to flip a trip into the clarity swap.
  return pullReadIsRopeTrip(live) || pullReadIsRopeTrip(planted);
}

function attachDistanceFor(victim) {
  return CLINCH_ATTACHED_DISTANCE * (victim.sizeMultiplier || 1);
}

function connectStartupMsFor(_variant, _isKill = false) {
  return CMD_GRAB_LATCH_MS;
}

function connectHitstopMsFor(variant) {
  const ms = CMD_GRAB_CONNECT_HITSTOP_MS[variant];
  return Number.isFinite(ms) ? ms : 0;
}

// Wall-clock length of the latch, including the connect freeze. CSS animations
// run on wall time even while simTime is frozen.
function grabTellAnimMs(variant, _isKill = false) {
  if (variant === CMD_GRAB_VARIANT.DRIVE) return HITSTOP_GRAB_MS + CMD_GRAB_LATCH_MS;
  return HITSTOP_GRAB_MS + connectHitstopMsFor(variant) + CMD_GRAB_LATCH_MS;
}

function stampGrabTellDuration(grabber, variant, isKill) {
  if (!grabber) return;
  grabber.clinchThrowAnimMs = grabTellAnimMs(variant, isKill);
}

// A grab can connect anywhere inside GRAB_RANGE (175) while settled grip spacing is
// only ~61px, so a max-range connect leaves the fighters visibly apart. That gap is
// closed across CMD_GRAB_CINCH_MS rather than snapped or stretched across the tell.
//
// Crucially it is closed mostly by moving the GRABBER forward
// (CMD_GRAB_CINCH_GRABBER_SHARE). Pulling the victim back instead made a long
// connect look like grabbing an invisible wall and then teleporting the opponent
// into your hands; lunging into the grip reads as the grab actually reaching.
function stampCinch(grabber, victim) {
  const gap = Math.abs(grabber.x - victim.x);
  const attach = attachDistanceFor(victim);
  const dir = grabber.x < victim.x ? 1 : -1;
  const close = Math.max(0, gap - attach);
  grabber.cmdGrabConnectGap = gap;
  grabber.cmdGrabCinchFromX = grabber.x;
  grabber.cmdGrabCinchToX =
    grabber.x + dir * close * CMD_GRAB_CINCH_GRABBER_SHARE;
  grabber.cmdGrabVictimCinchFromX = victim.x;
  grabber.cmdGrabVictimCinchToX =
    victim.x - dir * close * (1 - CMD_GRAB_CINCH_GRABBER_SHARE);
}

// Ease-out so the grip snaps closed at contact and settles, matching the connect
// THUNK rather than gliding in at constant speed. Duration is CMD_GRAB_CINCH_MS,
// not the tell — Drive closes its grip during the carry instead.
function applyCinch(grabber, victim, elapsed, cinchMs) {
  const t = cinchMs > 0 ? Math.max(0, Math.min(1, elapsed / cinchMs)) : 1;
  const eased = 1 - Math.pow(1 - t, 2);
  const lerp = (from, to) =>
    Number.isFinite(from) && Number.isFinite(to) ? from + (to - from) * eased : null;

  const gx = lerp(grabber.cmdGrabCinchFromX, grabber.cmdGrabCinchToX);
  const vx = lerp(grabber.cmdGrabVictimCinchFromX, grabber.cmdGrabVictimCinchToX);
  if (gx != null) grabber.x = gx;
  if (vx != null) victim.x = vx;

  // Keep the PAIR inside the ring, preserving their spacing.
  const overRight = Math.max(grabber.x, victim.x) - MAP_RIGHT_BOUNDARY;
  if (overRight > 0) {
    grabber.x -= overRight;
    victim.x -= overRight;
  }
  const overLeft = MAP_LEFT_BOUNDARY - Math.min(grabber.x, victim.x);
  if (overLeft > 0) {
    grabber.x += overLeft;
    victim.x += overLeft;
  }

  // Report the LIVE gap so the client's belt-arm overlay tracks the closing grip.
  const liveGap = Math.abs(grabber.x - victim.x);
  grabber.clinchAttachDistance = liveGap;
  victim.clinchAttachDistance = liveGap;

  grabber.movementVelocity = 0;
  victim.movementVelocity = 0;
  grabber.isStrafing = false;
  victim.isStrafing = false;
  grabber.y = GROUND_LEVEL;
  victim.y = GROUND_LEVEL;
  if (!victim.atTheRopesFacingDirection) {
    victim.facing = grabber.x < victim.x ? 1 : -1;
  }
  if (!grabber.atTheRopesFacingDirection) {
    grabber.facing = grabber.x < victim.x ? -1 : 1;
  }
}

function clearCommandGrabState(player) {
  if (!player) return;
  player.cmdGrabPhase = null;
  player.cmdGrabPhaseStart = 0;
  player.cmdGrabVariant = null;
  player.cmdGrabKillBalance = null;
  player.cmdGrabIsKill = false;
  player.cmdGrabVictimBalance = null;
  player.cmdGrabCarryStartX = 0;
  player.cmdGrabCarryTargetX = 0;
  player.cmdGrabCarryDuration = 0;
  player.cmdGrabCarryDir = 0;
  player.cmdGrabCarryAttachFrom = null;
  player.cmdGrabCarryAttachTo = null;
  player.cmdGrabAtRope = false;
  player.cmdGrabRopeSince = 0;
  player.cmdGrabConnectGap = 0;
  player.cmdGrabEdgeWaiver = false;
  player.cmdGrabCinchFromX = null;
  player.cmdGrabCinchToX = null;
  player.cmdGrabVictimCinchFromX = null;
  player.cmdGrabVictimCinchToX = null;
}

// Called at grab connect (from the index.js tick loop). The victim's posture is
// snapshotted here, BEFORE any chip, so the lethal decision matches the danger
// line the HUD was advertising when the player committed. The variant is NOT
// chosen yet — the latch is the aim window.
function beginCommandGrab(grabber, victim, room, io) {
  if (!grabber || !victim) return;
  // Latch speed is this frame's slide. Index zeros the live impulse on
  // connect; if it is still here (harness / same-tick), write it onto
  // grabAttemptSpeed so Drive can decel from the real catch, not the stamp.
  if (Math.abs(grabber.grabMovementVelocity || 0) > 0) {
    grabber.grabAttemptSpeed = getDriveCarrySpeed(grabber);
  }
  const now = simNow(room);

  const aimOpen =
    grabber.grabStartupStartTime || grabber.grabStartTime || now;
  beginLatchAim(grabber, aimOpen);
  grabber.cmdGrabPhase = CMD_PHASE.LATCH;
  grabber.cmdGrabPhaseStart = now;
  grabber.cmdGrabVariant = CMD_GRAB_VARIANT.DRIVE;
  grabber.cmdGrabKillBalance =
    typeof victim.balance === "number" ? victim.balance : BALANCE_MAX;
  grabber.cmdGrabIsKill = false;
  grabber.cmdGrabAtRope = false;

  stampGrabTellDuration(grabber, CMD_GRAB_VARIANT.DRIVE, false);

  grabber.stamina = Math.max(0, (grabber.stamina || 0) - CMD_GRAB_STAMINA_COST);

  grabber.cmdGrabVictimBalance = grabber.cmdGrabKillBalance;
  // Drive counter-charge needs the VICTIM's speed at the grip — by resolve
  // they are locked and their velocity has been zeroed. Pull does not spend
  // this; it is a belt tug. Mirrors `grabApproachSpeed` on the grabber.
  {
    const towardGrabber = grabber.x < victim.x ? -1 : 1;
    grabber.cmdGrabVictimApproach = Math.max(
      0,
      MomentumTransfer.totalVelocity(victim) * towardGrabber
    );
  }

  grabber.isClinchBeltHolding = true;
  victim.isClinchBeltHolding = true;
  stampCinch(grabber, victim);
  const gap = grabber.cmdGrabConnectGap;
  grabber.clinchAttachDistance = gap;
  victim.clinchAttachDistance = gap;

  applyStartupPoses(grabber, victim);
  endPerfectParryStun(victim);
}

// Pose flags for the STARTUP beat, driving existing wire fields so the client pose
// chain needs no changes.
//
// The victim deliberately gets NO isResistingThrow / isResistingPull: those resolve
// to the generic `hit` sprite, which was correct in the old clinch (they were
// actively resisting) but wrong here — nothing is being resisted, they are simply
// held. Leaving them clear lets the victim fall through to the belt-grip body via
// isBeingGrabbed + hasGrip, which is a far better placeholder and the right slot for
// the dedicated isBeingThrown / isBeingPulled art when it exists.
function applyStartupPoses(grabber, victim) {
  const variant = grabber.cmdGrabVariant;
  grabber.isAttemptingGrabThrow = variant === CMD_GRAB_VARIANT.THROW;
  grabber.isAttemptingPull = variant === CMD_GRAB_VARIANT.PULL;
  grabber.isClinchPushing = variant === CMD_GRAB_VARIANT.DRIVE;
  grabber.isClinchThrowing =
    variant === CMD_GRAB_VARIANT.THROW || variant === CMD_GRAB_VARIANT.PULL;
  victim.isResistingThrow = false;
  victim.isResistingPull = false;
  // Heels dug for the whole grip, so the hold is two bodies and not a clone.
  victim.isClinchPlanting = true;
  stampGrabTellDuration(grabber, variant, false);
}

function sampleLatchAim(grabber, victim, now) {
  if (!grabber || grabber.grabVariantLocked) return;
  noteGrabVariantEdges(grabber, now, {});
  updateLatchVariant(
    grabber,
    victim,
    grabber.grabAimOpenAt || grabber.cmdGrabPhaseStart
  );
  grabber.cmdGrabVariant = grabber.grabVariant || CMD_GRAB_VARIANT.DRIVE;
}

function applyVariantChip(grabber, victim, now) {
  const variant = grabber.cmdGrabVariant || CMD_GRAB_VARIANT.DRIVE;
  const chip =
    variant === CMD_GRAB_VARIANT.THROW
      ? CMD_THROW_POSTURE_CHIP
      : variant === CMD_GRAB_VARIANT.PULL
        ? CMD_PULL_POSTURE_CHIP
        : CMD_DRIVE_POSTURE_CHIP;
  applyBalanceDamage(victim, chip, now);
  grabber.cmdGrabVictimBalance =
    typeof victim.balance === "number" ? victim.balance : BALANCE_MAX;
}

// Recovery as a real `isRecovering` window, which is the house pattern (palm
// thrust, charge clash) and is already gated by both the movement code and
// canPlayerUseAction/canPlayerDash. An actionLockUntil on its own only blocked
// ACTIONS, so a player could strafe around while unable to dodge — which reads as
// the game swallowing inputs rather than as recovery.
function beginGrabRecovery(player, durationMs, now) {
  if (!player || durationMs <= 0) return;
  player.isRecovering = true;
  player.recoveryStartTime = now;
  player.recoveryDuration = durationMs;
  player.movementVelocity = 0;
  player.isStrafing = false;
  player.actionLockUntil = Math.max(player.actionLockUntil || 0, now + durationMs);
}

function clearActionPoses(grabber, victim) {
  grabber.isAttemptingGrabThrow = false;
  grabber.isAttemptingPull = false;
  grabber.isClinchThrowing = false;
  grabber.isClinchPushing = false;
  grabber.isClinchPlanting = false;
  grabber.isClinchCommittedDrive = false;
  grabber.isGrabPushing = false;
  grabber.isEdgePushing = false;
  victim.isResistingThrow = false;
  victim.isResistingPull = false;
  victim.isClinchPlanting = false;
  victim.isClinchPushing = false;
  victim.isClinchCommittedDrive = false;
  victim.isBeingGrabPushed = false;
  victim.isBeingEdgePushed = false;
}

// ── Per-tick driver ─────────────────────────────────────────────────────────
function updateCommandGrab(grabber, room, io, delta, rooms) {
  if (!grabber || !grabber.isGrabbing || !grabber.grabbedOpponent) return;
  if (grabber.isRingOutPushCutscene || room.gameOver) return;
  // Throw / pull hand off to their own simulators in index.js once resolved.
  if (grabber.isThrowing || grabber.isBeingThrown) return;
  if (!grabber.cmdGrabPhase) return;

  const victim = room.players.find((p) => p.id === grabber.grabbedOpponent);
  if (!victim) {
    // Orphan safety — mirrors the old system's 500ms bail.
    if (simNow(room) - (grabber.grabStartTime || 0) >= 500) {
      grabber.isGrabbing = false;
      grabber.grabbedOpponent = null;
      clearCommandGrabState(grabber);
    }
    return;
  }

  const now = simNow(room);
  const elapsed = now - (grabber.cmdGrabPhaseStart || now);

  // Space breaks the hold from the connect onward — latch, shove, or pin.
  if (victim.grabBreakQueued) {
    victim.grabBreakQueued = false;
    if (victim.isGassed) {
      emitStaminaBlocked(victim, "grab_break", io);
    } else {
      resolveCommandGrabBreak(grabber, victim, room, io);
      return;
    }
  }

  if (grabber.cmdGrabPhase === CMD_PHASE.LATCH) {
    const { isTachiaiLive, TACHIAI_CALL } = require("./tachiai");
    const openingPush =
      isTachiaiLive(grabber, now) && grabber.tachiaiCall === TACHIAI_CALL.GRAB;
    if (openingPush) {
      grabber.grabVariant = CMD_GRAB_VARIANT.DRIVE;
      grabber.grabVariantLocked = true;
    }
    sampleLatchAim(grabber, victim, now);
    applyStartupPoses(grabber, victim);
    applyCinch(grabber, victim, elapsed, CMD_GRAB_CINCH_MS);

    if (openingPush || elapsed >= CMD_GRAB_LATCH_MS) {
      resolveVariant(grabber, victim, room, io, rooms);
    if (openingPush) {
      const { retargetHenkaDrive } = require("./tachiaiResolve");
      retargetHenkaDrive(grabber, victim, now);
      const { endTachiaiAction, TACHIAI_CALL } = require("./tachiai");
      endTachiaiAction(grabber, TACHIAI_CALL.GRAB);
      endTachiaiAction(victim, TACHIAI_CALL.HENKA);
    }
    }
    return;
  }

  if (grabber.cmdGrabPhase === CMD_PHASE.CARRY) {
    advanceDriveCarry(grabber, victim, room, io, rooms, now, delta);
    return;
  }
}

function resolveVariant(grabber, victim, room, io, rooms) {
  sampleLatchAim(grabber, victim, simNow(room));
  lockGrabVariant(grabber);
  grabber.cmdGrabVariant = grabber.grabVariant || CMD_GRAB_VARIANT.DRIVE;
  applyVariantChip(grabber, victim, simNow(room));

  const variant = grabber.cmdGrabVariant;
  const balance = grabber.cmdGrabKillBalance ?? BALANCE_MAX;

  if (variant === CMD_GRAB_VARIANT.THROW) {
    const travel = throwTravelPx(balance, Math.max(0, grabber.grabApproachSpeed || 0));
    const isKill = !room.gameOver && shouldKillThrow(grabber, victim, travel, balance);
    grabber.cmdGrabIsKill = isKill;
    resolveThrow(grabber, victim, room, io, isKill, travel);
    return;
  }
  if (variant === CMD_GRAB_VARIANT.PULL) {
    const travel = pullTravelPx(balance);
    const isKill = !room.gameOver && shouldKillPull(grabber, victim, travel, balance);
    grabber.cmdGrabIsKill = isKill;
    resolvePull(grabber, victim, room, io, isKill, travel);
    return;
  }
  grabber.cmdGrabIsKill = false;
  beginDriveCarry(grabber, victim, room);
}

// ── DRIVE ───────────────────────────────────────────────────────────────────
function beginDriveCarry(grabber, victim, room) {
  const now = simNow(room);
  const dir = grabber.x < victim.x ? 1 : -1;
  // ── MOMENTUM TRANSFER: DRIVE SPENDS YOUR OWN SPEED ───────────────────────
  // Posture used to BE the distance function (110→250 by how broken they were)
  // with momentum bolted on as a +45px garnish. Momentum now buys the ceiling
  // as a bonus; the floor is a real pocket shove so the button is worth
  // pressing in close combat, where a run-in is hard to bring in.
  //
  // A standing drive is worth the profile floor (~160px, ~500ms). A full-slide
  // drive still rings out from centre. Driving INTO a fighter who is charging
  // back at you loses the bonus — that is what stops DRIVE being universally
  // correct. The belt Pull steals their line (side switch); dumping a
  // committed GRAB is Matador.
  const approach = Math.max(0, grabber.grabApproachSpeed || 0);
  const counterCharge = Math.max(0, grabber.cmdGrabVictimApproach || 0);
  const balance = grabber.cmdGrabKillBalance ?? grabber.cmdGrabVictimBalance;
  const distance = driveTravelPx(
    balance,
    approach,
    counterCharge,
    !!grabber.isGassed
  );

  grabber.cmdGrabPhase = CMD_PHASE.CARRY;
  grabber.cmdGrabPhaseStart = now;
  grabber.cmdGrabCarryStartX = grabber.x;
  grabber.cmdGrabCarryTargetX = grabber.x + dir * distance;
  // Same authored distance. Opens at the attempt slide, speeds up into
  // the shove-off. Duration follows that accel so a pin cannot sit for
  // a second-plus and dump a full tank.
  const carrySpeed = getDriveCarrySpeed(grabber);
  grabber.cmdGrabCarryDuration = Math.max(
    DRIVE_CARRY_MIN_MS,
    Math.min(
      getDriveCarryDurationMs(distance, carrySpeed) || CMD_DRIVE_CARRY_MS,
      DRIVE_CARRY_MAX_MS
    )
  );
  grabber.cmdGrabCarryDir = dir;
  // Drive has no startup beat, so the grip closes on the move: the grabber is already
  // advancing, and the victim simply advances a little slower until the gap is gone.
  grabber.cmdGrabCarryAttachFrom = Math.abs(grabber.x - victim.x);
  grabber.cmdGrabCarryAttachTo = attachDistanceFor(victim);
  // Drive rope KO is stamina-gated only (gassed / empty tank). Posture lethal
  // is throw/pull's job — drive must not skip slap/palm's composure game.
  // Refreshed live while pinned so a mid-push gas-out can still finish them.
  grabber.cmdGrabEdgeWaiver = !!victim.isGassed || victim.stamina <= 0;

  applyCarryPoses(grabber, victim);
}

// The carry's whole readability problem was that BOTH fighters resolved to the same
// hunched grabbing body, so a drive looked like two identical sprites gliding
// sideways with no indication of who was doing what.
//
//   pusher → grabbing body + isClinchCommittedDrive, which the client already
//            leans forward in CSS
//   pushed → clinch-planting body: braced, heels dug, weight going backwards
//
// Both bodies take the belt-arm overlay (the client keys that off the resolved
// sprite), so the grip still reads while the postures finally differ.
function applyCarryPoses(grabber, victim) {
  grabber.isClinchPushing = true;
  grabber.isGrabPushing = true;
  grabber.isClinchCommittedDrive = true;
  grabber.isAttemptingGrabThrow = false;
  grabber.isAttemptingPull = false;
  grabber.isClinchThrowing = false;
  grabber.isClinchPlanting = false;

  victim.isBeingGrabPushed = true;
  victim.isClinchPlanting = true;
  victim.isClinchPushing = false;
  victim.isClinchCommittedDrive = false;
  victim.isResistingThrow = false;
  victim.isResistingPull = false;
}

function advanceDriveCarry(grabber, victim, room, io, rooms, now, delta) {
  const duration = grabber.cmdGrabCarryDuration || CMD_DRIVE_CARRY_MS;
  const elapsed = now - (grabber.cmdGrabPhaseStart || now);
  const t = duration > 0 ? Math.min(1, elapsed / duration) : 1;
  // Accel from attempt speed into the shove-off. Contact stays v0;
  // the end is the grabee pushing the grabber off.
  const travelT = driveCarryTravelT(t, getDriveCarrySpeed(grabber));
  const startX = grabber.cmdGrabCarryStartX;
  const targetX = grabber.cmdGrabCarryTargetX;
  const dir = grabber.cmdGrabCarryDir || (grabber.x < victim.x ? 1 : -1);

  // Close the grip over the first slice of the carry rather than in a startup pause.
  const attachFrom = Number.isFinite(grabber.cmdGrabCarryAttachFrom)
    ? grabber.cmdGrabCarryAttachFrom
    : attachDistanceFor(victim);
  const attachTo = Number.isFinite(grabber.cmdGrabCarryAttachTo)
    ? grabber.cmdGrabCarryAttachTo
    : attachDistanceFor(victim);
  const cinchT =
    CMD_DRIVE_CINCH_FRACTION > 0 ? Math.min(1, t / CMD_DRIVE_CINCH_FRACTION) : 1;
  const attach =
    attachFrom + (attachTo - attachFrom) * (1 - Math.pow(1 - cinchT, 2));
  grabber.clinchAttachDistance = attach;
  victim.clinchAttachDistance = attach;

  grabber.x = Math.max(
    MAP_LEFT_BOUNDARY,
    Math.min(MAP_RIGHT_BOUNDARY, startX + (targetX - startX) * travelT)
  );
  let victimX = grabber.x + dir * attach;

  const ropeX = dir > 0 ? MAP_RIGHT_BOUNDARY : MAP_LEFT_BOUNDARY;
  const atRope = dir > 0 ? victimX >= ropeX : victimX <= ropeX;

  if (atRope && !room.gameOver) {
    // Always pin at the tawara. Ring-out only if already gassed / empty tank,
    // or if the clamp stamina tax gases them while carry is still running.
    // Carry-fraction auto-KO is retired — entry speed buys shove length, not
    // a free win (same clamp-unless-threshold idea as slap/palm).
    victim.x = ropeX;
    grabber.x = ropeX - dir * attach;
    const firstRopeContact = !grabber.cmdGrabAtRope;
    if (firstRopeContact) grabber.cmdGrabRopeSince = now;
    grabber.cmdGrabAtRope = true;
    grabber.isEdgePushing = true;
    victim.isBeingEdgePushed = true;

    const dtSec = Math.max(0, Number(delta) || 0) / 1000;
    if (dtSec > 0 && (victim.stamina || 0) > 0) {
      victim.stamina = Math.max(
        0,
        victim.stamina - CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC * dtSec
      );
      tryEnterGassed(victim, now);
    }

    grabber.cmdGrabEdgeWaiver =
      !!victim.isGassed || (victim.stamina || 0) <= 0;
    if (grabber.cmdGrabEdgeWaiver) {
      clearCommandGrabState(grabber);
      triggerRingOut(grabber, victim, room, io, rooms, dir);
      return;
    }

    // Fire on the exact clamp tick so client juice isn't waiting on a React
    // dirty-flag of isBeingEdgePushed (that path landed a beat late).
    if (firstRopeContact) {
      io.in(room.id).emit("rope_clamp", {
        source: "drive",
        x: ropeX,
        y: victim.y,
        dir,
        victimId: victim.id,
        grabberId: grabber.id,
      });
    }
  } else {
    grabber.isEdgePushing = false;
    victim.isBeingEdgePushed = false;
    victim.x = victimX;
  }

  applyCarryPoses(grabber, victim);
  grabber.movementVelocity = 0;
  victim.movementVelocity = 0;
  grabber.isStrafing = false;
  victim.isStrafing = false;
  grabber.y = GROUND_LEVEL;
  victim.y = GROUND_LEVEL;
  if (!victim.atTheRopesFacingDirection) victim.facing = dir > 0 ? 1 : -1;
  if (!grabber.atTheRopesFacingDirection) grabber.facing = dir > 0 ? -1 : 1;

  if (t >= 1) {
    // The pin lasts as long as the shove. A full tank survives it, so a grab
    // break during that window can be a wasted 30 stamina. The walk-out only
    // fires if the edge drain actually empties them before this release.
    releaseDrive(grabber, victim, room, io, dir);
  }
}

// Release opens a gap wider than GRAB_RANGE so there is no free re-grab and no free
// jab. BOTH fighters slide apart, which reads as a mutual break rather than the
// grabber inexplicably retreating from a shove they just won.
//
// The split is boundary-aware, not fixed at half each: whatever the victim cannot
// travel (because they are pinned against the tawara) is handed to the grabber. So a
// Victim pays GRAB_BREAK_STAMINA_COST and the pair splits that separation.
// Whoever is against the tawara cannot travel, so the other body takes that
// distance. Under-budget still breaks, and gases the breaker — it does not
// walk them out.
function resolveCommandGrabBreak(grabber, victim, room, io) {
  const now = simNow(room);
  const had = victim.stamina || 0;
  victim.stamina = Math.max(0, had - GRAB_BREAK_STAMINA_COST);
  if (had < GRAB_BREAK_STAMINA_COST) tryEnterGassed(victim, now);
  victim.grabBreakQueued = false;

  // Same shove as the end of a push: palms wind up in place, then the slide.
  // The together beat is before that, so the pair shakes while still gripped.
  const impactAt =
    now + GRAB_BREAK_TOGETHER_MS + CMD_DRIVE_RELEASE_IMPACT_MS;
  const dir = grabber.x <= victim.x ? 1 : -1;
  const half = GRAB_BREAK_FORCED_DISTANCE / 2;
  const clamp = (x) =>
    Math.max(MAP_LEFT_BOUNDARY, Math.min(MAP_RIGHT_BOUNDARY, x));
  const victimWant = victim.x + dir * half;
  const grabberWant = grabber.x - dir * half;
  let victimTarget = clamp(victimWant);
  let grabberTarget = clamp(grabberWant);
  const victimShort = Math.abs(victimWant - victimTarget);
  const grabberShort = Math.abs(grabberWant - grabberTarget);
  grabberTarget = clamp(grabberTarget - dir * victimShort);
  victimTarget = clamp(victimTarget + dir * grabberShort);

  clearCommandGrabState(grabber);

  const lockUntil = impactAt + GRAB_BREAK_TWEEN_DURATION;
  for (const [p, targetX] of [
    [grabber, grabberTarget],
    [victim, victimTarget],
  ]) {
    p.isGrabBreakGather = true;
    p.isGrabBreakSeparating = true;
    p.grabBreakSepStartTime = impactAt;
    p.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
    p.grabBreakStartX = p.x;
    p.grabBreakTargetX = targetX;
    // Quickest on the palm's active frame. Drive release keeps "shove"
    // (speed in the middle of the slide); a break that eases in reads as
    // the hands missing the bodies.
    p.grabBreakSepCurve = "break";
    p.movementVelocity = 0;
    if (!p.knockbackVelocity) p.knockbackVelocity = { x: 0, y: 0 };
    p.knockbackVelocity.x = 0;
    p.knockbackVelocity.y = 0;
    p.isStrafing = false;
    p.y = GROUND_LEVEL;
    p.inputLockUntil = Math.max(p.inputLockUntil || 0, lockUntil);
    p.actionLockUntil = Math.max(p.actionLockUntil || 0, lockUntil);
  }

  grabber.grabCooldown = true;
  setPlayerTimeout(
    grabber.id,
    () => {
      grabber.grabCooldown = false;
    },
    lockUntil - now,
    "grabBreakCooldown"
  );

  // Grip pose holds through the shake. Palms take over when the shove starts,
  // the same beat as the end of a push. The green burst lands on that hit.
  setPlayerTimeout(
    victim.id,
    () => {
      grabber.isGrabBreakGather = false;
      victim.isGrabBreakGather = false;
      cleanupGrabStates(grabber, victim);
      victim.isGrabSeparatePalm = true;
      // Playback clock for the palm poses. The slide starts
      // CMD_DRIVE_RELEASE_IMPACT_MS later — the client's SMEAR_END.
      victim.grabSeparatePalmStartSim = simNow(room);
      victim.isGrabBreakSeparating = true;
      grabber.isGrabBreakSeparating = true;
    },
    GRAB_BREAK_TOGETHER_MS,
    "grabBreakGather"
  );

  const breakId = `grab-break-${now}-${victim.id}`;
  const seamX = (victim.x + grabber.x) / 2;
  io.in(room.id).emit(
    "grab_break",
    attachCombatPresentation(
      {
        breakerId: victim.id,
        grabberId: grabber.id,
        breakerX: victim.x,
        grabberX: grabber.x,
        breakId,
        breakerPlayerNumber: victim.playerNumber || 1,
        effectDelayMs: GRAB_BREAK_TOGETHER_MS + CMD_DRIVE_RELEASE_IMPACT_MS,
        impactSimTime: impactAt,
      },
      buildClinchPresentation({
        interactionType: CLINCH_INTERACTION.GRAB_BREAK,
        clinchInstanceId: ensureClinchInstanceId(grabber, victim, now),
        actionInstanceId: breakId,
        initiator: victim,
        responder: grabber,
        outcome: "BREAK",
        contactX: seamX,
        contactY: CLINCH_EFFECT_MID_Y,
        movementX: dir,
        salt: "grab_break",
      })
    )
  );
}

function releaseDrive(grabber, victim, room, io, dir) {
  const now = simNow(room);
  if (victim && victim.tachiaiRopeAfterDrive) {
    victim.tachiaiRopeAfterDrive = false;
    const ropeX = dir > 0 ? MAP_RIGHT_BOUNDARY : MAP_LEFT_BOUNDARY;
    clearActionPoses(grabber, victim);
    clearCommandGrabState(grabber);
    cleanupGrabStates(grabber, victim);
    beginAtTheRopes(victim, ropeX, victim.facing);
    return;
  }
  const attach = grabber.clinchAttachDistance || attachDistanceFor(victim);
  const needed = Math.max(0, CMD_DRIVE_RELEASE_SEPARATION - attach);

  const clamp = (x) =>
    Math.max(MAP_LEFT_BOUNDARY, Math.min(MAP_RIGHT_BOUNDARY, x));
  // Victim continues away from the grabber; grabber gives a real step back.
  // 70/30 (CMD_DRIVE_RELEASE_VICTIM_SHARE) so the victim still travels farther
  // — an even split read as magnetic repulsion, and an 86/14 slap-parry split
  // glued the idle pusher to the ice while the victim launched.
  const victimWantX = victim.x + dir * (needed * CMD_DRIVE_RELEASE_VICTIM_SHARE);
  const victimTargetX = clamp(victimWantX);
  const victimShortfall = Math.abs(victimWantX - victimTargetX);
  // Boundary-aware, as before: whatever the victim cannot travel because they are
  // pinned against the tawara is handed to the grabber, so a rope pin survives.
  const grabberTargetX = clamp(
    grabber.x -
      dir *
        (needed * (1 - CMD_DRIVE_RELEASE_VICTIM_SHARE) + victimShortfall)
  );

  clearActionPoses(grabber, victim);
  clearCommandGrabState(grabber);
  cleanupGrabStates(grabber, victim);

  // Do not re-apply carry poses. The pusher stays in idle — the recovering
  // placeholder and the drive lean both read as leftover combat poses on a
  // fighter who is just being shoved off. The victim's palm animation is the
  // whole visual of the break. Gating is inputLockUntil + isGrabBreakSeparating
  // (and isRecovering on the victim only). Deliberately NOT isGrabSeparating:
  // that flag forces a front-facing pose that wins the sprite chain over
  // everything, including the palms.
  //
  // The slide waits for the palm's active / hit frame. Startup and smear play
  // in place at the grip; grabSeparationEase already no-ops t < 0, so stamping
  // grabBreakSepStartTime in the future holds them until impact.
  const impactAt = now + CMD_DRIVE_RELEASE_IMPACT_MS;
  for (const [p, targetX] of [
    [grabber, grabberTargetX],
    [victim, victimTargetX],
  ]) {
    p.isGrabBreakSeparating = true;
    p.grabBreakSepStartTime = impactAt;
    p.grabBreakSepDuration = CMD_DRIVE_RELEASE_TWEEN_MS;
    p.grabBreakStartX = p.x;
    p.grabBreakTargetX = targetX;
    // Build out of the palms instead of exploding off the first frame — see
    // CMD_DRIVE_RELEASE_TWEEN_MS. Every other user of this tween is modelling a
    // hit, so the shared default front-loads all its speed; only this opts out.
    p.grabBreakSepCurve = "shove";
    p.movementVelocity = 0;
    p.knockbackVelocity.x = 0;
    p.knockbackVelocity.y = 0;
    p.isStrafing = false;
  }

  // The loser shoves the winner off with both hands — the palm-thrust animation
  // as pure presentation, no hitbox, no move. Clock starts NOW so startup/smear
  // play while they are still gripped; the tween starts at impactAt, when the
  // client is on the active pose (GRAB_SEPARATE_PALM_ANIM.SMEAR_END).
  victim.isGrabSeparatePalm = true;

  // Attacker leaves ~60ms negative: past SLAP_STARTUP_MS so a jab would win the
  // exchange, but the gap means the practical result is a neutral reset with the
  // attacker holding spacing initiative — no free re-grab, no free hit.
  //
  // Recoveries and locks are anchored to IMPACT, not to carry-end. Starting them
  // at release while the slide waited 80ms left the defender free in grab range
  // mid-windup. The 60ms deficit is still the post-impact window.
  grabber.inputLockUntil = Math.max(
    grabber.inputLockUntil || 0,
    impactAt + CMD_DRIVE_ATTACKER_RECOVERY_MS
  );
  victim.inputLockUntil = Math.max(
    victim.inputLockUntil || 0,
    impactAt + CMD_DRIVE_DEFENDER_RECOVERY_MS
  );
  grabber.actionLockUntil = Math.max(
    grabber.actionLockUntil || 0,
    impactAt + CMD_DRIVE_ATTACKER_RECOVERY_MS
  );
  // Pusher: idle. isGrabBreakSeparating already blocks strafe; do not set
  // isRecovering or the recovering placeholder wins the sprite chain.
  grabber.isRecovering = false;
  grabber.recoveryStartTime = 0;
  grabber.recoveryDuration = 0;
  beginGrabRecovery(victim, CMD_DRIVE_DEFENDER_RECOVERY_MS, impactAt);

  correctFacingAfterGrabOrThrow(grabber, victim);

  // Safety: if any carry pose leaked through cleanup, drop it mid-slide rather
  // than on the frame the motion stops (that coincidence reads as a teleport).
  setPlayerTimeout(
    grabber.id,
    () => {
      clearActionPoses(grabber, victim);
      grabber.isClinchCommittedDrive = false;
      victim.isClinchPlanting = false;
      grabber.isClinchPlanting = false;
    },
    CMD_DRIVE_RELEASE_IMPACT_MS +
      Math.round(CMD_DRIVE_RELEASE_TWEEN_MS * CMD_DRIVE_RELEASE_POSE_DROP_FRACTION),
    "cmdDriveRelease"
  );

  io.in(room.id).emit("grab_separate", {
    grabberId: grabber.id,
    opponentId: victim.id,
    grabberX: grabber.x,
    opponentX: victim.x,
  });
}

// ── THROW ───────────────────────────────────────────────────────────────────
// Setup dump: stamped path (origin / land / ricochet) + chase unlock.
// Kill throw still uses the cinematic arc in index.js.
function resolveThrow(grabber, victim, room, io, isKill, travelPx) {
  const now = simNow(room);
  const balance = grabber.cmdGrabKillBalance ?? grabber.cmdGrabVictimBalance;
  const throwDir = grabber.x < victim.x ? 1 : -1;
  const toss = isKill ? null : describeThrowToss(balance);
  const approach = Math.max(0, grabber.grabApproachSpeed || 0);
  const travel =
    Number.isFinite(travelPx) ? travelPx : throwTravelPx(balance, approach);
  const plan = isKill ? null : planSetupThrow(grabber, victim, travel, balance);
  const duration = isKill
    ? CLINCH_KILL_THROW_DURATION_MS
    : plan.durationMs;
  const presentationFacing =
    grabber.facing === 1 || grabber.facing === -1 ? grabber.facing : -1;

  clearActionPoses(grabber, victim);
  clearCommandGrabState(grabber);
  cleanupGrabStates(grabber, victim);
  clearSetupThrowFlags(grabber);
  clearSetupThrowFlags(victim);

  grabber.isThrowing = true;
  grabber.isClinchKillThrow = isKill;
  const killLandsOffDohyo = isKill && killThrowLandsOffDohyo(grabber, victim);
  grabber.clinchKillThrowOffDohyo = killLandsOffDohyo;
  victim.clinchKillThrowOffDohyo = killLandsOffDohyo;
  grabber.clinchThrowArcDistance = isKill ? 0 : travel;
  grabber.clinchThrowArcHeight = isKill ? 0 : toss.arcHeight;
  grabber.throwTossPower = isKill ? 0 : toss.power;
  grabber.throwTossDurationMs = isKill ? 0 : duration;
  victim.throwTossPower = isKill ? 0 : toss.power;
  victim.throwTossDurationMs = isKill ? 0 : duration;
  grabber.throwStartTime = now;
  grabber.throwEndTime = now + duration;
  grabber.throwOpponent = victim.id;
  grabber.throwingFacingDirection = throwDir;
  grabber.movementVelocity = 0;
  grabber.grabMovementVelocity = 0;
  // Launch hitstop is the toss beat. After it the thrower holds the toss
  // pose, then a buffered slide/strike comes out — first-frame slide is
  // timed to slap-tip spacing at land, not a bury.
  grabber.actionLockUntil = now;
  if (!isKill && plan) {
    grabber.throwSetupChase = true;
    const chaseLock = chaseLockMsFor(
      getEffectiveMoveSpeedMult(grabber),
      plan.durationMs
    );
    grabber.throwChaseUnlockAt = now + chaseLock;
    grabber.actionLockUntil = now + chaseLock;
    grabber.throwRicochet = plan.ricochet;
    grabber.throwOriginX = plan.originX;
    grabber.throwStartX = plan.startX;
    grabber.throwLandX = plan.landX;
    grabber.throwHitX = plan.hitX;
    grabber.throwBounceHeight = plan.bounceHeight;
    grabber.throwRicochetHitAt = plan.hitAt;
    grabber.throwRicochetHitEmitted = false;
  }

  if (isActionFacingOwnershipV2Enabled()) {
    const throwerId = mintActionFacingInstanceId(grabber, ACTION_FACING_OWNER.THROWER);
    grabber.throwFacingInstanceId = throwerId;
    acquireActionFacingLock(grabber, {
      ownerType: ACTION_FACING_OWNER.THROWER,
      ownerInstanceId: throwerId,
      direction: presentationFacing,
      reason: ACTION_FACING_REASON.THROW,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
  }

  // Setup path is stamped. Do not park the victim on the margin — that was
  // the invisible wall. Ricochet owns the tawara case.

  clearAllActionStates(victim);
  endPerfectParryStun(victim);
  // clearAllActionStates wipes presentation fields — restamp after.
  grabber.throwTossPower = isKill ? 0 : toss.power;
  grabber.throwTossDurationMs = isKill ? 0 : toss.durationMs;
  victim.throwTossPower = isKill ? 0 : toss.power;
  victim.throwTossDurationMs = isKill ? 0 : toss.durationMs;
  victim.isBeingThrown = true;
  victim.isHit = true;
  victim.beingThrownFacingDirection = victim.facing;
  if (isActionFacingOwnershipV2Enabled()) {
    const victimId = mintActionFacingInstanceId(victim, ACTION_FACING_OWNER.THROW_VICTIM);
    victim.throwVictimFacingInstanceId = victimId;
    acquireActionFacingLock(victim, {
      ownerType: ACTION_FACING_OWNER.THROW_VICTIM,
      ownerInstanceId: victimId,
      direction: victim.facing,
      reason: ACTION_FACING_REASON.THROW,
      allowDirectionUpdate: false,
      supersede: true,
      syncLegacy: false,
    });
  }
  victim.inputLockUntil = Math.max(victim.inputLockUntil || 0, now + duration + 100);

  // Launch freeze BEFORE the arc starts: sim time is frozen during it, so the
  // windup pose holds on screen and the arc begins cleanly after the beat.
  if (isKill) {
    triggerHitstopAndEmit(io, room, CMD_THROW_LAUNCH_HITSTOP_MS, "clinch_throw");
    emitThrottledScreenShake(room, io, { type: "grab_clash", scale: 1.05, force: true });
    victim.isClinchKillThrowVictim = true;
    victim.clinchKillThrowOffDohyo = !!grabber.clinchKillThrowOffDohyo;
    const launchId = `kill-throw-${now}-${grabber.id}`;
    const clinchId = ensureClinchInstanceId(grabber, victim, now);
    io.in(room.id).emit(
      "clinch_kill_throw",
      attachCombatPresentation(
        {
          victimId: victim.id,
          throwerId: grabber.id,
          victimX: victim.x,
          hitstopMs: 0,
          durationMs: duration,
          throwDir,
          launchId,
        },
        buildClinchPresentation({
          interactionType: CLINCH_INTERACTION.KILL_THROW_LAUNCH,
          clinchInstanceId: clinchId,
          actionInstanceId: launchId,
          initiator: grabber,
          responder: victim,
          outcome: "LAUNCH",
          throwType: "throw",
          contactX: victim.x,
          contactY: victim.y,
          movementX: throwDir,
          salt: "kill_launch",
        })
      )
    );
    return;
  }

  stampSetupThrowFlight(
    victim,
    plan,
    {
      durationMs: duration,
      arcHeight: toss.arcHeight,
      power: toss.power,
    },
    now
  );

  triggerHitstopAndEmit(io, room, toss.launchHitstopMs, "clinch_throw");
  const tossId = `throw-toss-${now}-${grabber.id}`;
  const clinchId = ensureClinchInstanceId(grabber, victim, now);
  io.in(room.id).emit(
    "throw_toss",
    attachCombatPresentation(
      {
        victimId: victim.id,
        throwerId: grabber.id,
        x: victim.x,
        y: victim.y,
        dir: throwDir,
        power: toss.power,
        durationMs: duration,
        travelPx: travel,
        arcHeight: toss.arcHeight,
        hitstopMs: toss.launchHitstopMs,
        ricochet: !!plan.ricochet,
        landX: plan.landX,
      },
      buildClinchPresentation({
        interactionType: CLINCH_INTERACTION.THROW_TOSS,
        clinchInstanceId: clinchId,
        actionInstanceId: tossId,
        initiator: grabber,
        responder: victim,
        outcome: "LAUNCH",
        throwType: "throw",
        contactX: victim.x,
        contactY: victim.y,
        movementX: throwDir,
        salt: "throw_toss",
      })
    )
  );
  // Shake lives on the landing (`throw_landing`) — a launch rattle stole
  // the plant and made the hop feel like two impacts.
}

// ── PULL ────────────────────────────────────────────────────────────────────
// Reuses the surviving pull tween in index.js (isGrabBreakSeparating +
// isBeingPullReversaled), including the boundary swap for a puller with their own
// back to the wall and the kill-pull belly-slide.
function resolvePull(grabber, victim, room, io, isKill, travelPx) {
  const now = simNow(room);
  const balance = grabber.cmdGrabKillBalance ?? grabber.cmdGrabVictimBalance;
  const pullDirection = victim.x < grabber.x ? 1 : -1;
  // Belt tug: posture is the distance function. Their run-in is Matador's dump.
  // A trip still uses that yank — not a canned belly-slide from wherever they
  // stand. The funeral pose waits until they actually cross the straw.
  const pullDist = Number.isFinite(travelPx) ? travelPx : pullTravelPx(balance);
  const yank = describePullYank(balance);
  let tweenDuration = isKill ? CLINCH_KILL_PULL_TWEEN_DURATION : yank.durationMs;
  let lockMs = isKill ? CLINCH_KILL_PULL_INPUT_LOCK_MS : yank.durationMs;
  const clampRead = getPullBoundaryRead(grabber, victim, pullDist);
  let targetX = isKill
    ? pullTripTargetX(grabber, victim, pullDist)
    : grabber.x + pullDirection * pullDist;

  const leftBound = MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN;
  const rightBound = MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN;
  // Same detector as the kill check. A lethal clamp-reach must NEVER fall
  // through to the clarity swap — that was eating the rope trip.
  const isBoundaryPull = !isKill && clampRead.noRoomForSideSwitch;

  let actorTweenTargetX = null;
  if (isBoundaryPull) {
    const actorOriginalX = grabber.x;
    const targetOriginalX = victim.x;
    targetX = Math.max(leftBound, Math.min(actorOriginalX, rightBound));
    actorTweenTargetX = targetOriginalX;
    tweenDuration = CLINCH_PULL_SWAP_TWEEN_DURATION;
    lockMs = CLINCH_PULL_SWAP_TWEEN_DURATION;
  }

  clearActionPoses(grabber, victim);
  clearCommandGrabState(grabber);
  cleanupGrabStates(grabber, victim);

  victim.isBeingPullReversaled = true;
  victim.pullReversalPullerId = grabber.id;
  victim.isGrabBreakSeparating = true;
  victim.grabBreakSepStartTime = now;
  victim.grabBreakSepDuration = tweenDuration;
  victim.grabBreakStartX = victim.x;
  victim.grabBreakTargetX = targetX;
  if (!isKill && !isBoundaryPull) {
    victim.grabBreakSepCurve = yank.curve;
    victim.pullYankPower = yank.power;
    grabber.pullYankPower = yank.power;
    // You take their spot while they go past yours. Same movie at the rope
    // and mid-ring; the rope case is just the one that runs out of ice.
    const pocketX = victim.x;
    grabber.isGrabBreakSeparating = true;
    grabber.grabBreakSepStartTime = now;
    grabber.grabBreakSepDuration = tweenDuration;
    grabber.grabBreakStartX = grabber.x;
    grabber.grabBreakTargetX = pocketX;
    grabber.grabBreakSepCurve = yank.curve;
  } else {
    victim.pullYankPower = 0;
    grabber.pullYankPower = 0;
  }

  if (isBoundaryPull) {
    victim.isBoundaryPullSwap = true;
    grabber.isBoundaryPullSwap = true;
    grabber.isGrabBreakSeparating = true;
    grabber.grabBreakSepStartTime = now;
    grabber.grabBreakSepDuration = tweenDuration;
    grabber.grabBreakStartX = grabber.x;
    grabber.grabBreakTargetX = actorTweenTargetX;
  }

  victim.movementVelocity = 0;
  grabber.movementVelocity = 0;
  victim.isStrafing = false;
  grabber.isStrafing = false;

  // The yank IS the lock. Both sit on the same clock so settle is +0 — same
  // contract as a slap. Kill keeps its own cinematic lock, which may outlast
  // the slide; non-kill matches the tween so a leftover tail cannot jail the
  // puller in grab range after the victim is already free.
  const lockUntil = now + (isKill ? lockMs : tweenDuration);
  victim.inputLockUntil = Math.max(victim.inputLockUntil || 0, lockUntil);
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, lockUntil);
  victim.actionLockUntil = Math.max(victim.actionLockUntil || 0, lockUntil);
  grabber.actionLockUntil = Math.max(grabber.actionLockUntil || 0, lockUntil);

  // Only the body being dragged keeps facing. The puller tracks live X so
  // they turn as the victim crosses, and their next move is not stale.
  releaseGrabStartupFacingLock(grabber);
  grabber.grabFacingDirection = null;
  grabber.pullFacingDirection = null;
  if (!victim.atTheRopesFacingDirection) {
    victim.pullFacingDirection = victim.facing;
    if (isActionFacingOwnershipV2Enabled()) {
      const id = mintActionFacingInstanceId(victim, ACTION_FACING_OWNER.PULL);
      victim.pullFacingInstanceId = id;
      acquireActionFacingLock(victim, {
        ownerType: ACTION_FACING_OWNER.PULL,
        ownerInstanceId: id,
        direction: victim.facing,
        reason: ACTION_FACING_REASON.COMMIT,
        allowDirectionUpdate: false,
        supersede: true,
        syncLegacy: false,
      });
    }
  }
  // cleanupGrabStates dropped the startup pull pose — re-arm it for the yank.
  grabber.isAttemptingPull = true;
  // Keep the tell duration so the client does not fall back to the 600ms
  // authored cycle and restart the windup mid-yank. `forwards` holds the last
  // tug frame through the travel.
  stampGrabTellDuration(grabber, CMD_GRAB_VARIANT.PULL, false);

  if (isKill) {
    // Prediction only: unclamp and skip the swap. They stay standing until
    // index.js sees them cross the map line, then armPullTrip plays the fall.
    victim.pendingPullTrip = true;
    victim.isClinchKillPullVictim = false;
  }

  // Launch freeze so the yank animation reads before the victim travels.
  // Weight is the TAKE/SLIDE curve — a mid-yank freeze still reads as a hitch.
  triggerHitstopAndEmit(io, room, CMD_PULL_LAUNCH_HITSTOP_MS, "clinch_throw");
  if (!isBoundaryPull) {
    const yankId = `pull-yank-${now}-${grabber.id}`;
    const clinchId = ensureClinchInstanceId(grabber, victim, now);
    const hops = yank.hops;
    io.in(room.id).emit(
      "pull_yank",
      attachCombatPresentation(
        {
          victimId: victim.id,
          pullerId: grabber.id,
          x: victim.x,
          y: victim.y,
          dir: pullDirection,
          power: yank.power,
          durationMs: tweenDuration,
          travelPx: pullDist,
          hopDelay: hops.hopDelay,
          hopCount: hops.hopCount,
          hopHeights: hops.hopHeights,
          isKill: !!isKill,
          isBoundarySwap: false,
        },
        buildClinchPresentation({
          interactionType: CLINCH_INTERACTION.PULL_YANK,
          clinchInstanceId: clinchId,
          actionInstanceId: yankId,
          initiator: grabber,
          responder: victim,
          outcome: isKill ? "LAUNCH" : "RESOLVED",
          throwType: "pull",
          contactX: victim.x,
          contactY: victim.y,
          movementX: pullDirection,
          salt: "pull_yank",
        })
      )
    );
    emitThrottledScreenShake(room, io, {
      type: "pull_yank",
      scale: yank.shakeScale,
      dirX: pullDirection,
      force: true,
    });
  } else {
    emitThrottledScreenShake(room, io, { type: "grab_clash", force: true });
  }
}

// ── SIMULTANEOUS GRAB ───────────────────────────────────────────────────────
// Both startups overlapped, so nobody won the initiate. Deliberately bad for both
// — a brief belt-grip clash, a small mutual pushback, and the ordinary grab whiff
// recovery — so neither player can fish for it as a free reset the way a mutual
// clinch entry could be fished for.
function executeCommandGrabClash(p1, p2, room, io) {
  const now = simNow(room);

  // Force the grip overlap FIRST. Both fighters lunged into each other, so they
  // should collide into clinch spacing and stop dead — pushing them apart on the
  // same tick left a wide gap where the collision should have been.
  const left = p1.x <= p2.x ? p1 : p2;
  const right = left === p1 ? p2 : p1;
  const attach = Math.min(attachDistanceFor(left), attachDistanceFor(right));
  const mid = Math.max(
    MAP_LEFT_BOUNDARY + attach / 2,
    Math.min(MAP_RIGHT_BOUNDARY - attach / 2, (p1.x + p2.x) / 2)
  );
  left.x = mid - attach / 2;
  right.x = mid + attach / 2;

  for (const p of [p1, p2]) {
    // Keep the attempt facing freeze through the clash pose and whiff recovery.
    // Unlock only when grabWhiffRecovery fires — not at clash start.
    p.isGrabStartup = false;
    p.isGrabbingMovement = false;
    // isWhiffingGrab holds every gameplay gate on its own (movement, action, tech,
    // combat volume). isGrabWhiffRecovery is POSE-relevant and deliberately deferred:
    // it forces the recovering sprite, and for the clash beat both fighters should
    // be locked together in the belt grip instead. It arms when that beat ends.
    p.isWhiffingGrab = true;
    p.grabMovementVelocity = 0;
    p.movementVelocity = 0;
    p.isStrafing = false;
    p.grabState = GRAB_STATES.INITIAL;
    p.grabAttemptType = null;
    p.currentAction = null;
    p.y = GROUND_LEVEL;
    // Belt grip + push pose: the clash reads as two fighters colliding into a grip
    // and being stopped dead, which is what the missing shove is meant to convey.
    p.isClinchBeltHolding = true;
    p.isClinchPushing = true;
    p.grabCooldown = true;
    p.clinchAttachDistance = attach;
    p.actionLockUntil = Math.max(p.actionLockUntil || 0, now + GRAB_WHIFF_RECOVERY_MS);
    clearGrabVariant(p);
    clearCommandGrabState(p);
    timeoutManager.clearPlayerSpecific(p.id, "grabMovementTimeout");
  }

  // Freeze then shake: the collision needs to be felt, since the ABSENCE of a shove
  // is the only thing telling both players nobody won the initiate.
  triggerHitstopAndEmit(io, room, CMD_GRAB_CLASH_HITSTOP_MS, "grab");
  emitThrottledScreenShake(room, io, { type: "grab_clash", force: true });

  for (const p of [p1, p2]) {
    setPlayerTimeout(
      p.id,
      () => {
        // Grip beat over — throw them apart and drop to the whiff-recovery pose.
        p.isClinchBeltHolding = false;
        p.isClinchPushing = false;
        p.isGrabWhiffRecovery = true;
        p.clinchAttachDistance = 0;
        const away = p === left ? -1 : 1;
        const sepNow = simNow(room);
        p.isGrabSeparating = true;
        p.isGrabBreakSeparating = true;
        p.grabBreakSepStartTime = sepNow;
        p.grabBreakSepDuration = CMD_GRAB_CLASH_SEPARATE_MS;
        p.grabBreakStartX = p.x;
        p.grabBreakTargetX = Math.max(
          MAP_LEFT_BOUNDARY,
          Math.min(MAP_RIGHT_BOUNDARY, p.x + away * (CMD_GRAB_CLASH_PUSHBACK / 2))
        );
        p.movementVelocity = 0;
        p.isStrafing = false;
        setPlayerTimeout(
          p.id,
          () => {
            p.isGrabSeparating = false;
          },
          CMD_GRAB_CLASH_SEPARATE_MS,
          "cmdGrabClashSeparate"
        );
      },
      CMD_GRAB_CLASH_POSE_MS,
      "cmdGrabClashPose"
    );
    setPlayerTimeout(
      p.id,
      () => {
        endGrabWhiffRecovery(p);
      },
      GRAB_WHIFF_RECOVERY_MS,
      "grabWhiffRecovery"
    );
  }

  const clashId = `grab-clash-${now}-${p1.id}`;
  const seamX = (p1.x + p2.x) / 2;
  const clinchId = ensureClinchInstanceId(p1, p2, now);
  io.in(room.id).emit(
    "clinch_callout",
    attachCombatPresentation(
      {
        type: "grab_tech",
        actorId: p1.id,
        targetId: p2.id,
        calloutId: clashId,
        x: seamX,
        techId: clashId,
      },
      buildClinchPresentation({
        interactionType: CLINCH_INTERACTION.CLINCH_TECH,
        clinchInstanceId: clinchId,
        actionInstanceId: clashId,
        initiator: p1,
        responder: p2,
        outcome: "TECH",
        contactX: seamX,
        contactY: CLINCH_EFFECT_MID_Y,
        salt: "grab_clash",
      })
    )
  );
}

module.exports = {
  CMD_PHASE,
  beginCommandGrab,
  updateCommandGrab,
  executeCommandGrabClash,
  clearCommandGrabState,
  postureScaled,
  postureLerp,
  grabPostureEase,
  connectStartupMsFor,
  grabTellAnimMs,
  driveTravelPx,
  throwTravelPx,
  planSetupThrow,
  pullTravelPx,
  throwWouldExit,
  pullWouldExit,
  getPullBoundaryRead,
  pullTripTargetX,
  maybeArmPullTrip,
  shouldKillThrow,
  shouldKillPull,
  isPostureLethal,
  predictedThrowLandX,
  predictedPullTargetX,
};

// ============================================
// COMMAND GRAB — POST-CONNECT AUTHORITY
// ============================================
// Owns everything from grab connect onward. Replaced
// the mutual clinch subgame (Drive/Plant/Jolt/Throw/Pull/Brace/Open/Deep Grip)
// with three discrete outcomes chosen at input time:
//
//   DRIVE  carry the victim toward the rope, then release
//   PULL   yank them past you (side switch / corner escape)
//   THROW  arc them away
//
// Shape after connect:
//
//   connect ──(HITSTOP_GRAB_MS, sim clock frozen)──▶ STARTUP ──▶ resolve
//                                                   per-variant     │
//                                    DRIVE 0ms ───────────────────▶ CARRY ──▶ release
//                                    PULL  200 / kill 400
//                                    THROW 280 / kill 520
//
// The STARTUP beat is the belt-grip read: both fighters hold the grip pose while
// the variant's tell plays. It is uninterruptible — there is no post-connect Grab
// Break and no Brace — so its only job is legibility. Drive has none (a shove
// must start moving). Pull/Throw hold long enough for the placeholder windup to
// finish; kill versions hold longer so the finisher reads before travel.
//
// Throw / pull end the round below the lethal posture line
// (CLINCH_THROW_KILL_THRESHOLD, measured at connect). Drive does NOT — its rope
// KO is stamina-gated (gassed / empty tank), so slap/palm own the posture finish
// and drive owns the tank finish. A gassed attacker still gets a shorter carry.
//
// The Drive carry is a SERVER-STAMPED TWEEN (start time, duration, start X, target
// X) rather than per-tick input-driven displacement. Distance is still authored
// (momentum + posture). The curve opens at latch speed and speeds up into
// the shove-off (grabee pushing the grabber off). Known at connect so the
// client can interpolate.
//
// NOTE ON CONSTANT NAMES: throw/pull geometry still reads from CLINCH_*
// constants. Those values are tuned and shared with the surviving throw-arc and
// pull-tween simulators in index.js; renaming them belongs in the deletion pass,
// not here, so it happens once instead of twice.

const {
  CMD_GRAB_VARIANT,
  CMD_GRAB_CONNECT_STARTUP_MS,
  CMD_GRAB_KILL_CONNECT_STARTUP_MS,
  CMD_GRAB_CONNECT_HITSTOP_MS,
  CMD_GRAB_CINCH_MS,
  HITSTOP_GRAB_MS,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  CMD_PULL_LAUNCH_HITSTOP_MS,
  CMD_GRAB_CINCH_GRABBER_SHARE,
  CMD_GRAB_STAMINA_COST,
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
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
  CMD_THROW_RECOVERY_TAIL_MS,
  CMD_GRAB_CLASH_HITSTOP_MS,
  CMD_GRAB_CLASH_POSE_MS,
  CMD_GRAB_CLASH_PUSHBACK,
  CMD_GRAB_CLASH_SEPARATE_MS,
  CLINCH_ATTACHED_DISTANCE,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_DISTANCE_MIN,
  CLINCH_THROW_DISTANCE_MAX,
  CLINCH_THROW_ARC_HEIGHT_MIN,
  CLINCH_THROW_ARC_HEIGHT_MAX,
  CLINCH_THROW_DURATION_MIN_MS,
  CLINCH_THROW_DURATION_MAX_MS,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CMD_PULL_TWEEN_MS,
  CMD_PULL_INPUT_LOCK_MS,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_PULL_DISTANCE,
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
} = require("./gameUtils");

const {
  correctFacingAfterGrabOrThrow,
  endGrabWhiffRecovery,
} = require("./grabMechanics");
const { cleanupGrabStates, handleWinCondition } = require("./gameFunctions");
const { triggerRingOut } = require("./ringOutPush");
const { clearGrabVariant } = require("./commandGrabInput");
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

// Posture is no longer the distance FUNCTION for grabs — momentum is. It is a
// multiplier on top, so a battered opponent travels further from the same
// input but the input still has to be earned with speed.
const GRAB_POSTURE_MULT_MAX = 1.35;

// How much of the victim's counter-charge is subtracted from a DRIVE. Driving
// into someone charging back at you is driving into their force; it should
// barely move them, which is what makes PULL the correct answer there.
const DRIVE_COUNTER_CHARGE = 0.6;

// Absolute cap on a drive carry, after momentum AND posture have both applied.
// Sits just above the centre-to-rope distance (297.5px) so a perfect
// max-momentum drive from dead centre is exactly lethal — a clean threshold —
// without the combined multipliers running away past it.
const DRIVE_MAX_CARRY_PX = 310;

// Safety rails only. Live duration is D·p/v0 (accel from attempt speed).
const DRIVE_CARRY_MIN_MS = 180;
const DRIVE_CARRY_MAX_MS = 1100;

const CMD_PHASE = {
  STARTUP: "startup",
  CARRY: "carry",
};

// Posture → travel lerp. 0 at full posture, 1 at the lethal line, so a battered
// opponent travels further from the same input. Shared by Drive / Throw / Pull.
function postureScaled(balance, minValue, maxValue) {
  const bal = Math.max(
    CLINCH_THROW_KILL_THRESHOLD,
    Math.min(BALANCE_MAX, typeof balance === "number" ? balance : BALANCE_MAX)
  );
  const span = Math.max(1, BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD);
  const t = 1 - (bal - CLINCH_THROW_KILL_THRESHOLD) / span;
  return Math.round(minValue + (maxValue - minValue) * Math.max(0, Math.min(1, t)));
}

/**
 * Unrounded form of `postureScaled`, for MULTIPLIERS rather than pixels.
 * `postureScaled` rounds because it was built to return distances — feeding it
 * a 1.0→1.35 range silently rounded every result back to exactly 1, which
 * disabled posture scaling on grabs entirely.
 */
function postureLerp(balance, minValue, maxValue) {
  const bal = Math.max(
    CLINCH_THROW_KILL_THRESHOLD,
    Math.min(BALANCE_MAX, typeof balance === "number" ? balance : BALANCE_MAX)
  );
  const span = Math.max(1, BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD);
  const t = 1 - (bal - CLINCH_THROW_KILL_THRESHOLD) / span;
  return minValue + (maxValue - minValue) * Math.max(0, Math.min(1, t));
}

function attachDistanceFor(victim) {
  return CLINCH_ATTACHED_DISTANCE * (victim.sizeMultiplier || 1);
}

function connectStartupMsFor(variant, isKill = false) {
  if (variant === CMD_GRAB_VARIANT.DRIVE) return 0;
  const table = isKill
    ? CMD_GRAB_KILL_CONNECT_STARTUP_MS
    : CMD_GRAB_CONNECT_STARTUP_MS;
  const ms = table[variant];
  return Number.isFinite(ms) ? ms : CMD_GRAB_CONNECT_STARTUP_MS.throw;
}

function connectHitstopMsFor(variant) {
  const ms = CMD_GRAB_CONNECT_HITSTOP_MS[variant];
  return Number.isFinite(ms) ? ms : 0;
}

// Wall-clock length of the tell, including the connect freeze. CSS animations
// run on wall time even while simTime is frozen, so this is what the client
// must play to finish the windup on the resolve frame.
function grabTellAnimMs(variant, isKill = false) {
  const startup = connectStartupMsFor(variant, isKill);
  if (startup <= 0) return 0;
  return HITSTOP_GRAB_MS + connectHitstopMsFor(variant) + startup;
}

function stampGrabTellDuration(grabber, variant, isKill) {
  if (!grabber) return;
  grabber.clinchThrowAnimMs = grabTellAnimMs(variant, isKill);
}

function cinchMsFor(variant) {
  if (variant === CMD_GRAB_VARIANT.DRIVE) return 0;
  return CMD_GRAB_CINCH_MS;
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
  player.cmdGrabConnectGap = 0;
  player.cmdGrabEdgeWaiver = false;
  player.cmdGrabCinchFromX = null;
  player.cmdGrabCinchToX = null;
  player.cmdGrabVictimCinchFromX = null;
  player.cmdGrabVictimCinchToX = null;
}

// Called at grab connect (from the index.js tick loop). The victim's posture is
// snapshotted here, BEFORE the variant's chip, so the lethal decision matches the
// danger line the HUD was advertising when the player committed.
function beginCommandGrab(grabber, victim, room, io) {
  if (!grabber || !victim) return;
  // Latch speed is this frame's slide. Index zeros the live impulse on
  // connect; if it is still here (harness / same-tick), write it onto
  // grabAttemptSpeed so Drive can decel from the real catch, not the stamp.
  if (Math.abs(grabber.grabMovementVelocity || 0) > 0) {
    grabber.grabAttemptSpeed = getDriveCarrySpeed(grabber);
  }
  const now = simNow(room);
  const variant = grabber.grabVariant || CMD_GRAB_VARIANT.DRIVE;

  grabber.cmdGrabPhase = CMD_PHASE.STARTUP;
  grabber.cmdGrabPhaseStart = now;
  grabber.cmdGrabVariant = variant;
  grabber.cmdGrabKillBalance =
    typeof victim.balance === "number" ? victim.balance : BALANCE_MAX;
  grabber.cmdGrabIsKill =
    variant !== CMD_GRAB_VARIANT.DRIVE &&
    grabber.cmdGrabKillBalance < CLINCH_THROW_KILL_THRESHOLD;
  grabber.cmdGrabAtRope = false;

  stampGrabTellDuration(grabber, variant, grabber.cmdGrabIsKill);

  grabber.stamina = Math.max(0, (grabber.stamina || 0) - CMD_GRAB_STAMINA_COST);

  const chip =
    variant === CMD_GRAB_VARIANT.THROW
      ? CMD_THROW_POSTURE_CHIP
      : variant === CMD_GRAB_VARIANT.PULL
        ? CMD_PULL_POSTURE_CHIP
        : CMD_DRIVE_POSTURE_CHIP;
  applyBalanceDamage(victim, chip, now);
  grabber.cmdGrabVictimBalance =
    typeof victim.balance === "number" ? victim.balance : BALANCE_MAX;
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

  // Belt grip on both, then a real THUNK so the grip registers before the variant's
  // animation plays. Sim time is frozen for the freeze, so the read beat below
  // starts after it rather than being eaten by it.
  grabber.isClinchBeltHolding = true;
  victim.isClinchBeltHolding = true;
  stampCinch(grabber, victim);
  const gap = grabber.cmdGrabConnectGap;
  grabber.clinchAttachDistance = gap;
  victim.clinchAttachDistance = gap;

  applyStartupPoses(grabber, victim);
  // Every grab already gets HITSTOP_GRAB_MS from the shared connect path; this is the
  // extra weight on top, and Drive deliberately adds none — a shove must start moving.
  const extraFreeze = connectHitstopMsFor(variant);
  if (extraFreeze > 0) {
    triggerHitstopAndEmit(io, room, extraFreeze, "grab");
  }
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
  stampGrabTellDuration(grabber, variant, !!grabber.cmdGrabIsKill);
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

  if (grabber.cmdGrabPhase === CMD_PHASE.STARTUP) {
    const startupMs = connectStartupMsFor(
      grabber.cmdGrabVariant,
      !!grabber.cmdGrabIsKill
    );
    // A zero-length startup must not run the cinch — with t forced to 1 it would
    // snap the grip closed on the first tick, which is the teleport this whole
    // mechanism exists to avoid. Drive closes its grip during the carry instead.
    if (startupMs > 0) {
      applyStartupPoses(grabber, victim);
      applyCinch(grabber, victim, elapsed, cinchMsFor(grabber.cmdGrabVariant));
    }
    if (elapsed >= startupMs) {
      resolveVariant(grabber, victim, room, io, rooms);
    }
    return;
  }

  if (grabber.cmdGrabPhase === CMD_PHASE.CARRY) {
    advanceDriveCarry(grabber, victim, room, io, rooms, now, delta);
    return;
  }
}

function resolveVariant(grabber, victim, room, io, rooms) {
  const variant = grabber.cmdGrabVariant || CMD_GRAB_VARIANT.DRIVE;
  const isKill =
    (grabber.cmdGrabKillBalance ?? BALANCE_MAX) < CLINCH_THROW_KILL_THRESHOLD &&
    !room.gameOver;

  if (variant === CMD_GRAB_VARIANT.THROW) {
    resolveThrow(grabber, victim, room, io, isKill);
    return;
  }
  if (variant === CMD_GRAB_VARIANT.PULL) {
    resolvePull(grabber, victim, room, io, isKill);
    return;
  }
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
  const effectiveApproach = Math.max(
    0,
    approach - DRIVE_COUNTER_CHARGE * counterCharge
  );

  let distance = MomentumTransfer.transfer(
    effectiveApproach,
    MomentumTransfer.profileFor("drive").floor,
    MomentumTransfer.profileFor("drive").ceil,
    postureLerp(grabber.cmdGrabVictimBalance, 1, GRAB_POSTURE_MULT_MAX)
  );

  if (grabber.isGassed) {
    distance = distance * CMD_DRIVE_GASSED_DISTANCE_MULT;
  }
  // Hard ceiling on the whole product. The posture multiplier stacks on top of
  // a maxed momentum drive, and the combined result was past what the game can
  // present convincingly.
  distance = Math.round(Math.min(distance, DRIVE_MAX_CARRY_PX));

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

  if (t >= 1) releaseDrive(grabber, victim, room, io, dir);
}

// Release opens a gap wider than GRAB_RANGE so there is no free re-grab and no free
// jab. BOTH fighters slide apart, which reads as a mutual break rather than the
// grabber inexplicably retreating from a shove they just won.
//
// The split is boundary-aware, not fixed at half each: whatever the victim cannot
// travel (because they are pinned against the tawara) is handed to the grabber. So a
// rope pin is fully preserved — the victim keeps the bad position they were driven
// into — while a mid-ring release looks symmetric.
function releaseDrive(grabber, victim, room, io, dir) {
  const now = simNow(room);
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
// Sets the same fields the surviving throw-arc simulator in index.js already
// reads (isThrowing / throwStartTime / clinchThrowArc*), so the arc, the landing,
// the boundary ring-out and the kill cinematic all come along unchanged.
function resolveThrow(grabber, victim, room, io, isKill) {
  const now = simNow(room);
  const balance = grabber.cmdGrabVictimBalance;
  const throwDir = grabber.x < victim.x ? 1 : -1;
  const duration = isKill
    ? CLINCH_KILL_THROW_DURATION_MS
    : postureScaled(balance, CLINCH_THROW_DURATION_MIN_MS, CLINCH_THROW_DURATION_MAX_MS);
  const presentationFacing =
    grabber.facing === 1 || grabber.facing === -1 ? grabber.facing : -1;

  clearActionPoses(grabber, victim);
  clearCommandGrabState(grabber);
  cleanupGrabStates(grabber, victim);

  grabber.isThrowing = true;
  grabber.isClinchKillThrow = isKill;
  grabber.clinchThrowArcDistance = isKill
    ? 0
    : // THROW is the neutral option: highest floor, lowest ceiling, least
      // speed-dependent. What you take when you have NOT earned a momentum
      // edge and want a guaranteed reset plus posture chip.
      Math.round(
        MomentumTransfer.transfer(
          Math.max(0, grabber.grabApproachSpeed || 0),
          MomentumTransfer.profileFor("throw").floor,
          MomentumTransfer.profileFor("throw").ceil,
          postureLerp(balance, 1, GRAB_POSTURE_MULT_MAX)
        )
      );
  grabber.clinchThrowArcHeight = isKill
    ? 0
    : postureScaled(balance, CLINCH_THROW_ARC_HEIGHT_MIN, CLINCH_THROW_ARC_HEIGHT_MAX);
  grabber.throwStartTime = now;
  grabber.throwEndTime = now + duration;
  grabber.throwOpponent = victim.id;
  grabber.throwingFacingDirection = throwDir;
  // The arc itself is the commitment; the tail only stops it ending on a dime.
  grabber.actionLockUntil = Math.max(
    grabber.actionLockUntil || 0,
    now + duration + CMD_THROW_RECOVERY_TAIL_MS
  );

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

  // Non-kill throws reposition — keep the victim inside the margin so the
  // tick-order win check can't ring them out while still pinned at the edge.
  if (!isKill) {
    const leftBound = MAP_LEFT_BOUNDARY + CLINCH_THROW_BOUNDARY_MARGIN;
    const rightBound = MAP_RIGHT_BOUNDARY - CLINCH_THROW_BOUNDARY_MARGIN;
    victim.x = Math.max(leftBound, Math.min(victim.x, rightBound));
  }

  clearAllActionStates(victim);
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
  triggerHitstopAndEmit(io, room, CMD_THROW_LAUNCH_HITSTOP_MS, "clinch_throw");
  emitThrottledScreenShake(room, io, { type: "grab_clash", scale: 1.05, force: true });

  if (isKill) {
    victim.isClinchKillThrowVictim = true;
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
  }
}

// ── PULL ────────────────────────────────────────────────────────────────────
// Reuses the surviving pull tween in index.js (isGrabBreakSeparating +
// isBeingPullReversaled), including the boundary swap for a puller with their own
// back to the wall and the kill-pull belly-slide.
function resolvePull(grabber, victim, room, io, isKill) {
  const now = simNow(room);
  const balance = grabber.cmdGrabVictimBalance;
  const targetFacingBeforeKill = victim.facing;
  const pullDirection = victim.x < grabber.x ? 1 : -1;
  // ── BELT TUG: authored side-switch, not their run-in ─────────────────────
  // Pull used to spend cmdGrabVictimApproach and launch a charger the width of
  // a half-ring. That dump is Matador's — you are parrying a moving grab
  // attempt. This is a belt pull: yank them past you and steal the line.
  // Posture walks a tight band so a broken opponent tugs a little further
  // without the move becoming a second dump.
  const pullDist = isKill
    ? CLINCH_KILL_PULL_DISTANCE
    : Math.round(
        postureLerp(
          balance,
          MomentumTransfer.profileFor("pull").floor,
          MomentumTransfer.profileFor("pull").ceil
        )
      );
  let tweenDuration = isKill ? CLINCH_KILL_PULL_TWEEN_DURATION : CMD_PULL_TWEEN_MS;
  let lockMs = isKill ? CLINCH_KILL_PULL_INPUT_LOCK_MS : CMD_PULL_INPUT_LOCK_MS;
  let targetX = grabber.x + pullDirection * pullDist;

  const leftBound = MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN;
  const rightBound = MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN;
  const clampedTargetX = Math.max(leftBound, Math.min(targetX, rightBound));
  const distPastActor =
    pullDirection === -1 ? grabber.x - clampedTargetX : clampedTargetX - grabber.x;
  const isBoundaryPull = !isKill && distPastActor < CLINCH_THROW_MIN_SEPARATION;

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

  // Face using post-pull destinations — the victim switches sides during the
  // tween, so correcting from current X leaves both facing away after the yank.
  const pullFacingAnchorX = isBoundaryPull ? actorTweenTargetX : grabber.x;
  if (!grabber.atTheRopesFacingDirection) {
    grabber.facing = pullFacingAnchorX < targetX ? -1 : 1;
    grabber.pullFacingDirection = grabber.facing;
  }
  if (!victim.atTheRopesFacingDirection) {
    victim.facing = targetX < pullFacingAnchorX ? -1 : 1;
    victim.pullFacingDirection = victim.facing;
  }
  if (isActionFacingOwnershipV2Enabled()) {
    for (const p of [grabber, victim]) {
      if (p.atTheRopesFacingDirection) continue;
      const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.PULL);
      p.pullFacingInstanceId = id;
      acquireActionFacingLock(p, {
        ownerType: ACTION_FACING_OWNER.PULL,
        ownerInstanceId: id,
        direction: p.facing,
        reason: ACTION_FACING_REASON.SIDE_SWITCH,
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
  stampGrabTellDuration(grabber, CMD_GRAB_VARIANT.PULL, isKill);

  if (isKill) {
    victim.isClinchKillPullVictim = true;
    handleWinCondition(room, victim, grabber, io, "clinchKillPull");
    // Re-assert after win cleanup so the MAP boundary exemption stays armed.
    victim.isClinchKillPullVictim = true;
    victim.isBeingPullReversaled = true;
    victim.pullReversalPullerId = grabber.id;
    victim.isGrabBreakSeparating = true;
    victim.grabBreakSepStartTime = now;
    victim.grabBreakSepDuration = tweenDuration;
    victim.grabBreakStartX = victim.x;
    victim.grabBreakTargetX = targetX;
    // Belly-laying finisher: the victim is slammed flat where they stand, so keep
    // whatever direction they were already facing (no flip toward the pull).
    victim.facing = targetFacingBeforeKill;
  }

  // Launch freeze so the yank animation reads before the victim travels.
  triggerHitstopAndEmit(io, room, CMD_PULL_LAUNCH_HITSTOP_MS, "clinch_throw");
  emitThrottledScreenShake(room, io, { type: "grab_clash", force: true });
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
  connectStartupMsFor,
  grabTellAnimMs,
};

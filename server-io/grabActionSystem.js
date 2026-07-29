const { MASTERY_P1_MOMENTUM } = require("./masteryFlags");

const {
  GRAB_PUSH_BURST_BASE, GRAB_PUSH_MOMENTUM_TRANSFER,
  GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY,
  GRAB_PUSH_DECAY_RATE, GRAB_PUSH_MIN_VELOCITY,
  ARM_CLAMP_BURST_MULT, ARM_CLAMP_BURST_DECAY_RATE,
  ARM_CLAMP_BURST_END_VELOCITY, ARM_CLAMP_MAX_BURST_MS,
  GRAB_PUSH_STAMINA_DRAIN_INTERVAL, GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL,
  GRAB_STAMINA_DRAIN_INTERVAL,
  RINGOUT_THROW_DURATION_MS,
  BALANCE_MAX,
  CLINCH_PUSH_BASE_SPEED,
  CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC,
  CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC,
  CLINCH_PUSH_VS_PLANT_SPEED_MULT,
  CLINCH_PLANT_BALANCE_REGEN_PER_SEC,
  CLINCH_PLANT_STAMINA_DRAIN_INTERVAL,
  CLINCH_NEUTRAL_STAMINA_REGEN_PER_SEC,
  CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL,
  CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL,
  CLINCH_PUSH_VS_PUSH_DEADZONE,
  CLINCH_PUSH_VS_PUSH_SOFT_MAX_DIFF,
  CLINCH_PUSH_VS_PUSH_MIN_SPEED,
  CLINCH_PUSH_VS_PUSH_MAX_SPEED,
  CLINCH_PUSH_VS_PUSH_LOSER_BAL_DRAIN_PER_SEC,
  CLINCH_PUSH_VS_PUSH_LOSER_STAM_DRAIN_PER_SEC,
  CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL,
  CLINCH_EDGE_PIN_HOLD_MS,
  CLINCH_PUSH_RAMP_DELAY_MS,
  CLINCH_PUSH_RAMP_RISE_MS,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_GASSED_PUSH_MULT,
  CLINCH_STALEMATE_DURATION_MS,
  CLINCH_STALEMATE_MOVEMENT_THRESHOLD,
  CLINCH_STALEMATE_BALANCE_THRESHOLD,
  CLINCH_ATTACHED_DISTANCE,
  CLINCH_MIXED_HOLD_DISTANCE,
  CLINCH_BODY_HOLD_DISTANCE,
  CLINCH_ATTACH_LERP_PER_SEC,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_COOLDOWN_MS,
  CLINCH_THROW_STAMINA_COST,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_BALANCE_DRAIN_VS_PUSH,
  CLINCH_THROW_BALANCE_DRAIN_VS_PLANT,
  CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_THROW_FAIL_BALANCE_DRAIN,
  CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN,
  CLINCH_THROW_FAIL_STAMINA_COST,
  CLINCH_PULL_BALANCE_DRAIN_VS_PUSH,
  CLINCH_PULL_BALANCE_DRAIN_VS_PLANT,
  CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN,
  CLINCH_TECH_STAMINA_COST,
  CLINCH_EDGE_ZONE_THRESHOLD,
  CLINCH_EDGE_BALANCE_DRAIN_MULT,
  CLINCH_EDGE_THROW_DRAIN_BONUS,
  CLINCH_EDGE_PULL_DRAIN_BONUS,
  CLINCH_THROW_LAND_THRESHOLD,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_DURATION_MS,
  CLINCH_CLASH_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_PULL_DISTANCE,
  CLINCH_PULL_TWEEN_DURATION,
  CLINCH_PULL_INPUT_LOCK_MS,
  HITSTOP_THROW_MS,
  speedFactor,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_PULL_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  CLINCH_JOLT_ANIMATION_MS,
  CLINCH_JOLT_RECOVERY_MS,
  CLINCH_JOLT_STAMINA_COST,
  CLINCH_JOLT_BALANCE_VS_PLANT,
  CLINCH_JOLT_BALANCE_VS_NEUTRAL,
  CLINCH_JOLT_BALANCE_VS_PUSH,
  CLINCH_JOLT_PUSH_VS_PLANT,
  CLINCH_JOLT_PUSH_VS_NEUTRAL,
  CLINCH_JOLT_PUSH_VS_PUSH,
  CLINCH_JOLT_MUTUAL_BALANCE,
  CLINCH_JOLT_CLASH_WINDOW_MS,
  CLINCH_JOLT_HITSTOP_MS,
  CLINCH_JOLT_MUTUAL_HITSTOP_MS,
  CLINCH_JOLT_PLANT_INTERRUPT_MS,
  CLINCH_JOLT_RECOIL_MS,
  CLINCH_JOLT_GASSED_MULT,
  CLINCH_JOLT_LOCKOUT_VS_PLANT,
  CLINCH_JOLT_LOCKOUT_VS_NEUTRAL,
  CLINCH_JOLT_LOCKOUT_VS_PUSH,
  CLINCH_JOLT_COOLDOWN_MS,
  CLINCH_JOLT_SELF_BALANCE_VS_PUSH,
  PULL_BOUNDARY_MARGIN,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CLINCH_PUSH_STAMINA_FLOOR,
  CLINCH_THROW_FAIL_STAGGER_MS,
  DEEP_GRIP_THROW_THRESHOLD_BONUS,
  DEEP_GRIP_PUSH_MULT,
  DEEP_GRIP_PUSH_WIN_MS,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION,
  GRAB_BREAK_INPUT_LOCK_MS,
  GRAB_BREAK_GRAB_IMMUNITY_MS,
  GRAB_BREAK_REACTION_LOCK_MS,
} = require("./constants");

const {
  setPlayerTimeout,
  simNow,
  clearAllActionStates,
  triggerHitstop,
  triggerHitstopAndEmit,
  emitThrottledScreenShake,
  emitStaminaBlocked,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");

const { correctFacingAfterGrabOrThrow, executeClinchSeparation } = require("./grabMechanics");
const { cleanupGrabStates, handleWinCondition } = require("./gameFunctions");

// Continuous fatigue: push force lerps from 1.0 (full stamina) to the floor
// (0 stamina). Gassed overrides with the hard cliff — the arc is
// 100 stamina → floor → gassed cliff → partial recovery.
function getPushForceMult(player) {
  const deepGripMult = player.hasDeepGrip ? DEEP_GRIP_PUSH_MULT : 1;
  if (player.isGassed) return CLINCH_GASSED_PUSH_MULT * deepGripMult;
  const staminaRatio = Math.max(0, Math.min(100, player.stamina)) / 100;
  return (CLINCH_PUSH_STAMINA_FLOOR + (1 - CLINCH_PUSH_STAMINA_FLOOR) * staminaRatio) * deepGripMult;
}

// Momentum ramp multiplier for an unanswered push. 1.0 until the delay
// elapses, then linear up to the max over the rise window. The timer
// (clinchPushRampStart) is maintained in the movement section each tick.
function getPushRampMult(player, now) {
  if (!player.clinchPushRampStart) return 1;
  const held = now - player.clinchPushRampStart;
  if (held <= CLINCH_PUSH_RAMP_DELAY_MS) return 1;
  const t = Math.min(1, (held - CLINCH_PUSH_RAMP_DELAY_MS) / CLINCH_PUSH_RAMP_RISE_MS);
  return 1 + (CLINCH_PUSH_RAMP_MAX_MULT - 1) * t;
}

// Push-war shove power = stamina tank (× deep grip / gassed). Balance is NOT
// in this contest — it's the throw meter. Equal stamina ⇒ standstill.
function getShovePower(player) {
  const stam = Math.max(0, Math.min(100, player.stamina || 0));
  const deep = player.hasDeepGrip ? DEEP_GRIP_PUSH_MULT : 1;
  if (player.isGassed) return stam * CLINCH_GASSED_PUSH_MULT * deep;
  return stam * deep;
}

// Push-vs-push speed from shove-power difference. Returns { speed, t } where t
// is advantage intensity in [0,1] (loser balance pressure). Deadzone → ease-out
// from MIN_SPEED up to MAX_SPEED. Sign: positive = grabber winning.
function getPushVsPushSpeed(powerDiff) {
  const abs = Math.abs(powerDiff);
  if (abs <= CLINCH_PUSH_VS_PUSH_DEADZONE) {
    return { speed: 0, t: 0 };
  }
  const span = Math.max(1, CLINCH_PUSH_VS_PUSH_SOFT_MAX_DIFF - CLINCH_PUSH_VS_PUSH_DEADZONE);
  let t = Math.min(1, (abs - CLINCH_PUSH_VS_PUSH_DEADZONE) / span);
  // Ease-out quadratic: modest leads punch above linear, extremes compress into the cap.
  t = 1 - (1 - t) * (1 - t);
  const mag =
    CLINCH_PUSH_VS_PUSH_MIN_SPEED +
    (CLINCH_PUSH_VS_PUSH_MAX_SPEED - CLINCH_PUSH_VS_PUSH_MIN_SPEED) * t;
  return { speed: Math.sign(powerDiff) * mag, t };
}

// DEEP GRIP — grant the earned-advantage state. Exclusive: taking it strips
// the opponent's. Emits the callout event so the client can announce it.
function grantDeepGrip(holder, other, room, io, source) {
  if (holder.hasDeepGrip) return;
  holder.hasDeepGrip = true;
  other.hasDeepGrip = false;
  other.deepGripPushStart = 0;
  io.in(room.id).emit("deep_grip", {
    playerId: holder.id,
    playerNumber: room.players.indexOf(holder) === 0 ? 1 : 2,
    source,
    gripId: `deep-grip-${simNow(room)}-${holder.id}`,
  });
}

function isInEdgeZone(playerX) {
  return playerX <= MAP_LEFT_BOUNDARY + CLINCH_EDGE_ZONE_THRESHOLD ||
         playerX >= MAP_RIGHT_BOUNDARY - CLINCH_EDGE_ZONE_THRESHOLD;
}

function clearEdgePinHold(...players) {
  for (const p of players) {
    if (p) p.clinchEdgePinStart = 0;
  }
}

// Edge pin ring-out: stamina ≤ 0 (resource dump) OR continuous hold ≥ CLINCH_EDGE_PIN_HOLD_MS.
// Returns true if a ring-out fired. Call only while actively pinning at the boundary.
function tryEdgePinRingOut(pusher, victim, room, io, rooms, dir, now) {
  if (victim.stamina <= 0) {
    clearEdgePinHold(victim);
    triggerRingOut(pusher, victim, room, io, rooms, dir);
    return true;
  }
  if (!victim.clinchEdgePinStart) {
    victim.clinchEdgePinStart = now;
  } else if (now - victim.clinchEdgePinStart >= CLINCH_EDGE_PIN_HOLD_MS) {
    clearEdgePinHold(victim);
    triggerRingOut(pusher, victim, room, io, rooms, dir);
    return true;
  }
  return false;
}

function getClinchAction(player, opponent) {
  if (!player.hasGrip) return "neutral";
  if (getPlantIntent(player, opponent)) return "plant";

  const towardKey = player.x < opponent.x ? 'd' : 'a';
  const pressingToward = player.keys[towardKey] && !player.keys[player.x < opponent.x ? 'a' : 'd'];
  if (pressingToward) return "push";
  return "neutral";
}

// Plant/brace stance intent from raw keys: pull-back (away) alone, or S alone —
// both dead inputs in the clinch before this, and pull-back is the natural
// panic motion against an incoming throw. Holding toward overrides S (active
// aggression wins over a stray S), and toward+away cancel each other out.
function getPlantIntent(player, opponent) {
  const towardKey = player.x < opponent.x ? 'd' : 'a';
  const awayKey = player.x < opponent.x ? 'a' : 'd';
  const toward = player.keys[towardKey];
  return (player.keys[awayKey] && !toward) || (player.keys.s && !toward);
}

function isPlayerBeltHolding(p) {
  // The M2 that started the grab must be released once before hold counts as
  // belt — otherwise connect always defaults to belt arms while the button
  // is still down from the attempt. Body hold is the default.
  if (p.clinchBeltRequiresM2Release) {
    if (!p.keys?.mouse2) {
      p.clinchBeltRequiresM2Release = false;
    }
  }
  const m2Belt = !!p.keys?.mouse2 && !p.clinchBeltRequiresM2Release;
  return !!(
    p.inClinch &&
    !p.isArmClamped &&
    (m2Belt ||
      p.clinchThrowRequest ||
      p.clinchThrowActive ||
      p.isClinchThrowing ||
      p.isAttemptingGrabThrow ||
      p.isAttemptingPull)
  );
}

// Body holds need space for the flippers; belt grips pull the pair tight.
function getClinchTargetAttachDistance(player, opponent) {
  const belts =
    (isPlayerBeltHolding(player) ? 1 : 0) + (isPlayerBeltHolding(opponent) ? 1 : 0);
  if (belts >= 2) return CLINCH_ATTACHED_DISTANCE;
  if (belts === 1) return CLINCH_MIXED_HOLD_DISTANCE;
  return CLINCH_BODY_HOLD_DISTANCE;
}

function updateGrabActions(player, room, io, delta, rooms) {
  // Only process for the player who initiated the grab (isGrabbing)
  if (!player.isGrabbing || !player.grabbedOpponent) return;
  // Skip during throw/pull animation states (Phase 4 will handle these)
  if (player.isThrowing || player.isBeingThrown) return;

  const opponent = room.players.find((p) => p.id === player.grabbedOpponent);
  if (!opponent) {
    // Orphan grab safety
    const grabDuration = simNow(room) - player.grabStartTime;
    if (grabDuration >= 500) {
      player.isGrabbing = false;
      player.grabbedOpponent = null;
    }
    return;
  }

  // Push-war HUD lead — null when not in a mutual shove; 0 = EVEN standstill.
  player.clinchShoveLead = null;
  opponent.clinchShoveLead = null;

  const deltaSec = delta / 1000;
  const leftBoundary = MAP_LEFT_BOUNDARY;
  const rightBoundary = MAP_RIGHT_BOUNDARY;

  // Belt-arm pose + attach spacing share the same M2/throw intent.
  // Body holds sit farther apart; pressing M2 (belt) lerps the pair tight.
  for (const p of [player, opponent]) {
    p.isClinchBeltHolding = isPlayerBeltHolding(p);
  }
  const sizeMult = opponent.sizeMultiplier || 1;
  const targetAttach =
    getClinchTargetAttachDistance(player, opponent) * sizeMult;
  if (!(player.clinchAttachDistance > 0)) {
    player.clinchAttachDistance = targetAttach;
  } else {
    const lerp = Math.min(1, deltaSec * CLINCH_ATTACH_LERP_PER_SEC);
    player.clinchAttachDistance +=
      (targetAttach - player.clinchAttachDistance) * lerp;
  }
  const fixedDistance = player.clinchAttachDistance;

  // ============================================
  // PHASE A: SHORT AUTO-BURST PUSH (first-grab reward)
  // Both players already have grip on connect. Burst rides isGrabPushing and
  // decays quickly. Either side's throw/pull/lift/break cancels it; during the
  // burst they can still plant/jolt/throw if they react fast enough.
  // ARM CLAMP: victim is locked out of those actions until the clamp ends.
  // ============================================
  const eitherThrowRequest = !!(player.clinchThrowRequest || opponent.clinchThrowRequest);
  if (player.isGrabPushing && eitherThrowRequest) {
    player.isGrabPushing = false;
    opponent.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    player.isAtBoundaryDuringGrab = false;
    clearEdgePinHold(player, opponent);
    player.grabPushStartTime = 0;
    // Fall through — throw request processed below
  }

  let burstMovementApplied = false;
  if (player.isGrabPushing) {
    if (!player.grabPushStartTime) {
      player.grabPushStartTime = simNow(room);
      opponent.isBeingGrabPushed = true;
    }

    const pushElapsed = simNow(room) - player.grabPushStartTime;
    const pushElapsedSec = pushElapsed / 1000;

    // Calculate burst push speed (exponential decay).
    // MASTERY Phase 1: the grab is the TEMPLATE inheritance mechanic (it already
    // transfers approach speed into the burst) — raise the transfer so a
    // dash/power-slide grab bites harder. Flag off ⇒ base transfer.
    const grabMomentumTransfer = MASTERY_P1_MOMENTUM
      ? GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY
      : GRAB_PUSH_MOMENTUM_TRANSFER;
    // Clamp gets its own shove power — regular connect stays a short reward
    // nudge; counter-grab should feel like a real parry punish.
    const clampMult = opponent.isArmClamped ? ARM_CLAMP_BURST_MULT : 1;
    const burstDecay = opponent.isArmClamped
      ? ARM_CLAMP_BURST_DECAY_RATE
      : GRAB_PUSH_DECAY_RATE;
    const initialPushSpeed =
      (GRAB_PUSH_BURST_BASE +
        (player.grabApproachSpeed || 0) * grabMomentumTransfer) *
      clampMult;
    let currentPushSpeed =
      initialPushSpeed * Math.exp(-burstDecay * pushElapsedSec);

    // When burst decays below threshold, transition to manual clinch push.
    // ARM CLAMP: victim can't act during Phase A — end while the shove is
    // still lively (velocity floor + hard duration cap), not in a crawl.
    const burstEndVelocity = opponent.isArmClamped
      ? ARM_CLAMP_BURST_END_VELOCITY
      : GRAB_PUSH_MIN_VELOCITY;
    const armClampBurstTimedOut =
      opponent.isArmClamped && pushElapsed >= ARM_CLAMP_MAX_BURST_MS;
    if (
      (currentPushSpeed < burstEndVelocity || armClampBurstTimedOut) &&
      pushElapsed > 80
    ) {
      player.isGrabPushing = false;
      opponent.isBeingGrabPushed = false;
      player.grabPushStartTime = 0;
      player.clinchAction = "neutral";
      opponent.clinchAction = "neutral";
      // Fall through to clinch processing below
    } else {
      // Stamina drain during burst push — pusher always drains
      if (!player.lastGrabStaminaDrainTime) {
        player.lastGrabStaminaDrainTime = simNow(room);
      }
      if (simNow(room) - player.lastGrabStaminaDrainTime >= GRAB_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabStaminaDrainTime = simNow(room);
      }

      // Opponent stamina drain during burst push (slower than pusher, faster at edge)
      if (!opponent.lastGrabPushStaminaDrainTime) {
        opponent.lastGrabPushStaminaDrainTime = simNow(room);
      }
      const drainInterval = player.isAtBoundaryDuringGrab
        ? GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL
        : GRAB_PUSH_STAMINA_DRAIN_INTERVAL;
      if (simNow(room) - opponent.lastGrabPushStaminaDrainTime >= drainInterval) {
        opponent.stamina = Math.max(0, opponent.stamina - 1);
        opponent.lastGrabPushStaminaDrainTime = simNow(room);
      }

      // Still in burst push — apply movement (actions still process below)
      const pushDirection = player.x < opponent.x ? 1 : -1;
      const pushDelta = pushDirection * delta * speedFactor * currentPushSpeed;
      let newX = player.x + pushDelta;
      let newOpponentX = player.x < opponent.x
        ? newX + fixedDistance
        : newX - fixedDistance;

      // Boundary check with stamina gating
      const opponentAtLeft = newOpponentX <= leftBoundary;
      const opponentAtRight = newOpponentX >= rightBoundary;

      if ((opponentAtLeft || opponentAtRight) && !room.gameOver) {
        const pinNow = simNow(room);
        const pinDir = opponentAtLeft ? -1 : 1;
        // ARM CLAMP ends at boundary contact — a clamped victim pinned at the
        // edge with zero available inputs would be a pure spectator.
        if (opponent.isArmClamped) {
          opponent.isArmClamped = false;
          opponent.clinchAction = "neutral";
        }
        if (tryEdgePinRingOut(player, opponent, room, io, rooms, pinDir, pinNow)) {
          return;
        }
        // Pin at boundary
        player.isAtBoundaryDuringGrab = true;
        player.isEdgePushing = true;
        opponent.isBeingEdgePushed = true;
        newOpponentX = opponentAtLeft ? leftBoundary : rightBoundary;
        newX = player.x < opponent.x
          ? newOpponentX - fixedDistance
          : newOpponentX + fixedDistance;
      } else {
        player.isAtBoundaryDuringGrab = false;
        player.isEdgePushing = false;
        opponent.isBeingEdgePushed = false;
        clearEdgePinHold(opponent);
        newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
      }

      player.x = newX;
      opponent.x = player.x < opponent.x
        ? player.x + fixedDistance
        : player.x - fixedDistance;

      if (!opponent.atTheRopesFacingDirection) {
        opponent.facing = -player.facing;
      }
      player.movementVelocity = 0;
      burstMovementApplied = true;
    }
  }

  // ============================================
  // PHASE B: MUTUAL CLINCH
  // Both have grip from connect. Push/plant/jolt/throw/break are live.
  // While burst movement owns this tick, skip Phase B shove displacement.
  // ============================================

  // ARM CLAMP release: lasts through the burst carry and any free throw the
  // grabber filed during it (victim locked = untechable). Once the burst is
  // over and no throw is pending/active, clear the clamp for a fair clinch.
  if (
    opponent.isArmClamped &&
    !player.isGrabPushing &&
    !player.clinchThrowRequest &&
    !player.clinchThrowActive
  ) {
    opponent.isArmClamped = false;
    opponent.clinchAction = "neutral";
  }

  // Determine each player's clinch action (clamped victim forced neutral)
  const grabberAction = getClinchAction(player, opponent);
  const opponentAction = opponent.isArmClamped
    ? "neutral"
    : getClinchAction(opponent, player);

  player.clinchAction = grabberAction;
  opponent.clinchAction = opponentAction;

  // Set visual states
  player.inClinch = true;
  opponent.inClinch = true;

  // Clinch action visual flags (driven by clinchAction, reset every tick)
  player.isClinchPushing = (grabberAction === "push");
  player.isClinchPlanting = (grabberAction === "plant");
  opponent.isClinchPushing = (opponentAction === "push");
  opponent.isClinchPlanting = (opponentAction === "plant");

  // --- Stalemate timer ---
  if (!player.clinchStalemateStart) {
    player.clinchStalemateStart = simNow(room);
    player.clinchStalemateLastX = player.x;
    player.clinchStalemateLastBalance = player.balance;
  }
  const stalemateElapsed = simNow(room) - player.clinchStalemateStart;
  const posChanged = Math.abs(player.x - (player.clinchStalemateLastX || player.x)) > CLINCH_STALEMATE_MOVEMENT_THRESHOLD;
  const balChanged = Math.abs(player.balance - (player.clinchStalemateLastBalance || player.balance)) > CLINCH_STALEMATE_BALANCE_THRESHOLD;
  if (posChanged || balChanged) {
    player.clinchStalemateStart = simNow(room);
    player.clinchStalemateLastX = player.x;
    player.clinchStalemateLastBalance = player.balance;
  }
  if (stalemateElapsed >= CLINCH_STALEMATE_DURATION_MS && !room.gameOver) {
    executeClinchSeparation(player, opponent, room, io);
    return;
  }

  const now = simNow(room);

  // ============================================
  // CLINCH BREAK (Spacebar) — defensive escape from mutual clinch
  // Processed before jolt/throw/lift/push so a break preempts everything else.
  // Gated on mutual grip in socketHandlers; here we only check mid-action gates.
  // ============================================
  for (const breaker of [player, opponent]) {
    if (!breaker.clinchBreakRequest) continue;
    const target = breaker === player ? opponent : player;

    // Drop early requests (e.g. latched during grab hitstop before reaction lock opens).
    // No carry — player must press Space again after the lock.
    const gripAt = breaker.gripAcquiredTime || 0;
    if (gripAt && now - gripAt < GRAB_BREAK_REACTION_LOCK_MS) {
      breaker.clinchBreakRequest = false;
      breaker.clinchBreakRequestTime = 0;
      continue;
    }

    // Late safety gates — if any committed action started between input and processing,
    // drop the request silently (no half-processed escape mid-throw).
    const blockedByGas = breaker.isGassed;
    const blocked = blockedByGas ||
      breaker.clinchThrowActive || target.clinchThrowActive ||
      breaker.isClinchClashing || target.isClinchClashing ||
      breaker.isClinchJolting || breaker.isClinchJoltClashing ||
      breaker.clinchThrowFailStagger ||
      breaker.isResistingThrow || breaker.isResistingPull ||
      !breaker.hasGrip || !target.hasGrip;

    breaker.clinchBreakRequest = false;
    breaker.clinchBreakRequestTime = 0;

    if (blocked) {
      if (blockedByGas) emitStaminaBlocked(breaker, "grabBreak", io);
      continue;
    }

    executeClinchBreak(breaker, target, room, io);
    return; // Clinch is ending — skip rest of clinch processing this tick
  }

  // ============================================
  // CLINCH JOLT (Mouse1) — quick balance-damage shove
  // Processed before throw/pull/lift — recovery blocks those actions
  // ============================================

  // Drop early jolt requests (same fresh-press floor as grab break).
  // No carry — player must press Mouse1 again after the lock.
  for (const p of [player, opponent]) {
    if (!p.clinchJoltRequest) continue;
    const gripAt = p.gripAcquiredTime || 0;
    if (gripAt && now - gripAt < GRAB_BREAK_REACTION_LOCK_MS) {
      p.clinchJoltRequest = false;
      p.clinchJoltRequestTime = 0;
    }
  }

  // --- Clear expired jolt animation states ---
  for (const p of [player, opponent]) {
    if (p.isClinchJolting && p.clinchJoltStartTime && now - p.clinchJoltStartTime >= CLINCH_JOLT_ANIMATION_MS) {
      p.isClinchJolting = false;
      p.isClinchJoltClashing = false;
      if (!p.clinchJoltRecovery) {
        p.clinchJoltRecovery = true;
        setPlayerTimeout(p.id, () => {
          p.clinchJoltRecovery = false;
          p.clinchJoltCooldown = true;
          setPlayerTimeout(p.id, () => {
            p.clinchJoltCooldown = false;
          }, CLINCH_JOLT_COOLDOWN_MS, "clinchJoltCooldown");
        }, CLINCH_JOLT_RECOVERY_MS, "clinchJoltRecovery");
      }
    }
    if (p.isBeingClinchJolted && p.clinchJoltRecoilStart && now - p.clinchJoltRecoilStart >= CLINCH_JOLT_RECOIL_MS) {
      p.isBeingClinchJolted = false;
    }
    if (p.clinchJoltPlantInterrupt && p.clinchJoltPlantInterruptStart && now - p.clinchJoltPlantInterruptStart >= CLINCH_JOLT_PLANT_INTERRUPT_MS) {
      p.clinchJoltPlantInterrupt = false;
    }
  }

  // --- Mutual jolt detection ---
  if (player.clinchJoltRequest && opponent.clinchJoltRequest) {
    const timeDiff = Math.abs(
      (player.clinchJoltRequestTime || 0) - (opponent.clinchJoltRequestTime || 0)
    );
    if (timeDiff <= CLINCH_JOLT_CLASH_WINDOW_MS) {
      player.clinchJoltRequest = false;
      player.clinchJoltRequestTime = 0;
      opponent.clinchJoltRequest = false;
      opponent.clinchJoltRequestTime = 0;

      player.isClinchJoltClashing = true;
      opponent.isClinchJoltClashing = true;
      player.isClinchJolting = true;
      opponent.isClinchJolting = true;
      player.clinchJoltStartTime = now;
      opponent.clinchJoltStartTime = now;

      if (player.isGrabPushing) {
        player.isGrabPushing = false;
        opponent.isBeingGrabPushed = false;
        player.isEdgePushing = false;
        opponent.isBeingEdgePushed = false;
        player.isAtBoundaryDuringGrab = false;
        player.grabPushStartTime = 0;
      }

      player.balance = Math.max(0, player.balance - CLINCH_JOLT_MUTUAL_BALANCE);
      opponent.balance = Math.max(0, opponent.balance - CLINCH_JOLT_MUTUAL_BALANCE);
      player.stamina = Math.max(0, player.stamina - CLINCH_JOLT_STAMINA_COST);
      opponent.stamina = Math.max(0, opponent.stamina - CLINCH_JOLT_STAMINA_COST);

    triggerHitstopAndEmit(io, room, CLINCH_JOLT_MUTUAL_HITSTOP_MS, "clinch_jolt_mutual");
    emitThrottledScreenShake(room, io, { type: "clinch_jolt", scale: 1.1 });
      io.in(room.id).emit("clinch_jolt", {
        jolterId: player.id,
        targetId: opponent.id,
        jolterX: player.x,
        targetX: opponent.x,
        type: "mutual",
        direction: 0,
        // Midpoint seam at clinch attach spacing — same contact rail as strikes.
        contactX: (player.x + opponent.x) / 2,
        contactY: player.y,
      });

      player.clinchStalemateStart = now;
      opponent.clinchStalemateStart = now;
      player.clinchStalemateLastBalance = player.balance;
      opponent.clinchStalemateLastBalance = opponent.balance;
    }
  }

  // --- Process single jolt ---
  for (const [jolter, target] of [[player, opponent], [opponent, player]]) {
    if (!jolter.clinchJoltRequest || jolter.isClinchJolting || jolter.isClinchJoltClashing ||
        jolter.clinchThrowFailStagger) continue;

    jolter.clinchJoltRequest = false;
    jolter.clinchJoltRequestTime = 0;

    const targetAction = target === player ? grabberAction : opponentAction;

    let balanceDmg, pushDist, lockoutMs;
    if (targetAction === "plant") {
      balanceDmg = CLINCH_JOLT_BALANCE_VS_PLANT;
      pushDist = CLINCH_JOLT_PUSH_VS_PLANT;
      lockoutMs = CLINCH_JOLT_LOCKOUT_VS_PLANT;
    } else if (targetAction === "push") {
      balanceDmg = CLINCH_JOLT_BALANCE_VS_PUSH;
      pushDist = CLINCH_JOLT_PUSH_VS_PUSH;
      lockoutMs = CLINCH_JOLT_LOCKOUT_VS_PUSH;
    } else {
      balanceDmg = CLINCH_JOLT_BALANCE_VS_NEUTRAL;
      pushDist = CLINCH_JOLT_PUSH_VS_NEUTRAL;
      lockoutMs = CLINCH_JOLT_LOCKOUT_VS_NEUTRAL;
    }

    const gassedMult = jolter.isGassed ? CLINCH_JOLT_GASSED_MULT : 1;
    balanceDmg = Math.round(balanceDmg * gassedMult);
    pushDist = Math.round(pushDist * gassedMult);

    target.balance = Math.max(0, target.balance - balanceDmg);
    jolter.stamina = Math.max(0, jolter.stamina - CLINCH_JOLT_STAMINA_COST);

    if (targetAction === "push") {
      jolter.balance = Math.max(0, jolter.balance - CLINCH_JOLT_SELF_BALANCE_VS_PUSH);
    }

    // Chest-bump: target takes 70% of push, jolter advances 30%
    const pushDir = jolter.x < target.x ? 1 : -1;
    if (pushDist > 0) {
      const targetPush = pushDist * 0.7;
      const jolterPush = pushDist * 0.3;
      jolter.x = Math.max(leftBoundary, Math.min(rightBoundary, jolter.x + pushDir * jolterPush));
      target.x = Math.max(leftBoundary, Math.min(rightBoundary, target.x + pushDir * targetPush));
    }

    jolter.isClinchJolting = true;
    jolter.clinchJoltStartTime = now;
    target.isBeingClinchJolted = true;
    target.clinchJoltRecoilStart = now;

    // Jolt cancels the Phase A burst shove (same as throw/pull/lift).
    if (player.isGrabPushing) {
      player.isGrabPushing = false;
      opponent.isBeingGrabPushed = false;
      player.isEdgePushing = false;
      opponent.isBeingEdgePushed = false;
      player.isAtBoundaryDuringGrab = false;
      player.grabPushStartTime = 0;
    }

    if (lockoutMs > 0) {
      target.inputLockUntil = Math.max(target.inputLockUntil || 0, now + lockoutMs);
    }

    if (targetAction === "plant") {
      target.clinchJoltPlantInterrupt = true;
      target.clinchJoltPlantInterruptStart = now;
    }

    // DEEP GRIP: a landed jolt always strips the target's deep grip, and
    // jolting a PLANTED opponent (posture broken, hand slips inside) earns it.
    if (target.hasDeepGrip) target.hasDeepGrip = false;
    if (targetAction === "plant") {
      grantDeepGrip(jolter, target, room, io, "jolt");
    }

    triggerHitstopAndEmit(io, room, CLINCH_JOLT_HITSTOP_MS, "clinch_jolt");
    emitThrottledScreenShake(room, io, { type: "clinch_jolt" });
    io.in(room.id).emit("clinch_jolt", {
      jolterId: jolter.id,
      targetId: target.id,
      jolterX: jolter.x,
      targetX: target.x,
      type: "single",
      direction: pushDir,
      contactX: (jolter.x + target.x) / 2,
      contactY: jolter.y,
    });

    // Stalemate reset
    jolter.clinchStalemateStart = now;
    target.clinchStalemateStart = now;
    jolter.clinchStalemateLastBalance = jolter.balance;
    target.clinchStalemateLastBalance = target.balance;
    jolter.clinchStalemateLastX = jolter.x;
    target.clinchStalemateLastX = target.x;
  }

  // --- Block actions during jolt recovery / failed-throw stagger ---
  for (const p of [player, opponent]) {
    if (p.clinchJoltRecovery || p.clinchThrowFailStagger) {
      p.clinchAction = "neutral";
      if (p === player) {
        player.isClinchPushing = false;
        player.isClinchPlanting = false;
      } else {
        opponent.isClinchPushing = false;
        opponent.isClinchPlanting = false;
      }
    }
  }

  // --- Skip throw/pull/lift/push/plant during active jolt animation ---
  if (player.isClinchJolting || opponent.isClinchJolting ||
      player.isClinchJoltClashing || opponent.isClinchJoltClashing) {
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // ============================================
  // CLINCH ACTIONS: Throw / Pull / Lift (Phase 4)
  // Processed before push/plant — a committed action overrides normal clinch
  // ============================================

  // --- Clinch tech: both players filed ANY clinch action within the clash window → cancel both, stay in clinch ---
  if (player.clinchThrowRequest && opponent.clinchThrowRequest) {
    const timeDiff = Math.abs((player.clinchThrowRequestTime || 0) - (opponent.clinchThrowRequestTime || 0));
    if (timeDiff <= CLINCH_THROW_CLASH_WINDOW_MS) {
      player.clinchThrowRequest = null;
      player.clinchThrowRequestTime = 0;
      opponent.clinchThrowRequest = null;
      opponent.clinchThrowRequestTime = 0;
      player.isClinchClashing = true;
      opponent.isClinchClashing = true;
      player.clinchClashStartTime = now;
      opponent.clinchClashStartTime = now;
      player.clinchThrowCooldown = true;
      opponent.clinchThrowCooldown = true;
      player.stamina = Math.max(0, player.stamina - CLINCH_TECH_STAMINA_COST);
      opponent.stamina = Math.max(0, opponent.stamina - CLINCH_TECH_STAMINA_COST);
      player.clinchStalemateStart = now;
      opponent.clinchStalemateStart = now;
    }
  }

  // --- Process active clash animation ---
  if (player.isClinchClashing || opponent.isClinchClashing) {
    const clashElapsed = now - (player.clinchClashStartTime || now);
    if (clashElapsed >= CLINCH_CLASH_ANIMATION_MS) {
      player.isClinchClashing = false;
      opponent.isClinchClashing = false;
      player.clinchClashStartTime = 0;
      opponent.clinchClashStartTime = 0;
      setPlayerTimeout(player.id, () => { player.clinchThrowCooldown = false; }, CLINCH_THROW_COOLDOWN_MS, "clinchThrowCooldown");
      setPlayerTimeout(opponent.id, () => { opponent.clinchThrowCooldown = false; }, CLINCH_THROW_COOLDOWN_MS, "clinchThrowCooldown");
    }
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // --- Start new throw/pull from request ---
  // ALL clinch actions buffer for the clash window so the opponent has time to tech.
  const bufferExpired = (p) =>
    (now - (p.clinchThrowRequestTime || 0)) > CLINCH_THROW_CLASH_WINDOW_MS;

  const requesters = [];
  if (player.clinchThrowRequest && !player.clinchThrowActive && !player.clinchThrowCooldown &&
      !player.isResistingThrow && !player.isResistingPull &&
      !player.clinchJoltRecovery && !player.isClinchJolting &&
      !player.clinchThrowFailStagger &&
      bufferExpired(player)) requesters.push(player);
  if (opponent.clinchThrowRequest && !opponent.clinchThrowActive && !opponent.clinchThrowCooldown && opponent.hasGrip &&
      !opponent.isResistingThrow && !opponent.isResistingPull &&
      !opponent.clinchJoltRecovery && !opponent.isClinchJolting &&
      !opponent.clinchThrowFailStagger &&
      bufferExpired(opponent)) requesters.push(opponent);

  for (const actor of requesters) {
    const target = actor === player ? opponent : player;
    const actionType = actor.clinchThrowRequest;

    // Lift was removed — ignore stale lift requests (e.g. old CPU kits / lag).
    if (actionType !== "throw" && actionType !== "pull") {
      actor.clinchThrowRequest = null;
      actor.clinchThrowRequestTime = 0;
      continue;
    }

    actor.clinchThrowRequest = null;
    actor.clinchThrowRequestTime = 0;
    actor.clinchThrowActive = true;
    actor.clinchThrowType = actionType;
    actor.clinchThrowStartTime = now;
    actor.stamina = Math.max(0, actor.stamina - CLINCH_THROW_STAMINA_COST);

    // Clear push/clinch visual states so they don't interfere with the committed action
    actor.isGrabPushing = false;
    actor.isEdgePushing = false;
    actor.isGrabWalking = false;
    actor.isAtBoundaryDuringGrab = false;
    actor.isClinchPushing = false;
    actor.isClinchPlanting = false;
    target.isBeingGrabPushed = false;
    target.isBeingEdgePushed = false;
    target.isClinchPushing = false;
    target.isClinchPlanting = false;
    target.lastGrabPushStaminaDrainTime = 0;

    actor.isClinchThrowing = true;
    actor.isAttemptingGrabThrow = (actionType === "throw");
    actor.isAttemptingPull = (actionType === "pull");
    target.isResistingThrow = (actionType === "throw");
    target.isResistingPull = (actionType === "pull");

    // Lock target during throw/pull startup — no inputs, no counter-requests
    const animDuration = actionType === "throw" ? CLINCH_THROW_ANIMATION_MS : CLINCH_PULL_ANIMATION_MS;
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, now + animDuration);
    target.clinchThrowRequest = null;
    target.clinchThrowRequestTime = 0;

    const targetAction = target === player ? grabberAction : opponentAction;
    let stanceDrain;
    if (actionType === "pull") {
      stanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL;
      if (targetAction === "push") stanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_PUSH;
      else if (targetAction === "plant") stanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_PLANT;
    } else {
      stanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL;
      if (targetAction === "push") stanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_PUSH;
      else if (targetAction === "plant") stanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_PLANT;
    }
    let balanceDrain = stanceDrain;
    if (isInEdgeZone(target.x)) {
      balanceDrain += actionType === "pull" ? CLINCH_EDGE_PULL_DRAIN_BONUS : CLINCH_EDGE_THROW_DRAIN_BONUS;
    }
    target.balance = Math.max(0, target.balance - balanceDrain);

    // Surface the stance read — counter_throw credits the actor (caught a pusher).
    if (targetAction === "push") {
      io.in(room.id).emit("clinch_callout", {
        type: "counter_throw",
        actorId: actor.id,
        targetId: target.id,
        actionType,
        playerNumber: room.players.indexOf(actor) === 0 ? 1 : 2,
        calloutId: `clinch-callout-${now}-${actor.id}`,
        x: (actor.x + target.x) / 2,
      });
    }
    actor.clinchStalemateStart = now;
  }

  // --- Safety: clear stale target states when no active action exists ---
  const activeActor = player.clinchThrowActive ? player : (opponent.clinchThrowActive ? opponent : null);
  if (!activeActor) {
    if (player.isResistingThrow) player.isResistingThrow = false;
    if (opponent.isResistingThrow) opponent.isResistingThrow = false;
    if (player.isResistingPull) player.isResistingPull = false;
    if (opponent.isResistingPull) opponent.isResistingPull = false;
    if (player.inputLockUntil && player.inputLockUntil <= now) player.inputLockUntil = 0;
    if (opponent.inputLockUntil && opponent.inputLockUntil <= now) opponent.inputLockUntil = 0;
  }

  // --- Process active throw/pull ---
  if (activeActor && (activeActor.clinchThrowType === "throw" || activeActor.clinchThrowType === "pull")) {
    const activeTarget = activeActor === player ? opponent : player;
    const elapsed = now - activeActor.clinchThrowStartTime;
    const animDuration = activeActor.clinchThrowType === "throw" ? CLINCH_THROW_ANIMATION_MS : CLINCH_PULL_ANIMATION_MS;

    if (elapsed >= animDuration) {
      resolveClinchThrow(activeActor, activeTarget, room, io, rooms);
    }
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // --- Stance latch: freeze the clinch while a throw/pull request buffers ---
  // Filing a request (e.g. releasing push-back to input a pull) momentarily reads
  // as "neutral" on the keys. Without this freeze, the ~175ms buffer window lets
  // the opponent's push carry the requester at full unresisted speed — enough to
  // cross the entire edge zone. Freezing movement and drains for the buffer means
  // going for a throw/pull near the edge is a read, not a suicide. No stall risk:
  // requests always resolve within the clash window and pay full action costs.
  const requestBuffering =
    (player.clinchThrowRequest && !bufferExpired(player)) ||
    (opponent.clinchThrowRequest && !bufferExpired(opponent));
  if (requestBuffering) {
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // --- Balance and stamina effects ---
  // Identity: pressure taxes the LOSER. Pusher self-stam is a light lean (~2/s).
  // Plant is a paid brake (stam upkeep under push ≈ 4.5/s, bal regen nets ~0 mid-ring).

  // Grabber pushing
  if (grabberAction === "push") {
    player.balance = Math.max(0, player.balance - CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC * deltaSec);

    // Light lean cost (not the old 6.7/s "punished for winning" tax)
    if (!player.lastGrabStaminaDrainTime) player.lastGrabStaminaDrainTime = now;
    if (now - player.lastGrabStaminaDrainTime >= CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL) {
      player.stamina = Math.max(0, player.stamina - 1);
      player.lastGrabStaminaDrainTime = now;
    }

    if (opponentAction !== "push") {
      const edgeMult = isInEdgeZone(opponent.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      opponent.balance = Math.max(0, opponent.balance - CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC * edgeMult * deltaSec);
      // Neutral: pressure spends THEIR tank. Planters pay via plant upkeep.
      if (opponentAction !== "plant") {
        if (!opponent.lastGrabPushStaminaDrainTime) opponent.lastGrabPushStaminaDrainTime = now;
        if (now - opponent.lastGrabPushStaminaDrainTime >= CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL) {
          opponent.stamina = Math.max(0, opponent.stamina - 1);
          opponent.lastGrabPushStaminaDrainTime = now;
        }
      }
    }
  }

  // Grabber planting — brake: regen bal, pay stam (more under push)
  if (grabberAction === "plant") {
    if (!player.clinchJoltPlantInterrupt) {
      player.balance = Math.min(BALANCE_MAX, player.balance + CLINCH_PLANT_BALANCE_REGEN_PER_SEC * deltaSec);
    }
    const drainInterval = opponentAction === "push"
      ? CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL
      : CLINCH_PLANT_STAMINA_DRAIN_INTERVAL;
    if (!player.lastPlantStaminaDrainTime) player.lastPlantStaminaDrainTime = now;
    if (now - player.lastPlantStaminaDrainTime >= drainInterval) {
      player.stamina = Math.max(0, player.stamina - 1);
      player.lastPlantStaminaDrainTime = now;
    }
  }

  // Opponent pushing (only if they have grip)
  if (opponentAction === "push") {
    opponent.balance = Math.max(0, opponent.balance - CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC * deltaSec);

    if (!opponent.lastGrabStaminaDrainTime) opponent.lastGrabStaminaDrainTime = now;
    if (now - opponent.lastGrabStaminaDrainTime >= CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL) {
      opponent.stamina = Math.max(0, opponent.stamina - 1);
      opponent.lastGrabStaminaDrainTime = now;
    }

    if (grabberAction !== "push") {
      const edgeMult = isInEdgeZone(player.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      player.balance = Math.max(0, player.balance - CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC * edgeMult * deltaSec);
      if (grabberAction !== "plant") {
        if (!player.lastGrabPushStaminaDrainTime) player.lastGrabPushStaminaDrainTime = now;
        if (now - player.lastGrabPushStaminaDrainTime >= CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL) {
          player.stamina = Math.max(0, player.stamina - 1);
          player.lastGrabPushStaminaDrainTime = now;
        }
      }
    }
  }

  // Opponent planting — brake: regen bal, pay stam (more under push)
  if (opponentAction === "plant") {
    if (!opponent.clinchJoltPlantInterrupt) {
      opponent.balance = Math.min(BALANCE_MAX, opponent.balance + CLINCH_PLANT_BALANCE_REGEN_PER_SEC * deltaSec);
    }
    const drainInterval = grabberAction === "push"
      ? CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL
      : CLINCH_PLANT_STAMINA_DRAIN_INTERVAL;
    if (!opponent.lastPlantStaminaDrainTime) opponent.lastPlantStaminaDrainTime = now;
    if (now - opponent.lastPlantStaminaDrainTime >= drainInterval) {
      opponent.stamina = Math.max(0, opponent.stamina - 1);
      opponent.lastPlantStaminaDrainTime = now;
    }
  }

  // --- Neutral = breathing: recover stamina while not being pushed ---
  // Gassed players are excluded (the gassed system owns their recovery), and
  // being pushed while neutral stays a net loss — rest must be earned.
  for (const [p, pAction, oAction] of [
    [player, grabberAction, opponentAction],
    [opponent, opponentAction, grabberAction],
  ]) {
    if (pAction === "neutral" && oAction !== "push" && !p.isGassed && p.stamina < 100) {
      p.stamina = Math.min(100, p.stamina + CLINCH_NEUTRAL_STAMINA_REGEN_PER_SEC * deltaSec);
    }
  }

  // --- Deep grip: winning the push ---
  // Pushing continuously while the opponent doesn't answer with their own
  // push (they plant or stand neutral) for DEEP_GRIP_PUSH_WIN_MS earns the
  // deep grip. Any break in the condition resets the timer. Skip during the
  // Phase A burst and while the opponent is arm-clamped.
  for (const [p, o, pAction, oAction] of [
    [player, opponent, grabberAction, opponentAction],
    [opponent, player, opponentAction, grabberAction],
  ]) {
    const winningPush = pAction === "push" && oAction !== "push" &&
      p.hasGrip && o.hasGrip && !p.hasDeepGrip &&
      !player.isGrabPushing && !o.isArmClamped;
    if (winningPush) {
      if (!p.deepGripPushStart) {
        p.deepGripPushStart = now;
      } else if (now - p.deepGripPushStart >= DEEP_GRIP_PUSH_WIN_MS) {
        grantDeepGrip(p, o, room, io, "push");
        p.deepGripPushStart = 0;
      }
    } else if (p.deepGripPushStart) {
      p.deepGripPushStart = 0;
    }
  }

  // --- Push momentum ramp timer ---
  // Builds only while pushing an opponent who is standing NEUTRAL — plant and
  // push-back are both "answers" and reset it. Being neutral against a push
  // gets progressively more punishing the longer it goes unaddressed.
  for (const [p, pAction, oAction] of [
    [player, grabberAction, opponentAction],
    [opponent, opponentAction, grabberAction],
  ]) {
    if (pAction === "push" && oAction === "neutral") {
      if (!p.clinchPushRampStart) p.clinchPushRampStart = now;
    } else if (p.clinchPushRampStart) {
      p.clinchPushRampStart = 0;
    }
  }

  // --- Movement ---
  // Burst owns displacement this tick — don't double-apply Phase B shove.
  if (burstMovementApplied) {
    return;
  }

  let netPushSpeed = 0; // positive = toward opponent's side

  if (grabberAction === "push" && opponentAction === "push") {
    // Stamina tank decides who walks. Loser bleeds stam (walk snowballs) +
    // balance (throw window) — scaled by advantage. Winner only pays light lean.
    const { speed, t } = getPushVsPushSpeed(
      getShovePower(player) - getShovePower(opponent)
    );
    netPushSpeed = speed;
    if (speed > 0) {
      player.clinchShoveLead = 1;
      opponent.clinchShoveLead = -1;
    } else if (speed < 0) {
      player.clinchShoveLead = -1;
      opponent.clinchShoveLead = 1;
    } else {
      // Equal tanks — honest standstill. HUD shows EVEN.
      player.clinchShoveLead = 0;
      opponent.clinchShoveLead = 0;
    }
    if (t > 0) {
      const loser = speed >= 0 ? opponent : player;
      const edgeMult = isInEdgeZone(loser.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      loser.balance = Math.max(
        0,
        loser.balance - CLINCH_PUSH_VS_PUSH_LOSER_BAL_DRAIN_PER_SEC * t * edgeMult * deltaSec
      );
      loser.stamina = Math.max(
        0,
        loser.stamina - CLINCH_PUSH_VS_PUSH_LOSER_STAM_DRAIN_PER_SEC * t * deltaSec
      );
    }
  } else if (grabberAction === "push") {
    let speed = CLINCH_PUSH_BASE_SPEED * getPushForceMult(player);
    if (opponentAction === "plant") {
      speed *= CLINCH_PUSH_VS_PLANT_SPEED_MULT;
    } else {
      speed *= getPushRampMult(player, now); // neutral opponent → snowball
    }
    netPushSpeed = speed;
  } else if (opponentAction === "push") {
    let speed = CLINCH_PUSH_BASE_SPEED * getPushForceMult(opponent);
    if (grabberAction === "plant") {
      speed *= CLINCH_PUSH_VS_PLANT_SPEED_MULT;
    } else {
      speed *= getPushRampMult(opponent, now); // neutral opponent → snowball
    }
    netPushSpeed = -speed; // negative = toward grabber's side
  }

  // Apply movement
  if (Math.abs(netPushSpeed) > 0.001) {
    // Determine direction: positive netPushSpeed = grabber pushes opponent back
    const pushDir = player.x < opponent.x ? 1 : -1;
    const moveDelta = pushDir * netPushSpeed * delta * speedFactor;

    let newX = player.x + moveDelta;
    let newOppX = player.x < opponent.x
      ? newX + fixedDistance
      : newX - fixedDistance;

    // Boundary checks
    const oppAtLeft = newOppX <= leftBoundary;
    const oppAtRight = newOppX >= rightBoundary;
    const grabberAtLeft = newX <= leftBoundary;
    const grabberAtRight = newX >= rightBoundary;

    // Check opponent boundary (being pushed to edge)
    if ((oppAtLeft || oppAtRight) && !room.gameOver && netPushSpeed > 0) {
      player.isAtBoundaryDuringGrab = true;
      player.isEdgePushing = true;
      opponent.isBeingEdgePushed = true;
      clearEdgePinHold(player); // only the victim accumulates hold time
      // Extra stamina drain at edge — races the 1.5s positional hold
      if (!opponent.lastGrabPushStaminaDrainTime) opponent.lastGrabPushStaminaDrainTime = now;
      if (now - opponent.lastGrabPushStaminaDrainTime >= GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL) {
        opponent.stamina = Math.max(0, opponent.stamina - 1);
        opponent.lastGrabPushStaminaDrainTime = now;
      }
      if (tryEdgePinRingOut(player, opponent, room, io, rooms, oppAtLeft ? -1 : 1, now)) {
        return;
      }
      newOppX = oppAtLeft ? leftBoundary : rightBoundary;
      newX = player.x < opponent.x
        ? newOppX - fixedDistance
        : newOppX + fixedDistance;
    }
    // Check grabber boundary (being pushed back to edge)
    else if ((grabberAtLeft || grabberAtRight) && !room.gameOver && netPushSpeed < 0) {
      opponent.isAtBoundaryDuringGrab = true;
      opponent.isEdgePushing = true;
      player.isBeingEdgePushed = true;
      clearEdgePinHold(opponent);
      if (!player.lastGrabPushStaminaDrainTime) player.lastGrabPushStaminaDrainTime = now;
      if (now - player.lastGrabPushStaminaDrainTime >= GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabPushStaminaDrainTime = now;
      }
      if (tryEdgePinRingOut(opponent, player, room, io, rooms, grabberAtLeft ? -1 : 1, now)) {
        return;
      }
      newX = grabberAtLeft ? leftBoundary : rightBoundary;
      newOppX = player.x < opponent.x
        ? newX + fixedDistance
        : newX - fixedDistance;
    } else {
      player.isAtBoundaryDuringGrab = false;
      player.isEdgePushing = false;
      opponent.isBeingEdgePushed = false;
      opponent.isAtBoundaryDuringGrab = false;
      opponent.isEdgePushing = false;
      player.isBeingEdgePushed = false;
      clearEdgePinHold(player, opponent);
    }

    newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
    newOppX = Math.max(leftBoundary, Math.min(newOppX, rightBoundary));

    player.x = newX;
    opponent.x = newOppX;
  } else {
    // No movement — keep attached; pin hold breaks if shove isn't driving the wall
    player.isAtBoundaryDuringGrab = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    opponent.isAtBoundaryDuringGrab = false;
    opponent.isEdgePushing = false;
    player.isBeingEdgePushed = false;
    clearEdgePinHold(player, opponent);

    opponent.x = player.x < opponent.x
      ? player.x + fixedDistance
      : player.x - fixedDistance;
  }

  // Keep facing locked
  if (!opponent.atTheRopesFacingDirection) {
    opponent.facing = player.x < opponent.x ? 1 : -1;
  }
  if (!player.atTheRopesFacingDirection) {
    player.facing = player.x < opponent.x ? -1 : 1;
  }

  player.movementVelocity = 0;
  opponent.movementVelocity = 0;
}

// Maintain fixed distance between clinched players (used when movement is paused)
function maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary) {
  opponent.x = player.x < opponent.x
    ? player.x + fixedDistance
    : player.x - fixedDistance;
  // Boundary clamp: hard-attaching the opponent can place them past the map
  // edge when the grabber stands near it (jolt/clash freezes). Shift the PAIR
  // back inside while preserving the clinch distance — mirrors the boundary
  // pin used by the burst-push path.
  if (opponent.x > rightBoundary) {
    player.x -= opponent.x - rightBoundary;
    opponent.x = rightBoundary;
  } else if (opponent.x < leftBoundary) {
    player.x += leftBoundary - opponent.x;
    opponent.x = leftBoundary;
  }
  if (!opponent.atTheRopesFacingDirection) opponent.facing = player.x < opponent.x ? 1 : -1;
  if (!player.atTheRopesFacingDirection) player.facing = player.x < opponent.x ? -1 : 1;
  player.movementVelocity = 0;
  opponent.movementVelocity = 0;
}

// Clear active clinch throw/pull state
function clearClinchThrowState(actor) {
  actor.clinchThrowActive = false;
  actor.clinchThrowType = null;
  actor.clinchThrowStartTime = 0;
  actor.isClinchThrowing = false;
  actor.isAttemptingGrabThrow = false;
  actor.isAttemptingPull = false;
}

// Execute a clinch break — defensive escape from mutual clinch.
// Breaker pays heavy stamina (gasses if under-budget). Stamina only — no posture cost.
// Both players are knocked apart symmetrically (boundary-clamped, so edge stress
// is preserved — the breaker can't escape an edge corner this way).
// Breaker gets brief grab-immunity after the tween so the opponent can't immediately re-clinch.
function executeClinchBreak(breaker, opponent, room, io) {
  const now = simNow(room);

  // Apply stamina cost to the breaker. Soft-gate: stamina goes negative-clamped, and
  // the natural gassed mechanism in index.js auto-triggers when stamina hits 0.
  breaker.stamina = Math.max(0, breaker.stamina - GRAB_BREAK_STAMINA_COST);

  cleanupGrabStates(breaker, opponent);

  // Set break visual states — both players animate together.
  breaker.isGrabBreaking = true;
  opponent.isGrabBreakCountered = true;

  // Symmetric separation tween. Boundary clamp preserves edge position
  // (a breaker pinned at the edge stays at the edge — they can't escape positionally).
  const halfDist = GRAB_BREAK_FORCED_DISTANCE / 2;
  const breakerDir = breaker.x < opponent.x ? -1 : 1;
  const opponentDir = -breakerDir;
  const breakerTargetX = Math.max(MAP_LEFT_BOUNDARY,
    Math.min(MAP_RIGHT_BOUNDARY, breaker.x + breakerDir * halfDist));
  const opponentTargetX = Math.max(MAP_LEFT_BOUNDARY,
    Math.min(MAP_RIGHT_BOUNDARY, opponent.x + opponentDir * halfDist));

  // Wire the tween — index.js drives it via grabBreakSepStartTime/Duration/Start/Target,
  // and the same end-of-tween handler clears isGrabBreaking/isGrabBreakCountered.
  for (const [p, targetX] of [[breaker, breakerTargetX], [opponent, opponentTargetX]]) {
    p.isGrabBreakSeparating = true;
    p.grabBreakSepStartTime = now;
    p.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
    p.grabBreakStartX = p.x;
    p.grabBreakTargetX = targetX;
    p.movementVelocity = 0;
    p.knockbackVelocity.x = 0;
    p.knockbackVelocity.y = 0;
    p.isStrafing = false;
  }

  // Symmetric input lock for both players — clinch break always resolves to a
  // 100% neutral state regardless of breaker position. Boundary-clamped slides
  // (one or both players being unable to slide the full halfDist because of the
  // map edge) do NOT shorten or lengthen the recovery window; the lock is a
  // fixed 350ms timer independent of actual distance traveled.
  //
  // Corner stress is already preserved through the positional and resource
  // costs (breaker stays pinned at the edge, loses 30 stamina) — there's no
  // need to layer a timing disadvantage on top of those.
  breaker.inputLockUntil = Math.max(breaker.inputLockUntil || 0, now + GRAB_BREAK_INPUT_LOCK_MS);
  opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, now + GRAB_BREAK_INPUT_LOCK_MS);

  // Re-grab protection on the breaker — covers the tween + a small post-tween window
  // so the opponent can't punish-grab the moment they recover.
  breaker.grabImmune = true;
  breaker.grabImmuneEndTime = now + GRAB_BREAK_INPUT_LOCK_MS + GRAB_BREAK_GRAB_IMMUNITY_MS;

  // Facing — players face each other after separating
  correctFacingAfterGrabOrThrow(breaker, opponent);

  // Reset stalemate timers (the clinch is ending)
  breaker.clinchStalemateStart = 0;
  opponent.clinchStalemateStart = 0;

  // Emit visual/audio event. breakerPlayerNumber: room.players[0] = 1, [1] = 2.
  const breakerPlayerNumber = room.players.indexOf(breaker) === 0 ? 1 : 2;
  io.in(room.id).emit("grab_break", {
    breakerId: breaker.id,
    grabberId: opponent.id,
    breakerX: breaker.x,
    grabberX: opponent.x,
    breakId: `break-${now}-${breaker.id}`,
    breakerPlayerNumber,
  });
}

// Resolve throw/pull outcome after committed animation ends
// Both throw and pull are gated by opponent balance the same way.
// The difference is the mechanic when it lands: throw = arc, pull = tween.
function resolveClinchThrow(actor, target, room, io, rooms) {
  const actionType = actor.clinchThrowType;
  const targetBalance = target.balance;

  clearClinchThrowState(actor);
  target.isResistingThrow = false;
  target.isResistingPull = false;
  actor.clinchThrowCooldown = true;
  setPlayerTimeout(actor.id, () => { actor.clinchThrowCooldown = false; }, CLINCH_THROW_COOLDOWN_MS, "clinchThrowCooldown");

  // DEEP GRIP: the holder's throws/pulls land against higher balance —
  // the payoff that makes earning the grip worth playing for.
  const landThreshold = CLINCH_THROW_LAND_THRESHOLD +
    (actor.hasDeepGrip ? DEEP_GRIP_THROW_THRESHOLD_BONUS : 0);

  // --- FAIL: opponent balance above land threshold → stay in clinch ---
  if (targetBalance > landThreshold) {
    // Over-committed: a failed attempt costs the deep grip along with the stagger
    actor.hasDeepGrip = false;
    target.balance = Math.max(0, target.balance - CLINCH_THROW_FAIL_BALANCE_DRAIN);
    const selfBalDrain = actionType === "pull"
      ? CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN
      : CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN;
    actor.balance = Math.max(0, actor.balance - selfBalDrain);
    actor.stamina = Math.max(0, actor.stamina - CLINCH_THROW_FAIL_STAMINA_COST);

    // Attacker visibly stumbles — a readable punish moment for the defender.
    // Forced neutral (can't push/plant/jolt/throw/break) for the stagger window,
    // which makes throw-baiting a teachable strategy instead of silent attrition.
    actor.clinchThrowFailStagger = true;
    setPlayerTimeout(actor.id, () => {
      actor.clinchThrowFailStagger = false;
    }, CLINCH_THROW_FAIL_STAGGER_MS, "clinchThrowFailStagger");

    io.in(room.id).emit("clinch_throw_fail", {
      actorId: actor.id,
      targetId: target.id,
      actionType,
      actorX: actor.x,
      targetX: target.x,
      // RESISTED credits the defender — banner anchors to their side
      playerNumber: room.players.indexOf(target) === 0 ? 1 : 2,
      failId: `clinch-fail-${simNow(room)}-${actor.id}`,
    });
    return;
  }

  // --- KILL: opponent balance below kill threshold → round over ---
  const isKill = targetBalance < CLINCH_THROW_KILL_THRESHOLD && !room.gameOver;

  if (actionType === "pull") {
    // Snapshot the victim's facing before any facing-correction — kill pulls
    // preserve it so the belly-laying slam stays oriented as the victim was.
    const targetFacingBeforeKill = target.facing;
    const pullDirection = target.x < actor.x ? 1 : -1;
    const pullDist = isKill ? CLINCH_KILL_PULL_DISTANCE : CLINCH_PULL_DISTANCE;
    const pullTweenDur = isKill ? CLINCH_KILL_PULL_TWEEN_DURATION : CLINCH_PULL_TWEEN_DURATION;
    const pullLockMs = isKill ? CLINCH_KILL_PULL_INPUT_LOCK_MS : CLINCH_PULL_INPUT_LOCK_MS;
    // Kill pull drives the opponent THROUGH the thrower and down — same travel
    // direction as the non-kill pull (past the puller), just slammed onto the ice.
    let targetX = actor.x + pullDirection * pullDist;

    // Boundary pull detection: when the puller's back is against a wall,
    // a normal pull can't send the target far enough past for a clean side switch.
    // Use a position swap instead — both players trade positions with a hop arc.
    // Kill pulls bypass this — the victim must fly past the puller and through
    // the dohyo edge for the cinematic, regardless of where the puller is standing.
    const leftBound = MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN;
    const rightBound = MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN;
    const clampedTargetX = Math.max(leftBound, Math.min(targetX, rightBound));
    const distPastActor = pullDirection === -1
        ? actor.x - clampedTargetX
        : clampedTargetX - actor.x;
    const isBoundaryPull = !isKill && distPastActor < CLINCH_THROW_MIN_SEPARATION;

    let actorTweenTargetX = null;
    let effectiveTweenDur = pullTweenDur;
    let effectiveLockMs = pullLockMs;

    if (isBoundaryPull) {
      const actorOriginalX = actor.x;
      const targetOriginalX = target.x;
      targetX = Math.max(leftBound, Math.min(actorOriginalX, rightBound));
      actorTweenTargetX = targetOriginalX;
      effectiveTweenDur = CLINCH_PULL_SWAP_TWEEN_DURATION;
      effectiveLockMs = CLINCH_PULL_SWAP_TWEEN_DURATION;
    }

    cleanupGrabStates(actor, target);

    target.isBeingPullReversaled = true;
    target.pullReversalPullerId = actor.id;
    target.isGrabBreakSeparating = true;
    target.grabBreakSepStartTime = simNow(room);
    target.grabBreakSepDuration = effectiveTweenDur;
    target.grabBreakStartX = target.x;
    target.grabBreakTargetX = targetX;

    if (isBoundaryPull) {
      target.isBoundaryPullSwap = true;
      actor.isBoundaryPullSwap = true;
      actor.isGrabBreakSeparating = true;
      actor.grabBreakSepStartTime = simNow(room);
      actor.grabBreakSepDuration = effectiveTweenDur;
      actor.grabBreakStartX = actor.x;
      actor.grabBreakTargetX = actorTweenTargetX;
    }

    target.movementVelocity = 0;
    actor.movementVelocity = 0;
    target.isStrafing = false;
    actor.isStrafing = false;

    const lockUntil = simNow(room) + effectiveLockMs;
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, lockUntil);
    actor.inputLockUntil = Math.max(actor.inputLockUntil || 0, lockUntil);

    // Face using post-pull destinations — the victim switches sides during the
    // tween, so correcting from current X leaves both facing away after the yank.
    // (Tween end also re-corrects once positions have fully settled.)
    const pullFacingAnchorX = isBoundaryPull ? actorTweenTargetX : actor.x;
    if (!actor.atTheRopesFacingDirection) {
      actor.facing = pullFacingAnchorX < targetX ? -1 : 1;
    }
    if (!target.atTheRopesFacingDirection) {
      target.facing = targetX < pullFacingAnchorX ? -1 : 1;
    }

    if (isKill) {
      target.isClinchKillPullVictim = true;
      handleWinCondition(room, target, actor, io, "clinchKillPull");
      // Re-assert after win cleanup so MAP boundary exemption stays armed.
      target.isClinchKillPullVictim = true;
      target.isBeingPullReversaled = true;
      target.pullReversalPullerId = actor.id;
      target.isGrabBreakSeparating = true;
      target.grabBreakSepStartTime = simNow(room);
      target.grabBreakSepDuration = effectiveTweenDur;
      target.grabBreakStartX = target.x;
      target.grabBreakTargetX = targetX;
      // Belly-laying finisher: the victim is slammed flat where they stand, so
      // keep whatever direction they were already facing (no flip toward the pull).
      target.facing = targetFacingBeforeKill;
    }

    actor.grabCooldown = true;
    setPlayerTimeout(actor.id, () => { actor.grabCooldown = false; }, 300, "pullCooldown");
  } else {
    // Throw lands: forward arc throw — pushes opponent away from thrower
    const throwDir = actor.x < target.x ? 1 : -1;
    const throwDuration = isKill ? CLINCH_KILL_THROW_DURATION_MS : CLINCH_THROW_DURATION_MS;

    cleanupGrabStates(actor, target);
    actor.isThrowing = true;
    actor.isClinchKillThrow = isKill;
    const hitstopMs = isKill ? 0 : HITSTOP_THROW_MS;
    // Sim clock pauses during the throw hitstop triggered below, so the throw
    // arc starts right after the freeze with NO manual +hitstopMs offset
    // (the old wall-clock version had to delay throwStartTime past the freeze).
    actor.throwStartTime = simNow(room);
    actor.throwEndTime = simNow(room) + throwDuration;
    actor.throwOpponent = target.id;
    actor.throwingFacingDirection = throwDir;
    // Non-kill throws are repositioning tools — keep victim inside the margin so
    // the tick-order win check can't ring them out while still pinned at the edge.
    if (!isKill) {
      const leftBound = MAP_LEFT_BOUNDARY + CLINCH_THROW_BOUNDARY_MARGIN;
      const rightBound = MAP_RIGHT_BOUNDARY - CLINCH_THROW_BOUNDARY_MARGIN;
      target.x = Math.max(leftBound, Math.min(target.x, rightBound));
    }
    clearAllActionStates(target);
    target.isBeingThrown = true;
    target.isHit = true;
    target.beingThrownFacingDirection = target.facing;
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, simNow(room) + throwDuration + 100);
    if (isKill) {
      target.isClinchKillThrowVictim = true;
      io.in(room.id).emit("clinch_kill_throw", {
        victimId: target.id,
        throwerId: actor.id,
        victimX: target.x,
        hitstopMs: 0,
        durationMs: throwDuration,
        throwDir,
      });
    }
    if (hitstopMs > 0) triggerHitstopAndEmit(io, room, hitstopMs, "clinch_throw");
  }
}

function triggerRingOut(pusher, victim, room, io, rooms, direction) {
  pusher.isGrabBellyFlopping = pusher.isAtBoundaryDuringGrab;
  victim.isBeingGrabBellyFlopped = pusher.isAtBoundaryDuringGrab;
  if (!pusher.isAtBoundaryDuringGrab) {
    pusher.isGrabFrontalForceOut = true;
    victim.isBeingGrabFrontalForceOut = true;
  }

  pusher.isRingOutFreezeActive = true;
  pusher.ringOutFreezeEndTime = simNow(room) + 200;
  pusher.ringOutThrowDirection = direction;
  pusher.pendingRingOutThrowTarget = victim.id;

  setPlayerTimeout(
    pusher.id,
    () => {
      const currentRoom = rooms.find((r) => r.id === room.id);
      if (!currentRoom) return;
      const grabberRef = currentRoom.players.find((p) => p.id === pusher.id);
      const grabbedRef = currentRoom.players.find((p) => p.id === victim.id);
      if (!grabberRef || !grabbedRef) return;

      grabberRef.isRingOutFreezeActive = false;
      grabberRef.isGrabbing = false;
      grabberRef.grabbedOpponent = null;
      grabberRef.isGrabFrontalForceOut = false;
      grabberRef.isGrabBellyFlopping = false;
      grabberRef.isGrabPushing = false;
      grabberRef.isEdgePushing = false;
      grabberRef.hasGrip = false;
      grabberRef.inClinch = false;
      grabberRef.isClinchPushing = false;
      grabberRef.isClinchPlanting = false;
      grabberRef.isResistingThrow = false;
      grabberRef.isResistingPull = false;
      grabberRef.isClinchJolting = false;
      grabberRef.clinchJoltRecovery = false;
      grabberRef.clinchJoltCooldown = false;
      grabberRef.isBeingClinchJolted = false;
      grabberRef.isClinchJoltClashing = false;
      grabberRef.clinchJoltPlantInterrupt = false;
      grabbedRef.isBeingGrabbed = false;
      grabbedRef.isBeingGrabFrontalForceOut = false;
      grabbedRef.isBeingGrabBellyFlopped = false;
      grabbedRef.isBeingGrabPushed = false;
      grabbedRef.isBeingEdgePushed = false;
      grabbedRef.hasGrip = false;
      grabbedRef.inClinch = false;
      grabbedRef.isClinchPushing = false;
      grabbedRef.isClinchPlanting = false;
      grabbedRef.isResistingThrow = false;
      grabbedRef.isResistingPull = false;
      grabbedRef.isClinchJolting = false;
      grabbedRef.clinchJoltRecovery = false;
      grabbedRef.clinchJoltCooldown = false;
      grabbedRef.isBeingClinchJolted = false;
      grabbedRef.isClinchJoltClashing = false;
      grabbedRef.clinchJoltPlantInterrupt = false;
      grabbedRef.isArmClamped = false;
      grabberRef.clinchThrowFailStagger = false;
      grabbedRef.clinchThrowFailStagger = false;
      grabberRef.hasDeepGrip = false;
      grabbedRef.hasDeepGrip = false;
      grabberRef.clinchShoveLead = null;
      grabbedRef.clinchShoveLead = null;
      grabberRef.deepGripPushStart = 0;
      grabbedRef.deepGripPushStart = 0;
      grabberRef.clinchPushRampStart = 0;
      grabbedRef.clinchPushRampStart = 0;

      grabberRef.isThrowing = true;
      grabberRef.throwStartTime = simNow(currentRoom);
      grabberRef.throwEndTime = simNow(currentRoom) + RINGOUT_THROW_DURATION_MS;
      grabberRef.throwOpponent = grabbedRef.id;

      clearAllActionStates(grabbedRef);
      grabbedRef.isBeingThrown = true;

      grabberRef.throwingFacingDirection = grabberRef.ringOutThrowDirection || 1;
      grabbedRef.beingThrownFacingDirection = grabbedRef.facing;

      grabberRef.isRingOutThrowCutscene = true;
      grabberRef.ringOutThrowDistance = 5;
      grabberRef.ringOutThrowDirection = null;
      grabberRef.pendingRingOutThrowTarget = null;
    },
    200,
    "ringOutFreezeDelay"
  );

  handleWinCondition(room, victim, pusher, io, "grabPush");
  victim.knockbackVelocity = { ...victim.knockbackVelocity };
}

module.exports = { updateGrabActions, grantDeepGrip };

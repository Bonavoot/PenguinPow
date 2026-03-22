const {
  GRAB_PUSH_BURST_BASE, GRAB_PUSH_MOMENTUM_TRANSFER,
  GRAB_PUSH_DECAY_RATE, GRAB_PUSH_MIN_VELOCITY, GRAB_PUSH_MAX_DURATION,
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
  CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL,
  CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL,
  CLINCH_PUSH_VS_PUSH_SPEED_SCALE,
  CLINCH_GASSED_PUSH_MULT,
  CLINCH_STALEMATE_DURATION_MS,
  CLINCH_STALEMATE_MOVEMENT_THRESHOLD,
  CLINCH_STALEMATE_BALANCE_THRESHOLD,
  CLINCH_ATTACHED_DISTANCE,
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
  CLINCH_CLASH_BALANCE_DRAIN,
  CLINCH_CLASH_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_PULL_DISTANCE,
  CLINCH_PULL_TWEEN_DURATION,
  CLINCH_PULL_INPUT_LOCK_MS,
  CLINCH_LIFT_TOTAL_MS,
  CLINCH_LIFT_RISE_MS,
  CLINCH_LIFT_DESCEND_MS,
  CLINCH_LIFT_Y_OFFSET,
  CLINCH_LIFT_BALANCE_COST,
  CLINCH_LIFT_STAMINA_COST,
  CLINCH_LIFT_TARGET_BALANCE_DRAIN,
  HITSTOP_THROW_MS,
  GROUND_LEVEL,
  speedFactor,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_THROW_HITSTOP_MS,
  CLINCH_KILL_PULL_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  CLINCH_KILL_LIFT_TOTAL_MS,
  CLINCH_KILL_LIFT_RISE_MS,
  CLINCH_JOLT_ANIMATION_MS,
  CLINCH_JOLT_RECOVERY_MS,
  CLINCH_JOLT_COOLDOWN_MS,
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
} = require("./constants");

const {
  setPlayerTimeout,
  clearAllActionStates,
  triggerHitstop,
  emitThrottledScreenShake,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");

const { correctFacingAfterGrabOrThrow, executeClinchSeparation } = require("./grabMechanics");
const { cleanupGrabStates, handleWinCondition } = require("./gameFunctions");

function getGassedMult(player) {
  return player.isGassed ? CLINCH_GASSED_PUSH_MULT : 1;
}

function isInEdgeZone(playerX) {
  return playerX <= MAP_LEFT_BOUNDARY + CLINCH_EDGE_ZONE_THRESHOLD ||
         playerX >= MAP_RIGHT_BOUNDARY - CLINCH_EDGE_ZONE_THRESHOLD;
}

function getClinchAction(player, opponent) {
  if (!player.hasGrip) return "neutral";

  const towardKey = player.x < opponent.x ? 'd' : 'a';
  const awayKey = player.x < opponent.x ? 'a' : 'd';
  const pressingToward = player.keys[towardKey] && !player.keys[awayKey];
  const pressingAway = player.keys[awayKey] && !player.keys[towardKey];
  const pressingS = player.keys.s;

  // Plant: S + away (down-back commitment, like a fighting game block)
  if (pressingS && pressingAway) return "plant";
  // Push: toward opponent
  if (pressingToward) return "push";
  return "neutral";
}

function updateGrabActions(player, room, io, delta, rooms) {
  // Only process for the player who initiated the grab (isGrabbing)
  if (!player.isGrabbing || !player.grabbedOpponent) return;
  // Skip during throw/pull animation states (Phase 4 will handle these)
  if (player.isThrowing || player.isBeingThrown) return;

  const opponent = room.players.find((p) => p.id === player.grabbedOpponent);
  if (!opponent) {
    // Orphan grab safety
    const grabDuration = Date.now() - player.grabStartTime;
    if (grabDuration >= 500) {
      player.isGrabbing = false;
      player.grabbedOpponent = null;
    }
    return;
  }

  // Clear one-shot flags from previous tick
  player.liftFailedGassed = false;
  opponent.liftFailedGassed = false;

  const deltaSec = delta / 1000;
  const leftBoundary = MAP_LEFT_BOUNDARY;
  const rightBoundary = MAP_RIGHT_BOUNDARY;
  const fixedDistance = CLINCH_ATTACHED_DISTANCE * (opponent.sizeMultiplier || 1);

  // ============================================
  // PHASE A: ONE-SIDED GRIP (auto-burst push)
  // Grabber has grip, opponent does not yet.
  // Auto-burst push fires and decays. Grabber retains grip when burst ends.
  // A throw/pull/lift request cancels the burst push immediately.
  // ============================================
  if (player.hasGrip && !opponent.hasGrip && player.isGrabPushing && player.clinchThrowRequest) {
    player.isGrabPushing = false;
    opponent.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    player.isAtBoundaryDuringGrab = false;
    player.grabPushStartTime = 0;
    player.clinchAction = "neutral";
    opponent.clinchAction = "neutral";
    // Fall through to Phase B where throw request will be processed
  }
  if (player.hasGrip && !opponent.hasGrip && player.isGrabPushing) {
    if (!player.grabPushStartTime) {
      player.grabPushStartTime = Date.now();
      opponent.isBeingGrabPushed = true;
    }

    const pushElapsed = Date.now() - player.grabPushStartTime;
    const pushElapsedSec = pushElapsed / 1000;

    // Calculate burst push speed (exponential decay)
    const initialPushSpeed = GRAB_PUSH_BURST_BASE + (player.grabApproachSpeed || 0) * GRAB_PUSH_MOMENTUM_TRANSFER;
    let currentPushSpeed = initialPushSpeed * Math.exp(-GRAB_PUSH_DECAY_RATE * pushElapsedSec);

    // When burst decays below threshold, transition to manual clinch push
    if (currentPushSpeed < GRAB_PUSH_MIN_VELOCITY && pushElapsed > 200) {
      player.isGrabPushing = false;
      opponent.isBeingGrabPushed = false;
      player.grabPushStartTime = 0;
      // Grabber retains grip — NO auto-separation. Transition to clinch idle.
      player.clinchAction = "neutral";
      opponent.clinchAction = "neutral";
      // Don't return — fall through to clinch processing below
    } else {
      // Stamina drain during burst push — pusher always drains
      if (!player.lastGrabStaminaDrainTime) {
        player.lastGrabStaminaDrainTime = Date.now();
      }
      if (Date.now() - player.lastGrabStaminaDrainTime >= GRAB_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabStaminaDrainTime = Date.now();
      }

      // Opponent stamina drain during burst push (slower than pusher, faster at edge)
      if (!opponent.lastGrabPushStaminaDrainTime) {
        opponent.lastGrabPushStaminaDrainTime = Date.now();
      }
      const drainInterval = player.isAtBoundaryDuringGrab
        ? GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL
        : GRAB_PUSH_STAMINA_DRAIN_INTERVAL;
      if (Date.now() - opponent.lastGrabPushStaminaDrainTime >= drainInterval) {
        opponent.stamina = Math.max(0, opponent.stamina - 1);
        opponent.lastGrabPushStaminaDrainTime = Date.now();
      }

      // Still in burst push — apply movement
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
        if (opponent.stamina <= 0) {
          triggerRingOut(player, opponent, room, io, rooms, opponentAtLeft ? -1 : 1);
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
      return;
    }
  }

  // ============================================
  // PHASE B: CLINCH (at least grabber has grip)
  // If opponent doesn't have grip yet, they can only be pushed (no plant, no throw)
  // Once opponent grips up (Mouse2), both can push/plant
  // ============================================

  // Clear stale burst-push flags — Phase A is over once we reach Phase B
  if (player.isGrabPushing) {
    player.isGrabPushing = false;
    opponent.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    player.isAtBoundaryDuringGrab = false;
    player.grabPushStartTime = 0;
  }

  // Determine each player's clinch action
  const grabberAction = getClinchAction(player, opponent);
  const opponentAction = opponent.hasGrip ? getClinchAction(opponent, player) : "neutral";

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
    player.clinchStalemateStart = Date.now();
    player.clinchStalemateLastX = player.x;
    player.clinchStalemateLastBalance = player.balance;
  }
  const stalemateElapsed = Date.now() - player.clinchStalemateStart;
  const posChanged = Math.abs(player.x - (player.clinchStalemateLastX || player.x)) > CLINCH_STALEMATE_MOVEMENT_THRESHOLD;
  const balChanged = Math.abs(player.balance - (player.clinchStalemateLastBalance || player.balance)) > CLINCH_STALEMATE_BALANCE_THRESHOLD;
  if (posChanged || balChanged) {
    player.clinchStalemateStart = Date.now();
    player.clinchStalemateLastX = player.x;
    player.clinchStalemateLastBalance = player.balance;
  }
  if (stalemateElapsed >= CLINCH_STALEMATE_DURATION_MS && !room.gameOver) {
    executeClinchSeparation(player, opponent, room, io);
    return;
  }

  const now = Date.now();

  // ============================================
  // CLINCH JOLT (Mouse1) — quick balance-damage shove
  // Processed before throw/pull/lift — recovery blocks those actions
  // ============================================

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
          setPlayerTimeout(p.id, () => { p.clinchJoltCooldown = false; }, CLINCH_JOLT_COOLDOWN_MS, "clinchJoltCooldown");
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

      player.balance = Math.max(0, player.balance - CLINCH_JOLT_MUTUAL_BALANCE);
      opponent.balance = Math.max(0, opponent.balance - CLINCH_JOLT_MUTUAL_BALANCE);
      player.stamina = Math.max(0, player.stamina - CLINCH_JOLT_STAMINA_COST);
      opponent.stamina = Math.max(0, opponent.stamina - CLINCH_JOLT_STAMINA_COST);

      triggerHitstop(room, CLINCH_JOLT_MUTUAL_HITSTOP_MS);
      emitThrottledScreenShake(room, io, { intensity: 2.2, duration: 160 });
      io.in(room.id).emit("clinch_jolt", {
        jolterId: player.id,
        targetId: opponent.id,
        jolterX: player.x,
        targetX: opponent.x,
        type: "mutual",
        direction: 0,
      });

      player.clinchStalemateStart = now;
      opponent.clinchStalemateStart = now;
      player.clinchStalemateLastBalance = player.balance;
      opponent.clinchStalemateLastBalance = opponent.balance;
    }
  }

  // --- Process single jolt ---
  for (const [jolter, target] of [[player, opponent], [opponent, player]]) {
    if (!jolter.clinchJoltRequest || jolter.isClinchJolting || jolter.isClinchJoltClashing) continue;

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

    // Micro-push: move both players toward the target's side
    const pushDir = jolter.x < target.x ? 1 : -1;
    const halfPush = pushDist / 2;
    jolter.x = Math.max(leftBoundary, Math.min(rightBoundary, jolter.x + pushDir * halfPush));
    target.x = Math.max(leftBoundary, Math.min(rightBoundary, target.x + pushDir * halfPush));

    jolter.isClinchJolting = true;
    jolter.clinchJoltStartTime = now;
    target.isBeingClinchJolted = true;
    target.clinchJoltRecoilStart = now;

    target.inputLockUntil = Math.max(target.inputLockUntil || 0, now + lockoutMs);

    if (targetAction === "plant") {
      target.clinchJoltPlantInterrupt = true;
      target.clinchJoltPlantInterruptStart = now;
    }

    triggerHitstop(room, CLINCH_JOLT_HITSTOP_MS);
    emitThrottledScreenShake(room, io, { intensity: 1.8, duration: 140 });
    io.in(room.id).emit("clinch_jolt", {
      jolterId: jolter.id,
      targetId: target.id,
      jolterX: jolter.x,
      targetX: target.x,
      type: "single",
      direction: pushDir,
    });

    // Stalemate reset
    jolter.clinchStalemateStart = now;
    target.clinchStalemateStart = now;
    jolter.clinchStalemateLastBalance = jolter.balance;
    target.clinchStalemateLastBalance = target.balance;
    jolter.clinchStalemateLastX = jolter.x;
    target.clinchStalemateLastX = target.x;
  }

  // --- Block actions during jolt recovery ---
  for (const p of [player, opponent]) {
    if (p.clinchJoltRecovery) {
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

  // --- Start new throw/pull/lift from request ---
  // ALL clinch actions buffer for the clash window so the opponent has time to tech.
  const bufferExpired = (p) =>
    (now - (p.clinchThrowRequestTime || 0)) > CLINCH_THROW_CLASH_WINDOW_MS;

  const requesters = [];
  if (player.clinchThrowRequest && !player.clinchThrowActive && !player.clinchThrowCooldown &&
      !player.isResistingThrow && !player.isResistingPull && !player.isBeingLifted &&
      !player.clinchJoltRecovery && !player.isClinchJolting &&
      bufferExpired(player)) requesters.push(player);
  if (opponent.clinchThrowRequest && !opponent.clinchThrowActive && !opponent.clinchThrowCooldown && opponent.hasGrip &&
      !opponent.isResistingThrow && !opponent.isResistingPull && !opponent.isBeingLifted &&
      !opponent.clinchJoltRecovery && !opponent.isClinchJolting &&
      bufferExpired(opponent)) requesters.push(opponent);

  for (const actor of requesters) {
    const target = actor === player ? opponent : player;
    const actionType = actor.clinchThrowRequest;

    // Gassed players can't lift — requires strength
    if (actionType === "lift" && actor.isGassed) {
      actor.clinchThrowRequest = null;
      actor.clinchThrowRequestTime = 0;
      actor.liftFailedGassed = true;
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

    if (actionType === "throw" || actionType === "pull") {
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
      let balanceDrain;
      if (actionType === "pull") {
        balanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL;
        if (targetAction === "push") balanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_PUSH;
        else if (targetAction === "plant") balanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_PLANT;
        if (isInEdgeZone(target.x)) balanceDrain += CLINCH_EDGE_PULL_DRAIN_BONUS;
      } else {
        balanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL;
        if (targetAction === "push") balanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_PUSH;
        else if (targetAction === "plant") balanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_PLANT;
        if (isInEdgeZone(target.x)) balanceDrain += CLINCH_EDGE_THROW_DRAIN_BONUS;
      }
      target.balance = Math.max(0, target.balance - balanceDrain);
    } else if (actionType === "lift") {
      actor.isClinchLifting = true;
      actor.clinchLiftStartTime = now;
      actor.stamina = Math.max(0, actor.stamina - CLINCH_LIFT_STAMINA_COST);
      actor.balance = Math.max(0, actor.balance - CLINCH_LIFT_BALANCE_COST);
      target.balance = Math.max(0, target.balance - CLINCH_LIFT_TARGET_BALANCE_DRAIN);
      target.isBeingLifted = true;
      actor.isClinchKillLift = target.balance < CLINCH_THROW_KILL_THRESHOLD;
    }
    actor.clinchStalemateStart = now;
  }

  // --- Safety: clear stale target states when no active action exists ---
  const activeActor = player.clinchThrowActive ? player : (opponent.clinchThrowActive ? opponent : null);
  if (!activeActor) {
    if (player.isBeingLifted) { player.isBeingLifted = false; player.y = GROUND_LEVEL; }
    if (opponent.isBeingLifted) { opponent.isBeingLifted = false; opponent.y = GROUND_LEVEL; }
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

  // --- Process active lift/carry ---
  if (activeActor && activeActor.clinchThrowType === "lift") {
    const activeTarget = activeActor === player ? opponent : player;
    const elapsed = now - activeActor.clinchLiftStartTime;
    const isKillLift = activeActor.isClinchKillLift;
    const totalMs = isKillLift ? CLINCH_KILL_LIFT_TOTAL_MS : CLINCH_LIFT_TOTAL_MS;
    const riseMs = isKillLift ? CLINCH_KILL_LIFT_RISE_MS : CLINCH_LIFT_RISE_MS;
    const descendMs = CLINCH_LIFT_DESCEND_MS;
    const moveMs = totalMs - riseMs - descendMs;

    if (elapsed < riseMs) {
      const riseProgress = elapsed / riseMs;
      activeTarget.y = GROUND_LEVEL + CLINCH_LIFT_Y_OFFSET * riseProgress;
    } else if (elapsed < riseMs + moveMs) {
      activeTarget.y = GROUND_LEVEL + CLINCH_LIFT_Y_OFFSET;
      const moveProgress = (elapsed - riseMs) / moveMs;
      const mapWidth = rightBoundary - leftBoundary;
      const liftDir = activeActor.x < activeTarget.x ? 1 : -1;

      let liftDistance;
      if (isKillLift) {
        const distToEdge = liftDir === 1
          ? rightBoundary - (activeActor.clinchLiftStartX || activeActor.x)
          : (activeActor.clinchLiftStartX || activeActor.x) - leftBoundary;
        liftDistance = distToEdge + fixedDistance;
      } else {
        liftDistance = mapWidth * 0.15;
      }

      const totalMove = liftDistance * moveProgress;
      const baseX = activeActor.clinchLiftStartX || activeActor.x;
      let newActorX = baseX + liftDir * totalMove;
      let newTargetX = activeActor.x < activeTarget.x
        ? newActorX + fixedDistance
        : newActorX - fixedDistance;
      if (!activeActor.clinchLiftStartX) activeActor.clinchLiftStartX = activeActor.x;

      const targetAtBoundary = newTargetX <= leftBoundary || newTargetX >= rightBoundary;
      if (targetAtBoundary) {
        if (isKillLift && !room.gameOver) {
          const dir = newTargetX <= leftBoundary ? -1 : 1;
          endClinchLift(activeActor, activeTarget);
          triggerRingOut(activeActor, activeTarget, room, io, rooms, dir);
          return;
        }
        if (!isKillLift && activeTarget.stamina > 0) {
          endClinchLift(activeActor, activeTarget);
          maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
          return;
        }
      }
      newActorX = Math.max(leftBoundary, Math.min(newActorX, rightBoundary));
      newTargetX = Math.max(leftBoundary, Math.min(newTargetX, rightBoundary));
      activeActor.x = newActorX;
      activeTarget.x = newTargetX;
    } else if (elapsed < totalMs) {
      const descendProgress = (elapsed - riseMs - moveMs) / descendMs;
      activeTarget.y = GROUND_LEVEL + CLINCH_LIFT_Y_OFFSET * (1 - descendProgress);
    } else {
      endClinchLift(activeActor, activeTarget);
      const targetAtBoundary = activeTarget.x <= leftBoundary || activeTarget.x >= rightBoundary;
      if (targetAtBoundary && (activeTarget.stamina <= 0 || isKillLift) && !room.gameOver) {
        const dir = activeTarget.x <= leftBoundary ? -1 : 1;
        triggerRingOut(activeActor, activeTarget, room, io, rooms, dir);
        return;
      }
    }

    if (!player.atTheRopesFacingDirection) player.facing = player.x < opponent.x ? -1 : 1;
    if (!opponent.atTheRopesFacingDirection) opponent.facing = player.x < opponent.x ? 1 : -1;
    player.movementVelocity = 0;
    opponent.movementVelocity = 0;
    return;
  }

  // --- Balance and stamina effects ---

  // Grabber pushing
  if (grabberAction === "push") {
    player.balance = Math.max(0, player.balance - CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC * deltaSec);

    // Interval-based stamina drain (same mechanism as burst push)
    if (!player.lastGrabStaminaDrainTime) player.lastGrabStaminaDrainTime = now;
    if (now - player.lastGrabStaminaDrainTime >= GRAB_STAMINA_DRAIN_INTERVAL) {
      player.stamina = Math.max(0, player.stamina - 1);
      player.lastGrabStaminaDrainTime = now;
    }

    if (opponentAction !== "push") {
      const edgeMult = isInEdgeZone(opponent.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      opponent.balance = Math.max(0, opponent.balance - CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC * edgeMult * deltaSec);
      // Neutral opponents get moderate stamina drain; planters handle their own drain
      if (opponentAction !== "plant") {
        if (!opponent.lastGrabPushStaminaDrainTime) opponent.lastGrabPushStaminaDrainTime = now;
        if (now - opponent.lastGrabPushStaminaDrainTime >= CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL) {
          opponent.stamina = Math.max(0, opponent.stamina - 1);
          opponent.lastGrabPushStaminaDrainTime = now;
        }
      }
    }
  }

  // Grabber planting — recovers balance, small stamina drain (higher when being pushed)
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
    if (now - opponent.lastGrabStaminaDrainTime >= GRAB_STAMINA_DRAIN_INTERVAL) {
      opponent.stamina = Math.max(0, opponent.stamina - 1);
      opponent.lastGrabStaminaDrainTime = now;
    }

    if (grabberAction !== "push") {
      const edgeMult = isInEdgeZone(player.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      player.balance = Math.max(0, player.balance - CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC * edgeMult * deltaSec);
      // Neutral opponents get moderate stamina drain; planters handle their own drain
      if (grabberAction !== "plant") {
        if (!player.lastGrabPushStaminaDrainTime) player.lastGrabPushStaminaDrainTime = now;
        if (now - player.lastGrabPushStaminaDrainTime >= CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL) {
          player.stamina = Math.max(0, player.stamina - 1);
          player.lastGrabPushStaminaDrainTime = now;
        }
      }
    }
  }

  // Opponent planting (only if they have grip) — recovers balance, small stamina drain
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

  // --- Movement ---
  let netPushSpeed = 0; // positive = toward opponent's side

  if (grabberAction === "push" && opponentAction === "push") {
    // Push vs push: balance difference determines who wins the contest
    const grabberPower = player.balance * getGassedMult(player);
    const opponentPower = opponent.balance * getGassedMult(opponent);
    const diff = grabberPower - opponentPower;
    netPushSpeed = (diff / BALANCE_MAX) * CLINCH_PUSH_BASE_SPEED * CLINCH_PUSH_VS_PUSH_SPEED_SCALE;
  } else if (grabberAction === "push") {
    let speed = CLINCH_PUSH_BASE_SPEED * getGassedMult(player);
    if (opponentAction === "plant") {
      speed *= CLINCH_PUSH_VS_PLANT_SPEED_MULT;
    }
    netPushSpeed = speed;
  } else if (opponentAction === "push") {
    let speed = CLINCH_PUSH_BASE_SPEED * getGassedMult(opponent);
    if (grabberAction === "plant") {
      speed *= CLINCH_PUSH_VS_PLANT_SPEED_MULT;
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
      if (opponent.stamina <= 0) {
        triggerRingOut(player, opponent, room, io, rooms, oppAtLeft ? -1 : 1);
        return;
      }
      player.isAtBoundaryDuringGrab = true;
      player.isEdgePushing = true;
      opponent.isBeingEdgePushed = true;
      // Extra stamina drain at edge (interval-based, same as burst push edge drain)
      if (!opponent.lastGrabPushStaminaDrainTime) opponent.lastGrabPushStaminaDrainTime = now;
      if (now - opponent.lastGrabPushStaminaDrainTime >= GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL) {
        opponent.stamina = Math.max(0, opponent.stamina - 1);
        opponent.lastGrabPushStaminaDrainTime = now;
      }
      newOppX = oppAtLeft ? leftBoundary : rightBoundary;
      newX = player.x < opponent.x
        ? newOppX - fixedDistance
        : newOppX + fixedDistance;
    }
    // Check grabber boundary (being pushed back to edge)
    else if ((grabberAtLeft || grabberAtRight) && !room.gameOver && netPushSpeed < 0) {
      if (player.stamina <= 0) {
        triggerRingOut(opponent, player, room, io, rooms, grabberAtLeft ? -1 : 1);
        return;
      }
      opponent.isAtBoundaryDuringGrab = true;
      opponent.isEdgePushing = true;
      player.isBeingEdgePushed = true;
      // Extra stamina drain at edge (interval-based, same as burst push edge drain)
      if (!player.lastGrabPushStaminaDrainTime) player.lastGrabPushStaminaDrainTime = now;
      if (now - player.lastGrabPushStaminaDrainTime >= GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabPushStaminaDrainTime = now;
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
    }

    newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
    newOppX = Math.max(leftBoundary, Math.min(newOppX, rightBoundary));

    player.x = newX;
    opponent.x = newOppX;
  } else {
    // No movement — keep attached
    player.isAtBoundaryDuringGrab = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    opponent.isAtBoundaryDuringGrab = false;
    opponent.isEdgePushing = false;
    player.isBeingEdgePushed = false;

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
  actor.isClinchLifting = false;
}

// End a clinch lift and return to normal clinch
function endClinchLift(actor, target) {
  actor.clinchThrowActive = false;
  actor.clinchThrowType = null;
  actor.clinchThrowStartTime = 0;
  actor.clinchLiftStartTime = 0;
  actor.clinchLiftStartX = 0;
  actor.isClinchLifting = false;
  actor.isClinchKillLift = false;
  target.isBeingLifted = false;
  target.y = GROUND_LEVEL;
  actor.clinchThrowCooldown = true;
  setPlayerTimeout(actor.id, () => { actor.clinchThrowCooldown = false; }, CLINCH_THROW_COOLDOWN_MS, "clinchThrowCooldown");
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

  // --- FAIL: opponent balance above land threshold → stay in clinch ---
  if (targetBalance > CLINCH_THROW_LAND_THRESHOLD) {
    target.balance = Math.max(0, target.balance - CLINCH_THROW_FAIL_BALANCE_DRAIN);
    const selfBalDrain = actionType === "pull"
      ? CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN
      : CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN;
    actor.balance = Math.max(0, actor.balance - selfBalDrain);
    actor.stamina = Math.max(0, actor.stamina - CLINCH_THROW_FAIL_STAMINA_COST);
    return;
  }

  // --- KILL: opponent balance below kill threshold → round over ---
  const isKill = targetBalance < CLINCH_THROW_KILL_THRESHOLD && !room.gameOver;

  if (actionType === "pull") {
    const pullDirection = target.x < actor.x ? 1 : -1;
    const pullDist = isKill ? CLINCH_KILL_PULL_DISTANCE : CLINCH_PULL_DISTANCE;
    const pullTweenDur = isKill ? CLINCH_KILL_PULL_TWEEN_DURATION : CLINCH_PULL_TWEEN_DURATION;
    const pullLockMs = isKill ? CLINCH_KILL_PULL_INPUT_LOCK_MS : CLINCH_PULL_INPUT_LOCK_MS;
    const targetX = actor.x + pullDirection * pullDist;

    cleanupGrabStates(actor, target);

    target.isBeingPullReversaled = true;
    target.pullReversalPullerId = actor.id;
    target.isGrabBreakSeparating = true;
    target.grabBreakSepStartTime = Date.now();
    target.grabBreakSepDuration = pullTweenDur;
    target.grabBreakStartX = target.x;
    target.grabBreakTargetX = targetX;

    target.movementVelocity = 0;
    actor.movementVelocity = 0;
    target.isStrafing = false;
    actor.isStrafing = false;

    const lockUntil = Date.now() + pullLockMs;
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, lockUntil);
    actor.inputLockUntil = Math.max(actor.inputLockUntil || 0, lockUntil);

    correctFacingAfterGrabOrThrow(actor, target);

    if (isKill) {
      target.isClinchKillPullVictim = true;
      handleWinCondition(room, target, actor, io, "clinchKillPull");
      // Face victim toward the actor based on where they'll land (targetX),
      // so the CSS rotation lands them on their back with head away from puller
      target.facing = targetX < actor.x ? 1 : -1;
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
    actor.throwStartTime = Date.now() + hitstopMs;
    actor.throwEndTime = Date.now() + hitstopMs + throwDuration;
    actor.throwOpponent = target.id;
    actor.throwingFacingDirection = throwDir;
    clearAllActionStates(target);
    target.isBeingThrown = true;
    target.isHit = true;
    target.beingThrownFacingDirection = target.facing;
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, Date.now() + throwDuration + hitstopMs + 100);
    if (isKill) {
      target.isClinchKillThrowVictim = true;
      io.in(room.id).emit("clinch_kill_throw", {
        victimId: target.id,
        throwerId: actor.id,
        victimX: target.x,
        hitstopMs: 0,
      });
    }
    if (hitstopMs > 0) triggerHitstop(room, hitstopMs);
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
  pusher.ringOutFreezeEndTime = Date.now() + 200;
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
      grabberRef.isClinchLifting = false;
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
      grabbedRef.isClinchLifting = false;
      grabbedRef.isResistingThrow = false;
      grabbedRef.isResistingPull = false;
      grabbedRef.isClinchJolting = false;
      grabbedRef.clinchJoltRecovery = false;
      grabbedRef.clinchJoltCooldown = false;
      grabbedRef.isBeingClinchJolted = false;
      grabbedRef.isClinchJoltClashing = false;
      grabbedRef.clinchJoltPlantInterrupt = false;

      grabberRef.isThrowing = true;
      grabberRef.throwStartTime = Date.now();
      grabberRef.throwEndTime = Date.now() + RINGOUT_THROW_DURATION_MS;
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

module.exports = { updateGrabActions };

"use strict";

/**
 * Deterministic slide-jump / FLAP / body-slam simulation harness.
 *
 * Mirrors the production flight integrator + landing recovery from index.js
 * and calls the real checkFlapBodySlam / resolveFlapRawParry path in
 * collisionSystem.js. Does not boot the full game loop.
 *
 * Hitstop is cleared after each tick (same pattern as clinch harness) so
 * advances stay deterministic. Capture emitted events before the clear.
 */

const {
  TICK_RATE,
  GROUND_LEVEL,
  SLIDE_JUMP_LIFTOFF_IMPULSE,
  SLIDE_JUMP_GRAVITY,
  SLIDE_JUMP_H_BASE,
  SLIDE_JUMP_AIR_STEER,
  SLIDE_JUMP_AIR_STEER_BLEED,
  SLIDE_JUMP_LANDING_RECOVERY_MS,
  SLIDE_JUMP_LAND_SLAM_IFRAME_MS,
  FLAP_IMPULSE,
  FLAP_GRAVITY,
  FLAP_MAX_HEIGHT,
  FLAP_AIR_MOVE_SPEED,
  FLAP_FASTFALL_GRAVITY,
  FLAP_DIVE_MIN_DOWN_VELOCITY,
  FLAP_CEILING_CUSHION,
  FLAP_CEILING_HANG_GRAVITY,
  FLAP_FLAP_H_IMPULSE,
  FLAP_H_FRICTION,
  FLAP_CHARGE_COOLDOWN_MS,
  FLAP_CHARGES,
  FLAP_LANDING_RECOVERY_MS,
  BURST_STUN_MS,
  AP_ACTIVE_MS,
  PERFECT_PARRY_WINDOW,
} = require("../../../constants");
const {
  createInitialPlayerState,
  createInitialKeys,
} = require("../../../playerFactory");
const {
  setSimRoomResolver,
  advanceRoomSimTime,
  timeoutManager,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  clearSlideJumpState,
  shouldCommitSlideJumpDive,
  cancelPendingSlapWork,
  armSlideJumpFlapCharges,
} = require("../../../gameUtils");
const {
  arePlayersColliding,
  adjustPlayerPositions,
} = require("../../../gameFunctions");
const { checkFlapBodySlam } = require("../../../collisionSystem");
const {
  buildOffensiveAerialTickSnapshot,
  beginOffensiveAerialTrace,
  recordOffensiveAerialTick,
  flushOffensiveAerialTrace,
  isBodySlamWindowOpen,
  bodySlamBodyWidth,
} = require("../../../offensiveAerialTrace");
const {
  OFFENSIVE_AERIAL_MOVE_TYPE,
  OFFENSIVE_AERIAL_MOVEMENT_OWNER,
  OFFENSIVE_AERIAL_OUTCOME,
  beginOffensiveAerialActivation,
  resolveOffensiveAerialTouchdownTerminal,
} = require("../../../offensiveAerialOutcome");
const {
  isOffensiveAerialReactionV2Enabled,
  setOffensiveAerialReactionV2ForTests,
} = require("../../../offensiveAerialFlags");
const {
  FACING_LOCK_REASON,
  FACING_RELEASE,
  acquireOffensiveAerialFacingLock,
  updateOffensiveAerialFacingLockDirection,
  applyNeutralFacingAfterAerial,
  handoffOffensiveAerialFacingAtTouchdown,
  aerialFacingAllowsSteer,
} = require("../../../offensiveAerialFacing");
const {
  syncOffensiveAerialPresentation,
} = require("../../../offensiveAerialPresentation");
const {
  isParriedRecoilActive,
  stepParriedRecoil,
  applyOffensiveAerialTouchdownHandoff,
} = require("../../../offensiveAerialReaction");
const { createMockIo } = require("../../clinch/harness/mockIo");
const { computeOffensiveAerialContact } = require("../../../offensiveAerialContact");

const TICK_MS = 1000 / TICK_RATE;

let harnessIdCounter = 0;

function blankKeys(overrides = {}) {
  return { ...createInitialKeys(), ...overrides };
}

/**
 * Create a two-fighter aerial scenario. Attacker starts in slide-jump flight
 * unless options.startGrounded.
 */
function createSlideJumpScenario(options = {}) {
  // Production default is Reaction V2 ON. Characterization suites (Phase 0–3)
  // expect Phase 3 legacy parry grounding unless they opt in with reactionV2:true.
  if (options.reactionV2 === true) {
    setOffensiveAerialReactionV2ForTests(true);
  } else {
    setOffensiveAerialReactionV2ForTests(false);
  }

  harnessIdCounter += 1;
  const id = harnessIdCounter;
  const startSim = options.simTime != null ? options.simTime : 100_000;
  const midX =
    options.midX != null
      ? options.midX
      : (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;

  const attackerX = options.attackerX != null ? options.attackerX : midX - 80;
  const defenderX = options.defenderX != null ? options.defenderX : midX + 40;

  const attacker = createInitialPlayerState({
    id: `atk-${id}`,
    fighter: "player 1",
    x: attackerX,
    facing: attackerX < defenderX ? -1 : 1,
    stamina: options.attackerStamina != null ? options.attackerStamina : 100,
    balance: options.attackerBalance != null ? options.attackerBalance : 100,
  });
  const defender = createInitialPlayerState({
    id: `def-${id}`,
    fighter: "player 2",
    x: defenderX,
    facing: defenderX > attackerX ? 1 : -1,
    stamina: options.defenderStamina != null ? options.defenderStamina : 100,
    balance: options.defenderBalance != null ? options.defenderBalance : 100,
  });

  attacker.keys = blankKeys(options.attackerKeys || {});
  defender.keys = blankKeys(options.defenderKeys || {});
  attacker.socketId = `sock-atk-${id}`;
  defender.socketId = `sock-def-${id}`;

  const room = {
    id: `aerial-room-${id}`,
    players: [attacker, defender],
    simTime: startSim,
    gameOver: false,
    hitstopUntil: 0,
  };

  const io = createMockIo();
  const byId = new Map([
    [attacker.id, room],
    [defender.id, room],
  ]);
  setSimRoomResolver((playerId) => byId.get(playerId) || null);

  if (!options.startGrounded) {
    beginSlideJumpFlight(attacker, {
      now: startSim,
      dir: options.jumpDir != null ? options.jumpDir : attackerX < defenderX ? 1 : -1,
      hSpeed: options.hSpeed != null ? options.hSpeed : SLIDE_JUMP_H_BASE,
      velY:
        options.velY != null ? options.velY : SLIDE_JUMP_LIFTOFF_IMPULSE,
      y: options.attackerY != null ? options.attackerY : GROUND_LEVEL + 1,
      armFlap: !!options.armFlap,
      dive: !!options.dive,
      flapFlight: !!options.flapFlight,
    });
  }

  if (options.defenderParry) {
    armDefenderParry(defender, startSim, options.defenderParry);
  }

  beginOffensiveAerialTrace(attacker, {
    scenario: options.name || `aerial-${id}`,
    simTime: startSim,
  });

  return {
    room,
    io,
    attacker,
    defender,
    tickMs: TICK_MS,
    traces: [],
  };
}

function beginSlideJumpFlight(player, opts = {}) {
  const now = opts.now || 0;
  const dir = opts.dir || 1;
  player.isSlideJumping = true;
  player.slideJumpPhase = "flight";
  player.slideJumpStartTime = now;
  player.slideJumpVelocityY = opts.velY != null ? opts.velY : SLIDE_JUMP_LIFTOFF_IMPULSE;
  player.slideJumpVelocityX = dir * (opts.hSpeed != null ? opts.hSpeed : SLIDE_JUMP_H_BASE);
  player.facing = dir > 0 ? -1 : 1;
  player.slideJumpDiveCommitted = !!opts.dive;
  player.slideJumpDiveBuffered = !!opts.dive;
  player.slideJumpDiveBufferUntil = 0;
  player.slideJumpDiveLockX = opts.dive ? player.x : 0;
  player.slideJumpHitLanded = false;
  player.slideJumpHitRecoverDuration = 0;
  player.slideJumpLandingTime = 0;
  player.slideJumpBufferUntil = 0;
  player.slideJumpFlapFlightActive = !!opts.flapFlight;
  player.flapVelocityX = 0;
  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isBraking = false;
  player.currentAction = "slideJump";
  player.actionLockUntil = 0;
  player.y = opts.y != null ? opts.y : GROUND_LEVEL + 1;
  if (opts.armFlap) {
    player.activePowerUp = "flap";
    player.loadout = { ...(player.loadout || {}), hasFlap: true };
    armSlideJumpFlapCharges(player, now);
  } else {
    player.slideJumpHasFlap = false;
    player.flapCharges = 0;
  }
  if (opts.flapFlight && !opts.armFlap) {
    player.slideJumpFlapFlightActive = true;
    player.slideJumpHasFlap = true;
    player.flapCharges = opts.charges != null ? opts.charges : FLAP_CHARGES;
  }
  if (opts.dive) {
    player.slideJumpVelocityX = 0;
    player.flapVelocityX = 0;
    player.flapCharges = 0;
    if (player.slideJumpVelocityY > 0) player.slideJumpVelocityY = 0;
    if (player.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
      player.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
    }
    player.slideJumpDiveLockX = player.x;
  }

  // Mirror production outcome-contract arming rules.
  if (opts.armFlap || opts.flapFlight) {
    beginOffensiveAerialActivation(player, {
      forceNew: true,
      moveType: opts.dive
        ? OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE
        : OFFENSIVE_AERIAL_MOVE_TYPE.FLAP_SLIDE_JUMP,
      offensiveArmed: true,
      movementOwner: opts.dive
        ? OFFENSIVE_AERIAL_MOVEMENT_OWNER.DIVE
        : OFFENSIVE_AERIAL_MOVEMENT_OWNER.SLIDE_JUMP_FLIGHT,
      debugReason: "harness_begin_flap",
    });
  } else if (opts.dive) {
    beginOffensiveAerialActivation(player, {
      forceNew: true,
      moveType: OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE,
      offensiveArmed: true,
      movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.DIVE,
      debugReason: "harness_begin_dive",
    });
  } else {
    player.offensiveAerial = null;
  }
  acquireOffensiveAerialFacingLock(player, {
    supersede: true,
    ownerInstanceId: player.offensiveAerial?.attackInstanceId || null,
    direction: player.facing,
    reason: opts.dive ? FACING_LOCK_REASON.DIVE : FACING_LOCK_REASON.FLIGHT,
    releaseCondition: FACING_RELEASE.RECOVERY_COMPLETE,
    allowSteerUpdate: !opts.dive,
  });
}

function armDefenderParry(defender, now, mode = "regular") {
  defender.isRawParrying = true;
  defender.isGuarding = mode === "guard";
  defender.rawParryStartTime =
    mode === "perfect" ? now : now - (PERFECT_PARRY_WINDOW + 1);
  defender.apActiveUntil = now + AP_ACTIVE_MS;
  defender.spaceJustPressed = false;
  defender.apSpaceConsumed = true;
  if (mode === "guard") {
    // Guard floor: isRawParrying + isGuarding; perfect window closed.
    defender.rawParryStartTime = now - (PERFECT_PARRY_WINDOW + 1);
  }
}

/**
 * One tick of production-equivalent slide-jump flight / landing + body slam.
 * Order mirrors index.js: integrate → body slam → touchdown → landing recovery,
 * plus optional early-pair body slam (default on) and grounded pushbox.
 */
function stepSlideJumpTick(scenario, options = {}) {
  const { room, io, attacker, defender } = scenario;
  const now = room.simTime;
  const earlyPairCheck = options.earlyPairCheck !== false;
  const applyPushbox = options.applyPushbox !== false;

  let contactResult = null;
  let pushboxCorrectionPx = 0;
  const sideBefore = attacker.x < defender.x ? -1 : attacker.x > defender.x ? 1 : 0;

  // Early pair block (production index.js) — body slam before movement.
  if (earlyPairCheck && attacker.isSlideJumping) {
    const beforeHit = attacker.slideJumpHitLanded;
    const beforeRecovering = attacker.isRecovering;
    const beforeOutcome = attacker.offensiveAerial?.outcome;
    checkFlapBodySlam(attacker, defender, [room], io);
    if (!beforeHit && attacker.slideJumpHitLanded) {
      contactResult =
        attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
          ? "parried"
          : "hit";
    }
    if (!beforeRecovering && attacker.isRecovering && !attacker.isSlideJumping) {
      contactResult = "parried";
    }
    if (
      beforeOutcome !== OFFENSIVE_AERIAL_OUTCOME.PARRIED &&
      attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
    ) {
      contactResult = "parried";
    }
  }

  if (attacker.isSlideJumping && attacker.slideJumpPhase === "flight") {
    const parryRecoil = isParriedRecoilActive(attacker);

    if (!parryRecoil) {
      // Optional mid-air flap spend / dive commit from keys (mirrors index.js).
      if (
        attacker.wJustPressed &&
        attacker.slideJumpHasFlap &&
        (attacker.flapCharges || 0) > 0 &&
        !attacker.slideJumpHitLanded &&
        !attacker.slideJumpDiveCommitted &&
        now - (attacker.lastFlapChargeTime || 0) >= FLAP_CHARGE_COOLDOWN_MS
      ) {
        const entering = !attacker.slideJumpFlapFlightActive;
        attacker.slideJumpFlapFlightActive = true;
        attacker.flapCharges -= 1;
        attacker.slideJumpVelocityY = FLAP_IMPULSE;
        if (entering) attacker.slideJumpVelocityX = 0;
        if (attacker.keys.d && !attacker.keys.a) {
          attacker.flapVelocityX = FLAP_FLAP_H_IMPULSE;
          if (aerialFacingAllowsSteer(attacker)) {
            updateOffensiveAerialFacingLockDirection(attacker, -1);
            attacker.facing = -1;
          }
          attacker.flapBeatHDir = 1;
        } else if (attacker.keys.a && !attacker.keys.d) {
          attacker.flapVelocityX = -FLAP_FLAP_H_IMPULSE;
          if (aerialFacingAllowsSteer(attacker)) {
            updateOffensiveAerialFacingLockDirection(attacker, 1);
            attacker.facing = 1;
          }
          attacker.flapBeatHDir = -1;
        } else {
          attacker.flapBeatHDir = 0;
        }
        attacker.flapWingBeatTime = now;
        attacker.lastFlapChargeTime = now;
        attacker.wJustPressed = false;
      }

      if (shouldCommitSlideJumpDive(attacker, now)) {
        attacker.slideJumpDiveCommitted = true;
        attacker.slideJumpDiveBuffered = false;
        attacker.slideJumpDiveBufferUntil = 0;
        attacker.slideJumpDiveLockX = attacker.x;
        attacker.slideJumpVelocityX = 0;
        attacker.flapVelocityX = 0;
        attacker.flapCharges = 0;
        if (attacker.slideJumpVelocityY > 0) attacker.slideJumpVelocityY = 0;
        if (attacker.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
          attacker.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
        }
        beginOffensiveAerialActivation(attacker, {
          moveType: OFFENSIVE_AERIAL_MOVE_TYPE.BODY_SLAM_DIVE,
          offensiveArmed: true,
          movementOwner: OFFENSIVE_AERIAL_MOVEMENT_OWNER.DIVE,
          debugReason: "harness_dive_commit",
        });
        acquireOffensiveAerialFacingLock(attacker, {
          supersede: true,
          ownerInstanceId: attacker.offensiveAerial?.attackInstanceId || null,
          direction: attacker.facing,
          reason: FACING_LOCK_REASON.DIVE,
          releaseCondition: FACING_RELEASE.RECOVERY_COMPLETE,
          allowSteerUpdate: false,
        });
      }
    }

    attacker.slideJumpFastFalling =
      !parryRecoil && attacker.slideJumpDiveCommitted;
    const isDiveLocked = !parryRecoil && attacker.slideJumpDiveCommitted;
    const flapFlight = !parryRecoil && !!attacker.slideJumpFlapFlightActive;

    if (parryRecoil) {
      stepParriedRecoil(attacker, defender, now);
    } else if (flapFlight) {
      const ceiling = GROUND_LEVEL + FLAP_MAX_HEIGHT;
      const cushionStart = ceiling - FLAP_CEILING_CUSHION;
      const inCeilingZone = attacker.y > cushionStart;
      if (!isDiveLocked && inCeilingZone && attacker.slideJumpVelocityY > 0) {
        const into = Math.min(
          1,
          (attacker.y - cushionStart) / FLAP_CEILING_CUSHION
        );
        attacker.slideJumpVelocityY *= Math.max(0, 1 - into);
      }
      const gravity = isDiveLocked
        ? FLAP_FASTFALL_GRAVITY
        : inCeilingZone
          ? FLAP_CEILING_HANG_GRAVITY
          : FLAP_GRAVITY;
      attacker.slideJumpVelocityY -= gravity;
      if (isDiveLocked) {
        if (attacker.slideJumpVelocityY > 0) attacker.slideJumpVelocityY = 0;
        if (attacker.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
          attacker.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
        }
      }
      attacker.y += attacker.slideJumpVelocityY;
      if (attacker.y > ceiling) {
        attacker.y = ceiling;
        if (attacker.slideJumpVelocityY > 0) attacker.slideJumpVelocityY = 0;
      }
      if (isDiveLocked) {
        attacker.slideJumpVelocityX = 0;
        attacker.flapVelocityX = 0;
        attacker.x = attacker.slideJumpDiveLockX;
      } else {
        if (attacker.keys.d && !attacker.keys.a) {
          attacker.x += FLAP_AIR_MOVE_SPEED;
          if (aerialFacingAllowsSteer(attacker)) {
            updateOffensiveAerialFacingLockDirection(attacker, -1);
            attacker.facing = -1;
          }
        } else if (attacker.keys.a && !attacker.keys.d) {
          attacker.x -= FLAP_AIR_MOVE_SPEED;
          if (aerialFacingAllowsSteer(attacker)) {
            updateOffensiveAerialFacingLockDirection(attacker, 1);
            attacker.facing = 1;
          }
        }
        if (attacker.flapVelocityX !== 0) {
          attacker.x += attacker.flapVelocityX;
          attacker.flapVelocityX *= FLAP_H_FRICTION;
          if (Math.abs(attacker.flapVelocityX) < 0.1) attacker.flapVelocityX = 0;
        }
      }
    } else {
      const gravity = isDiveLocked ? FLAP_FASTFALL_GRAVITY : SLIDE_JUMP_GRAVITY;
      attacker.slideJumpVelocityY -= gravity;
      if (isDiveLocked) {
        if (attacker.slideJumpVelocityY > 0) attacker.slideJumpVelocityY = 0;
        if (attacker.slideJumpVelocityY > -FLAP_DIVE_MIN_DOWN_VELOCITY) {
          attacker.slideJumpVelocityY = -FLAP_DIVE_MIN_DOWN_VELOCITY;
        }
      }
      attacker.y += attacker.slideJumpVelocityY;
      if (isDiveLocked) {
        attacker.slideJumpVelocityX = 0;
        attacker.x = attacker.slideJumpDiveLockX;
      } else {
        attacker.x += attacker.slideJumpVelocityX;
        if (attacker.keys.d && !attacker.keys.a) {
          attacker.x += SLIDE_JUMP_AIR_STEER;
          attacker.slideJumpVelocityX *= SLIDE_JUMP_AIR_STEER_BLEED;
          if (aerialFacingAllowsSteer(attacker)) {
            updateOffensiveAerialFacingLockDirection(attacker, -1);
            attacker.facing = -1;
          }
        } else if (attacker.keys.a && !attacker.keys.d) {
          attacker.x -= SLIDE_JUMP_AIR_STEER;
          attacker.slideJumpVelocityX *= SLIDE_JUMP_AIR_STEER_BLEED;
          if (aerialFacingAllowsSteer(attacker)) {
            updateOffensiveAerialFacingLockDirection(attacker, 1);
            attacker.facing = 1;
          }
        }
      }
    }
    attacker.x = Math.max(
      MAP_LEFT_BOUNDARY,
      Math.min(attacker.x, MAP_RIGHT_BOUNDARY)
    );

    // Mid-flight body slam poll (production index.js after integrate).
    if (!attacker.slideJumpHitLanded) {
      const beforeHit = attacker.slideJumpHitLanded;
      const beforeSlide = attacker.isSlideJumping;
      const beforeRecovering = attacker.isRecovering;
      const beforeOutcome = attacker.offensiveAerial?.outcome;
      checkFlapBodySlam(attacker, defender, [room], io);
      if (!beforeHit && attacker.slideJumpHitLanded) {
        contactResult =
          attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
            ? "parried"
            : "hit";
      }
      if (
        beforeSlide &&
        !attacker.isSlideJumping &&
        !beforeRecovering &&
        attacker.isRecovering
      ) {
        contactResult = "parried";
      }
      if (
        beforeOutcome !== OFFENSIVE_AERIAL_OUTCOME.PARRIED &&
        attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
      ) {
        contactResult = "parried";
      }
    }

    if (
      attacker.isSlideJumping &&
      attacker.y <= GROUND_LEVEL &&
      attacker.slideJumpVelocityY <= 0
    ) {
      attacker.y = GROUND_LEVEL;
      attacker.slideJumpVelocityY = 0;
      attacker.slideJumpVelocityX = 0;
      attacker.flapVelocityX = 0;
      if (isDiveLocked) {
        attacker.x = attacker.slideJumpDiveLockX;
      }
      attacker.slideJumpPhase = "landing";
      attacker.slideJumpLandingTime = now;
      attacker.slideJumpLandSlamImmuneUntil = now + SLIDE_JUMP_LAND_SLAM_IFRAME_MS;
      attacker._oaTouchdownPresentation = true;
      handoffOffensiveAerialFacingAtTouchdown(attacker, defender);
      const whiffRecovery = attacker.slideJumpFlapFlightActive
        ? FLAP_LANDING_RECOVERY_MS
        : SLIDE_JUMP_LANDING_RECOVERY_MS;
      let recovery = attacker.slideJumpHitLanded
        ? attacker.slideJumpHitRecoverDuration || BURST_STUN_MS
        : whiffRecovery;
      resolveOffensiveAerialTouchdownTerminal(attacker, {
        resolvedTime: now,
        debugReason: "harness_touchdown",
      });
      if (isOffensiveAerialReactionV2Enabled()) {
        const handoff = applyOffensiveAerialTouchdownHandoff(
          attacker,
          defender,
          now,
          { recoveryMs: recovery, debugReason: "harness_touchdown" }
        );
        if (
          handoff.ok &&
          typeof handoff.recoveryMs === "number" &&
          attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
        ) {
          recovery = handoff.recoveryMs;
          attacker.slideJumpHitRecoverDuration = recovery;
        }
      }
      attacker.actionLockUntil = now + recovery;
    }
  } else if (
    attacker.isSlideJumping &&
    attacker.slideJumpPhase === "landing"
  ) {
    attacker.slideJumpFastFalling = false;
    if (attacker._oaTouchdownPresentation) {
      attacker._oaTouchdownPresentation = false;
    }
    const whiffRecovery = attacker.slideJumpFlapFlightActive
      ? FLAP_LANDING_RECOVERY_MS
      : SLIDE_JUMP_LANDING_RECOVERY_MS;
    let recovery = attacker.slideJumpHitLanded
      ? attacker.slideJumpHitRecoverDuration || BURST_STUN_MS
      : whiffRecovery;
    if (
      attacker._oaParryControlRestoreAt &&
      attacker.offensiveAerial?.outcome === OFFENSIVE_AERIAL_OUTCOME.PARRIED
    ) {
      recovery = Math.max(
        0,
        attacker._oaParryControlRestoreAt - attacker.slideJumpLandingTime
      );
    }
    const landDone =
      attacker._oaParryControlRestoreAt > 0
        ? now >= attacker._oaParryControlRestoreAt
        : now >= attacker.slideJumpLandingTime + recovery;
    if (landDone) {
      attacker.y = GROUND_LEVEL;
      cancelPendingSlapWork(attacker);
      const endingInstanceId =
        attacker.offensiveAerial?.attackInstanceId ||
        attacker.offensiveAerialReaction?.attackInstanceId ||
        null;
      attacker.isRecovering = false;
      attacker.isAlreadyHit = false;
      clearSlideJumpState(attacker, {
        expectedInstanceId: endingInstanceId,
        debugReason: "harness_recovery_complete",
      });
      attacker.currentAction = null;
      attacker.actionLockUntil = 0;
      applyNeutralFacingAfterAerial(attacker, defender);
    }
  }

  syncOffensiveAerialPresentation(attacker);

  // Optional defender horizontal drift (characterization).
  if (options.defenderVelX) {
    defender.x += options.defenderVelX;
    defender.x = Math.max(
      MAP_LEFT_BOUNDARY,
      Math.min(defender.x, MAP_RIGHT_BOUNDARY)
    );
  }

  if (
    applyPushbox &&
    !room.gameOver &&
    arePlayersColliding(attacker, defender)
  ) {
    const ax = attacker.x;
    const dx = defender.x;
    adjustPlayerPositions(attacker, defender, TICK_MS);
    pushboxCorrectionPx =
      Math.abs(attacker.x - ax) + Math.abs(defender.x - dx);
  }

  const sideAfter = attacker.x < defender.x ? -1 : attacker.x > defender.x ? 1 : 0;
  const snapshot = buildOffensiveAerialTickSnapshot({
    tick: scenario.traces.length,
    simTime: now,
    attacker,
    defender,
    contactResult,
    contactPoint: (() => {
      if (contactResult !== "hit" && contactResult !== "parried") return null;
      const c = computeOffensiveAerialContact(attacker, defender);
      return { x: c.contactX, y: c.contactY, axis: c.contactAxis };
    })(),
    pushboxCorrectionPx,
    notes: {
      sideBefore,
      sideAfter,
      hitboxActive: isBodySlamWindowOpen(attacker),
      bodyWidth: bodySlamBodyWidth(attacker, defender),
      earlyPairCheck,
    },
  });
  scenario.traces.push(snapshot);
  recordOffensiveAerialTick(attacker, snapshot);

  // Advance sim clock; clear wall-clock hitstop so subsequent ticks stay
  // deterministic (same pattern as clinch harness).
  advanceRoomSimTime(room, TICK_MS);
  room.hitstopUntil = 0;
  timeoutManager.processRoom(room);

  return snapshot;
}

function runUntil(scenario, predicate, maxTicks = 240) {
  for (let i = 0; i < maxTicks; i++) {
    const snap = stepSlideJumpTick(scenario);
    if (predicate(snap, scenario)) return snap;
  }
  return scenario.traces[scenario.traces.length - 1] || null;
}

function runTicks(scenario, n, options = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(stepSlideJumpTick(scenario, options));
  return out;
}

function finishTrace(scenario, reason = "test_complete") {
  return flushOffensiveAerialTrace(scenario.attacker, reason);
}

function placeDescendingOverOpponent(scenario, opts = {}) {
  const { attacker, defender } = scenario;
  const height =
    opts.height != null ? opts.height : 40; // within FLAP_BODYSLAM_CONTACT_HEIGHT
  attacker.x = opts.x != null ? opts.x : defender.x;
  attacker.y = GROUND_LEVEL + height;
  attacker.slideJumpVelocityY =
    opts.velY != null ? opts.velY : -FLAP_DIVE_MIN_DOWN_VELOCITY;
  attacker.slideJumpVelocityX = opts.velX != null ? opts.velX : 0;
  if (opts.dive) {
    attacker.slideJumpDiveCommitted = true;
    attacker.slideJumpDiveLockX = attacker.x;
  }
}

module.exports = {
  TICK_MS,
  blankKeys,
  createSlideJumpScenario,
  beginSlideJumpFlight,
  armDefenderParry,
  stepSlideJumpTick,
  runUntil,
  runTicks,
  finishTrace,
  placeDescendingOverOpponent,
  GROUND_LEVEL,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  SLIDE_JUMP_LANDING_RECOVERY_MS,
  FLAP_LANDING_RECOVERY_MS,
  BURST_STUN_MS,
};

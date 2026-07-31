// Import required utilities
const {
  setPlayerTimeout,
  timeoutManager,
  simNow,
  simNowForPlayer,
  logVerbInitiation,
  resetPlayerAttackStates,
  clearChargeState,
  schedulePalmThrustVisualEnd,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  DOHYO_FALL_DEPTH,
  isOutsideDohyo,
  canPlayerSlap,
  canPlayerUseAction,
  canPlayerDash,
  beginPlayerDodge,
  canPlayerSidestep,
  getSidestepInitData,
  startCharging,
  lagCompensatedParryStart,
  canArmAttackParry,
  armAttackParry,
  canArmMatador,
  armMatador,
  clearMatadorWindow,
  clearAllActionStates,
  triggerHitstopAndEmit,
  alignedEntryVelocity,
  takeInheritedVelocity,
  beginGrabStartup,
  emitStaminaBlocked,
} = require("./gameUtils");

// MASTERY OVERHAUL feature flags (Phase 1: momentum inheritance, Phase 3: cadence,
// Phase 4: analog resolutions).
const { MASTERY_P1_MOMENTUM, MASTERY_P3_CADENCE } = require("./masteryFlags");

// Aerial landing Phase A.3.1 / A.3.2 — settle ownership + recovery monitoring.
const {
  resolveLandingSeparationOrdering,
  computeLandingSettleCorrectionPx,
  updateLandingSettleCompletion,
  isLandingRecoveryMonitoringState,
  reactivateLandingSettle,
  LANDING_SETTLE_MAX_PX_PER_TICK,
  LANDING_SETTLE_OVERLAP_EPS_PX,
  SETTLE_LANDING_SETTLE_ACTIVE,
} = require("./landingResolution");

// Per-match input audit log (open at first round, close on matchOver)
const { openLog: openAuditLog, closeLog: closeAuditLog, appendWinType } = require("./inputAuditLog");

// MASTERY Phase 2 (2.5) — classify a round win as oshi (strike/edge kill) or
// yotsu (clinch conversion) for the win-type telemetry. Clinch-based finishes
// are yotsu; everything else (slap/palm/charged edge kills, ring-outs) is oshi.
function classifyWinCategory(winType) {
  switch (winType) {
    case "grabThrow":
    case "grabPush":
    case "clinchKillThrow":
    case "clinchKillPull":
      return "yotsu";
    default:
      return "oshi";
  }
}
const { createInitialKeys } = require("./playerFactory");
const { getPushboxHalfWidth } = require("./pushboxGeometry");

const {
  GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE,
  SLAP_ATTACK_STAMINA_COST,
  CHARGED_ATTACK_STAMINA_COST,
  RAW_PARRY_STAMINA_COST, RAW_PARRY_COOLDOWN_MS,
  CHARGE_FULL_POWER_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  SLAP_TOTAL_MS,
  SLAP_TOTAL_MS_ENHANCED,
  CADENCE_WINDOW_MS,
  SLAP_WHIFF_EXTRA_RECOVERY_MS,
  K_SLAP_INHERIT,
  SLAP_SLIDE_MIN,
  SLAP_SLIDE_MAX,
  CHARGED_STARTUP_MS,
  CHARGED_ACTIVE_MIN_MS,
  CHARGED_ACTIVE_MAX_MS,
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ACTIVE_MS,
  PALM_THRUST_HOLD_MS,
  PALM_THRUST_END_RECOVERY_MS,
  PALM_THRUST_HIT_RECOVERY_MS,
  PALM_THRUST_POWER,
  PALM_THRUST_STAMINA_COST,
  LOW_KICK_ENABLED,
  LOW_KICK_STARTUP_MS,
  LOW_KICK_ACTIVE_MS,
  LOW_KICK_RECOVERY_MS,
  LOW_KICK_HIT_RECOVERY_MS,
  LOW_KICK_TOTAL_MS,
  LOW_KICK_STAMINA_COST,
  GRAB_STATES,
  INPUT_BUFFER_WINDOW_MS,
  POWER_UP_TYPES,
  SIDESTEP_STARTUP_MS, SIDESTEP_ACTIVE_MS,
  SIDESTEP_TOTAL_MS, SIDESTEP_STAMINA_COST,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_PULL_TWEEN_DURATION,
  CLINCH_PULL_INPUT_LOCK_MS,
  CLINCH_KILL_PULL_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CLINCH_THROW_MIN_SEPARATION,
  PULL_BOUNDARY_MARGIN,
  MATADOR_HITSTOP_MS,
  MATADOR_PULL_DISTANCE,
} = require("./constants");

// Hit 3 charge functions removed — charged attack is now a standalone move (S + FORWARD + MOUSE1)

// Add new function for grab state cleanup
function cleanupGrabStates(player, opponent) {
  // Cancel pending jolt recovery/cooldown timers FIRST. The nested timeout
  // chain in grabActionSystem (recovery → cooldown) otherwise survives the
  // clinch ending and fires into the NEXT engagement: a stale recovery
  // callback would set clinchJoltCooldown=true on a player who just started
  // a fresh clinch, silently blocking their jolt for the cooldown duration.
  for (const p of [player, opponent]) {
    timeoutManager.clearPlayerSpecific(p.id, "clinchJoltRecovery");
    timeoutManager.clearPlayerSpecific(p.id, "clinchJoltCooldown");
    timeoutManager.clearPlayerSpecific(p.id, "clinchThrowFailStagger");
    timeoutManager.clearPlayerSpecific(p.id, "clinchPerfectBraceFlash");
    p.isArmClamped = false;
    p.clinchThrowFailStagger = false;
    p.isClinchOpen = false;
    p.clinchOpenHideStars = false;
    p.clinchOpenUntil = 0;
    p.clinchThrowUsedDeepGrip = false;
    p.clinchThrowWasCounter = false;
    p.clinchThrowKillBalance = null;
    p.clinchThrowInitiationDrain = 0;
    p.clinchThrowInitiationEdgeBonus = 0;
    p.isClinchCommittedDrive = false;
    p.isClinchPerfectBracing = false;
    p.clinchDriveHoldStart = 0;
    p.clinchDrivePlantCancelUntil = 0;
    p.clinchPushLossStart = 0;
    p.clinchBraceSimTime = 0;
    p.clinchBraceLatchUntil = 0;
    p.clinchBracePressGameTime = 0;
    p.clinchBracePressReceiptGameNow = 0;
    p.clinchTechniquePressGameTime = 0;
    p.clinchTechniquePressReceiptGameNow = 0;
    p.rawParryPressGameTime = 0;
    p.rawParryPressReceiptGameNow = 0;
    p.lastTrustedPressGameTime = 0;
    p.hasDeepGrip = false;
    p.clinchShoveLead = null;
    p.deepGripPushStart = 0;
    p.clinchPushRampStart = 0;
  }

  // Clean up grabber states
  player.isGrabbing = false;
  player.grabbedOpponent = null;
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.grabCooldown = false;
  player.isBeingGrabbed = false;
  player.isBeingPushed = false;
  player.lastGrabStaminaDrainTime = 0;
  player.isAttemptingGrabThrow = false;
  player.grabThrowAttemptStartTime = 0;
  // New grab action system cleanup - grabber
  player.isGrabPushing = false;
  player.isBeingGrabPushed = false;
  player.isEdgePushing = false;
  player.isBeingEdgePushed = false;
  player.isAttemptingPull = false;
  player.isBeingPullReversaled = false;
  player.pullReversalPullerId = null;
  player.pullFacingDirection = null;
  player.isBoundaryPullSwap = false;
  player.isGrabSeparating = false;
  player.isGrabBellyFlopping = false;
  player.isBeingGrabBellyFlopped = false;
  player.isGrabFrontalForceOut = false;
  player.isBeingGrabFrontalForceOut = false;
  player.grabActionStartTime = 0;
  player.grabActionType = null;
  player.lastGrabPushStaminaDrainTime = 0;
  player.isAtBoundaryDuringGrab = false;
  player.clinchEdgePinStart = 0;
  player.grabDurationPaused = false;
  player.grabDurationPausedAt = 0;
  player.grabPushEndTime = 0;
  player.grabPushStartTime = 0;
  player.grabApproachSpeed = 0;
  player.grabDecisionMade = false;
  player.isGrabWalking = false;
  player.isGrabWhiffRecovery = false;
  player.isGrabTeching = false;
  player.grabTechRole = null;
  player.grabTechResidualVel = 0;
  player.grabCounterAttempted = false;
  player.grabCounterInput = null;
  player.lastResistStaminaDrainTime = 0;
  // Clinch system cleanup
  player.hasGrip = false;
  player.gripAcquiredTime = 0;
  player.isClinchBeltHolding = false;
  player.clinchBeltRequiresM2Release = false;
  player.clinchAttachDistance = 0;
  player.inClinch = false;
  player.clinchAction = null;
  player.clinchOpponent = null;
  player.clinchStalemateStart = 0;
  player.clinchStalemateLastX = 0;
  player.clinchStalemateLastBalance = 0;
  // Clinch throw/pull cleanup
  player.clinchThrowRequest = null;
  player.clinchThrowRequestTime = 0;
  player.clinchThrowActive = false;
  player.clinchThrowType = null;
  player.clinchThrowStartTime = 0;
  player.clinchThrowCooldown = false;
  player.clinchThrowUsedDeepGrip = false;
  player.clinchThrowKillBalance = null;
  player.clinchThrowInitiationDrain = 0;
  player.clinchThrowInitiationEdgeBonus = 0;
  player.isClinchThrowing = false;
  player.isClinchClashing = false;
  player.clinchClashStartTime = 0;
  player.clinchMouse2BufferTime = 0;
  player.clinchWTapTime = 0;
  player.clinchAwayTapTime = 0;
  player.clinchTechniquePressGameTime = 0;
  player.clinchTechniquePressReceiptGameNow = 0;
  player.isClinchPushing = false;
  player.isClinchPlanting = false;
  player.lastPlantStaminaDrainTime = 0;
  player.isResistingThrow = false;
  player.isResistingPull = false;
  player.isClinchOpen = false;
  player.clinchOpenHideStars = false;
  player.clinchOpenUntil = 0;
  player.isClinchCommittedDrive = false;
  player.isClinchPerfectBracing = false;
  player.clinchDriveHoldStart = 0;
  player.clinchDrivePlantCancelUntil = 0;
  player.clinchPushLossStart = 0;
  player.clinchBraceSimTime = 0;
  player.clinchBraceLatchUntil = 0;
  player.clinchBracePressGameTime = 0;
  player.clinchBracePressReceiptGameNow = 0;
  player.lastTrustedPressGameTime = 0;
  // Clinch jolt cleanup
  player.isClinchJolting = false;
  player.clinchJoltRecovery = false;
  player.clinchJoltCooldown = false;
  player.clinchJoltStartTime = 0;
  player.isBeingClinchJolted = false;
  player.clinchJoltPlantInterrupt = false;
  player.isClinchJoltClashing = false;
  player.clinchJoltRequest = false;
  player.clinchJoltRequestTime = 0;
  player.clinchJoltRecoilStart = 0;
  player.clinchJoltPlantInterruptStart = 0;
  // Clinch break cleanup
  player.clinchBreakRequest = false;
  player.clinchBreakRequestTime = 0;
  // Clear action lock so grab/other actions aren't blocked after grab ends
  player.actionLockUntil = 0;

  // Clean up grabbed player states
  opponent.isBeingGrabbed = false;
  opponent.isBeingThrown = false;
  opponent.grabbedOpponent = null;
  opponent.throwOpponent = null;
  opponent.isHit = false;
  opponent.grabCooldown = false;
  opponent.isGrabbing = false;
  opponent.isCounterGrabbed = false;
  opponent.isAttemptingGrabThrow = false;
  opponent.grabThrowAttemptStartTime = 0;
  // New grab action system cleanup - opponent
  opponent.isGrabPushing = false;
  opponent.isBeingGrabPushed = false;
  opponent.isEdgePushing = false;
  opponent.isBeingEdgePushed = false;
  opponent.isAttemptingPull = false;
  opponent.isBeingPullReversaled = false;
  opponent.pullReversalPullerId = null;
  opponent.pullFacingDirection = null;
  opponent.isBoundaryPullSwap = false;
  opponent.isGrabSeparating = false;
  opponent.isGrabBellyFlopping = false;
  opponent.isBeingGrabBellyFlopped = false;
  opponent.isGrabFrontalForceOut = false;
  opponent.isBeingGrabFrontalForceOut = false;
  opponent.grabActionStartTime = 0;
  opponent.grabActionType = null;
  opponent.lastGrabPushStaminaDrainTime = 0;
  opponent.isAtBoundaryDuringGrab = false;
  opponent.clinchEdgePinStart = 0;
  opponent.grabDurationPaused = false;
  opponent.grabDurationPausedAt = 0;
  opponent.grabPushEndTime = 0;
  opponent.grabPushStartTime = 0;
  opponent.grabApproachSpeed = 0;
  opponent.grabDecisionMade = false;
  opponent.isGrabWalking = false;
  opponent.isGrabWhiffRecovery = false;
  opponent.isGrabTeching = false;
  opponent.grabTechRole = null;
  opponent.grabTechResidualVel = 0;
  opponent.grabCounterAttempted = false;
  opponent.grabCounterInput = null;
  opponent.lastResistStaminaDrainTime = 0;
  // Clinch system cleanup
  opponent.hasGrip = false;
  opponent.gripAcquiredTime = 0;
  opponent.isClinchBeltHolding = false;
  opponent.clinchBeltRequiresM2Release = false;
  opponent.clinchAttachDistance = 0;
  opponent.inClinch = false;
  opponent.clinchAction = null;
  opponent.clinchOpponent = null;
  opponent.clinchStalemateStart = 0;
  opponent.clinchStalemateLastX = 0;
  opponent.clinchStalemateLastBalance = 0;
  // Clinch throw/pull cleanup
  opponent.clinchThrowRequest = null;
  opponent.clinchThrowRequestTime = 0;
  opponent.clinchThrowActive = false;
  opponent.clinchThrowType = null;
  opponent.clinchThrowStartTime = 0;
  opponent.clinchThrowCooldown = false;
  opponent.clinchThrowUsedDeepGrip = false;
  opponent.clinchThrowKillBalance = null;
  opponent.clinchThrowInitiationDrain = 0;
  opponent.clinchThrowInitiationEdgeBonus = 0;
  opponent.isClinchThrowing = false;
  opponent.isClinchClashing = false;
  opponent.clinchClashStartTime = 0;
  opponent.clinchMouse2BufferTime = 0;
  opponent.clinchWTapTime = 0;
  opponent.clinchAwayTapTime = 0;
  opponent.clinchTechniquePressGameTime = 0;
  opponent.clinchTechniquePressReceiptGameNow = 0;
  opponent.isClinchPushing = false;
  opponent.isClinchPlanting = false;
  opponent.lastPlantStaminaDrainTime = 0;
  opponent.isResistingThrow = false;
  opponent.isResistingPull = false;
  opponent.isClinchOpen = false;
  opponent.clinchOpenHideStars = false;
  opponent.clinchOpenUntil = 0;
  opponent.isClinchCommittedDrive = false;
  opponent.isClinchPerfectBracing = false;
  opponent.clinchDriveHoldStart = 0;
  opponent.clinchDrivePlantCancelUntil = 0;
  opponent.clinchPushLossStart = 0;
  opponent.clinchBraceSimTime = 0;
  opponent.clinchBraceLatchUntil = 0;
  opponent.clinchBracePressGameTime = 0;
  opponent.clinchBracePressReceiptGameNow = 0;
  opponent.lastTrustedPressGameTime = 0;
  // Clinch jolt cleanup
  opponent.isClinchJolting = false;
  opponent.clinchJoltRecovery = false;
  opponent.clinchJoltCooldown = false;
  opponent.clinchJoltStartTime = 0;
  opponent.isBeingClinchJolted = false;
  opponent.clinchJoltPlantInterrupt = false;
  opponent.isClinchJoltClashing = false;
  opponent.clinchJoltRequest = false;
  opponent.clinchJoltRequestTime = 0;
  opponent.clinchJoltRecoilStart = 0;
  opponent.clinchJoltPlantInterruptStart = 0;
  // Clinch break cleanup
  opponent.clinchBreakRequest = false;
  opponent.clinchBreakRequestTime = 0;
  // Clear action lock so grab/other actions aren't blocked after grab ends
  opponent.actionLockUntil = 0;
}

function handleWinCondition(room, loser, winner, io, winType) {
  if (room.gameOver) return; // Prevent multiple win declarations

  room.gameOver = true;
  
  // Determine correct Y position for the loser based on whether they fell off the dohyo
  // Cinematic/clinch kill victims — don't touch their position (pull-kill animates Y via tween)
  if (!loser.isCinematicKillVictim && !loser.isClinchKillThrowVictim && !loser.isClinchKillPullVictim) {
    const fallenGroundLevel = GROUND_LEVEL - DOHYO_FALL_DEPTH;
    const loserShouldBeAtFallenLevel = 
      loser.isFallingOffDohyo || 
      isOutsideDohyo(loser.x, loser.y) || 
      loser.y < GROUND_LEVEL;
    loser.y = loserShouldBeAtFallenLevel ? fallenGroundLevel : GROUND_LEVEL;
  }
  winner.y = GROUND_LEVEL;
  
  winner.wins.push("w");

  // Store the win count BEFORE potentially clearing it
  const winCount = winner.wins.length;

  // MASTERY Phase 2 (2.5): win-type telemetry — record the oshi/yotsu split so
  // the playtest can confirm both conversion paths are used (audit-gated, no-op
  // by default).
  appendWinType(room, {
    winType: winType || "ringOut",
    category: classifyWinCategory(winType || "ringOut"),
    winnerId: winner.id,
    loserId: loser.id,
    matchMode: room.matchMode || "pvp",
    cpuDifficulty: room.cpuDifficulty || null,
  });

  // Stamina stays frozen at end-of-round values.
  // It resets to 100 when resetRoomAndPlayers() runs for the next round.

  // Match-end decision. Default is first-to-2 (best-of-3) — UNCHANGED for PvP
  // and VS CPU (`winCount > 1`). BASHO runs N best-of-1 bouts in ONE room:
  // each fall ends a bout, and the basho ends only after the final bout.
  // Between bouts we clear wins (so the first-to-2 path never triggers),
  // advance the CPU to the next day's opponent colors (these survive
  // resetRoomAndPlayers), and re-arm isInitialRound so the next bout reuses
  // the native between-rounds reset — no remount, no new room.
  let isMatchEnd;
  if (room.matchMode === "basho") {
    room.bashoBout = (room.bashoBout || 0) + 1;
    isMatchEnd = room.bashoBout >= (room.bashoTotalBouts || 1);
    winner.wins = [];
    loser.wins = [];
    if (!isMatchEnd) {
      const cpu = room.players.find((p) => p.isCPU);
      const next = room.bashoOpponents && room.bashoOpponents[room.bashoBout];
      if (cpu && next) {
        cpu.mawashiColor = next.mawashiColor || cpu.mawashiColor;
        cpu.bodyColor = next.bodyColor ?? null;
      }
      if (next && next.difficulty) room.cpuDifficulty = next.difficulty;
      room.isInitialRound = true;
      // Do NOT let the loop auto-reset this bout. The client resets the shared
      // room (via "basho_advance") only once the DAY card is fully covering the
      // screen — so the winner holds their victory pose and the position reset
      // never flashes between bouts. See the auto-reset gate in index.js.
      room.bashoAwaitingReset = true;
    }
  } else {
    isMatchEnd = winCount > 1;
  }

  // FORCE OUT (grabPush) holds the push/being-grabbed pose through the callout
  // — no bow. Other win types still bow after the result banner.
  const skipBow = winType === "grabPush";

  if (isMatchEnd) {
    io.in(room.id).emit("match_over", {
      isMatchOver: true,
      winner: winner.fighter,
    });
    room.matchOver = true;
    // Match concluded — flush and close the per-match input audit log.
    closeAuditLog(room);
    // Clear wins AFTER we've stored the count (will be used in game_over event below)
    winner.wins = [];
    loser.wins = [];
    if (!skipBow) {
      setPlayerTimeout(winner.id, () => {
        winner.y = GROUND_LEVEL;
        winner.isBowing = true;
        
        const killVictimStaysDown = loser.isCinematicKillVictim || loser.isClinchKillThrowVictim || loser.isClinchKillPullVictim;
        if (killVictimStaysDown) {
          // Kill victims stay in their final pose — no bowing, no repositioning
        } else {
          const loserFellOffDohyo = 
            loser.isFallingOffDohyo || 
            isOutsideDohyo(loser.x, loser.y) || 
            loser.y < GROUND_LEVEL;
          const loserGroundLevel = loserFellOffDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
          loser.y = loserGroundLevel;
          loser.isBowing = true;
        }
      }, 1050);
    }
  } else if (!skipBow) {
    setPlayerTimeout(winner.id, () => {
      winner.y = GROUND_LEVEL;
      winner.isBowing = true;
      
      const killVictimStaysDown = loser.isCinematicKillVictim || loser.isClinchKillThrowVictim || loser.isClinchKillPullVictim;
      if (killVictimStaysDown) {
        // Kill victims stay in their final pose — no bowing, no repositioning
      } else {
        const loserFellOffDohyo = 
          loser.isFallingOffDohyo || 
          isOutsideDohyo(loser.x, loser.y) || 
          loser.y < GROUND_LEVEL;
        const loserGroundLevel = loserFellOffDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
        loser.y = loserGroundLevel;
        loser.isBowing = true;
      }
    }, 1050);
  }

  // Pull-kill victim: lie dazed (eyes open) briefly after the ~850ms slide, then
  // close eyes as a "passed out" beat — must land before the ~2000ms round reset.
  // isBowing here is only the eyes-closed signal; belly-laying still wins for render.
  if (loser.isClinchKillPullVictim) {
    setPlayerTimeout(loser.id, () => { loser.isBowing = true; }, 1200, "killPullEyesClose");
  }

  // Store the current states that we want to preserve
  const loserKnockbackVelocity = { ...loser.knockbackVelocity };
  const loserMovementVelocity = loser.movementVelocity;

  // For the winner, if they're mid slap or palm thrust, let the pose finish
  // before round-end cleanup snaps them to idle/recovery.
  if (winner.isSlapAttack) {
    const remainingAttackTime = winner.attackEndTime - simNowForPlayer(winner);
    if (remainingAttackTime > 0) {
      setPlayerTimeout(winner.id, () => {
        resetPlayerAttackStates(winner);
      }, remainingAttackTime);
    }
  } else if (winner.isPalmThrust || (winner.palmThrustVisualUntil || 0) > simNowForPlayer(winner)) {
    const now = simNowForPlayer(winner);
    const until = winner.palmThrustVisualUntil || winner.attackEndTime || now;
    const remaining = Math.max(0, until - now);
    if (remaining > 0) {
      setPlayerTimeout(winner.id, () => {
        resetPlayerAttackStates(winner);
      }, remaining);
    }
  } else {
    // If not doing a slap attack, reset attack states immediately
    resetPlayerAttackStates(winner);
  }

  // Reset loser's states immediately
  resetPlayerAttackStates(loser);

  // Reset all key states and animation-triggering states for both players
  room.players.forEach((p) => {
    const currentX = p.x;
    p.isStrafing = false;

    // Clear isAtTheRopes state when game ends
    if (p.isAtTheRopes) {
      p.isAtTheRopes = false;
      p.atTheRopesStartTime = 0;
    }

    // Clear rope jump state when game ends
    if (p.isRopeJumping) {
      p.y = GROUND_LEVEL;
      p.isRopeJumping = false;
      p.ropeJumpPhase = null;
      p.ropeJumpStartTime = 0;
      p.ropeJumpStartX = 0;
      p.ropeJumpTargetX = 0;
      p.ropeJumpDirection = 0;
      p.ropeJumpActiveStartTime = 0;
      p.ropeJumpLandingTime = 0;
      p.ropeJumpRawTargetX = 0;
      p.ropeJumpResolvedTargetX = 0;
      p.ropeJumpLandingCommitted = false;
      p.ropeJumpLandingCommitX = 0;
      p.ropeJumpLandingCommitT = 0;
      p.ropeJumpLandingCommitVel = 0;
      p.ropeJumpLandingDecision = null;
      p.ropeJumpLandingPath = null;
      p.ropeJumpPreferredSide = 0;
      p.ropeJumpResolvedSide = 0;
      p.ropeJumpMinDistance = 0;
      p.ropeJumpCenterDistance = 0;
      p.ropeJumpOverlap = 0;
      p.ropeJumpSafetyCorrectionPx = 0;
      p.ropeJumpPreTouchdownX = 0;
      p.ropeJumpTouchdownX = 0;
      p.ropeJumpUsedFallback = false;
      p.ropeJumpTrajectoryType = null;
      p.ropeJumpDecisionClass = null;
      p.ropeJumpFallbackReason = null;
      p.ropeJumpHorizVel = 0;
      p.ropeJumpRawExpectedVel = 0;
      p.ropeJumpPeakVel = 0;
      p.ropeJumpPeakAccel = 0;
      p.ropeJumpReversalDetected = false;
      p.ropeJumpSideIntentLocked = false;
      p.ropeJumpSideIntent = 0;
      p.ropeJumpIntentClass = null;
      p.ropeJumpIntentReason = null;
      p.ropeJumpRecommendedCommitT = 0;
      p.ropeJumpSideIntentOpponentX = 0;
      p.ropeJumpPlanningState = null;
      p.ropeJumpFirstRawConflictTick = 0;
      p.ropeJumpFirstRawConflictT = -1;
      p.ropeJumpSideLockTick = 0;
      p.ropeJumpSideLockReason = null;
      p.ropeJumpNoReturnDeadlineT = 0;
      p.ropeJumpConflictBeforeDeadline = null;
      p.ropeJumpEndpointCommitTick = 0;
      p.ropeJumpLateIntrusion = false;
      p.ropeJumpLateIntrusionClass = null;
      p.ropeJumpSafetyCorrectionTicks = 0;
      p.ropeJumpSettleState = null;
      p.ropeJumpSidePolicy = null;
      p.ropeJumpSettleJumperIsLeft = null;
      p.ropeJumpSettleInitialOverlap = 0;
      p.ropeJumpSettleMaxOverlap = 0;
      p.ropeJumpSettleAccumulatedPx = 0;
      p.ropeJumpSettleTicksDone = 0;
      p.ropeJumpSettleTicksTotal = 0;
      p.ropeJumpSettleEpisodeCount = 0;
      p.ropeJumpSettleReactivated = false;
      p.ropeJumpOverlapIncreased = false;
      p.ropeJumpBudgetException = false;
      p.ropeJumpBudgetExceptionClass = null;
      p._landingTrace = null;
    }

    // Clear flap (flight) state when game ends
    if (p.isFlapping) {
      p.y = GROUND_LEVEL;
      p.isFlapping = false;
      p.flapPhase = null;
      p.flapCharges = 0;
      p.flapVelocityY = 0;
      p.flapVelocityX = 0;
      p.flapStartTime = 0;
      p.flapLandingTime = 0;
      p.flapWingBeatTime = 0;
      p.flapFastFalling = false;
      p.flapDiveCommitted = false;
      p.flapDiveLockX = 0;
      p.flapBeatHDir = 0;
      p.flapHitLanded = false;
      p.flapHitLandStartY = 0;
      p.flapHitLandStartX = 0;
      p.flapHitLandTargetX = 0;
      p.flapHitRecoverDuration = 0;
      p.lastFlapChargeTime = 0;
    }

    // Clear ice slide / slide-jump when game ends
    if (p.isSlideJumping) {
      p.y = GROUND_LEVEL;
    }
    p.isIceSliding = false;
    p.iceSlideDir = 0;
    p.iceSlideStartTime = 0;
    p.slideJumpBufferUntil = 0;
    p.isIceSlideReverseHopping = false;
    p.iceSlideReverseHopStartTime = 0;
    p.iceSlideReverseHopUntil = 0;
    p.iceSlideReverseCooldownUntil = 0;
    p.iceSlideReverseBufferUntil = 0;
    p.iceSlideBrakeArmStart = 0;
    p.isSlideJumping = false;
    p.slideJumpPhase = null;
    p.slideJumpVelocityY = 0;
    p.slideJumpVelocityX = 0;
    p.slideJumpDiveCommitted = false;
    p.slideJumpFastFalling = false;
    p.slideJumpDiveLockX = 0;
    p.slideJumpHitLanded = false;
    p.slideJumpHitRecoverDuration = 0;
    p.slideJumpLandingTime = 0;
    p.slideJumpStartTime = 0;
    p.offensiveAerial = null;
    p._offensiveAerialTrace = null;

    // Clear parry states to prevent jiggle/flash animations persisting into round result
    p.isRawParrying = false;
    p.isGuarding = false;
    p.rawParryStartTime = 0;
    p.rawParryMinDurationMet = false;
    p.rawParryCooldownUntil = 0;
    p.isRawParrySuccess = false;
    p.isPerfectRawParrySuccess = false;
    p.isRawParryStun = false;
    // Guard & Parry (AP) state
    p.apActiveUntil = 0;
    p.apFlowUntil = 0;
    p.apChainCount = 0;
    p.apFlurryUntil = 0;
    p.isApWhiffRecovering = false;
    p.apRecoveryUntil = 0;
    p.apCooldownUntil = 0;
    p.apSpaceConsumed = false;
    p.apGuardNeedsRelease = false;
    p.isApPostParryLocked = false;
    p.apPostParryLockUntil = 0;
    p.isMatadorParrying = false;
    p.isMatadorSuccess = false;
    p.matadorStartTime = 0;
    p.matadorActiveUntil = 0;
    p.matadorSuccessUntil = 0;
    p.isMatadorWhiffRecovering = false;
    p.matadorRecoveryUntil = 0;

    // Clear ALL grab states to prevent grabs persisting into next round
    p.isGrabbing = false;
    p.isBeingGrabbed = false;
    p.grabbedOpponent = null;
    p.grabStartTime = 0;
    p.isThrowing = false;
    p.isBeingThrown = false;
    p.throwStartTime = 0;
    p.throwEndTime = 0;
    p.throwOpponent = null;
    p.throwingFacingDirection = null;
    p.beingThrownFacingDirection = null;
    p.isGrabBreaking = false;
    p.isGrabBreakCountered = false;
    p.isGrabTeching = false;
    p.grabTechRole = null;
    p.isGrabPushing = false;
    p.isBeingGrabPushed = false;
    p.isAttemptingPull = false;
    p.isGrabSeparating = false;
    p.isGrabWalking = false;
    p.isGrabbingMovement = false;
    p.isGrabStartup = false;
    p.isWhiffingGrab = false;
    p.isGrabWhiffRecovery = false;
    p.isGrabBellyFlopping = false;
    p.isBeingGrabBellyFlopped = false;
    p.isGrabFrontalForceOut = false;
    p.isBeingGrabFrontalForceOut = false;
    p.isCounterGrabbed = false;
    p.isAttemptingGrabThrow = false;
    p.grabThrowAttemptStartTime = 0;
    p.grabState = GRAB_STATES.INITIAL;
    p.grabAttemptType = null;
    p.hasGrip = false;
    p.gripAcquiredTime = 0;
    p.isClinchBeltHolding = false;
    p.clinchBeltRequiresM2Release = false;
    p.clinchAttachDistance = 0;
    p.inClinch = false;
    p.clinchAction = null;
    // Push-war HUD must clear on win — updateGrabActions won't run again
    // (isGrabbing is cleared above), so a shove-lead of ±1 would otherwise
    // stick through the result screen and into the next round/bout.
    p.clinchShoveLead = null;
    p.hasDeepGrip = false;
    p.deepGripPushStart = 0;
    p.clinchPushRampStart = 0;
    p.clinchStalemateStart = 0;
    p.clinchThrowRequest = null;
    p.clinchThrowRequestTime = 0;
    p.clinchThrowActive = false;
    p.clinchThrowType = null;
    p.clinchThrowStartTime = 0;
    p.clinchThrowCooldown = false;
    p.clinchThrowUsedDeepGrip = false;
    p.clinchThrowKillBalance = null;
    p.clinchThrowInitiationDrain = 0;
    p.clinchThrowInitiationEdgeBonus = 0;
    p.isClinchThrowing = false;
    p.isClinchClashing = false;
    p.clinchClashStartTime = 0;
    p.isClinchPushing = false;
    p.isClinchPlanting = false;
    p.isClinchOpen = false;
    p.clinchOpenHideStars = false;
    p.clinchOpenUntil = 0;
    p.isClinchCommittedDrive = false;
    p.isClinchPerfectBracing = false;
    p.clinchDriveHoldStart = 0;
    p.clinchDrivePlantCancelUntil = 0;
    p.clinchPushLossStart = 0;
    p.clinchBraceSimTime = 0;
    p.clinchBraceLatchUntil = 0;
    p.clinchBracePressGameTime = 0;
    p.clinchThrowArcDistance = 0;
    p.isResistingThrow = false;
    p.isResistingPull = false;
    p.isClinchJolting = false;
    p.clinchJoltRecovery = false;
    p.clinchJoltCooldown = false;
    p.clinchJoltStartTime = 0;
    p.isBeingClinchJolted = false;
    p.clinchJoltPlantInterrupt = false;
    p.isClinchJoltClashing = false;
    p.clinchJoltRequest = false;
    p.clinchJoltRequestTime = 0;
    p.clinchJoltRecoilStart = 0;
    p.clinchJoltPlantInterruptStart = 0;

    p.pendingSlapCount = 0;
    p.slapAnimationToggle = 0;
    p.currentSlapHitConnected = false;
    p.slapOpenHitPending = false;
    p.mouse1JustPressed = false;
    p.mouse1JustReleased = false;

    // Drop pending inputs — a grab/dodge/slap buffered while flying out must
    // not execute during the round result, and queued packets are stale too.
    p.inputBuffer = null;
    p.inputQueue = [];

    p.keys = createInitialKeys();
    p.x = currentX;
  });

  // Keep the loser's knockback and movement velocity for sliding effect
  loser.knockbackVelocity = loserKnockbackVelocity;
  loser.movementVelocity = loserMovementVelocity;
  winner.knockbackVelocity = { x: 0, y: 0 };
  winner.movementVelocity = 0;
  
  // CRITICAL: Force loser Y position AGAIN after all state changes
  // Skip for cinematic/clinch kill victims — they're mid-arc, flying off, or being pulled off
  if (!loser.isCinematicKillVictim && !loser.isClinchKillThrowVictim && !loser.isClinchKillPullVictim) {
    const loserFellOff = loser.isFallingOffDohyo || isOutsideDohyo(loser.x, loser.y) || loser.y < GROUND_LEVEL;
    loser.y = loserFellOff ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
  }
  
  // NOTE: Do NOT clear isHit here - the knockback physics need to continue running
  // so the player can slide past the map boundaries naturally

  io.in(room.id).emit("game_over", {
    isGameOver: true,
    winner: {
      id: winner.id,
      fighter: winner.fighter,
    },
    wins: winCount,
    winType: winType || "ringOut",
  });
  room.winnerId = winner.id;
  room.loserId = loser.id;
  if (!room.gameOverTime) {
    room.gameOverTime = simNow(room);
  }

  setPlayerTimeout(loser.id, () => {
    if (room.players) {
      room.players.forEach((p) => {
        if (p.id === loser.id) {
          p.knockbackVelocity.x = 0;
          p.knockbackVelocity.y = 0;
          p.movementVelocity = 0;
        }
      });
    }
  }, 3000);
}

// Add this new function near the other helper functions
// MASTERY Phase 3 (tsuppari cadence): `cadenceEnhanced` is passed true ONLY by
// endSlapCycle when the buffered follow-up press was timed late & precise inside
// the cycle (gap ≤ CADENCE_WINDOW_MS). A direct/fresh press (or the flag off)
// always starts a normal slap. Everything about the enhancement is ceiling-only
// and gated on MASTERY_P3_CADENCE below.
function executeSlapAttack(player, rooms, cadenceEnhanced = false) {
  // Round is over — never fire a stray slap. This is the central guard covering
  // every slap entry point (buffered post-grab inputs, slap-string continuations
  // on timers, rope-jump attack releases, CPU, etc.) so none of them resolve into
  // a slap (and its slap-hands VFX) during a win cinematic.
  const ownerRoom = rooms && rooms.find((room) => room.players.some((p) => p.id === player.id));
  if (ownerRoom && (ownerRoom.gameOver || ownerRoom.matchOver)) return;

  // A flap owns the player from liftoff through landing recovery — no slap may
  // resolve mid-flight. This is the root cause of the intermittent slap-hands
  // VFX during flap: a click buffered just before takeoff (or a slap-string
  // continuation timer scheduled before it) fires here a tick or two AFTER
  // beginFlapStartup cleared isSlapAttack, re-setting isSlapAttack + a fresh
  // slapAnimation on the airborne penguin. The client gate (!isFlapping) hides
  // it while aloft, but the slap cycle outlives the flap, so the hands pop the
  // instant the flap ends. Guarding the single point where isSlapAttack is set
  // true stops the leak at the source (covers buffered/timer/CPU entry points).
  if (player.isFlapping || player.flapPhase) return;

  // MASTERY Phase 0 telemetry — snapshot entry velocity BEFORE the slide
  // overwrite below (velocity-at-press for the momentum-curve histogram).
  const slapEntryVelocity = player.movementVelocity;

  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    if (opponent) {
      if (!player.slapFacingDirection) {
        player.slapFacingDirection = player.x < opponent.x ? -1 : 1;
      }
      player.facing = player.slapFacingDirection;

      const slideDirection = player.facing === 1 ? -1 : 1;

      // MASTERY Phase 1: the slap's base slide BLENDS with the velocity carried
      // into the press instead of a flat 1.0 — a dash-in slap shoves ~2× a
      // flat-footed one, a fade-away (retreating) slap steps in short & safe.
      // Floor is today's 1.0 at entry velocity 0 (invariant #2); only distances
      // change (invariant #1). The power/BASHO slide scaling below still stacks
      // on top of the blended base, exactly as it did on the flat 1.0.
      let slapSlideVelocity = 1.0;
      if (MASTERY_P1_MOMENTUM) {
        // Reliable inheritance: use whichever is stronger between the live
        // velocity and the momentum carry stamped by a recent dodge/slide (see
        // takeInheritedVelocity). This is what makes "dodge → (buffered) mouse1"
        // consistently carry the dash's momentum instead of depending on a
        // frame-perfect press before the landing slide decays.
        const inheritV = takeInheritedVelocity(
          player,
          slapEntryVelocity,
          simNowForPlayer(player)
        );
        const aligned = alignedEntryVelocity(inheritV, slideDirection);
        slapSlideVelocity = Math.max(
          SLAP_SLIDE_MIN,
          Math.min(1.0 + K_SLAP_INHERIT * aligned, SLAP_SLIDE_MAX)
        );
        // Consumed by the on-hit ground transfer (processHit slap branch).
        player.slapEntryAligned = Math.max(0, aligned);
      } else {
        player.slapEntryAligned = 0;
      }

      if (player.activePowerUp === "power") {
        slapSlideVelocity *= player.powerUpMultiplier - 0.1;
      }
      // BASHO draft: stacked Power Water mirrors the slap-slide boost (guarded
      // so undrafted / non-BASHO fighters keep the base 1.0 slide). Uses the
      // same ~2:3 slide:knockback ratio as PvP's (mult - 0.1) formula so a
      // +5% BASHO pick doesn't fall below 1.0x slide (mult - 0.1 would).
      if ((player.bashoDraft?.powerMult ?? 1) > 1) {
        const bashoSlideBoost =
          1 + (player.bashoDraft.powerMult - 1) * (2 / 3);
        slapSlideVelocity *= bashoSlideBoost;
      }

      player.movementVelocity = slideDirection * slapSlideVelocity;
      player.isSlapSliding = true;
    }
  }

  if (player.isSlapAttack && player.isAttacking) {
    return;
  }

  logVerbInitiation(currentRoom, player, "slap", slapEntryVelocity);

  clearChargeState(player);

  // === INDIVIDUAL SLAP (no string / no combo) ===
  // Every press is one self-contained slap. On hit the exchange is +0 by
  // construction (see processHit: victim hitstun = attacker's remaining cycle),
  // so the reward is GROUND, never frames. All attack-cycle timestamps below
  // live on the room's pausable sim clock, so the whole cycle freezes in
  // lockstep during hitstop.
  const now = simNowForPlayer(player);

  // MASTERY Phase 3 (tsuppari cadence): stamp the press moment. This is the
  // "direct-press path" stamp — a buffered press re-stamps this at its own queue
  // time (socketHandlers / CPU cadence), and endSlapCycle reads it to grade the
  // NEXT slap. Harmless with the flag off (never read).
  player.pendingSlapPressTime = now;

  // Resolve the cadence enhancement for THIS slap. Only a late-&-precise buffered
  // follow-up (graded in endSlapCycle) arrives here enhanced; the base slap is
  // never touched (reward-only). isEnhancedSlap latches for the whole cycle so
  // processHit can read it at connect (enhanced posture drain + pair shift).
  const isEnhancedSlap = MASTERY_P3_CADENCE && cadenceEnhanced === true;
  player.isEnhancedSlap = isEnhancedSlap;
  // Consecutive enhanced slaps escalate the cosmetic chain (delta prop → VFX/SFX).
  // A normal slap in a string breaks the streak (chain → 0); whiff/clash/parry/
  // hit-taken also reset it at their own sites.
  player.cadenceChain = isEnhancedSlap ? (player.cadenceChain || 0) + 1 : 0;

  // Cosmetic animation alternation: slap1 ↔ slap2 have identical properties.
  player.slapAnimationToggle = player.slapAnimationToggle === 1 ? 2 : 1;
  player.slapAnimation = player.slapAnimationToggle;

  player.currentSlapHitConnected = false;
  player.slapOpenHitPending = false;

  player.stamina = Math.max(0, player.stamina - SLAP_ATTACK_STAMINA_COST);

  // Enhanced slaps run a SHORTER total cycle (only the recovery tail shrinks —
  // startup + active window are byte-identical, so hitbox timing is unchanged).
  // The +0 exchange survives automatically: processHit derives victim hitstun
  // from the attacker's remaining cycle (attackCooldownUntil), which is set from
  // totalCycleDuration below — both players just become actionable sooner.
  const attackDuration = SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  const totalCycleDuration = isEnhancedSlap ? SLAP_TOTAL_MS_ENHANCED : SLAP_TOTAL_MS;

  player.isSlapAttack = true;
  player.isPalmThrust = false; // A slap is never a palm — clear any lingering hold flag
  player.isLowKick = false;
  player.attackEndTime = now + attackDuration;
  player.slapActiveEndTime = now + attackDuration;
  player.isAttacking = true;
  player.attackStartTime = now;
  player.attackType = "slap";
  player.currentAction = "slap";
  player.attackAttemptTime = now;
  player.attackCooldownUntil = now + totalCycleDuration;

  player.isInStartupFrames = true;
  player.startupEndTime = now + SLAP_STARTUP_MS;

  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    SLAP_STARTUP_MS
  );

  // Ends the slap and fires a buffered press if one is queued. Runs at cycle
  // end on hit, or after the whiff-cooldown extension on whiff.
  const endSlapCycle = () => {
      player.isAttacking = false;
      player.isSlapAttack = false;
      player.attackType = null;
      player.isSlapSliding = false;
      player.slapFacingDirection = null;
      player.isInStartupFrames = false;
      player.slapActiveEndTime = 0;
      player.slapOpenHitPending = false;
      player.currentAction = null;

      const isPlayerValid = () => (
        !player.isDodging && !player.isThrowing && !player.isBeingThrown &&
        !player.isGrabbing && !player.isBeingGrabbed && !player.isRawParryStun &&
        !player.isRawParrying && !player.isHit && !player.canMoveToReady
      );

      // Back was held mid-slap → flow into the rooted palm thrust instead of
      // another slap. Takes priority over a buffered slap so "hold back" always
      // wins the transition. executePalmThrust re-guards on !isAttacking (just
      // cleared above) so this can never eat an in-progress slap.
      if (player.pendingPalmThrust && isPlayerValid()) {
        player.pendingPalmThrust = false;
        player.pendingSlapCount = 0;
        executePalmThrust(player, rooms);
        return;
      }

      // Buffered press → next slap fires immediately. Pure responsiveness:
      // on hit the exchange was +0, so this follow-up is fully contestable
      // (the victim is actionable at this exact instant too — mash mirrors
      // clash); on whiff the extra recovery has already been served.
      if (player.pendingSlapCount > 0 && isPlayerValid()) {
        player.pendingSlapCount--;
        // MASTERY Phase 3: grade the cadence of THIS follow-up. gap = how long
        // before cycle end the buffered press was queued. A masher buffers EARLY
        // (large gap → normal); a rhythm player presses LATE & precise (small
        // gap ≤ CADENCE_WINDOW_MS → enhanced). Judged on the sim clock via the
        // stored press timestamp, never on packet arrival (netcode note 5).
        let cadenceEnhanced = false;
        if (MASTERY_P3_CADENCE && player.pendingSlapPressTime > 0) {
          const gap = simNowForPlayer(player) - player.pendingSlapPressTime;
          cadenceEnhanced = gap <= CADENCE_WINDOW_MS;
        }
        executeSlapAttack(player, rooms, cadenceEnhanced);
        return;
      }
      player.pendingSlapCount = 0;
      player.pendingPalmThrust = false;
  };

  player.slapCycleEndCallback = () => {
      // === WHIFF COOLDOWN ===
      // A slap that did NOT connect holds its recovery pose a touch longer
      // (SLAP_WHIFF_EXTRA_RECOVERY_MS) before ending. Spam away — but landing
      // hits keeps your rhythm faster than swinging at air. Never runs on hit,
      // so the +0 hitstun math (keyed to attackCooldownUntil at connect time)
      // is untouched.
      if (!player.currentSlapHitConnected) {
        // MASTERY Phase 3: a whiff breaks the tsuppari rhythm — reset the chain.
        player.cadenceChain = 0;
        player.attackCooldownUntil = Math.max(
          player.attackCooldownUntil || 0,
          simNowForPlayer(player) + SLAP_WHIFF_EXTRA_RECOVERY_MS
        );
        setPlayerTimeout(player.id, endSlapCycle, SLAP_WHIFF_EXTRA_RECOVERY_MS, "slapCycle");
        return;
      }
      endSlapCycle();
  };

  setPlayerTimeout(
    player.id,
    player.slapCycleEndCallback,
    totalCycleDuration,
    "slapCycle"
  );
}

// OPEN-PALM THRUST (back + mouse1) — a rooted, single-hit counterpart to the
// advancing slap string. It rides the charged hit-resolution path (attackType
// "charged" + isPalmThrust flag) as a fixed-power mini-charge, so it inherits
// all the battle-tested charged knockback/trade/parry logic for free, but:
//   • takes NO forward lunge (the lunge block in index.js is gated on
//     !isPalmThrust) — the player holds their ground,
//   • uses its own fast startup / long whiff-recovery frame data, and
//   • deals a fixed "weak charged" knockback (PALM_THRUST_POWER).
// The whiff recovery (safelyEndChargedAttack) and connected-hit recovery
// (processHit) both branch on isPalmThrust for their palm-specific values.
function executePalmThrust(player, rooms) {
  // Same central guards as the slap: never fire during a win cinematic or
  // mid-flap (a buffered click must not resolve into a stray thrust).
  const ownerRoom = rooms && rooms.find((room) => room.players.some((p) => p.id === player.id));
  if (ownerRoom && (ownerRoom.gameOver || ownerRoom.matchOver)) return;
  if (player.isFlapping || player.flapPhase) return;

  if (player.isAttacking) return; // Only from neutral — never cancels a slap string

  // MASTERY Phase 0 telemetry — snapshot entry velocity before the move roots
  // the player (movementVelocity = 0 below).
  const palmEntryVelocity = player.movementVelocity;

  // Drop any stale visual-hold timer from a prior thrust so it can't clear the
  // isPalmThrust flag mid-way through this fresh one.
  timeoutManager.clearPlayerSpecific(player.id, "palmThrustVisualEnd");

  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;

  clearChargeState(player);

  // This press already spent itself on the thrust. Keep mouse1 from auto-
  // starting a headbutt charge while still held after the move ends (facing
  // flip or adding S+forward mid-hold used to strand the charge shake).
  player.mouse1ConsumedUntilRelease = true;

  const now = simNowForPlayer(player);

  // Auto-correct facing toward the opponent, then lock it for the move so the
  // thrust always fires the correct way even if inputs jitter.
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );
  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    if (opponent && !opponent.isDodging && !opponent.isSidestepping) {
      player.facing = player.x < opponent.x ? -1 : 1;
    }
  }
  logVerbInitiation(currentRoom, player, "palm", palmEntryVelocity);
  player.chargingFacingDirection = player.facing;

  // Rooted: no forward slide, ever.
  player.movementVelocity = 0;
  player.isSlapSliding = false;
  player.isStrafing = false;
  player.isBraking = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;

  // A palm thrust starts from neutral — it must NOT inherit a stale slap buffer.
  // Leaving pendingSlapCount > 0 here is the root of the post-thrust strafe lock
  // (the strafe gate blocks on it, and nothing in the thrust path drains it).
  player.pendingSlapCount = 0;
  player.pendingPalmThrust = false;

  player.stamina = Math.max(0, player.stamina - PALM_THRUST_STAMINA_COST);

  // Rides the charged resolution path with a fixed power.
  player.attackType = "charged";
  player.isPalmThrust = true;
  player.isSlapAttack = false;
  player.isLowKick = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = PALM_THRUST_POWER;
  player.chargedAttackHit = false;

  player.isAttacking = true;
  player.attackStartTime = now;
  player.attackAttemptTime = now;

  // Per-thrust VFX nonce. Buffered back+mouse1 spam can execute the next
  // thrust while isPalmThrust is still latched true (the client never sees a
  // false→true edge), so a monotonically increasing id is what tells the
  // client "a NEW thrust fired" — one force-cone per execution, always.
  player.palmThrustFxId = (player.palmThrustFxId || 0) + 1;

  const activeWindowEnd = now + PALM_THRUST_STARTUP_MS + PALM_THRUST_ACTIVE_MS;
  player.attackEndTime = activeWindowEnd;
  player.chargedActiveEndTime = activeWindowEnd;
  // Strike pose through active + recovery — only safelyEndChargedAttack (and
  // processHit on connect) schedule the visual-end timeout. Scheduling here
  // at activeWindowEnd clears isPalmThrust before recovery handoff, so the
  // move falls through to generic charged whiff recovery (400ms + slide back).
  player.palmThrustVisualUntil = activeWindowEnd;

  // Startup telegraph — no hitbox until it ends (checkCollision gates on this).
  player.isInStartupFrames = true;
  player.startupEndTime = now + PALM_THRUST_STARTUP_MS;
  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    PALM_THRUST_STARTUP_MS,
    "palmThrustStartupEnd"
  );

  // Render as the generic charged "attack" pose (placeholder until a dedicated
  // animation exists) and lock the action through startup for readability.
  player.currentAction = "charged";
  player.actionLockUntil = now + PALM_THRUST_STARTUP_MS;
}

// LOW KICK / TRIP (S + mouse1, no forward) — rooted anti-defense poke.
// Beats parry/guard and grab; loses to slap / palm / charged on trade.
// No ring-out; small knockback; posture-focused. Single-frame art for now.
function executeLowKick(player, rooms) {
  if (!LOW_KICK_ENABLED) return;
  const ownerRoom = rooms && rooms.find((room) => room.players.some((p) => p.id === player.id));
  if (ownerRoom && (ownerRoom.gameOver || ownerRoom.matchOver)) return;
  if (player.isFlapping || player.flapPhase) return;
  if (player.isAttacking) return;

  const kickEntryVelocity = player.movementVelocity;
  timeoutManager.clearPlayerSpecific(player.id, "lowKickCycle");

  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;

  clearChargeState(player);
  player.mouse1ConsumedUntilRelease = true;

  const now = simNowForPlayer(player);

  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );
  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);
    if (opponent && !opponent.isDodging && !opponent.isSidestepping) {
      player.facing = player.x < opponent.x ? -1 : 1;
    }
  }
  logVerbInitiation(currentRoom, player, "lowKick", kickEntryVelocity);
  player.chargingFacingDirection = player.facing;

  // Rooted: no forward slide.
  player.movementVelocity = 0;
  player.isSlapSliding = false;
  player.isStrafing = false;
  player.isBraking = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;

  player.pendingSlapCount = 0;
  player.pendingPalmThrust = false;
  player.currentLowKickHitConnected = false;

  player.stamina = Math.max(0, player.stamina - LOW_KICK_STAMINA_COST);

  player.attackType = "lowKick";
  player.isLowKick = true;
  player.isSlapAttack = false;
  player.isPalmThrust = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargedAttackHit = false;

  player.isAttacking = true;
  player.attackStartTime = now;
  player.attackAttemptTime = now;

  const activeWindowEnd = now + LOW_KICK_STARTUP_MS + LOW_KICK_ACTIVE_MS;
  player.attackEndTime = now + LOW_KICK_TOTAL_MS;
  player.lowKickActiveEndTime = activeWindowEnd;
  player.attackCooldownUntil = now + LOW_KICK_TOTAL_MS;

  player.isInStartupFrames = true;
  player.startupEndTime = now + LOW_KICK_STARTUP_MS;
  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    LOW_KICK_STARTUP_MS,
    "lowKickStartupEnd"
  );

  player.currentAction = "lowKick";
  player.actionLockUntil = now + LOW_KICK_STARTUP_MS;

  const endLowKick = () => {
    player.isAttacking = false;
    player.isLowKick = false;
    player.attackType = null;
    player.isInStartupFrames = false;
    player.lowKickActiveEndTime = 0;
    player.currentAction = null;
    player.currentLowKickHitConnected = false;
  };

  setPlayerTimeout(player.id, endLowKick, LOW_KICK_TOTAL_MS, "lowKickCycle");
}

function cleanupRoom(room) {
  // Clear any intervals
  if (room.gameLoop) {
    clearInterval(room.gameLoop);
  }

  // Reset room state
  room.players = [];
  room.readyCount = 0;
  room.rematchCount = 0;
  room.gameStart = false;
  room.hakkiyoiCount = 0;
  room.gameOver = false;
  room.matchOver = false;
  room.readyStartTime = null;
  room.gameOverTime = null;
  room.loserId = null;
}

// Add this new function near the other helper functions
function executeChargedAttack(player, chargePercentage, rooms) {
  // Cancel power slide when attacking
  if (player.isPowerSliding) {
    player.isPowerSliding = false;
  }
  
  // Clear parry success state when starting an attack
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  
  // Prevent double execution - if player is already attacking, don't start another attack
  if (player.isAttacking && player.attackType === "charged") {
    return;
  }

  // Charged attacks drain a little more stamina than a slap
  player.stamina = Math.max(0, player.stamina - CHARGED_ATTACK_STAMINA_COST);

  // Don't execute charged attack if player is in a throw state
  if (player.isThrowing || player.isBeingThrown) {
    return;
  }

  // MASTERY Phase 0 telemetry — entry velocity at charge release (typically ~0
  // since charging is rooted, but recorded for a complete per-verb picture).
  const chargedEntryVelocity = player.movementVelocity;

  // Store previous recovery state in case we need to restore it
  const previousRecoveryState = {
    isRecovering: player.isRecovering,
    recoveryStartTime: player.recoveryStartTime,
    recoveryDuration: player.recoveryDuration,
    recoveryDirection: player.recoveryDirection,
  };

  // Only clear recovery state after we're certain the attack will execute
  player.isRecovering = false;
  player.recoveryStartTime = 0;
  player.recoveryDuration = 0;
  player.recoveryDirection = null;

  player.isSlapAttack = false;
  // A real charged attack always lunges — make sure a lingering palm-thrust /
  // low-kick flag (from a prior rooted move) can never root it.
  player.isPalmThrust = false;
  player.isLowKick = false;

  // Honda-style headbutt window: startup → charge-scaled active → whiff recovery.
  // Lunge travel = startup + active (no multi-second skating hitbox). Range still
  // grows with charge via lunge SPEED (and a longer active at higher charge).
  const charge01 = Math.max(0, Math.min(chargePercentage, 100)) / 100;
  const activeMs =
    CHARGED_ACTIVE_MIN_MS +
    (CHARGED_ACTIVE_MAX_MS - CHARGED_ACTIVE_MIN_MS) * charge01;
  const attackDuration = CHARGED_STARTUP_MS + activeMs;

  // Attack-cycle timestamps live on the pausable sim clock (freeze with hitstop)
  const nowSim = simNowForPlayer(player);
  player.attackEndTime = nowSim + attackDuration;
  player.attackType = "charged";
  player.chargeAttackPower = chargePercentage;

  // Set attack state
  player.isAttacking = true;
  player.attackStartTime = nowSim;
  
  // Track when attack was attempted for counter hit detection
  player.attackAttemptTime = nowSim;
  
  // === STARTUP FRAMES - Telegraph before attack becomes active ===
  player.isInStartupFrames = true;
  player.startupEndTime = nowSim + CHARGED_STARTUP_MS;
  // Hitbox live only during the active window (not a long coast after).
  player.chargedActiveEndTime = nowSim + CHARGED_STARTUP_MS + activeMs;
  
  // Set timeout to end startup frames
  setPlayerTimeout(
    player.id,
    () => {
      player.isInStartupFrames = false;
    },
    CHARGED_STARTUP_MS,
    "chargedStartupEnd"
  );
  
  // Action lock through startup for visual clarity
  player.currentAction = "charged";
  player.actionLockUntil = simNowForPlayer(player) + CHARGED_STARTUP_MS;

  // Add hit tracking
  player.chargedAttackHit = false;

  // Thick Blubber is GRABS ONLY now — it no longer recharges (or applies) on a
  // charged attack. The absorb is refreshed when a grab starts (socketHandlers /
  // cpuAI), so nothing to do here.

  // Auto-correct facing direction before locking it (similar to slap attacks after throw)
  // Find the current room and opponent
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  if (currentRoom) {
    const opponent = currentRoom.players.find((p) => p.id !== player.id);

    // Only auto-correct if opponent exists, is NOT dodging, and hasn't just dodged through us
    // If opponent is dodging or just crossed through, preserve the original facing direction
    // so the charged attack continues in its committed direction and whiffs naturally
    if (opponent && !opponent.isDodging && !opponent.isSidestepping) {
      const shouldFaceRight = player.x < opponent.x;
      const correctedFacing = shouldFaceRight ? -1 : 1;

      player.facing = correctedFacing;
    }

    logVerbInitiation(currentRoom, player, "charged", chargedEntryVelocity);
  }

  // Lock facing direction during attack (after auto-correction)
  player.chargingFacingDirection = player.facing;
  if (player.chargingFacingDirection !== null) {
    player.facing = player.chargingFacingDirection;
  }

  // Reset charging state but keep the charge power for knockback
  player.isChargingAttack = false;
  player.chargeStartTime = 0;

  // Note: Recovery and state cleanup is now handled by safelyEndChargedAttack
  // in the main tick function when attackEndTime is reached
}

// Add new function to calculate effective hitbox size based on facing direction
function calculateEffectiveHitboxSize(player) {
  // Shared source of truth with landing resolution (pushboxGeometry.js).
  const baseSize = getPushboxHalfWidth(player.sizeMultiplier);

  // Only apply asymmetric adjustments if player has size power-up
  // if (player.activePowerUp === POWER_UP_TYPES.SIZE) {
  //   // Return asymmetric hitbox for size power-up
  //   return {
  //     left: baseSize * SIZE_POWERUP_LEFT_MULTIPLIER,
  //     right: baseSize * SIZE_POWERUP_RIGHT_MULTIPLIER,
  //   };
  // }

  // For normal size, return symmetric hitbox
  return {
    left: baseSize,
    right: baseSize,
  };
}

function handleReadyPositions(room, player1, player2, io) {
  if (room.gameStart === false && room.hakkiyoiCount === 0) {
    // Only adjust player 1's ready position based on size power-up
    const player1ReadyX = 543; // Removed SIZE power-up condition
    const player2ReadyX = 735;

    // Only move players if they're allowed to move (after salt throw) AND they're not attacking
    // isChargingAttack is allowed — tachiai charging during walk-to-ready
    if (
      player1.canMoveToReady &&
      !player1.isAttacking
    ) {
      if (player1.x < player1ReadyX) {
        player1.x += 2;
        player1.isStrafing = true;
      } else {
        player1.x = player1ReadyX;
        if (player2.x === player2ReadyX) {
          player1.isStrafing = false;
        }
      }
    }

    if (
      player2.canMoveToReady &&
      !player2.isAttacking
    ) {
      if (player2.x > player2ReadyX) {
        player2.x -= 2; // Adjust speed as needed
        player2.isStrafing = true;
      } else {
        player2.x = player2ReadyX;
        player2.isStrafing = false;
      }
    }

    // Set ready state INDEPENDENTLY for each player when they reach their position
    // isChargingAttack is allowed — tachiai charging doesn't block ready state
    if (
      player1.x === player1ReadyX &&
      !player1.isAttacking &&
      !player1.isReady
    ) {
      player1.isReady = true;
    }
    
    if (
      player2.x === player2ReadyX &&
      !player2.isAttacking &&
      !player2.isReady
    ) {
      player2.isReady = true;
    }

    // Only start the game countdown when BOTH players are ready
    if (player1.isReady && player2.isReady) {
      // Start a timer to trigger hakkiyoi after players are ready
      // (sim clock — index.js tick also reads readyStartTime against room.simTime)
      if (!room.readyStartTime) {
        room.readyStartTime = simNow(room);
      }

      const currentTime = simNow(room);
      const elapsedTime = currentTime - room.readyStartTime;
      
      // Authentic sumo timing:
      // 0-1500ms: Wait for power-up reveal to finish
      // 700ms: Gyoji says "TE WO TSUITE!" (Put your hands down!)
      // 3200ms: HAKKIYOI (game_start)
      
      if (elapsedTime >= 700 && !room.teWoTsuiteSent) {
        room.teWoTsuiteSent = true;
        io.in(room.id).emit("gyoji_call", "TE WO TSUITE!");
      }
      
      if (elapsedTime >= 3200) {
        // Clear the power-up auto-selection timer if players ready up normally
        if (room.roundStartTimer) {
          clearTimeout(room.roundStartTimer);
          room.roundStartTimer = null;
        }
        room.gameStart = true;
        // Audit log opens here (idempotent across rounds within a match).
        openAuditLog(room);
        room.hakkiyoiCount = 1;
        // Reset canMoveToReady for both players when game starts
        player1.canMoveToReady = false;
        player2.canMoveToReady = false;
        // Ensure ritual phase is ended for both players
        player1.isInRitualPhase = false;
        player2.isInRitualPhase = false;
        // Reset mouse1PressTime so pre-game holds don't instantly trigger charging
        player1.mouse1PressTime = 0;
        player2.mouse1PressTime = 0;
        // Apply movement holds that spanned the ready wait (see socketHandlers
        // movementKeysBufferedBeforeStart) so the opening strafe isn't dead
        // until the player releases and re-presses.
        for (const p of [player1, player2]) {
          if (p.movementKeysBufferedBeforeStart) {
            const buf = p.movementKeysBufferedBeforeStart;
            p.keys = p.keys || {};
            if (buf.a) p.keys.a = true;
            if (buf.d) p.keys.d = true;
            p.movementKeysBufferedBeforeStart = null;
          }
        }
        io.in(room.id).emit("game_start", true);
        player1.isReady = false;
        player2.isReady = false;
        room.readyStartTime = null;
        room.teWoTsuiteSent = false;
      }
    } else {
      // Reset if players leave ready state
      room.readyStartTime = null;
      room.teWoTsuiteSent = false;
    }
  } else {
    // Clear ready states when game starts
    player1.isReady = false;
    player2.isReady = false;
    // Ensure canMoveToReady is false during gameplay
    player1.canMoveToReady = false;
    player2.canMoveToReady = false;
  }
}

function arePlayersColliding(player1, player2) {
  // If either player is dodging, sidestepping, rope jumping, or slide-jumping
  // (incl. FLAP-armed), return false — airborne bodies have no ground pushbox.
  if (player1.isDodging || player2.isDodging ||
      player1.isSidestepping || player2.isSidestepping ||
      (player1.isRopeJumping && player1.ropeJumpPhase === "active") ||
      (player2.isRopeJumping && player2.ropeJumpPhase === "active") ||
      (player1.isSlideJumping && player1.slideJumpPhase === "flight") ||
      (player2.isSlideJumping && player2.slideJumpPhase === "flight")) {
    return false;
  }

  // If either player is in recovery from a dash + charged attack, allow collision checks
  const isRecoveringFromDashAttack = (player) => {
    return (
      player.isRecovering &&
      player.recoveryStartTime &&
      simNowForPlayer(player) - player.recoveryStartTime < player.recoveryDuration
    );
  };

  if (
    isRecoveringFromDashAttack(player1) ||
    isRecoveringFromDashAttack(player2)
  ) {
    return true;
  }

  if (
    player1.isGrabbing ||
    player2.isGrabbing ||
    player1.isBeingGrabbed ||
    player2.isBeingGrabbed
  ) {
    return false;
  }

  if (
    player1.isDodging ||
    player2.isDodging ||
    player1.isThrowing ||
    player2.isThrowing ||
    player1.isBeingThrown ||
    player2.isBeingThrown
  ) {
    return false;
  }

  // Calculate hitbox sizes based on power-up multiplier
  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  // Calculate hitbox centers
  const player1Center = player1.x;
  const player2Center = player2.x;

  const player1HitboxBounds = {
    left: player1Center - player1Hitbox.left,
    right: player1Center + player1Hitbox.right,
    top: player1.y - player1Hitbox.left,
    bottom: player1.y + player1Hitbox.left,
  };

  const player2HitboxBounds = {
    left: player2Center - player2Hitbox.left,
    right: player2Center + player2Hitbox.right,
    top: player2.y - player2Hitbox.left,
    bottom: player2.y + player2Hitbox.left,
  };

  return (
    player1HitboxBounds.left < player2HitboxBounds.right &&
    player1HitboxBounds.right > player2HitboxBounds.left &&
    player1HitboxBounds.top < player2HitboxBounds.bottom &&
    player1HitboxBounds.bottom > player2HitboxBounds.top
  );
}

function adjustPlayerPositions(player1, player2, delta) {
  if (
    player1.isThrowing || player2.isThrowing ||
    player1.isBeingThrown || player2.isBeingThrown ||
    player1.isSidestepping || player2.isSidestepping ||
    (player1.isRopeJumping && player1.ropeJumpPhase === "active") ||
    (player2.isRopeJumping && player2.ropeJumpPhase === "active") ||
    (player1.isFlapping && player1.flapPhase === "flight") ||
    (player2.isFlapping && player2.flapPhase === "flight") ||
    // Same as flap: pushbox would shove the opponent outside slam reach mid-ring.
    (player1.isSlideJumping && player1.slideJumpPhase === "flight") ||
    (player2.isSlideJumping && player2.slideJumpPhase === "flight")
  ) {
    return;
  }

  // Charged attacks need to reach the opponent to connect — pushbox yields to hit detection.
  // Without this, the pushbox (148px) prevents the lunge from closing distance.
  //
  // IMPORTANT: this must cover the ENTIRE charged LUNGE, STARTUP included. The
  // forward lunge (index.js) runs during startup too, and because it sets x
  // directly (no movementVelocity), the pushbox would read neither player as
  // "moving toward" and split the overlap 0.5/0.5 — shoving the VICTIM toward the
  // edge every startup tick BEFORE the hit lands. That drift let a high-charge
  // lunge push the victim into the panic zone and cinematic-kill from range,
  // defeating the Phase 2 read-gate. Yielding through startup keeps the victim at
  // their true standing position until the strike connects (the anti-passthrough
  // clamp in index.js still stops the attacker ~30px short, so they never fully
  // overlap; the post-hit min-separation push handles spacing after the hit).
  //
  // Palm thrust is rooted (no lunge) but rides attackType "charged" — it must
  // NOT inherit this yield. Yielding at point-blank lets the arm bury into the
  // victim through startup; tip-range looks fine, pocket freezes look messy.
  const p1ChargedLunge =
    player1.isAttacking &&
    player1.attackType === "charged" &&
    !player1.isPalmThrust;
  const p2ChargedLunge =
    player2.isAttacking &&
    player2.attackType === "charged" &&
    !player2.isPalmThrust;
  if (p1ChargedLunge || p2ChargedLunge) {
    return;
  }

  // Grab system tweens (pull reversal, belly flop, etc.) control position directly.
  // The pushbox must yield so side-swap mechanics work correctly.
  // Note: isGrabSeparating is NOT included — the pushbox should snap players to minDistance
  // after a grab push ends, and the separation velocity handles the rest.
  if (
    player1.isGrabBreakSeparating || player2.isGrabBreakSeparating ||
    player1.isBeingPullReversaled || player2.isBeingPullReversaled ||
    player1.isGrabBellyFlopping || player2.isGrabBellyFlopping ||
    player1.isBeingGrabBellyFlopped || player2.isBeingGrabBellyFlopped ||
    player1.isGrabFrontalForceOut || player2.isGrabFrontalForceOut ||
    player1.isBeingGrabFrontalForceOut || player2.isBeingGrabFrontalForceOut
  ) {
    return;
  }

  const player1Hitbox = calculateEffectiveHitboxSize(player1);
  const player2Hitbox = calculateEffectiveHitboxSize(player2);

  const distanceBetweenCenters = Math.abs(player1.x - player2.x);
  const minDistance = player1Hitbox.left + player2Hitbox.right;

  if (distanceBetweenCenters >= minDistance) return;

  const overlap = minDistance - distanceBetweenCenters;
  const overlapBefore = overlap;

  const ropeJumpLanding = (player1.isRopeJumping && player1.ropeJumpPhase === "landing") ||
                          (player2.isRopeJumping && player2.ropeJumpPhase === "landing");
  const ropeJumper =
    player1.isRopeJumping && player1.ropeJumpPhase === "landing"
      ? player1
      : player2.isRopeJumping && player2.ropeJumpPhase === "landing"
        ? player2
        : null;

  // Phase A.3.1: separation direction from actual centers (intent only at
  // coincident centers). Rejects the old half-body jump-direction cross-up
  // that could move centers closer and grow overlap.
  let p1IsLeft;
  if (ropeJumper) {
    p1IsLeft = resolveLandingSeparationOrdering(player1, player2, ropeJumper)
      .p1IsLeft;
  } else {
    p1IsLeft = player1.x <= player2.x;
  }

  const p1Anchored = player1.isHit || player1.isRawParryStun || player1.isRawParrying;
  const p2Anchored = player2.isHit || player2.isRawParryStun || player2.isRawParrying;

  let p1Share, p2Share;

  if (p1Anchored && p2Anchored) {
    p1Share = 0.5;
    p2Share = 0.5;
  } else if (p1Anchored) {
    p1Share = 0;
    p2Share = 1;
  } else if (p2Anchored) {
    p1Share = 1;
    p2Share = 0;
  } else {
    const p1MovingToward = (p1IsLeft && player1.movementVelocity > 0) ||
                           (!p1IsLeft && player1.movementVelocity < 0);
    const p2MovingToward = (!p1IsLeft && player2.movementVelocity > 0) ||
                           (p1IsLeft && player2.movementVelocity < 0);

    if (p1MovingToward && !p2MovingToward) {
      p1Share = 1; p2Share = 0;
    } else if (p2MovingToward && !p1MovingToward) {
      p1Share = 0; p2Share = 1;
    } else {
      p1Share = 0.5; p2Share = 0.5;
    }
  }

  // Landing correction budget:
  // - Legacy / non-V2 landing: ≤18 px/tick slide (unchanged)
  // - V2 late-intrusion settle (A.3.1): authored multi-tick settle across
  //   recovery, still ≤18 px/tick, monotonic, finishes before release
  // - V2 clear-but-monitoring (A.3.2): currently clear skips work via the
  //   distance check above; new overlap reactivates settle ownership — never
  //   sticky-exempt collision for the rest of recovery
  let effectiveOverlap;
  const v2Landing =
    ropeJumper && ropeJumper.ropeJumpLandingPath === "v2";
  let v2SettleActive =
    v2Landing &&
    ropeJumper.ropeJumpSettleState === SETTLE_LANDING_SETTLE_ACTIVE;

  if (
    v2Landing &&
    !v2SettleActive &&
    isLandingRecoveryMonitoringState(ropeJumper.ropeJumpSettleState) &&
    overlap > LANDING_SETTLE_OVERLAP_EPS_PX
  ) {
    const settleOpponent = ropeJumper === player1 ? player2 : player1;
    reactivateLandingSettle(ropeJumper, settleOpponent);
    v2SettleActive =
      ropeJumper.ropeJumpSettleState === SETTLE_LANDING_SETTLE_ACTIVE;
    // Re-resolve ordering with the reactivated settle side lock.
    p1IsLeft = resolveLandingSeparationOrdering(
      player1,
      player2,
      ropeJumper
    ).p1IsLeft;
  }

  if (v2SettleActive) {
    effectiveOverlap = computeLandingSettleCorrectionPx(ropeJumper, overlap);
  } else if (ropeJumpLanding) {
    effectiveOverlap = Math.min(overlap, LANDING_SETTLE_MAX_PX_PER_TICK);
  } else {
    effectiveOverlap = overlap;
  }

  if (effectiveOverlap <= 0) {
    if (v2SettleActive) {
      updateLandingSettleCompletion(ropeJumper, overlap);
    }
    return;
  }

  if (p1IsLeft) {
    player1.x -= effectiveOverlap * p1Share;
    player2.x += effectiveOverlap * p2Share;
  } else {
    player1.x += effectiveOverlap * p1Share;
    player2.x -= effectiveOverlap * p2Share;
  }

  if (ropeJumpLanding && effectiveOverlap > 0 && ropeJumper) {
    ropeJumper.ropeJumpSafetyCorrectionPx =
      (ropeJumper.ropeJumpSafetyCorrectionPx || 0) + effectiveOverlap;
    ropeJumper.ropeJumpSafetyCorrectionTicks =
      (ropeJumper.ropeJumpSafetyCorrectionTicks || 0) + 1;
    if (v2SettleActive) {
      ropeJumper.ropeJumpSettleTicksDone =
        (ropeJumper.ropeJumpSettleTicksDone || 0) + 1;
      ropeJumper.ropeJumpSettleAccumulatedPx =
        (ropeJumper.ropeJumpSettleAccumulatedPx || 0) + effectiveOverlap;
    }
  }

  const leftBoundary = MAP_LEFT_BOUNDARY;
  const rightBoundary = MAP_RIGHT_BOUNDARY;

  // FORCE OUT cutscene parks fighters past the rope — don't yank them back
  // to MAP while pushbox un-overlaps them into idle spacing.
  const skipMapClamp =
    player1.isRingOutPushCutscene || player2.isRingOutPushCutscene;

  // Boundary enforcement with remainder transfer
  if (!skipMapClamp && !player1.isHit) {
    const clamped = Math.max(leftBoundary, Math.min(player1.x, rightBoundary));
    if (clamped !== player1.x) {
      const remainder = Math.abs(player1.x - clamped);
      player1.x = clamped;
      if (!player2.isHit) {
        player2.x += (p1IsLeft ? 1 : -1) * remainder;
      }
    }
  }
  if (!skipMapClamp && !player2.isHit) {
    const clamped = Math.max(leftBoundary, Math.min(player2.x, rightBoundary));
    if (clamped !== player2.x) {
      const remainder = Math.abs(player2.x - clamped);
      player2.x = clamped;
      if (!player1.isHit) {
        player1.x += (p1IsLeft ? -1 : 1) * remainder;
      }
    }
  }

  // Final safety clamp
  if (!skipMapClamp && !player1.isHit) {
    player1.x = Math.max(leftBoundary, Math.min(player1.x, rightBoundary));
  }
  if (!skipMapClamp && !player2.isHit) {
    player2.x = Math.max(leftBoundary, Math.min(player2.x, rightBoundary));
  }

  // Kill velocity for any non-anchored player moving toward the other
  if (!p1Anchored) {
    const isToward = (player1.x < player2.x && player1.movementVelocity > 0) ||
                     (player1.x > player2.x && player1.movementVelocity < 0);
    if (isToward) player1.movementVelocity = 0;
  }
  if (!p2Anchored) {
    const isToward = (player2.x < player1.x && player2.movementVelocity > 0) ||
                     (player2.x > player1.x && player2.movementVelocity < 0);
    if (isToward) player2.movementVelocity = 0;
  }

  // Phase A.3.1 invariants: overlap must not grow; settle completes when clear.
  if (ropeJumper) {
    const distAfter = Math.abs(player1.x - player2.x);
    const overlapAfter = Math.max(0, minDistance - distAfter);
    ropeJumper.ropeJumpCenterDistance = distAfter;
    ropeJumper.ropeJumpOverlap = overlapAfter;
    ropeJumper.ropeJumpSettleMaxOverlap = Math.max(
      ropeJumper.ropeJumpSettleMaxOverlap || 0,
      overlapBefore,
      overlapAfter
    );
    if (overlapAfter > overlapBefore + 1e-9) {
      ropeJumper.ropeJumpOverlapIncreased = true;
    }
    if (v2SettleActive) {
      updateLandingSettleCompletion(ropeJumper, overlapAfter);
    }
  }
}

// Add helper function to safely end charged attacks with recovery check
function safelyEndChargedAttack(player, rooms) {
  // === ENDLAG DURATION FOR CHARGED ATTACKS ===
  const CHARGED_ENDLAG_DURATION = 300; // Recovery after charged attack ends (matches ATTACK_ENDLAG_CHARGED_MS)

  const isPalm = !!player.isPalmThrust;
  // Set true only if we actually scheduled the palm's visual-hold recovery — the
  // isPalmThrust flag is kept alive across the hold so the client keeps rendering
  // the strike pose; otherwise it's cleared with the rest of the attack state.
  let palmHoldScheduled = false;

  // A charge overlapping an ending attack should never happen, but if it does
  // the old `if (!isChargingAttack)` guard skipped ALL cleanup and left the
  // player rooted in the charge shake with isAttacking still true forever.
  if (player.isChargingAttack) {
    clearChargeState(player, true);
  }

  // Only handle charged attacks, let slap attacks end normally
  if (player.attackType === "charged" && !player.chargedAttackHit) {
    // Find the current room and opponent to check if recovery is needed
    const currentRoom = rooms.find((room) =>
      room.players.some((p) => p.id === player.id)
    );

    if (currentRoom) {
      const opponent = currentRoom.players.find((p) => p.id !== player.id);

      // Set recovery for missed charged attacks - INCREASED duration for visual clarity
      if (opponent && !opponent.isHit) {
        player.isRecovering = true;
        player.recoveryStartTime = simNowForPlayer(player);
        if (isPalm) {
          // Palm thrust whiff: punishable recovery — strike pose the whole time.
          player.recoveryDuration = PALM_THRUST_HOLD_MS + PALM_THRUST_END_RECOVERY_MS;
          player.recoveryDirection = player.facing;
          player.movementVelocity = 0;
          player.knockbackVelocity = { x: 0, y: 0 };
          schedulePalmThrustVisualEnd(
            player,
            simNowForPlayer(player) + player.recoveryDuration
          );
          palmHoldScheduled = true;
        } else {
          // Whiff: grounded recover + slide forward (no flip / no Y lift).
          player.recoveryDuration = 400; // Was 250ms - now longer for clearer punishment
          player.recoveryDirection = player.facing;
          player.movementVelocity = player.facing * -3;
          player.knockbackVelocity = { x: 0, y: 0 };
        }
      }
    }
  }

  // Clear attack states (for both charged and slap attacks)
  // Save whether the attack connected before clearing the flag
  const attackConnected = player.chargedAttackHit;

  // Palm thrust on-hit: active window just ended — strike pose through recovery.
  if (isPalm && attackConnected) {
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.attackStartTime = 0;
    player.attackEndTime = 0;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;
    player.chargedAttackHit = false;
    player.chargedActiveEndTime = 0;
    player.currentAction = null;
    player.actionLockUntil = 0;
    player.isRecovering = true;
    player.recoveryStartTime = simNowForPlayer(player);
    player.recoveryDuration = PALM_THRUST_HIT_RECOVERY_MS;
    player.recoveryDirection = player.facing;
    player.movementVelocity = 0;
    player.knockbackVelocity = { x: 0, y: 0 };
    schedulePalmThrustVisualEnd(
      player,
      player.recoveryStartTime + PALM_THRUST_HIT_RECOVERY_MS
    );
    palmHoldScheduled = true;
  } else if (!isPalm && attackConnected) {
    // Connected charged hits end in processHit (recovering + plant). This is
    // a safety cleanup if attackEndTime still fires with the hit flag set.
    player.isAttacking = false;
    player.isSlapAttack = false;
    player.isPalmThrust = false;
    player.attackStartTime = 0;
    player.attackEndTime = 0;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;
    player.chargedAttackHit = false;
    player.chargedActiveEndTime = 0;
    player.currentAction = null;
    player.actionLockUntil = 0;
    player.movementVelocity = 0;
    player.knockbackVelocity = { x: 0, y: 0 };
    player.isChargedHitRecoil = false;
  } else {
    player.isAttacking = false;
    player.isSlapAttack = false;
    // Keep isPalmThrust alive through the visual hold; otherwise clear it.
    if (!palmHoldScheduled) player.isPalmThrust = false;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.chargeAttackPower = 0;
    player.chargedAttackHit = false;
    player.chargedActiveEndTime = 0;
    if (palmHoldScheduled || player.isRecovering) {
      player.currentAction = null;
      player.actionLockUntil = 0;
    }

    // Only apply endlag for attacks that DIDN'T connect (whiffed attacks)
    // Connected attacks are already handled by processHit's recovery state
    if (!attackConnected && !player.isRecovering) {
      // === ENDLAG - Visual recovery period ===
      // endlag/cooldown deadlines: sim clock. actionLockUntil: wall (Phase 2b family).
      player.isInEndlag = true;
      player.endlagEndTime = simNowForPlayer(player) + CHARGED_ENDLAG_DURATION;
      player.currentAction = "endlag";
      player.actionLockUntil = simNowForPlayer(player) + CHARGED_ENDLAG_DURATION;

      // Set attack cooldown to prevent immediate spam
      player.attackCooldownUntil = simNowForPlayer(player) + CHARGED_ENDLAG_DURATION + 150;

      // Clear endlag after duration via timeout
      setPlayerTimeout(
        player.id,
        () => {
          player.isInEndlag = false;
          player.endlagEndTime = 0;
          if (player.currentAction === "endlag" || player.currentAction === "charged") {
            player.actionLockUntil = 0;
            player.currentAction = null;
          }

          // Check for buffered actions after endlag ends
          if (player.bufferedAction && simNowForPlayer(player) < player.bufferExpiryTime) {
            const action = player.bufferedAction;
            player.bufferedAction = null;
            player.bufferExpiryTime = 0;

            // Execute the buffered action
            // CRITICAL: Block buffered dash if player is being grabbed
            // Gassed: dodge locked (same as sidestep) — surface OUT OF STAMINA.
            if (action.type === "dash" && !player.isBeingGrabbed && canPlayerDash(player)) {
              if (player.isGassed) {
                emitStaminaBlocked(player, "dodge");
              } else {
                beginPlayerDodge(player, {
                  direction: action.direction,
                  nowSim: simNowForPlayer(player),
                  skipStartup: true, // legacy endlag buffer path had no startup
                });
              }
            }
          }
        },
        CHARGED_ENDLAG_DURATION,
        "chargedEndlagReset"
      );
    }
  }
}

// Enables frame-1 reversals: if a player holds an input during an unactionable grab/throw state,
// that input activates on the first possible frame (like invincible reversals in fighting games).
function activateBufferedInputAfterGrab(player, rooms) {
  // Round is over (e.g. a clinch kill pull/throw just resolved) — no buffered
  // action should fire. Without this, a held mouse1 triggers a buffered slap on
  // the thrower the instant the kill resolves (stray slap-hands during the finish).
  const ownerRoom = rooms && rooms.find((r) => r.players.some((p) => p.id === player.id));
  if (ownerRoom && ownerRoom.gameOver) return;

  if (player.isAtTheRopes || player.isRopeJumping || player.isThrowLanded || player.isHit ||
      player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating ||
      player.isGrabSeparating) return;

  player.inputBuffer = null;

  // Priority 0a: Buffered sidestep (S + SHIFT while grabbed/thrown)
  if (
    player.bufferedAction &&
    player.bufferedAction.type === "sidestep" &&
    player.bufferExpiryTime &&
    simNowForPlayer(player) < player.bufferExpiryTime
  ) {
    player.bufferedAction = null;
    player.bufferExpiryTime = 0;
    if (player.isGassed) {
      emitStaminaBlocked(player, "sidestep");
      return;
    }
    const currentRoom = rooms.find(r => r.players.some(p => p.id === player.id));
    const sOpp = currentRoom && currentRoom.players.find(p => p.id !== player.id && !p.isDead);
    if (sOpp && canPlayerSidestep(player)) {
      const initData = getSidestepInitData(player.x, sOpp.x);
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      clearChargeState(player, true);
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
      player.isSidestepping = true;
      player.isSidestepStartup = true;
      player.isSidestepRecovery = false;
      player.sidestepStartTime = simNowForPlayer(player);
      player.sidestepStartupEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS;
      player.sidestepActiveEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS;
      player.sidestepEndTime = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
      player.sidestepStartX = player.x;
      player.sidestepDirection = initData.direction;
      player.currentAction = "sidestep";
      player.actionLockUntil = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
      player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
      return;
    }
  }

  // Priority 0b: Buffered dash (spammed shift while grabbed/thrown)
  // Gassed: dodge locked (same as sidestep) — surface OUT OF STAMINA.
  if (
    player.bufferedAction &&
    player.bufferedAction.type === "dash" &&
    player.bufferExpiryTime &&
    simNowForPlayer(player) < player.bufferExpiryTime &&
    canPlayerDash(player)
  ) {
    const direction = player.bufferedAction.direction;
    player.bufferedAction = null;
    player.bufferExpiryTime = 0;
    if (player.isGassed) {
      emitStaminaBlocked(player, "dodge");
      return;
    }
    beginPlayerDodge(player, {
      direction,
      nowSim: simNowForPlayer(player),
    });
    return;
  }

  // Priority 1: Attack Parry (spacebar) - tap deflect. canArmAttackParry gates on
  // apSpaceConsumed so a held key only fires ONE parry (tap-per-attack).
  if (player.keys[" "] && !player.grabBreakSpaceConsumed &&
      canArmAttackParry(player, simNowForPlayer(player))) {
    armAttackParry(player, simNowForPlayer(player));
    clearChargeState(player, true);
    return;
  }

  // Priority 2a: Sidestep (S + SHIFT) - lateral evasion
  if (player.keys.shift && player.keys.s && !player.keys.mouse2) {
    if (player.isGassed) {
      emitStaminaBlocked(player, "sidestep");
      return;
    }
    const currentRoom = rooms.find(r => r.players.some(p => p.id === player.id));
    const sOpp = currentRoom && currentRoom.players.find(p => p.id !== player.id && !p.isDead);
    if (sOpp && canPlayerSidestep(player)) {
      const initData = getSidestepInitData(player.x, sOpp.x);
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      clearChargeState(player, true);
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
      player.isSidestepping = true;
      player.isSidestepStartup = true;
      player.isSidestepRecovery = false;
      player.sidestepStartTime = simNowForPlayer(player);
      player.sidestepStartupEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS;
      player.sidestepActiveEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS;
      player.sidestepEndTime = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
      player.sidestepStartX = player.x;
      player.sidestepDirection = initData.direction;
      player.currentAction = "sidestep";
      player.actionLockUntil = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
      player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
      return;
    }
  }

  // Priority 2b: Dodge (shift) — locked while gassed (same as sidestep)
  if (player.keys.shift && !player.keys.mouse2 && canPlayerDash(player)) {
    if (player.isGassed) {
      emitStaminaBlocked(player, "dodge");
      return;
    }
    beginPlayerDodge(player, { nowSim: simNowForPlayer(player) });
    return;
  }

  // Priority 3: Mouse1 held — S+forward = charged, S = low kick, back = palm, else slap
  if (player.keys.mouse1) {
    player.mouse1PressTime = simNowForPlayer(player);
    const fwdKey = player.facing === -1 ? 'd' : 'a';
    const backKey = player.facing === -1 ? 'a' : 'd';
    if (player.keys.s && player.keys[fwdKey] && canPlayerSlap(player, { ignoreCooldown: true })) {
      player.chargeAttackPower = 0;
      player.chargeStartTime = 0;
      startCharging(player);
      player.chargingFacingDirection = player.facing;
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;
      player.isCrouchStance = false;
      player.isCrouchStrafing = false;
    } else if (
      LOW_KICK_ENABLED &&
      player.keys.s &&
      !player.keys[fwdKey] &&
      canPlayerSlap(player)
    ) {
      executeLowKick(player, rooms);
    } else if (player.keys[backKey] && !player.keys[fwdKey] && canPlayerSlap(player)) {
      executePalmThrust(player, rooms);
    } else if (canPlayerSlap(player)) {
      executeSlapAttack(player, rooms);
    }
    return;
  }

  // Priority 4: Grab (mouse2)
  if (player.keys.mouse2 && !player.grabCooldown) {
    player.postGrabInputBuffer = true;
    return;
  }
}

function executeInputBuffer(player, rooms) {
  if (!player.inputBuffer) return false;

  const age = simNowForPlayer(player) - player.inputBuffer.timestamp;
  if (age >= INPUT_BUFFER_WINDOW_MS) {
    player.inputBuffer = null;
    return false;
  }

  if (player.inputLockUntil && simNowForPlayer(player) < player.inputLockUntil) return false;
  if (player.actionLockUntil && simNowForPlayer(player) < player.actionLockUntil) return false;
  if (player.isGrabSeparating || player.isGrabBreakSeparating) return false;
  if (player.isBeingPullReversaled) return false;
  if (player.isGrabBreaking || player.isGrabBreakCountered) return false;
  if (player.isGrabBellyFlopping || player.isBeingGrabBellyFlopped) return false;
  if (player.isGrabFrontalForceOut || player.isBeingGrabFrontalForceOut) return false;
  if (player.isHit || player.isBeingThrown || player.isBeingGrabbed) return false;
  if (player.isAtTheRopes || player.isRopeJumping || player.isGrabClashing) return false;
  if (player.canMoveToReady) return false;
  // While airborne on slide-jump (or legacy flap), no other buffered action.
  if (player.isFlapping || player.isSlideJumping) return false;

  const buffer = player.inputBuffer;

  switch (buffer.type) {
    case "matador": {
      const nowSim = simNowForPlayer(player);
      if (!player.isRawParryStun &&
          !player.isAttacking && !player.isDodging &&
          !player.isRecovering && !player.isGrabbing &&
          !player.isGrabStartup &&
          !player.isGrabbingMovement && !player.isWhiffingGrab &&
          !player.isThrowing && !player.grabBreakSpaceConsumed &&
          canArmMatador(player, nowSim)) {
        armMatador(player, nowSim, lagCompensatedParryStart(player, nowSim));
        clearChargeState(player, true);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "rawParry": {
      const nowSim = simNowForPlayer(player);
      if (!player.isRawParryStun &&
          !player.isAttacking && !player.isDodging &&
          !player.isRecovering && !player.isGrabbing &&
          !player.isGrabStartup && // Block buffered AP during grab startup — no parry/grab coexistence
          !player.isGrabbingMovement && !player.isWhiffingGrab &&
          !player.isThrowing && !player.grabBreakSpaceConsumed &&
          canArmAttackParry(player, nowSim)) {
        // Buffered ATTACK PARRY: arm the tap deflect window, lag-compensated to
        // the true press moment (consistent with the primary socket path).
        armAttackParry(player, nowSim, lagCompensatedParryStart(player, nowSim));
        clearChargeState(player, true);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "dodge": {
      if (canPlayerDash(player)) {
        if (player.isGassed) {
          emitStaminaBlocked(player, "dodge");
          player.inputBuffer = null;
          return true;
        }
        beginPlayerDodge(player, { nowSim: simNowForPlayer(player) });
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "slap": {
      if (canPlayerSlap(player)) {
        executeSlapAttack(player, rooms);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "palmThrust": {
      // Back + mouse1 buffered during a lock/recovery — fire the thrust the
      // instant the player can act again (same gate as slap).
      if (canPlayerSlap(player)) {
        executePalmThrust(player, rooms);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "lowKick": {
      if (LOW_KICK_ENABLED && canPlayerSlap(player)) {
        executeLowKick(player, rooms);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "sidestep": {
      if (canPlayerSidestep(player)) {
        if (player.isGassed) {
          emitStaminaBlocked(player, "sidestep");
          player.inputBuffer = null;
          return true;
        }
        const room = rooms.find(r => r.players.some(p => p.id === player.id));
        const sidestepOpponent = room && room.players.find(p => p.id !== player.id && !p.isDead);
        if (sidestepOpponent) {
          const initData = getSidestepInitData(player.x, sidestepOpponent.x);
          player.isRawParrySuccess = false;
          player.isPerfectRawParrySuccess = false;
          clearChargeState(player, true);
          player.movementVelocity = 0;
          player.isStrafing = false;
          player.isPowerSliding = false;
          player.isBraking = false;
          player.isCrouchStance = false;
          player.isCrouchStrafing = false;

          player.isSidestepping = true;
          player.isSidestepStartup = true;
          player.isSidestepRecovery = false;
          player.sidestepStartTime = simNowForPlayer(player);
          player.sidestepStartupEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS;
          player.sidestepActiveEndTime = simNowForPlayer(player) + SIDESTEP_STARTUP_MS + SIDESTEP_ACTIVE_MS;
          player.sidestepEndTime = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
          player.sidestepStartX = player.x;
          player.sidestepDirection = initData.direction;

          player.currentAction = "sidestep";
          player.actionLockUntil = simNowForPlayer(player) + SIDESTEP_TOTAL_MS;
          player.stamina = Math.max(0, player.stamina - SIDESTEP_STAMINA_COST);
          player.inputBuffer = null;
          return true;
        }
      }
      break;
    }
    case "chargedAttack": {
      if (canPlayerSlap(player, { ignoreCooldown: true })) {
        player.chargeAttackPower = 0;
        player.chargeStartTime = 0;
        startCharging(player);
        player.chargingFacingDirection = player.facing;
        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isPowerSliding = false;
        player.isBraking = false;
        player.isRawParrySuccess = false;
        player.isPerfectRawParrySuccess = false;
        player.isCrouchStance = false;
        player.isCrouchStrafing = false;

        // TAP CASE: mouse1 was pressed AND released while this buffer was
        // waiting (e.g. a quick S+forward+M1 tap during a slap). The release
        // handler already ran — it saw isChargingAttack false and did nothing —
        // so no release edge remains to ever execute or end this charge.
        // Without this, the player stands stranded in the charging stance,
        // rooted in place, until some unrelated input packet clears it.
        // Resolve it the way the release handler would have: fire the charged
        // attack immediately at tap (minimum) power.
        if (!player.keys.mouse1) {
          const tapCharge = player.chargeAttackPower || 1;
          player.isChargingAttack = false;
          player.chargeStartTime = 0;
          player.chargingFacingDirection = null;
          executeChargedAttack(player, tapCharge, rooms);
        }

        player.inputBuffer = null;
        return true;
      }
      break;
    }
    case "grab": {
      if (canPlayerUseAction(player) && !player.grabCooldown &&
          !player.isRawParrying && !player.isGrabbingMovement &&
          !player.isWhiffingGrab && !player.isGrabWhiffRecovery &&
          !player.isGrabTeching && !player.isGrabStartup) {
        const grabRoom = rooms.find((r) => r.players.some((p) => p.id === player.id));
        beginGrabStartup(player, grabRoom);
        player.inputBuffer = null;
        return true;
      }
      break;
    }
  }

  return false;
}

/**
 * MATADOR success — grab would have connected on a live matador window.
 * Instant pull (no clinch): yank the grabber through the matador to the far
 * side. Land threshold bypassed; kill if grabber balance < CLINCH_THROW_KILL_THRESHOLD.
 *
 * @param {object} matador - defender who armed BACK+SPACE
 * @param {object} grabber - attacker whose grab connected into the matador
 */
function resolveMatadorPull(matador, grabber, room, io) {
  if (!matador || !grabber || !room) return;

  const nowSim = simNow(room);
  const grabberFacingBeforeKill = grabber.facing;
  const pullDirection = grabber.x < matador.x ? 1 : -1;
  const isKill =
    grabber.balance < CLINCH_THROW_KILL_THRESHOLD && !room.gameOver;
  const pullDist = isKill ? CLINCH_KILL_PULL_DISTANCE : MATADOR_PULL_DISTANCE;
  const pullTweenDur = isKill
    ? CLINCH_KILL_PULL_TWEEN_DURATION
    : CLINCH_PULL_TWEEN_DURATION;
  const pullLockMs = isKill
    ? CLINCH_KILL_PULL_INPUT_LOCK_MS
    : CLINCH_PULL_INPUT_LOCK_MS;

  let targetX = matador.x + pullDirection * pullDist;

  // Same boundary-swap safety as clinch pull (non-kill only).
  const leftBound = MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN;
  const rightBound = MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN;
  const clampedTargetX = Math.max(leftBound, Math.min(targetX, rightBound));
  const distPastActor =
    pullDirection === -1
      ? matador.x - clampedTargetX
      : clampedTargetX - matador.x;
  const isBoundaryPull = !isKill && distPastActor < CLINCH_THROW_MIN_SEPARATION;

  let actorTweenTargetX = null;
  let effectiveTweenDur = pullTweenDur;
  let effectiveLockMs = pullLockMs;

  if (isBoundaryPull) {
    const actorOriginalX = matador.x;
    const targetOriginalX = grabber.x;
    targetX = Math.max(leftBound, Math.min(actorOriginalX, rightBound));
    actorTweenTargetX = targetOriginalX;
    effectiveTweenDur = CLINCH_PULL_SWAP_TWEEN_DURATION;
    effectiveLockMs = CLINCH_PULL_SWAP_TWEEN_DURATION;
  }

  // Tear down grab attempt / any stray clinch without entering Phase A.
  grabber.isGrabStartup = false;
  grabber.isGrabbingMovement = false;
  grabber.isWhiffingGrab = false;
  grabber.isGrabWhiffRecovery = false;
  grabber.grabMovementVelocity = 0;
  clearAllActionStates(grabber);
  clearAllActionStates(matador);
  clearMatadorWindow(matador);

  grabber.y = GROUND_LEVEL;
  matador.y = GROUND_LEVEL;

  grabber.isBeingPullReversaled = true;
  grabber.pullReversalPullerId = matador.id;
  grabber.isGrabBreakSeparating = true;
  grabber.grabBreakSepStartTime = nowSim;
  grabber.grabBreakSepDuration = effectiveTweenDur;
  grabber.grabBreakStartX = grabber.x;
  grabber.grabBreakTargetX = targetX;

  if (isBoundaryPull) {
    grabber.isBoundaryPullSwap = true;
    matador.isBoundaryPullSwap = true;
    matador.isGrabBreakSeparating = true;
    matador.grabBreakSepStartTime = nowSim;
    matador.grabBreakSepDuration = effectiveTweenDur;
    matador.grabBreakStartX = matador.x;
    matador.grabBreakTargetX = actorTweenTargetX;
  }

  grabber.movementVelocity = 0;
  matador.movementVelocity = 0;
  grabber.isStrafing = false;
  matador.isStrafing = false;
  grabber.knockbackVelocity = { x: 0, y: 0 };

  const lockUntil = nowSim + effectiveLockMs;
  grabber.inputLockUntil = Math.max(grabber.inputLockUntil || 0, lockUntil);
  matador.inputLockUntil = Math.max(matador.inputLockUntil || 0, lockUntil);

  // Matador success: pull pose for the yank (not AP success frames).
  // Hold through the pull tween so the sidestep/yank reads as a pull.
  matador.isMatadorSuccess = true;
  matador.isAttemptingPull = true;
  matador.matadorSuccessUntil = nowSim + effectiveTweenDur;
  matador.isMatadorParrying = false;

  // Destination facing for the yank (same as clinch pull). pullFacingDirection
  // locks it until tween settle; then correctFacingAfterGrabOrThrow re-corrects.
  const matadorPullAnchorX = isBoundaryPull ? actorTweenTargetX : matador.x;
  if (!isKill) {
    if (!matador.atTheRopesFacingDirection) {
      matador.facing = matadorPullAnchorX < targetX ? -1 : 1;
      matador.pullFacingDirection = matador.facing;
    }
    if (!grabber.atTheRopesFacingDirection) {
      grabber.facing = targetX < matadorPullAnchorX ? -1 : 1;
      grabber.pullFacingDirection = grabber.facing;
    }
  } else {
    grabber.facing = grabberFacingBeforeKill;
  }

  const matadorPlayerNumber = room.players.indexOf(matador) === 0 ? 1 : 2;
  const centerX = (matador.x + grabber.x) / 2;
  const centerY = (matador.y + grabber.y) / 2;

  triggerHitstopAndEmit(io, room, MATADOR_HITSTOP_MS, "matador");
  io.in(room.id).emit("matador_success", {
    type: "matador_success",
    matadorId: matador.id,
    grabberId: grabber.id,
    matadorX: matador.x,
    grabberX: grabber.x,
    x: centerX,
    y: centerY,
    matadorPlayerNumber,
    isKill,
    hitstopMs: MATADOR_HITSTOP_MS,
    matadorId_token: `matador-${nowSim}-${matador.id}`,
  });

  if (isKill) {
    grabber.isClinchKillPullVictim = true;
    handleWinCondition(room, grabber, matador, io, "clinchKillPull");
    grabber.isClinchKillPullVictim = true;
    grabber.isBeingPullReversaled = true;
    grabber.pullReversalPullerId = matador.id;
    grabber.isGrabBreakSeparating = true;
    grabber.grabBreakSepStartTime = nowSim;
    grabber.grabBreakSepDuration = effectiveTweenDur;
    grabber.grabBreakStartX = grabber.x;
    grabber.grabBreakTargetX = targetX;
    // Kill victim keeps pre-kill facing (belly-slide), already stamped above.

    io.in(room.id).emit("cinematic_kill", {
      attackerId: matador.id,
      victimId: grabber.id,
      victimX: grabber.x,
      victimY: grabber.y,
      attackerX: matador.x,
      attackerY: matador.y,
      knockbackDirection: pullDirection,
      hitstopMs: 0,
      impactX: centerX,
      impactY: grabber.y,
      matadorKill: true,
      noPan: true,
    });
  }

  matador.grabCooldown = true;
  setPlayerTimeout(
    matador.id,
    () => {
      matador.grabCooldown = false;
    },
    300,
    "matadorPullCooldown"
  );
}

module.exports = {
  cleanupGrabStates,
  handleWinCondition,
  executeSlapAttack,
  executePalmThrust,
  executeLowKick,
  cleanupRoom,
  executeChargedAttack,
  calculateEffectiveHitboxSize,
  handleReadyPositions,
  arePlayersColliding,
  adjustPlayerPositions,
  safelyEndChargedAttack,
  activateBufferedInputAfterGrab,
  executeInputBuffer,
  resolveMatadorPull,
};

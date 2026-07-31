const { GRAB_STATES } = require("./constants");
const { createInitialKeys } = require("./playerFactory");

function cleanupPlayerStates(player) {
  // Clean up all player references
  player.grabbedOpponent = null;
  player.throwOpponent = null;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;
  player.grabAttemptStartTime = null;
  player.isGrabStartup = false;
  player.grabStartupArmorUsed = false;
  player.isGrabbing = false;
  player.isGrabbingMovement = false;
  player.isWhiffingGrab = false;
  player.grabMovementStartTime = 0;
  player.grabMovementDirection = 0;
  player.grabMovementVelocity = 0;
  player.isBeingGrabbed = false;
  player.isCounterGrabbed = false;
  player.isArmClamped = false;
  player.clinchThrowFailStagger = false;
  player.isClinchOpen = false;
  player.clinchOpenHideStars = false;
  player.clinchOpenUntil = 0;
  player.hasDeepGrip = false;
  player.clinchShoveLead = null;
  player.deepGripPushStart = 0;
  player.clinchPushRampStart = 0;
  player.isThrowing = false;
  player.isBeingThrown = false;
  player.isAttacking = false;
  player.isHit = false;
  player.lastHitType = null;
  player.isAlreadyHit = false;
  player.isSlapKnockback = false;
  player.slapKnockbackCanRingOut = false;
  player.isParryKnockback = false;
  player.isDodging = false;
  player.isDodgeStartup = false;
  player.isDodgeRecovery = false;
  player.dodgeCooldownUntil = 0;
  player.dodgeStartupEndTime = 0;
  player.dodgeRecoveryEndTime = 0;
  player.isSidestepping = false;
  player.isSidestepStartup = false;
  player.isSidestepRecovery = false;
  player.sidestepStartTime = 0;
  player.sidestepStartupEndTime = 0;
  player.sidestepActiveEndTime = 0;
  player.sidestepEndTime = 0;
  player.sidestepStartX = 0;
  player.sidestepDirection = 0;
  player.sidestepTargetX = 0;
  player.sidestepRecoveryStartX = 0;
  player.sidestepRecoveryTargetX = 0;
  player.slapActiveEndTime = 0;
  player.chargedActiveEndTime = 0;
  player.isRawParrying = false;
  player.isGuarding = false;
  player.apActiveUntil = 0;
  player.apChainCount = 0;
  player.apFlurryUntil = 0;
  player.isApWhiffRecovering = false;
  player.apGuardNeedsRelease = false;
  player.apSpaceConsumed = false;
  player.isApPostParryLocked = false;
  player.apPostParryLockUntil = 0;
  player.isMatadorParrying = false;
  player.isMatadorSuccess = false;
  player.matadorStartTime = 0;
  player.matadorActiveUntil = 0;
  player.matadorSuccessUntil = 0;
  player.isMatadorWhiffRecovering = false;
  player.matadorRecoveryUntil = 0;
  player.isRawParryStun = false;
  player.isRawParrySuccess = false;
  player.isPerfectRawParrySuccess = false;
  player.postGrabInputBuffer = false;
  player.isStrafing = false;
  player.isJumping = false;
  player.isRopeJumping = false;
  player.ropeJumpPhase = null;
  player.ropeJumpStartTime = 0;
  player.ropeJumpStartX = 0;
  player.ropeJumpTargetX = 0;
  player.ropeJumpDirection = 0;
  player.ropeJumpActiveStartTime = 0;
  player.ropeJumpLandingTime = 0;
  player.ropeJumpBufferedAttackRelease = 0;
  player.ropeJumpRawTargetX = 0;
  player.ropeJumpResolvedTargetX = 0;
  player.ropeJumpLandingCommitted = false;
  player.ropeJumpLandingCommitX = 0;
  player.ropeJumpLandingCommitT = 0;
  player.ropeJumpLandingCommitVel = 0;
  player.ropeJumpLandingDecision = null;
  player.ropeJumpLandingPath = null;
  player.ropeJumpPreferredSide = 0;
  player.ropeJumpResolvedSide = 0;
  player.ropeJumpMinDistance = 0;
  player.ropeJumpCenterDistance = 0;
  player.ropeJumpOverlap = 0;
  player.ropeJumpSafetyCorrectionPx = 0;
  player.ropeJumpPreTouchdownX = 0;
  player.ropeJumpTouchdownX = 0;
  player.ropeJumpUsedFallback = false;
  player.ropeJumpTrajectoryType = null;
  player.ropeJumpDecisionClass = null;
  player.ropeJumpFallbackReason = null;
  player.ropeJumpHorizVel = 0;
  player.ropeJumpRawExpectedVel = 0;
  player.ropeJumpPeakVel = 0;
  player.ropeJumpPeakAccel = 0;
  player.ropeJumpReversalDetected = false;
  player.ropeJumpSideIntentLocked = false;
  player.ropeJumpSideIntent = 0;
  player.ropeJumpIntentClass = null;
  player.ropeJumpIntentReason = null;
  player.ropeJumpRecommendedCommitT = 0;
  player.ropeJumpSideIntentOpponentX = 0;
  player._landingTrace = null;
  player.isFlapping = false;
  player.flapPhase = null;
  player.flapCharges = 0;
  player.slideJumpHasFlap = false;
  player.slideJumpFlapFlightActive = false;
  player.flapVelocityY = 0;
  player.flapVelocityX = 0;
  player.flapStartTime = 0;
  player.flapLandingTime = 0;
  player.flapWingBeatTime = 0;
  player.flapFastFalling = false;
  player.flapDiveCommitted = false;
  player.flapDiveLockX = 0;
  player.flapBeatHDir = 0;
  player.flapHitLanded = false;
  player.flapHitLandStartY = 0;
  player.flapHitLandStartX = 0;
  player.flapHitLandTargetX = 0;
  player.flapHitRecoverDuration = 0;
  player.lastFlapChargeTime = 0;
  player.isReady = false;
  player.isBowing = false;
  player.knockbackVelocity = { x: 0, y: 0 };

  // Clean up clinch jolt states
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

  // Clean up power-up related states
  player.activePowerUp = null;
  player.powerUpMultiplier = 1;
  player.selectedPowerUp = null;
  player.isThrowingSalt = false;
  player.saltCooldown = false;
  player.snowballCooldown = false;
  player.pumoArmyCooldown = false;
  player.snowballThrowsRemaining = null;
  player.pumoArmySpawnsRemaining = null;
  player.isThrowingSnowball = false;
  player.isSpawningPumoArmy = false;
  player.hitAbsorptionUsed = false;
  player.snowballs = [];
  player.pumoArmy = [];
  // Don't set canMoveToReady here - it should only be set during actual salt throwing phase

  player.keys = createInitialKeys();
}

function cleanupOpponentStates(opponent) {
  if (opponent) {
    opponent.isBeingGrabbed = false;
    opponent.isCounterGrabbed = false;
    opponent.isArmClamped = false;
    opponent.clinchThrowFailStagger = false;
    opponent.hasDeepGrip = false;
    opponent.deepGripPushStart = 0;
    opponent.clinchPushRampStart = 0;
    opponent.isBeingPushed = false;
    opponent.isBeingPulled = false;
    opponent.isBeingThrown = false;
    opponent.grabbedOpponent = null;
    opponent.throwOpponent = null;
  }
}

function cleanupRoomState(room) {
  room.rematchCount = 0;
  room.matchOver = false;
  room.gameStart = false;
  room.gameOver = false;
  room.readyCount = 0;
  room.readyStartTime = null;
  room.roundStartTimer = null;
  room.gameOverTime = null;
  room.winnerId = null;
  room.loserId = null;

  // Clean up power-up selection state
  room.powerUpSelectionPhase = false;
  room.playersSelectedPowerUps = {};
  room.playerAvailablePowerUps = {};

  // Clean up grab clash data
  delete room.grabClashData;

  // Don't automatically reset disconnection state here - let the handlers manage it
  // room.opponentDisconnected and room.disconnectedDuringGame should be managed explicitly

  // Clear any existing round start timer to prevent interference
  if (room.roundStartTimer) {
    clearTimeout(room.roundStartTimer);
    room.roundStartTimer = null;
  }
}

function getCleanedRoomData(room) {
  return {
    ...room,
    // Clean up room power-up selection state
    powerUpSelectionPhase: false,
    playersSelectedPowerUps: {},
    playerAvailablePowerUps: {},
    roundStartTimer: null,
    // Preserve disconnection state for client room availability checks
    opponentDisconnected: room.opponentDisconnected || false,
    disconnectedDuringGame: room.disconnectedDuringGame || false,
    players: room.players.map((p) => ({
      ...p,
      grabbedOpponent: null,
      throwOpponent: null,
      grabState: GRAB_STATES.INITIAL,
      grabAttemptType: null,
      grabAttemptStartTime: null,
      isGrabbing: false,
      isGrabbingMovement: false,
      isWhiffingGrab: false,
      grabMovementStartTime: 0,
      grabMovementDirection: 0,
      grabMovementVelocity: 0,
      isBeingGrabbed: false,
      isCounterGrabbed: false,
      isArmClamped: false,
      clinchThrowFailStagger: false,
      isThrowing: false,
      isBeingThrown: false,
      isAttacking: false,
      isHit: false,
      isAlreadyHit: false,
      isParryKnockback: false,
      isDodging: false,
      isRawParrying: false,
      isGuarding: false,
      apChainCount: 0,
      isRawParryStun: false,
      isRawParrySuccess: false,
      isPerfectRawParrySuccess: false,
      isSidestepping: false,
      isSidestepStartup: false,
      isSidestepRecovery: false,
      isStrafing: false,
      isJumping: false,
      isReady: false,
      isBowing: false,
      knockbackVelocity: { x: 0, y: 0 },
      // Clean up power-up related states
      activePowerUp: null,
      powerUpMultiplier: 1,
      selectedPowerUp: null,
      isThrowingSalt: false,
      saltCooldown: false,
      snowballCooldown: false,
      pumoArmyCooldown: false,
      snowballThrowsRemaining: null,
      pumoArmySpawnsRemaining: null,
      isThrowingSnowball: false,
      isSpawningPumoArmy: false,
      hitAbsorptionUsed: false,
      snowballs: [],
      pumoArmy: [],
      // Don't set canMoveToReady here - it should only be set during actual salt throwing phase
      keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        " ": false,
        shift: false,
        e: false,
        f: false,
      },
    })),
  };
}

function getCleanedRoomsData(rooms) {
  // Note: CPU rooms are included but marked with isCPURoom flag
  // The client should filter them out when displaying the room browser
  const cleanedRooms = rooms.map((r) => ({
    isCPURoom: r.isCPURoom || false, // Pass this flag so client can filter
    id: r.id,
    readyCount: r.readyCount || 0,
    rematchCount: r.rematchCount || 0,
    gameStart: r.gameStart || false,
    gameOver: r.gameOver || false,
    matchOver: r.matchOver || false,
    hakkiyoiCount: r.hakkiyoiCount || 0,
    winnerId: r.winnerId,
    loserId: r.loserId,
    gameOverTime: r.gameOverTime,
    // Preserve disconnection state for client room availability checks
    opponentDisconnected: r.opponentDisconnected || false,
    disconnectedDuringGame: r.disconnectedDuringGame || false,
    // Clean up room power-up selection state
    powerUpSelectionPhase: false,
    playersSelectedPowerUps: {},
    playerAvailablePowerUps: {},
    readyStartTime: null,
    roundStartTimer: null,
    players: (() => {
      // If room is in disconnected state, make it appear full to prevent join attempts
      if (r.opponentDisconnected || r.disconnectedDuringGame) {
        return [
          // Keep the actual remaining player
          ...r.players.map((p) => ({
            id: p.id,
            fighter: p.fighter,
            color: p.color,
            mawashiColor: p.mawashiColor,
            bodyColor: p.bodyColor ?? null,
            gearIds: Array.isArray(p.gearIds) ? p.gearIds : [],
            facing: p.facing || 1,
            x: p.x || 0,
            y: p.y || 0,
            stamina: p.stamina || 100,
            wins: p.wins || [],
            isReady: false,
          })),
          // Add a placeholder player to make the room appear full
          {
            id: "disconnected_placeholder",
            fighter: "disconnected",
            color: "gray",
            facing: 1,
            x: 0,
            y: 0,
            stamina: 100,
            balance: 100,
            hasGrip: false,
            gripAcquiredTime: 0,
            isClinchBeltHolding: false,
            clinchBeltRequiresM2Release: false,
            inClinch: false,
            clinchAction: null,
            isClinchPushing: false,
            isClinchPlanting: false,
            isResistingThrow: false,
            isResistingPull: false,
            wins: [],
            isReady: false,
          },
        ];
      }

      // Normal room - return cleaned player data
      return r.players.map((p) => ({
        id: p.id,
        fighter: p.fighter,
        color: p.color,
        mawashiColor: p.mawashiColor,
        bodyColor: p.bodyColor ?? null,
        gearIds: Array.isArray(p.gearIds) ? p.gearIds : [],
        facing: p.facing || 1,
        x: p.x || 0,
        y: p.y || 0,
        stamina: p.stamina || 100,
        wins: p.wins || [],
        // Clean up all circular references and complex objects
        isReady: false,
        isJumping: false,
        isAttacking: false,
        isStrafing: false,
        isRawParrying: false,
        isGuarding: false,
        apChainCount: 0,
        isRawParryStun: false,
        isDodging: false,
        isSidestepping: false,
        isSidestepStartup: false,
        isSidestepRecovery: false,
        isGrabbing: false,
        isBeingGrabbed: false,
        isCounterGrabbed: false,
        isArmClamped: false,
        clinchThrowFailStagger: false,
        isThrowing: false,
        isBeingThrown: false,
        isHit: false,
        isAlreadyHit: false,
        isParryKnockback: false,
        isDead: false,
        isBowing: false,
        knockbackVelocity: { x: 0, y: 0 },
        // Clean up power-up related states
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        isThrowingSalt: false,
        saltCooldown: false,
        snowballCooldown: false,
        pumoArmyCooldown: false,
        snowballThrowsRemaining: null,
        pumoArmySpawnsRemaining: null,
        isThrowingSnowball: false,
        isSpawningPumoArmy: false,
        hitAbsorptionUsed: false,
        snowballs: [],
        pumoArmy: [],
        // Don't set canMoveToReady here - it should only be set during actual salt throwing phase
        // Simplified keys object
        keys: {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": false,
          shift: false,
          e: false,
          f: false,
          mouse1: false,
          mouse2: false,
        },
      }));
    })(),
  }));



  return cleanedRooms;
}

module.exports = {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
};

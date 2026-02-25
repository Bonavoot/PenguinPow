const {
  GROUND_LEVEL,
  POWER_UP_TYPES,
  POWER_UP_EFFECTS,
} = require("./constants");

const {
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  setPlayerTimeout,
  timeoutManager,
} = require("./gameUtils");

const LOBBY_COLORS = [
  "#4169E1", "#525252", "#3B5EB0", "#A85DBF", "#2E9E5A", "#1A7A8A", "#E8913A",
  "#E87070", "#D4A520", "#A07348", "#6E8495", "#88C4D8", "#D94848",
  "rainbow", "fire", "vaporwave", "camo", "galaxy", "gold",
];

const LOBBY_BODY_COLORS = [
  null, "#4d4d4d", "#2656A8", "#9932CC", "#32CD32", "#17A8A0", "#E27020",
  "#FFB6C1", "#F5C422", "#8B5E3C", "#A8A8A8", "#6ABED0", "#CC3333",
];

function createCPUPlayer(uniqueId) {
  const cpuPlayerId = uniqueId || `CPU_PLAYER_${Date.now()}`;
  return {
    id: cpuPlayerId,
    isCPU: true,
    fighter: "player 2",
    color: "salmon",
    mawashiColor: "#D94848",
    bodyColor: null,
    isJumping: false,
    isAttacking: false,
    throwCooldown: false,
    grabCooldown: false,
    isChargingAttack: false,
    chargeStartTime: 0,
    chargeMaxDuration: 2000,
    chargeAttackPower: 0,
    chargingFacingDirection: null,
    slapFacingDirection: null,
    isSlapAttack: false,
    slapAnimation: 2,
    isThrowing: false,
    isThrowingSalt: false,
    saltCooldown: false,
    snowballCooldown: false,
    lastSnowballTime: 0,
    snowballs: [],
    isThrowingSnowball: false,
    pumoArmyCooldown: false,
    pumoArmy: [],
    isSpawningPumoArmy: false,
    throwStartTime: 0,
    throwEndTime: 0,
    throwOpponent: null,
    throwingFacingDirection: null,
    beingThrownFacingDirection: null,
    isGrabbing: false,
    isGrabWalking: false,
    isGrabbingMovement: false,
    isGrabStartup: false,
    isWhiffingGrab: false,
    isGrabWhiffRecovery: false,
    isGrabTeching: false,
    grabTechRole: null,
    grabTechResidualVel: 0,
    isGrabClashing: false,
    grabClashStartTime: 0,
    grabClashInputCount: 0,
    grabMovementStartTime: 0,
    grabMovementDirection: 0,
    grabMovementVelocity: 0,
    grabStartupStartTime: 0,
    grabStartupDuration: 0,
    grabStartTime: 0,
    grabbedOpponent: null,
    isGrabPushing: false,
    isBeingGrabPushed: false,
    isEdgePushing: false,
    isBeingEdgePushed: false,
    isAttemptingPull: false,
    isBeingPullReversaled: false,
    pullReversalPullerId: null,
    isGrabSeparating: false,
    isGrabBellyFlopping: false,
    isBeingGrabBellyFlopped: false,
    isGrabFrontalForceOut: false,
    isBeingGrabFrontalForceOut: false,
    grabActionStartTime: 0,
    grabActionType: null,
    lastGrabPushStaminaDrainTime: 0,
    isAtBoundaryDuringGrab: false,
    grabDurationPaused: false,
    grabDurationPausedAt: 0,
    grabPushEndTime: 0,
    grabPushStartTime: 0,
    grabApproachSpeed: 0,
    grabDecisionMade: false,
    isThrowTeching: false,
    throwTechCooldown: false,
    isSlapParrying: false,
    slapParryKnockbackVelocity: 0,
    slapParryImmunityUntil: 0,
    lastThrowAttemptTime: 0,
    lastGrabAttemptTime: 0,
    isStrafing: false,
    isBraking: false,
    isPowerSliding: false,
    strafeStartTime: 0,
    isCrouchStance: false,
    isCrouchStrafing: false,
    isRawParrying: false,
    rawParryStartTime: 0,
    rawParryMinDurationMet: false,
    isRawParryStun: false,
    perfectParryStunStartTime: 0,
    perfectParryStunBaseTimeout: null,
    isRawParrySuccess: false,
    isPerfectRawParrySuccess: false,
    isAtTheRopes: false,
    atTheRopesStartTime: 0,
    atTheRopesFacingDirection: null,
    dodgeDirection: null,
    dodgeEndTime: 0,
    isDodgeCancelling: false,
    dodgeCancelStartTime: 0,
    dodgeCancelStartY: 0,
    justCrossedThrough: false,
    crossedThroughTime: 0,
    isReady: false,
    isHit: false,
    isAlreadyHit: false,
    isParryKnockback: false,
    isDead: false,
    isBowing: false,
    facing: -1,
    stamina: 100,
    isGassed: false,
    gassedUntil: 0,
    x: 845,
    y: GROUND_LEVEL,
    knockbackVelocity: { x: 0, y: 0 },
    movementVelocity: 0,
    isInStartupFrames: false,
    startupEndTime: 0,
    isInEndlag: false,
    endlagEndTime: 0,
    attackCooldownUntil: 0,
    keys: {
      w: false, a: false, s: false, d: false,
      " ": false, shift: false, e: false, f: false,
      c: false, control: false, mouse1: false, mouse2: false,
    },
    wins: [],
    bufferedAction: null,
    bufferExpiryTime: 0,
    wantsToRestartCharge: false,
    mouse1HeldDuringAttack: false,
    mouse1BufferedBeforeStart: false,
    mouse1PressTime: 0,
    knockbackImmune: false,
    knockbackImmuneEndTime: 0,
    activePowerUp: null,
    powerUpMultiplier: 1,
    selectedPowerUp: null,
    sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    hitAbsorptionUsed: false,
    hitCounter: 0,
    lastHitTime: 0,
    lastSlapHitLandedTime: 0,
    lastCheckedAttackTime: 0,
    hasPendingSlapAttack: false,
    mouse1JustPressed: false,
    mouse1JustReleased: false,
    mouse2JustPressed: false,
    mouse2JustReleased: false,
    shiftJustPressed: false,
    eJustPressed: false,
    wJustPressed: false,
    fJustPressed: false,
    spaceJustPressed: false,
    attackIntentTime: 0,
    attackAttemptTime: 0,
    isOverlapping: false,
    overlapStartTime: null,
    chargeCancelled: false,
    isGrabBreaking: false,
    isGrabBreakCountered: false,
    grabBreakSpaceConsumed: false,
    postGrabInputBuffer: false,
    isCounterGrabbed: false,
    grabCounterAttempted: false,
    grabCounterInput: null,
    isRingOutThrowCutscene: false,
    ringOutThrowDistance: 0,
    isRingOutFreezeActive: false,
    ringOutFreezeEndTime: 0,
    ringOutThrowDirection: null,
    inputLockUntil: 0,
    isFallingOffDohyo: false,
  };
}

function handlePowerUpSelection(room, io) {
  room.powerUpSelectionPhase = true;
  room.playersSelectedPowerUps = {};
  room.playerAvailablePowerUps = {};

  if (room.roundStartTimer) {
    clearTimeout(room.roundStartTimer);
  }
  room.roundStartTimer = setTimeout(() => {
    if (room.powerUpSelectionPhase && room.players.length === 2) {
      const playersNeedingAutoSelect = [];

      room.players.forEach((player) => {
        if (!player.selectedPowerUp) {
          const availablePowerUps =
            room.playerAvailablePowerUps[player.id] ||
            Object.values(POWER_UP_TYPES);
          const firstPowerUp = availablePowerUps[0];

          player.selectedPowerUp = firstPowerUp;
          room.playersSelectedPowerUps[player.id] = firstPowerUp;
          playersNeedingAutoSelect.push(player);
        }
      });

      const selectedCount = Object.keys(room.playersSelectedPowerUps).length;

      if (selectedCount === room.players.length) {
        room.powerUpSelectionPhase = false;

        playersNeedingAutoSelect.forEach((player) => {
          io.to(player.id).emit("power_up_selection_complete");
          handleSaltThrowAndPowerUp(player, room, io);
        });
      }
    }
  }, 15000);

  const allPowerUps = Object.values(POWER_UP_TYPES);

  room.players.forEach((player) => {
    player.isInRitualPhase = true;
    
    const shuffled = [...allPowerUps].sort(() => Math.random() - 0.5);
    const availablePowerUps = shuffled.slice(0, 3);

    room.playerAvailablePowerUps[player.id] = availablePowerUps;

    if (player.isCPU) {
      setTimeout(() => {
        if (!room || !room.players || !room.players.includes(player)) return;
        
        const randomPowerUp =
          availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
        player.selectedPowerUp = randomPowerUp;
        room.playersSelectedPowerUps[player.id] = randomPowerUp;
        handleSaltThrowAndPowerUp(player, room, io);
      }, 2500);
    }
  });

  setTimeout(() => {
    if (room && room.powerUpSelectionPhase && room.players.length === 2) {
      room.players.forEach((player) => {
        if (player.isCPU) return;

        const availablePowerUps = room.playerAvailablePowerUps[player.id];

        io.to(player.id).emit("power_up_selection_start", {
          availablePowerUps: availablePowerUps,
        });
      });

      if (room.isCPURoom) {
        const selectedCount = Object.keys(room.playersSelectedPowerUps).length;
        room.players.forEach((player) => {
          if (!player.isCPU) {
            io.to(player.id).emit("power_up_selection_status", {
              selectedCount,
              totalPlayers: room.players.length,
              selections: room.playersSelectedPowerUps,
            });
          }
        });
      }
    }
  }, 100);
}

function handleSaltThrowAndPowerUp(player, room, io) {
  player.isInRitualPhase = false;
  
  player.isThrowingSalt = true;
  player.saltCooldown = true;
  player.canMoveToReady = false;

  if (player.selectedPowerUp) {
    player.pendingPowerUp = player.selectedPowerUp;
    player.powerUpRevealed = false;
  }
  
  checkAndRevealPowerUps(room, io);

  setPlayerTimeout(
    player.id,
    () => {
      player.isThrowingSalt = false;
      player.saltCooldown = false;
      player.canMoveToReady = true;
    },
    1483
  );
}

function checkAndRevealPowerUps(room, io) {
  const allPlayersSelected = room.players.every(p => p.pendingPowerUp && !p.powerUpRevealed);
  
  if (allPlayersSelected) {
    room.players.forEach(player => {
      player.activePowerUp = player.pendingPowerUp;
      player.powerUpMultiplier = POWER_UP_EFFECTS[player.pendingPowerUp];
      player.powerUpRevealed = true;
    });
    
    io.in(room.id).emit("power_ups_revealed", {
      player1: {
        playerId: room.players[0].id,
        powerUpType: room.players[0].activePowerUp,
      },
      player2: {
        playerId: room.players[1].id,
        powerUpType: room.players[1].activePowerUp,
      },
    });
  }
}

function resetRoomAndPlayers(room, io) {
  room.gameStart = false;
  room.gameOver = false;
  room.hakkiyoiCount = 0;
  room.gameOverTime = null;
  delete room.winnerId;
  delete room.loserId;
  room.previousPlayerStates = [null, null];

  if (room.roundStartTimer) {
    clearTimeout(room.roundStartTimer);
    room.roundStartTimer = null;
  }

  room.players.forEach((p) => timeoutManager.clearPlayer(p.id));

  room.players.forEach((player) => {
    player.keys = {
      w: false, a: false, s: false, d: false,
      " ": false, shift: false, e: false, f: false,
      c: false, control: false, mouse1: false, mouse2: false,
    };
    player.isJumping = false;
    player.isAttacking = false;
    player.isStrafing = false;
    player.isRawParrying = false;
    player.rawParryStartTime = 0;
    player.rawParryMinDurationMet = false;
    player.isRawParryStun = false;
    player.perfectParryStunStartTime = 0;
    player.perfectParryStunBaseTimeout = null;
    player.isRawParrySuccess = false;
    player.isPerfectRawParrySuccess = false;
    player.isAtTheRopes = false;
    player.atTheRopesStartTime = 0;
    player.atTheRopesFacingDirection = null;
    player.isDodging = false;
    player.isReady = false;
    player.isHit = false;
    player.isAlreadyHit = false;
    player.isParryKnockback = false;
    player.isDead = false;
    player.stamina = 100;
    player.isGassed = false;
    player.gassedUntil = 0;
    player.isBowing = false;
    player.x = player.fighter === "player 1" ? 440 : 840;
    player.y = GROUND_LEVEL;
    player.knockbackVelocity = { x: 0, y: 0 };
    player.activePowerUp = null;
    player.powerUpMultiplier = 1;
    player.selectedPowerUp = null;
    player.pendingPowerUp = null;
    player.powerUpRevealed = false;
    player.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
    player.snowballs = [];
    player.snowballCooldown = false;
    player.lastSnowballTime = 0;
    player.isThrowingSnowball = false;
    player.pumoArmy = [];
    player.pumoArmyCooldown = false;
    player.isSpawningPumoArmy = false;
    player.hitAbsorptionUsed = false;
    player.hitCounter = 0;
    player.lastHitTime = 0;
    player.lastSlapHitLandedTime = 0;
    player.hasPendingSlapAttack = false;
    player.isChargingAttack = false;
    player.chargeStartTime = 0;
    player.chargeAttackPower = 0;
    player.chargingFacingDirection = null;
    player.attackType = null;
    player.pendingChargeAttack = null;
    player.spacebarReleasedDuringDodge = false;
    player.mouse1PressTime = 0;
    player.mouse1BufferedBeforeStart = false;
    player.mouse1HeldDuringAttack = false;
    player.wantsToRestartCharge = false;
    player.mouse1JustPressed = false;
    player.mouse1JustReleased = false;
    player.mouse2JustPressed = false;
    player.mouse2JustReleased = false;
    player.attackIntentTime = 0;
    player.attackAttemptTime = 0;
    player.chargeCancelled = false;
    player.chargedAttackHit = false;
    player.slapFacingDirection = null;
    player.attackStartTime = 0;
    player.attackEndTime = 0;
    player.isInStartupFrames = false;
    player.startupEndTime = 0;
    player.isInEndlag = false;
    player.endlagEndTime = 0;
    player.attackCooldownUntil = 0;
    player.actionLockUntil = 0;
    player.currentAction = null;
    player.isThrowLanded = false;
    player.isOverlapping = false;
    player.overlapStartTime = null;
    player.canMoveToReady = false;
    player.isGrabBreaking = false;
    player.isGrabBreakCountered = false;
    player.grabBreakSpaceConsumed = false;
    player.postGrabInputBuffer = false;
    player.isGrabBreaking = false;
    player.isGrabWalking = false;
    player.isGrabbingMovement = false;
    player.isGrabStartup = false;
    player.isWhiffingGrab = false;
    player.isGrabWhiffRecovery = false;
    player.isGrabTeching = false;
    player.grabTechRole = null;
    player.grabTechResidualVel = 0;
    player.isGrabClashing = false;
    player.grabClashStartTime = 0;
    player.grabClashInputCount = 0;
    player.grabMovementStartTime = 0;
    player.grabMovementDirection = 0;
    player.grabMovementVelocity = 0;
    player.grabStartupStartTime = 0;
    player.grabStartupDuration = 0;
    player.isGrabPushing = false;
    player.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    player.isBeingEdgePushed = false;
    player.isAttemptingPull = false;
    player.isBeingPullReversaled = false;
    player.pullReversalPullerId = null;
    player.isGrabSeparating = false;
    player.isGrabBellyFlopping = false;
    player.isBeingGrabBellyFlopped = false;
    player.isGrabFrontalForceOut = false;
    player.isBeingGrabFrontalForceOut = false;
    player.grabActionStartTime = 0;
    player.grabActionType = null;
    player.lastGrabPushStaminaDrainTime = 0;
    player.isAtBoundaryDuringGrab = false;
    player.grabDurationPaused = false;
    player.grabDurationPausedAt = 0;
    player.grabPushEndTime = 0;
    player.grabPushStartTime = 0;
    player.grabApproachSpeed = 0;
    player.grabDecisionMade = false;
    player.isRingOutThrowCutscene = false;
    player.ringOutThrowDistance = 0;
    player.isRingOutFreezeActive = false;
    player.ringOutFreezeEndTime = 0;
    player.ringOutThrowDirection = null;
    player.inputLockUntil = 0;
    player.isFallingOffDohyo = false;
    player.knockbackImmune = false;
    player.knockbackImmuneEndTime = 0;
  });

  room.playerAvailablePowerUps = {};

  if (!room.isInitialRound) {
    handlePowerUpSelection(room, io);
  }

  io.in(room.id).emit("game_reset", false);
}

module.exports = {
  LOBBY_COLORS,
  LOBBY_BODY_COLORS,
  createCPUPlayer,
  handlePowerUpSelection,
  handleSaltThrowAndPowerUp,
  checkAndRevealPowerUps,
  resetRoomAndPlayers,
};

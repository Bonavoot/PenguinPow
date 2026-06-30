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

const {
  createInitialPlayerState,
  PLAYER_2_SPAWN,
} = require("./playerFactory");

const { deriveBashoDraft, normalizeBashoDraftList } = require("./bashoDraft");
const { deriveStatMods } = require("./bashoStatMods");

const LOBBY_COLORS = [
  "#4169E1", "#525252", "#3B5EB0", "#A85DBF", "#2E9E5A", "#1A7A8A", "#E8913A",
  "#E87070", "#D4A520", "#A07348", "#6E8495", "#88C4D8", "#D94848",
  "rainbow", "fire", "vaporwave", "camo", "galaxy", "gold",
];

const LOBBY_BODY_COLORS = [
  null, "#4d4d4d", "#2656A8", "#9932CC", "#32CD32", "#17A8A0", "#E27020",
  "#FFB6C1", "#F5C422", "#8B5E3C", "#A8A8A8", "#6ABED0", "#CC3333",
];

function createCPUPlayer(uniqueId, overrides = {}) {
  const cpuPlayerId = uniqueId || `CPU_PLAYER_${Date.now()}`;
  // `overrides` is applied LAST so a BASHO bout can supply a named opponent's
  // mawashi/body colors (and future fields). With no overrides this behaves
  // exactly as the original VS CPU opponent.
  return createInitialPlayerState({
    id: cpuPlayerId,
    isCPU: true,
    ...PLAYER_2_SPAWN,
    ...overrides,
  });
}

// Apply a single-slot power-up to a player (the non-stacking PvP / VS CPU
// model). Used for the BASHO CPU opponent, which keeps one power-up per bout.
function applySingleSlotPowerUp(player, type) {
  player.activePowerUp = type;
  player.powerUpMultiplier = POWER_UP_EFFECTS[type];
  player.snowballThrowsRemaining =
    type === POWER_UP_TYPES.SNOWBALL ? 5 : null;
  player.pumoArmySpawnsRemaining =
    type === POWER_UP_TYPES.PUMO_ARMY ? 3 : null;
  player.powerUpRevealed = true;
}

// BASHO salt-throw ritual: the throw animation, then auto-unlock movement to
// the ready position. Mirrors handleSaltThrowAndPowerUp but WITHOUT the
// power-up card reveal (the BASHO pick is made on the DAY card beforehand).
function bashoSaltThrow(player, room, io) {
  player.isInRitualPhase = false;
  player.isThrowingSalt = true;
  player.saltCooldown = true;
  player.canMoveToReady = false;
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

function handlePowerUpSelection(room, io) {
  room.powerUpSelectionPhase = true;
  room.playersSelectedPowerUps = {};
  room.playerAvailablePowerUps = {};

  // BASHO (§Phase 7 rework): the human drafts their power-up on the DAY card
  // BEFORE the bout (applied via basho_set_draft → applyBashoDraftToPlayer), so
  // there is NO mid-match card selection. Both fighters just run the salt-throw
  // ritual and then auto-walk to ready. The CPU uses the roster opponent's
  // stacked loadout (applyBashoOpponentProfile) — never a random VS-CPU pick.
  // PvP / VS CPU fall through to the normal selection path below, untouched.
  if (room.matchMode === "basho") {
    room.powerUpSelectionPhase = false;
    const opp =
      room.bashoOpponents && room.bashoOpponents[room.bashoBout || 0];
    room.players.forEach((player) => {
      if (player.isCPU && opp) {
        applyBashoOpponentProfile(player, opp);
      } else if (!player.isCPU) {
        applyBashoDraftToPlayer(player, room.bashoDraftList || []);
      }
      bashoSaltThrow(player, room, io);
    });
    return;
  }

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

    // CPUs can now pilot Flap (see flight AI in cpuAI.js), so it's part of their
    // pool just like human players.
    const pool = allPowerUps;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const availablePowerUps = shuffled.slice(0, 3);

    room.playerAvailablePowerUps[player.id] = availablePowerUps;

    if (player.isCPU) {
      setPlayerTimeout(player.id, () => {
        if (!room || !room.players || !room.players.includes(player)) return;
        
        const randomPowerUp =
          availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
        player.selectedPowerUp = randomPowerUp;
        room.playersSelectedPowerUps[player.id] = randomPowerUp;
        handleSaltThrowAndPowerUp(player, room, io);
      }, 2500);
    }
  });

  room.powerUpNotifyTimer = setTimeout(() => {
    room.powerUpNotifyTimer = null;
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

/**
 * BASHO (Phase 7): apply the human's full STACKED draft list to a player. The
 * picks accumulate across the run (passives multiply, blubber adds an
 * absorption charge, the active abilities accumulate uses), and the per-bout
 * counts reset to the stacked totals each bout. Only ever called for the BASHO
 * human, so PvP / VS CPU never carry `bashoDraft` (the firewall).
 */
function applyBashoDraftToPlayer(player, draftedList) {
  const list = normalizeBashoDraftList(draftedList);
  const d = deriveBashoDraft(list);
  player.draftedPowerUps = list;
  player.bashoDraft = d;
  // The single-slot machinery is fully BYPASSED for the BASHO fighter: every
  // effect comes from `bashoDraft` (folded into combat with neutral defaults).
  // Nulling activePowerUp makes all `activePowerUp === X` branches inert so the
  // stacked multipliers below can't double-count, and powerUpMultiplier stays
  // neutral. Non-BASHO players never reach here, so PvP / VS CPU are untouched.
  player.activePowerUp = null;
  player.powerUpMultiplier = 1;
  // Per-bout active resources, refreshed from the stacked totals each bout.
  player.snowballThrowsRemaining = d.snowball ? d.snowballThrows : null;
  player.pumoArmySpawnsRemaining = d.pumo ? d.pumoSpawns : null;
  player.bashoBlubberRemaining = d.blubberCharges;
}

/*
 * Apply a BASHO roster opponent's full profile to the CPU for the upcoming
 * bout: colors, AI personality archetype, and — for division BOSSES — the
 * combat edge (stat mods, larger size, a stacked power-up loadout). Called at
 * bout 0 (create_basho_match) and after every between-bout reset
 * (resetRoomAndPlayers) so the buffs survive the reset that zeroes size/power.
 *
 * FIREWALL: `statMods`/`bashoDraft`/`sizeMultiplier` are set here on the BASHO
 * CPU only. They're explicitly CLEARED when the opponent isn't a boss so a
 * normal next-day rival never inherits the previous boss's buffs. Non-BASHO
 * CPUs never pass through this path.
 */
function applyBashoOpponentProfile(cpu, opponent) {
  if (!cpu || !opponent) return;
  cpu.mawashiColor = opponent.mawashiColor || cpu.mawashiColor;
  cpu.bodyColor = opponent.bodyColor ?? null;
  cpu.aiArchetype = opponent.archetype || "balanced";
  // Boss-only combat edge; null/default for ordinary rivals.
  cpu.statMods = opponent.stats ? deriveStatMods(opponent.stats) : null;
  cpu.sizeMultiplier = opponent.size || DEFAULT_PLAYER_SIZE_MULTIPLIER;
  // Stacked power-up loadout (folded via the same BASHO draft model as the
  // human). Empty list → neutral draft, clearing any prior boss's power-ups.
  applyBashoDraftToPlayer(cpu, opponent.powerUps || []);
}

function checkAndRevealPowerUps(room, io) {
  const allPlayersSelected = room.players.every(p => p.pendingPowerUp && !p.powerUpRevealed);
  
  if (allPlayersSelected) {
    room.players.forEach(player => {
      player.activePowerUp = player.pendingPowerUp;
      player.powerUpMultiplier = POWER_UP_EFFECTS[player.pendingPowerUp];
      player.snowballThrowsRemaining =
        player.pendingPowerUp === POWER_UP_TYPES.SNOWBALL ? 5 : null;
      player.pumoArmySpawnsRemaining =
        player.pendingPowerUp === POWER_UP_TYPES.PUMO_ARMY ? 3 : null;
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
    player.isSlapAttack = false;
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
    player.isRopeJumping = false;
    player.ropeJumpPhase = null;
    player.ropeJumpStartTime = 0;
    player.ropeJumpStartX = 0;
    player.ropeJumpTargetX = 0;
    player.ropeJumpDirection = 0;
    player.ropeJumpActiveStartTime = 0;
    player.ropeJumpLandingTime = 0;
    player.ropeJumpBufferedAttackRelease = 0;
    player.isFlapping = false;
    player.flapPhase = null;
    player.flapCharges = 0;
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
    player.isHitFalling = false;
    player.hitFallStartTime = 0;
    player.hitFallStartY = 0;
    player.isSidestepHitReturn = false;
    player.sidestepHitReturnStartTime = 0;
    player.sidestepHitReturnStartY = 0;
    player.sidestepHitReturnDuration = 0;
    player.isDodging = false;
    player.isDodgeStartup = false;
    player.isDodgeRecovery = false;
    player.dodgeCooldownUntil = 0;
    player.dodgeStartupEndTime = 0;
    player.dodgeRecoveryEndTime = 0;
    player.slapActiveEndTime = 0;
    player.chargedActiveEndTime = 0;
    player.isReady = false;
    player.isHit = false;
    player.isAlreadyHit = false;
    player.isSlapKnockback = false;
    player.slapKnockbackCanRingOut = false;
    player.isParryKnockback = false;
    player.isDead = false;
    player.stamina = 100;
    player.balance = 100;
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
    player.snowballThrowsRemaining = null;
    player.pumoArmySpawnsRemaining = null;
    player.isThrowingSnowball = false;
    player.pumoArmy = [];
    player.pumoArmyCooldown = false;
    player.isSpawningPumoArmy = false;
    player.hitAbsorptionUsed = false;
    player.hitCounter = 0;
    player.lastHitTime = 0;
    player.lastHitByStringPos = 0;
    player.lastSlapHitLandedTime = 0;
    player.pendingSlapCount = 0;
    player.pendingGrabEnder = false;
    player.slapStringPosition = 0;
    player.slapStringWindowUntil = 0;
    player.slapWhiffCount = 0;
    player.isSlapWhiffPausing = false;
    player.slapAnimationToggle = 0;
    player.currentSlapHitConnected = false;
    player.isBurstKnockback = false;
    player.burstKnockbackStartTime = 0;
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
    player.isGrabbing = false;
    player.isBeingGrabbed = false;
    player.grabbedOpponent = null;
    player.grabStartTime = 0;
    player.isThrowing = false;
    player.isBeingThrown = false;
    player.throwStartTime = 0;
    player.throwEndTime = 0;
    player.throwOpponent = null;
    player.throwingFacingDirection = null;
    player.beingThrownFacingDirection = null;
    player.throwCooldown = false;
    player.grabCooldown = false;
    player.isBeingPushed = false;
    player.lastGrabStaminaDrainTime = 0;
    player.isAttemptingGrabThrow = false;
    player.grabThrowAttemptStartTime = 0;
    player.isCounterGrabbed = false;
    player.grabCounterAttempted = false;
    player.grabCounterInput = null;
    player.isThrowTeching = false;
    player.throwTechCooldown = false;
    player.lastThrowAttemptTime = 0;
    player.lastGrabAttemptTime = 0;
    player.isGrabBreaking = false;
    player.isGrabBreakCountered = false;
    player.grabBreakSpaceConsumed = false;
    player.postGrabInputBuffer = false;
    player.inputBuffer = null;
    player.isGrabBreaking = false;
    player.isGrabWalking = false;
    player.isGrabbingMovement = false;
    player.isGrabStartup = false;
    player.isWhiffingGrab = false;
    player.isGrabWhiffRecovery = false;
    player.grabState = "initial";
    player.grabAttemptType = null;
    player.isGrabTeching = false;
    player.grabTechRole = null;
    player.grabTechResidualVel = 0;
    player.grabMovementStartTime = 0;
    player.grabMovementDirection = 0;
    player.grabMovementVelocity = 0;
    player.grabStartupStartTime = 0;
    player.grabStartupDuration = 0;
    player.grabStartupArmorUsed = false;
    player.isGrabPushing = false;
    player.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    player.isBeingEdgePushed = false;
    player.isAttemptingPull = false;
    player.isBeingPullReversaled = false;
    player.pullReversalPullerId = null;
    player.isGrabSeparating = false;
    player.isGrabBreakSeparating = false;
    player.grabBreakSepStartTime = 0;
    player.grabBreakSepDuration = 0;
    player.grabBreakStartX = undefined;
    player.grabBreakTargetX = undefined;
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
    player.lastHitType = null;
    player.knockbackImmune = false;
    player.knockbackImmuneEndTime = 0;
    player.clinchBreakRequest = false;
    player.clinchBreakRequestTime = 0;
    player.grabImmune = false;
    player.grabImmuneEndTime = 0;
    player.isCinematicKillVictim = false;
    player.isClinchKillThrowVictim = false;
    player.isClinchKillPullVictim = false;
    player.isClinchKillThrow = false;
    player.isClinchKillLift = false;
  });

  room.playerAvailablePowerUps = {};

  // BASHO: the reset above zeroed the CPU's size + power resources, so re-apply
  // the CURRENT bout's opponent profile (colors / archetype / boss buffs). This
  // is what carries a boss's stats/size/power-ups into the bout about to start;
  // ordinary rivals get their colors + archetype and cleared buffs.
  if (room.matchMode === "basho") {
    const cpu = room.players.find((p) => p.isCPU);
    const opp =
      room.bashoOpponents && room.bashoOpponents[room.bashoBout || 0];
    if (cpu && opp) applyBashoOpponentProfile(cpu, opp);
  }

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
  applyBashoDraftToPlayer,
  applyBashoOpponentProfile,
  resetRoomAndPlayers,
};

// Game constants
const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 940;

const DEFAULT_PLAYER_SIZE_MULTIPLIER = 0.85; // 15% smaller default size

// Dohyo (ring) boundaries - players fall when outside these (horizontal only)
const DOHYO_LEFT_BOUNDARY = -40;
const DOHYO_RIGHT_BOUNDARY = 1092;

// Dohyo fall physics
const DOHYO_FALL_DEPTH = 37; // Scaled for camera zoom (was 50)

// Timeout manager for memory leak prevention
class TimeoutManager {
  constructor() {
    this.timeouts = new Map(); // playerId -> Set of timeout IDs
    this.namedTimeouts = new Map(); // playerId -> Map(name -> timeoutId)
  }

  set(playerId, callback, delay, name = null) {
    const timeoutId = setTimeout(() => {
      this.remove(playerId, timeoutId);
      if (name) {
        this.removeNamed(playerId, name);
      }
      callback();
    }, delay);

    if (!this.timeouts.has(playerId)) {
      this.timeouts.set(playerId, new Set());
    }
    this.timeouts.get(playerId).add(timeoutId);

    // Handle named timeouts
    if (name) {
      if (!this.namedTimeouts.has(playerId)) {
        this.namedTimeouts.set(playerId, new Map());
      }

      // Clear existing named timeout if exists
      const existingId = this.namedTimeouts.get(playerId).get(name);
      if (existingId) {
        clearTimeout(existingId);
        this.timeouts.get(playerId).delete(existingId);
      }

      this.namedTimeouts.get(playerId).set(name, timeoutId);
    }

    return timeoutId;
  }

  remove(playerId, timeoutId) {
    if (this.timeouts.has(playerId)) {
      this.timeouts.get(playerId).delete(timeoutId);
    }
  }

  removeNamed(playerId, name) {
    if (this.namedTimeouts.has(playerId)) {
      this.namedTimeouts.get(playerId).delete(name);
    }
  }

  clearPlayerSpecific(playerId, name) {
    if (this.namedTimeouts.has(playerId)) {
      const timeoutId = this.namedTimeouts.get(playerId).get(name);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeouts.get(playerId).delete(timeoutId);
        this.namedTimeouts.get(playerId).delete(name);
      }
    }
  }

  clearPlayer(playerId) {
    if (this.timeouts.has(playerId)) {
      for (const timeoutId of this.timeouts.get(playerId)) {
        clearTimeout(timeoutId);
      }
      this.timeouts.delete(playerId);
    }
    if (this.namedTimeouts.has(playerId)) {
      this.namedTimeouts.delete(playerId);
    }
  }

  clearAll() {
    for (const [playerId, timeoutSet] of this.timeouts) {
      for (const timeoutId of timeoutSet) {
        clearTimeout(timeoutId);
      }
    }
    this.timeouts.clear();
    this.namedTimeouts.clear();
  }
}

const timeoutManager = new TimeoutManager();

// Helper function to replace setTimeout calls - keeps exact same behavior
function setPlayerTimeout(playerId, callback, delay, name = null) {
  return timeoutManager.set(playerId, callback, delay, name);
}

// Helper functions to reduce code duplication
// CRITICAL: This is the SINGLE SOURCE OF TRUTH for blocking new actions
// Any state where the player is "doing something" must be included here
function isPlayerInActiveState(player) {
  return (
    !player.isAttacking &&
    !player.isJumping &&
    !player.isDodging &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRecovering &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isThrowingSnowball &&
    !player.canMoveToReady &&
    !player.isAtTheRopes &&
    // Additional blocking states that were missing:
    !player.isGrabStartup &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabBreaking &&
    !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating &&
    !player.isThrowingSalt &&
    !player.isThrowTeching &&
    !player.isSpawningPumoArmy &&
    !player.isInStartupFrames &&
    !player.isInEndlag &&
    !player.isChargingAttack &&
    !player.isGrabClashing
  );
}

// CRITICAL: This checks ALL states where a player cannot start a NEW action
// Used by canPlayerUseAction, dodge checks, grab checks, etc.
function isPlayerInBasicActiveState(player) {
  return (
    // Core action states
    !player.isAttacking &&
    !player.isDodging &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isThrowingSnowball &&
    !player.isAtTheRopes &&
    // Grab-related intermediate states
    !player.isGrabStartup &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabBreaking &&
    !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating &&
    !player.isGrabClashing &&
    // Other action states
    !player.isThrowingSalt &&
    !player.isThrowTeching &&
    !player.isSpawningPumoArmy &&
    // Attack timing states (startup/endlag)
    !player.isInStartupFrames &&
    !player.isInEndlag &&
    // Charging state
    !player.isChargingAttack
    // NOTE: Power slide no longer blocks actions - attacks cancel the slide
  );
}

function canPlayerCharge(player) {
  return isPlayerInActiveState(player) && !player.isChargingAttack;
}

function canPlayerUseAction(player) {
  // Check action lock timer - this is a global gate to prevent action overlaps
  if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
    return false;
  }
  
  return (
    isPlayerInBasicActiveState(player) &&
    !player.isRecovering &&
    !player.canMoveToReady
  );
}

// Special function for dodge - allows dodging DURING charging (dodge will cancel the charge)
function canPlayerDodge(player) {
  // Check action lock timer
  if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
    return false;
  }
  
  // Check all blocking states EXCEPT isChargingAttack (dodge is allowed during charging)
  return (
    // Core action states
    !player.isAttacking &&
    !player.isDodging &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isThrowingSnowball &&
    !player.isAtTheRopes &&
    // Grab-related intermediate states
    !player.isGrabStartup &&
    !player.isGrabbingMovement &&
    !player.isWhiffingGrab &&
    !player.isGrabBreaking &&
    !player.isGrabBreakCountered &&
    !player.isGrabBreakSeparating &&
    !player.isGrabClashing &&
    // Other action states
    !player.isThrowingSalt &&
    !player.isThrowTeching &&
    !player.isSpawningPumoArmy &&
    // Attack timing states (startup/endlag)
    !player.isInStartupFrames &&
    !player.isInEndlag &&
    // NOTE: isChargingAttack is NOT checked - dodge is allowed during charging (but cancels it)
    // Recovery and ready states
    !player.isRecovering &&
    !player.canMoveToReady
  );
}

function resetPlayerAttackStates(player) {
  player.isAttacking = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.slapFacingDirection = null;
  player.isSlapAttack = false;
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  // Reset visual clarity timing states
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.isInEndlag = false;
  player.endlagEndTime = 0;
  player.attackCooldownUntil = 0;
}

// === CRITICAL: Clear ALL action states when player loses control ===
// This ensures only ONE state/animation can be active at a time
// Called when: isHit, isBeingGrabbed, isBeingThrown, isRawParryStun, isAtTheRopes
function clearAllActionStates(player) {
  // Clear hit states - prevents conflicting states (e.g., isHit + isBeingGrabbed)
  player.isHit = false;
  player.isAlreadyHit = false;
  player.isSlapKnockback = false;
  
  // Clear attack states
  player.isAttacking = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.slapFacingDirection = null;
  player.isSlapAttack = false;
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  player.hasPendingSlapAttack = false;
  player.isSlapSliding = false;
  player.mouse1HeldDuringAttack = false;
  player.mouse1BufferedBeforeStart = false; // Clear pre-game buffer
  player.wantsToRestartCharge = false;
  player.chargedAttackHit = false;
  
  // Clear startup/endlag states
  player.isInStartupFrames = false;
  player.startupEndTime = 0;
  player.isInEndlag = false;
  player.endlagEndTime = 0;
  
  // Clear dodge states
  player.isDodging = false;
  player.isDodgeCancelling = false;
  player.dodgeCancelStartTime = 0;
  player.dodgeCancelStartY = 0;
  player.dodgeStartTime = 0;
  player.dodgeEndTime = 0;
  player.dodgeDirection = null;
  player.dodgeStartX = 0;
  player.dodgeStartY = 0;
  player.justCrossedThrough = false;
  player.crossedThroughTime = 0;
  
  // CRITICAL: Clear any buffered actions - prevents buffered dodge from executing while grabbed
  player.bufferedAction = null;
  player.bufferExpiryTime = 0;
  
  // Clear grab states (as grabber - not being grabbed)
  player.isGrabbing = false;
  player.isGrabWalking = false;
  player.isGrabbingMovement = false;
  player.isGrabStartup = false;
  player.isWhiffingGrab = false;
  player.isGrabWhiffRecovery = false;
  player.grabbedOpponent = null;
  player.grabMovementStartTime = 0;
  player.grabMovementDirection = 0;
  player.grabMovementVelocity = 0;
  player.grabStartupStartTime = 0;
  player.grabStartupDuration = 0;
  player.grabStartTime = 0;
  player.grabState = "initial";
  player.grabAttemptType = null;
  // New grab action system states
  player.isGrabPushing = false;
  player.isBeingGrabPushed = false;
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
  player.grabDecisionMade = false;
  
  // Clear throw states (as thrower)
  player.isThrowing = false;
  player.throwStartTime = 0;
  player.throwEndTime = 0;
  player.throwOpponent = null;
  player.throwingFacingDirection = null;
  
  // Clear parry states (as parrier)
  player.isRawParrying = false;
  player.rawParryStartTime = 0;
  player.rawParryMinDurationMet = false;
  player.isSlapParrying = false;
  player.isRawParryStun = false; // Clear stun state when hit
  player.isRawParrySuccess = false; // Clear parry success animation
  player.isPerfectRawParrySuccess = false;
  
  // Clear movement states
  player.isStrafing = false;
  player.isCrouchStance = false;
  player.isCrouchStrafing = false;
  player.movementVelocity = 0;
  // ICE PHYSICS: Clear sliding states
  player.isPowerSliding = false;
  player.isBraking = false;
  player.strafeStartTime = 0;
  player.wasStrafingLeft = false;
  player.wasStrafingRight = false;
  
  // Clear recovery states
  player.isRecovering = false;
  player.recoveryStartTime = 0;
  player.recoveryDuration = 0;
  player.recoveryDirection = null;
  
  // Clear action lock
  player.currentAction = null;
  player.actionLockUntil = 0;
  
  // Clear buffered actions
  player.bufferedAction = null;
  player.bufferExpiryTime = 0;
  player.postGrabInputBuffer = false;
  
  // Clear power-up action states
  player.isThrowingSnowball = false;
  player.isSpawningPumoArmy = false;
  player.isThrowingSalt = false;
}

function isWithinMapBoundaries(
  x,
  leftBoundary = MAP_LEFT_BOUNDARY,
  rightBoundary = MAP_RIGHT_BOUNDARY
) {
  return x >= leftBoundary && x <= rightBoundary;
}

function constrainToMapBoundaries(
  x,
  leftBoundary = MAP_LEFT_BOUNDARY,
  rightBoundary = MAP_RIGHT_BOUNDARY
) {
  return Math.max(leftBoundary, Math.min(x, rightBoundary));
}

function shouldRestartCharging(player) {
  // Require explicit intent from the player to restart charging to reduce accidental restarts
  // Mouse1 is now the charge button (hold mouse1 past threshold)
  // IMPORTANT: Always enforce the 200ms threshold to prevent quick taps from triggering charge
  return (
    player.keys.mouse1 &&
    player.mouse1PressTime > 0 &&
    (Date.now() - player.mouse1PressTime) >= 200 &&
    player.wantsToRestartCharge &&
    isPlayerInActiveState(player)
  );
}

function startCharging(player) {
  // NOTE: Charging does NOT cancel power slide - only the released attack does
  // This allows players to charge while sliding for aggressive plays
  
  player.isChargingAttack = true;
  // TAP-style: resume existing charge if player had power preserved (e.g., after being hit)
  if (!player.chargeStartTime) {
    player.chargeStartTime = Date.now();
    player.chargeAttackPower = 1;
  }
  player.attackType = "charged";
  // Consuming the intent once we begin charging prevents perpetual auto-restarts
  player.wantsToRestartCharge = false;
}

function canPlayerSlap(player) {
  // Check if player is on attack cooldown - this is the single source of truth for timing
  const isOnCooldown = player.attackCooldownUntil && Date.now() < player.attackCooldownUntil;
  
  // Check action lock timer
  const isActionLocked = player.actionLockUntil && Date.now() < player.actionLockUntil;
  
  return (
    // Use the comprehensive blocking state check
    isPlayerInBasicActiveState(player) &&
    !player.isJumping &&
    !player.canMoveToReady &&
    !player.isRecovering &&
    !isOnCooldown &&
    !isActionLocked
  );
}

// Add helper function for clearing charge with auto-restart
function clearChargeState(player, isCancelled = false) {
  // Clear charge state only - no auto-restart
  // Auto-restart is now handled by specific action completion callbacks
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  player.mouse1HeldDuringAttack = false; // Clear the flag when clearing charge state

  // Set flag to indicate charge was cancelled (not executed)
  if (isCancelled) {
    player.chargeCancelled = true;
    // Clear the flag after a short delay to prevent interference with next charge
    setTimeout(() => {
      if (player.chargeCancelled) {
        player.chargeCancelled = false;
      }
    }, 100);
  }
}

// Centralized action lock helpers to prevent simultaneous actions during input mashing
function isActionLocked(player) {
  return !!player.actionLockUntil && Date.now() < player.actionLockUntil;
}

function beginAction(player, actionName, lockDurationMs) {
  // Guard against invalid durations
  const duration = Math.max(0, Number(lockDurationMs || 0));
  player.currentAction = actionName || null;
  if (duration > 0) {
    player.actionLockUntil = Date.now() + duration;
  } else {
    player.actionLockUntil = 0;
  }
}

// Check if player is outside the dohyo boundaries (horizontal only)
function isOutsideDohyo(x, y) {
  return (
    x < DOHYO_LEFT_BOUNDARY ||
    x > DOHYO_RIGHT_BOUNDARY
  );
}

module.exports = {
  // Constants
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  DOHYO_FALL_DEPTH,

  // Classes and instances
  TimeoutManager,
  timeoutManager,

  // Functions
  setPlayerTimeout,
  isPlayerInActiveState,
  isPlayerInBasicActiveState,
  canPlayerCharge,
  canPlayerUseAction,
  canPlayerDodge,
  resetPlayerAttackStates,
  clearAllActionStates,  // Critical: clears ALL states when player loses control
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  shouldRestartCharging,
  startCharging,
  canPlayerSlap,
  clearChargeState,
  isOutsideDohyo,
};

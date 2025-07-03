// Game constants
const MAP_LEFT_BOUNDARY = 220;
const MAP_RIGHT_BOUNDARY = 855;

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
    !player.isAtTheRopes
  );
}

function isPlayerInBasicActiveState(player) {
  return (
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
    !player.isAtTheRopes
  );
}

function canPlayerCharge(player) {
  return isPlayerInActiveState(player) && !player.isChargingAttack;
}

function canPlayerUseAction(player) {
  return (
    isPlayerInBasicActiveState(player) &&
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
  return player.keys.mouse2 && isPlayerInActiveState(player);
}

function startCharging(player) {
  player.isChargingAttack = true;
  player.chargeStartTime = Date.now();
  player.chargeAttackPower = 1;
  player.attackType = "charged";
}

function canPlayerSlap(player) {
  return (
    !player.isJumping &&
    !player.isDodging &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isGrabbing &&
    !player.isBeingGrabbed &&
    !player.isHit &&
    !player.isRawParryStun &&
    !player.isRawParrying &&
    !player.isThrowingSnowball &&
    !player.canMoveToReady &&
    !player.isAtTheRopes
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
  player.mouse2HeldDuringAttack = false; // Clear the flag when clearing charge state
  
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

module.exports = {
  // Constants
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,

  // Classes and instances
  TimeoutManager,
  timeoutManager,

  // Functions
  setPlayerTimeout,
  isPlayerInActiveState,
  isPlayerInBasicActiveState,
  canPlayerCharge,
  canPlayerUseAction,
  resetPlayerAttackStates,
  isWithinMapBoundaries,
  constrainToMapBoundaries,
  shouldRestartCharging,
  startCharging,
  canPlayerSlap,
  clearChargeState,
};

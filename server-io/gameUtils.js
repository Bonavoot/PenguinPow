// Game constants
const MAP_LEFT_BOUNDARY = 65;
const MAP_RIGHT_BOUNDARY = 980;

// Timeout manager for memory leak prevention
class TimeoutManager {
  constructor() {
    this.timeouts = new Map(); // playerId -> Set of timeout IDs
  }
  
  set(playerId, callback, delay) {
    const timeoutId = setTimeout(() => {
      this.remove(playerId, timeoutId);
      callback();
    }, delay);
    
    if (!this.timeouts.has(playerId)) {
      this.timeouts.set(playerId, new Set());
    }
    this.timeouts.get(playerId).add(timeoutId);
    
    return timeoutId;
  }
  
  remove(playerId, timeoutId) {
    if (this.timeouts.has(playerId)) {
      this.timeouts.get(playerId).delete(timeoutId);
    }
  }
  
  clearPlayer(playerId) {
    if (this.timeouts.has(playerId)) {
      for (const timeoutId of this.timeouts.get(playerId)) {
        clearTimeout(timeoutId);
      }
      this.timeouts.delete(playerId);
    }
  }
  
  clearAll() {
    for (const [playerId, timeoutSet] of this.timeouts) {
      for (const timeoutId of timeoutSet) {
        clearTimeout(timeoutId);
      }
    }
    this.timeouts.clear();
  }
}

const timeoutManager = new TimeoutManager();

// Helper function to replace setTimeout calls - keeps exact same behavior
function setPlayerTimeout(playerId, callback, delay) {
  return timeoutManager.set(playerId, callback, delay);
}

// Helper functions to reduce code duplication
function isPlayerInActiveState(player) {
  return !player.isAttacking &&
         !player.isJumping &&
         !player.isDodging &&
         !player.isThrowing &&
         !player.isBeingThrown &&
         !player.isGrabbing &&
         !player.isBeingGrabbed &&
         !player.isHit &&
         !player.isRecovering &&
         !player.isRawParryStun &&
         !player.isThrowingSnowball &&
         !player.canMoveToReady;
}

function isPlayerInBasicActiveState(player) {
  return !player.isAttacking &&
         !player.isDodging &&
         !player.isThrowing &&
         !player.isBeingThrown &&
         !player.isGrabbing &&
         !player.isBeingGrabbed &&
         !player.isHit &&
         !player.isRawParryStun &&
         !player.isThrowingSnowball;
}

function canPlayerCharge(player) {
  return isPlayerInActiveState(player) && 
         !player.isChargingAttack;
}

function canPlayerUseAction(player) {
  return isPlayerInBasicActiveState(player) &&
         !player.isRecovering &&
         !player.canMoveToReady;
}

function resetPlayerAttackStates(player) {
  player.isAttacking = false;
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.isSlapAttack = false;
  player.attackStartTime = 0;
  player.attackEndTime = 0;
  player.attackType = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
}

function isWithinMapBoundaries(x, leftBoundary = MAP_LEFT_BOUNDARY, rightBoundary = MAP_RIGHT_BOUNDARY) {
  return x >= leftBoundary && x <= rightBoundary;
}

function constrainToMapBoundaries(x, leftBoundary = MAP_LEFT_BOUNDARY, rightBoundary = MAP_RIGHT_BOUNDARY) {
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
  return !player.isJumping &&
         !player.isDodging &&
         !player.isThrowing &&
         !player.isBeingThrown &&
         !player.isGrabbing &&
         !player.isBeingGrabbed &&
         !player.isHit &&
         !player.isRawParryStun &&
         !player.isThrowingSnowball &&
         !player.canMoveToReady;
}

// Add helper function for clearing charge with auto-restart
function clearChargeState(player) {
  // Clear charge state only - no auto-restart
  // Auto-restart is now handled by specific action completion callbacks
  player.isChargingAttack = false;
  player.chargeStartTime = 0;
  player.chargeAttackPower = 0;
  player.chargingFacingDirection = null;
  player.pendingChargeAttack = null;
  player.spacebarReleasedDuringDodge = false;
  player.mouse2HeldDuringAttack = false; // Clear the flag when clearing charge state
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
  clearChargeState
}; 
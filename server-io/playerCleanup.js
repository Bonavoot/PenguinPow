const { GRAB_STATES } = require("./constants");

function cleanupPlayerStates(player) {
  // Clean up all player references
  player.grabbedOpponent = null;
  player.throwOpponent = null;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;
  player.grabAttemptStartTime = null;
  player.isGrabbing = false;
  player.isGrabbingMovement = false;
  player.isWhiffingGrab = false;
  player.isGrabClashing = false;
  player.grabClashStartTime = 0;
  player.grabClashInputCount = 0;
  player.grabMovementStartTime = 0;
  player.grabMovementDirection = 0;
  player.grabMovementVelocity = 0;
  player.isBeingGrabbed = false;
  player.isThrowing = false;
  player.isBeingThrown = false;
  player.isAttacking = false;
  player.isHit = false;
  player.isAlreadyHit = false;
  player.isDodging = false;
  player.isRawParrying = false;
  player.isRawParryStun = false;
  player.isStrafing = false;
  player.isJumping = false;
  player.isReady = false;
  player.isBowing = false;
  player.knockbackVelocity = { x: 0, y: 0 };

  // Clean up power-up related states
  player.activePowerUp = null;
  player.powerUpMultiplier = 1;
  player.selectedPowerUp = null;
  player.isThrowingSalt = false;
  player.saltCooldown = false;
  player.snowballCooldown = false;
  player.pumoArmyCooldown = false;
  player.isThrowingSnowball = false;
  player.isSpawningPumoArmy = false;
  player.hitAbsorptionUsed = false;
  player.snowballs = [];
  player.pumoArmy = [];
  // Don't set canMoveToReady here - it should only be set during actual salt throwing phase

  player.keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    " ": false,
    shift: false,
    e: false,
    f: false,
  };
}

function cleanupOpponentStates(opponent) {
  if (opponent) {
    opponent.isBeingGrabbed = false;
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
      isGrabClashing: false,
      grabClashStartTime: 0,
      grabClashInputCount: 0,
      grabMovementStartTime: 0,
      grabMovementDirection: 0,
      grabMovementVelocity: 0,
      isBeingGrabbed: false,
      isThrowing: false,
      isBeingThrown: false,
      isAttacking: false,
      isHit: false,
      isAlreadyHit: false,
      isDodging: false,
      isRawParrying: false,
      isRawParryStun: false,
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
  const cleanedRooms = rooms.map((r) => ({
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
        isRawParryStun: false,
        isDodging: false,
        isGrabbing: false,
        isBeingGrabbed: false,
        isThrowing: false,
        isBeingThrown: false,
        isHit: false,
        isAlreadyHit: false,
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

  // Debug: Log rooms with disconnection states
  cleanedRooms.forEach((room, index) => {
    if (room.opponentDisconnected || room.disconnectedDuringGame) {
      console.log(
        `CLEANED ROOMS DEBUG: Room ${room.id} (index ${index}) - opponentDisconnected: ${room.opponentDisconnected}, disconnectedDuringGame: ${room.disconnectedDuringGame}, players: ${room.players.length}`
      );
      console.log(
        `CLEANED ROOMS DEBUG: Room ${room.id} player IDs:`,
        room.players.map((p) => ({ id: p.id, fighter: p.fighter }))
      );
    }
  });

  return cleanedRooms;
}

module.exports = {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
};

const { GRAB_STATES } = require("./constants");

function cleanupPlayerStates(player) {
  // Clean up all player references
  player.grabbedOpponent = null;
  player.throwOpponent = null;
  player.grabState = GRAB_STATES.INITIAL;
  player.grabAttemptType = null;
  player.grabAttemptStartTime = null;
  player.isGrabbing = false;
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
}

function getCleanedRoomData(room) {
  return {
    ...room,
    players: room.players.map((p) => ({
      ...p,
      grabbedOpponent: null,
      throwOpponent: null,
      grabState: GRAB_STATES.INITIAL,
      grabAttemptType: null,
      grabAttemptStartTime: null,
      isGrabbing: false,
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
  return rooms.map((r) => ({
    ...r,
    players: r.players.map((p) => ({
      ...p,
      grabbedOpponent: null,
      throwOpponent: null,
      grabState: GRAB_STATES.INITIAL,
      grabAttemptType: null,
      grabAttemptStartTime: null,
      isGrabbing: false,
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
  }));
}

module.exports = {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
};

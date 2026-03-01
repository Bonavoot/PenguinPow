const {
  GRAB_STATES, GROUND_LEVEL, GRAB_RANGE, THROW_RANGE,
  POWER_UP_TYPES, POWER_UP_EFFECTS,
  HITBOX_DISTANCE_VALUE, DOHYO_FALL_DEPTH,
  DODGE_DURATION, DODGE_STAMINA_COST,
  ROPE_JUMP_STARTUP_MS, ROPE_JUMP_STAMINA_COST, ROPE_JUMP_BOUNDARY_ZONE,
  DODGE_SLIDE_MOMENTUM, DODGE_POWERSLIDE_BOOST,
  DODGE_STARTUP_MS,
  SLAP_ATTACK_STAMINA_COST, CHARGED_ATTACK_STAMINA_COST,
  CHARGE_FULL_POWER_MS,
  GRAB_ACTION_WINDOW, GRAB_STARTUP_DURATION_MS,
  HITSTOP_THROW_MS,
  PULL_REVERSAL_DISTANCE, PULL_REVERSAL_TWEEN_DURATION,
  PULL_REVERSAL_PULLED_LOCK, PULL_REVERSAL_PULLER_LOCK,
} = require("./constants");

const {
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  timeoutManager,
  setPlayerTimeout,
  clearAllActionStates,
  clearChargeState,
  canPlayerSlap,
  canPlayerDash,
  canPlayerCharge,
  canPlayerUseAction,
  shouldRestartCharging,
  startCharging,
  isRoomInHitstop,
  triggerHitstop,
} = require("./gameUtils");

const {
  cleanupGrabStates,
  executeSlapAttack,
  executeChargedAttack,
} = require("./gameFunctions");

const {
  correctFacingAfterGrabOrThrow,
} = require("./grabMechanics");

const {
  isOpponentCloseEnoughForThrow,
  isOpponentCloseEnoughForGrab,
  checkForThrowTech,
  checkForGrabPriority,
  applyThrowTech,
} = require("./combatHelpers");

const {
  LOBBY_COLORS,
  LOBBY_BODY_COLORS,
  createCPUPlayer,
  handlePowerUpSelection,
  handleSaltThrowAndPowerUp,
  resetRoomAndPlayers,
} = require("./roomManagement");

const {
  cleanupPlayerStates,
  cleanupOpponentStates,
  cleanupRoomState,
  getCleanedRoomData,
  getCleanedRoomsData,
} = require("./playerCleanup");

const { clearAIState } = require("./cpuAI");

function registerSocketHandlers(socket, io, rooms, context) {
  const { registerPlayerInMaps, unregisterPlayerFromMaps } = context;

  socket.on("game_reset", (data) => {
    // Find the room index using the socket's roomId to ensure we're resetting the correct room
    const roomIndex = rooms.findIndex((room) => room.id === socket.roomId);
    if (roomIndex !== -1) {
      resetRoomAndPlayers(rooms[roomIndex], io);
    }
  });

  socket.on("get_rooms", () => {
    socket.emit("rooms", rooms);
  });

  socket.on("lobby", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);
    if (roomIndex !== -1) {
      // Send current lobby state to the requesting client
      socket.emit("lobby", rooms[roomIndex].players);
    }
  });

  // Handle mawashi color updates - broadcast to all players in room
  socket.on("update_mawashi_color", (data) => {
    const { roomId, playerId, color } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    
    if (roomIndex === -1) return;
    
    const room = rooms[roomIndex];
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    
    if (playerIndex === -1) return;
    
    // PvP: reject if color is already taken by the other player (normalize for comparison)
    const otherPlayer = room.players[1 - playerIndex];
    if (otherPlayer && !otherPlayer.isCPU) {
      const otherHex = (otherPlayer.mawashiColor || "").toString().toLowerCase();
      const newHex = (color || "").toString().toLowerCase();
      if (otherHex && newHex && otherHex === newHex) {
        return; // Don't apply duplicate color
      }
    }
    
    // Update the player's mawashi color
    room.players[playerIndex].mawashiColor = color;

    // Broadcast updated player data to all players in the room
    io.in(roomId).emit("lobby", room.players);
    io.emit("rooms", getCleanedRoomsData(rooms));

    // Also emit a specific color update event for immediate UI updates
    io.in(roomId).emit("mawashi_color_updated", {
      playerId,
      playerIndex,
      color,
    });
  });

  // Handle body color updates — mirrors mawashi_color logic
  socket.on("update_body_color", (data) => {
    const { roomId, playerId, color } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    room.players[playerIndex].bodyColor = color;

    io.in(roomId).emit("lobby", room.players);
    io.emit("rooms", getCleanedRoomsData(rooms));
    io.in(roomId).emit("body_color_updated", {
      playerId,
      playerIndex,
      color,
    });
  });

  socket.on("join_room", (data) => {
    socket.join(data.roomId);
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);

    // Check if room is in opponent disconnected state - prevent joining
    if (
      rooms[roomIndex].opponentDisconnected ||
      rooms[roomIndex].disconnectedDuringGame
    ) {
      socket.emit("join_room_failed", {
        reason: "Room is currently unavailable",
        roomId: data.roomId,
      });
      socket.leave(data.roomId);
      return;
    }

    // If someone is joining and there's already one player, ensure clean room state
    if (rooms[roomIndex].players.length === 1) {
      cleanupRoomState(rooms[roomIndex]);
      // Also clean up the existing player's power-up related state
      const existingPlayer = rooms[roomIndex].players[0];
      existingPlayer.activePowerUp = null;
      existingPlayer.powerUpMultiplier = 1;
      existingPlayer.selectedPowerUp = null;
      existingPlayer.isThrowingSalt = false;
      existingPlayer.saltCooldown = false;
      existingPlayer.snowballCooldown = false;
      existingPlayer.pumoArmyCooldown = false;
      existingPlayer.snowballThrowsRemaining = null;
      existingPlayer.isThrowingSnowball = false;
      existingPlayer.isSpawningPumoArmy = false;
      existingPlayer.hitAbsorptionUsed = false;
      existingPlayer.snowballs = [];
      existingPlayer.pumoArmy = [];
      // Ensure default size is applied
      existingPlayer.sizeMultiplier = DEFAULT_PLAYER_SIZE_MULTIPLIER;
      // Don't set canMoveToReady here - it should only be set during actual salt throwing phase
    }

    if (rooms[roomIndex].players.length < 1) {
      rooms[roomIndex].players.push({
        id: data.socketId,
        fighter: "player 1",
        color: "aqua",
        mawashiColor: "#4169E1",
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
        // New grab action system states
        isGrabPushing: false,
        isBeingGrabPushed: false,
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
        isRopeJumping: false,
        ropeJumpPhase: null,
        ropeJumpStartTime: 0,
        ropeJumpStartX: 0,
        ropeJumpTargetX: 0,
        ropeJumpDirection: 0,
        ropeJumpActiveStartTime: 0,
        ropeJumpLandingTime: 0,
        dodgeDirection: false,
        dodgeEndTime: 0,
        isDodgeStartup: false,
        isDodgeRecovery: false,
        dodgeStartupEndTime: 0,
        dodgeRecoveryEndTime: 0,
        slapActiveEndTime: 0,
        chargedActiveEndTime: 0,
        isReady: false,
        isHit: false,
        isAlreadyHit: false,
        isDead: false,
        isBowing: false,
        facing: 1,
        stamina: 100,
        isGassed: false,
        gassedUntil: 0,
        x: 220,
        y: GROUND_LEVEL,
        knockbackVelocity: { x: 0, y: 0 },
        // Visual clarity timing states
        isInStartupFrames: false,
        startupEndTime: 0,
        isInEndlag: false,
        endlagEndTime: 0,
        attackCooldownUntil: 0,
        keys: {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": false,
          shift: false,
          e: false,
          f: false,
          c: false,
          mouse1: false,
          mouse2: false,
        },
        wins: [],
        bufferedAction: null, // Add buffer for pending actions
        bufferExpiryTime: 0, // Add expiry time for buffered actions
        wantsToRestartCharge: false, // Add flag for charge restart detection
        mouse1HeldDuringAttack: false, // Add flag for simpler charge restart detection
        mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
        mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
        knockbackImmune: false, // Add knockback immunity flag
        knockbackImmuneEndTime: 0, // Add knockback immunity timer
        // Add missing power-up initialization
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
        hitAbsorptionUsed: false, // Add thick blubber hit absorption tracking
        hitCounter: 0, // Add counter for reliable hit sound triggering
        lastHitTime: 0, // Add timing tracking for dynamic hit duration
        lastSlapHitLandedTime: 0, // Track when attacker last landed a slap (for chain lunge)
        lastCheckedAttackTime: 0, // Add tracking for attack collision checking
        hasPendingSlapAttack: false, // Add flag for buffering one additional slap attack
        mouse1JustPressed: false, // Track if mouse1 was just pressed this frame
        mouse1JustReleased: false, // Track if mouse1 was just released this frame
        mouse2JustPressed: false, // Track if mouse2 was just pressed this frame (grab)
        mouse2JustReleased: false, // Track if mouse2 was just released this frame
        shiftJustPressed: false, // Track if shift was just pressed this frame
        eJustPressed: false, // Track if E was just pressed this frame
        wJustPressed: false, // Track if W was just pressed this frame
        fJustPressed: false, // Track if F was just pressed this frame
        spaceJustPressed: false, // Track if spacebar was just pressed this frame
        inputBuffer: null,
        attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
        attackAttemptTime: 0, // When attack execution started (for counter hit detection)
        isOverlapping: false, // Track overlap state for smoother separation
        overlapStartTime: null, // Track when overlap began for progressive separation
        chargeCancelled: false, // Track if charge was cancelled (vs executed)
        isGrabBreaking: false,
        isGrabBreakCountered: false,
        grabBreakSpaceConsumed: false,
        postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
        isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
        // Ring-out throw cutscene flags
        isRingOutThrowCutscene: false,
        ringOutThrowDistance: 0,
        isRingOutFreezeActive: false,
        ringOutFreezeEndTime: 0,
        ringOutThrowDirection: null,
        inputLockUntil: 0,
      });
      // PERFORMANCE: Register player 1 in lookup maps
      registerPlayerInMaps(rooms[roomIndex].players[0], rooms[roomIndex]);
    } else if (rooms[roomIndex].players.length === 1) {
      rooms[roomIndex].players.push({
        id: data.socketId,
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
        // New grab action system states
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
        isRopeJumping: false,
        ropeJumpPhase: null,
        ropeJumpStartTime: 0,
        ropeJumpStartX: 0,
        ropeJumpTargetX: 0,
        ropeJumpDirection: 0,
        ropeJumpActiveStartTime: 0,
        ropeJumpLandingTime: 0,
        dodgeDirection: null,
        dodgeEndTime: 0,
        isDodgeStartup: false,
        isDodgeRecovery: false,
        dodgeStartupEndTime: 0,
        dodgeRecoveryEndTime: 0,
        slapActiveEndTime: 0,
        chargedActiveEndTime: 0,
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
        // Visual clarity timing states
        isInStartupFrames: false,
        startupEndTime: 0,
        isInEndlag: false,
        endlagEndTime: 0,
        attackCooldownUntil: 0,
        keys: {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": false,
          shift: false,
          e: false,
          f: false,
          c: false,
          mouse1: false,
          mouse2: false,
        },
        wins: [],
        bufferedAction: null, // Add buffer for pending actions
        bufferExpiryTime: 0, // Add expiry time for buffered actions
        wantsToRestartCharge: false, // Add flag for charge restart detection
        mouse1HeldDuringAttack: false, // Add flag for simpler charge restart detection
        mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
        mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
        knockbackImmune: false, // Add knockback immunity flag
        knockbackImmuneEndTime: 0, // Add knockback immunity timer
        // Add missing power-up initialization
        activePowerUp: null,
        powerUpMultiplier: 1,
        selectedPowerUp: null,
        sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
        hitAbsorptionUsed: false, // Add thick blubber hit absorption tracking
        hitCounter: 0, // Add counter for reliable hit sound triggering
        lastHitTime: 0, // Add timing tracking for dynamic hit duration
        lastSlapHitLandedTime: 0, // Track when attacker last landed a slap (for chain lunge)
        lastCheckedAttackTime: 0, // Add tracking for attack collision checking
        hasPendingSlapAttack: false, // Add flag for buffering one additional slap attack
        mouse1JustPressed: false, // Track if mouse1 was just pressed this frame
        mouse1JustReleased: false, // Track if mouse1 was just released this frame
        mouse2JustPressed: false, // Track if mouse2 was just pressed this frame (grab)
        mouse2JustReleased: false, // Track if mouse2 was just released this frame
        shiftJustPressed: false, // Track if shift was just pressed this frame
        eJustPressed: false, // Track if E was just pressed this frame
        wJustPressed: false, // Track if W was just pressed this frame
        fJustPressed: false, // Track if F was just pressed this frame
        spaceJustPressed: false, // Track if spacebar was just pressed this frame
        inputBuffer: null,
        attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
        attackAttemptTime: 0, // When attack execution started (for counter hit detection)
        isOverlapping: false, // Track overlap state for smoother separation
        overlapStartTime: null, // Track when overlap began for progressive separation
        chargeCancelled: false, // Track if charge was cancelled (vs executed)
        isGrabBreaking: false,
        isGrabBreakCountered: false,
        grabBreakSpaceConsumed: false,
        postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
        isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
        // Ring-out throw cutscene flags
        isRingOutThrowCutscene: false,
        ringOutThrowDistance: 0,
        isRingOutFreezeActive: false,
        ringOutFreezeEndTime: 0,
        ringOutThrowDirection: null,
        inputLockUntil: 0,
        // Dohyo fall physics
        isFallingOffDohyo: false,
      });
      // PERFORMANCE: Register player 2 in lookup maps
      registerPlayerInMaps(rooms[roomIndex].players[1], rooms[roomIndex]);
    }

    // If this is the second player joining and room was in disconnected state, reset it
    if (
      rooms[roomIndex].players.length === 2 &&
      rooms[roomIndex].opponentDisconnected
    ) {
      rooms[roomIndex].opponentDisconnected = false;
      rooms[roomIndex].disconnectedDuringGame = false;

      // Clear any lingering power-up selection state
      rooms[roomIndex].powerUpSelectionPhase = false;
      rooms[roomIndex].playersSelectedPowerUps = {};
      rooms[roomIndex].playerAvailablePowerUps = {};

      // Clear any remaining round start timer
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
      }

      // Clean up the room state
      cleanupRoomState(rooms[roomIndex]);
    }

    socket.roomId = data.roomId;
    io.to(data.roomId).emit("rooms", rooms);
    io.to(data.roomId).emit("lobby", rooms[roomIndex].players);
    // console.log(rooms[roomIndex].players);
  });

  // CPU Match creation handler
  socket.on("create_cpu_match", (data) => {
    // Generate a unique room ID for this CPU match
    const cpuRoomId = `cpu-${data.socketId}-${Date.now()}`;
    
    // Create a new room specifically for this CPU match
    const room = {
      id: cpuRoomId,
      players: [],
      readyCount: 0,
      rematchCount: 0,
      gameStart: false,
      gameOver: false,
      matchOver: false,
      readyStartTime: null,
      roundStartTimer: null,
      hakkiyoiCount: 0,
      teWoTsuiteSent: false, // Track if gyoji call was sent before HAKKIYOI
      isCPURoom: true, // Mark as CPU room
      playerAvailablePowerUps: {},
      playersSelectedPowerUps: {},
    };
    
    // Add the CPU room to the rooms array
    rooms.push(room);

    // Add human player as player 1
    socket.join(room.id);
    socket.roomId = room.id;

    room.players.push({
      id: data.socketId,
      fighter: "player 1",
      color: "aqua",
      mawashiColor: "#4169E1",
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
      // New grab action system states
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
      lastThrowAttemptTime: 0,
      lastGrabAttemptTime: 0,
      isStrafing: false,
      isBraking: false,
      isPowerSliding: false,
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
      dodgeDirection: false,
      dodgeEndTime: 0,
      isDodgeStartup: false,
      isDodgeRecovery: false,
      dodgeStartupEndTime: 0,
      dodgeRecoveryEndTime: 0,
      slapActiveEndTime: 0,
      chargedActiveEndTime: 0,
      isReady: false,
      isHit: false,
      isAlreadyHit: false,
      isParryKnockback: false,
      isDead: false,
      isBowing: false,
      facing: 1,
      stamina: 100,
      isGassed: false,
      gassedUntil: 0,
      x: 220,
      y: GROUND_LEVEL,
      knockbackVelocity: { x: 0, y: 0 },
      movementVelocity: 0,
      // Visual clarity timing states
      isInStartupFrames: false,
      startupEndTime: 0,
      isInEndlag: false,
      endlagEndTime: 0,
      attackCooldownUntil: 0,
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
      wins: [],
      bufferedAction: null,
      bufferExpiryTime: 0,
      wantsToRestartCharge: false,
      mouse1HeldDuringAttack: false,
      mouse1BufferedBeforeStart: false, // Buffer for mouse1 held before round start
      mouse1PressTime: 0, // Track when mouse1 was pressed for slap-vs-charge threshold
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
      inputBuffer: null,
      attackIntentTime: 0, // When mouse1 was pressed (for counter hit detection)
      attackAttemptTime: 0, // When attack execution started (for counter hit detection)
      isOverlapping: false,
      overlapStartTime: null,
      chargeCancelled: false,
      isGrabBreaking: false,
      isGrabBreakCountered: false,
      grabBreakSpaceConsumed: false,
      postGrabInputBuffer: false, // Buffer flag for frame-1 input activation after grab/throw ends
      isCounterGrabbed: false, // Set when grabbed while raw parrying - cannot grab break
    grabCounterAttempted: false, // True once the grabbed player has committed to a counter input
    grabCounterInput: null, // The key they committed to ('s', 'a', or 'd') — wrong guess = locked out
      isRingOutThrowCutscene: false,
      ringOutThrowDistance: 0,
      isRingOutFreezeActive: false,
      ringOutFreezeEndTime: 0,
      ringOutThrowDirection: null,
      inputLockUntil: 0,
      // Dohyo fall physics
      isFallingOffDohyo: false,
    });

    // Add CPU player as player 2 with unique ID tied to the room
    const cpuPlayerId = `CPU_${cpuRoomId}`;
    const cpuPlayer = createCPUPlayer(cpuPlayerId);
    room.players.push(cpuPlayer);
    room.cpuPlayerId = cpuPlayerId; // Store for cleanup
    
    // PERFORMANCE: Register both players in lookup maps
    registerPlayerInMaps(room.players[0], room);
    registerPlayerInMaps(cpuPlayer, room);

    // Emit success to the client
    socket.emit("cpu_match_created", {
      roomId: room.id,
      players: room.players,
    });

    // Update lobby
    io.in(room.id).emit("lobby", room.players);
    io.emit("rooms", getCleanedRoomsData(rooms));
  });

  socket.on("ready_count", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);
    if (roomIndex === -1) return; // Room not found

    const room = rooms[roomIndex];

    // Find the player in the room
    const playerIndex = room.players.findIndex(
      (player) => player.id === data.playerId
    );

    if (playerIndex === -1) return; // Player not found in room

    if (data.isReady) {
      // Only increment if player wasn't already ready
      if (!room.players[playerIndex].isReady) {
        room.players[playerIndex].isReady = true;
        room.readyCount++;

        // If this is a CPU room and human player just readied: assign CPU a random color (not the player's), then auto-ready CPU
        if (room.isCPURoom) {
          const cpuPlayer = room.players.find((p) => p.isCPU);
          const humanPlayer = room.players[playerIndex];
          if (cpuPlayer && !cpuPlayer.isReady) {
            const playerColor = humanPlayer.mawashiColor
              || (humanPlayer.color === "aqua" ? "#00FFFF" : humanPlayer.color);
            const availableColors = LOBBY_COLORS.filter(
              (c) => c.toLowerCase() !== (playerColor || "").toLowerCase()
            );
            const chosen = availableColors.length > 0
              ? availableColors[Math.floor(Math.random() * availableColors.length)]
              : "#D94848";
            cpuPlayer.mawashiColor = chosen;

            const humanBodyHex = (humanPlayer.bodyColor || "").toString().toLowerCase();
            const availableBodyColors = LOBBY_BODY_COLORS.filter(
              (c) => (c || "").toString().toLowerCase() !== humanBodyHex
            );
            cpuPlayer.bodyColor = availableBodyColors.length > 0
              ? availableBodyColors[Math.floor(Math.random() * availableBodyColors.length)]
              : null;

            cpuPlayer.isReady = true;
            room.readyCount++;
          }
        }
      }
    } else {
      // Only decrement if player was ready
      if (room.players[playerIndex].isReady) {
        room.readyCount--;
        room.players[playerIndex].isReady = false;
      }

      // If this is a CPU room and human player unreadied, also unready the CPU
      if (room.isCPURoom) {
        const cpuPlayer = room.players.find((p) => p.isCPU);
        if (cpuPlayer && cpuPlayer.isReady) {
          cpuPlayer.isReady = false;
          room.readyCount--;
        }
      }
    }

    // Ensure ready count doesn't go below 0
    room.readyCount = Math.max(0, room.readyCount);

    io.in(data.roomId).emit("ready_count", room.readyCount);
    io.in(data.roomId).emit("lobby", room.players);

    if (room.readyCount > 1) {
      // Mark this as the initial round - power-up selection will wait for pre_match_complete
      room.isInitialRound = true;
      // Send players with mawashiColor so client shows correct colors on PreMatchScreen (avoids race)
      const payload = {
        roomId: data.roomId,
        players: room.players.map((p) => ({
          id: p.id,
          fighter: p.fighter,
          mawashiColor: p.mawashiColor,
          bodyColor: p.bodyColor || null,
          isCPU: p.isCPU,
          wins: p.wins || [],
        })),
      };
      io.in(data.roomId).emit("initial_game_start", payload);
    }
  });

  // Client signals that pre-match screen is done - now start power-up selection
  socket.on("pre_match_complete", (data) => {
    const { roomId } = data;
    const room = rooms.find((r) => r.id === roomId);
    
    if (!room) return;
    
    // Only proceed if this is still the initial round
    if (room.isInitialRound) {
      room.isInitialRound = false; // No longer initial round
      handlePowerUpSelection(room, io);
    }
  });

  socket.on("request_power_up_selection_state", (data) => {
    const { roomId, playerId } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) {
      return;
    }

    const room = rooms[roomIndex];
    const player = room.players.find((p) => p.id === playerId);

    if (!player) {
      return;
    }

    // If we're in power-up selection phase, send the start event
    if (room.powerUpSelectionPhase && room.playerAvailablePowerUps[playerId]) {
      const availablePowerUps = room.playerAvailablePowerUps[playerId];

      io.to(playerId).emit("power_up_selection_start", {
        availablePowerUps: availablePowerUps,
      });

      // Also send current status
      const selectedCount = Object.keys(room.playersSelectedPowerUps).length;
      io.to(playerId).emit("power_up_selection_status", {
        selectedCount,
        totalPlayers: room.players.length,
        selections: room.playersSelectedPowerUps,
      });
    } else {
    }
  });

  socket.on("power_up_selected", (data) => {
    const { roomId, playerId, powerUpType } = data;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    const player = room.players.find((p) => p.id === playerId);

    if (!player || !room.powerUpSelectionPhase) return;

    // Store the player's power-up selection
    player.selectedPowerUp = powerUpType;
    room.playersSelectedPowerUps[playerId] = powerUpType;

    // IMMEDIATELY emit selection complete to THIS player only and start their transition
    // This allows each player to independently move to the next phase
    // Emit that selection is complete for THIS player only
    io.to(playerId).emit("power_up_selection_complete");
    
    // Start salt throwing for THIS player immediately
    handleSaltThrowAndPowerUp(player, room, io);

    // Check if both players have now selected
    const selectedCount = Object.keys(room.playersSelectedPowerUps).length;

    if (selectedCount === 2) {
      // Both players have selected, end selection phase and clear timer
      room.powerUpSelectionPhase = false;
      
      // Clear the auto-selection timer since both players have selected
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }

    }

    // Emit updated selection status to all players
    io.in(roomId).emit("power_up_selection_status", {
      selectedCount,
      totalPlayers: room.players.length,
      selections: room.playersSelectedPowerUps,
    });
  });

  socket.on("rematch_count", (data) => {
    const roomIndex = rooms.findIndex((room) => room.id === data.roomId);

    if (roomIndex === -1) return; // Room not found

    const room = rooms[roomIndex];

    if (data.acceptedRematch && data.playerId === socket.id) {
      room.rematchCount++;
      io.in(data.roomId).emit("rematch_count", room.rematchCount);

      // If this is a CPU room and human accepted rematch, auto-accept for CPU
      if (room.isCPURoom) {
        room.rematchCount++;
        io.in(data.roomId).emit("rematch_count", room.rematchCount);
      }
    } else if (!data.acceptedRematch && data.playerId === socket.id) {
      room.rematchCount--;
      io.in(data.roomId).emit("rematch_count", room.rematchCount);

      // If this is a CPU room and human declined, also decrement for CPU
      if (room.isCPURoom && room.rematchCount > 0) {
        room.rematchCount--;
        io.in(data.roomId).emit("rematch_count", room.rematchCount);
      }
    }

    if (room.rematchCount > 1) {
      room.matchOver = false;
      room.gameOver = true;
      room.rematchCount = 0;
      
      // Reset player wins for the new match
      room.players.forEach((player) => {
        player.wins = [];
      });
      
      io.in(data.roomId).emit("rematch_count", room.rematchCount);
      io.in(data.roomId).emit("rematch"); // Signal clients to reset win counts
    }
  });

  socket.on("fighter-select", (data) => {
    let roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return; // Room not found

    let playerIndex = rooms[roomIndex].players.findIndex(
      (player) => player.id === socket.id
    );

    if (playerIndex === -1) return; // Player not found

    rooms[roomIndex].players[playerIndex].fighter = data.fighter;
    // console.log(rooms[roomIndex].players[playerIndex]);

    io.in(roomId).emit("lobby", rooms[roomIndex].players); // Update all players in the room
    io.to(roomId).emit("rooms", rooms);
    // console.log(rooms[roomIndex].players);
  });

  socket.on("fighter_action", (data) => {
    let roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex === -1) return; // Room not found

    let playerIndex = rooms[roomIndex].players.findIndex(
      (player) => player.id === data.id
    );

    if (playerIndex === -1) return; // Player not found

    let player = rooms[roomIndex].players[playerIndex];
    let opponent = rooms[roomIndex].players.find((p) => p.id !== player.id);

    if (
      (rooms[roomIndex].gameOver && !rooms[roomIndex].matchOver) ||
      rooms[roomIndex].matchOver
    ) {
      return; // Skip all other actions if the game is over
    }

    // TACHIAI CHARGING: Track mouse1 for pre-round charging before blocking other inputs.
    // This lets players hold mouse1 during walk-to-ready and ready phases to build charge.
    // Must run BEFORE the canMoveToReady and pre-round input blocks below.
    if (!rooms[roomIndex].gameStart && data.keys) {
      const previousMouse1 = player.keys ? player.keys.mouse1 : false;
      player.keys = player.keys || {};
      player.keys.mouse1 = data.keys.mouse1 || false;

      if (!previousMouse1 && data.keys.mouse1) {
        player.mouse1PressTime = Date.now();
      }
      if (previousMouse1 && !data.keys.mouse1) {
        player.chargeAttackPower = 0;
        player.mouse1PressTime = 0;
        if (player.isChargingAttack) {
          player.isChargingAttack = false;
          player.chargeStartTime = 0;
          player.chargingFacingDirection = null;
          player.attackType = null;
        }
      }

      player.mouse1BufferedBeforeStart = data.keys.mouse1 || false;
    }

    // Block all actions if player is moving to ready position
    if (player.canMoveToReady) {
      return;
    }

    // Block all non-mouse1 inputs during pre-round phase
    if (!rooms[roomIndex].gameStart || rooms[roomIndex].hakkiyoiCount === 0) {
      return;
    }

    // Block all inputs during pumo army spawning animation
    if (player.isSpawningPumoArmy) {
      return;
    }

    // Input lockout window: allow key state refresh but block actions
    if (player.inputLockUntil && Date.now() < player.inputLockUntil) {
      if (data.keys) {
        // Clear grabBreakSpaceConsumed if spacebar was released during input lock,
        // so raw parry isn't blocked after the lock expires
        if (!data.keys[" "] && player.keys[" "] && player.grabBreakSpaceConsumed) {
          player.grabBreakSpaceConsumed = false;
        }
        // Track mouse1 press/release timing during lock so charging can begin
        // immediately when the lock expires (inputs are READ, not acted on)
        const prevMouse1 = player.keys.mouse1;
        const prevMouse2 = player.keys.mouse2;
        const prevSpace = player.keys[" "];
        const prevShift = player.keys.shift;
        if (!prevMouse1 && data.keys.mouse1) {
          // mouse1 just pressed during lock — record press time
          player.mouse1PressTime = Date.now();
        } else if (prevMouse1 && !data.keys.mouse1) {
          // mouse1 released during lock — clear press time
          player.mouse1PressTime = 0;
        }
        player.keys = data.keys;

        // Buffer inputs during lockout so they fire on frame 1 when lock expires
        if (!prevSpace && data.keys[" "]) {
          player.inputBuffer = { type: "rawParry", timestamp: Date.now() };
        } else if (!prevShift && data.keys.shift && !data.keys.mouse2) {
          player.inputBuffer = { type: "dodge", timestamp: Date.now() };
        } else if (!prevMouse1 && data.keys.mouse1) {
          player.inputBuffer = { type: "slap", timestamp: Date.now() };
        } else if (!prevMouse2 && data.keys.mouse2) {
          player.inputBuffer = { type: "grab", timestamp: Date.now() };
        }
      }
      return;
    }

    // Block ALL inputs while grab movement is active
    if (player.isGrabbingMovement) {
      // Only allow key state updates for grab movement, but block all other actions
      if (data.keys) {
        player.keys = data.keys;
      }
      return;
    }

    // Debug data.keys during grab clashing
    if (player.isGrabClashing) {
    }

    // Count inputs during grab clash - HAPPENS BEFORE BLOCKING
    if (player.isGrabClashing && rooms[roomIndex].grabClashData && data.keys) {
      // Track previous keys for input detection - get from player state
      const previousKeys = { ...player.keys };

      // Update player keys FIRST so next event can detect changes
      player.keys = data.keys;

      // Count any key press (not key holds) as mashing input
      const mashKeys = [
        "w",
        "a",
        "s",
        "d",
        "mouse1",
        "mouse2",
        "e",
        "f",
        "shift",
      ];
      let inputDetected = false;
      let detectedKey = null;

      for (const key of mashKeys) {
        if (data.keys[key] && !previousKeys[key]) {
          inputDetected = true;
          detectedKey = key;
          break;
        }
      }

      if (inputDetected) {
        player.grabClashInputCount++;

        // Update room clash data
        if (player.id === rooms[roomIndex].grabClashData.player1Id) {
          rooms[roomIndex].grabClashData.player1Inputs++;
        } else if (player.id === rooms[roomIndex].grabClashData.player2Id) {
          rooms[roomIndex].grabClashData.player2Inputs++;
        }

        // Emit progress update to all players in the room
        io.in(roomId).emit("grab_clash_progress", {
          player1Inputs: rooms[roomIndex].grabClashData.player1Inputs,
          player2Inputs: rooms[roomIndex].grabClashData.player2Inputs,
          player1Id: rooms[roomIndex].grabClashData.player1Id,
          player2Id: rooms[roomIndex].grabClashData.player2Id,
        });

      }
    }

    // Block all actions (except input counting) during grab clashing
    if (player.isGrabClashing) {
      return;
    }

    // If room is in hitstop, buffer key states but block actions for both players
    if (isRoomInHitstop(rooms[roomIndex])) {
      if (data.keys) {
        const prevKeys = { ...player.keys };
        player.keys = data.keys;

        // Buffer inputs during hitstop so they fire on frame 1 when hitstop ends
        if (!prevKeys[" "] && data.keys[" "]) {
          player.inputBuffer = { type: "rawParry", timestamp: Date.now() };
        } else if (!prevKeys.shift && data.keys.shift && !data.keys.mouse2) {
          player.inputBuffer = { type: "dodge", timestamp: Date.now() };
        } else if (!prevKeys.mouse1 && data.keys.mouse1) {
          player.inputBuffer = { type: "slap", timestamp: Date.now() };
        } else if (!prevKeys.mouse2 && data.keys.mouse2) {
          player.inputBuffer = { type: "grab", timestamp: Date.now() };
        }
      }
      return;
    }

    // Helper function to check if player is in a charged attack execution state
    const isInChargedAttackExecution = () => {
      return player.isAttacking && player.attackType === "charged";
    };

    // Helper function to check if an action should be blocked
    // allowDodgeCancelRecovery: allows dodge to cancel recovery state
    // allowChargingDuringDodge: allows starting/continuing charged attack during dodge
    const shouldBlockAction = (allowDodgeCancelRecovery = false, allowChargingDuringDodge = false) => {
      // Global action lock gate to serialize actions visually/feel-wise
      if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
        return true;
      }
      // Always block during charged attack execution
      if (isInChargedAttackExecution()) {
        return true;
      }
      // Block during dodge - unless allowChargingDuringDodge is true (charging can happen during dodge)
      if (player.isDodging && !allowChargingDuringDodge) {
        return true;
      }
      // Block during grab break animation, separation, and new grab action states
      if (player.isGrabBreaking || player.isGrabBreakCountered || player.isGrabBreakSeparating ||
          player.isGrabSeparating || player.isBeingPullReversaled ||
          player.isGrabBellyFlopping || player.isBeingGrabBellyFlopped ||
          player.isGrabFrontalForceOut || player.isBeingGrabFrontalForceOut) {
        return true;
      }
      // Block during recovery unless it's a dodge and dodge cancel is allowed
      if (
        player.isRecovering &&
        !(allowDodgeCancelRecovery && data.keys && data.keys.shift)
      ) {
        return true;
      }
      // Block all actions when at the ropes
      if (player.isAtTheRopes) {
        return true;
      }
      return false;
    };

    if (data.keys) {
      // Track mouse1 state changes for slap/charge dual-purpose input
      const previousMouse1State = player.keys.mouse1;
      const previousMouse2State = player.keys.mouse2;
      const previousKeys = { ...player.keys };
      player.keys = data.keys;

      // Set mouse1 press flags
      player.mouse1JustPressed = !previousMouse1State && data.keys.mouse1;
      player.mouse1JustReleased = previousMouse1State && !data.keys.mouse1;
      
      // Set mouse2 press flags (mouse2 = grab now)
      player.mouse2JustPressed = !previousMouse2State && data.keys.mouse2;
      player.mouse2JustReleased = previousMouse2State && !data.keys.mouse2;
      
      // Track attack intent time when mouse1 is pressed (for counter hit detection)
      // This captures the moment the player tries to attack, even before the attack executes
      if (player.mouse1JustPressed) {
        player.attackIntentTime = Date.now();
        // Record press time for slap-vs-charge threshold detection
        player.mouse1PressTime = Date.now();
      }
      
      // Track "just pressed" state for all action keys to prevent actions from triggering
      // when keys are held through other actions (e.g., holding E during dodge then grabbing after)
      player.shiftJustPressed = !previousKeys.shift && data.keys.shift;
      player.eJustPressed = !previousKeys.e && data.keys.e;
      player.wJustPressed = !previousKeys.w && data.keys.w;
      player.fJustPressed = !previousKeys.f && data.keys.f;
      player.spaceJustPressed = !previousKeys[" "] && data.keys[" "];

      // POST-GRAB INPUT BUFFER: After a grab/throw ends, treat held keys as "just pressed"
      // for one cycle. This enables frame-1 activation of grab (mouse2) which has complex
      // initiation code with nested timeouts that must run through the normal input path.
      // Raw parry, slap, dodge, and charge are handled directly in activateBufferedInputAfterGrab().
      if (player.postGrabInputBuffer) {
        if (data.keys.mouse2 && !player.mouse2JustPressed) player.mouse2JustPressed = true;
        player.postGrabInputBuffer = false;
      }

      // Buffer inputs when shouldBlockAction() prevents execution.
      // The game loop processes the buffer on the first actionable frame.
      if (shouldBlockAction()) {
        if (player.spaceJustPressed) {
          player.inputBuffer = { type: "rawParry", timestamp: Date.now() };
        } else if (player.shiftJustPressed && !data.keys.mouse2) {
          player.inputBuffer = { type: "dodge", timestamp: Date.now() };
        } else if (player.mouse1JustPressed) {
          player.inputBuffer = { type: "slap", timestamp: Date.now() };
        } else if (player.mouse2JustPressed) {
          player.inputBuffer = { type: "grab", timestamp: Date.now() };
        }
      }

      // Track mouse1 held during recovery from a connected charged attack
      // This catches the case where player re-presses mouse1 AFTER processHit ran
      // (e.g., mouse1 re-press event arrived after the hit was processed)
      if (player.keys.mouse1 && player.isRecovering && player.chargedAttackHit) {
        player.mouse1HeldDuringAttack = true;
        if (!player.mouse1PressTime) {
          player.mouse1PressTime = Date.now();
        }
      }

      // Debug logging for F key and snowball power-up
      if (data.keys.f) {
      }

      // ============================================
      // DIRECTIONAL GRAB BREAK SYSTEM
      // Spacebar grab break removed. Grab breaks now happen through
      // directional counter-inputs during specific grab action windows:
      // - Pull reversal (backward): counter with opposite direction
      // - Throw (W): counter with S key
      // - Forward push: cannot be broken, only slowed
      // Counter-input checks are handled in the grab action sections below.
      // ============================================
    }

    // MOUSE1 PRESS: Fire slap immediately for responsive poke
    // Charging starts later if mouse1 is held past the slap cycle (TAP-style)
    if (player.mouse1JustPressed && !shouldBlockAction()) {
      if (canPlayerSlap(player)) {
        executeSlapAttack(player, rooms);
      } else if (player.isAttacking && player.attackType === "slap") {
        const attackElapsed = Date.now() - player.attackStartTime;
        const attackDuration = player.attackEndTime - player.attackStartTime;
        const attackProgress = attackElapsed / attackDuration;
        if (attackProgress >= 0.20 && !player.hasPendingSlapAttack) {
          player.hasPendingSlapAttack = true;
        }
      }
    }

    // MOUSE1 RELEASE: Release charged attack (if charging)
    if (player.mouse1JustReleased) {
      if (player.isChargingAttack) {
        if (
          !player.isGrabbing &&
          !player.isBeingGrabbed &&
          !player.isThrowing &&
          !player.isBeingThrown &&
          !player.isThrowingSnowball
        ) {
          if (player.isDodging) {
            player.pendingChargeAttack = {
              power: player.chargeAttackPower,
              startTime: player.chargeStartTime,
              type: "charged",
            };
            player.spacebarReleasedDuringDodge = true;
          } else if (!shouldBlockAction()) {
            executeChargedAttack(player, player.chargeAttackPower, rooms);
          }
        }
        if (player.isChargingAttack) {
          player.isChargingAttack = false;
          player.chargeStartTime = 0;
          player.chargeAttackPower = 0;
          player.chargingFacingDirection = null;
          player.attackType = null;
          player.mouse1HeldDuringAttack = false;
        }
      }
      // TAP-style: releasing mouse1 zeroes preserved charge, UNLESS a charged
      // attack was just executed (executeChargedAttack sets chargeAttackPower
      // to the attack's power level for processHit to read on the next tick).
      if (!(player.isAttacking && player.attackType === "charged")) {
        player.chargeAttackPower = 0;
      }
      player.mouse1PressTime = 0;
      player.wantsToRestartCharge = false;
      player.mouse1HeldDuringAttack = false;
    }

    // Handle clearing charge during charging phase with throw/grab/snowball - MUST BE FIRST
    // Use "just pressed" to prevent charge cancellation when keys are held through other states
    // Block during dodge - only charging should continue during dodge, no other actions
    if (
      ((player.wJustPressed && player.isGrabbing && !player.isBeingGrabbed) ||
        player.mouse2JustPressed ||
        player.fJustPressed) &&
      player.isChargingAttack && // Only interrupt during charging phase, not execution
      !player.isDodging // Block during dodge - charging continues but no actions can interrupt
    ) {
      // Clear charge state
      clearChargeState(player);

      // The existing input handlers will take over for W/E/F
    }

    if (
      false && // Disabled: power-ups are now selected via UI
      player.keys.f &&
      !player.saltCooldown &&
      ((player.fighter === "player 1" && player.x <= 280) ||
        (player.fighter === "player 2" && player.x >= 765)) && // Adjusted range for player 2
      rooms[roomIndex].gameStart === false &&
      !player.activePowerUp
    ) {
      player.isThrowingSalt = true;
      player.saltCooldown = true;

      // Randomly select a power-up
      const powerUpTypes = Object.values(POWER_UP_TYPES);
      const randomPowerUp =
        powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      player.activePowerUp = randomPowerUp;
      player.powerUpMultiplier = POWER_UP_EFFECTS[randomPowerUp];

      // Emit power-up event to clients
      io.in(roomId).emit("power_up_activated", {
        playerId: player.id,
        powerUpType: randomPowerUp,
      });

      setPlayerTimeout(
        player.id,
        () => {
          player.isThrowingSalt = false;
        },
        1483,
        "throwingSaltReset"
      );

      setPlayerTimeout(
        player.id,
        () => {
          player.saltCooldown = false;
        },
        1733,
        "saltCooldownReset"
      );
    }

    // Handle F key power-ups (snowball and pumo army) - block during charged attack execution and recovery
    // Use fJustPressed to prevent power-ups from triggering when key is held through other actions
    if (
      player.fJustPressed &&
      !shouldBlockAction() &&
      (player.activePowerUp === POWER_UP_TYPES.SNOWBALL ||
        player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) &&
      (player.activePowerUp !== POWER_UP_TYPES.SNOWBALL ||
        (player.snowballThrowsRemaining ?? 3) > 0) &&
      !player.snowballCooldown &&
      !player.pumoArmyCooldown &&
      !player.isThrowingSnowball &&
      !player.isSpawningPumoArmy &&
      !player.isAttacking &&
      !player.isDodging &&
      !player.isThrowing &&
      !player.isBeingThrown &&
      !player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.isHit &&
      !player.isRawParryStun &&
      !player.isRawParrying &&
      !player.canMoveToReady
    ) {
      // Clear charge attack state if player was charging
      if (player.isChargingAttack) {
        clearChargeState(player);
      }

      if (player.activePowerUp === POWER_UP_TYPES.SNOWBALL) {
        // Backfill for older in-progress states where this field may be missing.
        if (player.snowballThrowsRemaining == null) {
          player.snowballThrowsRemaining = 3;
        }
        if (player.snowballThrowsRemaining <= 0) {
          return;
        }

        // Snowball costs same stamina as a slap attack
        player.stamina = Math.max(0, player.stamina - SLAP_ATTACK_STAMINA_COST);
        player.snowballThrowsRemaining = Math.max(
          0,
          player.snowballThrowsRemaining - 1
        );
        // Set throwing state
        player.isThrowingSnowball = true;
        // Lock actions during throw windup/animation window for visual clarity
        player.currentAction = "snowball";
        player.actionLockUntil = Date.now() + 250;

        // Determine snowball direction based on current position relative to opponent
        const opponent = rooms[roomIndex].players.find(
          (p) => p.id !== player.id
        );
        let snowballDirection;
        if (opponent) {
          // Throw towards the opponent based on current positions
          snowballDirection = player.x < opponent.x ? 2 : -2;
        } else {
          // Fallback to facing direction if no opponent found
          snowballDirection = player.facing === 1 ? -2 : 2;
        }

        // Create snowball projectile
        const snowball = {
          id: Math.random().toString(36).substr(2, 9),
          x: player.x,
          y: player.y + 20, // Slightly above ground
          velocityX: snowballDirection, // Direction determined by position relative to opponent
          hasHit: false,
          ownerId: player.id,
        };

        player.snowballs.push(snowball);
        player.snowballCooldown = true;

        // Reset throwing state after animation
        setPlayerTimeout(
          player.id,
          () => {
            player.isThrowingSnowball = false;
            // Clear lock if it’s still set
            if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
              player.actionLockUntil = 0;
            }

            // Check if we should restart charging after snowball throw completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          },
          500
        );
      } else if (player.activePowerUp === POWER_UP_TYPES.PUMO_ARMY) {
        // Pumo army costs same stamina as a charged attack
        player.stamina = Math.max(0, player.stamina - CHARGED_ATTACK_STAMINA_COST);
        // Set spawning state
        player.isSpawningPumoArmy = true;
        player.currentAction = "pumo_army";
        player.actionLockUntil = Date.now() + 400;

        // Clear any existing movement momentum to prevent sliding during animation
        player.movementVelocity = 0;
        player.isStrafing = false;

        // Determine army direction (same as player facing)
        const armyDirection = player.facing === 1 ? -1 : 1; // Army moves in direction player is facing

        // Spawn multiple mini clones sequentially
        const numClones = 3;
        const spawnDelay = 1000; // 1 second between spawns
        const startX = armyDirection === 1 ? -100 : 1200; // Start from off-screen (outside visible dohyo)

        // Spawn clones one at a time with delays
        for (let i = 0; i < numClones; i++) {
          setPlayerTimeout(
            player.id,
            () => {
              const clone = {
                id: Math.random().toString(36).substr(2, 9),
                x: startX,
                y: GROUND_LEVEL - DOHYO_FALL_DEPTH, // Start at dohyo fall depth (off the dohyo)
                velocityX: armyDirection * 1.5, // Speed of movement
                facing: armyDirection, // Face the direction they're moving (1 = right, -1 = left)
                isStrafing: true, // Use strafing animation
                isSlapAttacking: true, // Keep for combat functionality
                slapCooldown: 0,
                lastSlapTime: 0,
                spawnTime: Date.now(),
                lifespan: 10000, // 10 seconds lifespan (enough time to cross entire screen)
                ownerId: player.id,
                ownerFighter: player.fighter, // Add fighter type for image selection
                hasHit: false,
                size: 0.6, // Smaller than normal players
              };
              player.pumoArmy.push(clone);

            },
            i * spawnDelay
          );
        }

        player.pumoArmyCooldown = true;

        // Reset spawning state after animation
        setPlayerTimeout(
          player.id,
          () => {
            player.isSpawningPumoArmy = false;
            if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
              player.actionLockUntil = 0;
            }

            // Check if we should restart charging after pumo army spawn completes
            if (shouldRestartCharging(player)) {
              // Restart charging immediately
              startCharging(player);
            }
          },
          800
        );
      }
    }

    // Handle dash - allow canceling recovery but block during charged attack execution
    // Dashing now costs stamina (15% of max) instead of using charges
    // Use shiftJustPressed to prevent dash from triggering when key is held through other actions
    // NOTE: Dash cancels charging - clearing charge state when dash starts
    if (
      player.shiftJustPressed &&
      !player.keys.mouse2 && // Don't dash while grabbing
      !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
      !player.isBeingGrabbed && // Block dash when being grabbed
      !isInChargedAttackExecution() && // Block during charged attack execution
      canPlayerDash(player) &&
      !player.isGassed
    ) {
      // Allow dodge to cancel recovery
      if (player.isRecovering) {
        // Add grace period - don't allow dodge to cancel recovery for 100ms after it starts
        // This prevents immediate dodge from canceling recovery that was just set
        const recoveryAge = Date.now() - player.recoveryStartTime;
        if (recoveryAge > 100) {
          player.isRecovering = false;
          player.movementVelocity = 0;
          player.recoveryDirection = null;
        } else {
          return; // Don't execute dodge if recovery is too fresh
        }
      }

      // Clear parry success state when starting a dodge
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;

      // Dodge cancels charging - clear charge state
      clearChargeState(player, true);

      // Clear movement momentum for static dodge distance
      // Also cancels power slide - dodge is an escape option from slide
      player.movementVelocity = 0;
      player.isStrafing = false;
      player.isPowerSliding = false;
      player.isBraking = false;

      player.isDodging = true;
      player.isDodgeStartup = true;
      player.dodgeStartTime = Date.now();
      player.dodgeStartupEndTime = Date.now() + DODGE_STARTUP_MS;
      player.dodgeEndTime = Date.now() + DODGE_DURATION;
      player.dodgeStartX = player.x;
      player.currentAction = "dash";
      player.actionLockUntil = Date.now() + 100;
      player.justLandedFromDodge = false;

      player.stamina = Math.max(0, player.stamina - DODGE_STAMINA_COST);

      if (player.keys.a) {
        player.dodgeDirection = -1;
      } else if (player.keys.d) {
        player.dodgeDirection = 1;
      } else {
        player.dodgeDirection = player.facing === -1 ? 1 : -1;
      }

      // Dodge lifecycle (landing, recovery, cooldown) is handled entirely by the tick
      // loop in index.js. Pending charge attacks are executed when recovery ends.
    } else if (
      (player.shiftJustPressed || player.keys.shift) && // Buffer on press OR hold (catches spammers who end on held key)
      (player.isAttacking ||
        player.isThrowing ||
        player.isBeingThrown ||
        player.isGrabbing ||
        player.isBeingGrabbed) && // Allow buffering while being grabbed/thrown so spamming shift comes out frame 1 when freed
      !player.isDodging &&
      !player.isThrowingSnowball &&
      !player.isRawParrying &&
      !isInChargedAttackExecution() &&
      !player.isGassed
    ) {
      // Buffer the dodge action
      const dodgeDirection = player.keys.a
        ? -1
        : player.keys.d
        ? 1
        : player.facing === -1
        ? 1
        : -1;
      player.bufferedAction = {
        type: "dash",
        direction: dodgeDirection,
      };
      player.bufferExpiryTime = Date.now() + 500; // Buffer expires after 500ms
    }
    // Buffer dash during recovery/cooldown so spamming fires on frame 1 when allowed
    else if (
      player.shiftJustPressed &&
      !player.keys.mouse2 &&
      !player.isGassed &&
      !player.isDodging &&
      (player.isDodgeRecovery || (player.dodgeCooldownUntil && Date.now() < player.dodgeCooldownUntil))
    ) {
      player.inputBuffer = { type: "dodge", timestamp: Date.now() };
    }
    // Emit "No Stamina" feedback when player tries to dodge but doesn't have enough stamina
    else if (
      player.shiftJustPressed &&
      !player.keys.mouse2 &&
      !(player.keys.w && player.isGrabbing && !player.isBeingGrabbed) &&
      canPlayerDash(player) &&
      player.isGassed &&
      (!player.lastStaminaBlockedTime || Date.now() - player.lastStaminaBlockedTime > 500)
    ) {
      player.lastStaminaBlockedTime = Date.now();
      socket.emit("stamina_blocked", { playerId: player.id, action: "dash" });
    }

    // ── ROPE JUMP: W + forward key near map boundary ──
    // Escape over the opponent when cornered. Forward = away from nearest boundary.
    {
      const nearLeftBound = player.x - MAP_LEFT_BOUNDARY < ROPE_JUMP_BOUNDARY_ZONE;
      const nearRightBound = MAP_RIGHT_BOUNDARY - player.x < ROPE_JUMP_BOUNDARY_ZONE;
      const forwardHeld = (nearLeftBound && player.keys.d) || (nearRightBound && player.keys.a);
      const wantsRopeJump = player.keys.w && forwardHeld && (nearLeftBound || nearRightBound);

      if (
        wantsRopeJump &&
        !player.isRopeJumping &&
        canPlayerDash(player) &&
        !player.isGassed &&
        !isInChargedAttackExecution() &&
        !player.isBeingGrabbed &&
        rooms[roomIndex].gameStart &&
        !rooms[roomIndex].gameOver
      ) {
        clearChargeState(player, true);

        player.movementVelocity = 0;
        player.isStrafing = false;
        player.isPowerSliding = false;
        player.isBraking = false;

        const jumpDir = nearLeftBound ? 1 : -1;
        const mapMidpoint = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
        const targetX = player.x + (mapMidpoint - player.x) * 0.52;

        player.facing = nearLeftBound ? -1 : 1;
        player.isRopeJumping = true;
        player.ropeJumpPhase = "startup";
        player.ropeJumpStartTime = Date.now();
        player.ropeJumpStartX = player.x;
        player.ropeJumpTargetX = Math.max(MAP_LEFT_BOUNDARY, Math.min(targetX, MAP_RIGHT_BOUNDARY));
        player.ropeJumpDirection = jumpDir;
        player.ropeJumpActiveStartTime = 0;
        player.ropeJumpLandingTime = 0;
        player.currentAction = "ropeJump";
        player.actionLockUntil = Date.now() + ROPE_JUMP_STARTUP_MS;
        player.stamina = Math.max(0, player.stamina - ROPE_JUMP_STAMINA_COST);
      }
      // "Not enough stamina" feedback when gassed
      else if (
        wantsRopeJump &&
        !player.isRopeJumping &&
        canPlayerDash(player) &&
        player.isGassed &&
        (!player.lastStaminaBlockedTime || Date.now() - player.lastStaminaBlockedTime > 500)
      ) {
        player.lastStaminaBlockedTime = Date.now();
        socket.emit("stamina_blocked", { playerId: player.id, action: "ropeJump" });
      }
    }

    // MOUSE1 HOLD-TO-CHARGE: Start charging when mouse1 held and player is idle
    // Slap fires on press; charging only starts after slap cycle ends (via callback)
    // or when pressing mouse1 during dodge (TAP-style hidden charge)
    // Require 150ms minimum hold to prevent spam-tapping from accidentally triggering charge
    if (
      player.keys.mouse1 &&
      !player.isChargingAttack &&
      player.mouse1PressTime > 0 &&
      (Date.now() - player.mouse1PressTime) >= 150 &&
      !shouldBlockAction() &&
      canPlayerCharge(player) &&
      !player.mouse2JustPressed
    ) {
      startCharging(player);
      player.spacebarReleasedDuringDodge = false;
    }
    // For continuing a charge OR starting a charge during dodge
    else if (
      player.keys.mouse1 &&
      player.mouse1PressTime > 0 &&
      !shouldBlockAction(false, true) &&
      (player.isChargingAttack || player.isDodging) &&
      !player.isHit &&
      !player.isRawParryStun &&
      !player.isRawParrying &&
      !player.mouse2JustPressed
    ) {
      // If we're dodging and not already charging, start charging
      // Require 150ms minimum hold to prevent quick taps from accidentally starting a charge
      if (player.isDodging && !player.isChargingAttack && (Date.now() - player.mouse1PressTime) >= 150) {
        startCharging(player);
      }
      // Calculate charge power (0-100%)
      const chargeDuration = Date.now() - player.chargeStartTime;
      player.chargeAttackPower = Math.min((chargeDuration / CHARGE_FULL_POWER_MS) * 100, 100);

      // Lock facing direction while charging
      if (player.isThrowing || player.throwingFacingDirection !== null) {
        player.chargingFacingDirection = player.throwingFacingDirection;
      } else {
        player.chargingFacingDirection = player.facing;
      }

      if (player.chargingFacingDirection !== null) {
        player.facing = player.chargingFacingDirection;
      }
    }
    // Handle mouse1 held during active charged attack - wants to restart charge after
    if (
      player.keys.mouse1 &&
      player.isAttacking &&
      player.attackType === "charged"
    ) {
      player.wantsToRestartCharge = true;
      // Also track held-during-attack for reliable resume after recovery from connected hits
      player.mouse1HeldDuringAttack = true;
    }

    // Also check if mouse1 is being held when we're about to execute a charged attack
    if (
      player.keys.mouse1 &&
      player.pendingChargeAttack &&
      !player.isAttacking
    ) {
      player.wantsToRestartCharge = true;
    }

    // Clear charging state if mouse1 is released and charge wasn't executed
    // (charge release/slap is handled above in the mouse1JustReleased block)
    if (!player.keys.mouse1 && player.isChargingAttack) {
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;
      player.chargingFacingDirection = null;
      player.attackType = null;
      player.mouse1HeldDuringAttack = false;
    }
    // Safety: clear any stale preserved charge when mouse1 is not held
    // Catches edge cases where mouse1JustReleased event was missed
    if (!player.keys.mouse1 && !player.isChargingAttack && player.chargeAttackPower > 0 && !player.isAttacking) {
      player.chargeAttackPower = 0;
    }

    // NOTE: Continuous mouse1 charge check is also handled in the game loop
    // for when player holds mouse1 without sending new fighter_action events

    // Handle throw attacks - only during grab decision window (first 1s of grab)
    // Uses GRAB_ACTION_WINDOW (1s) and S-key counter by opponent
    if (
      player.keys.w &&
      player.isGrabbing &&
      !player.isBeingGrabbed &&
      !player.keys.mouse2 && // Don't throw while grab button held
      !shouldBlockAction() &&
      !player.isThrowingSalt &&
      !player.canMoveToReady &&
      !player.throwCooldown &&
      !player.isRawParrying &&
      !player.isJumping &&
      !player.isAttemptingGrabThrow &&  // Don't allow multiple throw attempts
      !player.isAttemptingPull           // Don't allow throw during pull
    ) {
      // Reset any lingering throw states before starting a new throw
      player.throwingFacingDirection = null;
      player.throwStartTime = 0;
      player.throwEndTime = 0;
      player.throwOpponent = null;

      player.lastThrowAttemptTime = Date.now();
      
      // Set attempting grab throw state - this triggers the animation
      player.isAttemptingGrabThrow = true;
      player.grabThrowAttemptStartTime = Date.now();
      player.grabActionType = "throw";
      player.grabActionStartTime = Date.now();
      player.grabDecisionMade = true; // Lock in the decision
      
      // Pause grab duration during throw attempt (action extends grab)
      player.grabDurationPaused = true;
      player.grabDurationPausedAt = Date.now();

      // Clear push states if transitioning from push (throw interrupts push)
      player.isGrabPushing = false;
      player.isEdgePushing = false;
      player.isGrabWalking = false;
      const throwOpponent = rooms[roomIndex].players.find((p) => p.id !== player.id);
      if (throwOpponent) {
        throwOpponent.isBeingGrabPushed = false;
        throwOpponent.isBeingEdgePushed = false;
        throwOpponent.lastGrabPushStaminaDrainTime = 0;
        // Reset opponent's counter state — they get a fresh read for each grab action
        throwOpponent.grabCounterAttempted = false;
        throwOpponent.grabCounterInput = null;
      }

      // Block all player inputs during the attempt
      player.actionLockUntil = Date.now() + GRAB_ACTION_WINDOW;

      setPlayerTimeout(
        player.id,
        () => {
          const opponent = rooms[roomIndex].players.find(
            (p) => p.id !== player.id
          );
          
          // Clear attempting state after the window
          player.isAttemptingGrabThrow = false;
          player.grabDurationPaused = false;
          player.grabActionType = null;
          player.grabActionStartTime = 0;
          player.grabDecisionMade = false;
          player.grabPushEndTime = 0;

          // CRITICAL: Check if grab break has already occurred
          if (player.isGrabBreakCountered || opponent.isGrabBreaking || opponent.isGrabBreakSeparating) {
            return;
          }

          // Also check if we're no longer in a valid grab state
          if (!player.isGrabbing && !player.isThrowing) {
            return;
          }

          // S-key counter check is done in the tick loop (throw attempt branch above).
          // If we reach here, opponent did NOT counter - execute the throw.
          if (
            isOpponentCloseEnoughForThrow(player, opponent) &&
            !opponent.isBeingThrown &&
            !opponent.isAttacking &&
            !opponent.isDodging
          ) {
            if (checkForGrabPriority(player, opponent)) {
              return;
            } else if (checkForThrowTech(player, opponent)) {
              applyThrowTech(player, opponent);
            } else if (!player.throwTechCooldown) {
              clearChargeState(player, true);

              player.movementVelocity = 0;
              player.isStrafing = false;

              const shouldFaceRight = player.x < opponent.x;
              player.facing = shouldFaceRight ? -1 : 1;
              player.throwingFacingDirection = player.facing;

              player.isThrowing = true;
              player.throwStartTime = Date.now();
              player.throwEndTime = Date.now() + 400;
              player.throwOpponent = opponent.id;
              player.currentAction = "throw";
              player.actionLockUntil = Date.now() + 200;
              
              clearAllActionStates(opponent);
              opponent.isBeingGrabbed = false;
              opponent.isBeingGrabPushed = false;
              opponent.isBeingEdgePushed = false;
              opponent.isBeingThrown = true;
              
              triggerHitstop(rooms[roomIndex], HITSTOP_THROW_MS);

              if (player.isGrabbing) {
                player.isGrabbing = false;
                player.grabbedOpponent = null;
              }

              player.throwCooldown = true;
              setPlayerTimeout(
                player.id,
                () => {
                  player.throwCooldown = false;
                  if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
                    player.actionLockUntil = 0;
                  }
                },
                250
              );
            }
          } else {
            if (checkForGrabPriority(player, opponent)) {
              return;
            }

            clearChargeState(player, true);

            const shouldFaceRight = player.x < opponent.x;
            player.facing = shouldFaceRight ? -1 : 1;
            player.throwingFacingDirection = player.facing;

            player.isThrowing = true;
            player.throwStartTime = Date.now();
            player.throwEndTime = Date.now() + 400;
            player.currentAction = "throw";
            player.actionLockUntil = Date.now() + 200;

            player.throwCooldown = true;
            setPlayerTimeout(
              player.id,
              () => {
                player.throwCooldown = false;
                if (player.actionLockUntil && Date.now() < player.actionLockUntil) {
                  player.actionLockUntil = 0;
                }
              },
              250
            );
          }
        },
        GRAB_ACTION_WINDOW  // 1 second window (was 500ms)
      );
    }

    // === PULL REVERSAL - Backward input during grab ===
    // NOTE: Primary pull initiation is in the push processing block (burst-decay push).
    // This input handler serves as a safety fallback for edge cases.
    if (
      player.isGrabbing &&
      player.grabbedOpponent &&
      !player.isBeingGrabbed &&
      !player.isAttemptingGrabThrow &&
      !player.isAttemptingPull &&
      !player.isGrabPushing &&          // Only fires if push somehow isn't active
      !shouldBlockAction()
    ) {
      // Determine backward key based on facing
      const backwardKey = player.facing === -1 ? 'a' : 'd';
      const forwardKey = player.facing === -1 ? 'd' : 'a';
      const isPressingBackward = player.keys[backwardKey] && !player.keys[forwardKey];

      // No grace period for backward — holding backward before grab is intentional (pull)
      if (isPressingBackward) {
        player.isAttemptingPull = true;
        player.grabActionStartTime = Date.now();
        player.grabActionType = "pull";
        player.grabDecisionMade = true; // Lock in the decision

        // Pause grab duration during pull attempt (action extends grab)
        player.grabDurationPaused = true;
        player.grabDurationPausedAt = Date.now();

        // Clear push states
        player.isGrabPushing = false;
        player.isEdgePushing = false;
        const pullOpponent = rooms[roomIndex].players.find((p) => p.id !== player.id);
        if (pullOpponent) {
          pullOpponent.isBeingGrabPushed = false;
          pullOpponent.isBeingEdgePushed = false;
          pullOpponent.lastGrabPushStaminaDrainTime = 0;
        }

        // Block grabber inputs during pull attempt
        player.actionLockUntil = Date.now() + GRAB_ACTION_WINDOW;

        setPlayerTimeout(
          player.id,
          () => {
            const opponent = rooms[roomIndex].players.find(
              (p) => p.id !== player.id
            );

            // Clear pull attempt state
            player.isAttemptingPull = false;
            player.grabDurationPaused = false;
            player.grabActionType = null;
            player.grabActionStartTime = 0;
            player.grabDecisionMade = false;
            player.grabPushEndTime = 0;

            // Check if grab break already happened
            if (player.isGrabBreakCountered || !opponent || opponent.isGrabBreaking || opponent.isGrabBreakSeparating) {
              return;
            }

            // Check if still in valid grab state
            if (!player.isGrabbing) {
              return;
            }

            // Counter check is done in the tick loop (pull attempt branch).
            // If we reach here, opponent did NOT counter - execute pull reversal!
            
            // Calculate pull reversal destination (other side of grabber)
            // Pull direction is opposite of current opponent position relative to grabber
            const pullDirection = opponent.x < player.x ? 1 : -1; // send to other side
            // Don't clamp targetX — let it overshoot so the tween handler detects boundary
            const targetX = player.x + pullDirection * PULL_REVERSAL_DISTANCE;

            // Release the grab (pull reversal ends the grab)
            cleanupGrabStates(player, opponent);

            // Set pull reversal state for animation
            opponent.isBeingPullReversaled = true;
            opponent.pullReversalPullerId = player.id; // Track who pulled us

            // Move opponent to target position via tween (longer duration for visible knockback)
            opponent.isGrabBreakSeparating = true;
            opponent.grabBreakSepStartTime = Date.now();
            opponent.grabBreakSepDuration = PULL_REVERSAL_TWEEN_DURATION;
            opponent.grabBreakStartX = opponent.x;
            opponent.grabBreakTargetX = targetX;

            // Zero out velocities
            opponent.movementVelocity = 0;
            player.movementVelocity = 0;
            opponent.isStrafing = false;
            player.isStrafing = false;

            // Lock both players equally (cleared early when tween ends or boundary hit)
            const pulledLockUntil = Date.now() + PULL_REVERSAL_PULLED_LOCK;
            opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, pulledLockUntil);
            const pullerLockUntil = Date.now() + PULL_REVERSAL_PULLER_LOCK;
            player.inputLockUntil = Math.max(player.inputLockUntil || 0, pullerLockUntil);

            // Correct facing after sides switch
            correctFacingAfterGrabOrThrow(player, opponent);

            // Note: isBeingPullReversaled is auto-cleared when the tween ends (in tick handler)

            // Grab cooldown
            player.grabCooldown = true;
            setPlayerTimeout(
              player.id,
              () => { player.grabCooldown = false; },
              300,
              "pullReversalCooldown"
            );

            // Emit for client VFX/SFX
            io.in(rooms[roomIndex].id).emit("pull_reversal", {
              grabberId: player.id,
              opponentId: opponent.id,
              grabberX: player.x,
              opponentTargetX: targetX,
            });
          },
          GRAB_ACTION_WINDOW  // 1 second window
        );
      }
    }

    // Handle grab attacks — instant grab with no forward movement
    // Use mouse2JustPressed to prevent grab from triggering when key is held through other actions
    if (
      player.mouse2JustPressed &&
      !shouldBlockAction() &&
      canPlayerUseAction(player) &&
      !player.grabCooldown &&
      !player.isPushing &&
      !player.isBeingPushed &&
      !player.grabbedOpponent &&
      !player.isRawParrying &&
      !player.isJumping &&
      !player.isGrabbingMovement &&
      !player.isWhiffingGrab &&
      !player.isGrabWhiffRecovery &&
      !player.isGrabTeching &&
      !player.isGrabStartup
    ) {
      player.lastGrabAttemptTime = Date.now();

      // Clear parry success state when starting a grab
      player.isRawParrySuccess = false;
      player.isPerfectRawParrySuccess = false;

      // Clear charging attack state when starting grab
      clearChargeState(player, true); // true = cancelled by grab

      // Reset hit absorption for thick blubber power-up when starting grab (like charged attack)
      if (player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER) {
        player.hitAbsorptionUsed = false;
      }

      // Begin startup with forward lunge — tick loop applies lunge movement,
      // then does range check at the end → connect / whiff / tech
      player.isGrabStartup = true;
      player.grabStartupStartTime = Date.now();
      player.grabStartupDuration = GRAB_STARTUP_DURATION_MS;
      player.currentAction = "grab_startup";
      player.actionLockUntil = Date.now() + GRAB_STARTUP_DURATION_MS;
      player.grabState = GRAB_STATES.ATTEMPTING;
      player.grabAttemptType = "grab";

      // Capture approach speed BEFORE clearing momentum (for momentum-transferred push)
      player.grabApproachSpeed = Math.abs(player.movementVelocity);

      // Clear any existing movement momentum
      player.movementVelocity = 0;
      player.isStrafing = false;
      // Cancel power slide when grabbing
      player.isPowerSliding = false;

      // No movement timeout needed — startup tick block handles connect/whiff/tech instantly
    }
  });

  // TEST EVENT - Force opponent disconnection (for debugging)
  socket.on("test_force_disconnect", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      rooms[roomIndex].opponentDisconnected = true;
      rooms[roomIndex].disconnectedDuringGame = true;

      // Emit to all players in room
      io.in(roomId).emit("opponent_disconnected", {
        roomId: roomId,
        message: "Opponent disconnected (TEST)",
      });

      // Emit updated rooms
      io.emit("rooms", getCleanedRoomsData(rooms));
    }
  });

  socket.on("exit_disconnected_game", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1 && rooms[roomIndex].opponentDisconnected) {
      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (rooms[roomIndex].roundStartTimer) {
        clearTimeout(rooms[roomIndex].roundStartTimer);
        rooms[roomIndex].roundStartTimer = null;
      }

      // PERFORMANCE: Unregister from lookup maps before removal
      unregisterPlayerFromMaps(socket.id);
      
      // Remove the player from the room
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );

      // Reset the room to its initial state since this was the last player
      rooms[roomIndex].opponentDisconnected = false;
      rooms[roomIndex].disconnectedDuringGame = false;
      rooms[roomIndex].gameStart = false;
      rooms[roomIndex].gameOver = false;
      rooms[roomIndex].matchOver = false;
      rooms[roomIndex].hakkiyoiCount = 0;
      rooms[roomIndex].readyCount = 0;
      rooms[roomIndex].rematchCount = 0;
      rooms[roomIndex].readyStartTime = null;
      rooms[roomIndex].powerUpSelectionPhase = false;
      delete rooms[roomIndex].winnerId;
      delete rooms[roomIndex].loserId;
      delete rooms[roomIndex].gameOverTime;
      delete rooms[roomIndex].playersSelectedPowerUps;
      delete rooms[roomIndex].playerAvailablePowerUps;

      // Clean up the room state
      cleanupRoomState(rooms[roomIndex]);
      // PERFORMANCE: Free cloned player state objects to prevent memory leak
      rooms[roomIndex].previousPlayerStates = [null, null];

      // Emit updated room data to all clients
      io.emit("rooms", getCleanedRoomsData(rooms));

      // Confirm exit to the player
      socket.emit("exit_game_confirmed", { roomId: roomId });

      // Leave the socket room
      socket.leave(roomId);
    }
  });

  socket.on("leave_room", (data) => {
    const roomId = data.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      const room = rooms[roomIndex];

      // Clean up timeouts for the leaving player
      timeoutManager.clearPlayer(socket.id);

      // Clear any active round start timer to prevent interference
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }

      // Handle CPU room cleanup - REMOVE the room entirely when human leaves
      if (room.isCPURoom) {
        // Clear CPU player timeouts and AI state using the stored unique ID
        const cpuPlayerId = room.cpuPlayerId || "CPU_PLAYER";
        timeoutManager.clearPlayer(cpuPlayerId);
        clearAIState(cpuPlayerId);

        // Leave the socket room
        socket.leave(roomId);
        delete socket.roomId;

        // Remove the CPU room from the rooms array entirely
        rooms.splice(roomIndex, 1);

        // Emit updated room list
        io.emit("rooms", getCleanedRoomsData(rooms));
        return;
      }

      // Check if we're leaving during an active game session (not just lobby)
      // Active game session includes: power-up selection, salt throwing, ready positioning, actual gameplay, and winner declaration
      const isInGameSession =
        rooms[roomIndex].powerUpSelectionPhase ||
        rooms[roomIndex].gameStart ||
        rooms[roomIndex].gameOver ||
        rooms[roomIndex].hakkiyoiCount > 0 ||
        rooms[roomIndex].players.some(
          (p) =>
            p.isThrowingSalt ||
            (p.canMoveToReady === false &&
              (rooms[roomIndex].gameStart ||
                rooms[roomIndex].powerUpSelectionPhase))
        );

      const hadTwoPlayers = rooms[roomIndex].players.length === 2;

      // PERFORMANCE: Unregister from lookup maps before removal
      unregisterPlayerFromMaps(socket.id);
      
      // Remove the player from the room
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );
      // PERFORMANCE: Free cloned player state objects to prevent memory leak
      rooms[roomIndex].previousPlayerStates = [null, null];

      // Handle opponent disconnection during active game session
      if (
        isInGameSession &&
        hadTwoPlayers &&
        rooms[roomIndex].players.length === 1
      ) {
        rooms[roomIndex].opponentDisconnected = true;
        rooms[roomIndex].disconnectedDuringGame = true;

        // Emit opponent disconnected event to the remaining player
        const remainingPlayer = rooms[roomIndex].players[0];
        io.to(remainingPlayer.id).emit("opponent_disconnected", {
          roomId: roomId,
          message: "Opponent disconnected",
        });

        // Emit rooms data after a small delay to ensure client processes the disconnection event first
        setTimeout(() => {
          io.emit("rooms", getCleanedRoomsData(rooms));
        }, 100);
      }
      // If the remaining player from a disconnected game is leaving, reset the room
      else if (
        rooms[roomIndex].opponentDisconnected &&
        rooms[roomIndex].players.length === 0
      ) {
        rooms[roomIndex].opponentDisconnected = false;
        rooms[roomIndex].disconnectedDuringGame = false;
        rooms[roomIndex].gameStart = false;
        rooms[roomIndex].gameOver = false;
        rooms[roomIndex].matchOver = false;
        rooms[roomIndex].hakkiyoiCount = 0;
        rooms[roomIndex].readyCount = 0;
        rooms[roomIndex].rematchCount = 0;
        rooms[roomIndex].readyStartTime = null;
        rooms[roomIndex].powerUpSelectionPhase = false;
        delete rooms[roomIndex].winnerId;
        delete rooms[roomIndex].loserId;
        delete rooms[roomIndex].gameOverTime;
        delete rooms[roomIndex].playersSelectedPowerUps;
        delete rooms[roomIndex].playerAvailablePowerUps;

        // Clear any remaining round start timer
        if (rooms[roomIndex].roundStartTimer) {
          clearTimeout(rooms[roomIndex].roundStartTimer);
          rooms[roomIndex].roundStartTimer = null;
        }

        // Clean up the room state
        cleanupRoomState(rooms[roomIndex]);
      }
      // Normal lobby leave - reset ready states
      else {
        // Reset ready count and player ready states
        rooms[roomIndex].readyCount = 0;
        rooms[roomIndex].players.forEach((player) => {
          player.isReady = false;
        });

        // Clean up the room state (includes power-up selection state)
        cleanupRoomState(rooms[roomIndex]);
      }

      // If there's only one player left and not in disconnected state, reset their state completely
      if (
        rooms[roomIndex].players.length === 1 &&
        !rooms[roomIndex].opponentDisconnected
      ) {
        const p = rooms[roomIndex].players[0];
        // Reset to player 1 position and appearance
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 245;
        p.facing = 1;
        // Clean up any player-specific state
        cleanupPlayerStates(p);
      }

      // Emit updates to all clients (only if not in disconnected state)
      if (!rooms[roomIndex].opponentDisconnected) {
        io.in(roomId).emit("player_left");
        io.in(roomId).emit("ready_count", rooms[roomIndex].readyCount);
        io.to(roomId).emit("lobby", rooms[roomIndex].players);
      }

      // Only emit rooms data immediately if not in disconnected state (delayed emit handles disconnected case)
      if (!rooms[roomIndex].opponentDisconnected) {
        io.emit("rooms", getCleanedRoomsData(rooms));
      }

      // Leave the socket room
      socket.leave(roomId);
    }
  });

  socket.on("disconnect", (reason) => {
    const roomId = socket.roomId;
    const roomIndex = rooms.findIndex((room) => room.id === roomId);

    // Clean up timeouts for the disconnecting player
    timeoutManager.clearPlayer(socket.id);

    if (rooms[roomIndex]) {
      const room = rooms[roomIndex];

      // Clear any active round start timer to prevent interference
      if (room.roundStartTimer) {
        clearTimeout(room.roundStartTimer);
        room.roundStartTimer = null;
      }

      // Handle CPU room cleanup - REMOVE the room entirely when human disconnects
      if (room.isCPURoom) {
        // Clear CPU player timeouts and AI state using the stored unique ID
        const cpuPlayerId = room.cpuPlayerId || "CPU_PLAYER";
        timeoutManager.clearPlayer(cpuPlayerId);
        clearAIState(cpuPlayerId);

        // Remove the CPU room from the rooms array entirely
        rooms.splice(roomIndex, 1);

        // Emit updated room list
        io.emit("rooms", getCleanedRoomsData(rooms));
        return;
      }

      // Check if we're disconnecting during an active game session (not just lobby)
      // Active game session includes: power-up selection, salt throwing, ready positioning, actual gameplay, and winner declaration
      const isInGameSession =
        rooms[roomIndex].powerUpSelectionPhase ||
        rooms[roomIndex].gameStart ||
        rooms[roomIndex].gameOver ||
        rooms[roomIndex].hakkiyoiCount > 0 ||
        rooms[roomIndex].players.some(
          (p) =>
            p.isThrowingSalt ||
            (p.canMoveToReady === false &&
              (rooms[roomIndex].gameStart ||
                rooms[roomIndex].powerUpSelectionPhase))
        );

      const hadTwoPlayers = rooms[roomIndex].players.length === 2;

      // Clean up player references
      const playerIndex = rooms[roomIndex].players.findIndex(
        (p) => p.id === socket.id
      );
      if (playerIndex !== -1) {
        const player = rooms[roomIndex].players[playerIndex];

        // Clean up all player references
        cleanupPlayerStates(player);

        // Clean up opponent references
        const opponent = rooms[roomIndex].players.find(
          (p) => p.id !== player.id
        );
        cleanupOpponentStates(opponent);
      }

      // PERFORMANCE: Unregister from lookup maps before removal
      unregisterPlayerFromMaps(socket.id);
      
      // Remove the player
      rooms[roomIndex].players = rooms[roomIndex].players.filter(
        (player) => player.id !== socket.id
      );
      // PERFORMANCE: Free cloned player state objects to prevent memory leak
      rooms[roomIndex].previousPlayerStates = [null, null];

      // Handle opponent disconnection during active game session
      if (
        isInGameSession &&
        hadTwoPlayers &&
        rooms[roomIndex].players.length === 1
      ) {
        rooms[roomIndex].opponentDisconnected = true;
        rooms[roomIndex].disconnectedDuringGame = true;

        // Emit opponent disconnected event to the remaining player
        const remainingPlayer = rooms[roomIndex].players[0];
        io.to(remainingPlayer.id).emit("opponent_disconnected", {
          roomId: roomId,
          message: "Opponent disconnected",
        });

        // Emit rooms data after a small delay to ensure client processes the disconnection event first
        setTimeout(() => {
          io.emit("rooms", getCleanedRoomsData(rooms));
        }, 100);
      }
      // If the remaining player from a disconnected game is leaving, reset the room
      else if (
        rooms[roomIndex].opponentDisconnected &&
        rooms[roomIndex].players.length === 0
      ) {
        rooms[roomIndex].opponentDisconnected = false;
        rooms[roomIndex].disconnectedDuringGame = false;
        rooms[roomIndex].gameStart = false;
        rooms[roomIndex].gameOver = false;
        rooms[roomIndex].matchOver = false;
        rooms[roomIndex].hakkiyoiCount = 0;
        rooms[roomIndex].readyCount = 0;
        rooms[roomIndex].rematchCount = 0;
        rooms[roomIndex].readyStartTime = null;
        rooms[roomIndex].powerUpSelectionPhase = false;
        delete rooms[roomIndex].winnerId;
        delete rooms[roomIndex].loserId;
        delete rooms[roomIndex].gameOverTime;
        delete rooms[roomIndex].playersSelectedPowerUps;
        delete rooms[roomIndex].playerAvailablePowerUps;

        // Clean up the room state
        cleanupRoomState(rooms[roomIndex]);
      }
      // Normal disconnect - clean up room state
      else {
        // Clean up the room state (includes power-up selection state)
        cleanupRoomState(rooms[roomIndex]);
      }

      // If there's only one player left and not in disconnected state, reset their state completely
      if (
        rooms[roomIndex].players.length === 1 &&
        !rooms[roomIndex].opponentDisconnected
      ) {
        const p = rooms[roomIndex].players[0];
        // Reset to player 1 position and appearance
        p.fighter = "player 1";
        p.color = "aqua";
        p.x = 245;
        p.facing = 1;
        // Clean up any player-specific state
        cleanupPlayerStates(p);
        // Reset ready count
        rooms[roomIndex].readyCount = 0;
        p.isReady = false;
      }

      // Emit updates with cleaned data (only if not in disconnected state)
      if (!rooms[roomIndex].opponentDisconnected) {
        const cleanedRoom = getCleanedRoomData(rooms[roomIndex]);
        io.in(roomId).emit("player_left");
        io.in(roomId).emit("ready_count", rooms[roomIndex].readyCount);
        io.to(roomId).emit("lobby", cleanedRoom.players);
      }

      // Only emit rooms data immediately if not in disconnected state (delayed emit handles disconnected case)
      if (!rooms[roomIndex].opponentDisconnected) {
        io.emit("rooms", getCleanedRoomsData(rooms));
      }
    }
  });
}

module.exports = { registerSocketHandlers };

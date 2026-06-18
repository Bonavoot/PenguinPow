const { GROUND_LEVEL, GRAB_STATES } = require("./constants");
const { DEFAULT_PLAYER_SIZE_MULTIPLIER } = require("./gameUtils");

// Canonical key-state shape. Used at init and by every reset path so the keys
// object never shrinks (older reset code dropped mouse1/mouse2/c/control,
// leaving undefined holes after round resets).
function createInitialKeys() {
  return {
    w: false,
    a: false,
    s: false,
    d: false,
    " ": false,
    shift: false,
    e: false,
    f: false,
    c: false,
    control: false,
    mouse1: false,
    mouse2: false,
  };
}

// Single source of truth for the player object shape.
//
// Every player (human PvP, human-vs-CPU, CPU) MUST be created through
// createInitialPlayerState(). Previously this object was copy-pasted in four
// places and had silently diverged (e.g. player 1 was missing isEdgePushing,
// the CPU-room human was missing all sidestep/rope-jump fields, and only the
// CPU had movementVelocity initialized). The field list below is the union of
// all prior init sites plus every field referenced by the cleanup/reset
// helpers, so the object shape is stable from creation onward.
function createInitialPlayerState(overrides = {}) {
  const base = {
    // === Identity / cosmetics ===
    id: null,
    isCPU: false,
    fighter: "player 1",
    color: "aqua",
    mawashiColor: "#4169E1",
    bodyColor: null,
    wins: [],

    // === Position / physics ===
    facing: 1,
    x: 220,
    y: GROUND_LEVEL,
    knockbackVelocity: { x: 0, y: 0 },
    movementVelocity: 0,

    // === Resources ===
    stamina: 100,
    balance: 100,
    isGassed: false,
    gassedUntil: 0,

    // === Round / match state ===
    isReady: false,
    isDead: false,
    isBowing: false,
    isInRitualPhase: false,
    canMoveToReady: false,

    // === Hit / knockback state ===
    isHit: false,
    isAlreadyHit: false,
    isSlapKnockback: false,
    slapKnockbackCanRingOut: false,
    isParryKnockback: false,
    isBurstKnockback: false,
    burstKnockbackStartTime: 0,
    knockbackImmune: false,
    knockbackImmuneEndTime: 0,
    hitCounter: 0,
    lastHitType: null,
    lastHitTime: 0,
    lastHitByStringPos: 0,
    isHitFalling: false,
    hitFallStartTime: 0,
    hitFallStartY: 0,
    isFallingOffDohyo: false,

    // === Movement ===
    isJumping: false,
    isStrafing: false,
    strafeStartTime: 0,
    isBraking: false,
    isPowerSliding: false,
    isCrouchStance: false,
    isCrouchStrafing: false,

    // === Dodge ===
    isDodging: false,
    dodgeDirection: null,
    dodgeEndTime: 0,
    isDodgeStartup: false,
    isDodgeRecovery: false,
    dodgeStartupEndTime: 0,
    dodgeRecoveryEndTime: 0,
    dodgeCooldownUntil: 0,

    // === Sidestep ===
    isSidestepping: false,
    isSidestepStartup: false,
    isSidestepRecovery: false,
    sidestepStartTime: 0,
    sidestepStartupEndTime: 0,
    sidestepActiveEndTime: 0,
    sidestepEndTime: 0,
    sidestepStartX: 0,
    sidestepDirection: 0,
    sidestepTargetX: 0,
    sidestepRecoveryStartX: 0,
    sidestepRecoveryTargetX: 0,
    isSidestepHitReturn: false,
    sidestepHitReturnStartTime: 0,
    sidestepHitReturnStartY: 0,
    sidestepHitReturnDuration: 0,

    // === Attacks ===
    isAttacking: false,
    attackType: null,
    attackStartTime: 0,
    attackEndTime: 0,
    isSlapAttack: false,
    slapAnimation: 2,
    slapFacingDirection: null,
    slapActiveEndTime: 0,
    chargedActiveEndTime: 0,
    isInStartupFrames: false,
    startupEndTime: 0,
    isInEndlag: false,
    endlagEndTime: 0,
    attackCooldownUntil: 0,
    attackIntentTime: 0,
    attackAttemptTime: 0,
    lastCheckedAttackTime: 0,
    lastSlapHitLandedTime: 0,

    // === Slap string ===
    pendingSlapCount: 0,
    pendingGrabEnder: false,
    slapStringPosition: 0,
    slapStringWindowUntil: 0,
    slapWhiffCount: 0,
    isSlapWhiffPausing: false,
    slapAnimationToggle: 0,
    currentSlapHitConnected: false,

    // === Charged attack ===
    isChargingAttack: false,
    chargeStartTime: 0,
    chargeMaxDuration: 2000,
    chargeAttackPower: 0,
    chargingFacingDirection: null,
    chargeCancelled: false,
    wantsToRestartCharge: false,
    mouse1HeldDuringAttack: false,
    mouse1BufferedBeforeStart: false,
    mouse1PressTime: 0,

    // === Parry ===
    isSlapParrying: false,
    slapParryKnockbackVelocity: 0,
    slapParryImmunityUntil: 0,
    isSlapParryRecovering: false,
    isRawParrying: false,
    rawParryStartTime: 0,
    rawParryPressGameTime: 0,
    rawParryMinDurationMet: false,
    rawParryCooldownUntil: 0,
    isRawParryStun: false,
    perfectParryStunStartTime: 0,
    perfectParryStunBaseTimeout: null,
    isRawParrySuccess: false,
    isPerfectRawParrySuccess: false,

    // === Ropes / rope jump ===
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
    ropeJumpBufferedAttackRelease: 0,

    // === Flap (flight power-up) ===
    isFlapping: false,
    flapPhase: null, // "startup" | "flight" | "landing"
    flapCharges: 0, // Remaining flaps in the current flight
    flapVelocityY: 0, // Vertical velocity (px/tick); + = rising, - = falling
    flapVelocityX: 0, // Horizontal lunge velocity (px/tick) from directional flaps; decays via friction
    flapStartTime: 0,
    flapLandingTime: 0,
    flapWingBeatTime: 0, // Timestamp of the last flap — drives the flap2→flap1 wing-beat
    flapFastFalling: false, // Dive-locked plummet (S commit during flight) — synced for sprite/VFX
    flapDiveCommitted: false, // S pressed during flight — latched straight drop until landing
    flapDiveLockX: 0, // Horizontal position pinned on dive commit
    flapBeatHDir: 0, // Last wing-beat horizontal dir: -1 (A), 0 (neutral), 1 (D) — drives charge VFX
    flapHitLanded: false, // Did the descending body-slam connect this flight?
    lastFlapChargeTime: 0, // Throttles air flaps (FLAP_CHARGE_COOLDOWN_MS)
    flapHitRecoverDuration: 0, // Recovery window (ms) on touchdown — matches victim stun on a connect
    flapHitLandStartY: 0, // Legacy — no longer written on connect
    flapHitLandStartX: 0, // Legacy — no longer written on connect
    flapHitLandTargetX: 0, // Legacy — no longer written on connect

    // === Throws ===
    isThrowing: false,
    isBeingThrown: false,
    throwStartTime: 0,
    throwEndTime: 0,
    throwOpponent: null,
    throwingFacingDirection: null,
    beingThrownFacingDirection: null,
    throwCooldown: false,
    isThrowTeching: false,
    throwTechCooldown: false,
    lastThrowAttemptTime: 0,
    isAttemptingGrabThrow: false,
    grabThrowAttemptStartTime: 0,

    // === Grab core ===
    isGrabbing: false,
    isBeingGrabbed: false,
    grabCooldown: false,
    grabState: GRAB_STATES.INITIAL,
    grabAttemptType: null,
    grabAttemptStartTime: null,
    isGrabStartup: false,
    grabStartupStartTime: 0,
    grabStartupDuration: 0,
    grabStartupArmorUsed: false,
    grabStartTime: 0,
    grabbedOpponent: null,
    isGrabWalking: false,
    isGrabbingMovement: false,
    isWhiffingGrab: false,
    isGrabWhiffRecovery: false,
    isGrabTeching: false,
    grabTechRole: null,
    grabTechResidualVel: 0,
    grabMovementStartTime: 0,
    grabMovementDirection: 0,
    grabMovementVelocity: 0,
    lastGrabAttemptTime: 0,
    lastGrabStaminaDrainTime: 0,
    grabApproachSpeed: 0,

    // === Grab actions (push/pull/separate) ===
    isGrabPushing: false,
    isBeingGrabPushed: false,
    isEdgePushing: false,
    isBeingEdgePushed: false,
    isAttemptingPull: false,
    isBeingPullReversaled: false,
    pullReversalPullerId: null,
    isBoundaryPullSwap: false,
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
    grabDecisionMade: false,

    // === Grab break / counter ===
    isGrabBreaking: false,
    isGrabBreakCountered: false,
    grabBreakSpaceConsumed: false,
    isGrabBreakSeparating: false,
    grabBreakSepStartTime: 0,
    grabBreakSepDuration: 0,
    grabBreakStartX: 0,
    grabBreakTargetX: 0,
    grabCounterAttempted: false,
    grabCounterInput: null,
    isCounterGrabbed: false,
    postGrabInputBuffer: false,
    grabImmune: false,
    grabImmuneEndTime: 0,

    // === Clinch ===
    hasGrip: false,
    gripAcquiredTime: 0,
    inClinch: false,
    clinchAction: null,
    clinchOpponent: null,
    clinchStalemateStart: 0,
    clinchStalemateLastX: 0,
    clinchStalemateLastBalance: 0,
    clinchBreakRequest: false,
    clinchBreakRequestTime: 0,
    isClinchPushing: false,
    isClinchPlanting: false,
    isClinchLifting: false,
    lastPlantStaminaDrainTime: 0,
    isResistingThrow: false,
    isResistingPull: false,
    lastResistStaminaDrainTime: 0,
    isBeingLifted: false,
    clinchLiftStartTime: 0,
    clinchLiftStartX: 0,
    clinchLiftDir: 0,
    clinchLiftForwardBlocked: false,
    clinchMouse2BufferTime: 0,

    // === Clinch throw/pull/lift ===
    clinchThrowRequest: null,
    clinchThrowRequestTime: 0,
    clinchThrowActive: false,
    clinchThrowType: null,
    clinchThrowStartTime: 0,
    clinchThrowCooldown: false,
    isClinchThrowing: false,
    isClinchClashing: false,
    clinchClashStartTime: 0,
    isClinchKillThrowVictim: false,
    isClinchKillPullVictim: false,

    // === Clinch jolt ===
    isClinchJolting: false,
    clinchJoltRecovery: false,
    clinchJoltCooldown: false,
    clinchJoltStartTime: 0,
    isBeingClinchJolted: false,
    clinchJoltPlantInterrupt: false,
    isClinchJoltClashing: false,
    clinchJoltRequest: false,
    clinchJoltRequestTime: 0,
    clinchJoltRecoilStart: 0,
    clinchJoltPlantInterruptStart: 0,

    // === Power-ups ===
    isThrowingSalt: false,
    saltCooldown: false,
    activePowerUp: null,
    powerUpMultiplier: 1,
    selectedPowerUp: null,
    sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    hitAbsorptionUsed: false,

    // === Projectiles ===
    snowballCooldown: false,
    lastSnowballTime: 0,
    snowballThrowsRemaining: null,
    pumoArmySpawnsRemaining: null,
    snowballs: [],
    isThrowingSnowball: false,
    pumoArmyCooldown: false,
    pumoArmy: [],
    isSpawningPumoArmy: false,

    // === Ring-out throw cutscene ===
    isRingOutThrowCutscene: false,
    ringOutThrowDistance: 0,
    isRingOutFreezeActive: false,
    ringOutFreezeEndTime: 0,
    ringOutThrowDirection: null,
    pendingRingOutThrowTarget: null,

    // === Input ===
    keys: createInitialKeys(),
    // Raw fighter_action packets queued by the socket handler, drained and
    // dispatched by the game tick (held during hitstop). See processInputPacket.
    inputQueue: [],
    bufferedAction: null,
    bufferExpiryTime: 0,
    inputBuffer: null,
    inputLockUntil: 0,
    actionLockUntil: 0,
    currentAction: null,
    mouse1JustPressed: false,
    mouse1JustReleased: false,
    mouse2JustPressed: false,
    mouse2JustReleased: false,
    shiftJustPressed: false,
    eJustPressed: false,
    wJustPressed: false,
    fJustPressed: false,
    spaceJustPressed: false,

    // === Misc ===
    isOverlapping: false,
    overlapStartTime: null,
  };

  return { ...base, ...overrides };
}

// Canonical spawn config per slot, so call sites can't drift on
// position/facing/colors either.
const PLAYER_1_SPAWN = {
  fighter: "player 1",
  color: "aqua",
  mawashiColor: "#4169E1",
  facing: 1,
  x: 220,
};

const PLAYER_2_SPAWN = {
  fighter: "player 2",
  color: "salmon",
  mawashiColor: "#D94848",
  facing: -1,
  x: 845,
};

module.exports = {
  createInitialKeys,
  createInitialPlayerState,
  PLAYER_1_SPAWN,
  PLAYER_2_SPAWN,
};

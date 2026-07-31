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
    gearIds: [],
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
    // Eligible-time accumulator toward the next stamina regen pulse (per fighter).
    staminaRegenAccum: 0,

    // === Round / match state ===
    isReady: false,
    isDead: false,
    isBowing: false,
    isGrabPushDefeat: false, // FORCE OUT (grabPush) loser pose after shove
    isInRitualPhase: false,
    canMoveToReady: false,

    // === Hit / knockback state ===
    isHit: false,
    isAlreadyHit: false,
    isSlapKnockback: false,
    slapKnockbackCanRingOut: false,
    isChargedKnockback: false,
    chargedKnockbackCanRingOut: false,
    isParryKnockback: false,
    isBurstKnockback: false,
    burstKnockbackStartTime: 0,
    knockbackImmune: false,
    knockbackImmuneEndTime: 0,
    hitCounter: 0,
    lastHitType: null,
    lastHitTime: 0,
    isHitFalling: false,
    hitFallStartTime: 0,
    hitFallStartY: 0,
    hitFallVelocityY: 0,
    isFallingOffDohyo: false,

    // === Movement ===
    isJumping: false,
    isStrafing: false,
    strafeStartTime: 0,
    isBraking: false,
    isPowerSliding: false,
    isIceSliding: false,
    iceSlideDir: 0, // +1 right / -1 left — primary slide direction from dodge land
    iceSlideStartTime: 0,
    isIceSlideReverseHopping: false, // recovering pose during bunny-hop reverse
    iceSlideReverseHopStartTime: 0,
    iceSlideReverseHopUntil: 0,
    iceSlideReverseCooldownUntil: 0,
    iceSlideReverseBufferUntil: 0, // SHIFT repress buffer awaiting opposite dig
    iceSlideBrakeArmStart: 0, // when opposite dig began (0 = not digging)
    isSlideJumping: false,
    slideJumpPhase: null, // "flight" | "landing"
    slideJumpVelocityY: 0,
    slideJumpVelocityX: 0,
    slideJumpDiveCommitted: false,
    slideJumpFastFalling: false, // mirrors flapFastFalling — dive latched for VFX
    slideJumpDiveLockX: 0,
    slideJumpHitLanded: false,
    slideJumpHitRecoverDuration: 0,
    slideJumpLandingTime: 0,
    slideJumpStartTime: 0,
    slideJumpBufferUntil: 0, // W pressed during min flash — consume when jump becomes legal
    slideJumpHasFlap: false, // FLAP-armed takeoff — grants charges; flight still i-frame until S dive
    slideJumpFlapFlightActive: false, // true after first air-charge spend → FLAP flight physics
    isCrouchStance: false,
    isCrouchStrafing: false,
    // MASTERY Phase 1: momentum carry window — a dodge landing / active power
    // slide stamps earned momentum here so the next slap inherits it reliably
    // (gated by MASTERY_P1_MOMENTUM).
    momentumWindowVel: 0,
    momentumWindowUntil: 0,

    // === Dodge ===
    isDodging: false,
    // MASTERY Phase 1: |velocity| carried into a dodge, captured before it zeroes
    // out at dodge start; blended into landing momentum (gated by MASTERY_P1_MOMENTUM).
    dodgeEntrySpeed: 0,
    dodgeDirection: null,
    dodgeStartX: 0,
    dodgeTargetX: 0, // Fixed-distance hop end X (speed buffs don't extend this)
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
    isPalmThrust: false,
    isLowKick: false,
    palmThrustQueued: false,
    palmThrustFxId: 0,
    palmThrustVisualUntil: 0,
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

    // === Slap (individual presses — no string/combo) ===
    pendingSlapCount: 0,       // 1-press input buffer for responsiveness
    pendingSlapPressTime: 0,   // MASTERY Phase 3: simNow the buffered/direct slap press was queued (cadence gap source)
    pendingPalmThrust: false,  // back+mouse1 pressed mid-slap → thrust fires at cycle end (instead of another slap)
    slapAnimationToggle: 0,    // Cosmetic slap1 ↔ slap2 alternation
    currentSlapHitConnected: false,
    slapOpenHitPending: false, // set during AP late-parry grace when already in range
    // MASTERY Phase 3 (tsuppari cadence): an enhanced slap is a buffered follow-up
    // pressed LATE & precise (gap ≤ CADENCE_WINDOW_MS). isEnhancedSlap latches for
    // the current slap so processHit can read it at connect; cadenceChain counts
    // consecutive enhanced slaps (cosmetic delta prop → escalating VFX/SFX).
    // Both stay 0/false when MASTERY_P3_CADENCE is off (byte-identical).
    isEnhancedSlap: false,
    cadenceChain: 0,

    // === Charged attack ===
    isChargingAttack: false,
    chargeStartTime: 0,
    chargeMaxDuration: 2000,
    chargeAttackPower: 0,
    chargingFacingDirection: null,
    chargeCancelled: false,
    mouse1BufferedBeforeStart: false,
    // Held A/D across HAKKIYOI — mirrored from mouse1BufferedBeforeStart so a
    // forward hold into the bout isn't dropped (client only emits on edges).
    movementKeysBufferedBeforeStart: null,
    mouse1PressTime: 0,
    // Palm (and other press-to-fire M1 moves) consume the current mouse1 hold so
    // the continuous S+forward charge check can't auto-start mid-hold and leave
    // the player stranded in the charge shake until they release / cancel.
    mouse1ConsumedUntilRelease: false,
    isChargedHitRecoil: false,

    // === Parry ===
    isSlapParrying: false,
    slapParryKnockbackVelocity: 0,
    slapParryImmunityUntil: 0,
    isSlapParryRecovering: false, // Repurposed: also guards the same-tick slap-trade resolution
    // ── GUARD & PARRY (Space) — one stance, three outcomes. Reuses these flags:
    //   isRawParrying        = in the defensive stance (parry window live OR guarding)
    //   isGuarding           = HOLDING the block floor (no live parry window)
    //   isRawParrySuccess    = a parry landed (brief impact pose)
    //   rawParryStartTime    = sim time the tap armed (perfect grade + projectile/flap read this)
    isRawParrying: false,
    isGuarding: false,         // holding Space as the block floor (no live parry window)
    rawParryStartTime: 0,
    rawParryPressGameTime: 0,
    apActiveUntil: 0,          // Sim time the PARRY window closes (→ guard if held, whiff if released cold)
    apFlowUntil: 0,            // DEPRECATED (Deflect Flow removed) — kept zeroed so lingering reads don't throw
    apChainCount: 0,           // Consecutive parries (crescendo VFX/SFX on the client; reset when the stance drops)
    apFlurryUntil: 0,          // After a landed parry: next re-tap may extend window to this sim deadline
    isApWhiffRecovering: false, // Cold tap into nothing → punishable recovery
    apRecoveryUntil: 0,        // Sim time the whiff recovery ends
    apCooldownUntil: 0,        // Earliest sim time GUARD may re-enter after a drop (taps ignore this)
    apSpaceConsumed: false,    // One parry window per physical press (clears on falling Space; a re-tap re-arms)
    apGuardNeedsRelease: false, // Legacy latch (unused): hold-after-land now enters GUARD directly
    // Move+offense lock after a landed parry. Survives flurry re-taps (armAttackParry
    // clears success pose but NOT this) so back-to-back piano taps can't walk/act early.
    isApPostParryLocked: false,
    apPostParryLockUntil: 0,
    // Legacy raw-parry fields kept so lingering references don't throw; unused by AP.
    rawParryMinDurationMet: false,
    rawParryCooldownUntil: 0,
    rawParryRearmUntil: 0,
    isRawParryStun: false,
    perfectParryStunStartTime: 0,
    perfectParryStunBaseTimeout: null,
    isRawParrySuccess: false,
    isPerfectRawParrySuccess: false,

    // === MATADOR (BACK+SPACE grab-parry) ===
    // Timed tap-only read on the grab line. Separate from AP so grabs don't
    // CLAMP a matador attempt (matador beats grabs → instant pull).
    isMatadorParrying: false,
    isMatadorSuccess: false,
    matadorStartTime: 0,
    matadorActiveUntil: 0,
    isMatadorWhiffRecovering: false,
    matadorRecoveryUntil: 0,
    matadorSuccessUntil: 0,

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
    // Aerial landing Phase A (rope-jump V2). Cleared on init / interrupt / round end.
    ropeJumpRawTargetX: 0,
    ropeJumpResolvedTargetX: 0,
    ropeJumpLandingCommitted: false,
    ropeJumpLandingCommitX: 0,
    ropeJumpLandingCommitT: 0,
    ropeJumpLandingCommitVel: 0,
    ropeJumpLandingDecision: null,
    ropeJumpLandingPath: null,
    ropeJumpPreferredSide: 0,
    ropeJumpResolvedSide: 0,
    ropeJumpMinDistance: 0,
    ropeJumpCenterDistance: 0,
    ropeJumpOverlap: 0,
    ropeJumpSafetyCorrectionPx: 0,
    ropeJumpPreTouchdownX: 0,
    ropeJumpTouchdownX: 0,
    ropeJumpUsedFallback: false,
    ropeJumpTrajectoryType: null,
    ropeJumpDecisionClass: null,
    ropeJumpFallbackReason: null,
    ropeJumpHorizVel: 0,
    ropeJumpRawExpectedVel: 0,
    ropeJumpPeakVel: 0,
    ropeJumpPeakAccel: 0,
    ropeJumpReversalDetected: false,
    // Phase A.2 / A.3 side-intent / planning diagnostics (server-local; not on prod delta)
    ropeJumpSideIntentLocked: false,
    ropeJumpSideIntent: 0,
    ropeJumpIntentClass: null,
    ropeJumpIntentReason: null,
    ropeJumpRecommendedCommitT: 0,
    ropeJumpSideIntentOpponentX: 0,
    ropeJumpPlanningState: null,
    ropeJumpFirstRawConflictTick: 0,
    ropeJumpFirstRawConflictT: -1,
    ropeJumpSideLockTick: 0,
    ropeJumpSideLockReason: null,
    ropeJumpNoReturnDeadlineT: 0,
    ropeJumpConflictBeforeDeadline: null,
    ropeJumpEndpointCommitTick: 0,
    ropeJumpLateIntrusion: false,
    ropeJumpLateIntrusionClass: null,
    ropeJumpSafetyCorrectionTicks: 0,
    // Phase A.3.1 / A.3.2 late-intrusion settle + recovery monitoring
    ropeJumpSettleState: null,
    ropeJumpSidePolicy: null,
    ropeJumpSettleJumperIsLeft: null,
    ropeJumpSettleInitialOverlap: 0,
    ropeJumpSettleMaxOverlap: 0,
    ropeJumpSettleAccumulatedPx: 0,
    ropeJumpSettleTicksDone: 0,
    ropeJumpSettleTicksTotal: 0,
    ropeJumpSettleEpisodeCount: 0,
    ropeJumpSettleReactivated: false,
    ropeJumpOverlapIncreased: false,
    ropeJumpBudgetException: false,
    ropeJumpBudgetExceptionClass: null,

    // === Flap charges (ride on FLAP-armed slide-jump; standalone liftoff removed) ===
    isFlapping: false, // legacy — always false; cleared for safety
    flapPhase: null,
    flapCharges: 0, // Remaining air flaps in the current FLAP-armed slide-jump
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
    // MASTERY Phase 1: max(0, aligned entry velocity) at slap press — drives the
    // on-hit ground-transfer inheritance in processHit (gated by MASTERY_P1_MOMENTUM).
    slapEntryAligned: 0,

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
    clinchEdgePinStart: 0,
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
    isArmClamped: false,
    clinchThrowFailStagger: false,
    isClinchOpen: false,
    clinchOpenHideStars: false,
    clinchOpenUntil: 0,
    hasDeepGrip: false,
    clinchShoveLead: null,
    isClinchCommittedDrive: false,
    isClinchPerfectBracing: false,
    clinchDriveHoldStart: 0,
    clinchDrivePlantCancelUntil: 0,
    clinchPushLossStart: 0,
    clinchBraceSimTime: 0,
    clinchBraceLatchUntil: 0, // Throw/Pull brace grace after Plant release
    clinchBracePressGameTime: 0,
    clinchThrowArcDistance: 0,
    // MASTERY Phase 2 (posture coupling): broken-posture "openable" tell,
    // derived from `balance` each tick behind MASTERY_P2_POSTURE (false when
    // the flag is off).
    isPostureBroken: false,
    deepGripPushStart: 0,
    clinchPushRampStart: 0,
    postGrabInputBuffer: false,
    grabImmune: false,
    grabImmuneEndTime: 0,

    // === Clinch ===
    hasGrip: false,
    gripAcquiredTime: 0,
    isClinchBeltHolding: false,
    clinchBeltRequiresM2Release: false,
    clinchAttachDistance: 0,
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
    lastPlantStaminaDrainTime: 0,
    isResistingThrow: false,
    isResistingPull: false,
    lastResistStaminaDrainTime: 0,
    clinchMouse2BufferTime: 0,
    clinchWTapTime: 0,
    clinchAwayTapTime: 0,
    clinchTechniquePressGameTime: 0,
    sJustPressed: false,

    // === Clinch throw/pull ===
    clinchThrowRequest: null,
    clinchThrowRequestTime: 0,
    clinchThrowActive: false,
    clinchThrowType: null,
    clinchThrowStartTime: 0,
    clinchThrowCooldown: false, // retired (Open/recovery); kept for safe cleanup
    clinchThrowUsedDeepGrip: false,
    clinchThrowWasCounter: false,
    clinchThrowKillBalance: null, // Balance at technique commit (pre-initiation drain); kill check only
    clinchThrowInitiationDrain: 0, // Stance+edge drain applied at commit (resist refunds excess)
    clinchThrowInitiationEdgeBonus: 0,
    isClinchThrowing: false,
    isClinchClashing: false,
    clinchClashStartTime: 0,
    isClinchKillThrowVictim: false,
    isClinchKillPullVictim: false,

    // === Clinch jolt ===
    isClinchJolting: false,
    clinchJoltRecovery: false,
    clinchJoltCooldown: false, // retired; kept for safe cleanup
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
    // FORCE OUT continued-push cutscene (replaces throw hop for grabPush)
    isRingOutPushCutscene: false,
    ringOutPushStartTime: 0,
    ringOutPushDuration: 0,
    ringOutPushStartX: 0,
    ringOutPushTargetX: 0,
    ringOutPushSettled: false,
    ringOutPushAttachDistance: 0,
    ringOutPushAllowSeparate: false,

    // === Input ===
    keys: createInitialKeys(),
    // Raw fighter_action packets queued by the socket handler, drained and
    // dispatched by the game tick (held during hitstop). See processInputPacket.
    inputQueue: [],
    // Netcode trust — server EMA of client clock offset / RTT for lag-comp clamps.
    netRttMs: 60,
    netClockOffsetMs: null, // serverNow - clientPerfNow (EMA); null until first sync packet
    lastTrustedPressGameTime: 0,
    rawParryPressReceiptGameNow: 0,
    clinchTechniquePressReceiptGameNow: 0,
    clinchBracePressReceiptGameNow: 0,
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
  mawashiColor: "#DA1B44",
  facing: -1,
  x: 845,
};

module.exports = {
  createInitialKeys,
  createInitialPlayerState,
  PLAYER_1_SPAWN,
  PLAYER_2_SPAWN,
};

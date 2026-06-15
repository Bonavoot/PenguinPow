import {
  pumo,
  grabbing,
  attemptingGrabThrow,
  attemptingPull,
  pumoSideProfile,
  pumoTachiaiPosition,
  attack,
  slapAttack1,
  slapAttack2,
  dodging,
  throwing,
  salt,
  recovering,
  rawParrySuccess,
  crouchStance,
  flap1,
  flap2,
  pumoWaddle,
  pumoArmy,
  crouching,
  bow,
  grabAttempt,
  hit,
  bellyLaying,
  bellyLayingEyesOpen,
  snowballThrow,
  beingGrabbed,
  atTheRopes,
  crouchStrafingApng,
  isPerfectParried,
} from "./fighterAssets";

const getImageSrc = (
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isDodging,
  isStrafing,
  isRawParrying,
  isGrabBreaking,
  isReady,
  readyIntroComplete = true,
  isHit,
  isDead,
  isSlapAttack,
  isThrowing,
  isGrabbing,
  isGrabbingMovement,
  isBeingGrabbed,
  isThrowingSalt,
  slapAnimation,
  isBowing,
  isThrowTeching,
  isBeingPulled,
  isBeingPushed,
  grabState,
  grabAttemptType,
  isRecovering,
  isRawParryStun,
  isRawParrySuccess,
  isPerfectRawParrySuccess,
  isThrowingSnowball,
  isSpawningPumoArmy,
  isAtTheRopes,
  isCrouchStance,
  isCrouchStrafing,
  isPowerSliding,
  isGrabBreakCountered,
  // new optional trailing param(s)
  isGrabbingMovementTrailing,
  _isGrabClashActive, // dead arg kept to preserve positional signature; remove on next signature audit
  isAttemptingGrabThrow,
  // Ritual animation source - if provided, use it instead of state-based selection
  ritualAnimationSrc,
  // New grab action system states
  isGrabPushing,
  isBeingGrabPushed,
  isAttemptingPull,
  isBeingPullReversaled,
  isGrabSeparating,
  isGrabBellyFlopping,
  isBeingGrabBellyFlopped,
  isGrabFrontalForceOut,
  isBeingGrabFrontalForceOut,
  isGrabTeching,
  grabTechRole,
  isGrabWhiffRecovery,
  isRopeJumping,
  ropeJumpPhase,
  isDodgeRecovery,
  isSidestepping,
  isSidestepRecovery,
  isChargingAttack,
  hasGrip,
  isBeingLifted,
  isClinchClashing,
  isClinchLifting,
  isClinchPushing,
  isClinchPlanting,
  isResistingThrow,
  isResistingPull,
  isClinchKillThrowVictim,
  isClinchKillPullVictim,
  // These clinch-jolt args are passed by GameFighter but unused here; kept as
  // positional placeholders so the trailing flap params line up with the call.
  isClinchJolting, // eslint-disable-line no-unused-vars
  isBeingClinchJolted, // eslint-disable-line no-unused-vars
  isClinchJoltClashing, // eslint-disable-line no-unused-vars
  clinchJoltRecovery, // eslint-disable-line no-unused-vars
  // Flap (flight power-up) — trailing params
  isFlapping,
  flapPhase,
  flapFrame,
  flapUseDodgePose
) => {
  if (ritualAnimationSrc) {
    return ritualAnimationSrc;
  }

  if (isClinchKillThrowVictim) return hit;
  // Pull kill: eyes open during the slide, then eyes closed once the bow phase begins.
  if (isClinchKillPullVictim) return isBowing ? bellyLaying : bellyLayingEyesOpen;
  if (isAttemptingPull) return attemptingPull;
  if (isClinchClashing) return attemptingGrabThrow;

  const attemptingGrabMovement =
    typeof isGrabbingMovementTrailing === "boolean"
      ? isGrabbingMovementTrailing
      : !!isGrabbingMovement;

  if (isGrabTeching) {
    if (grabTechRole === "grabber") return grabbing;
    return rawParrySuccess;
  }
  if (isGrabWhiffRecovery) return grabAttempt;

  if (isGrabBellyFlopping) return grabbing;
  if (isBeingGrabBellyFlopped) return beingGrabbed;
  if (isGrabFrontalForceOut) return grabbing;
  if (isBeingGrabFrontalForceOut) return beingGrabbed;
  if (isBeingPullReversaled) return beingGrabbed;
  if (isGrabSeparating) return rawParrySuccess;
  if (isGrabBreaking) return crouching;
  if (isGrabBreakCountered) return hit;
  if (isRawParrySuccess || isPerfectRawParrySuccess) return rawParrySuccess;
  if (isRawParryStun) return isPerfectParried;
  if (isHit) return hit;
  if (isAtTheRopes) return atTheRopes;
  if (isRopeJumping) {
    if (ropeJumpPhase === "startup" || ropeJumpPhase === "landing") return recovering;
    return dodging;
  }
  // Flap: grounded startup uses the rope-jump-style recovery pose; in the air
  // we toggle between the two flap frames (the wing-beat) — flapFrame is the
  // client-computed 1|2 from the last flapWingBeatTime. During flight, use the
  // dodge pose when out of air charges or holding S to fast-fall (see GameFighter).
  if (isFlapping) {
    // Grounded startup AND the landing/recovery (whiff or post-slam auto-ground)
    // both use the rope-jump-style recovery pose rather than holding a flap frame.
    if (flapPhase === "startup" || flapPhase === "landing") return recovering;
    if (flapUseDodgePose) return dodging;
    return flapFrame === 2 ? flap2 : flap1;
  }
  // Recovery is checked first because isSidestepping stays true through the
  // recovery phase. Without this order, the spin sprite would persist into
  // recovery — and with the active→recovery facing flip, that produced a
  // visible scaleX mirror that read as the spin "reversing direction".
  if (isSidestepRecovery) return recovering;
  if (isSidestepping) return isPerfectParried;
  if (isBowing) return bow;
  if (isPowerSliding) return crouchStance;
  if (isChargingAttack) return recovering;
  if (isRecovering) return recovering;
  if (isThrowingSnowball) return snowballThrow;
  if (isSpawningPumoArmy) return pumoArmy;
  if (isClinchLifting) return attemptingGrabThrow;
  if (isBeingLifted) return beingGrabbed;
  if (isAttemptingGrabThrow) return attemptingGrabThrow;
  if (isResistingThrow) return hit;
  if (isResistingPull) return hit;
  if (isClinchPlanting) return crouchStance;
  if (isClinchPushing) return grabbing;
  if (isBeingGrabbed) {
    if (hasGrip) return grabbing;
    return beingGrabbed;
  }
  if (isDodging) return dodging;
  if (isDodgeRecovery) return recovering;
  if (isJumping) return throwing;
  if (isAttacking && !isSlapAttack) return attack;
  if (isCrouchStrafing) return crouchStrafingApng;
  if (isCrouchStance) return crouchStance;
  if (attemptingGrabMovement) {
    return grabAttemptType === "throw" ? throwing : grabAttempt;
  }
  if (grabState === "attempting") {
    return grabAttemptType === "throw" ? throwing : grabAttempt;
  }
  if (isSlapAttack) {
    if (slapAnimation === 1) return slapAttack1;
    return slapAttack2;
  }
  if (isGrabbing) {
    if (grabState === "attempting") {
      return grabAttemptType === "throw" ? throwing : grabAttempt;
    }
    return grabbing;
  }
  if (isRawParrying) return crouching;
  if (isReady) {
    return readyIntroComplete ? pumoTachiaiPosition : pumoSideProfile;
  }
  if (isStrafing && !isThrowing) return pumoWaddle;
  if (isDead) return pumo;
  if (isThrowing) return throwing;
  if (isThrowingSalt) return salt;
  return pumo;
};

export default getImageSrc;

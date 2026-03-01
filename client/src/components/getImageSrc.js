import {
  pumo,
  grabbing,
  attemptingGrabThrow,
  attemptingPull,
  ready,
  attack,
  slapAttack1,
  slapAttack2,
  dodging,
  throwing,
  salt,
  recovering,
  rawParrySuccess,
  crouchStance,
  pumoWaddle,
  pumoArmy,
  crouching,
  bow,
  grabAttempt,
  hit,
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
  isGrabClashActive,
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
  isDodgeRecovery
) => {
  if (ritualAnimationSrc) {
    return ritualAnimationSrc;
  }

  if (isAttemptingPull) return attemptingPull;

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
  if (isBowing) return bow;
  if (isPowerSliding) return crouchStance;
  if (isRecovering) return recovering;
  if (isThrowingSnowball) return snowballThrow;
  if (isSpawningPumoArmy) return pumoArmy;
  if (isBeingGrabbed || isBeingPulled || isBeingPushed) return beingGrabbed;
  if (isDodging) return dodging;
  if (isDodgeRecovery) return recovering;
  if (isJumping) return throwing;
  if (isAttacking && !isSlapAttack) return attack;
  if (isCrouchStrafing) return crouchStrafingApng;
  if (isCrouchStance) return crouchStance;
  if (isAttemptingGrabThrow) return attemptingGrabThrow;
  if (attemptingGrabMovement) {
    return grabAttemptType === "throw" ? throwing : grabAttempt;
  }
  if (grabState === "attempting") {
    if (isGrabClashActive) {
      return grabbing;
    }
    return grabAttemptType === "throw" ? throwing : grabAttempt;
  }
  if (isSlapAttack) {
    return slapAnimation === 1 ? slapAttack1 : slapAttack2;
  }
  if (isGrabbing) {
    if (grabState === "attempting") {
      if (isGrabClashActive) {
        return grabbing;
      }
      return grabAttemptType === "throw" ? throwing : grabAttempt;
    }
    return grabbing;
  }
  if (isRawParrying) return crouching;
  if (isReady) return ready;
  if (isStrafing && !isThrowing) return pumoWaddle;
  if (isDead) return pumo;
  if (isThrowing) return throwing;
  if (isThrowingSalt) return salt;
  return pumo;
};

export default getImageSrc;

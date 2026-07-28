import {
  pumo,
  grabbing,
  clinchPlanting,
  attemptingGrabThrow,
  attemptingPull,
  pumoSideProfile,
  pumoTachiaiPosition,
  attack,
  slapAttack1,
  slapAttack2,
  slapAttack1Blur,
  slapAttack1Hit,
  slapAttack2Blur,
  slapAttack2Hit,
  palmThrust,
  palmThrustStartup,
  palmThrustSmear,
  lowKick,
  dodging,
  sliding,
  throwing,
  salt,
  recovering,
  charging,
  rawParrySuccess,
  rawParrySuccessFrame1,
  rawParrySuccessFrame2,
  blocking,
  blockParry,
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
  cinematicThrowKillLanding,
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
  flapUseDodgePose,
  // Open-palm thrust (back + mouse1) — the planted strike is a client-driven
  // multi-frame animation. isPalmThrust stays true for the whole move; the
  // frame index (see palmThrustFrame) picks which pose to show:
  //   0 = startup (windup)   1 = smear (whoosh)
  //   2 = active strike      3 = recovery (reuses the startup pose)
  isPalmThrust,
  palmThrustFrame = 2,
  // Low kick / trip (S + mouse1) — single-frame art for now.
  isLowKick = false,
  // Kill-throw flight vs grounded: spin uses `hit` high in the air; flat
  // landing art takes over near the ground (and stays after isBeingThrown clears).
  isBeingThrown = false,
  // Slap string (hits 1 & 2) — a client-driven animation spanning the whole slap
  // cycle, mirroring the palm-thrust frame model. isSlapAttack stays true for the
  // whole cycle; slapFrame (see GameFighter) picks the pose:
  //   0 = windup (ready stance)   1 = blur (DISABLED in timeline)
  //   2 = hit (active strike)     3 = recovery (settles back to the ready stance)
  // Default 2 (the hit/active pose) is the safe money-frame fallback.
  slapFrame = 2,
  // True GUARD floor (parry window already expired while still holding Space).
  // Distinct from isRawParrying, which is also true during the live parry window.
  isGuarding = false,
  // Guard SUCCESS pose — briefly true after a chip absorb (mirrors isRawParrySuccess).
  isGuardBlockSuccess = false,
  // Attack-parry SUCCESS anim (wall-clock; see GameFighter).
  // 0 = blocking startup  1 = success-f1 (quick)  2 = success-f2 (hold).
  rawParrySuccessFrame = 2,
  // Empty-tap AP whiff jail — hold success-f1 for the whole recovery.
  // Success lands never set this (they use the success anim above).
  // Live window + guard floor stay on blocking.png (must not flip to f1 on hold).
  isApWhiffRecovering = false,
  // Ice slide (SHIFT-held post-dodge) + slide-jump — must stay trailing
  isIceSliding = false,
  isIceSlideReverseHopping = false,
  isSlideJumping = false,
  slideJumpPhase = null,
  slideJumpUseDodgePose = false,
  slideJumpFlapFrame = 1
) => {
  if (ritualAnimationSrc) {
    return ritualAnimationSrc;
  }

  if (isClinchKillThrowVictim) {
    // isBeingThrown here means "still in aerial hit+spin pose" — GameFighter
    // clears it once the early-landing window arms.
    return isBeingThrown ? hit : cinematicThrowKillLanding;
  }
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
  // Attack Parry SUCCESS: blocking → f1 (quick) → f2 (hold). No frame 3.
  if (isRawParrySuccess || isPerfectRawParrySuccess) {
    if (rawParrySuccessFrame === 0) return blocking;
    if (rawParrySuccessFrame === 1) return rawParrySuccessFrame1;
    return rawParrySuccessFrame2;
  }
  // Guard SUCCESS — chip absorb lands; hold block-parry.png for the block VFX.
  if (isGuardBlockSuccess) return blockParry;
  // Empty-tap AP whiff only — success-f1 for the jail. Live window + hold-guard
  // stay on blocking below so holding Space never leaves the block pose.
  if (isApWhiffRecovering) return rawParrySuccessFrame1;
  if (isRawParryStun) return isPerfectParried;
  if (isHit) return hit;
  if (isAtTheRopes) return atTheRopes;
  if (isRopeJumping) {
    if (ropeJumpPhase === "startup" || ropeJumpPhase === "landing") return recovering;
    return dodging;
  }
  // Slide-jump: flap wing art in the air (no real flaps); dodge pose on butt-slam dive.
  if (isSlideJumping) {
    if (slideJumpPhase === "landing") return recovering;
    if (slideJumpUseDodgePose) return dodging;
    return slideJumpFlapFrame === 2 ? flap2 : flap1;
  }
  // Grab attempt outranks ice slide — otherwise slide→grab keeps the sliding
  // pose and reads as the slide eating the attempt.
  if (attemptingGrabMovement) {
    return grabAttemptType === "throw" ? throwing : grabAttempt;
  }
  if (grabState === "attempting") {
    return grabAttemptType === "throw" ? throwing : grabAttempt;
  }
  // Ice slide — sliding pose; bunny-hop reverse flashes recovering → sliding.
  if (isIceSliding) {
    if (isIceSlideReverseHopping) return recovering;
    return sliding;
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
  // Low kick / trip — single pose for the whole rooted move.
  if (isLowKick) return lowKick;
  // Palm thrust: a client-driven 4-frame animation spanning the whole move.
  // Server keeps isPalmThrust true from startup through recovery, so we never
  // fall through to the generic recovering sprite — the frame index drives the
  // pose: startup → smear → active strike → recovery (startup pose reused).
  if (isPalmThrust) {
    // Sequence reads smear → active → startup: the smear pose is the lead-in
    // windup, and the startup pose doubles as the recovery/settle frame.
    if (palmThrustFrame === 0) return palmThrustSmear;
    if (palmThrustFrame === 1) return palmThrustSmear;
    if (palmThrustFrame === 3) return palmThrustStartup;
    return palmThrust;
  }
  // Distinct asset from recovering so charge hold isn't visually/identity-
  // conflated with post-attack recovery (same art for now; separate file).
  if (isChargingAttack) return charging;
  if (isRecovering) return recovering;
  if (isThrowingSnowball) return snowballThrow;
  if (isSpawningPumoArmy) return pumoArmy;
  // Lift/carry (Mouse2 + W + toward): both stay in the clinch grab pose. The
  // victim's airborne read comes from server Y + a client-side lean; the
  // lifter's carry tell is a shoulder-pivoted arm overlay rotate.
  if (isClinchLifting) return grabbing;
  if (isBeingLifted) return grabbing;
  if (isAttemptingGrabThrow) return attemptingGrabThrow;
  if (isResistingThrow) return hit;
  if (isResistingPull) return hit;
  if (isClinchPlanting) return clinchPlanting;
  if (isClinchPushing) return grabbing;
  // Grip is automatic on clinch connect — grabbed fighters use the armless
  // grabbing body + flipper overlay (body-hold / belt-hold via arm rotate).
  // beingGrabbed remains only as a rare fallback if grip is somehow missing.
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
  // if (isSlapAttack) {
  //   if (slapAnimation === 1) return slapAttack1;
  //   return slapAttack2;
  // }

  if (isSlapAttack) {
    // Slaps play the client-driven windup → smear → hit → recovery cycle:
    //   0 windup   → ready stance (palm-thrust-startup), held long enough to READ
    //   1 smear    → slap-attack-{1,2}-blur-frame (a short motion beat before the hit)
    //   2 hit      → slap-attack-{1,2}-hit-frame, the strike, held through active
    //   3 recovery → SETTLE BACK to the ready stance (palm-thrust-startup), NOT idle
    // The recovery deliberately returns to the SAME ready-stance pose as the
    // windup so the motion reads as "set → strike → settle" instead of "arm up →
    // arm down → idle" (idle drops the hands to the sides, which looked like a
    // flinch). Slap 1 (slapAnimation 1) and slap 2 (slapAnimation 2) have their
    // OWN smear/hit art; only the shared windup/recovery stance is reused.
    if (slapFrame === 0) return palmThrustStartup; // windup (ready stance)
    if (slapFrame === 3) return palmThrustStartup; // recovery (settle back to stance)
    const isSlap2 = slapAnimation === 2;
    if (slapFrame === 1) return isSlap2 ? slapAttack2Blur : slapAttack1Blur; // smear
    return isSlap2 ? slapAttack2Hit : slapAttack1Hit; // hit — held through active
  }
  if (isGrabbing) {
    if (grabState === "attempting") {
      return grabAttemptType === "throw" ? throwing : grabAttempt;
    }
    return grabbing;
  }
  // Parry / guard ATTEMPTING stance (space held, no absorb this frame).
  // Same blocking.png for the live parry window AND the guard floor — success
  // / whiff poses are handled above.
  if (isGuarding || isRawParrying) return blocking;
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

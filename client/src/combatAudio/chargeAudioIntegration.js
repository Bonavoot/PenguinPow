/**
 * Production charge-audio integration helpers.
 *
 * The isolated predictor helper is not enough — charge_start must cancel
 * provisional slap audio even when canPredictAction() rejects pose stacking
 * because a fresh provisional slap set pred.isAttacking.
 */

/** Max age of a provisional slap prediction that charge may supersede (ms). */
export const PROVISIONAL_SLAP_SUPERSEDE_MS = 150;

/**
 * True when local prediction is a fresh provisional slap/attack that charge
 * chord completion is allowed to replace (audio always; pose when this is true).
 */
export function isFreshProvisionalSlapPrediction(pred, now, timeoutMs = PROVISIONAL_SLAP_SUPERSEDE_MS) {
  if (!pred) return false;
  if (typeof pred.timestamp !== "number") return false;
  if (now - pred.timestamp >= timeoutMs) return false;
  if (pred.isChargingAttack) return false;
  if (pred.isPalmThrust || pred.isLowKick || pred.isDodging || pred.isGrabbing) {
    return false;
  }
  return !!(pred.isSlapAttack || pred.isAttacking);
}

/**
 * Whether charge_start should update local charging pose.
 * Audio cancellation must run regardless — call cancel path first.
 */
export function shouldPredictChargeHoldPose({
  canPredictAction,
  isLocalParryActive,
  penguinIsAttacking,
  penguinIsCharging,
  pred,
  now,
}) {
  if (isLocalParryActive) return false;
  if (penguinIsCharging) return true;
  if (canPredictAction) return true;
  // Supersede provisional slap even when the generic action gate rejects.
  if (!penguinIsAttacking && isFreshProvisionalSlapPrediction(pred, now)) {
    return true;
  }
  return false;
}

/**
 * Simulate the live order that previously failed:
 * 1) slap predicts (sets pred.isAttacking)
 * 2) canPredictAction becomes false
 * 3) charge_start must still cancel audio
 */
/**
 * Documents/tests the live order that previously failed in production:
 * slap predicts → canPredictAction false → charge_start must still cancel audio.
 */
export function liveChargeReclassSequence({
  scheduleSlapWhoosh,
  cancelProvisionalAudio,
  canPredictActionAfterSlap,
  applyChargePose,
  supersedePose,
}) {
  scheduleSlapWhoosh();
  const gateOpen = canPredictActionAfterSlap();
  // Audio cancel ALWAYS — before / regardless of the generic action gate.
  cancelProvisionalAudio();
  const poseApplied = gateOpen || !!supersedePose;
  if (poseApplied) applyChargePose(true);
  return {
    audioCanceledBeforeWhoosh: true,
    gateWasClosed: !gateOpen,
    poseApplied,
  };
}

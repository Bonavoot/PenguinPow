/**
 * Strike paint order (slap / palm).
 *
 * Slap and palm bake the limb into the full-body sprite — there is no separate
 * arm layer like grab. AAA 2D fighters put the striking limb above the
 * opponent on the swing, not only on confirm. The equivalent here is raising
 * the whole fighter while the limb is visually out (smear + hit pose).
 *
 * Do not key this off isAttacking: that flag is the hitbox, and it can die on
 * parry / absorb / cycle edges while isSlapAttack still holds the pose. The
 * pose director (slapFrame / palmThrustFrame) is the source of truth.
 *
 * Simultaneous swings cannot both be on top. First attackStartTime leads;
 * missing/tied clocks fall back to facing-right (same convention as grab arm).
 * Victim sink (z 97 on isHit) still wins in CSS so a connecting hit reads
 * in front even if the victim started first.
 */

export const STRIKE_Z = {
  EXTEND: 100,
  EXTEND_LEAD: 101,
};

/** Smear (1) and extended hit pose (2). Windup/recovery keep the arm in. */
export const isSlapLimbOut = (slapFrame, holdHitPose = false) => {
  if (holdHitPose) return true;
  return slapFrame === 1 || slapFrame === 2;
};

/** Palm smear (1) and active strike (2). */
export const isPalmLimbOut = (palmThrustFrame) =>
  palmThrustFrame === 1 || palmThrustFrame === 2;

/**
 * Opponent is competing for the strike layer when their attack pose is live
 * AND the hitbox flag is still up. Recovery keeps isSlapAttack with the arm
 * retracted but clears isAttacking — using both avoids covering a live smear
 * with a recovering body.
 */
export const isOpponentStrikeCompeting = (p) =>
  !!(
    p &&
    ((p.isSlapAttack && p.isAttacking) || (p.isPalmThrust && p.isAttacking))
  );

/**
 * @returns {number|null} z to apply while limb-out, or null to fall through
 */
export const resolveStrikeExtendZ = ({
  limbOut,
  selfStart = 0,
  opponentCompeting = false,
  opponentStart = 0,
  facing = -1,
} = {}) => {
  if (!limbOut) return null;
  if (!opponentCompeting) return STRIKE_Z.EXTEND;
  const a = selfStart || 0;
  const b = opponentStart || 0;
  if (a > 0 && b > 0 && a !== b) {
    return a < b ? STRIKE_Z.EXTEND_LEAD : STRIKE_Z.EXTEND;
  }
  return facing === 1 ? STRIKE_Z.EXTEND_LEAD : STRIKE_Z.EXTEND;
};

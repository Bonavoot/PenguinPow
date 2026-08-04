/**
 * PHASE 4A — STRUCK-LIMB CONTACT-POSE HOLD (presentation only).
 *
 * A limb-only connect was unreadable: authoritative `isHit` lands on the same
 * frame as the contact, so the exposed arm vanished into the generic hit sprite
 * before the eye could register WHAT was struck — the limb-anchored spark then
 * read as a hit on empty air.
 *
 * This module owns the decision of whether to keep drawing the exact slap frame
 * the SERVER collided with. It is deliberately pure so the ordering rules can be
 * tested without a DOM.
 *
 * Invariants (all enforced here, not by the caller):
 *   • Never delays or suppresses authoritative `isHit`.
 *   • Owns NO duration: the deadline is always the display hitstop's.
 *   • Genuine limb-only contacts only — torso and torso-plus-limb body contacts
 *     keep ordinary hit presentation. Never keys off HURT_LIMB alone.
 *   • A duplicate / retransmitted hit event is a no-op, not a restart.
 *   • Works for `player_hit`-before-`hitstop` AND `hitstop`-before-`player_hit`.
 */

/**
 * How long `player_hit` may wait for the hitstop deadline before the hold is
 * abandoned. A packet-ordering bridge only — never a visible hold duration.
 */
export const STRUCK_LIMB_HOLD_BRIDGE_MS = 120;

export const createStruckLimbHold = () => ({
  until: 0,
  src: null,
  mirrorFacing: null,
  poseKey: null,
  variant: null,
  hitId: null,
  pendingHitId: null,
  pendingUntil: 0,
});

/**
 * Stable identity for one authoritative contact, so a retransmitted packet
 * cannot restart the hold.
 */
export const struckLimbEventId = (data) => {
  if (!data) return null;
  if (data.hitId != null) return `limbhold:${data.hitId}`;
  return `limbhold:${data.victimSlapPoseKey || "?"}:${data.timestamp ?? ""}`;
};

/**
 * Is this hit event a GENUINE limb-only contact against THIS fighter?
 * `limbOnlyContact` is stamped by the server only when the authored limb won AND
 * the torso was out of legacy connect — so torso-plus-limb correctly returns
 * false and falls through to the ordinary hit reaction.
 */
export const isStruckLimbHoldEligible = (data, playerId) =>
  !!data &&
  !!playerId &&
  data.victimId === playerId &&
  data.limbOnlyContact === true &&
  !data.cinematicKill;

/**
 * Arm the hold from an authoritative contact stamp.
 *
 * @param {object} hold        mutable hold record (see createStruckLimbHold)
 * @param {object} data        `player_hit` payload
 * @param {string} playerId    this fighter's id
 * @param {number} now         performance.now()
 * @param {number} hitstopUntil getDisplayHitstopUntil()
 * @param {(poseKey:string, variant:*) => *} resolveSrc sprite resolver
 * @returns {boolean} true when this call armed a NEW hold
 */
export const armStruckLimbHold = (
  hold,
  data,
  playerId,
  now,
  hitstopUntil,
  resolveSrc
) => {
  if (!hold || !isStruckLimbHoldEligible(data, playerId)) return false;
  const eventId = struckLimbEventId(data);
  // Duplicate / retransmitted event — must not restart the hold.
  if (!eventId || hold.hitId === eventId) return false;
  const src = resolveSrc(data.victimSlapPoseKey, data.victimSlapVariant);
  if (!src) return false;

  hold.hitId = eventId;
  hold.src = src;
  hold.poseKey = data.victimSlapPoseKey || null;
  hold.variant = data.victimSlapVariant != null ? data.victimSlapVariant : null;
  hold.mirrorFacing =
    data.victimSlapMirrorFacing != null ? data.victimSlapMirrorFacing : null;
  if (hitstopUntil > now) {
    // hitstop-before-event: adopt the existing freeze deadline immediately.
    hold.until = hitstopUntil;
    hold.pendingHitId = null;
    hold.pendingUntil = 0;
  } else {
    // event-before-hitstop: bridge one render until the deadline is published.
    hold.until = 0;
    hold.pendingHitId = eventId;
    hold.pendingUntil = now + STRUCK_LIMB_HOLD_BRIDGE_MS;
  }
  return true;
};

/**
 * Per-render resolution. Adopts a pending deadline, decides whether the struck
 * pose is drawn this frame, and releases the hold the instant it is not.
 *
 * @returns {boolean} true when the caller must draw `hold.src` this frame
 */
export const resolveStruckLimbHold = (hold, now, hitstopUntil, inHitReaction) => {
  if (!hold) return false;
  if (hold.pendingHitId) {
    if (hitstopUntil > now) {
      hold.until = hitstopUntil;
      hold.pendingHitId = null;
      hold.pendingUntil = 0;
    } else if (now >= hold.pendingUntil) {
      // Hitstop never arrived — abandon rather than invent a hold duration.
      hold.pendingHitId = null;
      hold.pendingUntil = 0;
    }
  }
  const holding = !!hold.src && hold.until > now && !!inHitReaction;
  if (hold.src && !holding && !hold.pendingHitId) {
    // Freeze is over (or the reaction ended first) — release now so the extended
    // limb is never visible outside hitstop.
    hold.src = null;
    hold.until = 0;
    hold.mirrorFacing = null;
    hold.poseKey = null;
    hold.variant = null;
  }
  return holding;
};

/** True while the rAF watcher must keep forcing renders for this hold. */
export const struckLimbHoldNeedsTick = (hold, now, showingHold) =>
  !!hold &&
  ((showingHold && now >= hold.until) ||
    (!!hold.pendingHitId && now < hold.pendingUntil));

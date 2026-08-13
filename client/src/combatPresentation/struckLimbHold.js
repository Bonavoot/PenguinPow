/**
 * PHASE 4A/4B — STRUCK-LIMB CONTACT-POSE HOLD (presentation only).
 *
 * A limb-only connect was unreadable: authoritative `isHit` lands on the same
 * frame as the contact, so the exposed arm vanished into the generic hit sprite
 * before the eye could register WHAT was struck — the limb-anchored spark then
 * read as a hit on empty air.
 *
 * This module owns the decision of whether to keep drawing the exact frame the
 * SERVER collided with (Phase 4A slap, Phase 4B palm). It is deliberately pure
 * so the ordering rules can be tested without a DOM.
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
  family: null,
  hitId: null,
  pendingHitId: null,
  pendingUntil: 0,
  /** Debug-only: why the last `player_hit` did or did not arm a hold. */
  decision: "idle",
  /** Debug-only: "idle" | "bridging" | "active" | "ended". */
  state: "idle",
});

/**
 * Authoritative contact stamp, generic across limb families.
 *
 * Phase 4B servers send `victimLimb*` for every family; the `victimSlap*`
 * fallback keeps a Phase 4A server (or a replayed Phase 4A payload) working
 * unchanged. Never merges the two — a payload uses one naming or the other.
 */
const limbStamp = (data) => ({
  poseKey: data.victimLimbPoseKey ?? data.victimSlapPoseKey ?? null,
  variant: data.victimLimbVariant ?? data.victimSlapVariant ?? null,
  mirrorFacing: data.victimLimbMirrorFacing ?? data.victimSlapMirrorFacing ?? null,
  family: data.victimLimbFamily ?? (data.victimSlapPoseKey ? "slap" : null),
});

/**
 * Stable identity for one authoritative contact, so a retransmitted packet
 * cannot restart the hold.
 */
export const struckLimbEventId = (data) => {
  if (!data) return null;
  if (data.hitId != null) return `limbhold:${data.hitId}`;
  return `limbhold:${limbStamp(data).poseKey || "?"}:${data.timestamp ?? ""}`;
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
 * Body slap/palm connect — freeze the pose the victim was DRAWING so the
 * generic hit sprite cannot eat the contact frame. Limb-only contacts stay
 * on armStruckLimbHold (server stamp). Never invents a duration.
 *
 * @param {*} snapshotSrc sprite the victim was showing before isHit
 */
export const armVictimContactHold = (
  hold,
  data,
  playerId,
  now,
  hitstopUntil,
  snapshotSrc
) => {
  if (!hold) return false;
  if (!data || data.victimId !== playerId || data.cinematicKill) {
    return false;
  }
  if (data.limbOnlyContact === true) return false;
  const isStrike =
    data.attackType === "slap" || data.isPalmThrust === true;
  if (!isStrike || !snapshotSrc) {
    if (data.victimId === playerId) {
      hold.decision = !isStrike ? "not_strike" : "no_snapshot";
    }
    return false;
  }
  const eventId = struckLimbEventId(data);
  if (!eventId || hold.hitId === eventId) {
    hold.decision = "duplicate";
    return false;
  }

  hold.hitId = eventId;
  hold.src = snapshotSrc;
  hold.poseKey = "victim_contact";
  hold.variant = null;
  hold.family = data.isPalmThrust ? "palm" : "slap";
  hold.mirrorFacing = null;
  hold.decision = "armed_contact";
  if (hitstopUntil > now) {
    hold.until = hitstopUntil;
    hold.pendingHitId = null;
    hold.pendingUntil = 0;
  } else {
    hold.until = 0;
    hold.pendingHitId = eventId;
    hold.pendingUntil = now + STRUCK_LIMB_HOLD_BRIDGE_MS;
  }
  return true;
};

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
  if (!hold) return false;
  if (!isStruckLimbHoldEligible(data, playerId)) {
    if (data && data.victimId === playerId) {
      hold.decision = data.cinematicKill ? "cinematic" : "not_limb_only";
    }
    return false;
  }
  const eventId = struckLimbEventId(data);
  // Duplicate / retransmitted event — must not restart the hold.
  if (!eventId || hold.hitId === eventId) {
    hold.decision = "duplicate";
    return false;
  }
  const stamp = limbStamp(data);
  const src = resolveSrc(stamp.poseKey, stamp.variant);
  if (!src) {
    hold.decision = `no_sprite:${stamp.poseKey || "?"}/${stamp.variant ?? "—"}`;
    return false;
  }

  hold.hitId = eventId;
  hold.src = src;
  hold.poseKey = stamp.poseKey;
  hold.variant = stamp.variant;
  hold.family = stamp.family;
  hold.mirrorFacing = stamp.mirrorFacing;
  hold.decision = "armed";
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
    hold.family = null;
    hold.state = "ended";
  } else {
    hold.state = holding ? "active" : hold.pendingHitId ? "bridging" : hold.state;
  }
  return holding;
};

/**
 * Final sprite precedence for one fighter render.
 *
 * Extracted verbatim from GameFighter so the ORDER ITSELF is testable: an active
 * struck-limb hold must outrank the sprite `getImageSrc` derives from
 * authoritative `isHit`. Authority is untouched — this only decides what is
 * drawn while the existing hitstop freeze runs.
 */
export const resolveFighterDisplaySprite = ({
  struckLimbHoldSrc,
  inDashWindup,
  justLandedFromDodge,
  rawSpriteSrc,
  idleSrc,
  recoveringSrc,
}) => {
  if (struckLimbHoldSrc) return struckLimbHoldSrc;
  if (inDashWindup) return recoveringSrc;
  if (justLandedFromDodge && rawSpriteSrc === idleSrc) return recoveringSrc;
  return rawSpriteSrc;
};

/**
 * Debug-only one-liner for the authored-hurtbox HUD. Pure; no gameplay effect.
 */
export const formatStruckLimbHoldHudLine = (hold, now, hitstopUntil) => {
  if (!hold) return "LIMB HOLD: —";
  const remaining =
    hold.until > now ? Math.round(hold.until - now) : hold.pendingHitId ? -1 : 0;
  const spriteName = (s) =>
    typeof s === "string" ? s.split("/").pop().split("?")[0] : s ? "asset" : "—";
  return (
    `LIMB HOLD state=${hold.state} decision=${hold.decision}` +
    ` family=${hold.family || "—"} pose=${hold.poseKey || "—"}` +
    ` variant=${hold.variant ?? "—"} face=${hold.mirrorFacing ?? "—"}` +
    ` src=${spriteName(hold.src)}` +
    ` left=${remaining < 0 ? "bridging" : `${remaining}ms`}` +
    ` hitstopIn=${
      hitstopUntil > now ? `${Math.round(hitstopUntil - now)}ms` : "none"
    }`
  );
};

/** True while the rAF watcher must keep forcing renders for this hold. */
export const struckLimbHoldNeedsTick = (hold, now, showingHold) =>
  !!hold &&
  ((showingHold && now >= hold.until) ||
    (!!hold.pendingHitId && now < hold.pendingUntil));

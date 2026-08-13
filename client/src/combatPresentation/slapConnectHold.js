/**
 * SLAP CONNECT — attacker strike-pose hold (presentation only).
 *
 * Late-active slap confirms can land after HIT_POSE_HOLD_MS, when the director
 * has already cut to the ready-stance recovery frame. Hitstop then freezes
 * that retracted pose at tip-meets-body spacing — the palm is gone on the
 * money shot.
 *
 * On a landed slap, force the extended hit frame for the existing display
 * hitstop. Same bridge / duplicate / no-invented-duration rules as the
 * struck-limb hold. Does not change sim, hitboxes, or +0 frame advantage.
 */

export const SLAP_CONNECT_HOLD_BRIDGE_MS = 120;

export const createSlapConnectHold = () => ({
  until: 0,
  pendingUntil: 0,
  hitId: null,
});

export const slapConnectEventId = (data) => {
  if (!data) return null;
  if (data.hitId != null) return `slapconnect:${data.hitId}`;
  return `slapconnect:${data.timestamp ?? ""}`;
};

export const isSlapConnectHoldEligible = (data, playerId) =>
  !!data &&
  !!playerId &&
  data.attackerId === playerId &&
  data.attackType === "slap" &&
  !data.isPalmThrust &&
  !data.cinematicKill;

export const armSlapConnectHold = (hold, data, playerId, now, hitstopUntil) => {
  if (!hold) return false;
  if (!isSlapConnectHoldEligible(data, playerId)) return false;
  const eventId = slapConnectEventId(data);
  if (!eventId || hold.hitId === eventId) return false;

  hold.hitId = eventId;
  if (hitstopUntil > now) {
    hold.until = hitstopUntil;
    hold.pendingUntil = 0;
  } else {
    hold.until = 0;
    hold.pendingUntil = now + SLAP_CONNECT_HOLD_BRIDGE_MS;
  }
  return true;
};

export const resolveSlapConnectHold = (hold, now, hitstopUntil) => {
  if (!hold) return false;
  if (hold.pendingUntil) {
    if (hitstopUntil > now) {
      hold.until = hitstopUntil;
      hold.pendingUntil = 0;
    } else if (now >= hold.pendingUntil) {
      hold.pendingUntil = 0;
    }
  }
  if (hold.until > now) return true;
  if (hold.until && now >= hold.until) {
    hold.until = 0;
  }
  return false;
};

export const slapConnectHoldNeedsTick = (hold, now, showing) =>
  !!hold &&
  ((showing && now >= hold.until) ||
    (!!hold.pendingUntil && now < hold.pendingUntil));

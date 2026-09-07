/**
 * Charge-hold release prediction gate.
 * MUST match server-io/constants.js CHARGE_MIN_HOLD_MS — a tap before this
 * clock must stay on the hold pose (server buffers the release).
 */
import { CHARGE_MIN_HOLD_MS } from "../config/combatTiming.js";

export { CHARGE_MIN_HOLD_MS };

/**
 * True when local charge_release may predict the lunge.
 * chargeStartAt / now are the same client clock (typically performance.now).
 */
export function shouldPredictChargeRelease({
  chargeStartAt,
  now,
  minHoldMs = CHARGE_MIN_HOLD_MS,
} = {}) {
  if (typeof chargeStartAt !== "number" || !(chargeStartAt > 0)) return false;
  if (typeof now !== "number") return false;
  return now - chargeStartAt >= minHoldMs;
}

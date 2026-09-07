/**
 * Charged DEMOLISHED fly-out — display-rate integration.
 *
 * The snapshot interpolator is tuned for walk/slide (~240 px/s). A cinematic
 * KO is ~2000 px/s with no friction, after a 550 ms hitstop where sample()
 * never runs. Feeding that rocket through the walk timeline makes the victim
 * stutter (playhead leap → 30 ms extrapolate → resync backward).
 *
 * Integrate the server knockback on the display clock (same
 * `v * dtMs * speedFactor` the sim uses). Soft-correcting toward the newest
 * snapshot leaked ~2px of 64 Hz wobble into the rocket — hard-snap only
 * if the integrator truly drifted off.
 */

import { PREDICTION_CONSTANTS } from "../prediction/movementPredictor.js";

const SPEED_FACTOR = PREDICTION_CONSTANTS.SPEED_FACTOR;
const MAX_DT_MS = 50;
const HARD_SNAP_PX = 140;

export function createCinematicKillFlight() {
  return { active: false, x: null, lastTs: null };
}

export function armCinematicKillFlight(flight, x) {
  if (!flight) return;
  flight.active = true;
  if (typeof x === "number" && Number.isFinite(x)) flight.x = x;
  flight.lastTs = null;
}

export function clearCinematicKillFlight(flight) {
  if (!flight) return;
  flight.active = false;
  flight.x = null;
  flight.lastTs = null;
}

/**
 * Advance the fly-out. First call after arm/unfreeze seeds without moving.
 * @returns {{ x: number, y: number } | null}
 */
export function stepCinematicKillFlight(flight, { nowMs, kbX, authorityX, y }) {
  if (!flight || !flight.active) return null;
  if (flight.x == null && typeof authorityX === "number") flight.x = authorityX;
  if (flight.x == null) return null;

  if (flight.lastTs != null) {
    const dt = Math.max(0, Math.min(nowMs - flight.lastTs, MAX_DT_MS));
    flight.x += (kbX || 0) * dt * SPEED_FACTOR;
    if (typeof authorityX === "number") {
      const err = authorityX - flight.x;
      if (Math.abs(err) > HARD_SNAP_PX) flight.x = authorityX;
    }
  }
  flight.lastTs = nowMs;
  return { x: flight.x, y };
}

export const CINEMATIC_KILL_FLIGHT = {
  SPEED_FACTOR,
  MAX_DT_MS,
  HARD_SNAP_PX,
};

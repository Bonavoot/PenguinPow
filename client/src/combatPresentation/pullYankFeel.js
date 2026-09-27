/**
 * Client mirror of server-io/pullYankMotion hop timing.
 * Hop dust must use the live tween — the old 650ms / 4-hop schedule
 * was leftover from a longer pull and fired in the wrong place.
 */

export const YANK_SNAP_END = 0.42;
const HARD_SNAP_END = 0.48;
const HARD_HOP_DELAY = 0.50;

export function clamp01(v) {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(1, n));
}

/** Same curve as server-io/smashLaunchMotion — posture weight, no dead zone. */
export function smashLaunchAmount(power) {
  return clamp01(power);
}

export function yankSnapEnd(power) {
  const a = smashLaunchAmount(power);
  return YANK_SNAP_END + (HARD_SNAP_END - YANK_SNAP_END) * a;
}

export function yankHopDelay(power) {
  const a = smashLaunchAmount(power);
  return YANK_SNAP_END + (HARD_HOP_DELAY - YANK_SNAP_END) * a;
}

export function pullYankHopProfile(power) {
  const p = clamp01(power);
  return {
    hopDelay: yankHopDelay(p),
    hopCount: 2,
    hopHeights: [Math.round(5 + p * 6), Math.round(2 + p * 3)],
  };
}

export function pullYankHopSchedule(durationMs, power) {
  const dur = Math.max(1, durationMs || 400);
  const hops = pullYankHopProfile(power);
  const hopWindowStart = dur * hops.hopDelay;
  const hopDuration = (dur * (1 - hops.hopDelay)) / hops.hopCount;
  return {
    durationMs: dur,
    hopDelay: hops.hopDelay,
    hopCount: hops.hopCount,
    hopHeights: hops.hopHeights,
    hopWindowStart,
    hopDuration,
  };
}

export function pullYankCrowdIntensity(power) {
  const p = clamp01(power);
  if (p >= 0.82) return "heavy";
  if (p >= 0.48) return "medium";
  return null;
}

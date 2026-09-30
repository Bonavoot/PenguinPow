/**
 * Antarctica sky: day, afternoon, night.
 * Each phase takes a third of the run.
 *   15-day basho → 5 / 5 / 5
 *   7-day basho  → 3 / 2 / 2
 *   best of 3    → round 1 / 2 / 3
 */

export const SKY_PHASES = Object.freeze(["day", "afternoon", "night"]);

/**
 * @param {number} step 1-based day or round
 * @param {number} total length of the run
 * @returns {0|1|2}
 */
export function skyPhaseIndex(step, total) {
  const n = Number.isFinite(total) && total > 0 ? Math.floor(total) : 1;
  const s = Number.isFinite(step) && step > 0 ? Math.floor(step) : 1;
  const clamped = Math.min(s, n);
  const i = Math.floor(((clamped - 1) * 3) / n);
  if (i < 0) return 0;
  if (i > 2) return 2;
  return i;
}

/** @param {number} step @param {number} total @returns {"day"|"afternoon"|"night"} */
export function skyPhaseName(step, total) {
  return SKY_PHASES[skyPhaseIndex(step, total)];
}

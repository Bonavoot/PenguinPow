/**
 * Clinch kill-throw arc. Rise is the same ballistic ease-out either way.
 * The fall lands on GROUND_LEVEL when the toss stays on the platform, and on
 * the lower apron (GROUND_LEVEL - DOHYO_FALL_DEPTH) when it clears the dohyo
 * edge. Same duration — they just have farther to drop, so the body arrives
 * flat on whichever surface it actually hits.
 *
 * On-ring fall must stay identical to the previous inline formula:
 *   y = ground + arcHeight * (1 - fallT²)
 */

const KILL_THROW_PEAK_AT = 0.48;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function sampleKillThrowY(progress, { ground, arcHeight, landY }) {
  const p = clamp01(progress);
  const peakY = ground + arcHeight;
  if (p < KILL_THROW_PEAK_AT) {
    const riseT = p / KILL_THROW_PEAK_AT;
    const eased = 1 - (1 - riseT) * (1 - riseT);
    return ground + eased * arcHeight;
  }
  const fallT = (p - KILL_THROW_PEAK_AT) / (1 - KILL_THROW_PEAK_AT);
  const eased = fallT * fallT;
  return peakY + (landY - peakY) * eased;
}

module.exports = {
  KILL_THROW_PEAK_AT,
  sampleKillThrowY,
};

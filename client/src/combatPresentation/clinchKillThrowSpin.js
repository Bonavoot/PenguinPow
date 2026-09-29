/**
 * Kill-throw tumble. The sprite used to play a CSS keyframe spin. Crossing
 * the dohyo edge portals the fighter into `.fallen-actors`, which remounts
 * the element and restarts that animation from upright in mid-air.
 *
 * Rotation is derived from where the body is in the arc, and kept on a ref
 * the portal cannot reset:
 *   • rise  — ease toward ~45° at the crown (same samples as the old spin)
 *   • fall  — the remaining rotation runs with the drop, and is exactly flat
 *     when the anchor reaches the landing plane (ring or the lower apron)
 *
 * The 18% translateY at flat is the old keyframe compensation: a centre-pivoted
 * standing sprite's underside sits above the box, and the prone landing art
 * sits below it. Closing that gap is what makes the swap a plant, not a pop.
 */

export const KILL_THROW_ARC_HEIGHT = 240;
export const KILL_THROW_PEAK_AT = 0.48;

const SPIN_KEYS = [
  { p: 0, rot: 0, ty: 0 },
  { p: 0.3, rot: 28, ty: 1 },
  { p: 0.62, rot: 58, ty: 6 },
  { p: 1, rot: 90, ty: 18 },
];

const CROWN_FRACTION = 0.75;
const FALL_ARM_DROP_PX = 12;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function createKillThrowFlight() {
  return {
    active: false,
    peaked: false,
    maxY: -Infinity,
    progress: 0,
    offDohyo: false,
    fallStartY: 0,
    fallStartProgress: 0,
  };
}

export function resetKillThrowFlight(flight) {
  if (!flight) return;
  flight.active = false;
  flight.peaked = false;
  flight.maxY = -Infinity;
  flight.progress = 0;
  flight.offDohyo = false;
  flight.fallStartY = 0;
  flight.fallStartProgress = 0;
}

export function killThrowSpinFromProgress(progress) {
  const p = clamp01(progress);
  let i = 1;
  while (i < SPIN_KEYS.length - 1 && SPIN_KEYS[i].p < p) i += 1;
  const a = SPIN_KEYS[i - 1];
  const b = SPIN_KEYS[i];
  const span = b.p - a.p || 1;
  const t = clamp01((p - a.p) / span);
  return {
    rotateDeg: a.rot + (b.rot - a.rot) * t,
    translateYPct: a.ty + (b.ty - a.ty) * t,
  };
}

export function killThrowSpinTransform(facing, pose) {
  const sx = facing === 1 ? 1 : -1;
  const ty = pose.translateYPct.toFixed(2);
  const rot = pose.rotateDeg.toFixed(2);
  return `translateY(${ty}%) scaleX(${sx}) rotate(${rot}deg)`;
}

function riseProgress(y, ground, arcHeight) {
  const eased = clamp01((y - ground) / arcHeight);
  const riseT = 1 - Math.sqrt(Math.max(0, 1 - eased));
  return riseT * KILL_THROW_PEAK_AT;
}

/**
 * Advance the tumble from the displayed pose. Safe to call twice with the
 * same sample (render + the position loop).
 *
 * @returns {{rotateDeg:number, translateYPct:number, progress:number, landY:number, peaked:boolean} | null}
 */
export function poseKillThrowFlight(flight, sample) {
  if (!flight) return null;
  const ground = sample.ground;
  const arcHeight = sample.arcHeight;
  const y = sample.y;
  const x = sample.x;
  const xOff =
    typeof x === "number" &&
    (x <= sample.dohyoLeft || x >= sample.dohyoRight);

  if (!flight.active) {
    flight.active = true;
    flight.peaked = false;
    flight.maxY = y;
    flight.progress = 0;
    flight.offDohyo = false;
    flight.fallStartY = 0;
    flight.fallStartProgress = 0;
  }

  // Known at launch (server) and again if they actually clear the edge.
  // Upgrading the landing plane mid-fall must not rewind the tumble — the
  // progress latch below only moves forward, and flat is still the new ground.
  if (sample.offDohyo || xOff) flight.offDohyo = true;
  const landY = flight.offDohyo ? ground - sample.fallDepth : ground;

  if (!flight.peaked) {
    if (y > flight.maxY) flight.maxY = y;
    flight.progress = Math.max(flight.progress, riseProgress(y, ground, arcHeight));
    const crowned = flight.maxY >= ground + arcHeight * CROWN_FRACTION;
    if (crowned && y <= flight.maxY - FALL_ARM_DROP_PX) {
      flight.peaked = true;
      flight.fallStartY = y;
      flight.fallStartProgress = flight.progress;
    }
  }

  if (flight.peaked) {
    const span = flight.fallStartY - landY;
    const t = span <= 1 ? 1 : clamp01((flight.fallStartY - y) / span);
    const next = flight.fallStartProgress + (1 - flight.fallStartProgress) * t;
    flight.progress = Math.max(flight.progress, next);
  }

  const spin = killThrowSpinFromProgress(flight.progress);
  return {
    ...spin,
    progress: flight.progress,
    landY,
    peaked: flight.peaked,
  };
}

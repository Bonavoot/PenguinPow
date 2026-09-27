/**
 * Where the painted feet actually are.
 *
 * Measured from the opaque pixels in the bottom 14px of each gameplay pose
 * (tools/audit-pose-geometry.js alpha threshold, 2026-09-22), converted to
 * world pixels at the fighter box width (12.30% of 1280 = 157.44).
 *
 * Art faces left. Local X is image-space: positive = image right.
 * World X = fighterX + facingSign * localX.
 * facing === 1 is unflipped; facing === -1 mirrors (scaleX -1).
 *
 * Do not center effects on the sprite box. Idle / ready / hit soles sit
 * ~28px to image-right of center. The slide pose is two pads, the same
 * ones ParticleEngine slideArtFeet already uses for the belt smoke
 * (measured this pass: -55 and +38; the smoke constants -50 / +39 stay,
 * so the ice scar lands on the smoke, not beside it).
 */

export const SPRITE_WORLD_SIZE = 1280 * 0.123;

/** Image-right bias of the standing sole cluster (idle 25, ready 32, hit 30). */
export const STANDING_SOLE_BIAS = 28;
/** World px of that cluster. Speed can widen the contact a little past this. */
export const STANDING_SOLE_SPAN = 32;

/**
 * sliding.png pads. Kept identical to ParticleEngine SLIDE_FOOT_LEFT/RIGHT
 * so belt scars and belt smoke share one contact.
 */
export const SLIDE_FOOT_LEFT = -50;
export const SLIDE_FOOT_RIGHT = 39;

/** Transparent pixels under the sole, in world px (padB × sprite scale). */
export const STANDING_SOLE_LIFT = 5.2;
export const SLIDING_SOLE_LIFT = 4.1;

export function facingSign(facing) {
  return facing === -1 ? -1 : 1;
}

/**
 * Ground-contact pose for the feet under the current body.
 * "air" means the painted soles are not on the ice.
 */
export function contactPoseFromFighter(fighter, y, groundY = 286) {
  if (!fighter) return "air";
  if (
    fighter.isDodging ||
    fighter.isFlapping ||
    fighter.isSlideJumping ||
    fighter.isRopeJumping ||
    fighter.isBeingThrown
  ) {
    return "air";
  }
  if (
    typeof y === "number" &&
    y > groundY + 10 &&
    !fighter.isSidestepping
  ) {
    return "air";
  }
  if (fighter.isIceSliding && !fighter.isDodging && !fighter.isSlideJumping) {
    return "sliding";
  }
  if (fighter.isSidestepping) return "sidestep";
  return "standing";
}

/** World X of each painted sole. */
export function worldFootXs(x, facing, pose) {
  const face = facingSign(facing);
  if (pose === "sliding") {
    return [x + face * SLIDE_FOOT_LEFT, x + face * SLIDE_FOOT_RIGHT];
  }
  if (pose === "sidestep") return [x];
  return [x + face * STANDING_SOLE_BIAS];
}

export function soleLiftForPose(pose) {
  return pose === "sliding" ? SLIDING_SOLE_LIFT : STANDING_SOLE_LIFT;
}

/**
 * Contact oval inside the fighter box. `shift` is added to 50% (box center)
 * so the oval sits on the sole cluster, mirrored by facing.
 */
export function iceContactStyle(pose, facing, speed01 = 0) {
  if (pose === "air") {
    return { shift: "0%", width: "22%", pool: "40%", lip: "34%" };
  }
  const face = facingSign(facing);
  const speed = Math.max(0, Math.min(1, speed01 || 0));
  if (pose === "sliding") {
    const bias = (SLIDE_FOOT_LEFT + SLIDE_FOOT_RIGHT) / 2;
    const shift = (bias / SPRITE_WORLD_SIZE) * 100 * face;
    return {
      shift: `${shift.toFixed(2)}%`,
      width: "70%",
      pool: "78%",
      lip: "72%",
    };
  }
  if (pose === "sidestep") {
    return { shift: "0%", width: "30%", pool: "46%", lip: "40%" };
  }
  const shift = (STANDING_SOLE_BIAS / SPRITE_WORLD_SIZE) * 100 * face;
  const width = 22 + speed * 8;
  return {
    shift: `${shift.toFixed(2)}%`,
    width: `${width.toFixed(1)}%`,
    pool: `${(width + 16).toFixed(1)}%`,
    lip: `${(width + 10).toFixed(1)}%`,
  };
}

/**
 * Gyoji plant geometry — lockstep with `.gyoji` in App.css.
 * Speech bubbles and the ice reflection derive from these so the
 * tail stays aimed at his head/mouth across arena scales.
 *
 * Sprite is square (960×960). Width is % of the arena; height matches
 * width in px, expressed as the same value in `cqw` for mouth lift.
 */
export const GYOJI_LEFT_PCT = 42.75;
export const GYOJI_WIDTH_PCT = 14.5;
export const GYOJI_FOOT_BOTTOM_PCT = 47.75;

/** Horizontal center of the planted gyoji (left + half width). */
export const GYOJI_CENTER_PCT =
  GYOJI_LEFT_PCT + GYOJI_WIDTH_PCT / 2;

/**
 * Mouth/face lift above the feet, as a fraction of sprite height.
 * Face sits in the upper third under the eboshi; tuned so the SVG
 * center-bottom tail terminates at/just above the mouth line while
 * leaving headroom for the hakkiyoi camera zoom-punch.
 */
export const GYOJI_MOUTH_FROM_FEET = 0.70;

/** CSS length for mouth anchor above the foot plant. */
export const GYOJI_MOUTH_BOTTOM = `calc(${GYOJI_FOOT_BOTTOM_PCT}% + ${
  GYOJI_MOUTH_FROM_FEET * GYOJI_WIDTH_PCT
}cqw)`;

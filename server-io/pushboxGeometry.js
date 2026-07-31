/**
 * Shared pushbox half-width — single source of truth for grounded separation.
 *
 * Used by calculateEffectiveHitboxSize() and landing resolution so the two
 * cannot drift. Intentionally tiny and dependency-light (constants only).
 *
 * Do not expand this into a pose-geometry module.
 */

const { HITBOX_DISTANCE_VALUE } = require("./constants");

/**
 * Symmetric pushbox half-width in world px.
 * Falsy sizeMultiplier falls back to 1 — matches historical hitbox behavior.
 * @param {number} [sizeMultiplier=1]
 * @returns {number}
 */
function getPushboxHalfWidth(sizeMultiplier) {
  return HITBOX_DISTANCE_VALUE * (sizeMultiplier || 1);
}

/**
 * Minimum legal center-to-center distance for two grounded pushboxes.
 * @param {number} jumperSizeMult
 * @param {number} opponentSizeMult
 * @returns {number}
 */
function getMinimumCenterDistance(jumperSizeMult, opponentSizeMult) {
  return getPushboxHalfWidth(jumperSizeMult) + getPushboxHalfWidth(opponentSizeMult);
}

module.exports = {
  getPushboxHalfWidth,
  getMinimumCenterDistance,
};

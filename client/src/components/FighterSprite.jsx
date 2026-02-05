/**
 * FighterSprite - Sprite animation configuration registry
 * 
 * This module provides utilities to register and lookup spritesheet configurations.
 * Spritesheets are animated using CSS background-position stepping.
 */

// Spritesheet animation configurations
// Maps sprite URLs (including data URLs from recoloring) to their animation data
const spritesheetConfigs = new Map();

/**
 * Register a spritesheet with its animation config
 * @param {string} src - The sprite URL (can be a data URL)
 * @param {object} config - { frameCount, fps }
 */
export function registerSpritesheetConfig(src, config) {
  spritesheetConfigs.set(src, config);
}

/**
 * Check if a source is an animated spritesheet
 */
export function isAnimatedSprite(src) {
  return spritesheetConfigs.has(src);
}

/**
 * Get spritesheet config
 */
export function getSpritesheetConfig(src) {
  return spritesheetConfigs.get(src);
}

/**
 * Get all registered spritesheet sources (for debugging)
 */
export function getAllSpritesheetSources() {
  return Array.from(spritesheetConfigs.keys());
}

/**
 * Clear all registered spritesheets (useful for hot reload)
 */
export function clearSpritesheetConfigs() {
  spritesheetConfigs.clear();
}

// Configuration for animated spritesheets
// Maps animation names to their spritesheet equivalents
//
// MEMORY OPTIMIZATION: Using string keys instead of imported APNG URLs
// to avoid loading large APNG files into memory just for lookup keys.

// Import spritesheets
import pumoWaddleSpritesheet from "../assets/spritesheets/pumo-waddle_spritesheet.png";
import pumoArmySpritesheet from "../assets/spritesheets/pumo-army_spritesheet.png";
import hitSpritesheet from "../assets/spritesheets/hit_spritesheet.png";
import bowSpritesheet from "../assets/spritesheets/bow_spritesheet.png";
import blockingSpritesheet from "../assets/spritesheets/blocking_spritesheet.png";
import grabAttemptSpritesheet from "../assets/spritesheets/grab-attempt_spritesheet.png";
import isBeingGrabbedSpritesheet from "../assets/spritesheets/is-being-grabbed_spritesheet.png";
import snowballThrowSpritesheet from "../assets/spritesheets/snowball-throw_spritesheet.png";
import atTheRopesSpritesheet from "../assets/spritesheets/at-the-ropes_spritesheet.png";
import crouchStrafingSpritesheet from "../assets/spritesheets/crouch-strafing_spritesheet.png";
import isPerfectParriedSpritesheet from "../assets/spritesheets/is_perfect_parried_spritesheet.png";

// Map animation names to spritesheet configs (using string keys to avoid loading APNGs)
export const SPRITESHEET_CONFIG_BY_NAME = {
  pumoWaddle: {
    spritesheet: pumoWaddleSpritesheet,
    frameCount: 21,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: true,
  },
  pumoArmy: {
    spritesheet: pumoArmySpritesheet,
    frameCount: 10,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: true,
  },
  hit: {
    spritesheet: hitSpritesheet,
    frameCount: 3,
    frameWidth: 480,
    frameHeight: 480,
    fps: 16,
    loop: false,
  },
  bow: {
    spritesheet: bowSpritesheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
    loop: false,
  },
  blocking: {
    spritesheet: blockingSpritesheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
    loop: true,
  },
  grabAttempt: {
    spritesheet: grabAttemptSpritesheet,
    frameCount: 20,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: false,
  },
  beingGrabbed: {
    spritesheet: isBeingGrabbedSpritesheet,
    frameCount: 2,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
    loop: true,
  },
  snowballThrow: {
    spritesheet: snowballThrowSpritesheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 32,
    loop: false,
  },
  atTheRopes: {
    spritesheet: atTheRopesSpritesheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
    loop: true,
  },
  crouchStrafing: {
    spritesheet: crouchStrafingSpritesheet,
    frameCount: 14,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
    loop: true,
  },
  isPerfectParried: {
    spritesheet: isPerfectParriedSpritesheet,
    frameCount: 7,
    frameWidth: 480,
    frameHeight: 480,
    fps: 15,
    loop: true,
  },
};

// Legacy: Map of source URLs to configs (for backwards compatibility)
// Built dynamically from the name-based config
export const SPRITESHEET_CONFIG = {};

// Mapping from filename patterns to config names
const FILENAME_TO_CONFIG = {
  'pumo-waddle': 'pumoWaddle',
  'pumo-army': 'pumoArmy',
  'hit': 'hit',
  'bow': 'bow',
  'blocking': 'blocking',
  'grab-attempt': 'grabAttempt',
  'is-being-grabbed': 'beingGrabbed',
  'being-grabbed': 'beingGrabbed',
  'snowball-throw': 'snowballThrow',
  'at-the-ropes': 'atTheRopes',
  'crouch-strafing': 'crouchStrafing',
  'is_perfect_parried': 'isPerfectParried',
};

// Check if a source has a spritesheet animation config
export const isAnimatedSpritesheet = (src) => {
  if (!src) return false;
  // Check legacy config first
  if (SPRITESHEET_CONFIG[src]) return true;
  // Check by filename pattern
  return getSpritesheetConfig(src) !== null;
};

// Get the spritesheet config for a source URL or name
export const getSpritesheetConfig = (src) => {
  if (!src || typeof src !== 'string') return null;
  
  // Check legacy config first (for any pre-registered URLs)
  if (SPRITESHEET_CONFIG[src]) {
    return SPRITESHEET_CONFIG[src];
  }
  
  // Try to match by filename pattern
  const srcLower = src.toLowerCase();
  for (const [pattern, configName] of Object.entries(FILENAME_TO_CONFIG)) {
    if (srcLower.includes(pattern)) {
      return SPRITESHEET_CONFIG_BY_NAME[configName] || null;
    }
  }
  
  return null;
};

// Get config directly by animation name
export const getSpritesheetConfigByName = (name) => {
  return SPRITESHEET_CONFIG_BY_NAME[name] || null;
};

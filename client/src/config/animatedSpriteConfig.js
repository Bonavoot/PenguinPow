// Configuration for animated spritesheets
// Maps animation names to their spritesheet equivalents
//
// UNIFIED SPRITES: All players now use BLUE sprites as the base.
// The recoloring system handles Player 2's color (defaults to red).
//
// MEMORY OPTIMIZATION: Using string keys instead of imported APNG URLs
// to avoid loading large APNG files into memory just for lookup keys.

// Import ONLY spritesheets (not the original APNGs)
import pumoWaddle2Spritesheet from "../assets/spritesheets/pumo-waddle2_spritesheet.png";
import pumoArmy2Spritesheet from "../assets/spritesheets/pumo-army2_spritesheet.png";
import hit2Spritesheet from "../assets/spritesheets/hit2_spritesheet.png";
import bow2Spritesheet from "../assets/spritesheets/bow2_spritesheet.png";
// NOTE: blocking_spritesheet.png is actually BLUE (files were mislabeled)
import blockingSpritesheet from "../assets/spritesheets/blocking_spritesheet.png";
import grabAttempt2Spritesheet from "../assets/spritesheets/grab-attempt2_spritesheet.png";
import isBeingGrabbed2Spritesheet from "../assets/spritesheets/is-being-grabbed2_spritesheet.png";
import snowballThrow2Spritesheet from "../assets/spritesheets/snowball-throw2_spritesheet.png";
import atTheRopes2Spritesheet from "../assets/spritesheets/at-the-ropes2_spritesheet.png";
import crouchStrafing2Spritesheet from "../assets/spritesheets/crouch-strafing2_spritesheet.png";
// NOTE: Dodging is a static image (dodging2.png), not an animated spritesheet
// The old red dodging_spritesheet.png is not used for the unified blue sprites

// Map animation names to spritesheet configs (using string keys to avoid loading APNGs)
export const SPRITESHEET_CONFIG_BY_NAME = {
  pumoWaddle: {
    spritesheet: pumoWaddle2Spritesheet,
    frameCount: 21,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: true,
  },
  pumoArmy: {
    spritesheet: pumoArmy2Spritesheet,
    frameCount: 10,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: true,
  },
  hit: {
    spritesheet: hit2Spritesheet,
    frameCount: 3,
    frameWidth: 480,
    frameHeight: 480,
    fps: 16,
    loop: false,
  },
  bow: {
    spritesheet: bow2Spritesheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
    loop: false,
  },
  blocking: {
    spritesheet: blockingSpritesheet,
    frameCount: 6,  // blocking_spritesheet (blue) is 2880x480 = 6 frames
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
    loop: true,
  },
  grabAttempt: {
    spritesheet: grabAttempt2Spritesheet,
    frameCount: 20,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: false,
  },
  beingGrabbed: {
    spritesheet: isBeingGrabbed2Spritesheet,
    frameCount: 2,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
    loop: true,
  },
  snowballThrow: {
    spritesheet: snowballThrow2Spritesheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 32,
    loop: false,
  },
  atTheRopes: {
    spritesheet: atTheRopes2Spritesheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
    loop: true,
  },
  crouchStrafing: {
    spritesheet: crouchStrafing2Spritesheet,
    frameCount: 14,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
    loop: true,
  },
  // NOTE: Dodging is a static image for blue sprites (dodging2.png), not an animated spritesheet
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
  // NOTE: 'dodging' removed - blue dodge is a static image, not an animated spritesheet
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
  if (!src) return null;
  
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

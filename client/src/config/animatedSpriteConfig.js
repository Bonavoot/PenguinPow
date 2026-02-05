// Configuration for animated spritesheets
// Maps original APNG/GIF sources to their spritesheet equivalents
//
// UNIFIED SPRITES: All players now use BLUE sprites as the base.
// The recoloring system handles Player 2's color (defaults to red).

// Import all spritesheets (BLUE versions only)
import pumoWaddle2Spritesheet from "../assets/spritesheets/pumo-waddle2_spritesheet.png";
import pumoArmy2Spritesheet from "../assets/spritesheets/pumo-army2_spritesheet.png";
import hit2Spritesheet from "../assets/spritesheets/hit2_spritesheet.png";
import bow2Spritesheet from "../assets/spritesheets/bow2_spritesheet.png";
import blockingSpritesheet from "../assets/spritesheets/blocking_spritesheet.png";
import grabAttempt2Spritesheet from "../assets/spritesheets/grab-attempt2_spritesheet.png";
import isBeingGrabbed2Spritesheet from "../assets/spritesheets/is-being-grabbed2_spritesheet.png";
import snowballThrow2Spritesheet from "../assets/spritesheets/snowball-throw2_spritesheet.png";
import atTheRopes2Spritesheet from "../assets/spritesheets/at-the-ropes2_spritesheet.png";
import crouchStrafing2Spritesheet from "../assets/spritesheets/crouch-strafing2_spritesheet.png";
import dodgingSpritesheet from "../assets/spritesheets/dodging_spritesheet.png";

// Import original BLUE animated files for mapping
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import pumoArmy2 from "../assets/pumo-army2.png";
import hit2 from "../assets/hit2.png";
import bow2 from "../assets/bow2.png";
import blocking from "../assets/blocking.png";    // Blue blocking (used as crouching2)
import grabAttempt2 from "../assets/grab-attempt2.png";
import beingGrabbed2 from "../assets/is-being-grabbed2.gif";
import snowballThrow2 from "../assets/snowball-throw2.png";
import atTheRopes2 from "../assets/at-the-ropes2.png";
import crouchStrafing2Apng from "../assets/crouch-strafing2.png";
import dodging2 from "../assets/dodging2.png";

// Map original sources to spritesheet configs
// Both players use these BLUE sprites - recoloring handles Player 2's color
export const SPRITESHEET_CONFIG = {
  // Waddle animation
  [pumoWaddle2]: {
    spritesheet: pumoWaddle2Spritesheet,
    frameCount: 21,
    frameWidth: 1024,
    frameHeight: 1024,
    fps: 40,
    loop: true,
  },
  // Pumo Army animation
  [pumoArmy2]: {
    spritesheet: pumoArmy2Spritesheet,
    frameCount: 10,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: true,
  },
  // Hit animation
  [hit2]: {
    spritesheet: hit2Spritesheet,
    frameCount: 3,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
    loop: false,
  },
  // Bow animation
  [bow2]: {
    spritesheet: bow2Spritesheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
    loop: false,
  },
  // Blocking/Crouching animation
  [blocking]: {
    spritesheet: blockingSpritesheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
    loop: true,
  },
  // Grab attempt animation
  [grabAttempt2]: {
    spritesheet: grabAttempt2Spritesheet,
    frameCount: 20,
    frameWidth: 480,
    frameHeight: 480,
    fps: 40,
    loop: false,
  },
  // Being grabbed animation
  [beingGrabbed2]: {
    spritesheet: isBeingGrabbed2Spritesheet,
    frameCount: 2,
    frameWidth: 1024,
    frameHeight: 1024,
    fps: 8,
    loop: true,
  },
  // Snowball throw animation
  [snowballThrow2]: {
    spritesheet: snowballThrow2Spritesheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 32,
    loop: false,
  },
  // At the ropes animation
  [atTheRopes2]: {
    spritesheet: atTheRopes2Spritesheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
    loop: true,
  },
  // Crouch strafing animation
  [crouchStrafing2Apng]: {
    spritesheet: crouchStrafing2Spritesheet,
    frameCount: 14,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
    loop: true,
  },
  // Dodging animation (static PNG, not animated spritesheet)
  // Note: dodging2 is a static image, but we include for completeness
};

// Check if a source has a spritesheet animation config
export const isAnimatedSpritesheet = (src) => {
  return src && SPRITESHEET_CONFIG[src] !== undefined;
};

// Get the spritesheet config for a source
export const getSpritesheetConfig = (src) => {
  return SPRITESHEET_CONFIG[src] || null;
};

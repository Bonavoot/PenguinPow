/**
 * Sprite Configuration
 * 
 * Central configuration for all game sprites.
 * 
 * UNIFIED SPRITES: Both players use BLUE sprites as base.
 * The recoloring system handles Player 2's color (defaults to red).
 * 
 * ADDING A NEW ANIMATION:
 * 1. Create the spritesheet PNG (frames laid out horizontally)
 * 2. Add a JSON file with frameCount, frameWidth, frameHeight
 * 3. Add an entry to the ANIMATED_SPRITES section below
 */

// ============================================
// SPRITESHEET IMPORTS
// ============================================
import pumoWaddleSheet from "../assets/spritesheets/pumo-waddle_spritesheet.png";
import pumoArmySheet from "../assets/spritesheets/pumo-army_spritesheet.png";
import blockingSheet from "../assets/spritesheets/blocking_spritesheet.png";
import bowSheet from "../assets/spritesheets/bow_spritesheet.png";
import grabAttemptSheet from "../assets/spritesheets/grab-attempt_spritesheet.png";
import hitSheet from "../assets/spritesheets/hit_spritesheet.png";
import snowballThrowSheet from "../assets/spritesheets/snowball-throw_spritesheet.png";
import atTheRopesSheet from "../assets/spritesheets/at-the-ropes_spritesheet.png";
import crouchStrafingSheet from "../assets/spritesheets/crouch-strafing_spritesheet.png";
import beingGrabbedSheet from "../assets/spritesheets/is-being-grabbed_spritesheet.png";
import isPerfectParriedSheet from "../assets/spritesheets/is_perfect_parried_spritesheet.png";

// Ritual animation spritesheets
import ritualPart1Sheet from "../assets/ritual_part1_spritesheet.png";
import ritualPart2Sheet from "../assets/ritual_part2_spritesheet.png";
import ritualPart3Sheet from "../assets/ritual_part3_spritesheet.png";
import ritualPart4Sheet from "../assets/ritual_part4_spritesheet.png";

// ============================================
// STATIC SPRITE IMPORTS
// ============================================
import pumo from "../assets/pumo.png";
import attack from "../assets/attack.png";
import throwing from "../assets/throwing.png";
import grabbing from "../assets/grabbing.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import ready from "../assets/ready.png";
import dodging from "../assets/dodging.png";
import crouchStance from "../assets/crouch-stance.png";
import salt from "../assets/salt.png";
import recovering from "../assets/recovering.png";
import rawParrySuccess from "../assets/raw-parry-success.png";
import slapAttack1 from "../assets/slapAttack1.png";
import slapAttack2 from "../assets/slapAttack2.png";

// ============================================
// SPRITE CONFIGURATIONS
// ============================================

/**
 * Animated sprite configurations
 * 
 * Each entry has:
 * - src: The spritesheet image
 * - frameCount: Number of frames
 * - frameWidth: Width of each frame in pixels
 * - frameHeight: Height of each frame in pixels
 * - fps: Frames per second (default: 12)
 */

const BLUE_ANIMATED_SPRITES = {
  waddle: {
    src: pumoWaddleSheet,
    frameCount: 21,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
  },
  army: {
    src: pumoArmySheet,
    frameCount: 10,
    frameWidth: 480,
    frameHeight: 480,
    fps: 10,
  },
  crouching: {
    src: blockingSheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  bow: {
    src: bowSheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  grabAttempt: {
    src: grabAttemptSheet,
    frameCount: 20,
    frameWidth: 480,
    frameHeight: 480,
    fps: 15,
  },
  hit: {
    src: hitSheet,
    frameCount: 3,
    frameWidth: 480,
    frameHeight: 480,
    fps: 10,
  },
  snowballThrow: {
    src: snowballThrowSheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 10,
  },
  atTheRopes: {
    src: atTheRopesSheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  crouchStrafing: {
    src: crouchStrafingSheet,
    frameCount: 14,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
  },
  beingGrabbed: {
    src: beingGrabbedSheet,
    frameCount: 2,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  isPerfectParried: {
    src: isPerfectParriedSheet,
    frameCount: 7,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
  },
  // Ritual animation spritesheets (need to be preloaded with player colors)
  ritualPart1: {
    src: ritualPart1Sheet,
    frameCount: 28,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
  },
  ritualPart2: {
    src: ritualPart2Sheet,
    frameCount: 24,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
  },
  ritualPart3: {
    src: ritualPart3Sheet,
    frameCount: 39,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
  },
  ritualPart4: {
    src: ritualPart4Sheet,
    frameCount: 38,
    frameWidth: 480,
    frameHeight: 480,
    fps: 14,
  },
};

export const ANIMATED_SPRITES = {
  player1: BLUE_ANIMATED_SPRITES,
  player2: BLUE_ANIMATED_SPRITES,
};

const BLUE_STATIC_SPRITES = {
  idle: pumo,
  attack: attack,
  throwing: throwing,
  grabbing: grabbing,
  attemptingGrabThrow: attemptingGrabThrow,
  ready: ready,
  dodging: dodging,
  crouchStance: crouchStance,
  salt: salt,
  recovering: recovering,
  rawParrySuccess: rawParrySuccess,
  slapAttack1: slapAttack1,
  slapAttack2: slapAttack2,
};

/**
 * Static sprite configurations
 * These are single-frame images that can still be recolored
 */
export const STATIC_SPRITES = {
  player1: BLUE_STATIC_SPRITES,
  player2: BLUE_STATIC_SPRITES,
};

/**
 * Color preset options for customization
 */
export const COLOR_PRESETS = {
  // Neutrals
  black: { hex: "#252525", name: "Black" },
  silver: { hex: "#A8A8A8", name: "Silver" },
  
  // Blues
  navy: { hex: "#000080", name: "Navy" },
  lightBlue: { hex: "#5BC0DE", name: "Light Blue" },
  
  // Reds
  red: { hex: "#FF1493", name: "Hot Pink" },
  maroon: { hex: "#800000", name: "Maroon" },
  
  // Pinks
  pink: { hex: "#FFB6C1", name: "Light Pink" },
  
  // Greens
  green: { hex: "#32CD32", name: "Lime Green" },
  
  // Purples
  purple: { hex: "#9932CC", name: "Purple" },
  
  // Oranges/Yellows
  orange: { hex: "#FF8C00", name: "Orange" },
  gold: { hex: "#FFD700", name: "Gold" },
  
  // Browns
  brown: { hex: "#5D3A1A", name: "Brown" },
  
  // Special
  rainbow: { hex: "rainbow", name: "Rainbow" },
  fire: { hex: "fire", name: "Fire" },
  vaporwave: { hex: "vaporwave", name: "Vaporwave" },
  camo: { hex: "camo", name: "Camo" },
  galaxy: { hex: "galaxy", name: "Galaxy" },
};

/**
 * The base color of the sprite assets (used for recoloring logic)
 * Sprites are blue - if target color matches this, no recoloring needed
 */
export const SPRITE_BASE_COLOR = "#4169E1";

/**
 * Default colors for each player
 */
export const DEFAULT_COLORS = {
  player1: COLOR_PRESETS.navy.hex,
  player2: COLOR_PRESETS.red.hex,
};

/**
 * Get all sprites for a player (both animated and static)
 */
export function getPlayerSprites(playerNumber) {
  const player = playerNumber === 1 ? "player1" : "player2";
  return {
    animated: ANIMATED_SPRITES[player],
    static: STATIC_SPRITES[player],
  };
}

/**
 * Get sprite configuration by name
 */
export function getSpriteConfig(playerNumber, spriteName, isAnimated = false) {
  const player = playerNumber === 1 ? "player1" : "player2";
  if (isAnimated) {
    return ANIMATED_SPRITES[player]?.[spriteName];
  }
  return STATIC_SPRITES[player]?.[spriteName];
}

export default {
  ANIMATED_SPRITES,
  STATIC_SPRITES,
  COLOR_PRESETS,
  SPRITE_BASE_COLOR,
  DEFAULT_COLORS,
  getPlayerSprites,
  getSpriteConfig,
};

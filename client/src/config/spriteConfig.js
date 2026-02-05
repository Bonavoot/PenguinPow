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
// SPRITESHEET IMPORTS (BLUE sprites only)
// ============================================
import pumoWaddle2Sheet from "../assets/spritesheets/pumo-waddle2_spritesheet.png";
import pumoArmy2Sheet from "../assets/spritesheets/pumo-army2_spritesheet.png";
import blocking2Sheet from "../assets/spritesheets/blocking_spritesheet.png";
import bow2Sheet from "../assets/spritesheets/bow2_spritesheet.png";
import grabAttempt2Sheet from "../assets/spritesheets/grab-attempt2_spritesheet.png";
import hit2Sheet from "../assets/spritesheets/hit2_spritesheet.png";
import snowballThrow2Sheet from "../assets/spritesheets/snowball-throw2_spritesheet.png";
import atTheRopes2Sheet from "../assets/spritesheets/at-the-ropes2_spritesheet.png";
import crouchStrafing2Sheet from "../assets/spritesheets/crouch-strafing2_spritesheet.png";
import beingGrabbed2Sheet from "../assets/spritesheets/is-being-grabbed2_spritesheet.png";

// Ritual animation spritesheets (BLUE versions for recoloring)
import ritualPart1Sheet from "../assets/ritual_part1_spritesheet.png";
import ritualPart2Sheet from "../assets/ritual_part2_spritesheet.png";
import ritualPart3Sheet from "../assets/ritual_part3_spritesheet.png";
import ritualPart4Sheet from "../assets/ritual_part4_spritesheet.png";

// ============================================
// STATIC SPRITE IMPORTS (BLUE sprites only)
// ============================================
import pumo2 from "../assets/pumo2.png";
import attack2 from "../assets/attack2.png";
import throwing2 from "../assets/throwing2.png";
import grabbing2 from "../assets/grabbing2.png";
import attemptingGrabThrow2 from "../assets/attempting-grab-throw2.png";
import ready2 from "../assets/ready2.png";
import dodging2 from "../assets/dodging2.png";
import crouchStance2 from "../assets/crouch-stance2.png";
import throwTech2 from "../assets/throw-tech2.png";
import salt2 from "../assets/salt2.png";
import recovering2 from "../assets/recovering2.png";
import rawParrySuccess2 from "../assets/raw-parry-success2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";

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

// UNIFIED: Both players use same BLUE sprite configurations
// Player 2's color is handled via recoloring system
const BLUE_ANIMATED_SPRITES = {
  waddle: {
    src: pumoWaddle2Sheet,
    frameCount: 21,
    frameWidth: 1024,
    frameHeight: 1024,
    fps: 12,
  },
  army: {
    src: pumoArmy2Sheet,
    frameCount: 10,
    frameWidth: 480,
    frameHeight: 480,
    fps: 10,
  },
  crouching: {
    src: blocking2Sheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  bow: {
    src: bow2Sheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  grabAttempt: {
    src: grabAttempt2Sheet,
    frameCount: 20,
    frameWidth: 480,
    frameHeight: 480,
    fps: 15,
  },
  hit: {
    src: hit2Sheet,
    frameCount: 3,
    frameWidth: 480,
    frameHeight: 480,
    fps: 10,
  },
  snowballThrow: {
    src: snowballThrow2Sheet,
    frameCount: 9,
    frameWidth: 480,
    frameHeight: 480,
    fps: 10,
  },
  atTheRopes: {
    src: atTheRopes2Sheet,
    frameCount: 6,
    frameWidth: 480,
    frameHeight: 480,
    fps: 8,
  },
  crouchStrafing: {
    src: crouchStrafing2Sheet,
    frameCount: 14,
    frameWidth: 480,
    frameHeight: 480,
    fps: 12,
  },
  beingGrabbed: {
    src: beingGrabbed2Sheet,
    frameCount: 2,
    frameWidth: 1024,
    frameHeight: 1024,
    fps: 8,
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
  // Both players use the same blue sprites - recoloring handles differentiation
  player1: BLUE_ANIMATED_SPRITES,
  player2: BLUE_ANIMATED_SPRITES,
};

// UNIFIED: Both players use same BLUE static sprites
// Player 2's color is handled via recoloring system
const BLUE_STATIC_SPRITES = {
  idle: pumo2,
  attack: attack2,
  throwing: throwing2,
  grabbing: grabbing2,
  attemptingGrabThrow: attemptingGrabThrow2,
  ready: ready2,
  dodging: dodging2,
  crouchStance: crouchStance2,
  throwTech: throwTech2,
  salt: salt2,
  recovering: recovering2,
  rawParrySuccess: rawParrySuccess2,
  slapAttack1: slapAttack1Blue,
  slapAttack2: slapAttack2Blue,
};

/**
 * Static sprite configurations
 * These are single-frame images that can still be recolored
 */
export const STATIC_SPRITES = {
  // Both players use the same blue sprites - recoloring handles differentiation
  player1: BLUE_STATIC_SPRITES,
  player2: BLUE_STATIC_SPRITES,
};

/**
 * Color preset options for customization
 */
export const COLOR_PRESETS = {
  // Blues
  blue: { hex: "#4169E1", name: "Royal Blue" },
  skyBlue: { hex: "#87CEEB", name: "Sky Blue" },
  navy: { hex: "#000080", name: "Navy" },
  cyan: { hex: "#00CED1", name: "Cyan" },
  
  // Reds
  red: { hex: "#DC143C", name: "Crimson" },
  darkRed: { hex: "#8B0000", name: "Dark Red" },
  coral: { hex: "#FF6347", name: "Coral" },
  
  // Pinks
  pink: { hex: "#FF69B4", name: "Hot Pink" },
  lightPink: { hex: "#FFB6C1", name: "Light Pink" },
  magenta: { hex: "#FF00FF", name: "Magenta" },
  
  // Greens
  green: { hex: "#32CD32", name: "Lime Green" },
  emerald: { hex: "#50C878", name: "Emerald" },
  forest: { hex: "#228B22", name: "Forest" },
  teal: { hex: "#008080", name: "Teal" },
  
  // Purples
  purple: { hex: "#9932CC", name: "Purple" },
  violet: { hex: "#EE82EE", name: "Violet" },
  indigo: { hex: "#4B0082", name: "Indigo" },
  
  // Oranges/Yellows
  orange: { hex: "#FF8C00", name: "Orange" },
  gold: { hex: "#FFD700", name: "Gold" },
  
  // Neutrals
  white: { hex: "#FFFFFF", name: "White" },
  silver: { hex: "#C0C0C0", name: "Silver" },
  charcoal: { hex: "#36454F", name: "Charcoal" },
};

/**
 * Default colors for each player
 */
export const DEFAULT_COLORS = {
  player1: COLOR_PRESETS.blue.hex,
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
  DEFAULT_COLORS,
  getPlayerSprites,
  getSpriteConfig,
};

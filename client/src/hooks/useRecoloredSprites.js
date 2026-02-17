/**
 * useRecoloredSprites - React hook for managing dynamically recolored sprites
 * 
 * This hook handles the canvas-based recoloring of player sprites,
 * targeting only the mawashi (belt) and headband colors while preserving
 * all other colors (yellow beak, feet, black outlines, etc.)
 * 
 * UNIFIED SPRITES: Both players use BLUE sprites as base.
 * The recoloring system handles Player 2's color (defaults to red).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  SPRITE_BASE_COLOR,
  COLOR_PRESETS,
  clearRecolorCache,
} from "../utils/SpriteRecolorizer";

// Import sprites
import pumo from "../assets/pumo.png";
import pumoWaddle from "../assets/pumo-waddle.png";
import pumoArmy from "../assets/pumo-army.png";
import attack from "../assets/attack.png";
import throwing from "../assets/throwing.png";
import grabbing from "../assets/grabbing.png";
import grabAttempt from "../assets/grab-attempt.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import isAttemptingPull from "../assets/is-attempting-pull.png";
import ready from "../assets/ready.png";
import hit from "../assets/hit.png";
import dodging from "../assets/dodging.png";
import crouching from "../assets/blocking.png";
import crouchStance from "../assets/crouch-stance.png";
import crouchStrafing from "../assets/crouch-strafing.png";
import bow from "../assets/bow.png";
import salt from "../assets/salt.png";
import recovering from "../assets/recovering.png";
import rawParrySuccess from "../assets/raw-parry-success.png";
import atTheRopes from "../assets/at-the-ropes.png";
import snowballThrow from "../assets/snowball-throw.png";
import slapAttack1 from "../assets/slapAttack1.png";
import slapAttack2 from "../assets/slapAttack2.png";

// Spritesheets
import beingGrabbedSheet from "../assets/spritesheets/is-being-grabbed_spritesheet.png";

// All sprites use the same base - recoloring handles differentiation
const BLUE_SPRITES = {
  pumo: pumo,
  pumoWaddle: pumoWaddle,
  pumoArmy: pumoArmy,
  attack: attack,
  throwing: throwing,
  grabbing: grabbing,
  grabAttempt: grabAttempt,
  attemptingGrabThrow: attemptingGrabThrow,
  isAttemptingPull: isAttemptingPull,
  beingGrabbed: beingGrabbedSheet,
  ready: ready,
  hit: hit,
  dodging: dodging,
  crouching: crouching,
  crouchStance: crouchStance,
  crouchStrafing: crouchStrafing,
  bow: bow,
  salt: salt,
  recovering: recovering,
  rawParrySuccess: rawParrySuccess,
  atTheRopes: atTheRopes,
  snowballThrow: snowballThrow,
  slapAttack1: slapAttack1,
  slapAttack2: slapAttack2,
};

// Both players use the same blue sprites
const PLAYER1_SPRITES = BLUE_SPRITES;
const PLAYER2_SPRITES = BLUE_SPRITES;

/**
 * Hook to manage recolored sprites for a player
 * 
 * @param {string} playerNumber - "player1" or "player2"
 * @param {string} colorHex - Target color in hex format (e.g., "#FF69B4")
 * @returns {Object} - { sprites, isLoading, error }
 */
export function useRecoloredSprites(playerNumber, colorHex) {
  const [sprites, setSprites] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const previousColorRef = useRef(null);

  const recolorAllSprites = useCallback(async () => {
    // Skip if color hasn't changed
    if (previousColorRef.current === colorHex && sprites) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // UNIFIED: Both players use BLUE_SPRITES
      const sourceSprites = BLUE_SPRITES;
      // All sprites are blue - always use BLUE_COLOR_RANGES
      const colorRanges = BLUE_COLOR_RANGES;

      // If using sprite base color (blue), just return original sprites without recoloring
      if (colorHex === SPRITE_BASE_COLOR) {
        setSprites(sourceSprites);
        previousColorRef.current = colorHex;
        setIsLoading(false);
        return;
      }

      // Recolor all sprites
      const recoloredSprites = {};
      const spriteEntries = Object.entries(sourceSprites);

      await Promise.all(
        spriteEntries.map(async ([key, src]) => {
          try {
            const recolored = await recolorImage(src, colorRanges, colorHex);
            recoloredSprites[key] = recolored;
          } catch (err) {
            console.error(`Failed to recolor ${key}:`, err);
            recoloredSprites[key] = src; // Use original on failure
          }
        })
      );

      setSprites(recoloredSprites);
      previousColorRef.current = colorHex;
    } catch (err) {
      console.error("Failed to recolor sprites:", err);
      setError(err.message);
      // Fallback to original blue sprites
      setSprites(BLUE_SPRITES);
    } finally {
      setIsLoading(false);
    }
  }, [playerNumber, colorHex, sprites]);

  useEffect(() => {
    if (colorHex) {
      recolorAllSprites();
    }
  }, [recolorAllSprites, colorHex]);

  return { sprites, isLoading, error };
}

/**
 * Preload and recolor sprites before game starts
 * Call this during loading screen to avoid in-game delays
 * 
 * UNIFIED: Both players use BLUE sprites - recoloring handles differentiation
 * 
 * @param {string} player1Color - Hex color for player 1
 * @param {string} player2Color - Hex color for player 2
 * @returns {Promise<{player1Sprites, player2Sprites}>}
 */
export async function preloadRecoloredSprites(player1Color, player2Color) {
  const results = {
    player1Sprites: { ...BLUE_SPRITES },
    player2Sprites: { ...BLUE_SPRITES },
  };

  // Recolor Player 1 if not using sprite base color (blue)
  if (player1Color && player1Color !== SPRITE_BASE_COLOR) {
    const spriteEntries = Object.entries(BLUE_SPRITES);
    await Promise.all(
      spriteEntries.map(async ([key, src]) => {
        try {
          results.player1Sprites[key] = await recolorImage(src, BLUE_COLOR_RANGES, player1Color);
        } catch (err) {
          console.error(`Failed to recolor P1 ${key}:`, err);
        }
      })
    );
  }

  // Recolor Player 2 - always recolor since base is blue and P2 defaults to red
  // All sprites are blue, so always use BLUE_COLOR_RANGES
  const spriteEntries = Object.entries(BLUE_SPRITES);
  await Promise.all(
    spriteEntries.map(async ([key, src]) => {
      try {
        results.player2Sprites[key] = await recolorImage(src, BLUE_COLOR_RANGES, player2Color || COLOR_PRESETS.red);
      } catch (err) {
        console.error(`Failed to recolor P2 ${key}:`, err);
      }
    })
  );

  return results;
}

/**
 * Get all available color presets
 */
export function getColorPresets() {
  return COLOR_PRESETS;
}

/**
 * Clear the sprite recolor cache
 */
export function clearSpriteCache() {
  clearRecolorCache();
}

export default {
  useRecoloredSprites,
  preloadRecoloredSprites,
  getColorPresets,
  clearSpriteCache,
  PLAYER1_SPRITES,
  PLAYER2_SPRITES,
};

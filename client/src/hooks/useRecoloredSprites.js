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

// UNIFIED: Import only BLUE sprites - both players use these
import pumo2 from "../assets/pumo2.png";
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import pumoArmy2 from "../assets/pumo-army2.png";
import attack2 from "../assets/attack2.png";
import throwing2 from "../assets/throwing2.png";
import grabbing2 from "../assets/grabbing2.png";
import grabAttempt2 from "../assets/grab-attempt2.png";
import attemptingGrabThrow2 from "../assets/attempting-grab-throw2.png";
import ready2 from "../assets/ready2.png";
import hit2 from "../assets/hit2.png";
import dodging2 from "../assets/dodging2.png";
import crouching2 from "../assets/blocking2.png";
import crouchStance2 from "../assets/crouch-stance2.png";
import crouchStrafing2 from "../assets/crouch-strafing2.png";
import bow2 from "../assets/bow2.png";
import throwTech2 from "../assets/throw-tech2.png";
import salt2 from "../assets/salt2.png";
import recovering2 from "../assets/recovering2.png";
import rawParrySuccess2 from "../assets/raw-parry-success2.png";
import atTheRopes2 from "../assets/at-the-ropes2.png";
import snowballThrow2 from "../assets/snowball-throw2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";

// Spritesheets (blue versions only)
import beingGrabbed2Sheet from "../assets/spritesheets/is-being-grabbed2_spritesheet.png";

// UNIFIED: All sprites are BLUE - both players use the same sprites
// Recoloring handles Player 2's default red (or custom) color
const BLUE_SPRITES = {
  pumo: pumo2,
  pumoWaddle: pumoWaddle2,
  pumoArmy: pumoArmy2,
  attack: attack2,
  throwing: throwing2,
  grabbing: grabbing2,
  grabAttempt: grabAttempt2,
  attemptingGrabThrow: attemptingGrabThrow2,
  beingGrabbed: beingGrabbed2Sheet,
  ready: ready2,
  hit: hit2,
  dodging: dodging2,
  crouching: crouching2,
  crouchStance: crouchStance2,
  crouchStrafing: crouchStrafing2,
  bow: bow2,
  throwTech: throwTech2,
  salt: salt2,
  recovering: recovering2,
  rawParrySuccess: rawParrySuccess2,
  atTheRopes: atTheRopes2,
  snowballThrow: snowballThrow2,
  slapAttack1: slapAttack1Blue,
  slapAttack2: slapAttack2Blue,
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

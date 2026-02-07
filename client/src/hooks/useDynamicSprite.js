/**
 * useDynamicSprite - Hook for dynamic sprite recoloring
 * 
 * This hook provides a simple way to get recolored sprite sources
 * without requiring major changes to existing rendering code.
 * 
 * Usage:
 *   const spriteSrc = useDynamicSprite(originalSrc, playerNumber, colorHex);
 */

import { useState, useEffect, useRef } from "react";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
} from "../utils/SpriteRecolorizer";

// Global cache for recolored images with LRU eviction
const MAX_SPRITE_CACHE_SIZE = 25; // MEMORY: Reduced from 40 - data URLs can be large
const spriteCache = new Map();
const spriteCacheOrder = []; // LRU tracking

function addToSpriteCache(key, value) {
  // Move to end if already exists
  const existingIndex = spriteCacheOrder.indexOf(key);
  if (existingIndex !== -1) {
    spriteCacheOrder.splice(existingIndex, 1);
  }
  spriteCacheOrder.push(key);
  
  // Evict oldest if over limit
  while (spriteCacheOrder.length > MAX_SPRITE_CACHE_SIZE) {
    const oldestKey = spriteCacheOrder.shift();
    spriteCache.delete(oldestKey);
  }
  
  spriteCache.set(key, value);
}

/**
 * Generate a cache key for a sprite + color combination
 */
function getCacheKey(src, playerNumber, colorHex) {
  return `${src}_p${playerNumber}_${colorHex}`;
}

/**
 * Hook to get a dynamically recolored sprite
 * 
 * @param {string} originalSrc - Original sprite source URL
 * @param {number} playerNumber - 1 or 2
 * @param {string} colorHex - Target color in hex (e.g., "#FF69B4")
 * @param {boolean} enabled - Whether recoloring is enabled (default: true)
 * @returns {string} - Recolored sprite source (or original if disabled/loading)
 */
export function useDynamicSprite(originalSrc, playerNumber, colorHex, enabled = true) {
  const [spriteSrc, setSpriteSrc] = useState(originalSrc);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // If disabled or no color specified, use original
    if (!enabled || !colorHex || !originalSrc) {
      setSpriteSrc(originalSrc);
      return;
    }

    // Skip GIFs - they can't be recolored with canvas (only first frame would work)
    if (typeof originalSrc === "string" && originalSrc.includes(".gif")) {
      setSpriteSrc(originalSrc);
      return;
    }

    const cacheKey = getCacheKey(originalSrc, playerNumber, colorHex);

    // Check cache first
    if (spriteCache.has(cacheKey)) {
      setSpriteSrc(spriteCache.get(cacheKey));
      return;
    }

    // Recolor the sprite - UNIFIED: All sprites are blue
    const colorRanges = BLUE_COLOR_RANGES;

    recolorImage(originalSrc, colorRanges, colorHex)
      .then((recolored) => {
        if (mountedRef.current) {
          addToSpriteCache(cacheKey, recolored);
          setSpriteSrc(recolored);
        }
      })
      .catch((error) => {
        console.error("Failed to recolor sprite:", error);
        if (mountedRef.current) {
          setSpriteSrc(originalSrc);
        }
      });
  }, [originalSrc, playerNumber, colorHex, enabled]);

  return spriteSrc;
}

/**
 * Preload and recolor a batch of sprites
 * Call this during loading screen to avoid in-game delays
 * 
 * @param {Array<{src: string, playerNumber: number}>} sprites - Sprites to preload
 * @param {string} colorHex - Target color
 * @returns {Promise<Map<string, string>>} - Map of original src to recolored src
 */
export async function preloadRecoloredSprites(sprites, colorHex) {
  const results = new Map();

  await Promise.all(
    sprites.map(async ({ src, playerNumber }) => {
      // Skip GIFs
      if (typeof src === "string" && src.includes(".gif")) {
        results.set(src, src);
        return;
      }

      const cacheKey = getCacheKey(src, playerNumber, colorHex);

      // Check cache
      if (spriteCache.has(cacheKey)) {
        results.set(src, spriteCache.get(cacheKey));
        return;
      }

      // UNIFIED: All sprites are blue
      const colorRanges = BLUE_COLOR_RANGES;

      try {
        const recolored = await recolorImage(src, colorRanges, colorHex);
        addToSpriteCache(cacheKey, recolored);
        results.set(src, recolored);
      } catch (error) {
        console.error(`Failed to recolor ${src}:`, error);
        results.set(src, src);
      }
    })
  );

  return results;
}

/**
 * Clear the sprite cache
 */
export function clearSpriteCache() {
  spriteCache.clear();
  spriteCacheOrder.length = 0;
}

/**
 * Get a recolored sprite synchronously from cache
 * Returns original if not cached
 */
export function getRecoloredSprite(originalSrc, playerNumber, colorHex) {
  const cacheKey = getCacheKey(originalSrc, playerNumber, colorHex);
  return spriteCache.get(cacheKey) || originalSrc;
}

/**
 * Check if a sprite is cached
 */
export function isSpriteeCached(originalSrc, playerNumber, colorHex) {
  const cacheKey = getCacheKey(originalSrc, playerNumber, colorHex);
  return spriteCache.has(cacheKey);
}

export default {
  useDynamicSprite,
  preloadRecoloredSprites,
  clearSpriteCache,
  getRecoloredSprite,
  isSpriteCached: isSpriteeCached,
};

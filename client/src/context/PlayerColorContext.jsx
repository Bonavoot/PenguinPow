/**
 * PlayerColorContext - Global state for player color customization
 * 
 * This context provides:
 * - Current color selections for both players
 * - Pre-recolored sprite sources
 * - Functions to change colors
 * - Loading states during recoloring
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  clearRecolorCache,
} from "../utils/SpriteRecolorizer";
import { ANIMATED_SPRITES, STATIC_SPRITES, DEFAULT_COLORS, COLOR_PRESETS } from "../config/spriteConfig";

const PlayerColorContext = createContext(null);

/**
 * Recolor all sprites for a player
 * UNIFIED: All sprites are blue, so always use BLUE_COLOR_RANGES
 * Only skip recoloring if the target color IS blue (since sprites are already blue)
 */
async function recolorPlayerSprites(playerKey, colorHex, skipRecoloring) {
  // All sprites are now blue - use BLUE_COLOR_RANGES for both players
  const colorRanges = BLUE_COLOR_RANGES;
  
  // If target color is blue (same as sprites), return original sprites
  if (skipRecoloring) {
    return {
      animated: ANIMATED_SPRITES[playerKey],
      static: STATIC_SPRITES[playerKey],
    };
  }

  const recoloredAnimated = {};
  const recoloredStatic = {};

  // Recolor animated spritesheets
  const animatedEntries = Object.entries(ANIMATED_SPRITES[playerKey] || {});
  await Promise.all(
    animatedEntries.map(async ([name, config]) => {
      try {
        const recoloredSrc = await recolorImage(config.src, colorRanges, colorHex);
        recoloredAnimated[name] = { ...config, src: recoloredSrc };
      } catch (error) {
        console.error(`Failed to recolor animated sprite ${name}:`, error);
        recoloredAnimated[name] = config;
      }
    })
  );

  // Recolor static sprites
  const staticEntries = Object.entries(STATIC_SPRITES[playerKey] || {});
  await Promise.all(
    staticEntries.map(async ([name, src]) => {
      try {
        // Skip GIFs for now - they need special handling
        if (typeof src === "string" && src.endsWith(".gif")) {
          recoloredStatic[name] = src;
          return;
        }
        const recoloredSrc = await recolorImage(src, colorRanges, colorHex);
        recoloredStatic[name] = recoloredSrc;
      } catch (error) {
        console.error(`Failed to recolor static sprite ${name}:`, error);
        recoloredStatic[name] = src;
      }
    })
  );

  return {
    animated: recoloredAnimated,
    static: recoloredStatic,
  };
}

export function PlayerColorProvider({ children }) {
  // Color state
  const [player1Color, setPlayer1Color] = useState(DEFAULT_COLORS.player1);
  const [player2Color, setPlayer2Color] = useState(DEFAULT_COLORS.player2);
  
  // Recolored sprites
  const [player1Sprites, setPlayer1Sprites] = useState({
    animated: ANIMATED_SPRITES.player1,
    static: STATIC_SPRITES.player1,
  });
  const [player2Sprites, setPlayer2Sprites] = useState({
    animated: ANIMATED_SPRITES.player2,
    static: STATIC_SPRITES.player2,
  });
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ player1: false, player2: false });

  // Track if colors have been applied
  const appliedColorsRef = useRef({ player1: DEFAULT_COLORS.player1, player2: DEFAULT_COLORS.player2 });

  // Recolor player 1 sprites when color changes
  const applyPlayer1Color = useCallback(async (colorHex) => {
    if (appliedColorsRef.current.player1 === colorHex) return;
    
    setLoadingProgress(prev => ({ ...prev, player1: true }));
    // UNIFIED: Only skip recoloring if color is BLUE (sprites are blue)
    const skipRecoloring = colorHex === DEFAULT_COLORS.player1; // player1 default is blue
    
    try {
      const sprites = await recolorPlayerSprites("player1", colorHex, skipRecoloring);
      setPlayer1Sprites(sprites);
      appliedColorsRef.current.player1 = colorHex;
    } catch (error) {
      console.error("Failed to recolor player 1 sprites:", error);
    } finally {
      setLoadingProgress(prev => ({ ...prev, player1: false }));
    }
  }, []);

  // Recolor player 2 sprites when color changes
  const applyPlayer2Color = useCallback(async (colorHex) => {
    if (appliedColorsRef.current.player2 === colorHex) return;
    
    setLoadingProgress(prev => ({ ...prev, player2: true }));
    // UNIFIED: Only skip recoloring if color is BLUE (sprites are blue)
    // Player 2's default is RED, so we ALWAYS recolor (blue sprites need to become red/custom)
    const skipRecoloring = colorHex === DEFAULT_COLORS.player1; // Check against BLUE, not player2's red
    
    try {
      const sprites = await recolorPlayerSprites("player2", colorHex, skipRecoloring);
      setPlayer2Sprites(sprites);
      appliedColorsRef.current.player2 = colorHex;
    } catch (error) {
      console.error("Failed to recolor player 2 sprites:", error);
    } finally {
      setLoadingProgress(prev => ({ ...prev, player2: false }));
    }
  }, []);

  // Apply colors when they change
  useEffect(() => {
    applyPlayer1Color(player1Color);
  }, [player1Color, applyPlayer1Color]);

  useEffect(() => {
    applyPlayer2Color(player2Color);
  }, [player2Color, applyPlayer2Color]);

  // Update loading state
  useEffect(() => {
    setIsLoading(loadingProgress.player1 || loadingProgress.player2);
  }, [loadingProgress]);

  // Preload all sprites with current colors (call before game starts)
  const preloadSprites = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      applyPlayer1Color(player1Color),
      applyPlayer2Color(player2Color),
    ]);
    setIsLoading(false);
  }, [player1Color, player2Color, applyPlayer1Color, applyPlayer2Color]);

  // Reset to default colors
  const resetColors = useCallback(() => {
    setPlayer1Color(DEFAULT_COLORS.player1);
    setPlayer2Color(DEFAULT_COLORS.player2);
    clearRecolorCache();
  }, []);

  // Get sprite for a player by name
  const getSprite = useCallback((playerNumber, spriteName, isAnimated = false) => {
    const sprites = playerNumber === 1 ? player1Sprites : player2Sprites;
    if (isAnimated) {
      return sprites.animated?.[spriteName];
    }
    return sprites.static?.[spriteName];
  }, [player1Sprites, player2Sprites]);

  // Get all sprites for a player
  const getPlayerSprites = useCallback((playerNumber) => {
    return playerNumber === 1 ? player1Sprites : player2Sprites;
  }, [player1Sprites, player2Sprites]);

  const value = {
    // Colors
    player1Color,
    player2Color,
    setPlayer1Color,
    setPlayer2Color,
    
    // Sprites
    player1Sprites,
    player2Sprites,
    getSprite,
    getPlayerSprites,
    
    // State
    isLoading,
    loadingProgress,
    
    // Actions
    preloadSprites,
    resetColors,
    
    // Constants
    colorPresets: COLOR_PRESETS,
    defaultColors: DEFAULT_COLORS,
  };

  return (
    <PlayerColorContext.Provider value={value}>
      {children}
    </PlayerColorContext.Provider>
  );
}

/**
 * Hook to access player color context
 */
export function usePlayerColors() {
  const context = useContext(PlayerColorContext);
  if (!context) {
    throw new Error("usePlayerColors must be used within a PlayerColorProvider");
  }
  return context;
}

/**
 * Hook to get sprites for a specific player
 */
export function usePlayerSprites(playerNumber) {
  const { getPlayerSprites, isLoading } = usePlayerColors();
  return {
    sprites: getPlayerSprites(playerNumber),
    isLoading,
  };
}

export default PlayerColorContext;

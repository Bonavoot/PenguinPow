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
  preDecodeImages,
  preDecodeDataUrl,
  getCacheStats,
} from "../utils/SpriteRecolorizer";
import { ANIMATED_SPRITES, STATIC_SPRITES, DEFAULT_COLORS, COLOR_PRESETS, SPRITE_BASE_COLOR } from "../config/spriteConfig";
import { SPRITESHEET_CONFIG, SPRITESHEET_CONFIG_BY_NAME } from "../config/animatedSpriteConfig";

// Import spritesheets directly from animatedSpriteConfig to ensure EXACT URL match
// These are the URLs that GameFighter.getSpritesheetConfig() returns
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

// Direct spritesheet imports for explicit recoloring
const DIRECT_SPRITESHEETS = [
  pumoWaddle2Spritesheet,
  pumoArmy2Spritesheet,
  hit2Spritesheet,
  bow2Spritesheet,
  blockingSpritesheet,
  grabAttempt2Spritesheet,
  isBeingGrabbed2Spritesheet,
  snowballThrow2Spritesheet,
  atTheRopes2Spritesheet,
  crouchStrafing2Spritesheet,
];

// CRITICAL: Import the EXACT same sprites that GameFighter uses
// This ensures cache keys match when GameFighter looks up recolored sprites
// Without this, cache keys mismatch causes "flash of default color" on first use

// Static sprites
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

// APNGs (these get mapped to spritesheets, but import them to ensure URL match)
import crouching2 from "../assets/blocking2.png";
import bow2 from "../assets/bow2.png";
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import pumoArmy2 from "../assets/pumo-army2.png";
import grabAttempt2 from "../assets/grab-attempt2.png";
import hit2 from "../assets/hit2.png";
import snowballThrow2 from "../assets/snowball-throw2.png";
import atTheRopes2 from "../assets/at-the-ropes2.png";
import crouchStrafing2 from "../assets/crouch-strafing2.png";

// GameFighter's static sprites - these are the actual URLs it uses
const GAME_FIGHTER_STATIC_SPRITES = [
  pumo2, attack2, throwing2, grabbing2, attemptingGrabThrow2,
  ready2, dodging2, crouchStance2, throwTech2, salt2,
  recovering2, rawParrySuccess2, slapAttack1Blue, slapAttack2Blue,
  crouching2, bow2,
];

// GameFighter's APNG sprites that get mapped to spritesheets
// Pre-recolor these too in case of any edge cases
const GAME_FIGHTER_APNG_SPRITES = [
  pumoWaddle2, pumoArmy2, grabAttempt2, hit2,
  snowballThrow2, atTheRopes2, crouchStrafing2,
];

const PlayerColorContext = createContext(null);

// Ritual sprite names - these are huge spritesheets (up to 18720x480 px, ~35MB decoded each)
// They only play once before gameplay, so we recolor them (cached) but DON'T pre-decode into
// the hidden DOM container. This saves ~120MB of decoded bitmap memory PER PLAYER (~240MB total).
const RITUAL_SPRITE_NAMES = new Set(['ritualPart1', 'ritualPart2', 'ritualPart3', 'ritualPart4']);

/**
 * Recolor all sprites for a player and return all source URLs for preloading
 * UNIFIED: All sprites are blue, so always use BLUE_COLOR_RANGES
 * Only skip recoloring if the target color IS blue (since sprites are already blue)
 * 
 * Returns: { sprites, allSources } where allSources is an array of all image URLs for pre-decoding
 * NOTE: Ritual sprite sources are intentionally excluded from allSources to save ~240MB of memory.
 * Rituals are still recolored (cached as blob URLs) but decoded on-demand when first rendered.
 */
async function recolorPlayerSprites(playerKey, colorHex, skipRecoloring) {
  // All sprites are now blue - use BLUE_COLOR_RANGES for both players
  const colorRanges = BLUE_COLOR_RANGES;
  
  // Collect all sources for pre-decoding
  const allSources = [];
  
  // If target color is blue (same as sprites), return original sprites
  if (skipRecoloring) {
    // Still collect original sources for pre-decoding (but skip rituals - they're huge)
    Object.entries(ANIMATED_SPRITES[playerKey] || {}).forEach(([name, config]) => {
      if (config?.src && !RITUAL_SPRITE_NAMES.has(name)) allSources.push(config.src);
    });
    Object.values(STATIC_SPRITES[playerKey] || {}).forEach(src => {
      if (src && typeof src === 'string') allSources.push(src);
    });
    
    // CRITICAL: Also collect direct spritesheet imports for pre-decoding
    // These are needed even without recoloring to avoid invisible frames
    DIRECT_SPRITESHEETS.forEach(src => {
      if (src) allSources.push(src);
    });
    
    // Also collect GameFighter's static sprite imports
    GAME_FIGHTER_STATIC_SPRITES.forEach(src => {
      if (src) allSources.push(src);
    });
    
    return {
      sprites: {
        animated: ANIMATED_SPRITES[playerKey],
        static: STATIC_SPRITES[playerKey],
      },
      allSources,
    };
  }

  const recoloredAnimated = {};
  const recoloredStatic = {};

  // Recolor animated spritesheets from spriteConfig.js
  // Rituals are still recolored (so they're cached as blob URLs) but NOT added to allSources
  // for pre-decoding - this saves ~240MB of decoded bitmap memory
  const animatedEntries = Object.entries(ANIMATED_SPRITES[playerKey] || {});
  await Promise.all(
    animatedEntries.map(async ([name, config]) => {
      try {
        const recoloredSrc = await recolorImage(config.src, colorRanges, colorHex);
        recoloredAnimated[name] = { ...config, src: recoloredSrc };
        // Skip ritual sources from pre-decode list (they're huge and only play once)
        if (!RITUAL_SPRITE_NAMES.has(name)) {
          allSources.push(recoloredSrc);
        }
      } catch (error) {
        console.error(`Failed to recolor animated sprite ${name}:`, error);
        recoloredAnimated[name] = config;
        if (config?.src && !RITUAL_SPRITE_NAMES.has(name)) allSources.push(config.src);
      }
    })
  );

  // CRITICAL: Recolor spritesheets using DIRECT imports (not via config objects)
  // This ensures the EXACT same URLs that GameFighter uses are cached
  // GameFighter's getSpritesheetConfig() returns URLs from these same imports
  await Promise.all(
    DIRECT_SPRITESHEETS.map(async (spritesheetUrl) => {
      try {
        const recoloredSrc = await recolorImage(spritesheetUrl, colorRanges, colorHex);
        allSources.push(recoloredSrc);
      } catch (error) {
        console.error(`Failed to recolor spritesheet:`, error);
      }
    })
  );

  // Recolor static sprites from spriteConfig.js
  const staticEntries = Object.entries(STATIC_SPRITES[playerKey] || {});
  await Promise.all(
    staticEntries.map(async ([name, src]) => {
      try {
        // Skip GIFs for now - they need special handling
        if (typeof src === "string" && src.endsWith(".gif")) {
          recoloredStatic[name] = src;
          allSources.push(src);
          return;
        }
        const recoloredSrc = await recolorImage(src, colorRanges, colorHex);
        recoloredStatic[name] = recoloredSrc;
        allSources.push(recoloredSrc);
      } catch (error) {
        console.error(`Failed to recolor static sprite ${name}:`, error);
        recoloredStatic[name] = src;
        if (src) allSources.push(src);
      }
    })
  );

  // CRITICAL: Also recolor using GameFighter's exact import URLs
  // This ensures cache keys match when GameFighter looks up sprites
  await Promise.all(
    GAME_FIGHTER_STATIC_SPRITES.map(async (src) => {
      try {
        if (typeof src === "string" && !src.endsWith(".gif")) {
          const recoloredSrc = await recolorImage(src, colorRanges, colorHex);
          allSources.push(recoloredSrc);
        }
      } catch (error) {
        // Silently ignore - sprite might already be recolored via STATIC_SPRITES
      }
    })
  );

  // Also recolor APNG sprites (these get mapped to spritesheets, but cover edge cases)
  await Promise.all(
    GAME_FIGHTER_APNG_SPRITES.map(async (src) => {
      try {
        if (typeof src === "string" && !src.endsWith(".gif")) {
          const recoloredSrc = await recolorImage(src, colorRanges, colorHex);
          allSources.push(recoloredSrc);
        }
      } catch (error) {
        // Silently ignore
      }
    })
  );

  return {
    sprites: {
      animated: recoloredAnimated,
      static: recoloredStatic,
    },
    allSources,
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
  const [spritesReady, setSpritesReady] = useState(false);

  // Track if colors have been applied
  const appliedColorsRef = useRef({ player1: DEFAULT_COLORS.player1, player2: DEFAULT_COLORS.player2 });

  // Store sources for preloading - these refs hold sources from the most recent recolor
  const player1SourcesRef = useRef([]);
  const player2SourcesRef = useRef([]);

  // Recolor player 1 sprites when color changes
  const applyPlayer1Color = useCallback(async (colorHex) => {
    if (appliedColorsRef.current.player1 === colorHex) return;
    
    setLoadingProgress(prev => ({ ...prev, player1: true }));
    // Only skip recoloring if color matches the ACTUAL sprite base color (Royal Blue #4169E1)
    // Must match GameFighter's check (targetColor !== SPRITE_BASE_COLOR) to avoid ghost frames
    const skipRecoloring = colorHex === SPRITE_BASE_COLOR;
    
    try {
      const { sprites, allSources } = await recolorPlayerSprites("player1", colorHex, skipRecoloring);
      setPlayer1Sprites(sprites);
      player1SourcesRef.current = allSources;
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
    // Only skip recoloring if color matches the ACTUAL sprite base color (Royal Blue #4169E1)
    // Must match GameFighter's check (targetColor !== SPRITE_BASE_COLOR) to avoid ghost frames
    const skipRecoloring = colorHex === SPRITE_BASE_COLOR;
    
    try {
      const { sprites, allSources } = await recolorPlayerSprites("player2", colorHex, skipRecoloring);
      setPlayer2Sprites(sprites);
      player2SourcesRef.current = allSources;
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
  // MEMORY OPTIMIZED: Recolor once via apply functions, skip duplicate work
  // Optional: Pass colors directly to avoid race condition with context state updates
  const preloadSprites = useCallback(async (overrideP1Color, overrideP2Color) => {
    // Use override colors if provided, otherwise use context state
    const p1Color = overrideP1Color || player1Color;
    const p2Color = overrideP2Color || player2Color;
    
    setIsLoading(true);
    console.log(`[Preload] Starting sprite preload with colors: P1=${p1Color}, P2=${p2Color}`);
    const startTime = performance.now();
    
    // Step 1: FORCE full recoloring by calling recolorPlayerSprites directly
    // This bypasses the early-return check in applyPlayer*Color which can skip recoloring
    // if colors were "already applied" (even if caching was incomplete)
    // Only skip if color matches SPRITE_BASE_COLOR (#4169E1) - the actual color of the sprites
    const skipP1Recolor = p1Color === SPRITE_BASE_COLOR;
    const skipP2Recolor = p2Color === SPRITE_BASE_COLOR;
    
    const [p1Result, p2Result] = await Promise.all([
      recolorPlayerSprites("player1", p1Color, skipP1Recolor),
      recolorPlayerSprites("player2", p2Color, skipP2Recolor),
    ]);
    
    // Update state and refs
    setPlayer1Sprites(p1Result.sprites);
    setPlayer2Sprites(p2Result.sprites);
    player1SourcesRef.current = p1Result.allSources;
    player2SourcesRef.current = p2Result.allSources;
    appliedColorsRef.current = { player1: p1Color, player2: p2Color };
    
    // Step 2: Collect ALL sprite sources for pre-decoding (both original and recolored)
    // MEMORY: Ritual spritesheets are excluded - they're huge (~35MB decoded each) and only play once
    const allSourcesToPreload = new Set();
    
    // From spriteConfig.js - animated sprites (spritesheets) - SKIP RITUALS
    Object.entries(ANIMATED_SPRITES.player1 || {}).forEach(([name, config]) => {
      if (config?.src && typeof config.src === 'string' && !RITUAL_SPRITE_NAMES.has(name)) {
        allSourcesToPreload.add(config.src);
      }
    });
    
    // From spriteConfig.js - static sprites
    Object.values(STATIC_SPRITES.player1 || {}).forEach(src => {
      if (src && typeof src === 'string') {
        allSourcesToPreload.add(src);
      }
    });
    
    // From animatedSpriteConfig.js - spritesheets
    Object.values(SPRITESHEET_CONFIG || {}).forEach(config => {
      if (config?.spritesheet && typeof config.spritesheet === 'string') {
        allSourcesToPreload.add(config.spritesheet);
      }
    });
    
    // CRITICAL: Add DIRECT spritesheet imports (exact URLs GameFighter uses)
    DIRECT_SPRITESHEETS.forEach(src => {
      if (src) allSourcesToPreload.add(src);
    });
    
    // Add GameFighter's static sprite imports
    GAME_FIGHTER_STATIC_SPRITES.forEach(src => {
      if (src) allSourcesToPreload.add(src);
    });
    
    // Add GameFighter's APNG imports
    GAME_FIGHTER_APNG_SPRITES.forEach(src => {
      if (src) allSourcesToPreload.add(src);
    });
    
    // Step 3: Also collect the RECOLORED sprites from refs (these are blob URLs after optimization)
    // Use refs because state might not be updated yet after applyColor calls
    // These need to be decoded to prevent invisible frames on first render
    const recoloredUrls = [
      ...player1SourcesRef.current.filter(s => s && (s.startsWith('data:') || s.startsWith('blob:'))),
      ...player2SourcesRef.current.filter(s => s && (s.startsWith('data:') || s.startsWith('blob:'))),
    ];
    
    const uniqueSources = [...allSourcesToPreload].filter(s => !s.startsWith('data:') && !s.startsWith('blob:'));
    console.log(`[Preload] Pre-decoding ${uniqueSources.length} original sprites + ${recoloredUrls.length} recolored sprites...`);
    
    // Step 4: Pre-decode original images in batches
    const DECODE_BATCH_SIZE = 8;
    for (let i = 0; i < uniqueSources.length; i += DECODE_BATCH_SIZE) {
      const batch = uniqueSources.slice(i, i + DECODE_BATCH_SIZE);
      await preDecodeImages(batch);
    }
    
    // Step 5: Pre-decode recolored blob/data URLs and KEEP them in decoded cache
    // This prevents "invisible frames" - Images stay in DOM so they're ready for instant display
    for (let i = 0; i < recoloredUrls.length; i += 4) {
      const batch = recoloredUrls.slice(i, i + 4);
      await Promise.all(batch.map(preDecodeDataUrl));
    }
    
    // Step 6: Wait for browser to fully process all decoded images
    // Multiple RAF cycles + extended timeout ensures GPU textures are uploaded
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 100);  // Extended time for browser/GPU to fully process
          });
        });
      });
    });
    
    const elapsed = performance.now() - startTime;
    const stats = getCacheStats();
    console.log(`[Preload] Complete! ${elapsed.toFixed(0)}ms, Recolor cache: ${stats.size}/${stats.maxSize}, Decoded cache: ${stats.decodedSize}/${stats.maxDecodedSize}`);
    setIsLoading(false);
    setSpritesReady(true);
    
    return true;
  }, [player1Color, player2Color]);
  
  // Warmup function - can be called early to pre-initialize the Web Worker
  const warmupWorker = useCallback(() => {
    // Access cache stats to ensure worker is initialized
    getCacheStats();
  }, []);

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
    spritesReady,
    
    // Actions
    preloadSprites,
    resetColors,
    warmupWorker,
    
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

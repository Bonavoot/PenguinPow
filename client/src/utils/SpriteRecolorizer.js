/**
 * SpriteRecolorizer - Canvas-based pixel manipulation for precise color replacement
 * 
 * This utility targets ONLY specific color ranges (like the mawashi belt and headband)
 * while leaving other colors (yellow beak/feet, black outlines, etc.) completely unchanged.
 * 
 * Uses HSL-based color detection for more accurate targeting:
 * - Hue determines the "color family" (blue, red, yellow, etc.)
 * - Saturation filters out grays/whites/blacks
 * - This prevents accidentally changing the yellow beak or black outlines
 * 
 * PERFORMANCE OPTIMIZATIONS (Phase 3):
 * - Web Worker for heavy pixel processing (off main thread)
 * - LRU cache with size limits to prevent memory bloat
 * - Canvas pooling to reduce GC pressure
 */

// ============================================
// LRU CACHE with size limit
// ============================================
const MAX_CACHE_SIZE = 150; // Enough for all player sprites (static + animated + APNGs) + buffer
const cacheOrder = []; // Track access order for LRU eviction

const recoloredImageCache = new Map();

function addToCache(key, value) {
  // If already in cache, move to end of order (most recently used)
  const existingIndex = cacheOrder.indexOf(key);
  if (existingIndex !== -1) {
    cacheOrder.splice(existingIndex, 1);
  }
  cacheOrder.push(key);
  
  // Evict oldest if over limit
  while (cacheOrder.length > MAX_CACHE_SIZE) {
    const oldestKey = cacheOrder.shift();
    recoloredImageCache.delete(oldestKey);
  }
  
  recoloredImageCache.set(key, value);
}

function getFromCache(key) {
  if (recoloredImageCache.has(key)) {
    // Move to end (most recently used)
    const index = cacheOrder.indexOf(key);
    if (index !== -1) {
      cacheOrder.splice(index, 1);
      cacheOrder.push(key);
    }
    return recoloredImageCache.get(key);
  }
  return null;
}

// ============================================
// CANVAS POOLING - Reuse canvas elements
// ============================================
const canvasPool = [];
const MAX_POOL_SIZE = 5;

function getPooledCanvas(width, height) {
  // Try to find a canvas of the right size
  for (let i = 0; i < canvasPool.length; i++) {
    const canvas = canvasPool[i];
    if (canvas.width === width && canvas.height === height) {
      canvasPool.splice(i, 1);
      return canvas;
    }
  }
  
  // Create new canvas if pool is empty or no match
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function returnCanvasToPool(canvas) {
  if (canvasPool.length < MAX_POOL_SIZE) {
    // Clear the canvas before returning to pool
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasPool.push(canvas);
  }
  // If pool is full, canvas will be garbage collected
}

// ============================================
// WEB WORKER MANAGEMENT
// ============================================
let recolorWorker = null;
let workerReady = false;
let pendingRequests = new Map();
let requestIdCounter = 0;

function initWorker() {
  if (recolorWorker) return;
  
  try {
    // Create worker from the worker file
    recolorWorker = new Worker(new URL('./recolorWorker.js', import.meta.url));
    
    recolorWorker.onmessage = (e) => {
      const { type, id, payload } = e.data;
      
      if (type === 'recolor_complete') {
        const pending = pendingRequests.get(id);
        if (pending) {
          pending.resolve(payload);
          pendingRequests.delete(id);
        }
      } else if (type === 'recolor_error') {
        const pending = pendingRequests.get(id);
        if (pending) {
          pending.reject(new Error(payload.error));
          pendingRequests.delete(id);
        }
      }
    };
    
    recolorWorker.onerror = (e) => {
      console.error('Worker error:', e);
      // Reject all pending requests
      pendingRequests.forEach((pending) => {
        pending.reject(new Error('Worker error'));
      });
      pendingRequests.clear();
    };
    
    workerReady = true;
  } catch (error) {
    console.warn('Web Worker not supported, falling back to main thread:', error);
    workerReady = false;
  }
}

// Initialize worker immediately
if (typeof window !== 'undefined') {
  initWorker();
}

/**
 * Process image data using Web Worker (off main thread)
 */
function processInWorker(imageData, width, height, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness) {
  return new Promise((resolve, reject) => {
    if (!workerReady || !recolorWorker) {
      reject(new Error('Worker not ready'));
      return;
    }
    
    const id = ++requestIdCounter;
    pendingRequests.set(id, { resolve, reject });
    
    // Transfer the buffer to worker (zero-copy)
    const buffer = imageData.data.buffer.slice(0); // Clone buffer for transfer
    
    recolorWorker.postMessage({
      type: 'recolor',
      id,
      payload: {
        imageData: buffer,
        width,
        height,
        sourceColorRange,
        targetHue,
        targetSat,
        targetLight,
        referenceLightness,
      }
    }, [buffer]);
  });
}

/**
 * HSL-based color range definitions for the mawashi (belt) and headband
 * 
 * Using HSL is more intuitive and accurate:
 * - Hue: 0-360° color wheel (red=0°, yellow=60°, green=120°, cyan=180°, blue=240°, magenta=300°)
 * - Saturation: 0-100% (gray to vivid)
 * - Lightness: 0-100% (black to white)
 */

// BLUE mawashi/headband (Player 1's default color)
// Blue hues range from ~180° (cyan) to ~260° (blue-violet)
// Balance: catch all mawashi shades but exclude nipples (nipples are pinkish, not blue)
export const BLUE_COLOR_RANGES = {
  minHue: 190,       // Include cyan-blues
  maxHue: 255,       // Include blue-violets
  minSaturation: 40, // Lower threshold to catch shaded mawashi areas
  maxSaturation: 100,
  minLightness: 15,  // Include darker shaded areas
  maxLightness: 85,  // Include lighter highlights
};

// RED mawashi/headband (Player 2's default color)
// Red hues wrap around: 0-30° and 330-360°
// The nipples are PINK (less saturated red) - we target VIVID reds only
// Key insight: nipples have lower saturation AND often higher lightness (pink = light red)
export const RED_COLOR_RANGES = {
  minHue: 0,
  maxHue: 25,        // Include orange-reds
  minHue2: 335,      // Red wraps around the hue wheel
  maxHue2: 360,
  minSaturation: 60, // Moderately high - catches mawashi, excludes most nipples
  maxSaturation: 100,
  minLightness: 20,  // Include darker shaded areas
  maxLightness: 60,  // EXCLUDE lighter pinks (nipples are often lighter/pinker)
};

/**
 * Check if a pixel's hue falls within a color range (HSL-based)
 */
function isColorInHslRange(h, s, l, colorRange) {
  // Check saturation and lightness first (common to all)
  if (s < colorRange.minSaturation || s > colorRange.maxSaturation) {
    return false;
  }
  if (l < colorRange.minLightness || l > colorRange.maxLightness) {
    return false;
  }

  // Check hue (may have two ranges for red which wraps around)
  if (h >= colorRange.minHue && h <= colorRange.maxHue) {
    return true;
  }
  
  // Check second hue range if it exists (for red)
  if (colorRange.minHue2 !== undefined && colorRange.maxHue2 !== undefined) {
    if (h >= colorRange.minHue2 && h <= colorRange.maxHue2) {
      return true;
    }
  }

  return false;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Recolor a pixel from source color to target color while preserving relative luminosity
 * This maintains the shading/highlights of the original sprite while shifting toward target lightness
 * 
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @param {number} targetHue - Target hue (0-360)
 * @param {number} targetSaturation - Target saturation (0-100)
 * @param {number} targetLightness - Target lightness (0-100)
 * @param {number} referenceLightness - Reference lightness of the source color range midpoint (0-100)
 */
function recolorPixel(r, g, b, targetHue, targetSaturation, targetLightness, referenceLightness) {
  const hsl = rgbToHsl(r, g, b);
  
  // Calculate how far the original pixel's lightness is from the reference (source midpoint)
  // This preserves relative shading - darker areas stay darker, lighter areas stay lighter
  const lightnessOffset = hsl.l - referenceLightness;
  
  // Apply this offset to the target lightness, with some compression for extreme targets
  // For very dark targets (black), we compress the range to keep things dark
  // For very light targets (light pink), we compress the range to keep things light
  let newLightness;
  
  if (targetLightness < 20) {
    // Very dark target (like black): compress lightness range, bias toward dark
    newLightness = targetLightness + (lightnessOffset * 0.3);
  } else if (targetLightness > 80) {
    // Very light target (like light pink): compress lightness range, bias toward light
    newLightness = targetLightness + (lightnessOffset * 0.3);
  } else {
    // Normal target: preserve more of the original shading
    newLightness = targetLightness + (lightnessOffset * 0.7);
  }
  
  // Clamp to valid range
  newLightness = Math.max(0, Math.min(100, newLightness));
  
  return hslToRgb(targetHue, targetSaturation, newLightness);
}

/**
 * Parse a hex color string to RGB
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Get the hue, saturation, and lightness from a hex color
 */
export function getHslFromHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 100, l: 50 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return { h: hsl.h, s: hsl.s, l: hsl.l };
}

// Alias for backwards compatibility
export const getHueSatFromHex = getHslFromHex;

/**
 * Recolor an image by replacing specific color ranges with a target color
 * 
 * PERFORMANCE: Uses Web Worker to process pixels off main thread
 * Falls back to main thread processing if worker is unavailable
 * 
 * @param {string} imageSrc - Source image URL
 * @param {Object} sourceColorRange - HSL color range to replace (e.g., BLUE_COLOR_RANGES)
 * @param {string} targetColorHex - Target color in hex format (e.g., "#FF69B4" for pink)
 * @returns {Promise<string>} - Data URL of the recolored image
 */
export async function recolorImage(imageSrc, sourceColorRange, targetColorHex) {
  // Generate cache key
  const cacheKey = `${imageSrc}_${sourceColorRange.minHue}-${sourceColorRange.maxHue}_${targetColorHex}`;
  
  // Check LRU cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      let canvas = null;
      try {
        // Get pooled canvas
        canvas = getPooledCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Get target hue, saturation, and lightness
        const { h: targetHue, s: targetSat, l: targetLight } = getHslFromHex(targetColorHex);
        
        // Calculate reference lightness from source color range midpoint
        const referenceLightness = (sourceColorRange.minLightness + sourceColorRange.maxLightness) / 2;

        let processedData;
        
        // Try to use Web Worker for processing (off main thread)
        if (workerReady && recolorWorker) {
          try {
            const result = await processInWorker(
              imageData,
              canvas.width,
              canvas.height,
              sourceColorRange,
              targetHue,
              targetSat,
              targetLight,
              referenceLightness
            );
            
            // Create ImageData from returned buffer
            processedData = new ImageData(
              new Uint8ClampedArray(result.imageData),
              result.width,
              result.height
            );
          } catch (workerError) {
            console.warn('Worker processing failed, falling back to main thread:', workerError);
            // Fall back to main thread processing
            processedData = processPixelsOnMainThread(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness);
          }
        } else {
          // No worker available, process on main thread
          processedData = processPixelsOnMainThread(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness);
        }

        // Put the modified data back
        ctx.putImageData(processedData, 0, 0);

        // Convert to data URL
        const dataUrl = canvas.toDataURL("image/png");
        
        // Return canvas to pool
        returnCanvasToPool(canvas);
        canvas = null;
        
        // Add to LRU cache
        addToCache(cacheKey, dataUrl);
        
        // Pre-decode the image to prevent invisible frames on first display
        const decodedImg = new Image();
        decodedImg.src = dataUrl;
        if (decodedImg.decode) {
          decodedImg.decode()
            .then(() => resolve(dataUrl))
            .catch(() => resolve(dataUrl));
        } else {
          decodedImg.onload = () => resolve(dataUrl);
          decodedImg.onerror = () => resolve(dataUrl);
        }
      } catch (error) {
        // Return canvas to pool on error
        if (canvas) {
          returnCanvasToPool(canvas);
        }
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageSrc}`));
    };

    img.src = imageSrc;
  });
}

/**
 * Fallback: Process pixels on main thread (when worker unavailable)
 * This is the same algorithm as the worker, but runs synchronously
 */
function processPixelsOnMainThread(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    const pixelHsl = rgbToHsl(r, g, b);

    if (isColorInHslRange(pixelHsl.h, pixelHsl.s, pixelHsl.l, sourceColorRange)) {
      const newColor = recolorPixel(r, g, b, targetHue, targetSat, targetLight, referenceLightness);
      data[i] = newColor.r;
      data[i + 1] = newColor.g;
      data[i + 2] = newColor.b;
    }
  }
  
  return imageData;
}

/**
 * Batch recolor multiple images
 * 
 * @param {Array<string>} imageSrcs - Array of image source URLs
 * @param {Object} sourceColorRange - HSL color range to replace
 * @param {string} targetColorHex - Target color in hex
 * @returns {Promise<Map<string, string>>} - Map of original src to recolored data URL
 */
export async function recolorImages(imageSrcs, sourceColorRange, targetColorHex) {
  const results = new Map();
  
  await Promise.all(
    imageSrcs.map(async (src) => {
      try {
        const recolored = await recolorImage(src, sourceColorRange, targetColorHex);
        results.set(src, recolored);
      } catch (error) {
        console.error(`Failed to recolor ${src}:`, error);
        results.set(src, src); // Use original on failure
      }
    })
  );
  
  return results;
}

/**
 * Clear the recolored image cache
 */
export function clearRecolorCache() {
  recoloredImageCache.clear();
  cacheOrder.length = 0;
}

// ============================================
// PERSISTENT IMAGE CACHE with LRU eviction
// Keep decoded images in memory to prevent GC and re-decode
// ============================================
const MAX_DECODED_CACHE_SIZE = 50; // Limit to prevent OOM - only cache the most important sprites
const decodedImageCache = new Map();
const decodedCacheOrder = []; // LRU tracking
let hiddenImageContainer = null;

function getHiddenContainer() {
  if (!hiddenImageContainer && typeof document !== 'undefined') {
    hiddenImageContainer = document.createElement('div');
    hiddenImageContainer.id = 'sprite-preload-cache';
    hiddenImageContainer.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px;';
    document.body.appendChild(hiddenImageContainer);
  }
  return hiddenImageContainer;
}

function addToDecodedCache(key, img) {
  // If already in cache, move to end (most recently used)
  const existingIndex = decodedCacheOrder.indexOf(key);
  if (existingIndex !== -1) {
    decodedCacheOrder.splice(existingIndex, 1);
  }
  decodedCacheOrder.push(key);
  
  // Evict oldest if over limit
  while (decodedCacheOrder.length > MAX_DECODED_CACHE_SIZE) {
    const oldestKey = decodedCacheOrder.shift();
    const oldImg = decodedImageCache.get(oldestKey);
    if (oldImg && oldImg.parentNode) {
      oldImg.parentNode.removeChild(oldImg);
    }
    decodedImageCache.delete(oldestKey);
  }
  
  decodedImageCache.set(key, img);
}

/**
 * Pre-decode an image and KEEP IT IN DOM to prevent invisible frames
 * The image is added to a hidden container so the browser keeps it decoded
 * 
 * MEMORY OPTIMIZATION: Skip data URLs (they're already in memory from recoloring)
 * Only pre-decode file URLs that need browser decoding
 * 
 * @param {string} imageSrc - Image source (URL or data URL)
 * @returns {Promise<void>} - Resolves when image is fully decoded
 */
export async function preDecodeImage(imageSrc) {
  // Skip if already decoded and cached
  if (decodedImageCache.has(imageSrc)) {
    return;
  }
  
  // MEMORY FIX: Skip data URLs - they're already in memory from the recoloring process
  // Only pre-decode actual file URLs that need browser decoding
  if (imageSrc && imageSrc.startsWith('data:')) {
    return;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageSrc;
    
    const onComplete = () => {
      // Add to hidden container to keep in DOM (with LRU eviction)
      const container = getHiddenContainer();
      if (container && !decodedImageCache.has(imageSrc)) {
        container.appendChild(img);
        addToDecodedCache(imageSrc, img);
      }
      resolve();
    };
    
    // Use decode() if available (modern browsers), fallback to onload
    if (img.decode) {
      img.decode()
        .then(onComplete)
        .catch((err) => {
          console.warn('Image decode warning:', err);
          onComplete(); // Still add to cache on failure
        });
    } else {
      img.onload = onComplete;
      img.onerror = () => {
        console.warn('Image load warning:', imageSrc);
        onComplete();
      };
    }
  });
}

/**
 * Pre-decode multiple images in parallel
 * @param {string[]} imageSrcs - Array of image sources to decode
 * @returns {Promise<void>} - Resolves when all images are decoded
 */
export async function preDecodeImages(imageSrcs) {
  // Filter out already cached images
  const uncached = imageSrcs.filter(src => src && !decodedImageCache.has(src));
  await Promise.all(uncached.map(src => preDecodeImage(src)));
}

/**
 * Clear the decoded image cache (for memory management)
 */
export function clearDecodedImageCache() {
  if (hiddenImageContainer) {
    hiddenImageContainer.innerHTML = '';
  }
  decodedImageCache.clear();
  decodedCacheOrder.length = 0;
}

/**
 * Get a recolored image from cache synchronously (if it exists)
 * This allows checking the cache before triggering async recoloring
 * 
 * @param {string} imageSrc - Original image source
 * @param {Object} sourceColorRange - HSL color range to detect
 * @param {string} targetColorHex - Target color in hex format
 * @returns {string|null} - Cached recolored image data URL, or null if not cached
 */
export function getCachedRecoloredImage(imageSrc, sourceColorRange, targetColorHex) {
  const cacheKey = `${imageSrc}_${sourceColorRange.minHue}-${sourceColorRange.maxHue}_${targetColorHex}`;
  return getFromCache(cacheKey);
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    size: recoloredImageCache.size,
    maxSize: MAX_CACHE_SIZE,
    decodedSize: decodedImageCache.size,
    maxDecodedSize: MAX_DECODED_CACHE_SIZE,
    workerReady,
    canvasPoolSize: canvasPool.length,
  };
}

/**
 * The base color of the sprite assets (used for recoloring logic)
 * Sprites are blue - if target color matches this, no recoloring needed
 */
export const SPRITE_BASE_COLOR = "#4169E1";

/**
 * Predefined color options for player customization
 */
export const COLOR_PRESETS = {
  // Neutrals
  black: "#252525",
  silver: "#A8A8A8",
  
  // Blues
  navy: "#000080",
  lightBlue: "#5BC0DE",
  
  // Reds
  red: "#DC143C",       // Crimson (default Player 2)
  maroon: "#800000",
  
  // Pinks
  pink: "#FFB6C1",      // Light Pink
  
  // Greens
  green: "#32CD32",     // Lime Green
  
  // Purples
  purple: "#9932CC",    // Dark Orchid
  
  // Oranges/Yellows
  orange: "#FF8C00",    // Dark Orange
  gold: "#FFD700",
  
  // Browns
  brown: "#5D3A1A",
};

export default {
  recolorImage,
  recolorImages,
  clearRecolorCache,
  getCachedRecoloredImage,
  getCacheStats,
  preDecodeImage,
  preDecodeImages,
  clearDecodedImageCache,
  hexToRgb,
  getHueSatFromHex,
  BLUE_COLOR_RANGES,
  RED_COLOR_RANGES,
  COLOR_PRESETS,
};

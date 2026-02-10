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
const MAX_CACHE_SIZE = 300; // Normal + hit-tinted variants per player (~122 × 2) to prevent invisible frames on animation switch
const cacheOrder = []; // Track access order for LRU eviction

const recoloredImageCache = new Map();

// RACE CONDITION FIX: Deduplicate concurrent recolorImage() calls with the same cache key.
// Without this, preloadSprites() and applyPlayerColor() can race on the same sprites,
// creating DIFFERENT blob URLs for the same cache key. The loser's blob URL gets overwritten
// in the cache, but the winner's blob URL was pre-decoded. GameFighter then gets the
// non-pre-decoded blob URL from the cache → ghost frames on every animation transition.
// With deduplication, concurrent calls share the same Promise and get the same blob URL.
const inFlightRecolors = new Map();

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
    const evictedUrl = recoloredImageCache.get(oldestKey);
    recoloredImageCache.delete(oldestKey);
    // Revoke blob URL to free browser-held blob data (only if not in decoded cache)
    if (evictedUrl && evictedUrl.startsWith('blob:') && !decodedImageCache.has(evictedUrl)) {
      URL.revokeObjectURL(evictedUrl);
    }
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
function processInWorker(imageData, width, height, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, specialMode, hitTintRed = false) {
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
        specialMode,
        hitTintRed,
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
 * @param {Object} options - Optional: { hitTintRed: true } to tint non-mawashi/headband pixels red (for isHit state)
 * @returns {Promise<string>} - Data URL of the recolored image
 */
export async function recolorImage(imageSrc, sourceColorRange, targetColorHex, options = {}) {
  const hitTintRed = !!options.hitTintRed;
  // Generate cache key (hit variant cached separately)
  const cacheKey = `${imageSrc}_${sourceColorRange.minHue}-${sourceColorRange.maxHue}_${targetColorHex}${hitTintRed ? '_hit' : ''}`;
  
  // Check LRU cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // RACE CONDITION FIX: If this exact recoloring is already in flight, return the same
  // Promise instead of starting a duplicate. This ensures preloadSprites() and
  // applyPlayerColor() get the SAME blob URL, so the pre-decoded URL matches the cache.
  if (inFlightRecolors.has(cacheKey)) {
    return inFlightRecolors.get(cacheKey);
  }

  // Detect special color modes (rainbow, fire, etc.) vs normal hex colors
  const specialMode = SPECIAL_COLORS.has(targetColorHex) ? targetColorHex : null;

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      let canvas = null;
      try {
        // Get pooled canvas
        canvas = getPooledCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // For special modes, use default saturation/lightness (overridden per pixel)
        // For normal mode, get target HSL from hex
        let targetHue, targetSat, targetLight;
        if (specialMode) {
          targetHue = 0;
          targetSat = 90;
          targetLight = 50;
        } else {
          const hsl = getHslFromHex(targetColorHex);
          targetHue = hsl.h;
          targetSat = hsl.s;
          targetLight = hsl.l;
        }
        
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
              referenceLightness,
              specialMode,
              hitTintRed
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
            processedData = processPixelsOnMainThread(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, specialMode, hitTintRed, canvas.width, canvas.height);
          }
        } else {
          // No worker available, process on main thread
          processedData = processPixelsOnMainThread(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, specialMode, hitTintRed, canvas.width, canvas.height);
        }

        // Put the modified data back
        ctx.putImageData(processedData, 0, 0);

        // MEMORY OPTIMIZATION: Use blob URL instead of data URL
        // Data URLs store the entire PNG as a base64 string in the JS heap (~33% larger than binary)
        // Blob URLs are tiny strings (~50 bytes) - the blob data is managed by the browser outside JS heap
        // This saves 50-200MB+ of JS heap for the sprite cache
        const blob = await new Promise((resolveBlob) => {
          canvas.toBlob(resolveBlob, "image/png");
        });
        const blobUrl = URL.createObjectURL(blob);
        
        // Return canvas to pool
        returnCanvasToPool(canvas);
        canvas = null;
        
        // Add to LRU cache
        addToCache(cacheKey, blobUrl);
        
        resolve(blobUrl);
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

  // Register the in-flight Promise; clean up when settled (success or failure)
  inFlightRecolors.set(cacheKey, promise);
  promise.then(
    () => inFlightRecolors.delete(cacheKey),
    () => inFlightRecolors.delete(cacheKey)
  );

  return promise;
}

/**
 * Positive-safe modulo (JS % can return negative for negative operands).
 */
function posMod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Compute per-pixel hue, saturation, and lightness for special color modes.
 * Returns { h, s, l } to use as the target color for this pixel.
 *
 * x/y are RELATIVE to the centroid (center of mass) of all matching pixels
 * in this frame, so they can be negative.  Because the centroid moves with
 * the character and is very stable across frames, the pattern stays locked
 * to the body during animation.
 */
function getSpecialPixelColor(specialMode, x, y, width, height) {
  switch (specialMode) {
    case 'rainbow': {
      const CYCLE = 50;
      return { h: (posMod(y, CYCLE) / CYCLE) * 360, s: 90, l: 50 };
    }
    case 'fire': {
      const CYCLE = 70;
      const t = posMod(y, CYCLE) / CYCLE;
      const hue = 55 - t * 55;
      const lightness = 60 - t * 30;
      return { h: hue, s: 100, l: lightness };
    }
    case 'vaporwave': {
      const CYCLE = 60;
      const t = posMod(y, CYCLE) / CYCLE;
      const hue = 300 - t * 120;
      return { h: hue, s: 80, l: 55 };
    }
    case 'camo': {
      const BLOCK = 5;
      const bx = Math.floor(x / BLOCK);
      const by = Math.floor(y / BLOCK);
      let h = (bx * 374761393 + by * 668265263) | 0;
      h = ((h ^ (h >>> 13)) * 1274126177) | 0;
      h = (h ^ (h >>> 16)) >>> 0;
      const val = h % 100;
      if (val < 28) return { h: 100, s: 40, l: 32 };  // olive green
      if (val < 52) return { h: 120, s: 38, l: 18 };  // dark green
      if (val < 72) return { h: 35, s: 50, l: 28 };   // brown
      if (val < 88) return { h: 55, s: 25, l: 45 };   // tan/khaki
      return { h: 0, s: 0, l: 10 };                     // near-black
    }
    case 'galaxy': {
      let hash = (x * 374761393 + y * 668265263) | 0;
      hash = ((hash ^ (hash >>> 13)) * 1274126177) | 0;
      hash = (hash ^ (hash >>> 16)) >>> 0;
      const val = hash % 1000;

      if (val < 3) return { h: 200, s: 10, l: 98 };    // rare brilliant white-blue star
      if (val < 5) return { h: 45, s: 15, l: 95 };     // rare warm white star

      const CYCLE = 60;
      const drift = posMod(x + y * 2, CYCLE) / CYCLE;

      if (val < 60) return { h: 310 + drift * 30, s: 70, l: 45 };
      if (val < 120) return { h: 260 + drift * 20, s: 65, l: 35 };

      const baseHue = 260 + drift * 30;
      return { h: baseHue, s: 60, l: 15 };
    }
    case 'gold': {
      // Metallic gold with diagonal shine streaks
      const CYCLE = 100;
      const shine = posMod(x + y, CYCLE) / CYCLE;
      // Sharp highlight peaks (narrow bright bands, wider dark gold)
      const peak = Math.pow(Math.sin(shine * Math.PI), 6);
      const hue = 43 + peak * 5;              // 43°-48° slight warm shift at highlights
      const sat = 90 - peak * 35;             // less saturated at bright highlights (more white/metallic)
      const lightness = 42 + peak * 45;       // 42 (rich gold) → 87 (bright shine)
      return { h: hue, s: sat, l: lightness };
    }
    default:
      return { h: 0, s: 90, l: 50 };
  }
}

/**
 * Fallback: Process pixels on main thread (when worker unavailable)
 * This is the same algorithm as the worker, but runs synchronously.
 *
 * For special modes we do TWO passes:
 *   Pass 1 – find the centroid (center of mass) of all matching pixels.
 *            The centroid is extremely stable across animation frames because
 *            it's an average of hundreds of pixels — a few edge pixels shifting
 *            barely changes the result.
 *   Pass 2 – recolor, using coordinates RELATIVE to the centroid so the
 *            pattern stays locked to the body during animation.
 */
function processPixelsOnMainThread(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, specialMode, hitTintRed, width, height) {
  const data = imageData.data;

  // --- Pass 1: centroid of matching pixels (only needed for special modes) ---
  let anchorX = 0, anchorY = 0;
  let spanW = 1, spanH = 1;
  if (specialMode) {
    let sumX = 0, sumY = 0, count = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const ph = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (isColorInHslRange(ph.h, ph.s, ph.l, sourceColorRange)) {
        const idx = i / 4;
        const px = idx % width;
        const py = (idx / width) | 0;
        sumX += px;
        sumY += py;
        count++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
    if (count > 0) {
      anchorX = Math.round(sumX / count);
      anchorY = Math.round(sumY / count);
      spanW = Math.max(1, maxX - minX + 1);
      spanH = Math.max(1, maxY - minY + 1);
    }
  }

  // --- Pass 2: recolor ---
  // Hit tint: blend toward true red, slightly subtle
  const HIT_RED_RGB = hslToRgb(0, 58, 55);
  const HIT_BLEND = 0.34;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    const pixelHsl = rgbToHsl(r, g, b);

    if (isColorInHslRange(pixelHsl.h, pixelHsl.s, pixelHsl.l, sourceColorRange)) {
      let hue = targetHue;
      let sat = targetSat;
      let light = targetLight;

      if (specialMode) {
        const idx = i / 4;
        const relX = (idx % width) - anchorX;
        const relY = ((idx / width) | 0) - anchorY;
        const sc = getSpecialPixelColor(specialMode, relX, relY, spanW, spanH);
        hue = sc.h;
        sat = sc.s;
        light = sc.l;
      }

      const newColor = recolorPixel(r, g, b, hue, sat, light, referenceLightness);
      data[i] = newColor.r;
      data[i + 1] = newColor.g;
      data[i + 2] = newColor.b;
    } else if (hitTintRed) {
      // Blend original with soft red: subtle tint, and white turns same light red as other colors
      data[i] = Math.round((1 - HIT_BLEND) * r + HIT_BLEND * HIT_RED_RGB.r);
      data[i + 1] = Math.round((1 - HIT_BLEND) * g + HIT_BLEND * HIT_RED_RGB.g);
      data[i + 2] = Math.round((1 - HIT_BLEND) * b + HIT_BLEND * HIT_RED_RGB.b);
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
  // Revoke all blob URLs to free browser-held blob data
  for (const url of recoloredImageCache.values()) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
  recoloredImageCache.clear();
  cacheOrder.length = 0;
  inFlightRecolors.clear();
}

// ============================================
// PERSISTENT IMAGE CACHE with LRU eviction
// Keep decoded images in memory to prevent GC and re-decode
// ============================================
// GHOST FRAME FIX: Increased from 100 to 200.
// When both players use non-blue colors, there are ~120-140 sprites to pre-decode
// (originals + recolored for P1 + recolored for P2). At 100, the first ~40 sprites
// get LRU-evicted before gameplay starts, causing ghost frames on first use.
// At 200, all gameplay sprites fit without eviction. Memory cost is ~50-70MB of decoded
// bitmaps, which is acceptable since we already save ~240MB by excluding ritual sprites.
const MAX_DECODED_CACHE_SIZE = 200;
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
 * Pre-decode a data URL or blob URL and cache it - used during preload for recolored sprites.
 * Keeps decoded Images in DOM so they're ready for instant display (prevents invisible frames).
 */
export async function preDecodeDataUrl(url) {
  if (!url || (!url.startsWith('data:') && !url.startsWith('blob:'))) return;
  return preDecodeImage(url);
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
  // Revoke blob URLs from cached images to free browser-held blob data
  for (const img of decodedImageCache.values()) {
    if (img && img.src && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
  }
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
 * @param {Object} options - Optional: { hitTintRed: true } for hit-state variant
 * @returns {string|null} - Cached recolored image data URL, or null if not cached
 */
export function getCachedRecoloredImage(imageSrc, sourceColorRange, targetColorHex, options = {}) {
  const hitTintRed = !!options.hitTintRed;
  const cacheKey = `${imageSrc}_${sourceColorRange.minHue}-${sourceColorRange.maxHue}_${targetColorHex}${hitTintRed ? '_hit' : ''}`;
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
 * Special color identifiers
 * When one of these values is passed as targetColorHex, the recoloring system
 * uses a special per-pixel algorithm instead of a flat color.
 */
export const RAINBOW_COLOR = "rainbow";
export const FIRE_COLOR = "fire";
export const VAPORWAVE_COLOR = "vaporwave";
export const CAMO_COLOR = "camo";
export const GALAXY_COLOR = "galaxy";
export const GOLD_COLOR = "gold";
export const SPECIAL_COLORS = new Set([
  RAINBOW_COLOR, FIRE_COLOR, VAPORWAVE_COLOR,
  CAMO_COLOR, GALAXY_COLOR, GOLD_COLOR,
]);

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
  red: "#FF1493",       // Hot Pink
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
  
  // Special
  rainbow: RAINBOW_COLOR,
  fire: FIRE_COLOR,
  vaporwave: VAPORWAVE_COLOR,
  camo: CAMO_COLOR,
  galaxy: GALAXY_COLOR,
};

export default {
  recolorImage,
  recolorImages,
  clearRecolorCache,
  getCachedRecoloredImage,
  getCacheStats,
  preDecodeImage,
  preDecodeDataUrl,
  preDecodeImages,
  clearDecodedImageCache,
  hexToRgb,
  getHueSatFromHex,
  BLUE_COLOR_RANGES,
  RED_COLOR_RANGES,
  COLOR_PRESETS,
  SPECIAL_COLORS,
  RAINBOW_COLOR,
  FIRE_COLOR,
  VAPORWAVE_COLOR,
  CAMO_COLOR,
  GALAXY_COLOR,
  GOLD_COLOR,
};

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
 */

// Cache for recolored images to avoid redundant processing
const recoloredImageCache = new Map();

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
 * Recolor a pixel from source color to target color while preserving luminosity
 * This maintains the shading/highlights of the original sprite
 */
function recolorPixel(r, g, b, targetHue, targetSaturation) {
  const hsl = rgbToHsl(r, g, b);
  // Keep original luminosity, change hue and saturation
  return hslToRgb(targetHue, targetSaturation, hsl.l);
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
 * Get the hue and saturation from a hex color
 */
export function getHueSatFromHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 100 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return { h: hsl.h, s: hsl.s };
}

/**
 * Recolor an image by replacing specific color ranges with a target color
 * 
 * @param {string} imageSrc - Source image URL
 * @param {Object} sourceColorRange - HSL color range to replace (e.g., BLUE_COLOR_RANGES)
 * @param {string} targetColorHex - Target color in hex format (e.g., "#FF69B4" for pink)
 * @returns {Promise<string>} - Data URL of the recolored image
 */
export async function recolorImage(imageSrc, sourceColorRange, targetColorHex) {
  // Generate cache key
  const cacheKey = `${imageSrc}_${sourceColorRange.minHue}-${sourceColorRange.maxHue}_${targetColorHex}`;
  
  // Check cache first
  if (recoloredImageCache.has(cacheKey)) {
    return recoloredImageCache.get(cacheKey);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Get target hue and saturation
        const { h: targetHue, s: targetSat } = getHueSatFromHex(targetColorHex);

        // Process each pixel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip fully transparent pixels
          if (a === 0) continue;

          // Convert pixel to HSL
          const pixelHsl = rgbToHsl(r, g, b);

          // Check if this pixel is in our target color range (HSL-based)
          if (isColorInHslRange(pixelHsl.h, pixelHsl.s, pixelHsl.l, sourceColorRange)) {
            // Recolor this pixel - change hue and saturation, keep luminosity
            const newColor = recolorPixel(r, g, b, targetHue, targetSat);
            data[i] = newColor.r;
            data[i + 1] = newColor.g;
            data[i + 2] = newColor.b;
            // Alpha stays the same
          }
        }

        // Put the modified data back
        ctx.putImageData(imageData, 0, 0);

        // Convert to data URL
        const dataUrl = canvas.toDataURL("image/png");
        
        // Cache the result
        recoloredImageCache.set(cacheKey, dataUrl);
        
        resolve(dataUrl);
      } catch (error) {
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
  return recoloredImageCache.get(cacheKey) || null;
}

/**
 * Predefined color options for player customization
 */
export const COLOR_PRESETS = {
  // Blues
  blue: "#4169E1",      // Royal Blue (default Player 1)
  skyBlue: "#87CEEB",
  navy: "#000080",
  cyan: "#00CED1",
  
  // Reds
  red: "#DC143C",       // Crimson (default Player 2)
  darkRed: "#8B0000",
  coral: "#FF6347",
  
  // Pinks
  pink: "#FF69B4",      // Hot Pink
  lightPink: "#FFB6C1",
  magenta: "#FF00FF",
  
  // Greens
  green: "#32CD32",     // Lime Green
  emerald: "#50C878",
  forest: "#228B22",
  teal: "#008080",
  
  // Purples
  purple: "#9932CC",    // Dark Orchid
  violet: "#EE82EE",
  indigo: "#4B0082",
  
  // Oranges/Yellows
  orange: "#FF8C00",    // Dark Orange
  gold: "#FFD700",
  yellow: "#FFFF00",
  
  // Others
  white: "#FFFFFF",
  silver: "#C0C0C0",
  black: "#1A1A1A",     // Near-black (pure black might not look good)
};

export default {
  recolorImage,
  recolorImages,
  clearRecolorCache,
  getCachedRecoloredImage,
  hexToRgb,
  getHueSatFromHex,
  BLUE_COLOR_RANGES,
  RED_COLOR_RANGES,
  COLOR_PRESETS,
};

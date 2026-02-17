/**
 * Web Worker for sprite recolorization
 * 
 * Handles the heavy pixel-by-pixel processing off the main thread
 * to prevent animation stuttering and invisible frames.
 */

// HSL color conversion utilities (same as main thread)
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
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

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
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

function isColorInHslRange(h, s, l, colorRange) {
  if (s < colorRange.minSaturation || s > colorRange.maxSaturation) {
    return false;
  }
  if (l < colorRange.minLightness || l > colorRange.maxLightness) {
    return false;
  }

  if (h >= colorRange.minHue && h <= colorRange.maxHue) {
    return true;
  }
  
  if (colorRange.minHue2 !== undefined && colorRange.maxHue2 !== undefined) {
    if (h >= colorRange.minHue2 && h <= colorRange.maxHue2) {
      return true;
    }
  }

  return false;
}

/**
 * Recolor a pixel from source color to target color while preserving relative luminosity
 * This maintains the shading/highlights of the original sprite while shifting toward target lightness
 */
function recolorPixel(r, g, b, targetHue, targetSaturation, targetLightness, referenceLightness) {
  const hsl = rgbToHsl(r, g, b);
  
  // Calculate how far the original pixel's lightness is from the reference (source midpoint)
  const lightnessOffset = hsl.l - referenceLightness;
  
  // Apply this offset to the target lightness, with some compression for extreme targets
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
 * Positive-safe modulo (JS % can return negative for negative operands).
 */
function posMod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Compute per-pixel hue, saturation, and lightness for special color modes.
 * Mirrors the identical function in SpriteRecolorizer.js.
 *
 * x/y are RELATIVE to the centroid of all matching pixels so the pattern
 * stays locked to the body across animation frames.
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
      if (val < 28) return { h: 100, s: 40, l: 32 };
      if (val < 52) return { h: 120, s: 38, l: 18 };
      if (val < 72) return { h: 35, s: 50, l: 28 };
      if (val < 88) return { h: 55, s: 25, l: 45 };
      return { h: 0, s: 0, l: 10 };
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
      const CYCLE = 100;
      const shine = posMod(x + y, CYCLE) / CYCLE;
      const peak = Math.pow(Math.sin(shine * Math.PI), 6);
      const hue = 43 + peak * 5;
      const sat = 90 - peak * 35;
      const lightness = 42 + peak * 45;
      return { h: hue, s: sat, l: lightness };
    }
    default:
      return { h: 0, s: 90, l: 50 };
  }
}

/**
 * Process image data to recolor pixels.
 *
 * For special modes we do TWO passes:
 *   Pass 1 – find the centroid (center of mass) of all matching pixels.
 *   Pass 2 – recolor, using coordinates RELATIVE to the centroid so the
 *            pattern stays locked to the body during animation.
 *
 * When hitTintRed is true: pixels NOT in mawashi/headband range are tinted red
 * (preserve lightness for shading); mawashi/headband stay target color.
 * When blubberTintPurple is true: all non-transparent pixels get a transparent purple tint (thick blubber).
 */
function processImageData(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, specialMode, hitTintRed, width, height, chargeTintWhite = false, blubberTintPurple = false) {
  const data = imageData.data;
  const length = data.length;
  // Hit tint: blend toward true red, slightly subtle
  const HIT_RED_RGB = hslToRgb(0, 58, 55); // Pure red, slightly softer
  const HIT_BLEND = 0.34; // 34% red / 66% original

  // Charge tint: blend toward bright white for charge flash effect
  const CHARGE_WHITE_RGB = { r: 255, g: 255, b: 255 };
  const CHARGE_BLEND = 0.7; // 70% white / 30% original - bold flash that's clearly visible

  // Blubber tint: vibrant purple on non-mawashi pixels (thick blubber power-up)
  const BLUBBER_PURPLE_RGB = hslToRgb(278, 78, 65);
  const BLUBBER_BLEND = 0.35;

  // --- Pass 1: centroid of matching pixels (only needed for special modes) ---
  let anchorX = 0, anchorY = 0;
  let spanW = 1, spanH = 1;
  if (specialMode) {
    let sumX = 0, sumY = 0, count = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let i = 0; i < length; i += 4) {
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
  for (let i = 0; i < length; i += 4) {
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

      // Also tint mawashi/headband white during charge flash (everything goes white)
      if (chargeTintWhite) {
        data[i] = Math.round((1 - CHARGE_BLEND) * data[i] + CHARGE_BLEND * CHARGE_WHITE_RGB.r);
        data[i + 1] = Math.round((1 - CHARGE_BLEND) * data[i + 1] + CHARGE_BLEND * CHARGE_WHITE_RGB.g);
        data[i + 2] = Math.round((1 - CHARGE_BLEND) * data[i + 2] + CHARGE_BLEND * CHARGE_WHITE_RGB.b);
      }
      // Blubber: leave mawashi/headband as recolored (no purple on them, same as isHit)
    } else if (hitTintRed) {
      // Blend original with soft red so tint is subtle and white turns same light red as everything else
      data[i] = Math.round((1 - HIT_BLEND) * r + HIT_BLEND * HIT_RED_RGB.r);
      data[i + 1] = Math.round((1 - HIT_BLEND) * g + HIT_BLEND * HIT_RED_RGB.g);
      data[i + 2] = Math.round((1 - HIT_BLEND) * b + HIT_BLEND * HIT_RED_RGB.b);
    } else if (chargeTintWhite) {
      // Blend original with white for charge flash effect (all non-transparent pixels)
      data[i] = Math.round((1 - CHARGE_BLEND) * r + CHARGE_BLEND * CHARGE_WHITE_RGB.r);
      data[i + 1] = Math.round((1 - CHARGE_BLEND) * g + CHARGE_BLEND * CHARGE_WHITE_RGB.g);
      data[i + 2] = Math.round((1 - CHARGE_BLEND) * b + CHARGE_BLEND * CHARGE_WHITE_RGB.b);
    } else if (blubberTintPurple) {
      // Blend original with transparent purple for thick blubber (all non-transparent pixels)
      data[i] = Math.round((1 - BLUBBER_BLEND) * r + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.r);
      data[i + 1] = Math.round((1 - BLUBBER_BLEND) * g + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.g);
      data[i + 2] = Math.round((1 - BLUBBER_BLEND) * b + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.b);
    }
  }
  
  return imageData;
}

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, payload, id } = e.data;
  
  if (type === 'recolor') {
    const { imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, width, height, specialMode, hitTintRed, chargeTintWhite, blubberTintPurple } = payload;
    
    try {
      const newImageData = new ImageData(
        new Uint8ClampedArray(imageData),
        width,
        height
      );
      
      const processedData = processImageData(newImageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, specialMode, !!hitTintRed, width, height, !!chargeTintWhite, !!blubberTintPurple);
      
      self.postMessage({
        type: 'recolor_complete',
        id,
        payload: {
          imageData: processedData.data.buffer,
          width,
          height,
        }
      }, [processedData.data.buffer]);
      
    } catch (error) {
      self.postMessage({
        type: 'recolor_error',
        id,
        payload: { error: error.message }
      });
    }
  }
};

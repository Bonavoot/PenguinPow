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
 * Process image data to recolor pixels
 * This is the heavy operation that was blocking the main thread
 */
function processImageData(imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness) {
  const data = imageData.data;
  const length = data.length;
  
  // Process pixels in chunks to allow for better optimization
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip fully transparent pixels
    if (a === 0) continue;

    // Convert pixel to HSL
    const pixelHsl = rgbToHsl(r, g, b);

    // Check if this pixel is in our target color range
    if (isColorInHslRange(pixelHsl.h, pixelHsl.s, pixelHsl.l, sourceColorRange)) {
      // Recolor this pixel
      const newColor = recolorPixel(r, g, b, targetHue, targetSat, targetLight, referenceLightness);
      data[i] = newColor.r;
      data[i + 1] = newColor.g;
      data[i + 2] = newColor.b;
    }
  }
  
  return imageData;
}

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, payload, id } = e.data;
  
  if (type === 'recolor') {
    const { imageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness, width, height } = payload;
    
    try {
      // Create new ImageData from the transferred buffer
      const newImageData = new ImageData(
        new Uint8ClampedArray(imageData),
        width,
        height
      );
      
      // Process the pixels (the heavy operation)
      const processedData = processImageData(newImageData, sourceColorRange, targetHue, targetSat, targetLight, referenceLightness);
      
      // Send back the processed data with transfer
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

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
function recolorPixel(
  r,
  g,
  b,
  targetHue,
  targetSaturation,
  targetLightness,
  referenceLightness
) {
  const hsl = rgbToHsl(r, g, b);

  // Calculate how far the original pixel's lightness is from the reference (source midpoint)
  const lightnessOffset = hsl.l - referenceLightness;

  // Apply this offset to the target lightness, with some compression for extreme targets
  let newLightness;

  if (targetLightness < 20) {
    // Very dark target (like black): compress lightness range, bias toward dark
    newLightness = targetLightness + lightnessOffset * 0.3;
  } else if (targetLightness > 80) {
    // Very light target (like light pink): compress lightness range, bias toward light
    newLightness = targetLightness + lightnessOffset * 0.3;
  } else {
    // Normal target: preserve more of the original shading
    newLightness = targetLightness + lightnessOffset * 0.7;
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
    case "rainbow": {
      const CYCLE = 50;
      return { h: (posMod(y, CYCLE) / CYCLE) * 360, s: 90, l: 50 };
    }
    case "fire": {
      const CYCLE = 70;
      const t = posMod(y, CYCLE) / CYCLE;
      const hue = 55 - t * 55;
      const lightness = 60 - t * 30;
      return { h: hue, s: 100, l: lightness };
    }
    case "vaporwave": {
      const CYCLE = 60;
      const t = posMod(y, CYCLE) / CYCLE;
      const hue = 300 - t * 120;
      return { h: hue, s: 80, l: 55 };
    }
    case "camo": {
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
    case "galaxy": {
      let hash = (x * 374761393 + y * 668265263) | 0;
      hash = ((hash ^ (hash >>> 13)) * 1274126177) | 0;
      hash = (hash ^ (hash >>> 16)) >>> 0;
      const val = hash % 1000;

      if (val < 3) return { h: 200, s: 10, l: 98 }; // rare brilliant white-blue star
      if (val < 5) return { h: 45, s: 15, l: 95 }; // rare warm white star

      const CYCLE = 60;
      const drift = posMod(x + y * 2, CYCLE) / CYCLE;

      if (val < 60) return { h: 310 + drift * 30, s: 70, l: 45 };
      if (val < 120) return { h: 260 + drift * 20, s: 65, l: 35 };

      const baseHue = 260 + drift * 30;
      return { h: baseHue, s: 60, l: 15 };
    }
    case "gold": {
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
function processImageData(
  imageData,
  sourceColorRange,
  targetHue,
  targetSat,
  targetLight,
  referenceLightness,
  specialMode,
  hitTintRed,
  width,
  height,
  chargeTintWhite = false,
  blubberTintPurple = false,
  bodyColorRange = null,
  bodyTargetHue = 0,
  bodyTargetSat = 0,
  bodyTargetLight = 50,
  bodyReferenceLightness = 49,
  skipMawashiRecolor = false
) {
  const data = imageData.data;
  const length = data.length;
  const HIT_RED_RGB = hslToRgb(0, 58, 55);
  const HIT_BLEND = 0.34;
  const CHARGE_WHITE_RGB = { r: 255, g: 255, b: 255 };
  const CHARGE_BLEND = 0.7;
  const BLUBBER_PURPLE_RGB = hslToRgb(278, 78, 65);
  const BLUBBER_BLEND = 0.35;
  const BODY_WHITE_TINT = 0.14;
  const SCLERA_WHITEN = 0.8;
  const bodyTintRgb = bodyColorRange ? hslToRgb(bodyTargetHue, bodyTargetSat, bodyTargetLight) : null;

  // --- Pass 1: centroid of matching pixels (only needed for special modes) ---
  let anchorX = 0,
    anchorY = 0;
  let spanW = 1,
    spanH = 1;
  if (specialMode) {
    let sumX = 0,
      sumY = 0,
      count = 0;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
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

  // --- Pre-compute edge flags + white tinting flags for body neighbor filtering ---
  const pixelCount = length / 4;
  let edgeFlags = null;
  let whiteTintFlags = null;
  let scleraFlags = null;
  if (bodyColorRange) {
    edgeFlags = new Uint8Array(pixelCount);
    const isGreyBody = new Uint8Array(pixelCount);
    const isWhite = new Uint8Array(pixelCount);
    const isDark = new Uint8Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      const pi = p * 4;
      if (data[pi + 3] === 0) {
        edgeFlags[p] = 1;
        continue;
      }
      const pHsl = rgbToHsl(data[pi], data[pi + 1], data[pi + 2]);
      if (pHsl.l < 15 || pHsl.l > 85) edgeFlags[p] = 1;
      if (pHsl.l < 15) isDark[p] = 1;
      if (isColorInHslRange(pHsl.h, pHsl.s, pHsl.l, bodyColorRange)) {
        isGreyBody[p] = 1;
      }
      if (pHsl.l > 72 && pHsl.s <= 15) {
        isWhite[p] = 1;
      }
    }

    // BFS from grey body into adjacent white pixels to find all body-connected whites
    whiteTintFlags = new Uint8Array(pixelCount);
    const queue = [];
    for (let p = 0; p < pixelCount; p++) {
      if (!isWhite[p]) continue;
      const px = p % width;
      const py = (p / width) | 0;
      if ((px > 0 && isGreyBody[p - 1]) ||
          (px < width - 1 && isGreyBody[p + 1]) ||
          (py > 0 && isGreyBody[p - width]) ||
          (py < height - 1 && isGreyBody[p + width])) {
        whiteTintFlags[p] = 1;
        queue.push(p);
      }
    }
    let qi = 0;
    while (qi < queue.length) {
      const cp = queue[qi++];
      const cx = cp % width;
      const cy = (cp / width) | 0;
      if (cx > 0 && isWhite[cp - 1] && !whiteTintFlags[cp - 1]) {
        whiteTintFlags[cp - 1] = 1; queue.push(cp - 1);
      }
      if (cx < width - 1 && isWhite[cp + 1] && !whiteTintFlags[cp + 1]) {
        whiteTintFlags[cp + 1] = 1; queue.push(cp + 1);
      }
      if (cy > 0 && isWhite[cp - width] && !whiteTintFlags[cp - width]) {
        whiteTintFlags[cp - width] = 1; queue.push(cp - width);
      }
      if (cy < height - 1 && isWhite[cp + width] && !whiteTintFlags[cp + width]) {
        whiteTintFlags[cp + width] = 1; queue.push(cp + width);
      }
    }

    // Eye protection: find small enclosed white regions (sclera).
    // Each eye's sclera is a separate white connected component fully enclosed
    // by the dark eye outline. The face/chest is one huge component (tens of
    // thousands of pixels). Sclera regions are 50-1000 pixels.
    const MIN_SCLERA = 20;
    const MAX_SCLERA = 1400;
    scleraFlags = new Uint8Array(pixelCount);
    const wVis = new Uint8Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      if (!isWhite[p] || wVis[p]) continue;
      const comp = [p];
      wVis[p] = 1;
      let ci = 0;
      while (ci < comp.length) {
        const cp = comp[ci++];
        const cx = cp % width;
        const cy = (cp / width) | 0;
        if (cx > 0 && isWhite[cp - 1] && !wVis[cp - 1])             { wVis[cp - 1] = 1; comp.push(cp - 1); }
        if (cx < width - 1 && isWhite[cp + 1] && !wVis[cp + 1])     { wVis[cp + 1] = 1; comp.push(cp + 1); }
        if (cy > 0 && isWhite[cp - width] && !wVis[cp - width])     { wVis[cp - width] = 1; comp.push(cp - width); }
        if (cy < height - 1 && isWhite[cp + width] && !wVis[cp + width]) { wVis[cp + width] = 1; comp.push(cp + width); }
      }
      if (comp.length >= MIN_SCLERA && comp.length <= MAX_SCLERA) {
        for (let ci2 = 0; ci2 < comp.length; ci2++) {
          whiteTintFlags[comp[ci2]] = 0;
          scleraFlags[comp[ci2]] = 1;
        }
      }
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

    if (
      isColorInHslRange(pixelHsl.h, pixelHsl.s, pixelHsl.l, sourceColorRange)
    ) {
      // --- Mawashi / headband ---
      if (!skipMawashiRecolor) {
        let hue = targetHue;
        let sat = targetSat;
        let light = targetLight;

        if (specialMode) {
          const idx = i / 4;
          const relX = (idx % width) - anchorX;
          const relY = ((idx / width) | 0) - anchorY;
          const sc = getSpecialPixelColor(
            specialMode,
            relX,
            relY,
            spanW,
            spanH
          );
          hue = sc.h;
          sat = sc.s;
          light = sc.l;
        }

        const newColor = recolorPixel(
          r,
          g,
          b,
          hue,
          sat,
          light,
          referenceLightness
        );
        data[i] = newColor.r;
        data[i + 1] = newColor.g;
        data[i + 2] = newColor.b;
      }

      if (chargeTintWhite) {
        data[i] = Math.round(
          (1 - CHARGE_BLEND) * data[i] + CHARGE_BLEND * CHARGE_WHITE_RGB.r
        );
        data[i + 1] = Math.round(
          (1 - CHARGE_BLEND) * data[i + 1] + CHARGE_BLEND * CHARGE_WHITE_RGB.g
        );
        data[i + 2] = Math.round(
          (1 - CHARGE_BLEND) * data[i + 2] + CHARGE_BLEND * CHARGE_WHITE_RGB.b
        );
      }
    } else if (
      bodyColorRange &&
      isColorInHslRange(pixelHsl.h, pixelHsl.s, pixelHsl.l, bodyColorRange)
    ) {
      // --- Body (grey plumage) — skip thin lines (outlines, eyes, hair details) ---
      const pidx = i / 4;
      const px = pidx % width;
      const py = (pidx / width) | 0;
      let edgeNeighbors = 0;
      if (px === 0 || edgeFlags[pidx - 1]) edgeNeighbors++;
      if (px === width - 1 || edgeFlags[pidx + 1]) edgeNeighbors++;
      if (py === 0 || edgeFlags[pidx - width]) edgeNeighbors++;
      if (py === height - 1 || edgeFlags[pidx + width]) edgeNeighbors++;

      if (edgeNeighbors >= 2) {
        if (hitTintRed) {
          data[i] = Math.round((1 - HIT_BLEND) * r + HIT_BLEND * HIT_RED_RGB.r);
          data[i + 1] = Math.round(
            (1 - HIT_BLEND) * g + HIT_BLEND * HIT_RED_RGB.g
          );
          data[i + 2] = Math.round(
            (1 - HIT_BLEND) * b + HIT_BLEND * HIT_RED_RGB.b
          );
        } else if (chargeTintWhite) {
          data[i] = Math.round(
            (1 - CHARGE_BLEND) * r + CHARGE_BLEND * CHARGE_WHITE_RGB.r
          );
          data[i + 1] = Math.round(
            (1 - CHARGE_BLEND) * g + CHARGE_BLEND * CHARGE_WHITE_RGB.g
          );
          data[i + 2] = Math.round(
            (1 - CHARGE_BLEND) * b + CHARGE_BLEND * CHARGE_WHITE_RGB.b
          );
        } else if (blubberTintPurple) {
          data[i] = Math.round(
            (1 - BLUBBER_BLEND) * r + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.r
          );
          data[i + 1] = Math.round(
            (1 - BLUBBER_BLEND) * g + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.g
          );
          data[i + 2] = Math.round(
            (1 - BLUBBER_BLEND) * b + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.b
          );
        }
        continue;
      }

      const newColor = recolorPixel(
        r,
        g,
        b,
        bodyTargetHue,
        bodyTargetSat,
        bodyTargetLight,
        bodyReferenceLightness
      );
      data[i] = newColor.r;
      data[i + 1] = newColor.g;
      data[i + 2] = newColor.b;

      if (hitTintRed) {
        data[i] = Math.round(
          (1 - HIT_BLEND) * data[i] + HIT_BLEND * HIT_RED_RGB.r
        );
        data[i + 1] = Math.round(
          (1 - HIT_BLEND) * data[i + 1] + HIT_BLEND * HIT_RED_RGB.g
        );
        data[i + 2] = Math.round(
          (1 - HIT_BLEND) * data[i + 2] + HIT_BLEND * HIT_RED_RGB.b
        );
      } else if (chargeTintWhite) {
        data[i] = Math.round(
          (1 - CHARGE_BLEND) * data[i] + CHARGE_BLEND * CHARGE_WHITE_RGB.r
        );
        data[i + 1] = Math.round(
          (1 - CHARGE_BLEND) * data[i + 1] + CHARGE_BLEND * CHARGE_WHITE_RGB.g
        );
        data[i + 2] = Math.round(
          (1 - CHARGE_BLEND) * data[i + 2] + CHARGE_BLEND * CHARGE_WHITE_RGB.b
        );
      } else if (blubberTintPurple) {
        data[i] = Math.round(
          (1 - BLUBBER_BLEND) * data[i] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.r
        );
        data[i + 1] = Math.round(
          (1 - BLUBBER_BLEND) * data[i + 1] +
            BLUBBER_BLEND * BLUBBER_PURPLE_RGB.g
        );
        data[i + 2] = Math.round(
          (1 - BLUBBER_BLEND) * data[i + 2] +
            BLUBBER_BLEND * BLUBBER_PURPLE_RGB.b
        );
      }
    } else if (scleraFlags && scleraFlags[i / 4]) {
      data[i] = Math.round(r + (255 - r) * SCLERA_WHITEN);
      data[i + 1] = Math.round(g + (255 - g) * SCLERA_WHITEN);
      data[i + 2] = Math.round(b + (255 - b) * SCLERA_WHITEN);

      if (hitTintRed) {
        data[i] = Math.round((1 - HIT_BLEND) * data[i] + HIT_BLEND * HIT_RED_RGB.r);
        data[i + 1] = Math.round((1 - HIT_BLEND) * data[i + 1] + HIT_BLEND * HIT_RED_RGB.g);
        data[i + 2] = Math.round((1 - HIT_BLEND) * data[i + 2] + HIT_BLEND * HIT_RED_RGB.b);
      } else if (blubberTintPurple) {
        data[i] = Math.round((1 - BLUBBER_BLEND) * data[i] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.r);
        data[i + 1] = Math.round((1 - BLUBBER_BLEND) * data[i + 1] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.g);
        data[i + 2] = Math.round((1 - BLUBBER_BLEND) * data[i + 2] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.b);
      }
    } else if (whiteTintFlags && whiteTintFlags[i / 4]) {
      data[i] = Math.round((1 - BODY_WHITE_TINT) * r + BODY_WHITE_TINT * bodyTintRgb.r);
      data[i + 1] = Math.round((1 - BODY_WHITE_TINT) * g + BODY_WHITE_TINT * bodyTintRgb.g);
      data[i + 2] = Math.round((1 - BODY_WHITE_TINT) * b + BODY_WHITE_TINT * bodyTintRgb.b);

      if (hitTintRed) {
        data[i] = Math.round((1 - HIT_BLEND) * data[i] + HIT_BLEND * HIT_RED_RGB.r);
        data[i + 1] = Math.round((1 - HIT_BLEND) * data[i + 1] + HIT_BLEND * HIT_RED_RGB.g);
        data[i + 2] = Math.round((1 - HIT_BLEND) * data[i + 2] + HIT_BLEND * HIT_RED_RGB.b);
      } else if (chargeTintWhite) {
        data[i] = Math.round((1 - CHARGE_BLEND) * data[i] + CHARGE_BLEND * CHARGE_WHITE_RGB.r);
        data[i + 1] = Math.round((1 - CHARGE_BLEND) * data[i + 1] + CHARGE_BLEND * CHARGE_WHITE_RGB.g);
        data[i + 2] = Math.round((1 - CHARGE_BLEND) * data[i + 2] + CHARGE_BLEND * CHARGE_WHITE_RGB.b);
      } else if (blubberTintPurple) {
        data[i] = Math.round((1 - BLUBBER_BLEND) * data[i] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.r);
        data[i + 1] = Math.round((1 - BLUBBER_BLEND) * data[i + 1] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.g);
        data[i + 2] = Math.round((1 - BLUBBER_BLEND) * data[i + 2] + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.b);
      }
    } else if (hitTintRed) {
      data[i] = Math.round((1 - HIT_BLEND) * r + HIT_BLEND * HIT_RED_RGB.r);
      data[i + 1] = Math.round((1 - HIT_BLEND) * g + HIT_BLEND * HIT_RED_RGB.g);
      data[i + 2] = Math.round((1 - HIT_BLEND) * b + HIT_BLEND * HIT_RED_RGB.b);
    } else if (chargeTintWhite) {
      data[i] = Math.round(
        (1 - CHARGE_BLEND) * r + CHARGE_BLEND * CHARGE_WHITE_RGB.r
      );
      data[i + 1] = Math.round(
        (1 - CHARGE_BLEND) * g + CHARGE_BLEND * CHARGE_WHITE_RGB.g
      );
      data[i + 2] = Math.round(
        (1 - CHARGE_BLEND) * b + CHARGE_BLEND * CHARGE_WHITE_RGB.b
      );
    } else if (blubberTintPurple) {
      data[i] = Math.round(
        (1 - BLUBBER_BLEND) * r + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.r
      );
      data[i + 1] = Math.round(
        (1 - BLUBBER_BLEND) * g + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.g
      );
      data[i + 2] = Math.round(
        (1 - BLUBBER_BLEND) * b + BLUBBER_BLEND * BLUBBER_PURPLE_RGB.b
      );
    }
  }

  return imageData;
}

// Handle messages from main thread
self.onmessage = function (e) {
  const { type, payload, id } = e.data;

  if (type === "recolor") {
    const {
      imageData,
      sourceColorRange,
      targetHue,
      targetSat,
      targetLight,
      referenceLightness,
      width,
      height,
      specialMode,
      hitTintRed,
      chargeTintWhite,
      blubberTintPurple,
      bodyColorRange,
      bodyTargetHue,
      bodyTargetSat,
      bodyTargetLight,
      bodyReferenceLightness,
      skipMawashiRecolor,
    } = payload;

    try {
      const newImageData = new ImageData(
        new Uint8ClampedArray(imageData),
        width,
        height
      );

      const processedData = processImageData(
        newImageData,
        sourceColorRange,
        targetHue,
        targetSat,
        targetLight,
        referenceLightness,
        specialMode,
        !!hitTintRed,
        width,
        height,
        !!chargeTintWhite,
        !!blubberTintPurple,
        bodyColorRange || null,
        bodyTargetHue || 0,
        bodyTargetSat || 0,
        bodyTargetLight || 50,
        bodyReferenceLightness || 49,
        !!skipMawashiRecolor
      );

      self.postMessage(
        {
          type: "recolor_complete",
          id,
          payload: {
            imageData: processedData.data.buffer,
            width,
            height,
          },
        },
        [processedData.data.buffer]
      );
    } catch (error) {
      self.postMessage({
        type: "recolor_error",
        id,
        payload: { error: error.message },
      });
    }
  }
};

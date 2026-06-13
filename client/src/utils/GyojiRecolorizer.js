/**
 * Gyoji dual-palette recoloring — green robe + yellow floral pattern.
 * Uses data URLs (not blob URLs) so recolored images can never be revoked
 * mid-match by the player sprite cache.
 */

import { resolveHiRes } from "../config/hiResSprites";
import { getHslFromHex, preDecodeImages } from "./SpriteRecolorizer";
import { outfitNeedsRecolor } from "../config/gyojiOutfitPresets";

import gyojiIdle from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";

export const GYOJI_IMAGE_SOURCES = {
  idle: gyojiIdle,
  ready: gyojiReady,
  player1Win: gyojiPlayer1wins,
  player2Win: gyojiPlayer2wins,
};

export const GYOJI_GREEN_RANGES = {
  minLightness: 5,
  maxLightness: 58,
};

export const GYOJI_YELLOW_RANGES = {
  minLightness: 8,
  maxLightness: 75,
};

function isGyojiGreenPixel(r, g, b, h, s, l) {
  if (g - Math.max(r, b) < 6 || g < 18) return false;
  if (h < 68 || h > 168) return false;
  if (l < GYOJI_GREEN_RANGES.minLightness || l > GYOJI_GREEN_RANGES.maxLightness) {
    return false;
  }
  const minSat = l < 28 ? 6 : 18;
  return s >= minSat;
}

function isGyojiYellowPixel(r, g, b, h, s, l) {
  if (h < 26 || h > 74) return false;
  if (l < GYOJI_YELLOW_RANGES.minLightness || l > GYOJI_YELLOW_RANGES.maxLightness) {
    return false;
  }
  if (r < 40 && g < 40) return false;
  const minSat = l < 28 ? 8 : 22;
  return s >= minSat;
}

const gyojiRecolorCache = new Map();
const inFlightGyojiRecolors = new Map();

let activeGyojiSprites = null;

export function getActiveGyojiSprites() {
  return activeGyojiSprites;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;
  if (max === min) {
    h = 0;
    s = 0;
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
      default:
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
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
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

function recolorPixel(r, g, b, targetHue, targetSat, targetLight, referenceLightness) {
  const hsl = rgbToHsl(r, g, b);
  const lightnessOffset = hsl.l - referenceLightness;
  let newLightness;
  if (targetLight < 20) {
    newLightness = targetLight + lightnessOffset * 0.3;
  } else if (targetLight > 80) {
    newLightness = targetLight + lightnessOffset * 0.3;
  } else {
    newLightness = targetLight + lightnessOffset * 0.7;
  }
  newLightness = Math.max(0, Math.min(100, newLightness));
  return hslToRgb(targetHue, targetSat, newLightness);
}

function processGyojiPixels(imageData, robeHex, patternHex) {
  const data = imageData.data;
  const robeHsl = getHslFromHex(robeHex);
  const patternHsl = getHslFromHex(patternHex);
  const robeRefLight =
    (GYOJI_GREEN_RANGES.minLightness + GYOJI_GREEN_RANGES.maxLightness) / 2;
  const patternRefLight =
    (GYOJI_YELLOW_RANGES.minLightness + GYOJI_YELLOW_RANGES.maxLightness) / 2;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const pixelHsl = rgbToHsl(r, g, b);

    if (isGyojiGreenPixel(r, g, b, pixelHsl.h, pixelHsl.s, pixelHsl.l)) {
      const next = recolorPixel(
        r,
        g,
        b,
        robeHsl.h,
        robeHsl.s,
        robeHsl.l,
        robeRefLight
      );
      data[i] = next.r;
      data[i + 1] = next.g;
      data[i + 2] = next.b;
    } else if (isGyojiYellowPixel(r, g, b, pixelHsl.h, pixelHsl.s, pixelHsl.l)) {
      const next = recolorPixel(
        r,
        g,
        b,
        patternHsl.h,
        patternHsl.s,
        patternHsl.l,
        patternRefLight
      );
      data[i] = next.r;
      data[i + 1] = next.g;
      data[i + 2] = next.b;
    }
  }
}

function buildCacheKey(imageSrc, robeHex, patternHex) {
  const hiResSrc = resolveHiRes(imageSrc);
  return `gyoji_v3_${hiResSrc}_${robeHex}_${patternHex}`;
}

export async function recolorGyojiImage(imageSrc, robeHex, patternHex) {
  const cacheKey = buildCacheKey(imageSrc, robeHex, patternHex);
  const cached = gyojiRecolorCache.get(cacheKey);
  if (cached) return cached;

  if (inFlightGyojiRecolors.has(cacheKey)) {
    return inFlightGyojiRecolors.get(cacheKey);
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        processGyojiPixels(imageData, robeHex, patternHex);
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        gyojiRecolorCache.set(cacheKey, dataUrl);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load gyoji image: ${imageSrc}`));
    img.src = resolveHiRes(imageSrc);
  });

  inFlightGyojiRecolors.set(cacheKey, promise);
  promise.finally(() => inFlightGyojiRecolors.delete(cacheKey));
  return promise;
}

export async function preloadGyojiOutfit(outfit) {
  const { robe, pattern } = outfit;
  const needsRecolor = outfitNeedsRecolor(outfit);

  const results = await Promise.all(
    Object.entries(GYOJI_IMAGE_SOURCES).map(async ([key, src]) => {
      if (!needsRecolor) {
        await preDecodeImages([resolveHiRes(src)]);
        return [key, src];
      }
      const recolored = await recolorGyojiImage(src, robe, pattern);
      return [key, recolored];
    })
  );

  activeGyojiSprites = Object.fromEntries(results);
  return activeGyojiSprites;
}

export function clearGyojiRecolorCache() {
  gyojiRecolorCache.clear();
  activeGyojiSprites = null;
}

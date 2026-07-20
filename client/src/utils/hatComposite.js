/**
 * Composite a transparent hat overlay onto a (possibly recolored) body sprite.
 * Results are cached — ice-slide / breathe must stay on a single <img>.
 *
 * GHOST-FRAME NOTES:
 * Minting a fresh data-/blob-URL per pose and painting it before the browser
 * has decoded it (or falling back to the unhatted body for a frame) is what
 * causes hat-related ghosts. We:
 *  1. Prefer a sync composite when both layers are already in decodedImageCache
 *  2. Pre-decode + pin composite URLs during match preload (warmHatComposites)
 *  3. Never return a URL that hasn't been handed to preDecodeImage
 */

import {
  HAT_OVERLAY_BY_SRC,
  getEquippedHeadGearId,
  getIdleHatOverlay,
  getHatOverlayForSprite,
} from "../config/cosmetics";
import { getBaldBodySrc, resolveBodyForHeadGear } from "../config/baldSprites";
import { getBakedSprite } from "./bakedSprites";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  getDecodedImage,
  getCachedRecoloredImage,
  preDecodeImage,
  pinDecodedImagesAppend,
} from "./SpriteRecolorizer";

const cache = new Map();
const MAX_CACHE = 512;

const TINTS = ["base", "hit", "charge", "blubber", "armor"];

function cacheKey(baseSrc, overlaySrc) {
  return `${baseSrc}||${overlaySrc}`;
}

function loadImage(src) {
  const warm = getDecodedImage(src);
  if (warm) return Promise.resolve(warm);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function canvasToBlobUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Hat composite toBlob failed"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/png",
    );
  });
}

function drawComposite(baseImg, overlayImg) {
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth || baseImg.width;
  canvas.height = baseImg.naturalHeight || baseImg.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImg, 0, 0);
  ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function storeComposite(baseSrc, overlaySrc, canvas) {
  const key = cacheKey(baseSrc, overlaySrc);
  const url = await canvasToBlobUrl(canvas);
  await preDecodeImage(url);
  cache.set(key, url);
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    const old = cache.get(first);
    cache.delete(first);
    // Don't revoke — may still be pinned / on-screen; GC later via LRU pressure.
    void old;
  }
  return url;
}

/** Sync cache lookup — returns null on miss. */
export function getCachedHatComposite(baseSrc, overlaySrc) {
  if (!baseSrc || !overlaySrc) return null;
  const key = cacheKey(baseSrc, overlaySrc);
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

/**
 * Sync composite when both layers are already decoded. Returns null if either
 * image isn't warm yet (caller should fall through to async / unhatted briefly).
 */
export function compositeHatOntoSpriteSync(baseSrc, overlaySrc) {
  if (!baseSrc || !overlaySrc) return null;
  const hit = getCachedHatComposite(baseSrc, overlaySrc);
  if (hit) return hit;

  const base = getDecodedImage(baseSrc);
  const overlay = getDecodedImage(overlaySrc);
  if (!base || !overlay) return null;

  // Sync path uses data URL so we can return immediately; warm path prefers blobs.
  const canvas = drawComposite(base, overlay);
  const url = canvas.toDataURL("image/png");
  const key = cacheKey(baseSrc, overlaySrc);
  cache.set(key, url);
  // Fire-and-forget decode so the next paint is warm; first paint may still
  // use this URL — preload warm should make this rare.
  preDecodeImage(url);
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  return url;
}

/**
 * @param {string} baseSrc - body sprite (file URL or data/blob URL)
 * @param {string|null} overlaySrc - hat overlay, or null to pass through
 * @returns {Promise<string>} composite URL (or baseSrc when no overlay)
 */
export async function compositeHatOntoSprite(baseSrc, overlaySrc) {
  if (!baseSrc) return baseSrc;
  if (!overlaySrc) return baseSrc;

  const hit = getCachedHatComposite(baseSrc, overlaySrc);
  if (hit) return hit;

  const sync = compositeHatOntoSpriteSync(baseSrc, overlaySrc);
  if (sync) return sync;

  const [base, overlay] = await Promise.all([
    loadImage(baseSrc),
    loadImage(overlaySrc),
  ]);
  const canvas = drawComposite(base, overlay);
  return storeComposite(baseSrc, overlaySrc, canvas);
}

function tintOptionsFor(tint, bodyColor) {
  const opts = bodyColor
    ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: bodyColor }
    : {};
  if (tint === "hit") opts.hitTintRed = true;
  if (tint === "charge") opts.chargeTintWhite = true;
  if (tint === "blubber") opts.blubberTintPurple = true;
  if (tint === "armor") opts.armorTintPink = true;
  return opts;
}

function resolveBodySrc(bodySrc, mawashiColor, bodyColor, tint) {
  const baked = getBakedSprite(bodySrc, mawashiColor, bodyColor, tint);
  if (baked) return baked;
  return getCachedRecoloredImage(
    bodySrc,
    BLUE_COLOR_RANGES,
    mawashiColor || SPRITE_BASE_COLOR,
    tintOptionsFor(tint, bodyColor),
  );
}

/**
 * Pre-bake + pin every hat composite for a fighter's colors so combat pose
 * swaps hit the sync cache (no unhatted fallback, no cold data-URL decode).
 */
export async function warmHatCompositesForFighter({
  mawashiColor,
  bodyColor,
  gearIds,
}) {
  const gearId = getEquippedHeadGearId(gearIds);
  if (!gearId) return [];

  const overlayUrls = [];
  const bodyUrls = [];
  for (const hairedSrc of HAT_OVERLAY_BY_SRC.keys()) {
    const overlaySrc = getHatOverlayForSprite(hairedSrc, gearId);
    if (overlaySrc) overlayUrls.push(overlaySrc);
    // Composite onto bald underlay when available (matches combat path).
    bodyUrls.push(getBaldBodySrc(hairedSrc) || hairedSrc);
  }
  await Promise.all(
    [...new Set([...overlayUrls, ...bodyUrls])].map((u) => preDecodeImage(u)),
  );

  const out = [];
  for (const hairedSrc of HAT_OVERLAY_BY_SRC.keys()) {
    const overlaySrc = getHatOverlayForSprite(hairedSrc, gearId);
    if (!overlaySrc) continue;
    const bodySrc = getBaldBodySrc(hairedSrc) || hairedSrc;
    for (const tint of TINTS) {
      const base = resolveBodySrc(bodySrc, mawashiColor, bodyColor, tint);
      if (!base) continue;
      await preDecodeImage(base);
      try {
        const url = await compositeHatOntoSprite(base, overlaySrc);
        if (url && url !== base) out.push(url);
      } catch (err) {
        console.warn("[Hat] warm composite failed", bodySrc, tint, err);
      }
    }
  }
  if (out.length) await pinDecodedImagesAppend(out);
  return out;
}

/**
 * Recolor idle body (optional) then bake on the idle hat when equipped.
 * Used by Lobby / BashoHub / PreMatch / Customize portraits.
 */
export async function buildIdlePortraitSrc({
  baseSrc,
  mawashiColor,
  bodyColor,
  gearIds,
  hatOverlay,
}) {
  // Topper portraits sit on the bald idle when we have one.
  const bodySrc = resolveBodyForHeadGear(baseSrc, gearIds);
  let src = bodySrc;
  const needsMawashi = mawashiColor && mawashiColor !== SPRITE_BASE_COLOR;
  const needsBody = !!bodyColor;

  if (needsMawashi || needsBody) {
    const bodyOpts = needsBody
      ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: bodyColor }
      : {};
    src = await recolorImage(
      bodySrc,
      BLUE_COLOR_RANGES,
      mawashiColor || SPRITE_BASE_COLOR,
      bodyOpts,
    );
  }

  const gearId = getEquippedHeadGearId(gearIds);
  const overlay = hatOverlay || (gearId ? getIdleHatOverlay(gearId) : null);
  if (overlay) {
    src = await compositeHatOntoSprite(src, overlay);
  }

  return src;
}

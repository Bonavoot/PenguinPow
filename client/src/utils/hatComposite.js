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
  getHatOverlayForSprite,
  headGearRecolorsWithMawashi,
  isHeadGearUnderBody,
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

function cacheKey(baseSrc, overlaySrc, underBody) {
  return `${baseSrc}||${overlaySrc}||${underBody ? "under" : "over"}`;
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

/**
 * Main-menu hero only: body recolor treats soft black AA as grey plumage,
 * so tint leaks into outlines (eyes, seams). Restore outline-like pixels
 * from the pre-recolor source. Body fill on this art is ~rgb(75,75,76) —
 * we only put back darker ink + lighter fringe glued to near-black.
 */
function isRestorableLinework(src, i, width, height) {
  const r = src[i];
  const g = src[i + 1];
  const b = src[i + 2];
  const a = src[i + 3];
  if (a === 0) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx === 0 ? 0 : ((mx - mn) / mx) * 100;

  // Pure / soft black outline + dark AA (below body fill ~75)
  if (mx <= 68) return true;
  // Semi-transparent ink
  if (a < 245 && mx <= 100) return true;
  // Lighter grey AA between black linework and white/face (eye rims)
  if (sat > 20 || mx < 80 || mx > 170) return false;
  const pidx = i / 4;
  const px = pidx % width;
  const py = (pidx / width) | 0;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ]) {
    const nx = px + dx;
    const ny = py + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const j = (ny * width + nx) * 4;
    if (src[j + 3] < 10) continue;
    if (Math.max(src[j], src[j + 1], src[j + 2]) <= 40) return true;
  }
  return false;
}

async function restoreLineworkFromSource(sourceSrc, recoloredSrc) {
  const [srcImg, dstImg] = await Promise.all([
    loadImage(sourceSrc),
    loadImage(recoloredSrc),
  ]);
  const width = srcImg.naturalWidth || srcImg.width;
  const height = srcImg.naturalHeight || srcImg.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(srcImg, 0, 0);
  const srcData = ctx.getImageData(0, 0, width, height).data;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(dstImg, 0, 0, width, height);
  const out = ctx.getImageData(0, 0, width, height);
  const dst = out.data;
  for (let i = 0; i < dst.length; i += 4) {
    if (!isRestorableLinework(srcData, i, width, height)) continue;
    dst[i] = srcData[i];
    dst[i + 1] = srcData[i + 1];
    dst[i + 2] = srcData[i + 2];
    dst[i + 3] = srcData[i + 3];
  }
  ctx.putImageData(out, 0, 0);
  const url = await canvasToBlobUrl(canvas);
  await preDecodeImage(url);
  return url;
}

function drawComposite(baseImg, overlayImg, underBody = false) {
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth || baseImg.width;
  canvas.height = baseImg.naturalHeight || baseImg.height;
  const ctx = canvas.getContext("2d");
  if (underBody) {
    // Gear behind body (head occludes the gear).
    ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0);
  } else {
    ctx.drawImage(baseImg, 0, 0);
    ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

async function storeComposite(baseSrc, overlaySrc, canvas, underBody = false) {
  const key = cacheKey(baseSrc, overlaySrc, underBody);
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
export function getCachedHatComposite(baseSrc, overlaySrc, underBody = false) {
  if (!baseSrc || !overlaySrc) return null;
  const key = cacheKey(baseSrc, overlaySrc, underBody);
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

/**
 * Sync composite when both layers are already decoded. Returns null if either
 * image isn't warm yet (caller should fall through to async / unhatted briefly).
 * @param {boolean} [underBody] - draw gear under the body (e.g. plunger)
 */
export function compositeHatOntoSpriteSync(baseSrc, overlaySrc, underBody = false) {
  if (!baseSrc || !overlaySrc) return null;
  const hit = getCachedHatComposite(baseSrc, overlaySrc, underBody);
  if (hit) return hit;

  const base = getDecodedImage(baseSrc);
  const overlay = getDecodedImage(overlaySrc);
  if (!base || !overlay) return null;

  // Sync path uses data URL so we can return immediately; warm path prefers blobs.
  const canvas = drawComposite(base, overlay, underBody);
  const url = canvas.toDataURL("image/png");
  const key = cacheKey(baseSrc, overlaySrc, underBody);
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
 * @param {boolean} [underBody] - draw gear under the body (e.g. plunger)
 * @returns {Promise<string>} composite URL (or baseSrc when no overlay)
 */
export async function compositeHatOntoSprite(baseSrc, overlaySrc, underBody = false) {
  if (!baseSrc) return baseSrc;
  if (!overlaySrc) return baseSrc;

  const hit = getCachedHatComposite(baseSrc, overlaySrc, underBody);
  if (hit) return hit;

  const sync = compositeHatOntoSpriteSync(baseSrc, overlaySrc, underBody);
  if (sync) return sync;

  const [base, overlay] = await Promise.all([
    loadImage(baseSrc),
    loadImage(overlaySrc),
  ]);
  const canvas = drawComposite(base, overlay, underBody);
  return storeComposite(baseSrc, overlaySrc, canvas, underBody);
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
 * Resolve overlay URL — retints mawashi-blue (e.g. ponytail hair tie) when
 * the gear opts in. Sync path uses the recolor cache; async warms it.
 */
export function resolveHatOverlaySrcSync(overlaySrc, gearId, mawashiColor) {
  if (!overlaySrc) return null;
  if (!headGearRecolorsWithMawashi(gearId)) return overlaySrc;
  const color = mawashiColor || SPRITE_BASE_COLOR;
  if (color === SPRITE_BASE_COLOR) return overlaySrc;
  return (
    getCachedRecoloredImage(overlaySrc, BLUE_COLOR_RANGES, color) || overlaySrc
  );
}

export async function resolveHatOverlaySrc(overlaySrc, gearId, mawashiColor) {
  if (!overlaySrc) return null;
  if (!headGearRecolorsWithMawashi(gearId)) return overlaySrc;
  const color = mawashiColor || SPRITE_BASE_COLOR;
  if (color === SPRITE_BASE_COLOR) return overlaySrc;
  const cached = getCachedRecoloredImage(overlaySrc, BLUE_COLOR_RANGES, color);
  if (cached) return cached;
  return recolorImage(overlaySrc, BLUE_COLOR_RANGES, color);
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
  const underBody = isHeadGearUnderBody(gearId);

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

  // Warm recolored overlays (ponytail hair tie ↔ belt) once up front.
  const recoloredOverlayByRaw = new Map();
  if (headGearRecolorsWithMawashi(gearId)) {
    await Promise.all(
      [...new Set(overlayUrls)].map(async (raw) => {
        const tinted = await resolveHatOverlaySrc(raw, gearId, mawashiColor);
        recoloredOverlayByRaw.set(raw, tinted);
        if (tinted && tinted !== raw) await preDecodeImage(tinted);
      }),
    );
  }

  const out = [];
  for (const hairedSrc of HAT_OVERLAY_BY_SRC.keys()) {
    const rawOverlay = getHatOverlayForSprite(hairedSrc, gearId);
    if (!rawOverlay) continue;
    const overlaySrc =
      recoloredOverlayByRaw.get(rawOverlay) ||
      resolveHatOverlaySrcSync(rawOverlay, gearId, mawashiColor);
    const bodySrc = getBaldBodySrc(hairedSrc) || hairedSrc;
    for (const tint of TINTS) {
      const base = resolveBodySrc(bodySrc, mawashiColor, bodyColor, tint);
      if (!base) continue;
      await preDecodeImage(base);
      try {
        const url = await compositeHatOntoSprite(base, overlaySrc, underBody);
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
 *
 * @param {boolean} [preserveLinework] - Main-menu hero: restore black /
 *   AA outline pixels after body recolor so tint doesn't leak into eyes.
 */
export async function buildIdlePortraitSrc({
  baseSrc,
  mawashiColor,
  bodyColor,
  gearIds,
  hatOverlay,
  preserveLinework = false,
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
    if (preserveLinework) {
      src = await restoreLineworkFromSource(bodySrc, src);
    }
  }

  const gearId = getEquippedHeadGearId(gearIds);
  // Pose-matched overlay only — never glue the idle hat onto a different
  // body (e.g. main-menu-pumo) or it sits wrong on the topknot.
  const rawOverlay =
    hatOverlay || (gearId ? getHatOverlayForSprite(baseSrc, gearId) : null);
  if (rawOverlay) {
    const overlay = await resolveHatOverlaySrc(
      rawOverlay,
      gearId,
      mawashiColor,
    );
    src = await compositeHatOntoSprite(
      src,
      overlay,
      isHeadGearUnderBody(gearId),
    );
  }

  return src;
}

import { resolveHiRes } from "../config/hiResSprites";
import {
  idbGetBlob,
  idbPutBlob,
  idbFlush,
  idbCount,
  idbClear,
  isPersistentCacheAvailable,
} from "./spriteCacheDB";
import {
  rgbToHsl,
  hslToRgb,
  isColorInHslRange,
  recolorPixel,
  processImageData,
  hexToRgb,
  getHslFromHex,
  getHueSatFromHex,
  BLUE_COLOR_RANGES,
  RED_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  RAINBOW_COLOR,
  FIRE_COLOR,
  VAPORWAVE_COLOR,
  CAMO_COLOR,
  GALAXY_COLOR,
  GOLD_COLOR,
  SPECIAL_COLORS,
} from "./recolorCore";

// Re-export the pure core API so existing importers of SpriteRecolorizer keep
// working unchanged (this module remains the public surface for recolor utils).
export {
  rgbToHsl,
  hslToRgb,
  isColorInHslRange,
  recolorPixel,
  hexToRgb,
  getHslFromHex,
  getHueSatFromHex,
  BLUE_COLOR_RANGES,
  RED_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  RAINBOW_COLOR,
  FIRE_COLOR,
  VAPORWAVE_COLOR,
  CAMO_COLOR,
  GALAXY_COLOR,
  GOLD_COLOR,
  SPECIAL_COLORS,
};

// When enabled, recolorImage() reads/writes the cross-reload IndexedDB blob
// store (see spriteCacheDB) so a color computed in any past session is wrapped
// in a fresh object URL instead of being recomputed. This is what removes the
// per-match "recoloring" wait. Defaults on; flag exists so it can be killed at
// runtime if a persistence issue is ever suspected.
let persistentCacheEnabled = true;

export function setPersistentCacheEnabled(on) {
  persistentCacheEnabled = !!on;
}

// Re-exported so UI (Settings install panel) can query/clear the disk cache
// without importing the DB module directly.
export {
  idbFlush as flushPersistentCache,
  idbCount as getPersistentCacheCount,
  idbClear as clearPersistentCache,
  isPersistentCacheAvailable,
};

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
// Uses Map insertion order for O(1) LRU tracking (delete + re-insert moves to end)
// ============================================
// 2 players × ~25 sprites × 5 tint variants (base, hit, charge, blubber,
// armor) × 2 (body color variants) + headroom for cosmetic re-applies.
// Sized generously — eviction here REVOKES the blob URL, so any GameFighter
// <img> still pointing at that URL goes blank for a frame and the next
// render misses cache + falls back to the un-recolored source (default
// color penguin). Keep this comfortably above expected steady-state usage.
const MAX_CACHE_SIZE = 2000;

// Map preserves insertion order: oldest entries are first, newest are last.
// Accessing an entry deletes and re-inserts it (O(1) move-to-end).
const recoloredImageCache = new Map();

// RACE CONDITION FIX: Deduplicate concurrent recolorImage() calls with the same cache key.
// Without this, preloadSprites() and applyPlayerColor() can race on the same sprites,
// creating DIFFERENT blob URLs for the same cache key. The loser's blob URL gets overwritten
// in the cache, but the winner's blob URL was pre-decoded. GameFighter then gets the
// non-pre-decoded blob URL from the cache → ghost frames on every animation transition.
// With deduplication, concurrent calls share the same Promise and get the same blob URL.
const inFlightRecolors = new Map();

// Blob URLs registered here are never revoked by LRU eviction or cache clears
// (e.g. gyoji outfit images that must survive the player sprite decode cache).
const protectedBlobUrls = new Set();

export function protectBlobUrl(url) {
  if (url && url.startsWith("blob:")) {
    protectedBlobUrls.add(url);
  }
}

export function unprotectBlobUrl(url) {
  if (url) protectedBlobUrls.delete(url);
}

export function clearProtectedBlobUrls() {
  protectedBlobUrls.clear();
}

function mayRevokeBlobUrl(url) {
  return (
    url &&
    url.startsWith("blob:") &&
    !protectedBlobUrls.has(url)
  );
}

function addToCache(key, value) {
  // Delete first so re-insert moves it to the end (most recently used)
  if (recoloredImageCache.has(key)) {
    recoloredImageCache.delete(key);
  }
  recoloredImageCache.set(key, value);

  if (recoloredImageCache.size <= MAX_CACHE_SIZE) return;

  // Evict oldest entries (front of Map iteration order is oldest), but NEVER
  // evict an entry whose blob is PINNED in the decoded cache (the current
  // fighter working set). Those blobs are kept alive regardless (eviction can't
  // revoke them — see the decodedImageCache.has guard below), so dropping their
  // map key only causes getCachedRecoloredImage() to MISS, after which
  // GameFighter falls back to a stale local-state blob that may have already
  // been revoked → a permanently broken <img> (the BASHO "invisible isHit /
  // chargedAttack" bug: a long run recolors a fresh opponent each day, piling
  // up entries that evicted the player's own day-1 tint variants). Keeping
  // pinned mappings means the still-alive pinned blob always resolves.
  // `continue` on pinned mirrors addToDecodedCache(); if only pinned entries
  // remain the loop just ends and the cache may sit slightly over cap (fine —
  // the pinned working set is bounded by pinDecodedImages(replace=true)).
  for (const oldestKey of recoloredImageCache.keys()) {
    if (recoloredImageCache.size <= MAX_CACHE_SIZE) break;
    const evictedUrl = recoloredImageCache.get(oldestKey);
    if (evictedUrl && pinnedDecodedKeys.has(evictedUrl)) continue;
    recoloredImageCache.delete(oldestKey);
    if (evictedUrl && !decodedImageCache.has(evictedUrl) && mayRevokeBlobUrl(evictedUrl)) {
      URL.revokeObjectURL(evictedUrl);
    }
  }
}

function getFromCache(key) {
  if (recoloredImageCache.has(key)) {
    const value = recoloredImageCache.get(key);
    // Move to end (most recently used): delete + re-insert is O(1) on Map
    recoloredImageCache.delete(key);
    recoloredImageCache.set(key, value);
    return value;
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

function isElectron() {
  try {
    return typeof navigator !== "undefined" &&
      navigator.userAgent.includes("Electron");
  } catch (_) {
    return false;
  }
}

function initWorker() {
  if (recolorWorker) return;

  if (isElectron()) {
    console.log("SpriteRecolorizer: Electron detected, using main-thread fallback");
    workerReady = false;
    return;
  }

  try {
    recolorWorker = new Worker(new URL("./recolorWorker.js", import.meta.url), {
      type: "module",
    });

    recolorWorker.onmessage = (e) => {
      const { type, id, payload } = e.data;

      if (type === "recolor_complete") {
        const pending = pendingRequests.get(id);
        if (pending) {
          pending.resolve(payload);
          pendingRequests.delete(id);
        }
      } else if (type === "recolor_error") {
        const pending = pendingRequests.get(id);
        if (pending) {
          pending.reject(new Error(payload.error));
          pendingRequests.delete(id);
        }
      }
    };

    recolorWorker.onerror = (e) => {
      console.error("Worker error:", e);
      pendingRequests.forEach((pending) => {
        pending.reject(new Error("Worker error"));
      });
      pendingRequests.clear();
    };

    workerReady = true;
  } catch (error) {
    console.warn(
      "Web Worker not supported, falling back to main thread:",
      error
    );
    workerReady = false;
  }
}

// Initialize worker immediately (skipped on file:// protocol)
if (typeof window !== "undefined") {
  initWorker();
}

/**
 * Process image data using Web Worker (off main thread)
 */
function processInWorker(
  imageData,
  width,
  height,
  sourceColorRange,
  targetHue,
  targetSat,
  targetLight,
  referenceLightness,
  specialMode,
  hitTintRed = false,
  chargeTintWhite = false,
  blubberTintPurple = false,
  armorTintPink = false,
  bodyColorRange = null,
  bodyTargetHue = 0,
  bodyTargetSat = 0,
  bodyTargetLight = 50,
  bodyReferenceLightness = 49,
  skipMawashiRecolor = false
) {
  return new Promise((resolve, reject) => {
    if (!workerReady || !recolorWorker) {
      reject(new Error("Worker not ready"));
      return;
    }

    const id = ++requestIdCounter;
    pendingRequests.set(id, { resolve, reject });

    // Transfer the buffer to worker (zero-copy)
    const buffer = imageData.data.buffer.slice(0); // Clone buffer for transfer

    recolorWorker.postMessage(
      {
        type: "recolor",
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
          chargeTintWhite,
          blubberTintPurple,
          armorTintPink,
          bodyColorRange,
          bodyTargetHue,
          bodyTargetSat,
          bodyTargetLight,
          bodyReferenceLightness,
          skipMawashiRecolor,
        },
      },
      [buffer]
    );
  });
}

/**
 * Recolor an image by replacing specific color ranges with a target color
 *
 * PERFORMANCE: Uses Web Worker to process pixels off main thread
 * Falls back to main thread processing if worker is unavailable
 *
 * @param {string} imageSrc - Source image URL
 * @param {Object} sourceColorRange - HSL color range to replace (e.g., BLUE_COLOR_RANGES)
 * @param {string} targetColorHex - Target color in hex format (e.g., "#FF69B4" for pink)
 * @param {Object} options - Optional: { hitTintRed: true } to tint non-mawashi/headband pixels red (for isHit state), { chargeTintWhite: true } to tint all pixels white (for charge flash), { blubberTintPurple: true } to tint all pixels with transparent purple (thick blubber)
 * @returns {Promise<string>} - Data URL of the recolored image
 */
export async function recolorImage(
  imageSrc,
  sourceColorRange,
  targetColorHex,
  options = {}
) {
  const hiResSrc = resolveHiRes(imageSrc);
  const hitTintRed = !!options.hitTintRed;
  const chargeTintWhite = !!options.chargeTintWhite;
  const blubberTintPurple = !!options.blubberTintPurple;
  const armorTintPink = !!options.armorTintPink;
  const bodyColorRange = options.bodyColorRange || null;
  const bodyColorHex = options.bodyColorHex || null;
  // Cache key uses the resolved (possibly @2x) URL so lookups are consistent
  const cacheKey = `${hiResSrc}_${sourceColorRange.minHue}-${
    sourceColorRange.maxHue
  }_${targetColorHex}${bodyColorHex ? "_body_" + bodyColorHex : ""}${
    hitTintRed ? "_hit" : ""
  }${chargeTintWhite ? "_charge" : ""}${blubberTintPurple ? "_blubber" : ""}${
    armorTintPink ? "_armor" : ""
  }`;

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
  const specialMode = SPECIAL_COLORS.has(targetColorHex)
    ? targetColorHex
    : null;

  // The expensive path: load → worker/canvas pixel pass → PNG blob → object
  // URL. Unchanged except that it now also writes the blob to the persistent
  // store so future sessions skip this entirely.
  const computeFromPixels = () => new Promise((resolve, reject) => {
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
        const referenceLightness =
          (sourceColorRange.minLightness + sourceColorRange.maxLightness) / 2;

        // Body color HSL (if customizing body)
        let bodyTargetHue = 0,
          bodyTargetSat = 0,
          bodyTargetLight = 50,
          bodyRefLight = 49;
        if (bodyColorRange && bodyColorHex) {
          const bodyHsl = getHslFromHex(bodyColorHex);
          bodyTargetHue = bodyHsl.h;
          bodyTargetSat = bodyHsl.s;
          bodyTargetLight = bodyHsl.l;
          bodyRefLight =
            (bodyColorRange.minLightness + bodyColorRange.maxLightness) / 2;
        }

        // When mawashi target matches the sprite base color, skip mawashi recoloring
        // to avoid HSL round-trip artifacts that shift the belt shade
        const skipMawashiRecolor =
          !specialMode && !hitTintRed && targetColorHex === SPRITE_BASE_COLOR;

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
              hitTintRed,
              chargeTintWhite,
              blubberTintPurple,
              armorTintPink,
              bodyColorRange,
              bodyTargetHue,
              bodyTargetSat,
              bodyTargetLight,
              bodyRefLight,
              skipMawashiRecolor
            );

            // Create ImageData from returned buffer
            processedData = new ImageData(
              new Uint8ClampedArray(result.imageData),
              result.width,
              result.height
            );
          } catch (workerError) {
            console.warn(
              "Worker processing failed, falling back to main thread:",
              workerError
            );
            processedData = processImageData(
              imageData,
              sourceColorRange,
              targetHue,
              targetSat,
              targetLight,
              referenceLightness,
              specialMode,
              hitTintRed,
              canvas.width,
              canvas.height,
              chargeTintWhite,
              blubberTintPurple,
              armorTintPink,
              bodyColorRange,
              bodyTargetHue,
              bodyTargetSat,
              bodyTargetLight,
              bodyRefLight,
              skipMawashiRecolor
            );
          }
        } else {
          processedData = processImageData(
            imageData,
            sourceColorRange,
            targetHue,
            targetSat,
            targetLight,
            referenceLightness,
            specialMode,
            hitTintRed,
            canvas.width,
            canvas.height,
            chargeTintWhite,
            blubberTintPurple,
            armorTintPink,
            bodyColorRange,
            bodyTargetHue,
            bodyTargetSat,
            bodyTargetLight,
            bodyRefLight,
            skipMawashiRecolor
          );
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

        // Persist the recolored bytes so this exact color never has to be
        // recomputed in a future session. Fire-and-forget: the object URL
        // above doesn't consume the blob, and we must not block the recolor
        // on a disk write.
        if (persistentCacheEnabled) {
          idbPutBlob(cacheKey, blob);
        }

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

    img.src = hiResSrc;
  });

  // The resolved result: try the persistent store FIRST (cheap object-URL wrap
  // of previously computed bytes), and only fall back to the expensive pixel
  // pass on a miss. Wrapping both in one promise keeps the in-flight dedup
  // (and the GameFighter sync cache) working exactly as before.
  const promise = (async () => {
    if (persistentCacheEnabled) {
      try {
        const storedBlob = await idbGetBlob(cacheKey);
        if (storedBlob) {
          const url = URL.createObjectURL(storedBlob);
          addToCache(cacheKey, url);
          return url;
        }
      } catch (_) {
        // fall through to recompute
      }
    }
    return computeFromPixels();
  })();

  // Register the in-flight Promise; clean up when settled (success or failure)
  inFlightRecolors.set(cacheKey, promise);
  promise.then(
    () => inFlightRecolors.delete(cacheKey),
    () => inFlightRecolors.delete(cacheKey)
  );

  return promise;
}

/**
 * Batch recolor multiple images
 *
 * @param {Array<string>} imageSrcs - Array of image source URLs
 * @param {Object} sourceColorRange - HSL color range to replace
 * @param {string} targetColorHex - Target color in hex
 * @returns {Promise<Map<string, string>>} - Map of original src to recolored data URL
 */
export async function recolorImages(
  imageSrcs,
  sourceColorRange,
  targetColorHex
) {
  const results = new Map();

  await Promise.all(
    imageSrcs.map(async (src) => {
      try {
        const recolored = await recolorImage(
          src,
          sourceColorRange,
          targetColorHex
        );
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
    if (mayRevokeBlobUrl(url)) {
      URL.revokeObjectURL(url);
    }
  }
  recoloredImageCache.clear();
  inFlightRecolors.clear();
}

// ============================================
// PERSISTENT IMAGE CACHE with LRU eviction
// Keep decoded images in memory to prevent GC and re-decode
// Uses Map insertion order for O(1) LRU tracking
// ============================================
// GHOST FRAME FIX (progressive / "after-N-rematches" variant):
// This cache keeps decoded <img> elements alive in a hidden DOM container so the
// browser holds their decoded bitmap, and a GameFighter pose-change <img> remount
// can paint instantly instead of decoding from scratch (the one-frame blank =
// "ghost"). The earlier 350/500 sizing was BORDERLINE: the real fighter working
// set (both players × every pose × 5 tint variants × body variants, PLUS the
// original file URLs pre-decoded in step 4 of preloadSprites) already lands near
// ~500. This cache is insertion-ordered with NO touch-on-access, so short-lived
// between-round decodes (gyoji outfits each rematch, ritual sprites) kept getting
// appended and slowly evicted the in-use fighter sprites. After enough rematches
// the fighters were fully pushed out → every animation transition went cold →
// CONSTANT ghost frames. Two-part fix: (1) PIN the fighter working set so it's
// never evicted (see pinnedDecodedKeys / pinDecodedImages, called after preload),
// and (2) raise the cap so the pinned set + between-round churn both fit with
// headroom. The cap now only bounds the NON-pinned (gyoji/ritual) churn.
const MAX_DECODED_CACHE_SIZE = 800;
const decodedImageCache = new Map();
// Sources pinned here are never evicted from decodedImageCache — their hidden
// decoded <img> stays in the DOM for the whole session. This is the fighter
// working set (set via pinDecodedImages after preloadSprites).
const pinnedDecodedKeys = new Set();
let hiddenImageContainer = null;

function getHiddenContainer() {
  if (!hiddenImageContainer && typeof document !== "undefined") {
    hiddenImageContainer = document.createElement("div");
    hiddenImageContainer.id = "sprite-preload-cache";
    hiddenImageContainer.style.cssText =
      "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px;";
    document.body.appendChild(hiddenImageContainer);
  }
  return hiddenImageContainer;
}

function addToDecodedCache(key, img) {
  // Delete first so re-insert moves it to the end (most recently used)
  if (decodedImageCache.has(key)) {
    decodedImageCache.delete(key);
  }
  decodedImageCache.set(key, img);

  if (decodedImageCache.size <= MAX_DECODED_CACHE_SIZE) return;

  // Evict oldest NON-PINNED entries first (front of Map iteration order is
  // oldest). Pinned entries (the fighter working set) are skipped so their
  // decoded <img> never leaves the DOM — that's what prevents the progressive
  // ghost-frame regression. Deleting the just-yielded key during for..of over
  // a Map is spec-safe. If only pinned entries remain the loop simply ends
  // (the cache may then hold slightly more than the cap — pinned content is
  // always retained by design).
  for (const oldestKey of decodedImageCache.keys()) {
    if (decodedImageCache.size <= MAX_DECODED_CACHE_SIZE) break;
    if (pinnedDecodedKeys.has(oldestKey)) continue;
    const oldImg = decodedImageCache.get(oldestKey);
    if (oldImg && oldImg.parentNode) {
      oldImg.parentNode.removeChild(oldImg);
    }
    decodedImageCache.delete(oldestKey);
  }
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
      img
        .decode()
        .then(onComplete)
        .catch((err) => {
          console.warn("Image decode warning:", err);
          onComplete(); // Still add to cache on failure
        });
    } else {
      img.onload = onComplete;
      img.onerror = () => {
        console.warn("Image load warning:", imageSrc);
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
  if (!url || (!url.startsWith("data:") && !url.startsWith("blob:"))) return;
  return preDecodeImage(url);
}

/**
 * Pre-decode multiple images in parallel
 * @param {string[]} imageSrcs - Array of image sources to decode
 * @returns {Promise<void>} - Resolves when all images are decoded
 */
export async function preDecodeImages(imageSrcs) {
  // Filter out already cached images
  const uncached = imageSrcs.filter(
    (src) => src && !decodedImageCache.has(src)
  );
  await Promise.all(uncached.map((src) => preDecodeImage(src)));
}

/**
 * Pin a set of image sources so they are NEVER evicted from the decoded cache
 * (their hidden decoded <img> stays in the DOM for the whole session). This is
 * the fighter working set — pinning it means GameFighter pose-change <img>
 * remounts never re-decode, so there are no ghost frames and no mid-combat
 * decode spikes, regardless of how many rematches/rounds have elapsed.
 *
 * Pass replace=true to swap the pinned set wholesale (e.g. once colors are final
 * for a match) so stale blob URLs from earlier color choices are released back
 * to normal LRU and the pin set can't grow unbounded across color changes.
 *
 * @param {string[]} srcs - Image sources (blob/data/file URLs) to pin + decode.
 * @param {boolean} [replace=false] - Replace the existing pinned set.
 */
export async function pinDecodedImages(srcs, replace = false) {
  if (!Array.isArray(srcs)) return;
  if (replace) pinnedDecodedKeys.clear();
  const toDecode = [];
  for (const src of srcs) {
    if (!src) continue;
    pinnedDecodedKeys.add(src);
    if (!decodedImageCache.has(src)) toDecode.push(src);
  }
  if (toDecode.length) await preDecodeImages(toDecode);
}

/**
 * Force the browser to RE-DECODE the pinned fighter sprites.
 *
 * Even though pinned sprites stay in the DOM, the browser/Electron can purge
 * their decoded bitmap after long idle (e.g. AFK on a menu, or the tab/window
 * losing focus). Because the pinned <img> elements live in a hidden,
 * never-painted container, the browser never re-decodes them on its own — so
 * they silently go cold and every pose transition ghosts again on the next
 * round. Calling img.decode() forces the bitmap back into memory. Cheap to run
 * (decode work is off the main thread) and meant to be called during a rematch /
 * pre-round window so sprites are hot before play resumes. Batched to avoid a
 * decode thundering-herd.
 */
export async function rewarmDecodedImages() {
  const pins = [...pinnedDecodedKeys];
  if (!pins.length) return;
  const container = getHiddenContainer();
  const BATCH = 12;
  for (let i = 0; i < pins.length; i += BATCH) {
    const batch = pins.slice(i, i + BATCH);
    await Promise.all(
      batch.map(
        (src) =>
          new Promise((resolve) => {
            // CRITICAL: use a FRESH Image, not the cached one. Calling
            // .decode() on the already-cached <img> is a NO-OP after an idle
            // bitmap purge — the element still reports complete/naturalWidth,
            // so the browser resolves immediately WITHOUT re-uploading the
            // decoded bitmap, and the next paint still decodes cold (= the
            // ghost returns after AFK). A brand-new Image has never been
            // decoded, so .decode() genuinely re-decodes and the freshly
            // decoded element is what we keep referenced in the DOM.
            const img = new Image();
            img.src = src;
            const done = () => {
              const old = decodedImageCache.get(src);
              if (old && old !== img && old.parentNode) {
                old.parentNode.removeChild(old);
              }
              if (container && img.parentNode !== container) {
                container.appendChild(img);
              }
              decodedImageCache.set(src, img);
              resolve();
            };
            if (img.decode) {
              img.decode().then(done).catch(done);
            } else {
              img.onload = done;
              img.onerror = done;
            }
          })
      )
    );
  }
}

/**
 * Clear the decoded image cache (for memory management)
 */
export function clearDecodedImageCache() {
  // Revoke blob URLs from cached images to free browser-held blob data
  for (const img of decodedImageCache.values()) {
    if (img && img.src && mayRevokeBlobUrl(img.src)) {
      URL.revokeObjectURL(img.src);
    }
  }
  if (hiddenImageContainer) {
    hiddenImageContainer.innerHTML = "";
  }
  decodedImageCache.clear();
  pinnedDecodedKeys.clear();
}

/**
 * Get a recolored image from cache synchronously (if it exists)
 * This allows checking the cache before triggering async recoloring
 *
 * @param {string} imageSrc - Original image source
 * @param {Object} sourceColorRange - HSL color range to detect
 * @param {string} targetColorHex - Target color in hex format
 * @param {Object} options - Optional: { hitTintRed: true }, { chargeTintWhite: true }, { blubberTintPurple: true }, { armorTintPink: true }
 * @returns {string|null} - Cached recolored image data URL, or null if not cached
 */
export function getCachedRecoloredImage(
  imageSrc,
  sourceColorRange,
  targetColorHex,
  options = {}
) {
  const hitTintRed = !!options.hitTintRed;
  const chargeTintWhite = !!options.chargeTintWhite;
  const blubberTintPurple = !!options.blubberTintPurple;
  const armorTintPink = !!options.armorTintPink;
  const bodyColorHex = options.bodyColorHex || null;
  // Match recolorImage()'s key construction exactly — both sides MUST use
  // resolveHiRes() so callers passing a 1x URL still hit entries inserted
  // under a @2x URL (and vice versa). Asymmetry here means systematic
  // cache misses → raw blue sprite for any path that happens to query the
  // 1x URL while preload populated the cache with the @2x key.
  const hiResSrc = resolveHiRes(imageSrc);
  const cacheKey = `${hiResSrc}_${sourceColorRange.minHue}-${
    sourceColorRange.maxHue
  }_${targetColorHex}${bodyColorHex ? "_body_" + bodyColorHex : ""}${
    hitTintRed ? "_hit" : ""
  }${chargeTintWhite ? "_charge" : ""}${blubberTintPurple ? "_blubber" : ""}${
    armorTintPink ? "_armor" : ""
  }`;
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
    inFlightCount: inFlightRecolors.size,
  };
}

/**
 * Predefined color options for player customization
 */
export const COLOR_PRESETS = {
  graphite: "#525252",
  cobalt: "#3B5EB0",
  orchid: "#A85DBF",
  emerald: "#2E9E5A",
  teal: "#1A7A8A",
  tangerine: "#E8913A",
  coral: "#E87070",
  gold: "#D4A520",
  caramel: "#A07348",
  pewter: "#6E8495",
  powder: "#88C4D8",
  scarlet: "#D94848",

  // Special (mawashi-only patterns)
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
  GREY_BODY_RANGES,
  COLOR_PRESETS,
  SPECIAL_COLORS,
  RAINBOW_COLOR,
  FIRE_COLOR,
  VAPORWAVE_COLOR,
  CAMO_COLOR,
  GALAXY_COLOR,
  GOLD_COLOR,
};

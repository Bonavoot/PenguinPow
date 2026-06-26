/**
 * spriteCacheDB — persistent (cross-reload) store for recolored sprite blobs.
 *
 * THE PROBLEM IT SOLVES:
 * Recoloring a sprite (canvas pixel pass in a Web Worker → PNG blob) is the
 * expensive part of "loading colors". The result was only ever held in a
 * module-level in-memory cache (see SpriteRecolorizer), so it was thrown away
 * on every page reload — and every new opponent color recomputed from scratch.
 * That's the per-match wait.
 *
 * THE FIX:
 * Persist the recolored PNG *bytes* (a Blob) in IndexedDB, keyed by the exact
 * same recolor cache key (source URL + color ranges + target color + body +
 * tint variant). On a later session we wrap the stored bytes in a fresh object
 * URL — skipping ALL pixel work — so any color computed once stays instant
 * forever.
 *
 * INVALIDATION:
 * - Asset edits invalidate automatically: production builds embed a content
 *   hash in the source URL, which is part of the key.
 * - Recolor-ALGORITHM changes don't change the source URL, so bump
 *   SPRITE_CACHE_VERSION to orphan every old entry (and offer a manual clear).
 *
 * All ops fail soft: if IndexedDB is unavailable or errors, we silently behave
 * as if there were no persistent cache (the in-memory path still works).
 */

const DB_NAME = "pumo-sprite-cache";
const DB_VERSION = 1;
const STORE = "recolors";

// Bump this to invalidate ALL persisted recolors after a recolor-algorithm
// change. (Asset content changes invalidate automatically via the hashed
// source URL baked into each key.)
export const SPRITE_CACHE_VERSION = "v1";

let available =
  typeof indexedDB !== "undefined" && indexedDB !== null;
let dbPromise = null;

function openDB() {
  if (!available) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (_) {
      available = false;
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      available = false;
      resolve(null);
    };
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

// Namespace the on-disk key with the schema version so an algorithm bump
// orphans (rather than collides with) the previous generation of blobs.
function diskKey(cacheKey) {
  return `${SPRITE_CACHE_VERSION}:${cacheKey}`;
}

/**
 * Look up a previously persisted recolored PNG blob. Returns the Blob (so the
 * caller can mint a fresh object URL) or null on miss / unavailable.
 */
export async function idbGetBlob(cacheKey) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(diskKey(cacheKey));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

// Outstanding writes, so an install routine can await durability via idbFlush()
// without the hot recolor path ever having to block on disk.
const pendingWrites = new Set();

/**
 * Persist a recolored PNG blob (fire-and-forget — the returned promise is for
 * idbFlush() bookkeeping only; callers on the hot path should NOT await it).
 */
export function idbPutBlob(cacheKey, blob) {
  if (!available || !blob) return Promise.resolve();
  const p = (async () => {
    const db = await openDB();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(blob, diskKey(cacheKey));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  })();
  pendingWrites.add(p);
  p.finally(() => pendingWrites.delete(p));
  return p;
}

/** Resolve once all in-flight persistent writes have committed. */
export async function idbFlush() {
  await Promise.all([...pendingWrites]);
}

/** Number of persisted recolor entries (best-effort; 0 if unavailable). */
export async function idbCount() {
  const db = await openDB();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    } catch (_) {
      resolve(0);
    }
  });
}

/** Wipe the whole persistent recolor store. */
export async function idbClear() {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

export function isPersistentCacheAvailable() {
  return available;
}

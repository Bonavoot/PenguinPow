/**
 * Visibility-safe logical asset readiness.
 *
 * Must NOT depend on requestAnimationFrame — hidden tabs pause/throttle rAF,
 * which previously deadlocked preloadSprites Step 6.
 */

/**
 * Yield without requiring a painted frame. Works while the document is hidden.
 * @param {number} ms
 */
export function yieldHiddenSafe(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until every src is present in a sync decoded lookup, or timeout.
 *
 * @param {string[]} srcs
 * @param {(src: string) => (HTMLImageElement|null)} getDecoded
 * @param {{ timeoutMs?: number, pollMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, ms: number, missing: string[] }>}
 */
export async function awaitDecodedReadiness(srcs, getDecoded, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 2000;
  const pollMs = opts.pollMs ?? 16;
  const needed = [...new Set((srcs || []).filter(Boolean))];
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const missingOf = () =>
    needed.filter((src) => {
      const img = getDecoded(src);
      return !(img && img.complete && img.naturalWidth > 0);
    });

  let missing = missingOf();
  if (!missing.length) {
    return { ok: true, ms: 0, missing: [] };
  }

  while (
    ((typeof performance !== "undefined" ? performance.now() : Date.now()) -
      t0) <
    timeoutMs
  ) {
    await yieldHiddenSafe(pollMs);
    missing = missingOf();
    if (!missing.length) {
      const ms =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        t0;
      return { ok: true, ms, missing: [] };
    }
  }

  const ms =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { ok: false, ms, missing };
}

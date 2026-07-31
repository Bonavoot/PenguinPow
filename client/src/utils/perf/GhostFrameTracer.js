/**
 * Phase 0 — Ghost-frame diagnostic tracer.
 *
 * Records pose/cosmetic tuples vs displayed URL identity, and classifies
 * which asset path produced the visible fighter source.
 *
 * Enable via PerfRecorder (?perf=1). No gameplay changes.
 */

import { getPerfRecorder } from "./PerfRecorder";

let seq = 0;
const recent = [];
const MAX_RECENT = 300;
const lastTupleKeyByFighter = new Map();

/**
 * @typedef {Object} FighterPresentTuple
 * @property {string} fighterId
 * @property {string|null} requestedPoseSrc  original/effective pose identity
 * @property {string|null} bodySrc           body used for composite (bald/haired)
 * @property {string|null} displayedSrc      final <img> src
 * @property {string|null} mawashiColor
 * @property {string|null} bodyColor
 * @property {string|null} topperId
 * @property {string|null} tint
 * @property {boolean|null} underBody
 * @property {string} path
 *   baked | cachedRecolor | runtimeRecolor | cachedTopper | syncTopper |
 *   asyncTopper | fallbackBody | unknown
 * @property {string|null} cacheKey
 * @property {boolean} [decodePending]
 */

export function classifyUrlKind(url) {
  if (!url) return "none";
  if (url.startsWith("data:")) return "dataUrl";
  if (url.startsWith("blob:")) return "blobUrl";
  if (url.includes("/baked/") || url.includes("baked")) return "bakedFile";
  return "fileUrl";
}

/**
 * Record one presented fighter frame/tuple.
 * Detects obvious ghosts: equipped topper but displayed path is fallbackBody,
 * or displayed src identity does not match the requested pose stem when both
 * are file URLs with extractable stems.
 */
export function recordFighterPresent(tuple) {
  const perf = getPerfRecorder();
  if (!perf.enabled) return null;

  // Deduplicate identical consecutive presents per fighter (render spam).
  const dedupeKey = [
    tuple.requestedPoseSrc,
    tuple.displayedSrc,
    tuple.topperId,
    tuple.mawashiColor,
    tuple.bodyColor,
    tuple.path,
    tuple.underBody ? "u" : "o",
  ].join("|");
  const fighterKey = String(tuple.fighterId ?? "unknown");
  if (lastTupleKeyByFighter.get(fighterKey) === dedupeKey) {
    return null;
  }
  lastTupleKeyByFighter.set(fighterKey, dedupeKey);

  seq += 1;
  const entry = {
    seq,
    t: performance.now(),
    urlKind: classifyUrlKind(tuple.displayedSrc),
    ...tuple,
  };

  // Ghost heuristics
  const ghosts = [];
  if (tuple.topperId && tuple.path === "fallbackBody") {
    ghosts.push("equipped_topper_fallback_body");
    perf.count("hat.fallbackBald");
  }
  if (tuple.decodePending) {
    ghosts.push("decode_pending_on_display");
  }
  if (
    tuple.requestedPoseSrc &&
    tuple.displayedSrc &&
    tuple.path === "fallbackBody" &&
    tuple.topperId
  ) {
    ghosts.push("bald_or_unhatted_while_equipped");
  }
  if (
    tuple.cacheKey &&
    tuple.hattedPairKey &&
    tuple.cacheKey !== tuple.hattedPairKey
  ) {
    ghosts.push("stale_hatted_pair_key");
  }

  entry.ghosts = ghosts;
  if (ghosts.length) {
    perf.count("ghost.mismatch", ghosts.length);
    for (const g of ghosts) perf.count(`ghost.${g}`);
    perf.mark("ghost", entry);
  } else {
    perf.count("ghost.ok");
  }

  perf.mark("fighter.present", {
    seq,
    fighterId: tuple.fighterId,
    path: tuple.path,
    topperId: tuple.topperId,
    tint: tuple.tint,
    urlKind: entry.urlKind,
    ghosts,
  });

  recent.push(entry);
  if (recent.length > MAX_RECENT) recent.shift();
  return entry;
}

export function recordHatPath(kind, meta = {}) {
  const perf = getPerfRecorder();
  if (!perf.enabled) return;
  perf.count(`hat.${kind}`);
  perf.mark("hat.path", { kind, ...meta });
}

export function getRecentGhostTraces(limit = 50) {
  return recent.slice(-limit);
}

export function getGhostSummary() {
  const ghosts = recent.filter((r) => r.ghosts?.length);
  return {
    samples: recent.length,
    ghostFrames: ghosts.length,
    last: recent[recent.length - 1] || null,
    recentGhosts: ghosts.slice(-20),
  };
}

if (typeof window !== "undefined") {
  window.__PUMO_GHOST = {
    recent: getRecentGhostTraces,
    summary: getGhostSummary,
  };
}

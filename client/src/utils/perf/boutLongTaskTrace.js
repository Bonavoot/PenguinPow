/**
 * Dev-only long-task recorder for the opening 15 s of a bout.
 *
 * Enabled when `localStorage.pumo_perf_trace === "1"` or `import.meta.env.DEV`.
 * Logs tasks > 50 ms with a timestamp relative to `game_start`.
 * Ring buffer: `window.__PUMO_PERF()`.
 */

const RING = 128;
const WINDOW_MS = 15000;
const THRESHOLD_MS = 50;

const ring = [];
let gameStartAt = null;
let observer = null;
let installed = false;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isEnabled() {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("pumo_perf_trace") === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    return !!(import.meta && import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
}

function record(entry) {
  ring.push(entry);
  if (ring.length > RING) ring.shift();
}

export function dumpBoutLongTasks() {
  return {
    gameStartAt,
    now: nowMs(),
    longTasks: ring.slice(),
  };
}

export function markBoutGameStart() {
  gameStartAt = nowMs();
  record({ kind: "game_start", t: 0, duration: 0, at: gameStartAt });
}

export function installBoutLongTaskTrace() {
  if (installed || !isEnabled()) return;
  installed = true;
  if (typeof PerformanceObserver === "undefined") return;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < THRESHOLD_MS) continue;
        const rel =
          gameStartAt == null ? null : entry.startTime - gameStartAt;
        if (gameStartAt != null && (rel < 0 || rel > WINDOW_MS)) continue;
        const row = {
          kind: "longtask",
          t: rel,
          duration: entry.duration,
          name: entry.name,
          at: entry.startTime,
        };
        record(row);
        console.info(
          `[perf] longtask ${entry.duration.toFixed(1)}ms` +
            (rel == null ? " (before game_start)" : ` @ ${rel.toFixed(0)}ms after game_start`)
        );
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    observer = null;
  }

  if (typeof window === "undefined") return;
  const prev = window.__PUMO_PERF;
  const fn = function __PUMO_PERF() {
    return dumpBoutLongTasks();
  };
  if (prev && typeof prev === "object") {
    Object.defineProperty(fn, "enabled", {
      get: () => !!prev.enabled,
    });
    fn.dump = (...args) => (typeof prev.dump === "function" ? prev.dump(...args) : dumpBoutLongTasks());
    fn.mark = (...args) => (typeof prev.mark === "function" ? prev.mark(...args) : undefined);
    fn.count = (...args) => (typeof prev.count === "function" ? prev.count(...args) : undefined);
    fn.recorder = prev;
  }
  window.__PUMO_PERF = fn;
}

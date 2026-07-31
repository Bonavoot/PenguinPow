/**
 * Phase 0 — Development / opt-in performance recorder.
 *
 * Enable with:
 *   - URL ?perf=1
 *   - localStorage.setItem("pumo_perf", "1")
 *   - window.__PUMO_PERF_ENABLE()
 *
 * Does not alter gameplay. Recording is no-op when disabled.
 */

const LS_KEY = "pumo_perf";
const MAX_FRAME_SAMPLES = 7200; // ~2 min @ 60fps
const MAX_EVENTS = 4000;
const MAX_LONG_TASKS = 500;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

function isEnabled() {
  try {
    if (typeof window === "undefined") return false;
    if (window.__PUMO_PERF_FORCE__) return true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("perf") === "1" || q.get("perf") === "true") return true;
    if (localStorage.getItem(LS_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

class PerfRecorder {
  constructor() {
    this.enabled = false;
    this.startedAt = 0;
    this.frameDurations = [];
    this.events = [];
    this.longTasks = [];
    this.counters = Object.create(null);
    this.gauges = Object.create(null);
    this._rafId = null;
    this._lastFrame = 0;
    this._ltObserver = null;
    this._visibilityHandler = null;
    this._overlay = null;
    this._overlayTimer = null;
    this._rafCallbackMarks = [];
    this.scenarioId = null;
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.startedAt = now();
    this._installFrameLoop();
    this._installLongTaskObserver();
    this._installVisibilityHooks();
    this._exposeGlobal();
    this.mark("recorder.enabled", {
      href: typeof location !== "undefined" ? location.href : "",
      visibility: typeof document !== "undefined" ? document.visibilityState : "n/a",
    });
  }

  disable() {
    this.enabled = false;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._ltObserver) {
      try {
        this._ltObserver.disconnect();
      } catch {
        /* ignore */
      }
      this._ltObserver = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      window.removeEventListener("focus", this._visibilityHandler);
      window.removeEventListener("blur", this._visibilityHandler);
      this._visibilityHandler = null;
    }
    this.hideOverlay();
  }

  setScenario(id) {
    this.scenarioId = id;
    this.mark("scenario.set", { id });
  }

  mark(type, data = {}) {
    if (!this.enabled) return;
    const entry = { t: now(), type, ...data };
    this.events.push(entry);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  count(name, delta = 1) {
    if (!this.enabled) return;
    this.counters[name] = (this.counters[name] || 0) + delta;
  }

  gauge(name, value) {
    if (!this.enabled) return;
    this.gauges[name] = value;
  }

  /**
   * Time a synchronous section (e.g. toDataURL).
   */
  timeSync(name, fn, meta = {}) {
    if (!this.enabled) return fn();
    const t0 = now();
    try {
      return fn();
    } finally {
      const ms = now() - t0;
      this.mark("timing", { name, ms, ...meta });
      this.count(`${name}.calls`);
      this.gauge(`${name}.lastMs`, ms);
      if (ms > 8) this.count(`${name}.gt8ms`);
      if (ms > 16.67) this.count(`${name}.gtFrame`);
    }
  }

  async timeAsync(name, promiseOrFn, meta = {}) {
    if (!this.enabled) {
      return typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
    }
    const t0 = now();
    try {
      const result =
        typeof promiseOrFn === "function" ? await promiseOrFn() : await promiseOrFn;
      return result;
    } finally {
      const ms = now() - t0;
      this.mark("timing", { name, ms, ...meta });
      this.count(`${name}.calls`);
      this.gauge(`${name}.lastMs`, ms);
    }
  }

  beginRafCallback(label) {
    if (!this.enabled) return null;
    const token = { label, t0: now() };
    this._rafCallbackMarks.push(token);
    return token;
  }

  endRafCallback(token) {
    if (!this.enabled || !token) return;
    const ms = now() - token.t0;
    this.count("raf.callbacks");
    this.gauge("raf.lastCallbackMs", ms);
    if (ms > 8) this.count("raf.callbackGt8ms");
    this.mark("raf.callback", { label: token.label, ms });
  }

  _installFrameLoop() {
    this._lastFrame = now();
    const tick = (ts) => {
      if (!this.enabled) return;
      const dt = ts - this._lastFrame;
      this._lastFrame = ts;
      if (dt > 0 && dt < 1000) {
        this.frameDurations.push(dt);
        if (this.frameDurations.length > MAX_FRAME_SAMPLES) {
          this.frameDurations.splice(
            0,
            this.frameDurations.length - MAX_FRAME_SAMPLES,
          );
        }
        if (dt > 20) this.count("frame.late");
        if (dt > 33) this.count("frame.droppedish");
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _installLongTaskObserver() {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      this._ltObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const item = {
            t: now(),
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
          };
          this.longTasks.push(item);
          if (this.longTasks.length > MAX_LONG_TASKS) {
            this.longTasks.splice(0, this.longTasks.length - MAX_LONG_TASKS);
          }
          this.count("longTasks");
          if (entry.duration > 50) this.count("longTasks.gt50");
          this.mark("longtask", item);
        }
      });
      this._ltObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      this._ltObserver = null;
    }
  }

  _installVisibilityHooks() {
    this._visibilityHandler = (e) => {
      this.mark("lifecycle", {
        event: e.type,
        visibility:
          typeof document !== "undefined" ? document.visibilityState : "n/a",
        hidden: typeof document !== "undefined" ? document.hidden : null,
      });
    };
    document.addEventListener("visibilitychange", this._visibilityHandler);
    window.addEventListener("focus", this._visibilityHandler);
    window.addEventListener("blur", this._visibilityHandler);
  }

  _exposeGlobal() {
    if (typeof window === "undefined") return;
    window.__PUMO_PERF = this;
    window.__PUMO_PERF_ENABLE = () => {
      try {
        localStorage.setItem(LS_KEY, "1");
      } catch {
        /* ignore */
      }
      this.enable();
      return this;
    };
    window.__PUMO_PERF_DISABLE = () => {
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
      this.disable();
    };
  }

  frameStats() {
    const sorted = [...this.frameDurations].sort((a, b) => a - b);
    const sum = sorted.reduce((s, x) => s + x, 0);
    return {
      samples: sorted.length,
      avg: sorted.length ? sum / sorted.length : null,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted.length ? sorted[sorted.length - 1] : null,
      late: this.counters["frame.late"] || 0,
      droppedish: this.counters["frame.droppedish"] || 0,
    };
  }

  heap() {
    const mem = performance?.memory;
    if (!mem) return null;
    return {
      usedMB: +(mem.usedJSHeapSize / 1024 / 1024).toFixed(2),
      totalMB: +(mem.totalJSHeapSize / 1024 / 1024).toFixed(2),
      limitMB: +(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0),
    };
  }

  snapshot() {
    return {
      enabled: this.enabled,
      scenarioId: this.scenarioId,
      uptimeMs: this.enabled ? now() - this.startedAt : 0,
      frames: this.frameStats(),
      counters: { ...this.counters },
      gauges: { ...this.gauges },
      heap: this.heap(),
      longTaskCount: this.longTasks.length,
      recentLongTasks: this.longTasks.slice(-20),
      recentEvents: this.events.slice(-50),
      visibility:
        typeof document !== "undefined" ? document.visibilityState : "n/a",
    };
  }

  dump() {
    const full = {
      ...this.snapshot(),
      events: this.events,
      longTasks: this.longTasks,
      frameDurations: this.frameDurations,
    };
    console.log("[PUMO_PERF] dump", full);
    return full;
  }

  showOverlay() {
    if (typeof document === "undefined") return;
    if (!this._overlay) {
      this._overlay = document.createElement("div");
      this._overlay.id = "pumo-perf-overlay";
      this._overlay.style.cssText =
        "position:fixed;left:10px;bottom:10px;z-index:99999;pointer-events:none;" +
        "font:11px/1.35 monospace;color:#9f6;background:rgba(0,0,0,.82);" +
        "padding:8px 10px;border-radius:4px;max-width:340px;white-space:pre;";
      document.body.appendChild(this._overlay);
    }
    this._overlay.style.display = "block";
    if (!this._overlayTimer) {
      this._overlayTimer = setInterval(() => this._paintOverlay(), 500);
    }
    this._paintOverlay();
  }

  hideOverlay() {
    if (this._overlayTimer) {
      clearInterval(this._overlayTimer);
      this._overlayTimer = null;
    }
    if (this._overlay) this._overlay.style.display = "none";
  }

  toggleOverlay() {
    if (this._overlay?.style.display === "block") this.hideOverlay();
    else this.showOverlay();
  }

  _paintOverlay() {
    if (!this._overlay || !this.enabled) return;
    const s = this.snapshot();
    const f = s.frames;
    const lines = [
      "PUMO PERF (Ctrl+Shift+P)  __PUMO_PERF.dump()",
      s.scenarioId ? `scenario: ${s.scenarioId}` : "scenario: (none)",
      `frame ms  p50=${fmt(f.p50)} p95=${fmt(f.p95)} p99=${fmt(f.p99)} max=${fmt(f.max)}`,
      `late(>20)=${f.late}  dropish(>33)=${f.droppedish}  samples=${f.samples}`,
      s.heap
        ? `heap ${s.heap.usedMB}/${s.heap.limitMB} MB`
        : "heap n/a",
      `longTasks ${s.longTaskCount} (>50: ${s.counters["longTasks.gt50"] || 0})`,
      `ghost ${s.counters["ghost.mismatch"] || 0}  syncComp ${s.counters["hat.syncComposite"] || 0}`,
      `toDataURL ${s.counters["hat.toDataURL.calls"] || 0}  fallbackBald ${s.counters["hat.fallbackBald"] || 0}`,
      `rewarm ${s.counters["rewarm.calls"] || 0} overlap ${s.counters["rewarm.overlap"] || 0}`,
      `preload step6 ${fmt(s.gauges["preload.step6Ms"])}ms hiddenBarrier=${s.counters["preload.step6WhileHidden"] || 0}`,
      `vis=${s.visibility}`,
    ];
    this._overlay.textContent = lines.join("\n");
  }
}

function fmt(n) {
  return n == null || Number.isNaN(n) ? "-" : Number(n).toFixed(1);
}

const recorder = new PerfRecorder();

export function getPerfRecorder() {
  return recorder;
}

export function ensurePerfRecorder() {
  if (isEnabled()) recorder.enable();
  return recorder;
}

export function setupPerfShortcut() {
  const handler = (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      ensurePerfRecorder().enable();
      recorder.toggleOverlay();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

export default recorder;

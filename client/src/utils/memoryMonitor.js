/**
 * Memory Monitor - Automated diagnostics for memory leak debugging
 * Logs to console every 30s and shows optional overlay (Ctrl+Shift+M to toggle)
 * Run window.__PENGUIN_DEBUG() in console for instant snapshot
 */

import { getCacheStats } from "./SpriteRecolorizer";

const LOG_INTERVAL_MS = 30000; // Log every 30 seconds
const MB = 1024 * 1024;

let logIntervalId = null;
let overlayIntervalId = null;
let overlayElement = null;
let overlayVisible = false;

function getMemorySnapshot() {
  const snapshot = {
    timestamp: new Date().toISOString(),
    heap: null,
    domNodes: 0,
    images: 0,
    canvases: 0,
    audioElements: 0,
    spriteRecolorizer: null,
  };

  // Chrome exposes performance.memory
  if (performance?.memory) {
    snapshot.heap = {
      usedMB: (performance.memory.usedJSHeapSize / MB).toFixed(1),
      totalMB: (performance.memory.totalJSHeapSize / MB).toFixed(1),
      limitMB: (performance.memory.jsHeapSizeLimit / MB).toFixed(0),
    };
  }

  if (typeof document !== "undefined") {
    snapshot.domNodes = document.getElementsByTagName("*").length;
    snapshot.images = document.getElementsByTagName("img").length;
    snapshot.canvases = document.getElementsByTagName("canvas").length;
    snapshot.audioElements = document.getElementsByTagName("audio").length;
  }

  try {
    snapshot.spriteRecolorizer = getCacheStats();
  } catch (e) {
    snapshot.spriteRecolorizer = { error: String(e) };
  }

  return snapshot;
}

function formatSnapshot(snapshot) {
  const lines = [
    "━━━ PENGUIN MEMORY SNAPSHOT ━━━",
    `Time: ${snapshot.timestamp}`,
  ];

  if (snapshot.heap) {
    lines.push(
      `JS Heap: ${snapshot.heap.usedMB} MB used / ${snapshot.heap.totalMB} MB total (limit: ${snapshot.heap.limitMB} MB)`
    );
  }

  lines.push(
    `DOM: ${snapshot.domNodes} nodes | ${snapshot.images} images | ${snapshot.canvases} canvases | ${snapshot.audioElements} audio`
  );

  if (snapshot.spriteRecolorizer && !snapshot.spriteRecolorizer.error) {
    const s = snapshot.spriteRecolorizer;
    lines.push(
      `SpriteRecolorizer: ${s.size}/${s.maxSize} recolored | ${s.decodedSize}/${s.maxDecodedSize} decoded | ${s.canvasPoolSize} canvases pooled`
    );
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

function logToConsole() {
  const snapshot = getMemorySnapshot();
  console.log(formatSnapshot(snapshot));
  return snapshot;
}

function updateOverlay(snapshot) {
  if (!overlayElement || !overlayVisible) return;

  let html = '<div style="font-family:monospace;font-size:11px;color:#0f0;background:rgba(0,0,0,0.85);padding:8px;border-radius:4px;max-width:280px;">';
  html += `<div style="margin-bottom:4px;color:#888;">🐧 Memory Monitor (Ctrl+Shift+M to hide)</div>`;

  if (snapshot.heap) {
    html += `<div>Heap: ${snapshot.heap.usedMB} / ${snapshot.heap.limitMB} MB</div>`;
  }
  html += `<div>DOM: ${snapshot.domNodes} nodes</div>`;
  html += `<div>Images: ${snapshot.images}</div>`;
  if (snapshot.spriteRecolorizer && !snapshot.spriteRecolorizer.error) {
    const s = snapshot.spriteRecolorizer;
    html += `<div>Recolor cache: ${s.size}/${s.maxSize}</div>`;
    html += `<div>Decoded: ${s.decodedSize}/${s.maxDecodedSize}</div>`;
  }
  html += "</div>";

  overlayElement.innerHTML = html;
}

function createOverlay() {
  if (overlayElement) return overlayElement;

  overlayElement = document.createElement("div");
  overlayElement.id = "penguin-memory-overlay";
  overlayElement.style.cssText = "position:fixed;top:10px;right:10px;z-index:99999;pointer-events:none;";
  document.body.appendChild(overlayElement);
  return overlayElement;
}

function toggleOverlay() {
  overlayVisible = !overlayVisible;
  if (overlayVisible) {
    createOverlay();
    overlayElement.style.display = "block";
    updateOverlay(getMemorySnapshot());
  } else if (overlayElement) {
    overlayElement.style.display = "none";
  }
}

/**
 * Start automated memory monitoring
 * Call from Game component when entering a match
 */
export function startMemoryMonitor() {
  if (logIntervalId) return;

  // Initial log
  console.log("🐧 Memory monitor started. Logs every 30s. Ctrl+Shift+M = overlay. __PENGUIN_DEBUG() = instant snapshot");
  logToConsole();

  // Periodic logging
  logIntervalId = setInterval(() => {
    const snapshot = logToConsole();
    if (overlayVisible && overlayElement) {
      updateOverlay(snapshot);
    }
  }, LOG_INTERVAL_MS);

  // Overlay update interval (every 2s when visible)
  overlayIntervalId = setInterval(() => {
    if (overlayVisible && overlayElement) {
      updateOverlay(getMemorySnapshot());
    }
  }, 2000);

  // Expose debug function globally
  window.__PENGUIN_DEBUG = () => {
    const snapshot = logToConsole();
    console.log("Full snapshot:", snapshot);
    return snapshot;
  };

  return () => {
    clearInterval(logIntervalId);
    clearInterval(overlayIntervalId);
    logIntervalId = null;
    overlayIntervalId = null;
    stopMemoryMonitor();
  };
}

/**
 * Stop monitoring and cleanup
 */
export function stopMemoryMonitor() {
  if (logIntervalId) {
    clearInterval(logIntervalId);
    logIntervalId = null;
  }
  if (overlayIntervalId) {
    clearInterval(overlayIntervalId);
    overlayIntervalId = null;
  }
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
  overlayVisible = false;
  if (window.__PENGUIN_DEBUG) {
    delete window.__PENGUIN_DEBUG;
  }
}

/**
 * Setup keyboard shortcut for overlay (Ctrl+Shift+M)
 */
export function setupMemoryMonitorShortcut() {
  const handler = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "M") {
      e.preventDefault();
      toggleOverlay();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

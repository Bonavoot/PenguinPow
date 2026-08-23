/**
 * Antarctica map look-test — ice/water/mountain plate + parallax sky.
 *
 * Default ON. Toggle with Ctrl+Shift+A.
 * Persists to localStorage (`penguin-pow-antarctica-map`).
 */

const STORAGE_KEY = "penguin-pow-antarctica-map";
const ATTR = "data-antarctica-map";

let enabled = true;
const listeners = new Set();

function applyDomAttribute() {
  if (typeof document === "undefined") return;
  if (enabled) document.documentElement.setAttribute(ATTR, "1");
  else document.documentElement.removeAttribute(ATTR);
}

function readLocalStorage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function notify() {
  applyDomAttribute();
  persist();
  listeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch {
      /* ignore */
    }
  });
}

export function isAntarcticaMap() {
  return enabled;
}

export function setAntarcticaMap(next) {
  const value = Boolean(next);
  if (value === enabled) return;
  enabled = value;
  notify();
}

export function toggleAntarcticaMap() {
  setAntarcticaMap(!enabled);
}

export function subscribeAntarcticaMap(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let shortcutBound = false;

function setupShortcut() {
  if (shortcutBound || typeof window === "undefined") return;
  shortcutBound = true;
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      toggleAntarcticaMap();
    }
  });
}

export function initAntarcticaMap() {
  enabled = readLocalStorage();
  applyDomAttribute();
  setupShortcut();
}

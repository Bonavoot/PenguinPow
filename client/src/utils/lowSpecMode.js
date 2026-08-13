/**
 * Low Spec Mode — development toggle for weaker machines (e.g. M1 MacBook).
 *
 * OFF (default): full authored look (baked stadium grade, canvas crowd,
 * screen-space shafts, grain, snow, ice extras).
 * ON: strips remaining atmosphere (shafts / grain / snow / ice extras /
 * additive particle blends / menu depth blur).
 *
 * Persists to localStorage + Electron settings.json when available.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "pumo_low_spec";

let enabled = false;
const listeners = new Set();

function applyDomAttribute() {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.setAttribute("data-low-spec", "1");
  } else {
    document.documentElement.removeAttribute("data-low-spec");
  }
}

function readLocalStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalStorage(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isLowSpec() {
  return enabled;
}

/**
 * @param {boolean} next
 * @param {{ persist?: boolean, saveElectron?: boolean }} [opts]
 */
export function setLowSpec(next, opts = {}) {
  const { persist = true, saveElectron = true } = opts;
  const value = !!next;
  const changed = value !== enabled;
  enabled = value;
  applyDomAttribute();
  if (persist) writeLocalStorage(value);
  if (persist && saveElectron && typeof window !== "undefined") {
    const api = window.electron?.settings;
    if (api?.save) {
      api.save({ lowSpec: value }).catch(() => {});
    }
  }
  if (changed) {
    listeners.forEach((fn) => {
      try {
        fn(enabled);
      } catch {
        /* ignore subscriber errors */
      }
    });
  }
  return enabled;
}

export function subscribeLowSpec(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React hook — re-renders when the toggle flips. */
export function useLowSpec() {
  const [value, setValue] = useState(() => enabled);
  useEffect(() => subscribeLowSpec(setValue), []);
  return value;
}

/**
 * Call once at app boot (before or with first paint).
 * localStorage applies synchronously; Electron settings may override async.
 */
export function initLowSpecFromSettings() {
  // Instant path so the first menu frame already respects a saved ON state.
  if (readLocalStorage()) {
    setLowSpec(true, { persist: false, saveElectron: false });
  } else {
    applyDomAttribute();
  }

  if (typeof window === "undefined" || !window.electron?.settings?.get) {
    return;
  }
  window.electron.settings
    .get()
    .then((settings) => {
      if (typeof settings?.lowSpec === "boolean") {
        setLowSpec(settings.lowSpec, { persist: true, saveElectron: false });
      }
    })
    .catch(() => {});
}

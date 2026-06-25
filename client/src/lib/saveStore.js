/**
 * saveStore — the single gateway for BASHO persistence.
 *
 * Nothing else in the app should touch IPC or localStorage for the save
 * file directly. This module:
 *   - owns the versioned save schema + sequential migrations,
 *   - prefers the Electron save file (`basho-save.json` in userData via
 *     window.electron.save), and falls back to localStorage in a browser
 *     / dev context,
 *   - is resilient: a missing or corrupt save returns clean defaults,
 *   - exposes reset / export / import for the §9 testing affordances.
 *
 * See BASHO_MODE_SPEC.md §6 (Persistence & Save Architecture). The document
 * shape is intentionally "DB-ready" so it can migrate to a real DB / Steam
 * Cloud later without a rewrite.
 *
 * GUARDRAIL: persistence is single-player BASHO only. It must never read
 * from or write to anything that affects PvP or VS CPU.
 */

import { STARTING_RANK } from "../config/bashoConfig";

export const SCHEMA_VERSION = 1;

// localStorage key used only when Electron IPC is unavailable (browser/dev).
const LS_KEY = "penguinpow-basho-save";

/**
 * Produce a fresh default save document. A factory (not a shared constant)
 * so callers always get an isolated, mutation-safe copy.
 */
export function makeDefaultSave() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: null,
    profile: { displayName: "Player", steamId: null },
    career: {
      rank: { ...STARTING_RANK },
      bestDivisionReached: STARTING_RANK.division,
      envelopes: 0,
      statPoints: {
        available: 8,
        spent: { power: 0, moveSpeed: 0, resistance: 0, stamina: 0, balance: 0 },
      },
      loadout: { attack: [], defense: [], movement: [], grappling: [], shinto: [] },
      unlocks: [],
      lifetime: { bashos: 0, yusho: 0, kinboshi: 0, boutsWon: 0, boutsLost: 0 },
    },
    // In-progress run state (resume support). Field set mirrors the run
    // object produced by lib/bashoRun.js so the deep-merge on load preserves
    // every key. `active:false` means there is no run to resume.
    bashoRun: {
      active: false,
      division: null,
      totalBouts: 0,
      kk: 0,
      day: 0,
      record: { wins: 0, losses: 0 },
      results: [],
      opponents: [],
      startRank: null,
      createdAt: null,
      // Reserved for later phases (in-basho draft / modifiers — §7/§8):
      draftedPowerUps: [],
      modifiers: [],
      seed: null,
    },
    customization: { mawashiColor: null, bodyColor: null },
    settings: { hardcoreUnlocked: false },
  };
}

// ============================================
// INTERNAL HELPERS
// ============================================

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Deep-overlay `incoming` onto a fresh copy of `defaults`. Guarantees the
 * result always has every key the defaults define (so partial/older/corrupt
 * saves can never produce `undefined` reads downstream), while letting any
 * present incoming value win. Arrays and primitives are taken wholesale
 * from incoming when present.
 */
function mergeDefaults(defaults, incoming) {
  if (!isPlainObject(defaults)) {
    return incoming === undefined ? defaults : incoming;
  }
  const out = { ...defaults };
  if (!isPlainObject(incoming)) return out;
  for (const key of Object.keys(defaults)) {
    if (isPlainObject(defaults[key])) {
      out[key] = mergeDefaults(defaults[key], incoming[key]);
    } else if (incoming[key] !== undefined) {
      out[key] = incoming[key];
    }
  }
  return out;
}

/**
 * Bring any older raw document up to the current schema, then normalize it
 * against the defaults. Add a new `if (v < N)` block per schema bump.
 */
function migrate(raw) {
  if (!isPlainObject(raw)) return makeDefaultSave();

  const save = { ...raw };
  let v = Number.isInteger(save.schemaVersion) ? save.schemaVersion : 0;

  // v0 → v1: original release schema. Pre-versioned blobs are simply
  // adopted and normalized against the v1 defaults below.
  if (v < 1) {
    v = 1;
  }

  // Future migrations:
  // if (v < 2) { ...transform save...; v = 2; }

  save.schemaVersion = SCHEMA_VERSION;
  // Normalize: fill any missing keys from defaults without dropping data.
  return mergeDefaults(makeDefaultSave(), save);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * True when the persistent Electron save file is available (packaged app).
 * Useful for UI hints ("Auto-saved" vs "Saved locally").
 */
export function isElectronSave() {
  return (
    typeof window !== "undefined" &&
    !!window.electron &&
    !!window.electron.save &&
    typeof window.electron.save.get === "function"
  );
}

/**
 * Load + migrate the save. Always resolves to a valid, fully-populated
 * document — never throws, never returns null.
 */
export async function loadSave() {
  let raw = null;
  try {
    if (isElectronSave()) {
      raw = await window.electron.save.get();
    } else if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LS_KEY);
      raw = stored ? JSON.parse(stored) : null;
    }
  } catch (err) {
    console.warn("[saveStore] load failed; using defaults:", err);
    raw = null;
  }

  if (!raw) return makeDefaultSave();

  try {
    return migrate(raw);
  } catch (err) {
    console.warn("[saveStore] migrate failed; using defaults:", err);
    return makeDefaultSave();
  }
}

/**
 * Persist the save. Stamps schemaVersion + updatedAt and returns the
 * written document (so callers can keep their in-memory copy in sync).
 */
export async function writeSave(save) {
  const doc = {
    ...makeDefaultSave(),
    ...save,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (isElectronSave() && typeof window.electron.save.write === "function") {
      await window.electron.save.write(doc);
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(doc));
    }
  } catch (err) {
    console.warn("[saveStore] write failed:", err);
  }
  return doc;
}

/**
 * Reset to a fresh default save and persist it. Returns the new document.
 */
export async function resetSave() {
  const doc = makeDefaultSave();
  return writeSave(doc);
}

/**
 * Serialize a save to a pretty JSON string (for export / bug reports — §9).
 */
export function exportSaveString(save) {
  return JSON.stringify(save, null, 2);
}

/**
 * Parse + migrate an exported save string. Throws on invalid JSON so the
 * caller can surface an error; a structurally-odd-but-valid JSON is
 * normalized against defaults rather than rejected.
 */
export function importSaveString(str) {
  const raw = JSON.parse(str);
  return migrate(raw);
}

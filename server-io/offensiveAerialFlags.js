// ============================================
// OFFENSIVE AERIAL INTERACTION — FEATURE FLAGS
// ============================================
//
//   OFFENSIVE_AERIAL_TRACE=1       — structured JSON lines (server stdout)
//   OFFENSIVE_AERIAL_DEBUG=1       — in-process tick snapshots for tests
//   OFFENSIVE_AERIAL_REACTION_V2   — Phase 4 post-contact reaction / handoff
//                                   unset/1/true → ON (approved default)
//                                   0/false → Phase 3 legacy snap rollback
//   OFFENSIVE_AERIAL_REACTION_PRESET=heavy_short|heavy_medium|legacy_snap
//                                   unset → heavy_short (approved)
//
// See OFFENSIVE_AERIAL_POST_CONTACT_REACTIONS.md

function parseBoolEnv(raw) {
  if (raw === undefined || raw === null || raw === "") return false;
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * Centralized OFFENSIVE_AERIAL_REACTION_V2 parser (approved default ON).
 *
 *   unset / ""  → true
 *   "1"/"true"  → true
 *   "0"/"false" → false (Phase 3 legacy rollback)
 *
 * Unrecognized non-empty values default to true with a development warning.
 */
function parseOffensiveAerialReactionV2Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[offensiveAerialFlags] unrecognized OFFENSIVE_AERIAL_REACTION_V2=${JSON.stringify(
      String(raw)
    )}; defaulting to V2 on`
  );
  return true;
}

/** Dev-only structured per-interaction traces (JSON lines to stdout). */
const OFFENSIVE_AERIAL_TRACE = parseBoolEnv(process.env.OFFENSIVE_AERIAL_TRACE);

/**
 * When true, tick snapshots may be retained on player._offensiveAerialTrace
 * for harness inspection. Never enabled by release default.
 */
const OFFENSIVE_AERIAL_DEBUG =
  OFFENSIVE_AERIAL_TRACE || parseBoolEnv(process.env.OFFENSIVE_AERIAL_DEBUG);

/**
 * Phase 4 — outcome-specific post-contact reaction + landing handoff.
 * Default ON (`heavy_short` approved). Explicit 0/false restores Phase 3 snap.
 */
const OFFENSIVE_AERIAL_REACTION_V2 = parseOffensiveAerialReactionV2Flag(
  process.env.OFFENSIVE_AERIAL_REACTION_V2
);

/** Approved recoil preset when V2 is ON. Default heavy_short. */
const OFFENSIVE_AERIAL_REACTION_PRESET = (() => {
  const raw = String(process.env.OFFENSIVE_AERIAL_REACTION_PRESET || "")
    .trim()
    .toLowerCase();
  if (raw === "heavy_medium" || raw === "legacy_snap" || raw === "heavy_short") {
    return raw;
  }
  return "heavy_short";
})();

/** Test-only overrides (null = use boot-time env). */
let _reactionV2Override = null;
let _reactionPresetOverride = null;

function isOffensiveAerialReactionV2Enabled() {
  if (_reactionV2Override != null) return !!_reactionV2Override;
  return OFFENSIVE_AERIAL_REACTION_V2;
}

function getOffensiveAerialReactionPreset() {
  if (_reactionPresetOverride != null) return _reactionPresetOverride;
  return OFFENSIVE_AERIAL_REACTION_PRESET;
}

/** @param {boolean|null} enabled null clears override */
function setOffensiveAerialReactionV2ForTests(enabled) {
  _reactionV2Override = enabled == null ? null : !!enabled;
}

/** @param {string|null} preset null clears override */
function setOffensiveAerialReactionPresetForTests(preset) {
  _reactionPresetOverride = preset == null ? null : String(preset);
}

module.exports = {
  parseBoolEnv,
  parseOffensiveAerialReactionV2Flag,
  OFFENSIVE_AERIAL_TRACE,
  OFFENSIVE_AERIAL_DEBUG,
  OFFENSIVE_AERIAL_REACTION_V2,
  OFFENSIVE_AERIAL_REACTION_PRESET,
  isOffensiveAerialReactionV2Enabled,
  getOffensiveAerialReactionPreset,
  setOffensiveAerialReactionV2ForTests,
  setOffensiveAerialReactionPresetForTests,
};

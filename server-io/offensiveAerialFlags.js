// ============================================
// OFFENSIVE AERIAL INTERACTION — FEATURE FLAGS
// ============================================
// Audit / characterization phase only. Defaults OFF.
// Does not alter gameplay, move data, or production PvP deltas.
//
//   OFFENSIVE_AERIAL_TRACE=1  — structured JSON lines (server stdout)
//   OFFENSIVE_AERIAL_DEBUG=1  — enable in-process tick snapshots for tests
//
// See OFFENSIVE_AERIAL_INTERACTION_AUDIT.md

function parseBoolEnv(raw) {
  if (raw === undefined || raw === null || raw === "") return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true";
}

/** Dev-only structured per-interaction traces (JSON lines to stdout). */
const OFFENSIVE_AERIAL_TRACE = parseBoolEnv(process.env.OFFENSIVE_AERIAL_TRACE);

/**
 * When true, tick snapshots may be retained on player._offensiveAerialTrace
 * for harness inspection. Never enabled by release default.
 */
const OFFENSIVE_AERIAL_DEBUG =
  OFFENSIVE_AERIAL_TRACE || parseBoolEnv(process.env.OFFENSIVE_AERIAL_DEBUG);

module.exports = {
  parseBoolEnv,
  OFFENSIVE_AERIAL_TRACE,
  OFFENSIVE_AERIAL_DEBUG,
};

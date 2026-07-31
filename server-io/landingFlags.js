// ============================================
// AERIAL LANDING — FEATURE FLAGS
// ============================================
// Rope-jump landing V2 resolves a valid touchdown X during the arc
// (commit → motion-aware travel → land already clear / tiny residual).
// Legacy path remains the release default until playtest signs off.
//
// Enable locally:
//   ROPE_JUMP_LANDING_V2=1 npm start
//
// Debug networking (landing diagnostic fields / landing_diag events):
//   LANDING_DEBUG_NET=1   — or implied by LANDING_TRACE=1
//   LANDING_TRACE=1       — one JSON line per completed jump on the server
//
// See AERIAL_LANDING_PHASE_A.md / AERIAL_LANDING_PHASE_A1.md / AERIAL_LANDING_PHASE_A2.md.

const ROPE_JUMP_LANDING_V2 =
  process.env.ROPE_JUMP_LANDING_V2 === "1" ||
  process.env.ROPE_JUMP_LANDING_V2 === "true";

/** Dev-only structured one-jump traces (JSON lines to stdout). */
const LANDING_TRACE =
  process.env.LANDING_TRACE === "1" ||
  process.env.LANDING_TRACE === "true";

/**
 * When true, landing diagnostic fields may ride the fighter delta wire and
 * `landing_diag` socket events are emitted at commit/touchdown.
 * Never enabled by release default — production PvP must not pay for overlay
 * metrics every broadcast tick.
 */
const LANDING_DEBUG_NET =
  LANDING_TRACE ||
  process.env.LANDING_DEBUG_NET === "1" ||
  process.env.LANDING_DEBUG_NET === "true";

module.exports = {
  ROPE_JUMP_LANDING_V2,
  LANDING_TRACE,
  LANDING_DEBUG_NET,
};

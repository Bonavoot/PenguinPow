// ============================================
// AERIAL LANDING — FEATURE FLAGS
// ============================================
// Rope-jump landing V2 resolves a valid touchdown X during the late arc
// (commit → continuous travel → land already clear). Legacy path remains the
// release default until playtest signs off.
//
// Enable locally:
//   ROPE_JUMP_LANDING_V2=1 npm start
// Or flip the constant below for a persistent local override.
//
// See AERIAL_LANDING_PHASE_A.md.

const ROPE_JUMP_LANDING_V2 =
  process.env.ROPE_JUMP_LANDING_V2 === "1" ||
  process.env.ROPE_JUMP_LANDING_V2 === "true";

/** Dev-only structured one-jump traces (JSON lines to stdout). */
const LANDING_TRACE =
  process.env.LANDING_TRACE === "1" ||
  process.env.LANDING_TRACE === "true";

module.exports = {
  ROPE_JUMP_LANDING_V2,
  LANDING_TRACE,
};

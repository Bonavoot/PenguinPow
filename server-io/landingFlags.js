// ============================================
// AERIAL LANDING — FEATURE FLAGS
// ============================================
// Rope-jump landing V2 is the normal default (manually approved).
//
//   npm run dev:web
//     → V2 on, preset reference_contact_9
//
// Legacy emergency rollback:
//   ROPE_JUMP_LANDING_V2=0 npm run dev:web
//
// Debug networking (landing diagnostic fields / landing_diag events):
//   LANDING_DEBUG_NET=1   — or implied by LANDING_TRACE=1
//   LANDING_TRACE=1       — one JSON line per completed jump on the server
//
// See ROPE_JUMP_MOVE_IDENTITY_V2.md / ROPE_JUMP_V2_POLISH_TUNING.md

/**
 * Centralized ROPE_JUMP_LANDING_V2 parser.
 *
 *   unset / ""  → true  (approved V2 default)
 *   "1"/"true"  → true
 *   "0"/"false" → false (legacy rollback)
 *
 * Unrecognized non-empty values default to true with a development warning.
 */
function parseRopeJumpLandingV2Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  console.warn(
    `[landingFlags] unrecognized ROPE_JUMP_LANDING_V2=${JSON.stringify(
      String(raw)
    )}; defaulting to V2 on`
  );
  return true;
}

const ROPE_JUMP_LANDING_V2 = parseRopeJumpLandingV2Flag(
  process.env.ROPE_JUMP_LANDING_V2
);

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

/** Approved default vault preset (see ropeJumpVault.js). */
const DEFAULT_VAULT_PRESET_NAME = "reference_contact_9";

/** Dev preset name for high-vault V2 trajectory (see ropeJumpVault.js). */
const ROPE_JUMP_VAULT_PRESET =
  process.env.ROPE_JUMP_VAULT_PRESET || DEFAULT_VAULT_PRESET_NAME;

module.exports = {
  parseRopeJumpLandingV2Flag,
  ROPE_JUMP_LANDING_V2,
  LANDING_TRACE,
  LANDING_DEBUG_NET,
  DEFAULT_VAULT_PRESET_NAME,
  ROPE_JUMP_VAULT_PRESET,
};

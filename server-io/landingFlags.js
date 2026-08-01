// ============================================
// AERIAL LANDING — FEATURE FLAGS
// ============================================
// Rope-jump landing V2 + free-flight curve V3 are the normal defaults
// (manually approved).
//
//   npm run dev:web
//     → Landing V2 on (reference_contact_9 nearby)
//     → Flight Curve V3 on (smooth_long_20 free flight)
//
// Legacy emergency rollbacks:
//   ROPE_JUMP_LANDING_V2=0 npm run dev:web
//   ROPE_JUMP_FLIGHT_CURVE_V3=0 npm run dev:web
//
// Debug networking (landing diagnostic fields / landing_diag events):
//   LANDING_DEBUG_NET=1   — or implied by LANDING_TRACE=1
//   LANDING_TRACE=1       — one JSON line per completed jump on the server
//
// See ROPE_JUMP_MOVE_IDENTITY_V2.md / ROPE_JUMP_FREE_FLIGHT_TRAJECTORY_PHASE.md

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

/**
 * Phase 17 — free-flight curve separation (default ON, manually approved).
 *
 *   npm run dev:web
 *     → V3 on, preset smooth_long_20 (unless ROPE_JUMP_FLIGHT_PRESET set)
 *
 * Exact pre-V3 reference rollback:
 *   ROPE_JUMP_FLIGHT_CURVE_V3=0 npm run dev:web
 *
 * Presets: smooth_same_range | smooth_long_20 | smooth_long_30
 */
function parseRopeJumpFlightCurveV3Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[landingFlags] unrecognized ROPE_JUMP_FLIGHT_CURVE_V3=${JSON.stringify(
      String(raw)
    )}; defaulting to V3 on`
  );
  return true;
}

const ROPE_JUMP_FLIGHT_CURVE_V3 = parseRopeJumpFlightCurveV3Flag(
  process.env.ROPE_JUMP_FLIGHT_CURVE_V3
);

const DEFAULT_FLIGHT_PRESET_NAME = "smooth_long_20";

let _flightCurveV3Override = null;

function setRopeJumpFlightCurveV3ForTests(value) {
  _flightCurveV3Override = value == null ? null : !!value;
}

function isRopeJumpFlightCurveV3Enabled(envValue) {
  if (envValue !== undefined) {
    return parseRopeJumpFlightCurveV3Flag(envValue);
  }
  if (_flightCurveV3Override != null) return _flightCurveV3Override;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.ROPE_JUMP_FLIGHT_CURVE_V3
      : undefined;
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseRopeJumpFlightCurveV3Flag(raw);
  }
  return ROPE_JUMP_FLIGHT_CURVE_V3;
}

function resolveFlightPresetName(name) {
  const raw =
    name != null && name !== ""
      ? name
      : typeof process !== "undefined" && process.env
        ? process.env.ROPE_JUMP_FLIGHT_PRESET
        : undefined;
  if (raw == null || raw === "") return DEFAULT_FLIGHT_PRESET_NAME;
  return String(raw).trim().toLowerCase();
}

module.exports = {
  parseRopeJumpLandingV2Flag,
  ROPE_JUMP_LANDING_V2,
  LANDING_TRACE,
  LANDING_DEBUG_NET,
  DEFAULT_VAULT_PRESET_NAME,
  ROPE_JUMP_VAULT_PRESET,
  parseRopeJumpFlightCurveV3Flag,
  ROPE_JUMP_FLIGHT_CURVE_V3,
  DEFAULT_FLIGHT_PRESET_NAME,
  setRopeJumpFlightCurveV3ForTests,
  isRopeJumpFlightCurveV3Enabled,
  resolveFlightPresetName,
};

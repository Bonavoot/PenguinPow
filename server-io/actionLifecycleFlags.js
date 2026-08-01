"use strict";

/**
 * Action Lifecycle Ownership V2 — feature flag (Phase 15 finalization).
 *
 * Default ON (manually approved). Explicit rollback:
 *   ACTION_LIFECYCLE_OWNERSHIP_V2=0|false  → exact legacy behavior
 *   ACTION_LIFECYCLE_OWNERSHIP_V2=1|true   → V2
 *   unset / ""                             → V2 (default ON)
 *
 * Independent of facing / pose / contact / aerial / presentation flags.
 *
 * See ACTION_LIFECYCLE_OWNERSHIP_PHASE.md
 */

/**
 * Parse ACTION_LIFECYCLE_OWNERSHIP_V2.
 *   unset / ""  → true (default ON)
 *   "1"/"true"  → true
 *   "0"/"false" → false
 */
function parseActionLifecycleOwnershipV2Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[actionLifecycleOwnership] unrecognized ACTION_LIFECYCLE_OWNERSHIP_V2=${JSON.stringify(
      String(raw)
    )}; defaulting to V2 on`
  );
  return true;
}

const ACTION_LIFECYCLE_OWNERSHIP_V2 = parseActionLifecycleOwnershipV2Flag(
  process.env.ACTION_LIFECYCLE_OWNERSHIP_V2
);

let _lifecycleV2Override = null;

function setActionLifecycleOwnershipV2ForTests(value) {
  _lifecycleV2Override = value == null ? null : !!value;
}

function isActionLifecycleOwnershipV2Enabled(envValue) {
  if (envValue !== undefined) {
    return parseActionLifecycleOwnershipV2Flag(envValue);
  }
  if (_lifecycleV2Override != null) return _lifecycleV2Override;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.ACTION_LIFECYCLE_OWNERSHIP_V2
      : undefined;
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseActionLifecycleOwnershipV2Flag(raw);
  }
  return ACTION_LIFECYCLE_OWNERSHIP_V2;
}

module.exports = {
  ACTION_LIFECYCLE_OWNERSHIP_V2,
  parseActionLifecycleOwnershipV2Flag,
  isActionLifecycleOwnershipV2Enabled,
  setActionLifecycleOwnershipV2ForTests,
};

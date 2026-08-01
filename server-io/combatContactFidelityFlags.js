"use strict";

/**
 * Combat Contact Fidelity V2 — feature flag (Phase 13 / 13A / 14 finalization).
 *
 * Default ON (manually approved). Explicit rollback:
 *   COMBAT_CONTACT_FIDELITY_V2=0|false  → exact legacy behavior
 *   COMBAT_CONTACT_FIDELITY_V2=1|true   → V2
 *   unset / ""                           → V2 (default ON)
 *
 * See COMBAT_CONTACT_FIDELITY_PHASE.md, CHARGED_HEADBUTT_CONTACT_PHASE.md
 */

/**
 * Parse COMBAT_CONTACT_FIDELITY_V2.
 *   unset / ""  → true (default ON)
 *   "1"/"true"  → true
 *   "0"/"false" → false
 */
function parseCombatContactFidelityV2Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[combatContactFidelity] unrecognized COMBAT_CONTACT_FIDELITY_V2=${JSON.stringify(
      String(raw)
    )}; defaulting to V2 on`
  );
  return true;
}

const COMBAT_CONTACT_FIDELITY_V2 = parseCombatContactFidelityV2Flag(
  process.env.COMBAT_CONTACT_FIDELITY_V2
);

let _contactFidelityV2Override = null;

function setCombatContactFidelityV2ForTests(value) {
  _contactFidelityV2Override = value == null ? null : !!value;
}

function isCombatContactFidelityV2Enabled(envValue) {
  if (envValue !== undefined) {
    return parseCombatContactFidelityV2Flag(envValue);
  }
  if (_contactFidelityV2Override != null) return _contactFidelityV2Override;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.COMBAT_CONTACT_FIDELITY_V2
      : undefined;
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseCombatContactFidelityV2Flag(raw);
  }
  return COMBAT_CONTACT_FIDELITY_V2;
}

module.exports = {
  COMBAT_CONTACT_FIDELITY_V2,
  parseCombatContactFidelityV2Flag,
  isCombatContactFidelityV2Enabled,
  setCombatContactFidelityV2ForTests,
};

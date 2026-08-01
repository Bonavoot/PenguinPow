"use strict";

/**
 * Input Command Reliability V2 — feature flag (Phase 16 finalization).
 *
 * Default ON (manually approved). Explicit rollback:
 *   INPUT_COMMAND_RELIABILITY_V2=0|false  → exact legacy
 *   INPUT_COMMAND_RELIABILITY_V2=1|true   → V2
 *   unset / ""                             → V2 (default ON)
 *
 * Independent of lifecycle / contact / facing / pose / aerial / rope-jump flags.
 *
 * See INPUT_COMMAND_RELIABILITY_PHASE.md
 */

function parseInputCommandReliabilityV2Flag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[inputCommandReliability] unrecognized INPUT_COMMAND_RELIABILITY_V2=${JSON.stringify(
      String(raw)
    )}; defaulting to V2 on`
  );
  return true;
}

const INPUT_COMMAND_RELIABILITY_V2 = parseInputCommandReliabilityV2Flag(
  process.env.INPUT_COMMAND_RELIABILITY_V2
);

/** Server-side command trace (independent of V2 gameplay path). */
const INPUT_COMMAND_TRACE =
  process.env.INPUT_COMMAND_TRACE === "1" ||
  process.env.INPUT_COMMAND_TRACE === "true";

let _inputCmdV2Override = null;

function setInputCommandReliabilityV2ForTests(value) {
  _inputCmdV2Override = value == null ? null : !!value;
}

function isInputCommandReliabilityV2Enabled(envValue) {
  if (envValue !== undefined) {
    return parseInputCommandReliabilityV2Flag(envValue);
  }
  if (_inputCmdV2Override != null) return _inputCmdV2Override;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.INPUT_COMMAND_RELIABILITY_V2
      : undefined;
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseInputCommandReliabilityV2Flag(raw);
  }
  return INPUT_COMMAND_RELIABILITY_V2;
}

function isInputCommandTraceEnabled() {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.INPUT_COMMAND_TRACE
      : undefined;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return INPUT_COMMAND_TRACE === true;
}

module.exports = {
  INPUT_COMMAND_RELIABILITY_V2,
  INPUT_COMMAND_TRACE,
  parseInputCommandReliabilityV2Flag,
  isInputCommandReliabilityV2Enabled,
  setInputCommandReliabilityV2ForTests,
  isInputCommandTraceEnabled,
};

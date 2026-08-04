"use strict";

/**
 * Phase 3 — authored combat-volume SHADOW mode (default OFF).
 *
 * When OFF: zero shadow/authored query work is expected on the normal tick
 * (this module must not be required by index.js / collisionSystem).
 *
 * When ON: harness, tests, or explicit debug callers may run candidate
 * geometry + legacy-vs-candidate comparison. Candidate results NEVER feed
 * combat resolution.
 *
 * Enable:
 *   COMBAT_VOLUME_SHADOW=1 npm run dev:web
 * Rollback / unset:
 *   unset COMBAT_VOLUME_SHADOW
 *   COMBAT_VOLUME_SHADOW=0
 *
 * Client overlay twin (dev only): localStorage pumo_combat_volume_shadow=1
 * under existing CombatFidelityDebug DEV gate — does not enable server shadow.
 */

function parseCombatVolumeShadowFlag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return false;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[combatVolumeShadow] unrecognized COMBAT_VOLUME_SHADOW=${JSON.stringify(
      String(raw)
    )}; defaulting OFF`
  );
  return false;
}

const COMBAT_VOLUME_SHADOW = parseCombatVolumeShadowFlag(
  typeof process !== "undefined" && process.env
    ? process.env.COMBAT_VOLUME_SHADOW
    : undefined
);

let _shadowOverride = null;

function setCombatVolumeShadowForTests(value) {
  _shadowOverride = value == null ? null : !!value;
}

function isCombatVolumeShadowEnabled(envValue) {
  if (envValue !== undefined) {
    return parseCombatVolumeShadowFlag(envValue);
  }
  if (_shadowOverride != null) return _shadowOverride;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.COMBAT_VOLUME_SHADOW
      : undefined;
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseCombatVolumeShadowFlag(raw);
  }
  return COMBAT_VOLUME_SHADOW;
}

module.exports = {
  COMBAT_VOLUME_SHADOW,
  parseCombatVolumeShadowFlag,
  isCombatVolumeShadowEnabled,
  setCombatVolumeShadowForTests,
};

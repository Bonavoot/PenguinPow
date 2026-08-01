"use strict";

/**
 * Compact command rejection reasons (Phase 16).
 * Production paths store the code only; verbose strings stay in the opt-in trace.
 */

const INPUT_REJECT = Object.freeze({
  NO_DIRECTION: "NO_DIRECTION",
  AMBIGUOUS_DIRECTION: "AMBIGUOUS_DIRECTION",
  INVALID_FACING: "INVALID_FACING",
  AIRBORNE: "AIRBORNE",
  PRIMARY_ACTION_BUSY: "PRIMARY_ACTION_BUSY",
  RECOVERY_ACTIVE: "RECOVERY_ACTIVE",
  LIFECYCLE_OWNER_ACTIVE: "LIFECYCLE_OWNER_ACTIVE",
  NOT_IN_CLINCH: "NOT_IN_CLINCH",
  STALE_CLINCH_INSTANCE: "STALE_CLINCH_INSTANCE",
  THROW_RECOVERY_ACTIVE: "THROW_RECOVERY_ACTIVE",
  INVALID_GRIP_STATE: "INVALID_GRIP_STATE",
  DEFENDER_PERFECT_BRACE: "DEFENDER_PERFECT_BRACE",
  ROUND_INACTIVE: "ROUND_INACTIVE",
  DUPLICATE_COMMAND: "DUPLICATE_COMMAND",
  STALE_COMMAND: "STALE_COMMAND",
  ACTION_BLOCKED: "ACTION_BLOCKED",
  ELIGIBILITY_FAILED: "ELIGIBILITY_FAILED",
  DODGE_RECOVERY_FRESH: "DODGE_RECOVERY_FRESH",
  GASSED: "GASSED",
  ARM_CLAMPED: "ARM_CLAMPED",
  TECHNIQUE_ACTIVE: "TECHNIQUE_ACTIVE",
  JOLT_RECOVERY: "JOLT_RECOVERY",
  COMMAND_NOT_RECOGNIZED: "COMMAND_NOT_RECOGNIZED",
  RESOLVED_AND_DEFENDED: "RESOLVED_AND_DEFENDED",
});

function noteCommandReject(player, reason, meta = {}) {
  if (!player) return;
  player._lastInputCommandReject = reason || null;
  player._lastInputCommandRejectAt = Date.now();
  player._lastInputCommandMeta = {
    command: meta.command || null,
    relativeDir: meta.relativeDir || null,
    facingSnap: meta.facingSnap ?? null,
    stage: meta.stage || "COMMAND_REJECTED",
  };
}

function noteCommandAccept(player, command, meta = {}) {
  if (!player) return;
  player._lastInputCommandReject = null;
  player._lastInputCommandAccept = command || null;
  player._lastInputCommandAcceptAt = Date.now();
  player._lastInputCommandMeta = {
    command: command || null,
    relativeDir: meta.relativeDir || null,
    facingSnap: meta.facingSnap ?? null,
    stage: meta.stage || "COMMAND_ACCEPTED",
  };
}

function clearInputCommandNotes(player) {
  if (!player) return;
  player._lastInputCommandReject = null;
  player._lastInputCommandRejectAt = 0;
  player._lastInputCommandAccept = null;
  player._lastInputCommandAcceptAt = 0;
  player._lastInputCommandMeta = null;
}

module.exports = {
  INPUT_REJECT,
  noteCommandReject,
  noteCommandAccept,
  clearInputCommandNotes,
};

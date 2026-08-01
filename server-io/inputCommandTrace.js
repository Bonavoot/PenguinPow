"use strict";

/**
 * Bounded, event-driven input-command trace (Phase 16).
 * Disabled unless INPUT_COMMAND_TRACE=1. Cap 256. Cleared on reset/rematch.
 */

const { isInputCommandTraceEnabled } = require("./inputCommandReliabilityFlags");

const TRACE_CAP = 256;
const STAGE = Object.freeze({
  PHYSICAL_EDGE: "PHYSICAL_EDGE",
  HELD_STATE_UPDATED: "HELD_STATE_UPDATED",
  COMMAND_CANDIDATE: "COMMAND_CANDIDATE",
  COMMAND_SELECTED: "COMMAND_SELECTED",
  COMMAND_EMITTED: "COMMAND_EMITTED",
  SERVER_RECEIVED: "SERVER_RECEIVED",
  AUTHORITATIVE_DIRECTION_RESOLVED: "AUTHORITATIVE_DIRECTION_RESOLVED",
  COMMAND_ACCEPTED: "COMMAND_ACCEPTED",
  COMMAND_REJECTED: "COMMAND_REJECTED",
  ACTION_STARTED: "ACTION_STARTED",
  ACTION_COMPLETED_OR_INTERRUPTED: "ACTION_COMPLETED_OR_INTERRUPTED",
});

/** @type {Map<string, object[]>} playerId -> ring */
const tracesByPlayer = new Map();
let _seq = 0;
let _lastResult = null;

function clearInputCommandTrace(playerId) {
  if (playerId) {
    tracesByPlayer.delete(playerId);
    return;
  }
  tracesByPlayer.clear();
  _lastResult = null;
}

function pushInputCommandTrace(playerId, stage, fields = {}) {
  if (!isInputCommandTraceEnabled()) return null;
  if (!playerId) return null;
  let buf = tracesByPlayer.get(playerId);
  if (!buf) {
    buf = [];
    tracesByPlayer.set(playerId, buf);
  }
  const rec = {
    id: ++_seq,
    stage,
    t: Date.now(),
    ...fields,
  };
  buf.push(rec);
  if (buf.length > TRACE_CAP) buf.splice(0, buf.length - TRACE_CAP);
  if (
    stage === STAGE.COMMAND_ACCEPTED ||
    stage === STAGE.COMMAND_REJECTED ||
    stage === STAGE.ACTION_STARTED
  ) {
    _lastResult = {
      playerId,
      stage,
      command: fields.command || null,
      reason: fields.reason || null,
      relativeDir: fields.relativeDir || null,
      at: rec.t,
      attemptId: fields.attemptId || rec.id,
    };
  }
  return rec;
}

function getInputCommandTrace(playerId) {
  if (!playerId) return [];
  return tracesByPlayer.get(playerId) || [];
}

function getLastInputCommandResult() {
  return _lastResult;
}

function dumpInputCommandTrace(playerId) {
  const rows = playerId ? getInputCommandTrace(playerId) : [];
  if (!playerId) {
    const all = [];
    for (const [id, buf] of tracesByPlayer) {
      for (const r of buf) all.push({ playerId: id, ...r });
    }
    return all;
  }
  return rows;
}

module.exports = {
  TRACE_CAP,
  INPUT_COMMAND_STAGE: STAGE,
  clearInputCommandTrace,
  pushInputCommandTrace,
  getInputCommandTrace,
  getLastInputCommandResult,
  dumpInputCommandTrace,
};

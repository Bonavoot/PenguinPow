/**
 * Client-side bounded input-command trace (Phase 16).
 *
 * Enable:
 *   localStorage.setItem("pumo_input_command_trace", "1")
 * Inspect:
 *   window.__PUMO_INPUT_COMMAND_TRACE.dump()
 *   window.__PUMO_INPUT_COMMAND_TRACE.last()
 *
 * Cap 256. Event-driven only. No per-frame localStorage reads after cache.
 */

const FLAG_KEY = "pumo_input_command_trace";
const TRACE_CAP = 256;

let cachedEnabled = null;
const buffer = [];
let lastResult = null;
let seq = 0;

function readFlag() {
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function refreshCachedFlag() {
  cachedEnabled = readFlag();
}

if (typeof window !== "undefined") {
  refreshCachedFlag();
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === FLAG_KEY) refreshCachedFlag();
  });
}

export function isInputCommandTraceEnabled() {
  if (cachedEnabled == null) refreshCachedFlag();
  return !!cachedEnabled;
}

export function clearClientInputCommandTrace() {
  buffer.length = 0;
  lastResult = null;
}

export function pushClientInputCommandTrace(stage, fields = {}) {
  if (!isInputCommandTraceEnabled()) return null;
  const rec = {
    id: ++seq,
    stage,
    t: performance.now(),
    ...fields,
  };
  buffer.push(rec);
  if (buffer.length > TRACE_CAP) buffer.splice(0, buffer.length - TRACE_CAP);
  if (
    stage === "COMMAND_SELECTED" ||
    stage === "COMMAND_EMITTED" ||
    stage === "COMMAND_REJECTED" ||
    stage === "COMMAND_ACCEPTED"
  ) {
    lastResult = {
      stage,
      command: fields.command || null,
      reason: fields.reason || null,
      relativeDir: fields.relativeDir || null,
      at: rec.t,
    };
  }
  return rec;
}

export function getClientInputCommandTrace() {
  return buffer.slice();
}

export function getLastClientInputCommandResult() {
  return lastResult;
}

export function noteServerInputCommandResult(payload) {
  if (!payload) return;
  lastResult = {
    stage: payload.stage || "SERVER",
    command: payload.command || null,
    reason: payload.reason || null,
    relativeDir: payload.relativeDir || null,
    at: performance.now(),
    server: true,
  };
  if (isInputCommandTraceEnabled()) {
    pushClientInputCommandTrace(lastResult.stage, {
      command: lastResult.command,
      reason: lastResult.reason,
      relativeDir: lastResult.relativeDir,
      server: true,
    });
  }
}

if (typeof window !== "undefined") {
  window.__PUMO_INPUT_COMMAND_TRACE = {
    enable: () => {
      try {
        localStorage.setItem(FLAG_KEY, "1");
      } catch {
        /* ignore */
      }
      refreshCachedFlag();
    },
    disable: () => {
      try {
        localStorage.removeItem(FLAG_KEY);
      } catch {
        /* ignore */
      }
      refreshCachedFlag();
    },
    dump: () => getClientInputCommandTrace(),
    last: () => getLastClientInputCommandResult(),
    clear: () => clearClientInputCommandTrace(),
    refreshFlags: refreshCachedFlag,
  };
}

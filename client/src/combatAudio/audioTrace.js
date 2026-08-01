/**
 * Dev-only combat-audio trace. Negligible cost when idle; no console spam.
 *
 *   window.__PUMO_AUDIO.dump()
 *   window.__PUMO_AUDIO.summary()
 *   window.__PUMO_AUDIO.clear()
 */

const MAX_RECORDS = 256;
const records = [];
let seq = 0;
let installed = false;

function isDevTraceEnabled() {
  try {
    if (typeof window !== "undefined") {
      const ls = window.localStorage?.getItem("pumo_audio_trace");
      if (ls === "1" || ls === "true") return true;
    }
  } catch {
    /* ignore */
  }
  try {
    return !!(import.meta.env && import.meta.env.DEV);
  } catch {
    const nodeEnv =
      typeof globalThis !== "undefined"
        ? globalThis.process?.env?.NODE_ENV
        : undefined;
    return nodeEnv !== "production";
  }
}

export function pushAudioTrace(entry) {
  if (!isDevTraceEnabled()) return;
  const row = {
    seq: ++seq,
    t: typeof performance !== "undefined" ? performance.now() : Date.now(),
    ...entry,
  };
  records.push(row);
  while (records.length > MAX_RECORDS) records.shift();
}

export function dumpAudioTrace() {
  return records.slice();
}

export function summarizeAudioTrace() {
  const byCue = Object.create(null);
  const byStatus = Object.create(null);
  for (const r of records) {
    const cue = r.cue || "?";
    byCue[cue] = (byCue[cue] || 0) + 1;
    const st = r.status || "?";
    byStatus[st] = (byStatus[st] || 0) + 1;
  }
  return {
    count: records.length,
    byCue,
    byStatus,
    last: records.length ? records[records.length - 1] : null,
  };
}

export function clearAudioTrace() {
  records.length = 0;
  seq = 0;
}

export function installAudioTraceGlobal() {
  if (installed || typeof window === "undefined") return;
  window.__PUMO_AUDIO = {
    dump: dumpAudioTrace,
    summary: summarizeAudioTrace,
    clear: clearAudioTrace,
  };
  installed = true;
}

/**
 * Dev-only combat-audio trace. Negligible cost when idle; no console spam.
 *
 *   window.__PUMO_AUDIO.dump()
 *   window.__PUMO_AUDIO.summary()
 *   window.__PUMO_AUDIO.clear()
 *   window.__PUMO_AUDIO.dumpChargePalm()
 *   copy(JSON.stringify(window.__PUMO_AUDIO.dumpChargePalm(), null, 2))
 */

const MAX_RECORDS = 256;
const records = [];
let seq = 0;
let installed = false;

const CHARGE_PALM_CUES = new Set([
  "PALM_WHIFF",
  "SLAP_WHIFF",
  "CHARGED_LUNGE_BEGIN",
  "*",
]);

const CHARGE_PALM_STATUSES = new Set([
  "scheduled",
  "played",
  "canceled",
  "ACTIVE_ACTION_STOPPED",
  "CHARGE_HOLD_BEGIN",
  "CHARGED_LUNGE_BEGIN",
  "MOUSE1_COMMAND_SELECTED",
  "reconciled",
  "deduped",
  "rejected",
]);

function isDevTraceEnabled() {
  try {
    if (typeof window !== "undefined") {
      const ls = window.localStorage?.getItem("pumo_audio_trace");
      if (ls === "1" || ls === "true") return true;
      if (ls === "0" || ls === "false") return false;
    }
  } catch {
    /* ignore */
  }
  try {
    if (import.meta.env?.DEV) return true;
  } catch {
    /* ignore */
  }
  try {
    const nodeEnv =
      typeof globalThis !== "undefined"
        ? globalThis.process?.env?.NODE_ENV
        : undefined;
    // node --test and non-production Node keep traces available for diagnostics.
    if (nodeEnv === "production") return false;
    if (nodeEnv === "test" || nodeEnv === "development") return true;
  } catch {
    /* ignore */
  }
  return false;
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

/**
 * Charge / palm / Mouse1 classification records only — for clipboard dumps.
 */
export function dumpChargePalmTrace() {
  return records.filter((r) => {
    if (r.status === "MOUSE1_COMMAND_SELECTED") return true;
    if (r.status === "CHARGE_HOLD_BEGIN") return true;
    if (r.status === "CHARGED_LUNGE_BEGIN") return true;
    if (r.status === "ACTIVE_ACTION_STOPPED") return true;
    if (CHARGE_PALM_CUES.has(r.cue) && CHARGE_PALM_STATUSES.has(r.status)) {
      return true;
    }
    if (
      r.cue === "PALM_WHIFF" ||
      r.cue === "SLAP_WHIFF" ||
      r.cue === "CHARGED_LUNGE_BEGIN"
    ) {
      return true;
    }
    if (r.reason && /charge|palm|reclass|auth_charge/i.test(String(r.reason))) {
      return true;
    }
    return false;
  });
}

export function installAudioTraceGlobal() {
  if (installed || typeof window === "undefined") return;
  window.__PUMO_AUDIO = {
    dump: dumpAudioTrace,
    summary: summarizeAudioTrace,
    clear: clearAudioTrace,
    dumpChargePalm: dumpChargePalmTrace,
  };
  installed = true;
}

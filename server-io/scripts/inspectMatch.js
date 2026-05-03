#!/usr/bin/env node
// ============================================
// MATCH INPUT LOG INSPECTOR
// ============================================
// Usage: node server-io/scripts/inspectMatch.js <jsonl-file>
//
// Pretty-prints a per-match input audit log produced by inputAuditLog.js
// with simple anti-cheat heuristics:
//   - Per-player input counts and apparent packet rate
//   - Per-key press totals
//   - Suspicion signals: long runs of <5ms-spaced inputs, sub-30ms
//     same-key inter-press intervals (faster than humanly plausible)
//
// No deps; just reads the file line by line. Designed to be safe to run
// against any *.jsonl in server-io/match-logs/.

const fs = require("fs");
const readline = require("readline");
const path = require("path");

const SUSPICION_BURST_GAP_MS = 5;       // packets <5ms apart count toward burst run
const SUSPICION_KEY_GAP_MS = 30;        // same-key presses <30ms apart are flagged
const TRACKED_KEYS = ["mouse1", "mouse2", "shift", " ", "a", "d", "s", "w", "e", "f", "c", "control"];

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmtKey(k) {
  return k === " " ? "<space>" : k;
}

async function inspect(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  // Per-socket stats
  const stats = new Map();
  let firstTs = null;
  let lastTs = null;
  let totalLines = 0;
  let parseErrors = 0;

  function ensureStats(socketId) {
    if (!stats.has(socketId)) {
      stats.set(socketId, {
        socketId,
        packets: 0,
        firstTs: null,
        lastTs: null,
        prevTs: null,
        keyPresses: Object.fromEntries(TRACKED_KEYS.map((k) => [k, 0])),
        prevKeys: null,
        prevKeyPressTime: Object.create(null),
        burstCurrentRun: 0,
        burstLongestRun: 0,
        suspiciousFastPresses: [], // {key, gapMs, ts}
      });
    }
    return stats.get(socketId);
  }

  for await (const line of rl) {
    if (!line) continue;
    totalLines++;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      parseErrors++;
      continue;
    }
    if (!entry || typeof entry.ts !== "number" || !entry.socketId) continue;

    const s = ensureStats(entry.socketId);
    s.packets++;

    if (s.firstTs == null) s.firstTs = entry.ts;
    s.lastTs = entry.ts;
    if (firstTs == null || entry.ts < firstTs) firstTs = entry.ts;
    if (lastTs == null || entry.ts > lastTs) lastTs = entry.ts;

    // Burst detection: count consecutive packets <SUSPICION_BURST_GAP_MS apart
    if (s.prevTs != null) {
      const gap = entry.ts - s.prevTs;
      if (gap <= SUSPICION_BURST_GAP_MS) {
        s.burstCurrentRun++;
        if (s.burstCurrentRun > s.burstLongestRun) {
          s.burstLongestRun = s.burstCurrentRun;
        }
      } else {
        s.burstCurrentRun = 0;
      }
    }
    s.prevTs = entry.ts;

    // Per-key rising-edge counting from snapshot diff (does not require
    // the events array; works on legacy logs too).
    const keys = entry.payload && entry.payload.keys;
    if (keys) {
      for (const k of TRACKED_KEYS) {
        const now = !!keys[k];
        const prev = s.prevKeys ? !!s.prevKeys[k] : false;
        if (!prev && now) {
          s.keyPresses[k]++;
          const lastTime = s.prevKeyPressTime[k];
          if (lastTime != null) {
            const keyGap = entry.ts - lastTime;
            if (keyGap < SUSPICION_KEY_GAP_MS) {
              s.suspiciousFastPresses.push({ key: k, gapMs: keyGap, ts: entry.ts });
            }
          }
          s.prevKeyPressTime[k] = entry.ts;
        }
      }
      s.prevKeys = keys;
    }
  }

  // Output
  console.log(`File: ${path.resolve(filePath)}`);
  console.log(`Size: ${stat.size} bytes`);
  console.log(`Lines parsed: ${totalLines}${parseErrors ? ` (${parseErrors} parse errors)` : ""}`);
  if (firstTs != null && lastTs != null) {
    const durationMs = lastTs - firstTs;
    console.log(`Match span: ${(durationMs / 1000).toFixed(2)}s`);
  }
  console.log("");

  for (const s of stats.values()) {
    const durMs = (s.lastTs ?? 0) - (s.firstTs ?? 0);
    const rate = durMs > 0 ? (s.packets / (durMs / 1000)).toFixed(1) : "n/a";
    console.log(`--- socket ${s.socketId} ---`);
    console.log(`  Packets: ${s.packets}`);
    console.log(`  Active span: ${(durMs / 1000).toFixed(2)}s`);
    console.log(`  Avg packet rate: ${rate} pkt/s`);
    console.log(`  Longest <=${SUSPICION_BURST_GAP_MS}ms-spaced burst run: ${s.burstLongestRun}`);
    console.log(`  Per-key press counts:`);
    for (const k of TRACKED_KEYS) {
      const count = s.keyPresses[k] || 0;
      if (count > 0) console.log(`    ${pad(fmtKey(k), 10)} ${count}`);
    }
    if (s.suspiciousFastPresses.length > 0) {
      console.log(`  SUSPICIOUS sub-${SUSPICION_KEY_GAP_MS}ms same-key intervals (${s.suspiciousFastPresses.length}):`);
      const sample = s.suspiciousFastPresses.slice(0, 12);
      for (const sp of sample) {
        console.log(`    ${pad(fmtKey(sp.key), 10)} gap=${sp.gapMs}ms  @ts=${sp.ts}`);
      }
      if (s.suspiciousFastPresses.length > sample.length) {
        console.log(`    ... and ${s.suspiciousFastPresses.length - sample.length} more`);
      }
    } else {
      console.log(`  No same-key intervals under ${SUSPICION_KEY_GAP_MS}ms detected.`);
    }
    console.log("");
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node server-io/scripts/inspectMatch.js <jsonl-file>");
  process.exit(2);
}
inspect(arg).catch((err) => {
  console.error("inspect failed:", err);
  process.exit(1);
});

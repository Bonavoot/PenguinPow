#!/usr/bin/env node
// ============================================
// VELOCITY-AT-PRESS HISTOGRAM  (MASTERY Phase 0)
// ============================================
// Reads the per-match audit logs produced by inputAuditLog.js and histograms
// |movementVelocity| at the moment each verb was initiated, one histogram per
// verb (slap / palm / charged / grab). This locates the knee of the Phase 1
// momentum curve and lets us prove the before/after distribution shift from a
// single playtest session.
//
// The audit log only records these samples when AUDIT_LOG is enabled on the
// server:  AUDIT_LOG=1 node index.js
// Each sample line looks like:
//   {"kind":"verbInit","verb":"slap","movementVelocity":-1.42,"x":612,
//    "opponentDistance":180,"simTime":12345}
//
// Usage:
//   node server-io/scripts/velocity-histogram.mjs [path ...]
//     (no args) → scans server-io/match-logs/*.jsonl
//     <file>    → a single .jsonl log
//     <dir>     → every .jsonl in that directory
//
// No dependencies; streams line-by-line so it is safe on large logs.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = path.join(__dirname, "..", "match-logs");

// Histogram bucket width in |velocity| units. The sim's powerslide cap is ~2.1,
// so 0.2-wide buckets give ~11 legible bars across the whole range.
const BUCKET_WIDTH = 0.2;
const MAX_VELOCITY = 2.4; // anything at/above lands in the top overflow bucket
const BAR_WIDTH = 40; // max characters for the tallest bar

function collectFiles(inputs) {
  const files = [];
  const addDir = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(".jsonl")) files.push(path.join(dir, name));
    }
  };
  if (inputs.length === 0) {
    if (fs.existsSync(DEFAULT_LOG_DIR)) addDir(DEFAULT_LOG_DIR);
    return files;
  }
  for (const input of inputs) {
    if (!fs.existsSync(input)) {
      console.error(`skip (not found): ${input}`);
      continue;
    }
    const stat = fs.statSync(input);
    if (stat.isDirectory()) addDir(input);
    else if (input.endsWith(".jsonl")) files.push(input);
    else console.error(`skip (not .jsonl): ${input}`);
  }
  return files;
}

function bucketIndex(absVel) {
  if (absVel >= MAX_VELOCITY) return Math.floor(MAX_VELOCITY / BUCKET_WIDTH);
  return Math.floor(absVel / BUCKET_WIDTH);
}

function bucketLabel(i) {
  const lo = (i * BUCKET_WIDTH).toFixed(1);
  const topIdx = Math.floor(MAX_VELOCITY / BUCKET_WIDTH);
  if (i >= topIdx) return `>=${(i * BUCKET_WIDTH).toFixed(1)}`;
  const hi = ((i + 1) * BUCKET_WIDTH).toFixed(1);
  return `${lo}-${hi}`;
}

// Per-verb accumulator: { count, sumAbs, max, buckets:Map<idx,count> }
function makeAcc() {
  return { count: 0, sumAbs: 0, max: 0, buckets: new Map() };
}

async function readFile(filePath, byVerb) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry || entry.kind !== "verbInit" || typeof entry.verb !== "string") continue;
    const v = Number(entry.movementVelocity);
    if (!Number.isFinite(v)) continue;
    const abs = Math.abs(v);

    if (!byVerb.has(entry.verb)) byVerb.set(entry.verb, makeAcc());
    const acc = byVerb.get(entry.verb);
    acc.count++;
    acc.sumAbs += abs;
    if (abs > acc.max) acc.max = abs;
    const bi = bucketIndex(abs);
    acc.buckets.set(bi, (acc.buckets.get(bi) || 0) + 1);
  }
}

function printVerb(verb, acc) {
  const mean = acc.count > 0 ? acc.sumAbs / acc.count : 0;
  console.log(`\n=== ${verb}  (n=${acc.count}, mean|v|=${mean.toFixed(2)}, max|v|=${acc.max.toFixed(2)}) ===`);
  if (acc.count === 0) return;
  const topIdx = Math.floor(MAX_VELOCITY / BUCKET_WIDTH);
  let peak = 0;
  for (let i = 0; i <= topIdx; i++) peak = Math.max(peak, acc.buckets.get(i) || 0);
  for (let i = 0; i <= topIdx; i++) {
    const c = acc.buckets.get(i) || 0;
    const barLen = peak > 0 ? Math.round((c / peak) * BAR_WIDTH) : 0;
    const pct = ((c / acc.count) * 100).toFixed(1).padStart(5);
    console.log(`  ${bucketLabel(i).padStart(9)} | ${"#".repeat(barLen).padEnd(BAR_WIDTH)} ${String(c).padStart(6)} (${pct}%)`);
  }
}

async function main() {
  const inputs = process.argv.slice(2);
  const files = collectFiles(inputs);
  if (files.length === 0) {
    console.error(
      "No .jsonl logs found.\n" +
        `Looked in: ${inputs.length ? inputs.join(", ") : DEFAULT_LOG_DIR}\n` +
        "Enable audit logging on the server (AUDIT_LOG=1) to produce samples.",
    );
    process.exit(1);
  }

  const byVerb = new Map();
  for (const f of files) {
    try {
      await readFile(f, byVerb);
    } catch (err) {
      console.error(`read failed (${f}): ${err.message}`);
    }
  }

  console.log(`Scanned ${files.length} file(s).`);
  const totalSamples = [...byVerb.values()].reduce((s, a) => s + a.count, 0);
  console.log(`Total verb-initiation samples: ${totalSamples}`);
  if (totalSamples === 0) {
    console.log(
      "\nNo verb-initiation telemetry found. These samples are only written " +
        "when the server runs with AUDIT_LOG=1.",
    );
    return;
  }

  // Stable, readable ordering.
  const order = ["slap", "palm", "charged", "grab"];
  const verbs = [...byVerb.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  for (const verb of verbs) printVerb(verb, byVerb.get(verb));
}

main().catch((err) => {
  console.error("velocity-histogram failed:", err);
  process.exit(1);
});

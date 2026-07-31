#!/usr/bin/env node
/**
 * Phase 0 — Static live-loop inventory (rAF / setInterval / setTimeout / socket.on).
 *
 * Usage: node client/scripts/perf/liveLoopInventory.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "client/src");
const OUT_DIR = path.join(__dirname, "out");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function countMatches(text, re) {
  let n = 0;
  re.lastIndex = 0;
  while (re.exec(text)) n++;
  return n;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = walk(SRC);
  const rows = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const raf = countMatches(text, /requestAnimationFrame\s*\(/g);
    const caf = countMatches(text, /cancelAnimationFrame\s*\(/g);
    const intervals = countMatches(text, /setInterval\s*\(/g);
    const timeouts = countMatches(text, /setTimeout\s*\(/g);
    const socketOn = countMatches(text, /\.on\s*\(\s*['"`]/g);
    const useState = countMatches(text, /\buseState\s*\(/g);
    const useEffect = countMatches(text, /\buseEffect\s*\(/g);
    if (
      raf ||
      intervals ||
      (timeouts > 5 && raf === 0 && file.includes("GameFighter")) ||
      useState > 20 ||
      useEffect > 20
    ) {
      rows.push({
        path: path.relative(ROOT, file).replace(/\\/g, "/"),
        requestAnimationFrame: raf,
        cancelAnimationFrame: caf,
        setInterval: intervals,
        setTimeout: timeouts,
        socketOnLikely: socketOn,
        useState,
        useEffect,
        lines: text.split("\n").length,
      });
    }
  }

  rows.sort(
    (a, b) =>
      b.requestAnimationFrame - a.requestAnimationFrame ||
      b.useEffect - a.useEffect ||
      b.lines - a.lines,
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.raf += r.requestAnimationFrame;
      acc.intervals += r.setInterval;
      acc.timeouts += r.setTimeout;
      return acc;
    },
    { raf: 0, intervals: 0, timeouts: 0 },
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totals,
    hotFiles: rows,
    knownConcurrentMatchLoops: [
      "GameFighter ×2 (interpolation + snowball + cinematic trails)",
      "ParticleEngine rAF (sleeps when idle; wakes on spawn/emit; scans pool while awake)",
      "SnowEffect rAF (MAX_SNOWFLAKES=62 DOM style writes; pauses when document.hidden)",
      "useCamera rAF",
      "BalanceGauge / PowerMeter / various VFX effect rAFs",
      "CrowdLayer 100ms cheer interval (verify in CrowdLayer.jsx)",
      "gamepadHandler rAF poll",
    ],
  };

  const jsonPath = path.join(OUT_DIR, "live-loop-inventory.json");
  const mdPath = path.join(OUT_DIR, "live-loop-inventory.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Live Loop Inventory (static)",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Totals across hot files: **${totals.raf}** \`requestAnimationFrame\` call sites, **${totals.intervals}** \`setInterval\`, **${totals.timeouts}** \`setTimeout\`.`,
    "",
    "## Known concurrent match loops",
    "",
    ...report.knownConcurrentMatchLoops.map((x) => `- ${x}`),
    "",
    "## Hot files",
    "",
    `| File | Lines | rAF | interval | timeout | useState | useEffect | socket.on~ |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...rows.map(
      (r) =>
        `| \`${r.path}\` | ${r.lines} | ${r.requestAnimationFrame} | ${r.setInterval} | ${r.setTimeout} | ${r.useState} | ${r.useEffect} | ${r.socketOnLikely} |`,
    ),
    "",
    "Runtime confirmation of how many callbacks fire per visual frame is recorded by `PerfRecorder` (Phase 0 instrumentation).",
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(md);
}

main();

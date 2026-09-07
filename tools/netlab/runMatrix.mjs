#!/usr/bin/env node
/**
 * Adverse-network matrix: real server + FIFO impairing proxy + two-client harness.
 *
 *   node tools/netlab/runMatrix.mjs
 *   node tools/netlab/runMatrix.mjs --seconds 25
 *   node tools/netlab/runMatrix.mjs --filter 0,0,none
 *
 * Starts server-io on a free PORT. Does not bind 3001 or 5173.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startImpairProxy } from "./impairProxy.mjs";
import { runMatch } from "./harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const RTTS = [0, 60, 120, 200];
const JITTERS = [0, 30, 80];
const STALLS = [
  { id: "none", every: 0, ms: 0 },
  { id: "250/5s", every: 5000, ms: 250 },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

async function waitHealthy(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url + "/health");
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error("server not healthy at " + url);
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { seconds: 25, filter: null, outDir: path.join(__dirname, "out") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--seconds") opts.seconds = Number(next);
    else if (a === "--filter") opts.filter = String(next);
    else if (a === "--out") opts.outDir = path.resolve(next);
    else continue;
    i++;
  }
  return opts;
}

function cellKey(rtt, jitter, stallId) {
  return `${rtt},${jitter},${stallId}`;
}

function judgeCell(row) {
  const fails = [];
  if (!row.completed) fails.push("match did not complete");
  if (row.ackP50 != null && row.ackP50 > row.rtt + 40) {
    fails.push(`input→ack p50 ${row.ackP50.toFixed(1)} > RTT+40 (${row.rtt + 40})`);
  }
  if (row.interpDelay != null && row.interpDelay > row.jitter + 40) {
    fails.push(`interp delay ${row.interpDelay.toFixed(1)} > jitter+40 (${row.jitter + 40})`);
  }
  if ((row.reversals || 0) > 0) fails.push(`${row.reversals} remote reversals`);
  if (row.rtt <= 120 && (row.hardSnapsPerMin || 0) >= 3) {
    fails.push(`hard snaps/min ${row.hardSnapsPerMin.toFixed(2)} ≥ 3`);
  }
  if ((row.seqGaps || 0) > 0) fails.push(`${row.seqGaps} seq gaps`);
  if ((row.foreignRoom || 0) > 0) fails.push(`${row.foreignRoom} cross-room fighter_action`);
  return fails;
}

function combineAB(match, rtt, jitter, stallId) {
  const pick = (fn) => fn(match.a, match.b);
  const ackP50 = pick((a, b) => {
    const vals = [a.ackP50, b.ackP50].filter((x) => x != null);
    return vals.length ? Math.max(...vals) : null;
  });
  const ackP95 = pick((a, b) => {
    const vals = [a.ackP95, b.ackP95].filter((x) => x != null);
    return vals.length ? Math.max(...vals) : null;
  });
  const iaP99 = pick((a, b) => {
    const vals = [a.iaP99, b.iaP99].filter((x) => x != null);
    return vals.length ? Math.max(...vals) : null;
  });
  return {
    rtt,
    jitter,
    stall: stallId,
    completed: match.completed,
    ackP50,
    ackP95,
    iaP99,
    interpDelay: Math.max(match.a.interpDelay || 0, match.b.interpDelay || 0),
    renderSpeedStd: Math.max(match.a.renderSpeedStd || 0, match.b.renderSpeedStd || 0),
    hardSnapsPerMin: Math.max(match.a.hardSnapsPerMin || 0, match.b.hardSnapsPerMin || 0),
    kbps: (match.a.kbps + match.b.kbps) / 2,
    seqGaps: match.seqGaps,
    reversals: (match.a.reversals || 0) + (match.b.reversals || 0),
    foreignRoom: match.foreignRoom,
    snapshots: match.a.snapshots + match.b.snapshots,
  };
}

function fmt(n, d = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

function markdownTable(rows) {
  const hdr =
    "| RTT | jitter | stall | ok | ack p50 | ack p95 | ia p99 | interp delay | speed std | hard/min | KB/s | gaps | rev |\n" +
    "|----:|-------:|:------|:--:|--------:|--------:|-------:|-------------:|----------:|---------:|-----:|-----:|----:|";
  const body = rows
    .map((r) => {
      const ok = r.fails && r.fails.length ? "FAIL" : "ok";
      return (
        `| ${r.rtt} | ${r.jitter} | ${r.stall} | ${ok} ` +
        `| ${fmt(r.ackP50)} | ${fmt(r.ackP95)} | ${fmt(r.iaP99)} ` +
        `| ${fmt(r.interpDelay)} | ${fmt(r.renderSpeedStd, 3)} | ${fmt(r.hardSnapsPerMin, 2)} ` +
        `| ${fmt(r.kbps, 1)} | ${r.seqGaps} | ${r.reversals} |`
      );
    })
    .join("\n");
  return hdr + "\n" + body;
}

async function spawnServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ["index.js"], {
    cwd: path.join(ROOT, "server-io"),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let err = "";
  child.stderr.on("data", (d) => {
    err += String(d);
  });
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitHealthy(url);
  } catch (e) {
    child.kill("SIGTERM");
    throw new Error(`${e.message}\n${err.slice(-2000)}`);
  }
  return { child, port, url, err: () => err };
}

async function stopChild(child) {
  if (!child || child.killed) return;
  const pid = child.pid;
  if (!pid) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  await sleep(400);
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

async function runCell(serverPort, { rtt, jitter, stall, seconds, roomId }) {
  const oneWay = rtt / 2;
  const proxy = await startImpairProxy({
    listen: 0,
    targetHost: "127.0.0.1",
    targetPort: serverPort,
    delay: oneWay,
    jitter,
    stallEvery: stall.every,
    stall: stall.ms,
    loss: 0,
  });
  try {
    const match = await runMatch({
      url: `http://127.0.0.1:${proxy.port}`,
      roomId,
      seconds,
      rttHint: rtt,
    });
    return combineAB(match, rtt, jitter, stall.id);
  } finally {
    await proxy.close();
  }
}

function nextRoom(i) {
  return `Room ${(i % 10) + 1}`;
}

async function main() {
  const opts = parseArgs();
  fs.mkdirSync(opts.outDir, { recursive: true });

  const cells = [];
  for (const rtt of RTTS) {
    for (const jitter of JITTERS) {
      for (const stall of STALLS) {
        const key = cellKey(rtt, jitter, stall.id);
        if (opts.filter && opts.filter !== key) continue;
        cells.push({ rtt, jitter, stall, key });
      }
    }
  }
  if (!cells.length) throw new Error("no cells matched --filter " + opts.filter);

  console.log(`[netlab] starting server-io; ${cells.length} cells × ${opts.seconds}s`);
  const server = await spawnServer();
  console.log(`[netlab] server ${server.url}`);

  const rows = [];
  let roomCounter = 0;
  try {
    for (const cell of cells) {
      const roomId = nextRoom(roomCounter++);
      process.stdout.write(`[netlab] ${cell.key} ${roomId} … `);
      const t0 = Date.now();
      try {
        const row = await runCell(server.port, {
          rtt: cell.rtt,
          jitter: cell.jitter,
          stall: cell.stall,
          seconds: opts.seconds,
          roomId,
        });
        row.fails = judgeCell(row);
        row.elapsedMs = Date.now() - t0;
        rows.push(row);
        console.log(row.fails.length ? `FAIL ${row.fails.join("; ")}` : `ok ${row.elapsedMs}ms`);
      } catch (e) {
        const row = {
          rtt: cell.rtt,
          jitter: cell.jitter,
          stall: cell.stall.id,
          completed: false,
          ackP50: null,
          ackP95: null,
          iaP99: null,
          interpDelay: null,
          renderSpeedStd: null,
          hardSnapsPerMin: null,
          kbps: 0,
          seqGaps: 0,
          reversals: 0,
          foreignRoom: 0,
          snapshots: 0,
          fails: [String(e.message || e)],
          elapsedMs: Date.now() - t0,
        };
        rows.push(row);
        console.log(`FAIL ${row.fails[0]}`);
      }
    }

    // Two matches on one server; no impairment. Assert no cross-room events.
    process.stdout.write("[netlab] concurrency Room 9 + Room 10 … ");
    const tC = Date.now();
    let conc;
    try {
      const [m1, m2] = await Promise.all([
        runMatch({ url: server.url, roomId: "Room 9", seconds: opts.seconds, rttHint: 0 }),
        runMatch({ url: server.url, roomId: "Room 10", seconds: opts.seconds, rttHint: 0 }),
      ]);
      const leak =
        m1.foreignRoom +
        m2.foreignRoom +
        (m1.a.seenRoomIds.some((id) => id && id !== "Room 9") ? 1 : 0) +
        (m1.b.seenRoomIds.some((id) => id && id !== "Room 9") ? 1 : 0) +
        (m2.a.seenRoomIds.some((id) => id && id !== "Room 10") ? 1 : 0) +
        (m2.b.seenRoomIds.some((id) => id && id !== "Room 10") ? 1 : 0);
      conc = {
        rtt: 0,
        jitter: 0,
        stall: "concurrency",
        completed: m1.completed && m2.completed,
        ackP50: Math.max(m1.a.ackP50 || 0, m2.a.ackP50 || 0),
        ackP95: Math.max(m1.a.ackP95 || 0, m2.a.ackP95 || 0),
        iaP99: Math.max(m1.a.iaP99 || 0, m2.a.iaP99 || 0),
        interpDelay: Math.max(m1.a.interpDelay || 0, m2.a.interpDelay || 0),
        renderSpeedStd: Math.max(m1.a.renderSpeedStd || 0, m2.a.renderSpeedStd || 0),
        hardSnapsPerMin: Math.max(m1.a.hardSnapsPerMin || 0, m2.a.hardSnapsPerMin || 0),
        kbps: (m1.a.kbps + m2.a.kbps) / 2,
        seqGaps: m1.seqGaps + m2.seqGaps,
        reversals: m1.a.reversals + m1.b.reversals + m2.a.reversals + m2.b.reversals,
        foreignRoom: leak,
        snapshots: m1.a.snapshots + m2.a.snapshots,
        elapsedMs: Date.now() - tC,
      };
      conc.fails = judgeCell(conc);
      if (leak > 0) conc.fails.push("cross-room fighter_action");
      console.log(conc.fails.length ? `FAIL ${conc.fails.join("; ")}` : `ok ${conc.elapsedMs}ms`);
    } catch (e) {
      conc = {
        rtt: 0,
        jitter: 0,
        stall: "concurrency",
        completed: false,
        fails: [String(e.message || e)],
        elapsedMs: Date.now() - tC,
        seqGaps: 0,
        reversals: 0,
        foreignRoom: 1,
      };
      console.log(`FAIL ${conc.fails[0]}`);
    }
    rows.push(conc);
  } finally {
    await stopChild(server.child);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    seconds: opts.seconds,
    passCriteria: {
      matchCompletes: true,
      inputAckP50: "≤ RTT + 40 ms",
      interpolatorDelay: "≤ jitter + 40 ms",
      reversals: 0,
      hardSnapsPerMin: "< 3/min at RTT ≤ 120",
      crossRoomLeakage: 0,
    },
    rows,
    passed: rows.every((r) => !r.fails || r.fails.length === 0),
  };

  const md = markdownTable(rows);
  const jsonPath = path.join(opts.outDir, "matrix.json");
  const mdPath = path.join(opts.outDir, "matrix.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, md + "\n");
  console.log("\n" + md);
  console.log(`\n[netlab] wrote ${jsonPath}`);
  console.log(`[netlab] ${report.passed ? "PASS" : "FAIL"}`);
  process.exit(report.passed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

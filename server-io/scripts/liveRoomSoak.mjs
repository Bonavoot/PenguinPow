#!/usr/bin/env node
/**
 * Post–Phase 5 live multi-client soak.
 *
 * Spawns (or attaches to) a server-io process, creates N CPU matches, drives
 * each through ready → pre-match → power-up → fight, hammers movement inputs,
 * and reports fighter_action rates / seq gaps / process RSS.
 *
 * Usage:
 *   node server-io/scripts/liveRoomSoak.mjs
 * Env:
 *   SOAK_ROOMS=8
 *   SOAK_SECONDS=12
 *   SOAK_PORT=3011
 *   SOAK_ATTACH=1   # connect to existing server on SOAK_PORT (do not spawn)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { io } = require(path.join(ROOT, "client/node_modules/socket.io-client"));

const ROOMS = Math.max(1, Number(process.env.SOAK_ROOMS || 8));
const SECONDS = Math.max(3, Number(process.env.SOAK_SECONDS || 12));
const PORT = Number(process.env.SOAK_PORT || 3011);
const ATTACH = process.env.SOAK_ATTACH === "1";
const URL = `http://127.0.0.1:${PORT}`;

const KEYS = {
  w: false,
  a: false,
  s: false,
  d: false,
  " ": false,
  shift: false,
  e: false,
  f: false,
  mouse1: false,
  mouse2: false,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await sleep(150);
  }
  throw new Error(`server not ready on ${URL}`);
}

function spawnServer() {
  const child = spawn(process.execPath, ["index.js"], {
    cwd: path.join(ROOT, "server-io"),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    const s = String(d);
    if (/Error|EADDRINUSE/i.test(s)) process.stderr.write(s);
  });
  return child;
}

function makeMatch(index) {
  const socket = io(URL, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  const match = {
    index,
    socket,
    id: null,
    roomId: null,
    keys: { ...KEYS },
    fighting: false,
    packets: 0,
    keyframes: 0,
    resyncs: 0,
    lastSeq: null,
    gaps: 0,
    bytes: 0,
  };

  match.send = (patch) => {
    const events = [];
    for (const k of Object.keys(patch)) {
      if (!!match.keys[k] !== !!patch[k]) {
        events.push({ k, a: patch[k] ? "down" : "up", t: Date.now() });
      }
    }
    Object.assign(match.keys, patch);
    socket.emit("fighter_action", {
      id: match.id,
      keys: match.keys,
      events,
    });
  };

  socket.on("connect", () => {
    match.id = socket.id;
    socket.emit("create_cpu_match", {
      socketId: match.id,
      mawashiColor: "#4169E1",
      bodyColor: null,
      gearIds: [],
    });
  });

  socket.on("cpu_match_created", (data) => {
    match.roomId = data.roomId;
    socket.emit("ready_count", {
      roomId: match.roomId,
      playerId: match.id,
      isReady: true,
    });
  });

  socket.on("initial_game_start", () => {
    socket.emit("pre_match_complete", { roomId: match.roomId });
  });

  socket.on("power_up_selection_start", (data) => {
    const pick =
      (Array.isArray(data.availablePowerUps) && data.availablePowerUps[0]) ||
      "power_water";
    socket.emit("power_up_selected", {
      roomId: match.roomId,
      playerId: match.id,
      powerUpType: pick,
    });
  });

  socket.on("game_start", () => {
    match.fighting = true;
  });

  socket.on("fighter_action", (data) => {
    match.packets++;
    try {
      match.bytes += JSON.stringify(data).length;
    } catch {
      /* ignore */
    }
    if (data?.isKeyframe) match.keyframes++;
    if (data?.isResync) match.resyncs++;
    if (typeof data?.seq === "number") {
      if (match.lastSeq != null && data.seq > match.lastSeq + 1 && !data.isResync) {
        match.gaps++;
      }
      match.lastSeq = data.seq;
    }
  });

  return match;
}

let child = null;
try {
  if (!ATTACH) {
    child = spawnServer();
    await waitForServer();
  } else {
    await waitForServer(5000);
  }

  const matches = Array.from({ length: ROOMS }, (_, i) => makeMatch(i));
  const connectDeadline = Date.now() + 10000;
  while (Date.now() < connectDeadline) {
    if (matches.every((m) => m.roomId)) break;
    await sleep(50);
  }
  const connected = matches.filter((m) => m.roomId).length;
  if (connected === 0) {
    throw new Error("no CPU matches created — is the server accepting sockets?");
  }

  const fightDeadline = Date.now() + 20000;
  while (Date.now() < fightDeadline) {
    if (matches.filter((m) => m.fighting).length >= Math.min(connected, ROOMS)) {
      break;
    }
    await sleep(100);
  }

  const fighting = matches.filter((m) => m.fighting).length;
  const soakStart = performance.now();
  const endAt = Date.now() + SECONDS * 1000;
  let inputTicks = 0;

  while (Date.now() < endAt) {
    for (const m of matches) {
      if (!m.fighting) continue;
      const left = inputTicks % 2 === 0;
      m.send({ a: left, d: !left, mouse1: inputTicks % 11 === 0 });
    }
    inputTicks++;
    await sleep(16);
  }

  const soakMs = performance.now() - soakStart;
  for (const m of matches) {
    m.socket.close();
  }

  const packets = matches.reduce((a, m) => a + m.packets, 0);
  const gaps = matches.reduce((a, m) => a + m.gaps, 0);
  const keyframes = matches.reduce((a, m) => a + m.keyframes, 0);
  const bytes = matches.reduce((a, m) => a + m.bytes, 0);
  const rss = process.memoryUsage().rss;

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "post5-soak",
    status: fighting > 0 ? "measured_live" : "partial_no_fight",
    config: { rooms: ROOMS, seconds: SECONDS, port: PORT, attach: ATTACH },
    results: {
      roomsConnected: connected,
      roomsFighting: fighting,
      soakMs: Number(soakMs.toFixed(1)),
      fighterActionPackets: packets,
      packetsPerSec: Number((packets / (soakMs / 1000)).toFixed(1)),
      keyframes,
      seqGaps: gaps,
      bytesIn: bytes,
      bytesPerSec: Number((bytes / (soakMs / 1000)).toFixed(0)),
      clientRssMb: Number((rss / 1024 / 1024).toFixed(1)),
    },
    note:
      "Live CPU-match soak (physics + sockets). Seq gaps should stay near 0 on loopback.",
  };

  const outDir = path.join(ROOT, "client/scripts/perf/out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "server-live-room-soak.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);

  if (gaps > 0) {
    process.exitCode = 2;
  }
} finally {
  if (child && !child.killed) {
    child.kill("SIGTERM");
    await sleep(200);
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

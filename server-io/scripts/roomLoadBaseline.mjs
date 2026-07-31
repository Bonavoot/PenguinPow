#!/usr/bin/env node
/**
 * Phase 5 — Server room-load / serialization capacity baseline.
 *
 * Measures the cost of building fighter_action packets (delta + keyframe path)
 * for N synthetic rooms over a fixed window. Does not open sockets.
 *
 * Usage: node server-io/scripts/roomLoadBaseline.mjs
 * Env:
 *   LOAD_ROOMS=24          synthetic concurrent matches (default 24)
 *   LOAD_SECONDS=3         measurement window (default 3)
 *   LOAD_TICK_BUDGET_MS=8  assumed budget inside each 15.625ms tick (default 8)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);

const {
  TICK_RATE,
  BROADCAST_EVERY_N_TICKS,
  KEYFRAME_EVERY_N_BROADCASTS,
} = require("../constants.js");
const { createInitialPlayerState } = require("../playerFactory.js");
const { buildFighterActionPacket } = require("../fighterBroadcast.js");

const ROOMS = Math.max(1, Number(process.env.LOAD_ROOMS || 24));
const SECONDS = Math.max(0.5, Number(process.env.LOAD_SECONDS || 3));
const TICK_BUDGET_MS = Math.max(1, Number(process.env.LOAD_TICK_BUDGET_MS || 8));
const TICK_MS = 1000 / TICK_RATE;
const BROADCAST_HZ = TICK_RATE / BROADCAST_EVERY_N_TICKS;

function makeRoom(i) {
  return {
    id: `load-${i}`,
    simTime: Date.now(),
    broadcastSeq: 0,
    previousPlayerStates: [null, null],
    players: [
      createInitialPlayerState({
        id: `p1-${i}`,
        fighter: "player 1",
        x: 220 + (i % 7),
        facing: 1,
        isAttacking: false,
      }),
      createInitialPlayerState({
        id: `p2-${i}`,
        fighter: "player 2",
        x: 900 - (i % 5),
        facing: -1,
        isAttacking: false,
      }),
    ],
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

const rooms = Array.from({ length: ROOMS }, (_, i) => makeRoom(i));
const tickSamples = [];
const broadcastSamples = [];
let bytesDelta = 0;
let bytesKeyframe = 0;
let deltaCount = 0;
let keyframeCount = 0;

const totalTicks = Math.floor(SECONDS * TICK_RATE);
let broadcastCounter = 0;

const wallStart = performance.now();
for (let t = 0; t < totalTicks; t++) {
  const tickStart = performance.now();
  broadcastCounter++;
  const shouldBroadcast =
    broadcastCounter % BROADCAST_EVERY_N_TICKS === 0;

  for (let r = 0; r < rooms.length; r++) {
    const room = rooms[r];
    room.simTime += TICK_MS;
    // Mild state churn so deltas are non-empty.
    room.players[0].x += (t % 3 === 0 ? 0.4 : 0);
    room.players[1].stamina = 100 - ((t + r) % 40) * 0.5;
    room.players[0].isAttacking = t % 17 === 0;
    room.players[1].isSlapAttack = t % 19 === 0;

    if (!shouldBroadcast) continue;

    const bStart = performance.now();
    const { packet, previousPlayerStates } = buildFighterActionPacket(room, {
      masteryP5: false,
      keyframeEveryN: KEYFRAME_EVERY_N_BROADCASTS,
    });
    room.previousPlayerStates = previousPlayerStates;
    const bMs = performance.now() - bStart;
    broadcastSamples.push(bMs);

    const json = JSON.stringify(packet);
    if (packet.isKeyframe) {
      bytesKeyframe += json.length;
      keyframeCount++;
    } else {
      bytesDelta += json.length;
      deltaCount++;
    }
  }

  tickSamples.push(performance.now() - tickStart);
}
const wallMs = performance.now() - wallStart;

tickSamples.sort((a, b) => a - b);
broadcastSamples.sort((a, b) => a - b);

const avgTick = tickSamples.reduce((a, b) => a + b, 0) / tickSamples.length;
const p95Tick = percentile(tickSamples, 95);
const p99Tick = percentile(tickSamples, 99);
const maxTick = tickSamples[tickSamples.length - 1] || 0;

const broadcastsPerSecPerRoom = BROADCAST_HZ;
const avgBytesPerBroadcast =
  (bytesDelta + bytesKeyframe) / Math.max(1, deltaCount + keyframeCount);
const bytesPerSecPerMatch = avgBytesPerBroadcast * broadcastsPerSecPerRoom;

// Headroom: how many rooms fit if each tick's serialize+delta work must stay
// under TICK_BUDGET_MS at the measured per-room broadcast cost.
const avgBroadcastMs =
  broadcastSamples.reduce((a, b) => a + b, 0) /
  Math.max(1, broadcastSamples.length);
// At remote 32 Hz, half the ticks skip broadcast; amortize.
const amortizedPerRoomPerTickMs =
  avgBroadcastMs / BROADCAST_EVERY_N_TICKS;
const safeRoomsEstimate = Math.max(
  1,
  Math.floor(TICK_BUDGET_MS / Math.max(0.001, amortizedPerRoomPerTickMs)),
);

const report = {
  generatedAt: new Date().toISOString(),
  phase: 5,
  status: "measured_synthetic",
  constants: {
    TICK_RATE,
    BROADCAST_EVERY_N_TICKS,
    KEYFRAME_EVERY_N_BROADCASTS,
    simDeadlineMs: TICK_MS,
    remoteBroadcastHz: BROADCAST_HZ,
  },
  config: {
    rooms: ROOMS,
    seconds: SECONDS,
    tickBudgetMs: TICK_BUDGET_MS,
    totalTicks,
  },
  wallMs: Number(wallMs.toFixed(2)),
  tickMs: {
    avg: Number(avgTick.toFixed(3)),
    p50: Number(percentile(tickSamples, 50).toFixed(3)),
    p95: Number(p95Tick.toFixed(3)),
    p99: Number(p99Tick.toFixed(3)),
    max: Number(maxTick.toFixed(3)),
  },
  broadcastBuildMs: {
    samples: broadcastSamples.length,
    avg: Number(avgBroadcastMs.toFixed(4)),
    p95: Number(percentile(broadcastSamples, 95).toFixed(4)),
    p99: Number(percentile(broadcastSamples, 99).toFixed(4)),
  },
  payload: {
    deltaCount,
    keyframeCount,
    avgBytesPerBroadcast: Number(avgBytesPerBroadcast.toFixed(1)),
    avgDeltaBytes: Number(
      (bytesDelta / Math.max(1, deltaCount)).toFixed(1),
    ),
    avgKeyframeBytes: Number(
      (bytesKeyframe / Math.max(1, keyframeCount)).toFixed(1),
    ),
    bytesPerSecPerMatch: Number(bytesPerSecPerMatch.toFixed(0)),
  },
  capacity: {
    amortizedPerRoomPerTickMs: Number(amortizedPerRoomPerTickMs.toFixed(4)),
    safeRoomsEstimateAtBudget: safeRoomsEstimate,
    note:
      "Synthetic serialize-only estimate (no physics/AI/sockets). Treat as an upper bound; validate with live multi-client soak before depot claims.",
  },
};

const outDir = path.join(ROOT, "client/scripts/perf/out");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "server-room-load-baseline.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${path.relative(ROOT, outPath)}`);

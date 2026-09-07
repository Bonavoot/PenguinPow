#!/usr/bin/env node
/**
 * Two headless Socket.IO clients through the real PvP flow.
 * Reuses client interpolator + movement predictor offline.
 *
 *   node tools/netlab/harness.mjs --url http://127.0.0.1:3999 --room "Room 1" --seconds 25
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { SnapshotInterpolator } from "../../client/src/net/snapshotInterpolator.js";
import { MovementPredictor } from "../../client/src/prediction/movementPredictor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { io } = require(path.join(ROOT, "client/node_modules/socket.io-client"));
const proto = require(path.join(ROOT, "server-io/netProtocol.json"));

const KEYS0 = {
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

const LIFECYCLE = [
  "initial_game_start",
  "game_start",
  "game_over",
  "match_over",
  "power_up_selection_start",
  "power_ups_revealed",
  "opponent_reconnecting",
  "match_resumed",
  "match_abandoned",
  "server_shutdown",
  "protocol_mismatch",
];

export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function meanStd(values) {
  if (!values.length) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    url: "http://127.0.0.1:3001",
    room: "Room 1",
    seconds: 25,
    rttHint: 0,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--url") opts.url = next;
    else if (a === "--room") opts.room = next;
    else if (a === "--seconds") opts.seconds = Number(next);
    else if (a === "--rtt") opts.rttHint = Number(next);
    else continue;
    i++;
  }
  return opts;
}

function scriptedKeys(elapsedMs, side) {
  // Walk toward center, then slap / grab / slide in a loop that stays on the dohyo.
  const cycle = elapsedMs % 4000;
  const toward = side === "p1" ? "d" : "a";
  const away = side === "p1" ? "a" : "d";
  const keys = { ...KEYS0 };
  if (cycle < 1400) {
    keys[toward] = true;
  } else if (cycle < 1650) {
    keys[toward] = true;
    keys.mouse1 = true;
  } else if (cycle < 2200) {
    keys[away] = true;
  } else if (cycle < 2500) {
    keys.mouse2 = true;
  } else if (cycle < 3200) {
    keys[toward] = true;
  } else if (cycle < 3600) {
    keys[toward] = true;
    keys.shift = true;
  } else {
    keys[away] = true;
  }
  return keys;
}

function edgesFrom(prev, next, t) {
  const events = [];
  for (const k of Object.keys(KEYS0)) {
    if (!!prev[k] !== !!next[k]) events.push({ k, a: next[k] ? "down" : "up", t });
  }
  return events;
}

function mergeFighter(prev, delta, isKeyframe) {
  if (!delta) return prev;
  if (isKeyframe || !prev) return { ...delta };
  return Object.assign(prev, delta);
}

/**
 * One headless client. hello → acked join_room → ready → pre_match_complete
 * → first offered power-up each round → scripted fighter_action with seq + events.
 */
export function makeClient(url, name, roomId) {
  const socket = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  const c = {
    name,
    roomId,
    socket,
    playerId: null,
    token: null,
    seq: 0,
    slot: null, // 1 | 2
    p1: null,
    p2: null,
    keys: { ...KEYS0 },
    sentAt: new Map(),
    pendingAck: [],
    ackLatencies: [],
    arrivals: [],
    interArrival: [],
    lastArrival: null,
    lastSeq: null,
    seqGaps: 0,
    foreignRoom: 0,
    seenRoomIds: new Set(),
    bytesIn: 0,
    lifecycle: [],
    remoteInterp: new SnapshotInterpolator(),
    localInterp: new SnapshotInterpolator(),
    predictor: new MovementPredictor(),
    renderSamples: [],
    lastRenderX: null,
    lastRenderT: null,
    lastSegmentDx: null,
    reverseStreak: 0,
    delaySamples: [],
    reversals: 0,
    predErrors: [],
    connected: false,
    gameStarted: false,
    abandoned: false,
    lastSnapAt: 0,
  };

  c.hello = () =>
    new Promise((resolve) =>
      socket.emit("hello", { protocolVersion: proto.PROTOCOL_VERSION }, resolve)
    );

  c.waitFor = (ev, ms = 25000) =>
    new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error(`${name}: timeout ${ev}`)), ms);
      socket.once(ev, (p) => {
        clearTimeout(to);
        resolve(p);
      });
    });

  c.send = (keys, events = []) => {
    const now = performance.now();
    c.seq += 1;
    const packet = {
      id: c.playerId,
      keys: { ...KEYS0, ...keys },
      events,
      seq: c.seq,
      clientSynced: false,
      clientOffset: 0,
      clientRtt: 0,
    };
    c.sentAt.set(c.seq, now);
    c.pendingAck.push({ seq: c.seq, sentAt: now });
    if (c.sentAt.size > 256) c.sentAt.delete(c.sentAt.keys().next().value);
    socket.emit("fighter_action", packet);
    c.keys = packet.keys;
    return c.seq;
  };

  socket.io.engine.on("packet", (packet) => {
    if (packet.data) c.bytesIn += Buffer.byteLength(String(packet.data));
  });

  socket.on("connect", () => {
    c.connected = true;
  });

  socket.on("fighter_action", (d) => {
    const now = performance.now();
    if (d && d.roomId != null) {
      c.seenRoomIds.add(d.roomId);
      if (d.roomId !== roomId) c.foreignRoom++;
    }
    const kf = !!(d && (d.isKeyframe || d.isResync));
    c.p1 = mergeFighter(c.p1, d.player1, kf || !c.p1);
    c.p2 = mergeFighter(c.p2, d.player2, kf || !c.p2);

    if (c.lastArrival != null) c.interArrival.push(now - c.lastArrival);
    c.lastArrival = now;
    c.lastSnapAt = now;
    if (typeof d.seq === "number") {
      if (c.lastSeq != null && d.seq > c.lastSeq + 1) c.seqGaps += d.seq - c.lastSeq - 1;
      c.lastSeq = d.seq;
    }
    c.arrivals.push({ t: now, seq: d.seq, sim: d.simTime, roomId: d.roomId ?? null });

    const local = c.slot === 1 ? c.p1 : c.slot === 2 ? c.p2 : null;
    const remote = c.slot === 1 ? c.p2 : c.slot === 2 ? c.p1 : null;
    const ack = local && typeof local.inputSeqAck === "number" ? local.inputSeqAck : null;
    if (ack != null) {
      while (c.pendingAck.length && c.pendingAck[0].seq <= ack) {
        const item = c.pendingAck.shift();
        c.ackLatencies.push(now - item.sentAt);
      }
    }

    const simT = typeof d.simTime === "number" ? d.simTime : null;
    if (remote && typeof remote.x === "number" && typeof remote.y === "number") {
      c.remoteInterp.push(now, simT, remote.x, remote.y);
    }
    if (local && typeof local.x === "number" && typeof local.y === "number") {
      c.localInterp.push(now, simT, local.x, local.y);
      c.predictor.onServerSnapshot(local, now, 0, simT, (seq) => c.sentAt.get(seq));
      if (typeof c.predictor.lastError === "number") {
        c.predErrors.push(Math.abs(c.predictor.lastError));
      }
    }
  });

  for (const ev of LIFECYCLE) {
    socket.on(ev, (p) => {
      c.lifecycle.push({ t: performance.now(), ev, p });
      if (ev === "game_start") c.gameStarted = true;
      if (ev === "match_abandoned") c.abandoned = true;
      if (ev === "game_over" || ev === "match_over") c.gameStarted = false;
    });
  }

  socket.on("initial_game_start", (p) => {
    const me = p && p.players && p.players.find((x) => x.id === c.playerId);
    if (me) c.slot = me.fighter === "player 2" || me.fighter === "player2" ? 2 : 1;
    if (c.slot == null && p && p.players) {
      c.slot = p.players[0] && p.players[0].id === c.playerId ? 1 : 2;
    }
  });

  socket.on("power_up_selection_start", (data) => {
    const offered = (data && data.availablePowerUps) || [];
    if (offered[0]) {
      socket.emit("power_up_selected", { roomId, powerUpType: offered[0] });
    }
  });

  return c;
}

function sampleRenderer(client, now) {
  const remote = client.slot === 1 ? client.p2 : client.slot === 2 ? client.p1 : null;
  const local = client.slot === 1 ? client.p1 : client.slot === 2 ? client.p2 : null;
  const p = client.remoteInterp.sample(now);
  const localP = client.localInterp.sample(now);
  client.delaySamples.push(client.remoteInterp.delayMs);
  if (local && client.gameStarted) {
    const serverX = localP ? localP.x : local.x;
    client.predictor.update(now, client.keys, local, remote, true, serverX);
  }
  if (!p) return;
  if (client.lastRenderX != null && client.lastRenderT != null) {
    const dt = now - client.lastRenderT;
    if (dt > 0) {
      const speed = (p.x - client.lastRenderX) / dt;
      client.renderSamples.push(speed);
      // Opposite the *bracketing* server segment — not the newest pair, which
      // has already turned around while the playhead is still on the old one.
      const rendDx = p.x - client.lastRenderX;
      const seg = p.segmentDx;
      const prevSeg = client.lastSegmentDx;
      // A reversal is a backwards blip while the server path is still going
      // the same way — not a fighter turning around (segment sign change).
      const opposing =
        typeof seg === "number" &&
        typeof prevSeg === "number" &&
        Math.abs(seg) > 1.5 &&
        Math.abs(prevSeg) > 1.5 &&
        Math.abs(rendDx) > 0.8 &&
        Math.abs(seg) < 50 &&
        seg * prevSeg > 0 &&
        seg * rendDx < 0;
      if (opposing) {
        client.reverseStreak++;
        if (client.reverseStreak === 2) client.reversals++;
      } else {
        client.reverseStreak = 0;
      }
      if (typeof seg === "number") client.lastSegmentDx = seg;
    }
  }
  client.lastRenderX = p.x;
  client.lastRenderT = now;
}

export function summarizeClient(c, durationMs, rttHint = 0) {
  const acks = [...c.ackLatencies].sort((a, b) => a - b);
  const ias = [...c.interArrival].sort((a, b) => a - b);
  const delaySorted = [...c.delaySamples].sort((a, b) => a - b);
  const settledDelay = percentile(delaySorted, 0.5);
  const speed = meanStd(c.renderSamples);
  const minutes = Math.max(durationMs / 60000, 1 / 60);
  const lastSnapAge = c.lastSnapAt ? performance.now() - c.lastSnapAt : Infinity;
  const completed =
    c.gameStarted &&
    !c.abandoned &&
    c.arrivals.length > 20 &&
    lastSnapAge < 4000 &&
    c.foreignRoom === 0;
  return {
    name: c.name,
    roomId: c.roomId,
    completed,
    gameStarted: c.gameStarted,
    abandoned: c.abandoned,
    snapshots: c.arrivals.length,
    ackP50: percentile(acks, 0.5),
    ackP95: percentile(acks, 0.95),
    iaP99: percentile(ias, 0.99),
    interpDelay: settledDelay != null ? settledDelay : c.remoteInterp.delayMs,
    renderSpeedStd: speed.std,
    reversals: c.reversals,
    hardSnaps: c.predictor.stats.hardSnaps || 0,
    hardSnapsPerMin: (c.predictor.stats.hardSnaps || 0) / minutes,
    predErrorP95: percentile([...c.predErrors].sort((a, b) => a - b), 0.95),
    kbps: durationMs > 0 ? c.bytesIn / 1024 / (durationMs / 1000) : 0,
    seqGaps: c.seqGaps,
    foreignRoom: c.foreignRoom,
    seenRoomIds: [...c.seenRoomIds],
    lifecycle: c.lifecycle.map((e) => e.ev),
    rttHint,
    delays: delaySorted,
  };
}

/**
 * Play one 1v1 match. Resolves with per-client summaries + combined flags.
 */
export async function runMatch({
  url,
  roomId = "Room 1",
  seconds = 25,
  rttHint = 0,
  colors = ["#DA1B44", "#4169E1"],
} = {}) {
  const durationMs = seconds * 1000;
  const a = makeClient(url, "A", roomId);
  const b = makeClient(url, "B", roomId);

  try {
    await Promise.all([
      new Promise((r, j) => {
        a.socket.once("connect", r);
        a.socket.once("connect_error", j);
        setTimeout(() => j(new Error("A connect timeout")), 8000);
      }),
      new Promise((r, j) => {
        b.socket.once("connect", r);
        b.socket.once("connect_error", j);
        setTimeout(() => j(new Error("B connect timeout")), 8000);
      }),
    ]);

    const ackA = await a.hello();
    const ackB = await b.hello();
    if (!ackA || !ackA.ok) throw new Error(`A hello failed: ${JSON.stringify(ackA)}`);
    if (!ackB || !ackB.ok) throw new Error(`B hello failed: ${JSON.stringify(ackB)}`);
    a.playerId = ackA.playerId;
    a.token = ackA.token;
    b.playerId = ackB.playerId;
    b.token = ackB.token;

    const joinA = await new Promise((resolve) =>
      a.socket.emit("join_room", { roomId, mawashiColor: colors[0], gearIds: [] }, resolve)
    );
    if (!joinA || !joinA.ok) throw new Error(`A join_room failed: ${JSON.stringify(joinA)}`);
    const joinB = await new Promise((resolve) =>
      b.socket.emit("join_room", { roomId, mawashiColor: colors[1], gearIds: [] }, resolve)
    );
    if (!joinB || !joinB.ok) throw new Error(`B join_room failed: ${JSON.stringify(joinB)}`);

    const igs = Promise.all([a.waitFor("initial_game_start"), b.waitFor("initial_game_start")]);
    a.socket.emit("ready_count", { roomId, isReady: true });
    b.socket.emit("ready_count", { roomId, isReady: true });
    await igs;

    a.socket.emit("pre_match_complete", { roomId });
    b.socket.emit("pre_match_complete", { roomId });
    await Promise.all([a.waitFor("game_start", 35000), b.waitFor("game_start", 35000)]);

    const t0 = performance.now();
    let lastEmit = 0;
    const fightUntil = t0 + durationMs;
    while (performance.now() < fightUntil) {
      const now = performance.now();
      const elapsed = now - t0;
      if (now - lastEmit >= 16) {
        lastEmit = now;
        const ka = scriptedKeys(elapsed, a.slot === 2 ? "p2" : "p1");
        const kb = scriptedKeys(elapsed, b.slot === 2 ? "p2" : "p1");
        const evA = edgesFrom(a.keys, ka, now);
        const evB = edgesFrom(b.keys, kb, now);
        if (a.socket.connected) a.send(ka, evA);
        if (b.socket.connected) b.send(kb, evB);
      }
      sampleRenderer(a, now);
      sampleRenderer(b, now);
      await sleep(8);
    }

    const sumA = summarizeClient(a, durationMs, rttHint);
    const sumB = summarizeClient(b, durationMs, rttHint);
    return {
      roomId,
      completed: sumA.completed && sumB.completed,
      a: sumA,
      b: sumB,
      foreignRoom: sumA.foreignRoom + sumB.foreignRoom,
      seqGaps: sumA.seqGaps + sumB.seqGaps,
    };
  } finally {
    a.socket.close();
    b.socket.close();
  }
}

function isMain() {
  const here = new URL(import.meta.url).pathname;
  const entry = process.argv[1] ? String(process.argv[1]).replaceAll("\\", "/") : "";
  return entry.endsWith("harness.mjs");
}

if (isMain()) {
  const opts = parseArgs();
  const result = await runMatch({
    url: opts.url,
    roomId: opts.room,
    seconds: opts.seconds,
    rttHint: opts.rttHint,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.completed ? 0 : 1);
}

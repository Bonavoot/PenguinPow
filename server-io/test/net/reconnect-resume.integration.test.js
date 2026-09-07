"use strict";

/**
 * End-to-end: REAL server process (index.js on an ephemeral port), TWO real
 * socket.io clients through the real PvP flow, then a transport drop on one
 * client mid-bout. Proves — over actual sockets — that:
 *   - the opponent is told (opponent_reconnecting) and the bout is frozen
 *     (simTime does not advance while held);
 *   - a new socket with the session token resumes the SAME player into the
 *     SAME room (hello ack resumed:true, match_resumed to both);
 *   - the first post-resume packet is a keyframe and inputs from the new
 *     socket are consumed (inputSeqAck advances);
 *   - a protocol-version mismatch is rejected explicitly.
 *
 * socket.io-client is not a server-io dependency; like scripts/liveRoomSoak.mjs
 * this borrows the client's copy and skips (not fails) when it is absent.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const net = require("net");

const ROOT = path.resolve(__dirname, "../../..");
const CLIENT_SIO = path.join(ROOT, "client/node_modules/socket.io-client");
const proto = require("../../../shared/netProtocol.json");

const hasClient = fs.existsSync(CLIENT_SIO);
const { io } = hasClient ? require(CLIENT_SIO) : { io: null };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS0 = { w: false, a: false, s: false, d: false, " ": false, shift: false, e: false, f: false, mouse1: false, mouse2: false };

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

async function waitHealthy(url, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url + "/health");
      if (r.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("server not healthy");
}

/** Minimal protocol-v2 client mirroring client/src/lib/serverConnection.js. */
function makeClient(url, name) {
  const socket = io(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  const c = { name, socket, playerId: null, token: null, seq: 0, fighter: null, snaps: [], events: [], p1: null, p2: null };
  c.hello = (resumeToken) =>
    new Promise((resolve) => socket.emit("hello", { protocolVersion: proto.PROTOCOL_VERSION, resumeToken }, resolve));
  c.waitFor = (ev, ms = 20000) =>
    new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error(`${name}: timeout ${ev}`)), ms);
      socket.once(ev, (p) => {
        clearTimeout(to);
        resolve(p);
      });
    });
  c.send = (keys) => socket.emit("fighter_action", { id: c.playerId, keys: { ...KEYS0, ...keys }, events: [], seq: ++c.seq });
  socket.on("fighter_action", (d) => {
    if (d.isKeyframe || d.isResync || !c.p1) {
      c.p1 = { ...(d.player1 || {}) };
      c.p2 = { ...(d.player2 || {}) };
    } else {
      Object.assign(c.p1, d.player1 || {});
      Object.assign(c.p2, d.player2 || {});
    }
    c.snaps.push({ t: Date.now(), seq: d.seq, sim: d.simTime, kf: !!d.isKeyframe, p1ack: c.p1.inputSeqAck, p2ack: c.p2.inputSeqAck });
  });
  for (const ev of ["opponent_reconnecting", "match_resumed", "opponent_disconnected", "game_start", "initial_game_start", "power_up_selection_start"]) {
    socket.on(ev, (p) => c.events.push({ t: Date.now(), ev, p }));
  }
  socket.on("initial_game_start", (p) => {
    const me = p && p.players && p.players.find((x) => x.id === c.playerId);
    c.fighter = me ? me.fighter : null;
  });
  return c;
}

describe("reconnect/resume over real sockets", { skip: !hasClient && "socket.io-client not installed under client/node_modules" }, () => {
  let server, port, url;

  before(async () => {
    port = await freePort();
    url = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ["index.js"], {
      cwd: path.join(ROOT, "server-io"),
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "ignore", "pipe"],
    });
    server.stderr.on("data", () => {});
    await waitHealthy(url);
  });

  after(async () => {
    if (server) {
      server.kill("SIGTERM");
      await sleep(200);
      try {
        server.kill("SIGKILL");
      } catch {}
    }
  });

  it("rejects a protocol mismatch explicitly and disconnects", async () => {
    const s = io(url, { transports: ["websocket"], forceNew: true, reconnection: false });
    await new Promise((r) => s.once("connect", r));
    const ack = await new Promise((resolve) => s.emit("hello", { protocolVersion: proto.PROTOCOL_VERSION + 1 }, resolve));
    assert.equal(ack.ok, false);
    assert.equal(ack.reason, "protocol_mismatch");
    await new Promise((r) => s.once("disconnect", r));
    s.close();
  });

  it("drop → hold (frozen) → resume with token → same fighter, keyframe, inputs consumed", async () => {
    const a = makeClient(url, "A");
    const b = makeClient(url, "B");
    await Promise.all([new Promise((r) => a.socket.once("connect", r)), new Promise((r) => b.socket.once("connect", r))]);
    const ackA = await a.hello();
    const ackB = await b.hello();
    assert.equal(ackA.ok, true);
    assert.equal(ackB.ok, true);
    a.playerId = ackA.playerId; a.token = ackA.token;
    b.playerId = ackB.playerId; b.token = ackB.token;

    // real PvP flow
    const roomId = "Room 1";
    a.socket.emit("join_room", { roomId, mawashiColor: "#DA1B44", gearIds: [] });
    await sleep(50);
    b.socket.emit("join_room", { roomId, mawashiColor: "#4169E1", gearIds: [] });
    await sleep(50);
    const igs = Promise.all([a.waitFor("initial_game_start"), b.waitFor("initial_game_start")]);
    a.socket.emit("ready_count", { roomId, isReady: true });
    b.socket.emit("ready_count", { roomId, isReady: true });
    await igs;
    const pus = Promise.all([a.waitFor("power_up_selection_start"), b.waitFor("power_up_selection_start")]);
    // every human reports its preload done (the server waits for all, capped)
    a.socket.emit("pre_match_complete", { roomId });
    b.socket.emit("pre_match_complete", { roomId });
    const [puA, puB] = await pus;
    a.socket.emit("power_up_selected", { roomId, powerUpType: puA.availablePowerUps[0] });
    b.socket.emit("power_up_selected", { roomId, powerUpType: puB.availablePowerUps[0] });
    await Promise.all([a.waitFor("game_start", 30000), b.waitFor("game_start", 30000)]);

    // fight a little so state is non-trivial
    for (let i = 0; i < 10; i++) {
      a.send({ d: true });
      b.send({ a: true });
      await sleep(40);
    }
    a.send({});
    b.send({});
    await sleep(120);
    assert.ok(a.snaps.length > 5 && b.snaps.length > 5, "both clients receive the state stream");
    const ackBeforeDrop = b.p1.inputSeqAck;
    assert.ok(ackBeforeDrop >= 1, "server acked A's inputs before the drop");

    // --- transport drop on A ---
    const dropAt = Date.now();
    a.socket.io.engine.close(); // hard transport close, no leave_room
    const notice = await b.waitFor("opponent_reconnecting", 5000);
    assert.equal(notice.playerId, a.playerId);
    assert.equal(notice.graceMs, proto.RECONNECT_GRACE_MS);
    const detectMs = Date.now() - dropAt;
    assert.ok(detectMs < 2000, `opponent told within 2s (was ${detectMs}ms)`);

    // bout is frozen: B receives no snapshots and simTime does not advance
    const bSnapsAtHold = b.snaps.length;
    const simAtHold = b.snaps[b.snaps.length - 1].sim;
    await sleep(700);
    assert.equal(b.snaps.length, bSnapsAtHold, "no broadcasts while held");

    // --- A comes back on a NEW socket with its token ---
    const a2 = makeClient(url, "A2");
    await new Promise((r) => a2.socket.once("connect", r));
    const resumedAt = Promise.all([a2.waitFor("match_resumed", 5000), b.waitFor("match_resumed", 5000)]);
    const ack2 = await a2.hello(a.token);
    assert.equal(ack2.ok, true);
    assert.equal(ack2.resumed, true);
    assert.equal(ack2.playerId, a.playerId, "same fighter identity");
    assert.equal(ack2.roomId, roomId);
    await resumedAt;
    a2.playerId = a.playerId;
    a2.seq = a.seq; // the real facade keeps its per-session counter across sockets

    await sleep(150);
    const firstAfter = b.snaps[bSnapsAtHold];
    assert.ok(firstAfter, "stream resumed for the opponent");
    assert.equal(firstAfter.kf, true, "first post-resume packet is a keyframe");
    // the held period contributed at most a couple of already-in-flight ticks
    assert.ok(firstAfter.sim - simAtHold < 200, `sim advanced ${firstAfter.sim - simAtHold}ms during a ~1s hold`);
    assert.ok(a2.snaps.length > 0 && a2.snaps[0].kf, "resumed client starts from a keyframe");

    // the new socket drives the same fighter: acked seq advances past the pre-drop value
    for (let i = 0; i < 6; i++) {
      a2.send({ a: true });
      await sleep(40);
    }
    await sleep(120);
    const ackAfter = b.p1.inputSeqAck;
    assert.ok(ackAfter > ackBeforeDrop, `inputs from the resumed socket are consumed (${ackBeforeDrop} → ${ackAfter})`);
    assert.equal(b.events.filter((e) => e.ev === "opponent_disconnected").length, 0, "no forfeit was triggered");

    a2.socket.close();
    b.socket.close();
    a.socket.close();
  });
});

"use strict";

/**
 * Net session layer — protocol gate, identity binding, input seq contract,
 * reconnect hold / resume. Exercises the REAL socket handlers with fake
 * sockets and a minimal io stub; no network.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const proto = require("../../../shared/netProtocol.json");
const {
  SessionStore,
  attachHello,
  getSocketPlayerId,
  shouldHoldOnDisconnect,
  beginReconnectHold,
  resumeHeldPlayer,
  isRoomHeldForReconnect,
  acceptInputSeq,
  noteInputConsumed,
  PROTOCOL_VERSION,
  EVENTS,
  _telemetry,
} = require("../../netSession");
const { registerSocketHandlers, processInputPacket } = require("../../socketHandlers");
const { setSimRoomResolver, timeoutManager, gameNow } = require("../../gameUtils");
const { createInitialPlayerState, PLAYER_1_SPAWN, PLAYER_2_SPAWN } = require("../../playerFactory");

// ---------------------------------------------------------------- fakes
function fakeIo() {
  const events = [];
  const sockets = new Map();
  const target = (to) => ({
    emit(ev, payload) {
      events.push({ to, ev, payload });
    },
  });
  return {
    events,
    sockets: { sockets },
    to: target,
    in: target,
    emit(ev, payload) {
      events.push({ to: "*", ev, payload });
    },
    find(ev, to) {
      return events.filter((e) => e.ev === ev && (to === undefined || e.to === to));
    },
  };
}

function fakeSocket(id) {
  const handlers = new Map();
  const s = {
    id,
    connected: true,
    data: {},
    rooms: new Set(),
    emitted: [],
    handshake: { session: { save() {} } },
    on(ev, fn) {
      handlers.set(ev, fn);
      return s;
    },
    emit(ev, payload) {
      s.emitted.push({ ev, payload });
    },
    join(r) {
      s.rooms.add(r);
    },
    leave(r) {
      s.rooms.delete(r);
    },
    disconnect() {
      s.connected = false;
      s.disconnected = true;
    },
    fire(ev, data, ack) {
      const fn = handlers.get(ev);
      if (!fn) throw new Error("no handler for " + ev);
      return fn(data, ack);
    },
  };
  return s;
}

function makeRoom(id = "Room 1") {
  return {
    id,
    players: [],
    readyCount: 0,
    rematchCount: 0,
    gameStart: false,
    gameOver: false,
    matchOver: false,
    readyStartTime: null,
    roundStartTimer: null,
    hakkiyoiCount: 0,
    teWoTsuiteSent: false,
    powerUpSelectionPhase: false,
    opponentDisconnected: false,
    disconnectedDuringGame: false,
    hitstopUntil: 0,
    previousPlayerStates: [null, null],
    lastScreenShakeTime: 0,
  };
}

/** Wire a socket exactly like index.js does on "connection". */
function connect(env, socketId) {
  const socket = fakeSocket(socketId);
  socket.data.detachSession = attachHello(socket, {
    io: env.io,
    store: env.store,
    findRoomForPlayer: (pid) => env.roomsByPlayer.get(pid) || null,
  });
  registerSocketHandlers(socket, env.io, env.rooms, {
    registerPlayerInMaps: (p, room) => env.roomsByPlayer.set(p.id, room),
    unregisterPlayerFromMaps: (pid) => env.roomsByPlayer.delete(pid),
    sessionStore: env.store,
  });
  env.io.sockets.sockets.set(socket.id, socket);
  return socket;
}

function hello(socket, payload) {
  let ack = null;
  socket.fire(EVENTS.HELLO, payload, (a) => (ack = a));
  return ack;
}

function makeEnv() {
  const env = {
    io: fakeIo(),
    store: new SessionStore(),
    rooms: [makeRoom()],
    roomsByPlayer: new Map(),
  };
  setSimRoomResolver((pid) => env.roomsByPlayer.get(pid) || null);
  return env;
}

function seatTwo(env) {
  const a = connect(env, "sockA");
  const b = connect(env, "sockB");
  const ackA = hello(a, { protocolVersion: PROTOCOL_VERSION });
  const ackB = hello(b, { protocolVersion: PROTOCOL_VERSION });
  a.fire("join_room", { roomId: "Room 1", socketId: "SPOOFED", mawashiColor: "#111111", gearIds: [] });
  b.fire("join_room", { roomId: "Room 1", socketId: "SPOOFED", mawashiColor: "#222222", gearIds: [] });
  return { a, b, ackA, ackB, room: env.rooms[0] };
}

afterEach(() => {
  setSimRoomResolver(null);
  timeoutManager.clearAll();
});

// ---------------------------------------------------------------- tests
describe("hello: protocol gate + identity", () => {
  let env;
  beforeEach(() => {
    env = makeEnv();
  });

  it("issues a fresh identity for a matching protocol version", () => {
    const s = connect(env, "s1");
    const ack = hello(s, { protocolVersion: PROTOCOL_VERSION });
    assert.equal(ack.ok, true);
    assert.match(ack.playerId, /^p_[0-9a-f]{16}$/);
    assert.ok(ack.token.length >= 24);
    assert.equal(ack.resumed, false);
    assert.equal(ack.protocolVersion, PROTOCOL_VERSION);
    assert.equal(getSocketPlayerId(s), ack.playerId);
    // targeted emits reach the socket through a room named by the stable id
    assert.ok(s.rooms.has(ack.playerId));
  });

  it("rejects a mismatched protocol version and never binds an identity", () => {
    const s = connect(env, "s1");
    const before = _telemetry.protocolMismatches;
    const ack = hello(s, { protocolVersion: PROTOCOL_VERSION - 1 });
    assert.equal(ack.ok, false);
    assert.equal(ack.reason, "protocol_mismatch");
    assert.equal(ack.serverVersion, PROTOCOL_VERSION);
    assert.equal(getSocketPlayerId(s), null);
    assert.equal(_telemetry.protocolMismatches, before + 1);
  });

  it("rejects a hello with no version (legacy client shape)", () => {
    const s = connect(env, "s1");
    const ack = hello(s, {});
    assert.equal(ack.ok, false);
    assert.equal(getSocketPlayerId(s), null);
  });

  it("unauthenticated sockets cannot join a room and get an explicit failure", () => {
    const s = connect(env, "s1");
    s.fire("join_room", { roomId: "Room 1", socketId: "s1" });
    assert.equal(env.rooms[0].players.length, 0);
    const fail = s.emitted.find((e) => e.ev === "join_room_failed");
    assert.ok(fail);
    assert.equal(fail.payload.reason, "unauthenticated");
  });

  it("resumes identity by token on a new socket; a bad token gets a fresh identity", () => {
    const s1 = connect(env, "s1");
    const ack1 = hello(s1, { protocolVersion: PROTOCOL_VERSION });
    s1.disconnect();
    s1.fire("disconnect", "transport close");
    const s2 = connect(env, "s2");
    const ack2 = hello(s2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ack1.token });
    assert.equal(ack2.playerId, ack1.playerId);
    assert.equal(ack2.token, ack1.token);
    const s3 = connect(env, "s3");
    const ack3 = hello(s3, { protocolVersion: PROTOCOL_VERSION, resumeToken: "not-a-real-token-at-all-000000" });
    assert.notEqual(ack3.playerId, ack1.playerId);
  });

  it("newest connection wins: resuming while the old socket is alive evicts it", () => {
    const s1 = connect(env, "s1");
    const ack1 = hello(s1, { protocolVersion: PROTOCOL_VERSION });
    const s2 = connect(env, "s2");
    const ack2 = hello(s2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ack1.token });
    assert.equal(ack2.playerId, ack1.playerId);
    assert.equal(s1.disconnected, true);
    assert.equal(getSocketPlayerId(s1), null);
    assert.equal(getSocketPlayerId(s2), ack1.playerId);
  });

  it("store sweep drops idle detached room-less sessions only", () => {
    let now = 1_000_000;
    const store = new SessionStore({ now: () => now, idleTtlMs: 1000 });
    const idle = store.issue();
    const inRoom = store.issue();
    inRoom.roomId = "Room 1";
    const attached = store.issue();
    attached.socketId = "x";
    now += 5000;
    assert.equal(store.sweep(), 1);
    assert.equal(store.get(idle.playerId), null);
    assert.ok(store.get(inRoom.playerId));
    assert.ok(store.get(attached.playerId));
  });
});

describe("handlers bind to the session identity, never to client-supplied ids", () => {
  let env;
  beforeEach(() => {
    env = makeEnv();
  });

  it("join_room seats the SESSION id and ignores data.socketId", () => {
    const { ackA, ackB, room } = seatTwo(env);
    assert.deepEqual(
      room.players.map((p) => p.id),
      [ackA.playerId, ackB.playerId]
    );
    assert.ok(!room.players.some((p) => p.id === "SPOOFED"));
  });

  it("a third joiner is rejected instead of leaking room broadcasts", () => {
    seatTwo(env);
    const c = connect(env, "sockC");
    hello(c, { protocolVersion: PROTOCOL_VERSION });
    let ackC = null;
    c.fire("join_room", { roomId: "Room 1", socketId: "x" }, (a) => (ackC = a));
    assert.equal(env.rooms[0].players.length, 2);
    assert.equal(ackC.ok, false);
    assert.equal(ackC.reason, "Room is full");
    assert.ok(c.emitted.find((e) => e.ev === "join_room_failed"));
    assert.ok(c.emitted.find((e) => e.ev === "rooms"), "browsing client gets a fresh room list");
    assert.ok(!c.rooms.has("Room 1"));
  });

  it("joining an unknown room does not throw", () => {
    const a = connect(env, "sockA");
    hello(a, { protocolVersion: PROTOCOL_VERSION });
    assert.doesNotThrow(() => a.fire("join_room", { roomId: "Room 99", socketId: "x" }));
    assert.equal(a.emitted.find((e) => e.ev === "join_room_failed").payload.reason, "Room not found");
  });

  it("ready_count cannot ready the OTHER player via data.playerId", () => {
    const { a, ackA, ackB, room } = seatTwo(env);
    a.fire("ready_count", { roomId: "Room 1", playerId: ackB.playerId, isReady: true });
    const pa = room.players.find((p) => p.id === ackA.playerId);
    const pb = room.players.find((p) => p.id === ackB.playerId);
    assert.equal(pa.isReady, true, "the sender readied");
    assert.ok(!pb.isReady, "the spoofed target did not");
    assert.equal(room.readyCount, 1);
  });

  it("power_up_selected only accepts an OFFERED type for the SENDER, once", () => {
    const { a, b, ackA, ackB, room } = seatTwo(env);
    a.fire("ready_count", { roomId: "Room 1", isReady: true });
    b.fire("ready_count", { roomId: "Room 1", isReady: true });
    a.fire("pre_match_complete", { roomId: "Room 1" });
    assert.equal(room.powerUpSelectionPhase, false, "waits for BOTH humans to finish preloading");
    assert.ok(room.preMatchCapTimer, "…but only up to the cap");
    b.fire("pre_match_complete", { roomId: "Room 1" });
    assert.equal(room.powerUpSelectionPhase, true);
    assert.equal(room.preMatchCapTimer, null);
    const offeredA = room.playerAvailablePowerUps[ackA.playerId];
    const offeredB = room.playerAvailablePowerUps[ackB.playerId];
    // forged type → ignored
    a.fire("power_up_selected", { roomId: "Room 1", playerId: ackA.playerId, powerUpType: "not_a_power_up" });
    assert.ok(!room.players[0].selectedPowerUp);
    // selecting FOR the opponent → applies to sender only
    a.fire("power_up_selected", { roomId: "Room 1", playerId: ackB.playerId, powerUpType: offeredA[0] });
    assert.equal(room.players[0].selectedPowerUp, offeredA[0]);
    assert.ok(!room.players[1].selectedPowerUp);
    // repeat → idempotent
    a.fire("power_up_selected", { roomId: "Room 1", powerUpType: offeredA[1] });
    assert.equal(room.players[0].selectedPowerUp, offeredA[0]);
    b.fire("power_up_selected", { roomId: "Room 1", powerUpType: offeredB[0] });
    assert.equal(Object.keys(room.playersSelectedPowerUps).length, 2);
    if (room.roundStartTimer) clearTimeout(room.roundStartTimer);
    if (room.powerUpNotifyTimer) clearTimeout(room.powerUpNotifyTimer);
  });

  it("rematch_count is one idempotent vote per seated player after match_over", () => {
    const { a, b, room } = seatTwo(env);
    a.fire("rematch_count", { roomId: "Room 1", acceptedRematch: true });
    assert.equal(room.rematchCount, 0, "ignored before match_over");
    room.matchOver = true;
    a.fire("rematch_count", { roomId: "Room 1", acceptedRematch: true });
    a.fire("rematch_count", { roomId: "Room 1", acceptedRematch: true });
    a.fire("rematch_count", { roomId: "Room 1", playerId: "SPOOFED", acceptedRematch: true });
    assert.equal(room.rematchCount, 1, "one player cannot cast two votes");
    b.fire("rematch_count", { roomId: "Room 1", acceptedRematch: true });
    assert.equal(room.matchOver, false, "both votes → rematch");
    assert.ok(env.io.find("rematch", "Room 1").length === 1);
  });
});

describe("fighter_action input sequence contract", () => {
  let env, a, ackA, room, player;
  beforeEach(() => {
    env = makeEnv();
    ({ a, ackA, room } = seatTwo(env));
    player = room.players.find((p) => p.id === ackA.playerId);
    player.inputQueue = [];
  });

  const pkt = (seq, keys = { a: true }) => ({ id: ackA.playerId, keys, events: [], seq });

  it("drops packets without a numeric seq", () => {
    a.fire("fighter_action", { id: ackA.playerId, keys: { a: true }, events: [] });
    assert.equal(player.inputQueue.length, 0);
  });

  it("accepts monotonic seqs and drops duplicates and stale replays", () => {
    a.fire("fighter_action", pkt(1, { a: true }));
    a.fire("fighter_action", pkt(2, { a: false }));
    a.fire("fighter_action", pkt(2, { a: false })); // duplicate
    a.fire("fighter_action", pkt(1, { a: true })); // stale replay of an older key state
    assert.equal(player.inputQueue.length, 2);
    assert.deepEqual(player.inputQueue.map((p) => p.seq), [1, 2]);
    assert.equal(player.inputStaleOrDupCount, 2);
  });

  it("rejects packets whose id claims another player and malformed shapes", () => {
    a.fire("fighter_action", { id: "someone-else", keys: { a: true }, events: [], seq: 1 });
    a.fire("fighter_action", { id: ackA.playerId, keys: "not-an-object", seq: 2 });
    a.fire("fighter_action", { id: ackA.playerId, keys: {}, events: "nope", seq: 3 });
    assert.equal(player.inputQueue.length, 0);
  });

  it("acceptInputSeq / noteInputConsumed: ack echoes the last CONSUMED seq", () => {
    const p = { id: "x" };
    assert.equal(acceptInputSeq(p, { seq: 5 }), true);
    assert.equal(acceptInputSeq(p, { seq: 5 }), false);
    assert.equal(acceptInputSeq(p, { seq: 4 }), false);
    assert.equal(acceptInputSeq(p, { seq: 6 }), true);
    noteInputConsumed(p, { seq: 6 });
    assert.equal(p.inputSeqAck, 6);
  });

  it("drain stamps inputSeqAck on the player even when the sim ignores the packet", () => {
    room.gameOver = true; // sim ignores inputs, but the ack must still advance
    processInputPacket(room, player, pkt(9), env.io, env.rooms);
    assert.equal(player.inputSeqAck, 9);
  });
});

describe("mid-match transport loss → hold → resume / expire", () => {
  let env;
  beforeEach(() => {
    env = makeEnv();
  });

  function seatAndFight() {
    const seated = seatTwo(env);
    seated.room.gameStart = true;
    seated.room.hakkiyoiCount = 1;
    seated.room.simTime = 500_000;
    return seated;
  }

  it("shouldHoldOnDisconnect: only for a live 2-human PvP room that is not already held", () => {
    const { room, ackA } = seatAndFight();
    const player = room.players.find((p) => p.id === ackA.playerId);
    assert.equal(shouldHoldOnDisconnect(room, player), true);
    assert.equal(shouldHoldOnDisconnect({ ...room, isCPURoom: true }, player), false);
    assert.equal(shouldHoldOnDisconnect({ ...room, matchOver: true }, player), false);
    assert.equal(shouldHoldOnDisconnect({ ...room, reconnectHold: { playerId: "other" } }, player), false);
    assert.equal(shouldHoldOnDisconnect({ ...room, gameStart: false, hakkiyoiCount: 0 }, player), false, "lobby drops are not held");
    assert.equal(shouldHoldOnDisconnect(room, { ...player, isCPU: true }), false);
  });

  it("disconnect mid-bout holds the room, tells the opponent, and keeps the player seated", () => {
    const { a, ackA, ackB, room } = seatAndFight();
    const player = room.players.find((p) => p.id === ackA.playerId);
    player.keys = { a: true, d: false, mouse1: true };
    room.hitstopUntil = gameNow() + 60;
    a.disconnect();
    a.fire("disconnect", "transport close");
    assert.ok(room.reconnectHold, "room is held");
    assert.equal(room.reconnectHold.playerId, ackA.playerId);
    assert.equal(isRoomHeldForReconnect(room), true);
    assert.equal(room.players.length, 2, "player NOT removed");
    assert.equal(player.isDisconnected, true);
    assert.equal(player.keys.mouse1, false, "held keys released");
    assert.ok(room.reconnectHold.hitstopRemaining > 0 && room.reconnectHold.hitstopRemaining <= 60);
    const notice = env.io.find(EVENTS.OPPONENT_RECONNECTING, ackB.playerId);
    assert.equal(notice.length, 1);
    assert.equal(notice[0].payload.graceMs, proto.RECONNECT_GRACE_MS);
    assert.equal(env.io.find("opponent_disconnected").length, 0, "no forfeit yet");
    // inputs from anyone are not consumed while held
    const b = env.io.sockets.sockets.get("sockB");
    const pb = room.players.find((p) => p.id === ackB.playerId);
    pb.inputQueue = [];
    b.fire("fighter_action", { id: ackB.playerId, keys: { a: true }, events: [], seq: 1 });
    assert.equal(pb.inputQueue.length, 0);
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
  });

  it("hello with the token during the hold resumes the SAME player into the SAME room", () => {
    const { a, ackA, ackB, room } = seatAndFight();
    const player = room.players.find((p) => p.id === ackA.playerId);
    room.hitstopUntil = gameNow() + 60;
    a.disconnect();
    a.fire("disconnect", "transport close");
    const beforeResume = gameNow();
    const a2 = connect(env, "sockA2");
    const ack2 = hello(a2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ackA.token });
    assert.equal(ack2.ok, true);
    assert.equal(ack2.resumed, true);
    assert.equal(ack2.playerId, ackA.playerId);
    assert.equal(ack2.roomId, "Room 1");
    assert.equal(room.reconnectHold, null);
    assert.equal(player.isDisconnected, false);
    assert.equal(a2.roomId, "Room 1");
    assert.ok(a2.rooms.has("Room 1"));
    assert.ok(a2.rooms.has(ackA.playerId));
    assert.equal(room.forceBroadcast, true, "keyframe forced");
    assert.deepEqual(room.previousPlayerStates, [null, null]);
    assert.ok(room.hitstopUntil >= beforeResume, "interrupted hitstop re-armed");
    assert.equal(env.io.find(EVENTS.MATCH_RESUMED, "Room 1").length, 1);
    // the resumed socket drives the SAME fighter
    player.inputQueue = [];
    a2.fire("fighter_action", { id: ackA.playerId, keys: { d: true }, events: [], seq: 1 });
    assert.equal(player.inputQueue.length, 1);
    assert.ok(ackB.playerId !== ackA.playerId);
  });

  it("grace expiry runs the forfeit path: player removed, opponent told", async () => {
    const { a, ackA, ackB, room } = seatAndFight();
    const player = room.players.find((p) => p.id === ackA.playerId);
    // Drive the hold with a tiny grace so the test stays fast.
    let expired = false;
    beginReconnectHold(room, player, env.io, () => {
      expired = true;
      // the handler's real expiry path is exercised in the next test; here we
      // only assert the hold mechanics
      room.players = room.players.filter((p) => p.id !== ackA.playerId);
    }, 20);
    assert.ok(room.reconnectHold);
    assert.equal(env.io.find(EVENTS.OPPONENT_RECONNECTING, ackB.playerId)[0].payload.graceMs, 20);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(expired, true);
    assert.equal(room.reconnectHold, null);
    assert.equal(room.players.length, 1);
    // a late resume attempt gets identity back but NOT the match
    const a2 = connect(env, "sockA2");
    const ack2 = hello(a2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ackA.token });
    assert.equal(ack2.ok, true);
    assert.equal(ack2.resumed, false);
    assert.equal(ack2.playerId, ackA.playerId);
  });

  it("the full disconnect handler expires into match_abandoned + a clean, joinable lobby", async () => {
    const { a, ackA, ackB, room } = seatAndFight();
    // shrink the grace via the module constant the handler reads
    const realTimeout = global.setTimeout;
    const calls = [];
    global.setTimeout = (fn, ms, ...rest) => {
      calls.push(ms);
      return realTimeout(fn, ms === proto.RECONNECT_GRACE_MS ? 20 : ms, ...rest);
    };
    try {
      a.disconnect();
      a.fire("disconnect", "transport close");
      assert.ok(room.reconnectHold);
      await new Promise((r) => realTimeout(r, 80));
    } finally {
      global.setTimeout = realTimeout;
    }
    assert.equal(room.reconnectHold, null);
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].id, ackB.playerId);
    // No "room unavailable" limbo: the survivor is host of a clean lobby.
    assert.equal(room.opponentDisconnected, false);
    assert.equal(room.gameStart, false);
    assert.equal(room.hakkiyoiCount, 0);
    assert.equal(room.players[0].fighter, "player 1");
    assert.equal(room.players[0].isReady, false);
    const ab = env.io.find(EVENTS.MATCH_ABANDONED, "Room 1");
    assert.equal(ab.length, 1);
    assert.equal(ab[0].payload.reason, "disconnected");
    assert.equal(ab[0].payload.leaverId, ackA.playerId);
    assert.equal(ab[0].payload.winnerId, ackB.playerId);
    assert.equal(env.io.find("opponent_disconnected").length, 0, "legacy limbo event is gone");
    assert.equal(env.store.get(ackA.playerId).roomId, null);
    // Room is immediately joinable by a third player.
    const c = connect(env, "sockC");
    hello(c, { protocolVersion: PROTOCOL_VERSION });
    let ackJoin = null;
    c.fire("join_room", { roomId: "Room 1" }, (a) => (ackJoin = a));
    assert.equal(ackJoin.ok, true);
    assert.equal(room.players.length, 2);
  });

  it("an INTENTIONAL disconnect mid-bout is not held: immediate match_abandoned('left')", () => {
    const { a, ackA, ackB, room } = seatAndFight();
    a.disconnect();
    a.fire("disconnect", "client namespace disconnect");
    assert.ok(!room.reconnectHold, "no hold for a deliberate leave");
    const ab = env.io.find(EVENTS.MATCH_ABANDONED, "Room 1");
    assert.equal(ab.length, 1);
    assert.equal(ab[0].payload.reason, "left");
    assert.equal(ab[0].payload.winnerId, ackB.playerId);
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].id, ackB.playerId);
    assert.equal(env.store.get(ackA.playerId).roomId, null);
  });

  it("leave_room mid-bout abandons immediately and re-seats the survivor as host", () => {
    const { a, ackA, ackB, room } = seatAndFight();
    a.fire("leave_room", { roomId: "Room 1" });
    const ab = env.io.find(EVENTS.MATCH_ABANDONED, "Room 1");
    assert.equal(ab.length, 1);
    assert.equal(ab[0].payload.reason, "left");
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].id, ackB.playerId);
    assert.equal(room.players[0].fighter, "player 1");
    assert.equal(room.gameStart, false);
    assert.ok(env.io.find("lobby", "Room 1").length >= 1);
    assert.ok(env.io.find("rooms", "*").length >= 1, "everyone's room list refreshed");
    assert.equal(env.store.get(ackA.playerId).roomId, null);
  });

  it("opponent leaving during a hold evicts the held player (nothing to resume into)", () => {
    const { a, b, ackA, room } = seatAndFight();
    a.disconnect();
    a.fire("disconnect", "transport close");
    assert.ok(room.reconnectHold);
    b.fire("leave_room", { roomId: "Room 1" });
    assert.equal(room.reconnectHold, null);
    assert.equal(room.players.length, 0, "no ghost seat for the held player");
    const a2 = connect(env, "sockA2");
    const ack2 = hello(a2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ackA.token });
    assert.equal(ack2.resumed, false);
  });

  it("lobby disconnect (not in a bout) is NOT held — immediate removal as before", () => {
    const { a, room } = seatTwo(env);
    a.disconnect();
    a.fire("disconnect", "transport close");
    assert.ok(!room.reconnectHold);
    assert.equal(room.players.length, 1);
  });

  it("resumeHeldPlayer is safe to call without a live hitstop", () => {
    const { ackA, room } = seatAndFight();
    const player = room.players.find((p) => p.id === ackA.playerId);
    room.reconnectHold = { playerId: ackA.playerId, hitstopRemaining: 0 };
    const s = fakeSocket("z");
    resumeHeldPlayer(room, player, s, env.io);
    assert.equal(room.hitstopUntil, 0);
    assert.equal(room.reconnectHold, null);
  });
});

describe("lobby ready-up ordering", () => {
  let env;
  beforeEach(() => {
    env = makeEnv();
  });

  it("player 1 ready BEFORE player 2 joins still produces initial_game_start on player 2's Ready", () => {
    const a = connect(env, "sockA");
    const b = connect(env, "sockB");
    hello(a, { protocolVersion: PROTOCOL_VERSION });
    hello(b, { protocolVersion: PROTOCOL_VERSION });
    const room = env.rooms[0];
    a.fire("join_room", { roomId: "Room 1", socketId: "x", mawashiColor: "#111111", gearIds: [] });
    a.fire("ready_count", { roomId: "Room 1", isReady: true });
    assert.equal(room.readyCount, 1);
    b.fire("join_room", { roomId: "Room 1", socketId: "x", mawashiColor: "#222222", gearIds: [] });
    assert.equal(room.players[0].isReady, true, "waiting player keeps their Ready");
    assert.equal(room.readyCount, 1, "count stays consistent with the flag after the second join");
    assert.equal(room.matchInitiated, false, "still a lobby: tick loop must not start a bout");
    const countsToJoiner = env.io.find("ready_count", "Room 1").map((e) => e.payload);
    assert.ok(countsToJoiner.includes(1), "joiner is told the live count");
    b.fire("ready_count", { roomId: "Room 1", isReady: true });
    assert.equal(room.readyCount, 2);
    assert.equal(env.io.find("initial_game_start", "Room 1").length, 1, "match starts through the proper flow");
    assert.equal(room.matchInitiated, true);
  });

  it("P1 ready, P2 joins, P2 ready → initial_game_start emitted AND both isReady false afterwards", () => {
    const a = connect(env, "sockA");
    const b = connect(env, "sockB");
    hello(a, { protocolVersion: PROTOCOL_VERSION });
    hello(b, { protocolVersion: PROTOCOL_VERSION });
    const room = env.rooms[0];
    a.fire("join_room", { roomId: "Room 1", socketId: "x", mawashiColor: "#111111", gearIds: [] });
    a.fire("ready_count", { roomId: "Room 1", isReady: true });
    b.fire("join_room", { roomId: "Room 1", socketId: "x", mawashiColor: "#222222", gearIds: [] });
    b.fire("ready_count", { roomId: "Room 1", isReady: true });
    assert.equal(env.io.find("initial_game_start", "Room 1").length, 1);
    assert.equal(room.players[0].isReady, false);
    assert.equal(room.players[1].isReady, false);
  });
});

describe("socket replaced while the old one is still connected (no hold) → seat follows the session", () => {
  let env;
  beforeEach(() => {
    env = makeEnv();
  });

  it("lobby: the new socket takes over the seat and its later disconnect releases it (no ghost)", () => {
    const { a, ackA, room } = seatTwo(env);
    // Same token arrives on a NEW socket while sockA is still "connected".
    const a2 = connect(env, "sockA2");
    const ack2 = hello(a2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ackA.token });
    assert.equal(ack2.ok, true);
    assert.equal(ack2.playerId, ackA.playerId, "same identity");
    assert.equal(ack2.roomId, "Room 1", "client is told which room it is seated in");
    assert.equal(a.connected, false, "old socket evicted");
    assert.ok(a2.rooms.has("Room 1"), "new socket is a member of the room");
    assert.equal(a2.roomId, "Room 1");
    // The evicted socket's disconnect must NOT unseat the player (it owns nothing now).
    a.fire("disconnect", "server namespace disconnect");
    assert.equal(room.players.length, 2, "seat kept for the live socket");
    // ...but when the LIVE socket goes, the seat is released.
    a2.disconnect();
    a2.fire("disconnect", "transport close");
    assert.equal(room.players.some((p) => p.id === ackA.playerId), false, "no ghost seat");
    assert.equal(room.players.length, 1);
  });

  it("mid-bout: the new socket takes over and delta compression is re-baselined for a keyframe", () => {
    const { a, ackA, room } = seatTwo(env);
    room.gameStart = true;
    room.hakkiyoiCount = 1;
    room.simTime = 500_000;
    room.previousPlayerStates = [{ x: 1 }, { x: 2 }];
    const a2 = connect(env, "sockA2");
    const ack2 = hello(a2, { protocolVersion: PROTOCOL_VERSION, resumeToken: ackA.token });
    assert.equal(ack2.playerId, ackA.playerId);
    assert.equal(a.connected, false);
    assert.ok(!room.reconnectHold, "never held: the old socket was still connected");
    assert.ok(a2.rooms.has("Room 1"));
    assert.deepEqual(room.previousPlayerStates, [null, null], "re-baselined so the new socket gets a full state");
    assert.equal(room.forceBroadcast, true);
    // Inputs from the new socket drive the same fighter.
    const me = room.players.find((p) => p.id === ackA.playerId);
    me.inputQueue = [];
    a2.fire("fighter_action", { id: ackA.playerId, keys: { d: true }, events: [], seq: 1 });
    assert.equal(me.inputQueue.length, 1);
  });
});

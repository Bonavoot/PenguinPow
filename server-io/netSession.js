"use strict";

/**
 * Net session layer: protocol version gate, stable player identity, and
 * mid-match reconnect hold/resume.
 *
 * Why this exists (measured, not assumed):
 *   - Identity used to be the Socket.IO connection id. A transport drop gave
 *     the client a new id, the server removed the player from the room within
 *     one tick, and the opponent's match was over. Reconnecting the socket
 *     restored nothing.
 *   - Several handlers trusted a client-supplied playerId/socketId, so one
 *     client could ready/unready or pick a power-up for the other.
 *   - There was no protocol version, so an old client and a new server could
 *     meet and fail silently.
 *
 * Contract (shared/netProtocol.json is the single source of truth):
 *   client → server  "hello" { protocolVersion, resumeToken? }  (with ack)
 *   server → client  ack { ok:true, playerId, token, resumed, roomId|null, protocolVersion }
 *                  | ack { ok:false, reason:"protocol_mismatch", serverVersion, clientVersion }
 *   server → room    "opponent_reconnecting" { roomId, playerId, graceMs }
 *   server → room    "match_resumed"         { roomId, playerId }
 *
 * The session token is a 192-bit random secret known only to the issuing
 * client. It is never logged. Identity is a per-server-process session — the
 * Steam-backed identity layer of the target architecture will replace the
 * random playerId with a verified account id but keep this exact resume flow.
 */

const crypto = require("crypto");
// Deploy mirror of shared/netProtocol.json — server-io/ is the Heroku app root,
// so nothing at runtime may require above it (see test/foundation/
// authored-catalog-deploy-mirror.test.js). protocol-contract.test.js keeps the
// two byte-identical.
const proto = require("./netProtocol.json");
const { gameNow } = require("./gameUtils");

const PROTOCOL_VERSION = proto.PROTOCOL_VERSION;
const RECONNECT_GRACE_MS = proto.RECONNECT_GRACE_MS;
const HELLO_TIMEOUT_MS = proto.HELLO_TIMEOUT_MS;
const SESSION_IDLE_TTL_MS = proto.SESSION_IDLE_TTL_MS;
const INPUT_SEQ_MAX_JUMP = proto.INPUT_SEQ_MAX_JUMP;
const EVENTS = proto.EVENTS;

// ---------------------------------------------------------------------------
// Telemetry counters — bounded, no identifiers, safe to expose on /metrics.
// ---------------------------------------------------------------------------
const telemetry = {
  matchesAbandonedLeft: 0,
  matchesAbandonedDisconnected: 0,
  hellos: 0,
  sessionsIssued: 0,
  sessionsResumedIdentity: 0,
  sessionsResumedMatch: 0,
  protocolMismatches: 0,
  helloTimeouts: 0,
  socketReplaced: 0,
  seatTakeovers: 0,
  holdsStarted: 0,
  holdsResumed: 0,
  holdsExpired: 0,
  inputNoSeq: 0,
  inputStaleOrDup: 0,
  inputSeqJump: 0,
  unauthenticatedRejects: 0,
};

class SessionStore {
  constructor({ now = () => Date.now(), idleTtlMs = SESSION_IDLE_TTL_MS } = {}) {
    this.byPlayerId = new Map();
    this.byToken = new Map();
    this.now = now;
    this.idleTtlMs = idleTtlMs;
  }

  issue() {
    const playerId = `p_${crypto.randomBytes(8).toString("hex")}`;
    const token = crypto.randomBytes(24).toString("base64url");
    const session = {
      playerId,
      token,
      socketId: null,
      roomId: null,
      createdAt: this.now(),
      lastSeenAt: this.now(),
      inputSeqLast: -1,
    };
    this.byPlayerId.set(playerId, session);
    this.byToken.set(token, session);
    telemetry.sessionsIssued++;
    return session;
  }

  resume(token) {
    if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
    const session = this.byToken.get(token) || null;
    if (session) session.lastSeenAt = this.now();
    return session;
  }

  get(playerId) {
    return this.byPlayerId.get(playerId) || null;
  }

  forget(playerId) {
    const s = this.byPlayerId.get(playerId);
    if (!s) return;
    this.byPlayerId.delete(playerId);
    this.byToken.delete(s.token);
  }

  /** Drop sessions that are detached, room-less, and idle past the TTL. */
  sweep() {
    const cutoff = this.now() - this.idleTtlMs;
    let dropped = 0;
    for (const s of this.byPlayerId.values()) {
      if (s.socketId == null && s.roomId == null && s.lastSeenAt < cutoff) {
        this.forget(s.playerId);
        dropped++;
      }
    }
    return dropped;
  }

  get size() {
    return this.byPlayerId.size;
  }
}

// ---------------------------------------------------------------------------
// Socket binding helpers
// ---------------------------------------------------------------------------
function getSocketPlayerId(socket) {
  return (socket && socket.data && socket.data.playerId) || null;
}

function bindSocketToSession(socket, session) {
  if (!socket.data) socket.data = {};
  socket.data.playerId = session.playerId;
  session.socketId = socket.id;
  session.lastSeenAt = Date.now();
  // Targeted emits use io.to(player.id); joining a room named by the stable
  // playerId keeps those working across reconnects.
  socket.join(session.playerId);
}

/**
 * Attach the "hello" handler + unauthenticated-socket timeout. Returns a
 * function used by the disconnect path to detach the session.
 *
 * ctx = { io, rooms, store, findRoomForPlayer(playerId) → room|null,
 *         onResumeIntoRoom(socket, room, player) }
 */
function attachHello(socket, ctx) {
  const { io, store } = ctx;
  let helloSeen = false;

  const timeout = setTimeout(() => {
    if (helloSeen || !socket.connected) return;
    telemetry.helloTimeouts++;
    socket.disconnect(true);
  }, HELLO_TIMEOUT_MS);
  if (typeof timeout.unref === "function") timeout.unref();

  socket.on(EVENTS.HELLO, (data, ack) => {
    telemetry.hellos++;
    const reply = typeof ack === "function" ? ack : () => {};
    if (helloSeen) {
      // Idempotent: repeat hello returns the current binding.
      const s = store.get(getSocketPlayerId(socket));
      if (s) reply({ ok: true, playerId: s.playerId, token: s.token, resumed: false, roomId: s.roomId, protocolVersion: PROTOCOL_VERSION });
      return;
    }
    const clientVersion = data && typeof data.protocolVersion === "number" ? data.protocolVersion : null;
    if (clientVersion !== PROTOCOL_VERSION) {
      telemetry.protocolMismatches++;
      reply({ ok: false, reason: "protocol_mismatch", serverVersion: PROTOCOL_VERSION, clientVersion });
      // Give the ack a moment to flush, then drop the connection.
      setTimeout(() => socket.disconnect(true), 50);
      return;
    }
    helloSeen = true;
    clearTimeout(timeout);

    let session = store.resume(data && data.resumeToken);
    let resumed = false;
    let roomId = null;
    if (session) {
      // Newest connection wins. Any still-connected previous socket for this
      // session is evicted so two sockets can never drive one fighter.
      if (session.socketId && session.socketId !== socket.id) {
        const prev = io.sockets.sockets.get(session.socketId);
        if (prev && prev.connected) {
          telemetry.socketReplaced++;
          if (prev.data) prev.data.playerId = null;
          prev.disconnect(true);
        }
      }
      bindSocketToSession(socket, session);
      telemetry.sessionsResumedIdentity++;
      const room = session.roomId ? ctx.findRoomForPlayer(session.playerId) : null;
      const seated = room ? room.players.find((p) => p.id === session.playerId) : null;
      if (room && seated && room.reconnectHold && room.reconnectHold.playerId === session.playerId) {
        resumeHeldPlayer(room, seated, socket, io);
        ctx.onResumeIntoRoom && ctx.onResumeIntoRoom(socket, room, seated);
        resumed = true;
        roomId = room.id;
        telemetry.sessionsResumedMatch++;
      } else if (room && seated) {
        // Seated but NOT held: the previous socket was still "connected" when
        // this one arrived (half-open TCP after a network flap, or a second
        // tab that was just evicted above). The seat follows the session, so
        // the NEW socket must take over the room membership — otherwise it
        // receives no room broadcasts and, when it later disconnects, the
        // seat can never be released (ghost player).
        socket.join(room.id);
        socket.roomId = room.id;
        if (isRoomInGameSession(room)) {
          room.previousPlayerStates = [null, null];
          room.forceBroadcast = true;
        }
        telemetry.seatTakeovers = (telemetry.seatTakeovers || 0) + 1;
        roomId = room.id;
      } else if (!room) {
        session.roomId = null;
      }
    } else {
      session = store.issue();
      bindSocketToSession(socket, session);
    }
    reply({ ok: true, playerId: session.playerId, token: session.token, resumed, roomId, protocolVersion: PROTOCOL_VERSION });
  });

  return function detach() {
    clearTimeout(timeout);
    const pid = getSocketPlayerId(socket);
    const s = pid ? store.get(pid) : null;
    if (s && s.socketId === socket.id) {
      s.socketId = null;
      s.lastSeenAt = Date.now();
    }
  };
}

// ---------------------------------------------------------------------------
// Reconnect hold / resume
// ---------------------------------------------------------------------------

/** True when a room is in a state where losing a player ends the match. */
function isRoomInGameSession(room) {
  return !!(
    room.powerUpSelectionPhase ||
    room.gameStart ||
    room.gameOver ||
    room.hakkiyoiCount > 0 ||
    (room.players || []).some(
      (p) => p.isThrowingSalt || (p.canMoveToReady === false && (room.gameStart || room.powerUpSelectionPhase))
    )
  );
}

/**
 * Socket.IO disconnect reasons that mean the CLIENT chose to leave (closed the
 * app cleanly, called disconnect()). Everything else is a transport loss.
 */
const INTENTIONAL_DISCONNECT_REASONS = new Set([
  "client namespace disconnect",
  "server namespace disconnect",
  "io client disconnect",
  "io server disconnect",
]);

function isIntentionalDisconnect(reason) {
  return INTENTIONAL_DISCONNECT_REASONS.has(String(reason || ""));
}

/**
 * Should the disconnecting player be HELD (match frozen briefly) rather than
 * removed? Only for an unintentional transport loss during a live 2-human
 * bout. Intentional leaves, lobby drops, CPU/training/Basho rooms, decided
 * matches and already-held rooms all take the immediate path.
 */
function shouldHoldOnDisconnect(room, player, reason) {
  if (!room || !player || player.isCPU) return false;
  if (room.isCPURoom) return false; // solo modes: local server, nothing to hold for
  if (room.matchOver) return false; // match is decided; nothing to protect
  if (room.reconnectHold) return false; // only one hold at a time (2nd drop → forfeit path)
  if (!room.players || room.players.length !== 2) return false;
  if (reason !== undefined && isIntentionalDisconnect(reason)) return false;
  return isRoomInGameSession(room);
}

/** Grace window for a room (a future tournament coordinator may lengthen it). */
function reconnectGraceFor(room) {
  const v = room && room.reconnectGraceMs;
  return typeof v === "number" && v >= 0 ? v : RECONNECT_GRACE_MS;
}

/**
 * Freeze the room and wait for the player to come back. `onExpire` runs the
 * caller's existing removal path when the grace window lapses.
 */
function beginReconnectHold(room, player, io, onExpire, graceMs = reconnectGraceFor(room)) {
  const now = gameNow();
  const hitstopRemaining = room.hitstopUntil ? Math.max(0, room.hitstopUntil - now) : 0;
  room.reconnectHold = {
    playerId: player.id,
    sinceGameNow: now,
    deadlineGameNow: now + graceMs,
    graceMs,
    hitstopRemaining,
  };
  player.isDisconnected = true;
  player.inputQueue = [];
  // Release every held key so the fighter doesn't keep acting on stale
  // "still held" state after the sim resumes; the client re-sends its live
  // key snapshot on resume.
  if (player.keys) for (const k of Object.keys(player.keys)) player.keys[k] = false;
  telemetry.holdsStarted++;

  const opponent = room.players.find((p) => p.id !== player.id);
  if (opponent) {
    io.to(opponent.id).emit(EVENTS.OPPONENT_RECONNECTING, {
      roomId: room.id,
      playerId: player.id,
      graceMs,
    });
  }
  room.reconnectTimer = setTimeout(() => {
    room.reconnectTimer = null;
    if (!room.reconnectHold || room.reconnectHold.playerId !== player.id) return;
    room.reconnectHold = null;
    telemetry.holdsExpired++;
    onExpire();
  }, graceMs);
  if (typeof room.reconnectTimer.unref === "function") room.reconnectTimer.unref();
}

function resumeHeldPlayer(room, player, socket, io) {
  const hold = room.reconnectHold;
  if (room.reconnectTimer) {
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = null;
  }
  room.reconnectHold = null;
  player.isDisconnected = false;
  player.inputQueue = [];
  // Re-arm whatever hitstop was live when the hold began so the freeze that
  // was interrupted finishes on the sim clock, not the wall clock.
  if (hold && hold.hitstopRemaining > 0) room.hitstopUntil = gameNow() + hold.hitstopRemaining;
  socket.join(room.id);
  socket.roomId = room.id;
  // Re-baseline delta compression for everyone: the returning client may have
  // lost its accumulated state, and the opponent stopped receiving packets.
  room.previousPlayerStates = [null, null];
  room.forceBroadcast = true;
  telemetry.holdsResumed++;
  io.in(room.id).emit(EVENTS.MATCH_RESUMED, { roomId: room.id, playerId: player.id });
}

/** Cancel a hold without resuming (room reset / opponent left). */
function clearReconnectHold(room) {
  if (!room) return;
  if (room.reconnectTimer) {
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = null;
  }
  room.reconnectHold = null;
}

/** Tick loop gate: a held room does not advance. */
function isRoomHeldForReconnect(room) {
  return !!(room && room.reconnectHold);
}

// ---------------------------------------------------------------------------
// Input sequence contract
// ---------------------------------------------------------------------------
/**
 * Every fighter_action packet carries a per-session monotonically increasing
 * `seq`. Returns true when the packet should be enqueued.
 *   - missing/invalid seq → drop (protocol v2 requires it)
 *   - seq <= last        → stale or duplicate → drop
 *   - jump > INPUT_SEQ_MAX_JUMP → accept but count (client restart / bug)
 */
function acceptInputSeq(player, data) {
  const seq = data && data.seq;
  if (typeof seq !== "number" || !Number.isFinite(seq) || seq < 0) {
    telemetry.inputNoSeq++;
    return false;
  }
  const last = typeof player.inputSeqLast === "number" ? player.inputSeqLast : -1;
  if (seq <= last) {
    telemetry.inputStaleOrDup++;
    player.inputStaleOrDupCount = (player.inputStaleOrDupCount || 0) + 1;
    return false;
  }
  if (seq - last > INPUT_SEQ_MAX_JUMP && last >= 0) telemetry.inputSeqJump++;
  player.inputSeqLast = seq;
  return true;
}

/**
 * Called at drain time so the broadcast can echo the last CONSUMED seq and
 * the sim time it was consumed at. Together with the packet's simTime this
 * lets the client anchor prediction reconciliation to an exact tick.
 */
function noteInputConsumed(player, data, room) {
  if (data && typeof data.seq === "number") {
    player.inputSeqAck = data.seq;
    if (room && typeof room.simTime === "number") player.inputAckSimTime = room.simTime;
  }
}

function snapshotTelemetry() {
  return { ...telemetry };
}

module.exports = {
  PROTOCOL_VERSION,
  RECONNECT_GRACE_MS,
  HELLO_TIMEOUT_MS,
  PREMATCH_READY_CAP_MS: proto.PREMATCH_READY_CAP_MS,
  PING_INTERVAL_MS: proto.PING_INTERVAL_MS,
  PING_TIMEOUT_MS: proto.PING_TIMEOUT_MS,
  EVENTS,
  SessionStore,
  attachHello,
  getSocketPlayerId,
  bindSocketToSession,
  isRoomInGameSession,
  isIntentionalDisconnect,
  reconnectGraceFor,
  shouldHoldOnDisconnect,
  beginReconnectHold,
  resumeHeldPlayer,
  clearReconnectHold,
  isRoomHeldForReconnect,
  acceptInputSeq,
  noteInputConsumed,
  snapshotTelemetry,
  _telemetry: telemetry,
};

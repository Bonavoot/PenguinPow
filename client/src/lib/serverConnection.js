// ============================================
// GAME SERVER CONNECTION — remote/local routing
// ============================================
// The app historically had ONE socket to the remote (Heroku) server, which
// meant single-player modes (VS CPU, BASHO) paid a full internet round trip
// on every action confirm and sound. This module keeps that remote socket
// but adds a second, lazily-created socket to a LOCAL server (spawned by the
// Electron main process — see main.js — or the dev server on :3001) and
// routes between them.
//
// `gameSocket` is a facade with a STABLE identity: every component keeps
// using it exactly like the old socket (same context value, same on/off/emit
// surface). Switching servers migrates all registered listeners to the new
// underlying socket atomically — synchronously, inside the click handler —
// so there is no re-render race where a server response could arrive before
// React re-registered the listeners.
//
// Routing policy (see selectGameServer callers):
//   - VS CPU / BASHO match creation → "local" (falls back to remote if the
//     local server isn't available, so behavior is never worse than before)
//   - Main menu / online rooms      → "remote"
//
// After a switch the facade synthesizes a "connect" event so App-level
// handlers refresh localId, and it kicks a server-clock re-handshake —
// each server process has its own monotonic clock origin, so the old
// offset is garbage on the new server (hitstop alignment + parry
// lag-compensation both depend on it).

//
// SESSION CONTRACT (netSessionClient.js / server-io/netSession.js): on every
// underlying `connect` — first connect AND every auto-reconnect — the facade
// sends "hello" { protocolVersion, resumeToken } and only announces `connect`
// to the app once the server has acked with a stable playerId. `gameSocket.id`
// is that playerId (not the transient socket.io id), so identity survives a
// transport drop and a held match resumes. Every fighter_action is stamped
// with a per-session monotonic `seq`. A protocol-version mismatch surfaces as
// a local "protocol_mismatch" event instead of a silent hang.

import { io } from "socket.io-client";
import { resyncServerClock } from "./serverClock";
import { SessionState, NET_EVENTS } from "./netSessionClient";

const REMOTE_URL = import.meta.env.PROD
  ? "https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/"
  : "http://localhost:3001";

const SOCKET_OPTIONS = {
  reconnection: true,
  // The server holds a bout for RECONNECT_GRACE_MS (5 s) after it notices a
  // transport loss, so the first retries must be quick; keep retrying for
  // ~40 s in total before declaring the connection lost.
  reconnectionAttempts: 20,
  reconnectionDelay: 400,
  reconnectionDelayMax: 2000,
  randomizationFactor: 0.3,
  transports: ["websocket", "polling"],
};

const LOCAL_CONNECT_TIMEOUT_MS = 4000;
const HELLO_ACK_TIMEOUT_MS = 5000;

// Events the facade owns: they are synthesized after the session handshake
// (or from the socket.io Manager) instead of being attached to the raw socket.
const FACADE_OWNED_EVENTS = new Set(["connect", NET_EVENTS.SESSION, "protocol_mismatch", "reconnect_failed"]);

class SocketFacade {
  constructor(initialSocket) {
    this._active = initialSocket;
    // event -> Set<fn>. Source of truth for listener migration on switch.
    this._listeners = new Map();
    // raw socket -> SessionState (one identity per server process)
    this._sessions = new WeakMap();
    this._attachSession(initialSocket, "remote");
  }

  /** Stable per-server player id once the hello handshake completed. */
  get id() {
    const s = this._sessions.get(this._active);
    return (s && s.status === "ready" && s.playerId) || this._active.id;
  }

  get connected() {
    return this._active.connected;
  }

  /** True once the active socket is connected AND its session is established. */
  get sessionReady() {
    const s = this._sessions.get(this._active);
    return !!(this._active.connected && s && s.status === "ready");
  }

  get session() {
    return this._sessions.get(this._active) || null;
  }

  on(event, fn) {
    let fns = this._listeners.get(event);
    if (!fns) {
      fns = new Set();
      this._listeners.set(event, fns);
    }
    fns.add(fn);
    if (!FACADE_OWNED_EVENTS.has(event)) this._active.on(event, fn);
    return this;
  }

  // Mirrors socket.io semantics: off(event, fn) removes one listener,
  // off(event) removes all listeners for that event.
  off(event, fn) {
    const fns = this._listeners.get(event);
    if (fn) {
      if (fns) fns.delete(fn);
      if (!FACADE_OWNED_EVENTS.has(event)) this._active.off(event, fn);
    } else {
      if (fns) this._listeners.delete(event);
      if (!FACADE_OWNED_EVENTS.has(event)) this._active.off(event);
    }
    return this;
  }

  emit(event, ...args) {
    if (event === "fighter_action" && args[0] && typeof args[0] === "object") {
      const s = this._sessions.get(this._active);
      if (s) s.stampInput(args[0]);
    }
    this._active.emit(event, ...args);
    return this;
  }

  connect() {
    this._active.connect();
    return this;
  }

  setActive(nextSocket) {
    if (nextSocket === this._active) return;
    const prev = this._active;
    for (const [event, fns] of this._listeners) {
      if (FACADE_OWNED_EVENTS.has(event)) continue;
      for (const fn of fns) {
        prev.off(event, fn);
        nextSocket.on(event, fn);
      }
    }
    this._active = nextSocket;
    // Each server process has its own clock origin — invalidate the sync
    // BEFORE announcing the switch so nothing converts timestamps with a
    // stale offset.
    resyncServerClock();
    // Synthesize lifecycle so App handlers (localId, connectionError) refresh
    // for the already-connected new socket — but only once its session is
    // ready; otherwise the pending hello ack will announce it.
    if (this.sessionReady) {
      this._dispatchLocal("connect");
    }
  }

  _dispatchLocal(event, ...args) {
    const fns = this._listeners.get(event);
    if (!fns) return;
    for (const fn of [...fns]) fn(...args);
  }

  /**
   * Bind the hello handshake to a raw socket. Runs on every raw `connect`
   * (including socket.io auto-reconnects, which give the socket a new id).
   */
  _attachSession(rawSocket, serverKey) {
    if (this._sessions.has(rawSocket)) return this._sessions.get(rawSocket);
    const session = new SessionState(serverKey);
    this._sessions.set(rawSocket, session);
    rawSocket.on("connect", () => this._hello(rawSocket, session));
    // The Manager gives up after reconnectionAttempts; surface that as a
    // facade event so an in-match view can leave instead of freezing forever.
    rawSocket.io.on("reconnect_failed", () => {
      if (rawSocket === this._active) this._dispatchLocal("reconnect_failed");
    });
    return session;
  }

  _hello(rawSocket, session) {
    let settled = false;
    const finish = (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = session.applyHelloAck(ack);
      const waiters = session._waiters || [];
      session._waiters = [];
      for (const w of waiters) w(result.ok);
      if (rawSocket !== this._active) return; // switched servers mid-handshake
      if (!result.ok) {
        console.error("[serverConnection] protocol mismatch", result);
        this._dispatchLocal("protocol_mismatch", result);
        return;
      }
      this._dispatchLocal(NET_EVENTS.SESSION, result);
      this._dispatchLocal("connect");
    };
    const timer = setTimeout(() => finish(null), HELLO_ACK_TIMEOUT_MS);
    rawSocket.emit(NET_EVENTS.HELLO, session.helloPayload(), finish);
  }

  /** Resolve true once `rawSocket` is connected and its session handshake succeeded. */
  waitForSession(rawSocket, timeoutMs) {
    const session = this._sessions.get(rawSocket);
    if (!session) return Promise.resolve(false);
    if (rawSocket.connected && session.status === "ready") return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      session._waiters = session._waiters || [];
      session._waiters.push((ok) => {
        clearTimeout(timer);
        resolve(ok);
      });
    });
  }
}

const remoteSocket = io(REMOTE_URL, SOCKET_OPTIONS);
let localSocket = null;

export const gameSocket = new SocketFacade(remoteSocket);

async function resolveLocalUrl() {
  // Electron: the main process spawns server-io and reports its port
  // (null if the spawn failed — caller falls back to remote).
  const localServerApi = window.electron?.localServer;
  if (localServerApi?.getPort) {
    try {
      const port = await localServerApi.getPort();
      return port ? `http://127.0.0.1:${port}` : null;
    } catch {
      return null;
    }
  }
  // Browser dev: the dev server on :3001 IS local. In a production web
  // build without Electron there is no local server.
  return import.meta.env.PROD ? null : "http://localhost:3001";
}

/**
 * Route the game socket to "local" or "remote". Resolves to the facade
 * (always usable). "local" falls back to the remote server when no local
 * server is available or it doesn't connect in time — never worse than the
 * pre-local-server behavior.
 */
export async function selectGameServer(target) {
  if (target !== "local") {
    gameSocket.setActive(remoteSocket);
    return gameSocket;
  }
  try {
    if (!localSocket) {
      const url = await resolveLocalUrl();
      if (!url) {
        console.warn("[serverConnection] No local server available; staying on remote");
        gameSocket.setActive(remoteSocket);
        return gameSocket;
      }
      localSocket = io(url, {
        ...SOCKET_OPTIONS,
        // The local server can't vanish the way a network can — keep trying.
        reconnectionAttempts: Infinity,
      });
      gameSocket._attachSession(localSocket, "local");
    }
    // Connected AND session-ready: the server ignores room-creating events
    // from a socket that has not completed the hello handshake.
    const connected = await gameSocket.waitForSession(localSocket, LOCAL_CONNECT_TIMEOUT_MS);
    if (!connected) {
      console.warn("[serverConnection] Local server didn't establish a session in time; using remote");
      gameSocket.setActive(remoteSocket);
      return gameSocket;
    }
    gameSocket.setActive(localSocket);
  } catch (error) {
    console.warn("[serverConnection] Local server selection failed; using remote", error);
    gameSocket.setActive(remoteSocket);
  }
  return gameSocket;
}

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

import { io } from "socket.io-client";
import { resyncServerClock } from "./serverClock";

const REMOTE_URL = import.meta.env.PROD
  ? "https://secure-beach-15962-3c882c6fcbf9.herokuapp.com/"
  : "http://localhost:3001";

const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket", "polling"],
};

const LOCAL_CONNECT_TIMEOUT_MS = 4000;

class SocketFacade {
  constructor(initialSocket) {
    this._active = initialSocket;
    // event -> Set<fn>. Source of truth for listener migration on switch.
    this._listeners = new Map();
  }

  get id() {
    return this._active.id;
  }

  get connected() {
    return this._active.connected;
  }

  on(event, fn) {
    let fns = this._listeners.get(event);
    if (!fns) {
      fns = new Set();
      this._listeners.set(event, fns);
    }
    fns.add(fn);
    this._active.on(event, fn);
    return this;
  }

  // Mirrors socket.io semantics: off(event, fn) removes one listener,
  // off(event) removes all listeners for that event.
  off(event, fn) {
    const fns = this._listeners.get(event);
    if (fn) {
      if (fns) fns.delete(fn);
      this._active.off(event, fn);
    } else {
      if (fns) this._listeners.delete(event);
      this._active.off(event);
    }
    return this;
  }

  emit(...args) {
    this._active.emit(...args);
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
    // for the already-connected new socket.
    if (nextSocket.connected) {
      this._dispatchLocal("connect");
    }
  }

  _dispatchLocal(event, ...args) {
    const fns = this._listeners.get(event);
    if (!fns) return;
    for (const fn of [...fns]) fn(...args);
  }
}

const remoteSocket = io(REMOTE_URL, SOCKET_OPTIONS);
let localSocket = null;

export const gameSocket = new SocketFacade(remoteSocket);

function waitForConnect(socket, timeoutMs) {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onConnect = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      resolve(true);
    };
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      resolve(false);
    }, timeoutMs);
    socket.on("connect", onConnect);
  });
}

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
    }
    const connected = await waitForConnect(localSocket, LOCAL_CONNECT_TIMEOUT_MS);
    if (!connected) {
      console.warn("[serverConnection] Local server didn't connect in time; using remote");
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

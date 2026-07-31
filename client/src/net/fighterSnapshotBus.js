/**
 * Phase 5 — single merge of fighter_action packets + optional resync.
 * GameFighter, camera, and VFX listeners all read the shared accumulator so
 * raw deltas are not re-interpreted independently.
 */

const sharedFighterState = {
  player1: null,
  player2: null,
  lastPacket: null,
  lastSeq: null,
  simTime: null,
};

let masteryP5Live = false;
let lastResyncAt = 0;
const RESYNC_MIN_INTERVAL_MS = 750;
/** @type {((state: typeof sharedFighterState, packet: object) => void)[]} */
const listeners = [];

/** Single socket.io owner for fighter_action → merge → fan-out. */
let boundSocket = null;
let boundHandler = null;
let retainCount = 0;

export function getSharedFighterState() {
  return sharedFighterState;
}

/**
 * Refcounted bind: exactly one socket.on("fighter_action") merges + notifies
 * subscribers. Call from Game (or any long-lived owner) while a match is mounted.
 */
export function retainFighterSocket(socket) {
  if (!socket?.on) {
    return () => {};
  }
  retainCount += 1;
  if (boundSocket !== socket) {
    if (boundSocket && boundHandler) {
      boundSocket.off("fighter_action", boundHandler);
    }
    boundSocket = socket;
    boundHandler = (data) => {
      mergeFighterPacket(data, socket);
    };
    socket.on("fighter_action", boundHandler);
  }
  return () => {
    retainCount = Math.max(0, retainCount - 1);
    if (retainCount === 0 && boundSocket && boundHandler) {
      boundSocket.off("fighter_action", boundHandler);
      boundSocket = null;
      boundHandler = null;
    }
  };
}

export function isMasteryP5Live() {
  return masteryP5Live;
}

export function subscribeFighterSnapshot(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}

export function resetFighterSnapshot() {
  sharedFighterState.player1 = null;
  sharedFighterState.player2 = null;
  sharedFighterState.lastPacket = null;
  sharedFighterState.lastSeq = null;
  sharedFighterState.simTime = null;
  masteryP5Live = false;
}

/**
 * Ask the server for a full tracked snapshot (visibility return / gap recovery).
 * Throttled so focus+visibility storms don't spam.
 */
export function requestFighterResync(socket, reason = "manual") {
  if (!socket?.emit) return;
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastResyncAt < RESYNC_MIN_INTERVAL_MS) return;
  lastResyncAt = now;
  socket.emit("request_fighter_resync", { reason });
  try {
    const perf = globalThis.__PUMO_PERF;
    if (perf?.enabled) {
      perf.count("net.resync");
      perf.mark("net.resync", { reason });
    }
  } catch {
    /* ignore */
  }
}

export function mergeFighterPacket(data, socket = null) {
  if (!data || data === sharedFighterState.lastPacket) {
    return sharedFighterState;
  }
  sharedFighterState.lastPacket = data;

  if (typeof data.masteryP5 === "boolean") {
    masteryP5Live = data.masteryP5;
  }
  if (typeof data.simTime === "number") {
    sharedFighterState.simTime = data.simTime;
  }

  if (typeof data.seq === "number") {
    const prev = sharedFighterState.lastSeq;
    if (
      prev != null &&
      !data.isResync &&
      !data.isKeyframe &&
      data.seq > prev + 1
    ) {
      try {
        const perf = globalThis.__PUMO_PERF;
        if (perf?.enabled) {
          perf.count("net.seqGap");
          perf.mark("net.seqGap", {
            prev,
            seq: data.seq,
            gap: data.seq - prev,
          });
        }
      } catch {
        /* ignore */
      }
      if (socket) requestFighterResync(socket, "seq_gap");
    }
    sharedFighterState.lastSeq = data.seq;
  }

  const useDelta =
    data.isDelta &&
    !data.isKeyframe &&
    !data.isResync &&
    sharedFighterState.player1 &&
    sharedFighterState.player2;

  if (useDelta) {
    const d1 = data.player1;
    const d2 = data.player2;
    const a1 = sharedFighterState.player1;
    const a2 = sharedFighterState.player2;
    if (d1) for (const k in d1) a1[k] = d1[k];
    if (d2) for (const k in d2) a2[k] = d2[k];
  } else {
    sharedFighterState.player1 = { ...(data.player1 || {}) };
    sharedFighterState.player2 = { ...(data.player2 || {}) };
  }

  for (let i = 0; i < listeners.length; i++) {
    try {
      listeners[i](sharedFighterState, data);
    } catch {
      /* ignore subscriber errors */
    }
  }

  return sharedFighterState;
}

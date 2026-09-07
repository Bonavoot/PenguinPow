// ============================================
// NET SESSION — client half of the session contract (pure, testable)
// ============================================
// Mirrors server-io/netSession.js. The connection facade (serverConnection.js)
// owns the socket; this module owns the per-server session STATE and the
// packet/handshake shapes so they can be unit-tested without a socket.
//
//   hello   → { protocolVersion, resumeToken? }
//   ack     → { ok, playerId, token, resumed, roomId, protocolVersion }
//           | { ok:false, reason:"protocol_mismatch", serverVersion, clientVersion }
//   input   → every fighter_action carries a per-session monotonic `seq`
//             and the stable playerId as `id`.
//
// LIFETIME: the resume token lives in memory only — it survives socket.io
// reconnects within the running page (a Wi‑Fi blip mid-bout resumes the same
// fighter) but NOT a page load. A fresh load has no match UI to resume into,
// and persisting the token caused three real bugs: a duplicated tab inherited
// sessionStorage and evicted the original ("kicked offline" when opening a
// second tab), a reload mid-bout was resumed into the held match while the UI
// sat on the title screen, and an evicted tab could ping-pong with its twin.
// Crash-relaunch reconnection (Basho) needs an explicit UI flow and a durable
// store, not an implicit resume.
//
// Telemetry counters are exposed for the perf recorder / debug HUD and never
// include the token.

import { PROTOCOL_VERSION, RECONNECT_GRACE_MS, EVENTS as NET_EVENTS } from "./netProtocol.js";

export { PROTOCOL_VERSION, RECONNECT_GRACE_MS, NET_EVENTS };

/**
 * One SessionState per server URL. Survives socket reconnects (same object);
 * a new page load always starts as a fresh identity.
 */
export class SessionState {
  constructor(serverKey) {
    this.serverKey = serverKey;
    this.playerId = null;
    this.token = null;
    this.roomId = null;
    this.status = "idle"; // idle | pending | ready | mismatch
    this.inputSeq = 0;
    this._sentAt = new Map(); // seq → local time of the input's key change
    this.stats = {
      hellos: 0,
      fresh: 0,
      resumedIdentity: 0,
      resumedMatch: 0,
      mismatches: 0,
      inputsSent: 0,
      lastAckSeq: -1,
    };
  }

  /** Payload for the "hello" emit. Includes the resume token when we have one. */
  helloPayload() {
    this.status = "pending";
    this.stats.hellos++;
    const payload = { protocolVersion: PROTOCOL_VERSION };
    if (this.token) payload.resumeToken = this.token;
    return payload;
  }

  /**
   * Apply the server's hello ack. Returns a normalized result object:
   *   { ok:true, playerId, resumed, roomId, identityChanged }
   *   { ok:false, reason, serverVersion }
   */
  applyHelloAck(ack) {
    if (!ack || ack.ok !== true) {
      this.status = "mismatch";
      this.stats.mismatches++;
      return {
        ok: false,
        reason: (ack && ack.reason) || "no_ack",
        serverVersion: ack ? ack.serverVersion : null,
      };
    }
    const identityChanged = this.playerId !== ack.playerId;
    if (identityChanged) {
      // New identity on this server: the old seq counter belongs to a dead session.
      this.inputSeq = 0;
      this.stats.fresh++;
    } else if (ack.resumed) {
      this.stats.resumedMatch++;
    } else {
      this.stats.resumedIdentity++;
    }
    this.playerId = ack.playerId;
    this.token = ack.token;
    this.roomId = ack.roomId || null;
    this.status = "ready";
    return { ok: true, playerId: this.playerId, resumed: !!ack.resumed, roomId: this.roomId, identityChanged };
  }

  /** Stamp an outgoing fighter_action packet in place. */
  stampInput(packet) {
    if (!packet || typeof packet !== "object") return packet;
    this.inputSeq += 1;
    packet.seq = this.inputSeq;
    if (this.playerId) packet.id = this.playerId;
    this.stats.inputsSent++;
    // Input ledger for tick-anchored reconciliation (movementPredictor): the
    // moment this input's key change happened locally. The first local
    // prediction step at/after it corresponds to the server tick that
    // consumed the packet. Falls back to the send time for eventless packets.
    let at = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (Array.isArray(packet.events)) {
      for (const ev of packet.events) if (ev && typeof ev.t === "number" && ev.t < at) at = ev.t;
    }
    this._sentAt.set(packet.seq, at);
    if (this._sentAt.size > 256) this._sentAt.delete(this._sentAt.keys().next().value);
    return packet;
  }

  /** Local time of the key change carried by input `seq` (undefined if unknown). */
  sentAt(seq) {
    return this._sentAt.get(seq);
  }

  /** Record the server's last consumed seq (from the fighter_action stream). */
  noteAck(seq) {
    if (typeof seq === "number" && seq > this.stats.lastAckSeq) this.stats.lastAckSeq = seq;
  }

  /** Inputs sent but not yet acknowledged as consumed. */
  get unackedInputs() {
    return Math.max(0, this.inputSeq - Math.max(0, this.stats.lastAckSeq));
  }

  forget() {
    this.playerId = null;
    this.token = null;
    this.roomId = null;
    this.inputSeq = 0;
    this.status = "idle";
  }
}

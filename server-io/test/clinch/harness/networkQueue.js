"use strict";

/**
 * Deterministic delayed-delivery queue for clinch network/timestamp tests.
 *
 * Simulates packet delay, reordering, duplicates, and loss by scheduling
 * delivery against an explicit clock — not real internet RTT.
 *
 * Does NOT simulate: jitter distributions, TCP congestion, NAT, partial
 * packet corruption, or Socket.IO transport framing.
 */

function createNetworkQueue() {
  let nextId = 1;
  const pending = [];

  return {
    /**
     * Enqueue a packet for delivery at deliverAt (same time domain as clock).
     * @param {*} packet
     * @param {number} deliverAt
     * @param {{ duplicate?: boolean, drop?: boolean }} [opts]
     */
    send(packet, deliverAt, opts = {}) {
      if (opts.drop) return null;
      const entry = {
        id: nextId++,
        packet,
        deliverAt,
      };
      pending.push(entry);
      if (opts.duplicate) {
        pending.push({
          id: nextId++,
          packet: typeof packet === "object" ? { ...packet } : packet,
          deliverAt: deliverAt + (opts.duplicateDelayMs || 1),
        });
      }
      return entry.id;
    },

    /** Deliver all packets with deliverAt <= now, sorted by deliverAt then id. */
    drain(now) {
      pending.sort((a, b) => a.deliverAt - b.deliverAt || a.id - b.id);
      const ready = [];
      while (pending.length && pending[0].deliverAt <= now) {
        ready.push(pending.shift());
      }
      return ready.map((e) => e.packet);
    },

    pendingCount() {
      return pending.length;
    },

    clear() {
      pending.length = 0;
    },
  };
}

/**
 * Build a fighter_action-like packet for processInputPacket.
 */
function makeInputPacket({
  keys,
  events = [],
  clientSynced = true,
  clientOffset = 0,
  clientRtt = 60,
  receiptGameNow,
  id,
} = {}) {
  return {
    id,
    keys: keys || {},
    events,
    clientSynced,
    clientOffset,
    clientRtt,
    _receiptGameNow: receiptGameNow,
  };
}

module.exports = {
  createNetworkQueue,
  makeInputPacket,
};

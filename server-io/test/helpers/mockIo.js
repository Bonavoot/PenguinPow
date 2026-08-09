"use strict";

/**
 * Minimal Socket.IO stub for clinch simulation.
 * Captures emits for assertions without a live server.
 */
function createMockIo() {
  const events = [];
  const roomEmitters = new Map();

  const io = {
    events,
    in(roomId) {
      if (!roomEmitters.has(roomId)) {
        roomEmitters.set(roomId, {
          emit(event, payload) {
            events.push({ roomId, event, payload, at: Date.now() });
          },
        });
      }
      return roomEmitters.get(roomId);
    },
    to(roomId) {
      return io.in(roomId);
    },
    clear() {
      events.length = 0;
    },
    find(eventName) {
      return events.filter((e) => e.event === eventName);
    },
    last(eventName) {
      const matches = io.find(eventName);
      return matches.length ? matches[matches.length - 1] : null;
    },
  };

  return io;
}

module.exports = { createMockIo };

"use strict";

/**
 * Deterministic command-grab harness.
 *
 * Covers the post-connect phase machine (belt-grip read → variant → Drive carry)
 * on an explicit sim clock. Never sleeps on wall-clock time.
 *
 * Hitstop note: production freezes simTime while room.hitstopUntil > gameNow().
 * The harness clears hitstop after each tick so advances stay deterministic —
 * capture emitted hitstop events before the clear if a test needs them.
 */

const {
  TICK_RATE,
  CLINCH_ATTACHED_DISTANCE,
  CMD_GRAB_CONNECT_STARTUP_MS,
} = require("../../../constants");
const {
  createInitialPlayerState,
  createInitialKeys,
} = require("../../../playerFactory");
const {
  setSimRoomResolver,
  advanceRoomSimTime,
  timeoutManager,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../../gameUtils");
const {
  beginCommandGrab,
  updateCommandGrab,
} = require("../../../commandGrabSystem");
const { createMockIo } = require("../../helpers/mockIo");

const DEFAULT_TICK_MS = 1000 / TICK_RATE; // 15.625

let harnessIdCounter = 0;

function blankKeys(overrides = {}) {
  return { ...createInitialKeys(), ...overrides };
}

/**
 * Build a grab that has just connected: P1 grabber (left), P2 victim (right).
 * `variant` is the locked selection, exactly as index.js would hand it over.
 * `midX` positions the PAIR, so edge tests can place the victim near a rope.
 */
function createCommandGrabScenario(options = {}) {
  harnessIdCounter += 1;
  const id = harnessIdCounter;
  const startSim = options.simTime != null ? options.simTime : 100_000;
  // Default to the settled grip distance so `gap()` assertions are meaningful:
  // sizeMultiplier is 0.85 by default, so raw CLINCH_ATTACHED_DISTANCE would leave
  // the pair mid-cinch at connect. `connectGap` places them further apart on
  // purpose when a test wants to observe the grip closing.
  const sizeMult = options.sizeMultiplier != null ? options.sizeMultiplier : 0.85;
  const settledAttach = CLINCH_ATTACHED_DISTANCE * sizeMult;
  const attach = options.connectGap != null ? options.connectGap : settledAttach;
  const midX = options.midX != null
    ? options.midX
    : (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;

  const p1 = createInitialPlayerState({
    id: `p1-${id}`,
    fighter: "player 1",
    x: midX - attach / 2,
    facing: 1,
    stamina: options.p1Stamina != null ? options.p1Stamina : 100,
    balance: options.p1Balance != null ? options.p1Balance : 100,
  });
  const p2 = createInitialPlayerState({
    id: `p2-${id}`,
    fighter: "player 2",
    x: midX + attach / 2,
    facing: -1,
    stamina: options.p2Stamina != null ? options.p2Stamina : 100,
    balance: options.p2Balance != null ? options.p2Balance : 100,
  });
  if (options.p2Gassed) p2.isGassed = true;
  if (options.p1Gassed) p1.isGassed = true;

  const grabber = p1;
  const victim = p2;

  for (const p of [p1, p2]) {
    p.keys = blankKeys();
    p.knockbackVelocity = { x: 0, y: 0 };
  }

  grabber.isGrabbing = true;
  grabber.grabbedOpponent = victim.id;
  grabber.grabStartTime = startSim;
  grabber.hasGrip = true;
  grabber.inClinch = true;
  grabber.gripAcquiredTime = startSim;
  victim.isBeingGrabbed = true;
  victim.hasGrip = true;
  victim.inClinch = true;
  victim.gripAcquiredTime = startSim;

  grabber.grabVariant = options.variant || "drive";
  grabber.grabVariantLocked = true;

  const io = createMockIo();
  const room = {
    id: `cmd-grab-room-${id}`,
    simTime: startSim,
    gameStart: true,
    hakkiyoiCount: 3,
    gameOver: false,
    matchOver: false,
    hitstopUntil: 0,
    players: [p1, p2],
    lastScreenShakeTime: 0,
  };
  const rooms = { [room.id]: room };

  const byId = new Map([
    [p1.id, room],
    [p2.id, room],
  ]);
  setSimRoomResolver((playerId) => byId.get(playerId) || null);

  const scenario = {
    room,
    rooms,
    io,
    p1,
    p2,
    grabber,
    victim,
    tickMs: options.tickMs != null ? options.tickMs : DEFAULT_TICK_MS,

    /** Fire the connect beat (what index.js does on a successful grab). */
    connect() {
      beginCommandGrab(grabber, victim, room, io);
      room.hitstopUntil = 0;
      return scenario;
    },

    /**
     * Advance the sim clock without running gameplay.
     *
     * Hitstop is cleared BEFORE advancing, not after: production freezes simTime
     * while a hitstop is live, so advancing first would let any freeze the previous
     * call left behind silently swallow the whole advance.
     */
    advanceTime(ms) {
      room.hitstopUntil = 0;
      if (ms > 0) advanceRoomSimTime(room, ms);
      timeoutManager.processRoom(room);
      room.hitstopUntil = 0;
      return scenario;
    },

    /** One authoritative tick at the current simTime. */
    tick({ advance = true, deltaMs } = {}) {
      const delta = deltaMs != null ? deltaMs : scenario.tickMs;
      updateCommandGrab(grabber, room, io, delta, rooms);
      timeoutManager.processRoom(room);
      room.hitstopUntil = 0;
      if (advance) {
        advanceRoomSimTime(room, delta);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
      }
      return scenario;
    },

    /**
     * Advance by ms in tick-sized steps, running gameplay each step. Advances the
     * clock first, then updates, so a boundary landing exactly on `ms` is observed.
     */
    advance(ms, { tickMs } = {}) {
      const step = tickMs != null ? tickMs : scenario.tickMs;
      let remaining = ms;
      while (remaining > 0.0001) {
        const d = Math.min(step, remaining);
        room.hitstopUntil = 0;
        advanceRoomSimTime(room, d);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
        updateCommandGrab(grabber, room, io, d, rooms);
        timeoutManager.processRoom(room);
        room.hitstopUntil = 0;
        remaining -= d;
      }
      return scenario;
    },

    gap() {
      return Math.abs(grabber.x - victim.x);
    },

    settledAttach,

    // The read beat is per-variant (Drive has none at all), so tests ask the
    // scenario rather than hard-coding a shared number.
    startupMs: CMD_GRAB_CONNECT_STARTUP_MS[options.variant || "drive"] ?? 0,

    /**
     * Advance just far enough for the variant to resolve. Always at least one tick:
     * a zero-length startup still needs a single update to fire.
     */
    resolveNow() {
      return scenario.advance(Math.max(scenario.startupMs, scenario.tickMs));
    },
  };

  return scenario;
}

module.exports = {
  createCommandGrabScenario,
  DEFAULT_TICK_MS,
  blankKeys,
};
